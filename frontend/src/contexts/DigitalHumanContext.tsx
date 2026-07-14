import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type {
  CampusSpot,
  ChatSource,
  DigitalHumanConfig,
  DigitalHumanGlobalConfig,
  DigitalHumanState,
  DigitalHumanUserConfig,
  UserSession,
} from '../types';
import { digitalHumanApi, narrationApi, type NarrationResponse } from '../api';
import { speechService, type SpeechOptions } from '../utils/speechService';
import { narrationDedup, getNarrationSpotKey } from '../utils/narrationDedup';

const LEGACY_USER_CONFIG_PREFIXES = ['@dh:', '__DC__::', '**DC**::', 'DC::'];

const DEFAULT_GLOBAL: DigitalHumanGlobalConfig = {
  name: '小海', digitalHumanName: '小海', avatar: '', avatarTheme: '山海蓝', style: '校园讲解员',
  voiceType: '温柔女声', speed: 1, speechSpeed: 1, volume: 0.9, pitch: 1.0, autoRead: false, subtitleEnabled: true,
  welcomeText: '欢迎来到山海大学！我是你的校园 AI 导览员小海。',
  introduction: '能听懂游览时间与需求，基于可信校园知识讲解，并在地图中逐站陪伴导航。',
  guideStyle: '标准', defaultAnswerStyle: '标准',
  capabilities: { aiChat: true, knowledgeNarration: true, pointNarration: true, routePlanning: true, mapCompanion: true, autoArrivalNarration: true, voiceInput: true, voiceRead: true, navigationVoice: true, routeAnimation: true, subtitles: true, seniorMode: true, highContrast: true, largeText: true, userPersonalization: true, cocreateRecommendation: true },
  quickQuestions: ['45 分钟怎么游览山海大学？', '帮我生成一条校园文化路线', '新生第一次来该怎么玩？', '推荐一条适合校友的怀旧路线', '山海大学有哪些值得参观的地方？'],
  welcomeTextsByMode: {},
  navigationSettings: { promptFrequency: 'standard', arrivalDetection: 'manual', autoNarration: false, showRouteAnimation: true, allowSkipStation: true, allowReplan: true },
  narrationSettings: { defaultMode: 'concise', showSources: true, autoArrivalPrompt: true },
  accessibilitySettings: { highContrast: false, largeText: false, seniorMode: false },
  fallbackMessages: { arrival: '已到达{spotName}，需要我讲解这里吗？', navigationComplete: '本次山海大学游览已完成，感谢一路同行。', error: '小海暂时没有理解，请稍后再试。', noKnowledge: '当前讲解暂无明确知识库依据，请以学校实际发布信息为准。' },
  userAdjustableFields: ['avatarTheme', 'voiceType', 'speechSpeed', 'volume', 'pitch', 'autoRead', 'subtitleEnabled', 'answerStyle', 'autoNarration', 'navigationAssistantExpanded', 'routeAnimationEnabled', 'highContrast', 'largeText', 'seniorMode', 'navigationPromptFrequency', 'quickQuestionPreference'],
};

const defaultUserFromGlobal = (global: DigitalHumanGlobalConfig): DigitalHumanUserConfig => ({
  avatarTheme: global.avatarTheme || '山海蓝',
  voiceType: global.voiceType || '温柔女声',
  speechSpeed: Number(global.speechSpeed || global.speed || 1),
  volume: Number(global.volume ?? 0.9),
  pitch: Number(global.pitch ?? 1.0),
  autoRead: Boolean(global.autoRead),
  subtitleEnabled: global.subtitleEnabled !== false,
  answerStyle: global.defaultAnswerStyle || '标准',
  autoNarration: Boolean(global.navigationSettings?.autoNarration),
  navigationAssistantExpanded: true,
  routeAnimationEnabled: global.navigationSettings?.showRouteAnimation !== false,
  highContrast: Boolean(global.accessibilitySettings?.highContrast),
  largeText: Boolean(global.accessibilitySettings?.largeText),
  seniorMode: Boolean(global.accessibilitySettings?.seniorMode),
  navigationPromptFrequency: global.navigationSettings?.promptFrequency || 'standard',
  quickQuestionPreference: '校园文化',
});

