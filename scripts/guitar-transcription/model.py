"""Analysis-by-synthesis model of a solo guitar recording.

    V[f, t]  ~  N[f] + H[f] * sum_n g_n * C_n[f, t]

V is the CQT magnitude of the recording (features.py). C_n is the Iowa take of note n's
string, fret and stroke (pp/mf/ff), reshaped the way the recording differs from the Iowa
guitar and the way the page will play the note:
  - E_p(f): a per-pitch correction of the balance of partials (Bonfa's guitar vs Iowa's);
  - alpha(f): an extra decay of the upper partials;
  - a high shelf at 3x the note's frequency (the stroke's brightness, as SampleVoice plays it);
  - the page's envelope: a mute (exponential decay from 20 ms after the pluck) and the release
    at the note's end (the next pluck on its string or an earlier damp), applied in time and
    seen through each CQT bin's own window, so low notes smear exactly as the recording's do;
  - the room: an exponential tail behind every frame.
Each note is shifted to its onset (fractional frames, linear interpolation). H is the recording
channel (mic, tape, room colour, guitar body) against the anechoic takes and N its noise floor.
Fitting minimises the KL divergence, whitened per bin by the square root of the recording's
long-term spectrum so treble detail counts without the tape hiss dominating."""
import numpy as np
from scipy.signal import lfilter

OPEN = {1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40}
FRAME_SECONDS = 448 / 44100
MUTE_ONSET_FRAMES = 0.02 / FRAME_SECONDS      # samplePool.js MUTE_ONSET_SECONDS
SHELF_HARMONIC = 3.0  # the brightness shelf sits at 3x the note's frequency

def shelf_response(midi, gain_db, hz, sr=48000):
    """|H(f)| of a Web Audio 'highshelf' BiquadFilterNode at SHELF_HARMONIC x the note's
    frequency: the per-note brightness the page applies, so analysis and playback agree."""
    f0 = min(440 * 2 ** ((midi - 69) / 12) * SHELF_HARMONIC, 0.45 * sr)
    A = 10 ** (gain_db / 40); w0 = 2 * np.pi * f0 / sr
    alpha = np.sin(w0) / 2 * np.sqrt(2)
    k = 2 * np.sqrt(A) * alpha; c = np.cos(w0)
    b0 = A * ((A + 1) + (A - 1) * c + k); b1 = -2 * A * ((A - 1) + (A + 1) * c); b2 = A * ((A + 1) + (A - 1) * c - k)
    a0 = (A + 1) - (A - 1) * c + k; a1 = 2 * ((A - 1) - (A + 1) * c); a2 = (A + 1) - (A - 1) * c - k
    z = np.exp(-1j * 2 * np.pi * np.asarray(hz) / sr)
    return np.abs((b0 + b1 * z + b2 * z * z) / (a0 + a1 * z + a2 * z * z))

