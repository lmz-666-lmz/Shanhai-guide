package com.shanhai.guide.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_user_session")
public class TUserSession extends BaseEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String sessionId;

    /** 关联注册用户：t_user.id；游客为 NULL */
    private Long userId;

    private String userMode;

    private String virtualName;

    private Integer virtualYear;

    private String virtualCollege;

    private String virtualMajor;

    private Integer totalCheckin;

    private Integer totalRoute;

    /** 状态：1=启用，0=禁用 */
    private Integer status;
}