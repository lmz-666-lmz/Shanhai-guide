import { useEffect, useState } from 'react';
import { Typography, Row, Col, Spin, message } from 'antd';
import {
  BarChartOutlined,
  UserOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  HeartOutlined,
  EnvironmentOutlined,
  RocketOutlined,
  CalendarOutlined,
  MessageOutlined,
  ScheduleOutlined,
  BulbOutlined
} from '@ant-design/icons';
import { getUserStatistics, type UserStatistics } from '@/api/user';

const { Title, Text } = Typography;

export default function Statistics() {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<UserStatistics | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await getUserStatistics() as any;
      setStats(res.data);
    } catch (error) {
      message.error('统计数据加载失败');
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return <div style={{ textAlign: 'center', padding: '100px 0' }}><Spin size="large" /></div>;
  }

  return (
    <div>
      <div className="admin-toolbar" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14,
            background: 'linear-gradient(135deg, #1890ff, #096dd9)',
            boxShadow: '0 4px 12px rgba(24,144,255,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <BarChartOutlined style={{ color: '#fff', fontSize: 24 }} />
          </div>
          <div>
            <Title level={4} style={{ margin: 0, color: '#0f344e' }}>数据大盘</Title>
            <Text type="secondary" style={{ fontSize: 13 }}>实时掌握山海小导全站运营数据</Text>
          </div>
        </div>
      </div>

      <Title level={4} style={{ marginBottom: 16 }}><TeamOutlined style={{ marginRight: 8 }} />用户与流量</Title>
      <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
        <Col span={6}>
          <div style={{
            background: 'linear-gradient(135deg, #e6f7ff 0%, #bae7ff 100%)',
            borderRadius: 16, padding: 20, display: 'flex', alignItems: 'center', gap: 16,
            height: '100%'
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(24,144,255,0.15)'
            }}>
              <UserOutlined style={{ color: '#1890ff', fontSize: 20 }} />
            </div>
            <div>
              <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>正式注册用户数</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#1a1a1a' }}>{stats.registeredUsers}</div>
            </div>
          </div>
        </Col>
        <Col span={6}>
          <div style={{
            background: 'linear-gradient(135deg, #f6ffed 0%, #d9f7be 100%)',
            borderRadius: 16, padding: 20, display: 'flex', alignItems: 'center', gap: 16,
            height: '100%'
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(82,196,26,0.15)'
            }}>
              <TeamOutlined style={{ color: '#52c41a', fontSize: 20 }} />
            </div>
            <div>
              <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>总访问会话数</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#1a1a1a' }}>{stats.sessionUsers}</div>
            </div>
          </div>
        </Col>
        <Col span={6}>
          <div style={{
            background: 'linear-gradient(135deg, #e6fffb 0%, #b5f5ec 100%)',
            borderRadius: 16, padding: 20, display: 'flex', alignItems: 'center', gap: 16,
            height: '100%'
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,200,180,0.15)'
            }}>
              <UserOutlined style={{ color: '#13c2c2', fontSize: 20 }} />
            </div>
            <div>
              <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>新生访问</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#1a1a1a' }}>{stats.freshCount}</div>
            </div>
          </div>
        </Col>
        <Col span={6}>
          <div style={{
            background: 'linear-gradient(135deg, #f0f5ff 0%, #d6e4ff 100%)',
            borderRadius: 16, padding: 20, display: 'flex', alignItems: 'center', gap: 16,
            height: '100%'
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(47,84,235,0.15)'
            }}>
              <TeamOutlined style={{ color: '#2f54eb', fontSize: 20 }} />
            </div>
            <div>
              <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>校友访问</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#1a1a1a' }}>{stats.alumniCount}</div>
            </div>
          </div>
        </Col>
        <Col span={6}>
          <div style={{
            background: 'linear-gradient(135deg, #fff0f6 0%, #ffd6e7 100%)',
            borderRadius: 16, padding: 20, display: 'flex', alignItems: 'center', gap: 16,
            height: '100%'
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(235,47,150,0.15)'
            }}>
              <HeartOutlined style={{ color: '#eb2f96', fontSize: 20 }} />
            </div>
            <div>
              <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>长者访问</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#1a1a1a' }}>{stats.seniorCount || 0}</div>
            </div>
          </div>
        </Col>
      </Row>

      <Title level={4} style={{ marginBottom: 16 }}><CheckCircleOutlined style={{ marginRight: 8 }} />互动与转化</Title>
      <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
        <Col span={6}>
          <div style={{
            background: 'linear-gradient(135deg, #fffbe6 0%, #fff1b8 100%)',
            borderRadius: 16, padding: 20, display: 'flex', alignItems: 'center', gap: 16,
            height: '100%'
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(250,173,20,0.15)'
            }}>
              <CheckCircleOutlined style={{ color: '#faad14', fontSize: 20 }} />
            </div>
            <div>
              <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>累计打卡人次</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#1a1a1a' }}>{stats.totalCheckins}</div>
            </div>
          </div>
        </Col>
        <Col span={6}>
          <div style={{
            background: 'linear-gradient(135deg, #fff0f6 0%, #ffd6e7 100%)',
            borderRadius: 16, padding: 20, display: 'flex', alignItems: 'center', gap: 16,
            height: '100%'
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(235,47,150,0.15)'
            }}>
              <HeartOutlined style={{ color: '#eb2f96', fontSize: 20 }} />
            </div>
            <div>
              <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>累计收藏数</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#1a1a1a' }}>{stats.totalFavorites}</div>
            </div>
          </div>
        </Col>
        <Col span={6}>
          <div style={{
            background: 'linear-gradient(135deg, #f9f0ff 0%, #efdbff 100%)',
            borderRadius: 16, padding: 20, display: 'flex', alignItems: 'center', gap: 16,
            height: '100%'
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(114,46,209,0.15)'
            }}>
              <ScheduleOutlined style={{ color: '#722ed1', fontSize: 20 }} />
            </div>
            <div>
              <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>活动预约数</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#1a1a1a' }}>{stats.totalReserves}</div>
            </div>
          </div>
        </Col>
        <Col span={6}>
          <div style={{
            background: 'linear-gradient(135deg, #e6fffb 0%, #b5f5ec 100%)',
            borderRadius: 16, padding: 20, display: 'flex', alignItems: 'center', gap: 16,
            height: '100%'
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(19,194,194,0.15)'
            }}>
              <MessageOutlined style={{ color: '#13c2c2', fontSize: 20 }} />
            </div>
            <div>
              <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>数字人对话数</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#1a1a1a' }}>{stats.totalChats}</div>
            </div>
          </div>
        </Col>
      </Row>

      <Title level={4} style={{ marginBottom: 16 }}><EnvironmentOutlined style={{ marginRight: 8 }} />资源与内容</Title>
      <Row gutter={[16, 16]}>
        <Col span={6}>
          <div style={{
            background: 'linear-gradient(135deg, #e6f7ff 0%, #bae7ff 100%)',
            borderRadius: 16, padding: 20, display: 'flex', alignItems: 'center', gap: 16,
            height: '100%'
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(24,144,255,0.15)'
            }}>
              <EnvironmentOutlined style={{ color: '#1890ff', fontSize: 20 }} />
            </div>
            <div>
              <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>校园点位</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#1a1a1a' }}>{stats.totalSpots}</div>
            </div>
          </div>
        </Col>
        <Col span={6}>
          <div style={{
            background: 'linear-gradient(135deg, #fff0f6 0%, #ffd6e7 100%)',
            borderRadius: 16, padding: 20, display: 'flex', alignItems: 'center', gap: 16,
            height: '100%'
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(235,47,150,0.15)'
            }}>
              <RocketOutlined style={{ color: '#eb2f96', fontSize: 20 }} />
            </div>
            <div>
              <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>导览路线</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#1a1a1a' }}>{stats.totalRoutes}</div>
            </div>
          </div>
        </Col>
        <Col span={6}>
          <div style={{
            background: 'linear-gradient(135deg, #fff7e6 0%, #ffe7ba 100%)',
            borderRadius: 16, padding: 20, display: 'flex', alignItems: 'center', gap: 16,
            height: '100%'
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(250,140,22,0.15)'
            }}>
              <CalendarOutlined style={{ color: '#fa8c16', fontSize: 20 }} />
            </div>
            <div>
              <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>校园活动</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#1a1a1a' }}>{stats.totalActivities}</div>
            </div>
          </div>
        </Col>
        <Col span={6}>
          <div style={{
            background: 'linear-gradient(135deg, #fffbe6 0%, #fff1b8 100%)',
            borderRadius: 16, padding: 20, display: 'flex', alignItems: 'center', gap: 16,
            height: '100%'
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(250,173,20,0.15)'
            }}>
              <BulbOutlined style={{ color: '#faad14', fontSize: 20 }} />
            </div>
            <div>
              <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>用户反馈</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#1a1a1a' }}>{stats.totalFeedbacks || 0}</div>
            </div>
          </div>
        </Col>
      </Row>
      <style>{`.admin-table-row { transition: background 0.2s; } .admin-table-row:hover { background: #fafcff !important; } .admin-table-row td { padding-top: 14px !important; padding-bottom: 14px !important; }`}</style>
    </div>
  );
}
