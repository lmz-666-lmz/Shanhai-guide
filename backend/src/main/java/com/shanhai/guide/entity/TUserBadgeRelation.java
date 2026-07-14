package com.shanhai.guide.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_user_badge_relation")
public class TUserBadgeRelation extends BaseEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String sessionId;

    private Long badgeId;

    private String sourceEvent;

    private Integer isNotified;

    private LocalDateTime unlockTime;
}
