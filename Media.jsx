import { useEffect, useRef, useState } from 'react';
import { getBlob } from './db';
import { formatTime } from './utils';
import { Icon } from './Common';

// Loads a blob from IndexedDB and exposes it as an object URL (revoked automatically).
export function useBlob(id) {
  const [state, setState] = useState({ url: null, type: '' });
  useEffect(() => {
    setState({ url: null, type: '' });
    if (!id) return undefined;
    let cancelled = false;
    let created = null;
    getBlob(id)
      .then((blob) => {
        if (cancelled || !blob) return;
        created = URL.createObjectURL(blob);
        setState({ url: created, type: blob.type || '' });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [id]);
  return state;
}

// Custom audio player. Handles the Chrome quirk where MediaRecorder .webm files report an
// infinite duration (so seeking / progress are broken) by forcing the real duration to be computed.
export function AudioPlayer({ src, fallbackSec = 0, autoPlay = false, rate = 1, onEnded, compact = false }) {
  const ref = useRef(null);
  const fixing = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(fallbackSec);

  useEffect(() => {
    setTime(0);
    setPlaying(false);
    setDur(fallbackSec);
  }, [src, fallbackSec]);

  useEffect(() => {
    if (ref.current) ref.current.playbackRate = rate;
  }, [rate, src]);

  function onLoaded() {
    const el = ref.current;
    if (!el) return;
    el.playbackRate = rate;
    const finish = () => {
      fixing.current = false;
      setDur(Number.isFinite(el.duration) ? el.duration : fallbackSec);
      if (autoPlay) el.play().catch(() => {});
    };
    if (!Number.isFinite(el.duration)) {
      fixing.current = true;
      const onTU = () => {
        el.removeEventListener('timeupdate', onTU);
        el.currentTime = 0;
        finish();
      };
      el.addEventListener('timeupdate', onTU);
      el.currentTime = 1e101;
    } else {
      finish();
    }
  }

  const toggle = () => {
    const el = ref.current;
    if (!el || !src) return;
    if (el.paused) el.play().catch(() => {});
    else el.pause();
  };

  const seek = (e) => {
    const el = ref.current;
    if (!el) return;
    el.currentTime = Number(e.target.value);
    setTime(el.currentTime);
  };

  return (
    <div className={`player${compact ? ' compact' : ''}`}>
      <audio
        ref={ref}
        src={src || undefined}
        preload="metadata"
        onLoadedMetadata={onLoaded}
        onTimeUpdate={(e) => {
          if (!fixing.current) setTime(e.currentTarget.currentTime);
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          if (fixing.current) return;
          setPlaying(false);
          setTime(0);
          onEnded?.();
        }}
      />
      <button type="button" className="icon-btn round accent" onClick={toggle} disabled={!src} title={playing ? 'Pause' : 'Play'}>
        <Icon name={playing ? 'pause' : 'play'} />
      </button>
      <input
        type="range"
        className="seek"
        min={0}
        max={dur || 0}
        step={0.1}
        value={Math.min(time, dur || 0)}
        onChange={seek}
        disabled={!src}
        aria-label="Seek"
      />
      <span className="mono small muted nowrap">
        {formatTime(time)} / {formatTime(dur)}
      </span>
    </div>
  );
}

export function Lightbox({ src, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="lightbox" onClick={onClose}>
      <img src={src} alt="Screenshot" onClick={(e) => e.stopPropagation()} />
      <button type="button" className="icon-btn round lightbox-close" onClick={onClose} title="Close (Esc)">
        <Icon name="close" />
      </button>
    </div>
  );
}

export function Thumb({ id, onOpen, onDelete }) {
  const { url } = useBlob(id);
  return (
    <div className="thumb">
      {url ? (
        <img src={url} alt="Screenshot" loading="lazy" onClick={() => onOpen(url)} />
      ) : (
        <div className="thumb-loading" />
      )}
      <button type="button" className="thumb-del" onClick={onDelete} title="Remove screenshot">
        <Icon name="close" size={14} />
      </button>
    </div>
  );
}
