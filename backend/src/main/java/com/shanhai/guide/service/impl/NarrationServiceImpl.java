package com.shanhai.guide.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.shanhai.guide.entity.TCampusSpot;
import com.shanhai.guide.entity.TKnowledge;
import com.shanhai.guide.entity.dto.ChatSource;
import com.shanhai.guide.entity.dto.NarrationRequest;
import com.shanhai.guide.entity.dto.NarrationResponse;
import com.shanhai.guide.service.CampusSpotService;
import com.shanhai.guide.service.KnowledgeService;
import com.shanhai.guide.service.NarrationService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
public class NarrationServiceImpl implements NarrationService {

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final CampusSpotService campusSpotService;
    private final KnowledgeService knowledgeService;

    @Value("${ai.deepseek.api-key:}")
    private String apiKey;

    @Value("${ai.deepseek.model:deepseek-chat}")
    private String model;

    public NarrationServiceImpl(CampusSpotService campusSpotService, KnowledgeService knowledgeService) {
        this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
        this.objectMapper = new ObjectMapper();
        this.campusSpotService = campusSpotService;
        this.knowledgeService = knowledgeService;
    }

    // ---- Mode configs with distinct structures for concise vs detailed ----

    private static final Map<String, ModeConfig> MODE_CONFIGS = Map.of(
        "concise", new ModeConfig("简洁", 30, 70, 120, """
            结构要求（严格遵守）：
            第一句：这个点位是什么（一句话）。
            第二句：一个最重要的用途或功能（只选资料中最突出的一项）。
            第三句：一个最重要的开放或使用提示。

            规则：
            - 总共70-120个汉字，最多3个自然句。
            - 只选择最重要的一项资料，不罗列多项。
            - 不要重复开放时间（已在卡片底部显示）。
            - 不要列资料完整度。
            - 不要使用Markdown标题。
            - 自然口语化，像同学在介绍。"""),
        "detailed", new ModeConfig("详细", 75, 220, 380, """
            结构要求（严格遵守）：
            第一段（1-2句）：点位基本定位，它在校园里的角色。
            第二段（2-3句）：已核实的具体功能或服务（至少使用两类不同资料字段，如spotDesc+知识库正文）。
            第三段（1-2句）：位置、使用方式或适用人群（有资料时写，无资料时写"具体使用方式请以学校实际安排为准"）。
            第四段（1句）：开放安排——只在正文中简短提及，因为开放时间已在卡片底部显示。
            第五段（1句）：预约要求、注意事项，或明确说明"当前资料尚未收录"。

            规则：
            - 220-380个汉字，3-5个自然段。
            - 至少使用两类不同资料字段（如点位描述+知识库资料）。
            - 有知识库资料时必须使用至少一项知识库事实。
            - 不重复同一事实，不用近义句凑字数。
            - 资料不足时明确写"当前资料主要记录了开放时间，尚未收录更详细的功能、预约和服务信息"，不硬凑长文。
            - 不使用Markdown标题。"""),
        "freshman", new ModeConfig("新生", 35, 80, 160, """
            结构要求：
            - 面向新生：第一次到这里关心什么、如何使用、什么时候可以去。
            - 优先使用适用人群含"新生"的资料。
            - 口吻友好实用，像学长学姐介绍。
            - 没有对应资料时明确说"当前资料尚未收录新生专属指引"，不默认添加"查看活动通知"。
            - 80-160个汉字。"""),
        "alumni", new ModeConfig("校友", 35, 80, 160, """
            结构要求：
            - 面向校友：从校园重访角度介绍。
            - 优先使用适用人群含"校友"或知识类型为"alumni"的资料。
            - 语气有温度，但禁止编造历史记忆、知名校友和重要事件。
            - 没有对应资料时明确说"当前资料未收录校友相关信息"。
            - 80-160个汉字。"""),
        "parent", new ModeConfig("家长", 35, 80, 160, """
            结构要求：
            - 面向家长：关注开放安排、进入方式和使用提示。
            - 优先使用适用人群含"家长"的资料。
            - 口吻稳重清楚。
            - 禁止编造接待政策、家长开放日和预约规定。
            - 没有对应资料时明确说"当前资料未收录家长专属指引"。
            - 80-160个汉字。""")
    );

