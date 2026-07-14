import { useEffect, useState } from 'react';
import { Button, Form, Input, InputNumber, Modal, Select, Space, Switch, Table, Tag, Typography, message, Upload, Image } from 'antd';
import { CalendarOutlined, EditOutlined, PlusOutlined, ReloadOutlined, SearchOutlined, UploadOutlined, DeleteOutlined, PictureOutlined } from '@ant-design/icons';
import request from '@/utils/request';
import { getSpots, type CampusSpot } from '@/api/spot';
import { uploadImage } from '@/api/upload';

const { Title, Text } = Typography;

interface CampusActivity {
  id: number;
  activityTitle: string;
  activityDesc: string;
  activityType: string;
  activityImage: string;
  activityTime: string;
  activitySpotId: number;
  suitableMode: string;
  isReserve: number;
  reserveLimit: number;
  reservedCount: number;
  isEnable: number;
  createTime: string;
}

const activityTypes = ['学术', '文体', '校友'];
const userModes = [
  { value: 'fresh', label: '新生' },
  { value: 'alumni', label: '校友' },
  { value: 'parent', label: '家长' },
  { value: 'research', label: '访客' },
  { value: 'senior', label: '长者' },
];

const getErrorMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

const getFullImageUrl = (url?: string) => {
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/uploads/')) {
    const origin = import.meta.env.VITE_API_BASE_URL
      ? new URL(import.meta.env.VITE_API_BASE_URL).origin
      : 'http://localhost:8080';
    return `${origin}${url}`;
  }
  return url;
};

