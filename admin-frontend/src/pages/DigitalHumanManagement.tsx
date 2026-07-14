import { useEffect, useState } from 'react';
import { Button, Card, Checkbox, Col, Form, Image, Input, InputNumber, Popconfirm, Row, Select, Space, Statistic, Switch, Tabs, Typography, Upload, message } from 'antd';
import { DeleteOutlined, ReloadOutlined, RobotOutlined, SaveOutlined, SoundOutlined, UploadOutlined } from '@ant-design/icons';
import { getGlobalDigitalHumanConfig, resetGlobalDigitalHumanConfig, saveGlobalDigitalHumanConfig, type DigitalHumanGlobalConfig } from '@/api/digitalHuman';
import { getDashboardOverview, getHotSpots, type DashboardOverview, type RankItem } from '@/api/dashboard';
import { uploadImage } from '@/api/upload';
import { speechService } from '@/utils/speechService';
import { XIAOHAI_AVATAR_DATA_URI } from '@/utils/xiaohaiAvatarAsset';

const { Title, Text } = Typography;

const capabilityLabels: Record<string, string> = {
  aiChat: 'AI 问答', knowledgeNarration: '知识库讲解', pointNarration: '点位讲解', routePlanning: 'AI 路线规划',
  mapCompanion: '地图陪伴导航', autoArrivalNarration: '自动到站讲解', voiceInput: '语音输入', voiceRead: '语音朗读',
  navigationVoice: '导航语音', routeAnimation: '路线动画', subtitles: '字幕显示', seniorMode: '长者模式',
  highContrast: '高对比度', largeText: '大字号',
  userPersonalization: '用户个性化设置', cocreateRecommendation: '共创路线推荐',
};

const adjustableLabels: Record<string, string> = {
  avatarTheme: '形象主题', voiceType: '语音类型', speechSpeed: '语速', volume: '音量', pitch: '音调', autoRead: '自动朗读',
  subtitleEnabled: '字幕', answerStyle: '回答风格', autoNarration: '自动讲解', navigationAssistantExpanded: '地图助手展开状态',
  routeAnimationEnabled: '路线动画', highContrast: '高对比度', largeText: '大字号', seniorMode: '长者模式',
  navigationPromptFrequency: '导航提示频率', quickQuestionPreference: '快捷问题偏好',
};

const defaultConfig: DigitalHumanGlobalConfig = {
  name: '小海', digitalHumanName: '小海', avatar: '', avatarTheme: '山海蓝', style: '校园讲解员', voiceType: '温柔女声', speed: 1,
  speechSpeed: 1, volume: 0.9, pitch: 1, autoRead: false, subtitleEnabled: true,
  welcomeText: '欢迎来到山海大学！我是你的校园 AI 导览员小海。',
  introduction: '能听懂游览时间与需求，基于可信校园知识讲解，并在地图中逐站陪伴导航。',
  guideStyle: '标准', defaultAnswerStyle: '标准',
  capabilities: { aiChat: true, knowledgeNarration: true, pointNarration: true, routePlanning: true, mapCompanion: true, autoArrivalNarration: true, voiceInput: true, voiceRead: true, navigationVoice: true, routeAnimation: true, subtitles: true, seniorMode: true, highContrast: true, largeText: true, userPersonalization: true, cocreateRecommendation: true },
  quickQuestions: ['45 分钟怎么游览山海大学？', '请讲解当前点位', '带长者走一条轻松路线', '校园文化有哪些必看点位？'],
  welcomeTextsByMode: { fresh: '欢迎来到山海大学，我会重点介绍学习生活与新生服务。', alumni: '欢迎回到山海大学，让我们沿着校史与校园变化重温旧时光。', parent: '欢迎来到山海大学，我会重点介绍学习环境、生活安全和服务设施。', research: '欢迎来到山海大学，我会重点介绍学术资源、历史和专业特色。', senior: '欢迎来到山海大学，我会用更简洁、清晰的方式陪您游览。' },
  navigationSettings: { promptFrequency: 'standard', arrivalDetection: 'manual', autoNarration: false, showRouteAnimation: true, allowSkipStation: true, allowReplan: true },
  narrationSettings: { defaultMode: 'concise', showSources: true, autoArrivalPrompt: true },
  accessibilitySettings: { highContrast: false, largeText: false, seniorMode: false },
  fallbackMessages: { arrival: '已到达{spotName}，需要我讲解这里吗？', navigationComplete: '本次山海大学游览已完成，感谢一路同行。', error: '小海暂时没有理解，可以换一种说法或查看校园点位。', noKnowledge: '当前回答暂未检索到明确的知识库依据，请以学校实际发布信息为准。', disclaimer: '校园信息可能随运营安排调整，请以学校实际安排为准。', blockedTopics: '个人隐私,违法危险行为,与校园导览无关的敏感信息' },
  userAdjustableFields: Object.keys(adjustableLabels),
};

