import React, { useCallback, useRef, useState } from 'react';
import { getLearnHref } from '../utils/routes.js';

const JourneyDialog = React.lazy(() => import('./JourneyDialog.jsx'));

const icon = (children) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">{children}</svg>
);
const PREVIOUS_ICON = icon(<><rect x="6" y="6" width="2" height="12" rx="0.5" /><path d="M18 6.5v11L9.5 12z" /></>);
const NEXT_ICON = icon(<><rect x="16" y="6" width="2" height="12" rx="0.5" /><path d="M6 6.5v11l8.5-5.5z" /></>);
const PLAY_ICON = icon(<path d="M8 5.5v13L18.5 12z" />);
const PAUSE_ICON = icon(<><rect x="7" y="6" width="3.5" height="12" rx="0.5" /><rect x="13.5" y="6" width="3.5" height="12" rx="0.5" /></>);
// A music stand: the piece's piano lesson.
const LEARN_ICON = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4.5 4.5h15v8h-15z" />
    <path d="M7 7.5h10M7 9.8h10" />
    <path d="M12 12.5v7M8.5 20h7" />
  </svg>
);
const JOURNEY_ICON = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 3.5h7l4 4v13H7z" />
    <path d="M10 11.5h5M10 14.5h5M10 17.5h3" />
  </svg>
);

/**
 * What is playing, and its transport: back, play or pause, forward, the piece's name and,
 * for a replica, how it was rebuilt (`journey`, a folder under docs/replicas) in a pop-up, and
 * a way to its piano lesson (`learn`, a slug under #/learn).
 */
const NowPlaying = ({ title, composer, journey, learn, isPlaying, isLoading, onToggle, onPrevious, onNext }) => {
  const [journeyOpen, setJourneyOpen] = useState(false);
  const journeyButton = useRef(null);
  const closeJourney = useCallback(() => {
    setJourneyOpen(false);
    journeyButton.current?.focus();
  }, []);

  return (
    <div className="now-playing" role="group" aria-label="Now playing">
      <button type="button" className="btn btn--icon now-playing__button" aria-label="Previous piece" title="Previous piece" onClick={onPrevious}>
        {PREVIOUS_ICON}
      </button>
      <button
        type="button"
        className="btn btn--icon now-playing__button"
        aria-label={isPlaying ? 'Pause' : 'Play'}
        title={isPlaying ? 'Pause' : 'Play'}
        onClick={onToggle}
        disabled={isLoading}
      >
        {isPlaying ? PAUSE_ICON : PLAY_ICON}
      </button>
      <button type="button" className="btn btn--icon now-playing__button" aria-label="Next piece" title="Next piece" onClick={onNext}>
        {NEXT_ICON}
      </button>
      <p className="now-playing__title" aria-live="polite">
        <span className="now-playing__name">{title}</span>
        {composer && <span className="now-playing__composer">{composer}</span>}
      </p>
      {learn && (
        <a
          className="btn btn--icon now-playing__button"
          href={getLearnHref(learn)}
          aria-label={`Learn to play ${title}`}
          title="Learn to play it"
        >
          {LEARN_ICON}
        </a>
      )}
      {journey && (
        <button
          ref={journeyButton}
          type="button"
          className="btn btn--icon now-playing__button"
          aria-label={`How ${title} was rebuilt`}
          title="How it was rebuilt"
          aria-haspopup="dialog"
          onClick={() => setJourneyOpen(true)}
        >
          {JOURNEY_ICON}
        </button>
      )}
      {journeyOpen && journey && (
        <React.Suspense fallback={null}>
          <JourneyDialog journey={journey} onClose={closeJourney} />
        </React.Suspense>
      )}
    </div>
  );
};

export default React.memo(NowPlaying);
