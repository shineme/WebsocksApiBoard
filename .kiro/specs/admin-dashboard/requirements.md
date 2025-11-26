# Requirements Document

## Introduction

本系统是任务调度系统的管理看板，提供实时监控和日志查看功能。管理看板通过 HTTP API 获取系统状态数据，以可视化方式展示 Worker 状态、任务队列信息、系统指标和请求日志，帮助运维人员监控系统运行状况。

## Glossary

- **Admin Dashboard**: 管理看板，提供系统监控和日志查看的 Web 界面
- **Monitoring Panel**: 监控面板，展示实时系统指标和 Worker 状态
- **Request Log**: 请求日志，记录所有 API 请求的详细信息
- **Metric Card**: 指标卡片，展示单个关键指标的可视化组件
- **Worker Status Table**: Worker 状态表，展示所有连接 Worker 的详细信息
- **Dashboard API**: 看板 API，提供系统状态数据的 HTTP 接口

## Requirements

### Requirement 1: 监控面板展示

**User Story:** As a system operator, I want to view real-time system metrics on a dashboard, so that I can monitor the overall system health.

#### Acceptance Criteria

1. WHEN the monitoring panel loads, THEN the Admin Dashboard SHALL display four metric cards showing total workers, queue length, busy workers count, and average wait time.
2. WHEN system metrics are updated, THEN the Admin Dashboard SHALL apply gentle, smooth transition animations to metric cards to indicate data refresh.
3. WHEN displaying total workers metric, THEN the Admin Dashboard SHALL show the count of currently connected Workers via WebSocket with soft blue color theme and Server icon.
4. WHEN displaying queue length metric, THEN the Admin Dashboard SHALL show the current task queue length with soft mint green color theme, Database icon, and progress bar indicating queue utilization percentage.
5. WHEN displaying busy workers metric, THEN the Admin Dashboard SHALL show the count of Workers currently executing tasks with soft peach color theme and Activity icon.
6. WHEN displaying average wait time metric, THEN the Admin Dashboard SHALL calculate and show the estimated average task waiting time in queue with soft lavender color theme and Clock icon.
7. WHEN hovering over a metric card, THEN the Admin Dashboard SHALL apply subtle scale transform and soft shadow effect to provide gentle visual feedback.

### Requirement 2: Worker 状态详情展示

**User Story:** As a system operator, I want to view detailed status of each Worker, so that I can identify which Workers are busy or idle.

#### Acceptance Criteria

1. WHEN the monitoring panel displays Worker status, THEN the Admin Dashboard SHALL show a table with columns: Worker ID, IP Address, Status, Current Task, and Connection Duration.
2. WHEN a Worker is executing a task, THEN the Admin Dashboard SHALL display status badge as "忙碌中" with soft peach background and rounded corners.
3. WHEN a Worker is idle, THEN the Admin Dashboard SHALL display status badge as "空闲" with soft blue background and rounded corners.
4. WHEN a Worker is executing a task, THEN the Admin Dashboard SHALL display the current taskId in readable font with neutral color.
5. WHEN a Worker is idle, THEN the Admin Dashboard SHALL display "无任务" with soft gray color in the current task ID column.
6. WHEN no Workers are connected, THEN the Admin Dashboard SHALL display a gentle informational message with soft styling and text "当前无任何 Worker 在线".
7. WHEN displaying Worker ID, THEN the Admin Dashboard SHALL show it in clear, readable font with neutral color.
8. WHEN displaying connection duration, THEN the Admin Dashboard SHALL show live-updating duration in format "Xh Ym Zs" that updates every second.
9. WHEN Worker connects through Docker network or proxy, THEN the Dashboard API SHALL extract IP address from X-Forwarded-For header if present, otherwise use socket remote address.

### Requirement 3: 请求日志查看

**User Story:** As a system operator, I want to view API request logs, so that I can troubleshoot issues and analyze system usage.

#### Acceptance Criteria

