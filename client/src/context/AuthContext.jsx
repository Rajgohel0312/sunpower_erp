/**
 * Authentication & RBAC React Context
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, setAccessToken } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const checkAuth = useCallback(async () => {
    try {
      // 1. First attempt to load profile via /auth/me
      const res = await api.get('/auth/me');
      if (res?.data?.accessToken) {
        setAccessToken(res.data.accessToken);
      }
      if (res?.data?.user) {
        setUser(res.data.user);
        return;
      }
    } catch (err) {
      // 2. If /auth/me fails (e.g. 401 on expired access token during reload),
      // seamlessly attempt silent refresh using the 7-day HttpOnly refresh token cookie!
      try {
        const refreshRes = await api.post('/auth/refresh', {});
        if (refreshRes?.data?.accessToken) {
          setAccessToken(refreshRes.data.accessToken);
        }
        if (refreshRes?.data?.user) {
          setUser(refreshRes.data.user);
          return;
        } else {
          // Fallback if user profile wasn't in refresh response
          const retryRes = await api.get('/auth/me');
          if (retryRes?.data?.user) {
            setUser(retryRes.data.user);
            return;
          }
        }
      } catch (refreshErr) {
        setUser(null);
        setAccessToken(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Listen for terminal session expiration from the API client
  useEffect(() => {
    const handleAuthExpired = () => {
      setUser(null);
      setAccessToken(null);
    };
    window.addEventListener('sunpower:auth:expired', handleAuthExpired);
    return () => window.removeEventListener('sunpower:auth:expired', handleAuthExpired);
  }, []);

  // Heartbeat: silently refresh access token every 10 minutes while active in browser
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(async () => {
      try {
        const res = await api.post('/auth/refresh', {});
        if (res?.data?.accessToken) {
          setAccessToken(res.data.accessToken);
        }
        if (res?.data?.user) {
          setUser(res.data.user);
        }
      } catch (err) {
        // If background refresh fails, request-level 401 interceptor will handle next action
      }
    }, 10 * 60 * 1000); // 10 minutes

    return () => clearInterval(interval);
  }, [user]);

  const login = async (email, password) => {
    setError(null);
    try {
      const res = await api.post('/auth/login', { email, password });
      if (res?.data) {
        if (res.data.accessToken) {
          setAccessToken(res.data.accessToken);
        }
        setUser(res.data.user);
        return res.data;
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please check credentials.');
      throw err;
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout', {});
    } catch (err) {
      // Ignore logout errors
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  };

  const hasPermission = (permission) => {
    if (!user) return false;
    if (user.roles?.includes('SUPER_ADMIN')) return true;
    return user.permissions?.includes(permission) || false;
  };

  const hasRole = (role) => {
    if (!user) return false;
    if (user.roles?.includes('SUPER_ADMIN')) return true;
    return user.roles?.includes(role) || false;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        login,
        logout,
        checkAuth,
        hasPermission,
        hasRole,
        isAuthenticated: !!user
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
