package com.shanhai.guide.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_user_favorite")
public class TUserFavorite extends BaseEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String sessionId;

    private Integer favoriteType;

    private Long targetId;
}