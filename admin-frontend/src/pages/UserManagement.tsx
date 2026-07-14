import { useEffect, useState } from 'react';
import { Button, Form, Input, Modal, Select, Space, Table, Tag, Typography, message } from 'antd';
import { CheckCircleOutlined, DeleteOutlined, EditOutlined, KeyOutlined, ReloadOutlined, SearchOutlined, StopOutlined, UserOutlined } from '@ant-design/icons';
import request from '@/utils/request';
import {
  deleteRegisteredUser,
  getRegisteredUsers,
  updateRegisteredUser,
  updateRegisteredUserStatus,
  type RegisteredUser,
} from '@/api/user';

const { Title, Text } = Typography;

const modeOptions = [
  { value: 'fresh', label: '新生' },
  { value: 'alumni', label: '校友' },
  { value: 'parent', label: '家长' },
  { value: 'research', label: '研学访客' },
  { value: 'senior', label: '长者' },
];

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export default function UserManagement() {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [userMode, setUserMode] = useState<string>();
  const [keyword, setKeyword] = useState('');
  const [accountStatus, setAccountStatus] = useState<number | undefined>();
  const [targetUser, setTargetUser] = useState<RegisteredUser | null>(null);
  const [editVisible, setEditVisible] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [pwdVisible, setPwdVisible] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [editForm] = Form.useForm();
  const [pwdForm] = Form.useForm();

  useEffect(() => { fetchUsers(); }, [page, userMode, accountStatus]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const result = await getRegisteredUsers({
        page,
        size: 10,
        userMode,
        keyword: keyword || undefined,
        status: accountStatus,
        includeDisabled: true,
      }) as any;
      setUsers(result.data?.records || []);
      setTotal(result.data?.total || 0);
    } catch (error) {
      message.error(errorMessage(error, '用户列表加载失败'));
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => { setPage(1); fetchUsers(); };

  const handleReset = () => {
    setKeyword('');
    setUserMode(undefined);
    setAccountStatus(undefined);
    setPage(1);
    setTimeout(() => fetchUsers(), 0);
  };

  const toggleStatus = async (user: RegisteredUser) => {
    try {
      const status = user.status === 1 ? 0 : 1;
      await updateRegisteredUserStatus(user.id, status);
      message.success(`已${status === 1 ? '启用' : '禁用'}账号：${user.username}`);
      fetchUsers();
    } catch (error) {
      message.error(errorMessage(error, '状态更新失败'));
    }
  };

  const openEdit = (user: RegisteredUser) => {
    setTargetUser(user);
    editForm.setFieldsValue({
      username: user.username,
      nickname: user.nickname,
      userMode: user.userMode,
      college: user.college,
      major: user.major,
    });
    setEditVisible(true);
  };

  const submitEdit = async (values: Pick<RegisteredUser, 'username' | 'nickname' | 'userMode' | 'college' | 'major'>) => {
    if (!targetUser) return;
    setEditLoading(true);
    try {
      await updateRegisteredUser(targetUser.id, values);
      message.success('用户资料已更新');
      setEditVisible(false);
      fetchUsers();
    } catch (error) {
      message.error(errorMessage(error, '资料更新失败'));
    } finally {
      setEditLoading(false);
    }
  };

  const openPassword = (user: RegisteredUser) => {
    setTargetUser(user);
    pwdForm.resetFields();
    setPwdVisible(true);
  };

  const handleDelete = (user: RegisteredUser) => {
    Modal.confirm({
      title: `确认注销用户「${user.username}」？`,
      content: '注销后该用户的所有会话将被清理，无法恢复。',
      okText: '确认注销',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteRegisteredUser(user.id);
          message.success(`已注销用户：${user.username}`);
          fetchUsers();
        } catch (error) {
          message.error(errorMessage(error, '注销失败'));
        }
      },
    });
  };

  const submitPassword = async (values: { password: string; confirmPassword: string }) => {
    if (!targetUser) return;
    if (values.password !== values.confirmPassword) {
      message.error('两次输入的密码不一致');
      return;
    }
    setPwdLoading(true);
    try {
      await request.put(`/admin/users/${targetUser.id}/password`, { password: values.password });
      message.success('密码修改成功');
      setPwdVisible(false);
    } catch (error) {
      message.error(errorMessage(error, '密码修改失败'));
    } finally {
      setPwdLoading(false);
    }
  };

  const columns = [
    { title: '用户名', dataIndex: 'username', key: 'username', width: 140 },
    { title: '昵称', dataIndex: 'nickname', key: 'nickname', width: 130, render: (value: string) => value || '-' },
    { title: '身份', dataIndex: 'userMode', key: 'userMode', width: 100, render: (value: string) => <Tag color="blue">{modeOptions.find(item => item.value === value)?.label || value}</Tag> },
    { title: '学院', dataIndex: 'college', key: 'college', width: 150, render: (value: string) => value || '-' },
    { title: '专业', dataIndex: 'major', key: 'major', width: 150, render: (value: string) => value || '-' },
    { title: '状态', dataIndex: 'status', key: 'status', width: 90, render: (value: number) => value === 1 ? <Tag color="green">正常</Tag> : <Tag color="red">已禁用</Tag> },
    { title: '注册时间', dataIndex: 'createTime', key: 'createTime', width: 170, render: (value: string) => value?.replace('T', ' ').slice(0, 16) || '-' },
    {
      title: '操作', key: 'action', width: 330, fixed: 'right' as const,
      render: (_: unknown, user: RegisteredUser) => (
        <Space size="small" wrap>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(user)}>编辑</Button>
          <Button type="link" size="small" icon={<KeyOutlined />} onClick={() => openPassword(user)}>密码</Button>
          <Button type="link" size="small" danger={user.status === 1} icon={user.status === 1 ? <StopOutlined /> : <CheckCircleOutlined />} onClick={() => toggleStatus(user)}>
            {user.status === 1 ? '禁用' : '启用'}
          </Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(user)}>注销</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="admin-toolbar" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg, #1677ff, #4096ff)', boxShadow: '0 4px 12px rgba(22,119,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <UserOutlined style={{ color: '#fff', fontSize: 20 }} />
          </div>
          <div>
            <Title level={4} style={{ margin: 0, color: '#0f344e' }}>用户管理</Title>
            <Text type="secondary" style={{ fontSize: 13 }}>管理正式注册用户的基础资料、登录密码和账号状态</Text>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginTop: 16 }}>
          <Input
            placeholder="关键词搜索"
            style={{ width: 160, borderRadius: 10 }}
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onPressEnter={handleSearch}
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
          />
          <Select allowClear placeholder="按身份筛选" value={userMode} onChange={v => { setPage(1); setUserMode(v); }} style={{ width: 130 }} options={modeOptions} className="admin-select-filter" />
          <Select
            allowClear
            placeholder="账号状态"
            style={{ width: 120 }}
            value={accountStatus}
            onChange={v => { setPage(1); setAccountStatus(v); }}
            options={[{ value: 1, label: '正常' }, { value: 0, label: '已禁用' }]}
            className="admin-select-filter"
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch} style={{ borderRadius: 10, fontWeight: 600, boxShadow: '0 2px 8px rgba(22,119,255,0.2)' }}>搜索</Button>
          <Button onClick={handleReset} style={{ borderRadius: 10, fontWeight: 600 }}>重置</Button>
          <Button icon={<ReloadOutlined />} onClick={fetchUsers} style={{ borderRadius: 10, fontWeight: 600 }}>刷新</Button>
        </div>
      </div>

      <div className="admin-panel" style={{ marginTop: 24, borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.04)' }}>
        <Table rowKey="id" loading={loading} columns={columns} dataSource={users} scroll={{ x: 1300 }} pagination={{ current: page, total, onChange: setPage }} rowClassName={() => 'admin-table-row'} />
      </div>

      <Modal title={<span style={{ fontSize: 16, fontWeight: 700 }}>编辑资料 - {targetUser?.username || ''}</span>} open={editVisible} onCancel={() => setEditVisible(false)} onOk={() => editForm.submit()} confirmLoading={editLoading} destroyOnHidden>
        <Form form={editForm} layout="vertical" onFinish={submitEdit}>
          <Form.Item name="username" label="用户名" rules={[{ required: true, whitespace: true, message: '请输入用户名' }]}><Input maxLength={50} /></Form.Item>
          <Form.Item name="nickname" label="昵称"><Input maxLength={50} /></Form.Item>
          <Form.Item name="userMode" label="身份" rules={[{ required: true, message: '请选择身份' }]}><Select options={modeOptions} /></Form.Item>
          <Form.Item name="college" label="学院"><Input maxLength={128} /></Form.Item>
          <Form.Item name="major" label="专业"><Input maxLength={128} /></Form.Item>
        </Form>
      </Modal>

      <Modal title={<span style={{ fontSize: 16, fontWeight: 700 }}>修改密码 - {targetUser?.username || ''}</span>} open={pwdVisible} onCancel={() => setPwdVisible(false)} footer={null} destroyOnHidden>
        <Form form={pwdForm} layout="vertical" onFinish={submitPassword}>
          <Form.Item name="password" label="新密码" rules={[{ required: true, message: '请输入新密码' }, { min: 6, message: '密码不能少于6位' }]}><Input.Password /></Form.Item>
          <Form.Item name="confirmPassword" label="确认新密码" rules={[{ required: true, message: '请再次输入新密码' }]}><Input.Password /></Form.Item>
          <div style={{ textAlign: 'right' }}><Space><Button onClick={() => setPwdVisible(false)}>取消</Button><Button type="primary" htmlType="submit" loading={pwdLoading}>保存修改</Button></Space></div>
        </Form>
      </Modal>
      <style>{`.admin-table-row { transition: background 0.2s; } .admin-table-row:hover { background: #fafcff !important; } .admin-table-row td { padding-top: 14px !important; padding-bottom: 14px !important; } .admin-select-filter .ant-select-selector { border-radius: 10px !important; }`}</style>
    </div>
  );
}
