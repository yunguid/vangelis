import React from 'react';
import { WHITE_KEY_HEIGHT, KEY_LABELS } from '../constants';

const WhiteKey = React.memo(function WhiteKey({ meta, registerKey }) {
  return (
    <div
      ref={(node) => registerKey(meta.noteId, node)}
      className="key-white"
      data-note={meta.noteId}
      data-name={meta.noteName}
      data-octave={meta.octave}
      data-frequency={meta.frequency}
      tabIndex={0}
      style={{ height: WHITE_KEY_HEIGHT }}
    >
      <span className="note-label">{meta.noteName}</span>
      <span className="key-label">{KEY_LABELS[meta.noteId] || ''}</span>
      <span className="key-active-indicator" aria-hidden="true" />
    </div>
  );
});

export default WhiteKey;