class Model:
    def __init__(self, V, T, bpo=36, fmin_midi=36, pre=0):
        self.V = V.astype(np.float64) + 1e-7
        self.T = T
        self.F, self.N = V.shape
        self.L = next(iter(T.values())).shape[1]
        # frames with music only (the file ends in digital silence)
        active = self.V.sum(axis=0) > np.percentile(self.V.sum(axis=0), 50) * 1e-3
        ltas = np.percentile(self.V[:, active], 75, axis=1)
        # square-root whitening: treble detail counts, without letting hiss dominate
        self.w = (1.0 / np.sqrt(np.maximum(ltas, ltas.max() * 1e-4)))[:, None]
        self.w /= self.w.min()
        self.noise = np.percentile(self.V[:, active], 10, axis=1)[:, None]
        self.active = active
        self.H = np.ones((self.F, 1))
        self.alpha = np.zeros(self.F)     # extra decay per frame, per bin (recording vs Iowa)
        self.E = {}                       # per-pitch spectral correction (Bonfa's guitar vs Iowa's)
        self._shaped = {}
        self.bpo = bpo; self.fmin_midi = fmin_midi; self.pre = pre
        self.bin_hz = 440 * 2 ** ((fmin_midi + np.arange(self.F) * 12 / bpo - 69) / 12)
        self.release_frames = 0.07 / FRAME_SECONDS    # the page's release; stage 3 fits it
        self.room_level = 0.0
        self.room_frames = 20.0
        # CQT window per bin (filter_scale 0.5, 36 bins/octave): Hann of Q*sr/f samples; bins are
        # grouped by half-octave, each sharing the squared window of its centre as a frame kernel
        Q = 0.5 / (2 ** (1 / bpo) - 1)
        self.smear_groups = []
        for g0 in range(0, self.F, bpo // 2):
            rows = slice(g0, min(self.F, g0 + bpo // 2))
            f = self.bin_hz[min(self.F - 1, g0 + bpo // 4)]
            width = Q * 44100 / f / 448            # window length in frames
            m = max(1, int(np.ceil(width)) | 1)
            x = (np.arange(m) - (m - 1) / 2) / max(width, 1e-9)
            kern = np.where(np.abs(x) <= 0.5, np.cos(np.pi * x) ** 4, 0.0)   # Hann squared
            kern = kern / kern.sum() if kern.sum() > 0 else np.ones(1)
            self.smear_groups.append((rows, kern))
        self.notes = []

    # -- one note's spectrogram block ---------------------------------------------------
    def shaped(self, key, tilt=0):
        """A take with the extra decay, its pitch's correction and the stroke's brightness
        (`tilt`, the shelf gain in dB: from warm flesh to bright nail)."""
        ck = (key, tilt)
        C = self._shaped.get(ck)
        if C is None:
            s, f, _ = key
            tau = np.maximum(0, np.arange(self.T[key].shape[1]) - self.pre)
            C = self.T[key] * np.exp(-self.alpha[:, None] * tau[None, :])
            E = self.E.get(OPEN[s] + f)
            if E is not None: C = C * E[:, None]
            if tilt:
                C = C * shelf_response(OPEN[s] + f, tilt, self.bin_hz)[:, None]
            self._shaped[ck] = C
        return C

    def set_alpha(self, alpha):
        self.alpha = alpha; self._shaped = {}

    def adapt_E(self, iters=3, min_notes=3, smooth_bins=2, pool=0.5, clip_db=18):
        """Learn a per-pitch spectral correction E_p(f) by multiplicative (NMF) updates over
        the notes of that pitch, smoothed across frequency and pooled with neighbouring
        pitches, then clipped to +-clip_db."""
        for _ in range(iters):
            self.build()
            R = self.w * self.V / self.Vh
            num, den, cnt = {}, {}, {}
            for n in self.notes:
                s0, B = self.block(n)
                HB = self.H * B * n['g']
                p = n['midi']
                num[p] = num.get(p, 0) + np.sum(HB * R[:, s0:s0 + B.shape[1]], axis=1)
                den[p] = den.get(p, 0) + np.sum(self.w * HB, axis=1)
                cnt[p] = cnt.get(p, 0) + 1
            logE = {}
            for p in num:
                if cnt[p] < min_notes: continue
                cur = self.E.get(p, np.ones(self.F))
                upd = cur * (num[p] + 1e-9) / (den[p] + 1e-9)
                # only bins the pitch actually excites carry information
                wgt = den[p] / (den[p].max() + 1e-12)
                lg = np.log(upd) * np.minimum(1, wgt * 50)
                k = np.hanning(2 * smooth_bins + 1); k /= k.sum()
                logE[p] = np.convolve(np.pad(lg, smooth_bins, mode='edge'), k, mode='valid')
            pooled = {}
            for p, lg in logE.items():
                nb = [logE[q] for q in (p - 1, p + 1) if q in logE]
                pooled[p] = (1 - pool) * lg + (pool * np.mean(nb, axis=0) if nb else pool * lg)
            lim = clip_db / 20 * np.log(10)
            self.E = {p: np.exp(np.clip(lg, -lim, lim)) for p, lg in pooled.items()}
            self._shaped = {}
            self.fit_gains(iters=5, fit_H=False)
        return self.cost()

    def block(self, n):
        C = self.shaped((n['s'], n['f'], n['d']), n.get('tilt', 0))
        t = n['t'] - self.pre; i0 = int(np.floor(t)); a = t - i0
        L = self.L
        B = np.empty((self.F, L + 1))
        B[:, 0] = (1 - a) * C[:, 0]; B[:, 1:L] = (1 - a) * C[:, 1:] + a * C[:, :-1]; B[:, L] = a * C[:, -1]
        idx = np.arange(L + 1) + i0          # absolute (fractional-onset) frame of each column
        env = np.ones(L + 1)
        end = n.get('end')
        if end is not None:
            # the page's release: an exponential ramp to -80 dB over RELEASE_FRAMES
            x = np.clip((idx - end) / self.release_frames, 0, 1)
            env *= 10 ** (-4 * x)
        mute = n.get('mute')
        if mute:
            # the page's mute: setTargetAtTime from MUTE_ONSET after the pluck
            start = n['t'] + MUTE_ONSET_FRAMES
            env *= np.where(idx <= start, 1.0, np.exp(-(idx - start) / mute))
        if end is not None or mute:
            # the envelope acts on the waveform; each CQT bin sees it through its own window
            e2 = env ** 2
            for rows, kern in self.smear_groups:
                sm = np.convolve(np.pad(e2, (len(kern) // 2, len(kern) // 2), mode='edge'), kern, mode='valid')
                B[rows] *= np.sqrt(np.maximum(sm, 1e-12))[None, :]
        if self.room_level > 0:
            # the room: an exponential tail (level room_level, time constant room_frames) behind
            # every frame of the dry note, in magnitude
            a = np.exp(-1.0 / self.room_frames)
            tail = lfilter([0.0, 1.0 - a], [1.0, -a], B, axis=1)
            B = B + self.room_level * tail
        s0 = max(0, i0); s1 = min(self.N, i0 + L + 1)
        return s0, B[:, s0 - i0:s1 - i0]

    def build(self):
        X = np.zeros((self.F, self.N))
        for n in self.notes:
            s0, B = self.block(n)
            X[:, s0:s0 + B.shape[1]] += n['g'] * B
        self.X = X
        self.Vh = self.noise + self.H * X
        return self.Vh

    @classmethod
    def resume(cls, features, fit=None):
        """A model on `features` (features.py output), carrying on from a saved stage."""
        M = cls(features['V'], features['T'], pre=features['pre'])
        if fit:
            M.notes = fit['notes']
            M.H, M.noise, M.E = fit['H'], fit['noise'], fit.get('E', {})
            M.set_alpha(fit['alpha'])
            if 'release' in fit:
                M.release_frames = fit['release'] / FRAME_SECONDS
            if 'room_level' in fit:
                M.room_level, M.room_frames = fit['room_level'], fit['room_seconds'] / FRAME_SECONDS
        M.build()
        return M

    def state(self):
        """What a stage saves: the notes and every fitted curve."""
        return dict(notes=self.notes, H=self.H, noise=self.noise, alpha=self.alpha, E=self.E,
                    release=self.release_frames * FRAME_SECONDS, room_level=self.room_level,
                    room_seconds=self.room_frames * FRAME_SECONDS)

    def summary(self):
        """Cost, and the energy (magnitude ** 0.3) the model misses and adds, as fractions."""
        V, Vh = self.V ** 0.3, self.Vh ** 0.3
        e = np.sum(V ** 2)
        return (f'notes {len(self.notes):5d} cost {self.cost():10.0f}  '
                f'missing {np.sum(np.maximum(V - Vh, 0) ** 2) / e:.4f}  extra {np.sum(np.maximum(Vh - V, 0) ** 2) / e:.4f}')

    def kl(self, V, Vh, w):
        return float(np.sum(w * (V * np.log(V / Vh) - V + Vh)))

    def cost(self):
        return self.kl(self.V, self.Vh, self.w)

    def fit_gains(self, iters=30, fit_H=True, smooth_bins=6, fit_N=True):
        for it in range(iters):
            self.build()
            R = self.w * self.V / self.Vh
            for n in self.notes:
                s0, B = self.block(n)
                HB = self.H * B
                num = np.sum(HB * R[:, s0:s0 + B.shape[1]]); den = np.sum(self.w * HB)
                n['g'] *= num / max(den, 1e-12)
            if fit_H:
                self.build()
                R = self.w * self.V / self.Vh
                num = np.sum(self.X * R, axis=1, keepdims=True); den = np.sum(self.w * self.X, axis=1, keepdims=True)
                H = self.H * num / np.maximum(den, 1e-12)
                # smooth across frequency (1/3-octave-ish) in the log domain
                k = np.hanning(2 * smooth_bins + 1); k /= k.sum()
                lh = np.convolve(np.log(np.pad(H[:, 0], smooth_bins, mode='edge')), k, mode='valid')
                self.H = np.exp(lh)[:, None]
                # keep scale in the gains, not in H
                sc = np.exp(np.mean(np.log(self.H)))
                self.H /= sc
                for n in self.notes: n['g'] *= sc
            if fit_N:
                self.build()
                R = self.V / self.Vh
                a = self.active
                self.noise = self.noise * (np.sum(R[:, a], axis=1, keepdims=True) / a.sum())
        self.build()
        return self.cost()

