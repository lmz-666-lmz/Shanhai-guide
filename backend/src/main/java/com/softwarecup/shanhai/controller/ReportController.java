package com.softwarecup.shanhai.controller;

import com.softwarecup.shanhai.dto.VisitorInsightResponse;
import com.softwarecup.shanhai.service.DashboardService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/reports")
public class ReportController {

    private final DashboardService dashboardService;

    public ReportController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @GetMapping("/visitor-insight")
    public VisitorInsightResponse visitorInsight() {
        return dashboardService.visitorInsight();
    }
}