1. WHEN the request log tab is selected, THEN the Admin Dashboard SHALL display a table showing the most recent 50 API requests.
2. WHEN displaying a log entry, THEN the Admin Dashboard SHALL show timestamp, HTTP method, path, status code, latency, and request summary.
3. WHEN a log entry has status code >= 500, THEN the Admin Dashboard SHALL highlight the row with red background color.
4. WHEN a log entry has status code >= 400 and < 500, THEN the Admin Dashboard SHALL highlight the row with yellow background color.
5. WHEN a log entry has latency > 1500ms, THEN the Admin Dashboard SHALL display latency in red color with bold font.
6. WHEN a log entry has latency > 500ms and <= 1500ms, THEN the Admin Dashboard SHALL display latency in amber color.

### Requirement 4: 日志详情展开

**User Story:** As a system operator, I want to view detailed request and response data for each log entry, so that I can debug API issues.

#### Acceptance Criteria

1. WHEN a user clicks on a log entry row, THEN the Admin Dashboard SHALL expand a detail section showing full request body and response body.
2. WHEN the detail section is expanded, THEN the Admin Dashboard SHALL display request body and response body as formatted JSON with syntax highlighting.
3. WHEN a user clicks on an expanded log entry row, THEN the Admin Dashboard SHALL collapse the detail section with smooth animation.
4. WHEN displaying log details, THEN the Admin Dashboard SHALL show the taskId associated with the request.

### Requirement 5: Tab 切换功能

**User Story:** As a system operator, I want to switch between monitoring panel and request logs, so that I can focus on different aspects of the system.

#### Acceptance Criteria

1. WHEN the dashboard loads, THEN the Admin Dashboard SHALL display the monitoring panel tab labeled "监控面板" as active by default.
2. WHEN a user clicks on the "请求日志" tab, THEN the Admin Dashboard SHALL hide the monitoring panel and display the request log view with gentle fade-in animation.
3. WHEN a user clicks on the "监控面板" tab, THEN the Admin Dashboard SHALL hide the request log view and display the monitoring panel with gentle fade-in animation.
4. WHEN a tab is active, THEN the Admin Dashboard SHALL highlight the tab button with soft blue color theme and subtle bottom border.
5. WHEN a tab is inactive, THEN the Admin Dashboard SHALL display it with neutral styling and soft gray text that gently changes color on hover.
6. WHEN switching tabs, THEN the Admin Dashboard SHALL apply smooth, calming transition animations to the content area.

### Requirement 6: 数据自动刷新

**User Story:** As a system operator, I want the dashboard to automatically refresh data, so that I can see real-time system status without manual refresh.

#### Acceptance Criteria

1. WHEN the dashboard is running, THEN the Admin Dashboard SHALL fetch updated metrics and Worker status every 3 seconds.
2. WHEN the dashboard is running, THEN the Admin Dashboard SHALL fetch new request logs every 1.5 seconds.
3. WHEN data is refreshed, THEN the Admin Dashboard SHALL update the "上次更新" timestamp display with current time.
4. WHEN new log entries are received, THEN the Admin Dashboard SHALL prepend them to the log table and maintain maximum 50 entries.
5. WHEN the request log tab is not active, THEN the Admin Dashboard SHALL continue fetching logs in background but defer rendering until tab is activated.

### Requirement 7: Dashboard API 接口

**User Story:** As a dashboard developer, I want backend APIs to provide system status data, so that the frontend can display real-time information.

#### Acceptance Criteria

1. WHEN the dashboard requests system metrics, THEN the Dashboard API SHALL provide endpoint GET `/api/dashboard/metrics` returning JSON with totalWorkers, queueLength, busyWorkers, and avgWaitTime.
2. WHEN the dashboard requests Worker status, THEN the Dashboard API SHALL provide endpoint GET `/api/dashboard/workers` returning JSON array of Worker objects with id, ip, status, currentTaskId, and connectedSince.
3. WHEN the dashboard requests request logs, THEN the Dashboard API SHALL provide endpoint GET `/api/dashboard/logs` returning JSON array of the most recent 50 log entries.
4. WHEN a log entry is created, THEN the Dashboard API SHALL store timestamp, method, path, status, latency, requestBody, and responseBody.
5. WHEN the Dashboard API returns metrics, THEN the response SHALL include timestamp field indicating when the data was collected.

