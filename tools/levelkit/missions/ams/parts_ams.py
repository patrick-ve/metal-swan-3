# Shared parts of level 1 (mission ams) in the canal look: the street furniture that every section has, painted
# at the sizes of the game's boxes, and `standard_decor`, which stands the game's common decor items and prop rows on
# the floor at their own x and depth. Section files add their set pieces on top.
import math
import random
import numpy as np
from level import *

# ---------------------------------------------------------------- parts


# The scenery scale (2026-11-11): buildings, trees and lamps are 13 px per metre at speed 1 (a storey = 40 px, as tall
# as the hero), times the speed of their plane. Street furniture beside the hero (posts, bikes, benches, racks,
# planters) keeps the hero's own scale. See SCALE-BRIEF.md.
ELM_W, ELM_H = 166, 218
LAMP_H, LAMP_GREY_H, FLAG_H = 72, 84, 96     # lamps: the game's own heights (street.py): a gull perches at 70 px


def elm(rng, w=ELM_W, h=ELM_H, seed=1, leaf='leaf'):
    """A quay elm, whole: a crown of w x 0.62 h on a trunk. Bottom centre = the foot."""
    L = Layer(w, h)
    ch = int(h * 0.66)
    tr = trunk(rng, h - ch // 2, max(7, round(7 * w / 104)), seed=seed)
    L.blit(tr, w / 2 - tr.w / 2, h - tr.h)
    cn = canopy(w, ch, R[leaf], seed, nb=11, rag=8, holes=0.14, spread=0.38)
    L.blit(cn, 0, 0)
    return L


def tulips(rng, w=30, h=20):
    """A planter of tulips: a wooden box with red, yellow and pink heads on green stems."""
    W = R['wood']; LF = R['leaf']
    L = Layer(w, h)
    bh = 8
    L.rect(0, h - bh, w, bh, W[3]); L.hl(0, h - bh, w, W[5]); L.vl(0, h - bh, bh, W[4]); L.vl(w - 1, h - bh, bh, W[1])
    for y in range(h - bh + 3, h, 3):
        L.hl(1, y, w - 2, W[2], t=TH)
    L.hl(0, h - 1, w, W[0])
    for i in range(int(w / 2.6)):
        tx = 1.5 + i * 2.6 + rng.uniform(-0.4, 0.4); ty = h - bh - 6 - rng.randint(0, 4)
        L.line(tx + 0.5, ty + 3, tx + 0.5 + rng.uniform(-0.6, 0.6), h - bh, LF[3], t=TH)
        if rng.random() < 0.5:
            L.line(tx + 0.5, h - bh - 1, tx + 2.5, h - bh - 4, LF[4], t=TH)
        T = R[rng.choice(['red', 'red', 'yellow', 'red', 'rose' if 'rose' in R else 'red'])]
        L.rect(tx - 0.5, ty, 2, 3, T[4]); L.px(tx - 0.5, ty, T[6]); L.px(tx + 1 - D1 * 0, ty + 2, T[2])
    return L


def flag_pole(kind='ams', h=64, phase=0):
    """A flag on a white pole. ams: red-black-red with three white crosses; nl: red-white-blue."""
    I = R['iron']; Wt = R['white']; Rd = R['red']; K = R['black']; Bl = R['blue']
    L = Layer(34, h)
    L.rect(1, 2, 2, h - 2, Wt[4]); L.vl(1, 2, h - 2, Wt[6]); L.vl(2, 2, h - 2, Wt[2], t=TH)
    L.ellipse(2, 1.5, 1.6, 1.4, R['yellow'][5])
    fw, fh = 29, 18
    for x in sub(0, fw):
        wave = math.sin((x / fw) * 5.2 + phase) * 1.2 * (x / fw)
        sh = math.cos((x / fw) * 5.2 + phase)
        for (y0, y1, col) in ((0, 6, 'top'), (6, 12, 'mid'), (12, 18, 'bot')):
            if kind == 'ams':
                C = Rd if col != 'mid' else K
            else:
                C = Rd if col == 'top' else (Wt if col == 'mid' else Bl)
            tone = 4 + (1 if sh > 0.5 else 0) - (1 if sh < -0.5 else 0)
            L.rect(3 + x, 4 + y0 + wave, D1, y1 - y0, C[tone])
    if kind == 'ams':
        for cxx in (12, 18, 24):
            yy = 13 + math.sin((cxx / fw) * 5.2 + phase) * 1.2 * (cxx / fw)
            L.line(cxx - 1.5, yy - 1.5, cxx + 1.5, yy + 1.5, Wt[6], t=TH * 1.4); L.line(cxx + 1.5, yy - 1.5, cxx - 1.5, yy + 1.5, Wt[6], t=TH * 1.4)
    L.rect(0, h - 2, 4, 2, I[2])
    return L


def bike_rack(rng, w=68, h=18, nbikes=3):
    """A front bike rack: a galvanised rail on two feet, bikes leaning in it (seen at the lower edge)."""
    I = R['iron']; St = R['stone']
    L = Layer(w, max(h, 27))
    H = L.h
    for i in range(nbikes):
        b = bike(rng, None, False)
        bx = 2 + i * (w - 44) / max(1, nbikes - 1)
        L.blit(b if i % 2 == 0 else b.flip(), bx, H - b.h)
    L.rect(1, H - 11, w - 2, 1.5, I[4]); L.hl(1, H - 11, w - 2, I[6], t=TH)
    for x in (2, w - 4):
        L.rect(x, H - 11, 1.5, 11, I[3]); L.vl(x, H - 11, 11, I[5], t=TH)
    L.hl(0, H - 1, w, R['black'][0])
    return L


def barrier_post(h=24):
    """The red-white striped post at a crossing or a bridge."""
    Rd = R['red']; Wt = R['white']
    L = Layer(5, h)
    for y in range(0, h - 2, 4):
        C = Rd if (y // 4) % 2 == 0 else Wt
        L.rect(1, y, 3, 4, C[4]); L.vl(1, y, 4, C[6]); L.vl(3, y, 4, C[2])
    L.rect(0, h - 2, 5, 2, R['iron'][2])
    return L


def amst_post(h=19):
    """The Amsterdammertje (the street post with three crosses). It stands on a kerb only."""
    return post(0, h)


# ---------------------------------------------------------------- the common decor of the game, stood on the floor

COMMON = ('decor/ams/elm', 'decor/ams/lamp', 'decor/ams/tulips', 'decor/ams/bench', 'decor/ams/bike', 'decor/ams/flag-ams',
          'decor/ams/flag-nl', 'decor/ams/bike-rack', 'decor/ams/smoke', 'decor/ams/lamp-grey')


def standard_decor(sec, rng, skip=(), leaf='leaf'):
    """Stand the game's common decor items (elms, lamps, tulips, benches, bikes, flags, bike racks, smoke) at their x
       and floor depth, and the prop rows of posts. Items with depth None are hidden on the game's floor and stay
       hidden. Returns the items it did NOT handle (the section's set pieces)."""
    rest = []
    for d in sec.L['decor']:
        sid = d['sprite']; dep = d['floorDepth']
        if dep is None or sid in skip or not any(sid == c or (sid.startswith(c) and c in ('decor/ams/bike-rack',)) for c in COMMON):
            rest.append(d)
            continue
        x = d['x']
        base = None if d['y'] >= 175 else d['y']
        if sid == 'decor/ams/elm':
            p = elm(rng, ELM_W, ELM_H, seed=int(x) + 3, leaf=leaf)
        elif sid == 'decor/ams/lamp':
            p = lamp(LAMP_H)
        elif sid == 'decor/ams/lamp-grey':
            p = lamp(LAMP_GREY_H)
        elif sid == 'decor/ams/tulips':
            p = tulips(rng)
        elif sid == 'decor/ams/bench':
            p = bench()
        elif sid == 'decor/ams/bike':
            p = bike(rng)
        elif sid in ('decor/ams/flag-ams', 'decor/ams/flag-nl'):
            p = flag_pole('ams' if sid.endswith('ams') else 'nl', FLAG_H, phase=x * 0.01)
            sec.put(p, x - 2 + 1, dep, ax=1, base=base)
            continue
        elif sid == 'decor/ams/bike-rack':
            p = bike_rack(rng)
        elif sid == 'decor/ams/smoke':
            p = smoke(20, 40, int(x))
            sec.put(p, x, dep, base=d['y'], shade=False)
            continue
        else:
            rest.append(d)
            continue
        sec.put(p, x, dep, base=base)
    # the prop rows: posts on the kerbs, barrier posts
    for r in sec.L['floor']['rows'] or []:
        if r.get('prop') == 'ams/pole':
            for x in row_at(sec, r):
                sec.put(amst_post(19), x, r['depth'], shade=True)
        elif r.get('prop') == 'ams/barrier-post':
            for x in row_at(sec, r):
                sec.put(barrier_post(24), x, r['depth'])
    return rest


def row_at(sec, r):
    """The u positions of a prop row: its list, or every `spacing` from u0 + offset to u1, outside its gaps."""
    if r.get('at'):
        return list(r['at'])
    u0 = r.get('u0', 0); u1 = r.get('u1', sec.W)
    xs = []
    x = u0 + r.get('offset', 0)
    while x < u1 and r.get('spacing'):
        if not any(a <= x <= b for (a, b) in (r.get('gaps') or [])):
            xs.append(x)
        x += r['spacing']
    return xs
