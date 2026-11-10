import { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { deleteBlob } from './db';
import { todayKey, uid } from './utils';

const KEY = 'study-planner-v1';

const EMPTY = {
  subjects: [], // { id, name, examDate:'YYYY-MM-DD', color }
  topics: [], //   { id, subjectId, name, difficulty:1-3, allotMin, status, notes, audioId, audioSec, imageIds[] }
  tasks: [], //    { id, subjectId|null, text, done, date|null, createdAt }
  sessions: [], // { id, subjectId|null, topicId|null, seconds, day, endedAt }
  studiedDays: {}, // manual "I studied today" marks: { 'YYYY-MM-DD': true }
  settings: { focusMin: 25, breakMin: 5 },
};

const normalise = (raw) => ({ ...EMPTY, ...raw, settings: { ...EMPTY.settings, ...(raw?.settings || {}) } });

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalise(JSON.parse(raw));
  } catch {
    /* corrupted storage → start fresh */
  }
  return EMPTY;
}

const patchById = (list, id, patch) => list.map((x) => (x.id === id ? { ...x, ...patch } : x));

function reducer(state, a) {
  switch (a.type) {
    case 'replace':
      return normalise(a.state);

    case 'subject/add':
      return { ...state, subjects: [...state.subjects, a.subject] };
    case 'subject/update':
      return { ...state, subjects: patchById(state.subjects, a.id, a.patch) };
    case 'subject/remove':
      return {
        ...state,
        subjects: state.subjects.filter((s) => s.id !== a.id),
        topics: state.topics.filter((t) => t.subjectId !== a.id),
        tasks: state.tasks.filter((t) => t.subjectId !== a.id),
      };

    case 'topics/add':
      return { ...state, topics: [...state.topics, ...a.topics] };
    case 'topic/update':
      return { ...state, topics: patchById(state.topics, a.id, a.patch) };
    case 'topics/patch': {
      const byId = new Map(a.patches.map((p) => [p.id, p]));
      return { ...state, topics: state.topics.map((t) => (byId.has(t.id) ? { ...t, ...byId.get(t.id) } : t)) };
    }
    case 'topic/remove':
      return { ...state, topics: state.topics.filter((t) => t.id !== a.id) };
    case 'topic/image/add':
      return {
        ...state,
        topics: state.topics.map((t) => (t.id === a.id ? { ...t, imageIds: [...(t.imageIds || []), a.imageId] } : t)),
      };
    case 'topic/image/remove':
      return {
        ...state,
        topics: state.topics.map((t) =>
          t.id === a.id ? { ...t, imageIds: (t.imageIds || []).filter((i) => i !== a.imageId) } : t,
        ),
      };

    case 'task/add':
      return { ...state, tasks: [...state.tasks, a.task] };
    case 'task/update':
      return { ...state, tasks: patchById(state.tasks, a.id, a.patch) };
    case 'task/remove':
      return { ...state, tasks: state.tasks.filter((t) => t.id !== a.id) };

    case 'session/add':
      return { ...state, sessions: [...state.sessions, a.session] };

    case 'studied/toggle': {
      const days = { ...state.studiedDays };
      if (days[a.day]) delete days[a.day];
      else days[a.day] = true;
      return { ...state, studiedDays: days };
    }

    case 'settings':
      return { ...state, settings: { ...state.settings, ...a.patch } };

    default:
      return state;
  }
}

const Ctx = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  const ref = useRef(state);
  ref.current = state;

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Could not save to localStorage', e);
    }
  }, [state]);

  const actions = useMemo(() => {
    const dropBlobs = (ids) => ids.filter(Boolean).forEach((id) => deleteBlob(id).catch(() => {}));
    const blobIdsOf = (topics) => topics.flatMap((t) => [t.audioId, ...(t.imageIds || [])]);
    const findTopic = (id) => ref.current.topics.find((t) => t.id === id);

    return {
      replaceAll: (s) => dispatch({ type: 'replace', state: s }),

      // subjects
      addSubject: ({ name, examDate, color }) => {
        const subject = { id: uid(), name: name.trim(), examDate, color };
        dispatch({ type: 'subject/add', subject });
        return subject.id;
      },
      updateSubject: (id, patch) => dispatch({ type: 'subject/update', id, patch }),
      removeSubject: (id) => {
        dropBlobs(blobIdsOf(ref.current.topics.filter((t) => t.subjectId === id)));
        dispatch({ type: 'subject/remove', id });
      },

      // topics
      addTopics: (subjectId, items) =>
        dispatch({
          type: 'topics/add',
          topics: items.map((it) => ({
            id: uid(),
            subjectId,
            name: it.name,
            difficulty: it.difficulty ?? 2,
            allotMin: it.allotMin ?? 60,
            status: 'Not started',
            notes: '',
            audioId: null,
            audioSec: 0,
            imageIds: [],
          })),
        }),
      updateTopic: (id, patch) => dispatch({ type: 'topic/update', id, patch }),
      patchTopics: (patches) => dispatch({ type: 'topics/patch', patches }),
      removeTopic: (id) => {
        const t = findTopic(id);
        if (t) dropBlobs(blobIdsOf([t]));
        dispatch({ type: 'topic/remove', id });
      },
      setTopicAudio: (id, audioId, sec) => {
        const t = findTopic(id);
        if (t?.audioId && t.audioId !== audioId) dropBlobs([t.audioId]);
        dispatch({ type: 'topic/update', id, patch: { audioId, audioSec: sec } });
      },
      removeTopicAudio: (id) => {
        const t = findTopic(id);
        if (t?.audioId) dropBlobs([t.audioId]);
        dispatch({ type: 'topic/update', id, patch: { audioId: null, audioSec: 0 } });
      },
      addTopicImage: (id, imageId) => dispatch({ type: 'topic/image/add', id, imageId }),
      removeTopicImage: (id, imageId) => {
        dropBlobs([imageId]);
        dispatch({ type: 'topic/image/remove', id, imageId });
      },

      // tasks
      addTask: ({ text, subjectId = null, date = null }) =>
        dispatch({
          type: 'task/add',
          task: { id: uid(), text: text.trim(), subjectId, date, done: false, createdAt: Date.now() },
        }),
      updateTask: (id, patch) => dispatch({ type: 'task/update', id, patch }),
      removeTask: (id) => dispatch({ type: 'task/remove', id }),

      // study sessions (written by the timer)
      logSession: ({ subjectId = null, topicId = null, seconds }) =>
        dispatch({
          type: 'session/add',
          session: {
            id: uid(),
            subjectId,
            topicId,
            seconds: Math.round(seconds),
            day: todayKey(),
            endedAt: Date.now(),
          },
        }),

      toggleStudied: (day) => dispatch({ type: 'studied/toggle', day }),
      setSettings: (patch) => dispatch({ type: 'settings', patch }),
    };
  }, []);

  const value = useMemo(() => ({ state, actions }), [state, actions]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx);
