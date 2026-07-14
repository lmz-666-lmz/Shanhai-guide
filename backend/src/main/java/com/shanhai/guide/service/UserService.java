package com.shanhai.guide.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.service.IService;
import com.shanhai.guide.entity.TUser;

import java.util.Map;

/**
 * 注册用户服务（操作 t_user 表）
 * 访问会话请使用 UserSessionService（操作 t_user_session 表）
 */
public interface UserService extends IService<TUser> {

    /** 分页查询注册用户 */
    IPage<TUser> getUserList(int page, int size, String userMode, String keyword, Integer status, boolean includeDisabled);

    /** 根据 ID 获取注册用户 */
    TUser getRegisteredUserById(Long id);

    /** 更新注册用户基础信息（不含密码） */
    TUser updateRegisteredUser(Long id, TUser changes);

    /** 更新注册用户状态（启用/禁用） */
    TUser updateUserStatus(Long id, Integer status);

    /** 更新注册用户密码 */
    void updateRegisteredUserPassword(Long id, String rawPassword);

    /** 删除注册用户 */
    void deleteRegisteredUser(Long id);

    /** 全局统计数据（注册用户数、会话数、点位数等） */
    Map<String, Object> getUserStatistics();
}
