package com.shanhai.guide.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.shanhai.guide.common.ApiResponse;
import com.shanhai.guide.service.AdminTokenService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

@Component
public class AdminAuthInterceptor implements HandlerInterceptor {

    private final AdminTokenService adminTokenService;
    private final ObjectMapper objectMapper;

    public AdminAuthInterceptor(AdminTokenService adminTokenService, ObjectMapper objectMapper) {
        this.adminTokenService = adminTokenService;
        this.objectMapper = objectMapper;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws IOException {
        if (HttpMethod.OPTIONS.matches(request.getMethod()) || !requiresAdminAuth(request)) {
            return true;
        }

        String token = adminTokenService.extractBearerToken(request.getHeader("Authorization"));
        if (token == null) {
            writeError(response, HttpStatus.UNAUTHORIZED, 401, "请先登录管理后台");
            return false;
        }
        if (!adminTokenService.isValid(token)) {
            writeError(response, HttpStatus.FORBIDDEN, 403, "管理员登录已失效或无权限访问");
            return false;
        }

        request.setAttribute("adminToken", token);
        return true;
    }

    private boolean requiresAdminAuth(HttpServletRequest request) {
        String path = request.getServletPath();
        String method = request.getMethod();

        if ("/api/admin/login".equals(path)) {
            return false;
        }
        if (path.startsWith("/api/admin/")) {
            return true;
        }
        if (path.startsWith("/api/feedback/admin/") || path.startsWith("/api/reserve/admin/")) {
            return true;
        }

        if (isWriteMethod(method) && (path.equals("/api/spot") || path.startsWith("/api/spot/"))) {
            return true;
        }
        if (isWriteMethod(method) && (path.equals("/api/activity") || path.startsWith("/api/activity/"))) {
            return true;
        }
        if (isWriteMethod(method) && (path.equals("/api/route") || path.startsWith("/api/route/"))) {
            return !"/api/route/ai-plan".equals(path) && !path.matches("^/api/route/\\d+/complete$");
        }

        return false;
    }

    private boolean isWriteMethod(String method) {
        return HttpMethod.POST.matches(method) || HttpMethod.PUT.matches(method) || HttpMethod.DELETE.matches(method);
    }

    private void writeError(HttpServletResponse response, HttpStatus status, int code, String message) throws IOException {
        response.setStatus(status.value());
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(response.getWriter(), ApiResponse.error(code, message));
    }
}
