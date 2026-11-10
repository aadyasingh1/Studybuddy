import { useCallback, useEffect, useRef, useState } from 'react';
import { formatClock } from './utils';

// Pomodoro timer. It is timestamp-based (endsAt), so it stays accurate when the tab is
// in the background, and it survives a page refresh (state is kept in localStorage).

const KEY = 'study-planner-timer-v1';

const IDLE = {
  phase: 'focus', // 'focus' | 'break'
  status: 'idle', // 'idle' | 'running' | 'paused'
  endsAt: null,
  remainingMs: null,
  totalMs: null,
  subjectId: null,
  topicId: null,
};

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw && raw.phase) return { ...IDLE, ...raw };
  } catch {
    /* ignore */
  }
  return IDLE;
}

// ---- sound + notifications ----
let audioCtx = null;
function primeAudio() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch {
    /* ignore */
  }
}
function beep() {
  try {
    primeAudio();
    const ctx = audioCtx;
    [0, 0.28, 0.56].forEach((delay, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const t0 = ctx.currentTime + delay;
      o.type = 'sine';
      o.frequency.value = i === 2 ? 1046 : 784;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.3, t0 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.24);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(t0);
      o.stop(t0 + 0.26);
    });
  } catch {
    /* ignore */
  }
}
function askNotify() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
}
function notify(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, { body });
    } catch {
      /* ignore */
    }
  }
}

// Re-renders the calling component while `enabled` — used only by components that show a clock,
// so the rest of the app doesn't re-render 4x a second.
export function useTick(enabled, ms = 250) {
  const [, set] = useState(0);
  useEffect(() => {
    if (!enabled) return undefined;
    const id = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [enabled, ms]);
}

export function useTimer({ settings, logSession }) {
  const [t, setT] = useState(load);
  const [notice, setNotice] = useState(null);
  const tRef = useRef(t);
  const settingsRef = useRef(settings);
  const logRef = useRef(logSession);
  settingsRef.current = settings;
  logRef.current = logSession;

  // single writer: keeps the ref in sync immediately so a double tick can't double-log
  const commit = useCallback((next) => {
    tRef.current = next;
    setT(next);
  }, []);

  const phaseMs = (phase) => (phase === 'focus' ? settingsRef.current.focusMin : settingsRef.current.breakMin) * 60000;
  const say = useCallback((text) => setNotice({ id: Date.now() + Math.random(), text }), []);

  const getRemainingMs = useCallback(() => {
    const c = tRef.current;
    if (c.status === 'running') return Math.max(0, c.endsAt - Date.now());
    if (c.status === 'paused') return c.remainingMs;
    return phaseMs(c.phase);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getTotalMs = useCallback(() => {
    const c = tRef.current;
    return c.status === 'idle' ? phaseMs(c.phase) : c.totalMs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const complete = useCallback(() => {
    const cur = tRef.current;
    if (cur.status !== 'running') return;
    if (cur.phase === 'focus') {
      logRef.current({ subjectId: cur.subjectId, topicId: cur.topicId, seconds: cur.totalMs / 1000 });
      const mins = Math.round(cur.totalMs / 60000);
      beep();
      notify('Focus session complete', `${mins} min logged. Time for a break.`);
      say(`Focus complete — ${mins} min logged. Break time!`);
      const ms = phaseMs('break');
      commit({ ...cur, phase: 'break', status: 'running', totalMs: ms, remainingMs: ms, endsAt: Date.now() + ms });
    } else {
      beep();
      notify('Break over', 'Ready for another focus session?');
      say('Break over — ready for the next round?');
      commit({ ...cur, phase: 'focus', status: 'idle', totalMs: null, remainingMs: null, endsAt: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commit, say]);

  // Completion checker + tab-title countdown (no React state → no re-renders)
  useEffect(() => {
    if (t.status !== 'running') {
      document.title = 'Study Planner';
      return undefined;
    }
    const tick = () => {
      const cur = tRef.current;
      if (cur.status !== 'running') return;
      if (Date.now() >= cur.endsAt) {
        complete();
        return;
      }
      document.title = `${formatClock(cur.endsAt - Date.now())} · ${cur.phase === 'focus' ? 'Focus' : 'Break'}`;
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [t.status, t.phase, complete]);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(t));
    } catch {
      /* ignore */
    }
  }, [t]);

  const start = useCallback(() => {
    const cur = tRef.current;
    if (cur.status === 'running') return;
    if (cur.status === 'paused') {
      commit({ ...cur, status: 'running', endsAt: Date.now() + cur.remainingMs });
    } else {
      const ms = phaseMs(cur.phase);
      commit({ ...cur, status: 'running', totalMs: ms, remainingMs: ms, endsAt: Date.now() + ms });
    }
    primeAudio();
    askNotify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commit]);

  const pause = useCallback(() => {
    const cur = tRef.current;
    if (cur.status !== 'running') return;
    commit({ ...cur, status: 'paused', remainingMs: Math.max(0, cur.endsAt - Date.now()), endsAt: null });
  }, [commit]);

  // Stop / reset. During focus, any elapsed time of 1+ minute is still logged.
  // During a break this is "skip break".
  const stop = useCallback(() => {
    const cur = tRef.current;
    if (cur.status === 'idle') return;
    if (cur.phase === 'focus') {
      const left = cur.status === 'running' ? Math.max(0, cur.endsAt - Date.now()) : cur.remainingMs;
      const elapsedMs = cur.totalMs - left;
      if (elapsedMs >= 60000) {
        logRef.current({ subjectId: cur.subjectId, topicId: cur.topicId, seconds: elapsedMs / 1000 });
        say(`Stopped — ${Math.round(elapsedMs / 60000)} min logged.`);
      }
    }
    commit({ ...cur, phase: 'focus', status: 'idle', totalMs: null, remainingMs: null, endsAt: null });
  }, [commit, say]);

  const setTarget = useCallback(
    (subjectId, topicId) => {
      const cur = tRef.current;
      if (cur.status !== 'idle') return;
      if (cur.subjectId === subjectId && cur.topicId === topicId) return;
      commit({ ...cur, subjectId, topicId });
    },
    [commit],
  );

  return {
    phase: t.phase,
    status: t.status,
    subjectId: t.subjectId,
    topicId: t.topicId,
    notice,
    getRemainingMs,
    getTotalMs,
    start,
    pause,
    stop,
    setTarget,
  };
}
