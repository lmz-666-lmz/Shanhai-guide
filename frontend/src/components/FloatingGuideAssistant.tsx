import { useEffect, useMemo, useRef, useState } from 'react';
import XiaohaiAvatar, { type AvatarStatus } from './XiaohaiAvatar';
import { useDigitalHuman } from '../contexts/DigitalHumanContext';
import type { CampusSpot } from '../types';
import type { MapScene } from '../utils/tripNavigation';

interface FloatingGuideAssistantProps {
  scene?: MapScene;
  currentSpot?: CampusSpot | null;
  bottomOffset?: number;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  onNextStation?: () => void;
  onSkipStation?: () => void;
  onReplan?: () => void;
  onAsk?: () => void;
  onViewRoute?: () => void;
  onComplete?: () => void;
  onMore?: () => void;
  onPauseChange?: (paused: boolean) => void;
  onEnd?: () => void;
}

type AssistantPosition = { side: 'left' | 'right'; y: number };
const POSITION_KEY = 'shanhai_map_assistant_position';
const readPosition = (): AssistantPosition => {
  try { return { side: 'right', y: 150, ...JSON.parse(localStorage.getItem(POSITION_KEY) || '{}') }; }
  catch { return { side: 'right', y: 150 }; }
};

const statusLabels = {
  idle: '随时陪伴', listening: '正在聆听', thinking: '正在思考', answering: '正在回答', explaining: '正在讲解',
  planning: '准备路线', navigating: '陪伴导航', arrived: '已经到站', completed: '路线完成', paused: '导航暂停', error: '暂时离线',
};

