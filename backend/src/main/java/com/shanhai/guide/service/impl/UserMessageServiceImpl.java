package com.shanhai.guide.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.shanhai.guide.entity.TUserMessage;
import com.shanhai.guide.entity.TUserMessageState;
import com.shanhai.guide.entity.TUserSession;
import com.shanhai.guide.entity.dto.UserMessageView;
import com.shanhai.guide.exception.BusinessException;
import com.shanhai.guide.mapper.UserMessageMapper;
import com.shanhai.guide.mapper.UserMessageStateMapper;
import com.shanhai.guide.service.SessionGuardService;
import com.shanhai.guide.service.UserMessageService;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
public class UserMessageServiceImpl extends ServiceImpl<UserMessageMapper, TUserMessage> implements UserMessageService {

    private final UserMessageStateMapper stateMapper;
    private final SessionGuardService sessionGuardService;

    public UserMessageServiceImpl(UserMessageStateMapper stateMapper, SessionGuardService sessionGuardService) {
        this.stateMapper = stateMapper;
        this.sessionGuardService = sessionGuardService;
    }

    @Override
    public Map<String, Object> getMessages(String sessionId, int page, int pageSize) {
        TUserSession session = sessionGuardService.validateActiveSession(sessionId);
        List<UserMessageView> visible = loadVisibleMessages(session);
        int safePage = Math.max(page, 1);
        int safeSize = Math.max(Math.min(pageSize, 100), 1);
        int from = Math.min((safePage - 1) * safeSize, visible.size());
        int to = Math.min(from + safeSize, visible.size());

        Map<String, Object> result = new HashMap<>();
        result.put("records", visible.subList(from, to));
        result.put("total", visible.size());
        result.put("page", safePage);
        result.put("pageSize", safeSize);
        return result;
    }

    @Override
    public long getUnreadCount(String sessionId) {
        TUserSession session = sessionGuardService.validateActiveSession(sessionId);
        return loadVisibleMessages(session).stream()
                .filter(item -> !Integer.valueOf(1).equals(item.getReadStatus()))
                .count();
    }

    @Override
    public void markRead(String sessionId, Long messageId) {
        getVisibleMessage(sessionId, messageId);
        upsertState(sessionId, messageId, 1, null);
    }

    @Override
    public void markAllRead(String sessionId) {
        TUserSession session = sessionGuardService.validateActiveSession(sessionId);
        loadVisibleMessages(session).forEach(item -> upsertState(sessionId, item.getId(), 1, null));
    }

    @Override
    public void hideMessage(String sessionId, Long messageId) {
        getVisibleMessage(sessionId, messageId);
        upsertState(sessionId, messageId, 1, 1);
    }

    @Override
    public UserMessageView getVisibleMessage(String sessionId, Long messageId) {
        TUserSession session = sessionGuardService.validateActiveSession(sessionId);
        return loadVisibleMessages(session).stream()
                .filter(item -> Objects.equals(item.getId(), messageId))
                .findFirst()
                .orElseThrow(() -> new BusinessException(404, "消息不存在"));
    }

    @Override
    public TUserMessage createMessage(String targetType, String sessionId, String userMode, String messageType,
                                      String title, String content, String sourceType, Long sourceId, String sourceEvent) {
        if (sourceType != null && sourceId != null && messageType != null && sourceEvent != null) {
            LambdaQueryWrapper<TUserMessage> existingWrapper = new LambdaQueryWrapper<TUserMessage>()
                    .eq(TUserMessage::getSourceType, sourceType)
                    .eq(TUserMessage::getSourceId, sourceId)
                    .eq(TUserMessage::getMessageType, messageType)
                    .eq(TUserMessage::getSourceEvent, sourceEvent);
            if ("personal".equals(targetType)) {
                existingWrapper.eq(TUserMessage::getSessionId, sessionId);
            }
            TUserMessage existing = getOne(existingWrapper, false);
            if (existing != null) return existing;
        }
        TUserMessage message = new TUserMessage();
        message.setTargetType(targetType == null || targetType.isBlank() ? "personal" : targetType);
        message.setSessionId(sessionId);
        message.setUserMode(userMode);
        message.setMessageType(messageType);
        message.setTitle(title);
        message.setContent(content);
        message.setSourceType(sourceType);
        message.setSourceId(sourceId);
        message.setSourceEvent(sourceEvent);
        save(message);
        return message;
    }

