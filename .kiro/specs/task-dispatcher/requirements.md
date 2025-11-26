# Requirements Document

## Introduction

本系统是一个基于 Next.js 的任务派发服务，对外提供类似 OpenAI API 风格的 HTTP 接口，内部通过 WebSocket 连接多个 Worker 进程来执行实际计算任务。系统采用全局任务队列实现请求排队，支持多 Worker 并发处理，每个 Worker 串行执行任务。

## Glossary

- **Task Dispatcher**: 任务调度服务，负责接收 HTTP 请求、管理任务队列、分发任务给 Worker
- **Worker**: 通过 WebSocket 连接到调度服务的执行单元，负责实际执行任务并返回结果
- **Task Queue**: 全局任务队列，采用 FIFO 策略存储待执行的任务
- **WorkerState**: Worker 状态对象，包含 Worker ID、连接对象、忙碌状态等信息
- **QueuedTask**: 队列中的任务对象，包含任务 ID、类型、负载数据、入队时间
- **pendingTasks**: 待处理任务映射表，存储 taskId 到 Promise resolver 的映射

## Requirements

### Requirement 1: HTTP API 接口

**User Story:** As an API caller, I want to send HTTP requests to a unified endpoint, so that I can execute tasks without knowing the internal Worker details.

#### Acceptance Criteria

1. WHEN an API caller sends a POST request to `/api/openai` with valid JSON body, THEN the Task Dispatcher SHALL parse the request, create a task, and return the Worker execution result as JSON response.
2. WHEN the Task Dispatcher receives a request with invalid JSON format, THEN the Task Dispatcher SHALL return HTTP 400 with error message "Invalid JSON".
3. WHEN a task execution exceeds the configured timeout (TASK_TIMEOUT_MS), THEN the Task Dispatcher SHALL return HTTP 500 with error message "Task timeout".
4. WHEN the task queue length reaches MAX_QUEUE_LENGTH, THEN the Task Dispatcher SHALL return HTTP 503 with error message "Queue is full".
5. WHEN no Worker is connected to the system, THEN the Task Dispatcher SHALL return HTTP 503 with error message "No worker available".

### Requirement 2: WebSocket Worker 连接管理

**User Story:** As a Worker process, I want to connect to the dispatcher via WebSocket, so that I can receive and execute tasks.

#### Acceptance Criteria

1. WHEN a Worker establishes a WebSocket connection to `/ws`, THEN the Task Dispatcher SHALL generate a unique workerId (UUID) and create a WorkerState object with busy=false.
2. WHEN a Worker connection is established, THEN the Task Dispatcher SHALL add the WorkerState to the workers Map and trigger task dispatch if queue is not empty.
3. WHEN a Worker disconnects, THEN the Task Dispatcher SHALL remove the WorkerState from the workers Map immediately.
4. WHEN a Worker disconnects while executing a task, THEN the Task Dispatcher SHALL rely on the task timeout mechanism to handle the orphaned task.

### Requirement 3: 全局任务队列管理

**User Story:** As a system operator, I want tasks to be queued when Workers are busy, so that burst traffic can be handled gracefully.

#### Acceptance Criteria

1. WHEN a new task is created from HTTP request, THEN the Task Dispatcher SHALL add the task to the end of the task queue with taskId, type, payload, and enqueuedAt timestamp.
2. WHEN a task is added to the queue, THEN the Task Dispatcher SHALL store a Promise resolver in pendingTasks map keyed by taskId.
3. WHEN the queue length exceeds MAX_QUEUE_LENGTH before enqueue, THEN the Task Dispatcher SHALL reject the request without adding to queue.
4. WHEN a task is dequeued for dispatch, THEN the Task Dispatcher SHALL remove it from the queue head following FIFO order.

### Requirement 4: 任务调度与分发

**User Story:** As a system operator, I want tasks to be automatically dispatched to idle Workers, so that system throughput is maximized.

#### Acceptance Criteria

1. WHEN a new task is enqueued AND an idle Worker exists, THEN the Task Dispatcher SHALL immediately dispatch the task to the idle Worker.
2. WHEN a Worker completes a task AND the queue is not empty, THEN the Task Dispatcher SHALL dispatch the next task from queue to that Worker.
3. WHEN dispatching a task to a Worker, THEN the Task Dispatcher SHALL set Worker.busy=true, Worker.currentTaskId=taskId, and send task message via WebSocket.
4. WHEN multiple idle Workers exist, THEN the Task Dispatcher SHALL select any one idle Worker for task dispatch.
5. WHEN the tryDispatchFromQueue function is called, THEN the Task Dispatcher SHALL continue dispatching tasks until queue is empty OR no idle Worker exists.

### Requirement 5: 任务结果处理

**User Story:** As an API caller, I want to receive the task execution result, so that I can process the response data.

#### Acceptance Criteria

1. WHEN a Worker sends a taskResult message with matching taskId, THEN the Task Dispatcher SHALL resolve the corresponding Promise with the result data.
2. WHEN a Worker sends a taskResult message with error field set, THEN the Task Dispatcher SHALL reject the corresponding Promise with the error message.
3. WHEN a taskResult is processed, THEN the Task Dispatcher SHALL remove the entry from pendingTasks map, set Worker.busy=false, clear Worker.currentTaskId, and trigger tryDispatchFromQueue.
4. WHEN a taskResult is received with unknown taskId, THEN the Task Dispatcher SHALL log a warning and ignore the message.

### Requirement 6: 超时控制

**User Story:** As a system operator, I want tasks to timeout after a configured duration, so that resources are not held indefinitely.

#### Acceptance Criteria

1. WHEN a task is created, THEN the Task Dispatcher SHALL start a timeout timer with duration TASK_TIMEOUT_MS.
2. WHEN the timeout timer fires before taskResult is received, THEN the Task Dispatcher SHALL reject the task Promise with "Task timeout" error and remove from pendingTasks.
3. WHEN a taskResult is received before timeout, THEN the Task Dispatcher SHALL cancel the timeout timer for that task.

### Requirement 7: WebSocket 消息协议

**User Story:** As a Worker developer, I want a clear message protocol, so that I can implement Worker clients correctly.

#### Acceptance Criteria

1. WHEN dispatching a task to Worker, THEN the Task Dispatcher SHALL send JSON message with format: { type: "task", taskType: string, taskId: string, payload: object }.
2. WHEN Worker completes a task, THEN the Worker SHALL send JSON message with format: { type: "taskResult", taskId: string, result: object, error: string|null }.
3. WHEN Worker receives a task message, THEN the Worker SHALL execute the task and send exactly one taskResult message for that taskId.

### Requirement 8: 服务器启动与配置

**User Story:** As a system operator, I want to start the service with custom configuration, so that I can tune the system for different environments.

#### Acceptance Criteria

1. WHEN the server starts, THEN the Task Dispatcher SHALL create HTTP server, attach Next.js handler, and create WebSocket server on path `/ws`.
2. WHEN the server starts, THEN the Task Dispatcher SHALL read configuration values TASK_TIMEOUT_MS and MAX_QUEUE_LENGTH from environment variables with sensible defaults.
3. WHEN the server is running, THEN the Task Dispatcher SHALL log Worker connect/disconnect events and task timeout/queue overflow errors.
