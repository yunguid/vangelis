import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { audioEngine } from '../utils/audioEngine.js';
import { useMidiPlayback } from './useMidiPlayback.js';
import {
  arrangeBuiltInPiece,
  getLandingFiles,
  loadLandingSelection,
  loadLastLandingId,
  loadRemovedPieces,
  pickLandingPiece,
  saveLastLandingId
} from '../data/landingQueue.js';

// Once per document visit, including hash-route navigation back to the keyboard.
let openingClaimed = false;

export function useOpeningPerformance({ audioParams }) {
  // The sound of whichever piece the landing queue picked; null until it has
  // loaded, and for pieces that only override part of the listener's sound.
  const [pieceSound, setPieceSound] = useState(null);
  const pieceParams = useMemo(() => ({
    ...(pieceSound?.params || audioParams),
    volume: (audioParams.volume ?? 0.68) * 0.85,
    pan: audioParams.pan ?? 0
  }), [pieceSound, audioParams]);
  const playback = useMidiPlayback({
    waveformType: pieceSound?.waveformType || 'Sine',
    audioParams: pieceParams
  });
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
  }, [playback.stop]);

  useEffect(() => {
    if (cancelled.current) return undefined;
    let disposed = false;
    let context;
    let score;
    const tryStart = () => {
      if (disposed || cancelled.current || started.current || !score) return;
      if (context.state !== 'running') {
        return;
      }
      openingClaimed = true;
      started.current = true;
      playback.play(score);
    };
    (async () => {
      try {
        context = await audioEngine.ensureAudioContext();
        if (disposed || cancelled.current) return;
        context.addEventListener('statechange', tryStart);
        // A piece removed from the MIDI library does not open the page either.
        const removed = loadRemovedPieces();
        const files = getLandingFiles().filter((file) => !removed.has(file.id));
        const piece = pickLandingPiece(files, loadLandingSelection(files), loadLastLandingId());
        // Every piece switched off in the MIDI tab: the page opens silent.
        if (!piece) return;
        const arranged = await arrangeBuiltInPiece(context, piece);
        if (disposed || cancelled.current) return;
        saveLastLandingId(piece.id);
        setPieceSound({ params: arranged.params, waveformType: arranged.waveformType, sound: arranged.sound, piece });
        score = arranged.score;
        // Prepare the existing audio engine before reporting that playback started.
        await audioEngine.ensureWasm();
        tryStart();
      } catch (error) {
        if (disposed || cancelled.current) return;
        console.error('Opening performance failed:', error);
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

  // `sound` is what the piece is played with, for the page to load under the keys;
  // `piece` is the landing file, and the rest is its transport for the notes view.
  return {
    activeNotes: playback.activeNotes,
    currentMidi: playback.currentMidi,
    progress: playback.progress,
    isPlaying: playback.isPlaying,
    stop,
    sound: pieceSound?.sound ?? null,
    piece: pieceSound?.piece ?? null
  };
}
