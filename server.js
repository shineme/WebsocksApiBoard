const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { WebSocketServer } = require('ws');

const dev = process.env.NODE_ENV !== 'production';
const hostname = dev ? 'localhost' : '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Worker 管理
const workers = new Map();
const taskQueue = [];
const requestLogs = [];

// Task Manager 引用（延迟加载）
let taskManager = null;

function addLog(log) {
  requestLogs.unshift(log);
  if (requestLogs.length > 50) {
    requestLogs.pop();
  }
}

app.prepare().then(async () => {
  // 动态加载 Task Manager (ES Module)
  try {
    const taskManagerModule = await import('./lib/services/task-manager.js');
    taskManager = taskManagerModule.taskManager;
    console.log('Task Manager loaded successfully');
  } catch (err) {
    console.warn('Task Manager not available:', err.message);
  }

  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // 初始化 WebSocket 服务器
  const wss = new WebSocketServer({
    server,
    path: '/ws'
  });


  // Worker 计数器
  let workerCounter = 0;

  wss.on('connection', (ws, req) => {
    workerCounter++;
    const timestamp = Date.now().toString().slice(-4);
    const random = Math.random().toString(36).substring(2, 6);
    const workerId = `W${workerCounter}-${timestamp}${random}`;
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'unknown';

    const parsedUrl = parse(req.url, true);
    const group = parsedUrl.query.group || 'default';

    const worker = {
      id: workerId,
      ws,
      ip,
      group,
      connectedSince: Date.now(),
      busy: false,
      currentTaskId: null
    };

    workers.set(workerId, worker);
    console.log(`Worker ${workerId} connected from ${ip}`);

    // 发送欢迎消息
    ws.send(JSON.stringify({
      type: 'connected',
      workerId,
      message: 'Connected to Task Dispatcher'
    }));

    // Worker 连接后尝试派发队列中的任务
    if (taskManager) {
      taskManager.tryDispatchFromQueue();
    }

    // 处理消息
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log(`Worker ${workerId} message:`, message.type);

        switch (message.type) {
          case 'ready':
            worker.busy = false;
            worker.currentTaskId = null;
            // Worker 空闲后尝试派发任务
            if (taskManager) {
              taskManager.tryDispatchFromQueue();
            }
            break;

          case 'task_complete':
          case 'taskResult':
            // 处理任务完成 - 通过 Task Manager
            if (taskManager) {
              taskManager.handleTaskResult(message.taskId, message.result, null);
            } else {
              worker.busy = false;
              worker.currentTaskId = null;
            }
            addLog({
              id: `log-${Date.now()}`,
              timestamp: Date.now(),
              method: 'TASK',
              path: '/task/complete',
              status: 200,
              latency: message.duration || 0,
              requestBody: JSON.stringify({ taskId: message.taskId }),
              responseBody: JSON.stringify({ result: message.result }),
              taskId: message.taskId,
            });
            break;

          case 'task_error':
            // 处理任务错误 - 通过 Task Manager
            if (taskManager) {
              taskManager.handleTaskResult(message.taskId, null, message.error);
            } else {
              worker.busy = false;
              worker.currentTaskId = null;
            }
            addLog({
              id: `log-${Date.now()}`,
              timestamp: Date.now(),
              method: 'TASK',
              path: '/task/error',
              status: 500,
              latency: message.duration || 0,
              requestBody: JSON.stringify({ taskId: message.taskId }),
              responseBody: JSON.stringify({ error: message.error }),
              taskId: message.taskId,
            });
            break;

          case 'ping':
            ws.send(JSON.stringify({ type: 'pong' }));
            break;
        }
      } catch (error) {
        console.error(`Error handling message from worker ${workerId}:`, error);
      }
    });


    // 处理断开连接
    ws.on('close', () => {
      console.log(`Worker ${workerId} disconnected`);
      // 通知 Task Manager 处理断线
      if (taskManager) {
        taskManager.handleWorkerDisconnect(workerId);
      }
      workers.delete(workerId);
    });

    // 处理错误
    ws.on('error', (error) => {
      console.error(`Worker ${workerId} error:`, error);
      if (taskManager) {
        taskManager.handleWorkerDisconnect(workerId);
      }
      workers.delete(workerId);
    });

    // 心跳检测
    const heartbeatInterval = setInterval(() => {
      if (ws.readyState === 1) {
        ws.ping();
      } else {
        clearInterval(heartbeatInterval);
      }
    }, 30000);
  });

  // 导出数据访问函数供 API 使用
  global.getWorkers = () => workers;
  global.getTaskQueue = () => taskManager ? taskManager.getTaskQueue() : taskQueue;
  global.getRequestLogs = () => requestLogs;
  global.addLog = addLog;

  // Worker 管理函数
  global.addWorker = (id, ws, ip) => {
    workers.set(id, {
      id,
      ws,
      ip,
      group: 'default',
      connectedSince: Date.now(),
      busy: false,
      currentTaskId: null
    });
  };

  global.removeWorker = (id) => {
    workers.delete(id);
  };

  global.setWorkerBusy = (workerId, taskId) => {
    const worker = workers.get(workerId);
    if (worker) {
      worker.busy = true;
      worker.currentTaskId = taskId;
    }
  };

  global.setWorkerIdle = (workerId) => {
    const worker = workers.get(workerId);
    if (worker) {
      worker.busy = false;
      worker.currentTaskId = null;
    }
  };

  global.addTask = (task) => {
    taskQueue.push(task);
  };

  console.log('WebSocket server initialized on /ws');

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> WebSocket server ready on ws://${hostname}:${port}/ws`);
  });
});
