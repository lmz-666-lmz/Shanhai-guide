package com.softwarecup.shanhai.dto;

public record RouteRecommendRequest(
        String message,
        String userMode,
        Integer durationMinutes,
        String interests
) {
}
