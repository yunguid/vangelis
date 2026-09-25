"""The pad as the record has it: which notes hold, how loud, and what one of them looks like.

The record's constant-Q magnitude (3 bins/semitone, C2 up to C8, 50 ms frames) is explained
as sum over pitches p of A[p, t] * T[b - 3p] + floor[b]: every pad note shares one harmonic
template T (learned), each pitch has a slow activation A (learned). The CS-80's notes are
already transcribed, so every bin within half a semitone of one of their harmonics is left
out of the fit while that note sounds. KL divergence, multiplicative updates, activations
smoothed in time (pads swell over seconds).

usage: pad_nmf.py record.wav expr.json out.npz [--iters 150]
out.npz: A (pitches x frames), T (template), floor, t, pitches (MIDI), mask fraction
"""
import argparse, json
import numpy as np
import soundfile as sf
import librosa
from scipy.ndimage import uniform_filter1d

ap = argparse.ArgumentParser(); ap.add_argument('audio'); ap.add_argument('expr'); ap.add_argument('out')
ap.add_argument('--iters', type=int, default=150); ap.add_argument('--tuning', type=float, default=11.6)
ap.add_argument('--start', type=float, default=0); ap.add_argument('--end', type=float, default=None)
ap.add_argument('--sparsity', type=float, default=0.3, help='L1 cost on activations, x mean magnitude')
a = ap.parse_args()
x, sr = sf.read(a.audio, dtype='float32'); x = x.mean(axis=1)
if a.end: x = x[:int(a.end * sr)]
x = x[int(a.start * sr):]
BPS = 3; LO = 36; HI = 108  # C2 .. C8
fmin = librosa.midi_to_hz(LO) * 2 ** (a.tuning / 1200)
hop = int(0.05 * sr)
V = np.abs(librosa.cqt(x, sr=sr, hop_length=hop, fmin=fmin, n_bins=(HI - LO) * BPS, bins_per_octave=12 * BPS, filter_scale=1.0)).astype(np.float64)
B, F = V.shape
t = a.start + np.arange(F) * hop / sr
bin_midi = LO + np.arange(B) / BPS

# mask: bins near the CS-80's harmonics while each note sounds (onset-0.1 .. offset+0.6 for its tail)
M = np.ones_like(V)
for n in json.load(open(a.expr)):
    if n.get('part') != 'cs80' or not n.get('track'): continue
    tr = n['track']; c = np.array(tr['cents']); tt = tr['t0'] + np.arange(len(c)) * 0.005
    fr0 = max(0, int((tt[0] - 0.1 - a.start) / (hop / sr))); fr1 = min(F, int((tt[-1] + 0.6 - a.start) / (hop / sr)) + 1)
    pitch = n['midi'] + np.median(c) / 100
    for h in range(1, 40):
        m = pitch + 12 * np.log2(h)
        if m > HI: break
        lo_b = int(np.floor((m - 0.5 - LO) * BPS)); hi_b = int(np.ceil((m + 0.5 - LO) * BPS)) + 1
        M[max(0, lo_b):max(0, min(B, hi_b)), fr0:fr1] = 0
print('masked fraction', round(1 - M.mean(), 3))

P = HI - LO  # candidate pitches C2 .. B7
J = B  # template length in bins
# the template may only hold energy at harmonic positions (+-1 bin): a note is a harmonic tone
HARM = np.zeros(J, bool)
T = np.zeros(J)
for h in range(1, 40):
    j = int(round(12 * np.log2(h) * BPS))
    if j >= J: break
    HARM[max(0, j - 1):j + 2] = True
    T[j] = 1.0 / h
T[HARM & (T == 0)] = 1e-3
rng = np.random.default_rng(0)
A = rng.random((P, F)) * V.mean() + 1e-6
floor = np.percentile(V, 10, axis=1) + 1e-12

def recon(A, T):
    R = np.zeros((B, F))
    for p in range(P):
        s = p * BPS
        R[s:] += np.outer(T[:B - s], A[p])
    return R + floor[:, None]

eps = 1e-12
lam = a.sparsity * V.mean()
for it in range(a.iters):
    R = recon(A, T)
    Q = M * V / (R + eps)
    # activations
    num = np.zeros((P, F)); den = np.zeros((P, F))
    for p in range(P):
        s = p * BPS
        num[p] = T[:B - s] @ Q[s:]
        den[p] = T[:B - s] @ M[s:]
    A *= num / (den + lam + eps)
    A = uniform_filter1d(A, size=5, axis=1)  # 250 ms: pads move slowly
    if it % 3 == 2:
        R = recon(A, T); Q = M * V / (R + eps)
        numT = np.zeros(J); denT = np.zeros(J)
        for p in range(P):
            s = p * BPS
            numT[:B - s] += Q[s:] @ A[p]
            denT[:B - s] += M[s:] @ A[p]
        T *= numT / (denT + eps)
        T[~HARM] = 0
        T[0] = max(T[0], 1e-9)
        norm = T.max(); T /= norm; A *= norm
    if it % 25 == 0 or it == a.iters - 1:
        R = recon(A, T)
        kl = np.sum(M * (V * np.log((V + eps) / (R + eps)) - V + R)) + lam * A.sum()
        print(f'iter {it}: KL {kl:.4g}')
np.savez_compressed(a.out, A=A.astype(np.float32), T=T, floor=floor, t=t, pitches=np.arange(LO, HI), mask=1 - M.mean())
def harm_db(h):
    j = int(round(12 * np.log2(h) * BPS)); return round(20 * np.log10(T[max(0, j - 1):j + 2].max() / T.max() + 1e-12), 1)
print('template (dB re peak, magnitude) at harmonics 1..16:', [harm_db(h) for h in range(1, 17)])
