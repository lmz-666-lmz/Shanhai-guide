package com.softwarecup.shanhai.repository;

import com.softwarecup.shanhai.entity.CampusRoute;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CampusRouteRepository extends JpaRepository<CampusRoute, Long> {

    List<CampusRoute> findByEnabledTrueOrderByIdAsc();

    List<CampusRoute> findByRouteTypeAndEnabledTrueOrderByEstimatedDurationAsc(String routeType);

    List<CampusRoute> findAllByOrderByUpdatedAtDesc();

    List<CampusRoute> findByEnabledTrueOrderByUpdatedAtDesc();

    long countByEnabledTrue();
}
