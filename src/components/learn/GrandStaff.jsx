import React from 'react';
import { keySignatureAccidental, keySignatureLetters, spellMidi } from '../../utils/learn/lesson.js';

/**
 * A grand staff in proportional notation: each step sits where it falls in time (with room
 * enough between neighbours to read), its notes on the treble staff for the right hand and the
 * bass staff for the left, with a faint trail for how long each is held. The transcriptions
 * keep the record's free timing, so this shows when and which notes rather than inventing
 * rhythm values the performance does not have.
 */

const HALF = 5; // one staff step (line to space), px
const TREBLE_TOP_STEP = 38; // F5
const BASS_TOP_STEP = 26; // A3
const STAFF_GAP = 64; // bottom treble line to top bass line
const ACCIDENTAL = { '-1': '♭', 0: '♮', 1: '♯' };
const LETTER_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
// Where each sharp and flat of a key signature sits (treble; the bass is two octaves lower).
const SHARP_STEPS = [38, 35, 39, 36, 33, 37, 34];
const FLAT_STEPS = [34, 37, 33, 36, 32, 35, 31];

// A right hand that lives above the staff is written an octave down under an 8va line, as
// engraved music does, rather than on a ladder of ledger lines.
const OTTAVA_MEDIAN_STEP = 42; // C6

const staffOf = (note, step) => {
  if (note.hand === 'right') return step < BASS_TOP_STEP ? 'bass' : 'treble';
  return step > 30 ? 'treble' : 'bass';
};

const TrebleClef = ({ x, y }) => (
  <g transform={`translate(${x} ${y})`} className="staff__clef">
    <path
      d="M2 2C-4 2-6-6 0-9C7-12 12-4 9 3C6 10-8 11-11 2C-14-8-2-16 4-24C8-30 9-40 5-46C2-50-3-46-3-38C-3-26 4-8 4 8C4 16 3 22-2 23C-6 24-8 19-5 17"
      fill="none"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="-4.6" cy="19.4" r="2.6" />
  </g>
);

const BassClef = ({ x, y }) => (
  <g transform={`translate(${x} ${y})`} className="staff__clef">
    <circle cx="1.6" cy="0.4" r="3.4" />
    <path d="M0-1C1-10 15-11 16-1C17 10 8 21-4 27" fill="none" strokeWidth="2.6" strokeLinecap="round" />
    <circle cx="21" cy="-5" r="1.8" />
    <circle cx="21" cy="5" r="1.8" />
  </g>
);

