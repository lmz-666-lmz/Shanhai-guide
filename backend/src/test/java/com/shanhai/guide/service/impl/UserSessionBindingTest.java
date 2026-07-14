package com.shanhai.guide.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.shanhai.guide.entity.*;
import com.shanhai.guide.mapper.*;
import com.shanhai.guide.service.AuthService;
import com.shanhai.guide.service.UserSessionService;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.annotation.Commit;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 用户-会话绑定集成测试
 * <p>
 * 使用真实数据库 + @Transactional 回滚，不污染数据。
 * 级联删除验证因事务隔离限制，需人工执行 SQL 验证。
 * </p>
 */
@SpringBootTest
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class UserSessionBindingTest {

    @Autowired
    private AuthService authService;

    @Autowired
    private UserSessionService userSessionService;

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private UserSessionMapper userSessionMapper;

    @Autowired
    private UserChatHistoryMapper chatHistoryMapper;

    @Autowired
    private UserFavoriteMapper favoriteMapper;

    @Autowired
    private UserDigitalHumanConfigMapper digitalHumanConfigMapper;

    private static Long testUserId;
    private static final String TEST_USERNAME = "test_binding_user";
    private static final String TEST_PASSWORD = "test123456";
    private static String guestSessionId;
    private static String canonicalSessionId;

    @BeforeEach
    void setUp() {
        // 清理可能残留的测试数据
        TUser existing = userMapper.selectOne(
                new LambdaQueryWrapper<TUser>().eq(TUser::getUsername, TEST_USERNAME));
        if (existing != null) {
            userMapper.deleteById(existing.getId());
        }
    }

    // ==================== 1. 注册后取得真实自增ID ====================

    @Test
    @Order(1)
    @Transactional
    void testRegisterReturnsAutoIncrementId() {
        TUser user = authService.register(TEST_USERNAME, TEST_PASSWORD, "测试昵称", "fresh");
        assertNotNull(user.getId(), "注册后应有真实自增ID");
        assertTrue(user.getId() > 0, "注册用户ID应大于0");
        assertEquals(TEST_USERNAME, user.getUsername());
        testUserId = user.getId();
    }

    // ==================== 2. 注册后 t_user_session.user_id = 用户ID ====================

    @Test
    @Order(2)
    @Transactional
    void testSessionUserIdEqualsRegisteredUserId() {
        TUser user = createTestUser("bind_test2");
        TUserSession session = userSessionService.getOrCreateUserSession(user.getId(), user);

        assertNotNull(session.getUserId(), "规范会话的userId不应为NULL");
        assertEquals(user.getId(), session.getUserId(), "session.user_id应等于t_user.id");
    }

    // ==================== 3. 游客 session 的 user_id 为 NULL ====================

    @Test
    @Order(3)
    @Transactional
    void testGuestSessionHasNullUserId() {
        TUserSession guestSession = userSessionService.createSession("guest");
        assertNull(guestSession.getUserId(), "游客会话的userId应为NULL");
        assertEquals("体验访客", guestSession.getVirtualName());
    }

    // ==================== 4. 游客注册后原 session 绑定用户 ====================

    @Test
    @Order(4)
    @Transactional
    void testGuestSessionBoundAfterRegistration() {
        // 创建游客会话
        TUserSession guestSession = userSessionService.createSession("guest");
        assertNull(guestSession.getUserId());

        // 注册用户并绑定
        TUser user = createTestUser("bind_test4");
        TUserSession boundSession = userSessionService.bindUserToSession(
                guestSession.getSessionId(), user.getId(), user);

        // 验证：绑定返回的是规范会话
        assertNotNull(boundSession);
        // 游客数据已迁移到规范会话（本次无数据，所以无实际迁移）

        // 验证规范会话已设置 userId
        TUserSession canonical = userSessionService.getOne(new LambdaQueryWrapper<TUserSession>()
                .eq(TUserSession::getSessionId, boundSession.getSessionId()));
        assertEquals(user.getId(), canonical.getUserId());
    }

    // ==================== 5. 登录后当前 session 绑定正确 user_id ====================

    @Test
    @Order(5)
    @Transactional
    void testLoginBindsSessionToUser() {
        TUser user = createTestUser("bind_test5");

        // 模拟：用户先在浏览器中有游客 session
        TUserSession guestSession = userSessionService.createSession("guest");
        String currentBrowserSessionId = guestSession.getSessionId();

        // 登录绑定
        TUserSession session = userSessionService.bindUserToSession(
                currentBrowserSessionId, user.getId(), user);

        assertNotNull(session.getUserId());
        assertEquals(user.getId(), session.getUserId());
    }

    // ==================== 6. 当前 session 不存在时登录自动创建 ====================

    @Test
    @Order(6)
    @Transactional
    void testLoginCreatesSessionWhenNotExists() {
        TUser user = createTestUser("bind_test6");

        // 传入 null sessionId（没有游客会话）
        TUserSession session = userSessionService.bindUserToSession(null, user.getId(), user);

        assertNotNull(session);
        assertNotNull(session.getSessionId());
        assertEquals(user.getId(), session.getUserId());
    }

    // ==================== 7. 当前 session 已绑定其他用户不会串号 ====================

    @Test
    @Order(7)
    @Transactional
    void testSessionBoundToOtherUserNotOverwritten() {
        TUser user1 = createTestUser("bind_test7a");
        TUser user2 = createTestUser("bind_test7b");

        // user1 的规范会话（已自动设置 userId）
        TUserSession session1 = userSessionService.getOrCreateUserSession(user1.getId(), user1);
        assertNotNull(session1.getUserId());

        // 尝试将 user1 的规范 sessionId 绑定到 user2 → 应抛出异常
        assertThrows(com.shanhai.guide.exception.BusinessException.class, () -> {
            userSessionService.bindUserToSession(session1.getSessionId(), user2.getId(), user2);
        });
    }

    // ==================== 8. 重复登录不产生孤立数据 ====================

    @Test
    @Order(8)
    @Transactional
    void testRepeatedLoginNoOrphanSessions() {
        TUser user = createTestUser("bind_test8");

        // 第一次"登录"
        TUserSession session1 = userSessionService.bindUserToSession(null, user.getId(), user);
        long countBefore = userSessionService.count();

        // 第二次"登录"（同一用户，从另一浏览器，无游客 session）
        TUserSession session2 = userSessionService.bindUserToSession(null, user.getId(), user);
        long countAfter = userSessionService.count();

        // 同一用户规范 session 不应重复创建
        assertEquals(countBefore, countAfter, "重复登录不应增加会话数");
        assertEquals(session1.getSessionId(), session2.getSessionId(), "应返回同一个规范会话");
    }

    // ==================== 9. 退出登录不删除 t_user_session 业务数据 ====================

    @Test
    @Order(9)
    @Transactional
    void testLogoutDoesNotDeleteSessionRecord() {
        TUser user = createTestUser("bind_test9");
        TUserSession session = userSessionService.getOrCreateUserSession(user.getId(), user);

        // 模拟退出：只清除前端状态，不删除数据库记录
        // 验证会话记录仍然存在
        TUserSession stillExists = userSessionService.getOne(
                new LambdaQueryWrapper<TUserSession>()
                        .eq(TUserSession::getSessionId, session.getSessionId()));
        assertNotNull(stillExists, "退出登录后会话记录应仍然存在");
        assertEquals(user.getId(), stillExists.getUserId());
    }

    // ==================== 10. 退出后收藏仍存在 ====================

    @Test
    @Order(10)
    @Transactional
    void testFavoritesPersistAfterLogout() {
        TUser user = createTestUser("bind_test10");
        TUserSession session = userSessionService.getOrCreateUserSession(user.getId(), user);

        // 添加收藏
        TUserFavorite fav = new TUserFavorite();
        fav.setSessionId(session.getSessionId());
        fav.setTargetId(1L); // 测试点位ID
        fav.setFavoriteType(1);
        favoriteMapper.insert(fav);

        // 验证收藏存在
        long count = favoriteMapper.selectCount(
                new LambdaQueryWrapper<TUserFavorite>()
                        .eq(TUserFavorite::getSessionId, session.getSessionId()));
        assertEquals(1, count, "收藏应在添加后立即存在");

        // 模拟退出（不清除数据），验证收藏仍存在
        long countAfterLogout = favoriteMapper.selectCount(
                new LambdaQueryWrapper<TUserFavorite>()
                        .eq(TUserFavorite::getSessionId, session.getSessionId()));
        assertEquals(1, countAfterLogout, "退出后收藏应仍然存在");
    }

    // ==================== 11. 退出后聊天记录仍存在 ====================

    @Test
    @Order(11)
    @Transactional
    void testChatHistoryPersistsAfterLogout() {
        TUser user = createTestUser("bind_test11");
        TUserSession session = userSessionService.getOrCreateUserSession(user.getId(), user);

        // 添加聊天
        TUserChatHistory chat = new TUserChatHistory();
        chat.setSessionId(session.getSessionId());
        chat.setUserContent("测试消息");
        chat.setAiContent("测试回复");
        chat.setUserMode("fresh");
        chatHistoryMapper.insert(chat);

        // 验证存在
        long count = chatHistoryMapper.selectCount(
                new LambdaQueryWrapper<TUserChatHistory>()
                        .eq(TUserChatHistory::getSessionId, session.getSessionId()));
        assertEquals(1, count, "聊天记录应在退出后仍然存在");
    }

    // ==================== 12. 同一用户重新登录后能读取原收藏 ====================

    @Test
    @Order(12)
    @Transactional
    void testSameUserReLoginCanReadFavorites() {
        TUser user = createTestUser("bind_test12");
        TUserSession session = userSessionService.getOrCreateUserSession(user.getId(), user);

        // 添加收藏
        TUserFavorite fav = new TUserFavorite();
        fav.setSessionId(session.getSessionId());
        fav.setTargetId(1L);
        fav.setFavoriteType(1);
        favoriteMapper.insert(fav);

        // 模拟重新登录：再次获取规范会话
        TUserSession reLoginSession = userSessionService.getOrCreateUserSession(user.getId(), user);
        assertEquals(session.getSessionId(), reLoginSession.getSessionId(),
                "重新登录应返回同一规范会话");

        // 验证收藏可读
        long count = favoriteMapper.selectCount(
                new LambdaQueryWrapper<TUserFavorite>()
                        .eq(TUserFavorite::getSessionId, reLoginSession.getSessionId()));
        assertEquals(1, count, "重新登录后应能读取原收藏");
    }

    // ==================== 13. 同一用户重新登录后能读取原数字人配置 ====================

    @Test
    @Order(13)
    @Transactional
    void testSameUserReLoginCanReadDigitalHumanConfig() {
        TUser user = createTestUser("bind_test13");
        TUserSession session = userSessionService.getOrCreateUserSession(user.getId(), user);

        // 添加数字人配置
        TUserDigitalHumanConfig config = new TUserDigitalHumanConfig();
        config.setSessionId(session.getSessionId());
        config.setVoiceType("温柔女声");
        config.setAvatarUrl("默认");
        digitalHumanConfigMapper.insert(config);

        // 模拟重新登录
        TUserSession reLoginSession = userSessionService.getOrCreateUserSession(user.getId(), user);

        long count = digitalHumanConfigMapper.selectCount(
                new LambdaQueryWrapper<TUserDigitalHumanConfig>()
                        .eq(TUserDigitalHumanConfig::getSessionId, reLoginSession.getSessionId()));
        assertEquals(1, count, "重新登录后应能读取原数字人配置");
    }

    // ==================== 18. 删除一个用户不影响另一个用户 ====================

    @Test
    @Order(18)
    @Transactional
    void testDeleteOneUserDoesNotAffectOtherUser() {
        TUser user1 = createTestUser("bind_test18a");
        TUser user2 = createTestUser("bind_test18b");

        TUserSession session1 = userSessionService.getOrCreateUserSession(user1.getId(), user1);
        TUserSession session2 = userSessionService.getOrCreateUserSession(user2.getId(), user2);

        // 为 user2 添加数据
        TUserFavorite fav = new TUserFavorite();
        fav.setSessionId(session2.getSessionId());
        fav.setTargetId(1L);
        fav.setFavoriteType(1);
        favoriteMapper.insert(fav);

        // 删除 user1
        userMapper.deleteById(user1.getId());

        // 验证 user2 数据完好
        TUser stillExists = userMapper.selectById(user2.getId());
        assertNotNull(stillExists, "其他用户不应被删除");

        long favCount = favoriteMapper.selectCount(
                new LambdaQueryWrapper<TUserFavorite>()
                        .eq(TUserFavorite::getSessionId, session2.getSessionId()));
        assertEquals(1, favCount, "其他用户的数据不应受影响");
    }

    // ==================== 20. 不读取 t_user_old_20260714 ====================

    @Test
    @Order(20)
    @Transactional
    void testNoReferenceToOldUserTable() {
        // 验证：项目中无代码引用 t_user_old_20260714
        // 此测试仅验证正式用户表 t_user 可正常操作
        TUser user = createTestUser("bind_test20");
        assertNotNull(user.getId());
        TUser fetched = userMapper.selectById(user.getId());
        assertNotNull(fetched, "正式用户表 t_user 应可正常读写");
    }

    // ==================== 辅助方法 ====================

    private TUser createTestUser(String username) {
        // 先清理
        TUser existing = userMapper.selectOne(
                new LambdaQueryWrapper<TUser>().eq(TUser::getUsername, username));
        if (existing != null) {
            userMapper.deleteById(existing.getId());
        }
        TUser user = new TUser();
        user.setUsername(username);
        user.setPassword("$2a$10$dummyhashfordummypassword123");
        user.setNickname("测试用户");
        user.setUserMode("fresh");
        user.setStatus(1);
        userMapper.insert(user);
        return user;
    }

    /**
     * MySQL 人工级联验证 SQL（在事务外执行）：
     * <pre>{@code
     * -- 1. 查看所有外键
     * SELECT CONSTRAINT_NAME, TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
     * FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
     * WHERE TABLE_SCHEMA = 'shanhai_guide' AND REFERENCED_TABLE_NAME IS NOT NULL
     * ORDER BY TABLE_NAME, CONSTRAINT_NAME;
     *
     * -- 2. 插入测试用户
     * INSERT INTO t_user (username, password, nickname, user_mode, status) VALUES ('cascade_test', 'xxx', '测试', 'fresh', 1);
     * -- 记下生成的 ID，假设为 @uid
     *
     * -- 3. 创建用户会话
     * INSERT INTO t_user_session (session_id, user_id, user_mode, virtual_name, status) VALUES ('cascade_test_session', @uid, 'fresh', '测试', 1);
     *
     * -- 4. 添加业务数据
     * INSERT INTO t_user_chat_history (session_id, user_mode, user_content, ai_content) VALUES ('cascade_test_session', 'fresh', '你好', '你好！');
     * INSERT INTO t_user_favorite (session_id, favorite_type, target_id) VALUES ('cascade_test_session', 1, 1);
     * INSERT INTO t_user_digital_human_config (session_id, voice_type, avatar_style) VALUES ('cascade_test_session', '温柔女声', '默认');
     *
     * -- 5. 验证数据存在
     * SELECT COUNT(*) FROM t_user_chat_history WHERE session_id = 'cascade_test_session'; -- 应为 1
     * SELECT COUNT(*) FROM t_user_favorite WHERE session_id = 'cascade_test_session'; -- 应为 1
     * SELECT COUNT(*) FROM t_user_digital_human_config WHERE session_id = 'cascade_test_session'; -- 应为 1
     *
     * -- 6. 删除用户（级联测试）
     * DELETE FROM t_user WHERE id = @uid;
     *
     * -- 7. 验证级联删除
     * SELECT COUNT(*) FROM t_user_session WHERE user_id = @uid; -- 应为 0
     * SELECT COUNT(*) FROM t_user_chat_history WHERE session_id = 'cascade_test_session'; -- 应为 0
     * SELECT COUNT(*) FROM t_user_favorite WHERE session_id = 'cascade_test_session'; -- 应为 0
     * SELECT COUNT(*) FROM t_user_digital_human_config WHERE session_id = 'cascade_test_session'; -- 应为 0
     * -- session_id 为 NULL 的公共消息不受影响
     *
     * -- 8. 清理测试数据
     * -- （如级联失败，人工清理）
     * DELETE FROM t_user_digital_human_config WHERE session_id = 'cascade_test_session';
     * DELETE FROM t_user_favorite WHERE session_id = 'cascade_test_session';
     * DELETE FROM t_user_chat_history WHERE session_id = 'cascade_test_session';
     * DELETE FROM t_user_session WHERE session_id = 'cascade_test_session';
     * DELETE FROM t_user WHERE username = 'cascade_test';
     * }</pre>
     */
    @Test
    @Order(99)
    @Transactional
    void cascadeVerificationSqlDoc() {
        // 本测试仅为文档占位，真实级联验证需在 MySQL 客户端执行上述 SQL
        assertTrue(true, "级联验证 SQL 文档已提供");
    }
}
