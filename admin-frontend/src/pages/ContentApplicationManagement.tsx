import { useEffect, useState } from 'react';
import { Button, DatePicker, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, Typography, message } from 'antd';
import { AuditOutlined, CheckOutlined, CloseOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { approveApplication, getApplications, rejectApplication, type ContentApplication } from '@/api/application';
import { getSpots, type CampusSpot } from '@/api/spot';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const statusOptions = [
  { value: 0, label: '待审核' },
  { value: 1, label: '已通过' },
  { value: 2, label: '已拒绝' },
  { value: 3, label: '已撤回' },
];

const appTypeOptions = [
  { value: 'spot', label: '点位申请' },
  { value: 'route', label: '路线申请' },
];

const spotTypes = ['教学场馆', '宿舍生活区', '餐饮美食', '便民服务', '运动场地', '绿化景观'];
const userModes = [
  { value: 'fresh', label: '新生' },
  { value: 'alumni', label: '校友' },
  { value: 'parent', label: '家长' },
  { value: 'research', label: '访客' },
  { value: 'senior', label: '长者' },
];

const statusColor = (status: number) => {
  if (status === 0) return 'processing';
  if (status === 1) return 'success';
  if (status === 2) return 'error';
  if (status === 3) return 'default';
  return 'default';
};

const getErrorMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

export default function ContentApplicationManagement() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [applications, setApplications] = useState<ContentApplication[]>([]);
  const [stats, setStats] = useState({ total: 0, pendingSpot: 0, pendingRoute: 0, approvedCount: 0, rejectedCount: 0 });
  const [spots, setSpots] = useState<CampusSpot[]>([]);

  // 筛选条件
  const [applicationType, setApplicationType] = useState<string>();
  const [status, setStatus] = useState<number | undefined>();
  const [keyword, setKeyword] = useState('');
  const [applicant, setApplicant] = useState('');
  const [dateRange, setDateRange] = useState<[string, string] | null>(null);

  const [editing, setEditing] = useState<ContentApplication | null>(null);
  const [rejecting, setRejecting] = useState<ContentApplication | null>(null);
  const [detailRecord, setDetailRecord] = useState<ContentApplication | null>(null);
  const [form] = Form.useForm();
  const [rejectForm] = Form.useForm();

  useEffect(() => {
    fetchApplications();
    fetchSpots();
  }, [applicationType, status]);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const result = await getApplications(
        applicationType,
        status,
        keyword || undefined,
        applicant || undefined,
        dateRange?.[0],
        dateRange?.[1],
      ) as any;
      const data = result.data || [];
      const records: ContentApplication[] = Array.isArray(data) ? data : data.records || [];
      setApplications(records);
      if (!Array.isArray(data) && data.stats) {
        const s = data.stats;
        setStats({
          total: records.length,
          pendingSpot: s.pendingSpot ?? 0,
          pendingRoute: s.pendingRoute ?? 0,
          approvedCount: s.approvedCount ?? 0,
          rejectedCount: s.rejectedCount ?? 0,
        });
      } else {
        setStats({
          total: records.length,
          pendingSpot: records.filter(r => r.applicationType === 'spot' && r.status === 0).length,
          pendingRoute: records.filter(r => r.applicationType === 'route' && r.status === 0).length,
          approvedCount: records.filter(r => r.status === 1).length,
          rejectedCount: records.filter(r => r.status === 2).length,
        });
      }
    } catch (error) {
      message.error(getErrorMessage(error, '申请列表加载失败'));
    } finally {
      setLoading(false);
    }
  };

  const fetchSpots = async () => {
    try {
      const result = await getSpots(true) as any;
      setSpots(result.data || []);
    } catch (error) {
      message.warning(getErrorMessage(error, '点位列表加载失败'));
    }
  };

  const handleSearch = () => {
    fetchApplications();
  };

  const handleReset = () => {
    setApplicationType(undefined);
    setStatus(undefined);
    setKeyword('');
    setApplicant('');
    setDateRange(null);
    setTimeout(() => fetchApplications(), 0);
  };

  const openApprove = (record: ContentApplication) => {
    setEditing(record);
    form.setFieldsValue({
      ...record,
      suitableMode: record.suitableMode ? record.suitableMode.split(',') : ['fresh', 'alumni', 'parent', 'research', 'senior'],
      spotOrderJson: record.spotOrderJson ? JSON.parse(record.spotOrderJson) : [],
    });
  };

  const handleApprove = async (values: any) => {
    if (!editing) return;
    setSaving(true);
    try {
      const payload = {
        ...values,
        suitableMode: Array.isArray(values.suitableMode) ? values.suitableMode.join(',') : values.suitableMode,
        spotOrderJson: Array.isArray(values.spotOrderJson) ? JSON.stringify(values.spotOrderJson) : values.spotOrderJson,
      };
      await approveApplication(editing.id, payload);
      message.success('审核通过并已发布');
      setEditing(null);
      fetchApplications();
    } catch (error) {
      message.error(getErrorMessage(error, '审核失败'));
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async (values: { auditComment: string }) => {
    if (!rejecting) return;
    setSaving(true);
    try {
      await rejectApplication(rejecting.id, values.auditComment);
      message.success('已拒绝申请');
      setRejecting(null);
      rejectForm.resetFields();
      fetchApplications();
    } catch (error) {
      message.error(getErrorMessage(error, '拒绝失败'));
    } finally {
      setSaving(false);
    }
  };

  const statCards = [
    { label: '全部申请', value: stats.total, color: '#1677ff', gradient: 'linear-gradient(135deg, #f0f5ff 0%, #e6f0ff 100%)' },
    { label: '待审核点位', value: stats.pendingSpot, color: '#fa8c16', gradient: 'linear-gradient(135deg, #fff7e6 0%, #fff3d9 100%)' },
    { label: '待审核路线', value: stats.pendingRoute, color: '#722ed1', gradient: 'linear-gradient(135deg, #f9f0ff 0%, #f3e0ff 100%)' },
    { label: '已通过', value: stats.approvedCount, color: '#52c41a', gradient: 'linear-gradient(135deg, #f6ffed 0%, #eeffdd 100%)' },
    { label: '已拒绝', value: stats.rejectedCount, color: '#ff4d4f', gradient: 'linear-gradient(135deg, #fff2f0 0%, #ffe7e5 100%)' },
  ];

  const statIcons: Record<string, React.ReactNode> = {
    '全部申请': <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1677ff" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
    '待审核点位': <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fa8c16" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    '待审核路线': <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#722ed1" strokeWidth="2"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2z"/><path d="M3 19a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v2z"/></svg>,
    '已通过': <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#52c41a" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
    '已拒绝': <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ff4d4f" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>,
  };

  const columns = [
    { title: '标题', dataIndex: 'applicationTitle', key: 'applicationTitle', ellipsis: true },
    {
      title: '类型', dataIndex: 'applicationType', key: 'applicationType', width: 100,
      render: (value: string) => <Tag color={value === 'spot' ? 'blue' : 'purple'}>{value === 'spot' ? '点位申请' : '路线申请'}</Tag>,
    },
    { title: '申请人', dataIndex: 'applicantName', key: 'applicantName', width: 120, render: (v: string) => v || '-' },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 110,
      render: (value: number) => {
        const label = statusOptions.find(s => s.value === value)?.label || value;
        const icon = value === 0 ? <ReloadOutlined spin /> : 
                     value === 1 ? <CheckOutlined /> :
                     value === 2 ? <CloseOutlined /> : null;
        return <Tag color={statusColor(value)} icon={icon} style={{ padding: '0 8px', borderRadius: 12 }}>{label}</Tag>;
      },
    },
    { title: '申请理由', dataIndex: 'applicationReason', key: 'applicationReason', ellipsis: true },
    {
      title: '操作', key: 'action', width: 200,
      render: (_: unknown, record: ContentApplication) => (
        <Space>
          <Button type="link" size="small" onClick={() => setDetailRecord(record)}>详情</Button>
          {record.status === 0 && (
            <>
              <Button type="link" size="small" icon={<CheckOutlined />} onClick={() => openApprove(record)}>审核</Button>
              <Button type="link" size="small" danger icon={<CloseOutlined />} onClick={() => setRejecting(record)}>拒绝</Button>
            </>
          )}
          {record.status !== 0 && <Text type="secondary" style={{ fontSize: 12 }}>已处理</Text>}
        </Space>
      ),
    },
  ];

  const renderDetailContent = (record: ContentApplication) => {
    if (record.applicationType === 'spot') {
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><Text type="secondary">点位名称</Text><br /><Text strong>{record.spotName || '-'}</Text></div>
          <div><Text type="secondary">点位类型</Text><br /><Text strong>{record.spotType || '-'}</Text></div>
          <div><Text type="secondary">经度</Text><br /><Text>{record.longitude != null ? String(record.longitude) : '-'}</Text></div>
          <div><Text type="secondary">纬度</Text><br /><Text>{record.latitude != null ? String(record.latitude) : '-'}</Text></div>
          <div><Text type="secondary">开放时间</Text><br /><Text>{record.openTime || '-'}</Text></div>
          <div><Text type="secondary">推荐时长</Text><br /><Text>{record.recommendTime ? `${record.recommendTime} 分钟` : '-'}</Text></div>
          <div style={{ gridColumn: '1 / -1' }}><Text type="secondary">简介</Text><br /><Text>{record.spotDesc || '-'}</Text></div>
          {record.spotImage && (
            <div style={{ gridColumn: '1 / -1' }}>
              <Text type="secondary">图片</Text><br />
              <img src={record.spotImage} alt="点位图片" style={{ maxWidth: 200, maxHeight: 120, objectFit: 'cover', borderRadius: 8, marginTop: 4 }} />
            </div>
          )}
          <div style={{ gridColumn: '1 / -1' }}><Text type="secondary">申请理由</Text><br /><Text>{record.applicationReason || '-'}</Text></div>
        </div>
      );
    }
    // route
    let spotNames: string[] = [];
    try {
      const ids: number[] = JSON.parse(record.spotOrderJson || '[]');
      spotNames = ids.map(id => spots.find(s => s.id === id)?.spotName || `点位#${id}`);
    } catch {}
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ gridColumn: '1 / -1' }}><Text type="secondary">路线名称</Text><br /><Text strong>{record.routeName || '-'}</Text></div>
        <div style={{ gridColumn: '1 / -1' }}><Text type="secondary">路线简介</Text><br /><Text>{record.routeDesc || '-'}</Text></div>
        <div><Text type="secondary">预计时长</Text><br /><Text>{record.totalMinute ? `${record.totalMinute} 分钟` : '-'}</Text></div>
        <div><Text type="secondary">点位数量</Text><br /><Text>{spotNames.length} 个</Text></div>
        {spotNames.length > 0 && (
          <div style={{ gridColumn: '1 / -1' }}>
            <Text type="secondary">点位顺序</Text><br />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
              {spotNames.map((name, idx) => (
                <Tag key={idx} color="blue">{idx + 1}. {name}</Tag>
              ))}
            </div>
          </div>
        )}
        {record.coverImage && (
          <div style={{ gridColumn: '1 / -1' }}>
            <Text type="secondary">封面</Text><br />
            <img src={record.coverImage} alt="封面" style={{ maxWidth: 200, maxHeight: 120, objectFit: 'cover', borderRadius: 8, marginTop: 4 }} />
          </div>
        )}
        <div style={{ gridColumn: '1 / -1' }}><Text type="secondary">申请理由</Text><br /><Text>{record.applicationReason || '-'}</Text></div>
      </div>
    );
  };

  return (
    <div>
      <div className="admin-toolbar" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg, #722ed1, #9254de)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(114,46,209,0.25)' }}>
            <AuditOutlined style={{ fontSize: 20, color: '#fff' }} />
          </div>
          <div>
            <Title level={4} style={{ margin: 0, color: '#0f344e' }}>申请审核</Title>
            <Text type="secondary" style={{ fontSize: 13 }}>审核用户提交的点位和路线共建申请</Text>
          </div>
        </div>
        <Button icon={<ReloadOutlined />} onClick={fetchApplications} style={{ borderRadius: 10, fontWeight: 600 }}>刷新</Button>
      </div>

      {/* 统计卡 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 16, marginBottom: 20 }}>
        {statCards.map(card => (
          <div key={card.label} style={{
            cursor: 'default', background: card.gradient, borderRadius: 16, padding: '20px 24px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.04)',
            transition: 'all 0.3s', display: 'flex', alignItems: 'center', gap: 16,
          }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', flexShrink: 0 }}>
              {statIcons[card.label]}
            </div>
            <div style={{ minWidth: 0 }}>
              <Text type="secondary" style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 2 }}>{card.label}</Text>
              <div style={{ fontSize: 30, fontWeight: 800, color: card.color, lineHeight: 1 }}>{card.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 筛选区与表格 */}
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.04)' }}>
        <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <Space wrap size="middle">
            <Select allowClear placeholder="全部类型" style={{ width: 140, borderRadius: 10 }} value={applicationType} onChange={v => setApplicationType(v)} options={appTypeOptions} />
            <Select allowClear placeholder="全部状态" style={{ width: 130, borderRadius: 10 }} value={status} onChange={v => setStatus(v)} options={statusOptions} />
            <Input placeholder="关键词搜索" style={{ width: 160, borderRadius: 10 }} value={keyword} onChange={e => setKeyword(e.target.value)} onPressEnter={handleSearch} prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />} />
            <Input placeholder="申请人搜索" style={{ width: 140, borderRadius: 10 }} value={applicant} onChange={e => setApplicant(e.target.value)} onPressEnter={handleSearch} />
            <RangePicker style={{ width: 230, borderRadius: 10 }} onChange={(_, dateStrings) => { if (dateStrings[0] && dateStrings[1]) setDateRange([dateStrings[0], dateStrings[1]]); else setDateRange(null); }} />
          </Space>
          <Space>
            <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch} style={{ borderRadius: 10, fontWeight: 600, boxShadow: '0 2px 8px rgba(22,119,255,0.2)' }}>搜索</Button>
            <Button onClick={handleReset} style={{ borderRadius: 10, fontWeight: 600 }}>重置</Button>
          </Space>
        </div>

        <div className="admin-panel">
          <Table rowKey="id" loading={loading} columns={columns} dataSource={applications} rowClassName={() => 'admin-table-row'} />
        </div>
      </div>

      {/* 详情弹窗 */}
      <Modal
        title={detailRecord?.applicationType === 'spot' ? '点位申请详情' : '路线申请详情'}
        open={Boolean(detailRecord)}
        onCancel={() => setDetailRecord(null)}
        footer={[
          detailRecord?.status === 0 && (
            <Button key="approve" type="primary" icon={<CheckOutlined />} onClick={() => { openApprove(detailRecord!); setDetailRecord(null); }}>审核通过</Button>
          ),
          detailRecord?.status === 0 && (
            <Button key="reject" danger icon={<CloseOutlined />} onClick={() => { setRejecting(detailRecord!); setDetailRecord(null); }}>拒绝</Button>
          ),
          <Button key="close" onClick={() => setDetailRecord(null)}>关闭</Button>,
        ]}
        width={640}
        destroyOnHidden
      >
        {detailRecord && renderDetailContent(detailRecord)}
      </Modal>

      {/* 审核通过弹窗 */}
      <Modal title="审核并发布" open={Boolean(editing)} onCancel={() => setEditing(null)} onOk={() => form.submit()} confirmLoading={saving} width={760} destroyOnHidden>
        <Form form={form} layout="vertical" onFinish={handleApprove}>
          {editing?.applicationType === 'spot' ? (
            <>
              <Form.Item name="spotName" label="点位名称" rules={[{ required: true, message: '请输入点位名称' }]}><Input /></Form.Item>
              <Form.Item name="spotType" label="点位类型" rules={[{ required: true, message: '请选择点位类型' }]}><Select options={spotTypes.map(v => ({ value: v, label: v }))} /></Form.Item>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Form.Item name="longitude" label="经度" rules={[{ required: true, message: '请输入经度' }]}><InputNumber style={{ width: '100%' }} /></Form.Item>
                <Form.Item name="latitude" label="纬度" rules={[{ required: true, message: '请输入纬度' }]}><InputNumber style={{ width: '100%' }} /></Form.Item>
                <Form.Item name="openTime" label="开放时间"><Input /></Form.Item>
                <Form.Item name="recommendTime" label="推荐时长(分钟)"><InputNumber style={{ width: '100%' }} min={1} /></Form.Item>
              </div>
              <Form.Item name="spotImage" label="图片地址"><Input /></Form.Item>
              <Form.Item name="spotDesc" label="简介"><Input.TextArea rows={3} /></Form.Item>
            </>
          ) : (
            <>
              <Form.Item name="routeName" label="路线名称" rules={[{ required: true, message: '请输入路线名称' }]}><Input /></Form.Item>
              <Form.Item name="routeDesc" label="简介"><Input.TextArea rows={3} /></Form.Item>
              <Form.Item name="totalMinute" label="预计时长(分钟)" rules={[{ required: true, message: '请输入预计时长' }]}><InputNumber style={{ width: '100%' }} min={1} /></Form.Item>
              <Form.Item name="spotOrderJson" label="点位顺序" rules={[{ required: true, message: '请选择点位' }]}>
                <Select mode="multiple" optionFilterProp="label" options={spots.map(spot => ({ value: spot.id, label: spot.spotName }))} />
              </Form.Item>
              <Form.Item name="coverImage" label="封面地址"><Input /></Form.Item>
            </>
          )}
          <Form.Item name="suitableMode" label="适用人群"><Select mode="multiple" options={userModes} /></Form.Item>
          <Form.Item name="auditComment" label="审核意见"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      {/* 拒绝弹窗 */}
      <Modal title={<span style={{ fontSize: 16, fontWeight: 700 }}>拒绝申请</span>} open={Boolean(rejecting)} onCancel={() => setRejecting(null)} onOk={() => rejectForm.submit()} confirmLoading={saving} destroyOnHidden>
        <Form form={rejectForm} layout="vertical" onFinish={handleReject}>
          <Form.Item name="auditComment" label="拒绝原因" rules={[{ required: true, message: '请输入拒绝原因' }]}><Input.TextArea rows={4} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
