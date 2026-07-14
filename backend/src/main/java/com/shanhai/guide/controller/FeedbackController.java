package com.shanhai.guide.controller;

import com.shanhai.guide.common.ApiResponse;
import com.shanhai.guide.entity.TUserFeedback;
import com.shanhai.guide.service.UserFeedbackService;
import com.shanhai.guide.service.SessionGuardService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@RestController
@RequestMapping("/api/feedback")
public class FeedbackController {

    private final UserFeedbackService userFeedbackService;
    private final SessionGuardService sessionGuardService;

    public FeedbackController(UserFeedbackService userFeedbackService, SessionGuardService sessionGuardService) {
        this.userFeedbackService = userFeedbackService;
        this.sessionGuardService = sessionGuardService;
    }

    @PostMapping("/submit")
    public ApiResponse<String> submitFeedback(@RequestParam String sessionId,
                                            @RequestParam String userMode,
                                            @RequestParam Integer score,
                                            @RequestParam String feedbackType,
                                            @RequestParam(required = false) String feedbackContent) {
        sessionGuardService.requireActiveUserAction(sessionId);
        userFeedbackService.submitFeedback(sessionId, userMode, score, feedbackType, feedbackContent);
        return ApiResponse.success("反馈提交成功");
    }

    @GetMapping("/list")
    public ApiResponse<List<TUserFeedback>> getFeedbacks(@RequestParam String sessionId) {
        sessionGuardService.requireActiveUserAction(sessionId);
        List<TUserFeedback> feedbacks = userFeedbackService.getUserFeedbacks(sessionId);
        return ApiResponse.success(feedbacks);
    }

    /**
     * 用户端“我的反馈/消息中心”查询入口。
     */
    @GetMapping("/my")
    public ApiResponse<List<TUserFeedback>> getMyFeedbacks(@RequestParam String sessionId) {
        sessionGuardService.requireActiveUserAction(sessionId);
        List<TUserFeedback> feedbacks = userFeedbackService.getUserFeedbacks(sessionId);
        return ApiResponse.success(feedbacks);
    }

    @GetMapping("/admin/list")
    public ApiResponse<List<Map<String, Object>>> getAllFeedbacks(@RequestParam(required = false) String userMode,
                                                                   @RequestParam(required = false) String status,
                                                                   @RequestParam(required = false) String feedbackType,
                                                                   @RequestParam(required = false) String ratingLevel,
                                                                   @RequestParam(required = false) String keyword,
                                                                   @RequestParam(required = false) String startTime,
                                                                   @RequestParam(required = false) String endTime) {
        LambdaQueryWrapper<TUserFeedback> wrapper = new LambdaQueryWrapper<>();
        if (userMode != null && !userMode.isBlank()) {
            wrapper.eq(TUserFeedback::getUserMode, userMode);
        }
        wrapper.orderByDesc(TUserFeedback::getCreateTime);
        List<Map<String, Object>> result = userFeedbackService.list(wrapper).stream()
                .filter(item -> matchesStatus(item, status))
                .filter(item -> matchesFeedbackType(item, feedbackType))
                .filter(item -> matchesRating(item, ratingLevel))
                .filter(item -> matchesKeyword(item, keyword))
                .filter(item -> matchesTime(item, startTime, endTime))
                .map(this::toAdminFeedbackView)
                .toList();
        return ApiResponse.success(result);
    }

    @PutMapping("/admin/{feedbackId}/reply")
    public ApiResponse<TUserFeedback> replyFeedback(@PathVariable Long feedbackId,
                                                    @RequestParam String adminReply) {
        TUserFeedback feedback = userFeedbackService.getById(feedbackId);
        if (feedback == null) {
            return ApiResponse.error("反馈不存在");
        }
        feedback.setAdminReply(adminReply);
        feedback.setReplyTime(LocalDateTime.now());
        userFeedbackService.updateById(feedback);
        return ApiResponse.success(feedback);
    }