### Requirement 8: 响应式设计

**User Story:** As a system operator, I want the dashboard to work on different screen sizes, so that I can monitor the system from various devices.

#### Acceptance Criteria

1. WHEN the dashboard is viewed on desktop screens, THEN the Admin Dashboard SHALL display metric cards in a 4-column grid layout.
2. WHEN the dashboard is viewed on mobile screens, THEN the Admin Dashboard SHALL display metric cards in a single column layout.
3. WHEN tables are displayed on small screens, THEN the Admin Dashboard SHALL enable horizontal scrolling to show all columns.
4. WHEN the dashboard is viewed on any screen size, THEN the Admin Dashboard SHALL maintain readable font sizes and adequate spacing.

### Requirement 9: 错误处理与空状态

**User Story:** As a system operator, I want clear feedback when data is unavailable, so that I understand the system state.

#### Acceptance Criteria

1. WHEN the Dashboard API fails to respond, THEN the Admin Dashboard SHALL display an error message indicating connection failure.
2. WHEN no Workers are connected, THEN the Admin Dashboard SHALL display total workers as 0 and show appropriate message in Worker table.
3. WHEN no logs are available, THEN the Admin Dashboard SHALL display message "正在等待新的请求日志" in the log table.
4. WHEN the queue is empty, THEN the Admin Dashboard SHALL display queue length as 0.

### Requirement 10: Docker 环境兼容性

**User Story:** As a DevOps engineer, I want the dashboard to work correctly in Docker environments, so that I can deploy the system in containers.

#### Acceptance Criteria

1. WHEN the application runs in Docker container, THEN the Admin Dashboard SHALL be accessible on the configured port with all features functional.
2. WHEN Workers connect from other Docker containers, THEN the Dashboard API SHALL correctly identify and display Worker connection information.
3. WHEN the application runs behind a reverse proxy in Docker, THEN the Dashboard API SHALL correctly handle WebSocket upgrade requests and proxy headers.
4. WHEN environment variables are provided to Docker container, THEN the Task Dispatcher SHALL read configuration values for port, timeouts, and queue limits from environment variables.

### Requirement 11: UI 主题与视觉设计

**User Story:** As a system operator, I want a calming and healing Ghibli-inspired dashboard design, so that monitoring the system feels relaxing and stress-free.

#### Acceptance Criteria

1. WHEN the dashboard loads, THEN the Admin Dashboard SHALL display a soft pastel background with gentle gradient colors inspired by nature (sky blue, soft green, warm cream tones).
2. WHEN the dashboard is displayed, THEN the Admin Dashboard SHALL use soft shadows and rounded corners to create a warm, friendly aesthetic without harsh edges.
3. WHEN displaying the header, THEN the Admin Dashboard SHALL show the title with gentle, readable typography and calming color palette.
4. WHEN displaying the current time, THEN the Admin Dashboard SHALL show it with soft colors and minimal visual noise.
5. WHEN the dashboard renders, THEN the Admin Dashboard SHALL apply subtle, slow animations that feel organic and natural rather than mechanical.
6. WHEN displaying metric cards, THEN the Admin Dashboard SHALL use soft pastel colors (soft blue, mint green, peach, lavender) with gentle hover effects.
7. WHEN displaying section headers, THEN the Admin Dashboard SHALL use soft accent colors without glowing or pulsing effects.
8. WHEN displaying tables, THEN the Admin Dashboard SHALL use light backgrounds with soft borders and gentle hover states.
9. WHEN displaying status badges, THEN the Admin Dashboard SHALL use soft, muted colors instead of bright neon colors.
10. WHEN the user interacts with the dashboard, THEN the Admin Dashboard SHALL provide gentle, smooth transitions that feel calming rather than energetic.
