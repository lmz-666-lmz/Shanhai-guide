package com.shanhai.guide.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.shanhai.guide.entity.TUserDigitalHumanConfig;

public interface UserDigitalHumanConfigService extends IService<TUserDigitalHumanConfig> {
    
    TUserDigitalHumanConfig getConfigBySessionId(String sessionId);
    
    TUserDigitalHumanConfig saveOrUpdateConfig(String sessionId, String avatarUrl, String voiceType, 
                                               java.math.BigDecimal speechSpeed, String welcomeText, String talkStyle,
                                               String configJson);
}
