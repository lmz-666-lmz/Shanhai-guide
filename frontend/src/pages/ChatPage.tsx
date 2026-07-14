import { useState, useEffect, useRef } from 'react';
import { Modal } from 'antd-mobile';
import type { UserSession, CampusSpot, ChatSource, AiRoutePlan, SpotRecommendation, SuggestedAction } from '../types';
import XiaohaiAvatar from '../components/XiaohaiAvatar';
import { chatApi } from '../api';
import SpotRecommendationCard from '../components/chat/SpotRecommendationCard';
import AiRoutePlanCard from '../components/chat/AiRoutePlanCard';
import SourceReferencePanel from '../components/chat/SourceReferencePanel';
import RoutePlanningSkeleton from '../components/chat/RoutePlanningSkeleton';
import { useDigitalHuman } from '../contexts/DigitalHumanContext';
import { speechService } from '../utils/speechService';
import { useToast } from '../contexts/ToastContext';
import { getCampusLocationContext, hasLocation } from '../utils/locationContext';

interface ChatMessage {
  id: number;
  content: string;
  isUser: boolean;
  navigationSpots?: CampusSpot[];
  sources?: ChatSource[];
  cardType?: string;
  responseType?: string;
  spotRecommendations?: SpotRecommendation[];
  primarySpot?: SpotRecommendation | null;
  routePlan?: AiRoutePlan | null;
  clarification?: string | null;
  suggestedActions?: SuggestedAction[];
  /** Track which actionIds have been completed (for disabling buttons) */
  completedActionIds?: Set<string>;
  /** Track which actionId is currently loading */
  loadingActionId?: string | null;
}

interface ChatPageProps {
  session: UserSession;
  onBack: () => void;
  initialMessage?: string;
  onNavigate: (params: { page: string; spotId?: number; navigationMode?: boolean }) => void;
}

const quickReplies = [
  '45分钟怎么游览山海大学？',
  '帮我生成一条校园文化路线',
  '新生第一次来该怎么玩？',
  '推荐一条适合校友的怀旧路线',
  '山海大学有哪些值得参观的地方？',
  '今天有什么活动',
];

const modeLabel = (userMode: string) => ({
  guest: '访客模式',
  fresh: '新生模式',
  alumni: '校友模式',
  parent: '家长模式',
  research: '研学模式',
  senior: '长者模式',
} as Record<string, string>)[userMode] || '访客模式';

