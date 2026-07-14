package com.shanhai.guide.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.shanhai.guide.entity.TCampusRoute;

import java.util.List;

public interface CampusRouteService extends IService<TCampusRoute> {

    List<TCampusRoute> searchRoutes(String userMode, Integer isEnable);

    List<TCampusRoute> searchRoutes(String userMode, Integer isEnable, String keyword, Integer minMinute, Integer maxMinute);

    TCampusRoute getRouteById(Long routeId);

    TCampusRoute getRouteForAdmin(Long routeId);

    TCampusRoute prepareAndValidate(TCampusRoute route);

    List<TCampusRoute> getAllRoutes();
}
