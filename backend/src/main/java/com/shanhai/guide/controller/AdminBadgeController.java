package com.shanhai.guide.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.shanhai.guide.common.ApiResponse;
import com.shanhai.guide.entity.TBadge;
import com.shanhai.guide.exception.BusinessException;
import com.shanhai.guide.service.BadgeService;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/badges")
public class AdminBadgeController {

    private static final Set<String> CONDITION_TYPES = Set.of(
            "FIRST_CHECKIN", "CHECKIN_COUNT", "FIRST_ROUTE", "ROUTE_COMPLETE_COUNT",
            "FIRST_ACTIVITY", "ACTIVITY_RESERVE_COUNT", "FAVORITE_SPOT_COUNT",
            "FAVORITE_ROUTE_COUNT", "SPOT_TYPE_CHECKIN", "CUSTOM"
    );

    private final BadgeService badgeService;

    public AdminBadgeController(BadgeService badgeService) {
        this.badgeService = badgeService;
    }

    @GetMapping
    public ApiResponse<List<TBadge>> list(@RequestParam(required = false) String keyword,
                                           @RequestParam(required = false) String conditionType,
                                           @RequestParam(required = false) String badgeLevel,
                                           @RequestParam(required = false) Integer isEnable) {
        LambdaQueryWrapper<TBadge> wrapper = new LambdaQueryWrapper<>();
        if (keyword != null && !keyword.isBlank()) {
            String trimmed = keyword.trim();
            wrapper.and(w -> w.like(TBadge::getBadgeName, trimmed)
                    .or().like(TBadge::getBadgeDesc, trimmed)
                    .or().like(TBadge::getUnlockRule, trimmed));
        }
        if (conditionType != null && !conditionType.isBlank()) wrapper.eq(TBadge::getConditionType, conditionType);
        if (badgeLevel != null && !badgeLevel.isBlank()) wrapper.eq(TBadge::getBadgeLevel, badgeLevel);
        if (isEnable != null) wrapper.eq(TBadge::getIsEnable, isEnable);
        wrapper.orderByAsc(TBadge::getSortOrder)
                .orderByAsc(TBadge::getSort)
                .orderByAsc(TBadge::getId);
        return ApiResponse.success(badgeService.list(wrapper));
    }

    @PostMapping
    public ApiResponse<TBadge> create(@RequestBody TBadge badge) {
        validate(badge, null);
        if (badge.getBadgeCode() == null || badge.getBadgeCode().isBlank()) {
            badge.setBadgeCode("BADGE_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase());
        }
        if (badge.getBadgeLevel() == null || badge.getBadgeLevel().isBlank()) badge.setBadgeLevel("normal");
        if (badge.getConditionValue() == null) badge.setConditionValue(1);
        if (badge.getSortOrder() == null) badge.setSortOrder(0);
        if (badge.getSort() == null) badge.setSort(badge.getSortOrder());
        if (badge.getIsEnable() == null) badge.setIsEnable(1);
        ensureCodeUnique(badge.getBadgeCode(), null);
        badgeService.save(badge);
        return ApiResponse.success(badge);
    }

    @PutMapping("/{badgeId}")
    public ApiResponse<TBadge> update(@PathVariable Long badgeId, @RequestBody TBadge changes) {
        TBadge badge = requireBadge(badgeId);
        validate(changes, badgeId);
        if (changes.getBadgeCode() != null && !changes.getBadgeCode().isBlank()) {
            ensureCodeUnique(changes.getBadgeCode(), badgeId);
            badge.setBadgeCode(changes.getBadgeCode().trim());
        }
        if (changes.getBadgeName() != null) badge.setBadgeName(changes.getBadgeName().trim());
        if (changes.getBadgeIcon() != null) badge.setBadgeIcon(changes.getBadgeIcon());
        if (changes.getBadgeDesc() != null) badge.setBadgeDesc(changes.getBadgeDesc());
        if (changes.getBadgeLevel() != null) badge.setBadgeLevel(changes.getBadgeLevel());
        if (changes.getUnlockRule() != null) badge.setUnlockRule(changes.getUnlockRule());
        if (changes.getConditionType() != null) badge.setConditionType(changes.getConditionType());
        if (changes.getConditionValue() != null) badge.setConditionValue(Math.max(changes.getConditionValue(), 1));
        if (changes.getConditionConfig() != null) badge.setConditionConfig(changes.getConditionConfig());
        if (changes.getUserModeLimit() != null) badge.setUserModeLimit(changes.getUserModeLimit());
        if (changes.getSortOrder() != null) {
            badge.setSortOrder(changes.getSortOrder());
            badge.setSort(changes.getSortOrder());
        }
        badgeService.updateById(badge);
        return ApiResponse.success(badge);
    }

    @PutMapping("/{badgeId}/status")
    public ApiResponse<TBadge> updateStatus(@PathVariable Long badgeId, @RequestParam Integer isEnable) {
        TBadge badge = requireBadge(badgeId);
        badge.setIsEnable(Integer.valueOf(1).equals(isEnable) ? 1 : 0);
        badgeService.updateById(badge);
        return ApiResponse.success(badge);
    }

    @DeleteMapping("/{badgeId}")
    public ApiResponse<String> disable(@PathVariable Long badgeId) {
        TBadge badge = requireBadge(badgeId);
        badge.setIsEnable(0);
        badgeService.updateById(badge);
        return ApiResponse.success("徽章已下架，历史获得记录保留");
    }

    private TBadge requireBadge(Long badgeId) {
        TBadge badge = badgeService.getById(badgeId);
        if (badge == null) throw new BusinessException(404, "徽章不存在");
        return badge;
    }

    private void validate(TBadge badge, Long badgeId) {
        if (badgeId == null && (badge.getBadgeName() == null || badge.getBadgeName().isBlank())) {
            throw new BusinessException(400, "徽章名称不能为空");
        }
        if (badge.getBadgeName() != null && badge.getBadgeName().isBlank()) {
            throw new BusinessException(400, "徽章名称不能为空");
        }
        if (badge.getConditionType() != null && !CONDITION_TYPES.contains(badge.getConditionType())) {
            throw new BusinessException(400, "不支持的成就条件类型");
        }
    }

    private void ensureCodeUnique(String badgeCode, Long excludeId) {
        LambdaQueryWrapper<TBadge> wrapper = new LambdaQueryWrapper<TBadge>().eq(TBadge::getBadgeCode, badgeCode);
        if (excludeId != null) wrapper.ne(TBadge::getId, excludeId);
        if (badgeService.count(wrapper) > 0) throw new BusinessException(400, "徽章编码已存在");
    }
}
