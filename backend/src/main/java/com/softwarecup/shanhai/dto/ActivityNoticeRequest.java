package com.softwarecup.shanhai.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDateTime;

public record ActivityNoticeRequest(
        @NotBlank(message = "公告标题不能为空")
        String title,

        @NotBlank(message = "公告类型不能为空")
        String noticeType,

        @NotBlank(message = "公告内容不能为空")
        String content,

        String location,

        @NotNull(message = "开始时间不能为空")
        LocalDateTime startTime,

        @NotNull(message = "结束时间不能为空")
        LocalDateTime endTime,

        Integer priority,

        Boolean enabled
) {
}
