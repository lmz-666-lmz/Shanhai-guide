package com.shanhai.guide.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.shanhai.guide.entity.TUserCheckin;
import com.shanhai.guide.entity.TBadge;

import java.util.List;

public interface UserCheckinService extends IService<TUserCheckin> {

    List<TBadge> checkin(String sessionId, Long spotId, Long routeId, Integer checkinType, String checkinDesc);

    List<TBadge> completeRoute(String sessionId, Long routeId, String routeName);

    List<TUserCheckin> getCheckinHistory(String sessionId);

    int getCheckinCount(String sessionId);
}
