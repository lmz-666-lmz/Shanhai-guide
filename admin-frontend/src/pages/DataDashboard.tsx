import { useEffect, useState } from 'react';
import { Card, Col, Empty, Progress, Row, Space, Spin, Statistic, Table, Tag, Typography, message } from 'antd';
import { BarChartOutlined, CheckCircleOutlined, CommentOutlined, EnvironmentOutlined, FundProjectionScreenOutlined, ScheduleOutlined, TeamOutlined } from '@ant-design/icons';
import {
  getDashboardOverview,
  getFeedbackSummary,
  getHotQuestions,
  getHotRoutes,
  getHotSpots,
  getUserModeDistribution,
  type DashboardOverview,
  type FeedbackSummary,
  type ModeDistributionItem,
  type RankItem,
} from '@/api/dashboard';

const { Title, Text } = Typography;

const emptyOverview: DashboardOverview = {
  todayServicePeople: 0,
  weekServicePeople: 0,
  todayChatCount: 0,
  activityReserveCount: 0,
  checkinCount: 0,
  totalChatCount: 0,
  knowledgeHitRate: null,
  missedQuestionCount: 0,
  digitalHumanServiceMinutes: null,
};

const getErrorMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

export default function DataDashboard() {
  const [loading, setLoading] = useState(false);
  const [overview, setOverview] = useState<DashboardOverview>(emptyOverview);
  const [hotSpots, setHotSpots] = useState<RankItem[]>([]);
  const [hotRoutes, setHotRoutes] = useState<RankItem[]>([]);
  const [hotQuestions, setHotQuestions] = useState<RankItem[]>([]);
  const [feedback, setFeedback] = useState<FeedbackSummary | null>(null);
  const [modeDistribution, setModeDistribution] = useState<ModeDistributionItem[]>([]);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const [overviewRes, spotsRes, routesRes, questionsRes, feedbackRes, modeRes] = await Promise.all([
        getDashboardOverview(),
        getHotSpots(),
        getHotRoutes(),
        getHotQuestions(),
        getFeedbackSummary(),
        getUserModeDistribution(),
      ]);
      setOverview({ ...emptyOverview, ...(overviewRes.data || {}) });
      setHotSpots(spotsRes.data || []);
      setHotRoutes(routesRes.data || []);
      setHotQuestions(questionsRes.data || []);
      setFeedback(feedbackRes.data || null);
      setModeDistribution(modeRes.data || []);
    } catch (error) {
      message.error(getErrorMessage(error, '数据大屏加载失败'));
    } finally {
      setLoading(false);
    }
  };

  const rankColumns = (nameTitle: string) => [
    { title: nameTitle, dataIndex: 'name', key: 'name', render: (value: string, record: RankItem) => value || record.question || '暂无' },
    { title: '次数', dataIndex: 'count', key: 'count', width: 80 },
  ];

  const totalModeCount = modeDistribution.reduce((sum, item) => sum + item.count, 0);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '100px 0' }}><Spin size="large" /></div>;
  }

  return (
    <div>
      <div className="admin-toolbar" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg, #1890ff, #096dd9)', boxShadow: '0 4px 12px rgba(24,144,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <FundProjectionScreenOutlined style={{ color: '#fff', fontSize: 24 }} />
          </div>
          <div>
            <Title level={4} style={{ margin: 0, color: '#0f344e' }}>数据大屏</Title>
            <Text type="secondary" style={{ fontSize: 13 }}>汇总 AI 导览服务、知识命中、热门资源和访客感受</Text>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: 16, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><TeamOutlined style={{ color: '#fff', fontSize: 22 }} /></div>
          <div><div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, marginBottom: 4 }}>今日服务人次</div><div style={{ color: '#fff', fontSize: 28, fontWeight: 700 }}>{overview.todayServicePeople}</div></div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #36cfc9 0%, #2bafad 100%)', borderRadius: 16, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><BarChartOutlined style={{ color: '#fff', fontSize: 22 }} /></div>
          <div><div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, marginBottom: 4 }}>本周服务人次</div><div style={{ color: '#fff', fontSize: 28, fontWeight: 700 }}>{overview.weekServicePeople}</div></div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #4f8cf7 0%, #3a6fd1 100%)', borderRadius: 16, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><CommentOutlined style={{ color: '#fff', fontSize: 22 }} /></div>
          <div><div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, marginBottom: 4 }}>今日问答次数</div><div style={{ color: '#fff', fontSize: 28, fontWeight: 700 }}>{overview.todayChatCount}</div></div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)', borderRadius: 16, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><CheckCircleOutlined style={{ color: '#fff', fontSize: 22 }} /></div>
          <div><div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, marginBottom: 4 }}>知识库命中率</div><div style={{ color: '#fff', fontSize: 28, fontWeight: 700 }}>{overview.knowledgeHitRate ?? 0}{overview.knowledgeHitRate == null ? '' : '%'}</div></div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #fa8c16 0%, #d46b08 100%)', borderRadius: 16, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><ScheduleOutlined style={{ color: '#fff', fontSize: 22 }} /></div>
          <div><div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, marginBottom: 4 }}>活动预约数</div><div style={{ color: '#fff', fontSize: 28, fontWeight: 700 }}>{overview.activityReserveCount}</div></div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #ff4d4f 0%, #cf1322 100%)', borderRadius: 16, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><EnvironmentOutlined style={{ color: '#fff', fontSize: 22 }} /></div>
          <div><div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, marginBottom: 4 }}>点位打卡数</div><div style={{ color: '#fff', fontSize: 28, fontWeight: 700 }}>{overview.checkinCount}</div></div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #ff7a45 0%, #d9363e 100%)', borderRadius: 16, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><BarChartOutlined style={{ color: '#fff', fontSize: 22 }} /></div>
          <div><div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, marginBottom: 4 }}>未命中问题数</div><div style={{ color: '#fff', fontSize: 28, fontWeight: 700 }}>{overview.missedQuestionCount}</div></div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #7262d3 0%, #5b4ba8 100%)', borderRadius: 16, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><ScheduleOutlined style={{ color: '#fff', fontSize: 22 }} /></div>
          <div><div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, marginBottom: 4 }}>数字人服务时长</div><div style={{ color: '#fff', fontSize: 28, fontWeight: 700 }}>{overview.digitalHumanServiceMinutes == null ? '待统计' : overview.digitalHumanServiceMinutes}</div></div>
        </div>
      </div>

      <Row gutter={[16, 16]}>
        <Col span={8}>
          <Card title="热门问题 Top 10" bordered={false} style={{ borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.04)' }}>
            {hotQuestions.length ? (
              <Table rowKey={(record, index) => `${record.question}-${index}`} size="small" pagination={false} columns={rankColumns('问题')} dataSource={hotQuestions} rowClassName={() => 'admin-table-row'} />
            ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无问答数据" />}
          </Card>
        </Col>
        <Col span={8}>
          <Card title="热门点位 Top 10" bordered={false} style={{ borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.04)' }}>
            {hotSpots.length ? (
              <Table rowKey="id" size="small" pagination={false} columns={rankColumns('点位')} dataSource={hotSpots} rowClassName={() => 'admin-table-row'} />
            ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无点位数据" />}
          </Card>
        </Col>
        <Col span={8}>
          <Card title="热门路线 Top 5" bordered={false} style={{ borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.04)' }}>
            {hotRoutes.length ? (
              <Table rowKey="id" size="small" pagination={false} columns={rankColumns('路线')} dataSource={hotRoutes} rowClassName={() => 'admin-table-row'} />
            ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无路线数据" />}
          </Card>
        </Col>

        <Col span={12}>
          <Card title="访客模式占比" bordered={false} style={{ borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.04)' }}>
            {modeDistribution.length ? modeDistribution.map(item => {
              const percent = totalModeCount ? Math.round((item.count / totalModeCount) * 100) : 0;
              return (
                <div key={item.mode} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text>{item.label}</Text>
                    <Text type="secondary">{item.count} 人次</Text>
                  </div>
                  <Progress percent={percent} size="small" />
                </div>
              );
            }) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无模式数据" />}
          </Card>
        </Col>
        <Col span={12}>
          <Card title="反馈满意度 / 情绪概览" bordered={false} style={{ borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.04)' }}>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={8}><Statistic title="反馈数" value={feedback?.feedbackCount || 0} /></Col>
              <Col span={8}><Statistic title="平均评分" value={feedback?.averageScore ?? '暂无'} /></Col>
              <Col span={8}><Statistic title="正向反馈" value={feedback?.positiveFeedback || 0} /></Col>
            </Row>
            <Space size={[8, 8]} wrap>
              {(feedback?.emotionDistribution || []).map(item => (
                <Tag key={item.emotion} color={item.emotion === 'positive' ? 'green' : item.emotion === 'negative' ? 'red' : 'blue'}>
                  {item.label}：{item.count}
                </Tag>
              ))}
              {!feedback?.emotionDistribution?.length && <Text type="secondary">暂无情绪数据</Text>}
            </Space>
          </Card>
        </Col>
      </Row>
      <style>{`.admin-table-row { transition: background 0.2s; } .admin-table-row:hover { background: #fafcff !important; } .admin-table-row td { padding-top: 14px !important; padding-bottom: 14px !important; }`}</style>
    </div>
  );
}
