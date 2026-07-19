import React from 'react';
import SidebarNavigation, { BrandHeader } from '../components/Sidebar/SidebarNavigation.jsx';
import { fetchJson } from '../utils/fetchJson.js';
import { encodeWav } from '../utils/audioEngine/wav.js';
import { renderVoiceScore } from '../utils/voicePhrase.js';
import { LOOPBOOK, STARTER_LOOP } from '../utils/voiceLoopbook.js';
import { startVisibilityAwareRafLoop } from '../utils/visibilityRaf.js';
import './VoiceLoopLabPage.css';

const KEY_OPTIONS = ['F# minor', 'C# minor', 'A# minor', 'G# minor', 'D# minor', 'F minor', 'A dorian', 'E minor', 'D lydian'];
const DENSITY_OPTIONS = ['very high', 'high', 'syncopated', 'wide-open'];
const CARRIER_OPTIONS = ['AA', 'AW', 'ER', 'IY', 'AE', 'OW', 'AY', 'UW'];
const GLIDE_OPTIONS = ['low', 'medium', 'high'];
const STARTER_SCORE = STARTER_LOOP.score;
const PLAYHEAD_UPDATE_INTERVAL_MS = 40;
const RANDOM_SEED_PARTS = {
  feelings: ['aching and luminous', 'euphoric and weightless', 'lonely chrome romance', 'hopeful sunrise drive', 'velvet midnight cruise', 'bittersweet arcade glow'],
  motions: ['low motif lifting to a bright high answer', 'falling staircase that resolves home', 'call and response between bass and ceiling', 'slow arpeggio spiralling upward', 'pulsing octave groove with a soaring lift'],
  hooks: ['work it harder', 'neon never sleeps', 'glass cathedral rising', 'mercury rain falling', 'ghost in the machine', 'velvet circuitry', 'aurora breaks the dawn', 'midnight engine humming'],
  carriers: ['carrier AA', 'carrier ER', 'carrier OW', 'carrier IY', 'carrier AW'],
  gestures: ['recurring 4-note law', 'wide resolved leaps', 'breathy turnarounds', 'late accents on the lift', 'a held shimmering ceiling note']
};

function pickRandom(values) {
  return values[Math.floor(Math.random() * values.length)];
}

function buildRandomSeed() {
  return [
    pickRandom(RANDOM_SEED_PARTS.hooks),
    pickRandom(RANDOM_SEED_PARTS.feelings),
    pickRandom(RANDOM_SEED_PARTS.motions),
    pickRandom(RANDOM_SEED_PARTS.carriers),
    pickRandom(RANDOM_SEED_PARTS.gestures)
  ].join(' / ');
}

