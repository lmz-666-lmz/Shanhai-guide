import { useEffect, useRef } from 'react';
import type { CampusSpot } from '../../types';
import { XIAOHAI_AVATAR_DATA_URI } from '../../utils/xiaohaiAvatarAsset';

declare const AMap: any;

export interface SegmentPathEntry {
  fromSpotId: number;
  toSpotId: number;
  segmentIndex: number;
  path: Array<[number, number]>;
  direction: 'outbound' | 'return';
  planner: 'amap-walking' | 'campus-network' | 'direction-guide' | 'fallback-polyline';
}

export interface CampusRouteLayerProps {
  map: any;
  routeSpots: CampusSpot[];
  routePath?: Array<[number, number]>;
  currentLegPath?: Array<[number, number]>;
  completedCurrentLegPath?: Array<[number, number]>;
  remainingCurrentLegPath?: Array<[number, number]>;
  currentStationIndex?: number;
  navigationMode?: boolean;
  animated?: boolean;
  showStationNumber?: boolean;
  showMovingIndicator?: boolean;
  fitRoute?: boolean;
  onStationClick?: (spot: CampusSpot, index: number) => void;
  displayMode?: 'overview' | 'current-leg';
  showFutureSegments?: boolean;
  variant?: 'route' | 'sequence-preview' | 'footprint';
  previewAvatar?: boolean;
  previewPlaying?: boolean;
  nextStationIndex?: number;
  skippedStationIndexes?: number[];
  /** Per-segment metadata for route direction display */
  routeSegmentPaths?: SegmentPathEntry[];
  isRoundTrip?: boolean;
  planner?: 'amap-walking' | 'campus-network' | 'direction-guide' | 'fallback-polyline';
  currentPosition?: [number, number] | null;
  locationAccuracy?: number | null;
  locationLabel?: string;
  demoMotionState?: 'idle' | 'walking' | 'turning-left' | 'turning-right' | 'off-route' | 'arrived' | 'speaking';
  routeAnimationEnabled?: boolean;
  seniorMode?: boolean;
}

type LayerCleanup = () => void;

const activeLayers = new WeakMap<object, LayerCleanup>();
const EMPTY_STATION_INDEXES: number[] = [];

/* ---------- geometry helpers ---------- */
const VALID_LNG_RANGE = [118, 121] as [number, number];
const VALID_LAT_RANGE = [38, 41] as [number, number];
const METERS_PER_SEC = 6; // walking speed for animation


const isValidCoord = (lng: number, lat: number): boolean =>
  Number.isFinite(lng) && Number.isFinite(lat) &&
  lng > VALID_LNG_RANGE[0] && lng < VALID_LNG_RANGE[1] &&
  lat > VALID_LAT_RANGE[0] && lat < VALID_LAT_RANGE[1];

const safeBounds = (points: Array<[number, number]>): [number, number, number, number] | null => {
  const valid = points.filter(p => isValidCoord(p[0], p[1]));
  if (valid.length < 2) return null;
  const lngs = valid.map(p => p[0]);
  const lats = valid.map(p => p[1]);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const spanLng = maxLng - minLng, spanLat = maxLat - minLat;
  if (spanLng > 0.03 || spanLat > 0.03 || spanLng < 0.00001 || spanLat < 0.00001) return null;
  return [minLng, minLat, maxLng, maxLat];
};

const doFitView = (map: any, points: Array<[number, number]>, padding: number[] = [80, 48, 220, 48]) => {
  const bounds = safeBounds(points);
  if (!bounds || !map) return;
  try {
    const [swLng, swLat, neLng, neLat] = bounds;
    map.setBounds(new AMap.Bounds(new AMap.LngLat(swLng, swLat), new AMap.LngLat(neLng, neLat)), false, padding, 0);
  } catch {
    const midLng = (bounds[0] + bounds[2]) / 2;
    const midLat = (bounds[1] + bounds[3]) / 2;
    map.setZoomAndCenter(16.5, [midLng, midLat]);
  }
};

const validPosition = (spot?: CampusSpot | null): [number, number] | null => {
  if (!spot) return null;
  const lng = Number(spot.longitude);
  const lat = Number(spot.latitude);
  return Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null;
};

