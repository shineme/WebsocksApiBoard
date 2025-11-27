'use client';

import React, { useRef, useState, ReactNode } from 'react';
import { motion, useMotionValue, useSpring, AnimatePresence } from 'framer-motion';
import { useSpring as useReactSpring, animated } from 'react-spring';
import { useGesture } from '@use-gesture/react';

/**
 * 🎈 BubbleButton - 充气模型质感的按钮，点击时产生爆炸再重组效果
 */
interface BubbleButtonProps {
    children: ReactNode;
    onClick?: () => void;
    variant?: 'primary' | 'secondary' | 'accent';
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
    className?: string;
}

export function BubbleButton({
    children,
    onClick,
    variant = 'primary',
    size = 'md',
    disabled = false,
    className = ''
}: BubbleButtonProps) {
    const [isExploding, setIsExploding] = useState(false);

    const variants = {
        primary: 'bg-gradient-to-br from-indigo-400/80 to-purple-400/80 text-white shadow-lg shadow-indigo-200/50 hover:shadow-indigo-300/60',
        secondary: 'bg-white/80 text-slate-600 border border-slate-100 shadow-sm hover:bg-white hover:shadow-md',
        accent: 'bg-gradient-to-br from-emerald-300/80 to-teal-400/80 text-white shadow-lg shadow-emerald-200/50',
    };

    const sizes = {
        sm: 'px-3 py-1.5 text-xs',
        md: 'px-5 py-2.5 text-sm',
        lg: 'px-8 py-3 text-base',
    };

    const handleClick = () => {
        if (disabled) return;
        setIsExploding(true);
        setTimeout(() => {
            setIsExploding(false);
            onClick?.();
        }, 400);
    };

    return (
        <motion.button
            onClick={handleClick}
            disabled={disabled}
            className={`
        relative overflow-hidden rounded-xl font-medium tracking-wide
        transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed
        backdrop-blur-sm
        ${variants[variant]} ${sizes[size]} ${className}
      `}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            animate={isExploding ? {
                scale: [1, 1.05, 0.95, 1],
            } : {}}
            transition={{
                type: "spring",
                stiffness: 500,
                damping: 30
            }}
        >
            <motion.div
                className="relative z-10 flex items-center justify-center"
                animate={isExploding ? {
                    scale: [1, 0.9, 1.1, 1],
                    opacity: [1, 0.8, 1],
                } : {}}
            >
                {children}
            </motion.div>

            {/* Subtle Shine */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-500" />
        </motion.button>
    );
}

/**
 * 🌊 LiquidCard - 液态金属质感卡片，鼠标悬停时产生流动变形
 */
interface LiquidCardProps {
    children: ReactNode;
    className?: string;
    glowColor?: string;
}

export function LiquidCard({ children, className = '', glowColor = 'purple' }: LiquidCardProps) {
    const cardRef = useRef<HTMLDivElement>(null);
    const [{ x, y }, set] = useReactSpring(() => ({ x: 0, y: 0 }));

    const bind = useGesture({
        onMove: ({ xy: [px, py] }) => {
            if (!cardRef.current) return;
            const rect = cardRef.current.getBoundingClientRect();
            // 减小晃动幅度：除数从 20 改为 100，使移动非常微小
            const x = (px - rect.left - rect.width / 2) / 100;
            const y = (py - rect.top - rect.height / 2) / 100;
            set({ x, y });
        },
        onHover: ({ hovering }) => {
            if (!hovering) set({ x: 0, y: 0 });
        }
    });

    // 清淡的阴影颜色
    const glowColors = {
        purple: 'shadow-indigo-100',
        cyan: 'shadow-sky-100',
        lime: 'shadow-emerald-100',
        pink: 'shadow-rose-100',
    };

    return (
        <animated.div
            ref={cardRef}
            {...bind()}
            style={{
                transform: x.to((x) => `perspective(1000px) rotateY(${x}deg) rotateX(${-y.get()}deg)`),
            }}
            className={`
        relative overflow-hidden rounded-2xl p-6
        bg-white/80
        backdrop-blur-md border border-white/60
        shadow-xl ${glowColors[glowColor as keyof typeof glowColors] || glowColors.purple}
        transition-all duration-500
        hover:shadow-2xl hover:bg-white/90
        ${className}
      `}
        >
            {/* 极淡的背景流光 */}
            <div className="absolute inset-0 bg-gradient-to-br from-white via-slate-50/30 to-white opacity-50 pointer-events-none" />

            {/* 极其微弱的光泽 */}
            <animated.div
                style={{
                    background: x.to(
                        (x) => `radial-gradient(circle at ${50 + x * 2}% ${50 - y.get() * 2}%, rgba(255,255,255,0.8), transparent 60%)`
                    ),
                }}
                className="absolute inset-0 pointer-events-none opacity-40"
            />

            <div className="relative z-10">
                {children}
            </div>
        </animated.div>
    );
}

/**
 * ✨ MagneticText - 磁吸效果文字，鼠标靠近时被吸引
 */
interface MagneticTextProps {
    children: string;
    className?: string;
    as?: 'h1' | 'h2' | 'h3' | 'p' | 'span';
}

export function MagneticText({ children, className = '', as = 'p' }: MagneticTextProps) {
    const textRef = useRef<HTMLDivElement>(null);
    const x = useMotionValue(0);
    const y = useMotionValue(0);

    const springX = useSpring(x, { stiffness: 100, damping: 30 }); // 增加阻尼，减少晃动
    const springY = useSpring(y, { stiffness: 100, damping: 30 });

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!textRef.current) return;
        const rect = textRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const distanceX = e.clientX - centerX;
        const distanceY = e.clientY - centerY;

        const distance = Math.sqrt(distanceX ** 2 + distanceY ** 2);
        const maxDistance = 100; // 减小感应距离

        if (distance < maxDistance) {
            const power = (maxDistance - distance) / maxDistance;
            x.set(distanceX * power * 0.15); // 减小移动幅度
            y.set(distanceY * power * 0.15);
        }
    };

    const handleMouseLeave = () => {
        x.set(0);
        y.set(0);
    };

    const Component = as;

    return (
        <div
            ref={textRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className="inline-block cursor-default"
        >
            <motion.div
                style={{ x: springX, y: springY }}
                className={className}
            >
                <Component className={className}>{children}</Component>
            </motion.div>
        </div>
    );
}

