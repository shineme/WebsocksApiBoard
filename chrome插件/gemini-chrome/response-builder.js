/**
 * Omni-Adapter Gemini Chrome Extension - Response Builder
 * 
 * Builds response messages to send back to WebSocket server
 * for task completion and error reporting.
 */

// ============================================================================
// Response Message Builders
// ============================================================================

/**
 * Build task complete message
 * @param {string} taskId - Task ID
 * @param {Array} images - Array of image objects with fileId and base64
 * @param {number} duration - Task duration in milliseconds
 * @returns {object} Task complete message
 */
function buildTaskCompleteMessage(taskId, images, duration) {
  return {
    type: 'task_complete',
    taskId: taskId,
    result: {
      images: images || [],
      status: 'completed'
    },
    duration: duration || 0
  };
}

/**
 * Build task error message
 * @param {string} taskId - Task ID
 * @param {string} error - Error description
 * @param {number} duration - Task duration in milliseconds
 * @returns {object} Task error message
 */
function buildTaskErrorMessage(taskId, error, duration) {
  return {
    type: 'task_error',
    taskId: taskId,
    error: error || 'Unknown error',
    duration: duration || 0
  };
}

/**
 * Build ready message to send after connection
 * @param {string} group - Group name
 * @param {number} tabCount - Number of available tabs
 * @returns {object} Ready message
 */
function buildReadyMessage(group, tabCount) {
  return {
    type: 'ready',
    group: group,
    capabilities: {
      model: 'gemini-image',
      features: ['text-to-image', 'image-to-image'],
      tabCount: tabCount || 0
    }
  };
}

/**
 * Build pong message in response to ping
 * @returns {object} Pong message
 */
function buildPongMessage() {
  return {
    type: 'pong',
    timestamp: Date.now()
  };
}

/**
 * Build status update message
 * @param {string} status - Current status
 * @param {object} details - Additional details
 * @returns {object} Status message
 */
function buildStatusMessage(status, details) {
  return {
    type: 'status',
    status: status,
    details: details || {},
    timestamp: Date.now()
  };
}

// ============================================================================
// Exports (for testing and module usage)
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    buildTaskCompleteMessage,
    buildTaskErrorMessage,
    buildReadyMessage,
    buildPongMessage,
    buildStatusMessage
  };
}
