"""Local-search refinements of an analysis-by-synthesis fit (model.py). Each move is scored by
the change in whitened KL divergence over the frames the notes it touches cover; moving,
adding or removing a note also moves the ends of its neighbours on the same string, since a
string sounds one note at a time."""
import numpy as np


def region_cost(M, Vh, s0, s1):
    V = M.V[:, s0:s1]
    return float(np.sum(M.w * (V * np.log(V / Vh) - V + Vh)))


def note_span(M, n):
    s0, B = M.block(n)
    return s0, s0 + B.shape[1]


def swap_cost(M, old_notes, new_notes):
    """Cost change when old_notes (already in the model) are replaced by new_notes."""
    spans = [note_span(M, n) for n in old_notes + new_notes]
    s0 = min(a for a, _ in spans)
    s1 = max(b for _, b in spans)
    base = M.Vh[:, s0:s1].copy()
    before = region_cost(M, base, s0, s1)
    alt = base.copy()
    for n in old_notes:
        a, B = M.block(n)
        alt[:, a - s0:a - s0 + B.shape[1]] -= M.H * n['g'] * B
    for n in new_notes:
        a, B = M.block(n)
        alt[:, a - s0:a - s0 + B.shape[1]] += M.H * n['g'] * B
    return region_cost(M, np.maximum(alt, M.noise), s0, s1) - before


def apply(M, old_notes, new_notes):
    for n in old_notes:
        a, B = M.block(n)
        M.Vh[:, a:a + B.shape[1]] -= M.H * n['g'] * B
    for n in new_notes:
        a, B = M.block(n)
        M.Vh[:, a:a + B.shape[1]] += M.H * n['g'] * B
    np.maximum(M.Vh, M.noise, out=M.Vh)


def best_gain(M, n, others_vh, s0):
    """A few multiplicative KL updates of one note's gain with the rest of the model fixed."""
    a, B = M.block(n)
    HB = M.H * B
    V = M.V[:, a:a + B.shape[1]]
    rest = others_vh[:, a - s0:a - s0 + B.shape[1]]
    g = max(n['g'], 1e-4)
    for _ in range(8):
        g *= np.sum(M.w * HB * V / (rest + g * HB)) / max(np.sum(M.w * HB), 1e-12)
    return g


def with_nat_end(n, nat):
    """A copy of n whose natural end (the next pluck on its string) is `nat`."""
    m = dict(n)
    m['nat_end'] = nat
    e = nat
    if m.get('damp') is not None:
        e = m['damp'] if e is None else min(e, m['damp'])
    m['end'] = e
    return m


def set_natural_ends(M):
    """nat_end: the next pluck on the same string; end = min(nat_end, damp)."""
    last = {}
    for n in sorted(M.notes, key=lambda n: n['t'], reverse=True):
        n.update(with_nat_end(n, last.get(n['s'])))
        last[n['s']] = n['t']


def prev_on_string(M, s, t, exclude=None):
    best = None
    for m in M.notes:
        if m is exclude or m['s'] != s or m['t'] >= t:
            continue
        if best is None or m['t'] > best['t']:
            best = m
    return best


def next_on_string(M, s, t, exclude=None):
    best = None
    for m in M.notes:
        if m is exclude or m['s'] != s or m['t'] <= t:
            continue
        if best is None or m['t'] < best['t']:
            best = m
    return best


def damp_pass(M, choices=(4, 7, 10, 14, 19, 26, 35, 48, 65, 90, 125), mutes=(3, 5, 8, 12, 18, 27)):
    """Choose how each note stops: ringing to the next pluck on its string, damped a number of
    frames after its onset (`choices`), or muted from the start (an exponential decay with a
    time constant of `mutes` frames: the palm or the thumb resting on the string)."""
    changed = 0
    for n in sorted(M.notes, key=lambda n: n['t']):
        nat = n.get('nat_end')
        cur = (n.get('damp'), n.get('mute'))
        cands = [(None, None)]
        cands += [(n['t'] + c, None) for c in choices if nat is None or n['t'] + c < nat]
        cands += [(None, mu) for mu in mutes]
        best, bestd = cur, 0.0
        for c in cands:
            if c == cur:
                continue
            alt = dict(n)
            alt['damp'], alt['mute'] = c
            alt['end'] = nat if c[0] is None else c[0]
            d = swap_cost(M, [n], [alt])
            if d < bestd:
                best, bestd = c, d
        if best != cur:
            alt = dict(n)
            alt['damp'], alt['mute'] = best
            alt['end'] = nat if best[0] is None else best[0]
            apply(M, [n], [alt])
            n.update(alt)
            changed += 1
    return changed


