import type { CampusSpot } from '../types';

export type LngLatPoint = [number, number];

export type CampusNode = {
  id: string;
  name: string;
  lng: number;
  lat: number;
  type?: 'gate' | 'road' | 'spot' | 'junction';
};

export type CampusEdge = {
  from: string;
  to: string;
  distance?: number;
  path?: LngLatPoint[];
};

export type RouteEndpoint = {
  name: string;
  longitude: number | string;
  latitude: number | string;
};

export type CampusRoutePlan = {
  success: boolean;
  pathPoints: LngLatPoint[];
  distanceMeters: number;
  durationMinutes: number;
  nodeNames: string[];
  message: string;
  planner: 'campus-network' | 'direction-guide';
};

const WALKING_METERS_PER_MINUTE = 75;

const baseNodes: CampusNode[] = [
  { id: 'south_gate', name: '山海大学南门', lng: 119.5590, lat: 39.9326, type: 'gate' },
  { id: 'south_junction', name: '南门主路口', lng: 119.55955, lat: 39.93295, type: 'junction' },
  { id: 'alumni_junction', name: '校友之家路口', lng: 119.56145, lat: 39.93255, type: 'junction' },
  { id: 'activity_junction', name: '活动中心路口', lng: 119.56205, lat: 39.93285, type: 'junction' },
  { id: 'sports_junction', name: '体育馆路口', lng: 119.55855, lat: 39.93345, type: 'junction' },
  { id: 'history_junction', name: '校史馆路口', lng: 119.56120, lat: 39.93385, type: 'junction' },
  { id: 'main_axis', name: '校园中轴路', lng: 119.56045, lat: 39.93415, type: 'road' },
  { id: 'lake_junction', name: '燕鸣湖路口', lng: 119.56245, lat: 39.93405, type: 'junction' },
  { id: 'library_square', name: '图书馆广场路口', lng: 119.56045, lat: 39.93495, type: 'junction' },
  { id: 'dining_junction', name: '食堂路口', lng: 119.55945, lat: 39.93520, type: 'junction' },
  { id: 'materials_junction', name: '材料科学楼路口', lng: 119.56100, lat: 39.93545, type: 'junction' },
  { id: 'dorm_junction', name: '学生公寓路口', lng: 119.55875, lat: 39.93578, type: 'junction' },
  { id: 'playground_junction', name: '西操场路口', lng: 119.55755, lat: 39.93600, type: 'junction' },
  { id: 'north_axis', name: '北侧步道', lng: 119.56025, lat: 39.93585, type: 'road' },
];

const baseEdges: CampusEdge[] = [
  { from: 'south_gate', to: 'south_junction', path: [[119.5590, 39.9326], [119.55935, 39.93272], [119.55955, 39.93295]] },
  { from: 'south_junction', to: 'alumni_junction', path: [[119.55955, 39.93295], [119.56050, 39.93274], [119.56145, 39.93255]] },
  { from: 'alumni_junction', to: 'activity_junction', path: [[119.56145, 39.93255], [119.56175, 39.93260], [119.56205, 39.93285]] },
  { from: 'south_junction', to: 'sports_junction', path: [[119.55955, 39.93295], [119.55905, 39.93318], [119.55855, 39.93345]] },
  { from: 'sports_junction', to: 'dining_junction', path: [[119.55855, 39.93345], [119.55885, 39.93435], [119.55945, 39.93520]] },
  { from: 'dining_junction', to: 'dorm_junction', path: [[119.55945, 39.93520], [119.55910, 39.93555], [119.55875, 39.93578]] },
  { from: 'dorm_junction', to: 'playground_junction', path: [[119.55875, 39.93578], [119.55815, 39.93592], [119.55755, 39.93600]] },
  { from: 'south_junction', to: 'main_axis', path: [[119.55955, 39.93295], [119.55990, 39.93355], [119.56045, 39.93415]] },
  { from: 'main_axis', to: 'history_junction', path: [[119.56045, 39.93415], [119.56085, 39.93395], [119.56120, 39.93385]] },
  { from: 'history_junction', to: 'activity_junction', path: [[119.56120, 39.93385], [119.56175, 39.93335], [119.56205, 39.93285]] },
  { from: 'history_junction', to: 'lake_junction', path: [[119.56120, 39.93385], [119.56180, 39.93395], [119.56245, 39.93405]] },
  { from: 'main_axis', to: 'library_square', path: [[119.56045, 39.93415], [119.56048, 39.93455], [119.56045, 39.93495]] },
  { from: 'library_square', to: 'dining_junction', path: [[119.56045, 39.93495], [119.55995, 39.93508], [119.55945, 39.93520]] },
  { from: 'library_square', to: 'materials_junction', path: [[119.56045, 39.93495], [119.56072, 39.93522], [119.56100, 39.93545]] },
  { from: 'materials_junction', to: 'lake_junction', path: [[119.56100, 39.93545], [119.56175, 39.93480], [119.56245, 39.93405]] },
  { from: 'materials_junction', to: 'north_axis', path: [[119.56100, 39.93545], [119.56065, 39.93570], [119.56025, 39.93585]] },
  { from: 'north_axis', to: 'dorm_junction', path: [[119.56025, 39.93585], [119.55950, 39.93586], [119.55875, 39.93578]] },
  { from: 'north_axis', to: 'playground_junction', path: [[119.56025, 39.93585], [119.55890, 39.93603], [119.55755, 39.93600]] },
];

