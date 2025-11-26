# PRD：基于 Next.js + WebSocket 的任务派发系统（带全局任务队列）

> 模式：**Next.js + WebSocket Worker + 全局任务队列**  
> 特点：多 Worker 并发执行，每个 Worker 串行处理任务，所有请求在服务端统一排队。

---

## 1. 背景与目标

### 1.1 背景

需要实现一个基于 **Next.js** 的后端服务，对外暴露类似 **OpenAI API 风格** 的 HTTP 接口。  
实际的计算 / 调用逻辑由多个通过 **WebSocket** 连接过来的 Worker 进程来执行（可以是 Node / Python / 其他服务）。

为了实现高并发和良好的吞吐，需要：

- 支持多个 Worker 并行处理任务；
- 每个 Worker **同一时刻只处理一个任务**；
- 当瞬时请求量大于 Worker 处理能力时，服务端能够 **排队等待**，而不是直接返回错误。

### 1.2 目标

1. 构建一个 **中心任务调度服务**，具备以下能力：
   - 对前端提供统一的 HTTP 接口（类似 `POST /api/openai`）
   - 维护到多台 Worker 的 WebSocket 连接
   - 将 HTTP 请求转为任务，加入 **全局队列**
   - 动态分配任务给空闲 Worker，等待结果并返回给客户端

2. 每个 Worker：
   - 被标记为一个独立的"执行单元"
   - 任一时刻只执行一个任务（串行）
   - 空闲时从任务队列中自动获取下一个任务

3. 引入 **全局任务队列**：
   - 所有新任务统一进入队列
   - 当有 Worker 空闲时才出队并派发
   - 支持任务超时、队列长度限制等控制策略（至少支持基础版）

4. 系统部署在自有 VPS，后续通过 Docker 容器化。

---

## 2. 角色与场景

### 2.1 角色

1. **API 调用方（前端 / 其他服务）**
   - 使用 HTTP 请求调用本服务接口（例如 `POST /api/openai`）
   - 只关心请求体与响应体，不关心后端 Worker 数量、状态等细节。

2. **任务调度服务（Next.js 应用）**
   - 负责 HTTP 请求接入、请求校验
   - 将请求转换为统一任务入队
   - 维护任务队列、Worker 状态、任务结果映射
   - 将任务分发到空闲 Worker，并将 Worker 的执行结果返回给调用方

3. **WebSocket Worker**
   - 以 WebSocket 客户端身份连接到服务端（`/ws`）
   - 按协议接受任务、执行逻辑、返回结果
   - 不直接暴露 HTTP 接口，只对调度服务负责

### 2.2 核心使用场景

1. **普通调用场景**
   - API 调用方发送请求
   - 任务进入全局队列
   - 某个 Worker 空闲 → 领到任务 → 执行 → 回传结果
   - 调用方收到响应结果

2. **高峰场景**
   - 请求量瞬时增大，超过当前 Worker 实时处理能力
   - 新任务排在全局队列中等待
   - Worker 完成当前任务后从队列中取下一个
   - 如果等待时间超过设定阈值，任务可被拒绝或超时

---

## 3. 功能需求

### 3.1 HTTP API 层（对前端）

#### 3.1.1 接口列表（v1）

1. `POST /api/openai`
   - 请求：JSON，结构参考 OpenAI Chat Completion（可简化）
   - 响应：由 Worker 返回的 JSON（可透传）

> 后续可扩展：
> - `/api/openai/chat`
> - `/api/openai/embeddings` 等

#### 3.1.2 接口行为

- 接收到请求时，服务端执行：
  1. 解析 JSON 请求体
  2. 校验基础字段（如必填字段、大小限制等，可逐步增强）
  3. 创建一个任务对象（taskId, type, payload）
  4. 将任务入全局队列
  5. 等待任务执行完成（通过 Promise）
  6. 将任务结果以 JSON 返回给客户端

