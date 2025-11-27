/**
 * Omni-Adapter Gemini Chrome Extension - API Interceptor
 * 
 * Uses Chrome Debugger API to intercept Gemini API responses
 * and extract generated image fileIds.
 */

// ============================================================================
// API Interceptor Class
// ============================================================================

class ApiInterceptor {
  constructor() {
    // Map of tabId -> debugger attached status
    this.attachedTabs = new Map();
    // Callback for when images are found
    this.onImagesFound = null;
    // Callback for errors
    this.onError = null;
    // Pending response bodies
    this.pendingBodies = new Map();
  }

  // ==========================================================================
  // Debugger Management
  // ==========================================================================

  /**
   * Attach debugger to a tab
   * @param {number} tabId - Chrome tab ID
   * @returns {Promise<boolean>} True if attached successfully
   */
  async attachDebugger(tabId) {
    if (this.attachedTabs.has(tabId)) {
      console.log(`[API Interceptor] Debugger already attached to tab ${tabId}`);
      return true;
    }

    try {
      await chrome.debugger.attach({ tabId }, '1.3');
      await chrome.debugger.sendCommand({ tabId }, 'Network.enable');
      this.attachedTabs.set(tabId, true);
      console.log(`[API Interceptor] Debugger attached to tab ${tabId}`);
      return true;
    } catch (error) {
      console.error(`[API Interceptor] Failed to attach debugger to tab ${tabId}:`, error);
      return false;
    }
  }

  /**
   * Detach debugger from a tab
   * @param {number} tabId - Chrome tab ID
   */
  async detachDebugger(tabId) {
    if (!this.attachedTabs.has(tabId)) {
      return;
    }

    try {
      await chrome.debugger.detach({ tabId });
      this.attachedTabs.delete(tabId);
      console.log(`[API Interceptor] Debugger detached from tab ${tabId}`);
    } catch (error) {
      console.error(`[API Interceptor] Failed to detach debugger from tab ${tabId}:`, error);
      this.attachedTabs.delete(tabId);
    }
  }

  /**
   * Check if debugger is attached to tab
   * @param {number} tabId - Chrome tab ID
   * @returns {boolean} True if attached
   */
  isAttached(tabId) {
    return this.attachedTabs.has(tabId);
  }

  // ==========================================================================
  // Response Handling
  // ==========================================================================

  /**
   * Handle debugger event
   * @param {object} source - Event source
   * @param {string} method - Event method
   * @param {object} params - Event parameters
   */
  async handleDebuggerEvent(source, method, params) {
    const tabId = source.tabId;

    if (method === 'Network.responseReceived') {
      const { requestId, response } = params;
      const url = response.url || '';

      // Check if this is the widgetStreamAssist API
      if (url.includes('widgetStreamAssist') || url.includes('streamAssist')) {
        console.log(`[API Interceptor] Detected API response: ${url}`);
        this.pendingBodies.set(requestId, { tabId, url });
      }
    }

    if (method === 'Network.loadingFinished') {
      const { requestId } = params;
      const pending = this.pendingBodies.get(requestId);

      if (pending) {
        this.pendingBodies.delete(requestId);
        await this.fetchResponseBody(pending.tabId, requestId);
      }
    }
  }

  /**
   * Fetch response body for a request
   * @param {number} tabId - Chrome tab ID
   * @param {string} requestId - Request ID
   */
  async fetchResponseBody(tabId, requestId) {
    try {
      const response = await chrome.debugger.sendCommand(
        { tabId },
        'Network.getResponseBody',
        { requestId }
      );

      if (response && response.body) {
        this.parseWidgetStreamResponse(tabId, response.body);
      }
    } catch (error) {
      console.error('[API Interceptor] Failed to get response body:', error);
    }
  }

  // ==========================================================================
  // Response Parsing
  // ==========================================================================

  /**
   * Parse widgetStreamAssist response and extract fileIds
   * @param {number} tabId - Chrome tab ID
   * @param {string} body - Response body
   */
  parseWidgetStreamResponse(tabId, body) {
    const fileInfos = [];

    try {
      // Response may be JSON array or newline-delimited JSON
      const lines = body.split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          const extracted = this.extractFileInfoFromResponse(data);
          fileInfos.push(...extracted);
        } catch (e) {
          // Try parsing as array
          if (line.startsWith('[')) {
            try {
              const arr = JSON.parse(line);
              for (const item of arr) {
                const extracted = this.extractFileInfoFromResponse(item);
                fileInfos.push(...extracted);
              }
            } catch (e2) {
              // Ignore parse errors
            }
          }
        }
      }

      // Also try parsing entire body as JSON
      if (fileInfos.length === 0) {
        try {
          const data = JSON.parse(body);
          if (Array.isArray(data)) {
            for (const item of data) {
              const extracted = this.extractFileInfoFromResponse(item);
              fileInfos.push(...extracted);
            }
          } else {
            const extracted = this.extractFileInfoFromResponse(data);
            fileInfos.push(...extracted);
          }
        } catch (e) {
          // Ignore
        }
      }

      if (fileInfos.length > 0) {
        console.log(`[API Interceptor] Found ${fileInfos.length} file(s):`, fileInfos);
        if (this.onImagesFound) {
          this.onImagesFound(tabId, fileInfos);
        }
      }
    } catch (error) {
      console.error('[API Interceptor] Failed to parse response:', error);
      if (this.onError) {
        this.onError(tabId, error);
      }
    }
  }

  /**
   * Extract file info from response object
   * @param {object} data - Response data object
   * @returns {Array} Array of file info objects
   */
  extractFileInfoFromResponse(data) {
    const fileInfos = [];

    if (!data) return fileInfos;

    // Navigate to streamAssistResponse.answer.replies
    const streamAssistResponse = data.streamAssistResponse || data;
    const answer = streamAssistResponse.answer;

    if (!answer) return fileInfos;

    // Check state
    const state = answer.state;
    if (state !== 'SUCCEEDED' && state !== 'IN_PROGRESS') {
      return fileInfos;
    }

    // Extract from replies
    const replies = answer.replies || [];
    for (const reply of replies) {
      const groundedContent = reply.groundedContent;
      if (!groundedContent) continue;

      const content = groundedContent.content;
      if (!content) continue;

      const file = content.file;
      if (file && file.fileId) {
        fileInfos.push({
          fileId: file.fileId,
          mimeType: file.mimeType || 'image/png'
        });
      }
    }

    return fileInfos;
  }

  // ==========================================================================
  // Download URL Construction
  // ==========================================================================

  /**
   * Build download URL for a file
   * @param {string} fileId - File ID
   * @param {string} projectId - Project ID
   * @param {string} sessionId - Session ID
   * @returns {string} Download URL
   */
  buildDownloadUrl(fileId, projectId, sessionId) {
    const baseUrl = 'https://biz-discoveryengine.googleapis.com/download/v1alpha';
    const path = `projects/${projectId}/locations/global/collections/default_collection/engines/agentspace-engine/sessions/${sessionId}:downloadFile`;
    return `${baseUrl}/${path}?fileId=${fileId}&alt=media`;
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  /**
   * Detach all debuggers
   */
  async detachAll() {
    for (const tabId of this.attachedTabs.keys()) {
      await this.detachDebugger(tabId);
    }
  }
}

// ============================================================================
// Exports (for testing and module usage)
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ApiInterceptor };
}
