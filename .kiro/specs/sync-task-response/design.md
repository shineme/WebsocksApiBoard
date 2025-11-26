# Design Document: Sync Task Response

## Overview

本设计实现任务派发系统的同步响应机制、异步轮询模式和任务超时处理。系统支持两种模式：
1. **同步模式**：HTTP 请求等待 Worker 执行完成后返回结果
2. **异步模式**：立即返回 taskId，通过轮询接口查询状态和结果

核心改造点：
- 引入 `pendingTasks` Map 管理等待中的任务 Promise
- 实现任务超时机制
- 实现队列长度限制
- 新增任务状态查询 API
- 实现任务结果临时存储

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Task Dispatcher System                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│  │ HTTP API     │    │ Task Manager │    │ WebSocket Server     │  │
│  │              │───►│              │───►│                      │  │
│  │ /api/openai  │    │ - pendingTasks│   │ - workers Map        │  │
│  │ /api/task/   │◄───│ - taskQueue  │◄───│ - message handling   │  │
│  └──────────────┘    │ - taskResults│    └──────────────────────┘  │
│                      └──────────────┘              │                │
│                             │                      │                │
│                             ▼                      ▼                │
│                      ┌──────────────┐    ┌──────────────────────┐  │
│                      │ Config       │    │ Worker Connections   │  │
│                      │ - timeouts   │    │ (WebSocket clients)  │  │
│                      │ - limits     │    └──────────────────────┘  │
│                      └──────────────┘                               │
└─────────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Task Manager (`lib/services/task-manager.ts`)

核心任务管理模块，负责任务生命周期管理。

```typescript
interface TaskManager {
  // 提交任务（同步模式返回 Promise，异步模式立即返回 taskId）
  submitTask(payload: any, options: TaskOptions): Promise<TaskSubmitResult>;
  
  // 处理 Worker 返回的结果
  handleTaskResult(taskId: string, result: any, error?: string): void;
  
  // 查询任务状态
  getTaskStatus(taskId: string): TaskStatus | null;
  
  // 尝试从队列派发任务
  tryDispatchFromQueue(): void;
  
  // 处理 Worker 断线
  handleWorkerDisconnect(workerId: string): void;
}

interface TaskOptions {
  group?: string;
  timeout?: number;
  async?: boolean;
}

interface TaskSubmitResult {
  taskId: string;
  status: 'queued' | 'executing';
  result?: any;  // 同步模式下包含结果
}
```

### 2. HTTP API Endpoints

#### POST /api/openai
主要任务提交接口，支持同步和异步模式。

```typescript
// Request
interface OpenAIRequest {
  model?: string;
  messages?: any[];
  data?: any;           // 通用任务数据
  group?: string;       // Worker 分组
  timeout?: number;     // 自定义超时（ms）
  async?: boolean;      // 是否异步模式
}

// Response (sync mode)
interface SyncResponse {
  taskId: string;
  result: any;
}

// Response (async mode)
interface AsyncResponse {
  taskId: string;
  status: 'queued' | 'executing';
}
```

#### GET /api/task/[taskId]
任务状态查询接口。

```typescript
interface TaskStatusResponse {
  taskId: string;
  status: 'queued' | 'executing' | 'completed' | 'failed';
  enqueuedAt?: number;
  startedAt?: number;
  completedAt?: number;
  failedAt?: number;
  position?: number;    // 队列位置
  workerId?: string;
  result?: any;
  error?: string;
}
```

### 3. Configuration (`lib/config/task-config.ts`)

```typescript
interface TaskConfig {
  TASK_TIMEOUT_MS: number;      // 默认 60000
  MAX_TASK_TIMEOUT_MS: number;  // 默认 600000
  MIN_TASK_TIMEOUT_MS: number;  // 默认 5000
  MAX_QUEUE_LENGTH: number;     // 默认 1000
  TASK_RESULT_TTL_MS: number;   // 默认 300000
}
```

## Data Models

### QueuedTask
```typescript
interface QueuedTask {
  taskId: string;
  type: string;
  payload: any;
  group: string;
  enqueuedAt: number;
  timeout: number;
  async: boolean;
}
```

### PendingTask
```typescript
interface PendingTask {
  taskId: string;
  resolve: (result: any) => void;
  reject: (error: Error) => void;
  timeoutId: NodeJS.Timeout;
  workerId: string;
  startedAt: number;
}
```

### TaskResult
```typescript
interface TaskResult {
  taskId: string;
  status: 'completed' | 'failed';
  result?: any;
  error?: string;
  completedAt: number;
  expiresAt: number;
}
```

### Global State Structure
```typescript
// server.js 中维护的全局状态
interface GlobalState {
  workers: Map<string, WorkerState>;
  taskQueue: QueuedTask[];
  pendingTasks: Map<string, PendingTask>;
  taskResults: Map<string, TaskResult>;
}
```



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Based on the prework analysis, the following correctness properties have been identified:

### Property 1: Task Result Resolution Correctness
*For any* task that is dispatched to a Worker and receives a `taskResult` message, the Task Dispatcher SHALL resolve the corresponding pending task's Promise with the exact result, matching by taskId.
**Validates: Requirements 1.2, 1.4**

### Property 2: Task Timeout Behavior
*For any* task that exceeds its configured timeout duration, the Task Dispatcher SHALL reject the task's Promise with a "Task timeout" error AND remove the pending task record from memory.
**Validates: Requirements 2.1, 2.3**

### Property 3: Queue Length Enforcement
*For any* task submission when the queue length equals `MAX_QUEUE_LENGTH`, the Task Dispatcher SHALL reject the task immediately with HTTP 503.
**Validates: Requirements 3.1**

