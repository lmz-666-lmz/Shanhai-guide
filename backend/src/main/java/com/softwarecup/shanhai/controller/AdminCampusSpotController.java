package com.softwarecup.shanhai.controller;

import com.softwarecup.shanhai.dto.CampusSpotAdminResponse;
import com.softwarecup.shanhai.dto.CampusSpotRequest;
import com.softwarecup.shanhai.service.AdminCampusSpotService;
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
@RequestMapping("/api/admin/spots")
public class AdminCampusSpotController {

    private final AdminCampusSpotService adminCampusSpotService;

    public AdminCampusSpotController(AdminCampusSpotService adminCampusSpotService) {
        this.adminCampusSpotService = adminCampusSpotService;
    }

    @GetMapping
    public List<CampusSpotAdminResponse> listSpots(
            @RequestParam(required = false) Boolean enabled,
            @RequestParam(required = false) String type
    ) {
        return adminCampusSpotService.listSpots(enabled, type);
    }

    @GetMapping("/{id}")
    public CampusSpotAdminResponse getSpot(@PathVariable Long id) {
        return adminCampusSpotService.getSpot(id);
    }

    @PostMapping
    public ResponseEntity<CampusSpotAdminResponse> createSpot(
            @Valid @RequestBody CampusSpotRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(adminCampusSpotService.createSpot(request));
    }

    @PutMapping("/{id}")
    public CampusSpotAdminResponse updateSpot(
            @PathVariable Long id,
            @Valid @RequestBody CampusSpotRequest request
    ) {
        return adminCampusSpotService.updateSpot(id, request);
    }

    @PatchMapping("/{id}/enabled")
    public CampusSpotAdminResponse setEnabled(
            @PathVariable Long id,
            @RequestParam Boolean enabled
    ) {
        return adminCampusSpotService.setEnabled(id, enabled);
    }

    @DeleteMapping("/{id}")
    public CampusSpotAdminResponse deleteSpot(@PathVariable Long id) {
        return adminCampusSpotService.deleteSpot(id);
    }

    @ExceptionHandler(NoSuchElementException.class)
    public ResponseEntity<Map<String, Object>> handleNotFound(NoSuchElementException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of(
                        "status", 404,
                        "message", ex.getMessage()
                ));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalArgument(IllegalArgumentException ex) {
        return ResponseEntity.badRequest()
                .body(Map.of(
                        "status", 400,
                        "message", ex.getMessage()
                ));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult()
                .getFieldErrors()
                .stream()
                .map(error -> error.getField() + "：" + error.getDefaultMessage())
                .collect(Collectors.joining("；"));

        return ResponseEntity.badRequest()
                .body(Map.of(
                        "status", 400,
                        "message", message
                ));
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<Map<String, Object>> handleMissingParam(MissingServletRequestParameterException ex) {
        return ResponseEntity.badRequest()
                .body(Map.of(
                        "status", 400,
                        "message", "缺少必要参数：" + ex.getParameterName()
                ));
    }
}
