import { apiFetch } from "./http";

export interface RouteSpotAdminRequest {
  spotId: number;
  sortOrder: number;
  stayMinutes: number;
  note: string;
}

export interface AdminRouteRequest {
  name: string;
  routeType: string;
  description: string;
  suitableFor: string;
  estimatedDuration: number;
  distanceText: string;
  reason: string;
  enabled: boolean;
  spots: RouteSpotAdminRequest[];
}

export interface RouteSpotAdminResponse {
  spotId: number;
  spotName: string;
  spotType: string;
  sortOrder: number;
  stayMinutes: number;
  note: string;
}

export interface AdminRoute {
  id: number;
  name: string;
  routeType: string;
  description: string;
  suitableFor: string;
  estimatedDuration: number;
  distanceText: string;
  reason: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  spots: RouteSpotAdminResponse[];
}

const BASE_PATH = "/api/admin/routes";

function buildQuery(params?: { enabled?: boolean; routeType?: string }) {
  const searchParams = new URLSearchParams();
  if (params?.enabled !== undefined) searchParams.set("enabled", String(params.enabled));
  if (params?.routeType) searchParams.set("routeType", params.routeType);
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export async function getAdminRoutes(params?: { enabled?: boolean; routeType?: string }): Promise<AdminRoute[]> {
  return apiFetch<AdminRoute[]>(`${BASE_PATH}${buildQuery(params)}`, { fallbackMessage: "获取路线列表失败" });
}

export async function createAdminRoute(data: AdminRouteRequest): Promise<AdminRoute> {
  return apiFetch<AdminRoute>(BASE_PATH, { method: "POST", body: JSON.stringify(data), fallbackMessage: "新增路线失败" });
}

export async function updateAdminRoute(id: number, data: AdminRouteRequest): Promise<AdminRoute> {
  return apiFetch<AdminRoute>(`${BASE_PATH}/${id}`, { method: "PUT", body: JSON.stringify(data), fallbackMessage: "编辑路线失败" });
}

export async function setAdminRouteEnabled(id: number, enabled: boolean): Promise<AdminRoute> {
  return apiFetch<AdminRoute>(`${BASE_PATH}/${id}/enabled?enabled=${enabled}`, { method: "PATCH", fallbackMessage: "更新路线状态失败" });
}

export async function deleteAdminRoute(id: number): Promise<void> {
  return apiFetch<void>(`${BASE_PATH}/${id}`, { method: "DELETE", fallbackMessage: "删除路线失败" });
}
