package com.softwarecup.shanhai.repository;

import com.softwarecup.shanhai.entity.DigitalHumanConfig;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DigitalHumanConfigRepository extends JpaRepository<DigitalHumanConfig, Long> {

    Optional<DigitalHumanConfig> findFirstByEnabledTrueOrderByUpdatedAtDesc();

    List<DigitalHumanConfig> findAllByOrderByUpdatedAtDesc();
}
