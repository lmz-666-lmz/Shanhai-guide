package com.shanhai.guide.service.impl;

import com.shanhai.guide.entity.TCampusSpot;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

final class AiIntentParser {

    enum Intent {
        ROUTE_PLAN("route_plan"),
        NAVIGATION("navigation"),
        SPOT_INTRO("spot_intro"),
        SPOT_OPEN_HOURS("spot_open_hours"),
        SPOT_RECOMMENDATION("spot_recommendation"),
        NEARBY_RECOMMENDATION("nearby_recommendation"),
        GENERAL_CHAT("general_chat"),
        CLARIFICATION("clarification");

        private final String value;

        Intent(String value) {
            this.value = value;
        }

        String value() {
            return value;
        }
    }

    enum ResponseType {
        ROUTE_PLAN("route_plan"),
        SPOT_INTRO("spot_intro"),
        SPOT_LIST("spot_list"),
        TEXT("text"),
        CLARIFICATION("clarification");

        private final String value;

        ResponseType(String value) {
            this.value = value;
        }

        String value() {
            return value;
        }
    }

    record ExplicitStart(Long spotId, String name) {
    }

    record SpotEntity(String rawText,
                      Long resolvedSpotId,
                      String resolvedSpotName,
                      String role,
                      TCampusSpot spot,
                      int offset) {
        SpotEntity withRole(String nextRole) {
            return new SpotEntity(rawText, resolvedSpotId, resolvedSpotName, nextRole, spot, offset);
        }
    }

    record IntentEntities(List<SpotEntity> spots,
                          List<String> categories,
                          String audience,
                          Integer durationMinutes,
                          Integer narrationSeconds,
                          List<String> requestedOrder) {
    }

    record AiIntentResult(Intent intent,
                          double confidence,
                          IntentEntities entities,
                          ExplicitStart explicitStart,
                          boolean needsLocation,
                          boolean needsClarification,
                          String clarificationQuestion,
                          ResponseType responseType) {
        String intentValue() {
            return intent.value();
        }

        String responseTypeValue() {
            return responseType.value();
        }
    }

    private static final Pattern SECOND_PATTERN = Pattern.compile("(\\d+)\\s*(秒|s|sec|second)", Pattern.CASE_INSENSITIVE);
    private static final Pattern MINUTE_PATTERN = Pattern.compile("(\\d+)\\s*(分钟|分|min|m)", Pattern.CASE_INSENSITIVE);
    private static final Pattern HOUR_PATTERN = Pattern.compile("(\\d+)\\s*(小时|个小时|h)", Pattern.CASE_INSENSITIVE);

    private static final Map<String, List<String>> CATEGORY_ALIASES = categoryAliases();

    private AiIntentParser() {
    }

    private static Map<String, List<String>> categoryAliases() {
        Map<String, List<String>> aliases = new LinkedHashMap<>();
        aliases.put("图书馆", List.of("图书馆", "阅览室", "知海图书馆"));
        aliases.put("食堂", List.of("食堂", "餐厅", "餐饮", "饭堂"));
        aliases.put("体育", List.of("体育馆", "体育场", "运动场", "操场", "体育中心", "健身场所", "健身房"));
        aliases.put("宿舍", List.of("宿舍", "公寓", "学生公寓", "生活区"));
        aliases.put("教学", List.of("教学楼", "学院楼", "实训中心", "实验楼"));
        return aliases;
    }

