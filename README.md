# 山海小导 — 高校 AI 数字人导览平台

> 基于 Spring Boot + React 的高校智慧校园导览系统。AI 数字人、校园地图、知识库问答、路线推荐和后台运营管理相结合，为新生、校友、家长和访客提供一站式校园导览服务。
>
> **当前稳定版本：2.1**

---

## 项目定位

面向**高校文化景区导览、校友返校、新生入校、家长参观、研学访客**等场景。

本项目以 **"山海大学"** 为虚拟演示场景。系统架构具备通用性，可迁移至博物馆园区、科技馆、历史街区和文旅景区。

---

## 核心功能

### 用户端

- 校园地图导览 — 高德地图点位展示，按类型筛选
- AI 数字人问答 — DeepSeek 驱动的智能对话，支持知识库 RAG
- 校园路线 — 官方路线推荐 + AI 个性化路线规划
- 单点导航 / 多站路线导航 — GPS、演示和手动三种起点模式
- 点位自动讲解 — 到站/沿途自动触发，行程级去重
- 数字人配置 — 四个中文音色、语速、自动朗读等个性化设置
- 活动浏览与预约
- 打卡、收藏、徽章成就
- 用户反馈、投稿
- 历史行程查看

### 管理端

- 用户管理（注册用户、会话、身份模式）
- 点位管理（名称、类型、坐标、资料、图片）
- 路线管理（点位顺序、适用身份、时长）
- 活动管理
- 数字人全局配置（音色、能力开关、欢迎语）
- 知识库管理
- 投稿审核
- 反馈管理
- 运营总览（热门点位、热门路线、服务统计）

---

## 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Java 17, Spring Boot 3.5.15, MyBatis-Plus 3.5.5, MySQL 8.0 |
| 用户端 | React 18, TypeScript, Vite 6, antd-mobile 5, Tailwind CSS 3 |
| 管理端 | React 18, TypeScript, Vite 5, Ant Design 5 |
| AI | DeepSeek API (deepseek-chat) |
| 地图 | 高德地图 JS API |
| 语音 | Web Speech API (SpeechSynthesis) |

---

## 目录结构

```
Shanhai_Guide/
├── backend/                     # Spring Boot 后端
│   ├── pom.xml
│   └── src/
│       ├── main/java/com/shanhai/guide/
│       │   ├── controller/      # REST 控制器
│       │   ├── service/         # 服务接口与实现
│       │   ├── mapper/          # MyBatis-Plus Mapper
│       │   ├── entity/          # 实体类与 DTO
│       │   ├── config/          # Spring 配置
│       │   ├── common/          # 通用类（ApiResponse 等）
│       │   └── exception/       # 业务异常
│       ├── main/resources/
│       │   ├── application.yml          # 本地配置（含密钥，不提交）
│       │   ├── application-example.yml  # 配置模板
│       │   └── static/                  # 编译后静态资源
│       └── test/                # 测试代码
├── frontend/                    # 用户端 (React 18 + Vite + antd-mobile)
│   ├── package.json
│   ├── index.html
│   ├── public/
│   └── src/
│       ├── api/                 # API 客户端
│       ├── assets/              # 静态资源
│       ├── components/          # 通用组件 + chat/map 子组件
│       ├── contexts/            # React Context（DigitalHuman, Toast）
│       ├── hooks/               # 自定义 Hooks
│       ├── pages/               # 页面组件
│       ├── store/               # 状态管理
│       ├── types/               # TypeScript 类型定义
│       └── utils/               # 工具函数（地图、语音、导航等）
├── admin-frontend/              # 管理端 (React 18 + Vite + Ant Design 5)
│   ├── package.json
│   ├── index.html
│   └── src/
│       ├── api/                 # API 客户端
│       ├── components/          # 管理端组件
│       ├── pages/               # 管理页面
│       ├── styles/              # 样式
│       └── utils/               # 工具函数
├── deploy/                      # Docker 部署配置
│   ├── docker-compose.yml
│   ├── backend.Dockerfile
│   ├── frontend.Dockerfile
│   ├── admin-frontend.Dockerfile
│   ├── nginx-frontend.conf
│   └── nginx-admin.conf
├── uploads/                     # 用户上传文件（运行时，需写权限）
├── example.sql                  # 数据库完整导出（唯一 SQL 文件）
├── DELIVERY.md                  # 交付文档
├── README.md                    # 本文件
└── .gitignore
```

---

## 系统架构

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   frontend   │    │admin-frontend│    │   高德地图    │
│  用户移动端   │    │   管理后台    │    │  JS API      │
│  React 18    │    │  React 18    │    │  AMap Loader │
│  antd-mobile │    │  Ant Design 5│    └──────┬───────┘
└──────┬───────┘    └──────┬───────┘           │
       │  /api              │  /api             │
       └──────────┬─────────┘                   │
                  │                             │
          ┌───────▼───────┐             ┌───────▼───────┐
          │    backend     │             │   DeepSeek    │
          │  Spring Boot   │◄───────────►│   API (AI)    │
          │  3.5.15        │             └───────────────┘
          └───────┬───────┘
                  │
          ┌───────▼───────┐
          │    MySQL 8.0  │
          │  shanhai_guide│
          └───────────────┘
```

---

## 环境要求

- Java 17+
- Maven 3.6+
- Node.js 18+
- MySQL 8.0+
- DeepSeek API Key
- 高德地图 JS API Key（通过 AMap Loader 加载）

---

## 数据库初始化

项目唯一数据库文件为根目录的 `example.sql`（完整 mysqldump，包含全部表结构和种子数据）。

```bash
# 创建数据库
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS shanhai_guide CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 导入数据
mysql -u root -p shanhai_guide < example.sql
```

> **注意：** `example.sql` 包含 `DROP TABLE IF EXISTS` 语句，导入前请确认目标数据库没有需要保留的数据。

---

## 配置初始化

### 后端

```bash
# Windows PowerShell
Copy-Item backend\src\main\resources\application-example.yml backend\src\main\resources\application.yml

