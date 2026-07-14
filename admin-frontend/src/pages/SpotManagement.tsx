import { useState, useEffect, useRef } from 'react';
import { Table, Button, Select, Modal, Form, Input, Typography, Tag, Space, message, Card, Badge, Row, Col, InputNumber, Radio, Upload, Image } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, EnvironmentOutlined, ReloadOutlined, UnorderedListOutlined, UploadOutlined, PictureOutlined } from '@ant-design/icons';
import request from '@/utils/request';
import AMapLoader from '@amap/amap-jsapi-loader';
import { uploadImage } from '@/api/upload';

const { Title, Text } = Typography;
declare const AMap: any;

const spotTypeMap: Record<string, string> = {
  '教学场馆': '教学场馆',
  '宿舍生活区': '宿舍生活区',
  '餐饮美食': '餐饮美食',
  '便民服务': '便民服务',
  '运动场地': '运动场地',
  '绿化景观': '绿化景观',
};

const spotTypeColorMap: Record<string, string> = {
  '教学场馆': '#4a7c9b',
  '宿舍生活区': '#5da668',
  '餐饮美食': '#d49065',
  '便民服务': '#9b7bc0',
  '运动场地': '#c47575',
  '绿化景观': '#5ca9a0',
};

const SPOT_TYPES = ['全部', '教学场馆', '宿舍生活区', '餐饮美食', '便民服务', '运动场地', '绿化景观'];
const userModeOptions = [
  { value: 'fresh', label: '新生' },
  { value: 'alumni', label: '校友' },
  { value: 'parent', label: '家长' },
  { value: 'research', label: '访客' },
  { value: 'senior', label: '长者' },
];

const SHANHAI_UNIVERSITY = { lng: 119.5394, lat: 39.9065 };

interface CampusSpot {
  id: number;
  spotName: string;
  spotDesc: string;
  spotType: string;
  longitude: number;
  latitude: number;
  openTime: string;
  recommendTime: number;
  spotImage: string;
  suitableMode: string;
  isEnable: number;
  createTime: string;
}

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

