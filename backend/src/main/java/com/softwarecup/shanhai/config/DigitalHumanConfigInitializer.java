package com.softwarecup.shanhai.config;

import com.softwarecup.shanhai.entity.DigitalHumanConfig;
import com.softwarecup.shanhai.repository.DigitalHumanConfigRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

@Component
@Order(5)
public class DigitalHumanConfigInitializer implements CommandLineRunner {

    private final DigitalHumanConfigRepository digitalHumanConfigRepository;

    public DigitalHumanConfigInitializer(DigitalHumanConfigRepository digitalHumanConfigRepository) {
        this.digitalHumanConfigRepository = digitalHumanConfigRepository;
    }

    @Override
    public void run(String... args) {
        if (digitalHumanConfigRepository.count() > 0) {
            return;
        }

        DigitalHumanConfig config = new DigitalHumanConfig();
        config.setName("小海");
        config.setAvatarText("海");
        config.setRoleTitle("校园 AI 导览员");
        config.setWelcomeText("欢迎回到山海大学，我是你的校园 AI 导览员小海。你想重走青春路线，还是了解学校的新变化？");
        config.setVoiceName("默认");
        config.setStylePreset("科技蓝紫");
        config.setEnabled(true);
        digitalHumanConfigRepository.save(config);
    }
}
