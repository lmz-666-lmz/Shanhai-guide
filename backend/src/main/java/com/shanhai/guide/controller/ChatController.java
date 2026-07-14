package com.shanhai.guide.controller;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.shanhai.guide.common.ApiResponse;
import com.shanhai.guide.entity.TUserChatHistory;
import com.shanhai.guide.entity.TUserSession;
import com.shanhai.guide.entity.dto.ChatReply;
import com.shanhai.guide.service.AiService;
import com.shanhai.guide.service.SessionGuardService;
import com.shanhai.guide.service.UserChatHistoryService;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/chat")
public class ChatController {

    private final UserChatHistoryService userChatHistoryService;
    private final AiService aiService;
    private final SessionGuardService sessionGuardService;
    private final ObjectMapper objectMapper;

    public ChatController(UserChatHistoryService userChatHistoryService,
                          AiService aiService,
                          SessionGuardService sessionGuardService,
                          ObjectMapper objectMapper) {
        this.userChatHistoryService = userChatHistoryService;
        this.aiService = aiService;
        this.sessionGuardService = sessionGuardService;
        this.objectMapper = objectMapper;
    }

    @PostMapping({"", "/"})
    public ApiResponse<Map<String, Object>> sendMessageRoot(@RequestParam(required = false) String sessionId,
                                                            @RequestParam(required = false) String content,
                                                            @RequestParam(required = false) Double startLng,
                                                            @RequestParam(required = false) Double startLat,
                                                            @RequestParam(required = false) String locationLabel,
                                                            @RequestParam(required = false) String startMode,
                                                            @RequestBody(required = false) Map<String, String> body) {
        String resolvedSessionId = firstNonBlank(sessionId, body == null ? null : body.get("sessionId"));
        String resolvedContent = firstNonBlank(content, body == null ? null : body.get("content"), body == null ? null : body.get("message"));
        String resolvedStartMode = firstNonBlank(startMode, body == null ? null : body.get("startMode"));
        return doSendMessage(resolvedSessionId, resolvedContent, startLng, startLat, locationLabel, resolvedStartMode);
    }

    @PostMapping("/send")
    public ApiResponse<Map<String, Object>> sendMessage(@RequestParam String sessionId,
                                                        @RequestParam String content,
                                                        @RequestParam(required = false) Double startLng,
                                                        @RequestParam(required = false) Double startLat,
                                                        @RequestParam(required = false) String locationLabel,
                                                        @RequestParam(required = false) String startMode) {
        return doSendMessage(sessionId, content, startLng, startLat, locationLabel, startMode);
    }

    @PostMapping("/action")
    public ApiResponse<Map<String, Object>> executeAction(@RequestParam String sessionId,
                                                          @RequestParam String actionType,
                                                          @RequestParam(required = false) String actionId,
                                                          @RequestParam(required = false) Double startLng,
                                                          @RequestParam(required = false) Double startLat,
                                                          @RequestParam(required = false) String locationLabel,
                                                          @RequestParam(required = false) String startMode,
                                                          @RequestBody(required = false) Map<String, Object> payload) {
        TUserSession session = sessionGuardService.requireActiveUserAction(sessionId);
        String userMode = session.getUserMode();
        if (payload == null) payload = Map.of();

        ChatReply aiReply = aiService.executeAction(sessionId, actionType, actionId, payload, userMode,
                startLng, startLat, locationLabel, startMode);
        String sourceInfo = serializeSources(aiReply);
        String structuredPayload = serializeStructuredPayload(aiReply);

        // Save a lightweight history entry for the action result
        userChatHistoryService.saveChat(sessionId, userMode, "[操作: " + actionType + "]", aiReply.getAnswer(),
                sourceInfo, aiReply.getEmotion(), aiReply.getCardType(), structuredPayload);

        return ApiResponse.success(toResponse(sessionId, "[操作: " + actionType + "]", aiReply));
    }

    @GetMapping("/history")
    public ApiResponse<List<Map<String, Object>>> getChatHistory(@RequestParam String sessionId,
                                                                 @RequestParam(defaultValue = "20") Integer limit) {
        sessionGuardService.requireActiveUserAction(sessionId);
        List<Map<String, Object>> history = userChatHistoryService.getChatHistory(sessionId, limit)
                .stream()
                .map(this::toHistoryView)
                .toList();
        return ApiResponse.success(history);
    }

    @DeleteMapping("/history")
    public ApiResponse<Integer> clearChatHistory(@RequestParam String sessionId) {
        sessionGuardService.requireActiveUserAction(sessionId);
        int deleted = userChatHistoryService.clearChatHistory(sessionId);
        return ApiResponse.success("聊天记录已清空", deleted);
    }

    private ApiResponse<Map<String, Object>> doSendMessage(String sessionId, String content,
                                                          Double startLng, Double startLat, String locationLabel,
                                                          String startMode) {
        TUserSession session = sessionGuardService.requireActiveUserAction(sessionId);
        if (content == null || content.isBlank()) {
            return ApiResponse.error(400, "消息内容不能为空");
        }
        String userMode = session.getUserMode();

        ChatReply aiReply = aiService.chat(sessionId, content, userMode, startLng, startLat, locationLabel, startMode);
        String sourceInfo = serializeSources(aiReply);
        String structuredPayload = serializeStructuredPayload(aiReply);

        userChatHistoryService.saveChat(sessionId, userMode, content, aiReply.getAnswer(), sourceInfo,
                aiReply.getEmotion(), aiReply.getCardType(), structuredPayload);

        return ApiResponse.success(toResponse(sessionId, content, aiReply));
    }

