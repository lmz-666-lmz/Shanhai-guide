import { useState } from 'react';
// antd-mobile import removed (Toast migrated to ToastContext)

import type { AiRoutePlan, UserSession } from '../../types';
import { personalRouteApi } from '../../api';
import { useDigitalHuman } from '../../contexts/DigitalHumanContext';
import { useToast } from '../../contexts/ToastContext';

interface Props {
  routePlan: AiRoutePlan;
  session: UserSession;
  onNavigate: (params: { page: string; spotId?: number; navigationMode?: boolean }) => void;
}

export default function AiRoutePlanCard({ routePlan, session, onNavigate }: Props) {
  const { capabilityEnabled } = useDigitalHuman();

  const toast = useToast();
  const [saved, setSaved] = useState(false);

  if (!routePlan || !routePlan.spots?.length) return null;

  const handleSave = async () => {
    if (saved) return;
    try {
      await personalRouteApi.create({
        sessionId: session.sessionId,
        routeName: routePlan.routeName,
        routeDesc: routePlan.routeDesc,
        totalMinute: routePlan.totalMinute,
        spotOrderJson: JSON.stringify(routePlan.spots.map(spot => spot.spotId)),
        sourcePrompt: routePlan.reason,
        sourceType: 'ai',
        isFavorite: 1,
      });
      setSaved(true);
      toast.success('已收藏至个人路线');
    } catch (error: any) {
      toast.show(error?.message || '保存路线失败' );
    }
  };

  const applyRoutePlan = () => {
    sessionStorage.setItem('shanhai_profile_subpage', 'applyRoute');
    sessionStorage.setItem('shanhai_prefill_route_application', JSON.stringify({
      routeName: routePlan.routeName,
      routeDesc: routePlan.routeDesc,
      totalMinute: routePlan.totalMinute,
      spotOrderJson: JSON.stringify(routePlan.spots.map(spot => spot.spotId)),
      applicationReason: routePlan.reason || '由 AI 个性化路线预填',
    }));
    onNavigate({ page: 'profile' });
  };

  const firstSpotId = routePlan.startSpotId || routePlan.spots[0]?.spotId;
  const routeDistancePoints = Array.isArray(routePlan.mapPolyline) && routePlan.mapPolyline.length >= 2
    ? routePlan.mapPolyline
    : routePlan.spots.map(spot => [Number(spot.longitude), Number(spot.latitude)]);
  const walkingDistance = routePlan.walkingDistance || routeDistancePoints.slice(1).reduce((sum, point, index) => {
    const prev = routeDistancePoints[index];
    const dx = (Number(point[0]) - Number(prev[0])) * 111320 * Math.cos(Number(prev[1]) * Math.PI / 180);
    const dy = (Number(point[1]) - Number(prev[1])) * 110540;
    return sum + Math.sqrt(dx * dx + dy * dy);
  }, 0);
  const difficulty = routePlan.difficulty || (walkingDistance < 1200 ? '轻松' : walkingDistance < 2600 ? '适中' : '进阶');

  const openInMap = (navigationMode: boolean) => {
    sessionStorage.setItem('shanhai_ai_route', JSON.stringify(routePlan));
    onNavigate({ page: 'map', spotId: firstSpotId, navigationMode });
  };

  return (
    <div className="mt-3 bg-white border border-emerald-100 rounded-2xl overflow-hidden shadow-sm flex flex-col relative">
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-emerald-50 to-transparent rounded-bl-full pointer-events-none opacity-60"></div>
      
      <div className="p-3.5 relative z-10">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">AI 路线推荐</span>
              <span className="text-[10px] text-slate-400 font-medium">共 {routePlan.spots.length} 站</span>
            </div>
            <h4 className="font-bold text-[15px] text-slate-800 leading-tight">{routePlan.routeName}</h4>
          </div>
          <div className="shrink-0 flex flex-col items-end">
            <span className="text-xl font-extrabold text-emerald-600">{routePlan.totalMinute}<span className="text-[10px] font-bold text-emerald-600/70 ml-0.5">min</span></span>
          </div>
        </div>
        
        <p className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 px-2.5 py-2 rounded-xl mb-3">
          <span className="font-bold text-slate-600">推荐理由：</span>{routePlan.routeDesc || routePlan.reason}
        </p>
        <div className="mb-3 grid grid-cols-2 gap-2 text-[10px]">
          <div className="rounded-xl bg-emerald-50 p-2"><span className="text-slate-400">难度</span><p className="mt-0.5 font-bold text-emerald-700">{difficulty}</p></div>
          <div className="rounded-xl bg-blue-50 p-2"><span className="text-slate-400">步行距离</span><p className="mt-0.5 font-bold text-primary-blue">约 {Math.round(walkingDistance)} 米</p></div>
          <div className="rounded-xl bg-slate-50 p-2"><span className="text-slate-400">适合人群</span><p className="mt-0.5 font-bold text-slate-700">{routePlan.suitableAudience?.join('、') || ({ fresh: '新生', alumni: '校友', parent: '家长', research: '研学', senior: '长者' } as Record<string, string>)[session.userMode] || '校园访客'}</p></div>
          <div className="rounded-xl bg-slate-50 p-2"><span className="text-slate-400">路线友好度</span><p className="mt-0.5 font-bold text-slate-700">{routePlan.hasRestStops === false ? '连续游览' : '含休息点'} · {routePlan.accessibleFriendly === false ? '常规路线' : '无障碍友好'}</p></div>
        </div>

        {/* 紧凑的时间线展示 */}
        <div className="relative pl-4 space-y-3 mb-1">
          <div className="absolute left-1.5 top-2 bottom-2 w-[1.5px] bg-emerald-100"></div>
          {routePlan.spots.slice(0, 5).map((spot, index) => (
            <div key={`${spot.spotId}-${index}`} className="relative flex gap-2.5 items-start">
              <div className="absolute -left-4 w-3 h-3 rounded-full bg-emerald-50 border-2 border-emerald-400 flex items-center justify-center mt-0.5 z-10"></div>
              <div className="min-w-0 flex-1 flex justify-between items-start gap-2">
                <p className="font-bold text-xs text-slate-700 truncate">{spot.spotName}</p>
                <div className="text-[9px] text-slate-400 shrink-0 text-right">
                  {spot.walkMinuteFromPrev ? <span className="text-emerald-600/70">步行 {spot.walkMinuteFromPrev}分</span> : null}
                  {spot.walkMinuteFromPrev && <span className="mx-1">·</span>}
                  停留 {spot.stayMinute || 15}分
                </div>
              </div>
            </div>
          ))}
          {routePlan.spots.length > 5 && (
            <div className="relative flex gap-2.5 items-start">
              <div className="absolute -left-4 w-3 h-3 rounded-full bg-white border-[1.5px] border-slate-300 flex items-center justify-center mt-0.5 z-10"></div>
              <p className="text-[10px] font-bold text-slate-400 mt-0.5">还有 {routePlan.spots.length - 5} 个点位...</p>
            </div>
          )}
        </div>
      </div>

      <div className="px-3.5 pb-3.5 pt-1 grid grid-cols-2 gap-2 relative z-10 mt-auto">
        <button
          disabled={!capabilityEnabled('mapCompanion')}
          className="col-span-2 bg-emerald-500 text-white rounded-xl py-2.5 text-sm font-bold active:scale-[0.98] transition-transform shadow-md shadow-emerald-500/20"
          onClick={() => openInMap(true)}
        >
          开始游览
        </button>
        <button
          disabled={!capabilityEnabled('mapCompanion')}
          className="bg-slate-50 text-slate-700 border border-slate-100 rounded-xl py-2 text-[11px] font-bold active:bg-slate-100 transition-colors"
          onClick={() => openInMap(false)}
        >
          在地图中预览
        </button>
        <button 
          className={`border rounded-xl py-2 text-[11px] font-bold transition-all ${saved ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-700 border-slate-100 active:bg-slate-100'}`} 
          onClick={handleSave}
        >
          {saved ? '已收藏' : '收藏路线'}
        </button>
        <button 
          disabled={!capabilityEnabled('cocreateRecommendation')}
          className="col-span-2 mt-0.5 text-slate-400 hover:text-slate-600 rounded-lg py-1.5 text-[10px] active:bg-slate-50 transition-colors underline underline-offset-2" 
          onClick={applyRoutePlan}
        >
          将此路线编辑并提交共创申请
        </button>
      </div>
    </div>
  );
}
