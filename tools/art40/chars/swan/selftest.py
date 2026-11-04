#!/usr/bin/env python3
"""Checks of the Swan look sample (wave 1). Exit 1 on a failure.

    python3 tools/art40/chars/swan/selftest.py

- the colour budget (plan D1: at most 40 for the Swan sprite) for P1 and both P2 candidates;
- one outline: every pixel at the outer edge of a layer is the warm near-black K;
- the points: the seat stays at the contract's (-4, -48) within 2 px; the 9 muzzle points follow
  the game's aim steps (theta = +45 - 22.5 i, measured from the drum's hub) within 6 degrees;
- determinism: the same bytes in this process and in a process with another PYTHONHASHSEED;
- orphans (the art40-check rule): no edge pixel without an 8-neighbour of its own colour; single
  pixels inside the figure are material detail (info).
"""
import hashlib
import math
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ART40 = os.path.abspath(os.path.join(HERE, '..', '..'))
for p in (ART40, os.path.join(ART40, 'kit')):
    if p not in sys.path:
        sys.path.insert(0, p)
import art40  # noqa: E402

S = art40.char('swan')
B, PO, SP = S.B, S.PO, S.palette
SEAT_CONTRACT = (-4, -48)
LIMIT = 40


def digest():
    h = hashlib.sha256()
    for name in sorted(PO.POSES):
        for i in range(9):
            r = S.render(name, i)
            for k in 'bfn':
                h.update('\n'.join(r['rows'][k]).encode())
            h.update(repr(sorted((k, round(v[0], 3), round(v[1], 3)) for k, v in r['pts'].items())).encode())
    return h.hexdigest()


def main():
    if '--digest' in sys.argv:
        print(digest())
        return 0
    fails = []
    used = set()
    edge_bad = 0
    orphans = 0
    edge_orph = 0
    for name in PO.POSES:
        for i in range(9):
            r = S.render(name, i)
            for k, rows in r['rows'].items():
                h, w = len(rows), len(rows[0])
                for y, row in enumerate(rows):
                    for x, ch in enumerate(row):
                        if ch == '.':
                            continue
                        used.add(ch)
                        nb = [rows[y + dy][x + dx] if 0 <= x + dx < w and 0 <= y + dy < h else '.'
                              for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
                        if '.' in nb and ch != 'K':
                            edge_bad += 1
                        alone = all(not (0 <= x + dx < w and 0 <= y + dy < h) or rows[y + dy][x + dx] != ch
                                    for dx in (-1, 0, 1) for dy in (-1, 0, 1) if dx or dy)
                        if alone and '.' in nb:
                            edge_orph += 1
                        elif alone:
                            orphans += 1
            st = r['pts']['seat']
            if name.startswith('stand') and math.hypot(st[0] - SEAT_CONTRACT[0], st[1] - SEAT_CONTRACT[1]) > 2.0:
                fails.append(f'{name}: seat {st} is more than 2 px from the contract {SEAT_CONTRACT}')
            if name == 'stand0':
                hub = B.hub(B.Swan())
                m = r['pts']['muzzle']
                ang = math.degrees(math.atan2(m[1] - hub[1], m[0] - hub[0]))
                if abs(ang - B.AIM_DEG[i]) > 6:
                    fails.append(f'aim {i}: muzzle angle {ang:.1f} deg, the game step is {B.AIM_DEG[i]} deg')
    for v in (None, 'black'):
        pal = SP.colours(v)
        n = len({pal[c] for c in used})
        print(f'colours {v or "p1"}: {n} (budget {LIMIT})')
        if n > LIMIT:
            fails.append(f'{v or "p1"}: {n} colours > {LIMIT}')
    outl = {SP.PAL['K']}
    print(f'outline colours: {len(outl)} (K {SP.PAL["K"]}); edge pixels not K: {edge_bad}')
    if edge_bad:
        fails.append(f'{edge_bad} edge pixels are not the outline K')
    print(f'edge orphans: {edge_orph}; info: single pixels inside (material detail): {orphans} over '
          f'{len(PO.POSES) * 9} renders x 3 layers')
    if edge_orph:
        fails.append(f'{edge_orph} edge orphan pixels')
    d1 = digest()
    env = dict(os.environ, PYTHONHASHSEED='12345')
    d2 = subprocess.run([sys.executable, os.path.abspath(__file__), '--digest'], env=env, capture_output=True,
                        text=True, check=True).stdout.strip()
    print(f'digest {d1[:16]} / other hash seed {d2[:16]}')
    if d1 != d2 or d1 != digest():
        fails.append('the renders are not deterministic')
    for f in fails:
        print('FAIL', f)
    print('ok' if not fails else f'{len(fails)} failures')
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main())
