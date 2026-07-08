import type { ReactNode } from "react";
import "./AdminLayout.css";

export type AdminMenuKey = "dashboard" | "knowledge" | "spots" | "routes" | "notices" | "digital-human";

type AdminLayoutProps = {
  activeMenu: AdminMenuKey;
  children: ReactNode;
};

const menuItems: Array<{ key: AdminMenuKey; label: string; hash: string }> = [
  { key: "dashboard", label: "数据大屏", hash: "/admin/dashboard" },
  { key: "knowledge", label: "知识库管理", hash: "/admin/knowledge" },
  { key: "spots", label: "点位管理", hash: "/admin/spots" },
  { key: "routes", label: "路线管理", hash: "/admin/routes" },
  { key: "notices", label: "活动公告", hash: "/admin/notices" },
  { key: "digital-human", label: "2D 数字人", hash: "/admin/digital-human" },
];

function AdminLayout({ activeMenu, children }: AdminLayoutProps) {
  return (
    <div className="admin-layout-page">
      <aside className="admin-layout-sidebar">
        <div className="admin-layout-brand">山海小导管理后台</div>
        <nav className="admin-layout-menu">
          {menuItems.map((item) => (
            <button
              key={item.key}
              className={`admin-layout-menu-item ${activeMenu === item.key ? "active" : ""}`}
              onClick={() => { window.location.hash = item.hash; }}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>
      <main className="admin-layout-main">{children}</main>
    </div>
  );
}

export default AdminLayout;
