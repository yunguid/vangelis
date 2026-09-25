"""Closed-loop calibration of a render against the record.
1. tone: 1/6-octave long-term spectrum difference (render - record), smoothed -> correction curve
   (dB at Hz) to fold into the sample voicing;
2. loudness: refit every transcribed note's gain on the render (same model, same notes) and compare
   with the gain fitted on the record -> per-note dB error, used to correct velocities.
usage: calibrate.py record.wav render.wav fit.pkl features.pkl out.json"""
import sys, json, pickle, numpy as np, soundfile as sf, librosa, scipy.signal as ss
sys.path.insert(0, sys.path[0])
from model import Model
from features import cqt, SR
rec_p, ren_p, fit_p, abs_p, out = sys.argv[1:6]
CENTS = 41.7; SPEED = 2 ** (CENTS / 1200)
def load(p):
    x, sr = sf.read(p, dtype='float32'); x = x.mean(axis=1) if x.ndim > 1 else x
    return x, sr
a, sra = load(rec_p); b, srb = load(ren_p)
a = librosa.resample(a, orig_sr=sra, target_sr=SR); b = librosa.resample(b, orig_sr=srb, target_sr=SR)
n = min(len(a), len(b)); a, b = a[:n], b[:n]
act = slice(int(0.5 * SR), int(92 * SR))
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
# loudness per note: refit gains on the render (tape-speed-corrected like the record's model)
P = pickle.load(open(abs_p, 'rb')); F = pickle.load(open(fit_p, 'rb'))
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
json.dump(dict(tone=list(zip(cf.tolist(), cd_s.tolist())), note_error_db=err.tolist(),
               note_error_by_key=dict(zip(keys, err.tolist()))), open(out, 'w'))
