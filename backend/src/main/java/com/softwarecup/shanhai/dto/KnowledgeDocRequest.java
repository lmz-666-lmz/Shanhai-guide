package com.softwarecup.shanhai.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record KnowledgeDocRequest(
        @NotBlank(message = "资料标题不能为空")
        @Size(max = 200, message = "资料标题不能超过200个字符")
        String title,

        @NotBlank(message = "资料分类不能为空")
        @Size(max = 100, message = "资料分类不能超过100个字符")
        String category,

        @NotBlank(message = "来源名称不能为空")
        @Size(max = 200, message = "来源名称不能超过200个字符")
        String sourceName,

        @NotBlank(message = "资料内容不能为空")
        String content,

        Boolean enabled
) {
}
