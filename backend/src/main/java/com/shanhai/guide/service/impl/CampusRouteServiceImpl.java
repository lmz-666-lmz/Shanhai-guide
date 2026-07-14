package com.shanhai.guide.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.shanhai.guide.entity.TCampusRoute;
import com.shanhai.guide.exception.BusinessException;
import com.shanhai.guide.mapper.CampusRouteMapper;
import com.shanhai.guide.mapper.CampusSpotMapper;
import com.shanhai.guide.service.CampusRouteService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class CampusRouteServiceImpl extends ServiceImpl<CampusRouteMapper, TCampusRoute> implements CampusRouteService {

    private final CampusSpotMapper campusSpotMapper;
    private final ObjectMapper objectMapper;

    public CampusRouteServiceImpl(CampusSpotMapper campusSpotMapper, ObjectMapper objectMapper) {
        this.campusSpotMapper = campusSpotMapper;
        this.objectMapper = objectMapper;
    }

    @Override
    public List<TCampusRoute> searchRoutes(String userMode, Integer isEnable) {
        return searchRoutes(userMode, isEnable, null, null, null);
    }

    @Override
    public List<TCampusRoute> searchRoutes(String userMode, Integer isEnable, String keyword, Integer minMinute, Integer maxMinute) {
        LambdaQueryWrapper<TCampusRoute> wrapper = new LambdaQueryWrapper<>();
        if (isEnable != null) {
            wrapper.eq(TCampusRoute::getIsEnable, isEnable);
        }
        if (userMode != null && !userMode.isBlank()) {
            wrapper.and(w -> w.like(TCampusRoute::getSuitableMode, userMode)
                    .or().isNull(TCampusRoute::getSuitableMode)
                    .or().eq(TCampusRoute::getSuitableMode, ""));
        }
        if (keyword != null && !keyword.isBlank()) {
            String trimmed = keyword.trim();
            wrapper.and(w -> w.like(TCampusRoute::getRouteName, trimmed)
                    .or().like(TCampusRoute::getRouteDesc, trimmed));
        }
        if (minMinute != null) {
            wrapper.ge(TCampusRoute::getTotalMinute, minMinute);
        }
        if (maxMinute != null) {
            wrapper.le(TCampusRoute::getTotalMinute, maxMinute);
        }
        wrapper.orderByAsc(TCampusRoute::getId);
        List<TCampusRoute> routes = list(wrapper);
        routes.forEach(this::hydrateSpots);
        return routes;
    }

    @Override
    public TCampusRoute getRouteById(Long routeId) {
        LambdaQueryWrapper<TCampusRoute> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TCampusRoute::getId, routeId)
               .eq(TCampusRoute::getIsEnable, 1);
        TCampusRoute route = getOne(wrapper);
        if (route == null) {
            throw new BusinessException(404, "路线不存在");
        }
        return hydrateSpots(route);
    }

    @Override
    public TCampusRoute getRouteForAdmin(Long routeId) {
        TCampusRoute route = getById(routeId);
        if (route == null) {
            throw new BusinessException(404, "路线不存在");
        }
        return hydrateSpotsForAdmin(route);
    }

    @Override
    public List<TCampusRoute> getAllRoutes() {
        LambdaQueryWrapper<TCampusRoute> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TCampusRoute::getIsEnable, 1);
        List<TCampusRoute> routes = list(wrapper);
        routes.forEach(this::hydrateSpots);
        return routes;
    }

    @Override
    public TCampusRoute prepareAndValidate(TCampusRoute route) {
        List<Long> ids = parseSpotIds(route.getSpotOrderJson());
        if (ids.isEmpty()) {
            throw new BusinessException(400, "路线至少需要一个有效点位");
        }
        List<com.shanhai.guide.entity.TCampusSpot> spots = campusSpotMapper.selectBatchIds(ids);
        java.util.Map<Long, com.shanhai.guide.entity.TCampusSpot> byId = new java.util.HashMap<>();
        spots.forEach(spot -> byId.put(spot.getId(), spot));
        for (Long id : ids) {
            if (!byId.containsKey(id)) {
                throw new BusinessException(400, "路线包含不存在的点位：" + id);
            }
        }
        route.setSpotOrderJson(writeSpotIds(ids));
        route.setSpots(ids.stream().map(byId::get).filter(java.util.Objects::nonNull).toList());
        return route;
    }

    private TCampusRoute hydrateSpots(TCampusRoute route) {
        List<Long> ids = parseSpotIds(route.getSpotOrderJson());
        if (ids.isEmpty()) {
            route.setSpots(java.util.Collections.emptyList());
            route.setSpotOrderJson("[]");
            return route;
        }
        List<com.shanhai.guide.entity.TCampusSpot> found = campusSpotMapper.selectBatchIds(ids);
        java.util.Map<Long, com.shanhai.guide.entity.TCampusSpot> byId = new java.util.HashMap<>();
        found.forEach(spot -> byId.put(spot.getId(), spot));
        List<com.shanhai.guide.entity.TCampusSpot> ordered = ids.stream()
                .map(byId::get).filter(java.util.Objects::nonNull)
                .filter(spot -> Integer.valueOf(1).equals(spot.getIsEnable())).toList();
        route.setSpots(ordered);
        route.setSpotOrderJson(writeSpotIds(ordered.stream().map(com.shanhai.guide.entity.TCampusSpot::getId).toList()));
        return route;
    }

    /** Admin version: hydrate spots WITHOUT filtering disabled ones and WITHOUT rewriting spotOrderJson */
    private TCampusRoute hydrateSpotsForAdmin(TCampusRoute route) {
        List<Long> ids = parseSpotIds(route.getSpotOrderJson());
        if (ids.isEmpty()) {
            route.setSpots(java.util.Collections.emptyList());
            return route;
        }
        List<com.shanhai.guide.entity.TCampusSpot> found = campusSpotMapper.selectBatchIds(ids);
        java.util.Map<Long, com.shanhai.guide.entity.TCampusSpot> byId = new java.util.HashMap<>();
        found.forEach(spot -> byId.put(spot.getId(), spot));
        // Keep all spots including disabled ones; preserve original spotOrderJson
        List<com.shanhai.guide.entity.TCampusSpot> ordered = ids.stream()
                .map(byId::get).filter(java.util.Objects::nonNull).toList();
        route.setSpots(ordered);
        return route;
    }

    private List<Long> parseSpotIds(String json) {
        if (json == null || json.isBlank()) return java.util.Collections.emptyList();
        try {
            return objectMapper.readValue(json, new TypeReference<List<Long>>() {});
        } catch (Exception ex) {
            throw new BusinessException(400, "路线点位顺序格式错误");
        }
    }

    private String writeSpotIds(List<Long> ids) {
        try {
            return objectMapper.writeValueAsString(ids);
        } catch (Exception ex) {
            throw new BusinessException(500, "路线点位序列化失败");
        }
    }
}
