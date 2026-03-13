import React from 'react';
import { APP_ROUTES, getRouteHref } from '../utils/appRoutes.js';

const RUNNING_STATUSES = new Set(['queued', 'processing']);
const DEFAULT_WORKER_URL = (import.meta.env.VITE_STEM_WORKER_URL || 'http://127.0.0.1:8718').replace(/\/+$/, '');

const toWorkerUrl = (path) => `${DEFAULT_WORKER_URL}${path.startsWith('/') ? path : `/${path}`}`;

const formatBytes = (value) => {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size >= 100 ? size.toFixed(0) : size.toFixed(1)} ${units[unitIndex]}`;
};

const formatSeconds = (value) => {
  if (!Number.isFinite(value) || value < 0) return null;
  if (value < 60) return `${value.toFixed(1)}s`;
  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value % 60);
  return `${minutes}m ${seconds}s`;
};

const buildStatusLabel = (status) => {
  switch (status) {
    case 'queued':
      return 'Queued';
    case 'processing':
      return 'Splitting stems';
    case 'succeeded':
      return 'Stems ready';
    case 'failed':
      return 'Split failed';
    default:
      return 'Idle';
  }
};

const postLocalFileJob = (file, onProgress) => new Promise((resolve, reject) => {
  const formData = new FormData();
  formData.append('file', file);

  const xhr = new XMLHttpRequest();
  xhr.open('POST', toWorkerUrl('/api/stem-jobs'));
  xhr.responseType = 'json';

  xhr.upload.onprogress = (event) => {
    if (!event.lengthComputable || typeof onProgress !== 'function') return;
    onProgress((event.loaded / event.total) * 100);
  };

  xhr.onerror = () => {
    reject(new Error('Failed to reach the local stem worker.'));
  };

  xhr.onload = () => {
    const payload = xhr.response && typeof xhr.response === 'object'
      ? xhr.response
      : (() => {
        try {
          return JSON.parse(xhr.responseText);
        } catch (_) {
          return null;
        }
      })();

    if (xhr.status < 200 || xhr.status >= 300) {
      reject(new Error(payload?.detail || payload?.error || `Worker returned ${xhr.status}`));
      return;
    }

    resolve(payload);
  };

  xhr.send(formData);
});

const postSourceUrlJob = async (sourceUrl) => {
  const response = await fetch(toWorkerUrl('/api/stem-jobs'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      source_url: sourceUrl
    })
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.detail || payload?.error || `Worker returned ${response.status}`);
  }
  return payload;
};

const StemSplitterPage = () => {
  const [configuration, setConfiguration] = React.useState(null);
  const [configurationError, setConfigurationError] = React.useState('');
  const [publicAudioUrl, setPublicAudioUrl] = React.useState('');
  const [selectedFile, setSelectedFile] = React.useState(null);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [uploading, setUploading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [job, setJob] = React.useState(null);
  const [jobError, setJobError] = React.useState('');

  React.useEffect(() => {
    let cancelled = false;

    const loadConfiguration = async () => {
      try {
        const response = await fetch(toWorkerUrl('/healthz'));
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.detail || payload?.error || `Worker returned ${response.status}`);
        }

        if (!cancelled) {
          setConfiguration(payload?.configuration || null);
          setConfigurationError('');
        }
      } catch (error) {
        if (!cancelled) {
          setConfigurationError(error instanceof Error ? error.message : 'Failed to reach the local stem worker.');
        }
      }
    };

    loadConfiguration();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!job?.jobId || !RUNNING_STATUSES.has(job.status)) {
      return undefined;
    }

    let cancelled = false;
    const intervalId = window.setInterval(async () => {
      try {
        const response = await fetch(toWorkerUrl(`/api/stem-jobs/${job.jobId}`), {
          cache: 'no-store'
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.detail || payload?.error || `Worker returned ${response.status}`);
        }

        if (!cancelled) {
          setConfiguration((current) => payload?.configuration || current);
          setJob(payload?.job || null);
          setJobError('');
        }
      } catch (error) {
        if (!cancelled) {
          setJobError(error instanceof Error ? error.message : 'Failed to refresh the local split job.');
        }
      }
    }, 1500);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [job?.jobId, job?.status]);

  const canSplit = Boolean(!uploading && !submitting && (selectedFile || publicAudioUrl.trim()) && !configurationError);

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files?.[0] || null);
    setUploadProgress(0);
    setJobError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setJobError('');
    setJob(null);

    try {
      setSubmitting(true);
      let payload = null;

      if (selectedFile) {
        setUploading(true);
        setUploadProgress(0);
        payload = await postLocalFileJob(selectedFile, setUploadProgress);
      } else {
        payload = await postSourceUrlJob(publicAudioUrl.trim());
      }

      setConfiguration(payload?.configuration || configuration);
      setJob(payload?.job || null);
    } catch (error) {
      setJobError(error instanceof Error ? error.message : 'Failed to split stems.');
    } finally {
      setUploading(false);
      setSubmitting(false);
    }
  };

  const activeSourceLabel = selectedFile?.name || publicAudioUrl.trim() || 'No track selected yet';

  return (
    <div className="app-stage stem-splitter-stage">
      <div className="stem-splitter-page">
        <header className="zone-top tier-subtle content-tertiary stem-splitter-header">
          <div className="brand-block">
            <div className="brand-title">Stem Splitter</div>
            <p className="stem-splitter-subtitle">
              Local Hybrid Demucs split into sample, drums, bass, and vocals.
            </p>
          </div>
          <div className="stem-splitter-header-actions">
            <a href={getRouteHref(APP_ROUTES.vocalFinder)} className="button-link stem-splitter-nav-link">
              Vocal finder
            </a>
            <a href={getRouteHref(APP_ROUTES.synth)} className="button-primary stem-splitter-home-link">
              Open synth
            </a>
          </div>
        </header>

        <main className="stem-splitter-main">
          <section className="panel elevated stem-splitter-controls">
            <div className="stem-splitter-section-header">
              <p className="stem-splitter-eyebrow">4-Stem Demucs</p>
              <h1>Run the split on your own machine.</h1>
              <p>
                No external splitter. The page talks to the local worker at <strong>{DEFAULT_WORKER_URL}</strong>,
                uploads the source directly to it, and returns <strong>sample</strong>, <strong>drums</strong>,
                <strong>bass</strong>, and <strong>vocals</strong>.
              </p>
            </div>

            <div className="stem-splitter-status-grid" aria-label="Runtime configuration">
              <div className={`stem-splitter-status-chip ${configurationError ? 'is-offline' : 'is-ready'}`}>
                {configurationError ? 'Worker offline' : 'Worker online'}
              </div>
              {configuration?.devicePreference && (
                <div className="stem-splitter-status-chip is-muted">
                  Device {configuration.devicePreference}
                </div>
              )}
              {configuration?.chunkSeconds && (
                <div className="stem-splitter-status-chip is-muted">
                  {formatSeconds(configuration.chunkSeconds)} chunks
                </div>
              )}
              {configuration?.maximumUploadBytes && (
                <div className="stem-splitter-status-chip is-muted">
                  Max upload {formatBytes(configuration.maximumUploadBytes)}
                </div>
              )}
              {typeof configuration?.queueDepth === 'number' && (
                <div className="stem-splitter-status-chip is-muted">
                  Queue {configuration.queueDepth}
                </div>
              )}
            </div>

            {configurationError && (
              <p className="stem-splitter-warning">
                {configurationError} Start the worker with <code>npm run stem-worker:reload</code>.
              </p>
            )}

            <form className="stem-splitter-form" onSubmit={handleSubmit}>
              <label className="stem-splitter-dropzone" htmlFor="stem-splitter-file">
                <input
                  id="stem-splitter-file"
                  type="file"
                  accept="audio/*"
                  onChange={handleFileChange}
                />
                <span className="stem-splitter-dropzone-title">
                  {selectedFile ? selectedFile.name : 'Choose an audio file'}
                </span>
                <span className="stem-splitter-dropzone-copy">
                  {selectedFile
                    ? `${formatBytes(selectedFile.size)} ready for the local worker`
                    : 'Upload the full track straight to the worker'}
                </span>
              </label>

              <div className="stem-splitter-divider">or</div>

              <label className="stem-splitter-field" htmlFor="stem-splitter-url">
                <span className="stem-splitter-label">Public audio URL</span>
                <input
                  id="stem-splitter-url"
                  type="url"
                  inputMode="url"
                  value={publicAudioUrl}
                  onChange={(event) => setPublicAudioUrl(event.target.value)}
                  className="stem-splitter-text-input"
                  placeholder="https://.../full-track.wav"
                />
              </label>

              {uploading && (
                <div className="stem-splitter-progress">
                  <div
                    className="stem-splitter-progress-bar"
                    style={{ width: `${Math.max(4, uploadProgress)}%` }}
                  />
                  <span>Uploading to local worker {Math.round(uploadProgress)}%</span>
                </div>
              )}

              <div className="stem-splitter-form-actions">
                <button
                  type="submit"
                  className="button-primary stem-splitter-submit"
                  disabled={!canSplit}
                >
                  {uploading ? 'Uploading...' : submitting ? 'Starting split...' : 'Split stems'}
                </button>
                <p className="stem-splitter-field-note">
                  Active source: <strong>{activeSourceLabel}</strong>
                </p>
              </div>
            </form>
          </section>

          <section className="panel stem-splitter-results">
            <div className="stem-splitter-section-header">
              <h2>{buildStatusLabel(job?.status)}</h2>
              <p>
                {job
                  ? `${job.sourceName || 'Track'} is ${job.status}.`
                  : 'Start a split and the local stems will land here.'}
              </p>
            </div>

            {jobError && (
              <p className="stem-splitter-warning">{jobError}</p>
            )}

            {!job && !jobError && (
              <p className="stem-splitter-empty">
                Queue a track once the local worker is up.
              </p>
            )}

            {job && (
              <div className="stem-splitter-job">
                <div className="stem-splitter-job-topline">
                  <span className={`stem-splitter-status-chip ${job.status === 'succeeded' ? 'is-ready' : RUNNING_STATUSES.has(job.status) ? 'is-review' : 'is-offline'}`}>
                    {buildStatusLabel(job.status)}
                  </span>
                  {typeof job.progress === 'number' && (
                    <span className="stem-splitter-status-chip is-muted">
                      {Math.round(job.progress * 100)}%
                    </span>
                  )}
                  {job.deviceUsed && (
                    <span className="stem-splitter-status-chip is-muted">
                      {job.deviceUsed}
                    </span>
                  )}
                </div>

                {job.statusMessage && (
                  <p className="stem-splitter-empty">{job.statusMessage}</p>
                )}

                {job.warnings?.length > 0 && (
                  <div className="stem-splitter-warning-list" aria-label="Split warnings">
                    {job.warnings.map((warning) => (
                      <p key={warning} className="stem-splitter-warning">
                        {warning}
                      </p>
                    ))}
                  </div>
                )}

                {job.sourceUrl && (
                  <div className="stem-splitter-source-preview">
                    <p className="stem-splitter-source-label">Source track</p>
                    <audio controls preload="none" src={job.sourceUrl}>
                      Your browser does not support audio playback.
                    </audio>
                  </div>
                )}

                {job.stems?.length > 0 ? (
                  <div className="stem-splitter-grid">
                    {job.stems.map((stem) => (
                      <article key={stem.id} className="stem-splitter-card">
                        <div className="stem-splitter-card-topline">
                          <div>
                            <h3>{stem.label}</h3>
                            <p>{stem.sourceKey}</p>
                          </div>
                          <span className="stem-splitter-status-chip is-ready">{stem.id}</span>
                        </div>

                        <audio controls preload="none" src={stem.url}>
                          Your browser does not support audio playback.
                        </audio>

                        <div className="stem-splitter-card-actions">
                          <a
                            className="button-primary stem-splitter-card-link"
                            href={stem.url}
                            target="_blank"
                            rel="noreferrer"
                            download={stem.suggestedFileName}
                          >
                            Download stem
                          </a>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : job.isTerminal ? (
                  <p className="stem-splitter-empty">
                    The split finished without downloadable stems.
                  </p>
                ) : (
                  <p className="stem-splitter-empty">
                    Waiting for the local worker to finish the split.
                  </p>
                )}

                {(job.error || job.logs) && (
                  <div className="stem-splitter-log-panel">
                    {job.error && <p className="stem-splitter-warning">{job.error}</p>}
                    {job.logs && <pre className="stem-splitter-logs">{job.logs}</pre>}
                  </div>
                )}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
};

export default StemSplitterPage;
