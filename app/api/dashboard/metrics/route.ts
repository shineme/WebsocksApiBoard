import { NextResponse } from 'next/server';
import { dispatcher } from '@/lib/services/dispatcher';
import { MetricsResponse } from '@/lib/types/dashboard';

export async function GET() {
  try {
    const workers = dispatcher.getWorkers();
    const queue = dispatcher.getTaskQueue();
    
    const busyWorkers = Array.from(workers.values()).filter(w => w.busy).length;
    const avgWaitTime = dispatcher.calculateAvgWaitTime();

    const response: MetricsResponse = {
      totalWorkers: workers.size,
      queueLength: queue.length,
      busyWorkers,
      avgWaitTime,
      timestamp: Date.now(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}
