import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { isCommand, executeCommand, getCommandSuggestions, COMMAND_LIST } from '../commands/commandHandler';
import './ChatPage.css';

const THINKING_MESSAGE = 'Aurora is thinking';

const CHAR_MS = 14;
const TYPING_INTRO_MS = 120;
/** If user is farther than this from the bottom, do not auto-scroll (e.g. while AI streams). */
const SCROLL_PIN_THRESHOLD_PX = 48;

function textForSpeech(md) {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/#{1,6}\s*/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#*`_~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 4000);
}

export default function ChatPage() {
  const { user } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [threadLoading, setThreadLoading] = useState(false);
  const [chatId, setChatId] = useState(id || null);

  const [aiStatus, setAiStatus] = useState(null);

  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingPaused, setSpeakingPaused] = useState(false);
  const [speakingMsgIndex, setSpeakingMsgIndex] = useState(null);
  const [voiceEnabled, setVoiceEnabled] = useState(() => {
    try { return localStorage.getItem('aurora_auto_read') === '1'; } catch { return false; }
  });
  /** Pending image (data URL) before send — cleared after message is sent. */
  const [attachment, setAttachment] = useState(null);
  const [showScrollToBottomBtn, setShowScrollToBottomBtn] = useState(false);
  
  // Command system state
  const [commandSuggestions, setCommandSuggestions] = useState([]);
  const [showCommandSuggestions, setShowCommandSuggestions] = useState(false);
  const [activeTimer, setActiveTimer] = useState(null);
  const [timerState, setTimerState] = useState({
    isRunning: false,
    isPaused: false,
    remainingSeconds: 0,
    totalSeconds: 0
  });
  const timerIntervalRef = useRef(null);

  const normalizeAssistantMarkdown = useCallback((content) => {
    const text = typeof content === 'string' ? content : '';
    const fullBold = text.match(/^\s*\*\*([\s\S]*?)\*\*\s*$/);
    if (fullBold) return fullBold[1].trim();
    const fullUnderlineBold = text.match(/^\s*__([\s\S]*?)__\s*$/);
    if (fullUnderlineBold) return fullUnderlineBold[1].trim();
    return text;
  }, []);

  const recognitionRef = useRef(null);
  const synthRef = useRef(typeof window !== 'undefined' ? window.speechSynthesis : null);
  const voiceEnabledRef = useRef(voiceEnabled);
  const messagesAreaRef = useRef(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const pendingFullTextRef = useRef('');
  const abortControllerRef = useRef(null);
  const imageInputRef = useRef(null);
  /** Cache threads locally to avoid flicker when switching chats. */
  const chatCacheRef = useRef(new Map());
  /** Used to ignore late responses when user switches chats quickly. */
  const chatLoadSeqRef = useRef(0);
  /** When true, new content scrolls the thread to the bottom; false after user scrolls up. */
  const stickToBottomRef = useRef(true);
  /** Synced from loaded chat for API; defaults to General (no subject picker). */
  const subjectRef = useRef('General');
  /** Thread visible enough to offer “jump to latest” (hide on empty welcome). */
  const hasThreadRef = useRef(false);
  hasThreadRef.current =
    messages.length > 0 || loading || aiStatus != null;

  const updateStickToBottomFromScroll = useCallback(() => {
    const el = messagesAreaRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = dist <= SCROLL_PIN_THRESHOLD_PX;
    stickToBottomRef.current = nearBottom;
    setShowScrollToBottomBtn(hasThreadRef.current && !nearBottom);
  }, []);

  const scrollToBottomSmooth = useCallback(() => {
    const el = messagesAreaRef.current;
    if (!el) return;
    const reduceMotion = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

    if (reduceMotion) {
      stickToBottomRef.current = true;
      el.scrollTop = el.scrollHeight;
      updateStickToBottomFromScroll();
      return;
    }

    /* Pin is off while smoothing so the messages effect doesn’t snap scrollTop every chunk. */
    stickToBottomRef.current = false;

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      el.removeEventListener('scroll', onScroll);
      clearTimeout(fallbackTimer);
    };

    const finishIfPinned = () => {
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (dist <= SCROLL_PIN_THRESHOLD_PX + 4) {
        stickToBottomRef.current = true;
        cleanup();
        updateStickToBottomFromScroll();
      }
    };

    function onScroll() {
      finishIfPinned();
    }

    el.addEventListener('scroll', onScroll, { passive: true });
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });

    const fallbackTimer = setTimeout(() => {
      finishIfPinned();
      cleanup();
      updateStickToBottomFromScroll();
    }, 650);
  }, [updateStickToBottomFromScroll]);

  useEffect(() => {
    const el = messagesAreaRef.current;
    if (!el) return;
    const unpinOnWheelUp = (e) => {
      if (e.deltaY < -1) stickToBottomRef.current = false;
    };
    el.addEventListener('wheel', unpinOnWheelUp, { passive: true });
    return () => el.removeEventListener('wheel', unpinOnWheelUp);
  }, []);

  useEffect(() => {
    const el = messagesAreaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => updateStickToBottomFromScroll());
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateStickToBottomFromScroll]);

  useEffect(() => { voiceEnabledRef.current = voiceEnabled; }, [voiceEnabled]);

  useEffect(() => {
    try { localStorage.setItem('aurora_auto_read', voiceEnabled ? '1' : '0'); } catch { /* ignore */ }
  }, [voiceEnabled]);

  useEffect(() => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const warm = () => synth.getVoices();
    warm();
    synth.onvoiceschanged = warm;
    return () => { synth.onvoiceschanged = null; };
  }, []);

  useEffect(() => {
    stickToBottomRef.current = true;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setAiStatus(null);
    setLoading(false);

    const seq = ++chatLoadSeqRef.current;
    const controller = new AbortController();
    setThreadLoading(Boolean(id));

    if (id) {
      setChatId(id);

      // Show cached thread immediately if we have it (prevents “previous chat flash”).
      const cached = chatCacheRef.current.get(String(id));
      if (cached) {
        setMessages(cached.messages || []);
        subjectRef.current = cached.subject || 'General';
      } else {
        // Keep last rendered messages until the target thread arrives to avoid empty-state flash.
        subjectRef.current = 'General';
      }

      axios
        .get(`/chat/${id}`, { signal: controller.signal })
        .then((res) => {
          if (chatLoadSeqRef.current !== seq) return;
          const chat = res.data?.chat;
          if (!chat) return;
          const nextMessages = Array.isArray(chat.messages) ? chat.messages : [];
          const nextSubject = chat.subject || 'General';
          chatCacheRef.current.set(String(id), { messages: nextMessages, subject: nextSubject });
          setMessages(nextMessages);
          subjectRef.current = nextSubject;
          setThreadLoading(false);
        })
        .catch((err) => {
          const canceled =
            axios.isCancel?.(err) ||
            err.code === 'ERR_CANCELED' ||
            err.name === 'CanceledError' ||
            err.name === 'AbortError';
          if (canceled) return;
          if (chatLoadSeqRef.current !== seq) return;
          toast.error('Chat not found');
          setThreadLoading(false);
        });
    } else {
      setChatId(null);
      setMessages([]);
      subjectRef.current = 'General';
      setThreadLoading(false);
    }

    return () => controller.abort();
  }, [id]);

  useEffect(() => {
    const el = messagesAreaRef.current;
    if (!el || !stickToBottomRef.current) return;
    requestAnimationFrame(() => {
      const area = messagesAreaRef.current;
      if (!area || !stickToBottomRef.current) return;
      area.scrollTop = area.scrollHeight;
      setShowScrollToBottomBtn(false);
    });
  }, [messages, aiStatus]);

  useEffect(() => {
    const prefill = location.state?.prefill;
    if (prefill && typeof prefill === 'string') {
      setInput(prefill);
      setTimeout(() => inputRef.current?.focus(), 30);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    if (!location.state?.newChat) return;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    stickToBottomRef.current = true;
    subjectRef.current = 'General';
    setLoading(false);
    setAiStatus(null);
    setMessages([]);
    setChatId(null);
    setInput('');
    navigate('/chat', { replace: true, state: null });
  }, [location.state, navigate]);

  // Cleanup timer interval on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      recognitionRef.current = null;
      return;
    }
    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = 'en-US';
    rec.maxAlternatives = 1;

    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setInput(prev => prev + (prev ? ' ' : '') + transcript);
      setIsListening(false);
    };
    rec.onerror = (ev) => {
      setIsListening(false);
      const code = ev.error;
      if (code === 'not-allowed') toast.error('Mic blocked — allow microphone for this site in browser settings.');
      else if (code === 'no-speech') toast.error('No speech detected. Try again.');
      else if (code === 'audio-capture') toast.error('No microphone found.');
      else toast.error(`Voice input: ${code || 'error'}`);
    };
    rec.onend = () => setIsListening(false);
    recognitionRef.current = rec;
  }, []);

  const stopSpeaking = useCallback(() => {
    synthRef.current?.cancel();
    setIsSpeaking(false);
    setSpeakingPaused(false);
    setSpeakingMsgIndex(null);
  }, []);

  const speakTextInternal = useCallback((text, msgIndex) => {
    if (!synthRef.current) return;
    synthRef.current.cancel();
    const plain = textForSpeech(text);
    if (!plain) return;
    const utt = new SpeechSynthesisUtterance(plain);
    utt.rate = 0.95;
    utt.pitch = 1;
    utt.onstart = () => {
      setIsSpeaking(true);
      setSpeakingPaused(false);
      setSpeakingMsgIndex(typeof msgIndex === 'number' ? msgIndex : null);
    };
    utt.onend = () => {
      setIsSpeaking(false);
      setSpeakingPaused(false);
      setSpeakingMsgIndex(null);
    };
    utt.onerror = () => {
      setIsSpeaking(false);
      setSpeakingPaused(false);
      setSpeakingMsgIndex(null);
    };
    synthRef.current.speak(utt);
  }, []);

  const speakMessageByIndex = useCallback((idx, content) => {
    speakTextInternal(content, idx);
  }, [speakTextInternal]);

  useEffect(() => {
    if (!aiStatus || aiStatus.kind !== 'typing_intro') return;
    pendingFullTextRef.current = aiStatus.fullText;
    const t = setTimeout(() => {
      const full = pendingFullTextRef.current;
      setAiStatus({ kind: 'streaming', full, shown: '' });
    }, TYPING_INTRO_MS);
    return () => clearTimeout(t);
  }, [aiStatus]);

  useEffect(() => {
    if (!aiStatus || aiStatus.kind !== 'streaming') return;
    const { full, shown } = aiStatus;
    if (shown.length >= full.length) {
      setMessages((prev) => {
        const idx = prev.length;
        const next = [...prev, { role: 'assistant', content: full }];
        queueMicrotask(() => {
          if (voiceEnabledRef.current) speakTextInternal(full, idx);
        });
        return next;
      });
      setAiStatus(null);
      setLoading(false);
      inputRef.current?.focus();
      return;
    }
    const timer = setTimeout(() => {
      setAiStatus((prev) =>
        prev?.kind === 'streaming'
          ? { ...prev, shown: prev.full.slice(0, prev.shown.length + 1) }
          : prev
      );
    }, CHAR_MS);
    return () => clearTimeout(timer);
  }, [aiStatus, speakTextInternal]);

  const pauseSpeaking = () => {
    const s = synthRef.current;
    if (!s?.speaking) return;
    try {
      s.pause();
      setSpeakingPaused(true);
    } catch {
      toast.error('Pause not supported for this voice');
    }
  };

  const resumeSpeaking = () => {
    try {
      synthRef.current?.resume();
      setSpeakingPaused(false);
    } catch { /* ignore */ }
  };

  const toggleVoiceInput = () => {
    const rec = recognitionRef.current;
    if (!rec) {
      toast.error('Voice input needs a Chromium browser (Chrome, Edge, Opera). Enable mic and try the 🎤 button.');
      return;
    }
    if (isListening) {
      try { rec.stop(); } catch { /* ignore */ }
      setIsListening(false);
      return;
    }
    try {
      rec.start();
      setIsListening(true);
    } catch (err) {
      setIsListening(false);
      toast.error('Could not start mic — click 🎤 again or check permissions.');
    }
  };

  const pickImage = useCallback((e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Choose an image file');
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      toast.error('Image too large (max 6 MB)');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAttachment({ dataUrl: reader.result, name: file.name });
    reader.readAsDataURL(file);
  }, []);

  const copyAssistantResponse = useCallback(async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied response');
    } catch {
      toast.error('Could not copy');
    }
  }, []);

  const stopGeneration = useCallback(() => {
    setAiStatus((prev) => {
      // Keep already-streamed text instead of discarding it when user presses Stop.
      if (prev?.kind === 'streaming') {
        const partial = (prev.shown || '').trim();
        if (partial) {
          setMessages((rows) => [...rows, { role: 'assistant', content: partial }]);
        }
      }
      return null;
    });
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setLoading(false);
    inputRef.current?.focus();
  }, []);

  const sendMessage = async (e) => {
    e?.preventDefault();
    const text = input.trim();
    const imageDataUrl = attachment?.dataUrl;
    if ((!text && !imageDataUrl) || loading) return;
    
    // Check if this is a command
    if (isCommand(text) && !imageDataUrl) {
      handleCommand(text);
      return;
    }
    
    // Regular API call
    const apiMessage = text || 'What is in this image?';
    const contentForUi = apiMessage + (imageDataUrl ? '\n\n📷 [Image attached]' : '');
    const userMsg = { role: 'user', content: contentForUi, imagePreview: imageDataUrl || undefined };
    stickToBottomRef.current = true;
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setAttachment(null);
    setLoading(true);
    setAiStatus({ kind: 'thinking' });
    const controller = new AbortController();
    abortControllerRef.current = controller;
    try {
      const res = await axios.post(
        '/chat/send',
        {
          message: apiMessage,
          chatId,
          noteContext: '',
          subject: subjectRef.current,
          imageUrls: imageDataUrl ? [imageDataUrl] : undefined,
        },
        { signal: controller.signal }
      );
      abortControllerRef.current = null;
      const { chatId: newId, message, chat: chatMeta } = res.data;
      if (chatMeta?.subject) subjectRef.current = chatMeta.subject;
      if (!chatId) {
        setChatId(newId);
        navigate(`/chat/${newId}`, { replace: true });
      }
      setAiStatus({ kind: 'typing_intro', fullText: message });
    } catch (err) {
      abortControllerRef.current = null;
      const canceled =
        axios.isCancel?.(err) ||
        err.code === 'ERR_CANCELED' ||
        err.name === 'CanceledError' ||
        err.name === 'AbortError';
      if (canceled) {
        setAiStatus(null);
        setLoading(false);
        return;
      }
      setAiStatus(null);
      setLoading(false);
      toast.error(err.response?.data?.message || 'Failed to get response');
      setMessages(prev => prev.slice(0, -1));
    }
    inputRef.current?.focus();
  };

  const handleCommand = (commandText) => {
  const userMsg = { role: 'user', content: commandText };
  stickToBottomRef.current = true;
  setMessages(prev => [...prev, userMsg]);
  setInput('');
  setShowCommandSuggestions(false);
  
  const result = executeCommand(commandText);
  
  // Add command result as a system message
  const commandMsg = {
    role: 'system',
    content: '',
    commandResult: result
  };
  
  setMessages(prev => [...prev, commandMsg]);
  
  // Handle timer-specific logic
  if (result.success && result.command === 'timer' && result.type === 'timer_start') {
    startTimer(result.duration.seconds);
  }
  
  inputRef.current?.focus();
};

