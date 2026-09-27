"""The piece's piano samples, from Salamander Grand V3 (CC-BY 3.0): only the recordings its
MIDI file plays (each note's nearest position at the velocity layer its CC 70 names), each:

- onset aligned to a 5 ms pre-roll;
- the right channel inverted where the spaced pair recorded the channels out of phase (their
  correlation below 0), which would cancel the note on mono speakers;
- moved to the record's pitch (--cents, a soxr resample), so no note is shifted more than a
  semitone on the page;
- voiced with --tone (a smooth equaliser in dB per third octave, summed over rounds, from
  calibrate.py), narrowed (--width) and leaned (--lean) as width.py measures the record;
- kept as long as the longest note that plays it sounds, plus its release and a 1 s
  raised-cosine tail, and never past its own recording; nothing else of the ring is cut;
- MP3 (libmp3lame -q:a QUALITY), stereo, 48 kHz.

usage: build_samples.py <salamander Samples dir> piece.mid out_dir --cents -32.1
       [--tone r0.json,r1.json] [--tone-max 2500] [--treble 10] [--attack-treble 3]
       [--width 0.4] [--lean "63:6.1,125:4.8,250:2.2,500:0.3,1000:-0.4,2000:-0.2,4000:-0.8"] [--gain-db 0]
       (--width scales each recording's side signal; --lean is the record's left-minus-right
       level per octave, and each recording is balanced to it at its fundamental, from its
       own measured balance, within 8 dB)
       (--tone-max: above it the loop's corrections are not used, since the record's top
       octaves hold its other layers and its floor; --treble dB is applied there instead, the
       ring's shortfall attack_ring.py measures, and --attack-treble dB over the first 30 ms,
       crossfading into the ring by 60 ms: on this record the piano's strike is only a little
       brighter than Salamander's while its ring is far brighter)
"""
import json, os, subprocess, sys, tempfile
import mido
import numpy as np
import soundfile as sf
import soxr
from piano_score import RELEASE, POSITIONS, file_name, name_of, position_of, sounding

PRE_ROLL = 0.005
TAIL = 1.0
QUALITY = 5
SR = 48000


def option(name, default=None):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default


def read_midi(path):
    """Notes (on, off, pitch, layer) and pedal spans from the piece's MIDI file."""
    mid = mido.MidiFile(path)
    t, layer, down, notes, pedal, ped_on = 0.0, 8, {}, [], [], None
    tempo = 500000
    for msg in mido.merge_tracks(mid.tracks):
        t += mido.tick2second(msg.time, mid.ticks_per_beat, tempo)
        if msg.type == 'set_tempo': tempo = msg.tempo
        elif msg.type == 'control_change' and msg.control == 70: layer = msg.value
        elif msg.type == 'control_change' and msg.control == 64:
            if msg.value >= 64 and ped_on is None: ped_on = t
            elif msg.value < 64 and ped_on is not None: pedal.append({'on': ped_on, 'off': t}); ped_on = None
        elif msg.type == 'note_on' and msg.velocity > 0: down[msg.note] = (t, msg.velocity, layer)
        elif msg.type in ('note_off', 'note_on') and msg.note in down:
            on, vel, lay = down.pop(msg.note)
            notes.append({'on': on, 'off': t, 'pitch': msg.note, 'vel': vel, 'layer': lay})
    return notes, pedal


def tone_curve(paths):
    """Summed third-octave corrections -> (centres, dB)."""
    total = {}
    for p in paths:
        for k, v in json.load(open(p))['tone'].items():
            total[float(k)] = total.get(float(k), 0) + v
    f = np.array(sorted(total)); return f, np.array([total[k] for k in f])


def equalise(x, fc, db):
    """Zero-phase FFT equaliser, the curve interpolated on log frequency (smooth, so its
    impulse response is short against a note)."""
    n = len(x); N = 1 << int(np.ceil(np.log2(n + SR)))
    f = np.fft.rfftfreq(N, 1 / SR)
    g = np.interp(np.log2(np.maximum(f, 1)), np.log2(fc), db, left=db[0], right=db[-1])
    H = 10 ** (g / 20)
    return np.stack([np.fft.irfft(np.fft.rfft(x[:, c], N) * H, N)[:n] for c in range(x.shape[1])], 1)


