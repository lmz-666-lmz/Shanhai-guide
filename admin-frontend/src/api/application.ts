import request from '@/utils/request';

export interface ContentApplication {
  id: number;
  sessionId: string;
  userMode?: string;
  applicantName?: string;
  applicationType: 'spot' | 'route';
  applicationTitle: string;
  spotName?: string;
  spotType?: string;
  longitude?: number;
  latitude?: number;
  openTime?: string;
  recommendTime?: number;
  spotDesc?: string;
  spotImage?: string;
  routeName?: string;
  routeDesc?: string;
  totalMinute?: number;
  spotOrderJson?: string;
  coverImage?: string;
  suitableMode?: string;
  applicationReason?: string;
  status: number;
  auditComment?: string;
  publishedTargetId?: number;
  createTime: string;
}

export interface ContentApplicationStats {
  pendingSpot: number;
  pendingRoute: number;
  todayCount: number;
  approvedCount: number;
  rejectedCount: number;
}

export interface ContentApplicationListResponse {
  records: ContentApplication[];
  stats: ContentApplicationStats;
}

export const getApplications = (
  applicationType?: string,
  status?: number,
  keyword?: string,
  applicant?: string,
  startDate?: string,
  endDate?: string
) =>
  request.get('/admin/content-applications', {
    params: { applicationType, status, keyword, applicant, startDate, endDate },
  });

export const approveApplication = (id: number, data: Partial<ContentApplication>) =>
  request.post(`/admin/content-applications/${id}/approve`, data);

export const rejectApplication = (id: number, auditComment: string) =>
  request.post(`/admin/content-applications/${id}/reject`, { auditComment });