const decodeUserConfig = (raw: DigitalHumanConfig | null, global: DigitalHumanGlobalConfig) => {
  const base = defaultUserFromGlobal(global);
  if (!raw) return base;
  const legacy = { ...base, avatarTheme: raw.avatarUrl || base.avatarTheme, voiceType: raw.voiceType || base.voiceType, speechSpeed: Number(raw.speechSpeed || base.speechSpeed), pitch: base.pitch, answerStyle: (raw.talkStyle as DigitalHumanUserConfig['answerStyle']) || base.answerStyle };
  const legacyPrefix = LEGACY_USER_CONFIG_PREFIXES.find(prefix => raw.welcomeText?.startsWith(prefix));
  const encoded = raw.configJson || (legacyPrefix ? raw.welcomeText.slice(legacyPrefix.length) : '');
  if (!encoded) return legacy;
  try {
    const value = JSON.parse(encoded) as Record<string, unknown>;
    return {
      ...legacy,
      avatarTheme: String(value.a || legacy.avatarTheme), voiceType: String(value.v || legacy.voiceType),
      speechSpeed: Number(value.s ?? legacy.speechSpeed), volume: Number(value.o ?? base.volume),
      pitch: Number(value.p ?? 1.0),
      autoRead: Boolean(value.r), subtitleEnabled: value.t !== false,
      answerStyle: (value.y as DigitalHumanUserConfig['answerStyle']) || legacy.answerStyle,
      autoNarration: Boolean(value.n), navigationAssistantExpanded: value.e !== false,
      routeAnimationEnabled: value.m !== false, highContrast: Boolean(value.h), largeText: Boolean(value.l),
      seniorMode: Boolean(value.d), navigationPromptFrequency: (value.f as DigitalHumanUserConfig['navigationPromptFrequency']) || 'standard',
      quickQuestionPreference: String(value.q || '校园文化'),
    };
  } catch { return legacy; }
};

const encodeUserConfig = (config: DigitalHumanUserConfig) => JSON.stringify({
  a: config.avatarTheme, v: config.voiceType, s: config.speechSpeed, o: config.volume, p: config.pitch, r: config.autoRead,
  t: config.subtitleEnabled, y: config.answerStyle, n: config.autoNarration, e: config.navigationAssistantExpanded,
  m: config.routeAnimationEnabled, h: config.highContrast, l: config.largeText, d: config.seniorMode,
  f: config.navigationPromptFrequency, q: config.quickQuestionPreference,
});

export type NarrationMode = 'concise' | 'detailed' | 'fresh' | 'alumni' | 'parent' | 'research' | 'senior';

export interface PointNarrationState {
  open: boolean;
  loading: boolean;
  spot: CampusSpot | null;
  mode: NarrationMode;
  content: string;
  generatedBy?: 'deepseek' | 'fallback' | 'knowledge';
  sources: ChatSource[];
}

export interface NavigationRuntime {
  routeName: string;
  spots: CampusSpot[];
  currentStationIndex: number;
  totalMinute: number;
  completedStationIds: number[];
  startedAt: number;
  tripId?: string;
}

