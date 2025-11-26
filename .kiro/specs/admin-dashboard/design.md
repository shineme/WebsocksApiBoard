# Design Document

## Overview

管理看板是一个基于 Next.js 的 Web 应用，采用宫崎骏治愈系风格设计，为任务调度系统提供实时监控和日志查看功能。前端使用 React + Tailwind CSS 构建，通过 REST API 与后端通信，展示 Worker 状态、任务队列指标和请求日志。

设计目标：
- 提供清晰、易读的系统状态可视化
- 采用柔和、治愈的视觉风格，减少运维压力
- 支持实时数据刷新和响应式布局
- 与现有任务调度服务无缝集成

## Architecture

### 系统架构图

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (用户)                        │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │   React Dashboard Component                     │    │
│  │   - 监控面板 (Metrics + Worker Table)          │    │
│  │   - 日志面板 (Request Logs)                    │    │
│  │   - 自动刷新 (useEffect timers)                │    │
│  └────────────────────────────────────────────────┘    │
│                        ↓ HTTP GET                        │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│              Next.js Server (Port 3000)                  │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │  Dashboard API Routes                           │    │
│  │  - GET /api/dashboard/metrics                   │    │
│  │  - GET /api/dashboard/workers                   │    │
│  │  - GET /api/dashboard/logs                      │    │
│  └────────────────────────────────────────────────┘    │
│                        ↓                                 │
│  ┌────────────────────────────────────────────────┐    │
│  │  Task Dispatcher Core                           │    │
│  │  - workers Map (Worker 状态)                    │    │
│  │  - taskQueue (任务队列)                         │    │
│  │  - requestLogs (请求日志缓存)                   │    │
│  └────────────────────────────────────────────────┘    │
│                        ↓                                 │
│  ┌────────────────────────────────────────────────┐    │
│  │  WebSocket Server (/ws)                         │    │
│  │  - Worker 连接管理                              │    │
│  │  - 任务分发                                     │    │
│  └────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### 技术栈

**前端：**
- React 18+ (函数组件 + Hooks)
- Tailwind CSS 3+ (样式框架)
- Lucide React (图标库)
- Next.js App Router (页面路由)

**后端：**
- Next.js 14 API Routes
- Node.js 18+
- TypeScript (类型安全)

**部署：**
- Docker 容器化
- Nginx/Caddy 反向代理 (HTTPS)

## Components and Interfaces

### 前端组件结构

```
app/
├── dashboard/
│   └── page.tsx              # 主看板页面
├── components/
│   ├── MetricCard.tsx        # 指标卡片组件
│   ├── WorkerTable.tsx       # Worker 状态表格
│   ├── LogTable.tsx          # 日志表格
│   ├── StatusBadge.tsx       # 状态徽章
│   └── DurationDisplay.tsx   # 时长显示组件
└── api/
    └── dashboard/
        ├── metrics/
        │   └── route.ts      # GET /api/dashboard/metrics
        ├── workers/
        │   └── route.ts      # GET /api/dashboard/workers
        └── logs/
            └── route.ts      # GET /api/dashboard/logs
```

### 组件详细设计

#### 1. DashboardPage (主页面)

**职责：**
- 管理全局状态 (activeTab, metrics, workers, logs)
- 定时刷新数据 (useEffect)
- 渲染监控面板和日志面板

**State：**
```typescript
const [activeTab, setActiveTab] = useState<'dashboard' | 'logs'>('dashboard');
const [metrics, setMetrics] = useState<Metrics | null>(null);
const [workers, setWorkers] = useState<Worker[]>([]);
const [logs, setLogs] = useState<RequestLog[]>([]);
const [lastUpdate, setLastUpdate] = useState<string>('');
```

**Effects：**
- 每 3 秒刷新 metrics 和 workers
- 每 1.5 秒刷新 logs
- 更新 lastUpdate 时间戳

#### 2. MetricCard 组件

**Props：**
```typescript
interface MetricCardProps {
  title: string;           // 指标标题
  value: string | number;  // 指标值
  icon: React.ReactNode;   // 图标
  color: 'blue' | 'green' | 'peach' | 'lavender';  // 主题色
  progress?: number;       // 进度条百分比 (0-100)
}
```

