import { useMemo, useState } from 'react';
import { useStore } from './store';
import { AudioPlayer, useBlob } from './Media';
import { Icon } from './Common';
import { DIFFICULTY, formatMinutes, formatTime, sortByExam } from './utils';

const RATES = [0.75, 1, 1.25, 1.5, 2];

// Plays every Feynman voice note back-to-back, like a podcast.
export default function PodcastView({ nav }) {
  const { state } = useStore();
  const [filter, setFilter] = useState('all');
  const [currentId, setCurrentId] = useState(null);
  const [autoplay, setAutoplay] = useState(false);
  const [rate, setRate] = useState(1);

  const groups = useMemo(
    () =>
      sortByExam(state.subjects)
        .filter((s) => filter === 'all' || s.id === filter)
        .map((s) => ({ subject: s, items: state.topics.filter((t) => t.subjectId === s.id && t.audioId) }))
        .filter((g) => g.items.length),
    [state.subjects, state.topics, filter],
  );
  const queue = useMemo(() => groups.flatMap((g) => g.items.map((topic) => ({ topic, subject: g.subject }))), [groups]);

  const found = queue.findIndex((q) => q.topic.id === currentId);
  const idx = Math.max(0, found);
  const current = queue[idx];
  const { url } = useBlob(current?.topic.audioId);

  const playAt = (i) => {
    const q = queue[i];
    if (!q) return false;
    setCurrentId(q.topic.id);
    setAutoplay(true);
    return true;
  };
  const onEnded = () => {
    if (!playAt(idx + 1)) setAutoplay(false);
  };

  const totalSec = queue.reduce((a, q) => a + (q.topic.audioSec || 0), 0);
  const withAudioAnywhere = state.topics.some((t) => t.audioId);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Podcast</h1>
          <p className="muted">Your own Feynman explanations, played back to back.</p>
        </div>
        <label className="field">
          <span className="label">Subject</span>
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setAutoplay(false);
            }}
          >
            <option value="all">All subjects</option>
            {state.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </header>

      {!queue.length ? (
        <div className="card empty-card">
          <p>{withAudioAnywhere ? 'No voice notes for this subject yet.' : 'No voice notes yet.'}</p>
          <p className="muted">
            Open a subject, hit <strong>Record</strong> in front of any topic and explain it out loud. Each note shows up here automatically.
          </p>
          <button type="button" className="btn primary" onClick={() => nav('dashboard')}>
            Go to subjects
          </button>
        </div>
      ) : (
        <>
          <section className="card now-playing" style={{ '--c': current.subject.color }}>
            <div className="eyebrow">Now playing · {idx + 1} of {queue.length}</div>
            <h2 className="np-title">{current.topic.name}</h2>
            <p className="muted">
              <span className="dot-c" style={{ background: current.subject.color }} />
              {current.subject.name}
            </p>

            <AudioPlayer src={url} fallbackSec={current.topic.audioSec} autoPlay={autoplay} rate={rate} onEnded={onEnded} />

            <div className="row between wrap gap">
              <div className="row gap-s">
                <button type="button" className="icon-btn round" onClick={() => playAt(idx - 1)} disabled={idx === 0} title="Previous">
                  <Icon name="prev" />
                </button>
                <button type="button" className="icon-btn round" onClick={() => playAt(idx + 1)} disabled={idx >= queue.length - 1} title="Next">
                  <Icon name="next" />
                </button>
              </div>
              <div className="row gap-s align-center">
                <span className="muted small">Speed</span>
                <div className="seg">
                  {RATES.map((r) => (
                    <button key={r} type="button" className={r === rate ? 'on' : ''} onClick={() => setRate(r)}>
                      {r}×
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {current.topic.notes && <p className="np-notes small muted">{current.topic.notes}</p>}
          </section>

          <div className="section-head">
            <h2>Queue</h2>
            <span className="muted small">
              {queue.length} notes · {formatMinutes(totalSec / 60)}
            </span>
          </div>

          {groups.map((g) => (
            <section key={g.subject.id} className="card queue-group" style={{ '--c': g.subject.color }}>
              <h3>
                <span className="dot-c" style={{ background: g.subject.color }} />
                {g.subject.name}
              </h3>
              <ul className="queue">
                {g.items.map((t) => {
                  const on = current.topic.id === t.id;
                  return (
                    <li key={t.id}>
                      <button type="button" className={`queue-item${on ? ' on' : ''}`} onClick={() => (on ? null : playAt(queue.findIndex((q) => q.topic.id === t.id)))}>
                        <span className="queue-play">
                          <Icon name={on ? 'pause' : 'play'} size={16} />
                        </span>
                        <span className="queue-name">{t.name}</span>
                        <span className={`diff-tag d${t.difficulty}`}>{DIFFICULTY.find((d) => d.v === t.difficulty)?.label}</span>
                        <span className="mono small muted">{formatTime(t.audioSec)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
