const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { WebSocketServer } = require('ws');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// 简单的 Worker 管理
const workers = new Map();
const taskQueue = [];
const requestLogs = [];

function addLog(log) {
  requestLogs.unshift(log);
  if (requestLogs.length > 50) {
    requestLogs.pop();
  }
}

app.prepare().then(() => {
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

  // Worker 计数器（用于生成简短的序号）
  let workerCounter = 0;

  wss.on('connection', (ws, req) => {
    workerCounter++;
    // 生成更易读的 Worker ID：序号 + 时间戳后4位 + 随机字符
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

    // 处理消息
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log(`Worker ${workerId} message:`, message.type);

        switch (message.type) {
          case 'ready':
            worker.busy = false;
            worker.currentTaskId = null;
            break;

          case 'task_complete':
            worker.busy = false;
            worker.currentTaskId = null;
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
            worker.busy = false;
            worker.currentTaskId = null;
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
      workers.delete(workerId);
    });

    // 处理错误
    ws.on('error', (error) => {
      console.error(`Worker ${workerId} error:`, error);
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
  global.getTaskQueue = () => taskQueue;
  global.getRequestLogs = () => requestLogs;
  global.addLog = addLog;

  // 添加 Worker 管理函数
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
