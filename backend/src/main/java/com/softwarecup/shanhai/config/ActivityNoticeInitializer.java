package com.softwarecup.shanhai.config;

import com.softwarecup.shanhai.entity.ActivityNotice;
import com.softwarecup.shanhai.repository.ActivityNoticeRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

@Component
@Order(4)
public class ActivityNoticeInitializer implements CommandLineRunner {

    private final ActivityNoticeRepository activityNoticeRepository;

    public ActivityNoticeInitializer(ActivityNoticeRepository activityNoticeRepository) {
        this.activityNoticeRepository = activityNoticeRepository;
    }

    @Override
    public void run(String... args) {
        if (activityNoticeRepository.count() > 0) {
            return;
        }

        LocalDateTime now = LocalDateTime.now();
        activityNoticeRepository.saveAll(List.of(
                createNotice("校友创新创业分享会", "活动", "邀请优秀校友分享创新创业经历，欢迎返校校友和在校学生参与交流。", "校友之家", now.plusDays(3).withHour(14).withMinute(0), now.plusDays(3).withHour(16).withMinute(0), 5),
                createNotice("校友夜谈活动", "活动", "围绕校园记忆、行业发展和母校变化开展轻松夜谈。", "海韵湖畔", now.plusDays(5).withHour(19).withMinute(0), now.plusDays(5).withHour(21).withMinute(0), 4),
                createNotice("校史馆周末延时开放公告", "服务", "本周末校史馆延时开放至 19:00，方便校友返校参观。", "山海校史馆", now.plusDays(6).withHour(9).withMinute(0), now.plusDays(7).withHour(19).withMinute(0), 3)
        ));
    }

    private ActivityNotice createNotice(String title, String type, String content, String location, LocalDateTime startTime, LocalDateTime endTime, Integer priority) {
        ActivityNotice notice = new ActivityNotice();
        notice.setTitle(title);
        notice.setNoticeType(type);
        notice.setContent(content);
        notice.setLocation(location);
        notice.setStartTime(startTime);
        notice.setEndTime(endTime);
        notice.setPriority(priority);
        notice.setEnabled(true);
        return notice;
    }
}
