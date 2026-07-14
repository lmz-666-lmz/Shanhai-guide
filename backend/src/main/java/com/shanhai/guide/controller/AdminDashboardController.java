package com.shanhai.guide.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.shanhai.guide.common.ApiResponse;
import com.shanhai.guide.entity.TCampusRoute;
import com.shanhai.guide.entity.TCampusSpot;
import com.shanhai.guide.entity.TUserActivityReserve;
import com.shanhai.guide.entity.TUserChatHistory;
import com.shanhai.guide.entity.TUserCheckin;
import com.shanhai.guide.entity.TUser;
import com.shanhai.guide.entity.TUserContentApplication;
import com.shanhai.guide.entity.TUserFavorite;
import com.shanhai.guide.entity.TUserFeedback;
import com.shanhai.guide.entity.TUserSession;
import com.shanhai.guide.mapper.CampusRouteMapper;
import com.shanhai.guide.mapper.CampusSpotMapper;
import com.shanhai.guide.mapper.UserActivityReserveMapper;
import com.shanhai.guide.mapper.UserChatHistoryMapper;
import com.shanhai.guide.mapper.UserCheckinMapper;
import com.shanhai.guide.mapper.UserContentApplicationMapper;
import com.shanhai.guide.mapper.UserFavoriteMapper;
import com.shanhai.guide.mapper.UserFeedbackMapper;
import com.shanhai.guide.mapper.UserMapper;
import com.shanhai.guide.mapper.UserSessionMapper;
import com.shanhai.guide.service.TimeProvider;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/dashboard")
public class AdminDashboardController {

    private final UserSessionMapper userSessionMapper;
    private final UserChatHistoryMapper userChatHistoryMapper;
    private final UserActivityReserveMapper reserveMapper;
    private final UserCheckinMapper checkinMapper;
    private final UserFavoriteMapper favoriteMapper;
    private final UserFeedbackMapper feedbackMapper;
    private final CampusSpotMapper spotMapper;
    private final CampusRouteMapper routeMapper;
    private final UserMapper userMapper;
    private final UserContentApplicationMapper applicationMapper;

    public AdminDashboardController(UserSessionMapper userSessionMapper,
                                    UserChatHistoryMapper userChatHistoryMapper,
                                    UserActivityReserveMapper reserveMapper,
                                    UserCheckinMapper checkinMapper,
                                    UserFavoriteMapper favoriteMapper,
                                    UserFeedbackMapper feedbackMapper,
                                    CampusSpotMapper spotMapper,
                                    CampusRouteMapper routeMapper,
                                    UserMapper userMapper,
                                    UserContentApplicationMapper applicationMapper) {
        this.userSessionMapper = userSessionMapper;
        this.userChatHistoryMapper = userChatHistoryMapper;
        this.reserveMapper = reserveMapper;
        this.checkinMapper = checkinMapper;
        this.favoriteMapper = favoriteMapper;
        this.feedbackMapper = feedbackMapper;
        this.spotMapper = spotMapper;
        this.routeMapper = routeMapper;
        this.userMapper = userMapper;
        this.applicationMapper = applicationMapper;
    }

    @GetMapping("/overview")
    public ApiResponse<Map<String, Object>> overview() {
        LocalDate today = TimeProvider.today();
        LocalDateTime todayStart = TimeProvider.todayStart();
        LocalDateTime weekStart = TimeProvider.weekStart();

        long todayServicePeople = userSessionMapper.selectCount(new LambdaQueryWrapper<TUserSession>()
                .ge(TUserSession::getCreateTime, todayStart));
        long weekServicePeople = userSessionMapper.selectCount(new LambdaQueryWrapper<TUserSession>()
                .ge(TUserSession::getCreateTime, weekStart));
        List<TUserChatHistory> allChats = userChatHistoryMapper.selectList(null);
        long todayChatCount = allChats.stream()
                .filter(chat -> chat.getCreateTime() != null && !chat.getCreateTime().isBefore(todayStart))
                .count();
        long totalChatCount = allChats.size();
        long hitCount = allChats.stream().filter(this::hasKnowledgeSource).count();
        long missedCount = Math.max(totalChatCount - hitCount, 0);
        long pendingFeedbackCount = feedbackMapper.selectList(null).stream().filter(this::isPendingFeedback).count();
        long pendingApplicationCount = applicationMapper.selectCount(new LambdaQueryWrapper<TUserContentApplication>()
                .eq(TUserContentApplication::getStatus, 0));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("todayServicePeople", todayServicePeople);
        result.put("weekServicePeople", weekServicePeople);
        result.put("registeredUsers", userMapper.selectCount(null));
        result.put("sessionUsers", userSessionMapper.selectCount(null));
        result.put("todayChatCount", todayChatCount);
        result.put("activityReserveCount", reserveMapper.selectCount(new LambdaQueryWrapper<TUserActivityReserve>()
                .eq(TUserActivityReserve::getReserveStatus, 1)));
        result.put("checkinCount", checkinMapper.selectCount(null));
        result.put("favoriteCount", favoriteMapper.selectCount(null));
        result.put("pendingFeedbackCount", pendingFeedbackCount);
        result.put("pendingApplicationCount", pendingApplicationCount);
        result.put("totalChatCount", totalChatCount);
        result.put("knowledgeHitRate", totalChatCount == 0 ? BigDecimal.ZERO : percent(hitCount, totalChatCount));
        result.put("missedQuestionCount", missedCount);
        result.put("digitalHumanServiceMinutes", 0);
        return ApiResponse.success(result);
    }

