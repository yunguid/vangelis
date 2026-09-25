"""How far a render's picture is from the record's over a span: mean |dB difference| of
their constant-Q magnitudes (3 bins/semitone, C2-C8, 20 ms), each floored 60 dB under its
peak, after the best overall gain; also the correlation of the two dB pictures.
usage: cqt_distance.py record.wav render.wav t0 t1"""
import sys, numpy as np, soundfile as sf, librosa
rec, ren, t0, t1 = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4])
def pic(path, t0, t1):
    info = sf.info(path); sr = info.samplerate
    x, _ = sf.read(path, start=int(t0 * sr), stop=int(t1 * sr), dtype='float32'); x = x.mean(axis=1) if x.ndim > 1 else x
    C = np.abs(librosa.cqt(x, sr=sr, hop_length=960, fmin=librosa.midi_to_hz(36) * 2 ** (11.6 / 1200), n_bins=72 * 3, bins_per_octave=36))
    return 20 * np.log10(C + 1e-9)
A = pic(rec, t0, t1); B = pic(ren, t0, t1); n = min(A.shape[1], B.shape[1]); A, B = A[:, :n], B[:, :n]
B += np.median(A - B)
floor = A.max() - 60; A = np.maximum(A, floor); B = np.maximum(B, floor)
print(f'mean |dB diff| {np.mean(np.abs(A - B)):.2f}  corr {np.corrcoef(A.ravel(), B.ravel())[0, 1]:.3f}')
