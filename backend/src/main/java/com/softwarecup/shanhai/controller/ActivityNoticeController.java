package com.softwarecup.shanhai.controller;

import com.softwarecup.shanhai.dto.ActivityNoticeResponse;
import com.softwarecup.shanhai.service.ActivityNoticeService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

@RestController
@RequestMapping("/api/notices")
public class ActivityNoticeController {

    private final ActivityNoticeService activityNoticeService;

    public ActivityNoticeController(ActivityNoticeService activityNoticeService) {
        this.activityNoticeService = activityNoticeService;
    }

    @GetMapping
    public List<ActivityNoticeResponse> listNotices() {
        return activityNoticeService.listEnabledNotices();
    }

    @GetMapping("/{id}")
    public ActivityNoticeResponse getNotice(@PathVariable Long id) {
        return activityNoticeService.getEnabledNotice(id);
    }

    @ExceptionHandler(NoSuchElementException.class)
    public ResponseEntity<Map<String, Object>> handleNotFound(NoSuchElementException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("status", 404, "message", ex.getMessage()));
    }
}
