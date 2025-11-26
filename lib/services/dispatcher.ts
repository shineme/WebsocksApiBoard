import { RequestLog } from '../types/dashboard';

class TaskDispatcher {
  getWorkers(): Map<string, any> {
    if (typeof global.getWorkers === 'function') {
      return global.getWorkers();
    }
    return new Map();
  }

  getTaskQueue(): any[] {
    if (typeof global.getTaskQueue === 'function') {
      return global.getTaskQueue();
    }
    return [];
  }

  getRequestLogs(): RequestLog[] {
    if (typeof global.getRequestLogs === 'function') {
      return global.getRequestLogs();
    }
    return [];
  }

  addLog(log: RequestLog): void {
    if (typeof global.addLog === 'function') {
      global.addLog(log);
    }
  }

  calculateAvgWaitTime(): number {
    const queue = this.getTaskQueue();
    if (queue.length === 0) return 0;

    const now = Date.now();
    const totalWaitTime = queue.reduce((sum: number, task: any) => {
      return sum + (now - task.timestamp);
    }, 0);

    return Math.round(totalWaitTime / queue.length);
  }

  addWorker(id: string, ws: any, ip: string): void {
    if (typeof (global as any).addWorker === 'function') {
      (global as any).addWorker(id, ws, ip);
    }
  }

  removeWorker(id: string): void {
    if (typeof (global as any).removeWorker === 'function') {
      (global as any).removeWorker(id);
    }
  }

  setWorkerBusy(workerId: string, taskId: string): void {
    if (typeof (global as any).setWorkerBusy === 'function') {
      (global as any).setWorkerBusy(workerId, taskId);
    }
  }

  setWorkerIdle(workerId: string): void {
    if (typeof (global as any).setWorkerIdle === 'function') {
      (global as any).setWorkerIdle(workerId);
    }
  }

  addTask(task: any): void {
    if (typeof (global as any).addTask === 'function') {
      (global as any).addTask(task);
    }
  }
}

// Singleton instance
export const dispatcher = new TaskDispatcher();
