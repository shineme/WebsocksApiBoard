# Requirements Document

## Introduction

本功能旨在为任务派发系统实现同步等待响应机制和任务超时处理。当前系统采用异步派发模式（派发后立即返回），需要改造为类似 OpenAI API 的同步响应模式：HTTP 请求发送任务后，等待 Worker 执行完成并返回结果，同时支持任务超时控制和队列长度限制。

## Glossary

- **Task Dispatcher（任务调度器）**: 负责接收 HTTP 请求、管理任务队列、分配任务给 Worker 的核心服务
- **Worker**: 通过 WebSocket 连接到调度器的执行单元，负责实际执行任务
- **Pending Task（待处理任务）**: 已派发给 Worker 但尚未收到结果的任务
- **Task Queue（任务队列）**: 等待被派发的任务 FIFO 队列
- **Task Timeout（任务超时）**: 任务从创建到完成的最大允许时间
- **Queue Wait Timeout（队列等待超时）**: 任务在队列中等待被派发的最大时间

## Requirements

### Requirement 1

**User Story:** As an API caller, I want to receive the task execution result in the same HTTP response, so that I can use the system like a synchronous API (similar to OpenAI API).

#### Acceptance Criteria

1. WHEN an API caller sends a POST request to `/api/openai` with valid task data THEN the Task Dispatcher SHALL hold the HTTP connection and return the Worker's execution result in the response body
2. WHEN a Worker completes a task and sends `taskResult` message THEN the Task Dispatcher SHALL resolve the corresponding pending task's Promise with the result
3. WHEN a Worker returns an error in `taskResult` message THEN the Task Dispatcher SHALL reject the corresponding pending task's Promise and return HTTP 500 with error details
4. WHEN the Task Dispatcher receives a task result THEN the Task Dispatcher SHALL match it to the correct pending request using taskId

### Requirement 2

**User Story:** As an API caller, I want tasks to timeout if they take too long, so that I don't wait indefinitely for a response.

#### Acceptance Criteria

1. WHEN a task exceeds the configured `TASK_TIMEOUT_MS` duration THEN the Task Dispatcher SHALL reject the task's Promise with a "Task timeout" error
2. WHEN a task times out THEN the Task Dispatcher SHALL return HTTP 500 with `{ "error": "Task timeout" }` to the caller
3. WHEN a task times out THEN the Task Dispatcher SHALL clean up the pending task record from memory
4. WHEN a task completes after timeout THEN the Task Dispatcher SHALL ignore the late result gracefully

### Requirement 3

**User Story:** As a system operator, I want to limit the task queue length, so that the system doesn't run out of memory during traffic spikes.

#### Acceptance Criteria

1. WHEN the task queue length reaches `MAX_QUEUE_LENGTH` THEN the Task Dispatcher SHALL reject new tasks immediately
2. WHEN a task is rejected due to queue full THEN the Task Dispatcher SHALL return HTTP 503 with `{ "error": "Queue is full" }`
3. WHEN a task is dequeued THEN the Task Dispatcher SHALL allow new tasks to be enqueued

### Requirement 4

**User Story:** As an API caller, I want to be notified when no Workers are available, so that I know the system cannot process my request.

#### Acceptance Criteria

1. WHEN no Worker is connected to the system THEN the Task Dispatcher SHALL reject new tasks immediately
2. WHEN no Worker is available THEN the Task Dispatcher SHALL return HTTP 503 with `{ "error": "No worker available" }`

### Requirement 5

**User Story:** As a system operator, I want tasks to be automatically dispatched to idle Workers, so that the system maximizes throughput.

#### Acceptance Criteria

1. WHEN a new task is enqueued AND an idle Worker exists THEN the Task Dispatcher SHALL immediately dispatch the task to the Worker
2. WHEN a Worker becomes idle after completing a task THEN the Task Dispatcher SHALL check the queue and dispatch the next task if available
3. WHEN multiple idle Workers exist THEN the Task Dispatcher SHALL select one Worker for task dispatch
4. WHEN a task is dispatched THEN the Task Dispatcher SHALL mark the Worker as busy and record the taskId

### Requirement 6

**User Story:** As a system operator, I want Worker disconnections to be handled gracefully, so that in-flight tasks are properly cleaned up.

