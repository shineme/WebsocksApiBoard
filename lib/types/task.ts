/**
 * Task-related type definitions
 */

/** Task status enum */
export type TaskStatus = 'queued' | 'executing' | 'completed' | 'failed';

/** Queued task waiting in the queue */
export interface QueuedTask {
  taskId: string;
  type: string;
  payload: any;
  group: string;
  enqueuedAt: number;
  timeout: number;
  async: boolean;
}

/** Pending task being executed by a worker */
export interface PendingTask {
  taskId: string;
  resolve: (result: any) => void;
  reject: (error: Error) => void;
  timeoutId: NodeJS.Timeout;
  workerId: string;
  startedAt: number;
}

/** Completed task result stored for TTL */
export interface TaskResult {
  taskId: string;
  status: 'completed' | 'failed';
  result?: any;
  error?: string;
  completedAt: number;
  expiresAt: number;
}

/** Task submission options */
export interface TaskOptions {
  group?: string;
  timeout?: number;
  async?: boolean;
}

/** Task submission result */
export interface TaskSubmitResult {
  taskId: string;
  status: TaskStatus;
  result?: any;
}

/** Task status response for API */
export interface TaskStatusResponse {
  taskId: string;
  status: TaskStatus;
  enqueuedAt?: number;
  startedAt?: number;
  completedAt?: number;
  failedAt?: number;
  position?: number;
  workerId?: string;
  result?: any;
  error?: string;
}