# 编辑 application.yml，填入真实值：
#   spring.datasource.username   — 你的 MySQL 用户名
#   spring.datasource.password   — 你的 MySQL 密码
#   ai.deepseek.api-key          — 你的 DeepSeek API Key
```

### 用户端

```bash
# Windows PowerShell
Copy-Item frontend\.env.example frontend\.env

# 编辑 .env，修改 API 地址（如需要）
```

### 管理端

```bash
# Windows PowerShell
Copy-Item admin-frontend\.env.example admin-frontend\.env

# 编辑 .env，修改 API 地址（如需要）
```

---

## 本地启动

```bash
# 1. 启动后端 (端口 8080)
cd backend
mvn spring-boot:run

# 2. 启动用户端 (端口 5173)
cd frontend
npm install
npm run dev

# 3. 启动管理端 (端口 5174)
cd admin-frontend
npm install
npm run dev
```

---

## 生产构建

```bash
cd frontend && npm run build
cd admin-frontend && npm run build
cd backend && mvn clean package -DskipTests
```

---

## 环境变量

| 变量名 | 用途 |
|---|---|
| `SPRING_DATASOURCE_URL` | 数据库 JDBC 地址 |
| `SPRING_DATASOURCE_USERNAME` | 数据库用户名 |
| `SPRING_DATASOURCE_PASSWORD` | 数据库密码 |
| `AI_DEEPSEEK_API_KEY` | DeepSeek API Key |
| `VITE_API_BASE_URL` | 前端 API 基础地址 |
| `MYSQL_ROOT_PASSWORD` | Docker MySQL root 密码 |
| `SHANHAI_DB_PASSWORD` | Docker 后端数据库密码 |

---

## 上传目录

- `uploads/` — 用户上传文件目录（运行时需要写权限）
- `backend/src/main/resources/static/` — 后端静态资源
- `backend/src/main/resources/data/` — 数据文件目录

部署时 `uploads/` 需要持久化挂载，其内容通过 `.gitignore` 排除（目录本身由 `.gitkeep` 保留）。

---

## 端口

| 服务 | 端口 |
|---|---|
| 后端 API | 8080 |
| 用户端 | 5173 |
| 管理端 | 5174 |
| MySQL | 3306 |

---

## 关键设计说明

### 点位资料真实性

- 点位详情卡优先使用数据库和管理员配置的真实字段
- 无官方数据时显示"以学校实际安排为准"
- AI 生成介绍标注为"小海导览介绍"，不声称官方

### Web Speech API 音色

四个音色预设：温柔女声 / 亲切男声 / 活力女声 / 沉稳男声

- 男声预设优先中文男声，女声预设优先中文女声
- 设备不支持时自动降级并明确提示
- 不通过降低女声 pitch 冒充男声

### 数据隐私

- 配置文件中的数据库密码、API Key 等敏感信息通过环境变量或本地配置注入
- 真实配置已加入 `.gitignore`，仅 example 模板文件提交仓库
- **不要在任何文档、提交或日志中暴露真实密钥**

---

## 版本历史

### 1.0 — 初始版本

- **负责人：** YSU.lmz
- **参考仓库：** https://github.com/lmz-666-lmz/Shanhai-guide
- 山海小导第一版，建立项目初始方向和基础功能
- 仅作为版本历史参考，当前 2.1 不再以第一版代码结构为实现标准

### 2.0 — 第二版

- **负责人：** YSU.fwj
- 在第一版基础上继续开发

### 2.1 — 当前版本

- **负责人：** YSU.lmz
- 在 2.0 基础上完成的全面完善版本
- **2026-07-14 聊天与路线生成优化（第二轮）：**
  - 彻底分离数字人与地图职责：数字人聊天不再处理位置、附近点位、起点选择和导航
  - 删除所有"当前点位""附近点位""从当前位置开始"等入口和后端 suggestedActions
  - 路线咨询不再询问起点，直接生成多点游览方案；起点选择只在地图页进行
  - 修复"规划一条路线"返回无效兜底文本的问题
  - 活动日期确定性处理：新增 `TimeProvider`（Asia/Shanghai 时区），"今天/明天/本周"活动由后端服务器时钟查询数据库，不再经过 DeepSeek 生成日期
  - 修复活动日期伪造问题（如"今天 07月17日"实际并非当天）
  - 新增 8 个活动日期单元测试（可注入固定 Clock）
  - P0 用户身份一致性修复：运营总览 `userModeDistribution` 改用 `t_user.user_mode`（注册用户）而非 `t_user_session.user_mode`（会话）
  - 会话创建/登录时同步 `session.userMode` 与当前 `user.userMode`
  - Profile 更新时同步用户表 `user_mode`
  - 修正管理端日期来源统一使用 `TimeProvider`
  - 新增 `TimeProvider` 统一时间服务
  - 更新 README 真实目录结构

---

## 贡献者

- **lmz** — 1.0 初始版本、2.1 完善版本
- **fwj** — 2.0 版本

---

## 常见问题

**Q: 前端构建报错 "AMap" 未定义？**

高德地图通过异步 Loader 加载，构建时不需要 AMap 全局变量。确保 `tsconfig.json` 中没有将 AMap 声明为全局类型依赖。

**Q: 后端启动报数据库连接失败？**

检查 `application.yml` 中数据库连接信息和 MySQL 服务状态。

**Q: AI 问答无响应？**

检查 DeepSeek API Key 是否有效，以及网络是否能访问 DeepSeek API。