### Property 4: Queue Space Recovery
*For any* task that is dequeued (dispatched to a Worker), the queue length SHALL decrease by exactly one, allowing new tasks to be enqueued.
**Validates: Requirements 3.3**

### Property 5: Auto-Dispatch on Idle Worker
*For any* state where the task queue is non-empty AND at least one Worker is idle, the Task Dispatcher SHALL dispatch the next task from the queue to an idle Worker.
**Validates: Requirements 5.1, 5.2**

### Property 6: Dispatch State Management
*For any* task dispatch operation, exactly one idle Worker SHALL be selected, marked as busy, and have the taskId recorded.
**Validates: Requirements 5.3, 5.4**

### Property 7: Worker Disconnect Handling
*For any* Worker that disconnects, the Task Dispatcher SHALL remove the Worker from the pool AND reject any pending task that was being executed by that Worker.
**Validates: Requirements 6.1, 6.2**

### Property 8: Timeout Normalization
*For any* task submission with a timeout value, the effective timeout SHALL be:
- The request timeout if within [MIN_TASK_TIMEOUT_MS, MAX_TASK_TIMEOUT_MS]
- MIN_TASK_TIMEOUT_MS if request timeout < MIN_TASK_TIMEOUT_MS
- MAX_TASK_TIMEOUT_MS if request timeout > MAX_TASK_TIMEOUT_MS
- TASK_TIMEOUT_MS if no timeout specified
**Validates: Requirements 8.1, 8.2, 8.3, 8.4**

### Property 9: Async Mode Immediate Return
*For any* task submission with `async: true`, the Task Dispatcher SHALL return immediately with a response containing taskId and status, without waiting for task completion.
**Validates: Requirements 9.1, 9.3**

### Property 10: Task Status Query Correctness
*For any* valid taskId query, the Task Dispatcher SHALL return the correct status object containing:
- `position` when status is `queued`
- `workerId` and `startedAt` when status is `executing`
- `result` and `completedAt` when status is `completed`
- `error` and `failedAt` when status is `failed`
**Validates: Requirements 10.2, 10.3, 10.4, 10.5**

### Property 11: Task Result TTL
*For any* completed task, the result SHALL be stored and queryable for exactly `TASK_RESULT_TTL_MS` duration, after which it SHALL be removed.
**Validates: Requirements 11.1, 11.2**

## Error Handling

### HTTP Error Responses

| Scenario | HTTP Status | Response Body |
|----------|-------------|---------------|
| Queue is full | 503 | `{ "error": "Queue is full" }` |
| No worker available | 503 | `{ "error": "No worker available" }` |
| Task timeout | 500 | `{ "error": "Task timeout" }` |
| Worker disconnected | 500 | `{ "error": "Worker disconnected" }` |
| Task not found | 404 | `{ "error": "Task not found" }` |
| Invalid request | 400 | `{ "error": "Invalid request: <details>" }` |
| Internal error | 500 | `{ "error": "Internal error" }` |

### Error Recovery Strategies

1. **Task Timeout**: Clean up pending task, do not retry automatically
2. **Worker Disconnect**: Reject pending task, remove worker from pool
3. **Late Result**: Ignore gracefully (task already timed out or completed)
4. **Queue Full**: Immediate rejection, caller should retry with backoff

## Testing Strategy

### Unit Testing
- Test configuration loading with various environment variable combinations
- Test timeout normalization logic
- Test queue operations (enqueue, dequeue, length check)
- Test task status transitions

### Property-Based Testing

We will use **fast-check** library for property-based testing in TypeScript/JavaScript.

Each property-based test MUST:
1. Run a minimum of 100 iterations
2. Be tagged with a comment referencing the correctness property: `**Feature: sync-task-response, Property {number}: {property_text}**`
3. Generate random but valid inputs using smart generators

Key properties to test:
- Task result resolution matches taskId correctly
- Timeout behavior triggers at correct time
- Queue length never exceeds MAX_QUEUE_LENGTH
- Worker state transitions are consistent
- Async mode returns immediately without blocking

### Integration Testing
- End-to-end test with mock Worker
- Test synchronous request-response flow
- Test async submission and polling flow
- Test timeout scenarios with delayed Worker responses

## Sequence Diagrams

### Synchronous Task Flow
```
┌──────┐          ┌──────────────┐          ┌────────┐
│Client│          │Task Dispatcher│          │ Worker │
└──┬───┘          └──────┬───────┘          └───┬────┘
   │  POST /api/openai   │                      │
   │────────────────────►│                      │
   │                     │  dispatch task       │
   │                     │─────────────────────►│
   │                     │                      │
   │                     │  (processing...)     │
   │                     │                      │
   │                     │  taskResult          │
   │                     │◄─────────────────────│
   │  HTTP 200 + result  │                      │
   │◄────────────────────│                      │
   │                     │                      │
```

### Async Task Flow with Polling
```
┌──────┐          ┌──────────────┐          ┌────────┐
│Client│          │Task Dispatcher│          │ Worker │
└──┬───┘          └──────┬───────┘          └───┬────┘
   │ POST /api/openai    │                      │
   │ (async: true)       │                      │
   │────────────────────►│                      │
   │                     │                      │
   │ {taskId, status}    │                      │
   │◄────────────────────│                      │
   │                     │  dispatch task       │
   │                     │─────────────────────►│
   │ GET /api/task/{id}  │                      │
   │────────────────────►│  (processing...)     │
   │ {status: executing} │                      │
   │◄────────────────────│                      │
   │                     │  taskResult          │
   │                     │◄─────────────────────│
   │ GET /api/task/{id}  │                      │
   │────────────────────►│                      │
   │ {status: completed} │                      │
   │◄────────────────────│                      │
```

