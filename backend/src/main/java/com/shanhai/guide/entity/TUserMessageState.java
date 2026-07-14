package com.shanhai.guide.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_user_message_state")
public class TUserMessageState extends BaseEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long messageId;

    private String sessionId;

    private Integer readStatus;

    private Integer isDeleted;

    private LocalDateTime readTime;
}
