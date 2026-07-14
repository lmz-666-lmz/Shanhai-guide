package com.shanhai.guide.service;

import com.shanhai.guide.entity.dto.DigitalHumanGlobalConfig;

public interface DigitalHumanSettingService {

    DigitalHumanGlobalConfig getGlobalConfig();

    DigitalHumanGlobalConfig saveGlobalConfig(DigitalHumanGlobalConfig config);
}
