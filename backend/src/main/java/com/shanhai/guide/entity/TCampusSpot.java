package com.shanhai.guide.entity;

import com.baomidou.mybatisplus.annotation.FieldStrategy;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_campus_spot")
public class TCampusSpot extends BaseEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String spotName;

    private String spotType;

    private BigDecimal longitude;

    private BigDecimal latitude;

    private String openTime;

    private Integer recommendTime;

    private String spotDesc;

    @TableField(updateStrategy = FieldStrategy.IGNORED)
    private String spotImage;

    private String suitableMode;

    private Integer isEnable;
}