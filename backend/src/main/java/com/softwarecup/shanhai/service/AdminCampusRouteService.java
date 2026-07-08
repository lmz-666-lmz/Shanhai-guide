package com.softwarecup.shanhai.service;

import com.softwarecup.shanhai.dto.AdminRouteRequest;
import com.softwarecup.shanhai.dto.AdminRouteResponse;
import com.softwarecup.shanhai.dto.RouteSpotAdminRequest;
import com.softwarecup.shanhai.dto.RouteSpotAdminResponse;
import com.softwarecup.shanhai.entity.CampusRoute;
import com.softwarecup.shanhai.entity.CampusSpot;
import com.softwarecup.shanhai.entity.RouteSpot;
import com.softwarecup.shanhai.repository.CampusRouteRepository;
import com.softwarecup.shanhai.repository.CampusSpotRepository;
import com.softwarecup.shanhai.repository.RouteSpotRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class AdminCampusRouteService {

    private final CampusRouteRepository campusRouteRepository;
    private final RouteSpotRepository routeSpotRepository;
    private final CampusSpotRepository campusSpotRepository;

    public AdminCampusRouteService(CampusRouteRepository campusRouteRepository, RouteSpotRepository routeSpotRepository, CampusSpotRepository campusSpotRepository) {
        this.campusRouteRepository = campusRouteRepository;
        this.routeSpotRepository = routeSpotRepository;
        this.campusSpotRepository = campusSpotRepository;
    }

    @Transactional(readOnly = true)
    public List<AdminRouteResponse> listRoutes(Boolean enabled, String routeType) {
        List<CampusRoute> routes = enabled == null
                ? campusRouteRepository.findAllByOrderByUpdatedAtDesc()
                : Boolean.TRUE.equals(enabled)
                ? campusRouteRepository.findByEnabledTrueOrderByUpdatedAtDesc()
                : campusRouteRepository.findAllByOrderByUpdatedAtDesc().stream().filter(route -> !Boolean.TRUE.equals(route.getEnabled())).toList();

        if (StringUtils.hasText(routeType)) {
            String type = routeType.trim();
            routes = routes.stream().filter(route -> type.equals(route.getRouteType())).toList();
        }

        return routes.stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public AdminRouteResponse getRoute(Long id) {
        return toResponse(findRoute(id));
    }

    @Transactional
    public AdminRouteResponse createRoute(AdminRouteRequest request) {
        CampusRoute route = new CampusRoute();
        fillRoute(route, request);
        CampusRoute savedRoute = campusRouteRepository.save(route);
        saveRouteSpots(savedRoute.getId(), request.spots());
        return toResponse(savedRoute);
    }

    @Transactional
    public AdminRouteResponse updateRoute(Long id, AdminRouteRequest request) {
        CampusRoute route = findRoute(id);
        fillRoute(route, request);
        CampusRoute savedRoute = campusRouteRepository.save(route);
        routeSpotRepository.deleteByRouteId(savedRoute.getId());
        saveRouteSpots(savedRoute.getId(), request.spots());
        return toResponse(savedRoute);
    }

    @Transactional
    public AdminRouteResponse setEnabled(Long id, Boolean enabled) {
        CampusRoute route = findRoute(id);
        route.setEnabled(Boolean.TRUE.equals(enabled));
        return toResponse(campusRouteRepository.save(route));
    }

    @Transactional
    public void deleteRoute(Long id) {
        CampusRoute route = findRoute(id);
        routeSpotRepository.deleteByRouteId(route.getId());
        campusRouteRepository.delete(route);
    }

    private CampusRoute findRoute(Long id) {
        return campusRouteRepository.findById(id).orElseThrow(() -> new NoSuchElementException("校园路线不存在，id=" + id));
    }

    private void fillRoute(CampusRoute route, AdminRouteRequest request) {
        route.setName(trim(request.name()));
        route.setRouteType(trim(request.routeType()));
        route.setDescription(trim(request.description()));
        route.setSuitableFor(trim(request.suitableFor()));
        route.setEstimatedDuration(request.estimatedDuration());
        route.setDistanceText(trim(request.distanceText()));
        route.setReason(trim(request.reason()));
        route.setEnabled(request.enabled() == null || Boolean.TRUE.equals(request.enabled()));
    }

    private void saveRouteSpots(Long routeId, List<RouteSpotAdminRequest> spotRequests) {
        List<RouteSpot> routeSpots = spotRequests.stream()
                .sorted(Comparator.comparing(RouteSpotAdminRequest::sortOrder))
                .map(request -> {
                    campusSpotRepository.findById(request.spotId()).orElseThrow(() -> new IllegalArgumentException("路线点位不存在，spotId=" + request.spotId()));
                    RouteSpot routeSpot = new RouteSpot();
                    routeSpot.setRouteId(routeId);
                    routeSpot.setSpotId(request.spotId());
                    routeSpot.setSortOrder(request.sortOrder());
                    routeSpot.setStayMinutes(request.stayMinutes());
                    routeSpot.setNote(trimToNull(request.note()));
                    return routeSpot;
                })
                .toList();
        routeSpotRepository.saveAll(routeSpots);
    }

    private AdminRouteResponse toResponse(CampusRoute route) {
        List<RouteSpot> routeSpots = routeSpotRepository.findByRouteIdOrderBySortOrderAsc(route.getId());
        Map<Long, CampusSpot> spotMap = campusSpotRepository.findAllById(routeSpots.stream().map(RouteSpot::getSpotId).toList())
                .stream()
                .collect(Collectors.toMap(CampusSpot::getId, Function.identity()));
        List<RouteSpotAdminResponse> spots = routeSpots.stream()
                .map(routeSpot -> {
                    CampusSpot spot = spotMap.get(routeSpot.getSpotId());
                    return new RouteSpotAdminResponse(routeSpot.getSpotId(), spot == null ? "点位不存在" : spot.getName(), spot == null ? "-" : spot.getType(), routeSpot.getSortOrder(), routeSpot.getStayMinutes(), routeSpot.getNote());
                })
                .toList();
        return new AdminRouteResponse(route.getId(), route.getName(), route.getRouteType(), route.getDescription(), route.getSuitableFor(), route.getEstimatedDuration(), route.getDistanceText(), route.getReason(), route.getEnabled(), route.getCreatedAt(), route.getUpdatedAt(), spots);
    }

    private String trim(String value) { return value == null ? "" : value.trim(); }
    private String trimToNull(String value) { return StringUtils.hasText(value) ? value.trim() : null; }
}