**样式特点：**
- 柔和圆角 (rounded-xl)
- 浅色背景 + 柔和阴影
- 左侧彩色边框 (border-l-4)
- 底部进度条 (可选)
- Hover 时轻微放大 + 阴影加深

#### 3. WorkerTable 组件

**Props：**
```typescript
interface WorkerTableProps {
  workers: Worker[];
}

interface Worker {
  id: string;
  ip: string;
  status: 'idle' | 'busy';
  currentTaskId: string | null;
  connectedSince: number;  // timestamp
}
```

**功能：**
- 显示 Worker 列表
- 实时更新连接时长
- 空状态提示
- 状态徽章颜色区分

#### 4. LogTable 组件

**Props：**
```typescript
interface LogTableProps {
  logs: RequestLog[];
}

interface RequestLog {
  id: string;
  timestamp: number;
  method: string;
  path: string;
  status: number;
  latency: number;
  requestBody: string;   // JSON string
  responseBody: string;  // JSON string
}
```

**功能：**
- 显示最近 50 条日志
- 点击展开详情
- 状态码颜色区分
- 延迟高亮显示

#### 5. StatusBadge 组件

**Props：**
```typescript
interface StatusBadgeProps {
  status: 'idle' | 'busy';
}
```

**样式：**
- idle: 柔和蓝色背景 + "空闲" 文字
- busy: 柔和桃色背景 + "忙碌中" 文字
- 圆角徽章样式
- 柔和边框

#### 6. DurationDisplay 组件

**Props：**
```typescript
interface DurationDisplayProps {
  since: number;  // timestamp
}
```

**功能：**
- 计算并显示时长 (Xh Ym Zs)
- 每秒自动更新
- 使用 useEffect + setInterval

### API 接口设计

#### GET /api/dashboard/metrics

**Response：**
```typescript
{
  totalWorkers: number;      // 在线 Worker 总数
  queueLength: number;       // 当前队列长度
  busyWorkers: number;       // 忙碌 Worker 数量
  avgWaitTime: number;       // 平均等待时间 (ms)
  timestamp: number;         // 数据采集时间戳
}
```

**实现逻辑：**
```typescript
export async function GET() {
  const workers = getWorkers();  // 从 wsServer 获取
  const queue = getTaskQueue();  // 从 dispatcher 获取
  
  return NextResponse.json({
    totalWorkers: workers.size,
    queueLength: queue.length,
    busyWorkers: Array.from(workers.values()).filter(w => w.busy).length,
    avgWaitTime: calculateAvgWaitTime(queue, workers),
    timestamp: Date.now()
  });
}
```

#### GET /api/dashboard/workers

**Response：**
```typescript
{
  workers: Array<{
    id: string;
    ip: string;
    status: 'idle' | 'busy';
    currentTaskId: string | null;
    connectedSince: number;
  }>;
  timestamp: number;
}
```

**实现逻辑：**
```typescript
export async function GET(request: Request) {
  const workers = getWorkers();
  
  const workerList = Array.from(workers.values()).map(worker => ({
    id: worker.id,
    ip: extractIpAddress(worker.ws, request),  // 处理代理 IP
    status: worker.busy ? 'busy' : 'idle',
    currentTaskId: worker.currentTaskId || null,
    connectedSince: worker.connectedSince
  }));
  
  return NextResponse.json({
    workers: workerList,
    timestamp: Date.now()
  });
}
```

#### GET /api/dashboard/logs

**Response：**
```typescript
{
  logs: Array<{
    id: string;
    timestamp: number;
    method: string;
    path: string;
    status: number;
    latency: number;
    requestBody: string;
    responseBody: string;
  }>;
  timestamp: number;
}
```

**实现逻辑：**
```typescript
export async function GET() {
  const logs = getRequestLogs();  // 从日志缓存获取
  
  return NextResponse.json({
    logs: logs.slice(0, 50),  // 最近 50 条
    timestamp: Date.now()
  });
}
```

## Data Models

### Worker State

