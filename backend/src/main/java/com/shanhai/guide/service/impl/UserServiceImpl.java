package com.shanhai.guide.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.shanhai.guide.entity.TUser;
import com.shanhai.guide.entity.TUserSession;
import com.shanhai.guide.entity.TUserActivityReserve;
import com.shanhai.guide.exception.BusinessException;
import com.shanhai.guide.mapper.UserMapper;
import com.shanhai.guide.mapper.UserSessionMapper;
import com.shanhai.guide.mapper.CampusSpotMapper;
import com.shanhai.guide.mapper.CampusRouteMapper;
import com.shanhai.guide.mapper.CampusActivityMapper;
import com.shanhai.guide.mapper.UserChatHistoryMapper;
import com.shanhai.guide.mapper.UserCheckinMapper;
import com.shanhai.guide.mapper.UserFeedbackMapper;
import com.shanhai.guide.mapper.UserFavoriteMapper;
import com.shanhai.guide.mapper.UserActivityReserveMapper;
import com.shanhai.guide.service.UserService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

/**
 * 注册用户服务实现（操作 t_user 表）
 */
@Service
public class UserServiceImpl extends ServiceImpl<UserMapper, TUser> implements UserService {

    private final UserSessionMapper userSessionMapper;
    private final CampusSpotMapper campusSpotMapper;
    private final CampusRouteMapper campusRouteMapper;
    private final CampusActivityMapper campusActivityMapper;
    private final UserChatHistoryMapper userChatHistoryMapper;
    private final UserCheckinMapper userCheckinMapper;
    private final UserFeedbackMapper userFeedbackMapper;
    private final UserFavoriteMapper userFavoriteMapper;
    private final UserActivityReserveMapper userActivityReserveMapper;

    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    public UserServiceImpl(UserSessionMapper userSessionMapper,
                           CampusSpotMapper campusSpotMapper,
                           CampusRouteMapper campusRouteMapper,
                           CampusActivityMapper campusActivityMapper,
                           UserChatHistoryMapper userChatHistoryMapper,
                           UserCheckinMapper userCheckinMapper,
                           UserFeedbackMapper userFeedbackMapper,
                           UserFavoriteMapper userFavoriteMapper,
                           UserActivityReserveMapper userActivityReserveMapper) {
        this.userSessionMapper = userSessionMapper;
        this.campusSpotMapper = campusSpotMapper;
        this.campusRouteMapper = campusRouteMapper;
        this.campusActivityMapper = campusActivityMapper;
        this.userChatHistoryMapper = userChatHistoryMapper;
        this.userCheckinMapper = userCheckinMapper;
        this.userFeedbackMapper = userFeedbackMapper;
        this.userFavoriteMapper = userFavoriteMapper;
        this.userActivityReserveMapper = userActivityReserveMapper;
    }

    @Override
    public void updateRegisteredUserPassword(Long id, String rawPassword) {
        if (rawPassword == null || rawPassword.trim().isEmpty()) {
            throw new BusinessException(400, "密码不能为空");
        }
        TUser user = requireRegisteredUser(id);
        user.setPassword(passwordEncoder.encode(rawPassword.trim()));
        updateById(user);
    }

    @Override
    public IPage<TUser> getUserList(int page, int size, String userMode, String keyword, Integer status, boolean includeDisabled) {
        LambdaQueryWrapper<TUser> wrapper = new LambdaQueryWrapper<>();
        if (status != null) {
            wrapper.eq(TUser::getStatus, status);
        } else if (!includeDisabled) {
            wrapper.and(w -> w.eq(TUser::getStatus, 1).or().isNull(TUser::getStatus));
        }
        if (userMode != null && !userMode.isEmpty()) {
            wrapper.eq(TUser::getUserMode, userMode);
        }
        if (keyword != null && !keyword.isBlank()) {
            String trimmed = keyword.trim();
            wrapper.and(w -> w.like(TUser::getUsername, trimmed)
                    .or().like(TUser::getNickname, trimmed)
                    .or().like(TUser::getPhone, trimmed)
                    .or().like(TUser::getCollege, trimmed)
                    .or().like(TUser::getMajor, trimmed));
        }
        wrapper.orderByDesc(TUser::getId);
        IPage<TUser> result = this.page(new Page<>(page, size), wrapper);
        result.getRecords().forEach(this::hidePassword);
        return result;
    }

    @Override
    public TUser getRegisteredUserById(Long id) {
        TUser user = requireRegisteredUser(id);
        hidePassword(user);
        return user;
    }

