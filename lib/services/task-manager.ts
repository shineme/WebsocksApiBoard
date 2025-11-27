/**
 * Task Manager Module
 * 
 * Core task lifecycle management including:
 * - Task submission (sync/async modes)
 * - Task result handling
 * - Timeout management
 * - Queue management
 * - Worker disconnect handling
 * 
 * Requirements: 1.x, 2.x, 3.x, 5.x, 6.x, 9.x, 10.x, 11.x
 */

import { v4 as uuidv4 } from 'uuid';
import { taskConfig, normalizeTimeout } from '../config/task-config';
import {
  QueuedTask,
  PendingTask,
  TaskResult,
  TaskOptions,
  TaskSubmitResult,
  TaskStatusResponse,
  TaskStatus,
} from '../types/task';

class TaskManager {
  /** Tasks waiting in queue */
  private taskQueue: QueuedTask[] = [];

  /** Tasks being executed, keyed by taskId */
  private pendingTasks: Map<string, PendingTask> = new Map();

  /** Store payload for pending tasks (for dashboard display) */
  private pendingTaskPayloads: Map<string, any> = new Map();

  /** Completed task results with TTL, keyed by taskId */
  private taskResults: Map<string, TaskResult> = new Map();

  /** Cleanup interval for expired results */
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start periodic cleanup of expired results
    this.startCleanupInterval();
  }

  /**
   * Start periodic cleanup of expired task results
   */
  private startCleanupInterval(): void {
    // Run cleanup every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredResults();
    }, 60000);
  }


  /**
   * Clean up expired task results
   * Requirements: 11.2
   */
  private cleanupExpiredResults(): void {
    const now = Date.now();
    for (const [taskId, result] of this.taskResults) {
      if (result.expiresAt <= now) {
        this.taskResults.delete(taskId);
      }
    }
  }

  /**
   * Get workers from global scope
   */
  private getWorkers(): Map<string, any> {
    if (typeof global.getWorkers === 'function') {
      return global.getWorkers();
    }
    return new Map();
  }

  /**
   * Find an idle worker, optionally filtered by group
   */
  private findIdleWorker(group?: string): any | null {
    const workers = this.getWorkers();
    for (const [, worker] of workers) {
      if (!worker.busy) {
        if (!group || group === 'default' || worker.group === group) {
          return worker;
        }
      }
    }
    return null;
  }

  /**
   * Check if any worker is connected
   */
  private hasConnectedWorkers(): boolean {
    return this.getWorkers().size > 0;
  }

  /**
   * Submit a task for execution
   * Requirements: 1.1, 3.1, 3.2, 4.1, 4.2, 9.1, 9.2, 9.3
   */
  async submitTask(payload: any, options: TaskOptions = {}): Promise<TaskSubmitResult> {
    // Check if any worker is connected
    if (!this.hasConnectedWorkers()) {
      throw new Error('No worker available');
    }

    // Check queue length limit
    if (this.taskQueue.length >= taskConfig.MAX_QUEUE_LENGTH) {
      throw new Error('Queue is full');
    }

    const taskId = uuidv4();
    const timeout = normalizeTimeout(options.timeout, taskConfig);
    const isAsync = options.async === true;
    const group = options.group || 'default';

    const queuedTask: QueuedTask = {
      taskId,
      type: 'openai',
      payload,
      group,
      enqueuedAt: Date.now(),
      timeout,
      async: isAsync,
    };

    // Try to dispatch immediately if idle worker available
    const idleWorker = this.findIdleWorker(group);

    if (idleWorker) {
      // IMPORTANT: Mark worker as busy IMMEDIATELY to prevent race conditions
      // This must happen synchronously before any await
      idleWorker.busy = true;
      idleWorker.currentTaskId = taskId;

      // Dispatch directly to worker
      return this.dispatchToWorker(queuedTask, idleWorker, isAsync);
    }

    // No idle worker, add to queue
    this.taskQueue.push(queuedTask);

    if (isAsync) {
      // Async mode: return immediately
      return {
        taskId,
        status: 'queued',
      };
    }

    // Sync mode: wait for result
    return this.waitForResult(queuedTask);
  }


  /**
   * Dispatch a task to a specific worker
   * Requirements: 5.3, 5.4
   * Note: Worker should already be marked as busy before calling this method
   */
  private async dispatchToWorker(
    task: QueuedTask,
    worker: any,
    isAsync: boolean
  ): Promise<TaskSubmitResult> {
    const { taskId, payload, timeout } = task;

    // Worker is already marked as busy in submitTask to prevent race conditions
    // Just ensure it's set (in case called from tryDispatchFromQueue)
    if (!worker.busy) {
      worker.busy = true;
      worker.currentTaskId = taskId;
    }

    // Send task to worker via WebSocket
    if (worker.ws && worker.ws.readyState === 1) {
      worker.ws.send(JSON.stringify({
        type: 'task',
        taskId,
        payload,
      }));
    }

    if (isAsync) {
      // Async mode: set up pending task but return immediately
      this.setupPendingTask(taskId, worker.id, timeout, payload);
      return {
        taskId,
        status: 'executing',
      };
    }

    // Sync mode: wait for result
    return this.waitForResultWithWorker(taskId, worker.id, timeout, payload);
  }

  /**
   * Set up a pending task for async tracking
   */
  private setupPendingTask(taskId: string, workerId: string, timeout: number, payload?: any): void {
    const timeoutId = setTimeout(() => {
      this.handleTaskTimeout(taskId);
    }, timeout);

    // Create a dummy promise for async tasks
    const pendingTask: PendingTask = {
      taskId,
      resolve: () => { },
      reject: () => { },
      timeoutId,
      workerId,
      startedAt: Date.now(),
    };

    this.pendingTasks.set(taskId, pendingTask);
    if (payload) {
      this.pendingTaskPayloads.set(taskId, payload);
    }
  }

  /**
   * Wait for task result (sync mode, task already in queue)
   */
  private waitForResult(task: QueuedTask): Promise<TaskSubmitResult> {
    return new Promise((resolve, reject) => {
      // Store resolve/reject for when task is dispatched
      const queuedIndex = this.taskQueue.findIndex(t => t.taskId === task.taskId);
      if (queuedIndex === -1) {
        reject(new Error('Task not found in queue'));
        return;
      }

      // Set up timeout for queue wait + execution
      const timeoutId = setTimeout(() => {
        // Remove from queue if still there
        const idx = this.taskQueue.findIndex(t => t.taskId === task.taskId);
        if (idx !== -1) {
          this.taskQueue.splice(idx, 1);
        }
        // Remove from pending if there
        this.pendingTasks.delete(task.taskId);
        reject(new Error('Task timeout'));
      }, task.timeout);

      // Store pending task info
      const pendingTask: PendingTask = {
        taskId: task.taskId,
        resolve: (result) => {
          clearTimeout(timeoutId);
          resolve({ taskId: task.taskId, status: 'completed', result });
        },
        reject: (error) => {
          clearTimeout(timeoutId);
          reject(error);
        },
        timeoutId,
        workerId: '',
        startedAt: Date.now(),
      };

      this.pendingTasks.set(task.taskId, pendingTask);
    });
  }


  /**
   * Wait for task result (sync mode, dispatched to worker)
   */
  private waitForResultWithWorker(
    taskId: string,
    workerId: string,
    timeout: number,
    payload?: any
  ): Promise<TaskSubmitResult> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.handleTaskTimeout(taskId);
        reject(new Error('Task timeout'));
      }, timeout);

      const pendingTask: PendingTask = {
        taskId,
        resolve: (result) => {
          clearTimeout(timeoutId);
          this.pendingTaskPayloads.delete(taskId);
          resolve({ taskId, status: 'completed', result });
        },
        reject: (error) => {
          clearTimeout(timeoutId);
          this.pendingTaskPayloads.delete(taskId);
          reject(error);
        },
        timeoutId,
        workerId,
        startedAt: Date.now(),
      };

      this.pendingTasks.set(taskId, pendingTask);
      if (payload) {
        this.pendingTaskPayloads.set(taskId, payload);
      }
    });
  }

  /**
   * Handle task timeout
   * Requirements: 2.1, 2.3
   */
  private handleTaskTimeout(taskId: string): void {
    const pendingTask = this.pendingTasks.get(taskId);
    if (!pendingTask) return;

    // Clean up pending task
    this.pendingTasks.delete(taskId);
    this.pendingTaskPayloads.delete(taskId);

    // Reset worker state if assigned
    if (pendingTask.workerId) {
      const workers = this.getWorkers();
      const worker = workers.get(pendingTask.workerId);
      if (worker && worker.currentTaskId === taskId) {
        worker.busy = false;
        worker.currentTaskId = null;
      }
    }

    // Store failed result for async queries
    this.storeTaskResult(taskId, 'failed', undefined, 'Task timeout');

    // Try to dispatch next task from queue
    this.tryDispatchFromQueue();
  }

  /**
   * Handle task result from worker
   * Requirements: 1.2, 1.3, 1.4, 2.4
   */
  handleTaskResult(taskId: string, result: any, error?: string): void {
    console.log(`[TaskManager] handleTaskResult called for taskId: ${taskId}`);
    console.log(`[TaskManager] pendingTasks count: ${this.pendingTasks.size}`);
    console.log(`[TaskManager] pendingTasks keys: ${Array.from(this.pendingTasks.keys()).join(', ')}`);

    const pendingTask = this.pendingTasks.get(taskId);

    // Handle late result gracefully (task may have timed out)
    if (!pendingTask) {
      console.log(`[TaskManager] Late result for task ${taskId}, ignoring (not found in pendingTasks)`);
      return;
    }

    console.log(`[TaskManager] Found pending task, resolving...`);

    // Clear timeout
    clearTimeout(pendingTask.timeoutId);

    // Remove from pending
    this.pendingTasks.delete(taskId);
    this.pendingTaskPayloads.delete(taskId);

    // Reset worker state
    if (pendingTask.workerId) {
      const workers = this.getWorkers();
      const worker = workers.get(pendingTask.workerId);
      if (worker) {
        worker.busy = false;
        worker.currentTaskId = null;
      }
    }

    if (error) {
      // Store failed result
      console.log(`[TaskManager] Task ${taskId} failed with error: ${error}`);
      this.storeTaskResult(taskId, 'failed', undefined, error);
      pendingTask.reject(new Error(error));
    } else {
      // Store successful result
      console.log(`[TaskManager] Task ${taskId} completed successfully, calling resolve`);
      this.storeTaskResult(taskId, 'completed', result);
      pendingTask.resolve(result);
      console.log(`[TaskManager] Task ${taskId} resolve called`);
    }

    // Try to dispatch next task from queue
    this.tryDispatchFromQueue();
  }


  /**
   * Store task result with TTL
   * Requirements: 11.1
   */
  private storeTaskResult(
    taskId: string,
    status: 'completed' | 'failed',
    result?: any,
    error?: string
  ): void {
    const now = Date.now();
    const taskResult: TaskResult = {
      taskId,
      status,
      result,
      error,
      completedAt: now,
      expiresAt: now + taskConfig.TASK_RESULT_TTL_MS,
    };
    this.taskResults.set(taskId, taskResult);
  }

  /**
   * Try to dispatch tasks from queue to idle workers
   * Requirements: 5.1, 5.2
   */
  tryDispatchFromQueue(): void {
    while (this.taskQueue.length > 0) {
      const task = this.taskQueue[0];
      const idleWorker = this.findIdleWorker(task.group);

      if (!idleWorker) {
        // No idle worker available
        break;
      }

      // Remove from queue
      this.taskQueue.shift();

      // Get pending task if exists (for sync mode)
      const pendingTask = this.pendingTasks.get(task.taskId);

      // Mark worker as busy
      idleWorker.busy = true;
      idleWorker.currentTaskId = task.taskId;

      // Update pending task with worker info
      if (pendingTask) {
        pendingTask.workerId = idleWorker.id;
        pendingTask.startedAt = Date.now();
        // Also save payload for dashboard display
        this.pendingTaskPayloads.set(task.taskId, task.payload);
      } else if (task.async) {
        // Async task without pending entry, create one
        this.setupPendingTask(task.taskId, idleWorker.id, task.timeout, task.payload);
      }

      // Send task to worker
      if (idleWorker.ws && idleWorker.ws.readyState === 1) {
        idleWorker.ws.send(JSON.stringify({
          type: 'task',
          taskId: task.taskId,
          payload: task.payload,
        }));
      }
    }
  }

  /**
   * Handle worker disconnect
   * Requirements: 6.1, 6.2, 6.3
   */
  handleWorkerDisconnect(workerId: string): void {
    // Find any pending task for this worker
    for (const [taskId, pendingTask] of this.pendingTasks) {
      if (pendingTask.workerId === workerId) {
        // Clear timeout
        clearTimeout(pendingTask.timeoutId);

        // Remove from pending
        this.pendingTasks.delete(taskId);
        this.pendingTaskPayloads.delete(taskId);

        // Store failed result
        this.storeTaskResult(taskId, 'failed', undefined, 'Worker disconnected');

        // Reject the promise
        pendingTask.reject(new Error('Worker disconnected'));
      }
    }

    // Try to dispatch queued tasks to other workers
    this.tryDispatchFromQueue();
  }


  /**
   * Get task status for API queries
   * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
   */
  getTaskStatus(taskId: string): TaskStatusResponse | null {
    // Check completed results first
    const result = this.taskResults.get(taskId);
    if (result) {
      // Check if expired (lazy cleanup)
      if (result.expiresAt <= Date.now()) {
        this.taskResults.delete(taskId);
        return null;
      }

      if (result.status === 'completed') {
        return {
          taskId,
          status: 'completed',
          result: result.result,
          completedAt: result.completedAt,
        };
      } else {
        return {
          taskId,
          status: 'failed',
          error: result.error,
          failedAt: result.completedAt,
        };
      }
    }

    // Check pending tasks (executing)
    const pendingTask = this.pendingTasks.get(taskId);
    if (pendingTask && pendingTask.workerId) {
      return {
        taskId,
        status: 'executing',
        workerId: pendingTask.workerId,
        startedAt: pendingTask.startedAt,
      };
    }

    // Check queue
    const queueIndex = this.taskQueue.findIndex(t => t.taskId === taskId);
    if (queueIndex !== -1) {
      const task = this.taskQueue[queueIndex];
      return {
        taskId,
        status: 'queued',
        enqueuedAt: task.enqueuedAt,
        position: queueIndex + 1,
      };
    }

    // Not found
    return null;
  }

  /**
   * Get queue length
   */
  getQueueLength(): number {
    return this.taskQueue.length;
  }

  /**
   * Get pending tasks count
   */
  getPendingTasksCount(): number {
    return this.pendingTasks.size;
  }

  /**
   * Get task queue (for dashboard)
   */
  getTaskQueue(): QueuedTask[] {
    return this.taskQueue;
  }

  /**
   * Get executing tasks info (for dashboard)
   */
  getExecutingTasks(): Array<{
    taskId: string;
    workerId: string;
    startedAt: number;
    payload: any;
  }> {
    const result: Array<{
      taskId: string;
      workerId: string;
      startedAt: number;
      payload: any;
    }> = [];

    for (const [taskId, pendingTask] of this.pendingTasks) {
      if (pendingTask.workerId) {
        result.push({
          taskId,
          workerId: pendingTask.workerId,
          startedAt: pendingTask.startedAt,
          payload: this.pendingTaskPayloads.get(taskId) || null,
        });
      }
    }

    return result;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Clear all timeouts
    for (const [, pendingTask] of this.pendingTasks) {
      clearTimeout(pendingTask.timeoutId);
    }
    this.pendingTasks.clear();
    this.taskQueue.length = 0;
    this.taskResults.clear();
  }
}

// Singleton instance
export const taskManager = new TaskManager();

// Export global functions for server.js to call
// This ensures the same instance is used across API routes and WebSocket handlers
if (typeof global !== 'undefined') {
  (global as any).handleTaskResult = (taskId: string, result: any, error?: string) => {
    taskManager.handleTaskResult(taskId, result, error || undefined);
  };

  (global as any).handleWorkerDisconnect = (workerId: string) => {
    taskManager.handleWorkerDisconnect(workerId);
  };

  (global as any).tryDispatchFromQueue = () => {
    taskManager.tryDispatchFromQueue();
  };

  console.log('[TaskManager] Global functions registered');
}