    private Map<String, Object> toResponse(String sessionId, String content, ChatReply reply) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("sessionId", sessionId);
        result.put("userContent", content);
        result.put("aiContent", reply.getAnswer());
        result.put("answer", reply.getAnswer());
        result.put("sources", reply.getSources() == null ? List.of() : reply.getSources());
        result.put("cardType", reply.getCardType() == null ? "none" : reply.getCardType());
        result.put("responseType", reply.getResponseType() == null ? "text" : reply.getResponseType());
        result.put("spotRecommendations", reply.getSpotRecommendations() == null ? List.of() : reply.getSpotRecommendations());
        result.put("primarySpot", reply.getPrimarySpot());
        result.put("routePlan", reply.getRoutePlan());
        result.put("clarification", reply.getClarification());
        result.put("suggestedActions", reply.getSuggestedActions() == null ? List.of() : reply.getSuggestedActions());
        result.put("emotion", reply.getEmotion() == null ? "neutral" : reply.getEmotion());
        return result;
    }

    private Map<String, Object> toHistoryView(TUserChatHistory chat) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", chat.getId());
        item.put("sessionId", chat.getSessionId());
        item.put("userMode", chat.getUserMode());
        item.put("userContent", chat.getUserContent());
        item.put("aiContent", chat.getAiContent());
        // "answer" 字段兼容前端统一读取
        item.put("answer", chat.getAiContent());
        item.put("sourceInfo", chat.getSourceInfo());
        // sources: 优先从 sourceInfo 解析，为空时返回空数组
        item.put("sources", chat.getSourceInfo() != null && !chat.getSourceInfo().isBlank()
                ? parseJson(chat.getSourceInfo(), List.of())
                : List.of());
        item.put("emotionTag", chat.getEmotionTag());
        item.put("messageType", chat.getMessageType());
        // 返回原始 structuredPayload 供前端双重校验
        item.put("structuredPayload", chat.getStructuredPayload());
        item.put("createTime", chat.getCreateTime());
        item.put("updateTime", chat.getUpdateTime());

        // 从 structuredPayload 解析结构化字段
        Map<String, Object> payload = parseJson(chat.getStructuredPayload(), Map.of());
        String cardType = payload.getOrDefault("cardType", chat.getMessageType() == null ? "none" : chat.getMessageType()).toString();
        if (cardType == null || cardType.isBlank()) {
            cardType = "none";
        }
        item.put("cardType", cardType);
        item.put("responseType", payload.getOrDefault("responseType", "text"));
        // spotRecommendations: 空值转为 []
        Object spotRecs = payload.get("spotRecommendations");
        item.put("spotRecommendations", spotRecs == null ? List.of() : spotRecs);
        item.put("primarySpot", payload.getOrDefault("primarySpot", null));
        // routePlan: 允许为 null
        item.put("routePlan", payload.getOrDefault("routePlan", null));
        item.put("clarification", payload.getOrDefault("clarification", null));
        // suggestedActions: 空值转为 []
        Object actions = payload.get("suggestedActions");
        item.put("suggestedActions", actions == null ? List.of() : actions);
        Object payloadSources = payload.get("sources");
        if (payloadSources instanceof List<?> sources && !sources.isEmpty()) {
            item.put("sources", sources);
        }
        // emotion: 优先使用 structuredPayload 中的值
        item.put("emotion", payload.getOrDefault("emotion", chat.getEmotionTag() == null ? "neutral" : chat.getEmotionTag()));
        return item;
    }

    private String serializeSources(ChatReply reply) {
        if (reply == null || reply.getSources() == null || reply.getSources().isEmpty()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(reply.getSources());
        } catch (JsonProcessingException e) {
            return null;
        }
    }

    private String serializeStructuredPayload(ChatReply reply) {
        if (reply == null) return null;
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("cardType", reply.getCardType() == null ? "none" : reply.getCardType());
        payload.put("responseType", reply.getResponseType() == null ? "text" : reply.getResponseType());
        payload.put("sources", reply.getSources() == null ? List.of() : reply.getSources());
        payload.put("spotRecommendations", reply.getSpotRecommendations() == null ? List.of() : reply.getSpotRecommendations());
        payload.put("primarySpot", reply.getPrimarySpot());
        payload.put("routePlan", reply.getRoutePlan());
        payload.put("clarification", reply.getClarification());
        payload.put("suggestedActions", reply.getSuggestedActions() == null ? List.of() : reply.getSuggestedActions());
        payload.put("emotion", reply.getEmotion() == null ? "neutral" : reply.getEmotion());
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException e) {
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    private <T> T parseJson(String json, T fallback) {
        if (json == null || json.isBlank()) return fallback;
        try {
            if (fallback instanceof Map) {
                return (T) objectMapper.readValue(json, new TypeReference<LinkedHashMap<String, Object>>() {});
            }
            if (fallback instanceof List) {
                return (T) objectMapper.readValue(json, new TypeReference<List<Object>>() {});
            }
            return objectMapper.readValue(json, new TypeReference<T>() {});
        } catch (Exception e) {
            return fallback;
        }
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) return value;
        }
        return null;
    }
}
