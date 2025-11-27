'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Sparkles, Zap, Clock, Heart, LogOut, Terminal,
    ChevronDown, ChevronUp, ListTodo, Copy, Check, Activity, Cpu
} from 'lucide-react';
import { DashboardMetrics, Worker, RequestLog } from '@/lib/types/dashboard';
import {
    BubbleButton,
    LiquidCard,
    JellyIcon,
    FloatingOrb,
    GradientBlob,
    NeonBadge,
    MagneticText
} from '@/components/DopamineComponents';

// Task queue item type
interface QueuedTaskInfo {
    taskId: string;
    type: string;
    group: string;
    enqueuedAt: number;
    timeout: number;
    async: boolean;
    position: number;
    waitTime: number;
    payload: any;
}

// Executing task type
interface ExecutingTaskInfo {
    taskId: string;
    workerId: string;
    startedAt: number;
    executionTime: number;
    payload: any;
}

export default function DashboardPage() {
    const router = useRouter();
    const [authenticated, setAuthenticated] = useState(false);
    const [checking, setChecking] = useState(true);
    const [activeTab, setActiveTab] = useState<'dashboard' | 'logs'>('dashboard');
    const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [logs, setLogs] = useState<RequestLog[]>([]);
    const [currentTime, setCurrentTime] = useState('');
    const [selectedGroup, setSelectedGroup] = useState<string>('all');
    const [taskQueue, setTaskQueue] = useState<QueuedTaskInfo[]>([]);
    const [executingTasks, setExecutingTasks] = useState<ExecutingTaskInfo[]>([]);
    const [pendingCount, setPendingCount] = useState<number>(0);

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
        } catch (err) {
            console.error('Error fetching metrics/workers:', err);
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
        } catch (err) {
            console.error('Error fetching logs:', err);
        }
    }, []);

    // 获取任务队列
    const fetchTaskQueue = useCallback(async () => {
        try {
            const response = await fetch('/api/dashboard/tasks');
            if (response.ok) {
                const data = await response.json();
                setTaskQueue(data.tasks || []);
                setExecutingTasks(data.executingTasks || []);
                setPendingCount(data.pendingCount || 0);
            }
        } catch (err) {
            console.error('Error fetching task queue:', err);
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

    // 每 2 秒刷新任务队列
    useEffect(() => {
        if (!authenticated) return;
        fetchTaskQueue();
        const interval = setInterval(fetchTaskQueue, 2000);
        return () => clearInterval(interval);
    }, [authenticated, fetchTaskQueue]);

    // 显示加载状态
    if (checking) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-cyan-50">
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                    className="text-center"
                >
                    <motion.div
                        className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-cyan-500"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    />
                    <p className="text-lg font-bold text-gray-600">正在解锁多巴胺游乐场...</p>
                </motion.div>
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
        <div className="min-h-screen relative overflow-hidden">
            {/* 动态背景 */}
            <div className="fixed inset-0 bg-gradient-to-br from-purple-50 via-white to-cyan-50" />

            {/* 漂浮装饰 */}
            <FloatingOrb
                color="rgba(147, 51, 234, 0.08)"
                size={800}
                delay={0}
                className="top-0 right-0"
            />
            <FloatingOrb
                color="rgba(6, 182, 212, 0.08)"
                size={700}
                delay={4}
                className="bottom-0 left-0"
            />
            <GradientBlob className="absolute top-40 right-40 w-96 h-96 bg-gradient-to-br from-pink-300/10 to-orange-300/10" />

            {/* 主容器 */}
            <div className="relative z-10 container mx-auto px-4 py-8 max-w-7xl">
                {/* Header */}
                <motion.header
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="frosted-glass rounded-3xl p-6 mb-8 shadow-xl shadow-purple-200/30"
                >
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex items-center space-x-4">
                            <JellyIcon icon={<Sparkles />} color="purple" size="md" />
                            <div>
                                <MagneticText as="h1" className="text-3xl font-black gradient-text">
                                    多巴胺控制台
                                </MagneticText>
                                <p className="text-sm text-gray-500 font-medium">Dopamine Control Center</p>
                            </div>
                        </div>

                        <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2 bg-white/60 px-4 py-2 rounded-full">
                                <Clock className="w-4 h-4 text-purple-500" />
                                <span className="font-mono text-sm font-bold text-gray-700">{currentTime}</span>
                            </div>
                            <BubbleButton variant="secondary" size="sm" onClick={handleLogout}>
                                <LogOut className="w-4 h-4" />
                            </BubbleButton>
                        </div>
                    </div>
                </motion.header>

                {/* Tab Navigation */}
                <div className="flex justify-center mb-8 space-x-4">
                    <TabButton
                        label="仪表盘"
                        icon={Activity}
                        active={activeTab === 'dashboard'}
                        onClick={() => setActiveTab('dashboard')}
                    />
                    <TabButton
                        label="系统日志"
                        icon={Terminal}
                        active={activeTab === 'logs'}
                        onClick={() => setActiveTab('logs')}
                    />
                </div>

                {/* Main Content */}
                <main>
                    <AnimatePresence mode="wait">
                        {activeTab === 'dashboard' ? (
                            <motion.div
                                key="dashboard"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.3 }}
                                className="space-y-8"
                            >
                                {/* Metrics Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                    <MetricCard
                                        title="活跃节点"
                                        value={`${busyCount}/${totalCount}`}
                                        icon={Cpu}
                                        color="purple"
                                        progress={totalCount > 0 ? (busyCount / totalCount) * 100 : 0}
                                    />
                                    <MetricCard
                                        title="队列任务"
                                        value={taskQueue.length}
                                        icon={ListTodo}
                                        color="cyan"
                                        progress={Math.min(taskQueue.length * 10, 100)}
                                    />
                                    <MetricCard
                                        title="执行中"
                                        value={pendingCount}
                                        icon={Zap}
                                        color="pink"
                                        progress={Math.min(pendingCount * 20, 100)}
                                    />
                                    <MetricCard
                                        title="平均等待"
                                        value={`${avgWait}ms`}
                                        icon={Clock}
                                        color="orange"
                                        progress={Math.min(avgWait / 10, 100)}
                                    />
                                </div>

                                {/* Workers Section */}
                                <LiquidCard glowColor="purple">
                                    <div className="flex justify-between items-center mb-6">
                                        <h2 className="text-2xl font-black text-gray-800 flex items-center space-x-3">
                                            <Cpu className="w-6 h-6 text-purple-500" />
                                            <span>工作节点</span>
                                        </h2>

                                        {/* Group Filter */}
                                        <div className="flex space-x-2">
                                            {groups.map(g => (
                                                <motion.button
                                                    key={g}
                                                    onClick={() => setSelectedGroup(g)}
                                                    className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${selectedGroup === g
                                                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-300/50'
                                                        : 'bg-white/80 text-gray-600 hover:bg-white'
                                                        }`}
                                                    whileHover={{ scale: 1.05 }}
                                                    whileTap={{ scale: 0.95 }}
                                                >
                                                    {g}
                                                </motion.button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                        {filteredWorkers.map((worker, index) => (
                                            <WorkerCard key={worker.id} worker={worker} index={index} />
                                        ))}
                                    </div>
                                </LiquidCard>

                                {/* Task Queue Section */}
                                <TaskQueuePanel
                                    taskQueue={taskQueue}
                                    executingTasks={executingTasks}
                                    pendingCount={pendingCount}
                                    onRefresh={fetchTaskQueue}
                                />

                                {/* API Documentation */}
                                <ApiDocumentation />
                            </motion.div>
                        ) : (
                            <motion.div
                                key="logs"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.3 }}
                            >
                                <LogsPanel logs={logs} onRefresh={fetchLogs} />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </main>
            </div>
        </div>
    );
}

// === 子组件 ===

interface TabButtonProps {
    label: string;
    icon: React.ElementType;
    active: boolean;
    onClick: () => void;
}

function TabButton({ label, icon: Icon, active, onClick }: TabButtonProps) {
    return (
        <motion.button
            onClick={onClick}
            className={`
        flex items-center space-x-2 px-6 py-3 rounded-full font-bold text-sm
        transition-all duration-300
        ${active
                    ? 'bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500 text-white shadow-lg shadow-purple-300/50'
                    : 'bg-white/70 text-gray-600 hover:bg-white hover:shadow-md'
                }
      `}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
        >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
        </motion.button>
    );
}

interface MetricCardProps {
    title: string;
    value: number | string;
    icon: React.ElementType;
    color: 'purple' | 'cyan' | 'pink' | 'orange';
    progress: number;
}

function MetricCard({ title, value, icon: Icon, color, progress }: MetricCardProps) {
    const colors = {
        purple: {
            bg: 'from-purple-400 to-purple-600',
            text: 'text-purple-600',
            glow: 'shadow-purple-300/50'
        },
        cyan: {
            bg: 'from-cyan-400 to-cyan-600',
            text: 'text-cyan-600',
            glow: 'shadow-cyan-300/50'
        },
        pink: {
            bg: 'from-pink-400 to-pink-600',
            text: 'text-pink-600',
            glow: 'shadow-pink-300/50'
        },
        orange: {
            bg: 'from-orange-400 to-orange-600',
            text: 'text-orange-600',
            glow: 'shadow-orange-300/50'
        },
    };

    const c = colors[color];

    return (
        <motion.div
            className="frosted-glass rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-shadow"
            whileHover={{ y: -5 }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
        >
            <div className="flex items-center justify-between mb-4">
                <span className={`text-xs font-bold uppercase tracking-wider ${c.text}`}>{title}</span>
                <div className={`p-2 rounded-xl bg-gradient-to-br ${c.bg} ${c.glow} shadow-lg`}>
                    <Icon className="w-4 h-4 text-white" />
                </div>
            </div>

            <div className="text-4xl font-black text-gray-800 mb-4">{value}</div>

            <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                <motion.div
                    className={`h-full bg-gradient-to-r ${c.bg}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                />
            </div>
        </motion.div>
    );
}

interface WorkerCardProps {
    worker: Worker;
    index: number;
}

function WorkerCard({ worker, index }: WorkerCardProps) {
    const isBusy = worker.status === 'busy';

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="bg-white/70 hover:bg-white rounded-2xl p-5 border-2 border-white/80 hover:border-purple-200 transition-all shadow-sm hover:shadow-lg"
            whileHover={{ y: -3 }}
        >
            <div className="flex items-center justify-between mb-3">
                <div>
                    <h3 className="font-bold text-gray-800 text-sm">{worker.id}</h3>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">{worker.group || '默认分组'}</p>
                </div>
                <NeonBadge color={isBusy ? 'orange' : 'lime'} glow={true}>
                    {isBusy ? '忙碌' : '空闲'}
                </NeonBadge>
            </div>

            <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                    <span className="text-gray-500">当前任务</span>
                    <span className="font-mono text-gray-700 truncate max-w-[100px]" title={worker.currentTaskId || '空闲'}>
                        {worker.currentTaskId ? `${worker.currentTaskId.slice(0, 8)}...` : '-'}
                    </span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-500">运行时长</span>
                    <span className="font-mono text-gray-700">
                        <Duration since={worker.connectedSince} />
                    </span>
                </div>
            </div>
        </motion.div>
    );
}

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

interface TaskQueuePanelProps {
    taskQueue: QueuedTaskInfo[];
    executingTasks: ExecutingTaskInfo[];
    pendingCount: number;
    onRefresh: () => void;
}

function TaskQueuePanel({ taskQueue, executingTasks, pendingCount, onRefresh }: TaskQueuePanelProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <LiquidCard glowColor="cyan">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-gray-800 flex items-center space-x-3">
                    <ListTodo className="w-6 h-6 text-cyan-500" />
                    <span>任务队列</span>
                </h2>
                <div className="flex items-center space-x-3">
                    <NeonBadge color="cyan">队列: {taskQueue.length}</NeonBadge>
                    <NeonBadge color="orange">执行: {pendingCount}</NeonBadge>
                    <BubbleButton variant="secondary" size="sm" onClick={onRefresh}>
                        <Clock className="w-4 h-4" />
                    </BubbleButton>
                </div>
            </div>

            <motion.button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-4 bg-white/50 hover:bg-white/80 rounded-xl transition-all"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
            >
                <span className="font-bold text-gray-700">
                    {isExpanded ? '收起详情' : '展开详情'}
                </span>
                {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </motion.button>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="mt-4 overflow-hidden"
                    >
                        <div className="text-center py-8 text-gray-400">
                            <p className="text-sm">队列详情显示区域</p>
                            <p className="text-xs mt-2">任务数量: {taskQueue.length + pendingCount}</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </LiquidCard>
    );
}

function ApiDocumentation() {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'http' | 'ws'>('http');
    const [copied, setCopied] = useState(false);

    const httpExample = `# 同步模式（等待结果返回）
curl -X POST http://localhost:3000/api/openai \\
  -H "Content-Type: application/json" \\
  -d '{
    "data": {
      "action": "process",
      "content": "Hello World"
    },
    "model": "default",
    "group": "default",
    "timeout": 60000,
    "async": false
  }'

# 异步模式（立即返回taskId，需轮询查询结果）
curl -X POST http://localhost:3000/api/openai \\
  -H "Content-Type: application/json" \\
  -d '{
    "data": { "task": "long_running_job" },
    "async": true,
    "timeout": 120000
  }'

# 查询任务状态
curl http://localhost:3000/api/task/{taskId}`;

    const wsExample = `// Node.js Worker 示例
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:3000/ws?group=default');

ws.on('open', () => {
  console.log('已连接到调度器');
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  
  if (message.type === 'connected') {
    console.log('Worker ID:', message.workerId);
    // 发送 ready 表示准备接收任务
    ws.send(JSON.stringify({ type: 'ready' }));
  }
  
  if (message.type === 'task') {
    console.log('收到任务:', message.taskId);
    console.log('任务数据:', message.payload);
    
    // 处理任务...
    processTask(message.payload).then(result => {
      // 返回结果
      ws.send(JSON.stringify({
        type: 'task_complete',
        taskId: message.taskId,
        result: result,
        duration: 1000
      }));
    }).catch(error => {
      // 返回错误
      ws.send(JSON.stringify({
        type: 'task_error',
        taskId: message.taskId,
        error: error.message,
        duration: 1000
      }));
    });
  }
});`;

    const copyToClipboard = () => {
        navigator.clipboard.writeText(activeTab === 'http' ? httpExample : wsExample);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <LiquidCard glowColor="pink">
            <motion.button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
            >
                <div className="flex items-center space-x-3">
                    <JellyIcon icon={<Terminal />} color="pink" size="sm" />
                    <div className="text-left">
                        <h3 className="font-black text-gray-800 text-lg">🚀 API 开发者文档</h3>
                        <p className="text-xs text-gray-500">完整的集成指南与代码示例</p>
                    </div>
                </div>
                <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                >
                    <ChevronDown className="w-6 h-6 text-gray-400" />
                </motion.div>
            </motion.button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                    >
                        <div className="mt-6 space-y-6">
                            {/* Tab切换 */}
                            <div className="flex space-x-3 border-b-2 border-gray-200 pb-2">
                                <button
                                    onClick={() => setActiveTab('http')}
                                    className={`px-4 py-2 rounded-t-lg font-bold text-sm transition-all ${activeTab === 'http'
                                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                                        : 'bg-white/50 text-gray-600 hover:bg-white'
                                        }`}
                                >
                                    📡 HTTP API
                                </button>
                                <button
                                    onClick={() => setActiveTab('ws')}
                                    className={`px-4 py-2 rounded-t-lg font-bold text-sm transition-all ${activeTab === 'ws'
                                        ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg'
                                        : 'bg-white/50 text-gray-600 hover:bg-white'
                                        }`}
                                >
                                    ⚡ WebSocket Worker
                                </button>
                            </div>

                            {/* HTTP API 文档 */}
                            {activeTab === 'http' && (
                                <motion.div
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="space-y-4"
                                >
                                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-5">
                                        <h4 className="font-bold text-gray-800 mb-3 flex items-center">
                                            <Sparkles className="w-4 h-4 mr-2 text-purple-500" />
                                            任务提交接口
                                        </h4>
                                        <div className="space-y-3 text-sm">
                                            <div className="flex items-center space-x-3">
                                                <NeonBadge color="pink" glow={false}>POST</NeonBadge>
                                                <code className="bg-white px-3 py-1 rounded-lg text-purple-600 font-mono font-bold">
                                                    /api/openai
                                                </code>
                                            </div>

                                            <div className="mt-4">
                                                <p className="font-bold text-gray-700 mb-2">📋 请求参数：</p>
                                                <div className="space-y-2 bg-white/70 rounded-xl p-4">
                                                    <div className="flex justify-between text-xs">
                                                        <span className="font-mono text-purple-600">data</span>
                                                        <span className="text-gray-500">object - 任务数据（必填）</span>
                                                    </div>
                                                    <div className="flex justify-between text-xs">
                                                        <span className="font-mono text-purple-600">model</span>
                                                        <span className="text-gray-500">string - 模型名称（可选）</span>
                                                    </div>
                                                    <div className="flex justify-between text-xs">
                                                        <span className="font-mono text-purple-600">group</span>
                                                        <span className="text-gray-500">string - Worker分组（默认default）</span>
                                                    </div>
                                                    <div className="flex justify-between text-xs">
                                                        <span className="font-mono text-purple-600">timeout</span>
                                                        <span className="text-gray-500">number - 超时时间ms（默认60000）</span>
                                                    </div>
                                                    <div className="flex justify-between text-xs">
                                                        <span className="font-mono text-purple-600">async</span>
                                                        <span className="text-gray-500">boolean - 异步模式（默认false）</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-4">
                                                <p className="font-bold text-gray-700 mb-2">📊 响应格式：</p>
                                                <div className="bg-white/70 rounded-xl p-4 font-mono text-xs space-y-1">
                                                    <div className="text-green-600">// 同步模式 - 返回结果</div>
                                                    <div className="text-gray-700">{'{ taskId, status: "completed", result: {...} }'}</div>
                                                    <div className="text-green-600 mt-2">// 异步模式 - 返回任务ID</div>
                                                    <div className="text-gray-700">{'{ taskId, status: "queued" }'}</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-gradient-to-r from-cyan-50 to-blue-50 rounded-2xl p-5">
                                        <h4 className="font-bold text-gray-800 mb-3 flex items-center">
                                            <Clock className="w-4 h-4 mr-2 text-cyan-500" />
                                            任务查询接口（用于异步模式）
                                        </h4>
                                        <div className="flex items-center space-x-3">
                                            <NeonBadge color="cyan" glow={false}>GET</NeonBadge>
                                            <code className="bg-white px-3 py-1 rounded-lg text-cyan-600 font-mono font-bold text-sm">
                                                /api/task/{'{taskId}'}
                                            </code>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* WebSocket 文档 */}
                            {activeTab === 'ws' && (
                                <motion.div
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="space-y-4"
                                >
                                    <div className="bg-gradient-to-r from-cyan-50 to-blue-50 rounded-2xl p-5">
                                        <h4 className="font-bold text-gray-800 mb-3 flex items-center">
                                            <Zap className="w-4 h-4 mr-2 text-cyan-500" />
                                            Worker 连接地址
                                        </h4>
                                        <code className="block bg-white px-4 py-3 rounded-lg text-cyan-600 font-mono text-sm">
                                            ws://localhost:3000/ws?group={'{分组名}'}
                                        </code>

                                        <div className="mt-4 space-y-2 text-sm">
                                            <p className="font-bold text-gray-700">📨 消息协议：</p>
                                            <div className="bg-white/70 rounded-xl p-4 space-y-3">
                                                <div>
                                                    <span className="font-mono text-xs text-cyan-600">connected</span>
                                                    <span className="text-gray-500 text-xs ml-2">- 连接成功</span>
                                                </div>
                                                <div>
                                                    <span className="font-mono text-xs text-cyan-600">task</span>
                                                    <span className="text-gray-500 text-xs ml-2">- 收到新任务</span>
                                                </div>
                                                <div>
                                                    <span className="font-mono text-xs text-cyan-600">task_complete</span>
                                                    <span className="text-gray-500 text-xs ml-2">- 返回任务结果</span>
                                                </div>
                                                <div>
                                                    <span className="font-mono text-xs text-cyan-600">task_error</span>
                                                    <span className="text-gray-500 text-xs ml-2">- 返回任务错误</span>
                                                </div>
                                                <div>
                                                    <span className="font-mono text-xs text-cyan-600">ready</span>
                                                    <span className="text-gray-500 text-xs ml-2">- Worker空闲可接任务</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* 代码示例区 */}
                            <div className="relative">
                                <motion.div
                                    className="absolute -inset-1 bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 rounded-2xl blur opacity-20"
                                    animate={{
                                        opacity: [0.2, 0.3, 0.2],
                                    }}
                                    transition={{
                                        duration: 3,
                                        repeat: Infinity,
                                        ease: "easeInOut"
                                    }}
                                />
                                <div className="relative bg-gray-900 rounded-2xl overflow-hidden">
                                    <div className="flex items-center justify-between p-4 border-b border-gray-800">
                                        <div className="flex items-center space-x-2">
                                            <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                                            <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                            <span className="ml-3 text-gray-400 text-xs font-mono">
                                                {activeTab === 'http' ? 'api-example.sh' : 'worker-example.js'}
                                            </span>
                                        </div>
                                        <button
                                            onClick={copyToClipboard}
                                            className="flex items-center space-x-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                                        >
                                            {copied ? (
                                                <>
                                                    <Check className="w-4 h-4 text-green-400" />
                                                    <span className="text-xs text-green-400 font-bold">已复制!</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Copy className="w-4 h-4 text-gray-400" />
                                                    <span className="text-xs text-gray-400 font-bold">复制代码</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                    <div className="p-6 overflow-x-auto custom-scrollbar max-h-96">
                                        <pre className="font-mono text-xs text-green-400 leading-relaxed">
                                            {activeTab === 'http' ? httpExample : wsExample}
                                        </pre>
                                    </div>
                                </div>
                            </div>

                            {/* 底部提示 */}
                            <div className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-2xl p-4">
                                <p className="text-sm text-gray-700 flex items-center">
                                    <Sparkles className="w-4 h-4 mr-2 text-purple-500" />
                                    <span className="font-bold">提示：</span>
                                    <span className="ml-2">完整文档请查看项目根目录的 <code className="bg-white px-2 py-0.5 rounded text-purple-600 font-mono">API_GUIDE.md</code> 文件</span>
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </LiquidCard>
    );
}

interface LogsPanelProps {
    logs: RequestLog[];
    onRefresh: () => void;
}

function LogsPanel({ logs, onRefresh }: LogsPanelProps) {
    const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

    return (
        <LiquidCard glowColor="purple">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-gray-800 flex items-center space-x-3">
                    <Terminal className="w-6 h-6 text-purple-500" />
                    <span>系统日志</span>
                </h2>
                <BubbleButton variant="secondary" size="sm" onClick={onRefresh}>
                    <Clock className="w-4 h-4" />
                </BubbleButton>
            </div>

            <div className="space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar">
                {logs.map((log) => (
                    <motion.div
                        key={log.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-white/50 hover:bg-white/80 rounded-xl overflow-hidden transition-all"
                    >
                        <div
                            className="p-4 flex items-center justify-between cursor-pointer"
                            onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                        >
                            <div className="flex items-center space-x-3">
                                <div className={`w-2 h-2 rounded-full ${log.status >= 200 && log.status < 300 ? 'bg-green-500' :
                                    log.status >= 400 ? 'bg-red-500' : 'bg-blue-500'
                                    }`} />
                                <span className="font-mono text-xs text-gray-600">
                                    {new Date(log.timestamp).toLocaleTimeString()}
                                </span>
                                <span className="font-bold text-sm text-gray-800">
                                    {log.method} {log.path}
                                </span>
                                <NeonBadge color={
                                    log.status >= 200 && log.status < 300 ? 'lime' :
                                        log.status >= 400 ? 'pink' : 'cyan'
                                } glow={false}>
                                    {log.status}
                                </NeonBadge>
                            </div>
                            {expandedLogId === log.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>

                        <AnimatePresence>
                            {expandedLogId === log.id && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="px-4 pb-4 bg-gray-900/5 border-t border-gray-200"
                                >
                                    <div className="text-xs text-gray-600 py-3">
                                        <p>耗时: <span className="font-mono font-bold">{log.latency}ms</span></p>
                                        {log.taskId && <p>Task ID: <span className="font-mono">{log.taskId}</span></p>}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                ))}

                {logs.length === 0 && (
                    <div className="text-center py-12 text-gray-400">
                        <Terminal className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>暂无日志</p>
                    </div>
                )}
            </div>
        </LiquidCard>
    );
}
