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
      const res = await api.get('/auth/me');
      if (res?.data?.user) {
        setUser(res.data.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

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
