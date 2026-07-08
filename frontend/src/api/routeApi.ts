import { apiFetch } from "./http";

export interface RouteSpot {
  spotId: number;
  name: string;
  type: string;
  description: string;
  latitude: number;
  longitude: number;
  sortOrder: number;
  stayMinutes: number;
  note: string;
}

export interface CampusRoute {
  id: number;
  name: string;
  routeType: string;
  description: string;
  suitableFor: string;
  estimatedDuration: string;
  distanceText: string;
  reason: string;
  spots: RouteSpot[];
}

export interface RouteRecommendRequest {
  message: string;
  userMode: string;
  durationMinutes: number;
  interests: string;
}

export async function getRoutes(): Promise<CampusRoute[]> {
  return apiFetch<CampusRoute[]>("/api/routes", { fallbackMessage: "获取路线列表失败" });
}

export async function getRouteById(id: number): Promise<CampusRoute> {
  return apiFetch<CampusRoute>(`/api/routes/${id}`, { fallbackMessage: "获取路线详情失败" });
}

export async function recommendRoute(request: RouteRecommendRequest): Promise<CampusRoute> {
  return apiFetch<CampusRoute>("/api/routes/recommend", {
    method: "POST",
    body: JSON.stringify(request),
    fallbackMessage: "智能推荐路线失败",
  });
}
