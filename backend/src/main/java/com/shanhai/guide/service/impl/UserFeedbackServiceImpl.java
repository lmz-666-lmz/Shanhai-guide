package com.shanhai.guide.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.shanhai.guide.entity.TUserFeedback;
import com.shanhai.guide.mapper.UserFeedbackMapper;
import com.shanhai.guide.service.UserFeedbackService;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class UserFeedbackServiceImpl extends ServiceImpl<UserFeedbackMapper, TUserFeedback> implements UserFeedbackService {

    @Override
    public void submitFeedback(String sessionId, String userMode, Integer score, String feedbackType, String feedbackContent) {
        TUserFeedback feedback = new TUserFeedback();
        feedback.setSessionId(sessionId);
        feedback.setUserMode(userMode);
        feedback.setScore(score);
        feedback.setFeedbackType(feedbackType);
        feedback.setFeedbackContent(feedbackContent);
        save(feedback);
    }

    @Override
    public List<TUserFeedback> getUserFeedbacks(String sessionId) {
        LambdaQueryWrapper<TUserFeedback> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TUserFeedback::getSessionId, sessionId)
               .orderByDesc(TUserFeedback::getCreateTime);
        return list(wrapper);
    }
}