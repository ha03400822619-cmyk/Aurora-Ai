import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import './NotesPage.css';

const SUBJECT_OPTIONS = [
  'General',
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'History',
  'Computer Science',
  'English',
  'Economics',
];

const AI_OUTPUT_LABELS = {
  summarize: 'Summarize',
  explain_simple: 'Explain simply',
  key_points: 'Key points',
  flashcards: 'Flashcards',
};

function parseFlashcards(markdown) {
  const text = String(markdown || '');
  const cards = [];
  const blocks = text.split(/\n(?=###\s*Card\s+\d+)/i);
  for (const block of blocks) {
    const frontMatch = block.match(/\*\*Front:\*\*\s*(.+)/i);
    const backMatch = block.match(/\*\*Back:\*\*\s*([\s\S]+)/i);
    if (!frontMatch || !backMatch) continue;
    cards.push({
      front: frontMatch[1].trim(),
      back: backMatch[1].trim(),
    });
  }
  return cards;
}

export default function NotesPage() {
  const navigate = useNavigate();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeNote, setActiveNote] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [manualForm, setManualForm] = useState({ title: '', content: '', subject: 'General' });
  const [tab, setTab] = useState('upload'); // 'upload' | 'manual'
  const [viewerEditing, setViewerEditing] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', content: '', subject: 'General' });
  const [saveInProgress, setSaveInProgress] = useState(false);
  /** PDF / note → AI pipeline output */
  const [aiLoading, setAiLoading] = useState(null);
  const [selectedViewId, setSelectedViewId] = useState('original');
  const [openOutputMenuForNote, setOpenOutputMenuForNote] = useState(null);
  const outputMenuRef = useRef(null);
  const [viewerSwapAnimKey, setViewerSwapAnimKey] = useState(0);

  useEffect(() => {
    fetchNotes();
  }, []);

  useEffect(() => {
    const closeMenuOnOutsideClick = (event) => {
      if (!outputMenuRef.current) return;
      if (!outputMenuRef.current.contains(event.target)) setOpenOutputMenuForNote(null);
    };
    document.addEventListener('mousedown', closeMenuOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeMenuOnOutsideClick);
  }, []);

  useEffect(() => {
    setViewerSwapAnimKey((v) => v + 1);
  }, [selectedViewId, activeNote?.id]);

  const fetchNotes = () => {
    axios.get('/notes').then(res => setNotes(res.data.notes)).finally(() => setLoading(false));
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('subject', 'General');
    setUploading(true);
    try {
      const uploadRes = await axios.post('/notes/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 300000,
      });
      if (uploadRes.data?.extractedViaOcr) {
        toast.success('Note uploaded — text extracted with OCR (scanned PDF).');
      } else {
        toast.success('Note uploaded successfully!');
      }
      fetchNotes();
      setShowAddModal(false);
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        (err.code === 'ECONNABORTED' ? 'Upload timed out (OCR on large PDFs can take minutes).' : '') ||
        err.message ||
        'Upload failed';
      toast.error(msg);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleManualCreate = async (e) => {
    e.preventDefault();
    if (!manualForm.title || !manualForm.content) return;
    setUploading(true);
    try {
      await axios.post('/notes', manualForm);
      toast.success('Note created!');
      fetchNotes();
      setShowAddModal(false);
      setManualForm({ title: '', content: '', subject: 'General' });
    } catch (err) {
      toast.error('Failed to create note');
    } finally {
      setUploading(false);
    }
  };

  const deleteNote = async (noteId) => {
    if (!window.confirm('Delete this note?')) return;
    await axios.delete(`/notes/${noteId}`);
    setNotes(prev => prev.filter(n => n.id !== noteId));
    if (activeNote?.id === noteId) setActiveNote(null);
    toast.success('Note deleted');
  };

  const viewNote = async (noteId) => {
    setViewerEditing(false);
    setSelectedViewId('original');
    setOpenOutputMenuForNote(null);
    const res = await axios.get(`/notes/${noteId}`);
    setActiveNote({ ...res.data.note, outputs: res.data.outputs || [] });
  };

  const runNoteAi = async (action, label) => {
    if (!activeNote?.id || !activeNote.content?.trim()) {
      toast.error('No note text to analyze.');
      return;
    }
    setAiLoading(action);
    try {
      const res = await axios.post(`/notes/${activeNote.id}/ai`, { action });
      const savedOutput = res.data.output || {
        id: `tmp-${Date.now()}`,
        action,
        markdown: res.data.markdown,
      };
      if (!res.data.output) {
        toast.error('Generated result not persisted. Please restart backend server once.');
      }
      setActiveNote((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          outputs: [savedOutput, ...(prev.outputs || [])],
        };
      });
      setSelectedViewId(String(savedOutput.id));
      toast.success(`${label} ready`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'AI request failed');
    } finally {
      setAiLoading(null);
    }
  };

  const generateQuizFromNote = async () => {
    if (!activeNote?.content?.trim()) {
      toast.error('No note text to build a quiz from.');
      return;
    }
    setAiLoading('quiz');
    try {
      const res = await axios.post('/quiz/generate', {
        topic: activeNote.title || 'Quiz from note',
        numQuestions: 5,
        difficulty: 'medium',
        noteContext: activeNote.content.substring(0, 12000),
      });
      toast.success('Quiz generated — opening…');
      navigate(`/quiz/${res.data.quiz.id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not generate quiz');
    } finally {
      setAiLoading(null);
    }
  };

  const startViewerEdit = () => {
    if (!activeNote) return;
    setEditForm({
      title: activeNote.title || '',
      content: activeNote.content || '',
      subject: activeNote.subject || 'General',
    });
    setViewerEditing(true);
  };

  const cancelViewerEdit = () => {
    setViewerEditing(false);
  };

  const handleSaveNote = async (e) => {
    e.preventDefault();
    if (!activeNote?.id) return;
    if (!editForm.title.trim() || !editForm.content.trim()) {
      toast.error('Title and content are required.');
      return;
    }
    setSaveInProgress(true);
    try {
      const res = await axios.put(`/notes/${activeNote.id}`, {
        title: editForm.title.trim(),
        content: editForm.content,
        subject: editForm.subject,
      });
      setActiveNote((prev) => ({ ...res.data.note, outputs: prev?.outputs || [] }));
      setViewerEditing(false);
      fetchNotes();
      toast.success('Note saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save note');
    } finally {
      setSaveInProgress(false);
    }
  };

  const selectedOutput =
    selectedViewId === 'original'
      ? null
      : (activeNote?.outputs || []).find((o) => String(o.id) === String(selectedViewId)) || null;
  const selectedAction = selectedOutput?.action || null;
  const flashcards = selectedAction === 'flashcards' ? parseFlashcards(selectedOutput?.markdown) : [];
  const activeAiLabel = aiLoading ? (AI_OUTPUT_LABELS[aiLoading] || 'AI task') : null;
  const selectedViewLabel = selectedOutput
    ? (AI_OUTPUT_LABELS[selectedOutput.action] || selectedOutput.action)
    : 'Original note';

  const deleteAiOutput = async (outputId) => {
    if (!activeNote?.id) return;
    if (!window.confirm('Delete this generated result?')) return;
    try {
      await axios.delete(`/notes/${activeNote.id}/ai/${outputId}`);
      setActiveNote((prev) => {
        if (!prev) return prev;
        return { ...prev, outputs: (prev.outputs || []).filter((o) => o.id !== outputId) };
      });
      if (String(selectedViewId) === String(outputId)) setSelectedViewId('original');
      toast.success('Generated result deleted');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not delete generated result');
    }
  };

  return (
    <div className="notes-layout">
      {/* Notes List */}
      <div className="notes-list-panel">
        <div className="notes-header">
          <h1>My Notes</h1>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>+ Add Note</button>
        </div>
        {loading ? <div className="loading-screen"><div className="spinner" /></div>
          : notes.length === 0 ? (
            <div className="notes-empty">
              <div style={{ fontSize: 40, marginBottom: 12 }}>◫</div>
              <p>No notes yet. Upload a PDF, Word file, or TXT — or write one manually.</p>
              <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>Add Your First Note</button>
            </div>
          ) : (
            <div className="notes-grid">
              {notes.map(note => (
                <div
                  key={note.id}
                  className={`note-card ${activeNote?.id === note.id ? 'active' : ''}`}
                  onClick={() => viewNote(note.id)}
                >
                  <div className="note-icon">
                    {note.fileType === 'pdf'
                      ? '📄'
                      : note.fileType === 'txt'
                        ? '📝'
                        : note.fileType === 'doc' || note.fileType === 'docx'
                          ? '📘'
                          : '✏️'}
                  </div>
                  <div className="note-body">
                    <div className="note-title">{note.title}</div>
                    {activeNote?.id === note.id && (
                      <div className="note-card-output-row" onClick={(e) => e.stopPropagation()} ref={outputMenuRef}>
                        <div className="note-card-output-head">
                          <button
                            type="button"
                            className={`note-card-output-expand ${openOutputMenuForNote === note.id ? 'open' : ''}`}
                            onClick={async () => {
                              if (activeNote?.id !== note.id) await viewNote(note.id);
                              setOpenOutputMenuForNote((prev) => (prev === note.id ? null : note.id));
                            }}
                            aria-label="Toggle generated note views"
                          >
                            ▸
                          </button>
                          <span className="note-card-output-current">{selectedViewLabel}</span>
                          {selectedOutput && (
                            <button
                              type="button"
                              className="note-card-output-delete"
                              onClick={() => deleteAiOutput(selectedOutput.id)}
                              aria-label="Delete generated result"
                              title="Delete selected generated result"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                        <div className={`note-card-output-menu ${openOutputMenuForNote === note.id ? 'open' : ''}`}>
                          <button
                            type="button"
                            className={`note-card-output-item ${selectedViewId === 'original' ? 'active' : ''}`}
                            onClick={() => setSelectedViewId('original')}
                          >
                            Original note
                          </button>
                          {(activeNote.outputs || []).map((o) => (
                            <button
                              key={o.id}
                              type="button"
                              className={`note-card-output-item ${String(selectedViewId) === String(o.id) ? 'active' : ''}`}
                              onClick={() => setSelectedViewId(String(o.id))}
                            >
                              {AI_OUTPUT_LABELS[o.action] || o.action}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="note-meta">
                      <span className="badge badge-blue">{note.subject}</span>
                      <span className="note-words">{note.wordCount} words</span>
                    </div>
                  </div>
                  <button className="note-delete" onClick={e => { e.stopPropagation(); deleteNote(note.id); }}>✕</button>
                </div>
              ))}
            </div>
          )
        }
      </div>

      {/* Note Viewer */}
      {activeNote && (
        <div className="note-viewer">
          <div className="viewer-header">
            <div className="viewer-header-main">
              <h2>{viewerEditing ? 'Edit note' : activeNote.title}</h2>
              {!viewerEditing && <span className="badge badge-blue">{activeNote.subject}</span>}
            </div>
            <div className="viewer-actions">
              {!viewerEditing ? (
                <button type="button" className="btn btn-secondary" onClick={startViewerEdit}>
                  Edit
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={saveInProgress}
                    onClick={cancelViewerEdit}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="note-edit-form"
                    className="btn btn-primary"
                    disabled={saveInProgress}
                  >
                    {saveInProgress ? 'Saving…' : 'Save'}
                  </button>
                </>
              )}
            </div>
          </div>
          {viewerEditing ? (
            <form id="note-edit-form" className="viewer-edit-form" onSubmit={handleSaveNote}>
              <div className="form-group">
                <label className="form-label" htmlFor="edit-title">Title</label>
                <input
                  id="edit-title"
                  className="input"
                  value={editForm.title}
                  onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Title"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="edit-subject">Subject</label>
                <select
                  id="edit-subject"
                  className="input"
                  value={editForm.subject}
                  onChange={(e) => setEditForm((f) => ({ ...f, subject: e.target.value }))}
                >
                  {(SUBJECT_OPTIONS.includes(editForm.subject)
                    ? SUBJECT_OPTIONS
                    : [...SUBJECT_OPTIONS, editForm.subject]
                  ).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="form-group form-group-grow">
                <label className="form-label" htmlFor="edit-content">Content</label>
                <textarea
                  id="edit-content"
                  className="input viewer-edit-textarea"
                  value={editForm.content}
                  onChange={(e) => setEditForm((f) => ({ ...f, content: e.target.value }))}
                  placeholder="Note text"
                  required
                  spellCheck="true"
                />
              </div>
            </form>
          ) : (
            <div className="note-viewer-scroll">
              <div className="viewer-meta-line">
                {activeNote.updatedAt &&
                  activeNote.createdAt !== activeNote.updatedAt && (
                  <span className="viewer-updated-hint">
                    Updated {new Date(activeNote.updatedAt.replace(' ', 'T')).toLocaleString()}
                  </span>
                )}
                {activeNote.fileName ? (
                  <span className="viewer-file-hint" title={activeNote.fileName}>
                    From file: {activeNote.fileName}
                  </span>
                ) : null}
              </div>
              <div className="note-ai-toolbar">
                <span className="note-ai-toolbar-label">AI</span>
                <button
                  type="button"
                  className="btn btn-secondary note-ai-btn"
                  disabled={!!aiLoading}
                  onClick={() => runNoteAi('summarize', 'Summary')}
                >
                  {aiLoading === 'summarize' ? '…' : 'Summarize'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary note-ai-btn"
                  disabled={!!aiLoading}
                  onClick={() => runNoteAi('explain_simple', 'Simple explanation')}
                >
                  {aiLoading === 'explain_simple' ? '…' : 'Explain simply'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary note-ai-btn"
                  disabled={!!aiLoading}
                  onClick={() => runNoteAi('key_points', 'Key points')}
                >
                  {aiLoading === 'key_points' ? '…' : 'Key points'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary note-ai-btn"
                  disabled={!!aiLoading}
                  onClick={() => runNoteAi('flashcards', 'Flashcards')}
                >
                  {aiLoading === 'flashcards' ? '…' : 'Flashcards'}
                </button>
                <button
                  type="button"
                  className="btn btn-primary note-ai-btn note-ai-btn-primary"
                  disabled={!!aiLoading}
                  onClick={generateQuizFromNote}
                >
                  {aiLoading === 'quiz' ? '…' : 'Generate quiz'}
                </button>
              </div>
              {aiLoading && (
                <div className="note-ai-working" role="status" aria-live="polite">
                  <span className="note-ai-working-spinner" />
                  <span className="note-ai-working-text">
                    AI is generating <strong>{activeAiLabel}</strong>
                  </span>
                  <span className="note-ai-working-dots">
                    <span>.</span><span>.</span><span>.</span>
                  </span>
                </div>
              )}
              <div className="viewer-original-label">
                {selectedOutput ? (AI_OUTPUT_LABELS[selectedOutput.action] || selectedOutput.action) : 'Original text'}
              </div>
              <div key={viewerSwapAnimKey} className="viewer-switch-anim">
                {selectedOutput ? (
                  selectedAction === 'flashcards' && flashcards.length > 0 ? (
                    <div className="flashcards-grid">
                      {flashcards.map((card, idx) => (
                        <div key={`${card.front}-${idx}`} className="flashcard">
                          <div className="flashcard-face flashcard-front">
                            <div className="flashcard-face-label">Front</div>
                            <div className="flashcard-face-content">{card.front}</div>
                          </div>
                          <div className="flashcard-face flashcard-back">
                            <div className="flashcard-face-label">Back</div>
                            <div className="flashcard-face-content">{card.back}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="note-ai-output card">
                      <div className="note-ai-markdown markdown">
                        <ReactMarkdown>{selectedOutput.markdown}</ReactMarkdown>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="viewer-content">{activeNote.content}</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Note Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Note</h2>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <div className="modal-tabs">
              <button className={`tab-btn ${tab === 'upload' ? 'active' : ''}`} onClick={() => setTab('upload')}>Upload File</button>
              <button className={`tab-btn ${tab === 'manual' ? 'active' : ''}`} onClick={() => setTab('manual')}>Write Manually</button>
            </div>
            {tab === 'upload' ? (
              <div className="upload-zone">
                <input
                  type="file"
                  accept=".pdf,.txt,.doc,.docx,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleFileUpload}
                  id="file-input"
                  style={{ display: 'none' }}
                />
                <label htmlFor="file-input" className="upload-label">
                  <div style={{ fontSize: 36, marginBottom: 10 }}>📂</div>
                  <div style={{ fontWeight: 600 }}>Click to upload file</div>
                  <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>
                    PDF (with OCR if scanned), Word (.doc / .docx), or TXT — max 15MB
                  </div>
                  {uploading && <div style={{ marginTop: 10, color: 'var(--accent)' }}>Uploading...</div>}
                </label>
              </div>
            ) : (
              <form onSubmit={handleManualCreate}>
                <div className="form-group">
                  <label className="form-label">Title</label>
                  <input className="input" value={manualForm.title}
                    onChange={e => setManualForm(f => ({ ...f, title: e.target.value }))} placeholder="Note title" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Subject</label>
                  <select className="input" value={manualForm.subject}
                    onChange={e => setManualForm(f => ({ ...f, subject: e.target.value }))}>
                    {SUBJECT_OPTIONS.map(s =>
                      <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Content</label>
                  <textarea className="input" rows={8} value={manualForm.content}
                    onChange={e => setManualForm(f => ({ ...f, content: e.target.value }))}
                    placeholder="Paste or type your notes here..." required style={{ resize: 'vertical' }} />
                </div>
                <button className="btn btn-primary" type="submit" disabled={uploading}>
                  {uploading ? 'Saving...' : 'Save Note'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
