package com.shanhai.guide.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.shanhai.guide.entity.TUserFavorite;
import com.shanhai.guide.entity.TBadge;

import java.util.List;

public interface UserFavoriteService extends IService<TUserFavorite> {

    List<TBadge> addFavorite(String sessionId, Integer favoriteType, Long targetId);

    void removeFavorite(String sessionId, Integer favoriteType, Long targetId);

    boolean isFavorite(String sessionId, Integer favoriteType, Long targetId);

    List<TUserFavorite> getFavorites(String sessionId, Integer favoriteType);
}
