package com.softwarecup.shanhai.repository;

import com.softwarecup.shanhai.entity.ActivityNotice;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ActivityNoticeRepository extends JpaRepository<ActivityNotice, Long> {

    List<ActivityNotice> findByEnabledTrueOrderByPriorityDescStartTimeAsc();

    List<ActivityNotice> findAllByOrderByUpdatedAtDesc();

    List<ActivityNotice> findByEnabledTrueOrderByUpdatedAtDesc();
}
