package com.softwarecup.shanhai.service;

import com.softwarecup.shanhai.dto.ChatRequest;
import com.softwarecup.shanhai.dto.ChatResponse;
import com.softwarecup.shanhai.entity.ChatRecord;
import com.softwarecup.shanhai.entity.KnowledgeChunk;
import com.softwarecup.shanhai.repository.ChatRecordRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Locale;
import java.util.Optional;

@Service
public class ChatService {

    private static final Logger log = LoggerFactory.getLogger(ChatService.class);

    private static final String DEFAULT_MODE = "校友模式";

    private static final String SYSTEM_PROMPT = """
            你是“山海大学”的校园 AI 数字人导览员“小海”，面向校友、新生家长、访客提供高校文化景区导览服务。

            必须遵守：
            1. 不要说自己是普通聊天机器人；
            2. 回答要围绕校园文化、校史、点位讲解、参观路线、服务设施；
            3. 校友模式要温暖、有情感，强调母校记忆和学校变化；
            4. 新生模式要简洁实用；
            5. 家长模式要强调办学实力和校园环境；
            6. 访客模式要偏文旅讲解；
            7. 研学模式要强调知识点、科研成果和学科特色；
            8. 如果用户问和校园导览无关的问题，要温和地引导回校园导览场景；
            9. 回答不要太长，控制在 300 字以内；
            10. 输出中文。

            知识库要求：
            1. 回答时必须优先依据下面提供的校园知识库资料；
            2. 如果知识库资料中没有明确答案，不要编造具体事实，可以给出合理导览建议，并说明“根据当前资料”；
            3. 回答后不需要在正文里重复列出来源，sources 字段会单独返回给前端；
            4. 回答控制在 300 字以内，中文输出。
            """;

    private final DeepSeekService deepSeekService;
    private final ChatRecordRepository chatRecordRepository;
    private final KnowledgeBaseService knowledgeBaseService;

    public ChatService(
            DeepSeekService deepSeekService,
            ChatRecordRepository chatRecordRepository,
            KnowledgeBaseService knowledgeBaseService
    ) {
        this.deepSeekService = deepSeekService;
        this.chatRecordRepository = chatRecordRepository;
        this.knowledgeBaseService = knowledgeBaseService;
    }

    public ChatResponse chat(ChatRequest request) {
        List<KnowledgeChunk> chunks = searchKnowledgeChunks(request);
        String knowledgeContext = buildKnowledgeContext(chunks);
        List<String> sources = extractSources(chunks);

        Optional<String> aiAnswer = deepSeekService.chat(SYSTEM_PROMPT, buildUserPrompt(request, knowledgeContext));
        boolean success = aiAnswer.isPresent();
        String answer = aiAnswer.orElseGet(() -> fallbackAnswer(request, chunks));

        ChatResponse response = new ChatResponse(
                answer,
                sources,
                determineEmotion(request, success),
                buildSuggestedActions(request, chunks)
        );

        saveChatRecord(request, response, success);
        return response;
    }

    private void saveChatRecord(ChatRequest request, ChatResponse response, boolean success) {
        try {
            ChatRecord chatRecord = new ChatRecord();
            chatRecord.setUserMessage(request.message());
            chatRecord.setAiAnswer(response.answer());
            chatRecord.setUserMode(request.userMode());
            chatRecord.setCurrentSpotId(request.currentSpotId());
            chatRecord.setSources(String.join(",", response.sources()));
            chatRecord.setEmotion(response.emotion());
            chatRecord.setSuccess(success);

            chatRecordRepository.save(chatRecord);
        } catch (RuntimeException ex) {
            log.warn("Failed to save chat record: {}", ex.getMessage());
        }
    }

    private List<KnowledgeChunk> searchKnowledgeChunks(ChatRequest request) {
        try {
            return knowledgeBaseService.searchRelevantChunks(request.message(), request.currentSpotId());
        } catch (RuntimeException ex) {
            log.warn("Knowledge base search failed: {}", ex.getMessage());
            return List.of();
        }
    }

    private String buildKnowledgeContext(List<KnowledgeChunk> chunks) {
        try {
            return knowledgeBaseService.buildKnowledgeContext(chunks);
        } catch (RuntimeException ex) {
            log.warn("Knowledge context build failed: {}", ex.getMessage());
            return "";
        }
    }