    private List<UserMessageView> loadVisibleMessages(TUserSession session) {
        List<TUserMessage> candidates = list(new LambdaQueryWrapper<TUserMessage>().orderByDesc(TUserMessage::getCreateTime));
        List<Long> ids = candidates.stream().map(TUserMessage::getId).filter(Objects::nonNull).toList();
        Map<Long, TUserMessageState> statesByMessageId = new HashMap<>();
        if (!ids.isEmpty()) {
            stateMapper.selectList(new LambdaQueryWrapper<TUserMessageState>()
                    .eq(TUserMessageState::getSessionId, session.getSessionId())
                    .in(TUserMessageState::getMessageId, ids))
                    .forEach(state -> statesByMessageId.put(state.getMessageId(), state));
        }
        return candidates.stream()
                .filter(message -> isMessageTargeted(message, session))
                .map(message -> toView(message, statesByMessageId.get(message.getId())))
                .filter(view -> !Integer.valueOf(1).equals(view.getIsDeleted()))
                .sorted(Comparator.comparing(UserMessageView::getCreateTime, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
    }

    private boolean isMessageTargeted(TUserMessage message, TUserSession session) {
        String targetType = message.getTargetType() == null ? "personal" : message.getTargetType();
        if ("public".equals(targetType)) return true;
        if ("mode".equals(targetType)) {
            String mode = message.getUserMode();
            return mode == null || mode.isBlank() || mode.contains(session.getUserMode());
        }
        return Objects.equals(message.getSessionId(), session.getSessionId());
    }

    private UserMessageView toView(TUserMessage message, TUserMessageState state) {
        UserMessageView view = new UserMessageView();
        view.setId(message.getId());
        view.setTargetType(message.getTargetType());
        view.setSessionId(message.getSessionId());
        view.setUserMode(message.getUserMode());
        view.setMessageType(message.getMessageType());
        view.setTitle(message.getTitle());
        view.setContent(message.getContent());
        view.setSourceType(message.getSourceType());
        view.setSourceId(message.getSourceId());
        view.setSourceEvent(message.getSourceEvent());
        view.setCreateTime(message.getCreateTime());
        view.setUpdateTime(message.getUpdateTime());
        view.setReadStatus(state == null ? 0 : state.getReadStatus());
        view.setIsDeleted(state == null ? 0 : state.getIsDeleted());
        view.setReadTime(state == null ? null : state.getReadTime());
        return view;
    }

    private void upsertState(String sessionId, Long messageId, Integer readStatus, Integer isDeleted) {
        TUserMessageState state = stateMapper.selectOne(new LambdaQueryWrapper<TUserMessageState>()
                .eq(TUserMessageState::getSessionId, sessionId)
                .eq(TUserMessageState::getMessageId, messageId));
        if (state == null) {
            state = new TUserMessageState();
            state.setSessionId(sessionId);
            state.setMessageId(messageId);
            state.setReadStatus(readStatus == null ? 0 : readStatus);
            state.setIsDeleted(isDeleted == null ? 0 : isDeleted);
            if (Integer.valueOf(1).equals(readStatus)) state.setReadTime(LocalDateTime.now());
            stateMapper.insert(state);
            return;
        }
        if (readStatus != null) {
            state.setReadStatus(readStatus);
            if (Integer.valueOf(1).equals(readStatus)) state.setReadTime(LocalDateTime.now());
        }
        if (isDeleted != null) state.setIsDeleted(isDeleted);
        stateMapper.updateById(state);
    }
}
