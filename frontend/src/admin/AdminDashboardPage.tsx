import { useEffect, useMemo, useState } from "react";
import "./AdminDashboardPage.css";
import AdminLayout from "./AdminLayout";
import {
  getChatTrend,
  getDashboardOverview,
  getHotQuestions,
  getRecentChats,
  getSentimentStats,
  getUserModeStats,
  getVisitorInsight,
} from "../api/adminDashboardApi";
import type { ChatTrend, DashboardStats, HotQuestion, RecentChat, SentimentStats, VisitorInsight, VisitorModeStats } from "../api/adminDashboardApi";

function BarList({ data, labelKey }: { data: Array<Record<string, string | number>>; labelKey: string }) {
  const max = Math.max(1, ...data.map((item) => Number(item.count || 0)));
  return <div className="admin-dashboard-bars">{data.map((item) => <div className="admin-dashboard-bar-row" key={String(item[labelKey])}><span title={String(item[labelKey])}>{String(item[labelKey])}</span><div className="admin-dashboard-bar"><span style={{ width: `${Math.max(8, Number(item.count || 0) / max * 100)}%` }} /></div><strong>{Number(item.count || 0)}</strong></div>)}</div>;
}

function AdminDashboardPage() {
  const [overview, setOverview] = useState<DashboardStats | null>(null);
  const [hotQuestions, setHotQuestions] = useState<HotQuestion[]>([]);
  const [modes, setModes] = useState<VisitorModeStats[]>([]);
  const [sentiments, setSentiments] = useState<SentimentStats[]>([]);
  const [recentChats, setRecentChats] = useState<RecentChat[]>([]);
  const [trend, setTrend] = useState<ChatTrend[]>([]);
  const [insight, setInsight] = useState<VisitorInsight | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setErrorMessage("");
      try {
        const [overviewData, hotData, modeData, sentimentData, chatData, trendData, insightData] = await Promise.all([
          getDashboardOverview(),
          getHotQuestions(),
          getUserModeStats(),
          getSentimentStats(),
          getRecentChats(),
          getChatTrend(),
          getVisitorInsight(),
        ]);
        setOverview(overviewData);
        setHotQuestions(hotData);
        setModes(modeData);
        setSentiments(sentimentData);
        setRecentChats(chatData);
        setTrend(trendData);
        setInsight(insightData);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "加载数据大屏失败");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const successRate = useMemo(() => `${Math.round((overview?.avgSuccessRate || 0) * 100)}%`, [overview]);

  const hasData = overview && (
    (overview.totalChatCount || 0) > 0 ||
    (overview.totalSpotCount || 0) > 0 ||
    hotQuestions.length > 0
  );

  return (
    <AdminLayout activeMenu="dashboard">
      {/* Dark theme wrapper — overrides light admin background */}
      <style>{`
        .admin-layout-page { background: #0B1120 !important; color: #e2e8f0; }
        .admin-layout-sidebar { background: #0F172A !important; border-right-color: rgba(255,255,255,0.06) !important; color: #e2e8f0 !important; }
        .admin-layout-brand { color: #e2e8f0 !important; }
        .admin-layout-brand::after { color: #64748b !important; }
        .admin-layout-menu-item { color: #94a3b8 !important; }
        .admin-layout-menu-item:hover { background: rgba(255,255,255,0.05) !important; color: #e2e8f0 !important; }
        .admin-layout-menu-item.active { background: rgba(43,94,234,0.15) !important; color: #60a5fa !important; box-shadow: inset 3px 0 0 #2B5EEA !important; }
        .admin-layout-main { background: #0B1120; }
      `}</style>

      {/* Hero title */}
      <div className="admin-dashboard-hero">
        <h1>山海小导 AI 导览数据大屏</h1>
        <p>游客问答 · 热门问题 · 服务使用 · 感受度分析</p>
      </div>

      {errorMessage && <div className="admin-spot-alert">{errorMessage}</div>}

      {/* Core metrics */}
      <div className="admin-dashboard-stats-grid">
        <div className="admin-dashboard-stat-card"><span>今日问答</span><strong>{overview?.todayChatCount ?? 0}</strong></div>
        <div className="admin-dashboard-stat-card"><span>累计问答</span><strong>{overview?.totalChatCount ?? 0}</strong></div>
        <div className="admin-dashboard-stat-card"><span>AI 成功率</span><strong>{successRate}</strong></div>
        <div className="admin-dashboard-stat-card"><span>知识文档</span><strong>{overview?.totalKnowledgeDocCount ?? 0}</strong></div>
        <div className="admin-dashboard-stat-card"><span>点位数量</span><strong>{overview?.totalSpotCount ?? 0}</strong></div>
        <div className="admin-dashboard-stat-card"><span>路线数量</span><strong>{overview?.totalRouteCount ?? 0}</strong></div>
      </div>

      {!hasData && !isLoading ? (
        <div className="admin-dashboard-empty">
          暂无足够问答数据，请先在游客端完成几轮导览问答
        </div>
      ) : (
        <div className="admin-dashboard-grid">
          <section className="admin-dashboard-card">
            <h2>用户模式分布</h2>
            <BarList data={modes as unknown as Array<Record<string, string | number>>} labelKey="userMode" />
          </section>
          <section className="admin-dashboard-card">
            <h2>最近 7 天问答趋势</h2>
            <BarList data={trend as unknown as Array<Record<string, string | number>>} labelKey="date" />
          </section>
          <section className="admin-dashboard-card">
            <h2>情绪分布</h2>
            <BarList data={sentiments as unknown as Array<Record<string, string | number>>} labelKey="emotion" />
          </section>
          <section className="admin-dashboard-card">
            <h2>热门问题 Top 10</h2>
            <BarList data={hotQuestions as unknown as Array<Record<string, string | number>>} labelKey="question" />
          </section>
          <section className="admin-dashboard-card">
            <h2>游客感受度报告</h2>
            <ul className="admin-dashboard-list">
              {(insight?.suggestions.length ? insight.suggestions : ["暂无足够数据生成感受度报告，建议持续补充知识库与活动公告。"]).map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </section>
          <section className="admin-dashboard-card">
            <h2>最近聊天记录</h2>
            {recentChats.length === 0 ? (
              <p className="admin-dashboard-empty" style={{padding: '16px 0'}}>暂无聊天记录</p>
            ) : (
              <ul className="admin-dashboard-list">
                {recentChats.slice(0, 8).map((chat) => (
                  <li key={chat.id}>
                    <strong>{chat.userMode || "访客"}</strong>：{chat.userMessage}<br />{chat.aiAnswer}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </AdminLayout>
  );
}

export default AdminDashboardPage;
