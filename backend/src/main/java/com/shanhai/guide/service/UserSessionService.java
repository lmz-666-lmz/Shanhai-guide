package com.shanhai.guide.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.service.IService;
import com.shanhai.guide.entity.TUser;
import com.shanhai.guide.entity.TUserSession;

import java.util.Map;

/**
 * 访问会话服务（操作 t_user_session 表）
 * 注册用户请使用 UserService（操作 t_user 表）
 */
public interface UserSessionService extends IService<TUserSession> {

    // ==================== 用户端接口 ====================

    /** 创建新的访问会话（游客体验 / 正式登录） */
    TUserSession createSession(String userMode);

    /** 根据 sessionId 获取会话 */
    TUserSession getSession(String sessionId);

    /** 更新会话（覆盖式） */
    void updateSession(String sessionId, TUserSession session);

    /** 用户端更新个人资料 */
    TUserSession updateProfile(String sessionId, TUserSession changes);

    /** 获取当前 session 的统计信息 */
    Map<String, Object> getProfileStatistics(String sessionId);

    /**
     * 获取或创建用户的规范会话（每个注册用户对应一个确定性 sessionId）
     * @return 已存在或新建的会话，userId 已设置
     */
    TUserSession getOrCreateUserSession(Long userId, TUser user);

    /**
     * 将指定 session 绑定到注册用户
     * @param sessionId 当前前端 sessionId
     * @param userId 注册用户 ID
     * @param user 注册用户信息
     * @return 绑定后的会话
     */
    TUserSession bindUserToSession(String sessionId, Long userId, TUser user);

    /**
     * 将游客会话的业务数据迁移到目标会话
     * @param fromSessionId 游客 sessionId
     * @param toSessionId 用户规范 sessionId
     */
    void migrateSessionData(String fromSessionId, String toSessionId);

    // ==================== 管理端接口 ====================

    /** 分页查询访问会话列表 */
    IPage<TUserSession> getSessionList(int page, int size, String userMode, String keyword, boolean includeDisabled);

    /** 获取会话详情（含打卡、收藏记录） */
    Map<String, Object> getSessionDetail(String sessionId);

    /** 管理员更新会话资料 */
    TUserSession updateSessionByAdmin(String sessionId, TUserSession changes);

    /** 更新会话状态（启用/禁用） */
    TUserSession updateSessionStatus(String sessionId, Integer status);

    /** 删除会话（软删除/禁用，保留打卡、收藏、预约等历史数据） */
    void deleteSessionByAdmin(String sessionId);
}
