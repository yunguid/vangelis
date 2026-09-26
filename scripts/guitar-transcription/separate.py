"""Demucs stems of a band recording, for transcribing its guitar (soundfile I/O, so no
torchaudio backend is needed). htdemucs_6s splits drums, bass, other, vocals, guitar and piano.
Run it from the separation environment (see README).

Demucs averages the model over `--shifts` random time offsets of the input: a single pass
differs from the next by only about 19 dB (the guitar of The Shade of the Mango Tree), so the
fit's stems average several, and the offsets are seeded so a run repeats exactly.

usage: separate.py record44.wav out_dir htdemucs_6s [--shifts 8]   (the record at 44.1 kHz, the
       model's rate)
"""
import random, sys, time, soundfile as sf, torch
from demucs.pretrained import get_model
from demucs.apply import apply_model
src, out, name = sys.argv[1:4]
shifts = int(sys.argv[sys.argv.index('--shifts') + 1]) if '--shifts' in sys.argv else 1
random.seed(0)
model = get_model(name); model.eval()
x, sr = sf.read(src, dtype='float32', always_2d=True)
assert sr == model.samplerate, (sr, model.samplerate)
wav = torch.from_numpy(x.T.copy())
ref = wav.mean(0); wav = (wav - ref.mean()) / ref.std()
t = time.time()
with torch.no_grad():
    stems = apply_model(model, wav[None], device='cpu', shifts=shifts, split=True, overlap=0.25, progress=False)[0]
stems = stems * ref.std() + ref.mean()
for s, stem in zip(model.sources, stems):
    sf.write(f'{out}/{name}_{s}.wav', stem.numpy().T, sr, subtype='FLOAT')
print(name, model.sources, f'{shifts} shifts, {time.time() - t:.0f}s')
