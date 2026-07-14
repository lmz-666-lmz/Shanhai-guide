import request from '@/utils/request';

export interface Result<T> {
  code: number;
  message: string;
  data: T;
}

export interface DashboardOverview {
  todayServicePeople: number;
  weekServicePeople: number;
  todayChatCount: number;
  activityReserveCount: number;
  checkinCount: number;
  totalChatCount: number;
  knowledgeHitRate: number | null;
  missedQuestionCount: number;
  digitalHumanServiceMinutes: number | null;
}

export interface RankItem {
  id?: number;
  name?: string;
  question?: string;
  count: number;
}

export interface ModeDistributionItem {
  mode: string;
  label: string;
  count: number;
}

export interface FeedbackSummary {
  feedbackCount: number;
  averageScore: number | null;
  positiveFeedback: number;
  neutralFeedback: number;
  negativeFeedback: number;
  emotionDistribution: Array<{ emotion: string; label: string; count: number }>;
  satisfactionTrend: Array<{ date: string; averageScore: number | null }>;
}

export const getDashboardOverview = () => request.get<Result<DashboardOverview>>('/admin/dashboard/overview') as unknown as Promise<Result<DashboardOverview>>;
export const getHotSpots = () => request.get<Result<RankItem[]>>('/admin/dashboard/hot-spots') as unknown as Promise<Result<RankItem[]>>;
export const getHotRoutes = () => request.get<Result<RankItem[]>>('/admin/dashboard/hot-routes') as unknown as Promise<Result<RankItem[]>>;
export const getHotQuestions = () => request.get<Result<RankItem[]>>('/admin/dashboard/hot-questions') as unknown as Promise<Result<RankItem[]>>;
export const getFeedbackSummary = () => request.get<Result<FeedbackSummary>>('/admin/dashboard/feedback-summary') as unknown as Promise<Result<FeedbackSummary>>;
export const getUserModeDistribution = () => request.get<Result<ModeDistributionItem[]>>('/admin/dashboard/user-mode-distribution') as unknown as Promise<Result<ModeDistributionItem[]>>;
