export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export interface UserSession {
  id: number;
  sessionId: string;
  userId: number | null;
  userMode: string;
  virtualName: string;
  virtualYear: number;
  virtualCollege: string;
  virtualMajor: string;
  totalCheckin: number;
  totalRoute: number;
  status: number;
  createTime: string;
  updateTime: string;
}

export interface CampusSpot {
  id: number;
  spotName: string;
  spotType: string;
  longitude: number;
  latitude: number;
  openTime: string;
  recommendTime: number;
  spotDesc: string;
  spotImage: string;
  suitableMode: string;
  isEnable: number;
}

export interface CampusRoute {
  id: number;
  routeName: string;
  routeDesc: string;
  totalMinute: number;
  spotOrderJson: string;
  suitableMode: string;
  coverImage: string;
  isEnable: number;
  spots: CampusSpot[];
}

export interface CampusActivity {
  id: number;
  activityTitle: string;
  activityDesc: string;
  activityType: '学术' | '文体' | '校友';
  activityImage: string;
  activityTime: string;
  activitySpotId: number;
  suitableMode: string;
  isReserve: number;
  reserveLimit: number;
  reservedCount: number;
  isEnable: number;
}

export interface ProfileStatistics {
  checkinCount: number;
  favoriteSpotCount: number;
  favoriteRouteCount: number;
  activityCount: number;
  badgeCount: number;
}

export interface ActivityReserve {
  id: number;
  sessionId: string;
  activityId: number;
  reserveStatus: number;
  reserveTime: string;
}

export interface SuggestedAction {
  actionId: string;
  actionType: ActionType;
  label: string;
  payload: Record<string, unknown>;
}

export type ActionType =
  | 'CONFIRM_ROUTE_DRAFT'
  | 'MODIFY_ROUTE_DURATION'
  | 'CONVERT_TO_SINGLE_SPOT'
  | 'RESELECT_ROUTE_START'
  | 'PLAN_RECOMMENDED_SPOTS'
  | 'OPEN_SPOT_ON_MAP'
  | 'START_SPOT_NAVIGATION'
  | 'OPEN_ROUTE_ON_MAP'
  | 'START_ROUTE_NAVIGATION'
  | 'FAVORITE_ROUTE'
  | 'ASK_SPOT_INTRO'
  | 'ASK_OPEN_STATUS'
  | 'FIND_NEAREST_RESTROOM'
  | 'FIND_NEAREST_FACILITY'
  | 'INTRODUCE_CURRENT_SPOT'
  | 'USE_CURRENT_LOCATION'
  | 'USE_DEMO_LOCATION'
  | 'SELECT_MANUAL_START'
  | 'CONTINUE_QUESTION'
  | 'OPEN_ROUTE_CARD'
  | 'VIEW_SPOTS_ON_MAP'
  | 'ADJUST_DURATION'
  | 'VIEW_RECENT_ACTIVITIES'
  | 'ASK_ANOTHER_QUESTION'
  | string;

export interface ChatMessage {
  id: number;
  sessionId: string;
  userMode: string;
  userContent: string;
  aiContent: string;
  sourceInfo: string;
  messageType?: string;
  structuredPayload?: string;
  sources?: ChatSource[];
  cardType?: ChatCardType;
  responseType?: ChatResponseType;
  spotRecommendations?: SpotRecommendation[];
  primarySpot?: SpotRecommendation | null;
  routePlan?: AiRoutePlan | null;
  clarification?: string | null;
  suggestedActions?: SuggestedAction[];
  emotion?: string;
  emotionTag: string;
  createTime: string;
}

export interface ChatSource {
  sourceType: 'knowledge' | 'spot' | 'route' | 'activity' | string;
  sourceId?: number;
  title: string;
  knowledgeType?: string;
  sourceName: string;
  snippet?: string;
}

export type ChatCardType = 'none' | 'spot_list' | 'spot_intro' | 'route_plan' | string;
export type ChatResponseType = 'route_plan' | 'spot_intro' | 'spot_list' | 'text' | 'clarification' | string;

export interface SpotRecommendation {
  spotId: number;
  spotName: string;
  spotType: string;
  longitude: number;
  latitude: number;
  recommendTime?: number;
  spotDesc?: string;
  spotImage?: string;
  openTime?: string;
  reason?: string;
}

export interface AiRouteSpot {
  spotId: number;
  spotName: string;
  spotType: string;
  longitude: number;
  latitude: number;
  stayMinute?: number;
  walkMinuteFromPrev?: number;
  reason?: string;
  spotDesc?: string;
  spotImage?: string;
}

export interface AiRoutePlan {
  routeName: string;
  routeDesc: string;
  totalMinute: number;
  reason?: string;
  spots: AiRouteSpot[];
  startSpotId?: number;
  /** 起点标签，如 "当前位置" / "演示位置" / "手动起点" / "山海大学南门" */
  startLabel?: string;
  startLng?: number;
  startLat?: number;
  startMode?: 'spot' | 'real' | 'demo' | 'manual' | string;
  mapPolyline?: number[][];
  difficulty?: '轻松' | '适中' | '进阶' | string;
  walkingDistance?: number;
  suitableAudience?: string[];
  hasRestStops?: boolean;
  accessibleFriendly?: boolean;
  restStops?: string[];
  alternativeSpots?: string[];
}

export interface ChatSendResponse {
  sessionId: string;
  userContent: string;
  aiContent: string;
  answer?: string;
  sources?: ChatSource[];
  cardType?: ChatCardType;
  responseType?: ChatResponseType;
  spotRecommendations?: SpotRecommendation[];
  primarySpot?: SpotRecommendation | null;
  routePlan?: AiRoutePlan | null;
  clarification?: string | null;
  emotion?: string;
  suggestedActions?: SuggestedAction[];
}

