package com.shanhai.guide.entity.dto;

import lombok.Data;
import java.util.List;

@Data
public class NarrationRequest {
    private Long spotId;
    private String mode;        // concise | detailed | freshman | alumni | parent
    private Integer durationSeconds;
}