const markerPalette = (index: number, current: number, navigationMode: boolean, skipped: Set<number>) => {
  if (!navigationMode) return { background: '#2563eb', ring: '#dbeafe', text: '#fff' };
  if (skipped.has(index)) return { background: '#94a3b8', ring: '#e2e8f0', text: '#fff' };
  if (index < current) return { background: '#16a34a', ring: '#dcfce7', text: '#fff' };
  if (index === current) return { background: '#1d4ed8', ring: '#93c5fd', text: '#fff' };
  if (index === current + 1) return { background: '#f59e0b', ring: '#fef3c7', text: '#fff' };
  return { background: '#fff', ring: '#dbeafe', text: '#64748b' };
};

const haversineMeters = (a: [number, number], b: [number, number]) => {
  const R = 6371000;
  const dLat = (b[1] - a[1]) * Math.PI / 180;
  const dLng = (b[0] - a[0]) * Math.PI / 180;
  const lat1 = a[1] * Math.PI / 180;
  const lat2 = b[1] * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

/** Build cumulative-distance array and total distance in meters */
const cumulativeDistances = (path: Array<[number, number]>): { cumDist: number[]; totalDist: number } => {
  const cumDist: number[] = [0];
  for (let i = 1; i < path.length; i++) {
    cumDist.push(cumDist[i - 1] + haversineMeters(path[i - 1], path[i]));
  }
  return { cumDist, totalDist: cumDist[cumDist.length - 1] || 0 };
};

/** Interpolate position at given distance along path */
const pointAtDistance = (path: Array<[number, number]>, cumDist: number[], totalDist: number, dist: number): [number, number] => {
  if (totalDist <= 0 || path.length < 2) return path[0];
  const clampedDist = ((dist % totalDist) + totalDist) % totalDist;
  // binary search segment
  let lo = 0, hi = cumDist.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (cumDist[mid] <= clampedDist) lo = mid;
    else hi = mid;
  }
  const segDist = cumDist[hi] - cumDist[lo];
  const t = segDist > 0 ? (clampedDist - cumDist[lo]) / segDist : 0;
  return [
    path[lo][0] + (path[hi][0] - path[lo][0]) * t,
    path[lo][1] + (path[hi][1] - path[lo][1]) * t,
  ];
};

const buildPath = (spots: CampusSpot[], routePath?: Array<[number, number]>) => {
  const supplied = (routePath || []).filter(point => Number.isFinite(point?.[0]) && Number.isFinite(point?.[1]));
  if (supplied.length >= 2) return supplied;
  return spots.map(validPosition).filter((point): point is [number, number] => Boolean(point));
};

/** Offset path perpendicularly by ~3 meters for round-trip display */
const offsetPath = (path: Array<[number, number]>, meters: number): Array<[number, number]> => {
  if (path.length < 2) return path;
  const DEG_PER_METER = 1 / 111320;
  return path.map((p, i) => {
    let dx = 0, dy = 0;
    if (i === 0) {
      dx = path[1][0] - p[0]; dy = path[1][1] - p[1];
    } else if (i === path.length - 1) {
      dx = p[0] - path[i - 1][0]; dy = p[1] - path[i - 1][1];
    } else {
      dx = path[i + 1][0] - path[i - 1][0]; dy = path[i + 1][1] - path[i - 1][1];
    }
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    // perpendicular: (-dy, dx) normalized
    const nx = -dy / len, ny = dx / len;
    return [p[0] + nx * meters * DEG_PER_METER, p[1] + ny * meters * DEG_PER_METER] as [number, number];
  });
};

