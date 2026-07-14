package com.shanhai.guide.controller;

import com.shanhai.guide.common.ApiResponse;
import com.shanhai.guide.entity.TUserActivityReserve;
import com.shanhai.guide.entity.TBadge;
import com.shanhai.guide.entity.dto.UserActionResult;
import com.shanhai.guide.service.UserActivityReserveService;
import com.shanhai.guide.service.SessionGuardService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/reserve")
public class ActivityReserveController {

    private final UserActivityReserveService userActivityReserveService;
    private final SessionGuardService sessionGuardService;

    public ActivityReserveController(UserActivityReserveService userActivityReserveService, SessionGuardService sessionGuardService) {
        this.userActivityReserveService = userActivityReserveService;
        this.sessionGuardService = sessionGuardService;
    }

    @PostMapping("/add")
    public ApiResponse<UserActionResult> addReserve(@RequestParam String sessionId,
                                        @RequestParam Long activityId) {
        sessionGuardService.requireActiveUserAction(sessionId);
        List<TBadge> unlocked = userActivityReserveService.reserveActivity(sessionId, activityId);
        return ApiResponse.success(UserActionResult.of("预约成功", unlocked));
    }

    @PostMapping("/cancel")
    public ApiResponse<String> cancelReserve(@RequestParam String sessionId,
                                           @RequestParam Long activityId) {
        sessionGuardService.requireActiveUserAction(sessionId);
        userActivityReserveService.cancelReserve(sessionId, activityId);
        return ApiResponse.success("取消预约成功");
    }

    @GetMapping("/check")
    public ApiResponse<Map<String, Boolean>> checkReserve(@RequestParam String sessionId,
                                                          @RequestParam Long activityId) {
        sessionGuardService.requireActiveUserAction(sessionId);
        boolean isReserved = userActivityReserveService.isReserved(sessionId, activityId);
        Map<String, Boolean> result = new HashMap<>();
        result.put("isReserved", isReserved);
        return ApiResponse.success(result);
    }

    @GetMapping("/list")
    public ApiResponse<List<TUserActivityReserve>> getReserves(@RequestParam String sessionId) {
        sessionGuardService.requireActiveUserAction(sessionId);
        List<TUserActivityReserve> reserves = userActivityReserveService.getUserReserves(sessionId);
        return ApiResponse.success(reserves);
    }

    @GetMapping("/admin/list")
    public ApiResponse<List<TUserActivityReserve>> getReserveList(@RequestParam(required = false) String sessionId,
                                                                  @RequestParam(required = false) Long activityId,
                                                                  @RequestParam(required = false) Integer reserveStatus) {
        LambdaQueryWrapper<TUserActivityReserve> wrapper = new LambdaQueryWrapper<>();
        if (sessionId != null && !sessionId.isBlank()) {
            wrapper.eq(TUserActivityReserve::getSessionId, sessionId);
        }
        if (activityId != null) {
            wrapper.eq(TUserActivityReserve::getActivityId, activityId);
        }
        if (reserveStatus != null) {
            wrapper.eq(TUserActivityReserve::getReserveStatus, reserveStatus);
        }
        wrapper.orderByDesc(TUserActivityReserve::getReserveTime);
        return ApiResponse.success(userActivityReserveService.list(wrapper));
    }

    @PutMapping("/admin/{reserveId}/status")
    public ApiResponse<TUserActivityReserve> updateReserveStatus(@PathVariable Long reserveId,
                                                                 @RequestParam Integer reserveStatus) {
        return ApiResponse.success(userActivityReserveService.updateReserveStatus(reserveId, reserveStatus));
    }
}
