import React, { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import {
  VOCAL_ACCESS_FILTERS,
  VOCAL_DISCOVERY_SOURCES,
  VOCAL_FORMATS,
  VOCAL_GUARDRAILS,
  VOCAL_SEARCH_PRESETS,
  VOCAL_TEXTURES,
  buildVocalSearchSpec
} from '../data/vocalFinderSources.js';
import { APP_ROUTES, getRouteHref } from '../utils/appRoutes.js';
import { withBase } from '../utils/baseUrl.js';

const DEFAULT_TEXTURE = VOCAL_TEXTURES[0]?.id || 'sultry';
const DEFAULT_FORMAT = VOCAL_FORMATS[0]?.id || 'hooks';
const DEFAULT_BPM = '136';

const toVocalSearchUrl = () => {
  const relative = withBase('api/vocal-search');
  if (typeof window === 'undefined') return relative;
  return new URL(relative, window.location.href).toString();
};

const mapFallbackLaunchers = (sources, searchSpec) => (
  sources.map((source) => ({
    id: source.id,
    name: source.name,
    access: source.access,
    rights: source.rights,
    description: source.description,
    hint: source.getHint(searchSpec),
    href: source.getHref(searchSpec),
    ctaLabel: source.ctaLabel
  }))
);

const VocalFinderPage = () => {
  const [textureId, setTextureId] = useState(DEFAULT_TEXTURE);
  const [formatId, setFormatId] = useState(DEFAULT_FORMAT);
  const [accessFilter, setAccessFilter] = useState('all');
  const [extraTerms, setExtraTerms] = useState('');
  const [bpm, setBpm] = useState(DEFAULT_BPM);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState('');
  const [configuration, setConfiguration] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchPayload, setSearchPayload] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [, startTransition] = useTransition();

  const searchSpec = useMemo(
    () => buildVocalSearchSpec({ textureId, formatId, extraTerms, bpm }),
    [bpm, extraTerms, formatId, textureId]
  );

  const visibleSources = useMemo(() => {
    return VOCAL_DISCOVERY_SOURCES.filter((source) => {
      if (accessFilter === 'all') return true;
      return source.access === accessFilter;
    });
  }, [accessFilter]);

  const fallbackLaunchers = useMemo(
    () => mapFallbackLaunchers(visibleSources, searchSpec),
    [searchSpec, visibleSources]
  );

  const launchers = searchPayload?.query?.accessFilter === accessFilter && searchPayload?.launchers?.length
    ? searchPayload.launchers
    : fallbackLaunchers;
  const results = Array.isArray(searchPayload?.results) ? searchPayload.results : [];
  const warnings = Array.isArray(searchPayload?.warnings) ? searchPayload.warnings : [];
  const laneSummary = searchPayload?.lane?.summary || null;
  const queryVariants = Array.isArray(searchPayload?.lane?.queryVariants)
    ? searchPayload.lane.queryVariants
    : [];
  const tagTargets = Array.isArray(searchPayload?.lane?.tagTargets)
    ? searchPayload.lane.tagTargets
    : [];

  useEffect(() => {
    let cancelled = false;

    const loadConfiguration = async () => {
      setConfigLoading(true);
      setConfigError('');

      try {
        const response = await fetch(toVocalSearchUrl(), { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }

        const payload = await response.json();
        if (cancelled) return;
        setConfiguration(payload?.configuration || null);
      } catch (error) {
        if (cancelled) return;
        setConfigError(error instanceof Error ? error.message : 'Could not load backend status.');
      } finally {
        if (!cancelled) {
          setConfigLoading(false);
        }
      }
    };

    loadConfiguration();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSearch = useCallback(async () => {
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
          bpm: searchSpec.bpm || DEFAULT_BPM,
          texture: textureId,
          format: formatId,
          accessFilter,
          extraTerms
        })
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || `API returned ${response.status}`);
      }

      startTransition(() => {
        setSearchPayload(payload);
        if (payload?.configuration) {
          setConfiguration(payload.configuration);
        }
      });
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : 'Search failed.');
    } finally {
      setSearchLoading(false);
    }
  }, [accessFilter, extraTerms, formatId, searchSpec.bpm, startTransition, textureId]);

  const applyPreset = (preset) => {
    setTextureId(preset.toneId);
    setFormatId(preset.formatId);
    setExtraTerms(preset.extraTerms || '');
    if (preset.bpm) {
      setBpm(String(preset.bpm));
    }
  };

  const configLabel = (() => {
    if (configLoading) return 'checking';
    if (configError) return 'offline';
    if (configuration?.openaiEnabled && configuration?.freesoundEnabled) return 'armed';
    return 'partial';
  })();

  return (
    <div className="app-stage vocal-finder-stage">
      <div className="vocal-finder-page">
        <header className="zone-top tier-subtle content-tertiary vocal-finder-header">
          <div className="brand-block">
            <div className="brand-title">Vocal Finder</div>
            <p className="vocal-finder-subtitle">
              Female vocal texture search, but kept inside legal source lanes.
            </p>
          </div>
          <a href={getRouteHref(APP_ROUTES.synth)} className="button-primary vocal-finder-home-link">
            Open synth
          </a>
        </header>

        <main className="vocal-finder-main">
          <section className="panel elevated vocal-finder-hero">
            <div className="vocal-finder-hero-copy">
              <p className="vocal-finder-eyebrow">Legal discovery page</p>
              <h1>Find sultry, airy, or cinematic female vocals without scraping anything.</h1>
              <p className="vocal-finder-lede">
                This lane is UKG, bassline, and speed garage: pitched-up R&amp;B hooks, swung drums, and female toplines living mostly around 133 to 137 BPM.
              </p>
            </div>
            <div className="vocal-finder-hero-chips" aria-label="Current search summary">
              <span className="control-chip">{searchSpec.bpm ? `${searchSpec.bpm} BPM` : 'Any BPM'}</span>
              <span className="control-chip">{searchSpec.texture.label}</span>
              <span className="control-chip">{searchSpec.format.label}</span>
              <span className="control-chip">{accessFilter === 'all' ? 'Free + paid' : accessFilter}</span>
            </div>
          </section>

          <section className="vocal-finder-grid">
            <div className="panel vocal-finder-controls">
              <div className="vocal-finder-section-header">
                <h2>Dial it in</h2>
                <p>Describe the lane, then let the backend plan and rank legal source results.</p>
              </div>

              <div className="vocal-finder-status-row">
                <span className={`vocal-finder-access vocal-finder-access--${configLabel}`}>
                  {configLabel}
                </span>
                <p className="vocal-finder-field-note">
                  {configLoading && 'Checking backend keys and provider availability.'}
                  {configError && `Backend status failed: ${configError}`}
                  {!configLoading && !configError && (
                    configuration?.openaiEnabled && configuration?.freesoundEnabled
                      ? `Server search is ready on ${configuration.openaiModel}.`
                      : 'Inline ranking needs OPENAI_API_KEY and FREESOUND_API_KEY on the server.'
                  )}
                </p>
              </div>

              <div className="vocal-finder-inline-grid">
                <label className="vocal-finder-field">
                  <span className="vocal-finder-label">Target BPM</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    step="1"
                    value={bpm}
                    onChange={(event) => setBpm(event.target.value)}
                    className="vocal-finder-text-input"
                    placeholder="136"
                  />
                </label>

                <label className="vocal-finder-field">
                  <span className="vocal-finder-label">Extra terms</span>
                  <input
                    type="search"
                    value={extraTerms}
                    onChange={(event) => setExtraTerms(event.target.value)}
                    className="vocal-finder-text-input"
                    placeholder="ex: rnb, whispered, glossy, minor key"
                  />
                </label>
              </div>

              <div className="vocal-finder-field">
                <span className="vocal-finder-label">Texture</span>
                <div className="segment-grid">
                  {VOCAL_TEXTURES.map((texture) => (
                    <button
                      key={texture.id}
                      type="button"
                      className={`segment-button ${texture.id === textureId ? 'is-active' : ''}`}
                      onClick={() => setTextureId(texture.id)}
                    >
                      {texture.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="vocal-finder-field">
                <span className="vocal-finder-label">Format</span>
                <div className="segment-grid">
                  {VOCAL_FORMATS.map((format) => (
                    <button
                      key={format.id}
                      type="button"
                      className={`segment-button ${format.id === formatId ? 'is-active' : ''}`}
                      onClick={() => setFormatId(format.id)}
                    >
                      {format.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="vocal-finder-field">
                <span className="vocal-finder-label">Access</span>
                <div className="segment-grid">
                  {VOCAL_ACCESS_FILTERS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={`segment-button ${option.id === accessFilter ? 'is-active' : ''}`}
                      onClick={() => setAccessFilter(option.id)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="vocal-finder-field">
                <span className="vocal-finder-label">Search phrase</span>
                <div className="effect-summary">
                  {searchSpec.bpm && <span className="effect-chip">{searchSpec.bpm} BPM +/- 2</span>}
                  <span className="effect-chip">{searchSpec.displayQuery}</span>
                </div>
              </div>

              <div className="vocal-finder-field">
                <span className="vocal-finder-label">Style presets</span>
                <div className="vocal-finder-preset-grid">
                  {VOCAL_SEARCH_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className="button-icon vocal-finder-preset"
                      onClick={() => applyPreset(preset)}
                      aria-label={`Apply ${preset.label} preset`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                className="button-primary vocal-finder-search-button"
                onClick={handleSearch}
                disabled={searchLoading}
              >
                {searchLoading ? 'Searching...' : 'Find vocals'}
              </button>

              <p className="vocal-finder-field-note">
                This searches licensable/public sources only. It does not rip copyrighted song vocals from the web.
              </p>
            </div>

            <div className="panel vocal-finder-results">
              <div className="vocal-finder-section-header">
                <h2>AI-ranked picks</h2>
                <p>Preview here, then jump out to the source page for the actual rights check and download.</p>
              </div>

              <div className="vocal-finder-api-panel">
                <div className="vocal-finder-source-topline">
                  <div>
                    <h3>Search pass</h3>
                    <p>Server-side planning uses GPT-5.4 when available, then ranks official source results around your BPM.</p>
                  </div>
                  <span className={`vocal-finder-access vocal-finder-access--${configLabel}`}>
                    {searchLoading ? 'searching' : configLabel}
                  </span>
                </div>

                {laneSummary && (
                  <div className="vocal-finder-lane-panel">
                    <p className="vocal-finder-empty">{laneSummary}</p>
                    <div className="effect-summary">
                      {queryVariants.map((query) => (
                        <span key={query} className="effect-chip">{query}</span>
                      ))}
                    </div>
                    <div className="effect-summary">
                      {tagTargets.map((tag) => (
                        <span key={tag} className="effect-chip">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}

                {warnings.length > 0 && (
                  <div className="vocal-finder-warning-list" aria-label="Search warnings">
                    {warnings.map((warning) => (
                      <p key={warning} className="vocal-finder-warning">{warning}</p>
                    ))}
                  </div>
                )}

                {!hasSearched && (
                  <p className="vocal-finder-empty">
                    Hit <strong>Find vocals</strong> to run a BPM-first search in this lane.
                  </p>
                )}

                {hasSearched && searchError && (
                  <p className="vocal-finder-empty">{searchError}</p>
                )}

                {hasSearched && !searchError && !searchLoading && results.length === 0 && (
                  <p className="vocal-finder-empty">
                    No inline matches landed this round. Use the provider launchers below or widen the terms a bit.
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
                          <span className="effect-chip">score {typeof result.score === 'number' ? result.score.toFixed(2) : '--'}</span>
                          {searchSpec.bpm && <span className="effect-chip">{searchSpec.bpm} BPM target</span>}
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

                        {Array.isArray(result.qualityFlags) && result.qualityFlags.length > 0 && (
                          <div className="effect-summary">
                            {result.qualityFlags.map((flag) => (
                              <span key={flag} className="effect-chip">{flag}</span>
                            ))}
                          </div>
                        )}

                        {Array.isArray(result.riskFlags) && result.riskFlags.length > 0 && (
                          <div className="vocal-finder-risk-list" aria-label="Risk flags">
                            {result.riskFlags.map((flag) => (
                              <span key={flag} className="vocal-finder-risk-chip">{flag}</span>
                            ))}
                          </div>
                        )}

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

              <div className="vocal-finder-section-header">
                <h2>Provider launchers</h2>
                <p>These jump to provider search pages or catalog views. No crawling, no mirroring.</p>
              </div>

              <div className="vocal-finder-results-grid">
                {launchers.map((source) => (
                  <article key={source.id} className="vocal-finder-source-card">
                    <div className="vocal-finder-source-topline">
                      <div>
                        <h3>{source.name}</h3>
                        <p>{source.description}</p>
                      </div>
                      <span className={`vocal-finder-access vocal-finder-access--${source.access}`}>
                        {source.access}
                      </span>
                    </div>

                    <div className="effect-summary">
                      {searchSpec.bpm && <span className="effect-chip">{searchSpec.bpm} BPM lane</span>}
                      <span className="effect-chip">{source.hint}</span>
                    </div>

                    <p className="vocal-finder-rights">{source.rights}</p>

                    <a
                      className="button-primary vocal-finder-source-link"
                      href={source.href}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {source.ctaLabel || `Open ${source.name}`}
                    </a>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="vocal-finder-guardrail-grid" aria-label="Usage guardrails">
            {VOCAL_GUARDRAILS.map((item) => (
              <article key={item.id} className="panel vocal-finder-guardrail">
                <h2>{item.title}</h2>
                <p>{item.body}</p>
              </article>
            ))}
          </section>
        </main>
      </div>
    </div>
  );
};

export default VocalFinderPage;
