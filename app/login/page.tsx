'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Sparkles, Zap, Star } from 'lucide-react';
import {
  BubbleButton,
  FloatingOrb,
  GradientBlob,
  MagneticText,
  WaterDropEffect
} from '@/components/DopamineComponents';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password }),
      });

      const data = await response.json();

      if (data.success) {
        setShowSuccess(true);
        setTimeout(() => {
          router.push('/dashboard');
        }, 1200);
      } else {
        setError(data.message || '密码错误');
        setLoading(false);
      }
    } catch (err) {
      setError('登录失败，请重试');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4">
      {/* 动态渐变背景 */}
      <div className="fixed inset-0 bg-gradient-to-br from-purple-50 via-white to-cyan-50" />

      {/* 漂浮装饰球体 */}
      <FloatingOrb
        color="rgba(147, 51, 234, 0.15)"
        size={600}
        delay={0}
        className="top-0 -left-1/4"
      />
      <FloatingOrb
        color="rgba(6, 182, 212, 0.15)"
        size={500}
        delay={3}
        className="bottom-0 -right-1/4"
      />
      <FloatingOrb
        color="rgba(236, 72, 153, 0.12)"
        size={400}
        delay={6}
        className="top-1/3 right-1/4"
      />

      {/* 渐变Blob装饰 */}
      <GradientBlob className="absolute top-20 left-20 w-64 h-64 bg-gradient-to-br from-purple-300/20 to-pink-300/20" />
      <GradientBlob className="absolute bottom-20 right-20 w-80 h-80 bg-gradient-to-br from-cyan-300/20 to-blue-300/20" />

      {/* 主容器 */}
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          type: "spring",
          stiffness: 260,
          damping: 20
        }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Logo区域 */}
        <div className="text-center mb-10">
          <motion.div
            className="inline-block mb-6"
            animate={{
              rotate: [0, 5, -5, 0],
              scale: [1, 1.05, 1],
            }}
            transition={{
              duration: 6,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <div className="relative">
              {/* 发光光环 */}
              <motion.div
                className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 blur-2xl"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 0.8, 0.5]
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />

              {/* 主图标 */}
              <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-cyan-500 flex items-center justify-center shadow-2xl shadow-purple-500/50">
                <Sparkles className="w-12 h-12 text-white" strokeWidth={2.5} />
              </div>

              {/* 旋转星星装饰 */}
              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute"
                  style={{
                    top: '50%',
                    left: '50%',
                  }}
                  animate={{
                    rotate: [0, 360],
                    x: Math.cos((i * 120 * Math.PI) / 180) * 60,
                    y: Math.sin((i * 120 * Math.PI) / 180) * 60,
                  }}
                  transition={{
                    duration: 8,
                    repeat: Infinity,
                    ease: "linear",
                    delay: i * 0.3
                  }}
                >
                  <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                </motion.div>
              ))}
            </div>
          </motion.div>

          <MagneticText
            as="h1"
            className="text-5xl font-black mb-3 gradient-text"
          >
            多巴胺登录
          </MagneticText>

          <motion.p
            className="text-gray-500 font-medium tracking-wide"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            准备好进入<span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-cyan-500 font-bold">解压游乐场</span>了吗？
          </motion.p>
        </div>

        {/* 登录卡片 */}
        <motion.div
          className="frosted-glass rounded-3xl p-8 shadow-2xl shadow-purple-200/50"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            delay: 0.2,
            type: "spring",
            stiffness: 200,
            damping: 15
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 密码输入框 */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider"
              >
                🔐 访问密钥
              </label>

              <motion.div
                className="relative"
                whileFocus={{ scale: 1.02 }}
              >
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-purple-400" />
                </div>
                <motion.input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-white/80 border-2 border-purple-200 rounded-2xl 
                    focus:ring-4 focus:ring-purple-300/50 focus:border-purple-400 
                    transition-all outline-none text-gray-800 font-medium
                    placeholder-gray-400"
                  placeholder="输入神秘口令..."
                  required
                  autoFocus
                  whileFocus={{
                    borderColor: "#a855f7",
                    boxShadow: "0 0 30px rgba(168, 85, 247, 0.3)"
                  }}
                />

                {/* 输入框光效 */}
                <motion.div
                  className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 opacity-0 blur-xl"
                  animate={{
                    opacity: password.length > 0 ? [0.1, 0.3, 0.1] : 0
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                />
              </motion.div>
            </div>

            {/* 错误提示 */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.9 }}
                  className="bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-200 rounded-2xl p-4 flex items-center space-x-3"
                >
                  <Zap className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-600 font-bold">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 提交按钮 */}
            <BubbleButton
              variant="primary"
              size="lg"
              disabled={loading}
              className="w-full !py-4 text-lg !shadow-2xl !shadow-purple-400/50"
            >
              {loading ? (
                <div className="flex items-center space-x-2">
                  <motion.div
                    className="w-5 h-5 border-3 border-white border-t-transparent rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  />
                  <span>正在解锁...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-5 h-5" />
                  <span>开始探索</span>
                </div>
              )}
            </BubbleButton>
          </form>
        </motion.div>

        {/* 底部装饰 */}
        <motion.div
          className="mt-8 text-center space-y-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <div className="flex items-center justify-center space-x-2">
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                className="w-2 h-2 rounded-full bg-gradient-to-r from-purple-400 to-cyan-400"
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.3, 1, 0.3]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: i * 0.2,
                  ease: "easeInOut"
                }}
              />
            ))}
          </div>
          <p className="text-xs text-gray-400 font-mono tracking-wider">
            Dopamine Playground v2.0 • 解压从现在开始
          </p>
        </motion.div>
      </motion.div>

      {/* 成功动效 */}
      <WaterDropEffect
        trigger={showSuccess}
        onComplete={() => { }}
      />
    </div>
  );
}

