import { useEffect, useState } from "react";
import AdminDashboardPage from "./admin/AdminDashboardPage";
import AdminDigitalHumanPage from "./admin/AdminDigitalHumanPage";
import AdminKnowledgePage from "./admin/AdminKnowledgePage";
import AdminNoticePage from "./admin/AdminNoticePage";
import AdminRoutePage from "./admin/AdminRoutePage";
import AdminSpotPage from "./admin/AdminSpotPage";
import VisitorApp from "./mobile/VisitorApp";

function App() {
  const [hash, setHash] = useState(() => window.location.hash);

  useEffect(() => {
    const handleHashChange = () => {
      setHash(window.location.hash);
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  if (hash === "#/admin/dashboard") return <AdminDashboardPage />;
  if (hash === "#/admin/knowledge") return <AdminKnowledgePage />;
  if (hash === "#/admin/spots") return <AdminSpotPage />;
  if (hash === "#/admin/routes") return <AdminRoutePage />;
  if (hash === "#/admin/notices") return <AdminNoticePage />;
  if (hash === "#/admin/digital-human") return <AdminDigitalHumanPage />;

  return <VisitorApp />;
}

export default App;
