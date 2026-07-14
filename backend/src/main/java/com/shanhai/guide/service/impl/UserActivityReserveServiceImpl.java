package com.shanhai.guide.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.shanhai.guide.common.Constant;
import com.shanhai.guide.entity.TCampusActivity;
import com.shanhai.guide.entity.TBadge;
import com.shanhai.guide.entity.TUserActivityReserve;
import com.shanhai.guide.exception.BusinessException;
import com.shanhai.guide.mapper.UserActivityReserveMapper;
import com.shanhai.guide.mapper.CampusActivityMapper;
import com.shanhai.guide.service.BadgeRuleService;
import com.shanhai.guide.service.UserActivityReserveService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class UserActivityReserveServiceImpl extends ServiceImpl<UserActivityReserveMapper, TUserActivityReserve> implements UserActivityReserveService {

    private final CampusActivityMapper campusActivityMapper;
    private final BadgeRuleService badgeRuleService;

    public UserActivityReserveServiceImpl(CampusActivityMapper campusActivityMapper, BadgeRuleService badgeRuleService) {
        this.campusActivityMapper = campusActivityMapper;
        this.badgeRuleService = badgeRuleService;
    }

    @Override
    @Transactional
    public List<TBadge> reserveActivity(String sessionId, Long activityId) {
        TCampusActivity activity = campusActivityMapper.selectByIdForUpdate(activityId);
        if (activity == null || !Integer.valueOf(1).equals(activity.getIsEnable())) {
            throw new BusinessException(404, "活动不存在或已下架");
        }
        if (!Integer.valueOf(1).equals(activity.getIsReserve())) {
            throw new BusinessException(400, "该活动暂未开放报名");
        }
        if (isReserved(sessionId, activityId)) {
            throw new BusinessException(400, "已预约此活动");
        }
        if (activity.getReserveLimit() != null && activity.getReserveLimit() > 0
                && (activity.getReservedCount() == null ? 0 : activity.getReservedCount()) >= activity.getReserveLimit()) {
            throw new BusinessException(400, "活动名额已满");
        }
        if (campusActivityMapper.incrementReservedCountIfAvailable(activityId) != 1) {
            throw new BusinessException(400, "活动名额已满");
        }

        TUserActivityReserve reserve = new TUserActivityReserve();
        reserve.setSessionId(sessionId);
        reserve.setActivityId(activityId);
        reserve.setReserveStatus(Constant.RESERVE_STATUS_ACTIVE);
        reserve.setReserveTime(LocalDateTime.now());
        save(reserve);
        return badgeRuleService.checkAndUnlock(sessionId, BadgeRuleService.TRIGGER_ACTIVITY_RESERVE);
    }

    @Override
    @Transactional
    public void cancelReserve(String sessionId, Long activityId) {
        campusActivityMapper.selectByIdForUpdate(activityId);
        LambdaQueryWrapper<TUserActivityReserve> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TUserActivityReserve::getSessionId, sessionId)
               .eq(TUserActivityReserve::getActivityId, activityId)
               .eq(TUserActivityReserve::getReserveStatus, Constant.RESERVE_STATUS_ACTIVE);
        
        TUserActivityReserve reserve = getOne(wrapper);
        if (reserve != null) {
            reserve.setReserveStatus(Constant.RESERVE_STATUS_CANCELLED);
            reserve.setCancelTime(LocalDateTime.now());
            updateById(reserve);
            campusActivityMapper.decrementReservedCountSafely(activityId);
        }
    }

    @Override
    public boolean isReserved(String sessionId, Long activityId) {
        LambdaQueryWrapper<TUserActivityReserve> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TUserActivityReserve::getSessionId, sessionId)
               .eq(TUserActivityReserve::getActivityId, activityId)
               .eq(TUserActivityReserve::getReserveStatus, Constant.RESERVE_STATUS_ACTIVE);
        return count(wrapper) > 0;
    }

    @Override
    public List<TUserActivityReserve> getUserReserves(String sessionId) {
        LambdaQueryWrapper<TUserActivityReserve> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TUserActivityReserve::getSessionId, sessionId)
               .orderByDesc(TUserActivityReserve::getCreateTime);
        return list(wrapper);
    }

    @Override
    @Transactional
    public TUserActivityReserve updateReserveStatus(Long reserveId, Integer reserveStatus) {
        TUserActivityReserve reserve = getById(reserveId);
        if (reserve == null) throw new BusinessException(404, "预约记录不存在");
        int nextStatus = Integer.valueOf(Constant.RESERVE_STATUS_ACTIVE).equals(reserveStatus)
                ? Constant.RESERVE_STATUS_ACTIVE : Constant.RESERVE_STATUS_CANCELLED;
        campusActivityMapper.selectByIdForUpdate(reserve.getActivityId());
        reserve = getById(reserveId);
        if (Integer.valueOf(nextStatus).equals(reserve.getReserveStatus())) return reserve;
        if (nextStatus == Constant.RESERVE_STATUS_ACTIVE) {
            if (campusActivityMapper.incrementReservedCountIfAvailable(reserve.getActivityId()) != 1) {
                throw new BusinessException(400, "活动名额已满或报名未开放");
            }
            reserve.setReserveStatus(Constant.RESERVE_STATUS_ACTIVE);
            reserve.setReserveTime(LocalDateTime.now());
            reserve.setCancelTime(null);
        } else {
            reserve.setReserveStatus(Constant.RESERVE_STATUS_CANCELLED);
            reserve.setCancelTime(LocalDateTime.now());
            campusActivityMapper.decrementReservedCountSafely(reserve.getActivityId());
        }
        updateById(reserve);
        return reserve;
    }
}
