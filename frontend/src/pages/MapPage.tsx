import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Modal } from 'antd-mobile';
import type { UserSession, CampusSpot, CampusRoute } from '../types';
import { spotApi, routeApi, favoriteApi, checkinApi } from '../api';
import { requireAuth } from '../utils/auth';
import { resolveImageUrl, DefaultSpotCover } from '../utils/image';
import { loadAmapSdk } from '../utils/amapLoader';
import FloatingGuideAssistant from '../components/FloatingGuideAssistant';
import XiaohaiAvatar from '../components/XiaohaiAvatar';
import CampusRouteLayer from '../components/map/CampusRouteLayer';
import { useDigitalHuman } from '../contexts/DigitalHumanContext';
import { speechService, SPEECH_PRIORITY, type SpeechCategory } from '../utils/speechService';
import {
  calculatePathDistanceMeters,
  generateFallbackPolyline,
  planCampusRoute,
  type LngLatPoint,
  type RouteEndpoint,
} from '../utils/campusRoutePlanner';
import { useToast } from '../contexts/ToastContext';
import { narrationDedup, getNarrationSpotKey } from '../utils/narrationDedup';
import {
  canCompleteTrip,
  deriveTripStartIndexes,
  nextArrivalConsecutiveCount,
  ARRIVAL_DISTANCE_METERS,
  type DisplayMode,
  type LegPlanner,
  type LegPlanningResult,
  type LegPathProgress,
  type LocationMode,
  type LocationStatus,
  type MapScene,
  type OverlayState,
  type TripPhase,
  projectPositionToPath,
  splitPathAtDistance,
} from '../utils/tripNavigation';

declare const AMap: any;

interface MapPageProps {
  session: UserSession;
  onBack: () => void;
  initialType?: string;
  routeId?: number;
  initialSpotId?: number;
  initialNavigationMode?: boolean;
  onNavigate?: (params: { page: string; routeId?: number; spotId?: number; spotType?: string; initialMessage?: string; navigationMode?: boolean }) => void;
}

const spotTypeColors: Record<string, string> = {
  '教学场馆': '#4a7c9b',
  '宿舍生活区': '#5da668',
  '餐饮美食': '#d49065',
  '便民服务': '#9b7bc0',
  '运动场地': '#c47575',
  '绿化景观': '#5ca9a0',
};

const SHANHAI_UNIVERSITY = {
  lng: 119.5590,
  lat: 39.9326,
};

const LOCATION_MODE_KEY = 'locationMode';
const DEMO_START_KEY = 'demoStart';
const DEMO_POSITION_KEY = 'shanhai_demo_position';
const CURRENT_POSITION_KEY = 'shanhai_current_position';
const MANUAL_START_KEY = 'shanhai_manual_start';
const LOCATION_UPDATED_AT_KEY = 'shanhai_location_updated_at';
const LEGACY_LOCATION_MODE_KEY = 'shanhai_location_mode';
const LEGACY_DEMO_START_KEY = 'shanhai_demo_start';
const OFF_ROUTE_THRESHOLD_METERS = 35;

/** Campus-reasonable coordinate bounds */
const VALID_LNG_MIN = 119.54;
const VALID_LNG_MAX = 119.58;
const VALID_LAT_MIN = 39.92;
const VALID_LAT_MAX = 39.945;

const isValidLngLat = (lng: number, lat: number): boolean =>
  Number.isFinite(lng) && Number.isFinite(lat)
  && lng > 118 && lng < 121
  && lat > 38 && lat < 41;

// @ts-ignore - reserved for future tighter campus bounds validation
const _isStrictCampusCoord = (lng: number, lat: number): boolean =>
  Number.isFinite(lng) && Number.isFinite(lat)
  && lng > VALID_LNG_MIN && lng < VALID_LNG_MAX
  && lat > VALID_LAT_MIN && lat < VALID_LAT_MAX;

const filterValidCoords = (points: Array<[number, number]>): Array<[number, number]> =>
  points.filter(p => isValidLngLat(p[0], p[1]));

/** Get camera targets based on current scene. Returns null when no valid frame exists. */
const getCameraTargets = (
  scene: MapScene,
  options: {
    filteredSpots: CampusSpot[];
    currentLegPath: LngLatPoint[];
    routePath: LngLatPoint[];
    routeSpots: CampusSpot[];
    selectedSpot: CampusSpot | null;
    currentPosition: LngLatPoint | null;
    demoPosition: LngLatPoint | null;
    locationMode: LocationMode;
    completedFootprintPath: LngLatPoint[];
  },
): Array<[number, number]> | null => {
  const { filteredSpots, currentLegPath, routePath, routeSpots, selectedSpot, currentPosition, demoPosition, locationMode, completedFootprintPath } = options;

  switch (scene) {
    case 'browse':
      if (filteredSpots.length === 0) return null;
      return filterValidCoords(filteredSpots.map(s => [Number(s.longitude), Number(s.latitude)] as [number, number]));

    case 'spot_selected': {
      if (!selectedSpot) return null;
      const pos = getSpotLngLat(selectedSpot);
      if (!isValidLngLat(pos.lng, pos.lat)) return null;
      return [[pos.lng, pos.lat]];
    }

    case 'route_preview': {
      const pathPts = routePath.length >= 2 ? routePath : [];
      const fallback = pathPts.length >= 2 ? pathPts : routeSpots.map(s => [Number(s.longitude), Number(s.latitude)] as [number, number]);
      return filterValidCoords(fallback);
    }

    case 'navigating': {
      const position = locationMode === 'demo' ? demoPosition : currentPosition;
      const leg = currentLegPath.length >= 2 ? currentLegPath : [];
      const pts: Array<[number, number]> = [];
      if (position && isValidLngLat(position[0], position[1])) pts.push([position[0], position[1]]);
      if (leg.length >= 2) {
        const mid = leg[Math.floor(leg.length / 2)];
        if (isValidLngLat(mid[0], mid[1])) pts.push([mid[0], mid[1]]);
        pts.push([leg[leg.length - 1][0], leg[leg.length - 1][1]]);
      }
      return pts.length >= 2 ? pts : (position && isValidLngLat(position[0], position[1]) ? [[position[0], position[1]]] : null);
    }

    case 'arrived': {
      const pos = locationMode === 'demo' ? demoPosition : currentPosition;
      const pts: Array<[number, number]> = [];
      if (pos && isValidLngLat(pos[0], pos[1])) pts.push([pos[0], pos[1]]);
      if (selectedSpot) {
        const s = getSpotLngLat(selectedSpot);
        if (isValidLngLat(s.lng, s.lat)) pts.push([s.lng, s.lat]);
      }
      return filterValidCoords(pts);
    }

    case 'completed':
      if (completedFootprintPath.length >= 2) return filterValidCoords(completedFootprintPath);
      return null;

    default:
      return null;
  }
};

const getErrorMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

const getSpotLngLat = (spot: CampusSpot) => ({
  lng: typeof spot.longitude === 'number' ? spot.longitude : parseFloat(spot.longitude || `${SHANHAI_UNIVERSITY.lng}`),
  lat: typeof spot.latitude === 'number' ? spot.latitude : parseFloat(spot.latitude || `${SHANHAI_UNIVERSITY.lat}`),
});

const modeLabel = (userMode: string) => ({
  guest: '访客模式',
  fresh: '新生模式',
  alumni: '校友模式',
  parent: '家长模式',
  research: '研学模式',
  senior: '长者模式',
} as Record<string, string>)[userMode] || '访客模式';

const pulseFitRoute = (setFitRoute: (value: boolean) => void, frameRef: { current: number }) => {
  setFitRoute(true);
  if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
  frameRef.current = window.requestAnimationFrame(() => {
    setFitRoute(false);
    frameRef.current = 0;
  });
};

const toRouteEndpoint = (spot: CampusSpot): RouteEndpoint => ({
  name: spot.spotName,
  longitude: Number(spot.longitude),
  latitude: Number(spot.latitude),
});

const routeLabelMap: Record<LegPlanner, string> = {
  'amap-walking': '道路导航',
  'campus-network': '校园路网导航',
  'direction-guide': '方向指引',
};

const findSouthGateSpot = (spotList: CampusSpot[]) =>
  spotList.find(spot => spot.spotName.includes('南门'))
  || spotList.find(spot => spot.spotName.includes('门') || spot.spotType.includes('便民'))
  || spotList[0]
  || null;

const pathMetrics = (path: LngLatPoint[]) => {
  const distances = [0];
  for (let index = 1; index < path.length; index += 1) {
    distances.push(distances[index - 1] + calculatePathDistanceMeters([path[index - 1], path[index]]));
  }
  return { distances, total: distances[distances.length - 1] || 0 };
};

const pointAtPathDistance = (path: LngLatPoint[], distance: number): LngLatPoint => {
  if (path.length < 2) return path[0] || [SHANHAI_UNIVERSITY.lng, SHANHAI_UNIVERSITY.lat];
  const { distances, total } = pathMetrics(path);
  const clamped = Math.max(0, Math.min(distance, total));
  let segmentIndex = 1;
  while (segmentIndex < distances.length - 1 && distances[segmentIndex] < clamped) segmentIndex += 1;
  const start = path[segmentIndex - 1];
  const end = path[segmentIndex];
  const span = Math.max(1, distances[segmentIndex] - distances[segmentIndex - 1]);
  const ratio = (clamped - distances[segmentIndex - 1]) / span;
  return [start[0] + (end[0] - start[0]) * ratio, start[1] + (end[1] - start[1]) * ratio];
};

const offsetFromPath = (path: LngLatPoint[], distance: number, meters: number): LngLatPoint => {
  const base = pointAtPathDistance(path, distance);
  if (path.length < 2 || meters === 0) return base;
  const next = pointAtPathDistance(path, distance + 8);
  const dx = next[0] - base[0];
  const dy = next[1] - base[1];
  const length = Math.sqrt(dx * dx + dy * dy) || 1;
  const degreePerMeter = 1 / 111320;
  return [base[0] + (-dy / length) * meters * degreePerMeter, base[1] + (dx / length) * meters * degreePerMeter];
};

const clearPersistedLocationMode = () => {
  [LOCATION_MODE_KEY, DEMO_START_KEY, DEMO_POSITION_KEY, CURRENT_POSITION_KEY, MANUAL_START_KEY, LOCATION_UPDATED_AT_KEY, LEGACY_LOCATION_MODE_KEY, LEGACY_DEMO_START_KEY].forEach(key => sessionStorage.removeItem(key));
};

const persistDemoStart = (position: LngLatPoint) => {
  sessionStorage.setItem(LOCATION_MODE_KEY, 'demo');
  sessionStorage.setItem(DEMO_START_KEY, JSON.stringify(position));
  sessionStorage.setItem(DEMO_POSITION_KEY, JSON.stringify(position));
  sessionStorage.setItem(LOCATION_UPDATED_AT_KEY, String(Date.now()));
  sessionStorage.setItem(LEGACY_LOCATION_MODE_KEY, 'demo');
  sessionStorage.setItem(LEGACY_DEMO_START_KEY, JSON.stringify(position));
};

const readPersistedDemoStart = (): LngLatPoint | null => {
  const mode = sessionStorage.getItem(LOCATION_MODE_KEY) || sessionStorage.getItem(LEGACY_LOCATION_MODE_KEY);
  if (mode !== 'demo') return null;
  const raw = sessionStorage.getItem(DEMO_START_KEY) || sessionStorage.getItem(LEGACY_DEMO_START_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length === 2) {
      const position: LngLatPoint = [Number(parsed[0]), Number(parsed[1])];
      return isValidLngLat(position[0], position[1]) ? position : null;
    }
  } catch { /* ignore invalid persisted point */ }
  return null;
};

