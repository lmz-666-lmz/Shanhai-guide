package com.shanhai.guide.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_user_feedback")
public class TUserFeedback extends BaseEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String sessionId;

    private String userMode;

    private Integer score;

    private String feedbackType;

    private String feedbackContent;

    private String adminReply;

    private LocalDateTime replyTime;
}