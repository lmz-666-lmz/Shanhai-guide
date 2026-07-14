package com.shanhai.guide.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.shanhai.guide.entity.TUserChatHistory;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface UserChatHistoryMapper extends BaseMapper<TUserChatHistory> {
}