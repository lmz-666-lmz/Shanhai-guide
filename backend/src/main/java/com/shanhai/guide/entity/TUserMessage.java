package com.shanhai.guide.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_user_message")
public class TUserMessage extends BaseEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String targetType;

    private String sessionId;

    private String userMode;

    private String messageType;

    private String title;

    private String content;

    private String sourceType;

    private Long sourceId;

    private String sourceEvent;
}
