package com.shanhai.guide.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.shanhai.guide.entity.TKnowledge;

import java.util.List;

public interface KnowledgeService extends IService<TKnowledge> {

    List<TKnowledge> searchKnowledge(String keyword, String userMode, Integer limit);

    List<TKnowledge> searchRelevant(String message, String userMode, Integer limit);

    List<TKnowledge> listForAdmin(String keyword, String knowledgeType, String suitableMode, Integer isEnable);

    String getSourceName(TKnowledge knowledge);
}
