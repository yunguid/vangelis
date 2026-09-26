"""Closed-loop cuts to the pad's low notes (up to D3): a pad note's fundamental, rendered with the
pad alone, against what the record leaves for it there once the other parts (a render of
everything but the pad) are taken out, in power. Where the pad alone is louder than that room,
the note is cut by the difference; a note is never raised (the record there is an upper bound
on the pad). Levels are the median over the note's middle of a log-frequency spectrogram
(25-400 Hz, 60 bins an octave, 0.5 s windows, 20 ms hop) of the mid signal at 2 kHz.

usage: pad_fix.py record.wav pad.wav others.wav score.json out.json [--gain dB]
  pad.wav: BRB_PARTS=pad BRB_NOISE=off; others.wav: every part but the pad, with the noise bed;
  --gain: dB applied to the pad render first (for fitting the cuts at another pad level)
out.json: {"start:midi": dB}, read by make_midi.py --pad-fix
"""
import argparse, json
import numpy as np
import soundfile as sf
from scipy.signal import decimate, stft

ap = argparse.ArgumentParser()
for name in ('record', 'pad', 'others', 'score', 'out'): ap.add_argument(name)
ap.add_argument('--gain', type=float, default=0.0)
ap.add_argument('--tuning', type=float, default=11.6)
a = ap.parse_args()
FS = 2000
BPO = 60
fl = 25 * 2 ** (np.arange(0, int(BPO * np.log2(400 / 25)) + 1) / BPO)


def logspec(path, gain_db=0.0):
    x, sr = sf.read(path, dtype='float64')
    assert sr == 48000
    mid = np.mean([decimate(decimate(decimate(x[:, c], 4, ftype='fir'), 3, ftype='fir'), 2, ftype='fir') for c in (0, 1)], axis=0)
    f, t, Z = stft(mid * 10 ** (gain_db / 20), fs=FS, nperseg=1000, noverlap=960, nfft=16000, boundary=None)
    P = np.abs(Z) ** 2
    idx = fl / (FS / 16000); i0 = np.floor(idx).astype(int); fr = idx - i0
    return 10 * np.log10(P[i0] * (1 - fr)[:, None] + P[i0 + 1] * fr[:, None] + 1e-20), t + 0.25


R, t = logspec(a.record); P, _ = logspec(a.pad, a.gain); O, _ = logspec(a.others)
n = min(R.shape[1], P.shape[1], O.shape[1]); R, P, O, t = R[:, :n], P[:, :n], O[:, :n], t[:n]
hz = lambda m: 440 * 2 ** ((m - 69) / 12 + a.tuning / 1200)
fix = {}
for note in (x for x in json.load(open(a.score)) if x['part'] == 'pad' and x['midi'] <= 50):
    k = int(np.argmin(np.abs(fl - hz(note['midi']))))
    s = (t >= note['start'] + 0.3) & (t <= max(note['end'] - 0.3, note['start'] + 0.6))
    if s.sum() < 3: continue
    rec = 10 ** (R[k - 1:k + 2, s].max(0) / 10); oth = 10 ** (O[k - 1:k + 2, s].max(0) / 10)
    room = 10 * np.log10(np.maximum(rec - oth, rec / 10))   # at most 10 dB taken out
    fix[f"{note['start']:.2f}:{note['midi']}"] = round(-max(0.0, float(np.median(P[k - 1:k + 2, s].max(0) - room))), 1)
json.dump(fix, open(a.out, 'w'))
cuts = np.array(list(fix.values()))
print(f'{len(cuts)} low pad notes: cut median {np.median(cuts):.1f} dB, more than 3 dB: {(cuts < -3).sum()}, more than 10 dB: {(cuts < -10).sum()}')
