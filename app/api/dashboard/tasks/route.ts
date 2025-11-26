/**
 * GET /api/dashboard/tasks - Get task queue and executing tasks info
 */

import { NextResponse } from 'next/server';
import { taskManager } from '@/lib/services/task-manager';

export async function GET() {
  try {
    const taskQueue = taskManager.getTaskQueue();
    const executingTasks = taskManager.getExecutingTasks();
    const queueLength = taskManager.getQueueLength();

    // Get queue tasks with position and payload
    const queuedTasks = taskQueue.map((task, index) => ({
      taskId: task.taskId,
      type: task.type,
      group: task.group,
      enqueuedAt: task.enqueuedAt,
      timeout: task.timeout,
      async: task.async,
      position: index + 1,
      waitTime: Date.now() - task.enqueuedAt,
      payload: task.payload,
    }));

    // Get executing tasks with payload
    const executing = executingTasks.map(task => ({
      taskId: task.taskId,
      workerId: task.workerId,
      startedAt: task.startedAt,
      executionTime: Date.now() - task.startedAt,
      payload: task.payload,
    }));

    return NextResponse.json({
      queueLength,
      pendingCount: executingTasks.length,
      tasks: queuedTasks,
      executingTasks: executing,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500 }
    );
  }
}
