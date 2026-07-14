import { useEffect, useMemo, useState } from 'react';
import { Button, Input, Select, Space, Table, Tag, Typography, message } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, LinkOutlined, OrderedListOutlined, ReloadOutlined, ScheduleOutlined, SearchOutlined, StopOutlined } from '@ant-design/icons';
import request from '@/utils/request';

const { Title, Text } = Typography;

interface ReserveRecord {
  id: number;
  sessionId: string;
  activityId: number;
  reserveStatus: number;
  reserveTime: string;
  cancelTime?: string;
}

interface CampusActivity {
  id: number;
  activityTitle: string;
  activityType: string;
  activityTime: string;
}

const getErrorMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

export default function ReservationManagement() {
  const [loading, setLoading] = useState(false);
  const [reserves, setReserves] = useState<ReserveRecord[]>([]);
  const [activities, setActivities] = useState<CampusActivity[]>([]);

  // 筛选条件
  const [status, setStatus] = useState<number | undefined>();
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [reserveResult, activityResult] = await Promise.all([
        request.get('/reserve/admin/list', {
          params: {
            reserveStatus: status,
            sessionId: keyword || undefined,
          },
        }) as any,
        request.get('/activity/list', { params: { includeDisabled: true } }) as any,
      ]);
      setReserves(reserveResult.data || []);
      setActivities(activityResult.data || []);
    } catch (error) {
      console.error('Failed to fetch reservations:', error);
      message.error(getErrorMessage(error, '预约数据加载失败'));
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => fetchData();

  const handleReset = () => {
    setStatus(undefined);
    setKeyword('');
    setTimeout(() => fetchData(), 0);
  };

  const activityMap = useMemo(() => new Map(activities.map(a => [a.id, a])), [activities]);
  const activeCount = reserves.filter(r => r.reserveStatus === 1).length;
  const cancelledCount = reserves.length - activeCount;

  const cancelReserve = async (reserve: ReserveRecord) => {
    try {
      await request.put(`/reserve/admin/${reserve.id}/status`, null, { params: { reserveStatus: 0 } });
      message.success('预约已作废');
      fetchData();
    } catch (error) {
      message.error(getErrorMessage(error, '操作失败'));
    }
  };

  const statCards = [
    { label: '预约总数', value: reserves.length, color: '#1677ff' },
    { label: '有效预约', value: activeCount, color: '#52c41a' },
    { label: '已取消', value: cancelledCount, color: '#ff4d4f' },
    { label: '关联活动', value: new Set(reserves.map(r => r.activityId)).size, color: '#722ed1' },
  ];

  const columns = [
    { title: '预约编号', dataIndex: 'id', key: 'id', width: 100 },
    {
      title: '活动名称', dataIndex: 'activityId', key: 'activityId', width: 200, ellipsis: true,
      render: (value: number) => activityMap.get(value)?.activityTitle || `活动 #${value}`,
    },
    {
      title: '活动类型', dataIndex: 'activityId', key: 'activityType', width: 100,
      render: (value: number) => {
        const t = activityMap.get(value)?.activityType;
        return t ? <Tag color="blue">{t}</Tag> : '-';
      },
    },
    { title: '用户 Session', dataIndex: 'sessionId', key: 'sessionId', ellipsis: true, width: 200 },
    {
      title: '活动时间', dataIndex: 'activityId', key: 'activityTime', width: 160,
      render: (value: number) => activityMap.get(value)?.activityTime?.replace('T', ' ').slice(0, 16) || '-',
    },
    {
      title: '预约时间', dataIndex: 'reserveTime', key: 'reserveTime', width: 160,
      render: (value: string) => value?.replace('T', ' ').slice(0, 16) || '-',
    },
    {
      title: '状态', dataIndex: 'reserveStatus', key: 'reserveStatus', width: 100,
      render: (value: number) => value === 1
        ? <Tag color="green">有效</Tag>
        : <Tag color="default">已取消</Tag>,
    },
    {
      title: '操作', key: 'action', width: 100,
      render: (_: unknown, record: ReserveRecord) => (
        <Button type="link" danger icon={<StopOutlined />} disabled={record.reserveStatus !== 1} onClick={() => cancelReserve(record)}>
          作废
        </Button>
      ),
    },
  ];

  return (
    <div>
      {/* Toolbar */}
      <div className="admin-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg, #1677ff, #4096ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(22,119,255,0.35)' }}>
            <ScheduleOutlined style={{ color: '#fff', fontSize: 20 }} />
          </div>
          <div>
            <Title level={4} style={{ margin: 0, color: '#0f344e' }}>预约管理</Title>
            <Text type="secondary">查看用户活动报名，必要时可作废异常预约</Text>
          </div>
        </div>
        <Button icon={<ReloadOutlined />} onClick={fetchData} style={{ borderRadius: 10, fontWeight: 600 }}>刷新</Button>
      </div>

      {/* 统计卡 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 16, marginBottom: 20 }}>
        {statCards.map((card, idx) => {
          const cardIcons = [OrderedListOutlined, CheckCircleOutlined, CloseCircleOutlined, LinkOutlined];
          const IconComp = cardIcons[idx];
          return (
            <div key={card.label} style={{ background: `linear-gradient(135deg, ${card.color}15, ${card.color}08)`, borderRadius: 16, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              <div style={{ width: 48, height: 48, background: '#fff', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <IconComp style={{ fontSize: 22, color: card.color }} />
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 14, fontWeight: 500 }}>{card.label}</Text>
                <div style={{ fontSize: 32, fontWeight: 800, color: card.color, marginTop: 4 }}>{card.value}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 筛选区与表格 */}
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.04)' }}>
        <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <Space wrap>
            <Select
              allowClear
              placeholder="全部状态"
              style={{ width: 130, borderRadius: 10 }}
              value={status}
              onChange={v => setStatus(v)}
              options={[
                { value: 1, label: '有效' },
                { value: 0, label: '已取消' },
              ]}
            />
            <Input
              placeholder="按 Session 搜索"
              style={{ width: 220, borderRadius: 10 }}
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              onPressEnter={handleSearch}
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              allowClear
            />
            <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch} ghost style={{ borderRadius: 10, fontWeight: 600, boxShadow: '0 2px 8px rgba(22,119,255,0.2)' }}>搜索</Button>
            <Button onClick={handleReset} style={{ borderRadius: 10, fontWeight: 600 }}>重置</Button>
          </Space>
        </div>

        <div className="admin-panel">
          <Table rowKey="id" loading={loading} columns={columns} dataSource={reserves} rowClassName={() => 'admin-table-row'} />
        </div>
      </div>
      <style>{`.admin-table-row { transition: background 0.2s; } .admin-table-row:hover { background: #fafcff !important; } .admin-table-row td { padding-top: 14px !important; padding-bottom: 14px !important; }`}</style>
    </div>
  );
}
