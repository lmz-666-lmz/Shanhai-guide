import request from '@/utils/request';

export interface KnowledgeItem {
  id: number;
  title: string;
  content: string;
  knowledgeType: string;
  bindSpotId?: number;
  bindActivityId?: number;
  suitableMode?: string;
  isEnable: number;
  viewCount?: number;
  createTime?: string;
  updateTime?: string;
}

export interface Result<T> {
  code: number;
  message: string;
  data: T;
}

export const getKnowledgeList = (params?: { keyword?: string; knowledgeType?: string; isEnable?: number; includeDisabled?: boolean }) =>
  request.get<Result<KnowledgeItem[]>>('/admin/knowledge', { params }) as unknown as Promise<Result<KnowledgeItem[]>>;

export const createKnowledge = (data: Partial<KnowledgeItem>) =>
  request.post<Result<KnowledgeItem>>('/admin/knowledge', data) as unknown as Promise<Result<KnowledgeItem>>;

export const updateKnowledge = (id: number, data: Partial<KnowledgeItem>) =>
  request.put<Result<KnowledgeItem>>(`/admin/knowledge/${id}`, data) as unknown as Promise<Result<KnowledgeItem>>;

export const disableKnowledge = (id: number) =>
  request.delete<Result<string>>(`/admin/knowledge/${id}`) as unknown as Promise<Result<string>>;
