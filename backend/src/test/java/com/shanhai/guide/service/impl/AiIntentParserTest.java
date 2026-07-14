package com.shanhai.guide.service.impl;

import com.shanhai.guide.entity.TCampusSpot;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AiIntentParserTest {

    private final List<TCampusSpot> spots = List.of(
            spot(1L, "山海大学南门", "便民服务"),
            spot(2L, "山海大学知海图书馆", "教学场馆"),
            spot(3L, "第一食堂", "餐饮美食"),
            spot(4L, "综合体育馆", "运动场地"),
            spot(5L, "山海大学学术交流中心", "学术交流"),
            spot(6L, "校史文化馆", "文化场馆")
    );

    @Test
    void parsesRequiredLanguageMatrix() {
        assertIntent("介绍一条适合新生的校园路线", true, AiIntentParser.Intent.ROUTE_PLAN);

        AiIntentParser.AiIntentResult fromTo = parse("介绍一下从南门到图书馆怎么走", false);
        assertEquals(AiIntentParser.Intent.NAVIGATION, fromTo.intent());
        assertEquals("山海大学南门", fromTo.explicitStart().name());
        assertEquals("end", fromTo.entities().spots().get(fromTo.entities().spots().size() - 1).role());

        AiIntentParser.AiIntentResult intro = parse("给学术交流中心生成30秒介绍", false);
        assertEquals(AiIntentParser.Intent.SPOT_INTRO, intro.intent());
        assertEquals(30, intro.entities().narrationSeconds());
        assertEquals(1, intro.entities().spots().size());
        assertEquals("山海大学学术交流中心", intro.entities().spots().get(0).resolvedSpotName());

        AiIntentParser.AiIntentResult hours = parse("介绍图书馆的开放时间", false);
        assertEquals(AiIntentParser.Intent.SPOT_OPEN_HOURS, hours.intent());
        assertEquals(1, hours.entities().spots().size());

        AiIntentParser.AiIntentResult recommend = parse("推荐图书馆、食堂和体育馆三个点位", false);
        assertEquals(AiIntentParser.Intent.SPOT_RECOMMENDATION, recommend.intent());
        assertEquals(List.of("图书馆", "食堂", "体育"), recommend.entities().categories());

        AiIntentParser.AiIntentResult ordered = parse("先去图书馆，再去食堂", true);
        assertEquals(AiIntentParser.Intent.ROUTE_PLAN, ordered.intent());
        assertEquals(List.of("山海大学知海图书馆", "第一食堂"), ordered.entities().requestedOrder());

        AiIntentParser.AiIntentResult guideWithLocation = parse("给我做个校园导览", true);
        assertEquals(AiIntentParser.Intent.ROUTE_PLAN, guideWithLocation.intent());
        assertFalse(guideWithLocation.needsClarification());
        AiIntentParser.AiIntentResult guideWithoutLocation = parse("给我做个校园导览", false);
        assertEquals(AiIntentParser.Intent.CLARIFICATION, guideWithoutLocation.intent());

        assertEquals(AiIntentParser.Intent.CLARIFICATION, parse("给我做个校园导览介绍", false).intent());

        AiIntentParser.AiIntentResult via = parse("介绍一条从南门经过图书馆到食堂的路线", false);
        assertEquals(AiIntentParser.Intent.NAVIGATION, via.intent());
        assertEquals("山海大学南门", via.explicitStart().name());

        AiIntentParser.AiIntentResult mixed = parse("介绍学术交流中心，然后带我去图书馆", false);
        assertEquals(AiIntentParser.Intent.NAVIGATION, mixed.intent());
        assertNotNull(mixed.explicitStart());
        assertEquals("山海大学学术交流中心", mixed.explicitStart().name());

        AiIntentParser.AiIntentResult bare = parse("图书馆", false);
        assertEquals(AiIntentParser.Intent.CLARIFICATION, bare.intent());
        assertTrue(bare.needsClarification());

        AiIntentParser.AiIntentResult hello = parse("你好", false);
        assertEquals(AiIntentParser.Intent.GENERAL_CHAT, hello.intent());
        assertEquals(AiIntentParser.ResponseType.TEXT, hello.responseType());

        AiIntentParser.AiIntentResult afterRoute = parse("介绍学术交流中心", false);
        assertEquals(AiIntentParser.Intent.SPOT_INTRO, afterRoute.intent());
        assertEquals(1, afterRoute.entities().spots().size());

        AiIntentParser.AiIntentResult goAgain = parse("再去食堂", true);
        assertEquals(AiIntentParser.Intent.ROUTE_PLAN, goAgain.intent());
        assertEquals(List.of("第一食堂"), goAgain.entities().requestedOrder());
    }

    private void assertIntent(String text, boolean hasLocation, AiIntentParser.Intent expected) {
        assertEquals(expected, parse(text, hasLocation).intent());
    }

    private AiIntentParser.AiIntentResult parse(String text, boolean hasLocation) {
        return AiIntentParser.parse(text, spots, hasLocation);
    }

    private static TCampusSpot spot(Long id, String name, String type) {
        TCampusSpot spot = new TCampusSpot();
        spot.setId(id);
        spot.setSpotName(name);
        spot.setSpotType(type);
        spot.setLongitude(BigDecimal.valueOf(119.559 + id * 0.001));
        spot.setLatitude(BigDecimal.valueOf(39.932 + id * 0.001));
        spot.setIsEnable(1);
        spot.setSuitableMode("fresh,alumni,parent,research,senior");
        return spot;
    }
}
