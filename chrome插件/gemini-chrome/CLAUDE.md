# Gemini Chrome Extension - AI Development Guide

## Project Overview

This is a Chrome extension for automating image generation on Google Business Gemini (business.gemini.google). It connects to a WebSocket server to receive tasks and automatically generates images using the Gemini platform.

## Architecture

### Three-Layer Design

1. **Background Script** (`background.js`): Core orchestration
   - WebSocket connection management
   - Tab management with round-robin distribution
   - Task queue management
   - API response interception via Chrome Debugger
   - Result collection and reporting

2. **Content Script** (`content.js`): DOM interaction
   - Injected into Gemini pages
   - Operates ProseMirror editor
   - Handles file uploads
   - Executes image generation tasks

3. **Settings Panel** (`settings-panel.js`): User interface
   - Configuration management
   - Status display
   - WebSocket reconnection

## Key Components

### WebSocket Communication

```javascript
// Connection flow:
// 1. Connect to server
// 2. Receive 'connected' message
// 3. Send 'ready' message with capabilities
// 4. Receive 'task' messages
// 5. Send 'task_complete' or 'task_error'
```

### Tab Management

- Tabs are registered when Gemini pages load
- Round-robin selection for task distribution
- Task queue when all tabs are busy
- Automatic cleanup on tab close

### API Interception

Uses Chrome Debugger API to intercept `widgetStreamAssist` responses:

```javascript
// Response structure:
{
  streamAssistResponse: {
    answer: {
      state: 'SUCCEEDED',
      replies: [{
        groundedContent: {
          content: {
            file: {
              fileId: '...',
              mimeType: 'image/png'
            }
          }
        }
      }]
    }
  }
}
```

### Task Execution Flow

1. Receive task from WebSocket
2. Select idle tab (round-robin)
3. Send command to content script
4. Content script:
   - Selects "Create images (Pro)" mode
   - Uploads reference image (if image-to-image)
   - Inputs prompt to editor
   - Clicks send button
5. Background intercepts API response
6. Downloads generated images
7. Sends result to server

## DOM Selectors

```javascript
const SELECTORS = {
  TOOL_SELECTOR: '#tool-selector-menu-anchor',
  PROSEMIRROR_EDITOR: '.ql-editor.textarea',
  ADD_FILES_BUTTON: 'button[aria-label="Add files"]',
  SEND_BUTTON: '.send-button.submit'
};
```

## Message Types

### Internal (Content ↔ Background)

- `CONTENT_SCRIPT_READY`: Content script loaded
- `TAB_STATUS_UPDATE`: Tab status changed
- `TASK_COMPLETED`: Task finished successfully
- `TASK_ERROR`: Task failed
- `COMMAND_FROM_SERVER`: Execute task
- `GET_STATUS`: Request status info

### External (Extension ↔ Server)

- `ready`: Extension ready to receive tasks
- `task`: New task from server
- `task_complete`: Task completed
- `task_error`: Task failed
- `ping`/`pong`: Keep-alive

## Common Issues

### Element Not Found

- Gemini UI may change, update selectors
- Wait for page load before interacting
- Use retry logic with delays

### WebSocket Disconnection

- Auto-reconnect after 5 seconds
- Settings change triggers reconnect
- Check server availability

### API Response Parsing

- Response format may vary
- Handle both array and object formats
- Log raw response for debugging

## Development Tips

1. Use Chrome DevTools to inspect Gemini page structure
2. Monitor Network tab for API calls
3. Check background script console for logs
4. Test with single tab first, then multi-tab

## File Dependencies

```
background.js (main entry)
├── Uses: WebSocket, chrome.debugger, chrome.tabs
├── Manages: geminiTabs, taskQueue, activeTasks
└── Communicates with: content.js, WebSocket server

content.js (page interaction)
├── Uses: DOM APIs, chrome.runtime
├── Manages: isProcessing, currentTaskId
└── Communicates with: background.js

settings-panel.js (UI)
├── Uses: chrome.storage, chrome.runtime
└── Communicates with: background.js
```
