// ---------- ids & dates ----------
export const uid = () =>
  globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

const pad = (n) => String(n).padStart(2, '0');

// All days are local-time 'YYYY-MM-DD' strings.
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayKey = () => dayKey(new Date());
export const parseDay = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (key, n) => {
  const d = parseDay(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
};
export const daysUntil = (key) => Math.round((parseDay(key) - parseDay(todayKey())) / 86400000);
export const formatDay = (key, opts = { weekday: 'short', day: 'numeric', month: 'short' }) =>
  parseDay(key).toLocaleDateString(undefined, opts);
export const lastDays = (n) => {
  const t = todayKey();
  return Array.from({ length: n }, (_, i) => addDays(t, i - (n - 1)));
};

// ---------- formatting ----------
export const formatMinutes = (min) => {
  const m = Math.round(min || 0);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
};
export const formatClock = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
};
export const formatTime = (sec) => {
  const s = Math.max(0, Math.floor(sec || 0));
  return `${Math.floor(s / 60)}:${pad(s % 60)}`;
};

// ---------- constants ----------
export const COLORS = ['#f5e79d', '#ffbd87', '#f28f82', '#d96f91', '#a65c9f', '#5b539f'];
export const DIFFICULTY = [
  { v: 1, label: 'Easy' },
  { v: 2, label: 'Medium' },
  { v: 3, label: 'Hard' },
];
export const STATUSES = ['Not started', 'Learning', 'Revising', 'Mastered'];
export const STATUS_WEIGHT = { 'Not started': 0, Learning: 0.33, Revising: 0.66, Mastered: 1 };

// ---------- subjects ----------
// Upcoming exams first (soonest first), finished exams last.
export const sortByExam = (subjects) => {
  const upcoming = (s) => (daysUntil(s.examDate) >= 0 ? 1 : 0);
  return [...subjects].sort((a, b) => upcoming(b) - upcoming(a) || a.examDate.localeCompare(b.examDate));
};

// ---------- sessions / streak ----------
export const minutesOnDay = (sessions, day) =>
  sessions.filter((s) => s.day === day).reduce((a, s) => a + s.seconds, 0) / 60;

export const studiedDaySet = (state) => {
  const set = new Set(Object.keys(state.studiedDays).filter((k) => state.studiedDays[k]));
  for (const s of state.sessions) if (s.seconds >= 60) set.add(s.day);
  return set;
};

export const computeStreak = (set) => {
  const today = todayKey();
  const studiedToday = set.has(today);
  // If you haven't studied yet today, the streak is still alive until midnight.
  let cursor = studiedToday ? today : addDays(today, -1);
  let current = 0;
  while (set.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }
  let best = 0;
  let run = 0;
  let prev = null;
  for (const d of [...set].sort()) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return { current, best, studiedToday };
};

// ---------- topics ----------
// One topic per line. Optional extras: "Topic name | hard | 90"  (difficulty | minutes)
export const parseTopicLines = (text) =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [rawName, diff, mins] = line.split('|').map((p) => p.trim());
      const d = (diff || '').toLowerCase()[0];
      const difficulty = d === 'e' ? 1 : d === 'h' ? 3 : d === 'm' ? 2 : undefined;
      const n = Number(mins);
      return {
        name: (rawName || '').replace(/^(?:[-*•]|\d+[.)])\s+/, ''),
        difficulty,
        allotMin: mins && Number.isFinite(n) ? n : undefined,
      };
    })
    .filter((t) => t.name);

// Spread a total time budget over topics, weighted by difficulty (1:2:3), rounded to 5 min.
export const autoAllot = (topics, totalMin) => {
  const w = (t) => ({ 1: 1, 2: 2, 3: 3 })[t.difficulty] || 2;
  const sum = topics.reduce((a, t) => a + w(t), 0) || 1;
  return topics.map((t) => ({
    id: t.id,
    allotMin: Math.max(5, Math.round((totalMin * w(t)) / sum / 5) * 5),
  }));
};
