package com.shanhai.guide.controller;

import com.shanhai.guide.common.ApiResponse;
import com.shanhai.guide.entity.dto.DigitalHumanGlobalConfig;
import com.shanhai.guide.service.DigitalHumanSettingService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/digital-human")
public class AdminDigitalHumanController {

    private final DigitalHumanSettingService settingService;

    public AdminDigitalHumanController(DigitalHumanSettingService settingService) {
        this.settingService = settingService;
    }

    @GetMapping("/config")
    public ApiResponse<DigitalHumanGlobalConfig> getConfig() {
        return ApiResponse.success(settingService.getGlobalConfig());
    }

    @PutMapping("/config")
    public ApiResponse<DigitalHumanGlobalConfig> saveConfig(@RequestBody DigitalHumanGlobalConfig config) {
        return ApiResponse.success(settingService.saveGlobalConfig(config));
    }

    @PostMapping("/config/reset")
    public ApiResponse<DigitalHumanGlobalConfig> resetConfig() {
        return ApiResponse.success(settingService.saveGlobalConfig(new DigitalHumanGlobalConfig()));
    }
}
