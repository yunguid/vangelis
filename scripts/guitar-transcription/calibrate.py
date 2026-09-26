"""Closed-loop calibration of a render against the record.
1. tone: 1/6-octave long-term spectrum difference (render - record), smoothed -> correction curve
   (dB at Hz) to fold into the sample voicing;
2. attack: the stroke's first moments against its ring, both averaged over the strokes in the span
   (onset-aligned spectra of 25 ms from each stroke and of 50-150 ms after strokes that ring that
   long), render - record: how much brighter or duller the attack is than the ring's difference
   explains -> a correction for the first moments of each take (build_samples.py --attack);
3. loudness: refit every transcribed note's gain on the render (same model, same notes) and compare
   with the gain fitted on the record -> per-note dB error, used to correct velocities.
usage: calibrate.py record.wav render.wav fit.pkl features.pkl out.json --cents 41.7 --span 0.5,92
       (the record's pitch above A440, and the seconds of music to measure)"""
import sys, json, pickle, numpy as np, soundfile as sf, librosa, scipy.signal as ss
sys.path.insert(0, sys.path[0])
from model import FRAME_SECONDS, Model
from features import cqt, SR
rec_p, ren_p, fit_p, abs_p, out = sys.argv[1:6]
option = lambda name: sys.argv[sys.argv.index(name) + 1]
SPEED = 2 ** (float(option('--cents')) / 1200)
T0, T1 = (float(v) for v in option('--span').split(','))
def load(p):
    x, sr = sf.read(p, dtype='float32'); x = x.mean(axis=1) if x.ndim > 1 else x
    return x, sr
a, sra = load(rec_p); b, srb = load(ren_p)
a = librosa.resample(a, orig_sr=sra, target_sr=SR); b = librosa.resample(b, orig_sr=srb, target_sr=SR)
n = min(len(a), len(b)); a, b = a[:n], b[:n]
act = slice(int(T0 * SR), int(T1 * SR))
g = np.sqrt(np.mean(a[act] ** 2) / np.mean(b[act] ** 2)); b = b * g
f, Pa = ss.welch(a[act], SR, nperseg=16384); _, Pb = ss.welch(b[act], SR, nperseg=16384)
centres = 1000 * 2 ** (np.arange(-30, 25) / 6)
curve = []
for c in centres:
    m = (f >= c / 2 ** (1 / 12)) & (f < c * 2 ** (1 / 12))
    if m.any() and c < SR / 2: curve.append((float(c), float(10 * np.log10(Pb[m].mean() / Pa[m].mean()))))
cf = np.array([c for c, _ in curve]); cd = np.array([d for _, d in curve])
cd_s = np.convolve(np.pad(cd, 2, mode='edge'), np.ones(5) / 5, mode='valid')
print('render - record, 1/6 octave, smoothed (dB):')
for c, d in zip(cf[::3], cd_s[::3]): print(f'  {c:7.0f} Hz {d:+5.1f}')
P = pickle.load(open(abs_p, 'rb')); F = pickle.load(open(fit_p, 'rb'))
# the attack against the ring, per third octave, at the fit's strokes (chords within 80 ms are one)
strokes = sorted({n['t'] * FRAME_SECONDS / SPEED for n in F['notes']})
groups = [t for i, t in enumerate(strokes) if i == 0 or t - strokes[i - 1] > 0.08]
nfft = 1024; win = np.hanning(nfft); fa = np.fft.rfftfreq(nfft, 1 / SR)
def onset_spectrum(x, times, start, length):
    acc = []
    for t in times:
        seg = x[int((t + start) * SR):int((t + start + length) * SR)]
        acc.append(np.mean([np.abs(np.fft.rfft(seg[i:i + nfft] * win)) ** 2 for i in range(0, len(seg) - nfft + 1, nfft // 2)], axis=0))
    return np.mean(acc, axis=0)
starts = [t for t in groups if T0 <= t - 0.005 and t + 0.3 < T1]
ringing = [t for t, nxt in zip(groups, groups[1:] + [np.inf]) if T0 <= t and t + 0.3 < T1 and nxt - t > 0.15]
atk = 10 * np.log10(onset_spectrum(b, starts, -0.005, 0.03) / onset_spectrum(a, starts, -0.005, 0.03))
ring = 10 * np.log10(onset_spectrum(b, ringing, 0.05, 0.1) / onset_spectrum(a, ringing, 0.05, 0.1))
attack = []
for c in 1000 * 2 ** (np.arange(-6, 13) / 3):
    m = (fa >= c / 2 ** (1 / 6)) & (fa < c * 2 ** (1 / 6))
    if m.any() and c < SR / 2: attack.append((float(c), float(np.mean(atk[m]) - np.mean(ring[m]))))
print(f'attack - ring, render - record, over {len(starts)} strokes ({len(ringing)} ringing 150 ms):')
for c, d in attack[::2]: print(f'  {c:7.0f} Hz {d:+5.1f}')
# loudness per note: refit gains on the render (tape-speed-corrected like the record's model)
b_desped = librosa.resample(b, orig_sr=SR / SPEED, target_sr=SR)
Vb = cqt(b_desped)[:, :P['V'].shape[1]]
Vb = np.pad(Vb, ((0, 0), (0, P['V'].shape[1] - Vb.shape[1])))
# the render measured by the same model: its notes copied, so the record's gains stay put
M = Model.resume({**P, 'V': Vb}, {**F, 'notes': [dict(n) for n in F['notes']]})
M.fit_gains(iters=20, fit_H=False)
err = np.array([20 * np.log10(max(m['g'], 1e-9) / max(n['g'], 1e-9)) for m, n in zip(M.notes, F['notes'])])
err -= np.median(err)
print(f'per-note loudness error (render vs record, median removed): IQR {np.percentile(err, 25):+.1f}..{np.percentile(err, 75):+.1f} dB, 5..95% {np.percentile(err, 5):+.1f}..{np.percentile(err, 95):+.1f} dB')
keys = [f"{n['t']:.2f}:{n['midi']}:{n['s']}" for n in F['notes']]
json.dump(dict(tone=list(zip(cf.tolist(), cd_s.tolist())), attack=attack, note_error_db=err.tolist(),
               note_error_by_key=dict(zip(keys, err.tolist()))), open(out, 'w'))
