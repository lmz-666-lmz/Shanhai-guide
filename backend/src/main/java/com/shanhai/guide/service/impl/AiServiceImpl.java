package com.shanhai.guide.service.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.shanhai.guide.entity.TCampusActivity;
import com.shanhai.guide.entity.TCampusRoute;
import com.shanhai.guide.entity.TCampusSpot;
import com.shanhai.guide.entity.TKnowledge;
import com.shanhai.guide.entity.dto.ActionType;
import com.shanhai.guide.entity.dto.AiRoutePlan;
import com.shanhai.guide.entity.dto.AiRoutePlanRequest;
import com.shanhai.guide.entity.dto.AiRouteSpot;
import com.shanhai.guide.entity.dto.ChatReply;
import com.shanhai.guide.entity.dto.ChatSource;
import com.shanhai.guide.entity.dto.DialogState;
import com.shanhai.guide.entity.dto.SpotRecommendation;
import com.shanhai.guide.entity.dto.SuggestedAction;
import com.shanhai.guide.exception.BusinessException;
import com.shanhai.guide.service.AiService;
import com.shanhai.guide.service.CampusActivityService;
import com.shanhai.guide.service.CampusRouteService;
import com.shanhai.guide.service.CampusSpotService;
import com.shanhai.guide.service.KnowledgeService;
import com.shanhai.guide.service.TimeProvider;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Slf4j
@Service
public class AiServiceImpl implements AiService {

    private static final Pattern MINUTE_PATTERN = Pattern.compile("(\\d+)\\s*(分钟|分|min|m)", Pattern.CASE_INSENSITIVE);
    private static final Pattern HOUR_PATTERN = Pattern.compile("(\\d+)\\s*(小时|个小时|h)", Pattern.CASE_INSENSITIVE);
    private static final DateTimeFormatter ACTIVITY_TIME_FORMATTER = DateTimeFormatter.ofPattern("MM月dd日 HH:mm");
    private static final int DEFAULT_DURATION_MINUTE = 60;
    private static final int DEFAULT_WALK_MINUTE = 8;

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final CampusSpotService campusSpotService;
    private final CampusRouteService campusRouteService;
    private final CampusActivityService campusActivityService;
    private final KnowledgeService knowledgeService;
    private final java.util.concurrent.ConcurrentHashMap<String, DialogState> dialogStates = new java.util.concurrent.ConcurrentHashMap<>();

    @Value("${ai.deepseek.api-key:}")
    private String apiKey;

    @Value("${ai.deepseek.model:deepseek-chat}")
    private String model;

    public AiServiceImpl(CampusSpotService campusSpotService,
                         CampusRouteService campusRouteService,
                         CampusActivityService campusActivityService,
                         KnowledgeService knowledgeService) {
        this.httpClient = HttpClient.newHttpClient();
        this.objectMapper = new ObjectMapper();
        this.campusSpotService = campusSpotService;
        this.campusRouteService = campusRouteService;
        this.campusActivityService = campusActivityService;
        this.knowledgeService = knowledgeService;
    }

    @Override
    public ChatReply chat(String userContent, String userMode) {
        return chat(userContent, userMode, null, null, null);
    }

    @Override
    public ChatReply chat(String userContent, String userMode, Double startLng, Double startLat, String locationLabel) {
        return chat(userContent, userMode, startLng, startLat, locationLabel, null);
    }

    /**
     * 带位置上下文的聊天。
     * @param startLng 地图当前经度（可选）
     * @param startLat 地图当前纬度（可选）
     * @param locationLabel 位置标签，如 "当前位置" / "演示位置" / "手动起点"
     */
    @Override
    public ChatReply chat(String sessionId, String userContent, String userMode, Double startLng, Double startLat, String locationLabel, String startMode) {
        List<TCampusSpot> enabledSpots = safeEnabledSpots(userMode);
        boolean hasLocation = startLng != null && startLat != null;

        // TTL cleanup: remove expired dialog states (runs inline, O(n) but n is small)
        cleanupExpiredStates();

        DialogState dialogState = dialogStates.computeIfAbsent(sessionId, k -> { DialogState ds = new DialogState(); ds.setSessionId(k); return ds; });

        // 1. Check if user is confirming a pending route draft
        if (dialogState.shouldExecuteDraft(userContent)) {
            dialogState.setConfirmed(true);
            dialogState.setAwaitingConfirmation(false);
            DialogState.RouteDraft draft = dialogState.getRouteDraft();
            dialogState.clear();
            return executeConfirmedDraft(draft, userMode, userContent);
        }

        // 2. Check if user is modifying a pending draft
        if (dialogState.isModifyingDraft(userContent)) {
            dialogState.setAwaitingConfirmation(false); // let re-planning happen
            // keep the draft for reference but reset confirmation
        }

        // 3. Check if user asked a new topic while there's a pending action
        if (dialogState.isNewTopic(userContent)) {
            dialogState.clear();
        }

        AiIntentParser.AiIntentResult intent = AiIntentParser.parse(userContent, enabledSpots, hasLocation);
        intent = refineIntentWithDeepSeek(userContent, enabledSpots, hasLocation, intent);

        if (intent.needsClarification()) {
            dialogState.setPendingAction(DialogState.PendingAction.CLARIFICATION);
            dialogState.setClarificationCount(dialogState.getClarificationCount() + 1);
            dialogState.touch();
            return buildClarificationReply(intent, userContent);
        }

        if (intent.intent() == AiIntentParser.Intent.ROUTE_PLAN || intent.intent() == AiIntentParser.Intent.NAVIGATION) {
            dialogState.setPendingAction(DialogState.PendingAction.ROUTE_PLAN);
            dialogState.touch();
            List<TKnowledge> knowledgeMatches = safeKnowledgeSearch(userContent, userMode, 3);
            ChatReply reply = buildRouteChatReply(userContent, userMode, knowledgeMatches, startLng, startLat, locationLabel, startMode, intent);
            // Store route draft if created
            if (reply.getRoutePlan() != null) {
                storeRouteDraft(dialogState, reply, intent);
            } else if (reply.getClarification() != null) {
                // Build a frozen draft for the minimal-feasible route so confirmation can execute it
                buildClarificationDraft(dialogState, reply, userContent, userMode, startLng, startLat, locationLabel, startMode, intent);
            }
            incrementKnowledgeViewCount(knowledgeMatches);
            return reply;
        }

        // Clear route-related state for non-route intents
        if (dialogState.getPendingAction() == DialogState.PendingAction.ROUTE_PLAN
                || dialogState.getPendingAction() == DialogState.PendingAction.NAVIGATION) {
            dialogState.clear();
        }

        if (intent.intent() == AiIntentParser.Intent.SPOT_INTRO || intent.intent() == AiIntentParser.Intent.SPOT_OPEN_HOURS) {
            dialogState.setPendingAction(DialogState.PendingAction.SPOT_INTRO);
            if (!intent.entities().spots().isEmpty()) {
                dialogState.setLastPrimarySpotId(intent.entities().spots().get(0).resolvedSpotId());
            }
            dialogState.touch();
            return buildSpotIntroReply(userContent, userMode, intent);
        }

        if (intent.intent() == AiIntentParser.Intent.SPOT_RECOMMENDATION || intent.intent() == AiIntentParser.Intent.NEARBY_RECOMMENDATION) {
            dialogState.clear();
            return buildSpotRecommendationReply(userContent, userMode, intent, enabledSpots);
        }

        // 6. "讲解当前点位" / "当前点位是什么" → location-based nearest spot intro
        if (isCurrentSpotQuery(userContent)) {
            dialogState.clear();
            dialogState.touch();
            return executeIntroduceCurrentSpot(dialogState, Map.of(), userMode,
                    startLng, startLat, locationLabel, startMode);
        }

        // 7. Facility queries: toilets, cafeteria, library hours, accessibility, etc.
        if (isFacilityQuery(userContent)) {
            dialogState.clear();
            dialogState.touch();
            return buildFacilityReply(userContent, userMode, startLng, startLat, locationLabel, startMode, enabledSpots);
        }

        // 8. Activity queries: 今天/明天/本周有什么活动 → 确定性查询，不经过 DeepSeek
        if (isActivityQuestion(userContent)) {
            dialogState.clear();
            dialogState.touch();
            return buildActivityReply(userContent, userMode);
        }

        dialogState.clear();
        return buildGeneralChatReply(userContent, userMode);
    }

    @Override
    public DialogState getDialogState(String sessionId) {
        return dialogStates.get(sessionId);
    }

    /** Remove dialog states that have been inactive for longer than TTL */
    private void cleanupExpiredStates() {
        var now = java.time.Instant.now();
        var iter = dialogStates.entrySet().iterator();
        int removed = 0;
        while (iter.hasNext()) {
            var entry = iter.next();
            if (entry.getValue().isExpired()) {
                iter.remove();
                removed++;
            }
        }
        if (removed > 0) {
            log.info("Cleaned up {} expired dialog states", removed);
        }
    }

    @Override
    public ChatReply executeAction(String sessionId, String actionType, String actionId,
                                    Map<String, Object> payload, String userMode,
                                    Double startLng, Double startLat, String locationLabel, String startMode) {
        DialogState state = dialogStates.computeIfAbsent(sessionId,
            k -> { DialogState ds = new DialogState(); ds.setSessionId(k); return ds; });

        // Idempotency check: return cached result if already processed
        if (actionId != null && !actionId.isBlank() && state.isActionProcessed(actionId)) {
            log.info("Action already processed: sessionId={}, actionId={}", sessionId, actionId);
            if (state.getLastActionResult() instanceof ChatReply cached) {
                log.info("Returning cached action result for idempotent replay");
                return cached;
            }
            // No cached result — return a clear acknowledgment
            ChatReply dup = new ChatReply();
            dup.setAnswer("该操作已执行，请查看上方结果。");
            dup.setCardType("none");
            dup.setResponseType("text");
            return dup;
        }

        ActionType type;
        try {
            type = ActionType.valueOf(actionType);
        } catch (IllegalArgumentException e) {
            log.warn("Unknown actionType: {}", actionType);
            ChatReply err = new ChatReply();
            err.setAnswer("该操作暂不可用。");
            err.setCardType("none");
            err.setResponseType("text");
            return err;
        }

        state.markActionProcessed(actionId);
        ChatReply result = dispatchAction(state, type, payload, userMode, startLng, startLat, locationLabel, startMode, sessionId);
        result.setSuggestedActions(filterExecutableActions(result.getSuggestedActions()));

        // Cache result for idempotent replay (for CONFIRM_ROUTE_DRAFT, START_SPOT_NAVIGATION, etc.)
        state.setLastActionResult(result);

        return result;
    }

    /**
     * Main action dispatcher — every returned actionType must have a case here.
     */
    private ChatReply dispatchAction(DialogState state, ActionType type, Map<String, Object> payload,
                                      String userMode, Double startLng, Double startLat,
                                      String locationLabel, String startMode, String sessionId) {
        return switch (type) {
            case CONFIRM_ROUTE_DRAFT -> executeConfirmRouteDraft(state, payload, userMode);
            case MODIFY_ROUTE_DURATION -> executeModifyDuration(state, payload, userMode, startLng, startLat, locationLabel, startMode);
            case CONVERT_TO_SINGLE_SPOT -> executeConvertToSingleSpot(state, payload, userMode, startLng, startLat, locationLabel, startMode);
            case RESELECT_ROUTE_START -> executeReselectStart(state, payload, userMode);
            case PLAN_RECOMMENDED_SPOTS -> executePlanRecommendedSpots(state, payload, userMode, startLng, startLat, locationLabel, startMode);
            case OPEN_SPOT_ON_MAP, VIEW_SPOTS_ON_MAP -> executeOpenSpotOnMap(payload);
            case START_SPOT_NAVIGATION -> executeStartSpotNavigation(state, payload, userMode, startLng, startLat, locationLabel, startMode);
            case OPEN_ROUTE_ON_MAP, OPEN_ROUTE_CARD -> executeOpenRouteOnMap(payload);
            case START_ROUTE_NAVIGATION -> executeStartRouteNavigation(payload);
            case FAVORITE_ROUTE -> executeFavoriteRoute(payload, sessionId);
            case ASK_SPOT_INTRO -> executeAskSpotIntro(payload, userMode);
            case ASK_OPEN_STATUS -> executeAskOpenStatus(payload, userMode);
            case FIND_NEAREST_RESTROOM -> executeFindNearestRestroom(payload, userMode, startLng, startLat, locationLabel, startMode);
            case FIND_NEAREST_FACILITY -> executeFindNearestFacility(payload, userMode, startLng, startLat, locationLabel, startMode);
            case INTRODUCE_CURRENT_SPOT -> executeIntroduceCurrentSpot(state, payload, userMode, startLng, startLat, locationLabel, startMode);
            case USE_CURRENT_LOCATION, USE_DEMO_LOCATION, SELECT_MANUAL_START -> executeLocationAction(type, payload);
            case CONTINUE_QUESTION, ASK_ANOTHER_QUESTION -> executeContinueQuestion(payload);
            case VIEW_RECENT_ACTIVITIES -> executeViewActivities(userMode);
            case ADJUST_DURATION -> executeModifyDuration(state, payload, userMode, startLng, startLat, locationLabel, startMode);
        };
    }

    // ==================== Action executors ====================

    private ChatReply executeConfirmRouteDraft(DialogState state, Map<String, Object> payload, String userMode) {
        String draftId = payloadString(payload, "draftId");
        int draftVersion = payloadInt(payload, "draftVersion", 1);

        DialogState.RouteDraft draft = state.getRouteDraft();
        if (draft == null) {
            return errorReply("路线方案已失效，请重新规划。");
        }
        if (!draft.getDraftId().equals(draftId)) {
            return errorReply("当前路线方案已变更，请查看最新方案。");
        }
        if (draft.getVersion() != draftVersion) {
            return errorReply("路线方案版本已更新（v" + draft.getVersion() + "），请确认最新方案。");
        }
        if (draft.getStatus() == DialogState.DraftStatus.EXECUTED) {
            // Already executed — return the same result
            AiRoutePlan plan = draft.getFrozenPlan();
            ChatReply reply = new ChatReply();
            reply.setAnswer("路线已确认：约 " + (plan != null ? plan.getTotalMinute() : draft.getDurationMinutes()) + " 分钟方案。");
            reply.setCardType("route_plan");
            reply.setResponseType("route_plan");
            reply.setRoutePlan(plan);
            reply.setSuggestedActions(List.of(
                SuggestedAction.of(ActionType.OPEN_ROUTE_ON_MAP, "在地图查看"),
                SuggestedAction.of(ActionType.START_ROUTE_NAVIGATION, "开始导航"),
                SuggestedAction.of(ActionType.FAVORITE_ROUTE, "收藏路线")
            ));
            return reply;
        }
        if (!draft.isExecutable()) {
            return errorReply("路线方案状态不正确，无法执行。请重新规划。");
        }

        // Execute the frozen draft — NO re-planning
        draft.setStatus(DialogState.DraftStatus.EXECUTED);
        AiRoutePlan plan = draft.getFrozenPlan();
        state.setConfirmed(true);
        state.setAwaitingConfirmation(false);
        state.touch();

        String startLabel = (plan.getStartLabel() != null && !plan.getStartLabel().isBlank())
                ? plan.getStartLabel() : "路线第一站";
        ChatReply reply = new ChatReply();
        reply.setAnswer("已为你确认 " + plan.getTotalMinute() + " 分钟路线方案，共 " + plan.getSpots().size() + " 个点位。起点：" + startLabel + "。");
        reply.setCardType("route_plan");
        reply.setResponseType("route_plan");
        reply.setRoutePlan(plan);
        reply.setSuggestedActions(List.of(
            SuggestedAction.of(ActionType.OPEN_ROUTE_ON_MAP, "在地图查看"),
            SuggestedAction.of(ActionType.START_ROUTE_NAVIGATION, "开始导航"),
            SuggestedAction.of(ActionType.FAVORITE_ROUTE, "收藏路线")
        ));
        return reply;
    }

    private ChatReply executeModifyDuration(DialogState state, Map<String, Object> payload,
                                             String userMode, Double startLng, Double startLat,
                                             String locationLabel, String startMode) {
        int newDuration = payloadInt(payload, "durationMinutes", DEFAULT_DURATION_MINUTE);
        DialogState.RouteDraft draft = state.getRouteDraft();
        if (draft != null) {
            draft.incrementVersion();
            draft.setDurationMinutes(newDuration);
            draft.setStatus(DialogState.DraftStatus.DRAFT);
        }

        // Re-plan with new duration
        AiRoutePlanRequest request = new AiRoutePlanRequest();
        request.setDurationMinute(newDuration);
        request.setUserMode(userMode);
        if (startLng != null && startLat != null) {
            request.setStartLng(startLng);
            request.setStartLat(startLat);
            request.setLocationLabel(locationLabel);
            request.setStartMode(startMode);
        }
        try {
            AiRoutePlan plan = planRoute(request, userMode);
            ChatReply reply = new ChatReply();
            reply.setAnswer("已调整为约 " + plan.getTotalMinute() + " 分钟路线，共 " + plan.getSpots().size() + " 个点位。");
            reply.setCardType("route_plan");
            reply.setResponseType("route_plan");
            reply.setRoutePlan(plan);
            reply.setSuggestedActions(List.of(
                SuggestedAction.of(ActionType.OPEN_ROUTE_ON_MAP, "在地图查看"),
                SuggestedAction.of(ActionType.START_ROUTE_NAVIGATION, "开始导航"),
                SuggestedAction.of(ActionType.FAVORITE_ROUTE, "收藏路线")
            ));

            // Update draft
            if (draft != null) {
                draft.setFrozenPlan(plan);
                draft.setStatus(DialogState.DraftStatus.EXECUTED);
            }
            return reply;
        } catch (BusinessException e) {
            return errorReply(e.getMessage());
        }
    }

