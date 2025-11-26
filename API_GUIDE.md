# 任务派发 API 使用指南

## 概述

本系统提供类似 OpenAI API 的同步/异步任务派发接口。支持：
- **同步模式**：HTTP 请求等待 Worker 执行完成后返回结果
- **异步模式**：立即返回 taskId，通过轮询接口查询状态和结果

## API 端点

### 1. 提交任务 - POST /api/openai

#### 请求格式

```bash
curl -X POST http://localhost:3000/api/openai \
  -H "Content-Type: application/json" \
  -d '{
    "data": { ... },        # 任务数据（必填，与 messages 二选一）
    "messages": [ ... ],    # OpenAI 格式消息（可选）
    "model": "string",      # 模型名称（可选，默认 "default"）
    "group": "string",      # Worker 分组（可选，默认 "default"）
    "timeout": number,      # 超时时间毫秒（可选，默认 60000，范围 5000-600000）
    "async": boolean        # 是否异步模式（可选，默认 false）
  }'
```

#### 参数说明

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| data | object | 是* | - | 任务数据，与 messages 二选一 |
| messages | array | 是* | - | OpenAI 格式消息数组 |
| model | string | 否 | "default" | 模型名称 |
| group | string | 否 | "default" | 指定 Worker 分组 |
| timeout | number | 否 | 60000 | 超时时间（毫秒），范围 5000-600000 |
| async | boolean | 否 | false | true=异步模式，false=同步模式 |

---

## 使用示例

### 同步模式（等待结果）

```bash
# 基本请求
curl -X POST http://localhost:3000/api/openai \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "action": "process",
      "content": "Hello World"
    }
  }'

# 响应（等待 Worker 完成后返回）
{
  "taskId": "1e9651fd-6aa1-4b2c-9d5e-xxx",
  "status": "completed",
  "result": { ... }  # Worker 返回的结果
}
```

### 图像生成示例

```bash
# 发送图像生成任务（同步，等待结果）
curl -X POST http://localhost:3000/api/openai \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "model": "jimeng-4.0",
      "prompt": "美丽的少女，胶片感",
      "ratio": "4:3",
      "resolution": "2k"
    },
    "timeout": 120000
  }'

# 指定 Worker 分组
curl -X POST http://localhost:3000/api/openai \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "model": "jimeng-4.0",
      "prompt": "美丽的少女，胶片感",
      "ratio": "4:3",
      "resolution": "2k"
    },
    "group": "gpu-cluster",
    "timeout": 120000
  }'
```

### 异步模式（立即返回，后续轮询）

```bash
# 提交异步任务
curl -X POST http://localhost:3000/api/openai \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "model": "jimeng-4.0",
      "prompt": "美丽的少女，胶片感",
      "ratio": "4:3",
      "resolution": "2k"
    },
    "async": true,
    "timeout": 120000
  }'

# 响应（立即返回）
{
  "taskId": "1e9651fd-6aa1-4b2c-9d5e-xxx",
  "status": "queued"    # 或 "executing"
}
```

### OpenAI 格式请求

