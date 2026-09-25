"""Self-similarity of beat-synchronous chroma + CQT to reveal the piece's form (repeats).

Also writes the beat times the MIDI tempo map follows.

usage: beats_and_form.py speed_corrected.wav form.png beats.json
"""
import numpy as np, soundfile as sf, librosa, matplotlib, sys, json
matplotlib.use('Agg'); import matplotlib.pyplot as plt
x, sr = sf.read(sys.argv[1], dtype='float32'); x = x.mean(axis=1) if x.ndim > 1 else x
hop = 512
oenv = librosa.onset.onset_strength(y=x, sr=sr, hop_length=hop)
tempo, beats = librosa.beat.beat_track(onset_envelope=oenv, sr=sr, hop_length=hop, start_bpm=110, tightness=200)
bt = librosa.frames_to_time(beats, sr=sr, hop_length=hop)
print('tempo', tempo, 'beats', len(beats), 'first beats', np.round(bt[:8], 3), 'median IBI', np.median(np.diff(bt)).round(4))
C = librosa.feature.chroma_cqt(y=x, sr=sr, hop_length=hop)
Cs = librosa.util.sync(C, beats, aggregate=np.median)
Q = np.abs(librosa.cqt(x, sr=sr, hop_length=hop, fmin=librosa.note_to_hz('E2'), n_bins=48, bins_per_octave=12))
Qs = librosa.util.sync(np.log1p(10 * Q), beats, aggregate=np.mean)
F = np.vstack([Cs / (np.linalg.norm(Cs, axis=0) + 1e-9), 0.5 * Qs / (np.linalg.norm(Qs, axis=0) + 1e-9)])
# stack 4 beats of context
k = 4
Fk = np.vstack([np.roll(F, -i, axis=1) for i in range(k)])
Fk /= np.linalg.norm(Fk, axis=0) + 1e-9
S = Fk.T @ Fk
fig, ax = plt.subplots(figsize=(11, 10), dpi=90)
ax.imshow(S, origin='lower', cmap='magma', vmin=0.5, vmax=1, extent=[0, len(bt), 0, len(bt)])
tick = np.arange(0, len(bt), 16)
ax.set_xticks(tick); ax.set_xticklabels([f'{bt[i]:.0f}s' for i in tick], fontsize=6)
ax.set_yticks(tick); ax.set_yticklabels([f'{bt[i]:.0f}s' for i in tick], fontsize=6)
ax.grid(alpha=0.25); ax.set_title('beat-synchronous self-similarity (4-beat context)')
fig.tight_layout(); fig.savefig(sys.argv[2])
# report strongest off-diagonal repeats (lag in beats)
lags = []
for lag in range(8, len(bt) - 8):
    d = np.diagonal(S, offset=lag)
    lags.append((d.mean(), lag))
lags.sort(reverse=True)
print('top repeat lags (beats, mean sim):', [(l, round(m, 3)) for m, l in lags[:10]])
json.dump(dict(beats=bt.tolist(), tempo=float(np.atleast_1d(tempo)[0])), open(sys.argv[3], 'w'))
