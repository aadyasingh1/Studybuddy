import { useEffect, useRef, useState } from 'react';
import { useStore } from './store';
import { useTick, useTimer } from './useTimer';
import { exportBackup, importBackup, requestPersistence } from './db';
import { computeStreak, daysUntil, formatClock, sortByExam, studiedDaySet, todayKey } from './utils';
import Dashboard from './Dashboard';
import SubjectView from './SubjectView';
import DailyView from './DailyView';
import TimerView from './TimerView';
import PodcastView from './PodcastView';

const NAV = [
  { id: 'dashboard', label: 'Overview' },
  { id: 'daily', label: 'Today' },
  { id: 'timer', label: 'Focus timer' },
  { id: 'podcast', label: 'Podcast' },
];
const THEME_KEY = 'study-planner-theme';

function getSavedTheme() {
  try {
    return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
  } catch (error) {
    console.warn('Could not read the saved theme preference', error);
    return 'light';
  }
}

// Only this small component re-renders every tick, not the whole app.
function TimerPill({ timer, onClick }) {
  useTick(timer.status === 'running');
  if (timer.status === 'idle') return null;
  return (
    <button type="button" className={`timer-pill ${timer.phase}`} onClick={onClick}>
      <span className="pulse" />
      {timer.phase === 'focus' ? 'Focus' : 'Break'} <span className="mono">{formatClock(timer.getRemainingMs())}</span>
      {timer.status === 'paused' && <span className="muted"> · paused</span>}
    </button>
  );
}

export default function App() {
  const { state, actions } = useStore();
  const timer = useTimer({ settings: state.settings, logSession: actions.logSession });
  const [view, setView] = useState({ name: 'dashboard', id: null });
  const [theme, setTheme] = useState(getSavedTheme);
  const [toast, setToast] = useState('');
  const fileRef = useRef(null);

  const nav = (name, id = null) => {
    setView({ name, id });
    window.scrollTo({ top: 0 });
  };

  useEffect(() => {
    requestPersistence();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (error) {
      console.warn('Could not save the theme preference', error);
    }
  }, [theme]);

  useEffect(() => {
    if (timer.notice) setToast(timer.notice.text);
  }, [timer.notice]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(''), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const streak = computeStreak(studiedDaySet(state));
  const subjects = sortByExam(state.subjects);
  const subject = view.name === 'subject' ? state.subjects.find((s) => s.id === view.id) : null;

  async function onExport() {
    try {
      const blob = await exportBackup(state);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `study-planner-backup-${todayKey()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      setToast('Backup downloaded — keep it somewhere safe.');
    } catch (e) {
      setToast(`Export failed: ${e.message}`);
    }
  }

  async function onImport(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!window.confirm('Restoring a backup replaces everything currently in the app. Continue?')) return;
    try {
      actions.replaceAll(await importBackup(file));
      setToast('Backup restored.');
      nav('dashboard');
    } catch (err) {
      setToast(`Import failed: ${err.message}`);
    }
  }

  let page;
  if (view.name === 'subject' && subject) page = <SubjectView key={subject.id} subject={subject} nav={nav} />;
  else if (view.name === 'daily') page = <DailyView />;
  else if (view.name === 'timer') page = <TimerView timer={timer} />;
  else if (view.name === 'podcast') page = <PodcastView nav={nav} />;
  else page = <Dashboard nav={nav} />;

  const activeName = subject ? 'subject' : view.name;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">◐</span> Study Planner
        </div>

        <div className={`streak-chip ${streak.studiedToday ? 'yes' : 'no'}`} title="Studied today?">
          <span aria-hidden="true">🔥</span>
          <span className="mono">{streak.current}</span>
          <span className="small">{streak.studiedToday ? 'studied today' : 'not yet today'}</span>
        </div>

        <nav className="nav">
          {NAV.map((n) => (
            <button key={n.id} type="button" className={activeName === n.id ? 'on' : ''} onClick={() => nav(n.id)}>
              {n.label}
            </button>
          ))}
        </nav>

        <div className="nav-label">Subjects</div>
        <nav className="nav subjects-nav">
          {subjects.length === 0 && <span className="muted small pad">None yet</span>}
          {subjects.map((s) => {
            const d = daysUntil(s.examDate);
            return (
              <button
                key={s.id}
                type="button"
                className={view.name === 'subject' && view.id === s.id ? 'on' : ''}
                onClick={() => nav('subject', s.id)}
              >
                <span className="dot-c" style={{ background: s.color }} />
                <span className="nav-name">{s.name}</span>
                <span className={`nav-days mono ${d < 0 ? 'past' : d <= 3 ? 'hot' : ''}`}>{d < 0 ? '—' : `${d}d`}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-foot">
          <TimerPill timer={timer} onClick={() => nav('timer')} />
          <button
            type="button"
            className="btn sm ghost theme-toggle"
            onClick={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            <span aria-hidden="true">{theme === 'light' ? '☾' : '☀'}</span>
            {theme === 'light' ? 'Dark mode' : 'Light mode'}
          </button>
          <div className="row gap-s">
            <button type="button" className="btn sm ghost" onClick={onExport} title="Download all data (incl. audio & screenshots) as one file">
              Backup
            </button>
            <button type="button" className="btn sm ghost" onClick={() => fileRef.current?.click()} title="Restore from a backup file">
              Restore
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onImport} />
          </div>
        </div>
      </aside>

      <main className="main">{page}</main>

      {toast && (
        <div className="toast" role="status" onClick={() => setToast('')}>
          {toast}
        </div>
      )}
    </div>
  );
}
