package com.softwarecup.shanhai.controller;

import com.softwarecup.shanhai.dto.ActivityNoticeRequest;
import com.softwarecup.shanhai.dto.ActivityNoticeResponse;
import com.softwarecup.shanhai.service.ActivityNoticeService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/notices")
public class AdminActivityNoticeController {

    private final ActivityNoticeService activityNoticeService;

    public AdminActivityNoticeController(ActivityNoticeService activityNoticeService) {
        this.activityNoticeService = activityNoticeService;
    }

    @GetMapping
    public List<ActivityNoticeResponse> listNotices(@RequestParam(required = false) Boolean enabled, @RequestParam(required = false) String noticeType) {
        return activityNoticeService.listAdminNotices(enabled, noticeType);
    }

    @GetMapping("/{id}")
    public ActivityNoticeResponse getNotice(@PathVariable Long id) {
        return activityNoticeService.getAdminNotice(id);
    }

    @PostMapping
    public ResponseEntity<ActivityNoticeResponse> createNotice(@Valid @RequestBody ActivityNoticeRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(activityNoticeService.createNotice(request));
    }

    @PutMapping("/{id}")
    public ActivityNoticeResponse updateNotice(@PathVariable Long id, @Valid @RequestBody ActivityNoticeRequest request) {
        return activityNoticeService.updateNotice(id, request);
    }

    @PatchMapping("/{id}/enabled")
    public ActivityNoticeResponse setEnabled(@PathVariable Long id, @RequestParam Boolean enabled) {
        return activityNoticeService.setEnabled(id, enabled);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteNotice(@PathVariable Long id) {
        activityNoticeService.deleteNotice(id);
        return ResponseEntity.noContent().build();
    }

    @ExceptionHandler(NoSuchElementException.class)
    public ResponseEntity<Map<String, Object>> handleNotFound(NoSuchElementException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("status", 404, "message", ex.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream().map(error -> error.getField() + "：" + error.getDefaultMessage()).collect(Collectors.joining("；"));
        return ResponseEntity.badRequest().body(Map.of("status", 400, "message", message));
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<Map<String, Object>> handleMissingParam(MissingServletRequestParameterException ex) {
        return ResponseEntity.badRequest().body(Map.of("status", 400, "message", "缺少必要参数：" + ex.getParameterName()));
    }
}
