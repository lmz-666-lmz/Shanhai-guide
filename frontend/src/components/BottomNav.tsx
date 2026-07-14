import { requireAuth } from '../utils/auth';
import type { UserSession } from '../types';

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  session?: UserSession | null;
}

const SvgIcon = ({ name, className = "w-6 h-6", isActive }: { name: string; className?: string; isActive?: boolean }) => {
  switch (name) {
    case 'home': return <svg className={className} viewBox="0 0 24 24" fill={isActive ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={isActive ? '0' : '2'}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
    case 'chat': return <svg className={className} viewBox="0 0 24 24" fill={isActive ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={isActive ? '0' : '2'}><path d="M12 3l1.9 4.1L18 9l-4.1 1.9L12 15l-1.9-4.1L6 9l4.1-1.9L12 3z"/><path d="M19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14z"/><path d="M5 14l.7 1.3L7 16l-1.3.7L5 18l-.7-1.3L3 16l1.3-.7L5 14z"/></svg>;
    case 'map': return <svg className={className} viewBox="0 0 24 24" fill={isActive ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={isActive ? '0' : '2'}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3" fill={isActive ? 'white' : 'none'}/></svg>;
    case 'activity': return <svg className={className} viewBox="0 0 24 24" fill={isActive ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={isActive ? '0' : '2'}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10" strokeWidth={isActive ? '2' : '2'} stroke={isActive ? 'white' : 'currentColor'}/></svg>;
    case 'profile': return <svg className={className} viewBox="0 0 24 24" fill={isActive ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={isActive ? '0' : '2'}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
    default: return null;
  }
};

const navItems = [
  { key: 'home', icon: 'home', label: '首页' },
  { key: 'chat', icon: 'chat', label: '数字人' },
  { key: 'map', icon: 'map', label: '地图' },
  { key: 'activity', icon: 'activity', label: '活动' },
  { key: 'profile', icon: 'profile', label: '我的' },
];

export default function BottomNav({ activeTab, onTabChange, session = null }: BottomNavProps) {
  const handleTabClick = (key: string) => {
    if (key === 'chat' || key === 'profile') {
      requireAuth(session, () => onTabChange(key));
    } else {
      onTabChange(key);
    }
  };

  return (
    <nav 
      className="fixed left-1/2 -translate-x-1/2 w-[calc(100%-24px)] max-w-[406px] h-[64px] bg-white/85 backdrop-blur-xl rounded-[24px] flex items-center justify-around px-2 z-[1000] shadow-[0_8px_32px_rgba(0,0,0,0.06)] border border-white/60"
      style={{ bottom: 'calc(12px + env(safe-area-inset-bottom))' }}
    >
      {navItems.map(({ key, icon, label }) => {
        const isActive = activeTab === key;
        return (
          <button
            key={key}
            className={`flex flex-col items-center justify-center gap-1 w-14 h-full relative transition-all duration-300 active:scale-90 outline-none focus:outline-none ${
              isActive ? 'text-primary-blue' : 'text-slate-400 hover:text-primary-blue/70'
            }`}
            onClick={() => handleTabClick(key)}
          >
            {isActive && (
              <div className="absolute top-0 w-8 h-1 bg-primary-blue rounded-b-full shadow-[0_2px_8px_rgba(37,99,235,0.6)]"></div>
            )}
            <span className={`transition-transform duration-300 flex items-center justify-center ${isActive ? '-translate-y-1 scale-110 drop-shadow-md' : ''}`}>
              <SvgIcon name={icon} isActive={isActive} />
            </span>
            <span className={`text-[10px] font-bold transition-all duration-300 ${isActive ? 'opacity-100' : 'opacity-80'}`}>
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}