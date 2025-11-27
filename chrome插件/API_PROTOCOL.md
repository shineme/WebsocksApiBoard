# Omni-Adapter 插件 WebSocket API 协议文档

## 概述

本文档描述了 Omni-Adapter Chrome 插件作为 Worker 与 WebSocket 任务派发服务器之间的通信协议。

## 连接信息

### WebSocket 地址

```
ws://localhost:3000/ws?group={分组名}
```

或生产环境：

```
wss://websock.aihack.top/ws?group={分组名}
```

### 连接参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| group | string | 否 | doubao | Worker 分组名称，用于任务路由 |

---

## 消息协议

### 1. 系统消息（服务器 → 插件）

#### 1.1 连接成功

```json
{
  "type": "connected",
  "workerId": "W1-1234abcd",
  "message": "Connected to Task Dispatcher"
}
```

插件收到此消息后会自动发送 `ready` 消息。

#### 1.2 心跳 Ping

```json
{
  "type": "ping"
}
```

插件会自动回复 `pong`。

---

### 2. 系统消息（插件 → 服务器）

#### 2.1 准备就绪

```json
{
  "type": "ready"
}
```

插件连接成功并收到 `connected` 消息后自动发送。

#### 2.2 心跳 Pong

```json
{
  "type": "pong"
}
```

#### 2.3 脚本就绪（每个 Tab）

```json
{
  "type": "scriptReady",
  "url": "https://www.doubao.com/chat/xxx",
  "tabId": 123456,
  "platform": "doubao"
}
```

当豆包页面加载完成时发送。

---

### 3. 任务消息（服务器 → 插件）

#### 3.1 派发任务

```json
{
  "type": "task",
  "taskId": "1e9651fd-6aa1-4b2c-9d5e-xxx",
  "payload": {
    "model": "jimeng-4.0",
    "messages": [
      { "role": "user", "content": "画一只可爱的小猫" }
    ],
    "data": {
      "model": "jimeng-4.0",
      "prompt": "画一只可爱的小猫",
      "ratio": "1:1",
      "imageUrl": null
    },
    "timeout": 60000
  }
}
```

**payload 字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| model | string | 模型名称 |
| messages | array | 消息列表（可选） |
| data | object | 任务数据 |
| data.prompt | string | 图片生成提示词（必填） |
| data.ratio | string | 图片比例，如 "1:1", "16:9" |
| data.imageUrl | string | 参考图片 URL（可选） |
| timeout | number | 超时时间（毫秒） |

---

### 4. 任务响应（插件 → 服务器）

#### 4.1 任务完成

```json
{
  "type": "task_complete",
  "taskId": "1e9651fd-6aa1-4b2c-9d5e-xxx",
  "result": {
    "urls": [
      "https://example.com/image1.png",
      "https://example.com/image2.png"
    ],
    "status": "completed"
  },
  "duration": 15234
}
```

**字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| type | string | 固定为 "task_complete" |
| taskId | string | 任务 ID，与请求中的 taskId 对应 |
| result.urls | array | 生成的图片 URL 列表 |
| result.status | string | 状态，固定为 "completed" |
| duration | number | 任务执行时间（毫秒） |

#### 4.2 任务失败

```json
{
  "type": "task_error",
  "taskId": "1e9651fd-6aa1-4b2c-9d5e-xxx",
  "error": "Chat input element not found.",
  "duration": 1234
}
```

**字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| type | string | 固定为 "task_error" |
| taskId | string | 任务 ID |
| error | string | 错误描述 |
| duration | number | 任务执行时间（毫秒） |

---

## 兼容的旧格式（Legacy）

插件同时支持旧格式的任务消息，用于向后兼容：

```json
{
  "commandId": "cmd-123",
  "task_type": "image",
  "prompt": "画一只可爱的小猫",
  "ratio": "1:1",
  "file": false,
  "imageUrl": null
}
```

---

## 完整通信流程

```
┌─────────────┐                      ┌─────────────┐
│   Server    │                      │   Plugin    │
└──────┬──────┘                      └──────┬──────┘
       │                                    │
       │◄───────── WebSocket Connect ───────│
       │                                    │
       │─────── {type: "connected"} ───────►│
       │                                    │
       │◄─────── {type: "ready"} ───────────│
       │                                    │
       │─────── {type: "task", ...} ───────►│
       │                                    │
       │        (执行图片生成任务...)         │
       │                                    │
       │◄── {type: "task_complete", ...} ───│
       │                                    │
       │─────── {type: "ping"} ────────────►│
       │◄────── {type: "pong"} ─────────────│
       │                                    │
```

---

## 错误处理

### 常见错误

| 错误信息 | 原因 | 解决方案 |
|----------|------|----------|
| Chat input element not found | 豆包页面未正确加载 | 确保豆包页面已完全加载 |
| No idle tab available | 没有空闲的豆包标签页 | 打开更多豆包页面或等待当前任务完成 |
| Command execution failed | 命令执行过程中出错 | 检查提示词格式 |

### 重连机制

- 连接断开后自动重连
- 重连间隔：5 秒
- 设置变更后自动重连

---

## 配置说明

在插件设置面板中可配置：

| 设置项 | 默认值 | 说明 |
|--------|--------|------|
| WebSocket 服务器地址 | wss://websock.aihack.top/ws | WebSocket 服务器 URL |
| Worker 分组名称 | doubao | 用于任务路由的分组标识 |
| 自动刷新页面 | 开启 | 任务完成后是否自动刷新页面 |
| 清除 Cookie | 关闭 | 页面加载时是否清除 Cookie |
