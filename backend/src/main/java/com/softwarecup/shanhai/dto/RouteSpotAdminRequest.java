package com.softwarecup.shanhai.dto;

import jakarta.validation.constraints.NotNull;

public record RouteSpotAdminRequest(
        @NotNull(message = "点位ID不能为空")
        Long spotId,

        @NotNull(message = "点位顺序不能为空")
        Integer sortOrder,

        @NotNull(message = "停留时间不能为空")
        Integer stayMinutes,

        String note
) {
}
