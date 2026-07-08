import { useEffect, useMemo, useState } from "react";
import "./AdminSpotPage.css";
import AdminLayout from "./AdminLayout";
import {
  createAdminSpot,
  deleteAdminSpot,
  getAdminSpots,
  setAdminSpotEnabled,
  updateAdminSpot,
} from "../api/adminSpotApi";
import type { AdminSpot, AdminSpotRequest } from "../api/adminSpotApi";

const spotTypes = ["全部", "校园景观", "校史文化", "校园文化", "学院建筑", "生活服务", "校友服务", "科研展示"];
const editableSpotTypes = spotTypes.filter((type) => type !== "全部");

interface SpotFormState {
  name: string;
  type: string;
  description: string;
  story: string;
  latitude: string;
  longitude: string;
  openTime: string;
  recommendedDuration: string;
  tags: string;
  imageUrl: string;
  enabled: boolean;
}

const emptyForm: SpotFormState = {
  name: "",
  type: "校园景观",
  description: "",
  story: "",
  latitude: "",
  longitude: "",
  openTime: "",
  recommendedDuration: "",
  tags: "",
  imageUrl: "",
  enabled: true,
};

function formatDate(value?: string) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCoordinate(spot: AdminSpot) {
  return `${spot.latitude.toFixed(4)}, ${spot.longitude.toFixed(4)}`;
}