    static AiIntentResult parse(String text, List<TCampusSpot> spots, boolean hasLocation) {
        String content = text == null ? "" : text.trim();
        String normalized = normalize(content);
        List<SpotEntity> resolvedSpots = resolveSpotEntities(content, spots);
        List<String> categories = extractRequestedCategories(content);
        String audience = extractAudience(normalized);
        Integer durationMinutes = extractDurationMinute(content);
        Integer narrationSeconds = extractNarrationSeconds(content);

        if (normalized.isBlank()) {
            return clarification(resolvedSpots, categories, audience, durationMinutes, narrationSeconds, "你想咨询点位介绍、路线规划，还是校园活动？");
        }
        if (isGreeting(normalized)) {
            return result(Intent.GENERAL_CHAT, 0.96, resolvedSpots, categories, audience, durationMinutes, narrationSeconds,
                    null, false, false, null, ResponseType.TEXT);
        }

        boolean fromTo = hasFromToStructure(normalized);
        boolean sequential = hasSequentialStructure(normalized);
        boolean navigation = hasNavigationStructure(normalized);
        boolean routeObject = hasRouteObjectStructure(normalized);
        boolean mixedIntroNavigate = hasMixedIntroNavigateStructure(normalized, resolvedSpots);
        boolean campusGuide = hasCampusGuideStructure(normalized);
        boolean guideIntroWithoutConcreteSpot = containsAny(normalized, "导览介绍", "校园导览介绍")
                && resolvedSpots.isEmpty()
                && !fromTo
                && !sequential
                && !routeObject;

        if (guideIntroWithoutConcreteSpot) {
            return clarification(resolvedSpots, categories, audience, durationMinutes, narrationSeconds,
                    "你想让我介绍某一个具体点位，还是从当前位置为你规划一条校园导览路线？");
        }

        boolean routeStructure = fromTo || sequential || navigation || routeObject || mixedIntroNavigate || campusGuide;
        if (routeStructure) {
            List<SpotEntity> roleSpots = assignRouteRoles(content, resolvedSpots, fromTo, sequential, mixedIntroNavigate);
            ExplicitStart explicitStart = explicitStartFrom(roleSpots);
            boolean locationRequired = (navigation || sequential || campusGuide || mixedIntroNavigate) && explicitStart == null && !hasLocation;
            if (locationRequired) {
                return result(Intent.CLARIFICATION, 0.9, roleSpots, categories, audience, durationMinutes, narrationSeconds,
                        explicitStart, true, true, "从当前位置、演示位置还是指定点位开始？", ResponseType.CLARIFICATION);
            }
            Intent intent = navigation || fromTo ? Intent.NAVIGATION : Intent.ROUTE_PLAN;
            return result(intent, 0.94, roleSpots, categories, audience, durationMinutes, narrationSeconds,
                    explicitStart, explicitStart == null && (navigation || sequential || campusGuide), false, null, ResponseType.ROUTE_PLAN);
        }

        boolean openHours = containsAny(normalized, "开放时间", "几点开放", "几点关门", "开馆时间", "闭馆时间");
        if (openHours) {
            if (resolvedSpots.size() == 1) {
                return result(Intent.SPOT_OPEN_HOURS, 0.95, markSingleTarget(resolvedSpots), categories, audience,
                        durationMinutes, narrationSeconds, null, false, false, null, ResponseType.SPOT_INTRO);
            }
            return clarification(resolvedSpots, categories, audience, durationMinutes, narrationSeconds,
                    "你想查询哪个点位的开放时间？");
        }

        boolean intro = containsAny(normalized, "介绍", "讲解", "简介", "讲解词", "是做什么", "这个建筑", "服务内容");
        if (intro && resolvedSpots.size() == 1) {
            return result(Intent.SPOT_INTRO, 0.94, markSingleTarget(resolvedSpots), categories, audience,
                    durationMinutes, narrationSeconds, null, false, false, null, ResponseType.SPOT_INTRO);
        }

        boolean nearby = containsAny(normalized, "附近", "周边", "离我近");
        boolean recommendation = containsAny(normalized, "推荐", "几个", "哪些", "值得去", "值得", "可以逛", "好玩", "转转", "适合新生", "适合参观");
        // 用户提到"地方/点位/值得参观"等，已明确为点位推荐，不返回澄清
        boolean wantsPlaces = containsAny(normalized, "地方", "点位", "景点", "参观", "转转", "好玩", "值得", "必看");
        if (recommendation && !nearby && categories.isEmpty() && resolvedSpots.isEmpty() && audience == null && !wantsPlaces) {
            return clarification(resolvedSpots, categories, audience, durationMinutes, narrationSeconds,
                    "你想推荐哪类内容：点位、路线，还是附近值得去的地方？");
        }
        if (nearby || recommendation || categories.size() > 1 || resolvedSpots.size() > 1) {
            if (nearby && !hasLocation) {
                return result(Intent.CLARIFICATION, 0.86, resolvedSpots, categories, audience, durationMinutes, narrationSeconds,
                        null, true, true, "需要先知道当前位置、演示位置或手动起点，才能推荐附近点位。", ResponseType.CLARIFICATION);
            }
            Intent intent = nearby ? Intent.NEARBY_RECOMMENDATION : Intent.SPOT_RECOMMENDATION;
            return result(intent, 0.88, markRecommendationTargets(resolvedSpots), categories, audience,
                    durationMinutes, narrationSeconds, null, nearby, false, null, ResponseType.SPOT_LIST);
        }

        if (resolvedSpots.size() == 1 && isBareSpotQuestion(normalized, resolvedSpots.get(0))) {
            return result(Intent.CLARIFICATION, 0.88, markSingleTarget(resolvedSpots), categories, audience,
                    durationMinutes, narrationSeconds, null, false, true,
                    "你是想了解这个点位的介绍、开放时间，还是导航过去？", ResponseType.CLARIFICATION);
        }

        return result(Intent.GENERAL_CHAT, 0.7, resolvedSpots, categories, audience, durationMinutes, narrationSeconds,
                null, false, false, null, ResponseType.TEXT);
    }

