# Scenery parts, second file: trees, far-bank street furniture, quay walls, boats, bridges, water.
import math
import random
import numpy as np
from PIL import Image
from kit import *
from parts import R, EM, brickfill, window, q_, text, text_w

q = q_


# ---------------------------------------------------------------- trees
def canopy(w, h, P, seed, light=(-0.60, -0.72, 0.36), holes=0.10, rag=5.0, nb=9, spread=0.30):
    """A mass of leaves: spheres, a ragged edge, sky holes, leaf clusters two or three pixels wide."""
    r = random.Random(seed)
    L = Layer(w, h)
    xx, yy = grid(0, 0, w, h)
    H = np.zeros(xx.shape)
    for i in range(nb):
        a = r.uniform(0, 2 * math.pi); d = r.random() ** 0.6
        bx = w / 2 + math.cos(a) * d * w * spread; by = h * 0.50 + math.sin(a) * d * h * (spread - 0.02)
        rad = min(w, h) * r.uniform(0.19, 0.30)
        d2 = (xx + .5 - bx) ** 2 + (yy + .5 - by) ** 2
        H = np.maximum(H, np.sqrt(np.maximum(rad * rad - d2, 0)))
    rg = fbm(xx / 3.0, yy / 3.0, seed + 1, 2)
    if U > 1:                                                # a leafy edge: a finer second noise
        rg = rg + (fbm(xx / 1.1, yy / 1.1, seed + 7, 1) - 0.5) * 0.55
    inside = (H + (rg - 0.5) * rag) > 1.4
    inside &= ~(fbm(xx / 4.0, yy / 4.0, seed + 2, 2) > 1 - holes)
    gy, gx = grad(H)
    nz = np.full_like(H, 1.3)
    ln = np.sqrt(gx * gx + gy * gy + nz * nz)
    lx, ly, lz = light
    ll = math.sqrt(lx * lx + ly * ly + lz * lz)
    sh = 0.5 + 0.5 * ((-gx) * lx + (-gy) * ly + nz * lz) / (ln * ll)
    sh = sh * (0.72 + 0.28 * np.clip((h - yy) / h, 0, 1))
    cl = fbm(xx / 2.4, yy / 2.4, seed + 3, 2)
    v = sh * 0.80 + (cl - 0.5) * (0.55 + 0.12 * XO)
    n = len(P)
    idx = np.clip(np.floor(v * n), 1, n - 1).astype(int)
    L.a[..., :3] = np.array(P, np.uint8)[idx]
    L.a[..., 3] = np.where(inside, 255, 0)
    L.outline(P[0], 'br')
    # a light rim on the sun side
    m = L.mask()
    rim = np.zeros_like(m)
    k = max(1, U // 2)
    rim[k:, :] = m[k:, :] & ~m[:-k, :] & (hs(xx[k:, :], yy[k:, :], seed + 4) > 0.45)
    L.a[..., :3][rim] = P[-1]
    return L


def branches(L, x, y, length, ang, P, rng, depth=3, wd=1):
    if depth == 0 or length < 2:
        return
    x1 = x + math.cos(ang) * length; y1 = y - math.sin(ang) * length
    L.line(x, y, x1, y1, P[1], t=1 if depth >= 3 else TH)
    if wd > 1:
        L.line(x + 1, y, x1 + 1, y1, P[2])
    for k in range(2):
        branches(L, x1, y1, length * rng.uniform(0.55, 0.75), ang + rng.uniform(0.35, 0.8) * (1 if k else -1), P, rng, depth - 1)


def tree_far(rng, cw=46, ch=40, th=24, leaf='leaf', seed=1, bare=0.0, tw=3):
    """A quay tree at far-bank scale. bare 0..1: how much of the crown is open (autumn)."""
    BK = R['bark']; LF = R[leaf]
    L = Layer(cw, ch + th)
    tx = cw // 2 - tw // 2
    L.rect(tx, ch * 0.55, tw, th + ch * 0.45, BK[2]); L.vl(tx, ch * 0.55, th + ch * 0.45, BK[4])
    L.vl(tx + tw - 1, ch * 0.55, th + ch * 0.45, BK[1])
    for yy in range(int(ch * 0.6), ch + th, 5):
        L.px(tx + 1, yy + rng.randint(0, 2), BK[1])
    for a in (0.6, 1.1, 1.57, 2.0, 2.5):
        branches(L, cw / 2, ch * 0.72, ch * rng.uniform(0.26, 0.36), a + rng.uniform(-0.15, 0.15), BK, rng, 3 if bare > 0.3 else 2)
    C = canopy(cw, ch, LF, seed, holes=0.10 + bare * 0.55, rag=5 + bare * 5)
    L.blit(C, 0, 0)
    L.rect(tx - 1, ch + th - 1, tw + 2, 1, BK[1])
    return L


# ---------------------------------------------------------------- far-bank street furniture (about 6 px per metre)
def car_far(rng, c=None):
    C = R[c or rng.choice(['red', 'blue', 'white', 'black', 'iron', 'green', 'yellow', 'white'])]
    G = R['glass']; K = R['black']
    van = rng.random() < 0.2
    w = 26 if van else rng.randint(21, 24)
    L = Layer(w, 11)
    if van:
        L.rect(0, 1, w - 6, 8, C[4]); L.rect(w - 6, 4, 6, 5, C[4]); L.rect(w - 7, 2, 4, 3, G[2]); L.hl(0, 1, w - 6, C[6])
        L.hl(0, 8, w, C[2]); L.vl(0, 1, 8, C[5]); L.px(w - 1, 6, R['yellow'][6])
    else:
        L.rect(0, 5, w, 4, C[4])
        L.rect(4, 2, w - 10, 3, C[4]); L.px(3, 4, C[4]); L.px(w - 6, 4, C[4]); L.px(w - 6, 3, C[3])
        L.hl(5, 2, w - 12, C[6]); L.hl(0, 5, w, C[5]); L.hl(0, 8, w, C[2])
        L.rect(5, 3, (w - 12) // 2, 2, G[2]); L.rect(6 + (w - 12) // 2, 3, (w - 12) // 2 - 1, 2, G[1]); L.px(5, 3, G[4])
        L.px(0, 6, R['red'][5]); L.px(w - 1, 6, R['yellow'][6])
    for wx in (3, w - 7):
        if U == 1:
            L.rect(wx, 7, 4, 3, K[1]); L.px(wx, 7, C[2]); L.px(wx + 3, 7, C[2]); L.px(wx + 1, 8, K[4]); L.px(wx + 2, 8, K[3])
            L.px(wx, 9, K[1])
        else:
            L.ellipse(wx + 2, 8.3, 2.3, 2.0, C[1]); L.ellipse(wx + 2, 8.5, 1.9, 1.7, K[1]); L.ellipse(wx + 2, 8.5, 0.8, 0.7, K[4])
    L.hl(1, 10, w - 2, K[0])
    return L


def bike_far(rng, c=None):
    I = R['iron']; C = R[c or rng.choice(['black', 'red', 'blue', 'green', 'iron', 'white'])]
    L = Layer(12, 8)
    t = 1 if U == 1 else 0.6
    for cx in (2.5, 9.0):
        L.ring(cx, 5.0, 2.6, I[1], 1.5 if U == 1 else 2.0)
    L.line(2, 5, 5, 2, C[3], t); L.line(5, 2, 8, 2, C[3], t); L.line(8, 2, 9, 5, C[3], t); L.line(5, 5, 8, 2, C[2], t)
    L.hl(4, 1, 2, I[0]); L.px(9, 1, I[1]); L.px(8, 1, I[2]); L.px(10, 0, I[1])
    if rng.random() < 0.3:
        L.rect(8, 0, 3, 2, R['wood'][3])
    return L


def lamp_far(h=26, lit=False):
    I = R['iron']
    L = Layer(5, h)
    L.vl(2, 5, h - 5, I[2]); L.px(2, h - 1, I[1]); L.hl(1, h - 2, 3, I[1])
    L.rect(1, 1, 3, 4, I[1]); L.px(2, 0, I[2]); L.hl(0, 1, 5, I[2])
    L.rect(1, 2, 3, 2, EM[0] if lit else R['glass'][5]); L.px(2, 3, EM[1] if lit else R['glass'][3])
    return L


def bollards_far(L, x0, x1, y, rng, step=7):
    P = R['brick_brown']
    for x in range(x0, x1, step):
        if rng.random() < 0.85:
            L.vl(x, y - 3, 3, P[2]); L.px(x, y - 3, P[4])


# ---------------------------------------------------------------- quay wall
def quay_wall(L, x, y, w, h, rng, seed=7, brick='brick_brown', cap=2, waterline=True):
    """Brick quay wall with a stone coping, stains, mooring rings, drains and the green band at the water."""
    B = R[brick]; S = R['stone']; I = R['iron']; M = R['moss']
    brickfill(L, x, y + cap, w, h - cap, B, seed, lo=1, hi=4, mid=2)
    L.rect(x, y, w, cap, S[5]); L.hl(x, y, w, S[6])
    L.hl(x, y + cap, w, B[0])
    xx = x
    while xx < x + w:
        L.px(xx, y + cap - 1, S[3]); L.px(xx, y, S[4])
        xx += rng.randint(6, 11)
    for i in range(w // 26):
        sx = x + rng.randint(0, w - 2)
        ln = rng.randint(2, h - cap - 1)
        for j in range(ln):                                        # a run stain under the coping
            L.px(sx + (j // 3) % 2, y + cap + 1 + j, B[1])
    for i in range(w // 60 + 1):
        dx = x + rng.randint(4, max(5, w - 8))
        if h - cap >= 6:
            L.rect(dx, y + h - 4, 4, 3, B[0]); L.hl(dx + 1, y + h - 5, 2, B[0]); L.px(dx, y + h - 5, B[4]); L.px(dx + 3, y + h - 5, B[4])
    for i in range(w // 44 + 1):
        rx = x + rng.randint(2, max(3, w - 4))
        L.px(rx, y + cap + 2, I[3]); L.px(rx, y + cap + 3, I[1]); L.px(rx + 1, y + cap + 3, I[1])
    if waterline:
        for xi in range(x, x + w):
            t = hash01(np.array(xi), np.array(0), seed + 3)
            L.px(xi, y + h - 1, M[1]); L.px(xi, y + h - 2, M[2] if t > 0.35 else M[1])
            if t > 0.8 and h - cap > 5:
                L.px(xi, y + h - 3, M[2])


# ---------------------------------------------------------------- boats (far-bank scale)
def houseboat(rng, w=74, c=None, lit=None):
    """A houseboat (ark): low hull, a cabin with windows, a flat roof with plants. Returns (Layer, window boxes)."""
    C = R[c or rng.choice(['white', 'green', 'blue', 'wood', 'brick_ochre', 'canvas'])]
    K = R['black']; G = R['glass']; T = R['white']; I = R['iron']; LF = R['leaf']
    L = Layer(w, 22)
    wins = []
    L.rect(0, 16, w, 5, K[1]); L.hl(0, 16, w, K[3]); L.hl(1, 20, w - 2, K[0]); L.hl(0, 17, w, R['wood'][3])
    L.px(0, 16, K[0]); L.px(w - 1, 16, K[0])
    x0, x1 = 3, w - 4 - rng.randint(0, 8)
    L.rect(x0, 6, x1 - x0, 10, C[4]); L.hl(x0, 15, x1 - x0, C[2]); L.vl(x0, 6, 10, C[5]); L.vl(x1 - 1, 6, 10, C[2])
    for xx in range(x0 + 3, x1 - 1, 4):
        L.vl(xx, 7, 9, C[3], t=TH)                                 # boards
    L.rect(x0 - 1, 4, x1 - x0 + 2, 2, R['stone'][5]); L.hl(x0 - 1, 5, x1 - x0 + 2, R['stone'][2]); L.hl(x0, 6, x1 - x0, C[1])
    xx = x0 + 3
    while xx < x1 - 8:
        ww = rng.choice([5, 7, 7, 9])
        if rng.random() < 0.18:
            L.rect(xx, 8, 4, 8, T[5]); L.rect(xx + 1, 9, 2, 7, R[rng.choice(['red', 'green', 'blue'])][3])
            xx += 7
            continue
        L.rect(xx, 8, ww, 6, T[5]); L.rect(xx + 1, 9, ww - 2, 4, G[1]); L.px(xx + 1, 9, G[4])
        if rng.random() < 0.5:
            L.rect(xx + 1, 11, ww - 2, 2, T[4])
        if ww >= 7:
            L.vl(xx + ww // 2, 9, 4, T[5])
        wins.append((xx + 1, 9, ww - 2, 4))
        if rng.random() < 0.3:
            for fx in range(xx, xx + ww, 2):
                L.px(fx, 14, R['red'][5] if rng.random() < 0.6 else R['yellow'][5]); L.px(fx + 1, 14, LF[3])
        xx += ww + rng.randint(2, 5)
    # roof things: plants, chimney, a chair
    for i in range(rng.randint(2, 4)):
        px_ = rng.randint(x0 + 2, x1 - 6)
        L.rect(px_, 2, 3, 2, R['roof_tile'][3]); L.hl(px_, 1, 3, LF[3]); L.px(px_ + 1, 0, LF[5]); L.px(px_, 1, LF[5])
    cx_ = rng.randint(x0 + 4, x1 - 5)
    L.vl(cx_, 0, 4, I[2]); L.hl(cx_ - 1, 0, 3, I[3])
    if x1 < w - 9:                                                 # the open deck
        L.vl(w - 4, 11, 5, I[2]); L.hl(x1, 11, w - 3 - x1, I[2]); L.vl(x1 + 3, 11, 5, I[1])
        L.rect(x1 + 2, 13, 3, 3, LF[2]); L.px(x1 + 3, 12, LF[4])
    return L, wins


def sloop(rng, w=26, c=None):
    C = R[c or rng.choice(['blue', 'green', 'white', 'red', 'black', 'wood'])]
    T = R['white']; CV = R[rng.choice(['canvas', 'blue', 'green'])]
    L = Layer(w, 9)
    for x in sub(0, w):
        t = min(1.0, x / (w - 1))
        top = 3 + rq(1.6 * (1 - 4 * (t - 0.5) ** 2)) - 1              # sheer: the ends ride high
        e = min(x, w - 1 - x)
        cut = (2 if e < 2 else (1 if e < 4 else 0)) if U == 1 else 2.2 * max(0.0, 1 - (e + D1) / 4.5) ** 1.5
        bot = 8 - cut
        L.rect(x, top, D1, bot - top, C[3])
        L.rect(x, top, D1, 1, T[5]); L.rect(x, top + 1, D1, 1, C[5]); L.rect(x, bot - 1, D1, 1, C[1])
    if rng.random() < 0.65:
        for x in range(4, w - 5):
            L.px(x, 2 + (0 if 6 < x < w - 8 else 1), CV[4]); L.px(x, 3, CV[3])
        L.hl(7, 1, w - 15, CV[5])
    else:
        L.hl(4, 3, w - 8, R['wood'][2]); L.vl(w // 2, 1, 2, R['wood'][4])
    L.rect(0, 2, 2, 3, R['black'][2]); L.px(0, 1, R['black'][3])
    return L


def barge(rng, w=110, c=None):
    """An old sailing barge moored as a home: black hull with sheer, hatch covers, a wheelhouse aft."""
    K = R['black']; T = R['white']; W = R['wood']; G = R['glass']; CV = R[c or rng.choice(['green', 'canvas', 'blue'])]; I = R['iron']
    L = Layer(w, 26)
    wins = []
    for x in sub(0, w):
        t = min(1.0, x / (w - 1))
        sheer = rq(2.4 * (2 * t - 1) ** 2)
        top = 14 - sheer
        e = min(x, w - 1 - x)
        cut = (3 if e < 2 else (2 if e < 5 else (1 if e < 9 else 0))) if U == 1 else 3.2 * max(0.0, 1 - (e + D1) / 9.5) ** 1.6
        bot = 25 - cut
        L.rect(x, top, D1, bot - top, K[1])
        L.rect(x, top, D1, 1, T[5]); L.rect(x, top + 1, D1, 1, K[3]); L.rect(x, top + 3, D1, 1, R['red'][2] if int(x) % 9 else K[1])
        L.rect(x, bot - 1, D1, 1, R['roof_tile'][2])
    hx0, hx1 = 14, w - 34
    L.rect(hx0, 9, hx1 - hx0, 5, CV[3]); L.hl(hx0, 9, hx1 - hx0, CV[5]); L.hl(hx0, 13, hx1 - hx0, CV[1])
    for xx in range(hx0 + 6, hx1, 9):
        L.vl(xx, 9, 5, CV[2]); L.vl(xx + 1, 9, 5, CV[4])
    wx = w - 30
    L.rect(wx, 3, 16, 11, W[4]); L.hl(wx - 1, 2, 18, T[6]); L.hl(wx - 1, 3, 18, T[3]); L.vl(wx, 4, 10, W[5]); L.vl(wx + 15, 4, 10, W[2])
    for i in range(3):
        L.rect(wx + 2 + i * 5, 5, 3, 4, G[1]); L.px(wx + 2 + i * 5, 5, G[4]); wins.append((wx + 2 + i * 5, 5, 3, 4))
    L.hl(wx, 10, 16, W[2])
    L.vl(9, 0, 13, W[3]); L.vl(10, 0, 13, W[1]); L.line(10, 2, hx1 - 4, 8, W[3])       # mast and lowered boom
    L.vl(w - 6, 6, 8, I[2]); L.rect(w - 9, 8, 4, 3, R['red'][4]); L.rect(w - 9, 8, 4, 1, T[5])    # flag staff, flag
    L.rect(4, 11, 3, 2, I[2])
    return L, wins


def tourboat(rng, w=96):
    """A low canal cruiser with a glass roof (an own design)."""
    T = R['white']; G = R['glass']; B = R['blue']; K = R['black']
    L = Layer(w, 15)
    for x in sub(0, w):
        e = min(x, w - 1 - x)
        cut = (2 if x < 3 or x > w - 3 else (1 if x < 7 or x > w - 6 else 0)) if U == 1 else 2.2 * max(0.0, 1 - (e + D1) / 7.0) ** 1.5
        bot = 14 - cut
        top = 8 - (1 if x > w - 12 else 0)
        L.rect(x, top, D1, bot - top, T[5]); L.rect(x, top, D1, 1, T[6]); L.rect(x, bot - 1, D1, 1, K[2]); L.rect(x, top + 2, D1, 1, B[3]); L.rect(x, top + 3, D1, 1, B[2])
    L.rect(10, 2, w - 30, 6, G[2]); L.hl(10, 2, w - 30, T[6]); L.hl(11, 3, w - 32, G[5]); L.hl(11, 4, w - 32, G[4])
    for xx in range(10, w - 20, 7):
        L.vl(xx, 2, 6, T[5])
    for xx in range(13, w - 24, 7):
        L.px(xx, 6, K[2]); L.px(xx + 2, 6, R['red'][3]); L.px(xx + 1, 7, K[3])
    L.rect(w - 20, 4, 6, 4, G[1]); L.px(w - 19, 4, G[5]); L.hl(w - 21, 3, 8, T[6])
    return L


# ---------------------------------------------------------------- bridges
def arch_bridge(w=76, h=26, arches=1, rng=None, brick='brick_brown', lamps=True):
    """A brick arch bridge seen from the side: stone arch rings, a keystone, an iron rail, lanterns.
       Returns (Layer, arch openings [(x, y, w, h)] as transparent holes, lamp points)."""
    rng = rng or random.Random(3)
    B = R[brick]; S = R['stone']; I = R['iron']
    L = Layer(w, h + 12)
    top = 12
    hump = lambda x: rq(3.0 * (1 - ((x - w / 2) / (w / 2)) ** 2))       # the deck rises to the middle
    for x in sub(0, w):
        y0 = top + 3 - hump(x)
        L.rect(x, y0, D1, h + 12 - y0, B[3])
    brickfill(L, 0, top - 2, w, h + 2, B, 41, mask=L.view(0, top - 2, w, h + 2)[..., 3] > 0, lo=1, hi=5)
    holes = []
    aw = (w - 8 - (arches - 1) * 6) // arches
    for a in range(arches):
        ax = 4 + a * (aw + 6)
        rise = min(h - 6, int(aw * 0.42))
        for x in sub(0, aw):
            t = (x + 0.5 * D1) / aw * 2 - 1
            yt = top + h - rq(rise * math.sqrt(max(0, 1 - t * t)))
            L.clear(ax + x, yt, D1, top + h - yt)
            L.rect(ax + x, yt - 1, D1, 1, S[5])                          # the stone ring
            L.rect(ax + x, yt - 2, D1, 1, S[4] if (int(x) // 3) % 2 else S[3])
        L.rect(ax + aw // 2 - 1, top + h - rise - 4, 3, 4, S[6]); L.vl(ax + aw // 2 + 1, top + h - rise - 4, 4, S[3])
        holes.append((ax, top + h - rise, aw, rise))
        for px_ in (ax - 2, ax + aw):                                  # piers
            L.rect(px_, top + h - 7, 2, 7, S[4]); L.vl(px_, top + h - 7, 7, S[6])
    lamps_at = []
    for x in sub(0, w):
        y0 = top + 3 - hump(x)
        L.rect(x, y0, D1, 1, S[6]); L.rect(x, y0 + 1, D1, 1, S[5]); L.rect(x, y0 + 2, D1, 1, S[2])   # the deck edge stone
        L.rect(x, y0 - 4, D1, TH, I[2])                                # rail
    for x in range(0, w, 3):
        y0 = top + 3 - hump(x)
        L.vl(x, y0 - 4, 4, I[1], t=TH)
    if lamps:
        for x in (3, w - 4, w // 2):
            y0 = int(math.floor(top + 3 - hump(x) + 0.5))
            L.vl(x, y0 - 11, 8, I[2]); L.rect(x - 1, y0 - 14, 3, 3, R['glass'][5]); L.hl(x - 1, y0 - 15, 3, I[1]); L.px(x, y0 - 16, I[2])
            lamps_at.append((x, y0 - 13))
    return L, holes, lamps_at


def drawbridge(w=70, h=34, rng=None):
    """A white wooden drawbridge: two portal frames with balance beams and chains, a flat deck, brick abutments."""
    T = R['white']; B = R['brick_brown']; S = R['stone']; I = R['iron']; W = R['wood']; K = R['black']
    L = Layer(w, h + 14)
    deck = h
    for ax in (0, w - 12):
        brickfill(L, ax, deck, 12, 14, B, 77 + ax, lo=1, hi=5)
        L.hl(ax, deck, 12, S[6]); L.hl(ax, deck + 1, 12, S[3])
    L.rect(10, deck, w - 20, 3, W[3]); L.hl(10, deck, w - 20, T[5]); L.hl(10, deck + 2, w - 20, W[1])
    for x in range(10, w - 10, 4):
        L.px(x, deck + 1, W[1])
    for px_, d in ((13, 1), (w - 16, -1)):
        # the portal frame: two posts, a cross beam, a brace
        L.rect(px_, 5, 3, deck - 5, T[5]); L.vl(px_, 5, deck - 5, T[6]); L.vl(px_ + 2, 5, deck - 5, T[2])
        L.line(px_ + (3 if d > 0 else -1), deck - 2, px_ + (9 if d > 0 else -7), deck - 11, T[3])
        L.rect(px_ - 1, 3, 5, 2, T[5]); L.hl(px_ - 1, 3, 5, T[6]); L.hl(px_ - 1, 5, 5, T[2])
        # the balance beam: the short arm with the weight box points to the land, the long arm over the deck
        x0 = px_ + 1 - d * 10; x1 = px_ + 1 + d * (w // 2 - 15)
        for k in (0, 1):
            L.line(x0, 4 + k, x1, 0 + k, T[5] if k == 0 else T[2])
        bx = x0 - (2 if d > 0 else 1)
        L.rect(bx - 1, 4, 5, 6, T[4]); L.hl(bx - 1, 4, 5, T[6]); L.vl(bx + 3, 5, 5, T[2]); L.hl(bx - 1, 9, 5, T[2])
        for yy in range(2, deck, 2):                                   # the chain down to the deck
            L.px(x1, yy, I[1])
    for x in range(10, w - 10):                                        # rail
        L.px(x, deck - 4, T[5]); L.px(x, deck - 3, T[2])
        if x % 4 == 0:
            L.vl(x, deck - 4, 4, T[5])
    return L


# ---------------------------------------------------------------- water
def water(src, y_line, rows, w_far, w_near, body_far, body_near, glint, seed=5, frames=3, k=2.6, ncol=30,
          mix0=0.30, mix1=0.64, wob=(0.5, 2.6), lights=None, streak=1.0):
    """The canal as a perspective plane of `rows` logical rows (far -> near).
       src: RGB array in real pixels: what stands above the water line y_line (sky, far bank). It is mirrored,
       squeezed by k, sheared by ripples, mixed into the body colour and cut to ncol colours.
       Each row is as wide as its scroll speed needs: the page scrolls each row at its own speed (line scroll).
       lights: [(x, colour, strength)] lamps on the far bank: long broken streaks."""
    hs_, ws = src.shape[:2]
    outs = []
    bf = np.array(body_far, float); bn = np.array(body_near, float); gl = np.array(glint, float)
    rp = P(rows); wf = P(w_far); wn = P(w_near)
    for f in range(frames):
        ph = f * 2 * math.pi / frames
        img = np.zeros((rp, wn, 3), float)
        for j in range(rp):
            jl = j / U                                                 # the logical row
            r = j / max(rp - 1, 1)
            wr = int(round(wf + (wn - wf) * r))
            u = np.arange(wr) / U                                      # logical x in the row
            amp = wob[0] + (wob[1] - wob[0]) * r
            dx = amp * math.sin(jl * 2.4 + ph) + amp * 1.2 * (vnoise(u / (16.0 + 14 * r), np.full(wr, jl * 0.61 + f * 0.37), seed) - 0.5) * 2
            uf = np.clip(((u * (wf / wr) + dx) * U).astype(int), 0, ws - 1)
            sy = int(np.clip(math.floor((y_line - jl * k) * U) - 1, 0, hs_ - 1))
            c = src[sy, uf].astype(float)
            body = bf + (bn - bf) * r
            m = mix0 + (mix1 - mix0) * r
            c = c + (body - c) * m
            # ripples: lens shapes one or two rows high, longer toward the viewer
            p = fbm(u / (9.0 + 26.0 * r) + f * 0.8, np.full(wr, jl / 1.9), seed + 3, 2)
            p2 = vnoise(u / (4.0 + 9.0 * r) - f * 0.6, np.full(wr, jl / 1.25), seed + 7)
            lightm = ((p > 0.63) & (p2 > 0.55))[:, None]
            darkm = ((p < 0.38) & (p2 < 0.47))[:, None]
            c = np.where(lightm, c + (gl - c) * (0.30 + 0.16 * (1 - r)) * streak, c)
            c = np.where(darkm, c + (bn * 0.70 - c) * (0.26 + 0.22 * r), c)
            if jl < 2:
                c = c * (0.62 + 0.16 * math.floor(jl))                 # the shade under the quay and the hulls
            img[j, :wr] = c
            if wr < wn:
                img[j, wr:] = c[-1]
        if lights:
            for (lx, lc, ls) in lights:
                lc = np.array(lc, float)
                for j in range(rp):
                    jl = j / U
                    r = j / max(rp - 1, 1)
                    wr = int(round(wf + (wn - wf) * r))
                    cx = (lx * (wr / wf) + (1.2 + 2.6 * r) * math.sin(jl * 2.3 + ph + lx)) * U
                    if hash01(np.array(math.floor(jl * DET) * 3 + f), np.array(int(lx)), seed + 21) < 0.22 + 0.3 * r:
                        continue
                    hw = int((1 + int(r * 2.2 * ls)) * U)
                    for xx in range(int(cx) - hw, int(cx) + hw + 1):
                        if 0 <= xx < wn:
                            a = (0.85 if abs(xx - int(cx)) <= hw - U else 0.45) * ls * (1 - 0.35 * r)
                            img[j, xx] = img[j, xx] + (lc - img[j, xx]) * min(a, 1)
        outs.append(img)
    # one palette for all frames
    allp = np.concatenate(outs, 0)
    im = Image.fromarray(np.clip(allp, 0, 255).astype(np.uint8), 'RGB').quantize(ncol, method=Image.MEDIANCUT, dither=Image.NONE).convert('RGB')
    a = snap5(np.asarray(im).astype(float))
    res = []
    for f in range(frames):
        L = Layer(w_near, rows)
        L.a[..., :3] = a[f * rp:(f + 1) * rp]; L.a[..., 3] = 255
        res.append(L)
    return res