const toNumber = (value: number | string) => typeof value === 'number' ? value : Number(value);

export const haversineMeters = (a: LngLatPoint, b: LngLatPoint) => {
  const earthRadius = 6371000;
  const lng1 = a[0] * Math.PI / 180;
  const lat1 = a[1] * Math.PI / 180;
  const lng2 = b[0] * Math.PI / 180;
  const lat2 = b[1] * Math.PI / 180;
  const dLat = lat2 - lat1;
  const dLng = lng2 - lng1;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(h));
};

export const calculatePathDistanceMeters = (points: LngLatPoint[]) => {
  let distance = 0;
  for (let i = 1; i < points.length; i++) {
    distance += haversineMeters(points[i - 1], points[i]);
  }
  return distance;
};

const isValidEndpoint = (endpoint: RouteEndpoint) => {
  const lng = toNumber(endpoint.longitude);
  const lat = toNumber(endpoint.latitude);
  return Number.isFinite(lng) && Number.isFinite(lat) && Math.abs(lng) <= 180 && Math.abs(lat) <= 90;
};

const endpointToNode = (id: string, endpoint: RouteEndpoint): CampusNode => ({
  id,
  name: endpoint.name,
  lng: toNumber(endpoint.longitude),
  lat: toNumber(endpoint.latitude),
  type: 'spot',
});

const pointOf = (node: CampusNode): LngLatPoint => [node.lng, node.lat];

const edgeDistance = (edge: CampusEdge, nodes: Map<string, CampusNode>) => {
  if (edge.distance) return edge.distance;
  if (edge.path && edge.path.length >= 2) return calculatePathDistanceMeters(edge.path);
  const from = nodes.get(edge.from);
  const to = nodes.get(edge.to);
  if (!from || !to) return Number.POSITIVE_INFINITY;
  return haversineMeters(pointOf(from), pointOf(to));
};