    @Override
    public TUser updateRegisteredUser(Long id, TUser changes) {
        TUser user = requireRegisteredUser(id);
        if (changes.getUsername() != null) {
            if (changes.getUsername().isBlank()) {
                throw new BusinessException(400, "用户名不能为空");
            }
            String username = changes.getUsername().trim();
            TUser exists = getOne(new LambdaQueryWrapper<TUser>().eq(TUser::getUsername, username));
            if (exists != null && !exists.getId().equals(id)) {
                throw new BusinessException(400, "用户名已存在");
            }
            user.setUsername(username);
        }
        if (changes.getNickname() != null) user.setNickname(changes.getNickname().trim());
        if (changes.getUserMode() != null) user.setUserMode(changes.getUserMode());
        if (changes.getCollege() != null) user.setCollege(changes.getCollege().trim());
        if (changes.getMajor() != null) user.setMajor(changes.getMajor().trim());
        if (changes.getGrade() != null) user.setGrade(changes.getGrade());
        if (changes.getPhone() != null) user.setPhone(changes.getPhone().trim());
        updateById(user);

        // 同步更新该用户所有活跃 session 的对应字段（管理员修改生效到用户端）
        java.util.List<TUserSession> sessions = userSessionMapper.selectList(
                new LambdaQueryWrapper<TUserSession>().eq(TUserSession::getUserId, id));
        for (TUserSession s : sessions) {
            boolean sChanged = false;
            if (changes.getNickname() != null && !changes.getNickname().equals(s.getVirtualName())) {
                s.setVirtualName(changes.getNickname().trim()); sChanged = true;
            }
            if (changes.getUserMode() != null && !changes.getUserMode().equals(s.getUserMode())) {
                s.setUserMode(changes.getUserMode()); sChanged = true;
            }
            if (changes.getCollege() != null && !changes.getCollege().equals(s.getVirtualCollege())) {
                s.setVirtualCollege(changes.getCollege().trim()); sChanged = true;
            }
            if (changes.getMajor() != null && !changes.getMajor().equals(s.getVirtualMajor())) {
                s.setVirtualMajor(changes.getMajor().trim()); sChanged = true;
            }
            if (changes.getGrade() != null && !Integer.valueOf(changes.getGrade()).equals(s.getVirtualYear())) {
                s.setVirtualYear(changes.getGrade()); sChanged = true;
            }
            if (sChanged) userSessionMapper.updateById(s);
        }

        hidePassword(user);
        return user;
    }

    @Override
    public TUser updateUserStatus(Long id, Integer status) {
        if (!Integer.valueOf(0).equals(status) && !Integer.valueOf(1).equals(status)) {
            throw new BusinessException(400, "账号状态只能为启用或禁用");
        }
        TUser user = requireRegisteredUser(id);
        user.setStatus(status);
        updateById(user);

        // 同步禁用/启用该用户所有 session
        int sessionStatus = Integer.valueOf(1).equals(status) ? 1 : 0;
        java.util.List<TUserSession> sessions = userSessionMapper.selectList(
                new LambdaQueryWrapper<TUserSession>().eq(TUserSession::getUserId, id));
        for (TUserSession s : sessions) {
            if (!Integer.valueOf(sessionStatus).equals(s.getStatus())) {
                s.setStatus(sessionStatus);
                userSessionMapper.updateById(s);
            }
        }

        hidePassword(user);
        return user;
    }

    @Override
    public void deleteRegisteredUser(Long id) {
        TUser user = requireRegisteredUser(id);
        // 删除用户时同步清理其所有 session，防止孤儿 session
        java.util.List<TUserSession> sessions = userSessionMapper.selectList(
                new LambdaQueryWrapper<TUserSession>().eq(TUserSession::getUserId, id));
        for (TUserSession s : sessions) {
            s.setUserId(null);
            s.setStatus(0);
            userSessionMapper.updateById(s);
        }
        removeById(user.getId());
    }

    @Override
    public Map<String, Object> getUserStatistics() {
        Map<String, Object> stats = new HashMap<>();

        // 注册用户数（t_user）
        long registeredUsers = count();
        stats.put("registeredUsers", registeredUsers);

        // 访问会话数（t_user_session）
        long sessionUsers = userSessionMapper.selectCount(null);
        stats.put("sessionUsers", sessionUsers);

        // 会话用户类型分布
        stats.put("freshCount", userSessionMapper.selectCount(
                new LambdaQueryWrapper<TUserSession>().eq(TUserSession::getUserMode, "fresh")));
        stats.put("alumniCount", userSessionMapper.selectCount(
                new LambdaQueryWrapper<TUserSession>().eq(TUserSession::getUserMode, "alumni")));
        stats.put("parentCount", userSessionMapper.selectCount(
                new LambdaQueryWrapper<TUserSession>().eq(TUserSession::getUserMode, "parent")));
        stats.put("researchCount", userSessionMapper.selectCount(
                new LambdaQueryWrapper<TUserSession>().eq(TUserSession::getUserMode, "research")));
        stats.put("seniorCount", userSessionMapper.selectCount(
                new LambdaQueryWrapper<TUserSession>().eq(TUserSession::getUserMode, "senior")));

        // 其他运营数据
        stats.put("totalCheckins", userCheckinMapper.selectCount(null));
        stats.put("totalFavorites", userFavoriteMapper.selectCount(null));
        stats.put("totalSpots", campusSpotMapper.selectCount(null));
        stats.put("totalRoutes", campusRouteMapper.selectCount(null));
        stats.put("totalActivities", campusActivityMapper.selectCount(null));
        stats.put("totalChats", userChatHistoryMapper.selectCount(null));
        stats.put("totalReserves", userActivityReserveMapper.selectCount(null));
        stats.put("totalFeedbacks", userFeedbackMapper.selectCount(null));

        return stats;
    }

    private void hidePassword(TUser user) {
        if (user != null) {
            user.setPassword(null);
        }
    }

    private TUser requireRegisteredUser(Long id) {
        TUser user = getById(id);
        if (user == null) {
            throw new BusinessException(404, "注册用户不存在");
        }
        return user;
    }
}
