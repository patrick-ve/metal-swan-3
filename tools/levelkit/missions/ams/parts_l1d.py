# Parts of section d of level 1 (STOPERA, orange-pink sunset) in the canal look: the Waterlooplein flea market
# (house fronts, stalls with striped awnings, the breakable stall and bike rack), the Stopera (the curved
# marble-and-glass music theatre and the red-brick city-hall wing with its glass doors), the sunset sky, the
# Amstel behind, and the floor additions of the section (fan setts, kerb lines, the forecourt slabs, light pools).
# Daylight colours from the ramps; the hour comes from the key of the section (mission.py HOURS['sunset']).
import math
import random
import numpy as np
from parts_ams import *
from street_d import MARKET_U1, FORE_U0, FAR_K, NEAR_K

R['marble'] = ramp(7, .40, .97, .010, .016, .024, 285, 82)           # the white marble of the theatre
R['dusk'] = ramp(7, .15, .68, .036, .066, .058, 300, 262)            # curtain-wall glass that holds the dusk sky
R['rose'] = R['brick_rose']

HALO = [(255, 246, 200), (255, 224, 140), (250, 176, 96), (226, 132, 84)]
HALO_S = [(255, 236, 170), (250, 190, 110), (230, 140, 86)]


def A(name):
    return np.array(R[name], np.uint8)


# ---------------------------------------------------------------- sky, skyline, the Amstel
def sky_d(sec, sun=(262, 56)):
    """The banded sunset sky of the hour, bent around a low sun, the sun disc, and streak clouds lit from below."""
    H = sec.H
    SX, SY = sun
    S, spal = sky(VIEW_W, 156, H['sky'], n=18, seed=6, streak=0.045, glow=(SX, SY + 30, 160, 64, 0.22))
    glow(S, SX, SY, 27, [(255, 244, 184), (255, 228, 146), (255, 206, 120), (250, 176, 104)])
    S.ellipse(SX, SY, 10.5, 10.5, (255, 248, 214)); S.ellipse(SX, SY, 8, 8, (255, 255, 236))
    sec.add('sky', S, 0)
    sec.notes['spal'] = spal
    cp = [hx(c) for c in H['cloud']]
    CL = Layer(720, 112)
    for (x, y, w, h, sd) in [(0, 4, 360, 30, 41), (330, 18, 390, 30, 42), (90, 40, 330, 26, 43), (430, 54, 290, 22, 44), (0, 70, 260, 20, 45),
                             (560, 80, 160, 16, 46)]:
        CL.blit(wisp(w, h, cp, sd, cover=0.52, sx=46, sy=6.5, tilt=-0.01), x, y)
    sec.add('clouds', CL, 0.02, y=0, kind='tile', drift=0.8)
    return S, CL


