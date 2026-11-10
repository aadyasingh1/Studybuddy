import { useEffect, useState } from 'react';
import { useStore } from './store';
import { Icon } from './Common';
import { formatDay } from './utils';

export function AddTask({ subjects, subjectId, defaultDate }) {
  const { actions } = useStore();
  const [text, setText] = useState('');
  const [selectedSubject, setSelectedSubject] = useState(subjectId || '');
  const [date, setDate] = useState(defaultDate || '');

  useEffect(() => setDate(defaultDate || ''), [defaultDate]);

  const add = (e) => {
    e.preventDefault();
    const taskText = text.trim();
    if (!taskText) return;
    actions.addTask({
      text: taskText,
      subjectId: subjectId || selectedSubject || null,
      date: date || null,
    });
    setText('');
  };

  return (
    <form className="add-task" onSubmit={add}>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add a task…"
        aria-label="Task name"
        required
      />
      {!subjectId && subjects.length > 0 && (
        <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} aria-label="Subject">
          <option value="">No subject</option>
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.name}
            </option>
          ))}
        </select>
      )}
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Task date" />
      <button type="submit" className="btn primary">
        + Add
      </button>
    </form>
  );
}

export function TaskList({ tasks, subjects, showSubject = false, empty = 'No tasks yet.', renderExtra }) {
  const { actions } = useStore();

  if (!tasks.length) return <p className="empty">{empty}</p>;

  const subjectNames = new Map(subjects.map((subject) => [subject.id, subject.name]));

  return (
    <ul className="tasks">
      {tasks.map((task) => (
        <li key={task.id} className={`task${task.done ? ' done' : ''}`}>
          <label className="check" aria-label={`${task.done ? 'Mark incomplete' : 'Complete'}: ${task.text}`}>
            <input
              type="checkbox"
              checked={task.done}
              onChange={(e) => actions.updateTask(task.id, { done: e.target.checked })}
            />
            <span className="box">
              <Icon name="check" size={16} />
            </span>
          </label>
          <span className="task-text">{task.text}</span>
          {showSubject && task.subjectId && subjectNames.has(task.subjectId) && (
            <span className="chip" style={{ '--c': subjects.find((subject) => subject.id === task.subjectId)?.color }}>
              {subjectNames.get(task.subjectId)}
            </span>
          )}
          {task.date && <span className="muted small nowrap">{formatDay(task.date)}</span>}
          {renderExtra?.(task)}
          <button
            type="button"
            className="icon-btn"
            onClick={() => actions.removeTask(task.id)}
            title="Delete task"
            aria-label={`Delete task: ${task.text}`}
          >
            <Icon name="trash" />
          </button>
        </li>
      ))}
    </ul>
  );
}