const mergeConfig = (value?: Partial<DigitalHumanGlobalConfig>): DigitalHumanGlobalConfig => ({
  ...defaultConfig, ...(value || {}), capabilities: { ...defaultConfig.capabilities, ...(value?.capabilities || {}) },
  welcomeTextsByMode: { ...defaultConfig.welcomeTextsByMode, ...(value?.welcomeTextsByMode || {}) },
  navigationSettings: { ...defaultConfig.navigationSettings, ...(value?.navigationSettings || {}) },
  narrationSettings: { ...defaultConfig.narrationSettings, ...(value?.narrationSettings || {}) },
  accessibilitySettings: { ...defaultConfig.accessibilitySettings, ...(value?.accessibilitySettings || {}) },
  fallbackMessages: { ...defaultConfig.fallbackMessages, ...(value?.fallbackMessages || {}) },
});

const errorMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;
const fullImageUrl = (url?: string) => !url ? undefined : url.startsWith('http') ? url : `${import.meta.env.VITE_API_BASE_URL ? new URL(import.meta.env.VITE_API_BASE_URL).origin : 'http://localhost:8080'}${url}`;

export default function DigitalHumanManagement() {
  const [form] = Form.useForm<DigitalHumanGlobalConfig>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatar, setAvatar] = useState('');
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [hotSpots, setHotSpots] = useState<RankItem[]>([]);
  const [previewConfig, setPreviewConfig] = useState<DigitalHumanGlobalConfig>(defaultConfig);
  const [resolvedVoiceLabel, setResolvedVoiceLabel] = useState('等待浏览器加载 voice');

  const load = async () => {
    setLoading(true);
    try {
      const [config, metrics, topSpots] = await Promise.all([getGlobalDigitalHumanConfig(), getDashboardOverview(), getHotSpots()]);
      const merged = mergeConfig(config.data);
      form.setFieldsValue(merged); setAvatar(merged.avatar || ''); setPreviewConfig(merged); setOverview(metrics.data); setHotSpots(topSpots.data || []);
    } catch (error) { message.error(errorMessage(error, '数字人运营配置加载失败')); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  useEffect(() => () => speechService.cancel(), []);
  useEffect(() => {
    if (!speechService.isSupported()) {
      setResolvedVoiceLabel('当前浏览器不支持语音');
      return;
    }
    speechService.resolveVoiceAsync(previewConfig.voiceType, result => {
      const status = result.fallbackUsed ? '（降级匹配）' : '';
      const label = `实际声音：${result.resolvedVoiceName || '—'}（${result.resolvedVoiceLang || '—'}）${status}`;
      setResolvedVoiceLabel(label);
    });
  }, [previewConfig.voiceType]);

  const save = async (values: DigitalHumanGlobalConfig) => {
    setSaving(true);
    try {
      const payload = mergeConfig({ ...values, name: values.name?.trim() || '小海', digitalHumanName: values.name?.trim() || '小海', avatar, speed: Number(values.speechSpeed || 1) });
      const result = await saveGlobalDigitalHumanConfig(payload);
      const merged = mergeConfig(result.data || payload); form.setFieldsValue(merged); setAvatar(merged.avatar || ''); setPreviewConfig(merged);
      message.success('数字人全局配置已保存，用户端下次读取立即生效');
    } catch (error) { message.error(errorMessage(error, '保存失败，请检查后端服务与配置内容')); }
    finally { setSaving(false); }
  };

  const reset = async () => {
    setSaving(true);
    try { const result = await resetGlobalDigitalHumanConfig(); const value = mergeConfig(result.data); form.setFieldsValue(value); setAvatar(value.avatar || ''); setPreviewConfig(value); message.success('已恢复并保存默认配置'); }
    catch (error) { message.error(errorMessage(error, '恢复默认配置失败')); }
    finally { setSaving(false); }
  };

  const testWelcome = () => {
    const values = mergeConfig({ ...form.getFieldsValue(true), avatar });
    const ok = speechService.speak(values.welcomeText || '欢迎来到山海大学', {
      lang: 'zh-CN',
      voiceType: values.voiceType,
      rate: Number(values.speechSpeed || 1),
      volume: Number(values.volume ?? 0.9),
      pitch: Number(values.pitch ?? 1),
      seniorMode: Boolean(values.accessibilitySettings?.seniorMode),
      category: 'test',
      onVoiceResolved: (result) => {
        if (result.fallbackUsed) {
          message.info(`已切换为${values.voiceType || '默认音色'}（${result.genderMatched ? '同性别匹配' : '降级语音'}）`);
        } else {
          message.success(`已切换为${values.voiceType || '默认音色'}`);
        }
      },
    });
    if (!ok) message.warning('当前浏览器不支持语音试听');
  };

  const baseTab = (
    <Row gutter={24}>
      <Col span={7}>
        <Card size="small" title="实时形象预览" style={{ borderRadius: 16 }}>
          <div style={{ height: 180, borderRadius: 16, background: 'linear-gradient(145deg,#eff6ff,#fff)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {avatar ? <Image src={fullImageUrl(avatar)} width={180} height={180} style={{ objectFit: 'cover' }} /> : <img src={XIAOHAI_AVATAR_DATA_URI} alt="小海默认形象" width={180} height={180} style={{ objectFit: 'contain' }} />}
          </div>
          <Space style={{ marginTop: 12 }}>
            <Upload showUploadList={false} accept="image/png,image/jpeg,image/webp" customRequest={async ({ file, onSuccess, onError }) => { try { const response = await uploadImage(file as File); const url = response.data?.url || ''; setAvatar(url); form.setFieldValue('avatar', url); onSuccess?.('ok'); } catch (error) { onError?.(error as Error); message.error('头像上传失败'); } }}><Button icon={<UploadOutlined />} style={{ borderRadius: 10, fontWeight: 600 }}>上传头像</Button></Upload>
            <Button icon={<DeleteOutlined />} onClick={() => { setAvatar(''); form.setFieldValue('avatar', ''); }} style={{ borderRadius: 10, fontWeight: 600 }}>移除</Button>
          </Space>
          <div style={{ marginTop: 14, border: '1px solid #e0efff', borderRadius: 12, padding: 12, background: '#f8fbff' }}>
            <Space align="start">
              {avatar
                ? <img src={fullImageUrl(avatar)} alt="小海2D形象" style={{ width: 56, height: 56, borderRadius: 18, background: '#eff6ff', objectFit: 'cover' }} />
                : <img src={XIAOHAI_AVATAR_DATA_URI} alt="小海默认形象" style={{ width: 56, height: 56, borderRadius: 18, background: '#eff6ff', objectFit: 'contain' }} />}
              <div style={{ minWidth: 0 }}>
                <Text strong>小海2D形象</Text>
                <Text type="secondary" style={{ display: 'block', fontSize: 12, marginTop: 4 }}>{previewConfig.welcomeText}</Text>
                <Text style={{ display: 'block', fontSize: 12, marginTop: 6 }}>{previewConfig.voiceType} · {Number(previewConfig.speechSpeed || 1).toFixed(1)}x · 音量 {Number(previewConfig.volume ?? 0.9).toFixed(1)} · 音调 {Number(previewConfig.pitch ?? 1).toFixed(1)}</Text>
                <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>{resolvedVoiceLabel}</Text>
                <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>自动朗读：{previewConfig.autoRead ? '开启' : '关闭'} · 自动讲解：{previewConfig.navigationSettings?.autoNarration ? '开启' : '关闭'} · 字幕：{previewConfig.subtitleEnabled ? '开启' : '关闭'}</Text>
                <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>关闭能力：{Object.entries(previewConfig.capabilities || {}).filter(([, enabled]) => !enabled).map(([key]) => capabilityLabels[key] || key).join('、') || '无'}</Text>
                <Button size="small" icon={<SoundOutlined />} style={{ marginTop: 8, borderRadius: 10, fontWeight: 600 }} onClick={testWelcome}>试听欢迎语</Button>
              </div>
            </Space>
          </div>
          <Form.Item name="avatar" hidden><Input /></Form.Item>
        </Card>
      </Col>
      <Col span={17}>
        <Row gutter={16}>
          <Col span={12}><Form.Item name="name" label="数字人名称" rules={[{ required: true }]}><Input /></Form.Item></Col>
          <Col span={12}><Form.Item name="avatarTheme" label="默认形象主题"><Select options={['山海蓝','校园讲解员','青春学子','长者友好'].map(value => ({ value }))} /></Form.Item></Col>
          <Col span={12}><Form.Item name="voiceType" label="默认语音"><Select options={['温柔女声','亲切男声','活力女声','沉稳男声'].map(value => ({ value }))} /></Form.Item></Col>
          <Col span={4}><Form.Item name="speechSpeed" label="默认语速"><InputNumber min={0.5} max={2} step={0.1} style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={4}><Form.Item name="volume" label="默认音量"><InputNumber min={0} max={1} step={0.1} style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={4}><Form.Item name="pitch" label="默认音调"><InputNumber min={0} max={2} step={0.1} style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={12}><Form.Item name="defaultAnswerStyle" label="默认回答风格"><Select options={['简洁','标准','详细'].map(value => ({ value }))} /></Form.Item></Col>
          <Col span={6}><Form.Item name="autoRead" label="自动朗读" valuePropName="checked"><Switch /></Form.Item></Col>
          <Col span={6}><Form.Item name="subtitleEnabled" label="默认字幕" valuePropName="checked"><Switch /></Form.Item></Col>
          <Col span={24}><Form.Item name="welcomeText" label="默认欢迎语"><Input.TextArea rows={2} /></Form.Item></Col>
          <Col span={24}><Form.Item name="introduction" label="品牌介绍"><Input.TextArea rows={2} /></Form.Item></Col>
        </Row>
      </Col>
    </Row>
  );

  const capabilitiesTab = <Row gutter={[16, 16]}>{Object.entries(capabilityLabels).map(([key, label]) => <Col span={8} key={key}><Card size="small" style={{ borderRadius: 16 }}><Form.Item name={['capabilities', key]} label={label} valuePropName="checked" style={{ margin: 0 }}><Switch /></Form.Item></Card></Col>)}<Col span={24}><Form.Item name="userAdjustableFields" label="允许用户个性化的字段"><Checkbox.Group options={Object.entries(adjustableLabels).map(([value, label]) => ({ value, label }))} /></Form.Item></Col></Row>;

  const contentTab = <Row gutter={16}>
    {Object.entries({ fresh: '新生欢迎语', alumni: '校友欢迎语', parent: '家长欢迎语', research: '研学欢迎语', senior: '长者欢迎语' }).map(([key, label]) => <Col span={12} key={key}><Form.Item name={['welcomeTextsByMode', key]} label={label}><Input.TextArea rows={2} /></Form.Item></Col>)}
    <Col span={24}><Form.List name="quickQuestions">{(fields, { add, remove }) => <Card size="small" title="首页快捷问题" style={{ borderRadius: 16 }} extra={<Button onClick={() => add('')} style={{ borderRadius: 10, fontWeight: 600 }}>新增</Button>}>{fields.map(field => <Space.Compact key={field.key} style={{ width: '100%', marginBottom: 8 }}><Form.Item {...field} noStyle><Input /></Form.Item><Button danger onClick={() => remove(field.name)} style={{ borderRadius: 10, fontWeight: 600 }}>删除</Button></Space.Compact>)}</Card>}</Form.List></Col>
    {Object.entries({ arrival: '到站提示语', navigationComplete: '导航完成语', error: '异常降级提示语', noKnowledge: '知识库无依据提示', disclaimer: '免责声明', blockedTopics: '禁止回答主题' }).map(([key, label]) => <Col span={12} key={key}><Form.Item name={['fallbackMessages', key]} label={label}><Input.TextArea rows={2} /></Form.Item></Col>)}
  </Row>;

  const navigationTab = <Row gutter={16}>
    <Col span={8}><Form.Item name={['navigationSettings','promptFrequency']} label="默认提示频率"><Select options={[{value:'low',label:'较少'},{value:'standard',label:'标准'},{value:'high',label:'频繁'}]} /></Form.Item></Col>
    <Col span={8}><Form.Item name={['navigationSettings','arrivalDetection']} label="到站判断方式"><Select options={[{value:'manual',label:'手动确认'},{value:'location',label:'定位判断'}]} /></Form.Item></Col>
    <Col span={8}><Form.Item name={['narrationSettings','defaultMode']} label="默认讲解模式"><Select options={[{value:'concise',label:'简洁'},{value:'detailed',label:'详细'}]} /></Form.Item></Col>
    {Object.entries({ autoNarration: '自动讲解', showRouteAnimation: '显示路线动画', allowSkipStation: '允许跳过站点', allowReplan: '允许重新规划' }).map(([key, label]) => <Col span={6} key={key}><Card size="small" style={{ borderRadius: 16 }}><Form.Item name={['navigationSettings', key]} label={label} valuePropName="checked" style={{ margin: 0 }}><Switch /></Form.Item></Card></Col>)}
  </Row>;

  const operationsTab = <Space direction="vertical" size={16} style={{ width: '100%' }}>
    <Row gutter={16}><Col span={6}><Card style={{ borderRadius: 16 }}><Statistic title="今日数字人会话" value={overview?.todayChatCount || 0} /></Card></Col><Col span={6}><Card style={{ borderRadius: 16 }}><Statistic title="累计会话" value={overview?.totalChatCount || 0} /></Card></Col><Col span={6}><Card style={{ borderRadius: 16 }}><Statistic title="知识库命中率" value={overview?.knowledgeHitRate || 0} suffix="%" /></Card></Col><Col span={6}><Card style={{ borderRadius: 16 }}><Statistic title="今日服务用户" value={overview?.todayServicePeople || 0} /></Card></Col></Row>
    <Card title="点位讲解热门需求 Top 10" style={{ borderRadius: 16 }}>{hotSpots.length ? hotSpots.slice(0, 10).map((item, index) => <div key={`${item.id}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #f1f5f9' }}><span>{index + 1}. {item.name || '校园点位'}</span><Text type="secondary">{item.count} 次互动</Text></div>) : <Text type="secondary">暂无可统计数据</Text>}</Card>
    <Text type="secondary">讲解次数、路线规划次数、导航启动与完成率将在现有行为记录形成数据后展示；当前不返回任何密钥或敏感配置。</Text>
  </Space>;

  return (
    <div>
      <div className="admin-toolbar" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg,#722ed1,#9254de)', boxShadow: '0 4px 12px rgba(114,46,209,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <RobotOutlined style={{ color: '#fff', fontSize: 24 }} />
          </div>
          <div>
            <Title level={4} style={{ margin: 0, color: '#0f344e' }}>数字人运营中心</Title>
            <Text type="secondary" style={{ fontSize: 13 }}>统一治理小海的形象、语音、能力、内容、导航和用户个性化边界</Text>
          </div>
        </div>
        <Space>
          <Popconfirm title="恢复默认配置并立即保存？" onConfirm={reset}>
            <Button icon={<ReloadOutlined />} loading={saving} style={{ borderRadius: 10, fontWeight: 600 }}>恢复默认</Button>
          </Popconfirm>
          <Button icon={<SoundOutlined />} onClick={testWelcome} style={{ borderRadius: 10, fontWeight: 600 }}>试听欢迎语</Button>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={() => form.submit()} style={{ borderRadius: 10, fontWeight: 600, boxShadow: '0 2px 8px rgba(22,119,255,0.2)' }}>保存全局配置</Button>
        </Space>
      </div>
      <div className="admin-panel" style={{ borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.04)' }}>
        <Card loading={loading} bordered={false} style={{ borderRadius: 16 }}>
          <Form form={form} layout="vertical" initialValues={defaultConfig} onValuesChange={(_, values) => setPreviewConfig(mergeConfig({ ...values, avatar }))} onFinish={save}>
            <Tabs items={[
              { key: 'base', label: '基础形象与语音', children: baseTab },
              { key: 'capabilities', label: '能力与个性化', children: capabilitiesTab },
              { key: 'content', label: '内容运营与安全', children: contentTab },
              { key: 'navigation', label: '导航设置', children: navigationTab },
              { key: 'operations', label: '运营数据', children: operationsTab },
            ]} />
          </Form>
        </Card>
      </div>
      <style>{`.admin-table-row { transition: background 0.2s; } .admin-table-row:hover { background: #fafcff !important; } .admin-table-row td { padding-top: 14px !important; padding-bottom: 14px !important; }`}</style>
    </div>
  );
}
