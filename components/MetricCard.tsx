import React from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'peach' | 'lavender';
  progress?: number;
}

const colorClasses = {
  blue: 'border-l-soft-blue bg-blue-50/30',
  green: 'border-l-mint-green bg-emerald-50/30',
  peach: 'border-l-peach bg-orange-50/30',
  lavender: 'border-l-lavender bg-violet-50/30',
};

const progressColorClasses = {
  blue: 'bg-soft-blue',
  green: 'bg-mint-green',
  peach: 'bg-peach',
  lavender: 'bg-lavender',
};

export default function MetricCard({ title, value, icon, color, progress }: MetricCardProps) {
  return (
    <div
      className={`
        relative overflow-hidden
        bg-white rounded-2xl p-6 
        border-l-4 ${colorClasses[color]}
        shadow-soft hover:shadow-soft-md
        hover:scale-105
        transition-smooth
      `}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="text-slate-500">
          {icon}
        </div>
      </div>
      
      <div className="space-y-1">
        <p className="text-sm font-medium text-slate-600">{title}</p>
        <p className="text-3xl font-bold text-slate-800">{value}</p>
      </div>

      {progress !== undefined && (
        <div className="mt-4 h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full ${progressColorClasses[color]} transition-all duration-500 ease-out`}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
    </div>
  );
}
