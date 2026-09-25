"""Each played note's pitch, loudness and harmonic make-up as the record has them, every 5 ms.

The CS-80 lead's harmonics run clean to 16 kHz (to the 25th-30th), so pitch is read where
it is most precise: every harmonic below 16 kHz is found within 40 cents of where the last
frame left it (43 ms Hann, zero-padded x8, quadratic peak), each gives f0 = f/h, and the
frame's pitch is their median weighted by magnitude times h (a cent is h times wider up
there). Tracking runs forwards from the note's loudest early frame through its body and
backwards through the scoop that leads into it, and ends where the note falls 35 dB under
its peak. Loudness is the energy of its harmonics; `harm` is each harmonic's level (dB re
the note's peak total) averaged over the steady part, with the floor between harmonics
taken off.

usage: lead_expression.py record.wav notes.json out.json [--part cs80] [--tuning 11.6]
"""
import argparse, json
import numpy as np
import soundfile as sf

ap = argparse.ArgumentParser(); ap.add_argument('audio'); ap.add_argument('notes'); ap.add_argument('out')
ap.add_argument('--part', default='cs80'); ap.add_argument('--tuning', type=float, default=11.6)
ap.add_argument('--fmax', type=float, default=16000)
a = ap.parse_args()
info = sf.info(a.audio); sr = info.samplerate
N = 2048; PAD = 8; HOP = int(0.005 * sr); nfft = N * PAD
win = np.hanning(N); fbin = sr / nfft

def stft(x):
    frames = 1 + (len(x) - N) // HOP
    idx = np.arange(N)[None, :] + HOP * np.arange(frames)[:, None]
    return np.abs(np.fft.rfft(x[idx] * win, nfft, axis=1)).astype(np.float32)

def peaks(X, freqs, cents):
    """Vectorised: for each target frequency, the interpolated peak within +-cents (nan if none)."""
    out_f = np.full(len(freqs), np.nan); out_m = np.zeros(len(freqs))
    for j, f in enumerate(freqs):
        lo = max(1, int(f * 2 ** (-cents / 1200) / fbin)); hi = min(len(X) - 2, int(np.ceil(f * 2 ** (cents / 1200) / fbin)) + 1)
        if hi - lo < 2: continue
        k = lo + int(np.argmax(X[lo:hi]))
        if k <= lo or k >= hi - 1: continue
        y0, y1, y2 = np.log(X[k - 1] + 1e-12), np.log(X[k] + 1e-12), np.log(X[k + 1] + 1e-12)
        if not (y1 >= y0 and y1 >= y2): continue
        d = 0.5 * (y0 - y2) / (y0 - 2 * y1 + y2 - 1e-12)
        out_f[j] = (k + d) * fbin; out_m[j] = np.exp(y1 - 0.25 * (y0 - y2) * d)
    return out_f, out_m

notes = json.load(open(a.notes))
out = []
for n in notes:
    if n.get('part') != a.part:
        out.append(n); continue
    et = 440 * 2 ** ((n['midi'] - 69) / 12)
    nominal = et * 2 ** (a.tuning / 1200)
    t0 = max(0.0, n['start'] - 0.7); t1 = min(info.frames / sr, n['end'] + 0.15)
    s0 = max(0, int(t0 * sr) - N // 2)
    x, _ = sf.read(a.audio, start=s0, stop=int(t1 * sr) + N // 2, dtype='float32')
    if x.ndim > 1: x = x.mean(axis=1)
    if len(x) < N + HOP * 4:
        out.append(n); continue
    X = stft(x)
    ft = (s0 + N / 2 + np.arange(len(X)) * HOP) / sr
    H = max(1, int(min(a.fmax, 0.45 * sr) // nominal))
    hs = np.arange(1, H + 1)
    def measure(i, f):
        pf, pm = peaks(X[i], hs * f, 25)
        ok = ~np.isnan(pf)
        if ok.sum() < max(2, H // 4): return None, 0.0, None
        # a harmonic counts for pitch if it stands 12 dB clear of the floor between harmonics,
        # and counts h times: its cents are h times finer than the fundamental's
        mids = ((hs + 0.5) * f / fbin).astype(int); mids = mids[mids < X.shape[1] - 1]
        floor = np.median(X[i][mids]) if len(mids) else 0.0
        clear = ok & (pm > 4 * floor)
        if clear.sum() < 2: clear = ok
        est = 1200 * np.log2(pf[clear] / hs[clear] / f); w = hs[clear].astype(float)
        o = np.argsort(est); c = np.cumsum(w[o])
        fi = f * 2 ** (est[o][np.searchsorted(c, c[-1] / 2)] / 1200)
        return float(fi), float(np.sum(pm[ok] ** 2)), (pm, ok)
    body = np.where((ft >= n['start']) & (ft <= n['start'] + max(0.15, 0.5 * (n['end'] - n['start']))))[0]
    if len(body) == 0:
        out.append(n); continue
    es = [measure(i, nominal)[1] for i in body]
    anchor = int(body[int(np.argmax(es))]); peak_e = max(es) + 1e-20
    track = {}
    for direction in (1, -1):
        f = nominal; i = anchor
        while 0 <= i < len(X):
            fi, e, parts = measure(i, f)
            if fi is None or e < peak_e * 10 ** (-3.5) or abs(1200 * np.log2(fi / nominal)) > 700:
                break
            track[i] = (fi, e, parts); f = fi; i += direction
    idx = sorted(track)
    if len(idx) < 6:
        out.append(n); continue
    cents = [round(1200 * np.log2(track[i][0] / et), 1) for i in idx]
    db = [round(10 * np.log10(track[i][1] / peak_e), 1) for i in idx]
    # harmonic make-up over the steady part (from 0.3 s in, while within 6 dB of the peak)
    steady = [i for i in idx if ft[i] >= ft[idx[0]] + 0.3 and track[i][1] > peak_e * 10 ** -0.6]
    harm = None
    if steady:
        acc = np.zeros(H); cnt = np.zeros(H)
        for i in steady:
            pm, ok = track[i][2]
            f0 = track[i][0]
            # floor: median magnitude halfway between harmonics
            mids = ((hs + 0.5) * f0 / fbin).astype(int); mids = mids[mids < X.shape[1]]
            floor = np.median(X[i][mids]) if len(mids) else 0
            v = np.where(ok, np.maximum(pm ** 2 - floor ** 2, 1e-20), np.nan)
            acc += np.nan_to_num(v); cnt += ok
        harm = [round(10 * np.log10(acc[h] / max(cnt[h], 1) / peak_e + 1e-20), 1) if cnt[h] >= len(steady) / 2 else None for h in range(H)]
    m = dict(n)
    m.update(onset=round(float(ft[idx[0]]), 3), offset=round(float(ft[idx[-1]]), 3), peak_db=round(10 * np.log10(peak_e), 1),
             track=dict(t0=round(float(ft[idx[0]]), 3), cents=cents, db=db), harm=harm)
    out.append(m)
json.dump(out, open(a.out, 'w'))
tr = [m for m in out if m.get('track')]
print(f'{len(tr)} of {sum(1 for m in notes if m.get("part") == a.part)} {a.part} notes tracked')
