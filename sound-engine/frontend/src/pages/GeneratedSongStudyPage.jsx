import React from 'react';
import AppHeader from '../components/AppHeader.jsx';
import { createGeneratedStudyFromJob } from '../data/songStudies.js';
import { fetchJson } from '../utils/fetchJson.js';
import SongStudyPage from './SongStudyPage.jsx';
import './SongStudyPage.css';

const TERMINAL_JOB_STATES = new Set(['completed', 'failed']);
const POLL_INTERVAL_MS = 2000;

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

  React.useEffect(() => {
    if (!job?.id || TERMINAL_JOB_STATES.has(job.status)) {
      return undefined;
    }

    const intervalId = window.setInterval(loadJob, POLL_INTERVAL_MS);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [job?.id, job?.status, loadJob]);

  const study = React.useMemo(() => createGeneratedStudyFromJob(job), [job]);

  if (study) {
    return <SongStudyPage study={study} />;
  }

  return (
    <div className="song-study">
      <div className="song-study__backdrop" aria-hidden="true" />

      <main className="song-study__shell">
        <AppHeader activeSection="studies" />

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
    </div>
  );
};

export default GeneratedSongStudyPage;
