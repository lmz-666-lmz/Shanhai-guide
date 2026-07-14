package com.shanhai.guide.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_user_personal_route")
public class TUserPersonalRoute extends BaseEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String sessionId;

    private String routeName;

    private String routeDesc;

    private String spotOrderJson;

    private Integer totalMinute;

    private String sourcePrompt;

    private String sourceType;

    private Integer isFavorite;
}
