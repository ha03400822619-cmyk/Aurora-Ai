import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { awardXp } from '../utils/gameProgress';
import './QuizTakePage.css';

export default function QuizTakePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null);
  const [current, setCurrent] = useState(0);
  const [retaking, setRetaking] = useState(false);
  const [startTime, setStartTime] = useState(Date.now());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    axios.get(`/quiz/${id}`).then(res => {
      const q = res.data.quiz;
      setQuiz(q);
      setAnswers(new Array(q.questions.length).fill(null));
      if (q.attempted) {
        setSubmitted(true);
        setAnswers(q.answers);
        const ts = Math.max(1, q.totalScore || q.questions?.length || 1);
        const sc = Number(q.score) || 0;
        setResult({ score: sc, totalScore: ts, percentage: Math.round((sc / ts) * 100) });
      }
    }).catch(() => { toast.error('Quiz not found'); navigate('/quiz'); })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const selectAnswer = (qIndex, optIndex) => {
    if (submitted) return;
    setAnswers(prev => { const a = [...prev]; a[qIndex] = optIndex; return a; });
  };

  const submitQuiz = useCallback(async () => {
    if (answers.includes(null)) {
      toast.error('Please answer all questions before submitting.');
      return;
    }
    setSubmitting(true);
    try {
      const timeTaken = Math.round((Date.now() - startTime) / 1000);
      const res = await axios.post(`/quiz/${id}/submit`, { answers, timeTaken });
      setResult(res.data);
      setSubmitted(true);
      const pctRaw = res.data.percentage;
      const ts = Math.max(1, Number(res.data.totalScore) || 1);
      const pct = Number.isFinite(Number(pctRaw))
        ? Number(pctRaw)
        : Math.round((Number(res.data.score) / ts) * 100);
      const xpGain = Math.round(12 + (Math.min(100, Math.max(0, pct)) / 100) * 48);
      const xpOut = awardXp(xpGain, `Quiz completed (${pct}%)`);
      toast.success(
        `Quiz submitted! ${res.data.score}/${res.data.totalScore} · +${xpGain} XP${xpOut.leveledUp ? ' · Level up!' : ''}`
      );
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  }, [answers, id, startTime]);

  const retakeQuiz = useCallback(async () => {
    setRetaking(true);
    try {
      const res = await axios.post(`/quiz/${id}/reset`);
      const refreshed = res.data.quiz;
      setQuiz(refreshed);
      setSubmitted(false);
      setResult(null);
      setCurrent(0);
      setAnswers(new Array(refreshed.questions.length).fill(null));
      setStartTime(Date.now());
      toast.success('Quiz reset. You can retake it now.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not reset quiz');
    } finally {
      setRetaking(false);
    }
  }, [id]);

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;
  if (!quiz) return null;

  const q = quiz.questions[current];
  const answered = answers.filter(a => a !== null).length;
  const progress = (answered / quiz.questions.length) * 100;

  const getOptionClass = (qIndex, optIndex) => {
    if (!submitted) return answers[qIndex] === optIndex ? 'selected' : '';
    const correct = quiz.questions[qIndex].correctAnswer;
    if (optIndex === correct) return 'correct';
    if (answers[qIndex] === optIndex && optIndex !== correct) return 'wrong';
    return '';
  };

  return (
    <div className="quiz-take-page">
      {/* Header */}
      <div className="quiz-take-header">
        <button className="btn btn-secondary" onClick={() => navigate('/quiz')}>← Back</button>
        <div className="quiz-take-title">{quiz.topic}</div>
        {!submitted && (
          <div className="quiz-progress-text">{answered}/{quiz.questions.length} answered</div>
        )}
        {submitted && result && (
          <div className="result-badge" style={{ color: result.percentage >= 80 ? 'var(--success)' : result.percentage >= 50 ? 'var(--warning)' : 'var(--danger)' }}>
            {result.score}/{result.totalScore} · {result.percentage}%
          </div>
        )}
      </div>

      {/* Progress Bar */}
      {!submitted && (
        <div className="progress-bar-track">
          <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
        </div>
      )}

      {/* Result Summary (if submitted) */}
      {submitted && result && (
        <div className="result-summary">
          <div className="result-score">{result.score}<span>/{result.totalScore}</span></div>
          <div className="result-pct" style={{ color: result.percentage >= 80 ? 'var(--success)' : result.percentage >= 50 ? 'var(--warning)' : 'var(--danger)' }}>
            {result.percentage}%
          </div>
          <div className="result-msg">
            {result.percentage >= 80 ? '🎉 Excellent! Great job!' : result.percentage >= 50 ? '👍 Good effort! Review the wrong answers below.' : '📚 Keep studying! Review explanations below.'}
          </div>
        </div>
      )}

      {/* Question Navigation */}
      <div className="q-nav">
        {quiz.questions.map((_, i) => (
          <button
            key={i}
            className={`q-nav-btn ${current === i ? 'active' : ''} ${answers[i] !== null ? 'answered' : ''} ${submitted && answers[i] === quiz.questions[i].correctAnswer ? 'correct-nav' : submitted && answers[i] !== null && answers[i] !== quiz.questions[i].correctAnswer ? 'wrong-nav' : ''}`}
            onClick={() => setCurrent(i)}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {/* Current Question */}
      <div className="question-card">
        <div className="question-num">Question {current + 1} of {quiz.questions.length}</div>
        <div className="question-text">{q.question}</div>
        <div className="options-list">
          {q.options.map((opt, oi) => (
            <button
              key={oi}
              className={`option-btn ${getOptionClass(current, oi)}`}
              onClick={() => selectAnswer(current, oi)}
              disabled={submitted}
            >
              <span className="option-letter">{String.fromCharCode(65 + oi)}</span>
              <span>{opt}</span>
            </button>
          ))}
        </div>
        {submitted && q.explanation && (
          <div className="explanation">
            <span className="explanation-label">💡 Explanation:</span> {q.explanation}
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="quiz-nav-btns">
        <button className="btn btn-secondary" onClick={() => setCurrent(c => Math.max(0, c - 1))} disabled={current === 0}>
          ← Previous
        </button>
        {current < quiz.questions.length - 1 ? (
          <button className="btn btn-primary" onClick={() => setCurrent(c => c + 1)}>
            Next →
          </button>
        ) : !submitted ? (
          <button className="btn btn-primary" onClick={submitQuiz} disabled={submitting || answers.includes(null)}>
            {submitting ? 'Submitting...' : '✓ Submit Quiz'}
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary" onClick={retakeQuiz} disabled={retaking}>
              {retaking ? 'Resetting...' : '↺ Retake Quiz'}
            </button>
            <button className="btn btn-primary" onClick={() => navigate('/quiz')}>
              Back to Quizzes →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