    private record ModeConfig(String label, int durationSec, int minChars, int maxChars, String structureRules) {}

    // ======================== Public API ========================

    @Override
    public NarrationResponse generateNarration(NarrationRequest request) {
        Long spotId = request.getSpotId();
        String mode = normalizeMode(request.getMode());
        int durationSec = request.getDurationSeconds() != null ? request.getDurationSeconds()
            : MODE_CONFIGS.getOrDefault(mode, MODE_CONFIGS.get("concise")).durationSec();

        TCampusSpot spot = campusSpotService.getSpotById(spotId);
        if (spot == null) {
            return buildErrorFallback(mode, "未找到点位");
        }

        // Query knowledge bound to this specific spot
        List<TKnowledge> spotKnowledge = querySpotKnowledge(knowledgeService, spotId, mode);

        // Build aggregated material
        SpotNarrationMaterial material = buildMaterial(spot, mode);
        material.knowledgeItems = spotKnowledge;

        // Determine material level
        boolean hasDesc = material.description != null && !material.description.isBlank();
        boolean hasKnowledge = !material.knowledgeItems.isEmpty();
        material.materialLevel = hasDesc && hasKnowledge ? "rich"
            : hasDesc || hasKnowledge ? "basic"
            : "minimal";

        // Try DeepSeek first
        if (apiKey != null && !apiKey.isBlank()) {
            try {
                NarrationResponse deepseekResult = callDeepSeekForNarration(material, mode, durationSec);
                if (deepseekResult != null) return deepseekResult;
            } catch (Exception e) {
                log.warn("DeepSeek narration failed for spot={} mode={}: {}", spotId, mode, e.getMessage());
            }
        }

        // Fallback: mode-aware template from material
        return buildModeFallback(material, mode);
    }

    // ======================== Material Aggregation ========================

    static SpotNarrationMaterial buildMaterial(TCampusSpot spot, String mode) {
        SpotNarrationMaterial m = new SpotNarrationMaterial();
        m.spotId = spot.getId();
        m.spotName = spot.getSpotName();
        m.category = spot.getSpotType();
        m.description = spot.getSpotDesc();
        m.openTime = spot.getOpenTime();
        m.recommendStayMinutes = spot.getRecommendTime();
        m.suitableAudience = spot.getSuitableMode();
        m.spotUpdateTime = spot.getUpdateTime();
        m.mode = mode;
        return m;
    }

    /**
     * Query knowledge bound to this specific spot, sorted by mode relevance.
     * Package-visible for testing.
     */
    static List<TKnowledge> querySpotKnowledge(KnowledgeService knowledgeService, Long spotId, String mode) {
        // Direct query by bindSpotId — not keyword search
        LambdaQueryWrapper<TKnowledge> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TKnowledge::getBindSpotId, spotId)
               .eq(TKnowledge::getIsEnable, 1);
        List<TKnowledge> all = knowledgeService.list(wrapper);

