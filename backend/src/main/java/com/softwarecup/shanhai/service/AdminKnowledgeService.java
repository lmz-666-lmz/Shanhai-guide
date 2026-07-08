package com.softwarecup.shanhai.service;

import com.softwarecup.shanhai.dto.KnowledgeChunkResponse;
import com.softwarecup.shanhai.dto.KnowledgeDocRequest;
import com.softwarecup.shanhai.dto.KnowledgeDocResponse;
import com.softwarecup.shanhai.entity.KnowledgeChunk;
import com.softwarecup.shanhai.entity.KnowledgeDoc;
import com.softwarecup.shanhai.repository.KnowledgeChunkRepository;
import com.softwarecup.shanhai.repository.KnowledgeDocRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Set;
import java.util.regex.Pattern;

@Service
public class AdminKnowledgeService {

    private static final int CHUNK_SIZE = 800;
    private static final int MAX_CONTENT_KEYWORDS = 8;
    private static final Pattern KEYWORD_SPLITTER = Pattern.compile("[\\s,，。！？?、；;：:（）()【】\\[\\]\"'《》<>]+");

    private final KnowledgeDocRepository knowledgeDocRepository;
    private final KnowledgeChunkRepository knowledgeChunkRepository;

    public AdminKnowledgeService(
            KnowledgeDocRepository knowledgeDocRepository,
            KnowledgeChunkRepository knowledgeChunkRepository
    ) {
        this.knowledgeDocRepository = knowledgeDocRepository;
        this.knowledgeChunkRepository = knowledgeChunkRepository;
    }

