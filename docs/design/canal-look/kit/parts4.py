# Scenery parts, fourth file: set pieces for the museum square (a museum front, park things, the pond)
# and for the red light quarter (light on surfaces, neon, swans).
import math
import random
import numpy as np
from PIL import Image
from kit import *
from parts import R, EM, brickfill, q_, text, text_w, FONT
from parts2 import canopy

q = q_
FONT['V'] = ["101", "101", "101", "101", "010"]
T1 = 1 if U == 1 else 0.5                       # the width of a thin frame



def s5(c):
    return tuple(int(v) for v in snap5(np.array(c, float)))


def rows_fill(L, y0, y1, fl, fr, fn):
    """Fill a shape row by row (one real pixel per row). fl, fr: left and right edge at a y."""
    for y in sub(y0, y1):
        xl, xr = fl(y + 0.5 * D1), fr(y + 0.5 * D1)
        if U == 1:
            xl, xr = rq(xl), rq(xr)
        if xr - xl > 0:
            fn(xl, y, xr - xl)


def slate(L, RT):
    def fn(x, y, w):
        odd = int(math.floor(y * DET + 1e-6)) % 2
        L.rect(x, y, w, D1, RT[3] if odd else RT[2])
        L.rect(x, y, w * 0.42, D1, RT[4] if odd else RT[3])
        L.rect(x, y, min(1, w), D1, RT[5]); L.rect(x + w - min(1, w), y, min(1, w), D1, RT[1])
    return fn


def bands(L, x, y, w, h, S, step=4, first=0, tone=5):
    """Thin courses of pale stone in a brick wall."""
    yy = y + first
    while yy < y + h - 0.01:
        L.hl(x, yy, w, S[tone], t=TH)
        yy += step


def arch_win(L, x, y, w, h, S, G, mull=True, glint=False):
    """A round-arched window: stone surround, dark glass, a mullion and a transom at the spring line."""
    r = w / 2.0
    L.ellipse(x + r, y + r, r, r, S[5]); L.rect(x, y + r, w, h - r, S[5])
    L.ellipse(x + r, y + r, r - T1, r - T1, G[1]); L.rect(x + T1, y + r, w - 2 * T1, h - r - T1, G[1])
    L.ellipse(x + r, y + r - 0.2, r - T1, (r - T1) * 0.55, G[0])               # the shade of the arch
    if glint:
        L.line(x + w - 1 - T1, y + r + 1, x + T1 + 0.5, y + h - 2, G[3], t=TH)
    if mull and w >= 5:
        L.vl(x + r - 0.5, y + T1, h - 2 * T1, S[4], t=TH)
        L.hl(x + T1, y + r, w - 2 * T1, S[4], t=TH)
        if h - r > 10:
            L.hl(x + T1, y + r + (h - r) * 0.5, w - 2 * T1, S[4], t=TH)


