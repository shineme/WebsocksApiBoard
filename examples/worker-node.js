/**
 * Node.js Worker 示例
 * 
 * 连接到任务派发系统，接收并处理任务
 * 
 * 安装依赖: npm install ws
 * 运行: node worker-node.js
 */

const WebSocket = require('ws');

// 配置
const CONFIG = {
  serverUrl: 'ws://localhost:3000/ws',
  group: 'default',           // Worker 分组
  reconnectInterval: 5000,    // 重连间隔（毫秒）
  heartbeatInterval: 30000,   // 心跳间隔（毫秒）
};

class Worker {
  constructor(config) {
    this.config = config;
    this.ws = null;
    this.workerId = null;
    this.heartbeatTimer = null;
    this.reconnectTimer = null;
    this.isConnected = false;
  }

  // 连接到服务器
  connect() {
    const url = `${this.config.serverUrl}?group=${this.config.group}`;
    console.log(`[Worker] 正在连接到 ${url}...`);

    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      console.log('[Worker] WebSocket 连接成功');
      this.isConnected = true;
      this.startHeartbeat();
    });

    this.ws.on('message', (data) => {
      this.handleMessage(data.toString());
    });

    this.ws.on('close', () => {
      console.log('[Worker] WebSocket 连接关闭');
      this.isConnected = false;
      this.stopHeartbeat();
      this.scheduleReconnect();
    });

    this.ws.on('error', (error) => {
      console.error('[Worker] WebSocket 错误:', error.message);
    });
  }

  // 处理收到的消息
  handleMessage(data) {
    try {
      const message = JSON.parse(data);
      console.log(`[Worker] 收到消息: ${message.type}`);

      switch (message.type) {
        case 'connected':
          this.workerId = message.workerId;
          console.log(`[Worker] 已分配 Worker ID: ${this.workerId}`);
          // 发送 ready 消息表示准备接收任务
          this.sendReady();
          break;

        case 'task':
          this.handleTask(message);
          break;

        case 'pong':
          // 心跳响应
          break;

        default:
          console.log(`[Worker] 未知消息类型: ${message.type}`);
      }
    } catch (error) {
      console.error('[Worker] 解析消息失败:', error);
    }
  }

  // 处理任务
  async handleTask(message) {
    const { taskId, payload } = message;
    console.log(`[Worker] 收到任务: ${taskId}`);
    console.log(`[Worker] 任务数据:`, JSON.stringify(payload, null, 2));

    const startTime = Date.now();

    try {
      // ========== 在这里实现你的任务处理逻辑 ==========
      const result = await this.processTask(payload);
      // ================================================

      const duration = Date.now() - startTime;
      console.log(`[Worker] 任务完成: ${taskId}, 耗时: ${duration}ms`);

      // 发送任务完成消息
      this.sendTaskComplete(taskId, result, duration);

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[Worker] 任务失败: ${taskId}`, error.message);

      // 发送任务失败消息
      this.sendTaskError(taskId, error.message, duration);
    }
  }

  // ========== 实现你的任务处理逻辑 ==========
  async processTask(payload) {
    // 示例：模拟处理时间
    console.log('[Worker] 正在处理任务...');
    
    // 获取任务数据
    const { data, model, messages } = payload;
    
    // 模拟处理延迟（实际应用中替换为真实逻辑）
    await this.sleep(2000);

    // 返回处理结果
    return {
      success: true,
      message: '任务处理完成',
      processedData: data,
      timestamp: new Date().toISOString(),
    };
  }
  // ==========================================

  // 发送 ready 消息
  sendReady() {
    this.send({ type: 'ready' });
    console.log('[Worker] 已发送 ready 消息，等待任务...');
  }

  // 发送任务完成消息
  sendTaskComplete(taskId, result, duration) {
    this.send({
      type: 'task_complete',
      taskId,
      result,
      duration,
    });
  }

  // 发送任务失败消息
  sendTaskError(taskId, error, duration) {
    this.send({
      type: 'task_error',
      taskId,
      error,
      duration,
    });
  }

  // 发送消息
  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('[Worker] WebSocket 未连接，无法发送消息');
    }
  }

  // 心跳
  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected) {
        this.send({ type: 'ping' });
      }
    }, this.config.heartbeatInterval);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // 重连
  scheduleReconnect() {
    if (this.reconnectTimer) return;

    console.log(`[Worker] ${this.config.reconnectInterval / 1000}秒后重连...`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.config.reconnectInterval);
  }

  // 工具函数
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 断开连接
  disconnect() {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// 启动 Worker
const worker = new Worker(CONFIG);
worker.connect();

// 优雅退出
process.on('SIGINT', () => {
  console.log('\n[Worker] 正在关闭...');
  worker.disconnect();
  process.exit(0);
});
