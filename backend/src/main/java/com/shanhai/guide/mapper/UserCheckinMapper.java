package com.shanhai.guide.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.shanhai.guide.entity.TUserCheckin;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface UserCheckinMapper extends BaseMapper<TUserCheckin> {

    @Select("SELECT COUNT(*) FROM t_user_checkin WHERE session_id = #{sessionId} AND spot_id IS NOT NULL")
    long countSpotCheckins(@Param("sessionId") String sessionId);

    @Select("SELECT COUNT(DISTINCT route_id) FROM t_user_checkin WHERE session_id = #{sessionId} AND route_id IS NOT NULL AND checkin_type = 2")
    long countCompletedRoutes(@Param("sessionId") String sessionId);

    @Select("SELECT COUNT(*) FROM t_user_checkin c JOIN t_campus_spot s ON s.id = c.spot_id " +
            "WHERE c.session_id = #{sessionId} AND c.spot_id IS NOT NULL AND s.spot_type = #{spotType}")
    long countSpotTypeCheckins(@Param("sessionId") String sessionId, @Param("spotType") String spotType);
}