```typescript
interface WorkerState {
  id: string;                // UUID
  ws: WebSocket;             // WebSocket 连接对象
  busy: boolean;             // 是否正在执行任务
  currentTaskId?: string;    // 当前任务 ID
  connectedSince: number;    // 连接建立时间戳
  ip?: string;               // IP 地址 (从请求头提取)
}
```

### Request Log Entry

```typescript
interface RequestLogEntry {
  id: string;                // 日志 ID
  timestamp: number;         // 请求时间戳
  method: string;            // HTTP 方法
  path: string;              // 请求路径
  status: number;            // 响应状态码
  latency: number;           // 响应延迟 (ms)
  requestBody: string;       // 请求体 JSON 字符串
  responseBody: string;      // 响应体 JSON 字符串
}
```

### Dashboard Metrics

```typescript
interface DashboardMetrics {
  totalWorkers: number;      // 在线 Worker 总数
  queueLength: number;       // 当前队列长度
  busyWorkers: number;       // 忙碌 Worker 数量
  avgWaitTime: number;       // 平均等待时间 (ms)
  timestamp: number;         // 数据采集时间戳
}
```

### Log Cache

日志缓存使用循环数组实现，保持最近 50 条记录：

```typescript
class LogCache {
  private logs: RequestLogEntry[] = [];
  private readonly maxSize = 50;
  
  add(entry: RequestLogEntry): void {
    this.logs.unshift(entry);  // 添加到开头
    if (this.logs.length > this.maxSize) {
      this.logs.pop();  // 移除最旧的
    }
  }
  
  getAll(): RequestLogEntry[] {
    return [...this.logs];
  }
}
```

## Error Handling

### 前端错误处理

#### API 请求失败

```typescript
async function fetchMetrics() {
  try {
    const response = await fetch('/api/dashboard/metrics');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    setMetrics(data);
  } catch (error) {
    console.error('Failed to fetch metrics:', error);
    // 显示友好的错误提示
    setError('无法连接到服务器，请稍后重试');
  }
}
```

#### 空状态处理

- **无 Worker 连接**：显示温和提示 "当前无任何 Worker 在线"
- **无日志数据**：显示 "正在等待新的请求日志..."
- **队列为空**：显示 0

### 后端错误处理

#### IP 地址提取

```typescript
function extractIpAddress(ws: WebSocket, request: Request): string {
  // 优先从代理头获取
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  // 回退到 socket 地址
  const remoteAddress = (ws as any)._socket?.remoteAddress;
  return remoteAddress || 'unknown';
}
```

#### 日志记录中间件

```typescript
// 在 API 路由中记录请求日志
export async function POST(request: Request) {
  const startTime = Date.now();
  const requestBody = await request.text();
  
  try {
    // 处理请求...
    const result = await processTask(JSON.parse(requestBody));
    const latency = Date.now() - startTime;
    
    // 记录成功日志
    logCache.add({
      id: generateId(),
      timestamp: startTime,
      method: 'POST',
      path: '/api/openai',
      status: 200,
      latency,
      requestBody,
      responseBody: JSON.stringify(result)
    });
    
    return NextResponse.json(result);
  } catch (error) {
    const latency = Date.now() - startTime;
    
    // 记录错误日志
    logCache.add({
      id: generateId(),
      timestamp: startTime,
      method: 'POST',
      path: '/api/openai',
      status: error.status || 500,
      latency,
      requestBody,
      responseBody: JSON.stringify({ error: error.message })
    });
    
    return NextResponse.json(
      { error: error.message },
      { status: error.status || 500 }
    );
  }
}
```

## Testing Strategy

### 单元测试

**组件测试 (React Testing Library)：**

```typescript
// MetricCard.test.tsx
describe('MetricCard', () => {
  it('should display metric value and title', () => {
    render(<MetricCard title="Workers" value={5} color="blue" />);
    expect(screen.getByText('Workers')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });
  
  it('should render progress bar when progress prop is provided', () => {
    render(<MetricCard title="Queue" value={10} color="green" progress={50} />);
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveStyle({ width: '50%' });
  });
});
```

**API 路由测试：**

