package com.softwarecup.shanhai.service;

import com.softwarecup.shanhai.dto.CampusRouteResponse;
import com.softwarecup.shanhai.dto.RouteRecommendRequest;
import com.softwarecup.shanhai.dto.RouteSpotResponse;
import com.softwarecup.shanhai.entity.CampusRoute;
import com.softwarecup.shanhai.entity.CampusSpot;
import com.softwarecup.shanhai.entity.RouteSpot;
import com.softwarecup.shanhai.repository.CampusRouteRepository;
import com.softwarecup.shanhai.repository.CampusSpotRepository;
import com.softwarecup.shanhai.repository.RouteSpotRepository;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class CampusRouteService {

    private final CampusRouteRepository campusRouteRepository;
    private final RouteSpotRepository routeSpotRepository;
    private final CampusSpotRepository campusSpotRepository;

    public CampusRouteService(
            CampusRouteRepository campusRouteRepository,
            RouteSpotRepository routeSpotRepository,
            CampusSpotRepository campusSpotRepository
    ) {
        this.campusRouteRepository = campusRouteRepository;
        this.routeSpotRepository = routeSpotRepository;
        this.campusSpotRepository = campusSpotRepository;
    }

    public List<CampusRouteResponse> listEnabledRoutes() {
        return campusRouteRepository.findByEnabledTrueOrderByIdAsc()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public CampusRouteResponse getRouteById(Long id) {
        CampusRoute route = campusRouteRepository.findById(id)
                .filter(item -> Boolean.TRUE.equals(item.getEnabled()))
                .orElseThrow(() -> new IllegalArgumentException("未找到该校园路线，可能已下线或不存在"));

        return toResponse(route);
    }

    public CampusRouteResponse recommend(RouteRecommendRequest request) {
        List<CampusRoute> routes = campusRouteRepository.findByEnabledTrueOrderByIdAsc();
        if (routes.isEmpty()) {
            throw new IllegalArgumentException("暂无可用校园路线，请稍后再试");
        }

        Integer durationMinutes = request == null ? null : request.durationMinutes();
        String preferredRouteName = resolvePreferredRouteName(request == null ? null : request.userMode());

        if (StringUtils.hasText(preferredRouteName)) {
            CampusRoute matchedRoute = routes.stream()
                    .filter(route -> preferredRouteName.equals(route.getName()))
                    .filter(route -> durationMinutes == null || isDurationWithin(route, durationMinutes))
                    .findFirst()
                    .orElse(null);
            if (matchedRoute != null) {
                return toResponse(matchedRoute);
            }
        }

        List<CampusRoute> durationCandidates = routes;
        if (durationMinutes != null) {
            List<CampusRoute> withinDurationRoutes = routes.stream()
                    .filter(route -> isDurationWithin(route, durationMinutes))
                    .toList();
            if (!withinDurationRoutes.isEmpty()) {
                durationCandidates = withinDurationRoutes;
            }
        }

        CampusRoute recommendedRoute = durationCandidates.stream()
                .min(recommendComparator(request, durationMinutes))
                .orElseThrow(() -> new IllegalArgumentException("暂时没有匹配的校园路线，请稍后再试"));

        return toResponse(recommendedRoute);
    }

    private CampusRouteResponse toResponse(CampusRoute route) {
        List<RouteSpot> routeSpots = routeSpotRepository.findByRouteIdOrderBySortOrderAsc(route.getId());
        List<Long> spotIds = routeSpots.stream()
                .map(RouteSpot::getSpotId)
                .filter(Objects::nonNull)
                .toList();
        Map<Long, CampusSpot> spotMap = campusSpotRepository.findAllById(spotIds)
                .stream()
                .collect(Collectors.toMap(CampusSpot::getId, Function.identity()));

        List<RouteSpotResponse> spots = routeSpots.stream()
                .map(routeSpot -> toRouteSpotResponse(routeSpot, spotMap.get(routeSpot.getSpotId())))
                .filter(Objects::nonNull)
                .toList();

        return new CampusRouteResponse(
                route.getId(),
                route.getName(),
                route.getRouteType(),
                route.getDescription(),
                route.getSuitableFor(),
                route.getEstimatedDuration(),
                route.getDistanceText(),
                route.getReason(),
                spots
        );
    }

    private RouteSpotResponse toRouteSpotResponse(RouteSpot routeSpot, CampusSpot spot) {
        if (spot == null) {
            return null;
        }

        return new RouteSpotResponse(
                spot.getId(),
                spot.getName(),
                spot.getType(),
                spot.getDescription(),
                spot.getLatitude(),
                spot.getLongitude(),
                routeSpot.getSortOrder(),
                routeSpot.getStayMinutes(),
                routeSpot.getNote()
        );
    }

    private String resolvePreferredRouteName(String userMode) {
        if (!StringUtils.hasText(userMode)) {
            return null;
        }
        if (userMode.contains("校友")) {
            return "校友记忆路线";
        }
        if (userMode.contains("新生")) {
            return "新生初识路线";
        }
        if (userMode.contains("家长")) {
            return "家长参观路线";
        }
        if (userMode.contains("研学")) {
            return "研学科创路线";
        }
        return null;
    }

    private boolean isDurationWithin(CampusRoute route, Integer durationMinutes) {
        return route.getEstimatedDuration() != null && route.getEstimatedDuration() <= durationMinutes;
    }

    private Comparator<CampusRoute> recommendComparator(RouteRecommendRequest request, Integer durationMinutes) {
        return Comparator
                .comparingInt((CampusRoute route) -> durationScore(route, durationMinutes))
                .thenComparing(Comparator.comparingInt((CampusRoute route) -> interestScore(route, request)).reversed())
                .thenComparing(CampusRoute::getId);
    }

    private int durationScore(CampusRoute route, Integer durationMinutes) {
        if (durationMinutes == null || route.getEstimatedDuration() == null) {
            return 0;
        }
        return Math.abs(route.getEstimatedDuration() - durationMinutes);
    }

    private int interestScore(CampusRoute route, RouteRecommendRequest request) {
        if (request == null || !StringUtils.hasText(request.interests())) {
            return 0;
        }

        String routeText = String.join(",",
                nullToEmpty(route.getName()),
                nullToEmpty(route.getRouteType()),
                nullToEmpty(route.getDescription()),
                nullToEmpty(route.getSuitableFor()),
                nullToEmpty(route.getReason())
        );

        int score = 0;
        for (String interest : request.interests().split("[,，\\s]+")) {
            if (StringUtils.hasText(interest) && routeText.contains(interest.trim())) {
                score++;
            }
        }
        return score;
    }

    private String nullToEmpty(String value) {
        return value == null ? "" : value;
    }
}
