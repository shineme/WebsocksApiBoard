'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, LogIn, Heart, Cloud, Sun } from 'lucide-react';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (data.success) {
        router.push('/dashboard');
      } else {
        setError(data.message || '密码错误');
      }
    } catch (err) {
      setError('登录失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-green-100 flex items-center justify-center p-4 overflow-hidden relative font-sans selection:bg-yellow-200/50">

      {/* --- 样式注入 (CSS 动画) --- */}
      <style>{`
        @keyframes cloud-drift {
            0% { transform: translateX(0); }
            100% { transform: translateX(20%); }
        }
        @keyframes sun-pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.05); opacity: 0.8; }
        }
        .cloud-background {
            animation: cloud-drift 80s linear infinite alternate;
        }
        .sun-animation {
            animation: sun-pulse 5s ease-in-out infinite;
        }
        .paper-card {
            background: rgba(255, 255, 255, 0.85);
            backdrop-filter: blur(4px);
            border: 1px solid rgba(0, 0, 0, 0.05);
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.03);
            transition: all 0.3s ease;
        }
      `}</style>

      {/* --- 背景装饰 --- */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-10 right-10 w-24 h-24 rounded-full bg-yellow-300 opacity-60 sun-animation shadow-xl shadow-yellow-300/50" />
        <div className="absolute top-1/4 -left-1/4 w-1/2 h-40 bg-white/70 rounded-full cloud-background" style={{ borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%' }} />
        <div className="absolute bottom-1/3 -right-1/4 w-1/3 h-32 bg-white/50 rounded-full cloud-background" style={{ borderRadius: '50% 50% 50% 50% / 40% 40% 60% 60%' }} />
      </div>

      <div className="relative z-10 w-full max-w-md">

        {/* Logo / Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/80 rounded-full mb-4 shadow-lg shadow-yellow-100 border-2 border-yellow-200">
            {/* 煤炭精灵 (Susuwatari) 模仿 */}
            <span className="text-4xl text-black filter drop-shadow-[0_2px_3px_rgba(0,0,0,0.2)]">⚫</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-800 mb-2">
            Soot Spirit Login
          </h1>
          <p className="text-green-600 text-sm tracking-widest opacity-80">
            请输入口令进入小屋
          </p>
        </div>

        {/* Login Form */}
        <div className="paper-card rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2"
              >
                Secret Key // 密钥
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-400 focus:border-transparent transition-all outline-none text-gray-700 placeholder-gray-400"
                  placeholder="••••••••"
                  required
                  autoFocus
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50/80 border border-red-200 rounded-xl p-3 flex items-center animate-pulse">
                <Heart className="w-4 h-4 text-red-500 mr-2" />
                <p className="text-sm text-red-600 font-medium">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`
                w-full flex items-center justify-center space-x-2 
                px-4 py-3 rounded-xl text-white font-bold tracking-wide
                transition-all duration-300 shadow-lg
                ${loading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-400 to-emerald-500 hover:from-green-500 hover:to-emerald-600 hover:shadow-green-200 hover:scale-[1.02]'
                }
              `}
            >
              <LogIn className="w-5 h-5" />
              <span>{loading ? '正在开门...' : '进入小屋'}</span>
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-green-700/50 font-mono">
            SOOT SPIRIT DISPATCHER v1.0
          </p>
        </div>
      </div>
    </div>
  );
}
