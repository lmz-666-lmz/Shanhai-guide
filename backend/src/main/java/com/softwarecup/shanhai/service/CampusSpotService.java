package com.softwarecup.shanhai.service;

import com.softwarecup.shanhai.dto.CampusSpotResponse;
import com.softwarecup.shanhai.entity.CampusSpot;
import com.softwarecup.shanhai.repository.CampusSpotRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class CampusSpotService {

    private final CampusSpotRepository campusSpotRepository;

    public CampusSpotService(CampusSpotRepository campusSpotRepository) {
        this.campusSpotRepository = campusSpotRepository;
    }

    public List<CampusSpotResponse> listEnabledSpots() {
        return campusSpotRepository.findByEnabledTrueOrderByIdAsc()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public CampusSpotResponse getSpotById(Long id) {
        CampusSpot spot = campusSpotRepository.findById(id)
                .filter(item -> Boolean.TRUE.equals(item.getEnabled()))
                .orElseThrow(() -> new IllegalArgumentException("未找到该校园点位，可能已下线或不存在"));

        return toResponse(spot);
    }

    public List<CampusSpotResponse> listByType(String type) {
        return campusSpotRepository.findByTypeAndEnabledTrueOrderByIdAsc(type)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private CampusSpotResponse toResponse(CampusSpot spot) {
        return new CampusSpotResponse(
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
                spot.getEnabled()
        );
    }
}
