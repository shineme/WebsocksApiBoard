import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        // 1. 从请求体中解析 group 和任务数据
        const body = await request.json();
        const { group, data } = body;

        // 默认为 'default' 组
        const targetGroup = group || 'default';
        const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        if (!data) {
            return NextResponse.json(
                { error: 'Task data is required' },
                { status: 400 }
            );
        }

        // 2. 获取所有在线 Worker
        const workersMap = global.getWorkers?.();
        if (!workersMap) {
            return NextResponse.json(
                { error: 'System not ready (no workers map)' },
                { status: 503 }
            );
        }

        // 3. 筛选出目标组且空闲的 Worker
        // 注意：这里假设 worker 对象上有 group 属性 (我们在 server.js 中添加过)
        const availableWorkers = Array.from(workersMap.values()).filter((worker: any) => {
            const workerGroup = worker.group || 'default';
            return workerGroup === targetGroup && !worker.busy && worker.ws.readyState === 1;
        });

        if (availableWorkers.length === 0) {
            return NextResponse.json(
                {
                    error: `No idle workers found for group: ${targetGroup}`,
                    totalInGroup: Array.from(workersMap.values()).filter((w: any) => (w.group || 'default') === targetGroup).length
                },
                { status: 404 }
            );
        }

        // 4. 负载均衡策略：随机选择一个 (也可以改为轮询等)
        const selectedWorker = availableWorkers[Math.floor(Math.random() * availableWorkers.length)];

        // 5. 标记为忙碌并发送任务
        selectedWorker.busy = true;
        selectedWorker.currentTaskId = taskId;

        selectedWorker.ws.send(JSON.stringify({
            type: 'task',
            taskId,
            data
        }));

        // 6. 记录日志
        if (global.addLog) {
            global.addLog({
                id: `log-${Date.now()}`,
                timestamp: Date.now(),
                method: 'POST',
                path: '/api/dispatch',
                status: 200,
                latency: 0,
                requestBody: JSON.stringify({ group: targetGroup, data }),
                responseBody: JSON.stringify({ success: true, workerId: selectedWorker.id }),
                taskId,
            });
        }

        return NextResponse.json({
            success: true,
            message: 'Task dispatched successfully',
            taskId,
            workerId: selectedWorker.id,
            group: targetGroup
        });

    } catch (error: any) {
        console.error('Error dispatching task:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
