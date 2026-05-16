import React from 'react';
import AppHeader from '../components/AppHeader.jsx';
import Sidebar from '../components/Sidebar';
import { fetchJson } from '../utils/fetchJson.js';
import { encodeWav } from '../utils/audioEngine/wav.js';
import { renderVoiceScore } from '../utils/voicePhrase.js';
import './VoiceLoopLabPage.css';

const KEY_OPTIONS = ['F# minor', 'C# minor', 'A# minor', 'A dorian', 'E minor', 'D lydian'];
const DENSITY_OPTIONS = ['very high', 'high', 'syncopated', 'wide-open'];
const STARTER_SCORE = 'r120 bC5 ( AA ) bG#4 ( AA ) bC4 ( AA ) bF3 ( AA ) bC3 ( AA ) bG3 ( AA ) bG#3 ( AA ) bC4 ( AA ) bF4 ( ER ) bG#4 ( AW ) bC5 ( IY ) bG#4 ( AA ) bF4 ( ER ) bC#4 ( AA ) bF4 ( OW ) bG#4 ( AA ) bC#5 ( AE ) bF5 ( AA ) bD#5 ( ER ) bC#5 ( AA ) bG#4 ( AW )';
const RANDOM_SEED_PARTS = {
  surfaces: ['chrome vowel engine', 'glass robot choir', 'neon throat sequencer', 'burnt tape vocoder', 'midnight arcade cantor'],
  motions: ['mirror arpeggio', 'stuttered octave climb', 'falling staircase loop', 'fast call and response', 'syncopated spiral pattern'],
  phonemes: ['AA ER OW IY', 'AW AA AE ER', 'IY OW AA AY', 'ER AA UW OW', 'AE IY AA ER'],
  gestures: ['tiny rests', 'wide jumps', 'late accents', 'breathy turns', 'double-time answers']
};

function pickRandom(values) {
  return values[Math.floor(Math.random() * values.length)];
}

function buildRandomSeed() {
  const motif = Array.from({ length: 8 }, () => Math.floor(Math.random() * 9)).join('-');
  const code = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0');

  return [
    pickRandom(RANDOM_SEED_PARTS.surfaces),
    pickRandom(RANDOM_SEED_PARTS.motions),
    `phonemes ${pickRandom(RANDOM_SEED_PARTS.phonemes)}`,
    pickRandom(RANDOM_SEED_PARTS.gestures),
    `motif ${motif}`,
    `seed ${code}`
  ].join(' / ');
}

