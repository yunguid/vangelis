import React from 'react';
import '../styles/opening-performance.css';

export default function OpeningPerformance({ status, onListen, onStop }) {
  if (status === 'done') return null;
  return (
    <div className="opening-performance" aria-label="Opening performance">
      <span className="opening-performance__credit">
        <a href="https://c418.org/albums/minecraft-volume-alpha/" target="_blank" rel="noreferrer">
          Subwoofer Lullaby <span>· C418</span>
        </a>
        <span className="opening-performance__hint" role="status">
          {status === 'loading' ? 'Preparing the piano…' : status === 'error'
            ? 'Opening unavailable. The keyboard is yours.'
            : status === 'ready' ? 'Listen, or play a key to begin.' : 'Play any key to take over.'}
        </span>
      </span>
      {status === 'ready' && <button type="button" onClick={onListen}>Listen</button>}
      <button type="button" onClick={onStop} aria-label="Stop opening performance">
        {status === 'playing' ? 'Stop' : 'Skip'}
      </button>
    </div>
  );
}