export default function FloatingGuideAssistant({
  scene = 'browse', currentSpot = null,
  bottomOffset = 108, expanded, onExpandedChange, onNextStation, onSkipStation,
  onReplan, onAsk, onViewRoute, onComplete, onMore, onPauseChange, onEnd,
}: FloatingGuideAssistantProps) {
  const { state, navigation, effectiveConfig, speak, openNarration, pauseNavigation, resumeNavigation, completeNavigation, endNavigation, capabilityEnabled } = useDigitalHuman();
  const [localExpanded, setLocalExpanded] = useState(effectiveConfig.navigationAssistantExpanded);
  const [position, setPosition] = useState<AssistantPosition>(readPosition);
  const [screenHeight, setScreenHeight] = useState(() => typeof window !== 'undefined' ? window.innerHeight : 800);
  const [screenWidth, setScreenWidth] = useState(() => typeof window !== 'undefined' ? window.innerWidth : 400);
  const draggingRef = useRef(false);
  const suppressClickRef = useRef(false);
  const isExpanded = expanded ?? localExpanded;
  const currentIndex = navigation?.currentStationIndex || 0;
  const current = navigation?.spots[currentIndex];
  const next = navigation?.spots[currentIndex + 1];
  const narrationSpot = scene === 'spot_selected' ? currentSpot : current;
  const isNavigatingScene = scene === 'navigating';
  const isArrivedScene = scene === 'arrived';
  const avatarStatus: AvatarStatus = state === 'arrived' || state === 'completed' ? 'arrived' : state === 'navigating' || state === 'paused' ? 'navigating' : state === 'thinking' || state === 'planning' ? 'thinking' : state === 'listening' ? 'listening' : 'idle';
  const nextStep = useMemo(() => {
    if (scene === 'spot_selected' && currentSpot) return `已选中${currentSpot.spotName}`;
    if (scene === 'route_preview') return '路线已准备好';
    if (scene === 'arrived' && current) return `已到达${current.spotName}`;
    if (scene === 'navigating') return next ? `下一步前往${next.spotName}` : current ? `当前位于${current.spotName}` : '导航进行中';
    if (scene === 'completed') return '行程已完成';
    return effectiveConfig.introduction;
  }, [current, currentSpot, effectiveConfig.introduction, next, scene]);

  useEffect(() => {
    if (expanded === undefined) setLocalExpanded(effectiveConfig.navigationAssistantExpanded);
  }, [effectiveConfig.navigationAssistantExpanded, expanded]);

  // ResizeObserver to track screen dimensions
  useEffect(() => {
    const updateSize = () => {
      setScreenHeight(window.innerHeight);
      setScreenWidth(window.innerWidth);
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const setOpen = (value: boolean) => { setLocalExpanded(value); onExpandedChange?.(value); };
  // Top: avoid search/status bar area (88px). Bottom: avoid bottom nav + overlays via bottomOffset.
  const topSafety = 88;
  const bottomSafety = Math.max(bottomOffset, 108);
  const clampY = (value: number) => Math.max(topSafety, Math.min(value, screenHeight - bottomSafety - 64));

  const finishDrag = (clientX: number, clientY: number) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const nextPosition: AssistantPosition = { side: clientX < screenWidth / 2 ? 'left' : 'right', y: clampY(clientY - 28) };
    setPosition(nextPosition); localStorage.setItem(POSITION_KEY, JSON.stringify(nextPosition));
  };

  useEffect(() => {
    const move = (event: PointerEvent) => { if (draggingRef.current) { suppressClickRef.current = true; setPosition(value => ({ ...value, y: clampY(event.clientY - 28) })); } };
    const up = (event: PointerEvent) => finishDrag(event.clientX, event.clientY);
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, [bottomOffset, screenHeight, screenWidth]);

  // Re-clamp position when screen size or bottomOffset changes
  useEffect(() => {
    setPosition(prev => ({ ...prev, y: clampY(prev.y) }));
  }, [bottomOffset, screenHeight]);

  if (!capabilityEnabled('mapCompanion')) return null;
  const sideStyle = position.side === 'left' ? { left: 12 } : { right: 12 };
  // Expanded panel height limit to avoid pushing off-screen
  const maxExpandedHeight = Math.min(screenHeight * 0.45, screenHeight - topSafety - bottomSafety - 32);

  return (
    <div className="fixed z-[900] pointer-events-none select-none" style={{ ...sideStyle, top: clampY(position.y), maxWidth: `calc(100vw - 24px)` }}>
      {isExpanded ? (
        <section
          className="pointer-events-auto rounded-3xl border border-blue-100 bg-white/95 p-4 shadow-[0_16px_48px_rgba(15,23,42,.16)] backdrop-blur-xl overflow-y-auto"
          style={{ width: `min(286px, calc(100vw - 24px))`, maxHeight: `${maxExpandedHeight}px` }}
        >
          <div className="flex items-center gap-3"><XiaohaiAvatar size={38} status={avatarStatus} /><div className="min-w-0 flex-1"><p className="text-[10px] font-bold text-primary-blue">{statusLabels[state]}</p><p className="truncate text-sm font-extrabold text-slate-800">{nextStep}</p></div><button onClick={() => setOpen(false)} className="min-h-9 rounded-full bg-slate-100 px-3 text-[11px] font-bold text-slate-500">收起</button></div>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold">
            {narrationSpot && capabilityEnabled('pointNarration') ? <button onClick={() => void openNarration(narrationSpot)} className="min-h-10 rounded-xl bg-blue-50 px-3 text-primary-blue">{isArrivedScene ? '开始讲解' : `讲解${narrationSpot.spotName}`}</button> : null}
            {isNavigatingScene ? <button onClick={() => speak(nextStep)} className="min-h-10 rounded-xl bg-blue-50 px-3 text-primary-blue">朗读下一步</button> : null}
            {isNavigatingScene && (state === 'paused'
              ? <button onClick={() => { resumeNavigation(); onPauseChange?.(false); }} className="min-h-10 rounded-xl bg-emerald-50 px-3 text-emerald-700">继续</button>
              : <button onClick={() => { pauseNavigation(); onPauseChange?.(true); }} className="min-h-10 rounded-xl bg-slate-100 px-3 text-slate-600">暂停</button>)}
            {isNavigatingScene ? <button onClick={onViewRoute || onReplan} className="min-h-10 rounded-xl bg-slate-100 px-3 text-slate-600">查看全程</button> : null}
            {isArrivedScene && next ? <button onClick={onNextStation} className="min-h-10 rounded-xl bg-primary-blue px-3 text-white">继续下一站</button> : null}
            {isArrivedScene ? <button onClick={() => setOpen(false)} className="min-h-10 rounded-xl bg-slate-100 px-3 text-slate-600">暂时停留</button> : null}
            <button onClick={onAsk} className="min-h-10 rounded-xl bg-slate-100 px-3 text-slate-600">问小海</button>
            {isNavigatingScene ? <button onClick={onMore} className="min-h-10 rounded-xl bg-slate-100 px-3 text-slate-600">更多</button> : null}
            {isNavigatingScene ? <button onClick={onSkipStation} className="min-h-10 rounded-xl bg-slate-100 px-3 text-slate-600">跳过本站</button> : null}
            {isArrivedScene && !next ? <button onClick={() => { onComplete?.(); completeNavigation(); }} className="min-h-10 rounded-xl bg-emerald-600 px-3 text-white">完成行程</button> : null}
            {isNavigatingScene ? <button onClick={() => { onEnd?.(); endNavigation(); }} className="min-h-10 rounded-xl bg-red-50 px-3 text-red-600">退出导航</button> : null}
          </div>
        </section>
      ) : (
        <button
          onPointerDown={(event) => { draggingRef.current = true; event.currentTarget.setPointerCapture?.(event.pointerId); }}
          onClick={() => { if (suppressClickRef.current) { suppressClickRef.current = false; return; } setOpen(true); }}
          className="pointer-events-auto flex min-h-14 items-center gap-2 rounded-full border border-blue-100 bg-white/95 p-1.5 pr-3 shadow-xl touch-none"
          aria-label="展开小海地图助手"
        >
          <XiaohaiAvatar size={42} status={avatarStatus} /><span className="text-[10px] font-bold text-primary-blue">{statusLabels[state]}</span>
        </button>
      )}
    </div>
  );
}
