import { dispatcher } from './dispatcher';
import { WebSocket } from 'ws';

// 初始化模拟数据
export function initializeMockData() {
  // 创建模拟 WebSocket 对象
  const createMockWs = () => ({
    send: () => {},
    close: () => {},
    on: () => {},
  } as unknown as WebSocket);

  // 添加一些模拟 Worker
  dispatcher.addWorker('worker-001', createMockWs(), '192.168.1.101');
  dispatcher.addWorker('worker-002', createMockWs(), '192.168.1.102');
  dispatcher.addWorker('worker-003', createMockWs(), '192.168.1.103');
  
  // 设置一些 Worker 为忙碌状态
  dispatcher.setWorkerBusy('worker-001', 'task-abc123');
  
  // 添加一些模拟任务到队列
  dispatcher.addTask({
    id: 'task-001',
    data: { prompt: 'Test task 1' },
    timestamp: Date.now() - 5000,
  });
  
  dispatcher.addTask({
    id: 'task-002',
    data: { prompt: 'Test task 2' },
    timestamp: Date.now() - 3000,
  });

  // 添加一些模拟日志
  dispatcher.addLog({
    id: 'log-001',
    timestamp: Date.now() - 10000,
    method: 'POST',
    path: '/api/openai',
    status: 200,
    latency: 1234,
    requestBody: JSON.stringify({ prompt: 'Hello world', model: 'gpt-4' }),
    responseBody: JSON.stringify({ result: 'Success', data: 'Response data' }),
    taskId: 'task-abc123',
  });

  dispatcher.addLog({
    id: 'log-002',
    timestamp: Date.now() - 8000,
    method: 'POST',
    path: '/api/openai',
    status: 500,
    latency: 2345,
    requestBody: JSON.stringify({ prompt: 'Test error', model: 'gpt-4' }),
    responseBody: JSON.stringify({ error: 'Internal server error' }),
  });

  dispatcher.addLog({
    id: 'log-003',
    timestamp: Date.now() - 5000,
    method: 'GET',
    path: '/api/dashboard/metrics',
    status: 200,
    latency: 45,
    requestBody: '',
    responseBody: JSON.stringify({ totalWorkers: 3, queueLength: 2 }),
  });

  dispatcher.addLog({
    id: 'log-004',
    timestamp: Date.now() - 3000,
    method: 'POST',
    path: '/api/openai',
    status: 400,
    latency: 678,
    requestBody: JSON.stringify({ prompt: '', model: 'gpt-4' }),
    responseBody: JSON.stringify({ error: 'Bad request: prompt is required' }),
  });

  console.log('Mock data initialized');
}
