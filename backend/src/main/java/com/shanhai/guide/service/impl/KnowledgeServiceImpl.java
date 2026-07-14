package com.shanhai.guide.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.shanhai.guide.entity.TKnowledge;
import com.shanhai.guide.mapper.KnowledgeMapper;
import com.shanhai.guide.service.KnowledgeService;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
public class KnowledgeServiceImpl extends ServiceImpl<KnowledgeMapper, TKnowledge> implements KnowledgeService {

    private static final int MIN_RELEVANT_SCORE = 18;

    private static final List<String> STOP_WORDS = List.of(
            "请", "请问", "麻烦", "帮我", "我想知道", "告诉我", "介绍一下", "介绍", "讲讲", "讲解",
            "了解", "一下", "详细", "关于", "有关", "这个", "那个", "有没有", "是什么", "吗", "呢", "的"
    );

    private static final Map<String, List<String>> SYNONYMS = new LinkedHashMap<>();

    static {
        SYNONYMS.put("校史", List.of("校史", "学校历史", "发展历史", "历史", "校史馆", "办学历史"));
        SYNONYMS.put("图书馆", List.of("图书馆", "图书", "借书", "阅览", "自习", "学习"));
        SYNONYMS.put("食堂", List.of("食堂", "餐厅", "吃饭", "用餐", "餐饮", "美食"));
        SYNONYMS.put("校友", List.of("校友", "返校", "校友返校", "校友之家"));
        SYNONYMS.put("科研", List.of("科研", "研究", "实验室", "学术", "成果", "研学"));
        SYNONYMS.put("活动", List.of("活动", "讲座", "公告", "通知", "开放日"));
        SYNONYMS.put("路线", List.of("路线", "游览", "参观", "规划", "怎么逛"));
        SYNONYMS.put("服务", List.of("服务", "停车", "卫生间", "厕所", "休息", "无障碍"));
    }

    @Override
    public List<TKnowledge> searchKnowledge(String keyword, String userMode, Integer limit) {
        return searchRelevant(keyword, userMode, limit);
    }

    @Override
    public List<TKnowledge> searchRelevant(String message, String userMode, Integer limit) {
        String normalizedQuery = normalize(stripStopWords(message));
        List<String> tokens = extractTokens(message);
        if (normalizedQuery.isBlank() && tokens.isEmpty()) {
            return List.of();
        }

        LambdaQueryWrapper<TKnowledge> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TKnowledge::getIsEnable, 1);
        List<TKnowledge> candidates = list(wrapper).stream()
                .filter(item -> matchesMode(item.getSuitableMode(), userMode))
                .toList();

