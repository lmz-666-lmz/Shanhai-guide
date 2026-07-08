import { Fragment, useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import "../styles/theme.css";
import "./VisitorApp.css";
import type { TwoDDigitalHumanStatus } from "../components/TwoDDigitalHuman";
import { sendChatMessage } from "../api/chatApi";
import type { ChatResponse } from "../api/chatApi";
import { getSpots, getSpotById, parseTags } from "../api/spotApi";
import type { CampusSpot } from "../api/spotApi";
import { getRoutes, getRouteById, recommendRoute } from "../api/routeApi";
import type { CampusRoute, RouteRecommendRequest } from "../api/routeApi";
import { getCurrentDigitalHuman } from "../api/adminDigitalHumanApi";
import type { DigitalHumanConfig } from "../api/adminDigitalHumanApi";
import { getNotices } from "../api/adminNoticeApi";
import type { Notice } from "../api/adminNoticeApi";

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  sources?: string[];
  suggestedActions?: string[];
}

type TabType = "guide" | "map" | "routes" | "profile";

const defaultDigitalHuman: DigitalHumanConfig = {
  id: null,
  name: "小海",
  avatarText: "海",
  roleTitle: "校园 AI 导览员",
  welcomeText: "你好，我是小海，可以为你讲解校园文化、校史故事和校友路线。",
  voiceName: "默认",
  stylePreset: "科技蓝紫",
  enabled: true,
  createdAt: null,
  updatedAt: null,
};

