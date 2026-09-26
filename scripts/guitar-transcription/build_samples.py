"""Build the recordings a transcribed guitar performance plays, voiced like the source recording.

For every take the MIDI file uses (string, fret, stroke from CC 70) this cuts the note out of the
University of Iowa MIS guitar masters (24-bit/96 kHz, anechoic), retunes it to equal temperament,
and shapes it with the fitted voicing (the recording channel H(f), the per-pitch correction E_p(f),
the recording's faster decay of high partials alpha(f)), all measured by the analysis-by-synthesis
fit. Then it trims each take to the longest note that plays it, fades the tail, sets every take's
attack level on one line and encodes mono MP3.

With --attack (calibration rounds from calibrate.py), the first moments of each take are voiced
apart: the pluck's own brightness, which the ring's voicing does not reach, gets the measured
correction in full for ATTACK_SECONDS after the pluck, fading out over ATTACK_FADE.

usage: build_samples.py <iowa 2496mono dir> <fit.pkl> <performance.mid> <out dir> [--tone a.json,b.json]
       [--attack a.json,b.json] [--clip 18] [--verbose]
       (--clip: the most any voicing may lift or cut, dB; The Shade of the Mango Tree's record is
       more than 18 dB darker than the Iowa takes above 8 kHz)
"""
import sys, os, pickle, subprocess, tempfile, numpy as np, scipy.signal as ss, soundfile as sf, mido
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from iowa import load_takes, OPEN
SR = 44100
CQT_BPO, CQT_FMIN_MIDI, CQT_HOP = 36, 36, 448
TAKE = {range(0, 43): 'pp', range(43, 86): 'mf', range(86, 128): 'ff'}
PRE_ROLL = 0.003
RING_MARGIN = 0.35
MIN_SECONDS, MAX_SECONDS = 0.6, 6.0
TAIL_FADE = 0.3
LEVEL_SLOPE_DB = -0.1        # per semitone, as for the other guitar sets
PEAK_TARGET_DB = -2.0
CLIP_DB = 18.0
MP3_QUALITY = 4

def take_name(v):
    return next(name for r, name in TAKE.items() if v in r)

def needed_takes(midi_path):
    """{(string, fret, take): longest seconds} from a string-per-channel performance file."""
    mid = mido.MidiFile(midi_path)
    need = {}
    # absolute seconds via mido's merged playback timing
    t = 0.0; take = {}; on = {}
    for msg in mid:
        t += msg.time
        if msg.type == 'control_change' and msg.control == 70:
            take[msg.channel] = take_name(msg.value)
        elif msg.type == 'note_on' and msg.velocity > 0:
            on[(msg.channel, msg.note)] = (t, take.get(msg.channel, 'mf'))
        elif msg.type in ('note_off', 'note_on') and (msg.channel, msg.note) in on:
            t0, tk = on.pop((msg.channel, msg.note))
            s = msg.channel + 1; key = (s, msg.note - OPEN[s], tk)
            need[key] = max(need.get(key, 0), t - t0)
    return need

TONE_CORRECTION = None     # (Hz, dB) the last render measured over the record (calibrate.py)
ATTACK_CORRECTION = None   # (Hz, dB) its strokes' attacks measured against their ring (calibrate.py)
ATTACK_SECONDS, ATTACK_FADE = 0.02, 0.03

def voicing_curve(fit, midi, freqs):
    """Gain (linear) per STFT bin: H * E_p, from CQT bins to Hz, clipped to +-CLIP_DB, minus the
    tone the closed-loop calibration measured the render to carry in excess of the record."""
    H = fit['H'][:, 0]; E = fit['E'].get(midi, np.ones_like(H))
    cqt_midi = CQT_FMIN_MIDI + np.arange(len(H)) / (CQT_BPO / 12)
    cqt_hz = 440 * 2 ** ((cqt_midi - 69) / 12)
    g_db = 20 * np.log10(H * E)
    g_db -= np.median(g_db[(cqt_hz > 200) & (cqt_hz < 2000)])      # level is set later
    g = np.interp(np.log(np.maximum(freqs, 1)), np.log(cqt_hz), g_db, left=g_db[0], right=g_db[-1])
    if TONE_CORRECTION is not None:
        hz, db = TONE_CORRECTION
        g = g - np.interp(np.log(np.maximum(freqs, 1)), np.log(hz), db, left=db[0], right=db[-1])
    # nothing under the low E sounds on the record: a 4th-order high-pass at 60 Hz
    hp = 1 / np.sqrt(1 + (60 / np.maximum(freqs, 1)) ** 8)
    return 10 ** (np.clip(g, -CLIP_DB, CLIP_DB) / 20) * hp

def decay_curve(fit, freqs):
    """alpha per CQT frame -> per second, per STFT bin."""
    a = fit['alpha']
    cqt_midi = CQT_FMIN_MIDI + np.arange(len(a)) / (CQT_BPO / 12)
    cqt_hz = 440 * 2 ** ((cqt_midi - 69) / 12)
    per_frame = np.interp(np.log(np.maximum(freqs, 1)), np.log(cqt_hz), a, left=a[0], right=a[-1])
    return per_frame * SR / CQT_HOP

