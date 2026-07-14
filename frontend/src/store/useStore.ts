import { useState, useEffect, useCallback } from 'react';
import type { UserSession, UserMode } from '../types';
import { userApi } from '../api';

const SESSION_STORAGE_KEY = 'shanhai_session';

export function useSessionStore() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedSession = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        setSession(parsed);
      } catch {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
      }
    }
  }, []);

  const login = useCallback(async (userMode: UserMode) => {
    setLoading(true);
    try {
      const response = await userApi.login(userMode);
      if (response.data.code === 200 && response.data.data) {
        setSession(response.data.data);
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(response.data.data));
        return response.data.data;
      }
      throw new Error(response.data.message);
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setSession(null);
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  }, []);

  const updateSession = useCallback((newSession: UserSession) => {
    setSession(newSession);
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newSession));
  }, []);

  return {
    session,
    loading,
    login,
    logout,
    updateSession,
    isLoggedIn: !!session,
  };
}