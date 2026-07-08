package com.softwarecup.shanhai.service;

import com.softwarecup.shanhai.dto.KnowledgeSourceResponse;
import com.softwarecup.shanhai.entity.CampusSpot;
import com.softwarecup.shanhai.entity.ActivityNotice;
import com.softwarecup.shanhai.entity.KnowledgeChunk;
import com.softwarecup.shanhai.repository.ActivityNoticeRepository;
import com.softwarecup.shanhai.repository.CampusSpotRepository;
import com.softwarecup.shanhai.repository.KnowledgeChunkRepository;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

@Service
public class KnowledgeBaseService {

    private static final int MAX_RAG_CHUNKS = 5;
    private static final Pattern KEYWORD_SPLITTER = Pattern.compile("[\\s,，。！？?、；;：:（）()【】\\[\\]\"']+");

    private final KnowledgeChunkRepository knowledgeChunkRepository;
    private final CampusSpotRepository campusSpotRepository;
    private final ActivityNoticeRepository activityNoticeRepository;

    public KnowledgeBaseService(
            KnowledgeChunkRepository knowledgeChunkRepository,
            CampusSpotRepository campusSpotRepository,
            ActivityNoticeRepository activityNoticeRepository
    ) {
        this.knowledgeChunkRepository = knowledgeChunkRepository;
        this.campusSpotRepository = campusSpotRepository;
        this.activityNoticeRepository = activityNoticeRepository;
    }

    public List<KnowledgeChunk> searchRelevantChunks(String message, Long currentSpotId) {
        List<KnowledgeChunk> chunks = knowledgeChunkRepository.findByEnabledTrueOrderByIdAsc();
        if (chunks.isEmpty()) {
            return List.of();
        }

        List<String> terms = buildSearchTerms(message, currentSpotId);
        if (terms.isEmpty()) {
            return defaultChunks(chunks);
        }

        List<ScoredChunk> scoredChunks = chunks.stream()
                .map(chunk -> new ScoredChunk(chunk, score(chunk, terms)))
                .filter(item -> item.score() > 0)
                .sorted(Comparator
                        .comparingInt(ScoredChunk::score).reversed()
                        .thenComparing(item -> item.chunk().getId()))
                .toList();

        if (scoredChunks.isEmpty()) {
            return defaultChunks(chunks);
        }

        return scoredChunks.stream()
                .map(ScoredChunk::chunk)
                .limit(MAX_RAG_CHUNKS)
                .toList();
    }

    public String buildKnowledgeContext(List<KnowledgeChunk> chunks) {
        if (chunks == null || chunks.isEmpty()) {
            return "";
        }

        StringBuilder builder = new StringBuilder();
        for (int index = 0; index < chunks.size(); index++) {
            KnowledgeChunk chunk = chunks.get(index);
            builder.append("【资料").append(index + 1).append("】")
                    .append(nullToEmpty(chunk.getTitle())).append('\n')
                    .append("来源：").append(nullToEmpty(chunk.getSourceName())).append('\n')
                    .append("内容：").append(nullToEmpty(chunk.getContent()));

            if (index < chunks.size() - 1) {
                builder.append("\n\n");
            }
        }

        String noticeContext = buildNoticeContext();
        if (StringUtils.hasText(noticeContext)) {
            builder.append("\n\n").append(noticeContext);
        }

        return builder.toString();
    }

    public List<String> extractSourceNames(List<KnowledgeChunk> chunks) {
        if (chunks == null || chunks.isEmpty()) {
            return List.of();
        }

        Set<String> sources = new LinkedHashSet<>();
        for (KnowledgeChunk chunk : chunks) {
            if (StringUtils.hasText(chunk.getSourceName())) {
                sources.add(chunk.getSourceName());
            } else if (StringUtils.hasText(chunk.getTitle())) {
                sources.add(chunk.getTitle());
            }
        }

        return List.copyOf(sources);
    }