export default function ActivityManagement() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activities, setActivities] = useState<CampusActivity[]>([]);
  const [spots, setSpots] = useState<CampusSpot[]>([]);

  // 筛选条件
  const [activityType, setActivityType] = useState<string>();
  const [activityEnableFilter, setActivityEnableFilter] = useState<number | undefined>();
  const [activityReserveFilter, setActivityReserveFilter] = useState<number | undefined>();
  const [keyword, setKeyword] = useState('');

  const [modalVisible, setModalVisible] = useState(false);
  const [editingActivity, setEditingActivity] = useState<CampusActivity | null>(null);
  const [form] = Form.useForm();
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | undefined>();

  useEffect(() => {
    fetchActivities();
    fetchSpots();
  }, []);

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const params: any = { includeDisabled: true };
      if (activityType) params.activityType = activityType;
      if (keyword) params.keyword = keyword;
      const result = await request.get('/admin/activities', { params }) as any;
      setActivities(result.data || []);
    } catch (error) {
      console.error('Failed to fetch activities:', error);
      message.error(getErrorMessage(error, '活动列表加载失败'));
    } finally {
      setLoading(false);
    }
  };

  const fetchSpots = async () => {
    try {
      const result = await getSpots(true) as any;
      setSpots(result.data || []);
    } catch (error) {
      console.error('Failed to fetch spots:', error);
    }
  };

  const handleSearch = () => fetchActivities();

  const handleReset = () => {
    setActivityType(undefined);
    setActivityEnableFilter(undefined);
    setActivityReserveFilter(undefined);
    setKeyword('');
    setTimeout(() => fetchActivities(), 0);
  };

  const openCreate = () => {
    setEditingActivity(null);
    setImageUrl(undefined);
    form.resetFields();
    form.setFieldsValue({ isReserve: true, isEnable: true, reserveLimit: 50, suitableMode: ['fresh', 'alumni', 'parent', 'research', 'senior'] });
    setModalVisible(true);
  };

  const openEdit = (activity: CampusActivity) => {
    setEditingActivity(activity);
    setImageUrl(activity.activityImage);
    form.setFieldsValue({
      ...activity,
      activityTime: activity.activityTime?.slice(0, 16),
      suitableMode: activity.suitableMode ? activity.suitableMode.split(',') : [],
      isReserve: activity.isReserve === 1,
      isEnable: activity.isEnable === 1,
    });
    setModalVisible(true);
  };

  const handleCustomRequest = async (options: any) => {
    const { file, onSuccess, onError } = options;
    setUploading(true);
    try {
      const res = await uploadImage(file as File);
      if (res.code === 200) {
        const url = res.data?.url || '';
        setImageUrl(url);
        form.setFieldsValue({ activityImage: url });
        onSuccess("ok");
        message.success('图片上传成功');
      } else {
        onError(new Error(res.message));
        message.error(res.message || '上传失败');
      }
    } catch (error) {
      onError(error);
      message.error(error instanceof Error ? error.message : '网络或服务器错误，上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (values: any) => {
    setSaving(true);
    try {
      const payload = {
        ...values,
        activityImage: imageUrl ?? '',
        suitableMode: Array.isArray(values.suitableMode) ? values.suitableMode.join(',') : values.suitableMode,
        isReserve: values.isReserve ? 1 : 0,
        isEnable: values.isEnable ? 1 : 0,
        reservedCount: editingActivity?.reservedCount || 0,
      };
      if (editingActivity) {
        await request.put(`/activity/${editingActivity.id}`, payload);
        message.success('活动已更新');
      } else {
        await request.post('/activity', payload);
        message.success('活动已创建');
      }
      setModalVisible(false);
      fetchActivities();
    } catch (error) {
      console.error('Failed to save activity:', error);
      message.error(getErrorMessage(error, editingActivity ? '活动更新失败' : '活动创建失败'));
    } finally {
      setSaving(false);
    }
  };

  const toggleEnable = async (activity: CampusActivity) => {
    try {
      await request.put(`/activity/${activity.id}`, { isEnable: activity.isEnable === 1 ? 0 : 1 });
      message.success(activity.isEnable === 1 ? '活动已下架' : '活动已上架');
      fetchActivities();
    } catch (error) {
      message.error(getErrorMessage(error, '状态更新失败'));
    }
  };

  const handleDelete = (activity: CampusActivity) => {
    Modal.confirm({
      title: `确认删除活动「${activity.activityTitle}」？`,
      content: '删除后不可恢复。',
      okText: '确认删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        await request.delete(`/activity/${activity.id}`);
        message.success('活动已删除');
        fetchActivities();
      },
    });
  };

  const filteredActivities = activities.filter(a => {
    const matchType = !activityType || a.activityType === activityType;
    const matchEnable = activityEnableFilter === undefined || a.isEnable === activityEnableFilter;
    const matchReserve = activityReserveFilter === undefined || a.isReserve === activityReserveFilter;
    const matchKeyword = !keyword || a.activityTitle.includes(keyword) || (a.activityDesc && a.activityDesc.includes(keyword));
    return matchType && matchEnable && matchReserve && matchKeyword;
  });

  const statCards = [
    { key: 'total', label: '活动总数', value: activities.length, color: '#1677ff', gradient: 'linear-gradient(135deg, #f0f5ff 0%, #e6f0ff 100%)' },
    { key: 'enabled', label: '已上架', value: activities.filter(a => a.isEnable === 1).length, color: '#52c41a', gradient: 'linear-gradient(135deg, #f6ffed 0%, #eeffdd 100%)' },
    { key: 'reserve', label: '开放报名', value: activities.filter(a => a.isReserve === 1).length, color: '#722ed1', gradient: 'linear-gradient(135deg, #f9f0ff 0%, #f3e0ff 100%)' },
    { key: 'reserved', label: '累计报名人次', value: activities.reduce((sum, a) => sum + (a.reservedCount || 0), 0), color: '#fa8c16', gradient: 'linear-gradient(135deg, #fff7e6 0%, #fff3d9 100%)' },
  ];

  const statIcons: Record<string, React.ReactNode> = {
    total: <CalendarOutlined style={{ fontSize: 20, color: '#1677ff' }} />,
    enabled: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#52c41a" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
    reserve: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#722ed1" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    reserved: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fa8c16" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  };

  const columns = [
    {
      title: '封面', dataIndex: 'activityImage', key: 'activityImage', width: 80,
      render: (img: string) => {
        const fullUrl = getFullImageUrl(img);
        return fullUrl ? (
          <Image src={fullUrl} width={40} height={40} style={{ objectFit: 'cover', borderRadius: 4 }} fallback="https://gw.alipayobjects.com/zos/rmsportal/JiqGstEfoWAOHiTxclqi.png" />
        ) : (
          <div style={{ width: 40, height: 40, background: '#f0f0f0', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
            <PictureOutlined />
          </div>
        );
      },
    },
    { title: '活动标题', dataIndex: 'activityTitle', key: 'activityTitle', width: 220, ellipsis: true },
    { title: '类型', dataIndex: 'activityType', key: 'activityType', width: 90, render: (value: string) => <Tag color="blue">{value}</Tag> },
    { title: '活动时间', dataIndex: 'activityTime', key: 'activityTime', width: 170, render: (value: string) => value?.replace('T', ' ').slice(0, 16) || '-' },
    {
      title: '关联点位', dataIndex: 'activitySpotId', key: 'activitySpotId', width: 140,
      render: (value: number) => spots.find(s => s.id === value)?.spotName || value || '-',
    },
    {
      title: '报名情况', key: 'reserve', width: 130,
      render: (_: unknown, record: CampusActivity) => record.isReserve === 1
        ? record.reserveLimit > 0 ? `${record.reservedCount || 0}/${record.reserveLimit}` : `${record.reservedCount || 0}/不限`
        : <Text type="secondary">暂未开放</Text>,
    },
    {
      title: '状态', dataIndex: 'isEnable', key: 'status', width: 90,
      render: (value: number) => value === 1 ? <Tag color="green">已上架</Tag> : <Tag color="red">已下架</Tag>,
    },
    {
      title: '操作', key: 'action', width: 240,
      render: (_: unknown, record: CampusActivity) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>编辑</Button>
          <Button type="link" size="small" danger={record.isEnable === 1} onClick={() => toggleEnable(record)}>
            {record.isEnable === 1 ? '下架' : '上架'}
          </Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)}>删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* Toolbar */}
      <div className="admin-toolbar" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg, #1677ff 0%, #0958d9 100%)', boxShadow: '0 4px 12px rgba(22,119,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <CalendarOutlined style={{ color: '#fff', fontSize: 20 }} />
          </div>
          <div>
            <Title level={3} style={{ margin: 0, color: '#0f344e' }}>活动管理</Title>
            <Text type="secondary">管理校园所有活动的展示与预约状态</Text>
          </div>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchActivities} style={{ borderRadius: 10, fontWeight: 600 }}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} style={{ borderRadius: 10, fontWeight: 600 }}>新增活动</Button>
        </Space>
      </div>

      {/* 统计卡 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 16, marginBottom: 20 }}>
        {statCards.map(card => (
          <div key={card.key} style={{ background: card.gradient, borderRadius: 16, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              {statIcons[card.key]}
            </div>
            <div>
              <Text style={{ fontSize: 14, color: '#8c8c8c', fontWeight: 500 }}>{card.label}</Text>
              <div style={{ fontSize: 28, fontWeight: 800, color: card.color, marginTop: 2 }}>{card.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 筛选区与表格 */}
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.04)' }}>
        <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <Space wrap>
            <Select
              allowClear
              placeholder="全部类型"
              style={{ width: 140, borderRadius: 10 }}
              value={activityType}
              onChange={v => setActivityType(v)}
              options={activityTypes.map(v => ({ value: v, label: v }))}
            />
            <Select
              allowClear
              placeholder="报名状态"
              style={{ width: 130, borderRadius: 10 }}
              value={activityReserveFilter}
              onChange={v => setActivityReserveFilter(v)}
              options={[{ value: 1, label: '开放报名' }, { value: 0, label: '未开放' }]}
            />
            <Select
              allowClear
              placeholder="上架状态"
              style={{ width: 130, borderRadius: 10 }}
              value={activityEnableFilter}
              onChange={v => setActivityEnableFilter(v)}
              options={[{ value: 1, label: '已上架' }, { value: 0, label: '已下架' }]}
            />
            <Input
              placeholder="关键词搜索"
              style={{ width: 180, borderRadius: 10 }}
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              onPressEnter={handleSearch}
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            />
            <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch} ghost style={{ borderRadius: 10, fontWeight: 600, boxShadow: '0 2px 8px rgba(22,119,255,0.2)' }}>搜索</Button>
            <Button onClick={handleReset} style={{ borderRadius: 10, fontWeight: 600 }}>重置</Button>
          </Space>
        </div>

        <div className="admin-panel">
          <Table rowKey="id" loading={loading} columns={columns} dataSource={filteredActivities} rowClassName={() => 'admin-table-row'} />
        </div>
      </div>

      {/* 新增/编辑弹窗 */}
      <Modal
        title={<span style={{ fontSize: 16, fontWeight: 700 }}>{editingActivity ? '编辑活动' : '新增活动'}</span>}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        confirmLoading={saving}
        width={720}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="activityTitle" label="活动标题" rules={[{ required: true, message: '请输入活动标题' }]}><Input prefix={<CalendarOutlined />} /></Form.Item>
          <Form.Item name="activityDesc" label="活动说明/地点描述" rules={[{ required: true, message: '请输入活动说明' }]}><Input.TextArea rows={3} /></Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="activityType" label="活动类型" rules={[{ required: true, message: '请选择活动类型' }]}>
              <Select options={activityTypes.map(v => ({ value: v, label: v }))} />
            </Form.Item>
            <Form.Item name="activityTime" label="活动时间" rules={[{ required: true, message: '请选择活动时间' }]}>
              <Input type="datetime-local" />
            </Form.Item>
            <Form.Item name="activitySpotId" label="关联点位">
              <Select allowClear showSearch optionFilterProp="label" options={spots.map(s => ({ value: s.id, label: s.spotName }))} />
            </Form.Item>
            <Form.Item name="reserveLimit" label="报名名额（0 为不限）" rules={[{ required: true, message: '请输入报名名额' }]}>
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
          </div>
          <Form.Item name="suitableMode" label="适用人群">
            <Select mode="multiple" options={userModes} />
          </Form.Item>
          <Form.Item label="活动封面图">
            <Upload customRequest={handleCustomRequest} showUploadList={false} accept="image/png, image/jpeg, image/jpg, image/webp">
              <Button icon={<UploadOutlined />} loading={uploading}>点击上传</Button>
            </Upload>
            {imageUrl && (
              <div style={{ marginTop: 8, position: 'relative', display: 'inline-block' }}>
                <Image src={getFullImageUrl(imageUrl)} style={{ maxHeight: 100, borderRadius: 4, objectFit: 'cover' }} />
                <Button size="small" danger type="primary" style={{ position: 'absolute', top: -10, right: -10, zIndex: 10 }}
                  onClick={(e) => { e.stopPropagation(); setImageUrl(undefined); form.setFieldsValue({ activityImage: null }); }}
                  icon={<DeleteOutlined />} shape="circle" />
              </div>
            )}
            <div style={{ display: 'none' }}><Form.Item name="activityImage"><Input /></Form.Item></div>
          </Form.Item>
          <Space size={32}>
            <Form.Item name="isReserve" label="开放报名" valuePropName="checked"><Switch /></Form.Item>
            <Form.Item name="isEnable" label="上架展示" valuePropName="checked"><Switch /></Form.Item>
          </Space>
        </Form>
      </Modal>
      <style>{`.admin-table-row { transition: background 0.2s; } .admin-table-row:hover { background: #fafcff !important; } .admin-table-row td { padding-top: 14px !important; padding-bottom: 14px !important; }`}</style>
    </div>
  );
}
