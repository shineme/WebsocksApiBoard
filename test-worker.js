// WebSocket Worker 测试客户端
// 使用方法: node test-worker.js [group_name]

const WebSocket = require('ws');

// 从命令行参数获取 group 名称，默认为 'test-group'
const group = process.argv[2] || 'test-group';
const serverUrl = process.argv[3] || 'ws://localhost:3000';

const ws = new WebSocket(`${serverUrl}/ws?group=${group}`);

ws.on('open', () => {
    console.log('✅ 已连接到 TaskOrchard');
    console.log(`📦 Worker Group: ${group}`);
    console.log('');

    // 发送就绪状态
    setTimeout(() => {
        ws.send(JSON.stringify({ type: 'ready' }));
        console.log('📤 发送就绪状态');
    }, 1000);
});

ws.on('message', (data) => {
    try {
        const message = JSON.parse(data.toString());
        console.log('\n📥 收到消息:', message.type);

        switch (message.type) {
            case 'connected':
                console.log(`🎉 Worker ID: ${message.workerId}`);
                console.log(`💬 消息: ${message.message}`);
                break;

            case 'task':
                console.log(`📋 任务 ID: ${message.taskId}`);
                console.log('📄 任务数据:', JSON.stringify(message.data, null, 2));

                // 模拟任务处理
                console.log('⏳ 处理任务中...');
                setTimeout(() => {
                    ws.send(JSON.stringify({
                        type: 'task_complete',
                        taskId: message.taskId,
                        result: { success: true, processed: true },
                        duration: 1500
                    }));
                    console.log('✅ 任务完成，已发送响应');
                }, 1500);
                break;

            case 'pong':
                console.log('💓 心跳响应');
                break;

            default:
                console.log('❓ 未知消息类型:', message);
        }
    } catch (error) {
        console.error('❌ 解析消息失败:', error);
    }
});

ws.on('error', (error) => {
    console.error('❌ WebSocket 错误:', error.message);
});

ws.on('close', () => {
    console.log('\n🔌 连接已断开');
    process.exit(0);
});

// 定期发送心跳
setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
    }
}, 25000);

// 监听进程退出
process.on('SIGINT', () => {
    console.log('\n👋 正在关闭连接...');
    ws.close();
});

console.log(`🔌 正在连接到 ${serverUrl}/ws?group=${group}...`);
