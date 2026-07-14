import { useEffect, useState } from 'react';
import { Button, Drawer, Input, Rate, Select, Space, Table, Tag, Typography, message, Descriptions, Divider } from 'antd';
import { MessageOutlined, ReloadOutlined, SearchOutlined, EyeOutlined, CheckCircleOutlined, CloseCircleOutlined, RedoOutlined } from '@ant-design/icons';
import request from '@/utils/request';

const { Title, Text } = Typography;

interface UserFeedback {
  id: number;
  sessionId: string;
  userMode: string;
  score: number;
  feedbackType: string;
  rawFeedbackType?: string;
  feedbackContent: string;
  adminReply?: string;
  replyTime?: string;
  status: string;
  createTime: string;
}

// ---- Mappings ----

const userModeLabels: Record<string, string> = {
  fresh: '新生', alumni: '校友', parent: '家长', research: '研学访客', senior: '长者', guest: '普通游客',
};

const userModeOptions = [
  { value: '', label: '全部身份' },
  { value: 'fresh', label: '新生' }, { value: 'alumni', label: '校友' }, { value: 'parent', label: '家长' },
  { value: 'research', label: '研学访客' }, { value: 'senior', label: '长者' },
];

const statusLabelMap: Record<string, string> = {
  pending: '待处理', unprocessed: '待处理', processed: '已处理', resolved: '已处理', completed: '已处理', closed: '已关闭',
};

const statusColorMap: Record<string, string> = {
  pending: 'processing', unprocessed: 'processing', processed: 'success', resolved: 'success', completed: 'success', closed: 'default',
};

const statusOptions = [
  { value: '', label: '全部状态' },
  { value: 'pending', label: '待处理' }, { value: 'processed', label: '已处理' }, { value: 'closed', label: '已关闭' },
];

const feedbackTypeLabels: Record<string, string> = {
  guide: '导览体验', map: '地图导航', activity: '活动预约', digital_human: '数字人服务', account: '账号问题', content: '内容问题', other: '其他',
};

const feedbackTypeOptions = [
  { value: '', label: '全部类型' },
  { value: 'guide', label: '导览体验' }, { value: 'map', label: '地图导航' }, { value: 'activity', label: '活动预约' },
  { value: 'digital_human', label: '数字人服务' }, { value: 'account', label: '账号问题' }, { value: 'content', label: '内容问题' }, { value: 'other', label: '其他' },
];

const ratingOptions = [
  { value: '', label: '全部评分' },
  { value: 'high', label: '高分反馈（4-5分）' }, { value: 'medium', label: '一般反馈（3分）' }, { value: 'low', label: '低分反馈（1-2分）' },
];

const getErrorMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

// ---- Component ----