    public static String normalize(String text) {
        return text == null ? "" : text.toLowerCase(Locale.ROOT)
                .replaceAll("[\\s,，。！？?!.;；:：、()（）【】\\[\\]\"'“”‘’]+", "")
                .trim();
    }

    static String spotCategory(TCampusSpot spot) {
        String name = normalize(spot == null ? null : spot.getSpotName());
        String type = normalize(spot == null ? null : spot.getSpotType());
        if (name.contains("图书馆") || name.contains("阅览室") || type.contains("图书")) return "图书馆";
        if (name.contains("食堂") || name.contains("餐厅") || name.contains("饭堂") || type.contains("餐饮")) return "食堂";
        if (name.contains("体育") || name.contains("运动") || name.contains("操场")
                || type.contains("运动") || type.contains("体育")) return "体育";
        if (name.contains("宿舍") || name.contains("公寓") || name.contains("生活区") || type.contains("宿舍")) return "宿舍";
        if (name.contains("教学") || name.contains("学院楼") || name.contains("实训")
                || name.contains("实验") || type.contains("教学")) return "教学";
        if (name.contains("门")) return "校门";
        if (name.contains("校史") || type.contains("文化")) return "文化场馆";
        if (name.contains("湖") || name.contains("广场") || type.contains("景观")) return "景观";
        return type.isBlank() ? "其他" : spot.getSpotType();
    }

    static TCampusSpot bestSpotForCategory(String category, List<TCampusSpot> spots) {
        return spots.stream()
                .filter(spot -> Objects.equals(spotCategory(spot), category))
                .min(Comparator.comparingInt((TCampusSpot spot) -> categoryRank(category, spot))
                        .thenComparing(TCampusSpot::getId, Comparator.nullsLast(Comparator.naturalOrder())))
                .orElse(null);
    }

    private static int categoryRank(String category, TCampusSpot spot) {
        String name = normalize(spot.getSpotName());
        if (Objects.equals(category, "图书馆") && name.contains("图书馆")) return 0;
        if (Objects.equals(category, "食堂") && name.contains("食堂")) return 0;
        if (Objects.equals(category, "体育") && name.contains("体育馆")) return 0;
        if (Objects.equals(category, "宿舍") && name.contains("公寓")) return 0;
        if (Objects.equals(category, "教学") && name.contains("教学")) return 0;
        return 10;
    }

    private static AiIntentResult result(Intent intent,
                                         double confidence,
                                         List<SpotEntity> spots,
                                         List<String> categories,
                                         String audience,
                                         Integer durationMinutes,
                                         Integer narrationSeconds,
                                         ExplicitStart explicitStart,
                                         boolean needsLocation,
                                         boolean needsClarification,
                                         String clarificationQuestion,
                                         ResponseType responseType) {
        List<String> requestedOrder = spots.stream()
                .filter(item -> item.resolvedSpotName() != null)
                .sorted(Comparator.comparingInt(SpotEntity::offset))
                .map(SpotEntity::resolvedSpotName)
                .distinct()
                .toList();
        IntentEntities entities = new IntentEntities(List.copyOf(spots), List.copyOf(categories), audience,
                durationMinutes, narrationSeconds, requestedOrder);
        return new AiIntentResult(intent, confidence, entities, explicitStart, needsLocation,
                needsClarification, clarificationQuestion, responseType);
    }

    private static AiIntentResult clarification(List<SpotEntity> spots,
                                                List<String> categories,
                                                String audience,
                                                Integer durationMinutes,
                                                Integer narrationSeconds,
                                                String question) {
        return result(Intent.CLARIFICATION, 0.8, spots, categories, audience, durationMinutes, narrationSeconds,
                null, false, true, question, ResponseType.CLARIFICATION);
    }