export default function SpotManagement() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [spots, setSpots] = useState<CampusSpot[]>([]);
  
  // 视图与筛选条件
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [spotType, setSpotType] = useState<string>('全部');
  const [searchValue, setSearchValue] = useState('');
  const [enableFilter, setEnableFilter] = useState<number | undefined>();
  const [modeFilter, setModeFilter] = useState<string>();
  
  // 弹窗与表单
  const [modalVisible, setModalVisible] = useState(false);
  const [editingSpot, setEditingSpot] = useState<CampusSpot | null>(null);
  const [form] = Form.useForm();
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  
  // 弹窗地图相关
  const modalMapRef = useRef<HTMLDivElement>(null);
  const modalMapInstance = useRef<any>(null);
  const modalMarkerRef = useRef<any>(null);

  // 全局大地图相关
  const globalMapRef = useRef<HTMLDivElement>(null);
  const globalMapInstance = useRef<any>(null);
  const globalMarkersRef = useRef<any[]>([]);
  const globalLabelsRef = useRef<any[]>([]);

  useEffect(() => {
    fetchSpots();
  }, []);

  // --- 全局大地图逻辑 ---
  useEffect(() => {
    if (viewMode === 'map') {
      setTimeout(initGlobalMap, 100);
    } else {
      if (globalMapInstance.current) {
        globalMapInstance.current.destroy();
        globalMapInstance.current = null;
        globalMarkersRef.current = [];
        globalLabelsRef.current = [];
      }
    }
  }, [viewMode]);

  useEffect(() => {
    if (viewMode === 'map' && globalMapInstance.current) {
      renderGlobalMarkers();
    }
  }, [spots, spotType, searchValue, viewMode]);

  const initGlobalMap = async () => {
    if (!globalMapRef.current) return;
    try {
      (window as any)._AMapSecurityConfig = { securityJsCode: '6e5ecf68aa8ff1dfe7c00bac49a2f2cc' };
      const AMapAPI = await AMapLoader.load({ key: '40d5237c9c83851a446150fdd697c90f', version: '2.0' });

      globalMapInstance.current = new AMapAPI.Map(globalMapRef.current, {
        center: [SHANHAI_UNIVERSITY.lng, SHANHAI_UNIVERSITY.lat],
        zoom: 17,
        features: ['bg', 'road', 'building'],
      });

      renderGlobalMarkers();
    } catch (err) {
      console.error('全局地图加载失败:', err);
    }
  };

  const renderGlobalMarkers = () => {
    if (!globalMapInstance.current) return;

    globalMarkersRef.current.forEach(m => globalMapInstance.current.remove(m));
    globalLabelsRef.current.forEach(l => globalMapInstance.current.remove(l));
    globalMarkersRef.current = [];
    globalLabelsRef.current = [];

    const filteredSpots = spots.filter(spot => {
      const matchesType = spotType === '全部' || spot.spotType === spotType;
      const matchesSearch = !searchValue || spot.spotName.includes(searchValue);
      return matchesType && matchesSearch && spot.isEnable === 1;
    });

    filteredSpots.forEach((spot) => {
      const color = spotTypeColorMap[spot.spotType] || '#6b7280';
      const markerContent = `
        <div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>
      `;
      const marker = new AMap.Marker({
        position: [spot.longitude, spot.latitude],
        content: markerContent,
        offset: new AMap.Pixel(-7, -7),
      });

      const label = new AMap.Text({
        text: spot.spotName,
        position: [spot.longitude, spot.latitude],
        offset: new AMap.Pixel(15, -15),
        style: {
          fontSize: '12px',
          fontWeight: 'bold',
          fillColor: color,
          backgroundColor: 'rgba(255,255,255,0.9)',
          borderColor: 'transparent',
          padding: '2px 6px',
          borderRadius: '4px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
        }
      });

      marker.on('click', () => {
        handleEdit(spot);
      });

      globalMapInstance.current.add(marker);
      globalMapInstance.current.add(label);
      globalMarkersRef.current.push(marker);
      globalLabelsRef.current.push(label);
    });
  };

  const fetchSpots = async () => {
    setLoading(true);
    try {
      const response = await request.get('/admin/spots', {
        params: { includeDisabled: true },
      });
      setSpots(response.data || []);
    } catch (err) {
      console.error('Failed to fetch spots:', err);
      message.error(getErrorMessage(err, '点位列表加载失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (modalVisible) {
      setTimeout(initModalMap, 100);
    } else {
      if (modalMapInstance.current) {
        modalMapInstance.current.destroy();
        modalMapInstance.current = null;
        modalMarkerRef.current = null;
      }
    }
  }, [modalVisible]);

  const initModalMap = async () => {
    if (!modalMapRef.current) return;
    try {
      (window as any)._AMapSecurityConfig = { securityJsCode: '6e5ecf68aa8ff1dfe7c00bac49a2f2cc' };
      const AMapAPI = await AMapLoader.load({ key: '40d5237c9c83851a446150fdd697c90f', version: '2.0' });

      const centerLng = form.getFieldValue('longitude') || SHANHAI_UNIVERSITY.lng;
      const centerLat = form.getFieldValue('latitude') || SHANHAI_UNIVERSITY.lat;

      modalMapInstance.current = new AMapAPI.Map(modalMapRef.current, {
        center: [centerLng, centerLat],
        zoom: 17,
        features: ['bg', 'road', 'building'],
      });

      spots.forEach(spot => {
        if (editingSpot && spot.id === editingSpot.id) return;
        const color = spotTypeColorMap[spot.spotType] || '#ccc';
        const refMarker = new AMapAPI.Marker({
          position: [spot.longitude, spot.latitude],
          content: `<div style="width:10px;height:10px;border-radius:50%;background:${color};border:1px solid #fff;opacity:0.6;" title="${spot.spotName}"></div>`,
          offset: new AMapAPI.Pixel(-5, -5),
          zIndex: 50
        });

        refMarker.on('mouseover', () => {
          refMarker.setLabel({
            content: `<div style="padding:2px 5px;font-size:12px;color:#333;background:#fff;border-radius:3px;box-shadow:0 1px 3px rgba(0,0,0,0.2);">${spot.spotName}</div>`,
            direction: 'top',
            offset: new AMapAPI.Pixel(0, -5)
          });
        });
        refMarker.on('mouseout', () => {
          refMarker.setLabel(null);
        });

        modalMapInstance.current.add(refMarker);
      });

      modalMarkerRef.current = new AMapAPI.Marker({
        position: [centerLng, centerLat],
        icon: 'https://webapi.amap.com/theme/v1.3/markers/n/mark_b.png',
        draggable: true,
        cursor: 'move',
        zIndex: 100
      });

      modalMapInstance.current.add(modalMarkerRef.current);

      if (!form.getFieldValue('longitude')) {
        modalMarkerRef.current.hide();
      }

      modalMapInstance.current.on('click', (e: any) => {
        const { lng, lat } = e.lnglat;
        updateModalMarkerAndForm(lng, lat);
      });

      modalMarkerRef.current.on('dragend', (e: any) => {
        const { lng, lat } = e.lnglat;
        updateModalMarkerAndForm(lng, lat);
      });

    } catch (error) {
      console.error('地图加载失败:', error);
      message.warning('地图服务暂不可用，您可手动输入经纬度');
    }
  };

  const updateModalMarkerAndForm = (lng: number, lat: number) => {
    const lngFixed = Number(lng.toFixed(6));
    const latFixed = Number(lat.toFixed(6));
    if (modalMarkerRef.current) {
      modalMarkerRef.current.setPosition([lngFixed, latFixed]);
      modalMarkerRef.current.show();
    }
    form.setFieldsValue({ longitude: lngFixed, latitude: latFixed });
  };

  const handleCoordinateChange = () => {
    const lng = form.getFieldValue('longitude');
    const lat = form.getFieldValue('latitude');
    if (lng && lat && modalMapInstance.current && modalMarkerRef.current) {
      modalMarkerRef.current.setPosition([lng, lat]);
      modalMarkerRef.current.show();
      modalMapInstance.current.setCenter([lng, lat]);
    }
  };

  const handleAdd = () => {
    setEditingSpot(null);
    setImageUrl(undefined);
    form.resetFields();
    form.setFieldsValue({ recommendTime: 15, isEnable: 1 });
    setModalVisible(true);
  };

  const handleEdit = (spot: CampusSpot) => {
    setEditingSpot(spot);
    setImageUrl(spot.spotImage);
    form.setFieldsValue({
      ...spot,
      suitableMode: spot.suitableMode ? spot.suitableMode.split(',') : [],
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除该点位吗？删除后用户将无法在地图上看到它。',
      okText: '确认删除',
      okType: 'danger',
      onOk: async () => {
        try {
          await request.delete(`/spot/${id}`);
          message.success('删除成功');
          fetchSpots();
        } catch (err) {
          message.error(getErrorMessage(err, '删除失败'));
        }
      },
    });
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
        form.setFieldsValue({ spotImage: url });
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

  const handleSubmit = async (values: CampusSpot) => {
    setSaving(true);
    try {
      const payload = {
        ...values,
        // imageUrl 为 undefined 表示用户主动删除图片，发送空字符串以通知后端清除该字段
        spotImage: imageUrl ?? '',
        suitableMode: Array.isArray((values as any).suitableMode) ? (values as any).suitableMode.join(',') : (values as any).suitableMode,
      };
      if (editingSpot) {
        await request.put(`/spot/${editingSpot.id}`, payload);
        message.success('更新成功');
      } else {
        await request.post('/spot', payload);
        message.success('创建成功');
      }
      setModalVisible(false);
      fetchSpots();
    } catch (err) {
      message.error(getErrorMessage(err, editingSpot ? '更新失败' : '创建失败'));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (spot: CampusSpot, checked: boolean) => {
    try {
      await request.put(`/spot/${spot.id}`, { isEnable: checked ? 1 : 0 });
      message.success(checked ? '已启用该点位' : '已停用该点位');
      fetchSpots();
    } catch (err) {
      message.error(getErrorMessage(err, '操作失败'));
    }
  };

  const getTagColor = (type: string): string => spotTypeColorMap[type] ? spotTypeMap[type] === '教学场馆' ? 'blue' : spotTypeMap[type] === '宿舍生活区' ? 'green' : spotTypeMap[type] === '餐饮美食' ? 'orange' : spotTypeMap[type] === '便民服务' ? 'purple' : spotTypeMap[type] === '运动场地' ? 'red' : 'cyan' : 'default';

  const columns = [
    {
      title: '图片',
      dataIndex: 'spotImage',
      key: 'spotImage',
      width: 80,
      render: (img: string) => {
        const fullUrl = getFullImageUrl(img);
        return fullUrl ? (
          <Image src={fullUrl} width={40} height={40} style={{ objectFit: 'cover', borderRadius: '4px' }} fallback="https://gw.alipayobjects.com/zos/rmsportal/JiqGstEfoWAOHiTxclqi.png" />
        ) : (
          <div style={{ width: 40, height: 40, background: '#f0f0f0', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
            <PictureOutlined />
          </div>
        );
      }
    },
    {
      title: '点位名称',
      dataIndex: 'spotName',
      key: 'spotName',
      width: 160,
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: '分类',
      dataIndex: 'spotType',
      key: 'spotType',
      width: 100,
      render: (type: string) => <Tag color={getTagColor(type)}>{type}</Tag>,
    },
    {
      title: '坐标 (经度, 纬度)',
      key: 'coordinates',
      width: 180,
      render: (_: any, record: CampusSpot) => (
        <Space size="small">
          <EnvironmentOutlined style={{ color: '#1890ff' }} />
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.longitude}, {record.latitude}
          </Text>
        </Space>
      ),
    },
    {
      title: '适用人群',
      dataIndex: 'suitableMode',
      key: 'suitableMode',
      width: 150,
      render: (mode: string) => {
        if (!mode) return <Text type="secondary">所有人</Text>;
        const modes = mode.split(',');
        return (
          <Space size={[0, 4]} wrap>
            {modes.map(m => {
              const label = userModeOptions.find(opt => opt.value === m)?.label || m;
              return <Tag key={m} bordered={false}>{label}</Tag>;
            })}
          </Space>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'isEnable',
      key: 'isEnable',
      width: 100,
      render: (enabled: number) => (
        <Badge 
          status={enabled === 1 ? 'success' : 'default'} 
          text={<span style={{ color: enabled === 1 ? '#52c41a' : '#999' }}>{enabled === 1 ? '使用中' : '已停用'}</span>} 
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_: unknown, record: CampusSpot) => (
        <Space>
          <Button type="link" size="small" danger={record.isEnable === 1} onClick={() => handleUpdateStatus(record, record.isEnable !== 1)} style={{ padding: 0 }}>
            {record.isEnable === 1 ? '停用' : '启用'}
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} style={{ padding: 0 }}>
            编辑
          </Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} style={{ padding: 0 }}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const filteredSpots = spots.filter(spot => {
    const matchesType = spotType === '全部' || spot.spotType === spotType;
    const matchesSearch = !searchValue || spot.spotName.includes(searchValue) || spot.spotDesc?.includes(searchValue);
    const matchesEnable = enableFilter === undefined || spot.isEnable === enableFilter;
    const matchesMode = !modeFilter || (spot.suitableMode && spot.suitableMode.includes(modeFilter));
    return matchesType && matchesSearch && matchesEnable && matchesMode;
  });

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="admin-toolbar" style={{ marginBottom: 20, flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg, #52c41a, #73d13d)', boxShadow: '0 4px 12px rgba(82,196,26,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <EnvironmentOutlined style={{ color: '#fff', fontSize: 20 }} />
            </div>
            <div>
              <Title level={4} style={{ margin: 0, color: '#0f344e' }}>点位资源管理</Title>
              <Text type="secondary" style={{ fontSize: 13 }}>管理校园地图上的所有地标、建筑与服务点位</Text>
            </div>
          </div>
          <Radio.Group value={viewMode} onChange={e => setViewMode(e.target.value)} buttonStyle="solid">
            <Radio.Button value="list"><UnorderedListOutlined /> 列表视图</Radio.Button>
            <Radio.Button value="map"><EnvironmentOutlined /> 地图大盘</Radio.Button>
          </Radio.Group>
        </div>
      </div>

      <Card bordered={false} className="shadow-sm" style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.04)' }} bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column', padding: viewMode === 'map' ? 0 : 24 }}>
        {viewMode === 'list' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <Space wrap>
              <Input
                placeholder="搜索点位名称..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                style={{ width: 200, borderRadius: 10 }}
                allowClear
              />
              <Select
                value={spotType}
                onChange={setSpotType}
                style={{ width: 140, borderRadius: 10 }}
                options={SPOT_TYPES.map(type => ({ value: type, label: type }))}
              />
              <Select
                allowClear
                placeholder="启用状态"
                style={{ width: 110, borderRadius: 10 }}
                value={enableFilter}
                onChange={v => setEnableFilter(v)}
                options={[{ value: 1, label: '已启用' }, { value: 0, label: '已停用' }]}
              />
              <Select
                allowClear
                placeholder="适用身份"
                style={{ width: 110, borderRadius: 10 }}
                value={modeFilter}
                onChange={v => setModeFilter(v)}
                options={userModeOptions}
              />
              <Button onClick={() => { setSearchValue(''); setSpotType('全部'); setEnableFilter(undefined); setModeFilter(undefined); }} style={{ borderRadius: 10, fontWeight: 600 }}>重置</Button>
              <Button icon={<ReloadOutlined />} onClick={fetchSpots} style={{ borderRadius: 10, fontWeight: 600 }}>刷新</Button>
            </Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAdd}
              style={{ background: '#1a5c8a', borderRadius: 10, fontWeight: 600, boxShadow: '0 2px 8px rgba(22,119,255,0.2)' }}
            >
              新增点位
            </Button>
          </div>
        )}

        {viewMode === 'list' ? (
          <div className="admin-panel">
            <Table
            dataSource={filteredSpots}
            columns={columns}
            rowKey="id"
            rowClassName={() => 'admin-table-row'}
            loading={loading}
            pagination={{
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 个点位`,
              defaultPageSize: 10,
            }}
            scroll={{ x: 1000 }}
          />
          </div>
        ) : (
          <div style={{ position: 'relative', width: '100%', height: 'calc(100vh - 200px)' }}>
            <div ref={globalMapRef} style={{ width: '100%', height: '100%' }}></div>
            <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 10, background: 'rgba(255,255,255,0.9)', padding: '12px 16px', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.1)' }}>
              <Space direction="vertical" size="small">
                <Text strong>地图筛选</Text>
                <Select
                  value={spotType}
                  onChange={setSpotType}
                  style={{ width: 150 }}
                  options={SPOT_TYPES.map(type => ({ value: type, label: type }))}
                  size="small"
                />
                <Button 
                  type="primary" 
                  icon={<PlusOutlined />}
                  onClick={handleAdd}
                  style={{ background: '#1a5c8a', width: '100%', marginTop: 8 }}
                  size="small"
                >
                  新增点位
                </Button>
              </Space>
            </div>
          </div>
        )}
      </Card>

      <Modal
        title={<span style={{ fontSize: 16, fontWeight: 700 }}>{editingSpot ? '编辑点位' : '新增校园点位'}</span>}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={1000}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          style={{ marginTop: 24 }}
        >
          <Row gutter={32}>
            {/* 左侧：表单录入区 */}
            <Col span={10}>
              <Form.Item
                name="spotName"
                label="点位名称"
                rules={[{ required: true, message: '请输入点位名称' }]}
              >
                <Input placeholder="例如：山海大学知海图书馆" />
              </Form.Item>

              <Form.Item
                name="spotType"
                label="分类标签"
                rules={[{ required: true, message: '请选择点位分类' }]}
              >
                <Select placeholder="选择分类" options={Object.keys(spotTypeMap).map(k => ({ label: k, value: k }))} />
              </Form.Item>
              
              <Form.Item label="点位图片">
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
                      onClick={(e) => { e.stopPropagation(); setImageUrl(undefined); form.setFieldsValue({ spotImage: null }); }}
                      icon={<DeleteOutlined />}
                      shape="circle"
                    />
                  </div>
                )}
                <div style={{ display: 'none' }}>
                  <Form.Item name="spotImage">
                    <Input />
                  </Form.Item>
                </div>
              </Form.Item>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="longitude"
                    label="经度 (Lng)"
                    rules={[{ required: true, message: '请输入经度' }]}
                  >
                    <InputNumber style={{ width: '100%' }} precision={6} onChange={handleCoordinateChange} placeholder="119.5394" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="latitude"
                    label="纬度 (Lat)"
                    rules={[{ required: true, message: '请输入纬度' }]}
                  >
                    <InputNumber style={{ width: '100%' }} precision={6} onChange={handleCoordinateChange} placeholder="39.9065" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                name="suitableMode"
                label="推荐适宜人群"
                tooltip="留空表示所有身份的用户均可见并推荐该点位"
              >
                <Select mode="multiple" placeholder="不限人群" options={userModeOptions} allowClear />
              </Form.Item>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="recommendTime"
                    label="建议游览时长 (分钟)"
                  >
                    <InputNumber style={{ width: '100%' }} min={5} max={300} placeholder="15" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="openTime"
                    label="开放时间"
                  >
                    <Input placeholder="如: 08:00-22:00" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="isEnable" label="启用状态" valuePropName="checked" getValueProps={(val) => ({ checked: val === 1 })} normalize={(val) => val ? 1 : 0}>
                <Select options={[{ label: '正常展示', value: 1 }, { label: '临时停用', value: 0 }]} />
              </Form.Item>
            </Col>

            {/* 右侧：地图选点与详细信息 */}
            <Col span={14}>
              <Form.Item label="地图快捷选点 (可点击或拖拽蓝色图标)">
                <div 
                  ref={modalMapRef} 
                  style={{ 
                    height: 350, 
                    width: '100%', 
                    borderRadius: 8, 
                    border: '1px solid #d9d9d9',
                    overflow: 'hidden',
                    background: '#f0f2f5',
                    position: 'relative'
                  }}
                ></div>
                <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    提示：地图上已标记<span style={{color: '#666'}}>半透明圆点</span>为附近已有设施，您可以参考它们的位置避免重复添加。拖拽蓝色大头针进行精准定位。
                  </Text>
                </div>
              </Form.Item>

              <Form.Item
                name="spotDesc"
                label="详细描述"
                rules={[{ required: true, message: '请输入点位描述' }]}
                style={{ marginTop: 16 }}
              >
                <Input.TextArea placeholder="用一两句话描述该点位的特色..." rows={3} showCount maxLength={200} />
              </Form.Item>
            </Col>
          </Row>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit" loading={saving} style={{ background: '#1a5c8a', width: 120 }}>
                {editingSpot ? '保存修改' : '确认创建'}
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>
      <style>{`.admin-table-row { transition: background 0.2s; } .admin-table-row:hover { background: #fafcff !important; } .admin-table-row td { padding-top: 14px !important; padding-bottom: 14px !important; }`}</style>
    </div>
  );
}
