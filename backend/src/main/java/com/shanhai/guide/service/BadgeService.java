package com.shanhai.guide.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.shanhai.guide.entity.TBadge;

import java.util.List;

public interface BadgeService extends IService<TBadge> {

    List<TBadge> getAllBadges();

    List<TBadge> getBadgesByMode(String userMode);
}