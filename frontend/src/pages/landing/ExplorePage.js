import React from 'react';
import { Link } from 'react-router-dom';
import { useWorkspaceEntry } from './useWorkspaceEntry';
import './landingShared.css';
import './ExplorePage.css';

const cards = [
  {
    title: 'AI Chat',
    desc: 'Ask anything and get clear explanations with follow-ups tuned for studying.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: 'PDF Scanner',
    desc: 'Upload course PDFs and turn dense pages into summaries you can revise from.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13 3v6h6M9 13h6M9 17h4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: 'Quiz Generator',
    desc: 'Spin up practice quizzes from your notes so you retain what actually matters.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: 'Voice Assistant',
    desc: 'Talk through problems hands-free when you are pacing or away from the keyboard.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export default function ExplorePage() {
  const { start, overlay } = useWorkspaceEntry();

  return (
    <div className="landing-body explore-page">
      {overlay}
      <div className="landing-particles explore-noise" aria-hidden />
      <header className="explore-header">
        <Link to="/" className="explore-back">
          ← Aurora
        </Link>
        <button type="button" className="landing-btn-primary explore-header-cta" onClick={start}>
          Enter Workspace
        </button>
      </header>

      <main className="explore-main">
        <section className="explore-hero">
          <div className="explore-hero-badge">Study reimagined</div>
          <h1 className="explore-hero-title">
            One copilot for <span className="explore-hero-accent">everything</span> you learn.
          </h1>
          <p className="explore-hero-lead">
            Chat, documents, quizzes, and voice — wired into one calm workspace. Less tab chaos, more
            focus.
          </p>
          <ul className="explore-metrics" aria-label="Highlights">
            <li>
              <strong>4-in-1</strong>
              <span>Pipeline</span>
            </li>
            <li>
              <strong>PDF → AI</strong>
              <span>Summaries</span>
            </li>
            <li>
              <strong>Notes → Quiz</strong>
              <span>Retention</span>
            </li>
          </ul>
          <div className="explore-hero-cta-row">
            <button type="button" className="landing-btn-primary" onClick={start}>
              Enter Workspace
            </button>
            <Link to="/" className="landing-btn-secondary explore-hero-secondary">
              Home
            </Link>
          </div>
        </section>

        <section className="explore-section explore-features">
          <div className="explore-section-head">
            <h2 className="explore-section-title">Built for serious study sessions</h2>
            <p className="explore-section-sub">Hover a card to preview what unlocks inside the workspace.</p>
          </div>
          <div className="explore-card-grid">
            {cards.map((c) => (
              <article key={c.title} className="explore-card">
                <div className="explore-card-icon">{c.icon}</div>
                <h3>{c.title}</h3>
                <p>{c.desc}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="explore-section explore-demos">
          <div className="explore-section-head">
            <h2 className="explore-section-title">See the flow</h2>
            <p className="explore-section-sub">Same surface you use after you enter — no separate “demo app.”</p>
          </div>
          <div className="explore-demo-grid">
            <div className="explore-demo-card">
              <span className="explore-demo-label">Ask anything</span>
              <div className="explore-demo-preview chat-preview">
                <div className="chat-preview-bubble user">Explain entropy like I am new to thermodynamics.</div>
                <div className="chat-preview-bubble ai">
                  Entropy measures how spread out energy is in a system. Picture ice melting in warm water…
                </div>
              </div>
            </div>
            <div className="explore-demo-card">
              <span className="explore-demo-label">Upload PDF → summary</span>
              <div className="explore-demo-preview pdf-preview">
                <div className="pdf-preview-bar">
                  <span className="pdf-dot" />
                  <span className="pdf-name">lecture_04.pdf</span>
                </div>
                <div className="pdf-preview-body">
                  <strong>Summary</strong>
                  <p>Key ideas: free energy, equilibrium, reversible paths. Save as note → generate quiz.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="explore-final-cta">
          <h2>Ready when you are.</h2>
          <p>Open the workspace and pick up where you left off.</p>
          <button type="button" className="landing-btn-primary explore-final-btn" onClick={start}>
            Enter Workspace
          </button>
        </section>
      </main>
    </div>
  );
}