const sanitizeInstruction = (value?: string) => (value || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

const formatWalkingInstruction = (
  step: import('../utils/tripNavigation').NavigationStepInstruction | undefined,
  seniorMode: boolean,
) => {
  if (!step || (!step.instruction && !step.action && !step.orientation && !step.road && !step.distance && (!step.path || step.path.length === 0))) {
    return '';
  }
  const instruction = sanitizeInstruction(step.instruction);
  if (instruction) return seniorMode ? instruction.replace(/然后|之后/g, '') : instruction;
  const parts = [
    sanitizeInstruction(step.action),
    sanitizeInstruction(step.orientation),
    sanitizeInstruction(step.road) ? `沿${sanitizeInstruction(step.road)}` : '',
    Number(step.distance) > 0 ? `${Math.round(Number(step.distance))}米` : '',
  ].filter(Boolean);
  return parts.join('，');
};

const fallbackInstructionText = (planner: LegPlanner | undefined, distance: number | null, seniorMode: boolean) => {
  const label = planner === 'campus-network' ? '校园路网指引' : '校园方向指引';
  const distanceText = typeof distance === 'number' && Number.isFinite(distance) ? `距离目标约 ${Math.round(distance)} 米` : '距离目标计算中';
  return seniorMode
    ? `${label}，${distanceText}`
    : `沿校园方向指引继续前行。${distanceText}。当前使用${label}。`;
};

const createTripId = () => `trip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const completedTripSavedKey = (tripId: string) => `shanhai_completed_trip_saved_${tripId}`;

const navigationDistanceBucket = (distance: number, frequency: 'low' | 'standard' | 'high') => {
  if (frequency === 'low') {
    if (distance > 120) return 'far';
    if (distance > 35) return 'approach';
    return 'near';
  }
  if (frequency === 'high') {
    if (distance > 200) return 'far';
    if (distance > 150) return '200-150';
    if (distance > 100) return '150-100';
    if (distance > 75) return '100-75';
    if (distance > 50) return '75-50';
    if (distance > 35) return '50-35';
    if (distance > 20) return '35-20';
    return 'near';
  }
  if (distance > 200) return 'far';
  if (distance > 100) return '200-100';
  if (distance > 50) return '100-50';
  if (distance > 20) return '50-20';
  return 'near';
};

type XiaohaiRouteMotionState = 'idle' | 'walking' | 'turning-left' | 'turning-right' | 'off-route' | 'arrived' | 'speaking';

type DrawerState = 'collapsed' | 'half' | 'full';

type SegmentCacheEntry = { key: string; path: LngLatPoint[]; planner: LegPlanner; distance: number; minute: number; steps?: import('../utils/tripNavigation').NavigationStepInstruction[] };

type RouteSummary = {
  distance: number;
  minute: number;
  planner: LegPlanner;
  label: string;
  message: string;
  failureReason?: string;
  steps?: import('../utils/tripNavigation').NavigationStepInstruction[];
};

type SegmentPlan = {
  path: LngLatPoint[];
  distance: number;
  minute: number;
  planner: LegPlanner;
  label: string;
  message: string;
  failureReason?: string;
  steps?: import('../utils/tripNavigation').NavigationStepInstruction[];
};

type WalkingPathResult = {
  success: boolean;
  path: LngLatPoint[];
  distanceMeters: number;
  durationMinutes: number;
  message: string;
  failureReason?: string;
  steps?: import('../utils/tripNavigation').NavigationStepInstruction[];
};

type NavigationStep = {
  title: string;
  detail: string;
};

export default function MapPage({ session, onBack, initialType, routeId, initialSpotId, initialNavigationMode, onNavigate }: MapPageProps) {
  const digitalHuman = useDigitalHuman();

  const toast = useToast();
  const [spots, setSpots] = useState<CampusSpot[]>([]);
  const [selectedSpot, setSelectedSpot] = useState<CampusSpot | null>(null);
  const [activeType, setActiveType] = useState<string>(initialType || '全部');
  const [searchValue, setSearchValue] = useState('');
  const [mapLoading, setMapLoading] = useState(true);
  const [mapError, setMapError] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSpotName, setNewSpotName] = useState('');
  const [newSpotType, setNewSpotType] = useState('教学场馆');
  const [newSpotDesc, setNewSpotDesc] = useState('');
  const [clickPosition, setClickPosition] = useState<{ lng: number; lat: number } | null>(null);
  const [currentRoute, setCurrentRoute] = useState<CampusRoute | null>(null);
  const [routeSpots, setRouteSpots] = useState<CampusSpot[]>([]);
  const [currentStationIndex, setCurrentStationIndex] = useState(-1);
  const [targetStationIndex, setTargetStationIndex] = useState(0);
  const [filteredSpots, setFilteredSpots] = useState<CampusSpot[]>([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [drawerState, setDrawerState] = useState<DrawerState>('half');
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
  const [routeStart, setRouteStart] = useState<CampusSpot | null>(null);
  const [routeEnd, setRouteEnd] = useState<CampusSpot | null>(null);
  const [spotLoading, setSpotLoading] = useState(true);
  const [phase, setPhase] = useState<TripPhase>('idle');
  const [navigationSteps, setNavigationSteps] = useState<NavigationStep[]>([]);
  const [routePath, setRoutePath] = useState<LngLatPoint[]>([]);
  const [currentLegPath, setCurrentLegPath] = useState<Array<[number, number]>>([]);
  const [mapObject, setMapObject] = useState<any>(null);
  const [fitRoute, setFitRoute] = useState(false);
  const [overlayState, setOverlayState] = useState<OverlayState>('none');
  const [routeDisplayMode, setRouteDisplayMode] = useState<DisplayMode>('overview');
  const [assistantExpanded, setAssistantExpanded] = useState(() => digitalHuman.effectiveConfig.navigationAssistantExpanded);
  const [showNavigationMore, setShowNavigationMore] = useState(false);
  const [temporaryTarget, setTemporaryTarget] = useState<CampusSpot | null>(null);
  const [temporaryPath, setTemporaryPath] = useState<LngLatPoint[]>([]);
  const [temporaryArrived, setTemporaryArrived] = useState(false);
  const [nextStationOverride, setNextStationOverride] = useState<number | null>(null);
  const [skippedStationIndexes, setSkippedStationIndexes] = useState<Set<number>>(() => new Set());
  const [legPlanningResult, setLegPlanningResult] = useState<LegPlanningResult>({ status: 'idle' });
  const [currentPosition, setCurrentPosition] = useState<LngLatPoint | null>(null);
  // @ts-ignore
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle');
  const [locationMode, setLocationMode] = useState<LocationMode>('real');
  const [manualLocationName, setManualLocationName] = useState('');
  const [distanceToTarget, setDistanceToTarget] = useState<number | null>(null);
  // @ts-ignore
  const [currentInstructionIndex, setCurrentInstructionIndex] = useState(0);
  // @ts-ignore
  const [distanceToInstruction, setDistanceToInstruction] = useState<number | null>(null);
  // @ts-ignore
  const [arrivalConsecutiveCount, setArrivalConsecutiveCount] = useState(0);
  // @ts-ignore
  const [arrivalTriggeredStationId, setArrivalTriggeredStationId] = useState<number | null>(null);
  const [selectedSpotScreenPos, setSelectedSpotScreenPos] = useState<{ x: number; y: number } | null>(null);
  const [completedFootprintPath, setCompletedFootprintPath] = useState<LngLatPoint[]>([]);
  const [showCompletedFootprint, setShowCompletedFootprint] = useState(false);
  const [demoPosition, setDemoPosition] = useState<LngLatPoint | null>(null);
  const [demoProgress, setDemoProgress] = useState(0);
  const [demoOffset, setDemoOffset] = useState(0);
  const [demoAuto, setDemoAuto] = useState(false);
  const [demoSpeed, setDemoSpeed] = useState<1 | 2>(1);
  const [demoControlsCollapsed, setDemoControlsCollapsed] = useState(true);
  const [currentLegProgress, setCurrentLegProgress] = useState<LegPathProgress | null>(null);
  const [navigationSubtitle, setNavigationSubtitle] = useState('');
  const [xiaohaiSpeaking, setXiaohaiSpeaking] = useState(false);
  const [navigationVoiceEnabled, setNavigationVoiceEnabled] = useState(() => {
    const saved = sessionStorage.getItem('shanhai_navigation_voice_enabled');
    if (saved !== null) return saved === 'true';
    return true; // default on, overridden by effectiveConfig.autoRead below
  });
  const [routeGeometryVersion, setRouteGeometryVersion] = useState(0);
  const routePathBeforeTemporaryRef = useRef<LngLatPoint[]>([]);
  const completedRouteIdsRef = useRef<Set<number>>(new Set());
  const segmentCacheRef = useRef<Map<string, SegmentCacheEntry>>(new Map());
  const planningLockRef = useRef(false);
  const planningTimeoutRef = useRef<number>(0);
  const fitRouteFrameRef = useRef<number>(0);
  const cameraPriorityRef = useRef<'default' | 'manual' | 'locate' | 'navigation' | 'route-fit'>('default');
  const demoFrameRef = useRef<number>(0);
  const demoLastFrameRef = useRef<number>(0);
  const spokenNavigationKeysRef = useRef<Set<string>>(new Set());
  // Removed autoIntroducedSpotIdsRef — now handled by narrationDedup (trip-level, sessionStorage-backed)
  const maxProgressDistanceRef = useRef(0);
  const currentLegKeyRef = useRef('');
  const moreMenuAnchorRef = useRef<HTMLDivElement | null>(null);
  const currentTripIdRef = useRef('');
  const completedTripSavedRef = useRef<Set<string>>(new Set());
  const completingTripRef = useRef(false);
  const pendingAmbientNarrationRef = useRef<string | null>(null);
  
  // Drawer gesture states
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [touchEndY, setTouchEndY] = useState<number | null>(null);

  const onDrawerTouchStart = (e: React.TouchEvent) => {
    setTouchEndY(null);
    setTouchStartY(e.targetTouches[0].clientY);
  };

  const onDrawerTouchMove = (e: React.TouchEvent) => {
    setTouchEndY(e.targetTouches[0].clientY);
  };

  const onDrawerTouchEnd = () => {
    if (!touchStartY || touchEndY === null) return;
    const distance = touchStartY - touchEndY;
    const isSwipeUp = distance > 50;
    const isSwipeDown = distance < -50;
    
    if (isSwipeUp) {
      if (drawerState === 'collapsed') setDrawerState('half');
      else if (drawerState === 'half') setDrawerState('full');
    } else if (isSwipeDown) {
      if (drawerState === 'full') setDrawerState('half');
      else if (drawerState === 'half') setDrawerState('collapsed');
    }
  };

  const speakNavigationText = (key: string, text: string, category: SpeechCategory = 'navigation_turn', forceVoice = false) => {
    if (!text.trim() || phase === 'paused') return;
    if (!digitalHuman.capabilityEnabled('voiceRead') || !digitalHuman.capabilityEnabled('navigationVoice') || (!navigationVoiceEnabled && !forceVoice)) {
      // Still show subtitle if enabled, but don't speak
      if (digitalHuman.effectiveConfig.subtitleEnabled) setNavigationSubtitle(text);
      return;
    }
    if (!digitalHuman.effectiveConfig.autoRead && category === 'ambient_narration') return;
    if (spokenNavigationKeysRef.current.has(key)) return;
    spokenNavigationKeysRef.current.add(key);
    if (digitalHuman.effectiveConfig.subtitleEnabled) setNavigationSubtitle(text);
    setXiaohaiSpeaking(true);
    const started = speechService.speak(text, {
      category,
      priority: SPEECH_PRIORITY[category],
      dedupeKey: key,
      voiceType: digitalHuman.effectiveConfig.voiceType,
      rate: digitalHuman.effectiveConfig.speechSpeed,
      volume: digitalHuman.effectiveConfig.volume,
      pitch: digitalHuman.effectiveConfig.pitch,
      seniorMode: digitalHuman.effectiveConfig.seniorMode,
      onStart: () => setXiaohaiSpeaking(true),
      onEnd: () => {
        setXiaohaiSpeaking(false);
        window.setTimeout(() => setNavigationSubtitle(''), 1200);
      },
      onError: () => {
        setXiaohaiSpeaking(false);
        setNavigationSubtitle('');
      },
    });
    if (!started) {
      setXiaohaiSpeaking(false);
      setNavigationSubtitle('');
    }
  };

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const labelsRef = useRef<any[]>([]);
  const clusterRef = useRef<any>(null);
  const currentZoomRef = useRef<number>(17);
  const handledInitialSpotRef = useRef(false);
  const restoredNavigationRef = useRef(false);
  const navigationInFlightRef = useRef(false);
  const arrivalTriggeredStationKeyRef = useRef<string | null>(null);
  // 旧 UI 兼容值只允许由 TripPhase/LegPlanningResult 单向派生，不再独立更新。
  const navigationStatus = phase === 'planning_leg' || phase === 'locating'
    ? 'planning'
    : phase === 'route_preview'
      ? 'planned'
      : phase === 'navigating_leg' || phase === 'temporary_navigation'
        ? 'navigating'
        : phase === 'arrived' ? 'arrived' : phase === 'completed' ? 'completed' : 'idle';
  // Derived states kept for readability — unused vars removed per audit

  useEffect(() => () => {
    if (fitRouteFrameRef.current) window.cancelAnimationFrame(fitRouteFrameRef.current);
    if (demoFrameRef.current) window.cancelAnimationFrame(demoFrameRef.current);
    window.clearTimeout(planningTimeoutRef.current);
    speechService.cancel();
  }, []);

  // Idempotent spot selection — if already selected, only update camera.
  const selectedSpotIdRef = useRef<number | null>(null);
  const focusSpot = (spot: CampusSpot) => {
    if (selectedSpotIdRef.current === spot.id && overlayState === 'spot') {
      // Already selected — only reposition camera, don't recreate anything
      if (mapInstance.current) {
        const { lng, lat } = getSpotLngLat(spot);
        mapInstance.current.setZoomAndCenter(18, [lng, lat], false, 300);
        mapInstance.current.panBy(0, -120);
      }
      return;
    }
    selectedSpotIdRef.current = spot.id;
    setSelectedSpot(spot);
    setOverlayState('spot');
    setAssistantExpanded(false);
    setRouteEnd(prev => prev || spot);
    setDrawerState('half');
    if (mapInstance.current) {
      const { lng, lat } = getSpotLngLat(spot);
      mapInstance.current.setZoomAndCenter(18, [lng, lat], false, 300);
      mapInstance.current.panBy(0, -120);
    }
  };
  // Reset id ref when deselecting
  const clearSelection = () => {
    selectedSpotIdRef.current = null;
    setSelectedSpot(null);
    setOverlayState('none');
  };

  const buildNavigationSteps = (start: CampusSpot, end: CampusSpot, summary?: RouteSummary | null): NavigationStep[] => {
    const distanceText = summary ? `${Math.round(summary.distance)} 米` : '当前路线';
    return [
      { title: '从起点出发', detail: `从${start.spotName}出发，确认前往${end.spotName}` },
      { title: '沿校园主路前行', detail: `保持在当前路线附近行走，预计距离 ${distanceText}` },
      { title: '通过中间路段', detail: summary?.planner === 'amap-walking' ? '按高德步行路线继续前进' : `按${summary?.label || '校园示意路线'}继续前进` },
      { title: '靠近目标点位', detail: `即将到达${end.spotName}，注意查看地图上的终点标记` },
      { title: '到达目标点位', detail: `已到达${end.spotName}` },
    ];
  };

  const syncNavigationSteps = (start: CampusSpot, end: CampusSpot, summary: RouteSummary) => {
    setNavigationSteps(buildNavigationSteps(start, end, summary));
  };

  // ---- path normalization: dedup consecutive identical points ----
  const normalizePathPoints = (points: LngLatPoint[]): LngLatPoint[] => {
    if (points.length < 2) return points;
    const out: LngLatPoint[] = [points[0]];
    for (let i = 1; i < points.length; i++) {
      const prev = out[out.length - 1];
      if (Math.abs(points[i][0] - prev[0]) > 0.000001 || Math.abs(points[i][1] - prev[1]) > 0.000001) {
        out.push(points[i]);
      }
    }
    return out.length >= 2 ? out : points;
  };

  const segmentCacheKey = (fromId: number, toId: number) => `${fromId}->${toId}`;

  const planSegmentCached = async (start: CampusSpot, end: CampusSpot): Promise<SegmentPlan> => {
    const key = segmentCacheKey(start.id, end.id);
    const cached = segmentCacheRef.current.get(key);
    if (cached) {
      return { path: cached.path, distance: cached.distance, minute: cached.minute, planner: cached.planner, label: routeLabelMap[cached.planner], message: '', steps: cached.steps };
    }
    const result = await planStableSegment(start, end);
    segmentCacheRef.current.set(key, { key, path: result.path, planner: result.planner, distance: result.distance, minute: result.minute, steps: result.steps });
    setRouteGeometryVersion(value => value + 1);
    return result;
  };

  // Plan a segment with 5s timeout → fallback
  const planSegmentWithTimeout = async (start: CampusSpot, end: CampusSpot): Promise<{ path: LngLatPoint[]; planner: LegPlanner; label: string; status: 'ready' | 'fallback' | 'failed'; message: string; steps?: import('../utils/tripNavigation').NavigationStepInstruction[] }> => {
    try {
      const result = await Promise.race([
        planSegmentCached(start, end),
        new Promise<never>((_, reject) => { planningTimeoutRef.current = window.setTimeout(() => reject(new Error('TIMEOUT')), 5000); }),
      ]);
      window.clearTimeout(planningTimeoutRef.current);
      return { path: normalizePathPoints(result.path), planner: result.planner, label: result.label, status: 'ready', message: '', steps: result.steps };
    } catch (err: any) {
      window.clearTimeout(planningTimeoutRef.current);
      // 最终降级只表示方向，不再冒充道路导航。
      const fallbackPath = normalizePathPoints(generateFallbackPolyline(toRouteEndpoint(start), toRouteEndpoint(end)));
      const isTimeout = err?.message === 'TIMEOUT';
      console.warn(`[MapPage] 路段规划${isTimeout ? '超时' : '失败'}，使用方向指引: ${start.spotName} → ${end.spotName}`);
      return {
        path: fallbackPath,
        planner: 'direction-guide',
        label: routeLabelMap['direction-guide'],
        status: 'fallback',
        message: '未获得可用道路路线，当前仅提供方向指引。',
      };
    }
  };

  const planLegFromPosition = async (position: LngLatPoint, targetIndex: number, mode: LocationMode = locationMode, manualName = manualLocationName) => {
    const target = routeSpots[targetIndex];
    if (!target || planningLockRef.current) return;
    planningLockRef.current = true;
    setPhase('planning_leg');
    setLegPlanningResult({ status: 'planning' });
    setOverlayState('navigation');
    setRouteDisplayMode('current-leg');
    setDrawerState('collapsed');
    setArrivalConsecutiveCount(0);
    setArrivalTriggeredStationId(null);
    arrivalTriggeredStationKeyRef.current = null;
    maxProgressDistanceRef.current = 0;
    setCurrentLegProgress(null);
    const start: CampusSpot = {
      ...target,
      id: -100000 - targetIndex,
      spotName: mode === 'demo' ? '演示位置' : mode === 'manual' ? `自选起点 · ${manualName || '已选位置'}` : '当前位置',
      longitude: position[0],
      latitude: position[1],
    };
    setRouteStart(start);
    setRouteEnd(target);
    setCurrentLegPath([]);
    const result = await planSegmentWithTimeout(start, target);
    setCurrentLegPath(result.path);
    setLegPlanningResult({ status: result.status, planner: result.planner, message: result.message });
    setRouteSummary({
      distance: calculatePathDistanceMeters(result.path),
      minute: Math.max(1, Math.round(calculatePathDistanceMeters(result.path) / 75)),
      planner: result.planner,
      label: result.label,
      message: result.message,
      steps: result.planner === 'amap-walking' ? result.steps : undefined,
    });
    setCurrentInstructionIndex(0);
    setDistanceToInstruction(null);
    setPhase('navigating_leg');
    if (mode === 'demo') {
      setDemoPosition(position);
      setDemoProgress(0);
      setDemoOffset(0);
      setDemoAuto(true);
    }
    planningLockRef.current = false;
    navigationInFlightRef.current = false;
    if (result.message) toast.show(result.message);
  };

  const beginTripFromPosition = async (position: LngLatPoint, mode: LocationMode = locationMode, manualName = manualLocationName) => {
    if (routeSpots.length === 0) return;
    const first = getSpotLngLat(routeSpots[0]);
    const distanceToFirst = calculatePathDistanceMeters([position, [first.lng, first.lat]]);
    const indexes = deriveTripStartIndexes(distanceToFirst, routeSpots.length);
    // Generate unique trip ID for this navigation session
    if (currentTripIdRef.current) finishTripRuntime(currentTripIdRef.current);
    currentTripIdRef.current = createTripId();
    setCurrentStationIndex(indexes.currentStationIndex);
    setTargetStationIndex(indexes.targetStationIndex);
    spokenNavigationKeysRef.current.clear();
    narrationDedup.initTrip(currentTripIdRef.current);
    digitalHuman.startNavigation(currentRoute?.routeName || '校园路线', routeSpots, routeSummary?.minute || currentRoute?.totalMinute || 0, currentTripIdRef.current);
    digitalHuman.setCurrentStation(Math.max(indexes.currentStationIndex, 0));
    if (mode === 'demo') {
      setDemoPosition(position);
      setDemoProgress(0);
      setDemoOffset(0);
      setDemoAuto(true);
    }
    if (indexes.currentStationIndex === routeSpots.length - 1) {
      setPhase('arrived');
      setOverlayState('arrival');
      return;
    }
    await planLegFromPosition(position, indexes.targetStationIndex, mode, manualName);
  };

  const locateRealPosition = async (): Promise<LngLatPoint> => {
    setLocationStatus('locating');
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('浏览器不支持定位'));
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 });
    });
    const point: LngLatPoint = [position.coords.longitude, position.coords.latitude];
    clearPersistedLocationMode();
    setCurrentPosition(point);
    try {
      sessionStorage.setItem(LOCATION_MODE_KEY, 'real');
      sessionStorage.setItem(CURRENT_POSITION_KEY, JSON.stringify(point));
      sessionStorage.setItem(LOCATION_UPDATED_AT_KEY, String(Date.now()));
    } catch { /* ignore */ }
    setLocationAccuracy(position.coords.accuracy);
    setLocationStatus('located');
    setLocationMode('real');
    setDemoPosition(null);
    return point;
  };

  const startTripNavigation = async () => {
    if (navigationInFlightRef.current) return;
    if (routeSpots.length === 0) {
      toast.warning('请先选择一条路线');
      return;
    }
    navigationInFlightRef.current = true;
    const routeStartModeMatch = routeStart?.suitableMode?.match(/^__route_start_(real|demo|manual|spot)$/);
    if (routeStart && routeStartModeMatch) {
      const startPoint = getSpotLngLat(routeStart);
      const position: LngLatPoint = [startPoint.lng, startPoint.lat];
      const startMode = routeStartModeMatch[1] as LocationMode | 'spot';
      const navigationMode: LocationMode = startMode === 'spot' ? 'manual' : startMode;
      setLocationMode(navigationMode);
      setLocationStatus(navigationMode === 'demo' ? 'demo' : navigationMode === 'manual' ? 'manual' : 'located');
      if (navigationMode === 'demo') setDemoPosition(position);
      else setCurrentPosition(position);
      setOverlayState('none');
      await beginTripFromPosition(position, navigationMode, routeStart.spotName);
      return;
    }
    // Respect persisted demo mode
    const persistedDemoStart = readPersistedDemoStart();
    if (persistedDemoStart) {
      let position: LngLatPoint = persistedDemoStart;
      if (!isValidLngLat(position[0], position[1])) {
        const southGate = findSouthGateSpot(spots);
        position = southGate
          ? [getSpotLngLat(southGate).lng, getSpotLngLat(southGate).lat]
          : [SHANHAI_UNIVERSITY.lng, SHANHAI_UNIVERSITY.lat];
      }
      setLocationMode('demo');
      setLocationStatus('demo');
      setDemoPosition(position);
      setOverlayState('none');
      await beginTripFromPosition(position, 'demo');
      return;
    }
    setPhase('locating');
    setOverlayState('none');
    try {
      const position = await locateRealPosition();
      await beginTripFromPosition(position, 'real');
    } catch {
      navigationInFlightRef.current = false;
      setLocationStatus('error');
      setPhase('error');
      setOverlayState('locationPicker');
      toast.error('暂时无法获取当前位置，请重新定位或选择出发点。');
    }
  };

  const retryLocation = async () => {
    setPhase('locating');
    setOverlayState('none');
    try {
      const position = await locateRealPosition();
      if (mapInstance.current) mapInstance.current.setZoomAndCenter(18, position);
      if (routeSpots.length > 0) await beginTripFromPosition(position, 'real');
      else if (selectedSpot || routeEnd) await startNavigationToTargetFromPosition((selectedSpot || routeEnd) as CampusSpot, position, 'real');
      else setPhase('idle');
    } catch {
      navigationInFlightRef.current = false;
      setLocationStatus('error');
      setPhase('error');
      setOverlayState('locationPicker');
      toast.error('暂时无法获取当前位置，请重新定位或选择出发点。');
    }
  };

  const centerOnCurrentLocation = async () => {
    try {
      const position = await locateRealPosition();
      cameraPriorityRef.current = 'locate';
      if (mapInstance.current) mapInstance.current.setZoomAndCenter(17, position, false, 300);
      if (overlayState === 'locationPicker') setOverlayState('none');
      toast.show('已定位到当前位置');
    } catch {
      setLocationStatus('error');
      setOverlayState('locationPicker');
      toast.error('暂时无法获取当前位置，请重新定位或选择出发点。');
    }
  };

  const useDemoStart = async (remember = true) => {
    const southGate = findSouthGateSpot(spots);
    const position: LngLatPoint = southGate
      ? [getSpotLngLat(southGate).lng, getSpotLngLat(southGate).lat]
      : [SHANHAI_UNIVERSITY.lng, SHANHAI_UNIVERSITY.lat];
    setLocationMode('demo');
    setLocationStatus('demo');
    setDemoPosition(position);
    setLocationAccuracy(null);
    setManualLocationName('');
    setOverlayState('none');
    if (remember) {
      persistDemoStart(position);
    }
    if (mapInstance.current) mapInstance.current.setZoomAndCenter(18, position);
    if (routeSpots.length > 0) await beginTripFromPosition(position, 'demo');
    else if (selectedSpot || routeEnd) await startNavigationToTargetFromPosition((selectedSpot || routeEnd) as CampusSpot, position, 'demo');
    else setPhase('idle');
  };

  const useManualStart = async (spot: CampusSpot) => {
    const point = getSpotLngLat(spot);
    const position: LngLatPoint = [point.lng, point.lat];
    setLocationMode('manual');
    setLocationStatus('manual');
    clearPersistedLocationMode();
    setManualLocationName(spot.spotName);
    setCurrentPosition(position);
    setLocationAccuracy(null);
    try {
      sessionStorage.setItem(LOCATION_MODE_KEY, 'manual');
      sessionStorage.setItem(MANUAL_START_KEY, JSON.stringify(position));
      sessionStorage.setItem(LOCATION_UPDATED_AT_KEY, String(Date.now()));
    } catch { /* ignore */ }
    setOverlayState('none');
    if (mapInstance.current) mapInstance.current.setZoomAndCenter(18, position);
    if (routeSpots.length > 0) await beginTripFromPosition(position, 'manual', spot.spotName);
    else if (selectedSpot || routeEnd) await startNavigationToTargetFromPosition((selectedSpot || routeEnd) as CampusSpot, position, 'manual', spot.spotName);
    else setPhase('idle');
  };

  const finishTripRuntime = (endingTripId: string, clearDedup = true) => {
    digitalHuman.endNavigation(endingTripId || undefined);
    speechService.cancel();
    setNavigationSubtitle('');
    setXiaohaiSpeaking(false);
    spokenNavigationKeysRef.current.clear();
    if (endingTripId && clearDedup) narrationDedup.clearTrip(endingTripId);
    currentTripIdRef.current = '';
    sessionStorage.removeItem('shanhai_trip_navigation');
  };

  const exitNavigation = () => {
    const oldTripId = currentTripIdRef.current;
    clearRoute();
    setRouteSpots([]);
    setRouteStart(null);
    setRouteEnd(null);
    setCurrentRoute(null);
    setCurrentStationIndex(-1);
    setTargetStationIndex(0);
    setSelectedSpot(null);
    setRouteDisplayMode('overview');
    setOverlayState('none');
    setDemoAuto(false);
    setDemoProgress(0);
    setDemoOffset(0);
    setCurrentLegProgress(null);
    setPhase('idle');
    setNavigationSteps([]);
    finishTripRuntime(oldTripId);
    toast.show('已退出导航');
  };

  const prepareNavigationToSpot = (spot: CampusSpot, spotList: CampusSpot[]) => {
    focusSpot(spot);
    clearRoute(false);
    setCurrentRoute(null);
    setRouteSpots([]);
    setCurrentStationIndex(-1);
    setTargetStationIndex(0);
    setRouteSummary(null);
    setRouteStart(findSouthGateSpot(spotList));
    setRouteEnd(spot);
    setPhase('idle');
    setNavigationSteps([]);

    setDrawerState('full');
    toast.show(`已为${spot.spotName}打开导航准备`);
  };

  const resetToSouthGate = () => {
    const defaultSpot = findSouthGateSpot(spots);
    if (defaultSpot && mapInstance.current) {
      const { lng, lat } = getSpotLngLat(defaultSpot);
      mapInstance.current.setZoomAndCenter(17, [lng, lat]);
      toast.show(defaultSpot.spotName.includes('南门') ? '已回到山海大学南门' : `已回到${defaultSpot.spotName}`);
      return;
    }
    if (mapInstance.current) {
      mapInstance.current.setZoomAndCenter(17, [SHANHAI_UNIVERSITY.lng, SHANHAI_UNIVERSITY.lat]);
      toast.show('已重置地图视图');
    }
  };

  useEffect(() => {
    if (!selectedSpot) return;
    favoriteApi.checkFavorite(session.sessionId, 1, selectedSpot.id)
      .then(response => setIsFavorite(Boolean(response.data.data?.isFavorite)))
      .catch(() => setIsFavorite(false));
  }, [selectedSpot?.id, session.sessionId]);

  const toggleSpotFavorite = async () => {
    requireAuth(session, async () => {
      if (!selectedSpot) return;
      try {
        if (isFavorite) await favoriteApi.removeFavorite(session.sessionId, 1, selectedSpot.id);
        else await favoriteApi.addFavorite(session.sessionId, 1, selectedSpot.id);
        setIsFavorite(prev => !prev);
        toast.show(isFavorite ? '已取消收藏' : '收藏成功');
      } catch (error) {
        toast.error(getErrorMessage(error, '收藏操作失败'));
      }
    });
  };

  const checkinSpot = async () => {
    requireAuth(session, async () => {
      if (!selectedSpot) return;
      try {
        await checkinApi.checkin(session.sessionId, selectedSpot.id, undefined, 1);
        toast.success('打卡成功');
      } catch (error) {
        toast.error(getErrorMessage(error, '打卡失败，请稍后重试'));
      }
    });
  };

  useEffect(() => {
    if (!initialSpotId || !mapInstance.current || spots.length === 0 || handledInitialSpotRef.current) return;
    const target = spots.find(spot => String(spot.id) === String(initialSpotId));
    if (target) {
      handledInitialSpotRef.current = true;
      if (initialNavigationMode) prepareNavigationToSpot(target, spots);
      else focusSpot(target);
    }
  }, [initialSpotId, initialNavigationMode, spots.length]);

  // Load AI route from sessionStorage
  useEffect(() => {
    if (!mapInstance.current || spots.length === 0 || routeId) return;
    const aiRouteJson = sessionStorage.getItem('shanhai_ai_route');
    if (!aiRouteJson) return;
    try {
      const aiRoute = JSON.parse(aiRouteJson);
      if (!aiRoute || !aiRoute.spots?.length) return;
      sessionStorage.removeItem('shanhai_ai_route');

      // Convert AI route spots to CampusSpot format
      const aiRouteSpots: CampusSpot[] = aiRoute.spots.map((s: any) => ({
        id: s.spotId,
        spotName: s.spotName,
        spotType: s.spotType || '教学场馆',
        longitude: s.longitude,
        latitude: s.latitude,
        spotDesc: s.spotDesc || '',
        spotImage: s.spotImage || '',
        openTime: '',
        recommendTime: s.stayMinute || 15,
        suitableMode: '',
        isEnable: 1,
        createTime: '',
        updateTime: '',
      }));
      const normalizedStartMode = ['real', 'demo', 'manual', 'spot'].includes(String(aiRoute.startMode || '').toLowerCase())
        ? String(aiRoute.startMode).toLowerCase()
        : '';
      const startLng = Number(aiRoute.startLng);
      const startLat = Number(aiRoute.startLat);
      const startLabel = String(aiRoute.startLabel || '').trim();
      const plannedStart: CampusSpot | null = Number.isFinite(startLng) && Number.isFinite(startLat) && isValidLngLat(startLng, startLat)
        ? {
          id: normalizedStartMode === 'spot' && aiRoute.startSpotId ? Number(aiRoute.startSpotId) : -900001,
          spotName: startLabel || (normalizedStartMode === 'demo' ? '演示位置' : normalizedStartMode === 'real' ? '当前位置' : normalizedStartMode === 'manual' ? '手动起点' : '路线起点'),
          spotType: normalizedStartMode === 'spot' ? '路线起点' : '临时起点',
          longitude: startLng,
          latitude: startLat,
          spotDesc: 'AI 路线确认起点',
          spotImage: '',
          openTime: '',
          recommendTime: 0,
          suitableMode: `__route_start_${normalizedStartMode || 'manual'}`,
          isEnable: 1,
        }
        : null;

      setRouteSpots(aiRouteSpots);
      setCurrentStationIndex(-1);
      setTargetStationIndex(0);
      setPhase('route_preview');
      setRouteDisplayMode('overview');
      setOverlayState('routePreview');
      const walkingStops = plannedStart && aiRouteSpots[0]?.id !== plannedStart.id
        ? [plannedStart, ...aiRouteSpots] : aiRouteSpots;
      setRouteStart(plannedStart || walkingStops[0]);
      setRouteEnd(walkingStops[walkingStops.length - 1]);
      setDrawerState('half');

      // Draw the AI route
      if (walkingStops.length >= 2) {
        drawWalkingRoute(walkingStops).then(() => {
          if (navigationInFlightRef.current) return;
          if (!initialNavigationMode) pulseFitRoute(setFitRoute, fitRouteFrameRef);
          setPhase('route_preview');
        });
      }
    } catch (e) {
      console.warn('Failed to load AI route from sessionStorage', e);
    }
  }, [spots.length, routeId]);

  useEffect(() => {
    const runtime = digitalHuman.navigation;
    if (restoredNavigationRef.current || routeId || !runtime || !mapInstance.current || spots.length === 0 || routeSpots.length > 0) return;
    restoredNavigationRef.current = true;
    setRouteSpots(runtime.spots);
    const saved = sessionStorage.getItem('shanhai_trip_navigation');
    let restoredCurrent = runtime.currentStationIndex;
    let restoredTarget = Math.min(runtime.currentStationIndex + 1, runtime.spots.length - 1);
    let restoredPhase: TripPhase = 'paused';
    let restoredTripId = runtime.tripId || '';
    try {
      const parsed = saved ? JSON.parse(saved) : null;
      if (parsed) {
        restoredTripId = parsed.tripId || restoredTripId;
        restoredCurrent = Number(parsed.currentStationIndex ?? restoredCurrent);
        restoredTarget = Number(parsed.targetStationIndex ?? restoredTarget);
        restoredPhase = parsed.phase === 'navigating_leg' ? 'paused' : parsed.phase || 'paused';
        if (Array.isArray(parsed.currentPosition)) setCurrentPosition(parsed.currentPosition);
        if (parsed.locationMode) setLocationMode(parsed.locationMode);
        if (parsed.locationStatus) setLocationStatus(parsed.locationStatus);
        if (parsed.manualLocationName) setManualLocationName(parsed.manualLocationName);
      }
    } catch { /* ignore invalid session state */ }
    if (restoredTripId) {
      currentTripIdRef.current = restoredTripId;
      narrationDedup.initTrip(restoredTripId);
    }
    setCurrentStationIndex(restoredCurrent);
    setTargetStationIndex(restoredTarget);
    setPhase(restoredPhase);
    setRouteStart(runtime.spots[0] || null);
    setRouteEnd(runtime.spots[runtime.spots.length - 1] || null);
    setDrawerState('half');
    if (runtime.spots.length > 1) void drawWalkingRoute(runtime.spots);
  }, [digitalHuman.navigation, routeId, routeSpots.length, spots.length]);

  useEffect(() => {
    if (routeSpots.length === 0 || phase === 'idle' || phase === 'route_preview' || phase === 'completed') return;
    sessionStorage.setItem('shanhai_trip_navigation', JSON.stringify({
      tripId: currentTripIdRef.current,
      phase,
      currentStationIndex,
      targetStationIndex,
      currentPosition,
      locationMode,
      locationStatus,
      manualLocationName,
    }));
  }, [phase, currentStationIndex, targetStationIndex, currentPosition, locationMode, locationStatus, manualLocationName, routeSpots.length]);

  useEffect(() => {
    // Filter spots whenever spots, activeType, or searchValue changes
    const filtered = spots.filter(spot => {
      const typeMatch = activeType === '全部' || spot.spotType === activeType;
      const searchMatch = !searchValue || spot.spotName.includes(searchValue) || (spot.spotDesc && spot.spotDesc.includes(searchValue));
      return typeMatch && searchMatch;
    });
    setFilteredSpots(filtered);

    // Adjust viewport when category changes
    const navigationCameraActive = ['locating', 'planning_leg', 'navigating_leg', 'paused', 'temporary_navigation', 'arrived'].includes(phase);
    if (mapInstance.current && filtered.length > 0 && activeType !== '全部' && cameraPriorityRef.current === 'default' && !navigationCameraActive) {
      const lngs = filtered.map(s => Number(s.longitude));
      const lats = filtered.map(s => Number(s.latitude));
      const validLngs = lngs.filter(n => Number.isFinite(n));
      const validLats = lats.filter(n => Number.isFinite(n));
      if (validLngs.length > 0 && validLats.length > 0) {
        const avgLng = validLngs.reduce((a, b) => a + b, 0) / validLngs.length;
        const avgLat = validLats.reduce((a, b) => a + b, 0) / validLats.length;
        // Calculate max spread to determine zoom
        const spreads = filtered.map(s => {
          const dx = Number(s.longitude) - avgLng;
          const dy = Number(s.latitude) - avgLat;
          return Math.sqrt(dx * dx + dy * dy);
        });
        const maxSpread = Math.max(...spreads, 0.001);
        const zoom = maxSpread < 0.002 ? 17 : maxSpread < 0.005 ? 16 : 15;
        mapInstance.current.setZoomAndCenter(zoom, [avgLng, avgLat]);
      }
    } else if (mapInstance.current && activeType === '全部' && cameraPriorityRef.current === 'default' && !navigationCameraActive) {
      const southGate = spots.find(s => s.spotName.includes('南门'));
      if (southGate) {
        mapInstance.current.setZoomAndCenter(17, [Number(southGate.longitude), Number(southGate.latitude)]);
      }
    }

    // Update markers visibility based on filter
    if (mapInstance.current && markersRef.current.length > 0) {
      markersRef.current.forEach(marker => {
        const spotData = marker.getExtData()?.spot;
        if (!spotData) return;
        const typeMatch = activeType === '全部' || spotData.spotType === activeType;
        const searchMatch = !searchValue || spotData.spotName.includes(searchValue) || (spotData.spotDesc && spotData.spotDesc.includes(searchValue));
        if (typeMatch && searchMatch) {
          marker.show();
        } else {
          marker.hide();
        }
      });
      if (clusterRef.current) {
        // AMAP MarkerClusterer doesn't automatically update when markers are hidden/shown.
        // Re-render cluster based on visible markers.
        // const visibleMarkers = markersRef.current.filter(m => m.getExtData().visible !== false && (activeType === '全部' || m.getExtData().spotType === activeType) && (!searchValue || m.getExtData().spotName.includes(searchValue)));
        // Note: For simplicity, we just clear and add, or let it be. But hiding markers usually works if we recreate the cluster or if cluster handles visibility. 
        // AMap 2.0 MarkerClusterer needs clearMarkers and addMarkers.
        // We'll leave it simple for now: hiding individual markers might leave empty clusters, but for this demo, recreating clusters is better if possible.
        // Actually, just calling render works in some versions, but let's just let the markers hide.
      }
    }
  }, [spots, activeType, searchValue, phase]);

  const loadSpotsFromApi = async () => {
    setSpotLoading(true);
    try {
      const response = await spotApi.getSpots();
      const apiSpots = response.data.data || [];
      setSpots(apiSpots);
      const defaultSpot = findSouthGateSpot(apiSpots);
      setRouteStart(prev => prev || defaultSpot);
      if (defaultSpot && mapInstance.current && !routeId && cameraPriorityRef.current === 'default') {
        const { lng, lat } = getSpotLngLat(defaultSpot);
        mapInstance.current.setZoomAndCenter(17, [lng, lat]);
      }
      if (apiSpots.length === 0) toast.show('暂无可展示点位');
    } catch (error) {
      console.error('Failed to load spots from API:', error);
      toast.error(getErrorMessage(error, '点位加载失败，请稍后重试'));
    } finally {
      setSpotLoading(false);
    }
  };

  const loadRouteAndNavigate = async (routeId: number) => {
    try {
      const routeRes = await routeApi.getRouteById(routeId);
      const currentRouteData = routeRes.data.data;
      setCurrentRoute(currentRouteData);

      const allSpots = spots.length > 0 ? spots : (await spotApi.getSpots()).data.data || [];
      let routeSpotsList = currentRouteData.spots || [];
      if (routeSpotsList.length === 0) {
        const ids: number[] = JSON.parse(currentRouteData.spotOrderJson || '[]');
        const byId = new Map(allSpots.map(spot => [spot.id, spot]));
        routeSpotsList = ids.map(id => byId.get(id)).filter((spot): spot is CampusSpot => Boolean(spot));
      }
      if (routeSpotsList.length === 0) throw new Error('路线没有有效点位');

      setRouteSpots(routeSpotsList);
      setCurrentStationIndex(-1);
      setTargetStationIndex(0);
      setPhase('route_preview');
      setRouteDisplayMode('overview');
      setOverlayState('routePreview');
      const defaultStart = findSouthGateSpot(allSpots);
      const walkingStops = defaultStart && routeSpotsList[0]?.id !== defaultStart.id ? [defaultStart, ...routeSpotsList] : routeSpotsList;
      setRouteStart(walkingStops[0]);
      setRouteEnd(walkingStops[walkingStops.length - 1]);
      setDrawerState('half');

      await drawWalkingRoute(walkingStops);
      pulseFitRoute(setFitRoute, fitRouteFrameRef);

    } catch (error) {
      console.error('Failed to load route:', error);
      toast.error(getErrorMessage(error, '路线加载失败'));
    }
  };

  const drawWalkingRoute = async (routeSpotsList: CampusSpot[]) => {
    if (!mapInstance.current || routeSpotsList.length < 2) return;
    if (navigationInFlightRef.current) return;

    clearRoute(false);
    setRouteStart(routeSpotsList[0]);
    setRouteEnd(routeSpotsList[routeSpotsList.length - 1]);
    setPhase('route_preview');
    setLegPlanningResult({ status: 'planning' });

    try {
      const allPaths: LngLatPoint[] = [];
      let totalDistance = 0;
      let totalMinute = 0;
      let finalPlanner: LegPlanner = 'amap-walking';
      const failureReasons: string[] = [];

      for (let i = 0; i < routeSpotsList.length - 1; i++) {
        const start = routeSpotsList[i];
        const end = routeSpotsList[i + 1];

        const segment = await planSegmentCached(start, end);
        const normalized = normalizePathPoints(segment.path);
        // Stitch: remove duplicate connection point between consecutive segments
        if (i === 0) {
          allPaths.push(...normalized);
        } else {
          // Only skip the first point if it's within ~1 meter of the last point
          const lastPoint = allPaths[allPaths.length - 1];
          const firstOfNew = normalized[0];
          const dupDist = Math.abs(lastPoint[0] - firstOfNew[0]) + Math.abs(lastPoint[1] - firstOfNew[1]);
          allPaths.push(...(dupDist < 0.00002 ? normalized.slice(1) : normalized));
        }
        totalDistance += segment.distance;
        totalMinute += segment.minute;
        if (segment.planner === 'direction-guide') finalPlanner = 'direction-guide';
        else if (segment.planner === 'campus-network' && finalPlanner !== 'direction-guide') finalPlanner = 'campus-network';
        if (segment.failureReason) failureReasons.push(`第${i + 1}段：${segment.failureReason}`);
      }

      if (allPaths.length < 2) {
        throw new Error('多点路线没有生成有效路径');
      }

      drawRouteWithArrow(allPaths, routeSpotsList[0], routeSpotsList[routeSpotsList.length - 1], finalPlanner);
      const summary: RouteSummary = {
        distance: totalDistance || calculatePathDistanceMeters(allPaths),
        minute: Math.max(1, Math.round(totalMinute || calculatePathDistanceMeters(allPaths) / 75)),
        planner: finalPlanner,
        label: routeLabelMap[finalPlanner],
        message: finalPlanner === 'amap-walking' ? '道路导航' : finalPlanner === 'campus-network' ? '校园路网导航' : '未获得可用道路路线，当前仅提供方向指引。',
        failureReason: failureReasons.join('；') || undefined,
      };
      setRouteSummary(summary);
      syncNavigationSteps(routeSpotsList[0], routeSpotsList[routeSpotsList.length - 1], summary);
      setPhase('route_preview');
      setLegPlanningResult({ status: finalPlanner === 'direction-guide' ? 'fallback' : 'ready', planner: finalPlanner, message: summary.message });
      if (finalPlanner !== 'amap-walking') {
        toast.show(finalPlanner === 'campus-network' ? '已切换为校园路网导航' : '未获得可用道路路线，当前仅提供方向指引。');
      }
    } catch (error) {
      console.warn('[MapPage] 多点路线规划失败，使用最终示意路线兜底', error);
      const fallbackPath = generateFallbackPolyline(toRouteEndpoint(routeSpotsList[0]), toRouteEndpoint(routeSpotsList[routeSpotsList.length - 1]), routeSpotsList.slice(1, -1).map(toRouteEndpoint));
      drawRouteWithArrow(fallbackPath, routeSpotsList[0], routeSpotsList[routeSpotsList.length - 1], 'direction-guide');
      const distance = calculatePathDistanceMeters(fallbackPath);
      const summary: RouteSummary = {
        distance,
        minute: Math.max(1, Math.round(distance / 75)),
        planner: 'direction-guide',
        label: routeLabelMap['direction-guide'],
        message: '未获得可用道路路线，当前仅提供方向指引。',
        failureReason: getErrorMessage(error, '多点路线规划失败'),
      };
      setRouteSummary(summary);
      syncNavigationSteps(routeSpotsList[0], routeSpotsList[routeSpotsList.length - 1], summary);
      setPhase('route_preview');
      setLegPlanningResult({ status: 'fallback', planner: 'direction-guide', message: summary.message });
      toast.show(summary.message);
    }
  };

  const isPathStraight = (path: LngLatPoint[]): boolean => {
    if (path.length < 3) return true;
    
    const start = path[0];
    const end = path[path.length - 1];
    
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const totalDist = Math.sqrt(dx * dx + dy * dy);
    
    let pathDist = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const p1 = path[i];
      const p2 = path[i + 1];
      pathDist += Math.sqrt(Math.pow(p2[0] - p1[0], 2) + Math.pow(p2[1] - p1[1], 2));
    }
    
    return pathDist / totalDist < 1.1;
  };

  const normalizeAmapPoint = (point: any): LngLatPoint | null => {
    if (!point) return null;
    if (typeof point.getLng === 'function' && typeof point.getLat === 'function') {
      return [Number(point.getLng()), Number(point.getLat())];
    }
    if (Array.isArray(point) && point.length >= 2) {
      return [Number(point[0]), Number(point[1])];
    }
    if (typeof point.lng !== 'undefined' && typeof point.lat !== 'undefined') {
      return [Number(point.lng), Number(point.lat)];
    }
    return null;
  };

  const extractAmapPath = (route: any): LngLatPoint[] => {
    const rawPath: any[] = Array.isArray(route?.path) ? route.path : [];
    const directPath = rawPath.map(normalizeAmapPoint).filter((point): point is LngLatPoint => Boolean(point));
    if (directPath.length >= 2) return directPath;

    const stepPath = (route?.steps || [])
      .flatMap((step: any) => step?.path || [])
      .map(normalizeAmapPoint)
      .filter((point: LngLatPoint | null): point is LngLatPoint => Boolean(point));
    return stepPath;
  };

  const createWalkingInstance = (WalkingCtor: any) => {
    try {
      return new WalkingCtor({
        map: mapInstance.current,
        city: '秦皇岛',
        hideMarkers: true,
        showRoute: false,
        autoFitView: false,
      });
    } catch (error) {
      console.warn('[MapPage] AMap.Walking 标准构造失败，尝试旧构造方式', error);
      return new WalkingCtor(mapInstance.current, {
        city: '秦皇岛',
        hideMarkers: true,
        showRoute: false,
      });
    }
  };

  const queryWalkingPath = (start: CampusSpot, end: CampusSpot): Promise<WalkingPathResult> => {
    return new Promise((resolve) => {
      let settled = false;
      const fail = (failureReason: string, detail?: unknown) => {
        if (settled) return;
        settled = true;
        console.warn(`[MapPage] 高德步行规划失败：${failureReason}`, {
          detail,
          start: { name: start.spotName, lng: start.longitude, lat: start.latitude },
          end: { name: end.spotName, lng: end.longitude, lat: end.latitude },
        });
        resolve({
          success: false,
          path: [],
          distanceMeters: 0,
          durationMinutes: 0,
          message: '高德步行规划失败',
          failureReason,
        });
      };

      try {
        const WalkingCtor = AMap.WalkingRoute || AMap.Walking;
        if (!WalkingCtor) {
          fail('AMap.Walking / WalkingRoute 插件未加载');
          return;
        }

        const startLng = typeof start.longitude === 'number' ? start.longitude : parseFloat(start.longitude || '119.5607');
        const startLat = typeof start.latitude === 'number' ? start.latitude : parseFloat(start.latitude || '39.9344');
        const endLng = typeof end.longitude === 'number' ? end.longitude : parseFloat(end.longitude || '119.5607');
        const endLat = typeof end.latitude === 'number' ? end.latitude : parseFloat(end.latitude || '39.9344');

        if (![startLng, startLat, endLng, endLat].every(Number.isFinite)) {
          fail('起点或终点坐标不是有效数字');
          return;
        }

        const walking = createWalkingInstance(WalkingCtor);

        const timeout = setTimeout(() => {
          fail('高德 Walking 查询超时');
        }, 8000);

        walking.search(
          [startLng, startLat],
          [endLng, endLat],
          (status: string, result: any) => {
            if (settled) return;
            clearTimeout(timeout);
            if (status === 'complete' && result.routes && result.routes.length > 0) {
              const route = result.routes[0];
              const path = extractAmapPath(route);
              if (path.length < 3) {
                fail('高德返回路径点不足，疑似 no_data 或建筑内部点位', result);
                return;
              }
              if (isPathStraight(path)) {
                fail('高德返回近似直线，未获得有效道路几何', result);
                return;
              }
              const distanceMeters = Number(route.distance) || calculatePathDistanceMeters(path);
              const durationMinutes = Math.max(1, Math.round((Number(route.time) ? Number(route.time) / 60 : distanceMeters / 75)));
              
              const parsedSteps = (route.steps || []).map((step: any) => ({
                instruction: step.instruction || '',
                action: step.action || '',
                orientation: step.orientation || '',
                distance: Number(step.distance) || 0,
                road: step.road || '',
                path: (step.path || []).map((p: any) => [Number(p.lng), Number(p.lat)] as [number, number])
              }));

              settled = true;
              resolve({
                success: true,
                path,
                distanceMeters,
                durationMinutes,
                message: '高德步行路线',
                steps: parsedSteps,
              });
            } else {
              fail(`status=${status || 'unknown'}，info=${result?.info || result?.message || 'no result'}`, result);
            }
          }
        );
      } catch (e) {
        fail('高德 Walking 调用异常', e);
      }
    });
  };

  const planStableSegment = async (start: CampusSpot, end: CampusSpot): Promise<SegmentPlan> => {
    await loadAmapSdk().catch(error => {
      console.warn('[MapPage] AMap SDK 等待失败，准备进入校园内置路线', error);
    });

    const walking = await queryWalkingPath(start, end);
    if (walking.success && walking.path.length >= 2) {
      return {
        path: walking.path,
        distance: walking.distanceMeters,
        minute: walking.durationMinutes,
        planner: 'amap-walking',
        label: routeLabelMap['amap-walking'],
        message: walking.message,
        steps: walking.steps,
      };
    }

    const campusPlan = planCampusRoute(toRouteEndpoint(start), toRouteEndpoint(end), spots);
    if (campusPlan.success && campusPlan.pathPoints.length >= 2) {
      console.warn('[MapPage] 已从高德切换到校园可信路网', {
        reason: walking.failureReason,
        planner: campusPlan.planner,
        nodeNames: campusPlan.nodeNames,
      });
      return {
        path: campusPlan.pathPoints,
        distance: campusPlan.distanceMeters,
        minute: campusPlan.durationMinutes,
        planner: campusPlan.planner,
        label: routeLabelMap[campusPlan.planner],
        message: campusPlan.message,
        failureReason: walking.failureReason,
      };
    }

    const fallbackPath = generateFallbackPolyline(toRouteEndpoint(start), toRouteEndpoint(end));
    const distance = calculatePathDistanceMeters(fallbackPath);
    console.warn('[MapPage] 校园内置规划也失败，使用多段折线兜底', {
      walkingReason: walking.failureReason,
      campusMessage: campusPlan.message,
    });
    return {
      path: fallbackPath,
      distance,
      minute: Math.max(1, Math.round(distance / 75)),
      planner: 'direction-guide',
      label: routeLabelMap['direction-guide'],
      message: '未获得可用道路路线，当前仅提供方向指引。',
      failureReason: `${walking.failureReason || '高德失败'}；${campusPlan.message}`,
    };
  };

  const startNavigationToTargetFromPosition = async (target: CampusSpot, position: LngLatPoint, mode: LocationMode, manualName = '') => {
    const startName = mode === 'demo' ? '演示起点 · 山海大学南门' : mode === 'manual' ? `自选起点 · ${manualName || '已选位置'}` : '当前位置';
    const start: CampusSpot = { ...target, id: -200000 - target.id, spotName: startName, longitude: position[0], latitude: position[1] };
    clearRoute(false);
    setCurrentRoute(null);
    setRouteSpots([start, target]);
    setRouteStart(start);
    setRouteEnd(target);
    setSelectedSpot(null);
    setCurrentStationIndex(0);
    setTargetStationIndex(1);
    setRouteDisplayMode('current-leg');
    setOverlayState('navigation');
    setDrawerState('collapsed');
    setPhase('planning_leg');
    setLegPlanningResult({ status: 'planning' });
    setCurrentInstructionIndex(0);
    setDistanceToInstruction(null);
    setDistanceToTarget(null);
    setArrivalConsecutiveCount(0);
    setArrivalTriggeredStationId(null);
    arrivalTriggeredStationKeyRef.current = null;
    maxProgressDistanceRef.current = 0;
    setCurrentLegProgress(null);
    // Generate unique trip ID for single-point navigation
    if (currentTripIdRef.current) finishTripRuntime(currentTripIdRef.current);
    currentTripIdRef.current = createTripId();
    spokenNavigationKeysRef.current.clear();
    narrationDedup.initTrip(currentTripIdRef.current);

    const result = await planSegmentWithTimeout(start, target);
    const distance = calculatePathDistanceMeters(result.path);
    const summary: RouteSummary = {
      distance,
      minute: Math.max(1, Math.round(distance / 75)),
      planner: result.planner,
      label: result.label,
      message: result.message || '',
      steps: result.planner === 'amap-walking' ? result.steps : undefined,
    };
    setRoutePath(result.path);
    setCurrentLegPath(result.path);
    setLegPlanningResult({ status: result.status, planner: result.planner, message: result.message });
    setRouteSummary(summary);
    syncNavigationSteps(start, target, summary);
    setDistanceToTarget(distance);
    setPhase('navigating_leg');
    spokenNavigationKeysRef.current.clear();
    digitalHuman.startNavigation(`前往${target.spotName}`, [start, target], summary.minute, currentTripIdRef.current);
    digitalHuman.setCurrentStation(0);
    cameraPriorityRef.current = 'navigation';
    if (mode === 'demo') {
      setDemoPosition(position);
      setDemoProgress(0);
      setDemoOffset(0);
      setDemoAuto(true);
    } else {
      setCurrentPosition(position);
      setDemoAuto(false);
    }
    if (mapInstance.current) mapInstance.current.setZoomAndCenter(17, position, false, 300);
    if (result.message) toast.show(result.message);
  };

  const navigateToSpot = async (target: CampusSpot) => {
    if (!mapInstance.current) {
      toast.show('地图尚未加载完成');
      return;
    }
    setSelectedSpot(target);
    setOverlayState('spot');
    const persistedDemoStart = readPersistedDemoStart();
    if (persistedDemoStart) {
      let position: LngLatPoint = persistedDemoStart;
      if (!position || !isValidLngLat(position[0], position[1])) {
        const southGate = findSouthGateSpot(spots);
        position = southGate
          ? [getSpotLngLat(southGate).lng, getSpotLngLat(southGate).lat]
          : [SHANHAI_UNIVERSITY.lng, SHANHAI_UNIVERSITY.lat];
      }
      setLocationMode('demo');
      setLocationStatus('demo');
      setDemoPosition(position);
      await startNavigationToTargetFromPosition(target, position, 'demo');
      return;
    }
    setPhase('locating');
    toast.show('正在准备导航……');
    try {
      const position = await locateRealPosition();
      await startNavigationToTargetFromPosition(target, position, 'real');
    } catch (error) {
      setLocationStatus('error');
      setPhase('error');
      setOverlayState('locationPicker');
      toast.error(getErrorMessage(error, '暂时无法获取当前位置，请重新定位或选择出发点。'));
    }
  };

  const planCustomRoute = async () => {
    if (!routeStart || !routeEnd) {
      toast.show('请选择起点和终点');
      return;
    }
    if (routeStart.id === routeEnd.id) {
      toast.show('起点和终点不能相同');
      return;
    }
    setPhase('planning_leg');
    try {
      clearRoute(false);
      setRouteSpots([routeStart, routeEnd]);
      setCurrentStationIndex(-1);
      setTargetStationIndex(0);
      setRouteDisplayMode('overview');
      setOverlayState('routePreview');
      const result = await planStableSegment(routeStart, routeEnd);
      drawRouteWithArrow(result.path, routeStart, routeEnd, result.planner);
      const summary: RouteSummary = {
        distance: result.distance,
        minute: result.minute,
        planner: result.planner,
        label: result.label,
        message: result.message,
        failureReason: result.failureReason,
        steps: result.planner === 'amap-walking' ? result.steps : undefined,
      };
      setRouteSummary(summary);
      syncNavigationSteps(routeStart, routeEnd, summary);
      setPhase('route_preview');
      setDrawerState('half');
      if (result.planner === 'amap-walking') {
        toast.success(`路线已准备 ${Math.round(result.distance)} 米，约 ${result.minute} 分钟`);
      } else {
        toast.show(`未获得道路路线，已使用${result.label}`);
      }
    } catch (error) {
      setPhase('error');
      toast.error(getErrorMessage(error, '路线准备失败，请稍后重试'));
    }
  };

  const swapRouteEndpoints = () => {
    setRouteStart(routeEnd);
    setRouteEnd(routeStart);
    toast.show('已交换起终点');
  };

  const endRouteMode = () => {
    const oldTripId = currentTripIdRef.current;
    clearRoute();
    setCurrentLegPath([]);
    setCurrentRoute(null);
    setRouteSpots([]);
    setRouteStart(null);
    setRouteEnd(null);
    setCurrentStationIndex(-1);
    setTargetStationIndex(0);
    setDrawerState('half');
    setPhase('idle');
    setNavigationSteps([]);

    setOverlayState('none');
    setRouteDisplayMode('overview');
    setTemporaryTarget(null);
    setTemporaryPath([]);
    setShowCompletedFootprint(false);
    setCompletedFootprintPath([]);
    setDemoPosition(null);
    setDemoProgress(0);
    setDemoOffset(0);
    setDemoAuto(false);
    setCurrentLegProgress(null);
    maxProgressDistanceRef.current = 0;
    setLegPlanningResult({ status: 'idle' });
    segmentCacheRef.current.clear();
    planningLockRef.current = false;
    finishTripRuntime(oldTripId);
    toast.show('已退出导航');
  };

  const recordRouteCompletion = async () => {
    if (!currentRoute || session.userMode === 'guest' || completedRouteIdsRef.current.has(currentRoute.id)) return;
    completedRouteIdsRef.current.add(currentRoute.id);
    try {
      await routeApi.completeRoute(session.sessionId, currentRoute.id);
    } catch (error) {
      completedRouteIdsRef.current.delete(currentRoute.id);
      toast.error(getErrorMessage(error, '路线完成记录保存失败'));
    }
  };

  const planNextRouteStation = async () => {
    if (planningLockRef.current) return;
    if (routeSpots.length < 2) { toast.show('当前路线站点不足'); return; }
    if (currentStationIndex >= routeSpots.length - 1) {
      toast.show(phase === 'arrived' ? '请点击完成行程' : '请先确认到达最后一站'); return;
    }
    if (phase !== 'arrived') { toast.warning('请先确认到达当前站'); return; }

    planningLockRef.current = true;
    const previousIndex = currentStationIndex;
    const nextIndex = nextStationOverride ?? previousIndex + 1;
    if (nextIndex > previousIndex + 1) {
      setSkippedStationIndexes(previous => {
        const nextSkipped = new Set(previous);
        for (let index = previousIndex + 1; index < nextIndex; index += 1) nextSkipped.add(index);
        return nextSkipped;
      });
    }
    const start = routeSpots[previousIndex];
    const end = routeSpots[nextIndex];

    // 目标索引只在用户主动点击”前往下一站”后更新；已到达索引保持不变。
    setTargetStationIndex(nextIndex);
    setPhase('planning_leg');
    setOverlayState('none');
    setRouteDisplayMode('current-leg');
    setNextStationOverride(null);
    setRouteStart(start);
    setRouteEnd(end);
    setSelectedSpot(null);
    setLegPlanningResult({ status: 'planning' });
    // Reset arrival tracking for the new station
    setArrivalConsecutiveCount(0);
    setArrivalTriggeredStationId(null);
    arrivalTriggeredStationKeyRef.current = null;
    setDistanceToTarget(null);
    setCurrentInstructionIndex(0);
    setDistanceToInstruction(null);
    maxProgressDistanceRef.current = 0;
    setCurrentLegProgress(null);

    // Replace old currentLegPath — do NOT concat
    setCurrentLegPath([]);

    const result = await planSegmentWithTimeout(start, end);
    setCurrentLegPath(result.path);
    setLegPlanningResult({ status: result.status, planner: result.planner, message: result.message });

    if (result.status !== 'failed') {
      const summary: RouteSummary = {
        distance: calculatePathDistanceMeters(result.path),
        minute: Math.max(1, Math.round(calculatePathDistanceMeters(result.path) / 75)),
        planner: result.planner,
        label: result.label,
        message: result.message || '',
        steps: result.planner === 'amap-walking' ? result.steps : undefined,
      };
      setRouteSummary(summary);
      setPhase('navigating_leg');
      digitalHuman.resumeNavigation();
      setDrawerState('half');
    } else {
      setPhase('error');
    }
    if (result.status === 'fallback' && result.message) {
      toast.show(result.message);
    } else if (result.status !== 'failed') {
      toast.show(`${start.spotName} → ${end.spotName}`);
    }
    planningLockRef.current = false;
  };

  const arriveCurrentRouteStation = () => {
    const target = routeSpots[targetStationIndex];
    if (!target) return;
    const targetKey = getNarrationSpotKey(target);
    if (arrivalTriggeredStationKeyRef.current === targetKey && phase === 'arrived') return;
    arrivalTriggeredStationKeyRef.current = targetKey;
    setArrivalTriggeredStationId(target.id);
    setCurrentStationIndex(targetStationIndex);
    digitalHuman.setCurrentStation(targetStationIndex);
    digitalHuman.arriveAtStation();
    setSelectedSpot(target);
    setPhase('arrived');
    setOverlayState('arrival');
    setAssistantExpanded(false);
    setTemporaryTarget(null);
    setDemoAuto(false);
    setNavigationSteps([]);

    // 自动讲解（去重：同一 trip + spot 只触发一次，sessionStorage 持久化）
      if (navigationVoiceEnabled && digitalHuman.capabilityEnabled('navigationVoice')) {
        void digitalHuman.autoNarrateOnArrival(target, currentTripIdRef.current);
      }
  };

  useEffect(() => {
    if (!['navigating_leg', 'planning_leg'].includes(phase) || locationMode !== 'real' || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition((position) => {
      const point: LngLatPoint = [position.coords.longitude, position.coords.latitude];
      const target = routeSpots[targetStationIndex];
      if (!target) return;
      const targetPoint = getSpotLngLat(target);
      const distance = calculatePathDistanceMeters([point, [targetPoint.lng, targetPoint.lat]]);
      setCurrentPosition(point);
      setLocationAccuracy(position.coords.accuracy);
      setLocationStatus('located');
      setDistanceToTarget(distance);
      setArrivalConsecutiveCount(previous => {
        const next = nextArrivalConsecutiveCount(previous, position.coords.accuracy, distance);
        // Auto-arrive only during active navigation (not during leg planning)
        const targetKey = getNarrationSpotKey(target);
        if (next >= 3 && arrivalTriggeredStationKeyRef.current !== targetKey && phase === 'navigating_leg') {
          arrivalTriggeredStationKeyRef.current = targetKey;
          window.queueMicrotask(() => arriveCurrentRouteStation());
        }
        return next;
      });
    }, () => {
      setLocationStatus('error');
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 3000 });
    return () => navigator.geolocation.clearWatch(watchId);
  }, [phase, locationMode, routeSpots, targetStationIndex]);

  // 将当前位置写入 sessionStorage，供 ChatPage 共享读取
  useEffect(() => {
    if (locationMode === 'real' && currentPosition) {
      try {
        sessionStorage.setItem(LOCATION_MODE_KEY, 'real');
        sessionStorage.setItem(CURRENT_POSITION_KEY, JSON.stringify(currentPosition));
        sessionStorage.setItem(LOCATION_UPDATED_AT_KEY, String(Date.now()));
      } catch { /* ignore */ }
    } else if (locationMode === 'demo' && demoPosition) {
      try {
        sessionStorage.setItem(LOCATION_MODE_KEY, 'demo');
        sessionStorage.setItem(DEMO_POSITION_KEY, JSON.stringify(demoPosition));
        sessionStorage.setItem(LOCATION_UPDATED_AT_KEY, String(Date.now()));
      } catch { /* ignore */ }
    } else if (locationMode === 'manual' && currentPosition) {
      try {
        sessionStorage.setItem(LOCATION_MODE_KEY, 'manual');
        sessionStorage.setItem(MANUAL_START_KEY, JSON.stringify(currentPosition));
        sessionStorage.setItem(LOCATION_UPDATED_AT_KEY, String(Date.now()));
      } catch { /* ignore */ }
    }
  }, [currentPosition, demoPosition, locationMode]);

  useEffect(() => {
    if (!['navigating_leg', 'paused', 'arrived'].includes(phase) || currentLegPath.length < 2) {
      setCurrentLegProgress(null);
      return;
    }
    const navigationPosition = locationMode === 'demo' ? demoPosition : currentPosition;
    if (!navigationPosition) return;

    const legKey = `${currentStationIndex}->${targetStationIndex}:${currentLegPath[0]?.join(',')}:${currentLegPath[currentLegPath.length - 1]?.join(',')}`;
    if (currentLegKeyRef.current !== legKey) {
      currentLegKeyRef.current = legKey;
      maxProgressDistanceRef.current = 0;
      setCurrentLegProgress(null);
    }

    const { total } = pathMetrics(currentLegPath);
    const preferredDistanceMeter = locationMode === 'demo'
      ? Math.max(0, Math.min(demoProgress, total))
      : maxProgressDistanceRef.current;
    const projected = projectPositionToPath(currentLegPath, navigationPosition, {
      preferredDistanceMeter,
      searchWindowMeter: locationMode === 'demo' ? 180 : 140,
      maxSnapDistanceMeter: locationMode === 'demo' ? 120 : 70,
    });

    let progressDistanceMeter = projected.progressDistanceMeter;
    if (locationMode === 'demo') {
      progressDistanceMeter = preferredDistanceMeter;
      maxProgressDistanceRef.current = progressDistanceMeter;
    } else {
      const previousMax = maxProgressDistanceRef.current;
      if (projected.offRouteDistanceMeter > OFF_ROUTE_THRESHOLD_METERS + 25) {
        progressDistanceMeter = previousMax;
      } else if (projected.progressDistanceMeter < previousMax - 20) {
        progressDistanceMeter = projected.progressDistanceMeter;
        maxProgressDistanceRef.current = progressDistanceMeter;
      } else {
        progressDistanceMeter = Math.max(previousMax, projected.progressDistanceMeter);
        maxProgressDistanceRef.current = progressDistanceMeter;
      }
    }

    const split = splitPathAtDistance(currentLegPath, progressDistanceMeter);
    const nextProgress: LegPathProgress = {
      ...projected,
      ...split,
      offRouteDistanceMeter: projected.offRouteDistanceMeter,
    };
    setCurrentLegProgress(nextProgress);
    setDistanceToTarget(nextProgress.remainingDistanceMeter);

    const target = routeSpots[targetStationIndex];
    if (target && phase === 'navigating_leg' && (nextProgress.remainingDistanceMeter <= ARRIVAL_DISTANCE_METERS || nextProgress.progressRatio >= 0.985)) {
      window.queueMicrotask(() => arriveCurrentRouteStation());
    }
  }, [currentLegPath, currentPosition, currentStationIndex, demoPosition, demoProgress, locationMode, phase, routeSpots, targetStationIndex]);

  useEffect(() => {
    if (locationMode !== 'demo' || phase !== 'navigating_leg' || currentLegPath.length < 2) return;
    const { total } = pathMetrics(currentLegPath);
    const clampedProgress = Math.max(0, Math.min(demoProgress, total));
    const position = offsetFromPath(currentLegPath, clampedProgress, demoOffset);
    const remaining = Math.max(0, total - clampedProgress);
    setDemoPosition(position);
    setDistanceToTarget(remaining);

    const steps = routeSummary?.steps || [];
    if (routeSummary?.planner === 'amap-walking' && steps.length > 0) {
      let accumulated = 0;
      let nextIndex = 0;
      let nextDistance = Number(steps[0]?.distance) || 0;
      for (let index = 0; index < steps.length; index += 1) {
        const stepDistance = Number(steps[index]?.distance) || total / Math.max(steps.length, 1);
        if (clampedProgress <= accumulated + stepDistance) {
          nextIndex = index;
          nextDistance = Math.max(0, accumulated + stepDistance - clampedProgress);
          break;
        }
        accumulated += stepDistance;
        nextIndex = index;
        nextDistance = 0;
      }
      setCurrentInstructionIndex(nextIndex);
      setDistanceToInstruction(nextDistance);
    } else {
      setCurrentInstructionIndex(0);
      setDistanceToInstruction(null);
    }

    const target = routeSpots[targetStationIndex];
    if (target && remaining <= ARRIVAL_DISTANCE_METERS && phase === 'navigating_leg') {
      window.queueMicrotask(() => arriveCurrentRouteStation());
    }
  }, [currentLegPath, demoOffset, demoProgress, locationMode, phase, routeSummary, routeSpots, targetStationIndex]);

  useEffect(() => {
    if (locationMode !== 'real' || phase !== 'navigating_leg' || !currentPosition || routeSummary?.planner !== 'amap-walking') return;
    const steps = routeSummary.steps || [];
    if (steps.length === 0) return;
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    steps.forEach((step, index) => {
      (step.path || []).forEach(point => {
        const distance = calculatePathDistanceMeters([currentPosition, point]);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = index;
        }
      });
    });
    setCurrentInstructionIndex(bestIndex);
    const stepEnd = steps[bestIndex]?.path?.[steps[bestIndex].path.length - 1];
    setDistanceToInstruction(stepEnd ? calculatePathDistanceMeters([currentPosition, stepEnd]) : null);
  }, [currentPosition, locationMode, phase, routeSummary]);

  useEffect(() => {
    if (locationMode !== 'demo' || !demoAuto || phase !== 'navigating_leg' || currentLegPath.length < 2) return;
    const { total } = pathMetrics(currentLegPath);
    demoLastFrameRef.current = 0;
    const tick = (now: number) => {
      if (!demoLastFrameRef.current) demoLastFrameRef.current = now;
      const deltaSeconds = Math.min(0.12, (now - demoLastFrameRef.current) / 1000);
      demoLastFrameRef.current = now;
      setDemoProgress(previous => Math.min(total, previous + deltaSeconds * 1.4 * demoSpeed));
      demoFrameRef.current = window.requestAnimationFrame(tick);
    };
    demoFrameRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (demoFrameRef.current) window.cancelAnimationFrame(demoFrameRef.current);
      demoFrameRef.current = 0;
      demoLastFrameRef.current = 0;
    };
  }, [currentLegPath, demoAuto, demoSpeed, locationMode, phase]);

  useEffect(() => {
    if (phase === 'paused' || phase === 'idle' || phase === 'completed' || phase === 'error') {
      speechService.cancel();
      setXiaohaiSpeaking(false);
      setNavigationSubtitle('');
    }
  }, [phase]);

  // Persist navigation voice toggle preference
  useEffect(() => {
    sessionStorage.setItem('shanhai_navigation_voice_enabled', String(navigationVoiceEnabled));
  }, [navigationVoiceEnabled]);

  // One-time init of navigationVoiceEnabled from effectiveConfig.autoRead
  useEffect(() => {
    const saved = sessionStorage.getItem('shanhai_navigation_voice_enabled');
    if (saved === null) {
      setNavigationVoiceEnabled(digitalHuman.effectiveConfig.autoRead);
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When user toggles voice off or admin disables voice during navigation, cancel current speech
  useEffect(() => {
    if ((!navigationVoiceEnabled || !digitalHuman.capabilityEnabled('voiceRead') || !digitalHuman.capabilityEnabled('navigationVoice')) && ['navigating_leg', 'paused', 'arrived'].includes(phase)) {
      speechService.cancel();
      setXiaohaiSpeaking(false);
      setNavigationSubtitle('');
    }
  }, [digitalHuman, navigationVoiceEnabled, phase]);

  useEffect(() => {
    if (phase !== 'navigating_leg' || !routeSummary) return;
    const steps = routeSummary.steps || [];
    const currentStep = steps[currentInstructionIndex];
    const walkingText = routeSummary.planner === 'amap-walking'
      ? formatWalkingInstruction(currentStep, digitalHuman.effectiveConfig.seniorMode)
      : '';
    const baseText = walkingText || fallbackInstructionText(routeSummary.planner, distanceToTarget ?? routeSummary.distance, digitalHuman.effectiveConfig.seniorMode);
    const startKey = `start:${targetStationIndex}:${routeEnd?.id || 'target'}`;
    const prefix = spokenNavigationKeysRef.current.has(startKey)
      ? ''
      : currentStationIndex >= 0
        ? `继续下一站，前往${routeEnd?.spotName || '目标点'}。`
        : `开始导航，前往${routeEnd?.spotName || '目标点'}。`;
    if (prefix) spokenNavigationKeysRef.current.add(startKey);
    const key = routeSummary.planner === 'amap-walking'
      ? `nav:${targetStationIndex}:${currentInstructionIndex}:${baseText}`
      : `nav:${targetStationIndex}:fallback:${routeSummary.planner}`;
    speakNavigationText(key, `${prefix}${baseText}`, 'navigation_turn');
  }, [currentInstructionIndex, currentStationIndex, digitalHuman.effectiveConfig.seniorMode, distanceToTarget, phase, routeEnd?.id, routeEnd?.spotName, routeSummary, targetStationIndex]);

  useEffect(() => {
    if (phase !== 'navigating_leg' || routeSummary?.planner !== 'amap-walking') return;
    const step = routeSummary.steps?.[currentInstructionIndex];
    const text = formatWalkingInstruction(step, digitalHuman.effectiveConfig.seniorMode);
    if (!text || distanceToInstruction === null) return;
    // Distance buckets for dedup — prevents GPS jitter repeat
    const dist = Math.round(distanceToInstruction);
    const bucket = navigationDistanceBucket(dist, digitalHuman.effectiveConfig.navigationPromptFrequency);
    const dedupeKey = `navigation:${currentTripIdRef.current}:${targetStationIndex}:${currentInstructionIndex}:${bucket}`;
    const voiceText = digitalHuman.effectiveConfig.seniorMode
      ? `前方${dist}米，${text}`
      : `前方约${dist}米，${text}`;
    speakNavigationText(dedupeKey, voiceText, 'navigation_turn');
  }, [currentInstructionIndex, digitalHuman.effectiveConfig.navigationPromptFrequency, digitalHuman.effectiveConfig.seniorMode, distanceToInstruction, phase, routeSummary, targetStationIndex]);

  useEffect(() => {
    if (phase !== 'navigating_leg' || !currentLegProgress || currentLegProgress.offRouteDistanceMeter <= OFF_ROUTE_THRESHOLD_METERS) return;
    toast.show('已偏离路线，请回到路线附近');
    speakNavigationText(`off-route:${currentTripIdRef.current}:${targetStationIndex}`, '已偏离路线，请回到路线附近或重新规划。', 'navigation_warning');
  }, [currentLegProgress?.offRouteDistanceMeter, phase, targetStationIndex]);

  // Stable refs for values used inside the effect but that would cause
  // spurious re-runs if included in deps. Updated via separate effects.
  const autoNarrateAmbientRef = useRef(digitalHuman.autoNarrateAmbient);
  autoNarrateAmbientRef.current = digitalHuman.autoNarrateAmbient;
  const capVoiceReadRef = useRef(digitalHuman.capabilityEnabled('voiceRead'));
  capVoiceReadRef.current = digitalHuman.capabilityEnabled('voiceRead');
  const capNavVoiceRef = useRef(digitalHuman.capabilityEnabled('navigationVoice'));
  capNavVoiceRef.current = digitalHuman.capabilityEnabled('navigationVoice');
  const capPointNarrationRef = useRef(digitalHuman.capabilityEnabled('pointNarration'));
  capPointNarrationRef.current = digitalHuman.capabilityEnabled('pointNarration');
  const autoNarrationEnabledRef = useRef(digitalHuman.effectiveConfig.autoNarration);
  autoNarrationEnabledRef.current = digitalHuman.effectiveConfig.autoNarration;

  useEffect(() => {
    if (phase !== 'navigating_leg') return;
    if (!navigationVoiceEnabled || !capVoiceReadRef.current || !capNavVoiceRef.current || !autoNarrationEnabledRef.current || !capPointNarrationRef.current) return;
    const navigationPosition = locationMode === 'demo' ? demoPosition : currentPosition;
    if (!navigationPosition) return;
    if (currentLegProgress && currentLegProgress.offRouteDistanceMeter > OFF_ROUTE_THRESHOLD_METERS) return;
    // Don't auto-narrate ambient spots when close to a turn instruction
    if (routeSummary?.planner === 'amap-walking' && distanceToInstruction !== null && distanceToInstruction <= 30) return;

    const tripId = currentTripIdRef.current;
    if (!tripId) return;
    const target = routeSpots[targetStationIndex];
    const targetKey = target ? getNarrationSpotKey(target) : '';
    const routeSpotKeys = new Set(routeSpots.map(spot => getNarrationSpotKey(spot)));
    const candidate = spots
      .filter(spot => {
        const spotKey = getNarrationSpotKey(spot);
        return spotKey !== targetKey && !routeSpotKeys.has(spotKey) && !narrationDedup.isNarrated(tripId, spot);
      })
      .map(spot => {
        const point = getSpotLngLat(spot);
        return { spot, distance: calculatePathDistanceMeters([navigationPosition, [point.lng, point.lat]]) };
      })
      .filter(item => item.distance <= 50)
      .sort((a, b) => a.distance - b.distance)[0];

    if (!candidate) return;

    // Ref-based guard: prevent the same spot from being dispatched twice
    // before the dedup module is updated (handles React batching edge cases).
    const candidateKey = `${tripId}:${getNarrationSpotKey(candidate.spot)}`;
    if (pendingAmbientNarrationRef.current === candidateKey) return;
    pendingAmbientNarrationRef.current = candidateKey;

    void autoNarrateAmbientRef.current(candidate.spot, tripId);
    // Reset pending guard after a short delay so the spot can be re-considered
    // if the narration fails and the in-flight lock is released.
    window.setTimeout(() => {
      if (pendingAmbientNarrationRef.current === candidateKey) {
        pendingAmbientNarrationRef.current = null;
      }
    }, 5000);
  }, [currentLegProgress, currentPosition, demoPosition, distanceToInstruction, locationMode, navigationVoiceEnabled, phase, routeSpots, routeSummary?.planner, spots, targetStationIndex]);

  // Arrival / completion speech — only fires when autoArrivalNarration is
  // disabled (autoNarrateOnArrival handles speech when enabled).
  useEffect(() => {
    if (!digitalHuman.capabilityEnabled('autoArrivalNarration') || !digitalHuman.effectiveConfig.autoNarration) {
      if (phase === 'arrived') {
        const spot = routeSpots[currentStationIndex];
        if (!spot) return;
        const key = `arrived:${currentTripIdRef.current}:${getNarrationSpotKey(spot)}`;
        speakNavigationText(key, digitalHuman.effectiveConfig.seniorMode ? `到达${spot.spotName}` : `已到达${spot.spotName}`, 'arrival');
      }
    }
    if (phase === 'completed') {
      speakNavigationText(`completed:${currentTripIdRef.current}`, digitalHuman.effectiveConfig.seniorMode ? '行程完成' : '行程已完成', 'arrival');
    }
  }, [currentStationIndex, digitalHuman.effectiveConfig.seniorMode, phase, routeSpots, digitalHuman]);

  const completeCurrentRoute = async () => {
    if (!canCompleteTrip(currentStationIndex, routeSpots.length, phase)) {
      toast.warning('请先到达最后一站');
      return;
    }
    if (completingTripRef.current) return;
    const footprint = routePath.length >= 2 ? routePath : currentLegPath;
    const tripId = currentTripIdRef.current;
    if (!tripId) {
      toast.error('当前行程状态异常，请重新开始导航后再完成');
      return;
    }

    const distanceMeter = Math.round(routeSummary?.distance || calculatePathDistanceMeters(footprint));
    const durationMinute = routeSummary?.minute || Math.round((routePath.length >= 2 ? calculatePathDistanceMeters(routePath) : calculatePathDistanceMeters(currentLegPath)) / 75);
    const savedKey = completedTripSavedKey(tripId);
    const alreadySaved = completedTripSavedRef.current.has(tripId) || sessionStorage.getItem(savedKey) === 'true';
    completingTripRef.current = true;
    if (!alreadySaved && session.userMode !== 'guest') {
      completedTripSavedRef.current.add(tripId);
      try {
        const routeName = currentRoute?.routeName || routeSpots.map(s => s.spotName).join(' → ');
        const checkinDesc = `tripId=${tripId}; ${distanceMeter}米; ${durationMinute}分钟; ${routeName}`;
        await checkinApi.checkin(session.sessionId, undefined, currentRoute?.id, 2, checkinDesc);
        sessionStorage.setItem(savedKey, 'true');
        if (currentRoute?.id) {
          await recordRouteCompletion();
        }
      } catch (error) {
        completedTripSavedRef.current.delete(tripId);
        sessionStorage.removeItem(savedKey);
        completingTripRef.current = false;
        toast.error(getErrorMessage(error, '历史行程保存失败，请稍后重试'));
        return;
      }
    }
    completingTripRef.current = false;
    setCompletedFootprintPath(footprint);
    setShowCompletedFootprint(false);

    // Save trip summary to sessionStorage for jump-to-history (NOT as primary data source)
    const completedTrip = {
      tripId,
      type: 'route' as const,
      routeId: currentRoute?.id,
      routeName: currentRoute?.routeName || routeSpots.map(s => s.spotName).join(' → '),
      completedAt: new Date().toISOString(),
      durationMinute,
      distanceMeter,
      stationCount: routeSpots.length,
      stationNames: routeSpots.map(s => s.spotName),
      footprint: footprint.length >= 2 ? footprint : undefined,
    };
    sessionStorage.setItem('shanhai_latest_completed_trip', JSON.stringify(completedTrip));

    // Fully clear all navigation state
    clearRoute(false);
    setRouteSpots([]);
    setRouteStart(null);
    setRouteEnd(null);
    setCurrentRoute(null);
    setCurrentLegPath([]);
    setCurrentStationIndex(-1);
    setTargetStationIndex(0);
    setSelectedSpot(null);
    setDistanceToTarget(null);
    setCurrentInstructionIndex(0);
    setDistanceToInstruction(null);
    setDemoAuto(false);
    setDemoPosition(null);
    setDemoProgress(0);
    setDemoOffset(0);
    setCurrentLegProgress(null);
    maxProgressDistanceRef.current = 0;
    setTemporaryTarget(null);
    setTemporaryPath([]);
    setLegPlanningResult({ status: 'idle' });
    setNavigationSubtitle('');
    finishTripRuntime(tripId);

    setPhase('completed');
    setOverlayState('completion');
    toast.success('路线已完成');
  };

  const skipCurrentRouteStation = () => {
    if (targetStationIndex >= routeSpots.length - 1) return;
    const nextIndex = targetStationIndex + 1;
    setTargetStationIndex(nextIndex);
    setPhase('planning_leg');
    setOverlayState('none');
    focusSpot(routeSpots[nextIndex]);
    if (currentPosition) void planLegFromPosition(currentPosition, nextIndex);
  };

  const startTemporaryPointNavigation = async (spot: CampusSpot) => {
    const start = routeSpots[Math.max(currentStationIndex, 0)];
    if (!start || start.id === spot.id) return;
    routePathBeforeTemporaryRef.current = routePath;
    setTemporaryTarget(spot);
    setTemporaryArrived(false);
    setOverlayState('none');
    setDrawerState('collapsed');
    setPhase('temporary_navigation');
    setRouteDisplayMode('current-leg');
    digitalHuman.pauseNavigation();
    try {
      const segment = await planStableSegment(start, spot);
      setTemporaryPath(segment.path);
      setPhase('temporary_navigation');
    } catch (error) {
      toast.error(getErrorMessage(error, '临时导航规划失败'));
      setPhase('paused');
    }
  };

  const returnToOriginalRoute = () => {
    setTemporaryTarget(null);
    setTemporaryPath([]);
    setTemporaryArrived(false);
    setRoutePath(routePathBeforeTemporaryRef.current);
    setPhase('paused');
    setOverlayState('none');
    digitalHuman.pauseNavigation();
  };

  const setSpotAsNextStation = async (index: number) => {
    if (index <= currentStationIndex) return;
    if (index > currentStationIndex + 1) {
      const confirmed = await Modal.confirm({ title: '设为下一站？', content: `这会跳过中间 ${index - currentStationIndex - 1} 个点位，被跳过点位不会计为完成。`, confirmText: '确认调整', cancelText: '取消' });
      if (!confirmed) return;
    }
    setNextStationOverride(index);
    clearSelection();
    setRouteDisplayMode('current-leg');
    toast.show(`下一站已设为${routeSpots[index].spotName}`);
  };

  const viewFullRoute = () => {
    if (routeSpots.length > 1) setRouteDisplayMode('overview');
  };

  // @ts-ignore
  const showRouteOverview = () => {
    setRouteDisplayMode('overview');
    setOverlayState('routePreview');
    setAssistantExpanded(false);
    clearSelection();
  };

  const drawRouteWithArrow = (path: LngLatPoint[], startSpot?: CampusSpot, endSpot?: CampusSpot, planner: LegPlanner = 'amap-walking') => {
    if (!mapInstance.current || path.length < 2) return;
    void startSpot;
    void endSpot;
    void planner;
    setRoutePath(path);
  };

  const clearRoute = (resetNavigation: boolean = true) => {
    if (fitRouteFrameRef.current) window.cancelAnimationFrame(fitRouteFrameRef.current);
    setFitRoute(false);
    setRoutePath([]);
    setCurrentLegPath([]);
    setRouteSummary(null);
    setLegPlanningResult({ status: 'idle' });
    planningLockRef.current = false;
    window.clearTimeout(planningTimeoutRef.current);
    setDemoAuto(false);
    setCurrentLegProgress(null);
    maxProgressDistanceRef.current = 0;
    setNavigationSubtitle('');
    speechService.cancel();
    if (resetNavigation) {
      setPhase('idle');
      setNavigationSteps([]);
  
    }
  };

  useEffect(() => {
    if (!mapRef.current) return;
    let disposed = false;

    const slowTimer = window.setTimeout(() => {
      if (!mapInstance.current) toast.show('地图加载较慢，请稍候');
    }, 4000);

    const loadMapWithRetry = async (retryCount: number = 0) => {
      try {
        await loadAmapSdk();
        if (disposed || !mapRef.current) return;

        const map = new AMap.Map(mapRef.current, {
          zoom: 17,
          center: [SHANHAI_UNIVERSITY.lng, SHANHAI_UNIVERSITY.lat],
          features: ['bg', 'road', 'building'],
          showLabel: false,
          mapStyle: 'amap://styles/normal',
          isHotspot: false,
          doubleClickZoom: false,
          labelzIndex: 100,
        });

        mapInstance.current = map;
        setMapObject(map);

      map.on('click', (e: any) => {
        const target = e.target;
        // Only deselect when clicking empty map area, not when clicking markers
        if (!target || !target.getPosition) {
          clearSelection();
          setClickPosition({ lng: e.lnglat.getLng(), lat: e.lnglat.getLat() });
        }
      });

      map.on('dragstart', () => { cameraPriorityRef.current = 'manual'; });
      map.on('zoomstart', () => { cameraPriorityRef.current = 'manual'; });
      map.on('zoomend', () => {
        currentZoomRef.current = map.getZoom();
        updateLabelVisibility();
      });

      loadSpotsFromApi();

      const persistedDemoStart = readPersistedDemoStart();
      if (persistedDemoStart) {
        setLocationMode('demo');
        setLocationStatus('demo');
        setDemoPosition(persistedDemoStart);
      }

      if (routeId) void loadRouteAndNavigate(routeId);

      setMapLoading(false);
      window.clearTimeout(slowTimer);
      setMapError(false);
    } catch (e) {
      if (disposed) return;
      console.error('高德地图加载失败:', e);
      if (retryCount < 3) {
        setTimeout(() => loadMapWithRetry(retryCount + 1), 2000);
        return;
      }
      setMapError(true);
      window.clearTimeout(slowTimer);
      toast.error('地图加载失败，请检查网络或稍后重试');
    }
  };

  loadMapWithRetry();
  return () => {
    disposed = true;
    window.clearTimeout(slowTimer);
    try { mapInstance.current?.destroy(); } catch { /* already destroyed */ }
    mapInstance.current = null;
  };
  }, []);

  const updateLabelVisibility = () => {
    const zoom = currentZoomRef.current;
    markersRef.current.forEach(marker => {
      const extData = marker.getExtData?.() || {};
      const label = extData.label;
      if (!label) return;
      // Show labels when zoomed in (>=16) OR when spot is selected
      const isZoomedIn = zoom >= 16;
      const isSelected = extData.spot?.id === selectedSpot?.id;
      if (isZoomedIn || isSelected) {
        label.show();
        // Highlight selected spot label
        if (isSelected && label.setStyle) {
          label.setStyle({
            fontSize: '12px',
            fontWeight: '700',
            fillColor: spotTypeColors[extData.spot?.spotType] || '#6b7280',
            strokeColor: '#ffffff',
            strokeWidth: 3,
            background: 'rgba(255, 255, 255, 0.95)',
            padding: '3px 7px',
            borderRadius: '4px',
            whiteSpace: 'nowrap',
            shadowColor: 'rgba(0,0,0,0.15)',
            shadowBlur: 4,
            shadowOffsetX: 1,
            shadowOffsetY: 1,
          });
        }
      } else {
        label.hide();
      }
    });
  };

  useEffect(() => {
    if (!mapObject || !selectedSpot) {
      setSelectedSpotScreenPos(null);
      return;
    }
    const update = () => {
      const { lng, lat } = getSpotLngLat(selectedSpot);
      try {
        const pixel = mapObject.lngLatToContainer(new AMap.LngLat(lng, lat));
        const x = typeof pixel.getX === 'function' ? pixel.getX() : pixel.x;
        const y = typeof pixel.getY === 'function' ? pixel.getY() : pixel.y;
        setSelectedSpotScreenPos({ x, y });
      } catch {
        setSelectedSpotScreenPos(null);
      }
    };
    update();
    mapObject.on('mapmove', update);
    mapObject.on('zoomchange', update);
    mapObject.on('moveend', update);
    mapObject.on('zoomend', update);
    return () => {
      mapObject.off('mapmove', update);
      mapObject.off('zoomchange', update);
      mapObject.off('moveend', update);
      mapObject.off('zoomend', update);
    };
  }, [mapObject, selectedSpot]);

  useEffect(() => {
    if (!mapInstance.current || spots.length === 0) return;

    // Clean up old markers and labels from the map
    markersRef.current.forEach(marker => {
      try { mapInstance.current?.remove(marker); } catch (e) { /* ignore */ }
    });
    markersRef.current = [];

    labelsRef.current.forEach(label => {
      try { mapInstance.current?.remove(label); } catch (e) { /* ignore */ }
    });
    labelsRef.current = [];

    // Clean up old cluster — remove its markers from map first
    if (clusterRef.current) {
      try {
        const clusterMarkers = clusterRef.current.getAllMarkers?.() || clusterRef.current.getMarkers?.() || [];
        clusterMarkers.forEach((m: any) => {
          try { m.setMap?.(null); } catch (e) { /* ignore */ }
        });
        clusterRef.current.setMap?.(null);
        clusterRef.current.clearMarkers?.();
      } catch (e) { /* ignore */ }
      clusterRef.current = null;
    }

    const map = mapInstance.current;

    const filteredSpots = spots.filter(spot => {
      const matchesType = activeType === '全部' || spot.spotType === activeType;
      const matchesSearch = !searchValue || spot.spotName.includes(searchValue);
      return matchesType && matchesSearch;
    });

    const markers: any[] = [];

    filteredSpots.forEach((spot, index) => {
      const lng = typeof spot.longitude === 'number' ? spot.longitude : parseFloat(spot.longitude || '119.5607');
      const lat = typeof spot.latitude === 'number' ? spot.latitude : parseFloat(spot.latitude || '39.9344');
      const color = spotTypeColors[spot.spotType] || '#6b7280';

      const routeIndex = routeSpots.findIndex(rs => rs.id === spot.id);
      const isRouteSpot = routeIndex >= 0;
      const isSelected = selectedSpot?.id === spot.id;
      const isStart = routeStart?.id === spot.id;
      const isEnd = routeEnd?.id === spot.id;
      const isLayerSpot = isRouteSpot || (routePath.length > 0 && (isStart || isEnd));
      // CampusRouteLayer exclusively owns every visible route-station marker and label.
      if (isLayerSpot) return;
      const hitSize = 44;
      const size = isSelected ? 30 : 18;
      const borderWidth = isSelected ? 4 : 1;
      const borderColor = isSelected ? '#ffffff' : 'rgba(255,255,255,0.8)';
      const shadow = isSelected ? '0 0 0 6px rgba(26,92,138,0.3), 0 4px 12px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.12)';
      const markerBg = color;

      const markerContent = `
        <div style="
          width: ${hitSize}px;
          height: ${hitSize}px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        ">
        <div style="
          width: ${size}px;
          height: ${size}px;
          border-radius: 50%;
          background: ${markerBg};
          border: ${borderWidth}px solid ${borderColor};
          box-shadow: ${shadow};
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
        ">
          <div style="width:3px;height:3px;border-radius:50%;background:rgba(255,255,255,0.9);"></div>
        </div>
        </div>
      `;

      const marker = new AMap.Marker({
        position: [lng, lat],
        content: markerContent,
        offset: new AMap.Pixel(-hitSize / 2, -hitSize / 2),
        zIndex: 1000 + index,
      });

      const labelOffsetY = (index % 3) * 10 - 10;
      const label = new AMap.Text({
        text: spot.spotName,
        position: [lng, lat],
        offset: new AMap.Pixel(22, labelOffsetY),
        zIndex: 2000 + index,
        style: {
          fontSize: isSelected ? '12px' : '11px',
          fontWeight: isSelected ? '700' : '600',
          fillColor: color,
          strokeColor: '#ffffff',
          strokeWidth: 2,
          background: 'rgba(255, 255, 255, 0.85)',
          padding: '2px 5px',
          borderRadius: '3px',
          whiteSpace: 'nowrap',
          shadowColor: 'rgba(0,0,0,0.1)',
          shadowBlur: 2,
          shadowOffsetX: 1,
          shadowOffsetY: 1,
        },
      });

      // Show labels for all spots when zoomed in (>=16), select-only otherwise
      const showLabel = currentZoomRef.current >= 16 || isSelected;
      if (showLabel) label.show(); else label.hide();

      marker.setExtData({ spot, label, isRouteSpot: false });

      marker.on('click', (e: any) => {
        // Stop propagation to prevent map click handler from firing
        if (e?.stopPropagation) e.stopPropagation();
        if (e?.domEvent?.stopPropagation) (e.domEvent as Event).stopPropagation();
        focusSpot(spot);
      });

      // Double-click: prevent zoom, treat as single click
      marker.on('dblclick', (ev: any) => {
        if (ev?.domEvent?.preventDefault) (ev.domEvent as Event).preventDefault();
        if (ev?.stopPropagation) ev.stopPropagation();
      });

      // IMPORTANT: Don't add marker to map directly — let clusterer manage it,
      // or add manually only if clustering is unavailable.
      markers.push(marker);
      markersRef.current.push(marker);
      labelsRef.current.push(label);
      // Labels are always added to map directly (cluster doesn't manage labels)
      map.add(label);
    });

    // Try to use MarkerClusterer (AMap 2.0 native) or MarkerCluster (legacy plugin).
    // We no longer load MarkerCluster as a global plugin (it hooks map.add()
    // and crashes when Walking plugin adds non-marker overlays like polylines).
    const MarkerClusterCtor = (AMap as any).MarkerClusterer || (AMap as any).MarkerCluster;

    if (markers.length >= 2 && MarkerClusterCtor) {
      try {
        const cluster = new MarkerClusterCtor(map, markers, {
          gridSize: 60,
          maxZoom: 18,
          minClusterSize: 2,
        });

        clusterRef.current = cluster;

        cluster.on('click', () => {
          map.zoomIn();
        });
      } catch (e) {
        console.warn('MarkerClusterer creation failed, falling back to direct marker rendering:', e);
        // Fallback: add markers directly to map
        markers.forEach(m => {
          try { map.add(m); } catch (e2) { /* ignore */ }
        });
      }
    } else {
      // No clustering available — add markers directly to map
      markers.forEach(m => {
        try { map.add(m); } catch (e) { /* ignore */ }
      });
    }

    updateLabelVisibility();
  }, [spots, activeType, searchValue, routeSpots, routePath, selectedSpot?.id, routeStart?.id, routeEnd?.id]);

  const handleAddSpot = async () => {
    if (!newSpotName.trim() || !clickPosition) return;
    
    const newSpot: Omit<CampusSpot, 'id' | 'createTime' | 'updateTime'> = {
      spotName: newSpotName.trim(),
      spotType: newSpotType,
      longitude: clickPosition.lng,
      latitude: clickPosition.lat,
      openTime: '以学校实际安排为准',
      recommendTime: 15,
      spotDesc: newSpotDesc.trim() || newSpotName.trim(),
      spotImage: '',
      suitableMode: 'alumni,fresh,parent,research,senior',
      isEnable: 1,
    };
    
    try {
      const response = await spotApi.createSpot(newSpot);
      const savedSpot = response.data.data;
      
      setSpots(prev => [...prev, savedSpot]);
      setShowAddModal(false);
      setNewSpotName('');
      setNewSpotType('教学场馆');
      setNewSpotDesc('');
      toast.show('点位添加成功');
    } catch (error) {
      console.error('Failed to create spot:', error);
      toast.error(getErrorMessage(error, '点位创建失败'));
    }
  };

  const getDrawerTransform = () => {
    if (showAddModal) return 'translate-y-[20%]';
    if (drawerState === 'full') return 'translate-y-0';
    if (drawerState === 'half') return 'translate-y-[45%]';
    return 'translate-y-[calc(100%-140px)]';
  };

  const phaseLabel: Record<TripPhase, string> = {
    idle: currentRoute ? '路线游览模式' : '浏览点位模式',
    route_preview: '路线预览',
    locating: '正在获取真实位置',
    planning_leg: '正在准备当前路段…',
    navigating_leg: legPlanningResult.planner === 'direction-guide' ? '方向指引中' : '导航中',
    arrived: '已到达当前站',
    paused: '导航已暂停',
    temporary_navigation: '临时导航中',
    completed: '路线已完成',
    error: '需要设置出发点',
  };

  // @ts-ignore
  const currentNavigationStep = navigationSteps[0];
  const layerRouteSpots = useMemo(() => temporaryTarget && routeSpots[Math.max(currentStationIndex, 0)]
    ? [routeSpots[Math.max(currentStationIndex, 0)], temporaryTarget]
    : currentStationIndex === -1 && routeStart && routeSpots[targetStationIndex]
      ? [routeStart, routeSpots[targetStationIndex]]
      : routeSpots.length > 0 ? routeSpots : [routeStart, routeEnd].filter((spot): spot is CampusSpot => Boolean(spot)), [temporaryTarget, routeSpots, currentStationIndex, targetStationIndex, routeStart, routeEnd]);
  const selectedRouteSpotIndex = selectedSpot ? routeSpots.findIndex(spot => spot.id === selectedSpot.id) : -1;
  const currentNextStationIndex = targetStationIndex;
  const layerNextStationIndex = temporaryTarget ? 1 : currentStationIndex === -1 && routeStart ? 1 : currentNextStationIndex;
  const skippedStationList = useMemo(() => Array.from(skippedStationIndexes), [skippedStationIndexes]);
  const isNavigationActive = routeSpots.length > 0 && !['idle', 'route_preview', 'completed', 'error'].includes(phase);
  const mapScene = useMemo<MapScene>(() => {
    if (phase === 'completed') return 'completed';
    if (phase === 'arrived') return 'arrived';
    if (['locating', 'planning_leg', 'navigating_leg', 'paused', 'temporary_navigation'].includes(phase)) return 'navigating';
    if (phase === 'route_preview') return 'route_preview';
    if (selectedSpot) return 'spot_selected';
    return 'browse';
  }, [phase, selectedSpot]);
  const activeOverlay = useMemo<OverlayState>(() => {
    if (overlayState === 'locationPicker') return 'locationPicker';
    if (mapScene === 'completed') return 'completion';
    if (mapScene === 'arrived') return 'arrival';
    if (mapScene === 'navigating') return 'navigation';
    if (mapScene === 'route_preview') return 'routePreview';
    if (mapScene === 'spot_selected') return 'spot';
    return 'none';
  }, [mapScene, overlayState]);

  const displayedPosition = locationMode === 'demo' ? demoPosition : currentPosition;
  const completedCurrentLegPath = currentLegProgress?.completedCurrentLegPath || [];
  const remainingCurrentLegPath = currentLegProgress?.remainingCurrentLegPath || currentLegPath;
  const demoMotionState = useMemo<XiaohaiRouteMotionState>(() => {
    if (xiaohaiSpeaking) return 'speaking';
    if (phase === 'arrived') return 'arrived';
    if (currentLegProgress && currentLegProgress.offRouteDistanceMeter > OFF_ROUTE_THRESHOLD_METERS) return 'off-route';
    if (phase === 'paused' || !demoAuto) return 'idle';
    const step = routeSummary?.steps?.[currentInstructionIndex];
    const instruction = `${step?.instruction || ''}${step?.action || ''}${step?.orientation || ''}`;
    if (distanceToInstruction !== null && distanceToInstruction <= 38) {
      if (instruction.includes('左')) return 'turning-left';
      if (instruction.includes('右')) return 'turning-right';
    }
    return phase === 'navigating_leg' ? 'walking' : 'idle';
  }, [currentInstructionIndex, currentLegProgress, demoAuto, distanceToInstruction, phase, routeSummary?.steps, xiaohaiSpeaking]);
  const assistantBottomOffset = activeOverlay === 'navigation' ? (locationMode === 'demo' ? 260 : 154)
    : activeOverlay === 'arrival' || activeOverlay === 'completion' || activeOverlay === 'locationPicker' ? 236
      : activeOverlay === 'spot' ? 360
        : activeOverlay === 'routePreview' ? 320
          : 108;

  useEffect(() => {
    if (mapScene !== 'navigating' || !displayedPosition || !mapInstance.current) return;
    if (cameraPriorityRef.current === 'manual') return;
    cameraPriorityRef.current = 'navigation';
    mapInstance.current.setZoomAndCenter(17, displayedPosition, false, 300);
  }, [displayedPosition?.[0], displayedPosition?.[1], mapScene]);

  const renderNavigationPanel = () => {
    if (activeOverlay !== 'navigation' || phase === 'idle') return null;
    if (phase === 'locating' || phase === 'planning_leg' || !routeSummary || !routeEnd) {
      return (
        <div className="absolute bottom-[104px] left-3 right-3 z-[82] rounded-3xl bg-white/95 p-4 shadow-xl border border-white backdrop-blur-xl">
          <p className="text-[10px] font-bold text-primary-blue">正在准备导航……</p>
          <h3 className="mt-1 text-base font-extrabold text-slate-900">小海正在为你连接当前路段</h3>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">如果定位失败，会提供重新定位、手动选择起点和演示位置。</p>
        </div>
      );
    }
    
    const steps = routeSummary.steps || [];
    const hasWalkingSteps = routeSummary.planner === 'amap-walking' && steps.length > 0;
    const currentStep = steps[currentInstructionIndex];
    const nextStep = steps[currentInstructionIndex + 1];
    const distText = distanceToTarget !== null ? `${Math.round(distanceToTarget)}米` : '计算中...';
    const currentInstruction = hasWalkingSteps
      ? (formatWalkingInstruction(currentStep, digitalHuman.effectiveConfig.seniorMode) || '沿高德步行路线继续前行')
      : '沿校园方向指引继续前行';
    const nextInstruction = hasWalkingSteps
      ? (nextStep ? `然后 ${formatWalkingInstruction(nextStep, digitalHuman.effectiveConfig.seniorMode) || '继续前行'}` : `目标：${routeEnd.spotName}`)
      : `距离目标约 ${distanceToTarget !== null ? Math.round(distanceToTarget) : Math.round(routeSummary.distance)} 米`;
    const sourceLabel = hasWalkingSteps ? '高德步行 steps' : routeSummary.planner === 'campus-network' ? '校园路网指引' : '校园方向指引';
    
    return (
      <div className={`absolute bottom-[104px] left-3 right-3 z-[82] rounded-3xl bg-white/95 shadow-xl backdrop-blur-xl border border-white p-4 transition-transform duration-300 ${digitalHuman.effectiveConfig.highContrast ? 'contrast-125' : ''} ${digitalHuman.effectiveConfig.largeText ? 'text-[17px]' : ''}`}>
        {/* Voice toggle — top-right corner */}
        <button
          className="absolute top-3 right-3 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-slate-100 active:scale-95 transition-transform z-10"
          aria-label={!digitalHuman.capabilityEnabled('voiceRead') || !digitalHuman.capabilityEnabled('navigationVoice') ? '导航播报不可用' : navigationVoiceEnabled ? '关闭导航播报' : '开启导航播报'}
          title={!digitalHuman.capabilityEnabled('voiceRead') || !digitalHuman.capabilityEnabled('navigationVoice') ? '学校当前未开放导航播报' : navigationVoiceEnabled ? '导航播报已开启' : '导航播报已关闭'}
          onClick={() => {
            const next = !navigationVoiceEnabled;
            setNavigationVoiceEnabled(next);
            if (!next) {
              speechService.cancel();
              setXiaohaiSpeaking(false);
              setNavigationSubtitle('');
              toast.error('导航播报已关闭');
            } else {
              toast.info('导航播报已开启');
              // Speak current instruction immediately on re-enable
              const steps = routeSummary?.steps || [];
              const cs = steps[currentInstructionIndex];
              const hasSteps = routeSummary?.planner === 'amap-walking' && steps.length > 0;
              const currentInstruction = hasSteps
                ? (formatWalkingInstruction(cs, digitalHuman.effectiveConfig.seniorMode) || '沿高德步行路线继续前行')
                : fallbackInstructionText(routeSummary?.planner, distanceToTarget ?? routeSummary?.distance, digitalHuman.effectiveConfig.seniorMode);
              if (currentInstruction) {
                const key = `voice-resume:${currentTripIdRef.current}:${targetStationIndex}:${currentInstructionIndex}`;
                speakNavigationText(key, currentInstruction, 'navigation_turn', true);
              }
            }
          }}
          disabled={!digitalHuman.capabilityEnabled('voiceRead') || !digitalHuman.capabilityEnabled('navigationVoice')}
        >
          {navigationVoiceEnabled && digitalHuman.capabilityEnabled('voiceRead') && digitalHuman.capabilityEnabled('navigationVoice') ? (
            <svg className="w-5 h-5 text-primary-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
            </svg>
          ) : (
            <svg className="w-5 h-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <line x1="23" y1="9" x2="17" y2="15"/>
              <line x1="17" y1="9" x2="23" y2="15"/>
            </svg>
          )}
        </button>
        {(!digitalHuman.capabilityEnabled('voiceRead') || !digitalHuman.capabilityEnabled('navigationVoice')) && (
          <p className="absolute top-4 right-[52px] text-[9px] text-slate-400 bg-slate-50 rounded-full px-2 py-0.5 z-10">学校当前未开放导航播报</p>
        )}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg text-primary-blue truncate leading-tight">
              {currentInstruction}
            </h3>
            <p className="text-sm font-medium text-slate-600 truncate mt-1">
              {nextInstruction}
            </p>
          </div>
          <div className="text-right shrink-0 pt-7">
            <p className="text-2xl font-extrabold text-slate-800 leading-none">{distText}</p>
            <p className="text-[10px] text-slate-500 font-bold mt-1">
              约 {Math.max(1, Math.round((distanceToTarget || 0) / 75))} 分钟
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] font-bold">
          <div className="rounded-xl bg-slate-50 p-2">
            <p className="text-slate-400">下一动作</p>
            <p className="mt-0.5 text-slate-700">{distanceToInstruction !== null ? `${Math.round(distanceToInstruction)}米` : hasWalkingSteps ? '计算中' : '方向指引'}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-2">
            <p className="text-slate-400">当前目标</p>
            <p className="mt-0.5 text-slate-700">{distText}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-2">
            <p className="text-slate-400">来源</p>
            <p className="mt-0.5 text-slate-700">{sourceLabel}</p>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button 
            className="flex-[2] bg-primary-blue text-white rounded-xl py-3 text-sm font-bold active:scale-95 transition-transform shadow-md shadow-primary-blue/30"
            onClick={() => {
              if (phase === 'paused') { setPhase('navigating_leg'); digitalHuman.resumeNavigation(); }
              else { setPhase('paused'); digitalHuman.pauseNavigation(); }
            }}
          >
            {phase === 'paused' ? '继续导航' : '暂停'}
          </button>
          
          <button 
            className={`flex-1 rounded-xl py-3 text-xs font-bold active:scale-95 transition-transform ${routeDisplayMode === 'overview' ? 'bg-blue-50 text-primary-blue border border-blue-200' : 'bg-slate-100 text-slate-600'}`}
            onClick={() => setRouteDisplayMode(prev => prev === 'overview' ? 'current-leg' : 'overview')}
          >
            {routeDisplayMode === 'overview' ? '返回当前段' : '查看全程'}
          </button>

          <div className="relative" ref={moreMenuAnchorRef}>
            <button
              className="min-h-[44px] px-4 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold active:scale-95 transition-transform"
              onClick={() => {
                // Close demo controls before opening more menu
                setDemoControlsCollapsed(true);
                setAssistantExpanded(false);
                setShowNavigationMore(prev => !prev);
              }}
            >
              更多
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Detect round-trip: first and last spot have same id
  const isRoundTrip = useMemo(() => {
    if (routeSpots.length < 3) return false;
    return routeSpots[0]?.id === routeSpots[routeSpots.length - 1]?.id;
  }, [routeSpots]);

  // Build per-segment metadata for direction display
  const routeSegmentPaths = useMemo(() => {
    if (routeSpots.length < 2) return [];
    interface SegmentPathEntry {
      fromSpotId: number; toSpotId: number; segmentIndex: number;
      path: Array<[number, number]>; direction: 'outbound' | 'return';
      planner: import('../utils/tripNavigation').LegPlanner | 'fallback-polyline';
    }
    const segments: SegmentPathEntry[] = [];
    for (let i = 0; i < routeSpots.length - 1; i++) {
      const fromId = routeSpots[i].id;
      const toId = routeSpots[i + 1].id;
      const isReturn = isRoundTrip && i > 0 && fromId > toId;
      // Try to get path from cache
      const cacheKey = segmentCacheKey(fromId, toId);
      const cached = segmentCacheRef.current.get(cacheKey);
      const posA = getSpotLngLat(routeSpots[i]);
      const posB = getSpotLngLat(routeSpots[i + 1]);
      const path: Array<[number, number]> = cached?.path
        ? cached.path.map(p => [p[0], p[1]] as [number, number])
        : [[posA.lng, posA.lat] as [number, number], [posB.lng, posB.lat] as [number, number]];
      segments.push({
        fromSpotId: fromId, toSpotId: toId, segmentIndex: i,
        path: path.length >= 2 ? path : [[Number(routeSpots[i].longitude), Number(routeSpots[i].latitude)], [Number(routeSpots[i + 1].longitude), Number(routeSpots[i + 1].latitude)]],
        direction: isReturn ? 'return' : 'outbound',
        planner: cached?.planner || 'direction-guide',
      });
    }
    return segments;
  }, [routeSpots, isRoundTrip, routeGeometryVersion]);



  return (
    <div className="h-[100dvh] w-full bg-bg-light flex flex-col relative overflow-hidden">
      {/* Floating Header & Search */}
      <div className="absolute top-0 left-0 right-0 z-20 pt-4 px-4 pb-2 bg-gradient-to-b from-white/90 via-white/70 to-transparent pointer-events-none">
        <div className="flex items-center gap-3 mb-3 pointer-events-auto">
          <button 
            className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-md shadow-sm flex items-center justify-center text-text-sec active:scale-95 transition-transform"
            onClick={onBack}
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
          <div className="flex-1">
            {isNavigationActive ? (
              <div className="h-10 rounded-full bg-white/90 px-4 shadow-sm flex items-center">
                <span className="truncate text-sm font-bold text-slate-800">{currentRoute?.routeName || digitalHuman.navigation?.routeName || '校园路线'} · 目标第 {Math.max(targetStationIndex + 1, 1)}/{routeSpots.length} 站</span>
              </div>
            ) : (
            <div className="relative glass-card bg-white/90 rounded-full flex items-center px-4 h-10">
              <svg className="text-text-sec w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                className="w-full bg-transparent border-none outline-none ml-2 text-sm text-text-dark placeholder:text-text-sec"
                placeholder="搜索点位、设施、活动..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
              />
            </div>
            )}
          </div>
        </div>
        
        {/* Floating Filter Tabs */}
        {!isNavigationActive && <div className="flex gap-2 overflow-x-auto no-scrollbar pointer-events-auto pb-2">
          {['全部', '教学场馆', '宿舍生活区', '餐饮美食', '便民服务', '运动场地', '绿化景观'].map(type => (
            <button
              key={type}
              className={`flex-none px-4 py-1.5 rounded-full text-[11px] font-medium transition-all shadow-sm ${
                activeType === type
                  ? 'bg-primary-blue text-white'
                  : 'glass-card bg-white/90 text-text-sec'
              }`}
              onClick={() => setActiveType(type)}
            >
              {type}
            </button>
          ))}
        </div>}
        
        {/* Quick Status */}
        <div className="pointer-events-auto mt-1 flex items-center justify-between">
          <div className="bg-white/80 backdrop-blur-md px-3 py-1.5 rounded-full shadow-sm flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${phase === 'navigating_leg' || currentRoute ? 'bg-primary-blue animate-pulse' : phase === 'planning_leg' || phase === 'locating' ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`}></div>
            <span className="text-[10px] font-bold text-slate-700">
              {phaseLabel[phase]}
            </span>
          </div>
          <button onClick={() => setOverlayState('locationPicker')} className="ml-2 bg-white/85 backdrop-blur-md px-3 py-1.5 rounded-full shadow-sm text-left">
            <span className="block text-[9px] font-bold text-slate-400">{modeLabel(session.userMode)}</span>
            <span className="block text-[10px] font-bold text-slate-700">
              {locationStatus === 'located' ? '已定位 · 校园内' : locationMode === 'demo' && locationStatus === 'demo' ? '演示起点 · 山海大学南门' : locationMode === 'manual' && locationStatus === 'manual' ? `自选起点 · ${manualLocationName}` : '未定位 · 点击设置起点'}
            </span>
          </button>
          {!currentRoute && !routeSummary && (
            <div className="bg-white/80 backdrop-blur-md px-3 py-1.5 rounded-full shadow-sm">
              <span className="text-[10px] font-bold text-slate-500">
                当前显示 {filteredSpots.length} 个点位
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 relative bg-slate-100 h-full w-full">
        <div ref={mapRef} className="absolute inset-0 w-full h-full"></div>
        <CampusRouteLayer
          map={mapObject}
          routeSpots={showCompletedFootprint ? [] : layerRouteSpots}
          routePath={showCompletedFootprint ? completedFootprintPath : temporaryTarget ? temporaryPath : routePath}
          currentLegPath={showCompletedFootprint ? [] : temporaryTarget ? temporaryPath : currentLegPath}
          completedCurrentLegPath={showCompletedFootprint || temporaryTarget ? [] : completedCurrentLegPath}
          remainingCurrentLegPath={showCompletedFootprint || temporaryTarget ? [] : remainingCurrentLegPath}
          currentStationIndex={temporaryTarget || currentStationIndex === -1 ? 0 : currentStationIndex}
          nextStationIndex={layerNextStationIndex}
          skippedStationIndexes={temporaryTarget ? undefined : skippedStationList}
          navigationMode={!showCompletedFootprint && phase !== 'route_preview' && phase !== 'idle'}
          displayMode={phase === 'route_preview' ? 'overview' : 'current-leg'}
          showFutureSegments={mapScene === 'navigating' && routeDisplayMode === 'overview'}
          animated={digitalHuman.effectiveConfig.routeAnimationEnabled && digitalHuman.globalConfig.navigationSettings.showRouteAnimation !== false && phase === 'route_preview'}
          showStationNumber
          showMovingIndicator={phase === 'route_preview'}
          fitRoute={fitRoute}
          onStationClick={(spot) => focusSpot(spot)}
          routeSegmentPaths={routeSegmentPaths}
          isRoundTrip={isRoundTrip}
          planner={legPlanningResult.planner || routeSummary?.planner}
          currentPosition={phase !== 'route_preview' && phase !== 'completed' && !showCompletedFootprint ? displayedPosition : null}
          locationAccuracy={locationMode === 'real' ? locationAccuracy : null}
          locationLabel={locationMode === 'demo' ? '演示导航' : locationMode === 'manual' ? '自选起点' : '当前位置'}
          demoMotionState={demoMotionState}
          routeAnimationEnabled={digitalHuman.effectiveConfig.routeAnimationEnabled && digitalHuman.globalConfig.navigationSettings.showRouteAnimation !== false}
          seniorMode={digitalHuman.effectiveConfig.seniorMode}
          variant={showCompletedFootprint ? 'footprint' : 'route'}
        />

        {activeOverlay === 'spot' && selectedSpot && selectedSpotScreenPos && (
          <div
            className="absolute z-[75] flex -translate-x-1/2 -translate-y-full items-center gap-1.5 rounded-2xl bg-white/95 p-1.5 shadow-xl border border-blue-100 backdrop-blur-md"
            style={{ left: selectedSpotScreenPos.x, top: Math.max(84, selectedSpotScreenPos.y - 22) }}
          >
            <button
              disabled={!digitalHuman.capabilityEnabled('pointNarration')}
              onClick={() => void digitalHuman.openNarration(selectedSpot)}
              className="min-h-10 rounded-xl bg-blue-50 px-3 text-[11px] font-bold text-primary-blue disabled:opacity-40"
            >
              小海讲解
            </button>
            <button
              disabled={navigationStatus === 'planning'}
              onClick={() => void navigateToSpot(selectedSpot)}
              className="min-h-10 rounded-xl bg-primary-blue px-3 text-[11px] font-bold text-white disabled:opacity-60"
            >
              {navigationStatus === 'planning' ? '正在准备' : '导航到这里'}
            </button>
          </div>
        )}

        {mapLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-20">
            <div className="w-10 h-10 border-4 border-[#1a5c8a]/20 border-t-[#1a5c8a] rounded-full animate-spin"></div>
            <p className="mt-3 text-slate-500 text-sm">正在加载校园地图...</p>
          </div>
        )}

        {!mapLoading && spotLoading && (
          <div className="absolute top-[110px] left-1/2 -translate-x-1/2 bg-white/95 rounded-full px-4 py-2 shadow-lg z-20 text-xs text-slate-600">
            正在加载点位...
          </div>
        )}

        {mapError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 backdrop-blur-md z-20 p-6">
            <svg className="w-16 h-16 text-red-400 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            <p className="text-text-dark font-medium mb-2">地图加载失败</p>
            <p className="text-text-sec text-sm text-center mb-4">请检查网络连接或API密钥配置</p>
            <button onClick={() => window.location.reload()} className="primary-btn px-6 py-2">
              重新加载
            </button>
          </div>
        )}

        {/* Right Toolbar */}
        <div className="absolute right-4 top-[140px] flex flex-col gap-3 z-20">
          <button
            onClick={resetToSouthGate}
            className="w-10 h-10 bg-white/95 text-slate-600 rounded-full shadow-md flex flex-col items-center justify-center active:scale-95 transition-transform"
          >
            <span className="text-[10px] font-bold">南门</span>
          </button>
          <button
            onClick={() => void centerOnCurrentLocation()}
            className="w-10 h-10 bg-white/95 text-primary-blue rounded-full shadow-md flex items-center justify-center active:scale-95 transition-transform"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
          <button
            onClick={() => {
              if (!mapInstance.current) return;
              const fitPoints = getCameraTargets(mapScene, {
                filteredSpots: filteredSpots,
                currentLegPath,
                routePath,
                routeSpots,
                selectedSpot,
                currentPosition,
                demoPosition,
                locationMode,
                completedFootprintPath,
              });
              if (!fitPoints || fitPoints.length === 0) {
                toast.show('当前无可适配点位');
                return;
              }
              if (fitPoints.length === 1) {
                mapInstance.current.setZoomAndCenter(17, fitPoints[0], false, 300);
                toast.show('已聚焦点位');
                return;
              }
              try {
                const lngs = fitPoints.map(p => p[0]);
                const lats = fitPoints.map(p => p[1]);
                const spanLng = Math.max(...lngs) - Math.min(...lngs);
                const spanLat = Math.max(...lats) - Math.min(...lats);
                const padLng = spanLng * 0.15;
                const padLat = spanLat * 0.15;
                const sw = new AMap.LngLat(Math.min(...lngs) - padLng, Math.min(...lats) - padLat);
                const ne = new AMap.LngLat(Math.max(...lngs) + padLng, Math.max(...lats) + padLat);
                mapInstance.current.setBounds(new AMap.Bounds(sw, ne), false, [80, 48, 220, 48], 300);
                toast.show('已适配视野');
              } catch {
                mapInstance.current.setZoomAndCenter(16, fitPoints[0], false, 300);
                toast.show('已适配视野');
              }
            }}
            className="w-10 h-10 bg-white/95 text-slate-600 rounded-full shadow-md flex items-center justify-center active:scale-95 transition-transform"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 14v6h6M20 10V4h-6M10 20H4v-6M14 4h6v6" />
            </svg>
          </button>
          {(routePath.length > 0 || currentRoute) && (
            <button
              onClick={() => {
                clearRoute();
                setRouteSummary(null);
                setCurrentRoute(null);
                setRouteSpots([]);
                setCurrentStationIndex(-1);
                setTargetStationIndex(0);
                const clearingTripId = currentTripIdRef.current;
                finishTripRuntime(clearingTripId);
                toast.show('已清除路线');
              }}
              className="w-10 h-10 bg-white/95 text-red-500 rounded-full shadow-md flex items-center justify-center active:scale-95 transition-transform"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          )}
        </div>

        {/* Legend */}
        <div className="absolute top-[110px] left-4 glass-card bg-white/80 p-2.5 rounded-2xl space-y-2 z-10 hidden sm:block">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#4a7c9b]"></span>
            <span className="text-[10px] font-bold text-text-sec">教学场馆</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#5da668]"></span>
            <span className="text-[10px] font-bold text-text-sec">宿舍生活区</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#d49065]"></span>
            <span className="text-[10px] font-bold text-text-sec">餐饮美食</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#9b7bc0]"></span>
            <span className="text-[10px] font-bold text-text-sec">便民服务</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#c47575]"></span>
            <span className="text-[10px] font-bold text-text-sec">运动场地</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#5ca9a0]"></span>
            <span className="text-[10px] font-bold text-text-sec">绿化景观</span>
          </div>
        </div>


      </div>

      {routeSpots.length > 0 && activeOverlay === 'routePreview' && phase !== 'completed' && (
        <div className="absolute right-4 top-[110px] bottom-[30%] w-[65%] max-w-[280px] glass-card bg-white/90 rounded-2xl shadow-lg p-4 z-10 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm text-primary-blue">{currentRoute?.routeName || '个性化校园路线'}</h3>
              <p className="text-[10px] text-text-sec mt-0.5">{currentRoute?.totalMinute || routeSummary?.minute || 0}分钟 · {routeSpots.length}个点位</p>
            </div>
            <button 
              className="w-8 h-8 flex items-center justify-center bg-slate-100 rounded-full text-text-sec active:scale-90 transition-transform"
              onClick={endRouteMode}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          
          <div className="space-y-3 relative before:absolute before:left-3 before:top-4 before:bottom-4 before:w-[2px] before:bg-slate-100">
            {routeSpots.map((spot, index) => (
              <div 
                key={spot.id}
                className={`relative flex items-start gap-3 p-2 rounded-xl transition-all ${
                  index === targetStationIndex ? 'bg-blue-50/80 shadow-sm' : ''
                }`}
                onClick={() => focusSpot(spot)}
              >
                <div className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold border-2 border-white shadow-sm ${
                  index === targetStationIndex 
                    ? 'bg-primary-blue text-white' 
                    : 'bg-slate-200 text-slate-500'
                }`}>
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className={`text-sm font-medium ${index === targetStationIndex ? 'text-primary-blue' : 'text-text-dark'}`}>
                    {spot.spotName}
                  </p>
                  <p className="text-[10px] text-text-sec mt-0.5">{spot.spotType}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100">
            {routeSummary && (
              <div className="mb-3 grid grid-cols-2 gap-2">
                <div className="col-span-2 bg-white rounded-xl p-2">
                  <p className="text-[10px] text-text-sec">当前导航方式</p>
                  <p className="text-xs font-bold text-slate-800">{routeSummary.label}</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-2">
                  <p className="text-[10px] text-text-sec">路线距离</p>
                  <p className="text-xs font-bold text-primary-blue">{Math.round(routeSummary.distance)} 米</p>
                </div>
                <div className="bg-emerald-50 rounded-xl p-2">
                  <p className="text-[10px] text-text-sec">预计用时</p>
                  <p className="text-xs font-bold text-emerald-600">{routeSummary.minute} 分钟</p>
                </div>
                {routeSummary.failureReason && <p className="col-span-2 text-[10px] text-amber-600 leading-relaxed">{routeSummary.failureReason}</p>}
              </div>
            )}
            <div className="flex items-center gap-1.5 mb-2">
              <svg className="w-3.5 h-3.5 text-primary-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              <span className="text-[11px] font-bold text-text-sec">行走提示</span>
            </div>
            {targetStationIndex < routeSpots.length && (
              <p className="text-[11px] text-text-sec leading-relaxed bg-slate-50 p-2.5 rounded-lg">
                {currentStationIndex === -1
                  ? `从当前位置前往【${routeSpots[targetStationIndex]?.spotName}】`
                  : targetStationIndex < routeSpots.length - 1
                    ? `从【${routeSpots[currentStationIndex]?.spotName}】出发，前往【${routeSpots[targetStationIndex]?.spotName}】`
                    : `前往终点【${routeSpots[targetStationIndex]?.spotName}】`
                }
              </p>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2">
              {phase === 'route_preview' && <button className="col-span-2 bg-primary-blue text-white rounded-xl py-2.5 text-xs font-bold disabled:opacity-50" onClick={startTripNavigation} disabled={navigationInFlightRef.current}>开始游览</button>}
              {(phase === 'planning_leg' || phase === 'locating') && <button className="col-span-2 bg-slate-300 text-slate-500 rounded-xl py-2.5 text-xs font-bold cursor-wait" disabled>正在规划路线…</button>}
            </div>
          </div>
        </div>
      )}

      {(activeOverlay === 'none' || activeOverlay === 'spot') && !isNavigationActive && <div
        className={`absolute left-0 right-0 glass-panel bg-white/85 backdrop-blur-2xl rounded-t-[32px] shadow-[0_-12px_40px_rgba(26,92,138,0.12)] border-t border-white/60 p-5 z-[70] transition-transform duration-300 transform w-full h-[85vh] flex flex-col ${drawerState === 'full' ? 'overflow-y-auto' : 'overflow-hidden'} ${getDrawerTransform()}`}
        style={{ bottom: '0', paddingBottom: 'calc(110px + env(safe-area-inset-bottom))' }}
        onTouchStart={onDrawerTouchStart}
        onTouchMove={onDrawerTouchMove}
        onTouchEnd={onDrawerTouchEnd}
      >
        <div 
          className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-5 cursor-pointer" 
          onClick={() => { setDrawerState(prev => prev === 'full' ? 'half' : prev === 'half' ? 'collapsed' : 'full'); }}
          onTouchStart={onDrawerTouchStart}
          onTouchMove={onDrawerTouchMove}
          onTouchEnd={onDrawerTouchEnd}
        ></div>

        {activeOverlay === 'none' && <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-bold text-base text-text-dark">自定义游览</h3>
              <p className="text-[11px] text-text-sec">默认使用当前位置，也可以手动设置起点和终点</p>
            </div>
            <button className="text-xs text-primary-blue font-bold" onClick={() => setDrawerState('full')}>查看全部点位</button>
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <button className="bg-green-50 rounded-2xl p-3 text-left active:scale-95" onClick={() => routeStart && focusSpot(routeStart)}>
              <p className="text-[10px] text-green-600 font-bold mb-1">起点</p>
              <p className="text-xs font-bold text-slate-800 truncate">{routeStart?.spotName || '请选择起点'}</p>
            </button>
            <button className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 active:scale-90" onClick={swapRouteEndpoints}>⇄</button>
            <button className="bg-red-50 rounded-2xl p-3 text-left active:scale-95" onClick={() => routeEnd && focusSpot(routeEnd)}>
              <p className="text-[10px] text-red-500 font-bold mb-1">终点</p>
              <p className="text-xs font-bold text-slate-800 truncate">{routeEnd?.spotName || '请选择终点'}</p>
            </button>
          </div>
          <button
            disabled={!routeStart || !routeEnd || phase === 'planning_leg' || phase === 'locating'}
            className="mt-3 w-full primary-btn py-3 rounded-2xl disabled:opacity-50"
            onClick={() => {
              if (routeSummary && routeSpots.length > 0 && routeStart?.id === routeSpots[0]?.id && routeEnd?.id === routeSpots[routeSpots.length - 1]?.id) {
                startTripNavigation();
              } else {
                planCustomRoute();
              }
            }}
          >
            {phase === 'planning_leg' || phase === 'locating' ? '正在准备路线...' : 
             (routeSummary && routeSpots.length > 0 && routeStart?.id === routeSpots[0]?.id && routeEnd?.id === routeSpots[routeSpots.length - 1]?.id) ? '开始游览' : 
             routeSummary ? '确认此路线' : '确认此路线'}
          </button>
          {routeSummary && (
            <div className="mt-3 bg-slate-50 rounded-2xl p-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[10px] text-text-sec">路线类型</p>
                  <p className="text-xs font-bold text-slate-800">{routeSummary.label}</p>
                </div>
                <div>
                  <p className="text-[10px] text-text-sec">距离</p>
                  <p className="text-xs font-bold text-primary-blue">{Math.round(routeSummary.distance)} 米</p>
                </div>
                <div>
                  <p className="text-[10px] text-text-sec">时间</p>
                  <p className="text-xs font-bold text-emerald-600">{routeSummary.minute} 分钟</p>
                </div>
              </div>
              <p className="mt-2 text-[11px] text-slate-500 leading-relaxed">{routeSummary.message}</p>
              {routeSummary.failureReason && <p className="mt-1 text-[11px] text-amber-600 leading-relaxed">失败原因：{routeSummary.failureReason}</p>}
              <div className="mt-3 flex gap-2">
                <button className="flex-1 bg-white text-red-500 rounded-xl py-2 text-xs font-bold" onClick={() => clearRoute()}>清除路线</button>
              </div>
            </div>
          )}
        </div>}

        {!selectedSpot && !showAddModal && (
          <div className="flex-1 flex flex-col mt-2 min-h-0">
            <div className="flex justify-between items-center mb-4 shrink-0">
              <h3 className="font-bold text-base text-text-dark">
                {activeType === '全部' ? '校园点位' : activeType} 
                <span className="text-text-sec text-xs font-normal ml-2">({filteredSpots.length})</span>
              </h3>
            </div>
            
            <div className={`flex-1 ${drawerState === 'full' ? 'overflow-y-auto' : 'overflow-hidden'} no-scrollbar pb-6 space-y-3`}>
              {filteredSpots.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-text-sec">
                  <svg className="w-8 h-8 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                  <p className="text-sm">未找到相关点位</p>
                </div>
              ) : (
                filteredSpots.map(spot => (
                  <div 
                    key={spot.id} 
                    className="flex items-start gap-3 p-3 bg-slate-50/80 rounded-xl active:bg-slate-100 transition-colors"
                    onClick={() => {
                      focusSpot(spot);
                    }}
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                      <svg className="w-5 h-5 text-primary-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <h4 className="font-bold text-sm text-text-dark truncate">{spot.spotName}</h4>
                      <p className="text-xs text-text-sec mt-1 truncate">{spot.spotDesc || '暂无详细介绍'}</p>
                    </div>
                    <div className="shrink-0 text-[10px] px-2 py-1 bg-white border border-slate-200 rounded-full text-text-sec">
                      {spot.spotType}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {showAddModal && clickPosition && (
          <div className="pb-4 animate-fade-in">
            <h3 className="font-bold text-lg text-text-dark mb-4">添加新点位</h3>
            <div className="space-y-4">
              <input
                className="w-full bg-slate-100/80 rounded-xl py-3 px-4 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-primary-blue/30 transition-all"
                placeholder="点位名称"
                value={newSpotName}
                onChange={(e) => setNewSpotName(e.target.value)}
              />
              <div>
                <p className="text-xs text-text-sec mb-2">点位类型</p>
                <div className="flex gap-2 flex-wrap">
                  {['教学场馆', '宿舍生活区', '餐饮美食', '便民服务', '运动场地', '绿化景观'].map(type => (
                    <button
                      key={type}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-all ${
                        newSpotType === type
                          ? 'bg-primary-blue text-white shadow-md'
                          : 'bg-white border border-slate-200 text-text-sec'
                      }`}
                      onClick={() => setNewSpotType(type)}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                className="w-full bg-slate-100/80 rounded-xl py-3 px-4 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-primary-blue/30 transition-all"
                placeholder="点位描述（可选）"
                value={newSpotDesc}
                onChange={(e) => setNewSpotDesc(e.target.value)}
                rows={3}
              />
            </div>
            <div className="mt-6 flex gap-3">
              <button className="flex-1 bg-slate-100 text-text-sec py-3 rounded-xl font-bold text-sm active:scale-95 transition-transform" onClick={() => setShowAddModal(false)}>
                取消
              </button>
              <button className="flex-1 primary-btn py-3 rounded-xl" onClick={handleAddSpot}>
                确认添加
              </button>
            </div>
          </div>
        )}
        
        {selectedSpot && (
          <div className="flex flex-col h-full animate-fade-in">
            {/* Header info - visible in all states */}
            <div className="flex justify-between items-start mb-4 shrink-0">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    selectedSpot.spotType === '教学场馆' ? 'bg-[#4a7c9b]/10 text-[#4a7c9b]' :
                    selectedSpot.spotType === '宿舍生活区' ? 'bg-[#5da668]/10 text-[#5da668]' :
                    selectedSpot.spotType === '餐饮美食' ? 'bg-[#d49065]/10 text-[#d49065]' :
                    selectedSpot.spotType === '便民服务' ? 'bg-[#9b7bc0]/10 text-[#9b7bc0]' :
                    selectedSpot.spotType === '运动场地' ? 'bg-[#c47575]/10 text-[#c47575]' : 'bg-[#5ca9a0]/10 text-[#5ca9a0]'
                  }`}>
                    {selectedSpot.spotType}
                  </span>
                </div>
                <h3 className="font-bold text-xl text-text-dark leading-tight">{selectedSpot.spotName}</h3>
              </div>
              <button 
                className="w-8 h-8 flex items-center justify-center bg-slate-100 rounded-full text-slate-400 active:scale-95 shrink-0 ml-2"
                onClick={clearSelection}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Quick Actions & Basic Info - Visible in Half and Full */}
            {drawerState !== 'collapsed' && (
              <div className="shrink-0 flex flex-col gap-3">
              {routeSpots.length > 0 && selectedRouteSpotIndex >= 0 && selectedRouteSpotIndex !== currentStationIndex && (
                  <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-3">
                    <p className="mb-2 text-[10px] font-bold text-primary-blue">路线点位操作</p>
                    <div className="grid grid-cols-3 gap-2 text-[11px] font-bold">
                      <button disabled={!digitalHuman.capabilityEnabled('pointNarration')} onClick={() => void digitalHuman.openNarration(selectedSpot)} className="min-h-10 rounded-xl bg-white text-primary-blue disabled:opacity-40">讲解此点</button>
                      <button onClick={() => void startTemporaryPointNavigation(selectedSpot)} className="min-h-10 rounded-xl bg-white text-primary-blue">临时导航到此点</button>
                      <button onClick={() => void setSpotAsNextStation(selectedRouteSpotIndex)} className="min-h-10 rounded-xl bg-primary-blue text-white">设为下一站</button>
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <button disabled={navigationStatus === 'planning'} onClick={() => navigateToSpot(selectedSpot)} className="flex-[2] primary-btn py-3 rounded-xl shadow-md shadow-primary-blue/20 flex items-center justify-center gap-1.5 disabled:opacity-60 text-sm font-bold active:scale-95 transition-transform">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                    {navigationStatus === 'planning' ? '正在准备导航...' : '导航到这里'}
                  </button>
                  <button className="flex-1 bg-green-50 text-green-600 rounded-xl py-3 text-xs font-bold active:scale-95 transition-transform" onClick={() => { setRouteStart(selectedSpot); toast.show(`已设为起点：${selectedSpot.spotName}`); }}>设为起点</button>
                  <button className="flex-1 bg-red-50 text-red-500 rounded-xl py-3 text-xs font-bold active:scale-95 transition-transform" onClick={() => { setRouteEnd(selectedSpot); toast.show(`已设为终点：${selectedSpot.spotName}`); }}>设为终点</button>
                </div>
                
                {/* AI Buttons */}
                <div className="flex gap-2 mt-1">
                  <button 
                    className="flex-1 bg-blue-50 text-primary-blue border border-blue-100 rounded-xl py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
                    disabled={!digitalHuman.capabilityEnabled('pointNarration')}
                    onClick={() => void digitalHuman.openNarration(selectedSpot)}
                  >
                    <XiaohaiAvatar size={16} status="idle" className="mr-1" /> {digitalHuman.capabilityEnabled('pointNarration') ? 'AI 讲解此点' : '该能力当前由管理员关闭'}
                  </button>
                  <button 
                    className="flex-1 bg-blue-50 text-primary-blue border border-blue-100 rounded-xl py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
                    onClick={() => {
                      requireAuth(session, () => {
                        if (onNavigate) onNavigate({ page: 'chat', initialMessage: `请问怎么去“${selectedSpot.spotName}”？` });
                      });
                    }}
                  >
                    <XiaohaiAvatar size={16} status="thinking" className="mr-1" /> 问小海怎么去
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-lg">
                    <svg className="w-5 h-5 text-primary-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    <div>
                      <p className="text-[9px] text-text-sec">开放时间</p>
                      <p className="text-xs text-text-dark font-bold">{selectedSpot.openTime || '以学校实际安排为准'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-lg">
                    <svg className="w-5 h-5 text-primary-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 22h14"></path><path d="M5 2h14"></path><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"></path><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"></path></svg>
                    <div>
                      <p className="text-[9px] text-text-sec">建议游览</p>
                      <p className="text-xs text-text-dark font-bold">{selectedSpot.recommendTime || 15} 分钟</p>
                    </div>
                  </div>
                </div>

                {drawerState === 'half' && (
                  <button className="w-full py-2 text-xs text-primary-blue font-bold flex items-center justify-center gap-1 mt-2" onClick={() => setDrawerState('full')}>
                    展开完整详情 <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                )}
              </div>
            )}

            {/* Full Details - Visible only in Full state */}
            {drawerState === 'full' && (
              <div className="mt-4 flex-1 overflow-y-auto no-scrollbar pb-6 space-y-4 border-t border-slate-100 pt-4">
                <div className="h-40 w-full rounded-2xl overflow-hidden relative bg-slate-100 mb-4 shrink-0">
                  {resolveImageUrl(selectedSpot.spotImage) ? (
                    <img 
                      src={resolveImageUrl(selectedSpot.spotImage)} 
                      alt={selectedSpot.spotName} 
                      className="w-full h-full object-cover" 
                      onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} 
                    />
                  ) : null}
                  <div className={`w-full h-full absolute inset-0 ${resolveImageUrl(selectedSpot.spotImage) ? 'hidden' : ''}`}>
                    <DefaultSpotCover spotType={selectedSpot.spotType} className="w-full h-full" />
                  </div>
                </div>

                <div className="bg-slate-50/80 rounded-2xl p-4">
                  <h4 className="text-xs font-bold text-text-dark mb-2 flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-primary-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg> 详细介绍
                  </h4>
                  <p className="text-xs text-text-sec leading-relaxed text-justify">
                    {selectedSpot.spotDesc || '暂无详细介绍'}
                  </p>
                </div>

                <div className="flex gap-3">
                  <button className="flex-1 bg-amber-50 text-amber-600 px-4 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95" onClick={toggleSpotFavorite}>
                    <svg className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                    {isFavorite ? '已收藏' : '收藏'}
                  </button>
                  <button className="flex-1 bg-emerald-50 text-emerald-600 px-4 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95" onClick={checkinSpot}>
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    打卡
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>}
      {renderNavigationPanel()}

      {digitalHuman.effectiveConfig.subtitleEnabled && navigationSubtitle && activeOverlay === 'navigation' && (
        <div className="absolute bottom-[252px] left-6 right-6 z-[83] rounded-2xl bg-slate-950/82 px-4 py-3 text-center text-sm font-bold leading-relaxed text-white shadow-xl backdrop-blur-md">
          {navigationSubtitle}
        </div>
      )}

      {activeOverlay === 'navigation' && locationMode === 'demo' && currentLegPath.length >= 2 && (
        <div className="absolute bottom-[300px] left-3 right-3 z-[84] rounded-2xl bg-white/95 p-3 shadow-xl border border-violet-100 backdrop-blur-xl max-h-[30vh] overflow-y-auto">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold text-violet-700">演示控制</p>
              <p className="mt-0.5 text-[10px] text-slate-500">小海头像表示路线演示位置</p>
            </div>
            <button onClick={() => setDemoControlsCollapsed(value => { const next = !value; if (!next) setShowNavigationMore(false); return next; })} className="min-h-[44px] rounded-full bg-slate-100 px-4 text-[10px] font-bold text-slate-600">
              {demoControlsCollapsed ? '展开' : '收起'}
            </button>
          </div>
          {!demoControlsCollapsed && (
            <div className="mt-3 space-y-1.5 text-[10px] font-bold">
              {/* Row 1: Auto/Pause/Speed */}
              <div className="grid grid-cols-4 gap-1.5">
                <button onClick={() => setDemoAuto(value => !value)} className="min-h-[44px] rounded-xl bg-violet-600 text-white">{demoAuto ? '暂停' : '自动前进'}</button>
                <button onClick={() => setDemoAuto(false)} className="min-h-[44px] rounded-xl bg-slate-100 text-slate-700">暂停</button>
                <button onClick={() => setDemoSpeed(1)} className={`min-h-[44px] rounded-xl ${demoSpeed === 1 ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-700'}`}>1×</button>
                <button onClick={() => setDemoSpeed(2)} className={`min-h-[44px] rounded-xl ${demoSpeed === 2 ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-700'}`}>2×</button>
              </div>
              {/* Row 2: Back/Fwd 25m */}
              <div className="grid grid-cols-2 gap-1.5">
                <button onClick={() => setDemoProgress(value => Math.max(0, value - 25))} className="min-h-[44px] rounded-xl bg-slate-100 text-slate-700">后退25米</button>
                <button onClick={() => setDemoProgress(value => value + 25)} className="min-h-[44px] rounded-xl bg-slate-100 text-slate-700">前进25米</button>
              </div>
              {/* Row 3: Left/Right/Reset */}
              <div className="grid grid-cols-3 gap-1.5">
                <button onClick={() => setDemoOffset(value => value - 10)} className="min-h-[44px] rounded-xl bg-slate-100 text-slate-700">左移</button>
                <button onClick={() => setDemoOffset(value => value + 10)} className="min-h-[44px] rounded-xl bg-slate-100 text-slate-700">右移</button>
                <button onClick={() => { setDemoProgress(0); setDemoOffset(0); setDemoAuto(false); }} className="min-h-[44px] rounded-xl bg-slate-100 text-slate-700">重置</button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeOverlay === 'arrival' && phase === 'arrived' && (
        <div className="absolute bottom-[104px] left-3 right-3 z-[86] rounded-3xl bg-white p-4 shadow-2xl"><p className="text-[10px] font-bold text-primary-blue">已到达</p><h3 className="mt-1 text-lg font-extrabold text-slate-900">{routeSpots[currentStationIndex]?.spotName}</h3><div className="mt-3 flex gap-2"><button disabled={!digitalHuman.capabilityEnabled('pointNarration')} onClick={() => void digitalHuman.openNarration(routeSpots[currentStationIndex])} className="flex-1 min-h-11 rounded-xl bg-blue-50 text-xs font-bold text-primary-blue disabled:opacity-40">开始讲解</button>{currentStationIndex === routeSpots.length - 1 ? <button onClick={completeCurrentRoute} className="flex-1 min-h-11 rounded-xl bg-emerald-600 text-xs font-bold text-white">完成行程</button> : <button onClick={planNextRouteStation} className="flex-1 min-h-11 rounded-xl bg-primary-blue text-xs font-bold text-white">继续下一站</button>}<button onClick={() => toast.show('已停留在当前点')} className="min-h-11 rounded-xl bg-slate-100 px-3 text-xs font-bold text-slate-600">暂时停留</button></div></div>
      )}

      {temporaryTarget && temporaryArrived && (
        <div className="absolute bottom-[104px] left-3 right-3 z-[87] rounded-3xl bg-white p-4 shadow-2xl"><p className="text-sm font-extrabold text-slate-900">已到达 {temporaryTarget.spotName}</p><div className="mt-3 grid grid-cols-3 gap-2 text-xs font-bold"><button onClick={returnToOriginalRoute} className="min-h-11 rounded-xl bg-primary-blue text-white">返回原路线</button><button onClick={() => void digitalHuman.openNarration(temporaryTarget)} className="min-h-11 rounded-xl bg-blue-50 text-primary-blue">讲解此点</button><button onClick={endRouteMode} className="min-h-11 rounded-xl bg-red-50 text-red-600">结束行程</button></div></div>
      )}

      {activeOverlay === 'locationPicker' && (
        <div className="absolute bottom-[104px] left-3 right-3 z-[90] max-h-[62vh] overflow-y-auto rounded-3xl bg-white p-4 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-[10px] font-bold text-primary-blue">位置</p><h3 className="mt-1 text-base font-extrabold text-slate-900">设置出发点</h3></div>
            <button onClick={() => setOverlayState('none')} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500">关闭</button>
          </div>
          {locationStatus === 'error' && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs font-medium leading-relaxed text-amber-800">暂时无法获取当前位置，请重新定位或选择出发点。</p>}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={() => void retryLocation()} className="min-h-11 rounded-xl bg-primary-blue text-xs font-bold text-white">重新定位</button>
            <button onClick={() => void useDemoStart()} className="min-h-11 rounded-xl bg-violet-50 text-xs font-bold text-violet-700">使用演示起点</button>
          </div>
          <p className="mt-4 text-[10px] font-bold text-slate-400">手动选择起点</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {spots.slice(0, 8).map(spot => <button key={spot.id} onClick={() => void useManualStart(spot)} className="min-h-10 truncate rounded-xl bg-slate-50 px-3 text-left text-xs font-bold text-slate-700">{spot.spotName}</button>)}
          </div>
          <p className="mt-3 text-[10px] text-slate-400">演示导航会明确使用“演示起点 · 山海大学南门”，不会标记为真实定位。</p>
        </div>
      )}

      {activeOverlay === 'completion' && phase === 'completed' && (
        <div className="absolute bottom-[104px] left-3 right-3 z-[90] rounded-3xl bg-white p-5 text-center shadow-2xl">
          <p className="text-sm font-bold text-emerald-600">行程已完成</p>
          <h3 className="mt-1 text-xl font-extrabold text-slate-900">已到达全部路线站点</h3>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button onClick={endRouteMode} className="min-h-11 rounded-xl bg-primary-blue text-xs font-bold text-white">返回地图</button>
            <button
              onClick={() => {
                const tripJson = sessionStorage.getItem('shanhai_latest_completed_trip');
                if (tripJson) {
                  sessionStorage.setItem('shanhai_profile_subpage', 'history');
                  sessionStorage.setItem('shanhai_profile_back_to', 'map');
                  if (onNavigate) {
                    onNavigate({ page: 'profile' });
                  }
                } else {
                  toast.show('未记录轨迹');
                }
              }}
              className="min-h-11 rounded-xl bg-emerald-50 text-xs font-bold text-emerald-700"
            >
              查看本次足迹
            </button>
          </div>
        </div>
      )}

      {/* Portal-based "更多" menu — renders at document body level to avoid stacking context issues */}
      {showNavigationMore && createPortal(
        <div
          className="fixed inset-0 z-[10000]"
          onClick={() => setShowNavigationMore(false)}
        >
          <div
            className="absolute bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden py-1 w-36"
            style={(() => {
              const anchor = moreMenuAnchorRef.current;
              if (!anchor) return { top: '50%', right: 16 };
              const rect = anchor.getBoundingClientRect();
              const menuH = 188;
              const topSpace = rect.top;
              const bottomSpace = window.innerHeight - rect.bottom;
              const showAbove = bottomSpace < menuH && topSpace > bottomSpace;
              return {
                right: Math.max(12, window.innerWidth - rect.right),
                ...(showAbove
                  ? { bottom: window.innerHeight - rect.top + 8 }
                  : { top: rect.bottom + 8 }),
              };
            })()}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="w-full text-left px-4 py-3 text-xs font-bold text-slate-700 active:bg-slate-50" onClick={() => { setShowNavigationMore(false); planCustomRoute(); }}>重新规划</button>
            <button className="w-full text-left px-4 py-3 text-xs font-bold text-slate-700 active:bg-slate-50" onClick={() => { setShowNavigationMore(false); setOverlayState('locationPicker'); }}>更换目的地</button>
            <button className="w-full text-left px-4 py-3 text-xs font-bold text-slate-700 active:bg-slate-50" onClick={() => { setShowNavigationMore(false); setNextStationOverride(targetStationIndex + 1); setSkippedStationIndexes(prev => new Set(prev).add(targetStationIndex)); arriveCurrentRouteStation(); }}>跳过本站</button>
            <button className="w-full text-left px-4 py-3 text-xs font-bold text-red-500 active:bg-red-50" onClick={() => { setShowNavigationMore(false); exitNavigation(); }}>退出导航</button>
          </div>
        </div>,
        document.body,
      )}

      {/* 浮动数字人导航助手 */}
      <FloatingGuideAssistant
        scene={mapScene}
        currentSpot={selectedSpot}
        onNextStation={planNextRouteStation}
        onSkipStation={skipCurrentRouteStation}
        onReplan={viewFullRoute}
        onAsk={() => onNavigate?.({ page: 'chat', initialMessage: `我正在${currentRoute?.routeName || '校园路线'}，请给我下一步建议` })}
        onViewRoute={viewFullRoute}
        onComplete={completeCurrentRoute}
        expanded={assistantExpanded}
        onExpandedChange={setAssistantExpanded}
        onMore={() => {
          setDemoControlsCollapsed(true);
          setShowNavigationMore(value => !value);
        }}
        onPauseChange={(paused) => setPhase(paused ? 'paused' : 'navigating_leg')}
        onEnd={endRouteMode}
        bottomOffset={assistantBottomOffset}
      />
    </div>
  );
}
