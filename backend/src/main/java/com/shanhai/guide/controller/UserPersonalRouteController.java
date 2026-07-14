package com.shanhai.guide.controller;

import com.shanhai.guide.common.ApiResponse;
import com.shanhai.guide.entity.TUserPersonalRoute;
import com.shanhai.guide.service.UserPersonalRouteService;
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
@RequestMapping("/api/user/personal-routes")
public class UserPersonalRouteController {

    private final UserPersonalRouteService personalRouteService;

    public UserPersonalRouteController(UserPersonalRouteService personalRouteService) {
        this.personalRouteService = personalRouteService;
    }

    @PostMapping
    public ApiResponse<TUserPersonalRoute> create(@RequestBody TUserPersonalRoute route) {
        return ApiResponse.success(personalRouteService.createRoute(route));
    }

    @GetMapping
    public ApiResponse<List<TUserPersonalRoute>> list(@RequestParam String sessionId) {
        return ApiResponse.success(personalRouteService.listRoutes(sessionId));
    }

    @GetMapping("/{routeId}")
    public ApiResponse<TUserPersonalRoute> detail(@PathVariable Long routeId,
                                                  @RequestParam String sessionId) {
        return ApiResponse.success(personalRouteService.getRoute(sessionId, routeId));
    }

    @PutMapping("/{routeId}")
    public ApiResponse<TUserPersonalRoute> update(@PathVariable Long routeId,
                                                  @RequestParam String sessionId,
                                                  @RequestBody TUserPersonalRoute changes) {
        return ApiResponse.success(personalRouteService.updateRoute(sessionId, routeId, changes));
    }

    @DeleteMapping("/{routeId}")
    public ApiResponse<Void> delete(@PathVariable Long routeId,
                                    @RequestParam String sessionId) {
        personalRouteService.deleteRoute(sessionId, routeId);
        return ApiResponse.success();
    }
}