- 异常场景：
  - 当任务在 **排队或执行期间超时**：返回错误 `Task timeout`
  - 当队列已超过最大长度限制：直接拒绝新请求 `Queue is full`
  - 当内部逻辑异常：返回通用错误 `Internal error`

---

### 3.2 WebSocket 连接管理

#### 3.2.1 WebSocket 服务端

- 在 Node 进程中通过 `ws` 库创建 WebSocketServer：
  - 复用 Next.js HTTP Server
  - 监听路径：`/ws`
- 连接建立时：
  - 为每个连接生成唯一 `workerId`（UUID）
  - 创建并记录 `WorkerState` 对象

#### 3.2.2 Worker 状态

每个 Worker 状态包括：

```ts
type WorkerState = {
  id: string          // Worker 唯一 ID
  ws: WebSocket       // WebSocket 连接对象
  busy: boolean       // 是否正执行任务
  currentTaskId?: string // 当前任务 ID
}
```

状态流转：

- 连接建立 → `busy = false`
- 接到任务 → `busy = true`, 绑定 `currentTaskId`
- 任务完成 → `busy = false`, 清理 `currentTaskId`
- 连接关闭 → 从 Worker 集合中删除

#### 3.2.3 Worker 断线处理（基础版）

Worker 断线时：
- 立即从 `workers` Map 移除
- 若它正执行任务：
  - 当前版本不自动补偿，只依赖任务超时机制处理该任务
  - 后续可扩展为：检测到对应 taskId 尚未完成则立即 reject，并尝试重调度

---

### 3.3 全局任务队列

#### 3.3.1 队列结构

采用 FIFO 队列，每个元素为 `QueuedTask`：

```ts
type QueuedTask = {
  taskId: string
  type: string        // 任务类型，如 "openaiLike"
  payload: any        // 请求数据
  enqueuedAt: number  // 入队时间（用于统计和超时判断）
}
```

队列实现形式：简单数组或更高效的队列结构（v1 可用数组 + shift）

```ts
const taskQueue: QueuedTask[] = []
```

#### 3.3.2 队列操作

**入队**
- 接收 HTTP 请求后生成任务，添加到 `taskQueue` 尾部
- 若 `taskQueue.length` 超出 `MAX_QUEUE_LENGTH`（可配置），直接拒绝请求

**出队（调度）**

当：
- 新任务入队，或
- 某个 Worker 完成任务转为空闲

触发调度函数 `tryDispatchFromQueue()`：
- 只要队列不为空且存在空闲 Worker，就不断从队列头部取任务派发

---

### 3.4 任务调度逻辑

#### 3.4.1 调度目标

- 在任何时间点，尽可能让 Worker 处于"忙碌"状态（有任务可做）
- 保证：
  - 每个任务最多被一个 Worker 执行一次
  - 每个 Worker 一次只执行一个任务
  - 尽量保持任务顺序（FIFO），后续可支持优先级扩展

#### 3.4.2 调度流程

**HTTP 请求到达 → 创建任务并入队**

1. 生成 `taskId`
2. 在 `pendingTasks` 中记录此任务的 Promise resolver
3. 将任务加入 `taskQueue`
4. 调用 `tryDispatchFromQueue()`
5. 返回 Promise 给 API handler，等待结果

**tryDispatchFromQueue() 执行流程**

伪代码：

```ts
function tryDispatchFromQueue() {
  while (队列不空 && 存在空闲 Worker) {
    从队列头部取出一个任务
    选一个空闲 Worker
    标记 Worker.busy = true, currentTaskId = taskId
    通过 WS 发送 { type: 'task', taskType, taskId, payload }
  }
}
```

**Worker 完成任务 → 结果回传**

Worker 通过 WebSocket 返回：

```json
{
  "type": "taskResult",
  "taskId": "uuid",
  "result": { ... },
  "error": "string | null"
}
```