#### Acceptance Criteria

1. WHEN a Worker disconnects while executing a task THEN the Task Dispatcher SHALL reject the corresponding pending task's Promise
2. WHEN a Worker disconnects THEN the Task Dispatcher SHALL remove the Worker from the available pool
3. WHEN a Worker disconnects with an in-flight task THEN the Task Dispatcher SHALL return an error to the waiting HTTP caller

### Requirement 7

**User Story:** As a developer, I want the system to support configurable timeout values, so that I can tune the system for different use cases.

#### Acceptance Criteria

1. WHEN the system starts THEN the Task Dispatcher SHALL read `TASK_TIMEOUT_MS` from environment variables with a default of 60000ms
2. WHEN the system starts THEN the Task Dispatcher SHALL read `MAX_QUEUE_LENGTH` from environment variables with a default of 1000
3. WHEN configuration values are invalid THEN the Task Dispatcher SHALL use default values and log a warning

### Requirement 8

**User Story:** As an API caller, I want to specify a custom timeout for long-running tasks (like video generation), so that I can handle tasks with different execution times.

#### Acceptance Criteria

1. WHEN an API caller includes a `timeout` field in the request body THEN the Task Dispatcher SHALL use that value as the task timeout instead of the default
2. WHEN the request timeout value exceeds `MAX_TASK_TIMEOUT_MS` (default 600000ms / 10 minutes) THEN the Task Dispatcher SHALL cap the timeout at `MAX_TASK_TIMEOUT_MS`
3. WHEN the request timeout value is less than `MIN_TASK_TIMEOUT_MS` (default 5000ms / 5 seconds) THEN the Task Dispatcher SHALL use `MIN_TASK_TIMEOUT_MS`
4. WHEN no timeout is specified in the request THEN the Task Dispatcher SHALL use the default `TASK_TIMEOUT_MS`

### Requirement 9

**User Story:** As an API caller, I want to submit a task and get a taskId immediately, so that I can poll for results without keeping a long HTTP connection open.

#### Acceptance Criteria

1. WHEN an API caller includes `async: true` in the request body THEN the Task Dispatcher SHALL return immediately with `{ "taskId": "xxx", "status": "queued" }`
2. WHEN an async task is submitted THEN the Task Dispatcher SHALL enqueue the task and process it normally
3. WHEN `async` is not specified or is `false` THEN the Task Dispatcher SHALL use synchronous mode (wait for result)

### Requirement 10

**User Story:** As an API caller, I want to query the status of a task by taskId, so that I can check progress and retrieve results for async tasks.

#### Acceptance Criteria

1. WHEN an API caller sends a GET request to `/api/task/{taskId}` THEN the Task Dispatcher SHALL return the current task status
2. WHEN the task is queued (waiting in queue) THEN the Task Dispatcher SHALL return `{ "taskId": "xxx", "status": "queued", "enqueuedAt": timestamp, "position": number }`
3. WHEN the task is executing THEN the Task Dispatcher SHALL return `{ "taskId": "xxx", "status": "executing", "workerId": "xxx", "startedAt": timestamp }`
4. WHEN the task is completed THEN the Task Dispatcher SHALL return `{ "taskId": "xxx", "status": "completed", "result": {...}, "completedAt": timestamp }`
5. WHEN the task is failed THEN the Task Dispatcher SHALL return `{ "taskId": "xxx", "status": "failed", "error": "...", "failedAt": timestamp }`
6. WHEN the taskId does not exist THEN the Task Dispatcher SHALL return HTTP 404 with `{ "error": "Task not found" }`

### Requirement 11

**User Story:** As a system operator, I want completed task results to be stored temporarily, so that async callers can retrieve results within a reasonable time window.

#### Acceptance Criteria

1. WHEN a task completes (success or failure) THEN the Task Dispatcher SHALL store the result for `TASK_RESULT_TTL_MS` (default 300000ms / 5 minutes)
2. WHEN the TTL expires THEN the Task Dispatcher SHALL remove the task result from storage
3. WHEN an API caller queries an expired task THEN the Task Dispatcher SHALL return HTTP 404 with `{ "error": "Task not found or expired" }`

