import { useState, useEffect } from 'react';
import { Table, Button, Select, Modal, Form, Input, Typography, Tag, Empty, Space, message, Card, Checkbox, Tooltip, Popconfirm, Upload, Image } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UpOutlined, DownOutlined, UploadOutlined, PictureOutlined, ReloadOutlined, CompassOutlined, SearchOutlined } from '@ant-design/icons';
import request from '@/utils/request';
import { getSpots, type CampusSpot } from '@/api/spot';
import { uploadImage } from '@/api/upload';

const { Title, Text } = Typography;

interface CampusRoute {
  id: number;
  routeName: string;
  routeDesc: string;
  totalMinute: number;
  spotOrderJson: string;
  suitableMode: string;
  coverImage: string;
  isEnable: number;
  createTime: string;
}

const userModeOptions = [
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

export default function RouteManagement() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [allRoutes, setAllRoutes] = useState<CampusRoute[]>([]);
  const [spots, setSpots] = useState<CampusSpot[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [routeType, setRouteType] = useState<string>('');
  const [routeKeyword, setRouteKeyword] = useState('');
  const [routeEnableFilter, setRouteEnableFilter] = useState<number | undefined>();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRoute, setEditingRoute] = useState<CampusRoute | null>(null);
  const [form] = Form.useForm();
  const [selectedSpots, setSelectedSpots] = useState<number[]>([]);
  const [spotOrder, setSpotOrder] = useState<number[]>([]);
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | undefined>();

  useEffect(() => {
    fetchRoutes();
    fetchSpots();
  }, [pagination.current, pagination.pageSize, routeType]);

  const fetchRoutes = async () => {
    setLoading(true);
    try {
      const response = await request.get('/admin/routes', {
        params: {
          routeType: routeType || undefined,
          userMode: routeType || undefined,
          includeDisabled: true,
        },
      });
      setAllRoutes(response.data || []);
      setPagination(prev => ({ ...prev, total: response.data?.length || 0 }));
    } catch (err) {
      console.error('Failed to fetch routes:', err);
      message.error(getErrorMessage(err, '路线列表加载失败'));
    } finally {
      setLoading(false);
    }
  };

  const fetchSpots = async () => {
    try {
      const response = await getSpots(true) as any;
      setSpots(response.data || []);
    } catch (err) {
      console.error('Failed to fetch spots:', err);
      message.error(getErrorMessage(err, '点位列表加载失败'));
    }
  };

  const handleAdd = () => {
    setEditingRoute(null);
    setImageUrl(undefined);
    form.resetFields();
    setSelectedSpots([]);
    setSpotOrder([]);
    setModalVisible(true);
  };

  const handleEdit = (route: CampusRoute) => {
    setEditingRoute(route);
    setImageUrl(route.coverImage);
    form.setFieldsValue({
      routeName: route.routeName,
      routeDesc: route.routeDesc,
      totalMinute: route.totalMinute,
      suitableMode: route.suitableMode?.split(',') || [],
      coverImage: route.coverImage,
      isEnable: route.isEnable,
    });
    let order: number[] = [];
    try { order = route.spotOrderJson ? JSON.parse(route.spotOrderJson) : []; } catch { order = []; }
    setSelectedSpots(order);
    setSpotOrder(order);
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await request.delete(`/route/${id}`);
      message.success('路线删除成功');
      fetchRoutes();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '删除失败');
    }
  };

  const handleToggleEnable = async (record: CampusRoute) => {
    try {
      const newEnable = record.isEnable === 1 ? 0 : 1;
      await request.put(`/route/${record.id}`, { isEnable: newEnable });
      message.success(newEnable === 1 ? '路线已启用' : '路线已停用');
      fetchRoutes();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '状态更新失败');
    }
  };

  const handleCustomRequest = async (options: any) => {
    const { file, onSuccess, onError } = options;
    setUploading(true);
    try {
      // request.ts 响应拦截器已返回 response.data（即 {code, message, data}），
      // 所以 res 直接就是后端 ApiResponse 对象，无需再 .data
      const res = await uploadImage(file as File);
      if (res.code === 200) {
        const url = res.data?.url || '';
        setImageUrl(url);
        form.setFieldsValue({ coverImage: url });
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
    if (spotOrder.length === 0) {
      message.warning('请至少选择一个点位');
      return;
    }
    setSaving(true);
    try {
      const routeData = {
        ...values,
        // imageUrl 为 undefined 表示用户主动删除图片，发送空字符串通知后端清除
        coverImage: imageUrl ?? '',
        spotOrderJson: JSON.stringify(spotOrder),
        suitableMode: Array.isArray(values.suitableMode) ? values.suitableMode.join(',') : values.suitableMode,
      };

      if (editingRoute) {
        await request.put(`/route/${editingRoute.id}`, routeData);
        message.success('更新成功');
      } else {
        await request.post('/route', routeData);
        message.success('创建成功');
      }
      setModalVisible(false);
      fetchRoutes();
    } catch (err) {
      message.error(getErrorMessage(err, editingRoute ? '更新失败' : '创建失败'));
      console.error('Failed to save route:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleSpotSelect = (spotId: number, checked: boolean) => {
    if (checked) {
      setSelectedSpots([...selectedSpots, spotId]);
      setSpotOrder([...spotOrder, spotId]);
    } else {
      setSelectedSpots(selectedSpots.filter(id => id !== spotId));
      setSpotOrder(spotOrder.filter(id => id !== spotId));
    }
  };

  const moveSpot = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...spotOrder];
    if (direction === 'up' && index > 0) {
      [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]];
    } else if (direction === 'down' && index < newOrder.length - 1) {
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    }
    setSpotOrder(newOrder);
  };

  const getSpotName = (spotId: number) => {
    const spot = spots.find(s => s.id === spotId);
    return spot ? spot.spotName : `点位${spotId}`;
  };

  const columns = [
    {
      title: '序号',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '封面',
      dataIndex: 'coverImage',
      key: 'coverImage',
      width: 80,
      render: (img: string) => {
        const fullUrl = getFullImageUrl(img);
        return fullUrl ? (
          <Image src={fullUrl} width={60} height={40} style={{ objectFit: 'cover', borderRadius: '4px' }} fallback="https://gw.alipayobjects.com/zos/rmsportal/JiqGstEfoWAOHiTxclqi.png" />
        ) : (
          <div style={{ width: 60, height: 40, background: '#f0f0f0', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
            <PictureOutlined />
          </div>
        );
      }
    },
    {
      title: '路线名称',
      dataIndex: 'routeName',
      key: 'routeName',
      width: 150,
    },
    {
      title: '适用模式',
      dataIndex: 'suitableMode',
      key: 'suitableMode',
      width: 150,
      render: (mode: string) => (
        <div>
          {mode?.split(',').map((m, i) => (
            <Tag key={i} color="blue" style={{ marginBottom: 4 }}>
              {userModeOptions.find(o => o.value === m)?.label || m}
            </Tag>
          ))}
        </div>
      ),
    },
    {
      title: '描述',
      dataIndex: 'routeDesc',
      key: 'routeDesc',
      ellipsis: true,
      width: 250,
    },
    {
      title: '点位数量',
      key: 'spotCount',
      width: 100,
      render: (_: unknown, record: CampusRoute) => {
        const spots = record.spotOrderJson ? JSON.parse(record.spotOrderJson) : [];
        return spots.length;
      },
    },
    {
      title: '预计时长',
      dataIndex: 'totalMinute',
      key: 'totalMinute',
      width: 100,
      render: (duration: number) => `${duration}分钟`,
    },
    {
      title: '状态',
      dataIndex: 'isEnable',
      key: 'isEnable',
      width: 80,
      render: (enabled: number) => (
        <Tag color={enabled === 1 ? 'green' : 'red'}>
          {enabled === 1 ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right' as const,
      render: (_: unknown, record: CampusRoute) => (
        <Space size="small">
          <Button 
            type="link" 
            size="small"
            danger={record.isEnable === 1}
            onClick={() => handleToggleEnable(record)}
          >
            {record.isEnable === 1 ? '停用' : '启用'}
          </Button>
          <Button 
            type="link" 
            size="small"
            icon={<EditOutlined />} 
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm title="确定要删除该路线吗？" onConfirm={() => handleDelete(record.id)}>
            <Button 
              type="link" 
              size="small"
              danger 
              icon={<DeleteOutlined />} 
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="admin-toolbar" style={{ marginBottom: 20, flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg, #722ed1, #9254de)', boxShadow: '0 4px 12px rgba(114,46,209,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <CompassOutlined style={{ color: '#fff', fontSize: 20 }} />
            </div>
            <div>
              <Title level={4} style={{ margin: 0, color: '#531dab' }}>路线管理</Title>
              <Text type="secondary" style={{ fontSize: 13 }}>管理校园导览路线与行程规划</Text>
            </div>
          </div>
          <Space wrap>
          <Input
            placeholder="搜索路线名称"
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            style={{ width: 160, borderRadius: 10 }}
            value={routeKeyword}
            onChange={e => setRouteKeyword(e.target.value)}
            allowClear
          />
          <Select
            placeholder="适用身份"
            value={routeType}
            onChange={(value) => {
              setRouteType(value);
              setPagination(prev => ({ ...prev, current: 1 }));
            }}
            className="admin-select-rounded"
            style={{ width: 130, borderRadius: 10 }}
            options={[
              { value: '', label: '全部' },
              ...userModeOptions,
            ]}
          />
          <Select
            allowClear
            placeholder="启用状态"
            className="admin-select-rounded"
            style={{ width: 110, borderRadius: 10 }}
            value={routeEnableFilter}
            onChange={v => setRouteEnableFilter(v)}
            options={[{ value: 1, label: '已启用' }, { value: 0, label: '已停用' }]}
          />
          <Button onClick={() => { setRouteKeyword(''); setRouteType(''); setRouteEnableFilter(undefined); }} style={{ borderRadius: 10, fontWeight: 600 }}>重置</Button>
          <Button icon={<ReloadOutlined />} onClick={fetchRoutes} style={{ borderRadius: 10, fontWeight: 600 }}>刷新</Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAdd}
            style={{ background: '#1a5c8a', borderRadius: 10, fontWeight: 600, boxShadow: '0 2px 8px rgba(22,119,255,0.2)' }}
          >
            新增路线
          </Button>
        </Space>
      </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.04)' }}>
        {(() => {
          const filtered = allRoutes.filter(r => {
            const kw = routeKeyword.trim();
            const matchKw = !kw || r.routeName.includes(kw) || r.routeDesc?.includes(kw);
            const matchType = !routeType || r.suitableMode?.includes(routeType);
            const matchEnable = routeEnableFilter === undefined || r.isEnable === routeEnableFilter;
            return matchKw && matchType && matchEnable;
          });
          return filtered.length > 0 ? (
            <div className="admin-panel">
              <Table
              dataSource={filtered}
              columns={columns}
              rowKey="id"
              loading={loading}
              scroll={{ x: 1200 }}
              pagination={{ showTotal: t => `共 ${t} 条路线` }}
              rowClassName={() => 'admin-table-row'}
              bordered={false}
            />
            </div>
          ) : (
            <Empty description="暂无路线数据" />
          );
        })()}
      </div>

      <Modal
        title={<span style={{ fontSize: 16, fontWeight: 700 }}>{editingRoute ? '编辑路线' : '新增路线'}</span>}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={900}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div>
              <Form.Item
                name="routeName"
                label="路线名称"
                rules={[{ required: true, message: '请输入路线名称' }]}
              >
                <Input placeholder="请输入路线名称" />
              </Form.Item>

              <Form.Item
                name="routeDesc"
                label="路线描述"
                rules={[{ required: true, message: '请输入路线描述' }]}
              >
                <Input.TextArea placeholder="请输入路线描述" rows={3} />
              </Form.Item>

              <Form.Item
                name="suitableMode"
                label="适用模式"
                rules={[{ required: true, message: '请选择适用模式' }]}
              >
                <Select mode="multiple" placeholder="请选择适用模式">
                  {userModeOptions.map(option => (
                    <Select.Option key={option.value} value={option.value}>
                      {option.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item label="封面图片">
                <Upload
                  customRequest={handleCustomRequest}
                  showUploadList={false}
                  accept="image/png, image/jpeg, image/jpg, image/webp"
                >
                  <Button icon={<UploadOutlined />} loading={uploading}>点击上传</Button>
                </Upload>
                {imageUrl && (
                  <div style={{ marginTop: 8, position: 'relative', display: 'inline-block' }}>
                    <Image src={getFullImageUrl(imageUrl)} style={{ maxHeight: 100, borderRadius: 4, objectFit: 'cover' }} />
                    <Button 
                      size="small" 
                      danger 
                      type="primary" 
                      style={{ position: 'absolute', top: -10, right: -10, zIndex: 10 }}
                      onClick={(e) => { e.stopPropagation(); setImageUrl(undefined); form.setFieldsValue({ coverImage: null }); }}
                      icon={<DeleteOutlined />}
                      shape="circle"
                    />
                  </div>
                )}
                <div style={{ display: 'none' }}>
                  <Form.Item name="coverImage">
                    <Input />
                  </Form.Item>
                </div>
              </Form.Item>

              <Form.Item
                name="totalMinute"
                label="预计时长(分钟)"
                rules={[{ required: true, message: '请输入预计时长' }]}
              >
                <Input type="number" placeholder="请输入时长" />
              </Form.Item>

              <Form.Item name="isEnable" label="状态" initialValue={1}>
                <Select placeholder="请选择状态">
                  <Select.Option value={1}>启用</Select.Option>
                  <Select.Option value={0}>禁用</Select.Option>
                </Select>
              </Form.Item>
            </div>

            <div>
              <Form.Item label="点位选择与排序">
                <Card style={{ marginBottom: 12 }} title="可用点位" size="small">
                  <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                    {spots.length > 0 ? (
                      spots.map(spot => (
                        <div key={spot.id} style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          padding: '8px 0',
                          borderBottom: '1px solid #f0f0f0',
                        }}>
                          <Checkbox 
                            checked={selectedSpots.includes(spot.id)}
                            onChange={(e: any) => handleSpotSelect(spot.id, e.target.checked)}
                            style={{ marginRight: 12 }}
                          />
                          <span style={{ flex: 1 }}>{spot.spotName}</span>
                          <Tag color="gray" style={{ fontSize: '10px' }}>
                            {spot.spotType}
                          </Tag>
                        </div>
                      ))
                    ) : (
                      <Empty description="暂无点位数据" />
                    )}
                  </div>
                </Card>

                <Card title="路线点位顺序" size="small">
                  <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                    {spotOrder.length > 0 ? (
                      spotOrder.map((spotId, index) => (
                        <div key={spotId} style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          padding: '8px 0',
                          borderBottom: '1px solid #f0f0f0',
                          background: index === 0 ? '#f0f5ff' : index === spotOrder.length - 1 ? '#fff3f0' : '#fff',
                        }}>
                          <span style={{ width: 24, textAlign: 'center', marginRight: 8 }}>
                            {index + 1}
                          </span>
                          <span style={{ flex: 1 }}>
                            {index === 0 && <span style={{ color: '#1a5c8a', fontWeight: 'bold' }}>起点：</span>}
                            {index === spotOrder.length - 1 && <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>终点：</span>}
                            {getSpotName(spotId)}
                          </span>
                          <Space>
                            <Tooltip title="上移">
                              <Button 
                                type="text" 
                                icon={<UpOutlined />} 
                                onClick={() => moveSpot(index, 'up')}
                                disabled={index === 0}
                              />
                            </Tooltip>
                            <Tooltip title="下移">
                              <Button 
                                type="text" 
                                icon={<DownOutlined />} 
                                onClick={() => moveSpot(index, 'down')}
                                disabled={index === spotOrder.length - 1}
                              />
                            </Tooltip>
                          </Space>
                        </div>
                      ))
                    ) : (
                      <Empty description="请从左侧选择点位" />
                    )}
                  </div>
                </Card>
              </Form.Item>
            </div>
          </div>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Button onClick={() => setModalVisible(false)} style={{ marginRight: 8 }}>
              取消
            </Button>
            <Button type="primary" htmlType="submit" loading={saving} style={{ background: '#1a5c8a' }}>
              {editingRoute ? '更新' : '创建'}
            </Button>
          </Form.Item>
        </Form>
      </Modal>
      <style>{`.admin-table-row { transition: background 0.2s; } .admin-table-row:hover { background: #fafcff !important; } .admin-table-row td { padding-top: 14px !important; padding-bottom: 14px !important; } .admin-select-rounded .ant-select-selector { border-radius: 10px !important; }`}</style>
    </div>
  );
}
