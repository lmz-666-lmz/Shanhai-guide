package com.shanhai.guide.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.shanhai.guide.entity.TBadge;
import com.shanhai.guide.entity.TUserActivityReserve;
import com.shanhai.guide.entity.TUserBadgeRelation;
import com.shanhai.guide.entity.TUserFavorite;
import com.shanhai.guide.entity.TUserSession;
import com.shanhai.guide.entity.dto.BadgeProgressView;
import com.shanhai.guide.mapper.UserActivityReserveMapper;
import com.shanhai.guide.mapper.UserBadgeRelationMapper;
import com.shanhai.guide.mapper.UserCheckinMapper;
import com.shanhai.guide.mapper.UserFavoriteMapper;
import com.shanhai.guide.mapper.UserSessionMapper;
import com.shanhai.guide.service.BadgeRuleService;
import com.shanhai.guide.service.BadgeService;
import com.shanhai.guide.service.SessionGuardService;
import com.shanhai.guide.service.UserMessageService;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class BadgeRuleServiceImpl implements BadgeRuleService {

    private static final Pattern SPOT_TYPE_PATTERN = Pattern.compile("\\\"spotType\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"");
    private static final Pattern NUMBER_PATTERN = Pattern.compile("(\\d+)");

    private final BadgeService badgeService;
    private final UserBadgeRelationMapper relationMapper;
    private final UserCheckinMapper checkinMapper;
    private final UserFavoriteMapper favoriteMapper;
    private final UserActivityReserveMapper reserveMapper;
    private final UserSessionMapper sessionMapper;
    private final SessionGuardService sessionGuardService;
    private final UserMessageService userMessageService;

    public BadgeRuleServiceImpl(BadgeService badgeService,
                                UserBadgeRelationMapper relationMapper,
                                UserCheckinMapper checkinMapper,
                                UserFavoriteMapper favoriteMapper,
                                UserActivityReserveMapper reserveMapper,
                                UserSessionMapper sessionMapper,
                                SessionGuardService sessionGuardService,
                                UserMessageService userMessageService) {
        this.badgeService = badgeService;
        this.relationMapper = relationMapper;
        this.checkinMapper = checkinMapper;
        this.favoriteMapper = favoriteMapper;
        this.reserveMapper = reserveMapper;
        this.sessionMapper = sessionMapper;
        this.sessionGuardService = sessionGuardService;
        this.userMessageService = userMessageService;
    }

    @Override
    @Transactional
    public List<TBadge> checkAndUnlock(String sessionId, String triggerEvent) {
        TUserSession session = sessionGuardService.requireActiveUserAction(sessionId);
        sessionMapper.selectBySessionIdForUpdate(sessionId);
        List<TBadge> badges = badgeService.getBadgesByMode(session.getUserMode());
        Map<Long, TUserBadgeRelation> unlocked = loadRelations(sessionId);
        Map<String, Integer> metricCache = new HashMap<>();
        List<TBadge> newlyUnlocked = new ArrayList<>();

        for (TBadge badge : badges) {
            if (badge.getId() == null || unlocked.containsKey(badge.getId()) || !hasAutomaticRule(badge)) continue;
            int target = targetValue(badge);
            int current = currentValue(sessionId, badge, metricCache);
            if (current < target) continue;

            TUserBadgeRelation relation = new TUserBadgeRelation();
            relation.setSessionId(sessionId);
            relation.setBadgeId(badge.getId());
            relation.setSourceEvent(triggerEvent);
            relation.setIsNotified(0);
            relation.setUnlockTime(LocalDateTime.now());
            try {
                relationMapper.insert(relation);
            } catch (DuplicateKeyException ignored) {
                continue;
            }

            userMessageService.createMessage(
                    "personal",
                    sessionId,
                    session.getUserMode(),
                    "badge",
                    "获得新成就",
                    "恭喜获得「" + badge.getBadgeName() + "」成就",
                    "badge",
                    badge.getId(),
                    "unlocked"
            );
            relation.setIsNotified(1);
            relationMapper.updateById(relation);
            newlyUnlocked.add(badge);
        }
        return newlyUnlocked;
    }

    @Override
    public List<BadgeProgressView> getProgress(String sessionId) {
        TUserSession session = sessionGuardService.requireActiveUserAction(sessionId);
        Map<Long, TUserBadgeRelation> unlocked = loadRelations(sessionId);
        Map<String, Integer> metricCache = new HashMap<>();
        return badgeService.getBadgesByMode(session.getUserMode()).stream().map(badge -> {
            TUserBadgeRelation relation = unlocked.get(badge.getId());
            BadgeProgressView view = new BadgeProgressView();
            view.setBadge(badge);
            view.setTargetValue(targetValue(badge));
            view.setCurrentValue(hasAutomaticRule(badge) ? currentValue(sessionId, badge, metricCache) : 0);
            view.setUnlocked(relation != null);
            view.setUnlockTime(relation == null ? null : relation.getUnlockTime());
            view.setConditionText(conditionText(badge));
            return view;
        }).toList();
    }

    private Map<Long, TUserBadgeRelation> loadRelations(String sessionId) {
        return relationMapper.selectList(new LambdaQueryWrapper<TUserBadgeRelation>()
                        .eq(TUserBadgeRelation::getSessionId, sessionId))
                .stream()
                .collect(Collectors.toMap(TUserBadgeRelation::getBadgeId, Function.identity(), (left, right) -> left));
    }

    private boolean hasAutomaticRule(TBadge badge) {
        String type = resolvedConditionType(badge);
        return type != null && !type.isBlank() && !"CUSTOM".equals(type);
    }

    private int targetValue(TBadge badge) {
        String type = resolvedConditionType(badge);
        if ("FIRST_CHECKIN".equals(type) || "FIRST_ROUTE".equals(type) || "FIRST_ACTIVITY".equals(type)) return 1;
        if (badge.getConditionValue() == null && badge.getUnlockRule() != null) {
            Matcher matcher = NUMBER_PATTERN.matcher(badge.getUnlockRule());
            if (matcher.find()) return Math.max(Integer.parseInt(matcher.group(1)), 1);
        }
        return Math.max(badge.getConditionValue() == null ? 1 : badge.getConditionValue(), 1);
    }

    private int currentValue(String sessionId, TBadge badge, Map<String, Integer> cache) {
        String type = resolvedConditionType(badge);
        String key = type + "|" + (badge.getConditionConfig() == null ? "" : badge.getConditionConfig());
        return cache.computeIfAbsent(key, ignored -> switch (type) {
            case "FIRST_CHECKIN", "CHECKIN_COUNT" -> safeInt(checkinMapper.countSpotCheckins(sessionId));
            case "FIRST_ROUTE", "ROUTE_COMPLETE_COUNT" -> safeInt(checkinMapper.countCompletedRoutes(sessionId));
            case "FIRST_ACTIVITY", "ACTIVITY_RESERVE_COUNT" -> safeInt(reserveMapper.selectCount(
                    new LambdaQueryWrapper<TUserActivityReserve>()
                            .eq(TUserActivityReserve::getSessionId, sessionId)
                            .eq(TUserActivityReserve::getReserveStatus, 1)));
            case "FAVORITE_SPOT_COUNT" -> safeInt(favoriteMapper.selectCount(
                    new LambdaQueryWrapper<TUserFavorite>()
                            .eq(TUserFavorite::getSessionId, sessionId)
                            .eq(TUserFavorite::getFavoriteType, 1)));
            case "FAVORITE_ROUTE_COUNT" -> safeInt(favoriteMapper.selectCount(
                    new LambdaQueryWrapper<TUserFavorite>()
                            .eq(TUserFavorite::getSessionId, sessionId)
                            .eq(TUserFavorite::getFavoriteType, 2)));
            case "SPOT_TYPE_CHECKIN" -> {
                String spotType = resolveSpotType(badge.getConditionConfig());
                yield spotType.isBlank() ? 0 : safeInt(checkinMapper.countSpotTypeCheckins(sessionId, spotType));
            }
            default -> 0;
        });
    }

    private int safeInt(long value) {
        return value > Integer.MAX_VALUE ? Integer.MAX_VALUE : (int) value;
    }

    private String resolveSpotType(String config) {
        if (config == null || config.isBlank()) return "";
        String value = config.trim();
        if (!value.startsWith("{")) return value;
        Matcher matcher = SPOT_TYPE_PATTERN.matcher(value);
        return matcher.find() ? matcher.group(1).trim() : "";
    }

    private String conditionText(TBadge badge) {
        if (badge.getUnlockRule() != null && !badge.getUnlockRule().isBlank()) return badge.getUnlockRule();
        int target = targetValue(badge);
        return switch (resolvedConditionType(badge) == null ? "" : resolvedConditionType(badge)) {
            case "FIRST_CHECKIN" -> "完成首次点位打卡";
            case "CHECKIN_COUNT" -> "累计完成 " + target + " 次点位打卡";
            case "FIRST_ROUTE" -> "首次完成一条校园路线";
            case "ROUTE_COMPLETE_COUNT" -> "累计完成 " + target + " 条校园路线";
            case "FIRST_ACTIVITY" -> "首次预约校园活动";
            case "ACTIVITY_RESERVE_COUNT" -> "累计预约 " + target + " 场校园活动";
            case "FAVORITE_SPOT_COUNT" -> "收藏 " + target + " 个校园点位";
            case "FAVORITE_ROUTE_COUNT" -> "收藏 " + target + " 条校园路线";
            case "SPOT_TYPE_CHECKIN" -> "打卡 " + target + " 个" + resolveSpotType(badge.getConditionConfig()) + "点位";
            default -> "成就规则完善中";
        };
    }

    private String resolvedConditionType(TBadge badge) {
        if (badge.getConditionType() != null && !badge.getConditionType().isBlank()) return badge.getConditionType();
        String legacyRule = badge.getUnlockRule();
        if (legacyRule == null || legacyRule.isBlank()) return null;
        if (legacyRule.contains("打卡")) {
            Matcher matcher = NUMBER_PATTERN.matcher(legacyRule);
            int count = matcher.find() ? Integer.parseInt(matcher.group(1)) : 1;
            return count <= 1 ? "FIRST_CHECKIN" : "CHECKIN_COUNT";
        }
        if (legacyRule.contains("预约")) return "FIRST_ACTIVITY";
        return "CUSTOM";
    }
}
