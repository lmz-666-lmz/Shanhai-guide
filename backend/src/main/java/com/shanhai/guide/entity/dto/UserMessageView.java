package com.shanhai.guide.entity.dto;

import com.shanhai.guide.entity.TUserMessage;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
public class UserMessageView extends TUserMessage {

    private Integer readStatus;

    private Integer isDeleted;

    private LocalDateTime readTime;
}