    private ChatReply executeConvertToSingleSpot(DialogState state, Map<String, Object> payload,
                                                  String userMode, Double startLng, Double startLat,
                                                  String locationLabel, String startMode) {
        DialogState.RouteDraft draft = state.getRouteDraft();
        List<TCampusSpot> enabledSpots = safeEnabledSpots(userMode);

        // Try to get spots from the draft
        if (draft != null && draft.getWaypointSpotIds() != null && !draft.getWaypointSpotIds().isEmpty()) {
            List<Long> spotIds = draft.getWaypointSpotIds();
            List<TCampusSpot> spots = enabledSpots.stream()
                .filter(s -> spotIds.contains(s.getId()))
                .limit(3)
                .toList();

            if (spots.size() == 1) {
                // Single spot — return point card directly
                return buildSingleSpotCardReply(spots.get(0), userMode);
            } else if (spots.size() > 1) {
                // Multiple spots — ask user to pick one
                ChatReply reply = new ChatReply();
                reply.setAnswer("你想去以下哪个点位？");
                reply.setCardType("spot_list");
                reply.setResponseType("spot_list");
                reply.setSpotRecommendations(spots.stream()
                    .map(s -> toSpotRecommendation(s, "从路线方案中提取"))
                    .toList());
                List<SuggestedAction> actions = new ArrayList<>();
                for (TCampusSpot spot : spots) {
                    actions.add(SuggestedAction.of(ActionType.START_SPOT_NAVIGATION, spot.getSpotName(),
                        Map.of("spotId", spot.getId(), "spotName", spot.getSpotName(),
                               "longitude", spot.getLongitude(), "latitude", spot.getLatitude())));
                }
                reply.setSuggestedActions(actions);
                return reply;
            }
        }

        return errorReply("当前没有可转为单点导览的点位。请先询问点位推荐或路线。");
    }

    private ChatReply executeReselectStart(DialogState state, Map<String, Object> payload, String userMode) {
        // 起点选择已移至地图页，数字人不再处理起点选择
        ChatReply reply = new ChatReply();
        reply.setAnswer("路线已生成。可以在地图页预览完整路线，开始游览时选择起点（当前位置、手动选点或演示位置）。");
        reply.setCardType("none");
        reply.setResponseType("text");
        reply.setSuggestedActions(List.of(
            SuggestedAction.of(ActionType.OPEN_ROUTE_ON_MAP, "在地图中预览"),
            SuggestedAction.of(ActionType.CONTINUE_QUESTION, "换一条路线")
        ));
        return reply;
    }

    private ChatReply executePlanRecommendedSpots(DialogState state, Map<String, Object> payload, String userMode,
                                                   Double startLng, Double startLat,
                                                   String locationLabel, String startMode) {
        @SuppressWarnings("unchecked")
        List<Object> rawIds = (List<Object>) payload.getOrDefault("spotIds", List.of());
        List<Long> spotIds = rawIds.stream()
            .map(item -> item instanceof Number n ? n.longValue() : Long.parseLong(item.toString()))
            .toList();

        if (spotIds.isEmpty()) {
            return errorReply("没有可用的推荐点位。请先询问点位推荐。");
        }

        AiRoutePlanRequest request = new AiRoutePlanRequest();
        request.setUserMode(userMode);
        request.setOrderedSpotIds(spotIds);
        if (startLng != null && startLat != null) {
            request.setStartLng(startLng);
            request.setStartLat(startLat);
            request.setLocationLabel(locationLabel);
            request.setStartMode(startMode);
        }

        try {
            AiRoutePlan plan = planRoute(request, userMode);
            String startLabel = (plan.getStartLabel() != null && !plan.getStartLabel().isBlank())
                    ? plan.getStartLabel() : "路线第一站";
            ChatReply reply = new ChatReply();
            reply.setAnswer("已为你规划串联路线，约 " + plan.getTotalMinute() + " 分钟，共 " + plan.getSpots().size() + " 个点位。起点：" + startLabel + "。");
            reply.setCardType("route_plan");
            reply.setResponseType("route_plan");
            reply.setRoutePlan(plan);
            reply.setSuggestedActions(List.of(
                SuggestedAction.of(ActionType.OPEN_ROUTE_ON_MAP, "在地图查看"),
                SuggestedAction.of(ActionType.START_ROUTE_NAVIGATION, "开始导航"),
                SuggestedAction.of(ActionType.FAVORITE_ROUTE, "收藏路线")
            ));

            // Store as executed draft
            DialogState.RouteDraft draft = new DialogState.RouteDraft();
            draft.setRouteType("ai");
            draft.setSourceType("ai");
            draft.setFrozenPlan(plan);
            draft.setDurationMinutes(plan.getTotalMinute() != null ? plan.getTotalMinute() : 0);
            draft.setRouteName(plan.getRouteName());
            draft.setStartLabel(startLabel);
            if (plan.getSpots() != null) {
                draft.setSpotNames(plan.getSpots().stream().map(AiRouteSpot::getSpotName).toList());
                draft.setWaypointSpotIds(plan.getSpots().stream().map(AiRouteSpot::getSpotId).toList());
            }
            draft.setStatus(DialogState.DraftStatus.EXECUTED);
            return reply;
        } catch (BusinessException e) {
            log.info("Plan recommended spots needs confirmation: {}", e.getMessage());
            // Extract feasible duration from the exception message
            java.util.regex.Matcher durationMatcher = java.util.regex.Pattern.compile("(\\d+)\\s*分钟").matcher(e.getMessage());
            int feasibleMinute = durationMatcher.find() ? Integer.parseInt(durationMatcher.group(1)) : DEFAULT_DURATION_MINUTE;

            // Build a frozen plan for the feasible duration
            AiRoutePlanRequest feasibleRequest = new AiRoutePlanRequest();
            feasibleRequest.setUserMode(userMode);
            feasibleRequest.setDurationMinute(feasibleMinute);
            feasibleRequest.setOrderedSpotIds(spotIds);
            if (startLng != null && startLat != null) {
                feasibleRequest.setStartLng(startLng);
                feasibleRequest.setStartLat(startLat);
                feasibleRequest.setLocationLabel(locationLabel);
                feasibleRequest.setStartMode(startMode);
            }

            AiRoutePlan frozenPlan = null;
            try {
                frozenPlan = planRoute(feasibleRequest, userMode);
            } catch (Exception planEx) {
                log.info("Could not pre-build clarification draft for recommended spots: {}", planEx.getMessage());
                return errorReply(e.getMessage());
            }

            // Create a draft for confirmation
            DialogState.RouteDraft draft = new DialogState.RouteDraft();
            draft.setRouteType("ai");
            draft.setSourceType("ai");
            draft.setDurationMinutes(frozenPlan.getTotalMinute() != null ? frozenPlan.getTotalMinute() : feasibleMinute);
            draft.setRouteName(frozenPlan.getRouteName());
            draft.setStartLabel(frozenPlan.getStartLabel());
            draft.setStartLng(frozenPlan.getStartLng() != null ? frozenPlan.getStartLng().doubleValue() : null);
            draft.setStartLat(frozenPlan.getStartLat() != null ? frozenPlan.getStartLat().doubleValue() : null);
            draft.setStartMode(frozenPlan.getStartMode());
            if (frozenPlan.getSpots() != null) {
                draft.setSpotNames(frozenPlan.getSpots().stream().map(AiRouteSpot::getSpotName).toList());
                draft.setWaypointSpotIds(frozenPlan.getSpots().stream().map(AiRouteSpot::getSpotId).toList());
            }
            draft.setFrozenPlan(frozenPlan);
            draft.setStatus(DialogState.DraftStatus.AWAITING_CONFIRMATION);

            // Store the draft in dialog state for later confirmation
            state.setRouteDraft(draft);
            state.setAwaitingConfirmation(false); // structured confirm only
            state.setPendingAction(DialogState.PendingAction.ROUTE_PLAN);
            state.touch();

            String acceptLabel = "接受 " + draft.getDurationMinutes() + " 分钟";
            ChatReply reply = new ChatReply();
            reply.setAnswer(e.getMessage());
            reply.setCardType("none");
            reply.setResponseType("clarification");
            reply.setClarification(e.getMessage());
            reply.setSuggestedActions(List.of(
                SuggestedAction.of(ActionType.CONFIRM_ROUTE_DRAFT, acceptLabel,
                    Map.of("draftId", draft.getDraftId(), "draftVersion", String.valueOf(draft.getVersion()),
                           "durationMinutes", String.valueOf(draft.getDurationMinutes()))),
                SuggestedAction.of(ActionType.CONVERT_TO_SINGLE_SPOT, "改为单点导览",
                    Map.of("draftId", draft.getDraftId())),
                SuggestedAction.of(ActionType.ADJUST_DURATION, "调整游览时间",
                    Map.of("draftId", draft.getDraftId()))
            ));
            return reply;
        }
    }

    private ChatReply executeOpenSpotOnMap(Map<String, Object> payload) {
        Long spotId = payloadLong(payload, "spotId");
        ChatReply reply = new ChatReply();
        reply.setAnswer("已在地图定位该点位。");
        reply.setCardType("spot_intro");
        reply.setResponseType("spot_intro");
        reply.setSuggestedActions(List.of(
            SuggestedAction.of(ActionType.START_SPOT_NAVIGATION, "开始导航", payload),
            SuggestedAction.of(ActionType.ASK_SPOT_INTRO, "小海讲解", payload)
        ));
        return reply;
    }

    private ChatReply executeStartSpotNavigation(DialogState state, Map<String, Object> payload, String userMode,
                                                  Double startLng, Double startLat,
                                                  String locationLabel, String startMode) {
        Long spotId = payloadLong(payload, "spotId");
        String spotName = payloadString(payload, "spotName");
        if (spotId == null) {
            return errorReply("未指定导航目标点位。");
        }

        TCampusSpot spot = safeEnabledSpots(userMode).stream()
            .filter(s -> s.getId().equals(spotId))
            .findFirst().orElse(null);
        if (spot == null) {
            return errorReply("目标点位不存在或已禁用。");
        }

        AiRoutePlanRequest request = new AiRoutePlanRequest();
        request.setUserMode(userMode);
        request.setOrderedSpotIds(List.of(spotId));
        if (startLng != null && startLat != null) {
            request.setStartLng(startLng);
            request.setStartLat(startLat);
            request.setLocationLabel(locationLabel);
            request.setStartMode(startMode);
        }

        try {
            AiRoutePlan plan = planRoute(request, userMode);
            ChatReply reply = new ChatReply();
            reply.setAnswer("已规划到 " + (spotName != null ? spotName : spot.getSpotName()) + " 的路线，约 " + plan.getTotalMinute() + " 分钟。");
            reply.setCardType("route_plan");
            reply.setResponseType("route_plan");
            reply.setRoutePlan(plan);
            reply.setSuggestedActions(List.of(
                SuggestedAction.of(ActionType.OPEN_ROUTE_ON_MAP, "在地图查看"),
                SuggestedAction.of(ActionType.START_ROUTE_NAVIGATION, "开始导航")
            ));
            return reply;
        } catch (BusinessException e) {
            log.info("Start spot navigation needs confirmation: {}", e.getMessage());
            java.util.regex.Matcher durationMatcher = java.util.regex.Pattern.compile("(\\d+)\\s*分钟").matcher(e.getMessage());
            int feasibleMinute = durationMatcher.find() ? Integer.parseInt(durationMatcher.group(1)) : DEFAULT_DURATION_MINUTE;

            // Build a frozen plan for the feasible duration
            AiRoutePlanRequest feasibleRequest = new AiRoutePlanRequest();
            feasibleRequest.setUserMode(userMode);
            feasibleRequest.setDurationMinute(feasibleMinute);
            feasibleRequest.setOrderedSpotIds(List.of(spotId));
            if (startLng != null && startLat != null) {
                feasibleRequest.setStartLng(startLng);
                feasibleRequest.setStartLat(startLat);
                feasibleRequest.setLocationLabel(locationLabel);
                feasibleRequest.setStartMode(startMode);
            }

            AiRoutePlan frozenPlan;
            try {
                frozenPlan = planRoute(feasibleRequest, userMode);
            } catch (Exception planEx) {
                log.info("Could not pre-build clarification draft for spot navigation: {}", planEx.getMessage());
                return errorReply(e.getMessage());
            }

            DialogState.RouteDraft draft = new DialogState.RouteDraft();
            draft.setRouteType("navigation");
            draft.setSourceType("navigation");
            draft.setDurationMinutes(frozenPlan.getTotalMinute() != null ? frozenPlan.getTotalMinute() : feasibleMinute);
            draft.setStartLabel(frozenPlan.getStartLabel());
            draft.setStartLng(frozenPlan.getStartLng() != null ? frozenPlan.getStartLng().doubleValue() : null);
            draft.setStartLat(frozenPlan.getStartLat() != null ? frozenPlan.getStartLat().doubleValue() : null);
            draft.setStartMode(frozenPlan.getStartMode());
            if (frozenPlan.getSpots() != null) {
                draft.setSpotNames(frozenPlan.getSpots().stream().map(AiRouteSpot::getSpotName).toList());
                draft.setWaypointSpotIds(frozenPlan.getSpots().stream().map(AiRouteSpot::getSpotId).toList());
            }
            draft.setFrozenPlan(frozenPlan);
            draft.setStatus(DialogState.DraftStatus.AWAITING_CONFIRMATION);

            state.setRouteDraft(draft);
            state.setAwaitingConfirmation(false);
            state.setPendingAction(DialogState.PendingAction.NAVIGATION);
            state.touch();

            String acceptLabel = "接受 " + draft.getDurationMinutes() + " 分钟";
            ChatReply reply = new ChatReply();
            reply.setAnswer(e.getMessage());
            reply.setCardType("none");
            reply.setResponseType("clarification");
            reply.setClarification(e.getMessage());
            reply.setSuggestedActions(List.of(
                SuggestedAction.of(ActionType.CONFIRM_ROUTE_DRAFT, acceptLabel,
                    Map.of("draftId", draft.getDraftId(), "draftVersion", String.valueOf(draft.getVersion()),
                           "durationMinutes", String.valueOf(draft.getDurationMinutes()))),
                SuggestedAction.of(ActionType.CONTINUE_QUESTION, "换一个时长重试",
                    Map.of("draftId", draft.getDraftId()))
            ));
            return reply;
        }
    }

    private ChatReply executeOpenRouteOnMap(Map<String, Object> payload) {
        ChatReply reply = new ChatReply();
        reply.setAnswer("路线已在地图展示，可查看各站点顺序。");
        reply.setCardType("route_plan");
        reply.setResponseType("route_plan");
        reply.setSuggestedActions(List.of(
            SuggestedAction.of(ActionType.START_ROUTE_NAVIGATION, "开始导航"),
            SuggestedAction.of(ActionType.FAVORITE_ROUTE, "收藏路线")
        ));
        return reply;
    }

    private ChatReply executeStartRouteNavigation(Map<String, Object> payload) {
        ChatReply reply = new ChatReply();
        reply.setAnswer("导航已开始，跟随路线指引前往各站点。");
        reply.setCardType("route_plan");
        reply.setResponseType("route_plan");
        reply.setSuggestedActions(List.of(
            SuggestedAction.of(ActionType.OPEN_ROUTE_ON_MAP, "在地图查看")
        ));
        return reply;
    }

    private ChatReply executeFavoriteRoute(Map<String, Object> payload, String sessionId) {
        ChatReply reply = new ChatReply();
        reply.setAnswer("路线已收藏，可在个人路线中查看。");
        reply.setCardType("none");
        reply.setResponseType("text");
        reply.setSuggestedActions(List.of(
            SuggestedAction.of(ActionType.CONTINUE_QUESTION, "查看我的收藏")
        ));
        return reply;
    }

    private ChatReply executeAskSpotIntro(Map<String, Object> payload, String userMode) {
        Long spotId = payloadLong(payload, "spotId");
        if (spotId == null) {
            return errorReply("未指定讲解点位。");
        }
        TCampusSpot spot = safeEnabledSpots(userMode).stream()
            .filter(s -> s.getId().equals(spotId))
            .findFirst().orElse(null);
        if (spot == null) {
            return errorReply("该点位不可用。");
        }
        List<TKnowledge> knowledge = safeKnowledgeSearch(spot.getSpotName(), userMode, 3);
        return buildSingleSpotCardReply(spot, userMode);
    }

    private ChatReply executeAskOpenStatus(Map<String, Object> payload, String userMode) {
        Long spotId = payloadLong(payload, "spotId");
        if (spotId == null) {
            return errorReply("未指定查询点位。");
        }
        TCampusSpot spot = safeEnabledSpots(userMode).stream()
            .filter(s -> s.getId().equals(spotId))
            .findFirst().orElse(null);
        if (spot == null) {
            return errorReply("该点位不可用。");
        }
        String openTime = spot.getOpenTime() == null || spot.getOpenTime().isBlank()
                ? "以学校实际安排为准"
                : spot.getOpenTime();
        ChatReply reply = new ChatReply();
        reply.setAnswer(spot.getSpotName() + "开放时间：" + openTime + "。具体开放安排和临时调整以学校实际通知为准。");
        reply.setCardType("spot_intro");
        reply.setResponseType("spot_intro");
        reply.setPrimarySpot(toSpotRecommendation(spot, "开放时间查询"));
        reply.setSuggestedActions(List.of(
            SuggestedAction.of(ActionType.OPEN_SPOT_ON_MAP, "查看地图",
                Map.of("spotId", spot.getId(), "spotName", spot.getSpotName())),
            SuggestedAction.of(ActionType.START_SPOT_NAVIGATION, "开始导航",
                Map.of("spotId", spot.getId(), "spotName", spot.getSpotName()))
        ));
        return reply;
    }

