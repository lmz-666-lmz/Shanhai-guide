package com.shanhai.guide.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.shanhai.guide.entity.TUserChatHistory;

import java.util.List;

public interface UserChatHistoryService extends IService<TUserChatHistory> {

    void saveChat(String sessionId, String userMode, String userContent, String aiContent);

    void saveChat(String sessionId, String userMode, String userContent, String aiContent, String sourceInfo, String emotionTag);

    void saveChat(String sessionId, String userMode, String userContent, String aiContent,
                  String sourceInfo, String emotionTag, String messageType, String structuredPayload);

    List<TUserChatHistory> getChatHistory(String sessionId, Integer limit);

    /**
     * 清空指定会话的聊天记录
     * @param sessionId 会话ID
     * @return 删除的记录条数
     */
    int clearChatHistory(String sessionId);
}