interface DigitalHumanContextValue {
  state: DigitalHumanState;
  setState: (state: DigitalHumanState) => void;
  globalConfig: DigitalHumanGlobalConfig;
  userConfig: DigitalHumanUserConfig;
  effectiveConfig: DigitalHumanGlobalConfig & DigitalHumanUserConfig;
  updateUserConfig: <K extends keyof DigitalHumanUserConfig>(key: K, value: DigitalHumanUserConfig[K]) => Promise<void>;
  saveUserConfig: (config: DigitalHumanUserConfig) => Promise<void>;
  restoreAdminDefaults: () => Promise<void>;
  refreshConfig: () => Promise<void>;
  speak: (text: string, options?: Pick<SpeechOptions, 'onStart' | 'onEnd' | 'onError'>) => boolean;
  narration: PointNarrationState;
  openNarration: (spot: CampusSpot, mode?: NarrationMode) => Promise<void>;
  openNarrationManual: (spot: CampusSpot, mode?: NarrationMode) => Promise<void>;
  closeNarration: () => void;
  navigation: NavigationRuntime | null;
  startNavigation: (routeName: string, spots: CampusSpot[], totalMinute?: number, tripId?: string) => void;
  setCurrentStation: (index: number) => void;
  arriveAtStation: () => void;
  advanceStation: () => void;
  completeNavigation: () => void;
  pauseNavigation: () => void;
  resumeNavigation: () => void;
  endNavigation: (tripId?: string) => void;
  capabilityEnabled: (key: keyof DigitalHumanGlobalConfig['capabilities']) => boolean;
  autoNarrateOnArrival: (spot: CampusSpot, tripId: string) => Promise<void>;
  autoNarrateAmbient: (spot: CampusSpot, tripId: string) => Promise<void>;
  isStationNarrated: (spotId: number, tripId?: string) => boolean;
}

const DigitalHumanContext = createContext<DigitalHumanContextValue | null>(null);

