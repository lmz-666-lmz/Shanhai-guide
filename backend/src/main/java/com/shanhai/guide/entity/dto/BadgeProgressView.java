package com.shanhai.guide.entity.dto;

import com.shanhai.guide.entity.TBadge;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class BadgeProgressView {

    private TBadge badge;

    private Integer currentValue;

    private Integer targetValue;

    private Boolean unlocked;

    private LocalDateTime unlockTime;

    private String conditionText;
}
