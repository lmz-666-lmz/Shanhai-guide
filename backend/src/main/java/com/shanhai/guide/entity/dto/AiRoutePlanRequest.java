package com.shanhai.guide.entity.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class AiRoutePlanRequest {

    private String sessionId;

    private String message;

    private String userMode;

    private Integer durationMinute;

    private List<String> interests = new ArrayList<>();

    private Long startSpotId;

    /** 用户文本中确认的点位顺序（含显式起点/途经点/终点） */
    private List<Long> orderedSpotIds = new ArrayList<>();

    /** 地图当前位置经度（real/demo/manual 模式） */
    private Double startLng;

    /** 地图当前位置纬度（real/demo/manual 模式） */
    private Double startLat;

    /** 位置标签，如 "当前位置" / "演示位置" / "手动起点" */
    private String locationLabel;

    /** real / demo / manual / spot，用于路线卡进入地图后保持同一类起点 */
    private String startMode;
}
