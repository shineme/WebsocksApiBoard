import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { dispatcher } from './dispatcher';
import { v4 as uuidv4 } from 'uuid';

interface WorkerConnection {
  id: string;
  ws: WebSocket;
  ip: string;
  connectedSince: number;
  busy: boolean;
  currentTaskId?: string;
}

class TaskDispatcherWebSocketServer {
  private wss: WebSocketServer | null = null;
  private workers: Map<string, WorkerConnection> = new Map();

  initialize(server: any) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws'
    });

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      this.handleConnection(ws, req);
    });

    console.log('WebSocket server initialized on /ws');
  }

  private handleConnection(ws: WebSocket, req: IncomingMessage) {
    const workerId = uuidv4();
    const ip = this.extractIpAddress(req);
    
    const worker: WorkerConnection = {
      id: workerId,
      ws,
      ip,
      connectedSince: Date.now(),
      busy: false,
    };

    this.workers.set(workerId, worker);
    dispatcher.addWorker(workerId, ws, ip);

    console.log(`Worker ${workerId} connected from ${ip}`);

    // 发送欢迎消息
    ws.send(JSON.stringify({
      type: 'connected',
      workerId,
      message: 'Connected to Task Dispatcher'
    }));

    // 处理消息
    ws.on('message', (data: Buffer) => {
      this.handleMessage(workerId, data);
    });

    // 处理断开连接
    ws.on('close', () => {
      this.handleDisconnect(workerId);
    });

    // 处理错误
    ws.on('error', (error) => {
      console.error(`Worker ${workerId} error:`, error);
      this.handleDisconnect(workerId);
    });

    // 心跳检测
    const heartbeatInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      } else {
        clearInterval(heartbeatInterval);
      }
    }, 30000);
  }

  private handleMessage(workerId: string, data: Buffer) {
    try {
      const message = JSON.parse(data.toString());
      const worker = this.workers.get(workerId);

      if (!worker) return;

      switch (message.type) {
        case 'ready':
          // Worker 准备接收任务
          worker.busy = false;
          worker.currentTaskId = undefined;
          dispatcher.setWorkerIdle(workerId);
          console.log(`Worker ${workerId} is ready`);
          break;

        case 'task_complete':
          // Worker 完成任务
          worker.busy = false;
          worker.currentTaskId = undefined;
          dispatcher.setWorkerIdle(workerId);
          console.log(`Worker ${workerId} completed task ${message.taskId}`);
          
          // 记录日志
          dispatcher.addLog({
            id: uuidv4(),
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
          // Worker 任务失败
          worker.busy = false;
          worker.currentTaskId = undefined;
          dispatcher.setWorkerIdle(workerId);
          console.error(`Worker ${workerId} task error:`, message.error);
          
          // 记录错误日志
          dispatcher.addLog({
            id: uuidv4(),
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
          // 心跳响应
          worker.ws.send(JSON.stringify({ type: 'pong' }));
          break;

        default:
          console.log(`Unknown message type from worker ${workerId}:`, message.type);
      }
    } catch (error) {
      console.error(`Error handling message from worker ${workerId}:`, error);
    }
  }

  private handleDisconnect(workerId: string) {
    const worker = this.workers.get(workerId);
    if (worker) {
      console.log(`Worker ${workerId} disconnected`);
      this.workers.delete(workerId);
      dispatcher.removeWorker(workerId);
    }
  }

  private extractIpAddress(req: IncomingMessage): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded;
      return ips.split(',')[0].trim();
    }
    return req.socket.remoteAddress || 'unknown';
  }

  // 分配任务给 Worker
  assignTask(taskId: string, taskData: any): boolean {
    // 找到空闲的 Worker
    for (const [workerId, worker] of this.workers.entries()) {
      if (!worker.busy && worker.ws.readyState === WebSocket.OPEN) {
        worker.busy = true;
        worker.currentTaskId = taskId;
        dispatcher.setWorkerBusy(workerId, taskId);

        // 发送任务
        worker.ws.send(JSON.stringify({
          type: 'task',
          taskId,
          data: taskData
        }));

        console.log(`Assigned task ${taskId} to worker ${workerId}`);
        return true;
      }
    }

    console.log(`No available worker for task ${taskId}`);
    return false;
  }

  getWorkerCount(): number {
    return this.workers.size;
  }

  getBusyWorkerCount(): number {
    return Array.from(this.workers.values()).filter(w => w.busy).length;
  }
}

export const wsServer = new TaskDispatcherWebSocketServer();
