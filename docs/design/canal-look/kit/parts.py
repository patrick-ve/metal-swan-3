# Scenery parts for the canal scenes: ramps, canal houses, trees, street furniture, boats, quay walls.
# All parts are painted in daylight local colour. A scene grades them to its hour and its air.
import math
import random
import numpy as np
from kit import *

# ---------------------------------------------------------------- ramps (dark -> light, 7 tones unless noted)
R = dict(
    brick_red=ramp(7, .25, .73, .050, .110, .080, 14, 58),
    brick_brown=ramp(7, .21, .64, .032, .072, .058, 352, 56),
    brick_purple=ramp(7, .22, .62, .038, .062, .048, 332, 32),
    brick_ochre=ramp(7, .31, .83, .042, .098, .074, 46, 88),
    brick_black=ramp(7, .16, .54, .014, .022, .020, 285, 250),
    brick_rose=ramp(7, .30, .80, .040, .085, .060, 8, 50),
    plaster=ramp(7, .43, .975, .030, .016, .028, 285, 96),
    stone=ramp(7, .30, .90, .022, .014, .028, 292, 90),
    glass=ramp(7, .17, .86, .030, .058, .035, 262, 212),
    green=ramp(7, .16, .62, .030, .068, .064, 192, 150),
    red=ramp(7, .20, .72, .070, .165, .120, 14, 42),
    blue=ramp(7, .18, .72, .040, .105, .080, 276, 234),
    yellow=ramp(7, .32, .90, .060, .140, .120, 60, 100),
    roof_tile=ramp(7, .26, .70, .058, .118, .092, 14, 52),
    roof_slate=ramp(7, .18, .60, .022, .030, .022, 282, 246),
    leaf=ramp(7, .21, .82, .040, .122, .132, 176, 120),
    leaf_autumn=ramp(7, .23, .86, .052, .128, .130, 34, 98),
    bark=ramp(7, .15, .60, .020, .036, .042, 332, 76),
    pave_red=ramp(7, .23, .68, .032, .062, .046, 6, 46),
    pave_grey=ramp(7, .27, .80, .012, .012, .020, 286, 86),
    iron=ramp(7, .11, .56, .016, .026, .020, 232, 190),
    wood=ramp(7, .21, .76, .036, .072, .062, 30, 82),
    white=ramp(7, .46, .99, .030, .014, .018, 282, 100),
    black=ramp(7, .10, .46, .012, .016, .014, 290, 260),
    canvas=ramp(7, .30, .82, .030, .050, .050, 90, 100),
    moss=ramp(7, .18, .62, .035, .080, .095, 150, 118),
)

EM = [(255, 250, 206), (255, 226, 140), (250, 170, 82)]      # colours of lit things: they keep their colour at night

FONT = {
    'A': ["010", "101", "111", "101", "101"], 'B': ["110", "101", "110", "101", "110"], 'C': ["011", "100", "100", "100", "011"],
    'D': ["110", "101", "101", "101", "110"], 'E': ["111", "100", "110", "100", "111"], 'F': ["111", "100", "110", "100", "100"],
    'I': ["1", "1", "1", "1", "1"], 'K': ["101", "101", "110", "101", "101"], 'L': ["100", "100", "100", "100", "111"],
    'M': ["10001", "11011", "10101", "10001", "10001"], 'O': ["010", "101", "101", "101", "010"], 'R': ["110", "101", "110", "101", "101"],
    'S': ["011", "100", "010", "001", "110"], 'T': ["111", "010", "010", "010", "010"], 'N': ["1001", "1101", "1011", "1001", "1001"],
    'H': ["101", "101", "111", "101", "101"], 'U': ["101", "101", "101", "101", "111"], 'P': ["110", "101", "110", "100", "100"],
    'G': ["0111", "1000", "1011", "1001", "0110"], 'W': ["10001", "10001", "10101", "11011", "10001"], 'X': ["101", "101", "010", "101", "101"],
    ' ': ["0", "0", "0", "0", "0"],
}


def text_w(t):
    return sum(len(FONT[ch][0]) + 1 for ch in t) - 1


