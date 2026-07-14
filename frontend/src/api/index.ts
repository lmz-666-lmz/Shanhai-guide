import axios from 'axios';
import type { ApiResponse, UserSession, CampusSpot, CampusRoute, CampusActivity, ChatMessage, ChatSendResponse, ChatSource, Badge, BadgeProgress, UserActionResult, UserFavorite, UserCheckin, UserFeedback, DigitalHumanConfig, DigitalHumanGlobalConfig, ProfileStatistics, ActivityReserve, UserMessage, UserContentApplication, AiRoutePlan, PersonalRoute } from '../types';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';
export const SESSION_INVALID_EVENT = 'shanhai:session-invalid';
export const SESSION_DISABLED_MESSAGE = '当前访问会话已停用，请重新登录或创建数字身份';
export const ACCOUNT_DISABLED_MESSAGE = '当前账号已被禁用，请联系管理员';
export const ACHIEVEMENT_UNLOCKED_EVENT = 'shanhai:achievement-unlocked';

let sessionInvalidDispatched = false;

const notifyInvalidSession = (message: string) => {
  if (sessionInvalidDispatched) return;
  sessionInvalidDispatched = true;
  sessionStorage.removeItem('shanhai_session');
  window.dispatchEvent(new CustomEvent(SESSION_INVALID_EVENT, { detail: { message } }));
  window.setTimeout(() => { sessionInvalidDispatched = false; }, 1500);
};

const isAuthFailure = (code: number | undefined, message: string) =>
  code === 401 && /会话已停用|账号已禁用|登录.*过期|重新登录/.test(message);

const api = axios.create({
  baseURL,
  timeout: 10000,
});

