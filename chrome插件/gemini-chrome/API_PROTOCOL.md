# Gemini Chrome Extension - API 协议文档

## 概述

本文档描述了 Gemini Chrome 扩展作为 Worker 与上游任务派发服务器（`/api/openai`）之间的完整通信协议。

---

## 1. 上游 API 接口

### 1.1 提交任务 - POST /api/openai

#### 请求格式

```bash
curl -X POST https://your-server.com/api/openai \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "prompt": "画一只可爱的小猫",
      "ratio": "1:1",
      "imageUrl": null
    },
    "model": "gemini-image",
    "group": "gemini",
    "timeout": 120000,
    "async": false
  }'
```

#### 请求参数详解

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| data | object | 是* | - | 任务数据对象 |
| data.prompt | string | 是 | - | 图片生成提示词 |
| data.ratio | string | 否 | "1:1" | 图片比例 |
| data.imageUrl | string | 否 | null | 参考图片 URL（图生图模式） |
| messages | array | 是* | - | OpenAI 格式消息（与 data 二选一） |
| model | string | 否 | "default" | 模型名称 |
| group | string | 否 | "gemini" | Worker 分组，必须设为 "gemini" |
| timeout | number | 否 | 60000 | 超时时间（毫秒），建议 120000 |
| async | boolean | 否 | false | 是否异步模式 |

#### data 对象字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| prompt | string | 是 | 图片生成提示词（必填） |
| ratio | string | 否 | 图片比例，支持: "1:1", "16:9", "9:16", "4:3", "3:4" |
| imageUrl | string | 否 | 参考图片 URL，用于图生图模式 |

#### 使用 messages 格式（OpenAI 兼容）

```json
{
  "model": "gemini-image",
  "group": "gemini",
  "messages": [
    {
      "role": "user",
      "content": "画一只可爱的小猫"
    }
  ],
  "timeout": 120000
}
```

---

## 2. 响应格式

### 2.1 同步模式响应（async: false）

#### 成功响应

```json
{
  "taskId": "1e9651fd-6aa1-4b2c-9d5e-xxx",
  "status": "completed",
  "result": {
    "images": [
      {
        "base64": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
        "mimeType": "image/png"
      }
    ],
    "status": "completed"
  }
}
```

#### 失败响应

```json
{
  "taskId": "1e9651fd-6aa1-4b2c-9d5e-xxx",
  "status": "failed",
  "error": "Failed to select image generation mode"
}
```

### 2.2 异步模式响应（async: true）

#### 提交成功

```json
{
  "taskId": "1e9651fd-6aa1-4b2c-9d5e-xxx",
  "status": "queued"
}
```

#### 查询状态 - GET /api/task/{taskId}

```bash
curl https://your-server.com/api/task/1e9651fd-6aa1-4b2c-9d5e-xxx
```

---

## 3. 图片结果格式

### 3.1 成功提取 Base64（推荐）

```json
{
  "images": [
    {
      "base64": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
      "mimeType": "image/png"
    }
  ],
  "status": "completed"
}
```

### 3.2 Fallback 格式（无法提取 Base64 时）

```json
{
  "images": [
    {
      "fileId": "2754614484524472783",
      "mimeType": "image/png",
      "downloadUrl": "https://biz-discoveryengine.googleapis.com/download/v1alpha/projects/xxx/locations/global/collections/default_collection/engines/agentspace-engine/sessions/xxx:downloadFile?fileId=xxx&alt=media"
    }
  ],
  "status": "completed"
}
```

### 3.3 图片对象字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| base64 | string | Base64 编码的图片数据（data:image/png;base64,...） |
| mimeType | string | MIME 类型，通常为 "image/png" |
| fileId | string | Gemini 文件 ID（fallback 时返回） |
| downloadUrl | string | 图片下载 URL（fallback 时返回，需要认证） |

---

## 4. WebSocket 协议

### 4.1 连接地址

```
wss://websock.aihack.top/ws?group=gemini
```

### 4.2 服务器 → 插件 消息

#### 连接成功

```json
{
  "type": "connected",
  "workerId": "W1-1234abcd",
  "message": "Connected to Task Dispatcher"
}
```

#### 心跳 Ping

```json
{
  "type": "ping"
}
```

#### 派发任务

```json
{
  "type": "task",
  "taskId": "1e9651fd-6aa1-4b2c-9d5e-xxx",
  "payload": {
    "model": "gemini-image",
    "messages": [
      { "role": "user", "content": "画一只可爱的小猫" }
    ],
    "data": {
      "prompt": "画一只可爱的小猫",
      "ratio": "1:1",
      "imageUrl": null
    },
    "timeout": 120000
  }
}
```

### 4.3 插件 → 服务器 消息

#### 准备就绪

```json
{
  "type": "ready",
  "group": "gemini",
  "capabilities": {
    "model": "gemini-image",
    "features": ["text-to-image", "image-to-image"],
    "tabCount": 2
  }
}
```

#### 心跳 Pong

```json
{
  "type": "pong",
  "timestamp": 1700000000000
}
```

#### 任务完成