def museum(seed=7):
    """The museum at the head of the square, an own impression in the Dutch neo-renaissance manner: two spired
       towers at a gabled centre with the passage arches, long wings with arched windows, corner pavilions.
       Painted in daylight colours, the ground line is the lower edge. Returns the Layer."""
    B = R['brick_red']; S = R['stone']; T = R['plaster']; G = R['glass']; RT = R['roof_slate']; Y = R['yellow']
    I = R['iron']; O = R['brick_ochre']; K = R['black']
    PV, WG, TW, CT = 36, 84, 24, 52
    W = 2 * (PV + WG + TW) + CT
    H = 126
    L = Layer(W, H)
    g = H
    hy = lambda h: g - h                            # height above the ground -> y
    rng = random.Random(seed)

    def wall(x, w, top, sd):
        brickfill(L, x, hy(top), w, top - 4, B, sd, streaks=True)
        bands(L, x, hy(16), w, 12, S, 3, 1)                                      # the banded ground floor
        L.rect(x, hy(4), w, 4, S[3]); L.hl(x, hy(4), w, S[5]); L.hl(x, g - 1, w, S[1])     # plinth
        L.hl(x, hy(17), w, S[6]); L.hl(x, hy(16), w, S[3])                      # string course

    def bay(cx):
        arch_win(L, cx - 3, hy(41), 6, 20, S, G, glint=rng.random() < 0.35)      # main floor
        L.hl(cx - 4, hy(21), 8, S[6]); L.hl(cx - 4, hy(20), 8, B[1])
        L.rect(cx - 3, hy(13), 6, 7, S[5])                                       # ground floor
        L.rect(cx - 3 + T1, hy(13) + T1, 6 - 2 * T1, 7 - 2 * T1, G[1]); L.hl(cx - 3 + T1, hy(13) + T1, 6 - 2 * T1, G[0], t=TH)
        L.vl(cx - 0.5, hy(13) + T1, 7 - 2 * T1, S[4], t=TH)

    def frieze(x, w, h0=44):
        """A band of tile pictures under the cornice."""
        xx, yy = grid(x, hy(h0 + 4), w, 3)
        hh = hs(xx / 2.0, yy, seed + 5)
        idx = np.full(xx.shape, 5) - (hh > 0.70)
        rgb = np.array(O, np.uint8)[idx]
        rgb[hh < 0.045] = R['blue'][4]; rgb[(hh > 0.045) & (hh < 0.085)] = R['red'][4]; rgb[(hh > 0.965)] = T[6]
        rgb[(np.floor(xx) % 12 == 0)] = B[3]                                   # piers between the pictures
        L.put(x, hy(h0 + 4), rgb, np.ones(xx.shape, bool))
        L.hl(x, hy(h0 + 1), w, S[6]); L.hl(x, hy(h0), w, B[1])
        L.hl(x, hy(h0 + 5), w, S[2])                                            # the shade under the cornice
        L.hl(x, hy(h0 + 6), w, S[5]); L.hl(x, hy(h0 + 7), w, S[6])              # cornice

    def roof_plane(x, w, h0, h1, sd):
        xx, yy = grid(x, hy(h1), w, h1 - h0)
        rowi = np.floor(yy * DET + 1e-6).astype(int)
        n = hs(xx / 2.0, yy, sd)
        idx = np.where(rowi % 2 == 0, 2, 3) + (n > 0.88).astype(int) - (n < 0.10).astype(int)
        idx = idx + (fbm(xx / 30.0, yy / 6.0, sd + 1, 2) > 0.62).astype(int)
        L.put(x, hy(h1), np.array(RT, np.uint8)[np.clip(idx, 1, 5)], np.ones(xx.shape, bool))
        L.hl(x, hy(h1), w, RT[5]); L.hl(x, hy(h0 + 1), w, RT[1])

    def dormer(cx, base, w=6, hh=7):
        x = cx - w / 2.0
        L.rect(x, hy(base + hh), w, hh, S[5]); L.vl(x + w - 1, hy(base + hh), hh, S[3])
        L.poly([(x - 1, hy(base + hh)), (cx, hy(base + hh + 4)), (x + w + 1, hy(base + hh))], S[5])
        L.line(x - 1, hy(base + hh) - D1, cx - D1, hy(base + hh + 4), S[6], t=TH)
        L.line(cx, hy(base + hh + 4), x + w + 1 - D1, hy(base + hh) - D1, S[3], t=TH)
        L.rect(cx - 1.5, hy(base + hh - 1), 3, hh - 3, G[0]); L.vl(cx - 0.5, hy(base + hh - 1), hh - 3, S[4], t=TH)
        L.px(cx - 0.5, hy(base + hh + 5), Y[5])

    def chimney(x, base, hh=12):
        L.rect(x, hy(base + hh), 5, hh, B[3]); L.vl(x, hy(base + hh), hh, B[5]); L.vl(x + 4, hy(base + hh), hh, B[1])
        bands(L, x, hy(base + hh) + 2, 5, hh - 3, S, 4)
        L.hl(x - 1, hy(base + hh), 7, S[6]); L.hl(x - 1, hy(base + hh) + 1, 7, S[3])

    def turret(cx, base, hh=9, w=4, cone=8):
        x = cx - w / 2.0
        L.rect(x, hy(base + hh), w, hh, B[4]); L.vl(x, hy(base + hh), hh, B[5]); L.vl(x + w - 1, hy(base + hh), hh, B[2])
        bands(L, x, hy(base + hh) + 1, w, hh - 1, S, 3)
        L.hl(x - 0.5, hy(base + hh), w + 1, S[6])
        rows_fill(L, hy(base + hh + cone), hy(base + hh), lambda y: cx - (w / 2.0 + 0.5) * (y - hy(base + hh + cone)) / cone,
                  lambda y: cx + (w / 2.0 + 0.5) * (y - hy(base + hh + cone)) / cone, slate(L, RT))
        L.vl(cx - 0.5, hy(base + hh + cone + 2), 2, Y[5], t=TH)

    def wing(x, w, sd):
        wall(x, w, 44, sd)
        frieze(x, w)
        n = w // 12
        bw = w / n
        for i in range(n):
            bx = x + i * bw
            L.rect(q(bx), hy(44), 2, 27, B[4]); bands(L, q(bx), hy(44) + 1, 2, 26, S, 3)       # pilaster
            bay(q(bx + bw / 2) + 1)
        roof_plane(x, w, 51, 72, sd + 3)
        for cx in range(x + 2, x + w - 1, 3):                                   # iron cresting on the ridge
            L.vl(cx, hy(74), 2, I[2], t=TH)
        for i in range(n):
            if i % 2 == 0:
                dormer(q(x + (i + 0.5) * bw) + 1, 52)
            else:
                cx = q(x + (i + 0.5) * bw) + 1
                L.rect(cx - 1, hy(64), 3, 3, S[5]); L.rect(cx - 1 + T1, hy(64) + T1, 3 - 2 * T1, 3 - 2 * T1, G[0])
        chimney(x + int(w * 0.30), 62); chimney(x + int(w * 0.70) - 4, 62)

    def pavilion(x, w, sd):
        wall(x, w, 62, sd)
        L.vl(x, hy(62), 58, B[5]); L.vl(x + w - 1, hy(62), 58, B[1])
        for yy in range(int(hy(60)), int(hy(5)), 4):                            # corner stones
            L.rect(x, yy, 2, 2, S[5]); L.rect(x + w - 2, yy, 2, 2, S[4])
        frieze(x, w)
        for i in range(3):
            cx = x + 6 + i * 12
            bay(cx)
            arch_win(L, cx - 2, hy(60), 4, 8, S, G, mull=False)                 # the upper floor
        L.hl(x - 1, hy(63), w + 2, S[6]); L.hl(x - 1, hy(62), w + 2, S[4]); L.hl(x, hy(61), w, B[1])
        top = 86
        rows_fill(L, hy(top), hy(63), lambda y: x - 1 + (hy(63) - y) / (top - 63.0) * 10, lambda y: x + w + 1 - (hy(63) - y) / (top - 63.0) * 10, slate(L, RT))
        L.hl(x + 9, hy(top), w - 18, RT[5])
        for cx in range(x + 10, x + w - 9, 2):
            L.vl(cx, hy(top + 2), 2, I[2], t=TH)
        for cx in (x + 9, x + w - 10):
            L.vl(cx, hy(top + 5), 5, I[2], t=TH); L.px(cx, hy(top + 6), Y[5])
        dormer(x + w // 2, 64, 8, 9)
        turret(x + 1, 55); turret(x + w - 1, 55)

    def tower(x, w, sd):
        top = 78
        wall(x, w, top, sd)
        bands(L, x, hy(top) + 2, w, top - 20, S, 5)
        L.vl(x, hy(top), top - 4, B[5]); L.vl(x + w - 1, hy(top), top - 4, B[1]); L.vl(x + w - 2, hy(top), top - 4, B[2])
        for yy in range(int(hy(top - 2)), int(hy(5)), 4):
            L.rect(x, yy, 2, 2, S[5]); L.rect(x + w - 2, yy, 2, 2, S[4])
        for (hh, wh) in ((22, 12), (40, 12)):                                   # slit windows
            for cx in (x + 7, x + w - 7):
                arch_win(L, cx - 2, hy(hh + wh), 4, wh, S, G, mull=False)
        L.hl(x, hy(58), w, S[6]); L.hl(x, hy(57), w, S[3])
        for cx in (x + 7, x + w - 7):                                           # the bell stage
            arch_win(L, cx - 3, hy(75), 6, 14, S, K, mull=False)
            for yy in sub(hy(72), hy(62)):
                if int(yy * DET) % 2 == 0:
                    L.rect(cx - 3 + T1, yy, 6 - 2 * T1, D1, S[2])
        L.rect(x - 1, hy(top + 2), w + 2, 2, S[6]); L.hl(x - 1, hy(top), w + 2, S[3])
        for cx in range(x, x + w, 2):
            L.px(cx, hy(top - 1), S[5])
        cxm = x + w / 2.0
        st = top + 2
        SPH = 31.0
        rows_fill(L, hy(st + SPH), hy(st), lambda y: cxm - 3.2 - (w / 2.0 - 2.2) * ((y - hy(st + SPH)) / SPH) ** 1.45,
                  lambda y: cxm + 3.2 + (w / 2.0 - 2.2) * ((y - hy(st + SPH)) / SPH) ** 1.45, slate(L, RT))
        turret(x + 1, top - 5, 8, 4, 9); turret(x + w - 1, top - 5, 8, 4, 9)
        L.rect(cxm - 2, hy(st + 8), 4, 5, S[5]); L.rect(cxm - 1, hy(st + 7), 2, 3, G[0]); L.px(cxm - 0.5, hy(st + 9), S[6])    # a spire light
        ly = st + int(SPH)                                                      # the lantern
        L.rect(cxm - 3.5, hy(ly + 5), 7, 5, S[5]); L.hl(cxm - 4.5, hy(ly), 9, S[6]); L.hl(cxm - 4.5, hy(ly + 5), 9, S[6])
        for dx in (-2.5, -0.5, 1.5):
            L.rect(dx + cxm, hy(ly + 4), 1, 3, K[1])
        rows_fill(L, hy(ly + 12), hy(ly + 5), lambda y: cxm - 4.0 * (y - hy(ly + 12)) / 7.0, lambda y: cxm + 4.0 * (y - hy(ly + 12)) / 7.0, slate(L, RT))
        L.vl(cxm - 0.5, hy(ly + 16), 4, Y[4], t=TH); L.ellipse(cxm, hy(ly + 13.5), 0.9, 0.9, Y[5])

    def opening(x, w, h):
        r = w / 2.0
        L.ellipse(x + r, hy(h - r), r + 1.5, r + 1.5, S[5]); L.rect(x - 1.5, hy(h - r), w + 3, h - r, S[5])
        L.ring(x + r, hy(h - r), r + 1.5, S[6], r + 0.9)
        L.rect(x - 1.5, hy(h - r), w + 3, h - r, S[5]); L.vl(x - 1.5, hy(h - r), h - r, S[6], t=TH)
        L.ellipse(x + r, hy(h - r), r, r, K[1]); L.rect(x, hy(h - r), w, h - r, K[1])
        w2 = w * 0.46; h2 = h * 0.50; r2 = w2 / 2.0                              # the far end of the passage, in daylight
        L.ellipse(x + r, hy(h2 - r2), r2, r2, T[3]); L.rect(x + r - r2, hy(h2 - r2), w2, h2 - r2, T[3])
        L.rect(x + r - r2, hy(2), w2, 2, S[3]); L.rect(x, hy(1), w, 1, K[2])

    def centre(x, w, sd):
        wall(x, w, 60, sd)
        cx = x + w // 2
        opening(cx - 7, 14, 18); opening(x + 4, 10, 14); opening(x + w - 14, 10, 14)
        L.hl(x, hy(22), w, S[6]); L.hl(x, hy(21), w, S[3])
        for xx_ in range(x + 1, x + w - 1, 2):                                  # a balustrade
            L.vl(xx_, hy(25), 3, S[5], t=TH)
        L.hl(x, hy(25), w, S[6], t=TH)
        for i in range(5):
            arch_win(L, x + 5 + i * 9, hy(43), 6, 17, S, G, glint=i in (1, 3))
        L.hl(x, hy(46), w, S[6]); L.hl(x, hy(45), w, S[3])
        px0, pw = x + 9, w - 18                                                # the large tile picture
        xx, yy = grid(px0, hy(57), pw, 9)
        hh = hs(xx / 2.0, yy / 2.0, sd + 9)
        rgb = np.array(O, np.uint8)[np.where(hh > 0.6, 4, 5)]
        rgb[hh < 0.09] = R['blue'][3]; rgb[(hh > 0.09) & (hh < 0.17)] = R['red'][4]; rgb[hh > 0.94] = T[6]
        L.put(px0, hy(57), rgb, np.ones(xx.shape, bool))
        L.hl(px0 - 1, hy(58), pw + 2, S[6]); L.hl(px0 - 1, hy(48), pw + 2, S[6]); L.vl(px0 - 1, hy(58), 10, S[6]); L.vl(px0 + pw, hy(58), 10, S[4])
        for cxw in (x + 4, x + w - 4):
            arch_win(L, cxw - 2, hy(57), 4, 9, S, G, mull=False)
        L.hl(x - 1, hy(61), w + 2, S[6]); L.hl(x - 1, hy(60), w + 2, S[3])
        n = 6                                                                   # the stepped gable
        sh = 28.0 / n
        for k in range(n):
            hw = w / 2.0 - (w / 2.0 - 4) * k / (n - 1)
            y0, y1 = hy(61 + (k + 1) * sh), hy(61 + k * sh)
            xl, xr = q(cx - hw), q(cx + hw)
            brickfill(L, xl, y0, xr - xl, y1 - y0, B, sd + 4)
            L.vl(xl, y0, y1 - y0, B[5]); L.vl(xr - 1, y0, y1 - y0, B[1])
            L.hl(xl - 1, y0, xr - xl + 2, S[6]); L.hl(xl, y0 + 1, xr - xl, S[4], t=TH)
        L.ring(cx, hy(70), 4.5, S[5], 3.2); L.ellipse(cx, hy(70), 3.2, 3.2, G[1]); L.vl(cx - 0.5, hy(73), 6, S[4], t=TH); L.hl(cx - 3, hy(70) - 0.5, 6, S[4], t=TH)
        L.rect(cx - 2, hy(84), 4, 7, S[3]); L.rect(cx - 1, hy(83), 2, 5, S[5]); L.px(cx - 1, hy(84), S[6])                    # a figure in its niche
        L.rect(cx - 1, hy(94), 2, 5, S[5]); L.vl(cx - 0.5, hy(97), 3, Y[4], t=TH); L.ellipse(cx, hy(97.5), 0.9, 0.9, Y[5])
        turret(x + 2, 58, 7, 4, 7); turret(x + w - 2, 58, 7, 4, 7)

    x = 0
    pavilion(x, PV, seed); x += PV
    wing(x, WG, seed + 10); x += WG
    xt1 = x; x += TW
    centre(x, CT, seed + 20); x += CT
    xt2 = x; x += TW
    wing(x, WG, seed + 30); x += WG
    pavilion(x, PV, seed + 40)
    tower(xt1, TW, seed + 50); tower(xt2, TW, seed + 60)
    return L


# ---------------------------------------------------------------- park things at the scale of the far side
def tree_band(L, x0, x1, yb, h, leaf, seed, air=None):
    """A far line of tree crowns: one mass with a ragged top."""
    LF = R[leaf]
    xx, yy = grid(x0, yb - h, x1 - x0, h)
    top = fbm(xx / 17.0, yy * 0, seed, 3)
    inside = (yy - (yb - h)) > h * (0.72 - 0.72 * top) + (hs(xx, yy, seed + 1) - 0.5) * 2.2
    cl = fbm(xx / 5.0, yy / 4.0, seed + 2, 2)
    idx = np.clip(np.floor(1.5 + cl * 4.2 - (yy - (yb - h)) / h * 1.4), 1, 5).astype(int)
    L.put(x0, yb - h, np.array(LF, np.uint8)[idx], inside)


def bench_far():
    Gn = R['green']; I = R['iron']
    L = Layer(10, 5)
    L.hl(0, 0, 10, Gn[4]); L.hl(0, 2, 10, Gn[3]); L.px(1, 1, I[2]); L.px(8, 1, I[2]); L.vl(1, 3, 2, I[2]); L.vl(8, 3, 2, I[2])
    return L


def kiosk_far(rng, word='KOFFIE'):
    """A food stall with a striped awning."""
    W = R['wood']; T = R['white']; Rd = R['red']; G = R['glass']; K = R['black']
    w = text_w(word) + 8
    L = Layer(w, 24)
    L.rect(1, 8, w - 2, 16, W[3]); L.vl(1, 8, 16, W[5]); L.vl(w - 2, 8, 16, W[1])
    L.rect(3, 12, w - 6, 6, K[1]); L.hl(3, 12, w - 6, K[0]); L.hl(2, 18, w - 4, W[5]); L.hl(2, 19, w - 4, W[1])
    for xx_ in range(4, w - 4, 4):
        L.px(xx_, 16, R['yellow'][5]); L.px(xx_ + 1, 17, Rd[4])
    for j in range(4):
        for xx_ in range(0, w):
            L.px(xx_, 8 + j, Rd[4 if j < 3 else 2] if ((xx_ + j // 2) // 2) % 2 == 0 else T[5 if j < 3 else 4])
    L.rect(2, 0, w - 4, 8, Rd[2]); L.hl(2, 0, w - 4, Rd[4]); L.hl(2, 7, w - 4, Rd[1])
    text(L, 4, 1, word, R['yellow'][6])
    return L


def flag_far(c='red'):
    I = R['iron']; C = R[c]
    L = Layer(9, 30)
    L.vl(1, 0, 30, I[3]); L.px(1, 0, R['yellow'][5])
    L.rect(2, 2, 6, 14, C[4]); L.vl(2, 2, 14, C[5]); L.vl(7, 2, 14, C[2]); L.hl(2, 15, 6, C[2])
    for yy in (5, 8, 11):
        L.hl(4, yy, 3, R['white'][5], t=TH)
    return L


def duck(rng, drake=True):
    """A mallard on the water with its broken mirror."""
    Bn = R['wood']; Gh = R['green']; Yb = R['yellow']; T = R['white']
    L = Layer(14, 14)
    wl = 8
    L.ellipse(7.5, wl - 2.4, 5.2, 2.5, Bn[3 if drake else 4]); L.ellipse(8.4, wl - 3.0, 3.4, 1.5, Bn[5 if drake else 5])
    L.rect(11.5, wl - 4.6, 2, 1.6, Bn[2]); L.hl(3, wl - 1, 9, Bn[1])
    L.ellipse(3.4, wl - 5.0, 1.9, 1.7, Gh[3] if drake else Bn[3]); L.rect(2.6, wl - 3.6, 2, 1.4, T[5] if drake else Bn[4])
    L.rect(0.4, wl - 5.0, 1.8, 1, Yb[5]); L.rect(3.0, wl - 5.6, D1 * max(1, U // 2), D1 * max(1, U // 2), (16, 16, 24))
    xx, yy = grid(1, wl, 12, 5)
    xs = xx - np.round(1.5 * np.sin(np.floor(yy * DET) / DET * 1.9))
    m = chk(xs, yy) & (hash01(xs / 2, yy * DET, 3) > 0.3 + (yy - wl) * 0.12) & (xs >= 3) & (xs < 13)
    L.put(1, wl, np.broadcast_to(np.array(Bn[1], np.uint8), xx.shape + (3,)), m)
    return L


def swan(rng=None, seed=3):
    """A mute swan on the water with its broken mirror. It looks to the left."""
    T = R['white']; orange = s5((236, 132, 44)); black = (16, 16, 24)
    L = Layer(26, 28)
    wl = 17
    L.ellipse(14.5, wl - 4.2, 8.6, 4.4, T[5])                                   # body
    L.poly([(19, wl - 7.5), (25.5, wl - 10.5), (23.5, wl - 3.5)], T[5])          # tail
    L.ellipse(15.5, wl - 6.2, 6.6, 3.0, T[6])                                   # the folded wing
    L.line(11, wl - 5, 20, wl - 8, T[4], t=TH); L.line(13, wl - 3.6, 21, wl - 6, T[4], t=TH)
    L.hl(7, wl - 1, 15, T[3]); L.hl(8, wl - 2, 13, T[4], t=TH)
    pts = [(8.2, wl - 5.2), (6.6, wl - 7.4), (5.8, wl - 9.8), (6.4, wl - 12.2), (7.0, wl - 14.0), (6.0, wl - 15.6), (4.4, wl - 15.4)]
    for (a, b) in zip(pts, pts[1:]):                                             # the neck
        L.line(a[0], a[1], b[0], b[1], T[6], t=1.6)
    L.line(pts[0][0] + 1.2, pts[0][1], pts[2][0] + 1.3, pts[2][1], T[4], t=TH)
    L.ellipse(4.6, wl - 15.2, 1.9, 1.5, T[6])                                   # head
    L.poly([(3.4, wl - 15.6), (0.6, wl - 13.8), (3.4, wl - 13.9)], orange)
    L.rect(3.0, wl - 16.0, 1.2, 1.0, black); L.rect(4.6, wl - 15.8, D1 * max(1, U // 2), D1 * max(1, U // 2), black)
    xx, yy = grid(2, wl, 24, 11)                                                # the mirror
    xs = xx - np.round(2 * np.sin(np.floor(yy * DET) / DET * 1.7))
    m = chk(xs, yy) & (hash01(xs / 3, yy * DET, seed) > 0.22 + (yy - wl) * 0.06) & (xs >= 6) & (xs < 24)
    L.put(2, wl, np.broadcast_to(np.array(T[4], np.uint8), xx.shape + (3,)), m)
    return L


# ---------------------------------------------------------------- park things at the scale of the walk plane
def banner_pole(word='EXPO', c='red', h=118):
    """A pole with a long banner, as they stand around a museum square."""
    I = R['iron']; C = R[c]; T = R['white']
    L = Layer(22, h)
    L.rect(2, 4, 3, h - 4, I[3]); L.vl(2, 4, h - 4, I[5]); L.vl(4, 4, h - 4, I[1]); L.rect(1, h - 8, 5, 8, I[2]); L.hl(0, h - 1, 7, I[1])
    L.ellipse(3.5, 3, 2, 2, I[4])
    bh = 12 * len(word) + 8
    L.hl(4, 9, 16, I[3]); L.hl(4, 10 + bh, 16, I[3])
    L.rect(6, 10, 14, bh, C[4]); L.vl(6, 10, bh, C[5]); L.vl(19, 10, bh, C[2]); L.hl(6, 9 + bh, 14, C[2])
    for yy in range(16, 8 + bh, 9):                                             # folds
        L.line(7, yy, 18, yy + 2, C[3], t=TH)
    y = 15
    for ch in word:
        g_ = FONT[ch]
        gw = len(g_[0])
        for j, row in enumerate(g_):
            for i, v in enumerate(row):
                if v == '1':
                    L.rect(13 - gw + i * 2, y + j * 2, 2, 2, T[6])
        y += 12
    return L


def bin_():
    I = R['iron']; Gn = R['green']
    L = Layer(12, 18)
    L.rect(1, 3, 10, 13, Gn[2]); L.vl(1, 3, 13, Gn[4]); L.vl(10, 3, 13, Gn[1]); L.hl(0, 2, 12, Gn[4]); L.hl(0, 3, 12, Gn[1])
    L.rect(3, 5, 6, 2, R['black'][1]); L.hl(1, 9, 10, Gn[1]); L.rect(4, 16, 4, 2, I[2]); L.hl(2, 17, 8, R['black'][0])
    return L


def leaf_pile(L, cx, cy, rx, ry, leaf, seed, dens=0.5):
    """Fallen leaves around a spot on the ground."""
    LV = R[leaf]
    x0, y0 = max(0, cx - rx), max(0, cy - ry)
    w, h = min(L.w, cx + rx) - x0, min(L.h, cy + ry) - y0
    if w <= 0 or h <= 0:
        return
    xx, yy = grid(x0, y0, w, h)
    d = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2
    hh = hs(xx, yy, seed)
    v = L.view(x0, y0, w, h)
    m = (v[..., 3] > 0) & (hh < dens * (1 - d)) & (d < 1)
    tone = np.clip((hs(xx, yy, seed + 1) * 4).astype(int) + 2, 2, 5)
    v[..., :3][m] = np.array(LV, np.uint8)[tone][m]


# ---------------------------------------------------------------- light on a surface
def tint(L, cx, cy, rx, ry, col, a1=0.56, a2=0.30, ymin=None, ymax=None):
    """The light of a lamp or a sign on what is there: the pixels in an ellipse step toward the light colour.
       Two steps, the outer one thinned by the checker. The detail of the surface stays."""
    x0, y0 = max(0, cx - rx - 1), max(0, cy - ry - 1)
    x1, y1 = min(L.w, cx + rx + 1), min(L.h, cy + ry + 1)
    if ymin is not None:
        y0 = max(y0, ymin)
    if ymax is not None:
        y1 = min(y1, ymax)
    if x1 <= x0 or y1 <= y0:
        return
    xx, yy = grid(x0, y0, x1 - x0, y1 - y0)
    v = L.view(x0, y0, x1 - x0, y1 - y0)
    if v.shape[:2] != xx.shape:
        return
    d = ((xx + 0.5 * D1 - cx) / rx) ** 2 + ((yy + 0.5 * D1 - cy) / ry) ** 2
    on = v[..., 3] > 0
    ck = chk(xx, yy)
    inner = (d < 0.36) | ((d < 0.5) & ck)
    outer = ((d < 0.85) | ((d < 1.0) & ck)) & ~inner
    for m, a in ((inner & on, a1), (outer & on, a2)):
        if m.any():
            px = v[..., :3][m].astype(float)
            v[..., :3][m] = snap5(px + (np.array(col, float) - px) * a)


# ---------------------------------------------------------------- the pond: a still mirror and a moving skin
def mirror(src, y_line, rows, body_far, body_near, seed=5, frames=3, k=3.0, ncol=30, mix0=0.30, mix1=0.60, wob=(0.4, 1.5), wfreq=2.4):
    """The mirror image in still water. It keeps its place under the thing it shows, so it scrolls with the
       far side as one piece. src: RGB in real pixels of what stands above the water line y_line."""
    hs_, ws = src.shape[:2]
    bf = np.array(body_far, float); bn = np.array(body_near, float)
    rp = P(rows)
    u = np.arange(ws) / U
    outs = []
    for f in range(frames):
        ph = f * 2 * math.pi / frames
        img = np.zeros((rp, ws, 3), float)
        for j in range(rp):
            jl = j / U
            r = j / max(rp - 1, 1)
            amp = wob[0] + (wob[1] - wob[0]) * r
            dx = amp * math.sin(jl * wfreq + ph) + amp * 1.2 * (vnoise(u / (16.0 + 14 * r), np.full(ws, jl * 0.61 + f * 0.37), seed) - 0.5) * 2
            uf = np.clip(((u + dx) * U).astype(int), 0, ws - 1)
            sy = int(np.clip(math.floor((y_line - jl * k) * U) - 1, 0, hs_ - 1))
            c = src[sy, uf].astype(float)
            c = c + (bf + (bn - bf) * r - c) * (mix0 + (mix1 - mix0) * r)
            if jl < 2:
                c = c * (0.66 + 0.16 * math.floor(jl))                 # the shade under the far edge
            img[j] = c
        outs.append(img)
    allp = np.concatenate(outs, 0)
    im = Image.fromarray(np.clip(allp, 0, 255).astype(np.uint8), 'RGB').quantize(ncol, method=Image.MEDIANCUT, dither=Image.NONE).convert('RGB')
    a = snap5(np.asarray(im).astype(float))
    res = []
    for f in range(frames):
        L = Layer(ws / U, rows)
        L.a[..., :3] = a[f * rp:(f + 1) * rp]; L.a[..., 3] = 255
        res.append(L)
    return res


def ripples(rows, w_far, w_near, body_far, body_near, glint, seed=5, frames=3, light=0.63, dark=0.38, leaves=None):
    """The skin of the water as its own layer: light and dark lenses, clear between them. The page scrolls it
       row by row over the mirror. leaves: a ramp name, for leaves that float on the pond."""
    bf = np.array(body_far, float); bn = np.array(body_near, float); gl = np.array(glint, float)
    rp = P(rows); wf = P(w_far); wn = P(w_near)
    res = []
    for f in range(frames):
        L = Layer(w_near, rows)
        for j in range(rp):
            jl = j / U
            r = j / max(rp - 1, 1)
            wr = int(round(wf + (wn - wf) * r))
            u = np.arange(wr) / U
            body = bf + (bn - bf) * r
            p = fbm(u / (9.0 + 26.0 * r) + f * 0.8, np.full(wr, jl / 1.9), seed + 3, 2)
            p2 = vnoise(u / (4.0 + 9.0 * r) - f * 0.6, np.full(wr, jl / 1.25), seed + 7)
            lightm = (p > light) & (p2 > 0.55)
            darkm = (p < dark) & (p2 < 0.47)
            lc = snap5(body + (gl - body) * (0.50 + 0.22 * (1 - r)))
            dc = snap5(body * (0.80 - 0.10 * r))
            row = L.a[j]
            row[:wr][lightm] = (int(lc[0]), int(lc[1]), int(lc[2]), 255)
            row[:wr][darkm] = (int(dc[0]), int(dc[1]), int(dc[2]), 255)
            if leaves:
                LV = R[leaves]
                lf = hash01(np.floor(u / (1.0 + r)), np.full(wr, math.floor(jl / (1.0 + 0.6 * r))), seed + 40)
                for (lo, tone) in ((0.994, 5), (0.989, 3)):
                    row[:wr][lf > lo] = (*LV[tone], 255)
        res.append(L)
    return res


# ---------------------------------------------------------------- neon
def neon_text(L, x, y, word, col, core=None, s=2):
    """A word in neon tubes, s logical pixels per font pixel. At the higher tiers the tube has a pale core."""
    for ch in word:
        g_ = FONT[ch]
        for j, row in enumerate(g_):
            for i, v in enumerate(row):
                if v == '1':
                    L.rect(x + i * s, y + j * s, s, s, col)
                    if core is not None and U > 1 and s > 1:
                        L.rect(x + i * s + 0.5, y + j * s + 0.5, s - 1, s - 1, core)
        x += (len(g_[0]) + 1) * s


def neon_board(word):
    """A sandwich board on the pavement. The scene writes the neon word on it after the grade.
       Returns (Layer, text x, text y)."""
    K = R['black']; I = R['iron']
    w = text_w(word) * 2 + 10
    L = Layer(w, 36)
    L.rect(0, 0, w, 28, K[1]); L.hl(0, 0, w, K[4]); L.vl(0, 0, 28, K[3]); L.vl(w - 1, 0, 28, K[0]); L.hl(0, 27, w, K[0])
    L.rect(2, 2, w - 4, 24, K[0])
    for lx in (2, w - 4):
        L.rect(lx, 28, 2, 8, I[2]); L.vl(lx, 28, 8, I[4])
    L.hl(1, 35, w - 2, K[0])
    return L, 5, 9
