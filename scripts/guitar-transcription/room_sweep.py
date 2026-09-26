"""Choose a piece's room: render a span of it through render_performance.mjs under each
combination of reverb mix, size and decay, and score each render's level-matched log-CQT
against the record's (cosine similarity per frame, averaged). Prints every setting and the best;
the piece's voice in src/data/guitarTranscriptions.js carries the winner.

usage: room_sweep.py <repo root> record.wav <work dir> mixes sizes decays on|off
         --piece performance-pernambuco --span 0.5,45 [--width 0] [--mode plate]
       (comma-separated values; on|off: with or without the tape hiss; the score is taken on
       the mono sum, so the room's width is set apart, by the left/right correlation, and held
       here: Pernambuco's record is mono, so its room has width 0; --mode tries another
       reverb, else the piece's own)
"""
import json, subprocess, sys, itertools, numpy as np, soundfile as sf, librosa
WT, RECORD, WORK = sys.argv[1], sys.argv[2], sys.argv[3]
option = lambda name, default=None: sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default
PIECE = option('--piece')
SR = 44100; T0, T1 = (float(v) for v in option('--span').split(','))
WIDTH = float(option('--width', '0'))
MODE = {'reverbMode': option('--mode')} if option('--mode') else {}
def cqt_log(path):
    x, sr = sf.read(path, dtype='float32'); x = x.mean(axis=1) if x.ndim > 1 else x
    x = librosa.resample(x, orig_sr=sr, target_sr=SR)[int(T0 * SR):int(T1 * SR)]
    C = np.abs(librosa.cqt(x, sr=SR, hop_length=448, fmin=librosa.note_to_hz('C2'), n_bins=252, bins_per_octave=36, filter_scale=0.5))
    return C, x
Cr, xr = cqt_log(RECORD)
def score(Cb, xb):
    k = min(Cr.shape[1], Cb.shape[1]); A, B = Cr[:, :k], Cb[:, :k]
    g = np.sqrt(np.mean(xr ** 2) / np.mean(xb ** 2)); B = B * g   # level-matched
    ref = A.max()
    la, lb = np.log1p(A / ref * 1000), np.log1p(B / ref * 1000)
    cos = np.mean(np.sum(la * lb, axis=0) / (np.linalg.norm(la, axis=0) * np.linalg.norm(lb, axis=0) + 1e-9))
    # the spread of frame loudness: a wetter room fills the gaps between strokes
    fa = 20 * np.log10(A.sum(axis=0) + 1e-9); fb = 20 * np.log10(B.sum(axis=0) + 1e-9)
    gap = np.percentile(fa, 10) - np.percentile(fa, 90), np.percentile(fb, 10) - np.percentile(fb, 90)
    return cos, gap
rows = []
settings = [dict(reverbMix=m, reverbSize=sz, reverbDecay=d, reverbWidth=WIDTH, **MODE) for m, sz, d in itertools.product(tuple(float(v) for v in sys.argv[4].split(',')), tuple(float(v) for v in sys.argv[5].split(',')), tuple(float(v) for v in sys.argv[6].split(',')))]
seen = set()
for p in settings:
    if p['reverbMix'] == 0.0:
        p = dict(reverbEnabled=False, reverbMix=0.0, reverbWidth=WIDTH)
    key = json.dumps(p, sort_keys=True)
    if key in seen: continue
    seen.add(key)
    out = f'{WORK}/room.wav'
    subprocess.run(['node', 'scripts/render_performance.mjs', '--piece', PIECE, '--out', out, '--to', str(T1 + 1), *(['--ambience', 'off'] if sys.argv[7] == 'off' else []), '--params', json.dumps(p)], cwd=WT, check=True, capture_output=True)
    Cb, xb = cqt_log(out)
    cos, gap = score(Cb, xb)
    rows.append((cos, p, gap))
    print(f"{cos:.4f}  10-90% frame spread record {gap[0]:6.1f} dB render {gap[1]:6.1f} dB   {p}", flush=True)
best = max(rows, key=lambda r: r[0])
print('best:', best[1], round(best[0], 4))