    // ==================== Facility search ====================

    private ChatReply executeFindNearestRestroom(Map<String, Object> payload, String userMode,
                                                  Double startLng, Double startLat,
                                                  String locationLabel, String startMode) {
        return findNearestFacilityByCategory("卫生间", "厕所", userMode, startLng, startLat, locationLabel, startMode);
    }

    private ChatReply executeFindNearestFacility(Map<String, Object> payload, String userMode,
                                                  Double startLng, Double startLat,
                                                  String locationLabel, String startMode) {
        String category = payloadString(payload, "targetCategory");
        if (category == null || category.isBlank()) {
            return errorReply("请指定要查找的设施类型（如食堂、停车场、医务室）。");
        }
        return findNearestFacilityByCategory(category, null, userMode, startLng, startLat, locationLabel, startMode);
    }

    private ChatReply findNearestFacilityByCategory(String primaryCategory, String fallbackCategory,
                                                     String userMode, Double startLng, Double startLat,
                                                     String locationLabel, String startMode) {
        List<TCampusSpot> enabledSpots = safeEnabledSpots(userMode);
        // Match by spotType or spotName containing the category keywords
        List<TCampusSpot> matches = enabledSpots.stream()
            .filter(spot -> {
                String type = normalize(spot.getSpotType());
                String name = normalize(spot.getSpotName());
                return type.contains(normalize(primaryCategory))
                    || name.contains(normalize(primaryCategory))
                    || (fallbackCategory != null && (type.contains(normalize(fallbackCategory)) || name.contains(normalize(fallbackCategory))));
            })
            .toList();

        if (matches.isEmpty()) {
            ChatReply reply = new ChatReply();
            reply.setAnswer("当前点位库暂未收录" + primaryCategory + "位置。建议查看地图便民服务分类，或联系校园服务中心获取帮助。");
            reply.setCardType("none");
            reply.setResponseType("text");
            reply.setSuggestedActions(List.of(
                SuggestedAction.of(ActionType.CONTINUE_QUESTION, "查找其他设施"),
                SuggestedAction.of(ActionType.CONTINUE_QUESTION, "查看地图")
            ));
            return reply;
        }

        // Sort by distance from current location if available
        if (startLng != null && startLat != null) {
            matches = matches.stream()
                .sorted(Comparator.comparingDouble(spot -> {
                    if (spot.getLongitude() == null || spot.getLatitude() == null) return Double.MAX_VALUE;
                    return distanceMeters(
                        createTempSpot(startLng, startLat),
                        spot);
                }))
                .toList();
        }

        // Return top 1-3
        List<TCampusSpot> topMatches = matches.stream().limit(3).toList();
        List<SpotRecommendation> recommendations = topMatches.stream()
            .map(spot -> {
                SpotRecommendation rec = toSpotRecommendation(spot, primaryCategory + "匹配");
                // Add distance if we have location
                if (startLng != null && startLat != null && spot.getLongitude() != null && spot.getLatitude() != null) {
                    double dist = distanceMeters(createTempSpot(startLng, startLat), spot);
                    rec.setSpotDesc((rec.getSpotDesc() != null ? rec.getSpotDesc() : "") + " 约" + Math.round(dist) + "米");
                }
                return rec;
            })
            .toList();

        StringBuilder answer = new StringBuilder("为你找到最近的" + primaryCategory + "：\n");
        for (int i = 0; i < recommendations.size(); i++) {
            SpotRecommendation rec = recommendations.get(i);
            answer.append(i + 1).append(". ").append(rec.getSpotName());
            TCampusSpot spot = topMatches.get(i);
            if (spot.getOpenTime() != null && !spot.getOpenTime().isBlank()) {
                answer.append("（开放时间：").append(spot.getOpenTime()).append("）");
            }
            answer.append("\n");
        }

        ChatReply reply = new ChatReply();
        reply.setAnswer(answer.toString().trim());
        reply.setCardType("spot_list");
        reply.setResponseType("spot_list");
        reply.setSpotRecommendations(recommendations);

        // Build navigation actions for each match
        List<SuggestedAction> actions = new ArrayList<>();
        for (TCampusSpot spot : topMatches) {
            actions.add(SuggestedAction.of(ActionType.START_SPOT_NAVIGATION, "导航到 " + spot.getSpotName(),
                Map.of("spotId", spot.getId(), "spotName", spot.getSpotName(),
                       "longitude", spot.getLongitude(), "latitude", spot.getLatitude())));
        }
        reply.setSuggestedActions(actions);
        return reply;
    }

    private TCampusSpot createTempSpot(double lng, double lat) {
        TCampusSpot spot = new TCampusSpot();
        spot.setLongitude(BigDecimal.valueOf(lng));
        spot.setLatitude(BigDecimal.valueOf(lat));
        return spot;
    }

    // ==================== Location & generic actions ====================

    /**
     * Introduce the nearest campus spot based on current real/demo/manual location.
     * This is the executor for "讲解当前点位" and INTRODUCE_CURRENT_SPOT actions.
     * It reads the shared location context, finds the closest enabled spot, and returns
     * a spot_intro card with structured actions — never a clarification.
     */
    private ChatReply executeIntroduceCurrentSpot(DialogState state, Map<String, Object> payload,
                                                   String userMode, Double startLng, Double startLat,
                                                   String locationLabel, String startMode) {
        // Use location from payload first (frontend-sent), fallback to request params
        Double lng = payloadDouble(payload, "longitude");
        Double lat = payloadDouble(payload, "latitude");
        String locMode = payloadString(payload, "locationMode");
        Long updatedAt = payloadLong(payload, "updatedAt");

        // Fallback to request params if payload doesn't have position
        if (lng == null && startLng != null) lng = startLng;
        if (lat == null && startLat != null) lat = startLat;
        if (locMode == null && startMode != null) locMode = startMode;

        // No location available — return structured location selection
        if (lng == null || lat == null) {
            ChatReply reply = new ChatReply();
            reply.setAnswer("需要先确定你的位置，才能介绍当前点位。请选择起点方式：");
            reply.setCardType("none");
            reply.setResponseType("clarification");
            reply.setSuggestedActions(List.of(
                SuggestedAction.of(ActionType.USE_CURRENT_LOCATION, "使用当前位置"),
                SuggestedAction.of(ActionType.USE_DEMO_LOCATION, "使用演示位置"),
                SuggestedAction.of(ActionType.SELECT_MANUAL_START, "地图选择起点")
            ));
            return reply;
        }

        // Validate coordinates are in a reasonable range (China region)
        if (lng < 73 || lng > 135 || lat < 3 || lat > 54) {
            ChatReply reply = new ChatReply();
            reply.setAnswer("当前位置坐标异常，请在地图页重新定位后再试。");
            reply.setCardType("none");
            reply.setResponseType("text");
            reply.setSuggestedActions(List.of(
                SuggestedAction.of(ActionType.USE_CURRENT_LOCATION, "重新定位"),
                SuggestedAction.of(ActionType.USE_DEMO_LOCATION, "使用演示位置")
            ));
            return reply;
        }

        List<TCampusSpot> enabledSpots = safeEnabledSpots(userMode);
        if (enabledSpots.isEmpty()) {
            return errorReply("当前没有可用的校园点位。");
        }

        // Find nearest spot
        TCampusSpot tempLoc = createTempSpot(lng, lat);
        TCampusSpot nearest = enabledSpots.stream()
            .filter(s -> s.getLongitude() != null && s.getLatitude() != null)
            .min(Comparator.comparingDouble(s -> distanceMeters(tempLoc, s)))
            .orElse(null);

        if (nearest == null) {
            return errorReply("未找到附近的校园点位，请确认位置后重试。");
        }

        double dist = distanceMeters(tempLoc, nearest);
        String locLabel = locationLabel != null ? locationLabel :
            (locMode != null ? switch (locMode) {
                case "real" -> "当前位置";
                case "demo" -> "演示位置";
                case "manual" -> "手动起点";
                default -> "当前位置";
            } : "当前位置");

        // Build appropriate answer based on distance
        String answer;
        if (dist <= 50) {
            answer = "你当前位于" + nearest.getSpotName() + "附近，距离约" + Math.round(dist) + "米。";
        } else if (dist <= 200) {
            answer = "距离" + locLabel + "最近的是" + nearest.getSpotName() + "，约" + Math.round(dist) + "米。";
        } else {
            answer = locLabel + "附近最近的校园点位是" + nearest.getSpotName() + "，约" + Math.round(dist) + "米。";
        }

        ChatReply reply = new ChatReply();
        reply.setAnswer(answer);
        reply.setCardType("spot_intro");
        reply.setResponseType("spot_intro");
        reply.setPrimarySpot(toSpotRecommendation(nearest, "距离" + locLabel + "最近"));
        reply.setSpotRecommendations(List.of());
        reply.setRoutePlan(null);
        reply.setSuggestedActions(List.of(
            SuggestedAction.of(ActionType.ASK_SPOT_INTRO, "小海讲解",
                Map.of("spotId", nearest.getId(), "spotName", nearest.getSpotName(),
                       "longitude", nearest.getLongitude(), "latitude", nearest.getLatitude())),
            SuggestedAction.of(ActionType.OPEN_SPOT_ON_MAP, "查看地图",
                Map.of("spotId", nearest.getId(), "spotName", nearest.getSpotName(),
                       "longitude", nearest.getLongitude(), "latitude", nearest.getLatitude())),
            SuggestedAction.of(ActionType.START_SPOT_NAVIGATION, "开始导航",
                Map.of("spotId", nearest.getId(), "spotName", nearest.getSpotName(),
                       "longitude", nearest.getLongitude(), "latitude", nearest.getLatitude()))
        ));

        // Store context for follow-up
        state.setLastPrimarySpotId(nearest.getId());
        state.touch();
        return reply;
    }

    private ChatReply executeLocationAction(ActionType type, Map<String, Object> payload) {
        ChatReply reply = new ChatReply();
        String modeLabel = switch (type) {
            case USE_CURRENT_LOCATION -> "当前位置";
            case USE_DEMO_LOCATION -> "演示位置";
            case SELECT_MANUAL_START -> "手动选择起点";
            default -> "指定位置";
        };
        reply.setAnswer("已设置起点为" + modeLabel + "。请告诉我你想去哪里，或让我为你推荐路线。");
        reply.setCardType("none");
        reply.setResponseType("text");
        reply.setSuggestedActions(List.of(
            SuggestedAction.of(ActionType.CONTINUE_QUESTION, "规划一条路线"),
            SuggestedAction.of(ActionType.CONTINUE_QUESTION, "推荐校园必看点位")
        ));
        return reply;
    }

    private ChatReply executeContinueQuestion(Map<String, Object> payload) {
        // CONTINUE_QUESTION actions are rendered as text chips — the user types the label as a new question
        ChatReply reply = new ChatReply();
        reply.setAnswer("请继续提问，我会尽力为你解答。");
        reply.setCardType("none");
        reply.setResponseType("text");
        return reply;
    }

    private ChatReply executeViewActivities(String userMode) {
        return buildActivityReply("近期有什么活动", userMode);
    }

    /**
     * 确定性活动查询：根据用户问题中的时间关键词（今天/明天/本周/近期），
     * 使用服务器时钟过滤数据库中的真实活动，不经过 DeepSeek 生成日期。
     */
    private ChatReply buildActivityReply(String userContent, String userMode) {
        String normalized = normalize(userContent);
        List<TCampusActivity> allEnabled = campusActivityService.searchActivities(
            "guest".equals(userMode) ? null : userMode, null, 1);

        // 解析时间范围
        LocalDate today = TimeProvider.today();
        LocalDateTime rangeStart;
        LocalDateTime rangeEnd;
        String periodLabel;

        if (containsAny(normalized, "明天", "明日")) {
            rangeStart = today.plusDays(1).atStartOfDay();
            rangeEnd = today.plusDays(2).atStartOfDay();
            periodLabel = "明天（" + formatDate(today.plusDays(1)) + "）";
        } else if (containsAny(normalized, "今天", "今日")) {
            rangeStart = today.atStartOfDay();
            rangeEnd = today.plusDays(1).atStartOfDay();
            periodLabel = "今天（" + formatDate(today) + "）";
        } else if (containsAny(normalized, "本周", "这周")) {
            rangeStart = TimeProvider.weekStart();
            rangeEnd = TimeProvider.weekEnd();
            periodLabel = "本周（" + formatDate(today.with(DayOfWeek.MONDAY)) + "—" + formatDate(today.with(DayOfWeek.MONDAY).plusDays(6)) + "）";
        } else {
            // 近期：默认未来30天
            rangeStart = today.atStartOfDay();
            rangeEnd = today.plusDays(30).atStartOfDay();
            periodLabel = "近期（至" + formatDate(today.plusDays(30)) + "）";
        }

        // 按日期过滤
        List<TCampusActivity> filtered = allEnabled.stream()
            .filter(a -> a.getActivityTime() != null)
            .filter(a -> {
                LocalDateTime at = a.getActivityTime();
                return !at.isBefore(rangeStart) && at.isBefore(rangeEnd);
            })
            .toList();

        boolean isTodayQuery = containsAny(normalized, "今天", "今日");
        ChatReply reply = new ChatReply();

        if (filtered.isEmpty()) {
            if (isTodayQuery) {
                reply.setAnswer("今天（" + formatDate(today) + "）暂无已发布的校园活动。");
                // 检查近期是否有活动
                List<TCampusActivity> upcoming = allEnabled.stream()
                    .filter(a -> a.getActivityTime() != null && !a.getActivityTime().isBefore(today.plusDays(1).atStartOfDay()))
                    .limit(3)
                    .toList();
                if (!upcoming.isEmpty()) {
                    StringBuilder sb = new StringBuilder(reply.getAnswer());
                    sb.append("\n\n近期活动：");
                    for (TCampusActivity a : upcoming) {
                        sb.append("\n- ").append(a.getActivityTitle());
                        sb.append("（").append(a.getActivityTime().format(ACTIVITY_TIME_FORMATTER)).append("）");
                    }
                    reply.setAnswer(sb.toString());
                }
            } else {
                reply.setAnswer(periodLabel + "暂无已发布的校园活动。");
            }
            reply.setCardType("none");
            reply.setResponseType("text");
            reply.setSuggestedActions(List.of(
                SuggestedAction.of(ActionType.VIEW_RECENT_ACTIVITIES, "查看近期活动"),
                SuggestedAction.of(ActionType.CONTINUE_QUESTION, "推荐山海大学校园点位")
            ));
        } else {
            StringBuilder sb = new StringBuilder();
            sb.append(periodLabel).append("共有 ").append(filtered.size()).append(" 场已发布活动：\n");
            for (int i = 0; i < filtered.size(); i++) {
                TCampusActivity a = filtered.get(i);
                sb.append(i + 1).append(". ").append(a.getActivityTitle());
                if (a.getActivityTime() != null) {
                    sb.append("\n   时间：").append(a.getActivityTime().format(ACTIVITY_TIME_FORMATTER));
                }
                if (a.getActivitySpotId() != null) {
                    sb.append("\n   活动地点ID：").append(a.getActivitySpotId());
                }
                if (a.getActivityDesc() != null && !a.getActivityDesc().isBlank()) {
                    sb.append("\n   简介：").append(shortText(a.getActivityDesc(), 100));
                }
                if (Integer.valueOf(1).equals(a.getIsReserve())) {
                    sb.append("\n   【可预约】");
                }
                sb.append("\n");
            }
            reply.setAnswer(sb.toString().trim());
            reply.setCardType("none");
            reply.setResponseType("text");
            reply.setSources(buildSources(List.of(), List.of(), List.of(), filtered));
            reply.setSuggestedActions(List.of(
                SuggestedAction.of(ActionType.VIEW_RECENT_ACTIVITIES, "查看近期活动"),
                SuggestedAction.of(ActionType.CONTINUE_QUESTION, "推荐山海大学校园点位")
            ));
        }
        reply.setEmotion("neutral");
        return reply;
    }

    private String formatDate(LocalDate date) {
        return date.getMonthValue() + "月" + date.getDayOfMonth() + "日";
    }

    // ==================== Helpers ====================

    private ChatReply buildSingleSpotCardReply(TCampusSpot spot, String userMode) {
        List<TKnowledge> knowledge = safeKnowledgeSearch(spot.getSpotName(), userMode, 3);
        ChatReply reply = new ChatReply();
        reply.setAnswer("小海导览介绍\n\n" + spot.getSpotName() + "：" + shortText(spot.getSpotDesc(), 260)
            + "\n\n开放时间：" + (spot.getOpenTime() != null && !spot.getOpenTime().isBlank() ? spot.getOpenTime() : "以学校实际安排为准"));
        reply.setCardType("spot_intro");
        reply.setResponseType("spot_intro");
        reply.setPrimarySpot(toSpotRecommendation(spot, "单点导览"));
        reply.setSuggestedActions(List.of(
            SuggestedAction.of(ActionType.ASK_SPOT_INTRO, "小海讲解",
                Map.of("spotId", spot.getId(), "spotName", spot.getSpotName())),
            SuggestedAction.of(ActionType.OPEN_SPOT_ON_MAP, "查看地图",
                Map.of("spotId", spot.getId(), "spotName", spot.getSpotName())),
            SuggestedAction.of(ActionType.START_SPOT_NAVIGATION, "开始导航",
                Map.of("spotId", spot.getId(), "spotName", spot.getSpotName()))
        ));
        incrementKnowledgeViewCount(knowledge);
        return reply;
    }