```json
{
  "type": "task_complete",
  "taskId": "1e9651fd-6aa1-4b2c-9d5e-xxx",
  "result": {
    "images": [
      {
        "base64": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
        "mimeType": "image/png"
      }
    ],
    "status": "completed"
  },
  "duration": 15234
}
```

#### 任务失败

```json
{
  "type": "task_error",
  "taskId": "1e9651fd-6aa1-4b2c-9d5e-xxx",
  "error": "Failed to select image generation mode",
  "duration": 1234
}
```

---

## 5. 使用示例

### 5.1 文生图（Text-to-Image）

```bash
curl -X POST https://your-server.com/api/openai \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "prompt": "一只穿着宇航服的猫咪在月球上行走，背景是地球",
      "ratio": "16:9"
    },
    "group": "gemini",
    "timeout": 120000
  }'
```

### 5.2 图生图（Image-to-Image）

```bash
curl -X POST https://your-server.com/api/openai \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "prompt": "将这张图片转换为油画风格",
      "ratio": "1:1",
      "imageUrl": "https://example.com/reference-image.jpg"
    },
    "group": "gemini",
    "timeout": 180000
  }'
```

### 5.3 OpenAI 兼容格式

```bash
curl -X POST https://your-server.com/api/openai \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-image",
    "messages": [
      {"role": "user", "content": "画一幅日落时分的海边风景"}
    ],
    "group": "gemini",
    "timeout": 120000
  }'
```

### 5.4 异步模式

```bash
# 1. 提交任务
RESPONSE=$(curl -s -X POST https://your-server.com/api/openai \
  -H "Content-Type: application/json" \
  -d '{
    "data": {"prompt": "画一只可爱的小猫"},
    "group": "gemini",
    "async": true,
    "timeout": 120000
  }')

TASK_ID=$(echo $RESPONSE | jq -r '.taskId')

# 2. 轮询查询结果
while true; do
  STATUS=$(curl -s https://your-server.com/api/task/$TASK_ID)
  TASK_STATUS=$(echo $STATUS | jq -r '.status')
  
  if [ "$TASK_STATUS" = "completed" ]; then
    echo "Result: $(echo $STATUS | jq '.result')"
    break
  elif [ "$TASK_STATUS" = "failed" ]; then
    echo "Error: $(echo $STATUS | jq -r '.error')"
    break
  fi
  
  sleep 3
done
```

---

## 6. 错误码说明

| HTTP 状态码 | 错误信息 | 说明 |
|-------------|----------|------|
| 400 | Invalid request: data or messages required | 请求缺少必要参数 |
| 404 | Task not found or expired | 任务不存在或已过期 |
| 500 | Task timeout | 任务执行超时 |
| 500 | Worker disconnected | Worker 断线 |
| 503 | No worker available | 没有可用的 Gemini Worker |
| 503 | Queue is full | 队列已满 |

### 常见任务错误

| 错误信息 | 原因 | 解决方案 |
|----------|------|----------|
| Failed to select image generation mode | 无法选择图片生成模式 | 确保 Gemini 页面已完全加载 |
| Failed to input prompt | 无法输入提示词 | 检查页面状态 |
| Failed to submit request | 无法提交请求 | 检查页面状态 |
| Failed to upload reference image | 参考图片上传失败 | 检查图片 URL 是否可访问 |
| Tab closed during task execution | 标签页被关闭 | 保持标签页打开 |

---

## 7. 配置参数

### 服务器端环境变量

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| TASK_TIMEOUT_MS | 60000 | 默认任务超时（毫秒） |
| MAX_TASK_TIMEOUT_MS | 600000 | 最大允许超时（10分钟） |
| MIN_TASK_TIMEOUT_MS | 5000 | 最小允许超时（5秒） |
| MAX_QUEUE_LENGTH | 1000 | 最大队列长度 |
| TASK_RESULT_TTL_MS | 300000 | 结果保存时间（5分钟） |

### 插件设置

| 设置项 | 默认值 | 说明 |
|--------|--------|------|
| WebSocket 服务器地址 | wss://websock.aihack.top/ws | WebSocket 服务器 URL |
| Worker 分组名称 | gemini | 用于任务路由的分组标识 |

---

## 8. 通信流程图

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │     │   Server    │     │   Plugin    │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │─ POST /api/openai─►                   │
       │                   │                   │
       │                   │◄── WebSocket ─────│
       │                   │                   │
       │                   │─── {type:task} ──►│
       │                   │                   │
       │                   │    (执行任务...)   │
       │                   │                   │
       │                   │◄─ task_complete ──│
       │                   │                   │
       │◄── Response ──────│                   │
       │                   │                   │
```

---

## 9. 注意事项

1. **超时设置**：图片生成通常需要 30-120 秒，建议设置 `timeout: 120000`
2. **分组设置**：必须设置 `group: "gemini"` 才能路由到 Gemini Worker
3. **图片格式**：返回的 base64 图片包含 data URI 前缀
4. **Fallback 处理**：如果无法提取 base64，会返回 downloadUrl，需要带认证访问
5. **并发限制**：每个 Gemini 标签页同时只能处理一个任务
6. **页面刷新**：任务完成后会自动导航到 Gemini 首页，准备下一个任务