def main():
    src, midi_path, out = sys.argv[1], sys.argv[2], sys.argv[3]
    cents = float(option('--cents'))
    tones = [p for p in (option('--tone') or '').split(',') if p]
    fc, db = tone_curve(tones) if tones else (None, None)
    if fc is not None:
        db = np.where(fc <= float(option('--tone-max', 1e9)), db, float(option('--treble', 0)))
    width = float(option('--width', 1))
    lean = sorted((float(a), float(b)) for a, b in (kv.split(':') for kv in option('--lean').split(','))) if option('--lean') else None
    gain = 10 ** (float(option('--gain-db', 0)) / 20)
    notes, pedal = read_midi(midi_path)
    ends = sounding(notes, pedal)
    need = {}
    for n, e in zip(notes, ends):
        k = (position_of(n['pitch']), n['layer'])
        need[k] = max(need.get(k, 0), e - n['on'] + RELEASE)
    os.makedirs(out, exist_ok=True)
    ratio = 2 ** (-cents / 1200)                       # stretch factor that lowers the pitch
    total = 0
    for (pos, layer), seconds in sorted(need.items()):
        x, sr = sf.read(os.path.join(src, f'{name_of(pos)}v{layer}.flac'), always_2d=True)
        assert sr == SR
        if np.corrcoef(x[:, 0], x[:, 1])[0, 1] < 0: x[:, 1] = -x[:, 1]
        env = np.abs(x).max(1); onset = int(np.argmax(env > env.max() * 0.05))
        x = x[max(0, onset - int(PRE_ROLL * SR)):]
        x = soxr.resample(x, SR, SR * ratio, quality='VHQ')
        if fc is not None:
            ring = equalise(x, fc, db)
            if option('--attack-treble') is not None:
                da = np.where(fc <= float(option('--tone-max', 1e9)), db, float(option('--attack-treble')))
                strike = equalise(x, fc, da)
                t = np.arange(len(x)) / SR
                w = np.clip((t - PRE_ROLL - 0.03) / 0.03, 0, 1)[:, None]
                x = strike * (1 - w) + ring * w
            else:
                x = ring
        if width != 1:
            mid, side = (x[:, 0] + x[:, 1]) / 2, (x[:, 0] - x[:, 1]) / 2 * width
            x = np.stack([mid + side, mid - side], 1)
        if lean:
            f0 = 440 * 2 ** ((pos - 69 + cents / 100) / 12)
            target = np.interp(np.log2(f0), [np.log2(a) for a, _ in lean], [b for _, b in lean])
            own = 10 * np.log10(np.sum(x[:, 0] ** 2) / np.sum(x[:, 1] ** 2))
            b = float(np.clip(target - own, -8, 8))
            x = x * np.array([10 ** (b / 40), 10 ** (-b / 40)])
        keep = min(len(x), int((seconds + TAIL) * SR))
        x = x[:keep] * gain
        fade = min(int(TAIL * SR), keep // 4)
        x[-fade:] *= (0.5 + 0.5 * np.cos(np.linspace(0, np.pi, fade)))[:, None]
        wav = tempfile.NamedTemporaryFile(suffix='.wav', delete=False).name
        sf.write(wav, x.astype(np.float32), SR, subtype='FLOAT')
        dst = os.path.join(out, f'{file_name(pos)}v{layer}.mp3')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav, '-c:a', 'libmp3lame', '-q:a', str(QUALITY), '-ar', str(SR), dst], check=True)
        os.unlink(wav)
        total += os.path.getsize(dst)
        print(f'{os.path.basename(dst):10s} {keep / SR:5.1f} s  peak {20 * np.log10(np.abs(x).max()):6.1f} dBFS  {os.path.getsize(dst) / 1024:6.1f} KB')
    print(f'{len(need)} files, {total / 1024:.0f} KB')


if __name__ == '__main__':
    main()
