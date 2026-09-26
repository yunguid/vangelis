"""How far the hiss sits under the music: the quietest 10% of 50 ms windows above 7 kHz (where the
record is all tape hiss), against the music's active RMS. Run on the record and on a render to
set a piece's hissGain (src/data/guitarTranscriptions.js): Pernambuco's record is 44.2 dB,
The Shade of the Mango Tree's solo intro 48.7 dB.

usage: hiss_level.py record.wav [render.wav ...] --span 0.6,92.5   (the seconds of music to measure)
"""
import numpy as np, soundfile as sf, scipy.signal as ss, sys
span = sys.argv.index('--span')
T0, T1 = (float(v) for v in sys.argv[span + 1].split(','))
for f in sys.argv[1:span] + sys.argv[span + 2:]:
    x, sr = sf.read(f, dtype='float64'); x = x.mean(axis=1) if x.ndim > 1 else x
    music = x[int(T0 * sr):int(T1 * sr)]
    w = int(0.4 * sr); k = len(music) // w
    r = 10 * np.log10(np.mean(music[:k * w].reshape(k, w) ** 2, axis=1) + 1e-20); act = r > r.max() - 40
    active = 10 * np.log10(np.mean(10 ** (r[act] / 10)))
    hp = ss.sosfilt(ss.butter(6, 7000, 'high', fs=sr, output='sos'), music)
    w2 = int(0.05 * sr); k2 = len(hp) // w2
    lv = 20 * np.log10(np.sqrt((hp[:k2 * w2].reshape(k2, w2) ** 2).mean(axis=1)) + 1e-12)
    print(f"{f.split('/')[-1]:32s} active {active:6.1f} dBFS, 7-20 kHz floor {np.percentile(lv, 10):6.1f} dBFS -> {active - np.percentile(lv, 10):5.1f} dB under the music")
