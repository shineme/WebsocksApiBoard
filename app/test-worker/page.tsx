'use client';

import { useState, useRef, useEffect } from 'react';
import { Wifi, WifiOff, Send, Trash2, CheckCircle, XCircle } from 'lucide-react';

interface LogEntry {
  timestamp: number;
  type: 'info' | 'success' | 'error' | 'sent' | 'received';
  message: string;
}

export default function TestWorkerPage() {
  const [wsUrl, setWsUrl] = useState('ws://localhost:3000/ws');
  const [connected, setConnected] = useState(false);
  const [workerId, setWorkerId] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [taskData, setTaskData] = useState('{"prompt": "Hello, World!"}');
  const [autoReady, setAutoReady] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const addLog = (type: LogEntry['type'], message: string) => {
    setLogs(prev => [...prev, { timestamp: Date.now(), type, message }]);
  };

  const connect = () => {
    if (wsRef.current) {
      addLog('error', '已经连接，请先断开');
      return;
    }

    try {
      addLog('info', `正在连接到 ${wsUrl}...`);
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setConnected(true);
        addLog('success', '✓ WebSocket 连接成功');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          addLog('received', `← 收到: ${JSON.stringify(data, null, 2)}`);

          if (data.type === 'connected') {
            setWorkerId(data.workerId);
            addLog('info', `Worker ID: ${data.workerId}`);
            
            // 自动发送 ready 消息
            if (autoReady) {
              setTimeout(() => {
                sendReady();
              }, 500);
            }
          } else if (data.type === 'task') {
            addLog('info', `📋 收到任务: ${data.taskId}`);
            addLog('success', '⚙️ Worker 状态变为：忙碌中');
            
            // 模拟任务处理
            setTimeout(() => {
              sendTaskComplete(data.taskId, { result: 'Task completed successfully' });
              addLog('success', '✓ Worker 状态变为：空闲');
            }, 2000);
          }
        } catch (error) {
          addLog('received', `← 收到: ${event.data}`);
        }
      };

      ws.onerror = (error) => {
        addLog('error', `✗ WebSocket 错误: ${error}`);
      };

      ws.onclose = () => {
        setConnected(false);
        setWorkerId('');
        addLog('info', '✗ WebSocket 连接已关闭');
        wsRef.current = null;
      };

      wsRef.current = ws;
    } catch (error) {
      addLog('error', `连接失败: ${error}`);
    }
  };

  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      setConnected(false);
      setWorkerId('');
      addLog('info', '主动断开连接');
    }
  };

  const sendMessage = (message: any) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      addLog('error', '未连接到服务器');
      return;
    }

    const messageStr = JSON.stringify(message);
    wsRef.current.send(messageStr);
    addLog('sent', `→ 发送: ${JSON.stringify(message, null, 2)}`);
  };

  const sendReady = () => {
    sendMessage({ type: 'ready' });
  };

  const sendTaskComplete = (taskId: string, result: any) => {
    sendMessage({
      type: 'task_complete',
      taskId,
      result,
      duration: 2000
    });
  };

  const sendTaskError = (taskId: string, error: string) => {
    sendMessage({
      type: 'task_error',
      taskId,
      error,
      duration: 1000
    });
  };

  const sendCustomMessage = () => {
    try {
      const data = JSON.parse(taskData);
      sendMessage(data);
    } catch (error) {
      addLog('error', `JSON 格式错误: ${error}`);
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const getLogColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'success': return 'text-green-600';
      case 'error': return 'text-red-600';
      case 'sent': return 'text-blue-600';
      case 'received': return 'text-purple-600';
      default: return 'text-slate-600';
    }
  };

  const getLogIcon = (type: LogEntry['type']) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-4 h-4" />;
      case 'error': return <XCircle className="w-4 h-4" />;
      case 'sent': return <Send className="w-4 h-4" />;
      case 'received': return <Send className="w-4 h-4 rotate-180" />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-emerald-50/20 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">
            Worker 连接测试工具
          </h1>
          <p className="text-sm text-slate-500">
            测试 WebSocket 连接和任务调度功能
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左侧：连接控制 */}
          <div className="space-y-6">
            {/* 连接配置 */}
            <div className="bg-white rounded-2xl p-6 shadow-soft">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">
                连接配置
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    WebSocket URL
                  </label>
                  <input
                    type="text"
                    value={wsUrl}
                    onChange={(e) => setWsUrl(e.target.value)}
                    disabled={connected}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-soft-blue focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed"
                    placeholder="ws://localhost:3000/ws"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="autoReady"
                    checked={autoReady}
                    onChange={(e) => setAutoReady(e.target.checked)}
                    className="w-4 h-4 text-soft-blue rounded focus:ring-soft-blue"
                  />
                  <label htmlFor="autoReady" className="text-sm text-slate-700">
                    连接后自动发送 ready 消息
                  </label>
                </div>

                <div className="flex space-x-3">
                  {!connected ? (
                    <button
                      onClick={connect}
                      className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-soft-blue text-white rounded-lg hover:bg-blue-400 transition-smooth"
                    >
                      <Wifi className="w-4 h-4" />
                      <span>连接</span>
                    </button>
                  ) : (
                    <button
                      onClick={disconnect}
                      className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-red-400 text-white rounded-lg hover:bg-red-500 transition-smooth"
                    >
                      <WifiOff className="w-4 h-4" />
                      <span>断开</span>
                    </button>
                  )}
                </div>

                {workerId && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-700">
                      <span className="font-medium">Worker ID:</span> {workerId}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* 快速操作 */}
            <div className="bg-white rounded-2xl p-6 shadow-soft">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">
                快速操作
              </h2>
              
              <div className="space-y-3">
                <button
                  onClick={sendReady}
                  disabled={!connected}
                  className="w-full px-4 py-2 bg-mint-green text-slate-800 rounded-lg hover:bg-emerald-400 transition-smooth disabled:bg-slate-200 disabled:cursor-not-allowed"
                >
                  发送 Ready 消息
                </button>

                <button
                  onClick={() => sendTaskComplete('test-task-123', { result: 'Success' })}
                  disabled={!connected}
                  className="w-full px-4 py-2 bg-peach text-slate-800 rounded-lg hover:bg-orange-400 transition-smooth disabled:bg-slate-200 disabled:cursor-not-allowed"
                >
                  模拟任务完成
                </button>

                <button
                  onClick={() => sendTaskError('test-task-123', 'Simulated error')}
                  disabled={!connected}
                  className="w-full px-4 py-2 bg-red-300 text-slate-800 rounded-lg hover:bg-red-400 transition-smooth disabled:bg-slate-200 disabled:cursor-not-allowed"
                >
                  模拟任务失败
                </button>
              </div>
            </div>

            {/* 自定义消息 */}
            <div className="bg-white rounded-2xl p-6 shadow-soft">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">
                自定义消息
              </h2>
              
              <div className="space-y-3">
                <textarea
                  value={taskData}
                  onChange={(e) => setTaskData(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-soft-blue focus:border-transparent font-mono text-sm"
                  rows={6}
                  placeholder='{"type": "custom", "data": "..."}'
                />
                
                <button
                  onClick={sendCustomMessage}
                  disabled={!connected}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-lavender text-slate-800 rounded-lg hover:bg-violet-400 transition-smooth disabled:bg-slate-200 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                  <span>发送自定义消息</span>
                </button>
              </div>
            </div>
          </div>

          {/* 右侧：日志 */}
          <div className="bg-white rounded-2xl p-6 shadow-soft">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800">
                连接日志
              </h2>
              <button
                onClick={clearLogs}
                className="flex items-center space-x-1 px-3 py-1 text-sm text-slate-600 hover:text-slate-800 transition-smooth"
              >
                <Trash2 className="w-4 h-4" />
                <span>清空</span>
              </button>
            </div>

            <div className="h-[600px] overflow-y-auto bg-slate-50 rounded-lg p-4 space-y-2 font-mono text-xs">
              {logs.length === 0 ? (
                <p className="text-slate-400 text-center py-8">
                  暂无日志...
                </p>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="flex items-start space-x-2">
                    <span className="text-slate-400 shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <div className={`flex items-start space-x-1 ${getLogColor(log.type)}`}>
                      {getLogIcon(log.type)}
                      <pre className="whitespace-pre-wrap break-all">
                        {log.message}
                      </pre>
                    </div>
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>

        {/* 使用说明 */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">
            使用说明
          </h3>
          <div className="space-y-2 text-sm text-blue-800">
            <p>1. 输入 WebSocket URL（默认：ws://localhost:3000/ws）</p>
            <p>2. 点击"连接"按钮建立 WebSocket 连接</p>
            <p>3. 连接成功后会自动收到 Worker ID</p>
            <p>4. 使用快速操作按钮测试不同的消息类型</p>
            <p>5. 或在自定义消息框中输入 JSON 格式的消息</p>
            <p>6. 查看右侧日志了解连接状态和消息交互</p>
            <p className="mt-3 font-medium">💡 提示：打开管理看板（/dashboard）可以实时查看 Worker 状态</p>
          </div>
        </div>
      </div>
    </div>
  );
}