api.interceptors.response.use(
  (response) => {
    const body = response.data as ApiResponse<unknown>;
    if (body && typeof body.code === 'number' && body.code !== 200) {
      const message = body.message || '请求失败';
      if (isAuthFailure(body.code, message)) {
        notifyInvalidSession(message.includes('账号') ? ACCOUNT_DISABLED_MESSAGE :
          message.includes('停用') ? SESSION_DISABLED_MESSAGE : message);
      }
      return Promise.reject(new Error(message));
    }
    const data = body?.data as Partial<UserActionResult> | undefined;
    if (Array.isArray(data?.newlyUnlockedBadges) && data.newlyUnlockedBadges.length > 0) {
      window.dispatchEvent(new CustomEvent(ACHIEVEMENT_UNLOCKED_EVENT, {
        detail: { badges: data.newlyUnlockedBadges },
      }));
    }
    return response;
  },
  (error) => {
    if (!error.response) {
      return Promise.reject(new Error('网络异常，请检查后端服务'));
    }
    if (error.response.status === 401 && sessionStorage.getItem('shanhai_session')) {
      const dataMsg = error.response?.data?.message || '';
      const message = dataMsg.includes('停用') ? SESSION_DISABLED_MESSAGE
        : dataMsg.includes('禁用') ? ACCOUNT_DISABLED_MESSAGE
        : '登录状态已过期，请重新登录';
      notifyInvalidSession(message);
    }
    if (error.response?.data?.message) {
      return Promise.reject(new Error(error.response.data.message));
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (username: string, password: string, sessionId?: string) =>
    api.post<ApiResponse<{ session: UserSession; user: any }>>('/auth/login', { username, password, sessionId }),
  register: (username: string, password: string, nickname: string, userMode: string, sessionId?: string) =>
    api.post<ApiResponse<{ session: UserSession; user: any }>>('/auth/register', { username, password, nickname, userMode, sessionId }),
};

export const userApi = {
  login: (userMode: string) => api.post<ApiResponse<UserSession>>('/user/login', null, { params: { userMode } }),
  getSession: (sessionId: string) => api.get<ApiResponse<UserSession>>('/user/session', { params: { sessionId } }),
  updateSession: (sessionId: string, data: Partial<Pick<UserSession, 'virtualName' | 'userMode' | 'virtualCollege' | 'virtualMajor' | 'virtualYear'>>) =>
    api.put<ApiResponse<UserSession>>('/user/session', data, { params: { sessionId } }),
  getStatistics: (sessionId: string) => api.get<ApiResponse<ProfileStatistics>>('/user/statistics', { params: { sessionId } }),
};

export const spotApi = {
  getSpots: (spotType?: string, userMode?: string, keyword?: string) => 
    api.get<ApiResponse<CampusSpot[]>>('/spot/list', { params: { spotType, userMode, keyword } }),
  getSpotById: (spotId: number) => api.get<ApiResponse<CampusSpot>>(`/spot/${spotId}`),
  createSpot: (spot: Omit<CampusSpot, 'id' | 'createTime' | 'updateTime'>) => 
    api.post<ApiResponse<CampusSpot>>('/spot', spot),
  deleteSpot: (spotId: number) => api.delete<ApiResponse<string>>(`/spot/${spotId}`),
};

export const routeApi = {
  getRoutes: (userMode?: string) => 
    api.get<ApiResponse<CampusRoute[]>>('/route/list', { params: { userMode } }),
  getRouteById: (routeId: number) => api.get<ApiResponse<CampusRoute>>(`/route/${routeId}`),
  aiPlan: (data: { sessionId: string; message: string; userMode?: string; durationMinute?: number; interests?: string[]; startSpotId?: number }) =>
    api.post<ApiResponse<AiRoutePlan>>('/route/ai-plan', data),
  completeRoute: (sessionId: string, routeId: number) =>
    api.post<ApiResponse<UserActionResult>>(`/route/${routeId}/complete`, null, { params: { sessionId } }),
};

export const activityApi = {
  getActivities: (userMode?: string, activityType?: string) => 
    api.get<ApiResponse<CampusActivity[]>>('/activity/list', { params: { userMode, activityType } }),
  getActivityById: (activityId: number) => api.get<ApiResponse<CampusActivity>>(`/activity/${activityId}`),
};

export const messageApi = {
  getMessages: (sessionId: string, page: number = 1, pageSize: number = 20) =>
    api.get<ApiResponse<{ records: UserMessage[]; total: number; page: number; pageSize: number }>>('/user/messages', { params: { sessionId, page, pageSize } }),
  getUnreadCount: (sessionId: string) => api.get<ApiResponse<number>>('/user/messages/unread-count', { params: { sessionId } }),
  markRead: (sessionId: string, messageId: number) => api.post<ApiResponse<void>>(`/user/messages/${messageId}/read`, null, { params: { sessionId } }),
  markAllRead: (sessionId: string) => api.post<ApiResponse<void>>('/user/messages/read-all', null, { params: { sessionId } }),
  hide: (sessionId: string, messageId: number) => api.post<ApiResponse<void>>(`/user/messages/${messageId}/hide`, null, { params: { sessionId } }),
};

export const contentApplicationApi = {
  submitSpot: (data: Partial<UserContentApplication>) => api.post<ApiResponse<UserContentApplication>>('/user/content-applications/spots', data),
  submitRoute: (data: Partial<UserContentApplication>) => api.post<ApiResponse<UserContentApplication>>('/user/content-applications/routes', data),
  getMyApplications: (sessionId: string, applicationType?: string, status?: number) =>
    api.get<ApiResponse<UserContentApplication[]>>('/user/content-applications/my', { params: { sessionId, applicationType, status } }),
  withdraw: (sessionId: string, applicationId: number) =>
    api.post<ApiResponse<UserContentApplication>>(`/user/content-applications/${applicationId}/withdraw`, null, { params: { sessionId } }),
};

export const personalRouteApi = {
  create: (data: Partial<PersonalRoute>) => api.post<ApiResponse<PersonalRoute>>('/user/personal-routes', data),
  list: (sessionId: string) => api.get<ApiResponse<PersonalRoute[]>>('/user/personal-routes', { params: { sessionId } }),
  get: (sessionId: string, routeId: number) => api.get<ApiResponse<PersonalRoute>>(`/user/personal-routes/${routeId}`, { params: { sessionId } }),
  update: (sessionId: string, routeId: number, data: Partial<PersonalRoute>) => api.put<ApiResponse<PersonalRoute>>(`/user/personal-routes/${routeId}`, data, { params: { sessionId } }),
  delete: (sessionId: string, routeId: number) => api.delete<ApiResponse<void>>(`/user/personal-routes/${routeId}`, { params: { sessionId } }),
};

export const chatApi = {
  sendMessage: (sessionId: string, content: string, startLng?: number, startLat?: number, locationLabel?: string, startMode?: string) => {
    const params: Record<string, string | number | undefined> = { sessionId, content };
    if (startLng !== undefined && startLat !== undefined) {
      params.startLng = startLng;
      params.startLat = startLat;
      params.locationLabel = locationLabel || '';
      params.startMode = startMode || '';
    }
    return api.post<ApiResponse<ChatSendResponse>>('/chat/send', null, { params });
  },
  executeAction: (sessionId: string, actionType: string, actionId: string, payload: Record<string, unknown>, startLng?: number, startLat?: number, locationLabel?: string, startMode?: string) => {
    const params: Record<string, string | number | undefined> = { sessionId, actionType, actionId };
    if (startLng !== undefined && startLat !== undefined) {
      params.startLng = startLng;
      params.startLat = startLat;
      params.locationLabel = locationLabel || '';
      params.startMode = startMode || '';
    }
    return api.post<ApiResponse<ChatSendResponse>>('/chat/action', payload, { params });
  },
  getHistory: (sessionId: string, limit: number = 20) =>
    api.get<ApiResponse<ChatMessage[]>>('/chat/history', { params: { sessionId, limit } }),
  clearHistory: (sessionId: string) =>
    api.delete<ApiResponse<number>>('/chat/history', { params: { sessionId } }),
};

export const favoriteApi = {
  addFavorite: (sessionId: string, favoriteType: number, targetId: number) => 
    api.post<ApiResponse<UserActionResult>>('/favorite/add', null, { params: { sessionId, favoriteType, targetId } }),
  removeFavorite: (sessionId: string, favoriteType: number, targetId: number) => 
    api.post<ApiResponse<void>>('/favorite/remove', null, { params: { sessionId, favoriteType, targetId } }),
  checkFavorite: (sessionId: string, favoriteType: number, targetId: number) => 
    api.get<ApiResponse<{ isFavorite: boolean }>>('/favorite/check', { params: { sessionId, favoriteType, targetId } }),
  getFavorites: (sessionId: string, favoriteType?: number) => 
    api.get<ApiResponse<UserFavorite[]>>('/favorite/list', { params: { sessionId, favoriteType } }),
};

export const checkinApi = {
  checkin: (sessionId: string, spotId?: number, routeId?: number, checkinType: number = 1, checkinDesc?: string) => 
    api.post<ApiResponse<UserActionResult>>('/checkin', null, { params: { sessionId, spotId, routeId, checkinType, checkinDesc } }),
  getHistory: (sessionId: string) => api.get<ApiResponse<UserCheckin[]>>('/checkin/history', { params: { sessionId } }),
  getCount: (sessionId: string) => api.get<ApiResponse<{ count: number }>>('/checkin/count', { params: { sessionId } }),
};

export const badgeApi = {
  getBadges: (userMode?: string) => 
    api.get<ApiResponse<Badge[]>>('/badge/list', { params: { userMode } }),
  getMyBadges: (sessionId: string) => api.get<ApiResponse<Badge[]>>('/badge/my', { params: { sessionId } }),
  getProgress: (sessionId: string) => api.get<ApiResponse<BadgeProgress[]>>('/badge/progress', { params: { sessionId } }),
  recalculate: (sessionId: string) => api.post<ApiResponse<UserActionResult>>('/badge/recalculate', null, { params: { sessionId } }),
};

export const reserveApi = {
  addReserve: (sessionId: string, activityId: number) => 
    api.post<ApiResponse<UserActionResult>>('/reserve/add', null, { params: { sessionId, activityId } }),
  cancelReserve: (sessionId: string, activityId: number) => 
    api.post<ApiResponse<void>>('/reserve/cancel', null, { params: { sessionId, activityId } }),
  checkReserve: (sessionId: string, activityId: number) => 
    api.get<ApiResponse<{ isReserved: boolean }>>('/reserve/check', { params: { sessionId, activityId } }),
  getReserves: (sessionId: string) => api.get<ApiResponse<ActivityReserve[]>>('/reserve/list', { params: { sessionId } }),
};

export const feedbackApi = {
  submit: (sessionId: string, userMode: string, score: number, feedbackType: string, feedbackContent?: string) => 
    api.post<ApiResponse<void>>('/feedback/submit', null, { params: { sessionId, userMode, score, feedbackType, feedbackContent } }),
  getMyFeedbacks: (sessionId: string) => api.get<ApiResponse<UserFeedback[]>>('/feedback/my', { params: { sessionId } }),
  getFeedbacks: (sessionId: string) => api.get<ApiResponse<UserFeedback[]>>('/feedback/list', { params: { sessionId } }),
};

export const userUploadApi = {
  uploadApplicationImage: (sessionId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('sessionId', sessionId);
    return api.post<ApiResponse<{ url: string; filename: string }>>('/user/upload/application-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export const digitalHumanApi = {
  getConfig: (sessionId: string) => api.get<ApiResponse<DigitalHumanConfig>>('/digital-human/config', { params: { sessionId } }),
  getGlobalConfig: () => api.get<ApiResponse<DigitalHumanGlobalConfig>>('/digital-human/global-config'),
  updateConfig: (sessionId: string, config: Partial<DigitalHumanConfig>) =>
    api.post<ApiResponse<DigitalHumanConfig>>('/digital-human/config', null, { params: { sessionId, ...config } }),
  getOptions: () => api.get<ApiResponse<{ avatarStyles: string[], voiceTypes: string[], talkStyles: string[] }>>('/digital-human/options'),
};

export interface NarrationResponse {
  content: string;
  mode: string;
  generatedBy: string;
  fallbackUsed: boolean;
  fallbackReason: string;
  materialLevel: string;        // "rich" | "basic" | "minimal"
  knowledgeUsed: boolean;
  usedKnowledgeIds: number[];
  sources: ChatSource[];
}

export const narrationApi = {
  generate: (spotId: number, mode: string, durationSeconds?: number) =>
    api.post<ApiResponse<NarrationResponse>>('/narration/generate', { spotId, mode, durationSeconds }),
};

export default api;
