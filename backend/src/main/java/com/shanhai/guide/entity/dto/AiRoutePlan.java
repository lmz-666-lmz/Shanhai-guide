package com.shanhai.guide.entity.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Data
public class AiRoutePlan {

    private String routeName;

    private String routeDesc;

    private Integer totalMinute;

    private String reason;

    private List<AiRouteSpot> spots = new ArrayList<>();

    private Long startSpotId;

    /** 起点标签，如 "当前位置" / "演示位置" / "手动起点" / "山海大学南门" */
    private String startLabel;

    /** 起点经度。显式点位起点使用点位坐标；real/demo/manual 使用传入原始坐标。 */
    private BigDecimal startLng;

    /** 起点纬度。显式点位起点使用点位坐标；real/demo/manual 使用传入原始坐标。 */
    private BigDecimal startLat;

    /** 起点来源：spot / real / demo / manual。 */
    private String startMode;

    private List<List<BigDecimal>> mapPolyline = new ArrayList<>();
}
