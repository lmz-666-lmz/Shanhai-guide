package com.shanhai.guide.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.shanhai.guide.entity.TKnowledge;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface KnowledgeMapper extends BaseMapper<TKnowledge> {
}