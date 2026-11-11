# Set pieces that several scenes share: the far street, the vista down a side canal, towers, far roofs.
import math
import random
import numpy as np
from build import *


def pal_of(ramp_, fn):
    return [tuple(int(v) for v in c) for c in fn(np.array(ramp_, float))]


def far_street(L, x0, x1, yh, yq, rng, seed=0):
    """The street of the far bank, squeezed to a few rows: pavement at the houses, clinker road, the quay edge."""
    PR = R['pave_red']; PG = R['pave_grey']
    w = x1 - x0
    L.rect(x0, yh, w, yq - yh, PR[3])
    L.hl(x0, yh, w, PG[5]); L.hl(x0, yh + 1, w, PG[3])
    for x in range(x0, x1):
        if hash01(np.array(x), np.array(1), seed) > 0.7:
            L.px(x, yh + 2 + int(hash01(np.array(x), np.array(2), seed) * (yq - yh - 2)), PR[2])
        if hash01(np.array(x), np.array(3), seed) > 0.86:
            L.px(x, yh + 2 + int(hash01(np.array(x), np.array(4), seed) * (yq - yh - 2)), PR[4])


def vista(L, x0, x1, rng, air, yh=110, ytop=(26, 50), ystreet=123, ywater=135, leaf='leaf', water_c=((120, 150, 170), (190, 215, 225)),
          lit=None, base_m=0.30, step_m=0.085, seed=5, bare=0.0):
    """One-point view down a side canal that runs away from the viewer. Each house slice is one step deeper
       in the air: the far end almost has the colour of the sky. (air = (dark, light) of the scene.)"""
    xc = (x0 + x1) / 2.0; half = (x1 - x0) / 2.0
    SL = [1, .76, .57, .43, .32, .24, .175, .125]
    G = R['glass']; T = R['plaster']; S = R['stone']; PR = R['pave_red']
    lights = []
    one = 1 if U == 1 else TH
    # water first (the walls overlap its edges)
    xx, yy = grid(x0, yh + 1, x1 - x0, ywater - yh)
    if xx.size:
        s = (np.floor(yy + 1e-6) - yh) / (ywater - yh)                   # colour by logical row: the palette stays small
        sg = s if U == 1 else (yy + D1 - yh) / (ywater - yh)             # shape by real pixel
        inside = np.abs(xx + 0.5 * D1 - xc) <= (half - 14) * sg + 0.5
        m_ = np.minimum(0.9, base_m + step_m * 7 * (1 - s))
        c0 = np.array(water_c[0], float); c1 = np.array(water_c[1], float)
        c = c0 + (c1 - c0) * (1 - s)[..., None]
        h1 = hash01(xx / np.maximum(1, np.floor(2 + 4 * s)), yy * DET, seed)
        h2 = hash01(xx / np.maximum(1, np.floor(2 + 3 * s)), yy * DET, seed + 1)
        c = np.where((h1 > 0.72)[..., None], c + (c1 - c) * 0.6, np.where((h2 < 0.2)[..., None], c + (c0 - c) * 0.7, c))
        c = c + (np.array(air[1], float) - c) * (m_ * 0.5)[..., None]
        L.put(x0, yh + 1, snap5(c).astype(np.uint8), inside)
    for side in (-1, 1):
        for i in range(len(SL) - 2, -1, -1):
            s0, s1 = SL[i], SL[i + 1]
            m = min(0.9, base_m + step_m * i)
            hz = grader(air=(air[0], air[1], m, 0.45))
            B = pal_of(R[rng.choice(BRICKS)], hz); Tn = pal_of(T, hz); Gn = pal_of(G, hz); Sn = pal_of(S, hz); Pn = pal_of(PR, hz)
            RT = pal_of(R[rng.choice(['roof_tile', 'roof_slate'])], hz)
            Yt = rng.randint(*ytop)
            xa = xc + side * half * s0; xb = xc + side * half * s1
            if U == 1:
                xa = int(round(xa)); xb = int(round(xb))
                cols = list(range(xa, xb, -side)) if xa != xb else [xa]
            else:
                cols = list(sub(xa, xb)) if side < 0 else list(sub(xb, xa))[::-1]
            n = len(cols)
            slice_w = max(n / U, 1e-6)
            wallc = B[1] if i > 2 else pal_of(R['brick_brown'], hz)[2]
            for ci, x in enumerate(cols):
                cl = ci / U                                               # logical column in the slice
                s = abs(x + 0.5 * D1 - xc) / half
                tri = 1 - abs((ci + 0.5) / n * 2 - 1)
                yt = yh + (Yt - yh) * s - (5.0 * s) * tri
                ybs = yh + (ystreet - 3 - yh) * s
                yt_i, yb_i = rq(yt), rq(ybs)
                tone = 3 + (1 if hash01(np.array(math.floor(x)), np.array(i), seed + 2) > 0.8 else 0)
                L.rect(x, yt_i, D1, max(D1, yb_i - yt_i), B[tone if side < 0 else tone - 1])
                L.rect(x, yt_i, D1, 1 if U == 1 else max(D1, min(1.0, 1.6 * s)), Tn[5] if side < 0 else Tn[4])
                if cl < one:
                    L.rect(x, yt_i + 1, D1, max(D1, yb_i - yt_i - 1), B[1])
                if (slice_w >= 2 and int(cl) % 3 == 1) or slice_w < 2:
                    for Yw, hh in ((104, 11), (88, 10), (72, 10), (57, 8)):
                        if Yw - 6 < Yt + 6:
                            continue
                        wy = rq(yh + (Yw - yh) * s)
                        wh = max(1, int(round(hh * s))) if U == 1 else max(2 * D1, hh * s)
                        on = lit is not None and float(hash01(np.array(int(cl) + 31 * i + (977 if side > 0 else 0)), np.array(Yw), seed + 5)) < lit[0]
                        L.rect(x, wy, D1, wh, lit[1] if on else Gn[1])
                        if on and (cl - int(cl)) < D1 * 0.5:
                            lights.append((int(math.floor(x)), int(math.floor(wy))))
                        if s > 0.5:
                            L.rect(x, wy - one, D1, one, B[5]); L.rect(x, wy + wh, D1, one, B[5])
                # street wedge, quay wall
                sq = min(1.0, abs(x + 0.5 * D1 - xc) / max(half - 14, 1))
                yq_ = rq(yh + (ystreet - yh) * sq); yw_ = rq(yh + (ywater - yh) * sq)
                L.rect(x, yb_i, D1, max(D1, yq_ - yb_i + 1), Pn[4 if (int(math.floor(x)) + int(cl)) % 4 else 3])
                L.rect(x, yq_, D1, 1, Sn[5])
                if abs(x + 0.5 * D1 - xc) < half - 14:
                    L.rect(x, yq_ + 1, D1, max(0, yw_ - yq_), wallc)
        # trees on the side quay, far ones first
        for k, s in enumerate((0.30, 0.42, 0.60, 0.86)):
            m = min(0.9, base_m + step_m * (7 - k * 2.2))
            hz = grader(air=(air[0], air[1], m, 0.45))
            LF = pal_of(R[leaf], hz); BK = pal_of(R['bark'], hz)
            tx = xc + side * (half - 9) * s
            by = yh + (ystreet - yh) * s
            cy = yh + (76 - yh) * s
            rad = 15 * s
            L.vl(int(tx), int(cy), max(1, int(by - cy)), BK[2], t=1 if rad >= 9 else TH)
            if rad >= 5:
                C = canopy(int(rad * 2.2), int(rad * 1.9), LF, seed + k * 3 + (7 if side > 0 else 0), nb=6, rag=3 + bare * 4, holes=0.06 + bare * 0.4)
                L.blit(C, int(tx - rad * 1.1), int(cy - rad * 1.0))
            else:
                L.ellipse(tx, cy, max(1.5, rad), max(1.5, rad * 0.9), LF[3]); L.px(int(tx - 1), int(cy - 1), LF[5]); L.px(int(tx + 1), int(cy + 1), LF[2])
    # the far end
    hz = grader(air=(air[0], air[1], min(0.92, base_m + step_m * 8), 0.5))
    B = pal_of(R['brick_brown'], hz); Tn = pal_of(T, hz)
    e = max(3, int(half * SL[-1]) + 1)
    for x in range(int(xc - e), int(xc + e) + 1):
        ht = 9 + (2 if (x // 3) % 2 else 0) + (3 if x == int(xc) + 1 else 0)
        L.vl(x, yh - ht + 5, ht - 2, B[3 if (x // 3) % 2 else 4])
        L.rect(x, yh - ht + 5, 1, one, Tn[5])
    L.vl(int(xc) + 1, yh - 16, 6, B[3], t=one); L.rect(int(xc) + 1 + (1 - one) / 2, yh - 17, one, 1, Tn[5])
    return lights


def tower(h=118, lit=False):
    """A church tower with stacked open lanterns and a crown (an own design in the Dutch renaissance manner)."""
    B = R['brick_brown']; T = R['plaster']; G = R['glass']; Bl = R['blue']; Y = R['yellow']; SL = R['roof_slate']
    L = Layer(30, h)
    sh = int(h * 0.50)
    y0 = h - sh
    brickfill(L, 5, y0, 20, sh, B, 61)
    L.vl(5, y0, sh, B[5]); L.vl(24, y0, sh, B[1]); L.vl(23, y0, sh, B[2])
    for y in range(y0, h, 4):
        L.hl(5, y, 2, T[5]); L.hl(23, y + 2, 2, T[3])
    for (yy, hh) in ((y0 + 26, 14), (y0 + 46, 12)):
        for x in (10, 17):
            L.rect(x, yy, 3, hh, G[0]); L.hl(x, yy - 1, 3, T[5]); L.px(x, yy, G[2])
    L.ellipse(15, y0 + 12, 6, 6, T[5]); L.ring(15, y0 + 12, 6, Y[4], 5); L.line(15, y0 + 12, 15, y0 + 8, B[0]); L.line(15, y0 + 12, 18, y0 + 13, B[0])
    L.hl(3, y0, 24, T[6]); L.hl(3, y0 + 1, 24, T[3]); L.hl(4, y0 - 1, 22, T[5])
    for x in range(4, 26, 2):
        L.px(x, y0 - 2, T[5])
    y = y0 - 2
    for (w_, hh) in ((16, int(h * 0.15)), (12, int(h * 0.12)), (8, int(h * 0.09))):
        x_ = 15 - w_ // 2
        L.rect(x_, y - hh, w_, hh, T[4]); L.vl(x_, y - hh, hh, T[6]); L.vl(x_ + w_ - 1, y - hh, hh, T[2])
        for xx in range(x_ + 2, x_ + w_ - 2, 3):
            L.rect(xx, y - hh + 3, 2, hh - 5, G[0] if not lit else Y[5])
        L.hl(x_ - 1, y - hh, w_ + 2, T[6]); L.hl(x_ - 1, y - hh + 1, w_ + 2, T[3])
        y -= hh
    L.ellipse(15, y - 3, 4.2, 4, Bl[3]); L.px(13, y - 5, Bl[5]); L.px(14, y - 6, Bl[5]); L.px(17, y - 2, Bl[1])
    L.hl(12, y, 6, Y[4])
    L.vl(15, y - 12, 6, Y[4]); L.px(14, y - 9, Y[5]); L.px(16, y - 9, Y[3]); L.px(15, y - 13, Y[6])
    return L


def dome_church(w=44, h=54):
    B = R['brick_ochre']; T = R['stone']; Gc = R['moss']; G = R['glass']
    L = Layer(w, h)
    brickfill(L, 0, h - 22, w, 22, B, 71); L.hl(0, h - 22, w, T[6]); L.hl(0, h - 21, w, T[3])
    for x in range(4, w - 4, 7):
        L.rect(x, h - 16, 3, 9, G[0]); L.hl(x, h - 17, 3, T[5])
    L.rect(w // 2 - 11, h - 30, 22, 8, T[4]); L.vl(w // 2 - 11, h - 30, 8, T[6])
    for x in range(w // 2 - 9, w // 2 + 9, 4):
        L.rect(x, h - 28, 2, 5, G[0])
    for y in sub(0, 14):
        hw = 11 * math.sqrt(max(0, 1 - ((13 - y) / 14.0) ** 2))
        xl = int(w / 2 - hw) if U == 1 else w / 2 - hw
        wd = int(2 * hw) if U == 1 else 2 * hw
        L.rect(xl, h - 44 + y, wd, D1, Gc[3]); L.rect(xl, h - 44 + y, max(1, int(hw * 0.7)) if U == 1 else max(1, hw * 0.7), D1, Gc[4]); L.rect(xl, h - 44 + y, 1, D1, Gc[5])
        L.rect(xl + wd - 1, h - 44 + y, 1, D1, Gc[1])
    L.rect(w // 2 - 2, h - 50, 4, 6, T[5]); L.vl(w // 2, h - 54, 4, T[4]); L.px(w // 2, h - 54, R['yellow'][5])
    return L


def far_roofs(L, x0, x1, yb, rng, hmin=10, hmax=26, seed=9, brick=None):
    """A band of small far house fronts: flat tones, a few window dots. It takes most of the air."""
    x = x0
    while x < x1:
        w = rng.randint(9, 16); h = rng.randint(hmin, hmax)
        B = R[rng.choice(brick or BRICKS)]
        L.rect(x, yb - h, w, h, B[3]); L.vl(x, yb - h, h, B[4]); L.vl(x + w - 1, yb - h, h, B[2])
        k = rng.choice(['tri', 'step', 'flat'])
        if k == 'tri':
            for i in sub(0, w // 2):
                L.rect(x + w // 2 - i, yb - h - (w // 2 - i), 2 * i + (w % 2), D1, B[3]); L.rect(x + w // 2 - i, yb - h - (w // 2 - i), 1, D1, R['plaster'][5])
        elif k == 'step':
            L.rect(x + 2, yb - h - 3, w - 4, 3, B[3]); L.rect(x + 4, yb - h - 6, max(1, w - 8), 3, B[3]); L.hl(x + 2, yb - h - 3, w - 4, R['plaster'][5])
        else:
            L.hl(x, yb - h, w, R['plaster'][5]); L.rect(x + 1, yb - h - 3, w - 2, 3, R['roof_slate'][3])
        for wy in range(yb - h + 3, yb - 3, 5):
            for wx in range(x + 2, x + w - 2, 3):
                L.vl(wx, wy, 2, R['glass'][1])
        x += w


def far_bank(F, rng, YH=120, YQ=125, YW=135, gap=None, bridge='arch', house=None, trees=None, cars=0.5, lamp_step=96,
             lit=False, AIR=None, sun_shade=True, boats=(), vista_kw=None, seed=100, bikes=0.55, vista3=None, arches=1):
    """The far bank in one layer: house row, street, trees, parked cars, lamps, quay wall, boats, and
       (with gap) a side canal with its bridge. Returns what the light passes need."""
    WF = F.w
    house = dict(house or {})
    out = dict(win=[], lamps=[], vista=[], blamps=[], shops=[], doors=[], boatwin=[])
    if gap:
        GX0, GX1 = gap
        qv = vista3.get('qw', 22) if vista3 is not None else 0
        WL, WR = GX0 + qv, GX1 - qv                  # the water of the side canal. Its quays are solid ground.
        infos = house_row(F, 0, GX0, YH, rng, seed=seed, **house)
        infos += house_row(F, GX1, WF, YH, rng, seed=seed + 200, **house)
    else:
        GX0, GX1 = -99, -99
        infos = house_row(F, 0, WF, YH, rng, seed=seed, **house)
    for i in infos:
        out['win'] += i['win']
        if i.get('lamp'):
            out['doors'].append(i['lamp'])
        if i.get('shop'):
            m, sy, sw, shh = i['shop']
            out['shops'].append((i['x'] + m, i['y'] + sy, sw, shh))
    tl = []
    if trees:
        x = trees.get('x0', 30)
        while x < WF - 20:
            if not (GX0 - 30 < x < GX1 + 30):
                t = tree_far(rng, rng.randint(*trees.get('cw', (42, 52))), rng.randint(*trees.get('ch', (36, 44))),
                             rng.randint(*trees.get('th', (22, 27))), leaf=trees.get('leaf', 'leaf'), seed=rng.randint(1, 999),
                             bare=trees.get('bare', 0.0))
                tl.append((x - t.w // 2, YQ - t.h, t))
            x += rng.randint(*trees.get('step', (78, 112)))
        if sun_shade:
            for (tx, ty, t) in tl:
                m = np.zeros((F.ph, F.pw), bool)
                cm = t.mask()
                yy0, xx0 = PX(ty + 9), PX(tx + 8)
                h_, w_ = cm.shape
                x1_ = min(F.pw, xx0 + w_); y1_ = min(PX(YH), yy0 + h_)
                if x1_ > max(0, xx0) and y1_ > yy0:
                    m[yy0:y1_, max(0, xx0):x1_] = cm[:y1_ - yy0, max(0, -xx0):x1_ - xx0]
                shade(F, m)
    if gap:
        far_street(F, 0, WL if vista3 is not None else GX0, YH, YQ, rng, 1); far_street(F, WR if vista3 is not None else GX1, WF, YH, YQ, rng, 2)
    else:
        far_street(F, 0, WF, YH, YQ, rng, 1)
    for i in infos:
        if rng.random() < bikes:
            F.blit(bike_far(rng), i['x'] + rng.randint(2, max(3, i['w'] - 14)), YH - 5)
    if gap:
        if vista3 is not None:
            # the side canal is drawn by the page in true perspective. Here: its data, and a flat copy for the mirror in the water
            V = Layer(F.w, F.h)
            out['vista'] = vista(V, GX0, GX1, random.Random(seed + 5), AIR, ystreet=YQ - 2, ywater=YW, yh=YH - 10, **(vista_kw or {}))
            out['vista_refl'] = V
            out['vista3'] = vista3d((GX0, GX1), YH, YQ, YW, AIR, seed=seed + 77, **vista3)
        else:
            out['vista'] = vista(F, GX0, GX1, rng, AIR, ystreet=YQ - 2, ywater=YW, yh=YH - 10, **(vista_kw or {}))
        if bridge == 'arch':
            BR, holes, bl = arch_bridge(WR - WL + 10, YW - YQ + 5, arches, rng)
            F.blit(BR, WL - 5, YW - BR.h)
            out['blamps'] = [(WL - 5 + a, YW - BR.h + b) for (a, b) in bl]
            out['arch'] = (WL - 5, YW - BR.h, BR.w, BR.h)
        elif bridge == 'draw':
            BR = drawbridge(WR - WL + 16, 30, rng)
            F.blit(BR, WL - 8, YQ - 1 - 30)
        for bx in (WL + 5, (WL + WR) // 2 - 6, WR - 17):
            F.blit(bike_far(rng), bx, YQ - 10 if bridge == 'arch' else YQ - 8)
    x = 8
    while x < WF - 20:
        if not (GX0 - 12 < x < GX1 + 6):
            k = rng.random()
            if k < cars:
                c = car_far(rng); F.blit(c, x, YQ - c.h + 1); x += c.w + rng.randint(3, 12)
            elif k < cars + 0.25:
                for j in range(rng.randint(1, 4)):
                    F.blit(bike_far(rng), x, YQ - 7); x += 9
                x += 4
            else:
                x += rng.randint(6, 16)
        else:
            x += 10
    for lx in range(22, WF, lamp_step):
        if not (GX0 - 12 < lx < GX1 + 8):
            F.blit(lamp_far(27, lit), lx, YQ - 26)
            out['lamps'].append((lx + 2, YQ - 23))
    for (tx, ty, t) in tl:
        F.blit(t, tx, ty)
    if gap:
        bollards_far(F, 0, WL - 8, YQ + 1, rng); bollards_far(F, WR + 8, WF, YQ + 1, rng)
        quay_wall(F, 0, YQ, WL - (2 if bridge == 'arch' else 8), YW - YQ, rng, 7)
        quay_wall(F, WR + (2 if bridge == 'arch' else 8), YQ, WF - WR - 2, YW - YQ, rng, 8)
    else:
        bollards_far(F, 0, WF, YQ + 1, rng)
        quay_wall(F, 0, YQ, WF, YW - YQ, rng, 7)
    for (kind, bx, arg) in boats:
        if kind == 'house':
            b, wins = houseboat(rng, arg[0], arg[1]); by = YW - b.h + 2
        elif kind == 'barge':
            b, wins = barge(rng, arg[0], arg[1] if len(arg) > 1 else None); by = YW - b.h + 3
        elif kind == 'tour':
            b, wins = tourboat(rng, arg[0]), []; by = YW - b.h + 2
        else:
            b, wins = sloop(rng, arg[0], arg[1]), []; by = YW - 7
        F.blit(b, bx, by)
        out['boatwin'] += [(bx + a, by + c, d, e) for (a, c, d, e) in wins]
    F.clear(0, YW + 1, F.w, F.h)
    out['trees'] = tl
    out['infos'] = infos
    return out


def light_windows(L, wins, frac, rng, warm=((255, 232, 150), (255, 196, 96), (226, 140, 60)), bar=(92, 52, 30)):
    """Night: some windows are lit. Yellow at the top, orange below, the glazing bars stay dark."""
    lit = []
    for (x, y, w, h) in wins:
        if w < 1 or h < 2 or rng.random() > frac:
            continue
        k = rng.random()
        for j in range(h):
            c = warm[0] if j < h * 0.45 else (warm[1] if j < h * 0.8 else warm[2])
            if k < 0.3 and j > h * 0.4:
                c = warm[2]                                           # a curtain
            L.hl(x, y + j, w, c)
        if w >= 5:
            L.vl(x + w // 2, y, h, bar, t=TH)
        if h >= 6:
            L.hl(x, y + (h * 2) // 5, w, bar, t=TH)
        lit.append((x + w // 2, y + h // 2))
    return lit


def lightpool(N, cx, cy, rx, ry, y_top, warm=(255, 204, 116), a1=0.56, a2=0.30):
    """The pool of light of a lamp on the ground: two steps toward the lamp colour, the outer one thinned by a checker."""
    xx, yy = grid(0, 0, N.w, N.h)
    d = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2
    g = (yy >= y_top) & N.mask()
    ck = chk(xx, yy)
    inner = (d < 0.36) | ((d < 0.5) & ck)
    outer = ((d < 0.85) | ((d < 1.0) & ck)) & ~inner
    for m, a in ((inner & g, a1), (outer & g, a2)):
        if m.any():
            px = N.a[..., :3][m].astype(float)
            N.a[..., :3][m] = snap5(px + (np.array(warm, float) - px) * a)


def overcast(w, h, stops, n=11, seed=4, soft=0.4):
    """A full cloud deck: large masses with paler under-sides, cut to tones with the checker dither."""
    L = Layer(w, h)
    pal = gradient_pal(stops, n)
    xx, yy = grid(0, 0, w, h)
    t = yy / (h - 1)
    big = fbm(xx / 58.0 + yy / 90.0, yy / 17.0, seed, 4)
    fine = fbm(xx / 13.0, yy / 5.0, seed + 3, 2)
    v = 0.10 + 0.62 * t + (big - 0.5) * 0.95 + (fine - 0.5) * 0.16
    idx = tones(v, n, xx, yy, soft)
    L.a[..., :3] = np.array(pal, np.uint8)[idx]; L.a[..., 3] = 255
    return L, pal


def _hex(c):
    return '#%02x%02x%02x' % tuple(int(v) for v in c)


def vista3d(gap, YH, YQ, YW, AIR, key=None, speed=0.5, far_m=0.25, far_sat=0.30, sc=1.0, zmax=5.2, qw=22, house=None,
            leaf='leaf', bare=0.0, lit=None, wcols=((30, 58, 68), (62, 100, 108), (150, 200, 226)), seed=5, tree=None, light_fn=None):
    """A side canal that runs away from the viewer, as data for a perspective draw at run time.
       Depth z = 1 is the plane of the far bank; a thing at depth z scrolls at speed / z and has size 1 / z.
       Returned images: the two rows of fronts as long strips (each house already has the air of its depth),
       the water seen from above, the trees, the far end. The page maps them column by column."""
    rng = random.Random(seed)
    u0, u1 = gap
    K = 210.0 * sc                               # strip pixels per unit of depth (the far bank is about 35 m away)
    yh = YH - int(round(10 * sc)); ys = YQ - 2; yw = YW
    step = (0.86 - far_m) / (zmax - 1)

    def gz(z):
        return grader(key=key, air=(AIR[0], AIR[1], min(0.9, far_m + step * (z - 1)), far_sat))

    hk = dict(house or {})
    hk.setdefault('sc', sc)
    wallH = hk.get('hmax', 86) + 34
    length = int((zmax - 1) * K)
    walls = []
    for s in (0, 1):
        W = Layer(length, wallH)

        def post(H, info, x):
            z = 1 + (x + info['w'] / 2) / K
            H.recolor(gz(z), keep=EM)
            if light_fn:
                light_fn(H, info, rng)
            elif lit:
                light_windows(H, info['win'], lit, rng)
        house_row(W, 0, length, wallH, rng, seed=seed + 400 * (s + 1), post=post, **hk)
        walls.append(W)
    # the water, seen from above: row 0 is depth 1. The middle takes the sky, the sides take the fronts.
    ww = (u1 - u0) - 2 * qw
    kw = 48.0 * sc
    wl = int((zmax - 1) * kw)
    WT = Layer(ww, wl)
    xx, rr = grid(0, 0, ww, wl)
    z = 1 + rr / kw
    lat = np.abs(xx + 0.5 * D1 - ww / 2) / (ww / 2)
    n = fbm(xx / 3.0, rr / 7.0, seed + 31, 3)
    pal = [mix(wcols[0], wcols[1], t) for t in (0.0, 0.4, 0.8)] + [mix(wcols[1], wcols[2], t) for t in (0.3, 0.65, 1.0)]
    v = 0.86 - lat * 0.62 + (n - 0.5) * 0.55
    idx = np.clip(np.floor(v * len(pal)), 0, len(pal) - 1).astype(int)
    base = np.array(pal, float)[idx]
    r = 14.0 * sc
    while r < wl - 20 * sc:                                              # boats moored along both quays
        for side in (0, 1):
            if rng.random() < 0.6:
                bx = (3.2 * sc) if side == 0 else ww - 3.2 * sc
                hl_, hw_ = rng.uniform(8, 13) * sc, 2.6 * sc
                d = ((xx + 0.5 * D1 - bx) / hw_) ** 2 + ((rr - r) / hl_) ** 2
                col = rng.choice([(40, 44, 60), (96, 40, 36), (36, 70, 60), (200, 200, 190)])
                base = np.where((d <= 1)[..., None], np.array(col, float), base)
                base = np.where((d <= 0.35)[..., None], np.array(mix(col, (220, 214, 196), 0.55), float), base)
        r += rng.uniform(26, 40) * sc
    base = base * np.where(z < 1.09, 0.62, np.where(z < 1.20, 0.80, 1.0))[..., None]     # the shade of the bridge on the first water
    out = np.zeros(base.shape, np.uint8)
    NS = 14
    zi = np.clip(np.floor((z - 1) / (zmax - 1) * NS), 0, NS - 1)
    for k in range(NS):
        m = zi == k
        if m.any():
            zz = 1 + (k + 0.5) * (zmax - 1) / NS
            out[m] = grader(air=(AIR[0], AIR[1], min(0.8, step * (zz - 1) * 0.85), 0.2))(base[m])
    WT.a[..., :3] = out; WT.a[..., 3] = 255
    # the far end: a cross street
    we = int(math.ceil((u1 - u0) / zmax)) + 1
    he = int(112 * sc / zmax) + 6
    E = Layer(we, he)
    far_roofs(E, 0, we, he, rng, int(60 * sc / zmax), int(90 * sc / zmax))
    E.recolor(gz(zmax + 0.8))
    # trees on both quays
    tk = dict(tree or {})
    items = []
    for s in (0, 1):
        z = 1.2 + (0.12 if s else 0.0)
        while z < zmax - 0.2:
            t = tree_far(rng, rng.randint(*tk.get('cw', (42, 52))), rng.randint(*tk.get('ch', (36, 44))), rng.randint(*tk.get('th', (22, 27))),
                         leaf=leaf, seed=rng.randint(1, 999), bare=bare)
            t.recolor(gz(z))
            items.append((s, z, t))
            z += rng.uniform(0.36, 0.52)
    cw_ = max(t.w for (_, _, t) in items) + 2
    ch_ = max(t.h for (_, _, t) in items)
    AT = Layer(cw_ * len(items), ch_)
    trees = []
    for i, (s, z, t) in enumerate(items):
        AT.blit(t, i * cw_ + (cw_ - t.w) // 2, ch_ - t.h)
        trees.append(dict(u=(u0 + qw - 5 * sc) if s == 0 else (u1 - qw + 5 * sc), z=round(z, 3), sx=i * cw_, sw=cw_, sh=ch_))
    trees.sort(key=lambda d: -d['z'])
    NC = 16
    zs = [1 + (k + 0.5) * (zmax - 1) / NC for k in range(NC)]
    one = lambda ramp_, i, z_: _hex(gz(z_)(np.array([ramp_[i]], float))[0])
    data = dict(u0=u0, u1=u1, yh=yh, ys=ys, yw=yw, qw=qw, zmax=zmax, K=K, kw=kw, wallH=wallH, speed=speed, endW=we, endH=he,
                street=[one(R['pave_red'], 4, z_) for z_ in zs], quay=[one(R['brick_brown'], 2, z_) for z_ in zs],
                cope=[one(R['stone'], 5, z_) for z_ in zs], trees=trees)
    return dict(v=data, imgs=dict(wallL=walls[0], wallR=walls[1], water=WT, end=E, trees=AT))
