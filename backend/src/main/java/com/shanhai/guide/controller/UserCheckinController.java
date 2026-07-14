package com.shanhai.guide.controller;

import com.shanhai.guide.common.ApiResponse;
import com.shanhai.guide.entity.TUserCheckin;
import com.shanhai.guide.entity.TBadge;
import com.shanhai.guide.entity.dto.UserActionResult;
import com.shanhai.guide.service.UserCheckinService;
import com.shanhai.guide.service.SessionGuardService;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/checkin")
public class UserCheckinController {

    private final UserCheckinService userCheckinService;
    private final SessionGuardService sessionGuardService;

    public UserCheckinController(UserCheckinService userCheckinService, SessionGuardService sessionGuardService) {
        this.userCheckinService = userCheckinService;
        this.sessionGuardService = sessionGuardService;
    }

    @PostMapping
    public ApiResponse<UserActionResult> checkin(@RequestParam String sessionId,
                                     @RequestParam(required = false) Long spotId,
                                     @RequestParam(required = false) Long routeId,
                                     @RequestParam Integer checkinType,
                                     @RequestParam(required = false) String checkinDesc) {
        sessionGuardService.requireActiveUserAction(sessionId);
        List<TBadge> unlocked = userCheckinService.checkin(sessionId, spotId, routeId, checkinType, checkinDesc);
        return ApiResponse.success(UserActionResult.of("打卡成功", unlocked));
    }

    @GetMapping("/history")
    public ApiResponse<List<TUserCheckin>> getCheckinHistory(@RequestParam String sessionId) {
        sessionGuardService.requireActiveUserAction(sessionId);
        List<TUserCheckin> history = userCheckinService.getCheckinHistory(sessionId);
        return ApiResponse.success(history);
    }

    @GetMapping("/count")
    public ApiResponse<Map<String, Integer>> getCheckinCount(@RequestParam String sessionId) {
        sessionGuardService.requireActiveUserAction(sessionId);
        int count = userCheckinService.getCheckinCount(sessionId);
        Map<String, Integer> result = new HashMap<>();
        result.put("count", count);
        return ApiResponse.success(result);
    }
}
