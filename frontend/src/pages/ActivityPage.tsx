import { useState, useEffect } from 'react';
import { Modal } from 'antd-mobile';

import type { UserSession, CampusActivity } from '../types';
import { activityApi, reserveApi } from '../api';

import { resolveImageUrl, DefaultActivityCover } from '../utils/image';
import { useToast } from '../contexts/ToastContext';

interface ActivityPageProps {
  session: UserSession;
  onNavigate: (params: { page: string; routeId?: number; spotId?: number; spotType?: string; initialMessage?: string }) => void;
  onBack: () => void;
}

const activityCategories = [
  { key: '全部', label: '全部' },
  { key: '学术讲座', label: '学术讲座' },
  { key: '文体活动', label: '文体活动' },
  { key: '校友活动', label: '校友活动' },
];

const categoryIcon = (key: string, active: boolean) => {
  const cls = `w-3.5 h-3.5 ${active ? 'text-primary-blue' : 'text-white/70'}`;
  const svg = (d: string) => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d={d}/></svg>;
  switch (key) {
    case '全部': return svg('M3 4h18M3 8h18M3 12h18M3 16h18M3 20h18');
    case '学术讲座': return svg('M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z');
    case '文体活动': return svg('M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0');
    case '校友活动': return svg('M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75');
    default: return null;
  }
};

const getErrorMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

