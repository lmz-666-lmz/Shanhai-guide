package com.shanhai.guide.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.shanhai.guide.entity.TUser;
import com.shanhai.guide.entity.TUserSession;
import com.shanhai.guide.exception.BusinessException;
import com.shanhai.guide.mapper.UserMapper;
import com.shanhai.guide.mapper.UserSessionMapper;
import com.shanhai.guide.service.SessionGuardService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class SessionGuardServiceImpl implements SessionGuardService {

    private static final Logger log = LoggerFactory.getLogger(SessionGuardServiceImpl.class);

    private final UserSessionMapper userSessionMapper;
    private final UserMapper userMapper;

    public SessionGuardServiceImpl(UserSessionMapper userSessionMapper, UserMapper userMapper) {
        this.userSessionMapper = userSessionMapper;
        this.userMapper = userMapper;
    }

    @Override
    public TUserSession validateActiveSession(String sessionId) {
        if (sessionId == null || sessionId.isBlank()) {
            throw new BusinessException(401, "请先登录或创建数字身份");
        }
        TUserSession session = userSessionMapper.selectOne(new LambdaQueryWrapper<TUserSession>()
                .eq(TUserSession::getSessionId, sessionId));
        if (session == null || Integer.valueOf(0).equals(session.getStatus())) {
            throw new BusinessException(401, "当前访问会话已停用，请重新登录或创建数字身份");
        }

        // 通过 userId 直接验证关联用户状态，并同步身份字段
        if (session.getUserId() != null) {
            TUser user = userMapper.selectById(session.getUserId());
            if (user == null) {
                throw new BusinessException(401, "关联用户不存在，请重新登录");
            }
            if (!Integer.valueOf(1).equals(user.getStatus())) {
                throw new BusinessException(401, "当前账号已被禁用，请联系管理员");
            }
            // 每次验证会话时同步 session 字段与权威 t_user 记录
            // 涵盖管理员修改用户资料后用户端自动同步的场景
            boolean changed = false;
            if (user.getUserMode() != null && !user.getUserMode().equals(session.getUserMode())) {
                session.setUserMode(user.getUserMode());
                changed = true;
            }
            if (user.getNickname() != null && !user.getNickname().equals(session.getVirtualName())) {
                session.setVirtualName(user.getNickname());
                changed = true;
            }
            if (user.getCollege() != null && !user.getCollege().equals(session.getVirtualCollege())) {
                session.setVirtualCollege(user.getCollege());
                changed = true;
            }
            if (user.getMajor() != null && !user.getMajor().equals(session.getVirtualMajor())) {
                session.setVirtualMajor(user.getMajor());
                changed = true;
            }
            if (user.getGrade() != null && !Integer.valueOf(user.getGrade()).equals(session.getVirtualYear())) {
                session.setVirtualYear(user.getGrade());
                changed = true;
            }
            if (changed) {
                log.info("validateActiveSession 同步用户资料：session {} userId={}", sessionId, user.getId());
                userSessionMapper.updateById(session);
            }
        }

        return session;
    }

    @Override
    public TUserSession requireActiveUserAction(String sessionId) {
        TUserSession session = validateActiveSession(sessionId);
        if ("guest".equals(session.getUserMode())) {
            throw new BusinessException(403, "普通游客仅可浏览，请登录或创建数字身份后使用此功能");
        }
        return session;
    }
}
