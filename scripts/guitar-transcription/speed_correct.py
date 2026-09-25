"""Undo the recording's +cents speed offset by reinterpreting the sample rate (tape-speed correction).
Writes a WAV whose pitch is at A440; times scale by 2**(cents/1200).

usage: speed_correct.py record.wav speed_corrected.wav cents
"""
import soundfile as sf, sys
x, sr = sf.read(sys.argv[1], dtype='float32')
cents = float(sys.argv[3])
x = x.mean(axis=1) if x.ndim > 1 else x
sf.write(sys.argv[2], x, int(round(sr * 2 ** (-cents / 1200))), subtype='FLOAT')
print(sys.argv[2], int(round(sr * 2 ** (-cents / 1200))))
