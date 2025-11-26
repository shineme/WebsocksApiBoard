import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { workerId, taskId } = await request.json();

    if (!workerId || !taskId) {
      return NextResponse.json(
        { error: 'workerId and taskId are required' },
        { status: 400 }
      );
    }

    // 获取 Worker
    const workers = global.getWorkers?.();
    if (!workers) {
      return NextResponse.json(
        { error: 'Workers not available' },
        { status: 500 }
      );
    }

    const worker = workers.get(workerId);
    if (!worker) {
      return NextResponse.json(
        { error: 'Worker not found' },
        { status: 404 }
      );
    }

    if (worker.busy) {
      return NextResponse.json(
        { error: 'Worker is already busy' },
        { status: 409 }
      );
    }

    // 设置 Worker 为忙碌状态
    worker.busy = true;
    worker.currentTaskId = taskId;

    // 发送任务给 Worker
    if (worker.ws && worker.ws.readyState === 1) {
      worker.ws.send(JSON.stringify({
        type: 'task',
        taskId,
        data: { message: 'Test task from dashboard' }
      }));

      // 记录日志
      if (global.addLog) {
        global.addLog({
          id: `log-${Date.now()}`,
          timestamp: Date.now(),
          method: 'POST',
          path: '/api/dashboard/assign-task',
          status: 200,
          latency: 0,
          requestBody: JSON.stringify({ workerId, taskId }),
          responseBody: JSON.stringify({ success: true }),
          taskId,
        });
      }

      return NextResponse.json({ 
        success: true,
        message: `Task ${taskId} assigned to worker ${workerId}`
      });
    } else {
      return NextResponse.json(
        { error: 'Worker connection is not open' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error assigning task:', error);
    return NextResponse.json(
      { error: 'Failed to assign task' },
      { status: 500 }
    );
  }
}
