/**
 * Omni-Adapter Gemini Chrome Extension - Task Tracker
 * 
 * Tracks active tasks, calculates duration, and manages task lifecycle.
 */

// ============================================================================
// Task Tracker Class
// ============================================================================

class TaskTracker {
  constructor() {
    // Map of taskId -> TaskInfo
    this.activeTasks = new Map();
  }

  // ==========================================================================
  // Task Lifecycle
  // ==========================================================================

  /**
   * Start tracking a task
   * @param {string} taskId - Task ID
   * @param {number} tabId - Chrome tab ID executing the task
   * @param {object} command - Task command object
   */
  startTracking(taskId, tabId, command = null) {
    this.activeTasks.set(taskId, {
      taskId: taskId,
      tabId: tabId,
      command: command,
      startTime: Date.now(),
      status: 'executing'
    });
    console.log(`[Task Tracker] Started tracking task ${taskId} on tab ${tabId}`);
  }

  /**
   * Complete a task successfully
   * @param {string} taskId - Task ID
   * @param {Array} images - Array of image results
   * @returns {object} Task complete message
   */
  completeTask(taskId, images = []) {
    const task = this.activeTasks.get(taskId);
    if (!task) {
      console.warn(`[Task Tracker] Task ${taskId} not found`);
      return null;
    }

    const duration = Date.now() - task.startTime;
    task.status = 'completed';
    
    const result = {
      type: 'task_complete',
      taskId: taskId,
      result: {
        images: images,
        status: 'completed'
      },
      duration: duration
    };

    console.log(`[Task Tracker] Task ${taskId} completed in ${duration}ms`);
    this.activeTasks.delete(taskId);
    
    return result;
  }

  /**
   * Fail a task
   * @param {string} taskId - Task ID
   * @param {string} error - Error description
   * @returns {object} Task error message
   */
  failTask(taskId, error) {
    const task = this.activeTasks.get(taskId);
    const startTime = task ? task.startTime : Date.now();
    const duration = Date.now() - startTime;

    const result = {
      type: 'task_error',
      taskId: taskId,
      error: error || 'Unknown error',
      duration: duration
    };

    if (task) {
      task.status = 'failed';
      console.log(`[Task Tracker] Task ${taskId} failed after ${duration}ms: ${error}`);
      this.activeTasks.delete(taskId);
    } else {
      console.warn(`[Task Tracker] Task ${taskId} not found, reporting error anyway`);
    }

    return result;
  }

  // ==========================================================================
  // Task Queries
  // ==========================================================================

  /**
   * Get task info
   * @param {string} taskId - Task ID
   * @returns {object|null} Task info or null
   */
  getTask(taskId) {
    return this.activeTasks.get(taskId) || null;
  }

  /**
   * Get task by tab ID
   * @param {number} tabId - Chrome tab ID
   * @returns {object|null} Task info or null
   */
  getTaskByTabId(tabId) {
    for (const task of this.activeTasks.values()) {
      if (task.tabId === tabId) {
        return task;
      }
    }
    return null;
  }

  /**
   * Check if task exists
   * @param {string} taskId - Task ID
   * @returns {boolean} True if task exists
   */
  hasTask(taskId) {
    return this.activeTasks.has(taskId);
  }

  /**
   * Get all active tasks
   * @returns {Array} Array of task info objects
   */
  getAllTasks() {
    return Array.from(this.activeTasks.values());
  }

  /**
   * Get count of active tasks
   * @returns {number} Number of active tasks
   */
  getActiveCount() {
    return this.activeTasks.size;
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  /**
   * Cancel task (e.g., when tab closes)
   * @param {string} taskId - Task ID
   * @returns {object|null} Task error message or null
   */
  cancelTask(taskId) {
    const task = this.activeTasks.get(taskId);
    if (!task) {
      return null;
    }

    return this.failTask(taskId, 'Task cancelled');
  }

  /**
   * Cancel all tasks for a tab
   * @param {number} tabId - Chrome tab ID
   * @returns {Array} Array of task error messages
   */
  cancelTasksForTab(tabId) {
    const results = [];
    for (const [taskId, task] of this.activeTasks.entries()) {
      if (task.tabId === tabId) {
        const result = this.failTask(taskId, 'Tab closed during task execution');
        if (result) {
          results.push(result);
        }
      }
    }
    return results;
  }

  /**
   * Clear all tasks
   */
  clear() {
    this.activeTasks.clear();
  }
}

// ============================================================================
// Exports (for testing and module usage)
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TaskTracker };
}