```bash
curl -X POST http://localhost:3000/api/openai \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

---

### 2. 查询任务状态 - GET /api/task/{taskId}

用于异步模式下查询任务状态和结果。

```bash
curl http://localhost:3000/api/task/{taskId}
```

#### 响应示例

**队列中等待：**
```json
{
  "taskId": "xxx",
  "status": "queued",
  "enqueuedAt": 1700000000000,
  "position": 3
}
```

**执行中：**
```json
{
  "taskId": "xxx",
  "status": "executing",
  "workerId": "W1-1234abcd",
  "startedAt": 1700000000000
}
```

**已完成：**
```json
{
  "taskId": "xxx",
  "status": "completed",
  "result": { ... },
  "completedAt": 1700000000000
}
```

**失败：**
```json
{
  "taskId": "xxx",
  "status": "failed",
  "error": "Task timeout",
  "failedAt": 1700000000000
}
```

**未找到：**
```json
{
  "error": "Task not found or expired"
}
```

---

## 错误响应

| HTTP 状态码 | 错误信息 | 说明 |
|-------------|----------|------|
| 400 | Invalid request: data or messages required | 请求缺少必要参数 |
| 404 | Task not found or expired | 任务不存在或已过期 |
| 500 | Task timeout | 任务执行超时 |
| 500 | Worker disconnected | Worker 断线 |
| 503 | No worker available | 没有可用的 Worker |
| 503 | Queue is full | 队列已满 |

---

## 异步轮询示例（完整流程）

```bash
# 1. 提交异步任务
RESPONSE=$(curl -s -X POST http://localhost:3000/api/openai \
  -H "Content-Type: application/json" \
  -d '{
    "data": {"task": "long_running_job"},
    "async": true,
    "timeout": 300000
  }')

# 提取 taskId
TASK_ID=$(echo $RESPONSE | jq -r '.taskId')
echo "Task ID: $TASK_ID"

# 2. 轮询查询状态
while true; do
  STATUS=$(curl -s http://localhost:3000/api/task/$TASK_ID)
  TASK_STATUS=$(echo $STATUS | jq -r '.status')
  
  echo "Status: $TASK_STATUS"
  
  if [ "$TASK_STATUS" = "completed" ]; then
    echo "Result: $(echo $STATUS | jq '.result')"
    break
  elif [ "$TASK_STATUS" = "failed" ]; then
    echo "Error: $(echo $STATUS | jq -r '.error')"
    break
  fi
  
  sleep 2
done
```

---

## Worker 端实现

Worker 通过 WebSocket 连接到 `/ws` 端点：

```javascript
// 连接（可指定分组）
const ws = new WebSocket('ws://localhost:3000/ws?group=gpu-cluster');

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  if (message.type === 'task') {
    console.log('收到任务:', message.taskId);
    console.log('任务数据:', message.payload);
    
    // 处理任务...
    
    // 返回结果
    ws.send(JSON.stringify({
      type: 'task_complete',
      taskId: message.taskId,
      result: { /* 结果数据 */ },
      duration: 1000
    }));
    
    // 或返回错误
    // ws.send(JSON.stringify({
    //   type: 'task_error',
    //   taskId: message.taskId,
    //   error: '错误信息',
    //   duration: 1000
    // }));
  }
};
```

---

## 配置参数

通过环境变量配置：

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| TASK_TIMEOUT_MS | 60000 | 默认任务超时（毫秒） |
| MAX_TASK_TIMEOUT_MS | 600000 | 最大允许超时（10分钟） |
| MIN_TASK_TIMEOUT_MS | 5000 | 最小允许超时（5秒） |
| MAX_QUEUE_LENGTH | 1000 | 最大队列长度 |
| TASK_RESULT_TTL_MS | 300000 | 结果保存时间（5分钟） |

---

## Dashboard 监控

访问 `http://localhost:3000/dashboard` 查看：
- Worker 状态（在线/忙碌）
- 任务队列（等待中的任务）
- 执行中的任务（包含请求内容）
- 系统日志（请求/响应详情）

## Worker 测试工具

访问 `http://localhost:3000/test-worker` 可以：
- 模拟 Worker 连接
- 手动发送任务完成/失败消息
- 测试任务派发流程


---

## 后端 Worker 连接指南

### WebSocket 连接地址

```
ws://localhost:3000/ws?group={分组名}
```

- `group` 参数可选，默认为 `default`
- 同一分组的 Worker 会接收该分组的任务

### 消息协议

#### 1. 连接成功后收到的消息

```json
{
  "type": "connected",
  "workerId": "W1-1234abcd",
  "message": "Connected to Task Dispatcher"
}
```

#### 2. Worker 发送 ready 消息（表示准备接收任务）

```json
{
  "type": "ready"
}
```

