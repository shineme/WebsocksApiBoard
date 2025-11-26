'use client';

import { useEffect, useState } from 'react';

interface DurationDisplayProps {
  since: number;
}

export default function DurationDisplay({ since }: DurationDisplayProps) {
  const [duration, setDuration] = useState('');

  useEffect(() => {
    const updateDuration = () => {
      const now = Date.now();
      const diff = now - since;
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      setDuration(`${hours}h ${minutes}m ${seconds}s`);
    };

    updateDuration();
    const interval = setInterval(updateDuration, 1000);

    return () => clearInterval(interval);
  }, [since]);

  return <span className="text-slate-600 font-mono text-sm">{duration}</span>;
}
