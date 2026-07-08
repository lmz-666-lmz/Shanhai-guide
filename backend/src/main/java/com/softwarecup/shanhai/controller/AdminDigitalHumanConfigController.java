package com.softwarecup.shanhai.controller;

import com.softwarecup.shanhai.dto.DigitalHumanConfigRequest;
import com.softwarecup.shanhai.dto.DigitalHumanConfigResponse;
import com.softwarecup.shanhai.service.DigitalHumanConfigService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/digital-human/configs")
public class AdminDigitalHumanConfigController {

    private final DigitalHumanConfigService digitalHumanConfigService;

    public AdminDigitalHumanConfigController(DigitalHumanConfigService digitalHumanConfigService) {
        this.digitalHumanConfigService = digitalHumanConfigService;
    }

    @GetMapping
    public List<DigitalHumanConfigResponse> listConfigs() {
        return digitalHumanConfigService.listConfigs();
    }

    @GetMapping("/{id}")
    public DigitalHumanConfigResponse getConfig(@PathVariable Long id) {
        return digitalHumanConfigService.getConfig(id);
    }

    @PostMapping
    public ResponseEntity<DigitalHumanConfigResponse> createConfig(@Valid @RequestBody DigitalHumanConfigRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(digitalHumanConfigService.createConfig(request));
    }

    @PutMapping("/{id}")
    public DigitalHumanConfigResponse updateConfig(@PathVariable Long id, @Valid @RequestBody DigitalHumanConfigRequest request) {
        return digitalHumanConfigService.updateConfig(id, request);
    }

    @PatchMapping("/{id}/enabled")
    public DigitalHumanConfigResponse setEnabled(@PathVariable Long id, @RequestParam Boolean enabled) {
        return digitalHumanConfigService.setEnabled(id, enabled);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteConfig(@PathVariable Long id) {
        digitalHumanConfigService.deleteConfig(id);
        return ResponseEntity.noContent().build();
    }

    @ExceptionHandler(NoSuchElementException.class)
    public ResponseEntity<Map<String, Object>> handleNotFound(NoSuchElementException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("status", 404, "message", ex.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream().map(error -> error.getField() + "：" + error.getDefaultMessage()).collect(Collectors.joining("；"));
        return ResponseEntity.badRequest().body(Map.of("status", 400, "message", message));
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<Map<String, Object>> handleMissingParam(MissingServletRequestParameterException ex) {
        return ResponseEntity.badRequest().body(Map.of("status", 400, "message", "缺少必要参数：" + ex.getParameterName()));
    }
}
