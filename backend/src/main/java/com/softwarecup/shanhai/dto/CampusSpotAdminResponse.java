package com.softwarecup.shanhai.dto;

import java.time.LocalDateTime;

public record CampusSpotAdminResponse(
        Long id,
        String name,
        String type,
        String description,
        String story,
        Double latitude,
        Double longitude,
        String openTime,
        Integer recommendedDuration,
        String tags,
        String imageUrl,
        Boolean enabled,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
