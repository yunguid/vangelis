"""The representation the fit works in: CQT magnitude, 3 bins per semitone from C2 over 7
octaves, filter scale 0.5, hop 448 at 44.1 kHz (10.16 ms). Computes V for the speed-corrected
recording and a template per Iowa take (retuned to equal temperament, normalised to unit
energy over its first 250 ms, with PRE frames before the pluck where the CQT smears low notes).

usage: features.py speed_corrected.wav takes.pkl features.pkl
"""
import numpy as np, soundfile as sf, librosa, pickle, sys
SR = 44100; HOP = 448; BPO = 36; FMIN = librosa.note_to_hz('C2') * 2 ** (-1 / 72); NB = BPO * 7
TPL_FRAMES = 400
PRE = 30  # template frames kept before the pluck (the CQT smears low notes backwards)
def cqt(x):
    return np.abs(librosa.cqt(x, sr=SR, hop_length=HOP, fmin=FMIN, n_bins=NB, bins_per_octave=BPO, filter_scale=0.5)).astype(np.float32)
if __name__ == '__main__':
    x, sr = sf.read(sys.argv[1], dtype='float32'); x = x.mean(axis=1) if x.ndim > 1 else x
    x = librosa.resample(x, orig_sr=sr, target_sr=SR)
    sf.write(sys.argv[1].replace('.wav', '44.wav'), x, SR, subtype='FLOAT')
    V = cqt(x)
    takes = pickle.load(open(sys.argv[2], 'rb'))
    T = {}
    for key, t in takes.items():
        a = t['audio']
        ratio = 2 ** (t['cents'] / 1200)          # >1 means sharp: stretch to lower the pitch
        a = librosa.resample(a, orig_sr=SR, target_sr=int(round(SR * ratio))) if abs(t['cents']) > 0.5 else a
        a = a[:int(4.2 * SR)]
        pre = int(0.003 * SR)
        e = np.sqrt(np.mean(a[pre:pre + int(0.25 * SR)] ** 2))
        a = np.pad(a / e, (PRE * HOP, max(0, int(4.2 * SR) - len(a))))
        C = cqt(a)[:, :TPL_FRAMES + PRE]
        T[key] = C
    pickle.dump(dict(V=V, T=T, sr=SR, hop=HOP, bpo=BPO, fmin=FMIN, pre=PRE), open(sys.argv[3], 'wb'))
    print('V', V.shape, 'templates', len(T))
