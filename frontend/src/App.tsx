import { useState, useEffect } from 'react';
import './index.css';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import ChatPage from './pages/ChatPage';
import MapPage from './pages/MapPage';
import ActivityPage from './pages/ActivityPage';
import ProfilePage from './pages/ProfilePage';
import BottomNav from './components/BottomNav';
import AchievementUnlockOverlay from './components/AchievementUnlockOverlay';
import RoutePage from './pages/RoutePage';
import type { UserSession } from './types';
import { SESSION_DISABLED_MESSAGE, SESSION_INVALID_EVENT, userApi } from './api';
import { DigitalHumanProvider } from './contexts/DigitalHumanContext';
import { ToastProvider, useToast } from './contexts/ToastContext';
import PointNarrationPanel from './components/PointNarrationPanel';

interface NavigateParams {
  page: string;
  spotType?: string;
  routeId?: number;
  spotId?: number;
  initialMessage?: string;
  navigationMode?: boolean;
}

function AppShell() {
  const toast = useToast();
  const [session, setSession] = useState<UserSession | null>(null);
  const [activeTab, setActiveTab] = useState('home');
  const [subPage, setSubPage] = useState<string | null>(null);
  const [navigateParams, setNavigateParams] = useState<NavigateParams | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let active = true;
    const invalidateSession = (event: Event) => {
      if (!active) return;
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      sessionStorage.removeItem('shanhai_session');
      setSession(null);
      setActiveTab('home');
      setSubPage(null);
      toast.error(detail?.message || SESSION_DISABLED_MESSAGE);
    };
    window.addEventListener(SESSION_INVALID_EVENT, invalidateSession);

    const savedSession = sessionStorage.getItem('shanhai_session');
    if (savedSession) {
      try {
        const cachedSession = JSON.parse(savedSession) as UserSession;
        setSession(cachedSession);
        userApi.getSession(cachedSession.sessionId)
          .then(response => {
            if (!active || !response.data.data) return;
            setSession(response.data.data);
            sessionStorage.setItem('shanhai_session', JSON.stringify(response.data.data));
          })
          .catch(() => {
            // 停用/失效由请求层统一处理；网络异常时保留缓存，避免空白页。
          })
          .finally(() => { if (active) setCheckingSession(false); });
      } catch {
        sessionStorage.removeItem('shanhai_session');
        setCheckingSession(false);
      }
    } else {
      setCheckingSession(false);
    }
    return () => {
      active = false;
      window.removeEventListener(SESSION_INVALID_EVENT, invalidateSession);
    };
  }, [toast]);

  const handleLogin = (userSession: UserSession) => {
    setSession(userSession);
    sessionStorage.setItem('shanhai_session', JSON.stringify(userSession));
    setActiveTab('home');
  };

  const handleLogout = () => {
    setSession(null);
    sessionStorage.removeItem('shanhai_session');
    setActiveTab('home');
    setSubPage(null);
  };

  const handleSessionUpdate = (updated: UserSession) => {
    setSession(updated);
    sessionStorage.setItem('shanhai_session', JSON.stringify(updated));
  };

  const handleNavigate = (params: NavigateParams) => {
    setNavigateParams(params);
    if (params.page === 'route') {
      setSubPage('route');
    } else {
      setSubPage(null);
      setActiveTab(params.page);
    }
  };

  const openAchievements = () => {
    sessionStorage.setItem('shanhai_profile_subpage', 'badges');
    setSubPage(null);
    setActiveTab('profile');
    window.setTimeout(() => window.dispatchEvent(new CustomEvent('shanhai:open-profile-subpage', { detail: { page: 'badges' } })), 0);
  };

  if (checkingSession) {
    return <div className="app-container mx-auto min-h-[100dvh] bg-[#F7F9FC]" />;
  }

  if (!session) {
    return (
      <div className="app-container mx-auto">
        <LoginPage onLogin={handleLogin} />
      </div>
    );
  }

  const renderPage = () => {
    if (subPage === 'route') {
      return <RoutePage session={session} onBack={() => setSubPage(null)} onNavigate={handleNavigate} />;
    }

    switch (activeTab) {
      case 'home':
        return <HomePage session={session} onNavigate={handleNavigate} />;
      case 'chat':
        return <ChatPage session={session} onBack={() => setActiveTab('home')} initialMessage={navigateParams?.initialMessage} onNavigate={handleNavigate} />;
      case 'map':
        return <MapPage key={`map-${navigateParams?.routeId || navigateParams?.spotId || navigateParams?.spotType || 'default'}-${navigateParams?.navigationMode ? 'nav' : 'view'}`} session={session} onBack={() => setActiveTab('home')} initialType={navigateParams?.spotType} routeId={navigateParams?.routeId} initialSpotId={navigateParams?.spotId} initialNavigationMode={navigateParams?.navigationMode} onNavigate={handleNavigate} />;
      case 'activity':
        return <ActivityPage session={session} onNavigate={handleNavigate} onBack={() => setActiveTab('home')} />;
      case 'profile':
        return <ProfilePage session={session} onLogout={handleLogout} onSessionUpdate={handleSessionUpdate} onNavigate={handleNavigate} onBack={() => {
          const backTo = sessionStorage.getItem('shanhai_profile_back_to');
          sessionStorage.removeItem('shanhai_profile_back_to');
          setActiveTab(backTo || 'home');
        }} />;
      default:
        return <HomePage session={session} onNavigate={handleNavigate} />;
    }
  };

  return (
    <DigitalHumanProvider session={session}>
      <div className="app-container mx-auto min-h-[100dvh] bg-[#F7F9FC]">
        {renderPage()}
        {!subPage && <BottomNav activeTab={activeTab} onTabChange={(tab) => { setSubPage(null); setActiveTab(tab); }} session={session} />}
        <AchievementUnlockOverlay onViewAchievements={openAchievements} />
        <PointNarrationPanel />
      </div>
    </DigitalHumanProvider>
  );
}

function App() {
  return (
    <ToastProvider>
      <AppShell />
    </ToastProvider>
  );
}

export default App;
