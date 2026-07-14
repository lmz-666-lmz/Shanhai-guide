package com.shanhai.guide.service;

import com.shanhai.guide.entity.dto.ChatReply;
import com.shanhai.guide.entity.dto.AiRoutePlan;
import com.shanhai.guide.entity.dto.AiRoutePlanRequest;
import com.shanhai.guide.entity.dto.DialogState;

public interface AiService {

    ChatReply chat(String userContent, String userMode);

    ChatReply chat(String userContent, String userMode, Double startLng, Double startLat, String locationLabel);

    ChatReply chat(String userContent, String userMode, Double startLng, Double startLat, String locationLabel, String startMode);

    ChatReply chat(String sessionId, String userContent, String userMode, Double startLng, Double startLat, String locationLabel, String startMode);

    AiRoutePlan planRoute(AiRoutePlanRequest request, String userMode);

    /** Get dialog state for a session (may return null if no pending state) */
    DialogState getDialogState(String sessionId);

    /**
     * Execute a structured suggested action.
     * @param sessionId the chat session
     * @param actionType machine-readable action type
     * @param actionId unique action id for idempotency
     * @param payload structured payload from the SuggestedAction
     * @param userMode user mode
     * @param startLng optional current longitude
     * @param startLat optional current latitude
     * @param locationLabel optional location label
     * @param startMode optional start mode
     * @return ChatReply with the result of the action
     */
    ChatReply executeAction(String sessionId, String actionType, String actionId, java.util.Map<String, Object> payload,
                           String userMode, Double startLng, Double startLat, String locationLabel, String startMode);
}
