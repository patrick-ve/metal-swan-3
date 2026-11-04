# The palette of a hero set: the kit palette (rig.PAL after hero.load: each hero recolours it) cut to
# the plan's budget of 28 colours (decision D1) over EVERY strip of the set, one palette for all.
#
# - FX letters (the shared FX ramp, outside the budget): the muzzle sparks, the slash arcs, the
#   smoke wisps (D / d, recoloured to the ramp's cream and warm grey), the burn flames.
# - Merges (deterministic): the burn soot letters 0 1 2 into the nearest dark body colour, then the
#   closest pair of colours (weighted by how rarely the rarer one is used) until 28 remain. The
#   merges are printed by bake --list and logged in the set's report.
import math

import rig

FX_LETTERS = 'FfceWIimyDd'
FX_COLOURS = {'D': '#fffbd8', 'd': '#7a6e70'}
HL = 'w'
BUDGET = 28
LAST = {}          # the last reduce(): merges and the colour count (for reports)


def colours():
    pal = dict(rig.PAL)
    pal.update(FX_COLOURS)
    return pal


def _rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def dist(a, b):
    """Red-mean weighted RGB distance (cheap and good enough for picking twins)."""
    (r1, g1, b1), (r2, g2, b2) = _rgb(a), _rgb(b)
    rm = (r1 + r2) / 2
    dr, dg, db = r1 - r2, g1 - g2, b1 - b2
    return math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db)


def reduce(frames, budget=BUDGET):
    """The letter map (str.maketrans) that brings the set's body colours to the budget."""
    pal = colours()
    count = {}
    for f in frames:
        for r in f.rows:
            for ch in r:
                if ch != '.' and ch not in FX_LETTERS:
                    count[ch] = count.get(ch, 0) + 1
    merge = {}

    def target(ch):
        while ch in merge:
            ch = merge[ch]
        return ch

    letters = sorted(count)
    # soot: into the nearest dark body colour
    for ch in [c for c in letters if c in '012']:
        cands = [c for c in letters if c not in '012']
        best = min(cands, key=lambda c: (dist(pal[ch], pal[c]), c))
        merge[ch] = best

    def groups():
        g = {}
        for ch in letters:
            t = target(ch)
            g.setdefault(pal[t], set()).add(t)
        return g

    while True:
        live = sorted({target(c) for c in letters})
        by_col = {}
        for c in live:
            by_col.setdefault(pal[c], []).append(c)
        if len(by_col) <= budget:
            break
        n = {c: sum(count[x] for x in letters if target(x) == c) for c in live}
        best = None
        for i, a in enumerate(live):
            for b in live[i + 1:]:
                if pal[a] == pal[b]:
                    continue
                lo, hi = (a, b) if (n[a], a) < (n[b], b) else (b, a)
                if lo == 'K':
                    lo, hi = hi, lo
                cost = dist(pal[a], pal[b]) * math.sqrt(n[lo])
                key = (cost, lo, hi)
                if best is None or key < best:
                    best = key
        _, lo, hi = best
        merge[lo] = hi
    flat = {c: target(c) for c in merge}
    LAST.clear()
    LAST.update(merges={k: v for k, v in sorted(flat.items())},
                colours=len({pal[target(c)] for c in letters}))
    return str.maketrans(flat)
