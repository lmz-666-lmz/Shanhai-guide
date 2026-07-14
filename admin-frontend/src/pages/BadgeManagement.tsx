import { useEffect, useState } from 'react';
import { Button, Form, Image, Input, InputNumber, Modal, Select, Space, Switch, Table, Tag, Typography, Upload, message } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined, SafetyCertificateOutlined, SearchOutlined, StopOutlined, UploadOutlined } from '@ant-design/icons';
import request from '@/utils/request';
import { uploadImage } from '@/api/upload';

const { Title, Text } = Typography;

interface BadgeRecord {
  id: number;
  badgeCode?: string;
  badgeName: string;
  badgeIcon?: string;
  badgeDesc?: string;
  badgeLevel?: string;
  unlockRule?: string;
  conditionType?: string;
  conditionValue?: number;
  conditionConfig?: string;
  userModeLimit?: string;
  sort?: number;
  sortOrder?: number;
  isEnable: number;
}

const conditionOptions = [
  ['FIRST_CHECKIN', '首次打卡'], ['CHECKIN_COUNT', '累计打卡数量'], ['FIRST_ROUTE', '首次完成路线'],
  ['ROUTE_COMPLETE_COUNT', '完成路线数量'], ['FIRST_ACTIVITY', '首次预约活动'], ['ACTIVITY_RESERVE_COUNT', '预约活动数量'],
  ['FAVORITE_SPOT_COUNT', '收藏点位数量'], ['FAVORITE_ROUTE_COUNT', '收藏路线数量'],
  ['SPOT_TYPE_CHECKIN', '某类型点位打卡'], ['CUSTOM', '自定义规则'],
].map(([value, label]) => ({ value, label }));

const userModes = [
  { value: 'fresh', label: '新生' }, { value: 'alumni', label: '校友' }, { value: 'parent', label: '家长' },
  { value: 'research', label: '访客' }, { value: 'senior', label: '长者' },
];

const getErrorMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;
const isImageUrl = (value?: string) => Boolean(value && (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/uploads/')));
const getFullImageUrl = (url?: string) => {
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const origin = import.meta.env.VITE_API_BASE_URL ? new URL(import.meta.env.VITE_API_BASE_URL).origin : 'http://localhost:8080';
  return `${origin}${url}`;
};

export default function BadgeManagement() {
  const [badges, setBadges] = useState<BadgeRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BadgeRecord | null>(null);
  const [iconUrl, setIconUrl] = useState<string>();
  const [uploading, setUploading] = useState(false);
  const [form] = Form.useForm();

  // 筛选条件
  const [badgeLevelFilter, setBadgeLevelFilter] = useState<string>();
  const [conditionTypeFilter, setConditionTypeFilter] = useState<string>();
  const [badgeEnableFilter, setBadgeEnableFilter] = useState<number | undefined>();
  const [keyword, setKeyword] = useState('');

  const fetchBadges = async () => {
    setLoading(true);
    try {
      const result = await request.get('/admin/badges') as any;
      setBadges(result.data || []);
    } catch (error) {
      message.error(getErrorMessage(error, '徽章列表加载失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBadges(); }, []);

  const handleSearch = () => fetchBadges();

  const handleReset = () => {
    setBadgeLevelFilter(undefined); setConditionTypeFilter(undefined); setBadgeEnableFilter(undefined); setKeyword('');
    setTimeout(() => fetchBadges(), 0);
  };

  const openCreate = () => {
    setEditing(null); setIconUrl(undefined);
    form.resetFields();
    form.setFieldsValue({ badgeLevel: 'normal', conditionValue: 1, sortOrder: 0, isEnable: true, userModeLimit: [] });
    setModalOpen(true);
  };

  const openEdit = (badge: BadgeRecord) => {
    setEditing(badge); setIconUrl(badge.badgeIcon);
    form.setFieldsValue({
      ...badge, sortOrder: badge.sortOrder ?? badge.sort ?? 0,
      isEnable: badge.isEnable === 1,
      userModeLimit: badge.userModeLimit ? badge.userModeLimit.split(',').filter(Boolean) : [],
    });
    setModalOpen(true);
  };

  const uploadIcon = async ({ file, onSuccess, onError }: any) => {
    setUploading(true);
    try {
      const result = await uploadImage(file as File);
      if (result.code !== 200) throw new Error(result.message || '上传失败');
      const url = result.data?.url || '';
      setIconUrl(url); form.setFieldsValue({ badgeIcon: url });
      onSuccess?.('ok');
    } catch (error) { onError?.(error); message.error(getErrorMessage(error, '图标上传失败')); }
    finally { setUploading(false); }
  };

  const submit = async (values: any) => {
    setSaving(true);
    try {
      const payload = {
        ...values,
        badgeIcon: iconUrl ?? '',
        userModeLimit: Array.isArray(values.userModeLimit) ? values.userModeLimit.join(',') : values.userModeLimit,
        isEnable: values.isEnable ? 1 : 0,
      };
      if (editing) {
        await request.put(`/admin/badges/${editing.id}`, payload);
        if (editing.isEnable !== payload.isEnable) {
          await request.put(`/admin/badges/${editing.id}/status`, null, { params: { isEnable: payload.isEnable } });
        }
        message.success('徽章已更新');
      } else {
        await request.post('/admin/badges', payload);
        message.success('徽章已创建');
      }
      setModalOpen(false); fetchBadges();
    } catch (error) { message.error(getErrorMessage(error, editing ? '徽章更新失败' : '徽章创建失败')); }
    finally { setSaving(false); }
  };

  const toggleStatus = async (badge: BadgeRecord) => {
    try {
      await request.put(`/admin/badges/${badge.id}/status`, null, { params: { isEnable: badge.isEnable === 1 ? 0 : 1 } });
      message.success(badge.isEnable === 1 ? '徽章已下架' : '徽章已上架');
      fetchBadges();
    } catch (error) { message.error(getErrorMessage(error, '状态更新失败')); }
  };

  const softDisable = (badge: BadgeRecord) => {
    Modal.confirm({
      title: '下架徽章', content: '只下架该徽章，已获得记录会继续保留。', okText: '确认下架', okButtonProps: { danger: true },
      onOk: async () => { await request.delete(`/admin/badges/${badge.id}`); message.success('徽章已下架'); fetchBadges(); },
    });
  };

  const filteredBadges = badges.filter(b => {
    const matchLevel = !badgeLevelFilter || b.badgeLevel === badgeLevelFilter;
    const matchCond = !conditionTypeFilter || b.conditionType === conditionTypeFilter;
    const matchEnable = badgeEnableFilter === undefined || b.isEnable === badgeEnableFilter;
    const matchKeyword = !keyword || b.badgeName.includes(keyword) || (b.badgeDesc && b.badgeDesc.includes(keyword));
    return matchLevel && matchCond && matchEnable && matchKeyword;
  });

  const statCards = [
    { label: '徽章总数', value: badges.length, color: '#1677ff' },
    { label: '已上架', value: badges.filter(b => b.isEnable === 1).length, color: '#52c41a' },
    { label: '自动规则', value: badges.filter(b => b.conditionType && b.conditionType !== 'CUSTOM').length, color: '#722ed1' },
    { label: '待完善', value: badges.filter(b => !b.conditionType).length, color: '#fa8c16' },
  ];

  const columns = [
    {
      title: '图标', key: 'icon', width: 76,
      render: (_: unknown, badge: BadgeRecord) => isImageUrl(badge.badgeIcon)
        ? <Image src={getFullImageUrl(badge.badgeIcon)} width={42} height={42} style={{ objectFit: 'cover', borderRadius: 12 }} />
        : <div style={{ width: 42, height: 42, borderRadius: 12, background: '#eef4f8', color: '#35637f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><SafetyCertificateOutlined style={{ fontSize: 21 }} /></div>,
    },
    { title: '徽章名称', dataIndex: 'badgeName', key: 'badgeName', width: 150, ellipsis: true },
    { title: '等级', dataIndex: 'badgeLevel', key: 'badgeLevel', width: 90, render: (v: string) => <Tag color="gold">{v || 'normal'}</Tag> },
    { title: '达成条件', dataIndex: 'conditionType', key: 'conditionType', width: 170, render: (v: string) => conditionOptions.find(o => o.value === v)?.label || '规则完善中' },
    { title: '目标值', dataIndex: 'conditionValue', key: 'conditionValue', width: 80, render: (v: number) => v || 1 },
    { title: '排序', key: 'sortOrder', width: 70, render: (_: unknown, b: BadgeRecord) => b.sortOrder ?? b.sort ?? 0 },
    {
      title: '状态', dataIndex: 'isEnable', key: 'isEnable', width: 90,
      render: (v: number) => v === 1 ? <Tag color="green">已上架</Tag> : <Tag>已下架</Tag>,
    },
    {
      title: '操作', key: 'action', width: 220,
      render: (_: unknown, badge: BadgeRecord) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(badge)}>编辑</Button>
          <Button type="link" size="small" onClick={() => toggleStatus(badge)}>{badge.isEnable === 1 ? '下架' : '上架'}</Button>
          {badge.isEnable === 1 && <Button type="link" size="small" danger icon={<StopOutlined />} onClick={() => softDisable(badge)}>停用</Button>}
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* Toolbar */}
      <div className="admin-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg, #722ed1, #b37feb)', boxShadow: '0 4px 12px rgba(114,46,209,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <SafetyCertificateOutlined style={{ color: '#fff', fontSize: 20 }} />
          </div>
          <div>
            <Title level={4} style={{ margin: 0, color: '#0f344e' }}>徽章管理</Title>
            <Text type="secondary">配置成就规则、等级、图标与上架状态</Text>
          </div>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchBadges} style={{ borderRadius: 10, fontWeight: 600 }}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} style={{ borderRadius: 10, fontWeight: 600 }}>新增徽章</Button>
        </Space>
      </div>

      {/* 统计卡 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 16, marginBottom: 20 }}>
        {statCards.map((card, idx) => {
          const cardIcons = [SafetyCertificateOutlined, PlusOutlined, EditOutlined, StopOutlined];
          const IconComp = cardIcons[idx];
          return (
            <div key={card.label} style={{ background: `linear-gradient(135deg, ${card.color}12, ${card.color}06)`, borderRadius: 16, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16, border: `1px solid ${card.color}20` }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <IconComp style={{ fontSize: 22, color: card.color }} />
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>{card.label}</Text>
                <div style={{ fontSize: 28, fontWeight: 800, color: card.color, lineHeight: 1.3 }}>{card.value}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 筛选区与表格 */}
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <Space wrap>
            <Select
              allowClear placeholder="徽章等级" style={{ width: 120, borderRadius: 10 }}
              value={badgeLevelFilter} onChange={v => setBadgeLevelFilter(v)}
              options={[{ value: 'normal', label: '普通' }, { value: 'silver', label: '银色' }, { value: 'gold', label: '金色' }, { value: 'special', label: '特别' }]}
            />
            <Select
              allowClear placeholder="条件类型" style={{ width: 160, borderRadius: 10 }}
              value={conditionTypeFilter} onChange={v => setConditionTypeFilter(v)}
              options={conditionOptions}
            />
            <Select
              allowClear placeholder="上架状态" style={{ width: 130, borderRadius: 10 }}
              value={badgeEnableFilter} onChange={v => setBadgeEnableFilter(v)}
              options={[{ value: 1, label: '已上架' }, { value: 0, label: '已下架' }]}
            />
            <Input
              placeholder="关键词搜索" style={{ width: 180, borderRadius: 10 }}
              value={keyword} onChange={e => setKeyword(e.target.value)} onPressEnter={handleSearch}
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            />
          </Space>
          <Space>
            <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch} ghost style={{ borderRadius: 10, fontWeight: 600, boxShadow: '0 2px 8px rgba(22,119,255,0.2)' }}>搜索</Button>
            <Button onClick={handleReset} style={{ borderRadius: 10, fontWeight: 600 }}>重置</Button>
          </Space>
        </div>

        <div className="admin-panel">
          <Table rowKey="id" loading={loading} columns={columns} dataSource={filteredBadges} scroll={{ x: 1050 }} rowClassName={() => 'admin-table-row'} />
        </div>
      </div>

      {/* 新增/编辑弹窗 */}
      <Modal title={<span style={{ fontSize: 16, fontWeight: 700 }}>{editing ? '编辑徽章' : '新增徽章'}</span>} open={modalOpen} onCancel={() => setModalOpen(false)} onOk={() => form.submit()} confirmLoading={saving} width={760} destroyOnHidden>
        <Form form={form} layout="vertical" onFinish={submit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="badgeName" label="徽章名称" rules={[{ required: true, message: '请输入徽章名称' }]}><Input /></Form.Item>
            <Form.Item name="badgeCode" label="徽章编码" tooltip="留空时由系统自动生成"><Input placeholder="例如 CAMPUS_EXPLORER" /></Form.Item>
            <Form.Item name="badgeLevel" label="徽章等级"><Select options={[{ value: 'normal', label: '普通' }, { value: 'silver', label: '银色' }, { value: 'gold', label: '金色' }, { value: 'special', label: '特别' }]} /></Form.Item>
            <Form.Item name="sortOrder" label="排序"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          </div>
          <Form.Item name="badgeDesc" label="徽章描述"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="unlockRule" label="解锁条件文案"><Input placeholder="展示给用户的条件说明" /></Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr .6fr', gap: 16 }}>
            <Form.Item name="conditionType" label="达成条件" rules={[{ required: true, message: '请选择达成条件' }]}><Select options={conditionOptions} /></Form.Item>
            <Form.Item name="conditionValue" label="条件值" rules={[{ required: true, message: '请输入条件值' }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
          </div>
          <Form.Item name="conditionConfig" label="条件配置" tooltip="点位类型条件可直接填写类型名称，也可填写 JSON"><Input placeholder="例如：教学场馆" /></Form.Item>
          <Form.Item name="userModeLimit" label="适用身份"><Select mode="multiple" options={userModes} placeholder="不选表示全部正式身份" /></Form.Item>
          <Form.Item label="徽章图标 / 图片">
            <Upload customRequest={uploadIcon} showUploadList={false} accept="image/png,image/jpeg,image/webp">
              <Button icon={<UploadOutlined />} loading={uploading}>上传图片</Button>
            </Upload>
            {iconUrl && (
              <div style={{ marginTop: 8, position: 'relative', display: 'inline-block' }}>
                <Image src={getFullImageUrl(iconUrl)} width={64} height={64} style={{ objectFit: 'cover', borderRadius: 16 }} />
                <Button size="small" danger type="primary" style={{ position: 'absolute', top: -10, right: -10, zIndex: 10 }}
                  onClick={(e) => { e.stopPropagation(); setIconUrl(undefined); form.setFieldsValue({ badgeIcon: null }); }}
                  icon={<DeleteOutlined />} shape="circle" />
              </div>
            )}
            <Form.Item name="badgeIcon" hidden><Input /></Form.Item>
          </Form.Item>
          <Form.Item name="isEnable" label="上架展示" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>
      <style>{`.admin-table-row { transition: background 0.2s; } .admin-table-row:hover { background: #fafcff !important; } .admin-table-row td { padding-top: 14px !important; padding-bottom: 14px !important; }`}</style>
    </div>
  );
}