/**
 * 🎯 JellyIcon - 果冻质感图标，悬停时产生弹性摇晃
 */
interface JellyIconProps {
    icon: ReactNode;
    color?: 'purple' | 'cyan' | 'lime' | 'pink' | 'orange';
    size?: 'sm' | 'md' | 'lg';
}

export function JellyIcon({ icon, color = 'purple', size = 'md' }: JellyIconProps) {
    // 清淡的莫兰迪色系背景
    const colors = {
        purple: 'bg-indigo-50 text-indigo-500',
        cyan: 'bg-sky-50 text-sky-500',
        lime: 'bg-emerald-50 text-emerald-500',
        pink: 'bg-rose-50 text-rose-500',
        orange: 'bg-orange-50 text-orange-500',
    };

    const sizes = {
        sm: 'w-8 h-8 p-1.5',
        md: 'w-10 h-10 p-2',
        lg: 'w-14 h-14 p-3',
    };

    return (
        <motion.div
            className={`
        rounded-xl flex items-center justify-center
        transition-colors duration-300
        ${colors[color]} ${sizes[size]}
      `}
            whileHover={{
                scale: 1.05,
                rotate: [0, -5, 5, -5, 0], // 减小旋转角度
                transition: {
                    duration: 0.4,
                    ease: "easeInOut"
                }
            }}
            whileTap={{ scale: 0.95 }}
        >
            {icon}
        </motion.div>
    );
}

/**
 * 💫 FloatingOrb - 漂浮的发光球体，营造无重力感
 */
