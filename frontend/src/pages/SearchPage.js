import React, { useState, useRef } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import './SearchPage.css';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  const search = async (e) => {
    e?.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    try {
      const [chatsRes, notesRes] = await Promise.all([
        axios.get('/chat'),
        axios.get('/notes')
      ]);
      const q = query.toLowerCase();
      const matchedChats = chatsRes.data.chats.filter(c =>
        c.title.toLowerCase().includes(q) || c.subject.toLowerCase().includes(q)
      );
      const matchedNotes = notesRes.data.notes.filter(n =>
        n.title.toLowerCase().includes(q) || (n.subject || '').toLowerCase().includes(q)
      );
      setResults({ chats: matchedChats, notes: matchedNotes });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const highlight = (text, q) => {
    if (!q) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return text;
    return <>
      {text.substring(0, idx)}
      <mark>{text.substring(idx, idx + q.length)}</mark>
      {text.substring(idx + q.length)}
    </>;
  };

  const total = results ? results.chats.length + results.notes.length : 0;

  return (
    <div className="search-page">
      <div className="search-header">
        <h1>Search</h1>
        <p>Search through all your chats and notes</p>
      </div>

      <form className="search-form" onSubmit={search}>
        <div className="search-input-wrap">
          <span className="search-icon">⌕</span>
          <input
            ref={inputRef}
            className="search-input"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search chats, notes, subjects…"
            autoFocus
          />
          {query && <button type="button" className="search-clear" onClick={() => { setQuery(''); setResults(null); inputRef.current?.focus(); }}>✕</button>}
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading || !query.trim()}>
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      {results && (
        <div className="search-results">
          <div className="results-summary">
            {total === 0 ? `No results for "${query}"` : `${total} result${total !== 1 ? 's' : ''} for "${query}"`}
          </div>

          {results.chats.length > 0 && (
            <div className="results-section">
              <div className="results-label">
                <span className="results-icon" style={{ color: 'var(--accent)' }}>◎</span>
                Chats ({results.chats.length})
              </div>
              {results.chats.map(chat => (
                <Link to={`/chat/${chat.id}`} className="result-item" key={chat.id}>
                  <div className="result-icon-wrap" style={{ background: 'rgba(16,163,127,0.1)' }}>
                    <span style={{ color: 'var(--accent)' }}>◎</span>
                  </div>
                  <div className="result-content">
                    <div className="result-title">{highlight(chat.title, query)}</div>
                    <div className="result-meta">{chat.subject} · {chat.messageCount} messages</div>
                  </div>
                  <span className="result-arrow">›</span>
                </Link>
              ))}
            </div>
          )}

          {results.notes.length > 0 && (
            <div className="results-section">
              <div className="results-label">
                <span className="results-icon" style={{ color: '#f59e0b' }}>◫</span>
                Notes ({results.notes.length})
              </div>
              {results.notes.map(note => (
                <div className="result-item" key={note.id}>
                  <div className="result-icon-wrap" style={{ background: 'rgba(245,158,11,0.1)' }}>
                    <span style={{ color: '#f59e0b' }}>◫</span>
                  </div>
                  <div className="result-content">
                    <div className="result-title">{highlight(note.title, query)}</div>
                    <div className="result-meta">{note.subject} · {note.word_count} words · {note.file_type}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {total === 0 && (
            <div className="no-results">
              <div className="no-results-icon">⌕</div>
              <p>No chats or notes found matching <strong>"{query}"</strong></p>
              <p style={{ marginTop: 6 }}>Try a different keyword or subject name</p>
            </div>
          )}
        </div>
      )}

      {!results && (
        <div className="search-tips">
          <div className="tip-icon">💡</div>
          <h3>Search tips</h3>
          <ul>
            <li>Search by chat title or topic name</li>
            <li>Search by subject (e.g. "Physics", "History")</li>
            <li>Search by note title or file name</li>
          </ul>
        </div>
      )}
    </div>
  );
}
