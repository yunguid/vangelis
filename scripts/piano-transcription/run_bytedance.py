"""Piano notes, velocities and sustain pedal from ByteDance's high-resolution piano
transcription (piano-transcription-inference 0.1.0, checkpoint note F1 0.9677 / pedal F1
0.9186), on the record's timeline.

The audio is first moved to A440 by reinterpreting its sample rate (as speed_correct.py does),
so the model's pitch bins sit on the notes; onsets and offsets are mapped back.

usage: run_bytedance.py audio.wav cents out.json     (cents: the record's offset from A440)
"""
import json, sys, numpy as np, soundfile as sf, librosa
from piano_transcription_inference import PianoTranscription, sample_rate
src, cents, out = sys.argv[1], float(sys.argv[2]), sys.argv[3]
x, sr = sf.read(src, dtype='float32', always_2d=True)
x = x.mean(1)
speed = 2 ** (-cents / 1200)                 # fixed-timeline rate factor (>1 when the record is flat)
y = librosa.resample(x, orig_sr=sr * speed, target_sr=sample_rate)
t = PianoTranscription(device='cpu')
d = t.transcribe(y, out.replace('.json', '.mid'))
notes = [{'on': float(n['onset_time']) * speed, 'off': float(n['offset_time']) * speed,
          'pitch': int(n['midi_note']), 'vel': int(n['velocity'])} for n in d['est_note_events']]
pedal = [{'on': float(p['onset_time']) * speed, 'off': float(p['offset_time']) * speed}
         for p in d['est_pedal_events']]
json.dump({'source': src, 'cents': cents, 'notes': notes, 'pedal': pedal}, open(out, 'w'))
print(out, len(notes), 'notes', len(pedal), 'pedal spans')
