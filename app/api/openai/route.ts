/**
 * POST /api/openai - Task submission endpoint
 * 
 * Supports both synchronous and asynchronous modes:
 * - Sync mode (default): Waits for worker to complete and returns result
 * - Async mode (async: true): Returns taskId immediately for polling
 * 
 * Requirements: 1.1, 4.1, 4.2, 9.1
 */

import { NextRequest, NextResponse } from 'next/server';
import { taskManager } from '@/lib/services/task-manager';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { model, messages, data, group, timeout, async: isAsync } = body;

    // Validate request - need at least some data
    if (!data && !messages) {
      return NextResponse.json(
        { error: 'Invalid request: data or messages required' },
        { status: 400 }
      );
    }

    // Build payload
    const payload = {
      model: model || 'default',
      messages,
      data,
    };

    // Submit task
    const result = await taskManager.submitTask(payload, {
      group,
      timeout,
      async: isAsync,
    });

    // Log the request
    if (typeof global.addLog === 'function') {
      global.addLog({
        id: `log-${Date.now()}`,
        timestamp: Date.now(),
        method: 'POST',
        path: '/api/openai',
        status: 200,
        latency: 0,
        requestBody: JSON.stringify(body),
        responseBody: JSON.stringify(result),
        taskId: result.taskId,
      });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    const errorMessage = error.message || 'Internal error';
    
    // Determine HTTP status based on error type
    let status = 500;
    if (errorMessage === 'No worker available' || errorMessage === 'Queue is full') {
      status = 503;
    }

    // Log the error
    if (typeof global.addLog === 'function') {
      global.addLog({
        id: `log-${Date.now()}`,
        timestamp: Date.now(),
        method: 'POST',
        path: '/api/openai',
        status,
        latency: 0,
        requestBody: '',
        responseBody: JSON.stringify({ error: errorMessage }),
      });
    }

    return NextResponse.json({ error: errorMessage }, { status });
  }
}
