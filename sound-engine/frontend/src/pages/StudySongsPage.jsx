import React from 'react';
import SidebarNavigation, { BrandHeader } from '../components/Sidebar/SidebarNavigation.jsx';
import { BUILT_IN_STUDIES, createGeneratedStudyFromJob } from '../data/songStudies.js';
import { fetchJson } from '../utils/fetchJson.js';
import { useVisiblePolling } from '../hooks/useVisiblePolling.js';
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

  const hasRunningJobs = jobs.some((job) => !TERMINAL_JOB_STATES.has(job.status));
  useVisiblePolling(loadJobs, POLL_INTERVAL_MS, hasRunningJobs);

  const readyStudies = React.useMemo(() => buildReadyStudyEntries(jobs), [jobs]);
  const backgroundRuns = React.useMemo(
    () => jobs.filter((job) => !createGeneratedStudyFromJob(job)).slice(0, 6),
    [jobs]
  );

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
        <BrandHeader />

        <section className="study-library__panel" aria-label="Uploaded song library">
          <div className="study-library__toolbar">
            <div className="study-library__title-group">
              <h1>Library</h1>
              <span>{readyStudies.length} saved</span>
            </div>
            <a className="study-library__action study-library__action--primary" href={MIDI_PIPELINE_HREF}>
              Import song
            </a>
          </div>

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
              <p>No songs saved yet.</p>
            </div>
          )}

          {(backgroundRuns.length > 0 || error) && (
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
          )}
        </section>
      </main>
      <SidebarNavigation />
    </div>
  );
};

export default StudySongsPage;