    private List<String> extractSources(List<KnowledgeChunk> chunks) {
        try {
            List<String> sources = knowledgeBaseService.extractSourceNames(chunks);
            return sources.isEmpty() ? List.of("山海大学基础知识库") : sources;
        } catch (RuntimeException ex) {
            log.warn("Knowledge source extraction failed: {}", ex.getMessage());
            return List.of("山海大学基础知识库");
        }
    }

    private String buildUserPrompt(ChatRequest request, String knowledgeContext) {
        String mode = getUserMode(request);
        String spotContext = request.currentSpotId() == null
                ? "当前未指定具体点位"
                : "当前点位 ID：" + request.currentSpotId();
        String ragContext = StringUtils.hasText(knowledgeContext)
                ? knowledgeContext
                : "当前没有检索到明确匹配资料。请基于导览场景给出保守建议，并使用“根据当前资料”表述不确定内容。";

        return """
                用户模式：%s
                %s
                校园知识库资料：
                %s
                用户问题：%s
                请以“小海”的身份回答。
                """.formatted(mode, spotContext, ragContext, request.message());
    }

    private String fallbackAnswer(ChatRequest request, List<KnowledgeChunk> chunks) {
        String mode = getUserMode(request);
        if (chunks != null && !chunks.isEmpty()) {
            KnowledgeChunk firstChunk = chunks.get(0);
            return "根据当前资料，我能确认的是：" + summarize(firstChunk.getContent())
                    + "你也可以继续问我这个点位的故事、开放信息或适合" + mode + "的参观路线。";
        }

        return "你好，我是山海大学校园 AI 数字人导览员小海。当前智能讲解服务暂时繁忙，"
                + "我先为你推荐“校友记忆路线”：南门、知行主楼、星海图书馆、山海校史馆、海韵湖、校友之家。"
                + "这条路线适合" + mode + "重温校园文化与学校新变化，也可以继续问我某个点位的故事。";
    }

    private String summarize(String content) {
        if (!StringUtils.hasText(content)) {
            return "知识库中已有相关校园资料，但内容摘要暂不可用。";
        }

        String trimmed = content.trim();
        if (trimmed.length() <= 180) {
            return trimmed;
        }

        return trimmed.substring(0, 180) + "……";
    }

    private String getUserMode(ChatRequest request) {
        return StringUtils.hasText(request.userMode()) ? request.userMode() : DEFAULT_MODE;
    }

    private String determineEmotion(ChatRequest request, boolean success) {
        if (!success) {
            return "fallback";
        }
        String message = defaultText(request.message());
        if (containsAny(message, "活动", "公告", "路线", "参观", "导览")) {
            return "guide";
        }
        if (containsAny(message, "校史", "文化", "故事", "记忆")) {
            return "thoughtful";
        }
        if (containsAny(message, "食堂", "吃", "餐饮", "服务")) {
            return "friendly";
        }
        return "friendly";
    }

    private List<String> buildSuggestedActions(ChatRequest request, List<KnowledgeChunk> chunks) {
        String message = defaultText(request.message());
        String mode = defaultText(request.userMode());
        String categories = chunks == null ? "" : chunks.stream()
                .map(KnowledgeChunk::getCategory)
                .filter(StringUtils::hasText)
                .reduce("", (left, right) -> left + " " + right);
        String text = message + " " + mode + " " + categories;

        if (containsAny(text, "活动", "公告", "本周", "周五", "周日", "校友活动")) {
            return List.of("查看最新公告", "了解校友之家", "推荐校友路线");
        }
        if (containsAny(text, "吃", "食堂", "餐饮")) {
            return List.of("打开第一食堂", "推荐生活服务点位", "规划轻松路线");
        }
        if (containsAny(text, "路线", "参观", "90分钟", "60分钟", "校友", "新生", "家长")) {
            return List.of("查看推荐路线", "打开校园地图", "讲解校友记忆路线");
        }
        if (containsAny(text, "校史馆", "图书馆", "食堂", "校友之家", "南门", "点位")) {
            return List.of("打开校园地图", "讲解附近点位", "推荐参观路线");
        }
        return List.of("推荐参观路线", "打开校园地图", "查看最新公告");
    }

    private boolean containsAny(String value, String... keywords) {
        if (!StringUtils.hasText(value)) {
            return false;
        }
        String text = value.toLowerCase(Locale.ROOT);
        for (String keyword : keywords) {
            if (text.contains(keyword.toLowerCase(Locale.ROOT))) {
                return true;
            }
        }
        return false;
    }

    private String defaultText(String value) {
        return value == null ? "" : value;
    }
}