function parseScoreEvents(score) {
  const events = [];
  const eventRe = /b([A-G](?:#|b)?-?\d+)\s*\(\s*((?:[^()]|\([^)]*\))+?)\s*\)/g;
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
  const [form, setForm] = React.useState(() => ({
    seed: STARTER_LOOP.blurb,
    key: STARTER_LOOP.key,
    bpm: STARTER_LOOP.bpm,
    density: 'very high',
    carrier: 'AA',
    glide: 'medium'
  }));
  const [score, setScore] = React.useState(STARTER_SCORE);
  const [activeLoopId, setActiveLoopId] = React.useState(STARTER_LOOP.id);
  const [rendered, setRendered] = React.useState(null);
  const [controls, setControls] = React.useState(() => ({
    speed: 1,
    tone: 4200,
    wet: 0.16,
    gain: 0.82,
    effort: 0.82,
    breath: 0.04,
    scale: 1.02,
    vibratoDepth: 1.5,
    vibratoRate: 5,
    tremoloDepth: 0.04,
    tremoloRate: 5,
    ...STARTER_LOOP.controls
  }));
  const [meta, setMeta] = React.useState(() => ({
    source: 'loopbook',
    warning: '',
    notes: STARTER_LOOP.notes
  }));
  const [generating, setGenerating] = React.useState(false);
  const [recording, setRecording] = React.useState(false);
  const [generationStatus, setGenerationStatus] = React.useState(() => ({
    tone: 'idle',
    label: ''
  }));
  const [error, setError] = React.useState('');
  const [isPlaying, setIsPlaying] = React.useState(false);

  const audioContextRef = React.useRef(null);
  const runtimeRef = React.useRef(null);
  const startedAtRef = React.useRef(0);
  const generationSerialRef = React.useRef(0);
  const renderInputRevisionRef = React.useRef(0);
  const renderedRevisionRef = React.useRef(-1);
  const scoreGridRef = React.useRef(null);
  const activeEventIndexRef = React.useRef(-1);
  const pendingContinuousFormRef = React.useRef(null);
  const pendingContinuousControlsRef = React.useRef(null);
  const continuousChangeFrameRef = React.useRef(null);

  const flushContinuousChanges = React.useCallback(() => {
    if (continuousChangeFrameRef.current !== null) {
      cancelAnimationFrame(continuousChangeFrameRef.current);
      continuousChangeFrameRef.current = null;
    }

    const formPatch = pendingContinuousFormRef.current;
    const controlsPatch = pendingContinuousControlsRef.current;
    pendingContinuousFormRef.current = null;
    pendingContinuousControlsRef.current = null;

    if (formPatch) {
      setForm((current) => ({ ...current, ...formPatch }));
    }
    if (controlsPatch) {
      setControls((current) => ({ ...current, ...controlsPatch }));
    }
  }, []);

  const queueContinuousChange = React.useCallback((event) => {
    const { name, value } = event.currentTarget;
    const numericValue = Number(value);
    if (name === 'bpm') {
      pendingContinuousFormRef.current = {
        ...pendingContinuousFormRef.current,
        bpm: numericValue
      };
    } else {
      pendingContinuousControlsRef.current = {
        ...pendingContinuousControlsRef.current,
        [name]: numericValue
      };
    }
    if (continuousChangeFrameRef.current === null) {
      continuousChangeFrameRef.current = requestAnimationFrame(flushContinuousChanges);
    }
  }, [flushContinuousChanges]);

  React.useEffect(() => () => {
    if (continuousChangeFrameRef.current !== null) {
      cancelAnimationFrame(continuousChangeFrameRef.current);
    }
    continuousChangeFrameRef.current = null;
    pendingContinuousFormRef.current = null;
    pendingContinuousControlsRef.current = null;
  }, []);

  const continuousRangeFlushProps = React.useMemo(() => ({
    onPointerUp: flushContinuousChanges,
    onPointerCancel: flushContinuousChanges,
    onKeyUp: flushContinuousChanges,
    onBlur: flushContinuousChanges
  }), [flushContinuousChanges]);

  const events = React.useMemo(() => parseScoreEvents(score), [score]);

  const updateActiveEvent = React.useCallback((nextIndex) => {
    const previousIndex = activeEventIndexRef.current;
    if (previousIndex === nextIndex) return;
    const cells = scoreGridRef.current?.children;
    const previousCell = cells?.[previousIndex];
    if (previousCell) {
      previousCell.classList.remove('is-active');
      previousCell.removeAttribute('aria-current');
    }
    const nextCell = cells?.[nextIndex];
    if (nextCell) {
      nextCell.classList.add('is-active');
      nextCell.setAttribute('aria-current', 'true');
    }
    activeEventIndexRef.current = nextIndex;
  }, []);

  React.useEffect(() => {
    updateActiveEvent(-1);
  }, [events, updateActiveEvent]);

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
    const renderRevision = renderInputRevisionRef.current;
    const ctx = await ensureAudioContext();
    const nextRendered = renderVoiceScore(ctx, score, {
      effort: controls.effort,
      aspiration: controls.breath,
      scale: controls.scale,
      vibratoDepth: controls.vibratoDepth,
      vibratoRate: controls.vibratoRate,
      tremoloDepth: controls.tremoloDepth,
      tremoloRate: controls.tremoloRate
    });
    renderedRevisionRef.current = renderRevision;
    setRendered(nextRendered);
    setError(nextRendered.warnings?.length ? nextRendered.warnings.join(' ') : '');
    return nextRendered;
  }, [
    controls.breath,
    controls.effort,
    controls.scale,
    controls.tremoloDepth,
    controls.tremoloRate,
    controls.vibratoDepth,
    controls.vibratoRate,
    ensureAudioContext,
    score
  ]);

  React.useEffect(() => {
    renderInputRevisionRef.current += 1;
    renderedRevisionRef.current = -1;
    setRendered(null);
  }, [renderScore]);

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
    updateActiveEvent(-1);
    setIsPlaying(true);
  }, [controls.speed, updateActiveEvent]);

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
    if (
      !isPlaying
      || renderedRevisionRef.current === renderInputRevisionRef.current
    ) {
      return undefined;
    }
    const timeoutId = window.setTimeout(async () => {
      try {
        const nextRendered = await renderScore();
        if (isPlaying) startRenderedLoop(nextRendered.buffer);
      } catch (renderError) {
        setError('Score render failed.');
      }
    }, 260);
    return () => window.clearTimeout(timeoutId);
  }, [isPlaying, renderScore, startRenderedLoop]);

  React.useEffect(() => {
    if (!isPlaying || !rendered) {
      updateActiveEvent(-1);
      return undefined;
    }
    let lastUpdate = Number.NEGATIVE_INFINITY;
    const stopFrameLoop = startVisibilityAwareRafLoop((frameTime) => {
      if (frameTime - lastUpdate < PLAYHEAD_UPDATE_INTERVAL_MS) return;
      lastUpdate = frameTime;
      const ctx = audioContextRef.current;
      if (ctx) {
        const playhead = (
          ctx.currentTime - startedAtRef.current
        ) % Math.max(rendered.duration, 0.01);
        const nextIndex = events.length > 0
          ? Math.floor((playhead / Math.max(rendered.duration, 0.01)) * events.length)
            % events.length
          : -1;
        updateActiveEvent(nextIndex);
      }
    });
    return () => {
      stopFrameLoop();
      updateActiveEvent(-1);
    };
  }, [events.length, isPlaying, rendered, updateActiveEvent]);

  React.useEffect(() => () => {
    stopSource(runtimeRef);
  }, []);

  const stopLoop = React.useCallback(() => {
    stopSource(runtimeRef);
    updateActiveEvent(-1);
    setIsPlaying(false);
  }, [updateActiveEvent]);

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
	          density: nextForm.density,
	          carrier: nextForm.carrier,
	          glide: nextForm.glide
	        })
	      });
      if (result.loop?.score) {
        setScore(result.loop.score);
        setRendered(null);
      }
	      setMeta({
	        source: result.source || 'openai',
	        model: result.model || '',
	        warning: result.warning || '',
	        notes: result.loop?.notes || ''
	      });
	      setGenerationStatus({
	        tone: 'ready',
	        label: ''
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

  const handleLoadLoop = React.useCallback((loop) => {
    setScore(loop.score);
    setRendered(null);
    setActiveLoopId(loop.id);
    setError('');
    setForm((current) => ({
      ...current,
      seed: loop.blurb,
      key: loop.key,
      bpm: loop.bpm
    }));
    setControls((current) => ({ ...current, ...loop.controls }));
    setMeta({ source: 'loopbook', warning: '', notes: loop.notes });
    setGenerationStatus({ tone: 'ready', label: loop.title });
  }, []);

  const handleGenerate = async (event) => {
    event.preventDefault();
    setActiveLoopId(null);
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
      [name]: value
    }));
  };

  return (
    <div className="voice-loop-page">
      <main className="voice-loop-shell">
        <BrandHeader className="voice-loop-header" />

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
            {generationStatus.label && (
              <div
                className={`voice-loop-status voice-loop-status--${generationStatus.tone}`}
                role="status"
                aria-live="polite"
              >
                <span className="voice-loop-status__dot" aria-hidden="true" />
                <span>{generationStatus.label}</span>
              </div>
            )}

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

            <div className="voice-loop-control-grid">
              <label className="voice-loop-field">
                <span>Carrier</span>
                <select name="carrier" value={form.carrier} onChange={handleFormChange}>
                  {CARRIER_OPTIONS.map((carrier) => (
                    <option key={carrier} value={carrier}>{carrier}</option>
                  ))}
                </select>
              </label>

              <label className="voice-loop-field">
                <span>Glide</span>
                <select name="glide" value={form.glide} onChange={handleFormChange}>
                  {GLIDE_OPTIONS.map((glide) => (
                    <option key={glide} value={glide}>{glide}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="voice-loop-field">
              <span>Tempo {form.bpm}</span>
              <input type="range" name="bpm" min="90" max="180" value={form.bpm} onChange={queueContinuousChange} {...continuousRangeFlushProps} />
            </label>

            <label className="voice-loop-field">
              <span>Speed {controls.speed.toFixed(2)}</span>
              <input type="range" name="speed" min="0.6" max="1.8" step="0.01" value={controls.speed} onChange={queueContinuousChange} {...continuousRangeFlushProps} />
            </label>

            <label className="voice-loop-field">
              <span>Tone {Math.round(controls.tone)}</span>
              <input type="range" name="tone" min="900" max="7800" step="10" value={controls.tone} onChange={queueContinuousChange} {...continuousRangeFlushProps} />
            </label>

            <div className="voice-loop-control-grid">
              <label className="voice-loop-field">
                <span>Wet {controls.wet.toFixed(2)}</span>
                <input type="range" name="wet" min="0" max="0.55" step="0.01" value={controls.wet} onChange={queueContinuousChange} {...continuousRangeFlushProps} />
              </label>
              <label className="voice-loop-field">
                <span>Gain {controls.gain.toFixed(2)}</span>
                <input type="range" name="gain" min="0.1" max="1.25" step="0.01" value={controls.gain} onChange={queueContinuousChange} {...continuousRangeFlushProps} />
              </label>
            </div>

            <div className="voice-loop-control-grid">
              <label className="voice-loop-field">
                <span>Effort {controls.effort.toFixed(2)}</span>
                <input type="range" name="effort" min="0.35" max="1" step="0.01" value={controls.effort} onChange={queueContinuousChange} {...continuousRangeFlushProps} />
              </label>
              <label className="voice-loop-field">
                <span>Scale {controls.scale.toFixed(2)}</span>
                <input type="range" name="scale" min="0.82" max="1.3" step="0.01" value={controls.scale} onChange={queueContinuousChange} {...continuousRangeFlushProps} />
              </label>
            </div>

            <div className="voice-loop-control-grid">
              <label className="voice-loop-field">
                <span>Breath {controls.breath.toFixed(2)}</span>
                <input type="range" name="breath" min="0" max="0.28" step="0.01" value={controls.breath} onChange={queueContinuousChange} {...continuousRangeFlushProps} />
              </label>
              <label className="voice-loop-field">
                <span>Vibrato {controls.vibratoDepth.toFixed(1)}</span>
                <input type="range" name="vibratoDepth" min="0" max="8" step="0.1" value={controls.vibratoDepth} onChange={queueContinuousChange} {...continuousRangeFlushProps} />
              </label>
            </div>

            <div className="voice-loop-control-grid">
              <label className="voice-loop-field">
                <span>Vib rate {controls.vibratoRate.toFixed(1)}</span>
                <input type="range" name="vibratoRate" min="3" max="9" step="0.1" value={controls.vibratoRate} onChange={queueContinuousChange} {...continuousRangeFlushProps} />
              </label>
              <label className="voice-loop-field">
                <span>Tremolo {controls.tremoloDepth.toFixed(2)}</span>
                <input type="range" name="tremoloDepth" min="0" max="0.32" step="0.01" value={controls.tremoloDepth} onChange={queueContinuousChange} {...continuousRangeFlushProps} />
              </label>
            </div>

            <label className="voice-loop-field">
              <span>Trem rate {controls.tremoloRate.toFixed(1)}</span>
              <input type="range" name="tremoloRate" min="2" max="12" step="0.1" value={controls.tremoloRate} onChange={queueContinuousChange} {...continuousRangeFlushProps} />
            </label>

            {(meta.warning || error) && (
              <p className="voice-loop-message" role={error ? 'alert' : 'status'}>
                {error || meta.warning}
              </p>
            )}
          </form>

          <section className="voice-loop-stage" aria-label="Klattsch score loop">
            <div className="voice-loop-loopbook" aria-label="Loopbook">
              <div className="voice-loop-loopbook__head">
                <h2 className="voice-loop-loopbook__title">Loopbook</h2>
                <span className="voice-loop-loopbook__hint">curated melodic loops · click to load</span>
              </div>
              <div className="voice-loop-loopbook__items">
                {LOOPBOOK.map((loop) => (
                  <button
                    key={loop.id}
                    type="button"
                    className={`voice-loop-item${activeLoopId === loop.id ? ' is-active' : ''}`}
                    onClick={() => handleLoadLoop(loop)}
                    disabled={generating || recording}
                    title={loop.notes}
                  >
                    <span className="voice-loop-item__title">{loop.title}</span>
                    <span className="voice-loop-item__key">{loop.key} · {loop.bpm}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="voice-loop-readout">
              {meta.notes && (
                <p className="voice-loop-notes" title={meta.notes}>{meta.notes}</p>
              )}
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
                setActiveLoopId(null);
                setMeta({ source: 'manual', warning: '', notes: '' });
              }}
              spellCheck={false}
            />

            <div ref={scoreGridRef} className="voice-loop-grid" aria-label="Score events">
              {events.slice(0, 192).map((event, index) => (
                <button
                  key={`${event.note}-${event.phonemes}-${index}`}
                  type="button"
                  className="voice-loop-cell has-hit"
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
      <SidebarNavigation />
    </div>
  );
};

export default VoiceLoopLabPage;
