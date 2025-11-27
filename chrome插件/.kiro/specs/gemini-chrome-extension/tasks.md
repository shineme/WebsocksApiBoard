# Implementation Plan

- [x] 1. Set up project structure and configuration
  - [x] 1.1 Create gemini-chrome directory with basic file structure
    - Create manifest.json for Chrome Extension Manifest V3
    - Configure permissions: webNavigation, storage, debugger, scripting, activeTab
    - Set host_permissions for business.gemini.google/*
    - _Requirements: 1.1, 2.1_
  - [x] 1.2 Create placeholder files for background.js, content.js, settings-panel.js
    - Set up basic module structure
    - _Requirements: 1.1_
  - [x] 1.3 Copy icon files from doubao-chrome
    - _Requirements: 7.1_



- [x] 2. Implement core utilities and message parser
  - [x] 2.1 Implement message parser module
    - Create parseTaskMessage() function supporting new and legacy formats
    - Create convertPayloadToCommand() function
    - Create isNewFormatMessage() helper
    - _Requirements: 5.1_
  - [ ]* 2.2 Write property test for message parser
    - **Property 15: Message Parsing Robustness**
    - **Validates: Requirements 5.1**
  - [x] 2.3 Implement response builders
    - Create buildTaskCompleteMessage() function
    - Create buildTaskErrorMessage() function
    - _Requirements: 6.1, 6.2, 6.3_
  - [ ]* 2.4 Write property test for response builders
    - **Property 11: Task Complete Message Format**
    - **Property 12: Task Error Message Format**
    - **Validates: Requirements 6.1, 6.2, 6.3**

- [x] 3. Implement Tab Manager
  - [x] 3.1 Create Tab Manager module
    - Implement addGeminiTab(), removeGeminiTab(), setTabStatus()
    - Implement getIdleTab() with round-robin selection
    - Implement getAllGeminiTabs()
    - _Requirements: 2.1, 2.2, 2.3_
  - [ ]* 3.2 Write property test for tab registration
    - **Property 4: Tab Registration with Idle Status**
    - **Property 5: Tab Removal Consistency**
    - **Validates: Requirements 2.1, 2.2**
  - [ ]* 3.3 Write property test for round-robin distribution
    - **Property 6: Round-Robin Task Distribution**
    - **Validates: Requirements 2.3**
  - [x] 3.4 Implement task queue management
    - Create taskQueue array and queue processing logic
    - Implement processTaskQueue() function
    - _Requirements: 2.4, 2.5_
  - [ ]* 3.5 Write property test for task queuing
    - **Property 7: Task Queuing When No Idle Tabs**
    - **Property 8: Queue Processing on Tab Idle**
    - **Validates: Requirements 2.4, 2.5**

- [x] 4. Implement WebSocket Manager
  - [x] 4.1 Create WebSocket connection management
    - Implement connectWebSocket() with configurable URL and group
    - Implement buildWebSocketUrl() helper
    - Implement setupWebSocketHandlers()
    - _Requirements: 1.1, 1.2_
  - [ ]* 4.2 Write property test for reconnection
    - **Property 1: WebSocket Reconnection Scheduling**
    - **Validates: Requirements 1.2**
  - [x] 4.3 Implement message handling
    - Handle 'connected' message and send 'ready'
    - Handle 'ping' message and send 'pong'
    - Handle 'task' messages and dispatch to tabs
    - _Requirements: 1.3_
  - [ ]* 4.4 Write property test for ready message protocol
    - **Property 2: Ready Message Protocol**
    - **Validates: Requirements 1.3**
  - [x] 4.5 Implement settings change listener
    - Listen for chrome.storage.onChanged
    - Reconnect with new settings when changed
    - _Requirements: 1.4_
  - [ ]* 4.6 Write property test for settings change
    - **Property 3: Settings Change Triggers Reconnection**
    - **Validates: Requirements 1.4**





- [x] 5. Implement Task Tracker
  - [x] 5.1 Create task tracking module
    - Implement startTaskTracking()
    - Implement completeTask() with duration calculation
    - Implement failTask()
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  - [ ]* 5.2 Write property test for tab status update
    - **Property 13: Tab Status Update on Completion**
    - **Validates: Requirements 6.4**



- [ ] 6. Checkpoint - Ensure all background script tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement Gemini API Response Interceptor
  - [x] 7.1 Set up Chrome Debugger API integration
    - Attach debugger to Gemini tabs on load
    - Enable Network domain for request interception
    - Detach debugger on tab close
    - _Requirements: 5.1_
  - [x] 7.2 Implement widgetStreamAssist response parser
    - Parse JSON array response format
    - Extract fileId from streamAssistResponse.answer.replies
    - Handle IN_PROGRESS and SUCCEEDED states
    - _Requirements: 5.1, 5.2_
  - [ ]* 7.3 Write property test for API response parsing
    - **Property 9: Gemini API Response Parsing**
    - **Validates: Requirements 5.1, 5.2**
  - [x] 7.4 Implement download URL construction
    - Build URL with projectId, sessionId, and fileId
    - _Requirements: 5.3_
  - [ ]* 7.5 Write property test for URL construction
    - **Property 10: Download URL Construction**
    - **Validates: Requirements 5.3**
  - [x] 7.6 Implement image download and result sending
    - Fetch image as base64
    - Send result to WebSocket server
    - _Requirements: 5.4_





- [x] 8. Implement Content Script - Core Functions
  - [x] 8.1 Create extension context management
    - Implement isExtensionContextValid()
    - Implement safeSendMessage()
    - _Requirements: 8.1_
  - [x] 8.2 Implement DOM selector constants
    - Define SELECTORS object with all required selectors
    - _Requirements: 3.1, 3.2, 3.3, 4.1, 4.2_
  - [x] 8.3 Implement element finding functions
    - Create findToolSelector()
    - Create findProseMirrorEditor()
    - Create findSendButton()
    - Create findAddFilesButton()
    - _Requirements: 3.1, 3.2, 3.3, 4.2_


- [x] 9. Implement Content Script - Task Execution
  - [x] 9.1 Implement image generation mode selection
    - Click tool selector menu anchor
    - Find and click "Create images (Pro)" option
    - _Requirements: 3.1_
  - [x] 9.2 Implement prompt input to ProseMirror editor
    - Focus editor element
    - Set content using DOM manipulation
    - Dispatch input events
    - _Requirements: 3.2_
  - [x] 9.3 Implement send button click
    - Find send button
    - Click to submit request
    - _Requirements: 3.3_
  - [x] 9.4 Implement file upload flow
    - Click "Add files" button
    - Click "Upload files" menu item
    - Handle file input element
    - Wait for upload completion
    - _Requirements: 4.1, 4.2, 4.3_
  - [x] 9.5 Implement handleGenerateImageCommand()
    - Orchestrate the full task execution flow
    - Handle text-to-image and image-to-image tasks
    - Report errors and update status
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4_

- [x] 10. Implement Content Script - Message Handling
  - [x] 10.1 Set up message listener
    - Listen for COMMAND_FROM_SERVER messages
    - Listen for IMAGE_URLS messages from background
    - _Requirements: 3.1, 5.4_
  - [x] 10.2 Implement status update functions
    - Create updateTabStatus()
    - Create notifyTaskCompleted()
    - Create sendErrorToBackground()
    - _Requirements: 6.4, 8.1_
  - [x] 10.3 Implement cleanup and reload logic
    - Clear localStorage and sessionStorage
    - Handle auto-reload setting
    - _Requirements: 7.4_

- [x] 11. Implement Settings Panel
  - [x] 11.1 Create settings panel UI
    - Build HTML structure for settings
    - Style with CSS
    - _Requirements: 7.1, 7.2_
  - [x] 11.2 Implement settings load/save
    - Load settings from chrome.storage.sync
    - Save settings on user action
    - _Requirements: 7.3_
  - [ ]* 11.3 Write property test for settings persistence
    - **Property 14: Settings Persistence Round-Trip**
    - **Validates: Requirements 7.3**
  - [x] 11.4 Implement tab status display
    - Show all Gemini tabs and their status
    - Show WebSocket connection status
    - Show task queue length
    - _Requirements: 7.2_

- [x] 12. Implement Background Script Integration
  - [x] 12.1 Wire up all modules in background.js
    - Initialize WebSocket manager
    - Set up tab event listeners
    - Set up message listeners
    - _Requirements: 1.1, 2.1_
  - [x] 12.2 Implement chrome.action.onClicked handler
    - Inject settings panel on Gemini pages
    - Open Gemini page if not on Gemini
    - _Requirements: 7.1_
  - [x] 12.3 Implement chrome.tabs.onUpdated listener

    - Register Gemini tabs
    - Attach debugger
    - _Requirements: 2.1, 5.1_
  - [x] 12.4 Implement chrome.tabs.onRemoved listener
    - Remove tab from manager
    - Detach debugger
    - Handle WebSocket cleanup if no tabs
    - _Requirements: 2.2, 8.3_

- [ ] 13. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Create documentation
  - [x] 14.1 Create README.md
    - Document installation steps
    - Document usage instructions
    - Document configuration options
    - _Requirements: 7.1, 7.2, 7.3_
  - [x] 14.2 Create CLAUDE.md for AI assistance
    - Document project structure
    - Document key functions and their purposes
    - _Requirements: All_

- [ ] 15. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
