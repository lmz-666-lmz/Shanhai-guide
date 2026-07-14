package com.shanhai.guide.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.shanhai.guide.entity.TUserDigitalHumanConfig;
import com.shanhai.guide.entity.dto.DigitalHumanGlobalConfig;
import com.shanhai.guide.mapper.UserDigitalHumanConfigMapper;
import com.shanhai.guide.service.DigitalHumanSettingService;
import com.shanhai.guide.service.UserDigitalHumanConfigService;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;

@Service
public class UserDigitalHumanConfigServiceImpl extends ServiceImpl<UserDigitalHumanConfigMapper, TUserDigitalHumanConfig> 
        implements UserDigitalHumanConfigService {

    private final DigitalHumanSettingService settingService;

    public UserDigitalHumanConfigServiceImpl(DigitalHumanSettingService settingService) {
        this.settingService = settingService;
    }

    @Override
    public TUserDigitalHumanConfig getConfigBySessionId(String sessionId) {
        LambdaQueryWrapper<TUserDigitalHumanConfig> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TUserDigitalHumanConfig::getSessionId, sessionId);
        TUserDigitalHumanConfig config = getOne(wrapper);
        
        if (config == null) {
            DigitalHumanGlobalConfig globalConfig = settingService.getGlobalConfig();
            config = new TUserDigitalHumanConfig();
            config.setSessionId(sessionId);
            config.setAvatarUrl(globalConfig.getAvatar());
            config.setVoiceType(globalConfig.getVoiceType());
            config.setSpeechSpeed(globalConfig.getSpeed());
            config.setWelcomeText(globalConfig.getWelcomeText());
            config.setTalkStyle(globalConfig.getGuideStyle());
            save(config);
        }
        
        return config;
    }

    @Override
    public TUserDigitalHumanConfig saveOrUpdateConfig(String sessionId, String avatarUrl, String voiceType,
                                                      BigDecimal speechSpeed, String welcomeText, String talkStyle,
                                                      String configJson) {
        TUserDigitalHumanConfig config = getConfigBySessionId(sessionId);
        
        if (avatarUrl != null) {
            config.setAvatarUrl(avatarUrl);
        }
        if (voiceType != null) {
            config.setVoiceType(voiceType);
        }
        if (speechSpeed != null) {
            config.setSpeechSpeed(speechSpeed);
        }
        if (welcomeText != null) {
            config.setWelcomeText(welcomeText);
        }
        if (talkStyle != null) {
            config.setTalkStyle(talkStyle);
        }
        if (configJson != null) {
            config.setConfigJson(configJson);
            if (isLegacyEncodedWelcomeText(config.getWelcomeText())) {
                config.setWelcomeText(null);
            }
        }
        
        updateById(config);
        return config;
    }

    private boolean isLegacyEncodedWelcomeText(String value) {
        return value != null && (value.startsWith("@dh:") || value.startsWith("__DC__::")
                || value.startsWith("**DC**::") || value.startsWith("DC::"));
    }
}
