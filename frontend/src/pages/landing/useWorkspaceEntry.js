import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import WorkspaceEntryOverlay from './WorkspaceEntryOverlay';
import { playWorkspaceEntrySound } from './playWorkspaceEntrySound';

const STORAGE_KEY = 'aurora-workspace-entry';

export function useWorkspaceEntry() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const onFinished = useCallback(() => {
    setOpen(false);
    if (user) {
      try {
        sessionStorage.setItem(STORAGE_KEY, '1');
      } catch {
        /* ignore */
      }
      navigate('/dashboard');
    } else {
      navigate('/login');
    }
  }, [navigate, user]);

  const start = useCallback(
    (e) => {
      const btn = e?.currentTarget;
      if (btn) {
        const rect = btn.getBoundingClientRect();
        btn.style.setProperty('--rx', `${((e.clientX - rect.left) / rect.width) * 100}%`);
        btn.style.setProperty('--ry', `${((e.clientY - rect.top) / rect.height) * 100}%`);
        btn.classList.add('is-pressing');
        window.setTimeout(() => btn.classList.remove('is-pressing'), 380);
      }
      playWorkspaceEntrySound();
      setOpen(true);
    },
    []
  );

  const overlay = <WorkspaceEntryOverlay open={open} onFinished={onFinished} />;

  return { start, overlay };
}
