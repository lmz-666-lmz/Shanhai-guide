export type TripPhase =
  | 'idle'
  | 'route_preview'
  | 'locating'
  | 'planning_leg'
  | 'navigating_leg'
  | 'arrived'
  | 'paused'
  | 'temporary_navigation'
  | 'completed'
  | 'error';

export type MapScene =
  | 'browse'
  | 'spot_selected'
  | 'route_preview'
  | 'navigating'
  | 'arrived'
  | 'completed'
  | 'route_editing';

export type MapOverlay =
  | 'none'
  | 'spot'
  | 'routePreview'
  | 'navigation'
  | 'arrival'
  | 'completion'
  | 'locationPicker'
  | 'routeEditor';

export type OverlayState = MapOverlay;

export type DisplayMode = 'overview' | 'current-leg';
export type LocationMode = 'real' | 'manual' | 'demo';
export type LocationStatus = 'idle' | 'locating' | 'located' | 'manual' | 'demo' | 'error';

export type LegPlanner = 'amap-walking' | 'campus-network' | 'direction-guide';

export type LegPlanningResult = {
  status: 'idle' | 'planning' | 'ready' | 'fallback' | 'failed';
  planner?: LegPlanner;
  message?: string;
};

export type NavigationStepInstruction = {
  instruction: string;
  action: string;
  orientation: string;
  distance: number;
  road: string;
  path: Array<[number, number]>;
};

export interface LegPathProgress {
  projectedPosition: [number, number];
  projectedSegmentIndex: number;
  progressDistanceMeter: number;
  remainingDistanceMeter: number;
  progressRatio: number;
  offRouteDistanceMeter: number;
  completedCurrentLegPath: Array<[number, number]>;
  remainingCurrentLegPath: Array<[number, number]>;
}

export type DemoControlAction = 'forward' | 'backward' | 'left' | 'right' | 'auto_forward' | 'pause' | 'reset';

export const ARRIVAL_ACCURACY_METERS = 50;
export const ARRIVAL_DISTANCE_METERS = 30;
export const ARRIVAL_REQUIRED_SAMPLES = 3;

export const nextArrivalConsecutiveCount = (
  previous: number,
  accuracy: number,
  distance: number,
) => accuracy <= ARRIVAL_ACCURACY_METERS && distance <= ARRIVAL_DISTANCE_METERS
  ? previous + 1
  : 0;

export const canCompleteTrip = (
  currentStationIndex: number,
  stationCount: number,
  phase: TripPhase,
) => stationCount > 0
  && currentStationIndex === stationCount - 1
  && phase === 'arrived';

export const deriveTripStartIndexes = (distanceToFirstStation: number, stationCount: number) => {
  if (stationCount <= 0) return { currentStationIndex: -1, targetStationIndex: -1 };
  if (distanceToFirstStation <= ARRIVAL_DISTANCE_METERS) {
    return stationCount === 1
      ? { currentStationIndex: 0, targetStationIndex: 0 }
      : { currentStationIndex: 0, targetStationIndex: 1 };
  }
  return { currentStationIndex: -1, targetStationIndex: 0 };
};

const haversineMeters = (a: [number, number], b: [number, number]) => {
  const earthRadius = 6371000;
  const dLat = (b[1] - a[1]) * Math.PI / 180;
  const dLng = (b[0] - a[0]) * Math.PI / 180;
  const lat1 = a[1] * Math.PI / 180;
  const lat2 = b[1] * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(h));
};

export const buildPathDistanceMetrics = (path: Array<[number, number]>) => {
  const distances = [0];
  for (let index = 1; index < path.length; index += 1) {
    distances.push(distances[index - 1] + haversineMeters(path[index - 1], path[index]));
  }
  return { distances, totalDistanceMeter: distances[distances.length - 1] || 0 };
};

export const pointAtLegDistance = (
  path: Array<[number, number]>,
  distanceMeter: number,
): [number, number] => {
  if (path.length < 2) return path[0] || [0, 0];
  const { distances, totalDistanceMeter } = buildPathDistanceMetrics(path);
  const clamped = Math.max(0, Math.min(distanceMeter, totalDistanceMeter));
  let segmentIndex = 1;
  while (segmentIndex < distances.length - 1 && distances[segmentIndex] < clamped) segmentIndex += 1;
  const start = path[segmentIndex - 1];
  const end = path[segmentIndex];
  const span = Math.max(0.001, distances[segmentIndex] - distances[segmentIndex - 1]);
  const ratio = (clamped - distances[segmentIndex - 1]) / span;
  return [
    start[0] + (end[0] - start[0]) * ratio,
    start[1] + (end[1] - start[1]) * ratio,
  ];
};

