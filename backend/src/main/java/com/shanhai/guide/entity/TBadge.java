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
@TableName("t_badge")
public class TBadge extends BaseEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String badgeCode;

    private String badgeName;

    @TableField(updateStrategy = FieldStrategy.IGNORED)
    private String badgeIcon;

    private String badgeDesc;

    private String badgeLevel;

    private String unlockRule;

    private String conditionType;

    private Integer conditionValue;

    private String conditionConfig;

    private String userModeLimit;

    private Integer sort;

    private Integer sortOrder;

    private Integer isEnable;
}
