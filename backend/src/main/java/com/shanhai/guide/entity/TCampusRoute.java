package com.shanhai.guide.entity;

import com.baomidou.mybatisplus.annotation.FieldStrategy;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_campus_route")
public class TCampusRoute extends BaseEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String routeName;

    private String routeDesc;

    private Integer totalMinute;

    private String spotOrderJson;

    private String suitableMode;

    @TableField(updateStrategy = FieldStrategy.IGNORED)
    private String coverImage;

    private Integer isEnable;

    @TableField(exist = false)
    private java.util.List<TCampusSpot> spots;
}
