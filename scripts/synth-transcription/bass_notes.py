"""The bass line under the record (its "booms"): the low notes (27-131 Hz) that start abruptly and sit in the middle
of the stereo picture, as notes with their own loudness curves for make_midi.py --bass.

Where one may start: on the mid channel (decimated to 2 kHz), a 0.25 s spectrum every 10 ms on a 60-per-octave grid;
a new low note shows as a narrowband rise, at its f0 (27-170 Hz) or its octave: the level 0.12 s on over the loudest
level 0.15-0.35 s before. Where the mean of the eight largest rises peaks at 16 dB or more (peaks 0.25 s apart), a
note may start.
Which notes: the onset moves to the broadband spectral-flux peak (64 ms spectra, 5 ms hop) in the 0.3 s before the
rise, and the spectrum after it, less the background (the louder of the spectrum just before and the median of six
windows within +-6.5 s), is searched for the best harmonic combs (h1..h4 weighted 1, .8, .4, .2), up to two per
onset. A note is kept when its h1 or h2 stands 12 dB over the background and its band (0.85-1.18 f0) correlates
>= 0.7 between left and right: the bass is centred, the pad and the room are wide. A note found twice (within 0.35 s
and a semitone) counts once.
Which key: each note's key is decided again among m-1, m, m+1: the one whose h1 and h2 (weighted 1, .8) gain most
over the level before the onset (Hann-weighted projection onto the exact frequency, over the note's first 1.2 s);
PITCH_FIX then corrects the votes known to be wrong.
How loud: notes that now share onset and key are merged, and each note's h1 amplitude is read every 10 ms by complex
demodulation (6 Hz low-pass) at its key until it falls to the background (+3 dB) or 30 dB under its peak, or the next
bass note starts. Velocity is the peak level re TOP_DB; the gain curve (100 Hz) holds at 1 up to the peak and then
follows the measured envelope re the peak. Times are kept to 1 ms and levels to 0.1 dB between the steps.

usage: bass_notes.py record.wav bass.json
"""
import json, sys
import numpy as np
import soundfile as sf
from scipy.ndimage import maximum_filter1d, median_filter
from scipy.signal import butter, decimate, find_peaks, sosfiltfilt, stft

FS = 2000
TUNE = 11.6     # cents: the record runs sharp of A440
TOP_DB = -17.8  # the h1 peak (dB, as read here) that plays at velocity 1 with the bass layer's gain at 1
                # (calibrated on a render of the first bass line: +0.2 dB)
# Votes known to be wrong: (onset s, voted key) -> key.
# 430.51 s re-strikes a held A1, not G1: over 430.4-432 s the record reads A1 at -26.2 dB and G1 at -57.9 dB (the
# vote's projection). A held key gains little over its own level before the onset, which is what the vote measures.
PITCH_FIX = {(430.51, 31): 33}

x, sr = sf.read(sys.argv[1], dtype='float64')
assert sr == 48000, sr
L, R = (decimate(decimate(decimate(x[:, c], 4, ftype='fir'), 3, ftype='fir'), 2, ftype='fir') for c in (0, 1))
M = (L + R) / 2
hz_of = lambda m: 440 * 2 ** ((m - 69) / 12 + TUNE / 1200)
snap = lambda hz: int(round(69 + 12 * np.log2(hz / 440) - TUNE / 100))

