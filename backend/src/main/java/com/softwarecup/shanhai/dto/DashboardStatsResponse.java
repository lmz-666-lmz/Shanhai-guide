package com.softwarecup.shanhai.dto;

import java.time.LocalDateTime;

public record DashboardStatsResponse(
        long todayChatCount,
        long totalChatCount,
        long totalSpotCount,
        long totalRouteCount,
        long totalKnowledgeDocCount,
        double avgSuccessRate,
        LocalDateTime latestChatTime
) {
}
