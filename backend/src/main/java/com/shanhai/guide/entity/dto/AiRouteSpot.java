package com.shanhai.guide.entity.dto;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class AiRouteSpot {

    private Long spotId;

    private String spotName;

    private String spotType;

    private BigDecimal longitude;

    private BigDecimal latitude;

    private Integer stayMinute;

    private Integer walkMinuteFromPrev;

    private String reason;

    private String spotDesc;

    private String spotImage;
}
