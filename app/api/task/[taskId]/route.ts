/**
 * GET /api/task/[taskId] - Task status query endpoint
 * 
 * Returns task status based on current state:
 * - queued: Task waiting in queue
 * - executing: Task being processed by worker
 * - completed: Task finished successfully
 * - failed: Task failed with error
 * 
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */

import { NextRequest, NextResponse } from 'next/server';
import { taskManager } from '@/lib/services/task-manager';

export async function GET(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const { taskId } = params;

    if (!taskId) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
      );
    }

    const status = taskManager.getTaskStatus(taskId);

    if (!status) {
      return NextResponse.json(
        { error: 'Task not found or expired' },
        { status: 404 }
      );
    }

    return NextResponse.json(status);
  } catch (error: any) {
    console.error('Error getting task status:', error);
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500 }
    );
  }
}