const nearestRoadNodes = (node: CampusNode, nodes: CampusNode[], limit = 2) =>
  nodes
    .filter(item => item.type !== 'spot')
    .map(item => ({ node: item, distance: haversineMeters(pointOf(node), pointOf(item)) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);

const connectorPath = (from: CampusNode, to: CampusNode): LngLatPoint[] => {
  const start = pointOf(from);
  const end = pointOf(to);
  const midA: LngLatPoint = [start[0], start[1] + (end[1] - start[1]) * 0.45];
  const midB: LngLatPoint = [start[0] + (end[0] - start[0]) * 0.55, end[1]];
  return [start, midA, midB, end];
};

const appendDynamicSpotNodes = (nodes: CampusNode[], edges: CampusEdge[], spots: CampusSpot[] = []) => {
  const seen = new Set(nodes.map(node => `${node.lng.toFixed(6)},${node.lat.toFixed(6)}`));
  spots.forEach(spot => {
    const lng = toNumber(spot.longitude);
    const lat = toNumber(spot.latitude);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
    const key = `${lng.toFixed(6)},${lat.toFixed(6)}`;
    if (seen.has(key)) return;
    const node: CampusNode = { id: `spot_${spot.id}`, name: spot.spotName, lng, lat, type: 'spot' };
    nodes.push(node);
    seen.add(key);
    nearestRoadNodes(node, nodes, 1).forEach(({ node: road }) => {
      edges.push({ from: node.id, to: road.id, path: connectorPath(node, road) });
    });
  });
};

const addEndpointConnectors = (endpoint: CampusNode, nodes: CampusNode[], edges: CampusEdge[]) => {
  nodes.push(endpoint);
  nearestRoadNodes(endpoint, nodes, 2).forEach(({ node }) => {
    edges.push({ from: endpoint.id, to: node.id, path: connectorPath(endpoint, node) });
  });
};

const buildGraph = (start: CampusNode, end: CampusNode, spots: CampusSpot[] = []) => {
  const nodes = baseNodes.map(node => ({ ...node }));
  const edges = baseEdges.map(edge => ({ ...edge, path: edge.path ? [...edge.path] : undefined }));
  appendDynamicSpotNodes(nodes, edges, spots);
  addEndpointConnectors(start, nodes, edges);
  addEndpointConnectors(end, nodes, edges);

  const nodeMap = new Map(nodes.map(node => [node.id, node]));
  const adjacency = new Map<string, Array<{ to: string; edge: CampusEdge; distance: number }>>();
  edges.forEach(edge => {
    const distance = edgeDistance(edge, nodeMap);
    if (!Number.isFinite(distance)) return;
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    if (!adjacency.has(edge.to)) adjacency.set(edge.to, []);
    adjacency.get(edge.from)?.push({ to: edge.to, edge, distance });
    adjacency.get(edge.to)?.push({ to: edge.from, edge, distance });
  });
  return { nodeMap, adjacency };
};

const dijkstra = (
  startId: string,
  endId: string,
  adjacency: Map<string, Array<{ to: string; edge: CampusEdge; distance: number }>>,
) => {
  const distances = new Map<string, number>();
  const previous = new Map<string, { node: string; edge: CampusEdge }>();
  const unvisited = new Set(adjacency.keys());

  unvisited.forEach(id => distances.set(id, Number.POSITIVE_INFINITY));
  distances.set(startId, 0);

  while (unvisited.size > 0) {
    let current = '';
    let currentDistance = Number.POSITIVE_INFINITY;
    unvisited.forEach(id => {
      const distance = distances.get(id) ?? Number.POSITIVE_INFINITY;
      if (distance < currentDistance) {
        current = id;
        currentDistance = distance;
      }
    });

    if (!current || currentDistance === Number.POSITIVE_INFINITY) break;
    if (current === endId) break;
    unvisited.delete(current);

    adjacency.get(current)?.forEach(({ to, edge, distance }) => {
      if (!unvisited.has(to)) return;
      const nextDistance = currentDistance + distance;
      if (nextDistance < (distances.get(to) ?? Number.POSITIVE_INFINITY)) {
        distances.set(to, nextDistance);
        previous.set(to, { node: current, edge });
      }
    });
  }

  if (!previous.has(endId)) return null;

  const nodeIds = [endId];
  const pathEdges: CampusEdge[] = [];
  let cursor = endId;
  while (cursor !== startId) {
    const step = previous.get(cursor);
    if (!step) return null;
    pathEdges.unshift(step.edge);
    cursor = step.node;
    nodeIds.unshift(cursor);
  }

  return { nodeIds, pathEdges };
};

const pointsForEdge = (edge: CampusEdge, fromId: string, toId: string, nodes: Map<string, CampusNode>) => {
  if (edge.path && edge.path.length >= 2) {
    return edge.from === fromId && edge.to === toId ? edge.path : [...edge.path].reverse();
  }
  const from = nodes.get(fromId);
  const to = nodes.get(toId);
  return from && to ? [pointOf(from), pointOf(to)] : [];
};

const stitchPath = (nodeIds: string[], pathEdges: CampusEdge[], nodes: Map<string, CampusNode>) => {
  const points: LngLatPoint[] = [];
  pathEdges.forEach((edge, index) => {
    const segment = pointsForEdge(edge, nodeIds[index], nodeIds[index + 1], nodes);
    points.push(...(index === 0 ? segment : segment.slice(1)));
  });
  return ensureBentPath(points);
};

export const generateFallbackPolyline = (start: RouteEndpoint, end: RouteEndpoint, via: RouteEndpoint[] = []): LngLatPoint[] => {
  const endpoints = [start, ...via, end].filter(isValidEndpoint);
  if (endpoints.length < 2) return [];
  const points: LngLatPoint[] = [];

  endpoints.forEach((current, index) => {
    if (index === endpoints.length - 1) return;
    const next = endpoints[index + 1];
    const startPoint: LngLatPoint = [toNumber(current.longitude), toNumber(current.latitude)];
    const endPoint: LngLatPoint = [toNumber(next.longitude), toNumber(next.latitude)];
    const lngDelta = endPoint[0] - startPoint[0];
    const latDelta = endPoint[1] - startPoint[1];
    const bend = Math.max(0.00018, Math.min(0.00055, Math.abs(lngDelta) + Math.abs(latDelta)) * 0.25);
    const midA: LngLatPoint = [startPoint[0] + lngDelta * 0.35, startPoint[1] + bend];
    const midB: LngLatPoint = [startPoint[0] + lngDelta * 0.72 + bend, startPoint[1] + latDelta * 0.72];
    const segment: LngLatPoint[] = [startPoint, midA, midB, endPoint];
    points.push(...(index === 0 ? segment : segment.slice(1)));
  });

  return ensureBentPath(points);
};

const ensureBentPath = (points: LngLatPoint[]): LngLatPoint[] => {
  if (points.length !== 2) return points;
  const [start, end] = points;
  const bend = Math.max(0.0002, Math.abs(start[0] - end[0]) * 0.2 + Math.abs(start[1] - end[1]) * 0.2);
  return [
    start,
    [start[0], start[1] + bend] as LngLatPoint,
    [end[0] + bend, end[1]] as LngLatPoint,
    end,
  ];
};

export const planCampusRoute = (start: RouteEndpoint, end: RouteEndpoint, spots: CampusSpot[] = []): CampusRoutePlan => {
  if (!isValidEndpoint(start) || !isValidEndpoint(end)) {
    const fallback = generateFallbackPolyline(start, end);
    return {
      success: fallback.length >= 2,
      pathPoints: fallback,
      distanceMeters: calculatePathDistanceMeters(fallback),
      durationMinutes: Math.max(1, Math.round(calculatePathDistanceMeters(fallback) / WALKING_METERS_PER_MINUTE)),
      nodeNames: [],
      message: '起点或终点坐标无效，当前使用校园示意路线',
      planner: 'direction-guide',
    };
  }

  const startNode = endpointToNode('temporary_start', start);
  const endNode = endpointToNode('temporary_end', end);
  const graph = buildGraph(startNode, endNode, spots);
  const shortest = dijkstra(startNode.id, endNode.id, graph.adjacency);

  if (!shortest) {
    const fallback = generateFallbackPolyline(start, end, spots.slice(0, 3).map(spot => ({
      name: spot.spotName,
      longitude: spot.longitude,
      latitude: spot.latitude,
    })));
    const distance = calculatePathDistanceMeters(fallback);
    return {
      success: fallback.length >= 2,
      pathPoints: fallback,
      distanceMeters: distance,
      durationMinutes: Math.max(1, Math.round(distance / WALKING_METERS_PER_MINUTE)),
      nodeNames: [],
      message: '校园内置路网未连通，当前使用校园示意路线',
      planner: 'direction-guide',
    };
  }

  const pathPoints = stitchPath(shortest.nodeIds, shortest.pathEdges, graph.nodeMap);
  const distance = calculatePathDistanceMeters(pathPoints);
  const nodeNames = shortest.nodeIds.map(id => graph.nodeMap.get(id)?.name || id);

  return {
    success: pathPoints.length >= 2,
    pathPoints,
    distanceMeters: distance,
    durationMinutes: Math.max(1, Math.round(distance / WALKING_METERS_PER_MINUTE)),
    nodeNames,
    message: '已使用校园内置路线',
    planner: 'campus-network',
  };
};
