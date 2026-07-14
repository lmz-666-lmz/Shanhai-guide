package com.shanhai.guide.controller;

import com.shanhai.guide.common.ApiResponse;
import com.shanhai.guide.entity.TUserFavorite;
import com.shanhai.guide.entity.TBadge;
import com.shanhai.guide.entity.dto.UserActionResult;
import com.shanhai.guide.service.UserFavoriteService;
import com.shanhai.guide.service.SessionGuardService;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/favorite")
public class UserFavoriteController {

    private final UserFavoriteService userFavoriteService;
    private final SessionGuardService sessionGuardService;

    public UserFavoriteController(UserFavoriteService userFavoriteService, SessionGuardService sessionGuardService) {
        this.userFavoriteService = userFavoriteService;
        this.sessionGuardService = sessionGuardService;
    }

    @PostMapping("/add")
    public ApiResponse<UserActionResult> addFavorite(@RequestParam String sessionId,
                                         @RequestParam Integer favoriteType,
                                         @RequestParam Long targetId) {
        sessionGuardService.requireActiveUserAction(sessionId);
        List<TBadge> unlocked = userFavoriteService.addFavorite(sessionId, favoriteType, targetId);
        return ApiResponse.success(UserActionResult.of("收藏成功", unlocked));
    }

    @PostMapping("/remove")
    public ApiResponse<String> removeFavorite(@RequestParam String sessionId,
                                            @RequestParam Integer favoriteType,
                                            @RequestParam Long targetId) {
        sessionGuardService.requireActiveUserAction(sessionId);
        userFavoriteService.removeFavorite(sessionId, favoriteType, targetId);
        return ApiResponse.success("取消收藏成功");
    }

    @GetMapping("/check")
    public ApiResponse<Map<String, Boolean>> checkFavorite(@RequestParam String sessionId,
                                                           @RequestParam Integer favoriteType,
                                                           @RequestParam Long targetId) {
        sessionGuardService.requireActiveUserAction(sessionId);
        boolean isFavorite = userFavoriteService.isFavorite(sessionId, favoriteType, targetId);
        Map<String, Boolean> result = new HashMap<>();
        result.put("isFavorite", isFavorite);
        return ApiResponse.success(result);
    }

    @GetMapping("/list")
    public ApiResponse<List<TUserFavorite>> getFavorites(@RequestParam String sessionId,
                                                          @RequestParam(required = false) Integer favoriteType) {
        sessionGuardService.requireActiveUserAction(sessionId);
        List<TUserFavorite> favorites = userFavoriteService.getFavorites(sessionId, favoriteType);
        return ApiResponse.success(favorites);
    }
}
