package com.shanhai.guide.entity.dto;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class SpotRecommendation {

    private Long spotId;

    private String spotName;

    private String spotType;

    private BigDecimal longitude;

    private BigDecimal latitude;

    private Integer recommendTime;

    private String spotDesc;

    private String spotImage;

    private String openTime;

    private String reason;
}