```typescript
// metrics.test.ts
describe('GET /api/dashboard/metrics', () => {
  it('should return current metrics', async () => {
    const response = await GET();
    const data = await response.json();
    
    expect(data).toHaveProperty('totalWorkers');
    expect(data).toHaveProperty('queueLength');
    expect(data).toHaveProperty('busyWorkers');
    expect(data).toHaveProperty('avgWaitTime');
    expect(data).toHaveProperty('timestamp');
  });
  
  it('should calculate busy workers correctly', async () => {
    // Mock workers with 2 busy, 3 idle
    mockWorkers([
      { id: '1', busy: true },
      { id: '2', busy: true },
      { id: '3', busy: false },
      { id: '4', busy: false },
      { id: '5', busy: false }
    ]);
    
    const response = await GET();
    const data = await response.json();
    
    expect(data.totalWorkers).toBe(5);
    expect(data.busyWorkers).toBe(2);
  });
});
```

### 集成测试

**端到端测试 (Playwright)：**

```typescript
// dashboard.spec.ts
test('dashboard displays real-time metrics', async ({ page }) => {
  await page.goto('/dashboard');
  
  // 验证指标卡片存在
  await expect(page.locator('text=在线 Worker 总数')).toBeVisible();
  await expect(page.locator('text=全局任务队列长度')).toBeVisible();
  
  // 验证数据自动刷新
  const initialValue = await page.locator('[data-testid="total-workers"]').textContent();
  await page.waitForTimeout(3500);  // 等待刷新
  const updatedValue = await page.locator('[data-testid="total-workers"]').textContent();
  
  // 值可能变化或保持不变，但不应该报错
  expect(updatedValue).toBeDefined();
});

test('log table expands details on click', async ({ page }) => {
  await page.goto('/dashboard');
  await page.click('text=请求日志');
  
  // 点击第一条日志
  await page.click('table tbody tr:first-child');
  
  // 验证详情展开
  await expect(page.locator('text=请求体')).toBeVisible();
  await expect(page.locator('text=响应体')).toBeVisible();
});
```

### 性能测试

**前端性能：**
- 使用 React DevTools Profiler 测量渲染性能
- 确保大量日志时 (50 条) 渲染时间 < 100ms
- 使用 useMemo 优化计算密集型操作

**API 性能：**
- 每个 API 端点响应时间 < 50ms
- 使用缓存减少重复计算
- 避免在 API 路由中执行阻塞操作

## UI Design Specifications

### 配色方案 (宫崎骏治愈系)

**主色调：**
- 背景：`#f8fafc` (slate-50) - 柔和白色
- 卡片背景：`#ffffff` - 纯白
- 文字主色：`#334155` (slate-700) - 深灰
- 文字次要：`#64748b` (slate-500) - 中灰

**功能色：**
- 柔和蓝 (Workers): `#93c5fd` (blue-300)
- 薄荷绿 (Queue): `#6ee7b7` (emerald-300)
- 蜜桃色 (Busy): `#fdba74` (orange-300)
- 薰衣草 (Latency): `#c4b5fd` (violet-300)

**状态色：**
- 成功/空闲：`#86efac` (green-300)
- 警告：`#fcd34d` (yellow-300)
- 错误：`#fca5a5` (red-300)
- 信息：`#7dd3fc` (sky-300)

### 字体规范

**标题：**
- 主标题：`text-3xl font-bold` (30px, 700)
- 副标题：`text-xl font-semibold` (20px, 600)
- 卡片标题：`text-sm font-medium` (14px, 500)

**正文：**
- 普通文字：`text-base` (16px, 400)
- 小字：`text-sm` (14px, 400)
- 极小字：`text-xs` (12px, 400)

**特殊：**
- 数字/代码：`font-mono` (等宽字体)

### 间距规范

**组件间距：**
- 大间距：`mb-8` (32px)
- 中间距：`mb-6` (24px)
- 小间距：`mb-4` (16px)

**内边距：**
- 卡片：`p-6` (24px)
- 表格单元格：`px-6 py-4` (24px 16px)
- 按钮：`px-4 py-2` (16px 8px)

### 圆角规范

