import { useEffect } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import Login from '@/pages/Login';
import AdminLayout from '@/pages/Layout';
import UserManagement from '@/pages/UserManagement';
import SpotManagement from '@/pages/SpotManagement';
import RouteManagement from '@/pages/RouteManagement';
import OperationsOverview from '@/pages/OperationsOverview';
import ActivityManagement from '@/pages/ActivityManagement';
import ContentApplicationManagement from '@/pages/ContentApplicationManagement';
import ReservationManagement from '@/pages/ReservationManagement';
import FeedbackManagement from '@/pages/FeedbackManagement';
import BadgeManagement from '@/pages/BadgeManagement';
import KnowledgeManagement from '@/pages/KnowledgeManagement';
import DigitalHumanManagement from '@/pages/DigitalHumanManagement';
import ErrorBoundary from '@/components/ErrorBoundary';

const isLoggedIn = () => {
  return localStorage.getItem('admin_token') !== null;
};

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const loggedIn = isLoggedIn();

  // 跨标签页认证同步：如果其他标签页清除了 token，当前标签页也同步跳转
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'admin_token' && !e.newValue) {
        localStorage.removeItem('admin_info');
        navigate('/login', { replace: true });
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [navigate]);

  // 当前未登录直接跳转
  if (!loggedIn) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route 
        path="/" 
        element={
          <PrivateRoute>
            <AdminLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" />} />
        <Route path="dashboard" element={
          <ErrorBoundary>
            <OperationsOverview />
          </ErrorBoundary>
        } />
        <Route path="users" element={
          <ErrorBoundary>
            <UserManagement />
          </ErrorBoundary>
        } />
        <Route path="spots" element={
          <ErrorBoundary>
            <SpotManagement />
          </ErrorBoundary>
        } />
        <Route path="routes" element={
          <ErrorBoundary>
            <RouteManagement />
          </ErrorBoundary>
        } />
        <Route path="knowledge" element={
          <ErrorBoundary>
            <KnowledgeManagement />
          </ErrorBoundary>
        } />
        <Route path="digital-human" element={
          <ErrorBoundary>
            <DigitalHumanManagement />
          </ErrorBoundary>
        } />
        <Route path="activities" element={
          <ErrorBoundary>
            <ActivityManagement />
          </ErrorBoundary>
        } />
        <Route path="applications" element={
          <ErrorBoundary>
            <ContentApplicationManagement />
          </ErrorBoundary>
        } />
        <Route path="reservations" element={
          <ErrorBoundary>
            <ReservationManagement />
          </ErrorBoundary>
        } />
        <Route path="feedback" element={
          <ErrorBoundary>
            <FeedbackManagement />
          </ErrorBoundary>
        } />
        <Route path="badges" element={
          <ErrorBoundary>
            <BadgeManagement />
          </ErrorBoundary>
        } />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
