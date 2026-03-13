import React, { useCallback, useMemo, useState, useTransition } from 'react';
import { APP_ROUTES, getRouteHref } from '../utils/appRoutes.js';
import { withBase } from '../utils/baseUrl.js';

const DEFAULT_BPM = '136';

const toVocalSearchUrl = () => {
  const relative = withBase('api/vocal-search');
  if (typeof window === 'undefined') return relative;
  return new URL(relative, window.location.href).toString();
};

const normalizeBpm = (value) => {
  const parsed = Number.parseInt(`${value}`, 10);
  return Number.isFinite(parsed) && parsed > 0 ? String(parsed) : DEFAULT_BPM;
};

const VocalFinderPage = () => {
  const [bpm, setBpm] = useState(DEFAULT_BPM);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchPayload, setSearchPayload] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [, startTransition] = useTransition();

  const resolvedBpm = useMemo(() => normalizeBpm(bpm), [bpm]);
  const results = Array.isArray(searchPayload?.results) ? searchPayload.results : [];
  const warnings = Array.isArray(searchPayload?.warnings) ? searchPayload.warnings : [];
  const modelLabel = searchPayload?.configuration?.openaiModel || 'gpt-5.4';

  const handleSearch = useCallback(async (event) => {
    event.preventDefault();
    setHasSearched(true);
    setSearchLoading(true);
    setSearchError('');

    try {
      const response = await fetch(toVocalSearchUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bpm: resolvedBpm
        })
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || `API returned ${response.status}`);
      }

      startTransition(() => {
        setSearchPayload(payload);
      });
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : 'Search failed.');
    } finally {
      setSearchLoading(false);
    }
  }, [resolvedBpm, startTransition]);

  return (
    <div className="app-stage vocal-finder-stage">
      <div className="vocal-finder-page">
        <header className="zone-top tier-subtle content-tertiary vocal-finder-header">
          <div className="brand-block">
            <div className="brand-title">Vocal Finder</div>
            <p className="vocal-finder-subtitle">
              BPM-first female vocal search.
            </p>
          </div>
          <a href={getRouteHref(APP_ROUTES.synth)} className="button-primary vocal-finder-home-link">
            Open synth
          </a>
        </header>

        <main className="vocal-finder-main">
          <section className="panel elevated vocal-finder-controls">
            <div className="vocal-finder-section-header">
              <h1>Find female vocals around a BPM pocket.</h1>
              <p>
                Drop in a tempo and run it. The server uses {modelLabel} to expand queries and rank source hits.
              </p>
            </div>

            <form className="vocal-finder-search-row" onSubmit={handleSearch}>
              <label className="vocal-finder-field" htmlFor="vocal-finder-bpm">
                <span className="vocal-finder-label">Target BPM</span>
                <input
                  id="vocal-finder-bpm"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  value={bpm}
                  onChange={(event) => setBpm(event.target.value)}
                  className="vocal-finder-text-input"
                  placeholder={DEFAULT_BPM}
                />
              </label>

              <button
                type="submit"
                className="button-primary vocal-finder-search-button"
                disabled={searchLoading}
              >
                {searchLoading ? 'Searching...' : 'Find vocals'}
              </button>
            </form>

            <p className="vocal-finder-field-note">
              Results stay link-first: previews, scores, and source pages, not mirrored vocals.
            </p>
          </section>

          <section className="panel vocal-finder-results">
            <div className="vocal-finder-section-header">
              <h2>Results</h2>
              <p>
                {hasSearched
                  ? `Looking around ${resolvedBpm} BPM.`
                  : `Set a BPM and run a search around ${resolvedBpm} BPM.`}
              </p>
            </div>

            <div className="vocal-finder-api-panel">
              {warnings.length > 0 && (
                <div className="vocal-finder-warning-list" aria-label="Search warnings">
                  {warnings.map((warning) => (
                    <p key={warning} className="vocal-finder-warning">{warning}</p>
                  ))}
                </div>
              )}

              {!hasSearched && (
                <p className="vocal-finder-empty">
                  Enter a BPM and hit <strong>Find vocals</strong>.
                </p>
              )}

              {hasSearched && searchError && (
                <p className="vocal-finder-empty">{searchError}</p>
              )}

              {hasSearched && !searchError && !searchLoading && results.length === 0 && (
                <p className="vocal-finder-empty">
                  No inline matches landed this round. Try another BPM or rerun the pass later.
                </p>
              )}

              {results.length > 0 && (
                <div className="vocal-finder-audition-grid">
                  {results.map((result) => (
                    <article key={result.id} className="vocal-finder-audition-card">
                      <div className="vocal-finder-source-topline">
                        <div>
                          <h3>{result.title}</h3>
                          <p>{result.creator ? `by ${result.creator}` : 'Source result'}</p>
                        </div>
                        <span className={`vocal-finder-access vocal-finder-access--${result.confidenceLabel || 'review'}`}>
                          {result.confidenceLabel || 'review'}
                        </span>
                      </div>

                      <div className="effect-summary">
                        <span className="effect-chip">{resolvedBpm} BPM target</span>
                        {typeof result.bpm === 'number' && <span className="effect-chip">{result.bpm} BPM</span>}
                        {typeof result.duration === 'number' && (
                          <span className="effect-chip">{result.duration.toFixed(1)}s</span>
                        )}
                        {typeof result.avgRating === 'number' && (
                          <span className="effect-chip">{result.avgRating.toFixed(1)} rating</span>
                        )}
                        {result.license && <span className="effect-chip">{result.license}</span>}
                      </div>

                      {result.previewUrl && (
                        <audio className="vocal-finder-audio" controls preload="none" src={result.previewUrl}>
                          Your browser does not support audio playback.
                        </audio>
                      )}

                      <p className="vocal-finder-rights">{result.matchReason}</p>

                      <div className="vocal-finder-source-actions">
                        <a
                          className="button-primary vocal-finder-source-link"
                          href={result.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open source
                        </a>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default VocalFinderPage;
