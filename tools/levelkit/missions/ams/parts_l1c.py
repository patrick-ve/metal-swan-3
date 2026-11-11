# Parts of level 1, sections c (AMSTEL) and c1 (BRUG), golden late afternoon, in the canal look.
# Daylight first, ramps only; the planes are graded with the golden key when they are flushed.
#
# New machinery (copied from level.py and changed here, see the report):
#   surfaces()  horizontal surfaces raised over (or sunk under) the floor -- bridge decks, ramps, the Blauwbrug's hump,
#               the pontoon -- painted as one-depth slices into the depth planes, so every depth scrolls at its own
#               speed as on the game's floor;
#   flush_l1()  Sec.flush with two changes: layers over the hero come after all layers under him, and the planes
#               (except the walk plane, which the gates read at y 0) are cropped to their rows.
import math
import random
import numpy as np
from parts_ams import *

FONT.setdefault('V', ["101", "101", "101", "101", "010"])
FONT.setdefault('Y', ["101", "101", "010", "010", "010"])

R['deck'] = ramp(7, .25, .80, .016, .030, .036, 40, 84)          # weathered oak planks, grey-brown
R['granite'] = ramp(7, .26, .84, .012, .020, .026, 262, 92)      # blue-grey granite of the Blauwbrug and the steps
R['hull'] = ramp(7, .12, .52, .010, .018, .016, 250, 220)         # black steel hulls
R['teal'] = ramp(7, .20, .70, .030, .060, .050, 220, 170)
R['sandstone'] = ramp(7, .28, .86, .020, .036, .040, 45, 70)  # warm Bentheimer sandstone: the jetty steps of the fork


def ri(v):
    return int(math.floor(v + 0.5))


# ---------------------------------------------------------------- the scenery scale (SCALE-BRIEF.md, 2026-11-11)
# Buildings and the scenery that stands with them are 13 px per metre times the speed s of their plane: a storey is
# 40 s px, a ground floor 54 s, a window 14 s wide. The painters below take the plane's px per metre (m = 13 s) and
# note what they paint in SCALE, which the section checks read (reset at the start of each build).
PPM = 13.0
SCALE = {}
LANDMARKS = []


def ppm(s):
    return PPM * s


def note_scale(key, val):
    SCALE.setdefault(key, []).append(float(val))


def note_landmark(name, metres, s, px):
    LANDMARKS.append((name, metres, s, px))


def reset_scale():
    SCALE.clear()
    del LANDMARKS[:]


# real sizes of the scenery (metres): (low, high)
REAL_M = {'tree': (14.0, 18.0), 'lamp': (4.5, 5.0), 'car': (4.0, 5.0), 'bike': (1.7, 1.9), 'house': (15.0, 20.0),
          'tour': (20.0, 25.0), 'sloop': (5.0, 7.0), 'barge': (18.0, 30.0)}


def scale_checks(planes):
    """The checks of the scale rule from what the painters noted: one entry per building plane (the mean storey and
       its spread against 40 s +-15 %), one per plane for its trees, lamps, cars, bikes and boats in metres, one per
       landmark. planes: [(plane id, speed s, note prefix)]."""
    out = []
    for (pid, s, key) in planes:
        v = SCALE.get(key + ' storey', [])
        tgt = 40.0 * s
        ok = bool(v) and all(abs(x - tgt) <= 0.15 * tgt for x in v)
        mean = sum(v) / len(v) if v else 0.0
        out.append(('storey on %s (s=%.2f): %.1f px, target %.1f +-15%%' % (pid, s, mean, tgt), ok,
                    '%.1f..%.1f px, %d fronts' % (min(v), max(v), len(v)) if v else 'none'))
        got = []
        okm = True
        for kind in ('tree', 'lamp', 'car', 'bike'):
            vv = SCALE.get('%s %s m' % (key, kind), [])
            if vv:
                lo, hi = REAL_M[kind]
                okm &= all(lo - 0.25 <= x <= hi + 0.25 for x in vv)
                got.append('%s %.1f-%.1f m' % (kind, min(vv), max(vv)))
        for kind in ('house', 'tour', 'sloop', 'barge'):
            vv = SCALE.get('%s boat %s m' % (key, kind), [])
            if vv:
                lo, hi = REAL_M[kind]
                okm &= all(lo - 0.25 <= x <= hi + 0.25 for x in vv)
                got.append('%s boat %.1f-%.1f m' % (kind, min(vv), max(vv)))
        if got:
            out.append(('scenery on %s (s=%.2f, %.1f px/m) in real sizes' % (pid, s, ppm(s)), okm, ', '.join(got)))
    for (name, metres, s, px) in LANDMARKS:
        tgt = metres * ppm(s)
        out.append(('%s %g m at s=%.2f: %d px' % (name, metres, s, px), abs(px - tgt) <= max(1.0, 0.05 * tgt), '%.0f px by the rule' % tgt))
    return out


def thin(v):
    """A stroke of v logical px that never vanishes: one real pixel at least (a whole pixel at tier 1)."""
    return max(1.0 if U == 1 else D1, v)


SHOPS_C = [('KAAS', 'yellow'), ('BLOEM', 'green'), ('BOEK', 'blue'), ('FIETS', 'blue'), ('TABAK', 'green'), ('KOFFIE', 'red')]


def house_row_m(L, x0, x1, yb, rng, s, nfs=(2, 3, 3), kinds=None, shops=0.16, seed=100, key='far'):
    """The kit's house_row at the scenery scale of a plane of speed s: sc = 2 s, widths 60 s .. 92 s, and each body
       as tall as its ground floor plus nf upper storeys of exactly 40 s (house() spreads the room over q(room / 20 sc)
       floors, so the room is set to nf storeys). Notes the storey of every house under key + ' storey'."""
    sc = 2.0 * s
    kinds = kinds or ['neck', 'neck', 'bell', 'bell', 'step', 'spout', 'cornice', 'cornice']
    wmin, wmax = ri(60 * s), ri(92 * s)
    gf = ri(27 * sc)
    infos = []
    x, last, i = x0, None, 0
    while x < x1:
        w = rng.randint(wmin, wmax)
        if x1 - (x + w) < wmin * 0.6:
            w = x1 - x
        kind = rng.choice(kinds)
        brick = rng.choice([b for b in BRICKS if b != last])
        last = brick
        nf = rng.choice(nfs)
        top = 3 if kind in ('neck', 'bell') else 2
        hb = int(round(gf + top + nf * 20 * sc))
        shop = rng.choice(SHOPS_C) if (rng.random() < shops and w >= 36 * sc) else None
        H, info = house(rng, w, hb, kind, brick, trim='plaster' if rng.random() < 0.8 else 'stone',
                        doorc=rng.choice(['green', 'green', 'black', 'red', 'blue']), sc=sc, shop=shop, seed=seed + i * 7)
        note_scale(key + ' storey', (hb - gf - top) / nf)
        note_scale(key + ' width', w)
        L.blit(H, x, yb - H.h)
        info['x'] = x; info['y'] = yb - H.h
        infos.append(info)
        x += w
        i += 1
    return infos


def tree_m(rng, m, hm=16.0, leaf='leaf', seed=1, bare=0.0, key=None):
    """A quay elm hm metres tall at m px per metre (the kit's tree_far: crown 0.56, trunk 0.44 of the height)."""
    H = hm * m
    ch = ri(H * 0.56); th = ri(H) - ch; cw = ri(H * 0.62)
    if key:
        note_scale(key, (ch + th) / m)
    return tree_far(rng, cw, ch, th, leaf=leaf, seed=seed, bare=bare, tw=max(2, ri(0.45 * m)))


def car_m(rng, m, c=None, key=None):
    """A parked car (4.0-4.5 x 1.5 m) or a van (4.9 x 2.0 m) at m px per metre, seen from the side, nose right."""
    C = R[c or rng.choice(['red', 'blue', 'white', 'black', 'iron', 'green', 'yellow', 'white'])]
    G = R['glass']; K = R['black']
    van = rng.random() < 0.18
    lm = 4.9 if van else rng.uniform(4.0, 4.5)
    w = ri(lm * m); h = ri((2.0 if van else 1.48) * m)
    if key:
        note_scale(key, w / m)
    L = Layer(w + 1, h + 1)
    yb = h
    r = 0.33 * m
    sill = 0.30 * m
    if van:
        cab = 1.0 * m
        L.rect(0, 0, w - cab, yb - sill, C[4])
        L.poly([(w - cab, 0), (w - cab * 0.45, 0.55 * m), (w, 1.05 * m), (w, yb - sill), (w - cab, yb - sill)], C[4])
        L.poly([(w - cab + 0.12 * m, 0.18 * m), (w - cab * 0.5, 0.62 * m), (w - cab + 0.12 * m, 0.62 * m)], G[2])
        L.rect(w - cab - 1.0 * m, 0.25 * m, 0.7 * m, 0.45 * m, G[1])
        L.hl(0, 0, w - cab, C[6]); L.vl(0, 0, yb - sill, C[5])
        L.hl(0, yb - sill - thin(0.2 * m), w, C[2])
    else:
        lo = 0.88 * m
        L.rect(0.1 * m, yb - lo, w - 0.2 * m, lo - sill, C[4])
        L.poly([(0.85 * m, yb - lo), (w - 1.15 * m, yb - lo), (w - 1.75 * m, 0), (1.3 * m, 0)], C[4])
        L.poly([(1.02 * m, yb - lo), (w - 1.38 * m, yb - lo), (w - 1.85 * m, 0.16 * m), (1.42 * m, 0.16 * m)], G[2])
        L.vl(w * 0.5, 0.16 * m, h - lo - 0.16 * m, C[3], t=thin(0.12 * m))
        L.hl(1.3 * m, 0, w - 3.05 * m, C[6])
        L.hl(0.1 * m, yb - lo, w - 0.2 * m, C[5])
        L.hl(0.1 * m, yb - sill - thin(0.18 * m), w - 0.2 * m, C[2])
        L.px(0.1 * m, yb - lo + 0.2 * m, R['red'][5])
    L.px(w - 1, yb - 0.75 * m, R['yellow'][6])
    for wx in (0.9 * m, w - 0.9 * m):
        L.ellipse(wx, yb - r, r, r, K[1]); L.ellipse(wx, yb - r, r * 0.42, r * 0.42, K[4])
    L.hl(0.2 * m, yb, w - 0.4 * m, K[0])
    return L


def bike_m(rng, m, c=None, key=None):
    """A parked bicycle (1.8 x 1.05 m) at m px per metre."""
    I = R['iron']; C = R[c or rng.choice(['black', 'red', 'blue', 'green', 'iron', 'white'])]
    w, h = 1.8 * m, 1.05 * m
    if key:
        note_scale(key, w / m)
    L = Layer(ri(w) + 1, ri(h) + 1)
    r = 0.34 * m
    y = h - r
    t = 1 if U == 1 else max(0.5, 0.06 * m)
    for cx in (r, w - r):
        L.ring(cx, y, r, I[1], r - (1 if U == 1 else max(0.5, 0.08 * m)))
    A, F = (r, y), (w - r, y)
    B = (0.45 * w, y); S = (0.36 * w, h - 0.9 * m); Hd = (w - r - 0.1 * m, h - 0.88 * m)
    for (p, q, cc) in ((A, B, C[2]), (A, S, C[3]), (B, S, C[3]), (S, Hd, C[3]), (B, Hd, C[2]), (Hd, F, C[3])):
        L.line(p[0], p[1], q[0], q[1], cc, t)
    L.hl(S[0] - 0.12 * m, S[1] - thin(0.08 * m), thin(0.3 * m), I[0])
    L.hl(Hd[0] - 0.1 * m, Hd[1] - thin(0.12 * m), thin(0.3 * m), I[1])
    if rng.random() < 0.3:
        L.rect(F[0] - 0.2 * m, Hd[1] - 0.05 * m, thin(0.35 * m), thin(0.22 * m), R['wood'][3])
    return L


def lamp_m(m, hm=4.8, lit=False, key=None):
    """A quay lamp hm metres tall at m px per metre: a slim iron post, a base, a lantern with a cap."""
    I = R['iron']; G = R['glass']
    h = ri(hm * m)
    if key:
        note_scale(key, h / m)
    w = max(3, ri(0.7 * m))
    L = Layer(w, h)
    cx = w / 2.0
    pw = thin(0.14 * m)
    L.rect(cx - pw / 2, 0.9 * m, pw, h - 0.9 * m, I[2])
    bw = thin(0.34 * m)
    L.rect(cx - bw / 2, h - 0.6 * m, bw, 0.6 * m, I[1])
    lw_ = thin(0.46 * m); lh = thin(0.62 * m)
    L.rect(cx - lw_ / 2, 0.24 * m, lw_, lh, EM[0] if lit else G[5])
    L.rect(cx, 0.24 * m, lw_ / 2, lh, EM[1] if lit else G[3])
    cw_ = thin(0.66 * m)
    L.rect(cx - cw_ / 2, 0.1 * m, cw_, thin(0.16 * m), I[2])
    L.rect(cx - pw / 2, 0, pw, thin(0.12 * m), I[3])
    return L


def houseboat_m(rng, w, m, c=None):
    """A far houseboat (ark) w px long at m px per metre: a black hull of 0.9 m, a boarded cabin of 2.0 m with
       windows, a flat roof with plants and a stove pipe. Bottom row = 0.2 m under the water line."""
    C = R[c or rng.choice(['white', 'green', 'blue', 'wood', 'brick_ochre', 'canvas'])]
    K = R['black']; G = R['glass']; T = R['white']; S = R['stone']; LF = R['leaf']; I = R['iron']
    hull, cab, roof = 0.9 * m, 2.0 * m, 0.3 * m
    H = ri(hull + cab + roof + 0.7 * m) + 1
    L = Layer(w, H)
    yh = H - hull - 0.2 * m
    L.rect(0, yh, w, H - yh, K[1]); L.hl(0, yh, w, K[3]); L.hl(0, yh + thin(0.3 * m), w, R['wood'][3], t=thin(0.15 * m))
    x0 = 0.25 * m
    x1 = w - 0.25 * m - (rng.uniform(1.2, 2.4) * m if rng.random() < 0.6 else 0)
    yc = yh - cab
    L.rect(x0, yc, x1 - x0, cab, C[4])
    for xx in np.arange(x0 + 0.6 * m, x1 - 0.3 * m, 0.65 * m):
        L.vl(xx, yc + 0.2 * m, cab - 0.3 * m, C[3], t=TH)
    L.vl(x0, yc, cab, C[5]); L.vl(x1 - thin(0.2 * m), yc, cab, C[2]); L.hl(x0, yh - thin(0.2 * m), x1 - x0, C[2])
    L.rect(x0 - 0.15 * m, yc - roof, x1 - x0 + 0.3 * m, roof, S[5]); L.hl(x0 - 0.15 * m, yc, x1 - x0 + 0.3 * m, S[2], t=thin(0.12 * m))
    xx = x0 + 0.5 * m
    while xx < x1 - 1.4 * m:
        if rng.random() < 0.16:
            L.rect(xx, yc + 0.35 * m, 0.7 * m, cab - 0.35 * m, T[5]); L.rect(xx + 0.15 * m, yc + 0.5 * m, 0.4 * m, cab - 0.5 * m, R[rng.choice(['red', 'green', 'blue'])][3])
            xx += 1.2 * m
            continue
        ww = rng.choice([0.9, 1.2, 1.2, 1.5]) * m
        L.rect(xx, yc + 0.45 * m, ww, 0.95 * m, T[5]); L.rect(xx + thin(0.15 * m), yc + 0.45 * m + thin(0.15 * m), ww - 2 * thin(0.15 * m), 0.95 * m - 2 * thin(0.15 * m), G[1])
        L.px(xx + thin(0.15 * m), yc + 0.45 * m + thin(0.15 * m), G[4])
        if rng.random() < 0.35:
            for fx in np.arange(xx, xx + ww, 0.5 * m):
                L.px(fx, yc + 1.45 * m, (R['red'] if rng.random() < 0.6 else R['yellow'])[5])
        xx += ww + rng.uniform(0.5, 1.0) * m
    for i in range(rng.randint(2, 4)):
        px_ = rng.uniform(x0 + 0.4 * m, x1 - 0.8 * m)
        L.rect(px_, yc - roof - 0.35 * m, thin(0.5 * m), thin(0.35 * m), R['roof_tile'][3]); L.hl(px_, yc - roof - 0.6 * m, thin(0.5 * m), LF[4])
    cx_ = rng.uniform(x0 + 0.8 * m, x1 - 0.8 * m)
    L.rect(cx_, 0, thin(0.14 * m), yc - roof, I[2]); L.hl(cx_ - 0.1 * m, 0, thin(0.36 * m), I[3])
    return L