def text(L, x, y, t, c):
    for ch in t:
        g = FONT[ch]
        for j, row in enumerate(g):
            for i, v in enumerate(row):
                if v == '1':
                    L.px(x + i, y + j, c)
        x += len(g[0]) + 1


# ---------------------------------------------------------------- brick
def brickfill(L, x, y, w, h, B, seed, mask=None, cw=4, chh=2, lo=1, hi=5, mid=3, streaks=False):
    """Brick seen from far: a mid tone, soft stains, and single bricks one tone up or down.
       The higher tiers use smaller bricks. Tier 4 also shows the joints."""
    if w <= 0 or h <= 0:
        return
    xx, yy = grid(x, y, w, h)
    if xx.size == 0:
        return
    n1 = fbm((xx + seed * 31) / 13.0, yy / 10.0, seed, 3)
    idx = np.full(xx.shape, mid) + (n1 > 0.60).astype(int) - (n1 < 0.40).astype(int)
    cw_, ch_ = cw / DET, chh / DET
    row = np.floor(yy / ch_ + 1e-6)
    off = (row % 2) * ((cw // 2) / DET)
    col = np.floor((xx + off) / cw_ + 1e-6)
    cell = hash01(col, row, seed + 1)
    idx = idx + (cell > 0.88).astype(int) - (cell < 0.15).astype(int)
    if U >= 4:
        fy = yy / ch_ - row; fx = (xx + off) / cw_ - col
        joint = (fy > 1 - 1.01 / (ch_ * U)) | (fx > 1 - 1.01 / (cw_ * U))
        idx = idx - (joint & (hs(xx, yy, seed + 8) > 0.3)).astype(int)
    if streaks:
        tt = (yy - y) / max(h, 1)
        hh_ = hs(xx, yy, seed + 6)
        idx = idx + ((tt < 0.20) & (hh_ > 0.55)).astype(int) - ((tt > 0.88) & (hh_ > 0.45)).astype(int)
        st = vnoise((xx + seed * 13) / 2.3, yy / 34.0, seed + 2)
        idx = idx - ((st > 0.80) & (hs(xx, yy, seed + 4) > 0.3)).astype(int)
    idx = np.clip(idx, lo, hi)
    m = np.ones(xx.shape, bool) if mask is None else mask
    if m.shape != xx.shape:
        return
    L.put(x, y, np.array(B, np.uint8)[idx], m)


def window(L, x, y, w, h, T, G, rng, B=None, kind=None, sill=True):
    """A sash window: light frame, dark glass, glazing bars, a sill with its shade. Returns the glass box."""
    L.rect(x, y, w, h, T[5])
    L.hl(x, y, w, T[6]); L.vl(x, y, h, T[6])
    L.vl(x + w - 1, y, h, T[4]); L.hl(x, y + h - 1, w, T[4])
    gx, gy, gw, gh = x + 1, y + 1, w - 2, h - 2
    if gw <= 0 or gh <= 0:
        return (x, y, w, h)
    L.rect(gx, gy, gw, gh, G[1])
    L.hl(gx, gy, gw, G[0])                                  # shade of the lintel
    k = kind or rng.choices(['glint', 'curtain', 'sky', 'dark', 'blind'], [34, 26, 18, 14, 8])[0]
    if k == 'glint':
        if U == 1:
            for i in range(gh):
                xx = gx + gw - 1 - (i * gw) // max(gh, 1)
                L.px(xx, gy + i, G[3])
                if gw > 3 and i % 2 == 0:
                    L.px(xx - 1, gy + i, G[2])
        else:                                               # a slanted band of sky in the glass
            L.poly([(gx + gw * 0.5, gy + 1), (gx + gw, gy + 1), (gx + gw * 0.5, gy + gh), (gx, gy + gh)], G[2])
            L.poly([(gx + gw * 0.72, gy + 1), (gx + gw * 0.92, gy + 1), (gx + gw * 0.2, gy + gh), (gx, gy + gh)], G[3])
    elif k == 'curtain':
        top = gy + max(1, gh // 3)
        L.rect(gx, top, gw, gy + gh - top, T[4])
        i = gx
        while i < gx + gw - 1e-6:
            L.vl(i, top, gy + gh - top, T[3], t=TH)
            i += 2 / DET
        L.vl(gx + gw // 2, top, gy + gh - top, G[1], t=TH)
    elif k == 'sky':
        L.rect(gx, gy + 1, gw, max(1, gh // 2), G[3])
        L.rect(gx, gy + 1, max(1, gw // 2), max(1, gh // 3), G[4])
        L.px(gx, gy + 1, G[5])
    elif k == 'blind':
        j = gy + 1
        while j < gy + gh - 1e-6:
            L.hl(gx, j, gw, T[3], t=TH)
            j += 2 / DET
    else:
        L.rect(gx, gy + 1, gw, gh - 1, G[0])
        L.px(gx + gw - 1, gy + gh - 1, R['leaf'][3]); L.px(gx + gw - 2, gy + gh - 1, R['leaf'][2])
        if gh > 5:
            L.px(gx + gw - 1, gy + gh - 2, R['leaf'][4])
    # glazing bars
    if gw >= 5:
        L.vl(gx + gw // 2, gy, gh, T[5], t=TH)
    if gw >= 11:
        L.vl(gx + gw // 4, gy, gh, T[5], t=TH); L.vl(gx + (3 * gw) // 4, gy, gh, T[5], t=TH)
    if gh >= 6:
        L.hl(gx, gy + (gh * 2) // 5, gw, T[5], t=TH)
    if gh >= 13:
        L.hl(gx, gy + (gh * 7) // 10, gw, T[5], t=TH)
    if sill:
        L.hl(x - 1, y + h, w + 2, T[6])
        if B:
            L.hl(x - 1, y + h + 1, w + 2, B[1]); L.px(x + w + 1, y + h + 1, B[2])
            L.vl(x + w, y + 1, h - 1, B[1])                    # the reveal in shade (light from the left)
            L.hl(x, y - 1, w, B[5])                            # brick lintel
    return (gx, gy, gw, gh)


def shutter_window(L, x, y, w, h, B, Sh, G, rng, arch=True, open_=True):
    """A warehouse opening with wooden shutters."""
    sw = max(2, w // 3)
    L.rect(x, y, w, h, G[0])
    if arch:
        L.px(x, y, B[2]); L.px(x + w - 1, y, B[2])
    L.hl(x, y - 1, w, B[5])
    if open_:
        for sx in (x - sw, x + w):
            L.rect(sx, y, sw, h, Sh[3])
            L.vl(sx, y, h, Sh[5]); L.vl(sx + sw - 1, y, h, Sh[1])
            L.hl(sx, y + h // 2, sw, Sh[1]); L.hl(sx, y, sw, Sh[4]); L.hl(sx, y + h - 1, sw, Sh[1])
        L.px(x + w // 2, y + h - 2, G[2])
    else:
        L.rect(x, y, w, h, Sh[3]); L.vl(x + w // 2, y, h, Sh[1]); L.vl(x, y, h, Sh[5])
        L.hl(x, y + h // 2, w, Sh[2]); L.hl(x, y, w, Sh[1])
    L.hl(x - (sw if open_ else 0), y + h, w + (2 * sw if open_ else 0), B[1])
    return (x, y, w, h)


GABLE_H = {'neck': 27, 'bell': 22, 'step': 24, 'spout': 19, 'cornice': 13}


def house(rng, w, hb, kind='neck', brick='brick_red', trim='plaster', doorc='green', sc=1.0, shop=None,
          warehouse=False, seed=0):
    """One canal house, seen from the front. Returns (Layer, info). info['win']: glass boxes (for lights at night)."""
    B = R[brick]; T = R[trim]; G = R['glass']; S = R['stone']; I = R['iron']; D = R[doorc]
    gh = int(round(GABLE_H[kind] * (0.75 + 0.25 * sc))) + (rng.randint(-1, 2) if kind != 'cornice' else 0)
    H = hb + gh
    L = Layer(w, H)
    info = dict(win=[], kind=kind, w=w, h=H, gh=gh, lamp=None)
    cx = w / 2.0
    q = lambda v: int(math.floor(v + 0.5))
    # ---- roof behind the gable
    RT = R[rng.choice(['roof_tile', 'roof_tile', 'roof_slate'])]
    if kind in ('neck', 'bell', 'spout', 'step'):
        rh = int(gh * (0.62 if kind == 'neck' else 0.45))
        for i in sub(0, rh):
            t = (i + D1) / rh
            hw = (w / 2 - 1) * t
            y = gh - rh + i
            xl, xr = rq(cx - hw), rq(cx + hw)
            odd = int(i * DET) % 2
            L.rect(xl, y, xr - xl, D1, RT[3] if odd else RT[2])
            L.rect(xl, y, max(1, (xr - xl) // 2 if U == 1 else (xr - xl) / 2), D1, RT[4] if odd else RT[3])
            L.rect(xl, y, 1, D1, RT[5]); L.rect(xr - 1, y, 1, D1, RT[1])
        if rng.random() < 0.7:                                   # chimney
            chx = q(cx + rng.choice([-1, 1]) * w * 0.30) - 2
            chy = gh - rh // 2 - 7
            L.rect(chx, chy, 4, 8, B[2]); L.vl(chx, chy, 8, B[4]); L.hl(chx - 1, chy, 6, S[5]); L.hl(chx - 1, chy + 1, 6, S[2])
            L.vl(chx + 1, chy - 2, 2, RT[4]); L.vl(chx + 3, chy - 2, 2, RT[2])
    # ---- gable
    if kind == 'neck':
        nw = max(10, q(w * 0.46))
        if (w - nw) % 2:
            nw += 1
        nx = (w - nw) // 2
        ped = max(4, q(5 * sc))
        brickfill(L, nx, ped, nw, gh - ped, B, seed + 3)
        L.vl(nx, ped, gh - ped, B[5]); L.vl(nx + nw - 1, ped, gh - ped, B[1])
        for i in sub(0, ped):                                    # pediment
            hw = (nw / 2 + 1) * (i + D1) / ped
            xl, xr = rq(cx - hw), rq(cx + hw)
            L.rect(xl, i, xr - xl, D1, T[5]); L.rect(xl, i, min(1, xr - xl), D1, T[6]); L.rect(xr - 1, i, 1, D1, T[3])
        L.hl(nx - 1, ped, nw + 2, T[6]); L.hl(nx - 1, ped + 1, nw + 2, T[3]); L.hl(nx, ped + 2, nw, B[1])
        chh = max(4, int((gh - ped - 4) * 0.62))
        ys = gh - chh
        for dy in sub(0, chh):                                   # the sandstone claw pieces: a concave scroll
            t = min(1.0, dy / max(chh - 1, 1))
            ext = rq((nx - 1) * t ** 1.7)
            if ext <= 0:
                continue
            y = ys + dy
            e1 = min(1, ext)
            L.rect(nx - ext, y, ext, D1, T[5]); L.rect(nx - ext, y, e1, D1, T[6])
            L.rect(nx + nw, y, ext, D1, T[4]); L.rect(nx + nw + ext - e1, y, e1, D1, T[2]); L.rect(nx + nw, y, e1, D1, T[5])
        L.px(nx - 2, gh - 2, T[3]); L.px(nx + nw + 1, gh - 2, T[2])
        ly = ped + 7
        lh = max(5, q(7 * sc))
        L.rect(q(cx) - 2, ly, 4, lh, T[5]); L.rect(q(cx) - 1, ly + 1, 2, lh - 1, D[2]); L.vl(q(cx) - 1, ly + 1, lh - 1, D[3])
        info['win'].append((q(cx) - 1, ly + 1, 2, lh - 1))
        hb_y = ped + 3
    elif kind == 'bell':
        thw = 4
        for y in sub(3, gh):
            t = min(1.0, (y - 3) / max(gh - 4, 1))
            f = 0.5 - 0.5 * math.cos(math.pi * t ** 1.25)
            hw = thw + (w / 2 - thw) * f
            xl, xr = rq(cx - hw), rq(cx + hw)
            brickfill(L, xl, y, xr - xl, D1, B, seed + 3)
            L.rect(xl, y, 1, D1, T[6]); L.rect(xl + 1, y, 1, D1, T[5]); L.rect(xr - 1, y, 1, D1, T[3]); L.rect(xr - 2, y, 1, D1, T[5])
        L.hl(q(cx) - thw - 1, 2, 2 * thw + 2, T[5]); L.hl(q(cx) - 3, 1, 6, T[6]); L.hl(q(cx) - 1, 0, 2, T[6])
        L.px(q(cx) + thw, 2, T[3])
        ly = 8
        lh = max(5, q(7 * sc))
        L.rect(q(cx) - 2, ly, 4, lh, T[5]); L.rect(q(cx) - 1, ly + 1, 2, lh - 1, G[0])
        info['win'].append((q(cx) - 1, ly + 1, 2, lh - 1))
        hb_y = 5
    elif kind == 'step':
        n = max(3, gh // 5)
        sh = (gh - 3) / n
        pl, pr = None, None
        for k in range(n):
            hw = 3 + (w / 2 - 3) * (k + 1) / n
            y0, y1 = 3 + q(k * sh), 3 + q((k + 1) * sh)
            xl, xr = q(cx - hw), q(cx + hw)
            brickfill(L, xl, y0, xr - xl, y1 - y0, B, seed + 3)
            L.vl(xl, y0, y1 - y0, B[5]); L.vl(xr - 1, y0, y1 - y0, B[1])
            if pl is None:
                L.hl(xl, y0, xr - xl, T[6])
            else:
                L.hl(xl, y0, pl - xl, T[6]); L.hl(pr, y0, xr - pr, T[5])
                L.hl(xl, y0 + 1, pl - xl, B[2]); L.hl(pr, y0 + 1, xr - pr, B[1])
            pl, pr = xl, xr
        L.rect(q(cx) - 1, 0, 2, 3, T[5]); L.px(q(cx) - 1, 0, T[6])
        ly = 3 + q(sh) + 2
        lh = max(5, q(6 * sc))
        L.rect(q(cx) - 2, ly, 4, lh, T[5]); L.rect(q(cx) - 1, ly + 1, 2, lh - 1, G[0])
        info['win'].append((q(cx) - 1, ly + 1, 2, lh - 1))
        hb_y = ly - 3
    elif kind == 'spout':
        sp, sw = 5, 6
        for y in sub(sp, gh):
            t = min(1.0, (y - sp) / max(gh - 1 - sp, 1))
            hw = sw / 2 + (w / 2 - sw / 2) * t
            xl, xr = rq(cx - hw), rq(cx + hw)
            brickfill(L, xl, y, xr - xl, D1, B, seed + 3)
            L.rect(xl, y, 1, D1, T[6]); L.rect(xr - 1, y, 1, D1, T[3])
        brickfill(L, q(cx) - 3, 1, 6, sp, B, seed + 4)
        L.hl(q(cx) - 4, 0, 8, T[6]); L.hl(q(cx) - 4, 1, 8, T[3])
        hb_y = sp + 2
    else:                                                        # cornice front with a hipped roof and a dormer
        rh = gh - 5
        for i in sub(0, rh):
            ins = rq(max(0.0, rh - 1 - i) * 1.3) + 2
            odd = int(i * DET) % 2
            L.rect(ins, i, w - 2 * ins, D1, RT[3] if odd else RT[2])
            L.rect(ins, i, (w - 2 * ins) // 2 if U == 1 else (w - 2 * ins) / 2, D1, RT[4] if odd else RT[3]); L.rect(ins, i, 1, D1, RT[5])
        dw = max(7, q(8 * sc))
        dx = q(cx) - dw // 2
        L.rect(dx, -0 + 0, dw, rh, T[5]); L.hl(dx - 1, 0, dw + 2, T[6]); L.vl(dx + dw - 1, 1, rh - 1, T[3])
        L.rect(dx + 2, 2, dw - 4, rh - 3, G[0]); info['win'].append((dx + 2, 2, dw - 4, rh - 3))
        L.hl(-1, rh, w + 2, T[6]); L.hl(0, rh + 1, w, T[5]); L.hl(0, rh + 2, w, T[4])
        for i in range(1, w - 1, 2):
            L.px(i, rh + 3, T[5]); L.px(i + 1, rh + 3, T[2])
        L.hl(0, rh + 4, w, T[3])
        hb_y = None
    # ---- body
    brickfill(L, 0, gh, w, hb, B, seed, streaks=True)
    L.vl(0, gh, hb, B[5]); L.vl(w - 1, gh, hb, B[1]); L.vl(w - 2, gh, hb, B[2])
    if kind in ('neck', 'bell'):
        L.hl(0, gh, w, T[6]); L.hl(0, gh + 1, w, T[4]); L.hl(0, gh + 2, w, B[1])
    elif kind == 'cornice':
        L.hl(0, gh, w, B[1]); L.hl(0, gh + 1, w, B[2])
    # hoist beam with its hook
    if hb_y is not None:
        bx = q(cx) - 1
        L.rect(bx, hb_y, 3, 2, I[1]); L.hl(bx, hb_y, 3, I[3]); L.vl(bx + 1, hb_y + 2, 2, I[0]); L.px(bx + 2, hb_y + 4, I[0])
    # ---- floors
    ww = max(4, q(7 * sc)); m = max(2, q(3.4 * sc))
    ncol = 2 if w < 30 * sc else (3 if w < 46 * sc else 4)
    gap = (w - 2 * m - ncol * ww) / max(ncol - 1, 1)
    xs = [m + q(i * (ww + gap)) for i in range(ncol)]
    gf = q(27 * sc)
    st = q(6 * sc)                                               # the raised ground floor
    yb = gh + hb
    top = gh + (3 if kind in ('neck', 'bell') else 2)
    avail = yb - gf - top
    nf = max(1, q(avail / (20.0 * sc)))
    wts = [1.18 - 0.11 * i for i in range(nf)]                   # lower floors are taller
    tot = sum(wts)
    y = yb - gf
    floors = []
    for i in range(nf):
        fh = avail * wts[i] / tot
        floors.append((q(y - fh), q(y)))
        y -= fh
    for fi, (y0, y1) in enumerate(floors):
        fh = y1 - y0
        wh = max(4, fh - max(4, q(6.5 * sc)))
        wy = y0 + (fh - wh) // 2
        if kind == 'step':
            L.hl(1, y0, w - 2, T[5]); L.hl(1, y0 + 1, w - 2, B[2])     # white stone bands
        for i, x in enumerate(xs):
            if warehouse:
                if i == ncol // 2 or ncol == 2 and i == 0:
                    b = shutter_window(L, x, wy, ww, wh + 1, B, D, G, rng, open_=rng.random() < 0.8)
                else:
                    b = window(L, x, wy + 1, ww, max(4, wh - 2), T, G, rng, B, kind='dark' if rng.random() < .5 else None)
            else:
                b = window(L, x, wy, ww, wh, T, G, rng, B)
                if rng.random() < 0.10 and sc >= 0.9:                 # a window box with flowers
                    fc = R[rng.choice(['red', 'red', 'yellow', 'white'])]
                    L.hl(x, wy + wh - 1, ww, R['leaf'][2])
                    for xx in range(x, x + ww, 2):
                        L.px(xx + rng.randint(0, 1), wy + wh - 2, fc[4]); L.px(xx, wy + wh - 1, R['leaf'][4])
            info['win'].append(b)
        # wall anchors
        if fi > 0 and sc >= 0.9:
            for ax in (2, w - 3):
                L.vl(ax, y1 - 1, 2, I[1])
    # ---- ground floor
    y0 = yb - gf
    yf = yb - st
    L.rect(0, yf, w, st, S[2] if not warehouse else B[2]); L.hl(0, yf, w, S[5] if not warehouse else B[4])
    L.hl(0, yb - 1, w, S[1] if not warehouse else B[1])
    L.vl(0, yf, st, S[4] if not warehouse else B[4])
    di = rng.choice([0, ncol - 1]) if not shop else ncol - 1
    dw = ww + 1
    dh = gf - st - max(3, q(4 * sc))
    for i, x in enumerate(xs):
        if shop and i < ncol - 1:
            continue
        if i == di:
            dx = min(max(x, 1), w - dw - 1)
            dy = yf - dh
            L.rect(dx - 1, dy - 1, dw + 2, dh + 1, T[5]); L.vl(dx - 1, dy - 1, dh + 1, T[6]); L.vl(dx + dw, dy, dh, T[3])
            L.rect(dx, dy, dw, dh, D[2])
            fl = max(2, q(3 * sc))                                 # fanlight
            L.rect(dx, dy, dw, fl, G[1]); L.hl(dx, dy + fl, dw, T[5]); L.px(dx + dw // 2, dy + fl - 1, T[5]); L.px(dx + 1, dy, G[3])
            L.vl(dx, dy + fl + 1, dh - fl - 1, D[4]); L.vl(dx + dw - 1, dy + fl + 1, dh - fl - 1, D[1])
            if dw >= 6:
                L.rect(dx + 2, dy + fl + 2, dw - 4, max(1, (dh - fl) // 2 - 2), D[1])
                L.hl(dx + 2, dy + fl + 2, dw - 4, D[0])
                L.rect(dx + 2, dy + fl + (dh - fl) // 2 + 2, dw - 4, max(1, (dh - fl) // 2 - 3), D[1])
            L.px(dx + dw - 2, dy + fl + (dh - fl) // 2, R['yellow'][5])
            info['door'] = (dx, dy, dw, dh)
            # stoop: slab, steps to the side, iron rail
            side = 1 if dx < w / 2 else -1
            L.hl(dx - 1, yf, dw + 2, S[6]); L.hl(dx - 1, yf + 1, dw + 2, S[3])
            ns = max(2, st // 2)
            for k in range(ns):
                sx = dx + (dw + 1 + k * 2 if side > 0 else -3 - k * 2)
                sy = yf + q((k + 1) * st / (ns + 1))
                L.rect(sx, sy, 2, yb - sy, S[4]); L.hl(sx, sy, 2, S[6]); L.vl(sx + (1 if side > 0 else 0), sy + 1, yb - sy - 1, S[2])
            ex = dx + (dw + ns * 2 + 1 if side > 0 else -2 - ns * 2)
            L.line(dx + (dw if side > 0 else -1), yf - q(4 * sc), ex, yb - q(4 * sc) - 1, I[1], t=TH)
            L.vl(ex, yb - q(4 * sc) - 1, q(4 * sc), I[1]); L.vl(dx + (dw if side > 0 else -1), yf - q(4 * sc), q(4 * sc), I[2])
            if sc >= 0.9:
                info['lamp'] = (dx + (dw + 2 if side > 0 else -3), dy + 2)
        else:
            wh = gf - st - max(6, q(8 * sc))
            wy = yf - wh - max(2, q(2 * sc))
            b = window(L, x, wy, ww, wh, T, G, rng, B)
            info['win'].append(b)
            bw = max(3, ww - 2)                                    # basement window
            L.rect(x + 1, yf + 2, bw, max(2, st - 3), G[0]); L.hl(x + 1, yf + 1, bw, S[5]); L.px(x + 1, yf + 2, G[2])
    if shop:
        sw = xs[ncol - 1] - 2 - m
        sy = yb - gf + q(8 * sc)
        shh = yf - sy + (st - 2)
        L.rect(m, sy, sw, shh, T[5]); L.rect(m + 1, sy + 1, sw - 2, shh - 3, G[1])
        L.rect(m + 1, sy + 1, sw - 2, 2, G[0])
        for xx in range(m + 2, m + sw - 2, 3):                     # goods in the window
            L.px(xx, sy + shh - 4, R[rng.choice(['yellow', 'red', 'white', 'wood'])][4])
            L.px(xx + 1, sy + shh - 4, R[rng.choice(['yellow', 'red', 'wood'])][3])
        L.vl(m + sw // 2, sy + 1, shh - 3, T[5])
        L.hl(m, sy + shh - 2, sw, S[4]); L.hl(m, sy + shh - 1, sw, S[2])
        AW = R[shop[1]]
        ah = max(4, q(5 * sc))
        for j in range(ah):                                        # striped awning
            for xx in range(m - 1, m + sw + 1):
                c = AW[4 if j < ah - 1 else 3] if ((xx - j // 2) // 2) % 2 == 0 else R['white'][5 if j < ah - 1 else 4]
                L.px(xx, sy - 2 + j, c)
        L.hl(m - 1, sy - 2 + ah, sw + 2, G[0])
        tw = text_w(shop[0])
        ty = sy - 2 - 8
        if tw + 4 <= w - 2 and ty > y0 - 2:
            L.rect(q(cx) - tw // 2 - 2, ty, tw + 4, 7, D[1]); L.hl(q(cx) - tw // 2 - 2, ty, tw + 4, D[3])
            text(L, q(cx) - tw // 2, ty + 1, shop[0], R['yellow'][5])
            info['sign'] = (q(cx) - tw // 2, ty + 1, shop[0])
        info['shop'] = (m, sy, sw, shh)
        info['word'] = shop[0]
    # grime under the cornice and at the plinth, drainpipe
    if rng.random() < 0.55:
        px = w - 3 if rng.random() < 0.5 else 1
        L.vl(px, gh + 2, yb - gh - 3, I[2]); L.px(px, gh + 2, I[4])
        for yy in range(gh + 8, yb - 4, 14):
            L.px(px, yy, I[4])
    # ivy on some fronts
    if rng.random() < 0.16 and not warehouse and sc >= 0.9:
        LF = R['leaf']
        x0 = 0 if rng.random() < 0.5 else w - 9
        xx, yy = grid(x0, yb - gf - 16, 9, gf + 12)
        n = fbm(xx / 3.0, yy / 4.0, seed + 9, 2) + (yy - (yb - gf - 16)) / (gf + 12) * 0.35
        msk = n > 0.72
        tn = np.clip((fbm(xx / 1.7, yy / 1.7, seed + 11, 1) * 4).astype(int) + 1, 1, 4)
        cur = L.view(x0, yb - gf - 16, 9, gf + 12)[..., 3] > 0
        if cur.shape == msk.shape:
            L.put(x0, yb - gf - 16, np.array(LF, np.uint8)[tn], msk & cur)
    return L, info


BRICKS = ['brick_red', 'brick_brown', 'brick_purple', 'brick_ochre', 'brick_black', 'brick_rose', 'brick_red', 'brick_brown']
SHOPS = [('CAFE', 'red'), ('KAAS', 'yellow'), ('BLOEM', 'green'), ('BOEK', 'blue'), ('BAR', 'red'), ('FIETS', 'blue'), ('TABAK', 'green')]


def house_row(L, x0, x1, yb, rng, sc=1.0, hmin=64, hmax=86, wmin=30, wmax=46, kinds=None, warehouse=0.0, shops=0.16,
              seed=100, post=None, shop_list=None):
    """A row of canal houses from x0 to x1 with their feet on yb. Returns the list of infos (window boxes in layer space)."""
    kinds = kinds or ['neck', 'neck', 'bell', 'bell', 'step', 'spout', 'cornice', 'cornice']
    infos = []
    x = x0
    last = None
    i = 0
    while x < x1:
        w = rng.randint(wmin, wmax)
        if x1 - (x + w) < wmin * 0.6:
            w = x1 - x
        wh = rng.random() < warehouse
        kind = rng.choice(['spout', 'spout', 'step']) if wh else rng.choice(kinds)
        brick = rng.choice([b for b in BRICKS if b != last])
        last = brick
        hb = rng.randint(hmin, hmax)
        if kind == 'cornice':
            hb += q_(6 * sc)
        shop = rng.choice(shop_list or SHOPS) if (rng.random() < shops and not wh and w >= 36 * sc and sc >= 0.9) else None
        H, info = house(rng, w, hb, kind, brick, trim='plaster' if rng.random() < 0.8 else 'stone',
                        doorc=rng.choice(['green', 'green', 'black', 'red', 'blue']), sc=sc, shop=shop, warehouse=wh,
                        seed=seed + i * 7)
        if post:
            post(H, info, x)
        L.blit(H, x, yb - H.h)
        info['x'] = x; info['y'] = yb - H.h
        info['win'] = [(x + a, yb - H.h + b, c, d) for (a, b, c, d) in info['win']]
        if info.get('lamp'):
            info['lamp'] = (x + info['lamp'][0], yb - H.h + info['lamp'][1])
        if info.get('door'):
            info['door'] = (x + info['door'][0], yb - H.h + info['door'][1], info['door'][2], info['door'][3])
        if info.get('sign'):
            info['sign'] = (x + info['sign'][0], yb - H.h + info['sign'][1], info['sign'][2])
        infos.append(info)
        x += w
        i += 1
    return infos


def q_(v):
    return int(math.floor(v + 0.5))
