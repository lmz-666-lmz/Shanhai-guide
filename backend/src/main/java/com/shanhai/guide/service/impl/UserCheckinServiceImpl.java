package com.shanhai.guide.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.shanhai.guide.entity.TUserCheckin;
import com.shanhai.guide.entity.TBadge;
import com.shanhai.guide.mapper.UserCheckinMapper;
import com.shanhai.guide.mapper.CampusRouteMapper;
import com.shanhai.guide.service.UserCheckinService;
import com.shanhai.guide.service.BadgeRuleService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class UserCheckinServiceImpl extends ServiceImpl<UserCheckinMapper, TUserCheckin> implements UserCheckinService {

    private final BadgeRuleService badgeRuleService;
    private final CampusRouteMapper campusRouteMapper;

    public UserCheckinServiceImpl(BadgeRuleService badgeRuleService, CampusRouteMapper campusRouteMapper) {
        this.badgeRuleService = badgeRuleService;
        this.campusRouteMapper = campusRouteMapper;
    }

    @Override
    @Transactional
    public List<TBadge> checkin(String sessionId, Long spotId, Long routeId, Integer checkinType, String checkinDesc) {
        String trigger = Integer.valueOf(2).equals(checkinType)
                ? BadgeRuleService.TRIGGER_ROUTE_COMPLETE
                : BadgeRuleService.TRIGGER_CHECKIN;
        if (checkinDesc != null && checkinDesc.contains("tripId=")) {
            LambdaQueryWrapper<TUserCheckin> wrapper = new LambdaQueryWrapper<TUserCheckin>()
                    .eq(TUserCheckin::getSessionId, sessionId)
                    .eq(TUserCheckin::getCheckinType, checkinType)
                    .eq(TUserCheckin::getCheckinDesc, checkinDesc);
            if (spotId == null) {
                wrapper.isNull(TUserCheckin::getSpotId);
            } else {
                wrapper.eq(TUserCheckin::getSpotId, spotId);
            }
            if (routeId == null) {
                wrapper.isNull(TUserCheckin::getRouteId);
            } else {
                wrapper.eq(TUserCheckin::getRouteId, routeId);
            }
            if (count(wrapper) > 0) {
                return badgeRuleService.checkAndUnlock(sessionId, trigger);
            }
        }
        TUserCheckin checkin = new TUserCheckin();
        checkin.setSessionId(sessionId);
        checkin.setSpotId(spotId);
        checkin.setRouteId(routeId);
        checkin.setCheckinType(checkinType);
        checkin.setCheckinDesc(checkinDesc);
        save(checkin);
        return badgeRuleService.checkAndUnlock(sessionId, trigger);
    }

    @Override
    @Transactional
    public List<TBadge> completeRoute(String sessionId, Long routeId, String routeName) {
        campusRouteMapper.selectByIdForUpdate(routeId);
        long existing = count(new LambdaQueryWrapper<TUserCheckin>()
                .eq(TUserCheckin::getSessionId, sessionId)
                .eq(TUserCheckin::getRouteId, routeId)
                .eq(TUserCheckin::getCheckinType, 2));
        if (existing == 0) {
            TUserCheckin record = new TUserCheckin();
            record.setSessionId(sessionId);
            record.setRouteId(routeId);
            record.setCheckinType(2);
            record.setCheckinDesc("完成路线：" + routeName);
            save(record);
        }
        return badgeRuleService.checkAndUnlock(sessionId, BadgeRuleService.TRIGGER_ROUTE_COMPLETE);
    }

    @Override
    public List<TUserCheckin> getCheckinHistory(String sessionId) {
        LambdaQueryWrapper<TUserCheckin> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TUserCheckin::getSessionId, sessionId)
               .orderByDesc(TUserCheckin::getCreateTime);
        return list(wrapper);
    }

    @Override
    public int getCheckinCount(String sessionId) {
        LambdaQueryWrapper<TUserCheckin> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TUserCheckin::getSessionId, sessionId);
        return (int) count(wrapper);
    }
}
