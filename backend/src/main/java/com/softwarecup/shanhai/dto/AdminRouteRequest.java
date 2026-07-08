package com.softwarecup.shanhai.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record AdminRouteRequest(
        @NotBlank(message = "路线名称不能为空")
        String name,

        @NotBlank(message = "路线类型不能为空")
        String routeType,

        @NotBlank(message = "路线简介不能为空")
        String description,

        @NotBlank(message = "适合人群不能为空")
        String suitableFor,

        @NotNull(message = "预计时长不能为空")
        Integer estimatedDuration,

        @NotBlank(message = "距离说明不能为空")
        String distanceText,

        @NotBlank(message = "推荐理由不能为空")
        String reason,

        Boolean enabled,

        @Valid
        @NotEmpty(message = "路线点位不能为空")
        List<RouteSpotAdminRequest> spots
) {
}
