import React from 'react';
import { BLACK_KEY_WIDTH, BLACK_KEY_HEIGHT, KEY_LABELS } from '../constants';

const BlackKey = React.memo(function BlackKey({ meta, registerKey }) {
  return (
    <div
      ref={(node) => registerKey(meta.noteId, node)}
      className="key-black"
      data-note={meta.noteId}
      data-name={meta.noteName}
      data-octave={meta.octave}
      data-frequency={meta.frequency}
      tabIndex={0}
      style={{
        left: meta.leftOffset,
        width: BLACK_KEY_WIDTH,
        height: BLACK_KEY_HEIGHT
      }}
    >
      <span className="note-label">{meta.noteName}</span>
      <span className="key-label">{KEY_LABELS[meta.noteId] || ''}</span>
      <span className="key-active-indicator" aria-hidden="true" />
    </div>
  );
});

export default BlackKey;