export default function ActivityPage({ session, onNavigate, onBack }: ActivityPageProps) {
  const [activities, setActivities] = useState<CampusActivity[]>([]);

  const toast = useToast();
  const [activeCategory, setActiveCategory] = useState('全部');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reservedMap, setReservedMap] = useState<Record<number, boolean>>({});

  useEffect(() => {
    fetchActivities();
  }, [activeCategory]);

  const fetchActivities = async () => {
    setLoading(true);
    setError(false);
    try {
      const [response, reserveResponse] = await Promise.all([
        activityApi.getActivities(),
        session.userMode === 'guest' ? Promise.resolve(null) : reserveApi.getReserves(session.sessionId),
      ]);
      const activeReserves = (reserveResponse?.data.data || []).filter(item => item.reserveStatus === 1);
      const nextReservedMap = Object.fromEntries(activeReserves.map(item => [item.activityId, true]));

      const allActivities = ((response.data.data as CampusActivity[]) || []);
      setReservedMap(nextReservedMap);

      let filtered = allActivities.filter(item => String(item.activityType) !== '通知' && String(item.activityType) !== '校园通知');
      if (activeCategory !== '全部') {
        filtered = filtered.filter(item => {
          const type = item.activityType || getCategory(item.activityTitle);
          return type.includes(activeCategory.substring(0, 2));
        });
      }
      setActivities(filtered);
    } catch (error) {
      console.error('Failed to fetch activities:', error);
      setError(true);
      toast.error(getErrorMessage(error, '活动加载失败'));
    } finally {
      setLoading(false);
    }
  };

  const handleReserve = async (activity: CampusActivity) => {
    if (session.userMode === 'guest') {
      Modal.alert({
        content: '游客模式暂不开放预约功能，请注册或登录',
        confirmText: '我知道了',
      });
      return;
    }

    if (reservedMap[activity.id]) {
      try {
        await reserveApi.cancelReserve(session.sessionId, activity.id);
        await fetchActivities();
        toast.show('已取消预约');
      } catch (error) {
        console.error('Failed to cancel reserve:', error);
        toast.error(getErrorMessage(error, '取消预约失败，请稍后重试'));
      }
    } else {
      if (activity.isReserve !== 1) {
        toast.error('该活动暂未开放报名');
        return;
      }
      if (activity.reserveLimit > 0 && activity.reservedCount >= activity.reserveLimit) {
        toast.error('活动名额已满');
        return;
      }
      setLoading(true);
      try {
        await reserveApi.addReserve(session.sessionId, activity.id);
        await fetchActivities();
        toast.success('预约成功');
      } catch (error) {
        console.error('Failed to reserve:', error);
        toast.error(getErrorMessage(error, '预约失败，请稍后重试'));
      } finally {
        setLoading(false);
      }
    }
  };

  const handleAIAsk = (activityName: string) => {
    if (session.userMode === 'guest') {
      Modal.alert({
        content: '游客模式暂不支持 AI 咨询，请注册或登录',
        confirmText: '我知道了',
      });
      return;
    }
    onNavigate({ page: 'chat', initialMessage: `这个活动适合我参加吗？活动名称：${activityName}` });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return '今天';
    if (days === 1) return '明天';
    if (days === 2) return '后天';
    if (days > 2 && days <= 7) return `本周${['日', '一', '二', '三', '四', '五', '六'][date.getDay()]}`;

    return `${date.getMonth() + 1}月${date.getDate()}日`;
  };

  const getTime = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const getCategory = (title: string) => {
    if (title.includes('讲座') || title.includes('学术') || title.includes('大赛')) return '学术讲座';
    if (title.includes('马拉松') || title.includes('展览') || title.includes('艺术')) return '文体活动';
    if (title.includes('校友')) return '校友活动';
    return '文体活动';
  };

  const getCategoryColor = (category: string) => {
    if (category.includes('学术')) return { bg: 'bg-blue-50', text: 'text-blue-600', bar: 'bg-blue-500' };
    if (category.includes('文体')) return { bg: 'bg-orange-50', text: 'text-orange-600', bar: 'bg-orange-500' };
    if (category.includes('校友')) return { bg: 'bg-emerald-50', text: 'text-emerald-600', bar: 'bg-emerald-500' };
    return { bg: 'bg-slate-50', text: 'text-slate-600', bar: 'bg-slate-500' };
  };

  return (
    <div className="min-h-screen bg-[#F7F9FC] pb-[calc(100px+env(safe-area-inset-bottom))]">
      {/* Header — compact blue banner */}
      <div className="relative bg-gradient-to-br from-primary-blue via-blue-600 to-indigo-600 px-4 pt-[calc(12px+env(safe-area-inset-top))] pb-4 overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl"></div>
        <div className="relative z-10">
          {/* Title bar: back + title + reserves */}
          <div className="flex items-center justify-between">
            <button className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center active:scale-95 transition-transform" onClick={onBack}>
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <h1 className="text-lg font-extrabold text-white tracking-wide">校园活动</h1>
            <button
              className="flex items-center gap-1 px-3 py-1.5 bg-white/20 rounded-full text-xs font-bold text-white active:scale-95 transition-transform"
              onClick={() => {
                if (session.userMode === 'guest') {
                  Modal.alert({ content: '游客模式暂不开放此功能，请注册正式账号获取完整体验。', confirmText: '我知道了' });
                  return;
                }
                sessionStorage.setItem('shanhai_profile_subpage', 'reserves');
                onNavigate({ page: 'profile' });
              }}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>
              我的预约
            </button>
          </div>
          {/* Category Pills — fully scrollable */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar mt-3 pb-1">
            {activityCategories.map(({ key, label }) => (
              <button
                key={key}
                className={`flex-none text-[11px] font-bold px-4 py-2 rounded-full transition-all flex items-center gap-1.5 ${
                  activeCategory === key
                    ? 'bg-white text-primary-blue shadow-lg shadow-black/10'
                    : 'bg-white/15 text-white/80 hover:bg-white/25'
                }`}
                onClick={() => setActiveCategory(key)}
              >
                {categoryIcon(key, activeCategory === key)}
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-3 space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center mb-4">
              <div className="w-5 h-5 border-2 border-primary-blue/20 border-t-primary-blue rounded-full animate-spin"></div>
            </div>
            <p className="text-slate-400 text-xs">正在加载活动...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <p className="text-slate-500 text-sm font-bold mb-1">活动加载失败</p>
            <p className="text-slate-400 text-[11px] mb-4">请检查网络后重试</p>
            <button onClick={fetchActivities} className="text-xs font-bold text-white bg-primary-blue rounded-full px-6 py-2.5 active:scale-95 shadow-md shadow-blue-500/20">重新加载</button>
          </div>
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <p className="text-slate-500 text-sm font-bold mb-1">
              {activeCategory === '全部' ? '暂无校园活动' : `暂无${activeCategory}`}
            </p>
            {activeCategory !== '全部' ? (
              <button className="text-[11px] font-bold text-primary-blue mt-2 active:scale-95" onClick={() => setActiveCategory('全部')}>
                查看全部活动 →
              </button>
            ) : (
              <p className="text-slate-400 text-[11px]">活动信息持续更新中，敬请期待</p>
            )}
          </div>
        ) : (
          activities.map((activity) => {
            const category = activity.activityType || getCategory(activity.activityTitle);
            const reservedCount = activity.reservedCount || 0;
            const isCapacityLimited = typeof activity.reserveLimit === 'number' && activity.reserveLimit > 0;
            const isFull = isCapacityLimited && reservedCount >= activity.reserveLimit;
            const isReserveOpen = activity.isReserve === 1;
            const isReserved = reservedMap[activity.id];
            const catColors = getCategoryColor(category);

            // Determine activity status
            const now = new Date();
            const activityDate = new Date(activity.activityTime);
            let statusTag: { text: string; bg: string };
            if (!isReserveOpen && !isReserved) {
              statusTag = { text: '已结束', bg: 'bg-slate-400' };
            } else if (isFull) {
              statusTag = { text: '已满员', bg: 'bg-orange-500' };
            } else if (isReserved) {
              statusTag = { text: '已报名', bg: 'bg-emerald-500' };
            } else if (activityDate < now) {
              statusTag = { text: '已结束', bg: 'bg-slate-400' };
            } else {
              statusTag = { text: '报名中', bg: 'bg-emerald-500' };
            }

            // Main button logic
            let mainBtn: { text: string; style: string; disabled: boolean } = { text: '查看详情', style: 'bg-slate-100 text-slate-500', disabled: false };
            if (isReserved) {
              mainBtn = { text: '查看预约', style: 'bg-primary-blue text-white shadow-md shadow-blue-500/20', disabled: false };
            } else if (isFull) {
              mainBtn = { text: '已满员', style: 'bg-orange-50 text-orange-500', disabled: true };
            } else if (activityDate < now && !isReserveOpen) {
              mainBtn = { text: '已结束', style: 'bg-slate-100 text-slate-400', disabled: true };
            } else if (isReserveOpen) {
              mainBtn = { text: '立即报名', style: 'bg-primary-blue text-white shadow-md shadow-blue-500/20', disabled: false };
            }

            const mainAction = () => {
              if (isReserved) {
                // Navigate to reserves
                sessionStorage.setItem('shanhai_profile_subpage', 'reserves');
                onNavigate({ page: 'profile' });
              } else if (isReserveOpen && !isFull) {
                handleReserve(activity);
              }
            };

            return (
              <div key={activity.id} className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col active:scale-[0.99]">
                {/* Image Area - fixed aspect ratio 16:9 */}
                <div className="relative bg-slate-100 shrink-0" style={{ paddingBottom: '56.25%' /* 16:9 */ }}>
                  <div className="absolute inset-0">
                    {(() => {
                      const imgUrl = resolveImageUrl(activity.activityImage);
                      if (imgUrl) {
                        return (
                          <img
                            src={imgUrl}
                            alt={activity.activityTitle}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                              (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        );
                      }
                      return null;
                    })()}
                    <div className={`w-full h-full absolute inset-0 ${resolveImageUrl(activity.activityImage) ? 'hidden' : ''}`}>
                      <DefaultActivityCover category={category} className="w-full h-full" />
                    </div>
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none"></div>
                  </div>

                  {/* Date chip */}
                  <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-slate-800 rounded-xl px-3 py-1.5 shadow-sm flex items-center gap-1.5 z-10">
                    <svg className="w-3.5 h-3.5 text-primary-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    <span className="text-[11px] font-bold">{formatDate(activity.activityTime)}</span>
                    <span className="text-[11px] text-slate-500">{getTime(activity.activityTime)}</span>
                  </div>

                  {/* Status badge */}
                  <div className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-bold text-white ${statusTag.bg} shadow-sm backdrop-blur-sm z-10`}>
                    {statusTag.text}
                  </div>
                </div>

                {/* Content Area */}
                <div className="p-3 flex flex-col">
                  {/* Category + Title */}
                  <span className={`self-start text-[10px] font-bold px-2 py-0.5 rounded-full mb-1.5 ${catColors.bg} ${catColors.text}`}>
                    {category}
                  </span>
                  <h3 className="font-bold text-sm text-slate-800 leading-snug mb-2 line-clamp-2">
                    {activity.activityTitle}
                  </h3>

                  {/* Info — compact */}
                  <div className="space-y-1.5 mb-3">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      <svg className="w-3 h-3 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3"/><path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662"/></svg>
                      <span className="truncate">{activity.activityDesc || '地点详情见活动介绍'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      <svg className="w-3 h-3 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                      {isCapacityLimited ? (
                        <span><span className="font-bold text-slate-700">{reservedCount}</span>/{activity.reserveLimit} 人</span>
                      ) : (
                        <span><span className="font-bold text-slate-700">{reservedCount}</span> 人已报名</span>
                      )}
                      {isCapacityLimited && (
                        <span className="text-[10px] text-slate-400 ml-auto">{Math.round(reservedCount / activity.reserveLimit * 100)}%</span>
                      )}
                    </div>
                    {/* Progress bar — only when capacity limited */}
                    {isCapacityLimited && (
                      <div className={`h-1 overflow-hidden rounded-full bg-slate-100 ${isFull ? 'bg-orange-100' : ''}`}>
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${isFull ? 'bg-orange-400' : catColors.bar}`}
                          style={{ width: `${Math.min(100, Math.round(reservedCount / activity.reserveLimit * 100))}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-50 mt-auto">
                    <button
                      className="flex items-center gap-1.5 text-[11px] font-bold text-primary-blue bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-xl active:scale-95 transition-all"
                      onClick={() => handleAIAsk(activity.activityTitle)}
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                      AI 咨询
                    </button>
                    <div className="flex-1" />
                    <button
                      className={`text-[11px] font-bold px-5 py-2.5 rounded-xl active:scale-95 transition-all ${mainBtn.style} ${mainBtn.disabled ? 'cursor-not-allowed' : 'hover:shadow-lg'}`}
                      onClick={mainAction}
                      disabled={mainBtn.disabled}
                    >
                      {mainBtn.text}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
