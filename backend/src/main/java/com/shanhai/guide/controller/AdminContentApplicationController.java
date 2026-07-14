package com.shanhai.guide.controller;

import com.shanhai.guide.common.ApiResponse;
import com.shanhai.guide.entity.TUserContentApplication;
import com.shanhai.guide.service.UserContentApplicationService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/content-applications")
public class AdminContentApplicationController {

    private final UserContentApplicationService applicationService;

    public AdminContentApplicationController(UserContentApplicationService applicationService) {
        this.applicationService = applicationService;
    }

    @GetMapping
    public ApiResponse<Map<String, Object>> getApplications(@RequestParam(required = false) String applicationType,
                                                            @RequestParam(required = false) String status,
                                                            @RequestParam(required = false) String keyword,
                                                            @RequestParam(required = false) String applicant,
                                                            @RequestParam(required = false) String startTime,
                                                            @RequestParam(required = false) String endTime) {
        Integer statusValue = parseStatus(status);
        List<TUserContentApplication> records = applicationService.getAdminApplications(applicationType, statusValue, keyword, applicant, startTime, endTime);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("records", records);
        result.put("stats", buildStats());
        return ApiResponse.success(result);
    }

    @GetMapping("/{applicationId}")
    public ApiResponse<TUserContentApplication> getApplication(@PathVariable Long applicationId) {
        TUserContentApplication application = applicationService.getById(applicationId);
        return application == null ? ApiResponse.error(404, "申请不存在") : ApiResponse.success(application);
    }

    @PostMapping("/{applicationId}/approve")
    public ApiResponse<TUserContentApplication> approve(@PathVariable Long applicationId,
                                                        @RequestBody TUserContentApplication changes) {
        return ApiResponse.success(applicationService.approveApplication(applicationId, changes, changes.getAuditComment()));
    }

    @PostMapping("/{applicationId}/reject")
    public ApiResponse<TUserContentApplication> reject(@PathVariable Long applicationId,
                                                       @RequestBody(required = false) Map<String, String> body) {
        String auditComment = body == null ? null : body.get("auditComment");
        return ApiResponse.success(applicationService.rejectApplication(applicationId, auditComment));
    }

    private Map<String, Object> buildStats() {
        List<TUserContentApplication> all = applicationService.list();
        LocalDate today = com.shanhai.guide.service.TimeProvider.today();
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("pendingSpot", all.stream().filter(item -> "spot".equals(item.getApplicationType()) && Integer.valueOf(0).equals(item.getStatus())).count());
        stats.put("pendingRoute", all.stream().filter(item -> "route".equals(item.getApplicationType()) && Integer.valueOf(0).equals(item.getStatus())).count());
        stats.put("todayCount", all.stream().filter(item -> item.getCreateTime() != null && item.getCreateTime().toLocalDate().equals(today)).count());
        stats.put("approvedCount", all.stream().filter(item -> Integer.valueOf(1).equals(item.getStatus())).count());
        stats.put("rejectedCount", all.stream().filter(item -> Integer.valueOf(2).equals(item.getStatus())).count());
        return stats;
    }

    private Integer parseStatus(String status) {
        if (status == null || status.isBlank()) return null;
        String normalized = status.trim().toLowerCase();
        if (normalized.matches("\\d+")) return Integer.parseInt(normalized);
        return switch (normalized) {
            case "pending" -> 0;
            case "approved" -> 1;
            case "rejected" -> 2;
            case "withdrawn" -> 3;
            default -> null;
        };
    }
}
