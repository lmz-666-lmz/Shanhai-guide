package com.softwarecup.shanhai.repository;

import com.softwarecup.shanhai.entity.CampusSpot;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CampusSpotRepository extends JpaRepository<CampusSpot, Long> {

    List<CampusSpot> findByEnabledTrueOrderByIdAsc();

    List<CampusSpot> findByTypeAndEnabledTrueOrderByIdAsc(String type);

    List<CampusSpot> findAllByOrderByUpdatedAtDesc();

    List<CampusSpot> findByEnabledTrueOrderByUpdatedAtDesc();

    Optional<CampusSpot> findByName(String name);

    boolean existsByName(String name);
}
