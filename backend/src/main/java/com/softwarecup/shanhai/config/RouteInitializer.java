package com.softwarecup.shanhai.config;

import com.softwarecup.shanhai.entity.CampusRoute;
import com.softwarecup.shanhai.entity.CampusSpot;
import com.softwarecup.shanhai.entity.RouteSpot;
import com.softwarecup.shanhai.repository.CampusRouteRepository;
import com.softwarecup.shanhai.repository.CampusSpotRepository;
import com.softwarecup.shanhai.repository.RouteSpotRepository;
import jakarta.transaction.Transactional;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Component
@Order(2)
public class RouteInitializer implements CommandLineRunner {

    private final CampusRouteRepository campusRouteRepository;
    private final RouteSpotRepository routeSpotRepository;
    private final CampusSpotRepository campusSpotRepository;

    public RouteInitializer(
            CampusRouteRepository campusRouteRepository,
            RouteSpotRepository routeSpotRepository,
            CampusSpotRepository campusSpotRepository
    ) {
        this.campusRouteRepository = campusRouteRepository;
        this.routeSpotRepository = routeSpotRepository;
        this.campusSpotRepository = campusSpotRepository;
    }

    @Override
    @Transactional
    public void run(String... args) {
        if (campusRouteRepository.count() > 0) {
            return;
        }

        createRoute(
                "校友记忆路线",
                "校友",
                "适合返校校友重温校园记忆并了解学校新变化。",
                "校友,访客",
                90,
                "约 1.8 公里",
                "覆盖校门、主楼、图书馆、校史馆、湖畔和校友之家，兼顾青春记忆和母校新貌。",
                List.of(
                        new SpotStep("山海大学南门", 10),
                        new SpotStep("知行主楼", 10),
                        new SpotStep("星海图书馆", 15),
                        new SpotStep("山海校史馆", 25),
                        new SpotStep("海韵湖", 15),
                        new SpotStep("校友之家", 15)
                )
        );

        createRoute(
                "新生初识路线",
                "新生",
                "帮助新生快速认识校园主要学习和生活空间。",
                "新生,家长",
                60,
                "约 1.2 公里",
                "覆盖入口、主楼、图书馆、学院和食堂，适合新生快速建立校园方位感。",
                List.of(
                        new SpotStep("山海大学南门", 10),
                        new SpotStep("知行主楼", 10),
                        new SpotStep("星海图书馆", 15),
                        new SpotStep("智能信息学院", 10),
                        new SpotStep("第一食堂", 15)
                )
        );

        createRoute(
                "家长参观路线",
                "家长",
                "面向家长展示校园环境、学习资源和学院特色。",
                "家长,访客",
                80,
                "约 1.6 公里",
                "重点展示学校地标、学习资源、学院建设和生活服务环境。",
                List.of(
                        new SpotStep("山海大学南门", 10),
                        new SpotStep("知行主楼", 15),
                        new SpotStep("星海图书馆", 20),
                        new SpotStep("智能信息学院", 15),
                        new SpotStep("第一食堂", 20)
                )
        );

        createRoute(
                "研学科创路线",
                "研学",
                "面向研学访客展示学校学科特色、科研氛围和校史文化。",
                "研学,访客",
                100,
                "约 2.0 公里",
                "兼顾校史文化、学院特色和学习空间，适合研学讲解。",
                List.of(
                        new SpotStep("山海校史馆", 30),
                        new SpotStep("智能信息学院", 20),
                        new SpotStep("星海图书馆", 20),
                        new SpotStep("知行主楼", 15),
                        new SpotStep("海韵湖", 15)
                )
        );

        createRoute(
                "一小时快速路线",
                "快速",
                "适合时间有限的访客快速了解校园。",
                "访客,校友,家长",
                45,
                "约 1.0 公里",
                "路线短、点位集中，适合时间有限时快速打卡校园核心区域。",
                List.of(
                        new SpotStep("山海大学南门", 10),
                        new SpotStep("知行主楼", 10),
                        new SpotStep("山海校史馆", 15),
                        new SpotStep("海韵湖", 10)
                )
        );
    }

    private void createRoute(
            String name,
            String routeType,
            String description,
            String suitableFor,
            Integer estimatedDuration,
            String distanceText,
            String reason,
            List<SpotStep> spotSteps
    ) {
        CampusRoute route = new CampusRoute();
        route.setName(name);
        route.setRouteType(routeType);
        route.setDescription(description);
        route.setSuitableFor(suitableFor);
        route.setEstimatedDuration(estimatedDuration);
        route.setDistanceText(distanceText);
        route.setReason(reason);
        route.setEnabled(true);

        CampusRoute savedRoute = campusRouteRepository.save(route);

        List<RouteSpot> routeSpots = new ArrayList<>();
        for (int index = 0; index < spotSteps.size(); index++) {
            SpotStep step = spotSteps.get(index);
            RouteSpot routeSpot = new RouteSpot();
            routeSpot.setRouteId(savedRoute.getId());
            routeSpot.setSpotId(findSpotIdByName(step.name()));
            routeSpot.setSortOrder(index + 1);
            routeSpot.setStayMinutes(step.stayMinutes());
            routeSpot.setNote(createNote(savedRoute.getName(), step.name()));
            routeSpots.add(routeSpot);
        }

        routeSpotRepository.saveAll(routeSpots);
    }

    private Long findSpotIdByName(String name) {
        return campusSpotRepository.findByName(name)
                .map(CampusSpot::getId)
                .orElseThrow(() -> new IllegalStateException("初始化路线失败，未找到点位：" + name));
    }

    private String createNote(String routeName, String spotName) {
        return spotName + "是" + routeName + "中的重要参观点，建议结合点位故事进行讲解。";
    }

    private record SpotStep(String name, Integer stayMinutes) {
    }
}
