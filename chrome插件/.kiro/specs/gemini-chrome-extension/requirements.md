# Requirements Document

## Introduction

本文档定义了 Omni-Adapter Gemini Chrome 扩展的功能需求。该扩展用于自动化 Google Business Gemini 网站 (business.gemini.google) 的图片生成交互，支持文字生成图片和图片+文字生成图片功能，并与现有的 WebSocket 任务派发系统集成。

## Glossary

- **Gemini Extension**: 运行在 Chrome 浏览器中的扩展程序，用于自动化 Gemini 网站交互
- **Background Script**: Chrome 扩展的后台服务脚本，负责 WebSocket 连接和任务管理
- **Content Script**: 注入到 Gemini 网页中的脚本，负责 DOM 操作和页面交互
- **Task**: 从 WebSocket 服务器接收的图片生成任务
- **Tab Manager**: 管理多个 Gemini 标签页状态的模块
- **ProseMirror Editor**: Gemini 使用的富文本编辑器组件
- **fileId**: Gemini API 返回的图片文件标识符
- **Widget Stream Assist API**: Gemini 的流式响应 API 端点

## Requirements

### Requirement 1

**User Story:** As a user, I want the extension to automatically connect to the WebSocket server, so that I can receive image generation tasks.

#### Acceptance Criteria

1. WHEN the extension is installed or browser starts THEN the Gemini Extension SHALL attempt to establish a WebSocket connection to the configured server
2. WHEN the WebSocket connection is lost THEN the Gemini Extension SHALL automatically attempt to reconnect after 5 seconds
3. WHEN the WebSocket connection is established THEN the Gemini Extension SHALL send a "ready" message after receiving the "connected" message
4. WHEN WebSocket settings are changed THEN the Gemini Extension SHALL close the existing connection and reconnect with new settings

### Requirement 2

**User Story:** As a user, I want the extension to manage multiple Gemini tabs, so that tasks can be distributed efficiently.

#### Acceptance Criteria

1. WHEN a Gemini tab (business.gemini.google) is opened THEN the Gemini Extension SHALL register the tab in the tab manager with idle status
2. WHEN a Gemini tab is closed THEN the Gemini Extension SHALL remove the tab from the tab manager
3. WHEN multiple idle tabs exist THEN the Gemini Extension SHALL use round-robin strategy to distribute tasks
4. WHEN all tabs are busy THEN the Gemini Extension SHALL queue incoming tasks for later processing
5. WHEN a tab becomes idle THEN the Gemini Extension SHALL process the next task from the queue

### Requirement 3

**User Story:** As a user, I want the extension to execute text-to-image generation tasks, so that I can generate images from text prompts.

#### Acceptance Criteria

1. WHEN a text-to-image task is received THEN the Gemini Extension SHALL select the "Create images (Pro)" mode by clicking the tool selector
2. WHEN the image generation mode is selected THEN the Gemini Extension SHALL input the prompt text into the ProseMirror editor
3. WHEN the prompt is entered THEN the Gemini Extension SHALL click the send button to submit the request
4. IF the ProseMirror editor element is not found THEN the Gemini Extension SHALL report an error and mark the task as failed

### Requirement 4

**User Story:** As a user, I want the extension to execute image-to-image generation tasks, so that I can generate images using reference images.

#### Acceptance Criteria

1. WHEN an image-to-image task with imageUrl is received THEN the Gemini Extension SHALL first upload the reference image
2. WHEN uploading a reference image THEN the Gemini Extension SHALL click the "Add files" button and then "Upload files" menu item
3. WHEN the image upload is complete THEN the Gemini Extension SHALL proceed to input the prompt and submit
4. IF the image upload fails THEN the Gemini Extension SHALL report an error and mark the task as failed

### Requirement 5

**User Story:** As a user, I want the extension to capture generated image results, so that I can receive the output images.

#### Acceptance Criteria

1. WHEN a request to widgetStreamAssist API is detected THEN the Gemini Extension SHALL intercept and parse the response
2. WHEN the response contains a fileId THEN the Gemini Extension SHALL extract the fileId for image download
3. WHEN a fileId is extracted THEN the Gemini Extension SHALL construct the download URL and retrieve the image
4. WHEN the image is retrieved THEN the Gemini Extension SHALL send the image data (base64 or URL) back to the WebSocket server
5. IF the response parsing fails THEN the Gemini Extension SHALL log the error and continue monitoring

### Requirement 6

**User Story:** As a user, I want the extension to report task completion status, so that the server knows the result of each task.

#### Acceptance Criteria

1. WHEN a task completes successfully THEN the Gemini Extension SHALL send a task_complete message with the image URLs/data
2. WHEN a task fails THEN the Gemini Extension SHALL send a task_error message with the error description
3. WHEN sending task results THEN the Gemini Extension SHALL include the task duration in milliseconds
4. WHEN a task is completed THEN the Gemini Extension SHALL update the tab status to idle

### Requirement 7

**User Story:** As a user, I want to configure the extension settings, so that I can customize its behavior.

#### Acceptance Criteria

1. WHEN the user clicks the extension icon on a Gemini page THEN the Gemini Extension SHALL display a settings panel
2. WHEN settings are displayed THEN the Gemini Extension SHALL show WebSocket URL, group name, and connection status
3. WHEN the user saves settings THEN the Gemini Extension SHALL persist the settings to Chrome storage
4. WHEN settings include auto-reload option THEN the Gemini Extension SHALL reload the page after task completion if enabled

### Requirement 8

**User Story:** As a user, I want the extension to handle edge cases gracefully, so that it remains stable during operation.

#### Acceptance Criteria

1. IF the extension context becomes invalid THEN the Gemini Extension SHALL stop sending messages and log a warning
2. IF a DOM element is not found after retries THEN the Gemini Extension SHALL report the error and fail the task gracefully
3. IF the Gemini page navigates away during a task THEN the Gemini Extension SHALL cancel the current task and update status
4. IF the API response format changes THEN the Gemini Extension SHALL log detailed error information for debugging
