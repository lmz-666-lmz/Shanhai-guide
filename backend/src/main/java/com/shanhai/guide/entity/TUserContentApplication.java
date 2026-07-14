package com.shanhai.guide.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_user_content_application")
public class TUserContentApplication extends BaseEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String sessionId;

    private String userMode;

    private String applicantName;

    private String applicationType;

    private String applicationTitle;

    private String spotName;

    private String spotType;

    private BigDecimal longitude;

    private BigDecimal latitude;

    private String openTime;

    private Integer recommendTime;

    private String spotDesc;

    private String spotImage;

    private String routeName;

    private String routeDesc;

    private Integer totalMinute;

    private String spotOrderJson;

    private String coverImage;

    private String suitableMode;

    private String applicationReason;

    private Integer status;

    private Long auditAdminId;

    private String auditAdminName;

    private String auditComment;

    private Long publishedTargetId;

    private LocalDateTime auditTime;
}