function VisitorApp() {
  const [activeTab, setActiveTab] = useState<TabType>("guide");
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [spots, setSpots] = useState<CampusSpot[]>([]);
  const [isSpotsLoading, setIsSpotsLoading] = useState(false);
  const [selectedSpot, setSelectedSpot] = useState<CampusSpot | null>(null);
  const [detailSpot, setDetailSpot] = useState<CampusSpot | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<string>("全部");
  const [routes, setRoutes] = useState<CampusRoute[]>([]);
  const [isRoutesLoading, setIsRoutesLoading] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<CampusRoute | null>(null);
  const [isRouteDetailLoading, setIsRouteDetailLoading] = useState(false);
  const [recommendResult, setRecommendResult] = useState<CampusRoute | null>(null);
  const [isRecommendLoading, setIsRecommendLoading] = useState(false);
  const [userMode, setUserMode] = useState<string>("校友模式");
  const [durationMinutes, setDurationMinutes] = useState<number>(90);
  const [selectedInterests, setSelectedInterests] = useState<string[]>(["校史", "校友"]);
  const [digitalHuman, setDigitalHuman] = useState<DigitalHumanConfig>(defaultDigitalHuman);
  const [digitalHumanStatus, setDigitalHumanStatus] = useState<TwoDDigitalHumanStatus>("idle");
  const [notices, setNotices] = useState<Notice[]>([]);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [supportsSpeech] = useState(() => typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window);
  const [showFaqModal, setShowFaqModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  // Floating digital human drag state
  const [floatPos, setFloatPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, startX: 0, startY: 0 });
  const hasMovedRef = useRef(false);
  const floatRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const speakingTimerRef = useRef<number | null>(null);
  const lastSpeechTextRef = useRef("");
  const adminTapCountRef = useRef(0);
  const adminTapTimerRef = useRef<number | null>(null);

  const typeOptions = ["全部", "校园景观", "校史文化", "校园文化", "学院建筑", "生活服务", "校友服务"];

  const userModeConfig = [
    { label: "校友", value: "校友模式" },
    { label: "新生", value: "新生模式" },
    { label: "家长", value: "家长模式" },
    { label: "访客", value: "访客模式" },
    { label: "研学", value: "研学模式" },
  ];

  const durationOptions = [
    { label: "45分钟", value: 45 },
    { label: "60分钟", value: 60 },
    { label: "90分钟", value: 90 },
    { label: "120分钟", value: 120 },
  ];

  const interestOptions = ["校史", "拍照", "食堂", "科研", "校友", "景观"];

  const sceneCards = [
    { icon: "🎓", label: "校友返校", desc: "90 分钟重温母校变化", action: "我是校友，想用90分钟看看母校变化" },
    { icon: "📚", label: "新生入校", desc: "快速认识学习生活空间", action: "我是新生，想快速了解校园主要空间" },
    { icon: "👨‍👩‍👧", label: "家长参观", desc: "了解校园环境与育人特色", action: "我是家长，想了解校园环境和育人特色" },
    { icon: "🎉", label: "校友活动", desc: "查看近期返校活动", action: "最近有什么校友活动？" },
  ];

  const statusLabel: Record<TwoDDigitalHumanStatus, string> = {
    idle: "待机中",
    thinking: "正在检索校园知识库",
    speaking: "正在讲解",
    guiding: "正在规划路线",
  };

  const getLatestAiSummary = (): string => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (!messages[i].isUser && messages[i].content) {
        const text = messages[i].content;
        return text.length > 80 ? text.slice(0, 80) + "…" : text;
      }
    }
    return "";
  };

  useEffect(() => {
    const welcomeMessage: Message = {
      id: "1",
      content: defaultDigitalHuman.welcomeText,
      isUser: false,
    };
    setMessages([welcomeMessage]);
  }, []);

  useEffect(() => {
    loadSpots();
    loadRoutes();
    loadVisitorExtensions();
  }, []);

  useEffect(() => () => {
    if (speakingTimerRef.current) {
      window.clearTimeout(speakingTimerRef.current);
    }
    stopSpeech();
  }, []);

  const stopSpeech = () => {
    if (supportsSpeech) {
      window.speechSynthesis.cancel();
    }
  };

  const handleAvatarTripleClick = () => {
    adminTapCountRef.current += 1;
    if (adminTapTimerRef.current) {
      window.clearTimeout(adminTapTimerRef.current);
    }
    if (adminTapCountRef.current >= 3) {
      adminTapCountRef.current = 0;
      window.location.hash = "/admin/dashboard";
      return;
    }
    adminTapTimerRef.current = window.setTimeout(() => {
      adminTapCountRef.current = 0;
    }, 800);
  };

  // ---- Floating digital human drag handlers ----
  const handleFloatDragStart = (e: React.TouchEvent | React.MouseEvent) => {
    setIsDragging(true);
    hasMovedRef.current = false;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    dragStartRef.current = { x: clientX, y: clientY, startX: floatPos.x, startY: floatPos.y };
  };

  const handleFloatDragMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging) return;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const dx = clientX - dragStartRef.current.x;
    const dy = clientY - dragStartRef.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMovedRef.current = true;
    setFloatPos({ x: dragStartRef.current.startX + dx, y: dragStartRef.current.startY + dy });
  };

  const handleFloatDragEnd = () => {
    setIsDragging(false);
  };

  const setThinkingStatus = (status: TwoDDigitalHumanStatus = "thinking") => {
    if (speakingTimerRef.current) {
      window.clearTimeout(speakingTimerRef.current);
      speakingTimerRef.current = null;
    }
    stopSpeech();
    setDigitalHumanStatus(status);
  };

  const finishWithSpeaking = () => {
    if (voiceEnabled && supportsSpeech && lastSpeechTextRef.current) {
      try {
        stopSpeech();
        const utterance = new SpeechSynthesisUtterance(lastSpeechTextRef.current);
        utterance.lang = "zh-CN";
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.onend = () => setDigitalHumanStatus("idle");
        utterance.onerror = () => setDigitalHumanStatus("idle");
        setDigitalHumanStatus("speaking");
        window.speechSynthesis.speak(utterance);
        return;
      } catch {
        // Fall through to visual-only speaking state.
      }
    }
    // Calculate speaking duration based on text length (~200ms per Chinese char)
    const charCount = lastSpeechTextRef.current.length || 20;
    const speakDuration = Math.min(30000, Math.max(2500, charCount * 200));
    setDigitalHumanStatus("speaking");
    speakingTimerRef.current = window.setTimeout(() => {
      setDigitalHumanStatus("idle");
      speakingTimerRef.current = null;
    }, speakDuration);
  };

  const loadVisitorExtensions = async () => {
    try {
      const [digitalConfig, noticeData] = await Promise.all([getCurrentDigitalHuman(), getNotices()]);
      setDigitalHuman(digitalConfig);
      setNotices(noticeData.slice(0, 2));
      if (digitalConfig.welcomeText) {
        setMessages((prev) => prev.map((message) => message.id === "1" && !message.isUser ? { ...message, content: digitalConfig.welcomeText } : message));
      }
    } catch {
      // Keep the visitor app usable when optional admin-driven config is unavailable.
    }
  };

  useEffect(() => {
    if (selectedType === "全部" && spots.length > 0 && !selectedSpot) {
      setSelectedSpot(spots[0]);
    }
  }, [spots, selectedSpot, selectedType]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadRoutes = async () => {
    setIsRoutesLoading(true);
    try {
      const data = await getRoutes();
      setRoutes(data);
    } catch {
      setRoutes([]);
    } finally {
      setIsRoutesLoading(false);
    }
  };

  const handleRouteClick = async (routeId: number) => {
    setIsRouteDetailLoading(true);
    try {
      const route = await getRouteById(routeId);
      setSelectedRoute(route);
    } catch {
      setSelectedRoute(null);
    } finally {
      setIsRouteDetailLoading(false);
    }
  };

  const handleRecommend = async () => {
    if (isRecommendLoading) return;

    setIsRecommendLoading(true);
    try {
      const request: RouteRecommendRequest = {
        message: "我想参观校园",
        userMode: userMode,
        durationMinutes: durationMinutes,
        interests: selectedInterests.join(","),
      };

      const result = await recommendRoute(request);
      setRecommendResult(result);
    } catch {
      setRecommendResult(null);
    } finally {
      setIsRecommendLoading(false);
    }
  };

  const toggleInterest = (interest: string) => {
    setSelectedInterests((prev) => {
      if (prev.includes(interest)) {
        return prev.filter((i) => i !== interest);
      }
      return [...prev, interest];
    });
  };

  const handleExplainRoute = async (route?: CampusRoute) => {
    const targetRoute = route || selectedRoute;
    if (!targetRoute || isLoading) return;

    const message = `请介绍一下${targetRoute.name}，并说明这条路线适合什么人群`;
    setSelectedRoute(null);
    setActiveTab("guide");

    const userMessage: Message = {
      id: Date.now().toString(),
      content: message,
      isUser: true,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    lastSpeechTextRef.current = "";
    setIsLoading(true);
    setThinkingStatus("guiding");

    try {
      const response: ChatResponse = await sendChatMessage({
        message: userMessage.content,
        userMode: "校友模式",
        currentSpotId: null,
      });

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: response.answer,
        isUser: false,
        sources: response.sources.length > 0 ? response.sources : undefined,
        suggestedActions: response.suggestedActions.length > 0 ? response.suggestedActions : undefined,
      };

      lastSpeechTextRef.current = aiMessage.content;
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "抱歉，我现在无法回答你的问题，请稍后再试。",
        isUser: false,
      };
      lastSpeechTextRef.current = errorMessage.content;
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      finishWithSpeaking();
    }
  };

  const loadSpots = async () => {
    setIsSpotsLoading(true);
    try {
      const data = await getSpots();
      setSpots(data);
    } catch {
      setSpots([]);
    } finally {
      setIsSpotsLoading(false);
    }
  };

  const handleSpotClick = async (spotId: number) => {
    setIsDetailLoading(true);
    try {
      const spot = await getSpotById(spotId);
      setDetailSpot(spot);
    } catch {
      setDetailSpot(null);
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleExplainSpot = async (spot?: CampusSpot) => {
    const targetSpot = spot || detailSpot;
    if (!targetSpot || isLoading) return;

    const message = `请讲解一下${targetSpot.name}`;
    setDetailSpot(null);
    setActiveTab("guide");

    const userMessage: Message = {
      id: Date.now().toString(),
      content: message,
      isUser: true,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    lastSpeechTextRef.current = "";
    setIsLoading(true);
    setThinkingStatus("guiding");

    try {
      const response: ChatResponse = await sendChatMessage({
        message: userMessage.content,
        userMode: "校友模式",
        currentSpotId: targetSpot.id,
      });

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: response.answer,
        isUser: false,
        sources: response.sources.length > 0 ? response.sources : undefined,
        suggestedActions: response.suggestedActions.length > 0 ? response.suggestedActions : undefined,
      };

      lastSpeechTextRef.current = aiMessage.content;
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "抱歉，我现在无法回答你的问题，请稍后再试。",
        isUser: false,
      };
      lastSpeechTextRef.current = errorMessage.content;
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      finishWithSpeaking();
    }
  };

  const handleSend = async (messageText?: string) => {
    const content = (messageText ?? inputValue).trim();
    if (!content || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      isUser: true,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    lastSpeechTextRef.current = "";
    setIsLoading(true);
    setThinkingStatus("thinking");

    try {
      const response: ChatResponse = await sendChatMessage({
        message: userMessage.content,
        userMode: "校友模式",
        currentSpotId: null,
      });

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: response.answer,
        isUser: false,
        sources: response.sources.length > 0 ? response.sources : undefined,
        suggestedActions: response.suggestedActions.length > 0 ? response.suggestedActions : undefined,
      };

      lastSpeechTextRef.current = aiMessage.content;
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "抱歉，我现在无法回答你的问题，请稍后再试。",
        isUser: false,
      };
      lastSpeechTextRef.current = errorMessage.content;
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      finishWithSpeaking();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleActionClick = async (action: string) => {
    handleSend(action);
  };

  const renderGuidePage = () => {
    const latestSummary = getLatestAiSummary();
    return (
      <div className="guide-page">
        {/* Ultra-compact top bar: avatar + title + voice toggle */}
        <div className="guide-top-bar">
          <div className="guide-top-avatar" onClick={handleAvatarTripleClick}>
            <span className="guide-top-avatar-text">{digitalHuman.avatarText || "海"}</span>
            <span className={`guide-top-status-dot ${digitalHumanStatus}`} />
          </div>
          <div className="guide-top-info">
            <h1 className="guide-top-title">山海小导</h1>
            <span className="guide-top-status-text">
              {digitalHumanStatus === "idle" ? "在线 · 随时问我" : statusLabel[digitalHumanStatus]}
            </span>
          </div>
          {supportsSpeech && (
            <label className="voice-toggle guide-voice-toggle">
              <input type="checkbox" checked={voiceEnabled} onChange={(event) => {
                setVoiceEnabled(event.target.checked);
                if (!event.target.checked) {
                  stopSpeech();
                  setDigitalHumanStatus("idle");
                }
              }} />
              <span>🔊</span>
            </label>
          )}
        </div>

        {/* Scene cards — single row horizontal scroll */}
        <div className="guide-scene-strip">
          {sceneCards.map((card) => (
            <button
              key={card.label}
              className="scene-chip"
              onClick={() => handleSend(card.action)}
              disabled={isLoading}
            >
              <span className="scene-chip-icon">{card.icon}</span>
              <span>{card.label}</span>
            </button>
          ))}
        </div>

        {/* Chat history — takes all remaining space */}
        <div className="chat-container">
          <div className="messages-list">
            {messages.map((message) => (
              <div key={message.id} className={`message ${message.isUser ? "user-message" : "ai-message"}`}>
                {!message.isUser && (
                  <div className="message-avatar">
                    <span className="avatar-icon-small">{digitalHuman.avatarText || "海"}</span>
                  </div>
                )}
                <div className="message-content">
                  <p>{message.content}</p>
                  {message.sources && message.sources.length > 0 && (
                    <div className="sources">
                      <span className="sources-label">依据来源</span>
                      <span className="sources-content">：{message.sources.join("、")}</span>
                    </div>
                  )}
                  {message.suggestedActions && message.suggestedActions.length > 0 && (
                    <div className="suggested-actions">
                      {message.suggestedActions.map((action, actionIndex) => (
                        <button
                          key={actionIndex}
                          className="action-button"
                          onClick={() => handleActionClick(action)}
                        >
                          {action}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="loading-message">
                <div className="message-avatar">
                  <span className="avatar-icon-small">{digitalHuman.avatarText || "海"}</span>
                </div>
                <div className="message-content">
                  <p className="loading-text">小海正在检索校园知识库...</p>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Floating input */}
        <div className="input-section">
          <input
            type="text"
            className="chat-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="向小海提问校园文化、路线或活动..."
            disabled={isLoading}
          />
          <button className="send-button" onClick={() => handleSend()} disabled={isLoading}>
            发送
          </button>
        </div>

        {/* Speaking caption bubble — floats above input when speaking */}
        {latestSummary && digitalHumanStatus === "speaking" && (
          <div className="speaking-toast">
            <span className="speaking-toast-dot" />
            小海正在讲解…
          </div>
        )}
      </div>
    );
  };

  const filteredSpots = selectedType === "全部"
    ? spots
    : spots.filter((spot) => spot.type === selectedType);

  const getSpotPosition = (spot: CampusSpot, allSpots: CampusSpot[]) => {
    if (!spot.latitude || !spot.longitude) {
      return { x: 50, y: 50, labelPlacement: "bottom", labelAlign: "center" };
    }

    const latitudes = allSpots.map(s => s.latitude || 0);
    const longitudes = allSpots.map(s => s.longitude || 0);

    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLng = Math.min(...longitudes);
    const maxLng = Math.max(...longitudes);

    const latRange = maxLat - minLat || 1;
    const lngRange = maxLng - minLng || 1;

    const rawX = 12 + ((spot.longitude - minLng) / lngRange) * 76;
    const rawY = 12 + ((spot.latitude - minLat) / latRange) * 76;
    const x = Math.min(88, Math.max(12, rawX));
    const y = Math.min(88, Math.max(12, rawY));
    const labelPlacement = y > 68 ? "top" : "bottom";
    const labelAlign = x < 24 ? "left" : x > 76 ? "right" : "center";

    return { x, y, labelPlacement, labelAlign };
  };

  const handleFilterChange = (type: string) => {
    setSelectedType(type);
    const newFiltered = type === "全部" ? spots : spots.filter(s => s.type === type);
    if (newFiltered.length > 0) {
      setSelectedSpot(newFiltered[0]);
      window.requestAnimationFrame(scrollToMap);
    } else {
      setSelectedSpot(null);
    }
  };

  const scrollToMap = () => {
    const mapElement = document.getElementById("campus-map");
    if (mapElement) {
      mapElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const handleLocateOnMap = (spot: CampusSpot) => {
    setSelectedSpot(spot);
    scrollToMap();
  };

  const renderMapPage = () => (
    <div className="map-page">
      <div className="page-header">
        <h1 className="page-title">校园点位导览示意图</h1>
        <p className="page-subtitle">基于校园点位坐标生成的导览示意图，可查看文化点位与服务设施</p>
      </div>

      <div className="type-filter">
        {typeOptions.map((type) => (
          <button
            key={type}
            className={`filter-button ${selectedType === type ? "active" : ""}`}
            onClick={() => handleFilterChange(type)}
          >
            {type}
          </button>
        ))}
      </div>

      <div className="map-content">
        <div className="campus-map-container" id="campus-map">
          <div className="map-regions">
            <div className="map-region teaching" style={{ top: '15%', left: '20%' }}>
              <span className="region-label">教学区</span>
            </div>
            <div className="map-region cultural" style={{ top: '30%', left: '60%' }}>
              <span className="region-label">文化区</span>
            </div>
            <div className="map-region living" style={{ top: '65%', left: '30%' }}>
              <span className="region-label">生活区</span>
            </div>
            <div className="map-region landscape" style={{ top: '50%', left: '10%' }}>
              <span className="region-label">景观区</span>
            </div>
          </div>

          <div className="map-markers">
            {isSpotsLoading ? (
              <div className="map-loading">加载中...</div>
            ) : filteredSpots.length === 0 ? (
              <div className="map-empty">暂无该类型点位</div>
            ) : (
              filteredSpots.map((spot, index) => {
                const pos = getSpotPosition(spot, filteredSpots);
                const isSelected = selectedSpot?.id === spot.id;
                return (
                  <div
                    key={spot.id}
                    className={`map-marker label-${pos.labelPlacement} align-${pos.labelAlign} ${isSelected ? "marker-selected" : ""}`}
                    style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                    onClick={() => setSelectedSpot(spot)}
                  >
                    <span className="marker-num">{index + 1}</span>
                    <span className="marker-name">{spot.name}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {selectedSpot && (
          <div className="selected-spot-card">
            <div className="spot-card-header">
              <h3 className="spot-card-name">{selectedSpot.name}</h3>
              <span className="spot-card-type">{selectedSpot.type}</span>
            </div>
            <p className="spot-card-desc">{selectedSpot.description}</p>
            <div className="spot-card-info">
              <span>⏰ {selectedSpot.openTime}</span>
              <span>⏱️ {selectedSpot.recommendedDuration}</span>
            </div>
            <div className="spot-card-tags">
              {parseTags(selectedSpot.tags).slice(0, 4).map((tag, index) => (
                <span key={index} className="spot-card-tag">{tag}</span>
              ))}
            </div>
            <div className="spot-card-actions">
              <button className="card-action-btn outline" onClick={() => handleSpotClick(selectedSpot.id)}>
                查看完整介绍
              </button>
              <button className="card-action-btn" onClick={() => handleExplainSpot(selectedSpot)}>
                让小海讲解这里
              </button>
            </div>
          </div>
        )}

        <div className="compact-spots-section">
          <h3 className="section-title">点位列表</h3>
          {isSpotsLoading ? (
            <div className="loading-text">加载中...</div>
          ) : filteredSpots.length === 0 ? (
            <div className="empty-text">暂无该类型点位</div>
          ) : (
            <div className="compact-spots-list">
              {filteredSpots.map((spot) => (
                <div key={spot.id} className="compact-spot-item">
                  <div className="compact-spot-info">
                    <div className="compact-spot-header">
                      <span className="compact-spot-name">{spot.name}</span>
                      <span className="compact-spot-type">{spot.type}</span>
                    </div>
                    <div className="compact-spot-meta">
                      <span>⏰ {spot.openTime}</span>
                      <span>·</span>
                      <span>⏱️ {spot.recommendedDuration}</span>
                    </div>
                    <div className="compact-spot-tags">
                      {parseTags(spot.tags).slice(0, 3).map((tag, index) => (
                        <span key={index} className="compact-spot-tag">{tag}</span>
                      ))}
                    </div>
                  </div>
                  <button
                    className="locate-button"
                    onClick={() => handleLocateOnMap(spot)}
                  >
                    定位
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderRoutesPage = () => (
    <div className="routes-page">
      <div className="routes-header">
        <h1 className="routes-title">推荐路线</h1>
        <p className="routes-subtitle">根据身份、时间和兴趣，为你生成校园参观路线</p>
      </div>

      <div className="routes-content">
        <div className="recommend-card">
          <div className="card-section">
            <h3 className="card-section-title">身份</h3>
            <div className="chip-group">
              {userModeConfig.map((mode) => (
                <button
                  key={mode.value}
                  className={`chip ${userMode === mode.value ? "chip-active" : ""}`}
                  onClick={() => setUserMode(mode.value)}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          <div className="card-section">
            <h3 className="card-section-title">时间</h3>
            <div className="chip-group">
              {durationOptions.map((duration) => (
                <button
                  key={duration.value}
                  className={`chip ${durationMinutes === duration.value ? "chip-active" : ""}`}
                  onClick={() => setDurationMinutes(duration.value)}
                >
                  {duration.label}
                </button>
              ))}
            </div>
          </div>

          <div className="card-section">
            <h3 className="card-section-title">兴趣</h3>
            <div className="chip-group">
              {interestOptions.map((interest) => (
                <button
                  key={interest}
                  className={`chip ${selectedInterests.includes(interest) ? "chip-active" : ""}`}
                  onClick={() => toggleInterest(interest)}
                >
                  {interest}
                </button>
              ))}
            </div>
          </div>

          <button className="recommend-btn" onClick={handleRecommend} disabled={isRecommendLoading}>
            {isRecommendLoading ? "推荐中..." : "🤖 AI 生成推荐路线"}
          </button>
        </div>

        {recommendResult && (
          <div className="recommend-summary-card">
            <div className="summary-header">
              <span className="summary-badge">AI 推荐</span>
              <button className="summary-close" onClick={() => setRecommendResult(null)}>✕</button>
            </div>
            <div className="summary-content">
              <h2 className="summary-name">{recommendResult.name}</h2>
              <span className="summary-type">{recommendResult.routeType}</span>
              <div className="summary-meta">
                <span>⏱️ {recommendResult.estimatedDuration}</span>
                <span>📍 {recommendResult.distanceText}</span>
                <span>📍 {recommendResult.spots.length}个点位</span>
              </div>
              {recommendResult.spots.length > 0 && (
                <div className="summary-timeline">
                  {recommendResult.spots
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((spot, idx) => (
                      <Fragment key={spot.spotId}>
                        {idx > 0 && <span className="summary-timeline-arrow">→</span>}
                        <span>{spot.name}</span>
                      </Fragment>
                    ))}
                </div>
              )}
              <p className="summary-reason">{recommendResult.reason}</p>
            </div>
            <div className="summary-actions">
              <button className="summary-action-btn outline" onClick={() => handleRouteClick(recommendResult.id)}>
                查看完整路线
              </button>
              <button className="summary-action-btn" onClick={() => {
                handleExplainRoute(recommendResult);
              }}>
                让小海介绍
              </button>
            </div>
          </div>
        )}

        <div className="routes-section">
          <h3 className="section-title">全部路线</h3>
          {isRoutesLoading ? (
            <div className="loading-text">加载中...</div>
          ) : routes.length === 0 ? (
            <div className="empty-text">暂无路线数据</div>
          ) : (
            <div className="routes-cards">
              {routes.map((route) => (
                <div key={route.id} className="route-item-card" onClick={() => handleRouteClick(route.id)}>
                  <div className="route-item-header">
                    <h4 className="route-item-name">{route.name}</h4>
                    <span className="route-item-type">{route.routeType}</span>
                  </div>
                  <div className="route-item-meta">
                    <span>⏱️ {route.estimatedDuration}</span>
                    <span>📍 {route.distanceText}</span>
                  </div>
                  <p className="route-item-desc">{route.description}</p>
                  <div className="route-item-footer">
                    <span className="route-item-suitable">适合：{route.suitableFor}</span>
                    <button className="route-item-detail-btn">查看详情</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderProfilePage = () => (
    <div className="profile-page">
      <div className="page-header">
        <h1 className="page-title">我的</h1>
        <p className="page-subtitle">校友数字凭证 · 服务记录 · 管理入口</p>
      </div>
      <div className="profile-content">
        {/* Digital identity card */}
        <section className="profile-hero">
          <div className="profile-user">
            <div
              className="profile-avatar"
              onClick={handleAvatarTripleClick}
              title="连续点击头像 3 次进入管理后台"
              style={{ cursor: "pointer" }}
            >
              {digitalHuman.avatarText || "海"}
            </div>
            <div className="profile-meta">
              <h2>校友访客</h2>
              <p>山海大学文化导览通行证</p>
            </div>
          </div>
          <p className="profile-pass-text">当前模式：校友模式</p>
        </section>

        {/* Stats cards */}
        <section className="profile-stats">
          <div className="profile-stat-card">
            <strong>1</strong>
            <span>今日导览</span>
          </div>
          <div className="profile-stat-card">
            <strong>{spots.length}</strong>
            <span>已浏览点位</span>
          </div>
          <div className="profile-stat-card">
            <strong>{routes.length}</strong>
            <span>推荐路线</span>
          </div>
          <div className="profile-stat-card">
            <strong>{messages.filter(m => !m.isUser).length}</strong>
            <span>问答互动</span>
          </div>
        </section>

        {/* Latest notices */}
        <section className="profile-notices">
          <h3>最新公告</h3>
          {notices.length > 0 ? (
            notices.map((notice) => (
              <div
                className="profile-notice-item"
                key={notice.id}
                onClick={() => setSelectedNotice(notice)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter") setSelectedNotice(notice); }}
              >
                <div className="profile-notice-header">
                  <strong>{notice.title}</strong>
                  <span className="profile-notice-arrow">›</span>
                </div>
                <span className="profile-notice-meta">{notice.noticeType} · {notice.location || "校园"}</span>
              </div>
            ))
          ) : (
            <p className="profile-empty-notice">暂无公告，后台发布后将在这里展示</p>
          )}
        </section>

        {/* Feature menu */}
        <section className="profile-menu">
          <button className="profile-menu-item" onClick={() => setActiveTab("guide")}>
            <span className="profile-menu-icon">⚙️</span>
            导览偏好
            <span className="profile-menu-arrow">›</span>
          </button>
          <button className="profile-menu-item" onClick={() => setShowFaqModal(true)}>
            <span className="profile-menu-icon">❓</span>
            常见问题
            <span className="profile-menu-arrow">›</span>
          </button>
          <button className="profile-menu-item" onClick={() => setShowAboutModal(true)}>
            <span className="profile-menu-icon">ℹ️</span>
            关于平台
            <span className="profile-menu-arrow">›</span>
          </button>
        </section>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case "guide":
        return renderGuidePage();
      case "map":
        return renderMapPage();
      case "routes":
        return renderRoutesPage();
      case "profile":
        return renderProfilePage();
      default:
        return renderGuidePage();
    }
  };

  const stylePresetClass = (() => {
    if (digitalHuman.stylePreset === "校园清新") return "fresh";
    if (digitalHuman.stylePreset === "文化典雅") return "classic";
    return "tech";
  })();

  const floatingAvatarNode = (
    <div
      ref={floatRef}
      className={`floating-dh ${stylePresetClass} ${digitalHumanStatus} ${isDragging ? "dragging" : ""}`}
      style={floatPos.x !== 0 || floatPos.y !== 0 ? {
        transform: `translate(${floatPos.x}px, ${floatPos.y}px)`,
        transition: isDragging ? "none" : "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
      } : undefined}
      onMouseDown={handleFloatDragStart}
      onMouseMove={handleFloatDragMove}
      onMouseUp={handleFloatDragEnd}
      onMouseLeave={handleFloatDragEnd}
      onTouchStart={handleFloatDragStart}
      onTouchMove={handleFloatDragMove}
      onTouchEnd={handleFloatDragEnd}
      onClick={() => { if (!hasMovedRef.current) setActiveTab("guide"); }}
    >
      {/* Glow ring */}
      <div className="fdh-ring" />
      {/* Hair */}
      <div className="fdh-hair" />
      {/* Head + face */}
      <div className="fdh-head">
        <div className="fdh-face">
          <span className="fdh-eye left" />
          <span className="fdh-eye right" />
          <span className="fdh-mouth" />
        </div>
      </div>
      {/* Body */}
      <div className="fdh-body">
        <div className="fdh-collar" />
      </div>
      {/* Badge */}
      <div className="fdh-badge">{digitalHuman.avatarText || "海"}</div>
      {/* Status bubble */}
      {digitalHumanStatus !== "idle" && (
        <div className="fdh-status-bubble">
          {digitalHumanStatus === "thinking" && "思考中…"}
          {digitalHumanStatus === "speaking" && "讲解中…"}
          {digitalHumanStatus === "guiding" && "规划路线…"}
        </div>
      )}
    </div>
  );

  return (
    <div className="app-container">
      {createPortal(floatingAvatarNode, document.body)}

      {renderContent()}

      <div className="bottom-nav">
        <button
          className={`nav-item ${activeTab === "guide" ? "active" : ""}`}
          onClick={() => setActiveTab("guide")}
        >
          <span className="nav-icon" aria-hidden="true">💬</span>
          <span className="nav-text">导览</span>
        </button>
        <button
          className={`nav-item ${activeTab === "map" ? "active" : ""}`}
          onClick={() => setActiveTab("map")}
        >
          <span className="nav-icon" aria-hidden="true">🗺</span>
          <span className="nav-text">地图</span>
        </button>
        <button
          className={`nav-item ${activeTab === "routes" ? "active" : ""}`}
          onClick={() => setActiveTab("routes")}
        >
          <span className="nav-icon" aria-hidden="true">🧭</span>
          <span className="nav-text">路线</span>
        </button>
        <button
          className={`nav-item ${activeTab === "profile" ? "active" : ""}`}
          onClick={() => setActiveTab("profile")}
        >
          <span className="nav-icon" aria-hidden="true">👤</span>
          <span className="nav-text">我的</span>
        </button>
      </div>

      {detailSpot && (
        <div className="spot-modal-overlay" onClick={() => setDetailSpot(null)}>
          <div className="spot-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setDetailSpot(null)}>✕</button>
            {isDetailLoading ? (
              <div className="modal-loading">加载中...</div>
            ) : (
              <>
                <div className="modal-image-placeholder">
                  <span className="modal-icon">景</span>
                </div>
                <div className="modal-content">
                  <h2 className="modal-title">{detailSpot.name}</h2>
                  <span className="modal-type">{detailSpot.type}</span>
                  <div className="modal-tags">
                    {parseTags(detailSpot.tags).map((tag, index) => (
                      <span key={index} className="modal-tag">{tag}</span>
                    ))}
                  </div>
                  <div className="modal-info">
                    <div className="info-item">
                      <span className="info-icon">⏰</span>
                      <span className="info-label">开放时间</span>
                      <span className="info-value">{detailSpot.openTime}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-icon">⏱️</span>
                      <span className="info-label">推荐时长</span>
                      <span className="info-value">{detailSpot.recommendedDuration}</span>
                    </div>
                  </div>
                  <div className="modal-story">
                    <h3 className="story-title">景点故事</h3>
                    <p className="story-content">{detailSpot.story}</p>
                  </div>
                  <button
                    className="explain-button"
                    onClick={() => handleExplainSpot()}
                    disabled={isLoading}
                  >
                    让小海讲解这里
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {selectedRoute && (
        <div className="spot-modal-overlay" onClick={() => setSelectedRoute(null)}>
          <div className="spot-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedRoute(null)}>✕</button>
            {isRouteDetailLoading ? (
              <div className="modal-loading">加载中...</div>
            ) : (
              <>
                <div className="modal-image-placeholder">
                  <span className="modal-icon">路</span>
                </div>
                <div className="modal-content">
                  <h2 className="modal-title">{selectedRoute.name}</h2>
                  <span className="modal-type">{selectedRoute.routeType}</span>
                  <div className="modal-info">
                    <div className="info-item">
                      <span className="info-icon">⏱️</span>
                      <span className="info-label">预计时长</span>
                      <span className="info-value">{selectedRoute.estimatedDuration}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-icon">📍</span>
                      <span className="info-label">距离</span>
                      <span className="info-value">{selectedRoute.distanceText}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-icon">👥</span>
                      <span className="info-label">适合人群</span>
                      <span className="info-value">{selectedRoute.suitableFor}</span>
                    </div>
                  </div>
                  <div className="modal-story">
                    <h3 className="story-title">推荐理由</h3>
                    <p className="story-content">{selectedRoute.reason}</p>
                  </div>
                  <div className="modal-spots">
                    <h3 className="story-title">途经点位</h3>
                    <div className="modal-spots-list">
                      {selectedRoute.spots.sort((a, b) => a.sortOrder - b.sortOrder).map((spot, index) => (
                        <div key={spot.spotId} className="modal-spot-item">
                          <span className="spot-order-num">{index + 1}</span>
                          <div className="spot-details">
                            <span className="spot-detail-name">{spot.name}</span>
                            <span className="spot-detail-type">{spot.type}</span>
                            <div className="spot-detail-meta">
                              <span>停留 {spot.stayMinutes} 分钟</span>
                              {spot.note && <span>· {spot.note}</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <button
                    className="explain-button"
                    onClick={() => handleExplainRoute()}
                    disabled={isLoading}
                  >
                    让小海介绍这条路线
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* FAQ Modal */}
      {showFaqModal && (
        <div className="spot-modal-overlay" onClick={() => setShowFaqModal(false)}>
          <div className="spot-modal faq-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowFaqModal(false)}>✕</button>
            <div className="modal-image-placeholder faq-header-bg">
              <span className="modal-icon">❓</span>
            </div>
            <div className="modal-content">
              <h2 className="modal-title">常见问题</h2>
              <p className="faq-subtitle">关于山海小导的常见疑问与解答</p>
              <div className="faq-list">
                {[
                  { q: "山海小导是什么？", a: "山海小导是一款基于 AI 大模型的校园智能导览助手，融合2D数字人、知识库检索与路线推荐能力，为师生和访客提供沉浸式校园文化导览体验。" },
                  { q: "如何使用智能导览？", a: "在「导览」页面直接输入问题，或点击快捷场景卡片，小海会基于校园知识库为你生成导览讲解。你也可以切换到「地图」浏览点位，或到「路线」获取推荐路线。" },
                  { q: "支持哪些游览模式？", a: "目前支持校友模式、新生模式、家长模式、访客模式和研学模式，每种模式会根据身份偏好推荐不同的路线和讲解内容。" },
                  { q: "如何进入管理后台？", a: "在「我的」页面，连续快速点击头像 3 次即可进入管理后台。后台可以管理点位、路线、公告、知识库和数字人形象。" },
                  { q: "数字人支持语音播报吗？", a: "支持！在导览页数字人区域开启「语音」开关，AI 回复内容将通过浏览器语音合成播报（需设备支持）。" },
                  { q: "路线推荐是如何生成的？", a: "AI 会根据你选择的身份、游览时长和兴趣标签，结合校园点位数据和路线模板，智能生成最适合你的参观路线。" },
                ].map((item, idx) => (
                  <details key={idx} className="faq-item">
                    <summary className="faq-question">
                      <span className="faq-q-icon">Q</span>
                      {item.q}
                    </summary>
                    <div className="faq-answer">
                      <span className="faq-a-icon">A</span>
                      <p>{item.a}</p>
                    </div>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* About Modal */}
      {showAboutModal && (
        <div className="spot-modal-overlay" onClick={() => setShowAboutModal(false)}>
          <div className="spot-modal about-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowAboutModal(false)}>✕</button>
            <div className="modal-image-placeholder about-header-bg">
              <span className="modal-icon about-logo">海</span>
            </div>
            <div className="modal-content">
              <h2 className="modal-title">山海小导</h2>
              <span className="about-version">v2.0 · 琉璃流光</span>
              <p className="about-desc">
                基于 DeepSeek 大模型的校园 AI 导览平台，融合 2D 数字人交互、知识库智能检索与个性化路线推荐，
                为师生校友提供沉浸式校园文化体验。
              </p>
              <div className="about-features">
                <div className="about-feature-item">
                  <span className="about-feature-icon">🤖</span>
                  <div>
                    <strong>AI 智能导览</strong>
                    <p>DeepSeek 大模型驱动，秒级响应校园知识问答</p>
                  </div>
                </div>
                <div className="about-feature-item">
                  <span className="about-feature-icon">🗺️</span>
                  <div>
                    <strong>点位地图</strong>
                    <p>校园文化点位可视化，一键定位与讲解</p>
                  </div>
                </div>
                <div className="about-feature-item">
                  <span className="about-feature-icon">🧭</span>
                  <div>
                    <strong>智能路线</strong>
                    <p>多模式路线推荐，满足不同人群的游览需求</p>
                  </div>
                </div>
                <div className="about-feature-item">
                  <span className="about-feature-icon">🎭</span>
                  <div>
                    <strong>2D 数字人</strong>
                    <p>可配置形象与语音，打造专属 AI 导览员</p>
                  </div>
                </div>
              </div>
              <div className="about-footer">
                <p>Powered by DeepSeek · React + TypeScript</p>
                <p className="about-copyright">© 2025 山海大学 · 校园文化导览平台</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notice Detail Modal */}
      {selectedNotice && (
        <div className="spot-modal-overlay" onClick={() => setSelectedNotice(null)}>
          <div className="spot-modal notice-detail-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedNotice(null)}>✕</button>
            <div className="modal-image-placeholder notice-header-bg">
              <span className="modal-icon">📢</span>
            </div>
            <div className="modal-content">
              <h2 className="modal-title">{selectedNotice.title}</h2>
              <div className="notice-detail-meta">
                <span className="notice-detail-type">{selectedNotice.noticeType}</span>
                <span className="notice-detail-location">📍 {selectedNotice.location || "校园"}</span>
              </div>
              <div className="notice-detail-time">
                <span>🕐 {selectedNotice.startTime} ～ {selectedNotice.endTime}</span>
              </div>
              <div className="modal-story">
                <h3 className="story-title">公告详情</h3>
                <p className="story-content">{selectedNotice.content}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default VisitorApp;
