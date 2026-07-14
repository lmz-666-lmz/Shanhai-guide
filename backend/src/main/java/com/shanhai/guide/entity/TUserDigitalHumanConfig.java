package com.shanhai.guide.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_user_digital_human_config")
public class TUserDigitalHumanConfig extends BaseEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String sessionId;

    private String avatarUrl;

    private String voiceType;

    private BigDecimal speechSpeed;

    private String welcomeText;

    private String talkStyle;

    private String configJson;
}