#### 3. 收到任务

```json
{
  "type": "task",
  "taskId": "1e9651fd-6aa1-4b2c-9d5e-xxx",
  "payload": {
    "model": "default",
    "messages": [...],
    "data": {
      "model": "jimeng-4.0",
      "prompt": "美丽的少女",
      ...
    }
  }
}
```

#### 4. 返回任务完成

```json
{
  "type": "task_complete",
  "taskId": "1e9651fd-6aa1-4b2c-9d5e-xxx",
  "result": {
    "success": true,
    "data": "处理结果..."
  },
  "duration": 2000
}
```

#### 5. 返回任务失败

```json
{
  "type": "task_error",
  "taskId": "1e9651fd-6aa1-4b2c-9d5e-xxx",
  "error": "错误信息",
  "duration": 1000
}
```

#### 6. 心跳（可选）

```json
// 发送
{ "type": "ping" }

// 收到
{ "type": "pong" }
```

---

### Node.js Worker 示例

```javascript
// 安装: npm install ws
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:3000/ws?group=default');

ws.on('open', () => {
  console.log('已连接');
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  
  if (message.type === 'connected') {
    console.log('Worker ID:', message.workerId);
    // 发送 ready 表示准备接收任务
    ws.send(JSON.stringify({ type: 'ready' }));
  }
  
  if (message.type === 'task') {
    console.log('收到任务:', message.taskId);
    console.log('任务数据:', message.payload);
    
    // 处理任务...
    processTask(message.payload).then(result => {
      // 返回结果
      ws.send(JSON.stringify({
        type: 'task_complete',
        taskId: message.taskId,
        result: result,
        duration: 1000
      }));
    }).catch(error => {
      // 返回错误
      ws.send(JSON.stringify({
        type: 'task_error',
        taskId: message.taskId,
        error: error.message,
        duration: 1000
      }));
    });
  }
});

async function processTask(payload) {
  // 实现你的任务处理逻辑
  const { data, model, messages } = payload;
  
  // 示例：调用 AI 接口
  // const result = await callAIService(data);
  
  return { success: true, data: '处理结果' };
}
```

完整示例见: `examples/worker-node.js`

---

### Python Worker 示例

```python
# 安装: pip install websocket-client
import json
import websocket

def on_message(ws, data):
    message = json.loads(data)
    
    if message['type'] == 'connected':
        print(f"Worker ID: {message['workerId']}")
        ws.send(json.dumps({'type': 'ready'}))
    
    elif message['type'] == 'task':
        task_id = message['taskId']
        payload = message['payload']
        print(f"收到任务: {task_id}")
        
        try:
            # 处理任务
            result = process_task(payload)
            
            ws.send(json.dumps({
                'type': 'task_complete',
                'taskId': task_id,
                'result': result,
                'duration': 1000
            }))
        except Exception as e:
            ws.send(json.dumps({
                'type': 'task_error',
                'taskId': task_id,
                'error': str(e),
                'duration': 1000
            }))

def process_task(payload):
    # 实现你的任务处理逻辑
    data = payload.get('data', {})
    return {'success': True, 'data': '处理结果'}

def on_open(ws):
    print("已连接")

ws = websocket.WebSocketApp(
    'ws://localhost:3000/ws?group=default',
    on_open=on_open,
    on_message=on_message
)
ws.run_forever()
```

完整示例见: `examples/worker-python.py`

---

### Worker 分组

通过 URL 参数指定分组：

```
ws://localhost:3000/ws?group=gpu-cluster
ws://localhost:3000/ws?group=cpu-workers
ws://localhost:3000/ws?group=image-processing
```

客户端提交任务时指定分组：

```bash
curl -X POST http://localhost:3000/api/openai \
  -H "Content-Type: application/json" \
  -d '{
    "data": {...},
    "group": "gpu-cluster"
  }'
```

任务会被派发到对应分组的空闲 Worker。
