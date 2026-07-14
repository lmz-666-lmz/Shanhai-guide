package com.shanhai.guide.controller;

import com.shanhai.guide.common.ApiResponse;
import com.shanhai.guide.entity.TUserContentApplication;
import com.shanhai.guide.service.UserContentApplicationService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/user/content-applications")
public class UserContentApplicationController {

    private final UserContentApplicationService applicationService;

    public UserContentApplicationController(UserContentApplicationService applicationService) {
        this.applicationService = applicationService;
    }

    @PostMapping("/spots")
    public ApiResponse<TUserContentApplication> submitSpot(@RequestBody TUserContentApplication application) {
        return ApiResponse.success(applicationService.submitSpotApplication(application));
    }

    @PostMapping("/routes")
    public ApiResponse<TUserContentApplication> submitRoute(@RequestBody TUserContentApplication application) {
        return ApiResponse.success(applicationService.submitRouteApplication(application));
    }

    @GetMapping("/my")
    public ApiResponse<List<TUserContentApplication>> getMyApplications(@RequestParam String sessionId,
                                                                        @RequestParam(required = false) String applicationType,
                                                                        @RequestParam(required = false) Integer status) {
        return ApiResponse.success(applicationService.getMyApplications(sessionId, applicationType, status));
    }

    @GetMapping("/{applicationId}")
    public ApiResponse<TUserContentApplication> getMyApplication(@PathVariable Long applicationId,
                                                                 @RequestParam String sessionId) {
        return ApiResponse.success(applicationService.getMyApplication(sessionId, applicationId));
    }

    @PostMapping("/{applicationId}/withdraw")
    public ApiResponse<TUserContentApplication> withdraw(@PathVariable Long applicationId,
                                                         @RequestParam String sessionId) {
        return ApiResponse.success(applicationService.withdrawApplication(sessionId, applicationId));
    }
}