export function DigitalHumanProvider({ session, children }: { session: UserSession; children: React.ReactNode }) {
  const [state, setState] = useState<DigitalHumanState>('idle');
  const [globalConfig, setGlobalConfig] = useState(DEFAULT_GLOBAL);
  const [userConfig, setUserConfig] = useState(() => defaultUserFromGlobal(DEFAULT_GLOBAL));
  const [narration, setNarration] = useState<PointNarrationState>({ open: false, loading: false, spot: null, mode: 'concise', content: '', sources: [] });
  const [navigation, setNavigation] = useState<NavigationRuntime | null>(() => {
    try { return JSON.parse(sessionStorage.getItem('shanhai_digital_navigation') || 'null'); } catch { return null; }
  });
  const stateBeforeNarrationRef = useRef<DigitalHumanState>('idle');
  const activeNarrationKeyRef = useRef<string | null>(null);
  const narrationCacheRef = useRef<Map<string, NarrationResponse>>(new Map());
  const narrationAbortRef = useRef<AbortController | null>(null);
  const narrationRequestIdRef = useRef(0);

  const refreshConfig = useCallback(async () => {
    const globalResponse = await digitalHumanApi.getGlobalConfig();
    const nextGlobal = { ...DEFAULT_GLOBAL, ...(globalResponse.data.data || {}) };
    nextGlobal.capabilities = { ...DEFAULT_GLOBAL.capabilities, ...(nextGlobal.capabilities || {}) };
    nextGlobal.navigationSettings = { ...DEFAULT_GLOBAL.navigationSettings, ...(nextGlobal.navigationSettings || {}) };
    nextGlobal.accessibilitySettings = { ...DEFAULT_GLOBAL.accessibilitySettings, ...(nextGlobal.accessibilitySettings || {}) };
    nextGlobal.fallbackMessages = { ...DEFAULT_GLOBAL.fallbackMessages, ...(nextGlobal.fallbackMessages || {}) };
    setGlobalConfig(nextGlobal);
    if (session.userMode === 'guest') {
      setUserConfig(defaultUserFromGlobal(nextGlobal));
      return;
    }
    const userResponse = await digitalHumanApi.getConfig(session.sessionId);
    setUserConfig(decodeUserConfig(userResponse.data.data || null, nextGlobal));
  }, [session.sessionId, session.userMode]);

  useEffect(() => { void refreshConfig().catch(() => setState('error')); }, [refreshConfig]);
  useEffect(() => () => speechService.cancel(), []);
  useEffect(() => { if (navigation) setState('navigating'); }, []);
  useEffect(() => {
    if (navigation) sessionStorage.setItem('shanhai_digital_navigation', JSON.stringify(navigation));
    else sessionStorage.removeItem('shanhai_digital_navigation');
  }, [navigation]);

  const persistUserConfig = useCallback(async (next: DigitalHumanUserConfig) => {
    setUserConfig(next);
    if (session.userMode === 'guest') return;
    const response = await digitalHumanApi.updateConfig(session.sessionId, {
      avatarUrl: next.avatarTheme, voiceType: next.voiceType, speechSpeed: next.speechSpeed,
      talkStyle: next.answerStyle, configJson: encodeUserConfig(next),
    });
    void response.data.data;
    await refreshConfig();
  }, [refreshConfig, session.sessionId, session.userMode]);

  const updateUserConfig = useCallback(async <K extends keyof DigitalHumanUserConfig>(key: K, value: DigitalHumanUserConfig[K]) => {
    if (!globalConfig.capabilities.userPersonalization || !globalConfig.userAdjustableFields.includes(key)) return;
    await persistUserConfig({ ...userConfig, [key]: value });
  }, [globalConfig, persistUserConfig, userConfig]);

  const restoreAdminDefaults = useCallback(async () => persistUserConfig(defaultUserFromGlobal(globalConfig)), [globalConfig, persistUserConfig]);

  const effectiveConfig = useMemo(() => {
    const allowed = new Set(globalConfig.userAdjustableFields || []);
    const overrides = globalConfig.capabilities.userPersonalization
      ? Object.fromEntries(Object.entries(userConfig).filter(([key]) => allowed.has(key)))
      : {};
    const merged = { ...globalConfig, ...overrides } as DigitalHumanGlobalConfig & DigitalHumanUserConfig;
    if (!globalConfig.capabilities.voiceRead) merged.autoRead = false;
    if (!globalConfig.capabilities.autoArrivalNarration || !globalConfig.capabilities.pointNarration) merged.autoNarration = false;
    if (!globalConfig.capabilities.subtitles) merged.subtitleEnabled = false;
    if (!globalConfig.capabilities.highContrast) merged.highContrast = false;
    if (!globalConfig.capabilities.largeText) merged.largeText = false;
    if (!globalConfig.capabilities.seniorMode) merged.seniorMode = false;
    if (!globalConfig.capabilities.routeAnimation || globalConfig.navigationSettings?.showRouteAnimation === false) merged.routeAnimationEnabled = false;
    if (merged.seniorMode) {
      merged.speechSpeed = Math.min(Number(merged.speechSpeed || 1), 0.82);
      merged.navigationPromptFrequency = merged.navigationPromptFrequency === 'low' ? 'standard' : merged.navigationPromptFrequency;
    }
    return merged;
  }, [globalConfig, userConfig]);

  const speak = useCallback((text: string, options?: Pick<SpeechOptions, 'onStart' | 'onEnd' | 'onError'>) => {
    if (!globalConfig.capabilities.voiceRead) return false;
    return speechService.speak(text, {
      lang: 'zh-CN',
      voiceType: effectiveConfig.voiceType,
      rate: effectiveConfig.speechSpeed,
      volume: effectiveConfig.volume,
      pitch: effectiveConfig.pitch,
      seniorMode: effectiveConfig.seniorMode,
      ...options,
    });
  }, [effectiveConfig, globalConfig.capabilities.voiceRead]);

  const openNarrationInternal = useCallback(async (
    spot: CampusSpot,
    mode: NarrationMode = 'concise',
    trigger: 'automatic' | 'manual',
    tripId?: string,
  ) => {
    if (!globalConfig.capabilities.pointNarration) return;
    const narrationKey = trigger === 'automatic' && tripId
      ? `${tripId}:${getNarrationSpotKey(spot)}`
      : `manual:${Date.now()}`;

    // Guard: if the same automatic narration is already the active one, skip.
    if (trigger === 'automatic' && activeNarrationKeyRef.current === narrationKey) return;

    activeNarrationKeyRef.current = narrationKey;
    // Cancel any in-flight narration request
    if (narrationAbortRef.current) narrationAbortRef.current.abort();
    const requestId = ++narrationRequestIdRef.current;
    stateBeforeNarrationRef.current = state;
    setState('explaining');

    // Map frontend mode to backend mode
    const backendMode = mode === 'fresh' ? 'freshman' : mode === 'research' ? 'detailed' : mode === 'senior' ? 'concise' : mode;
    const durationSec = mode === 'concise' ? 30 : mode === 'detailed' ? 75 : 35;

    // Check cache: key = spotId + mode + durationSeconds (material version checked server-side)
    const cacheKey = `${spot.id}:${backendMode}:${durationSec}`;
    const cached = narrationCacheRef.current.get(cacheKey);
    if (cached && trigger === 'manual') {
      setNarration({ open: true, loading: false, spot, mode, content: cached.content, generatedBy: cached.generatedBy as 'deepseek' | 'fallback' | 'knowledge', sources: cached.sources || [] });
      return;
    }

    setNarration({ open: true, loading: true, spot, mode, content: '', sources: [] });

    if (trigger === 'automatic' && tripId) {
      narrationDedup.markPopupShown(tripId, spot);
    }

    try {
      if (session.userMode === 'guest' || !globalConfig.capabilities.knowledgeNarration) throw new Error('local');
      const response = await narrationApi.generate(spot.id, backendMode, durationSec);
      const data = response.data.data;
      // Only update if this is still the newest triggered narration
      if (activeNarrationKeyRef.current !== narrationKey || requestId !== narrationRequestIdRef.current) return;
      // Cache result (cap at 50 entries)
      if (narrationCacheRef.current.size >= 50) {
        const firstKey = narrationCacheRef.current.keys().next().value;
        if (firstKey) narrationCacheRef.current.delete(firstKey);
      }
      narrationCacheRef.current.set(cacheKey, data);
      setNarration({ open: true, loading: false, spot, mode, content: data.content, generatedBy: data.generatedBy as 'deepseek' | 'fallback' | 'knowledge', sources: data.sources || [] });
      if (trigger === 'automatic' && tripId && globalConfig.capabilities.voiceRead) {
        const spotKey = getNarrationSpotKey(spot);
        const dedupeKey = `ambient:${tripId}:${spotKey}`;
        narrationDedup.markSpeechStarted(tripId, spot);
        speechService.speak(data.content, {
          category: 'ambient_narration',
          priority: 50,
          dedupeKey,
          voiceType: effectiveConfig.voiceType,
          rate: effectiveConfig.speechSpeed,
          volume: effectiveConfig.volume,
          pitch: effectiveConfig.pitch,
          seniorMode: effectiveConfig.seniorMode,
        });
      } else if (effectiveConfig.autoRead) {
        speak(data.content);
      }
    } catch {
      if (activeNarrationKeyRef.current !== narrationKey || requestId !== narrationRequestIdRef.current) return;
      // Mode-specific fallback — concise but without default "activity tips"
      const safeOpenTime = spot.openTime?.trim() || '以学校实际安排为准';
      const desc = spot.spotDesc;
      const fallbackContents: Record<string, string> = {
        concise: desc ? `${spot.spotName}，${desc} 开放时间：${safeOpenTime}。` : `${spot.spotName}是山海大学校园场所。当前资料记录的开放时间为${safeOpenTime}，临时调整请以学校通知为准。`,
        detailed: desc
          ? `${spot.spotName}，${desc}\n\n开放时间：${safeOpenTime}，临时调整请以学校通知为准。\n\n当前资料尚未收录更详细的功能说明和活动安排信息。`
          : `${spot.spotName}是山海大学校园场所。\n\n当前资料主要记录了开放时间，尚未收录更详细的功能、预约和服务信息。\n\n开放时间：${safeOpenTime}。`,
        freshman: desc
          ? `${spot.spotName}，${desc}\n\n开放时间：${safeOpenTime}。\n\n新生同学可以留意基本信息和开放安排，具体使用规则请以学校通知为准。`
          : `${spot.spotName}是校园场所。\n\n开放时间：${safeOpenTime}。\n\n当前资料尚未收录新生专属指引。`,
        alumni: desc
          ? `${spot.spotName}，${desc}\n\n开放时间：${safeOpenTime}。\n\n回校时可以留意学校发布的相关信息，具体安排以学校实际通知为准。`
          : `${spot.spotName}是校内场所。\n\n开放时间：${safeOpenTime}。\n\n当前资料未收录校友相关信息。`,
        parent: desc
          ? `${spot.spotName}，${desc}\n\n开放时间：${safeOpenTime}。\n\n来校参观时，请以学校发布的信息为准。`
          : `${spot.spotName}是校内场所。\n\n开放时间：${safeOpenTime}。\n\n当前资料未收录家长专属指引。`,
      };
      const content = fallbackContents[backendMode] || fallbackContents.concise;
      const fallbackSources = [{ sourceType: 'spot' as const, sourceId: spot.id, title: `${spot.spotName}点位资料`, sourceName: '山海大学校园点位库', snippet: spot.spotDesc }];
      setNarration({ open: true, loading: false, spot, mode, content, generatedBy: 'fallback', sources: fallbackSources });
      if (trigger === 'automatic' && tripId && globalConfig.capabilities.voiceRead) {
        const spotKey = getNarrationSpotKey(spot);
        const dedupeKey = `ambient:${tripId}:${spotKey}`;
        narrationDedup.markSpeechStarted(tripId, spot);
        speechService.speak(content, {
          category: 'ambient_narration',
          priority: 50,
          dedupeKey,
          voiceType: effectiveConfig.voiceType,
          rate: effectiveConfig.speechSpeed,
          volume: effectiveConfig.volume,
          pitch: effectiveConfig.pitch,
          seniorMode: effectiveConfig.seniorMode,
        });
      } else if (effectiveConfig.autoRead) {
        speak(content);
      }
    } finally {
      if (trigger === 'automatic' && tripId) {
        narrationDedup.clearInFlight(tripId, spot);
      }
    }
  }, [effectiveConfig, globalConfig.capabilities, session.sessionId, session.userMode, speak, state]);

  /** Public: manual narration — always allowed, no dedup. */
  const openNarrationManual = useCallback(async (spot: CampusSpot, mode: NarrationMode = 'concise') => {
    await openNarrationInternal(spot, mode, 'manual');
  }, [openNarrationInternal]);

  /** Automatic: nearby ambient narration — trip-level dedup enforced. */
  const autoNarrateAmbient = useCallback(async (spot: CampusSpot, tripId: string) => {
    if (!globalConfig.capabilities.pointNarration) return;
    if (!effectiveConfig.autoNarration) return;
    const result = narrationDedup.tryMarkAutomaticNarration(tripId, spot, 'nearby');
    if (!result.allowed) return;
    await openNarrationInternal(spot, effectiveConfig.seniorMode ? 'senior' : 'concise', 'automatic', tripId);
  }, [effectiveConfig, globalConfig.capabilities.pointNarration, openNarrationInternal]);

  const closeNarration = useCallback(() => { setNarration(value => ({ ...value, open: false })); setState(stateBeforeNarrationRef.current); }, []);

  const startNavigation = useCallback((routeName: string, spots: CampusSpot[], totalMinute = 0, tripId?: string) => {
    if (tripId) narrationDedup.initTrip(tripId);
    setNavigation({ routeName, spots, currentStationIndex: 0, totalMinute, completedStationIds: [], startedAt: Date.now(), tripId });
    setState('navigating');
  }, []);

  const setCurrentStation = useCallback((index: number) => setNavigation(value => value ? { ...value, currentStationIndex: Math.max(0, Math.min(index, value.spots.length - 1)) } : value), []);
  const arriveAtStation = useCallback(() => setState('arrived'), []);
  const advanceStation = useCallback(() => setNavigation(value => {
    if (!value) return value;
    const current = value.spots[value.currentStationIndex];
    if (value.currentStationIndex >= value.spots.length - 1) return value;
    const next = value.currentStationIndex + 1;
    setState('navigating');
    return { ...value, currentStationIndex: next, completedStationIds: current ? [...new Set([...value.completedStationIds, current.id])] : value.completedStationIds };
  }), []);
  const completeNavigation = useCallback(() => setState('completed'), []);
  const pauseNavigation = useCallback(() => setState('paused'), []);
  const resumeNavigation = useCallback(() => setState('navigating'), []);

  const endNavigation = useCallback((tripId?: string) => {
    if (tripId && activeNarrationKeyRef.current?.startsWith(`${tripId}:`)) {
      activeNarrationKeyRef.current = null;
      setNarration(value => value.open ? { ...value, open: false, loading: false } : value);
    }
    setNavigation(null);
    setState('idle');
    // clearTrip is handled by MapPage (the owner of tripId) — not duplicated here.
  }, []);

  const capabilityEnabled = useCallback((key: keyof DigitalHumanGlobalConfig['capabilities']) => Boolean(globalConfig.capabilities[key]), [globalConfig.capabilities]);

  const isStationNarrated = useCallback((spotId: number, tripId?: string) => {
    if (!tripId) return false;
    return narrationDedup.isNarrated(tripId, { id: spotId });
  }, []);

  const autoNarrateOnArrival = useCallback(async (spot: CampusSpot, tripId: string) => {
    if (!globalConfig.capabilities.autoArrivalNarration) return;
    if (!effectiveConfig.autoNarration) return;
    // If this spot was already narrated (nearby or previous arrival), only speak a short arrival notice
    const alreadyNarrated = narrationDedup.isNarrated(tripId, spot);
    if (alreadyNarrated) {
      // Only speak short arrival announcement, no popup, no API call
      const spotKey = getNarrationSpotKey(spot);
      const arrivalText = effectiveConfig.seniorMode
        ? `到达${spot.spotName}`
        : `已到达${spot.spotName}`;
      if (globalConfig.capabilities.voiceRead) speechService.speak(arrivalText, {
        category: 'arrival',
        priority: 80,
        dedupeKey: `arrival:${tripId}:${spotKey}`,
        voiceType: effectiveConfig.voiceType,
        rate: effectiveConfig.speechSpeed,
        volume: effectiveConfig.volume,
        pitch: effectiveConfig.pitch,
        seniorMode: effectiveConfig.seniorMode,
      });
      return;
    }
    // First time — full narration
    const result = narrationDedup.tryMarkAutomaticNarration(tripId, spot, 'arrival');
    if (!result.allowed) return;
    await openNarrationInternal(spot, 'concise', 'automatic', tripId);
  }, [effectiveConfig, globalConfig.capabilities, openNarrationInternal]);

  const value = useMemo<DigitalHumanContextValue>(() => ({
    state, setState, globalConfig, userConfig, effectiveConfig, updateUserConfig, saveUserConfig: persistUserConfig, restoreAdminDefaults, refreshConfig,
    speak, narration, openNarration: openNarrationManual, openNarrationManual, closeNarration, navigation, startNavigation, setCurrentStation, arriveAtStation,
    advanceStation, completeNavigation, pauseNavigation, resumeNavigation, endNavigation, capabilityEnabled,
    autoNarrateOnArrival, autoNarrateAmbient, isStationNarrated,
  }), [state, globalConfig, userConfig, effectiveConfig, updateUserConfig, persistUserConfig, restoreAdminDefaults, refreshConfig, speak, narration, openNarrationManual, closeNarration, navigation, startNavigation, setCurrentStation, arriveAtStation, advanceStation, completeNavigation, pauseNavigation, resumeNavigation, endNavigation, capabilityEnabled, autoNarrateOnArrival, autoNarrateAmbient, isStationNarrated]);

  return <DigitalHumanContext.Provider value={value}>{children}</DigitalHumanContext.Provider>;
}

export function useDigitalHuman() {
  const value = useContext(DigitalHumanContext);
  if (!value) throw new Error('useDigitalHuman must be used inside DigitalHumanProvider');
  return value;
}
