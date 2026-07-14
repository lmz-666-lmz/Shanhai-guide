
/**
 * 统一解析徽章图标 URL，成就墙和获奖弹窗共用。
 * - 如果是 /uploads/xxx.png：拼接后端 origin
 * - 如果是完整 URL：直接返回
 * - 如果为空或无效：返回 undefined，由调用方显示默认兜底图标
 */
export const resolveBadgeIcon = (badgeIcon?: string): string | undefined => {
  if (!badgeIcon || badgeIcon.trim().length === 0) return undefined;
  if (badgeIcon.startsWith('http://') || badgeIcon.startsWith('https://')) return badgeIcon;
  if (badgeIcon.startsWith('/uploads/')) {
    const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';
    try {
      const origin = new URL(apiBase).origin;
      return `${origin}${badgeIcon}`;
    } catch {
      return `http://localhost:8080${badgeIcon}`;
    }
  }
  // data:image/... 等也直接返回
  return badgeIcon;
};

export const resolveImageUrl = (url?: string): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/uploads/')) {
    const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';
    try {
      const origin = new URL(apiBase).origin;
      return `${origin}${url}`;
    } catch {
      return `http://localhost:8080${url}`;
    }
  }
  return url;
};

export const DefaultRouteCover = ({ className = '' }: { className?: string }) => (
  <div className={`flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 text-white/80 ${className}`}>
    <svg className="w-12 h-12 drop-shadow-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6z" />
      <line x1="9" y1="3" x2="9" y2="18" />
      <line x1="15" y1="6" x2="15" y2="21" />
    </svg>
  </div>
);

export const DefaultActivityCover = ({ category, className = '' }: { category?: string; className?: string }) => {
  let gradient = 'from-blue-500 to-cyan-500';
  let Icon = (props: any) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}><circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>;
  
  if (category?.includes('学术')) {
    gradient = 'from-blue-600 to-indigo-500';
    Icon = (props: any) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>;
  } else if (category?.includes('文体')) {
    gradient = 'from-orange-500 to-rose-400';
    Icon = (props: any) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5-9c-.83 0-1.5-.67-1.5-1.5S6.17 8 7 8s1.5.67 1.5 1.5S7.83 11 7 11zm3-4c-.83 0-1.5-.67-1.5-1.5S9.17 4 10 4s1.5.67 1.5 1.5S10.83 7 10 7zm4 0c-.83 0-1.5-.67-1.5-1.5S13.17 4 14 4s1.5.67 1.5 1.5S14.83 7 14 7zm3 4c-.83 0-1.5-.67-1.5-1.5S16.17 8 17 8s1.5.67 1.5 1.5S17.83 11 17 11z"/></svg>;
  } else if (category?.includes('校友')) {
    gradient = 'from-emerald-500 to-teal-400';
    Icon = (props: any) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
  } else if (category?.includes('通知')) {
    gradient = 'from-purple-500 to-fuchsia-400';
    Icon = (props: any) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}><path d="M3 11l18-5v12L3 14v-3z"/></svg>;
  }

  return (
    <div className={`flex items-center justify-center bg-gradient-to-br text-white/80 ${gradient} ${className}`}>
      <Icon className="w-12 h-12 drop-shadow-md" />
    </div>
  );
};

export const DefaultSpotCover = ({ spotType, className = '' }: { spotType?: string; className?: string }) => {
  let gradient = 'from-slate-400 to-slate-500';
  let Icon = (props: any) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>;

  switch (spotType) {
    case '教学场馆':
      gradient = 'from-blue-400 to-blue-600';
      Icon = (props: any) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}><path d="M3 21h18"/><path d="M9 8h1"/><path d="M9 12h1"/><path d="M9 16h1"/><path d="M14 8h1"/><path d="M14 12h1"/><path d="M14 16h1"/><path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/></svg>;
      break;
    case '宿舍生活区':
      gradient = 'from-emerald-400 to-emerald-600';
      Icon = (props: any) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}><path d="M4 2v20h16V2H4zm14 18H6V4h12v16zM8 6h8v2H8V6zm0 4h8v2H8v-2zm0 4h8v2H8v-2z"/></svg>;
      break;
    case '餐饮美食':
      gradient = 'from-orange-400 to-orange-600';
      Icon = (props: any) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}><path d="M11 20H3v-2c0-3.3 2.7-6 6-6h2c3.3 0 6 2.7 6 6v2h-8zM15 4c0-1.1.9-2 2-2s2 .9 2 2v6h-4V4zM7 4c0-1.1.9-2 2-2s2 .9 2 2v6H7V4z"/></svg>;
      break;
    case '便民服务':
      gradient = 'from-purple-400 to-purple-600';
      Icon = (props: any) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z"/><path d="M9 22V12h6v10"/></svg>;
      break;
    case '运动场地':
      gradient = 'from-rose-400 to-rose-600';
      Icon = (props: any) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}><path d="M18 14v5a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-5M12 22V10M12 10a2 2 0 0 0-2-2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-6a2 2 0 0 0-2 2z"/></svg>;
      break;
    case '绿化景观':
      gradient = 'from-teal-400 to-teal-600';
      Icon = (props: any) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}><path d="M12 22v-8M12 8a4 4 0 0 0-4-4 4 4 0 0 0-4 4c0 2.2 1.8 4 4 4h4z"/><path d="M12 8a4 4 0 0 1 4-4 4 4 0 0 1 4 4c0 2.2-1.8 4-4 4h-4z"/></svg>;
      break;
    default:
      break;
  }

  return (
    <div className={`flex items-center justify-center bg-gradient-to-br text-white/80 ${gradient} ${className}`}>
      <Icon className="w-12 h-12 drop-shadow-md" />
    </div>
  );
};
