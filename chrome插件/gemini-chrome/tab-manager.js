/**
 * Omni-Adapter Gemini Chrome Extension - Tab Manager
 * 
 * Manages multiple Gemini tabs, handles round-robin task distribution,
 * and maintains task queue for when all tabs are busy.
 */

// ============================================================================
// Tab Manager Class
// ============================================================================

class TabManager {
  constructor() {
    // Map of tabId -> TabInfo
    this.tabs = new Map();
    // Round-robin index for fair distribution
    this.roundRobinIndex = 0;
    // Task queue for when all tabs are busy
    this.taskQueue = [];
  }

  // ==========================================================================
  // Tab Management
  // ==========================================================================

  /**
   * Add a Gemini tab to the manager
   * @param {number} tabId - Chrome tab ID
   * @param {string} url - Tab URL
   */
  addGeminiTab(tabId, url) {
    this.tabs.set(tabId, {
      id: tabId,
      url: url,
      status: 'idle',
      lastUsed: Date.now()
    });
    console.log(`[Tab Manager] Added tab ${tabId}, total tabs: ${this.tabs.size}`);
  }

  /**
   * Remove a Gemini tab from the manager
   * @param {number} tabId - Chrome tab ID
   */
  removeGeminiTab(tabId) {
    this.tabs.delete(tabId);
    console.log(`[Tab Manager] Removed tab ${tabId}, total tabs: ${this.tabs.size}`);
  }

  /**
   * Set tab status
   * @param {number} tabId - Chrome tab ID
   * @param {string} status - 'idle' or 'busy'
   */
  setTabStatus(tabId, status) {
    const tab = this.tabs.get(tabId);
    if (tab) {
      const previousStatus = tab.status;
      tab.status = status;
      tab.lastUsed = Date.now();
      console.log(`[Tab Manager] Tab ${tabId} status: ${previousStatus} -> ${status}`);
      
      // Process queue when tab becomes idle
      if (previousStatus === 'busy' && status === 'idle') {
        this.processTaskQueue();
      }
    }
  }

  /**
   * Get tab info by ID
   * @param {number} tabId - Chrome tab ID
   * @returns {object|null} Tab info or null
   */
  getTab(tabId) {
    return this.tabs.get(tabId) || null;
  }

  /**
   * Get all Gemini tabs
   * @returns {Array} Array of tab info objects
   */
  getAllGeminiTabs() {
    return Array.from(this.tabs.values());
  }

  /**
   * Get count of tabs by status
   * @returns {object} Object with idle and busy counts
   */
  getTabCounts() {
    let idle = 0;
    let busy = 0;
    for (const tab of this.tabs.values()) {
      if (tab.status === 'idle') idle++;
      else busy++;
    }
    return { idle, busy, total: this.tabs.size };
  }

  // ==========================================================================
  // Round-Robin Selection
  // ==========================================================================

  /**
   * Get an idle tab using round-robin selection
   * @returns {object|null} Tab info or null if no idle tabs
   */
  getIdleTab() {
    const allTabs = this.getAllGeminiTabs();
    const idleTabs = allTabs.filter(t => t.status === 'idle');
    
    if (idleTabs.length === 0) {
      return null;
    }
    
    // Round-robin selection
    const index = this.roundRobinIndex % idleTabs.length;
    this.roundRobinIndex++;
    
    return idleTabs[index];
  }

  // ==========================================================================
  // Task Queue Management
  // ==========================================================================

  /**
   * Add task to queue
   * @param {object} task - Task object
   */
  enqueueTask(task) {
    this.taskQueue.push(task);
    console.log(`[Tab Manager] Task queued, queue length: ${this.taskQueue.length}`);
  }

  /**
   * Get next task from queue
   * @returns {object|null} Task or null if queue empty
   */
  dequeueTask() {
    return this.taskQueue.shift() || null;
  }

  /**
   * Get queue length
   * @returns {number} Number of tasks in queue
   */
  getQueueLength() {
    return this.taskQueue.length;
  }

  /**
   * Process task queue - called when a tab becomes idle
   * @param {function} taskHandler - Function to handle task
   */
  processTaskQueue(taskHandler) {
    if (this.taskQueue.length === 0) {
      return;
    }
    
    const idleTab = this.getIdleTab();
    if (!idleTab) {
      return;
    }
    
    const task = this.dequeueTask();
    if (task && taskHandler) {
      taskHandler(task, idleTab);
    }
  }

  /**
   * Clear all tabs and queue
   */
  clear() {
    this.tabs.clear();
    this.taskQueue = [];
    this.roundRobinIndex = 0;
  }
}

// ============================================================================
// Singleton Instance (for background script)
// ============================================================================

// Create singleton instance if in browser context
if (typeof window !== 'undefined' || typeof self !== 'undefined') {
  // Will be initialized in background.js
}

// ============================================================================
// Exports (for testing and module usage)
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TabManager };
}
