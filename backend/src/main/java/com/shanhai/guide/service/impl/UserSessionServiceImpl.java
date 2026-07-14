package com.shanhai.guide.service.impl;

import cn.hutool.core.util.IdUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.shanhai.guide.entity.TUser;
import com.shanhai.guide.entity.TUserSession;
import com.shanhai.guide.entity.TUserCheckin;
import com.shanhai.guide.entity.TUserFavorite;
import com.shanhai.guide.entity.TUserActivityReserve;
import com.shanhai.guide.entity.TUserBadgeRelation;
import com.shanhai.guide.entity.TUserChatHistory;
import com.shanhai.guide.entity.TUserDigitalHumanConfig;
import com.shanhai.guide.entity.TUserContentApplication;
import com.shanhai.guide.entity.TUserFeedback;
import com.shanhai.guide.entity.TUserMessage;
import com.shanhai.guide.entity.TUserMessageState;
import com.shanhai.guide.entity.TUserPersonalRoute;
import com.shanhai.guide.exception.BusinessException;
import com.shanhai.guide.mapper.UserSessionMapper;
import com.shanhai.guide.mapper.UserCheckinMapper;
import com.shanhai.guide.mapper.UserMapper;
import com.shanhai.guide.mapper.UserFavoriteMapper;
import com.shanhai.guide.mapper.UserActivityReserveMapper;
import com.shanhai.guide.mapper.UserBadgeRelationMapper;
import com.shanhai.guide.mapper.UserChatHistoryMapper;
import com.shanhai.guide.mapper.UserContentApplicationMapper;
import com.shanhai.guide.mapper.UserDigitalHumanConfigMapper;
import com.shanhai.guide.mapper.UserFeedbackMapper;
import com.shanhai.guide.mapper.UserMessageMapper;
import com.shanhai.guide.mapper.UserMessageStateMapper;
import com.shanhai.guide.mapper.UserPersonalRouteMapper;
import com.shanhai.guide.service.UserSessionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 访问会话服务实现（操作 t_user_session 表）
 * 注册用户请使用 UserServiceImpl（操作 t_user 表）
 */
@Service
public class UserSessionServiceImpl extends ServiceImpl<UserSessionMapper, TUserSession> implements UserSessionService {

    private static final Logger log = LoggerFactory.getLogger(UserSessionServiceImpl.class);

    private final UserCheckinMapper userCheckinMapper;
    private final UserFavoriteMapper userFavoriteMapper;
    private final UserActivityReserveMapper userActivityReserveMapper;
    private final UserBadgeRelationMapper userBadgeRelationMapper;
    private final UserChatHistoryMapper userChatHistoryMapper;
    private final UserContentApplicationMapper userContentApplicationMapper;
    private final UserDigitalHumanConfigMapper userDigitalHumanConfigMapper;
    private final UserFeedbackMapper userFeedbackMapper;
    private final UserMessageMapper userMessageMapper;
    private final UserMessageStateMapper userMessageStateMapper;
    private final UserPersonalRouteMapper userPersonalRouteMapper;
    private final UserMapper userMapper;

    public UserSessionServiceImpl(UserCheckinMapper userCheckinMapper,
                                   UserFavoriteMapper userFavoriteMapper,
                                   UserActivityReserveMapper userActivityReserveMapper,
                                   UserBadgeRelationMapper userBadgeRelationMapper,
                                   UserChatHistoryMapper userChatHistoryMapper,
                                   UserContentApplicationMapper userContentApplicationMapper,
                                   UserDigitalHumanConfigMapper userDigitalHumanConfigMapper,
                                   UserFeedbackMapper userFeedbackMapper,
                                   UserMessageMapper userMessageMapper,
                                   UserMessageStateMapper userMessageStateMapper,
                                   UserPersonalRouteMapper userPersonalRouteMapper,
                                   UserMapper userMapper) {
        this.userCheckinMapper = userCheckinMapper;
        this.userFavoriteMapper = userFavoriteMapper;
        this.userActivityReserveMapper = userActivityReserveMapper;
        this.userBadgeRelationMapper = userBadgeRelationMapper;
        this.userChatHistoryMapper = userChatHistoryMapper;
        this.userContentApplicationMapper = userContentApplicationMapper;
        this.userDigitalHumanConfigMapper = userDigitalHumanConfigMapper;
        this.userFeedbackMapper = userFeedbackMapper;
        this.userMessageMapper = userMessageMapper;
        this.userMessageStateMapper = userMessageStateMapper;
        this.userPersonalRouteMapper = userPersonalRouteMapper;
        this.userMapper = userMapper;
    }

