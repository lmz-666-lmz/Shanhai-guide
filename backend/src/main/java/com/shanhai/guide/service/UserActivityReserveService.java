package com.shanhai.guide.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.shanhai.guide.entity.TUserActivityReserve;
import com.shanhai.guide.entity.TBadge;

import java.util.List;

public interface UserActivityReserveService extends IService<TUserActivityReserve> {

    List<TBadge> reserveActivity(String sessionId, Long activityId);

    void cancelReserve(String sessionId, Long activityId);

    boolean isReserved(String sessionId, Long activityId);

    List<TUserActivityReserve> getUserReserves(String sessionId);

    TUserActivityReserve updateReserveStatus(Long reserveId, Integer reserveStatus);
}
