package com.softwarecup.shanhai.controller;

import com.softwarecup.shanhai.dto.ChatTrendResponse;
import com.softwarecup.shanhai.dto.DashboardStatsResponse;
import com.softwarecup.shanhai.dto.HotQuestionResponse;
import com.softwarecup.shanhai.dto.RecentChatResponse;
import com.softwarecup.shanhai.dto.SentimentStatsResponse;
import com.softwarecup.shanhai.dto.VisitorModeStatsResponse;
import com.softwarecup.shanhai.service.DashboardService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/dashboard")
public class DashboardController {

    private final DashboardService dashboardService;

    public DashboardController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @GetMapping("/overview")
    public DashboardStatsResponse overview() {
        return dashboardService.overview();
    }

    @GetMapping("/hot-questions")
    public List<HotQuestionResponse> hotQuestions() {
        return dashboardService.hotQuestions();
    }

    @GetMapping("/user-modes")
    public List<VisitorModeStatsResponse> userModes() {
        return dashboardService.userModes();
    }

    @GetMapping("/sentiment")
    public List<SentimentStatsResponse> sentiment() {
        return dashboardService.sentiment();
    }

    @GetMapping("/recent-chats")
    public List<RecentChatResponse> recentChats() {
        return dashboardService.recentChats();
    }

    @GetMapping("/trend")
    public List<ChatTrendResponse> trend() {
        return dashboardService.trend();
    }
}
