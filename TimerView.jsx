import { useEffect } from 'react';
import { useStore } from './store';
import { useTick } from './useTimer';
import { formatClock, formatMinutes, todayKey } from './utils';
import { Icon, Progress } from './Common';

const R = 96;
const C = 2 * Math.PI * R;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export default function TimerView({ timer }) {
  const { state, actions } = useStore();
  const { subjects, topics, sessions, settings } = state;
  const running = timer.status === 'running';
  useTick(running);

  // keep the selected subject valid (default to the first one)
  useEffect(() => {
    if (timer.status !== 'idle') return;
    const ok = subjects.some((s) => s.id === timer.subjectId);
    const want = subjects[0]?.id ?? null;
    if (!ok && timer.subjectId !== want) timer.setTarget(want, null);
  }, [subjects, timer]);

  const remaining = timer.getRemainingMs();
  const total = timer.getTotalMs() || 1;
  const frac = Math.min(1, remaining / total);
  const isFocus = timer.phase === 'focus';
  const idle = timer.status === 'idle';
  const topicsOfSubject = topics.filter((t) => t.subjectId === timer.subjectId);
  const elapsedMin = Math.floor((total - remaining) / 60000);

  const today = todayKey();
  const rows = subjects.map((s) => {
    const ss = sessions.filter((x) => x.subjectId === s.id);
    return {
      subject: s,
      today: ss.filter((x) => x.day === today).reduce((a, x) => a + x.seconds, 0) / 60,
      total: ss.reduce((a, x) => a + x.seconds, 0) / 60,
    };
  });
  const known = new Set(subjects.map((s) => s.id));
  const otherSessions = sessions.filter((x) => !known.has(x.subjectId));
  const otherTotal = otherSessions.reduce((a, x) => a + x.seconds, 0) / 60;
  const maxTotal = Math.max(1, ...rows.map((r) => r.total), otherTotal);
  const todaySessions = sessions.filter((x) => x.day === today).length;

  const commitMinutes = (key) => (e) => {
    const v = clamp(Math.round(Number(e.target.value)) || settings[key], 1, 180);
    e.target.value = v;
    if (v !== settings[key]) actions.setSettings({ [key]: v });
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Focus timer</h1>
          <p className="muted">
            {settings.focusMin} min focus · {settings.breakMin} min break · {todaySessions} session{todaySessions === 1 ? '' : 's'} logged today
          </p>
        </div>
      </header>

      <div className="grid two timer-grid">
        <section className={`card timer-card ${isFocus ? 'focus' : 'break'}`}>
          <div className="ring-wrap">
            <svg viewBox="0 0 220 220" className="ring" role="img" aria-label="Timer progress">
              <circle cx="110" cy="110" r={R} className="ring-bg" />
              <circle
                cx="110"
                cy="110"
                r={R}
                className="ring-fg"
                transform="rotate(-90 110 110)"
                style={{ strokeDasharray: C, strokeDashoffset: C * (1 - frac) }}
              />
            </svg>
            <div className="ring-center">
              <div className="ring-phase">{isFocus ? 'Focus' : 'Break'}</div>
              <div className="ring-time mono">{formatClock(remaining)}</div>
              <div className="ring-sub muted small">
                {timer.status === 'paused' ? 'Paused' : running ? (isFocus ? 'Stay with it' : 'Stretch, water, breathe') : 'Ready'}
              </div>
            </div>
          </div>

          <div className="row gap center">
            {running ? (
              <button type="button" className="btn big primary" onClick={timer.pause}>
                <Icon name="pause" /> Pause
              </button>
            ) : (
              <button type="button" className="btn big primary" onClick={timer.start}>
                <Icon name="play" /> {timer.status === 'paused' ? 'Resume' : 'Start focus'}
              </button>
            )}
            {!idle && (
              <button type="button" className="btn big" onClick={timer.stop}>
                {isFocus ? (elapsedMin >= 1 ? `Stop & log ${elapsedMin} min` : 'Reset') : 'Skip break'}
              </button>
            )}
          </div>

          <div className="row wrap gap center timer-pick">
            <label className="field">
              <span className="label">Subject</span>
              <select
                value={timer.subjectId ?? ''}
                disabled={!idle}
                onChange={(e) => timer.setTarget(e.target.value || null, null)}
              >
                {subjects.length === 0 && <option value="">General (add a subject first)</option>}
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="label">Topic (optional)</span>
              <select
                value={timer.topicId ?? ''}
                disabled={!idle || !topicsOfSubject.length}
                onChange={(e) => timer.setTarget(timer.subjectId, e.target.value || null)}
              >
                <option value="">Whole subject</option>
                {topicsOfSubject.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="row gap center timer-settings">
            <label className="mini">
              <span>Focus (min)</span>
              <input type="number" min="1" max="180" key={`f${settings.focusMin}`} defaultValue={settings.focusMin} disabled={!idle} onBlur={commitMinutes('focusMin')} />
            </label>
            <label className="mini">
              <span>Break (min)</span>
              <input type="number" min="1" max="180" key={`b${settings.breakMin}`} defaultValue={settings.breakMin} disabled={!idle} onBlur={commitMinutes('breakMin')} />
            </label>
          </div>
        </section>

        <section className="card">
          <div className="eyebrow">Minutes per subject</div>
          {rows.length === 0 && <p className="empty">Add a subject to see where your time goes.</p>}
          <ul className="time-rows">
            {rows.map((r) => (
              <li key={r.subject.id}>
                <div className="row between">
                  <span className="time-name">
                    <span className="dot-c" style={{ background: r.subject.color }} />
                    {r.subject.name}
                  </span>
                  <span className="mono small">
                    {formatMinutes(r.total)} <span className="muted">· today {formatMinutes(r.today)}</span>
                  </span>
                </div>
                <Progress value={(r.total / maxTotal) * 100} color={r.subject.color} thin />
              </li>
            ))}
            {otherTotal > 0 && (
              <li>
                <div className="row between">
                  <span className="time-name">
                    <span className="dot-c" style={{ background: '#9097a8' }} />
                    General / deleted subjects
                  </span>
                  <span className="mono small">{formatMinutes(otherTotal)}</span>
                </div>
                <Progress value={(otherTotal / maxTotal) * 100} color="#9097a8" thin />
              </li>
            )}
          </ul>
          <p className="muted small">Stopping a focus session early still logs the time, as long as it was at least 1 minute.</p>
        </section>
      </div>
    </div>
  );
}
