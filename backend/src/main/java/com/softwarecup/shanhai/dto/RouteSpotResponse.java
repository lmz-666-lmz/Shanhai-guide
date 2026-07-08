package com.softwarecup.shanhai.dto;

public record RouteSpotResponse(
        Long spotId,
        String name,
        String type,
        String description,
        Double latitude,
        Double longitude,
        Integer sortOrder,
        Integer stayMinutes,
        String note
) {
}