    @GetMapping("/data-screen")
    public ApiResponse<Map<String, Object>> dataScreen() {
        List<TUserSession> sessions = userSessionMapper.selectList(null);
        List<TUserChatHistory> chats = userChatHistoryMapper.selectList(null);
        List<TUserFeedback> feedbacks = feedbackMapper.selectList(null);
        long totalChatCount = chats.size();
        long knowledgeHitCount = chats.stream().filter(this::hasKnowledgeSource).count();

        Map<String, Object> core = new LinkedHashMap<>();
        Map<String, Object> overview = overview().getData();
        core.put("todayServicePeople", overview.getOrDefault("todayServicePeople", 0));
        core.put("weekServicePeople", overview.getOrDefault("weekServicePeople", 0));
        core.put("registeredUsers", overview.getOrDefault("registeredUsers", 0));
        core.put("sessionUsers", overview.getOrDefault("sessionUsers", 0));
        core.put("todayChatCount", overview.getOrDefault("todayChatCount", 0));
        core.put("activityReserveCount", overview.getOrDefault("activityReserveCount", 0));
        core.put("checkinCount", overview.getOrDefault("checkinCount", 0));
        core.put("favoriteCount", overview.getOrDefault("favoriteCount", 0));
        core.put("pendingFeedbackCount", overview.getOrDefault("pendingFeedbackCount", 0));
        core.put("pendingApplicationCount", overview.getOrDefault("pendingApplicationCount", 0));

        Map<String, Object> analysis = new LinkedHashMap<>();
        analysis.put("visitTrend", trendByDate(sessions.stream().map(TUserSession::getCreateTime).toList(), "visits"));
        analysis.put("chatTrend", trendByDate(chats.stream().map(TUserChatHistory::getCreateTime).toList(), "questions"));
        analysis.put("hotSpots", hotSpots().getData());
        analysis.put("hotRoutes", hotRoutes().getData());
        analysis.put("hotQuestions", hotQuestions().getData());
        analysis.put("userModeDistribution", userModeDistribution().getData());
        analysis.put("feedbackStatusDistribution", feedbackStatusDistribution(feedbacks));
        analysis.put("feedbackTypeDistribution", feedbackTypeDistribution(feedbacks));
        analysis.put("knowledgeHitRate", totalChatCount == 0 ? BigDecimal.ZERO : percent(knowledgeHitCount, totalChatCount));
        analysis.put("missedQuestionCount", Math.max(totalChatCount - knowledgeHitCount, 0));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("coreMetrics", core);
        result.put("analysis", analysis);
        return ApiResponse.success(result);
    }

    @GetMapping("/hot-spots")
    public ApiResponse<List<Map<String, Object>>> hotSpots() {
        Map<Long, Long> counts = new HashMap<>();
        checkinMapper.selectList(new LambdaQueryWrapper<TUserCheckin>().isNotNull(TUserCheckin::getSpotId))
                .forEach(item -> counts.merge(item.getSpotId(), 1L, Long::sum));
        favoriteMapper.selectList(new LambdaQueryWrapper<TUserFavorite>().eq(TUserFavorite::getFavoriteType, 1))
                .forEach(item -> counts.merge(item.getTargetId(), 1L, Long::sum));
        if (counts.isEmpty()) return ApiResponse.success(List.of());
        return ApiResponse.success(toNamedRank(counts, spotMapper.selectBatchIds(counts.keySet()), TCampusSpot::getId, TCampusSpot::getSpotName, 10));
    }

