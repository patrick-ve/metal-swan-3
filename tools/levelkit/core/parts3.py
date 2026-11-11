# Scenery parts, third file: the walk plane (the near quay) and its furniture, at about 22 px per metre.
import math
import random
import numpy as np
from kit import *
from parts import R, EM, brickfill, q_, text, text_w
from parts2 import canopy, branches

q = q_
R['post'] = ramp(7, .17, .64, .050, .095, .070, 8, 42)          # the cast-iron red-brown of the street posts
R['soil'] = ramp(7, .14, .50, .020, .035, .035, 40, 70)
R['grass'] = ramp(7, .20, .66, .034, .074, .086, 140, 112)
R['gravel'] = ramp(7, .34, .84, .014, .026, .034, 70, 92)


def ground(L, w, y0=166, seed=3, wet=0.0, leaves=None, sky=None, style='quay'):
    """The near quay, top to bottom: stone coping at the water, a dark strip (trees, bikes), the clinker road,
       the kerbstones, the tiled pavement where the hero walks. Rows get taller toward the viewer."""
    S = R['stone']; PR = R['pave_red']; PG = R['pave_grey']
    rng = random.Random(seed)
    # coping
    L.rect(0, y0, w, 3, S[5]); L.hl(0, y0, w, S[6]); L.hl(0, y0 + 3, w, S[1])
    x = 0
    while x < w:
        L.vl(x, y0 + 1, 2, S[3], t=TH); L.rect(x + (1 + TH) / 2, y0 + 1, TH, TH, S[6])
        x += rng.randint(20, 27)
    park = style == 'park'                                             # a lawn and a gravel path in place of the clinkers
    # strip
    brickfill(L, 0, y0 + 4, w, 5, PR, seed, cw=4, chh=1, lo=1, hi=3, mid=2)
    # road (clinkers)
    brickfill(L, 0, y0 + 9, w, 9, PR, seed + 1, cw=5, chh=2, lo=2, hi=5, mid=3)
    xx, yy = grid(0, y0 + 9, w, 9)
    worn = fbm(xx / 40.0, yy / 3.0, seed + 5, 2) > 0.62                # the wheel tracks are paler
    v = L.view(0, y0 + 9, w, 9)[..., :3]
    v[worn & (hs(xx, yy, seed + 6) > 0.5)] = PR[5]
    L.hl(0, y0 + 9, w, PR[1])
    if park:
        GR = R['grass']; GV = R['gravel']
        xx, yy = grid(0, y0 + 4, w, 8)
        n = fbm(xx / 9.0, yy / 2.5, seed + 30, 2); bl = hs(xx, yy, seed + 31)
        idx = 4 + (n > 0.60).astype(int) - (n < 0.40).astype(int) + (bl > 0.90).astype(int) - (bl < 0.08).astype(int)
        L.put(0, y0 + 4, np.array(GR, np.uint8)[np.clip(idx, 2, 6)], np.ones(xx.shape, bool))
        L.hl(0, y0 + 4, w, GR[1])
        xx, yy = grid(0, y0 + 12, w, 6)
        gt = hs(xx, yy, seed + 32); n = fbm(xx / 40.0, yy / 3.0, seed + 33, 2)
        idx = 4 + (gt > 0.80).astype(int) - (gt < 0.20).astype(int) - (n < 0.38).astype(int)
        L.put(0, y0 + 12, np.array(GV, np.uint8)[np.clip(idx, 2, 6)], np.ones(xx.shape, bool))
        L.hl(0, y0 + 12, w, GV[2], t=TH)
    # kerbstones
    ky = y0 + 18
    L.rect(0, ky, w, 3, S[5]); L.hl(0, ky, w, S[6]); L.hl(0, ky + 2, w, S[4]); L.hl(0, ky + 3, w, S[1])
    x = 5
    while x < w:
        L.vl(x, ky, 3, S[2], t=TH); L.rect(x + (1 + TH) / 2, ky, TH, TH, S[6])
        x += 22
    # pavement tiles
    rows = [(ky + 4, 5, 9), (ky + 9, 6, 11), (ky + 15, 7, 13), (ky + 22, 9, 16)]
    for ri, (ry, rh, tw) in enumerate(rows):
        rh = min(rh, L.h - ry)
        if rh <= 0:
            continue
        off = (ri * 5) % tw
        for tx in range(-off, w, tw):
            tone = 4 + (1 if hash01(np.array(tx), np.array(ri), seed + 9) > 0.72 else 0) - (1 if hash01(np.array(tx), np.array(ri), seed + 10) > 0.78 else 0)
            L.rect(tx, ry, tw, rh, PG[tone])
            L.vl(tx, ry, rh, PG[2], t=TH)
            L.rect(tx + (1 + TH) / 2, ry, tw - (1 + TH) / 2, TH, PG[min(tone + 1, 6)])
        L.rect(0, ry + rh - TH, w, TH, PG[2])
    yb = rows[-1][0] + rows[-1][1]
    if yb < L.h:
        L.rect(0, yb, w, L.h - yb, PG[3])
    # stains and wear on the pavement
    py = ky + 4
    xx, yy = grid(0, py, w, L.h - py)
    st = fbm(xx / 21.0, yy / 6.0, seed + 12, 3)
    v = L.view(0, py, w, L.h - py)[..., :3]
    lab = rgb2lab(v.astype(float))
    dark = (st < 0.33) & (hs(xx, yy, seed + 13) > 0.35)
    lab[..., 0] = np.where(dark, lab[..., 0] - 0.045, lab[..., 0])
    lab[..., 0] = np.where((st > 0.70) & (hs(xx, yy, seed + 14) > 0.5), lab[..., 0] + 0.03, lab[..., 0])
    grit = hs(xx, yy, seed + 19)
    lab[..., 0] = np.where(grit > 0.975, lab[..., 0] - 0.07, np.where(grit < 0.02, lab[..., 0] + 0.04, lab[..., 0]))
    v[:] = snap5(lab2rgb(lab))
    if wet > 0 and sky is not None:                                    # puddles take the sky
        pd = fbm(xx / 30.0, yy / 4.0, seed + 15, 3)
        thr = 1 - wet * 0.40
        m = pd > thr
        edge = m & ~(pd > thr + 0.025)
        v[m] = sky[0]
        v[m & (pd > thr + 0.07)] = sky[1]
        v[m & (((np.floor(xx * DET) + np.floor(yy * DET) * 5) % 9) == 0) & (pd > thr + 0.04)] = sky[2]
        v[edge] = PG[1]
    if leaves:
        LV = R[leaves]
        v[hash01(xx, yy, seed + 16) > 0.988] = LV[5]
        v[hash01(xx, yy, seed + 17) > 0.992] = LV[3]
        if U > 1:                                                      # a leaf has a lit half
            v[(hash01(xx, yy, seed + 16) > 0.988) & ((xx - np.floor(xx)) + (yy - np.floor(yy)) > 1.0)] = LV[4]
        ys0 = y0 + 4
        xx2, yy2 = grid(0, ys0, w, 14)
        L.view(0, ys0, w, 14)[..., :3][hash01(xx2, yy2, seed + 18) > 0.975] = LV[4]
    # a drain and a manhole
    for i in range(0 if park else max(1, w // 320)):
        mx = rng.randint(40, w - 60)
        L.rect(mx, y0 + 12, 12, 4, R['iron'][2]); L.hl(mx, y0 + 12, 12, R['iron'][4]); L.hl(mx + 1, y0 + 15, 10, R['iron'][1])
        for xx_ in range(mx + 2, mx + 11, 2):
            L.px(xx_, y0 + 13, R['iron'][1])
    return dict(coping=y0, strip=y0 + 6, kerb=ky + 1, walk=ky + 14)


def post(lean=0, h=19):
    """The Amsterdam street post: a round head, three crosses on the shaft."""
    P = R['post']
    L = Layer(8, h + 1)
    L.rect(2, 4, 4, h - 4, P[3]); L.vl(2, 4, h - 4, P[5]); L.vl(5, 4, h - 4, P[1])
    if U == 1:
        L.rect(1, 0, 6, 4, P[3]); L.hl(2, 0, 4, P[5]); L.px(1, 1, P[5]); L.px(2, 1, P[6]); L.vl(6, 1, 3, P[1]); L.hl(1, 3, 6, P[2])
        L.clear(1, 0, 1, 1); L.clear(6, 0, 1, 1)
    else:                                                              # the head is a flattened ball
        L.ellipse(4, 2.2, 3.0, 2.2, P[1]); L.ellipse(3.8, 2.1, 2.7, 1.9, P[3]); L.ellipse(3.1, 1.5, 1.5, 0.9, P[5]); L.ellipse(2.7, 1.3, 0.6, 0.4, P[6])
        L.rect(1, 3.5, 6, 0.5, P[2])
        L.rect(3, 4, 1, h - 4, P[4])
    L.hl(2, 4, 4, P[1])
    for i in range(3):
        y = 6 + i * 4
        if U == 1:
            L.px(3, y, P[6]); L.px(4, y + 1, P[5]); L.px(3, y + 2, P[5]); L.px(4, y, P[2]); L.px(3, y + 1, P[2]); L.px(4, y + 2, P[2])
        else:                                                          # a cross in relief: light strokes, a shade below
            L.line(3.1, y + 0.4, 4.4, y + 2.4, P[1], t=0.5); L.line(4.4, y + 0.4, 3.1, y + 2.4, P[1], t=0.5)
            L.line(3, y + 0.1, 4.3, y + 2.1, P[6], t=0.5); L.line(4.3, y + 0.1, 3, y + 2.1, P[5], t=0.5)
    L.rect(1, h - 2, 6, 2, P[2]); L.hl(1, h - 2, 6, P[4]); L.px(6, h - 1, P[1])
    L.hl(1, h, 6, R['black'][1])
    return L


def bike(rng, c=None, crate=None, lean=0):
    """A Dutch town bicycle, 40 x 25."""
    I = R['iron']; C = R[c or rng.choice(['black', 'black', 'red', 'blue', 'green', 'white', 'iron'])]; K = R['black']
    L = Layer(42, 27)
    for cx in (8.5, 32.5):
        L.ring(cx, 18.5, 7.6, K[1], 6.4)
        L.ring(cx, 18.5, 6.4, I[4], 5.8)
        if U == 1:
            for a in range(0, 360, 45):
                L.px(cx + math.cos(math.radians(a + 11)) * 3.4, 18.5 + math.sin(math.radians(a + 11)) * 3.4, I[3])
        else:
            for a in range(0, 360, 30):
                L.line(cx - 0.5, 18.0, cx - 0.5 + math.cos(math.radians(a + 11)) * 5.6, 18.0 + math.sin(math.radians(a + 11)) * 5.6, I[3], t=D1)
        L.px(cx, 18.5, I[5]); L.px(cx - 1, 18.5, I[2])
    # mudguards
    for a in range(200, 345, 6):
        L.px(8.5 + math.cos(math.radians(a)) * 8.6, 18.5 + math.sin(math.radians(a)) * 8.6, C[2])
        L.px(32.5 + math.cos(math.radians(a - 10)) * 8.6, 18.5 + math.sin(math.radians(a - 10)) * 8.6, C[2])
    # frame
    L.line(8, 18, 15, 8, C[4]); L.line(15, 7, 18, 19, C[3]); L.line(18, 19, 28, 8, C[4]); L.line(15, 8, 28, 7, C[5])
    L.line(8, 19, 18, 19, C[2]); L.line(29, 5, 32, 18, C[3]); L.line(28, 4, 29, 8, C[4])
    L.rect(10, 16, 9, 4, K[1]); L.hl(10, 16, 9, K[3])                    # chain case
    L.line(18, 19, 20, 22, I[2]); L.hl(19, 22, 3, I[1])                 # pedal
    L.rect(11, 4, 7, 2, K[1]); L.hl(12, 4, 5, K[3]); L.vl(15, 6, 2, I[3])         # saddle
    L.line(28, 4, 25, 2, I[3]); L.hl(23, 2, 3, K[1]); L.px(29, 3, I[4])            # handlebar
    L.hl(2, 9, 10, I[2]); L.line(3, 10, 8, 18, I[2]); L.line(11, 10, 9, 18, I[1])  # rack
    L.px(33, 9, R['yellow'][6]); L.rect(32, 9, 2, 2, I[4])                         # lamp
    if crate or (crate is None and rng.random() < 0.4):
        W = R['wood']
        L.rect(27, 0, 11, 6, W[3]); L.hl(27, 0, 11, W[5]); L.hl(27, 3, 11, W[2]); L.vl(27, 0, 6, W[5]); L.vl(37, 0, 6, W[1])
        L.hl(27, 5, 11, W[1])
    L.hl(4, 26, 34, K[0])
    return L


def lamp(h=96, lit=False):
    """The crown lantern of the canal quays."""
    I = R['iron']; G = R['glass']; Y = R['yellow']
    L = Layer(17, h)
    cx = 8
    L.rect(cx - 1, 22, 3, h - 22, I[2]); L.vl(cx - 1, 22, h - 22, I[4]); L.vl(cx + 1, 22, h - 22, I[1])
    L.rect(cx - 3, h - 12, 7, 12, I[2]); L.vl(cx - 3, h - 12, 12, I[4]); L.vl(cx + 3, h - 12, 12, I[1]); L.hl(cx - 4, h - 2, 9, I[1])
    L.hl(cx - 3, h - 12, 7, I[5]); L.hl(cx - 2, h - 14, 5, I[3]); L.hl(cx - 2, h - 30, 5, I[3]); L.hl(cx - 2, h - 29, 5, I[1])
    L.hl(cx - 5, 22, 11, I[2]); L.hl(cx - 5, 21, 11, I[4]); L.px(cx - 5, 23, I[1]); L.px(cx + 5, 23, I[1])   # ladder bar
    # lantern: a glass body that narrows downward, a cap, a crown
    for j in sub(0, 11):
        hw = (5 - (int(j) * 2) // 10 if U == 1 else 5 - (j - 2) * 0.22) if j > 2 else 5
        y = 9 + j
        col = (EM[1] if lit else G[5])
        L.rect(cx - hw, y, 2 * hw + 1, D1, col)
        L.rect(cx - hw, y, 1, D1, I[2]); L.rect(cx + hw, y, 1, D1, I[1]); L.rect(cx + (1 - TH) / 2, y, TH, D1, I[2] if not lit else EM[2])
        if not lit:
            L.rect(cx - hw + 1, y, 1, D1, G[6]); L.rect(cx + 1, y, hw - 1, D1, G[4])
        else:
            L.rect(cx - 2, y, 2, D1, EM[0]); L.rect(cx + 2, y, 1, D1, EM[0])
    L.hl(cx - 3, 20, 7, I[1])
    L.hl(cx - 6, 8, 13, I[2]); L.hl(cx - 6, 7, 13, I[4]); L.hl(cx - 4, 6, 9, I[2]); L.hl(cx - 3, 5, 7, I[3]); L.hl(cx - 1, 4, 3, I[2])
    L.vl(cx, 0, 4, I[2]); L.px(cx - 1, 1, I[3]); L.px(cx + 1, 1, I[1]); L.px(cx - 2, 2, I[2]); L.px(cx + 2, 2, I[1])
    return L


def trunk(rng, h=176, w=12, seed=2, bark='bark'):
    """A quay elm at walk-plane scale: only the trunk and the first forks fit on the screen."""
    BK = R[bark]
    L = Layer(w + 60, h)
    cx = (w + 60) // 2
    xx, yy = grid(0, 0, w + 60, h)
    t = yy / h
    half = (w / 2) * (0.62 + 0.38 * t) + np.where(t > 0.93, (t - 0.93) * 40, 0)           # root flare
    wob = (vnoise(yy / 23.0, xx * 0, seed) - 0.5) * 3
    d = (xx + 0.5 - cx - wob)
    inside = np.abs(d) < half
    u = d / np.maximum(half, 1)                                                        # -1 left .. 1 right
    furrow = fbm((xx - wob) / 2.2, yy / 9.0, seed + 1, 2)
    v = 0.50 - u * 0.40 + (furrow - 0.5) * 0.62 - np.clip(0.30 - t, 0, 1) * 0.5
    idx = np.clip(np.floor(v * 7), 1, 6).astype(int)
    idx = np.where(inside & (u > 0.72), 1, idx)
    idx = np.where(inside & (u < -0.78), np.minimum(idx + 1, 6), idx)
    L.a[..., :3] = np.array(BK, np.uint8)[idx]
    L.a[..., 3] = np.where(inside, 255, 0)
    fy = int(h * 0.26)                                                                   # the trunk forks into two limbs
    L.clear(0, 0, L.w, fy - 6)
    for (dx_top, wd) in ((-30, 4), (24, 3), (4, 2)):
        for k in range(-wd, wd + 1):
            tone = BK[5] if k == -wd else (BK[1] if k == wd else (BK[4] if k < 0 else BK[2]))
            L.line(cx + k * 0.8, fy + 2, cx + dx_top + k, 0, tone)
    for (y, a, ln) in ((int(h * 0.40), 2.6, 15), (int(h * 0.33), 0.6, 13)):
        x0 = cx + (4 if a < 1.57 else -4)
        for k in range(2):
            L.line(x0, y + k, x0 + math.cos(a) * ln, y + k - math.sin(a) * ln, BK[2 if k else 4])
        L.line(x0, y + 2, x0 + math.cos(a) * ln, y + 2 - math.sin(a) * ln, BK[1])
    for i in range(3):                                                                   # knots
        ky = rng.randint(int(h * 0.4), int(h * 0.85))
        L.rect(cx - 2 + rng.randint(-2, 2), ky, 3, 2, BK[1]); L.px(cx - 1, ky - 1, BK[5])
    return L


def tree_pit(L, x, y, w=30):
    SO = R['soil']; S = R['stone']
    L.rect(x, y, w, 4, SO[2]); L.hl(x, y, w, SO[1]); L.hl(x + 1, y + 3, w - 2, SO[3])
    for i in range(x + 2, x + w - 1, 3):
        L.px(i, y + 1 + (i % 2), SO[4])
    L.vl(x - 1, y, 4, S[4]); L.vl(x + w, y, 4, S[3])


def sign(kind='bike'):
    I = R['iron']; W = R['white']
    L = Layer(15, 70)
    L.rect(7, 12, 2, 58, I[3]); L.vl(7, 12, 58, I[5]); L.px(8, 69, I[1])
    if kind == 'bike':
        Bc = R['blue']
        L.ellipse(7.5, 7.5, 7.5, 7.5, Bc[4]); L.ring(7.5, 7.5, 7.5, W[6], 6.5)
        L.ring(4.5, 9.5, 2.2, W[6], 1.2); L.ring(10.5, 9.5, 2.2, W[6], 1.2); L.line(5, 9, 7, 5, W[6]); L.line(7, 5, 10, 9, W[6]); L.hl(6, 4, 3, W[6])
    else:
        Rd = R['red']
        L.ellipse(7.5, 7.5, 7.5, 7.5, Rd[4]); L.ring(7.5, 7.5, 7.5, W[6], 6.5); L.rect(3, 6, 9, 3, W[6])
    return L


def bench():
    W = R['wood']; I = R['iron']; G = R['green']
    L = Layer(46, 22)
    for i, y in enumerate((2, 6)):
        L.rect(1, y, 44, 3, G[3]); L.hl(1, y, 44, G[5]); L.hl(1, y + 2, 44, G[1])
    L.rect(0, 11, 46, 3, G[3]); L.hl(0, 11, 46, G[5]); L.hl(0, 13, 46, G[1])
    for x in (4, 40):
        L.rect(x, 0, 2, 21, I[2]); L.vl(x, 0, 21, I[4]); L.hl(x - 2, 20, 6, I[1])
    L.hl(3, 21, 40, R['black'][0])
    return L


def near_boat(rng, w=190, c='green'):
    """The roof of a houseboat moored below the near quay: only the top of the cabin shows over the edge."""
    C = R[c]; T = R['white']; S = R['stone']; I = R['iron']; LF = R['leaf']; W = R['wood']; G = R['glass']
    L = Layer(w, 34)
    wins = []
    y = 18
    L.rect(0, y, w, 16, C[3]); L.hl(0, y, w, C[5]); L.vl(0, y, 16, C[5]); L.vl(w - 1, y, 16, C[1])
    for x in range(6, w, 7):
        L.vl(x, y + 3, 13, C[2])
    L.rect(-2 + 2, y - 3, w, 3, S[5]); L.hl(0, y - 3, w, S[6]); L.hl(0, y - 1, w, S[2]); L.hl(0, y, w, C[1])
    x = 10
    while x < w - 30:                                                    # the window band under the roof edge
        ww = rng.choice([14, 18, 22])
        L.rect(x, y + 4, ww, 12, T[5]); L.rect(x + 1, y + 5, ww - 2, 11, G[1]); L.hl(x + 1, y + 5, ww - 2, G[0])
        L.vl(x + ww // 2, y + 5, 11, T[5]); L.px(x + 2, y + 6, G[4]); L.px(x + 3, y + 6, G[3]); L.px(x + 2, y + 7, G[3])
        wins.append((x + 1, y + 5, ww - 2, 11))
        if rng.random() < 0.5:
            L.rect(x + 1, y + 9, ww - 2, 7, T[4])
            for xx in range(x + 2, x + ww - 1, 3):
                L.vl(xx, y + 9, 7, T[3])
            L.vl(x + ww // 2, y + 5, 11, T[5])
        x += ww + rng.randint(8, 16)
    # roof furniture
    px_ = 14
    while px_ < w - 26:
        k = rng.choice(['pot', 'pot', 'sky', 'chim', 'chair', 'pot'])
        if k == 'pot':
            pw = rng.randint(6, 9)
            L.rect(px_, y - 8, pw, 5, R['roof_tile'][3]); L.hl(px_ - 1, y - 8, pw + 2, R['roof_tile'][5]); L.vl(px_ + pw - 1, y - 7, 4, R['roof_tile'][1])
            C2 = canopy(pw + 8, 12, LF, rng.randint(0, 999), nb=4, rag=3, holes=0.05)
            L.blit(C2, px_ - 4, y - 19)
            if rng.random() < 0.6:
                fc = R[rng.choice(['red', 'yellow', 'white'])]
                for i in range(4):
                    L.px(px_ - 2 + rng.randint(0, pw + 3), y - 17 + rng.randint(0, 6), fc[5])
            px_ += pw + rng.randint(10, 26)
        elif k == 'sky':
            L.rect(px_, y - 6, 16, 3, T[5]); L.hl(px_, y - 6, 16, T[6]); L.rect(px_ + 1, y - 5, 14, 2, G[4]); L.px(px_ + 2, y - 5, G[6])
            px_ += 16 + rng.randint(10, 22)
        elif k == 'chim':
            L.rect(px_, y - 16, 4, 13, I[3]); L.vl(px_, y - 16, 13, I[5]); L.vl(px_ + 3, y - 16, 13, I[1]); L.hl(px_ - 2, y - 17, 8, I[2]); L.hl(px_ - 1, y - 18, 6, I[4])
            px_ += 4 + rng.randint(12, 24)
        else:
            Rd = R[rng.choice(['red', 'blue', 'yellow'])]
            L.line(px_, y - 4, px_ + 8, y - 13, W[4]); L.line(px_ + 12, y - 4, px_ + 3, y - 11, W[2])
            for i in range(7):
                L.px(px_ + 2 + i, y - 6 - i, Rd[4] if i % 2 else T[6]); L.px(px_ + 3 + i, y - 6 - i, Rd[3] if i % 2 else T[5])
            px_ += 14 + rng.randint(10, 20)
    return L, wins


def mooring_post(h=20):
    W = R['wood']; M = R['moss']
    L = Layer(6, h)
    L.rect(0, 1, 6, h - 1, W[2]); L.vl(0, 1, h - 1, W[4]); L.vl(1, 2, h - 2, W[3]); L.vl(5, 1, h - 1, W[1]); L.hl(1, 0, 4, W[5]); L.hl(0, 1, 6, W[4])
    L.rect(0, h - 4, 6, 4, M[2]); L.hl(0, h - 4, 6, M[3]); L.px(3, 6, W[1]); L.px(2, 11, W[1])
    return L


# ---------------------------------------------------------------- foreground (in front of the hero, dark)
def fg_basket(rng):
    """A bicycle handlebar with a crate of tulips: only the top shows over the lower screen edge."""
    W = R['wood']; I = R['iron']; LF = R['leaf']
    L = Layer(60, 40)
    L.line(4, 20, 22, 12, I[3]); L.line(4, 21, 22, 13, I[1]); L.rect(0, 18, 7, 4, R['black'][2]); L.hl(0, 18, 7, R['black'][4])
    L.line(22, 12, 30, 30, I[2]); L.line(23, 12, 31, 30, I[1])
    L.rect(24, 16, 34, 24, W[3]); L.hl(24, 16, 34, W[5]); L.vl(24, 16, 24, W[5]); L.vl(57, 16, 24, W[1])
    for y in range(21, 40, 6):
        L.hl(24, y, 34, W[1]); L.hl(24, y + 1, 34, W[4])
    for x in range(30, 58, 8):
        L.vl(x, 17, 23, W[2])
    for i in range(9):
        tx = 27 + i * 3 + rng.randint(0, 1); ty = 3 + rng.randint(0, 8)
        L.line(tx + 1, ty + 4, tx + 1 + rng.randint(-1, 1), 16, LF[3])
        Tc = R[rng.choice(['red', 'red', 'yellow', 'red'])]
        L.rect(tx, ty, 3, 4, Tc[4]); L.px(tx, ty, Tc[6]); L.px(tx + 2, ty + 3, Tc[2]); L.px(tx + 1, ty - 1, Tc[5])
        L.line(tx + 2, 10 + rng.randint(0, 3), tx + 5, 6 + rng.randint(0, 5), LF[4])
    return L


def fg_planter(rng, w=70, leaf='leaf'):
    W = R['wood']; LF = R[leaf]
    L = Layer(w, 44)
    L.rect(0, 24, w, 20, W[3]); L.hl(0, 24, w, W[5]); L.hl(0, 25, w, W[4])
    for x in range(0, w, 9):
        L.vl(x, 26, 18, W[1])
    L.hl(0, 33, w, W[2])
    C = canopy(w + 4, 32, LF, rng.randint(1, 999), nb=8, rag=6, holes=0.12, spread=0.36)
    L.blit(C, -2, 0)
    for i in range(10):
        fc = R[rng.choice(['red', 'yellow', 'white'])]
        fx, fy = rng.randint(4, w - 6), rng.randint(4, 22)
        if L.get(fx, fy):
            L.rect(fx, fy, 2, 2, fc[5]); L.px(fx + 1, fy + 1, fc[3])
    return L


def fg_chairs(rng):
    """A cafe table and two chair backs at the lower screen edge."""
    W = R['wood']; I = R['iron']; G = R['glass']; Y = R['yellow']
    L = Layer(96, 46)
    L.rect(26, 22, 44, 3, W[4]); L.hl(26, 22, 44, W[6]); L.hl(26, 24, 44, W[1]); L.rect(46, 25, 4, 21, I[2]); L.vl(46, 25, 21, I[4])
    L.rect(34, 13, 5, 9, G[4]); L.rect(35, 16, 3, 6, Y[5]); L.hl(34, 13, 5, G[6]); L.vl(38, 13, 9, G[2])      # a glass of beer
    L.rect(54, 16, 7, 6, R['white'][5]); L.hl(54, 16, 7, R['white'][6]); L.px(61, 18, R['white'][4])           # a cup
    for x0 in (0, 74):
        L.rect(x0, 8, 22, 3, W[3]); L.hl(x0, 8, 22, W[5]); L.rect(x0, 14, 22, 3, W[3]); L.hl(x0, 14, 22, W[5])
        L.rect(x0 + 1, 4, 3, 42, W[2]); L.vl(x0 + 1, 4, 42, W[4]); L.rect(x0 + 18, 4, 3, 42, W[2]); L.vl(x0 + 20, 4, 42, W[1])
        L.rect(x0 - 0, 30, 22, 3, W[3]); L.hl(x0, 30, 22, W[5])
    return L


def crates(rng):
    """A few wooden crates and a barrel on the quay."""
    W = R['wood']; I = R['iron']
    L = Layer(54, 34)
    def crate(x, y, w, h):
        L.rect(x, y, w, h, W[3]); L.hl(x, y, w, W[5]); L.vl(x, y, h, W[5]); L.vl(x + w - 1, y, h, W[1]); L.hl(x, y + h - 1, w, W[1])
        for yy in range(y + 4, y + h - 2, 4):
            L.hl(x + 1, yy, w - 2, W[2])
        L.line(x + 1, y + 1, x + w - 2, y + h - 2, W[2]); L.rect(x, y, 2, h, W[4]); L.rect(x + w - 2, y, 2, h, W[2])
    crate(0, 16, 20, 18); crate(18, 20, 16, 14); crate(4, 2, 16, 14)
    bx = 37
    for j in sub(0, 20):
        bw = 6 + ((2 if 4 < j < 16 else (1 if 1 < j < 18 else 0)) if U == 1 else 2.0 * math.sin(math.pi * min(1.0, (j + D1) / 20)) ** 0.6)
        L.rect(bx + 8 - bw, 14 + j, 2 * bw, D1, W[3]); L.rect(bx + 8 - bw, 14 + j, 1, D1, W[5]); L.rect(bx + 8 - bw + 1, 14 + j, 1, D1, W[4]); L.rect(bx + 7 + bw, 14 + j, 1, D1, W[1])
    for j in (16, 23, 30):
        L.hl(bx + 1, j, 15, I[2]); L.px(bx + 2, j, I[4])
    L.hl(bx + 2, 14, 12, W[5])
    return L


def sailbarge(rng, sail='red'):
    """A flat-bottomed sailing barge under a tanned sail: a strong shape against a low sun."""
    K = R['black']; W = R['wood']; SL = R[sail]; T = R['white']
    L = Layer(84, 84)
    wl = 72
    for x in sub(8, 78):
        t = min(1.0, (x - 8) / 69.0)
        top = wl - 7 + rq(2.2 * (2 * t - 1) ** 2) - 1
        e = min(x - 8, 77 - x)
        cut = (3 if e < 3 else (1 if e < 7 else 0)) if U == 1 else 3.0 * max(0.0, 1 - (e + D1) / 7.5) ** 1.5
        bot = wl - cut
        L.rect(x, top, D1, bot - top, K[1]); L.rect(x, top, D1, 1, T[4]); L.rect(x, top + 1, D1, 1, K[3])
    L.rect(54, wl - 13, 12, 6, W[3]); L.hl(53, wl - 14, 14, W[5])
    L.vl(34, 4, wl - 10, W[2]); L.vl(35, 4, wl - 10, W[4])
    # mainsail (gaff) and jib
    L.poly([(37, 12), (64, 6), (70, wl - 16), (37, wl - 14)], SL[3])
    L.poly([(37, 12), (50, 9), (52, wl - 15), (37, wl - 14)], SL[4])
    for y in range(18, wl - 16, 9):
        L.line(37, y, 68, y - 3, SL[2])
    L.line(37, 12, 64, 6, W[4]); L.line(37, wl - 14, 71, wl - 16, W[4])
    L.poly([(33, 8), (33, wl - 12), (12, wl - 10)], SL[2]); L.line(33, 8, 12, wl - 10, SL[4])
    L.line(35, 4, 9, wl - 8, K[2])
    L.px(35, 3, R['red'][5]); L.hl(36, 3, 4, R['red'][4])
    xx, yy = grid(8, wl, 70, 84 - wl)                                   # its own broken mirror
    xs = xx - np.round(2 * np.sin(np.floor(yy * DET) / DET * 1.7))
    m = chk(xs, yy) & (hash01(xs / 3, yy * DET, 5) > 0.25 + (yy - wl) * 0.05) & (xs >= 10) & (xs < 76)
    L.put(8, wl, np.where(((xs > 20) & (xs < 70))[..., None], np.array(K[1], np.uint8), np.array(K[2], np.uint8)), m)
    return L


def dolphin(rng):
    """A cluster of mooring piles in the water, with a gull."""
    W = R['wood']; M = R['moss']; T = R['white']
    L = Layer(18, 40)
    for (x, top, lean) in ((3, 6, 0), (8, 2, 0), (12, 8, 0)):
        L.rect(x, top, 4, 30 - top, W[2]); L.vl(x, top, 30 - top, W[4]); L.vl(x + 3, top, 30 - top, W[1]); L.hl(x, top, 4, W[5])
        L.rect(x, 26, 4, 4, M[2]); L.hl(x, 26, 4, M[3])
    L.hl(2, 14, 15, R['iron'][2]); L.hl(2, 15, 15, R['iron'][1])
    L.rect(8, 0, 4, 2, T[5]); L.px(12, 0, R['yellow'][5]); L.px(7, 1, T[3])
    xx, yy = grid(1, 30, 16, 10)
    xs = xx - np.round(1.5 * np.sin(np.floor(yy * DET) / DET * 1.9))
    m = chk(xs, yy) & (hash01(xs / 2, yy * DET, 3) > 0.3 + (yy - 30) * 0.06) & (xs >= 3) & (xs < 16)
    L.put(1, 30, np.broadcast_to(np.array(W[1], np.uint8), xx.shape + (3,)), m)
    return L


def windmill(h=58):
    """A tower mill: a tapering body, a cap, four sails."""
    B = R['brick_brown']; W = R['wood']; T = R['white']; K = R['black']
    L = Layer(60, h + 24)
    cx = 30; top = 26
    for y in sub(top, h + 24):
        t = (y - top) / (h + 24 - top)
        hw = 6 + 6 * t
        xl = int(cx - hw) if U == 1 else cx - hw
        wd_ = int(2 * hw) if U == 1 else 2 * hw
        L.rect(xl, y, wd_, D1, B[3]); L.rect(xl, y, 1, D1, B[5]); L.rect(xl + wd_ - 1, y, 1, D1, B[1])
    L.rect(cx - 7, top - 6, 14, 7, K[2]); L.hl(cx - 6, top - 7, 12, K[3]); L.hl(cx - 4, top - 8, 8, K[2])
    L.hl(cx - 9, top + 16, 18, W[4]); L.hl(cx - 9, top + 17, 18, W[1])
    for a in (35, 125, 215, 305):
        x1 = cx + math.cos(math.radians(a)) * 26; y1 = top - 3 - math.sin(math.radians(a)) * 26
        L.line(cx, top - 3, x1, y1, W[2])
        px_ = -math.sin(math.radians(a)) * 4; py_ = -math.cos(math.radians(a)) * 4
        for k in range(8, 27, 3):
            xa = cx + math.cos(math.radians(a)) * k; ya = top - 3 - math.sin(math.radians(a)) * k
            L.line(xa, ya, xa + px_, ya + py_, W[3])
        L.line(cx + math.cos(math.radians(a)) * 8 + px_, top - 3 - math.sin(math.radians(a)) * 8 + py_, x1 + px_, y1 + py_, W[3])
    for y in (top + 8, top + 26, top + 44):
        if y < h + 20:
            L.rect(cx - 1, y, 3, 4, R['glass'][0]); L.hl(cx - 1, y - 1, 3, T[4])
    return L


def smoke(w=40, h=46, seed=3, pal=None):
    pal = pal or [(120, 122, 118), (150, 152, 144), (182, 182, 170), (210, 208, 192)]
    L = Layer(w, h)
    xx, yy = grid(0, 0, w, h)
    t = 1 - yy / (h - 1)
    cxl = 6 + t * (w - 18) + np.sin(yy / 6.0) * 2
    rad = 2 + t * 9
    d = np.abs(xx - cxl) / rad
    n = fbm(xx / 5.0, yy / 5.0, seed, 3)
    v = (1 - d) * 0.9 + (n - 0.5) * 0.9 - t * 0.35
    idx = np.clip((v * len(pal)).astype(int), 0, len(pal) - 1)
    L.a[..., :3] = np.array(pal, np.uint8)[idx]
    L.a[..., 3] = np.where((v > 0.12) & ~((v < 0.3) & ~chk(xx, yy)), 255, 0)
    return L
