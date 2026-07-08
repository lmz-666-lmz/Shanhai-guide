package com.softwarecup.shanhai.controller;

import com.softwarecup.shanhai.dto.AdminRouteRequest;
import com.softwarecup.shanhai.dto.AdminRouteResponse;
import com.softwarecup.shanhai.service.AdminCampusRouteService;
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
@RequestMapping("/api/admin/routes")
public class AdminCampusRouteController {

    private final AdminCampusRouteService adminCampusRouteService;

    public AdminCampusRouteController(AdminCampusRouteService adminCampusRouteService) {
        this.adminCampusRouteService = adminCampusRouteService;
    }

    @GetMapping
    public List<AdminRouteResponse> listRoutes(@RequestParam(required = false) Boolean enabled, @RequestParam(required = false) String routeType) {
        return adminCampusRouteService.listRoutes(enabled, routeType);
    }

    @GetMapping("/{id}")
    public AdminRouteResponse getRoute(@PathVariable Long id) {
        return adminCampusRouteService.getRoute(id);
    }

    @PostMapping
    public ResponseEntity<AdminRouteResponse> createRoute(@Valid @RequestBody AdminRouteRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(adminCampusRouteService.createRoute(request));
    }

    @PutMapping("/{id}")
    public AdminRouteResponse updateRoute(@PathVariable Long id, @Valid @RequestBody AdminRouteRequest request) {
        return adminCampusRouteService.updateRoute(id, request);
    }

    @PatchMapping("/{id}/enabled")
    public AdminRouteResponse setEnabled(@PathVariable Long id, @RequestParam Boolean enabled) {
        return adminCampusRouteService.setEnabled(id, enabled);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteRoute(@PathVariable Long id) {
        adminCampusRouteService.deleteRoute(id);
        return ResponseEntity.noContent().build();
    }

    @ExceptionHandler(NoSuchElementException.class)
    public ResponseEntity<Map<String, Object>> handleNotFound(NoSuchElementException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("status", 404, "message", ex.getMessage()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalArgument(IllegalArgumentException ex) {
        return ResponseEntity.badRequest().body(Map.of("status", 400, "message", ex.getMessage()));
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
