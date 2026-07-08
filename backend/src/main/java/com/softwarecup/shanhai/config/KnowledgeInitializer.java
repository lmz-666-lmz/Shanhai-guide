package com.softwarecup.shanhai.config;

import com.softwarecup.shanhai.entity.KnowledgeChunk;
import com.softwarecup.shanhai.entity.KnowledgeDoc;
import com.softwarecup.shanhai.repository.KnowledgeChunkRepository;
import com.softwarecup.shanhai.repository.KnowledgeDocRepository;
import jakarta.transaction.Transactional;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@Order(3)
public class KnowledgeInitializer implements CommandLineRunner {

    private final KnowledgeDocRepository knowledgeDocRepository;
    private final KnowledgeChunkRepository knowledgeChunkRepository;

    public KnowledgeInitializer(
            KnowledgeDocRepository knowledgeDocRepository,
            KnowledgeChunkRepository knowledgeChunkRepository
    ) {
        this.knowledgeDocRepository = knowledgeDocRepository;
        this.knowledgeChunkRepository = knowledgeChunkRepository;
    }

    @Override
    @Transactional
    public void run(String... args) {
        if (knowledgeDocRepository.count() > 0) {
            return;
        }

        for (InitialKnowledge item : initialKnowledgeList()) {
            KnowledgeDoc doc = createDoc(item);
            KnowledgeDoc savedDoc = knowledgeDocRepository.save(doc);

            KnowledgeChunk chunk = createChunk(savedDoc.getId(), item);
            knowledgeChunkRepository.save(chunk);
        }
    }

    private List<InitialKnowledge> initialKnowledgeList() {
        return List.of(
                new InitialKnowledge(
                        "山海大学概况",
                        "校史资料",
                        "山海大学基础资料",
                        "山海大学,概况,工科,校园文化",
                        "山海大学是一所以工科见长、融合信息技术、智能制造、材料科学和校园文化传播的虚拟高校。校园面向校友返校、新生参观、家长走访和社会访客开放，重点展示校史文化、学习空间、学院特色和校友服务。"
                ),
                new InitialKnowledge(
                        "山海校史馆介绍",
                        "点位介绍",
                        "山海校史馆介绍",
                        "校史馆,校史,优秀校友,科研成果",
                        "山海校史馆集中展示学校的发展历程、重要科研成果和优秀校友故事，是了解山海大学精神传承和办学特色的重要窗口。校友返校和访客参观时，校史馆通常是最值得停留的文化点位之一。"
                ),
                new InitialKnowledge(
                        "星海图书馆介绍",
                        "点位介绍",
                        "星海图书馆介绍",
                        "图书馆,学习,校友记忆,文化",
                        "星海图书馆是校园学习文化中心，承载着学生阅读、备考、论文写作和学术交流的记忆。对于校友而言，图书馆常常代表着青春奋斗和校园生活的重要片段。"
                ),
                new InitialKnowledge(
                        "校友之家介绍",
                        "点位介绍",
                        "校友之家介绍",
                        "校友之家,校友,活动,返校",
                        "校友之家面向校友返校、交流和活动接待，是学校联系校友的重要空间。校友可在这里了解母校发展、参加返校活动，也可以与师生和其他校友交流。"
                ),
                new InitialKnowledge(
                        "第一食堂介绍",
                        "生活服务",
                        "第一食堂介绍",
                        "食堂,餐饮,生活服务,校友记忆",
                        "第一食堂是校园主要餐饮点之一，为学生、教职工和访客提供餐饮服务。对返校校友来说，食堂的味道和热闹氛围往往能唤起学生时代的记忆。"
                ),
                new InitialKnowledge(
                        "校友记忆路线",
                        "路线资料",
                        "校友记忆路线库",
                        "校友路线,90分钟,母校变化,返校",
                        "校友记忆路线适合返校校友重温校园记忆并了解学校新变化，推荐顺序为山海大学南门、知行主楼、星海图书馆、山海校史馆、海韵湖、校友之家，预计用时约90分钟。"
                ),
                new InitialKnowledge(
                        "新生初识路线",
                        "路线资料",
                        "新生参观路线库",
                        "新生路线,60分钟,校园生活",
                        "新生初识路线帮助新生快速认识校园主要学习和生活空间，推荐顺序为山海大学南门、知行主楼、星海图书馆、智能信息学院、第一食堂，预计用时约60分钟。"
                ),
                new InitialKnowledge(
                        "校友活动公告",
                        "活动公告",
                        "校友活动公告",
                        "校友活动,创新创业,讲座,活动",
                        "本周六15:00，校友之家将举办校友创新创业分享会，面向返校校友、在校学生和教师开放。活动内容包括校友创业经历分享、行业交流和校园发展介绍。"
                )
        );
    }

    private KnowledgeDoc createDoc(InitialKnowledge item) {
        KnowledgeDoc doc = new KnowledgeDoc();
        doc.setTitle(item.title());
        doc.setCategory(item.category());
        doc.setSourceName(item.sourceName());
        doc.setContent(item.content());
        doc.setEnabled(true);
        return doc;
    }

    private KnowledgeChunk createChunk(Long docId, InitialKnowledge item) {
        KnowledgeChunk chunk = new KnowledgeChunk();
        chunk.setDocId(docId);
        chunk.setTitle(item.title());
        chunk.setCategory(item.category());
        chunk.setSourceName(item.sourceName());
        chunk.setContent(item.content());
        chunk.setKeywords(item.keywords());
        chunk.setEnabled(true);
        return chunk;
    }

    private record InitialKnowledge(
            String title,
            String category,
            String sourceName,
            String keywords,
            String content
    ) {
    }
}
