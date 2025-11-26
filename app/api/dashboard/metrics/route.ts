import { NextResponse } from 'next/server';
import { dispatcher } from '@/lib/services/dispatcher';
import { MetricsResponse } from '@/lib/types/dashboard';

export async function GET() {
  try {
    const workers = dispatcher.getWorkers();
    const queue = dispatcher.getTaskQueue();
    
    // 安全地计算忙碌的 workers
    let busyWorkers = 0;
    try {
      busyWorkers = Array.from(workers.values()).filter(w => w && w.busy).length;
    } catch (e) {
      console.warn('Error counting busy workers:', e);
    }
    
    // 安全地计算平均等待时间
    let avgWaitTime = 0;
    try {
      avgWaitTime = dispatcher.calculateAvgWaitTime();
    } catch (e) {
      console.warn('Error calculating avg wait time:', e);
    }

    const response: MetricsResponse = {
      totalWorkers: workers?.size || 0,
      queueLength: queue?.length || 0,
      busyWorkers,
      avgWaitTime,
      timestamp: Date.now(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching metrics:', error);
    // 返回默认值而不是错误
    return NextResponse.json({
      totalWorkers: 0,
      queueLength: 0,
      busyWorkers: 0,
      avgWaitTime: 0,
      timestamp: Date.now(),
    });
  }
}
