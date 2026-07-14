import { useEffect, useState } from 'react';
import {
  Card,
  Col,
  Empty,
  Progress,
  Row,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
  Button,
} from 'antd';
import {
  BarChartOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CommentOutlined,
  DashboardOutlined,
  EnvironmentOutlined,
  ExclamationCircleOutlined,
  ScheduleOutlined,
  TeamOutlined,
  UserOutlined,
  CompassOutlined,
  AuditOutlined,
  CalendarOutlined,
  RightOutlined,
  FileTextOutlined,
  QuestionCircleOutlined,
  RiseOutlined,
} from '@ant-design/icons';
import {
  getDashboardOverview,
  type DashboardOverview,
  type ModeDistributionItem,
  type RankItem,
} from '@/api/dashboard';
import { useNavigate } from 'react-router-dom';
import request from '@/utils/request';

const { Title, Text } = Typography;

interface TrendItem {
  date: string;
  visits?: number;
  questions?: number;
}

interface DataScreenAnalysis {
  visitTrend: TrendItem[];
  chatTrend: TrendItem[];
  hotSpots: RankItem[];
  hotRoutes: RankItem[];
  hotQuestions: { question: string; count: number }[];
  userModeDistribution: ModeDistributionItem[];
  feedbackStatusDistribution: { key: string; label: string; count: number }[];
  feedbackTypeDistribution: { key: string; label: string; count: number }[];
  knowledgeHitRate: number | null;
  missedQuestionCount: number;
}

interface DataScreenResponse {
  coreMetrics: Record<string, number>;
  analysis: DataScreenAnalysis;
}

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

const statusLabelMap: Record<string, string> = {
  pending: '待处理',
  processed: '已处理',
  closed: '已关闭',
};

const feedbackTypeLabelMap: Record<string, string> = {
  guide: '导览体验',
  map: '地图导航',
  activity: '活动预约',
  digital_human: '数字人服务',
  account: '账号问题',
  content: '内容问题',
  other: '其他',
};

const modeLabelMap: Record<string, string> = {
  fresh: '新生',
  alumni: '校友',
  parent: '家长',
  research: '研学访客',
  guest: '普通游客',
  senior: '长者',
};

// Mini trend chart component using pure CSS bars
function MiniTrendBars({ data, dataKey, color }: { data: TrendItem[]; dataKey: 'visits' | 'questions'; color: string }) {
  if (!data || data.length === 0) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无趋势数据" />;
  const values = data.map(d => (d[dataKey] as number) || 0);
  const maxVal = Math.max(...values, 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 100, padding: '4px 0' }}>
      {data.map((item, i) => {
        const h = Math.max(4, Math.round(((item[dataKey] as number) || 0) / maxVal * 96));
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <Text style={{ fontSize: 9, color: '#8c8c8c' }}>{(item[dataKey] as number) || 0}</Text>
            <div
              style={{
                width: '100%',
                height: h,
                background: color,
                borderRadius: '4px 4px 2px 2px',
                minWidth: 12,
                transition: 'height 0.3s',
              }}
              title={`${item.date}: ${item[dataKey]}`}
            />
            <Text style={{ fontSize: 8, color: '#bfbfbf' }}>{item.date?.slice(5) || ''}</Text>
          </div>
        );
      })}
    </div>
  );
}

