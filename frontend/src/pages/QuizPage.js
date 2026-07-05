import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import './QuizPage.css';

const DIFFICULTIES = ['easy', 'medium', 'hard'];

export default function QuizPage() {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectFocus, setSelectFocus] = useState('');
  const [notes, setNotes] = useState([]);
  const [form, setForm] = useState({ topic: '', numQuestions: 5, difficulty: 'medium', noteId: '' });
  const [noteContext, setNoteContext] = useState('');

  useEffect(() => {
    Promise.all([axios.get('/quiz'), axios.get('/notes')])
      .then(([qRes, nRes]) => {
        setQuizzes(qRes.data.quizzes);
        setNotes(nRes.data.notes);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleNoteSelect = async (noteId) => {
    setForm(f => ({ ...f, noteId }));
    if (noteId) {
      const res = await axios.get(`/notes/${noteId}`);
      setNoteContext(res.data.note.content);
      setForm(f => ({ ...f, topic: f.topic || res.data.note.title }));
    } else {
      setNoteContext('');
    }
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!form.topic) return;
    setGenerating(true);
    try {
      const res = await axios.post('/quiz/generate', {
        topic: form.topic,
        numQuestions: form.numQuestions,
        difficulty: form.difficulty,
        noteContext
      });
      setQuizzes(prev => [res.data.quiz, ...prev]);
      setShowForm(false);
      setForm({ topic: '', numQuestions: 5, difficulty: 'medium', noteId: '' });
      setNoteContext('');
      toast.success('Quiz generated! Good luck 🎯');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate quiz');
    } finally {
      setGenerating(false);
    }
  };

  const toFiniteNumber = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };

  const getQuizPercent = (quiz) => {
    if (!quiz?.attempted) return null;
    const score = Math.max(0, toFiniteNumber(quiz?.score, 0));
    const total = Math.max(
      0,
      toFiniteNumber(quiz?.totalScore, toFiniteNumber(quiz?.total_score, toFiniteNumber(quiz?.questionCount, toFiniteNumber(quiz?.question_count, 0))))
    );
    if (total <= 0) return 0;
    return Math.round((score / total) * 100);
  };

  const getScoreColor = (quiz) => {
    if (!quiz.attempted) return 'var(--text3)';
    const pct = getQuizPercent(quiz);
    if (pct === null) return 'var(--text3)';
    if (pct >= 80) return 'var(--success)';
    if (pct >= 50) return 'var(--warning)';
    return 'var(--danger)';
  };

  return (
    <div className="quiz-page">
      <div className="page-header">
        <div>
          <h1>Quizzes</h1>
          <p>AI-generated quizzes to test your knowledge</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(s => !s)}>
          {showForm ? '✕ Cancel' : '+ Generate Quiz'}
        </button>
      </div>

      {/* Generate Form */}
      <div className={`quiz-form-shell ${showForm ? 'open' : 'closed'}`}>
        <div className="card quiz-gen-form">
          <h2 style={{ marginBottom: 16, fontSize: 16 }}>Generate New Quiz</h2>
          <form onSubmit={handleGenerate}>
            <div className="gen-grid">
              <div className="form-group">
                <label className="form-label">Topic *</label>
                <input className="input" placeholder="e.g. Newton's Laws, Photosynthesis, World War II"
                  value={form.topic} onChange={e => setForm(f => ({ ...f, topic: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">From Note (optional)</label>
                <div className={`quiz-select-wrap ${selectFocus === 'note' ? 'focused' : ''}`}>
                  <select
                    className="input quiz-select"
                    value={form.noteId}
                    onFocus={() => setSelectFocus('note')}
                    onBlur={() => setSelectFocus('')}
                    onChange={e => handleNoteSelect(e.target.value)}
                  >
                    <option value="">No note — use topic only</option>
                    {notes.map((n) => <option key={n.id} value={n.id}>{n.title}</option>)}
                  </select>
                  <span className="quiz-select-chevron">⌄</span>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Questions</label>
                <div className={`quiz-select-wrap ${selectFocus === 'questions' ? 'focused' : ''}`}>
                  <select
                    className="input quiz-select"
                    value={form.numQuestions}
                    onFocus={() => setSelectFocus('questions')}
                    onBlur={() => setSelectFocus('')}
                    onChange={e => setForm(f => ({ ...f, numQuestions: +e.target.value }))}
                  >
                    {[3, 5, 8, 10].map(n => <option key={n} value={n}>{n} questions</option>)}
                  </select>
                  <span className="quiz-select-chevron">⌄</span>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Difficulty</label>
                <div className={`quiz-select-wrap ${selectFocus === 'difficulty' ? 'focused' : ''}`}>
                  <select
                    className="input quiz-select"
                    value={form.difficulty}
                    onFocus={() => setSelectFocus('difficulty')}
                    onBlur={() => setSelectFocus('')}
                    onChange={e => setForm(f => ({ ...f, difficulty: e.target.value }))}
                  >
                    {DIFFICULTIES.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
                  </select>
                  <span className="quiz-select-chevron">⌄</span>
                </div>
              </div>
            </div>
            <button className="btn btn-primary" type="submit" disabled={generating}>
              {generating ? (
                <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Generating with AI...</>
              ) : '✦ Generate Quiz'}
            </button>
          </form>
        </div>
      </div>

      {/* Quiz List */}
      {loading ? <div className="loading-screen"><div className="spinner" /></div>
        : quizzes.length === 0 ? (
          <div className="quiz-empty">
            <div style={{ fontSize: 48, marginBottom: 12 }}>✦</div>
            <h2>No quizzes yet</h2>
            <p>Generate your first AI quiz to test your knowledge</p>
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>Generate a Quiz</button>
          </div>
        ) : (
          <div className="quiz-grid">
            {quizzes.map(quiz => (
              <Link to={`/quiz/${quiz.id}`} className="quiz-card" key={quiz.id}>
                {/** Prevent NaN in UI when legacy/partial quiz rows have missing totals. */}
                {(() => {
                  const pct = getQuizPercent(quiz);
                  const score = Math.max(0, toFiniteNumber(quiz?.score, 0));
                  const total = Math.max(
                    0,
                    toFiniteNumber(quiz?.totalScore, toFiniteNumber(quiz?.total_score, toFiniteNumber(quiz?.questionCount, toFiniteNumber(quiz?.question_count, 0))))
                  );
                  return (
                    <>
                <div className="quiz-card-top">
                  <div className="quiz-topic">{quiz.topic}</div>
                  <div className="quiz-score-circle" style={{ borderColor: getScoreColor(quiz), color: getScoreColor(quiz) }}>
                    {quiz.attempted ? `${pct ?? 0}%` : '—'}
                  </div>
                </div>
                <div className="quiz-card-meta">
                  <span className="badge badge-blue">{total} Qs</span>
                  {quiz.attempted
                    ? <span className="badge badge-green">✓ Done · {score}/{total}</span>
                    : <span className="badge badge-amber">Not attempted</span>}
                </div>
                <div className="quiz-card-footer">
                  {quiz.attempted ? 'Review answers →' : 'Start quiz →'}
                </div>
                    </>
                  );
                })()}
              </Link>
            ))}
          </div>
        )
      }
    </div>
  );
}
