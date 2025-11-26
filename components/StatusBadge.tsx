interface StatusBadgeProps {
  status: 'idle' | 'busy';
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const isIdle = status === 'idle';
  
  return (
    <span
      className={`
        inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium
        border transition-smooth
        ${isIdle 
          ? 'bg-blue-50 text-blue-700 border-blue-200' 
          : 'bg-orange-50 text-orange-700 border-orange-200'
        }
      `}
    >
      {isIdle ? '空闲' : '忙碌中'}
    </span>
  );
}
