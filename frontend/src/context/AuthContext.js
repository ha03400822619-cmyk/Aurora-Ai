import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

function apiBaseUrl() {
  const root = (process.env.REACT_APP_API_URL || '').trim().replace(/\/$/, '');
  if (!root) return '/api';
  return `${root}/api`;
}

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const getStoredProfileOverrides = () => {
    try {
      return JSON.parse(localStorage.getItem('aurora-profile') || '{}');
    } catch {
      return {};
    }
  };

  const mergeUserWithOverrides = (baseUser) => {
    if (!baseUser) return baseUser;
    return { ...baseUser, ...getStoredProfileOverrides() };
  };

  axios.defaults.baseURL = apiBaseUrl();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      axios.get('/auth/me')
        .then(res => setUser(mergeUserWithOverrides(res.data.user)))
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await axios.post('/auth/login', { email, password });
    const { token, user } = res.data;
    localStorage.setItem('token', token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(mergeUserWithOverrides(user));
    return user;
  };

  const register = async (name, email, password) => {
    const res = await axios.post('/auth/register', { name, email, password });
    const { token, user } = res.data;
    localStorage.setItem('token', token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(mergeUserWithOverrides(user));
    return user;
  };

  const updateUserProfile = (updates) => {
    setUser((prev) => {
      const next = { ...(prev || {}), ...updates };
      const storable = {};
      if (Object.prototype.hasOwnProperty.call(next, 'name')) storable.name = next.name;
      if (Object.prototype.hasOwnProperty.call(next, 'email')) storable.email = next.email;
      if (Object.prototype.hasOwnProperty.call(next, 'avatar')) storable.avatar = next.avatar;
      localStorage.setItem('aurora-profile', JSON.stringify(storable));
      return next;
    });
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUserProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
