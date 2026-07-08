import { apiFetch } from "./http";

export interface DashboardStats {
  todayChatCount: number;
  totalChatCount: number;
  totalSpotCount: number;
  totalRouteCount: number;
  totalKnowledgeDocCount: number;
  avgSuccessRate: number;
  latestChatTime: string | null;
}

export interface HotQuestion { question: string; count: number; }
export interface VisitorModeStats { userMode: string; count: number; }
export interface SentimentStats { emotion: string; count: number; }
export interface ChatTrend { date: string; count: number; }
export interface RecentChat { id: number; userMessage: string; aiAnswer: string; userMode: string; emotion: string; success: boolean; createdAt: string; }
export interface VisitorInsight {
  hotQuestions: HotQuestion[];
  negativeQuestions: HotQuestion[];
  failedQuestions: HotQuestion[];
  modeStats: VisitorModeStats[];
  sentimentStats: SentimentStats[];
  suggestions: string[];
}

const BASE_PATH = "/api/admin/dashboard";

export const getDashboardOverview = () => apiFetch<DashboardStats>(`${BASE_PATH}/overview`, { fallbackMessage: "获取数据大屏概览失败" });
export const getHotQuestions = () => apiFetch<HotQuestion[]>(`${BASE_PATH}/hot-questions`, { fallbackMessage: "获取热门问题失败" });
export const getUserModeStats = () => apiFetch<VisitorModeStats[]>(`${BASE_PATH}/user-modes`, { fallbackMessage: "获取用户模式统计失败" });
export const getSentimentStats = () => apiFetch<SentimentStats[]>(`${BASE_PATH}/sentiment`, { fallbackMessage: "获取情绪统计失败" });
export const getRecentChats = () => apiFetch<RecentChat[]>(`${BASE_PATH}/recent-chats`, { fallbackMessage: "获取最近聊天失败" });
export const getChatTrend = () => apiFetch<ChatTrend[]>(`${BASE_PATH}/trend`, { fallbackMessage: "获取趋势数据失败" });
export const getVisitorInsight = () => apiFetch<VisitorInsight>("/api/admin/reports/visitor-insight", { fallbackMessage: "获取游客感受度报告失败" });