export interface PersonalRoute {
  id: number;
  sessionId: string;
  routeName: string;
  routeDesc: string;
  spotOrderJson: string;
  totalMinute: number;
  sourcePrompt?: string;
  sourceType?: string;
  isFavorite?: number;
  createTime: string;
  updateTime: string;
}

export interface Badge {
  id: number;
  badgeCode?: string;
  badgeName: string;
  badgeIcon: string;
  badgeDesc: string;
  badgeLevel?: 'normal' | 'silver' | 'gold' | 'special' | string;
  unlockRule: string;
  conditionType?: BadgeConditionType;
  conditionValue?: number;
  conditionConfig?: string;
  userModeLimit: string;
  sort: number;
  sortOrder?: number;
  isEnable: number;
}

export type BadgeConditionType =
  | 'FIRST_CHECKIN'
  | 'CHECKIN_COUNT'
  | 'FIRST_ROUTE'
  | 'ROUTE_COMPLETE_COUNT'
  | 'FIRST_ACTIVITY'
  | 'ACTIVITY_RESERVE_COUNT'
  | 'FAVORITE_SPOT_COUNT'
  | 'FAVORITE_ROUTE_COUNT'
  | 'SPOT_TYPE_CHECKIN'
  | 'CUSTOM';

export interface BadgeProgress {
  badge: Badge;
  currentValue: number;
  targetValue: number;
  unlocked: boolean;
  unlockTime?: string;
  conditionText: string;
}

export interface UserActionResult {
  message: string;
  newlyUnlockedBadges: Badge[];
}

export interface UserFavorite {
  id: number;
  sessionId: string;
  favoriteType: number;
  targetId: number;
  createTime: string;
}

export interface UserCheckin {
  id: number;
  sessionId: string;
  spotId: number;
  routeId: number;
  checkinType: number;
  checkinDesc: string;
  createTime: string;
}

export interface UserFeedback {
  id: number;
  sessionId: string;
  userMode: string;
  score: number;
  feedbackType: string;
  feedbackContent: string;
  adminReply: string;
  replyTime: string;
  createTime: string;
}

export interface DigitalHumanConfig {
  id: number;
  sessionId: string;
  avatarUrl: string;
  voiceType: string;
  speechSpeed: number;
  welcomeText: string;
  talkStyle: string;
  configJson?: string;
  digitalHumanName?: string;
  createTime: string;
  updateTime: string;
}

export type DigitalHumanState =
  | 'idle' | 'listening' | 'thinking' | 'answering' | 'explaining'
  | 'planning' | 'navigating' | 'arrived' | 'completed' | 'paused' | 'error';

export interface DigitalHumanCapabilities {
  aiChat: boolean;
  knowledgeNarration: boolean;
  pointNarration: boolean;
  routePlanning: boolean;
  mapCompanion: boolean;
  autoArrivalNarration: boolean;
  voiceInput: boolean;
  voiceRead: boolean;
  navigationVoice: boolean;
  routeAnimation: boolean;
  subtitles: boolean;
  seniorMode: boolean;
  highContrast: boolean;
  largeText: boolean;
  userPersonalization: boolean;
  cocreateRecommendation: boolean;
}

export interface DigitalHumanUserConfig {
  avatarTheme: string;
  voiceType: string;
  speechSpeed: number;
  volume: number;
  pitch: number;
  autoRead: boolean;
  subtitleEnabled: boolean;
  answerStyle: '简洁' | '标准' | '详细';
  autoNarration: boolean;
  navigationAssistantExpanded: boolean;
  routeAnimationEnabled: boolean;
  highContrast: boolean;
  largeText: boolean;
  seniorMode: boolean;
  navigationPromptFrequency: 'low' | 'standard' | 'high';
  quickQuestionPreference: string;
}

export interface DigitalHumanGlobalConfig {
  name: string;
  digitalHumanName: string;
  avatar: string;
  avatarTheme: string;
  style: string;
  voiceType: string;
  speed: number;
  speechSpeed: number;
  volume: number;
  pitch: number;
  autoRead: boolean;
  subtitleEnabled: boolean;
  welcomeText: string;
  introduction: string;
  guideStyle: string;
  defaultAnswerStyle: '简洁' | '标准' | '详细';
  capabilities: DigitalHumanCapabilities;
  quickQuestions: string[];
  welcomeTextsByMode: Record<string, string>;
  navigationSettings: {
    promptFrequency: 'low' | 'standard' | 'high';
    arrivalDetection: string;
    autoNarration: boolean;
    showRouteAnimation: boolean;
    allowSkipStation: boolean;
    allowReplan: boolean;
  };
  narrationSettings: Record<string, string | boolean>;
  accessibilitySettings: Record<string, boolean>;
  fallbackMessages: Record<string, string>;
  userAdjustableFields: string[];
}

export interface UserMessage {
  id: number;
  targetType: 'personal' | 'public' | 'mode';
  sessionId?: string;
  userMode?: string;
  messageType: 'system' | 'activity' | 'application' | 'badge' | 'feedback';
  title: string;
  content: string;
  sourceType?: string;
  sourceId?: number;
  sourceEvent?: string;
  readStatus: number;
  isDeleted: number;
  readTime?: string;
  createTime: string;
  updateTime: string;
}

export interface UserContentApplication {
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
  auditTime?: string;
  createTime: string;
  updateTime: string;
}

export type UserMode = 'alumni' | 'fresh' | 'parent' | 'research' | 'senior' | 'guest';

export const UserModeNames: Record<UserMode, string> = {
  alumni: '校友',
  fresh: '新生',
  parent: '家长',
  research: '访客',
  senior: '长者',
  guest: '普通游客',
};
