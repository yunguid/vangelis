"""Score room settings: renders of one span (render_performance.mjs --from/--to --params)
against the same span of the record, by what the room changes: the ring's brightness against
the attack (attack_ring.py's measures, per octave from 1 to 8 kHz), how full the quiet
moments are (each octave's quietest 10% of 50 ms windows against its loudest 10%), and the
long-term spectrum (third octaves, 63 Hz-8 kHz, mean absolute error with the level removed).

usage: room_score.py record.wav notes.json t0 render_a.wav [render_b.wav ...]
"""
import json, sys
import numpy as np, soundfile as sf, scipy.signal as ss
from attack_ring import BANDS, band_power
from calibrate import spectrum

def spread(x, sr):
    out = []
    for lo in BANDS[:8]:
        sos = ss.butter(4, [lo / np.sqrt(2), lo * np.sqrt(2)], 'bp', fs=sr, output='sos')
        y = ss.sosfilt(sos, x) ** 2; w = int(0.05 * sr)
        e = 10 * np.log10(y[: len(y) // w * w].reshape(-1, w).mean(1) + 1e-20)
        out.append(np.percentile(e, 10) - np.percentile(e, 90))
    return np.array(out)

def ring_vs_attack(x, sr, clear):
    att, ring = [], []
    for t in clear:
        pre = band_power(x, sr, t - 0.05, t)
        att.append(np.maximum(band_power(x, sr, t, t + 0.03) - pre, 1e-20))
        ring.append(np.maximum(band_power(x, sr, t + 0.15, t + 0.4) - pre, 1e-20))
    return 10 * np.log10(np.median(ring, 0)) - 10 * np.log10(np.median(att, 0))

rec, sr = sf.read(sys.argv[1]); notes = json.load(open(sys.argv[2]))['notes']; t0 = float(sys.argv[3])
renders = sys.argv[4:]
n = sf.info(renders[0]).frames
rec = rec[int(t0 * sr): int(t0 * sr) + n]
ons = sorted(nt['on'] - t0 for nt in notes if 0.1 < nt['on'] - t0 < n / sr - 0.5)
clear = [t for i, t in enumerate(ons) if (i == 0 or t - ons[i - 1] > 0.3) and (i == len(ons) - 1 or ons[i + 1] - t > 0.45)]
R = ring_vs_attack(rec.mean(1), sr, clear); Sp = spread(rec.mean(1), sr); T = spectrum(rec, sr, 0, n / sr)
print(f'{len(clear)} clear onsets. Per octave 1-8 kHz: ring minus attack (render - record); quiet-moment fill 250 Hz-8 kHz (render - record); tone error')
for p in renders:
    x, _ = sf.read(p)
    r = ring_vs_attack(x.mean(1), sr, clear) - R; s = spread(x.mean(1), sr) - Sp
    t = spectrum(x, sr, 0, n / sr) - T; t = t - np.mean(t[4:24])
    print(f'  {p.split("/")[-1]:12s} ring {" ".join(f"{v:+5.1f}" for v in r[4:8])} | fill {" ".join(f"{v:+5.1f}" for v in s[2:8])} (mean |{np.mean(np.abs(s[2:8])):.1f}|) | tone {np.mean(np.abs(t[4:24])):.2f}')
