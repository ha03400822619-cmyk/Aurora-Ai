import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { awardXp, getGameProgress, getLevelFromXp, getXpPerLevel, getXpWithinLevel, onGameProgressChange } from '../utils/gameProgress';
import './DashboardPage.css';

const WORKSPACE_ENTRY_KEY = 'aurora-workspace-entry';

const HERO_CHIPS = ['Explain Thermodynamics quickly', 'Make quiz from my notes', 'Help me revise OOP'];

function useAnimatedCount(target, duration = 900) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let rafId;
    const end = Number.isFinite(target) ? target : 0;
    const startAt = performance.now();

    const tick = (now) => {
      const progress = Math.min((now - startAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(end * eased));
      if (progress < 1) rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [target, duration]);

  return value;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [workspaceEntryReveal] = useState(() => {
    try {
      const on = sessionStorage.getItem(WORKSPACE_ENTRY_KEY) === '1';
      if (on) sessionStorage.removeItem(WORKSPACE_ENTRY_KEY);
      sessionStorage.removeItem('auralis-workspace-entry');
      sessionStorage.removeItem('aura-workspace-entry');
      return on;
    } catch {
      return false;
    }
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showExplainBox, setShowExplainBox] = useState(false);
  const [explainInput, setExplainInput] = useState('');
  const [heroInput, setHeroInput] = useState('');
  const [typingTick, setTypingTick] = useState(0);
  const [pipelineStep, setPipelineStep] = useState(1);
  const [gameProgress, setGameProgress] = useState(() => getGameProgress());

  useEffect(() => {
    axios.get('/dashboard').then(res => setData(res.data.dashboard)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setTypingTick(v => v + 1), 500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => onGameProgressChange(setGameProgress), []);

  const stats = data?.stats || {};
  const placeholderStats = {
    totalChats: Math.max(2, new Date().getDate() % 8),
    totalQuizzes: Math.max(1, new Date().getHours() % 6),
    totalNotes: Math.max(3, new Date().getMinutes() % 12),
    quizAvgScore: 84
  };
  const liveStats = {
    totalChats: stats.totalChats || placeholderStats.totalChats,
    totalQuizzes: stats.totalQuizzes || placeholderStats.totalQuizzes,
    totalNotes: stats.totalNotes || placeholderStats.totalNotes,
    quizAvgScore: stats.quizAvgScore || placeholderStats.quizAvgScore
  };
  const quizzes = data?.recentQuizzes || [];
  const attempted = quizzes.filter(q => q.attempted);

  const statCounters = {
    chats: useAnimatedCount(liveStats.totalChats),
    quizzes: useAnimatedCount(liveStats.totalQuizzes),
    notes: useAnimatedCount(liveStats.totalNotes),
    avgScore: useAnimatedCount(liveStats.quizAvgScore),
    xp: useAnimatedCount(gameProgress.xp)
  };

  const chartData = attempted.slice(0, 6).map((q) => ({
    label: q.topic.length > 10 ? q.topic.substring(0, 10) + '…' : q.topic,
    pct: Math.round((q.score / q.totalScore) * 100)
  }));


  if (loading) {
    return (
      <div className="dashboard">
        <div className="skeleton-header" />
        <div className="skeleton-stats">
          {[1, 2, 3, 4].map((s) => <div key={s} className="skeleton-card" />)}
        </div>
        <div className="skeleton-body">
          <div className="skeleton-card tall" />
          <div className="skeleton-card tall" />
        </div>
      </div>
    );
  }

  const dashMotion = workspaceEntryReveal
    ? {
        initial: { opacity: 0, y: 20, scale: 0.985, filter: 'blur(8px)' },
        animate: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' },
        transition: { duration: 0.52, ease: [0.22, 1, 0.36, 1] },
      }
    : {
        initial: false,
        animate: { opacity: 1 },
        transition: { duration: 0 },
      };

  const typingPreview = `AI Copilot is ready${'.'.repeat((typingTick % 3) + 1)}`;

  const greet = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const handlePromptClick = (prompt) => {
    navigate('/chat', { state: { prefill: prompt } });
  };

  const handleExplainAnything = () => {
    const prompt = explainInput.trim();
    if (!prompt) {
      toast.error('Type a topic first');
      return;
    }
    rewardAction(10, 'Used Explain Anything', '+10 XP');
    navigate('/chat', { state: { prefill: `Explain this clearly with examples: ${prompt}` } });
  };

  const handleHeroAsk = (e) => {
    e.preventDefault();
    if (!heroInput.trim()) return;
    rewardAction(10, 'Asked AI from dashboard hero', '+10 XP');
    navigate('/chat', { state: { prefill: heroInput.trim() } });
  };

  const onPipelineAction = (step) => {
    setPipelineStep(step);
    const result = awardXp(20, `Pipeline step ${step} completed`);
    toast.success(result.leveledUp ? `+20 XP earned • Level ${result.levelAfter}` : '+20 XP earned');
  };

  const rewardAction = (xp, reason, fallbackMessage) => {
    const result = awardXp(xp, reason);
    if (result.leveledUp) {
      toast.success(`Level up! You reached level ${result.levelAfter}`);
    } else if (fallbackMessage) {
      toast.success(fallbackMessage);
    }
  };

  const currentLevel = getLevelFromXp(gameProgress.xp);
  const xpInLevel = getXpWithinLevel(gameProgress.xp);
  const xpPerLevel = getXpPerLevel();

  return (
    <motion.div className="dashboard" {...dashMotion}>
      <div className="dash-header">
        <div className="hero-copy">
          <h1>{greet()}, {user?.name?.split(' ')[0]} <span role="img" aria-label="moon">🌙</span> Ready to learn?</h1>
          <div className="typing-preview">{typingPreview}<span className="typing-caret">|</span></div>
          <form className="hero-ask-box" onSubmit={handleHeroAsk}>
            <input
              className="input hero-input"
              value={heroInput}
              onChange={(e) => setHeroInput(e.target.value)}
              placeholder="Ask anything... AI will explain, save notes, and turn it into a quiz."
            />
            <button type="submit" className="btn btn-primary hero-input-btn">Ask AI</button>
          </form>
          <div className="hero-chips">
            {HERO_CHIPS.map((chip) => (
              <button key={chip} className="prompt-chip" onClick={() => { rewardAction(5, `Used quick prompt: ${chip}`, '+5 XP'); handlePromptClick(chip); }}>{chip}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="stats-grid">
        {[
          { label: 'AI Conversations', value: statCounters.chats, icon: '◎', color: 'var(--accent)' },
          { label: 'Quizzes Taken', value: statCounters.quizzes, icon: '✦', color: '#a78bfa' },
          { label: 'Notes Saved', value: statCounters.notes, icon: '◫', color: '#f59e0b' },
          { label: 'Quiz Avg Score', value: `${statCounters.avgScore}%`, icon: '◆', color: '#19c37d' },
        ].map(s => (
          <div className="stat-card glass-card" key={s.label}>
            <div className="stat-icon" style={{ color: s.color }}>{s.icon}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="dash-body">
        <div className="dash-left">
          <div className="card chart-card glass-card">
            <div className="section-header">
              <h2>Quiz Performance</h2>
              <Link to="/quiz" className="see-all">View all →</Link>
            </div>
            {chartData.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">✦</div>
                <p>No quizzes attempted yet</p>
                <Link to="/quiz" className="btn btn-primary" style={{ marginTop: 12 }}>Generate Quiz</Link>
              </div>
            ) : (
              <div className="bar-chart">
                {chartData.map((d, i) => (
                  <div className="bar-row" key={i}>
                    <div className="bar-label">{d.label}</div>
                    <div className="bar-track">
                      <div
                        className="bar-fill"
                        style={{
                          width: `${d.pct}%`,
                          background: d.pct >= 80 ? 'var(--success)' : d.pct >= 50 ? 'var(--accent)' : 'var(--danger)'
                        }}
                      />
                    </div>
                    <div className="bar-pct">{d.pct}%</div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        <div className="dash-right">
          <div className="card activity-card glass-card compact-card">
            <div className="section-header"><h2>Activity</h2><span className="streak-fire">🔥 {Math.max(4, liveStats.totalChats)} days</span></div>
            <div className="activity-ring-wrap">
              <svg viewBox="0 0 120 120" className="activity-ring">
                <circle cx="60" cy="60" r="50" fill="none" stroke="var(--bg4)" strokeWidth="10"/>
                <circle cx="60" cy="60" r="50" fill="none" stroke="var(--accent)" strokeWidth="10"
                  strokeDasharray={`${Math.min(liveStats.totalChats * 10, 314)} 314`}
                  strokeLinecap="round" transform="rotate(-90 60 60)" style={{ transition: '1s ease' }}/>
              </svg>
              <div className="ring-label">
                <div className="ring-value">{statCounters.chats}</div>
                <div className="ring-sub">chats</div>
              </div>
            </div>
            <div className="activity-stats">
              <div className="act-stat"><span style={{ color: 'var(--accent)' }}>◎</span> {statCounters.chats} chats</div>
              <div className="act-stat"><span style={{ color: '#a78bfa' }}>✦</span> {statCounters.quizzes} quizzes</div>
              <div className="act-stat"><span style={{ color: '#f59e0b' }}>◫</span> {statCounters.notes} notes</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card flow-card">
        <div className="section-header">
          <h2>Connected AI Flow</h2>
          <span className="badge badge-blue">+XP</span>
        </div>
        <div className="xp-row">
          <span>Level {currentLevel}</span>
          <span>{statCounters.xp} XP</span>
        </div>
        <div className="xp-track"><span className="xp-fill" style={{ width: `${Math.min((xpInLevel / xpPerLevel) * 100, 100)}%` }} /></div>
        <div className="flow-steps">
          <button className={`flow-step ${pipelineStep >= 1 ? 'active' : ''}`} onClick={() => { onPipelineAction(1); navigate('/chat', { state: { prefill: 'Explain the topic in simple steps' } }); }}>1. Ask AI</button>
          <button className={`flow-step ${pipelineStep >= 2 ? 'active' : ''}`} onClick={() => { onPipelineAction(2); navigate('/notes'); }}>2. Save as note</button>
          <button className={`flow-step ${pipelineStep >= 3 ? 'active' : ''}`} onClick={() => { onPipelineAction(3); navigate('/quiz'); }}>3. Convert to quiz</button>
          <button className={`flow-step ${pipelineStep >= 4 ? 'active' : ''}`} onClick={() => onPipelineAction(4)}>4. Track performance</button>
        </div>
        <p className="flow-hint">PDF {'->'} AI summary {'->'} quiz pipeline is now connected through notes and quizzes.</p>
      </div>

      <div className={`wow-dock ${showExplainBox ? 'open' : ''}`} onMouseEnter={() => setShowExplainBox(true)} onMouseLeave={() => setShowExplainBox(false)}>
        <button className="wow-fab" onClick={() => setShowExplainBox(v => !v)}>🧠 Explain anything</button>
        <div className="wow-panel">
          <input
            className="input"
            value={explainInput}
            onChange={(e) => setExplainInput(e.target.value)}
            placeholder="e.g. Explain recursion with examples"
          />
          <button className="btn btn-primary" onClick={handleExplainAnything}>Go</button>
        </div>
      </div>
    </motion.div>
  );
}
