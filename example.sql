-- MySQL dump 10.13  Distrib 8.0.35, for Win64 (x86_64)
--
-- Host: localhost    Database: shanhai_guide
-- ------------------------------------------------------
-- Server version	8.0.35

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `t_admin`
--

DROP TABLE IF EXISTS `t_admin`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_admin` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `username` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nickname` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` tinyint DEFAULT '1',
  `last_login_time` datetime DEFAULT NULL,
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `t_admin`
--

LOCK TABLES `t_admin` WRITE;
/*!40000 ALTER TABLE `t_admin` DISABLE KEYS */;
INSERT INTO `t_admin` VALUES (1,'admin','$2a$10$qvDkggVKE9vD.fNJxVep9eIq.Jn3O9AjaPLwLBEqhffkwYSedQLdi','超级管理员','SUPER_ADMIN',1,NULL,'2026-07-10 16:57:02','2026-07-10 17:32:20');
/*!40000 ALTER TABLE `t_admin` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `t_badge`
--

DROP TABLE IF EXISTS `t_badge`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_badge` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `badge_code` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '徽章稳定编码',
  `badge_name` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `badge_icon` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '徽章图标或图片地址',
  `badge_desc` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `badge_level` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT 'normal' COMMENT '等级：normal/silver/gold/special',
  `unlock_rule` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `condition_type` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '达成条件类型',
  `condition_value` int DEFAULT '1' COMMENT '达成条件目标值',
  `condition_config` text COLLATE utf8mb4_unicode_ci COMMENT '条件扩展配置；SPOT_TYPE_CHECKIN 可填写点位类型或 JSON',
  `user_mode_limit` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sort` int DEFAULT '0',
  `sort_order` int DEFAULT '0' COMMENT '管理端排序值',
  `is_enable` tinyint DEFAULT '1',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_badge_code` (`badge_code`),
  KEY `idx_badge_rule_enable` (`condition_type`,`is_enable`,`sort_order`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `t_badge`
--

LOCK TABLES `t_badge` WRITE;
/*!40000 ALTER TABLE `t_badge` DISABLE KEYS */;
INSERT INTO `t_badge` VALUES (1,NULL,'初见山海','','完成第一次校园打卡','special','完成1次打卡','FIRST_CHECKIN',1,NULL,'',0,0,1,'2026-07-10 16:57:02','2026-07-10 16:57:02'),(2,NULL,'校园漫游者','','累计完成3次点位打卡','normal','完成3次打卡','CHECKIN_COUNT',3,NULL,'',0,0,1,'2026-07-10 16:57:02','2026-07-10 16:57:02'),(3,NULL,'活动达人','','成功预约一次校园活动','normal','预约1次活动','FIRST_ACTIVITY',1,NULL,'',0,0,1,'2026-07-10 16:57:02','2026-07-10 16:57:02'),(4,NULL,'新生启航','','新生专属纪念徽章','normal','新生用户','FIRST_ROUTE',1,NULL,'fresh',0,0,1,'2026-07-10 16:57:02','2026-07-10 16:57:02');
/*!40000 ALTER TABLE `t_badge` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `t_campus_activity`
--

DROP TABLE IF EXISTS `t_campus_activity`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_campus_activity` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `activity_title` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `activity_desc` text COLLATE utf8mb4_unicode_ci,
  `activity_type` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `activity_image` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `activity_time` datetime DEFAULT NULL,
  `activity_spot_id` bigint DEFAULT NULL,
  `suitable_mode` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_reserve` tinyint DEFAULT '1',
  `reserve_limit` int DEFAULT '100',
  `reserved_count` int DEFAULT '0',
  `is_enable` tinyint DEFAULT '1',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `t_campus_activity`
--

LOCK TABLES `t_campus_activity` WRITE;
/*!40000 ALTER TABLE `t_campus_activity` DISABLE KEYS */;
INSERT INTO `t_campus_activity` VALUES (1,'人工智能前沿学术讲座','图书馆报告厅','学术','','2026-07-13 16:57:00',2,'fresh,research',1,22,0,1,'2026-07-10 16:57:02','2026-07-14 15:19:17'),(2,'校园春季艺术展览','大学生活动中心展厅','文体','','2026-07-17 16:57:02',6,'alumni,fresh,parent,research',1,200,0,1,'2026-07-10 16:57:02','2026-07-14 13:45:15'),(3,'校友创新创业分享会','校友之家多功能厅','校友','','2026-07-20 16:57:02',12,'alumni,fresh',1,80,0,1,'2026-07-10 16:57:02','2026-07-14 13:45:16');
/*!40000 ALTER TABLE `t_campus_activity` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `t_campus_route`
--

DROP TABLE IF EXISTS `t_campus_route`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_campus_route` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `route_name` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `route_desc` text COLLATE utf8mb4_unicode_ci,
  `total_minute` int DEFAULT NULL,
  `spot_order_json` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `suitable_mode` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cover_image` mediumtext COLLATE utf8mb4_unicode_ci COMMENT '路线封面(base64)',
  `is_enable` tinyint DEFAULT '1',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `t_campus_route`
--

LOCK TABLES `t_campus_route` WRITE;
/*!40000 ALTER TABLE `t_campus_route` DISABLE KEYS */;
INSERT INTO `t_campus_route` VALUES (1,'新生入学打卡线','从南门到教学、餐饮和生活区，快速熟悉校园环境。',60,'[1,4,5,2]','fresh,parent','',1,'2026-07-10 16:57:07','2026-07-10 16:57:07'),(2,'环湖休闲观景线','串联图书馆广场、燕鸣湖和校友之家，适合轻松漫步。',45,'[10,9,12]','alumni,fresh,parent,research,senior','',1,'2026-07-10 16:57:07','2026-07-10 16:57:07'),(3,'文体艺术研学线','体验校园文化活动空间和体育设施。',50,'[6,7,8]','alumni,fresh,research,parent,senior','',1,'2026-07-10 16:57:07','2026-07-10 16:57:07'),(4,'核心教学研学线','走访图书馆、校史馆和材料科学楼，感受学术氛围。',75,'[2,3,11]','fresh,research','',1,'2026-07-10 16:57:07','2026-07-10 16:57:07'),(5,'怀民亦未寝','怀民亦未寝',15,'[4,17,22,19,1]','alumni,fresh,parent,research','',1,NULL,'2026-07-14 17:38:49'),(6,'来玩啦嘻嘻嘻','来玩啦嘻嘻嘻',21,'[1,13]','alumni,fresh,parent,research,senior','',1,'2026-07-12 20:08:21','2026-07-12 20:08:21');
/*!40000 ALTER TABLE `t_campus_route` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `t_campus_spot`
--

DROP TABLE IF EXISTS `t_campus_spot`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_campus_spot` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `spot_name` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `spot_type` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `longitude` decimal(10,6) NOT NULL,
  `latitude` decimal(10,6) NOT NULL,
  `open_time` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `recommend_time` int DEFAULT '15',
  `spot_desc` text COLLATE utf8mb4_unicode_ci,
  `spot_image` mediumtext COLLATE utf8mb4_unicode_ci COMMENT '点位图片(base64)',
  `suitable_mode` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_enable` tinyint DEFAULT '1',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_spot_type_enable` (`spot_type`,`is_enable`)
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `t_campus_spot`
--

LOCK TABLES `t_campus_spot` WRITE;
/*!40000 ALTER TABLE `t_campus_spot` DISABLE KEYS */;
INSERT INTO `t_campus_spot` VALUES (1,'山海大学南门','便民服务',119.537200,39.904100,'全天开放',5,'山海大学主要入口之一，是访客入校、校园导览和路线规划的默认起点。','','alumni,fresh,parent,research',1,'2026-07-10 16:57:02','2026-07-10 22:09:00'),(2,'山海大学知海图书馆','教学场馆',119.526500,39.912100,'08:00-22:00',10,'学校核心学习空间，提供图书借阅、自习、信息检索和文化展示服务。','','alumni,fresh,parent,research',1,'2026-07-10 16:57:02','2026-07-10 22:09:00'),(3,'山海大学校史文化馆','教学场馆',119.535800,39.906200,'09:00-17:00',30,'展示学校发展历程、办学成果和校园文化的重要场馆。','','alumni,fresh,parent,research',1,'2026-07-10 16:57:02','2026-07-10 22:09:00'),(4,'山海大学海棠食堂','餐饮美食',119.533200,39.907800,'06:30-20:30',5,'校园综合餐饮服务点，提供多样化平价餐食，是学生生活的重要场所。','','alumni,fresh,parent,research',1,'2026-07-10 16:57:02','2026-07-10 22:09:00'),(5,'山海大学临风学生公寓','宿舍生活区',119.532500,39.909100,'全天开放',10,'学生住宿生活区域，临近餐饮、学习和运动空间，适合新生了解校园生活。','','alumni,fresh,parent,research',1,'2026-07-10 16:57:02','2026-07-10 22:09:00'),(6,'山海大学青春活动中心','便民服务',119.534700,39.908500,'08:00-21:00',30,'学生社团活动、讲座、文艺演出和校园文化活动的主要场所。','','alumni,fresh,parent,research',1,'2026-07-10 16:57:02','2026-07-10 22:09:00'),(7,'山海大学综合体育馆','运动场地',119.531000,39.905000,'08:00-21:30',40,'综合性室内体育场馆，可开展篮球、羽毛球、乒乓球等体育活动。','','alumni,fresh,parent,research',1,'2026-07-10 16:57:02','2026-07-10 22:09:00'),(8,'山海大学西区运动场','运动场地',119.520300,39.913500,'全天开放',30,'校园户外运动区域，设有田径跑道和运动场地，适合日常锻炼和大型活动。','','alumni,fresh,parent,research',1,'2026-07-10 16:57:02','2026-07-10 22:09:00'),(9,'山海大学燕鸣湖','绿化景观',119.534200,39.907200,'全天开放',20,'校园核心景观湖区，适合散步、休憩和校园打卡。','','alumni,fresh,parent,research',1,'2026-07-10 16:57:02','2026-07-10 22:09:00'),(10,'山海大学知海广场','绿化景观',119.526800,39.911500,'全天开放',15,'图书馆周边开放广场，是学生集合、活动展示和休闲交流的公共空间。','','alumni,fresh,parent,research',1,'2026-07-10 16:57:02','2026-07-10 22:09:00'),(11,'山海大学材料与工程楼','教学场馆',119.522700,39.911200,'08:00-17:30',20,'学校工程类学科教学、实验和科研相关区域。','','alumni,fresh,parent,research',1,'2026-07-10 16:57:02','2026-07-10 22:09:00'),(12,'山海大学校友服务中心','便民服务',119.536200,39.906800,'09:00-17:00',15,'校友交流、接待服务和成果展示空间。','','alumni,fresh,parent,research',1,'2026-07-10 16:57:02','2026-07-10 22:09:00'),(13,'山海大学校名石','绿化景观',119.537000,39.904300,'全天开放',10,'校园标志性打卡地标，适合作为导览展示点。',NULL,'alumni,fresh,parent,research',1,NULL,'2026-07-10 22:09:00'),(14,'山海大学智造实训中心','教学场馆',119.537600,39.907100,'周一至周五 08:00-17:30',30,'智造实训中心是山海大学实践教学的重要基地，设有机械加工、智能制造、数字建模与工程训练区域。这里承载着学校“知行合一”的教学传统，是新生了解工程教育和创新实践的代表性场所。',NULL,'alumni,fresh,parent,research',1,'2026-07-10 22:36:37','2026-07-10 22:36:37'),(15,'山海大学知行桥','绿化景观',119.529200,39.909600,'全天开放',15,'知行桥连接校园东西片区，是山海大学重要的步行交通节点。桥名取自“知行并进、山海相通”的校园精神，桥上视野开阔，可远眺校园主轴与湖畔景观，是师生通勤、散步和拍照的常用路线。',NULL,'alumni,fresh,parent,research',1,'2026-07-10 22:36:37','2026-07-10 22:36:37'),(16,'山海大学东苑体育场','运动场地',119.533800,39.904600,'全天开放',25,'东苑体育场是山海大学重要的户外运动空间，设有标准跑道、球类活动区和开放式看台。这里常用于体育课、运动会和社团训练，也是学生晨跑、夜跑和校园活动的重要场地。',NULL,'alumni,fresh,parent,research',1,'2026-07-10 22:36:37','2026-07-10 22:36:37'),(17,'山海大学西区风味食堂','餐饮美食',119.523100,39.912700,'06:30-20:30',40,'西区风味食堂汇集多类校园餐饮窗口，既有基础套餐，也有地方风味与特色小吃。这里是西区师生日常就餐的重要场所，也是新生熟悉校园生活服务的推荐点位。',NULL,'alumni,fresh,parent,research',1,'2026-07-10 22:36:37','2026-07-10 22:36:37'),(18,'山海大学电气信息楼','教学场馆',119.521600,39.909900,'周一至周五 08:00-17:30',20,'电气信息楼是山海大学信息、电气与自动化相关学科的教学科研空间，设有专业实验室、研讨教室和创新训练区域。这里体现了学校工科底色和面向智能时代的人才培养方向。',NULL,'alumni,fresh,parent,research',1,'2026-07-10 22:36:37','2026-07-10 22:36:37'),(19,'山海大学西区学生活动中心','便民服务',119.525600,39.910900,'08:00-21:00',30,'西区学生活动中心是学生社团、讲座、展演和校园文化活动的重要空间。这里常举办迎新说明会、社团招新、主题沙龙和小型文艺活动，是校园活力与学生自治文化的集中展示点。',NULL,'alumni,fresh,parent,research',1,'2026-07-10 22:36:37','2026-07-10 22:36:37'),(20,'山海大学塔山观景台','绿化景观',119.518600,39.915100,'全天开放',20,'塔山观景台位于校园西侧高地，是山海大学自然景观路线中的代表点位。登上观景台可俯瞰校园建筑群与远处山海景致，适合休憩、拍照和开展校园文化讲解。',NULL,'alumni,fresh,parent,research',1,'2026-07-10 22:36:37','2026-07-10 22:36:37'),(21,'山海大学学术交流中心','便民服务',119.536300,39.906900,'周一至周五 08:30-11:30,14:30-17:30',20,'学术交流中心承担学校重要会议、学术报告、校际交流和专题讲座功能。这里见证了许多学术论坛与校园重大活动，是了解山海大学学术氛围和对外交流的重要窗口。',NULL,'alumni,fresh,parent,research',1,'2026-07-10 22:36:37','2026-07-10 22:36:37'),(22,'山海大学梧桐苑学生公寓','宿舍生活区',119.524200,39.914200,'全天开放（仅限内部人员出入）',10,'梧桐苑学生公寓是山海大学西区主要生活片区之一，周边配套便民服务、餐饮和运动空间。公寓区以安静整洁的生活环境和便利的学习动线，为学生提供稳定舒适的校园生活体验。',NULL,'alumni,fresh,parent,research',1,'2026-07-10 22:36:37','2026-07-10 22:36:37'),(23,'山海大学重器广场','绿化景观',119.524800,39.911800,'全天开放',10,'重器广场是山海大学西区重要的开放公共空间，广场中央设置象征工程精神与工业传承的校园景观装置。这里既是师生通行与集合点，也是展示学校工科文化和办学传统的特色地标。',NULL,'alumni,fresh,parent,research',1,'2026-07-10 22:36:37','2026-07-10 22:36:37');
/*!40000 ALTER TABLE `t_campus_spot` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `t_knowledge`
--

DROP TABLE IF EXISTS `t_knowledge`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_knowledge` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `content` text COLLATE utf8mb4_unicode_ci,
  `knowledge_type` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bind_spot_id` bigint DEFAULT NULL,
  `bind_activity_id` bigint DEFAULT NULL,
  `suitable_mode` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_enable` tinyint DEFAULT '1',
  `view_count` int DEFAULT '0',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `t_knowledge`
--

LOCK TABLES `t_knowledge` WRITE;
/*!40000 ALTER TABLE `t_knowledge` DISABLE KEYS */;
INSERT INTO `t_knowledge` VALUES (1,'图书馆开放服务','图书馆开放时间为08:00至22:00，可使用校园卡借阅。','spot',2,NULL,'alumni,fresh,parent,research',1,45,'2026-07-10 16:57:02','2026-07-10 16:57:02'),(2,'校园参访须知','参访请从南门进入，并遵守校园公共秩序。','guide',1,NULL,'parent,research',1,8,'2026-07-10 16:57:02','2026-07-10 16:57:02');
/*!40000 ALTER TABLE `t_knowledge` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `t_system_config`
--

DROP TABLE IF EXISTS `t_system_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_system_config` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `config_key` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `config_value` text COLLATE utf8mb4_unicode_ci,
  `config_desc` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `config_key` (`config_key`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `t_system_config`
--

LOCK TABLES `t_system_config` WRITE;
/*!40000 ALTER TABLE `t_system_config` DISABLE KEYS */;
INSERT INTO `t_system_config` VALUES (1,'campus_name','山海大学','演示校园名称','2026-07-10 16:57:02','2026-07-10 16:57:02'),(2,'digital_human_global_config','{\"name\":\"小海\",\"digitalHumanName\":\"小海\",\"avatar\":\"\",\"avatarTheme\":\"山海蓝\",\"style\":\"校园讲解员\",\"voiceType\":\"活力女声\",\"speed\":1,\"speechSpeed\":1,\"volume\":0.9,\"pitch\":1,\"autoRead\":false,\"subtitleEnabled\":true,\"welcomeText\":\"欢迎来到山海大学！我是你的校园 AI 导览员小海。\",\"introduction\":\"能听懂游览时间与需求，基于可信校园知识讲解，并在地图中逐站陪伴导航。\",\"guideStyle\":\"标准\",\"defaultAnswerStyle\":\"标准\",\"capabilities\":{\"highContrast\":true,\"knowledgeNarration\":true,\"cocreateRecommendation\":true,\"aiChat\":true,\"navigationVoice\":true,\"subtitles\":true,\"routeAnimation\":true,\"userPersonalization\":true,\"voiceInput\":true,\"autoArrivalNarration\":true,\"seniorMode\":true,\"pointNarration\":true,\"mapCompanion\":true,\"largeText\":true,\"voiceRead\":true,\"routePlanning\":true},\"quickQuestions\":[\"45 分钟怎么游览山海大学？\",\"请讲解当前点位\",\"带长者走一条轻松路线\",\"校园文化有哪些必看点位？\"],\"welcomeTextsByMode\":{\"fresh\":\"欢迎来到山海大学，我会重点介绍学习生活与新生服务。\",\"alumni\":\"欢迎回到山海大学，让我们沿着校史与校园变化重温旧时光。\",\"parent\":\"欢迎来到山海大学，我会重点介绍学习环境、生活安全和服务设施。\",\"research\":\"欢迎来到山海大学，我会重点介绍学术资源、历史和专业特色。\",\"senior\":\"欢迎来到山海大学，我会用更简洁、清晰的方式陪您游览。\"},\"navigationSettings\":{\"allowSkipStation\":true,\"arrivalDetection\":\"manual\",\"autoNarration\":false,\"allowReplan\":true,\"showRouteAnimation\":true,\"promptFrequency\":\"standard\"},\"narrationSettings\":{\"autoArrivalPrompt\":true,\"showSources\":true,\"defaultMode\":\"concise\"},\"accessibilitySettings\":{\"highContrast\":false,\"largeText\":false,\"seniorMode\":false},\"fallbackMessages\":{\"noKnowledge\":\"当前回答暂未检索到明确的知识库依据，请以学校实际发布信息为准。\",\"disclaimer\":\"校园信息可能随运营安排调整，请以学校实际安排为准。\",\"navigationComplete\":\"本次山海大学游览已完成，感谢一路同行。\",\"arrival\":\"已到达{spotName}，需要我讲解这里吗？\",\"error\":\"小海暂时没有理解，可以换一种说法或查看校园点位。\",\"blockedTopics\":\"个人隐私,违法危险行为,与校园导览无关的敏感信息\"},\"userAdjustableFields\":[\"avatarTheme\",\"voiceType\",\"speechSpeed\",\"volume\",\"pitch\",\"autoRead\",\"subtitleEnabled\",\"answerStyle\",\"autoNarration\",\"navigationAssistantExpanded\",\"routeAnimationEnabled\",\"highContrast\",\"largeText\",\"seniorMode\",\"navigationPromptFrequency\",\"quickQuestionPreference\"]}','全局数字人默认配置',NULL,'2026-07-12 13:15:47');
/*!40000 ALTER TABLE `t_system_config` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `t_user`
--

DROP TABLE IF EXISTS `t_user`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_user` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `username` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `nickname` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_mode` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `college` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `major` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `grade` int DEFAULT NULL,
  `phone` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` tinyint DEFAULT '1',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=82 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `t_user`
--

LOCK TABLES `t_user` WRITE;
/*!40000 ALTER TABLE `t_user` DISABLE KEYS */;
INSERT INTO `t_user` VALUES (49,'test','$2a$10$HCW8oz0W00dtTb1zqu2Yr.35AQj54dkJvPjasdqJoKv1.WWl61LkO','测试用户','fresh',NULL,NULL,NULL,NULL,1,'2026-07-14 17:29:16','2026-07-14 17:29:16');
/*!40000 ALTER TABLE `t_user` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `t_user_activity_reserve`
--

DROP TABLE IF EXISTS `t_user_activity_reserve`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_user_activity_reserve` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `session_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `activity_id` bigint NOT NULL,
  `reserve_status` tinyint DEFAULT '1',
  `reserve_time` datetime DEFAULT NULL,
  `cancel_time` datetime DEFAULT NULL,
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_reserve_session` (`session_id`,`reserve_status`),
  KEY `idx_reserve_activity_session_status` (`activity_id`,`session_id`,`reserve_status`),
  CONSTRAINT `fk_activity_reserve_session` FOREIGN KEY (`session_id`) REFERENCES `t_user_session` (`session_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `t_user_activity_reserve`
--

LOCK TABLES `t_user_activity_reserve` WRITE;
/*!40000 ALTER TABLE `t_user_activity_reserve` DISABLE KEYS */;
/*!40000 ALTER TABLE `t_user_activity_reserve` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `t_user_badge_relation`
--

DROP TABLE IF EXISTS `t_user_badge_relation`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_user_badge_relation` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `session_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `badge_id` bigint NOT NULL,
  `source_event` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '触发来源：CHECKIN/ROUTE_COMPLETE/ACTIVITY_RESERVE/FAVORITE_SPOT/FAVORITE_ROUTE/RECALCULATE',
  `is_notified` tinyint DEFAULT '0' COMMENT '0未写入消息 1已写入消息',
  `unlock_time` datetime DEFAULT CURRENT_TIMESTAMP,
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_session_badge` (`session_id`,`badge_id`),
  CONSTRAINT `fk_badge_relation_session` FOREIGN KEY (`session_id`) REFERENCES `t_user_session` (`session_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `t_user_badge_relation`
--

LOCK TABLES `t_user_badge_relation` WRITE;
/*!40000 ALTER TABLE `t_user_badge_relation` DISABLE KEYS */;
/*!40000 ALTER TABLE `t_user_badge_relation` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `t_user_chat_history`
--

DROP TABLE IF EXISTS `t_user_chat_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_user_chat_history` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `session_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_mode` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_content` text COLLATE utf8mb4_unicode_ci,
  `ai_content` text COLLATE utf8mb4_unicode_ci,
  `source_info` text COLLATE utf8mb4_unicode_ci,
  `message_type` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT 'chat' COMMENT '消息结构类型：chat/none/spot_list/route_plan',
  `structured_payload` longtext COLLATE utf8mb4_unicode_ci COMMENT '聊天卡片结构化 JSON：sources/cardType/spotRecommendations/routePlan',
  `emotion_tag` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_chat_history_session_id` (`session_id`),
  CONSTRAINT `fk_chat_history_session` FOREIGN KEY (`session_id`) REFERENCES `t_user_session` (`session_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `t_user_chat_history`
--

LOCK TABLES `t_user_chat_history` WRITE;
/*!40000 ALTER TABLE `t_user_chat_history` DISABLE KEYS */;
/*!40000 ALTER TABLE `t_user_chat_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `t_user_checkin`
--

DROP TABLE IF EXISTS `t_user_checkin`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_user_checkin` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `session_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `spot_id` bigint DEFAULT NULL,
  `route_id` bigint DEFAULT NULL,
  `checkin_type` tinyint NOT NULL,
  `checkin_desc` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_checkin_session_id` (`session_id`),
  CONSTRAINT `fk_checkin_session` FOREIGN KEY (`session_id`) REFERENCES `t_user_session` (`session_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `t_user_checkin`
--

LOCK TABLES `t_user_checkin` WRITE;
/*!40000 ALTER TABLE `t_user_checkin` DISABLE KEYS */;
/*!40000 ALTER TABLE `t_user_checkin` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `t_user_content_application`
--

DROP TABLE IF EXISTS `t_user_content_application`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_user_content_application` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `session_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '申请人访问会话',
  `user_mode` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '申请人身份模式',
  `applicant_name` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '申请人展示名',
  `application_type` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'spot点位 route路线',
  `application_title` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '申请标题',
  `spot_name` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '点位名称',
  `spot_type` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '点位类型',
  `longitude` decimal(10,6) DEFAULT NULL COMMENT '经度',
  `latitude` decimal(10,6) DEFAULT NULL COMMENT '纬度',
  `open_time` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '开放时间',
  `recommend_time` int DEFAULT '15' COMMENT '推荐游览分钟',
  `spot_desc` text COLLATE utf8mb4_unicode_ci COMMENT '点位简介',
  `spot_image` mediumtext COLLATE utf8mb4_unicode_ci COMMENT '点位图片(base64)',
  `route_name` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '路线名称',
  `route_desc` text COLLATE utf8mb4_unicode_ci COMMENT '路线简介',
  `total_minute` int DEFAULT NULL COMMENT '预计总时长',
  `spot_order_json` text COLLATE utf8mb4_unicode_ci COMMENT '点位顺序JSON数组，对应 t_campus_route.spot_order_json',
  `cover_image` mediumtext COLLATE utf8mb4_unicode_ci COMMENT '路线封面(base64)',
  `suitable_mode` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT 'alumni,fresh,parent,research' COMMENT '适用身份',
  `application_reason` text COLLATE utf8mb4_unicode_ci COMMENT '申请理由',
  `status` tinyint DEFAULT '0' COMMENT '0待审核 1已通过 2已拒绝 3已撤回',
  `audit_admin_id` bigint DEFAULT NULL COMMENT '审核管理员ID',
  `audit_admin_name` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '审核管理员名称',
  `audit_comment` text COLLATE utf8mb4_unicode_ci COMMENT '审核意见',
  `published_target_id` bigint DEFAULT NULL COMMENT '通过后写入的点位或路线ID',
  `audit_time` datetime DEFAULT NULL COMMENT '审核时间',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_application_session` (`session_id`,`status`),
  KEY `idx_application_type_status` (`application_type`,`status`),
  KEY `idx_application_create_time` (`create_time`),
  CONSTRAINT `fk_content_application_session` FOREIGN KEY (`session_id`) REFERENCES `t_user_session` (`session_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `t_user_content_application`
--

LOCK TABLES `t_user_content_application` WRITE;
/*!40000 ALTER TABLE `t_user_content_application` DISABLE KEYS */;
/*!40000 ALTER TABLE `t_user_content_application` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `t_user_digital_human_config`
--

DROP TABLE IF EXISTS `t_user_digital_human_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_user_digital_human_config` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `session_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `avatar_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `voice_type` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `speech_speed` decimal(4,2) DEFAULT NULL,
  `welcome_text` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `talk_style` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `config_json` longtext COLLATE utf8mb4_unicode_ci COMMENT '用户数字人个性化扩展配置 JSON',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `session_id` (`session_id`),
  CONSTRAINT `fk_digital_human_config_session` FOREIGN KEY (`session_id`) REFERENCES `t_user_session` (`session_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `t_user_digital_human_config`
--

LOCK TABLES `t_user_digital_human_config` WRITE;
/*!40000 ALTER TABLE `t_user_digital_human_config` DISABLE KEYS */;
INSERT INTO `t_user_digital_human_config` VALUES (4,'68d80b20-6f7d-3e28-a9b1-b8fa1681d29e','山海蓝','温柔女声',1.10,'欢迎来到山海大学！我是你的校园 AI 导览员小海。','标准','{\"a\":\"山海蓝\",\"v\":\"温柔女声\",\"s\":1.1,\"o\":0.9,\"p\":1,\"r\":false,\"t\":true,\"y\":\"标准\",\"n\":false,\"e\":true,\"m\":true,\"h\":false,\"l\":false,\"d\":false,\"f\":\"standard\",\"q\":\"校园文化\"}','2026-07-14 17:29:16','2026-07-14 17:29:16');
/*!40000 ALTER TABLE `t_user_digital_human_config` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `t_user_favorite`
--

DROP TABLE IF EXISTS `t_user_favorite`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_user_favorite` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `session_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `favorite_type` tinyint NOT NULL,
  `target_id` bigint NOT NULL,
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_favorite` (`session_id`,`favorite_type`,`target_id`),
  CONSTRAINT `fk_user_favorite_session` FOREIGN KEY (`session_id`) REFERENCES `t_user_session` (`session_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `t_user_favorite`
--

LOCK TABLES `t_user_favorite` WRITE;
/*!40000 ALTER TABLE `t_user_favorite` DISABLE KEYS */;
/*!40000 ALTER TABLE `t_user_favorite` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `t_user_feedback`
--

DROP TABLE IF EXISTS `t_user_feedback`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_user_feedback` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `session_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_mode` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `score` int DEFAULT NULL,
  `feedback_type` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `feedback_content` text COLLATE utf8mb4_unicode_ci,
  `admin_reply` text COLLATE utf8mb4_unicode_ci,
  `reply_time` datetime DEFAULT NULL,
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_feedback_session_id` (`session_id`),
  CONSTRAINT `fk_feedback_session` FOREIGN KEY (`session_id`) REFERENCES `t_user_session` (`session_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `t_user_feedback`
--

LOCK TABLES `t_user_feedback` WRITE;
/*!40000 ALTER TABLE `t_user_feedback` DISABLE KEYS */;
/*!40000 ALTER TABLE `t_user_feedback` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `t_user_message`
--

DROP TABLE IF EXISTS `t_user_message`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_user_message` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `target_type` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'personal' COMMENT '目标类型：personal个人 public公共 mode按身份模式',
  `session_id` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'personal消息目标会话',
  `user_mode` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'mode消息目标身份模式，可存逗号分隔值',
  `message_type` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '消息类型：system/activity/application/badge/feedback',
  `title` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '消息标题',
  `content` text COLLATE utf8mb4_unicode_ci COMMENT '消息内容',
  `source_type` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '来源类型：activity/application/badge/feedback/manual',
  `source_id` bigint DEFAULT NULL COMMENT '来源业务ID',
  `source_event` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '来源事件：submitted/approved/rejected/withdrawn/migrated/unlocked',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_message_source_event_target` (`source_type`,`source_id`,`message_type`,`source_event`,`session_id`),
  KEY `idx_message_target` (`target_type`,`session_id`,`user_mode`),
  KEY `idx_message_type_time` (`message_type`,`create_time`),
  KEY `idx_user_message_session_id` (`session_id`),
  CONSTRAINT `fk_user_message_session` FOREIGN KEY (`session_id`) REFERENCES `t_user_session` (`session_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `t_user_message`
--

LOCK TABLES `t_user_message` WRITE;
/*!40000 ALTER TABLE `t_user_message` DISABLE KEYS */;
/*!40000 ALTER TABLE `t_user_message` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `t_user_message_state`
--

DROP TABLE IF EXISTS `t_user_message_state`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_user_message_state` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `message_id` bigint NOT NULL COMMENT '消息ID',
  `session_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '当前访问会话',
  `read_status` tinyint DEFAULT '0' COMMENT '0未读 1已读',
  `is_deleted` tinyint DEFAULT '0' COMMENT '0正常 1用户侧隐藏',
  `read_time` datetime DEFAULT NULL COMMENT '阅读时间',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_message_session` (`message_id`,`session_id`),
  KEY `idx_state_session` (`session_id`,`read_status`,`is_deleted`),
  KEY `idx_state_message` (`message_id`),
  CONSTRAINT `fk_user_message_state_message` FOREIGN KEY (`message_id`) REFERENCES `t_user_message` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_user_message_state_session` FOREIGN KEY (`session_id`) REFERENCES `t_user_session` (`session_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `t_user_message_state`
--

LOCK TABLES `t_user_message_state` WRITE;
/*!40000 ALTER TABLE `t_user_message_state` DISABLE KEYS */;
/*!40000 ALTER TABLE `t_user_message_state` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `t_user_old_20260714`
--

DROP TABLE IF EXISTS `t_user_old_20260714`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_user_old_20260714` (
  `id` bigint NOT NULL,
  `username` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nickname` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_mode` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `college` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `major` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `grade` int DEFAULT NULL,
  `phone` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` tinyint DEFAULT '1',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `t_user_old_20260714`
--

LOCK TABLES `t_user_old_20260714` WRITE;
/*!40000 ALTER TABLE `t_user_old_20260714` DISABLE KEYS */;
/*!40000 ALTER TABLE `t_user_old_20260714` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `t_user_personal_route`
--

DROP TABLE IF EXISTS `t_user_personal_route`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_user_personal_route` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `session_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '用户会话ID',
  `route_name` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '个人路线名称',
  `route_desc` text COLLATE utf8mb4_unicode_ci COMMENT '个人路线介绍',
  `spot_order_json` longtext COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '点位ID顺序JSON数组',
  `total_minute` int DEFAULT '60' COMMENT '预计总时长',
  `source_prompt` text COLLATE utf8mb4_unicode_ci COMMENT '生成或保存来源提示词',
  `source_type` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT 'ai' COMMENT '来源类型：ai/manual/application',
  `is_favorite` tinyint DEFAULT '1' COMMENT '是否收藏',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_personal_route_session` (`session_id`),
  KEY `idx_personal_route_favorite` (`session_id`,`is_favorite`),
  CONSTRAINT `fk_personal_route_session` FOREIGN KEY (`session_id`) REFERENCES `t_user_session` (`session_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `t_user_personal_route`
--

LOCK TABLES `t_user_personal_route` WRITE;
/*!40000 ALTER TABLE `t_user_personal_route` DISABLE KEYS */;
/*!40000 ALTER TABLE `t_user_personal_route` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `t_user_session`
--

DROP TABLE IF EXISTS `t_user_session`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_user_session` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint DEFAULT NULL COMMENT '关联注册用户ID，游客会话允许为空',
  `session_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_mode` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `virtual_name` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `virtual_year` int DEFAULT NULL,
  `virtual_college` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `virtual_major` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `total_checkin` int DEFAULT '0',
  `total_route` int DEFAULT '0',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `status` tinyint DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `session_id` (`session_id`),
  KEY `idx_user_session_user_id` (`user_id`),
  CONSTRAINT `fk_user_session_user` FOREIGN KEY (`user_id`) REFERENCES `t_user` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=83 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `t_user_session`
--

LOCK TABLES `t_user_session` WRITE;
/*!40000 ALTER TABLE `t_user_session` DISABLE KEYS */;
INSERT INTO `t_user_session` VALUES (48,49,'68d80b20-6f7d-3e28-a9b1-b8fa1681d29e','fresh','测试用户',2025,'','',0,0,'2026-07-14 17:29:16','2026-07-14 17:29:16',1);
/*!40000 ALTER TABLE `t_user_session` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `t_visit_stat`
--

DROP TABLE IF EXISTS `t_visit_stat`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_visit_stat` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `stat_date` date NOT NULL,
  `total_session` int DEFAULT '0',
  `total_chat` int DEFAULT '0',
  `alumni_count` int DEFAULT '0',
  `fresh_count` int DEFAULT '0',
  `parent_count` int DEFAULT '0',
  `research_count` int DEFAULT '0',
  `positive_emotion` int DEFAULT '0',
  `negative_emotion` int DEFAULT '0',
  `neutral_emotion` int DEFAULT '0',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `stat_date` (`stat_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `t_visit_stat`
--

LOCK TABLES `t_visit_stat` WRITE;
/*!40000 ALTER TABLE `t_visit_stat` DISABLE KEYS */;
/*!40000 ALTER TABLE `t_visit_stat` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'shanhai_guide'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-07-14 17:50:30
