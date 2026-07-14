package com.shanhai.guide.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.shanhai.guide.entity.TUserMessage;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface UserMessageMapper extends BaseMapper<TUserMessage> {
}
