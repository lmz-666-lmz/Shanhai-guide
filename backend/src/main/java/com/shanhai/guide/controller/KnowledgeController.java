package com.shanhai.guide.controller;

import com.shanhai.guide.common.ApiResponse;
import com.shanhai.guide.entity.TKnowledge;
import com.shanhai.guide.service.KnowledgeService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/knowledge")
public class KnowledgeController {

    private final KnowledgeService knowledgeService;

    public KnowledgeController(KnowledgeService knowledgeService) {
        this.knowledgeService = knowledgeService;
    }

    @GetMapping("/search")
    public ApiResponse<List<TKnowledge>> search(@RequestParam String keyword,
                                                @RequestParam(required = false) String userMode,
                                                @RequestParam(defaultValue = "5") Integer limit) {
        return ApiResponse.success(knowledgeService.searchKnowledge(keyword, userMode, limit));
    }
}