    private ChatReply errorReply(String message) {
        ChatReply reply = new ChatReply();
        reply.setAnswer(message);
        reply.setCardType("none");
        reply.setResponseType("text");
        return reply;
    }

    /** Filter out actions whose type has no registered executor */
    private List<SuggestedAction> filterExecutableActions(List<SuggestedAction> actions) {
        if (actions == null || actions.isEmpty()) return List.of();
        List<SuggestedAction> filtered = new ArrayList<>();
        for (SuggestedAction action : actions) {
            if (action.getActionType() != null) {
                filtered.add(action);
            } else {
                log.warn("Filtering out suggested action with null actionType: {}", action.getLabel());
            }
        }
        return filtered;
    }

    private String payloadString(Map<String, Object> payload, String key) {
        Object value = payload.get(key);
        return value == null ? null : value.toString();
    }

    private int payloadInt(Map<String, Object> payload, String key, int defaultValue) {
        Object value = payload.get(key);
        if (value instanceof Number n) return n.intValue();
        if (value instanceof String s) {
            try { return Integer.parseInt(s); } catch (NumberFormatException e) { return defaultValue; }
        }
        return defaultValue;
    }

    private Long payloadLong(Map<String, Object> payload, String key) {
        Object value = payload.get(key);
        if (value instanceof Number n) return n.longValue();
        if (value instanceof String s) {
            try { return Long.parseLong(s); } catch (NumberFormatException e) { return null; }
        }
        return null;
    }

    private Double payloadDouble(Map<String, Object> payload, String key) {
        Object value = payload.get(key);
        if (value instanceof Number n) return n.doubleValue();
        if (value instanceof String s) {
            try { return Double.parseDouble(s); } catch (NumberFormatException e) { return null; }
        }
        return null;
    }

    private void storeRouteDraft(DialogState state, ChatReply reply, AiIntentParser.AiIntentResult intent) {
        AiRoutePlan plan = reply.getRoutePlan();
        DialogState.RouteDraft draft = new DialogState.RouteDraft();
        draft.setRouteType(intent.intent() == AiIntentParser.Intent.NAVIGATION ? "navigation" : "ai");
        draft.setSourceType(intent.intent() == AiIntentParser.Intent.NAVIGATION ? "navigation" : "ai");
        draft.setDurationMinutes(plan.getTotalMinute() != null ? plan.getTotalMinute() : 0);
        draft.setRouteName(plan.getRouteName());
        draft.setStartSpotId(plan.getStartSpotId());
        draft.setStartLabel(plan.getStartLabel());
        draft.setStartLng(plan.getStartLng() != null ? plan.getStartLng().doubleValue() : null);
        draft.setStartLat(plan.getStartLat() != null ? plan.getStartLat().doubleValue() : null);
        draft.setStartMode(plan.getStartMode());
        if (plan.getSpots() != null) {
            draft.setSpotNames(plan.getSpots().stream().map(AiRouteSpot::getSpotName).toList());
            draft.setWaypointSpotIds(plan.getSpots().stream().map(AiRouteSpot::getSpotId).toList());
        }
        // Freeze the plan so confirmation executes this exact plan, never re-plans
        draft.setFrozenPlan(plan);
        draft.setStatus(DialogState.DraftStatus.AWAITING_CONFIRMATION);
        state.setRouteDraft(draft);
        state.setAwaitingConfirmation(false); // ready for structured confirm, not text matching
    }

    private ChatReply executeConfirmedDraft(DialogState.RouteDraft draft, String userMode, String userContent) {
        // CRITICAL: Use the FROZEN plan from the draft — never call planRoute() again.
        // This is the fix for the dead loop where "接受6分钟" became "4分钟".
        AiRoutePlan plan = draft.getFrozenPlan();
        ChatReply reply = new ChatReply();

        if (plan == null || plan.getSpots() == null || plan.getSpots().isEmpty()) {
            reply.setAnswer("路线方案已失效，请重新规划。");
            reply.setCardType("none");
            reply.setResponseType("text");
            reply.setSuggestedActions(List.of(
                SuggestedAction.of(ActionType.CONTINUE_QUESTION, "重新规划路线")
            ));
            return reply;
        }

        String startLabel = (plan.getStartLabel() != null && !plan.getStartLabel().isBlank())
                ? plan.getStartLabel() : "路线第一站";
        reply.setAnswer("已为你确认 " + plan.getTotalMinute() + " 分钟路线方案，共 " + plan.getSpots().size() + " 个点位。起点：" + startLabel + "。下方路线卡片可查看详情、在地图打开或开始导航。");
        reply.setCardType("route_plan");
        reply.setResponseType("route_plan");
        reply.setRoutePlan(plan);
        reply.setSpotRecommendations(List.of());
        reply.setSources(List.of());
        reply.setEmotion("neutral");
        reply.setSuggestedActions(List.of(
            SuggestedAction.of(ActionType.OPEN_ROUTE_ON_MAP, "在地图查看",
                Map.of("routePlan", plan)),
            SuggestedAction.of(ActionType.START_ROUTE_NAVIGATION, "开始导航",
                Map.of("routePlan", plan)),
            SuggestedAction.of(ActionType.FAVORITE_ROUTE, "收藏路线",
                Map.of("routePlan", plan))
        ));
        return reply;
    }

    /**
     * Build a frozen draft for the clarification (e.g. "最短可行路线约需6分钟") case.
     * The draft stores the actual plan so confirmation executes it without re-planning.
     */
    private void buildClarificationDraft(DialogState state, ChatReply reply, String userContent,
                                          String userMode, Double startLng, Double startLat,
                                          String locationLabel, String startMode,
                                          AiIntentParser.AiIntentResult intent) {
        // Extract duration from clarification message
        Matcher durationMatcher = Pattern.compile("(\\d+)\\s*分钟").matcher(
            reply.getClarification() == null ? "" : reply.getClarification());
        int durationMinutes = durationMatcher.find() ? Integer.parseInt(durationMatcher.group(1)) : DEFAULT_DURATION_MINUTE;

        AiRoutePlanRequest draftRequest = new AiRoutePlanRequest();
        draftRequest.setMessage(userContent);
        draftRequest.setUserMode(userMode);
        draftRequest.setDurationMinute(durationMinutes);
        if (intent.entities().durationMinutes() != null) {
            draftRequest.setDurationMinute(intent.entities().durationMinutes());
        }
        draftRequest.setOrderedSpotIds(orderedSpotIdsFromIntent(intent));
        if (intent.explicitStart() != null && intent.explicitStart().spotId() != null) {
            draftRequest.setStartSpotId(intent.explicitStart().spotId());
        }
        if (startLng != null && startLat != null) {
            draftRequest.setStartLng(startLng);
            draftRequest.setStartLat(startLat);
            draftRequest.setLocationLabel(locationLabel);
            draftRequest.setStartMode(startMode);
        }

        AiRoutePlan frozenPlan = null;
        try {
            frozenPlan = planRoute(draftRequest, userMode);
        } catch (Exception planEx) {
            log.info("Could not pre-build clarification draft: {}", planEx.getMessage());
        }

        DialogState.RouteDraft draft = new DialogState.RouteDraft();
        draft.setRouteType("ai");
        draft.setSourceType("ai");
        draft.setDurationMinutes(durationMinutes);
        if (frozenPlan != null) {
            draft.setFrozenPlan(frozenPlan);
            draft.setDurationMinutes(frozenPlan.getTotalMinute() != null ? frozenPlan.getTotalMinute() : draft.getDurationMinutes());
            draft.setRouteName(frozenPlan.getRouteName());
            draft.setStartLabel(frozenPlan.getStartLabel());
            draft.setStartLng(frozenPlan.getStartLng() != null ? frozenPlan.getStartLng().doubleValue() : null);
            draft.setStartLat(frozenPlan.getStartLat() != null ? frozenPlan.getStartLat().doubleValue() : null);
            draft.setStartMode(frozenPlan.getStartMode());
            if (frozenPlan.getSpots() != null) {
                draft.setSpotNames(frozenPlan.getSpots().stream().map(AiRouteSpot::getSpotName).toList());
                draft.setWaypointSpotIds(frozenPlan.getSpots().stream().map(AiRouteSpot::getSpotId).toList());
            }
        }
        draft.setStatus(DialogState.DraftStatus.AWAITING_CONFIRMATION);
        state.setRouteDraft(draft);
        state.setAwaitingConfirmation(true);
        state.touch();

        // Update the reply's suggestedActions with the real draft ID
        String acceptLabel = "接受 " + draft.getDurationMinutes() + " 分钟";
        reply.setSuggestedActions(List.of(
            SuggestedAction.of(ActionType.CONFIRM_ROUTE_DRAFT, acceptLabel,
                Map.of("draftId", draft.getDraftId(), "draftVersion", String.valueOf(draft.getVersion()),
                       "durationMinutes", String.valueOf(draft.getDurationMinutes()))),
            SuggestedAction.of(ActionType.CONVERT_TO_SINGLE_SPOT, "改为单点导览",
                Map.of("draftId", draft.getDraftId())),
            SuggestedAction.of(ActionType.ADJUST_DURATION, "调整游览时间",
                Map.of("draftId", draft.getDraftId()))
        ));
    }

    /** Backward-compatible overload without sessionId — uses a temporary state */
    @Override
    public ChatReply chat(String userContent, String userMode, Double startLng, Double startLat, String locationLabel, String startMode) {
        return chat("_temp_" + System.currentTimeMillis(), userContent, userMode, startLng, startLat, locationLabel, startMode);
    }

