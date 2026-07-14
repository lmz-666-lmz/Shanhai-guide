package com.shanhai.guide.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.shanhai.guide.entity.TUserFeedback;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface UserFeedbackMapper extends BaseMapper<TUserFeedback> {
}