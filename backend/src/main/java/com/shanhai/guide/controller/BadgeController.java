package com.shanhai.guide.controller;

import com.shanhai.guide.common.ApiResponse;
import com.shanhai.guide.entity.TBadge;
import com.shanhai.guide.service.BadgeService;
import com.shanhai.guide.service.BadgeRuleService;
import com.shanhai.guide.mapper.UserBadgeRelationMapper;
import com.shanhai.guide.entity.TUserBadgeRelation;
import com.shanhai.guide.service.SessionGuardService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import com.shanhai.guide.entity.dto.BadgeProgressView;
import com.shanhai.guide.entity.dto.UserActionResult;

@RestController
@RequestMapping("/api/badge")
public class BadgeController {

    private final BadgeService badgeService;
    private final UserBadgeRelationMapper userBadgeRelationMapper;
    private final SessionGuardService sessionGuardService;
    private final BadgeRuleService badgeRuleService;

    public BadgeController(BadgeService badgeService, UserBadgeRelationMapper userBadgeRelationMapper,
                           SessionGuardService sessionGuardService,
                           BadgeRuleService badgeRuleService) {
        this.badgeService = badgeService;
        this.userBadgeRelationMapper = userBadgeRelationMapper;
        this.sessionGuardService = sessionGuardService;
        this.badgeRuleService = badgeRuleService;
    }

    @GetMapping("/list")
    public ApiResponse<List<TBadge>> getBadges(@RequestParam(required = false) String userMode) {
        List<TBadge> badges;
        if (userMode != null && !userMode.isEmpty()) {
            badges = badgeService.getBadgesByMode(userMode);
        } else {
            badges = badgeService.getAllBadges();
        }
        return ApiResponse.success(badges);
    }

    @GetMapping("/my")
    public ApiResponse<List<TBadge>> getMyBadges(@RequestParam String sessionId) {
        sessionGuardService.requireActiveUserAction(sessionId);
        List<Long> ids = userBadgeRelationMapper.selectList(
                new LambdaQueryWrapper<TUserBadgeRelation>()
                        .eq(TUserBadgeRelation::getSessionId, sessionId))
                .stream().map(TUserBadgeRelation::getBadgeId).toList();
        return ApiResponse.success(ids.isEmpty() ? java.util.Collections.emptyList() : badgeService.listByIds(ids));
    }

    @GetMapping("/progress")
    public ApiResponse<List<BadgeProgressView>> getProgress(@RequestParam String sessionId) {
        return ApiResponse.success(badgeRuleService.getProgress(sessionId));
    }

    @PostMapping("/recalculate")
    public ApiResponse<UserActionResult> recalculate(@RequestParam String sessionId) {
        List<TBadge> unlocked = badgeRuleService.checkAndUnlock(sessionId, BadgeRuleService.TRIGGER_RECALCULATE);
        return ApiResponse.success(UserActionResult.of("成就进度已重新计算", unlocked));
    }
}
