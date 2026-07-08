package com.softwarecup.shanhai.config;

import com.softwarecup.shanhai.entity.CampusSpot;
import com.softwarecup.shanhai.repository.CampusSpotRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@Order(1)
public class CampusSpotInitializer implements CommandLineRunner {

    private final CampusSpotRepository campusSpotRepository;

    public CampusSpotInitializer(CampusSpotRepository campusSpotRepository) {
        this.campusSpotRepository = campusSpotRepository;
    }

    @Override
    public void run(String... args) {
        if (campusSpotRepository.count() > 0) {
            return;
        }

        campusSpotRepository.saveAll(List.of(
                createSpot(
                        "山海大学南门",
                        "校园景观",
                        "山海大学主要入口，也是校友返校和访客参观的起点。",
                        "这里是山海大学南门，许多校友第一次走进校园、再次回到母校，都是从这里开始。南门不仅是校园入口，也承载着一代代山海学子的青春记忆。",
                        31.230100,
                        121.473100,
                        "全天开放",
                        10,
                        "入口,校友,拍照"
                ),
                createSpot(
                        "知行主楼",
                        "学院建筑",
                        "学校标志性教学行政建筑，见证了学校发展的重要阶段。",
                        "知行主楼是山海大学的标志性建筑之一，承担教学、行政和重要会议功能。它见证了学校从地方工科院校到高水平大学的发展历程。",
                        31.230650,
                        121.473300,
                        "08:00-18:00",
                        15,
                        "地标,校史,教学"
                ),
                createSpot(
                        "星海图书馆",
                        "校园文化",
                        "校园学习文化中心，承载着学生阅读、备考和学术交流的记忆。",
                        "星海图书馆是山海大学最具学习氛围的地方之一。对许多校友来说，这里不仅有书香，也有备考、论文、社团活动和青春奋斗的记忆。",
                        31.231100,
                        121.473850,
                        "08:00-22:00",
                        20,
                        "学习,校友记忆,文化"
                ),
                createSpot(
                        "山海校史馆",
                        "校史文化",
                        "展示学校发展历程、科研成果和优秀校友故事的重要文化空间。",
                        "山海校史馆集中展示了学校的发展脉络、重要科研成果和优秀校友故事，是了解山海大学精神传承和办学特色的重要窗口。",
                        31.231500,
                        121.474200,
                        "09:00-17:00",
                        30,
                        "校史,文化,校友"
                ),
                createSpot(
                        "海韵湖",
                        "校园景观",
                        "校园中心景观区域，适合休息、拍照和慢行游览。",
                        "海韵湖是山海大学校园中最受欢迎的景观区域之一。湖边步道连接教学区与生活区，也记录了许多学生散步、交流和拍照的校园日常。",
                        31.231050,
                        121.474700,
                        "全天开放",
                        20,
                        "景观,休息,拍照"
                ),
                createSpot(
                        "校友之家",
                        "校友服务",
                        "面向校友返校、交流和活动接待的服务空间。",
                        "校友之家是学校联系校友的重要平台，也是校友返校时了解母校发展、参与交流活动的重要场所。",
                        31.230450,
                        121.474550,
                        "09:00-18:00",
                        20,
                        "校友,活动,服务"
                ),
                createSpot(
                        "第一食堂",
                        "生活服务",
                        "校园主要餐饮点之一，为学生、教职工和访客提供餐饮服务。",
                        "第一食堂承载着许多山海学子的校园味道。对于返校校友来说，这里熟悉的饭菜和热闹的氛围，往往最能唤起学生时代的记忆。",
                        31.230850,
                        121.472650,
                        "06:30-20:00",
                        30,
                        "餐饮,生活,校友记忆"
                ),
                createSpot(
                        "智能信息学院",
                        "学院建筑",
                        "展示学校信息技术、人工智能和软件工程相关学科特色的学院点位。",
                        "智能信息学院体现了山海大学在信息技术、人工智能和软件工程等领域的人才培养与科研探索，也是学校新工科建设的重要窗口。",
                        31.231750,
                        121.473500,
                        "08:00-18:00",
                        15,
                        "学院,人工智能,软件工程"
                )
        ));
    }

    private CampusSpot createSpot(
            String name,
            String type,
            String description,
            String story,
            Double latitude,
            Double longitude,
            String openTime,
            Integer recommendedDuration,
            String tags
    ) {
        CampusSpot spot = new CampusSpot();
        spot.setName(name);
        spot.setType(type);
        spot.setDescription(description);
        spot.setStory(story);
        spot.setLatitude(latitude);
        spot.setLongitude(longitude);
        spot.setOpenTime(openTime);
        spot.setRecommendedDuration(recommendedDuration);
        spot.setTags(tags);
        spot.setEnabled(true);
        return spot;
    }
}
