package com.shanhai.guide.entity.dto;

import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class ChatSource {

    private String sourceType;

    private Long sourceId;

    private String title;

    private String knowledgeType;

    private String sourceName;

    private String snippet;

    public ChatSource(String sourceType, Long sourceId, String title, String sourceName, String snippet) {
        this(sourceType, sourceId, title, null, sourceName, snippet);
    }

    public ChatSource(String sourceType, Long sourceId, String title, String knowledgeType, String sourceName, String snippet) {
        this.sourceType = sourceType;
        this.sourceId = sourceId;
        this.title = title;
        this.knowledgeType = knowledgeType;
        this.sourceName = sourceName;
        this.snippet = snippet;
    }
}
