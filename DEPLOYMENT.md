# TaskOrchard - 快速部署指南

## 方式一：使用 Docker Run（最简单）

### 1. 拉取镜像
```bash
docker pull ghcr.io/shineme/websocksapiboard:latest
```

### 2. 启动容器
```bash
docker run -d \
  --name task-dispatcher \
  -p 3000:3000 \
  --restart unless-stopped \
  ghcr.io/shineme/websocksapiboard:latest
```

### 3. 访问应用
打开浏览器访问：`http://localhost:3000`

**默认登录凭据：**
- 用户名: `admin`
- 密码: `affadsense`

---

## 方式二：使用 Docker Compose（推荐）

### 1. 创建 `docker-compose.yml` 文件
```bash
# 下载配置文件
wget https://raw.githubusercontent.com/shineme/websocksapiboard/main/docker-compose.yml

# 或手动创建（参考项目中的 docker-compose.yml）
```

### 2. 启动服务
```bash
docker-compose up -d
```

### 3. 查看日志
```bash
docker-compose logs -f
```

### 4. 停止服务
```bash
docker-compose down
```

---

## 环境变量配置

您可以通过环境变量自定义配置：

| 环境变量 | 说明 | 默认值 |
|---------|------|--------|
| `PORT` | 服务端口 | `3000` |
| `NODE_ENV` | 运行环境 | `production` |
| `LOGIN_USERNAME` | 登录用户名 | `admin` |
| `LOGIN_PASSWORD` | 登录密码 | `affadsense` |

**示例：自定义登录凭据**
```bash
docker run -d \
  --name task-dispatcher \
  -p 3000:3000 \
  -e LOGIN_USERNAME=myuser \
  -e LOGIN_PASSWORD=securepassword \
  --restart unless-stopped \
  ghcr.io/shineme/websocksapiboard:latest
```

---

## Worker 节点连接

### WebSocket 连接地址
```
ws://YOUR_SERVER_IP:3000/ws?group=YOUR_GROUP_NAME
```

### JavaScript 示例
```javascript
// 连接到任务调度器
const ws = new WebSocket('ws://localhost:3000/ws?group=my-workers');

ws.onopen = () => {
  console.log('✅ 已连接到 TaskOrchard');
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  if (message.type === 'task') {
    console.log('📥 收到任务:', message.taskId);
    
    // 处理任务...
    processTask(message.data);
    
    // 完成后发送响应
    ws.send(JSON.stringify({
      type: 'task_complete',
      taskId: message.taskId,
      result: { success: true },
      duration: 1000
    }));
  }
};

ws.onerror = (error) => {
  console.error('❌ WebSocket 错误:', error);
};

ws.onclose = () => {
  console.log('🔌 连接已断开');
};
```

---

## 分发任务（HTTP API）

### 端点
```
POST http://YOUR_SERVER_IP:3000/api/dispatch
```

### 请求体
```json
{
  "group": "my-workers",
  "priority": "high",
  "payload": {
    "action": "process_data",
    "data": "..."
  }
}
```

### cURL 示例
```bash
curl -X POST http://localhost:3000/api/dispatch \
  -H "Content-Type: application/json" \
  -d '{
    "group": "my-workers",
    "priority": "high",
    "payload": {
      "action": "process_data",
      "input": "Hello TaskOrchard"
    }
  }'
```

---

## 常用命令

### 查看容器状态
```bash
docker ps -a | grep task-dispatcher
```

### 查看实时日志
```bash
docker logs -f task-dispatcher
```

### 重启容器
```bash
docker restart task-dispatcher
```

### 停止并删除容器
```bash
docker stop task-dispatcher
docker rm task-dispatcher
```

### 更新到最新版本
```bash
# 拉取最新镜像
docker pull ghcr.io/shineme/websocksapiboard:latest

# 停止并删除旧容器
docker stop task-dispatcher
docker rm task-dispatcher

# 启动新容器
docker run -d \
  --name task-dispatcher \
  -p 3000:3000 \
  --restart unless-stopped \
  ghcr.io/shineme/websocksapiboard:latest
```

---

## 端口说明

- **3000**: Dashboard Web 界面 + WebSocket 服务 + HTTP API

确保防火墙允许该端口的访问。

---

## 故障排查

### 1. 无法访问 Dashboard
- 检查容器是否运行：`docker ps`
- 查看容器日志：`docker logs task-dispatcher`
- 确认端口未被占用：`netstat -tulpn | grep 3000`

### 2. Worker 无法连接
- 确认 WebSocket URL 格式：`ws://IP:3000/ws?group=GROUP_NAME`
- 检查网络连通性：`telnet YOUR_SERVER_IP 3000`
- 查看服务端日志确认连接请求

### 3. 任务分发失败
- 确认有可用的 Worker 节点
- 检查 `group` 参数是否与 Worker 连接时的一致
- 查看 Dashboard 的 System Logs 标签页获取详细信息

---

## 生产环境建议

1. **使用反向代理（Nginx/Caddy）**
   - 启用 HTTPS
   - 配置域名访问

2. **修改默认密码**
   - 通过环境变量设置强密码

3. **监控与日志**
   - 配置日志收集（如 ELK、Grafana Loki）
   - 设置监控告警

4. **数据持久化**
   - 当前版本使用内存存储
   - 生产环境建议添加数据库支持

5. **高可用部署**
   - 使用 Docker Swarm 或 Kubernetes
   - 配置负载均衡

---

## 支持与反馈

如有问题或建议，请访问项目 GitHub 页面提交 Issue。
