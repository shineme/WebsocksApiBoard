'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Sun, Cloud, Leaf, Feather, Clock, Zap, Home, ScrollText, Heart, Compass, LogOut, PlayCircle, ChevronDown, ChevronUp, Terminal, Copy, Check } from 'lucide-react';
import { DashboardMetrics, Worker, RequestLog } from '@/lib/types/dashboard';

export default function DashboardPage() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'logs'>('dashboard');
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [assigningTask, setAssigningTask] = useState<string | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');

  // 检查认证状态
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/verify');
        const data = await response.json();

        if (data.authenticated) {
          setAuthenticated(true);
        } else {
          router.push('/login');
        }
      } catch (err) {
        router.push('/login');
      } finally {
        setChecking(false);
      }
    };

    checkAuth();
  }, [router]);

  // 更新当前时间
  useEffect(() => {
    setCurrentTime(new Date().toLocaleTimeString('en-US', { hour12: false }));
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('en-US', { hour12: false }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 登出
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  // 获取 metrics 和 workers
  const fetchMetricsAndWorkers = useCallback(async () => {
    try {
      const [metricsRes, workersRes] = await Promise.all([
        fetch('/api/dashboard/metrics'),
        fetch('/api/dashboard/workers'),
      ]);

      if (!metricsRes.ok || !workersRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const metricsData = await metricsRes.json();
      const workersData = await workersRes.json();

      setMetrics(metricsData);
      setWorkers(workersData.workers);
      setLastUpdate(new Date().toLocaleTimeString('zh-CN'));
      setError('');
    } catch (err) {
      console.error('Error fetching metrics/workers:', err);
      setError('无法连接到服务器，请稍后重试');
    }
  }, []);

  // 获取 logs
  const fetchLogs = useCallback(async () => {
    try {
      const response = await fetch('/api/dashboard/logs');

      if (!response.ok) {
        throw new Error('Failed to fetch logs');
      }

      const data = await response.json();
      setLogs(data.logs);
      setError('');
    } catch (err) {
      console.error('Error fetching logs:', err);
    }
  }, []);

  // 每 3 秒刷新 metrics 和 workers
  useEffect(() => {
    if (!authenticated) return;
    fetchMetricsAndWorkers();
    const interval = setInterval(fetchMetricsAndWorkers, 3000);
    return () => clearInterval(interval);
  }, [authenticated, fetchMetricsAndWorkers]);

  // 每 1.5 秒刷新 logs
  useEffect(() => {
    if (!authenticated) return;
    fetchLogs();
    const interval = setInterval(fetchLogs, 1500);
    return () => clearInterval(interval);
  }, [authenticated, fetchLogs]);

  // 分配任务给 Worker
  const assignTask = async (workerId: string) => {
    setAssigningTask(workerId);
    try {
      const taskId = `task-${Date.now()}`;

      const response = await fetch('/api/dashboard/assign-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workerId, taskId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to assign task');
      }

      // 立即刷新数据
      await fetchMetricsAndWorkers();
    } catch (err: any) {
      console.error('🔴 分配任务失败:', err);
      setError(err.message || '分配任务失败');
      setTimeout(() => setError(''), 3000);
    } finally {
      setAssigningTask(null);
    }
  };

  // 显示加载状态
  if (checking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 to-green-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-green-700">验证中...</p>
        </div>
      </div>
    );
  }

  // 未认证时不显示内容（会被重定向）
  if (!authenticated) {
    return null;
  }

  const busyCount = metrics?.busyWorkers ?? 0;
  const totalCount = metrics?.totalWorkers ?? 0;
  const queueLength = metrics?.queueLength ?? 0;
  const avgWait = metrics?.avgWaitTime ?? 0;

  // 获取所有唯一的 groups
  const groups = ['all', ...Array.from(new Set(workers.map(w => w.group || 'default')))];

  const filteredWorkers = selectedGroup === 'all'
    ? workers
    : workers.filter(w => (w.group || 'default') === selectedGroup);

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-green-100 text-gray-700 font-sans selection:bg-yellow-200/50 overflow-x-hidden relative">
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-float { animation: float 6s ease-in-out infinite; }

        @keyframes spring-bounce {
          0% { transform: scaleY(0); opacity: 0; }
          40% { transform: scaleY(1.1); opacity: 1; }
          60% { transform: scaleY(0.95); }
          80% { transform: scaleY(1.02); }
          100% { transform: scaleY(1); }
        }
        .animate-spring-bounce { animation: spring-bounce 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
      `}</style>

      {/* Background Decorations */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-yellow-200/30 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-green-200/30 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-6 max-w-7xl">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-center mb-8 bg-white/40 backdrop-blur-md p-6 rounded-3xl border border-white/50 shadow-xl">
          <div className="flex items-center space-x-4 mb-4 md:mb-0">
            <div className="bg-gradient-to-br from-green-400 to-emerald-600 p-3 rounded-2xl shadow-lg shadow-green-200">
              <Leaf className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-gray-800">
                任务<span className="text-green-600">果园</span>
              </h1>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                系统监控
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-6 bg-white/50 px-6 py-2 rounded-full border border-white/60 shadow-inner">
            <div className="flex items-center text-gray-600 font-medium">
              <Clock className="w-4 h-4 mr-2 text-green-600" />
              <span className="tabular-nums tracking-wider">{currentTime}</span>
            </div>
            <div className="h-4 w-px bg-gray-300"></div>
            <button
              onClick={handleLogout}
              className="flex items-center text-gray-500 hover:text-red-500 transition-colors text-sm font-bold group"
            >
              <LogOut className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
              退出
            </button>
          </div>
        </header>

        {/* Navigation Tabs */}
        <div className="flex justify-center mb-10 space-x-6">
          <TabButton
            label="仪表盘"
            icon={Home}
            active={activeTab === 'dashboard'}
            onClick={() => setActiveTab('dashboard')}
            color="green"
          />
          <TabButton
            label="系统日志"
            icon={ScrollText}
            active={activeTab === 'logs'}
            onClick={() => setActiveTab('logs')}
            color="yellow"
          />
        </div>

        {/* Main Content */}
        <main>
          {activeTab === 'dashboard' ? (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard
                  title="活跃节点"
                  value={`${busyCount}/${totalCount}`}
                  icon={Zap}
                  color="indigo"
                  progress={totalCount > 0 ? (busyCount / totalCount) * 100 : 0}
                  unit="个"
                />
                <MetricCard
                  title="队列深度"
                  value={queueLength}
                  icon={Cloud}
                  color="sky"
                  progress={Math.min(queueLength * 10, 100)}
                  unit="个任务"
                />
                <MetricCard
                  title="平均等待"
                  value={avgWait}
                  icon={Clock}
                  color="orange"
                  progress={Math.min(avgWait / 100, 100)}
                  unit="毫秒"
                />
                <MetricCard
                  title="系统健康"
                  value="100"
                  icon={Heart}
                  color="green"
                  progress={100}
                  unit="%"
                />
              </div>

              {/* Workers Section */}
              <div className="bg-white/40 backdrop-blur-md rounded-3xl p-8 border border-white/50 shadow-xl">
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-xl font-black text-gray-800 flex items-center">
                    <Compass className="w-6 h-6 mr-3 text-green-600" />
                    工作节点
                  </h2>

                  {/* Group Filter */}
                  <div className="flex space-x-2">
                    {groups.map(g => (
                      <button
                        key={g}
                        onClick={() => setSelectedGroup(g)}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${selectedGroup === g
                          ? 'bg-green-500 text-white shadow-lg shadow-green-200'
                          : 'bg-white/60 text-gray-500 hover:bg-white'
                          }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filteredWorkers.map((worker) => (
                    <div
                      key={worker.id}
                      className="group bg-white/70 hover:bg-white transition-all duration-300 rounded-2xl p-6 border border-white/60 shadow-sm hover:shadow-xl hover:-translate-y-1 relative overflow-hidden"
                    >
                      <div className={`absolute top-0 left-0 w-1 h-full ${worker.status === 'busy' ? 'bg-orange-400' : 'bg-green-400'}`}></div>

                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="font-bold text-gray-800 text-lg">{worker.id}</h3>
                          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mt-1">
                            {worker.group || '默认分组'}
                          </p>
                        </div>
                        <StatusBadge status={worker.status} />
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">当前任务</span>
                          <span className="font-mono font-medium text-gray-700 truncate max-w-[120px]" title={worker.currentTaskId || '空闲'}>
                            {worker.currentTaskId || '-'}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">运行时长</span>
                          <span className="font-mono font-medium text-gray-700">
                            <Duration since={worker.connectedSince} />
                          </span>
                        </div>
                      </div>

                      {worker.status === 'idle' && (
                        <button
                          onClick={() => assignTask(worker.id)}
                          disabled={!!assigningTask}
                          className="mt-6 w-full py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-xl font-bold text-sm transition-colors flex items-center justify-center group-hover:shadow-md"
                        >
                          {assigningTask === worker.id ? (
                            <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <>
                              <PlayCircle className="w-4 h-4 mr-2" />
                              分配任务
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* API Documentation Section */}
              <ApiDocumentation />
            </div>
          ) : (
            <div className="bg-white/60 backdrop-blur-xl rounded-3xl p-6 shadow-xl border border-white/60 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-black text-gray-800 flex items-center">
                  <Terminal className="w-6 h-6 mr-3 text-yellow-600" />
                  系统日志
                </h2>
                <button
                  onClick={fetchLogs}
                  className="p-2 hover:bg-white/50 rounded-full transition-colors text-gray-500"
                >
                  <Clock className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="bg-white/50 rounded-xl border border-white/60 overflow-hidden hover:shadow-md transition-shadow"
                  >
                    <div
                      className="p-4 flex items-center justify-between cursor-pointer"
                      onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                    >
                      <div className="flex items-center space-x-4">
                        <div className={`w-2 h-2 rounded-full ${log.status >= 200 && log.status < 300 ? 'bg-green-500' :
                          log.status >= 400 ? 'bg-red-500' : 'bg-blue-500'
                          }`} />
                        <span className="font-mono text-sm text-gray-600">{new Date(log.timestamp).toLocaleTimeString()}</span>
                        <span className="font-bold text-gray-800">{log.method} {log.path}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${log.status >= 200 && log.status < 300 ? 'bg-green-100 text-green-700' :
                          log.status >= 400 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                          {log.status}
                        </span>
                      </div>
                      {expandedLogId === log.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>

                    {expandedLogId === log.id && (
                      <div className="px-4 pb-4 bg-gray-50/50 border-t border-gray-100">
                        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="block text-xs font-bold text-gray-400 uppercase mb-1">耗时</span>
                            <span className="font-mono text-gray-700">{log.latency}毫秒</span>
                          </div>
                          <div>
                            <span className="block text-xs font-bold text-gray-400 uppercase mb-1">请求内容</span>
                            <span className="font-mono text-gray-700 truncate block" title={log.requestBody}>{log.requestBody || '-'}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {logs.length === 0 && (
                  <div className="text-center py-12 text-gray-400">
                    <ScrollText className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>暂无日志</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

interface TabButtonProps {
  label: string;
  icon: React.ElementType;
  active: boolean;
  onClick: () => void;
  color: 'green' | 'yellow';
}

// --- 子组件：导航按钮 (TabButton) ---
function TabButton({ label, icon: Icon, active, onClick, color }: TabButtonProps) {
  const activeClasses: Record<string, string> = {
    green: 'bg-green-200/60 border-green-400 text-green-800 shadow-lg shadow-green-200/50',
    yellow: 'bg-yellow-200/60 border-yellow-400 text-yellow-800 shadow-lg shadow-yellow-200/50',
  };
  const defaultClasses = 'bg-white/70 border-gray-300 text-gray-600 hover:bg-white hover:shadow-md';
  return (
    <button
      onClick={onClick}
      className={`flex items-center px-6 py-3 rounded-full text-sm font-bold tracking-wider transition-all duration-300 border-2 ${active ? activeClasses[color] : defaultClasses
        }`}
    >
      <Icon className="w-4 h-4 mr-2" />
      {label}
    </button>
  );
}

interface MetricCardProps {
  title: string;
  value: number | string;
  icon?: React.ElementType;
  color: 'indigo' | 'sky' | 'green' | 'orange';
  progress?: number;
  unit?: string;
}

// --- 子组件：指标卡片 (MetricCard) ---
function MetricCard({ title, value, icon: Icon, color, progress, unit }: MetricCardProps) {
  const colorClasses: Record<string, { text: string; border: string; bg: string; shadow: string }> = {
    indigo: { text: 'text-indigo-600', border: 'border-indigo-400', bg: 'bg-indigo-300/60', shadow: 'shadow-indigo-300/40' },
    sky: { text: 'text-sky-600', border: 'border-sky-400', bg: 'bg-sky-300/60', shadow: 'shadow-sky-300/40' },
    green: { text: 'text-green-600', border: 'border-green-400', bg: 'bg-green-300/60', shadow: 'shadow-green-300/40' },
    orange: { text: 'text-orange-600', border: 'border-orange-400', bg: 'bg-orange-300/60', shadow: 'shadow-orange-300/40' },
  };
  const c = colorClasses[color] || colorClasses.indigo;
  return (
    <div className={`metric-card p-6 rounded-2xl border-l-4 ${c.border} ${c.text}`}>
      <div className="flex justify-between items-start mb-2">
        <p className={`text-xs font-bold uppercase tracking-widest flex items-center ${c.text}`}>
          {Icon && <Icon className="w-5 h-5 mr-2" />}
          {title}
        </p>
      </div>
      <p className="text-5xl font-black text-gray-800 drop-shadow-sm font-sans tracking-tight flex items-baseline">
        {value}
        <span className="text-xl ml-1 font-semibold opacity-70">{unit}</span>
      </p>
      <div className="w-full bg-gray-200 h-1.5 mt-4 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${c.bg} ${c.shadow}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// --- 子组件：状态徽章 (StatusBadge) ---
function StatusBadge({ status }: { status: string }) {
  const isBusy = status === 'busy';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wide border ${isBusy
      ? 'bg-orange-100 text-orange-600 border-orange-300 shadow-sm'
      : 'bg-green-100 text-green-600 border-green-300 shadow-sm'
      }`}>
      <span className="relative flex h-2 w-2 mr-2">
        <span className={`animate-pulse absolute inline-flex h-full w-full rounded-full opacity-75 ${isBusy ? 'bg-orange-400' : 'bg-green-400'}`}></span>
        <span className={`relative inline-flex rounded-full h-2 w-2 ${isBusy ? 'bg-orange-500' : 'bg-green-500'}`}></span>
      </span>
      {isBusy ? '忙碌中' : '休息中'}
    </span>
  );
}

