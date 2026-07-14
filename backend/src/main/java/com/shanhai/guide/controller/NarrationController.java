package com.shanhai.guide.controller;

import com.shanhai.guide.common.ApiResponse;
import com.shanhai.guide.entity.dto.NarrationRequest;
import com.shanhai.guide.entity.dto.NarrationResponse;
import com.shanhai.guide.service.NarrationService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/narration")
public class NarrationController {

    private final NarrationService narrationService;

    public NarrationController(NarrationService narrationService) {
        this.narrationService = narrationService;
    }

    @PostMapping("/generate")
    public ApiResponse<NarrationResponse> generate(@RequestBody NarrationRequest request) {
        return ApiResponse.success(narrationService.generateNarration(request));
    }
}
