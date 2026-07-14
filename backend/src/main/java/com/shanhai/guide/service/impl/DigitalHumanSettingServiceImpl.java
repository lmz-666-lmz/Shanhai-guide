package com.shanhai.guide.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.shanhai.guide.entity.TSystemConfig;
import com.shanhai.guide.entity.dto.DigitalHumanGlobalConfig;
import com.shanhai.guide.mapper.SystemConfigMapper;
import com.shanhai.guide.service.DigitalHumanSettingService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;

@Slf4j
@Service
public class DigitalHumanSettingServiceImpl implements DigitalHumanSettingService {

    private static final String CONFIG_KEY = "digital_human_global_config";

    private final SystemConfigMapper systemConfigMapper;
    private final ObjectMapper objectMapper;

    public DigitalHumanSettingServiceImpl(SystemConfigMapper systemConfigMapper, ObjectMapper objectMapper) {
        this.systemConfigMapper = systemConfigMapper;
        this.objectMapper = objectMapper;
    }

    @Override
    public DigitalHumanGlobalConfig getGlobalConfig() {
        TSystemConfig config = getConfigRecord();
        if (config == null || config.getConfigValue() == null || config.getConfigValue().isBlank()) {
            return new DigitalHumanGlobalConfig();
        }
        try {
            return mergeDefault(objectMapper.readValue(config.getConfigValue(), DigitalHumanGlobalConfig.class));
        } catch (Exception e) {
            log.warn("Failed to parse digital human global config: {}", e.getMessage());
            return new DigitalHumanGlobalConfig();
        }
    }

    @Override
    public DigitalHumanGlobalConfig saveGlobalConfig(DigitalHumanGlobalConfig config) {
        DigitalHumanGlobalConfig merged = mergeDefault(config);
        try {
            String value = objectMapper.writeValueAsString(merged);
            TSystemConfig record = getConfigRecord();
            if (record == null) {
                record = new TSystemConfig();
                record.setConfigKey(CONFIG_KEY);
                record.setConfigDesc("全局数字人默认配置");
                record.setConfigValue(value);
                systemConfigMapper.insert(record);
            } else {
                record.setConfigValue(value);
                record.setConfigDesc("全局数字人默认配置");
                systemConfigMapper.updateById(record);
            }
            return merged;
        } catch (Exception e) {
            throw new IllegalStateException("保存数字人配置失败", e);
        }
    }

    private TSystemConfig getConfigRecord() {
        LambdaQueryWrapper<TSystemConfig> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TSystemConfig::getConfigKey, CONFIG_KEY);
        return systemConfigMapper.selectOne(wrapper);
    }

    private DigitalHumanGlobalConfig mergeDefault(DigitalHumanGlobalConfig config) {
        DigitalHumanGlobalConfig defaults = new DigitalHumanGlobalConfig();
        if (config == null) return defaults;
        if (config.getDigitalHumanName() == null || config.getDigitalHumanName().isBlank()) {
            config.setDigitalHumanName(defaults.getDigitalHumanName());
        }
        if (config.getName() == null || config.getName().isBlank()) config.setName(config.getDigitalHumanName());
        config.setDigitalHumanName(config.getName());
        if (config.getAvatar() == null) config.setAvatar(defaults.getAvatar());
        if (config.getAvatarTheme() == null || config.getAvatarTheme().isBlank()) config.setAvatarTheme(defaults.getAvatarTheme());
        if (config.getStyle() == null || config.getStyle().isBlank()) config.setStyle(defaults.getStyle());
        if (config.getVoiceType() == null || config.getVoiceType().isBlank()) config.setVoiceType(defaults.getVoiceType());
        if (config.getSpeed() == null) config.setSpeed(defaults.getSpeed());
        if (config.getSpeechSpeed() == null) config.setSpeechSpeed(config.getSpeed());
        config.setSpeed(config.getSpeechSpeed());
        if (config.getVolume() == null) config.setVolume(defaults.getVolume());
        if (config.getPitch() == null) config.setPitch(defaults.getPitch());
        if (config.getAutoRead() == null) config.setAutoRead(defaults.getAutoRead());
        if (config.getSubtitleEnabled() == null) config.setSubtitleEnabled(defaults.getSubtitleEnabled());
        if (config.getWelcomeText() == null || config.getWelcomeText().isBlank()) config.setWelcomeText(defaults.getWelcomeText());
        if (config.getIntroduction() == null || config.getIntroduction().isBlank()) config.setIntroduction(defaults.getIntroduction());
        if (config.getGuideStyle() == null || config.getGuideStyle().isBlank()) config.setGuideStyle(defaults.getGuideStyle());
        if (config.getDefaultAnswerStyle() == null || config.getDefaultAnswerStyle().isBlank()) config.setDefaultAnswerStyle(defaults.getDefaultAnswerStyle());
        config.setCapabilities(mergeBooleanMap(defaults.getCapabilities(), config.getCapabilities()));
        if (config.getQuickQuestions() == null) config.setQuickQuestions(defaults.getQuickQuestions());
        if (config.getWelcomeTextsByMode() == null) config.setWelcomeTextsByMode(defaults.getWelcomeTextsByMode());
        config.setNavigationSettings(mergeObjectMap(defaults.getNavigationSettings(), config.getNavigationSettings()));
        config.setNarrationSettings(mergeObjectMap(defaults.getNarrationSettings(), config.getNarrationSettings()));
        config.setAccessibilitySettings(mergeObjectMap(defaults.getAccessibilitySettings(), config.getAccessibilitySettings()));
        config.setFallbackMessages(mergeStringMap(defaults.getFallbackMessages(), config.getFallbackMessages()));
        if (config.getUserAdjustableFields() == null) config.setUserAdjustableFields(defaults.getUserAdjustableFields());
        return config;
    }

    private Map<String, Boolean> mergeBooleanMap(Map<String, Boolean> defaults, Map<String, Boolean> value) {
        Map<String, Boolean> merged = new LinkedHashMap<>(defaults);
        if (value != null) merged.putAll(value);
        return merged;
    }

    private Map<String, Object> mergeObjectMap(Map<String, Object> defaults, Map<String, Object> value) {
        Map<String, Object> merged = new LinkedHashMap<>(defaults);
        if (value != null) merged.putAll(value);
        return merged;
    }

    private Map<String, String> mergeStringMap(Map<String, String> defaults, Map<String, String> value) {
        Map<String, String> merged = new LinkedHashMap<>(defaults);
        if (value != null) merged.putAll(value);
        return merged;
    }
}
