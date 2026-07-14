package com.shanhai.guide.controller;

import com.shanhai.guide.common.ApiResponse;
import com.shanhai.guide.entity.TUserDigitalHumanConfig;
import com.shanhai.guide.entity.dto.DigitalHumanGlobalConfig;
import com.shanhai.guide.service.DigitalHumanSettingService;
import com.shanhai.guide.service.UserDigitalHumanConfigService;
import com.shanhai.guide.service.SessionGuardService;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/digital-human")
public class DigitalHumanController {

    private final UserDigitalHumanConfigService configService;
    private final SessionGuardService sessionGuardService;
    private final DigitalHumanSettingService settingService;

    public DigitalHumanController(UserDigitalHumanConfigService configService,
                                  SessionGuardService sessionGuardService,
                                  DigitalHumanSettingService settingService) {
        this.configService = configService;
        this.sessionGuardService = sessionGuardService;
        this.settingService = settingService;
    }

    @GetMapping("/config")
    public ApiResponse<TUserDigitalHumanConfig> getConfig(@RequestParam String sessionId) {
        sessionGuardService.requireActiveUserAction(sessionId);
        TUserDigitalHumanConfig config = configService.getConfigBySessionId(sessionId);
        return ApiResponse.success(config);
    }

    @GetMapping("/global-config")
    public ApiResponse<DigitalHumanGlobalConfig> getGlobalConfig() {
        return ApiResponse.success(settingService.getGlobalConfig());
    }

    @PostMapping("/config")
    public ApiResponse<TUserDigitalHumanConfig> updateConfig(
            @RequestParam String sessionId,
            @RequestParam(required = false) String avatarUrl,
            @RequestParam(required = false) String voiceType,
            @RequestParam(required = false) BigDecimal speechSpeed,
            @RequestParam(required = false) String welcomeText,
            @RequestParam(required = false) String talkStyle,
            @RequestParam(required = false) String configJson) {
        
        sessionGuardService.requireActiveUserAction(sessionId);
        TUserDigitalHumanConfig config = configService.saveOrUpdateConfig(sessionId, avatarUrl, voiceType, 
                                                                          speechSpeed, welcomeText, talkStyle, configJson);
        return ApiResponse.success(config);
    }

    @GetMapping("/options")
    public ApiResponse<Map<String, Object>> getOptions() {
        Map<String, Object> options = new HashMap<>();
        
        options.put("avatarStyles", new String[]{"校园讲解员", "青春学子", "资深教授", "活泼向导", "长者友好"});
        
        options.put("voiceTypes", new String[]{
            "温柔女声", "亲切男声", "活力女声", "沉稳男声"
        });
        
        options.put("talkStyles", new String[]{
            "标准", "校友", "新生", "家长", "研学", "长者", "长者友好"
        });
        
        return ApiResponse.success(options);
    }
}
