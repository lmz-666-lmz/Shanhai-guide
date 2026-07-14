package com.shanhai.guide.controller;

import com.shanhai.guide.common.ApiResponse;
import com.shanhai.guide.entity.TUserSession;
import com.shanhai.guide.service.UserSessionService;
import com.shanhai.guide.service.SessionGuardService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/user")
public class UserController {

    private final UserSessionService userSessionService;
    private final SessionGuardService sessionGuardService;

    public UserController(UserSessionService userSessionService, SessionGuardService sessionGuardService) {
        this.userSessionService = userSessionService;
        this.sessionGuardService = sessionGuardService;
    }

    @PostMapping("/login")
    public ApiResponse<TUserSession> login(@RequestParam String userMode) {
        TUserSession session = userSessionService.createSession(userMode);
        return ApiResponse.success(session);
    }

    @GetMapping("/session")
    public ApiResponse<TUserSession> getSession(@RequestParam String sessionId) {
        TUserSession session = sessionGuardService.validateActiveSession(sessionId);
        return ApiResponse.success(session);
    }

    @PutMapping("/session")
    public ApiResponse<TUserSession> updateSession(@RequestParam String sessionId,
                                                   @RequestBody TUserSession changes) {
        sessionGuardService.requireActiveUserAction(sessionId);
        return ApiResponse.success(userSessionService.updateProfile(sessionId, changes));
    }

    @GetMapping("/statistics")
    public ApiResponse<java.util.Map<String, Object>> getStatistics(@RequestParam String sessionId) {
        sessionGuardService.requireActiveUserAction(sessionId);
        return ApiResponse.success(userSessionService.getProfileStatistics(sessionId));
    }
}