const demoMarkerContent = (
  state: NonNullable<CampusRouteLayerProps['demoMotionState']>,
  motionEnabled: boolean,
  seniorMode: boolean,
) => {
  const motionClass = motionEnabled ? `xh-${state}` : 'xh-static';
  const seniorClass = seniorMode ? 'xh-senior' : '';
  const statusText = state === 'off-route' ? '已偏离路线' : state === 'arrived' ? '已到达' : '演示导航';
  const sideHint = state === 'turning-left' ? '<span class="xh-turn-hint">左转</span>' : state === 'turning-right' ? '<span class="xh-turn-hint">右转</span>' : '';
  return `
    <style>
      .xh-route-wrap{display:flex;align-items:center;gap:5px;white-space:nowrap;pointer-events:none}
      .xh-route-avatar{width:38px;height:38px;border-radius:50%;border:2px solid #fff;box-shadow:0 2px 10px rgba(15,23,42,.22);object-fit:cover;transform-origin:center bottom}
      .xh-route-label{padding:3px 7px;border-radius:999px;background:rgba(255,255,255,.94);color:#1e3a8a;font-size:10px;font-weight:800;box-shadow:0 2px 8px rgba(15,23,42,.14)}
      .xh-turn-hint{padding:3px 7px;border-radius:999px;background:#eff6ff;color:#1d4ed8;font-size:10px;font-weight:800;box-shadow:0 2px 8px rgba(15,23,42,.12)}
      .xh-walking .xh-route-avatar{animation:xhWalk .72s ease-in-out infinite}
      .xh-idle .xh-route-avatar{animation:xhBreathe 2.4s ease-in-out infinite}
      .xh-turning-left .xh-route-avatar{animation:xhLeft .9s ease-in-out infinite}
      .xh-turning-right .xh-route-avatar{animation:xhRight .9s ease-in-out infinite}
      .xh-off-route .xh-route-avatar{animation:xhShake .52s ease-in-out infinite}
      .xh-arrived .xh-route-avatar{animation:xhArrive .72s ease-out 1}
      .xh-speaking .xh-route-avatar{animation:xhSpeak 1.1s ease-in-out infinite}
      .xh-senior .xh-route-avatar{animation-duration:1.8s}
      .xh-static .xh-route-avatar{animation:none}
      @keyframes xhBreathe{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
      @keyframes xhWalk{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-4px) rotate(2deg)}}
      @keyframes xhLeft{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(-8deg)}}
      @keyframes xhRight{0%,100%{transform:rotate(3deg)}50%{transform:rotate(8deg)}}
      @keyframes xhShake{0%,100%{transform:translateX(0)}30%{transform:translateX(-3px)}70%{transform:translateX(3px)}}
      @keyframes xhArrive{0%{transform:translateY(0) scale(1)}45%{transform:translateY(-7px) scale(1.05)}100%{transform:translateY(0) scale(1)}}
      @keyframes xhSpeak{0%,100%{transform:scale(1)}50%{transform:scale(1.045)}}
      @media (prefers-reduced-motion: reduce){.xh-route-avatar{animation:none!important}}
    </style>
    <div aria-label="演示导航 小海位置" class="xh-route-wrap ${motionClass} ${seniorClass}">
      <img src="${XIAOHAI_AVATAR_DATA_URI}" class="xh-route-avatar" alt="小海"/>
      ${sideHint}
      <span class="xh-route-label">${statusText}</span>
    </div>`;
};

const realLocationContent = (label?: string) =>
  `<div aria-label="${label || '当前位置'}" style="display:flex;align-items:center;gap:5px;white-space:nowrap;pointer-events:none"><span style="width:16px;height:16px;border-radius:999px;background:#2563eb;border:3px solid white;box-shadow:0 0 0 5px rgba(37,99,235,.18),0 4px 12px rgba(15,23,42,.2)"></span>${label ? `<span style="padding:3px 7px;border-radius:999px;background:rgba(255,255,255,.94);color:#1e3a8a;font-size:10px;font-weight:700;box-shadow:0 2px 8px rgba(15,23,42,.14)">${label}</span>` : ''}</div>`;