export default function OperationsOverview() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [overview, setOverview] = useState<DashboardOverview>(emptyOverview);
  const [dataScreen, setDataScreen] = useState<DataScreenResponse | null>(null);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [overviewRes, dataScreenRes] = await Promise.all([
        getDashboardOverview(),
        request.get('/admin/dashboard/data-screen') as any,
      ]);
      // Overview
      if (overviewRes?.data) {
        setOverview({ ...emptyOverview, ...overviewRes.data });
      }
      // Data screen
      if (dataScreenRes?.data) {
        setDataScreen(dataScreenRes.data as DataScreenResponse);
      }
    } catch (error) {
      console.error('运营总览加载失败:', error);
      message.error('运营总览数据加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const coreMetrics = dataScreen?.coreMetrics || {};
  const analysis = dataScreen?.analysis;

  const metrics = [
    { key: 'todayServicePeople', title: '今日服务人次', icon: <TeamOutlined />, color: '#1677ff' },
    { key: 'todayChatCount', title: '今日问答次数', icon: <CommentOutlined />, color: '#52c41a' },
    { key: 'registeredUsers', title: '注册用户数', icon: <UserOutlined />, color: '#722ed1' },
    { key: 'sessionUsers', title: '访问会话数', icon: <BarChartOutlined />, color: '#13c2c2' },
    { key: 'checkinCount', title: '点位打卡数', icon: <CheckCircleOutlined />, color: '#fa8c16' },
    { key: 'activityReserveCount', title: '活动预约数', icon: <ScheduleOutlined />, color: '#eb2f96' },
    { key: 'pendingFeedbackCount', title: '待处理反馈', icon: <ExclamationCircleOutlined />, color: '#ff4d4f' },
    { key: 'pendingApplicationCount', title: '待审核申请', icon: <AuditOutlined />, color: '#faad14' },
  ];

  const rankColumns = (nameTitle: string) => [
    {
      title: '排名',
      key: 'rank',
      width: 50,
      render: (_: unknown, __: unknown, index: number) => (
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 22, height: 22, borderRadius: '50%',
          background: index < 3 ? '#1677ff' : '#f0f0f0',
          color: index < 3 ? '#fff' : '#8c8c8c',
          fontSize: 12, fontWeight: 700,
        }}>{index + 1}</span>
      ),
    },
    {
      title: nameTitle,
      dataIndex: 'name',
      key: 'name',
      render: (value: string, record: any) => value || record.question || '暂无',
    },
    {
      title: '热度',
      dataIndex: 'count',
      key: 'count',
      width: 70,
      render: (value: number) => <Tag color="blue">{value}</Tag>,
    },
  ];

  const totalModeCount = (analysis?.userModeDistribution || []).reduce((sum, item) => sum + item.count, 0);

  if (loading && !dataScreen) {
    return <div style={{ textAlign: 'center', padding: '100px 0' }}><Spin size="large" tip="加载运营数据中..." /></div>;
  }

  return (
    <div>
      {/* Page Header */}
      <div className="admin-toolbar" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14,
            background: 'linear-gradient(135deg, #1890ff, #096dd9)',
            boxShadow: '0 4px 12px rgba(24,144,255,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <DashboardOutlined style={{ color: '#fff', fontSize: 24 }} />
          </div>
          <div>
            <Title level={4} style={{ margin: 0, color: '#0f344e' }}>运营总览</Title>
            <Text type="secondary" style={{ fontSize: 13 }}>实时掌握山海大学数字人导览平台核心运营数据</Text>
          </div>
        </div>
      </div>

      {/* Section 1: Core Metrics */}
      <Card
                title={<><RiseOutlined style={{ color: '#1677ff', marginRight: 8, fontSize: 18 }} /><span style={{ fontSize: 18, fontWeight: 'bold' }}>核心指标</span></>}
                bordered={false}
                style={{ marginBottom: 24, borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.04)' }}
              >
        <Row gutter={[16, 16]}>
          {metrics.map(m => (
            <Col xs={12} sm={12} md={6} key={m.key}>
              <Card
                bordered={false}
                hoverable
                className="metric-card"
                style={{
                  background: `linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)`,
                  borderRadius: 16,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                  overflow: 'hidden',
                  position: 'relative',
                }}
                styles={{ body: { padding: '20px 24px' } }}
              >
                <div style={{
                  position: 'absolute', right: -20, top: -20, fontSize: 80, opacity: 0.05, color: m.color
                }}>
                  {m.icon}
                </div>
                <Statistic
                  title={<Text style={{ fontSize: 13, color: '#8c8c8c', fontWeight: 500 }}>{m.title}</Text>}
                  value={Number(coreMetrics[m.key]) || overview[m.key as keyof DashboardOverview] || 0}
                  prefix={
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', justifyItems: 'center',
                      background: `${m.color}15`, color: m.color,
                      padding: 8, borderRadius: 12, marginRight: 12,
                    }}>
                      <span style={{ fontSize: 20, display: 'flex' }}>{m.icon}</span>
                    </div>
                  }
                  valueStyle={{ fontSize: 32, fontWeight: 800, color: '#1a1a1a', fontFamily: 'system-ui' }}
                />
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      <Row gutter={[20, 20]} style={{ marginBottom: 20 }}>
        {/* Section 2: Operation Trends */}
        <Col xs={24} lg={14}>
          <Card
            title={<><RiseOutlined style={{ color: '#1677ff', marginRight: 8, fontSize: 18 }} /><span style={{ fontSize: 18, fontWeight: 'bold' }}>运营趋势（近 7 天）</span></>}
            bordered={false}
            style={{ borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.04)', height: '100%' }}
          >
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Text strong style={{ fontSize: 13, color: '#595959' }}>访问趋势</Text>
                <MiniTrendBars
                  data={analysis?.visitTrend || []}
                  dataKey="visits"
                  color="#1677ff"
                />
              </Col>
              <Col span={24}>
                <Text strong style={{ fontSize: 13, color: '#595959' }}>问答趋势</Text>
                <MiniTrendBars
                  data={analysis?.chatTrend || []}
                  dataKey="questions"
                  color="#52c41a"
                />
              </Col>
            </Row>
          </Card>
        </Col>

        {/* Section 4: User & Service Analysis (alongside trends) */}
        <Col xs={24} lg={10}>
          <Card
            title={<><FileTextOutlined style={{ color: '#1677ff', marginRight: 8, fontSize: 18 }} /><span style={{ fontSize: 18, fontWeight: 'bold' }}>用户与服务分析</span></>}
            bordered={false}
            style={{ borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.04)', height: '100%' }}
          >
            {/* Knowledge hit rate */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text>知识库命中率</Text>
                <Text strong style={{ color: '#1677ff' }}>
                  {analysis?.knowledgeHitRate != null ? `${analysis.knowledgeHitRate}%` : `${overview.knowledgeHitRate ?? 0}%`}
                </Text>
              </div>
              <Progress
                percent={Number(analysis?.knowledgeHitRate ?? overview.knowledgeHitRate ?? 0)}
                size="small"
                strokeColor="#1677ff"
              />
              <Text type="secondary" style={{ fontSize: 11 }}>
                未命中问题：{analysis?.missedQuestionCount ?? overview.missedQuestionCount ?? 0} 个
              </Text>
            </div>

            {/* User mode distribution */}
            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ fontSize: 13 }}>用户模式占比</Text>
              {(analysis?.userModeDistribution || []).length > 0 ? (
                analysis!.userModeDistribution.map(item => {
                  const percent = totalModeCount ? Math.round((item.count / totalModeCount) * 100) : 0;
                  return (
                    <div key={item.mode} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ fontSize: 12 }}>{modeLabelMap[item.mode] || item.label}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>{item.count} 人</Text>
                      </div>
                      <Progress percent={percent} size="small" />
                    </div>
                  );
                })
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无用户数据" />
              )}
            </div>

            {/* Feedback status */}
            <div style={{ marginBottom: 8 }}>
              <Text strong style={{ fontSize: 13 }}>反馈状态分布</Text>
              <div style={{ marginTop: 8 }}>
                {(analysis?.feedbackStatusDistribution || []).map(item => (
                  <Tag key={item.key} color={item.key === 'pending' ? 'orange' : item.key === 'processed' ? 'green' : 'default'}>
                    {statusLabelMap[item.key] || item.label}：{item.count}
                  </Tag>
                ))}
                {(!analysis?.feedbackStatusDistribution || analysis.feedbackStatusDistribution.length === 0) && (
                  <Text type="secondary">暂无反馈数据</Text>
                )}
              </div>
            </div>

            {/* Feedback type distribution */}
            <div>
              <Text strong style={{ fontSize: 13 }}>反馈类型分布</Text>
              <div style={{ marginTop: 8 }}>
                {(analysis?.feedbackTypeDistribution || []).map(item => (
                  <Tag key={item.key} color="blue">
                    {feedbackTypeLabelMap[item.key] || item.label}：{item.count}
                  </Tag>
                ))}
                {(!analysis?.feedbackTypeDistribution || analysis.feedbackTypeDistribution.length === 0) && (
                  <Text type="secondary">暂无反馈数据</Text>
                )}
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Section 3: Content Popularity */}
      <Row gutter={[20, 20]} style={{ marginBottom: 20 }}>
        <Col xs={24} md={8}>
          <Card
            title={<><EnvironmentOutlined style={{ color: '#1677ff', marginRight: 8, fontSize: 18 }} /><span style={{ fontSize: 18, fontWeight: 'bold' }}>热门点位 Top 10</span></>}
            bordered={false}
            style={{ borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.04)' }}
          >
            {(analysis?.hotSpots || []).length > 0 ? (
              <Table
                rowKey="id"
                size="small"
                pagination={false}
                rowClassName={() => 'admin-table-row'}
                columns={rankColumns('点位名称')}
                dataSource={analysis?.hotSpots || []}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无打卡数据" />
            )}
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card
            title={<><CompassOutlined style={{ color: '#52c41a', marginRight: 8, fontSize: 18 }} /><span style={{ fontSize: 18, fontWeight: 'bold' }}>热门路线 Top 5</span></>}
            bordered={false}
            style={{ borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.04)' }}
          >
            {(analysis?.hotRoutes || []).length > 0 ? (
              <Table
                rowKey="id"
                size="small"
                pagination={false}
                rowClassName={() => 'admin-table-row'}
                columns={rankColumns('路线名称')}
                dataSource={analysis?.hotRoutes || []}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无路线数据" />
            )}
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card
            title={<><QuestionCircleOutlined style={{ color: '#fa8c16', marginRight: 8, fontSize: 18 }} /><span style={{ fontSize: 18, fontWeight: 'bold' }}>热门问题 Top 10</span></>}
            bordered={false}
            style={{ borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.04)' }}
          >
            {(analysis?.hotQuestions || []).length > 0 ? (
              <Table
                rowKey={(record, index) => `${record.question}-${index}`}
                size="small"
                pagination={false}
                rowClassName={() => 'admin-table-row'}
                columns={rankColumns('问题内容')}
                dataSource={analysis?.hotQuestions || []}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无问答数据" />
            )}
          </Card>
        </Col>
      </Row>

      {/* Section 5: Admin Todos */}
      <Card
        title={<><ClockCircleOutlined style={{ color: '#ff4d4f', marginRight: 8, fontSize: 18 }} /><span style={{ fontSize: 18, fontWeight: 'bold' }}>管理待办</span></>}
        bordered={false}
        style={{ borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.04)' }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 16 }}>
          <Card
            bordered={false}
            style={{ background: 'linear-gradient(135deg, #fff7e6 0%, #ffffff 100%)', borderRadius: 16, border: '1px solid rgba(250,140,22,0.08)', cursor: 'pointer' }}
            styles={{ body: { padding: '20px' } }}
            onClick={() => navigate('/feedback?status=pending')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                flexShrink: 0,
              }}>
                <ExclamationCircleOutlined style={{ color: '#fa8c16', fontSize: 24 }} />
              </div>
              <div>
                <Text style={{ fontSize: 13, color: '#8c8c8c' }}>待处理反馈</Text>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#1a1a1a' }}>{Number(coreMetrics.pendingFeedbackCount) || 0}</div>
              </div>
            </div>
            <Button type="link" size="small" style={{ padding: 0 }}>
              前往处理 <RightOutlined />
            </Button>
          </Card>
          <Card
            bordered={false}
            style={{ background: 'linear-gradient(135deg, #fffbe6 0%, #ffffff 100%)', borderRadius: 16, border: '1px solid rgba(250,173,20,0.08)', cursor: 'pointer' }}
            styles={{ body: { padding: '20px' } }}
            onClick={() => navigate('/applications')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                flexShrink: 0,
              }}>
                <AuditOutlined style={{ color: '#faad14', fontSize: 24 }} />
              </div>
              <div>
                <Text style={{ fontSize: 13, color: '#8c8c8c' }}>待审核点位申请</Text>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#1a1a1a' }}>{Number(coreMetrics.pendingApplicationCount) || 0}</div>
              </div>
            </div>
            <Button type="link" size="small" style={{ padding: 0 }}>
              前往审核 <RightOutlined />
            </Button>
          </Card>
          <Card
            bordered={false}
            style={{ background: 'linear-gradient(135deg, #e6f7ff 0%, #ffffff 100%)', borderRadius: 16, border: '1px solid rgba(22,119,255,0.08)', cursor: 'pointer' }}
            styles={{ body: { padding: '20px' } }}
            onClick={() => navigate('/applications?type=route')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                flexShrink: 0,
              }}>
                <CompassOutlined style={{ color: '#1677ff', fontSize: 24 }} />
              </div>
              <div>
                <Text style={{ fontSize: 13, color: '#8c8c8c' }}>待审核路线申请</Text>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#1a1a1a' }}>{Number(coreMetrics.pendingRouteApplicationCount) || Number(coreMetrics.pendingApplicationCount) || 0}</div>
              </div>
            </div>
            <Button type="link" size="small" style={{ padding: 0 }}>
              前往审核 <RightOutlined />
            </Button>
          </Card>
          <Card
            bordered={false}
            style={{ background: 'linear-gradient(135deg, #f6ffed 0%, #ffffff 100%)', borderRadius: 16, border: '1px solid rgba(82,196,26,0.08)', cursor: 'pointer' }}
            styles={{ body: { padding: '20px' } }}
            onClick={() => navigate('/activities')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                flexShrink: 0,
              }}>
                <CalendarOutlined style={{ color: '#52c41a', fontSize: 24 }} />
              </div>
              <div>
                <Text style={{ fontSize: 13, color: '#8c8c8c' }}>即将开始的活动</Text>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#1a1a1a' }}>{Number(coreMetrics.upcomingActivityCount) || 0}</div>
              </div>
            </div>
            <Button type="link" size="small" style={{ padding: 0 }}>
              查看活动 <RightOutlined />
            </Button>
          </Card>
        </div>
      </Card>
      <style>{`.admin-table-row { transition: background 0.2s; } .admin-table-row:hover { background: #fafcff !important; } .admin-table-row td { padding-top: 14px !important; padding-bottom: 14px !important; }`}</style>
    </div>
  );
}
