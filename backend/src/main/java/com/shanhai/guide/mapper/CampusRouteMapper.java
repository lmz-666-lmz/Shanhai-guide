package com.shanhai.guide.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.shanhai.guide.entity.TCampusRoute;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface CampusRouteMapper extends BaseMapper<TCampusRoute> {

    @Select("SELECT * FROM t_campus_route WHERE id = #{routeId} FOR UPDATE")
    TCampusRoute selectByIdForUpdate(@Param("routeId") Long routeId);
}
