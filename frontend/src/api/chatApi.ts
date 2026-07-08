import { apiFetch } from "./http";

export interface ChatRequest {
  message: string;
  userMode: string;
  currentSpotId: number | null;
}

export interface ChatResponse {
  answer: string;
  sources: string[];
  emotion: string;
  suggestedActions: string[];
}

export async function sendChatMessage(request: ChatRequest): Promise<ChatResponse> {
  return apiFetch<ChatResponse>("/api/chat", {
    method: "POST",
    body: JSON.stringify(request),
    fallbackMessage: "聊天请求失败",
  });
}