    @Transactional(readOnly = true)
    public List<KnowledgeDocResponse> listDocs(Boolean enabled) {
        List<KnowledgeDoc> docs;
        if (enabled == null) {
            docs = knowledgeDocRepository.findAllByOrderByUpdatedAtDesc();
        } else if (Boolean.TRUE.equals(enabled)) {
            docs = knowledgeDocRepository.findByEnabledTrueOrderByUpdatedAtDesc();
        } else {
            docs = knowledgeDocRepository.findAllByOrderByUpdatedAtDesc()
                    .stream()
                    .filter(doc -> !Boolean.TRUE.equals(doc.getEnabled()))
                    .toList();
        }

        return docs.stream()
                .map(this::toDocResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public KnowledgeDocResponse getDoc(Long id) {
        KnowledgeDoc doc = findDoc(id);
        return toDocResponse(doc);
    }

    @Transactional
    public KnowledgeDocResponse createDoc(KnowledgeDocRequest request) {
        KnowledgeDoc doc = new KnowledgeDoc();
        fillDoc(doc, request);

        KnowledgeDoc savedDoc = knowledgeDocRepository.save(doc);
        knowledgeChunkRepository.saveAll(buildChunks(savedDoc));

        return toDocResponse(savedDoc);
    }

    @Transactional
    public KnowledgeDocResponse updateDoc(Long id, KnowledgeDocRequest request) {
        KnowledgeDoc doc = findDoc(id);
        fillDoc(doc, request);

        KnowledgeDoc savedDoc = knowledgeDocRepository.save(doc);
        knowledgeChunkRepository.deleteByDocId(savedDoc.getId());
        knowledgeChunkRepository.saveAll(buildChunks(savedDoc));

        return toDocResponse(savedDoc);
    }

    @Transactional
    public KnowledgeDocResponse setEnabled(Long id, Boolean enabled) {
        KnowledgeDoc doc = findDoc(id);
        boolean enabledValue = Boolean.TRUE.equals(enabled);
        doc.setEnabled(enabledValue);

        KnowledgeDoc savedDoc = knowledgeDocRepository.save(doc);
        List<KnowledgeChunk> chunks = knowledgeChunkRepository.findByDocIdOrderByIdAsc(savedDoc.getId());
        chunks.forEach(chunk -> chunk.setEnabled(enabledValue));
        knowledgeChunkRepository.saveAll(chunks);

        return toDocResponse(savedDoc);
    }

    @Transactional
    public void deleteDoc(Long id) {
        KnowledgeDoc doc = findDoc(id);
        knowledgeChunkRepository.deleteByDocId(doc.getId());
        knowledgeDocRepository.delete(doc);
    }

    @Transactional(readOnly = true)
    public List<KnowledgeChunkResponse> listChunksByDoc(Long docId) {
        findDoc(docId);
        return knowledgeChunkRepository.findByDocIdOrderByIdAsc(docId)
                .stream()
                .map(this::toChunkResponse)
                .toList();
    }

    private KnowledgeDoc findDoc(Long id) {
        return knowledgeDocRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("知识文档不存在，id=" + id));
    }

    private void fillDoc(KnowledgeDoc doc, KnowledgeDocRequest request) {
        doc.setTitle(trim(request.title()));
        doc.setCategory(trim(request.category()));
        doc.setSourceName(trim(request.sourceName()));
        doc.setContent(trim(request.content()));
        doc.setEnabled(request.enabled() == null || Boolean.TRUE.equals(request.enabled()));
    }

    private List<KnowledgeChunk> buildChunks(KnowledgeDoc doc) {
        String content = doc.getContent();
        if (!StringUtils.hasText(content)) {
            return List.of();
        }

        List<String> parts = splitContent(content);
        List<KnowledgeChunk> chunks = new ArrayList<>();
        String keywords = buildKeywords(doc);
        for (int index = 0; index < parts.size(); index++) {
            KnowledgeChunk chunk = new KnowledgeChunk();
            chunk.setDocId(doc.getId());
            chunk.setTitle(buildChunkTitle(doc.getTitle(), index, parts.size()));
            chunk.setCategory(doc.getCategory());
            chunk.setSourceName(doc.getSourceName());
            chunk.setContent(parts.get(index));
            chunk.setKeywords(keywords);
            chunk.setEnabled(Boolean.TRUE.equals(doc.getEnabled()));
            chunks.add(chunk);
        }

        return chunks;
    }

    private List<String> splitContent(String content) {
        String normalizedContent = content.trim();
        if (normalizedContent.length() <= CHUNK_SIZE) {
            return List.of(normalizedContent);
        }

        List<String> parts = new ArrayList<>();
        for (int start = 0; start < normalizedContent.length(); start += CHUNK_SIZE) {
            int end = Math.min(start + CHUNK_SIZE, normalizedContent.length());
            parts.add(normalizedContent.substring(start, end).trim());
        }

        return parts;
    }

    private String buildChunkTitle(String docTitle, int index, int total) {
        if (total == 1) {
            return docTitle;
        }

        return limit(docTitle + "-片段" + (index + 1), 200);
    }

    private String buildKeywords(KnowledgeDoc doc) {
        Set<String> keywords = new LinkedHashSet<>();
        addKeyword(keywords, doc.getTitle());
        addKeyword(keywords, doc.getCategory());
        addKeyword(keywords, doc.getSourceName());

        int contentKeywordCount = 0;
        for (String token : KEYWORD_SPLITTER.split(nullToEmpty(doc.getContent()))) {
            String keyword = trim(token);
            if (keyword.length() >= 2 && keyword.length() <= 20) {
                keywords.add(keyword);
                contentKeywordCount++;
                if (contentKeywordCount >= MAX_CONTENT_KEYWORDS) {
                    break;
                }
            }
        }

        return limit(String.join(",", keywords), 500);
    }

    private void addKeyword(Set<String> keywords, String value) {
        if (StringUtils.hasText(value)) {
            keywords.add(value.trim());
        }
    }

    private KnowledgeDocResponse toDocResponse(KnowledgeDoc doc) {
        return new KnowledgeDocResponse(
                doc.getId(),
                doc.getTitle(),
                doc.getCategory(),
                doc.getSourceName(),
                doc.getContent(),
                doc.getEnabled(),
                doc.getCreatedAt(),
                doc.getUpdatedAt(),
                knowledgeChunkRepository.countByDocId(doc.getId())
        );
    }

    private KnowledgeChunkResponse toChunkResponse(KnowledgeChunk chunk) {
        return new KnowledgeChunkResponse(
                chunk.getId(),
                chunk.getDocId(),
                chunk.getTitle(),
                chunk.getCategory(),
                chunk.getSourceName(),
                chunk.getContent(),
                chunk.getKeywords(),
                chunk.getEnabled(),
                chunk.getCreatedAt()
        );
    }

    private String trim(String value) {
        return value == null ? "" : value.trim();
    }

    private String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    private String limit(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) {
            return value;
        }

        return value.substring(0, maxLength);
    }
}
