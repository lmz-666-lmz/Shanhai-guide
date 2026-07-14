package com.shanhai.guide.entity;

import com.baomidou.mybatisplus.annotation.FieldStrategy;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_campus_activity")
public class TCampusActivity extends BaseEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String activityTitle;

    private String activityDesc;

    private String activityType;

    @TableField(updateStrategy = FieldStrategy.IGNORED)
    private String activityImage;

    private LocalDateTime activityTime;

    private Long activitySpotId;

    private String suitableMode;

    private Integer isReserve;

    private Integer reserveLimit;

    private Integer reservedCount;

    private Integer isEnable;
}
