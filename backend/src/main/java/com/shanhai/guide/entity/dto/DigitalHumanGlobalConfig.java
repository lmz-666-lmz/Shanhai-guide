package com.shanhai.guide.entity.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Data
public class DigitalHumanGlobalConfig {

    private String name = "小海";

    private String digitalHumanName = "小海";

    private String avatar = "";

    private String avatarTheme = "山海蓝";

    private String style = "校园讲解员";

    private String voiceType = "温柔女声";

    private BigDecimal speed = new BigDecimal("1.0");

    private BigDecimal speechSpeed = new BigDecimal("1.0");

    private BigDecimal volume = new BigDecimal("0.9");

    private BigDecimal pitch = new BigDecimal("1.0");

    private Boolean autoRead = false;

    private Boolean subtitleEnabled = true;

    private String welcomeText = "欢迎来到山海大学！我是你的校园 AI 导览员小海。";

    private String introduction = "能听懂游览时间与需求，基于可信校园知识讲解，并在地图中逐站陪伴导航。";

    private String guideStyle = "标准";

    private String defaultAnswerStyle = "标准";

    private Map<String, Boolean> capabilities = Map.ofEntries(
            Map.entry("aiChat", true),
            Map.entry("knowledgeNarration", true),
            Map.entry("pointNarration", true),
            Map.entry("routePlanning", true),
            Map.entry("mapCompanion", true),
            Map.entry("autoArrivalNarration", true),
            Map.entry("voiceInput", true),
            Map.entry("voiceRead", true),
            Map.entry("navigationVoice", true),
            Map.entry("routeAnimation", true),
            Map.entry("subtitles", true),
            Map.entry("seniorMode", true),
            Map.entry("highContrast", true),
            Map.entry("largeText", true),
            Map.entry("userPersonalization", true),
            Map.entry("cocreateRecommendation", true)
    );

    private List<String> quickQuestions = List.of(
            "45 分钟怎么游览山海大学？",
            "帮我生成一条校园文化路线",
            "新生第一次来该怎么玩？",
            "推荐一条适合校友的怀旧路线",
            "山海大学有哪些值得参观的地方？"
    );

    private Map<String, String> welcomeTextsByMode = Map.of(
            "fresh", "欢迎来到山海大学，我会重点介绍学习生活与新生服务。",
            "alumni", "欢迎回到山海大学，让我们沿着校史与校园变化重温旧时光。",
            "parent", "欢迎来到山海大学，我会重点介绍学习环境、生活安全和服务设施。",
            "research", "欢迎来到山海大学，我会重点介绍学术资源、历史和专业特色。",
            "senior", "欢迎来到山海大学，我会用更简洁、清晰的方式陪您游览。"
    );

    private Map<String, Object> navigationSettings = Map.of(
            "promptFrequency", "standard",
            "arrivalDetection", "manual",
            "autoNarration", false,
            "showRouteAnimation", true,
            "allowSkipStation", true,
            "allowReplan", true
    );

    private Map<String, Object> narrationSettings = Map.of(
            "defaultMode", "concise",
            "showSources", true,
            "autoArrivalPrompt", true
    );

    private Map<String, Object> accessibilitySettings = Map.of(
            "highContrast", false,
            "largeText", false,
            "seniorMode", false
    );

    private Map<String, String> fallbackMessages = Map.of(
            "arrival", "已到达{spotName}，需要我讲解这里吗？",
            "navigationComplete", "本次山海大学游览已完成，感谢一路同行。",
            "error", "小海暂时没有理解，可以换一种说法或查看校园点位。",
            "noKnowledge", "当前回答暂未检索到明确的知识库依据，请以学校实际发布信息为准。",
            "disclaimer", "校园信息可能随运营安排调整，请以学校实际安排为准。",
            "blockedTopics", "个人隐私,违法危险行为,与校园导览无关的敏感信息"
    );

    private List<String> userAdjustableFields = List.of(
            "avatarTheme", "voiceType", "speechSpeed", "volume", "pitch", "autoRead", "subtitleEnabled",
            "answerStyle", "autoNarration", "navigationAssistantExpanded", "routeAnimationEnabled",
            "highContrast", "largeText", "seniorMode", "navigationPromptFrequency", "quickQuestionPreference"
    );
}
