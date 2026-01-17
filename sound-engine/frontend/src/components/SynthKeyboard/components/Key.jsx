import React from 'react';
import { BLACK_KEY_HEIGHT, BLACK_KEY_WIDTH, KEY_LABELS, WHITE_KEY_HEIGHT } from '../constants';

const Key = React.memo(function Key({ meta, registerKey, variant }) {
  const isBlack = variant === 'black';
  const className = isBlack ? 'key-black' : 'key-white';
  const style = isBlack
    ? {
        left: meta.leftOffset,
        width: BLACK_KEY_WIDTH,
        height: BLACK_KEY_HEIGHT
      }
    : { height: WHITE_KEY_HEIGHT };

  return (
    <div
      ref={(node) => registerKey(meta.noteId, node)}
      className={className}
      data-note={meta.noteId}
      data-name={meta.noteName}
      data-octave={meta.octave}
      data-frequency={meta.frequency}
      tabIndex={0}
      style={style}
    >
      <span className="note-label">{meta.noteName}</span>
      <span className="key-label">{KEY_LABELS[meta.noteId] || ''}</span>
      <span className="key-active-indicator" aria-hidden="true" />
    </div>
  );
});

export default Key;
