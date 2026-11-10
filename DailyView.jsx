import { useState } from 'react';
import { useStore } from './store';
import { AddTask, TaskList } from './TaskList';
import { Progress } from './Common';
import { addDays, formatDay, formatMinutes, minutesOnDay, todayKey } from './utils';

export default function DailyView() {
  const { state, actions } = useStore();
  const today = todayKey();
  const [day, setDay] = useState(today);
  const [showAllBacklog, setShowAllBacklog] = useState(false);

  const dayTasks = state.tasks.filter((t) => t.date === day);
  const done = dayTasks.filter((t) => t.done).length;
  const overdue = day === today ? state.tasks.filter((t) => !t.done && t.date && t.date < today) : [];
  const backlog = state.tasks.filter((t) => !t.done && !t.date);
  const shownBacklog = showAllBacklog ? backlog : backlog.slice(0, 6);
  const exams = state.subjects.filter((s) => s.examDate === day);
  const mins = minutesOnDay(state.sessions, day);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>{day === today ? 'Today' : formatDay(day, { weekday: 'long' })}</h1>
          <p className="muted">{formatDay(day, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <div className="row gap-s">
          <button type="button" className="btn" onClick={() => setDay(addDays(day, -1))} aria-label="Previous day">
            ‹
          </button>
          <input type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} aria-label="Pick a day" />
          <button type="button" className="btn" onClick={() => setDay(addDays(day, 1))} aria-label="Next day">
            ›
          </button>
          {day !== today && (
            <button type="button" className="btn primary" onClick={() => setDay(today)}>
              Today
            </button>
          )}
        </div>
      </header>

      {exams.map((s) => (
        <div key={s.id} className="banner" style={{ '--c': s.color }}>
          Exam day: <strong>{s.name}</strong>
        </div>
      ))}

      <section className="card">
        <div className="row between wrap gap-s">
          <div>
            <span className="mono big">
              {done}/{dayTasks.length}
            </span>{' '}
            <span className="muted">tasks done</span>
          </div>
          <span className="muted small">{mins > 0 ? `${formatMinutes(mins)} focused` : 'No focus time logged'}</span>
        </div>
        <Progress value={dayTasks.length ? (done / dayTasks.length) * 100 : 0} thin />
        <AddTask subjects={state.subjects} defaultDate={day} />
        <TaskList
          tasks={dayTasks}
          subjects={state.subjects}
          showSubject
          empty={day === today ? 'Nothing planned for today yet — add a task above or pull one in from below.' : 'Nothing planned for this day.'}
        />
      </section>

      {overdue.length > 0 && (
        <section className="card">
          <div className="section-head tight">
            <h3>Overdue</h3>
            <button
              type="button"
              className="btn sm"
              onClick={() => overdue.forEach((t) => actions.updateTask(t.id, { date: today }))}
            >
              Move all to today
            </button>
          </div>
          <TaskList tasks={overdue} subjects={state.subjects} showSubject />
        </section>
      )}

      {backlog.length > 0 && (
        <section className="card">
          <div className="section-head tight">
            <h3>
              Unscheduled <span className="badge">{backlog.length}</span>
            </h3>
          </div>
          <TaskList
            tasks={shownBacklog}
            subjects={state.subjects}
            showSubject
            renderExtra={(t) =>
              day === today ? null : (
                <button type="button" className="btn sm" onClick={() => actions.updateTask(t.id, { date: day })}>
                  + This day
                </button>
              )
            }
          />
          {backlog.length > 6 && (
            <button type="button" className="link small" onClick={() => setShowAllBacklog((v) => !v)}>
              {showAllBacklog ? 'Show fewer' : `Show all ${backlog.length}`}
            </button>
          )}
        </section>
      )}
    </div>
  );
}
