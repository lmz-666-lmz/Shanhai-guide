package com.softwarecup.shanhai.controller;

import com.softwarecup.shanhai.dto.CampusRouteResponse;
import com.softwarecup.shanhai.dto.RouteRecommendRequest;
import com.softwarecup.shanhai.service.CampusRouteService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/routes")
public class CampusRouteController {

    private final CampusRouteService campusRouteService;

    public CampusRouteController(CampusRouteService campusRouteService) {
        this.campusRouteService = campusRouteService;
    }

    @GetMapping
    public List<CampusRouteResponse> listRoutes() {
        return campusRouteService.listEnabledRoutes();
    }

    @GetMapping("/{id}")
    public CampusRouteResponse getRoute(@PathVariable Long id) {
        return campusRouteService.getRouteById(id);
    }

    @PostMapping("/recommend")
    public CampusRouteResponse recommend(@RequestBody(required = false) RouteRecommendRequest request) {
        return campusRouteService.recommend(request);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalArgument(IllegalArgumentException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of(
                        "status", 404,
                        "message", ex.getMessage()
                ));
    }
}