const handleInputChange = (e) => {
  const value = e.target.value;
  setInput(value);
  
  // Handle command suggestions
  if (value.startsWith('/')) {
    const suggestions = getCommandSuggestions(value);
    setCommandSuggestions(suggestions);
    setShowCommandSuggestions(suggestions.length > 0);
  } else {
    setShowCommandSuggestions(false);
  }
};

const handleCommandSuggestionClick = (command) => {
  setInput(command + ' ');
  setShowCommandSuggestions(false);
  inputRef.current?.focus();
};

const startTimer = (totalSeconds) => {
  // Clear any existing timer
  if (timerIntervalRef.current) {
    clearInterval(timerIntervalRef.current);
  }
  
  const newState = {
    isRunning: true,
    isPaused: false,
    remainingSeconds: totalSeconds,
    totalSeconds
  };
  setTimerState(newState);
  window.dispatchEvent(new CustomEvent('timerUpdate', { detail: newState }));
  
  // Start countdown
  timerIntervalRef.current = setInterval(() => {
    setTimerState(prev => {
      if (prev.remainingSeconds <= 1) {
        // Timer completed
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
        // Play a sound notification (if possible) or show completion message
        try {
          const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT');
          audio.play().catch(() => {}); // Ignore audio errors
        } catch (e) {}
        
        const completedState = {
          ...prev,
          isRunning: false,
          remainingSeconds: 0
        };
        window.dispatchEvent(new CustomEvent('timerUpdate', { detail: completedState }));
        return completedState;
      }
      
      const updatedState = {
        ...prev,
        remainingSeconds: prev.remainingSeconds - 1
      };
      window.dispatchEvent(new CustomEvent('timerUpdate', { detail: updatedState }));
      return updatedState;
    });
  }, 1000);
};