    private static List<SpotEntity> resolveSpotEntities(String text, List<TCampusSpot> spots) {
        String normalized = normalize(text);
        Map<Long, SpotEntity> byId = new LinkedHashMap<>();
        Set<String> usedRaw = new LinkedHashSet<>();

        for (TCampusSpot spot : spots) {
            for (String alias : spotAliases(spot)) {
                String normalizedAlias = normalize(alias);
                if (normalizedAlias.length() < 2) continue;
                int offset = normalized.indexOf(normalizedAlias);
                if (offset < 0) continue;
                SpotEntity previous = byId.get(spot.getId());
                if (previous == null || normalizedAlias.length() > normalize(previous.rawText()).length()) {
                    byId.put(spot.getId(), new SpotEntity(alias, spot.getId(), spot.getSpotName(), null, spot, offset));
                }
                usedRaw.add(normalizedAlias);
            }
        }

        for (String category : extractRequestedCategories(text)) {
            boolean alreadyCovered = byId.values().stream().anyMatch(item -> Objects.equals(spotCategory(item.spot()), category));
            if (alreadyCovered) continue;
            TCampusSpot matched = bestSpotForCategory(category, spots);
            if (matched == null) continue;
            int offset = firstCategoryOffset(normalized, category);
            String raw = firstCategoryAliasInText(normalized, category);
            if (usedRaw.contains(normalize(raw))) continue;
            byId.putIfAbsent(matched.getId(), new SpotEntity(raw, matched.getId(), matched.getSpotName(), null, matched, offset));
        }

        return byId.values().stream()
                .sorted(Comparator.comparingInt(SpotEntity::offset).thenComparing(SpotEntity::resolvedSpotId))
                .toList();
    }

    private static List<String> spotAliases(TCampusSpot spot) {
        if (spot == null || spot.getSpotName() == null) return List.of();
        Set<String> aliases = new LinkedHashSet<>();
        aliases.add(spot.getSpotName());
        String withoutPrefix = spot.getSpotName().replace("山海大学", "").trim();
        if (!withoutPrefix.isBlank()) aliases.add(withoutPrefix);
        String normalized = normalize(withoutPrefix);
        if (normalized.contains("南门")) aliases.add("南门");
        if (normalized.contains("图书馆")) {
            aliases.add("图书馆");
            aliases.add("知海图书馆");
            aliases.add("阅览室");
        }
        if (normalized.contains("学术交流中心")) aliases.add("学术交流中心");
        if (normalized.contains("校史")) aliases.add("校史馆");
        return new ArrayList<>(aliases);
    }

    private static List<String> extractRequestedCategories(String text) {
        String normalized = normalize(text);
        List<String> categories = new ArrayList<>();
        for (Map.Entry<String, List<String>> entry : CATEGORY_ALIASES.entrySet()) {
            if (entry.getValue().stream().anyMatch(alias -> normalized.contains(normalize(alias)))) {
                categories.add(entry.getKey());
            }
        }
        return categories.stream().distinct().toList();
    }

    private static int firstCategoryOffset(String normalized, String category) {
        return CATEGORY_ALIASES.getOrDefault(category, List.of(category)).stream()
                .map(AiIntentParser::normalize)
                .mapToInt(alias -> {
                    int index = normalized.indexOf(alias);
                    return index < 0 ? Integer.MAX_VALUE : index;
                })
                .min()
                .orElse(Integer.MAX_VALUE);
    }

    private static String firstCategoryAliasInText(String normalized, String category) {
        return CATEGORY_ALIASES.getOrDefault(category, List.of(category)).stream()
                .filter(alias -> normalized.contains(normalize(alias)))
                .findFirst()
                .orElse(category);
    }

    private static List<SpotEntity> assignRouteRoles(String text,
                                                     List<SpotEntity> spots,
                                                     boolean fromTo,
                                                     boolean sequential,
                                                     boolean mixedIntroNavigate) {
        if (spots.isEmpty()) return spots;
        List<SpotEntity> ordered = new ArrayList<>(spots);
        ordered.sort(Comparator.comparingInt(SpotEntity::offset));
        List<SpotEntity> result = new ArrayList<>();
        for (int index = 0; index < ordered.size(); index++) {
            SpotEntity item = ordered.get(index);
            String role = "waypoint";
            if (fromTo && index == 0) role = "start";
            else if (fromTo && index == ordered.size() - 1) role = "end";
            else if ((sequential || mixedIntroNavigate) && index == ordered.size() - 1) role = "end";
            else if ((sequential || mixedIntroNavigate) && index == 0 && mixedIntroNavigate) role = "start";
            else if (ordered.size() == 1) role = "target";
            result.add(item.withRole(role));
        }
        return result;
    }

    private static List<SpotEntity> markSingleTarget(List<SpotEntity> spots) {
        return spots.stream().map(item -> item.withRole("target")).toList();
    }

