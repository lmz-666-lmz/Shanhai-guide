package com.shanhai.guide.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.shanhai.guide.entity.TUserMessage;
import com.shanhai.guide.entity.dto.UserMessageView;

import java.util.Map;

public interface UserMessageService extends IService<TUserMessage> {

    Map<String, Object> getMessages(String sessionId, int page, int pageSize);

    long getUnreadCount(String sessionId);

    void markRead(String sessionId, Long messageId);

    void markAllRead(String sessionId);

    void hideMessage(String sessionId, Long messageId);

    UserMessageView getVisibleMessage(String sessionId, Long messageId);

    TUserMessage createMessage(String targetType, String sessionId, String userMode, String messageType,
                               String title, String content, String sourceType, Long sourceId, String sourceEvent);
}
