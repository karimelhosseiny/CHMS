import { createContext, useContext, useMemo, useState } from 'react';
import { api, getToken, setToken } from '../api/client';

const AuthContext = createContext(null);

function decodeUserFromToken(token) {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return { email: payload.email, role: payload.role, studentId: payload.studentId };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => decodeUserFromToken(getToken()));

  const login = async (email, password) => {
    const { token } = await api.login({ email, password });
    setToken(token);
    setUser(decodeUserFromToken(token));
  };

  const register = async (payload) => {
    const { token } = await api.register(payload);
    setToken(token);
    setUser(decodeUserFromToken(token));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  const value = useMemo(() => ({ user, login, register, logout }), [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