const GrandStaff = ({
  steps,
  start,
  end,
  fifths = 0,
  width = 880,
  hands = 'both',
  chords = [],
  showNames = false,
  cursorTime = null,
  struck = [],
  playheadTime = null,
  compact = false,
  label
}) => {
  const layout = React.useMemo(() => {
    const spelled = steps.map((step) => step.notes.map((note) => {
      const spelling = spellMidi(note.midi, fifths);
      const staff = staffOf(note, spelling.step);
      const signature = keySignatureAccidental(spelling.letter, fifths);
      return { note, spelling, staff, accidental: spelling.accidental !== signature ? spelling.accidental : null };
    }));
    const steps_ = spelled.flat();
    const rawTreble = steps_.filter((n) => n.staff === 'treble').map((n) => n.spelling.step).sort((a, b) => a - b);
    const ottava = rawTreble.length > 0 && rawTreble[Math.floor(rawTreble.length / 2)] >= OTTAVA_MEDIAN_STEP;
    steps_.forEach((n) => {
      n.drawn = n.staff === 'treble' && ottava ? n.spelling.step - 7 : n.spelling.step;
    });
    const trebleSteps = steps_.filter((n) => n.staff === 'treble').map((n) => n.drawn);
    const bassSteps = steps_.filter((n) => n.staff === 'bass').map((n) => n.drawn);
    const highest = Math.max(TREBLE_TOP_STEP, ...trebleSteps);
    const lowest = Math.min(18, ...bassSteps);
    const chordRow = (chords.length && !compact ? 22 : 0) + (ottava ? 14 : 0);
    const trebleTop = chordRow + 18 + (highest - TREBLE_TOP_STEP) * HALF;
    const bassTop = trebleTop + 8 * HALF + STAFF_GAP;
    const height = bassTop + 8 * HALF + 18 + (18 - lowest) * HALF;
    const yOf = (staff, step) => (staff === 'treble'
      ? trebleTop + (TREBLE_TOP_STEP - step) * HALF
      : bassTop + (BASS_TOP_STEP - step) * HALF);

    const signatureWidth = Math.abs(fifths) * 9;
    const firstX = 62 + signatureWidth + 22;
    const span = Math.max(0.5, end - start);
    const pxPerSecond = compact ? 0 : Math.max(18, (width - firstX - 40) / span);
    const xs = [];
    spelled.forEach((notes, i) => {
      const proportional = firstX + (steps[i].time - start) * pxPerSecond;
      const room = (showNames ? 30 : 24) + (notes.some((n) => n.accidental !== null) ? 9 : 0);
      xs.push(i === 0 ? Math.max(firstX, proportional) : Math.max(proportional, xs[i - 1] + room));
    });
    const lastX = xs.length ? xs[xs.length - 1] : firstX;
    const timeToX = (time) => {
      if (!steps.length) return firstX;
      if (time <= steps[0].time) return xs[0];
      for (let i = 1; i < steps.length; i += 1) {
        if (time <= steps[i].time) {
          const t = (time - steps[i - 1].time) / Math.max(1e-6, steps[i].time - steps[i - 1].time);
          return xs[i - 1] + t * (xs[i] - xs[i - 1]);
        }
      }
      return lastX + (time - steps[steps.length - 1].time) * Math.max(pxPerSecond, 40);
    };
    const totalWidth = compact ? Math.max(width, lastX + 46) : Math.max(width, lastX + 44);
    return { spelled, trebleTop, bassTop, height, yOf, xs, timeToX, totalWidth, firstX, ottava };
  }, [steps, start, end, fifths, width, chords.length, compact, showNames]);

  const { spelled, trebleTop, bassTop, height, yOf, xs, timeToX, totalWidth, firstX, ottava } = layout;
  const staffLines = (top) => [0, 1, 2, 3, 4].map((i) => (
    <line key={i} x1="8" x2={totalWidth - 6} y1={top + i * 2 * HALF} y2={top + i * 2 * HALF} className="staff__line" />
  ));
  const signature = keySignatureLetters(fifths).map((letter, i) => {
    const steps_ = fifths > 0 ? SHARP_STEPS : FLAT_STEPS;
    const glyph = fifths > 0 ? '♯' : '♭';
    return (
      <React.Fragment key={letter}>
        <text x={58 + i * 9} y={yOf('treble', steps_[i]) + 4.5} className="staff__signature">{glyph}</text>
        <text x={58 + i * 9} y={yOf('bass', steps_[i] - 14) + 4.5} className="staff__signature">{glyph}</text>
      </React.Fragment>
    );
  });

  const headRx = showNames ? 7.4 : 5.8;
  const headRy = showNames ? 5.6 : 4.3;
  const cursorIndex = cursorTime === null ? -1 : steps.findIndex((step) => Math.abs(step.time - cursorTime) < 1e-6);
  const bottom = bassTop + 8 * HALF;
  const bars = [];
  steps.forEach((step, i) => {
    if (i === 0 || !Number.isFinite(step.measure)) return;
    const bar = Math.floor(step.measure);
    if (bar > Math.floor(steps[i - 1].measure)) bars.push({ x: (xs[i - 1] + xs[i]) / 2 + 2, bar });
  });

  return (
    <svg
      className={`staff${compact ? ' staff--compact' : ''}`}
      width={totalWidth}
      height={height}
      viewBox={`0 0 ${totalWidth} ${height}`}
      role="img"
      aria-label={label}
    >
      {/* The system: brace, opening line, staves, clefs and key signature. */}
      <path
        d={`M6 ${trebleTop}C-2 ${trebleTop + 22} 8 ${(trebleTop + bottom) / 2 - 16} 0 ${(trebleTop + bottom) / 2}C8 ${(trebleTop + bottom) / 2 + 16} -2 ${bottom - 22} 6 ${bottom}`}
        className="staff__brace"
      />
      <line x1="8" x2="8" y1={trebleTop} y2={bottom} className="staff__line" />
      {staffLines(trebleTop)}
      {staffLines(bassTop)}
      <TrebleClef x={30} y={yOf('treble', 32)} />
      <BassClef x={22} y={yOf('bass', 24)} />
      {signature}

      {ottava && (
        <g className="staff__ottava">
          <text x={firstX - 18} y={chords.length && !compact ? 34 : 14}>8va</text>
          <line x1={firstX + 6} x2={totalWidth - 20} y1={(chords.length && !compact ? 34 : 14) - 4} y2={(chords.length && !compact ? 34 : 14) - 4} />
          <line x1={totalWidth - 20} x2={totalWidth - 20} y1={(chords.length && !compact ? 34 : 14) - 4} y2={(chords.length && !compact ? 34 : 14) + 4} />
        </g>
      )}

      {bars.map(({ x, bar }) => (
        <g key={bar}>
          <line x1={x} x2={x} y1={trebleTop} y2={bottom} className="staff__bar" />
          <text x={x + 3} y={trebleTop - 6} className="staff__bar-number">{bar}</text>
        </g>
      ))}

      {cursorIndex >= 0 && (
        <rect
          x={xs[cursorIndex] - 16}
          y={trebleTop - 14}
          width="32"
          height={bottom - trebleTop + 28}
          rx="10"
          className="staff__cursor"
        />
      )}

      {!compact && chords.map((chord) => (
        <text key={`${chord.time}:${chord.label}`} x={timeToX(chord.time) - 6} y="16" className="staff__chord">
          {chord.label}
        </text>
      ))}

      {spelled.map((notes, i) => {
        const x = xs[i];
        const done = cursorTime !== null && steps[i].time < cursorTime - 1e-6;
        const current = i === cursorIndex;
        // Seconds in one chord on one staff: every other note steps right of the stem side.
        const offsets = new Map();
        ['treble', 'bass'].forEach((staff) => {
          const onStaff = notes.filter((n) => n.staff === staff).sort((a, b) => a.drawn - b.drawn);
          onStaff.forEach((n, k) => {
            const previous = onStaff[k - 1];
            const shifted = previous && n.drawn - previous.drawn === 1 && !offsets.get(previous);
            offsets.set(n, shifted ? headRx * 1.75 : 0);
          });
        });
        return (
          <g key={i} className={`staff__step${done ? ' staff__step--done' : ''}${current ? ' staff__step--current' : ''}`}>
            {notes.map((n) => {
              const { note, spelling, staff, accidental, drawn } = n;
              const dim = hands !== 'both' && note.hand !== hands;
              const cx = x + offsets.get(n);
              const cy = yOf(staff, drawn);
              const ledgers = [];
              if (staff === 'treble') {
                for (let s = 28; s >= drawn; s -= 2) ledgers.push(s);
                for (let s = 40; s <= drawn; s += 2) ledgers.push(s);
              } else {
                for (let s = 16; s >= drawn; s -= 2) ledgers.push(s);
                for (let s = 28; s <= drawn; s += 2) ledgers.push(s);
              }
              const tailEnd = Math.min(timeToX(note.time + note.duration), timeToX(end));
              const hit = current && struck.includes(note.midi);
              const classes = [
                'staff__note',
                `staff__note--${note.hand}`,
                dim ? 'staff__note--dim' : '',
                hit ? 'staff__note--hit' : ''
              ].filter(Boolean).join(' ');
              return (
                <g key={note.midi} className={classes}>
                  {!compact && tailEnd > cx + 8 && (
                    <rect x={cx} y={cy - 1.6} width={tailEnd - cx} height="3.2" rx="1.6" className="staff__tail" />
                  )}
                  {ledgers.map((s) => (
                    <line key={s} x1={cx - headRx - 4} x2={cx + headRx + 4} y1={yOf(staff, s)} y2={yOf(staff, s)} className="staff__ledger" />
                  ))}
                  {accidental !== null && (
                    <text x={cx - headRx - 11} y={cy + 4.5} className="staff__accidental">{ACCIDENTAL[accidental]}</text>
                  )}
                  <ellipse cx={cx} cy={cy} rx={headRx} ry={headRy} transform={`rotate(-18 ${cx} ${cy})`} className="staff__head" />
                  {showNames && (
                    <text x={cx} y={cy + 3} className="staff__head-name">{LETTER_NAMES[spelling.letter]}</text>
                  )}
                </g>
              );
            })}
          </g>
        );
      })}

      {playheadTime !== null && (
        <line x1={timeToX(playheadTime)} x2={timeToX(playheadTime)} y1={trebleTop - 16} y2={bottom + 16} className="staff__playhead" />
      )}
    </svg>
  );
};

export default React.memo(GrandStaff);
