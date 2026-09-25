"""High-resolution pluck onsets: log-spectral flux (superflux-style, max-filtered across
frequency) at 2.9 ms hop, peak-picked, then each onset refined to the sample where the
high-passed signal's energy starts rising. Writes onsets.json [{t, strength, hf}].

usage: onsets.py speed_corrected.wav onsets.json
"""
import numpy as np, soundfile as sf, librosa, scipy.signal as ss, scipy.ndimage as nd, json, sys
x, sr = sf.read(sys.argv[1], dtype='float32'); x = x.mean(axis=1) if x.ndim > 1 else x
hop = 128
S = np.abs(librosa.stft(x, n_fft=2048, hop_length=hop, window='hann'))
mel = librosa.feature.melspectrogram(S=S**2, sr=sr, n_mels=138, fmin=60, fmax=12000)
L = np.log1p(100 * mel)
Lmax = nd.maximum_filter1d(L, 3, axis=0)
lag = 2
flux = np.maximum(0, L[:, lag:] - Lmax[:, :-lag]).sum(axis=0)
flux = np.concatenate([np.zeros(lag), flux])
fr = sr / hop
# adaptive threshold: local median + delta
med = ss.medfilt(flux, 31)
peaks, props = ss.find_peaks(flux, height=med + 0.35 * np.median(flux[flux > 0]) + 2.0, distance=int(0.025 * fr))
# HF energy (above 2 kHz) for transient refinement
b, a = ss.butter(4, 2000 / (sr / 2), 'high')
hf = ss.filtfilt(b, a, x)
env = np.sqrt(ss.convolve(hf ** 2, np.ones(64) / 64, mode='same'))
out = []
for p in peaks:
    c = int((p * hop - 1024 + 1024))  # stft frames are centred
    lo, hi = max(0, c - int(0.03 * sr)), min(len(x), c + int(0.02 * sr))
    seg = env[lo:hi]
    if len(seg) < 10: continue
    pk = np.argmax(seg); base = np.percentile(env[max(0, lo - int(0.05 * sr)):lo + 1], 20) if lo > 0 else 0
    thr = base + 0.2 * (seg[pk] - base)
    k = pk
    while k > 0 and seg[k] > thr: k -= 1
    out.append(dict(t=(lo + k) / sr, strength=float(flux[p]), hf=float(20 * np.log10(seg[pk] + 1e-9))))
json.dump(out, open(sys.argv[2], 'w'))
ioi = np.diff([o['t'] for o in out])
print(len(out), 'onsets; median IOI %.3f s; IOI percentiles 10/50/90: %s' % (np.median(ioi), np.percentile(ioi, [10, 50, 90]).round(3)))