    @GetMapping("/hot-routes")
    public ApiResponse<List<Map<String, Object>>> hotRoutes() {
        Map<Long, Long> counts = new HashMap<>();
        checkinMapper.selectList(new LambdaQueryWrapper<TUserCheckin>().isNotNull(TUserCheckin::getRouteId))
                .forEach(item -> counts.merge(item.getRouteId(), 1L, Long::sum));
        favoriteMapper.selectList(new LambdaQueryWrapper<TUserFavorite>().eq(TUserFavorite::getFavoriteType, 2))
                .forEach(item -> counts.merge(item.getTargetId(), 1L, Long::sum));
        if (counts.isEmpty()) return ApiResponse.success(List.of());
        return ApiResponse.success(toNamedRank(counts, routeMapper.selectBatchIds(counts.keySet()), TCampusRoute::getId, TCampusRoute::getRouteName, 5));
    }

    @GetMapping("/hot-questions")
    public ApiResponse<List<Map<String, Object>>> hotQuestions() {
        Map<String, Long> counts = userChatHistoryMapper.selectList(new LambdaQueryWrapper<TUserChatHistory>()
                        .isNotNull(TUserChatHistory::getUserContent))
                .stream()
                .map(TUserChatHistory::getUserContent)
                .filter(content -> content != null && !content.isBlank())
                .collect(Collectors.groupingBy(this::normalizeQuestion, Collectors.counting()));
        List<Map<String, Object>> list = counts.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .limit(10)
                .map(entry -> {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("question", entry.getKey());
                    item.put("count", entry.getValue());
                    return item;
                })
                .toList();
        return ApiResponse.success(list);
    }

    @GetMapping("/feedback-summary")
    public ApiResponse<Map<String, Object>> feedbackSummary() {
        List<TUserFeedback> feedbacks = feedbackMapper.selectList(null);
        List<TUserChatHistory> chats = userChatHistoryMapper.selectList(null);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("feedbackCount", feedbacks.size());
        result.put("averageScore", averageScore(feedbacks));
        result.put("positiveFeedback", feedbacks.stream().filter(item -> item.getScore() != null && item.getScore() >= 4).count());
        result.put("neutralFeedback", feedbacks.stream().filter(item -> item.getScore() != null && item.getScore() == 3).count());
        result.put("negativeFeedback", feedbacks.stream().filter(item -> item.getScore() != null && item.getScore() <= 2).count());
        result.put("emotionDistribution", emotionDistribution(chats));
        result.put("satisfactionTrend", satisfactionTrend(feedbacks));
        return ApiResponse.success(result);
    }

    @GetMapping("/user-mode-distribution")
    public ApiResponse<List<Map<String, Object>>> userModeDistribution() {
        // 统计注册用户的身份分布（t_user.user_mode），而非会话模式。
        // 每个注册用户只计数一次，不受多次登录或多 session 影响。
        Map<String, Long> counts = userMapper.selectList(null).stream()
                .filter(user -> user.getUserMode() != null && !user.getUserMode().isBlank())
                .collect(Collectors.groupingBy(TUser::getUserMode, Collectors.counting()));
        List<Map<String, Object>> result = counts.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .map(entry -> {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("mode", entry.getKey());
                    item.put("label", modeName(entry.getKey()));
                    item.put("count", entry.getValue());
                    return item;
                })
                .toList();
        return ApiResponse.success(result);
    }

    private <T> List<Map<String, Object>> toNamedRank(Map<Long, Long> counts,
                                                      List<T> entities,
                                                      Function<T, Long> idGetter,
                                                      Function<T, String> nameGetter,
                                                      int limit) {
        if (counts.isEmpty()) return List.of();
        Map<Long, T> byId = entities.stream().collect(Collectors.toMap(idGetter, Function.identity(), (a, b) -> a));
        return counts.entrySet().stream()
                .sorted(Map.Entry.<Long, Long>comparingByValue().reversed())
                .limit(limit)
                .map(entry -> {
                    T entity = byId.get(entry.getKey());
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("id", entry.getKey());
                    item.put("name", entity == null ? "已下架资源" : nameGetter.apply(entity));
                    item.put("count", entry.getValue());
                    return item;
                })
                .toList();
    }

    private BigDecimal percent(long hit, long total) {
        if (total == 0) return BigDecimal.ZERO;
        return BigDecimal.valueOf(hit * 100).divide(BigDecimal.valueOf(total), 1, RoundingMode.HALF_UP);
    }

    private boolean hasKnowledgeSource(TUserChatHistory chat) {
        String sourceInfo = chat == null ? null : chat.getSourceInfo();
        return sourceInfo != null && sourceInfo.contains("\"sourceType\":\"knowledge\"");
    }

    private boolean isPendingFeedback(TUserFeedback feedback) {
        return feedback.getAdminReply() == null || feedback.getAdminReply().isBlank();
    }

