import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import './SettingsPage.css';

const TABS = [
  { id: 'profile', label: 'Profile', icon: '👤' },
  { id: 'appearance', label: 'Appearance', icon: '🎨' },
  { id: 'ai', label: 'AI Preferences', icon: '🧠' },
  { id: 'notifications', label: 'Notifications', icon: '🔔' },
  { id: 'account', label: 'Account', icon: '🔒' },
];

const ACCENT_SWATCHES = ['#10a37f', '#60a5fa', '#8b5cf6', '#f59e0b', '#ef4444'];

export default function SettingsPage() {
  const { user, logout, updateUserProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    avatar: user?.avatar || '',
    theme: localStorage.getItem('aurora-theme') || 'aurora',
    accent: localStorage.getItem('aurora-accent') || '#10a37f',
    responseStyle: localStorage.getItem('aurora-response-style') || 'detailed',
    difficulty: localStorage.getItem('aurora-difficulty') || 'medium',
    alerts: (localStorage.getItem('aurora-alerts') || 'true') === 'true',
  });

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      name: user?.name || '',
      email: user?.email || '',
      avatar: user?.avatar || '',
    }));
  }, [user]);

  const fireThemeUpdate = (theme, accent) => {
    window.dispatchEvent(new CustomEvent('aurora-theme-change', { detail: { theme, accent } }));
  };

  const saveProfile = () => {
    updateUserProfile({
      name: form.name.trim() || user?.name || '',
      email: form.email.trim() || user?.email || '',
      avatar: form.avatar || '',
    });
    toast.success('Profile preferences saved');
  };

  const onAvatarFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image should be 2MB or smaller');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) return;
      setField('avatar', result);
      updateUserProfile({ avatar: result });
      toast.success('Avatar updated');
    };
    reader.readAsDataURL(file);
  };

  const saveAppearance = () => {
    localStorage.setItem('aurora-theme', form.theme);
    localStorage.setItem('aurora-accent', form.accent);
    fireThemeUpdate(form.theme, form.accent);
    toast.success('Appearance updated smoothly');
  };

  const saveAiPrefs = () => {
    localStorage.setItem('aurora-response-style', form.responseStyle);
    localStorage.setItem('aurora-difficulty', form.difficulty);
    toast.success('AI preferences saved');
  };

  const saveNotifications = () => {
    localStorage.setItem('aurora-alerts', String(form.alerts));
    toast.success('Notification settings updated');
  };

  const currentTab = useMemo(() => TABS.find((tab) => tab.id === activeTab), [activeTab]);

  return (
    <div className="settings-page settings-page-enter">
      <header className="settings-header">
        <h1>Settings</h1>
        <p>Customize your learning workspace, AI behavior, and account controls.</p>
      </header>

      <div className="settings-tabs-wrap card glass-card">
        <div className="settings-tabs" role="tablist" aria-label="Settings sections">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <section className="settings-panel card glass-card" role="tabpanel" aria-label={currentTab?.label}>
        {activeTab === 'profile' && (
          <div className="settings-grid">
            <label className="settings-field">
              <span>Name</span>
              <input className="input" value={form.name} onChange={(e) => setField('name', e.target.value)} />
            </label>
            <label className="settings-field">
              <span>Email</span>
              <input className="input" value={form.email} onChange={(e) => setField('email', e.target.value)} />
            </label>
            <label className="settings-field settings-field-full">
              <span>Avatar image</span>
              <div className="avatar-upload-row">
                <div className="avatar-preview">
                  {form.avatar ? (
                    <img src={form.avatar} alt="Avatar preview" />
                  ) : (
                    <span>{(form.name || user?.name || 'U').charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <label className="btn btn-secondary avatar-upload-btn">
                  Upload image
                  <input type="file" accept="image/*" onChange={onAvatarFileChange} />
                </label>
                {form.avatar && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setField('avatar', '');
                      updateUserProfile({ avatar: '' });
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </label>
            <div className="settings-actions settings-field-full">
              <button type="button" className="btn btn-primary" onClick={saveProfile}>Save Profile</button>
            </div>
          </div>
        )}

        {activeTab === 'appearance' && (
          <div className="settings-grid">
            <label className="settings-field">
              <span>Theme</span>
              <select
                className="input"
                value={form.theme}
                onChange={(e) => {
                  const nextTheme = e.target.value;
                  setField('theme', nextTheme);
                  fireThemeUpdate(nextTheme, form.accent);
                }}
              >
                <option value="aurora">Aurora</option>
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </label>
            <label className="settings-field">
              <span>Accent color</span>
              <input
                className="input settings-color-input"
                type="color"
                value={form.accent}
                onChange={(e) => {
                  const nextAccent = e.target.value;
                  setField('accent', nextAccent);
                  fireThemeUpdate(form.theme, nextAccent);
                }}
              />
            </label>
            <div className="settings-field settings-field-full">
              <span>Quick accents</span>
              <div className="accent-swatches">
                {ACCENT_SWATCHES.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`accent-swatch ${form.accent === color ? 'active' : ''}`}
                    style={{ background: color }}
                    onClick={() => {
                      setField('accent', color);
                      fireThemeUpdate(form.theme, color);
                    }}
                    aria-label={`Set accent ${color}`}
                  />
                ))}
              </div>
            </div>
            <div className="settings-actions settings-field-full">
              <button type="button" className="btn btn-primary" onClick={saveAppearance}>Save Appearance</button>
            </div>
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="settings-grid">
            <label className="settings-field">
              <span>Response style</span>
              <select className="input" value={form.responseStyle} onChange={(e) => setField('responseStyle', e.target.value)}>
                <option value="short">Short</option>
                <option value="detailed">Detailed</option>
              </select>
            </label>
            <label className="settings-field">
              <span>Difficulty level</span>
              <select className="input" value={form.difficulty} onChange={(e) => setField('difficulty', e.target.value)}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </label>
            <div className="settings-actions settings-field-full">
              <button type="button" className="btn btn-primary" onClick={saveAiPrefs}>Save AI Preferences</button>
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="settings-grid">
            <label className="settings-toggle settings-field-full">
              <span>Enable study alerts and reminders</span>
              <button
                type="button"
                className={`toggle-btn ${form.alerts ? 'on' : ''}`}
                onClick={() => setField('alerts', !form.alerts)}
                aria-pressed={form.alerts}
              >
                <i />
              </button>
            </label>
            <div className="settings-actions settings-field-full">
              <button type="button" className="btn btn-primary" onClick={saveNotifications}>Save Notifications</button>
            </div>
          </div>
        )}

        {activeTab === 'account' && (
          <div className="settings-grid">
            <div className="settings-field settings-field-full">
              <span>Account security</span>
              <div className="account-actions">
                <button type="button" className="btn btn-secondary" onClick={() => toast('Password flow can be connected to backend auth')}>
                  Change Password
                </button>
                <button type="button" className="btn btn-danger" onClick={logout}>Logout</button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
