package com.shanhai.guide.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.shanhai.guide.entity.TCampusActivity;

import java.util.List;

public interface CampusActivityService extends IService<TCampusActivity> {

    List<TCampusActivity> searchActivities(String userMode, String activityType, Integer isEnable);

    List<TCampusActivity> searchActivities(String userMode, String activityType, Integer isEnable, String keyword, Integer isReserve);

    List<TCampusActivity> getAllActivities();

    TCampusActivity getActivityById(Long activityId);

    TCampusActivity getActivityForAdmin(Long activityId);
}