const pauseTimer = () => {
  if (timerIntervalRef.current) {
    clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = null;
  }
  const pausedState = {
    ...timerState,
    isRunning: false,
    isPaused: true
  };
  setTimerState(pausedState);
  window.dispatchEvent(new CustomEvent('timerUpdate', { detail: pausedState }));
};

const resumeTimer = () => {
  if (timerState.remainingSeconds > 0 && !timerState.isRunning) {
    const resumedState = {
      ...timerState,
      isRunning: true,
      isPaused: false
    };
    setTimerState(resumedState);
    window.dispatchEvent(new CustomEvent('timerUpdate', { detail: resumedState }));
    
    timerIntervalRef.current = setInterval(() => {
      setTimerState(prev => {
        if (prev.remainingSeconds <= 1) {
          if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
          }
          const completedState = {
            ...prev,
            isRunning: false,
            remainingSeconds: 0
          };
          window.dispatchEvent(new CustomEvent('timerUpdate', { detail: completedState }));
          return completedState;
        }
        const updatedState = {
          ...prev,
          remainingSeconds: prev.remainingSeconds - 1
        };
        window.dispatchEvent(new CustomEvent('timerUpdate', { detail: updatedState }));
        return updatedState;
      });
    }, 1000);
  }
};

const resetTimer = () => {
  if (timerIntervalRef.current) {
    clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = null;
  }
  const resetState = {
    isRunning: false,
    isPaused: false,
    remainingSeconds: 0,
    totalSeconds: 0
  };
  setTimerState(resetState);
  window.dispatchEvent(new CustomEvent('timerUpdate', { detail: resetState }));
};

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// Expose timer functions globally for the LiveTimer component
useEffect(() => {
  window.startTimer = startTimer;
  window.pauseTimer = pauseTimer;
  window.resumeTimer = resumeTimer;
  window.resetTimer = resetTimer;
  window.getTimerState = () => timerState;

  return () => {
    delete window.startTimer;
    delete window.pauseTimer;
    delete window.resumeTimer;
    delete window.resetTimer;
    delete window.getTimerState;
  };
}, [timerState]);

