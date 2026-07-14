import { useState } from 'react';
import { Layout, Menu, Button, Modal, Form, Input, message } from 'antd';
import {
  UserOutlined,
  EnvironmentOutlined,
  CompassOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  CalendarOutlined,
  ScheduleOutlined,
  MessageOutlined,
  AuditOutlined,
  SafetyCertificateOutlined,
  DatabaseOutlined,
  RobotOutlined,
  FundProjectionScreenOutlined,
  LockOutlined
} from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import request from '@/utils/request';
import { changeAdminPassword } from '@/api/user';

const { Header, Sider, Content } = Layout;

const menuItems = [
  { key: '/dashboard', icon: <FundProjectionScreenOutlined />, label: '运营总览' },
  { key: '/knowledge', icon: <DatabaseOutlined />, label: '知识库管理' },
  { key: '/digital-human', icon: <RobotOutlined />, label: '数字人管理' },
  { key: '/users', icon: <UserOutlined />, label: '用户管理' },
  { key: '/spots', icon: <EnvironmentOutlined />, label: '点位管理' },
  { key: '/routes', icon: <CompassOutlined />, label: '路线管理' },
  { key: '/activities', icon: <CalendarOutlined />, label: '活动管理' },
  { key: '/applications', icon: <AuditOutlined />, label: '申请审核' },
  { key: '/reservations', icon: <ScheduleOutlined />, label: '预约管理' },
  { key: '/feedback', icon: <MessageOutlined />, label: '反馈处理' },
  { key: '/badges', icon: <SafetyCertificateOutlined />, label: '徽章管理' },
];

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordForm] = Form.useForm();
  const navigate = useNavigate();
  const location = useLocation();
  const adminInfo = JSON.parse(localStorage.getItem('admin_info') || '{}');

  const handleLogout = () => {
    void request.post('/admin/logout')
      .catch(() => undefined)
      .finally(() => {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_info');
        navigate('/login');
      });
  };

  const handleChangePassword = async (values: { oldPassword: string; newPassword: string }) => {
    setPasswordLoading(true);
    try {
      await changeAdminPassword(values.oldPassword, values.newPassword);
      message.success('密码修改成功，请重新登录');
      setPasswordModalOpen(false);
      passwordForm.resetFields();
      // 清除登录态，要求重新登录
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_info');
      navigate('/login');
    } catch (err) {
      message.error(err instanceof Error ? err.message : '密码修改失败');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <Layout className="admin-shell">
      <Sider 
        trigger={null} 
        collapsible 
        collapsed={collapsed}
        width={244}
        className="admin-sider"
      >
        <div className="admin-brand">
          <div className="admin-brand-mark">山</div>
          {!collapsed && (
            <div>
              <div className="admin-brand-title">山海小导</div>
              <div className="admin-brand-subtitle">运营管理后台</div>
            </div>
          )}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          className="admin-menu"
        />
      </Sider>
      <Layout>
        <Header className="admin-header">
          <div className="admin-header-left">
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              className="admin-collapse"
            />
          </div>
          <div className="admin-userbar">
            <span className="admin-user-avatar">{(adminInfo.nickname || '管').slice(0, 1)}</span>
            <span className="admin-user-name">{adminInfo.nickname || '管理员'}</span>
            <Button
              type="text"
              icon={<LockOutlined />}
              onClick={() => setPasswordModalOpen(true)}
            >
              修改密码
            </Button>
            <Button
              type="text"
              icon={<LogoutOutlined />}
              onClick={handleLogout}
              danger
            >
              退出登录
            </Button>
          </div>
        </Header>
        <Content className="admin-content">
          <Outlet />
        </Content>
      </Layout>

      <Modal
        title="修改密码"
        open={passwordModalOpen}
        onCancel={() => {
          setPasswordModalOpen(false);
          passwordForm.resetFields();
        }}
        footer={null}
        destroyOnClose
      >
        <Form
          form={passwordForm}
          layout="vertical"
          onFinish={handleChangePassword}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="oldPassword"
            label="旧密码"
            rules={[{ required: true, message: '请输入旧密码' }]}
          >
            <Input.Password placeholder="请输入旧密码" />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码长度不能少于6位' },
            ]}
          >
            <Input.Password placeholder="请输入新密码（至少6位）" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="确认新密码"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: '请确认新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="请再次输入新密码" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Button
              style={{ marginRight: 8 }}
              onClick={() => {
                setPasswordModalOpen(false);
                passwordForm.resetFields();
              }}
            >
              取消
            </Button>
            <Button type="primary" htmlType="submit" loading={passwordLoading}>
              确认修改
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
}
