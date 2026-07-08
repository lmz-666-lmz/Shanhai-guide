package com.softwarecup.shanhai.controller;

import com.softwarecup.shanhai.dto.KnowledgeSourceResponse;
import com.softwarecup.shanhai.service.KnowledgeBaseService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/knowledge")
public class KnowledgeController {

    private final KnowledgeBaseService knowledgeBaseService;

    public KnowledgeController(KnowledgeBaseService knowledgeBaseService) {
        this.knowledgeBaseService = knowledgeBaseService;
    }

    @GetMapping("/chunks")
    public List<KnowledgeSourceResponse> listChunks() {
        return knowledgeBaseService.listEnabledChunks();
    }

    @GetMapping("/search")
    public List<KnowledgeSourceResponse> search(@RequestParam(required = false) String keyword) {
        return knowledgeBaseService.searchByKeyword(keyword);
    }
}
