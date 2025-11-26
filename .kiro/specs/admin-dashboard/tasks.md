# Implementation Plan

- [x] 1. 设置项目基础结构


  - 创建 Next.js 项目目录结构
  - 配置 Tailwind CSS
  - 安装必要依赖 (lucide-react, TypeScript)
  - 配置 TypeScript 类型定义
  - _Requirements: 8.1, 8.2_

- [x] 2. 实现后端 Dashboard API


  - [x] 2.1 创建 API 路由文件结构



    - 创建 `app/api/dashboard/metrics/route.ts`
    - 创建 `app/api/dashboard/workers/route.ts`
    - 创建 `app/api/dashboard/logs/route.ts`
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 2.2 实现 metrics API 端点

    - 从 Task Dispatcher 获取 Worker 状态
    - 计算总 Worker 数、队列长度、忙碌 Worker 数
    - 计算平均等待时间
    - 返回 JSON 响应
    - _Requirements: 7.1, 1.3, 1.4, 1.5, 1.6_

  - [x] 2.3 实现 workers API 端点

    - 获取所有 Worker 状态
    - 提取 Worker IP 地址 (处理代理头)
    - 格式化 Worker 数据
    - 返回 JSON 响应
    - _Requirements: 7.2, 2.1, 2.7, 2.9, 10.2_

  - [x] 2.4 实现 logs API 端点

    - 从日志缓存获取最近 50 条日志
    - 格式化日志数据
    - 返回 JSON 响应
    - _Requirements: 7.3, 3.1, 3.2_

  - [x] 2.5 实现日志记录中间件

    - 在 API 路由中拦截请求
    - 记录请求时间、方法、路径
    - 记录响应状态、延迟
    - 存储请求体和响应体
    - 维护最近 50 条日志
    - _Requirements: 7.4, 3.1, 3.2_

- [x] 3. 创建共享类型定义

  - 创建 `lib/types/dashboard.ts`
  - 定义 Worker 接口
  - 定义 Metrics 接口
  - 定义 RequestLog 接口
  - 定义 API 响应类型
  - _Requirements: 7.1, 7.2, 7.3_

- [x] 4. 实现基础 UI 组件


  - [x] 4.1 创建 StatusBadge 组件


    - 接收 status prop (idle/busy)
    - 渲染柔和蓝色徽章 (空闲)
    - 渲染柔和桃色徽章 (忙碌中)
    - 应用圆角和柔和边框样式
    - _Requirements: 2.2, 2.3, 11.9_

  - [x] 4.2 创建 DurationDisplay 组件


    - 接收 since prop (timestamp)
    - 使用 useEffect 每秒更新时长
    - 格式化为 "Xh Ym Zs"
    - 清理定时器
    - _Requirements: 2.8_

  - [x] 4.3 创建 MetricCard 组件


    - 接收 title, value, icon, color, progress props
    - 渲染柔和圆角卡片
    - 显示图标和标题
    - 显示大号数值
    - 渲染进度条 (可选)
    - 应用颜色主题 (blue/green/peach/lavender)
    - 添加 hover 效果 (轻微放大 + 阴影)
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 1.6, 1.7, 11.6_

- [x] 5. 实现 Worker 状态表格


  - [x] 5.1 创建 WorkerTable 组件


    - 接收 workers prop
    - 渲染表格结构 (ID, IP, Status, Task, Uptime)
    - 使用 StatusBadge 显示状态
    - 使用 DurationDisplay 显示连接时长
    - 处理空状态 (无 Worker)
    - 应用柔和样式和 hover 效果
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 11.7_

- [x] 6. 实现请求日志表格


  - [x] 6.1 创建 LogTable 组件


    - 接收 logs prop
    - 渲染表格结构 (Time, Method, Path, Status, Latency, Preview)
    - 实现点击展开/折叠详情
    - 根据状态码应用背景色 (>= 500 红色, >= 400 黄色)
    - 根据延迟应用颜色 (> 500ms 橙色)
    - 显示格式化的 JSON 请求/响应体
    - 处理空状态 (无日志)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 4.2, 4.3, 4.4, 9.3_

