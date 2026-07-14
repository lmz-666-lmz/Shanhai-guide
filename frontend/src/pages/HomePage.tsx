import { useState, useEffect, useRef } from 'react';
import { Modal } from 'antd-mobile';
import type { UserSession, CampusRoute, CampusSpot } from '../types';
import XiaohaiAvatar from '../components/XiaohaiAvatar';
import { UserModeNames } from '../types';
import { routeApi, spotApi } from '../api';
import { resolveImageUrl, DefaultRouteCover, DefaultSpotCover } from '../utils/image';
import { requireAuth } from '../utils/auth';
import { useDigitalHuman } from '../contexts/DigitalHumanContext';
import { useToast } from '../contexts/ToastContext';
const getErrorMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

const quickIcons = [
  { icon: <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2z"/><path d="M3 19a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v2z"/></svg>, label: '路线推荐', bg: 'bg-emerald-50', textColor: 'text-emerald-500', page: 'route' },
  { icon: <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>, label: '找食堂', bg: 'bg-[#d49065]/10', textColor: 'text-[#d49065]', page: 'map', spotType: '餐饮美食' },
  { icon: <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>, label: '校园活动', bg: 'bg-indigo-50', textColor: 'text-indigo-500', page: 'activity' },
  { icon: <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>, label: '共创校园', bg: 'bg-blue-50', textColor: 'text-blue-500', page: 'profile', subPage: 'cocreate' },
];

interface HomePageProps {
  session: UserSession;
  onNavigate: (params: { page: string; routeId?: number; spotId?: number; spotType?: string; initialMessage?: string }) => void;
}

export default function HomePage({ session, onNavigate }: HomePageProps) {
  const { effectiveConfig, openNarration, capabilityEnabled } = useDigitalHuman();

  const toast = useToast();
  const [routes, setRoutes] = useState<CampusRoute[]>([]);
  const [spots, setSpots] = useState<CampusSpot[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('全部');
  const [checkedInRoutes, setCheckedInRoutes] = useState<Set<number>>(new Set());
  const [locationLabel, setLocationLabel] = useState('山海大学 · 南门');
  const [locating, setLocating] = useState(false);

  // Routes Carousel state
  const [currentRouteIndex, setCurrentRouteIndex] = useState(0);
  const [touchStartRoute, setTouchStartRoute] = useState<number | null>(null);
  const [touchEndRoute, setTouchEndRoute] = useState<number | null>(null);

  const filteredSpots = spots.filter(s => activeCategory === '全部' || s.spotType === activeCategory);
  const topRoutes = routes.slice(0, 3); // max 3 routes for carousel
  const spotMarqueeDuration = Math.max(filteredSpots.length * 2.5, 10);

  useEffect(() => {
    fetchData();
    loadCheckedInRoutes();
  }, [session]);

  const [isAutoPlayPaused, setIsAutoPlayPaused] = useState(false);
  const pauseTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (topRoutes.length <= 1 || isAutoPlayPaused) return;
    const timer = setInterval(() => {
      setCurrentRouteIndex(prev => (prev + 1) % topRoutes.length);
    }, 3200);
    return () => clearInterval(timer);
  }, [topRoutes.length, isAutoPlayPaused]);

  const handleRouteSwipe = (direction: 'left' | 'right') => {
    if (topRoutes.length <= 1) return;
    if (direction === 'left') {
      setCurrentRouteIndex(prev => (prev + 1) % topRoutes.length);
    } else {
      setCurrentRouteIndex(prev => (prev === 0 ? topRoutes.length - 1 : prev - 1));
    }
    setIsAutoPlayPaused(true);
    if (pauseTimeoutRef.current) {
      window.clearTimeout(pauseTimeoutRef.current);
    }
    pauseTimeoutRef.current = window.setTimeout(() => {
      setIsAutoPlayPaused(false);
    }, 3000);
  };

  const loadCheckedInRoutes = () => {
    const saved = localStorage.getItem('checkedInRoutes');
    if (saved) {
      const parsed = JSON.parse(saved);
      setCheckedInRoutes(new Set(parsed));
    }
  };

  const saveCheckedInRoute = (routeId: number) => {
    if (session.userMode === 'guest') {
      Modal.alert({
        content: '游客模式暂不开放打卡功能，请注册或登录',
        confirmText: '我知道了',
      });
      return;
    }
    const updated = new Set(checkedInRoutes);
    updated.add(routeId);
    setCheckedInRoutes(updated);
    localStorage.setItem('checkedInRoutes', JSON.stringify([...updated]));
    toast.show('打卡成功');
  };

  const handleRequestLocation = () => {
    if (!navigator.geolocation) {
      toast.error('当前设备不支持 GPS 定位');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude, longitude } = pos.coords;
        setLocationLabel(`已定位 (${latitude.toFixed(4)},${longitude.toFixed(4)})`);
        toast.success('已获取实际位置');
      },
      () => {
        setLocating(false);
        toast.error('定位失败，继续使用默认位置');
      },
      { timeout: 5000, maximumAge: 60000 }
    );
  };

  const handleAIStart = () => {
    requireAuth(session, () => {
      onNavigate({ page: 'chat' });
    });
  };

  const handleAIPlan = () => {
    requireAuth(session, () => {
      onNavigate({ page: 'chat', initialMessage: '请帮我规划校园路线' });
    });
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [routeRes, spotRes] = await Promise.all([
        routeApi.getRoutes(session.userMode === 'guest' ? undefined : session.userMode),
        spotApi.getSpots(undefined, session.userMode === 'guest' ? undefined : session.userMode),
      ]);
      setRoutes(routeRes.data.data || []);
      setSpots(spotRes.data.data || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error(getErrorMessage(error, '首页数据加载失败，请稍后重试'));
    } finally {
      setLoading(false);
    }
  };

  const getSpotCount = (route: CampusRoute) => {
    try {
      return JSON.parse(route.spotOrderJson).length;
    } catch {
      return 0;
    }
  };

  const getDistance = (route: CampusRoute) => {
    return (getSpotCount(route) * 0.3).toFixed(1);
  };

  const renderRouteCard = (route: CampusRoute) => {
    const isCheckedIn = checkedInRoutes.has(route.id);
    const coverUrl = resolveImageUrl(route.coverImage);

    return (
      <div key={route.id} className="w-full shrink-0 px-1">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          {/* Cover Image Area */}
          <div className="h-36 relative bg-slate-100 overflow-hidden shrink-0">
            {coverUrl ? (
              <img src={coverUrl} alt={route.routeName} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} />
            ) : null}
            <div className={`w-full h-full absolute inset-0 ${coverUrl ? 'hidden' : ''}`}>
              <DefaultRouteCover className="w-full h-full" />
            </div>
            <div className="absolute top-2 right-2 bg-black/40 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 z-10">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              {route.totalMinute} 分钟
            </div>
          </div>

          <div className="p-4 flex flex-col">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-bold text-base text-text-dark truncate">{route.routeName}</h3>
              <span className="bg-blue-50 text-primary-blue text-[10px] px-2 py-0.5 rounded border border-blue-100 font-bold shrink-0 ml-2">
                推荐路线
              </span>
            </div>
            <p className="text-xs text-text-sec mb-3 line-clamp-2 leading-relaxed">{route.routeDesc}</p>
            <div className="flex items-center gap-3 text-[11px] text-text-sec mb-4 shrink-0">
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
                {getSpotCount(route)}个点位
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                {getDistance(route)}km
              </span>
            </div>
            <div className="flex items-center justify-between mt-auto pt-2 shrink-0 border-t border-slate-50">
              <span className={`text-[10px] font-medium px-2 py-1 rounded-full ${isCheckedIn ? 'bg-emerald-100/50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                {isCheckedIn ? '✓ 今日已打卡' : '待打卡'}
              </span>
              <button
                className="text-xs bg-primary-blue text-white px-5 py-2 rounded-full font-bold active:scale-95 transition-transform shadow-sm shadow-blue-500/20"
                onClick={() => {
                  saveCheckedInRoute(route.id);
                  onNavigate({ page: 'map', routeId: route.id });
                }}
              >
                开始游览
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSpotCard = (spot: CampusSpot) => {
    const spotUrl = resolveImageUrl(spot.spotImage);

    return (
      <button
        type="button"
        className="block w-full bg-white rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.03)] overflow-hidden text-left active:scale-[0.98] transition-transform cursor-pointer border border-slate-50"
        onClick={() => onNavigate({ page: 'map', spotId: spot.id })}
        aria-label={`在地图中查看${spot.spotName}`}
      >
        <div className="aspect-[4/3] relative bg-slate-100 shrink-0">
          {spotUrl ? (
            <img src={spotUrl} alt={spot.spotName} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} />
          ) : null}
          <div className={`w-full h-full absolute inset-0 ${spotUrl ? 'hidden' : ''}`}>
            <DefaultSpotCover spotType={spot.spotType} className="w-full h-full" />
          </div>
          <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm text-slate-700 text-[10px] px-2 py-0.5 rounded-full font-bold shadow-sm">
            {spot.spotType}
          </div>
        </div>
        <div className="p-3">
          <h3 className="font-bold text-[14px] text-slate-800 mb-1 truncate">{spot.spotName}</h3>
          <p className="text-[11px] text-slate-500 line-clamp-1 mb-2 leading-relaxed">{spot.spotDesc || '暂无详细介绍'}</p>
          <div className="flex items-center text-[10px] text-primary-blue font-bold bg-blue-50 w-fit px-2 py-1 rounded-md">
            <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            {spot.openTime || '以学校实际安排为准'}
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="min-h-[100dvh] bg-[#F7F9FC]" style={{ paddingBottom: 'calc(110px + env(safe-area-inset-bottom))' }}>
      <style>{`
        @keyframes seamlessMarquee {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-50%, 0, 0); }
        }
        .animate-seamless-marquee {
          animation: seamlessMarquee ${spotMarqueeDuration}s linear infinite;
          will-change: transform;
        }
        .spot-marquee-viewport:hover .animate-seamless-marquee,
        .spot-marquee-viewport:active .animate-seamless-marquee,
        .spot-marquee-viewport:focus-within .animate-seamless-marquee {
          animation-play-state: paused;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-seamless-marquee {
            animation-duration: ${spotMarqueeDuration * 3}s;
          }
        }
        .hero-pattern {
          background-color: #3b82f6;
          background-image: radial-gradient(at 80% 0%, hsla(189,100%,56%,1) 0px, transparent 50%),
                            radial-gradient(at 0% 50%, hsla(225,100%,74%,1) 0px, transparent 50%),
                            radial-gradient(at 80% 100%, hsla(242,100%,70%,1) 0px, transparent 50%),
                            radial-gradient(at 0% 0%, hsla(343,100%,76%,1) 0px, transparent 50%);
        }
      `}</style>

      {/* Header and Hero Section */}
      <div className="hero-pattern px-5 pt-8 pb-16 rounded-b-[40px] shadow-sm relative overflow-hidden text-white">
        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-white/10 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 rounded-full bg-cyan-300/20 blur-2xl"></div>

        <div className="relative z-10 flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-1">你好，{session.virtualName || '旅人'}</h1>
            <div className="flex items-center gap-2">
              <span className="bg-white/20 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded border border-white/20">
                {UserModeNames[session.userMode as keyof typeof UserModeNames]}模式
              </span>
              <button
                className="flex items-center gap-1 text-[11px] text-white/90 active:opacity-70 transition-opacity"
                onClick={handleRequestLocation}
                disabled={locating}
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                {locating ? '定位中...' : locationLabel}
              </button>
            </div>
          </div>
        </div>

        {/* AI Module - Hero CTA */}
        <div className="relative z-10">
          <div className="flex items-end justify-between mb-5">
            <div>
              <p className="text-white/80 text-xs font-medium mb-1">AI 智能导览 · {effectiveConfig.name || effectiveConfig.digitalHumanName}</p>
              <h2 className="text-[28px] font-bold leading-tight">探索校园<br/>发现独特风景</h2>
            </div>
            <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-lg shrink-0">
              <XiaohaiAvatar size={36} status="idle" />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              className="flex-[3] bg-white text-primary-blue text-sm font-bold py-3.5 rounded-2xl shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2"
              onClick={handleAIStart}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              开始 AI 导览
            </button>
            <button
              disabled={!capabilityEnabled('routePlanning')}
              className="flex-[2] bg-white/15 backdrop-blur-md text-white text-sm font-bold py-3.5 rounded-2xl active:scale-95 transition-transform border border-white/30 flex items-center justify-center gap-1.5"
              onClick={handleAIPlan}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>
              帮你规划
            </button>
          </div>
          <button
            disabled={!capabilityEnabled('pointNarration') || spots.length === 0}
            onClick={() => spots[0] && void openNarration(spots[0])}
            className="mt-3 min-h-11 w-full rounded-2xl border border-white/25 bg-white/10 text-xs font-bold text-white backdrop-blur disabled:opacity-40"
          >
            {capabilityEnabled('pointNarration') ? '让小海讲解推荐点位' : '该能力当前由管理员关闭'}
          </button>
        </div>
      </div>

      <div className="px-5 relative z-20 space-y-6 -mt-8">

        {/* Quick Entrances */}
        <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          {quickIcons.map(({ icon, label, bg, textColor, page, spotType, subPage }) => (
            <button
              key={label}
              className="flex flex-col items-center gap-2 active:scale-95 transition-transform"
              onClick={() => {
                if (subPage) {
                  sessionStorage.setItem('shanhai_profile_subpage', subPage);
                  onNavigate({ page });
                } else if (page === 'chat') {
                  handleAIStart();
                } else {
                  onNavigate({ page, spotType });
                }
              }}
            >
              <div className={`w-11 h-11 ${bg} rounded-full flex items-center justify-center ${textColor} text-lg`}>
                {icon}
              </div>
              <span className="text-[11px] font-bold text-text-dark">{label}</span>
            </button>
          ))}
        </div>

        {/* Recommended Routes */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-bold text-base text-text-dark">主推路线</h2>
            <button className="text-[11px] text-primary-blue font-bold flex items-center gap-0.5 active:scale-95" onClick={() => onNavigate({ page: 'route' })}>
              全部路线 <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
          {loading ? (
            <div className="w-full h-32 flex items-center justify-center text-text-sec text-xs bg-white rounded-2xl border border-slate-100">加载中...</div>
          ) : topRoutes.length > 0 ? (
            <div className="overflow-hidden relative pb-7"
              onTouchStart={e => { setTouchEndRoute(null); setTouchStartRoute(e.targetTouches[0].clientX); }}
              onTouchMove={e => setTouchEndRoute(e.targetTouches[0].clientX)}
              onTouchEnd={() => {
                if (!touchStartRoute || touchEndRoute === null) return;
                const distance = touchStartRoute - touchEndRoute;
                if (distance > 30) handleRouteSwipe('left');
                if (distance < -30) handleRouteSwipe('right');
              }}
            >
              <div
                className="flex transition-transform duration-[280ms] ease-out"
                style={{ transform: `translate3d(-${currentRouteIndex * 100}%, 0, 0)` }}
              >
                {topRoutes.map(route => renderRouteCard(route))}
              </div>
              {topRoutes.length > 1 && (
                <div className="flex justify-center mt-3 gap-1.5 absolute bottom-0 left-0 right-0 z-10 items-center">
                  {topRoutes.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentRouteIndex(idx)}
                      className={`h-1.5 rounded-full transition-all duration-200 ${
                        currentRouteIndex === idx ? 'w-4 bg-primary-blue' : 'w-1.5 bg-slate-300'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 bg-white rounded-2xl border border-slate-100 text-slate-400 text-xs">暂无推荐路线</div>
          )}
        </div>

        {/* Spots */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-bold text-base text-text-dark">校园点位</h2>
            <button className="text-[11px] text-primary-blue font-bold active:scale-95 flex items-center gap-0.5" onClick={() => onNavigate({ page: 'map' })}>
              在地图查看 <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
          <div className="flex gap-2 mb-3 overflow-x-auto no-scrollbar pb-1 -mx-5 px-5">
            {['全部', '教学场馆', '宿舍生活区', '餐饮美食', '便民服务', '运动场地', '绿化景观'].map((category) => (
              <button
                key={category}
                className={`flex-none text-[11px] font-bold px-3 py-1.5 rounded-full transition-all border ${
                  activeCategory === category
                    ? 'bg-text-dark text-white border-text-dark shadow-sm'
                    : 'bg-white text-slate-500 border-slate-200'
                }`}
                onClick={() => { setActiveCategory(category); }}
              >
                {category}
              </button>
            ))}
          </div>

          {filteredSpots.length === 0 && !loading ? (
            <div className="text-center py-8 bg-white rounded-2xl border border-slate-100 text-slate-400 text-xs">
              该分类下暂无点位
            </div>
          ) : (
            <div className="mb-4">
              <div className="spot-marquee-viewport overflow-hidden relative pb-2 -mx-5 px-5" style={{ maskImage: 'linear-gradient(to right, transparent, black 5%, black 95%, transparent)', WebkitMaskImage: 'linear-gradient(to right, transparent, black 5%, black 95%, transparent)' }}>
                {filteredSpots.length > 1 ? (
                  <div className="flex w-max animate-seamless-marquee">
                    {[0, 1].map(groupIndex => (
                      <div
                        key={groupIndex}
                        className="flex gap-3 pr-3"
                        aria-hidden={groupIndex === 1}
                      >
                        {filteredSpots.map(spot => (
                          <div key={`${groupIndex}-${spot.id}`} className="w-[75vw] max-w-[310px] shrink-0">
                            {renderSpotCard(spot)}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="w-[75vw] max-w-[310px]">
                    {filteredSpots.map(spot => renderSpotCard(spot))}
                  </div>
                )}
              </div>
              {filteredSpots.length > 1 && (
                <div className="text-center mt-2 text-[10px] text-slate-400 flex items-center justify-center gap-1">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                  点位将自动连续展示，悬停可暂停
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
