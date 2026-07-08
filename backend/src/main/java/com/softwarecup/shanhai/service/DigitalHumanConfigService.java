package com.softwarecup.shanhai.service;

import com.softwarecup.shanhai.dto.DigitalHumanConfigRequest;
import com.softwarecup.shanhai.dto.DigitalHumanConfigResponse;
import com.softwarecup.shanhai.entity.DigitalHumanConfig;
import com.softwarecup.shanhai.repository.DigitalHumanConfigRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.NoSuchElementException;

@Service
public class DigitalHumanConfigService {

    private final DigitalHumanConfigRepository digitalHumanConfigRepository;

    public DigitalHumanConfigService(DigitalHumanConfigRepository digitalHumanConfigRepository) {
        this.digitalHumanConfigRepository = digitalHumanConfigRepository;
    }

    @Transactional(readOnly = true)
    public DigitalHumanConfigResponse getCurrentConfig() {
        return digitalHumanConfigRepository.findFirstByEnabledTrueOrderByUpdatedAtDesc()
                .map(this::toResponse)
                .or(() -> digitalHumanConfigRepository.findAllByOrderByUpdatedAtDesc().stream().findFirst().map(this::toCurrentResponse))
                .orElseGet(this::defaultResponse);
    }

    @Transactional(readOnly = true)
    public List<DigitalHumanConfigResponse> listConfigs() {
        return digitalHumanConfigRepository.findAllByOrderByUpdatedAtDesc().stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public DigitalHumanConfigResponse getConfig(Long id) {
        return toResponse(findConfig(id));
    }

    @Transactional
    public DigitalHumanConfigResponse createConfig(DigitalHumanConfigRequest request) {
        DigitalHumanConfig config = new DigitalHumanConfig();
        fillConfig(config, request);
        if (Boolean.TRUE.equals(config.getEnabled())) {
            disableOthers(null);
        }
        return toResponse(digitalHumanConfigRepository.save(config));
    }

    @Transactional
    public DigitalHumanConfigResponse updateConfig(Long id, DigitalHumanConfigRequest request) {
        DigitalHumanConfig config = findConfig(id);
        fillConfig(config, request);
        if (Boolean.TRUE.equals(config.getEnabled())) {
            disableOthers(id);
        }
        return toResponse(digitalHumanConfigRepository.save(config));
    }

    @Transactional
    public DigitalHumanConfigResponse setEnabled(Long id, Boolean enabled) {
        DigitalHumanConfig config = findConfig(id);
        boolean enabledValue = Boolean.TRUE.equals(enabled);
        if (enabledValue) {
            disableOthers(id);
        }
        config.setEnabled(enabledValue);
        return toResponse(digitalHumanConfigRepository.save(config));
    }

    @Transactional
    public void deleteConfig(Long id) {
        digitalHumanConfigRepository.delete(findConfig(id));
    }

    private DigitalHumanConfig findConfig(Long id) {
        return digitalHumanConfigRepository.findById(id).orElseThrow(() -> new NoSuchElementException("数字人配置不存在，id=" + id));
    }

    private void disableOthers(Long currentId) {
        List<DigitalHumanConfig> configs = digitalHumanConfigRepository.findAll();
        configs.forEach(config -> {
            if (currentId == null || !config.getId().equals(currentId)) {
                config.setEnabled(false);
            }
        });
        digitalHumanConfigRepository.saveAll(configs);
    }

    private void fillConfig(DigitalHumanConfig config, DigitalHumanConfigRequest request) {
        config.setName(trim(request.name()));
        config.setAvatarText(trim(request.avatarText()));
        config.setRoleTitle(trim(request.roleTitle()));
        config.setWelcomeText(trim(request.welcomeText()));
        config.setVoiceName(StringUtils.hasText(request.voiceName()) ? request.voiceName().trim() : "默认");
        config.setStylePreset(StringUtils.hasText(request.stylePreset()) ? request.stylePreset().trim() : "科技蓝紫");
        config.setEnabled(Boolean.TRUE.equals(request.enabled()));
    }

    private DigitalHumanConfigResponse toResponse(DigitalHumanConfig config) {
        return new DigitalHumanConfigResponse(config.getId(), config.getName(), config.getAvatarText(), config.getRoleTitle(), config.getWelcomeText(), config.getVoiceName(), config.getStylePreset(), config.getEnabled(), config.getCreatedAt(), config.getUpdatedAt());
    }

    private DigitalHumanConfigResponse toCurrentResponse(DigitalHumanConfig config) {
        return new DigitalHumanConfigResponse(config.getId(), config.getName(), config.getAvatarText(), config.getRoleTitle(), config.getWelcomeText(), config.getVoiceName(), config.getStylePreset(), true, config.getCreatedAt(), config.getUpdatedAt());
    }

    private DigitalHumanConfigResponse defaultResponse() {
        return new DigitalHumanConfigResponse(null, "小海", "海", "校园 AI 导览员", "欢迎回到山海大学，我是你的校园 AI 导览员小海。你想重走青春路线，还是了解学校的新变化？", "默认", "科技蓝紫", true, null, null);
    }

    private String trim(String value) { return value == null ? "" : value.trim(); }
}