- [x] 7. 实现主看板页面


  - [x] 7.1 创建 DashboardPage 组件


    - 创建 `app/dashboard/page.tsx`
    - 设置状态管理 (activeTab, metrics, workers, logs)
    - 实现 Tab 切换逻辑
    - 渲染头部 (标题 + 时间戳)
    - 渲染 Tab 导航
    - 条件渲染监控面板或日志面板
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 11.3_

  - [x] 7.2 实现监控面板布局

    - 渲染 4 个 MetricCard (Workers, Queue, Busy, Latency)
    - 使用响应式网格布局 (1 列 → 4 列)
    - 渲染 WorkerTable
    - 应用柔和间距和圆角
    - _Requirements: 1.1, 1.2, 2.1, 8.1, 8.2_

  - [x] 7.3 实现日志面板布局

    - 渲染 LogTable
    - 应用柔和样式
    - _Requirements: 3.1, 5.2_

  - [x] 7.4 实现数据自动刷新

    - 使用 useEffect 每 3 秒获取 metrics 和 workers
    - 使用 useEffect 每 1.5 秒获取 logs
    - 更新 lastUpdate 时间戳
    - 清理定时器
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 7.5 实现错误处理

    - 捕获 API 请求错误
    - 显示友好错误提示
    - 处理网络失败情况
    - _Requirements: 9.1_

- [x] 8. 应用宫崎骏治愈系 UI 主题


  - [x] 8.1 配置 Tailwind 自定义颜色

    - 在 `tailwind.config.js` 中定义柔和色调
    - 定义 soft-blue, mint-green, peach, lavender
    - 配置柔和阴影
    - _Requirements: 11.1, 11.6_

  - [x] 8.2 创建全局样式

    - 设置柔和背景色 (slate-50)
    - 配置字体 (Inter 或类似)
    - 定义平滑过渡动画
    - 移除所有发光和脉冲效果
    - _Requirements: 11.1, 11.2, 11.5, 11.10_

  - [x] 8.3 应用柔和圆角和阴影

    - 卡片使用 rounded-2xl
    - 按钮使用 rounded-lg
    - 应用 shadow-sm 柔和阴影
    - _Requirements: 11.2, 11.7_

- [x] 9. 实现响应式设计

  - 测试移动端布局 (指标卡片单列)
  - 测试桌面端布局 (指标卡片 4 列)
  - 确保表格横向滚动
  - 验证字体大小和间距
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 10. Docker 和部署配置


  - [x] 10.1 创建 Dockerfile


    - 使用 Node.js 20 Alpine 镜像
    - 安装依赖
    - 构建 Next.js 应用
    - 暴露 3000 端口
    - _Requirements: 10.1_

  - [x] 10.2 创建 docker-compose.yml


    - 配置 task-dispatcher 服务
    - 设置环境变量
    - 配置端口映射
    - _Requirements: 10.1, 10.4_

  - [x] 10.3 创建 Nginx 配置示例


    - 配置 HTTPS
    - 配置反向代理规则
    - 配置 WebSocket 支持
    - 配置代理头转发
    - _Requirements: 10.3_

  - [x] 10.4 创建环境变量配置


    - 创建 `.env.example`
    - 文档化所有环境变量
    - 设置默认值
    - _Requirements: 10.4_

- [x] 11. 测试和验证


  - [x] 11.1 手动测试监控面板

    - 验证指标卡片显示正确
    - 验证 Worker 表格显示正确
    - 验证数据自动刷新
    - 验证空状态显示
    - _Requirements: 1.1, 1.2, 2.1, 6.1, 9.2_

  - [x] 11.2 手动测试日志面板

    - 验证日志列表显示
    - 验证点击展开详情
    - 验证状态码颜色
    - 验证延迟颜色
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 4.2, 4.3_

  - [x] 11.3 测试 Tab 切换

    - 验证默认显示监控面板
    - 验证切换到日志面板
    - 验证切换回监控面板
    - 验证动画效果
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 11.4 测试响应式布局

    - 在移动设备上测试
    - 在平板上测试
    - 在桌面上测试
    - 验证表格滚动
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 11.5 测试 Docker 部署

    - 构建 Docker 镜像
    - 运行容器
    - 验证所有功能正常
    - 测试环境变量配置
    - _Requirements: 10.1, 10.2, 10.4_

- [ ] 12. 最终检查点


  - 确保所有测试通过
  - 验证 UI 符合宫崎骏治愈系风格
  - 检查代码质量和注释
  - 更新 README 文档
  - 询问用户是否有问题
