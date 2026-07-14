import { useEffect, useRef, useState } from 'react';
import { Rate, Modal } from 'antd-mobile';
import type {
  ActivityReserve,
  Badge,
  BadgeProgress,
  CampusActivity,
  CampusRoute,
  CampusSpot,
  DigitalHumanUserConfig,
  ProfileStatistics,
  UserCheckin,
  UserFavorite,
  UserFeedback,
  UserMessage,
  UserContentApplication,
  UserSession,
  PersonalRoute,
} from '../types';
import { UserModeNames } from '../types';
import { activityApi, badgeApi, checkinApi, contentApplicationApi, favoriteApi, feedbackApi, messageApi, personalRouteApi, reserveApi, routeApi, spotApi, userApi } from '../api';
import BadgeIconView from '../components/BadgeIconView';
import CampusMapSelector from '../components/map/CampusMapSelector';
import XiaohaiAvatar from '../components/XiaohaiAvatar';
import { resolveImageUrl, DefaultSpotCover, DefaultRouteCover, DefaultActivityCover } from '../utils/image';
import { useDigitalHuman } from '../contexts/DigitalHumanContext';
import { useToast } from '../contexts/ToastContext';
import { speechService } from '../utils/speechService';

declare const AMap: any;

interface ProfilePageProps {
  session: UserSession;
  onLogout: () => void;
  onSessionUpdate: (session: UserSession) => void;
  onNavigate: (params: { page: string; routeId?: number; spotId?: number }) => void;
  onBack: () => void;
}

type ProfileSubPage =
  | 'history'
  | 'favoriteSpots'
  | 'favoriteRoutes'
  | 'personalRoutes'
  | 'reserves'
  | 'messages'
  | 'applySpot'
  | 'applyRoute'
  | 'applications'
  | 'badges'
  | 'feedback'
  | 'settings'
  | 'digital'
  | 'cocreate';

interface SubPageData {
  favorites: UserFavorite[];
  spots: CampusSpot[];
  routes: CampusRoute[];
  checkins: UserCheckin[];
  reserves: ActivityReserve[];
  activities: CampusActivity[];
  feedbacks: UserFeedback[];
  messages: UserMessage[];
  applications: UserContentApplication[];
  personalRoutes: PersonalRoute[];
}

const emptyData: SubPageData = {
  favorites: [],
  spots: [],
  routes: [],
  checkins: [],
  reserves: [],
  activities: [],
  feedbacks: [],
  messages: [],
  applications: [],
  personalRoutes: [],
};

const avatarStyles = ['校园讲解员', '青春学子', '资深教授', '活泼向导', '长者友好'];
const voiceTypes = ['温柔女声', '亲切男声', '活力女声', '沉稳男声'];

const getErrorMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

const formatDateTime = (value?: string) => {
  if (!value) return '时间待定';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
};

const subPageTitles: Record<ProfileSubPage, string> = {
  personalRoutes: '个人 AI 路线',
  history: '历史行程',
  favoriteSpots: '收藏点位',
  favoriteRoutes: '收藏路线',
  reserves: '我的预约',
  messages: '消息中心',
  applySpot: '申请新增点位',
  applyRoute: '申请新增路线',
  applications: '我的申请',
  badges: '成就墙',
  feedback: '游览体验反馈',
  settings: '系统设置',
  digital: '数字人设置',
  cocreate: '共创校园',
};

const messageTypeNames: Record<UserMessage['messageType'], string> = {
  system: '系统消息',
  activity: '活动通知',
  application: '申请审核',
  badge: '成就消息',
  feedback: '反馈回复',
};

const SvgIcon = ({ name, className = "w-5 h-5" }: { name: string; className?: string }) => {
  switch (name) {
    case 'user': return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
    case 'history': return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
    case 'spot': return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>;
    case 'route': return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2z"/><path d="M3 19a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v2z"/></svg>;
    case 'reserve': return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
    case 'message': return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
    case 'badge': return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>;
    case 'feedback': return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
    case 'settings': return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
    case 'ai': return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3l1.9 4.1L18 9l-4.1 1.9L12 15l-1.9-4.1L6 9l4.1-1.9L12 3z"/><path d="M19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14z"/><path d="M5 14l.7 1.3L7 16l-1.3.7L5 18l-.7-1.3L3 16l1.3-.7L5 14z"/></svg>;
    case 'edit': return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>;
    case 'status': return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>;
    case 'campus': return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21h18"/><path d="M5 21V9l7-4 7 4v12"/><path d="M9 21v-6h6v6"/><path d="M9 10h.01M12 10h.01M15 10h.01"/></svg>;
    case 'chevron-right': return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>;
    case 'back': return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>;
    default: return null;
  }
};