function AdminSpotPage() {
  const [spots, setSpots] = useState<AdminSpot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [keyword, setKeyword] = useState("");
  const [typeFilter, setTypeFilter] = useState("全部");
  const [statusFilter, setStatusFilter] = useState("全部");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSpot, setEditingSpot] = useState<AdminSpot | null>(null);
  const [formData, setFormData] = useState<SpotFormState>(emptyForm);
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [detailSpot, setDetailSpot] = useState<AdminSpot | null>(null);

  const loadSpots = async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const data = await getAdminSpots();
      setSpots(data);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "加载点位失败");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSpots();
  }, []);

  const stats = useMemo(() => {
    const latestUpdatedAt = spots.reduce<string>((latest, spot) => {
      if (!spot.updatedAt) {
        return latest;
      }
      if (!latest) {
        return spot.updatedAt;
      }
      return new Date(spot.updatedAt).getTime() > new Date(latest).getTime() ? spot.updatedAt : latest;
    }, "");

    return {
      total: spots.length,
      enabled: spots.filter((spot) => spot.enabled).length,
      typeCount: new Set(spots.map((spot) => spot.type).filter(Boolean)).size,
      latestUpdatedAt,
    };
  }, [spots]);

  const filteredSpots = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return spots.filter((spot) => {
      const matchesKeyword = !normalizedKeyword
        || spot.name.toLowerCase().includes(normalizedKeyword)
        || spot.type.toLowerCase().includes(normalizedKeyword)
        || spot.description.toLowerCase().includes(normalizedKeyword)
        || (spot.tags || "").toLowerCase().includes(normalizedKeyword);
      const matchesType = typeFilter === "全部" || spot.type === typeFilter;
      const matchesStatus = statusFilter === "全部"
        || (statusFilter === "启用" && spot.enabled)
        || (statusFilter === "禁用" && !spot.enabled);

      return matchesKeyword && matchesType && matchesStatus;
    });
  }, [spots, keyword, typeFilter, statusFilter]);

  const openCreateModal = () => {
    setEditingSpot(null);
    setFormData(emptyForm);
    setFormError("");
    setIsFormOpen(true);
  };

  const openEditModal = (spot: AdminSpot) => {
    setEditingSpot(spot);
    setFormData({
      name: spot.name,
      type: spot.type,
      description: spot.description,
      story: spot.story,
      latitude: String(spot.latitude),
      longitude: String(spot.longitude),
      openTime: spot.openTime,
      recommendedDuration: String(spot.recommendedDuration),
      tags: spot.tags || "",
      imageUrl: spot.imageUrl || "",
      enabled: spot.enabled,
    });
    setFormError("");
    setIsFormOpen(true);
  };

  const closeFormModal = () => {
    if (isSaving) {
      return;
    }
    setIsFormOpen(false);
    setEditingSpot(null);
    setFormError("");
  };

  const validateForm = () => {
    if (!formData.name.trim()) return "请输入点位名称";
    if (!formData.type.trim()) return "请选择点位类型";
    if (!formData.description.trim()) return "请输入点位简介";
    if (!formData.story.trim()) return "请输入讲解词";
    if (!formData.latitude.trim()) return "请输入纬度";
    if (!formData.longitude.trim()) return "请输入经度";
    if (!formData.openTime.trim()) return "请输入开放时间";
    if (!formData.recommendedDuration.trim()) return "请输入推荐时长";

    const latitude = Number(formData.latitude);
    const longitude = Number(formData.longitude);
    const recommendedDuration = Number(formData.recommendedDuration);
    if (Number.isNaN(latitude)) return "纬度必须是数字";
    if (Number.isNaN(longitude)) return "经度必须是数字";
    if (Number.isNaN(recommendedDuration) || recommendedDuration <= 0) return "推荐时长必须是大于 0 的数字";

    return "";
  };

  const buildRequest = (): AdminSpotRequest => ({
    name: formData.name.trim(),
    type: formData.type.trim(),
    description: formData.description.trim(),
    story: formData.story.trim(),
    latitude: Number(formData.latitude),
    longitude: Number(formData.longitude),
    openTime: formData.openTime.trim(),
    recommendedDuration: Number(formData.recommendedDuration),
    tags: formData.tags.trim(),
    imageUrl: formData.imageUrl.trim() || null,
    enabled: formData.enabled,
  });

  const handleSave = async () => {
    const validationMessage = validateForm();
    if (validationMessage) {
      setFormError(validationMessage);
      return;
    }

    setIsSaving(true);
    setFormError("");
    try {
      const payload = buildRequest();
      if (editingSpot) {
        await updateAdminSpot(editingSpot.id, payload);
      } else {
        await createAdminSpot(payload);
      }
      setIsFormOpen(false);
      setEditingSpot(null);
      await loadSpots();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "保存失败，请稍后再试");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleEnabled = async (spot: AdminSpot) => {
    setErrorMessage("");
    try {
      await setAdminSpotEnabled(spot.id, !spot.enabled);
      await loadSpots();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "更新状态失败");
    }
  };

  const handleDelete = async (spot: AdminSpot) => {
    if (!window.confirm(`确认删除“${spot.name}”吗？如果点位已被路线引用，系统会自动改为禁用。`)) {
      return;
    }

    setErrorMessage("");
    try {
      await deleteAdminSpot(spot.id);
      await loadSpots();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "删除失败");
    }
  };

  return (
    <AdminLayout activeMenu="spots">
        <header className="admin-spot-header">
          <div>
            <h1>点位管理</h1>
            <p>维护校园文化点位、服务设施、开放时间和数字人讲解词，为地图导览和路线推荐提供数据支撑。</p>
          </div>
          <button className="admin-spot-primary-button" onClick={openCreateModal}>新增点位</button>
        </header>

        <section className="admin-spot-stats">
          <div className="admin-spot-stat-card">
            <span>点位总数</span>
            <strong>{stats.total}</strong>
          </div>
          <div className="admin-spot-stat-card">
            <span>启用点位数</span>
            <strong>{stats.enabled}</strong>
          </div>
          <div className="admin-spot-stat-card">
            <span>点位类型数</span>
            <strong>{stats.typeCount}</strong>
          </div>
          <div className="admin-spot-stat-card">
            <span>最近更新时间</span>
            <strong className="admin-spot-date-stat">{formatDate(stats.latestUpdatedAt)}</strong>
          </div>
        </section>

        <section className="admin-spot-panel">
          <div className="admin-spot-toolbar">
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索点位名称、类型、简介或标签"
              className="admin-spot-search"
            />
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              {spotTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="全部">全部</option>
              <option value="启用">启用</option>
              <option value="禁用">禁用</option>
            </select>
          </div>

          {errorMessage && <div className="admin-spot-alert">{errorMessage}</div>}

          <div className="admin-spot-table-wrap">
            <table className="admin-spot-table">
              <thead>
                <tr>
                  <th>点位名称</th>
                  <th>类型</th>
                  <th>开放时间</th>
                  <th>推荐时长</th>
                  <th>标签</th>
                  <th>坐标</th>
                  <th>状态</th>
                  <th>更新时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="admin-spot-empty">加载中...</td>
                  </tr>
                ) : filteredSpots.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="admin-spot-empty">暂无点位数据</td>
                  </tr>
                ) : (
                  filteredSpots.map((spot) => (
                    <tr key={spot.id}>
                      <td><div className="admin-spot-title">{spot.name}</div></td>
                      <td>{spot.type}</td>
                      <td>{spot.openTime}</td>
                      <td>{spot.recommendedDuration} 分钟</td>
                      <td><div className="admin-spot-tags">{spot.tags || "-"}</div></td>
                      <td><div className="admin-spot-coordinate">{formatCoordinate(spot)}</div></td>
                      <td>
                        <span className={`admin-spot-status ${spot.enabled ? "enabled" : "disabled"}`}>
                          {spot.enabled ? "启用" : "禁用"}
                        </span>
                      </td>
                      <td>{formatDate(spot.updatedAt)}</td>
                      <td>
                        <div className="admin-spot-actions">
                          <button onClick={() => setDetailSpot(spot)}>详情</button>
                          <button onClick={() => openEditModal(spot)}>编辑</button>
                          <button onClick={() => handleToggleEnabled(spot)}>{spot.enabled ? "禁用" : "启用"}</button>
                          <button className="danger" onClick={() => handleDelete(spot)}>删除</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      

      {isFormOpen && (
        <div className="admin-spot-modal-backdrop" onClick={closeFormModal}>
          <div className="admin-spot-modal admin-spot-form-modal" onClick={(event) => event.stopPropagation()}>
            <div className="admin-spot-modal-header">
              <h2>{editingSpot ? "编辑点位" : "新增点位"}</h2>
              <button onClick={closeFormModal} disabled={isSaving}>×</button>
            </div>
            <div className="admin-spot-form">
              <label>
                点位名称
                <input value={formData.name} onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))} />
              </label>
              <label>
                点位类型
                <select value={formData.type} onChange={(event) => setFormData((prev) => ({ ...prev, type: event.target.value }))}>
                  {editableSpotTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </label>
              <label className="admin-spot-form-wide">
                点位简介
                <textarea rows={3} value={formData.description} onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))} />
              </label>
              <label className="admin-spot-form-wide">
                讲解词 / 文化故事
                <textarea rows={6} value={formData.story} onChange={(event) => setFormData((prev) => ({ ...prev, story: event.target.value }))} />
              </label>
              <label>
                纬度
                <input type="number" value={formData.latitude} onChange={(event) => setFormData((prev) => ({ ...prev, latitude: event.target.value }))} />
              </label>
              <label>
                经度
                <input type="number" value={formData.longitude} onChange={(event) => setFormData((prev) => ({ ...prev, longitude: event.target.value }))} />
              </label>
              <label>
                开放时间
                <input value={formData.openTime} onChange={(event) => setFormData((prev) => ({ ...prev, openTime: event.target.value }))} placeholder="09:00-18:00" />
              </label>
              <label>
                推荐时长
                <input type="number" value={formData.recommendedDuration} onChange={(event) => setFormData((prev) => ({ ...prev, recommendedDuration: event.target.value }))} />
              </label>
              <label>
                标签
                <input value={formData.tags} onChange={(event) => setFormData((prev) => ({ ...prev, tags: event.target.value }))} placeholder="校友,拍照,校史" />
              </label>
              <label>
                图片地址
                <input value={formData.imageUrl} onChange={(event) => setFormData((prev) => ({ ...prev, imageUrl: event.target.value }))} placeholder="可为空" />
              </label>
              <label className="admin-spot-checkbox">
                <input type="checkbox" checked={formData.enabled} onChange={(event) => setFormData((prev) => ({ ...prev, enabled: event.target.checked }))} />
                启用点位
              </label>
              {formError && <div className="admin-spot-alert admin-spot-form-wide">{formError}</div>}
            </div>
            <div className="admin-spot-modal-footer">
              <button className="admin-spot-secondary-button" onClick={closeFormModal} disabled={isSaving}>取消</button>
              <button className="admin-spot-primary-button" onClick={handleSave} disabled={isSaving}>
                {isSaving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}

      {detailSpot && (
        <div className="admin-spot-modal-backdrop" onClick={() => setDetailSpot(null)}>
          <div className="admin-spot-modal admin-spot-detail-modal" onClick={(event) => event.stopPropagation()}>
            <div className="admin-spot-modal-header">
              <h2>点位详情</h2>
              <button onClick={() => setDetailSpot(null)}>×</button>
            </div>
            <div className="admin-spot-detail-body">
              <div className="admin-spot-detail-title">
                <h3>{detailSpot.name}</h3>
                <span className={`admin-spot-status ${detailSpot.enabled ? "enabled" : "disabled"}`}>
                  {detailSpot.enabled ? "启用" : "禁用"}
                </span>
              </div>
              <dl className="admin-spot-detail-grid">
                <div><dt>类型</dt><dd>{detailSpot.type}</dd></div>
                <div><dt>开放时间</dt><dd>{detailSpot.openTime}</dd></div>
                <div><dt>推荐时长</dt><dd>{detailSpot.recommendedDuration} 分钟</dd></div>
                <div><dt>经纬度</dt><dd>{formatCoordinate(detailSpot)}</dd></div>
                <div><dt>标签</dt><dd>{detailSpot.tags || "-"}</dd></div>
                <div><dt>更新时间</dt><dd>{formatDate(detailSpot.updatedAt)}</dd></div>
              </dl>
              <section className="admin-spot-detail-section">
                <h4>点位描述</h4>
                <p>{detailSpot.description}</p>
              </section>
              <section className="admin-spot-detail-section">
                <h4>讲解词 / 文化故事</h4>
                <p>{detailSpot.story}</p>
              </section>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

export default AdminSpotPage;
