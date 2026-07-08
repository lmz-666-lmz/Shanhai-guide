package com.softwarecup.shanhai.controller;

import com.softwarecup.shanhai.dto.DigitalHumanConfigResponse;
import com.softwarecup.shanhai.service.DigitalHumanConfigService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/digital-human")
public class DigitalHumanController {

    private final DigitalHumanConfigService digitalHumanConfigService;

    public DigitalHumanController(DigitalHumanConfigService digitalHumanConfigService) {
        this.digitalHumanConfigService = digitalHumanConfigService;
    }

    @GetMapping("/current")
    public DigitalHumanConfigResponse current() {
        return digitalHumanConfigService.getCurrentConfig();
    }
}