def barge_m(rng, w, m, c=None):
    """An old sailing barge moored as a home, w px long at m px per metre: a black hull of 1.4 m with its sheer,
       canvas hatch covers, a wheelhouse of 2.0 m aft, the lowered mast. Bottom row = 0.2 m under the water line."""
    K = R['black']; T = R['white']; W = R['wood']; G = R['glass']; I = R['iron']
    CV = R[c or rng.choice(['green', 'canvas', 'blue'])]
    hull = 1.4 * m
    H = ri(hull + 2.3 * m + 0.4 * m) + 1
    L = Layer(w, H)
    yb = H
    for x in sub(0, w):
        t = min(1.0, x / max(w - 1, 1))
        sheer = 0.45 * m * (2 * t - 1) ** 2
        e = min(x, w - 1 - x)
        cut = 0.5 * m * max(0.0, 1 - (e + D1) / (1.4 * m)) ** 1.6
        top = yb - hull - 0.2 * m - sheer
        L.rect(x, top, D1, yb - cut - top, K[1])
        L.rect(x, top, D1, thin(0.15 * m), T[5])
        L.rect(x, top + 0.45 * m, D1, thin(0.12 * m), R['red'][2])
    yd = yb - hull - 0.2 * m
    hx0, hx1 = 1.8 * m, w - 4.4 * m
    if hx1 > hx0:
        L.rect(hx0, yd - 0.7 * m, hx1 - hx0, 0.7 * m, CV[3]); L.hl(hx0, yd - 0.7 * m, hx1 - hx0, CV[5])
        for xx in np.arange(hx0 + 1.0 * m, hx1, 1.5 * m):
            L.vl(xx, yd - 0.7 * m, 0.7 * m, CV[2], t=TH)
    wx = w - 4.0 * m
    L.rect(wx, yd - 2.0 * m, 2.4 * m, 2.0 * m, W[4]); L.hl(wx - 0.1 * m, yd - 2.0 * m, 2.6 * m, T[6], t=thin(0.15 * m))
    for i in range(3):
        L.rect(wx + 0.2 * m + i * 0.75 * m, yd - 1.6 * m, thin(0.5 * m), thin(0.6 * m), G[1])
    L.vl(1.2 * m, yd - 2.3 * m, 2.3 * m, W[2], t=thin(0.18 * m))
    L.line(1.2 * m, yd - 2.0 * m, hx1 - 0.5 * m, yd - 0.9 * m, W[3], t=TH)
    L.vl(w - 0.9 * m, yd - 1.3 * m, 1.3 * m, I[2], t=TH); L.rect(w - 1.5 * m, yd - 1.3 * m, 0.55 * m, 0.4 * m, R['red'][4])
    return L


def tourboat_m(rng, w, m):
    """A far canal cruiser w px long at m px per metre: a white hull of 1.0 m with a blue band, a glass cabin of
       1.4 m with white ribs, the wheelhouse at the bow. Bottom row = 0.2 m under the water line."""
    T = R['white']; G = R['glass']; B = R['blue']; K = R['black']
    H = ri(2.6 * m) + 1
    L = Layer(w, H)
    yb = H
    for x in sub(0, w):
        e = min(x, w - 1 - x)
        cut = 0.5 * m * max(0.0, 1 - (e + D1) / (1.6 * m)) ** 1.5
        top = yb - 1.2 * m
        L.rect(x, top, D1, yb - cut - top, T[5]); L.rect(x, top, D1, thin(0.12 * m), T[6])
        L.rect(x, top + 0.4 * m, D1, thin(0.25 * m), B[3]); L.rect(x, yb - cut - thin(0.3 * m), D1, thin(0.3 * m), K[2])
    yc = yb - 1.2 * m
    cx0, cx1 = 2.0 * m, w - 4.0 * m
    L.rect(cx0, yc - 1.3 * m, cx1 - cx0, 1.3 * m, G[2]); L.hl(cx0, yc - 1.3 * m, cx1 - cx0, T[6], t=thin(0.12 * m))
    L.hl(cx0, yc - 1.1 * m, cx1 - cx0, G[5], t=thin(0.15 * m))
    for xx in np.arange(cx0, cx1, 1.6 * m):
        L.vl(xx, yc - 1.3 * m, 1.3 * m, T[5], t=TH)
    L.rect(cx1 + 0.3 * m, yc - 1.0 * m, 1.4 * m, 1.0 * m, T[5]); L.rect(cx1 + 0.5 * m, yc - 0.85 * m, 0.9 * m, 0.45 * m, G[1])
    return L


