package com.softwarecup.shanhai.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CampusSpotRequest(
        @NotBlank(message = "点位名称不能为空")
        @Size(max = 100, message = "点位名称不能超过100个字符")
        String name,

        @NotBlank(message = "点位类型不能为空")
        @Size(max = 50, message = "点位类型不能超过50个字符")
        String type,

        @NotBlank(message = "点位简介不能为空")
        String description,

        @NotBlank(message = "讲解词不能为空")
        String story,

        @NotNull(message = "纬度不能为空")
        Double latitude,

        @NotNull(message = "经度不能为空")
        Double longitude,

        @NotBlank(message = "开放时间不能为空")
        String openTime,

        @NotNull(message = "推荐游览时长不能为空")
        Integer recommendedDuration,

        String tags,

        String imageUrl,

        Boolean enabled
) {
}
