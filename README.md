# 任务调度系统 - 管理看板

一个基于 Next.js 的实时监控看板，采用宫崎骏治愈系风格设计，为任务调度系统提供可视化监控和日志查看功能。

## 功能特性

### 监控面板
- 📊 实时系统指标展示（Worker 数量、队列长度、忙碌状态、平均等待时间）
- 👥 Worker 状态详情表格
- 🎨 柔和的治愈系 UI 设计
- 🔄 自动数据刷新（每 3 秒）

### 请求日志
- 📝 最近 50 条 API 请求日志
- 🔍 可展开查看详细请求/响应数据
- 🎯 状态码和延迟高亮显示
- ⚡ 实时日志更新（每 1.5 秒）

### 响应式设计
- 📱 支持移动端、平板和桌面设备
- 🎯 自适应布局
- 💫 流畅的动画过渡

## 技术栈

- **前端框架**: Next.js 14 (App Router)
- **UI 库**: React 18
- **样式**: Tailwind CSS 3
- **图标**: Lucide React
- **语言**: TypeScript
- **部署**: Docker

## 快速开始

### 本地开发

1. 安装依赖：
```bash
npm install
```

2. 启动开发服务器：
```bash
npm run dev
```

3. 访问看板：
打开浏览器访问 [http://localhost:3000/dashboard](http://localhost:3000/dashboard)

### 生产构建

```bash
npm run build
npm start
```

## Docker 部署

### 使用 Docker Compose

```bash
docker-compose up -d
```

### 手动构建

```bash
# 构建镜像
docker build -t task-dispatcher-dashboard .

# 运行容器
docker run -p 3000:3000 \
  -e NODE_ENV=production \
  -e PORT=3000 \
  task-dispatcher-dashboard
```

## 环境变量

创建 `.env` 文件并配置以下变量：

```env
NODE_ENV=production
PORT=3000
TASK_TIMEOUT_MS=60000
MAX_QUEUE_LENGTH=1000
LOG_CACHE_SIZE=50
METRICS_REFRESH_INTERVAL=3000
LOGS_REFRESH_INTERVAL=1500
```

详见 `.env.example` 文件。

## API 端点

### GET /api/dashboard/metrics
获取系统指标数据

**响应示例：**
```json
{
  "totalWorkers": 5,
  "queueLength": 10,
  "busyWorkers": 2,
  "avgWaitTime": 1234,
  "timestamp": 1234567890
}
```

### GET /api/dashboard/workers
获取 Worker 状态列表

**响应示例：**
```json
{
  "workers": [
    {
      "id": "worker-001",
      "ip": "192.168.1.101",
      "status": "busy",
      "currentTaskId": "task-abc123",
      "connectedSince": 1234567890
    }
  ],
  "timestamp": 1234567890
}
```

### GET /api/dashboard/logs
获取请求日志

**响应示例：**
```json
{
  "logs": [
    {
      "id": "log-001",
      "timestamp": 1234567890,
      "method": "POST",
      "path": "/api/openai",
      "status": 200,
      "latency": 1234,
      "requestBody": "{}",
      "responseBody": "{}",
      "taskId": "task-abc123"
    }
  ],
  "timestamp": 1234567890
}
```

## Nginx 反向代理

参考 `nginx.conf.example` 配置 Nginx 反向代理和 HTTPS。

主要配置点：
- Dashboard 页面路由
- API 路由
- WebSocket 支持
- SSL/TLS 配置

## 项目结构

```
.
├── app/
│   ├── api/
│   │   └── dashboard/          # Dashboard API 路由
│   ├── dashboard/
│   │   └── page.tsx            # 主看板页面
│   ├── globals.css             # 全局样式
│   └── layout.tsx              # 根布局
├── components/
│   ├── MetricCard.tsx          # 指标卡片组件
│   ├── WorkerTable.tsx         # Worker 表格组件
│   ├── LogTable.tsx            # 日志表格组件
│   ├── StatusBadge.tsx         # 状态徽章组件
│   └── DurationDisplay.tsx     # 时长显示组件
├── lib/
│   ├── types/
│   │   └── dashboard.ts        # TypeScript 类型定义
│   └── services/
│       ├── dispatcher.ts       # 任务调度核心服务
│       └── mock-data.ts        # 模拟数据（开发用）
├── Dockerfile                  # Docker 镜像配置
├── docker-compose.yml          # Docker Compose 配置
├── nginx.conf.example          # Nginx 配置示例
└── .env.example                # 环境变量示例
```

## UI 设计理念

本项目采用宫崎骏治愈系风格设计：

- 🎨 **柔和色调**: 使用柔和的蓝色、薄荷绿、蜜桃色和薰衣草色
- 🌸 **圆角设计**: 所有卡片和按钮使用柔和的圆角
- ✨ **平滑动画**: 所有交互都有流畅的过渡动画
- 🌿 **自然渐变**: 背景使用自然的渐变色
- 💫 **柔和阴影**: 使用轻柔的阴影效果

## 开发说明

### 添加新的指标

1. 在 `lib/types/dashboard.ts` 中添加类型定义
2. 在 `lib/services/dispatcher.ts` 中实现数据获取逻辑
3. 在 `app/api/dashboard/metrics/route.ts` 中添加 API 响应
4. 在 `app/dashboard/page.tsx` 中添加 UI 展示

### 自定义主题颜色

编辑 `tailwind.config.ts` 中的 `colors` 配置：

```typescript
colors: {
  'soft-blue': '#93c5fd',
  'mint-green': '#6ee7b7',
  'peach': '#fdba74',
  'lavender': '#c4b5fd',
}
```

## 性能优化

- ✅ React.memo 避免不必要的重渲染
- ✅ 自动清理定时器
- ✅ 响应式图片和资源
- ✅ 代码分割和懒加载
- ✅ API 响应缓存

## 浏览器支持

- Chrome (最新版)
- Firefox (最新版)
- Safari (最新版)
- Edge (最新版)

## 许可证

MIT

## 贡献

欢迎提交 Issue 和 Pull Request！

## 联系方式

如有问题，请提交 Issue。
