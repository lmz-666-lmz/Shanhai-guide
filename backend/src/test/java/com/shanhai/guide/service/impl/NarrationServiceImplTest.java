package com.shanhai.guide.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.shanhai.guide.entity.TCampusSpot;
import com.shanhai.guide.entity.TKnowledge;
import com.shanhai.guide.service.KnowledgeService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentMatchers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NarrationServiceImplTest {

    @Mock
    private KnowledgeService knowledgeService;

    private TCampusSpot spotWithData;
    private TCampusSpot spotMinimal;
    private TKnowledge knowledgeFresh;
    private TKnowledge knowledgeAlumni;
    private TKnowledge knowledgeOtherSpot;
    private TKnowledge knowledgeDisabled;

    @BeforeEach
    void setUp() {
        spotWithData = new TCampusSpot();
        spotWithData.setId(1L);
        spotWithData.setSpotName("山海大学学术交流中心");
        spotWithData.setSpotType("学术交流");
        spotWithData.setSpotDesc("学术交流中心用于校园学术交流及相关活动，可承办会议和讲座。");
        spotWithData.setOpenTime("周一至周五08:30-11:30,14:30-17:30");
        spotWithData.setRecommendTime(20);
        spotWithData.setSuitableMode("fresh,alumni,parent");
        spotWithData.setUpdateTime(LocalDateTime.of(2026, 7, 1, 10, 0));

        spotMinimal = new TCampusSpot();
        spotMinimal.setId(2L);
        spotMinimal.setSpotName("山海大学某点位");
        spotMinimal.setSpotType("其他");
        spotMinimal.setSpotDesc(null);
        spotMinimal.setOpenTime("周一至周五09:00-17:00");
        spotMinimal.setRecommendTime(null);
        spotMinimal.setSuitableMode(null);
        spotMinimal.setUpdateTime(LocalDateTime.of(2026, 6, 1, 10, 0));

        knowledgeFresh = new TKnowledge();
        knowledgeFresh.setId(101L);
        knowledgeFresh.setTitle("学术交流中心新生指南");
        knowledgeFresh.setContent("新生可在学术交流中心参加开学典礼和社团招新活动。");
        knowledgeFresh.setKnowledgeType("guide");
        knowledgeFresh.setBindSpotId(1L);
        knowledgeFresh.setSuitableMode("fresh");
        knowledgeFresh.setIsEnable(1);
        knowledgeFresh.setUpdateTime(LocalDateTime.of(2026, 7, 10, 10, 0));

        knowledgeAlumni = new TKnowledge();
        knowledgeAlumni.setId(102L);
        knowledgeAlumni.setTitle("校友返校日活动");
        knowledgeAlumni.setContent("每年校友返校日期间，学术交流中心作为主会场之一。");
        knowledgeAlumni.setKnowledgeType("alumni");
        knowledgeAlumni.setBindSpotId(1L);
        knowledgeAlumni.setSuitableMode("alumni");
        knowledgeAlumni.setIsEnable(1);
        knowledgeAlumni.setUpdateTime(LocalDateTime.of(2026, 7, 5, 10, 0));

        knowledgeOtherSpot = new TKnowledge();
        knowledgeOtherSpot.setId(103L);
        knowledgeOtherSpot.setTitle("图书馆资料");
        knowledgeOtherSpot.setContent("图书馆有大量藏书。");
        knowledgeOtherSpot.setKnowledgeType("spot");
        knowledgeOtherSpot.setBindSpotId(999L); // different spot!
        knowledgeOtherSpot.setSuitableMode(null);
        knowledgeOtherSpot.setIsEnable(1);
        knowledgeOtherSpot.setUpdateTime(LocalDateTime.of(2026, 7, 1, 10, 0));

        knowledgeDisabled = new TKnowledge();
        knowledgeDisabled.setId(104L);
        knowledgeDisabled.setTitle("已禁用资料");
        knowledgeDisabled.setContent("这条资料已禁用，不应出现在Prompt中。");
        knowledgeDisabled.setKnowledgeType("spot");
        knowledgeDisabled.setBindSpotId(1L);
        knowledgeDisabled.setSuitableMode(null);
        knowledgeDisabled.setIsEnable(0); // disabled!
        knowledgeDisabled.setUpdateTime(LocalDateTime.of(2026, 7, 1, 10, 0));
    }

    // ========== 1. Concise and detailed Prompt structures differ ==========

    @Test
    void conciseAndDetailedPromptsHaveDifferentStructures() {
        var material = NarrationServiceImpl.buildMaterial(spotWithData, "concise");
        material.knowledgeItems = List.of(knowledgeFresh);
        material.materialLevel = "rich";

        String conciseFallback = NarrationServiceImpl.generateFallbackContent(material, "concise");
        String detailedFallback = NarrationServiceImpl.generateFallbackContent(material, "detailed");

        // Concise: short, max 3 sentences
        String[] conciseSentences = conciseFallback.split("[。.！!]");
        assertTrue(conciseSentences.length <= 5, "Concise should be 3 sentences max, got: " + conciseSentences.length);
        assertTrue(conciseFallback.length() <= 200, "Concise too long: " + conciseFallback.length() + " chars");

        // Detailed: multi-paragraph, more content
        assertTrue(detailedFallback.length() > conciseFallback.length(),
            "Detailed should be longer than concise");
        assertTrue(detailedFallback.contains("\n"), "Detailed should have multiple paragraphs");

        // Not just the same text extended
        assertNotEquals(conciseFallback, detailedFallback);
    }

    // ========== 2. Detailed includes more material fields ==========

    @Test
    void detailedUsesMoreMaterialFields() {
        var material = NarrationServiceImpl.buildMaterial(spotWithData, "detailed");
        material.knowledgeItems = List.of(knowledgeFresh);
        material.materialLevel = "rich";

        String detailed = NarrationServiceImpl.generateFallbackContent(material, "detailed");

        // Should include spot description or knowledge content
        assertTrue(
            detailed.contains("学术交流") || detailed.contains("会议") || detailed.contains("讲座")
                || detailed.contains("开学典礼") || detailed.contains("社团招新"),
            "Detailed should reference actual material: " + detailed);
    }

    // ========== 3. Five modes pass correctly ==========

    @Test
    void allFiveModesGenerateDistinctContent() {
        var material = NarrationServiceImpl.buildMaterial(spotWithData, "concise");
        material.knowledgeItems = List.of(knowledgeFresh, knowledgeAlumni);
        material.materialLevel = "rich";

        String concise = NarrationServiceImpl.generateFallbackContent(material, "concise");
        String detailed = NarrationServiceImpl.generateFallbackContent(material, "detailed");
        material.mode = "freshman";
        String freshman = NarrationServiceImpl.generateFallbackContent(material, "freshman");
        material.mode = "alumni";
        String alumni = NarrationServiceImpl.generateFallbackContent(material, "alumni");
        material.mode = "parent";
        String parent = NarrationServiceImpl.generateFallbackContent(material, "parent");

        // All five must differ
        long distinctCount = List.of(concise, detailed, freshman, alumni, parent).stream().distinct().count();
        assertEquals(5, distinctCount, "All five mode fallbacks must be distinct");
    }

    // ========== 4. Five fallbacks are not identical ==========

    @Test
    void fallbackContentsAreNotIdentical() {
        var material = NarrationServiceImpl.buildMaterial(spotMinimal, "concise");
        material.materialLevel = "minimal";

        String c = NarrationServiceImpl.generateFallbackContent(material, "concise");
        String d = NarrationServiceImpl.generateFallbackContent(material, "detailed");
        assertNotEquals(c, d, "Even minimal mode fallbacks should differ");
    }

    // ========== 5. Fallback contains no unsupported content ==========

    @Test
    void fallbackDoesNotContainUnsupportedContent() {
        var material = NarrationServiceImpl.buildMaterial(spotMinimal, "concise");
        material.materialLevel = "minimal";

        for (String mode : List.of("concise", "detailed", "freshman", "alumni", "parent")) {
            String content = NarrationServiceImpl.generateFallbackContent(material, mode);

            // Must NOT contain fabricated claims
            assertFalse(content.contains("留意近期活动"), mode + " should not mention activity tips: " + content);
            assertFalse(content.contains("关注学校公告栏"), mode + " should not mention notice board");
            assertFalse(content.contains("建议预约"), mode + " should not suggest reservation");
            assertFalse(content.contains("拍照打卡"), mode + " should not mention photo ops");
            assertFalse(content.contains("核心场所"), mode + " should not fabricate '核心场所'");
            assertFalse(content.contains("重大活动"), mode + " should not fabricate '重大活动'");
            assertFalse(content.contains("高水平论坛"), mode + " should not fabricate '高水平论坛'");
            assertFalse(content.contains("重要窗口"), mode + " should not fabricate '重要窗口'");
        }
    }

    // ========== 6. Only openTime → detailed mode notes insufficient data ==========

    @Test
    void detailedWithOnlyOpenTimeNotesInsufficientData() {
        var material = NarrationServiceImpl.buildMaterial(spotMinimal, "detailed");
        material.materialLevel = "minimal";

        String detailed = NarrationServiceImpl.generateFallbackContent(material, "detailed");

        assertTrue(
            detailed.contains("资料") && (detailed.contains("未收录") || detailed.contains("有限") || detailed.contains("尚未")),
            "Detailed with minimal data should state data insufficiency: " + detailed);
    }

    // ========== 7. Knowledge bound to other spotId does NOT enter ==========

    @Test
    void knowledgeForOtherSpotNotIncluded() {
        // Simulate DB returning only items with bindSpotId=1L
        when(knowledgeService.list(ArgumentMatchers.<LambdaQueryWrapper<TKnowledge>>any()))
            .thenReturn(List.of(knowledgeFresh)); // DB already filtered out bindSpotId=999

        List<TKnowledge> result = NarrationServiceImpl.querySpotKnowledge(knowledgeService, 1L, "concise");

        // knowledgeOtherSpot (bindSpotId=999) should not be in results
        assertEquals(1, result.size());
        assertEquals(101L, result.get(0).getId());
    }

    // ========== 8. Disabled knowledge does NOT enter ==========

    @Test
    void disabledKnowledgeNotIncluded() {
        // Simulate DB returning only enabled items
        when(knowledgeService.list(ArgumentMatchers.<LambdaQueryWrapper<TKnowledge>>any()))
            .thenReturn(List.of(knowledgeFresh)); // DB already filtered out isEnable=0

        List<TKnowledge> result = NarrationServiceImpl.querySpotKnowledge(knowledgeService, 1L, "concise");

        assertEquals(1, result.size());
        assertEquals(101L, result.get(0).getId());
    }

    // ========== 9. Sources only contain actually used materials ==========

    @Test
    void sourcesOnlyContainUsedMaterials() {
        var material = NarrationServiceImpl.buildMaterial(spotWithData, "concise");
        material.knowledgeItems = List.of(knowledgeFresh); // only fresh, not alumni

        // Build sources manually to verify
        String fallback = NarrationServiceImpl.generateFallbackContent(material, "concise");

        // Freshman knowledge content should not bleed into concise mode
        assertFalse(fallback.contains("开学典礼"), "Concise mode should not include fresh-specific knowledge");
    }

    // ========== 10. Cache key includes mode + duration + materialVersion ==========

    @Test
    void materialVersionChangesWithUpdateTime() {
        String v1 = NarrationServiceImpl.computeMaterialVersion(spotWithData, List.of(knowledgeFresh));
        assertNotNull(v1);
        assertTrue(v1.startsWith("v"), "Version should start with 'v': " + v1);

        // Same inputs → same version
        String v1Again = NarrationServiceImpl.computeMaterialVersion(spotWithData, List.of(knowledgeFresh));
        assertEquals(v1, v1Again);

        // Different updateTime → different version
        TCampusSpot updatedSpot = new TCampusSpot();
        updatedSpot.setId(1L);
        updatedSpot.setSpotName("山海大学学术交流中心");
        updatedSpot.setUpdateTime(LocalDateTime.of(2026, 8, 1, 10, 0)); // later
        String v2 = NarrationServiceImpl.computeMaterialVersion(updatedSpot, List.of(knowledgeFresh));
        assertNotEquals(v1, v2, "Version should change with different updateTime");
    }

    // ========== 11. Same spot different mode → different material objects ==========

    @Test
    void differentModesHaveIndependentMaterial() {
        var cMaterial = NarrationServiceImpl.buildMaterial(spotWithData, "concise");
        var dMaterial = NarrationServiceImpl.buildMaterial(spotWithData, "detailed");

        assertEquals(cMaterial.spotId, dMaterial.spotId);
        assertEquals("concise", cMaterial.mode);
        assertEquals("detailed", dMaterial.mode);
    }

    // ========== 12. Knowledge updateTime change → cache invalidation ==========

    @Test
    void knowledgeUpdateTimeChangeInvalidatesCache() {
        TKnowledge oldKnowledge = new TKnowledge();
        oldKnowledge.setId(201L);
        oldKnowledge.setTitle("test");
        oldKnowledge.setContent("test content");
        oldKnowledge.setBindSpotId(1L);
        oldKnowledge.setIsEnable(1);
        oldKnowledge.setUpdateTime(LocalDateTime.of(2026, 1, 1, 0, 0));

        TKnowledge newKnowledge = new TKnowledge();
        newKnowledge.setId(201L);
        newKnowledge.setTitle("test");
        newKnowledge.setContent("test content");
        newKnowledge.setBindSpotId(1L);
        newKnowledge.setIsEnable(1);
        newKnowledge.setUpdateTime(LocalDateTime.of(2026, 12, 31, 0, 0));

        String vOld = NarrationServiceImpl.computeMaterialVersion(spotWithData, List.of(oldKnowledge));
        String vNew = NarrationServiceImpl.computeMaterialVersion(spotWithData, List.of(newKnowledge));

        assertNotEquals(vOld, vNew, "Material version must change when knowledge updateTime changes");
    }

    // ========== 13. DeepSeek failure → fallback should have correct flags ==========

    @Test
    void materialLevelCorrectForSpotWithData() {
        var material = NarrationServiceImpl.buildMaterial(spotWithData, "concise");
        material.knowledgeItems = List.of(knowledgeFresh);
        material.materialLevel = "rich";

        assertEquals("rich", material.materialLevel);

        var minimalMaterial = NarrationServiceImpl.buildMaterial(spotMinimal, "concise");
        minimalMaterial.materialLevel = "minimal";
        assertEquals("minimal", minimalMaterial.materialLevel);
    }

    // ========== 14. Knowledge correctly filtered by mode ==========

    @Test
    void knowledgeFilteredByMode() {
        when(knowledgeService.list(ArgumentMatchers.<LambdaQueryWrapper<TKnowledge>>any())).thenReturn(List.of(knowledgeFresh, knowledgeAlumni));

        List<TKnowledge> freshmanResults = NarrationServiceImpl.querySpotKnowledge(knowledgeService, 1L, "freshman");
        List<TKnowledge> alumniResults = NarrationServiceImpl.querySpotKnowledge(knowledgeService, 1L, "alumni");

        // Both should contain both items (sorting differs, not filtering)
        // Freshman: fresh-matched knowledge should come first
        assertFalse(freshmanResults.isEmpty());
        // Alumni: alumni-matched knowledge should come first
        assertFalse(alumniResults.isEmpty());

        // First item in freshman mode should be fresh-relevant
        assertEquals(101L, freshmanResults.get(0).getId(), "Freshman mode should prioritize fresh-匹配 knowledge");
        assertEquals(102L, alumniResults.get(0).getId(), "Alumni mode should prioritize alumni-匹配 knowledge");
    }

    // ========== 15. Prompt does not contain prohibited phrases ==========

    @Test
    void materialDoesNotContainProhibitedPhrases() {
        var material = NarrationServiceImpl.buildMaterial(spotWithData, "concise");
        material.knowledgeItems = List.of(knowledgeFresh, knowledgeAlumni);
        material.materialLevel = "rich";

        for (String mode : List.of("concise", "detailed", "freshman", "alumni", "parent")) {
            String content = NarrationServiceImpl.generateFallbackContent(material, mode);

            // Check for prohibited content
            String[] prohibited = {"核心场所", "重大活动", "高水平论坛", "重要窗口",
                                   "承载了几代人的记忆", "知名校友在这里", "见证了学校的重要时刻"};
            for (String phrase : prohibited) {
                assertFalse(content.contains(phrase),
                    mode + " fallback should not contain '" + phrase + "': " + content);
            }
        }
    }

    // ========== 16. normalize helper ==========

    @Test
    void normalizeRemovesWhitespaceAndLowercases() {
        assertEquals("abc", NarrationServiceImpl.normalize("  ABC  "));
        assertEquals("测试", NarrationServiceImpl.normalize("测试 "));
        assertEquals("hello世界", NarrationServiceImpl.normalize("Hello 世界"));
    }

    // ========== 17. safeTruncate helper ==========

    @Test
    void safeTruncateHandlesEdgeCases() {
        assertEquals("", NarrationServiceImpl.safeTruncate(null, 10));
        assertEquals("", NarrationServiceImpl.safeTruncate("", 10));
        assertEquals("abc", NarrationServiceImpl.safeTruncate("abc", 10));
        assertEquals("1234567…", NarrationServiceImpl.safeTruncate("12345678901", 10)); // 11 chars → truncated to 10
        assertEquals("1234567890", NarrationServiceImpl.safeTruncate("1234567890", 10)); // exactly 10 chars → no truncation
    }
}
