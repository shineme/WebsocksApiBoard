# Implementation Plan

- [x] 1. Set up configuration module




  - [x] 1.1 Create task configuration file with environment variable loading

    - Create `lib/config/task-config.ts`
    - Define TASK_TIMEOUT_MS, MAX_TASK_TIMEOUT_MS, MIN_TASK_TIMEOUT_MS, MAX_QUEUE_LENGTH, TASK_RESULT_TTL_MS
    - Implement default values and validation
    - _Requirements: 7.1, 7.2, 7.3_
  - [ ]* 1.2 Write property test for timeout normalization
    - **Property 8: Timeout Normalization**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4**

- [x] 2. Implement Task Manager core module


  - [x] 2.1 Create Task Manager with data structures


    - Create `lib/services/task-manager.ts`
    - Implement pendingTasks Map for Promise management
    - Implement taskResults Map for completed task storage
    - Define TypeScript interfaces for QueuedTask, PendingTask, TaskResult
    - _Requirements: 1.1, 1.4_
  - [x] 2.2 Implement task submission logic

    - Implement `submitTask()` method
    - Support both sync and async modes
    - Generate unique taskId
    - Create Promise for sync mode
    - Set up timeout timer
    - _Requirements: 1.1, 9.1, 9.2, 9.3_
  - [ ]* 2.3 Write property test for async mode immediate return
    - **Property 9: Async Mode Immediate Return**
    - **Validates: Requirements 9.1, 9.3**
  - [x] 2.4 Implement task result handling

    - Implement `handleTaskResult()` method
    - Match result to pending task by taskId
    - Resolve or reject Promise based on result
    - Clear timeout timer
    - Store result in taskResults with TTL
    - _Requirements: 1.2, 1.3, 1.4_
  - [ ]* 2.5 Write property test for task result resolution
    - **Property 1: Task Result Resolution Correctness**
    - **Validates: Requirements 1.2, 1.4**

  - [x] 2.6 Implement timeout handling

    - Set up timeout timer on task dispatch
    - Reject Promise on timeout
    - Clean up pending task record
    - Handle late results gracefully
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - [ ]* 2.7 Write property test for timeout behavior
    - **Property 2: Task Timeout Behavior**
    - **Validates: Requirements 2.1, 2.3**

- [x] 3. Implement queue management


  - [x] 3.1 Implement queue operations with length limit

    - Implement enqueue with MAX_QUEUE_LENGTH check
    - Implement dequeue operation
    - Return queue position for status queries
    - _Requirements: 3.1, 3.2, 3.3_
  - [ ]* 3.2 Write property test for queue length enforcement
    - **Property 3: Queue Length Enforcement**
    - **Validates: Requirements 3.1**
  - [ ]* 3.3 Write property test for queue space recovery
    - **Property 4: Queue Space Recovery**
    - **Validates: Requirements 3.3**

- [x] 4. Implement task dispatch logic


  - [x] 4.1 Implement tryDispatchFromQueue

    - Check for idle workers
    - Dispatch tasks from queue head
    - Mark worker as busy
    - Record taskId on worker
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [ ]* 4.2 Write property test for auto-dispatch
    - **Property 5: Auto-Dispatch on Idle Worker**
    - **Validates: Requirements 5.1, 5.2**
  - [ ]* 4.3 Write property test for dispatch state management
    - **Property 6: Dispatch State Management**
    - **Validates: Requirements 5.3, 5.4**

- [x] 5. Implement Worker disconnect handling


  - [x] 5.1 Handle Worker disconnect in task manager

    - Detect in-flight task on disconnected worker
    - Reject corresponding pending task
    - Remove worker from pool
    - _Requirements: 6.1, 6.2, 6.3_
  - [ ]* 5.2 Write property test for disconnect handling
    - **Property 7: Worker Disconnect Handling**
    - **Validates: Requirements 6.1, 6.2**

- [x] 6. Checkpoint - Ensure core logic tests pass

  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement HTTP API endpoints


  - [x] 7.1 Create POST /api/openai endpoint


    - Create `app/api/openai/route.ts`
    - Parse request body (model, messages, data, group, timeout, async)
    - Validate request
    - Call Task Manager submitTask
    - Return sync result or async taskId
    - Handle errors with appropriate HTTP status codes
    - _Requirements: 1.1, 4.1, 4.2, 9.1_
  - [x] 7.2 Create GET /api/task/[taskId] endpoint


    - Create `app/api/task/[taskId]/route.ts`
    - Query task status from Task Manager
    - Return appropriate status object based on task state
    - Handle not found case with 404
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_
  - [ ]* 7.3 Write property test for task status query
    - **Property 10: Task Status Query Correctness**
    - **Validates: Requirements 10.2, 10.3, 10.4, 10.5**

- [x] 8. Implement result TTL management

  - [x] 8.1 Implement result expiration cleanup

    - Store completedAt and expiresAt with results
    - Implement periodic cleanup or lazy cleanup on access
    - _Requirements: 11.1, 11.2, 11.3_
  - [ ]* 8.2 Write property test for result TTL
    - **Property 11: Task Result TTL**
    - **Validates: Requirements 11.1, 11.2**

- [x] 9. Integrate with server.js


  - [x] 9.1 Update server.js to use Task Manager


    - Import and initialize Task Manager
    - Update WebSocket message handling to call Task Manager
    - Export Task Manager functions to global scope
    - Wire up worker disconnect handling
    - _Requirements: 1.2, 5.2, 6.1_
  - [x] 9.2 Update global type definitions


    - Update `global.d.ts` with new function signatures
    - Add types for new global functions
    - _Requirements: N/A (infrastructure)_

- [x] 10. Final Checkpoint - Ensure all tests pass


  - Ensure all tests pass, ask the user if questions arise.

