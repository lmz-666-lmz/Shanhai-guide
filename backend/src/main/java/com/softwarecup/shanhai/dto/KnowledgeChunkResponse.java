package com.softwarecup.shanhai.dto;

import java.time.LocalDateTime;

public record KnowledgeChunkResponse(
        Long id,
        Long docId,
        String title,
        String category,
        String sourceName,
        String content,
        String keywords,
        Boolean enabled,
        LocalDateTime createdAt
) {
}