- 卡片：`rounded-2xl` (16px)
- 按钮/徽章：`rounded-lg` (8px)
- 小元素：`rounded` (4px)

### 阴影规范

- 卡片：`shadow-sm` (柔和阴影)
- Hover 状态：`shadow-md` (中等阴影)
- 无阴影：`shadow-none`

### 动画规范

**过渡时间：**
- 快速：`duration-150` (150ms)
- 标准：`duration-300` (300ms)
- 缓慢：`duration-500` (500ms)

**缓动函数：**
- 标准：`ease-in-out`
- 进入：`ease-out`
- 退出：`ease-in`

**动画效果：**
- Fade in: `animate-[fadeIn_0.5s_ease-out]`
- Scale on hover: `hover:scale-105`
- Smooth transitions: `transition-all`

### 响应式断点

```typescript
// Tailwind 默认断点
sm: '640px'   // 小屏幕
md: '768px'   // 中等屏幕
lg: '1024px'  // 大屏幕
xl: '1280px'  // 超大屏幕
```

**布局适配：**
- 指标卡片：`grid-cols-1 md:grid-cols-4`
- 表格：`overflow-x-auto` (小屏幕横向滚动)
- 头部：`flex-col md:flex-row`

## Deployment Considerations

### Docker 配置

**Dockerfile：**
```dockerfile
FROM node:20-alpine

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm ci --only=production

# 复制源代码
COPY . .

# 构建 Next.js
RUN npm run build

# 暴露端口
EXPOSE 3000

# 启动服务
CMD ["npm", "start"]
```

**docker-compose.yml：**
```yaml
version: '3.8'

services:
  task-dispatcher:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - TASK_TIMEOUT_MS=60000
      - MAX_QUEUE_LENGTH=1000
    restart: unless-stopped
```

### Nginx 反向代理配置

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Dashboard 页面
    location /dashboard {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Dashboard API
    location /api/dashboard {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400s;
    }

    # 其他 API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 环境变量

```bash
# .env.production
NODE_ENV=production
PORT=3000
TASK_TIMEOUT_MS=60000
MAX_QUEUE_LENGTH=1000
LOG_CACHE_SIZE=50
METRICS_REFRESH_INTERVAL=3000
LOGS_REFRESH_INTERVAL=1500
```

## Security Considerations

### API 安全

1. **CORS 配置**：限制允许的来源
2. **Rate Limiting**：防止 API 滥用
3. **输入验证**：验证所有 API 输入
4. **错误处理**：不暴露敏感信息

### 数据安全

1. **敏感信息脱敏**：日志中不记录密码、token
2. **IP 地址处理**：遵守隐私法规
3. **HTTPS**：生产环境强制使用 HTTPS

### WebSocket 安全

1. **连接鉴权**：Worker 连接需要验证
2. **消息验证**：验证 WebSocket 消息格式
3. **超时机制**：防止连接悬挂

## Performance Optimization

### 前端优化

1. **React.memo**：避免不必要的重渲染
2. **useMemo/useCallback**：缓存计算结果和函数
3. **虚拟滚动**：大量日志时使用虚拟列表
4. **代码分割**：按路由分割代码

### 后端优化

1. **缓存**：缓存 Worker 状态和指标
2. **批量操作**：减少数据库查询
3. **异步处理**：非阻塞 I/O
4. **连接池**：复用数据库连接

### 网络优化

1. **HTTP/2**：启用 HTTP/2
2. **Gzip 压缩**：压缩响应体
3. **CDN**：静态资源使用 CDN
4. **缓存策略**：合理设置缓存头

## Monitoring and Logging

### 应用监控

1. **健康检查端点**：`GET /api/health`
2. **性能指标**：响应时间、错误率
3. **资源使用**：CPU、内存、网络

### 日志记录

1. **结构化日志**：使用 JSON 格式
2. **日志级别**：DEBUG, INFO, WARN, ERROR
3. **日志轮转**：防止日志文件过大
4. **集中式日志**：发送到日志聚合服务

### 告警机制

1. **Worker 离线告警**
2. **队列溢出告警**
3. **高延迟告警**
4. **错误率告警**
