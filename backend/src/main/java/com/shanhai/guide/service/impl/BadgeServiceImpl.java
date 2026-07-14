package com.shanhai.guide.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.shanhai.guide.entity.TBadge;
import com.shanhai.guide.mapper.BadgeMapper;
import com.shanhai.guide.service.BadgeService;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class BadgeServiceImpl extends ServiceImpl<BadgeMapper, TBadge> implements BadgeService {

    @Override
    public List<TBadge> getAllBadges() {
        LambdaQueryWrapper<TBadge> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TBadge::getIsEnable, 1)
               .orderByAsc(TBadge::getSortOrder)
               .orderByAsc(TBadge::getSort);
        return list(wrapper);
    }

    @Override
    public List<TBadge> getBadgesByMode(String userMode) {
        LambdaQueryWrapper<TBadge> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TBadge::getIsEnable, 1)
               .and(w -> w.like(TBadge::getUserModeLimit, userMode)
                         .or().isNull(TBadge::getUserModeLimit)
                         .or().eq(TBadge::getUserModeLimit, ""))
               .orderByAsc(TBadge::getSortOrder)
               .orderByAsc(TBadge::getSort);
        return list(wrapper);
    }
}
