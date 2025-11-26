import { NextResponse } from 'next/server';
import { dispatcher } from '@/lib/services/dispatcher';
import { LogsResponse } from '@/lib/types/dashboard';

export async function GET() {
  try {
    const logs = dispatcher.getRequestLogs();

    const response: LogsResponse = {
      logs: logs.slice(0, 50),
      timestamp: Date.now(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch logs' },
      { status: 500 }
    );
  }
}
