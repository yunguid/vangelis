import React from 'react';
import {
  STUDY_SONGS_HREF,
  getGeneratedStudyHref
} from '../utils/routes.js';
import { createGeneratedStudyFromJob } from '../data/songStudies.js';
import { fetchJson } from '../utils/fetchJson.js';
import './MidiPipelinePage.css';

const INITIAL_FORM = {
  artist: '',
  song: '',
  sourceUrl: ''
};
const LAST_JOB_STORAGE_KEY = 'vangelis-midi-pipeline:last-job-id';
const TERMINAL_JOB_STATES = new Set(['completed', 'failed']);
const POLL_INTERVAL_MS = 2000;
const BUILD_FORM_ID = 'song-study-builder-form';

const MidiPipelinePage = () => {
  const [form, setForm] = React.useState(INITIAL_FORM);
  const [health, setHealth] = React.useState(null);
  const [healthError, setHealthError] = React.useState('');
  const [job, setJob] = React.useState(null);
  const [jobError, setJobError] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [completedStudy, setCompletedStudy] = React.useState(null);
  const handledCompletionRef = React.useRef('');

  const loadHealth = React.useCallback(async () => {
    try {
      const nextHealth = await fetchJson('/api/pipeline/health');
      setHealth(nextHealth);
      setHealthError('');
    } catch (error) {
      setHealth(null);
      setHealthError(error.message);
    }
  }, []);

  const loadJob = React.useCallback(async (jobId) => {
    if (!jobId) return;

    try {
      const nextJob = await fetchJson(`/api/pipeline/jobs/${jobId}`);
      setJob(nextJob);
      setJobError('');
    } catch (error) {
      setJobError(error.message);
    }
  }, []);

  React.useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  React.useEffect(() => {
    const savedJobId = window.localStorage.getItem(LAST_JOB_STORAGE_KEY);
    if (savedJobId) {
      loadJob(savedJobId);
    }
  }, [loadJob]);

  React.useEffect(() => {
    if (!job?.id || TERMINAL_JOB_STATES.has(job.status)) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      loadJob(job.id);
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [job?.id, job?.status, loadJob]);

  const missingTools = React.useMemo(
    () => (health?.tools || []).filter((tool) => !tool.ready),
    [health]
  );
  const generatedStudy = React.useMemo(() => createGeneratedStudyFromJob(job), [job]);
  const surfacedStudy = completedStudy || generatedStudy;
  const studyHref = surfacedStudy ? getGeneratedStudyHref(surfacedStudy.jobId) : '';
  const hasSourceInput = form.sourceUrl.trim().length > 0 || form.song.trim().length > 0;
  const canSubmit = !submitting && Boolean(health?.ready) && hasSourceInput;
  const shouldShowCheckStep = hasSourceInput || Boolean(job);
  const shouldShowBuildStep = hasSourceInput || Boolean(job) || Boolean(surfacedStudy);
  const runtimeLabel = healthError
    ? 'Check failed'
    : health?.ready
      ? 'Ready'
      : health
        ? 'Setup needed'
        : 'Checking';
  const runtimeSummary = healthError
    ? 'The local tool check did not respond.'
    : health?.ready
      ? 'Everything needed to build a study is online.'
      : health
        ? `${missingTools.length} tool${missingTools.length === 1 ? '' : 's'} still need setup.`
        : 'Checking the local toolchain.';
  const buildLabel = surfacedStudy
    ? 'Saved to library'
    : job?.status === 'failed'
      ? 'Needs another try'
      : job
        ? 'Building'
        : canSubmit
          ? 'Ready to start'
          : 'Waiting';
  const buildSummary = surfacedStudy
    ? `${surfacedStudy.title} is now in Song studies.`
    : job?.status === 'failed'
      ? 'This run stopped before the study was created.'
      : job
        ? 'This study is building now and will move into the library when the merged MIDI is ready.'
        : 'Pick a source first, then start the build.';

  React.useEffect(() => {
    if (!generatedStudy?.jobId || handledCompletionRef.current === generatedStudy.jobId) {
      return;
    }

    handledCompletionRef.current = generatedStudy.jobId;
    setCompletedStudy(generatedStudy);
    setForm(INITIAL_FORM);
    setJob(null);
    setJobError('');
    window.localStorage.removeItem(LAST_JOB_STORAGE_KEY);
  }, [generatedStudy]);

  const handleFieldChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value
    }));
    if (completedStudy) {
      setCompletedStudy(null);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setJobError('');
    setCompletedStudy(null);

    try {
      const nextJob = await fetchJson('/api/pipeline/jobs', {
        method: 'POST',
        body: JSON.stringify({
          artist: form.artist,
          song: form.song,
          source_url: form.sourceUrl
        })
      });

      setJob(nextJob);
      window.localStorage.setItem(LAST_JOB_STORAGE_KEY, nextJob.id);
    } catch (error) {
      setJobError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pipeline-page">
      <main className="pipeline-page__shell">
        <div className="pipeline-flow">
          <section className="pipeline-step" aria-label="Step 1: pick a source">
            <div className="pipeline-step__marker" aria-hidden="true">01</div>

            <div className="pipeline-card">
              <div className="pipeline-card__header">
                <h2>Pick a source</h2>
                <p>Search by artist and title, or paste one link.</p>
              </div>

              <form className="pipeline-form" id={BUILD_FORM_ID} onSubmit={handleSubmit}>
                <label className="pipeline-field">
                  <span>Artist</span>
                  <input
                    type="text"
                    name="artist"
                    value={form.artist}
                    onChange={handleFieldChange}
                    placeholder="Vangelis"
                  />
                </label>

                <label className="pipeline-field">
                  <span>Song</span>
                  <input
                    type="text"
                    name="song"
                    value={form.song}
                    onChange={handleFieldChange}
                    placeholder="To the Unknown Man"
                  />
                </label>

                <div className="pipeline-form__divider" aria-hidden="true">
                  <span>or</span>
                </div>

                <label className="pipeline-field pipeline-field--wide">
                  <span>YouTube or source URL</span>
                  <input
                    type="url"
                    name="sourceUrl"
                    value={form.sourceUrl}
                    onChange={handleFieldChange}
                    placeholder="https://www.youtube.com/watch?v=..."
                  />
                </label>
              </form>
            </div>
          </section>

          {shouldShowCheckStep && (
            <section className="pipeline-step" aria-label="Step 2: check setup">
              <div className="pipeline-step__marker" aria-hidden="true">02</div>

              <div className="pipeline-card">
                <div className="pipeline-card__split">
                  <div className="pipeline-card__header">
                    <h2>Check setup</h2>
                    <p>{runtimeSummary}</p>
                  </div>
                  <span className={`pipeline-chip ${health?.ready ? 'is-ready' : healthError ? 'is-warning' : ''}`}>
                    {runtimeLabel}
                  </span>
                </div>

                {healthError && (
                  <p className="pipeline-error">{healthError}</p>
                )}

                {health && (
                  <details className="pipeline-disclosure" open={!health.ready}>
                    <summary>{health.ready ? 'Show runtime details' : 'Show setup details'}</summary>

                    <div className="pipeline-disclosure__content">
                      <div className="pipeline-tool-grid">
                        {health.tools.map((tool) => (
                          <article className="pipeline-tool" key={tool.label}>
                            <span className={`pipeline-tool__dot ${tool.ready ? 'is-ready' : 'is-missing'}`} />
                            <strong>{tool.label}</strong>
                          </article>
                        ))}
                      </div>

                      {!health.ready && (
                        <div className="pipeline-note">
                          <p>Run this once:</p>
                          <code>{health.bootstrap_command}</code>
                        </div>
                      )}
                    </div>
                  </details>
                )}
              </div>
            </section>
          )}

          {shouldShowBuildStep && (
            <section className="pipeline-step" aria-label="Step 3: build the study">
              <div className="pipeline-step__marker" aria-hidden="true">03</div>

              <div className="pipeline-card">
                <div className="pipeline-card__split">
                  <div className="pipeline-card__header">
                    <h2>{surfacedStudy ? 'Study saved' : job ? 'Build status' : 'Build the study'}</h2>
                    <p>{buildSummary}</p>
                  </div>
                  <span className={`pipeline-chip ${surfacedStudy ? 'is-ready' : job?.status === 'failed' ? 'is-warning' : ''}`}>
                    {buildLabel}
                  </span>
                </div>

                {jobError && (
                  <p className="pipeline-error">{jobError}</p>
                )}

                {job && (
                  <>
                    <div className="pipeline-job">
                      <article className="pipeline-job__metric">
                        <span>Artist</span>
                        <strong>{job.artist || 'Optional'}</strong>
                      </article>
                      <article className="pipeline-job__metric">
                        <span>Song</span>
                        <strong>{job.song || (job.source_url ? 'From link' : 'Add a title')}</strong>
                      </article>
                      <article className="pipeline-job__metric">
                        <span>Source</span>
                        <strong>{job.source_url ? 'Link pasted' : 'Search by text'}</strong>
                      </article>
                    </div>

                    <details className="pipeline-disclosure">
                      <summary>Current build details</summary>

                      <div className="pipeline-disclosure__content">
                        <div className="pipeline-job">
                          <article className="pipeline-job__metric">
                            <span>Step</span>
                            <strong>{job.step}</strong>
                          </article>
                          <article className="pipeline-job__metric">
                            <span>Message</span>
                            <strong>{job.message}</strong>
                          </article>
                          <article className="pipeline-job__metric">
                            <span>Tempo</span>
                            <strong>{job.tempo_bpm ? `${Math.round(job.tempo_bpm)} BPM` : 'Pending'}</strong>
                          </article>
                        </div>

                        {job.source_url && (
                          <div className="pipeline-source">
                            {job.source_url}
                          </div>
                        )}

                        {job.error && (
                          <p className="pipeline-error">{job.error}</p>
                        )}
                      </div>
                    </details>
                  </>
                )}

                <div className="pipeline-actions">
                  {!surfacedStudy && (
                    <button
                      type="submit"
                      form={BUILD_FORM_ID}
                      className="pipeline-submit"
                      disabled={!canSubmit}
                    >
                      {submitting ? 'Starting...' : 'Start build'}
                    </button>
                  )}

                  {surfacedStudy && (
                    <a className="pipeline-submit pipeline-submit--link" href={studyHref}>
                      Open study
                    </a>
                  )}

                  <a className="pipeline-secondary-link" href={STUDY_SONGS_HREF}>
                    Song studies
                  </a>
                </div>

                {missingTools.length > 0 && (
                  <p className="pipeline-muted">
                    Missing tools block builds.
                  </p>
                )}
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
};

export default MidiPipelinePage;
