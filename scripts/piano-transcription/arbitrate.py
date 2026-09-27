"""Keep or drop the notes two transcriptions disagree on, by synthesis. Notes both have (the
same pitch within 50 ms) are kept. Each disputed note is synthesized dry from the recording
the page would play it with (its built sample, at its velocity, for as long as the pedal holds
it) and the local picture is compared: the power spectrogram (4096-point STFT) of the record
against the current render with and without the note, over the bins within 40 cents of the
note's first six partials, from its onset to 0.4 s after, as the mean absolute difference of
log power (dB, floored 60 dB under the region's peak). The note stays if it brings the render
closer. The dry synthesis is scaled onto the render by the median ratio over agreed notes.

usage: arbitrate.py record.wav render.wav a.json b.json samples_dir out.json --cents -32.1
       (a.json: the notes the render played; b.json: the other transcription. Writes the kept
       notes and a.json's pedal, in run_bytedance.py's format.)
"""
import glob, json, os, subprocess, sys
import numpy as np, soundfile as sf, scipy.signal as ss
from piano_score import POSITIONS, file_name, position_of, sounding, RELEASE
from make_midi import model_gain_db

N, HOP, SR = 4096, 512, 48000

def option(name, default=None):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default

def decode(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32)

def match(A, B, tol=0.05):
    used, pairs = set(), {}
    for i, a in enumerate(A):
        best, bj = tol, None
        for j, b in enumerate(B):
            if j in used or b['pitch'] != a['pitch']: continue
            d = abs(b['on'] - a['on'])
            if d <= best: best, bj = d, j
        if bj is not None: used.add(bj); pairs[i] = bj
    return pairs, used

def main():
    rec_p, ren_p, a_p, b_p, sdir, out_p = sys.argv[1:7]
    cents = float(option('--cents'))
    rec, _ = sf.read(rec_p); ren, _ = sf.read(ren_p); rec, ren = rec.mean(1), ren.mean(1)
    A = json.load(open(a_p)); B = json.load(open(b_p))
    notes_a, notes_b, pedal = A['notes'], B['notes'], A['pedal']
    pairs, used_b = match(notes_a, notes_b)
    samples = {}
    for p in glob.glob(os.path.join(sdir, '*.mp3')):
        k = os.path.basename(p)[:-4]; samples.setdefault(k.split('v')[0], {})[int(k.split('v')[1])] = p
    cache = {}
    def sample_for(pitch, vel):
        pos = position_of(pitch); name = file_name(pos)
        if name not in samples:
            pos = min((q for q in POSITIONS if file_name(q) in samples), key=lambda q: abs(q - pitch)); name = file_name(pos)
        layer = 10 if vel >= 64 and 10 in samples[name] else min(samples[name])
        key = (name, layer)
        if key not in cache: cache[key] = decode(samples[name][layer])
        return cache[key], pos
    f = np.fft.rfftfreq(N, 1 / SR)
    def stft(x, t0, t1):
        a = max(0, int(t0 * SR)); seg = x[a: int(t1 * SR) + N]
        if len(seg) < N: seg = np.pad(seg, (0, N - len(seg)))
        fr = np.lib.stride_tricks.sliding_window_view(seg, N)[::HOP] * np.hanning(N)
        return np.abs(np.fft.rfft(fr, axis=1)) ** 2
    def synth(n, dur):
        data, pos = sample_for(n['pitch'], n['vel'])
        rate = 2 ** ((n['pitch'] - pos) / 12)
        length = int(min(dur + RELEASE, 1.0) * SR)
        idx = np.arange(length) * rate
        idx = idx[idx < len(data) - 1]
        y = np.interp(idx, np.arange(len(data)), data)
        g = 10 ** ((model_gain_db(n['vel']) - 6) / 20)
        return y * g
    def region(n):
        f0 = 440 * 2 ** ((n['pitch'] - 69 + cents / 100) / 12)
        rows = np.zeros(len(f), bool)
        for k in range(1, 7):
            rows |= (f > k * f0 * 2 ** (-40 / 1200)) & (f < k * f0 * 2 ** (40 / 1200))
        if rows.sum() == 0: rows[int(round(f0 * N / SR))] = True
        return rows
    ends_a = sounding(notes_a, pedal)
    # scale the dry synthesis onto the render over agreed, clearly exposed notes
    ratios = []
    for i, n in enumerate(notes_a[::5]):
        rows = region(n); t0 = n['on']
        Pn = stft(np.pad(synth(n, 0.4), (0, N)), 0, 0.4)[:, rows].sum(1)
        Pr = stft(ren, t0, t0 + 0.4)[:, rows].sum(1)
        m = min(len(Pn), len(Pr))
        ratios.append(np.median(Pr[:m] / np.maximum(Pn[:m], 1e-20)))
    scale = float(np.median(ratios))
    def verdict(n, dur, in_render):
        rows = region(n); t0 = n['on']
        Pr = stft(rec, t0, t0 + 0.4)[:, rows]; Pe = stft(ren, t0, t0 + 0.4)[:, rows]
        y = synth(n, dur); Pn = stft(np.pad(y, (0, N + int(0.4 * SR))), 0, 0.4)[:, rows] * scale
        m = min(len(Pr), len(Pe), len(Pn)); Pr, Pe, Pn = Pr[:m], Pe[:m], Pn[:m]
        with_ = Pe if in_render else Pe + Pn
        without = np.maximum(Pe - Pn, Pe * 0.01) if in_render else Pe
        floor = 10 * np.log10(Pr.max() + 1e-20) - 60
        L = lambda P: np.maximum(10 * np.log10(P + 1e-20), floor)
        return np.mean(np.abs(L(with_) - L(Pr))) - np.mean(np.abs(L(without) - L(Pr)))
    kept = [n for i, n in enumerate(notes_a) if i in pairs]
    log = {'agreed': len(kept), 'a_kept': 0, 'a_dropped': 0, 'b_added': 0, 'b_rejected': 0}
    for i, n in enumerate(notes_a):
        if i in pairs: continue
        d = verdict(n, ends_a[i] - n['on'], True)
        if d < 0: kept.append(n); log['a_kept'] += 1
        else: log['a_dropped'] += 1
    for j, n in enumerate(notes_b):
        if j in used_b: continue
        d = verdict(n, n['off'] - n['on'], False)
        if d < 0: kept.append(n); log['b_added'] += 1
        else: log['b_rejected'] += 1
    kept.sort(key=lambda n: (n['on'], n['pitch']))
    json.dump({'source': f'{a_p} + {b_p}, arbitrated against {ren_p}', 'cents': cents, 'notes': kept, 'pedal': pedal}, open(out_p, 'w'))
    print(f'scale {scale:.3g};', log, '->', len(kept), 'notes')

if __name__ == '__main__':
    main()
