package com.shanhai.guide.controller;

import com.shanhai.guide.common.ApiResponse;
import com.shanhai.guide.service.UserMessageService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/user/messages")
public class UserMessageController {

    private final UserMessageService userMessageService;

    public UserMessageController(UserMessageService userMessageService) {
        this.userMessageService = userMessageService;
    }

    @GetMapping
    public ApiResponse<Map<String, Object>> getMessages(@RequestParam String sessionId,
                                                        @RequestParam(defaultValue = "1") int page,
                                                        @RequestParam(defaultValue = "20") int pageSize) {
        return ApiResponse.success(userMessageService.getMessages(sessionId, page, pageSize));
    }

    @GetMapping("/unread-count")
    public ApiResponse<Long> getUnreadCount(@RequestParam String sessionId) {
        return ApiResponse.success(userMessageService.getUnreadCount(sessionId));
    }

    @PostMapping("/{messageId}/read")
    public ApiResponse<Void> markRead(@PathVariable Long messageId, @RequestParam String sessionId) {
        userMessageService.markRead(sessionId, messageId);
        return ApiResponse.success();
    }

    @PostMapping("/read-all")
    public ApiResponse<Void> markAllRead(@RequestParam String sessionId) {
        userMessageService.markAllRead(sessionId);
        return ApiResponse.success();
    }

    @PostMapping("/{messageId}/hide")
    public ApiResponse<Void> hideMessage(@PathVariable Long messageId, @RequestParam String sessionId) {
        userMessageService.hideMessage(sessionId, messageId);
        return ApiResponse.success();
    }
}