interface FloatingOrbProps {
    color?: string;
    size?: number;
    delay?: number;
    className?: string;
    style?: React.CSSProperties;
}

export function FloatingOrb({
    color = 'rgba(200, 210, 255, 0.2)', // 更淡的默认颜色
    size = 400,
    delay = 0,
    className = '',
    style = {}
}: FloatingOrbProps) {
    return (
        <motion.div
            className={`absolute rounded-full blur-[100px] pointer-events-none ${className}`}
            style={{
                width: size,
                height: size,
                background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
                ...style
            }}
            animate={{
                x: [0, 50, -50, 0], // 减小移动范围
                y: [0, -60, 40, 0],
                opacity: [0.3, 0.5, 0.3],
            }}
            transition={{
                duration: 25, // 减慢速度
                delay,
                repeat: Infinity,
                ease: "easeInOut"
            }}
        />
    );
}

/**
 * 🌈 GradientBlob - 渐变变形装饰blob
 */
export function GradientBlob({ className = '' }: { className?: string }) {
    return (
        <motion.div
            className={`absolute rounded-full blur-3xl opacity-30 ${className}`}
            animate={{
                scale: [1, 1.1, 1],
                rotate: [0, 90, 0],
                borderRadius: ["40% 60% 70% 30% / 40% 50% 60% 50%", "60% 40% 30% 70% / 50% 60% 40% 60%", "40% 60% 70% 30% / 40% 50% 60% 50%"]
            }}
            transition={{
                duration: 20,
                repeat: Infinity,
                ease: "easeInOut"
            }}
        />
    );
}

/**
 * 💧 WaterDropEffect - 水滴炸裂效果
 */
interface WaterDropEffectProps {
    trigger: boolean;
    onComplete?: () => void;
}

export function WaterDropEffect({ trigger, onComplete }: WaterDropEffectProps) {
    return (
        <AnimatePresence>
            {trigger && (
                <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
                    {[...Array(8)].map((_, i) => (
                        <motion.div
                            key={i}
                            className="absolute w-4 h-4 rounded-full bg-sky-200/50"
                            initial={{ scale: 0, x: 0, y: 0 }}
                            animate={{
                                scale: [0, 1, 0],
                                x: Math.cos((i * Math.PI * 2) / 8) * 150,
                                y: Math.sin((i * Math.PI * 2) / 8) * 150,
                                opacity: [0, 0.8, 0]
                            }}
                            exit={{ opacity: 0 }}
                            transition={{
                                duration: 0.8,
                                ease: "easeOut"
                            }}
                            onAnimationComplete={() => i === 0 && onComplete?.()}
                        />
                    ))}
                </div>
            )}
        </AnimatePresence>
    );
}

/**
 * 🎨 NeonBadge - 霓虹发光徽章 -> 改为清淡徽章
 */
interface NeonBadgeProps {
    children: ReactNode;
    color?: 'pink' | 'cyan' | 'lime' | 'orange';
    glow?: boolean;
}

export function NeonBadge({ children, color = 'pink', glow = false }: NeonBadgeProps) {
    const colors = {
        pink: {
            bg: 'bg-rose-50',
            text: 'text-rose-600',
            border: 'border-rose-100',
        },
        cyan: {
            bg: 'bg-sky-50',
            text: 'text-sky-600',
            border: 'border-sky-100',
        },
        lime: {
            bg: 'bg-emerald-50',
            text: 'text-emerald-600',
            border: 'border-emerald-100',
        },
        orange: {
            bg: 'bg-orange-50',
            text: 'text-orange-600',
            border: 'border-orange-100',
        },
    };

    const c = colors[color];

    return (
        <motion.span
            className={`
        inline-flex items-center px-2.5 py-0.5 rounded-md
        text-xs font-medium tracking-wide
        border ${c.bg} ${c.text} ${c.border}
      `}
            whileHover={{ scale: 1.02 }}
        >
            {children}
        </motion.span>
    );
}
