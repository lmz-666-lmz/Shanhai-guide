<p align="center">
  <img src="https://img.shields.io/badge/version-1.0-blue?style=flat-square" alt="Version 1.0">
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License MIT">
  <img src="https://img.shields.io/badge/React-19.2-brightgreen?style=flat-square&logo=react" alt="React 19">
  <img src="https://img.shields.io/badge/Spring_Boot-3.5-brightgreen?style=flat-square&logo=springboot" alt="Spring Boot 3.5">
  <img src="https://img.shields.io/badge/MySQL-8.0+-4479A1?style=flat-square&logo=mysql" alt="MySQL 8.0+">
  <img src="https://img.shields.io/badge/DeepSeek-AI-536DFE?style=flat-square" alt="DeepSeek AI">
</p>

<h1 align="center">🏔️ 山海小导 — Shanhai Guide</h1>

<p align="center">
  <strong>高校文化景区与校友返校 AI 数字人导览平台</strong>
  <br>
  基于 React 19 + Spring Boot 3 + MySQL 8 + DeepSeek AI 的全栈项目
</p>

---

## 📑 目录

- [快速开始](#-快速开始)
- [系统概述](#-系统概述)
- [分层架构](#-系统分层架构)
- [业务模块](#-业务模块)
- [核心特性](#-核心特性)
- [技术栈](#-技术栈)
- [项目结构](#-项目结构)
- [部署说明](#-部署说明)
- [安全提示](#-安全提示)
- [版本历史](#-版本历史)

---

## 🚀 快速开始

### 环境要求

| 工具 | 版本 |
|------|------|
| Java | 21+ |
| Node.js | 18+（推荐 22+） |
| MySQL | 8.0+ |

### 1. 克隆项目

```bash
git clone https://github.com/your-username/Shanhai-guide.git
cd Shanhai-guide
```

### 2. 配置环境变量

后端通过环境变量注入敏感配置，无需 `.env` 文件：

```bash
# 数据库密码（必填）
export MYSQL_PASSWORD=your-db-password

# DeepSeek API Key（必填，否则 AI 对话不可用）
export DEEPSEEK_API_KEY=your-deepseek-api-key
```

`application.yaml` 关键配置说明：

```yaml
# 数据库连接（MySQL）
spring.datasource.url: jdbc:mysql://localhost:3306/shanhai_guide?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai
spring.datasource.username: root
spring.datasource.password: ${MYSQL_PASSWORD:123456}   # 通过环境变量注入

# DeepSeek AI 配置
deepseek.base-url: https://api.deepseek.com
deepseek.model: deepseek-chat
deepseek.api-key: ${DEEPSEEK_API_KEY:}                  # 通过环境变量注入

# JPA 自动建表（首次启动无需手动建库）
spring.jpa.hibernate.ddl-auto: update
```

### 3. 启动后端

```bash
cd backend

# Linux / macOS
./mvnw spring-boot:run

# Windows
mvnw.cmd spring-boot:run
```

后端默认运行在 http://localhost:8080，首次启动自动建表并写入初始种子数据。

### 4. 启动前端

```bash
cd frontend
npm install
npm run dev
```

前端默认运行在 http://localhost:5173。

### 5. 访问地址

| 端 | 地址 | 说明 |
|:---|:---|:---|
| 游客端 | http://localhost:5173 | AI 导览对话、校园地图、推荐路线 |
| 后台管理 | http://localhost:5173/#/admin/dashboard | 数据大屏、知识库、点位/路线管理 |

---

## 📖 系统概述

山海小导是一款面向高校文化景区的 AI 数字人导览平台，服务校友返校、新生家长参观、日常访客游览等场景。平台深度集成 DeepSeek 大语言模型，以 2D AI 数字人导览员为交互入口，提供校园点位讲解、智能路线推荐、AI 自由问答等核心能力。

**MVP 核心能力**：AI 导览对话（多用户模式） + 2D 数字人语音朗读 + 校园地图点位浏览 + 智能路线推荐 + 后台数据大屏与内容管理。

---

## 🏗 系统分层架构

### 前端应用层 (Client Layer)

| 技术 | 用途 |
|------|------|
| React 19 | 核心框架，函数组件 + Hooks |
| TypeScript 6.0 | 类型安全 |
| Vite 8 | 极速本地冷启动与 HMR 热更新 |
| CSS Modules | 组件级样式隔离 |
| 自定义主题变量 | 统一的校园品牌视觉风格 |

### 后端服务层 (Service Layer)

| 技术 | 用途 |
|------|------|
| Spring Boot 3.5 | 核心框架，自动配置与起步依赖 |
| Spring Data JPA | ORM 数据库抽象层 |
| Spring Validation | 请求参数校验 |
| MySQL Connector J | 数据库驱动 |
| DeepSeek API | AI 大模型对话与推理 |

### 数据与基础设施层 (Infrastructure Layer)

- **数据库**：MySQL 8.0+，`utf8mb4` 字符集，JPA `ddl-auto: update` 自动建表
- **AI 大模型**：DeepSeek API，通过环境变量注入 Key，支持热切换模型
- **种子数据**：应用启动时通过 `*Initializer` 自动写入校园点位、路线、知识库等初始数据

---

## 📦 业务模块

| 领域模块 | 前端 | 后端 Controller | 核心职责 |
|:---|:---|:---|:---|
| **AI 导览对话** | `VisitorApp`, `TwoDDigitalHuman` | `ChatController` | 多用户模式感知的 AI 问答、会话记录 |
| **2D 数字人** | `TwoDDigitalHuman` 组件 | `DigitalHumanController` | 2D 形象展示、语音朗读开关、形象配置 |
| **校园地图** | `VisitorApp`（地图视图） | `CampusSpotController` | 按分类浏览校园点位与讲解词 |
| **推荐路线** | `VisitorApp`（路线视图）| `CampusRouteController` | 智能路线推荐 + 全部路线浏览 |
| **知识库** | `AdminKnowledgePage` | `KnowledgeController` | 知识文档与知识片段管理，为 AI 提供领域知识 |
| **活动公告** | `VisitorApp`（个人中心）| `ActivityNoticeController` | 校友活动公告查看 |
| **数据大屏** | `AdminDashboardPage` | `DashboardController`, `ReportController` | 问答统计、热门问题、趋势分析、游客感受度报告 |
| **后台管理** | `AdminLayout` + 6 个管理页 | 6 个 `Admin*Controller` | 点位 CRUD、路线编排、公告管理、知识库管理、数字人配置 |

---

## ✨ 核心特性

### 🤖 AI 导览对话
- **多用户模式感知**：自动识别校友、新生家长、普通访客等身份，切换不同的回答风格与内容深度
- **知识库驱动**：基于后台可维护的知识文档与片段，确保回答准确、贴合校情
- **会话记录**：保存对话历史，支持回溯与统计

### 🎭 2D AI 数字人导览员
- 页面内嵌 2D 数字人形象，增强交互临场感
- 支持语音朗读开关，适配静音与公放场景
- 后台可配置数字人形象参数，实时预览生效

### 🗺 校园地图与点位讲解
- 按分类（教学楼、食堂、宿舍、景点等）浏览校园点位
- 每个点位绑定详细讲解词，支持图文展示
- 后台支持点位启用/禁用，灵活控制展示内容

### 🛤 智能路线推荐
- 基于用户身份（校友/新生家长/访客）智能推荐参观路线
- 路线支持途经点位编排，后台可灵活调整
- 全部路线浏览，满足自主选择需求

### 📊 数据大屏
- 问答总量、热门问题 TOP-N、日/周趋势分析
- 游客感受度报告，量化访客体验
- 游客身份分布统计，辅助运营决策

### 🛠 后台内容管理
- **知识库管理**：知识文档 CRUD + 知识片段维护
- **点位管理**：校园点位增删改查 + 启用/禁用开关
- **路线管理**：参观路线编排 + 途经点位排序
- **活动公告**：校友活动发布与管理
- **数字人配置**：形象参数调整 + 实时预览

---

## 🛠 技术栈

| 层级 | 技术 | 版本 |
|:---|:---|:---|
| 前端框架 | React | 19.2 |
| 类型系统 | TypeScript | 6.0 |
| 构建工具 | Vite | 8.1 |
| 代码检查 | Oxlint | 1.71 |
| 后端框架 | Spring Boot | 3.5 |
| 语言 | Java | 21 |
| ORM | Spring Data JPA (Hibernate) | — |
| 参数校验 | Spring Validation | — |
| 数据库 | MySQL | 8.0+ |
| AI 模型 | DeepSeek API | 可配置 |
| 构建工具 | Maven Wrapper | — |

---

## 📁 项目结构

```
Shanhai-guide/
├── backend/                                # Spring Boot 后端
│   └── src/main/java/.../shanhai/
│       ├── config/                         # 配置类（CORS、种子数据初始化器）
│       │   ├── ActivityNoticeInitializer.java   # 活动公告种子数据
│       │   ├── CampusSpotInitializer.java       # 校园点位种子数据
│       │   ├── CorsConfig.java                  # 跨域配置
│       │   ├── DeepSeekProperties.java          # DeepSeek 配置绑定
│       │   ├── DigitalHumanConfigInitializer.java # 数字人默认配置
│       │   ├── KnowledgeInitializer.java        # 知识库种子数据
│       │   └── RouteInitializer.java            # 路线种子数据
│       ├── controller/                     # REST 控制器 (13 个)
│       │   ├── ChatController.java              # AI 对话
│       │   ├── CampusSpotController.java        # 校园点位（游客端）
│       │   ├── CampusRouteController.java       # 参观路线（游客端）
│       │   ├── ActivityNoticeController.java    # 活动公告（游客端）
│       │   ├── KnowledgeController.java         # 知识库（游客端）
│       │   ├── DigitalHumanController.java      # 数字人配置
│       │   ├── DashboardController.java         # 数据大屏
│       │   ├── ReportController.java            # 统计报告
│       │   ├── HealthController.java            # 健康检查
│       │   ├── AdminCampusSpotController.java   # 后台-点位管理
│       │   ├── AdminCampusRouteController.java  # 后台-路线管理
│       │   ├── AdminKnowledgeController.java    # 后台-知识库管理
│       │   └── AdminActivityNoticeController.java # 后台-公告管理
│       ├── dto/                            # 数据传输对象 (21 个)
│       ├── entity/                         # JPA 实体 (8 个)
│       │   ├── CampusSpot.java                  # 校园点位
│       │   ├── CampusRoute.java                 # 参观路线
│       │   ├── RouteSpot.java                   # 路线-点位关联
│       │   ├── ActivityNotice.java              # 活动公告
│       │   ├── KnowledgeDoc.java                # 知识文档
│       │   ├── KnowledgeChunk.java              # 知识片段
│       │   ├── ChatRecord.java                  # 对话记录
│       │   └── DigitalHumanConfig.java          # 数字人配置
│       └── repository/                     # JPA 仓库接口 (8 个)
│   └── src/main/resources/
│       └── application.yaml               # 应用配置
├── frontend/                               # React 前端
│   └── src/
│       ├── admin/                          # 后台管理页面 (6 个)
│       │   ├── AdminLayout.tsx                  # 后台布局框架
│       │   ├── AdminDashboardPage.tsx           # 数据大屏
│       │   ├── AdminSpotPage.tsx                # 点位管理
│       │   ├── AdminRoutePage.tsx               # 路线管理
│       │   ├── AdminKnowledgePage.tsx           # 知识库管理
│       │   ├── AdminNoticePage.tsx              # 活动公告管理
│       │   └── AdminDigitalHumanPage.tsx        # 数字人配置
│       ├── mobile/                         # 游客端页面
│       │   └── VisitorApp.tsx                   # 游客端主应用
│       ├── components/                     # 公共组件
│       │   └── TwoDDigitalHuman.tsx             # 2D AI 数字人组件
│       ├── api/                            # API 调用层 (10 个模块)
│       │   ├── http.ts                         # Axios 实例配置
│       │   ├── chatApi.ts                      # 对话接口
│       │   ├── spotApi.ts                      # 点位接口
│       │   ├── routeApi.ts                     # 路线接口
│       │   └── admin*.ts                       # 后台管理接口
│       └── styles/                         # 主题样式
│           └── theme.css                       # CSS 变量与主题
├── data/                                   # 数据目录（保留）
├── deploy/                                 # 部署配置目录（预留）
├── docs/                                   # 文档
│   └── 校园点位讲解词.md                     # 点位讲解词参考文档
└── README.md
```

---

## 🚢 部署说明

### 本地开发环境

1. 安装 Java 21+、Node.js 18+、MySQL 8.0+
2. 创建 MySQL 数据库 `shanhai_guide`（或让 JPA 自动建库）
3. 设置环境变量 `MYSQL_PASSWORD` 和 `DEEPSEEK_API_KEY`
4. 依次启动后端和前端

### 生产环境部署

1. 服务器安装 Java 21+、Node.js 18+、MySQL 8.0+、Nginx
2. 克隆项目到服务器
3. 配置生产环境变量（数据库密码、DeepSeek API Key）
4. 后端打包：`cd backend && ./mvnw package -DskipTests`
5. 启动后端：`java -jar target/backend-0.0.1-SNAPSHOT.jar`
6. 构建前端：`cd frontend && npm run build`
7. 配置 Nginx 反向代理，将 API 请求转发到后端 8080 端口，静态资源指向 `frontend/dist/`

### 环境变量清单

| 变量名 | 必填 | 说明 |
|:---|:---|:---|
| `MYSQL_PASSWORD` | 是 | MySQL 数据库密码 |
| `DEEPSEEK_API_KEY` | 是 | DeepSeek API Key（缺失时 AI 对话不可用） |

---

## 🔒 安全提示

```text
⚠️  DeepSeek API Key 通过环境变量注入，严禁硬编码在配置文件中
⚠️  MySQL 密码通过环境变量注入，application.yaml 中的默认值仅用于本地开发
⚠️  生产环境务必修改 application.yaml 中的数据库默认密码占位符
⚠️  CORS 当前允许 localhost:* 来源，生产环境需限制为正式域名
⚠️  MVP 阶段后台管理接口未接入统一身份认证，后续需补充登录鉴权
⚠️  定期更新依赖，关注 Spring Boot 与 React 安全公告
```

### 数据安全

- 数据库密码通过环境变量 `MYSQL_PASSWORD` 注入，源码中仅保留本地开发默认占位值
- JPA Entity 字段使用 `@Column` 约束，防止非法数据入库
- 请求参数通过 Spring Validation 校验，后端双重保障

### AI 调用安全

- DeepSeek API Key 仅通过环境变量注入，源码中无硬编码
- AI 接口异常时后端返回友好错误提示，前端展示降级 UI
- 对话记录持久化存储，支持审计回溯

---

## 📄 版本历史

| 版本 | 日期 | 核心变更 |
|:---|:---|:---|
| **V1.0** | 2025-07 | MVP 首发版：AI 导览对话（多用户模式）+ 2D 数字人语音朗读 + 校园地图点位浏览 + 智能路线推荐 + 数据大屏 + 后台内容管理（点位/路线/知识库/公告/数字人配置）+ 种子数据自动初始化 |

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

---

## 📝 开源协议

本项目基于 MIT 协议开源。详见 [LICENSE](LICENSE) 文件。

---

<p align="center">
  <sub>Made with ❤️ for campus culture and alumni connections 🏔️</sub>
</p>
