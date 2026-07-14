package com.shanhai.guide.controller;

import com.shanhai.guide.common.ApiResponse;
import com.shanhai.guide.entity.TKnowledge;
import com.shanhai.guide.exception.BusinessException;
import com.shanhai.guide.service.KnowledgeService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/knowledge")
public class AdminKnowledgeController {

    private final KnowledgeService knowledgeService;

    public AdminKnowledgeController(KnowledgeService knowledgeService) {
        this.knowledgeService = knowledgeService;
    }

    @GetMapping
    public ApiResponse<List<TKnowledge>> list(@RequestParam(required = false) String keyword,
                                              @RequestParam(required = false) String knowledgeType,
                                              @RequestParam(required = false) String suitableMode,
                                              @RequestParam(required = false) Integer isEnable,
                                              @RequestParam(defaultValue = "true") boolean includeDisabled) {
        Integer queryEnable = null;

        if (includeDisabled) {
            // includeDisabled=true 时：
            // 不传 isEnable 查询全部；传 1 查启用；传 0 查停用
            queryEnable = isEnable;
        } else {
            // includeDisabled=false 时：
            // 默认只查启用；如果显式传 isEnable，则按传入值查询
            if (isEnable != null) {
                queryEnable = isEnable;
            } else {
                queryEnable = Integer.valueOf(1);
            }
        }

        return ApiResponse.success(knowledgeService.listForAdmin(keyword, knowledgeType, suitableMode, queryEnable));
    }

    @GetMapping("/{id}")
    public ApiResponse<TKnowledge> detail(@PathVariable Long id) {
        TKnowledge knowledge = knowledgeService.getById(id);
        if (knowledge == null) {
            throw new BusinessException(404, "知识条目不存在");
        }
        return ApiResponse.success(knowledge);
    }

    @PostMapping
    public ApiResponse<TKnowledge> create(@RequestBody TKnowledge knowledge) {
        if (knowledge.getIsEnable() == null) {
            knowledge.setIsEnable(1);
        }
        if (knowledge.getViewCount() == null) {
            knowledge.setViewCount(0);
        }

        knowledgeService.save(knowledge);
        return ApiResponse.success(knowledge);
    }

    @PutMapping("/{id}")
    public ApiResponse<TKnowledge> update(@PathVariable Long id, @RequestBody TKnowledge changes) {
        TKnowledge knowledge = knowledgeService.getById(id);
        if (knowledge == null) {
            throw new BusinessException(404, "知识条目不存在");
        }

        if (changes.getTitle() != null) {
            knowledge.setTitle(changes.getTitle());
        }
        if (changes.getContent() != null) {
            knowledge.setContent(changes.getContent());
        }
        if (changes.getKnowledgeType() != null) {
            knowledge.setKnowledgeType(changes.getKnowledgeType());
        }
        if (changes.getBindSpotId() != null) {
            knowledge.setBindSpotId(changes.getBindSpotId());
        }
        if (changes.getBindActivityId() != null) {
            knowledge.setBindActivityId(changes.getBindActivityId());
        }
        if (changes.getSuitableMode() != null) {
            knowledge.setSuitableMode(changes.getSuitableMode());
        }
        if (changes.getIsEnable() != null) {
            knowledge.setIsEnable(changes.getIsEnable());
        }

        knowledgeService.updateById(knowledge);
        return ApiResponse.success(knowledge);
    }

    @DeleteMapping("/{id}")
    public ApiResponse<String> delete(@PathVariable Long id) {
        TKnowledge knowledge = knowledgeService.getById(id);
        if (knowledge == null) {
            throw new BusinessException(404, "知识条目不存在");
        }

        knowledge.setIsEnable(0);
        knowledgeService.updateById(knowledge);
        return ApiResponse.success("已停用");
    }
}
