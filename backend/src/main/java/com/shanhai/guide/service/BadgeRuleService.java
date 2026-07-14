package com.shanhai.guide.service;

import com.shanhai.guide.entity.TBadge;
import com.shanhai.guide.entity.dto.BadgeProgressView;

import java.util.List;

public interface BadgeRuleService {

    String TRIGGER_CHECKIN = "CHECKIN";
    String TRIGGER_ROUTE_COMPLETE = "ROUTE_COMPLETE";
    String TRIGGER_ACTIVITY_RESERVE = "ACTIVITY_RESERVE";
    String TRIGGER_FAVORITE_SPOT = "FAVORITE_SPOT";
    String TRIGGER_FAVORITE_ROUTE = "FAVORITE_ROUTE";
    String TRIGGER_RECALCULATE = "RECALCULATE";

    List<TBadge> checkAndUnlock(String sessionId, String triggerEvent);

    List<BadgeProgressView> getProgress(String sessionId);
}
