package com.shanhai.guide.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.shanhai.guide.common.ApiResponse;
import com.shanhai.guide.entity.TCampusActivity;
import com.shanhai.guide.entity.TCampusRoute;
import com.shanhai.guide.entity.TCampusSpot;
import com.shanhai.guide.entity.TAdmin;
import com.shanhai.guide.entity.TUser;
import com.shanhai.guide.service.AdminTokenService;
import com.shanhai.guide.service.AdminService;
import com.shanhai.guide.service.CampusActivityService;
import com.shanhai.guide.service.CampusRouteService;
import com.shanhai.guide.service.CampusSpotService;
import com.shanhai.guide.service.UserService;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 管理后台 Controller
 * 注册用户管理仅操作 t_user；访问会话由用户端运行流程自行维护。
 */
@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final UserService userService;
    private final AdminService adminService;
    private final AdminTokenService adminTokenService;
    private final CampusRouteService campusRouteService;
    private final CampusSpotService campusSpotService;
    private final CampusActivityService campusActivityService;

    public AdminController(UserService userService,
                           AdminService adminService,
                           AdminTokenService adminTokenService,
                           CampusRouteService campusRouteService,
                           CampusSpotService campusSpotService,
                           CampusActivityService campusActivityService) {
        this.userService = userService;
        this.adminService = adminService;
        this.adminTokenService = adminTokenService;
        this.campusRouteService = campusRouteService;
        this.campusSpotService = campusSpotService;
        this.campusActivityService = campusActivityService;
    }

    // ==================== 管理员登录 ====================

    @PostMapping("/login")
    public ApiResponse<Map<String, Object>> login(@RequestBody Map<String, String> params) {
        String username = params.get("username");
        String password = params.get("password");

        TAdmin admin = adminService.login(username, password);
        if (admin != null) {
            String token = adminTokenService.issueToken(admin);
            Map<String, Object> result = new HashMap<>();
            result.put("token", token);
            adminTokenService.getExpiresAt(token).ifPresent(expiresAt -> result.put("expiresAt", expiresAt.toString()));
            result.put("admin", toAdminView(admin));
            return ApiResponse.success(result);
        }
        return ApiResponse.error("用户名或密码错误");
    }

    @PostMapping("/logout")
    public ApiResponse<Void> logout(@RequestHeader(value = "Authorization", required = false) String authorization) {
        adminTokenService.revoke(adminTokenService.extractBearerToken(authorization));
        return ApiResponse.success();
    }

    /**
     * 修改当前管理员密码
     */
    @PutMapping("/password")
    public ApiResponse<Void> updatePassword(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody Map<String, String> body) {
        String token = adminTokenService.extractBearerToken(authorization);
        Long adminId = adminTokenService.getAdminId(token);
        if (adminId == null) {
            return ApiResponse.error(401, "未登录或会话已过期");
        }
        String oldPassword = body.get("oldPassword");
        String newPassword = body.get("newPassword");
        if (oldPassword == null || oldPassword.isEmpty()) {
            return ApiResponse.error("旧密码不能为空");
        }
        if (newPassword == null || newPassword.length() < 6) {
            return ApiResponse.error("新密码长度不能少于6位");
        }
        adminService.updatePassword(adminId, oldPassword, newPassword);
        return ApiResponse.success();
    }

    private Map<String, Object> toAdminView(TAdmin admin) {
        Map<String, Object> view = new HashMap<>();
        view.put("id", admin.getId());
        view.put("username", admin.getUsername());
        view.put("nickname", admin.getNickname());
        view.put("role", admin.getRole());
        view.put("status", admin.getStatus());
        view.put("lastLoginTime", admin.getLastLoginTime());
        return view;
    }

    // ==================== 统计数据 ====================

    /**
     * 全站统计（清晰区分注册用户数与访问会话数）
     */
    @GetMapping("/statistics")
    public ApiResponse<Map<String, Object>> getStatistics() {
        return ApiResponse.success(userService.getUserStatistics());
    }

    /**
     * 兼容旧路径（避免前端改动时临时报错）
     */
    @GetMapping("/users/statistics")
    public ApiResponse<Map<String, Object>> getUserStatisticsCompat() {
        return getStatistics();
    }

    // ==================== 注册用户管理 (t_user) ====================

    /**
     * 分页查询注册用户列表
     */
    @GetMapping("/users")
    public ApiResponse<IPage<TUser>> getUserList(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String userMode,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer status,
            @RequestParam(defaultValue = "false") boolean includeDisabled) {
        return ApiResponse.success(userService.getUserList(page, size, userMode, keyword, status, includeDisabled));
    }

    /**
     * 获取单个注册用户
     */
    @GetMapping("/users/{userId}")
    public ApiResponse<TUser> getUserById(@PathVariable Long userId) {
        return ApiResponse.success(userService.getRegisteredUserById(userId));
    }

    /**
     * 编辑注册用户基础信息（不含密码）
     */
    @PutMapping("/users/{userId}")
    public ApiResponse<TUser> updateUser(@PathVariable Long userId,
                                         @RequestBody TUser changes) {
        return ApiResponse.success(userService.updateRegisteredUser(userId, changes));
    }

    /**
     * 更新注册用户状态（1=启用, 0=禁用）
     */
    @PutMapping("/users/{userId}/status")
    public ApiResponse<TUser> updateUserStatus(@PathVariable Long userId,
                                               @RequestParam Integer status) {
        return ApiResponse.success(userService.updateUserStatus(userId, status));
    }

    /**
     * 修改注册用户密码
     */
    @PutMapping("/users/{userId}/password")
    public ApiResponse<Void> updatePassword(@PathVariable Long userId,
                                            @RequestBody Map<String, String> body) {
        String password = body.get("password");
        userService.updateRegisteredUserPassword(userId, password);
        return ApiResponse.success();
    }

    /**
     * 删除注册用户
     */
    @DeleteMapping("/users/{userId}")
    public ApiResponse<Void> deleteUser(@PathVariable Long userId) {
        userService.deleteRegisteredUser(userId);
        return ApiResponse.success();
    }

    // ==================== 管理端数据列表别名 ====================

    /**
     * 管理端路线列表：includeDisabled=true 时返回全部路线；否则默认只返回启用路线。
     */
    @GetMapping("/routes")
    public ApiResponse<List<TCampusRoute>> getAdminRoutes(
            @RequestParam(required = false) String userMode,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer minMinute,
            @RequestParam(required = false) Integer maxMinute,
            @RequestParam(required = false) Integer isEnable,
            @RequestParam(defaultValue = "false") boolean includeDisabled) {
        Integer queryEnable = isEnable;
        if (!Boolean.TRUE.equals(includeDisabled) && queryEnable == null) {
            queryEnable = 1;
        }
        return ApiResponse.success(campusRouteService.searchRoutes(userMode, queryEnable, keyword, minMinute, maxMinute));
    }

    /**
     * 管理端点位列表：includeDisabled=true 时返回全部点位；否则默认只返回启用点位。
     */
    @GetMapping("/spots")
    public ApiResponse<List<TCampusSpot>> getAdminSpots(
            @RequestParam(required = false) String spotType,
            @RequestParam(required = false) String userMode,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer isEnable,
            @RequestParam(defaultValue = "false") boolean includeDisabled) {
        Integer queryEnable = isEnable;
        if (!Boolean.TRUE.equals(includeDisabled) && queryEnable == null) {
            queryEnable = 1;
        }
        return ApiResponse.success(campusSpotService.searchSpots(spotType, userMode, keyword, queryEnable));
    }

    /**
     * 管理端活动列表：includeDisabled=true 时返回全部活动；否则默认只返回启用活动。
     */
    @GetMapping("/activities")
    public ApiResponse<List<TCampusActivity>> getAdminActivities(
            @RequestParam(required = false) String userMode,
            @RequestParam(required = false) String activityType,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer isReserve,
            @RequestParam(required = false) Integer isEnable,
            @RequestParam(defaultValue = "false") boolean includeDisabled) {
        Integer queryEnable = isEnable;
        if (!Boolean.TRUE.equals(includeDisabled) && queryEnable == null) {
            queryEnable = 1;
        }
        return ApiResponse.success(campusActivityService.searchActivities(userMode, activityType, queryEnable, keyword, isReserve));
    }
}