    // ==================== 用户端接口 ====================

    @Override
    public TUserSession createSession(String userMode) {
        TUserSession session = new TUserSession();
        session.setSessionId(IdUtil.fastUUID());
        session.setUserMode(userMode);
        session.setVirtualName("体验访客");
        session.setVirtualYear(2025);
        session.setVirtualCollege("待填写");
        session.setVirtualMajor("待填写");
        session.setTotalCheckin(0);
        session.setTotalRoute(0);
        session.setStatus(1);
        save(session);
        return session;
    }

    @Override
    public TUserSession getSession(String sessionId) {
        LambdaQueryWrapper<TUserSession> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TUserSession::getSessionId, sessionId);
        TUserSession session = getOne(wrapper);
        if (session == null) {
            throw new BusinessException(401, "会话不存在，请重新登录");
        }
        if (Integer.valueOf(0).equals(session.getStatus())) {
            throw new BusinessException(401, "当前访问会话已停用，请重新登录或创建数字身份");
        }
        // 防御性同步：每次读取会话时，若已绑定注册用户，确保 session.userMode 与 t_user.user_mode 一致
        if (session.getUserId() != null) {
            TUser user = userMapper.selectById(session.getUserId());
            if (user != null && user.getUserMode() != null && !user.getUserMode().equals(session.getUserMode())) {
                log.info("getSession 同步身份：session {} 从 {} 更正为 {}", sessionId, session.getUserMode(), user.getUserMode());
                session.setUserMode(user.getUserMode());
                updateById(session);
            }
        }
        return session;
    }

    @Override
    public void updateSession(String sessionId, TUserSession session) {
        LambdaQueryWrapper<TUserSession> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TUserSession::getSessionId, sessionId);
        update(session, wrapper);
    }

    @Override
    public TUserSession updateProfile(String sessionId, TUserSession changes) {
        TUserSession session = getSession(sessionId);
        // 收集需要同步到 t_user 的变更
        TUser user = session.getUserId() != null ? userMapper.selectById(session.getUserId()) : null;
        boolean userChanged = false;

        if (changes.getVirtualName() != null) {
            session.setVirtualName(changes.getVirtualName().trim());
            if (user != null) { user.setNickname(changes.getVirtualName().trim()); userChanged = true; }
        }
        if (changes.getUserMode() != null) {
            session.setUserMode(changes.getUserMode());
            if (user != null && !changes.getUserMode().equals(user.getUserMode())) {
                user.setUserMode(changes.getUserMode());
                userChanged = true;
            }
        }
        if (changes.getVirtualCollege() != null) {
            session.setVirtualCollege(changes.getVirtualCollege().trim());
            if (user != null) { user.setCollege(changes.getVirtualCollege().trim()); userChanged = true; }
        }
        if (changes.getVirtualMajor() != null) {
            session.setVirtualMajor(changes.getVirtualMajor().trim());
            if (user != null) { user.setMajor(changes.getVirtualMajor().trim()); userChanged = true; }
        }
        if (changes.getVirtualYear() != null) {
            session.setVirtualYear(changes.getVirtualYear());
            if (user != null) { user.setGrade(changes.getVirtualYear()); userChanged = true; }
        }
        if (userChanged) {
            userMapper.updateById(user);
            log.info("已同步用户 {} 的资料到 t_user", user.getId());
        }
        updateById(session);
        return session;
    }

    @Override
    public Map<String, Object> getProfileStatistics(String sessionId) {
        getSession(sessionId); // 验证 session 存在
        Map<String, Object> stats = new HashMap<>();
        stats.put("checkinCount", userCheckinMapper.selectCount(
                new LambdaQueryWrapper<TUserCheckin>().eq(TUserCheckin::getSessionId, sessionId)));
        stats.put("favoriteSpotCount", userFavoriteMapper.selectCount(
                new LambdaQueryWrapper<TUserFavorite>().eq(TUserFavorite::getSessionId, sessionId)
                        .eq(TUserFavorite::getFavoriteType, 1)));
        stats.put("favoriteRouteCount", userFavoriteMapper.selectCount(
                new LambdaQueryWrapper<TUserFavorite>().eq(TUserFavorite::getSessionId, sessionId)
                        .eq(TUserFavorite::getFavoriteType, 2)));
        stats.put("activityCount", userActivityReserveMapper.selectCount(
                new LambdaQueryWrapper<TUserActivityReserve>()
                        .eq(TUserActivityReserve::getSessionId, sessionId)
                        .eq(TUserActivityReserve::getReserveStatus, 1)));
        stats.put("badgeCount", userBadgeRelationMapper.selectCount(
                new LambdaQueryWrapper<TUserBadgeRelation>()
                        .eq(TUserBadgeRelation::getSessionId, sessionId)));
        return stats;
    }

    // ==================== 管理端接口 ====================

    @Override
    public IPage<TUserSession> getSessionList(int page, int size, String userMode, String keyword, boolean includeDisabled) {
        LambdaQueryWrapper<TUserSession> wrapper = new LambdaQueryWrapper<>();
        if (!includeDisabled) {
            wrapper.and(w -> w.eq(TUserSession::getStatus, 1).or().isNull(TUserSession::getStatus));
        }
        if (userMode != null && !userMode.isEmpty()) {
            wrapper.eq(TUserSession::getUserMode, userMode);
        }
        if (keyword != null && !keyword.isBlank()) {
            String trimmed = keyword.trim();
            wrapper.and(w -> w.like(TUserSession::getSessionId, trimmed)
                    .or().like(TUserSession::getVirtualName, trimmed)
                    .or().like(TUserSession::getVirtualCollege, trimmed)
                    .or().like(TUserSession::getVirtualMajor, trimmed));
        }
        wrapper.orderByDesc(TUserSession::getCreateTime);
        IPage<TUserSession> result = this.page(new Page<>(page, size), wrapper);
        // 填充实时打卡/收藏统计
        result.getRecords().forEach(session -> {
            session.setTotalCheckin(Math.toIntExact(userCheckinMapper.selectCount(
                    new LambdaQueryWrapper<TUserCheckin>()
                            .eq(TUserCheckin::getSessionId, session.getSessionId()))));
            session.setTotalRoute(Math.toIntExact(userFavoriteMapper.selectCount(
                    new LambdaQueryWrapper<TUserFavorite>()
                            .eq(TUserFavorite::getSessionId, session.getSessionId())
                            .eq(TUserFavorite::getFavoriteType, 2))));
        });
        return result;
    }

    @Override
    public Map<String, Object> getSessionDetail(String sessionId) {
        TUserSession session = getOne(new LambdaQueryWrapper<TUserSession>()
                .eq(TUserSession::getSessionId, sessionId));
        if (session == null) {
            throw new BusinessException(404, "会话不存在");
        }

        List<TUserCheckin> checkins = userCheckinMapper.selectList(
                new LambdaQueryWrapper<TUserCheckin>()
                        .eq(TUserCheckin::getSessionId, sessionId)
                        .orderByDesc(TUserCheckin::getCreateTime));

        List<TUserFavorite> favorites = userFavoriteMapper.selectList(
                new LambdaQueryWrapper<TUserFavorite>()
                        .eq(TUserFavorite::getSessionId, sessionId)
                        .orderByDesc(TUserFavorite::getCreateTime));

        session.setTotalCheckin(checkins.size());
        session.setTotalRoute((int) favorites.stream()
                .filter(f -> Integer.valueOf(2).equals(f.getFavoriteType())).count());

        Map<String, Object> detail = new HashMap<>();
        detail.put("session", session);
        detail.put("checkins", checkins);
        detail.put("favorites", favorites);
        return detail;
    }

    @Override
    public TUserSession updateSessionByAdmin(String sessionId, TUserSession changes) {
        TUserSession session = getOne(new LambdaQueryWrapper<TUserSession>()
                .eq(TUserSession::getSessionId, sessionId));
        if (session == null) {
            throw new BusinessException(404, "会话不存在");
        }
        if (changes.getVirtualName() != null) session.setVirtualName(changes.getVirtualName().trim());
        if (changes.getUserMode() != null) session.setUserMode(changes.getUserMode());
        if (changes.getVirtualCollege() != null) session.setVirtualCollege(changes.getVirtualCollege().trim());
        if (changes.getVirtualMajor() != null) session.setVirtualMajor(changes.getVirtualMajor().trim());
        if (changes.getVirtualYear() != null) session.setVirtualYear(changes.getVirtualYear());
        updateById(session);
        return session;
    }

    @Override
    public TUserSession updateSessionStatus(String sessionId, Integer status) {
        validateStatus(status);
        TUserSession session = getOne(new LambdaQueryWrapper<TUserSession>()
                .eq(TUserSession::getSessionId, sessionId));
        if (session == null) {
            throw new BusinessException(404, "会话不存在");
        }
        session.setStatus(status);
        updateById(session);
        return session;
    }

    @Override
    public void deleteSessionByAdmin(String sessionId) {
        TUserSession session = getOne(new LambdaQueryWrapper<TUserSession>()
                .eq(TUserSession::getSessionId, sessionId));
        if (session == null) {
            throw new BusinessException(404, "会话不存在");
        }
        session.setStatus(0);
        updateById(session);
    }

    // ==================== 用户-会话绑定 ====================

    /**
     * 生成注册用户的确定性 sessionId（一个用户始终对应同一个 session）
     */
    private String deterministicSessionId(Long userId) {
        return UUID.nameUUIDFromBytes(("USER_" + userId).getBytes(StandardCharsets.UTF_8)).toString();
    }

    @Override
    public TUserSession getOrCreateUserSession(Long userId, TUser user) {
        String canonicalId = deterministicSessionId(userId);
        TUserSession session = getOne(new LambdaQueryWrapper<TUserSession>()
                .eq(TUserSession::getSessionId, canonicalId));
        String authoritativeMode = user.getUserMode() != null ? user.getUserMode() : "fresh";
        if (session == null) {
            session = new TUserSession();
            session.setSessionId(canonicalId);
            session.setUserId(userId);
            session.setUserMode(authoritativeMode);
            session.setVirtualName(user.getNickname() != null ? user.getNickname() : user.getUsername());
            session.setVirtualYear(user.getGrade() != null ? user.getGrade() : 2025);
            session.setVirtualCollege(user.getCollege() != null ? user.getCollege() : "未知学院");
            session.setVirtualMajor(user.getMajor() != null ? user.getMajor() : "未知专业");
            session.setTotalCheckin(0);
            session.setTotalRoute(0);
            session.setStatus(1);
            save(session);
            log.info("为用户 {} 创建规范会话 {}", userId, canonicalId);
        } else {
            // 确保 session.userMode 与用户权威身份同步（防止旧 session 保留过期身份）
            if (!authoritativeMode.equals(session.getUserMode())) {
                session.setUserMode(authoritativeMode);
                updateById(session);
                log.info("已同步会话 {} 的身份模式为 {}", canonicalId, authoritativeMode);
            }
            // 确保 userId 已设置（兼容历史数据）
            if (session.getUserId() == null) {
                session.setUserId(userId);
                updateById(session);
            }
            // 同步用户最新信息
            session.setVirtualName(user.getNickname() != null ? user.getNickname() : user.getUsername());
            session.setUserMode(user.getUserMode() != null ? user.getUserMode() : session.getUserMode());
            session.setVirtualCollege(user.getCollege() != null ? user.getCollege() : session.getVirtualCollege());
            session.setVirtualMajor(user.getMajor() != null ? user.getMajor() : session.getVirtualMajor());
            session.setVirtualYear(user.getGrade() != null ? user.getGrade() : session.getVirtualYear());
            updateById(session);
        }
        return session;
    }

    @Override
    public TUserSession bindUserToSession(String sessionId, Long userId, TUser user) {
        // 获取或创建用户规范会话
        TUserSession canonicalSession = getOrCreateUserSession(userId, user);

        // 如果没有当前 sessionId，直接返回规范会话（无需迁移）
        if (sessionId == null || sessionId.isBlank()) {
            return canonicalSession;
        }

        // 如果当前 sessionId 就是规范 sessionId，无需迁移
        if (canonicalSession.getSessionId().equals(sessionId)) {
            return canonicalSession;
        }

        // 查找当前 session（游客会话）
        TUserSession currentSession = getOne(new LambdaQueryWrapper<TUserSession>()
                .eq(TUserSession::getSessionId, sessionId));

        if (currentSession != null) {
            // 检查当前 session 是否已绑定其他用户
            if (currentSession.getUserId() != null && !currentSession.getUserId().equals(userId)) {
                throw new BusinessException(409, "当前会话已绑定其他账号，请刷新页面后重试");
            }

            // 将游客会话数据迁移到规范会话
            if (currentSession.getUserId() == null) {
                migrateSessionData(sessionId, canonicalSession.getSessionId());
                log.info("游客会话 {} 数据已迁移到用户 {} 的规范会话 {}", sessionId, userId, canonicalSession.getSessionId());
            }
        }

        return canonicalSession;
    }

    @Override
    public void migrateSessionData(String fromSessionId, String toSessionId) {
        if (fromSessionId.equals(toSessionId)) return;

        log.info("迁移会话数据: {} -> {}", fromSessionId, toSessionId);

        // 聊天历史
        userChatHistoryMapper.update(null, new LambdaUpdateWrapper<TUserChatHistory>()
                .eq(TUserChatHistory::getSessionId, fromSessionId)
                .set(TUserChatHistory::getSessionId, toSessionId));

        // 收藏
        userFavoriteMapper.update(null, new LambdaUpdateWrapper<TUserFavorite>()
                .eq(TUserFavorite::getSessionId, fromSessionId)
                .set(TUserFavorite::getSessionId, toSessionId));

        // 数字人配置 - 检查目标是否存在，不存在才迁移
        long targetConfigCount = userDigitalHumanConfigMapper.selectCount(
                new LambdaQueryWrapper<TUserDigitalHumanConfig>()
                        .eq(TUserDigitalHumanConfig::getSessionId, toSessionId));
        if (targetConfigCount == 0) {
            userDigitalHumanConfigMapper.update(null, new LambdaUpdateWrapper<TUserDigitalHumanConfig>()
                    .eq(TUserDigitalHumanConfig::getSessionId, fromSessionId)
                    .set(TUserDigitalHumanConfig::getSessionId, toSessionId));
        }

        // 打卡记录
        userCheckinMapper.update(null, new LambdaUpdateWrapper<TUserCheckin>()
                .eq(TUserCheckin::getSessionId, fromSessionId)
                .set(TUserCheckin::getSessionId, toSessionId));

        // 活动预约
        userActivityReserveMapper.update(null, new LambdaUpdateWrapper<TUserActivityReserve>()
                .eq(TUserActivityReserve::getSessionId, fromSessionId)
                .set(TUserActivityReserve::getSessionId, toSessionId));

        // 用户徽章
        userBadgeRelationMapper.update(null, new LambdaUpdateWrapper<TUserBadgeRelation>()
                .eq(TUserBadgeRelation::getSessionId, fromSessionId)
                .set(TUserBadgeRelation::getSessionId, toSessionId));

        // 用户投稿
        userContentApplicationMapper.update(null, new LambdaUpdateWrapper<TUserContentApplication>()
                .eq(TUserContentApplication::getSessionId, fromSessionId)
                .set(TUserContentApplication::getSessionId, toSessionId));

        // 用户反馈
        userFeedbackMapper.update(null, new LambdaUpdateWrapper<TUserFeedback>()
                .eq(TUserFeedback::getSessionId, fromSessionId)
                .set(TUserFeedback::getSessionId, toSessionId));

        // 用户私人消息
        userMessageMapper.update(null, new LambdaUpdateWrapper<TUserMessage>()
                .eq(TUserMessage::getSessionId, fromSessionId)
                .set(TUserMessage::getSessionId, toSessionId));

        // 用户消息状态
        userMessageStateMapper.update(null, new LambdaUpdateWrapper<TUserMessageState>()
                .eq(TUserMessageState::getSessionId, fromSessionId)
                .set(TUserMessageState::getSessionId, toSessionId));

        // 个人路线
        userPersonalRouteMapper.update(null, new LambdaUpdateWrapper<TUserPersonalRoute>()
                .eq(TUserPersonalRoute::getSessionId, fromSessionId)
                .set(TUserPersonalRoute::getSessionId, toSessionId));
    }

    private void validateStatus(Integer status) {
        if (!Integer.valueOf(0).equals(status) && !Integer.valueOf(1).equals(status)) {
            throw new BusinessException(400, "会话状态只能为启用或停用");
        }
    }
}
