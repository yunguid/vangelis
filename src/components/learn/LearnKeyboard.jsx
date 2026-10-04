import React from 'react';
import { spellMidi } from '../../utils/learn/lesson.js';

/**
 * A piano keyboard drawn to teach on: keys to play marked in their hand's colour (or as a chord
 * tone), keys the learner holds lit, a wrong key flashing, names on the marked keys. Clicking a
 * key plays it like a key of the learner's own piano.
 */

const BLACK = new Set([1, 3, 6, 8, 10]);
const isBlack = (midi) => BLACK.has(((midi % 12) + 12) % 12);

const LearnKeyboard = ({
  low,
  high,
  marks = new Map(),
  held = new Set(),
  struck = new Set(),
  wrong = null,
  fifths = 0,
  showNames = true,
  whiteWidth = 24,
  height = 116,
  onPress,
  onRelease,
  label = 'Piano keyboard'
}) => {
  const from = low - (((low % 12) + 12) % 12); // down to a C
  const to = high + (11 - (((high % 12) + 12) % 12)); // up to a B
  const whites = [];
  const blacks = [];
  let x = 0;
  for (let midi = from; midi <= to; midi += 1) {
    if (isBlack(midi)) {
      blacks.push({ midi, x: x - whiteWidth * 0.3 });
    } else {
      whites.push({ midi, x });
      x += whiteWidth;
    }
  }
  const width = x;
  const blackWidth = whiteWidth * 0.6;
  const blackHeight = height * 0.62;
  const pressed = React.useRef(new Set());

  const down = (midi) => (event) => {
    if (!onPress) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pressed.current.add(midi);
    onPress(midi);
  };
  const up = (midi) => () => {
    if (!pressed.current.delete(midi)) return;
    onRelease?.(midi);
  };

  const keyClass = (midi, black) => {
    const mark = marks.get(midi);
    return [
      'keys__key',
      black ? 'keys__key--black' : 'keys__key--white',
      mark ? `keys__key--${mark}` : '',
      struck.has(midi) ? 'keys__key--struck' : '',
      held.has(midi) ? 'keys__key--held' : ''
    ].filter(Boolean).join(' ');
  };
  const nameOf = (midi) => spellMidi(midi, fifths).name;

  const renderKey = ({ midi, x: keyX }, black) => {
    const w = black ? blackWidth : whiteWidth;
    const h = black ? blackHeight : height;
    const mark = marks.get(midi);
    const named = showNames && (mark || held.has(midi));
    return (
      <g
        key={midi}
        className={keyClass(midi, black)}
        onPointerDown={down(midi)}
        onPointerUp={up(midi)}
        onPointerCancel={up(midi)}
        data-midi={midi}
      >
        <rect x={keyX + 0.5} y="0.5" width={w - 1} height={h - 1} rx={black ? 2.5 : 4} />
        {mark && <circle cx={keyX + w / 2} cy={h - (black ? 11 : 13)} r={black ? 4.2 : 5.2} className="keys__dot" />}
        {named && (
          <text x={keyX + w / 2} y={h - (black ? 22 : 26)} className="keys__name">{nameOf(midi)}</text>
        )}
        {!named && midi === 60 && !black && (
          <text x={keyX + w / 2} y={h - 8} className="keys__c4">C4</text>
        )}
      </g>
    );
  };

  const wrongKey = wrong && wrong.midi >= from && wrong.midi <= to ? wrong : null;
  const wrongGeometry = wrongKey && (isBlack(wrongKey.midi)
    ? { ...blacks.find((key) => key.midi === wrongKey.midi), w: blackWidth, h: blackHeight }
    : { ...whites.find((key) => key.midi === wrongKey.midi), w: whiteWidth, h: height });

  return (
    <svg
      className="keys"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      style={{ '--keys-natural-width': `${width}px`, '--keys-white-count': whites.length }}
      role="img"
      aria-label={label}
    >
      {whites.map((key) => renderKey(key, false))}
      {blacks.map((key) => renderKey(key, true))}
      {wrongGeometry && (
        <rect
          key={wrongKey.serial}
          x={wrongGeometry.x + 0.5}
          y="0.5"
          width={wrongGeometry.w - 1}
          height={wrongGeometry.h - 1}
          rx="3"
          className="keys__wrong"
        />
      )}
    </svg>
  );
};

export default React.memo(LearnKeyboard);
