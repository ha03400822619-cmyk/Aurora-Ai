const GAME_PROGRESS_KEY = 'aurora-game-progress';
const GAME_PROGRESS_EVENT = 'aurora-game-progress-changed';
const XP_PER_LEVEL = 1000;
const FREE_XP_COOLDOWN_MS = 15 * 60 * 1000;

const DEFAULT_PROGRESS = {
  xp: 620,
  totalActions: 0,
  lastAction: 'Welcome bonus',
  nextFreeXpAt: 0,
  updatedAt: new Date().toISOString()
};

function toNumber(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function sanitizeProgress(raw) {
  const xp = Math.max(0, toNumber(raw?.xp, DEFAULT_PROGRESS.xp));
  const totalActions = Math.max(0, Math.trunc(toNumber(raw?.totalActions, DEFAULT_PROGRESS.totalActions)));
  return {
    xp,
    totalActions,
    lastAction: raw?.lastAction || DEFAULT_PROGRESS.lastAction,
    nextFreeXpAt: Math.max(0, Math.trunc(toNumber(raw?.nextFreeXpAt, DEFAULT_PROGRESS.nextFreeXpAt))),
    updatedAt: raw?.updatedAt || DEFAULT_PROGRESS.updatedAt
  };
}

function emitGameProgress(progress) {
  window.dispatchEvent(new CustomEvent(GAME_PROGRESS_EVENT, { detail: progress }));
}

export function getGameProgress() {
  try {
    const saved = window.localStorage.getItem(GAME_PROGRESS_KEY);
    if (!saved) return DEFAULT_PROGRESS;
    return sanitizeProgress(JSON.parse(saved));
  } catch {
    return DEFAULT_PROGRESS;
  }
}

function setGameProgress(nextProgress) {
  const progress = sanitizeProgress(nextProgress);
  window.localStorage.setItem(GAME_PROGRESS_KEY, JSON.stringify(progress));
  emitGameProgress(progress);
  return progress;
}

export function awardXp(amount, reason = 'Progress update') {
  const safeAmount = Math.max(0, toNumber(amount, 0));
  const current = getGameProgress();
  const previousLevel = getLevelFromXp(current.xp);
  const nextProgress = setGameProgress({
    ...current,
    xp: current.xp + safeAmount,
    totalActions: current.totalActions + 1,
    lastAction: reason,
    updatedAt: new Date().toISOString()
  });
  const nextLevel = getLevelFromXp(nextProgress.xp);
  return {
    progress: nextProgress,
    gained: safeAmount,
    levelBefore: previousLevel,
    levelAfter: nextLevel,
    leveledUp: nextLevel > previousLevel
  };
}

export function getLevelFromXp(xp) {
  return Math.floor(Math.max(0, xp) / XP_PER_LEVEL) + 1;
}

export function getXpWithinLevel(xp) {
  return Math.max(0, xp) % XP_PER_LEVEL;
}

export function getXpPerLevel() {
  return XP_PER_LEVEL;
}

function getFreeXpCooldownMs() {
  return FREE_XP_COOLDOWN_MS;
}

function getFreeXpRemainingMs(progress = getGameProgress()) {
  return Math.max(0, progress.nextFreeXpAt - Date.now());
}

export function claimFreeXpBonus(amount = 15, reason = 'Free XP claimed') {
  const current = getGameProgress();
  const remainingMs = getFreeXpRemainingMs(current);
  if (remainingMs > 0) {
    return {
      success: false,
      remainingMs,
      cooldownMs: getFreeXpCooldownMs()
    };
  }

  const safeAmount = Math.max(0, toNumber(amount, 0));
  const levelBefore = getLevelFromXp(current.xp);
  const nextProgress = setGameProgress({
    ...current,
    xp: current.xp + safeAmount,
    totalActions: current.totalActions + 1,
    lastAction: reason,
    nextFreeXpAt: Date.now() + FREE_XP_COOLDOWN_MS,
    updatedAt: new Date().toISOString()
  });
  const levelAfter = getLevelFromXp(nextProgress.xp);

  return {
    success: true,
    gained: safeAmount,
    progress: nextProgress,
    levelBefore,
    levelAfter,
    leveledUp: levelAfter > levelBefore,
    cooldownMs: getFreeXpCooldownMs(),
    remainingMs: getFreeXpRemainingMs(nextProgress)
  };
}

export function onGameProgressChange(listener) {
  const handler = (event) => listener(event.detail || getGameProgress());
  window.addEventListener(GAME_PROGRESS_EVENT, handler);
  return () => window.removeEventListener(GAME_PROGRESS_EVENT, handler);
}
