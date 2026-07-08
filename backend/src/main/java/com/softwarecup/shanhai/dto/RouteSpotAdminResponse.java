package com.softwarecup.shanhai.dto;

public record RouteSpotAdminResponse(
        Long spotId,
        String spotName,
        String spotType,
        Integer sortOrder,
        Integer stayMinutes,
        String note
) {
}
