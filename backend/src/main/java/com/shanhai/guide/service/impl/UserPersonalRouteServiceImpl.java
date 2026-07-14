package com.shanhai.guide.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.shanhai.guide.entity.TCampusSpot;
import com.shanhai.guide.entity.TUserPersonalRoute;
import com.shanhai.guide.exception.BusinessException;
import com.shanhai.guide.mapper.UserPersonalRouteMapper;
import com.shanhai.guide.service.CampusSpotService;
import com.shanhai.guide.service.SessionGuardService;
import com.shanhai.guide.service.UserPersonalRouteService;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class UserPersonalRouteServiceImpl
        extends ServiceImpl<UserPersonalRouteMapper, TUserPersonalRoute>
        implements UserPersonalRouteService {

    private final SessionGuardService sessionGuardService;
    private final CampusSpotService campusSpotService;
    private final ObjectMapper objectMapper;

    public UserPersonalRouteServiceImpl(SessionGuardService sessionGuardService,
                                        CampusSpotService campusSpotService,
                                        ObjectMapper objectMapper) {
        this.sessionGuardService = sessionGuardService;
        this.campusSpotService = campusSpotService;
        this.objectMapper = objectMapper;
    }

    @Override
    public TUserPersonalRoute createRoute(TUserPersonalRoute route) {
        sessionGuardService.requireActiveUserAction(route.getSessionId());
        normalizeAndValidate(route, true);
        save(route);
        return route;
    }

    @Override
    public List<TUserPersonalRoute> listRoutes(String sessionId) {
        sessionGuardService.requireActiveUserAction(sessionId);
        return list(new LambdaQueryWrapper<TUserPersonalRoute>()
                .eq(TUserPersonalRoute::getSessionId, sessionId)
                .orderByDesc(TUserPersonalRoute::getUpdateTime)
                .orderByDesc(TUserPersonalRoute::getId));
    }

    @Override
    public TUserPersonalRoute getRoute(String sessionId, Long routeId) {
        sessionGuardService.requireActiveUserAction(sessionId);
        TUserPersonalRoute route = getById(routeId);
        if (route == null || !Objects.equals(route.getSessionId(), sessionId)) {
            throw new BusinessException(404, "个人路线不存在");
        }
        return route;
    }

    @Override
    public TUserPersonalRoute updateRoute(String sessionId, Long routeId, TUserPersonalRoute changes) {
        TUserPersonalRoute route = getRoute(sessionId, routeId);
        if (changes.getRouteName() != null) route.setRouteName(changes.getRouteName());
        if (changes.getRouteDesc() != null) route.setRouteDesc(changes.getRouteDesc());
        if (changes.getSpotOrderJson() != null) route.setSpotOrderJson(changes.getSpotOrderJson());
        if (changes.getTotalMinute() != null) route.setTotalMinute(changes.getTotalMinute());
        if (changes.getSourcePrompt() != null) route.setSourcePrompt(changes.getSourcePrompt());
        if (changes.getSourceType() != null) route.setSourceType(changes.getSourceType());
        if (changes.getIsFavorite() != null) route.setIsFavorite(changes.getIsFavorite());
        normalizeAndValidate(route, false);
        updateById(route);
        return route;
    }

    @Override
    public void deleteRoute(String sessionId, Long routeId) {
        TUserPersonalRoute route = getRoute(sessionId, routeId);
        removeById(route.getId());
    }

    private void normalizeAndValidate(TUserPersonalRoute route, boolean creating) {
        if (route.getRouteName() == null || route.getRouteName().isBlank()) {
            throw new BusinessException(400, "请输入路线名称");
        }
        List<Long> spotIds = parseSpotIds(route.getSpotOrderJson());
        if (spotIds.size() < 2) {
            throw new BusinessException(400, "个人路线至少需要两个点位");
        }
        validateEnabledSpots(spotIds);
        route.setSpotOrderJson(writeSpotIds(spotIds));
        if (route.getTotalMinute() == null || route.getTotalMinute() <= 0) {
            route.setTotalMinute(Math.max(30, spotIds.size() * 15));
        }
        if (route.getSourceType() == null || route.getSourceType().isBlank()) {
            route.setSourceType("ai");
        }
        if (route.getIsFavorite() == null) {
            route.setIsFavorite(creating ? 1 : 0);
        }
    }

    private List<Long> parseSpotIds(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            JsonNode root = objectMapper.readTree(json);
            if (!root.isArray()) return List.of();
            Set<Long> ids = new LinkedHashSet<>();
            for (JsonNode item : root) {
                if (item.isIntegralNumber()) {
                    ids.add(item.asLong());
                } else if (item.has("spotId") && item.get("spotId").isIntegralNumber()) {
                    ids.add(item.get("spotId").asLong());
                } else if (item.has("id") && item.get("id").isIntegralNumber()) {
                    ids.add(item.get("id").asLong());
                }
            }
            return new ArrayList<>(ids);
        } catch (Exception e) {
            throw new BusinessException(400, "路线点位顺序格式错误");
        }
    }

    private void validateEnabledSpots(List<Long> spotIds) {
        List<TCampusSpot> spots = campusSpotService.listByIds(spotIds);
        Map<Long, TCampusSpot> byId = spots.stream()
                .collect(Collectors.toMap(TCampusSpot::getId, item -> item, (a, b) -> a));
        for (Long id : spotIds) {
            TCampusSpot spot = byId.get(id);
            if (spot == null) throw new BusinessException(400, "路线包含不存在的点位：" + id);
            if (!Integer.valueOf(1).equals(spot.getIsEnable())) {
                throw new BusinessException(400, "路线包含已停用点位：" + id);
            }
        }
    }

    private String writeSpotIds(List<Long> ids) {
        try {
            return objectMapper.writeValueAsString(ids);
        } catch (Exception e) {
            throw new BusinessException(500, "路线点位序列化失败");
        }
    }
}
