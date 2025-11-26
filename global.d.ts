declare global {
  var getWorkers: (() => Map<string, any>) | undefined;
  var getTaskQueue: (() => any[]) | undefined;
  var getRequestLogs: (() => any[]) | undefined;
  var addLog: ((log: any) => void) | undefined;
}

export {};
