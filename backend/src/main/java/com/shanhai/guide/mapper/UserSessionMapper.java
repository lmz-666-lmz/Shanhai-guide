package com.shanhai.guide.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.shanhai.guide.entity.TUserSession;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface UserSessionMapper extends BaseMapper<TUserSession> {

    @Select("SELECT * FROM t_user_session WHERE session_id = #{sessionId} FOR UPDATE")
    TUserSession selectBySessionIdForUpdate(@Param("sessionId") String sessionId);
}