def far_roofs_m(L, x0, x1, yb, rng, s, key='skyline'):
    """A band of small far house fronts at the scenery scale of speed s: a ground floor of 54 s and 3-5 storeys of
       40 s, 60 s .. 92 s wide, a gable, rows of window dots. It takes most of the air."""
    st, gf = 40.0 * s, 54.0 * s
    x = x0
    while x < x1:
        w = rng.randint(ri(60 * s), ri(92 * s)) + (rng.randint(2, 5) if rng.random() < 0.15 else 0)
        nf = rng.randint(3, 5)
        h = ri(gf + nf * st)
        note_scale(key + ' storey', st)
        B = R[rng.choice(BRICKS)]
        L.rect(x, yb - h, w, h, B[3]); L.vl(x, yb - h, h, B[4]); L.vl(x + w - 1, yb - h, h, B[2])
        k = rng.choice(['tri', 'step', 'flat', 'tri'])
        if k == 'tri':
            for i in sub(0, w // 2):
                L.rect(x + w // 2 - i, yb - h - (w // 2 - i), 2 * i + (w % 2), D1, B[3]); L.rect(x + w // 2 - i, yb - h - (w // 2 - i), 1, D1, R['plaster'][5])
        elif k == 'step':
            L.rect(x + 1, yb - h - 2, w - 2, 2, B[3]); L.rect(x + 2, yb - h - 4, max(1, w - 4), 2, B[3]); L.hl(x + 1, yb - h - 2, w - 2, R['plaster'][5])
        else:
            L.hl(x, yb - h, w, R['plaster'][5]); L.rect(x + 1, yb - h - 2, w - 2, 2, R['roof_slate'][3])
        for f in range(nf):
            wy = yb - gf - (f + 1) * st + 1
            for wx in range(x + 1, x + w - 1, 2):
                L.vl(wx, wy, 2, R['glass'][1])
        for wx in range(x + 1, x + w - 1, 3):
            L.vl(wx, yb - gf + 1, 3, R['glass'][0])
        x += w


def skyline_m(sec, speed=0.10, yb=112, extra=None, seed=5, air=0.72):
    """level.skyline_layer at the scenery scale (far_roofs_m instead of the kit's far_roofs)."""
    W1 = sec.lw(speed)
    SK = Layer(W1, VIEW_H)
    far_roofs_m(SK, 0, W1, yb, random.Random(seed), speed)
    if extra:
        extra(SK)
    SK.recolor(grader(key=sec.KEY, air=(sec.AIR[0], sec.AIR[1], air, 0.5)))
    sec.add('skyline', SK, speed)
    return SK


def landmark_tower(SK, x, hm, s, yb=112, key='church tower'):
    """A church tower (the kit's tower) hm metres tall on the skyline plane, its foot on the roofs' foot line."""
    h = ri(hm * ppm(s))
    note_landmark(key, hm, s, h)
    SK.blit(tower(h), x, yb - h)


def far_bank_m(F, rng, YH, YQ, YW, s, trees=None, nfs=(2, 3, 3), boats=(), seed=100, cars=0.5, bikes=0.55, lamp_step=None,
               kinds=None):
    """sets.far_bank (without the side canal) at the scenery scale of speed s: the house row, the street, elms of
       14-18 m with their shade on the fronts, parked cars and bikes, lamps of 4.8 m, the quay wall, moored boats
       (the kit's far boats are drawn at about 6.2 px per metre: right for s ~0.48)."""
    m = ppm(s)
    WF = F.w
    house_row_m(F, 0, WF, YH, rng, s, nfs=nfs, seed=seed, key='far', kinds=kinds)
    tr = dict(trees or {})
    tl = []
    x = tr.get('x0', 30)
    while x < WF - 20:
        t = tree_m(rng, m, rng.uniform(*tr.get('hm', (14.0, 18.0))), leaf=tr.get('leaf', 'leaf'), seed=rng.randint(1, 999),
                   key='far tree m')
        tl.append((x - t.w // 2, YQ - t.h, t))
        x += rng.randint(*tr.get('step', (120, 180)))
    k = m / 6.24
    for (tx, ty, t) in tl:                                          # the trees' shade on the fronts
        msk = np.zeros((F.ph, F.pw), bool)
        cm = t.mask()
        yy0, xx0 = PX(ty + 9 * k), PX(tx + 8 * k)
        h_, w_ = cm.shape
        x1_ = min(F.pw, xx0 + w_); y1_ = min(PX(YH), yy0 + h_)
        if x1_ > max(0, xx0) and y1_ > yy0:
            msk[yy0:y1_, max(0, xx0):x1_] = cm[:y1_ - yy0, max(0, -xx0):x1_ - xx0]
        shade(F, msk)
    far_street(F, 0, WF, YH, YQ, rng, 1)
    xb = 6
    while xb < WF - 12:                                             # bikes against the fronts
        if rng.random() < bikes:
            b = bike_m(rng, m, key='far bike m')
            F.blit(b, xb, YH + 1 - b.h + 1)
        xb += rng.randint(ri(5 * m), ri(9 * m))
    x = 8
    while x < WF - 20:
        r_ = rng.random()
        if r_ < cars:
            c = car_m(rng, m, key='far car m'); F.blit(c, x, YQ - c.h + 1); x += c.w + rng.randint(3, 12)
        elif r_ < cars + 0.25:
            for j in range(rng.randint(1, 4)):
                b = bike_m(rng, m, key='far bike m'); F.blit(b, x, YQ - b.h + 1); x += b.w * 0.75
            x += 4
        else:
            x += rng.randint(6, 16)
    for lx in range(22, WF, lamp_step or ri(15 * m)):
        lp = lamp_m(m, 4.8, key='far lamp m')
        F.blit(lp, lx, YQ - lp.h + 1)
    for (tx, ty, t) in tl:
        F.blit(t, tx, ty)
    bollards_far(F, 0, WF, YQ + 1, rng)
    quay_wall(F, 0, YQ, WF, YW - YQ, rng, 7)
    for (kind, bx, arg) in boats:
        if kind == 'house':
            b, wins = houseboat(rng, arg[0], arg[1]); by = YW - b.h + 2
        elif kind == 'barge':
            b, wins = barge(rng, arg[0], arg[1] if len(arg) > 1 else None); by = YW - b.h + 3
        elif kind == 'tour':
            b = tourboat(rng, arg[0]); by = YW - b.h + 2
        else:
            b = sloop(rng, arg[0], arg[1]); by = YW - 7
        note_scale('far boat %s m' % kind, arg[0] / m)
        F.blit(b, bx, by)
    F.clear(0, YW + 1, F.w, F.h)


def canal_far_m(sec, rng, YH=110, YQ=115, YW=120, speed=0.5, boats=(), trees=None, nfs=(2, 3, 3), air=0.25, seed=100):
    """level.canal_far at the scenery scale (far_bank_m)."""
    F = Layer(sec.lw(speed), VIEW_H)
    far_bank_m(F, rng, YH, YQ, YW, speed, trees=trees, nfs=nfs, boats=boats, seed=seed)
    F.recolor(grader(key=sec.KEY, air=(sec.AIR[0], sec.AIR[1], air, 0.30)))
    F.clear(0, YW + 1, F.w, F.h)
    sec.add('far', F, speed)
    return F


# ---------------------------------------------------------------- machinery
def place(sec, part, xl, depth, ytop, front=False, flip=False):
    """Stand a part with its left edge at world x and its top at the world y it has on the walk line (raised or sunk
       things: the drop to the floor shrinks with the depth). No floor shade."""
    if flip:
        part = part.flip()
    sec.put(part, xl + part.w / 2, depth, base=ytop + part.h, shade=False, front=front)


def place_a(sec, part, xl, depth, ay, ybase, front=False):
    """Place a part whose row ay is the anchor at world y ybase (on the walk line) at depth `depth`."""
    Lp, k = sec.plane(depth, front)
    sp = s_d(k)
    yb = (GY - k) - (GY - ybase) * sp
    Lp.blit(part, sec.at(xl, sp), yb - ay)
    return k


def game_entity(sec, sprite_id, part, page, frames=(0,), ax=None, ay=None):
    """A thing the game draws as an ENTITY (docs/api/canal.md §7): on the page `page()` paints it as before; in a game
       bake it is left out of the scene and recorded as the canal sprite `sprite_id` (frames), with the painting point
       (ax, ay) on the game frame's anchor (game_sprites.entity, with an anchor row for parts that do not stand on the
       floor: a boat's water line or gunwale). One picture per id and frame: a later offer of the same frame is dropped."""
    if not GAME:
        page()
        return
    import game_sprites as gs
    recs = sec.notes.setdefault('game_sprites', [])
    if any(r.id == sprite_id and set(r.frames) & set(frames) for r, _ in recs):
        return
    recs.append((gs.Sprite(sprite_id, frames, part, ax=ax, ay=ay), gs.walk_grade(sec)))


def surfaces(sec, specs, step=1.0):
    """Horizontal surfaces at a height h(u) over the floor (negative: sunk), seen through the floor camera.
       spec: dict(u0, u1, dn, df, h=fn(u)->array, col=fn(u, d)->(rgb uint8 (..,3), mask)). Each integer depth k gets the
       band [k - 0.5, k + 0.5] of every surface, painted into the plane of that depth (far slices first)."""
    ks = set()
    for sp_ in specs:
        for k in range(int(math.floor(sp_['dn'] + 0.5)), int(math.floor(sp_['df'] + 0.5)) + 1):
            ks.add(k)
    for k in sorted(ks, reverse=True):
        for sp_ in specs:
            dn, df = sp_['dn'], sp_['df']
            dfar, dnear = min(k + 0.5, df), max(k - 0.5, dn)
            if dfar <= dnear:
                continue
            Lp, kq = sec.plane(k)
            s = s_d(kq)
            c0 = max(0, P(sec.at(sp_['u0'], s))); c1 = min(Lp.pw, P(sec.at(sp_['u1'], s)))
            if c1 <= c0:
                continue
            xs = (np.arange(c0, c1) + 0.5) / U
            u = 192 + (xs - 192) / s
            h = np.asarray(sp_['h'](u), float) * np.ones_like(u)
            yt = (GY - dfar) - h * s_d(dfar)
            yb = np.maximum((GY - dnear) - h * s_d(dnear), yt + D1)
            r0 = max(0, P(float(yt.min()))); r1 = min(Lp.ph, P(float(yb.max())) + 1)
            if r1 <= r0:
                continue
            yy = (np.arange(r0, r1) + 0.5) / U
            m = (yy[:, None] >= yt[None, :]) & (yy[:, None] < yb[None, :])
            if not m.any():
                continue
            hh = h[None, :]
            rr = (yy[:, None] - 60 * hh / 116.0) / (1 - hh / 116.0)
            d = np.clip(GY - rr, dnear, dfar)
            uu = np.broadcast_to(u[None, :], d.shape)
            rgb, mm = sp_['col'](uu, d)
            m &= mm
            sub_ = Lp.a[r0:r1, c0:c1]
            sub_[..., :3][m] = rgb[m]
            sub_[..., 3][m] = 255


def flush_l1(sec):
    """Sec.flush, with the over-the-hero layers last and the planes cropped to their rows (the walk plane stays whole)."""
    keys = sorted(sec.planes, key=lambda kf: ((kf[0] < 0) or kf[1], -kf[0]))
    for key in keys:
        k, front = key
        Lp = sec.planes[key]
        Lp.recolor(grader(key=sec.KEY)); Lp.recolor(curve(*sec.H['curve']))
        y = 0
        if not (k == 0 and not front):
            rows = np.where(Lp.a[..., 3].any(axis=1))[0]
            if len(rows) == 0:
                continue
            y0 = int(rows[0] // U); y1 = int(-(-(rows[-1] + 1) // U))
            C = Layer(Lp.w, y1 - y0)
            C.a = np.ascontiguousarray(Lp.a[y0 * U:y1 * U])
            Lp, y = C, y0
        sec.add('d%g%s' % (k, 'f' if front else ''), Lp, s_d(k), y=y, over=(k < 0 or front), depth=k, front=front)
    sec.planes = {}


def preview_l1(sec, cams, tag=None, layouts=None):
    """level.preview for more than four cameras (the hero frame index wraps); layout frames at several cameras
       (the first is out/l1<id>-layout-u<U>.png, the others -layout<i>-)."""
    run, idle = hero_frames()
    os.makedirs('out', exist_ok=True)
    tag = tag or sec.id
    for i, cx in enumerate(cams):
        save(compose_level(sec, cx, 0, run[(i * 3) % len(run)]), f'out/l1{tag}-{i}-u{U}.png', 1)
    for j, cx in enumerate(layouts or [cams[len(cams) // 2]]):
        save(compose_level(sec, cx, 0, run[0], overlay=True), f'out/l1{tag}-layout{j or ""}-u{U}.png', 1)


def tone_map(T, idx):
    return np.array(T, np.uint8)[np.clip(idx, 0, len(T) - 1)]


# ---------------------------------------------------------------- surface colours (daylight)
def planks_across(pitch=3.4, seed=131, rail=None, edge_far=None):
    """Bridge planks across the walkway (seen from above): a joint every `pitch` px of u, each plank its own tone,
       long soft stains along the walkway, nail rows over the girders (rail: their depths), a lit far edge."""
    Dk = R['deck']; Wt = R['white']

    def col(u, d):
        k = np.floor(u / pitch)
        la = u - k * pitch
        h1 = hash01(k, k * 0 + 3, seed)
        t = 4 + (h1 > 0.70).astype(int) - (h1 < 0.22).astype(int)
        st = fbm(u / 47.0, d / 7.0, seed + 2, 2)
        t = t - (st < 0.34).astype(int) + ((st > 0.72) & (h1 > 0.4)).astype(int)
        t = np.where(la < max(0.5, 1.0 / U), 2, t)
        if rail is not None:
            for g in rail:
                t = np.where((np.abs(d - g) < 0.4) & (np.abs(la - pitch / 2) < 0.55), 2, t)
        rgb = tone_map(Dk, t)
        if edge_far is not None:
            rgb[d > edge_far - 0.8] = Wt[5]
        return rgb, np.ones(u.shape, bool)
    return col


def setts(seed=141, rampn='granite', cu=4.0, cv=2.6):
    """Cobbles (granite setts) in offset rows, seen from above."""
    T = R[rampn]

    def col(u, d):
        v = v_y(GY - d)
        j = np.floor(v / cv)
        uu = u / cu + 0.5 * (j % 2)
        i = np.floor(uu)
        fu, fv = uu - i, v / cv - j
        base = 4 + (hash01(i, j, seed) > 0.66).astype(int) - (hash01(i, j, seed + 1) > 0.76).astype(int)
        t = np.where((fu < 0.40) & (fv < 0.45), base + 1, base)
        t = np.where((fu < 0.10) | (fv < 0.14), 2, t)
        return tone_map(T, t), np.ones(u.shape, bool)
    return col


def pontoon_top(seed=151):
    """The pontoon's deck from above: brown planks along x, butt joints, a lit rim at the far edge."""
    W = R['wood']

    def col(u, d):
        v = v_y(GY - d) * 0.7
        r = np.floor(v / 3.0)
        fr = v / 3.0 - r
        t = 3 + (hash01(np.floor((u + r * 4.5) / 9), r, seed) > 0.6).astype(int) - (hash01(np.floor((u + r * 4.5) / 9), r, seed + 1) > 0.8).astype(int)
        t = np.where(fr < 0.16, 1, t)
        t = np.where(((u + r * 4.5) % 9) < 0.5, 2, t)
        return tone_map(W, t), np.ones(u.shape, bool)
    return col


# ---------------------------------------------------------------- the street marks (the street pass, STREET-BRIEF.md)
# The section's street_<id>.py puts its marks into the floor layout: `thresholds` [u, lane side] (a granite band
# across the street at u, white shark teeth on the lane side), `copings` [u0, u1, water side (, dmin, dmax)] (the
# granite coping of a quay edge on the land side) and `bridgehead` [u0, u1] (granite setts over the whole band).
BACK_COPING = 27.0         # the quay coping at the back edge of the floor (level.py) starts at this depth


def street_marks(sec):
    fl = sec.fl
    G_ = R['granite']; S = R['stone']; PR = R['pave_red']; W_ = R['white']
    sq = [tuple(q) for q in (fl.get('squares') or [])]
    sett = setts(143)

    def fn(u, d, v, rgb):
        dF = pl(fl['far'], u); dN = pl(fl['near'], u)
        land = d < BACK_COPING
        bh = fl.get('bridgehead')
        if bh:
            m = (u >= bh[0]) & (u < bh[1]) & land
            if m.any():
                c, _ = sett(u, d)
                rgb[m] = c[m]
        for (ul, side) in fl.get('thresholds') or []:
            full = any(abs(ul - a) < 1 or abs(ul - b) < 1 for (a, b) in sq)        # at a square: across the whole band
            b0, b1 = (ul, ul + 4.0) if side <= 0 else (ul - 4.0, ul)
            m = (u >= b0) & (u < b1) & (land if full else ((d <= dF) & (d >= dN)))
            if m.any():
                j = np.floor(v / 7.0)
                t = 4 + (hash01(j, j * 0 + ul, 171) > 0.62).astype(int) - (hash01(j, j * 0 + ul, 172) > 0.86).astype(int)
                fv = v / 7.0 - j
                t = np.where((fv >= 0.10) & (fv < 0.22), np.minimum(t + 1, 6), t)       # the lit edge of each block
                t = np.where((fv < 0.10) | (np.abs(u - b0) < 0.5) | (np.abs(u - b1) < 0.5), 2, t)
                rgb[m] = tone_map(G_, t)[m]
            if side == 0:
                continue
            # the lane side: plain red asphalt (the edge lines and the centre dash stop), then the shark teeth
            lane = (d < dF - 0.5) & (d > dN + 0.5)
            a = (u - ul) * side
            z = lane & (a >= 0) & (a < 11.0)
            if z.any():
                g = hash01(u * 3, v * 3, 173)
                t = 3 + (g > 0.86).astype(int) - (g < 0.12).astype(int)
                rgb[z] = tone_map(PR, t)[z]
                vF = v_y(GY - dF); vN = v_y(GY - dN)
                n = 5
                tt = (v - vF) / ((vN - vF) / n)
                f = tt - np.floor(tt)
                L_ = 7.0
                aa = (a - 1.2) / L_
                tooth = z & (aa >= 0) & (aa <= 1) & (np.abs(f - 0.5) <= (1 - aa) * 0.40) & (tt >= 0) & (tt < n)
                rgb[tooth] = W_[5]
                rgb[tooth & (f > 0.5) & (f - 0.5 > (1 - aa) * 0.40 - 0.08)] = W_[3]           # the shaded flank
        for c in fl.get('copings') or []:
            e0, e1, ws = c[0], c[1], c[2]
            dmin, dmax = (c[3], c[4]) if len(c) > 3 else (-99.0, BACK_COPING)
            m = (u >= e0) & (u < e1) & (d >= dmin) & (d < dmax)
            if not m.any():
                continue
            j = np.floor(v / 9.0)
            t = 5 - (hash01(j, j * 0 + e0, 175) > 0.7).astype(int)
            t = np.where((v % 9.0) < 0.5, 3, t)
            edge = (e1 - u) if ws > 0 else (u - e0)
            t = np.where(edge < 0.8, 6, t)                                         # the lit arris over the water
            t = np.where(np.abs(u - (e0 if ws > 0 else e1)) < 0.5, 3, t)           # the joint with the street
            rgb[m] = tone_map(S, t)[m]
    return fn


# ---------------------------------------------------------------- floor additions of section c
def c_floor_extra(sec):
    S = R['stone']; G_ = R['granite']; BR = R['brick_brown']
    marks = street_marks(sec)
    st = sec.fl.get('steps') or dict(u0=2448, mid=2464, u1=2480, far=12.0, h=(6.0, 12.0))
    u0, um, u1, df = st['u0'], st['mid'], st['u1'], st['far']
    Ha, Hb = st['h']
    C = 192.0 + sec.cam             # the steps are exact at the section's last camera (where the fork is played)
    ptop = pontoon_top()
    s_ = lambda dd: (116.0 - dd) / 116.0

    def sunk(u, d, H):
        """The point of a plane H px under the floor that the floor pixel (u, d) shows: its depth and its world x,
           exact at the camera C (a floor row scrolls at the speed of its own depth, the sunk point at its own)."""
        y = GY - d
        d2 = GY - (y + 60 * H / 116.0) / (1 + H / 116.0)
        return d2, C + (u - C) * s_(d) / s_(d2)

    def fn(u, d, v, rgb):
        marks(u, d, v, rgb)
        # the quay coping behind the fork (the quay ends at the back edge, water behind)
        cm = (u >= 2436) & (u < 2480)
        rgb[cm & (d >= 27.0)] = S[5]; rgb[cm & (d >= 29.2)] = S[6]; rgb[cm & (d >= 27.0) & (d < 27.6)] = S[2]
        # the jetty steps: two treads Ha and Hb px under the quay, from the back wall at depth df to the front of the
        # screen; the lower tread meets the pontoon (depth -0.5 .. 11.9) and the basin at u1
        m = (u >= u0 - 4) & (u < u1) & (d <= df)
        if not m.any():
            return
        da, ua = sunk(u, d, Ha)
        db, ub = sunk(u, d, Hb)
        dw, uw = sunk(u, d, 0.0)
        uw = C + (u - C) * s_(d) / s_(df)                     # the back wall stands at depth df
        up = m & (ua >= u0) & (ua < um) & (da <= df)
        lo = m & ~up & (ub >= um) & (ub < u1) & (db <= df)
        riser = m & ~up & ~lo & (ua >= um) & (ub < um) & (ua < u1)
        wall = m & ~up & ~lo & ~riser & (uw >= u0) & (uw < u1) & (((uw < um) & (da > df)) | ((uw >= um) & (db > df)))
        beyond = m & ~up & ~lo & ~riser & ~wall & (ub >= u1) & (u < u1)
        # treads: granite slabs (joints across every 8 px of the true depth), a lit nosing at the step edge
        for (sel, dd, uu, lower) in ((up, da, ua, False), (lo, db, ub, True)):
            if not sel.any():
                continue
            vv = v_y(GY - dd)
            i_, j_ = np.floor(uu / 16.0), np.floor(vv / 8.0)
            t = 4 + (hash01(j_, i_, 161) > 0.6).astype(int) - (hash01(j_, i_, 162) > 0.84).astype(int)
            t = t - ((fbm(uu / 23.0, vv / 9.0, 163, 3) < 0.36) & (hash01(uu * 2, vv * 2, 164) > 0.4)).astype(int)   # wear
            fv_ = vv / 8.0 - j_
            t = np.where((fv_ >= 0.08) & (fv_ < 0.18), np.minimum(t + 1, 6), t)               # the lit edge of a slab
            t = np.where((fv_ < 0.08) | ((uu % 16.0) < 0.6), 2, t)                             # the joints
            if lower:
                t = np.where(uu < um + 2.5, 1, t)                                   # the shade under the nosing
                t = np.where((uu >= u1 - 1.4) & (dd < -0.5), 6, t)                  # the lit arris over the basin
                t = np.where((uu >= u1 - 0.6) & (dd >= -0.5), 1, t)                 # the gap to the pontoon
            else:
                t = np.where(uu >= um - 2.0, 6, t)                                  # the nosing of the upper tread
                t = np.where(uu < u0 + 1.0, 5, t)
            rgb[sel] = tone_map(R['sandstone'], t)[sel]                            # sandstone (blue stone greys the key)
        rgb[riser] = R['sandstone'][2]
        # the back wall of the stair well: sandstone courses, a stone coping at the top
        if wall.any():
            y = GY - d
            Ss = R['sandstone']
            rgb[wall] = Ss[2]
            rgb[wall & ((np.floor(y * 2) % 3) == 0)] = Ss[1]
            rgb[wall & (d > df - 1.2)] = S[5]
        # the basin at the lower tread's level beyond its edge (and under the pontoon)
        if beyond.any():
            wc = floor_water_g(sec, u, d, v)
            rgb[beyond] = wc[beyond]
            # under the pontoon (a surface in the depth planes, exact at every camera): its own planks, so that the
            # joint shows no water while the floor rows and the planes drift apart a little (cameras before the last)
            pm = beyond & (db >= -0.5) & (db <= 11.9)
            if pm.any():
                pc, _ = ptop(ub, db)
                rgb[pm] = pc[pm]
    return fn


# ---------------------------------------------------------------- houseboats (walk plane)
HB_COL = ['white', 'green', 'red', 'blue']


def houseboat_near(rng, w, cxo, cw, colour, chim=None, seed=1):
    """A houseboat at the walk plane (an ark): the steel hull to the water line (y 182), its deck top face back to
       depth 11 (y 154..164), the cabin front (146..163) and its roof top face (139..146), plants, a stove pipe at
       `chim` (x in the part), and a broken mirror in the water below. Part top = world y 139."""
    C = R[HB_COL[colour % 4]]; K = R['hull']; Wt = R['white']; G = R['glass']; Wd = R['wood']; LF = R['leaf']; I = R['iron']
    Dk = R['deck']; RS = R['roof_slate']; RT = R['roof_tile']
    T0 = 139
    L = Layer(w + 4, 60)
    y = lambda wy: wy - T0
    # --- deck top face (planks along the boat), y 154..164
    xx, yy = grid(1, y(154), w, 10)
    pl = np.floor((yy - y(154)) / 1.6)
    t = 3 + (hash01(np.floor((xx + pl * 5) / 11), pl, seed) > 0.6).astype(int) - (hash01(np.floor((xx + pl * 5) / 11), pl, seed + 1) > 0.82).astype(int)
    t = np.where(((yy - y(154)) % 1.6) < 0.3, 1, t)
    L.put(1, y(154), tone_map(Dk, t), np.ones(xx.shape, bool))
    L.hl(1, y(154), w, Dk[5])                                         # the far gunwale, lit
    L.hl(1, y(155), w, Dk[2])
    # --- deck furniture beside the cabin
    def pot(px_, py_, pw=5):
        L.rect(px_, py_ - 3, pw, 3, RT[3]); L.hl(px_, py_ - 3, pw, RT[5]); L.vl(px_ + pw - 1, py_ - 2, 2, RT[1])
        cn = canopy(pw + 5, 8, LF, rng.randint(0, 999), nb=4, rag=2, holes=0.05)
        L.blit(cn, px_ - 2.5, py_ - 10)
        if rng.random() < 0.6:
            fc = R[rng.choice(['red', 'yellow', 'white', 'red'])]
            for i in range(3):
                L.px(px_ - 1 + rng.randint(0, pw + 1), py_ - 9 + rng.randint(0, 4), fc[5])
    left_room = cxo - 1
    right_room = w - (cxo + cw)
    if left_room >= 9:
        pot(3, y(162), 5)
        if left_room >= 14:
            L.rect(9, y(156), 1, 8, I[2]); L.rect(13, y(156), 1, 8, I[2]); L.hl(9, y(157), 5, I[3])        # ladder to the roof
            for yy_ in range(158, 164, 2):
                L.hl(9, y(yy_), 5, I[3], t=TH)
    if right_room >= 10:
        rx = cxo + cw + 2
        b = rng.random()
        if b < 0.5 and right_room >= 46:
            bk = bike(rng, None, False)
            bk2 = Layer(bk.w, bk.h); bk2.a = bk.a.copy()
            L.blit(bk2, rx, y(163) - bk.h + 1)
        else:
            # two folding chairs and a small table
            for i, cxx in enumerate((rx + 2, rx + 9)):
                Ch = R[rng.choice(['red', 'blue', 'yellow', 'green'])]
                L.line(cxx, y(163), cxx + 4, y(156), Wd[4], t=TH); L.line(cxx + 5, y(163), cxx + 1, y(158), Wd[2], t=TH)
                L.rect(cxx + 1, y(159), 4, 1, Ch[4]); L.rect(cxx + 3, y(155), 1, 4, Ch[3])
            if right_room >= 18:
                L.rect(rx + 15, y(159), 5, 1, Wt[5]); L.vl(rx + 17, y(160), 3, I[2])
        pot(w - 7, y(163), 5)
    # --- the cabin: front y 146..163, boards, windows, a door
    x0, x1 = cxo, cxo + cw
    L.rect(x0, y(146), cw, 17, C[4])
    for xx_ in np.arange(x0 + 2, x1 - 1, 2.5):
        L.vl(xx_, y(147), 16, C[3], t=TH)                             # vertical boards
    L.vl(x0, y(146), 17, C[5]); L.vl(x1 - 1, y(146), 17, C[1]); L.vl(x1 - 2, y(146), 17, C[2])
    L.hl(x0, y(162), cw, C[1])
    xw = x0 + 4
    door_at = rng.choice([x0 + 3, x1 - 10])
    while xw < x1 - 8:
        if abs(xw - door_at) < 6:
            # the door: glass upper half, a step
            L.rect(door_at, y(149), 7, 14, Wt[5]); L.rect(door_at + 1, y(150), 5, 12, R[rng.choice(['green', 'red', 'blue'])][2])
            L.rect(door_at + 1.5, y(151), 4, 4, G[1]); L.px(door_at + 2, y(151), G[4]); L.px(door_at + 5, y(156), R['yellow'][5])
            xw = door_at + 10
            continue
        ww = rng.choice([7, 9, 9, 11])
        if xw + ww > x1 - 3:
            break
        window(L, xw, y(149), ww, 8, Wt, G, rng, None, sill=False)
        L.hl(xw - 1, y(157), ww + 2, Wt[6])
        if rng.random() < 0.45:                                       # a flower box
            L.hl(xw, y(158), ww, Wd[2])
            for fx in np.arange(xw, xw + ww, 1.5):
                L.px(fx, y(157), (R['red'] if rng.random() < 0.6 else R['yellow'])[5])
                L.px(fx + 0.5, y(158) - 0.5, LF[4])
        xw += ww + rng.randint(3, 5)
    # --- the cabin roof: top face y 139..146 (tar sheets, a lit front edge)
    L.rect(x0 - 1, y(139), cw + 2, 7, RS[3])
    for j, yy_ in enumerate(np.arange(139.0, 146, 1.75)):
        L.hl(x0 - 1, y(yy_), cw + 2, RS[2] if j % 2 else RS[4], t=TH)
    L.hl(x0 - 1, y(139), cw + 2, RS[4])
    L.rect(x0 - 2, y(145), cw + 4, 1, Wt[6]); L.rect(x0 - 2, y(146), cw + 4, 1, Wt[3])
    # roof things: a skylight, pots, a solar panel
    k = x0 + 3
    while k < x1 - 10:
        what = rng.choice(['pot', 'sky', 'pot', 'panel', 'none'])
        if what == 'pot':
            pot(k, y(144), 4); k += 9
        elif what == 'sky':
            L.rect(k, y(141), 8, 3, Wt[5]); L.rect(k + 1, y(141.5), 6, 2, G[4]); L.px(k + 1, y(141.5), G[6]); k += 12
        elif what == 'panel':
            L.poly([(k, y(144)), (k + 12, y(144)), (k + 10, y(140)), (k + 2, y(140))], R['blue'][1])
            for j in range(3):
                L.vl(k + 3 + j * 3, y(140.5), 3.5, R['blue'][3], t=TH)
            L.hl(k + 2, y(140), 8, R['blue'][4]); k += 16
        else:
            k += 6
    if chim is not None:                                              # the stove pipe under the smoke
        L.rect(chim - 1, y(134.5), 2.5, 9, I[2]); L.vl(chim - 1, y(134.5), 9, I[4]); L.hl(chim - 2, y(134.5), 4.5, I[1])
        L.hl(chim - 2, y(134), 4.5, I[3])
    # --- the hull: y 164..182, a white gunwale, the coloured sheer strake, black steel, red at the water line
    L.rect(0, y(164), w + 2, 18, K[2])
    L.hl(0, y(164), w + 2, Wt[6]); L.hl(0, y(165), w + 2, Wt[4])
    L.rect(0, y(166), w + 2, 3, C[3]); L.hl(0, y(166), w + 2, C[4]); L.hl(0, y(168), w + 2, C[1])
    xx, yy = grid(0, y(169), w + 2, 13)
    n = fbm(xx / 7.0, yy / 3.0, seed + 5, 2)
    t = 2 + (n > 0.62).astype(int) - (n < 0.36).astype(int)
    t = t - ((vnoise(xx / 1.6, yy / 6.0, seed + 6) > 0.78) & (yy > y(170))).astype(int)   # rust runs
    L.put(0, y(169), tone_map(K, t), np.ones(xx.shape, bool))
    for px_ in range(4, w, 9):                                        # rivet rows
        L.px(px_, y(170), K[4]); L.px(px_, y(176), K[4])
    L.hl(0, y(170.5), w + 2, K[3], t=TH)
    L.rect(0, y(179), w + 2, 3, R['red'][1]); L.hl(0, y(179), w + 2, R['red'][2])
    L.vl(0, y(164), 18, K[4]); L.vl(w + 1, y(164), 18, K[0])
    for tx in (rng.randint(6, 14), rng.randint(w // 2 - 6, w // 2 + 6), rng.randint(w - 18, w - 9)):   # tyre fenders
        L.ellipse(tx + 2.5, y(172), 2.6, 3.4, R['black'][1]); L.ellipse(tx + 2.0, y(171.4), 1.4, 2.0, R['black'][3])
        L.vl(tx + 2.5, y(165), 4, I[2], t=TH)
    # --- the mirror in the water (y 182..190): dark hull tones broken by the ripple rows
    xx, yy = grid(0, y(182), w + 2, 8)
    rr = (yy - y(182)) / 8.0
    on = (hash01(np.floor(xx * DET / (1 + rr * 3)), np.floor(yy * DET), seed + 9) > 0.18 + rr * 0.7) & (chk(xx, yy) | (rr < 0.35))
    cc = np.where((rr < 0.25)[..., None], np.array(K[1], np.uint8), np.where((hash01(xx, yy, seed + 10) > 0.75)[..., None], np.array(C[2], np.uint8), np.array(K[2], np.uint8)))
    L.put(0, y(182), cc.astype(np.uint8), on)
    return L


def small_boat(rng, w=60, seed=3, motor=0):
    """The little open canal boat the heroes hop on (a one-way platform at its gunwale, y 172): varnished wood,
       a canvas cushion, the outboard motor, a fender. Part top = world y 168 (the motor), gunwale at row 4.
       motor: rows cut from the motor's top (2 = the game's frame box of ams-boat-platform: 2 px over the gunwale)."""
    Wd = R['wood']; Wt = R['white']; I = R['iron']; Cv = R['canvas']; Bl = R['blue']
    L = Layer(w + 4, 24)
    g = 4
    for x in sub(2, w + 2):
        e = min(x - 2, w + 1 - x)
        cut = 3.2 * max(0.0, 1 - (e + D1) / 8.0) ** 1.4 if U > 1 else (2 if e < 3 else (1 if e < 6 else 0))
        bot = g + 10 - cut
        L.rect(x, g, D1, bot - g, Wd[3])
        L.rect(x, g, D1, 1, Wt[6]); L.rect(x, g + 1, D1, 1, Wd[5]); L.rect(x, g + 4, D1, 1, Wd[2]); L.rect(x, bot - 1, D1, 1, Wd[1])
        if int(x * DET) % (3 * DET) == 0:
            L.rect(x, g + 2, D1, 2, Wd[4])
    L.hl(4, g + 6, w - 4, Bl[3]); L.hl(5, g + 7, w - 6, Bl[2])        # a painted band
    # the inside seen over the gunwale: thwarts and a cushion
    L.rect(14, g - 1, 10, 1, Cv[4]); L.rect(34, g - 1, 8, 1, R['red'][4])
    # outboard motor at the stern
    L.rect(0, motor, 5, 6 - motor, I[2]); L.hl(0, motor, 5, I[4]); L.vl(0, motor, 6 - motor, I[3]); L.vl(2.5, 6, 9, I[1], t=TH)
    L.ellipse(w, g + 3, 1.6, 1.6, Wt[5])                             # bow fender
    # wake and mirror
    xx, yy = grid(0, g + 10, w + 4, 6)
    rr = (yy - g - 10) / 6.0
    on = (hash01(np.floor(xx * DET / (1 + rr * 3)), np.floor(yy * DET), seed) > 0.25 + rr * 0.6) & chk(xx, yy)
    L.put(0, g + 10, np.broadcast_to(np.array(Wd[1], np.uint8), xx.shape + (3,)), on)
    for (fx, fy) in ((w - 2, g + 10), (w + 1, g + 11), (1, g + 10)):
        L.hl(fx, fy, 3, Wt[5])
    return L


# ---------------------------------------------------------------- the shop quay
HOUSE_SPEC = [  # frame -> (w, gable, brick, shop)
    (52, 'step', 'brick_red', None), (44, 'neck', 'brick_brown', None), (60, 'cornice', 'brick_purple', None),
    (40, 'bell', 'green', None), (48, 'spout', 'brick_black', None), (56, 'neck', 'brick_rose', None),
    (44, 'bell', 'brick_ochre', None), (52, 'step', 'brick_brown', None), (56, 'neck', 'brick_red', ('KAAS', 'blue')),
    (52, 'bell', 'stone', ('BLOEMEN', 'green')), (60, 'cornice', 'brick_brown', ('KOFFIE', 'black')),
    (48, 'step', 'brick_purple', ('BOEKEN', 'red')), (56, 'spout', 'brick_ochre', ('FIETSEN', 'blue')),
]


def golden_house(frame, box_h, seed, depth=14.0, w=None):
    """A canal house of the shop quay at the game's facade width and x, at the scenery scale of its depth
       (sc = 2 s: a storey of 40 s, at depth 14 that is 35 px). The game's box height picks the number of upper
       storeys (99 / 114 -> 2, 119 -> 3, 139 -> 4); the tall ones leave the screen at the top, the low ones show
       their gables and roofs. Large walls get more detail per storey (dress_front). w: another front width (a
       window waver of the game needs a window column under it, l1c.py). info also keeps the body's facts
       (hb, gf, nf, sc, brick, doorc, seed) for the waver windows."""
    w_, kind, brick, shop = HOUSE_SPEC[frame]
    w = w_ if w is None else w
    s = s_d(depth)
    sc = 2.0 * s
    nf = 2 if box_h <= 114 else (3 if box_h <= 119 else 4)
    gf = ri(27 * sc)
    top = 3 if kind in ('neck', 'bell') else 2
    hb = int(round(gf + top + nf * 20 * sc))
    rng = random.Random(seed)
    doorc = random.Random(seed + 1).choice(['green', 'black', 'red', 'blue', 'green'])
    H, info = house(rng, w, hb, kind, brick, trim='plaster', doorc=doorc, sc=sc, shop=shop, seed=seed)
    note_scale('d14 storey', (hb - gf - top) / nf)
    dress_front(H, info, w, hb, gf, nf, sc, kind, brick, doorc, random.Random(seed + 7))
    info.update(hb=hb, gf=gf, nf=nf, sc=sc, brick=brick, doorc=doorc, seed=seed, kind=kind)
    return H, info


def dress_front(H, info, w, hb, gf, nf, sc, kind, brick, doorc, rng):
    """More detail per storey on a large front (the kit's house is drawn for far rows): a stone string course at
       each floor, carved lintels with keystones over the windows, louvred shutters on some fronts, flower boxes,
       iron wall anchors and a cellar grille. Coordinates are the house layer's."""
    B = R[brick]; T = R['plaster']; S = R['stone']; I = R['iron']; D = R[doorc]; LF = R['leaf_gold']
    gh = H.h - hb
    yb = H.h
    ww = max(4, ri(7 * sc))
    shutters = brick not in ('green', 'stone') and rng.random() < 0.55
    boxes = rng.random() < 0.5
    fl = [b for b in info['win'] if b[3] >= 10 and b[1] > gh]
    for (gx, gy, gw, ghh) in fl:
        x, y, wdt, hgt = gx - 1, gy - 1, gw + 2, ghh + 2
        if y + hgt > yb - gf + 2:
            continue                                                # the ground floor's own windows: left as they are
        # a carved lintel: a stone block over the frame, a keystone, its shade
        H.rect(x - 1.5, y - 3, wdt + 3, 2, S[5]); H.hl(x - 1.5, y - 3, wdt + 3, S[6]); H.hl(x - 1.5, y - 1, wdt + 3, B[1])
        H.rect(x + wdt / 2 - 1.5, y - 3.5, 3, 3.5, S[6]); H.vl(x + wdt / 2 + 1, y - 3, 3, S[3])
        if shutters:
            sw = max(2.5, min(4.0, (wdt) * 0.32))
            for sx, lit in ((x - sw - 0.5, True), (x + wdt + 0.5, False)):
                H.rect(sx, y, sw, hgt, D[3] if lit else D[2])
                for yy in np.arange(y + 1, y + hgt - 0.5, 1.5):
                    H.hl(sx, yy, sw, D[1] if lit else D[0], t=TH)
                H.vl(sx, y, hgt, D[4] if lit else D[2], t=TH)
                H.hl(sx, y + hgt / 2, sw, D[4], t=TH)
        if boxes and rng.random() < 0.55:
            by = y + hgt + 1
            H.rect(x, by, wdt, 2, R['wood'][2]); H.hl(x, by, wdt, R['wood'][4], t=TH)
            for fx in np.arange(x + 0.5, x + wdt - 0.5, 1.5):
                c = R[rng.choice(['red', 'red', 'yellow', 'white', 'rose' if 'rose' in R else 'red'])]
                H.rect(fx, by - 1.5 - rng.random(), 1.2, 1.2, c[5]); H.px(fx + 0.5, by - 0.5, LF[3])
    # string courses at the floor lines (stone bands), iron anchors under them
    topb = gh + (3 if kind in ('neck', 'bell') else 2)
    room = yb - gf - topb
    wts = [1.18 - 0.11 * i for i in range(nf)]
    yy = yb - gf
    for i in range(nf):
        H.rect(0, yy - 1.5, w, 1.5, S[4]); H.hl(0, yy - 1.5, w, S[6], t=TH); H.hl(0, yy, w, B[1], t=TH)
        for ax in (3, w - 5):
            H.rect(ax, yy + 2.5, 2.5, 1, I[1]); H.vl(ax + 1, yy + 1.5, 3, I[1], t=TH)
        yy -= room * wts[i] / sum(wts)
    # a cellar grille in the plinth
    st = ri(6 * sc)
    gx = 2 if info.get('door', (0,))[0] > w / 2 else w - 10
    H.rect(gx, yb - st + 2, 8, st - 4, R['black'][1])
    for xg in np.arange(gx + 1, gx + 8, 1.5):
        H.vl(xg, yb - st + 2, st - 4, I[3], t=TH)


def herring_cart(rng, fit=False):
    """The herring cart (breakable, intact): a white kiosk on two wheels, a blue band with HARING, a striped roof edge,
       fish on ice in the hatch, a Dutch flag. 50 x 40, feet at the bottom.
       fit: inside the game's frame box of ams-herring-cart (50 x 40, feet on its row 39): the flag flies from a short
       staff at the roof's right end (no mast over the roof), the drawbar's prop one px in."""
    Wt = R['white']; Bl = R['blue']; I = R['iron']; K = R['black']; G = R['glass']; Rd = R['red']; Y = R['yellow']
    L = Layer(52, 42)
    # roof and its scalloped edge
    L.rect(2, 4, 46, 4, Bl[3]); L.hl(2, 4, 46, Bl[5]); L.hl(2, 7, 46, Bl[2])
    for i, x in enumerate(range(2, 48, 4)):
        C = Wt if i % 2 == 0 else Bl
        L.rect(x, 8, 4, 3, C[5 if C is Wt else 3]); L.ellipse(x + 2, 11, 2, 1.2, C[5 if C is Wt else 3])
    # flag
    if fit:
        L.vl(46, 3, 5, I[4]); L.rect(47, 3, 4, 1, Rd[4]); L.rect(47, 4, 4, 1, Wt[6]); L.rect(47, 5, 4, 1, Bl[4])
    else:
        L.vl(42, 0, 4, I[4]); L.rect(43, 0, 6, 1, Rd[4]); L.rect(43, 1, 6, 1, Wt[6]); L.rect(43, 2, 6, 1, Bl[4])
    # body
    L.rect(4, 12, 42, 20, Wt[5]); L.vl(4, 12, 20, Wt[6]); L.vl(45, 12, 20, Wt[3]); L.vl(44, 12, 20, Wt[4])
    L.rect(7, 13, 36, 7, K[1]); L.hl(7, 13, 36, K[0])                 # the hatch
    for i in range(6):                                                # fish on ice
        fx = 9 + i * 5.6
        L.ellipse(fx + 2, 17.5, 2.6, 1.0, R['iron'][5] if i % 2 else Wt[6]); L.px(fx + 4.4, 17.2, R['iron'][3])
    L.hl(7, 19, 36, Wt[4]); L.hl(6, 20, 38, Wt[6])                   # counter
    L.rect(4, 21, 42, 8, Bl[3]); L.hl(4, 21, 42, Bl[5]); L.hl(4, 28, 42, Bl[1])
    tw = text_w('HARING')
    text(L, 25 - tw / 2, 23, 'HARING', Wt[6])
    L.hl(4, 31, 42, Wt[3])
    for x in (12, 36):                                                # wheels
        L.ellipse(x, 36, 4.6, 4.6, K[1]); L.ellipse(x, 36, 3.2, 3.2, I[3]); L.ellipse(x, 36, 1, 1, I[5])
    if fit:
        L.line(46, 30, 49.6, 33, I[2]); L.vl(49, 33, 7, I[1])         # the drawbar and its prop
    else:
        L.line(46, 30, 51, 33, I[2]); L.vl(50, 33, 7, I[1])           # the drawbar and its prop
    L.hl(8, 41, 36, K[0])
    return L


def market_stall(rng, frame=0, w=58, top=0):
    """A Waterlooplein market stall (intact): a striped awning on steel poles, a trestle table of second-hand goods.
       58 x 46, feet at the bottom. top: rows the awning sits lower (7 = the game's breakable ams-market-stall,
       58 x 40 with its feet on row 39: a lower awning, the lamp on the table a little shorter)."""
    AW = R[['red', 'blue', 'green'][frame % 3]]; Wt = R['white']; I = R['iron']; Wd = R['wood']; K = R['black']
    L = Layer(w, 46)
    # awning: stripes, a scalloped valance
    for x in sub(1, w - 1):
        st = int((x - 1) // 6) % 2 == 0
        C = AW if st else Wt
        L.rect(x, 2 + top, D1, 8, C[4]); L.rect(x, 2 + top, D1, 1, C[5]); L.rect(x, 9 + top, D1, 1, C[2])
    for x in range(1, w - 1, 6):
        st = int((x - 1) // 6) % 2 == 0
        C = AW if st else Wt
        L.ellipse(x + 3, 10 + top, 3, 1.6, C[3])
    L.hl(0, 1 + top, w, AW[5])
    # poles
    for x in (3, w - 4):
        L.rect(x, 11 + top, 1.5, 33 - top, I[3]); L.vl(x, 11 + top, 33 - top, I[5], t=TH)
    # goods on the table: records in a crate, a lamp, books, a kettle, jugs
    L.rect(4, 30, w - 8, 2, Wd[4]); L.hl(4, 30, w - 8, Wd[6]); L.hl(4, 32, w - 8, Wd[1])
    L.rect(6, 32, w - 12, 10, R['canvas'][2]); L.hl(6, 32, w - 12, R['canvas'][1])   # the cloth hanging down
    L.rect(7, 24, 10, 6, Wd[2]); L.hl(7, 24, 10, Wd[4])
    for i in range(4):
        L.vl(8 + i * 2.2, 22.5, 2, [R['red'], R['yellow'], K, R['blue']][i][4])
    lt = 3 if top > 4 else 0
    L.vl(21, 20 + lt, 10 - lt, I[2]); L.poly([(18, 21 + lt), (24, 21 + lt), (22.5, 17 + lt), (19.5, 17 + lt)], R['yellow'][4])   # a lamp
    for i, c in enumerate(['red', 'green', 'blue', 'yellow', 'red']):
        L.rect(27 + i * 2, 25 - (i % 2), 2, 5 + (i % 2), R[c][3]); L.vl(27 + i * 2, 25 - (i % 2), 5 + (i % 2), R[c][5], t=TH)
    L.ellipse(42, 27, 3.4, 3, I[4]); L.ellipse(41, 26, 1.2, 1, I[6]); L.rect(41, 23, 2, 1, I[2])
    L.rect(47, 24, 3, 6, R['teal'][4]); L.vl(47, 24, 6, R['teal'][6], t=TH)
    # boxes under the table
    L.rect(10, 39, 12, 5, Wd[3]); L.hl(10, 39, 12, Wd[5]); L.rect(36, 40, 10, 4, R['canvas'][4])
    for x in (6, w - 7):
        L.rect(x, 32, 1.5, 12, Wd[1])
    L.hl(2, 45, w - 4, K[0])
    return L


def route_sign(word, up=True, w=43):
    """The route sign at the fork: a white board with the word and an arrow on a grey post (43 or 73 x 36)."""
    I = R['iron']; Wt = R['white']; Bl = R['blue']; K = R['black']
    L = Layer(w, 36)
    bw = w - 2
    L.rect(w / 2 - 1, 12, 2, 24, I[3]); L.vl(w / 2 - 1, 12, 24, I[5])
    L.rect(1, 2, bw, 13, Bl[3]); L.hl(1, 2, bw, Bl[5]); L.vl(1, 2, 13, Bl[5]); L.vl(bw, 2, 13, Bl[1]); L.hl(1, 14, bw, Bl[1])
    L.rect(2.5, 3.5, bw - 3, 10, Bl[3])
    L.hl(2.5, 3.5, bw - 3, Wt[6], t=TH); L.hl(2.5, 13, bw - 3, Wt[6], t=TH); L.vl(2.5, 3.5, 10, Wt[6], t=TH); L.vl(bw - 0.5, 3.5, 10, Wt[6], t=TH)
    tw = text_w(word)
    tx = 5
    text(L, tx, 6, word, Wt[6])
    ax = tx + tw + 5
    if up:
        L.vl(ax, 5, 7, Wt[6], t=1.4); L.line(ax - 2.5, 7.5, ax, 5, Wt[6], t=1.0); L.line(ax + 2.5, 7.5, ax, 5, Wt[6], t=1.0)
    else:
        L.vl(ax, 5, 7, Wt[6], t=1.4); L.line(ax - 2.5, 9, ax, 11.5, Wt[6], t=1.0); L.line(ax + 2.5, 9, ax, 11.5, Wt[6], t=1.0)
    L.rect(w / 2 - 2, 34, 4, 2, K[1])
    return L


# ---------------------------------------------------------------- the white wooden bridge (fork and c1)
def white_rail(w, drop=0.0, h=12, seed=5, dark=False, down=False):
    """A white wooden railing: a capped top rail, a lattice of diagonals between posts every 16 px, a kick rail.
       drop: how much it rises over its length to the right (down=True: it falls to the right, from row H - 2 - drop
       at the left end). Bottom row (H - 2) at the deck."""
    Wt = R['white']
    L = Layer(w + 2, h + abs(drop) + 3)
    H = L.h
    if down:
        base = lambda x: H - 2 - drop * (1 - min(1.0, max(0.0, x / max(w, 1))))
    else:
        base = lambda x: H - 2 - drop * min(1.0, max(0.0, x / max(w, 1))) if drop > 0 else H - 2 + 0 * x
    for x in sub(0, w + 1):
        b = base(x)
        L.rect(x, b - h, D1, 1.6, Wt[6]); L.rect(x, b - h + 1.6, D1, 0.8, Wt[2])      # top rail
        L.rect(x, b - 2, D1, 1.4, Wt[5]); L.rect(x, b - 0.6, D1, 0.6, Wt[2])            # kick rail
    # lattice: diagonals in each 16-px panel, posts
    for p0 in range(0, w, 16):
        p1 = min(w, p0 + 16)
        for (xa, xb) in ((p0, p1), (p1, p0)):
            ya, yb_ = base(xa) - h + 2.4, base(xb) - 2
            L.line(xa + 0.5, ya, xb - 0.5, yb_, Wt[5] if xa < xb else Wt[4], t=TH * 1.4)
        b = base(p0)
        L.rect(p0, b - h - 1, 2, h + 1, Wt[5]); L.vl(p0, b - h - 1, h + 1, Wt[6], t=TH); L.vl(p0 + 1.5, b - h, h, Wt[2], t=TH)
        L.rect(p0 - 0.5, b - h - 1.5, 3, 1, Wt[6])
    if dark:
        L.recolor(lambda c: c * 0.9)
    return L


def white_portal(w=72, h=120, near=False):
    """The gallows of the white drawbridge: two square posts, a top beam with its braces, the counterweight beams and
       the hoist chains, lamps on the beam. Bottom centre on the deck."""
    Wt = R['white']; I = R['iron']; K = R['black']; Y = R['yellow']
    L = Layer(w, h)
    pw = 5
    for px_ in (2, w - 2 - pw):
        L.rect(px_, 10, pw, h - 10, Wt[4]); L.vl(px_, 10, h - 10, Wt[6]); L.vl(px_ + 1, 10, h - 10, Wt[5]); L.vl(px_ + pw - 1, 10, h - 10, Wt[2])
        for yy in range(18, h - 4, 14):                                # bolt plates
            L.px(px_ + 2, yy, I[3])
        L.rect(px_ - 1, h - 4, pw + 2, 4, Wt[3]); L.hl(px_ - 1, h - 4, pw + 2, Wt[6])
    # the top beam (a box girder), its braces, the counterweight beams over it
    L.rect(0, 10, w, 7, Wt[5]); L.hl(0, 10, w, Wt[6]); L.hl(0, 16, w, Wt[2]); L.hl(0, 13, w, Wt[4], t=TH)
    L.line(2 + pw, 26, 18, 17, Wt[4], t=1.4); L.line(w - 2 - pw, 26, w - 18, 17, Wt[3], t=1.4)
    L.line(2 + pw, 40, w / 2 - 2, 17, Wt[4], t=TH * 1.4); L.line(w - 2 - pw, 40, w / 2 + 2, 17, Wt[3], t=TH * 1.4)
    L.rect(4, 4, w - 8, 4, Wt[4]); L.hl(4, 4, w - 8, Wt[6]); L.hl(4, 7, w - 8, Wt[2])     # counterweight beam
    for x in (10, w - 12):
        L.rect(x, 7, 2, 4, Wt[3])
    for x in (16, w - 17):                                             # hoist chains down to the deck
        for yy in np.arange(17, h - 6, 1.5):
            L.px(x, yy, I[2] if int(yy * 2) % 2 else I[4])
    for x in (w / 2 - 12, w / 2 + 10):                                 # lamps (unlit bulbs) on the beam
        L.ellipse(x + 1, 2.5, 1.6, 1.6, Y[5]); L.px(x + 0.5, 2, Y[6])
    L.vl(w / 2, 0, 4, I[3])
    return L


def bridge_far_side(w, h_above=28, h_below=44, pier=64, seed=3, foot0=None):
    """The far side of the white bridge (behind its deck): the railing above the deck line, the deck edge beam and the
       open arched girders down to the water, piers every `pier` px. Row h_above = the deck line. foot0: the row
       where the first pier stands on a step (a granite plinth, no braces) instead of in the water."""
    Wt = R['white']; I = R['iron']; K = R['black']; M = R['moss']
    L = Layer(w, h_above + h_below)
    rail = white_rail(w, 0, 12, seed)
    L.blit(rail, 0, h_above - rail.h + 2)
    dy = h_above
    L.rect(0, dy, w, 4, Wt[5]); L.hl(0, dy, w, Wt[6]); L.hl(0, dy + 3, w, Wt[2])
    for p0 in range(0, w, pier):
        p1 = p0 + pier
        # the arched girder between two piers: a white arch rib and its hangers
        for x in sub(p0 + 4, min(w, p1 - 4)):
            t = (x - p0 - 4) / (pier - 8)
            ya = dy + 4 + 7 * (1 - (2 * t - 1) ** 2) ** 0.5 * 0 + 9 * (2 * t - 1) ** 2
            L.rect(x, ya, D1, 2, Wt[4]); L.rect(x, ya + 2, D1, 0.6, Wt[2])
        for x in range(p0 + 8, min(w, p1 - 6), 6):
            t = (x - p0 - 4) / (pier - 8)
            ya = dy + 4 + 9 * (2 * t - 1) ** 2
            L.vl(x, dy + 4, ya - dy - 4, Wt[3], t=TH)
        # the pier: a white timber trestle to the water, dark wet foot
        if p0 == 0 and foot0 is not None:
            hb = foot0 - dy - 4
            L.rect(0, dy + 4, 5, hb - 2, Wt[4]); L.vl(0, dy + 4, hb - 2, Wt[6]); L.vl(4, dy + 4, hb - 2, Wt[2])
            G_ = R['granite']
            L.rect(-0.5, foot0 - 2, 6, 2, G_[4]); L.hl(-0.5, foot0 - 2, 6, G_[6]); L.hl(-0.5, foot0 - 0.5, 6, G_[1])
            continue
        if p0 < w:
            px_ = p0
            L.rect(px_, dy + 4, 5, h_below - 4, Wt[4]); L.vl(px_, dy + 4, h_below - 4, Wt[6]); L.vl(px_ + 4, dy + 4, h_below - 4, Wt[2])
            L.line(px_ - 3, h_above + h_below, px_ + 1, dy + 6, Wt[3], t=TH * 1.4)
            L.line(px_ + 8, h_above + h_below, px_ + 4, dy + 6, Wt[2], t=TH * 1.4)
            L.rect(px_ - 1, h_above + h_below - 8, 7, 8, M[2]); L.hl(px_ - 1, h_above + h_below - 8, 7, M[3])
    return L


def deck_face(xs, ytop_fn, yw=182, pier=64, seed=7, face=6, piers=True, x_off=0):
    """The near face of a bridge deck at the walk plane: the white fascia beam under the deck edge, the shade of the
       deck's underside, the stringers and the piers down to the water line yw. xs: (x0, x1) world; ytop_fn(x) = the
       deck edge y. Returns (Layer, top y) in world coordinates."""
    Wt = R['white']; K = R['black']; M = R['moss']; Dk = R['deck']; I = R['iron']
    x0, x1 = xs
    ys = [ytop_fn(x) for x in np.arange(x0, x1 + 1)]
    ymin = math.floor(min(ys)) - 1
    L = Layer(x1 - x0 + 2, yw - ymin + 6)
    for x in sub(x0, x1):
        yt = ytop_fn(x) - ymin
        lx = x - x0
        L.rect(lx, yt, D1, 1, Wt[6]); L.rect(lx, yt + 1, D1, face - 2, Wt[4]); L.rect(lx, yt + face - 1, D1, 1, Wt[2])
        # the underside seen in shade: the cross beams' ends
        L.rect(lx, yt + face, D1, 3, K[2])
        if int((x - x0) * DET) % int(4 * DET) < DET:
            L.rect(lx, yt + face, D1, 2.4, Dk[2])
    if piers:
        for p in range(int(math.ceil((x0 + x_off) / pier)) * pier - x_off, x1, pier):
            lx = p - x0
            yt = ytop_fn(p) - ymin + face + 2
            hh = yw - ymin - yt
            if hh <= 2:
                continue
            L.rect(lx - 3, yt, 7, hh, Wt[4]); L.vl(lx - 3, yt, hh, Wt[6]); L.vl(lx - 2, yt, hh, Wt[5]); L.vl(lx + 3, yt, hh, Wt[2])
            L.rect(lx - 3, yt, 7, 2, K[2])                              # shade under the deck
            for b in range(int(yt + 6), int(yt + hh - 4), 7):
                L.hl(lx - 3, b, 7, Wt[3], t=TH)
            L.rect(lx - 3, yw - ymin - 6, 7, 6, M[2]); L.hl(lx - 3, yw - ymin - 6, 7, M[3]); L.vl(lx + 3, yw - ymin - 6, 6, M[1])
            # the pier's mirror
            for j in range(5):
                if j % 2 == 0 or U > 1:
                    L.rect(lx - 3 + (j % 2), yw - ymin + j, 6, 1 if U == 1 else 0.5, Wt[2] if j < 2 else K[3])
    return L, ymin


def pontoon_front(w=128):
    """The pontoon's front face (9 px): a planked rim on black floats, tyre fenders, cleats."""
    Wd = R['wood']; K = R['hull']; I = R['iron']; Bk = R['black']
    L = Layer(w, 10)
    L.rect(0, 0, w, 3, Wd[4]); L.hl(0, 0, w, Wd[6]); L.hl(0, 2, w, Wd[2])
    for x in range(0, w, 9):
        L.vl(x, 0, 3, Wd[1], t=TH)
    L.rect(0, 3, w, 5, K[2]); L.hl(0, 3, w, K[4]); L.hl(0, 7, w, K[0])
    for x in range(6, w, 22):
        L.ellipse(x + 2, 5, 2.4, 2.6, Bk[1]); L.ellipse(x + 1.6, 4.6, 1.2, 1.4, Bk[3])
    for x in range(14, w, 32):
        L.rect(x, -0.0, 4, 1, I[2]); L.px(x + 1, 0, I[4])
    L.hl(0, 8, w, Bk[0]); L.hl(2, 9, w - 4, K[1])
    return L


def cruise_boat(rng, w=198, h=48, wl=35):
    """The tour boat waiting at the pontoon: a long low canal cruiser with a glass roof (an own design). Row wl is
       the water line; the hull shows its port side, the glass cabin runs almost its whole length, the wheelhouse aft,
       a little open foredeck with benches."""
    Wt = R['white']; G = R['glass']; Bl = R['blue']; K = R['hull']; I = R['iron']; Rd = R['red']; Y = R['yellow']; Bk = R['black']
    L = Layer(w, h)
    # hull: white topsides, a blue band, dark boot top
    for x in sub(0, w):
        e1, e2 = x, w - 1 - x
        bow = 4.0 * max(0.0, 1 - (e2 + D1) / 22.0) ** 1.6
        stern = 2.0 * max(0.0, 1 - (e1 + D1) / 6.0) ** 1.4
        top = wl - 11 - (0.8 if e2 < 14 else 0)
        bot = wl + 1 - bow - stern
        L.rect(x, top, D1, bot - top, Wt[5])
        L.rect(x, top, D1, 1, Wt[6]); L.rect(x, top + 1, D1, 0.6, Wt[3])
        L.rect(x, top + 4, D1, 2, Bl[3]); L.rect(x, top + 4, D1, 0.6, Bl[5])
        L.rect(x, bot - 2.5, D1, 2.5, K[2]); L.rect(x, bot - 2.5, D1, 0.6, K[4])
    # rubbing strake and portholes along the hull
    L.hl(4, wl - 7, w - 14, Wt[3], t=TH)
    # the glass cabin: low walls, a curved glass roof with white ribs, passengers' seats inside (no figures)
    cx0, cx1 = 26, w - 34
    ct, cb = wl - 26, wl - 11
    L.rect(cx0, cb - 3, cx1 - cx0, 3, Wt[5]); L.hl(cx0, cb - 3, cx1 - cx0, Wt[6])
    for x in sub(cx0, cx1):
        t = (x - cx0) / (cx1 - cx0)
        ends = min(t, 1 - t)
        r = 3.5 * max(0.0, 1 - ends / 0.06) ** 1.5
        y0 = ct + r
        L.rect(x, y0, D1, cb - 3 - y0, G[2])
        L.rect(x, y0, D1, 1.2, G[5]); L.rect(x, y0 + 1.2, D1, 1.4, G[4])
        L.rect(x, cb - 8, D1, 5, G[1])
    for x in np.arange(cx0 + 4, cx1 - 2, 10.5):                        # ribs
        L.vl(x, ct + 0.6, cb - 3 - ct, Wt[5], t=TH * 1.4)
    for x in np.arange(cx0 + 6, cx1 - 6, 5.25):                        # seat backs (red) inside
        L.rect(x, cb - 7.5, 2.4, 2.2, Rd[2]); L.px(x, cb - 7.5, Rd[3])
    for x in np.arange(cx0 + 9, cx1 - 6, 21):                          # sheen of the low sun on the glass
        L.line(x, ct + 3, x + 5, cb - 9, G[6], t=TH)
    L.hl(cx0, ct, cx1 - cx0, Wt[6])
    # the wheelhouse aft (left: the stern is at the pontoon's start), a flag
    wx = 8
    L.rect(wx, ct - 1, 16, cb - ct + 1, Wt[5]); L.hl(wx - 1, ct - 2, 18, Wt[6]); L.hl(wx - 1, ct - 1, 18, Wt[3])
    L.rect(wx + 2, ct + 2, 12, 6, G[1]); L.rect(wx + 2, ct + 2, 12, 1.5, G[4]); L.vl(wx + 8, ct + 2, 6, Wt[5], t=TH)
    L.vl(3, ct - 10, cb - ct + 8, I[3]); L.rect(4, ct - 10, 7, 2, Rd[4]); L.rect(4, ct - 8, 7, 2, Wt[6]); L.rect(4, ct - 6, 7, 2, Bl[4])
    # the foredeck: a white rail, two benches, the bow light
    L.hl(cx1 + 2, wl - 15, w - cx1 - 8, Wt[6], t=TH)
    for x in np.arange(cx1 + 3, w - 8, 4):
        L.vl(x, wl - 15, 4, Wt[4], t=TH)
    L.rect(cx1 + 6, wl - 14, 9, 2, R['wood'][4]); L.rect(cx1 + 18, wl - 14, 7, 2, R['wood'][4])
    L.ellipse(w - 6, wl - 14, 1.2, 1.2, Y[6])
    # portholes along the hull under the cabin
    for x in np.arange(cx0 + 6, cx1 - 4, 9):
        L.ellipse(x, wl - 4.5, 1.1, 1.1, G[1]); L.px(x - 0.5, wl - 5, G[4])
    # the mirror under the water line
    xx, yy = grid(0, wl + 1, w, h - wl - 1)
    rr = (yy - wl - 1) / max(1, h - wl - 1)
    on = (hash01(np.floor(xx * DET / (1 + rr * 4)), np.floor(yy * DET), 171) > 0.2 + rr * 0.65) & (chk(xx, yy) | (rr < 0.3))
    cc = np.where((rr < 0.3)[..., None], np.array(K[1], np.uint8), np.where((hash01(xx, yy, 172) > 0.6)[..., None], np.array(Wt[2], np.uint8), np.array(Bl[1], np.uint8)))
    L.put(0, wl + 1, cc.astype(np.uint8), on)
    return L


def tour_boat_near(rng, w=116, seed=5, wake=5):
    """A long canal tour boat with a glass roof at the near water (entity size 116 x 32; row 28 = water line).
       wake: rows of wake under the water line (3 = inside the game's frame box of npc/ams/ams-tour-boat)."""
    Wt = R['white']; G = R['glass']; Bl = R['blue']; K = R['hull']; I = R['iron']; Rd = R['red']
    L = Layer(w, 29 + wake)
    wl = 28
    for x in sub(0, w):
        e2, e1 = w - 1 - x, x
        bow = 3.0 * max(0.0, 1 - (e2 + D1) / 14.0) ** 1.6
        stern = 1.6 * max(0.0, 1 - (e1 + D1) / 5.0) ** 1.4
        top = wl - 8
        bot = wl + 1 - bow - stern
        L.rect(x, top, D1, bot - top, Bl[2])
        L.rect(x, top, D1, 1, Wt[6]); L.rect(x, top + 1, D1, 0.6, Wt[3]); L.rect(x, top + 3, D1, 1, Wt[5])
        L.rect(x, bot - 2, D1, 2, K[1])
    cx0, cx1 = 12, w - 16
    ct, cb = wl - 21, wl - 8
    for x in sub(cx0, cx1):
        t = (x - cx0) / (cx1 - cx0)
        r = 3.0 * max(0.0, 1 - min(t, 1 - t) / 0.07) ** 1.5
        L.rect(x, ct + r, D1, cb - ct - r, G[2]); L.rect(x, ct + r, D1, 1, G[5]); L.rect(x, ct + r + 1, D1, 1.4, G[4])
        L.rect(x, cb - 5, D1, 5, G[1])
    for x in np.arange(cx0 + 4, cx1 - 2, 9):
        L.vl(x, ct + 0.5, cb - ct, Wt[5], t=TH * 1.4)
    for x in np.arange(cx0 + 5, cx1 - 4, 4.5):
        L.rect(x, cb - 4.5, 2, 2, Rd[2])
    for x in np.arange(cx0 + 8, cx1 - 6, 19):
        L.line(x, ct + 2.5, x + 4, cb - 6, G[6], t=TH)
    L.rect(w - 15, ct + 4, 7, cb - ct - 4, Wt[5]); L.rect(w - 14, ct + 5, 5, 4, G[1]); L.px(w - 13, ct + 5, G[5])
    L.vl(4, ct - 4, cb - ct + 4, I[3]); L.rect(5, ct - 4, 6, 1.5, Rd[4]); L.rect(5, ct - 2.5, 6, 1.5, Wt[6]); L.rect(5, ct - 1, 6, 1.5, Bl[4])
    xx, yy = grid(0, wl + 1, w, wake)
    rr = (yy - wl - 1) / 5.0
    on = (hash01(np.floor(xx * DET / (1 + rr * 3)), np.floor(yy * DET), seed) > 0.2 + rr * 0.6) & (chk(xx, yy) | (rr < 0.3))
    L.put(0, wl + 1, np.broadcast_to(np.array(Bl[1], np.uint8), xx.shape + (3,)), on)
    for (fx, fy) in ((w - 4, wl), (w - 1, wl + 1), (0, wl + 1)):
        L.hl(fx, fy, 3, Wt[6])
    return L


# ---------------------------------------------------------------- golden water and sky (this section's own tuning)
WATER_G = dict(far=(168, 140, 104), near=(48, 46, 62), glint=(255, 222, 150))     # warm: the golden sky in the water
CLOUDS_G = [(-30, 6, 250, 70, 21), (190, 0, 230, 64, 22), (400, 10, 200, 60, 23), (590, 2, 170, 66, 24),
            (120, 52, 150, 36, 25), (330, 60, 170, 30, 26), (520, 56, 140, 32, 27), (20, 84, 110, 26, 28), (640, 86, 100, 24, 29)]


def water_rows(sec, srcs, WF, YW, speed, k=2.4, ncol=28, seed=5, lights=None):
    """canal_water with this section's warm water bodies (HOURS['golden']['water'] is grey)."""
    rows = BACKY - YW
    src = flatten(srcs, WF, YW + 1)
    s1 = s_d(GY - BACKY + 0.0)
    wat = water(src, YW, rows, WF, sec.lw(s1), WATER_G['far'], WATER_G['near'], WATER_G['glint'], seed=seed, k=k, ncol=ncol,
                mix0=0.34, mix1=0.62, lights=lights)
    sec.add('water', None, speed, y=YW, kind='rows', frames=wat, s0=speed, s1=s1)
    return wat


def floor_water_g(sec, u, d, v, frame=0):
    """The canal seen from above in the golden hour: the bright warm sky taken in toward the back, the dark of the
       quay walls toward the viewer, long ripple bands with golden glints."""
    spal = sec.notes.get('spal')
    t = np.clip((d + 40) / 72.0, 0, 1)
    rip = fbm((u + frame * 3) / 18.0, v / 2.6, 81, 3)
    band = np.sin(v * 1.3 + fbm(u / 40.0, v / 8.0, 82, 2) * 6 + frame * 2.1)
    val = 0.14 + 0.50 * t + (rip - 0.5) * 0.5 + band * 0.10
    pal = gradient_pal([(0, '#3a2c34'), (0.35, '#54423e'), (0.62, '#7e6450'), (0.85, '#b08a62'), (1, '#d8b07a')], 8)
    idx = tones(val, 8, u * 0.5, v * 0.5, 0.3)
    out = np.array(pal, np.uint8)[idx]
    gl = (band > 0.80) & (rip > 0.60) & (hash01(u * 2, v, 83) > 0.45)
    out[gl] = (255, 222, 150)
    gl2 = (band > 0.9) & (rip > 0.7) & (hash01(u * 2, v, 84) > 0.7)
    out[gl2] = (255, 244, 200)
    return out


R['leaf_gold'] = ramp(7, .21, .84, .040, .118, .130, 166, 100)      # elm leaves in the low sun: yellow-green lights
R['leaf_amber'] = ramp(7, .21, .84, .036, .100, .112, 156, 90)      # section c's elms: a little warmer and softer (the big
                                                                    # quay elms at the scale rule fill the open quay)


def golden_wisps(sec, CL, seed=50):
    """A high veil of streak clouds lit gold, over the blue of the upper sky (the clouds layer, 720 wide, tiles)."""
    cp = [hx(c) for c in sec.H['cloud']]
    for (x, y, w, h, sd) in [(0, 0, 360, 26, seed), (360, 4, 360, 24, seed + 1), (150, 18, 380, 22, seed + 2), (520, 22, 240, 20, seed + 3),
                             (-120, 26, 300, 20, seed + 4), (40, 40, 300, 18, seed + 5), (420, 44, 320, 18, seed + 6)]:
        W_ = wisp(w, h, cp[1:], sd, cover=0.62, sx=44, sy=6, tilt=-0.01)
        for dx in (0, -720, 720):
            CL.blit(W_, x + dx, y)
    CL.a[..., :3] = snap5(CL.a[..., :3])


def sun_band(sec, layer_id, line, warm=(255, 210, 146), a=0.26, shade=(0.88, 0.85, 0.94), seed=61):
    """The low sun on a plane (after the grade): above line(x) (layer x, logical) the pixels step toward the warm light,
       below it they lie in the shade of the houses behind the viewer; the edge is broken by the checker."""
    for l in sec.layers:
        if l['id'] != layer_id:
            continue
        L = l['img']
        xx, yy = grid(0, l['y'], L.w, L.h)
        yl = line(xx) + (hash01(np.floor(xx * DET / 3), xx * 0, seed) - 0.5) * 2
        m = L.a[..., 3] > 0
        lit = m & ((yy < yl - 1) | ((yy < yl + 1) & chk(xx, yy)))
        sh = m & ~lit
        px = L.a[..., :3][lit].astype(float)
        L.a[..., :3][lit] = snap5(px + (np.array(warm, float) - px) * a)
        px = L.a[..., :3][sh].astype(float)
        L.a[..., :3][sh] = snap5(px * np.array(shade))


# ================================================================ section c1 (BRUG)
def band_along(sec, u0, u1, depth, hfun, height, col, front=False, below=0.0):
    """A vertical band at one depth that stands on a raised line (a parapet, a bridge face): for every column, rows
       from the line minus `height` to the line plus `below` (own size, not scaled). col(u, yr) -> (rgb, mask) with
       yr = rows relative to the line (negative = above)."""
    Lp, k = sec.plane(depth, front)
    s = s_d(k)
    c0 = max(0, P(sec.at(u0, s))); c1 = min(Lp.pw, P(sec.at(u1, s)))
    if c1 <= c0:
        return
    xs = (np.arange(c0, c1) + 0.5) / U
    u = 192 + (xs - 192) / s
    yl = (GY - k) - np.asarray(hfun(u), float) * np.ones_like(u) * s
    r0 = max(0, P(float(yl.min() - height))); r1 = min(Lp.ph, P(float(yl.max() + below)) + 1)
    yy = (np.arange(r0, r1) + 0.5) / U
    yr = yy[:, None] - yl[None, :]
    m = (yr >= -height) & (yr < below)
    uu = np.broadcast_to(u[None, :], yr.shape)
    rgb, mm = col(uu, yr)
    m &= mm
    sub_ = Lp.a[r0:r1, c0:c1]
    sub_[..., :3][m] = rgb[m]
    sub_[..., 3][m] = 255


def hump(u):
    """The Blauwbrug's ground: a cosine hill of 16 px over 1020-1220."""
    u = np.asarray(u, float)
    return np.where((u > 1020) & (u < 1220), 8.0 * (1 - np.cos(2 * np.pi * (u - 1020) / 200.0)), 0.0)


def stone_parapet(seed=181, height=10.0, piers=(1020, 1120, 1220), every=8.0):
    """A blue-grey granite balustrade: plinth, balusters, a lit coping; pedestals at `piers`."""
    G_ = R['granite']

    def col(u, yr):
        y = yr + height                                   # 0 at the top
        t = np.full(u.shape, 3)
        cop = y < 2.2
        t = np.where(cop, 5, t); t = np.where(y < 0.7, 6, t); t = np.where((y >= 1.6) & (y < 2.2), 2, t)
        plinth = y > height - 3
        t = np.where(plinth, 3, t); t = np.where(plinth & (y < height - 2.4), 4, t)
        f = (u % every) / every
        mid = ~cop & ~plinth
        bal = (np.abs(f - 0.5) < 0.22 + 0.10 * np.cos((y - 2.2) / (height - 5) * 2 * np.pi))
        t = np.where(mid & bal, 4, t)
        t = np.where(mid & bal & (f < 0.42), 5, t)
        t = np.where(mid & ~bal, 1, t)
        for p in piers:
            pm = np.abs(u - p) < 4.5
            t = np.where(pm, 4, t); t = np.where(pm & (u < p - 3.3), 5, t); t = np.where(pm & (u > p + 3.0), 2, t)
            t = np.where(pm & (y < 1.4), 6, t)
        n = hash01(np.floor(u * 2), np.floor(y * 2), seed) > 0.86
        t = np.where(n & ~cop, t - 1, t)
        return tone_map(G_, t), np.ones(u.shape, bool)
    return col


def blauwbrug_face(seed=191, ywater=206.0):
    """The front of the Blauwbrug, from its road edge down to the lower edge of the screen (the canal lies deep under
       the street, as Amsterdam canals do): a cornice under the balustrade, brick spandrels, a granite arch ring over
       the water 1046-1194 springing at the water line y `ywater` (a dark vault, the lit river beyond, the water in
       the arch), granite abutments 1020-1044 and 1196-1220 with a wet foot. yr: rows under the road edge."""
    G_ = R['granite']; B = R['brick_red']; K = R['black']; M = R['moss']; Y = R['yellow']
    sm = s_d(-16.0)

    def col(u, yr):
        hh = hump(u) * sm
        yF = (GY + 16.0) - hh                                # the road edge on the screen
        ybot = ywater - yF                                   # the water line, rows under the road edge
        row = np.floor(yr * DET)
        cell = np.floor((u + (row % 2) * 2) / 4.0)
        brk = 3 + (hash01(cell, row, seed) > 0.75).astype(int) - (hash01(cell, row, seed + 1) > 0.82).astype(int)
        if U >= 4:
            brk = np.where(((yr * 2) % 1.0) < 0.26, 1, brk)
        rgb = tone_map(B, brk)
        # the arch: a half ellipse 1046..1194, crown 9.5 px under the road at 1120
        cx_, a_, crown = 1120.0, 74.0, 9.5
        x = (u - cx_) / a_
        ix = np.abs(x) < 1
        top_arch = np.where(ix, crown + (1 - np.sqrt(np.clip(1 - x * x, 0, 1))) * (ybot - crown), 1e9)
        ring = ix & (yr >= top_arch - 3.4) & (yr < top_arch)
        vs = np.floor(np.arctan2(yr - ybot, (u - cx_) / 2.2) * 9)
        rt = 4 + (hash01(vs, vs * 0, seed + 3) > 0.5).astype(int)
        rgb = np.where(ring[..., None], tone_map(G_, np.where(yr < top_arch - 2.6, 6, rt)), rgb)
        key = ring & (np.abs(u - cx_) < 3)
        rgb = np.where(key[..., None], tone_map(G_, np.where(u < cx_ - 1, 6, 4) + 0 * rt), rgb)
        # the vault: dark; through it the far side of the bridge, the lit river and a strip of the far quay
        vault = ix & (yr >= top_arch) & (yr < ybot)
        far_q = vault & (yr > ybot - 6.0) & (yr <= ybot - 4.4) & (np.abs(x) < 0.84)
        far_w = vault & (yr > ybot - 4.4) & (np.abs(x) < 0.86)
        vrgb = np.broadcast_to(np.array(K[1], np.uint8), rgb.shape).copy()
        vrgb[far_q] = G_[2]
        vrgb[far_w] = (150, 122, 94)
        gl = far_w & (hash01(np.floor(u * DET), np.floor(yr * DET), seed + 4) > 0.68)
        vrgb[gl] = Y[5]
        vrgb[vault & (yr < top_arch + 1.2)] = K[2]
        rgb = np.where(vault[..., None], vrgb, rgb)
        # the water in the arch: dark, the bright far end mirrored, ripples
        aw = ix & (yr >= ybot) & (yr >= top_arch - 3.4)
        wr = (yr - ybot)
        wv = 0.35 + 0.25 * np.exp(-wr / 3.0) * (np.abs(x) < 0.8) + (fbm(u / 9.0, yr / 1.4, seed + 6, 2) - 0.5) * 0.5
        wt = np.clip((wv * 5).astype(int), 0, 4)
        wpal = np.array([(40, 34, 44), (62, 50, 52), (96, 78, 66), (150, 122, 94), (236, 200, 140)], np.uint8)
        rgb = np.where(aw[..., None], wpal[wt], rgb)
        # cornice band under the balustrade
        cor = yr < 3.0
        rgb = np.where(cor[..., None], tone_map(G_, np.where(yr < 1.0, 6, np.where(yr < 2.2, 4, 2))), rgb)
        # granite abutments: coursed blocks; a string course at the water line; the wet foot under it
        ab = ((u < 1044) | (u >= 1196)) & ~cor
        qt = 4 + (((np.floor(yr / 2.6) + np.floor((u + np.floor(yr / 2.6) * 3) / 7.0)) % 2) == 0).astype(int)
        qt = np.where(((yr % 2.6) < 0.45), 2, qt)
        rgb = np.where(ab[..., None], tone_map(G_, qt), rgb)
        foot = ~aw & ~vault & ~ring & (yr >= ybot - 1.6)
        ft = np.where(yr < ybot - 0.6, 5, np.where(yr < ybot + 2.5, 2, 1 + (hash01(np.floor(u * 2), np.floor(yr), seed + 7) > 0.7).astype(int)))
        rgb = np.where(foot[..., None], tone_map(M, ft), rgb)
        rgb = np.where((foot & (yr >= ybot + 2.5))[..., None], tone_map(G_, 1 + (hash01(np.floor(u / 3), np.floor(yr / 2), seed + 8) > 0.6).astype(int)), rgb)
        return rgb.astype(np.uint8), np.ones(u.shape, bool)
    return col


def blauwbrug_lamp(h=86):
    """The Blauwbrug's lamp post at h px: the design of 23 x 86 (a granite pedestal, a fluted cast-iron column, a
       ring of four lanterns on scrolled arms, an imperial crown) scaled as a whole by h / 86. Bottom centre at the
       foot."""
    k = h / 86.0
    L = Layer(23 * k, h)
    _blauwbrug_lamp86(Scaled(L, k))
    return L


class Scaled:
    """A Layer seen through a scale k: a part drawn in its design coordinates lands k times as large, every stroke
       at least one real pixel (a whole pixel at tier 1)."""

    def __init__(s, L, k):
        s.L, s.k = L, k

    def _t(s, v):
        return max(1.0 if U == 1 else D1, v * s.k)

    def rect(s, x, y, w, h, c):
        s.L.rect(x * s.k, y * s.k, s._t(w), s._t(h), c)

    def px(s, x, y, c):
        s.rect(x, y, 1, 1, c)

    def hl(s, x, y, n, c, t=1):
        s.L.rect(x * s.k, (y + (1 - t) / 2) * s.k, n * s.k, s._t(t), c)

    def vl(s, x, y, n, c, t=1):
        s.L.rect((x + (1 - t) / 2) * s.k, y * s.k, s._t(t), n * s.k, c)

    def line(s, x0, y0, x1, y1, c, t=1):
        s.L.line(x0 * s.k, y0 * s.k, x1 * s.k, y1 * s.k, c, t=s._t(t))

    def ellipse(s, cx, cy, rx, ry, c):
        s.L.ellipse(cx * s.k, cy * s.k, rx * s.k, ry * s.k, c)


def _blauwbrug_lamp86(L):
    """The Blauwbrug lamp in its design coordinates (23 x 86) on L (a Scaled layer)."""
    I = R['iron']; G_ = R['granite']; G = R['glass']; Y = R['yellow']; Rd = R['red']
    h = 86
    cx = 11
    L.rect(cx - 5, h - 14, 10, 14, G_[3]); L.vl(cx - 5, h - 14, 14, G_[5]); L.vl(cx + 4, h - 14, 14, G_[1]); L.hl(cx - 6, h - 14, 12, G_[6])
    L.hl(cx - 6, h - 13, 12, G_[2]); L.rect(cx - 6, h - 3, 12, 3, G_[2]); L.hl(cx - 6, h - 3, 12, G_[4])
    L.rect(cx - 3, h - 10, 6, 5, G_[4]); L.hl(cx - 3, h - 10, 6, G_[5])
    L.rect(cx - 2, 26, 4, h - 40, I[2]); L.vl(cx - 2, 26, h - 40, I[4]); L.vl(cx + 1, 26, h - 40, I[1])
    L.vl(cx - 0.5, 26, h - 40, I[3], t=TH)
    L.rect(cx - 3, h - 22, 6, 8, I[2]); L.hl(cx - 3, h - 22, 6, I[4]); L.ellipse(cx, h - 23, 3.6, 1.2, I[3])
    L.rect(cx - 3, 36, 6, 3, I[3]); L.hl(cx - 3, 36, 6, I[5])
    # arms and four lanterns (two seen to the sides, one in front, one behind)
    for sgn in (-1, 1):
        L.line(cx, 30, cx + sgn * 7, 24, I[2], t=1.0); L.line(cx + sgn * 7, 24, cx + sgn * 8, 21, I[2], t=TH)
        lx = cx + sgn * 8
        L.rect(lx - 2, 14, 4, 7, G[5]); L.vl(lx - 2, 14, 7, I[2], t=TH); L.vl(lx + 1.5, 14, 7, I[1], t=TH); L.rect(lx - 1, 15, 1, 5, G[6])
        L.hl(lx - 2.5, 13, 5, I[2]); L.hl(lx - 1.5, 12, 3, I[3]); L.px(lx - 0.5, 11, I[3])
    L.rect(cx - 2, 15, 4, 8, G[5]); L.rect(cx - 1, 16, 1.5, 6, G[6]); L.vl(cx - 2, 15, 8, I[2], t=TH); L.vl(cx + 1.5, 15, 8, I[1], t=TH)
    L.hl(cx - 3, 14, 6, I[2]); L.hl(cx - 2, 13, 4, I[3])
    # the crown: gold, a red cap, a cross
    L.rect(cx - 3, 8, 6, 3, Y[3]); L.hl(cx - 3, 8, 6, Y[5]); L.hl(cx - 3, 10, 6, Y[2])
    for dx in (-3, 0, 2.5):
        L.px(cx + dx, 7, Y[5])
    L.ellipse(cx, 6, 2.2, 1.6, Rd[3]); L.px(cx - 1, 5.5, Rd[5])
    L.vl(cx - 0.5, 1, 4, Y[5]); L.hl(cx - 1.5, 2, 3, Y[5])
    return L


def mansion(rng, w, floors, wall, trim='white', s=0.30, seed=1, key='far'):
    """An Amstel mansion at river distance, at the scenery scale of speed s: a raised ground floor of 54 s over a
       rusticated plinth, `floors` storeys of 40 s with tall sash windows (14 s wide) under carved hoods, a balcony on
       the bel-etage, string courses, quoins on the brick fronts, a dentil cornice, a slate mansard of 3.2 m with
       pedimented dormers and chimneys. Bottom = the house foot."""
    Wl = R[wall]; T = R[trim]; G = R['glass']; S = R['stone']; RS = R['roof_slate']; I = R['iron']
    st = 40.0 * s
    gf = ri(54 * s)
    ww = max(3, ri(14 * s))
    rh = ri(3.2 * ppm(s))
    note_scale(key + ' storey', st)
    note_scale(key + ' width', w)
    hb = ri(floors * st + gf)
    H = hb + rh + 6
    L = Layer(w, H)
    yb = H
    top = H - hb
    brick = wall.startswith('brick')
    # the front's layout: the window bays, a central risalit on the wide ones, the roof kind
    ncol = max(2, int((w - 6) // (ww * 2.1)) + 1)
    xs = [3 + ri(i * (w - 6 - ww) / max(ncol - 1, 1)) for i in range(ncol)]
    mid = ncol // 2
    risalit = None
    if ncol >= 5 and rng.random() < 0.65:
        risalit = (xs[mid - 1] - 2, xs[mid + 1] + ww + 2)
    flat = rng.random() < 0.3
    if flat:
        # a flat roof behind a stone balustrade with urns
        bt = top - 4
        L.rect(0, bt, w, 4, T[4]); L.hl(0, bt, w, T[6]); L.hl(0, top - 1, w, T[3])
        for xx in np.arange(1.5, w - 1, 1.5):
            L.vl(xx, bt + 1, 2.5, Wl[1] if not brick else T[2], t=TH)
        for ux in [1] + [x + ww / 2 - 1 for x in xs[1:-1:2]] + [w - 3]:
            L.rect(ux, bt - 2.5, 2, 2.5, T[5]); L.px(ux + 0.5, bt - 3.2, T[6])
    else:
        # the mansard: a steep lower slope (slate courses, lit left half), a flat top, a lit ridge
        for i in sub(0, rh):
            ins = rq(max(0.0, (rh - i) * 0.30 - 0.4)) + (2 if i < 2 else 0)
            odd = int(i * DET / 1.5) % 2
            L.rect(ins, top - rh + i, w - 2 * ins, D1, RS[2] if odd else RS[3])
            L.rect(ins, top - rh + i, max(1, (w - 2 * ins) * 0.45), D1, RS[3] if odd else RS[4])
        L.hl(rq(rh * 0.30) + 2, top - rh, w - 2 * (rq(rh * 0.30) + 2), RS[5])
        for xx in np.arange(4, w - 4, 6):                               # zinc rolls
            L.vl(xx, top - rh + 2, rh - 2, RS[1], t=TH)
        nd = max(2, int(w // 16))
        for k in range(nd):
            dx = ri((k + 0.5) * w / nd) - 3
            if risalit and risalit[0] - 4 < dx + 3 < risalit[1] + 4:
                continue                                                # the pediment stands there
            dt = top - rh + 2
            L.rect(dx, dt, 6, rh - 3, T[5]); L.vl(dx + 5, dt, rh - 3, T[3]); L.vl(dx, dt, rh - 3, T[6])
            L.rect(dx + 1, dt + 2, 4, rh - 6, G[1]); L.px(dx + 1, dt + 2, G[4]); L.hl(dx + 1, dt + 2 + (rh - 6) / 2, 4, T[5], t=TH)
            L.poly([(dx - 0.5, dt + 0.5), (dx + 3, dt - 2), (dx + 6.5, dt + 0.5)], T[6] if k % 2 == 0 else T[5])
            L.hl(dx - 0.5, dt, 7, T[3], t=TH)
    if rng.random() < 0.75:
        for cxx in (rng.randint(3, max(4, w // 3)), rng.randint(2 * w // 3, w - 6)):
            L.rect(cxx, top - rh - 4, 3, rh * 0.5 + 4, R['brick_red'][2]); L.vl(cxx, top - rh - 4, rh * 0.5 + 4, R['brick_red'][4])
            L.hl(cxx - 0.5, top - rh - 4, 4, S[5]); L.hl(cxx - 0.5, top - rh - 3, 4, S[2], t=TH)
    # the wall
    if brick:
        brickfill(L, 0, top, w, hb, Wl, seed, streaks=True)
    else:
        xx, yy = grid(0, top, w, hb)
        n = fbm(xx / 11.0, yy / 7.0, seed, 3)
        t = 4 + (n > 0.62).astype(int) - (n < 0.36).astype(int)
        t = t - ((vnoise(xx / 2.0, yy / 20.0, seed + 2) > 0.80) & (yy > top + 3)).astype(int)
        L.put(0, top, tone_map(Wl, t), np.ones(xx.shape, bool))
    L.vl(0, top, hb, Wl[6] if not brick else Wl[5]); L.vl(w - 1, top, hb, Wl[1])
    if brick:                                                            # quoins
        for j, qy in enumerate(np.arange(top + 2, yb - gf, 2.0)):
            qw = 3 if j % 2 == 0 else 2
            L.rect(0, qy, qw, 2, T[5]); L.hl(0, qy + 1.5, qw, T[3], t=TH)
            L.rect(w - qw, qy, qw, 2, T[4]); L.hl(w - qw, qy + 1.5, qw, T[2], t=TH)
    if risalit:                                                          # the central risalit: its own wall, quoins
        r0, r1 = risalit
        if brick:
            xx, yy = grid(r0, top, r1 - r0, hb - gf)
            n = fbm(xx / 9.0, yy / 6.0, seed + 5, 2)
            L.put(r0, top, tone_map(T, 4 + (n > 0.6).astype(int) - (n < 0.35).astype(int)), np.ones(xx.shape, bool))
        else:
            for ry in np.arange(top + 3.5, yb - gf, 2.0):
                L.hl(r0, ry, r1 - r0, Wl[3], t=TH)
        L.vl(r0, top, hb, Wl[6] if not brick else T[6]); L.vl(r1 - 1, top, hb, Wl[1] if not brick else T[2])
    # the cornice: a lit lip, a frieze, dentils, its shade
    L.hl(-0.5, top - 0.5, w + 1, T[6]); L.hl(0, top + 0.5, w, T[4]); L.hl(0, top + 1.5, w, T[5]); L.hl(0, top + 2.5, w, Wl[1])
    for xx_ in np.arange(1, w - 1, 2):
        L.px(xx_, top + 1.5, T[3])
    if risalit:                                                          # its pediment with an oculus
        r0, r1 = risalit
        cxp, ph = (r0 + r1) / 2.0, min(7.0, (r1 - r0) * 0.22)
        L.poly([(r0 - 1, top + 0.5), (cxp, top - ph), (r1 + 1, top + 0.5)], T[5])
        L.poly([(r0 + 1.5, top - 0.2), (cxp, top - ph + 1.6), (r1 - 1.5, top - 0.2)], Wl[3] if not brick else T[3])
        L.line(r0 - 1, top, cxp, top - ph, T[6], t=TH); L.line(cxp, top - ph, r1 + 1, top, T[4], t=TH)
        L.ellipse(cxp, top - ph * 0.42, 1.3, 1.2, G[1])
    yf0 = yb - gf
    for f in range(floors):
        y1 = yf0 - f * st
        y0 = y1 - st
        wh = st * (0.66 if f == 0 else (0.58 if f < floors - 1 else 0.50))
        wy = y1 - 2.2 - wh
        if not brick:                                                     # string course at the floor line
            L.hl(0, y1 - 0.8, w, T[5], t=TH); L.hl(0, y1 - 0.3, w, Wl[2], t=TH)
        for i, x in enumerate(xs):
            L.rect(x, wy, ww, wh, T[5]); L.vl(x + ww - 0.5, wy, wh, T[3], t=TH)
            gk = rng.random()
            L.rect(x + 0.5, wy + 0.5, ww - 1, wh - 1, G[1] if gk > 0.3 else G[2])
            if gk > 0.72:
                L.rect(x + 0.5, wy + 0.5, (ww - 1) / 2, (wh - 1) * 0.45, G[4])
            elif gk < 0.12:
                L.rect(x + 0.5, wy + 0.5 + (wh - 1) * 0.35, ww - 1, (wh - 1) * 0.65, T[4])     # a blind
            L.hl(x + 0.5, wy + wh * 0.45, ww - 1, T[5], t=TH)
            L.hl(x - 0.5, wy + wh, ww + 1, T[6], t=TH)                       # sill
            L.hl(x - 0.5, wy - 1.2, ww + 1, T[6] if f == 0 else T[5])       # the hood over the window
            if f == 0:                                                   # pediments on the bel-etage
                if i % 2 == 0:
                    L.poly([(x - 0.8, wy - 1.0), (x + ww / 2, wy - 3.2), (x + ww + 0.8, wy - 1.0)], T[6])
                else:
                    L.ellipse(x + ww / 2, wy - 1.2, ww / 2 + 0.6, 1.5, T[6])
                L.hl(x - 0.5, wy - 1.0, ww + 1, T[3], t=TH)
            if f == 0 and i == mid:                                          # the balcony on the bel-etage
                L.rect(x - 2, wy + wh + 0.5, ww + 4, 1, S[4])
                L.hl(x - 2, wy + wh - 2.5, ww + 4, I[1], t=TH)
                for bx in np.arange(x - 2, x + ww + 2.1, 1.0):
                    L.vl(bx, wy + wh - 2.5, 3, I[1], t=TH)
        if f == 0:
            L.hl(0, y1 - 0.4, w, T[5]); L.hl(0, y1 + 0.6, w, Wl[1], t=TH)    # the heavy band over the bel-etage
    # the raised ground floor over its plinth: rustication, windows, doors with fanlights and stoops, cellar windows
    pl = 5
    yf = yb - pl
    if not brick:
        for ry in np.arange(yf0 + 2.5, yf, 2.0):
            L.hl(0, ry, w, Wl[3], t=TH)
    L.rect(0, yf, w, pl, S[3]); L.hl(0, yf, w, S[5]); L.hl(0, yb - 1, w, S[1])
    doors = [xs[mid]] if ncol < 7 else [xs[1], xs[-2]]
    for x in xs:
        if x in doors:
            L.rect(x - 0.5, yf0 + 1, ww + 1, gf - pl - 1, T[5]); L.rect(x, yf0 + 3, ww, gf - pl - 3, R[rng.choice(['green', 'black', 'red', 'blue'])][2])
            L.rect(x, yf0 + 1.5, ww, 1.5, G[3]); L.hl(x, yf0 + 3, ww, T[6], t=TH)
            L.rect(x - 1.5, yf, ww + 3, 1, S[5]); L.rect(x - 2.5, yf + 1.5, ww + 5, 1, S[4]); L.rect(x - 3.5, yf + 3, ww + 7, 1, S[4])
            L.vl(x - 3.5, yf - 2, 5, I[1], t=TH); L.vl(x + ww + 3, yf - 2, 5, I[1], t=TH)
        else:
            wh0 = gf - pl - 4
            L.rect(x, yf0 + 2, ww, wh0, T[5]); L.rect(x + 0.5, yf0 + 2.5, ww - 1, wh0 - 1, G[1]); L.px(x + 0.5, yf0 + 2.5, G[4])
            L.hl(x - 0.5, yf0 + 2 + wh0, ww + 1, T[6], t=TH)
            L.rect(x + 0.5, yf + 1.5, ww - 1, 2, G[0])
    return L


AMSTEL_WALLS = [('plaster', 5), ('brick_red', 4), ('brick_ochre', 5), ('plaster', 4), ('brick_brown', 5), ('stone', 4), ('brick_rose', 4),
                ('brick_purple', 5), ('plaster', 4)]


def amstel_far(sec, rng, YH=114, YQ=117, YW=122, speed=0.30, air=0.30, seed=200, boats=()):
    """The far bank of the Amstel at the scenery scale of its speed: long mansions wall to wall (4-5 storeys and a
       mansard), elms of 14-18 m on the quay, lamps of 4.8 m, parked cars and bikes, the stone quay wall, moored boats
       (house, barge, tour boats painted at this plane's px per metre; the kit's sloop is about right). One layer at
       the far speed (graded with the key and its air)."""
    m = ppm(speed)
    WF = sec.lw(speed)
    F = Layer(WF, VIEW_H)
    x = -rng.randint(10, 40)
    i = 0
    while x < WF:
        wall, fl = AMSTEL_WALLS[(i + seed) % len(AMSTEL_WALLS)]
        w = rng.randint(54, 96)
        M = mansion(rng, w, fl, wall, s=speed, seed=seed + i * 5)
        F.blit(M, x, YH - M.h)
        x += w
        i += 1
    far_street(F, 0, WF, YH, YQ, rng, 3)
    tl = []
    tx = rng.randint(10, 30)
    while tx < WF:
        t = tree_m(rng, m, rng.uniform(14.0, 18.0), leaf='leaf_gold', seed=rng.randint(1, 999), key='far tree m')
        tl.append((tx - t.w // 2, YQ - t.h, t))
        tx += rng.randint(70, 110)
    for (tx_, ty_, t) in tl:                                             # the elms' shade on the fronts
        msk = np.zeros((F.ph, F.pw), bool)
        cm = t.mask()
        yy0, xx0 = PX(ty_ + 6), PX(tx_ + 5)
        h_, w_ = cm.shape
        x1_ = min(F.pw, xx0 + w_); y1_ = min(PX(YH), yy0 + h_)
        if x1_ > max(0, xx0) and y1_ > yy0:
            msk[yy0:y1_, max(0, xx0):x1_] = cm[:y1_ - yy0, max(0, -xx0):x1_ - xx0]
        shade(F, msk)
    # parked cars and bikes, lamps, elms
    xx = 6
    while xx < WF - 20:
        k = rng.random()
        if k < 0.45:
            c = car_m(rng, m, key='far car m'); F.blit(c, xx, YQ - c.h + 1); xx += c.w + rng.randint(3, 10)
        elif k < 0.7:
            for j in range(rng.randint(1, 3)):
                b = bike_m(rng, m, key='far bike m'); F.blit(b, xx, YQ - b.h + 1); xx += b.w * 0.8
            xx += 4
        else:
            xx += rng.randint(8, 18)
    for lx in range(30, WF, 64):
        lp = lamp_m(m, 4.8, key='far lamp m')
        F.blit(lp, lx, YQ - lp.h + 1)
    for (tx_, ty_, t) in tl:
        F.blit(t, tx_, ty_)
    bollards_far(F, 0, WF, YQ + 1, rng)
    quay_wall(F, 0, YQ, WF, YW - YQ, rng, 9, brick='brick_brown')
    for (kind, bx, arg) in boats:
        if kind == 'house':
            b = houseboat_m(rng, arg[0], m, arg[1])
        elif kind == 'barge':
            b = barge_m(rng, arg[0], m)
        elif kind == 'tour':
            b = tourboat_m(rng, arg[0], m)
        else:
            b = sloop(rng, arg[0], arg[1])
        note_scale('far boat %s m' % kind, arg[0] / m)
        by = YW - b.h + (2 if kind == 'sloop' else 1)
        F.blit(b, bx, by)
    F.clear(0, YW + 1, F.w, F.h)
    F.recolor(grader(key=sec.KEY, air=(sec.AIR[0], sec.AIR[1], air, 0.30)))
    sec.add('far', F, speed)
    return F


def bridge_street(seed=141, far_kerb=5.0):
    """The Blauwbrug's roadway from above: granite setts between the kerbs, the street's far pavement (grey tiles)
       carried over the bridge behind the far kerb (lit kerbstone top, its face toward the roadway)."""
    sett = setts(seed)
    PG = R['pave_grey']; St = R['stone']

    def col(u, d):
        rgb, m = sett(u, d)
        v = v_y(GY - d)
        ti, tj = np.floor(u / 10.0), np.floor(v / 10.0)
        fu, fv = u / 10.0 - ti, v / 10.0 - tj
        t = 4 + (hash01(ti, tj, 11) > 0.74).astype(int) - (hash01(ti, tj, 12) > 0.80).astype(int)
        jt = (fu < 0.09) | (fv < 0.10)
        t = np.where(jt, 2, t)
        t = np.where((fv >= 0.10) & (fv < 0.18) & ~jt, np.minimum(t + 1, 6), t)
        pave = d >= far_kerb + 1.6
        rgb[pave] = tone_map(PG, t)[pave]
        top = (d >= far_kerb) & (d < far_kerb + 1.6)
        rgb[top] = St[6]; rgb[top & ((u % 12) < 0.5)] = St[3]
        face = (d < far_kerb) & (d >= far_kerb - 1.0)
        rgb[face] = St[2]; rgb[face & ((u % 12) < 0.5)] = St[1]
        return rgb, m
    return col


def c1_floor_extra(sec):
    S = R['stone']; BR = R['brick_brown']; G_ = R['granite']
    marks = street_marks(sec)

    w0 = sec.fl.get('river_west', 60)          # the west quay wall (street_c1.py)

    def fn(u, d, v, rgb):
        marks(u, d, v, rgb)
        river = (u >= w0) & (u < 860)
        under = (u >= 1044) & (u < 1196) & ((d > 19.5) | (d < -16))
        abut = (((u >= 1020) & (u < 1044)) | ((u >= 1196) & (u < 1220))) & ((d > 19.5) | (d < -16))
        wm = river | under
        if wm.any():
            wc = floor_water_g(sec, u, d, v)
            rgb[wm] = wc[wm]
            # the shade of the white bridge's deck on the river under it
            sh = (u >= w0) & (u < 860) & (d > -0.5) & (d < 21 - np.clip((u - 760) / 100.0, 0, 1) * 0)
            px = rgb[sh].astype(float) * np.array((0.56, 0.50, 0.56))
            rgb[sh] = snap5(px)
            # quay walls at the ends of the water
            for e in (w0, 860, 1044, 1196):
                band = np.abs(u - e) < 2.4
                rgb[band & wm] = BR[2]
                rgb[band & wm & ((np.floor(v / 2) % 2) == 0)] = BR[3]
                rgb[(np.abs(u - e) < 0.7) & wm] = S[5]
        # the Blauwbrug's abutments: granite quays
        if abut.any():
            t = 4 + ((np.floor(v / 6.0) + np.floor(u / 8.0)) % 2 == 0).astype(int)
            rgb[abut] = tone_map(G_, t)[abut]
        # the quay coping at the back edge where the river lies behind the square
        cm = (u >= 1220)
        rgb[cm & (d >= 27.0)] = S[5]; rgb[cm & (d >= 29.2)] = S[6]; rgb[cm & (d >= 27.0) & (d < 27.6)] = S[2]
    return fn


def bridge_mirror(x0, x1, ydeck=157.0, yw=182.0, pier=64, x_off=0, seed=231):
    """The broken mirror of a white bridge in the river: the fascia as pale dashes as far under the water line as it
       stands over it, the piers as broken vertical strokes. A walk-plane part; top = world y yw."""
    Wt = R['white']; Dk = R['deck']
    hgt = int(yw - ydeck) + 14
    L = Layer(x1 - x0 + 4, hgt)
    xx, yy = grid(0, 0, L.w, hgt)
    u = xx + x0
    # the fascia's mirror (y yw + (yw - ydeck) +- 2), torn by the ripples
    yc = (yw - ydeck) + 1.5 * np.sin(u / 9.0 + yy * 0.7)
    band = (np.abs(yy - yc) < 1.6) & (hash01(np.floor(u * DET / 3), np.floor(yy * DET), seed) > 0.35) & chk(xx, yy)
    L.put(0, 0, np.broadcast_to(np.array(Wt[3], np.uint8), xx.shape + (3,)), band)
    for p in range(int(math.ceil((x0 + x_off) / pier)) * pier - x_off, x1, pier):
        px_ = p - x0
        m = (np.abs(xx - px_ - 0.5 * np.sin(yy * 1.3)) < 3.0) & (yy < yc - 1.5) & (hash01(np.floor(yy * DET), np.floor(xx), seed + 1) > 0.25 + yy / hgt * 0.5) & (chk(xx, yy) | (yy < 3))
        L.put(0, 0, np.broadcast_to(np.array(Wt[2], np.uint8), xx.shape + (3,)), m)
    return L
