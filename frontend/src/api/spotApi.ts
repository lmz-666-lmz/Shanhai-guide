import { apiFetch } from "./http";

export interface CampusSpot {
  id: number;
  name: string;
  type: string;
  description: string;
  story: string;
  latitude: number;
  longitude: number;
  openTime: string;
  recommendedDuration: string;
  tags: string | string[];
  imageUrl: string;
  enabled: boolean;
}

export function parseTags(tags?: string | string[] | null): string[] {
  if (!tags) {
    return [];
  }
  if (Array.isArray(tags)) {
    return tags.filter((tag) => tag && tag.trim());
  }
  return tags.split(/[,，]/).map((tag) => tag.trim()).filter((tag) => tag);
}

export async function getSpots(): Promise<CampusSpot[]> {
  return apiFetch<CampusSpot[]>("/api/spots", { fallbackMessage: "获取校园点位失败" });
}

export async function getSpotById(id: number): Promise<CampusSpot> {
  return apiFetch<CampusSpot>(`/api/spots/${id}`, { fallbackMessage: "获取点位详情失败" });
}
