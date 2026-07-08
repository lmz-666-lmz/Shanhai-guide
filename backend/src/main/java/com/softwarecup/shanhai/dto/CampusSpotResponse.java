package com.softwarecup.shanhai.dto;

public record CampusSpotResponse(
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
        Boolean enabled
) {
}
