package com.shanhai.guide.entity.dto;

import lombok.Data;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Per-session dialog state tracking — prevents confirmation loops and context pollution.
 * Stores pending action and route draft so that confirmations execute the original draft
 * without re-planning, and new questions clear incompatible state.
 *
 * TTL: states inactive for 30 minutes are eligible for cleanup.
 */
@Data
public class DialogState {

    public enum PendingAction {
        NONE,
        ROUTE_PLAN,
        NAVIGATION,
        SPOT_INTRO,
        CLARIFICATION
    }

    public enum DraftStatus {
        DRAFT,
        AWAITING_CONFIRMATION,
        CONFIRMED,
        EXECUTED,
        CANCELLED
    }

    public static final long TTL_SECONDS = 30 * 60; // 30 minutes

    private String sessionId;
    private PendingAction pendingAction = PendingAction.NONE;
    private boolean awaitingConfirmation;
    private boolean confirmed;

    /** Number of times the same question has been asked — cap at 1 */
    private int clarificationCount;

    /** Last primary spot ID discussed, for "带我去这里" follow-up */
    private Long lastPrimarySpotId;

    private RouteDraft routeDraft;

    /** Idempotent action tracking: sessionId + actionId already processed */
    private Set<String> processedActionIds = new LinkedHashSet<>();

    /** Cached result for idempotent replay (e.g., route plan card after confirm) */
    private Object lastActionResult;

    private Instant createdAt = Instant.now();
    private Instant updatedAt = Instant.now();

    @Data
    public static class RouteDraft {
        /** Unique draft identifier — used for idempotent confirmation */
        private String draftId = UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        /** Monotonically increasing version; old-version confirmations are rejected */
        private int version = 1;
        private DraftStatus status = DraftStatus.DRAFT;

        private String routeType;       // "official" | "ai" | "navigation"
        private String sourceType;      // "official" | "ai" | "navigation"
        private Long startSpotId;
        private String startLabel;
        private Double startLng;
        private Double startLat;
        private String startMode;
        private List<Long> waypointSpotIds;
        private Long endSpotId;
        private String endLabel;
        private int durationMinutes;
        private int distanceMeter;
        private String audience;
        private String routeName;
        private List<String> spotNames;  // ordered spot names for display

        // --- The actual route plan generated for this draft (immutable once confirmed) ---
        private AiRoutePlan frozenPlan;

        public RouteDraft incrementVersion() {
            this.version++;
            return this;
        }

        public boolean isExecutable() {
            return status == DraftStatus.AWAITING_CONFIRMATION && frozenPlan != null;
        }

        public boolean isCancelled() {
            return status == DraftStatus.CANCELLED || status == DraftStatus.EXECUTED;
        }
    }

    public void touch() {
        this.updatedAt = Instant.now();
    }

    public boolean isExpired() {
        return Instant.now().isAfter(updatedAt.plusSeconds(TTL_SECONDS));
    }

    public void clear() {
        this.pendingAction = PendingAction.NONE;
        this.awaitingConfirmation = false;
        this.confirmed = false;
        this.clarificationCount = 0;
        this.routeDraft = null;
        this.processedActionIds.clear();
        this.lastActionResult = null;
        touch();
    }

    /** Track that an actionId was processed — returns true if it's new (not a duplicate) */
    public boolean markActionProcessed(String actionId) {
        if (actionId == null || actionId.isBlank()) return true;
        boolean added = processedActionIds.add(actionId);
        touch();
        return added;
    }

    public boolean isActionProcessed(String actionId) {
        return actionId != null && processedActionIds.contains(actionId);
    }

    public boolean shouldExecuteDraft(String userText) {
        if (routeDraft == null || !routeDraft.isExecutable()) return false;
        String normalized = userText == null ? "" : userText.trim().replaceAll("[\\s,，。！？?!.;；:：]+", "");
        // Match short confirmations
        if (normalized.length() <= 6
                && java.util.Set.of("确定", "可以", "就这样", "开始", "好", "没问题", "行", "是的", "ok", "yes", "确认",
                                   "接受", "同意", "没错", "对", "嗯", "恩", "要的", "走", "出发", "出发吧")
                .contains(normalized.toLowerCase())) {
            return true;
        }
        // Match "接受X分钟" / "接受X分钟路线方案" / "接受X分钟方案" patterns
        // This handles legacy text-based confirmation while structured actions are the primary path
        if (normalized.length() <= 12 && java.util.regex.Pattern.compile("接受\\d+分钟.*").matcher(normalized).matches()) {
            return true;
        }
        return false;
    }

    public boolean isModifyingDraft(String userText) {
        if (routeDraft == null) return false;
        String text = userText == null ? "" : userText;
        return text.contains("改成") || text.contains("换成") || text.contains("换一个")
                || text.contains("不去") || text.contains("不要") || text.contains("去掉")
                || text.contains("再加") || text.contains("增加") || text.contains("调整");
    }

    private static String normalize(String text) {
        return text == null ? "" : text.toLowerCase(java.util.Locale.ROOT)
                .replaceAll("[\\s,，。！？?!.;；:：、()（）【】\\[\\]\"'\"\"''+]+", "")
                .trim();
    }

    public boolean isNewTopic(String userText) {
        if (pendingAction == PendingAction.NONE) return false;
        String normalized = normalize(userText);
        if (normalized.contains("开放时间")
                || normalized.contains("介绍")
                || normalized.contains("讲解")) {
            return pendingAction == PendingAction.ROUTE_PLAN
                    || pendingAction == PendingAction.NAVIGATION;
        }
        return false;
    }
}