    private Map<String, Object> toAdminFeedbackView(TUserFeedback feedback) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", feedback.getId());
        item.put("sessionId", feedback.getSessionId());
        item.put("userMode", feedback.getUserMode());
        item.put("score", feedback.getScore());
        item.put("feedbackType", normalizeFeedbackType(feedback.getFeedbackType()));
        item.put("rawFeedbackType", feedback.getFeedbackType());
        item.put("feedbackContent", feedback.getFeedbackContent());
        item.put("adminReply", feedback.getAdminReply());
        item.put("replyTime", feedback.getReplyTime());
        item.put("status", feedbackStatus(feedback));
        item.put("createTime", feedback.getCreateTime());
        item.put("updateTime", feedback.getUpdateTime());
        return item;
    }

    private boolean matchesStatus(TUserFeedback feedback, String status) {
        if (status == null || status.isBlank()) return true;
        return feedbackStatus(feedback).equals(status.trim());
    }

    private boolean matchesFeedbackType(TUserFeedback feedback, String feedbackType) {
        if (feedbackType == null || feedbackType.isBlank()) return true;
        return normalizeFeedbackType(feedback.getFeedbackType()).equals(normalizeFeedbackType(feedbackType));
    }

    private boolean matchesRating(TUserFeedback feedback, String ratingLevel) {
        if (ratingLevel == null || ratingLevel.isBlank()) return true;
        Integer score = feedback.getScore();
        if (score == null) return false;
        String normalized = ratingLevel.trim().toLowerCase(Locale.ROOT);
        if (normalized.matches("\\d+")) return score.equals(Integer.parseInt(normalized));
        return switch (normalized) {
            case "positive", "good", "high" -> score >= 4;
            case "neutral", "middle" -> score == 3;
            case "negative", "bad", "low" -> score <= 2;
            default -> true;
        };
    }

    private boolean matchesKeyword(TUserFeedback feedback, String keyword) {
        if (keyword == null || keyword.isBlank()) return true;
        String text = (feedback.getSessionId() + " " + feedback.getFeedbackContent() + " " + feedback.getAdminReply()).toLowerCase(Locale.ROOT);
        return text.contains(keyword.trim().toLowerCase(Locale.ROOT));
    }

    private boolean matchesTime(TUserFeedback feedback, String startTime, String endTime) {
        LocalDateTime createTime = feedback.getCreateTime();
        if (createTime == null) return true;
        LocalDateTime start = parseTime(startTime, true);
        LocalDateTime end = parseTime(endTime, false);
        if (start != null && createTime.isBefore(start)) return false;
        return end == null || !createTime.isAfter(end);
    }

    private LocalDateTime parseTime(String value, boolean startOfDay) {
        if (value == null || value.isBlank()) return null;
        try {
            return LocalDateTime.parse(value.trim());
        } catch (Exception ignored) {
            try {
                LocalDate date = LocalDate.parse(value.trim());
                return startOfDay ? date.atStartOfDay() : date.atTime(LocalTime.MAX);
            } catch (Exception ignoredAgain) {
                return null;
            }
        }
    }

    private String feedbackStatus(TUserFeedback feedback) {
        return feedback.getAdminReply() == null || feedback.getAdminReply().isBlank() ? "pending" : "processed";
    }

    private String normalizeFeedbackType(String type) {
        String normalized = type == null ? "" : type.trim().toLowerCase(Locale.ROOT);
        if (normalized.contains("guide") || normalized.contains("导览") || normalized.contains("讲解")) return "guide";
        if (normalized.contains("map") || normalized.contains("地图") || normalized.contains("导航")) return "map";
        if (normalized.contains("activity") || normalized.contains("活动") || normalized.contains("预约")) return "activity";
        if (normalized.contains("digital") || normalized.contains("human") || normalized.contains("ai") || normalized.contains("数字人")) return "digital_human";
        if (normalized.contains("account") || normalized.contains("login") || normalized.contains("账号") || normalized.contains("登录")) return "account";
        return "other";
    }
}
