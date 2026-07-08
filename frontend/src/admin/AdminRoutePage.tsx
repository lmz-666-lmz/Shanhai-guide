import { useEffect, useMemo, useState } from "react";
import "./AdminRoutePage.css";
import AdminLayout from "./AdminLayout";
import { getAdminSpots } from "../api/adminSpotApi";
import type { AdminSpot } from "../api/adminSpotApi";
import { createAdminRoute, deleteAdminRoute, getAdminRoutes, setAdminRouteEnabled, updateAdminRoute } from "../api/adminRouteApi";
import type { AdminRoute, AdminRouteRequest, RouteSpotAdminRequest } from "../api/adminRouteApi";

const routeTypes = ["全部", "校友", "新生", "家长", "研学", "快速", "访客"];

const emptyForm: AdminRouteRequest = {
  name: "",
  routeType: "校友",
  description: "",
  suitableFor: "",
  estimatedDuration: 60,
  distanceText: "",
  reason: "",
  enabled: true,
  spots: [],
};

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function AdminRoutePage() {
  const [routes, setRoutes] = useState<AdminRoute[]>([]);
  const [spots, setSpots] = useState<AdminSpot[]>([]);
  const [keyword, setKeyword] = useState("");
  const [typeFilter, setTypeFilter] = useState("全部");
  const [statusFilter, setStatusFilter] = useState("全部");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<AdminRoute | null>(null);
  const [formData, setFormData] = useState<AdminRouteRequest>(emptyForm);
  const [formError, setFormError] = useState("");
  const [detailRoute, setDetailRoute] = useState<AdminRoute | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const [routeData, spotData] = await Promise.all([getAdminRoutes(), getAdminSpots({ enabled: true })]);
      setRoutes(routeData);
      setSpots(spotData);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "加载路线失败");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredRoutes = useMemo(() => {
    const text = keyword.trim().toLowerCase();
    return routes.filter((route) => {
      const matchText = !text || route.name.toLowerCase().includes(text) || route.routeType.toLowerCase().includes(text) || route.description.toLowerCase().includes(text);
      const matchType = typeFilter === "全部" || route.routeType === typeFilter;
      const matchStatus = statusFilter === "全部" || (statusFilter === "启用" && route.enabled) || (statusFilter === "禁用" && !route.enabled);
      return matchText && matchType && matchStatus;
    });
  }, [routes, keyword, typeFilter, statusFilter]);

  const stats = useMemo(() => ({
    total: routes.length,
    enabled: routes.filter((route) => route.enabled).length,
    spots: routes.reduce((sum, route) => sum + route.spots.length, 0),
    latest: routes.map((route) => route.updatedAt).sort().at(-1),
  }), [routes]);

  const openCreate = () => {
    setEditingRoute(null);
    setFormData({ ...emptyForm, spots: spots[0] ? [{ spotId: spots[0].id, sortOrder: 1, stayMinutes: 10, note: "" }] : [] });
    setFormError("");
    setIsFormOpen(true);
  };

  const openEdit = (route: AdminRoute) => {
    setEditingRoute(route);
    setFormData({
      name: route.name,
      routeType: route.routeType,
      description: route.description,
      suitableFor: route.suitableFor,
      estimatedDuration: route.estimatedDuration,
      distanceText: route.distanceText,
      reason: route.reason,
      enabled: route.enabled,
      spots: route.spots.map((spot) => ({ spotId: spot.spotId, sortOrder: spot.sortOrder, stayMinutes: spot.stayMinutes, note: spot.note || "" })),
    });
    setFormError("");
    setIsFormOpen(true);
  };

  const updateSpotRow = (index: number, patch: Partial<RouteSpotAdminRequest>) => {
    setFormData((prev) => ({ ...prev, spots: prev.spots.map((spot, i) => i === index ? { ...spot, ...patch } : spot) }));
  };

  const addSpotRow = () => {
    const firstSpot = spots[0];
    if (!firstSpot) return;
    setFormData((prev) => ({ ...prev, spots: [...prev.spots, { spotId: firstSpot.id, sortOrder: prev.spots.length + 1, stayMinutes: 10, note: "" }] }));
  };

  const validate = () => {
    if (!formData.name.trim()) return "请输入路线名称";
    if (!formData.description.trim()) return "请输入路线简介";
    if (!formData.reason.trim()) return "请输入推荐理由";
    if (formData.spots.length === 0) return "请至少添加一个路线点位";
    return "";
  };

  const save = async () => {
    const message = validate();
    if (message) {
      setFormError(message);
      return;
    }
    try {
      if (editingRoute) await updateAdminRoute(editingRoute.id, formData);
      else await createAdminRoute(formData);
      setIsFormOpen(false);
      await loadData();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "保存失败");
    }
  };

  const toggle = async (route: AdminRoute) => {
    setErrorMessage("");
    try {
      await setAdminRouteEnabled(route.id, !route.enabled);
      await loadData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "更新路线状态失败");
    }
  };

  const remove = async (route: AdminRoute) => {
    if (!window.confirm(`确认删除“${route.name}”吗？`)) return;
    setErrorMessage("");
    try {
      await deleteAdminRoute(route.id);
      await loadData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "删除路线失败");
    }
  };

  return (
    <AdminLayout activeMenu="routes">
        <header className="admin-spot-header"><div><h1>路线管理</h1><p>维护校园参观路线、适用人群和途经点位，为路线推荐提供数据支撑。</p></div><button className="admin-spot-primary-button" onClick={openCreate}>新增路线</button></header>
        <section className="admin-spot-stats"><div className="admin-spot-stat-card"><span>路线总数</span><strong>{stats.total}</strong></div><div className="admin-spot-stat-card"><span>启用路线数</span><strong>{stats.enabled}</strong></div><div className="admin-spot-stat-card"><span>路线点位数</span><strong>{stats.spots}</strong></div><div className="admin-spot-stat-card"><span>最近更新时间</span><strong className="admin-spot-date-stat">{formatDate(stats.latest)}</strong></div></section>
        <section className="admin-spot-panel"><div className="admin-spot-toolbar"><input className="admin-spot-search" value={keyword} onChange={(event)=>setKeyword(event.target.value)} placeholder="搜索路线名称、类型或简介" /><select value={typeFilter} onChange={(event)=>setTypeFilter(event.target.value)}>{routeTypes.map((type)=><option key={type}>{type}</option>)}</select><select value={statusFilter} onChange={(event)=>setStatusFilter(event.target.value)}><option>全部</option><option>启用</option><option>禁用</option></select></div>{errorMessage&&<div className="admin-spot-alert">{errorMessage}</div>}<div className="admin-spot-table-wrap"><table className="admin-spot-table"><thead><tr><th>路线名称</th><th>类型</th><th>适合人群</th><th>时长</th><th>距离</th><th>点位</th><th>状态</th><th>更新时间</th><th>操作</th></tr></thead><tbody>{isLoading?<tr><td colSpan={9} className="admin-spot-empty">加载中...</td></tr>:filteredRoutes.map((route)=><tr key={route.id}><td><div className="admin-spot-title">{route.name}</div></td><td>{route.routeType}</td><td>{route.suitableFor}</td><td>{route.estimatedDuration} 分钟</td><td>{route.distanceText}</td><td>{route.spots.length}</td><td><span className={`admin-spot-status ${route.enabled?"enabled":"disabled"}`}>{route.enabled?"启用":"禁用"}</span></td><td>{formatDate(route.updatedAt)}</td><td><div className="admin-spot-actions"><button onClick={()=>setDetailRoute(route)}>详情</button><button onClick={()=>openEdit(route)}>编辑</button><button onClick={()=>toggle(route)}>{route.enabled?"禁用":"启用"}</button><button className="danger" onClick={()=>remove(route)}>删除</button></div></td></tr>)}</tbody></table></div></section>
      
      {isFormOpen&&<div className="admin-spot-modal-backdrop" onClick={()=>setIsFormOpen(false)}><div className="admin-spot-modal admin-spot-form-modal" onClick={(event)=>event.stopPropagation()}><div className="admin-spot-modal-header"><h2>{editingRoute?"编辑路线":"新增路线"}</h2><button onClick={()=>setIsFormOpen(false)}>×</button></div><div className="admin-spot-form"><label>路线名称<input value={formData.name} onChange={(event)=>setFormData({...formData,name:event.target.value})}/></label><label>路线类型<input value={formData.routeType} onChange={(event)=>setFormData({...formData,routeType:event.target.value})}/></label><label>适合人群<input value={formData.suitableFor} onChange={(event)=>setFormData({...formData,suitableFor:event.target.value})}/></label><label>预计时长<input type="number" value={formData.estimatedDuration} onChange={(event)=>setFormData({...formData,estimatedDuration:Number(event.target.value)})}/></label><label>距离说明<input value={formData.distanceText} onChange={(event)=>setFormData({...formData,distanceText:event.target.value})}/></label><label className="admin-spot-checkbox"><input type="checkbox" checked={formData.enabled} onChange={(event)=>setFormData({...formData,enabled:event.target.checked})}/>启用路线</label><label className="admin-spot-form-wide">路线简介<textarea rows={3} value={formData.description} onChange={(event)=>setFormData({...formData,description:event.target.value})}/></label><label className="admin-spot-form-wide">推荐理由<textarea rows={3} value={formData.reason} onChange={(event)=>setFormData({...formData,reason:event.target.value})}/></label><div className="admin-route-spot-list"><strong>路线点位</strong>{formData.spots.map((row,index)=><div className="admin-route-spot-row" key={index}><label>点位<select value={row.spotId} onChange={(event)=>updateSpotRow(index,{spotId:Number(event.target.value)})}>{spots.map((spot)=><option key={spot.id} value={spot.id}>{spot.name}</option>)}</select></label><label>顺序<input type="number" value={row.sortOrder} onChange={(event)=>updateSpotRow(index,{sortOrder:Number(event.target.value)})}/></label><label>停留<input type="number" value={row.stayMinutes} onChange={(event)=>updateSpotRow(index,{stayMinutes:Number(event.target.value)})}/></label><label>说明<input value={row.note} onChange={(event)=>updateSpotRow(index,{note:event.target.value})}/></label><button onClick={()=>setFormData((prev)=>({...prev,spots:prev.spots.filter((_,i)=>i!==index)}))}>移除</button></div>)}<button className="admin-route-add-spot" onClick={addSpotRow}>添加点位</button></div>{formError&&<div className="admin-spot-alert admin-spot-form-wide">{formError}</div>}</div><div className="admin-spot-modal-footer"><button className="admin-spot-secondary-button" onClick={()=>setIsFormOpen(false)}>取消</button><button className="admin-spot-primary-button" onClick={save}>保存</button></div></div></div>}
      {detailRoute&&<div className="admin-spot-modal-backdrop" onClick={()=>setDetailRoute(null)}><div className="admin-spot-modal admin-spot-detail-modal" onClick={(event)=>event.stopPropagation()}><div className="admin-spot-modal-header"><h2>路线详情</h2><button onClick={()=>setDetailRoute(null)}>×</button></div><div className="admin-spot-detail-body"><div className="admin-spot-detail-title"><h3>{detailRoute.name}</h3><span className={`admin-spot-status ${detailRoute.enabled?"enabled":"disabled"}`}>{detailRoute.enabled?"启用":"禁用"}</span></div><section className="admin-spot-detail-section"><h4>推荐理由</h4><p>{detailRoute.reason}</p></section><section className="admin-spot-detail-section"><h4>途经点位</h4><p>{detailRoute.spots.map((spot)=>`${spot.sortOrder}. ${spot.spotName} 停留${spot.stayMinutes}分钟 ${spot.note||""}`).join("\n")}</p></section></div></div></div>}
    </AdminLayout>
  );
}

export default AdminRoutePage;
