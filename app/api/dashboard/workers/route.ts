import { NextRequest, NextResponse } from 'next/server';
import { dispatcher } from '@/lib/services/dispatcher';
import { WorkersResponse, Worker } from '@/lib/types/dashboard';

function extractIpAddress(ip: string | undefined, request: NextRequest): string {
  // 优先从代理头获取
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  // 回退到已存储的 IP
  return ip || 'unknown';
}

export async function GET(request: NextRequest) {
  try {
    const workers = dispatcher.getWorkers();

    const workerList: Worker[] = [];
    
    if (workers && workers.size > 0) {
      for (const worker of workers.values()) {
        if (worker) {
          workerList.push({
            id: worker.id || 'unknown',
            ip: extractIpAddress(worker.ip, request),
            group: worker.group || 'default',
            status: worker.busy ? 'busy' : 'idle',
            currentTaskId: worker.currentTaskId || null,
            connectedSince: worker.connectedSince || Date.now(),
          });
        }
      }
    }

    const response: WorkersResponse = {
      workers: workerList,
      timestamp: Date.now(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching workers:', error);
    // 返回空列表而不是错误
    return NextResponse.json({
      workers: [],
      timestamp: Date.now(),
    });
  }
}
