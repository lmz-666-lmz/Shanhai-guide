package com.softwarecup.shanhai.dto;

import java.time.LocalDateTime;
import java.util.List;

public record AdminRouteResponse(
        Long id,
        String name,
        String routeType,
        String description,
        String suitableFor,
        Integer estimatedDuration,
        String distanceText,
        String reason,
        Boolean enabled,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        List<RouteSpotAdminResponse> spots
) {
}
