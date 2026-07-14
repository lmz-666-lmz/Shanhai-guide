package com.shanhai.guide.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.shanhai.guide.entity.TCampusActivity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface CampusActivityMapper extends BaseMapper<TCampusActivity> {

    @Select("SELECT * FROM t_campus_activity WHERE id = #{activityId} FOR UPDATE")
    TCampusActivity selectByIdForUpdate(@Param("activityId") Long activityId);

    @Update("UPDATE t_campus_activity SET reserved_count = COALESCE(reserved_count, 0) + 1, update_time = NOW() " +
            "WHERE id = #{activityId} AND is_enable = 1 AND is_reserve = 1 " +
            "AND (reserve_limit IS NULL OR reserve_limit <= 0 OR COALESCE(reserved_count, 0) < reserve_limit)")
    int incrementReservedCountIfAvailable(@Param("activityId") Long activityId);

    @Update("UPDATE t_campus_activity SET reserved_count = GREATEST(COALESCE(reserved_count, 0) - 1, 0), update_time = NOW() " +
            "WHERE id = #{activityId}")
    int decrementReservedCountSafely(@Param("activityId") Long activityId);
}
