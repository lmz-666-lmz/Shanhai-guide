package com.softwarecup.shanhai.dto;

import java.time.LocalDateTime;

public record ActivityNoticeResponse(
        Long id,
        String title,
        String noticeType,
        String content,
        String location,
        LocalDateTime startTime,
        LocalDateTime endTime,
        Integer priority,
        Boolean enabled,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
