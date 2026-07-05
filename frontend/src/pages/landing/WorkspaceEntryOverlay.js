import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const STATUS_INIT = 'Initializing Aurora…';
const STATUS_LOAD = 'Loading workspace…';

export default function WorkspaceEntryOverlay({ open, onFinished }) {
  const [status, setStatus] = useState(STATUS_INIT);
  const finishedRef = useRef(false);

  useEffect(() => {
    if (!open) {
      setStatus(STATUS_INIT);
      finishedRef.current = false;
      return undefined;
    }
    finishedRef.current = false;
    const t1 = window.setTimeout(() => setStatus(STATUS_LOAD), 520);
    const t2 = window.setTimeout(() => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      onFinished?.();
    }, 1680);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [open, onFinished]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="workspace-entry-layer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          aria-hidden
        >
          <motion.div
            className="workspace-entry-dim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.62 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          />
          <motion.div
            className="workspace-entry-glow"
            initial={{ scale: 0.15, opacity: 0 }}
            animate={{ scale: 2.85, opacity: 0.92 }}
            transition={{ duration: 0.78, ease: [0.16, 1, 0.3, 1] }}
          />
          <div className="workspace-entry-logo-wrap">
            <motion.img
              src="/aurora-brand-template.png"
              alt=""
              className="workspace-entry-logo"
              initial={{ opacity: 0, scale: 0.88, filter: 'blur(6px)' }}
              animate={{
                opacity: [0, 1, 1, 0.95],
                scale: [0.88, 1, 1.65, 2.35],
                filter: ['blur(6px)', 'blur(0px)', 'blur(0px)', 'blur(8px)'],
                y: [0, 0, 0, -12],
              }}
              transition={{
                duration: 1.55,
                times: [0, 0.12, 0.45, 1],
                ease: [0.22, 1, 0.36, 1],
              }}
            />
            <motion.p
              key={status}
              className="workspace-entry-status"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.28 }}
            >
              {status}
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
