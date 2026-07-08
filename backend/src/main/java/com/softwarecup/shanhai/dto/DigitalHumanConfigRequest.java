package com.softwarecup.shanhai.dto;

import jakarta.validation.constraints.NotBlank;

public record DigitalHumanConfigRequest(
        @NotBlank(message = "数字人名称不能为空")
        String name,

        @NotBlank(message = "头像文字不能为空")
        String avatarText,

        @NotBlank(message = "角色标题不能为空")
        String roleTitle,

        @NotBlank(message = "欢迎语不能为空")
        String welcomeText,

        String voiceName,

        String stylePreset,

        Boolean enabled
) {
}
