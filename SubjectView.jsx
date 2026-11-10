import { useMemo, useState } from 'react';
import { useStore } from './store';
import TopicCard from './TopicCard';
import { AddTask, TaskList } from './TaskList';
import { DaysLeft, Swatches } from './Common';
import { DIFFICULTY, STATUS_WEIGHT, autoAllot, formatDay, formatMinutes, parseTopicLines } from './utils';

function TopicTools({ subject, topics }) {
  const { actions } = useStore();
  const [mode, setMode] = useState(null); // null | 'bulk' | 'allot'
  const [name, setName] = useState('');
  const [difficulty, setDifficulty] = useState(2);
  const [allot, setAllot] = useState(60);
  const [bulk, setBulk] = useState('');
  const [hours, setHours] = useState(10);

  const add = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    actions.addTopics(subject.id, [{ name: name.trim(), difficulty: Number(difficulty), allotMin: Number(allot) || 0 }]);
    setName('');
  };

  const addBulk = () => {
    const items = parseTopicLines(bulk);
    if (!items.length) return;
    actions.addTopics(subject.id, items);
    setBulk('');
    setMode(null);
  };

  const allotAll = () => {
    const total = Number(hours) * 60;
    if (!topics.length || !(total > 0)) return;
    actions.patchTopics(autoAllot(topics, total));
    setMode(null);
  };

  return (
    <div className="card topic-tools">
      <form className="row wrap gap" onSubmit={add}>
        <label className="field grow">
          <span className="label">New topic</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Deadlocks & banker's algorithm" />
        </label>
        <label className="field">
          <span className="label">Difficulty</span>
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
            {DIFFICULTY.map((d) => (
              <option key={d.v} value={d.v}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field narrow">
          <span className="label">Minutes</span>
          <input type="number" min="0" step="5" value={allot} onChange={(e) => setAllot(e.target.value)} />
        </label>
        <button type="submit" className="btn primary self-end">
          + Add
        </button>
      </form>

      <div className="row gap-s wrap tools-row">
        <button type="button" className={`btn sm${mode === 'bulk' ? ' primary' : ''}`} onClick={() => setMode(mode === 'bulk' ? null : 'bulk')}>
          Paste syllabus (bulk add)
        </button>
        <button
          type="button"
          className={`btn sm${mode === 'allot' ? ' primary' : ''}`}
          onClick={() => setMode(mode === 'allot' ? null : 'allot')}
          disabled={!topics.length}
        >
          Auto-allocate time
        </button>
      </div>

      {mode === 'bulk' && (
        <div className="stack gap-s">
          <textarea
            rows={7}
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            placeholder={'One topic per line. Optional: name | difficulty | minutes\n\nProcess scheduling | medium | 90\nDeadlocks | hard | 120\nMemory management\nFile systems | easy'}
          />
          <div className="row gap-s">
            <button type="button" className="btn primary" onClick={addBulk} disabled={!bulk.trim()}>
              Add {parseTopicLines(bulk).length || ''} topics
            </button>
            <button type="button" className="btn ghost" onClick={() => setMode(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {mode === 'allot' && (
        <div className="row wrap gap-s align-end">
          <label className="field narrow">
            <span className="label">Total hours for this subject</span>
            <input type="number" min="1" step="1" value={hours} onChange={(e) => setHours(e.target.value)} />
          </label>
          <button type="button" className="btn primary" onClick={allotAll}>
            Split by difficulty
          </button>
          <button type="button" className="btn ghost" onClick={() => setMode(null)}>
            Cancel
          </button>
          <p className="muted small grow">Hard topics get 3× the time of easy ones, 2× for medium. You can still edit each topic afterwards.</p>
        </div>
      )}
    </div>
  );
}

export default function SubjectView({ subject, nav }) {
  const { state, actions } = useStore();
  const [tab, setTab] = useState('topics');
  const [editing, setEditing] = useState(false);

  const topics = useMemo(() => state.topics.filter((t) => t.subjectId === subject.id), [state.topics, subject.id]);
  const tasks = useMemo(() => state.tasks.filter((t) => t.subjectId === subject.id), [state.tasks, subject.id]);
  const studiedByTopic = useMemo(() => {
    const m = {};
    for (const s of state.sessions) if (s.topicId) m[s.topicId] = (m[s.topicId] || 0) + s.seconds;
    return m;
  }, [state.sessions]);
  const subjectSec = useMemo(
    () => state.sessions.filter((s) => s.subjectId === subject.id).reduce((a, s) => a + s.seconds, 0),
    [state.sessions, subject.id],
  );

  const allotTotal = topics.reduce((a, t) => a + (t.allotMin || 0), 0);
  const mastery = topics.length ? (topics.reduce((a, t) => a + (STATUS_WEIGHT[t.status] ?? 0), 0) / topics.length) * 100 : 0;
  const tasksDone = tasks.filter((t) => t.done).length;

  const remove = () => {
    if (window.confirm(`Delete "${subject.name}" along with all its topics, tasks, voice notes and screenshots?`)) {
      actions.removeSubject(subject.id);
      nav('dashboard');
    }
  };

  return (
    <div className="page" style={{ '--c': subject.color }}>
      <button type="button" className="link" onClick={() => nav('dashboard')}>
        ← Overview
      </button>

      <header className="page-head subject-head">
        <div className="grow">
          {editing ? (
            <div className="stack gap-s">
              <div className="row wrap gap">
                <input
                  className="grow"
                  value={subject.name}
                  onChange={(e) => actions.updateSubject(subject.id, { name: e.target.value })}
                  aria-label="Subject name"
                />
                <input
                  type="date"
                  value={subject.examDate}
                  onChange={(e) => e.target.value && actions.updateSubject(subject.id, { examDate: e.target.value })}
                  aria-label="Exam date"
                />
              </div>
              <div className="row wrap gap between">
                <Swatches value={subject.color} onChange={(c) => actions.updateSubject(subject.id, { color: c })} />
                <div className="row gap-s">
                  <button type="button" className="btn danger sm" onClick={remove}>
                    Delete subject
                  </button>
                  <button type="button" className="btn primary sm" onClick={() => setEditing(false)}>
                    Done
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <h1>
                <span className="title-dot" />
                {subject.name}
              </h1>
              <p className="muted">
                Exam · {formatDay(subject.examDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}{' '}
                <button type="button" className="link small" onClick={() => setEditing(true)}>
                  edit
                </button>
              </p>
            </>
          )}
        </div>
        <DaysLeft date={subject.examDate} size="lg" />
      </header>

      <div className="stat-row">
        <div className="stat">
          <span className="mono big">{topics.length}</span>
          <span className="muted small">topics · {Math.round(mastery)}% mastered</span>
        </div>
        <div className="stat">
          <span className="mono big">{formatMinutes(subjectSec / 60)}</span>
          <span className="muted small">studied of {formatMinutes(allotTotal)} planned</span>
        </div>
        <div className="stat">
          <span className="mono big">
            {tasksDone}/{tasks.length}
          </span>
          <span className="muted small">tasks done</span>
        </div>
      </div>

      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'topics'} className={tab === 'topics' ? 'on' : ''} onClick={() => setTab('topics')}>
          Topics &amp; notes <span className="badge">{topics.length}</span>
        </button>
        <button type="button" role="tab" aria-selected={tab === 'tasks'} className={tab === 'tasks' ? 'on' : ''} onClick={() => setTab('tasks')}>
          Tasks <span className="badge">{tasks.filter((t) => !t.done).length}</span>
        </button>
      </div>

      {tab === 'topics' && (
        <>
          <TopicTools subject={subject} topics={topics} />
          {topics.length === 0 ? (
            <p className="empty">No topics yet. Add the syllabus topics above — or paste the whole list at once.</p>
          ) : (
            <div className="topic-list">
              {topics.map((t) => (
                <TopicCard key={t.id} topic={t} studiedSec={studiedByTopic[t.id] || 0} color={subject.color} />
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'tasks' && (
        <div className="card">
          <AddTask subjects={state.subjects} subjectId={subject.id} />
          <TaskList tasks={tasks} subjects={state.subjects} empty="No tasks for this subject yet." />
        </div>
      )}
    </div>
  );
}
