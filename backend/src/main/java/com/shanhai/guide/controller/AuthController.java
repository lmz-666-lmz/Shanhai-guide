package com.shanhai.guide.controller;

import com.shanhai.guide.common.ApiResponse;
import com.shanhai.guide.entity.TUser;
import com.shanhai.guide.entity.TUserSession;
import com.shanhai.guide.service.AuthService;
import com.shanhai.guide.service.UserSessionService;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final UserSessionService userSessionService;

    public AuthController(AuthService authService, UserSessionService userSessionService) {
        this.authService = authService;
        this.userSessionService = userSessionService;
    }

    @PostMapping("/login")
    public ApiResponse<Map<String, Object>> login(@RequestBody Map<String, String> params) {
        String username = params.get("username");
        String password = params.get("password");
        String sessionId = params.get("sessionId"); // 当前前端 sessionId（游客会话）

        TUser user = authService.login(username, password);

        // 将当前前端会话绑定到登录用户
        TUserSession session = userSessionService.bindUserToSession(
                sessionId, user.getId(), user);

        // 清除密码后返回
        user.setPassword(null);

        Map<String, Object> result = new HashMap<>();
        result.put("session", session);
        result.put("user", user);

        return ApiResponse.success(result);
    }

    @PostMapping("/register")
    public ApiResponse<Map<String, Object>> register(@RequestBody Map<String, String> params) {
        String username = params.get("username");
        String password = params.get("password");
        String nickname = params.get("nickname");
        String userMode = params.get("userMode");
        String sessionId = params.get("sessionId"); // 当前前端 sessionId（游客会话）

        if (username == null || username.isEmpty()) {
            return ApiResponse.error("用户名不能为空");
        }
        if (password == null || password.length() < 6) {
            return ApiResponse.error("密码长度不能少于6位");
        }
        if (userMode == null || userMode.isEmpty()) {
            return ApiResponse.error("请选择用户类型");
        }

        TUser user = authService.register(username, password, nickname, userMode);

        // 注册成功后绑定会话
        TUserSession session = null;
        if (sessionId != null && !sessionId.isBlank()) {
            session = userSessionService.bindUserToSession(sessionId, user.getId(), user);
        } else {
            session = userSessionService.getOrCreateUserSession(user.getId(), user);
        }

        // 清除密码后返回
        user.setPassword(null);

        Map<String, Object> result = new HashMap<>();
        result.put("session", session);
        result.put("user", user);

        return ApiResponse.success(result);
    }
}
