import { useEffect, useMemo, useState } from "react";
import "./AdminDigitalHumanPage.css";
import TwoDDigitalHuman from "../components/TwoDDigitalHuman";
import type { TwoDDigitalHumanStatus } from "../components/TwoDDigitalHuman";
import AdminLayout from "./AdminLayout";
import {
  createDigitalHumanConfig,
  deleteDigitalHumanConfig,
  getDigitalHumanConfigs,
  setDigitalHumanConfigEnabled,
  updateDigitalHumanConfig,
} from "../api/adminDigitalHumanApi";
import type { DigitalHumanConfig, DigitalHumanConfigRequest } from "../api/adminDigitalHumanApi";

const stylePresets = ["科技蓝紫", "校园清新", "文化典雅"];
const voiceNames = ["默认", "温暖女声", "清亮男声"];
const emptyForm: DigitalHumanConfigRequest = {
  name: "小海",
  avatarText: "海",
  roleTitle: "校园 AI 导览员",
  welcomeText: "你好，我是小海，可以为你讲解校园文化、校史故事和校友路线。",
  voiceName: "默认",
  stylePreset: "科技蓝紫",
  enabled: true,
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function toForm(config: DigitalHumanConfig): DigitalHumanConfigRequest {
  return {
    name: config.name,
    avatarText: config.avatarText,
    roleTitle: config.roleTitle,
    welcomeText: config.welcomeText,
    voiceName: config.voiceName,
    stylePreset: config.stylePreset,
    enabled: config.enabled,
  };
}

function AdminDigitalHumanPage() {
  const [configs, setConfigs] = useState<DigitalHumanConfig[]>([]);
  const [keyword, setKeyword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [formData, setFormData] = useState<DigitalHumanConfigRequest>(emptyForm);
  const [editingConfig, setEditingConfig] = useState<DigitalHumanConfig | null>(null);
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [previewStatus, setPreviewStatus] = useState<TwoDDigitalHumanStatus>("guiding");

  const loadConfigs = async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const data = await getDigitalHumanConfigs();
      setConfigs(data);
      const current = data.find((config) => config.enabled) || data[0] || null;
      if (current) {
        setEditingConfig(current);
        setFormData(toForm(current));
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "加载数字人配置失败");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConfigs();
  }, []);

  const filteredConfigs = useMemo(() => {
    const text = keyword.trim().toLowerCase();
    return configs.filter((config) => !text || [config.name, config.roleTitle, config.voiceName, config.stylePreset].some((item) => item.toLowerCase().includes(text)));
  }, [configs, keyword]);

  const activeConfig = configs.find((config) => config.enabled) || null;
  const stats = {
    total: configs.length,
    enabled: configs.filter((config) => config.enabled).length,
    styles: new Set(configs.map((config) => config.stylePreset)).size,
    latest: configs.map((config) => config.updatedAt || "").sort().at(-1),
  };

  const selectConfig = (config: DigitalHumanConfig) => {
    setEditingConfig(config);
    setFormData(toForm(config));
    setFormError("");
  };

  const newConfig = () => {
    setEditingConfig(null);
    setFormData({ ...emptyForm, enabled: true });
    setFormError("");
  };

  const validate = () => {
    if (!formData.name.trim()) return "请输入数字人名称";
    if (!formData.avatarText.trim()) return "请输入头像标识";
    if (!formData.roleTitle.trim()) return "请输入角色定位";
    if (!formData.welcomeText.trim()) return "请输入欢迎语";
    return "";
  };

  const save = async () => {
    const message = validate();
    if (message) {
      setFormError(message);
      return;
    }
    setIsSaving(true);
    setFormError("");
    try {
      const payload = {
        ...formData,
        name: formData.name.trim(),
        avatarText: formData.avatarText.trim(),
        roleTitle: formData.roleTitle.trim(),
        welcomeText: formData.welcomeText.trim(),
      };
      if (editingConfig?.id) {
        await updateDigitalHumanConfig(editingConfig.id, payload);
      } else {
        await createDigitalHumanConfig(payload);
      }
      await loadConfigs();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "保存当前配置失败");
    } finally {
      setIsSaving(false);
    }
  };

  const enable = async (config: DigitalHumanConfig) => {
    if (!config.id) return;
    setErrorMessage("");
    try {
      await setDigitalHumanConfigEnabled(config.id, true);
      await loadConfigs();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "启用数字人配置失败");
    }
  };

  const remove = async (config: DigitalHumanConfig) => {
    if (!config.id || !window.confirm(`确认删除"${config.name}"吗？游客端会自动使用其他启用配置或默认小海。`)) return;
    setErrorMessage("");
    try {
      await deleteDigitalHumanConfig(config.id);
      await loadConfigs();
      if (editingConfig?.id === config.id) {
        newConfig();
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "删除数字人配置失败");
    }
  };

  return (
    <AdminLayout activeMenu="digital-human">
        <header className="admin-spot-header">
          <div>
            <h1>2D 数字人管理</h1>
            <p>配置 2D 虚拟形象导览员的名称、欢迎语、语音风格和展示状态，可由校园知识库、路线数据和公告数据驱动讲解内容。</p>
          </div>
          <button className="admin-spot-primary-button" onClick={newConfig}>新建配置</button>
        </header>

        <section className="admin-spot-stats">
          <div className="admin-spot-stat-card"><span>历史配置</span><strong>{stats.total}</strong></div>
          <div className="admin-spot-stat-card"><span>当前启用</span><strong>{activeConfig ? activeConfig.name : "默认"}</strong></div>
          <div className="admin-spot-stat-card"><span>视觉风格</span><strong>{stats.styles}</strong></div>
          <div className="admin-spot-stat-card"><span>最近更新</span><strong className="admin-spot-date-stat">{formatDate(stats.latest)}</strong></div>
        </section>

        <section className="admin-digital-console">
          {/* Left: Live Preview */}
          <div className="admin-spot-panel admin-digital-preview-panel">
            <div className="admin-digital-section-title">
              <span>实时预览</span>
              <strong>{formData.enabled ? "当前启用" : "未启用"}</strong>
            </div>
            <TwoDDigitalHuman
              name={formData.name}
              avatarText={formData.avatarText}
              roleTitle={formData.roleTitle}
              welcomeText={formData.welcomeText}
              stylePreset={formData.stylePreset}
              status={previewStatus}
            />
            <div className="admin-digital-status-switch">
              {([
                ["idle", "待机"],
                ["thinking", "思考"],
                ["speaking", "讲解"],
                ["guiding", "导览"],
              ] as const).map(([status, label]) => (
                <button
                  key={status}
                  className={previewStatus === status ? "active" : ""}
                  onClick={() => setPreviewStatus(status as TwoDDigitalHumanStatus)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="admin-digital-meta">
              <span>语音：{formData.voiceName}</span>
              <span>风格：{formData.stylePreset}</span>
            </div>
            <p className="admin-digital-desc">
              当前为轻量 2D 虚拟形象导览员，可由校园知识库、路线数据和公告数据驱动讲解内容。支持待机 / 思考 / 讲解 / 导览四种状态切换。
            </p>
          </div>

          {/* Right: Config Editor */}
          <div className="admin-spot-panel admin-digital-editor">
            <div className="admin-digital-section-title">
              <span>{editingConfig ? "当前配置编辑" : "新建配置"}</span>
              {editingConfig?.enabled && <strong>游客端正在使用</strong>}
            </div>
            <div className="admin-spot-form admin-digital-form">
              <label>数字人名称<input value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} /></label>
              <label>头像标识<input maxLength={2} value={formData.avatarText} onChange={(event) => setFormData({ ...formData, avatarText: event.target.value })} /></label>
              <label>角色定位<input value={formData.roleTitle} onChange={(event) => setFormData({ ...formData, roleTitle: event.target.value })} /></label>
              <label>语音风格<select value={formData.voiceName} onChange={(event) => setFormData({ ...formData, voiceName: event.target.value })}>{voiceNames.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label>视觉风格<select value={formData.stylePreset} onChange={(event) => setFormData({ ...formData, stylePreset: event.target.value })}>{stylePresets.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label className="admin-spot-checkbox"><input type="checkbox" checked={formData.enabled} onChange={(event) => setFormData({ ...formData, enabled: event.target.checked })} />当前启用</label>
              <label className="admin-spot-form-wide">欢迎语<textarea rows={5} value={formData.welcomeText} onChange={(event) => setFormData({ ...formData, welcomeText: event.target.value })} /></label>
              {formError && <div className="admin-spot-alert admin-spot-form-wide">{formError}</div>}
            </div>
            <div className="admin-digital-editor-actions">
              <button className="admin-spot-primary-button" onClick={save} disabled={isSaving}>{isSaving ? "保存中..." : "保存当前配置"}</button>
              {editingConfig && !editingConfig.enabled && <button className="admin-spot-secondary-button" onClick={() => enable(editingConfig)}>启用此配置</button>}
              <button className="admin-spot-secondary-button" onClick={newConfig}>新建配置</button>
            </div>
          </div>
        </section>

        {/* Config list */}
        <section className="admin-spot-panel">
          <div className="admin-spot-toolbar">
            <input className="admin-spot-search" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索名称、角色、语音或风格" />
            <select disabled><option>当前启用配置</option></select>
            <select disabled><option>全部配置</option></select>
          </div>
          {errorMessage && <div className="admin-spot-alert">{errorMessage}</div>}
          <div className="admin-spot-table-wrap">
            <table className="admin-spot-table">
              <thead><tr><th>配置</th><th>角色定位</th><th>语音</th><th>风格</th><th>状态</th><th>更新时间</th><th>操作</th></tr></thead>
              <tbody>
                {isLoading ? <tr><td colSpan={7} className="admin-spot-empty">加载中...</td></tr> : filteredConfigs.map((config) => (
                  <tr key={config.id ?? config.name} className={config.enabled ? "admin-digital-active-row" : ""}>
                    <td><div className="admin-spot-title">{config.name}</div><div className="admin-digital-table-sub">标识：{config.avatarText}</div></td>
                    <td>{config.roleTitle}</td>
                    <td>{config.voiceName}</td>
                    <td>{config.stylePreset}</td>
                    <td><span className={`admin-spot-status ${config.enabled ? "enabled" : "disabled"}`}>{config.enabled ? "当前启用" : "历史配置"}</span></td>
                    <td>{formatDate(config.updatedAt)}</td>
                    <td><div className="admin-spot-actions"><button onClick={() => selectConfig(config)}>编辑</button><button onClick={() => enable(config)} disabled={config.enabled}>启用</button><button className="danger" onClick={() => remove(config)}>删除</button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
    </AdminLayout>
  );
}

export default AdminDigitalHumanPage;