export default function CampusRouteLayer({
  map, routeSpots, routePath, currentLegPath, completedCurrentLegPath, remainingCurrentLegPath,
  currentStationIndex = 0, navigationMode = false, animated = true,
  showStationNumber = true, showMovingIndicator = true, fitRoute = false,
  onStationClick, displayMode = 'overview', showFutureSegments = false,
  variant = 'route', previewAvatar = false, previewPlaying = true, nextStationIndex,
  skippedStationIndexes = EMPTY_STATION_INDEXES,
  routeSegmentPaths, isRoundTrip = false,
  planner = 'amap-walking', currentPosition, locationAccuracy, locationLabel,
  demoMotionState = 'idle', routeAnimationEnabled = true, seniorMode = false,
}: CampusRouteLayerProps) {
  const clickRef = useRef(onStationClick);
  clickRef.current = onStationClick;
  const animFrameRef = useRef(0);
  const userMarkerRef = useRef<any>(null);
  const userAccuracyCircleRef = useRef<any>(null);
  const userMarkerModeRef = useRef('');

  useEffect(() => {
    if (!map || typeof AMap === 'undefined') return;

    const removeLocationOverlays = () => {
      if (userMarkerRef.current) {
        try { map.remove(userMarkerRef.current); } catch { /* ok */ }
        userMarkerRef.current = null;
      }
      if (userAccuracyCircleRef.current) {
        try { map.remove(userAccuracyCircleRef.current); } catch { /* ok */ }
        userAccuracyCircleRef.current = null;
      }
      userMarkerModeRef.current = '';
    };

    if (!currentPosition || !isValidCoord(currentPosition[0], currentPosition[1]) || variant === 'sequence-preview' || variant === 'footprint') {
      removeLocationOverlays();
      return;
    }

    const isDemoLocation = locationLabel === '演示导航';
    const modeKey = isDemoLocation
      ? `demo:${demoMotionState}:${routeAnimationEnabled}:${seniorMode}`
      : `real:${locationLabel || '当前位置'}`;
    const content = isDemoLocation
      ? demoMarkerContent(demoMotionState, routeAnimationEnabled, seniorMode)
      : realLocationContent(locationLabel);
    const offset = isDemoLocation ? new AMap.Pixel(-19, -19) : new AMap.Pixel(-8, -8);

    if (!userMarkerRef.current) {
      userMarkerRef.current = new AMap.Marker({
        position: currentPosition,
        content,
        offset,
        zIndex: 7000,
      });
      map.add(userMarkerRef.current);
      userMarkerModeRef.current = modeKey;
    } else {
      userMarkerRef.current.setPosition(currentPosition);
      if (userMarkerModeRef.current !== modeKey) {
        userMarkerRef.current.setContent(content);
        userMarkerRef.current.setOffset(offset);
        userMarkerModeRef.current = modeKey;
      }
    }

    if (isDemoLocation) {
      if (userAccuracyCircleRef.current) {
        try { map.remove(userAccuracyCircleRef.current); } catch { /* ok */ }
        userAccuracyCircleRef.current = null;
      }
      return;
    }

    const radius = Number(locationAccuracy);
    if (Number.isFinite(radius) && radius > 0) {
      if (!userAccuracyCircleRef.current) {
        userAccuracyCircleRef.current = new AMap.Circle({
          center: currentPosition,
          radius: Math.min(Math.max(radius, 8), 120),
          strokeColor: '#2563eb',
          strokeOpacity: 0.28,
          strokeWeight: 1,
          fillColor: '#60a5fa',
          fillOpacity: 0.12,
          zIndex: 5000,
        });
        map.add(userAccuracyCircleRef.current);
      } else {
        userAccuracyCircleRef.current.setCenter(currentPosition);
        userAccuracyCircleRef.current.setRadius(Math.min(Math.max(radius, 8), 120));
      }
    }
  }, [currentPosition?.[0], currentPosition?.[1], demoMotionState, locationAccuracy, locationLabel, map, routeAnimationEnabled, seniorMode, variant]);

  useEffect(() => () => {
    if (userMarkerRef.current) {
      try { map?.remove(userMarkerRef.current); } catch { /* ok */ }
      userMarkerRef.current = null;
    }
    if (userAccuracyCircleRef.current) {
      try { map?.remove(userAccuracyCircleRef.current); } catch { /* ok */ }
      userAccuracyCircleRef.current = null;
    }
  }, [map]);

  useEffect(() => {
    if (!map || typeof AMap === 'undefined') return;

    // Cancel previous layer
    activeLayers.get(map)?.();
    activeLayers.delete(map);

    const overlays: any[] = [];
    let disposed = false;
    let visibilityHandler: (() => void) | null = null;
    const path = buildPath(routeSpots, routePath);
    const skipped = new Set(skippedStationIndexes);
    const sequencePreview = variant === 'sequence-preview';

    // --- station markers (with round-trip double-label support) ---
    const visitedSpotIds = new Map<number, number[]>(); // spotId → [indexes]
    routeSpots.forEach((spot, index) => {
      const existing = visitedSpotIds.get(spot.id) || [];
      existing.push(index);
      visitedSpotIds.set(spot.id, existing);
    });

    routeSpots.forEach((spot, index) => {
      const position = validPosition(spot);
      if (!position) return;
      const palette = sequencePreview
        ? { background: '#f8fafc', ring: '#cbd5e1', text: '#334155' }
        : markerPalette(index, currentStationIndex, navigationMode, skipped);
      const size = sequencePreview ? 32 : index === currentStationIndex ? 34 : 30;
      const visits = visitedSpotIds.get(spot.id) || [index];
      const labelText = visits.length > 1
        ? visits.map(v => v + 1).join('/')
        : showStationNumber ? String(index + 1) : '';
      const content = `<button aria-label="${sequencePreview ? '顺序预览' : '路线'}第${index + 1}站 ${spot.spotName}" style="width:${size}px;height:${size}px;border-radius:999px;border:3px solid #fff;background:${palette.background};color:${palette.text};box-shadow:0 0 0 4px ${palette.ring},0 4px 12px rgba(15,23,42,.18);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;cursor:pointer">${labelText}</button>`;
      const marker = new AMap.Marker({
        position, content,
        offset: new AMap.Pixel(-size / 2, -size / 2),
        zIndex: 5200 + index,
      });
      marker.on('click', () => clickRef.current?.(spot, index));
      map.add(marker);
      overlays.push(marker);
    });

    // --- segment polylines (unified for overview and current-leg) ---
    if (routeSpots.length >= 2) {
      const targetIndex = Math.min(nextStationIndex ?? currentStationIndex + 1, routeSpots.length - 1);
      const legPath = (currentLegPath && currentLegPath.length >= 2) ? currentLegPath : undefined;
      const addPolyline = (segmentPath: Array<[number, number]>, options: {
        color: string;
        opacity: number;
        weight: number;
        style: string;
        zIndex: number;
        outline?: boolean;
      }) => {
        if (segmentPath.length < 2) return null;
        const polyOpts: any = {
          path: segmentPath,
          strokeColor: options.color,
          strokeOpacity: options.opacity,
          strokeWeight: options.weight,
          strokeStyle: options.style,
          lineJoin: 'round',
          lineCap: 'round',
          zIndex: options.zIndex,
        };
        if (options.outline) {
          polyOpts.isOutline = true;
          polyOpts.outlineColor = '#ffffff';
          polyOpts.borderWeight = 3;
        }
        const poly = new AMap.Polyline(polyOpts);
        map.add(poly);
        overlays.push(poly);
        return poly;
      };
      const addDirectionArrow = (segmentPath: Array<[number, number]>, color: string, zIndex: number, isReturnLeg: boolean) => {
        if (segmentPath.length < 3) return;
        const midIdx = Math.floor(segmentPath.length / 2);
        const arrowPos = segmentPath[midIdx];
        const prevPos = segmentPath[Math.max(0, midIdx - 5)];
        const angle = Math.atan2(arrowPos[1] - prevPos[1], arrowPos[0] - prevPos[0]) * 180 / Math.PI;
        const arrowMarker = new AMap.Marker({
          position: arrowPos,
          content: `<div style="transform:rotate(${angle}deg);font-size:18px;color:${isReturnLeg ? '#7c3aed' : color};opacity:0.9">▶</div>`,
          offset: new AMap.Pixel(-9, -9),
          zIndex: zIndex + 50,
        });
        map.add(arrowMarker);
        overlays.push(arrowMarker);
      };

      for (let index = 0; index < routeSpots.length - 1; index += 1) {
        const from = validPosition(routeSpots[index]);
        const to = validPosition(routeSpots[index + 1]);
        if (!from || !to) continue;

        const segData = routeSegmentPaths?.[index];
        const current = index === currentStationIndex && targetIndex === currentStationIndex + 1;
        const completed = index < currentStationIndex && !skipped.has(index) && !skipped.has(index + 1);
        const future = displayMode === 'current-leg' && !current && !completed;

        // In current-leg mode, future segments stay hidden unless the caller explicitly asks for them.
        if (future && !showFutureSegments) {
          continue;
        }

        // Determine planner for this segment
        let segPlanner = segData?.planner || 'direction-guide';
        let segmentPath = segData?.path || [from, to];

        if (current && legPath) {
          segmentPath = legPath;
          segPlanner = planner || segPlanner;
        }

        const isDirectionGuideFallback = segPlanner === 'direction-guide' || segPlanner === 'fallback-polyline';
        const isReturnLeg = segData?.direction === 'return';

        if (isReturnLeg && segmentPath.length >= 2) {
          segmentPath = offsetPath(segmentPath, 3);
        }

        if (!sequencePreview && displayMode === 'current-leg' && current) {
          const completedPath = (completedCurrentLegPath && completedCurrentLegPath.length >= 2)
            ? (isReturnLeg ? offsetPath(completedCurrentLegPath, 3) : completedCurrentLegPath)
            : [];
          const remainingPath = (remainingCurrentLegPath && remainingCurrentLegPath.length >= 2)
            ? (isReturnLeg ? offsetPath(remainingCurrentLegPath, 3) : remainingCurrentLegPath)
            : segmentPath;
          if (completedPath.length >= 2) {
            addPolyline(completedPath, {
              color: '#16a34a',
              opacity: isDirectionGuideFallback ? 0.76 : 0.86,
              weight: 4,
              style: isDirectionGuideFallback ? 'dashed' : 'solid',
              zIndex: 4260,
              outline: false,
            });
          }
          if (remainingPath.length >= 2) {
            const remainingColor = isDirectionGuideFallback ? '#e5e7eb' : '#2563eb';
            const remainingZ = isDirectionGuideFallback ? 4180 : 4320;
            addPolyline(remainingPath, {
              color: remainingColor,
              opacity: isDirectionGuideFallback ? 0.82 : 0.96,
              weight: isDirectionGuideFallback ? 4 : 7,
              style: isDirectionGuideFallback ? 'dashed' : 'solid',
              zIndex: remainingZ,
              outline: !isDirectionGuideFallback,
            });
            if (!isDirectionGuideFallback) addDirectionArrow(remainingPath, remainingColor, remainingZ, isReturnLeg);
          }
          continue;
        }

        // Styles
        let color = '#2563eb';
        let opacity = 0.9;
        let weight = 6;
        let style = 'solid';
        let isOutline = true;
        let zIndex = 4200;

        if (sequencePreview) {
          // 共创路线顺序预览：蓝色实线，清晰明显
          color = '#2878ff';
          opacity = 0.9;
          weight = 6;
          style = 'solid';
          isOutline = true;
          zIndex = 4150;
        } else if (future) {
          color = '#cbd5e1';
          opacity = 0.66;
          weight = 3;
          style = 'dashed';
          isOutline = false;
          zIndex = 4050;
        } else if (isDirectionGuideFallback) {
          // MapPage 方向指引 fallback：白灰虚线
          color = completed ? '#16a34a' : '#cbd5e1';
          opacity = completed ? 0.76 : 0.75;
          weight = completed ? 4 : 3;
          style = 'dashed';
          isOutline = false;
          zIndex = completed ? 4160 : 4100;
        } else {
          if (displayMode === 'current-leg') {
            if (completed) {
              color = '#16a34a';
              opacity = 0.82;
              weight = 4;
              isOutline = false;
              zIndex = 4100;
            } else if (current) {
              color = '#2563eb';
              opacity = 0.95;
              weight = 7;
              zIndex = 4300;
            }
          } else {
            // Overview mode styles for formal paths
            if (isReturnLeg) {
              color = '#7c3aed';
              style = 'dashed';
            }
          }
        }

        const polyOpts: any = {
          path: segmentPath,
          strokeColor: color,
          strokeOpacity: opacity,
          strokeWeight: weight,
          strokeStyle: style,
          lineJoin: 'round',
          lineCap: 'round',
          zIndex: zIndex,
        };
        
        if (isOutline) {
          polyOpts.isOutline = true;
          polyOpts.outlineColor = '#ffffff';
          polyOpts.borderWeight = 3;
        }

        const poly = new AMap.Polyline(polyOpts);
        map.add(poly); overlays.push(poly);

        // Direction arrow on formal segments
        if (!sequencePreview && !future && !isDirectionGuideFallback && segmentPath.length >= 3 && (current || displayMode === 'overview')) {
          const midIdx = Math.floor(segmentPath.length / 2);
          const arrowPos = segmentPath[midIdx];
          const prevPos = segmentPath[Math.max(0, midIdx - 5)];
          const angle = Math.atan2(arrowPos[1] - prevPos[1], arrowPos[0] - prevPos[0]) * 180 / Math.PI;
          const arrowMarker = new AMap.Marker({
            position: arrowPos,
            content: `<div style="transform:rotate(${angle}deg);font-size:18px;color:${isReturnLeg ? '#7c3aed' : color};opacity:0.9">▶</div>`,
            offset: new AMap.Pixel(-9, -9),
            zIndex: zIndex + 50,
          });
          map.add(arrowMarker); overlays.push(arrowMarker);
        }
      }

      // skip-override segment
      if (displayMode === 'current-leg' && targetIndex > currentStationIndex + 1) {
        const from = validPosition(routeSpots[currentStationIndex]);
        const to = validPosition(routeSpots[targetIndex]);
        if (from && to) {
          const overridePoly = new AMap.Polyline({ 
            path: [from, to], 
            strokeColor: '#cbd5e1', 
            strokeOpacity: 0.75, 
            strokeWeight: 3, 
            strokeStyle: 'dashed',
            lineJoin: 'round', 
            lineCap: 'round', 
            zIndex: 4100 
          });
          map.add(overridePoly); overlays.push(overridePoly);
        }
      }
    } else if (path.length >= 2) {
      const poly = new AMap.Polyline({
        path,
        strokeColor: variant === 'footprint' ? '#16a34a' : '#2563eb',
        strokeOpacity: variant === 'footprint' ? 0.78 : 0.85,
        strokeWeight: variant === 'footprint' ? 4 : 5,
        strokeStyle: 'solid',
        lineJoin: 'round',
        lineCap: 'round',
        zIndex: variant === 'footprint' ? 3900 : 4200,
      });
      map.add(poly);
      overlays.push(poly);
    }

    // --- fit view ---
    if (fitRoute) {
      const fitPoints = displayMode === 'current-leg'
        ? (currentLegPath && currentLegPath.length >= 2 ? currentLegPath : path)
        : path;
      if (fitPoints.length >= 2) {
        const valid = fitPoints.filter(p => isValidCoord(p[0], p[1]));
        if (valid.length >= 2) { doFitView(map, valid); }
        else {
          const ti = Math.min(nextStationIndex ?? currentStationIndex + 1, routeSpots.length - 1);
          const f = validPosition(routeSpots[currentStationIndex]);
          const t = validPosition(routeSpots[ti]);
          if (f && t) doFitView(map, [f, t]);
        }
      }
      else {
        const ti = Math.min(nextStationIndex ?? currentStationIndex + 1, routeSpots.length - 1);
        const f = validPosition(routeSpots[currentStationIndex]);
        const t = validPosition(routeSpots[ti]);
        if (f && t) doFitView(map, [f, t]);
      }
    }

    // --- direction dot animation (rAF + deltaTime + cumulative distance) ---
    let movingMarker: any = null;
    const ti = Math.min(nextStationIndex ?? currentStationIndex + 1, routeSpots.length - 1);
    const hasRealPath = currentLegPath && currentLegPath.length >= 2;
    const animPath: Array<[number, number]> = displayMode === 'current-leg'
      ? (hasRealPath ? currentLegPath : (() => {
          const f = validPosition(routeSpots[currentStationIndex]);
          const t = validPosition(routeSpots[ti]);
          return f && t && ti !== currentStationIndex ? [f, t] : [];
        })())
      : path;
    const isGlobalFallback = planner === 'direction-guide' || planner === 'fallback-polyline';
    const routeAnimationAllowed = !sequencePreview && animated && showMovingIndicator && animPath.length >= 2 && !isGlobalFallback;
    const previewAnimationAllowed = sequencePreview && previewAvatar && previewPlaying && path.length >= 2;
    const animationAllowed = routeAnimationAllowed || previewAnimationAllowed;

    if (animationAllowed) {
      const activeAnimPath = previewAnimationAllowed ? path : animPath;
      const { cumDist, totalDist } = cumulativeDistances(activeAnimPath);
      let startTime = 0;
      let pausedAt = 0;
      let paused = false;

      movingMarker = new AMap.Marker({
        position: activeAnimPath[0],
        content: previewAnimationAllowed
          ? `<div aria-label="路线预览 小海" style="display:flex;align-items:center;gap:4px;white-space:nowrap"><img src="${XIAOHAI_AVATAR_DATA_URI}" width="36" height="36" style="width:36px;height:36px;border-radius:50%;border:2px solid #fff;box-shadow:0 2px 8px rgba(15,23,42,.2);object-fit:cover" alt="小海"/><span style="padding:3px 7px;border-radius:999px;background:rgba(255,255,255,.95);color:#64748b;font-size:10px;font-weight:800;box-shadow:0 2px 8px rgba(15,23,42,.12)">路线预览</span></div>`
          : '<div style="width:10px;height:10px;border-radius:999px;background:rgba(56,189,248,0.7);border:1.5px solid rgba(255,255,255,0.9);box-shadow:0 0 0 3px rgba(56,189,248,0.12)"></div>',
        offset: previewAnimationAllowed ? new AMap.Pixel(-18, -18) : new AMap.Pixel(-5, -5),
        zIndex: 6500,
      });
      map.add(movingMarker);
      overlays.push(movingMarker);

      const cycleDurationMs = (totalDist / METERS_PER_SEC) * 1000;
      // Clamp cycle between 4s and 20s for visual comfort
      void (cycleDurationMs);

      visibilityHandler = () => {
        if (document.visibilityState === 'hidden') {
          if (!paused) { paused = true; pausedAt = performance.now(); }
        } else if (paused) {
          paused = false;
          startTime += performance.now() - pausedAt;
        }
      };
      document.addEventListener('visibilitychange', visibilityHandler);

      const tick = (now: number) => {
        if (disposed || !movingMarker) return;
        if (!startTime) startTime = now;
        if (paused) { animFrameRef.current = requestAnimationFrame(tick); return; }
        const elapsed = now - startTime;
        const progressDist = (elapsed / 1000) * (previewAnimationAllowed ? METERS_PER_SEC * 1.4 : METERS_PER_SEC);
        if (previewAnimationAllowed && progressDist >= totalDist) {
          movingMarker.setPosition(activeAnimPath[activeAnimPath.length - 1]);
          return;
        }
        movingMarker.setPosition(pointAtDistance(activeAnimPath, cumDist, totalDist, progressDist));
        animFrameRef.current = requestAnimationFrame(tick);
      };
      animFrameRef.current = requestAnimationFrame(tick);
    }

    const cleanup = () => {
      disposed = true;
      cancelAnimationFrame(animFrameRef.current);
      if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler);
      overlays.forEach(o => { try { map.remove(o); } catch { /* ok */ } });
      activeLayers.delete(map);
    };

    activeLayers.set(map, cleanup);
    return cleanup;
  }, [map, routeSpots, routePath, currentLegPath, completedCurrentLegPath, remainingCurrentLegPath, currentStationIndex, navigationMode, animated, showStationNumber, showMovingIndicator, fitRoute, displayMode, showFutureSegments, variant, previewAvatar, previewPlaying, nextStationIndex, skippedStationIndexes, routeSegmentPaths, isRoundTrip, planner]);

  return null;
}
