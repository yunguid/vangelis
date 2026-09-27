"""Render against record, for the closed loop:

- tone: the long-term spectrum in third-octave bands (25 Hz-16 kHz) over --span, both
  channels' mean; `tone` in the output is the record minus the render per band (dB), smoothed
  over three bands and clipped to +-12, which build_samples.py --tone adds to the samples;
- loudness per note: each note's rise in its first four partials (bins within 30 cents of
  n f0 at the record's pitch; power 20-100 ms after the onset minus the 40 ms before), in the
  record and in the render; `notes` is record minus render in dB, for notes whose rise stands
  at least 6 dB over what was already sounding there in both, clipped to +-6 (make_midi.py
  --loudness);
- the loudness contour's correlation (100 ms RMS, dB) and the overall level difference.

usage: calibrate.py record.wav render.wav score.json out.json --cents -32.1 [--span t0,t1]
       (score.json: the notes the render played, as run_bytedance.py writes them, after
       the same --drop/--add; notes are keyed "onset:pitch")
"""
import json, sys
import numpy as np, soundfile as sf, scipy.signal as ss

def option(name, default=None):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default

def third_octaves():
    return 1000 * 2 ** (np.arange(-16, 13) / 3)          # 25 Hz ... 16 kHz

def spectrum(x, sr, t0, t1):
    seg = x[int(t0 * sr): int(t1 * sr)].mean(1)
    f, P = ss.welch(seg, sr, nperseg=8192)
    out = []
    for fc in third_octaves():
        m = (f >= fc * 2 ** (-1 / 6)) & (f < fc * 2 ** (1 / 6))
        out.append(10 * np.log10(P[m].mean() + 1e-30))
    return np.array(out)

def note_levels(x, sr, notes, cents, hop=256, n=4096):
    y = x.mean(1)
    f, t, Z = ss.stft(y, sr, nperseg=n, noverlap=n - hop, boundary=None, padded=False)
    P = np.abs(Z) ** 2; t = t  # frame centres
    out = []
    for nt in notes:
        f0 = 440 * 2 ** ((nt['pitch'] - 69 + cents / 100) / 12)
        rows = np.zeros(len(f), bool)
        for k in range(1, 5):
            rows |= (f > k * f0 * 2 ** (-30 / 1200)) & (f < k * f0 * 2 ** (30 / 1200))
        if not rows.any():
            k = int(round(f0 / (sr / n))); rows[k] = True
        pre = (t >= nt['on'] - 0.04) & (t < nt['on'])
        post = (t >= nt['on'] + 0.02) & (t < nt['on'] + 0.10)
        if not pre.any() or not post.any(): out.append((np.nan, np.nan)); continue
        a = P[rows][:, pre].sum(0).mean(); b = P[rows][:, post].sum(0).max()
        out.append((10 * np.log10(max(b - a, 1e-20)), 10 * np.log10(b / max(a, 1e-20))))
    return np.array(out)

def contour(x, sr, t0, t1):
    w = int(0.1 * sr); y = x[int(t0 * sr): int(t1 * sr)]
    return np.array([10 * np.log10(np.mean(y[i:i + w] ** 2) + 1e-12) for i in range(0, len(y) - w, w)])

def main():
    rec_p, ren_p, score_p, out_p = sys.argv[1:5]
    cents = float(option('--cents'))
    rec, sr = sf.read(rec_p, always_2d=True); ren, sr2 = sf.read(ren_p, always_2d=True)
    assert sr == sr2
    t0, t1 = [float(v) for v in option('--span', f'0,{min(len(rec), len(ren)) / sr}').split(',')]
    sr_, se_ = spectrum(rec, sr, t0, t1), spectrum(ren, sr, t0, t1)
    diff = sr_ - se_
    level = 10 * np.log10(np.mean(rec[int(t0 * sr):int(t1 * sr)] ** 2) / np.mean(ren[int(t0 * sr):int(t1 * sr)] ** 2))
    shape = diff - level
    smooth = np.convolve(np.pad(shape, 1, mode='edge'), np.ones(3) / 3, 'valid')
    notes = [n for n in json.load(open(score_p))['notes'] if t0 <= n['on'] < t1]
    lr, le = note_levels(rec, sr, notes, cents), note_levels(ren, sr, notes, cents)
    ok = (lr[:, 1] > 6) & (le[:, 1] > 6) & np.isfinite(lr[:, 0]) & np.isfinite(le[:, 0])
    d = lr[:, 0] - le[:, 0]
    med = np.median(d[ok])
    corr = {f"{n['on']:.3f}:{n['pitch']}": float(np.clip(v - med, -6, 6)) for n, v, k in zip(notes, d, ok) if k}
    cr, ce = contour(rec, sr, t0, t1), contour(ren, sr, t0, t1)
    L = min(len(cr), len(ce)); m = (cr[:L] > -70)
    r = np.corrcoef(cr[:L][m], ce[:L][m])[0, 1]
    json.dump({'span': [t0, t1], 'level_db': float(level), 'note_median_db': float(med),
               'tone': {f'{fc:.1f}': float(np.clip(v, -12, 12)) for fc, v in zip(third_octaves(), smooth)},
               'notes': corr}, open(out_p, 'w'), indent=0)
    print(f'span {t0:.1f}-{t1:.1f} s: level record-render {level:+.2f} dB; contour r {r:.3f}')
    print('tone (record - render, level removed), third octaves:')
    print('  ' + ' '.join(f'{fc:.0f}:{v:+.1f}' for fc, v in zip(third_octaves(), shape)))
    print(f'  mean |error| 63 Hz-8 kHz: {np.mean(np.abs(shape[4:24])):.2f} dB')
    dd = d[ok] - med
    print(f'notes: {ok.sum()} of {len(notes)} measurable; record - render (median removed {med:+.1f}): '
          f'IQR {np.percentile(dd, 25):+.1f}..{np.percentile(dd, 75):+.1f}, 5-95% {np.percentile(dd, 5):+.1f}..{np.percentile(dd, 95):+.1f} dB')

if __name__ == '__main__':
    main()
