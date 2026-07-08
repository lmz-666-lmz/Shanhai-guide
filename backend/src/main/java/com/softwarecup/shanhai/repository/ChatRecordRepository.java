package com.softwarecup.shanhai.repository;

import com.softwarecup.shanhai.entity.ChatRecord;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface ChatRecordRepository extends JpaRepository<ChatRecord, Long> {

    long countBySuccessTrue();

    long countByCreatedAtBetween(LocalDateTime start, LocalDateTime end);

    Optional<ChatRecord> findFirstByOrderByCreatedAtDesc();

    List<ChatRecord> findTop20ByOrderByCreatedAtDesc();

    List<ChatRecord> findTop200ByOrderByCreatedAtDesc();

    @Query("select coalesce(c.userMode, '未知模式'), count(c) from ChatRecord c group by coalesce(c.userMode, '未知模式')")
    List<Object[]> countByUserModeGroup();

    @Query("select coalesce(c.emotion, 'unknown'), count(c) from ChatRecord c group by coalesce(c.emotion, 'unknown')")
    List<Object[]> countByEmotionGroup();

    @Query("select c.userMessage, count(c) from ChatRecord c where c.userMessage is not null and trim(c.userMessage) <> '' group by c.userMessage order by count(c) desc, c.userMessage asc")
    List<Object[]> findHotQuestions(Pageable pageable);

    @Query("select c.userMessage, count(c) from ChatRecord c where c.success <> true and c.userMessage is not null and trim(c.userMessage) <> '' group by c.userMessage order by count(c) desc, c.userMessage asc")
    List<Object[]> findFailedQuestions(Pageable pageable);
}
