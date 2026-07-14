package com.shanhai.guide.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.shanhai.guide.entity.TUserFeedback;

import java.util.List;

public interface UserFeedbackService extends IService<TUserFeedback> {

    void submitFeedback(String sessionId, String userMode, Integer score, String feedbackType, String feedbackContent);

    List<TUserFeedback> getUserFeedbacks(String sessionId);
}