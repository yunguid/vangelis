import React from 'react';
import SidebarNavigation, { BrandHeader } from '../components/Sidebar/SidebarNavigation.jsx';
import { BUILT_IN_STUDIES } from '../data/songStudies.js';
import { getStudySongHref } from '../utils/routes.js';
import './StudySongsPage.css';

const STUDY_ENTRIES = BUILT_IN_STUDIES.map((study) => ({
  ...study,
  href: getStudySongHref(study.slug)
}));

const StudySongsPage = () => {
  // Warm the featured study's parser + MIDI bytes in the first idle slot so
  // opening the flagship card is instant. Only the single featured item is
  // prefetched — the rest of the catalog stays lazy.
  React.useEffect(() => {
    const featured = BUILT_IN_STUDIES.find((study) => study.featuredRank === 1);
    if (!featured?.midiUrl) return undefined;

    let cancelled = false;
    const warm = () => {
      if (cancelled) return;
      import('../utils/midiParser.js').then((midiParser) => {
        if (cancelled) return;
        midiParser.preloadMidiParser().catch(() => {});
        midiParser.preloadMidiFile(featured.midiUrl);
      }).catch(() => {});
    };

    if (typeof window.requestIdleCallback === 'function') {
      const idleId = window.requestIdleCallback(warm, { timeout: 2000 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback?.(idleId);
      };
    }
    const timeoutId = window.setTimeout(warm, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, []);

  return (
    <div className="study-library">
      <main className="study-library__shell">
        <BrandHeader />

        <section className="study-library__panel" aria-label="Song study library">
          <div className="study-library__toolbar">
            <div className="study-library__title-group">
              <h1>Library</h1>
              <span>{STUDY_ENTRIES.length} studies</span>
            </div>
          </div>

          <div className="study-library__list">
            {STUDY_ENTRIES.map((study) => (
              <article
                className={`study-library__study ${study.featuredRank === 1 ? 'study-library__study--featured' : ''}`}
                key={study.id}
              >
                <div className="study-library__study-main">
                  <span className="study-library__study-kicker">
                    {study.featuredRank === 1 ? `Featured · ${study.sourceLabel}` : study.sourceLabel}
                  </span>
                  <strong>{study.title}</strong>
                  <p>
                    {study.meta
                      ? [study.artist, study.meta.key, study.meta.duration].filter(Boolean).join(' · ')
                      : study.artist}
                  </p>
                </div>

                <div className="study-library__study-side">
                  <span>{study.eyebrow}</span>
                  <a className="study-library__action study-library__action--primary" href={study.href}>
                    Open
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
      <SidebarNavigation />
    </div>
  );
};

export default StudySongsPage;