        return candidates.stream()
                .map(item -> new KnowledgeScore(item, score(item, normalizedQuery, tokens)))
                .filter(item -> item.score >= MIN_RELEVANT_SCORE)
                .sorted(Comparator.comparingInt(KnowledgeScore::score).reversed()
                        .thenComparing(item -> item.knowledge.getUpdateTime(), Comparator.nullsLast(Comparator.reverseOrder()))
                        .thenComparing(item -> item.knowledge.getId(), Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(normalizeLimit(limit))
                .map(KnowledgeScore::knowledge)
                .toList();
    }

    @Override
    public List<TKnowledge> listForAdmin(String keyword, String knowledgeType, String suitableMode, Integer isEnable) {
        LambdaQueryWrapper<TKnowledge> wrapper = new LambdaQueryWrapper<>();
        if (isEnable != null) {
            wrapper.eq(TKnowledge::getIsEnable, isEnable);
        }
        if (knowledgeType != null && !knowledgeType.isBlank()) {
            wrapper.eq(TKnowledge::getKnowledgeType, knowledgeType);
        }
        if (suitableMode != null && !suitableMode.isBlank()) {
            wrapper.and(w -> w.like(TKnowledge::getSuitableMode, suitableMode)
                    .or().isNull(TKnowledge::getSuitableMode)
                    .or().eq(TKnowledge::getSuitableMode, ""));
        }
        if (keyword != null && !keyword.isBlank()) {
            String trimmed = keyword.trim();
            wrapper.and(w -> w.like(TKnowledge::getTitle, trimmed)
                    .or().like(TKnowledge::getContent, trimmed)
                    .or().like(TKnowledge::getKnowledgeType, trimmed));
        }
        wrapper.orderByDesc(TKnowledge::getUpdateTime).orderByDesc(TKnowledge::getId);
        return list(wrapper);
    }

    @Override
    public String getSourceName(TKnowledge knowledge) {
        if (knowledge == null || knowledge.getKnowledgeType() == null || knowledge.getKnowledgeType().isBlank()) {
            return "知识库";
        }
        return switch (knowledge.getKnowledgeType()) {
            case "history" -> "校史资料";
            case "spot" -> "校园点位介绍";
            case "activity" -> "活动公告";
            case "faq" -> "常见问题";
            case "guide" -> "参访指南";
            case "alumni" -> "校友故事";
            case "research" -> "科研成果";
            default -> knowledge.getKnowledgeType();
        };
    }

    private int normalizeLimit(Integer limit) {
        if (limit == null || limit <= 0) {
            return 3;
        }
        return Math.min(limit, 3);
    }

    private boolean matchesMode(String suitableMode, String userMode) {
        if (userMode == null || userMode.isBlank() || "guest".equals(userMode)) return true;
        if (suitableMode == null || suitableMode.isBlank()) return true;
        return normalize(suitableMode).contains(normalize(userMode));
    }

    private int score(TKnowledge knowledge, String normalizedQuery, List<String> tokens) {
        String title = normalize(knowledge.getTitle());
        String content = normalize(knowledge.getContent());
        String type = normalize(knowledge.getKnowledgeType());
        int score = 0;

        if (!normalizedQuery.isBlank()) {
            if (!title.isBlank() && (title.contains(normalizedQuery) || normalizedQuery.contains(title))) {
                score += 100;
            }
            if (!content.isBlank() && content.contains(normalizedQuery)) {
                score += 15;
            }
            if (!type.isBlank() && (type.contains(normalizedQuery) || normalizedQuery.contains(type))) {
                score += 22;
            }
        }

        for (String token : tokens) {
            String normalizedToken = normalize(token);
            if (normalizedToken.length() < 2) continue;
            if (!title.isBlank() && title.contains(normalizedToken)) score += 35;
            if (!type.isBlank() && (type.equals(normalizedToken) || type.contains(normalizedToken))) score += 24;
            if (!content.isBlank() && content.contains(normalizedToken)) score += 10;
        }

        return score;
    }

    private List<String> extractTokens(String text) {
        if (text == null || text.isBlank()) return List.of();
        Set<String> tokens = new LinkedHashSet<>();
        String stripped = stripStopWords(text);
        for (String part : stripped.split("[\\s,，。！？?!.;；:：、()（）【】\\[\\]\"'“”‘’]+")) {
            String normalized = normalize(part);
            if (normalized.length() >= 2) tokens.add(normalized);
        }
        String normalizedText = normalize(stripped);
        for (Map.Entry<String, List<String>> entry : SYNONYMS.entrySet()) {
            boolean hit = entry.getValue().stream().anyMatch(alias -> normalizedText.contains(normalize(alias)));
            if (hit) {
                tokens.add(normalize(entry.getKey()));
                entry.getValue().stream().map(this::normalize).filter(item -> item.length() >= 2).forEach(tokens::add);
            }
        }
        return new ArrayList<>(tokens);
    }

    private String stripStopWords(String text) {
        if (text == null) return "";
        String result = text;
        for (String word : STOP_WORDS) {
            result = result.replace(word, "");
        }
        return result;
    }

    private String normalize(String text) {
        return text == null ? "" : text.toLowerCase(Locale.ROOT).replaceAll("\\s+", "").trim();
    }

    private record KnowledgeScore(TKnowledge knowledge, int score) {
    }
}