    private List<Map<String, Object>> trendByDate(List<LocalDateTime> times, String countKey) {
        LocalDate today = TimeProvider.today();
        Map<LocalDate, Long> counts = times.stream()
                .filter(Objects::nonNull)
                .collect(Collectors.groupingBy(LocalDateTime::toLocalDate, Collectors.counting()));
        List<Map<String, Object>> result = new ArrayList<>();
        for (int i = 6; i >= 0; i--) {
            LocalDate date = today.minusDays(i);
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("date", date.toString());
            item.put(countKey, counts.getOrDefault(date, 0L));
            result.add(item);
        }
        return result;
    }

    private List<Map<String, Object>> feedbackStatusDistribution(List<TUserFeedback> feedbacks) {
        long pending = feedbacks.stream().filter(this::isPendingFeedback).count();
        long processed = feedbacks.size() - pending;
        return List.of(
                distributionItem("pending", "待处理", pending),
                distributionItem("processed", "已处理", processed),
                distributionItem("closed", "已关闭", 0L)
        );
    }

    private List<Map<String, Object>> feedbackTypeDistribution(List<TUserFeedback> feedbacks) {
        Map<String, Long> counts = feedbacks.stream()
                .collect(Collectors.groupingBy(item -> normalizeFeedbackType(item.getFeedbackType()), Collectors.counting()));
        return List.of("guide", "map", "activity", "digital_human", "account", "other").stream()
                .map(key -> distributionItem(key, feedbackTypeLabel(key), counts.getOrDefault(key, 0L)))
                .toList();
    }

    private Map<String, Object> distributionItem(String key, String label, long count) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("key", key);
        item.put("label", label);
        item.put("count", count);
        return item;
    }

    private String normalizeFeedbackType(String type) {
        String normalized = type == null ? "" : type.toLowerCase(Locale.ROOT);
        if (normalized.contains("guide") || normalized.contains("导览") || normalized.contains("讲解")) return "guide";
        if (normalized.contains("map") || normalized.contains("地图") || normalized.contains("导航")) return "map";
        if (normalized.contains("activity") || normalized.contains("活动") || normalized.contains("预约")) return "activity";
        if (normalized.contains("digital") || normalized.contains("human") || normalized.contains("ai") || normalized.contains("数字人")) return "digital_human";
        if (normalized.contains("account") || normalized.contains("login") || normalized.contains("账号") || normalized.contains("登录")) return "account";
        return "other";
    }

    private String feedbackTypeLabel(String key) {
        return switch (key) {
            case "guide" -> "导览";
            case "map" -> "地图";
            case "activity" -> "活动";
            case "digital_human" -> "数字人";
            case "account" -> "账号";
            default -> "其他";
        };
    }

    private BigDecimal averageScore(List<TUserFeedback> feedbacks) {
        List<Integer> scores = feedbacks.stream()
                .map(TUserFeedback::getScore)
                .filter(score -> score != null && score > 0)
                .toList();
        if (scores.isEmpty()) return null;
        double avg = scores.stream().mapToInt(Integer::intValue).average().orElse(0);
        return BigDecimal.valueOf(avg).setScale(1, RoundingMode.HALF_UP);
    }

    private List<Map<String, Object>> emotionDistribution(List<TUserChatHistory> chats) {
        Map<String, Long> counts = chats.stream()
                .collect(Collectors.groupingBy(chat -> chat.getEmotionTag() == null ? "neutral" : chat.getEmotionTag(), Collectors.counting()));
        List<Map<String, Object>> result = new ArrayList<>();
        for (String key : List.of("positive", "neutral", "negative")) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("emotion", key);
            item.put("label", switch (key) {
                case "positive" -> "正向";
                case "negative" -> "负向";
                default -> "中性";
            });
            item.put("count", counts.getOrDefault(key, 0L));
            result.add(item);
        }
        return result;
    }

    private List<Map<String, Object>> satisfactionTrend(List<TUserFeedback> feedbacks) {
        Map<LocalDate, List<TUserFeedback>> byDate = feedbacks.stream()
                .filter(item -> item.getCreateTime() != null && item.getScore() != null)
                .collect(Collectors.groupingBy(item -> item.getCreateTime().toLocalDate()));
        return byDate.entrySet().stream()
                .sorted(Map.Entry.comparingByKey(Comparator.naturalOrder()))
                .map(entry -> {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("date", entry.getKey().toString());
                    item.put("averageScore", averageScore(entry.getValue()));
                    return item;
                })
                .toList();
    }

    private String normalizeQuestion(String content) {
        String normalized = content.replaceAll("\\s+", " ").trim();
        return normalized.length() > 50 ? normalized.substring(0, 50) + "..." : normalized;
    }

    private String modeName(String mode) {
        return switch (mode) {
            case "alumni" -> "校友";
            case "fresh" -> "新生";
            case "parent" -> "家长";
            case "research" -> "研学访客";
            case "guest" -> "普通游客";
            case "senior" -> "长者";
            default -> "未知";
        };
    }
}
