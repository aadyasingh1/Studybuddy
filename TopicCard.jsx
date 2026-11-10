import { useEffect, useRef, useState } from 'react';
import { putBlob } from './db';
import { useStore } from './store';
import { formatMinutes, formatTime, uid, STATUSES } from './utils';
import { Icon } from './Common';
import { Lightbox, Thumb } from './Media';
import VoiceRecorder from './VoiceRecorder';

export default function TopicCard({ topic, studiedSec, color }) {
  const { actions } = useStore();
  const [showNotes, setShowNotes] = useState(false);
  const [allotMin, setAllotMin] = useState(topic.allotMin || 0);
  const [lightboxSrc, setLightboxSrc] = useState('');
  const [imageError, setImageError] = useState('');
  const fileInput = useRef(null);

  useEffect(() => setAllotMin(topic.allotMin || 0), [topic.allotMin]);

  const addImages = async (files) => {
    setImageError('');
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        setImageError('Choose an image file.');
        continue;
      }
      try {
        const id = uid();
        await putBlob(id, file);
        actions.addTopicImage(topic.id, id);
      } catch {
        setImageError('Could not save the image. Try again.');
      }
    }
  };

  const pasteImages = (e) => {
    const files = Array.from(e.clipboardData.items)
      .filter((item) => item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter(Boolean);
    if (files.length) {
      e.preventDefault();
      addImages(files);
    }
  };

  const dropImages = (e) => {
    e.preventDefault();
    addImages(Array.from(e.dataTransfer.files));
  };

  const saveAllotment = () => {
    const value = Number(allotMin);
    if (Number.isFinite(value) && value >= 0 && value !== topic.allotMin) {
      actions.updateTopic(topic.id, { allotMin: value });
    }
  };

  const remove = () => {
    if (window.confirm(`Delete "${topic.name}" and its notes and media?`)) actions.removeTopic(topic.id);
  };

  return (
    <article className="topic" data-status={topic.status} style={{ '--c': color }}>
      <div className="topic-head">
        <div className="topic-main">
          <input
            className="topic-name"
            value={topic.name}
            onChange={(e) => actions.updateTopic(topic.id, { name: e.target.value })}
            aria-label="Topic name"
          />
          <div className="topic-meta">
            <label className={`diff-tag d${topic.difficulty}`}>
              <span className="sr-only">Difficulty</span>
              <select
                value={topic.difficulty}
                onChange={(e) => actions.updateTopic(topic.id, { difficulty: Number(e.target.value) })}
                aria-label="Difficulty"
              >
                <option value={1}>Easy</option>
                <option value={2}>Medium</option>
                <option value={3}>Hard</option>
              </select>
            </label>
            <select
              value={topic.status}
              onChange={(e) => actions.updateTopic(topic.id, { status: e.target.value })}
              aria-label="Topic status"
            >
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <span className="muted small">{formatTime(studiedSec)} studied</span>
          </div>
        </div>
        <div className="topic-time">
          <label className="field narrow">
            <span className="label">Planned time</span>
            <input
              type="number"
              min="0"
              step="5"
              value={allotMin}
              onChange={(e) => setAllotMin(e.target.value)}
              onBlur={saveAllotment}
              aria-label="Planned minutes"
            />
          </label>
          <span className="muted small">{formatMinutes(topic.allotMin || 0)}</span>
        </div>
        <div className="topic-actions">
          <button
            type="button"
            className="icon-btn"
            onClick={() => setShowNotes((shown) => !shown)}
            title={showNotes ? 'Hide notes' : 'Notes and screenshots'}
            aria-label={showNotes ? 'Hide notes' : 'Show notes and screenshots'}
            aria-expanded={showNotes}
          >
            <Icon name="notes" />
          </button>
          <button type="button" className="icon-btn" onClick={remove} title="Delete topic" aria-label={`Delete ${topic.name}`}>
            <Icon name="trash" />
          </button>
        </div>
      </div>

      <div className="row between wrap gap-s">
        <VoiceRecorder topic={topic} />
        <span className="muted small">{topic.audioId ? `${formatTime(topic.audioSec)} voice note` : ''}</span>
      </div>

      {showNotes && (
        <section className="notes">
          <details className="feynman">
            <summary>Feynman technique prompts</summary>
            <ol>
              <li>Explain the idea in simple language, as if teaching a beginner.</li>
              <li>Notice where your explanation gets stuck, then revisit that part.</li>
              <li>Simplify and use an example until the idea feels clear.</li>
            </ol>
          </details>
          <textarea
            className="notes-text"
            value={topic.notes || ''}
            onChange={(e) => actions.updateTopic(topic.id, { notes: e.target.value })}
            placeholder="Write what you know, questions to revisit, or a simple explanation…"
            aria-label={`${topic.name} notes`}
          />
          <div
            className="pastezone"
            tabIndex={0}
            onPaste={pasteImages}
            onDragOver={(e) => e.preventDefault()}
            onDrop={dropImages}
          >
            Paste a screenshot here, drop an image, or{' '}
            <button type="button" className="link" onClick={() => fileInput.current?.click()}>
              choose a file
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                addImages(Array.from(e.target.files || []));
                e.target.value = '';
              }}
            />
          </div>
          {imageError && <p className="error small">{imageError}</p>}
          {!!topic.imageIds?.length && (
            <div className="thumbs">
              {topic.imageIds.map((id) => (
                <Thumb key={id} id={id} onOpen={setLightboxSrc} onDelete={() => actions.removeTopicImage(topic.id, id)} />
              ))}
            </div>
          )}
        </section>
      )}
      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc('')} />}
    </article>
  );
}
