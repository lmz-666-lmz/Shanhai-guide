package com.softwarecup.shanhai.controller;

import com.softwarecup.shanhai.dto.CampusSpotResponse;
import com.softwarecup.shanhai.service.CampusSpotService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/spots")
public class CampusSpotController {

    private final CampusSpotService campusSpotService;

    public CampusSpotController(CampusSpotService campusSpotService) {
        this.campusSpotService = campusSpotService;
    }

    @GetMapping
    public List<CampusSpotResponse> listSpots(@RequestParam(required = false) String type) {
        if (StringUtils.hasText(type)) {
            return campusSpotService.listByType(type);
        }

        return campusSpotService.listEnabledSpots();
    }

    @GetMapping("/{id}")
    public CampusSpotResponse getSpot(@PathVariable Long id) {
        return campusSpotService.getSpotById(id);
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
