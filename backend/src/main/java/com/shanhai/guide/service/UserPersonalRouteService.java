package com.shanhai.guide.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.shanhai.guide.entity.TUserPersonalRoute;

import java.util.List;

public interface UserPersonalRouteService extends IService<TUserPersonalRoute> {

    TUserPersonalRoute createRoute(TUserPersonalRoute route);

    List<TUserPersonalRoute> listRoutes(String sessionId);

    TUserPersonalRoute getRoute(String sessionId, Long routeId);

    TUserPersonalRoute updateRoute(String sessionId, Long routeId, TUserPersonalRoute changes);

    void deleteRoute(String sessionId, Long routeId);
}
