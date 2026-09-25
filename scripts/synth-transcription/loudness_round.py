"""One closed-loop round: each CS-80 note's peak level in a render against the record's
(both measured by note_expr2 over the same notes), written as a correction in dB per note
(key: its start time), added to any earlier rounds.

usage: loudness_round.py expr_record.json expr_render.json out.json [--prev earlier.json]"""
import sys, json, numpy as np
rec = {f"{x['start']:.3f}": x for x in json.load(open(sys.argv[1]))}
ren = json.load(open(sys.argv[2]))
prev = json.load(open(sys.argv[sys.argv.index('--prev') + 1])) if '--prev' in sys.argv else {}
out = dict(prev); errs = []
for x in ren:
    k = f"{x['start']:.3f}"; r = rec.get(k)
    if not r or x.get('peak_db') is None: continue
    e = float(np.clip(x['peak_db'] - r['peak_db'], -6, 6))
    out[k] = round(out.get(k, 0.0) + e, 2); errs.append(x['peak_db'] - r['peak_db'])
json.dump(out, open(sys.argv[3], 'w'))
e = np.array(errs); print(f'{len(e)} notes: error median {np.median(e):+.1f} dB, IQR [{np.percentile(e, 25):+.1f} {np.percentile(e, 75):+.1f}], 10-90% [{np.percentile(e, 10):+.1f} {np.percentile(e, 90):+.1f}]')
