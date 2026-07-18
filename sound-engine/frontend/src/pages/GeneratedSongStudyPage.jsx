import React from 'react';
import SidebarNavigation, { BrandHeader } from '../components/Sidebar/SidebarNavigation.jsx';
import { createGeneratedStudyFromJob } from '../data/songStudies.js';
import { fetchJson } from '../utils/fetchJson.js';
import { useVisiblePolling } from '../hooks/useVisiblePolling.js';
import './SongStudyPage.css';

const SongStudyPage = React.lazy(() => import('./SongStudyPage.jsx'));
const TERMINAL_JOB_STATES = new Set(['completed', 'failed']);
const POLL_INTERVAL_MS = 2000;

const GeneratedPlayerFallback = ({ job }) => (
  <div className="song-study">
    <div className="song-study__backdrop" aria-hidden="true" />
    <main className="song-study__shell">
      <BrandHeader />
      <header className="song-study__masthead">
        <div className="song-study__title-group">
          <span className="song-study__eyebrow">Pipeline study</span>
          <h1>{job?.song || 'Generated study'}</h1>
        </div>
      </header>
      <section className="song-study__error" role="status">
        <p>Loading the completed player…</p>
      </section>
    </main>
    <SidebarNavigation />
  </div>
);

const GeneratedSongStudyPage = ({ jobId }) => {
  const [job, setJob] = React.useState(null);
  const [error, setError] = React.useState('');

  const loadJob = React.useCallback(async () => {
    try {
      const nextJob = await fetchJson(`/api/pipeline/jobs/${jobId}`);
      setJob(nextJob);
      setError('');
    } catch (nextError) {
      setError(nextError.message);
    }
  }, [jobId]);

  React.useEffect(() => {
    loadJob();
  }, [loadJob]);

  useVisiblePolling(
    loadJob,
    POLL_INTERVAL_MS,
    Boolean(job?.id) && !TERMINAL_JOB_STATES.has(job?.status)
  );

  const study = React.useMemo(() => createGeneratedStudyFromJob(job), [job]);

  if (study) {
    return (
      <React.Suspense fallback={<GeneratedPlayerFallback job={job} />}>
        <SongStudyPage study={study} />
      </React.Suspense>
    );
  }

  return (
    <div className="song-study">
      <div className="song-study__backdrop" aria-hidden="true" />

      <main className="song-study__shell">
        <BrandHeader />

        <header className="song-study__masthead">
          <div className="song-study__title-group">
            <span className="song-study__eyebrow">Pipeline study</span>
            <h1>{job?.song || 'Loading study'}</h1>
          </div>
        </header>

        <section className="song-study__error" role="status">
          <p>
            {error
              || (job?.status === 'failed'
                ? job.error || 'This pipeline run failed before the merged MIDI was ready.'
                : job?.status === 'running'
                  ? 'This study is still being built. Keep this page open and it will switch to the player when the merged MIDI is ready.'
                  : 'Looking up the generated study.')}
          </p>
        </section>

        {job && (
          <section className="song-study__readouts" aria-label="Pipeline status">
            <article className="song-study__metric">
              <span>Status</span>
              <strong>{job.status}</strong>
              <p>{job.message}</p>
            </article>

            <article className="song-study__metric">
              <span>Step</span>
              <strong>{job.step}</strong>
              <p>{job.song || 'Untitled run'}</p>
            </article>

            <article className="song-study__metric">
              <span>Tempo</span>
              <strong>{job.tempo_bpm ? `${Math.round(job.tempo_bpm)} BPM` : 'Pending'}</strong>
              <p>{job.source_url ? 'YouTube source' : 'Search source'}</p>
            </article>
          </section>
        )}
      </main>
      <SidebarNavigation />
    </div>
  );
};

export default GeneratedSongStudyPage;
