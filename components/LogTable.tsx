'use client';

import { useState } from 'react';
import { RequestLog } from '@/lib/types/dashboard';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface LogTableProps {
  logs: RequestLog[];
}

export default function LogTable({ logs }: LogTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (logs.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-8 shadow-soft text-center">
        <p className="text-slate-500 text-sm">正在等待新的请求日志...</p>
      </div>
    );
  }

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getStatusColor = (status: number) => {
    if (status >= 500) return 'bg-red-50';
    if (status >= 400) return 'bg-yellow-50';
    return '';
  };

  const getLatencyColor = (latency: number) => {
    if (latency > 1500) return 'text-red-600 font-bold';
    if (latency > 500) return 'text-amber-600';
    return 'text-slate-600';
  };

  const formatJson = (jsonString: string) => {
    try {
      const parsed = JSON.parse(jsonString);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return jsonString;
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-4 text-left text-sm font-medium text-slate-600 w-8"></th>
              <th className="px-6 py-4 text-left text-sm font-medium text-slate-600">
                时间
              </th>
              <th className="px-6 py-4 text-left text-sm font-medium text-slate-600">
                方法
              </th>
              <th className="px-6 py-4 text-left text-sm font-medium text-slate-600">
                路径
              </th>
              <th className="px-6 py-4 text-left text-sm font-medium text-slate-600">
                状态码
              </th>
              <th className="px-6 py-4 text-left text-sm font-medium text-slate-600">
                延迟
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.map((log) => (
              <>
                <tr
                  key={log.id}
                  onClick={() => toggleExpand(log.id)}
                  className={`
                    cursor-pointer hover:bg-slate-50/50 transition-smooth
                    ${getStatusColor(log.status)}
                  `}
                >
                  <td className="px-6 py-4">
                    {expandedId === log.id ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-600">
                      {formatTime(log.timestamp)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-slate-700">
                      {log.method}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-mono text-slate-600">
                      {log.path}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-slate-700">
                      {log.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-sm ${getLatencyColor(log.latency)}`}>
                      {log.latency}ms
                    </span>
                  </td>
                </tr>
                {expandedId === log.id && (
                  <tr className="bg-slate-50/30">
                    <td colSpan={6} className="px-6 py-4">
                      <div className="space-y-4">
                        {log.taskId && (
                          <div>
                            <p className="text-sm font-medium text-slate-700 mb-1">
                              任务 ID
                            </p>
                            <pre className="text-xs font-mono text-slate-600 bg-white p-3 rounded-lg border border-slate-200">
                              {log.taskId}
                            </pre>
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-slate-700 mb-1">
                            请求体
                          </p>
                          <pre className="text-xs font-mono text-slate-600 bg-white p-3 rounded-lg border border-slate-200 overflow-x-auto max-h-64 overflow-y-auto">
                            {formatJson(log.requestBody)}
                          </pre>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-700 mb-1">
                            响应体
                          </p>
                          <pre className="text-xs font-mono text-slate-600 bg-white p-3 rounded-lg border border-slate-200 overflow-x-auto max-h-64 overflow-y-auto">
                            {formatJson(log.responseBody)}
                          </pre>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
