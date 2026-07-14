package com.shanhai.guide.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.shanhai.guide.entity.TCampusRoute;
import com.shanhai.guide.entity.TCampusSpot;
import com.shanhai.guide.entity.TUserContentApplication;
import com.shanhai.guide.entity.TUserSession;
import com.shanhai.guide.exception.BusinessException;
import com.shanhai.guide.mapper.UserContentApplicationMapper;
import com.shanhai.guide.service.CampusRouteService;
import com.shanhai.guide.service.CampusSpotService;
import com.shanhai.guide.service.SessionGuardService;
import com.shanhai.guide.service.UserContentApplicationService;
import com.shanhai.guide.service.UserMessageService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

@Service
public class UserContentApplicationServiceImpl
        extends ServiceImpl<UserContentApplicationMapper, TUserContentApplication>
        implements UserContentApplicationService {

    private final SessionGuardService sessionGuardService;
    private final UserMessageService userMessageService;
    private final CampusSpotService campusSpotService;
    private final CampusRouteService campusRouteService;

    public UserContentApplicationServiceImpl(SessionGuardService sessionGuardService,
                                             UserMessageService userMessageService,
                                             CampusSpotService campusSpotService,
                                             CampusRouteService campusRouteService) {
        this.sessionGuardService = sessionGuardService;
        this.userMessageService = userMessageService;
        this.campusSpotService = campusSpotService;
        this.campusRouteService = campusRouteService;
    }

    @Override
    @Transactional
    public TUserContentApplication submitSpotApplication(TUserContentApplication application) {
        TUserSession session = sessionGuardService.requireActiveUserAction(application.getSessionId());
        if (application.getSpotName() == null || application.getSpotName().isBlank()) {
            throw new BusinessException(400, "请输入点位名称");
        }
        if (application.getSpotType() == null || application.getSpotType().isBlank()) {
            throw new BusinessException(400, "请选择点位类型");
        }
        if (application.getLongitude() == null || application.getLatitude() == null) {
            throw new BusinessException(400, "请填写点位坐标");
        }
        application.setUserMode(session.getUserMode());
        application.setApplicantName(session.getVirtualName());
        application.setApplicationType("spot");
        application.setApplicationTitle(application.getSpotName());
        application.setStatus(0);
        if (application.getRecommendTime() == null) application.setRecommendTime(15);
        if (application.getSuitableMode() == null || application.getSuitableMode().isBlank()) {
            application.setSuitableMode("alumni,fresh,parent,research,senior");
        }
        save(application);
        userMessageService.createMessage("personal", application.getSessionId(), null, "application",
                "申请已提交", "你提交的点位申请「" + application.getApplicationTitle() + "」已进入审核。",
                "application", application.getId(), "submitted");
        return application;
    }

    @Override
    @Transactional
    public TUserContentApplication submitRouteApplication(TUserContentApplication application) {
        TUserSession session = sessionGuardService.requireActiveUserAction(application.getSessionId());
        if (application.getRouteName() == null || application.getRouteName().isBlank()) {
            throw new BusinessException(400, "请输入路线名称");
        }
        TCampusRoute route = toCampusRoute(application);
        route = campusRouteService.prepareAndValidate(route);
        if (route.getSpots() == null || route.getSpots().size() < 2) {
            throw new BusinessException(400, "路线至少需要两个有效点位");
        }
        application.setSpotOrderJson(route.getSpotOrderJson());
        application.setUserMode(session.getUserMode());
        application.setApplicantName(session.getVirtualName());
        application.setApplicationType("route");
        application.setApplicationTitle(application.getRouteName());
        application.setStatus(0);
        if (application.getSuitableMode() == null || application.getSuitableMode().isBlank()) {
            application.setSuitableMode("alumni,fresh,parent,research,senior");
        }
        save(application);
        userMessageService.createMessage("personal", application.getSessionId(), null, "application",
                "申请已提交", "你提交的路线申请「" + application.getApplicationTitle() + "」已进入审核。",
                "application", application.getId(), "submitted");
        return application;
    }

    @Override
    public List<TUserContentApplication> getMyApplications(String sessionId, String applicationType, Integer status) {
        sessionGuardService.requireActiveUserAction(sessionId);
        LambdaQueryWrapper<TUserContentApplication> wrapper = new LambdaQueryWrapper<TUserContentApplication>()
                .eq(TUserContentApplication::getSessionId, sessionId);
        if (applicationType != null && !applicationType.isBlank()) {
            wrapper.eq(TUserContentApplication::getApplicationType, applicationType);
        }
        if (status != null) wrapper.eq(TUserContentApplication::getStatus, status);
        wrapper.orderByDesc(TUserContentApplication::getCreateTime);
        return list(wrapper);
    }

    @Override
    public TUserContentApplication getMyApplication(String sessionId, Long applicationId) {
        sessionGuardService.requireActiveUserAction(sessionId);
        TUserContentApplication application = getById(applicationId);
        if (application == null || !Objects.equals(application.getSessionId(), sessionId)) {
            throw new BusinessException(404, "申请不存在");
        }
        return application;
    }

    @Override
    @Transactional
    public TUserContentApplication withdrawApplication(String sessionId, Long applicationId) {
        TUserContentApplication application = getMyApplication(sessionId, applicationId);
        if (!Integer.valueOf(0).equals(application.getStatus())) {
            throw new BusinessException(400, "当前申请不能撤回");
        }
        application.setStatus(3);
        updateById(application);
        userMessageService.createMessage("personal", application.getSessionId(), null, "application",
                "申请已撤回", "你已撤回申请「" + application.getApplicationTitle() + "」。",
                "application", application.getId(), "withdrawn");
        return application;
    }

    @Override
    public List<TUserContentApplication> getAdminApplications(String applicationType, Integer status,
                                                              String keyword, String applicant,
                                                              String startTime, String endTime) {
        LambdaQueryWrapper<TUserContentApplication> wrapper = new LambdaQueryWrapper<>();
        if (applicationType != null && !applicationType.isBlank()) {
            wrapper.eq(TUserContentApplication::getApplicationType, applicationType);
        }
        if (status != null) wrapper.eq(TUserContentApplication::getStatus, status);
        if (keyword != null && !keyword.isBlank()) {
            String trimmed = keyword.trim();
            wrapper.and(w -> w.like(TUserContentApplication::getApplicationTitle, trimmed)
                    .or().like(TUserContentApplication::getSpotName, trimmed)
                    .or().like(TUserContentApplication::getRouteName, trimmed)
                    .or().like(TUserContentApplication::getApplicationReason, trimmed));
        }
        if (applicant != null && !applicant.isBlank()) {
            String trimmed = applicant.trim();
            wrapper.and(w -> w.like(TUserContentApplication::getApplicantName, trimmed)
                    .or().like(TUserContentApplication::getSessionId, trimmed));
        }
        LocalDateTime start = parseTime(startTime, true);
        LocalDateTime end = parseTime(endTime, false);
        if (start != null) wrapper.ge(TUserContentApplication::getCreateTime, start);
        if (end != null) wrapper.le(TUserContentApplication::getCreateTime, end);
        wrapper.orderByDesc(TUserContentApplication::getCreateTime);
        return list(wrapper);
    }

    private LocalDateTime parseTime(String value, boolean startOfDay) {
        if (value == null || value.isBlank()) return null;
        try {
            return LocalDateTime.parse(value.trim());
        } catch (Exception ignored) {
            try {
                LocalDate date = LocalDate.parse(value.trim());
                return startOfDay ? date.atStartOfDay() : date.atTime(LocalTime.MAX);
            } catch (Exception ignoredAgain) {
                return null;
            }
        }
    }

    @Override
    @Transactional
    public TUserContentApplication approveApplication(Long applicationId, TUserContentApplication changes, String auditComment) {
        TUserContentApplication application = getPendingApplication(applicationId);
        mergeEditableFields(application, changes);
        Long targetId;
        if ("spot".equals(application.getApplicationType())) {
            targetId = publishSpot(application);
        } else if ("route".equals(application.getApplicationType())) {
            targetId = publishRoute(application);
        } else {
            throw new BusinessException(400, "未知申请类型");
        }
        application.setStatus(1);
        application.setPublishedTargetId(targetId);
        application.setAuditComment(auditComment);
        application.setAuditTime(LocalDateTime.now());
        updateById(application);
        userMessageService.createMessage("personal", application.getSessionId(), null, "application",
                "申请已通过", "你提交的申请「" + application.getApplicationTitle() + "」已通过审核并发布。",
                "application", application.getId(), "approved");
        return application;
    }

    @Override
    @Transactional
    public TUserContentApplication rejectApplication(Long applicationId, String auditComment) {
        TUserContentApplication application = getPendingApplication(applicationId);
        application.setStatus(2);
        application.setAuditComment(auditComment);
        application.setAuditTime(LocalDateTime.now());
        updateById(application);
        userMessageService.createMessage("personal", application.getSessionId(), null, "application",
                "申请未通过", "你提交的申请「" + application.getApplicationTitle() + "」未通过审核。原因：" + (auditComment == null ? "未填写" : auditComment),
                "application", application.getId(), "rejected");
        return application;
    }

    private TUserContentApplication getPendingApplication(Long applicationId) {
        TUserContentApplication application = getById(applicationId);
        if (application == null) throw new BusinessException(404, "申请不存在");
        if (!Integer.valueOf(0).equals(application.getStatus())) {
            throw new BusinessException(400, "只能审核待审核申请");
        }
        return application;
    }

    private void mergeEditableFields(TUserContentApplication target, TUserContentApplication changes) {
        if (changes == null) return;
        if (changes.getSpotName() != null) target.setSpotName(changes.getSpotName());
        if (changes.getSpotType() != null) target.setSpotType(changes.getSpotType());
        if (changes.getLongitude() != null) target.setLongitude(changes.getLongitude());
        if (changes.getLatitude() != null) target.setLatitude(changes.getLatitude());
        if (changes.getOpenTime() != null) target.setOpenTime(changes.getOpenTime());
        if (changes.getRecommendTime() != null) target.setRecommendTime(changes.getRecommendTime());
        if (changes.getSpotDesc() != null) target.setSpotDesc(changes.getSpotDesc());
        if (changes.getSpotImage() != null) target.setSpotImage(changes.getSpotImage());
        if (changes.getRouteName() != null) target.setRouteName(changes.getRouteName());
        if (changes.getRouteDesc() != null) target.setRouteDesc(changes.getRouteDesc());
        if (changes.getTotalMinute() != null) target.setTotalMinute(changes.getTotalMinute());
        if (changes.getSpotOrderJson() != null) target.setSpotOrderJson(changes.getSpotOrderJson());
        if (changes.getCoverImage() != null) target.setCoverImage(changes.getCoverImage());
        if (changes.getSuitableMode() != null) target.setSuitableMode(changes.getSuitableMode());
        if ("spot".equals(target.getApplicationType())) target.setApplicationTitle(target.getSpotName());
        if ("route".equals(target.getApplicationType())) target.setApplicationTitle(target.getRouteName());
    }

    private Long publishSpot(TUserContentApplication application) {
        if (application.getSpotName() == null || application.getSpotName().isBlank()) {
            throw new BusinessException(400, "点位名称不能为空");
        }
        if (application.getSpotType() == null || application.getSpotType().isBlank()) {
            throw new BusinessException(400, "点位类型不能为空");
        }
        if (application.getLongitude() == null || application.getLatitude() == null) {
            throw new BusinessException(400, "点位坐标不能为空");
        }
        TCampusSpot spot = new TCampusSpot();
        spot.setSpotName(application.getSpotName());
        spot.setSpotType(application.getSpotType());
        spot.setLongitude(application.getLongitude());
        spot.setLatitude(application.getLatitude());
        spot.setOpenTime(application.getOpenTime());
        spot.setRecommendTime(application.getRecommendTime() == null ? 15 : application.getRecommendTime());
        spot.setSpotDesc(application.getSpotDesc());
        spot.setSpotImage(application.getSpotImage());
        spot.setSuitableMode(application.getSuitableMode());
        spot.setIsEnable(1);
        campusSpotService.save(spot);
        return spot.getId();
    }

    private Long publishRoute(TUserContentApplication application) {
        TCampusRoute route = toCampusRoute(application);
        route = campusRouteService.prepareAndValidate(route);
        if (route.getSpots() == null || route.getSpots().size() < 2) {
            throw new BusinessException(400, "路线至少需要两个有效点位");
        }
        route.setIsEnable(1);
        campusRouteService.save(route);
        application.setSpotOrderJson(route.getSpotOrderJson());
        return route.getId();
    }

    private TCampusRoute toCampusRoute(TUserContentApplication application) {
        TCampusRoute route = new TCampusRoute();
        route.setRouteName(application.getRouteName());
        route.setRouteDesc(application.getRouteDesc());
        route.setTotalMinute(application.getTotalMinute());
        route.setSpotOrderJson(application.getSpotOrderJson());
        route.setSuitableMode(application.getSuitableMode());
        route.setCoverImage(application.getCoverImage());
        route.setIsEnable(1);
        return route;
    }
}
