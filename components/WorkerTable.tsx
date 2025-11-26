'use client';

import { Worker } from '@/lib/types/dashboard';
import StatusBadge from './StatusBadge';
import DurationDisplay from './DurationDisplay';
import { Send } from 'lucide-react';

interface WorkerTableProps {
  workers: Worker[];
  onAssignTask?: (workerId: string) => void;
  assigningTask?: string | null;
}

export default function WorkerTable({ workers, onAssignTask, assigningTask }: WorkerTableProps) {
  if (workers.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-8 shadow-soft text-center">
        <p className="text-slate-500 text-sm">当前无任何 Worker 在线</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-4 text-left text-sm font-medium text-slate-600">
                Worker ID
              </th>
              <th className="px-6 py-4 text-left text-sm font-medium text-slate-600">
                IP 地址
              </th>
              <th className="px-6 py-4 text-left text-sm font-medium text-slate-600">
                状态
              </th>
              <th className="px-6 py-4 text-left text-sm font-medium text-slate-600">
                当前任务
              </th>
              <th className="px-6 py-4 text-left text-sm font-medium text-slate-600">
                连接时长
              </th>
              {onAssignTask && (
                <th className="px-6 py-4 text-left text-sm font-medium text-slate-600">
                  操作
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {workers.map((worker) => (
              <tr
                key={worker.id}
                className="hover:bg-slate-50/50 transition-smooth"
              >
                <td className="px-6 py-4">
                  <span className="text-sm font-mono text-slate-700" title={worker.id}>
                    {worker.id}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-slate-600">{worker.ip}</span>
                </td>
                <td className="px-6 py-4">
                  <StatusBadge status={worker.status} />
                </td>
                <td className="px-6 py-4">
                  {worker.currentTaskId ? (
                    <span className="text-sm font-mono text-slate-700">
                      {worker.currentTaskId.substring(0, 8)}
                    </span>
                  ) : (
                    <span className="text-sm text-slate-400">无任务</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <DurationDisplay since={worker.connectedSince} />
                </td>
                {onAssignTask && (
                  <td className="px-6 py-4">
                    <button
                      onClick={() => {
                        console.log('🟢 点击分配任务按钮, Worker ID:', worker.id);
                        onAssignTask(worker.id);
                      }}
                      disabled={worker.status === 'busy' || assigningTask === worker.id}
                      className={`
                        flex items-center space-x-1 px-3 py-1 rounded-lg text-sm font-medium
                        transition-smooth
                        ${worker.status === 'busy' || assigningTask === worker.id
                          ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          : 'bg-soft-blue text-white hover:bg-blue-400'
                        }
                      `}
                    >
                      <Send className="w-3 h-3" />
                      <span>
                        {assigningTask === worker.id ? '分配中...' : '分配任务'}
                      </span>
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