def far_roofs_d(L, x0, x1, yb, rng, hmin=10, hmax=26, brick=None):
    """sets.far_roofs (copied) at the scale rule of the skyline (s 0.10): fronts 7-11 px wide, a storey of 4 px."""
    x = x0
    while x < x1:
        w = rng.randint(7, 11); h = rng.randint(hmin, hmax)
        B = R[rng.choice(brick or BRICKS)]
        L.rect(x, yb - h, w, h, B[3]); L.vl(x, yb - h, h, B[4]); L.vl(x + w - 1, yb - h, h, B[2])
        k = rng.choice(['tri', 'step', 'flat'])
        if k == 'tri':
            for i in sub(0, w // 2):
                L.rect(x + w // 2 - i, yb - h - (w // 2 - i), 2 * i + (w % 2), D1, B[3]); L.rect(x + w // 2 - i, yb - h - (w // 2 - i), 1, D1, R['plaster'][5])
        elif k == 'step':
            L.rect(x + 1, yb - h - 2, w - 2, 2, B[3]); L.rect(x + 3, yb - h - 4, max(1, w - 6), 2, B[3]); L.hl(x + 1, yb - h - 2, w - 2, R['plaster'][5])
        else:
            L.hl(x, yb - h, w, R['plaster'][5]); L.rect(x + 1, yb - h - 2, w - 2, 2, R['roof_slate'][3])
        for wy in range(yb - h + 2, yb - 3, SKY_STOREY):
            for wx in range(x + 2, x + w - 1, 3):
                L.vl(wx, wy, 2, R['glass'][1])
        x += w


SKY_STOREY = 4                                                   # the storey of the skyline plane (40 px x 0.10)


def skyline_d(sec, speed=0.10, yb=118):
    """Far roofs and towers as warm silhouettes in the air of the sun."""
    W1 = sec.lw(speed)
    SK = Layer(W1, VIEW_H)
    far_roofs_d(SK, 0, W1, yb, random.Random(9), 8, 22)
    SK.blit(tower(96), 70, yb - 96)
    SK.blit(tower(66), 228, yb - 66)
    SK.blit(dome_church(40, 50), 300, yb - 50)
    SK.blit(tower(78), 410, yb - 78)
    SK.blit(dome_church(36, 46), 18, yb - 46)
    SK.recolor(grader(key=sec.KEY, air=(sec.AIR[0], sec.AIR[1], 0.70, 0.3)))
    SK.clear(0, yb, W1, VIEW_H)
    sec.add('skyline', SK, speed)
    return SK


# the far bank's street furniture at the scale rule (13 px/m x s 0.30 = 3.9 px/m). far_bank of sets.py draws its own
# (about 6 px/m); these stand in for it while far_d runs (restored after).
def car_far_d(rng, c=None):
    """A parked car 4.3 x 1.5 m (17 x 6 px; a van 20 px)."""
    C = R[c or rng.choice(['red', 'blue', 'white', 'black', 'iron', 'green', 'yellow', 'white'])]
    G = R['glass']; K = R['black']
    van = rng.random() < 0.2
    w = 20 if van else rng.randint(16, 18)
    L = Layer(w, 7)
    if van:
        L.rect(0, 0, w - 4, 5, C[4]); L.rect(w - 4, 2, 4, 3, C[4]); L.rect(w - 5, 1, 3, 2, G[2]); L.hl(0, 0, w - 4, C[6])
        L.hl(0, 5, w, C[2]); L.vl(0, 0, 5, C[5]); L.px(w - 1, 3, R['yellow'][6])
    else:
        L.rect(0, 3, w, 3, C[4]); L.rect(3, 1, w - 7, 2, C[4]); L.hl(4, 1, w - 9, C[6]); L.hl(0, 3, w, C[5]); L.hl(0, 5, w, C[2])
        L.rect(4, 1.5, (w - 8) / 2, 1.5, G[2]); L.rect(4.5 + (w - 8) / 2, 1.5, (w - 8) / 2 - 0.5, 1.5, G[1])
        L.px(0, 4, R['red'][5]); L.px(w - 1, 4, R['yellow'][6])
    for wx in (2.5, w - 4.5):
        L.ellipse(wx + 1, 5.6, 1.4, 1.2, K[1]); L.px(wx + 1, 5.5, K[3])
    L.hl(1, 6.5, w - 2, K[0], t=TH)
    return L


def bike_far_d(rng, c=None):
    """A bike 1.8 m long (7 x 4 px) in the 12 x 8 box of sets.bike_far (bottom left), so far_bank places it."""
    I = R['iron']; C = R[c or rng.choice(['black', 'red', 'blue', 'green', 'iron', 'white'])]
    L = Layer(12, 8)
    t = 1 if U == 1 else 0.5
    for cx in (1.5, 5.5):
        L.ring(cx, 6.4, 1.5, I[1], 0.7 if U == 1 else 1.0)
    L.line(1.5, 6.4, 3, 5, C[3], t); L.line(3, 5, 5, 5, C[3], t); L.line(5, 5, 5.5, 6.4, C[3], t)
    L.px(2.5, 4.4, I[0]); L.px(5, 4.2, I[1])
    return L


def lamp_far_d(h=26, lit=False):
    """A quay lamp 4.6 m tall (18 px) at the foot of sets.lamp_far's box (h), so far_bank places it."""
    I = R['iron']
    L = Layer(5, h)
    y0 = h - FAR_LAMP
    L.vl(2, y0 + 4, FAR_LAMP - 4, I[2]); L.hl(1, h - 1, 3, I[1])
    L.rect(1, y0 + 1, 3, 3, I[1]); L.px(2, y0, I[2]); L.hl(0.5, y0 + 1, 4, I[2])
    L.rect(1.5, y0 + 1.5, 2, 2, EM[0] if lit else R['glass'][5])
    return L


FAR_LAMP = 18
FAR = dict(sc=0.60, hmin=56, hmax=68, wmin=18, wmax=28)          # the far bank (s 0.30): storey 12, 3-4 upper storeys
FAR_TREE = dict(cw=(40, 50), ch=(36, 44), th=(18, 24), step=(96, 150), x0=60)   # 14-18 m: 54-68 px


def storey_of(sc, hb, kind):
    """The storey height that parts.house paints for a body of hb at the scale sc (its own sums)."""
    gf = q_(27 * sc)
    avail = hb - gf - (3 if kind in ('neck', 'bell') else 2)
    nf = max(1, q_(avail / (20.0 * sc)))
    return avail / nf


def far_d(sec, rng, YH, YQ, YW, speed):
    """The far bank of the Amstel: houses at the scale rule (sc 0.60, storey 12), the quay street with its cars, bikes
       and lamps, trees, boats; some rooms lit."""
    import sets as _sets
    WF = sec.lw(speed)
    F = Layer(WF, VIEW_H)
    keep = (_sets.car_far, _sets.bike_far, _sets.lamp_far)
    _sets.car_far, _sets.bike_far, _sets.lamp_far = car_far_d, bike_far_d, lamp_far_d
    try:
        fb = far_bank(F, rng, YH, YQ, YW, house=dict(FAR, shops=0), trees=dict(FAR_TREE), AIR=sec.AIR, sun_shade=False,
                      cars=0.3, lamp_step=64, lit=True, bikes=0.2,
                      boats=[('sloop', 40, (22, 'black')), ('house', 110, (64, 'white')), ('sloop', 250, (24, 'red')),
                             ('barge', 395, (96,)), ('house', 520, (70, 'green')), ('sloop', 610, (22, 'blue'))])
    finally:
        _sets.car_far, _sets.bike_far, _sets.lamp_far = keep
    fb['lamps'] = [(x, y + (27 - FAR_LAMP) - 0) for (x, y) in fb['lamps']]   # the lit head of the smaller lamp
    sts = [storey_of(FAR['sc'], i['h'] - i['gh'], i['kind']) for i in fb['infos']]
    sec.notes['storey_far'] = (min(sts), sum(sts) / len(sts), max(sts))
    sec.notes['far_tree'] = [t.h for (_, _, t) in fb['trees']]
    F.recolor(grader(key=sec.KEY, air=(sec.AIR[0], sec.AIR[1], 0.34, 0.1)), keep=EM)
    light_windows(F, fb['win'], 0.24, rng, warm=EM)
    light_windows(F, fb['boatwin'], 0.5, rng, warm=EM)
    for (x, y) in fb['lamps']:
        F.px(x, y, EM[0])
    F.clear(0, YW + 1, F.w, F.h)
    sec.add('far', F, speed)
    return F, fb


def water_d(sec, srcs, WF, YW, speed, lights=None):
    """canal_water of level.py with the lamp streaks of the far bank (copied: level.py has no lights argument)."""
    rows = BACKY - YW
    src = flatten(srcs, WF, YW + 1)
    s1 = s_d(GY - BACKY + 0.0)
    wat = water(src, YW, rows, WF, sec.lw(s1), sec.H['water'][0], sec.H['water'][1], (255, 214, 150), seed=25, k=2.4, ncol=28,
                mix0=0.30, mix1=0.62, wob=(0.5, 2.4), lights=lights)
    sec.add('water', None, speed, y=YW, kind='rows', frames=wat, s0=speed, s1=s1)
    return wat


def glitter_d(sec, sunx, YW):
    """The path of light under the sun on the river. It stays under the sun (speed 0)."""
    rows = BACKY - YW
    gl = []
    for f in range(3):
        G = Layer(VIEW_W, rows)
        xx, yy = grid(0, 0, VIEW_W, rows)
        r = np.floor(yy * DET) / DET / (rows - 1)
        hw = 6 + r * 26
        d = np.abs(xx - sunx) / hw
        p = hash01((xx + f * 3) / (2 + np.floor(r * 4)), yy * DET, 77 + f)
        on = (d < 1) & (p > 0.30 + d * 0.52 + 0.08 * (np.floor(yy * DET) % 2))
        col = np.where(((d < 0.45) & (p > 0.8))[..., None], np.array((255, 250, 206)),
                       np.where((d < 0.75)[..., None], np.array((255, 226, 140)), np.array((250, 170, 82))))
        G.put(0, 0, col.astype(np.uint8), on)
        gl.append(G)
    sec.add('glitter', None, 0, y=YW, kind='frames', frames=gl)


# ---------------------------------------------------------------- the planes: grading with lights kept, light hooks
def hook(sec, depth, fn, front=False):
    """A light pass on the plane of this depth, run after its grade (a glow, a lamp blitted again)."""
    k = round(depth * 2) / 2 + 0.0
    sec.__dict__.setdefault('hooks', {}).setdefault((k, bool(front)), []).append(fn)


def flush_d(sec, air=None):
    """Sec.flush with the emitters kept out of the grade (keep=EM), a little air on the back planes (air: depth ->
       amount), then the light hooks of each plane."""
    hooks = sec.__dict__.get('hooks', {})
    air = air or {}
    for key in sorted(sec.planes, key=lambda kf: (-kf[0], kf[1])):
        k, front = key
        Lp = sec.planes[key]
        am = air.get(k, 0.0)
        Lp.recolor(grader(key=sec.KEY, air=(sec.AIR[0], sec.AIR[1], am, 0.1) if am else None), keep=EM)
        Lp.recolor(curve(*sec.H['curve']), keep=EM)
        for fn in hooks.get(key, []):
            fn(Lp)
        sec.add('d%g%s' % (k, 'f' if front else ''), Lp, s_d(k), over=(k < 0 or front), depth=k, front=front)
    sec.planes = {}


def graded(sec, part):
    part.recolor(grader(key=sec.KEY), keep=EM); part.recolor(curve(*sec.H['curve']), keep=EM)
    return part


def origin(sec, part, x, depth, ax=None, base=None):
    """The top-left of a part put with sec.put, in the coordinates of its plane."""
    k = round(depth * 2) / 2 + 0.0
    sp = s_d(k)
    ax = part.w / 2 if ax is None else ax
    yb = GY - k if base is None else (GY - k) - (GY - base) * sp
    return sec.at(x, sp) - ax, yb - part.h


# ---------------------------------------------------------------- the house fronts of the market
HOUSES = [('cornice', 'brick_brown', None), ('step', 'brick_red', None), ('bell', 'brick_ochre', None), ('neck', 'brick_purple', None),
          ('cornice', 'brick_red', ('KOFFIE', 'red')), ('spout', 'brick_brown', None), ('bell', 'brick_rose', None),
          ('step', 'brick_black', ('BOEKEN', 'blue')), ('step', 'brick_brown', None), ('neck', 'brick_red', None),
          ('cornice', 'brick_ochre', None), ('neck', 'brick_brown', ('BLOEMEN', 'green')), ('spout', 'brick_purple', None),
          ('bell', 'brick_red', None), ('step', 'brick_rose', None), ('cornice', 'brick_brown', ('KAAS', 'yellow'))]


def brickfill_soft(L, x, y, w, h, B, seed, mask=None, cw=4, chh=2, lo=1, hi=5, mid=3, streaks=False):
    """parts.brickfill (copied) with smaller, rarer stains: at the size of the market's fronts and under the sunset
       key the stains of the original read as camouflage. Same bricks, joints and streaks."""
    if w <= 0 or h <= 0:
        return
    xx, yy = grid(x, y, w, h)
    if xx.size == 0:
        return
    n1 = fbm((xx + seed * 31) / 15.0, yy / 9.0, seed, 3)          # (scale pass) wide, rare patches: the walls are big now
    idx = np.full(xx.shape, mid) + (n1 > 0.72).astype(int) - (n1 < 0.29).astype(int)
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


def house_front(rng, w, hb, spec, seed, sc=1.0):
    """One market house at the scale sc (parts.house with the soft brick), more detail per storey, its rooms lit."""
    import parts as _parts
    kind, brick, shop = spec
    keep_bf = _parts.brickfill
    _parts.brickfill = brickfill_soft                             # house() of parts.py with the soft brick (restored below)
    trim = 'plaster' if rng.random() < 0.8 else 'stone'
    try:
        H, info = house(rng, w, hb, kind, brick, trim=trim,
                        doorc=rng.choice(['green', 'green', 'black', 'red', 'blue']), sc=sc, shop=shop, seed=seed)
    finally:
        _parts.brickfill = keep_bf
    info['storey'] = storey_of(sc, hb, kind)
    storey_detail(H, info, rng, sc, brick, trim, kind, seed)
    lit = light_windows(H, [b for b in info['win'] if b not in info.get('nolight', [])], 0.16, rng, warm=EM)
    if info.get('shop'):                                          # the shop is open: its window is lit, the goods dark in it
        m, sy, sw, shh = info['shop']
        gx, gy, gw, gh = m + 1, sy + 3, sw - 2, shh - 5
        H.rect(gx, gy, gw, gh, EM[1]); H.rect(gx, gy, gw, max(1, gh // 3), EM[0]); H.rect(gx, gy + gh - 2, gw, 2, EM[2])
        for xx in range(int(gx) + 1, int(gx + gw) - 1, 3):
            H.rect(xx, gy + gh - 4, 2, 2, R[rng.choice(['wood', 'red', 'yellow', 'green'])][2])
        H.vl(m + sw // 2, sy + 1, shh - 3, R['plaster'][5])
    return H, info


def storey_detail(H, info, rng, sc, brick, trim, kind, seed):
    """More detail per storey on the big fronts (not the small detail stretched): a header arch with a keystone over
       each window, a stone sill course on some fronts, open shutters where the piers are wide, flower boxes, a
       Juliet rail on the first floor of some."""
    B = R[brick]; T = R[trim]; I = R['iron']
    ww = max(4, q_(7 * sc))
    gf = q_(27 * sc)
    yg = H.h - gf                                                  # the top of the ground floor
    ups = [(gx - 1, gy - 1, gw + 2, gh + 2) for (gx, gy, gw, gh) in info['win'] if gw == ww - 2 and gy + gh < yg - 2]
    rows = sorted(set(y for (_, y, _, _) in ups))
    course = kind == 'cornice' or rng.random() < 0.35
    shut = rng.random() < 0.45
    SH = R[rng.choice(['green', 'green', 'black', 'red', 'blue'])]
    juliet = rng.random() < 0.3
    for (x, y, w, h) in ups:
        # the header: a flat arch of upright bricks, a stone keystone
        H.rect(x - 1, y - 3, w + 2, 2, B[2]); H.hl(x - 1, y - 3, w + 2, B[4], t=TH)
        for jx in range(int(x), int(x + w + 1), 2):
            H.vl(jx, y - 3, 2, B[1], t=TH)
        H.rect(x + w / 2 - 1, y - 4, 2, 3.5, T[5]); H.vl(x + w / 2 - 1, y - 4, 3.5, T[6], t=TH); H.vl(x + w / 2 + 0.5, y - 4, 3.5, T[3], t=TH)
        # the stone sill course under the sills
        if course:
            H.hl(1, y + h + 2, H.w - 3, T[4]); H.hl(1, y + h + 2, H.w - 3, T[6], t=TH)
        # shutters, open against the wall, where the pier takes them
        if shut:
            free_l = min([x - (ox + ow) for (ox, oy, ow, oh) in ups if oy == y and ox + ow <= x] + [x - 1])
            free_r = min([ox - (x + w) for (ox, oy, ow, oh) in ups if oy == y and ox >= x + w] + [H.w - 2 - (x + w)])
            sw = min(5, (free_l - 1) // 2 if free_l < x - 1 else free_l - 1, (free_r - 1) // 2 if free_r < H.w - 2 - (x + w) else free_r - 1)
            if sw >= 4:
                for sx in (x - sw - 0.5, x + w + 0.5):
                    H.rect(sx, y, sw, h, SH[3]); H.vl(sx, y, h, SH[5], t=TH); H.vl(sx + sw - TH, y, h, SH[1], t=TH)
                    H.rect(sx + 1, y + 2, sw - 2, h / 2 - 3, SH[2]); H.rect(sx + 1, y + h / 2 + 1, sw - 2, h / 2 - 3, SH[2])
                    H.hl(sx + 1, y + 2, sw - 2, SH[1], t=TH); H.hl(sx + 1, y + h / 2 + 1, sw - 2, SH[1], t=TH)
                    H.px(sx + (0 if sx < x else sw - 1), y + 3, I[1]); H.px(sx + (0 if sx < x else sw - 1), y + h - 4, I[1])
        # a flower box now and then
        if rng.random() < 0.16 and y != rows[-1:][0]:
            fc = R[rng.choice(['red', 'red', 'rose', 'yellow', 'white'])]
            H.rect(x, y + h - 2.5, w, 2.5, R['wood'][2]); H.hl(x, y + h - 2.5, w, R['wood'][4], t=TH)
            for fx in range(int(x), int(x + w), 2):
                H.px(fx + (fx * 7 + seed) % 2, y + h - 4, fc[4]); H.px(fx, y + h - 3.5, R['leaf'][3]); H.px(fx + 1, y + h - 5, fc[6])
        # a Juliet rail on the first floor
        if juliet and rows and y == rows[-1]:
            H.hl(x - 1, y + h - 7, w + 2, I[1]); H.hl(x - 1, y + h - 7 + TH, w + 2, I[3], t=TH)
            for bx in range(int(x), int(x + w), 2):
                H.vl(bx + 0.5, y + h - 6, 5, I[1], t=TH)
            for ax in (x - 1, x + w):
                H.vl(ax, y + h - 7, 6, I[2])


def market_row(sec, rng, depth, u0, u1, hb=(150, 196), gaps=()):
    """The canal houses behind the market as one row at the scale rule: storey 40 s, 3 bays 60-92 s wide, 3-4 upper
       storeys and the ground floor. u0, u1, gaps (u pairs): world x. Returns the infos in the plane's coordinates."""
    Lp, k = sec.plane(depth)
    sp = s_d(k); sc = 2 * sp
    wmin, wmax = q_(60 * sp), q_(92 * sp)
    cuts = [u0] + [g for gp in gaps for g in gp] + [u1]
    segs = [(int(math.floor(sec.at(cuts[j], sp))), int(math.ceil(sec.at(cuts[j + 1], sp)))) for j in range(0, len(cuts), 2)]
    yb = GY - k
    out = []
    i = 0
    for (a, b) in segs:
        x = a
        while x < b - 1:
            w = rng.randint(wmin, wmax)
            rest = b - (x + w)
            if rest < wmin * 0.8:
                w = b - x if b - x <= wmax * 1.12 else (b - x) // 2
            spec = HOUSES[i % len(HOUSES)]
            H, info = house_front(rng, w, rng.randint(*hb), spec, seed=300 + i * 13, sc=sc)
            Lp.blit(H, x, yb - H.h)
            info['x'], info['y'] = x, yb - H.h
            sec.shades.append((192 + (x + w / 2 - 192) / sp, k, w / 2, min(H.h, 60)))
            out.append(info)
            x += w
            i += 1
    return out, k


# ---------------------------------------------------------------- market stalls
AWN =(('red', 'white'), ('green', 'white'), ('blue', 'yellow'))


def awning(L, x0, y0, w, h, ca, cb, sw=6, hem=3):
    """A striped canvas awning seen from the front and a little above: the lit slope, a scalloped hem, folds."""
    Aa, Ab = A(ca), A(cb)
    xx, yy = grid(x0, y0, w, h + hem)
    k = np.floor((xx - x0) / sw)
    on_a = (k % 2) == 0
    j = (yy - y0) / max(h, 1)
    tone = np.where(j < 0.22, 5, np.where(j < 0.7, 4, 3))
    fx = (xx - x0) / sw - k
    tone = tone - ((fx > 0.78) & (j > 0.15)).astype(int)                 # the fold at each seam
    tone = tone + ((fx < 0.18) & (j < 0.5)).astype(int)
    hemr = sw / 2.0
    cxs = x0 + (k + 0.5) * sw
    in_hem = (yy < y0 + h) | (((xx - cxs) / hemr) ** 2 + ((yy - (y0 + h)) / hem) ** 2 <= 1)
    tone = np.where(yy >= y0 + h, 2 + (((xx - cxs) / hemr) ** 2 + ((yy - (y0 + h)) / hem) ** 2 < 0.35), tone)
    col = np.where(on_a[..., None], Aa[np.clip(tone, 0, 6)], Ab[np.clip(tone, 0, 6)])
    L.put(x0, y0, col, in_hem)
    L.hl(x0, y0, w, R['white'][6], t=TH)


def stall(rng, frame=0, bulb=False, seed=1):
    """A Waterlooplein flea-market stall, 58 x 46: posts, a striped awning, goods, a table with a cloth.
       Returns (Layer, bulbs) with the bulb positions in the part."""
    ca, cb = AWN[frame % 3]
    I = R['iron']; W = R['wood']; K = R['black']; C = R['canvas']
    L = Layer(58, 46)
    bulbs = []
    # the inside under the awning, in its shade: a back cloth
    xx, yy = grid(5, 12, 48, 17)
    tn = 1 + (fbm(xx / 3.0, yy / 6.0, seed, 2) > 0.55).astype(int)
    L.put(5, 12, A('canvas' if frame != 1 else 'green')[tn] if frame != 1 else A('green')[tn], np.ones(xx.shape, bool))
    for x in (3, 53):
        L.rect(x, 8, 2, 38, I[2]); L.vl(x, 8, 38, I[4], t=TH); L.hl(x - 1, 44, 4, I[1])
    # goods
    if frame == 0:                                              # clothes on a rail
        L.hl(5, 15, 48, I[4], t=TH); L.hl(5, 15.5, 48, I[1], t=TH)
        cols = ['blue', 'rose', 'yellow', 'green', 'red', 'white', 'blue', 'wood']
        for i, x in enumerate(range(7, 50, 6)):
            Cc = R[cols[(i + seed) % len(cols)]]
            L.vl(x + 2, 15, 2, I[3], t=TH)
            L.rect(x, 17, 5, 10, Cc[4]); L.vl(x, 17, 10, Cc[5]); L.vl(x + 4, 17, 10, Cc[2]); L.hl(x, 17, 5, Cc[5])
            L.vl(x + 2, 19, 7, Cc[3], t=TH)
            if i % 2:
                L.rect(x + 1, 17, 3, 1, Cc[2])
    elif frame == 1:                                            # records in crates, sleeves on a line
        L.hl(5, 14, 48, I[3], t=TH)
        for i, x in enumerate(range(8, 50, 8)):
            Cc = R[['red', 'yellow', 'blue', 'white', 'rose', 'green'][(i + seed) % 6]]
            L.rect(x, 15, 6, 6, Cc[4]); L.hl(x, 15, 6, Cc[6]); L.vl(x + 5, 15, 6, Cc[2])
            L.ellipse(x + 3, 18, 1.6, 1.6, K[1]); L.px(x + 3, 18, Cc[6])
        for bx in (6, 20, 34):
            L.rect(bx, 22, 13, 6, W[3]); L.hl(bx, 22, 13, W[5]); L.vl(bx + 12, 22, 6, W[1])
            for sx in range(bx + 1, bx + 12, 2):
                Cc = R[rng.choice(['red', 'yellow', 'blue', 'white', 'black', 'green'])]
                L.rect(sx, 20 + rng.random() * 1.5, 1.5, 3, Cc[4]); L.px(sx, 20, Cc[6])
    else:                                                       # lamps, vases, jugs
        for i, x in enumerate(range(9, 50, 9)):
            Cc = R[['yellow', 'blue', 'rose', 'green', 'white'][(i + seed) % 5]]
            hh = 6 + (i * 7 + seed) % 4
            L.ellipse(x, 27 - hh / 2, 3.2, hh / 2, Cc[3]); L.ellipse(x - 0.8, 27 - hh / 2 - 0.6, 2.0, hh / 2 - 1, Cc[4])
            L.px(x - 1.5, 27 - hh + 1.5, Cc[6]); L.rect(x - 1, 27 - hh - 1, 2, 1.5, Cc[2])
        L.rect(30, 16, 1, 12, R['yellow'][3])                   # a standard lamp with its shade
        L.poly([(27, 18), (34, 18), (32.5, 14), (28.5, 14)], R['yellow'][5]); L.hl(27, 18, 7, R['yellow'][2], t=TH)
    # the table: a board with a lit edge and a cloth to the ground
    L.rect(2, 28, 54, 3, W[4]); L.hl(2, 28, 54, W[6]); L.hl(2, 30, 54, W[1])
    clc = ['canvas', 'blue', 'red'][frame % 3]
    xx, yy = grid(4, 31, 50, 13)
    f = np.sin((xx - 4) * 1.15 + fbm(xx / 7.0, yy * 0, seed + 3, 2) * 4)
    tn = 3 + (f > 0.45).astype(int) - (f < -0.55).astype(int) - (yy > 41).astype(int)
    L.put(4, 31, A(clc)[np.clip(tn, 0, 6)], np.ones(xx.shape, bool))
    L.hl(4, 31, 50, R[clc][1], t=TH)
    # the awning over all, its shade on the goods
    awning(L, 1, 3, 56, 8, ca, cb)
    sh = L.view(5, 14, 48, 2)
    m = sh[..., 3] > 0
    sh[..., :3][m] = snap5(sh[..., :3][m].astype(float) * 0.72)
    if bulb:
        L.vl(29, 13, 1.5, I[1], t=TH); L.rect(28.5, 14.5, 1.5, 1.5, EM[0]); L.px(28.5, 15.5, EM[1])
        bulbs.append((29.2, 15.2))
    return L, bulbs


def stall_small(rng, seed=3):
    """The breakable flea-market stall (54 x 36, intact): a red-white awning, records, a radio, a lamp, books."""
    I = R['iron']; W = R['wood']; K = R['black']; Y = R['yellow']; T = R['white']
    L = Layer(54, 36)
    xx, yy = grid(4, 8, 46, 16)
    L.put(4, 8, A('canvas')[1 + (fbm(xx / 3.0, yy / 5.0, seed, 2) > 0.55).astype(int)], np.ones(xx.shape, bool))
    for x in (2, 51):
        L.rect(x, 6, 2, 30, I[2]); L.vl(x, 6, 30, I[4], t=TH); L.hl(x - 1, 35, 4, I[1])
    for i, (x, lc) in enumerate(((10, 'red'), (16, 'yellow'))):                      # records on stands
        L.ellipse(x, 20, 3.4, 3.4, K[1]); L.ring(x, 20, 3.4, K[3], 2.9); L.ellipse(x, 20, 1.1, 1.1, R[lc][5]); L.px(x - 1.5, 18, K[4])
        L.vl(x, 23, 1, W[1], t=TH)
    L.rect(21, 16, 9, 8, W[3]); L.hl(21, 16, 9, W[5]); L.vl(21, 16, 8, W[5]); L.vl(29, 16, 8, W[1])    # the radio
    L.ellipse(24.5, 20, 2.3, 2.3, T[4]); L.ellipse(24.2, 19.6, 1.4, 1.4, T[5]); L.rect(27, 17, 1.5, 5, T[3]); L.px(27.5, 22.5, Y[5])
    L.line(22.5, 16, 20.5, 12.5, I[4], t=TH)
    L.rect(35.5, 13, 1, 10, Y[3]); L.rect(33.5, 22.5, 4.5, 1, Y[4])                                       # the lamp
    L.poly([(32.5, 14.5), (39.5, 14.5), (37.8, 10), (34.4, 10)], Y[5]); L.hl(32.5, 14.5, 7, Y[2], t=TH); L.px(34.6, 10.5, Y[6])
    for i, c in enumerate(('green', 'red', 'yellow', 'blue')):                                                # books
        Cc = R[c]; bh = 7 - (i & 1)
        L.rect(41 + i * 2, 24 - bh, 2, bh, Cc[3]); L.vl(41 + i * 2, 24 - bh, bh, Cc[5], t=TH); L.hl(41 + i * 2, 24 - bh + 2, 2, Y[5], t=TH)
    L.rect(3, 24, 48, 3, W[4]); L.hl(3, 24, 48, W[6]); L.hl(3, 26, 48, W[1])
    xx, yy = grid(5, 27, 44, 8)
    f = np.sin((xx - 5) * 1.1 + fbm(xx / 6.0, yy * 0, seed + 3, 2) * 4)
    tn = 3 + (f > 0.45).astype(int) - (f < -0.55).astype(int) - (yy > 33).astype(int)
    L.put(5, 27, A('blue')[np.clip(tn, 0, 6)], np.ones(xx.shape, bool))
    awning(L, 0, 0, 54, 6, 'red', 'white', sw=4, hem=2.5)
    sh = L.view(4, 8, 46, 2)
    m = sh[..., 3] > 0
    sh[..., :3][m] = snap5(sh[..., :3][m].astype(float) * 0.72)
    return L


def bike_s(rng, c=None):
    """A small town bicycle, 28 x 20 (the bikes in the breakable rack)."""
    I = R['iron']; C = R[c or rng.choice(['black', 'red', 'blue', 'green'])]; K = R['black']
    L = Layer(28, 20)
    for cx in (6, 22):
        L.ring(cx, 14, 5.4, K[1], 4.4); L.ring(cx, 14, 4.4, I[4], 3.9)
        for a in range(0, 360, 45 if U == 1 else 30):
            L.line(cx, 14, cx + math.cos(math.radians(a + 9)) * 3.8, 14 + math.sin(math.radians(a + 9)) * 3.8, I[3], t=D1)
        L.px(cx, 14, I[5])
    L.line(6, 14, 11, 7, C[4]); L.line(11, 6, 13, 14, C[3]); L.line(13, 14, 20, 6, C[4]); L.line(11, 7, 20, 6, C[5])
    L.line(6, 14, 13, 14, C[2]); L.line(20, 4, 22, 14, C[3])
    L.rect(8, 4, 5, 1.5, K[1]); L.hl(9, 4, 3, K[3], t=TH); L.line(20, 4, 18, 2, I[3]); L.hl(16, 2, 3, K[1])
    L.rect(8, 12, 6, 3, K[1]); L.px(23, 7, R['yellow'][6])
    for a in range(200, 345, 9):
        L.px(6 + math.cos(math.radians(a)) * 6.2, 14 + math.sin(math.radians(a)) * 6.2, C[2])
        L.px(22 + math.cos(math.radians(a - 10)) * 6.2, 14 + math.sin(math.radians(a - 10)) * 6.2, C[2])
    return L


def rack_small(rng):
    """The breakable bike rack (50 x 22, intact): a galvanised frame with three bikes in it."""
    I = R['iron']
    L = Layer(50, 22)
    for i, c in enumerate(('black', 'red', 'green')):
        b = bike_s(rng, c)
        L.blit(b if i % 2 == 0 else b.flip(), i * 11, 22 - b.h)
    L.rect(0, 12, 50, 1.5, I[4]); L.hl(0, 12, 50, I[6], t=TH); L.hl(0, 13.5, 50, I[1], t=TH)
    for x in (1, 24, 47):
        L.rect(x, 12, 1.5, 10, I[3]); L.vl(x, 12, 10, I[5], t=TH)
    L.hl(0, 21, 50, R['black'][0], t=TH)
    return L


# ---------------------------------------------------------------- the Stopera
SPLIT = 230                  # the theatre (left) / the city-hall wing (right), in sprite px
DOOR = 294                   # the centre of the glass doors (the mayor's x), sprite px
BASE = 300                   # the foot (the bottom edge of the part)
S12 = (116 - 12) / 116       # the speed of the Stopera's plane (depth 12)
FLR = 36                     # floor to floor on that plane: 40 px x 0.90
WING_H = 291                 # the city-hall wing: 25 m x 13 px/m x 0.90 (its top leaves the screen)
GF = 58                      # the wing's ground floor (to its first white band), above the foot
Z0 = 48                      # the theatre's ground floor (the foyer doors), above the foot
NB = 4                       # the theatre's marble-and-glass bands over it
DRUM = Z0 + NB * FLR + 4     # the drum at its highest (196 px, 16.8 m); it dips toward both ends as it turns away
DIP = 180
HZ = BASE - 104              # the horizon (screen y 60) in sprite rows: the foot stands on screen row 164


def theatre_top(x):
    t = np.clip((np.asarray(x, float) - 1) / (SPLIT - 2), 0, 1)
    return BASE - DRUM + (t - 0.45) ** 2 * DIP


def stopera(seed=5, W=404):
    """The Stopera, an own impression: the curved music theatre (white marble ledges and a glass curtain wall, its
       foyer lit at sunset, the fly tower behind) and the red-brick city-hall wing with white bands, its windows and
       the big glass doors under a canopy (centre DOOR). At the scale rule (2026-11-11): the wing 25 m (WING_H, its
       top leaves the screen), storeys of FLR; the drum four floors on a glass ground floor, dipping toward its ends.
       The game's box is 386 px wide; the wing runs on to W so it closes the right edge of the locked arena. Returns (Layer, info): info['lamps'] wall lanterns, info['doors'] the box."""
    rng = random.Random(seed)
    L = Layer(W, BASE)
    M = A('marble'); Gd = A('dusk'); B = R['brick_red']; S = R['stone']; I = R['iron']; Mr = R['marble']
    info = dict(lamps=[], doors=(DOOR - 40, BASE - 100, 80, 100))
    # ---- the city-hall wing (behind the theatre's end): 25 m, a ground floor and seven storeys of 36 px
    hx0 = SPLIT - 2
    top = BASE - WING_H
    brickfill(L, hx0, top, W - hx0, BASE - top, B, seed, streaks=True)
    bands = [GF + FLR * k for k in range(8) if GF + FLR * k + 4 < WING_H - 8]
    for hb in bands:                                                       # the white bands at each floor
        yb = BASE - hb - 4
        L.rect(hx0, yb, W - hx0, 4, S[5]); L.hl(hx0, yb, W - hx0, S[6]); L.hl(hx0, yb + 3, W - hx0, S[3])
        L.hl(hx0, yb + 4, W - hx0, B[1], t=TH)
    L.rect(hx0, top - 3, W - hx0, 3, S[4]); L.hl(hx0, top - 3, W - hx0, S[6])          # the roof's coping
    for (rx, rw, rh) in ((262, 22, 7), (318, 14, 5), (352, 30, 9), (390, 12, 6)):   # plant rooms on the roof
        L.rect(rx, top - 3 - rh, rw, rh, S[3]); L.hl(rx, top - 3 - rh, rw, S[5]); L.vl(rx + rw - 1, top - 3 - rh, rh, S[1])
        for gx in range(rx + 2, rx + rw - 2, 3):
            L.vl(gx, top - rh, rh - 4, S[2], t=TH)
    # windows, one row per storey: white frames with a transom, dark glass with the sky in it, blinds in some
    # offices, a few still lit; a brick soldier course over each, the sill and its shade under it
    wins = []
    for hb in bands[:-1]:
        y = BASE - hb - 32
        for x in range(hx0 + 9, W - 10, 20):
            if hb < 130 and DOOR - 58 < x + 13 and x < DOOR + 58:
                continue
            L.rect(x, y, 13, 24, S[5]); L.hl(x, y, 13, S[6]); L.vl(x, y, 24, S[6]); L.vl(x + 12, y, 24, S[3])
            L.rect(x + 1, y + 1, 11, 22, R['glass'][1]); L.hl(x + 1, y + 1, 11, R['glass'][0])
            r = rng.random()
            if r < 0.20:
                L.rect(x + 1, y + 2, 11, 21, EM[1]); L.rect(x + 1, y + 2, 11, 5, EM[0]); L.rect(x + 1, y + 19, 11, 4, EM[2])
            elif r < 0.38:                                                 # venetian blinds, half down
                bl = 8 + int(rng.random() * 10)
                for by in range(y + 2, y + 2 + bl, 2):
                    L.hl(x + 1, by, 11, S[4]); L.hl(x + 1, by + 1, 11, S[2], t=TH)
                L.poly([(x + 7, y + 3 + bl), (x + 12, y + 3 + bl), (x + 8, y + 22), (x + 3, y + 22)], R['dusk'][3])
            else:
                L.poly([(x + 6, y + 2), (x + 12, y + 2), (x + 5, y + 22), (x + 1, y + 22)], R['dusk'][3])
                L.poly([(x + 9, y + 2), (x + 11, y + 2), (x + 3, y + 22), (x + 1.5, y + 22)], R['dusk'][4])
            L.vl(x + 6, y + 1, 22, S[4], t=TH); L.hl(x + 1, y + 8, 11, S[5], t=TH); L.hl(x + 1, y + 8 + TH, 11, S[2], t=TH)
            L.hl(x - 1, y + 24, 15, S[6]); L.hl(x - 1, y + 25, 15, B[1], t=TH)
            L.rect(x - 1, y - 3, 15, 2, B[2])
            for jx in range(x - 1, x + 14, 2):
                L.vl(jx, y - 3, 2, B[1], t=TH)
            wins.append((x, y))
    # the ground floor of the wing: tall dark windows right of the doors
    for x in (352, 376):
        L.rect(x, BASE - 50, 16, 42, S[5]); L.rect(x + 1, BASE - 49, 14, 41, R['glass'][1]); L.hl(x + 1, BASE - 49, 14, R['glass'][0])
        L.poly([(x + 8, BASE - 48), (x + 15, BASE - 48), (x + 7, BASE - 9), (x + 1, BASE - 9)], R['dusk'][2])
        L.vl(x + 7.5, BASE - 49, 41, S[4], t=TH); L.hl(x + 1, BASE - 36, 14, S[4], t=TH)
        L.rect(x - 1, BASE - 53, 18, 2, B[2])
    L.rect(hx0, BASE - 6, W - hx0, 6, S[3]); L.hl(hx0, BASE - 6, W - hx0, S[5]); L.hl(hx0, BASE - 1, W - hx0, S[1])   # plinth
    # ---- the glass doors under the canopy: a two-storey glass lobby in a marble bay
    dx = DOOR
    L.rect(dx - 52, BASE - 130, 104, 24, Mr[4]); L.hl(dx - 52, BASE - 130, 104, Mr[6]); L.hl(dx - 52, BASE - 107, 104, Mr[2])  # the marble fascia
    L.vl(dx - 52, BASE - 130, 24, Mr[5]); L.vl(dx + 51, BASE - 130, 24, Mr[2])
    for jy in (BASE - 126, BASE - 112):
        L.hl(dx - 51, jy, 102, Mr[3], t=TH)
    for jx_ in range(int(dx - 52 + 13), int(dx + 52), 13):
        if abs(jx_ - dx) > 30:
            L.vl(jx_, BASE - 129, 22, Mr[3], t=TH)
    for jx in (dx - 47, dx + 42):                                           # marble jambs beside the opening
        L.rect(jx, BASE - 101, 5, 101, Mr[4]); L.vl(jx, BASE - 101, 101, Mr[6], t=TH); L.vl(jx + 4, BASE - 101, 101, Mr[2], t=TH)
        for yy_ in range(int(BASE - 95), BASE, 12):
            L.hl(jx, yy_, 5, Mr[2], t=TH)
    tw = text_w('STADHUIS')
    L.rect(dx - tw / 2 - 4, BASE - 124, tw + 8, 12, I[3]); L.rect(dx - tw / 2 - 3, BASE - 123, tw + 6, 10, I[1])
    L.hl(dx - tw / 2 - 4, BASE - 124, tw + 8, I[5], t=TH)
    text(L, dx - tw // 2, BASE - 121, 'STADHUIS', Mr[6])
    L.rect(dx - 46, BASE - 106, 92, 5, Mr[5]); L.hl(dx - 46, BASE - 106, 92, Mr[6]); L.hl(dx - 46, BASE - 102, 92, Mr[2])   # canopy
    L.rect(dx - 44, BASE - 101, 88, 2, B[0])                                   # its shade on the wall
    # the opening: dark steel frame, the lit lobby behind the glass
    L.rect(dx - 41, BASE - 100, 82, 100, I[1])
    gx0, gx1, gy0 = dx - 38, dx + 38, BASE - 98
    L.rect(gx0, gy0, gx1 - gx0, BASE - gy0, EM[1])
    L.rect(gx0, gy0, gx1 - gx0, 6, EM[2])                                      # the ceiling, its light fittings
    for lx in range(gx0 + 4, gx1 - 2, 9):
        L.rect(lx, gy0 + 5, 4, 1.5, EM[0])
    for lx in range(gx0 + 5, gx1 - 2, 9):                                       # the light falls on the back wall
        L.rect(lx, gy0 + 7, 2, 16, EM[0]); L.rect(lx - 1, gy0 + 7, 4, 5, EM[0])
    WD = R['wood']
    for px_ in range(gx0 + 2, gx1 - 2, 6):                                      # wood panels of the back wall
        L.vl(px_, gy0 + 26, 34, EM[2], t=TH)
    L.rect(gx0, BASE - 38, gx1 - gx0, 2, EM[2])
    L.rect(dx - 24, BASE - 34, 48, 10, WD[2]); L.hl(dx - 24, BASE - 34, 48, WD[5]); L.hl(dx - 24, BASE - 33, 48, WD[4], t=TH)   # the desk
    L.rect(dx - 22, BASE - 31, 44, 1, WD[1])
    L.rect(gx0, BASE - 24, gx1 - gx0, 24, EM[2])                               # the lobby floor and its shine
    L.rect(gx0, BASE - 24, gx1 - gx0, 1, EM[1])
    for lx in range(gx0 + 5, gx1 - 2, 18):
        L.rect(lx, BASE - 20, 2, 14, EM[1])
    L.rect(gx0, BASE - 72, gx1 - gx0, 2, I[1])                                 # the transom over the leaves
    for i, x in enumerate(range(gx0, gx1 + 1, 19)):                            # the door leaves' frames
        L.rect(x - 1, gy0, 2, BASE - gy0, I[2]); L.vl(x - 1, gy0, BASE - gy0, I[4], t=TH)
    L.rect(dx - 1, BASE - 72, 2, 72, I[1]); L.vl(dx - 1, BASE - 72, 72, I[3], t=TH)
    for x0 in (gx0 + 2, dx + 2):                                               # push bars and handles
        L.rect(x0, BASE - 46, 34, 1.5, R['yellow'][4]); L.hl(x0, BASE - 46, 34, R['yellow'][6], t=TH)
    L.rect(dx - 4, BASE - 58, 1.5, 22, R['yellow'][5]); L.rect(dx + 2.5, BASE - 58, 1.5, 22, R['yellow'][5])
    for (a, b) in ((gx0 + 6, 0), (gx0 + 44, 1), (dx + 20, 0)):                 # glints in the glass
        L.line(a, BASE - 64 + b * 6, a + 9, BASE - 82 + b * 6, EM[0], t=TH)
        L.line(a + 3, BASE - 60 + b * 6, a + 12, BASE - 78 + b * 6, EM[0], t=TH)
    L.rect(gx1, gy0, 3, BASE - gy0, B[2]); L.vl(gx1, gy0, BASE - gy0, EM[2], t=TH)   # the reveal on the far side (lit from the lobby)
    L.rect(gx0 - 3, BASE - 100, 2, 100, I[2])
    for lx in (dx - 50, dx + 47):                                              # wall lanterns beside the doors
        L.rect(lx, BASE - 64, 3, 6, I[1]); L.rect(lx + 0.5, BASE - 63, 2, 4, EM[0]); L.hl(lx - 0.5, BASE - 65, 4, I[3])
        info['lamps'].append((lx + 1.5, BASE - 61))
    # the steps
    L.rect(dx - 56, BASE - 4, 112, 4, S[3]); L.hl(dx - 56, BASE - 4, 112, S[6]); L.hl(dx - 56, BASE - 2, 112, S[5]); L.hl(dx - 56, BASE - 3, 112, S[2], t=TH)
    L.rect(dx - 52, BASE - 6, 104, 2, S[4]); L.hl(dx - 52, BASE - 6, 104, S[6])
    # ---- the wing's left side above the theatre's roof (it turns into depth toward the vanishing point)
    hs_ = int(float(theatre_top(SPLIT))) - (top - 3) + 2
    xx, yy = grid(hx0 - 8, top - 3, 8, hs_)
    f_ = (hx0 - xx) / 8
    yb_ = HZ + (yy - HZ) / (1 - f_ * 0.17)                                  # the row on the front edge: courses slope toward the horizon
    hh_ = (BASE - yb_ - GF) % FLR
    band = (hh_ < 4) & (BASE - yb_ >= GF)
    tone = np.where(band, np.where(hh_ > 3, 4, 3), 1 + (hs(xx, yy, seed + 7) > 0.8))
    m = yy >= HZ + (top - 3 - HZ) * (1 - f_ * 0.17)
    L.put(hx0 - 8, top - 3, np.where(band[..., None], A('stone')[np.clip(tone, 0, 6)], np.array(B, np.uint8)[np.clip(tone, 0, 6)]), m)
    L.vl(hx0, top - 3, BASE - top + 3, B[0])
    # ---- the fly tower behind the drum (above the screen at this scale; kept so the drum has its roof)
    FT = BASE - DRUM - 30
    L.rect(58, 8 + FT, 94, 40, Mr[3]); L.rect(140, 8 + FT, 12, 40, Mr[2])
    for x in range(62, 150, 8):                                                # its ribs: a lit edge, a shade line
        L.vl(x, 10 + FT, 38, Mr[4], t=TH); L.vl(x + TH, 10 + FT, 38, Mr[1], t=TH)
    L.rect(57, 5 + FT, 96, 4, Mr[4]); L.hl(57, 5 + FT, 96, Mr[6]); L.hl(57, 8 + FT, 96, Mr[1])
    # ---- the curved music theatre: a lit glass ground floor, four bands of marble ledge and glass (36 px a floor)
    xx, yy = grid(0, 0, SPLIT, BASE)
    x0, Rx = 103.6, 140.0
    th = np.degrees(np.arcsin(np.clip((xx + 0.5 * D1 - x0) / Rx, -0.999, 0.999)))
    tp = theatre_top(xx + 0.5 * D1)
    inside = (xx >= 1) & (yy >= tp)
    zt = BASE - Z0
    hgt = (yy - tp) / np.maximum(zt - tp, 1) * (NB * FLR)                 # the height in the bands: 0 at the top, NB * FLR at the ground floor
    b = hgt % FLR
    # the light on the drum: it turns away to the right
    lt = np.where(th < -22, 1, np.where(th < 34, 0, np.where(th < 50, -1, -2)))
    step = Rx * np.cos(np.radians(th)) * math.radians(5)                   # px per 5 degrees
    mf = (th / 5.0) % 1.0
    mull = (mf * step) < (0.9 if U == 1 else 0.6)
    pf = (th / 10.0 + 0.5) % 1.0
    pjoint = (pf * step * 2) < (0.5 if U > 1 else 0.0)
    vein = fbm(xx / 9.0 + yy / 14.0, yy / 2.2, seed + 3, 3)
    # marble ledges: the lit nosing, the face with its veins and slab joints, the soffit in shade
    thinv = (np.abs(vein - 0.5) < (0.010 if U > 1 else 0.0)) & (hs(xx, yy, seed + 5) > 0.3)
    tm = np.where(b < 1.3, 6, np.where(b < 6.2, 5 - thinv, np.where(b < 8.6, 4, np.where(b < 10.6, 2, 1))))
    tm = np.where((b >= 1.3) & (b < 8.6) & pjoint, 3, tm)
    tm = np.where((np.abs(b - 4.4) < (0.35 if U > 1 else 0.0)), np.minimum(tm, 4), tm)    # a groove along the ledge
    tm = np.clip(tm + lt * (b >= 1.3), 0, 6)
    # glass: the shade under the ledge, a transom, the sky held in the glass, the lit foyer floors
    gb = b - 12
    k = np.floor(th / 5.0)
    band_i = np.floor(hgt / FLR)
    refl = 2 + (gb > 10).astype(int) + ((((xx * 0.55 + hgt * 1.0 + vnoise(xx / 30.0, hgt / 36.0, seed) * 18) % 44) < 6) & (th < 48)).astype(int) * 2
    refl = np.clip(refl + np.minimum(lt, 0), 0, 6)
    tg = np.where(gb < 2.0, 0, refl)
    lit = (hash01(np.floor(k / 2), band_i, seed + 11) < 0.36) & (band_i >= 1) & (th < 52)
    em0, em1, em2 = [np.array(snap5(np.array(c, float)), np.uint8) for c in EM]
    col = np.where((b < 12)[..., None], M[tm], Gd[tg])
    lcol = np.where((gb < 4.0)[..., None], em2, np.where((gb < 8.0)[..., None], em0, np.where((gb < 17.5)[..., None], em1, em2)))
    litm = lit & (b >= 12) & (gb >= 2.0)
    col = np.where(litm[..., None], lcol, col)
    ceil = litm & (gb < 4.0) & (np.abs((xx % 6) - 3) < (0.6 if U > 1 else 0.5))         # the ceiling lights of the foyer
    col = np.where(ceil[..., None], em0, col)
    rail = litm & (np.abs(gb - 17.5) < (0.5 if U > 1 else 0.6))
    bal = litm & (gb > 17.5) & (gb < 22.5) & ((xx % 2.0) < (0.5 if U > 1 else 1.0))     # the balustrade of the foyer floor
    col = np.where((rail | bal)[..., None], A('iron')[1 + rail], col)
    col = np.where(((b >= 12) & (np.abs(gb - 9.0) < (0.5 if U > 1 else 0.6)))[..., None], A('iron')[2 + lt.clip(-1, 0)], col)
    col = np.where(((b >= 12) & mull & (gb >= 2.0))[..., None], np.where(litm[..., None], A('iron')[1], M[np.clip(3 + lt, 0, 6)]), col)
    # the ground floor: stone piers, a marble lintel, the glass foyer behind (lit), the plinth
    gfz = yy >= zt
    pier = ((xx % 48) < 5)
    gy_ = yy - zt                                                          # rows below the lintel
    gref = 2 + (gy_ > 22).astype(int) + ((((xx * 0.6 + gy_ * 1.1 + vnoise(xx / 26.0, gy_ / 20.0, seed + 4) * 14) % 40) < 6) & (th < 48)).astype(int) * 2
    glass = np.where((gy_ < 9)[..., None], np.where((np.abs((xx % 6) - 3) < (0.6 if U > 1 else 0.5))[..., None], em0, em2),
                     Gd[np.clip(gref + np.minimum(lt, 0), 0, 6)])
    glass = np.where(((gy_ >= 9) & (gy_ < 10.2))[..., None], A('iron')[1], glass)          # the transom of the foyer glass
    gcol = np.where(pier[..., None], A('stone')[np.where((xx % 48) < 1.2, 5, 4)], glass)
    gcol = np.where((~pier & ((xx % 12) < (1.0 if U == 1 else 0.5)))[..., None], A('iron')[1], gcol)
    gcol = np.where((yy < zt + 5)[..., None], M[np.where(yy < zt + 1.2, 6, 4)], gcol)
    gcol = np.where((yy >= BASE - 4)[..., None], A('stone')[np.where(yy >= BASE - 1.2, 1, 3)], gcol)
    col = np.where(gfz[..., None], gcol, col)
    # the shaded end of the drum (a dark edge where it turns away)
    col = np.where(((xx > SPLIT - 2.0 - D1) | (xx < 1 + D1))[..., None], M[1], col)
    L.put(0, 0, col, inside)
    # its top edge: a marble cornice line
    for x in sub(1, SPLIT - 1):
        L.rect(x, float(theatre_top(x + 0.5 * D1)) - D1, D1, D1, Mr[5])
    # the foyer doors of the theatre (lit glass, 1.1 storeys), between the piers
    for fx in (16, 64, 112, 160):
        fy = BASE - 44
        L.rect(fx, fy, 22, 40, I[1]); L.rect(fx + 1, fy + 1, 20, 39, EM[1]); L.rect(fx + 1, fy + 1, 20, 6, EM[0])
        L.hl(fx + 1, fy + 10, 20, I[1]); L.vl(fx + 11, fy + 10, 30, I[1], t=TH)
        L.rect(fx + 1, fy + 32, 20, 7, EM[2])
        L.rect(fx + 7, fy + 22, 1.5, 6, R['yellow'][5]); L.rect(fx + 14, fy + 22, 1.5, 6, R['yellow'][5])
        info.setdefault('foyer', []).append((fx + 11, fy + 20))
    info['wins'] = wins
    return L, info


def theatre_end(w=8, seed=5):
    """The theatre's left end turning back into depth (put it just left of the Stopera): the marble ledges and the
       glass converge toward the horizon (sprite y 65 = screen y 60), the foot climbs to the floor's back rows.
       Lit: it faces the light on the left."""
    L = Layer(w, BASE)
    M = A('marble'); Gd = A('dusk')
    xx, yy = grid(0, 0, w, BASE)
    f = (w - xx) / w                                                       # 0 at the front edge, 1 at the back
    k = 1 - 0.17 * f
    yf = HZ + (yy - HZ) / k                                                # the row on the front edge
    top0 = float(theatre_top(1.0))
    inside = (yf >= top0) & (yf < BASE)
    zt = BASE - Z0
    hgt = (yf - top0) / (zt - top0) * (NB * FLR)
    b = hgt % FLR
    gb = b - 12
    tm = np.where(b < 1.3, 6, np.where(b < 6.2, 6, np.where(b < 8.6, 5, np.where(b < 10.6, 3, 2))))
    tg = np.where(gb < 2.0, 1, 3 + (((yy * 0.7 + xx * 2) % 9) < 2))
    col = np.where((b < 12)[..., None], M[np.clip(tm, 0, 6)], Gd[np.clip(tg, 0, 6)])
    col = np.where(((b >= 12) & (np.abs(gb - 9.0) < 0.6))[..., None], A('iron')[3], col)
    col = np.where((yf >= zt)[..., None], np.where((yf < zt + 5)[..., None], M[5], A('stone')[4]), col)
    col = np.where((xx < D1 * (1 if U == 1 else 2))[..., None], M[3], col)
    L.put(0, 0, col, inside)
    return L


# ---------------------------------------------------------------- the floor of the section
def floor_d(sec, pools=(), quays=((-1e9, 6), (760, 1000))):
    """The floor of d (street pass, 2026-11-11): the bands of street_d.py (fl['areas']), all straight along the
       street or square across it:
       - pave: the grey pavement tiles of level.py (before the houses; in front of the market's edge)
       - kerb-far: the granite kerb of the house pavement, its lit top and its face (the back post row on it)
       - fan: the market's setts laid in fans; gutter: granite gutter stones with drain grates (fl['drains'])
       - cobbles: a strip of kinderkopjes; kerb-near: the kerbstones of the market's edge (the front post row)
       - band: the dark granite threshold across the street before the forecourt
       - slabs: the forecourt of the Stopera, big pale slabs, dark granite bands every 8 slabs
       then the quay coping where the Amstel shows (quays: the end of the house row, the alley mouths) and the light pools (lamps, lit shops, the lobby)."""
    fl = sec.fl
    S, BRB, PG = A('stone'), A('brick_brown'), A('pave_grey')
    IR = A('iron')

    def fn(u, d, v, rgb):
        h1 = hash01
        for a in fl.get('areas', []) or []:
            am = (u >= a['u0']) & (u < a['u1']) & (d <= pl(a['far'], u)) & (d > pl(a['near'], u))
            if not am.any():
                continue
            k = a['kind']
            if k == 'pave':                                              # level.py's pavement tiles, 10 x 10
                tu, tv = u / 10.0, v / 10.0
                fu, fv = tu - np.floor(tu), tv - np.floor(tv)
                ti, tj = np.floor(tu), np.floor(tv)
                t = 4 + (h1(ti, tj, 11) > 0.74) - (h1(ti, tj, 12) > 0.80)
                st = fbm(u / 23.0, v / 9.0, 13, 3)
                t = t - ((st < 0.34) & (h1(u * 2, v * 2, 14) > 0.4))
                jt = (fu < 0.09) | (fv < 0.10)
                t = np.where(jt, 2, t)
                t = np.where((fv >= 0.10) & (fv < 0.18) & ~jt, np.minimum(t + 1, 6), t)
                rgb[am] = PG[np.clip(t, 0, 6)][am]
            elif k == 'fan':
                cu = np.floor(u / 30.0) * 30 + 15
                rr = np.hypot(u - cu, (v - 60))
                ri = np.floor(rr / 3.0)
                ang = np.arctan2(v - 60, u - cu) * rr / 4.6
                ai = np.floor(ang + 0.5 * (ri % 2))
                fr, fa = rr / 3.0 - ri, ang + 0.5 * (ri % 2) - ai
                base = 3 + (h1(ri, ai, 41) > 0.70) - (h1(ri, ai, 42) > 0.80)
                st = fbm(u / 26.0, v / 8.0, 43, 2)
                base = base - ((st < 0.36) & (h1(ri, ai, 44) > 0.5))
                t = np.where(fr < 0.22, base + 1, base)
                t = np.where((fa < 0.09) | (fr > 0.82), 1, t)
                rgb[am] = BRB[np.clip(t, 0, 6)][am]
            elif k == 'cobbles':                                         # level.py's kinderkopjes, worn like the fan
                j = np.floor(v / 4.0)
                uu = u / 5.0 + 0.5 * (j % 2)
                i = np.floor(uu)
                fu, fv = uu - i, v / 4.0 - j
                base = 3 + (h1(i, j, 31) > 0.66) - (h1(i, j, 32) > 0.78)
                st = fbm(u / 24.0, v / 8.0, 33, 2)
                base = base - ((st < 0.34) & (h1(i, j, 34) > 0.5))
                t = np.where((fu - 0.42) ** 2 + (fv - 0.45) ** 2 < 0.05, base + 1, base)
                t = np.where((fu > 0.62) & (fv > 0.55), base - 1, t)
                t = np.where((fu < 0.10) | (fv < 0.12), 1, t)
                rgb[am] = S[np.clip(t, 0, 6)][am]
            elif k == 'gutter':                                          # long granite gutter stones, a shallow channel
                f_, n_ = pl(a['far'], u), pl(a['near'], u)
                t = 4 + (h1(np.floor(u / 9.0), 0, 35) > 0.7) - (fbm(u / 20.0, v / 6.0, 36, 2) < 0.34)
                t = np.where(np.abs(d - (f_ + n_) / 2) < 0.45, t - 2, t)                 # the channel
                t = np.where(d > f_ - 0.45, 6, t)                                         # the lit back arris
                t = np.where(d < n_ + 0.35, 2, t)                                         # the joint to the cobbles
                t = np.where((u % 9.0) < 0.5, 2, t)
                rgb[am] = S[np.clip(t, 0, 6)][am]
            elif k == 'kerb-far':                                        # the granite kerb: lit top, face toward the market
                top = am & (d >= FAR_K)
                face = am & (d < FAR_K)
                jn = (u % 11) < 0.55
                wr = (fbm(u / 18.0, v / 4.0, 37, 2) < 0.33)
                rgb[top] = S[5]; rgb[top & wr] = S[4]; rgb[top & (d >= FAR_K + 1.2)] = S[6]; rgb[top & jn] = S[3]
                rgb[face] = S[2]; rgb[face & jn] = S[1]
            elif k == 'kerb-near':                                       # kerbstones: a joint behind, the top, the front arris
                f_, n_ = pl(a['far'], u), pl(a['near'], u)
                jn = (u % 13) < 0.55
                wr = (fbm(u / 18.0, v / 4.0, 38, 2) < 0.33)
                rgb[am] = S[5]
                rgb[am & wr] = S[4]
                rgb[am & (d > f_ - 0.4)] = S[6]
                rgb[am & (d < n_ + 0.4)] = S[3]
                rgb[am & jn] = S[3]
            elif k == 'band':                                            # small dark granite setts across the street
                j = np.floor(v / 3.0)
                uu = u / 4.0 + 0.5 * (j % 2)
                i = np.floor(uu)
                fu, fv = uu - i, v / 3.0 - j
                base = 2 + (h1(i, j, 39) > 0.7) - (h1(i, j, 40) > 0.85)
                t = np.where((fv < 0.2) & (fu > 0.1), base + 1, base)
                t = np.where((fu < 0.1) | (fv > 0.85), 1, t)
                t = np.where((np.abs(u - a['u0']) < 0.6) | (np.abs(u - a['u1']) < 0.6), 4, t)  # the long edge stones
                rgb[am] = S[np.clip(t, 0, 6)][am]
            elif k == 'slabs':                                           # the forecourt: big pale slabs, worn and stained
                u0 = a['u0']
                i, j = np.floor((u - u0) / 22.0), np.floor(v / 13.0)
                fu, fv = (u - u0) / 22.0 - i, v / 13.0 - j
                t = 5 - (h1(i, j, 51) > 0.72) + (h1(i, j, 52) > 0.9)
                n = fbm(u / 34.0, v / 10.0, 53, 3)
                t = t - ((n < 0.32) & (h1(u * 2, v * 2, 54) > 0.55))
                t = np.where((fv >= 0.07) & (fv < 0.16), np.minimum(t + 1, 6), t)   # the lit front edge of each slab
                t = np.where((fu < 0.035) | (fv < 0.07), 3, t)
                t = np.where(((u - u0) % 176 < 2.2) & (u >= u0 + 100), 2, t)        # dark granite bands every 8 slabs
                rgb[am] = S[np.clip(t, 0, 6)][am]
        # the joint between the cobbles and the kerbstones of the market's edge (the cobbles lie a little lower)
        jm = (u < MARKET_U1) & (d > NEAR_K) & (d <= NEAR_K + 0.5)
        rgb[jm] = S[1]
        # drain grates (in the gutter of the market, in the forecourt)
        for (gu, gd) in fl.get('drains', []) or []:
            gm = (np.abs(u - gu) < 8) & (np.abs(d - gd) < 1.1)
            if gm.any():
                tt = np.where((((u - gu + 8) % 3) < 1.0), 1, 3)
                tt = np.where(np.abs(d - gd) > 0.75, 4, tt)
                rgb[gm] = IR[tt][gm]
        # the quay coping at the back edge (the Amstel behind it)
        qm = np.zeros(u.shape, bool)                                     # (quays: u spans; the alley mouths too)
        for (q0, q1) in quays:
            qm |= (u > q0) & (u < q1)
        qm &= d >= 26.5
        rgb[qm] = S[5]
        rgb[qm & (d >= 28.6)] = S[6]
        rgb[qm & (d < 27.1)] = S[2]
        rgb[qm & ((u % 22) < 0.6)] = S[3]
        # light pools: (u, d, ru, rd, strength)
        ck = chk(u, d * 3)
        for (pu, pd, ru, rd, a1) in pools:
            e = ((u - pu) / ru) ** 2 + ((d - pd) / rd) ** 2
            inner = (e < 0.36) | ((e < 0.5) & ck)
            outer = ((e < 0.85) | ((e < 1.0) & ck)) & ~inner
            for m_, a in ((inner, a1), (outer, a1 * 0.55)):
                if m_.any():
                    px = rgb[m_].astype(float)
                    rgb[m_] = snap5(px + (np.array((255, 232, 170), float) - px) * a)
    return fn


def post_on_kerb(sec):
    """Every Amsterdammertje of the section on the top of a kerbstone line of floor_d (the rule of the user): the
       house kerb (FAR_K .. 12.8) or the kerbstones of the market's edge (-24.5 .. NEAR_K), and only in the market."""
    bad = []
    for r in sec.L['floor']['rows'] or []:
        if r.get('prop') != 'ams/pole':
            continue
        for x in row_at(sec, r):
            on_back = FAR_K + 0.3 <= r['depth'] <= 12.5
            on_front = -24.1 <= r['depth'] <= NEAR_K - 0.6
            if not ((on_back or on_front) and x + 3 < MARKET_U1):
                bad.append('%g@%g' % (x, r['depth']))
    return bad


# ---------------------------------------------------------------- front things at the lower edge (the market only)
def fg_records(rng):
    """A crate of old records and a box of books at the lower screen edge."""
    W = R['wood']; K = R['black']
    L = Layer(70, 30)
    L.rect(0, 10, 34, 20, W[3]); L.hl(0, 10, 34, W[5]); L.vl(0, 10, 20, W[5]); L.vl(33, 10, 20, W[1]); L.hl(0, 18, 34, W[2])
    for i, sx in enumerate(range(2, 32, 3)):
        Cc = R[rng.choice(['red', 'yellow', 'blue', 'white', 'green', 'rose'])]
        L.rect(sx, 2 + (i % 3), 3, 9, Cc[4]); L.vl(sx, 2 + (i % 3), 9, Cc[6], t=TH); L.vl(sx + 2.5, 2 + (i % 3), 9, Cc[1], t=TH)
    L.ellipse(14, 4, 4.5, 4.5, K[1]); L.ring(14, 4, 4.5, K[3], 4); L.ellipse(14, 4, 1.4, 1.4, R['red'][5])
    L.rect(38, 14, 30, 16, R['canvas'][3]); L.hl(38, 14, 30, R['canvas'][5]); L.vl(67, 14, 16, R['canvas'][1])
    L.poly([(38, 14), (46, 7), (52, 14)], R['canvas'][4]); L.poly([(56, 14), (64, 9), (68, 14)], R['canvas'][2])
    for i in range(6):
        Cc = R[rng.choice(['red', 'green', 'blue', 'yellow'])]
        L.rect(41 + i * 4, 9 + (i % 2), 3, 6, Cc[3]); L.hl(41 + i * 4, 11 + (i % 2), 3, R['yellow'][5], t=TH)
    return L
