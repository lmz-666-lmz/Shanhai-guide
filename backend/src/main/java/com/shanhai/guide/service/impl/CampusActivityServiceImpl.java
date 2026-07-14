package com.shanhai.guide.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.shanhai.guide.entity.TCampusActivity;
import com.shanhai.guide.exception.BusinessException;
import com.shanhai.guide.mapper.CampusActivityMapper;
import com.shanhai.guide.service.CampusActivityService;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class CampusActivityServiceImpl extends ServiceImpl<CampusActivityMapper, TCampusActivity> implements CampusActivityService {

    @Override
    public List<TCampusActivity> searchActivities(String userMode, String activityType, Integer isEnable) {
        return searchActivities(userMode, activityType, isEnable, null, null);
    }

    @Override
    public List<TCampusActivity> searchActivities(String userMode, String activityType, Integer isEnable, String keyword, Integer isReserve) {
        LambdaQueryWrapper<TCampusActivity> wrapper = new LambdaQueryWrapper<>();
        if (isEnable != null) wrapper.eq(TCampusActivity::getIsEnable, isEnable);
        if (isReserve != null) wrapper.eq(TCampusActivity::getIsReserve, isReserve);
        if (activityType != null && !activityType.isBlank()) {
            wrapper.eq(TCampusActivity::getActivityType, activityType);
        } else {
            wrapper.and(w -> w.ne(TCampusActivity::getActivityType, "通知")
                    .ne(TCampusActivity::getActivityType, "校园通知")
                    .or().isNull(TCampusActivity::getActivityType));
        }
        if (userMode != null && !userMode.isBlank()) {
            wrapper.and(w -> w.like(TCampusActivity::getSuitableMode, userMode)
                    .or().isNull(TCampusActivity::getSuitableMode)
                    .or().eq(TCampusActivity::getSuitableMode, ""));
        }
        if (keyword != null && !keyword.isBlank()) {
            String trimmed = keyword.trim();
            wrapper.and(w -> w.like(TCampusActivity::getActivityTitle, trimmed)
                    .or().like(TCampusActivity::getActivityDesc, trimmed));
        }
        wrapper.orderByAsc(TCampusActivity::getActivityTime);
        return list(wrapper);
    }

    @Override
    public List<TCampusActivity> getAllActivities() {
        LambdaQueryWrapper<TCampusActivity> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TCampusActivity::getIsEnable, 1);
        return list(wrapper);
    }

    @Override
    public TCampusActivity getActivityById(Long activityId) {
        LambdaQueryWrapper<TCampusActivity> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TCampusActivity::getId, activityId)
               .eq(TCampusActivity::getIsEnable, 1);
        TCampusActivity activity = getOne(wrapper);
        if (activity == null) {
            throw new BusinessException(404, "活动不存在");
        }
        return activity;
    }

    @Override
    public TCampusActivity getActivityForAdmin(Long activityId) {
        TCampusActivity activity = getById(activityId);
        if (activity == null) throw new BusinessException(404, "活动不存在");
        return activity;
    }
}
