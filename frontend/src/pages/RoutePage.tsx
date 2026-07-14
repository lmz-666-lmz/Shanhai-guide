import { useState, useEffect } from 'react';
// antd-mobile import removed (Toast migrated to ToastContext)

import type { UserSession, CampusRoute } from '../types';
import { routeApi, favoriteApi } from '../api';
import { requireAuth } from '../utils/auth';
import { resolveImageUrl, DefaultRouteCover } from '../utils/image';
import XiaohaiAvatar from '../components/XiaohaiAvatar';
import { useToast } from '../contexts/ToastContext';

interface RoutePageProps {
  session: UserSession;
  onBack: () => void;
  onNavigate: (params: { page: string; routeId?: number; initialMessage?: string }) => void;
}

const getErrorMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

export default function RoutePage({ session, onBack, onNavigate }: RoutePageProps) {
  const [routes, setRoutes] = useState<CampusRoute[]>([]);

  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchRoutes();
  }, [session]);

  const fetchRoutes = async () => {
    setLoading(true);
    setError(false);
    try {
      const [routeRes, favoriteRes] = await Promise.all([routeApi.getRoutes(), favoriteApi.getFavorites(session.sessionId, 2)]);
      setRoutes(routeRes.data.data || []);
      setFavoriteIds(new Set((favoriteRes.data.data || []).map(item => item.targetId)));
    } catch (error) {
      console.error('Failed to fetch routes:', error);
      setError(true);
      toast.error(getErrorMessage(error, '路线加载失败'));
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async (routeId: number) => {
    requireAuth(session, async () => {
      const hasFavorite = favoriteIds.has(routeId);
      try {
        if (hasFavorite) await favoriteApi.removeFavorite(session.sessionId, 2, routeId);
        else await favoriteApi.addFavorite(session.sessionId, 2, routeId);
        setFavoriteIds(prev => {
          const next = new Set(prev);
          if (hasFavorite) next.delete(routeId); else next.add(routeId);
          return next;
        });
        toast.show(hasFavorite ? '已取消收藏' : '路线收藏成功');
      } catch (error) {
        toast.error(getErrorMessage(error, '收藏操作失败'));
      }
    });
  };

  const getSpotCount = (route: CampusRoute) => {
    if (route.spots) return route.spots.length;
    try {
      return JSON.parse(route.spotOrderJson).length;
    } catch {
      return 0;
    }
  };

  const getDistance = (route: CampusRoute) => {
    return (getSpotCount(route) * 0.3).toFixed(1);
  };

// ... (in renderRouteCard)
  const renderRouteCard = (route: CampusRoute) => {
    const coverUrl = resolveImageUrl(route.coverImage);

    return (
      <div key={route.id} className="glass-card overflow-hidden mb-4 animate-fade-in border border-slate-100 flex flex-col">
        <div className="h-36 relative bg-slate-100 shrink-0">
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
        <div className="p-4 bg-white/95">
          <h3 className="font-bold text-base text-text-dark mb-1">{route.routeName}</h3>
          <p className="text-xs text-text-sec mb-3 line-clamp-2 leading-relaxed">{route.routeDesc}</p>
          {route.spots?.length > 0 && (
            <div className="mb-3 pl-2 border-l-2 border-primary-blue/20 space-y-1">
              {route.spots.map((spot, index) => <p key={spot.id} className="text-[11px] text-text-sec">{index + 1}. {spot.spotName} · {spot.spotType}</p>)}
            </div>
          )}
          <div className="flex items-center gap-4 text-xs text-text-sec mb-4">
            <span className="flex items-center gap-1 flex-1">
              <svg className="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
              {getSpotCount(route)}个点位
            </span>
            <span className="flex items-center gap-1 flex-1">
              <svg className="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              {getDistance(route)}km
            </span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-slate-100">
            <button 
              className="text-xs px-4 py-2 rounded-full font-bold active:scale-95 transition-all shadow-sm bg-blue-50 text-primary-blue border border-blue-100 flex items-center gap-1"
              onClick={() => {
                requireAuth(session, () => {
                  onNavigate({ page: 'chat', initialMessage: `请介绍一下“${route.routeName}”这条路线` });
                });
              }}
            >
              <XiaohaiAvatar size={16} status="idle" className="mr-1" />AI 讲解路线
            </button>
            <div className="flex gap-2">
              <button className="text-xs bg-amber-50 text-amber-600 px-4 py-2 rounded-full font-medium" onClick={() => toggleFavorite(route.id)}>{favoriteIds.has(route.id) ? '已收藏' : '收藏路线'}</button>
              <button 
                className="text-xs bg-primary-blue text-white px-6 py-2 rounded-full font-medium active:scale-95 transition-transform shadow-md shadow-primary-blue/20"
                onClick={() => {
                  toast.show('准备开始游览');
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

  return (
    <div className="min-h-screen bg-bg-light flex flex-col relative pb-[calc(110px+env(safe-area-inset-bottom))]">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm px-4 h-14 flex items-center justify-between">
        <button 
          className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-text-dark active:bg-gray-100 transition-colors"
          onClick={onBack}
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
        <h1 className="font-bold text-base text-text-dark">全部路线</h1>
        <div className="w-10 h-10"></div> {/* Spacer for centering */}
      </div>

      <div className="flex-1 p-4 overflow-y-auto no-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 space-y-3">
             <div className="w-8 h-8 border-4 border-primary-blue/20 border-t-primary-blue rounded-full animate-spin"></div>
             <p className="text-text-sec text-xs">正在加载全部启用路线...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 space-y-3">
             <svg className="w-10 h-10 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
             <p className="text-text-sec text-xs">路线加载失败</p>
             <button onClick={fetchRoutes} className="text-xs text-primary-blue border border-primary-blue rounded-full px-4 py-1 active:bg-blue-50">点击重试</button>
          </div>
        ) : routes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 space-y-3">
            <svg className="w-12 h-12 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21 3 6"></polygon>
              <line x1="9" y1="3" x2="9" y2="18"></line>
              <line x1="15" y1="6" x2="15" y2="21"></line>
            </svg>
            <p className="text-text-sec text-xs text-center">暂无启用路线<br/>请先在管理端添加或启用路线</p>
          </div>
        ) : (
          <div className="space-y-4 pb-6">
            {routes.map(renderRouteCard)}
          </div>
        )}
      </div>
    </div>
  );
}
