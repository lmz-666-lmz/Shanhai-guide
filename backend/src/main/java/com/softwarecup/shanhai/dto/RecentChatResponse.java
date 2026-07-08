package com.softwarecup.shanhai.dto;

import java.time.LocalDateTime;

public record RecentChatResponse(
        Long id,
        String userMessage,
        String aiAnswer,
        String userMode,
        String emotion,
        Boolean success,
        LocalDateTime createdAt
) {
}