export default function ChatPage({ session, onBack, initialMessage, onNavigate }: ChatPageProps) {
  const { effectiveConfig, capabilityEnabled, setState: setDigitalHumanState, speak } = useDigitalHuman();

  const toast = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingType, setLoadingType] = useState<'route' | 'spot' | 'general'>('general');
  const [hasSentInitial, setHasSentInitial] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<number | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const sendingRef = useRef(false); // 防止并发发送和 StrictMode 重复 effect
  const initialMessageSentRef = useRef(false); // StrictMode 安全：确保 initialMessage 只发送一次
  const isGuest = session.userMode === 'guest';
  const isSpeaking = speakingMessageId !== null;

  useEffect(() => {
    setSpeechSupported(Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition));
    return () => {
      recognitionRef.current?.abort?.();
      speechService.cancel();
    };
  }, []);

  useEffect(() => {
    if (!isGuest) {
      fetchHistory();
    }
  }, [session, isGuest]);

  useEffect(() => {
    if (initialMessage && !hasSentInitial && !isGuest && !initialMessageSentRef.current) {
      // StrictMode 安全：使用 ref 确保 initialMessage 只发送一次。
      // 清除 sessionStorage 中的旧 pending prompt，防止页面刷新重复发送。
      initialMessageSentRef.current = true;
      const timer = setTimeout(() => {
        setHasSentInitial(true);
        // 原子消费 sessionStorage 中的 pending prompt
        try { sessionStorage.removeItem('shanhai_chat_pending_prompt'); } catch {}
        try { sessionStorage.removeItem('shanhai_chat_pending_spot_id'); } catch {}
        try { sessionStorage.removeItem('shanhai_chat_pending_spot_name'); } catch {}
        sendMessage(initialMessage);
        // 重置 ref 以便后续手动触发（同一组件实例内 initialMessage 不会变化）
        initialMessageSentRef.current = false;
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [initialMessage, hasSentInitial, isGuest]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const effectiveDigitalConfig = {
    name: effectiveConfig.name || effectiveConfig.digitalHumanName || '小海',
    style: effectiveConfig.answerStyle || effectiveConfig.guideStyle || effectiveConfig.style,
    voiceType: effectiveConfig.voiceType,
    speechSpeed: effectiveConfig.speechSpeed,
    welcomeText: effectiveConfig.welcomeTextsByMode?.[session.userMode] || effectiveConfig.welcomeText,
    avatar: effectiveConfig.avatar,
  };

  const fetchHistory = async () => {
    try {
      const response = await chatApi.getHistory(session.sessionId);
      if (response.data.code === 200 && response.data.data) {
        const historyMessages: ChatMessage[] = [];
        // 历史数据为 DESC 排序，反转以按时间正序显示
        const rawList = Array.isArray(response.data.data) ? response.data.data : [];
        rawList.reverse().forEach((msg: any) => {
          if (msg.userContent) {
            historyMessages.push({ id: msg.id * 10, content: msg.userContent, isUser: true });
          }
          // 同时支持 aiContent 和 answer 字段
          const aiText = msg.aiContent || msg.answer || '';
          if (aiText) {
            const payload = parseStructuredPayload(msg.structuredPayload);
            // cardType: 优先从顶层字段读取，其次从 structuredPayload
            const cardType = msg.cardType || payload.cardType || 'none';
            const responseType = msg.responseType || payload.responseType || 'text';
            // spotRecommendations: 优先从顶层字段读取（后端已从 structuredPayload 展开），其次从 payload
            const topSpotRecs = msg.spotRecommendations;
            const payloadSpotRecs = payload.spotRecommendations;
            let spotRecommendations: any[] = [];
            if (Array.isArray(topSpotRecs) && topSpotRecs.length > 0) {
              spotRecommendations = topSpotRecs;
            } else if (Array.isArray(payloadSpotRecs) && payloadSpotRecs.length > 0) {
              spotRecommendations = payloadSpotRecs;
            }
            // routePlan: 优先顶层，其次 payload
            const routePlan = msg.routePlan || payload.routePlan || null;
            const primarySpot = msg.primarySpot || payload.primarySpot || null;
            const clarification = msg.clarification || payload.clarification || null;
            // sources: 优先数组，其次从 sourceInfo 解析
            const sources = Array.isArray(msg.sources) && msg.sources.length > 0
              ? msg.sources
              : Array.isArray(payload.sources) && payload.sources.length > 0
                ? payload.sources
                : parseSources(msg.sourceInfo);
            const suggestedActions = Array.isArray(msg.suggestedActions) && msg.suggestedActions.length > 0
              ? msg.suggestedActions
              : Array.isArray(payload.suggestedActions)
                ? payload.suggestedActions
                : [];
            // navigationSpots: spot_list 时从 spotRecommendations 映射
            const navigationSpots = cardType === 'spot_list' && spotRecommendations.length > 0
              ? spotRecommendations.map(toCampusSpot).filter(Boolean) as CampusSpot[]
              : [];
            historyMessages.push({
              id: msg.id * 10 + 1,
              content: aiText,
              isUser: false,
              sources,
              cardType,
              responseType,
              spotRecommendations,
              primarySpot,
              routePlan,
              clarification,
              navigationSpots,
              suggestedActions,
            });
          }
        });
        if (historyMessages.length > 0) {
          setMessages(historyMessages);
        }
      }
    } catch (error) {
      console.error('Failed to fetch history:', error);
    }
  };

  const parseSources = (sourceInfo?: string): ChatSource[] => {
    if (!sourceInfo) return [];
    try {
      const parsed = JSON.parse(sourceInfo);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const parseStructuredPayload = (payload?: string): any => {
    if (!payload) return {};
    try {
      const parsed = JSON.parse(payload);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  };

  // Safe text renderer: **bold**, newlines, no HTML execution
  const renderSafeText = (text: string): React.ReactNode[] => {
    if (!text) return [];
    // Escape all HTML first
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    // Split by newlines, then process **bold** per line
    const lines = escaped.split('\n');
    return lines.map((line, li) => {
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      const nodes = parts.map((part, pi) => {
        const boldMatch = part.match(/^\*\*([^*]+)\*\*$/);
        if (boldMatch) {
          return <strong key={pi}>{boldMatch[1]}</strong>;
        }
        return part;
      });
      return (
        <span key={li}>
          {li > 0 && <br />}
          {nodes}
        </span>
      );
    });
  };

  const toCampusSpot = (item: SpotRecommendation | any): CampusSpot | null => {
    if (!item) return null;
    const id = item.id ?? item.spotId;
    if (!id) return null;
    const spotName = item.spotName ?? item.name ?? '';
    if (!spotName) return null;
    return {
      id,
      spotName,
      spotType: item.spotType || '',
      longitude: Number(item.longitude || 0),
      latitude: Number(item.latitude || 0),
      openTime: item.openTime || '',
      recommendTime: Number(item.recommendTime || 15),
      spotDesc: item.spotDesc || item.desc || item.description || item.reason || '',
      spotImage: item.spotImage || item.image || '',
      suitableMode: item.suitableMode || '',
      isEnable: item.isEnable ?? 1,
    };
  };

  const handleClearChat = async () => {
    const confirmed = await Modal.confirm({
      title: '清空当前对话？',
      content: '清空后将删除该会话下所有聊天记录，不可恢复。',
      confirmText: '确认清空',
      cancelText: '取消',
    });
    if (!confirmed) return;

    try {
      const response = await chatApi.clearHistory(session.sessionId);
      if (response.data.code === 200) {
        setMessages([]);
        setInputValue('');
        const count = response.data.data ?? 0;
        toast.show(`聊天记录已清空（${count} 条）`);
      } else {
        toast.error(response.data.message || '清空失败，请重试');
      }
    } catch (error: any) {
      console.error('Failed to clear history:', error);
      toast.error(error?.message || '清空失败，请检查网络');
    }
  };



  const startVoiceInput = () => {
    if (!capabilityEnabled('voiceInput')) {
      toast.show('管理员已关闭语音输入');
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.show('当前浏览器不支持语音输入');
      return;
    }
    if (listening) {
      recognitionRef.current?.stop?.();
      setListening(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => { setListening(true); setDigitalHumanState('listening'); };
    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      if (transcript) setInputValue(prev => `${prev}${prev ? ' ' : ''}${transcript}`);
    };
    recognition.onerror = () => {
      toast.show('语音识别暂不可用');
      setListening(false);
    };
    recognition.onend = () => { setListening(false); setDigitalHumanState('idle'); };
    recognitionRef.current = recognition;
    recognition.start();
  };

  const speakMessage = (message: ChatMessage) => {
    if (!capabilityEnabled('voiceRead')) return;
    if (!speechService.isSupported()) {
      toast.show('当前浏览器不支持语音播报');
      return;
    }
    if (speakingMessageId === message.id) {
      speechService.cancel();
      setSpeakingMessageId(null);
      return;
    }
    const started = speak(message.content, {
      onStart: () => setSpeakingMessageId(message.id),
      onEnd: () => setSpeakingMessageId(null),
      onError: () => setSpeakingMessageId(null),
    });
    if (!started) toast.show('当前浏览器不支持语音播报');
  };

  const sendMessage = async (content: string) => {
    if (isGuest) {
      Modal.alert({
        content: 'AI 导览、路线讲解和活动咨询需要创建数字身份，请登录后使用',
        confirmText: '去登录',
        onConfirm: onBack,
      });
      return;
    }
    if (!capabilityEnabled('aiChat')) {
      toast.show('管理员已暂时关闭 AI 问答');
      return;
    }
    
    if (!content.trim() || loading || sendingRef.current) return;

    // 原子发送门：防止 StrictMode 或快速双击导致同一消息发送两次
    sendingRef.current = true;

    // Detect question type for loading skeleton
    // 路线关键词：仅用于前端加载骨架判断，实际意图以后端结构化 cardType 为准
    // "导览"不在此列表中，因为"小海导览介绍"应识别为点位介绍而非路线
    const routeKeywords = ['路线', '规划', '游览', '逛', '半日', '一日', '行程', '推荐路线', '怎么玩', '一日游', '半日游', '导航到', '先去', '再去'];
    // 点位介绍关键词优先级高于路线关键词
    const spotIntroKeywords = ['介绍', '讲解', '简介', '讲解词', '开放时间', '几点开放', '导览介绍', '导览讲解'];
    const spotKeywords = ['在哪', '怎么去', '南门', '食堂', '餐厅', '图书馆', '卫生间', '停车', '哪里', '什么地方', '介绍', '讲解'];
    const hasRouteStructure = /从.+(到|去)|先去|再去|途经|经过|串联|路线|行程|校园导览/.test(content);
    const isSpotIntro = spotIntroKeywords.some(k => content.includes(k)) && !hasRouteStructure;
    const isRoute = hasRouteStructure || (!isSpotIntro && routeKeywords.some(k => content.includes(k)));
    const isSpot = isSpotIntro || spotKeywords.some(k => content.includes(k));
    setLoadingType(isRoute ? 'route' : isSpot ? 'spot' : 'general');

    setMessages(prev => [...prev, { id: Date.now(), content, isUser: true }]);
    setInputValue('');
    setLoading(true);
    setDigitalHumanState(isRoute ? 'planning' : 'thinking');

    try {
      // 普通聊天不再自动注入 GPS 位置或当前点位。
      // 只有明确单点导航意图（如"带我去图书馆"）才在后端按需解析起点。
      // 这里始终以纯文本方式发送，位置由后端意图识别后按需处理。
      const response = await chatApi.sendMessage(session.sessionId, content);
      if (response.data.code === 200 && response.data.data) {
        const aiContent = response.data.data.aiContent || response.data.data.answer || '';
        const cardType = response.data.data.cardType || 'none';
        const responseType = response.data.data.responseType || 'text';
        const spotRecommendations = response.data.data.spotRecommendations || [];
        const primarySpot = response.data.data.primarySpot || null;
        // 导航点位：spot_list 时使用后端推荐；route_plan 和 none 时为空（不自动文本匹配）
        const navigationSpots = cardType === 'spot_list'
          ? spotRecommendations.map(toCampusSpot).filter(Boolean) as CampusSpot[]
          : [];
        setMessages(prev => [...prev, {
          id: Date.now() + 1,
          content: aiContent,
          isUser: false,
          navigationSpots,
          sources: response.data.data.sources || [],
          cardType,
          responseType,
          spotRecommendations,
          primarySpot,
          routePlan: response.data.data.routePlan || null,
          clarification: response.data.data.clarification || null,
          suggestedActions: response.data.data.suggestedActions || [],
        }]);
        setDigitalHumanState('answering');
        if (effectiveConfig.autoRead && aiContent) speak(aiContent);
      } else {
        toast.show('发送失败，请重试');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.show('发送失败，请重试');
    } finally {
      setLoading(false);
      setDigitalHumanState('idle');
      sendingRef.current = false; // 释放发送门
    }
  };

  /**
   * Execute a structured suggested action — the key fix for the dead loop.
   * Calls /api/chat/action instead of re-sending the button label as text.
   */
  const handleSuggestedAction = async (messageId: number, action: SuggestedAction) => {
    if (!action.actionType || !action.actionId) {
      console.warn('SuggestedAction missing actionType or actionId:', action);
      return;
    }

    // Check if already completed
    const msg = messages.find(m => m.id === messageId);
    if (msg?.completedActionIds?.has(action.actionId)) {
      return; // Already executed — idempotent
    }

    // CONTINUE_QUESTION / ASK_ANOTHER_QUESTION：将按钮文案作为新聊天消息发送，
    // 走正常意图识别流程，而非调用无效的 executeAction 返回"请继续提问"。
    if (action.actionType === 'CONTINUE_QUESTION' || action.actionType === 'ASK_ANOTHER_QUESTION') {
      setMessages(prev => prev.map(m =>
        m.id === messageId
          ? { ...m, completedActionIds: new Set([...(m.completedActionIds || []), action.actionId]) }
          : m
      ));
      sendMessage(action.label);
      return;
    }

    // Set loading state for this specific action
    setMessages(prev => prev.map(m =>
      m.id === messageId ? { ...m, loadingActionId: action.actionId } : m
    ));

    try {
      // 仅在操作明确需要位置时（如 START_SPOT_NAVIGATION）才读取位置上下文。
      // 其他操作（如 ASK_SPOT_INTRO、CONFIRM_ROUTE_DRAFT）不自动注入位置。
      const needsLocation = action.actionType === 'START_SPOT_NAVIGATION'
        || action.actionType === 'START_ROUTE_NAVIGATION'
        || action.actionType === 'INTRODUCE_CURRENT_SPOT'
        || action.actionType === 'FIND_NEAREST_RESTROOM'
        || action.actionType === 'FIND_NEAREST_FACILITY';
      const locCtx = needsLocation ? getCampusLocationContext() : { mode: 'unlocated' as const, position: null, label: '', updatedAt: null };
      const positionParams = needsLocation && hasLocation(locCtx)
        ? { startLng: locCtx.position!.longitude, startLat: locCtx.position!.latitude, locationLabel: locCtx.label, startMode: locCtx.mode }
        : {};

      const response = await chatApi.executeAction(
        session.sessionId,
        action.actionType,
        action.actionId,
        action.payload,
        positionParams.startLng,
        positionParams.startLat,
        positionParams.locationLabel,
        positionParams.startMode,
      );

      if (response.data.code === 200 && response.data.data) {
        const data = response.data.data;
        const aiContent = data.aiContent || data.answer || '';
        const cardType = data.cardType || 'none';
        const responseType = data.responseType || 'text';
        const spotRecommendations = data.spotRecommendations || [];
        const primarySpot = data.primarySpot || null;

        // Mark original action as completed
        setMessages(prev => prev.map(m =>
          m.id === messageId
            ? {
                ...m,
                loadingActionId: null,
                completedActionIds: new Set([...(m.completedActionIds || []), action.actionId]),
              }
            : m
        ));

        // Insert a user-action display record (visual feedback only, NOT re-sent as text)
        setMessages(prev => [...prev, {
          id: Date.now(),
          content: action.label,
          isUser: true,
        }]);

        // Append AI response
        setMessages(prev => [...prev, {
          id: Date.now() + 1,
          content: aiContent,
          isUser: false,
          sources: data.sources || [],
          cardType,
          responseType,
          spotRecommendations,
          primarySpot,
          routePlan: data.routePlan || null,
          clarification: data.clarification || null,
          suggestedActions: data.suggestedActions || [],
        }]);

        setDigitalHumanState('answering');
        if (effectiveConfig.autoRead && aiContent) speak(aiContent);
      } else {
        toast.show(response.data.message || '操作失败，请重试');
        setMessages(prev => prev.map(m =>
          m.id === messageId ? { ...m, loadingActionId: null } : m
        ));
      }
    } catch (error: any) {
      console.error('Failed to execute action:', error);
      toast.show(error?.message || '操作失败，请检查网络');
      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, loadingActionId: null } : m
      ));
    }
  };

  const renderGuestPrompt = () => (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 bg-blue-50 text-primary-blue rounded-full flex items-center justify-center mb-6 shadow-sm">
        <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>
      </div>
      <h2 className="text-xl font-bold text-slate-800 mb-2">登录后使用 AI 数字人</h2>
      <p className="text-sm text-slate-500 mb-8 leading-relaxed px-4">AI 导览、路线讲解和活动咨询需要创建数字身份才能进行深度交互。</p>
      <div className="space-y-3 w-full max-w-xs">
        <button className="w-full bg-primary-blue text-white font-bold py-3 rounded-full shadow-md shadow-blue-500/20 active:scale-95 transition-transform" onClick={onBack}>
          去登录
        </button>
        <button className="w-full bg-slate-100 text-slate-600 font-bold py-3 rounded-full active:scale-95 transition-transform" onClick={onBack}>
          返回首页
        </button>
      </div>
    </div>
  );


  return (
    <div className={`h-[100dvh] bg-gradient-to-br from-[#F7F9FC] via-[#f0f6fc] to-[#e6f0fa] flex flex-col relative overflow-hidden ${effectiveConfig.highContrast ? 'contrast-125' : ''} ${effectiveConfig.largeText ? 'text-[17px]' : ''}`}>
      {/* Fixed Header */}
      <header className="shrink-0 pt-[env(safe-area-inset-top)] bg-white/70 backdrop-blur-2xl border-b border-white/50 sticky top-0 z-20 shadow-[0_4px_20px_-10px_rgba(26,92,138,0.1)] flex flex-col">
        <div className="h-14 flex items-center justify-between px-2">
          <button 
            className="w-10 h-10 rounded-full flex items-center justify-center text-slate-600 active:bg-slate-100 transition-colors"
            onClick={onBack}
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          
          <div className="flex-1 flex items-center justify-center gap-2">
            <h2 className="font-bold text-slate-800 text-[16px] tracking-wide">{effectiveDigitalConfig.name} AI 导览</h2>
            <div className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${loading ? 'bg-amber-400 animate-pulse' : isSpeaking ? 'bg-sky-500 animate-pulse' : 'bg-emerald-500'}`}></span>
              <span className="text-[10px] text-slate-500 font-medium">{loading ? '思考中' : isSpeaking ? '讲解中' : '在线'}</span>
            </div>
          </div>

          <div className="flex items-center">
            <button 
              className="w-9 h-9 rounded-full flex items-center justify-center text-slate-600 active:bg-slate-100 transition-colors"
              onClick={handleClearChat}
              title="清空消息"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
            <button 
              className="w-9 h-9 rounded-full flex items-center justify-center text-slate-600 active:bg-slate-100 transition-colors"
              onClick={() => {
                sessionStorage.setItem('shanhai_profile_subpage', 'digital');
                sessionStorage.setItem('shanhai_profile_back_to', 'chat');
                onNavigate({ page: 'profile' });
              }}
              title="数字人设置"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      {isGuest ? renderGuestPrompt() : (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 space-y-4 no-scrollbar flex flex-col">
          {messages.length === 0 && (
            <div data-testid="compact-welcome-card" className="min-h-[160px] max-h-[200px] bg-white rounded-[24px] p-4 shadow-sm border border-slate-100 flex items-center gap-4 shrink-0 mx-auto w-full max-w-sm">
              <div className={`relative w-20 h-20 shrink-0 rounded-[28px] bg-gradient-to-tr from-sky-100 to-blue-50 flex items-center justify-center shadow-inner ${loading ? 'animate-pulse ring-4 ring-amber-100' : isSpeaking ? 'ring-4 ring-sky-100' : ''}`}>
                <XiaohaiAvatar size={52} status={loading ? 'thinking' : isSpeaking ? 'speaking' : 'idle'} />
              </div>
              <div className="min-w-0">
                <p className="font-extrabold text-slate-800 text-[15px]">你好，我是{effectiveDigitalConfig.name}</p>
                <p className="mt-1 text-[11px] font-bold text-primary-blue">{modeLabel(session.userMode)} · {effectiveDigitalConfig.voiceType}</p>
                <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-slate-600">{effectiveDigitalConfig.welcomeText}</p>
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.length === 0 ? (
            <div data-testid="first-screen-quick-questions" className="grid grid-cols-2 gap-2 w-full max-w-sm mx-auto">
              {quickReplies.map(text => (
                <button key={text} onClick={() => sendMessage(text)} className="min-h-12 whitespace-normal break-words rounded-2xl border border-blue-100 bg-blue-50/80 px-3 py-2 text-left text-xs font-bold leading-snug text-blue-800 active:scale-[0.98]">{text}</button>
              ))}
            </div>
          ) : (
            messages.map(message => (
              message.isUser ? (
                <div key={message.id} className="flex flex-row-reverse gap-3 max-w-[85%] self-end animate-fade-in">
                  <div className="bg-primary-blue text-white p-3.5 rounded-2xl rounded-tr-sm shadow-sm">
                    <p className="text-[15px] leading-relaxed break-words">{message.content}</p>
                  </div>
                </div>
              ) : (
                <div key={message.id} className="flex gap-3 max-w-[82%] self-start animate-fade-in">
                  <div className="w-8 h-8 shrink-0 rounded-full bg-blue-50 text-primary-blue flex items-center justify-center shadow-sm">
                    <XiaohaiAvatar size={20} status="idle" />
                  </div>
                  <div className="bg-white p-4 rounded-2xl rounded-tl-[4px] shadow-sm border border-slate-100 text-[15px] text-slate-700 leading-relaxed overflow-hidden">
                    <p className="whitespace-pre-wrap">{renderSafeText(message.content)}</p>
                    {message.content && (
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          className={`flex items-center gap-1 text-[11px] font-bold rounded-full px-3 py-1.5 transition-transform active:scale-95 ${speakingMessageId === message.id ? 'bg-sky-50 text-sky-600' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                          onClick={() => speakMessage(message)}
                        >
                          {speakingMessageId === message.id ? (
                            <><span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse"></span>停止朗读</>
                          ) : (
                            <><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>朗读</>
                          )}
                        </button>
                      </div>
                    )}
                    {message.suggestedActions && message.suggestedActions.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {message.suggestedActions.map((action) => {
                          // Support both old string format and new structured format
                          if (typeof action === 'string') {
                            // Legacy: plain string — send as text (will be re-parsed, not ideal but backward-compatible)
                            return (
                              <button key={action as string} onClick={() => sendMessage(action as string)}
                                className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-[11px] font-bold text-primary-blue">
                                {action as string}
                              </button>
                            );
                          }
                          const sa = action as SuggestedAction;
                          const isCompleted = message.completedActionIds?.has(sa.actionId);
                          const isLoading = message.loadingActionId === sa.actionId;

                          // Skip completed confirm-type actions (show as text instead)
                          if (isCompleted && (
                            sa.actionType === 'CONFIRM_ROUTE_DRAFT' ||
                            sa.actionType === 'MODIFY_ROUTE_DURATION'
                          )) {
                            return (
                              <span key={sa.actionId} className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-600">
                                已{sa.label}
                              </span>
                            );
                          }

                          return (
                            <button
                              key={sa.actionId}
                              onClick={() => handleSuggestedAction(message.id, sa)}
                              disabled={isCompleted || isLoading}
                              className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition-all ${
                                isLoading
                                  ? 'border-amber-200 bg-amber-50 text-amber-600 animate-pulse'
                                  : isCompleted
                                    ? 'border-slate-200 bg-slate-50 text-slate-400'
                                    : 'border-blue-100 bg-blue-50 text-primary-blue active:scale-95'
                              }`}
                            >
                              {isLoading ? '执行中...' : sa.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <SourceReferencePanel sources={message.sources} />
                    {/* 路线卡：必须 cardType === 'route_plan' 且 routePlan 数据完整 */}
                    {message.cardType === 'route_plan' && message.routePlan && Array.isArray(message.routePlan.spots) && message.routePlan.spots.length > 0 && (
                      <AiRoutePlanCard routePlan={message.routePlan} session={session} onNavigate={onNavigate} />
                    )}
                    {/* 点位卡：必须 cardType === 'spot_list' 且 navigationSpots 非空 */}
                    {message.cardType === 'spot_list' && Array.isArray(message.navigationSpots) && message.navigationSpots.length > 0 && (
                      <SpotRecommendationCard spots={message.navigationSpots} onNavigate={onNavigate} />
                    )}
                    {/* 单点介绍：最多显示一个目标点位卡，普通文本/澄清不显示 */}
                    {message.cardType === 'spot_intro' && message.primarySpot && (
                      <SpotRecommendationCard spots={[message.primarySpot].map(toCampusSpot).filter(Boolean) as CampusSpot[]} onNavigate={onNavigate} />
                    )}
                  </div>
                </div>
              )
            ))
          )}

          {/* Loading Indicator */}
          {loading && (
            <div className="flex gap-3 max-w-[82%] self-start animate-fade-in">
              <div className="w-8 h-8 shrink-0 rounded-full bg-blue-50 text-primary-blue flex items-center justify-center shadow-sm">
                <XiaohaiAvatar size={20} status="thinking" />
              </div>
              <div className="bg-white p-4 rounded-2xl rounded-tl-[4px] border border-slate-100 shadow-sm min-w-[240px]">
                {loadingType === 'route' ? (
                  <RoutePlanningSkeleton />
                ) : loadingType === 'spot' ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-100 animate-pulse flex items-center justify-center shrink-0">
                        <div className="w-1 h-1 rounded-full bg-primary-blue"></div>
                      </div>
                      <p className="text-[12px] font-bold text-primary-blue">正在为您查找地点信息</p>
                    </div>
                    <div className="space-y-2">
                      <div className="h-3 bg-slate-100 rounded-full animate-pulse w-4/5"></div>
                      <div className="flex gap-3 mt-3 p-2 bg-blue-50/50 rounded-xl border border-blue-100/50">
                        <div className="w-12 h-12 rounded-lg bg-white shadow-sm animate-pulse shrink-0"></div>
                        <div className="flex-1 space-y-2 py-1">
                          <div className="h-2.5 bg-slate-200 rounded-full animate-pulse w-2/3"></div>
                          <div className="h-2 bg-slate-100 rounded-full animate-pulse w-full"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 h-6 px-1">
                    <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} className="h-2 shrink-0" />
        </div>
      )}

      {/* Fixed Bottom Input Area */}
      {!isGuest && (
        <div className="shrink-0 pb-[calc(110px+env(safe-area-inset-bottom))] bg-white/80 backdrop-blur-xl border-t border-white/60 z-20 shadow-[0_-4px_20px_rgba(26,92,138,0.05)]">
          <div className="p-3">
            {messages.length > 0 && <div data-testid="conversation-quick-questions" className="flex w-full gap-2 mb-3 overflow-x-auto no-scrollbar pb-1">
              {(effectiveConfig.quickQuestions?.length ? effectiveConfig.quickQuestions : quickReplies).map(text => (
                <button
                  key={text}
                  className="max-w-[78vw] flex-none whitespace-nowrap bg-slate-50 text-slate-700 text-[11px] px-3.5 py-1.5 rounded-full border border-slate-200 active:scale-95 transition-transform"
                  onClick={() => sendMessage(text)}
                >
                    {text}
                  </button>
                ))}
              </div>}

            {/* Input Bar */}
            <div className="flex items-end gap-2">
              <div className="flex-1 relative bg-slate-100 rounded-2xl border border-slate-200 focus-within:border-blue-300 focus-within:bg-white transition-colors overflow-hidden">
                <textarea
                  data-testid="chat-input"
                  className="w-full bg-transparent px-4 py-3 text-[14px] font-medium text-slate-900 placeholder:text-slate-500 outline-none resize-none max-h-32 leading-relaxed"
                  placeholder="问问小海..."
                  rows={1}
                  value={inputValue}
                  onChange={e => {
                    setInputValue(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage(inputValue);
                      e.currentTarget.style.height = 'auto';
                    }
                  }}
                />
              </div>
              {speechSupported && (
                <button
                  className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center active:scale-95 transition-transform mb-0.5 ${listening ? 'bg-red-500 text-white shadow-md shadow-red-500/20' : 'bg-slate-100 text-slate-600'}`}
                  onClick={startVoiceInput}
                  disabled={loading}
                  title={listening ? '停止语音输入' : '语音输入'}
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z"/>
                    <path d="M19 11a7 7 0 0 1-14 0"/>
                    <path d="M12 18v4"/>
                    <path d="M8 22h8"/>
                  </svg>
                </button>
              )}
              <button 
                className="w-11 h-11 shrink-0 rounded-full flex items-center justify-center bg-primary-blue text-white active:scale-95 transition-transform disabled:opacity-50 disabled:active:scale-100 shadow-md shadow-blue-500/20 mb-0.5"
                onClick={() => {
                  sendMessage(inputValue);
                  // Reset height is handled in the effect or value reset usually, but we can do it via a ref if needed.
                  // Since inputValue is cleared, the textarea will shrink on next render or if we force it.
                }}
                disabled={loading || !inputValue.trim()}
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <svg className="w-5 h-5 ml-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
