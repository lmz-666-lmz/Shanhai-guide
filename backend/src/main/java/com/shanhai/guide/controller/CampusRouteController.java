package com.shanhai.guide.controller;

import com.shanhai.guide.common.ApiResponse;
import com.shanhai.guide.entity.TBadge;
import com.shanhai.guide.entity.TCampusRoute;
import com.shanhai.guide.entity.TUserSession;
import com.shanhai.guide.entity.dto.AiRoutePlan;
import com.shanhai.guide.entity.dto.AiRoutePlanRequest;
import com.shanhai.guide.entity.dto.UserActionResult;
import com.shanhai.guide.service.AiService;
import com.shanhai.guide.service.CampusRouteService;
import com.shanhai.guide.service.SessionGuardService;
import com.shanhai.guide.service.UserCheckinService;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/route")
public class CampusRouteController {

    private final CampusRouteService campusRouteService;
    private final SessionGuardService sessionGuardService;
    private final UserCheckinService userCheckinService;
    private final AiService aiService;

    public CampusRouteController(CampusRouteService campusRouteService,
                                 SessionGuardService sessionGuardService,
                                 UserCheckinService userCheckinService,
                                 AiService aiService) {
        this.campusRouteService = campusRouteService;
        this.sessionGuardService = sessionGuardService;
        this.userCheckinService = userCheckinService;
        this.aiService = aiService;
    }

    @GetMapping("/list")
    public ApiResponse<List<TCampusRoute>> getRoutes(@RequestParam(required = false) String userMode,
                                                     @RequestParam(required = false) Integer isEnable,
                                                     @RequestParam(required = false) String keyword,
                                                     @RequestParam(required = false) Integer minMinute,
                                                     @RequestParam(required = false) Integer maxMinute,
                                                     @RequestParam(defaultValue = "false") boolean includeDisabled) {
        Integer queryEnable = isEnable;
        if (!includeDisabled && queryEnable == null) {
            queryEnable = 1;
        }
        return ApiResponse.success(campusRouteService.searchRoutes(userMode, queryEnable, keyword, minMinute, maxMinute));
    }

    @PostMapping("/ai-plan")
    public ApiResponse<AiRoutePlan> aiPlan(@RequestBody AiRoutePlanRequest request) {
        TUserSession session = sessionGuardService.requireActiveUserAction(request.getSessionId());
        return ApiResponse.success(aiService.planRoute(request, session.getUserMode()));
    }

    @GetMapping("/{routeId}")
    public ApiResponse<TCampusRoute> getRouteById(@PathVariable Long routeId) {
        return ApiResponse.success(campusRouteService.getRouteById(routeId));
    }

    @PostMapping("/{routeId}/complete")
    public ApiResponse<UserActionResult> completeRoute(@PathVariable Long routeId, @RequestParam String sessionId) {
        sessionGuardService.requireActiveUserAction(sessionId);
        TCampusRoute route = campusRouteService.getRouteById(routeId);
        List<TBadge> unlocked = userCheckinService.completeRoute(sessionId, routeId, route.getRouteName());
        return ApiResponse.success(UserActionResult.of("路线完成记录已保存", unlocked));
    }

    @PostMapping
    public ApiResponse<TCampusRoute> createRoute(@RequestBody TCampusRoute route) {
        if (route.getIsEnable() == null) route.setIsEnable(1);
        campusRouteService.prepareAndValidate(route);
        campusRouteService.save(route);
        return ApiResponse.success(route);
    }

    @PutMapping("/{routeId}")
    public ApiResponse<TCampusRoute> updateRoute(@PathVariable Long routeId, @RequestBody TCampusRoute route) {
        TCampusRoute existingRoute = campusRouteService.getRouteForAdmin(routeId);
        if (route.getRouteName() != null) existingRoute.setRouteName(route.getRouteName());
        if (route.getRouteDesc() != null) existingRoute.setRouteDesc(route.getRouteDesc());
        if (route.getTotalMinute() != null) existingRoute.setTotalMinute(route.getTotalMinute());
        if (route.getSpotOrderJson() != null) existingRoute.setSpotOrderJson(route.getSpotOrderJson());
        if (route.getSuitableMode() != null) existingRoute.setSuitableMode(route.getSuitableMode());
        if (route.getCoverImage() != null) existingRoute.setCoverImage(route.getCoverImage());
        if (route.getIsEnable() != null) existingRoute.setIsEnable(route.getIsEnable());
        campusRouteService.prepareAndValidate(existingRoute);
        campusRouteService.updateById(existingRoute);
        return ApiResponse.success(existingRoute);
    }

    @DeleteMapping("/{routeId}")
    public ApiResponse<String> deleteRoute(@PathVariable Long routeId) {
        TCampusRoute route = campusRouteService.getRouteForAdmin(routeId);
        route.setIsEnable(0);
        campusRouteService.updateById(route);
        return ApiResponse.success("已停用");
    }
}
