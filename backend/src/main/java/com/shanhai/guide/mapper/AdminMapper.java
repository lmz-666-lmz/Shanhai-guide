package com.shanhai.guide.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.shanhai.guide.entity.TAdmin;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface AdminMapper extends BaseMapper<TAdmin> {
}