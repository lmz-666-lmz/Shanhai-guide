import { useEffect, useState } from 'react';
import { Button, Form, Input, Modal, Select, Space, Switch, Table, Tag, Typography, message } from 'antd';
import { DeleteOutlined, EditOutlined, FileSearchOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { createKnowledge, disableKnowledge, getKnowledgeList, updateKnowledge, type KnowledgeItem } from '@/api/knowledge';

const { Title, Text } = Typography;

const sourceOptions = [
  { value: 'history', label: '校史资料' },
  { value: 'spot', label: '校园点位介绍' },
  { value: 'activity', label: '活动公告' },
  { value: 'faq', label: 'FAQ' },
  { value: 'guide', label: '参访指南' },
  { value: 'alumni', label: '校友故事' },
  { value: 'research', label: '科研成果' },
];

const userModeOptions = [
  { value: 'fresh', label: '新生' },
  { value: 'alumni', label: '校友' },
  { value: 'parent', label: '家长' },
  { value: 'research', label: '研学访客' },
  { value: 'senior', label: '长者' },
];

const getErrorMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;
const getSourceLabel = (value?: string) => sourceOptions.find(item => item.value === value)?.label || value || '校园知识库';

export default function KnowledgeManagement() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [keyword, setKeyword] = useState('');
  const [knowledgeType, setKnowledgeType] = useState<string>();
  const [knowledgeModeFilter, setKnowledgeModeFilter] = useState<string>();
  const [knowledgeEnableFilter, setKnowledgeEnableFilter] = useState<number | undefined>();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<KnowledgeItem | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchItems();
  }, [knowledgeType]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await getKnowledgeList({
        keyword: keyword || undefined,
        knowledgeType,
        includeDisabled: true,
      });
      const allItems = res.data || [];
      const filtered = allItems.filter((it: KnowledgeItem) => {
        const matchMode = !knowledgeModeFilter || (it.suitableMode && it.suitableMode.includes(knowledgeModeFilter));
        const matchEnable = knowledgeEnableFilter === undefined || it.isEnable === knowledgeEnableFilter;
        return matchMode && matchEnable;
      });
      setItems(filtered);
    } catch (error) {
      message.error(getErrorMessage(error, '知识库加载失败'));
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ knowledgeType: 'faq', isEnable: true, suitableMode: ['fresh', 'alumni', 'parent', 'research', 'senior'] });
    setModalOpen(true);
  };

  const openEdit = (item: KnowledgeItem) => {
    setEditing(item);
    form.setFieldsValue({
      ...item,
      suitableMode: item.suitableMode ? item.suitableMode.split(',') : [],
      isEnable: item.isEnable === 1,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (values: any) => {
    setSaving(true);
    try {
      const payload = {
        ...values,
        suitableMode: Array.isArray(values.suitableMode) ? values.suitableMode.join(',') : values.suitableMode,
        isEnable: values.isEnable ? 1 : 0,
      };
      if (editing) {
        await updateKnowledge(editing.id, payload);
        message.success('知识条目已更新');
      } else {
        await createKnowledge(payload);
        message.success('知识条目已新增');
      }
      setModalOpen(false);
      fetchItems();
    } catch (error) {
      message.error(getErrorMessage(error, editing ? '更新失败' : '新增失败'));
    } finally {
      setSaving(false);
    }
  };

  const toggleEnable = async (item: KnowledgeItem) => {
    try {
      if (item.isEnable === 1) {
        await disableKnowledge(item.id);
        message.success('知识条目已停用');
      } else {
        await updateKnowledge(item.id, { isEnable: 1 });
        message.success('知识条目已启用');
      }
      fetchItems();
    } catch (error) {
      message.error(getErrorMessage(error, '状态更新失败'));
    }
  };

  const handleDelete = (item: KnowledgeItem) => {
    Modal.confirm({
      title: `确认删除「${item.title}」？`,
      content: '删除后不可恢复。',
      okText: '确认删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        await disableKnowledge(item.id);
        message.success('知识条目已删除');
        fetchItems();
      },
    });
  };

  const columns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 220,
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: '来源分类',
      dataIndex: 'knowledgeType',
      key: 'knowledgeType',
      width: 130,
      render: (value: string) => <Tag color="blue">{getSourceLabel(value)}</Tag>,
    },
    {
      title: '内容摘要',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
    },
    {
      title: '适用人群',
      dataIndex: 'suitableMode',
      key: 'suitableMode',
      width: 190,
      render: (value?: string) => value ? (
        <Space size={[0, 4]} wrap>
          {value.split(',').map(mode => <Tag key={mode} bordered={false}>{userModeOptions.find(item => item.value === mode)?.label || mode}</Tag>)}
        </Space>
      ) : <Text type="secondary">全部人群</Text>,
    },
    {
      title: '命中次数',
      dataIndex: 'viewCount',
      key: 'viewCount',
      width: 90,
      render: (value?: number) => value || 0,
    },
    {
      title: '状态',
      dataIndex: 'isEnable',
      key: 'isEnable',
      width: 90,
      render: (value: number) => <Tag color={value === 1 ? 'green' : 'default'}>{value === 1 ? '展示中' : '已停用'}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      render: (_: unknown, record: KnowledgeItem) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>编辑</Button>
          <Button type="link" size="small" danger={record.isEnable === 1} onClick={() => toggleEnable(record)}>
            {record.isEnable === 1 ? '停用' : '启用'}
          </Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)}>删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="admin-toolbar" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg, #08979c, #13c2c2)', boxShadow: '0 4px 12px rgba(8,151,156,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <FileSearchOutlined style={{ color: '#fff', fontSize: 20 }} />
          </div>
          <div>
            <Title level={4} style={{ margin: 0, color: '#0f344e' }}>知识库管理</Title>
            <Text type="secondary" style={{ fontSize: 13 }}>维护小海回答时可引用的校园资料与依据来源</Text>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <Space wrap>
            <Input.Search
              allowClear
              placeholder="搜索标题或内容"
              value={keyword}
              onChange={event => setKeyword(event.target.value)}
              onSearch={fetchItems}
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              style={{ width: 220, borderRadius: 10 }}
            />
            <Select
              allowClear
              placeholder="来源分类"
              value={knowledgeType}
              onChange={setKnowledgeType}
              options={sourceOptions}
              style={{ width: 140, borderRadius: 10 }}
            />
            <Select
              allowClear
              placeholder="适用身份"
              style={{ width: 120, borderRadius: 10 }}
              value={knowledgeModeFilter}
              onChange={v => setKnowledgeModeFilter(v)}
              options={userModeOptions}
            />
            <Select
              allowClear
              placeholder="启用状态"
              style={{ width: 110, borderRadius: 10 }}
              value={knowledgeEnableFilter}
              onChange={v => setKnowledgeEnableFilter(v)}
              options={[{ value: 1, label: '展示中' }, { value: 0, label: '已停用' }]}
            />
            <Button onClick={() => { setKeyword(''); setKnowledgeType(undefined); setKnowledgeModeFilter(undefined); setKnowledgeEnableFilter(undefined); setTimeout(() => fetchItems(), 0); }} style={{ borderRadius: 10, fontWeight: 600 }}>重置</Button>
            <Button icon={<ReloadOutlined />} onClick={fetchItems} style={{ borderRadius: 10, fontWeight: 600 }}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} style={{ borderRadius: 10, fontWeight: 600, boxShadow: '0 2px 8px rgba(22,119,255,0.2)' }}>新增资料</Button>
          </Space>
        </div>
      </div>

      <div className="admin-panel" style={{ borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.04)' }}>
        <Table rowKey="id" loading={loading} columns={columns} dataSource={items} pagination={{ showTotal: total => `共 ${total} 条资料` }} rowClassName={() => 'admin-table-row'} />
      </div>

      <Modal
        title={<span style={{ fontSize: 16, fontWeight: 700 }}>{editing ? '编辑知识资料' : '新增知识资料'}</span>}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saving}
        width={760}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="title" label="资料标题" rules={[{ required: true, message: '请输入资料标题' }]}>
            <Input placeholder="例如：校史馆参观亮点" />
          </Form.Item>
          <Form.Item name="knowledgeType" label="依据来源" rules={[{ required: true, message: '请选择依据来源' }]}>
            <Select options={sourceOptions} />
          </Form.Item>
          <Form.Item name="content" label="资料内容" rules={[{ required: true, message: '请输入资料内容' }]}>
            <Input.TextArea rows={8} showCount maxLength={3000} placeholder="输入可供 AI 引用的校园文化、点位、活动或 FAQ 内容" />
          </Form.Item>
          <Form.Item name="suitableMode" label="适用人群">
            <Select mode="multiple" allowClear options={userModeOptions} placeholder="不选表示全部人群" />
          </Form.Item>
          <Form.Item name="isEnable" label="展示状态" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>
        </Form>
      </Modal>
      <style>{`.admin-table-row { transition: background 0.2s; } .admin-table-row:hover { background: #fafcff !important; } .admin-table-row td { padding-top: 14px !important; padding-bottom: 14px !important; }`}</style>
    </div>
  );
}
