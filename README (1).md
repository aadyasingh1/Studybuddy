# Study Planner

Exam countdowns, per-subject topics and tasks, daily task lists, a 25/5 focus timer that logs minutes per subject,
a streak counter, Feynman voice notes you can play back like a podcast, and per-topic notes with pasted screenshots.

## Run it

Needs Node 20.19+ (or 22.12+).

```bash
npm install
npm run dev
```

Opens at http://localhost:5173. Use **Chrome / Edge** (Firefox works too). Microphone and clipboard access need
`localhost` or HTTPS — that is why the dev server on `localhost` works out of the box.

## Where your data lives

- Subjects, topics, tasks, timer logs, text notes → `localStorage`
- Voice notes and screenshots → `IndexedDB`
- Everything stays in **this browser on this computer**. Clearing site data deletes it.
- Use **Backup** (sidebar) now and then — it downloads one `.json` file with everything, audio and screenshots included.
  **Restore** loads it back (also how you move to another browser/computer).

## How to use

| Feature | Where |
| --- | --- |
| Exam list + days-left countdown | **Overview** → *Add subject* |
| Topics (difficulty, time to allot, status) | Open a subject → **Topics & notes** |
| Paste a whole syllabus | *Paste syllabus (bulk add)* — one topic per line, optional `name \| hard \| 90` |
| Split a time budget by difficulty | *Auto-allocate time* |
| Voice note per topic | **Record** button in front of each topic (re-record replaces it) |
| Notes + screenshots | **Notes** button on a topic → `Win+Shift+S`, then `Ctrl+V` inside the panel |
| Listen back to all voice notes | **Podcast** (queue, auto-play next, 0.75×–2× speed) |
| Task list per subject | Open a subject → **Tasks** |
| Daily task list | **Today** (pick any date, pull in unscheduled tasks, overdue section) |
| 25-min focus / 5-min break | **Focus timer** — pick subject (+ topic), start. Time is logged on completion |
| Streak (studied today: yes/no) | Overview + sidebar. Any logged focus time counts, or mark the day manually |

## Project layout

```
index.html
package.json
vite.config.js
src/
  main.jsx          entry
  App.jsx           sidebar, routing, backup/restore
  store.jsx         app state (reducer + localStorage)
  db.js             IndexedDB blobs + backup/restore
  utils.js          dates, streak maths, helpers
  useTimer.js       pomodoro hook (survives refresh, accurate in background tabs)
  styles.css
  views/            Dashboard, SubjectView, DailyView, TimerView, PodcastView
  components/       TopicCard, VoiceRecorder, NotesPanel, TaskList, Media, Common
```
