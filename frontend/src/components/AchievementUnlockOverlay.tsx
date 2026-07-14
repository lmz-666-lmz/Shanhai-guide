import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Badge } from '../types';
import { ACHIEVEMENT_UNLOCKED_EVENT } from '../api';
import BadgeIconView from './BadgeIconView';

interface AchievementUnlockOverlayProps {
  onViewAchievements: () => void;
}

export default function AchievementUnlockOverlay({ onViewAchievements }: AchievementUnlockOverlayProps) {
  const [queue, setQueue] = useState<Badge[]>([]);
  const current = queue[0];

  useEffect(() => {
    const handleUnlock = (event: Event) => {
      const badges = (event as CustomEvent<{ badges?: Badge[] }>).detail?.badges || [];
      if (badges.length > 0) setQueue(previous => [...previous, ...badges]);
    };
    window.addEventListener(ACHIEVEMENT_UNLOCKED_EVENT, handleUnlock);
    return () => window.removeEventListener(ACHIEVEMENT_UNLOCKED_EVENT, handleUnlock);
  }, []);

  if (!current) return null;

  const closeCurrent = () => setQueue(previous => previous.slice(1));
  const viewAchievements = () => {
    closeCurrent();
    onViewAchievements();
  };

  return (
    <div className="achievement-unlock-overlay fixed top-0 bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-[1100] flex items-center justify-center px-6" role="dialog" aria-modal="true" aria-label="新成就已解锁">
      <button className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]" aria-label="关闭成就提示" onClick={closeCurrent} />
      <div className="achievement-unlock-card relative w-full max-w-sm overflow-hidden rounded-[28px] border border-white/70 bg-white p-6 text-center shadow-2xl">
        <div className="achievement-glow absolute left-1/2 top-14 h-32 w-32 -translate-x-1/2 rounded-full bg-amber-300/35 blur-2xl" />
        <div className="achievement-particles absolute inset-0 pointer-events-none" aria-hidden="true">
          {Array.from({ length: 12 }).map((_, index) => <span key={index} style={{ '--particle-index': index } as CSSProperties} />)}
        </div>
        <p className="relative text-xs font-bold tracking-[0.2em] text-amber-600">成就已解锁</p>
        <div className="achievement-medal relative mx-auto mt-5 flex items-center justify-center">
          <BadgeIconView badge={current} size={112} locked={false} />
        </div>
        <h2 className="relative mt-5 text-xl font-extrabold text-slate-900">恭喜获得「{current.badgeName}」成就</h2>
        <p className="relative mt-2 text-sm leading-6 text-slate-500">{current.badgeDesc || current.unlockRule || '新的校园探索记录已点亮'}</p>
        <div className="relative mt-6 grid grid-cols-2 gap-3">
          <button className="rounded-full border border-slate-200 bg-white py-3 text-sm font-bold text-slate-600 active:scale-95" onClick={closeCurrent}>稍后</button>
          <button className="rounded-full bg-slate-900 py-3 text-sm font-bold text-white shadow-lg shadow-slate-300 active:scale-95" onClick={viewAchievements}>查看成就</button>
        </div>
        {queue.length > 1 ? <p className="relative mt-3 text-[11px] text-slate-400">还有 {queue.length - 1} 枚新成就待查看</p> : null}
      </div>
    </div>
  );
}
