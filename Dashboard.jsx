import { useMemo, useState } from 'react';
import { useStore } from './store';
import { DaysLeft, Progress, Swatches } from './Common';
import {
  COLORS,
  STATUS_WEIGHT,
  computeStreak,
  daysUntil,
  formatDay,
  formatMinutes,
  lastDays,
  minutesOnDay,
  sortByExam,
  studiedDaySet,
  todayKey,
} from './utils';

function StreakCard({ state, actions }) {
  const today = todayKey();
  const set = studiedDaySet(state);
  const { current, best, studiedToday } = computeStreak(set);
  const auto = state.sessions.some((s) => s.day === today && s.seconds >= 60);
  return (
    <section className={`card streak ${studiedToday ? 'yes' : 'no'}`}>
      <div className="eyebrow">Studied today?</div>
      <div className="streak-answer">{studiedToday ? 'Yes' : 'Not yet'}</div>
      <div className="streak-count">
        <span className="mono big">{current}</span> day streak <span className="muted">· best {best}</span>
      </div>
      <div className="dots" aria-label="Last 14 days">
        {lastDays(14).map((d) => (
          <span key={d} className={`dot${set.has(d) ? ' on' : ''}${d === today ? ' today' : ''}`} title={formatDay(d)} />
        ))}
      </div>
      {auto ? (
        <p className="muted small">Counted automatically from your focus timer.</p>
      ) : (
        <button type="button" className="btn sm" onClick={() => actions.toggleStudied(today)}>
          {state.studiedDays[today] ? 'Undo manual mark' : 'Mark today as studied'}
        </button>
      )}
    </section>
  );
}

function WeekCard({ sessions }) {
  const days = lastDays(7).map((d) => ({ day: d, min: minutesOnDay(sessions, d) }));
  const max = Math.max(30, ...days.map((d) => d.min));
  const total = days.reduce((a, d) => a + d.min, 0);
  return (
    <section className="card">
      <div className="eyebrow">Last 7 days</div>
      <div className="week-total">
        <span className="mono big">{formatMinutes(total)}</span> <span className="muted">focused</span>
      </div>
      <div className="bars">
        {days.map((d) => (
          <div key={d.day} className="bar-col" title={`${formatDay(d.day)} — ${formatMinutes(d.min)}`}>
            <div className="bar-wrap">
              <div className="bar" style={{ height: `${(d.min / max) * 100}%` }} />
            </div>
            <span className="bar-label">{formatDay(d.day, { weekday: 'narrow' })}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function AddSubject({ onDone }) {
  const { state, actions } = useStore();
  const [name, setName] = useState('');
  const [examDate, setExamDate] = useState('');
  const [color, setColor] = useState(COLORS[state.subjects.length % COLORS.length]);

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim() || !examDate) return;
    const id = actions.addSubject({ name, examDate, color });
    onDone(id);
  };

  return (
    <form className="card add-subject" onSubmit={submit}>
      <div className="row wrap gap">
        <label className="field grow">
          <span className="label">Subject</span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Operating Systems" />
        </label>
        <label className="field">
          <span className="label">Exam date</span>
          <input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} required />
        </label>
      </div>
      <div className="row wrap gap between">
        <Swatches value={color} onChange={setColor} />
        <div className="row gap-s">
          <button type="button" className="btn ghost" onClick={() => onDone(null)}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={!name.trim() || !examDate}>
            Add subject
          </button>
        </div>
      </div>
    </form>
  );
}

export default function Dashboard({ nav }) {
  const { state, actions } = useStore();
  const [adding, setAdding] = useState(false);
  const today = todayKey();

  const subjects = useMemo(() => sortByExam(state.subjects), [state.subjects]);
  const nextExam = subjects.find((s) => daysUntil(s.examDate) >= 0);
  const todayTasks = state.tasks.filter((t) => t.date === today);
  const todayLeft = todayTasks.filter((t) => !t.done).length;
  const todayMin = minutesOnDay(state.sessions, today);

  const stats = useMemo(() => {
    const out = {};
    for (const s of state.subjects) {
      const topics = state.topics.filter((t) => t.subjectId === s.id);
      const sec = state.sessions.filter((x) => x.subjectId === s.id).reduce((a, x) => a + x.seconds, 0);
      const progress = topics.length
        ? (topics.reduce((a, t) => a + (STATUS_WEIGHT[t.status] ?? 0), 0) / topics.length) * 100
        : 0;
      const mastered = topics.filter((t) => t.status === 'Mastered').length;
      out[s.id] = { topics: topics.length, mastered, progress, sec };
    }
    return out;
  }, [state.subjects, state.topics, state.sessions]);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Overview</h1>
          <p className="muted">
            {nextExam
              ? `Next exam: ${nextExam.name} — ${formatDay(nextExam.examDate, { weekday: 'long', day: 'numeric', month: 'long' })}`
              : 'Add your exam subjects to start the countdown.'}
          </p>
        </div>
        {nextExam && <DaysLeft date={nextExam.examDate} size="lg" />}
      </header>

      <div className="grid three">
        <StreakCard state={state} actions={actions} />
        <WeekCard sessions={state.sessions} />
        <section className="card">
          <div className="eyebrow">Today</div>
          <div className="today-stats">
            <div>
              <span className="mono big">{formatMinutes(todayMin)}</span>
              <span className="muted small"> focused</span>
            </div>
            <div>
              <span className="mono big">{todayLeft}</span>
              <span className="muted small"> task{todayLeft === 1 ? '' : 's'} left</span>
            </div>
          </div>
          <div className="row gap-s wrap">
            <button type="button" className="btn primary" onClick={() => nav('timer')}>
              Start focus
            </button>
            <button type="button" className="btn" onClick={() => nav('daily')}>
              Today&rsquo;s tasks
            </button>
          </div>
        </section>
      </div>

      <div className="section-head">
        <h2>Exams</h2>
        {!adding && (
          <button type="button" className="btn primary" onClick={() => setAdding(true)}>
            + Add subject
          </button>
        )}
      </div>

      {adding && (
        <AddSubject
          onDone={(id) => {
            setAdding(false);
            if (id) nav('subject', id);
          }}
        />
      )}

      {subjects.length === 0 && !adding && (
        <div className="card empty-card">
          <p>No subjects yet.</p>
          <p className="muted">Add each exam with its date — you&rsquo;ll get a live days-left countdown, topics, tasks and notes per subject.</p>
        </div>
      )}

      <div className="subject-list">
        {subjects.map((s) => {
          const st = stats[s.id];
          return (
            <button key={s.id} type="button" className="subject-row" style={{ '--c': s.color }} onClick={() => nav('subject', s.id)}>
              <span className="subject-bar" />
              <span className="subject-info">
                <span className="subject-name">{s.name}</span>
                <span className="muted small">
                  {formatDay(s.examDate, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                <span className="subject-progress">
                  <Progress value={st.progress} color={s.color} thin />
                  <span className="muted small">
                    {st.topics ? `${st.mastered}/${st.topics} topics mastered` : 'No topics yet'} · {formatMinutes(st.sec / 60)} studied
                  </span>
                </span>
              </span>
              <DaysLeft date={s.examDate} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
