import { RequestLog } from './lib/types/dashboard';
import { QueuedTask } from './lib/types/task';

declare global {
  // Data access functions
  var getWorkers: (() => Map<string, any>) | undefined;
  var getTaskQueue: (() => QueuedTask[]) | undefined;
  var getRequestLogs: (() => RequestLog[]) | undefined;
  var addLog: ((log: RequestLog) => void) | undefined;

  // Worker management functions
  var addWorker: ((id: string, ws: any, ip: string) => void) | undefined;
  var removeWorker: ((id: string) => void) | undefined;
  var setWorkerBusy: ((workerId: string, taskId: string) => void) | undefined;
  var setWorkerIdle: ((workerId: string) => void) | undefined;
  var addTask: ((task: any) => void) | undefined;

  // Task Manager functions (set by task-manager.ts)
  var handleTaskResult: ((taskId: string, result: any, error?: string) => void) | undefined;
  var handleWorkerDisconnect: ((workerId: string) => void) | undefined;
  var tryDispatchFromQueue: (() => void) | undefined;
}

export {};
