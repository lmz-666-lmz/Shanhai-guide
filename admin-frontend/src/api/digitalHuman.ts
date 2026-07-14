import request from '@/utils/request';

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
  defaultAnswerStyle: string;
  capabilities: DigitalHumanCapabilities;
  quickQuestions: string[];
  welcomeTextsByMode: Record<string, string>;
  navigationSettings: Record<string, string | boolean>;
  narrationSettings: Record<string, string | boolean>;
  accessibilitySettings: Record<string, boolean>;
  fallbackMessages: Record<string, string>;
  userAdjustableFields: string[];
}

export interface Result<T> { code: number; message: string; data: T; }

export const getGlobalDigitalHumanConfig = () => request.get<Result<DigitalHumanGlobalConfig>>('/admin/digital-human/config') as unknown as Promise<Result<DigitalHumanGlobalConfig>>;
export const saveGlobalDigitalHumanConfig = (data: DigitalHumanGlobalConfig) => request.put<Result<DigitalHumanGlobalConfig>>('/admin/digital-human/config', data) as unknown as Promise<Result<DigitalHumanGlobalConfig>>;
export const resetGlobalDigitalHumanConfig = () => request.post<Result<DigitalHumanGlobalConfig>>('/admin/digital-human/config/reset') as unknown as Promise<Result<DigitalHumanGlobalConfig>>;