export default function ProfilePage({ session, onLogout, onSessionUpdate, onNavigate, onBack }: ProfilePageProps) {
  const { userConfig, effectiveConfig, globalConfig, saveUserConfig, restoreAdminDefaults, capabilityEnabled } = useDigitalHuman();
  const toast = useToast();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [badgeProgress, setBadgeProgress] = useState<BadgeProgress[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [profileStats, setProfileStats] = useState<ProfileStatistics>({ checkinCount: 0, favoriteSpotCount: 0, favoriteRouteCount: 0, activityCount: 0, badgeCount: 0 });
  const [digitalDraft, setDigitalDraft] = useState<DigitalHumanUserConfig>(userConfig);
  const digitalConfig = {
    talkStyle: userConfig.answerStyle,
    voiceType: userConfig.voiceType,
    speechSpeed: userConfig.speechSpeed,
    welcomeText: effectiveConfig.welcomeTextsByMode?.[session.userMode] || effectiveConfig.welcomeText,
    digitalHumanName: effectiveConfig.name || effectiveConfig.digitalHumanName,
  };
  const [subPage, setSubPage] = useState<ProfileSubPage | null>(null);
  const [subPageParent, setSubPageParent] = useState<ProfileSubPage | null>(null);
  const [subData, setSubData] = useState<SubPageData>(emptyData);
  const [subLoading, setSubLoading] = useState(false);
  const [subError, setSubError] = useState('');
  const [score, setScore] = useState(4);
  const [feedbackContent, setFeedbackContent] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState({
    virtualName: session.virtualName,
    userMode: session.userMode,
    virtualCollege: session.virtualCollege,
    virtualMajor: session.virtualMajor,
    virtualYear: session.virtualYear,
  });
  const [spotApplication, setSpotApplication] = useState({
    spotName: '',
    spotType: '教学场馆',
    longitude: '',
    latitude: '',
    openTime: '',
    recommendTime: 15,
    spotDesc: '',
    spotImage: '',
    suitableMode: 'alumni,fresh,parent,research,senior',
    applicationReason: '',
  });
  const [routeApplication, setRouteApplication] = useState({
    routeName: '',
    routeDesc: '',
    totalMinute: 60,
    coverImage: '',
    suitableMode: 'alumni,fresh,parent,research,senior',
    applicationReason: '',
  });
  const [routeSpotIds, setRouteSpotIds] = useState<number[]>([]);

  // --- Map picker state ---
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [mapPickerMode, setMapPickerMode] = useState<'single-point' | 'route'>('single-point');
  const [mapPickerSource, setMapPickerSource] = useState<'applySpot' | 'applyRoute' | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<{ lng: number; lat: number } | null>(null);

  const [routeSpotSearch, setRouteSpotSearch] = useState('');
  const [routeSpotFilter, setRouteSpotFilter] = useState('全部');

  // History page state (at top level to avoid conditional hooks)
  const [historyFilter, setHistoryFilter] = useState<'全部' | '路线游览' | '点位打卡'>('全部');
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const latestTripRef = useRef<HTMLDivElement | null>(null);

  /** 将 base64 图片压缩到 maxDim 以内，输出 JPEG 质量 quality (0-1) */
  const compressImageBase64 = (base64: string, maxDim = 800, quality = 0.75): Promise<string> => {
    return new Promise((resolve, _reject) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width <= maxDim && height <= maxDim) { resolve(base64); return; }
        if (width > height) { height = Math.round(height * maxDim / width); width = maxDim; }
        else { width = Math.round(width * maxDim / height); height = maxDim; }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(base64); return; }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(base64);
      img.src = base64;
    });
  };

  const readFileAsCompressedBase64 = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressed = await compressImageBase64(reader.result as string);
        resolve(compressed);
      };
      reader.readAsDataURL(file);
    });
  };

  const haversineMeters = (a: { lng: number; lat: number }, b: { lng: number; lat: number }) => {
    const R = 6371000;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const sinLat = Math.sin(dLat / 2);
    const sinLng = Math.sin(dLng / 2);
    const h = sinLat * sinLat + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * sinLng * sinLng;
    return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  };

  const estimateWalkMinutes = (spots: CampusSpot[]) => {
    if (spots.length < 2) return 0;
    let totalMeters = 0;
    for (let i = 0; i < spots.length - 1; i++) {
      totalMeters += haversineMeters(
        { lng: Number(spots[i].longitude), lat: Number(spots[i].latitude) },
        { lng: Number(spots[i + 1].longitude), lat: Number(spots[i + 1].latitude) },
      );
    }
    return Math.max(1, Math.round(totalMeters / 75));
  };

  useEffect(() => {
    fetchBaseData();
  }, [session.sessionId]);

  useEffect(() => setDigitalDraft(userConfig), [userConfig]);

  useEffect(() => {
    if (subPage) loadSubPageData(subPage);
  }, [subPage]);

  useEffect(() => {
    if (subPage !== 'applyRoute') return;
    const raw = sessionStorage.getItem('shanhai_prefill_route_application');
    if (!raw) return;
    try {
      const prefill = JSON.parse(raw);
      setRouteApplication(prev => ({
        ...prev,
        routeName: prefill.routeName || prev.routeName,
        routeDesc: prefill.routeDesc || prev.routeDesc,
        totalMinute: Number(prefill.totalMinute || prev.totalMinute),
        applicationReason: prefill.applicationReason || prev.applicationReason,
      }));
      const ids = JSON.parse(prefill.spotOrderJson || '[]');
      if (Array.isArray(ids)) setRouteSpotIds(ids.map(Number).filter(Boolean));
      toast.info('已预填 AI 路线');
    } catch {
      // ignore invalid prefill payload
    } finally {
      sessionStorage.removeItem('shanhai_prefill_route_application');
    }
  }, [subPage]);

  useEffect(() => {
    const openRequestedPage = (event?: Event) => {
      const requested = (event as CustomEvent<{ page?: ProfileSubPage }> | undefined)?.detail?.page
        || sessionStorage.getItem('shanhai_profile_subpage');
      if (requested) {
        sessionStorage.removeItem('shanhai_profile_subpage');
        setSubPage(requested as ProfileSubPage);
      }
    };
    openRequestedPage();
    window.addEventListener('shanhai:open-profile-subpage', openRequestedPage);
    return () => window.removeEventListener('shanhai:open-profile-subpage', openRequestedPage);
  }, []);

  // Auto-calc duration when route spots change
  useEffect(() => {
    if (subPage !== 'applyRoute') return;
    const selectedSpots = routeSpotIds.map(id => subData.spots.find(s => s.id === id)).filter(Boolean) as CampusSpot[];
    if (selectedSpots.length >= 2) {
      const minutes = estimateWalkMinutes(selectedSpots) + selectedSpots.reduce((sum, s) => sum + (s.recommendTime || 15), 0);
      setRouteApplication(prev => ({ ...prev, totalMinute: minutes }));
    }
  }, [routeSpotIds, subPage]);

  useEffect(() => {
    if (subPage !== 'applySpot' && subPage !== 'applyRoute') {
      setMapPickerOpen(false);
      setMapPickerSource(null);
    }
  }, [subPage]);

  const fetchBaseData = async () => {
    if (session.userMode === 'guest') {
      setBadges([]);
      setBadgeProgress([]);
      setUnreadCount(0);
      setProfileStats({ checkinCount: 0, favoriteSpotCount: 0, favoriteRouteCount: 0, activityCount: 0, badgeCount: 0 });
      return;
    }
    try {
      const [badgeRes, progressRes, statsRes, unreadRes] = await Promise.all([
        badgeApi.getMyBadges(session.sessionId),
        badgeApi.getProgress(session.sessionId),
        userApi.getStatistics(session.sessionId),
        messageApi.getUnreadCount(session.sessionId),
      ]);
      setBadges(badgeRes.data.data || []);
      setBadgeProgress(progressRes.data.data || []);
      setProfileStats(statsRes.data.data || profileStats);
      setUnreadCount(unreadRes.data.data || 0);
    } catch (error) {
      toast.error(getErrorMessage(error, '个人数据加载失败'));
    }
  };

  const loadSubPageData = async (page: ProfileSubPage) => {
    setSubLoading(true);
    setSubError('');
    try {
      if (page === 'history') {
        const [checkinsRes, spotsRes, routesRes] = await Promise.all([
          checkinApi.getHistory(session.sessionId),
          spotApi.getSpots(),
          routeApi.getRoutes(),
        ]);
        setSubData(prev => ({ ...prev, checkins: checkinsRes.data.data || [], spots: spotsRes.data.data || [], routes: routesRes.data.data || [] }));
      } else if (page === 'favoriteSpots' || page === 'favoriteRoutes') {
        const [favoritesRes, spotsRes, routesRes] = await Promise.all([
          favoriteApi.getFavorites(session.sessionId),
          spotApi.getSpots(),
          routeApi.getRoutes(),
        ]);
        setSubData(prev => ({ ...prev, favorites: favoritesRes.data.data || [], spots: spotsRes.data.data || [], routes: routesRes.data.data || [] }));
      } else if (page === 'reserves') {
        const [reservesRes, activitiesRes] = await Promise.all([
          reserveApi.getReserves(session.sessionId),
          activityApi.getActivities(),
        ]);
        setSubData(prev => ({ ...prev, reserves: reservesRes.data.data || [], activities: activitiesRes.data.data || [] }));
      } else if (page === 'messages') {
        const messageRes = await messageApi.getMessages(session.sessionId, 1, 50);
        setSubData(prev => ({ ...prev, messages: messageRes.data.data?.records || [] }));
      } else if (page === 'applications') {
        const applicationRes = await contentApplicationApi.getMyApplications(session.sessionId);
        setSubData(prev => ({ ...prev, applications: applicationRes.data.data || [] }));
      } else if (page === 'personalRoutes') {
        const [personalRouteRes, spotsRes] = await Promise.all([personalRouteApi.list(session.sessionId), spotApi.getSpots()]);
        setSubData(prev => ({ ...prev, personalRoutes: personalRouteRes.data.data || [], spots: spotsRes.data.data || [] }));
      } else if (page === 'applyRoute' || page === 'applySpot') {
        const spotsRes = await spotApi.getSpots();
        setSubData(prev => ({ ...prev, spots: spotsRes.data.data || [] }));
      } else if (page === 'feedback') {
        const feedbackRes = await feedbackApi.getMyFeedbacks(session.sessionId);
        setSubData(prev => ({ ...prev, feedbacks: feedbackRes.data.data || [] }));
      }
    } catch (error) {
      const message = getErrorMessage(error, `${subPageTitles[page]}加载失败`);
      setSubError(message);
      toast.show(message);
    } finally {
      setSubLoading(false);
    }
  };

  const saveProfile = async () => {
    if (!profileDraft.virtualName.trim()) {
      toast.warning('显示名称不能为空');
      return;
    }
    setSavingProfile(true);
    try {
      const response = await userApi.updateSession(session.sessionId, profileDraft);
      onSessionUpdate(response.data.data);
      toast.success('个人资料已更新');
    } catch (error) {
      toast.error(getErrorMessage(error, '保存失败'));
    } finally {
      setSavingProfile(false);
    }
  };

  const removeFavorite = async (favoriteType: number, targetId: number) => {
    try {
      await favoriteApi.removeFavorite(session.sessionId, favoriteType, targetId);
      toast.success('已取消收藏');
      if (subPage) await loadSubPageData(subPage);
      await fetchBaseData();
    } catch (error) {
      toast.error(getErrorMessage(error, '取消收藏失败'));
    }
  };

  const cancelReserve = async (activityId: number) => {
    try {
      await reserveApi.cancelReserve(session.sessionId, activityId);
      toast.success('已取消预约');
      await loadSubPageData('reserves');
      await fetchBaseData();
    } catch (error) {
      toast.error(getErrorMessage(error, '取消预约失败'));
    }
  };

  const submitFeedback = async () => {
    if (!feedbackContent.trim()) {
      toast.warning('请先填写反馈内容');
      return;
    }
    try {
      await feedbackApi.submit(session.sessionId, session.userMode, score, 'overall', feedbackContent);
      toast.success('反馈已提交');
      setFeedbackContent('');
      await loadSubPageData('feedback');
    } catch (error) {
      toast.error(getErrorMessage(error, '提交失败'));
    }
  };

  const submitSpotApplication = async () => {
    if (!spotApplication.spotName.trim() || !spotApplication.spotDesc.trim()) {
      toast.warning('请填写点位名称和简介');
      return;
    }
    if (!selectedPosition) {
      toast.warning('请在地图上点击选择点位位置');
      return;
    }
    const longitude = Number(spotApplication.longitude);
    const latitude = Number(spotApplication.latitude);
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
      toast.warning('请在地图上点击选择点位位置');
      return;
    }
    try {
      await contentApplicationApi.submitSpot({
        sessionId: session.sessionId,
        ...spotApplication,
        spotImage: spotApplication.spotImage || undefined,
        longitude,
        latitude,
      });
      toast.success('点位申请已提交');
      setSpotApplication(prev => ({ ...prev, spotName: '', longitude: '', latitude: '', spotDesc: '', applicationReason: '' }));
      setSelectedPosition(null);
      setSubPage('applications');
    } catch (error) {
      toast.error(getErrorMessage(error, '提交失败'));
    }
  };

  const submitRouteApplication = async () => {
    if (!routeApplication.routeName.trim() || routeSpotIds.length < 2) {
      toast.warning('请填写路线名称并至少选择两个点位');
      return;
    }
    try {
      await contentApplicationApi.submitRoute({
        sessionId: session.sessionId,
        ...routeApplication,
        coverImage: routeApplication.coverImage || undefined,
        spotOrderJson: JSON.stringify(routeSpotIds),
      });
      toast.success('路线申请已提交');
      setRouteApplication(prev => ({ ...prev, routeName: '', routeDesc: '', applicationReason: '' }));
      setRouteSpotIds([]);
      setSubPage('applications');
    } catch (error) {
      toast.error(getErrorMessage(error, '提交失败'));
    }
  };

  const withdrawApplication = async (applicationId: number) => {
    try {
      await contentApplicationApi.withdraw(session.sessionId, applicationId);
      toast.success('申请已撤回');
      await loadSubPageData('applications');
    } catch (error) {
      toast.error(getErrorMessage(error, '撤回失败'));
    }
  };

  const markMessageRead = async (messageId: number) => {
    try {
      await messageApi.markRead(session.sessionId, messageId);
      await loadSubPageData('messages');
      const unread = await messageApi.getUnreadCount(session.sessionId);
      setUnreadCount(unread.data.data || 0);
      toast.success('已标记为已读');
    } catch (error) {
      toast.error(getErrorMessage(error, '标记失败'));
    }
  };

  const markAllMessagesRead = async () => {
    try {
      await messageApi.markAllRead(session.sessionId);
      await loadSubPageData('messages');
      setUnreadCount(0);
      toast.success('已全部标记为已读');
    } catch (error) {
      toast.error(getErrorMessage(error, '操作失败'));
    }
  };

  const hideMessage = async (messageId: number) => {
    try {
      await messageApi.hide(session.sessionId, messageId);
      await loadSubPageData('messages');
      const unread = await messageApi.getUnreadCount(session.sessionId);
      setUnreadCount(unread.data.data || 0);
      toast.success('消息已隐藏');
    } catch (error) {
      toast.error(getErrorMessage(error, '隐藏失败'));
    }
  };

  const recalculateBadges = async () => {
    try {
      await badgeApi.recalculate(session.sessionId);
      await fetchBaseData();
      toast.success('成就进度已更新');
    } catch (error) {
      toast.error(getErrorMessage(error, '成就进度更新失败'));
    }
  };

  const handleSubPageClick = (page: ProfileSubPage) => {
    if (page !== 'settings' && session.userMode === 'guest') {
      Modal.alert({
        content: '游客模式暂不开放此功能，请注册正式账号获取完整体验。',
        confirmText: '我知道了',
      });
      return;
    }
    // Track parent for correct back navigation
    if (page === 'cocreate') {
      setSubPageParent(null);
    } else if (['applySpot', 'applyRoute', 'applications', 'personalRoutes'].includes(page) && subPage === 'cocreate') {
      setSubPageParent('cocreate');
    } else if (subPage === null) {
      setSubPageParent(null);
    }
    setSubPage(page);
  };

  const openMapPicker = (source: 'applySpot' | 'applyRoute', mode: 'single-point' | 'route') => {
    setMapPickerMode(mode);
    setMapPickerSource(source);
    setMapPickerOpen(true);
  };

  const closeSubPage = () => {
    setMapPickerOpen(false);
    setMapPickerSource(null);
    const parent = subPageParent;
    setSubPageParent(null);
    if (parent) {
      setSubPage(parent);
    } else {
      // If no parent subpage and coming from another tab, go back to that tab
      const backTo = sessionStorage.getItem('shanhai_profile_back_to');
      if (backTo) {
        onBack();
      } else {
        setSubPage(null);
      }
    }
  };

  const renderEmpty = (text: string, subtext?: string) => (
    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
      <svg className="w-12 h-12 mb-3 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/>
      </svg>
      <p className="text-sm font-bold text-slate-500">{text}</p>
      {subtext && <p className="text-[11px] mt-1 text-slate-400">{subtext}</p>}
    </div>
  );

  const renderSubContent = () => {
    if (!subPage) return null;
    if (subLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <div className="w-6 h-6 border-2 border-primary-blue/20 border-t-primary-blue rounded-full animate-spin"></div>
          <p className="text-sm text-slate-400">加载中...</p>
        </div>
      );
    }
    if (subError) {
      return (
        <div className="py-20 text-center flex flex-col items-center">
          <svg className="w-10 h-10 text-red-400 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p className="text-sm text-slate-500 mb-4">{subError}</p>
          <button className="bg-white border border-slate-200 text-slate-700 font-bold px-5 py-2 rounded-full text-sm active:scale-95 transition-transform" onClick={() => loadSubPageData(subPage)}>点击重试</button>
        </div>
      );
    }

    if (subPage === 'history') {
      // Parse checkinDesc: format is "tripId=xxx; distance米; duration分钟; routeName" or "完成路线：xxx"
      const parseCheckinDesc = (desc?: string): { tripId: string; distanceMeter: number | null; durationMinute: number | null; routeName: string; isTripFormat: boolean } => {
        if (!desc) return { tripId: '', distanceMeter: null, durationMinute: null, routeName: '', isTripFormat: false };
        const parts = desc.split(';').map(s => s.trim());
        if (parts.length >= 3 && parts[0].startsWith('tripId=')) {
          const tripId = parts[0].replace('tripId=', '').trim();
          let distanceMeter: number | null = null;
          let durationMinute: number | null = null;
          let routeName = parts.slice(3).join('; ').trim();
          const distMatch = parts[1]?.match(/(\d+)\s*米/);
          const durMatch = parts[2]?.match(/(\d+)\s*分钟/);
          if (distMatch) distanceMeter = parseInt(distMatch[1], 10);
          if (durMatch) durationMinute = parseInt(durMatch[1], 10);
          return { tripId, distanceMeter, durationMinute, routeName, isTripFormat: true };
        }
        const routeMatch = desc.match(/^完成路线[：:]\s*(.+)/);
        if (routeMatch) return { tripId: '', distanceMeter: null, durationMinute: null, routeName: routeMatch[1].trim(), isTripFormat: false };
        return { tripId: '', distanceMeter: null, durationMinute: null, routeName: desc, isTripFormat: false };
      };

      // Read latest completed trip from sessionStorage for auto-highlight
      const latestTripJson = sessionStorage.getItem('shanhai_latest_completed_trip');
      let latestTripId: string | null = null;
      try { if (latestTripJson) { const parsed = JSON.parse(latestTripJson); latestTripId = parsed?.tripId || null; } } catch { /* ignore */ }
      // Remove after reading so it doesn't persist across page reloads
      if (latestTripId) sessionStorage.removeItem('shanhai_latest_completed_trip');

      // Build combined history: checkins + latest completed trip
      const checkins = subData.checkins || [];
      // Deduplicate checkins by spotId within same minute for spot checkins
      const dedupedCheckins = (() => {
        const seen = new Map<string, number>(); // key = spotId:minuteBucket → first index
        const result: typeof checkins = [];
        checkins.forEach(item => {
          if (item.spotId && !item.routeId) {
            // Spot checkin: deduplicate same spot within same minute
            const date = new Date(item.createTime || 0);
            const bucket = `${item.spotId}:${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}-${date.getMinutes()}`;
            const existing = seen.get(bucket);
            if (existing !== undefined) {
              // Merge: increment count on the first occurrence
              const first = result[existing];
              result[existing] = { ...first, checkinDesc: `${(parseInt(first.checkinDesc || '0') || 1) + 1}` };
              return;
            }
            seen.set(bucket, result.length);
          }
          result.push(item);
        });
        return result;
      })();

      const hasData = dedupedCheckins.length > 0;

      // Compute summary stats
      const routeCheckins = dedupedCheckins.filter(c => c.routeId || c.checkinType === 2);
      const spotCheckins = dedupedCheckins.filter(c => c.spotId && !c.routeId);
      const latestTime = dedupedCheckins.length > 0
        ? dedupedCheckins.reduce((max, c) => {
            const t = new Date(c.createTime || 0).getTime();
            return t > max ? t : max;
          }, 0)
        : 0;

      const toggleExpand = (id: number) => {
        setExpandedItems(prev => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id); else next.add(id);
          return next;
        });
      };

      let displayItems = dedupedCheckins;
      if (historyFilter === '路线游览') displayItems = routeCheckins;
      else if (historyFilter === '点位打卡') displayItems = spotCheckins;

      // Auto-scroll: schedule via setTimeout (avoids conditional hook issue)
      if (latestTripId && latestTripRef.current) {
        setTimeout(() => {
          latestTripRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 150);
      }

      if (!hasData) return renderEmpty('暂无历史行程', '完成打卡或路线游览后会显示在这里');

      try { return (
        <div className="space-y-4 animate-fade-in">
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-white rounded-2xl p-3 text-center shadow-sm">
              <p className="text-lg font-extrabold text-slate-800">{dedupedCheckins.length}</p>
              <p className="text-[9px] text-slate-400 mt-0.5">总行程</p>
            </div>
            <div className="bg-white rounded-2xl p-3 text-center shadow-sm">
              <p className="text-lg font-extrabold text-emerald-600">{routeCheckins.length}</p>
              <p className="text-[9px] text-slate-400 mt-0.5">路线游览</p>
            </div>
            <div className="bg-white rounded-2xl p-3 text-center shadow-sm">
              <p className="text-lg font-extrabold text-primary-blue">{spotCheckins.length}</p>
              <p className="text-[9px] text-slate-400 mt-0.5">点位打卡</p>
            </div>
            <div className="bg-white rounded-2xl p-3 text-center shadow-sm">
              <p className="text-xs font-extrabold text-slate-700 leading-tight">{latestTime > 0 ? (() => {
                const d = new Date(latestTime);
                return `${d.getMonth() + 1}/${d.getDate()}`;
              })() : '—'}</p>
              <p className="text-[9px] text-slate-400 mt-0.5">最近完成</p>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2">
            {(['全部', '路线游览', '点位打卡'] as const).map(filter => (
              <button
                key={filter}
                className={`px-4 py-2 rounded-full text-[11px] font-bold transition-all ${
                  historyFilter === filter ? 'bg-primary-blue text-white shadow-sm' : 'bg-white text-slate-500 border border-slate-100'
                }`}
                onClick={() => setHistoryFilter(filter)}
              >
                {filter}
                {filter !== '全部' && historyFilter === filter ? ` (${displayItems.length})` : ''}
              </button>
            ))}
          </div>

          {/* Timeline */}
          {displayItems.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-sm">该分类暂无记录</div>
          ) : (
            <div className="relative pl-6">
              <div className="absolute left-[11px] top-4 bottom-0 w-px bg-slate-200"></div>
              {displayItems.map((item, idx) => {
                const spot = subData.spots.find(s => s.id === item.spotId);
                const route = subData.routes.find(r => r.id === item.routeId);
                const parsedDesc = parseCheckinDesc(item.checkinDesc);
                const isSpot = !!spot && !item.routeId;
                const isRoute = !!route || !!item.routeId || item.checkinType === 2;
                const isLatest = latestTripId !== null && idx === 0;
                const isExpanded = expandedItems.has(item.id);
                const spotRoutes = item.routeId ? subData.routes.find(r => r.id === item.routeId) : null;
                // Handle merged spot checkins
                const mergedCount = !item.routeId && item.checkinDesc && /^\d+$/.test(item.checkinDesc) ? parseInt(item.checkinDesc) : 1;
                const spotRouteSpots = spotRoutes ? (() => { try { return JSON.parse(spotRoutes.spotOrderJson || '[]'); } catch { return []; } })() : [];
                // Display title: prefer parsed route name, then DB route name, then spot name
                const displayTitle = isSpot ? spot?.spotName || '校园点位'
                  : parsedDesc.routeName || route?.routeName || spotRoutes?.routeName || '校园路线';

                return (
                  <div
                    key={item.id}
                    ref={isLatest ? latestTripRef : undefined}
                    className={`relative mb-4 last:mb-0 w-full rounded-2xl p-4 text-left shadow-sm flex flex-col transition-all ${
                      isLatest ? 'bg-blue-50/60 border-2 border-primary-blue/30 ring-2 ring-primary-blue/10' : 'bg-white border border-slate-50'
                    }`}
                  >
                    <div className={`absolute -left-6 top-5 w-2.5 h-2.5 rounded-full ring-4 ring-[#F7F9FC] ${isSpot ? 'bg-primary-blue' : 'bg-emerald-500'} ${isLatest ? 'ring-primary-blue/20' : ''}`}></div>

                    {/* Header */}
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isSpot ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {isSpot ? (mergedCount > 1 ? `点位打卡 ×${mergedCount}` : '点位打卡') : '路线游览'}
                      </span>
                      <span className="text-[10px] text-slate-400">{formatDateTime(item.createTime)}</span>
                    </div>

                    {/* Title */}
                    <p className="font-bold text-slate-800 text-sm mb-1">
                      {displayTitle}
                    </p>

                    {/* Route details */}
                    {isRoute && (
                      <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                        <div className="bg-slate-50 rounded-lg p-1.5">
                          <p className="text-[10px] text-slate-400">时长</p>
                          <p className="text-xs font-bold text-slate-700">{parsedDesc.durationMinute !== null ? `${parsedDesc.durationMinute} 分钟` : spotRoutes?.totalMinute || route?.totalMinute ? `${spotRoutes?.totalMinute || route?.totalMinute} 分钟` : '—'}</p>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-1.5">
                          <p className="text-[10px] text-slate-400">距离</p>
                          <p className="text-xs font-bold text-slate-700">{parsedDesc.distanceMeter !== null ? `${parsedDesc.distanceMeter} 米` : item.checkinDesc?.includes('米') && !parsedDesc.isTripFormat ? item.checkinDesc : '已记录'}</p>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-1.5">
                          <p className="text-[10px] text-slate-400">站点</p>
                          <p className="text-xs font-bold text-slate-700">{spotRouteSpots.length || route?.spots?.length || '—'}</p>
                        </div>
                      </div>
                    )}

                    {/* Spot category */}
                    {isSpot && spot && (
                      <p className="text-[11px] text-slate-500 mt-1">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          spot.spotType === '教学场馆' ? 'bg-blue-50 text-blue-600' :
                          spot.spotType === '宿舍生活区' ? 'bg-emerald-50 text-emerald-600' :
                          spot.spotType === '餐饮美食' ? 'bg-orange-50 text-orange-600' :
                          spot.spotType === '便民服务' ? 'bg-purple-50 text-purple-600' :
                          spot.spotType === '运动场地' ? 'bg-rose-50 text-rose-600' :
                          'bg-teal-50 text-teal-600'
                        }`}>{spot.spotType}</span>
                      </p>
                    )}

                    {/* Expandable station list for routes */}
                    {isRoute && spotRouteSpots.length > 0 && (
                      <>
                        <button
                          className="mt-2 text-[11px] font-bold text-primary-blue self-start flex items-center gap-1"
                          onClick={(e) => { e.stopPropagation(); toggleExpand(item.id); }}
                        >
                          {isExpanded ? '收起站点' : '展开站点顺序'}
                          <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                        </button>
                        {isExpanded && (
                          <div className="mt-2 space-y-1 pl-2 border-l-2 border-slate-100">
                            {spotRouteSpots.map((spotId: number, si: number) => {
                              const s = subData.spots.find(sp => sp.id === spotId);
                              return (
                                <div key={si} className="flex items-center gap-2 text-xs">
                                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[10px] font-bold shrink-0">{si + 1}</span>
                                  <span className="text-slate-600 truncate">{s?.spotName || `点位 #${spotId}`}</span>
                                  {si === 0 && <span className="text-[9px] text-slate-400">起点</span>}
                                  {si === spotRouteSpots.length - 1 && <span className="text-[9px] text-slate-400">终点</span>}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}

                    {/* View footprint */}
                    {isRoute && (
                      <button
                        className="mt-2 self-end text-[10px] font-bold text-primary-blue bg-blue-50 px-3 py-1.5 rounded-full"
                        onClick={() => {
                          if (item.routeId) {
                            onNavigate({ page: 'map', routeId: item.routeId });
                          }
                        }}
                      >
                        {item.routeId ? '查看路线' : '无记录'}
                      </button>
                    )}

                    {isSpot && !item.routeId && (
                      <button
                        className="mt-2 self-end text-[10px] font-bold text-primary-blue bg-blue-50 px-3 py-1.5 rounded-full"
                        onClick={() => item.spotId && onNavigate({ page: 'map', spotId: item.spotId })}
                      >
                        查看地图
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
      } catch (err) {
        console.error('[ProfilePage] History render error:', err);
        return (
          <div className="py-10 text-center">
            <p className="text-sm text-red-500 mb-3">历史页面渲染异常</p>
            <button className="bg-white border border-slate-200 text-slate-700 font-bold px-5 py-2 rounded-full text-sm active:scale-95" onClick={() => loadSubPageData('history')}>点击刷新</button>
          </div>
        );
      }
    }

    if (subPage === 'favoriteSpots') {
      const items = subData.favorites.filter(item => item.favoriteType === 1);
      if (items.length === 0) return renderEmpty('暂无收藏点位');
      return (
        <div className="space-y-4">
          {items.map(item => {
            const spot = subData.spots.find(spot => spot.id === item.targetId);
            return (
              <div key={item.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-50 flex flex-col active:scale-[0.99] transition-transform">
                <div className="h-32 bg-slate-100 relative">
                  {(() => {
                    const imgUrl = resolveImageUrl(spot?.spotImage);
                    return imgUrl ? (
                      <img src={imgUrl} alt={spot?.spotName || '点位'} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} />
                    ) : null;
                  })()}
                  <div className={`w-full h-full absolute inset-0 ${resolveImageUrl(spot?.spotImage) ? 'hidden' : ''}`}>
                    <DefaultSpotCover spotType={spot?.spotType} className="w-full h-full" />
                  </div>
                  <div className="absolute top-3 left-3 bg-white/90 backdrop-blur text-[10px] font-bold px-2 py-1 rounded text-slate-700">{spot?.spotType || '校园点位'}</div>
                </div>
                <div className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-bold text-slate-800 flex-1 pr-2">{spot?.spotName || `点位 #${item.targetId}`}</p>
                    <button className="text-[11px] font-bold text-red-500 bg-red-50 rounded-full px-3 py-1 shrink-0" onClick={(e) => { e.stopPropagation(); removeFavorite(1, item.targetId); }}>取消收藏</button>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-2 mb-3">{spot?.spotDesc || '点位信息已变更'}</p>
                  <div className="flex justify-between items-center border-t border-slate-50 pt-3">
                    <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-1 rounded">{spot?.openTime || '以学校实际安排为准'}</span>
                    <button className="text-[11px] font-bold text-white bg-primary-blue rounded-full px-4 py-1.5" onClick={() => onNavigate({ page: 'map', spotId: item.targetId })}>查看地图</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    if (subPage === 'favoriteRoutes') {
      const items = subData.favorites.filter(item => item.favoriteType === 2);
      if (items.length === 0) return renderEmpty('暂无收藏路线');
      return (
        <div className="space-y-4">
          {items.map(item => {
            const route = subData.routes.find(route => route.id === item.targetId);
            return (
              <div key={item.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-50 flex flex-col active:scale-[0.99] transition-transform">
                <div className="h-32 bg-slate-100 relative">
                  {(() => {
                    const imgUrl = resolveImageUrl(route?.coverImage);
                    return imgUrl ? (
                      <img src={imgUrl} alt={route?.routeName || '路线'} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} />
                    ) : null;
                  })()}
                  <div className={`w-full h-full absolute inset-0 ${resolveImageUrl(route?.coverImage) ? 'hidden' : ''}`}>
                    <DefaultRouteCover className="w-full h-full" />
                  </div>
                  <div className="absolute top-3 left-3 bg-white/90 backdrop-blur text-[10px] font-bold px-2 py-1 rounded text-slate-700">{route?.spots?.length || 0} 个点位</div>
                </div>
                <div className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-bold text-slate-800 flex-1 pr-2">{route?.routeName || `路线 #${item.targetId}`}</p>
                    <button className="text-[11px] font-bold text-red-500 bg-red-50 rounded-full px-3 py-1 shrink-0" onClick={(e) => { e.stopPropagation(); removeFavorite(2, item.targetId); }}>取消收藏</button>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-2 mb-3">{route?.routeDesc || '路线信息已变更'}</p>
                  <div className="flex justify-between items-center border-t border-slate-50 pt-3">
                    <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-1 rounded">预计时长 {route?.totalMinute || 0} 分钟</span>
                    <button className="text-[11px] font-bold text-white bg-primary-blue rounded-full px-4 py-1.5" onClick={() => onNavigate({ page: 'map', routeId: item.targetId })}>开始游览</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    if (subPage === 'personalRoutes') {
      if (subData.personalRoutes.length === 0) return renderEmpty('暂无个人 AI 路线', '在数字人聊天中保存路线后会显示在这里');
      return (
        <div className="space-y-4">
          {subData.personalRoutes.map(route => {
            const spotIds = (() => { try { return JSON.parse(route.spotOrderJson || '[]'); } catch { return []; } })();
            const openPersonalRoute = (navigationMode: boolean) => {
              const routeSpots = (spotIds as number[]).map(id => subData.spots.find(spot => Number(spot.id) === Number(id))).filter(Boolean) as CampusSpot[];
              if (routeSpots.length === 0) return;
              sessionStorage.setItem('shanhai_ai_route', JSON.stringify({ routeName: route.routeName, routeDesc: route.routeDesc, totalMinute: route.totalMinute, spots: routeSpots.map(spot => ({ ...spot, spotId: spot.id, stayMinute: spot.recommendTime })) }));
              onNavigate({ page: 'map', spotId: routeSpots[0].id, navigationMode } as any);
            };
            return (
              <div key={route.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-50">
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 text-sm truncate">{route.routeName}</p>
                    <p className="text-[10px] text-slate-400 mt-1">AI 路线 · {route.totalMinute || 0} 分钟 · {spotIds.length} 个点位</p>
                  </div>
                  <button
                    className="text-[11px] font-bold text-red-500 bg-red-50 rounded-full px-3 py-1 shrink-0"
                    onClick={async () => {
                      await personalRouteApi.delete(session.sessionId, route.id);
                      await loadSubPageData('personalRoutes');
                    }}
                  >
                    删除
                  </button>
                </div>
                <p className="mt-2 text-xs text-slate-600 line-clamp-2">{route.routeDesc || '暂无路线介绍'}</p>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <button className="bg-slate-50 text-slate-700 rounded-xl py-2 text-xs font-bold active:scale-95 transition-transform" onClick={() => openPersonalRoute(false)}>查看地图</button>
                  <button className="bg-primary-blue text-white rounded-xl py-2 text-xs font-bold active:scale-95 transition-transform" onClick={() => openPersonalRoute(true)}>开始导航</button>
                  <button className="bg-amber-50 text-amber-600 rounded-xl py-2 text-xs font-bold active:scale-95 transition-transform" onClick={async () => {
                    try {
                      await personalRouteApi.update(session.sessionId, route.id, { isFavorite: 1 });
                      toast.success('已收藏路线');
                    } catch { toast.error('收藏失败'); }
                  }}>♥ 收藏路线</button>
                  <button className="bg-emerald-50 text-emerald-700 rounded-xl py-2 text-xs font-bold active:scale-95 transition-transform" onClick={() => {
                    sessionStorage.setItem('shanhai_prefill_route_application', JSON.stringify({
                      routeName: route.routeName,
                      routeDesc: route.routeDesc,
                      totalMinute: route.totalMinute,
                      spotOrderJson: route.spotOrderJson,
                      applicationReason: '由个人 AI 路线预填',
                    }));
                    setSubPage('applyRoute');
                  }}>编辑并提交共创</button>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    if (subPage === 'reserves') {
      const items = subData.reserves.filter(item => item.reserveStatus === 1);
      if (items.length === 0) return renderEmpty('暂无预约', '报名校园活动后会显示在这里');
      return (
        <div className="space-y-4">
          {items.map(item => {
            const activity = subData.activities.find(activity => activity.id === item.activityId);
            const category = activity?.activityType || '文体活动';
            return (
              <div key={item.id} className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm flex flex-col active:scale-[0.99] transition-transform">
                <div className="h-44 relative bg-slate-100 shrink-0">
                  {(() => {
                    const imgUrl = resolveImageUrl(activity?.activityImage);
                    return imgUrl ? (
                      <img src={imgUrl} alt={activity?.activityTitle || '活动'} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} />
                    ) : null;
                  })()}
                  <div className={`w-full h-full absolute inset-0 ${resolveImageUrl(activity?.activityImage) ? 'hidden' : ''}`}>
                    <DefaultActivityCover category={category} className="w-full h-full" />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none"></div>
                  <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-slate-800 rounded-xl px-3 py-1.5 shadow-sm flex items-center gap-1.5 z-10">
                    <svg className="w-3.5 h-3.5 text-primary-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    <span className="text-[11px] font-bold">{activity ? formatDateTime(activity.activityTime) : formatDateTime(item.reserveTime)}</span>
                  </div>
                  <div className="absolute top-3 right-3 bg-emerald-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm z-10">已报名</div>
                </div>
                <div className="p-4 flex flex-col">
                  <span className="self-start text-[10px] font-bold px-2 py-0.5 rounded-full mb-2 bg-emerald-50 text-emerald-600">{category}</span>
                  <h3 className="font-bold text-base text-slate-800 leading-snug mb-3">{activity?.activityTitle || `活动 #${item.activityId}`}</h3>
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <svg className="w-3.5 h-3.5 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3"/><path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662"/></svg>
                      <span className="truncate">{activity?.activityDesc || '指定活动地点'}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t border-slate-50 mt-auto">
                    <span className="text-[10px] text-slate-400">报名时间：{formatDateTime(item.reserveTime)}</span>
                    <button className="text-[11px] font-bold text-red-500 bg-red-50 rounded-full px-4 py-1.5 active:scale-95 transition-transform" onClick={() => cancelReserve(item.activityId)}>取消预约</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    if (subPage === 'messages') {
      if (subData.messages.length === 0) return (
        <div className="flex flex-col items-center justify-center py-24 animate-fade-in">
          <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center mb-5">
            <svg className="w-10 h-10 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <p className="text-sm font-bold text-slate-500 mb-1">暂无消息</p>
          <p className="text-[11px] text-slate-400">审核结果、活动通知和成就提醒会显示在这里</p>
        </div>
      );

      const typeIcon = (messageType: string) => {
        switch (messageType) {
          case 'system': return <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>;
          case 'activity': return <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
          case 'application': return <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;
          default: return <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
        }
      };

      const typeColor = (messageType: string) => {
        switch (messageType) {
          case 'system': return { bg: 'bg-slate-50', text: 'text-slate-600', ring: 'ring-slate-200' };
          case 'activity': return { bg: 'bg-amber-50', text: 'text-amber-600', ring: 'ring-amber-200' };
          case 'application': return { bg: 'bg-blue-50', text: 'text-blue-600', ring: 'ring-blue-200' };
          default: return { bg: 'bg-slate-50', text: 'text-slate-600', ring: 'ring-slate-200' };
        }
      };

      // Group messages by time
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterdayStart = new Date(todayStart.getTime() - 86400000);
      const groups: { label: string; items: typeof subData.messages }[] = [];
      const todayItems = subData.messages.filter(m => new Date(m.createTime || 0) >= todayStart);
      const yesterdayItems = subData.messages.filter(m => {
        const d = new Date(m.createTime || 0);
        return d >= yesterdayStart && d < todayStart;
      });
      const olderItems = subData.messages.filter(m => new Date(m.createTime || 0) < yesterdayStart);
      if (todayItems.length > 0) groups.push({ label: '今天', items: todayItems });
      if (yesterdayItems.length > 0) groups.push({ label: '昨天', items: yesterdayItems });
      if (olderItems.length > 0) groups.push({ label: '更早', items: olderItems });

      return (
        <div className="animate-fade-in space-y-5">
          {/* Header Banner */}
          <div className="relative bg-gradient-to-br from-primary-blue to-indigo-600 rounded-3xl p-5 overflow-hidden shadow-lg shadow-primary-blue/20">
            <div className="absolute top-0 right-0 w-28 h-28 bg-white/10 rounded-full blur-2xl transform translate-x-1/3 -translate-y-1/3"></div>
            <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/10 rounded-full blur-xl transform -translate-x-1/3 translate-y-1/3"></div>
            <div className="relative z-10 flex items-center justify-between">
              <div className="text-white">
                <h2 className="text-lg font-bold mb-1 drop-shadow-sm">消息中心</h2>
                <p className="text-xs text-white/70">
                  {unreadCount > 0 ? `${unreadCount} 条未读消息` : '全部已读'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    className="bg-white/20 backdrop-blur-sm text-white rounded-full px-4 py-2 text-xs font-bold active:scale-95 transition-transform border border-white/20 hover:bg-white/30"
                    onClick={markAllMessagesRead}
                  >
                    全部已读
                  </button>
                )}
                <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30">
                  <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Message Groups */}
          {groups.map(group => (
            <div key={group.label}>
              <p className="text-[11px] font-bold text-slate-400 mb-3 ml-1">{group.label}</p>
              <div className="space-y-3">
                {group.items.map(item => {
                  const colors = typeColor(item.messageType);
                  return (
                    <div
                      key={item.id}
                      className={`relative bg-white rounded-2xl p-4 shadow-sm border transition-all active:scale-[0.99] ${
                        item.readStatus === 1
                          ? 'border-slate-50'
                          : 'border-blue-100 shadow-blue-50/50'
                      }`}
                    >
                      {/* Unread indicator */}
                      {item.readStatus !== 1 && (
                        <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-primary-blue ring-2 ring-blue-100"></div>
                      )}

                      {/* Type + Title */}
                      <div className="flex items-start gap-3 mb-3 pr-6">
                        <div className={`w-9 h-9 rounded-xl ${colors.bg} ${colors.text} flex items-center justify-center shrink-0 ring-1 ${colors.ring}`}>
                          {typeIcon(item.messageType)}
                        </div>
                        <div className="min-w-0 pt-0.5">
                          <span className="text-[10px] font-bold text-slate-400 mb-0.5 block">
                            {messageTypeNames[item.messageType] || '系统通知'}
                          </span>
                          <p className={`font-bold text-sm truncate ${item.readStatus === 1 ? 'text-slate-600' : 'text-slate-900'}`}>
                            {item.title}
                          </p>
                        </div>
                      </div>

                      {/* Content */}
                      {item.content && (
                        <p className={`text-xs leading-relaxed mb-3 pl-12 whitespace-pre-wrap break-words ${
                          item.readStatus === 1 ? 'text-slate-400' : 'text-slate-600'
                        }`}>
                          {item.content}
                        </p>
                      )}

                      {/* Footer */}
                      <div className="flex items-center justify-between pl-12">
                        <p className="text-[10px] text-slate-400">{formatDateTime(item.createTime)}</p>
                        <div className="flex gap-1.5">
                          {item.readStatus !== 1 && (
                            <button
                              className="text-[10px] font-bold text-primary-blue bg-blue-50 hover:bg-blue-100 rounded-full px-3 py-1.5 transition-colors"
                              onClick={() => markMessageRead(item.id)}
                            >
                              标为已读
                            </button>
                          )}
                          <button
                            className="text-[10px] font-bold text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-full px-3 py-1.5 transition-colors"
                            onClick={() => hideMessage(item.id)}
                          >
                            隐藏
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      );
    }

    const selectedSpots = routeSpotIds.map(id => (subData?.spots || []).find((s: any) => s.id === id)).filter(Boolean) as CampusSpot[];
    const filteredRouteSpots = (subData?.spots || []).filter((s: any) => {
      const matchSearch = !routeSpotSearch || s.spotName.includes(routeSpotSearch);
      const matchType = routeSpotFilter === '全部' || s.spotType === routeSpotFilter;
      return matchSearch && matchType;
    });
    const isSubmitting = false;

    if (subPage === 'applySpot') {
      return (
        <div className="space-y-4 relative min-h-full flex flex-col animate-fade-in">
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 shadow-sm space-y-6 border border-white flex-1 mb-16">
            {/* Map Area */}
            <div>
              <label className="text-sm font-bold text-slate-800 mb-2 block">
                点位位置 <span className="text-red-500">*</span>
              </label>
              <button
                className="w-full h-32 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center gap-2 hover:border-primary-blue hover:bg-blue-50/20 transition-colors"
                onClick={() => openMapPicker('applySpot', 'single-point')}
              >
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-primary-blue">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="10" r="3"/><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/></svg>
                </div>
                <span className="text-sm font-bold text-slate-600">
                  {selectedPosition ? '重新选择位置' : '在地图上选择点位位置'}
                </span>
                {selectedPosition && (
                  <span className="text-[10px] text-slate-400">
                    已选: {selectedPosition.lng.toFixed(5)}, {selectedPosition.lat.toFixed(5)}
                  </span>
                )}
              </button>
            </div>
            <div>
              <label className="text-sm font-bold text-slate-800 mb-2 block">点位名称 <span className="text-red-500">*</span></label>
              <input className="w-full bg-slate-50/50 border border-slate-200 rounded-2xl p-4 text-sm focus:bg-white focus:border-primary-blue/40 focus:ring-4 focus:ring-primary-blue/5 outline-none transition-all" placeholder="输入清晰简明的点位名称" value={spotApplication.spotName} onChange={e => setSpotApplication(prev => ({ ...prev, spotName: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-bold text-slate-800 mb-2 block">点位类型 <span className="text-red-500">*</span></label>
              <select className="w-full bg-slate-50/50 border border-slate-200 rounded-2xl p-4 text-sm focus:bg-white focus:border-primary-blue/40 focus:ring-4 focus:ring-primary-blue/5 outline-none transition-all appearance-none" value={spotApplication.spotType} onChange={e => setSpotApplication(prev => ({ ...prev, spotType: e.target.value }))}>
                {['教学场馆', '宿舍生活区', '餐饮美食', '便民服务', '运动场地', '绿化景观'].map(type => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-bold text-slate-800 mb-2 block">开放时间</label>
                <input className="w-full bg-slate-50/50 border border-slate-200 rounded-2xl p-4 text-sm focus:bg-white focus:border-primary-blue/40 focus:ring-4 focus:ring-primary-blue/5 outline-none transition-all" placeholder="如：8:00-22:00" value={spotApplication.openTime} onChange={e => setSpotApplication(prev => ({ ...prev, openTime: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-bold text-slate-800 mb-2 block">游览时间(分钟)</label>
                <input className="w-full bg-slate-50/50 border border-slate-200 rounded-2xl p-4 text-sm focus:bg-white focus:border-primary-blue/40 focus:ring-4 focus:ring-primary-blue/5 outline-none transition-all" type="number" placeholder="如：15" value={spotApplication.recommendTime || ''} onChange={e => setSpotApplication(prev => ({ ...prev, recommendTime: Number(e.target.value) }))} />
              </div>
            </div>
            <div>
              <label className="text-sm font-bold text-slate-800 mb-2 block">点位简介 <span className="text-red-500">*</span></label>
              <textarea className="w-full bg-slate-50/50 border border-slate-200 rounded-2xl p-4 text-sm focus:bg-white focus:border-primary-blue/40 focus:ring-4 focus:ring-primary-blue/5 outline-none transition-all resize-none leading-relaxed" rows={3} placeholder="描述该点位的特色，帮助其他人更好了解这里..." value={spotApplication.spotDesc} onChange={e => setSpotApplication(prev => ({ ...prev, spotDesc: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-bold text-slate-800 mb-2 flex justify-between items-center">
                <span>点位图片 <span className="text-slate-400 font-normal text-xs">选填</span></span>
                {spotApplication.spotImage && <span className="text-[10px] text-emerald-500 font-medium bg-emerald-50 px-2 py-0.5 rounded-full">已上传</span>}
              </label>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                id="spotImageUpload"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const compressed = await readFileAsCompressedBase64(file);
                    setSpotApplication(prev => ({ ...prev, spotImage: compressed }));
                  }
                }}
              />
              {spotApplication.spotImage ? (
                <div className="relative w-full h-44 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 group">
                  <img
                    src={spotApplication.spotImage}
                    alt="点位预览"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      setSpotApplication(prev => ({ ...prev, spotImage: '' }));
                    }}
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                    <label
                      htmlFor="spotImageUpload"
                      className="bg-white/90 backdrop-blur-sm text-slate-700 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer active:scale-95 hover:bg-white transition-all shadow-lg"
                    >
                      重新选择
                    </label>
                    <button
                      className="bg-red-500/90 backdrop-blur-sm text-white px-4 py-2 rounded-xl text-xs font-bold active:scale-95 hover:bg-red-500 transition-all shadow-lg"
                      onClick={(e) => { e.preventDefault(); setSpotApplication(prev => ({ ...prev, spotImage: '' })); }}
                    >
                      移除
                    </button>
                  </div>
                </div>
              ) : (
                <label
                  htmlFor="spotImageUpload"
                  className="w-full h-36 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary-blue/40 hover:bg-blue-50/20 transition-all group"
                >
                  <div className="w-10 h-10 rounded-full bg-white border border-slate-100 flex items-center justify-center shadow-sm group-hover:border-primary-blue/30 group-hover:text-primary-blue transition-all">
                    <svg className="w-5 h-5 text-slate-400 group-hover:text-primary-blue transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                  </div>
                  <span className="text-sm font-bold text-slate-500 group-hover:text-primary-blue transition-colors">点击上传图片</span>
                  <span className="text-[10px] text-slate-400">支持 JPG、PNG，建议 16:9 横图</span>
                </label>
              )}
            </div>

            <button
              className="w-full bg-primary-blue hover:bg-blue-600 text-white font-bold rounded-2xl py-4 shadow-[0_4px_12px_rgba(26,92,138,0.25)] active:scale-[0.98] transition-all disabled:opacity-50 mt-4"
              onClick={submitSpotApplication}
              disabled={isSubmitting || !selectedPosition || !spotApplication.spotName || !spotApplication.spotType || !spotApplication.spotDesc}
            >
              {isSubmitting ? '提交中...' : '提交点位申请'}
            </button>
          </div>
        </div>
      );
    }

    if (subPage === 'applyRoute') {
      return (
        <div className="space-y-4 relative min-h-full flex flex-col animate-fade-in">
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 shadow-sm space-y-6 border border-white flex-1 mb-16">
            {/* Map Area */}
            <div>
              <label className="text-sm font-bold text-slate-800 mb-2 block">
                路线地图选点 <span className="text-red-500">*</span>
              </label>
              <button
                className="w-full h-40 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center gap-2 hover:border-primary-blue hover:bg-blue-50/20 transition-colors"
                onClick={() => openMapPicker('applyRoute', 'route')}
              >
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-primary-blue">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 20l-5.44-2.72A2 2 0 0 1 2.5 15.5V5.5A2 2 0 0 1 3.56 3.72L9 6.44l6-3 5.44 2.72A2 2 0 0 1 21.5 7.94v10a2 2 0 0 1-1.06 1.78L15 22.44l-6-3z"/><line x1="9" y1="20" x2="9" y2="6.44"/><line x1="15" y1="3.56" x2="15" y2="22.44"/></svg>
                </div>
                <span className="text-sm font-bold text-slate-600">
                  {routeSpotIds.length > 0 ? `已选 ${routeSpotIds.length} 个点位 — 重新编辑路线` : '在地图上选择路线点位'}
                </span>
              </button>
              {routeSpotIds.length > 0 && (
                <div className="flex justify-end mt-2">
                  <button
                    className="text-xs text-slate-400 hover:text-slate-600 underline"
                    onClick={() => { setRouteSpotIds([]); setRouteApplication(prev => ({ ...prev, totalMinute: 60 })); }}
                  >
                    清空全部点位
                  </button>
                </div>
              )}
              {selectedSpots.length >= 2 && (
                <div className="mt-2 bg-emerald-50/70 rounded-xl p-3 border border-emerald-100 flex items-center justify-between text-[11px]">
                  <span className="text-emerald-700">
                    步行约 {estimateWalkMinutes(selectedSpots)} 分钟 · 停留约 {selectedSpots.reduce((sum, s) => sum + (s.recommendTime || 15), 0)} 分钟
                  </span>
                  <span className="font-bold text-emerald-800">总计 {routeApplication.totalMinute} 分钟</span>
                </div>
              )}
            </div>

            {/* Spot selector with search & filter */}
            <div>
              <label className="text-[11px] font-bold text-slate-600 mb-1.5 block">可选点位列表</label>
              <div className="flex gap-2 mb-2">
                <input
                  className="flex-1 bg-slate-50/50 border border-slate-200 rounded-2xl p-4 text-sm focus:bg-white focus:border-primary-blue/40 focus:ring-4 focus:ring-primary-blue/5 outline-none transition-all"
                  placeholder="搜索点位名称..."
                  value={routeSpotSearch}
                  onChange={e => setRouteSpotSearch(e.target.value)}
                />
              </div>
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar mb-2 pb-1">
                {['全部', '教学场馆', '宿舍生活区', '餐饮美食', '便民服务', '运动场地', '绿化景观'].map(cat => (
                  <button
                    key={cat}
                    className={`shrink-0 text-[10px] font-bold px-3 py-1.5 rounded-full transition-all ${routeSpotFilter === cat ? 'bg-primary-blue text-white shadow-md shadow-blue-500/20' : 'bg-slate-50 border border-slate-200 text-slate-500 hover:bg-slate-100'}`}
                    onClick={() => setRouteSpotFilter(cat)}
                  >{cat}</button>
                ))}
              </div>
              <div className="max-h-52 overflow-y-auto space-y-2 border border-slate-100 rounded-2xl p-2 bg-slate-50/50">
                {filteredRouteSpots.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-400">没有匹配的点位</div>
                ) : (
                  filteredRouteSpots.map(spot => {
                    const selectedIndex = routeSpotIds.indexOf(spot.id);
                    const isSelected = selectedIndex >= 0;
                    return (
                      <button
                        key={spot.id}
                        className={`w-full flex items-center justify-between rounded-xl p-3 text-left transition-all active:scale-[0.98] ${isSelected ? 'bg-blue-50 border border-blue-200 shadow-sm' : 'bg-white border border-slate-100 hover:border-blue-200 hover:shadow-sm'}`}
                        onClick={() => {
                          setRouteSpotIds(prev => {
                            if (isSelected) return prev.filter(id => id !== spot.id);
                            return [...prev, spot.id];
                          });
                        }}
                      >
                        <div className="flex flex-col gap-1">
                          <span className={`text-sm font-bold ${isSelected ? 'text-primary-blue' : 'text-slate-700'}`}>{spot.spotName}</span>
                          <span className="text-[10px] text-slate-400">{spot.spotType}</span>
                        </div>
                        {isSelected && (
                          <div className="w-6 h-6 rounded-full bg-primary-blue text-white flex items-center justify-center text-xs font-bold shadow-sm">
                            {selectedIndex + 1}
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-bold text-slate-800 mb-2 block">路线名称 <span className="text-red-500">*</span></label>
                <input className="w-full bg-slate-50/50 border border-slate-200 rounded-2xl p-4 text-sm focus:bg-white focus:border-primary-blue/40 focus:ring-4 focus:ring-primary-blue/5 outline-none transition-all" placeholder="如：经典半日游路线" value={routeApplication.routeName} onChange={e => setRouteApplication(prev => ({ ...prev, routeName: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-bold text-slate-800 mb-2 block">路线简介 <span className="text-red-500">*</span></label>
                <textarea className="w-full bg-slate-50/50 border border-slate-200 rounded-2xl p-4 text-sm focus:bg-white focus:border-primary-blue/40 focus:ring-4 focus:ring-primary-blue/5 outline-none transition-all resize-none leading-relaxed" rows={2} placeholder="简单描述这条路线的特点..." value={routeApplication.routeDesc} onChange={e => setRouteApplication(prev => ({ ...prev, routeDesc: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-bold text-slate-800 mb-2 block">申请理由 <span className="text-slate-400 font-normal text-xs">选填</span></label>
                <textarea className="w-full bg-slate-50/50 border border-slate-200 rounded-2xl p-4 text-sm focus:bg-white focus:border-primary-blue/40 focus:ring-4 focus:ring-primary-blue/5 outline-none transition-all resize-none leading-relaxed" rows={2} placeholder="说明为什么推荐这条路线..." value={routeApplication.applicationReason} onChange={e => setRouteApplication(prev => ({ ...prev, applicationReason: e.target.value }))} />
              </div>
            </div>

            <div>
              <label className="text-sm font-bold text-slate-800 mb-2 flex justify-between items-center">
                <span>路线封面图 <span className="text-slate-400 font-normal text-xs">选填</span></span>
                {routeApplication.coverImage && <span className="text-[10px] text-emerald-500 font-medium bg-emerald-50 px-2 py-0.5 rounded-full">已上传</span>}
              </label>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                id="routeImageUpload"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const compressed = await readFileAsCompressedBase64(file);
                    setRouteApplication(prev => ({ ...prev, coverImage: compressed }));
                  }
                }}
              />
              {routeApplication.coverImage ? (
                <div className="relative w-full h-44 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 group">
                  <img
                    src={routeApplication.coverImage}
                    alt="路线封面预览"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      setRouteApplication(prev => ({ ...prev, coverImage: '' }));
                    }}
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                    <label
                      htmlFor="routeImageUpload"
                      className="bg-white/90 backdrop-blur-sm text-slate-700 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer active:scale-95 hover:bg-white transition-all shadow-lg"
                    >
                      重新选择
                    </label>
                    <button
                      className="bg-red-500/90 backdrop-blur-sm text-white px-4 py-2 rounded-xl text-xs font-bold active:scale-95 hover:bg-red-500 transition-all shadow-lg"
                      onClick={(e) => { e.preventDefault(); setRouteApplication(prev => ({ ...prev, coverImage: '' })); }}
                    >
                      移除
                    </button>
                  </div>
                </div>
              ) : (
                <label
                  htmlFor="routeImageUpload"
                  className="w-full h-36 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary-blue/40 hover:bg-blue-50/20 transition-all group"
                >
                  <div className="w-10 h-10 rounded-full bg-white border border-slate-100 flex items-center justify-center shadow-sm group-hover:border-primary-blue/30 group-hover:text-primary-blue transition-all">
                    <svg className="w-5 h-5 text-slate-400 group-hover:text-primary-blue transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                  </div>
                  <span className="text-sm font-bold text-slate-500 group-hover:text-primary-blue transition-colors">点击上传图片</span>
                  <span className="text-[10px] text-slate-400">支持 JPG、PNG，建议 16:9 横图</span>
                </label>
              )}
            </div>

            <button
              className="w-full bg-primary-blue hover:bg-blue-600 text-white font-bold rounded-2xl py-4 shadow-[0_4px_12px_rgba(26,92,138,0.25)] active:scale-[0.98] transition-all disabled:opacity-50 mt-4"
              onClick={submitRouteApplication}
              disabled={isSubmitting || routeSpotIds.length < 2 || !routeApplication.routeName || !routeApplication.routeDesc}
            >
              {isSubmitting ? '提交中...' : '提交路线申请'}
            </button>
          </div>
        </div>
      );
    }

    if (subPage === 'settings') {
      return (
        <div className="space-y-4 animate-fade-in">
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 shadow-sm border border-white">
            <p className="font-extrabold text-slate-800 mb-5 text-[15px]">个人资料</p>
            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-slate-500 ml-1 mb-1.5 block">显示名称</label>
                <input className="w-full bg-slate-50/50 border border-slate-200 rounded-2xl p-3.5 text-sm focus:bg-white focus:border-primary-blue/40 focus:ring-4 focus:ring-primary-blue/5 outline-none transition-all" value={profileDraft.virtualName} onChange={event => setProfileDraft(prev => ({ ...prev, virtualName: event.target.value }))} placeholder="请输入您的称呼" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 ml-1 mb-1.5 block">身份模式</label>
                <select className="w-full bg-slate-50/50 border border-slate-200 rounded-2xl p-3.5 text-sm focus:bg-white focus:border-primary-blue/40 focus:ring-4 focus:ring-primary-blue/5 outline-none transition-all appearance-none" value={profileDraft.userMode} onChange={event => setProfileDraft(prev => ({ ...prev, userMode: event.target.value }))}>
                  {Object.entries(UserModeNames)
                    .filter(([value]) => value !== 'guest')
                    .map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 ml-1 mb-1.5 block">所属学院</label>
                <input className="w-full bg-slate-50/50 border border-slate-200 rounded-2xl p-3.5 text-sm focus:bg-white focus:border-primary-blue/40 focus:ring-4 focus:ring-primary-blue/5 outline-none transition-all" value={profileDraft.virtualCollege} onChange={event => setProfileDraft(prev => ({ ...prev, virtualCollege: event.target.value }))} placeholder="如：计算机学院" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 ml-1 mb-1.5 block">专业名称</label>
                <input className="w-full bg-slate-50/50 border border-slate-200 rounded-2xl p-3.5 text-sm focus:bg-white focus:border-primary-blue/40 focus:ring-4 focus:ring-primary-blue/5 outline-none transition-all" value={profileDraft.virtualMajor} onChange={event => setProfileDraft(prev => ({ ...prev, virtualMajor: event.target.value }))} placeholder="如：软件工程" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 ml-1 mb-1.5 block">年级/届别</label>
                <input className="w-full bg-slate-50/50 border border-slate-200 rounded-2xl p-3.5 text-sm focus:bg-white focus:border-primary-blue/40 focus:ring-4 focus:ring-primary-blue/5 outline-none transition-all" type="number" value={profileDraft.virtualYear} onChange={event => setProfileDraft(prev => ({ ...prev, virtualYear: Number(event.target.value) }))} placeholder="如：2023" />
              </div>
            </div>
            <button className="w-full bg-gradient-to-r from-[#1a5c8a] to-[#2b6cb0] text-white font-bold py-4 rounded-full mt-8 active:scale-[0.98] transition-transform shadow-lg shadow-blue-500/25" disabled={savingProfile} onClick={saveProfile}>{savingProfile ? '保存中...' : '保存修改'}</button>
          </div>
          
          <div className="bg-white rounded-2xl p-2 shadow-sm border border-slate-50">
            <button className="w-full flex justify-between items-center p-3.5 active:bg-slate-50 transition-colors rounded-xl" onClick={() => { localStorage.removeItem('checkedInRoutes'); toast.success('缓存已清理'); }}>
              <span className="font-bold text-slate-700 text-sm">清理本地缓存</span>
              <SvgIcon name="chevron-right" className="w-4 h-4 text-slate-300" />
            </button>
            <div className="h-px bg-slate-50 mx-4"></div>
            <button className="w-full flex justify-between items-center p-3.5 active:bg-slate-50 transition-colors rounded-xl" onClick={() => toast.show('当前已是最新版本 v1.2.0')}>
              <span className="font-bold text-slate-700 text-sm">检查版本更新</span>
              <span className="text-[11px] text-slate-400">已是最新</span>
            </button>
          </div>
          
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-50">
            <p className="font-bold text-slate-800 mb-2 text-sm">关于平台</p>
            <p className="text-xs text-slate-500 leading-relaxed">山海大学校园导览系统为师生、校友及访客提供校园地图、路线规划、活动预约与 AI 数字人等全方位服务。</p>
          </div>
          
          <button className="w-full bg-white border border-red-100 text-red-500 rounded-full p-3.5 font-bold active:bg-red-50 transition-colors shadow-sm" onClick={onLogout}>
            退出当前身份
          </button>
        </div>
      );
    }
    
    if (subPage === 'cocreate') {
      return (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="relative bg-gradient-to-br from-primary-blue to-indigo-600 rounded-3xl p-6 overflow-hidden shadow-lg shadow-primary-blue/20">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl transform translate-x-1/3 -translate-y-1/3"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full blur-xl transform -translate-x-1/3 translate-y-1/3"></div>
            <div className="relative z-10 flex items-center justify-between">
              <div className="text-white">
                <h2 className="text-xl font-bold mb-1.5 drop-shadow-sm">共创校园计划</h2>
                <p className="text-xs text-white/80 leading-relaxed max-w-[200px]">
                  点滴记录汇聚山海之美<br/>
                  邀请你一起完善数字地图
                </p>
              </div>
              <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30 shrink-0 shadow-inner">
                <SvgIcon name="campus" className="w-7 h-7 text-white" />
              </div>
            </div>
          </div>

          {/* Core Entrances Grid */}
          <div className="grid grid-cols-2 gap-3">
            <button 
              className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center gap-3 active:scale-[0.98] transition-transform group"
              onClick={() => handleSubPageClick('applySpot')}
            >
              <div className="w-12 h-12 bg-blue-50 text-primary-blue rounded-full flex items-center justify-center group-active:bg-primary-blue group-active:text-white transition-colors">
                <SvgIcon name="spot" className="w-6 h-6" />
              </div>
              <div className="text-center">
                <h3 className="font-bold text-sm text-slate-800 mb-0.5">申报新点位</h3>
                <p className="text-[10px] text-slate-400">发现未记录的角落</p>
              </div>
            </button>
            <button 
              className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center gap-3 active:scale-[0.98] transition-transform group"
              onClick={() => handleSubPageClick('applyRoute')}
            >
              <div className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center group-active:bg-indigo-500 group-active:text-white transition-colors">
                <SvgIcon name="route" className="w-6 h-6" />
              </div>
              <div className="text-center">
                <h3 className="font-bold text-sm text-slate-800 mb-0.5">创建新路线</h3>
                <p className="text-[10px] text-slate-400">串联独特的游览路线</p>
              </div>
            </button>
          </div>

          {/* Secondary Entrances List */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <button 
              className="w-full flex items-center justify-between p-4 active:bg-slate-50 transition-colors border-b border-slate-50"
              onClick={() => handleSubPageClick('applications')}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-50 text-amber-500 rounded-xl flex items-center justify-center">
                  <SvgIcon name="edit" className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-sm text-slate-800">我的申请记录</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">查看审核进度与结果</p>
                </div>
              </div>
              <SvgIcon name="chevron-right" className="w-4 h-4 text-slate-300" />
            </button>
            <button 
              className="w-full flex items-center justify-between p-4 active:bg-slate-50 transition-colors"
              onClick={() => handleSubPageClick('personalRoutes')}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center">
                  <SvgIcon name="ai" className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-sm text-slate-800">我的 AI 路线</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">管理定制的专属路线</p>
                </div>
              </div>
              <SvgIcon name="chevron-right" className="w-4 h-4 text-slate-300" />
            </button>
          </div>

          {/* Rules/Info Card */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
            <h4 className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5 mb-3">
              <SvgIcon name="status" className="w-3.5 h-3.5 text-slate-400" />
              共创须知
            </h4>
            <ul className="space-y-2">
              <li className="text-[10px] text-slate-500 flex items-start gap-1.5">
                <span className="text-primary-blue mt-0.5">•</span>
                <span>提交申请后，管理员将进行审核。审核通过的内容将展示在全景地图中。</span>
              </li>
              <li className="text-[10px] text-slate-500 flex items-start gap-1.5">
                <span className="text-primary-blue mt-0.5">•</span>
                <span>请确保图文内容真实有效，无敏感信息。</span>
              </li>
            </ul>
          </div>
        </div>
      );
    }

    if (subPage === 'badges') {
      if (badges.length === 0 && badgeProgress.length === 0) return renderEmpty('暂无成就', '完成打卡、收藏等互动后解锁成就徽章');
      return (
        <div className="space-y-4">
          {badges.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-3">已解锁成就 ({badges.length})</h3>
              <div className="grid grid-cols-3 gap-3">
                {badges.map(badge => (
                  <div key={badge.id} className="bg-white rounded-2xl p-3 shadow-sm border border-amber-100 flex flex-col items-center text-center gap-2">
                    <BadgeIconView badge={badge} size={44} />
                    <div>
                      <p className="text-[11px] font-bold text-slate-700 leading-tight">{badge.badgeName}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{badge.badgeDesc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {badgeProgress.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-3">进行中的成就</h3>
              <div className="space-y-3">
                {badgeProgress.filter(p => !p.unlocked).map(item => {
                  const percent = item.targetValue > 0 ? Math.min(100, Math.round((item.currentValue / item.targetValue) * 100)) : 0;
                  return (
                    <div key={item.badge.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-50">
                      <div className="flex items-center gap-3 mb-2">
                        <BadgeIconView badge={item.badge} size={36} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-700 truncate">{item.badge.badgeName}</p>
                          <p className="text-[10px] text-slate-400">{item.conditionText}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-primary-blue rounded-full transition-all" style={{ width: `${percent}%` }} />
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 shrink-0">{item.currentValue}/{item.targetValue}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <button className="w-full bg-white border border-slate-200 text-slate-600 rounded-2xl py-3 text-sm font-bold active:scale-95 transition-transform" onClick={recalculateBadges}>
            刷新成就进度
          </button>
        </div>
      );
    }

    if (subPage === 'feedback') {
      const myFeedbacks = subData.feedbacks || [];
      const scoreLabels = ['体验不佳', '有待改进', '还算不错', '非常满意', '超棒体验'];
      const scoreColors = ['#ef4444', '#f59e0b', '#84cc16', '#22c55e', '#10b981'];
      return (
        <div className="animate-fade-in space-y-5">
          {/* Hero Banner */}
          <div className="relative bg-gradient-to-br from-amber-400 via-orange-400 to-rose-500 rounded-3xl p-6 overflow-hidden shadow-lg shadow-orange-500/20">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl transform translate-x-1/3 -translate-y-1/3"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full blur-xl transform -translate-x-1/3 translate-y-1/3"></div>
            <div className="relative z-10 flex items-center justify-between">
              <div className="text-white">
                <h2 className="text-lg font-extrabold drop-shadow-sm">游览体验反馈</h2>
                <p className="text-xs text-white/75 mt-1">
                  {myFeedbacks.length > 0 ? `已提交 ${myFeedbacks.length} 条反馈` : '分享您的使用感受，帮助我们做得更好'}
                </p>
              </div>
              <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              </div>
            </div>
          </div>

          {/* Feedback Form */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5m-1.414-9.414a2 2 0 1 1 2.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              </div>
              <p className="font-extrabold text-slate-800 text-[15px]">写下您的反馈</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-slate-500 ml-1 mb-2 block">整体评分</label>
                <div className="flex items-center gap-3 bg-slate-50 rounded-2xl p-3">
                  <Rate value={score} onChange={setScore} style={{ '--star-size': '28px' } as React.CSSProperties} />
                  <span className="text-[11px] font-bold ml-2" style={{ color: scoreColors[score - 1] || '#f59e0b' }}>{scoreLabels[score - 1] || ''}</span>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 ml-1 mb-2 block">反馈内容</label>
                <textarea
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm focus:bg-white focus:border-amber-300 focus:ring-4 focus:ring-amber-500/5 outline-none transition-all resize-none leading-relaxed"
                  rows={4}
                  placeholder="请分享您的使用体验、建议或遇到的问题..."
                  value={feedbackContent}
                  onChange={e => setFeedbackContent(e.target.value)}
                />
              </div>
              <button
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold py-3.5 rounded-2xl active:scale-[0.98] transition-transform shadow-md shadow-orange-500/20 hover:shadow-lg hover:shadow-orange-500/30"
                onClick={submitFeedback}
              >
                提交反馈
              </button>
            </div>
          </div>

          {/* Feedback History */}
          {myFeedbacks.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <h3 className="text-sm font-bold text-slate-600">我的反馈记录</h3>
                <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{myFeedbacks.length}条</span>
              </div>
              {myFeedbacks.map(item => (
                <div key={item.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:border-slate-200 transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                        item.score >= 4 ? 'bg-amber-100 text-amber-500' : item.score >= 3 ? 'bg-slate-100 text-slate-400' : 'bg-red-50 text-red-400'
                      }`}>
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-amber-500 text-xs">{'★'.repeat(item.score)}{'☆'.repeat(5 - item.score)}</span>
                        </div>
                        <span className="text-[10px] text-slate-400">{formatDateTime(item.createTime)}</span>
                      </div>
                    </div>
                    {item.adminReply ? (
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>已回复
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>待回复
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed mb-1">{item.feedbackContent}</p>
                  {item.adminReply && (
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-3.5 mt-3 border border-blue-100/50">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                        </div>
                        <p className="text-[11px] font-bold text-blue-700">管理员回复</p>
                        {item.replyTime && <span className="text-[9px] text-blue-400 ml-auto">{formatDateTime(item.replyTime)}</span>}
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed pl-7">{item.adminReply}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (subPage === 'digital') {
      const adjustable = new Set(globalConfig.capabilities.userPersonalization ? (globalConfig.userAdjustableFields || []) : []);
      const setDraft = <K extends keyof DigitalHumanUserConfig>(key: K, value: DigitalHumanUserConfig[K]) => setDigitalDraft(prev => ({ ...prev, [key]: value }));
      const toggleIcon = (key: string) => {
        const s = (d: string) => <path d={d}/>;
        switch (key) {
          case 'autoRead': return s('M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07');
          case 'subtitleEnabled': return s('M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z');
          case 'autoNarration': return s('M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z');
          case 'navigationAssistantExpanded': return s('M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6z');
          case 'routeAnimationEnabled': return s('M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83');
          case 'highContrast': return s('M12 2a10 10 0 0 1 0 20');
          case 'largeText': return s('M4 7V4h16v3M9 20h6M12 4v16');
          case 'seniorMode': return s('M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75');
          default: return s('M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z');
        }
      };
      const toggleRows: Array<{ key: keyof DigitalHumanUserConfig; label: string; description: string }> = [
        { key: 'autoRead', label: '自动朗读', description: '回答完成后自动播报' },
        { key: 'subtitleEnabled', label: '显示字幕', description: '语音讲解同时显示文字' },
        { key: 'autoNarration', label: '自动点位讲解', description: '到站后自动进入讲解' },
        { key: 'navigationAssistantExpanded', label: '地图助手展开', description: '进入地图时展示陪伴面板' },
        { key: 'routeAnimationEnabled', label: '路线动画', description: '显示轻量路线指示点' },
        { key: 'highContrast', label: '高对比度', description: '增强文字与背景区分' },
        { key: 'largeText', label: '大字号', description: '放大讲解和导航信息' },
        { key: 'seniorMode', label: '长者模式', description: '慢语速、简洁语言和大按钮' },
      ];
      return (
        <div className="animate-fade-in space-y-4">
          <style>{`
            @keyframes xiaohaiFloat {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-6px); }
            }
            @keyframes xiaohaiGlow {
              0%, 100% { box-shadow: 0 0 12px rgba(59,130,246,.15); }
              50% { box-shadow: 0 0 28px rgba(59,130,246,.35); }
            }
            .xiaohai-float { animation: xiaohaiFloat 3s ease-in-out infinite; }
            .xiaohai-glow { animation: xiaohaiGlow 2.5s ease-in-out infinite; }
          `}</style>

          {/* Xiaohai Profile Card */}
          <div className="relative bg-gradient-to-br from-primary-blue via-blue-600 to-indigo-600 rounded-3xl p-6 overflow-hidden shadow-lg shadow-primary-blue/20">
            <div className="absolute top-0 right-0 w-36 h-36 bg-white/10 rounded-full blur-3xl transform translate-x-1/3 -translate-y-1/3"></div>
            <div className="absolute bottom-0 left-0 w-28 h-28 bg-white/8 rounded-full blur-2xl transform -translate-x-1/3 translate-y-1/3"></div>
            <div className="relative z-10 flex items-center gap-5">
              <div className="xiaohai-glow rounded-full p-0.5">
                <div className="xiaohai-float rounded-full bg-white/10 p-1.5">
                  <XiaohaiAvatar size={68} status="idle" />
                </div>
              </div>
              <div className="text-white min-w-0">
                <h2 className="text-lg font-extrabold drop-shadow-sm">{effectiveConfig.name || effectiveConfig.digitalHumanName}</h2>
                <p className="text-xs text-white/70 mt-1 leading-relaxed line-clamp-2">{effectiveConfig.introduction}</p>
              </div>
            </div>
            {/* Quick status chips */}
            <div className="relative z-10 mt-4 flex flex-wrap gap-2">
              <span className="text-[10px] font-bold text-white/80 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1 border border-white/10">
                {digitalDraft.avatarTheme}
              </span>
              <span className="text-[10px] font-bold text-white/80 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1 border border-white/10">
                {digitalDraft.voiceType}
              </span>
              <span className="text-[10px] font-bold text-white/80 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1 border border-white/10">
                {digitalDraft.speechSpeed.toFixed(1)}x 语速
              </span>
              <span className="text-[10px] font-bold text-white/80 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1 border border-white/10">
                {digitalDraft.answerStyle}
              </span>
            </div>
            {/* Voice test */}
            <button
              onClick={() => {
                if (!capabilityEnabled('voiceRead')) { toast.show('语音朗读能力已由管理员关闭'); return; }
                const ok = speechService.speak(`你好，我是${effectiveConfig.name || '小海'}，很高兴陪你游览山海大学。`, {
                  lang: 'zh-CN',
                  voiceType: digitalDraft.voiceType,
                  rate: digitalDraft.speechSpeed,
                  volume: digitalDraft.volume,
                  pitch: digitalDraft.pitch,
                  seniorMode: digitalDraft.seniorMode,
                  category: 'test',
                  onVoiceResolved: (result) => {
                    const fallbackText = result.fallbackUsed
                      ? `当前设备未提供『${digitalDraft.voiceType}』对应音色，已使用：${result.resolvedVoiceName}（${result.resolvedVoiceLang}）`
                      : `当前使用：${result.resolvedVoiceName}（${result.resolvedVoiceLang}）`;
                    toast.show(fallbackText);
                  },
                });
                if (!ok) toast.error('当前浏览器不支持语音试听');
              }}
              className="relative z-10 mt-4 w-full flex items-center justify-center gap-2 bg-white/15 backdrop-blur-sm text-white rounded-2xl py-3 text-xs font-bold active:scale-[0.98] transition-transform border border-white/20 hover:bg-white/25"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
              试听语音
            </button>
          </div>

          {/* Appearance & Voice */}
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-5 shadow-sm border border-white">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-4 h-4 text-primary-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/></svg>
              <h3 className="text-sm font-extrabold text-slate-800">外观 & 声音</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-slate-500 ml-1 mb-1.5 block">形象主题</label>
                <select
                  disabled={!adjustable.has('avatarTheme')}
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-2xl p-3.5 text-sm focus:bg-white focus:border-primary-blue/40 focus:ring-4 focus:ring-primary-blue/5 outline-none transition-all appearance-none disabled:opacity-50"
                  value={digitalDraft.avatarTheme}
                  onChange={e => setDraft('avatarTheme', e.target.value)}
                >
                  {avatarStyles.map(style => <option key={style} value={style}>{style}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 ml-1 mb-1.5 block">声音类型</label>
                <select
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-2xl p-3.5 text-sm focus:bg-white focus:border-primary-blue/40 focus:ring-4 focus:ring-primary-blue/5 outline-none transition-all appearance-none disabled:opacity-50"
                  disabled={!adjustable.has('voiceType')}
                  value={digitalDraft.voiceType}
                  onChange={e => setDraft('voiceType', e.target.value)}
                >
                  {voiceTypes.map(voice => <option key={voice} value={voice}>{voice}</option>)}
                </select>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-[11px] font-bold text-slate-500 ml-1">语速</label>
                  <span className="text-[11px] font-bold text-primary-blue bg-blue-50 px-2 py-0.5 rounded-full">{digitalDraft.speechSpeed.toFixed(1)}x</span>
                </div>
                <input type="range" min="0.5" max="2" step="0.1" className="w-full accent-primary-blue" disabled={!adjustable.has('speechSpeed')} value={digitalDraft.speechSpeed} onChange={e => setDraft('speechSpeed', Number(e.target.value))} />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1"><span>0.5x 慢速</span><span>1.0x 标准</span><span>2.0x 快速</span></div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-[11px] font-bold text-slate-500 ml-1">音量</label>
                  <span className="text-[11px] font-bold text-primary-blue bg-blue-50 px-2 py-0.5 rounded-full">{Math.round(digitalDraft.volume * 100)}%</span>
                </div>
                <input type="range" min="0" max="1" step="0.1" className="w-full accent-primary-blue" disabled={!adjustable.has('volume')} value={digitalDraft.volume} onChange={e => setDraft('volume', Number(e.target.value))} />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-[11px] font-bold text-slate-500 ml-1">音调</label>
                  <span className="text-[11px] font-bold text-primary-blue bg-blue-50 px-2 py-0.5 rounded-full">{digitalDraft.pitch.toFixed(1)}</span>
                </div>
                <input type="range" min="0" max="2" step="0.1" className="w-full accent-primary-blue" disabled={!adjustable.has('pitch')} value={digitalDraft.pitch} onChange={e => setDraft('pitch', Number(e.target.value))} />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 ml-1 mb-1.5 block">回答风格</label>
                <div className="flex gap-2">
                  {['简洁', '标准', '详细'].map(style => (
                    <button
                      key={style}
                      disabled={!adjustable.has('answerStyle')}
                      onClick={() => setDraft('answerStyle', style as DigitalHumanUserConfig['answerStyle'])}
                      className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition-all disabled:opacity-50 ${
                        digitalDraft.answerStyle === style
                          ? 'bg-primary-blue text-white shadow-md shadow-blue-500/20'
                          : 'bg-slate-50 text-slate-500 border border-slate-200'
                      }`}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Preferences */}
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-5 shadow-sm border border-white">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-4 h-4 text-primary-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6z"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>
              <h3 className="text-sm font-extrabold text-slate-800">导航 & 交互</h3>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <label className="text-[11px] font-bold text-slate-500">导航提示频率<select value={digitalDraft.navigationPromptFrequency} onChange={e => setDraft('navigationPromptFrequency', e.target.value as DigitalHumanUserConfig['navigationPromptFrequency'])} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs"><option value="low">较少</option><option value="standard">标准</option><option value="high">频繁</option></select></label>
              <label className="text-[11px] font-bold text-slate-500">快捷问题偏好<select value={digitalDraft.quickQuestionPreference} onChange={e => setDraft('quickQuestionPreference', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs"><option>校园文化</option><option>学习生活</option><option>无障碍路线</option><option>亲子游览</option></select></label>
            </div>
          </div>

          {/* Feature Toggles */}
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-5 shadow-sm border border-white">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-4 h-4 text-primary-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              <h3 className="text-sm font-extrabold text-slate-800">功能开关</h3>
            </div>
            <div className="space-y-1">
              {toggleRows.map(item => (
                <div
                  key={item.key}
                  className={`flex items-center justify-between py-3 px-1 rounded-xl transition-colors ${!adjustable.has(item.key) ? 'opacity-40' : ''}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${digitalDraft[item.key] ? 'bg-blue-50 text-primary-blue' : 'bg-slate-50 text-slate-400'}`}>
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">{toggleIcon(item.key)}</svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-700">{item.label}</p>
                      <p className="text-[10px] text-slate-400 leading-tight">{item.description}</p>
                    </div>
                  </div>
                  <button
                    disabled={!adjustable.has(item.key)}
                    onClick={() => setDraft(item.key, !Boolean(digitalDraft[item.key]) as never)}
                    className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ml-2 ${digitalDraft[item.key] ? 'bg-primary-blue' : 'bg-slate-200'}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${digitalDraft[item.key] ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3 pb-2">
            <button
              onClick={async () => { await restoreAdminDefaults(); toast.success('已恢复管理员默认设置'); }}
              className="min-h-12 rounded-2xl bg-white border border-slate-200 text-xs font-bold text-slate-600 active:scale-95 transition-transform"
            >
              恢复默认
            </button>
            <button
              onClick={async () => {
                if (session.userMode === 'guest') { toast.warning('游客可预览，登录后才能保存'); return; }
                await saveUserConfig(digitalDraft);
                toast.success('数字人设置已保存');
              }}
              className="min-h-12 rounded-2xl bg-primary-blue text-xs font-bold text-white active:scale-95 transition-transform shadow-md shadow-blue-500/20"
            >
              保存配置
            </button>
          </div>
        </div>
      );
    }

    if (subPage === 'applications') {
      const apps = subData.applications || [];
      if (apps.length === 0) return renderEmpty('暂无申请记录', '提交点位或路线申请后会显示在这里');
      return (
        <div className="space-y-4">
          {apps.map(app => {
            const statusMap: Record<number, { text: string; bg: string; color: string }> = {
              0: { text: '待审核', bg: 'bg-amber-50', color: 'text-amber-600' },
              1: { text: '已通过', bg: 'bg-emerald-50', color: 'text-emerald-600' },
              2: { text: '已拒绝', bg: 'bg-red-50', color: 'text-red-500' },
            };
            const status = statusMap[app.status] || { text: '未知', bg: 'bg-slate-50', color: 'text-slate-500' };
            const isSpot = app.applicationType === 'spot';
            return (
              <div key={app.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-50">
                <div className="flex justify-between items-start mb-2 gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${isSpot ? 'bg-blue-50 text-blue-600' : 'bg-indigo-50 text-indigo-600'}`}>
                        {isSpot ? '点位申请' : '路线申请'}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${status.bg} ${status.color}`}>
                        {status.text}
                      </span>
                    </div>
                    <p className="font-bold text-sm text-slate-800 truncate">{isSpot ? app.spotName : app.routeName}</p>
                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{isSpot ? app.spotDesc : app.routeDesc}</p>
                  </div>
                </div>
                {app.auditComment && (
                  <div className="bg-slate-50 rounded-xl p-3 mt-2">
                    <p className="text-[10px] font-bold text-slate-500 mb-1">审核意见</p>
                    <p className="text-xs text-slate-600">{app.auditComment}</p>
                  </div>
                )}
                <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-50">
                  <span className="text-[10px] text-slate-400">{formatDateTime(app.createTime)}</span>
                  {app.status === 0 && (
                    <button
                      className="text-[11px] font-bold text-red-500 bg-red-50 rounded-full px-3 py-1"
                      onClick={() => withdrawApplication(app.id)}
                    >
                      撤回申请
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    return null;
  };

  if (subPage) {
    return (
      <>
        <div className="fixed top-0 bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-[1001] bg-[#F7F9FC] flex flex-col shadow-2xl overflow-hidden">
        <div className="shrink-0 h-14 bg-white/95 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-2 z-[1002]">
          <button className="w-12 h-12 rounded-full flex items-center justify-center text-slate-600 active:bg-slate-100 transition-colors" onClick={closeSubPage}>
            <SvgIcon name="back" className="w-6 h-6" />
          </button>
          <h1 className="font-bold text-[15px] text-slate-800 tracking-wide">{subPageTitles[subPage]}</h1>
          <button className="w-12 h-12 rounded-full text-xs text-primary-blue font-bold active:bg-blue-50 transition-colors" onClick={() => loadSubPageData(subPage)}>刷新</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 pb-[calc(32px+env(safe-area-inset-bottom))] relative no-scrollbar">
          {renderSubContent()}
        </div>
      </div>
        {/* Campus Map Selector is mounted after the subpage overlay with a higher fixed z-index. */}
        {mapPickerOpen && mapPickerSource && subPage === mapPickerSource && (
          <CampusMapSelector
            mode={mapPickerMode}
            privacyMode
            spots={subData.spots}
            initialPosition={mapPickerMode === 'single-point' ? selectedPosition : undefined}
            initialRouteSpotIds={mapPickerMode === 'route' ? routeSpotIds : undefined}
            onConfirm={(result) => {
              if (mapPickerSource === 'applySpot' && 'longitude' in result) {
                setSelectedPosition({ lng: result.longitude, lat: result.latitude });
                setSpotApplication(prev => ({ ...prev, longitude: result.longitude.toFixed(6), latitude: result.latitude.toFixed(6) }));
              }
              if (mapPickerSource === 'applyRoute' && 'spotIds' in result) {
                setRouteSpotIds(result.spotIds);
                const sel = result.spotIds.map((id: number) => subData.spots.find(s => s.id === id)).filter(Boolean) as CampusSpot[];
                if (sel.length >= 2) {
                  const mins = estimateWalkMinutes(sel) + sel.reduce((sm: number, s: CampusSpot) => sm + (s.recommendTime || 15), 0);
                  setRouteApplication(prev => ({ ...prev, totalMinute: mins }));
                }
              }
              setMapPickerOpen(false);
            }}
            onClose={() => setMapPickerOpen(false)}
          />
        )}
      </>
    );
  }

  // --- Main Profile UI ---
  const currentStyle = digitalConfig?.talkStyle || '校园讲解员';
  const displayModeName = session.userMode === 'guest'
    ? '游客'
    : UserModeNames[session.userMode as keyof typeof UserModeNames] || '访客';
  const profileSubtitle = session.userMode === 'guest'
    ? '访客模式，可浏览公开校园内容'
    : [session.virtualCollege, session.virtualMajor].filter(Boolean).join(' · ') || '山海大学数字身份';
  const statusText = session.status === 0 ? '当前身份已停用' : session.userMode === 'guest' ? '浏览模式' : '身份已激活';
  const statCards = [
    { label: '打卡', value: profileStats.checkinCount || 0, icon: <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/> },
    { label: '点位收藏', value: profileStats.favoriteSpotCount || 0, icon: <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/> },
    { label: '路线收藏', value: profileStats.favoriteRouteCount || 0, icon: <path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6z M9 3v15"/> },
    { label: '活动预约', value: profileStats.activityCount || 0, icon: <path d="M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/> },
  ];

  const renderGroup = (title: string, items: Array<{ page: ProfileSubPage; icon: React.ReactNode; title: string; count?: number; color?: string }>) => (
    <section className="mb-5">
      <h3 className="mb-2 ml-1 text-[11px] font-bold tracking-wide text-slate-400 uppercase">{title}</h3>
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        {items.map((item, index) => (
          <div key={item.page}>
            <button
              className="flex w-full items-center justify-between bg-white px-4 py-3.5 text-left transition-colors active:bg-slate-50"
              onClick={() => handleSubPageClick(item.page)}
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${item.color || 'bg-slate-50 text-slate-500'}`}>
                  <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">{item.icon}</svg>
                </div>
                <span className="font-bold text-slate-700 text-sm">{item.title}</span>
              </div>
              <div className="flex items-center gap-2">
                {typeof item.count === 'number' && item.count > 0 && <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full">{item.count}</span>}
                <svg className="w-4 h-4 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            </button>
            {index < items.length - 1 && <div className="h-px bg-slate-50 mx-4"></div>}
          </div>
        ))}
      </div>
    </section>
  );

  // Menu items with inline SVG icons (no emoji, consistent with bottom nav style)
  const journeyGroup = [
    { page: 'personalRoutes' as ProfileSubPage, icon: <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>, title: '个人 AI 路线', color: 'bg-amber-50 text-amber-500' },
    { page: 'history' as ProfileSubPage, icon: <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.2 3.2.8-1.3-4.5-2.7V7z"/>, title: '历史行程', count: profileStats.checkinCount, color: 'bg-blue-50 text-blue-500' },
    { page: 'favoriteSpots' as ProfileSubPage, icon: <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>, title: '收藏点位', count: profileStats.favoriteSpotCount, color: 'bg-rose-50 text-rose-500' },
    { page: 'favoriteRoutes' as ProfileSubPage, icon: <path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6z"/>, title: '收藏路线', count: profileStats.favoriteRouteCount, color: 'bg-indigo-50 text-indigo-500' },
  ];
  const activityGroup = [
    { page: 'reserves' as ProfileSubPage, icon: <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/>, title: '我的预约', count: profileStats.activityCount, color: 'bg-emerald-50 text-emerald-500' },
    { page: 'messages' as ProfileSubPage, icon: <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/>, title: '消息中心', count: unreadCount, color: 'bg-sky-50 text-sky-500' },
  ];
  const achievementGroup = [
    { page: 'badges' as ProfileSubPage, icon: <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>, title: '成就墙', count: badges.length, color: 'bg-amber-50 text-amber-500' },
  ];
  const coCreateGroup = [
    { page: 'cocreate' as ProfileSubPage, icon: <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>, title: '共创校园', color: 'bg-purple-50 text-purple-500' },
  ];
  const settingsGroup = [
    { page: 'feedback' as ProfileSubPage, icon: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>, title: '游览体验反馈', color: 'bg-slate-50 text-slate-500' },
    { page: 'settings' as ProfileSubPage, icon: <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>, title: '系统设置', color: 'bg-slate-50 text-slate-500' },
    { page: 'digital' as ProfileSubPage, icon: <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z M9 10a3 3 0 1 0 6 0 3 3 0 0 0-6 0z"/>, title: '数字人设置', color: 'bg-sky-50 text-sky-500' },
  ];

  return (
    <div className="min-h-screen bg-[#F7F9FC] pb-[calc(90px+env(safe-area-inset-bottom))]">
      {/* Header: back + title + settings */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 pt-[calc(8px+env(safe-area-inset-top))] pb-2 flex items-center justify-between">
        <button className="w-9 h-9 rounded-full flex items-center justify-center text-slate-600 active:bg-slate-100" onClick={onBack}>
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h1 className="text-base font-extrabold text-slate-800">我的</h1>
        <button className="w-9 h-9 rounded-full flex items-center justify-center text-slate-600 active:bg-slate-100" onClick={() => handleSubPageClick('settings')}>
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </button>
      </div>

      {/* Content area */}
      <div className="px-4 pt-3 space-y-4">
        {/* Identity Card — premium gradient with glassmorphism */}
        <div className="relative bg-gradient-to-br from-primary-blue via-blue-600 to-indigo-600 rounded-2xl p-5 overflow-hidden shadow-lg shadow-blue-500/20 active:scale-[0.99] transition-transform cursor-pointer">
          {/* Decorative blurs */}
          <div className="absolute top-0 right-0 w-28 h-28 bg-white/10 rounded-full blur-3xl -mr-8 -mt-8"></div>
          <div className="absolute bottom-0 left-0 w-20 h-20 bg-cyan-400/15 rounded-full blur-2xl -ml-6 -mb-6"></div>
          <div className="absolute top-1/2 left-1/3 w-16 h-16 bg-white/5 rounded-full blur-xl"></div>
          {/* Clickable avatar → settings */}
          <div className="relative z-10 flex items-center gap-4">
            <button
              className="relative shrink-0 group"
              onClick={(e) => { e.stopPropagation(); handleSubPageClick('settings'); }}
              aria-label="编辑个人资料"
            >
              <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center border-2 border-white/20 group-active:scale-95 transition-transform shadow-inner">
                <XiaohaiAvatar size={38} status="idle" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-white flex items-center justify-center shadow-md">
                <svg className="w-3 h-3 text-primary-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
              </div>
            </button>
            <div className="min-w-0 flex-1 text-white" onClick={() => handleSubPageClick('settings')}>
              <div className="flex items-center gap-2">
                <h2 className="truncate text-lg font-extrabold tracking-tight drop-shadow-sm">{session.virtualName || '未命名访客'}</h2>
                <span className="shrink-0 rounded-full bg-white/20 backdrop-blur-sm px-2.5 py-0.5 text-[10px] font-bold border border-white/20">{displayModeName}</span>
              </div>
              <p className="mt-1 text-xs text-white/80 truncate">{profileSubtitle}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${session.status === 0 ? 'text-amber-200' : 'text-emerald-200'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${session.status === 0 ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
                  {statusText}
                </span>
              </div>
            </div>
          </div>
        </div>

        {session.userMode === 'guest' && (
          <div className="flex items-center justify-between rounded-xl border border-sky-100 bg-sky-50/80 px-4 py-2.5">
            <p className="text-xs text-sky-800">登录后可使用收藏、预约、AI 与共创功能。</p>
            <button className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-sky-700 shadow-sm" onClick={onLogout}>立即登录</button>
          </div>
        )}
      </div>

      {/* Stats + Groups — same px-4 container */}
      <div className="px-4 space-y-3">
        {/* Stats — each cell clickable to respective subpage */}
        <div className="grid grid-cols-4 rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
          {[
            { ...statCards[0], page: 'history' as ProfileSubPage },
            { ...statCards[1], page: 'favoriteSpots' as ProfileSubPage },
            { ...statCards[2], page: 'favoriteRoutes' as ProfileSubPage },
            { ...statCards[3], page: 'reserves' as ProfileSubPage },
          ].map((item, index) => (
            <button
              key={item.label}
              className="relative flex min-w-0 flex-col items-center py-3 px-1 active:bg-slate-50 transition-colors"
              onClick={() => handleSubPageClick(item.page)}
            >
              {index > 0 && <span className="absolute left-0 top-1/2 h-7 w-px -translate-y-1/2 bg-slate-100" />}
              <span className="text-lg font-extrabold text-slate-900">{item.value}</span>
              <span className="mt-0.5 whitespace-nowrap text-[9px] text-slate-500">{item.label}</span>
            </button>
          ))}
        </div>

        {/* AI Card — click navigates to digital human settings */}
        <button
          className="w-full text-left rounded-xl bg-gradient-to-r from-blue-50 via-white to-sky-50 border border-blue-100 p-4 shadow-sm active:scale-[0.99] transition-transform flex items-center gap-3 group"
          onClick={() => handleSubPageClick('digital')}
        >
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-100 to-sky-100 flex items-center justify-center shrink-0 shadow-inner group-active:scale-95 transition-transform">
            <XiaohaiAvatar size={30} status="idle" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold text-slate-900">AI 导览分身</p>
            <p className="text-[11px] text-slate-500 truncate mt-0.5">{currentStyle} · {(digitalConfig?.speechSpeed || 1).toFixed(1)}x 语速</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] font-bold text-primary-blue bg-blue-50 px-2.5 py-1 rounded-full">设置</span>
            <svg className="w-4 h-4 text-slate-300 group-active:translate-x-0.5 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </button>

        {/* Groups */}
        <div className="space-y-4">
        {renderGroup('我的旅程', journeyGroup)}
        {renderGroup('我的活动', activityGroup)}
        {renderGroup('共创校园', coCreateGroup)}
        {renderGroup('我的成就', achievementGroup)}
        {renderGroup('服务设置', settingsGroup)}
        </div>
      </div>

      {/* Logout */}
      <div className="px-4 pt-2 pb-6">
        <button
          className="w-full bg-white rounded-xl p-3.5 shadow-sm border border-red-100 flex items-center gap-3 active:scale-[0.99] transition-transform"
          onClick={() => { Modal.confirm({ title: '退出登录', content: '确定要退出当前身份吗？', confirmText: '确定退出', cancelText: '取消', onConfirm: () => { toast.success('已退出登录'); onLogout(); } }); }}
        >
          <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
          </div>
          <span className="text-sm font-bold text-red-500 flex-1 text-left">退出登录</span>
        </button>
      </div>

      <style>{`
        @keyframes loginFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        .login-float { animation: loginFloat 3s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
