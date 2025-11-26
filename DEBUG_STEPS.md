# 调试步骤

## 🔍 检查"分配任务"按钮是否工作

### 步骤 1: 打开浏览器开发者工具

1. 在管理看板页面按 `F12` 或右键点击 → "检查"
2. 切换到 **Console** (控制台) 标签

### 步骤 2: 连接 Worker

1. 打开 Worker 测试工具: http://localhost:3000/test-worker
2. 点击"连接"按钮
3. 确认看到"WebSocket 连接成功"

### 步骤 3: 查看管理看板

1. 打开管理看板: http://localhost:3000/dashboard
2. 确认在 Worker 状态表格中看到你的 Worker
3. 确认最右侧有"分配任务"按钮

### 步骤 4: 点击"分配任务"按钮

1. 点击 Worker 行最右侧的"分配任务"按钮
2. **立即查看浏览器控制台**

### 步骤 5: 查看控制台输出

你应该看到以下日志（按顺序）：

```
🟢 点击分配任务按钮, Worker ID: worker-xxxxx
🔵 分配任务给 Worker: worker-xxxxx
🔵 任务 ID: task-xxxxx
🔵 API 响应状态: 200
✅ 任务分配成功: {success: true, message: "..."}
```

### 可能的错误情况

#### 情况 1: 没有任何日志输出

**原因**: 按钮点击事件没有触发

**检查**:
- 按钮是否可见？
- 按钮是否被禁用（灰色）？
- 是否有 JavaScript 错误？

#### 情况 2: 看到 🟢 但没有 🔵

**原因**: `onAssignTask` 函数没有被正确传递

**检查**:
- 刷新页面重试
- 检查是否有 TypeScript 错误

#### 情况 3: 看到 🔴 API 错误: 404

**原因**: API 路由没有被正确编译

**解决**:
```bash
# 停止服务器 (Ctrl+C)
# 删除编译缓存
Remove-Item -Recurse -Force .next
# 重启服务器
npm run dev
```

#### 情况 4: 看到 🔴 Worker not found

**原因**: Worker ID 不匹配

**检查**:
- Worker 是否还在连接状态？
- 在 Worker 测试工具中确认连接状态

#### 情况 5: 看到 🔴 Worker connection is not open

**原因**: WebSocket 连接已断开

**解决**:
- 在 Worker 测试工具中重新连接

## 🧪 手动测试 API

如果按钮不工作，可以手动测试 API：

### 1. 获取 Worker ID

在浏览器控制台中运行：

```javascript
fetch('http://localhost:3000/api/dashboard/workers')
  .then(r => r.json())
  .then(data => {
    console.log('Workers:', data.workers);
    if (data.workers.length > 0) {
      console.log('第一个 Worker ID:', data.workers[0].id);
    }
  });
```

### 2. 手动分配任务

复制上面得到的 Worker ID，然后运行：

```javascript
fetch('http://localhost:3000/api/dashboard/assign-task', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    workerId: 'worker-xxxxx',  // 替换为实际的 Worker ID
    taskId: 'test-task-123'
  })
})
  .then(r => r.json())
  .then(data => console.log('结果:', data))
  .catch(err => console.error('错误:', err));
```

### 3. 检查 Worker 状态

```javascript
fetch('http://localhost:3000/api/dashboard/workers')
  .then(r => r.json())
  .then(data => {
    const worker = data.workers.find(w => w.id === 'worker-xxxxx');
    console.log('Worker 状态:', worker);
    console.log('是否忙碌:', worker.status === 'busy');
    console.log('当前任务:', worker.currentTaskId);
  });
```

## 📋 检查清单

完成以下检查：

- [ ] 服务器正在运行 (http://localhost:3000)
- [ ] Worker 已连接 (在 /test-worker 页面)
- [ ] 管理看板显示 Worker (在 /dashboard 页面)
- [ ] "分配任务"按钮可见
- [ ] "分配任务"按钮不是灰色（未禁用）
- [ ] 浏览器控制台已打开
- [ ] 点击按钮后有日志输出
- [ ] 没有红色错误信息

## 🆘 如果还是不工作

请提供以下信息：

1. **浏览器控制台的完整输出**（截图或复制文本）
2. **服务器终端的输出**（最后 20 行）
3. **Worker 测试工具的日志**（截图）
4. **管理看板的截图**（显示 Worker 表格）

这样我就能准确定位问题所在！
