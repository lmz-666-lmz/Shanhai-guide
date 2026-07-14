package com.shanhai.guide.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.shanhai.guide.entity.TUserContentApplication;

import java.util.List;

public interface UserContentApplicationService extends IService<TUserContentApplication> {

    TUserContentApplication submitSpotApplication(TUserContentApplication application);

    TUserContentApplication submitRouteApplication(TUserContentApplication application);

    List<TUserContentApplication> getMyApplications(String sessionId, String applicationType, Integer status);

    TUserContentApplication getMyApplication(String sessionId, Long applicationId);

    TUserContentApplication withdrawApplication(String sessionId, Long applicationId);

    List<TUserContentApplication> getAdminApplications(String applicationType, Integer status,
                                                       String keyword, String applicant,
                                                       String startTime, String endTime);

    TUserContentApplication approveApplication(Long applicationId, TUserContentApplication changes, String auditComment);

    TUserContentApplication rejectApplication(Long applicationId, String auditComment);
}
