import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { audioEngine } from '../utils/audioEngine.js';
import { useMidiPlayback } from './useMidiPlayback.js';
import { OPENING_PARAMS } from '../data/openingPerformance.js';

// Once per document visit, including hash-route navigation back to the keyboard.
let openingClaimed = false;

export function useOpeningPerformance({ audioParams }) {
  const pianoParams = useMemo(() => ({
    ...OPENING_PARAMS,
    volume: (audioParams.volume ?? 0.68) * 0.85,
    pan: audioParams.pan ?? 0
  }), [audioParams.volume, audioParams.pan]);
  const playback = useMidiPlayback({ waveformType: 'Sine', audioParams: pianoParams });
  const [status, setStatus] = useState(() => openingClaimed ? 'done' : 'loading');
  const cancelled = useRef(openingClaimed);
  const started = useRef(false);
  const userParams = useRef(audioParams);
  userParams.current = audioParams;

  const stop = useCallback(() => {
    if (cancelled.current) return;
    cancelled.current = true;
    openingClaimed = true;
    playback.stop(); // Also invalidates a start waiting on the audio worklet.
    if (started.current) audioEngine.setGlobalParams(userParams.current);
    setStatus('done');
  }, [playback.stop]);

  useEffect(() => {
    if (cancelled.current) return undefined;
    let disposed = false;
    let context;
    let score;
    const tryStart = () => {
      if (disposed || cancelled.current || started.current || !score) return;
      if (context.state !== 'running') {
        setStatus('ready');
        return;
      }
      openingClaimed = true;
      started.current = true;
      setStatus('playing');
      playback.play(score);
    };
    (async () => {
      try {
        context = await audioEngine.ensureAudioContext();
        if (disposed || cancelled.current) return;
        context.addEventListener('statechange', tryStart);
        const { loadOpeningPerformance } = await import('../data/openingPerformance.js');
        score = await loadOpeningPerformance(context);
        if (disposed || cancelled.current) return;
        // Prepare the existing audio engine before reporting that playback started.
        await audioEngine.ensureWasm();
        tryStart();
      } catch (error) {
        if (disposed || cancelled.current) return;
        console.error('Opening performance failed:', error);
        setStatus('error');
      }
    })();
    return () => {
      disposed = true;
      context?.removeEventListener('statechange', tryStart);
      if (started.current) audioEngine.setGlobalParams(userParams.current);
    };
  }, [playback.play]);

  const wasPlaying = useRef(false);
  useEffect(() => {
    if (playback.isPlaying) wasPlaying.current = true;
    else if (wasPlaying.current) stop();
  }, [playback.isPlaying, stop]);

  const listen = useCallback(() => {
    // Called directly in the click gesture for Safari's audio-unlock policy.
    const context = audioEngine.context;
    if (!context || cancelled.current) return;
    context.resume().catch((error) => {
      console.error('Opening audio could not be unlocked:', error);
      setStatus('error');
    });
  }, []);

  return { status, activeNotes: playback.activeNotes, stop, listen };
}