def voice(audio, fit, midi):
    n = 2048; hop = 256
    f, tt, Z = ss.stft(audio, fs=SR, window='hann', nperseg=n, noverlap=n - hop, boundary='zeros', padded=True)
    G = voicing_curve(fit, midi, f)[:, None] * np.exp(-decay_curve(fit, f)[:, None] * np.maximum(0, tt - PRE_ROLL)[None, :])
    if ATTACK_CORRECTION is not None:
        hz, db = ATTACK_CORRECTION
        cut = np.clip(np.interp(np.log(np.maximum(f, 1)), np.log(hz), db, left=db[0], right=db[-1]), -CLIP_DB, CLIP_DB)
        # frames by their centre: the whole correction up to ATTACK_SECONDS past the pluck, none past the fade
        w = np.clip(1 - (np.maximum(0, tt - PRE_ROLL) - ATTACK_SECONDS) / ATTACK_FADE, 0, 1)
        G = G * 10 ** (-cut[:, None] * w[None, :] / 20)
    _, y = ss.istft(Z * G, fs=SR, window='hann', nperseg=n, noverlap=n - hop, boundary=True)
    return y[:len(audio)].astype(np.float32)

def main(src, fit_path, midi_path, out_dir):
    fit = pickle.load(open(fit_path, 'rb'))
    need = needed_takes(midi_path)
    takes = load_takes(src, keys=set(need))
    os.makedirs(out_dir, exist_ok=True)
    for stale in [x for x in os.listdir(out_dir) if x.endswith('.mp3')]: os.remove(os.path.join(out_dir, stale))
    built = []
    for (s, f, d), seconds in sorted(need.items()):
        t = takes.get((s, f, d))
        if t is None: raise SystemExit(f'no Iowa take for string {s} fret {f} {d}')
        midi = OPEN[s] + f
        a = t['audio']
        # retune: a take `cents` sharp is stretched by that ratio
        if abs(t['cents']) > 0.5:
            import librosa
            a = librosa.resample(a, orig_sr=SR, target_sr=int(round(SR * 2 ** (t['cents'] / 1200))))
        length = int(min(MAX_SECONDS, max(MIN_SECONDS, seconds + RING_MARGIN)) * SR)
        a = voice(a[:length + SR // 2], fit, midi)[:length]
        a = np.pad(a, (0, max(0, length - len(a))))
        fade = int(len(a) * TAIL_FADE)
        a[-fade:] *= 0.5 + 0.5 * np.cos(np.pi * np.arange(1, fade + 1) / fade)
        pre = int(PRE_ROLL * SR)
        level = 20 * np.log10(np.sqrt(np.mean(a[pre:pre + int(0.25 * SR)] ** 2)) + 1e-12)
        built.append(dict(key=f's{s}f{f}{d}', midi=midi, audio=a, level=level, cents=t['cents']))
    mean_pitch = np.mean([b['midi'] for b in built]); mean_level = np.mean([b['level'] for b in built])
    for b in built:
        b['trim'] = mean_level + LEVEL_SLOPE_DB * (b['midi'] - mean_pitch) - b['level']
    peaks = sorted(((np.abs(b['audio']).max() * 10 ** (b['trim'] / 20), b['key'], b['trim']) for b in built), reverse=True)
    if '--verbose' in sys.argv:
        for pk, key, trim in peaks[:6]: print(f'   peak on the line {20 * np.log10(pk):+6.1f} dB  {key}  trim {trim:+.1f} dB')
    peak = peaks[0][0]
    shared = PEAK_TARGET_DB - 20 * np.log10(peak)
    total = 0
    with tempfile.TemporaryDirectory() as tmp:
        for b in built:
            wav = os.path.join(tmp, b['key'] + '.wav'); mp3 = os.path.join(out_dir, b['key'] + '.mp3')
            sf.write(wav, b['audio'] * 10 ** ((b['trim'] + shared) / 20), SR, subtype='FLOAT')
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav, '-codec:a', 'libmp3lame', '-q:a', str(MP3_QUALITY), mp3], check=True)
            total += os.path.getsize(mp3)
    print(f'{len(built)} takes, {total / 1048576:.2f} MiB, shared gain {shared:+.1f} dB, trims {np.min([b["trim"] for b in built]):+.1f}..{np.max([b["trim"] for b in built]):+.1f} dB')

if __name__ == '__main__':
    if '--clip' in sys.argv:
        CLIP_DB = float(sys.argv[sys.argv.index('--clip') + 1])
    if '--tone' in sys.argv:
        # one or more calibration rounds (comma-separated), each measured on the previous build
        import json
        curves = [json.load(open(f))['tone'] for f in sys.argv[sys.argv.index('--tone') + 1].split(',')]
        hz = np.array([t[0] for t in curves[0]])
        TONE_CORRECTION = (hz, np.sum([[t[1] for t in c] for c in curves], axis=0))
    if '--attack' in sys.argv:
        import json
        curves = [json.load(open(f))['attack'] for f in sys.argv[sys.argv.index('--attack') + 1].split(',')]
        ATTACK_CORRECTION = (np.array([t[0] for t in curves[0]]), np.sum([[t[1] for t in c] for c in curves], axis=0))
    main(*sys.argv[1:5])
