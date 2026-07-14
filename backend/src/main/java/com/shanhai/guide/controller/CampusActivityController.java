package com.shanhai.guide.controller;

import com.shanhai.guide.common.ApiResponse;
import com.shanhai.guide.entity.TCampusActivity;
import com.shanhai.guide.service.CampusActivityService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/activity")
public class CampusActivityController {

    private final CampusActivityService campusActivityService;

    public CampusActivityController(CampusActivityService campusActivityService) {
        this.campusActivityService = campusActivityService;
    }

    @GetMapping("/list")
    public ApiResponse<List<TCampusActivity>> getActivities(@RequestParam(required = false) String userMode,
                                                            @RequestParam(required = false) String activityType,
                                                            @RequestParam(required = false) Integer isEnable,
                                                            @RequestParam(required = false) String keyword,
                                                            @RequestParam(required = false) Integer isReserve,
                                                            @RequestParam(defaultValue = "false") boolean includeDisabled) {
        Integer queryEnable = isEnable;
        if (!includeDisabled && queryEnable == null) {
            queryEnable = 1;
        }
        List<TCampusActivity> activities = campusActivityService.searchActivities(
                userMode, activityType, queryEnable, keyword, isReserve);
        return ApiResponse.success(activities);
    }

    @GetMapping("/{activityId}")
    public ApiResponse<TCampusActivity> getActivityById(@PathVariable Long activityId) {
        TCampusActivity activity = campusActivityService.getActivityById(activityId);
        return ApiResponse.success(activity);
    }

    @PostMapping
    public ApiResponse<TCampusActivity> createActivity(@RequestBody TCampusActivity activity) {
        if (activity.getIsEnable() == null) activity.setIsEnable(1);
        if (activity.getReservedCount() == null) activity.setReservedCount(0);
        campusActivityService.save(activity);
        return ApiResponse.success(activity);
    }

    @PutMapping("/{activityId}")
    public ApiResponse<TCampusActivity> updateActivity(@PathVariable Long activityId,
                                                       @RequestBody TCampusActivity changes) {
        TCampusActivity current = campusActivityService.getActivityForAdmin(activityId);
        if (changes.getActivityTitle() != null) current.setActivityTitle(changes.getActivityTitle());
        if (changes.getActivityDesc() != null) current.setActivityDesc(changes.getActivityDesc());
        if (changes.getActivityType() != null) current.setActivityType(changes.getActivityType());
        if (changes.getActivityImage() != null) current.setActivityImage(changes.getActivityImage());
        if (changes.getActivityTime() != null) current.setActivityTime(changes.getActivityTime());
        if (changes.getActivitySpotId() != null) current.setActivitySpotId(changes.getActivitySpotId());
        if (changes.getSuitableMode() != null) current.setSuitableMode(changes.getSuitableMode());
        if (changes.getIsReserve() != null) current.setIsReserve(changes.getIsReserve());
        if (changes.getReserveLimit() != null) current.setReserveLimit(changes.getReserveLimit());
        // 报名人数只能由预约/取消事务维护，管理端普通编辑不能覆盖实时人数。
        if (changes.getIsEnable() != null) current.setIsEnable(changes.getIsEnable());
        campusActivityService.updateById(current);
        return ApiResponse.success(current);
    }

    @DeleteMapping("/{activityId}")
    public ApiResponse<String> deleteActivity(@PathVariable Long activityId) {
        TCampusActivity activity = campusActivityService.getActivityForAdmin(activityId);
        activity.setIsEnable(0);
        campusActivityService.updateById(activity);
        return ApiResponse.success("已禁用");
    }
}
