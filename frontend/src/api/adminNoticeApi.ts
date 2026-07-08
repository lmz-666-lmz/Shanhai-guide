import { apiFetch } from "./http";

export interface Notice {
  id: number;
  title: string;
  noticeType: string;
  content: string;
  location: string | null;
  startTime: string;
  endTime: string;
  priority: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NoticeRequest {
  title: string;
  noticeType: string;
  content: string;
  location: string;
  startTime: string;
  endTime: string;
  priority: number;
  enabled: boolean;
}

const ADMIN_PATH = "/api/admin/notices";

export async function getNotices(): Promise<Notice[]> {
  return apiFetch<Notice[]>("/api/notices", { fallbackMessage: "获取公告失败" });
}

export async function getAdminNotices(params?: { enabled?: boolean; noticeType?: string }): Promise<Notice[]> {
  const searchParams = new URLSearchParams();
  if (params?.enabled !== undefined) searchParams.set("enabled", String(params.enabled));
  if (params?.noticeType) searchParams.set("noticeType", params.noticeType);
  const query = searchParams.toString();
  return apiFetch<Notice[]>(`${ADMIN_PATH}${query ? `?${query}` : ""}`, { fallbackMessage: "获取公告列表失败" });
}

export async function createNotice(data: NoticeRequest): Promise<Notice> {
  return apiFetch<Notice>(ADMIN_PATH, { method: "POST", body: JSON.stringify(data), fallbackMessage: "新增公告失败" });
}

export async function updateNotice(id: number, data: NoticeRequest): Promise<Notice> {
  return apiFetch<Notice>(`${ADMIN_PATH}/${id}`, { method: "PUT", body: JSON.stringify(data), fallbackMessage: "编辑公告失败" });
}

export async function setNoticeEnabled(id: number, enabled: boolean): Promise<Notice> {
  return apiFetch<Notice>(`${ADMIN_PATH}/${id}/enabled?enabled=${enabled}`, { method: "PATCH", fallbackMessage: "更新公告状态失败" });
}

export async function deleteNotice(id: number): Promise<void> {
  return apiFetch<void>(`${ADMIN_PATH}/${id}`, { method: "DELETE", fallbackMessage: "删除公告失败" });
}
