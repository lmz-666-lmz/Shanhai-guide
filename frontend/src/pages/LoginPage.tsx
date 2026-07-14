import { useState, useEffect } from 'react';
// antd-mobile import removed (Toast migrated to ToastContext)

import type { UserMode, UserSession } from '../types';
import { authApi, userApi } from '../api';
import XiaohaiAvatar from '../components/XiaohaiAvatar';
import { useToast } from '../contexts/ToastContext';

const modeConfig: { mode: Exclude<UserMode, 'guest'>; icon: React.ReactNode; title: string; desc: string; }[] = [
  { mode: 'alumni', icon: <path d="M22 10v6M2 10l10-5 10 5-10 5zM6 12v5c0 1.1 2.7 2 6 2s6-.9 6-2v-5"/>, title: '校友', desc: '欢迎回家' },
  { mode: 'fresh', icon: <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>, title: '新生', desc: '初次见面' },
  { mode: 'parent', icon: <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>, title: '家长', desc: '校园参观' },
  { mode: 'research', icon: <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10A15.3 15.3 0 0 1 8 12 15.3 15.3 0 0 1 12 2zM2 12h20"/>, title: '访客', desc: '研学交流' },
  { mode: 'senior', icon: <path d="M4 2v20h16V2H4zm14 18H6V4h12v16zM8 6h8v2H8V6zm0 4h8v2H8v-2zm0 4h8v2H8v-2z"/>, title: '长者', desc: '轻松慢游' },
];

export default function LoginPage({ onLogin }: { onLogin: (session: any) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [registerUserMode, setRegisterUserMode] = useState<Exclude<UserMode, 'guest'>>('fresh');
  const [isRegister, setIsRegister] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  const toast = useToast();

  const getCurrentSessionId = (): string | undefined => {
    try {
      const saved = sessionStorage.getItem('shanhai_session');
      if (saved) {
        const session = JSON.parse(saved) as UserSession;
        return session.sessionId || undefined;
      }
    } catch { /* ignore */ }
    return undefined;
  };

  const handleAccountLogin = async () => {
    if (!username || !password) { toast.show('请输入用户名和密码'); return; }
    setAuthLoading(true);
    try {
      const currentSessionId = getCurrentSessionId();
      const response = await authApi.login(username, password, currentSessionId);
      if (response.data.code === 200 && response.data.data) onLogin(response.data.data.session);
      else toast.show(response.data.message || '登录失败');
    } catch (error: any) {
      toast.show(error?.message || '登录失败，请稍后重试');
    } finally { setAuthLoading(false); }
  };

  const handleRegister = async () => {
    if (!username || !password || !nickname) { toast.show('请填写完整信息'); return; }
    if (password.length < 6) { toast.show('密码长度不能少于6位'); return; }
    setAuthLoading(true);
    try {
      const currentSessionId = getCurrentSessionId();
      const response = await authApi.register(username, password, nickname, registerUserMode, currentSessionId);
      if (response.data.code === 200 && response.data.data) {
        // 注册成功后直接登录（使用后端返回的 session）
        toast.success('注册成功');
        onLogin(response.data.data.session);
      }
      else toast.show(response.data.message || '注册失败');
    } catch (error: any) { toast.show(error?.message || '注册失败，请稍后重试'); }
    finally { setAuthLoading(false); }
  };

  const handleGuestEntry = async (mode: UserMode) => {
    setAuthLoading(true);
    try {
      const response = await userApi.login(mode);
      if (response.data.code === 200 && response.data.data) onLogin(response.data.data);
      else toast.error('进入失败，请检查后端服务');
    } catch { toast.error('连接后端失败，请确保后端已启动'); }
    finally { setAuthLoading(false); }
  };

  return (
    <div className="min-h-[100dvh] w-full bg-gradient-to-br from-[#F7F9FC] via-white to-blue-50 flex justify-center items-center relative overflow-hidden">
      <style>{`
        @keyframes loginFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes loginGlow { 0%,100% { box-shadow: 0 0 20px rgba(59,130,246,.15); } 50% { box-shadow: 0 0 40px rgba(59,130,246,.35); } }
        .login-float { animation: loginFloat 3s ease-in-out infinite; }
        .login-glow { animation: loginGlow 2.5s ease-in-out infinite; }
      `}</style>

      <div className="absolute top-[-15%] left-[-10%] w-[35rem] h-[35rem] bg-blue-100/60 rounded-full blur-[100px]"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[30rem] h-[30rem] bg-indigo-50/60 rounded-full blur-[100px]"></div>

      <div className="w-full max-w-[420px] relative z-10 flex flex-col items-center px-6">
        {/* Logo */}
        <div className={`mb-6 transition-all duration-1000 ${mounted ? 'translate-y-0 opacity-100' : '-translate-y-8 opacity-0'}`}>
          <div className="login-glow rounded-full">
            <div className="login-float">
              <XiaohaiAvatar size={72} status="idle" />
            </div>
          </div>
        </div>
        <h1 className={`text-2xl font-extrabold text-slate-800 mb-1 tracking-wide transition-all duration-700 delay-100 ${mounted ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'}`}>山海小导</h1>
        <p className={`text-xs text-slate-400 font-medium tracking-[0.2em] uppercase mb-8 transition-all duration-700 delay-200 ${mounted ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'}`}>AI 数字人全景导览</p>

        {/* Form */}
        <div className={`w-full transition-all duration-700 delay-200 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}`}>
          <div className="bg-white/80 backdrop-blur-2xl rounded-3xl p-6 shadow-[0_8px_40px_rgba(26,92,138,0.1)] border border-white">
            <h2 className="text-lg font-bold text-slate-800 mb-5 text-center">{isRegister ? '加入山海大学' : '登录校园账号'}</h2>
            <div className="flex flex-col gap-3">
              <input className="w-full bg-slate-50 border border-slate-200 text-slate-700 placeholder:text-slate-400 rounded-2xl px-4 py-3.5 focus:outline-none focus:border-primary-blue focus:ring-4 focus:ring-blue-500/10 transition-all text-sm" placeholder="学号 / 教工号 / 用户名" value={username} onChange={e => setUsername(e.target.value)} />
              {isRegister && <input className="w-full bg-slate-50 border border-slate-200 text-slate-700 placeholder:text-slate-400 rounded-2xl px-4 py-3.5 focus:outline-none focus:border-primary-blue focus:ring-4 focus:ring-blue-500/10 transition-all text-sm" placeholder="真实姓名 / 昵称" value={nickname} onChange={e => setNickname(e.target.value)} />}
              <input className="w-full bg-slate-50 border border-slate-200 text-slate-700 placeholder:text-slate-400 rounded-2xl px-4 py-3.5 focus:outline-none focus:border-primary-blue focus:ring-4 focus:ring-blue-500/10 transition-all text-sm" type="password" placeholder={isRegister ? '设置密码 (至少6位)' : '输入密码'} value={password} onChange={e => setPassword(e.target.value)} />

              {isRegister && (
                <div className="mt-1">
                  <p className="text-[11px] font-bold text-slate-500 mb-2 px-1">选择专属身份</p>
                  <div className="grid grid-cols-2 gap-2">
                    {modeConfig.map(({ mode, icon, title }) => {
                      const active = registerUserMode === mode;
                      return (
                        <div key={mode} onClick={() => setRegisterUserMode(mode)}
                          className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${active ? 'bg-blue-50 border-primary-blue text-primary-blue shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">{icon}</svg>
                          <span className="text-xs font-bold">{title}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <button className="w-full bg-primary-blue hover:bg-blue-700 text-white font-bold rounded-2xl py-3.5 mt-2 shadow-[0_4px_12px_rgba(26,92,138,0.25)] active:scale-[0.98] transition-all disabled:opacity-70 flex justify-center items-center gap-2" onClick={isRegister ? handleRegister : handleAccountLogin} disabled={authLoading}>
                {authLoading ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin"></div> : (isRegister ? '立即注册' : '进入校园')}
              </button>
            </div>

            <div className="mt-5 text-center">
              <p className="text-[13px] text-slate-500">
                {isRegister ? '已有账号？' : '首次访问？'}
                <button className="ml-2 text-primary-blue hover:text-blue-600 font-bold transition-colors" onClick={() => { setIsRegister(!isRegister); setUsername(''); setPassword(''); setNickname(''); }}>
                  {isRegister ? '直接登录' : '注册体验账号'}
                </button>
              </p>
            </div>
          </div>
        </div>

        {/* Guest */}
        <div className={`w-full mt-6 transition-all duration-700 delay-300 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px flex-1 bg-slate-200"></div>
            <span className="text-[10px] font-bold tracking-widest uppercase text-slate-400">免注册快速体验</span>
            <div className="h-px flex-1 bg-slate-200"></div>
          </div>
          <button className="w-full flex items-center justify-between gap-3 p-4 bg-white/60 hover:bg-white backdrop-blur-md rounded-2xl border border-slate-200 shadow-sm hover:shadow-md active:scale-[0.99] transition-all disabled:opacity-50" onClick={() => handleGuestEntry('guest')} disabled={authLoading}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center shadow-sm text-slate-400">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </div>
              <div className="text-left"><span className="text-sm text-slate-700 font-bold">普通游客</span><span className="block text-[11px] text-slate-400">仅浏览模式，无法互动</span></div>
            </div>
            <svg className="w-4 h-4 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>

        <p className="mt-8 text-[10px] text-slate-400 font-bold tracking-wide">山海大学 © 2024</p>
      </div>
    </div>
  );
}
