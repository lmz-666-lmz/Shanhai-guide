package com.softwarecup.shanhai.repository;

import com.softwarecup.shanhai.entity.KnowledgeChunk;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface KnowledgeChunkRepository extends JpaRepository<KnowledgeChunk, Long> {

    List<KnowledgeChunk> findByEnabledTrueOrderByIdAsc();

    List<KnowledgeChunk> findTop8ByEnabledTrueAndContentContainingIgnoreCaseOrderByIdAsc(String keyword);

    List<KnowledgeChunk> findTop8ByEnabledTrueAndKeywordsContainingIgnoreCaseOrderByIdAsc(String keyword);

    List<KnowledgeChunk> findByEnabledTrueAndCategoryOrderByIdAsc(String category);

    List<KnowledgeChunk> findByDocIdOrderByIdAsc(Long docId);

    void deleteByDocId(Long docId);

    long countByDocId(Long docId);
}
