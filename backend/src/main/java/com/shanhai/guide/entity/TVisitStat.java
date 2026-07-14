package com.shanhai.guide.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDate;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_visit_stat")
public class TVisitStat extends BaseEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    private LocalDate statDate;

    private Integer totalSession;

    private Integer totalChat;

    private Integer alumniCount;

    private Integer freshCount;

    private Integer parentCount;

    private Integer researchCount;

    private Integer positiveEmotion;

    private Integer negativeEmotion;

    private Integer neutralEmotion;
}