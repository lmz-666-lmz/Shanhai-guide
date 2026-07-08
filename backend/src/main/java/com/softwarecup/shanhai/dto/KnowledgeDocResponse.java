package com.softwarecup.shanhai.dto;

import java.time.LocalDateTime;

public record KnowledgeDocResponse(
        Long id,
        String title,
        String category,
        String sourceName,
        String content,
        Boolean enabled,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        Long chunkCount
) {
}
