"""The record's noise floor: per 1/6-octave band, the quietest 3% of 85 ms windows while the music
plays (the gaps between strokes), against the band's median; plus any steady tones (mains hum).
On Pernambuco it is flat tape hiss above about 3 kHz and there is no 50/60 Hz hum.

usage: noise_floor.py record.wav noise_floor.json
"""
import numpy as np, soundfile as sf, scipy.signal as ss, json, sys
x, sr = sf.read(sys.argv[1], dtype='float64'); x = x.mean(axis=1)
music = x[int(0.6 * sr):int(92.5 * sr)]
n = 4096; hop = 1024
frames = np.lib.stride_tricks.sliding_window_view(music, n)[::hop] * np.hanning(n)
P = np.abs(np.fft.rfft(frames, axis=1)) ** 2
f = np.fft.rfftfreq(n, 1 / sr)
# per band, the 3rd-percentile power over time = the floor under the notes
centres = 1000 * 2 ** (np.arange(-30, 25) / 6)
rows = []
for c in centres:
    m = (f >= c / 2 ** (1 / 12)) & (f < c * 2 ** (1 / 12))
    if m.any() and c < sr / 2:
        band = P[:, m].mean(axis=1)
        rows.append((float(c), float(10 * np.log10(np.percentile(band, 3) + 1e-30)), float(10 * np.log10(np.median(band) + 1e-30))))
print('band Hz   floor dB   median dB   floor-median')
for c, fl, md in rows[::2]: print(f'{c:8.0f}  {fl:8.1f}  {md:9.1f}  {fl - md:8.1f}')
# steady tones: long-window spectrum of the quietest 20% of 0.5 s windows
w = int(0.5 * sr); k = len(music) // w
segs = music[:k * w].reshape(k, w); lv = np.sqrt((segs ** 2).mean(axis=1))
quiet = segs[lv <= np.percentile(lv, 20)]
S = np.mean(np.abs(np.fft.rfft(quiet * np.hanning(w), axis=1)) ** 2, axis=0); fq = np.fft.rfftfreq(w, 1 / sr)
for hz in (50, 60, 100, 120, 150, 180):
    i = np.argmin(np.abs(fq - hz)); around = np.r_[S[i - 12:i - 3], S[i + 3:i + 12]]
    print(f'{hz:4d} Hz line: {10 * np.log10(S[i - 1:i + 2].max() / np.median(around)):+.1f} dB over its neighbourhood')
json.dump(dict(floor=[(c, fl) for c, fl, md in rows]), open(sys.argv[2], 'w'))
