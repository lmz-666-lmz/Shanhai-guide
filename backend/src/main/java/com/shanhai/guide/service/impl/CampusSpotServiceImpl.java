package com.shanhai.guide.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.shanhai.guide.entity.TCampusSpot;
import com.shanhai.guide.exception.BusinessException;
import com.shanhai.guide.mapper.CampusSpotMapper;
import com.shanhai.guide.service.CampusSpotService;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class CampusSpotServiceImpl extends ServiceImpl<CampusSpotMapper, TCampusSpot> implements CampusSpotService {

    @Override
    public List<TCampusSpot> searchSpots(String spotType, String userMode, String keyword, Integer isEnable) {
        LambdaQueryWrapper<TCampusSpot> wrapper = new LambdaQueryWrapper<>();
        if (isEnable != null) {
            wrapper.eq(TCampusSpot::getIsEnable, isEnable);
        }
        if (spotType != null && !spotType.isBlank()) {
            wrapper.eq(TCampusSpot::getSpotType, spotType);
        }
        if (userMode != null && !userMode.isBlank()) {
            wrapper.and(w -> w.like(TCampusSpot::getSuitableMode, userMode)
                    .or().isNull(TCampusSpot::getSuitableMode)
                    .or().eq(TCampusSpot::getSuitableMode, ""));
        }
        if (keyword != null && !keyword.isBlank()) {
            wrapper.and(w -> w.like(TCampusSpot::getSpotName, keyword.trim())
                    .or().like(TCampusSpot::getSpotDesc, keyword.trim()));
        }
        wrapper.orderByAsc(TCampusSpot::getId);
        return list(wrapper);
    }

    @Override
    public TCampusSpot getSpotById(Long spotId) {
        LambdaQueryWrapper<TCampusSpot> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TCampusSpot::getId, spotId)
               .eq(TCampusSpot::getIsEnable, 1);
        TCampusSpot spot = getOne(wrapper);
        if (spot == null) {
            throw new BusinessException(404, "点位不存在");
        }
        return spot;
    }

    @Override
    public TCampusSpot getSpotForAdmin(Long spotId) {
        TCampusSpot spot = getById(spotId);
        if (spot == null) {
            throw new BusinessException(404, "点位不存在");
        }
        return spot;
    }

    @Override
    public List<TCampusSpot> getAllSpots() {
        LambdaQueryWrapper<TCampusSpot> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TCampusSpot::getIsEnable, 1);
        return list(wrapper);
    }
}
