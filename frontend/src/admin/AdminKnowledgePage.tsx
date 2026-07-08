import { useEffect, useMemo, useState } from "react";
import "./AdminKnowledgePage.css";
import AdminLayout from "./AdminLayout";
import {
  createKnowledgeDoc,
  deleteKnowledgeDoc,
  getKnowledgeChunks,
  getKnowledgeDocs,
  setKnowledgeDocEnabled,
  updateKnowledgeDoc,
} from "../api/adminKnowledgeApi";
import type { KnowledgeChunk, KnowledgeDoc, KnowledgeDocRequest } from "../api/adminKnowledgeApi";

const categories = ["全部", "校史资料", "点位介绍", "路线资料", "FAQ", "活动公告", "校友服务"];
const editableCategories = categories.filter((category) => category !== "全部");
const emptyForm: KnowledgeDocRequest = {
  title: "",
  category: "校史资料",
  sourceName: "",
  content: "",
  enabled: true,
};

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function formatKeywords(keywords: string | string[]) {
  if (Array.isArray(keywords)) return keywords.filter(Boolean).join("、") || "-";
  return keywords || "-";
}

function AdminKnowledgePage() {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [keyword, setKeyword] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("全部");
  const [statusFilter, setStatusFilter] = useState("全部");
  const [editingDoc, setEditingDoc] = useState<KnowledgeDoc | null>(null);
  const [formData, setFormData] = useState<KnowledgeDocRequest>(emptyForm);
  const [formError, setFormError] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [chunksDoc, setChunksDoc] = useState<KnowledgeDoc | null>(null);
  const [chunks, setChunks] = useState<KnowledgeChunk[]>([]);
  const [isChunksLoading, setIsChunksLoading] = useState(false);
  const [chunksError, setChunksError] = useState("");

  const loadDocs = async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const data = await getKnowledgeDocs();
      setDocs(data);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "加载知识文档失败");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadDocs(); }, []);

  const stats = useMemo(() => {
    const latestUpdatedAt = docs.reduce<string>((latest, doc) => {
      if (!doc.updatedAt) return latest;
      if (!latest) return doc.updatedAt;
      return new Date(doc.updatedAt).getTime() > new Date(latest).getTime() ? doc.updatedAt : latest;
    }, "");
    return {
      total: docs.length,
      enabled: docs.filter((doc) => doc.enabled).length,
      chunks: docs.reduce((total, doc) => total + (doc.chunkCount || 0), 0),
      latestUpdatedAt,
    };
  }, [docs]);

  const filteredDocs = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return docs.filter((doc) => {
      const matchesKeyword = !normalizedKeyword || doc.title.toLowerCase().includes(normalizedKeyword) || doc.category.toLowerCase().includes(normalizedKeyword) || doc.sourceName.toLowerCase().includes(normalizedKeyword);
      const matchesCategory = categoryFilter === "全部" || doc.category === categoryFilter;
      const matchesStatus = statusFilter === "全部" || (statusFilter === "启用" && doc.enabled) || (statusFilter === "禁用" && !doc.enabled);
      return matchesKeyword && matchesCategory && matchesStatus;
    });
  }, [docs, keyword, categoryFilter, statusFilter]);

  const openCreateModal = () => { setEditingDoc(null); setFormData(emptyForm); setFormError(""); setIsFormOpen(true); };
  const openEditModal = (doc: KnowledgeDoc) => { setEditingDoc(doc); setFormData({ title: doc.title, category: doc.category, sourceName: doc.sourceName, content: doc.content, enabled: doc.enabled }); setFormError(""); setIsFormOpen(true); };
  const closeFormModal = () => { if (isSaving) return; setIsFormOpen(false); setEditingDoc(null); setFormError(""); };

  const validateForm = () => {
    if (!formData.title.trim()) return "请输入资料标题";
    if (!formData.category.trim()) return "请选择分类";
    if (!formData.sourceName.trim()) return "请输入来源";
    if (!formData.content.trim()) return "请输入资料内容";
    return "";
  };

  const handleSave = async () => {
    const validationMessage = validateForm();
    if (validationMessage) { setFormError(validationMessage); return; }
    setIsSaving(true); setFormError("");
    try {
      const payload = { ...formData, title: formData.title.trim(), category: formData.category.trim(), sourceName: formData.sourceName.trim(), content: formData.content.trim() };
      if (editingDoc) await updateKnowledgeDoc(editingDoc.id, payload);
      else await createKnowledgeDoc(payload);
      setIsFormOpen(false); setEditingDoc(null); await loadDocs();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "保存失败，请稍后再试");
    } finally { setIsSaving(false); }
  };

  const handleToggleEnabled = async (doc: KnowledgeDoc) => { setErrorMessage(""); try { await setKnowledgeDocEnabled(doc.id, !doc.enabled); await loadDocs(); } catch (error) { setErrorMessage(error instanceof Error ? error.message : "更新状态失败"); } };
  const handleDelete = async (doc: KnowledgeDoc) => { if (!window.confirm(`确认删除"${doc.title}"吗？`)) return; setErrorMessage(""); try { await deleteKnowledgeDoc(doc.id); await loadDocs(); } catch (error) { setErrorMessage(error instanceof Error ? error.message : "删除失败"); } };

  const openChunksModal = async (doc: KnowledgeDoc) => { setChunksDoc(doc); setChunks([]); setChunksError(""); setIsChunksLoading(true); try { const data = await getKnowledgeChunks(doc.id); setChunks(data); } catch (error) { setChunksError(error instanceof Error ? error.message : "加载知识片段失败"); } finally { setIsChunksLoading(false); } };

  return (
    <AdminLayout activeMenu="knowledge">
      <header className="admin-spot-header">
        <div>
          <h1>知识库管理</h1>
          <p>维护校史资料、点位介绍、活动公告和 FAQ，为 AI 数字人问答提供可信来源。</p>
        </div>
        <button className="admin-spot-primary-button" onClick={openCreateModal}>新增资料</button>
      </header>

      <section className="admin-spot-stats">
        <div className="admin-spot-stat-card"><span>文档总数</span><strong>{stats.total}</strong></div>
        <div className="admin-spot-stat-card"><span>启用文档数</span><strong>{stats.enabled}</strong></div>
        <div className="admin-spot-stat-card"><span>知识片段数</span><strong>{stats.chunks}</strong></div>
        <div className="admin-spot-stat-card"><span>最近更新时间</span><strong className="admin-spot-date-stat">{formatDate(stats.latestUpdatedAt)}</strong></div>
      </section>

      <section className="admin-spot-panel">
        <div className="admin-spot-toolbar">
          <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索标题、分类或来源" className="admin-spot-search" />
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="全部">全部</option><option value="启用">启用</option><option value="禁用">禁用</option></select>
        </div>
        {errorMessage && <div className="admin-spot-alert">{errorMessage}</div>}
        <div className="admin-spot-table-wrap">
          <table className="admin-spot-table">
            <thead><tr><th>标题</th><th>分类</th><th>来源</th><th>状态</th><th>片段数</th><th>更新时间</th><th>操作</th></tr></thead>
            <tbody>
              {isLoading ? <tr><td colSpan={7} className="admin-spot-empty">加载中...</td></tr> :
                filteredDocs.length === 0 ? <tr><td colSpan={7} className="admin-spot-empty">暂无知识文档</td></tr> :
                filteredDocs.map((doc) => (
                  <tr key={doc.id}>
                    <td><div className="admin-knowledge-doc-title">{doc.title}</div></td>
                    <td>{doc.category}</td>
                    <td>{doc.sourceName}</td>
                    <td><span className={`admin-spot-status ${doc.enabled ? "enabled" : "disabled"}`}>{doc.enabled ? "启用" : "禁用"}</span></td>
                    <td>{doc.chunkCount || 0}</td>
                    <td>{formatDate(doc.updatedAt)}</td>
                    <td><div className="admin-spot-actions"><button onClick={() => openChunksModal(doc)}>片段</button><button onClick={() => openEditModal(doc)}>编辑</button><button onClick={() => handleToggleEnabled(doc)}>{doc.enabled ? "禁用" : "启用"}</button><button className="danger" onClick={() => handleDelete(doc)}>删除</button></div></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      {isFormOpen && (
        <div className="admin-spot-modal-backdrop" onClick={closeFormModal}>
          <div className="admin-spot-modal" onClick={(event) => event.stopPropagation()}>
            <div className="admin-spot-modal-header"><h2>{editingDoc ? "编辑资料" : "新增资料"}</h2><button onClick={closeFormModal} disabled={isSaving}>×</button></div>
            <div className="admin-spot-form">
              <label>资料标题<input value={formData.title} onChange={(event) => setFormData((prev) => ({ ...prev, title: event.target.value }))} placeholder="请输入资料标题" /></label>
              <label>分类<select value={formData.category} onChange={(event) => setFormData((prev) => ({ ...prev, category: event.target.value }))}>{editableCategories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
              <label>来源<input value={formData.sourceName} onChange={(event) => setFormData((prev) => ({ ...prev, sourceName: event.target.value }))} placeholder="请输入来源名称" /></label>
              <label>资料内容<textarea rows={8} value={formData.content} onChange={(event) => setFormData((prev) => ({ ...prev, content: event.target.value }))} placeholder="请输入资料内容" /></label>
              <label className="admin-spot-checkbox"><input type="checkbox" checked={formData.enabled} onChange={(event) => setFormData((prev) => ({ ...prev, enabled: event.target.checked }))} />启用文档</label>
              {formError && <div className="admin-spot-alert">{formError}</div>}
            </div>
            <div className="admin-spot-modal-footer">
              <button className="admin-spot-secondary-button" onClick={closeFormModal} disabled={isSaving}>取消</button>
              <button className="admin-spot-primary-button" onClick={handleSave} disabled={isSaving}>{isSaving ? "保存中..." : "保存"}</button>
            </div>
          </div>
        </div>
      )}

      {chunksDoc && (
        <div className="admin-spot-modal-backdrop" onClick={() => setChunksDoc(null)}>
          <div className="admin-spot-modal admin-knowledge-chunks-modal" onClick={(event) => event.stopPropagation()}>
            <div className="admin-spot-modal-header"><h2>知识片段：{chunksDoc.title}</h2><button onClick={() => setChunksDoc(null)}>×</button></div>
            <div className="admin-knowledge-chunks-body">
              {isChunksLoading ? <div className="admin-spot-empty">加载中...</div> :
                chunksError ? <div className="admin-spot-alert">{chunksError}</div> :
                chunks.length === 0 ? <div className="admin-spot-empty">暂无知识片段</div> :
                chunks.map((chunk) => (
                  <article key={chunk.id} className="admin-knowledge-chunk-card">
                    <div className="admin-knowledge-chunk-head"><h3>{chunk.title}</h3><span>{chunk.enabled ? "启用" : "禁用"}</span></div>
                    <div className="admin-knowledge-chunk-meta"><span>{chunk.category}</span><span>{chunk.sourceName}</span><span>关键词：{formatKeywords(chunk.keywords)}</span></div>
                    <p>{chunk.content}</p>
                  </article>
                ))}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

export default AdminKnowledgePage;
