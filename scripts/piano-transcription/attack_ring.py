"""The attack apart from the ring, and the floor under both. Around every onset where a note
starts clear of others (none within 0.3 s), the spectrum's rise in the first 30 ms (power
0-30 ms after the onset minus the 50 ms before) and in the ring (150-400 ms after, minus
the same), per octave band, in the record and in a render; then each band's quietest 10% of
50 ms windows (the floor). Printed as record minus render, dB, with the overall level removed.

usage: attack_ring.py record.wav render.wav notes.json [--span t0,t1]
"""
import json, sys
import numpy as np, soundfile as sf, scipy.signal as ss

BANDS = [63, 125, 250, 500, 1000, 2000, 4000, 8000, 12000]

def option(name, default=None):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default

def band_power(x, sr, t0, t1):
    seg = x[max(0, int(t0 * sr)): int(t1 * sr)]
    S = np.abs(np.fft.rfft(seg * np.hanning(len(seg)), 1 << 14)) ** 2
    f = np.fft.rfftfreq(1 << 14, 1 / sr)
    return np.array([S[(f >= b / np.sqrt(2)) & (f < b * np.sqrt(2))].sum() for b in BANDS]) / len(seg)

def main():
    rec, sr = sf.read(sys.argv[1]); ren, _ = sf.read(sys.argv[2])
    rec, ren = rec.mean(1), ren.mean(1)
    t0, t1 = [float(v) for v in option('--span', '0,1e9').split(',')]
    ons = sorted(n['on'] for n in json.load(open(sys.argv[3]))['notes'] if t0 <= n['on'] < t1)
    clear = [t for i, t in enumerate(ons) if (i == 0 or t - ons[i - 1] > 0.3) and (i == len(ons) - 1 or ons[i + 1] - t > 0.45)]
    res = {}
    for name, x in [('record', rec), ('render', ren)]:
        att, ring = [], []
        for t in clear:
            pre = band_power(x, sr, t - 0.05, t)
            att.append(np.maximum(band_power(x, sr, t, t + 0.03) - pre, 1e-20))
            ring.append(np.maximum(band_power(x, sr, t + 0.15, t + 0.4) - pre, 1e-20))
        res[name] = (10 * np.log10(np.median(att, 0)), 10 * np.log10(np.median(ring, 0)))
        w = int(0.05 * sr); a, b = int(t0 * sr), int(min(t1, len(x) / sr) * sr)
        fl = []
        for lo in BANDS:
            sos = ss.butter(4, [lo / np.sqrt(2), min(lo * np.sqrt(2), sr * 0.45)], 'bp', fs=sr, output='sos')
            y = ss.sosfilt(sos, x[a:b]) ** 2
            e = y[: len(y) // w * w].reshape(-1, w).mean(1)
            fl.append(10 * np.log10(np.percentile(e, 10) + 1e-20))
        res[name] += (np.array(fl),)
    print(f'{len(clear)} clear onsets; record - render per octave, dB (overall offset removed at 1 kHz):')
    print('  band    ' + ' '.join(f'{b:>7d}' for b in BANDS))
    for i, what in enumerate(['attack', 'ring', 'floor']):
        d = res['record'][i] - res['render'][i]
        print(f'  {what:7s} ' + ' '.join(f'{v - d[4]:+7.1f}' for v in d) + f'   (1 kHz: {d[4]:+.1f})')

if __name__ == '__main__':
    main()
