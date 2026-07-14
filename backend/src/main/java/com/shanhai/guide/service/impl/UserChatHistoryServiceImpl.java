package com.shanhai.guide.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.shanhai.guide.entity.TUserChatHistory;
import com.shanhai.guide.mapper.UserChatHistoryMapper;
import com.shanhai.guide.service.UserChatHistoryService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class UserChatHistoryServiceImpl extends ServiceImpl<UserChatHistoryMapper, TUserChatHistory> implements UserChatHistoryService {

    private static final Logger log = LoggerFactory.getLogger(UserChatHistoryServiceImpl.class);

    @Override
    public void saveChat(String sessionId, String userMode, String userContent, String aiContent) {
        saveChat(sessionId, userMode, userContent, aiContent, null, "neutral");
    }

    @Override
    public void saveChat(String sessionId, String userMode, String userContent, String aiContent, String sourceInfo, String emotionTag) {
        saveChat(sessionId, userMode, userContent, aiContent, sourceInfo, emotionTag, "chat", null);
    }

    @Override
    public void saveChat(String sessionId, String userMode, String userContent, String aiContent,
                         String sourceInfo, String emotionTag, String messageType, String structuredPayload) {
        TUserChatHistory chat = new TUserChatHistory();
        chat.setSessionId(sessionId);
        chat.setUserMode(userMode);
        chat.setUserContent(userContent);
        chat.setAiContent(aiContent);
        chat.setSourceInfo(sourceInfo);
        chat.setEmotionTag(emotionTag == null || emotionTag.isBlank() ? "neutral" : emotionTag);
        chat.setMessageType(messageType == null || messageType.isBlank() ? "chat" : messageType);
        chat.setStructuredPayload(structuredPayload);
        save(chat);
    }

    @Override
    public List<TUserChatHistory> getChatHistory(String sessionId, Integer limit) {
        LambdaQueryWrapper<TUserChatHistory> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TUserChatHistory::getSessionId, sessionId)
               .orderByDesc(TUserChatHistory::getCreateTime);
        if (limit != null && limit > 0) {
            wrapper.last("LIMIT " + limit);
        }
        return list(wrapper);
    }

    @Override
    public int clearChatHistory(String sessionId) {
        log.info("清空聊天记录, sessionId={}", sessionId);
        LambdaQueryWrapper<TUserChatHistory> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TUserChatHistory::getSessionId, sessionId);
        int deleted = baseMapper.delete(wrapper);
        log.info("清空聊天记录完成, sessionId={}, 删除条数={}", sessionId, deleted);
        return deleted;
    }
}
