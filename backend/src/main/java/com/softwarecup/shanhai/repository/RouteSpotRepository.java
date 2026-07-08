package com.softwarecup.shanhai.repository;

import com.softwarecup.shanhai.entity.RouteSpot;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RouteSpotRepository extends JpaRepository<RouteSpot, Long> {

    List<RouteSpot> findByRouteIdOrderBySortOrderAsc(Long routeId);

    boolean existsBySpotId(Long spotId);

    void deleteByRouteId(Long routeId);
}
