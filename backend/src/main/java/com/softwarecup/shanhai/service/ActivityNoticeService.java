package com.softwarecup.shanhai.service;

import com.softwarecup.shanhai.dto.ActivityNoticeRequest;
import com.softwarecup.shanhai.dto.ActivityNoticeResponse;
import com.softwarecup.shanhai.entity.ActivityNotice;
import com.softwarecup.shanhai.repository.ActivityNoticeRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.NoSuchElementException;

@Service
public class ActivityNoticeService {

    private final ActivityNoticeRepository activityNoticeRepository;

    public ActivityNoticeService(ActivityNoticeRepository activityNoticeRepository) {
        this.activityNoticeRepository = activityNoticeRepository;
    }

    @Transactional(readOnly = true)
    public List<ActivityNoticeResponse> listEnabledNotices() {
        return activityNoticeRepository.findByEnabledTrueOrderByPriorityDescStartTimeAsc().stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public ActivityNoticeResponse getEnabledNotice(Long id) {
        ActivityNotice notice = findNotice(id);
        if (!Boolean.TRUE.equals(notice.getEnabled())) {
            throw new NoSuchElementException("公告不存在或已下线，id=" + id);
        }
        return toResponse(notice);
    }

    @Transactional(readOnly = true)
    public List<ActivityNoticeResponse> listAdminNotices(Boolean enabled, String noticeType) {
        List<ActivityNotice> notices = enabled == null
                ? activityNoticeRepository.findAllByOrderByUpdatedAtDesc()
                : Boolean.TRUE.equals(enabled)
                ? activityNoticeRepository.findByEnabledTrueOrderByUpdatedAtDesc()
                : activityNoticeRepository.findAllByOrderByUpdatedAtDesc().stream().filter(notice -> !Boolean.TRUE.equals(notice.getEnabled())).toList();
        if (StringUtils.hasText(noticeType)) {
            String type = noticeType.trim();
            notices = notices.stream().filter(notice -> type.equals(notice.getNoticeType())).toList();
        }
        return notices.stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public ActivityNoticeResponse getAdminNotice(Long id) {
        return toResponse(findNotice(id));
    }

    @Transactional
    public ActivityNoticeResponse createNotice(ActivityNoticeRequest request) {
        ActivityNotice notice = new ActivityNotice();
        fillNotice(notice, request);
        return toResponse(activityNoticeRepository.save(notice));
    }

    @Transactional
    public ActivityNoticeResponse updateNotice(Long id, ActivityNoticeRequest request) {
        ActivityNotice notice = findNotice(id);
        fillNotice(notice, request);
        return toResponse(activityNoticeRepository.save(notice));
    }

    @Transactional
    public ActivityNoticeResponse setEnabled(Long id, Boolean enabled) {
        ActivityNotice notice = findNotice(id);
        notice.setEnabled(Boolean.TRUE.equals(enabled));
        return toResponse(activityNoticeRepository.save(notice));
    }

    @Transactional
    public void deleteNotice(Long id) {
        activityNoticeRepository.delete(findNotice(id));
    }

    private ActivityNotice findNotice(Long id) {
        return activityNoticeRepository.findById(id).orElseThrow(() -> new NoSuchElementException("公告不存在，id=" + id));
    }

    private void fillNotice(ActivityNotice notice, ActivityNoticeRequest request) {
        notice.setTitle(trim(request.title()));
        notice.setNoticeType(trim(request.noticeType()));
        notice.setContent(trim(request.content()));
        notice.setLocation(trimToNull(request.location()));
        notice.setStartTime(request.startTime());
        notice.setEndTime(request.endTime());
        notice.setPriority(request.priority() == null ? 0 : request.priority());
        notice.setEnabled(request.enabled() == null || Boolean.TRUE.equals(request.enabled()));
    }

    private ActivityNoticeResponse toResponse(ActivityNotice notice) {
        return new ActivityNoticeResponse(notice.getId(), notice.getTitle(), notice.getNoticeType(), notice.getContent(), notice.getLocation(), notice.getStartTime(), notice.getEndTime(), notice.getPriority(), notice.getEnabled(), notice.getCreatedAt(), notice.getUpdatedAt());
    }

    private String trim(String value) { return value == null ? "" : value.trim(); }
    private String trimToNull(String value) { return StringUtils.hasText(value) ? value.trim() : null; }
}
