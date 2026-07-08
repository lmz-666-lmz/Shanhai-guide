import { useEffect, useMemo, useState } from "react";
import "./AdminNoticePage.css";
import AdminLayout from "./AdminLayout";
import {
  createNotice,
  deleteNotice,
  getAdminNotices,
  setNoticeEnabled,
  updateNotice,
} from "../api/adminNoticeApi";
import type { Notice, NoticeRequest } from "../api/adminNoticeApi";

const noticeTypes = ["全部", "活动", "闭园", "拥堵", "服务", "其他"];
const editableNoticeTypes = noticeTypes.filter((type) => type !== "全部");

const emptyForm: NoticeRequest = {
  title: "",
  noticeType: "活动",
  content: "",
  location: "",
  startTime: "",
  endTime: "",
  priority: 1,
  enabled: true,
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function toLocalInputValue(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function toRequestTime(value: string) {
  return value ? new Date(value).toISOString() : "";
}

function AdminNoticePage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [keyword, setKeyword] = useState("");
  const [typeFilter, setTypeFilter] = useState("全部");
  const [statusFilter, setStatusFilter] = useState("全部");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);
  const [formData, setFormData] = useState<NoticeRequest>(emptyForm);
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [detailNotice, setDetailNotice] = useState<Notice | null>(null);

  const loadNotices = async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      setNotices(await getAdminNotices());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "加载公告失败");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadNotices();
  }, []);

  const filteredNotices = useMemo(() => {
    const text = keyword.trim().toLowerCase();
    return notices.filter((notice) => {
      const matchText = !text || [notice.title, notice.noticeType, notice.content, notice.location || ""].some((item) => item.toLowerCase().includes(text));
      const matchType = typeFilter === "全部" || notice.noticeType === typeFilter;
      const matchStatus = statusFilter === "全部" || (statusFilter === "启用" && notice.enabled) || (statusFilter === "禁用" && !notice.enabled);
      return matchText && matchType && matchStatus;
    });
  }, [notices, keyword, typeFilter, statusFilter]);

  const stats = useMemo(() => {
    const types = new Set(notices.map((notice) => notice.noticeType).filter(Boolean));
    const latest = notices.map((notice) => notice.updatedAt).sort().at(-1);
    return {
      total: notices.length,
      enabled: notices.filter((notice) => notice.enabled).length,
      types: types.size,
      latest,
    };
  }, [notices]);

  const openCreate = () => {
    setEditingNotice(null);
    setFormData(emptyForm);
    setFormError("");
    setIsFormOpen(true);
  };

  const openEdit = (notice: Notice) => {
    setEditingNotice(notice);
    setFormData({
      title: notice.title,
      noticeType: notice.noticeType,
      content: notice.content,
      location: notice.location || "",
      startTime: toLocalInputValue(notice.startTime),
      endTime: toLocalInputValue(notice.endTime),
      priority: notice.priority,
      enabled: notice.enabled,
    });
    setFormError("");
    setIsFormOpen(true);
  };

  const validate = () => {
    if (!formData.title.trim()) return "请输入公告标题";
    if (!formData.content.trim()) return "请输入公告内容";
    if (!formData.startTime || !formData.endTime) return "请选择开始和结束时间";
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
      const payload = { ...formData, startTime: toRequestTime(formData.startTime), endTime: toRequestTime(formData.endTime) };
      if (editingNotice) await updateNotice(editingNotice.id, payload);
      else await createNotice(payload);
      setIsFormOpen(false);
      await loadNotices();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "保存失败");
    } finally {
      setIsSaving(false);
    }
  };

  const toggle = async (notice: Notice) => {
    setErrorMessage("");
    try {
      await setNoticeEnabled(notice.id, !notice.enabled);
      await loadNotices();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "更新公告状态失败");
    }
  };

  const remove = async (notice: Notice) => {
    if (!window.confirm(`确认删除“${notice.title}”吗？`)) return;
    setErrorMessage("");
    try {
      await deleteNotice(notice.id);
      await loadNotices();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "删除公告失败");
    }
  };

  return (
    <AdminLayout activeMenu="notices">
        <header className="admin-spot-header">
          <div>
            <h1>活动公告管理</h1>
            <p>维护校友活动、开放安排和服务提醒，并让数字人能回答近期公告相关问题。</p>
          </div>
          <button className="admin-spot-primary-button" onClick={openCreate}>新增公告</button>
        </header>
        <section className="admin-spot-stats">
          <div className="admin-spot-stat-card"><span>公告总数</span><strong>{stats.total}</strong></div>
          <div className="admin-spot-stat-card"><span>启用公告数</span><strong>{stats.enabled}</strong></div>
          <div className="admin-spot-stat-card"><span>公告类型数</span><strong>{stats.types}</strong></div>
          <div className="admin-spot-stat-card"><span>最近更新时间</span><strong className="admin-spot-date-stat">{formatDate(stats.latest)}</strong></div>
        </section>
        <section className="admin-spot-panel">
          <div className="admin-spot-toolbar">
            <input className="admin-spot-search" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索标题、类型、地点或内容" />
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>{noticeTypes.map((type) => <option key={type}>{type}</option>)}</select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>全部</option><option>启用</option><option>禁用</option></select>
          </div>
          {errorMessage && <div className="admin-spot-alert">{errorMessage}</div>}
          <div className="admin-spot-table-wrap">
            <table className="admin-spot-table">
              <thead><tr><th>标题</th><th>类型</th><th>地点</th><th>时间</th><th>优先级</th><th>状态</th><th>更新时间</th><th>操作</th></tr></thead>
              <tbody>
                {isLoading ? <tr><td colSpan={8} className="admin-spot-empty">加载中...</td></tr> : filteredNotices.map((notice) => (
                  <tr key={notice.id}>
                    <td><div className="admin-spot-title">{notice.title}</div><div className="admin-notice-content">{notice.content}</div></td>
                    <td>{notice.noticeType}</td>
                    <td>{notice.location || "-"}</td>
                    <td>{formatDate(notice.startTime)} - {formatDate(notice.endTime)}</td>
                    <td><span className="admin-notice-priority">{notice.priority}</span></td>
                    <td><span className={`admin-spot-status ${notice.enabled ? "enabled" : "disabled"}`}>{notice.enabled ? "启用" : "禁用"}</span></td>
                    <td>{formatDate(notice.updatedAt)}</td>
                    <td><div className="admin-spot-actions"><button onClick={() => setDetailNotice(notice)}>详情</button><button onClick={() => openEdit(notice)}>编辑</button><button onClick={() => toggle(notice)}>{notice.enabled ? "禁用" : "启用"}</button><button className="danger" onClick={() => remove(notice)}>删除</button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      
      {isFormOpen && (
        <div className="admin-spot-modal-backdrop" onClick={() => setIsFormOpen(false)}>
          <div className="admin-spot-modal admin-spot-form-modal" onClick={(event) => event.stopPropagation()}>
            <div className="admin-spot-modal-header"><h2>{editingNotice ? "编辑公告" : "新增公告"}</h2><button onClick={() => setIsFormOpen(false)}>×</button></div>
            <div className="admin-spot-form">
              <label>公告标题<input value={formData.title} onChange={(event) => setFormData({ ...formData, title: event.target.value })} /></label>
              <label>公告类型<select value={formData.noticeType} onChange={(event) => setFormData({ ...formData, noticeType: event.target.value })}>{editableNoticeTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
              <label>地点<input value={formData.location} onChange={(event) => setFormData({ ...formData, location: event.target.value })} /></label>
              <label>优先级<input type="number" value={formData.priority} onChange={(event) => setFormData({ ...formData, priority: Number(event.target.value) })} /></label>
              <label>开始时间<input type="datetime-local" value={formData.startTime} onChange={(event) => setFormData({ ...formData, startTime: event.target.value })} /></label>
              <label>结束时间<input type="datetime-local" value={formData.endTime} onChange={(event) => setFormData({ ...formData, endTime: event.target.value })} /></label>
              <label className="admin-spot-checkbox"><input type="checkbox" checked={formData.enabled} onChange={(event) => setFormData({ ...formData, enabled: event.target.checked })} />启用公告</label>
              <label className="admin-spot-form-wide">公告内容<textarea rows={6} value={formData.content} onChange={(event) => setFormData({ ...formData, content: event.target.value })} /></label>
              {formError && <div className="admin-spot-alert admin-spot-form-wide">{formError}</div>}
            </div>
            <div className="admin-spot-modal-footer"><button className="admin-spot-secondary-button" onClick={() => setIsFormOpen(false)} disabled={isSaving}>取消</button><button className="admin-spot-primary-button" onClick={save} disabled={isSaving}>{isSaving ? "保存中..." : "保存"}</button></div>
          </div>
        </div>
      )}
      {detailNotice && (
        <div className="admin-spot-modal-backdrop" onClick={() => setDetailNotice(null)}>
          <div className="admin-spot-modal admin-spot-detail-modal" onClick={(event) => event.stopPropagation()}>
            <div className="admin-spot-modal-header"><h2>公告详情</h2><button onClick={() => setDetailNotice(null)}>×</button></div>
            <div className="admin-spot-detail-body">
              <div className="admin-spot-detail-title"><h3>{detailNotice.title}</h3><span className={`admin-spot-status ${detailNotice.enabled ? "enabled" : "disabled"}`}>{detailNotice.enabled ? "启用" : "禁用"}</span></div>
              <section className="admin-spot-detail-section"><h4>公告内容</h4><p>{detailNotice.content}</p></section>
              <section className="admin-spot-detail-section"><h4>基础信息</h4><p>类型：{detailNotice.noticeType}；地点：{detailNotice.location || "-"}；时间：{formatDate(detailNotice.startTime)} - {formatDate(detailNotice.endTime)}；优先级：{detailNotice.priority}</p></section>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

export default AdminNoticePage;