服务端收到后：
1. 在 `pendingTasks` 中找到对应的 Promise
2. `error` 不为空则 `reject(error)`；否则 `resolve(result)`
3. 删除该 `pendingTasks` 项
4. 标记相关 Worker 空闲
5. 再次调用 `tryDispatchFromQueue()`（继续从队列中取下一个任务）

---

### 3.5 超时与队列长度控制

#### 3.5.1 任务执行超时

- 配置项：`TASK_TIMEOUT_MS`（例如 60_000 ms）
- 对每个任务，在创建 Promise 时设置定时器：
  - 若在超时时间内未收到 `taskResult`：
    - 将此任务 `reject(new Error('Task timeout'))`
    - 删除 `pendingTasks` 中的记录
- 超时不自动重试，交给上层调用方决定如何处理

#### 3.5.2 队列长度限制

- 配置项：`MAX_QUEUE_LENGTH`（例如 1000）
- 入队前判断：
  - 若 `taskQueue.length >= MAX_QUEUE_LENGTH`：
    - 不入队，直接返回错误响应：HTTP 503 `{ "error": "Queue is full" }`
- 目的：避免队列无限增长导致内存膨胀、延迟不可控

#### 3.5.3 任务在队列中的最大等待时间（可选）

- 可增加配置：`MAX_QUEUE_WAIT_MS`（例如 30_000）
- 实现思路：
  - 在调度前检查任务的入队时间 `enqueuedAt`
  - 若 `Date.now() - enqueuedAt > MAX_QUEUE_WAIT_MS`：
    - 不派发，直接作为超时失败处理（reject）
    - 记录日志
- v1 可选实现（不作为必须项）

---

## 4. 非功能性需求

### 4.1 部署与环境

- 部署目标：自有 VPS（Linux）
- 运行环境：
  - Node.js 18+ / 20+
  - Next.js 13/14（App Router）
- 启动方式：
  - 自定义 `server.ts` 启动 HTTP + WebSocket + Next.js
- 后续容器化：
  - 提供 Dockerfile
  - `docker run -p 80:3000 image-name` 即可运行

### 4.2 性能预期

- Worker 数量：初期假设 1–10 个连接
- 单 Worker：一次执行 1 个任务，串行执行
- 吞吐量 ≈ `workerCount × 任务平均处理速率`
- 队列主要用于吸收突发流量，平滑流量曲线

### 4.3 可用性与容错

- 若有 Worker 断线：
  - 仅此 Worker 不可用，其它 Worker 正常工作
  - 正在此 Worker 上执行且尚未返回的任务将通过超时机制处理
- 若无任何 Worker 在线：
  - 所有新任务都会进队列，但无法被执行，最终超时
  - 可添加保护：当 `workers.size === 0` 时直接拒绝新任务，返回 `No worker available`
- 系统需在日志中清晰记录：
  - Worker 连接 / 断开
  - 队列长度变化（可选）
  - 任务超时、队列溢出等异常

---

## 5. 技术架构与模块划分

### 5.1 技术栈

- Next.js 13/14（App Router）
- Node.js
- TypeScript（推荐）或 JavaScript
- WebSocket 库：`ws`

### 5.2 模块划分

**Next.js 路由层**
- `app/api/openai/route.ts`
  - 解析请求
  - 调用 `dispatchTaskWithQueue(type, payload)`
  - 根据结果返回 JSON

**WebSocket 管理模块** (`lib/wsServer.ts`)
- 创建 WebSocketServer（路径 `/ws`）
- 管理 `workers: Map<string, WorkerState>`
- 接收 `taskResult` 消息：
  - 解析 `taskId`
  - 完成对应 Promise
  - 标记 Worker 空闲
  - 调用 `tryDispatchFromQueue()`

**队列 & 调度模块** (`lib/wsDispatcher.ts` / `lib/taskQueue.ts`)
- `taskQueue` 全局队列
- `pendingTasks` 映射 `taskId -> Promise resolver`
- `dispatchTaskWithQueue(type, payload, timeoutMs)`
  - 生成 taskId、创建 Promise、入队、触发调度