const handleKeyDown = (e) => { 
  if (e.key === 'Enter' && !e.shiftKey) { 
    e.preventDefault(); 
    sendMessage(e); 
  } else if (e.key === 'Escape') {
    setShowCommandSuggestions(false);
  } else if (e.key === 'ArrowDown' && showCommandSuggestions) {
    e.preventDefault();
    // Navigate suggestions (simplified - could be enhanced)
  }
};

  return (
    <div className="chat-layout">
      <div className="chat-main">
        {isSpeaking && (
          <div className="aurora-speaking-bar" role="status">
            <span className="aurora-speaking-label">🔊 Aurora is speaking…</span>
            <div className="aurora-speaking-actions">
              {speakingPaused ? (
                <button type="button" className="speech-action-btn" onClick={resumeSpeaking} title="Resume">▶</button>
              ) : (
                <button type="button" className="speech-action-btn" onClick={pauseSpeaking} title="Pause">⏸</button>
              )}
              <button type="button" className="speech-action-btn speech-stop" onClick={stopSpeaking} title="Stop">⏹</button>
            </div>
          </div>
        )}

        <div
          className={[
            'messages-area',
            attachment && 'messages-area--has-attachment',
            isListening && 'messages-area--listening',
          ].filter(Boolean).join(' ')}
          ref={messagesAreaRef}
          onScroll={updateStickToBottomFromScroll}
        >
          {messages.length === 0 && !loading && !threadLoading ? (
            <div className="chat-welcome">
              <div className="welcome-icon">◈</div>
              <h2>Aurora</h2>
              <p>Ask me anything about your studies. I can explain concepts,<br/>solve problems, and help you understand any topic.</p>
              <div className="starter-prompts">
                {["Explain Newton's laws of motion", "What is photosynthesis?", "Help me understand quadratic equations", "Summarize World War II causes"].map(p => (
                  <button key={p} type="button" className="starter-btn" onClick={() => { setInput(p); inputRef.current?.focus(); }}>{p}</button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <div key={i} className={`message ${msg.role}`}>
                  <div className="message-avatar">
                    {msg.role === 'user' ? (
                      <UserBubbleAvatar user={user} />
                    ) : msg.role === 'system' ? (
                      '⚡'
                    ) : (
                      '◈'
                    )}
                  </div>
                  <div
                    className={`message-bubble ${msg.role === 'assistant' && speakingMsgIndex === i ? 'message-bubble-speaking' : ''} ${msg.role === 'system' ? 'message-bubble-system' : ''}`}
                  >
                    {msg.role === 'system' && msg.commandResult ? (
                      <CommandResult result={msg.commandResult} />
                    ) : msg.role === 'assistant' ? (
                      <div className="markdown"><ReactMarkdown>{normalizeAssistantMarkdown(msg.content)}</ReactMarkdown></div>
                    ) : (
                      <div className="user-msg-body">
                        {msg.imagePreview && (
                          <img src={msg.imagePreview} alt="" className="msg-user-thumb" />
                        )}
                        <UserBubbleText content={msg.content} hasImage={!!msg.imagePreview} />
                      </div>
                    )}
                    {msg.role === 'assistant' && (
                      <div className="msg-actions-row">
                        <button
                          type="button"
                          className="msg-action-btn"
                          onClick={() => copyAssistantResponse(msg.content)}
                          title="Copy response"
                        >
                          <IconCopy />
                        </button>
                        <button
                          type="button"
                          className="msg-action-btn msg-action-label"
                          onClick={() => speakMessageByIndex(i, msg.content)}
                          title="Read aloud"
                        >
                          🔊
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {aiStatus?.kind === 'thinking' && (
                <div className="message assistant ai-phase-message">
                  <div className="message-avatar aurora-avatar-pulse">◈</div>
                  <div className="message-bubble ai-status-bubble">
                    <div className="aurora-status-row">
                      <span className="aurora-status-text">{THINKING_MESSAGE}</span>
                      <span className="thinking-dots" aria-hidden><span/><span/><span/></span>
                    </div>
                  </div>
                </div>
              )}

              {aiStatus?.kind === 'typing_intro' && (
                <div className="message assistant ai-phase-message">
                  <div className="message-avatar aurora-avatar-pulse">◈</div>
                  <div className="message-bubble ai-status-bubble ai-typing-intro">
                    <span className="aurora-status-text">Aurora is typing…</span>
                    <span className="typing-cursor-inline" aria-hidden>▍</span>
                  </div>
                </div>
              )}

              {aiStatus?.kind === 'streaming' && (
                <div className="message assistant ai-phase-message">
                  <div className="message-avatar">◈</div>
                  <div className="message-bubble ai-stream-bubble">
                    <div className="streaming-plain">{aiStatus.shown}<span className="typing-cursor" aria-hidden>▍</span></div>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={bottomRef} />
        </div>

        {showScrollToBottomBtn && (
          <button
            type="button"
            className="chat-scroll-bottom-btn"
            onClick={scrollToBottomSmooth}
            title="Jump to latest message"
            aria-label="Scroll to latest message"
          >
            <IconChevronDown />
          </button>
        )}

        <form className="chat-input-form" onSubmit={sendMessage}>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="visually-hidden"
            aria-hidden
            tabIndex={-1}
            onChange={pickImage}
          />
          {attachment && (
            <div className="attachment-chip">
              <img src={attachment.dataUrl} alt="" className="attachment-chip-img" />
              <span className="attachment-chip-name">{attachment.name}</span>
              <button type="button" className="attachment-chip-remove" onClick={() => setAttachment(null)} aria-label="Remove image">×</button>
            </div>
          )}
          <div className="chat-input-composer">
            <div className="chat-input-pill">
              <button
                type="button"
                className="composer-plus-btn"
                onClick={() => imageInputRef.current?.click()}
                disabled={loading}
                title="Add photos"
                aria-label="Add photos"
              >
                <IconPlus />
              </button>
              <div className="textarea-wrapper">
                <textarea
                  ref={inputRef}
                  className="chat-textarea chat-textarea-composer"
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything or type / for commands"
                  rows={1}
                />
                {showCommandSuggestions && (
                  <div className="command-suggestions">
                    {commandSuggestions.map((suggestion, index) => (
                      <div
                        key={suggestion.command}
                        className="command-suggestion-item"
                        onClick={() => handleCommandSuggestionClick(suggestion.command)}
                      >
                        <span className="command-icon">{suggestion.icon}</span>
                        <span className="command-name">{suggestion.command}</span>
                        <span className="command-desc">{suggestion.description}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className={`mic-wrap composer-mic-wrap ${isListening ? 'mic-wrap-active' : ''}`}>
                {isListening && <span className="mic-ring" aria-hidden />}
                {isListening && <span className="mic-ring mic-ring-delay" aria-hidden />}
                <button
                  type="button"
                  className={`mic-btn composer-mic-btn ${isListening ? 'listening' : ''}`}
                  onClick={toggleVoiceInput}
                  title={isListening ? 'Stop listening' : 'Voice input'}
                >
                  {isListening ? '⏹' : '🎤'}
                </button>
              </div>
            </div>
            {loading ? (
              <button
                type="button"
                className="send-btn composer-send-btn stop-btn"
                onClick={stopGeneration}
                title="Stop generating"
                aria-label="Stop generating"
              >
                ■
              </button>
            ) : (
              <button
                type="submit"
                className="send-btn composer-send-btn"
                disabled={!input.trim() && !attachment}
                title="Send"
                aria-label="Send"
              >
                <IconSend />
              </button>
            )}
          </div>
          {isListening && (
            <div className="listening-bar listening-bar-premium">
              <span className="listening-glow">Listening…</span>
              <span className="listening-hint">Speak clearly — release when done</span>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

function UserBubbleAvatar({ user }) {
  const letter = user?.name?.trim()?.[0]?.toUpperCase() || '?';
  if (user?.avatar) {
    return <img src={user.avatar} alt="" className="message-avatar-photo" />;
  }
  return letter;
}

function UserBubbleText({ content, hasImage }) {
  const shown = hasImage ? content.replace(/\n\n📷 \[Image attached]$/, '').trim() : content;
  if (!shown) return null;
  return <p>{shown}</p>;
}

function IconChevronDown() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function IconCopy() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function LiveTimer() {
  const [timerState, setTimerState] = React.useState({
    isRunning: false,
    isPaused: false,
    remainingSeconds: 0,
    totalSeconds: 0
  });

  React.useEffect(() => {
    // Listen for timer updates from window
    const handleTimerUpdate = (event) => {
      setTimerState(event.detail);
    };

    window.addEventListener('timerUpdate', handleTimerUpdate);
    
    // Get initial timer state
    if (window.getTimerState) {
      setTimerState(window.getTimerState());
    }

    return () => {
      window.removeEventListener('timerUpdate', handleTimerUpdate);
    };
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (timerState.totalSeconds === 0) {
    return null;
  }

  return (
    <div className="timer-result">
      <div className="timer-display">
        <div className="timer-icon">⏱️</div>
        <div className="timer-time">{formatTime(timerState.remainingSeconds)}</div>
      </div>
      <div className="timer-controls">
        {!timerState.isRunning ? (
          <button className="timer-btn timer-btn-resume" onClick={() => window.resumeTimer?.()}>
            ▶ Resume
          </button>
        ) : (
          <button className="timer-btn timer-btn-pause" onClick={() => window.pauseTimer?.()}>
            ⏸ Pause
          </button>
        )}
        <button className="timer-btn timer-btn-reset" onClick={() => window.resetTimer?.()}>
          ⏹ Reset
        </button>
      </div>
    </div>
  );
}

function CommandResult({ result }) {

  if (!result.success) {
    return (
      <div className="command-result command-error">
        <div className="command-header">
          <span className="command-icon">⚠️</span>
          <span className="command-title">Command Error</span>
        </div>
        <div className="command-error-message">{result.error}</div>
      </div>
    );
  }

  const renderCommandContent = () => {
    switch (result.command) {
      case 'timer':
        return <LiveTimer />;
      
      case 'todo':
        if (result.action === 'list') {
          const tasks = result.tasks || { all: [], summary: { pending: 0, completed: 0 } };
          return (
            <div className="todo-result">
              <div className="todo-summary">
                <span className="todo-count">{tasks.summary?.pending || 0} pending</span>
                <span className="todo-count">{tasks.summary?.completed || 0} completed</span>
              </div>
              {tasks.all && tasks.all.length > 0 && (
                <div className="todo-list">
                  {tasks.all.map(task => (
                    <div key={task.id} className={`todo-item ${task.completed ? 'completed' : ''}`}>
                      <span className="todo-status">{task.completed ? '✅' : '⭕'}</span>
                      <span className="todo-text">{task.text || 'Untitled task'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        } else {
          return (
            <div className="todo-result">
              <div className="command-success-message">{result.message || 'Task operation completed'}</div>
            </div>
          );
        }
      
      case 'gpa':
        if (result.action === 'calculate') {
          return (
            <div className="gpa-result">
              <div className="gpa-display">
                <div className="gpa-value">{result.result.gpa}</div>
                <div className="gpa-label">GPA</div>
              </div>
              <div className="gpa-details">
                <div className="gpa-detail-item">
                  <span className="gpa-detail-label">Total Credits:</span>
                  <span className="gpa-detail-value">{result.result.totalCredits}</span>
                </div>
                <div className="gpa-detail-item">
                  <span className="gpa-detail-label">Graded Courses:</span>
                  <span className="gpa-detail-value">{result.result.gradedCourses}</span>
                </div>
              </div>
            </div>
          );
        } else if (result.action === 'show') {
          return (
            <div className="gpa-result">
              <div className="gpa-summary">
                {result.courses.summary.gpa && (
                  <div className="current-gpa">
                    Current GPA: <span className="gpa-highlight">{result.courses.summary.gpa}</span>
                  </div>
                )}
                <div className="course-counts">
                  <span>{result.courses.summary.graded} graded</span>
                  <span>{result.courses.summary.inProgress} in progress</span>
                </div>
              </div>
              {result.courses.all.length > 0 && (
                <div className="course-list">
                  {result.courses.all.map(course => (
                    <div key={course.id} className="course-item">
                      <span className="course-name">{course.name}</span>
                      <span className="course-credits">{course.credits} cr</span>
                      <span className="course-grade">{course.grade || 'IP'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        } else {
          return (
            <div className="gpa-result">
              <div className="command-success-message">{result.message}</div>
            </div>
          );
        }
      
      default:
        return <div className="command-success-message">{result.message || 'Command executed successfully'}</div>;
    }
  };

  return (
    <div className="command-result">
      <div className="command-header">
        <span className="command-icon">{result.icon}</span>
        <span className="command-title">{result.description}</span>
      </div>
      {renderCommandContent()}
    </div>
  );
}

function IconSend() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
  );
}