// --- 子组件：API 文档 (ApiDocumentation) ---
function ApiDocumentation() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'http' | 'ws'>('http');
  const [copied, setCopied] = useState(false);

  const toggleOpen = () => setIsOpen(!isOpen);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const httpSnippet = `curl -X POST http://localhost:3000/api/dispatch \\
  -H "Content-Type: application/json" \\
  -d '{
    "group": "default",
    "priority": "high",
    "payload": {
      "action": "process_data",
      "data": "..."
    }
  }'`;

  const wsSnippet = `// Connect to WebSocket with Group ID
const ws = new WebSocket('ws://localhost:3000/ws?group=my-group');

ws.onopen = () => {
  console.log('Connected to TaskOrchard as Worker');
};

ws.onmessage = (event) => {
  const task = JSON.parse(event.data);
  console.log('Received task:', task);
  // Process task and send result back...
};`;

  return (
    <div className="mt-8">
      <button
        onClick={toggleOpen}
        className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all duration-300 border-2 ${isOpen
            ? 'bg-white border-green-400 shadow-lg shadow-green-100'
            : 'bg-white/60 border-white/60 hover:bg-white hover:shadow-md'
          }`}
      >
        <div className="flex items-center">
          <div className={`p-2 rounded-xl mr-4 transition-colors ${isOpen ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
            <Terminal className="w-6 h-6" />
          </div>
          <div className="text-left">
            <h3 className="font-bold text-gray-800 text-lg">开发者文档</h3>
            <p className="text-xs text-gray-500 font-medium">API 集成 & 工作节点连接</p>
          </div>
        </div>
        <div className={`transform transition-transform duration-500 ${isOpen ? 'rotate-180' : ''}`}>
          <ChevronDown className="w-6 h-6 text-gray-400" />
        </div>
      </button>

      {isOpen && (
        <div className="mt-4 overflow-hidden origin-top animate-spring-bounce">
          <div className="bg-white/80 backdrop-blur-md rounded-3xl p-6 border border-white/60 shadow-xl">

            {/* Tabs */}
            <div className="flex space-x-4 mb-6 border-b border-gray-200 pb-2">
              <button
                onClick={() => setActiveTab('http')}
                className={`pb-2 text-sm font-bold transition-colors relative ${activeTab === 'http' ? 'text-green-600' : 'text-gray-400 hover:text-gray-600'
                  }`}
              >
                HTTP 分发接口
                {activeTab === 'http' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-green-500 rounded-full"></div>}
              </button>
              <button
                onClick={() => setActiveTab('ws')}
                className={`pb-2 text-sm font-bold transition-colors relative ${activeTab === 'ws' ? 'text-green-600' : 'text-gray-400 hover:text-gray-600'
                  }`}
              >
                WebSocket 工作节点
                {activeTab === 'ws' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-green-500 rounded-full"></div>}
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

              {/* Left Column: Description */}
              <div className="space-y-6">
                {activeTab === 'http' ? (
                  <>
                    <div>
                      <h4 className="flex items-center text-green-700 font-bold mb-2">
                        <Zap className="w-4 h-4 mr-2" />
                        分发端点
                      </h4>
                      <p className="text-gray-600 text-sm leading-relaxed">
                        通过 HTTP POST 向指定工作组发送任务。系统会将任务路由到目标组中的可用工作节点。
                      </p>
                    </div>
                    <div className="flex items-center space-x-4 text-sm">
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg font-bold font-mono">POST</span>
                      <span className="font-mono text-gray-600">/api/dispatch</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-800 mb-3 text-sm">参数</h4>
                      <ul className="space-y-2 text-sm text-gray-600">
                        <li className="flex items-start">
                          <span className="font-mono text-green-600 w-20 shrink-0">group</span>
                          <span>目标分组 (例如 "gpu-cluster")</span>
                        </li>
                        <li className="flex items-start">
                          <span className="font-mono text-green-600 w-20 shrink-0">priority</span>
                          <span>"low" | "normal" | "high"</span>
                        </li>
                      </ul>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <h4 className="flex items-center text-green-700 font-bold mb-2">
                        <Zap className="w-4 h-4 mr-2" />
                        工作节点连接
                      </h4>
                      <p className="text-gray-600 text-sm leading-relaxed">
                        通过 WebSocket 连接工作节点以实时接收任务。使用 <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-800 font-mono text-xs">group</code> 查询参数来分类工作节点。
                      </p>
                    </div>
                    <div className="flex items-center space-x-4 text-sm">
                      <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg font-bold font-mono">WS</span>
                      <span className="font-mono text-gray-600">/ws</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-800 mb-3 text-sm">查询参数</h4>
                      <ul className="space-y-2 text-sm text-gray-600">
                        <li className="flex items-start">
                          <span className="font-mono text-green-600 w-20 shrink-0">group</span>
                          <span>
                            <strong>必填。</strong> 此工作节点所属的分组 ID。
                            <br /><span className="text-xs text-gray-400">示例: ?group=image-processing</span>
                          </span>
                        </li>
                      </ul>
                    </div>
                  </>
                )}
              </div>

              {/* Right Column: Code Example */}
              <div className="relative group">
                <div className="absolute -inset-2 bg-gradient-to-r from-green-200 to-sky-200 rounded-3xl blur opacity-30 group-hover:opacity-50 transition duration-500"></div>
                <div className="relative bg-gray-900 rounded-2xl p-6 shadow-2xl overflow-hidden">
                  <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-4">
                    <span className="text-gray-400 text-xs font-mono">
                      {activeTab === 'http' ? 'cURL 示例' : 'JavaScript 客户端'}
                    </span>
                    <button
                      onClick={() => copyToClipboard(activeTab === 'http' ? httpSnippet : wsSnippet)}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <pre className="font-mono text-sm text-green-400 overflow-x-auto whitespace-pre-wrap break-all">
                    {activeTab === 'http' ? httpSnippet : wsSnippet}
                  </pre>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- 辅助组件：格式化时长 ---
const Duration = ({ since }: { since: number }) => {
  const [text, setText] = useState('');
  useEffect(() => {
    const calc = () => {
      const diff = Date.now() - since;
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setText(`${h}h ${m}m ${s}s`);
    };
    calc();
    const timer = setInterval(calc, 1000);
    return () => clearInterval(timer);
  }, [since]);
  return <span>{text}</span>;
};