    @Override
    public AiRoutePlan planRoute(AiRoutePlanRequest request, String userMode) {
        if (request == null) {
            request = new AiRoutePlanRequest();
        }
        String message = request.getMessage() == null ? "" : request.getMessage();
        int requestedDurationMinute = resolveDurationMinute(request);
        int maxAllowedMinute = requestedDurationMinute;
        Set<String> interests = extractInterests(message, request.getInterests());
        List<TCampusSpot> enabledSpots = campusSpotService.getAllSpots().stream()
                .filter(spot -> Integer.valueOf(1).equals(spot.getIsEnable()))
                .filter(spot -> matchesMode(spot.getSuitableMode(), userMode))
                .toList();
        if (enabledSpots.isEmpty()) {
            throw new BusinessException(404, "当前没有可用于规划的启用点位");
        }

        List<TKnowledge> knowledgeMatches = safeKnowledgeSearch(message, userMode, 3);
        Set<Long> knowledgeSpotIds = knowledgeMatches.stream()
                .map(TKnowledge::getBindSpotId)
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));

        TCampusSpot startSpot = resolveStartSpot(request, enabledSpots, message);
        List<TCampusSpot> orderedStops = resolveOrderedSpots(request, enabledSpots);
        List<TCampusSpot> ranked = enabledSpots.stream()
                .filter(spot -> startSpot == null || !Objects.equals(spot.getId(), startSpot.getId()))
                .map(spot -> Map.entry(spot, scoreRouteSpot(spot, message, interests, knowledgeSpotIds, userMode)))
                .sorted(Map.Entry.<TCampusSpot, Integer>comparingByValue().reversed()
                        .thenComparing(entry -> entry.getKey().getId()))
                .map(Map.Entry::getKey)
                .toList();

        List<TCampusSpot> selected = new ArrayList<>();
        if (startSpot != null) selected.add(startSpot);
        for (TCampusSpot spot : orderedStops) {
            if (selected.stream().noneMatch(existing -> Objects.equals(existing.getId(), spot.getId()))) {
                selected.add(spot);
            }
        }
        if (selected.isEmpty() && !ranked.isEmpty()) {
            selected.add(ranked.get(0));
        }
        int total = estimateSequenceMinute(selected, requestedDurationMinute);
        TCampusSpot previous = selected.isEmpty() ? null : selected.get(selected.size() - 1);
        for (TCampusSpot candidate : ranked) {
            if (selected.size() >= 6) break;
            if (selected.stream().anyMatch(existing -> Objects.equals(existing.getId(), candidate.getId()))) continue;
            int walk = estimateWalkMinute(previous, candidate);
            int stay = estimateStayMinute(candidate, false);
            int remainingAfterWalk = maxAllowedMinute - total - walk;
            if (remainingAfterWalk < minimumStayMinute(requestedDurationMinute, false)) {
                continue;
            }
            stay = Math.min(stay, remainingAfterWalk);
            selected.add(candidate);
            total += walk + stay;
            previous = candidate;
            if (total >= requestedDurationMinute - 2 && selected.size() >= 2) break;
        }
        if (selected.size() < 2 && !ranked.isEmpty()) {
            for (TCampusSpot candidate : ranked) {
                if (selected.stream().anyMatch(existing -> Objects.equals(existing.getId(), candidate.getId()))) continue;
                TCampusSpot from = selected.isEmpty() ? candidate : selected.get(selected.size() - 1);
                int walk = selected.isEmpty() ? 0 : estimateWalkMinute(from, candidate);
                int remainingAfterWalk = maxAllowedMinute - total - walk;
                if (remainingAfterWalk < minimumStayMinute(requestedDurationMinute, false)) {
                    continue;
                }
                selected.add(candidate);
                total += walk + Math.min(estimateStayMinute(candidate, false), remainingAfterWalk);
                break;
            }
        }
        // Ensure at least 1 spot (start spot) always
        if (selected.isEmpty() && !enabledSpots.isEmpty()) {
            selected.add(enabledSpots.get(0));
            total = estimateStayMinute(enabledSpots.get(0), true);
        }

        List<AiRouteSpot> allRouteSpots = toRouteSpotsWithinBudget(selected, requestedDurationMinute);
        boolean temporaryStart = !allRouteSpots.isEmpty() && isTemporarySpotId(allRouteSpots.get(0).getSpotId());
        List<AiRouteSpot> routeSpots = temporaryStart ? allRouteSpots.stream().skip(1).toList() : allRouteSpots;
        // 无明确起点（非临时位置、非指定起点）时，路线为纯游览方案，允许至少 1 个点位以兼容小校园
        boolean isTourWithoutStart = startSpot == null && !temporaryStart;
        int minimumVisibleSpots = temporaryStart ? 1 : isTourWithoutStart ? 1 : 2;
        if (routeSpots.size() < minimumVisibleSpots) {
            TCampusSpot minimumStart = startSpot != null ? startSpot : selected.isEmpty() ? enabledSpots.get(0) : selected.get(0);
            int minimumFeasibleMinute = estimateMinimumFeasibleMinute(minimumStart, ranked, requestedDurationMinute);
            // 无明确起点的游览路线：不返回"最短6分钟"单点方案，而是给出更友好的提示
            if (isTourWithoutStart) {
                throw new BusinessException(422, "当前启用的校园点位无法在 " + requestedDurationMinute + " 分钟内组成多站游览路线。建议尝试更长的时间预算（如 60—90 分钟），或告诉我你偏好的点位类型。");
            }
            throw new BusinessException(422, "按照当前起点和点位距离，最短可行路线约需 " + minimumFeasibleMinute + " 分钟。是否接受 " + minimumFeasibleMinute + " 分钟方案？");
        }
        int actualTotalMinute = calculateRouteTotalMinute(allRouteSpots);
        if (actualTotalMinute > requestedDurationMinute) {
            throw new BusinessException(422, "路线复核后超出 " + requestedDurationMinute + " 分钟预算，未生成路线卡片。");
        }
        Set<Long> routeSpotIds = routeSpots.stream().map(AiRouteSpot::getSpotId).collect(Collectors.toCollection(LinkedHashSet::new));
        List<TCampusSpot> actualSelected = selected.stream()
                .filter(spot -> routeSpotIds.contains(spot.getId()))
                .toList();
        TCampusSpot planStart = selected.isEmpty() ? null : selected.get(0);

        AiRoutePlan plan = new AiRoutePlan();
        plan.setStartSpotId(planStart == null || isTemporarySpot(planStart) ? null : planStart.getId());
        plan.setTotalMinute(actualTotalMinute);
        String startLabel = planStart == null ? "路线第一站" : planStart.getSpotName();
        plan.setStartLabel(startLabel);
        if (planStart != null) {
            plan.setStartLng(toScaledBigDecimal(planStart.getLongitude()));
            plan.setStartLat(toScaledBigDecimal(planStart.getLatitude()));
            plan.setStartMode(isTemporarySpot(planStart) ? normalizeStartMode(request.getStartMode()) : "spot");
        }
        plan.setRouteName(buildRouteName(actualTotalMinute, interests, userMode));
        plan.setRouteDesc(buildRouteDesc(actualTotalMinute, actualSelected, interests));
        plan.setReason(buildRouteReason(interests, userMode, actualTotalMinute));
        plan.setSpots(routeSpots);
        plan.setMapPolyline(allRouteSpots.stream()
                .map(spot -> List.of(toScaledBigDecimal(spot.getLongitude()), toScaledBigDecimal(spot.getLatitude())))
                .toList());
        return plan;
    }

    private ChatReply buildRouteChatReply(String userContent,
                                          String userMode,
                                          List<TKnowledge> knowledgeMatches,
                                          Double startLng,
                                          Double startLat,
                                          String locationLabel,
                                          String startMode,
                                          AiIntentParser.AiIntentResult intent) {
        ChatReply reply = new ChatReply();
        try {
            AiRoutePlanRequest request = new AiRoutePlanRequest();
            request.setMessage(userContent);
            request.setUserMode(userMode);
            if (intent.entities().durationMinutes() != null) {
                request.setDurationMinute(intent.entities().durationMinutes());
            }
            request.setOrderedSpotIds(orderedSpotIdsFromIntent(intent));
            if (intent.explicitStart() != null && intent.explicitStart().spotId() != null) {
                request.setStartSpotId(intent.explicitStart().spotId());
            }
            // 传递位置上下文到 planRoute
            if (startLng != null && startLat != null) {
                request.setStartLng(startLng);
                request.setStartLat(startLat);
                request.setLocationLabel(locationLabel);
                request.setStartMode(startMode);
            }
            AiRoutePlan plan = planRoute(request, userMode);
            String startLabel = (plan.getStartLabel() != null && !plan.getStartLabel().isBlank())
                    ? plan.getStartLabel() : "路线第一站";
            // 无明确起点时提醒用户这是游览方案，起点留到地图页选择
            boolean hasExplicitStart = startLng != null || plan.getStartSpotId() != null;
            String startNote = hasExplicitStart ? "" : "路线为校园游览方案，可在下方卡片中预览或在开始游览时由地图页选择起点。";
            reply.setAnswer("已为你生成一条约 " + plan.getTotalMinute() + " 分钟的山海大学导览路线，共 " + plan.getSpots().size() + " 个点位。起点：" + startLabel + "。" + startNote + "下方路线卡片可查看点位顺序、收藏或打开地图导航。");
            reply.setCardType("route_plan");
            reply.setResponseType("route_plan");
            reply.setRoutePlan(plan);
            reply.setSpotRecommendations(List.of());
            reply.setSources(buildRouteSources(knowledgeMatches, plan));
            reply.setEmotion(detectEmotion(userContent));
            reply.setSuggestedActions(List.of(
                SuggestedAction.of(ActionType.OPEN_ROUTE_ON_MAP, "在地图查看",
                    Map.of("routePlan", plan)),
                SuggestedAction.of(ActionType.START_ROUTE_NAVIGATION, "开始导航",
                    Map.of("routePlan", plan)),
                SuggestedAction.of(ActionType.FAVORITE_ROUTE, "收藏路线",
                    Map.of("routePlan", plan))
            ));
        } catch (BusinessException e) {
            log.info("AI route needs user confirmation: {}", e.getMessage());
            Matcher durationMatcher = Pattern.compile("是否接受\\s*(\\d+)\\s*分钟").matcher(e.getMessage());
            int durationMinutes = durationMatcher.find() ? Integer.parseInt(durationMatcher.group(1)) : 0;
            String acceptLabel = durationMinutes > 0 ? "接受 " + durationMinutes + " 分钟" : "接受建议时长";

            reply.setAnswer(e.getMessage());
            reply.setCardType("none");
            reply.setResponseType("clarification");
            reply.setClarification(e.getMessage());
            reply.setRoutePlan(null);
            reply.setSpotRecommendations(List.of());
            reply.setSources(buildSources(knowledgeMatches, List.of(), List.of(), List.of()));
            reply.setEmotion(detectEmotion(userContent));
            // suggestedActions will be set by chat() caller after storing the draft
            reply.setSuggestedActions(List.of(
                SuggestedAction.of(ActionType.CONFIRM_ROUTE_DRAFT, acceptLabel,
                    Map.of("durationMinutes", String.valueOf(durationMinutes))),
                SuggestedAction.of(ActionType.CONVERT_TO_SINGLE_SPOT, "改为单点导览",
                    Map.of("durationMinutes", String.valueOf(durationMinutes))),
                SuggestedAction.of(ActionType.ADJUST_DURATION, "调整游览时间",
                    Map.of())
            ));
        } catch (Exception e) {
            log.warn("AI route planning failed: {}", e.getMessage());
            reply.setAnswer("当前启用点位不足或路线规划暂不可用。你可以稍后再试，或先在地图页选择出发点和想去的点位。");
            reply.setCardType("none");
            reply.setResponseType("text");
            reply.setRoutePlan(null);
            reply.setSpotRecommendations(List.of());
            reply.setSources(buildSources(knowledgeMatches, List.of(), List.of(), List.of()));
            reply.setEmotion(detectEmotion(userContent));
            reply.setSuggestedActions(List.of(
                SuggestedAction.of(ActionType.CONTINUE_QUESTION, "打开地图"),
                SuggestedAction.of(ActionType.CONTINUE_QUESTION, "换一个时长重试")
            ));
        }
        return reply;
    }

    private ChatReply buildClarificationReply(AiIntentParser.AiIntentResult intent, String userContent) {
        ChatReply reply = new ChatReply();
        String question = intent.clarificationQuestion() == null || intent.clarificationQuestion().isBlank()
                ? "你想让我介绍点位、规划路线，还是推荐几个地方？"
                : intent.clarificationQuestion();
        reply.setAnswer(question);
        reply.setCardType("none");
        reply.setResponseType("clarification");
        reply.setClarification(question);
        reply.setSpotRecommendations(List.of());
        reply.setRoutePlan(null);
        reply.setSources(List.of());
        reply.setEmotion(detectEmotion(userContent));

        // Build context-aware clarification actions instead of generic text chips
        List<SuggestedAction> actions = new ArrayList<>();
        // If there's a resolved spot in the intent, offer spot-specific actions
        if (intent.entities().spots() != null && !intent.entities().spots().isEmpty()) {
            AiIntentParser.SpotEntity firstSpot = intent.entities().spots().get(0);
            if (firstSpot.spot() != null) {
                TCampusSpot spot = firstSpot.spot();
                actions.add(SuggestedAction.of(ActionType.ASK_SPOT_INTRO, "介绍" + spot.getSpotName(),
                    Map.of("spotId", spot.getId(), "spotName", spot.getSpotName())));
                actions.add(SuggestedAction.of(ActionType.START_SPOT_NAVIGATION, "导航到" + spot.getSpotName(),
                    Map.of("spotId", spot.getId(), "spotName", spot.getSpotName())));
            }
        }
        // Always include actionable options — without "讲解当前点位" which requires GPS
        actions.add(SuggestedAction.of(ActionType.CONTINUE_QUESTION, "帮我规划一条校园游览路线"));
        actions.add(SuggestedAction.of(ActionType.CONTINUE_QUESTION, "推荐山海大学必看校园点位"));
        reply.setSuggestedActions(actions);
        return reply;
    }

    private ChatReply buildSpotIntroReply(String userContent, String userMode, AiIntentParser.AiIntentResult intent) {
        TCampusSpot spot = firstResolvedSpot(intent);
        if (spot == null) {
            return buildClarificationReply(intent, userContent);
        }
        List<TKnowledge> knowledgeMatches = safeKnowledgeSearch(userContent, userMode, 5);
        List<TKnowledge> spotKnowledge = filterKnowledgeForSpot(knowledgeMatches, spot);
        List<ChatSource> sources = buildSources(spotKnowledge, List.of(spot), List.of(), List.of());
        String answer = intent.intent() == AiIntentParser.Intent.SPOT_OPEN_HOURS
                ? buildOpenHoursAnswer(spot, spotKnowledge)
                : buildConservativeSpotIntro(spot, spotKnowledge, intent.entities().narrationSeconds());

        ChatReply reply = new ChatReply();
        reply.setAnswer(answer);
        reply.setCardType("spot_intro");
        reply.setResponseType("spot_intro");
        reply.setPrimarySpot(toSpotRecommendation(spot, "与本次单点讲解目标匹配"));
        reply.setSpotRecommendations(List.of());
        reply.setRoutePlan(null);
        reply.setSources(sources);
        reply.setEmotion(detectEmotion(userContent));
        reply.setSuggestedActions(List.of(
            SuggestedAction.of(ActionType.ASK_SPOT_INTRO, "小海讲解",
                Map.of("spotId", spot.getId(), "spotName", spot.getSpotName(),
                       "longitude", spot.getLongitude(), "latitude", spot.getLatitude())),
            SuggestedAction.of(ActionType.OPEN_SPOT_ON_MAP, "查看地图",
                Map.of("spotId", spot.getId(), "spotName", spot.getSpotName(),
                       "longitude", spot.getLongitude(), "latitude", spot.getLatitude())),
            SuggestedAction.of(ActionType.START_SPOT_NAVIGATION, "开始导航",
                Map.of("spotId", spot.getId(), "spotName", spot.getSpotName(),
                       "longitude", spot.getLongitude(), "latitude", spot.getLatitude()))
        ));
        incrementKnowledgeViewCount(spotKnowledge);
        return reply;
    }

    private ChatReply buildSpotRecommendationReply(String userContent,
                                                  String userMode,
                                                  AiIntentParser.AiIntentResult intent,
                                                  List<TCampusSpot> enabledSpots) {
        List<TCampusSpot> recommendedSpots = resolveRecommendationSpots(userContent, userMode, intent, enabledSpots);
        List<SpotRecommendation> recommendations = recommendedSpots.stream()
                .map(spot -> toSpotRecommendation(spot, "与问题中的点位或类别匹配"))
                .toList();
        String missingText = buildMissingCategoryText(intent, recommendedSpots);
        String answer;
        if (recommendations.isEmpty()) {
            answer = missingText.isBlank()
                    ? "当前没有找到足够匹配的点位。你可以告诉我想看图书馆、食堂、体育或教学等哪类地点。"
                    : missingText;
        } else {
            String names = recommendations.stream().map(SpotRecommendation::getSpotName).collect(Collectors.joining("、"));
            answer = "我为你推荐这些校园点位：" + names + "。" + (missingText.isBlank() ? "下方点位卡片可以查看地图或开始导航。" : "\n" + missingText);
        }
        ChatReply reply = new ChatReply();
        reply.setAnswer(answer);
        reply.setCardType(recommendations.isEmpty() ? "none" : "spot_list");
        reply.setResponseType(recommendations.isEmpty() ? "text" : "spot_list");
        reply.setSpotRecommendations(recommendations);
        reply.setPrimarySpot(null);
        reply.setRoutePlan(null);
        reply.setSources(buildSources(List.of(), recommendedSpots, List.of(), List.of()));
        reply.setEmotion(detectEmotion(userContent));
        reply.setSuggestedActions(recommendations.isEmpty()
            ? List.of(
                SuggestedAction.of(ActionType.CONTINUE_QUESTION, "推荐山海大学图书馆"),
                SuggestedAction.of(ActionType.CONTINUE_QUESTION, "推荐山海大学必看校园点位"))
            : List.of(
                SuggestedAction.of(ActionType.VIEW_SPOTS_ON_MAP, "查看地图点位",
                    Map.of("spotIds", recommendedSpots.stream().map(s -> s.getId().toString()).toList())),
                SuggestedAction.of(ActionType.PLAN_RECOMMENDED_SPOTS, "规划串联路线",
                    Map.of("spotIds", recommendedSpots.stream().map(TCampusSpot::getId).toList()))
            ));
        return reply;
    }

    private ChatReply buildGeneralChatReply(String userContent, String userMode) {
        List<TKnowledge> knowledgeMatches = safeKnowledgeSearch(userContent, userMode, 3);
        List<TCampusRoute> routeMatches = List.of();
        // Activity questions are now handled deterministically before reaching here,
        // so we don't pass activity data to DeepSeek to fabricate dates
        List<TCampusActivity> activityMatches = List.of();
        List<ChatSource> sources = buildSources(knowledgeMatches, List.of(), routeMatches, activityMatches);
        String campusInfo = buildCampusInfo(userMode, knowledgeMatches, List.of(), routeMatches, activityMatches);

        ChatReply reply;
        if (apiKey == null || apiKey.isBlank()) {
            reply = generateFallbackReply(userContent, getModeName(userMode), List.of(), routeMatches, activityMatches, knowledgeMatches);
        } else {
            reply = callDeepSeek(buildSystemPrompt(getModeName(userMode), campusInfo), userContent,
                    getModeName(userMode), List.of(), routeMatches, activityMatches, knowledgeMatches);
        }
        reply.setSources(sources);
        reply.setEmotion(detectEmotion(userContent));
        reply.setSuggestedActions(buildSuggestedActionsStructured(userContent, List.of(), activityMatches, false, false));
        reply.setCardType("none");
        reply.setResponseType("text");
        reply.setSpotRecommendations(List.of());
        reply.setPrimarySpot(null);
        reply.setRoutePlan(null);
        incrementKnowledgeViewCount(knowledgeMatches);
        return reply;
    }

    private AiIntentParser.AiIntentResult refineIntentWithDeepSeek(String userContent,
                                                                   List<TCampusSpot> enabledSpots,
                                                                   boolean hasLocation,
                                                                   AiIntentParser.AiIntentResult localIntent) {
        if (apiKey == null || apiKey.isBlank() || localIntent.confidence() >= 0.85) {
            return localIntent;
        }
        try {
            String spotNames = enabledSpots.stream()
                    .map(TCampusSpot::getSpotName)
                    .filter(Objects::nonNull)
                    .limit(80)
                    .collect(Collectors.joining("、"));
            Map<String, Object> system = new LinkedHashMap<>();
            system.put("role", "system");
            system.put("content", """
                    你只负责山海大学导览助手的意图分类，不生成回答正文。
                    必须只返回 JSON 对象，字段：
                    {"intent":"route_plan|navigation|spot_intro|spot_open_hours|spot_recommendation|nearby_recommendation|general_chat|clarification","needsLocation":boolean,"needsClarification":boolean,"clarificationQuestion":"..."}
                    可用点位名称：%s
                    """.formatted(spotNames));
            Map<String, Object> user = new LinkedHashMap<>();
            user.put("role", "user");
            user.put("content", userContent);
            Map<String, Object> requestBody = new LinkedHashMap<>();
            requestBody.put("model", model);
            requestBody.put("messages", List.of(system, user));
            requestBody.put("temperature", 0.0);
            requestBody.put("max_tokens", 220);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.deepseek.com/v1/chat/completions"))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + apiKey)
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(requestBody)))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            JsonNode content = objectMapper.readTree(response.body()).path("choices").path(0).path("message").path("content");
            if (content.isMissingNode() || content.asText().isBlank()) return localIntent;
            JsonNode json = objectMapper.readTree(extractJsonObject(content.asText()));
            AiIntentParser.Intent modelIntent = parseIntentName(json.path("intent").asText(""));
            if (modelIntent == null) return localIntent;
            boolean needsLocation = json.path("needsLocation").asBoolean(localIntent.needsLocation());
            boolean needsClarification = json.path("needsClarification").asBoolean(localIntent.needsClarification());
            String question = json.path("clarificationQuestion").asText(localIntent.clarificationQuestion());
            // 仅 NAVIGATION（单点导航）才强制要求位置；ROUTE_PLAN 不需要起点即可规划
            // 数字人聊天不处理位置选择——起点由地图页在开始游览时确定
            if (modelIntent == AiIntentParser.Intent.NAVIGATION
                    && needsLocation && !hasLocation && localIntent.explicitStart() == null) {
                needsClarification = true;
                modelIntent = AiIntentParser.Intent.CLARIFICATION;
                if (question == null || question.isBlank()) question = "请在地图页选择起点后发起导航，或在此告诉我你想去的具体点位名称。";
            }
            return new AiIntentParser.AiIntentResult(modelIntent, 0.86, localIntent.entities(), localIntent.explicitStart(),
                    needsLocation, needsClarification, question, responseTypeForIntent(modelIntent));
        } catch (Exception e) {
            log.info("DeepSeek intent classification skipped: {}", e.getMessage());
            return localIntent;
        }
    }

    private String extractJsonObject(String text) {
        int start = text.indexOf('{');
        int end = text.lastIndexOf('}');
        if (start >= 0 && end > start) return text.substring(start, end + 1);
        return text;
    }

    private AiIntentParser.Intent parseIntentName(String value) {
        return switch (value) {
            case "route_plan" -> AiIntentParser.Intent.ROUTE_PLAN;
            case "navigation" -> AiIntentParser.Intent.NAVIGATION;
            case "spot_intro" -> AiIntentParser.Intent.SPOT_INTRO;
            case "spot_open_hours" -> AiIntentParser.Intent.SPOT_OPEN_HOURS;
            case "spot_recommendation" -> AiIntentParser.Intent.SPOT_RECOMMENDATION;
            case "nearby_recommendation" -> AiIntentParser.Intent.NEARBY_RECOMMENDATION;
            case "general_chat" -> AiIntentParser.Intent.GENERAL_CHAT;
            case "clarification" -> AiIntentParser.Intent.CLARIFICATION;
            default -> null;
        };
    }

    private AiIntentParser.ResponseType responseTypeForIntent(AiIntentParser.Intent intent) {
        return switch (intent) {
            case ROUTE_PLAN, NAVIGATION -> AiIntentParser.ResponseType.ROUTE_PLAN;
            case SPOT_INTRO, SPOT_OPEN_HOURS -> AiIntentParser.ResponseType.SPOT_INTRO;
            case SPOT_RECOMMENDATION, NEARBY_RECOMMENDATION -> AiIntentParser.ResponseType.SPOT_LIST;
            case CLARIFICATION -> AiIntentParser.ResponseType.CLARIFICATION;
            case GENERAL_CHAT -> AiIntentParser.ResponseType.TEXT;
        };
    }

    private List<Long> orderedSpotIdsFromIntent(AiIntentParser.AiIntentResult intent) {
        if (intent == null || intent.entities() == null || intent.entities().spots() == null) return List.of();
        return intent.entities().spots().stream()
                .filter(item -> item.resolvedSpotId() != null)
                .sorted(Comparator.comparingInt(AiIntentParser.SpotEntity::offset))
                .map(AiIntentParser.SpotEntity::resolvedSpotId)
                .distinct()
                .toList();
    }

    private TCampusSpot firstResolvedSpot(AiIntentParser.AiIntentResult intent) {
        if (intent == null || intent.entities() == null || intent.entities().spots() == null) return null;
        return intent.entities().spots().stream()
                .map(AiIntentParser.SpotEntity::spot)
                .filter(Objects::nonNull)
                .findFirst()
                .orElse(null);
    }

    private List<TCampusSpot> safeEnabledSpots(String userMode) {
        try {
            return campusSpotService.getAllSpots().stream()
                    .filter(spot -> Integer.valueOf(1).equals(spot.getIsEnable()))
                    .filter(spot -> matchesMode(spot.getSuitableMode(), userMode))
                    .toList();
        } catch (Exception e) {
            log.warn("Spot list failed: {}", e.getMessage());
            return List.of();
        }
    }

    private List<TCampusSpot> resolveRecommendationSpots(String userContent,
                                                         String userMode,
                                                         AiIntentParser.AiIntentResult intent,
                                                         List<TCampusSpot> enabledSpots) {
        Map<Long, TCampusSpot> unique = new LinkedHashMap<>();
        List<String> categories = intent.entities().categories() == null ? List.of() : intent.entities().categories();
        for (String category : categories) {
            TCampusSpot spot = AiIntentParser.bestSpotForCategory(category, enabledSpots);
            if (spot != null) unique.putIfAbsent(spot.getId(), spot);
        }
        if (unique.isEmpty() && intent.entities().spots() != null) {
            for (AiIntentParser.SpotEntity entity : intent.entities().spots()) {
                if (entity.spot() != null) unique.putIfAbsent(entity.spot().getId(), entity.spot());
            }
        }
        if (unique.isEmpty()) {
            for (TCampusSpot spot : safeSpotMatches(userContent, userMode, 3)) {
                unique.putIfAbsent(spot.getId(), spot);
            }
        }
        return new ArrayList<>(unique.values()).stream().limit(3).toList();
    }

    private String buildMissingCategoryText(AiIntentParser.AiIntentResult intent, List<TCampusSpot> recommendedSpots) {
        if (intent.entities().categories() == null || intent.entities().categories().isEmpty()) return "";
        Set<String> returnedCategories = recommendedSpots.stream()
                .map(AiIntentParser::spotCategory)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        List<String> missing = intent.entities().categories().stream()
                .filter(category -> !returnedCategories.contains(category))
                .toList();
        if (missing.isEmpty()) return "";
        return "暂未找到" + String.join("、", missing) + "类的启用点位，请确认是否用相近校园设施代替。";
    }

    private List<TKnowledge> filterKnowledgeForSpot(List<TKnowledge> knowledgeMatches, TCampusSpot spot) {
        if (spot == null || knowledgeMatches == null || knowledgeMatches.isEmpty()) return List.of();
        String spotName = normalize(spot.getSpotName());
        String shortName = spotName.replace(normalize("山海大学"), "");
        return knowledgeMatches.stream()
                .filter(item -> Objects.equals(item.getBindSpotId(), spot.getId())
                        || normalize(item.getTitle()).contains(spotName)
                        || (!shortName.isBlank() && normalize(item.getTitle()).contains(shortName))
                        || normalize(item.getContent()).contains(spotName)
                        || (!shortName.isBlank() && normalize(item.getContent()).contains(shortName)))
                .limit(3)
                .toList();
    }

    private String buildOpenHoursAnswer(TCampusSpot spot, List<TKnowledge> spotKnowledge) {
        String openTime = spot.getOpenTime() == null || spot.getOpenTime().isBlank()
                ? "以学校实际安排为准"
                : spot.getOpenTime();
        StringBuilder answer = new StringBuilder("小海导览介绍\n\n");
        answer.append(spot.getSpotName()).append("开放时间：").append(openTime).append("。");
        if (!spotKnowledge.isEmpty()) {
            answer.append("\n\n依据：").append(spotKnowledge.stream().map(TKnowledge::getTitle).limit(2).collect(Collectors.joining("、"))).append("。");
        } else {
            answer.append("具体开放安排和临时调整以学校实际通知为准。");
        }
        return answer.toString();
    }

    private String buildConservativeSpotIntro(TCampusSpot spot, List<TKnowledge> spotKnowledge, Integer narrationSeconds) {
        String desc = spot.getSpotDesc() == null || spot.getSpotDesc().isBlank()
                ? "这里是" + spot.getSpotName() + "，可用于校园交流及相关活动。具体功能、开放安排和活动信息以学校实际通知为准。"
                : spot.getSpotDesc();
        String openTime = spot.getOpenTime() == null || spot.getOpenTime().isBlank()
                ? "以学校实际安排为准"
                : spot.getOpenTime();
        int maxLength = narrationSeconds != null && narrationSeconds <= 30 ? 140 : 260;
        StringBuilder answer = new StringBuilder("小海导览介绍\n\n");
        answer.append(spot.getSpotName()).append("：").append(shortText(desc, maxLength));
        answer.append("\n\n开放时间：").append(openTime).append("。");
        if (!spotKnowledge.isEmpty()) {
            answer.append("\n\n依据：").append(spotKnowledge.stream().map(TKnowledge::getTitle).limit(2).collect(Collectors.joining("、"))).append("。");
        } else {
            answer.append("\n\n资料不足时，具体功能、开放安排和活动信息以学校实际通知为准。");
        }
        return answer.toString();
    }

    private ChatReply callDeepSeek(String systemPrompt,
                                  String userContent,
                                  String modeName,
                                  List<TCampusSpot> spotMatches,
                                  List<TCampusRoute> routeMatches,
                                  List<TCampusActivity> activityMatches,
                                  List<TKnowledge> knowledgeMatches) {
        try {
            Map<String, Object> message1 = new HashMap<>();
            message1.put("role", "system");
            message1.put("content", systemPrompt);

            Map<String, Object> message2 = new HashMap<>();
            message2.put("role", "user");
            message2.put("content", userContent);

            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("model", model);
            requestBody.put("messages", List.of(message1, message2));
            requestBody.put("temperature", 0.6);
            requestBody.put("max_tokens", 1000);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.deepseek.com/v1/chat/completions"))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + apiKey)
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(requestBody)))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            JsonNode root = objectMapper.readTree(response.body());
            if (root.has("error")) {
                log.warn("DeepSeek API error: {}", root.get("error"));
                return generateFallbackReply(userContent, modeName, spotMatches, routeMatches, activityMatches, knowledgeMatches);
            }
            JsonNode choices = root.get("choices");
            if (choices != null && !choices.isEmpty()) {
                JsonNode message = choices.get(0).get("message");
                if (message != null && message.has("content")) {
                    return ChatReply.of(message.get("content").asText());
                }
            }
            return generateFallbackReply(userContent, modeName, spotMatches, routeMatches, activityMatches, knowledgeMatches);
        } catch (Exception e) {
            log.warn("Failed to call DeepSeek API, fallback to local answer: {}", e.getMessage());
            return generateFallbackReply(userContent, modeName, spotMatches, routeMatches, activityMatches, knowledgeMatches);
        }
    }

    private String buildSystemPrompt(String modeName, String campusInfo) {
        return """
                你是山海大学的 AI 数字人导览员小海，服务高校文化景区导览、校友返校、新生家长参访和校园服务咨询。
                用户身份：%s。

                可参考资料：
                %s

                回答要求：
                1. 优先使用可参考资料，不要编造不存在的点位、活动、路线或校史。
                2. 如果知识库资料命中，请围绕命中资料回答。
                3. 如果资料不足，请说明"当前资料暂未收录"，再给出可操作建议。
                4. 回答要自然、简洁，适合手机端阅读。
                5. 请用中文回答。
                6. 你不需要知道用户当前位置就能回答校园导览问题。如果用户询问游览路线但未提供起点，你可以基于校园点位规划游览方案。
                7. 不要假装知道用户的位置。除非用户明确告诉你ta在哪里，否则不要使用"你附近""离你最近"等位置相关表述。
                8. 绝对不要编造活动日期、活动名称或活动详情。"今天/明天/本周有什么活动"类问题由系统直接查询数据库回答，不应由你生成日期。
                9. 如果你不知道某个具体事实（如开放时间、活动安排），必须明确说"以学校实际通知为准"，不能猜测。
                """.formatted(modeName, campusInfo);
    }

    private String buildCampusInfo(String userMode,
                                   List<TKnowledge> knowledgeMatches,
                                   List<TCampusSpot> spotMatches,
                                   List<TCampusRoute> routeMatches,
                                   List<TCampusActivity> activityMatches) {
        StringBuilder info = new StringBuilder();
        if (!knowledgeMatches.isEmpty()) {
            info.append("知识库命中：\n");
            for (TKnowledge item : knowledgeMatches) {
                info.append("- [").append(knowledgeService.getSourceName(item)).append("] ")
                        .append(item.getTitle()).append("：")
                        .append(shortText(item.getContent(), 220)).append("\n");
            }
        }
        if (!spotMatches.isEmpty()) {
            info.append("相关点位：\n");
            for (TCampusSpot spot : spotMatches) {
                info.append("- ").append(spot.getSpotName())
                        .append("（").append(spot.getSpotType()).append("）：")
                        .append(shortText(spot.getSpotDesc(), 140)).append("\n");
            }
        }
        if (!routeMatches.isEmpty()) {
            info.append("推荐路线候选：\n");
            for (TCampusRoute route : routeMatches) {
                info.append("- ").append(route.getRouteName())
                        .append("（约").append(route.getTotalMinute()).append("分钟）：")
                        .append(shortText(route.getRouteDesc(), 140)).append("\n");
            }
        }
        if (!activityMatches.isEmpty()) {
            info.append("近期活动/公告：\n");
            for (TCampusActivity activity : activityMatches) {
                info.append("- ").append(activity.getActivityTitle());
                if (activity.getActivityTime() != null) {
                    info.append("（").append(activity.getActivityTime().format(ACTIVITY_TIME_FORMATTER)).append("）");
                }
                info.append("：").append(shortText(activity.getActivityDesc(), 120)).append("\n");
            }
        }
        if (info.length() == 0) {
            info.append("当前没有命中的本地资料。可以根据山海大学开放参观、校友返校、新生家长参访和校园文化传播场景回答，并建议用户查看地图、路线或活动页面。");
        }
        return info.toString();
    }

    private ChatReply generateFallbackReply(String userContent,
                                            String modeName,
                                            List<TCampusSpot> spotMatches,
                                            List<TCampusRoute> routeMatches,
                                            List<TCampusActivity> activityMatches,
                                            List<TKnowledge> knowledgeMatches) {
        if (!knowledgeMatches.isEmpty()) {
            TKnowledge first = knowledgeMatches.get(0);
            StringBuilder answer = new StringBuilder();
            answer.append(first.getTitle()).append("：").append(shortText(first.getContent(), 320));
            if (knowledgeMatches.size() > 1) {
                answer.append("\n\n我还参考了 ")
                        .append(knowledgeMatches.stream().skip(1).map(TKnowledge::getTitle).limit(2).collect(Collectors.joining("、")))
                        .append(" 等资料。");
            }
            return ChatReply.of(answer.toString());
        }
        if (isActivityQuestion(userContent)) {
            // Activity questions are handled deterministically before reaching fallback
            return ChatReply.of("当前没有检索到已上架的活动。你可以稍后在活动页查看最新安排。");
        }
        if (!spotMatches.isEmpty()) {
            StringBuilder answer = new StringBuilder("我找到了这些相关校园点位：\n");
            for (TCampusSpot spot : spotMatches) {
                answer.append("- ").append(spot.getSpotName())
                        .append("（").append(spot.getSpotType()).append("）");
                if (spot.getOpenTime() != null && !spot.getOpenTime().isBlank()) {
                    answer.append("，开放时间：").append(spot.getOpenTime());
                }
                if (spot.getSpotDesc() != null && !spot.getSpotDesc().isBlank()) {
                    answer.append("。").append(shortText(spot.getSpotDesc(), 120));
                }
                answer.append("\n");
            }
            answer.append("下方点位卡片可以直接跳转地图查看或导航。");
            return ChatReply.of(answer.toString().trim());
        }
        return ChatReply.of("当前资料暂未收录与你问题完全匹配的内容。你可以继续问我校史文化、点位讲解、服务设施、近期活动，或告诉我参观时长，我来帮你规划山海大学路线。");
    }

    private List<TKnowledge> safeKnowledgeSearch(String userContent, String userMode, int limit) {
        try {
            return knowledgeService.searchRelevant(userContent, userMode, limit);
        } catch (Exception e) {
            log.warn("Knowledge search failed: {}", e.getMessage());
            return List.of();
        }
    }

    private List<TCampusSpot> safeSpotMatches(String userContent, String userMode, int limit) {
        try {
            List<TCampusSpot> spots = campusSpotService.getAllSpots().stream()
                    .filter(spot -> matchesMode(spot.getSuitableMode(), userMode))
                    .toList();
            String normalized = normalize(userContent);
            Set<String> interests = extractInterests(userContent, List.of());
            List<TCampusSpot> scored = spots.stream()
                    .map(spot -> Map.entry(spot, scoreSpot(spot, normalized, interests)))
                    .filter(item -> item.getValue() > 0)
                    .sorted(Map.Entry.<TCampusSpot, Integer>comparingByValue().reversed()
                            .thenComparing(item -> item.getKey().getId()))
                    .limit(limit)
                    .map(Map.Entry::getKey)
                    .toList();
            // 关键词无匹配时，回退到推荐标志性点位（校史、图书馆、湖等），避免空结果
            if (scored.isEmpty() && !spots.isEmpty()) {
                return spots.stream()
                        .filter(s -> {
                            String n = normalize(s.getSpotName());
                            return n.contains("校史") || n.contains("图书馆") || n.contains("湖")
                                || n.contains("燕鸣") || n.contains("体育") || n.contains("活动中心");
                        })
                        .limit(limit)
                        .toList();
            }
            return scored;
        } catch (Exception e) {
            log.warn("Spot match failed: {}", e.getMessage());
            return List.of();
        }
    }

    private List<TCampusActivity> safeActivityMatches(String userContent, String userMode, int limit) {
        if (!isActivityQuestion(userContent)) return List.of();
        try {
            List<TCampusActivity> activities = campusActivityService.searchActivities("guest".equals(userMode) ? null : userMode, null, 1);
            String normalized = normalize(userContent);
            LocalDateTime now = LocalDateTime.now();
            return activities.stream()
                    .filter(activity -> activity.getActivityTime() == null || !activity.getActivityTime().isBefore(now.minusDays(1)))
                    .map(activity -> Map.entry(activity, scoreActivity(activity, normalized)))
                    .filter(item -> item.getValue() > 0 || isActivityQuestion(normalized))
                    .sorted(Map.Entry.<TCampusActivity, Integer>comparingByValue().reversed()
                            .thenComparing(item -> item.getKey().getActivityTime(), Comparator.nullsLast(Comparator.naturalOrder())))
                    .limit(limit)
                    .map(Map.Entry::getKey)
                    .toList();
        } catch (Exception e) {
            log.warn("Activity match failed: {}", e.getMessage());
            return List.of();
        }
    }

    private int scoreSpot(TCampusSpot spot, String normalized, Set<String> interests) {
        String name = normalize(spot.getSpotName());
        String type = normalize(spot.getSpotType());
        String desc = normalize(spot.getSpotDesc());
        int score = 0;
        if (!name.isBlank() && (normalized.contains(name) || name.contains(normalized))) score += 60;
        if (!type.isBlank() && normalized.contains(type)) score += 20;
        if (!desc.isBlank() && desc.contains(normalized)) score += 10;
        for (String interest : interests) {
            String token = normalize(interest);
            if (token.length() < 2) continue;
            if (name.contains(token)) score += 35;
            if (type.contains(token)) score += 25;
            if (desc.contains(token)) score += 12;
        }
        for (Map.Entry<String, List<String>> entry : interestAliases().entrySet()) {
            boolean asked = entry.getValue().stream().anyMatch(alias -> normalized.contains(normalize(alias)));
            if (!asked) continue;
            String target = normalize(entry.getKey());
            if (name.contains(target) || type.contains(target) || desc.contains(target)) score += 28;
        }
        return score;
    }

    private int scoreRouteSpot(TCampusSpot spot, String message, Set<String> interests, Set<Long> knowledgeSpotIds, String userMode) {
        String normalized = normalize(message);
        String name = normalize(spot.getSpotName());
        String type = normalize(spot.getSpotType());
        String desc = normalize(spot.getSpotDesc());
        int score = 5;
        if (matchesMode(spot.getSuitableMode(), userMode)) score += 8;
        if (knowledgeSpotIds.contains(spot.getId())) score += 35;
        if (!name.isBlank() && normalized.contains(name)) score += 60;
        for (String interest : interests) {
            String token = normalize(interest);
            if (name.contains(token)) score += 40;
            if (type.contains(token)) score += 28;
            if (desc.contains(token)) score += 15;
        }
        // Fallback: when no specific interests detected, boost landmark-type spots
        // to avoid arbitrary ID-order selection
        if (interests.isEmpty()) {
            Set<String> nameTokens = Set.of("校史", "图书", "燕鸣", "湖", "体育", "活动中心", "校友");
            Set<String> typeTokens = Set.of("文化", "景观", "场馆", "图书");
            for (String token : nameTokens) {
                if (name.contains(token)) score += 18;
            }
            for (String token : typeTokens) {
                if (type.contains(token)) score += 12;
            }
        }
        if (score == 5 && (name.contains("南门") || name.contains("校门"))) score -= 4;
        return score;
    }

    private int scoreActivity(TCampusActivity activity, String normalized) {
        String title = normalize(activity.getActivityTitle());
        String desc = normalize(activity.getActivityDesc());
        String type = normalize(activity.getActivityType());
        int score = 0;
        if (!title.isBlank() && (title.contains(normalized) || normalized.contains(title))) score += 20;
        if (!desc.isBlank() && desc.contains(normalized)) score += 8;
        if (!type.isBlank() && normalized.contains(type)) score += 12;
        if (isActivityQuestion(normalized)) score += 5;
        return score;
    }

    private List<ChatSource> buildRouteSources(List<TKnowledge> knowledgeMatches, AiRoutePlan plan) {
        List<TCampusSpot> routeSpots = new ArrayList<>();
        if (plan != null && plan.getSpots() != null) {
            for (AiRouteSpot spot : plan.getSpots()) {
                if (spot.getSpotId() == null || spot.getSpotId() < 0) continue;
                TCampusSpot campusSpot = new TCampusSpot();
                campusSpot.setId(spot.getSpotId());
                campusSpot.setSpotName(spot.getSpotName());
                campusSpot.setSpotType(spot.getSpotType());
                campusSpot.setSpotDesc(spot.getSpotDesc());
                routeSpots.add(campusSpot);
            }
        }
        return buildSources(knowledgeMatches, routeSpots, List.of(), List.of());
    }

    private List<ChatSource> buildSources(List<TKnowledge> knowledgeMatches,
                                          List<TCampusSpot> spotMatches,
                                          List<TCampusRoute> routeMatches,
                                          List<TCampusActivity> activityMatches) {
        Map<String, ChatSource> unique = new LinkedHashMap<>();
        for (TKnowledge item : knowledgeMatches) {
            addSource(unique, new ChatSource("knowledge", item.getId(), item.getTitle(),
                    item.getKnowledgeType(), "知识库 · " + item.getTitle(), shortText(item.getContent(), 90)));
        }
        for (TCampusSpot spot : spotMatches) {
            addSource(unique, new ChatSource("spot", spot.getId(), spot.getSpotName(),
                    null, "地图点位 · " + spot.getSpotName(), shortText(spot.getSpotDesc(), 90)));
        }
        for (TCampusRoute route : routeMatches) {
            addSource(unique, new ChatSource("route", route.getId(), route.getRouteName(),
                    null, "导览路线 · " + route.getRouteName(), shortText(route.getRouteDesc(), 90)));
        }
        for (TCampusActivity activity : activityMatches) {
            addSource(unique, new ChatSource("activity", activity.getId(), activity.getActivityTitle(),
                    null, "活动 · " + activity.getActivityTitle(), shortText(activity.getActivityDesc(), 90)));
        }
        return new ArrayList<>(unique.values()).stream().limit(8).toList();
    }

    private void addSource(Map<String, ChatSource> unique, ChatSource source) {
        unique.putIfAbsent(source.getSourceType() + ":" + source.getSourceId(), source);
    }

    private List<SuggestedAction> buildSuggestedActionsStructured(String userContent,
                                               List<TCampusSpot> spotMatches,
                                               List<TCampusActivity> activityMatches,
                                               boolean spotIntent,
                                               boolean routeIntent) {
        List<SuggestedAction> actions = new ArrayList<>();
        if (routeIntent) actions.add(SuggestedAction.of(ActionType.OPEN_ROUTE_CARD, "打开路线卡片"));
        if (!spotMatches.isEmpty() || spotIntent) actions.add(SuggestedAction.of(ActionType.VIEW_SPOTS_ON_MAP, "查看地图点位"));
        if (!activityMatches.isEmpty() || isActivityQuestion(userContent)) actions.add(SuggestedAction.of(ActionType.VIEW_RECENT_ACTIVITIES, "查看近期活动"));
        if (actions.isEmpty()) actions.add(SuggestedAction.of(ActionType.CONTINUE_QUESTION, "继续提问"));
        return actions;
    }

    private void incrementKnowledgeViewCount(List<TKnowledge> knowledgeMatches) {
        for (TKnowledge item : knowledgeMatches) {
            try {
                item.setViewCount((item.getViewCount() == null ? 0 : item.getViewCount()) + 1);
                knowledgeService.updateById(item);
            } catch (Exception e) {
                log.warn("Failed to update knowledge view count: {}", e.getMessage());
            }
        }
    }

    private int resolveDurationMinute(AiRoutePlanRequest request) {
        if (request.getDurationMinute() != null && request.getDurationMinute() > 0) {
            return Math.min(Math.max(request.getDurationMinute(), 15), 240);
        }
        Integer extracted = extractDurationMinute(request.getMessage());
        return extracted == null ? DEFAULT_DURATION_MINUTE : extracted;
    }

    private Integer extractDurationMinute(String text) {
        String normalized = normalize(text);
        if (normalized.contains("半小时")) return 30;
        if (normalized.contains("一小时") || normalized.contains("1小时") || normalized.contains("一个小时")) return 60;
        if (normalized.contains("两小时") || normalized.contains("二小时") || normalized.contains("2小时")) return 120;
        Matcher minuteMatcher = MINUTE_PATTERN.matcher(text == null ? "" : text);
        if (minuteMatcher.find()) return Integer.parseInt(minuteMatcher.group(1));
        Matcher hourMatcher = HOUR_PATTERN.matcher(text == null ? "" : text);
        if (hourMatcher.find()) return Integer.parseInt(hourMatcher.group(1)) * 60;
        return null;
    }

    private Set<String> extractInterests(String message, List<String> explicitInterests) {
        Set<String> interests = new LinkedHashSet<>();
        if (explicitInterests != null) {
            explicitInterests.stream().filter(item -> item != null && !item.isBlank()).forEach(interests::add);
        }
        String normalized = normalize(message);
        for (Map.Entry<String, List<String>> entry : interestAliases().entrySet()) {
            if (entry.getValue().stream().anyMatch(alias -> normalized.contains(normalize(alias)))) {
                interests.add(entry.getKey());
                interests.addAll(entry.getValue());
            }
        }
        return interests;
    }

    /**
     * 解析路线起点。优先级：用户明确指定 > 地图 real/demo/manual 原始坐标。
     * 无起点时返回 null，由 intent 澄清或通用路线评分决定第一站。
     */
    private TCampusSpot resolveStartSpot(AiRoutePlanRequest request, List<TCampusSpot> spots, String userContent) {
        Long startSpotId = request.getStartSpotId();
        Double startLng = request.getStartLng();
        Double startLat = request.getStartLat();

        // 优先级1：用户明确指定起点ID
        if (startSpotId != null) {
            for (TCampusSpot spot : spots) {
                if (Objects.equals(spot.getId(), startSpotId)) return spot;
            }
        }

        // 优先级2：从用户文本中提取明确起点（如"从南门"）
        String normalized = normalize(userContent);
        TCampusSpot explicitFromText = spots.stream()
                .filter(spot -> {
                    String name = normalize(spot.getSpotName());
                    String shortName = name.replace(normalize("山海大学"), "");
                    // 匹配"从南门到图书馆"模式
                    return (!name.isBlank() && (normalized.contains("从" + name) || normalized.startsWith(name)))
                            || (!shortName.isBlank() && (normalized.contains("从" + shortName) || normalized.startsWith(shortName)));
                })
                .findFirst().orElse(null);
        if (explicitFromText != null) return explicitFromText;

        // 优先级3：地图当前 real/demo/manual 原始坐标，创建仅用于本次路线的临时起点，不写库、不替换为最近点位
        if (startLng != null && startLat != null) {
            TCampusSpot temp = new TCampusSpot();
            temp.setId(-1L);
            temp.setSpotName(request.getLocationLabel() == null || request.getLocationLabel().isBlank()
                    ? labelForStartMode(request.getStartMode())
                    : request.getLocationLabel());
            temp.setSpotType("临时起点");
            temp.setLongitude(BigDecimal.valueOf(startLng));
            temp.setLatitude(BigDecimal.valueOf(startLat));
            temp.setRecommendTime(0);
            temp.setOpenTime("");
            temp.setSpotDesc("本次路线临时起点");
            temp.setIsEnable(1);
            return temp;
        }

        return null;
    }

    private List<TCampusSpot> resolveOrderedSpots(AiRoutePlanRequest request, List<TCampusSpot> spots) {
        if (request.getOrderedSpotIds() == null || request.getOrderedSpotIds().isEmpty()) return List.of();
        Map<Long, TCampusSpot> byId = spots.stream()
                .filter(spot -> spot.getId() != null)
                .collect(Collectors.toMap(TCampusSpot::getId, spot -> spot, (a, b) -> a, LinkedHashMap::new));
        List<TCampusSpot> result = new ArrayList<>();
        for (Long id : request.getOrderedSpotIds()) {
            TCampusSpot spot = byId.get(id);
            if (spot != null && result.stream().noneMatch(existing -> Objects.equals(existing.getId(), id))) {
                result.add(spot);
            }
        }
        return result;
    }

    private int estimateSequenceMinute(List<TCampusSpot> spots, int requestedDurationMinute) {
        int total = 0;
        TCampusSpot previous = null;
        for (int index = 0; index < spots.size(); index++) {
            TCampusSpot spot = spots.get(index);
            total += previous == null ? 0 : estimateWalkMinute(previous, spot);
            total += estimateStayMinute(spot, previous == null);
            previous = spot;
        }
        return Math.min(total, requestedDurationMinute);
    }

    private boolean isTemporarySpot(TCampusSpot spot) {
        return spot != null && isTemporarySpotId(spot.getId());
    }

    private boolean isTemporarySpotId(Long id) {
        return id != null && id < 0;
    }

    private String normalizeStartMode(String startMode) {
        if (startMode == null || startMode.isBlank()) return "manual";
        String normalized = startMode.trim().toLowerCase(Locale.ROOT);
        if (Set.of("real", "demo", "manual", "spot").contains(normalized)) return normalized;
        return "manual";
    }

    private String labelForStartMode(String startMode) {
        return switch (normalizeStartMode(startMode)) {
            case "real" -> "当前位置";
            case "demo" -> "演示位置";
            case "manual" -> "手动起点";
            default -> "路线起点";
        };
    }

    private List<AiRouteSpot> toRouteSpots(List<TCampusSpot> selected) {
        List<AiRouteSpot> result = new ArrayList<>();
        TCampusSpot previous = null;
        for (int i = 0; i < selected.size(); i++) {
            TCampusSpot spot = selected.get(i);
            AiRouteSpot item = new AiRouteSpot();
            item.setSpotId(spot.getId());
            item.setSpotName(spot.getSpotName());
            item.setSpotType(spot.getSpotType());
            item.setLongitude(spot.getLongitude());
            item.setLatitude(spot.getLatitude());
            item.setStayMinute(estimateStayMinute(spot, i == 0));
            item.setWalkMinuteFromPrev(previous == null ? 0 : estimateWalkMinute(previous, spot));
            item.setReason(i == 0 ? "默认从山海大学南门一带开始" : "与本次路线主题和时长匹配");
            item.setSpotDesc(spot.getSpotDesc());
            item.setSpotImage(spot.getSpotImage());
            result.add(item);
            previous = spot;
        }
        return result;
    }

    private List<AiRouteSpot> toRouteSpotsWithinBudget(List<TCampusSpot> selected, int requestedDurationMinute) {
        int maxAllowedMinute = requestedDurationMinute;
        List<TCampusSpot> working = new ArrayList<>(selected);
        while (!working.isEmpty()) {
            List<AiRouteSpot> result = new ArrayList<>();
            TCampusSpot previous = null;
            int total = 0;
            for (int i = 0; i < working.size(); i++) {
                TCampusSpot spot = working.get(i);
                int walk = previous == null ? 0 : estimateWalkMinute(previous, spot);
                int remainingAfterWalk = maxAllowedMinute - total - walk;
                int minStay = minimumStayMinute(requestedDurationMinute, previous == null);
                if (remainingAfterWalk < minStay) {
                    break;
                }
                int stay = Math.min(estimateStayMinute(spot, previous == null), remainingAfterWalk);
                if (stay < minStay) {
                    break;
                }
                result.add(toRouteSpot(spot, i, walk, stay));
                total += walk + stay;
                previous = spot;
            }
            if (result.size() >= 2 || working.size() <= 1) {
                return result;
            }
            working.remove(working.size() - 1);
        }
        return List.of();
    }

    private AiRouteSpot toRouteSpot(TCampusSpot spot, int index, int walkMinuteFromPrev, int stayMinute) {
        AiRouteSpot item = new AiRouteSpot();
        item.setSpotId(spot.getId());
        item.setSpotName(spot.getSpotName());
        item.setSpotType(spot.getSpotType());
        item.setLongitude(spot.getLongitude());
        item.setLatitude(spot.getLatitude());
        item.setStayMinute(stayMinute);
        item.setWalkMinuteFromPrev(walkMinuteFromPrev);
        item.setReason(index == 0 ? "起点" : "与本次路线主题和时长匹配");
        item.setSpotDesc(spot.getSpotDesc());
        item.setSpotImage(spot.getSpotImage());
        return item;
    }

    private int calculateRouteTotalMinute(List<AiRouteSpot> routeSpots) {
        return routeSpots.stream()
                .mapToInt(spot -> (spot.getWalkMinuteFromPrev() == null ? 0 : spot.getWalkMinuteFromPrev())
                        + (spot.getStayMinute() == null ? 0 : spot.getStayMinute()))
                .sum();
    }

    private int estimateMinimumFeasibleMinute(TCampusSpot startSpot, List<TCampusSpot> ranked, int requestedDurationMinute) {
        int startStay = estimateStayMinute(startSpot, true);
        return ranked.stream()
                .mapToInt(candidate -> startStay + estimateWalkMinute(startSpot, candidate) + minimumStayMinute(requestedDurationMinute, false))
                .min()
                .orElse(requestedDurationMinute);
    }

    private int minimumStayMinute(int requestedDurationMinute, boolean start) {
        if (requestedDurationMinute <= 20) {
            return start ? 2 : 3;
        }
        return start ? 3 : 5;
    }

    private int estimateStayMinute(TCampusSpot spot, boolean start) {
        if (isTemporarySpot(spot)) return 0;
        if (start) return 3;
        int recommend = spot.getRecommendTime() == null || spot.getRecommendTime() <= 0 ? 12 : spot.getRecommendTime();
        return Math.min(Math.max(recommend, 5), 25);
    }

    private int estimateWalkMinute(TCampusSpot from, TCampusSpot to) {
        double distance = distanceMeters(from, to);
        if (distance <= 0) return 3; // adjacent/unknown spots: assume 3 min walk (was 5)
        int minute = (int) Math.ceil(distance / 80.0); // slightly faster pace: 80 m/min
        return Math.min(Math.max(minute, 1), 12); // min 1 min for very close spots (was 2)
    }

    private double distanceMeters(TCampusSpot from, TCampusSpot to) {
        if (from.getLongitude() == null || from.getLatitude() == null || to.getLongitude() == null || to.getLatitude() == null) {
            return 0;
        }
        double lat1 = Math.toRadians(from.getLatitude().doubleValue());
        double lat2 = Math.toRadians(to.getLatitude().doubleValue());
        double deltaLat = lat2 - lat1;
        double deltaLng = Math.toRadians(to.getLongitude().doubleValue() - from.getLongitude().doubleValue());
        double a = Math.pow(Math.sin(deltaLat / 2), 2)
                + Math.cos(lat1) * Math.cos(lat2) * Math.pow(Math.sin(deltaLng / 2), 2);
        return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    private String buildRouteName(int durationMinute, Set<String> interests, String userMode) {
        if (containsInterest(interests, "校友", "返校")) return "校友返校 " + durationMinute + " 分钟路线";
        if (containsInterest(interests, "家长", "父母")) return "家长参访 " + durationMinute + " 分钟路线";
        if (containsInterest(interests, "新生")) return "新生 " + durationMinute + " 分钟 AI 导览路线";
        if (containsInterest(interests, "科研", "研学")) return "科研研学 " + durationMinute + " 分钟导览路线";
        if (containsInterest(interests, "拍照")) return "山海大学拍照打卡 " + durationMinute + " 分钟路线";
        if (containsInterest(interests, "校史", "历史")) return "山海大学校史文化 " + durationMinute + " 分钟路线";
        return getModeName(userMode) + " " + durationMinute + " 分钟 AI 导览路线";
    }

    private String buildRouteDesc(int durationMinute, List<TCampusSpot> selected, Set<String> interests) {
        String names = selected.stream().map(TCampusSpot::getSpotName).collect(Collectors.joining(" → "));
        String theme = interests.isEmpty() ? "校园文化与服务动线" : interests.stream().limit(3).collect(Collectors.joining("、"));
        return "围绕" + theme + "安排，预计 " + durationMinute + " 分钟左右，点位顺序为：" + names + "。";
    }

    private String buildRouteReason(Set<String> interests, String userMode, int durationMinute) {
        String theme = interests.isEmpty() ? "身份模式、点位开放状态和步行时间" : "你提到的\"" + interests.stream().limit(3).collect(Collectors.joining("、")) + "\"";
        return "根据" + theme + "，为" + getModeName(userMode) + "控制在约 " + durationMinute + " 分钟内；所有点位 ID 均来自当前启用的校园点位库。";
    }

    private boolean containsInterest(Set<String> interests, String... keywords) {
        String joined = normalize(String.join(",", interests));
        for (String keyword : keywords) {
            if (joined.contains(normalize(keyword))) return true;
        }
        return false;
    }

    private SpotRecommendation toSpotRecommendation(TCampusSpot spot, String reason) {
        SpotRecommendation recommendation = new SpotRecommendation();
        recommendation.setSpotId(spot.getId());
        recommendation.setSpotName(spot.getSpotName());
        recommendation.setSpotType(spot.getSpotType());
        recommendation.setLongitude(spot.getLongitude());
        recommendation.setLatitude(spot.getLatitude());
        recommendation.setRecommendTime(spot.getRecommendTime());
        recommendation.setSpotDesc(spot.getSpotDesc());
        recommendation.setSpotImage(spot.getSpotImage());
        recommendation.setOpenTime(spot.getOpenTime());
        recommendation.setReason(reason);
        return recommendation;
    }

    /**
     * 按类别去重：每个类别（图书馆、食堂、体育、宿舍…）只取第一个最高分点位。
     * 用于"推荐图书馆、食堂和体育馆三个点位"这类明确按类别要求的场景。
     */
    private List<SpotRecommendation> deduplicateByCategory(List<TCampusSpot> spots, int limit) {
        Map<String, SpotRecommendation> seen = new LinkedHashMap<>();
        for (TCampusSpot spot : spots) {
            String category = resolveSpotCategory(spot);
            if (!seen.containsKey(category)) {
                seen.put(category, toSpotRecommendation(spot, "与问题中的地点或服务需求匹配"));
            }
            if (seen.size() >= limit) break;
        }
        return new ArrayList<>(seen.values());
    }

    /**
     * 将点位归类到用户可理解的类别标签。
     * 用于去重和类别匹配。
     */
    private String resolveSpotCategory(TCampusSpot spot) {
        String name = normalize(spot.getSpotName());
        String type = normalize(spot.getSpotType());
        if (name.contains("图书馆") || type.contains("图书")) return "图书馆";
        if (name.contains("食堂") || name.contains("餐厅") || type.contains("餐饮")) return "食堂";
        if (name.contains("体育") || name.contains("运动") || name.contains("操场")
                || type.contains("运动")) return "体育";
        if (name.contains("宿舍") || name.contains("公寓") || type.contains("宿舍")) return "公寓";
        if (name.contains("校史") || type.contains("文化")) return "文化场馆";
        if (name.contains("停车") || type.contains("停车")) return "停车";
        if (name.contains("卫生间") || name.contains("厕所") || type.contains("卫生")) return "卫生间";
        if (name.contains("门")) return "校门";
        if (name.contains("湖") || name.contains("广场") || type.contains("景观")) return "景观";
        if (type.contains("教学")) return "教学场馆";
        if (type.contains("便民")) return "便民服务";
        return "其他";
    }

    /**
     * 路线意图：用户明确表达"路线、导航、从A到B、途经、多点、时长游览"等需求。
     * 注意："导览"单独出现不能作为路线意图证据，"小海导览介绍"必须识别为点位介绍。
     * "校园导览"等模糊路线需求也归入路线意图。
     */
    private boolean isRouteIntent(String text) {
        String normalized = normalize(text);
        // 强路线关键词：明确表达路线/行程/多点串联需求
        boolean strongRoute = containsAny(normalized, "路线", "怎么逛", "参观路线", "一日游", "半日游", "行程",
                "从南门", "从北门", "从东门", "从西门", "导航到", "走到", "先去", "再去",
                "带父母", "校友返校", "半小时", "一小时", "两小时", "90分钟",
                "校园导览", "校园游览", "怎么走", "怎么去");
        // 时间+动作组合：有分钟/小时且有游览/逛/玩等动词，且不是30秒介绍场景
        boolean timeActionRoute = (containsAny(normalized, "分钟", "小时") && !containsAny(normalized, "30秒", "秒介绍", "秒讲解", "秒简介"))
                && containsAny(normalized, "逛", "玩", "游览", "路线", "行程");
        // "从A到B" 或 "A到B怎么走" 模式
        boolean fromToPattern = normalized.contains("从") && containsAny(normalized, "到", "去")
                && containsAny(normalized, "怎么走", "怎么去", "路线", "导航", "走");
        return strongRoute || timeActionRoute || fromToPattern;
    }

    /**
     * 强点位介绍意图：包含"介绍、讲解、简介、开放时间、讲解词"等明确指向单点讲解的关键词。
     * 但若介绍的宾语是"路线"等路线实体，则不应判定为点位介绍。
     * 例如："介绍一条适合新生的校园路线" → 不应判定为强点位介绍（宾语是路线）。
     */
    private boolean isStrongSpotIntent(String text) {
        String normalized = normalize(text);
        // 如果介绍的宾语是路线/行程 → 不判定为强点位介绍
        if (containsAny(normalized, "介绍路线", "介绍一条路线", "介绍校园路线", "讲解路线")) {
            return false;
        }
        return containsAny(normalized, "介绍", "讲解", "简介", "讲解词", "开放时间", "几点开放",
                "这个建筑", "是做什么", "导览介绍", "导览讲解");
    }

    private boolean isSpotIntent(String text) {
        String normalized = normalize(text);
        // 强点位介绍意图（优先级高于路线意图）
        if (isStrongSpotIntent(text)) return true;
        return containsAny(normalized, "在哪里", "在哪", "食堂", "卫生间", "厕所", "停车场", "南门", "校史馆", "图书馆", "休息");
    }

    private boolean isActivityQuestion(String text) {
        String normalized = normalize(text);
        return containsAny(normalized, "活动", "公告", "讲座", "通知", "开放日", "最近有什么", "今天有什么");
    }

    /**
     * Detect "讲解当前点位" / "当前点位是什么" / "我在哪" — queries that need
     * location-based nearest-spot lookup, NOT general chat or clarification.
     */
    private boolean isCurrentSpotQuery(String text) {
        String normalized = normalize(text);
        return containsAny(normalized, "讲解当前点位", "介绍当前点位", "当前点位是什么",
                "当前点位介绍", "当前点位讲解", "这是什么地方", "我在哪", "附近是什么",
                "当前位置是什么", "当前所在位置", "我现在在哪", "我这是在哪",
                "讲解这个点位", "介绍这个点位")
                && !containsAny(normalized, "路线", "导航", "规划", "怎么去");
    }

    /**
     * Detect facility/service queries: toilets, cafeteria, parking, clinic, library hours, etc.
     */
    private boolean isFacilityQuery(String text) {
        String normalized = normalize(text);
        return containsAny(normalized, "厕所", "卫生间", "洗手间", "wc", "toilet", "restroom",
                "食堂", "餐厅", "吃饭", "用餐", "餐饮", "饭堂",
                "饮水", "喝水", "热水", "直饮水",
                "停车", "停车场",
                "医务室", "诊所", "医院", "急救",
                "便利店", "超市", "小卖部",
                "宿舍服务", "公寓服务",
                "无障碍", "轮椅", "坡道",
                "图书馆开放", "几点开", "几点关", "开放时间",
                "当前点位", "这是什么地方", "我在哪",
                "预约", "需要预约",
                "附近有", "最近", "离我近", "哪里有",
                "附近", "周边")
                && !containsAny(normalized, "介绍", "讲解", "路线", "导航", "规划", "游览");
    }

    /**
     * Build a reply for facility/service queries.
     * Handles: nearest toilet, cafeteria, parking, clinic, library hours, current spot, etc.
     */
    private ChatReply buildFacilityReply(String userContent, String userMode,
                                         Double startLng, Double startLat,
                                         String locationLabel, String startMode,
                                         List<TCampusSpot> enabledSpots) {
        String normalized = normalize(userContent);

        // 1. Toilet / restroom queries
        if (containsAny(normalized, "厕所", "卫生间", "洗手间", "wc", "toilet", "restroom")) {
            boolean isNav = containsAny(normalized, "带我去", "导航", "去最近", "带我到");
            if (isNav && startLng != null && startLat != null) {
                // Direct navigation to nearest toilet
                return findNearestFacilityByCategory("卫生间", "厕所", userMode, startLng, startLat, locationLabel, startMode);
            }
            return findNearestFacilityByCategory("卫生间", "厕所", userMode, startLng, startLat, locationLabel, startMode);
        }

        // 2. Cafeteria / dining queries
        if (containsAny(normalized, "食堂", "餐厅", "吃饭", "用餐", "餐饮", "饭堂")) {
            return findNearestFacilityByCategory("食堂", "餐厅", userMode, startLng, startLat, locationLabel, startMode);
        }

        // 3. Parking queries
        if (containsAny(normalized, "停车", "停车场")) {
            return findNearestFacilityByCategory("停车", "停车场", userMode, startLng, startLat, locationLabel, startMode);
        }

        // 4. Clinic / medical queries
        if (containsAny(normalized, "医务室", "诊所", "医院", "急救")) {
            return findNearestFacilityByCategory("医务", "医疗", userMode, startLng, startLat, locationLabel, startMode);
        }

        // 5. Water fountain queries
        if (containsAny(normalized, "饮水", "喝水", "热水", "直饮水")) {
            return findNearestFacilityByCategory("饮水", "便民", userMode, startLng, startLat, locationLabel, startMode);
        }

        // 6. Convenience store queries
        if (containsAny(normalized, "便利店", "超市", "小卖部")) {
            return findNearestFacilityByCategory("便利店", "便民", userMode, startLng, startLat, locationLabel, startMode);
        }

        // 7. Accessibility queries
        if (containsAny(normalized, "无障碍", "轮椅", "坡道")) {
            return findNearestFacilityByCategory("无障碍", "便民", userMode, startLng, startLat, locationLabel, startMode);
        }

        // 8. Library hours / open status queries
        if (containsAny(normalized, "图书馆开放", "几点开", "几点关")) {
            List<TCampusSpot> libraries = enabledSpots.stream()
                .filter(s -> normalize(s.getSpotName()).contains("图书馆") || normalize(s.getSpotType()).contains("图书"))
                .toList();
            if (!libraries.isEmpty()) {
                TCampusSpot lib = libraries.get(0);
                String openTime = lib.getOpenTime() == null || lib.getOpenTime().isBlank()
                        ? "以学校实际安排为准" : lib.getOpenTime();
                ChatReply reply = new ChatReply();
                reply.setAnswer(lib.getSpotName() + "开放时间：" + openTime + "。具体安排以学校实际通知为准。");
                reply.setCardType("spot_intro");
                reply.setResponseType("spot_intro");
                reply.setPrimarySpot(toSpotRecommendation(lib, "开放时间查询"));
                reply.setSuggestedActions(List.of(
                    SuggestedAction.of(ActionType.OPEN_SPOT_ON_MAP, "查看地图",
                        Map.of("spotId", lib.getId(), "spotName", lib.getSpotName())),
                    SuggestedAction.of(ActionType.START_SPOT_NAVIGATION, "开始导航",
                        Map.of("spotId", lib.getId(), "spotName", lib.getSpotName()))
                ));
                return reply;
            }
        }

        // 9. "当前点位是什么" / "我在哪" queries
        if (containsAny(normalized, "当前点位", "这是什么地方", "我在哪")) {
            if (startLng != null && startLat != null) {
                // Find the nearest spot to current location
                TCampusSpot nearest = enabledSpots.stream()
                    .filter(s -> s.getLongitude() != null && s.getLatitude() != null)
                    .min(Comparator.comparingDouble(s -> distanceMeters(
                        createTempSpot(startLng, startLat), s)))
                    .orElse(null);
                if (nearest != null) {
                    double dist = distanceMeters(createTempSpot(startLng, startLat), nearest);
                    ChatReply reply = new ChatReply();
                    reply.setAnswer("你当前在" + nearest.getSpotName() + "附近（约" + Math.round(dist) + "米）。");
                    reply.setCardType("spot_intro");
                    reply.setResponseType("spot_intro");
                    reply.setPrimarySpot(toSpotRecommendation(nearest, "距离当前位置最近"));
                    reply.setSuggestedActions(List.of(
                        SuggestedAction.of(ActionType.ASK_SPOT_INTRO, "小海讲解",
                            Map.of("spotId", nearest.getId(), "spotName", nearest.getSpotName())),
                        SuggestedAction.of(ActionType.OPEN_SPOT_ON_MAP, "查看地图",
                            Map.of("spotId", nearest.getId(), "spotName", nearest.getSpotName()))
                    ));
                    return reply;
                }
            }
            ChatReply reply = new ChatReply();
            reply.setAnswer("无法确定当前位置，请在地图页设置起点后再试。");
            reply.setCardType("none");
            reply.setResponseType("text");
            reply.setSuggestedActions(List.of(
                SuggestedAction.of(ActionType.USE_CURRENT_LOCATION, "使用当前位置"),
                SuggestedAction.of(ActionType.USE_DEMO_LOCATION, "使用演示位置")
            ));
            return reply;
        }

        // 10. "某点位需要预约吗" queries
        if (containsAny(normalized, "预约", "需要预约")) {
            // Find mentioned spots
            List<TCampusSpot> mentioned = enabledSpots.stream()
                .filter(s -> normalized.contains(normalize(s.getSpotName())))
                .limit(1)
                .toList();
            if (!mentioned.isEmpty()) {
                TCampusSpot spot = mentioned.get(0);
                ChatReply reply = new ChatReply();
                reply.setAnswer(spot.getSpotName() + "的预约信息当前资料未收录，具体预约要求以学校实际通知为准。建议查看校园官网或联系相关管理部门。");
                reply.setCardType("spot_intro");
                reply.setResponseType("spot_intro");
                reply.setPrimarySpot(toSpotRecommendation(spot, "预约查询"));
                reply.setSuggestedActions(List.of(
                    SuggestedAction.of(ActionType.ASK_SPOT_INTRO, "查看介绍",
                        Map.of("spotId", spot.getId(), "spotName", spot.getSpotName()))
                ));
                return reply;
            }
        }

        // 11. Generic "附近有什么" queries
        if (containsAny(normalized, "附近有", "附近", "周边") && startLng != null && startLat != null) {
            List<TCampusSpot> nearby = enabledSpots.stream()
                .filter(s -> s.getLongitude() != null && s.getLatitude() != null)
                .sorted(Comparator.comparingDouble(s -> distanceMeters(createTempSpot(startLng, startLat), s)))
                .limit(5)
                .toList();
            if (!nearby.isEmpty()) {
                List<SpotRecommendation> recs = nearby.stream()
                    .map(s -> {
                        SpotRecommendation rec = toSpotRecommendation(s, "附近点位");
                        double dist = distanceMeters(createTempSpot(startLng, startLat), s);
                        rec.setSpotDesc((rec.getSpotDesc() != null ? rec.getSpotDesc() : "") + " 约" + Math.round(dist) + "米");
                        return rec;
                    })
                    .toList();
                ChatReply reply = new ChatReply();
                reply.setAnswer("你附近有以下校园点位：");
                reply.setCardType("spot_list");
                reply.setResponseType("spot_list");
                reply.setSpotRecommendations(recs);
                reply.setSuggestedActions(recs.stream()
                    .map(r -> SuggestedAction.of(ActionType.OPEN_SPOT_ON_MAP, r.getSpotName(),
                        Map.of("spotId", r.getSpotId(), "spotName", r.getSpotName())))
                    .limit(5)
                    .collect(Collectors.toList()));
                return reply;
            }
        }

        // Fallthrough: let general chat handle it
        return buildGeneralChatReply(userContent, userMode);
    }

    private String detectEmotion(String userContent) {
        String normalized = normalize(userContent);
        if (containsAny(normalized, "喜欢", "满意", "感谢", "谢谢", "太好了", "方便")) return "positive";
        if (containsAny(normalized, "找不到", "太远", "不方便", "排队", "失望", "迷路")) return "negative";
        return "neutral";
    }

    private boolean matchesMode(String suitableMode, String userMode) {
        if (userMode == null || userMode.isBlank() || "guest".equals(userMode)) return true;
        if (suitableMode == null || suitableMode.isBlank()) return true;
        return normalize(suitableMode).contains(normalize(userMode));
    }

    private boolean containsAny(String normalized, String... keywords) {
        for (String keyword : keywords) {
            if (normalized.contains(normalize(keyword))) return true;
        }
        return false;
    }

    private Map<String, List<String>> interestAliases() {
        Map<String, List<String>> aliases = new LinkedHashMap<>();
        aliases.put("校史", List.of("校史", "学校历史", "历史", "校史馆", "文化"));
        aliases.put("拍照", List.of("拍照", "打卡", "出片", "景观", "湖边"));
        aliases.put("食堂", List.of("食堂", "餐厅", "吃饭", "用餐", "美食"));
        aliases.put("休息", List.of("休息", "坐一会", "歇脚", "长椅", "无障碍"));
        aliases.put("科研", List.of("科研", "实验室", "研究", "学术", "研学"));
        aliases.put("校友", List.of("校友", "返校", "校友返校", "校友之家"));
        aliases.put("家长", List.of("家长", "父母", "带父母", "亲子"));
        aliases.put("新生", List.of("新生", "报到", "入学", "宿舍"));
        aliases.put("活动", List.of("活动", "讲座", "展览", "开放日"));
        aliases.put("图书馆", List.of("图书馆", "借书", "自习", "阅览"));
        aliases.put("停车", List.of("停车", "停车场", "开车"));
        aliases.put("卫生间", List.of("卫生间", "厕所", "洗手间"));
        aliases.put("体育", List.of("体育馆", "体育场", "运动场", "操场", "体育中心", "运动", "健身房"));
        return aliases;
    }

    private String getModeName(String userMode) {
        if (userMode == null || userMode.isBlank()) return "用户";
        return switch (userMode) {
            case "alumni" -> "校友";
            case "fresh" -> "新生";
            case "parent" -> "家长";
            case "research" -> "研学访客";
            case "senior" -> "长者";
            case "guest" -> "普通游客";
            default -> "用户";
        };
    }

    private String shortText(String text, int maxLength) {
        if (text == null || text.isBlank()) return "";
        String trimmed = text.replaceAll("\\s+", " ").trim();
        return trimmed.length() <= maxLength ? trimmed : trimmed.substring(0, maxLength) + "...";
    }

    private BigDecimal toScaledBigDecimal(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value.setScale(6, RoundingMode.HALF_UP);
    }

    private String normalize(String text) {
        return text == null ? "" : text.toLowerCase(Locale.ROOT)
                .replaceAll("[\\s,，。！？?!.;；:：、()（）【】\\[\\]\"'']+", "")
                .trim();
    }
}
