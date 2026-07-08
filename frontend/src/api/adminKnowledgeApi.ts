import { apiFetch } from "./http";

export interface KnowledgeDoc {
  id: number;
  title: string;
  category: string;
  sourceName: string;
  content: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  chunkCount: number;
}

export interface KnowledgeDocRequest {
  title: string;
  category: string;
  sourceName: string;
  content: string;
  enabled: boolean;
}

export interface KnowledgeChunk {
  id: number;
  docId: number;
  title: string;
  category: string;
  sourceName: string;
  content: string;
  keywords: string | string[];
  enabled: boolean;
  createdAt: string;
}

const BASE_PATH = "/api/admin/knowledge";

export async function getKnowledgeDocs(enabled?: boolean): Promise<KnowledgeDoc[]> {
  const query = enabled === undefined ? "" : `?enabled=${enabled}`;
  return apiFetch<KnowledgeDoc[]>(`${BASE_PATH}/docs${query}`, { fallbackMessage: "获取知识文档列表失败" });
}

export async function getKnowledgeDoc(id: number): Promise<KnowledgeDoc> {
  return apiFetch<KnowledgeDoc>(`${BASE_PATH}/docs/${id}`, { fallbackMessage: "获取知识文档详情失败" });
}

export async function createKnowledgeDoc(data: KnowledgeDocRequest): Promise<KnowledgeDoc> {
  return apiFetch<KnowledgeDoc>(`${BASE_PATH}/docs`, { method: "POST", body: JSON.stringify(data), fallbackMessage: "新增知识文档失败" });
}

export async function updateKnowledgeDoc(id: number, data: KnowledgeDocRequest): Promise<KnowledgeDoc> {
  return apiFetch<KnowledgeDoc>(`${BASE_PATH}/docs/${id}`, { method: "PUT", body: JSON.stringify(data), fallbackMessage: "修改知识文档失败" });
}

export async function setKnowledgeDocEnabled(id: number, enabled: boolean): Promise<KnowledgeDoc> {
  return apiFetch<KnowledgeDoc>(`${BASE_PATH}/docs/${id}/enabled?enabled=${enabled}`, { method: "PATCH", fallbackMessage: "更新知识文档状态失败" });
}

export async function deleteKnowledgeDoc(id: number): Promise<void> {
  return apiFetch<void>(`${BASE_PATH}/docs/${id}`, { method: "DELETE", fallbackMessage: "删除知识文档失败" });
}

export async function getKnowledgeChunks(docId: number): Promise<KnowledgeChunk[]> {
  return apiFetch<KnowledgeChunk[]>(`${BASE_PATH}/docs/${docId}/chunks`, { fallbackMessage: "获取知识片段失败" });
}
