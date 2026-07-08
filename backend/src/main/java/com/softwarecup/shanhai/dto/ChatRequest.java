package com.softwarecup.shanhai.dto;

import jakarta.validation.constraints.NotBlank;

public record ChatRequest(
        @NotBlank(message = "消息不能为空")
        String message,

        String userMode,

        Long currentSpotId
) {
}