        // Sort: mode-matching first, then by updateTime desc
        String modeLabel = modeToAudienceLabel(mode);
        return all.stream()
            .sorted(Comparator
                .comparingInt((TKnowledge k) -> knowledgeMatchesMode(k, modeLabel) ? 0 : 1)
                .thenComparing(TKnowledge::getUpdateTime, Comparator.nullsLast(Comparator.reverseOrder()))
                .thenComparing(TKnowledge::getId, Comparator.nullsLast(Comparator.reverseOrder())))
            .toList();
    }

    private static boolean knowledgeMatchesMode(TKnowledge k, String audienceLabel) {
        if (audienceLabel == null) return false;
        String suitable = k.getSuitableMode();
        if (suitable == null || suitable.isBlank()) return false;
        return normalize(suitable).contains(normalize(audienceLabel));
    }

    private static String modeToAudienceLabel(String mode) {
        return switch (mode) {
            case "freshman" -> "fresh";
            case "alumni" -> "alumni";
            case "parent" -> "parent";
            default -> null;
        };
    }

    // ======================== DeepSeek Call ========================

    private NarrationResponse callDeepSeekForNarration(SpotNarrationMaterial material, String mode, int durationSec) {
        ModeConfig config = MODE_CONFIGS.getOrDefault(mode, MODE_CONFIGS.get("concise"));

        // Build knowledge text (full content, not just titles) — capped at 2000 chars
        StringBuilder knowledgeText = new StringBuilder();
        int knowledgeCharBudget = 2000;
        for (TKnowledge k : material.knowledgeItems) {
            String body = k.getContent() != null ? k.getContent().trim() : "";
            if (body.isBlank()) continue;
            String entry = "【" + k.getTitle() + "】（类型：" + (k.getKnowledgeType() != null ? k.getKnowledgeType() : "通用") + "）\n" + body + "\n";
            if (knowledgeText.length() + entry.length() > knowledgeCharBudget) break;
            knowledgeText.append(entry);
        }
        if (knowledgeText.isEmpty()) {
            knowledgeText.append("（知识库中暂无该点位的额外资料）");
        }

        // Build spot material text with all available fields
        StringBuilder spotMaterial = new StringBuilder();
        spotMaterial.append("点位名称：").append(material.spotName).append("\n");
        if (material.category != null && !material.category.isBlank())
            spotMaterial.append("点位类别：").append(material.category).append("\n");
        if (material.description != null && !material.description.isBlank())
            spotMaterial.append("点位资料：").append(material.description).append("\n");
        if (material.openTime != null && !material.openTime.isBlank())
            spotMaterial.append("开放时间：").append(material.openTime).append("\n");
        else
            spotMaterial.append("开放时间：以学校实际安排为准\n");
        if (material.recommendStayMinutes != null && material.recommendStayMinutes > 0)
            spotMaterial.append("推荐停留：").append(material.recommendStayMinutes).append("分钟\n");
        if (material.suitableAudience != null && !material.suitableAudience.isBlank())
            spotMaterial.append("适用人群：").append(material.suitableAudience).append("\n");
        spotMaterial.append("资料完整度：").append(material.materialLevel).append("\n");

        String systemPrompt = """
            你是山海大学校园数字讲解员"小海"。你只能使用提供的点位资料和知识库内容，不得补造事实。

            禁止编造以下内容：
            - 建筑年代、建筑面积、建筑风格
            - 荣誉称号（如"核心场所""重要窗口""标志性建筑"等）
            - 重大会议、高水平论坛、知名演讲者
            - 当前实时开放状态
            - 未核实的接待规格、预约流程、收费标准
            - 历史回忆、校友故事（除非知识库明确提供）
            - 活动通知、公告（除非知识库明确提供）

            如果资料不足以支撑某个结论，请明确说"当前资料尚未收录"，不要通过常识补造。
            不要推荐其他点位，不要生成路线，不要询问"还要介绍其他点位吗"。
            """;

        String userPrompt = buildUserPrompt(spotMaterial.toString(), knowledgeText.toString(), config, durationSec, material);

        try {
            Map<String, Object> sysMsg = Map.of("role", "system", "content", systemPrompt);
            Map<String, Object> userMsg = Map.of("role", "user", "content", userPrompt);

            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("model", model);
            requestBody.put("messages", List.of(sysMsg, userMsg));
            requestBody.put("temperature", 0.7);
            requestBody.put("max_tokens", 900);

            HttpRequest httpRequest = HttpRequest.newBuilder()
                .uri(URI.create("https://api.deepseek.com/v1/chat/completions"))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + apiKey)
                .timeout(Duration.ofSeconds(25))
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(requestBody)))
                .build();

            HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());
            JsonNode root = objectMapper.readTree(response.body());

            if (root.has("error")) {
                log.warn("DeepSeek API error for narration: {}", root.get("error"));
                return null;
            }

            JsonNode choices = root.get("choices");
            if (choices != null && !choices.isEmpty()) {
                JsonNode message = choices.get(0).get("message");
                if (message != null && message.has("content")) {
                    String content = message.get("content").asText()
                        .replaceAll("(?m)^#{1,3}\\s+.*$", "")
                        .replaceAll("(?m)^---+$", "")
                        .replaceAll("还要介绍其他点位吗[？?]?", "")
                        .replaceAll("需要我(继续|再).*[？?]?", "")
                        .trim();

                    return buildDeepseekResponse(content, mode, material);
                }
            }
        } catch (Exception e) {
            log.warn("DeepSeek narration request failed: {}", e.getMessage());
        }
        return null;
    }

    private String buildUserPrompt(String spotMaterial, String knowledgeText, ModeConfig config, int durationSec, SpotNarrationMaterial material) {
        String materialNote = switch (material.materialLevel) {
            case "rich" -> "资料充足，请充分使用点位资料和知识库资料。";
            case "basic" -> "资料有限，请只使用已确认的信息，不足时明确说明。";
            case "minimal" -> "资料非常有限，请不要扩写或补造，只陈述已确认信息。";
            default -> "";
        };

        return """
            请为以下点位生成讲解词。

            === 点位资料 ===
            %s
            === 知识库资料 ===
            %s
            === 讲解要求 ===
            视角：%s
            目标时长：约%d秒
            字数范围：%d-%d个汉字
            资料情况：%s

            %s

            重要提醒：
            - 只输出讲解正文，不要Markdown标题或分隔线
            - 不要问"还要介绍其他点位吗"之类的问题
            - 使用自然中文导览语气，以点位名称自然开头
            - %s
            """.formatted(
                spotMaterial,
                knowledgeText,
                config.label() + "视角",
                durationSec,
                config.minChars(), config.maxChars(),
                materialNote,
                config.structureRules(),
                material.materialLevel.equals("minimal") || material.materialLevel.equals("basic")
                    ? "资料有限，禁止扩写、推测或补造。不足时直接说「当前资料尚未收录」。"
                    : "充分使用已有资料，但不编造。"
            );
    }

    private NarrationResponse buildDeepseekResponse(String content, String mode, SpotNarrationMaterial material) {
        NarrationResponse result = new NarrationResponse();
        result.setContent(content);
        result.setMode(mode);
        result.setGeneratedBy("deepseek");
        result.setFallbackUsed(false);
        result.setFallbackReason("");
        result.setMaterialLevel(material.materialLevel);
        result.setKnowledgeUsed(!material.knowledgeItems.isEmpty());
        result.setUsedKnowledgeIds(material.knowledgeItems.stream().map(TKnowledge::getId).toList());
        result.setSources(buildSources(material));
        return result;
    }

    // ======================== Mode-specific Fallbacks ========================

    private NarrationResponse buildModeFallback(SpotNarrationMaterial material, String mode) {
        String content = generateFallbackContent(material, mode);
        String reason = (apiKey == null || apiKey.isBlank())
            ? "DeepSeek API 未配置"
            : "DeepSeek 暂时不可用";

        NarrationResponse result = new NarrationResponse();
        result.setContent(content);
        result.setMode(mode);
        result.setGeneratedBy("fallback");
        result.setFallbackUsed(true);
        result.setFallbackReason(reason);
        result.setMaterialLevel(material.materialLevel);
        result.setKnowledgeUsed(!material.knowledgeItems.isEmpty());
        result.setUsedKnowledgeIds(material.knowledgeItems.stream().map(TKnowledge::getId).toList());
        result.setSources(buildSources(material));
        return result;
    }

    static String generateFallbackContent(SpotNarrationMaterial material, String mode) {
        String name = material.spotName;
        String desc = material.description;
        String openTime = material.openTime != null && !material.openTime.isBlank()
            ? material.openTime : "以学校实际安排为准";
        boolean hasDesc = desc != null && !desc.isBlank();
        boolean hasKnowledge = !material.knowledgeItems.isEmpty();

        return switch (mode) {
            case "concise" -> buildConciseText(name, desc, openTime, hasDesc);
            case "detailed" -> buildDetailedText(name, desc, openTime, hasDesc, hasKnowledge, material);
            case "freshman" -> buildFreshmanText(name, desc, openTime, hasDesc);
            case "alumni" -> buildAlumniText(name, desc, openTime, hasDesc);
            case "parent" -> buildParentText(name, desc, openTime, hasDesc);
            default -> buildConciseText(name, desc, openTime, hasDesc);
        };
    }

    // ---- Concise: 3 sentences max, one key fact ----

    private static String buildConciseText(String name, String desc, String openTime, boolean hasDesc) {
        if (!hasDesc) {
            return name + "是山海大学校园场所。当前资料记录的开放时间为" + openTime + "，临时调整请以学校通知为准。";
        }
        String shortDesc = safeTruncate(desc, 80);
        return name + "，" + shortDesc + "。开放时间为" + openTime + "，临时调整请以学校通知为准。";
    }

    // ---- Detailed: multi-paragraph, uses material richness ----

    private static String buildDetailedText(String name, String desc, String openTime, boolean hasDesc, boolean hasKnowledge, SpotNarrationMaterial material) {
        if (!hasDesc && !hasKnowledge) {
            return name + "是山海大学校园内的场所。\n\n"
                + "当前资料主要记录了开放时间，尚未收录更详细的功能、预约和服务信息。\n\n"
                + "开放时间：" + openTime + "。实际使用请以学校通知为准。";
        }

        StringBuilder sb = new StringBuilder();
        sb.append(name);

        // Para 1: basic positioning
        if (hasDesc) {
            sb.append("，").append(safeTruncate(desc, 180));
        } else {
            sb.append("是山海大学校园场所。");
        }
        sb.append("\n\n");

        // Para 2: verified functions from knowledge
        if (hasKnowledge && !material.knowledgeItems.isEmpty()) {
            String knowledgeBody = material.knowledgeItems.stream()
                .map(k -> k.getContent())
                .filter(Objects::nonNull)
                .filter(c -> !c.isBlank())
                .map(c -> safeTruncate(c, 160))
                .limit(2)
                .collect(Collectors.joining(" "));
            if (!knowledgeBody.isBlank()) {
                sb.append("已录入资料：").append(knowledgeBody).append("\n\n");
            }
        }

        // Para 3: usage info or disclaimer
        if (material.recommendStayMinutes != null && material.recommendStayMinutes > 0) {
            sb.append("建议停留约").append(material.recommendStayMinutes).append("分钟。");
        }
        if (material.suitableAudience != null && !material.suitableAudience.isBlank()) {
            sb.append("适用人群：").append(material.suitableAudience).append("。");
        }
        sb.append("\n");

        // Para 4: open time (brief since card shows it)
        sb.append("开放时间：").append(openTime).append("，临时调整请以学校通知为准。\n");

        // Para 5: what's missing
        if (!hasKnowledge) {
            sb.append("当前资料尚未收录更详细的功能说明、预约方式和活动安排信息。");
        }

        return sb.toString().trim();
    }

    // ---- Freshman: no made-up activity tips ----

    private static String buildFreshmanText(String name, String desc, String openTime, boolean hasDesc) {
        if (!hasDesc) {
            return "这里是" + name + "。\n\n开放时间：" + openTime + "。\n\n当前资料尚未收录新生专属指引，具体使用方式请以学校实际安排为准。";
        }
        return name + "，" + safeTruncate(desc, 100) + "\n\n开放时间：" + openTime + "。\n\n新生同学可以留意此处的基本信息和开放安排，具体使用规则请以学校通知为准。";
    }

    // ---- Alumni: warm tone, no fabricated history ----

    private static String buildAlumniText(String name, String desc, String openTime, boolean hasDesc) {
        if (!hasDesc) {
            return name + "是校内场所。\n\n开放时间：" + openTime + "。\n\n当前资料未收录校友相关信息，回校时可以关注学校发布的公开安排。";
        }
        return "欢迎回到校园～" + name + "，" + safeTruncate(desc, 100) + "\n\n开放时间：" + openTime + "。\n\n回校时可以留意学校发布的相关信息，具体安排以学校实际通知为准。";
    }

    // ---- Parent: factual, no fabricated reception policies ----

    private static String buildParentText(String name, String desc, String openTime, boolean hasDesc) {
        if (!hasDesc) {
            return name + "是校内场所。\n\n开放时间：" + openTime + "。\n\n当前资料未收录家长专属指引，来校参观时，具体安排请以学校发布的信息为准。";
        }
        return name + "，" + safeTruncate(desc, 100) + "\n\n开放时间：" + openTime + "。\n\n来校参观时，请以学校发布的信息为准。如需了解更多，可咨询学校相关部门。";
    }

    // ======================== Helpers ========================

    static String normalize(String text) {
        return text == null ? "" : text.toLowerCase(Locale.ROOT).replaceAll("\\s+", "").trim();
    }

    private String normalizeMode(String mode) {
        if (mode == null) return "concise";
        return switch (mode.toLowerCase()) {
            case "detailed" -> "detailed";
            case "freshman", "fresh" -> "freshman";
            case "alumni" -> "alumni";
            case "parent" -> "parent";
            default -> "concise";
        };
    }

    static String safeTruncate(String text, int maxLen) {
        if (text == null || text.isBlank()) return "";
        String cleaned = text.replaceAll("\\s+", " ").trim();
        return cleaned.length() <= maxLen ? cleaned : cleaned.substring(0, maxLen - 3) + "…";
    }

    /**
     * Compute a material version string for cache keys.
     * Based on spot updateTime + max knowledge updateTime.
     */
    static String computeMaterialVersion(TCampusSpot spot, List<TKnowledge> knowledgeItems) {
        long spotTs = spot.getUpdateTime() != null ? spot.getUpdateTime().atZone(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli() : 0;
        long maxKnowledgeTs = knowledgeItems.stream()
            .map(TKnowledge::getUpdateTime)
            .filter(Objects::nonNull)
            .mapToLong(t -> t.atZone(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli())
            .max()
            .orElse(0);
        return "v" + Math.max(spotTs, maxKnowledgeTs);
    }

    private List<ChatSource> buildSources(SpotNarrationMaterial material) {
        List<ChatSource> sources = new ArrayList<>();
        sources.add(new ChatSource("spot", material.spotId,
            material.spotName + "点位资料", "山海大学校园点位库",
            safeTruncate(material.description, 120)));
        for (TKnowledge k : material.knowledgeItems) {
            sources.add(new ChatSource("knowledge", k.getId(), k.getTitle(),
                "校园知识库", safeTruncate(k.getContent(), 120)));
        }
        return sources;
    }

    private NarrationResponse buildErrorFallback(String mode, String reason) {
        NarrationResponse result = new NarrationResponse();
        result.setContent("点位资料暂时无法获取，请稍后重试。");
        result.setMode(mode);
        result.setGeneratedBy("fallback");
        result.setFallbackUsed(true);
        result.setFallbackReason(reason);
        result.setMaterialLevel("minimal");
        result.setKnowledgeUsed(false);
        result.setUsedKnowledgeIds(List.of());
        result.setSources(List.of());
        return result;
    }

    // ======================== Material Object ========================

    /**
     * Aggregated narration material from all available spot + knowledge fields.
     * Package-visible for testing.
     */
    static class SpotNarrationMaterial {
        Long spotId;
        String spotName;
        String category;               // spotType
        String description;            // spotDesc
        String openTime;
        Integer recommendStayMinutes;  // recommendTime
        String suitableAudience;       // suitableMode
        LocalDateTime spotUpdateTime;
        String mode;
        String materialLevel;          // set after build: rich|basic|minimal
        List<TKnowledge> knowledgeItems = List.of();
    }
}
