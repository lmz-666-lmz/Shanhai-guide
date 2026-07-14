package com.shanhai.guide.entity.dto;

import lombok.Data;
import java.util.List;

@Data
public class NarrationResponse {
    private String content;
    private String mode;
    private String generatedBy;          // "deepseek" | "fallback"
    private boolean fallbackUsed;
    private String fallbackReason;       // safe display-only reason, no stack traces
    private String materialLevel;        // "rich" | "basic" | "minimal"
    private boolean knowledgeUsed;
    private List<Long> usedKnowledgeIds;
    private List<ChatSource> sources;
}
