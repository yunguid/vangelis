"""Record vs render: level-matched loudness contour, 1/3-octave long-term spectrum, onset timing
agreement, CQT similarity, and side-by-side spectrogram pages.
usage: compare.py original.wav render.wav out_prefix [--pages t0,t1,...] [--unmatched unmatched.json]
(--unmatched writes the record's plucks with no render pluck within 30 ms, for stage4_ghosts.py)"""
import sys, json, numpy as np, soundfile as sf, librosa, scipy.signal as ss, scipy.ndimage as nd, matplotlib
matplotlib.use('Agg'); import matplotlib.pyplot as plt
SR = 44100
def load(p):
    x, sr = sf.read(p, dtype='float32'); x = x.mean(axis=1) if x.ndim > 1 else x
    return librosa.resample(x, orig_sr=sr, target_sr=SR) if sr != SR else x
a = load(sys.argv[1]); b = load(sys.argv[2]); out = sys.argv[3]
n = min(len(a), len(b)); a, b = a[:n], b[:n]
# level match on the music section
act = slice(int(0.5 * SR), int(92 * SR))
g = np.sqrt(np.mean(a[act] ** 2) / np.mean(b[act] ** 2)); b = b * g
print(f'render level offset {20 * np.log10(g):+.1f} dB (applied)')
# 1. loudness contour
hop = int(0.1 * SR)
def rms_db(x): k = len(x) // hop; return 10 * np.log10(np.mean(x[:k * hop].reshape(k, hop) ** 2, axis=1) + 1e-12)
la, lb = rms_db(a), rms_db(b); sel = (la > -50) & (np.arange(len(la)) * 0.1 < 92)
print(f'loudness contour (100 ms): r = {np.corrcoef(la[sel], lb[sel])[0, 1]:.3f}, mean |diff| = {np.mean(np.abs(la[sel] - lb[sel])):.2f} dB')
# 2. third-octave LTAS
f, Pa = ss.welch(a[act], SR, nperseg=8192); _, Pb = ss.welch(b[act], SR, nperseg=8192)
centres = 1000 * 2 ** (np.arange(-17, 13) / 3)
rows = []
for c in centres:
    m = (f >= c / 2 ** (1 / 6)) & (f < c * 2 ** (1 / 6))
    if m.any(): rows.append((c, 10 * np.log10(Pa[m].mean() + 1e-20), 10 * np.log10(Pb[m].mean() + 1e-20)))
print('third-octave LTAS, render - record (dB):')
print('  ' + '  '.join(f'{c:>6.0f}' for c, _, _ in rows))
print('  ' + '  '.join(f'{pb - pa:+6.1f}' for c, pa, pb in rows))
# 3. onsets (same detector for both)
def onsets(x):
    S = np.abs(librosa.stft(x, n_fft=2048, hop_length=128))
    mel = librosa.feature.melspectrogram(S=S ** 2, sr=SR, n_mels=138, fmin=60, fmax=12000); L = np.log1p(100 * mel)
    flux = np.maximum(0, L[:, 2:] - nd.maximum_filter1d(L, 3, axis=0)[:, :-2]).sum(axis=0); flux = np.concatenate([[0, 0], flux])
    med = ss.medfilt(flux, 31)
    pk, _ = ss.find_peaks(flux, height=med + 0.35 * np.median(flux[flux > 0]) + 2.0, distance=int(0.025 * SR / 128))
    return pk * 128 / SR
oa, ob = onsets(a), onsets(b)
used = set(); dts = []
for t in oa:
    j = np.argmin(np.abs(ob - t))
    if abs(ob[j] - t) < 0.03 and j not in used: used.add(j); dts.append(ob[j] - t)
p, r = len(dts) / len(ob), len(dts) / len(oa); dts = np.array(dts) * 1000
if '--unmatched' in sys.argv:
    unmatched = [float(t) for t in oa if np.min(np.abs(ob - t)) > 0.03]
    json.dump(unmatched, open(sys.argv[sys.argv.index('--unmatched') + 1], 'w'))
print(f'onsets: record {len(oa)}, render {len(ob)}, matched {len(dts)} (30 ms): F1 {2 * p * r / (p + r):.3f}; timing render-record median {np.median(dts):+.1f} ms, |dt| 90% {np.percentile(np.abs(dts), 90):.1f} ms')
# 4. CQT similarity
def cqt(x): return np.abs(librosa.cqt(x, sr=SR, hop_length=448, fmin=librosa.note_to_hz('C2'), n_bins=252, bins_per_octave=36, filter_scale=0.5))
Ca, Cb = cqt(a), cqt(b)
A = np.log1p(Ca / Ca.max() * 1000); B = np.log1p(Cb / Cb.max() * 1000)
k = min(A.shape[1], B.shape[1]); A, B = A[:, :k], B[:, :k]
cos = np.sum(A * B, axis=0) / (np.linalg.norm(A, axis=0) * np.linalg.norm(B, axis=0) + 1e-9)
act_f = (np.arange(k) * 448 / SR > 0.5) & (np.arange(k) * 448 / SR < 92)
ch_a = librosa.feature.chroma_cqt(C=Ca[:, :k], sr=SR, hop_length=448, bins_per_octave=36); ch_b = librosa.feature.chroma_cqt(C=Cb[:, :k], sr=SR, hop_length=448, bins_per_octave=36)
chroma_cos = np.sum(ch_a * ch_b, axis=0) / (np.linalg.norm(ch_a, axis=0) * np.linalg.norm(ch_b, axis=0) + 1e-9)
print(f'CQT log-magnitude cosine: mean {cos[act_f].mean():.3f} (10th pct {np.percentile(cos[act_f], 10):.3f}); chroma cosine mean {chroma_cos[act_f].mean():.3f}')
json.dump(dict(level_offset_db=float(20 * np.log10(g)), loudness_r=float(np.corrcoef(la[sel], lb[sel])[0, 1]), onset_f1=float(2 * p * r / (p + r)),
               onset_median_ms=float(np.median(dts)), cqt_cos=float(cos[act_f].mean()), chroma_cos=float(chroma_cos[act_f].mean()),
               ltas=[(float(c), float(pb - pa)) for c, pa, pb in rows]), open(out + '_metrics.json', 'w'))
# 5. pages
pages = [float(v) for v in sys.argv[sys.argv.index('--pages') + 1].split(',')] if '--pages' in sys.argv else [2.0]
names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
for i, t0 in enumerate(pages):
    s0, s1 = int(t0 * SR / 448), int((t0 + 4) * SR / 448)
    fig, axs = plt.subplots(2, 1, figsize=(11, 11), dpi=90, sharex=True)
    for ax, C, title in ((axs[0], Ca, 'record'), (axs[1], Cb, 'render (level-matched)')):
        D = 20 * np.log10(C[:144, s0:s1] / Ca[:144, s0:s1].max() + 1e-9)
        ax.imshow(D, origin='lower', aspect='auto', cmap='magma', vmin=-55, vmax=0, extent=[t0, t0 + 4, 36 - 1 / 6, 36 + 48 - 1 / 6])
        ax.set_yticks(range(36, 84, 2)); ax.set_yticklabels([f'{names[m % 12]}{m // 12 - 1}' for m in range(36, 84, 2)], fontsize=6)
        ax.set_title(title, fontsize=9)
        for m in range(36, 84): ax.axhline(m - 0.5, color='w', lw=0.3, alpha=0.15)
    fig.tight_layout(); fig.savefig(f'{out}_page{i}.png'); plt.close(fig); print(f'{out}_page{i}.png')