export const splitPathAtDistance = (
  path: Array<[number, number]>,
  distanceMeter: number,
): Pick<LegPathProgress, 'projectedPosition' | 'projectedSegmentIndex' | 'progressDistanceMeter' | 'remainingDistanceMeter' | 'progressRatio' | 'completedCurrentLegPath' | 'remainingCurrentLegPath'> => {
  if (path.length < 2) {
    const point = path[0] || [0, 0] as [number, number];
    return {
      projectedPosition: point,
      projectedSegmentIndex: 0,
      progressDistanceMeter: 0,
      remainingDistanceMeter: 0,
      progressRatio: 0,
      completedCurrentLegPath: point ? [point] : [],
      remainingCurrentLegPath: point ? [point] : [],
    };
  }

  const { distances, totalDistanceMeter } = buildPathDistanceMetrics(path);
  const progressDistanceMeter = Math.max(0, Math.min(distanceMeter, totalDistanceMeter));
  let segmentIndex = 1;
  while (segmentIndex < distances.length - 1 && distances[segmentIndex] < progressDistanceMeter) segmentIndex += 1;
  const projectedPosition = pointAtLegDistance(path, progressDistanceMeter);
  const pointExists = (point: [number, number], other: [number, number]) =>
    Math.abs(point[0] - other[0]) < 0.0000005 && Math.abs(point[1] - other[1]) < 0.0000005;

  const completedCurrentLegPath = progressDistanceMeter <= 0
    ? [path[0], projectedPosition]
    : [...path.slice(0, segmentIndex), projectedPosition];
  const remainingCurrentLegPath = progressDistanceMeter >= totalDistanceMeter
    ? [projectedPosition, path[path.length - 1]]
    : [projectedPosition, ...path.slice(segmentIndex)];

  return {
    projectedPosition,
    projectedSegmentIndex: Math.max(0, segmentIndex - 1),
    progressDistanceMeter,
    remainingDistanceMeter: Math.max(0, totalDistanceMeter - progressDistanceMeter),
    progressRatio: totalDistanceMeter > 0 ? progressDistanceMeter / totalDistanceMeter : 0,
    completedCurrentLegPath: completedCurrentLegPath.filter((point, index, arr) => index === 0 || !pointExists(point, arr[index - 1])),
    remainingCurrentLegPath: remainingCurrentLegPath.filter((point, index, arr) => index === 0 || !pointExists(point, arr[index - 1])),
  };
};

const toLocalMeters = (point: [number, number], origin: [number, number]) => {
  const latRad = origin[1] * Math.PI / 180;
  return {
    x: (point[0] - origin[0]) * 111320 * Math.cos(latRad),
    y: (point[1] - origin[1]) * 110540,
  };
};

export const projectPositionToPath = (
  path: Array<[number, number]>,
  position: [number, number],
  options: {
    preferredDistanceMeter?: number;
    searchWindowMeter?: number;
    maxSnapDistanceMeter?: number;
  } = {},
): LegPathProgress => {
  if (path.length < 2) {
    const base = splitPathAtDistance(path, 0);
    return { ...base, offRouteDistanceMeter: 0 };
  }

  const { distances, totalDistanceMeter } = buildPathDistanceMetrics(path);
  const preferred = options.preferredDistanceMeter;
  const searchWindow = options.searchWindowMeter ?? 120;
  const maxSnapDistance = options.maxSnapDistanceMeter ?? 70;
  const hasPreferred = typeof preferred === 'number' && Number.isFinite(preferred);
  let best: { distance: number; progress: number; index: number } | null = null;

  for (let index = 0; index < path.length - 1; index += 1) {
    const startDistance = distances[index];
    const endDistance = distances[index + 1];
    if (hasPreferred && (endDistance < preferred - searchWindow || startDistance > preferred + searchWindow)) {
      continue;
    }

    const start = path[index];
    const end = path[index + 1];
    const localEnd = toLocalMeters(end, start);
    const localPosition = toLocalMeters(position, start);
    const segmentLengthSq = localEnd.x ** 2 + localEnd.y ** 2;
    const rawT = segmentLengthSq > 0
      ? (localPosition.x * localEnd.x + localPosition.y * localEnd.y) / segmentLengthSq
      : 0;
    const t = Math.max(0, Math.min(1, rawT));
    const projected: [number, number] = [
      start[0] + (end[0] - start[0]) * t,
      start[1] + (end[1] - start[1]) * t,
    ];
    const offRouteDistance = haversineMeters(position, projected);
    const progress = startDistance + (endDistance - startDistance) * t;
    if (!best || offRouteDistance < best.distance) {
      best = { distance: offRouteDistance, progress, index };
    }
  }

  if (!best) {
    return projectPositionToPath(path, position, { ...options, preferredDistanceMeter: undefined });
  }

  const safeProgress = hasPreferred && best.distance > maxSnapDistance
    ? Math.max(0, Math.min(preferred, totalDistanceMeter))
    : best.progress;
  const split = splitPathAtDistance(path, safeProgress);
  return {
    ...split,
    projectedSegmentIndex: best.index,
    offRouteDistanceMeter: best.distance,
  };
};
