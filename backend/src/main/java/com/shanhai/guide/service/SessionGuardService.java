package com.shanhai.guide.service;

import com.shanhai.guide.entity.TUserSession;

/** 用户端受限业务的统一会话与账号状态校验。 */
public interface SessionGuardService {

    /** 校验会话，并在绑定正式账号时同步校验账号状态。 */
    TUserSession validateActiveSession(String sessionId);

    /** 校验可执行受限操作的身份；普通游客只能浏览公开内容。 */
    TUserSession requireActiveUserAction(String sessionId);
}