    private static List<SpotEntity> markRecommendationTargets(List<SpotEntity> spots) {
        return spots.stream().map(item -> item.role() == null ? item.withRole("target") : item).toList();
    }

    private static ExplicitStart explicitStartFrom(List<SpotEntity> spots) {
        return spots.stream()
                .filter(item -> "start".equals(item.role()))
                .findFirst()
                .map(item -> new ExplicitStart(item.resolvedSpotId(), item.resolvedSpotName()))
                .orElse(null);
    }

    private static boolean hasFromToStructure(String normalized) {
        return normalized.contains("从") && (normalized.contains("到") || normalized.contains("去"))
                && (containsAny(normalized, "怎么走", "怎么去", "路线", "导航", "走", "经过", "途经")
                || normalized.matches(".*从.+(到|去).+"));
    }

    private static boolean hasSequentialStructure(String normalized) {
        return containsAny(normalized, "先去", "再去", "然后去", "接着去", "再到", "然后带我去", "带我去");
    }

    private static boolean hasNavigationStructure(String normalized) {
        return containsAny(normalized, "导航到", "怎么去", "怎么走到", "走到", "带我去");
    }

    private static boolean hasRouteObjectStructure(String normalized) {
        return containsAny(normalized, "介绍一条路线", "介绍校园路线", "推荐一条路线", "规划路线", "参观路线",
                "路线", "串联", "途经", "经过", "包含", "半日游", "一日游", "参观行程", "安排半日", "安排一日")
                || (containsAny(normalized, "一小时", "半小时", "两小时", "分钟", "小时")
                && containsAny(normalized, "校园", "参观", "游览", "逛", "路线"));
    }

    private static boolean hasCampusGuideStructure(String normalized) {
        return containsAny(normalized, "给我做个校园导览", "校园导览", "校园游览", "带我逛逛", "我想参观校园")
                && !containsAny(normalized, "导览介绍", "导览讲解");
    }

    private static boolean hasMixedIntroNavigateStructure(String normalized, List<SpotEntity> spots) {
        return spots.size() >= 2
                && containsAny(normalized, "然后带我去", "然后去", "再去", "带我去")
                && containsAny(normalized, "介绍", "讲解");
    }

    private static boolean isBareSpotQuestion(String normalized, SpotEntity spot) {
        String name = normalize(spot.resolvedSpotName());
        String raw = normalize(spot.rawText());
        return normalized.equals(name)
                || normalized.equals(raw)
                || (!containsAny(normalized, "介绍", "讲解", "开放时间", "怎么去", "导航", "路线", "推荐")
                && normalized.length() <= Math.max(name.length(), raw.length()) + 2);
    }

    private static boolean isGreeting(String normalized) {
        return List.of("你好", "您好", "hi", "hello", "嗨", "在吗", "小海你好").contains(normalized);
    }

    private static String extractAudience(String normalized) {
        if (containsAny(normalized, "新生", "入学", "报到")) return "新生";
        if (containsAny(normalized, "校友", "返校")) return "校友";
        if (containsAny(normalized, "家长", "父母")) return "家长";
        if (containsAny(normalized, "研学", "科研", "学术")) return "研学访客";
        if (containsAny(normalized, "长者", "老人", "老年")) return "长者";
        return null;
    }

    private static Integer extractNarrationSeconds(String text) {
        Matcher matcher = SECOND_PATTERN.matcher(text == null ? "" : text);
        if (matcher.find()) return Integer.parseInt(matcher.group(1));
        return null;
    }

    private static Integer extractDurationMinute(String text) {
        String normalized = normalize(text);
        if (normalized.contains("半小时")) return 30;
        if (normalized.contains("一小时") || normalized.contains("1小时") || normalized.contains("一个小时")) return 60;
        if (normalized.contains("两小时") || normalized.contains("二小时") || normalized.contains("2小时")) return 120;
        Matcher minuteMatcher = MINUTE_PATTERN.matcher(text == null ? "" : text);
        if (minuteMatcher.find()) return Integer.parseInt(minuteMatcher.group(1));
        Matcher hourMatcher = HOUR_PATTERN.matcher(text == null ? "" : text);
        if (hourMatcher.find()) return Integer.parseInt(hourMatcher.group(1)) * 60;
        return null;
    }

    private static boolean containsAny(String normalized, String... keywords) {
        for (String keyword : keywords) {
            if (normalized.contains(normalize(keyword))) return true;
        }
        return false;
    }
}
