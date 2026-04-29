import React from 'react';
import AppHeader from '../components/AppHeader.jsx';
import { BUILT_IN_STUDIES, createGeneratedStudyFromJob } from '../data/songStudies.js';
import { fetchJson } from '../utils/fetchJson.js';
import {
  MIDI_PIPELINE_HREF,
  getGeneratedStudyHref,
  getStudySongHref
} from '../utils/routes.js';
import './StudySongsPage.css';

const TERMINAL_JOB_STATES = new Set(['completed', 'failed']);
const POLL_INTERVAL_MS = 2000;

const buildReadyStudyEntries = (jobs) => {
  const generatedStudies = jobs
    .map((job) => createGeneratedStudyFromJob(job))
    .filter(Boolean)
    .sort((left, right) => (right.updatedAt || 0) - (left.updatedAt || 0));

  return [
    ...BUILT_IN_STUDIES.map((study) => ({
      ...study,
      href: getStudySongHref(study.slug),
      canDelete: false
    })),
    ...generatedStudies.map((study) => ({
      ...study,
      href: getGeneratedStudyHref(study.jobId),
      canDelete: true
    }))
  ];
};

const StudySongsPage = () => {
  const [jobs, setJobs] = React.useState([]);
  const [error, setError] = React.useState('');
  const [deleteError, setDeleteError] = React.useState('');
  const [deletingJobId, setDeletingJobId] = React.useState('');
  const [mode, setMode] = React.useState('open');

  const loadJobs = React.useCallback(async () => {
    try {
      const nextJobs = await fetchJson('/api/pipeline/jobs');
      setJobs(Array.isArray(nextJobs) ? nextJobs : []);
      setError('');
    } catch (nextError) {
      setError(nextError.message);
    }
  }, []);

  React.useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  React.useEffect(() => {
    if (!jobs.some((job) => !TERMINAL_JOB_STATES.has(job.status))) {
      return undefined;
    }

    const intervalId = window.setInterval(loadJobs, POLL_INTERVAL_MS);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [jobs, loadJobs]);

  const readyStudies = React.useMemo(() => buildReadyStudyEntries(jobs), [jobs]);
  const backgroundRuns = React.useMemo(
    () => jobs.filter((job) => !createGeneratedStudyFromJob(job)).slice(0, 6),
    [jobs]
  );

  React.useEffect(() => {
    if (readyStudies.length === 0) {
      setMode('create');
    }
  }, [readyStudies.length]);

  const handleDeleteStudy = async (jobId) => {
    if (!jobId || deletingJobId) return;

    setDeletingJobId(jobId);
    setDeleteError('');

    try {
      await fetchJson(`/api/pipeline/jobs/${jobId}`, {
        method: 'DELETE'
      });
      setJobs((currentJobs) => currentJobs.filter((job) => job.id !== jobId));
    } catch (nextError) {
      setDeleteError(nextError.message);
    } finally {
      setDeletingJobId('');
    }
  };

  return (
    <div className="study-library">
      <main className="study-library__shell">
        <AppHeader activeSection="studies" />

        <section className="study-library__flow" aria-label="Study library flow">
          <article className="study-library__node study-library__node--choice">
            <div className="study-library__marker" aria-hidden="true">01</div>

            <div className="study-library__body">
              <div className="study-library__choice-grid">
                <button
                  type="button"
                  className={`study-library__choice ${mode === 'open' ? 'is-active' : ''}`}
                  onClick={() => setMode('open')}
                >
                  <strong>Open a study</strong>
                  <span>{readyStudies.length > 0 ? `${readyStudies.length} ready now` : 'Nothing saved yet'}</span>
                </button>

                <button
                  type="button"
                  className={`study-library__choice ${mode === 'create' ? 'is-active' : ''}`}
                  onClick={() => setMode('create')}
                >
                  <strong>Create a study</strong>
                  <span>Build one from a link or song search</span>
                </button>
              </div>
            </div>
          </article>

          {mode === 'open' ? (
            <article className="study-library__node">
              <div className="study-library__marker" aria-hidden="true">02</div>

              <div className="study-library__body">
                {deleteError && (
                  <p className="study-library__error">{deleteError}</p>
                )}

                {readyStudies.length > 0 ? (
                  <div className="study-library__list">
                    {readyStudies.map((study) => (
                      <article className="study-library__study" key={study.id}>
                        <div className="study-library__study-main">
                          <span className="study-library__study-kicker">{study.sourceLabel}</span>
                          <strong>{study.title}</strong>
                          <p>{study.artist}</p>
                        </div>

                        <div className="study-library__study-side">
                          <span>{study.eyebrow}</span>
                          <div className="study-library__study-actions">
                            <a className="study-library__action study-library__action--primary" href={study.href}>
                              Open
                            </a>
                            {study.canDelete && (
                              <button
                                type="button"
                                className="study-library__action"
                                onClick={() => handleDeleteStudy(study.jobId)}
                                disabled={deletingJobId === study.jobId}
                              >
                                {deletingJobId === study.jobId ? 'Deleting...' : 'Delete'}
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="study-library__empty">
                    <p>No studies are saved yet.</p>
                    <a className="study-library__action study-library__action--primary" href={MIDI_PIPELINE_HREF}>
                      Create one
                    </a>
                  </div>
                )}
              </div>
            </article>
          ) : (
            <article className="study-library__node">
              <div className="study-library__marker" aria-hidden="true">02</div>

              <div className="study-library__body">
                <div className="study-library__create">
                  <p>Open the builder when you want to turn a link or search into a playable study.</p>
                  <a className="study-library__action study-library__action--primary" href={MIDI_PIPELINE_HREF}>
                    Open builder
                  </a>
                </div>
              </div>
            </article>
          )}

          {(backgroundRuns.length > 0 || error) && (
            <article className="study-library__node study-library__node--details">
              <div className="study-library__marker" aria-hidden="true">03</div>

              <div className="study-library__body">
                <details className="study-library__details">
                  <summary>Background runs</summary>

                  {error && (
                    <p className="study-library__error">{error}</p>
                  )}

                  {backgroundRuns.length > 0 && (
                    <div className="study-library__run-list">
                      {backgroundRuns.map((job) => (
                        <div className="study-library__run" key={job.id}>
                          <div className="study-library__run-main">
                            <strong>{job.song || 'Untitled run'}</strong>
                            <span>{job.artist || 'Unknown artist'}</span>
                          </div>
                          <div className="study-library__run-meta">
                            <span>{job.status}</span>
                            <span>{job.step}</span>
                            <span>{job.message}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </details>
              </div>
            </article>
          )}
        </section>
      </main>
    </div>
  );
};

export default StudySongsPage;
