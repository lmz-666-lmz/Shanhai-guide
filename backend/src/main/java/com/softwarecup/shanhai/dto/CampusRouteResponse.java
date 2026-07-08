package com.softwarecup.shanhai.dto;

import java.util.List;

public record CampusRouteResponse(
        Long id,
        String name,
        String routeType,
        String description,
        String suitableFor,
        Integer estimatedDuration,
        String distanceText,
        String reason,
        List<RouteSpotResponse> spots
) {
}
