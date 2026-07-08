package com.softwarecup.shanhai.repository;

import com.softwarecup.shanhai.entity.KnowledgeDoc;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface KnowledgeDocRepository extends JpaRepository<KnowledgeDoc, Long> {

    long countByEnabledTrue();

    List<KnowledgeDoc> findAllByOrderByUpdatedAtDesc();

    List<KnowledgeDoc> findByEnabledTrueOrderByUpdatedAtDesc();
}
