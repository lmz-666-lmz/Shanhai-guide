package com.softwarecup.shanhai.service;

import com.softwarecup.shanhai.dto.ChatTrendResponse;
import com.softwarecup.shanhai.dto.DashboardStatsResponse;
import com.softwarecup.shanhai.dto.HotQuestionResponse;
import com.softwarecup.shanhai.dto.RecentChatResponse;
import com.softwarecup.shanhai.dto.SentimentStatsResponse;
import com.softwarecup.shanhai.dto.VisitorInsightResponse;
import com.softwarecup.shanhai.dto.VisitorModeStatsResponse;
import com.softwarecup.shanhai.entity.ChatRecord;
import com.softwarecup.shanhai.repository.CampusRouteRepository;
import com.softwarecup.shanhai.repository.CampusSpotRepository;
import com.softwarecup.shanhai.repository.ChatRecordRepository;
import com.softwarecup.shanhai.repository.KnowledgeDocRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
public class DashboardService {

    private final ChatRecordRepository chatRecordRepository;
    private final CampusSpotRepository campusSpotRepository;
    private final CampusRouteRepository campusRouteRepository;
    private final KnowledgeDocRepository knowledgeDocRepository;

    public DashboardService(ChatRecordRepository chatRecordRepository, CampusSpotRepository campusSpotRepository, CampusRouteRepository campusRouteRepository, KnowledgeDocRepository knowledgeDocRepository) {
        this.chatRecordRepository = chatRecordRepository;
        this.campusSpotRepository = campusSpotRepository;
        this.campusRouteRepository = campusRouteRepository;
        this.knowledgeDocRepository = knowledgeDocRepository;
    }

    public DashboardStatsResponse overview() {
        LocalDate today = LocalDate.now();
        long totalCount = chatRecordRepository.count();
        long todayCount = chatRecordRepository.countByCreatedAtBetween(today.atStartOfDay(), today.atTime(LocalTime.MAX));
        long successCount = chatRecordRepository.countBySuccessTrue();
        double successRate = totalCount == 0 ? 0 : Math.round(successCount * 10000.0 / totalCount) / 10000.0;
        LocalDateTime latest = chatRecordRepository.findFirstByOrderByCreatedAtDesc().map(ChatRecord::getCreatedAt).orElse(null);

        return new DashboardStatsResponse(todayCount, totalCount, campusSpotRepository.count(), campusRouteRepository.count(), knowledgeDocRepository.count(), successRate, latest);
    }

    public List<HotQuestionResponse> hotQuestions() {
        return toHotQuestions(chatRecordRepository.findHotQuestions(PageRequest.of(0, 10)));
    }

    public List<VisitorModeStatsResponse> userModes() {
        return chatRecordRepository.countByUserModeGroup().stream()
                .map(row -> new VisitorModeStatsResponse(toStringValue(row[0], "未知模式"), toLongValue(row[1])))
                .toList();
    }

    public List<SentimentStatsResponse> sentiment() {
        return chatRecordRepository.countByEmotionGroup().stream()
                .map(row -> new SentimentStatsResponse(toStringValue(row[0], "unknown"), toLongValue(row[1])))
                .toList();
    }

    public List<RecentChatResponse> recentChats() {
        return chatRecordRepository.findTop20ByOrderByCreatedAtDesc().stream()
                .map(chat -> new RecentChatResponse(chat.getId(), chat.getUserMessage(), chat.getAiAnswer(), chat.getUserMode(), chat.getEmotion(), chat.getSuccess(), chat.getCreatedAt()))
                .toList();
    }

    public List<ChatTrendResponse> trend() {
        LocalDate today = LocalDate.now();
        List<ChatTrendResponse> result = new ArrayList<>();
        for (int i = 6; i >= 0; i--) {
            LocalDate date = today.minusDays(i);
            long count = chatRecordRepository.countByCreatedAtBetween(date.atStartOfDay(), date.atTime(LocalTime.MAX));
            result.add(new ChatTrendResponse(date.toString(), count));
        }
        return result;
    }

    public VisitorInsightResponse visitorInsight() {
        List<ChatRecord> recentChats = chatRecordRepository.findTop200ByOrderByCreatedAtDesc();
        List<HotQuestionResponse> hot = toHotQuestions(chatRecordRepository.findHotQuestions(PageRequest.of(0, 8)));
        List<HotQuestionResponse> negative = topQuestionsInMemory(recentChats.stream()
                .filter(chat -> containsAny(chat.getEmotion(), "negative", "sad", "angry", "焦虑", "不满"))
                .toList(), 8);
        List<HotQuestionResponse> failed = toHotQuestions(chatRecordRepository.findFailedQuestions(PageRequest.of(0, 8)));
        List<String> suggestions = buildSuggestions(recentChats, failed);
        return new VisitorInsightResponse(hot, negative, failed, userModes(), sentiment(), suggestions);
    }

    private List<String> buildSuggestions(List<ChatRecord> chats, List<HotQuestionResponse> failed) {
        List<String> suggestions = new ArrayList<>();
        if (!failed.isEmpty()) {
            suggestions.add("存在未命中或失败问答，建议补充知识库资料并完善公告、点位讲解词。");
        }
        long spotQuestions = chats.stream().filter(chat -> containsAny(chat.getUserMessage(), "点位", "校史馆", "图书馆", "食堂", "学院")).count();
        if (spotQuestions > 0) {
            suggestions.add("点位相关问题较多，建议优化热门点位讲解内容和地图导览入口。");
        }
        long alumniQuestions = chats.stream().filter(chat -> containsAny(chat.getUserMode(), "校友") || containsAny(chat.getUserMessage(), "校友", "返校", "母校")).count();
        if (alumniQuestions > 0) {
            suggestions.add("校友访问需求明显，建议突出校友路线、校友之家和近期校友活动公告。");
        }
        if (suggestions.isEmpty()) {
            suggestions.add("当前问答运行平稳，可持续观察热门问题并补充高频资料。");
        }
        return suggestions;
    }

    private List<HotQuestionResponse> topQuestionsInMemory(List<ChatRecord> chats, int limit) {
        return chats.stream()
                .filter(chat -> StringUtils.hasText(chat.getUserMessage()))
                .collect(java.util.stream.Collectors.groupingBy(chat -> normalizeQuestion(chat.getUserMessage()), java.util.stream.Collectors.counting()))
                .entrySet().stream()
                .sorted(java.util.Map.Entry.<String, Long>comparingByValue().reversed().thenComparing(java.util.Map.Entry.comparingByKey()))
                .limit(limit)
                .map(entry -> new HotQuestionResponse(entry.getKey(), entry.getValue()))
                .toList();
    }

    private List<HotQuestionResponse> toHotQuestions(List<Object[]> rows) {
        return rows.stream()
                .map(row -> new HotQuestionResponse(toStringValue(row[0], "未知问题"), toLongValue(row[1])))
                .toList();
    }

    private String normalizeQuestion(String question) {
        return question == null ? "" : question.trim().replaceAll("\\s+", " ");
    }

    private String toStringValue(Object value, String fallback) {
        return value == null || !StringUtils.hasText(String.valueOf(value)) ? fallback : String.valueOf(value).trim();
    }

    private long toLongValue(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        return 0L;
    }

    private boolean containsAny(String value, String... terms) {
        if (!StringUtils.hasText(value)) {
            return false;
        }
        String text = value.toLowerCase(Locale.ROOT);
        for (String term : terms) {
            if (text.contains(term.toLowerCase(Locale.ROOT))) {
                return true;
            }
        }
        return false;
    }
}