    public List<KnowledgeSourceResponse> listEnabledChunks() {
        return knowledgeChunkRepository.findByEnabledTrueOrderByIdAsc()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public List<KnowledgeSourceResponse> searchByKeyword(String keyword) {
        if (!StringUtils.hasText(keyword)) {
            return listEnabledChunks();
        }

        String normalizedKeyword = keyword.trim();
        List<KnowledgeChunk> chunks = new ArrayList<>();
        chunks.addAll(knowledgeChunkRepository.findTop8ByEnabledTrueAndKeywordsContainingIgnoreCaseOrderByIdAsc(normalizedKeyword));
        chunks.addAll(knowledgeChunkRepository.findTop8ByEnabledTrueAndContentContainingIgnoreCaseOrderByIdAsc(normalizedKeyword));
        chunks.addAll(knowledgeChunkRepository.findByEnabledTrueOrderByIdAsc()
                .stream()
                .filter(chunk -> containsAnyField(chunk, normalizedKeyword))
                .toList());

        return chunks.stream()
                .filter(this::isEnabled)
                .filter(chunk -> containsAnyField(chunk, normalizedKeyword))
                .collect(
                        java.util.stream.Collectors.toMap(
                                KnowledgeChunk::getId,
                                chunk -> chunk,
                                (first, second) -> first,
                                java.util.LinkedHashMap::new
                        )
                )
                .values()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private List<String> buildSearchTerms(String message, Long currentSpotId) {
        Set<String> terms = new LinkedHashSet<>();
        if (currentSpotId != null) {
            campusSpotRepository.findById(currentSpotId)
                    .filter(spot -> Boolean.TRUE.equals(spot.getEnabled()))
                    .map(CampusSpot::getName)
                    .filter(StringUtils::hasText)
                    .ifPresent(terms::add);
        }

        String text = StringUtils.hasText(message) ? message.trim() : "";
        if (text.contains("校史馆")) {
            terms.add("校史馆");
        }
        if (text.contains("图书馆")) {
            terms.add("星海图书馆");
            terms.add("图书馆");
        }
        if (text.contains("食堂")) {
            terms.add("第一食堂");
            terms.add("食堂");
        }
        if (text.contains("校友")) {
            terms.add("校友之家");
            terms.add("校友记忆路线");
            terms.add("校友活动");
            terms.add("校友");
        }
        if (text.contains("路线") || text.contains("90分钟") || text.contains("参观")) {
            terms.add("路线资料");
            terms.add("路线");
            terms.add("90分钟");
            terms.add("参观");
            terms.add("校友记忆路线");
            terms.add("新生初识路线");
        }

        for (String token : KEYWORD_SPLITTER.split(text)) {
            if (StringUtils.hasText(token) && token.length() >= 2 && token.length() <= 20) {
                terms.add(token.trim());
            }
        }

        return List.copyOf(terms);
    }

    private int score(KnowledgeChunk chunk, List<String> terms) {
        int score = 0;
        for (String term : terms) {
            String normalizedTerm = normalize(term);
            if (!StringUtils.hasText(normalizedTerm)) {
                continue;
            }

            if (contains(chunk.getTitle(), normalizedTerm)) {
                score += 8;
            }
            if (contains(chunk.getKeywords(), normalizedTerm)) {
                score += 7;
            }
            if (contains(chunk.getSourceName(), normalizedTerm)) {
                score += 5;
            }
            if (contains(chunk.getCategory(), normalizedTerm)) {
                score += 4;
            }
            if (contains(chunk.getContent(), normalizedTerm)) {
                score += 3;
            }
        }

        return score;
    }

    private boolean containsAnyField(KnowledgeChunk chunk, String keyword) {
        String normalizedKeyword = normalize(keyword);
        return contains(chunk.getTitle(), normalizedKeyword)
                || contains(chunk.getCategory(), normalizedKeyword)
                || contains(chunk.getSourceName(), normalizedKeyword)
                || contains(chunk.getKeywords(), normalizedKeyword)
                || contains(chunk.getContent(), normalizedKeyword);
    }

    private boolean contains(String value, String normalizedKeyword) {
        return StringUtils.hasText(value)
                && StringUtils.hasText(normalizedKeyword)
                && normalize(value).contains(normalizedKeyword);
    }

    private String normalize(String value) {
        return StringUtils.hasText(value) ? value.trim().toLowerCase(Locale.ROOT) : "";
    }

    private List<KnowledgeChunk> defaultChunks(List<KnowledgeChunk> chunks) {
        return chunks.stream()
                .filter(this::isEnabled)
                .limit(3)
                .toList();
    }

    private boolean isEnabled(KnowledgeChunk chunk) {
        return chunk != null && Boolean.TRUE.equals(chunk.getEnabled());
    }

    private KnowledgeSourceResponse toResponse(KnowledgeChunk chunk) {
        return new KnowledgeSourceResponse(
                chunk.getTitle(),
                chunk.getCategory(),
                chunk.getSourceName(),
                preview(chunk.getContent())
        );
    }

    private String preview(String content) {
        if (!StringUtils.hasText(content)) {
            return "";
        }
        String trimmed = content.trim();
        if (trimmed.length() <= 120) {
            return trimmed;
        }
        return trimmed.substring(0, 120) + "...";
    }

    private String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    private String buildNoticeContext() {
        List<ActivityNotice> notices = activityNoticeRepository.findByEnabledTrueOrderByPriorityDescStartTimeAsc()
                .stream()
                .limit(3)
                .toList();
        if (notices.isEmpty()) {
            return "";
        }
        StringBuilder builder = new StringBuilder("【近期公告】");
        for (ActivityNotice notice : notices) {
            builder.append('\n')
                    .append(notice.getTitle())
                    .append("：")
                    .append(nullToEmpty(notice.getContent()))
                    .append(" 时间：")
                    .append(notice.getStartTime())
                    .append(" 地点：")
                    .append(nullToEmpty(notice.getLocation()));
        }
        return builder.toString();
    }

    private record ScoredChunk(KnowledgeChunk chunk, int score) {
    }
}
