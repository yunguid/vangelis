import React from 'react';
import { MIN_VELOCITY } from '../../utils/pianoRollPattern.js';

/**
 * Ableton's velocity editor under the grid: one stem per note of the track
 * being edited, as tall as the note is loud, with a bar as long as the note.
 * Dragging a stem moves the whole selection's velocities together; dragging
 * across open lane draws a line through the stems it crosses.
 */
export const VELOCITY_LANE_HEIGHT = 88;
const PAD = 8;
const GRAB_PX = 6;

const clampVelocity = (value) => Math.min(1, Math.max(MIN_VELOCITY, value));
const velocityAt = (y) => clampVelocity(1 - (y - PAD) / (VELOCITY_LANE_HEIGHT - 2 * PAD));
const yFor = (velocity) => PAD + (1 - velocity) * (VELOCITY_LANE_HEIGHT - 2 * PAD);
export const midiVelocity = (velocity) => Math.max(1, Math.round(velocity * 127));

const VelocityLane = ({
  notes,
  selectedIds,
  pxPerBeat,
  onSelect,
  onGestureStart,
  onVelocities,
  onGestureEnd,
  onReadout
}) => {
  const dragRef = React.useRef(null);

  const pointAt = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  // The stem under the pointer: its line or its bar, nearest head first.
  const stemAt = (x, y) => {
    let best = null;
    let bestDistance = Infinity;
    notes.forEach((note) => {
      const left = note.start * pxPerBeat;
      const right = left + note.duration * pxPerBeat;
      const head = yFor(note.velocity);
      const onLine = Math.abs(x - left) <= GRAB_PX;
      const onBar = x >= left && x <= right && Math.abs(y - head) <= GRAB_PX;
      if (!onLine && !onBar) return;
      const distance = Math.abs(y - head) + (onLine ? 0 : 1);
      if (distance < bestDistance) {
        best = note;
        bestDistance = distance;
      }
    });
    return best;
  };

  const handlePointerDown = (event) => {
    if (event.button !== 0) return;
    const { x, y } = pointAt(event);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    onGestureStart();
    const stem = stemAt(x, y);
    if (stem) {
      let ids = selectedIds;
      if (!selectedIds.has(stem.id)) {
        ids = event.shiftKey ? new Set([...selectedIds, stem.id]) : new Set([stem.id]);
        onSelect(ids);
      }
      const origins = new Map(notes.filter((note) => ids.has(note.id)).map((note) => [note.id, note.velocity]));
      dragRef.current = { mode: 'stem', y0: y, origins, anchorId: stem.id };
      onReadout(midiVelocity(stem.velocity));
      return;
    }
    // Open lane: draw. With a selection, only the selected notes take the line.
    dragRef.current = { mode: 'line', x, y };
    const hit = notes.filter((note) => (
      (selectedIds.size === 0 || selectedIds.has(note.id))
      && Math.abs(note.start * pxPerBeat - x) <= GRAB_PX
    ));
    if (hit.length > 0) {
      onVelocities(new Map(hit.map((note) => [note.id, velocityAt(y)])));
    }
    onReadout(midiVelocity(velocityAt(y)));
  };

  const handlePointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag) return;
    const { x, y } = pointAt(event);
    if (drag.mode === 'stem') {
      const delta = -(y - drag.y0) / (VELOCITY_LANE_HEIGHT - 2 * PAD);
      const next = new Map();
      drag.origins.forEach((origin, id) => next.set(id, clampVelocity(origin + delta)));
      onVelocities(next);
      onReadout(midiVelocity(next.get(drag.anchorId)));
      return;
    }
    // Every stem between the last pointer position and this one takes the
    // velocity of the line joining them at its x.
    const [x0, y0, x1, y1] = drag.x <= x ? [drag.x, drag.y, x, y] : [x, y, drag.x, drag.y];
    const next = new Map();
    notes.forEach((note) => {
      if (selectedIds.size > 0 && !selectedIds.has(note.id)) return;
      const stemX = note.start * pxPerBeat;
      if (stemX < x0 - 1 || stemX > x1 + 1) return;
      const t = x1 === x0 ? 1 : (stemX - x0) / (x1 - x0);
      next.set(note.id, velocityAt(y0 + (y1 - y0) * Math.min(1, Math.max(0, t))));
    });
    if (next.size > 0) onVelocities(next);
    dragRef.current = { ...drag, x, y };
    onReadout(midiVelocity(velocityAt(y)));
  };

  const handlePointerUp = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    onReadout(null);
    onGestureEnd();
  };

  return (
    <div
      className="velocity-lane"
      role="application"
      aria-label="Velocity: drag a stem to change how hard its note plays, or drag across the lane to draw"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {notes.map((note) => {
        const head = yFor(note.velocity);
        return (
          <div
            key={note.id}
            data-velocity-id={note.id}
            className={`velocity-lane__stem${selectedIds.has(note.id) ? ' is-selected' : ''}${note.muted ? ' is-muted' : ''}`}
            style={{
              left: note.start * pxPerBeat,
              top: head,
              width: Math.max(note.duration * pxPerBeat - 1, 3)
            }}
          />
        );
      })}
    </div>
  );
};

export default React.memo(VelocityLane);
