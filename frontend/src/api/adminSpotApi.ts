import { apiFetch } from "./http";

export interface AdminSpot {
  id: number;
  name: string;
  type: string;
  description: string;
  story: string;
  latitude: number;
  longitude: number;
  openTime: string;
  recommendedDuration: number;
  tags: string;
  imageUrl: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminSpotRequest {
  name: string;
  type: string;
  description: string;
  story: string;
  latitude: number;
  longitude: number;
  openTime: string;
  recommendedDuration: number;
  tags: string;
  imageUrl: string | null;
  enabled: boolean;
}

const BASE_PATH = "/api/admin/spots";

function buildQuery(params?: { enabled?: boolean; type?: string }) {
  const searchParams = new URLSearchParams();
  if (params?.enabled !== undefined) searchParams.set("enabled", String(params.enabled));
  if (params?.type) searchParams.set("type", params.type);
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export async function getAdminSpots(params?: { enabled?: boolean; type?: string }): Promise<AdminSpot[]> {
  return apiFetch<AdminSpot[]>(`${BASE_PATH}${buildQuery(params)}`, { fallbackMessage: "获取点位列表失败" });
}

export async function getAdminSpot(id: number): Promise<AdminSpot> {
  return apiFetch<AdminSpot>(`${BASE_PATH}/${id}`, { fallbackMessage: "获取点位详情失败" });
}

export async function createAdminSpot(data: AdminSpotRequest): Promise<AdminSpot> {
  return apiFetch<AdminSpot>(BASE_PATH, { method: "POST", body: JSON.stringify(data), fallbackMessage: "新增点位失败" });
}

export async function updateAdminSpot(id: number, data: AdminSpotRequest): Promise<AdminSpot> {
  return apiFetch<AdminSpot>(`${BASE_PATH}/${id}`, { method: "PUT", body: JSON.stringify(data), fallbackMessage: "编辑点位失败" });
}

export async function setAdminSpotEnabled(id: number, enabled: boolean): Promise<AdminSpot> {
  return apiFetch<AdminSpot>(`${BASE_PATH}/${id}/enabled?enabled=${enabled}`, { method: "PATCH", fallbackMessage: "更新点位状态失败" });
}

export async function deleteAdminSpot(id: number): Promise<AdminSpot> {
  return apiFetch<AdminSpot>(`${BASE_PATH}/${id}`, { method: "DELETE", fallbackMessage: "删除点位失败" });
}