export default function FeedbackManagement() {
  const [loading, setLoading] = useState(false);
  const [feedbacks, setFeedbacks] = useState<UserFeedback[]>([]);
  const [userMode, setUserMode] = useState('');
  const [status, setStatus] = useState('');
  const [feedbackType, setFeedbackType] = useState('');
  const [ratingLevel, setRatingLevel] = useState('');
  const [keyword, setKeyword] = useState('');
  const [replying, setReplying] = useState<UserFeedback | null>(null);
  const [replyText, setReplyText] = useState('');
  const [saving, setSaving] = useState(false);
  const [detailItem, setDetailItem] = useState<UserFeedback | null>(null);
  const [stats, setStats] = useState({ total: 0, pending: 0, processed: 0, closed: 0 });

  useEffect(() => {
    fetchFeedbacks();
  }, [userMode, status, feedbackType, ratingLevel]);

  const fetchFeedbacks = async () => {
    setLoading(true);
    try {
      const result = (await request.get('/feedback/admin/list', {
        params: {
          userMode: userMode || undefined, status: status || undefined,
          feedbackType: feedbackType || undefined, ratingLevel: ratingLevel || undefined, keyword: keyword || undefined,
        },
      })) as any;
      const list: UserFeedback[] = result.data || [];
      setFeedbacks(list);
      setStats({
        total: list.length,
        pending: list.filter(f => f.status === 'pending').length,
        processed: list.filter(f => f.status === 'processed').length,
        closed: list.filter(f => f.status === 'closed').length,
      });
    } catch (error) {
      message.error('反馈数据加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => fetchFeedbacks();

  const handleReset = () => {
    setUserMode(''); setStatus(''); setFeedbackType(''); setRatingLevel(''); setKeyword('');
    setTimeout(() => fetchFeedbacks(), 0);
  };

  const submitReply = async () => {
    if (!replying || !replyText.trim()) { message.warning('请输入回复内容'); return; }
    setSaving(true);
    try {
      await request.put(`/feedback/admin/${replying.id}/reply`, null, { params: { adminReply: replyText } });
      message.success('回复已保存');
      setReplying(null); setReplyText('');
      fetchFeedbacks();
    } catch (error) { message.error(getErrorMessage(error, '回复保存失败')); }
    finally { setSaving(false); }
  };

  const markAsProcessed = async (record: UserFeedback) => {
    try {
      await request.put(`/feedback/admin/${record.id}/reply`, null, { params: { adminReply: record.adminReply || '已处理' } });
      message.success('已标记为已处理');
      fetchFeedbacks();
    } catch (error) { message.error(getErrorMessage(error, '操作失败')); }
  };

  const closeFeedback = async (record: UserFeedback) => {
    try {
      await request.put(`/feedback/admin/${record.id}/reply`, null, { params: { adminReply: record.adminReply || '已关闭' } });
      message.success('反馈已关闭');
      fetchFeedbacks();
    } catch (error) { message.error(getErrorMessage(error, '操作失败')); }
  };

  const reopenFeedback = async (record: UserFeedback) => {
    try {
      await request.put(`/feedback/admin/${record.id}/reply`, null, { params: { adminReply: '' } });
      message.success('反馈已重新打开');
      fetchFeedbacks();
    } catch (error) { message.error(getErrorMessage(error, '操作失败')); }
  };

  const columns = [
    { title: '用户', dataIndex: 'userMode', key: 'userMode', width: 90, render: (v: string) => <Tag>{userModeLabels[v] || v || '未知'}</Tag> },
    { title: '反馈类型', dataIndex: 'feedbackType', key: 'feedbackType', width: 110, render: (v: string) => <Tag color="blue">{feedbackTypeLabels[v] || v || '其他'}</Tag> },
    { title: '评分', dataIndex: 'score', key: 'score', width: 140, render: (v: number) => <Rate disabled value={v} /> },
    { title: '内容摘要', dataIndex: 'feedbackContent', key: 'feedbackContent', ellipsis: true, render: (v: string) => v || '-' },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: (v: string) => {
        const label = statusLabelMap[v] || v || '未知';
        const color = statusColorMap[v] || 'default';
        const icon = v === 'pending' || v === 'unprocessed' ? <ReloadOutlined spin /> :
          v === 'processed' || v === 'resolved' || v === 'completed' ? <CheckCircleOutlined /> : <CloseCircleOutlined />;
        return <Tag color={color} icon={icon} style={{ padding: '0 8px', borderRadius: 12 }}>{label}</Tag>;
      },
    },
    { title: '提交时间', dataIndex: 'createTime', key: 'createTime', width: 150, render: (v: string) => v ? v.replace('T', ' ').slice(0, 16) : '-' },
    { title: '回复', dataIndex: 'adminReply', key: 'adminReply', width: 120, ellipsis: true, render: (v: string) => v ? <Text style={{ color: '#52c41a' }}>{v}</Text> : <Text type="secondary">暂无</Text> },
    {
      title: '操作', key: 'action', width: 220,
      render: (_: unknown, record: UserFeedback) => (
        <Space size="small" wrap>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setDetailItem(record)}>详情</Button>
          <Button type="link" size="small" icon={<MessageOutlined />} onClick={() => { setReplying(record); setReplyText(record.adminReply || ''); }}>回复</Button>
          {record.status === 'pending' && <Button type="link" size="small" icon={<CheckCircleOutlined />} onClick={() => markAsProcessed(record)}>标记已处理</Button>}
          {record.status === 'processed' && <Button type="link" size="small" danger icon={<CloseCircleOutlined />} onClick={() => closeFeedback(record)}>关闭</Button>}
          {record.status === 'closed' && <Button type="link" size="small" icon={<RedoOutlined />} onClick={() => reopenFeedback(record)}>重新打开</Button>}
        </Space>
      ),
    },
  ];

  const statCards = [
    { key: '', label: '全部反馈', count: stats.total, color: '#1677ff', gradient: 'linear-gradient(135deg, #f0f5ff 0%, #e6f0ff 100%)' },
    { key: 'pending', label: '待处理', count: stats.pending, color: '#fa8c16', gradient: 'linear-gradient(135deg, #fff7e6 0%, #fff3d9 100%)' },
    { key: 'processed', label: '已处理', count: stats.processed, color: '#52c41a', gradient: 'linear-gradient(135deg, #f6ffed 0%, #eeffdd 100%)' },
    { key: 'closed', label: '已关闭', count: stats.closed, color: '#8c8c8c', gradient: 'linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%)' },
  ];

  const statIcons: Record<string, React.ReactNode> = {
    '': <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1677ff" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
    pending: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fa8c16" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    processed: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#52c41a" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
    closed: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8c8c8c" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>,
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="admin-toolbar" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg, #1677ff, #4096ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(22,119,255,0.25)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
          <div>
            <Title level={4} style={{ margin: 0, color: '#0f344e' }}>反馈管理</Title>
            <Text type="secondary" style={{ fontSize: 13 }}>查看、筛选和回复用户反馈</Text>
          </div>
        </div>
        <Button icon={<ReloadOutlined />} onClick={fetchFeedbacks} style={{ borderRadius: 10, fontWeight: 600 }}>刷新</Button>
      </div>

      {/* 统计卡 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 16, marginBottom: 20 }}>
        {statCards.map(card => (
          <div
            key={card.key}
            style={{
              cursor: 'default',
              background: card.gradient,
              borderRadius: 16,
              padding: '20px 24px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.03)',
              border: '1px solid rgba(0,0,0,0.04)',
              transition: 'all 0.3s',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <div style={{ width: 48, height: 48, borderRadius: 14, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', flexShrink: 0 }}>
              {statIcons[card.key]}
            </div>
            <div style={{ minWidth: 0 }}>
              <Text type="secondary" style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 2 }}>{card.label}</Text>
              <div style={{ fontSize: 30, fontWeight: 800, color: card.color, lineHeight: 1 }}>{card.count}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 筛选区与表格 */}
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.04)' }}>
        <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <Space wrap size="middle">
            <Select value={status} onChange={setStatus} style={{ width: 130, borderRadius: 10 }} options={statusOptions} />
            <Select value={feedbackType} onChange={setFeedbackType} style={{ width: 140, borderRadius: 10 }} options={feedbackTypeOptions} />
            <Select value={ratingLevel} onChange={setRatingLevel} style={{ width: 170, borderRadius: 10 }} options={ratingOptions} />
            <Select value={userMode} onChange={setUserMode} style={{ width: 130, borderRadius: 10 }} options={userModeOptions} />
            <Input
              placeholder="关键词搜索" style={{ width: 200, borderRadius: 10 }} allowClear
              value={keyword} onChange={e => setKeyword(e.target.value)} onPressEnter={handleSearch}
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            />
          </Space>
          <Space>
            <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch} style={{ borderRadius: 10, fontWeight: 600, boxShadow: '0 2px 8px rgba(22,119,255,0.2)' }}>搜索</Button>
            <Button onClick={handleReset} style={{ borderRadius: 10, fontWeight: 600 }}>重置</Button>
          </Space>
        </div>

        <div className="admin-panel">
          <Table rowKey="id" loading={loading} columns={columns} dataSource={feedbacks} scroll={{ x: 1100 }}
            pagination={{ showSizeChanger: true, showTotal: total => `共 ${total} 条反馈`, pageSizeOptions: ['10', '20', '50'] }}
            rowClassName={() => 'admin-table-row'} />
        </div>
      </div>

      {/* Reply Drawer */}
      <Drawer
        title={<span style={{ fontSize: 17, fontWeight: 700 }}><MessageOutlined style={{ marginRight: 8 }} />回复反馈</span>}
        open={!!replying} onClose={() => setReplying(null)} width={480}
        styles={{ header: { borderBottom: '1px solid #f0f0f0', padding: '20px 24px' }, body: { padding: '20px 24px' } }}
        extra={<Space><Button onClick={() => setReplying(null)} style={{ borderRadius: 8 }}>取消</Button><Button type="primary" loading={saving} onClick={submitReply} style={{ borderRadius: 8, fontWeight: 600 }}>提交回复</Button></Space>}>
        <Descriptions column={1} size="small" bordered style={{ marginBottom: 20 }}
          labelStyle={{ fontWeight: 600, color: '#8c8c8c', fontSize: 12, padding: '10px 14px' }}
          contentStyle={{ padding: '10px 14px' }}>
          <Descriptions.Item label="反馈类型"><Tag color="blue" style={{ borderRadius: 6 }}>{feedbackTypeLabels[replying?.feedbackType || ''] || replying?.feedbackType || '其他'}</Tag></Descriptions.Item>
          <Descriptions.Item label="评分"><Rate disabled value={replying?.score || 0} /></Descriptions.Item>
          <Descriptions.Item label="状态"><Tag color={statusColorMap[replying?.status || ''] || 'default'} style={{ borderRadius: 6 }}>{statusLabelMap[replying?.status || ''] || replying?.status || '未知'}</Tag></Descriptions.Item>
          <Descriptions.Item label="用户身份">{userModeLabels[replying?.userMode || ''] || replying?.userMode || '未知'}</Descriptions.Item>
        </Descriptions>
        <div style={{ marginBottom: 20 }}>
          <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>反馈内容</Text>
          <div style={{ background: '#f7f8fa', borderRadius: 12, padding: 14, whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: 13, color: '#595959' }}>{replying?.feedbackContent || '-'}</div>
        </div>
        <div>
          <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>管理员回复</Text>
          <Input.TextArea rows={5} value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="请输入回复内容，用户将会收到回复通知..." style={{ borderRadius: 10, fontSize: 13 }} />
        </div>
      </Drawer>

      {/* Detail Drawer */}
      <Drawer
        title={<span style={{ fontSize: 17, fontWeight: 700 }}><EyeOutlined style={{ marginRight: 8 }} />反馈详情</span>}
        open={!!detailItem} onClose={() => setDetailItem(null)} width={520}
        styles={{ header: { borderBottom: '1px solid #f0f0f0', padding: '20px 24px' }, body: { padding: '20px 24px' } }}>
        {detailItem && (
          <>
            <Descriptions column={1} size="small" bordered style={{ marginBottom: 20 }}
              labelStyle={{ fontWeight: 600, color: '#8c8c8c', fontSize: 12, padding: '10px 14px' }}
              contentStyle={{ padding: '10px 14px' }}>
              <Descriptions.Item label="反馈编号">{detailItem.id}</Descriptions.Item>
              <Descriptions.Item label="用户会话">{detailItem.sessionId}</Descriptions.Item>
              <Descriptions.Item label="用户身份"><Tag style={{ borderRadius: 6 }}>{userModeLabels[detailItem.userMode] || detailItem.userMode || '未知'}</Tag></Descriptions.Item>
              <Descriptions.Item label="反馈类型"><Tag color="blue" style={{ borderRadius: 6 }}>{feedbackTypeLabels[detailItem.feedbackType] || detailItem.feedbackType || '其他'}</Tag></Descriptions.Item>
              <Descriptions.Item label="评分"><Rate disabled value={detailItem.score || 0} /></Descriptions.Item>
              <Descriptions.Item label="当前状态"><Tag color={statusColorMap[detailItem.status] || 'default'} style={{ borderRadius: 6 }}>{statusLabelMap[detailItem.status] || detailItem.status || '未知'}</Tag></Descriptions.Item>
              <Descriptions.Item label="提交时间">{detailItem.createTime ? detailItem.createTime.replace('T', ' ').slice(0, 16) : '-'}</Descriptions.Item>
              {detailItem.replyTime && <Descriptions.Item label="处理时间">{detailItem.replyTime.replace('T', ' ').slice(0, 16)}</Descriptions.Item>}
            </Descriptions>
            <Divider style={{ margin: '16px 0' }} />
            <div style={{ marginBottom: 20 }}>
              <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 8 }}>反馈完整内容</Text>
              <div style={{ background: '#f7f8fa', borderRadius: 12, padding: 16, whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: 13, color: '#595959' }}>{detailItem.feedbackContent || '（无内容）'}</div>
            </div>
            <div>
              <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 8 }}>管理员回复</Text>
              <div style={{
                background: detailItem.adminReply ? 'linear-gradient(135deg, #f6ffed, #eeffdd)' : 'linear-gradient(135deg, #fffbe6, #fff7cc)',
                borderRadius: 12, padding: 16, whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: 13,
                border: detailItem.adminReply ? '1px solid #d9f7be' : '1px solid #ffe58f',
                color: detailItem.adminReply ? '#135200' : '#ad6800',
              }}>{detailItem.adminReply || '（暂未回复）'}</div>
            </div>
          </>
        )}
      </Drawer>

      <style>{`.admin-table-row { transition: background 0.2s; } .admin-table-row:hover { background: #fafcff !important; } .admin-table-row td { padding-top: 14px !important; padding-bottom: 14px !important; }`}</style>
    </div>
  );
}
