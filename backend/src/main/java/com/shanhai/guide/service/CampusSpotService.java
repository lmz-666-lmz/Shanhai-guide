package com.shanhai.guide.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.shanhai.guide.entity.TCampusSpot;

import java.util.List;

public interface CampusSpotService extends IService<TCampusSpot> {

    List<TCampusSpot> searchSpots(String spotType, String userMode, String keyword, Integer isEnable);

    TCampusSpot getSpotById(Long spotId);

    TCampusSpot getSpotForAdmin(Long spotId);

    List<TCampusSpot> getAllSpots();
}
