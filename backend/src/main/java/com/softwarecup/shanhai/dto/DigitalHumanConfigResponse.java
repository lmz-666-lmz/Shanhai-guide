package com.softwarecup.shanhai.dto;

import java.time.LocalDateTime;

public record DigitalHumanConfigResponse(
        Long id,
        String name,
        String avatarText,
        String roleTitle,
        String welcomeText,
        String voiceName,
        String stylePreset,
        Boolean enabled,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