- `tryDispatchFromQueue()`
  - 从队列取任务，选空闲 Worker，派发

**自定义服务器入口** (`server.ts`)
- 创建 Next.js app
- 创建 HTTP Server 并挂载 Next.js
- 创建 WS Server（复用 HTTP Server）

**Worker 客户端**（示例，不在主项目中）
- 使用 `ws` 客户端连接服务端 `/ws`
- 按协议收发消息：
  - 收到 `task` → 执行 → 发送 `taskResult`

---

## 6. API 设计（初版）

### 6.1 HTTP：POST /api/openai

#### 6.1.1 请求

Header：
- `Content-Type: application/json`

Body 示例（简化版 OpenAI 风格）：

```json
{
  "model": "test-model",
  "messages": [
    { "role": "user", "content": "Hello" }
  ],
  "stream": false
}
```

v1 中，服务端不对字段做复杂校验，仅保证是合法 JSON 并传递给 Worker。

#### 6.1.2 响应

**成功（200）：**

```json
{
  "id": "<task-id-or-worker-result-id>",
  "content": "worker 返回的结果内容或结构"
}
```

或者直接透传 Worker 产生的 JSON，例如：

```json
{
  "someData": { "foo": "bar" },
  "usage": { "tokens": 123 }
}
```

**队列已满（503）：**

```json
{
  "error": "Queue is full"
}
```

**无 Worker 可用（503 或 500）：**

```json
{
  "error": "No worker available"
}
```

**任务超时（500）：**

```json
{
  "error": "Task timeout"
}
```

**其他内部错误（500）：**

```json
{
  "error": "Internal error"
}
```

---

## 7. WebSocket 协议设计

### 7.1 连接

- URL：`ws://<host>:<port>/ws`
- 连接即视为一个 Worker 实例
- 服务端内部为该连接生成 `workerId`（可选下发给 Worker 用于日志）

### 7.2 消息格式

#### 7.2.1 派发任务（服务端 → Worker）

```json
{
  "type": "task",
  "taskType": "string",
  "taskId": "uuid-string",
  "payload": {}
}
```

说明：
- `type`: 固定为 `"task"`
- `taskType`: 任务类型，如 `"openaiLike"`，用于 Worker 内部分支处理
- `taskId`: 全局唯一，用于关联请求与结果
- `payload`: 业务数据（一般为 HTTP 请求体）

#### 7.2.2 返回结果（Worker → 服务端）

```json
{
  "type": "taskResult",
  "taskId": "uuid-string",
  "result": {},
  "error": "string | null"
}
```

说明：
- `type`: 固定为 `"taskResult"`
- `taskId`: 必须与收到的 `task.taskId` 一致
- `result`: 任务执行成功时的结果 JSON
- `error`: 若任务失败，则为错误描述字符串（非空值）；成功时可为 `null` 或省略

**约定：**

Worker 必须保证：
- 对每个收到的 `task`，最终一定发送对应的 `taskResult`（成功或失败），避免任务永远悬挂
- 不主动并发执行多个任务（因为服务端已保证单 Worker 串行，一般 Worker 不需要内部再做并发控制）

---

## 8. 后续扩展（非本期必须）

### 优先级队列
- 将 `taskQueue` 升级为多队列（高优/普通）
- 调度时优先从高优队列取任务

### 流式响应
- WebSocket 中支持任务中间状态或分片结果推送
- HTTP 层通过 SSE 或 chunked response 将流反馈给客户端

### 鉴权与安全
- HTTP 层增加 API Key / Token 鉴权
- Worker 连接增加鉴权（如携带 token / 签名）

### 监控与管理
- 提供管理接口或面板：
  - 查看当前 Worker 数量、状态（busy/idle）
  - 查看队列长度、平均等待时间
  - 监控任务执行耗时分布

### 任务重试机制
- 当 Worker 断开或返回特定错误码时，允许自动重试若干次
- 需要配合幂等性设计
