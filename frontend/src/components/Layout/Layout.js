import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { POST_AUTH_WORKSPACE_BOOT_KEY } from '../../constants/workspaceSession';
import WorkspaceEntryOverlay from '../../pages/landing/WorkspaceEntryOverlay';
import { playWorkspaceEntrySound } from '../../pages/landing/playWorkspaceEntrySound';
import { claimFreeXpBonus, getGameProgress, getLevelFromXp, getXpPerLevel, getXpWithinLevel, onGameProgressChange } from '../../utils/gameProgress';
import {
  IconChat,
  IconDashboard,
  IconNotes,
  IconQuiz,
  IconSearch,
  IconSettings,
} from './SidebarNavIcons';
import './Layout.css';

const navItems = [
  { to: '/dashboard', Icon: IconDashboard, label: 'Dashboard' },
  { to: '/chat', Icon: IconChat, label: 'AI Chat' },
  { to: '/notes', Icon: IconNotes, label: 'Notes' },
  { to: '/quiz', Icon: IconQuiz, label: 'Quizzes' },
  { to: '/search', Icon: IconSearch, label: 'Search' },
  { to: '/settings', Icon: IconSettings, label: 'Settings' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [themeMode, setThemeMode] = useState(() => localStorage.getItem('aurora-theme') || 'aurora');
  const [accentColor, setAccentColor] = useState(() => localStorage.getItem('aurora-accent') || '#10a37f');
  const [isNavigating, setIsNavigating] = useState(false);
  const [pressedNav, setPressedNav] = useState('');
  const [gameMenuOpen, setGameMenuOpen] = useState(false);
  const [gameProgress, setGameProgress] = useState(() => getGameProgress());
  const [nowTick, setNowTick] = useState(Date.now());
  const [recentChats, setRecentChats] = useState([]);
  const [recentLoading, setRecentLoading] = useState(true);
  /** After first load, refetch on route change without flashing “Loading chats…” */
  const recentsHydratedRef = useRef(false);
  const level = getLevelFromXp(gameProgress.xp);
  const xp = getXpWithinLevel(gameProgress.xp);
  const xpMax = getXpPerLevel();
  const xpPct = Math.round((xp / xpMax) * 100);
  const xpToNextLevel = Math.max(0, xpMax - xp);
  const freeXpRemainingMs = Math.max(0, (gameProgress.nextFreeXpAt || 0) - nowTick);
  const freeXpAvailable = freeXpRemainingMs <= 0;

  const [postAuthBoot, setPostAuthBoot] = useState(false);
  const postAuthSoundRef = useRef(false);

  useLayoutEffect(() => {
    try {
      if (sessionStorage.getItem(POST_AUTH_WORKSPACE_BOOT_KEY) === '1') {
        setPostAuthBoot(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!postAuthBoot) {
      postAuthSoundRef.current = false;
      return;
    }
    if (postAuthSoundRef.current) return;
    postAuthSoundRef.current = true;
    playWorkspaceEntrySound();
  }, [postAuthBoot]);

  const finishPostAuthBoot = useCallback(() => {
    try {
      sessionStorage.setItem('aurora-workspace-entry', '1');
      sessionStorage.removeItem(POST_AUTH_WORKSPACE_BOOT_KEY);
    } catch {
      /* ignore */
    }
    setPostAuthBoot(false);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };
  const currentSection = useMemo(() => `/${location.pathname.split('/')[1] || 'dashboard'}`, [location.pathname]);
  const isChatRoute =
    location.pathname === '/chat' || location.pathname.startsWith('/chat/');

  /** Stable shell while switching /chat ↔ /chat/:id so ChatPage isn’t remounted (no empty “new chat” flash). */
  const routeShellKey = useMemo(() => {
    const p = location.pathname;
    if (p === '/chat' || p.startsWith('/chat/')) return '__shell_chat';
    return p;
  }, [location.pathname]);

  useEffect(() => {
    setIsNavigating(false);
    setProfileOpen(false);
    setGameMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (collapsed) {
      setProfileOpen(false);
      setGameMenuOpen(false);
    }
  }, [collapsed]);

  useEffect(() => {
    setGameProgress(getGameProgress());
    return onGameProgressChange(setGameProgress);
  }, []);

  useEffect(() => {
    let mounted = true;
    if (!recentsHydratedRef.current) {
      setRecentLoading(true);
    }
    axios
      .get('/chat')
      .then((res) => {
        if (!mounted) return;
        const chats = Array.isArray(res.data?.chats) ? res.data.chats : [];
        setRecentChats(chats.slice(0, 8));
      })
      .catch(() => {
        if (mounted) setRecentChats([]);
      })
      .finally(() => {
        recentsHydratedRef.current = true;
        if (mounted) setRecentLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [location.pathname]);

  useEffect(() => {
    if (!gameMenuOpen) return undefined;
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [gameMenuOpen]);

  useEffect(() => {
    const themeClasses = ['theme-aurora', 'theme-dark', 'theme-light'];
    document.body.classList.remove(...themeClasses);
    document.body.classList.add(`theme-${themeMode}`);
    localStorage.setItem('aurora-theme', themeMode);
  }, [themeMode]);

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', accentColor);
    localStorage.setItem('aurora-accent', accentColor);
  }, [accentColor]);

  useEffect(() => {
    const onThemeChange = (event) => {
      if (event.detail?.theme) setThemeMode(event.detail.theme);
      if (event.detail?.accent) setAccentColor(event.detail.accent);
    };
    window.addEventListener('aurora-theme-change', onThemeChange);
    return () => window.removeEventListener('aurora-theme-change', onThemeChange);
  }, []);

  const cycleTheme = () => {
    setThemeMode((current) => {
      if (current === 'aurora') return 'dark';
      if (current === 'dark') return 'light';
      return 'aurora';
    });
  };

  const mobileTitle = useMemo(() => {
    const item = navItems.find((n) => location.pathname.startsWith(n.to));
    return item ? item.label : 'Aurora AI';
  }, [location.pathname]);

  const handleNavClick = (to) => {
    setMobileMenuOpen(false);
    // Prevent re-navigating to the exact same route; it can leave transition state stuck.
    if (to === location.pathname) return;
    // Keep section-level nav behavior (Dashboard, Chat, Notes, etc.) unchanged.
    if (to === currentSection) return;
    setPressedNav(to);
    setIsNavigating(true);
    setTimeout(() => {
      navigate(to);
      setPressedNav('');
    }, 140);
  };

  const formatRemaining = (remainingMs) => {
    const totalSeconds = Math.ceil(remainingMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const onClaimFreeXp = () => {
    const result = claimFreeXpBonus(15, 'Claimed sidebar free XP');
    if (!result.success) {
      toast('Free XP available after 15 minutes');
      return;
    }
    if (result.leveledUp) {
      toast.success(`+15 XP • Level ${result.levelAfter} reached`);
    } else {
      toast.success('+15 XP claimed');
    }
  };

  const onStartNewChat = () => {
    setMobileMenuOpen(false);
    setPressedNav('/chat');
    navigate('/chat', { state: { newChat: true } });
    setTimeout(() => setPressedNav(''), 140);
  };

  if (postAuthBoot) {
    return (
      <div className="layout-post-auth-boot" aria-busy="true">
        <WorkspaceEntryOverlay open={postAuthBoot} onFinished={finishPostAuthBoot} />
      </div>
    );
  }

  return (
    <div className={`layout${collapsed ? ' collapsed' : ''}${isChatRoute ? ' layout--chat-route' : ''}${mobileMenuOpen ? ' mobile-menu-open' : ''}`}>
      {mobileMenuOpen && (
        <div
          className="mobile-sidebar-backdrop"
          onClick={() => setMobileMenuOpen(false)}
          role="presentation"
        />
      )}
      {profileOpen && <button type="button" className="profile-backdrop" aria-label="Close profile panel" onClick={() => setProfileOpen(false)} />}
      
      {/* Mobile Top Header */}
      <header className="mobile-header">
        <button
          type="button"
          className="mobile-menu-toggle"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Open menu"
        >
          ☰
        </button>
        <span className="mobile-header-title">{mobileTitle}</span>
        <button
          type="button"
          className="mobile-new-chat-btn"
          onClick={onStartNewChat}
          aria-label="New chat"
        >
          ＋
        </button>
      </header>

      <aside className="sidebar">
        <button
          type="button"
          className="sidebar-toggle-btn"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? '›' : '‹'}
        </button>
        <div className="sidebar-top">
          <div className="brand" title={collapsed ? 'Aurora AI — Smart Study' : undefined}>
            <img src="/aurora-brand-template.png" alt="Aurora AI logo" className="brand-icon brand-logo-img" />
            <span className="brand-name">Aurora AI</span>
          </div>

          <div className={`profile-stats ${gameMenuOpen ? 'open' : ''}`}>
            <button
              type="button"
              className={`level-trigger ${gameMenuOpen ? 'open' : ''}`}
              onClick={() => setGameMenuOpen((v) => !v)}
              aria-expanded={gameMenuOpen}
            >
              <div className="profile-top">
                <span>Level {level}</span>
                <span>{xp}/{xpMax} XP</span>
              </div>
              <div className="xp-track">
                <span className="xp-fill" style={{ width: `${xpPct}%` }} />
              </div>
            </button>
            <div className={`game-menu ${gameMenuOpen ? 'open' : ''}`} aria-hidden={!gameMenuOpen}>
              <div className="game-menu-row">
                <span>Total XP</span>
                <strong>{gameProgress.xp}</strong>
              </div>
              <div className="game-menu-row">
                <span>Actions completed</span>
                <strong>{gameProgress.totalActions}</strong>
              </div>
              <div className="game-menu-row">
                <span>Next level in</span>
                <strong>{xpToNextLevel} XP</strong>
              </div>
              <div className="game-menu-last">Last: {gameProgress.lastAction}</div>
              {!freeXpAvailable && (
                <div className="game-menu-cooldown">Free XP in {formatRemaining(freeXpRemainingMs)}</div>
              )}
              <button
                type="button"
                className="game-menu-btn ghost"
                onClick={onClaimFreeXp}
                disabled={!freeXpAvailable}
              >
                {freeXpAvailable ? 'Claim +15 XP' : 'Free XP locked'}
              </button>
            </div>
          </div>
          <nav className="nav">
            {navItems.map((item) => {
              const NavIcon = item.Icon;
              return (
                <button
                  key={item.to}
                  type="button"
                  className={`nav-item ${currentSection === item.to ? 'active' : ''} ${pressedNav === item.to ? 'pressed' : ''}`}
                  onClick={() => handleNavClick(item.to)}
                  aria-label={item.label}
                  title={collapsed ? item.label : undefined}
                >
                  <span className="nav-icon" aria-hidden>
                    <NavIcon />
                  </span>
                  <span className="nav-label">{item.label}</span>
                </button>
              );
            })}
          </nav>
          <div className="recent-chats-section">
            {currentSection === '/chat' && (
              <button
                type="button"
                className="sidebar-new-chat-btn"
                onClick={onStartNewChat}
                aria-label="Start new chat"
              >
                + New Chat
              </button>
            )}
            <div className="recent-chats-header">Recents</div>
            <div className="recent-chats-list">
              {recentLoading && <div className="recent-chat-empty">Loading chats...</div>}
              {!recentLoading && recentChats.length === 0 && <div className="recent-chat-empty">No recent chats yet</div>}
              {!recentLoading && recentChats.map((chat) => (
                <button
                  key={chat.id}
                  type="button"
                  className={`recent-chat-item ${location.pathname === `/chat/${chat.id}` ? 'active' : ''}`}
                  onClick={() => handleNavClick(`/chat/${chat.id}`)}
                  title={chat.title || 'Untitled chat'}
                >
                  {chat.title || 'Untitled chat'}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="sidebar-bottom">
          <button
            type="button"
            className={`user-info profile-trigger ${profileOpen ? 'open' : ''}`}
            onClick={() => !collapsed && setProfileOpen(v => !v)}
            aria-expanded={profileOpen}
            aria-hidden={collapsed}
            tabIndex={collapsed ? -1 : 0}
          >
            <div className="user-avatar">
              {user?.avatar ? (
                <img src={user.avatar} alt="User avatar" className="user-avatar-img" />
              ) : (
                user?.name?.[0]?.toUpperCase()
              )}
            </div>
            <div className="user-details">
              <div className="user-name">{user?.name}</div>
              <div className="user-email">{user?.email}</div>
            </div>
          </button>

          <div className={`profile-panel ${profileOpen ? 'open' : ''}`} aria-hidden={!profileOpen || collapsed}>
            <div className="profile-panel-head">
              <div className="profile-panel-name">{user?.name}</div>
              <div className="profile-panel-email">{user?.email}</div>
            </div>
            <div className="profile-panel-items">
              <button type="button" className="profile-item" onClick={() => navigate('/settings')}>⚙ Settings</button>
              <button
                type="button"
                className="profile-item"
                onClick={cycleTheme}
              >
                🎨 Theme: {themeMode.charAt(0).toUpperCase() + themeMode.slice(1)}
              </button>
              <button type="button" className="profile-item danger" onClick={handleLogout}>⇥ Logout</button>
            </div>
          </div>

          {collapsed && (
            <button
              type="button"
              className="logout-btn logout-btn-icon-only"
              onClick={handleLogout}
              title="Log out"
              aria-label="Log out"
            >
              <span aria-hidden>⇥</span>
            </button>
          )}
        </div>
      </aside>
      <main className={`main-content${isChatRoute ? ' main-content--chat' : ''}`}>
        <div key={routeShellKey} className={`route-shell ${isNavigating ? 'route-exit' : 'route-enter'}`}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
