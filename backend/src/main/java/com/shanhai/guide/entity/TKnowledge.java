package com.shanhai.guide.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_knowledge")
public class TKnowledge extends BaseEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("title")
    private String title;

    @TableField("content")
    private String content;

    @TableField("knowledge_type")
    private String knowledgeType;

    @TableField("bind_spot_id")
    private Long bindSpotId;

    @TableField("bind_activity_id")
    private Long bindActivityId;

    @TableField("suitable_mode")
    private String suitableMode;

    @TableField("is_enable")
    private Integer isEnable;

    @TableField("view_count")
    private Integer viewCount;
}