def fit_alpha(M, grid=(0, 0.002, 0.004, 0.007, 0.01, 0.015, 0.02, 0.03, 0.045, 0.065), bands=24):
    """Extra decay per frequency band (the recording's partials die faster than the Iowa
    takes'): per band, the rate that minimises the cost restricted to that band."""
    edges = np.linspace(0, M.F, bands + 1).astype(int)
    costs = np.zeros((len(grid), bands))
    for gi, a in enumerate(grid):
        M.set_alpha(np.full(M.F, a))
        M.build()
        C = M.w * (M.V * np.log(M.V / M.Vh) - M.V + M.Vh)
        for b in range(bands):
            costs[gi, b] = C[edges[b]:edges[b + 1]].sum()
    best = np.array(grid)[np.argmin(costs, axis=0)]
    alpha = np.interp(np.arange(M.F), (edges[:-1] + edges[1:]) / 2, best)
    M.set_alpha(alpha)
    M.build()
    return alpha


def tilt_pass(M, grid=(-12, -8, -4, 0, 4, 8)):
    """Each stroke's brightness: the gain (dB) of the high shelf at 3x its note."""
    changed = 0
    for n in M.notes:
        best, bestd = n.get('tilt', 0), 0.0
        for tl in grid:
            if tl == n.get('tilt', 0):
                continue
            alt = dict(n)
            alt['tilt'] = tl
            d = swap_cost(M, [n], [alt])
            if d < bestd:
                best, bestd = tl, d
        if best != n.get('tilt', 0):
            alt = dict(n)
            alt['tilt'] = best
            apply(M, [n], [alt])
            n.update(alt)
            changed += 1
    return changed


def dyn_pass(M, dyns=('pp', 'mf', 'ff')):
    """Each stroke's take: the pp, mf and ff recordings differ in attack and partials."""
    changed = 0
    for n in M.notes:
        best, bestd = n['d'], 0.0
        for d_ in dyns:
            if d_ == n['d'] or (n['s'], n['f'], d_) not in M.T:
                continue
            alt = dict(n)
            alt['d'] = d_
            s0, s1 = note_span(M, alt)
            rest = M.Vh[:, s0:s1].copy()
            a, B = M.block(n)
            rest[:, a - s0:a - s0 + B.shape[1]] -= M.H * n['g'] * B
            alt['g'] = best_gain(M, alt, np.maximum(rest, M.noise), s0)
            d = swap_cost(M, [n], [alt])
            if d < bestd:
                best, bestd = (d_, alt['g']), d
        if best != n['d']:
            alt = dict(n)
            alt['d'], alt['g'] = best
            apply(M, [n], [alt])
            n.update(alt)
            changed += 1
    return changed


def candidate_positions(midi, open_strings, templates, dyn='mf', maxf=15):
    return [(s, midi - o) for s, o in open_strings.items()
            if 0 <= midi - o <= maxf and (s, midi - o, dyn) in templates]


