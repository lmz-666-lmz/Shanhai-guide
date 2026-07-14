package com.shanhai.guide.controller;

import com.shanhai.guide.common.ApiResponse;
import com.shanhai.guide.entity.TCampusSpot;
import com.shanhai.guide.service.CampusSpotService;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/spot")
public class CampusSpotController {

    private final CampusSpotService campusSpotService;

    public CampusSpotController(CampusSpotService campusSpotService) {
        this.campusSpotService = campusSpotService;
    }

    @GetMapping("/list")
    public ApiResponse<List<TCampusSpot>> getSpots(@RequestParam(required = false) String spotType,
                                                   @RequestParam(required = false) String userMode,
                                                   @RequestParam(required = false) String keyword,
                                                   @RequestParam(required = false) Integer isEnable,
                                                   @RequestParam(defaultValue = "false") boolean includeDisabled) {
        Integer queryEnable = isEnable;
        if (!includeDisabled && queryEnable == null) {
            queryEnable = 1;
        }
        List<TCampusSpot> spots = campusSpotService.searchSpots(spotType, userMode, keyword, queryEnable);
        return ApiResponse.success(spots);
    }

    @GetMapping("/{spotId}")
    public ApiResponse<TCampusSpot> getSpotById(@PathVariable Long spotId) {
        TCampusSpot spot = campusSpotService.getSpotById(spotId);
        return ApiResponse.success(spot);
    }

    @PutMapping("/{spotId}")
    public ApiResponse<TCampusSpot> updateSpot(@PathVariable Long spotId, @RequestBody TCampusSpot spot) {
        TCampusSpot existingSpot = campusSpotService.getSpotForAdmin(spotId);
        if (spot.getSpotName() != null) existingSpot.setSpotName(spot.getSpotName());
        if (spot.getSpotDesc() != null) existingSpot.setSpotDesc(spot.getSpotDesc());
        if (spot.getSpotType() != null) existingSpot.setSpotType(spot.getSpotType());
        if (spot.getLongitude() != null) existingSpot.setLongitude(spot.getLongitude());
        if (spot.getLatitude() != null) existingSpot.setLatitude(spot.getLatitude());
        if (spot.getOpenTime() != null) existingSpot.setOpenTime(spot.getOpenTime());
        if (spot.getRecommendTime() != null) existingSpot.setRecommendTime(spot.getRecommendTime());
        // spotImage 允许用空字符串来清除图片（区别于未提供字段时的 null）
        if (spot.getSpotImage() != null) existingSpot.setSpotImage(spot.getSpotImage());
        if (spot.getSuitableMode() != null) existingSpot.setSuitableMode(spot.getSuitableMode());
        if (spot.getIsEnable() != null) existingSpot.setIsEnable(spot.getIsEnable());
        campusSpotService.updateById(existingSpot);
        return ApiResponse.success(existingSpot);
    }

    @PostMapping
    public ApiResponse<TCampusSpot> createSpot(@RequestBody TCampusSpot spot) {
        if (spot.getIsEnable() == null) spot.setIsEnable(1);
        campusSpotService.save(spot);
        return ApiResponse.success(spot);
    }

    @DeleteMapping("/all")
    public ApiResponse<String> deleteAllSpots() {
        campusSpotService.remove(new QueryWrapper<>());
        return ApiResponse.success("删除成功");
    }

    @DeleteMapping("/{spotId}")
    public ApiResponse<String> deleteSpot(@PathVariable Long spotId) {
        TCampusSpot spot = campusSpotService.getSpotForAdmin(spotId);
        spot.setIsEnable(0);
        campusSpotService.updateById(spot);
        return ApiResponse.success("已禁用");
    }

    @PostMapping("/anonymize")
    public ApiResponse<String> anonymizeSpots() {
        java.util.Map<Long, String> teachingSpots = new java.util.HashMap<>();
        teachingSpots.put(35L, "计算机科学与工程学院");
        teachingSpots.put(36L, "数理学院");
        teachingSpots.put(37L, "人工智能学院");
        teachingSpots.put(38L, "国际交流学院");
        teachingSpots.put(39L, "生物医药学院");
        teachingSpots.put(40L, "商学院");
        teachingSpots.put(41L, "创意设计学院");
        teachingSpots.put(42L, "艺术展览馆");
        teachingSpots.put(43L, "音乐中心");
        teachingSpots.put(89L, "电气工程学院");
        teachingSpots.put(90L, "西校区一号教学楼");
        teachingSpots.put(91L, "材料科学楼");
        teachingSpots.put(92L, "先进材料研究中心");
        teachingSpots.put(93L, "材料科学国家重点实验室");
        teachingSpots.put(97L, "行政楼");
        teachingSpots.put(98L, "教学主楼");
        teachingSpots.put(99L, "图文信息中心");
        teachingSpots.put(100L, "实验楼");
        teachingSpots.put(102L, "图书馆");
        teachingSpots.put(108L, "体育学院");
        teachingSpots.put(109L, "综合体育馆");
        teachingSpots.put(110L, "人文艺术中心");
        teachingSpots.put(111L, "外国语学院");
        teachingSpots.put(112L, "法律与政治学院");
        teachingSpots.put(113L, "能源与动力学院");
        teachingSpots.put(114L, "东校区教学楼");
        teachingSpots.put(119L, "后勤服务中心");

        java.util.Map<Long, String> greenSpots = new java.util.HashMap<>();
        greenSpots.put(94L, "校园雕塑");
        greenSpots.put(95L, "北校门");
        greenSpots.put(96L, "大学生活动中心");
        greenSpots.put(101L, "后山公园");
        greenSpots.put(103L, "植物园");
        greenSpots.put(115L, "校桥");

        teachingSpots.forEach((id, name) -> {
            TCampusSpot spot = campusSpotService.getSpotById(id);
            if (spot != null) {
                spot.setSpotName(name);
                spot.setSpotDesc(name);
                campusSpotService.updateById(spot);
            }
        });

        greenSpots.forEach((id, name) -> {
            TCampusSpot spot = campusSpotService.getSpotById(id);
            if (spot != null) {
                spot.setSpotName(name);
                spot.setSpotDesc(name);
                campusSpotService.updateById(spot);
            }
        });

        return ApiResponse.success("脱敏完成");
    }
}
