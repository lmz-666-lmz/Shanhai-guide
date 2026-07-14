package com.shanhai.guide.entity.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class ChatReply {

    private String answer;

    private List<ChatSource> sources = new ArrayList<>();

    private String cardType = "none";

    private String responseType = "text";

    private List<SpotRecommendation> spotRecommendations = new ArrayList<>();

    private SpotRecommendation primarySpot;

    private AiRoutePlan routePlan;

    private String clarification;

    private String emotion = "neutral";

    private List<SuggestedAction> suggestedActions = new ArrayList<>();

    public static ChatReply of(String answer) {
        ChatReply reply = new ChatReply();
        reply.setAnswer(answer);
        return reply;
    }

    /** Convenience: add a single suggested action and return self for chaining */
    public ChatReply withAction(SuggestedAction action) {
        if (this.suggestedActions == null) this.suggestedActions = new ArrayList<>();
        this.suggestedActions.add(action);
        return this;
    }

    /** Convenience: set suggested actions and return self for chaining */
    public ChatReply withActions(List<SuggestedAction> actions) {
        this.suggestedActions = actions;
        return this;
    }
}
