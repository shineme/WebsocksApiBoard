export interface Worker {
  id: string;
  ip: string;
  group: string;
  status: 'idle' | 'busy';
  currentTaskId: string | null;
  connectedSince: number;
}

export interface DashboardMetrics {
  totalWorkers: number;
  queueLength: number;
  busyWorkers: number;
  avgWaitTime: number;
  timestamp: number;
}

export interface RequestLog {
  id: string;
  timestamp: number;
  method: string;
  path: string;
  status: number;
  latency: number;
  requestBody: string;
  responseBody: string;
  taskId?: string;
}

export interface MetricsResponse {
  totalWorkers: number;
  queueLength: number;
  busyWorkers: number;
  avgWaitTime: number;
  timestamp: number;
}

export interface WorkersResponse {
  workers: Worker[];
  timestamp: number;
}

export interface LogsResponse {
  logs: RequestLog[];
  timestamp: number;
}