# where a low note may start: r(t) = D(t + 0.12 s) - max D over [t - 0.35, t - 0.15] s, D the level on a 60/octave grid
_, t, Z = stft(M, fs=FS, nperseg=500, noverlap=480, nfft=16000, boundary=None)
t = t + 0.125
BPO = 60; fl = 25 * 2 ** (np.arange(0, int(BPO * np.log2(400 / 25)) + 1) / BPO)
P = np.abs(Z) ** 2; idx = fl / (FS / 16000); i0 = np.floor(idx).astype(int); fr = idx - i0
D = 10 * np.log10(P[i0] * (1 - fr)[:, None] + P[i0 + 1] * fr[:, None] + 1e-20)
a, b, c = 12, 35, 15  # 10 ms frames
past = maximum_filter1d(D, size=b - c + 1, axis=1, origin=(b - c) // 2)
r = np.zeros_like(D); r[:, b:-a] = D[:, b + a:] - past[:, b - c:-a - c]; r = np.maximum(r, 0)
lo, hi = np.searchsorted(fl, 27), np.searchsorted(fl, 170)
H = r[lo:hi]; H2 = np.zeros_like(H); n2 = min(hi + BPO, len(fl)) - (lo + BPO); H2[:n2] = r[lo + BPO:lo + BPO + n2]
top = np.sort(np.maximum(H, H2 - 3), axis=0)[-8:].mean(0)  # a note shows its rise at f0 or at its octave
pk, _ = find_peaks(top, height=10, distance=25)
cands = [(round(float(t[p]), 2), round(float(top[p]), 1)) for p in pk]
cands = [(tc, rise) for tc, rise in cands if rise >= 16]

# which notes: harmonic combs on what the onset adds, kept when centred
f_, t_, Z = stft(M, fs=FS, nperseg=128, noverlap=118, nfft=512)
D = 20 * np.log10(np.abs(Z[(f_ >= 25) & (f_ <= 400)]) + 1e-9)
flux = np.zeros(D.shape[1]); flux[4:] = np.maximum(0, D[:, 4:] - D[:, :-4]).mean(0); fex = flux - median_filter(flux, size=401)
NF = 32000; freqs = np.fft.rfftfreq(NF, 1 / FS)
CS = 27.0 * 2 ** (np.arange(0, 1200 * np.log2(132 / 27), 5) / 1200)  # comb f0s, 5 cents apart


def spec(a, b):
    # The background windows of the first and last candidates run off the record: an empty window reads NaN, a window
    # wholly before the start wraps to the end. Neither candidate passes the stereo test, but the notes found depend
    # on these readings (keeping only the part inside the record adds one at 532 s), so they stay as they are.
    seg = M[int(a * FS):int(b * FS)]; w = np.hanning(len(seg))
    with np.errstate(divide='ignore', invalid='ignore'):
        return 20 * np.log10(np.abs(np.fft.rfft(seg * w, NF)) / w.sum() * 2 + 1e-12)


def band(f, tol):
    return np.searchsorted(freqs, f * 2 ** (-tol / 1200)), np.searchsorted(freqs, f * 2 ** (tol / 1200)) + 1


def combs(t0, t1):
    """up to two harmonic combs on the excess of [t0, t1] over the background: (f0, score, h1 and h2 excess dB)"""
    dur = t1 - t0; post = spec(t0, t1); pre = spec(t0 - 0.14 - dur, t0 - 0.14)
    others = [spec(t0 + d, t0 + d + dur) for d in (-6.5, -5, -3.5, 3.5, 5, 6.5)]
    ex = np.clip(post - np.maximum(pre, np.median(others, axis=0)), 0, 30)
    tol = max(15.0, 1200 * np.log2(1 + 0.7 / dur / 40))
    val = lambda f: ex[slice(*band(f, tol))].max()
    found = []
    for _ in range(2):
        sc = np.array([val(f) + 0.8 * val(2 * f) + 0.4 * val(3 * f) + 0.2 * val(4 * f) for f in CS])
        i = int(np.argmax(sc)); f = CS[i]
        j = np.searchsorted(CS, f / 2)  # the comb an octave down, if it scores nearly as well
        if j < len(CS) and abs(CS[j] - f / 2) < 0.02 * f and sc[j] > 0.75 * sc[i] and val(CS[j]) >= 6: f, i = CS[j], j
        if found and (sc[i] < 0.5 * found[0][1] or val(f) < 15): break
        found.append((f, sc[i], [float(val(k * f)) for k in (1, 2)]))
        for k in (1, 2, 3, 4):  # take this note's harmonics out before looking for another
            ex[slice(*band(k * f, tol * 1.5))] = 0
    return found


notes = []
for k, (tc, rise) in enumerate(cands):
    i0, i1 = np.searchsorted(t_, tc - 0.3), np.searchsorted(t_, tc + 0.05)
    kk = i0 + int(np.argmax(fex[i0:i1]))
    on = float(t_[kk]) - 0.02 if fex[kk] >= 1.0 else tc - 0.06
    nxt = cands[k + 1][0] - 0.08 if k + 1 < len(cands) else on + 1
    t1 = max(on + 0.24, min(nxt, on + 0.84))
    for f, _, ex in combs(on + 0.04, t1):
        if not (27 <= f <= 131) or (ex[0] < 12 and ex[1] < 12): continue
        m = snap(f); fh = hz_of(m)
        sos = butter(2, [0.85 * fh, 1.18 * fh], btype='band', fs=FS, output='sos')
        a, b = int(on * FS), int((on + min(1.0, max(0.25, t1 - on))) * FS)
        yl = sosfiltfilt(sos, L[a - 400:b + 400])[400:-400]; yr = sosfiltfilt(sos, R[a - 400:b + 400])[400:-400]
        if round(float(np.corrcoef(yl, yr)[0, 1]), 2) < 0.7: continue
        n = dict(onset=round(on, 3), midi=m)
        if any(abs(n['onset'] - p['onset']) < 0.35 and abs(n['midi'] - p['midi']) <= 1 for p in notes[-3:]): continue
        notes.append(n)
print(len(cands), 'rises of 16 dB or more;', len(notes), 'centred low notes')


def demod(f, a, b):
    """amplitude of the component at f Hz every 10 ms over [a, b] s"""
    seg = M[int(a * FS):int(b * FS)]; tt = np.arange(len(seg)) / FS
    x = seg * np.exp(-2j * np.pi * f * tt); sos = butter(4, 6, fs=FS, output='sos')
    return 2 * np.abs(sosfiltfilt(sos, x.real) + 1j * sosfiltfilt(sos, x.imag))[::20]


def envelopes(notes):
    """each note's h1 at its key from its onset: peak (first 0.6 s), end, and the envelope (dB) up to the end; a note
    ends where it falls under the background (+3 dB) or 30 dB under its peak, or where the next note in the list starts"""
    for k, n in enumerate(notes):
        a = n['onset'] - 1.0; b = min(n['onset'] + 8, len(M) / FS - 0.1)
        e = demod(hz_of(n['midi']), a, b); tt = a + np.arange(len(e)) * 0.01
        bg = np.median(e[(tt > n['onset'] - 0.9) & (tt < n['onset'] - 0.15)])
        w = (tt >= n['onset']) & (tt < n['onset'] + 0.6); pk = int(np.argmax(np.where(w, e, 0)))
        later = [p['onset'] for p in notes[k + 1:] if p['onset'] > n['onset'] + 0.05]
        nxt = later[0] if later else b
        thr = max(bg * 1.41, e[pk] / 31.6); end = pk
        while end < len(e) - 1 and e[end] > thr and tt[end] < nxt: end += 1
        n['end'] = round(float(min(tt[end], nxt)), 3); n['peak_t'] = round(float(tt[pk]), 3)
        n['peak_db'] = round(float(20 * np.log10(e[pk])), 1)
        i0 = int(round((n['onset'] - a) / 0.01)); i1 = int(round((n['end'] - a) / 0.01)) + 1
        n['env_db'] = [round(float(20 * np.log10(v + 1e-12)), 1) for v in e[i0:i1]]


def amp(f, a, b):
    seg = M[int(a * FS):int(b * FS)]; w = np.hanning(len(seg)); tt = np.arange(len(seg)) / FS
    return np.abs((seg * w) @ np.exp(-2j * np.pi * f * tt)) * 2 / w.sum()


# which key: the neighbour whose h1 and h2 gain most over the level before the onset (the note's end, read at the
# comb's key, bounds the window)
envelopes(notes)
names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
name = lambda m: f'{names[m % 12]}{m // 12 - 1}'
moved = 0; fixed = set()
for n in notes:
    a, b = n['onset'] + 0.05, min(max(n['end'], n['onset'] + 0.3), n['onset'] + 1.2)
    dur = b - a; sc = {}
    for m in (n['midi'] - 1, n['midi'], n['midi'] + 1):
        e = [20 * np.log10(amp(k * hz_of(m), a, b) / (amp(k * hz_of(m), n['onset'] - 0.1 - dur, n['onset'] - 0.1) + 1e-9)) for k in (1, 2)]
        sc[m] = e[0] + 0.8 * e[1]
    best = max(sc, key=sc.get); moved += best != n['midi']; n['midi'] = best
    if (n['onset'], n['midi']) in PITCH_FIX:
        fixed.add((n['onset'], n['midi'])); n['midi'] = PITCH_FIX[n['onset'], n['midi']]
        print(f"{n['onset']:7.2f} s: {name(best)} -> {name(n['midi'])} (PITCH_FIX)")
if fixed != set(PITCH_FIX): sys.exit(f'PITCH_FIX: no such voted note {sorted(set(PITCH_FIX) - fixed)}')
print(moved, 'of', len(notes), 'keys moved by the vote,', len(fixed), 'by PITCH_FIX')

# how loud: merge what now shares onset and key, read every note again at its key
merged = []
for n in sorted(notes, key=lambda n: (n['onset'], n['midi'])):
    if merged and abs(merged[-1]['onset'] - n['onset']) < 0.05 and merged[-1]['midi'] == n['midi']: continue
    merged.append(n)
envelopes(merged)
out = []
for n in merged:
    env = np.array(n['env_db'], float)
    pk = min(max(int(round((n['peak_t'] - n['onset']) / 0.01)), 0), len(env) - 1)
    g = np.ones(len(env)); g[pk:] = 10 ** ((env[pk:] - env[pk]) / 20); g = np.minimum(g, 1)
    dur = max(0.15, n['end'] - n['onset'])
    out.append(dict(time=round(n['onset'], 3), duration=round(dur, 3), midi=n['midi'], cents=TUNE,
                    velocity=round(float(10 ** ((n['peak_db'] - TOP_DB) / 20)), 4),
                    gain=[round(float(v), 4) for v in g[:max(2, int(dur * 100) + 1)]]))
json.dump(dict(rate=100, top_db=TOP_DB, notes=out), open(sys.argv[2], 'w'))
print(len(out), 'bass notes,', sum(hz_of(n['midi']) < 65 for n in out), 'below C2; velocities 10/50/90%',
      np.percentile([n['velocity'] for n in out], [10, 50, 90]).round(3))
