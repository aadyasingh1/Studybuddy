import { useEffect, useRef, useState } from 'react';
import { putBlob } from './db';
import { useStore } from './store';
import { formatTime, uid } from './utils';
import { Icon } from './Common';
import { AudioPlayer, useBlob } from './Media';

const pickMime = () =>
  ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find((t) =>
    window.MediaRecorder?.isTypeSupported?.(t),
  ) || '';

const safeName = (s) => (s || 'voice-note').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'voice-note';

// One voice note per topic (record your Feynman explanation, listen later).
// Recording again replaces the old note.
export default function VoiceRecorder({ topic }) {
  const { actions } = useStore();
  const [phase, setPhase] = useState('idle'); // idle | recording | saving
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const recRef = useRef(null);
  const chunks = useRef([]);
  const startedAt = useRef(0);
  const tickRef = useRef(null);
  const discard = useRef(false);
  const { url, type } = useBlob(topic.audioId);

  // If we leave the page mid-recording, stop and keep what was recorded.
  useEffect(
    () => () => {
      clearInterval(tickRef.current);
      if (recRef.current && recRef.current.state === 'recording') recRef.current.stop();
    },
    [],
  );

  async function start() {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Recording is not supported in this browser (try Chrome, Edge or Firefox on localhost).');
      return;
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError('Microphone blocked — allow mic access for this site and try again.');
      return;
    }
    const mime = pickMime();
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    chunks.current = [];
    discard.current = false;
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.current.push(e.data);
    };
    rec.onstop = async () => {
      clearInterval(tickRef.current);
      stream.getTracks().forEach((t) => t.stop());
      const sec = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
      const blob = new Blob(chunks.current, { type: rec.mimeType || mime || 'audio/webm' });
      if (discard.current || blob.size === 0) {
        setPhase('idle');
        return;
      }
      setPhase('saving');
      try {
        const id = uid();
        await putBlob(id, blob);
        actions.setTopicAudio(topic.id, id, sec);
      } catch {
        setError('Could not save the recording.');
      }
      setPhase('idle');
    };
    recRef.current = rec;
    startedAt.current = Date.now();
    setElapsed(0);
    rec.start();
    setPhase('recording');
    tickRef.current = setInterval(() => setElapsed((Date.now() - startedAt.current) / 1000), 250);
  }

  const stop = () => recRef.current?.stop();
  const cancel = () => {
    discard.current = true;
    recRef.current?.stop();
  };

  const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';

  if (phase === 'recording') {
    return (
      <div className="rec recording">
        <button type="button" className="rec-btn stop" onClick={stop}>
          <Icon name="stop" /> Stop
        </button>
        <span className="rec-dot" />
        <span className="mono">{formatTime(elapsed)}</span>
        <button type="button" className="icon-btn" onClick={cancel} title="Discard this take">
          <Icon name="trash" />
        </button>
      </div>
    );
  }

  if (phase === 'saving') return <div className="rec muted small">Saving…</div>;

  return (
    <div className="rec">
      {topic.audioId ? (
        <>
          <AudioPlayer src={url} fallbackSec={topic.audioSec} compact />
          <div className="rec-tools">
            <button type="button" className="icon-btn" onClick={start} title="Re-record (replaces this note)">
              <Icon name="mic" />
            </button>
            {url && (
              <a className="icon-btn" href={url} download={`${safeName(topic.name)}.${ext}`} title="Download audio">
                <Icon name="download" />
              </a>
            )}
            <button type="button" className="icon-btn" onClick={() => actions.removeTopicAudio(topic.id)} title="Delete voice note">
              <Icon name="trash" />
            </button>
          </div>
        </>
      ) : (
        <button type="button" className="rec-btn" onClick={start} title="Explain this topic out loud, as if teaching a beginner">
          <Icon name="mic" /> Record
        </button>
      )}
      {error && <div className="error small">{error}</div>}
    </div>
  );
}
