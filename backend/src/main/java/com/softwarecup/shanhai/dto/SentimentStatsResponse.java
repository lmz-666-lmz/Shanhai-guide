package com.softwarecup.shanhai.dto;

public record SentimentStatsResponse(
        String emotion,
        long count
) {
}