function parseScoreEvents(score) {
  const events = [];
  const eventRe = /b([A-G]#?\d)\s*\(([^)]+)\)/g;
  let match = eventRe.exec(score);
  while (match) {
    events.push({
      note: match[1],
      phonemes: match[2].trim()
    });
    match = eventRe.exec(score);
  }
  return events;
}

function createRuntime(ctx) {
  const output = ctx.createGain();
  output.gain.value = 0.82;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 4200;
  filter.Q.value = 0.65;

  const delay = ctx.createDelay(0.75);
  delay.delayTime.value = 0.18;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.24;
  const wet = ctx.createGain();
  wet.gain.value = 0.16;

  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(wet);

  filter.connect(output);
  filter.connect(delay);
  wet.connect(output);
  output.connect(ctx.destination);

  return {
    source: null,
    output,
    filter,
    delay,
    wet
  };
}

async function renderLoopRecording(buffer, controls) {
  if (typeof OfflineAudioContext === 'undefined') {
    throw new Error('Offline loop recording is not supported in this browser.');
  }

  const sampleRate = buffer.sampleRate;
  const speed = Math.max(0.1, controls.speed || 1);
  const loopDuration = buffer.duration / speed;
  const loopFrames = Math.max(1, Math.ceil(loopDuration * sampleRate));
  const offline = new OfflineAudioContext(2, loopFrames * 2, sampleRate);

  const source = offline.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.playbackRate.value = speed;

  const output = offline.createGain();
  output.gain.value = controls.gain;

  const filter = offline.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = controls.tone;
  filter.Q.value = 0.65;

  const delay = offline.createDelay(0.75);
  delay.delayTime.value = 0.18;
  const feedback = offline.createGain();
  feedback.gain.value = 0.24;
  const wet = offline.createGain();
  wet.gain.value = controls.wet;

  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(wet);

  source.connect(filter);
  filter.connect(output);
  filter.connect(delay);
  wet.connect(output);
  output.connect(offline.destination);
  source.start(0);

  const rendered = await offline.startRendering();
  const left = new Float32Array(loopFrames);
  const right = new Float32Array(loopFrames);
  rendered.copyFromChannel(left, 0, loopFrames);
  rendered.copyFromChannel(right, rendered.numberOfChannels > 1 ? 1 : 0, loopFrames);

  return { left, right, sampleRate };
}

function downloadWav({ left, right, sampleRate }) {
  const wavBuffer = encodeWav(left, right, sampleRate);
  const blob = new Blob([wavBuffer], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `vangelis-voice-loop-${Date.now()}.wav`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function stopSource(runtimeRef) {
  if (!runtimeRef.current?.source) return;
  try {
    runtimeRef.current.source.stop();
  } catch (_) {
    // Already stopped.
  }
  runtimeRef.current.source.disconnect();
  runtimeRef.current.source = null;
}

const VoiceLoopLabPage = () => {
  const [form, setForm] = React.useState({
    seed: 'state of the art 1980 speech synth arpeggio',
    key: 'F# minor',
    bpm: 120,
    density: 'very high'
  });
  const [score, setScore] = React.useState(STARTER_SCORE);
  const [rendered, setRendered] = React.useState(null);
  const [controls, setControls] = React.useState({
    speed: 1,
    tone: 4200,
    wet: 0.16,
    gain: 0.82,
    effort: 0.82,
    breath: 0.04
  });
  const [meta, setMeta] = React.useState({ source: 'starter', warning: '' });
  const [generating, setGenerating] = React.useState(false);
  const [recording, setRecording] = React.useState(false);
  const [generationStatus, setGenerationStatus] = React.useState({
    tone: 'idle',
    label: 'Ready'
  });
  const [error, setError] = React.useState('');
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [playhead, setPlayhead] = React.useState(0);

  const audioContextRef = React.useRef(null);
  const runtimeRef = React.useRef(null);
  const startedAtRef = React.useRef(0);
  const frameRef = React.useRef(null);
  const generationSerialRef = React.useRef(0);

  const events = React.useMemo(() => parseScoreEvents(score), [score]);
  const activeEventIndex = rendered && events.length > 0
    ? Math.floor((playhead / Math.max(rendered.duration, 0.01)) * events.length) % events.length
    : -1;

  const ensureAudioContext = React.useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    if (!runtimeRef.current) {
      runtimeRef.current = createRuntime(audioContextRef.current);
    }
    return audioContextRef.current;
  }, []);

  const renderScore = React.useCallback(async () => {
    const ctx = await ensureAudioContext();
    const nextRendered = renderVoiceScore(ctx, score, {
      effort: controls.effort,
      aspiration: controls.breath
    });
    setRendered(nextRendered);
    setError(nextRendered.warnings?.length ? nextRendered.warnings.join(' ') : '');
    return nextRendered;
  }, [controls.breath, controls.effort, ensureAudioContext, score]);

  const startRenderedLoop = React.useCallback((buffer) => {
    const ctx = audioContextRef.current;
    const runtime = runtimeRef.current;
    if (!ctx || !runtime || !buffer) return;

    stopSource(runtimeRef);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.playbackRate.value = controls.speed;
    source.connect(runtime.filter);
    source.start();
    runtime.source = source;
    startedAtRef.current = ctx.currentTime;
    setIsPlaying(true);
  }, [controls.speed]);

  React.useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.output.gain.setTargetAtTime(controls.gain, audioContextRef.current.currentTime, 0.015);
    runtime.filter.frequency.setTargetAtTime(controls.tone, audioContextRef.current.currentTime, 0.015);
    runtime.wet.gain.setTargetAtTime(controls.wet, audioContextRef.current.currentTime, 0.015);
    if (runtime.source) {
      runtime.source.playbackRate.setTargetAtTime(controls.speed, audioContextRef.current.currentTime, 0.015);
    }
  }, [controls.gain, controls.speed, controls.tone, controls.wet]);

  React.useEffect(() => {
    const timeoutId = window.setTimeout(async () => {
      try {
        const nextRendered = await renderScore();
        if (isPlaying) startRenderedLoop(nextRendered.buffer);
      } catch (renderError) {
        setError('Score render failed.');
      }
    }, 260);
    return () => window.clearTimeout(timeoutId);
  }, [controls.breath, controls.effort, isPlaying, renderScore, score, startRenderedLoop]);

  React.useEffect(() => {
    if (!isPlaying || !rendered) return undefined;
    const tick = () => {
      const ctx = audioContextRef.current;
      if (ctx) {
        setPlayhead((ctx.currentTime - startedAtRef.current) % Math.max(rendered.duration, 0.01));
      }
      frameRef.current = window.requestAnimationFrame(tick);
    };
    frameRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
    };
  }, [isPlaying, rendered]);

  React.useEffect(() => () => {
    stopSource(runtimeRef);
    if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
  }, []);

  const stopLoop = React.useCallback(() => {
    stopSource(runtimeRef);
    setIsPlaying(false);
    setPlayhead(0);
  }, []);

  const startLoop = React.useCallback(async () => {
    const nextRendered = rendered || await renderScore();
    startRenderedLoop(nextRendered.buffer);
  }, [renderScore, rendered, startRenderedLoop]);

  const generateLoop = React.useCallback(async (nextForm) => {
    const variation = `take-${Date.now().toString(36)}-${generationSerialRef.current += 1}`;

    setGenerating(true);
    setError('');
    setGenerationStatus({
      tone: 'working',
      label: 'Generating pattern'
    });

    try {
      const result = await fetchJson('/api/phrase-loop', {
        method: 'POST',
        body: JSON.stringify({
          phrase: nextForm.seed,
          variation,
          key: nextForm.key,
          bpm: nextForm.bpm,
          density: nextForm.density
        })
      });
      if (result.loop?.score) {
        setScore(result.loop.score);
        setRendered(null);
      }
      setMeta({
        source: result.source || 'openai',
        model: result.model || '',
        warning: result.warning || ''
      });
      setGenerationStatus({
        tone: 'ready',
        label: 'OpenAI pattern ready'
      });
    } catch (generateError) {
      const providerCode = generateError.payload?.providerError?.code || generateError.payload?.providerError?.type || '';
      setError(providerCode ? `${generateError.message} (${providerCode})` : generateError.message);
      setGenerationStatus({
        tone: 'error',
        label: providerCode === 'insufficient_quota' ? 'OpenAI quota blocked' : 'OpenAI failed'
      });
    } finally {
      setGenerating(false);
    }
  }, []);

  const handleGenerate = async (event) => {
    event.preventDefault();
    await generateLoop(form);
  };

  const handleRandomSeed = async () => {
    const nextForm = {
      ...form,
      seed: buildRandomSeed()
    };
    setForm(nextForm);
    await generateLoop(nextForm);
  };

  const handleRecordLoop = async () => {
    setRecording(true);
    setError('');
    setGenerationStatus({
      tone: 'working',
      label: 'Recording loop'
    });

    try {
      const nextRendered = rendered || await renderScore();
      const recordingBuffer = await renderLoopRecording(nextRendered.buffer, controls);
      downloadWav(recordingBuffer);
      setGenerationStatus({
        tone: 'ready',
        label: 'WAV saved'
      });
    } catch (recordError) {
      setError(recordError.message || 'Loop recording failed.');
      setGenerationStatus({
        tone: 'error',
        label: 'Record failed'
      });
    } finally {
      setRecording(false);
    }
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: name === 'bpm' ? Number(value) : value
    }));
  };

  const handleControlChange = (event) => {
    const { name, value } = event.target;
    setControls((current) => ({
      ...current,
      [name]: Number(value)
    }));
  };

  return (
    <div className="voice-loop-page">
      <main className="voice-loop-shell">
        <AppHeader activeSection="voice-loop" className="voice-loop-header" />

        <section className="voice-loop-workspace" aria-label="Voice loop generator">
          <form className="voice-loop-controls" onSubmit={handleGenerate}>
            <div className="voice-loop-actions voice-loop-actions--top">
              <button
                type="submit"
                className="voice-loop-button voice-loop-button--primary"
                disabled={generating || recording}
                aria-busy={generating}
              >
                {generating ? 'Generating' : 'Generate'}
              </button>
              <button
                type="button"
                className="voice-loop-button"
                onClick={isPlaying ? stopLoop : startLoop}
                disabled={generating || recording}
              >
                {isPlaying ? 'Stop' : 'Play'}
              </button>
              <button
                type="button"
                className={`voice-loop-button voice-loop-button--record${recording ? ' is-recording' : ''}`}
                onClick={handleRecordLoop}
                disabled={generating || recording}
                aria-busy={recording}
              >
                {recording ? 'Recording' : 'Record'}
              </button>
            </div>
            <div
              className={`voice-loop-status voice-loop-status--${generationStatus.tone}`}
              role="status"
              aria-live="polite"
            >
              <span className="voice-loop-status__dot" aria-hidden="true" />
              <span>{generationStatus.label}</span>
            </div>

            <div className="voice-loop-field">
              <div className="voice-loop-field-header">
                <label htmlFor="voice-loop-seed">Seed</label>
                <button
	                  type="button"
	                  className="voice-loop-dice"
	                  onClick={handleRandomSeed}
	                  disabled={generating || recording}
	                  aria-label="Generate random seed"
                  title="Generate random seed"
                >
                  <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
                    <rect x="4.5" y="4.5" width="15" height="15" rx="3.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
                    <circle cx="9" cy="9" r="1.2" fill="currentColor" />
                    <circle cx="15" cy="9" r="1.2" fill="currentColor" />
                    <circle cx="12" cy="12" r="1.2" fill="currentColor" />
                    <circle cx="9" cy="15" r="1.2" fill="currentColor" />
                    <circle cx="15" cy="15" r="1.2" fill="currentColor" />
                  </svg>
                </button>
              </div>
              <input
                id="voice-loop-seed"
                name="seed"
                value={form.seed}
                onChange={handleFormChange}
              />
            </div>

            <div className="voice-loop-control-grid">
              <label className="voice-loop-field">
                <span>Key</span>
                <select name="key" value={form.key} onChange={handleFormChange}>
                  {KEY_OPTIONS.map((key) => (
                    <option key={key} value={key}>{key}</option>
                  ))}
                </select>
              </label>

              <label className="voice-loop-field">
                <span>Density</span>
                <select name="density" value={form.density} onChange={handleFormChange}>
                  {DENSITY_OPTIONS.map((density) => (
                    <option key={density} value={density}>{density}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="voice-loop-field">
              <span>Tempo {form.bpm}</span>
              <input type="range" name="bpm" min="90" max="180" value={form.bpm} onChange={handleFormChange} />
            </label>

            <label className="voice-loop-field">
              <span>Speed {controls.speed.toFixed(2)}</span>
              <input type="range" name="speed" min="0.6" max="1.8" step="0.01" value={controls.speed} onChange={handleControlChange} />
            </label>

            <label className="voice-loop-field">
              <span>Tone {Math.round(controls.tone)}</span>
              <input type="range" name="tone" min="900" max="7800" step="10" value={controls.tone} onChange={handleControlChange} />
            </label>

            <div className="voice-loop-control-grid">
              <label className="voice-loop-field">
                <span>Wet {controls.wet.toFixed(2)}</span>
                <input type="range" name="wet" min="0" max="0.55" step="0.01" value={controls.wet} onChange={handleControlChange} />
              </label>
              <label className="voice-loop-field">
                <span>Gain {controls.gain.toFixed(2)}</span>
                <input type="range" name="gain" min="0.1" max="1.25" step="0.01" value={controls.gain} onChange={handleControlChange} />
              </label>
            </div>

            <div className="voice-loop-control-grid">
              <label className="voice-loop-field">
                <span>Effort {controls.effort.toFixed(2)}</span>
                <input type="range" name="effort" min="0.35" max="1" step="0.01" value={controls.effort} onChange={handleControlChange} />
              </label>
              <label className="voice-loop-field">
                <span>Breath {controls.breath.toFixed(2)}</span>
                <input type="range" name="breath" min="0" max="0.28" step="0.01" value={controls.breath} onChange={handleControlChange} />
              </label>
            </div>

            {(meta.warning || error) && (
              <p className="voice-loop-message" role={error ? 'alert' : 'status'}>
                {error || meta.warning}
              </p>
            )}
          </form>

          <section className="voice-loop-stage" aria-label="Klattsch score loop">
            <div className="voice-loop-readout">
              <div className="voice-loop-stats" aria-label="Loop stats">
                <span>{events.length} events</span>
                <span>{rendered ? `${rendered.duration.toFixed(2)}s` : 'rendering'}</span>
                <span>{meta.source === 'openai' ? meta.model : meta.source}</span>
              </div>
            </div>

            <textarea
              className="voice-loop-score"
              aria-label="Klattsch score"
              value={score}
              onChange={(event) => {
                setScore(event.target.value);
                setRendered(null);
                setMeta({ source: 'manual', warning: '' });
              }}
              spellCheck={false}
            />

            <div className="voice-loop-grid" aria-label="Score events">
              {events.slice(0, 192).map((event, index) => (
                <button
                  key={`${event.note}-${event.phonemes}-${index}`}
                  type="button"
                  className={`voice-loop-cell has-hit ${index === activeEventIndex ? 'is-active' : ''}`}
                  aria-label={`${event.note} ${event.phonemes}`}
                >
                  <span className="voice-loop-cell__note">{event.note}</span>
                  <span className="voice-loop-cell__word">{event.phonemes}</span>
                </button>
              ))}
            </div>
          </section>
        </section>
      </main>
      <Sidebar disabled isOpen={false} activeTab="voice" />
    </div>
  );
};

export default VoiceLoopLabPage;
