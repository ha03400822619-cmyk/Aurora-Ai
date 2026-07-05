import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useWorkspaceEntry } from './useWorkspaceEntry';
import './landingShared.css';
import './IntroPage.css';

const stagger = {
  animate: {
    transition: { staggerChildren: 0.1, delayChildren: 0.08 },
  },
};

const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

const logoMotion = {
  initial: { opacity: 0, scale: 0.9, filter: 'blur(8px)' },
  animate: {
    opacity: 1,
    scale: 1,
    filter: 'blur(0px)',
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  },
};

const glowMotion = {
  initial: { opacity: 0, scale: 0.85 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.65, delay: 0.08, ease: [0.22, 1, 0.36, 1] },
  },
};

export default function IntroPage() {
  const { start, overlay } = useWorkspaceEntry();

  return (
    <div className="landing-body intro-page">
      {overlay}
      <div className="landing-particles" aria-hidden />
      <div className="landing-inner">
        <motion.div
          className="intro-hero"
          variants={stagger}
          initial="initial"
          animate="animate"
        >
          <div className="intro-logo-block">
            <motion.div
              className="intro-logo-glow"
              variants={glowMotion}
              initial="initial"
              animate="animate"
              aria-hidden
            />
            <motion.img
              src="/aurora-brand-template.png"
              alt="Aurora"
              className="intro-logo-img"
              variants={logoMotion}
              initial="initial"
              animate="animate"
            />
          </div>

          <motion.h1 className="intro-title" variants={fadeUp}>
            Aurora
          </motion.h1>
          <motion.p className="intro-tagline" variants={fadeUp}>
            Your AI Study Copilot
          </motion.p>

          <motion.div className="intro-actions" variants={fadeUp}>
            <Link to="/explore" className="landing-btn-secondary intro-link-btn">
              Explore
            </Link>
            <button type="button" className="landing-btn-primary" onClick={start}>
              Enter Workspace
            </button>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
