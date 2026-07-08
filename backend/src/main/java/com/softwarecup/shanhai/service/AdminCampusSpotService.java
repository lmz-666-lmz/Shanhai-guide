package com.softwarecup.shanhai.service;

import com.softwarecup.shanhai.dto.CampusSpotAdminResponse;
import com.softwarecup.shanhai.dto.CampusSpotRequest;
import com.softwarecup.shanhai.entity.CampusSpot;
import com.softwarecup.shanhai.repository.CampusSpotRepository;
import com.softwarecup.shanhai.repository.RouteSpotRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.NoSuchElementException;

@Service
public class AdminCampusSpotService {

    private final CampusSpotRepository campusSpotRepository;
    private final RouteSpotRepository routeSpotRepository;

    public AdminCampusSpotService(
            CampusSpotRepository campusSpotRepository,
            RouteSpotRepository routeSpotRepository
    ) {
        this.campusSpotRepository = campusSpotRepository;
        this.routeSpotRepository = routeSpotRepository;
    }

    @Transactional(readOnly = true)
    public List<CampusSpotAdminResponse> listSpots(Boolean enabled, String type) {
        List<CampusSpot> spots;
        if (enabled == null) {
            spots = campusSpotRepository.findAllByOrderByUpdatedAtDesc();
        } else if (Boolean.TRUE.equals(enabled)) {
            spots = campusSpotRepository.findByEnabledTrueOrderByUpdatedAtDesc();
        } else {
            spots = campusSpotRepository.findAllByOrderByUpdatedAtDesc()
                    .stream()
                    .filter(spot -> !Boolean.TRUE.equals(spot.getEnabled()))
                    .toList();
        }

        if (StringUtils.hasText(type)) {
            String trimmedType = type.trim();
            spots = spots.stream()
                    .filter(spot -> trimmedType.equals(spot.getType()))
                    .toList();
        }

        return spots.stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public CampusSpotAdminResponse getSpot(Long id) {
        return toResponse(findSpot(id));
    }

    @Transactional
    public CampusSpotAdminResponse createSpot(CampusSpotRequest request) {
        String name = trim(request.name());
        if (campusSpotRepository.existsByName(name)) {
            throw new IllegalArgumentException("点位名称已存在：" + name);
        }

        CampusSpot spot = new CampusSpot();
        fillSpot(spot, request);

        return toResponse(campusSpotRepository.save(spot));
    }

    @Transactional
    public CampusSpotAdminResponse updateSpot(Long id, CampusSpotRequest request) {
        CampusSpot spot = findSpot(id);
        String name = trim(request.name());
        campusSpotRepository.findByName(name)
                .filter(existing -> !existing.getId().equals(id))
                .ifPresent(existing -> {
                    throw new IllegalArgumentException("点位名称已存在：" + name);
                });

        fillSpot(spot, request);

        return toResponse(campusSpotRepository.save(spot));
    }

    @Transactional
    public CampusSpotAdminResponse setEnabled(Long id, Boolean enabled) {
        CampusSpot spot = findSpot(id);
        spot.setEnabled(Boolean.TRUE.equals(enabled));

        return toResponse(campusSpotRepository.save(spot));
    }

    @Transactional
    public CampusSpotAdminResponse deleteSpot(Long id) {
        CampusSpot spot = findSpot(id);
        if (routeSpotRepository.existsBySpotId(id)) {
            spot.setEnabled(false);
            return toResponse(campusSpotRepository.save(spot));
        }

        CampusSpotAdminResponse response = toResponse(spot);
        campusSpotRepository.delete(spot);
        return response;
    }

    private CampusSpot findSpot(Long id) {
        return campusSpotRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("校园点位不存在，id=" + id));
    }

    private void fillSpot(CampusSpot spot, CampusSpotRequest request) {
        spot.setName(trim(request.name()));
        spot.setType(trim(request.type()));
        spot.setDescription(trim(request.description()));
        spot.setStory(trim(request.story()));
        spot.setLatitude(request.latitude());
        spot.setLongitude(request.longitude());
        spot.setOpenTime(trim(request.openTime()));
        spot.setRecommendedDuration(request.recommendedDuration());
        spot.setTags(trimToNull(request.tags()));
        spot.setImageUrl(trimToNull(request.imageUrl()));
        spot.setEnabled(request.enabled() == null || Boolean.TRUE.equals(request.enabled()));
    }

    private CampusSpotAdminResponse toResponse(CampusSpot spot) {
        return new CampusSpotAdminResponse(
                spot.getId(),
                spot.getName(),
                spot.getType(),
                spot.getDescription(),
                spot.getStory(),
                spot.getLatitude(),
                spot.getLongitude(),
                spot.getOpenTime(),
                spot.getRecommendedDuration(),
                spot.getTags(),
                spot.getImageUrl(),
                spot.getEnabled(),
                spot.getCreatedAt(),
                spot.getUpdatedAt()
        );
    }

    private String trim(String value) {
        return value == null ? "" : value.trim();
    }

    private String trimToNull(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }

        return value.trim();
    }
}
