"""Run a QMUL high-resolution guitar transcription checkpoint (GAPS / FL) and keep both the note
events and the raw 100 fps activations (onset, offset, frame, velocity regressions).

Run it from the models environment (see README).

usage: run_qmul.py speed_corrected.wav checkpoint.pth out_prefix hf_cache_dir
"""
import sys, json, numpy as np, librosa, os
os.environ.setdefault('HF_HOME', sys.argv[4])
from hf_midi_transcription import MidiTranscriptionModel
audio, ckpt, out = sys.argv[1], sys.argv[2], sys.argv[3]
m = MidiTranscriptionModel(instrument='guitar', device='mps', checkpoint_path=ckpt)
y, _ = librosa.load(audio, sr=16000)
res = m.transcriptor.transcribe(y, None)
ev = res['est_note_events']
notes = [dict(start=float(e['onset_time']), end=float(e['offset_time']), midi=int(e['midi_note']), vel=int(e['velocity'])) for e in ev]
notes.sort(key=lambda n: (n['start'], n['midi']))
json.dump(notes, open(out + '.json', 'w'))
od = res['output_dict']
np.savez_compressed(out + '.npz', **{k: np.asarray(v, dtype=np.float32) for k, v in od.items() if hasattr(v, 'shape')})
print(os.path.basename(ckpt), len(notes), 'notes; activations', {k: np.asarray(v).shape for k, v in od.items() if hasattr(v, 'shape')})
