import React from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout/Layout';
import PublicLandingLayout from './layouts/PublicLandingLayout';
import IntroPage from './pages/landing/IntroPage';
import ExplorePage from './pages/landing/ExplorePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ChatPage from './pages/ChatPage';
import NotesPage from './pages/NotesPage';
import QuizPage from './pages/QuizPage';
import QuizTakePage from './pages/QuizTakePage';
import SearchPage from './pages/SearchPage';
import SettingsPage from './pages/SettingsPage';
import './index.css';

const RouterComponent =
  process.env.REACT_APP_USE_HASH_ROUTER === 'true' ? HashRouter : BrowserRouter;

const AppShellLoader = () => (
  <div className="app-shell-loader">
    <div className="app-shell-sidebar-skeleton" />
    <div className="app-shell-main-skeleton">
      <div className="app-shell-line long" />
      <div className="app-shell-line short" />
      <div className="app-shell-grid">
        <div className="app-shell-card" />
        <div className="app-shell-card" />
        <div className="app-shell-card" />
      </div>
    </div>
  </div>
);

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <AppShellLoader />;
  return user ? children : <Navigate to="/login" />;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <AppShellLoader />;
  return !user ? children : <Navigate to="/dashboard" />;
};

/** Unknown paths: signed-in users stay in the app; guests see the public intro. */
const NotFoundRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) return <AppShellLoader />;
  return <Navigate to={user ? '/dashboard' : '/'} replace />;
};

function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicLandingLayout />}>
        <Route path="/" element={<IntroPage />} />
        <Route path="/explore" element={<ExplorePage />} />
      </Route>
      <Route path="/login"    element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
      {/* Absolute paths so /dashboard, /chat, etc. always match (pathless parent + relative segments can miss in some setups). */}
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/chat/:id" element={<ChatPage />} />
        <Route path="/notes" element={<NotesPage />} />
        <Route path="/quiz" element={<QuizPage />} />
        <Route path="/quiz/:id" element={<QuizTakePage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<NotFoundRedirect />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <RouterComponent>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3500,
            style: { background: '#1a1a1a', color: '#ececec', border: '1px solid #2a2a2a', fontSize: '13px' }
          }}
        />
        <AppRoutes />
      </RouterComponent>
    </AuthProvider>
  );
}
