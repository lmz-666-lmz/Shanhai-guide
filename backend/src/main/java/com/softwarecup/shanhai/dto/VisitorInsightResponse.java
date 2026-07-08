package com.softwarecup.shanhai.dto;

import java.util.List;

public record VisitorInsightResponse(
        List<HotQuestionResponse> hotQuestions,
        List<HotQuestionResponse> negativeQuestions,
        List<HotQuestionResponse> failedQuestions,
        List<VisitorModeStatsResponse> modeStats,
        List<SentimentStatsResponse> sentimentStats,
        List<String> suggestions
) {
}
