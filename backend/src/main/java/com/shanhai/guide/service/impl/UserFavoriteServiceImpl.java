package com.shanhai.guide.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.shanhai.guide.entity.TUserFavorite;
import com.shanhai.guide.entity.TBadge;
import com.shanhai.guide.exception.BusinessException;
import com.shanhai.guide.mapper.UserFavoriteMapper;
import com.shanhai.guide.service.UserFavoriteService;
import com.shanhai.guide.service.BadgeRuleService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class UserFavoriteServiceImpl extends ServiceImpl<UserFavoriteMapper, TUserFavorite> implements UserFavoriteService {

    private final BadgeRuleService badgeRuleService;

    public UserFavoriteServiceImpl(BadgeRuleService badgeRuleService) {
        this.badgeRuleService = badgeRuleService;
    }

    @Override
    @Transactional
    public List<TBadge> addFavorite(String sessionId, Integer favoriteType, Long targetId) {
        if (isFavorite(sessionId, favoriteType, targetId)) {
            throw new BusinessException(400, "已收藏");
        }
        
        TUserFavorite favorite = new TUserFavorite();
        favorite.setSessionId(sessionId);
        favorite.setFavoriteType(favoriteType);
        favorite.setTargetId(targetId);
        save(favorite);
        String trigger = Integer.valueOf(1).equals(favoriteType)
                ? BadgeRuleService.TRIGGER_FAVORITE_SPOT
                : BadgeRuleService.TRIGGER_FAVORITE_ROUTE;
        return badgeRuleService.checkAndUnlock(sessionId, trigger);
    }

    @Override
    public void removeFavorite(String sessionId, Integer favoriteType, Long targetId) {
        LambdaQueryWrapper<TUserFavorite> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TUserFavorite::getSessionId, sessionId)
               .eq(TUserFavorite::getFavoriteType, favoriteType)
               .eq(TUserFavorite::getTargetId, targetId);
        remove(wrapper);
    }

    @Override
    public boolean isFavorite(String sessionId, Integer favoriteType, Long targetId) {
        LambdaQueryWrapper<TUserFavorite> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TUserFavorite::getSessionId, sessionId)
               .eq(TUserFavorite::getFavoriteType, favoriteType)
               .eq(TUserFavorite::getTargetId, targetId);
        return count(wrapper) > 0;
    }

    @Override
    public List<TUserFavorite> getFavorites(String sessionId, Integer favoriteType) {
        LambdaQueryWrapper<TUserFavorite> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TUserFavorite::getSessionId, sessionId);
        if (favoriteType != null) {
            wrapper.eq(TUserFavorite::getFavoriteType, favoriteType);
        }
        return list(wrapper);
    }
}
