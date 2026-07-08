package com.softwarecup.shanhai.dto;

import java.util.List;

public record ChatResponse(
        String answer,
        List<String> sources,
        String emotion,
        List<String> suggestedActions
) {
}