def add_pass(M, onset_frames, open_strings, penalty, pitch_range=(40, 88), max_add=400,
             mute_options=(None, 8, 18)):
    """Matching pursuit: at every detected pluck, try each pitch on each free string (ringing
    or muted); add the best cost reductions beyond `penalty`, greedily."""
    trials = []
    for t in onset_frames:
        used = {n['s'] for n in M.notes if abs(n['t'] - t) < 3.5}
        have = {n['midi'] for n in M.notes if abs(n['t'] - t) < 3.5}
        for midi in range(*pitch_range):
            if midi in have:
                continue
            for s, f in candidate_positions(midi, open_strings, M.T):
                if s not in used:
                    trials.append((t, midi, s, f))
    scored = []
    for t, midi, s, f in trials:
        nxt = next_on_string(M, s, t)
        n = with_nat_end(dict(t=float(t), midi=midi, s=s, f=f, d='mf', g=0.0, damp=None), nxt['t'] if nxt else None)
        s0, s1 = note_span(M, n)
        p = prev_on_string(M, s, t)
        best_d, best_n = 0.0, None
        for mute in mute_options:
            cand = dict(n)
            cand['mute'] = mute
            cand['g'] = best_gain(M, cand, M.Vh[:, s0:s1], s0)
            if cand['g'] <= 1e-6:
                continue
            olds, news = ([p], [with_nat_end(p, float(t)), cand]) if p is not None else ([], [cand])
            d = swap_cost(M, olds, news)
            if d < best_d:
                best_d, best_n = d, cand
        if best_n is not None and best_d < -penalty:
            scored.append((best_d, best_n))
    scored.sort(key=lambda x: x[0])
    taken = []
    for _, n in scored:
        if len(taken) >= max_add:
            break
        # one note per string per pluck, and one of each pitch
        if any(abs(m['t'] - n['t']) < 3.5 and (m['s'] == n['s'] or m['midi'] == n['midi']) for m in taken):
            continue
        nxt = next_on_string(M, n['s'], n['t'])
        n = with_nat_end(n, nxt['t'] if nxt else None)
        s0, s1 = note_span(M, n)
        n['g'] = best_gain(M, n, M.Vh[:, s0:s1], s0)
        p = prev_on_string(M, n['s'], n['t'])
        olds, news = ([p], [with_nat_end(p, n['t']), n]) if p is not None else ([], [n])
        if swap_cost(M, olds, news) < -penalty:
            apply(M, olds, news)
            if p is not None:
                p.update(news[0])
            M.notes.append(n)
            taken.append(n)
    return len(taken)


def removal_move(M, n):
    """olds/news for taking n out: its predecessor on the string then rings to the next pluck."""
    p = prev_on_string(M, n['s'], n['t'], exclude=n)
    if p is not None and p.get('nat_end') == n['t']:
        return [n, p], [with_nat_end(p, n.get('nat_end'))]
    return [n], []


def removal_costs(M):
    return np.array([swap_cost(M, *removal_move(M, n)) for n in M.notes])


def string_move(M, n, s_new, f_new):
    """(old, new) pairs for moving n to another string: its predecessor on the old string
    now rings to the next pluck there, and its new neighbour is cut by it."""
    pairs = []
    p_old = prev_on_string(M, n['s'], n['t'], exclude=n)
    if p_old is not None and p_old.get('nat_end') == n['t']:
        nx = next_on_string(M, n['s'], n['t'], exclude=n)
        pairs.append((p_old, with_nat_end(p_old, nx['t'] if nx else None)))
    nx_new = next_on_string(M, s_new, n['t'], exclude=n)
    moved = dict(n)
    moved['s'], moved['f'] = s_new, f_new
    pairs.append((n, with_nat_end(moved, nx_new['t'] if nx_new else None)))
    p_new = prev_on_string(M, s_new, n['t'], exclude=n)
    if p_new is not None:
        pairs.append((p_new, with_nat_end(p_new, n['t'])))
    return pairs


def string_pass(M, open_strings, maxf=15, chord_frames=3.5, max_span=5, penalty=0.0):
    """Try every other string for each note. Simultaneous notes keep distinct strings and a
    playable fret span; a move is kept when it lowers the cost by more than `penalty`."""
    changed = 0
    for n in sorted(M.notes, key=lambda n: n['t']):
        group = [m for m in M.notes if m is not n and abs(m['t'] - n['t']) < chord_frames]
        best, bestd = None, -penalty
        for s, o in open_strings.items():
            f = n['midi'] - o
            if s == n['s'] or not 0 <= f <= maxf or (s, f, n['d']) not in M.T:
                continue
            if any(m['s'] == s for m in group):
                continue
            frets = [m['f'] for m in group if m['f'] > 0] + ([f] if f > 0 else [])
            if frets and max(frets) - min(frets) > max_span:
                continue
            pairs = string_move(M, n, s, f)
            d = swap_cost(M, [o for o, _ in pairs], [w for _, w in pairs])
            if d < bestd:
                best, bestd = (s, f), d
        if best is not None:
            pairs = string_move(M, n, *best)
            apply(M, [o for o, _ in pairs], [w for _, w in pairs])
            for old, new in pairs:
                old.update(new)
            changed += 1
    return changed
