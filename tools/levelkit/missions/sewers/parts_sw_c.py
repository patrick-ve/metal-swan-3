# Painters of section c of mission sewers (DE PUT, 01:30; docs/design/sewers.md §2.3, §5.2): the burst drain shaft at
# the start (the fall), the first brick tunnel, narrower and lower than d's main sewer. Wave P4b, painter C.
#
# c uses the APPROVED sewer parts (parts_sewers.py) with its own cross-section. parts_sewers' painters read their lines
# (S_W, YWALL, YQ, YW, YSPRING, GRATE_V, LOST) as module globals, so this file loads a private copy of that module (PS)
# and sets c's numbers in the copy only: the shared module, the look sample and the sections d and e keep theirs.
# A few hard-coded numbers of the shared file that only fit d's 1,280-px sample are replaced in the copy (_SUBS); each
# replacement must match exactly once, or the import stops (the shared file changed: look again).
#
# The cross-section of c (metres; 13 px per metre x the plane's speed):
#   near walkway  as d: the walk band to the coping 2.6 m behind the walk line (depth 16, y 160)
#   channel       3.6 m of dark water (d: 5.0), from the coping to the far walkway's face (y 144, s 0.724)
#   far walkway   0.9 m of slabs, 0.35 m above the water (y 138-141, face 141-144)
#   far wall      at S_W = 78/116 = 0.672 (8.7 px/m), 7.9 m behind the walk line (d: 9.9 m); 6.2 m from the walkway
#                 to the spring line (54 px: y 138 -> 84; d: 7.4 m); bays of 7.3 m (64 px)
#   vault         rows from the spring (y 84) to the top of the frame; crown grates at s 0.75-0.77
#   side tunnel   4 m wide, 5 m tall (34 x 44 px), smaller than d's
import math
import random
import types
import numpy as np
from level import *
import parts_sewers as _P0

C_GEO = dict(S_W=78.0 / 116.0, YWALL=138, YQ=141, YW=144, YSPRING=84, GRATE_V=(0.75, 0.77))

# lost things in c's channel (kind, world x, world depth px behind the walk line: the water is 34 .. 80 here)
LOST_C = [
    ('wipes', 150, 50), ('grease', 262, 64), ('bottle', 420, 44), ('wipes', 612, 70), ('phone', 704, 52),
    ('keys', 880, 62), ('grease', 990, 46), ('wipes', 1130, 68), ('duck', 1292, 56), ('stick', 1420, 48),
    ('grease', 1560, 72), ('wipes', 1702, 52), ('bottle', 1842, 64),
]

_SUBS = [
    # vault_px: cracks and roots over the whole 1,920 px (the sample's span ends at 1,450)
    ("    for k in range(9):\n        ux, tx = rng.uniform(-150, 1450), rng.uniform(0.75, 1.3)",
     "    for k in range(13):\n        ux, tx = rng.uniform(-150, 2000), rng.uniform(0.75, 1.3)"),
    # water_px: drip rings over the whole section, in c's narrower channel; the outfalls' foam at c's far face
    ("    for i in range(70):\n        ux, vx = rng.uniform(-200, 1500), rng.uniform(36, 96)",
     "    for i in range(90):\n        ux, vx = rng.uniform(-200, 2000), rng.uniform(36, 78)"),
    ("dd = ((u - ux) / 9.0) ** 2 + ((vb - 97.0) / 4.0) ** 2", "dd = ((u - ux) / 9.0) ** 2 + ((vb - 77.0) / 4.0) ** 2"),
    # walkway_px: the drain slots in the walkway over the whole section
    ("for ux in range(250, 1300, 320):", "for ux in range(250, 1950, 320):"),
    # tunnel_layers: the floor row at y lies at depth z = (YWALL - 60) / (y - 60) (the sample hard-codes its 72)
    ("s0, s1 = S_W * (y0 - 60) / 72.0, S_W", "s0, s1 = S_W * (y0 - 60) / (YWALL - 60.0), S_W"),
]


def _copy_parts():
    src = open(_P0.__file__).read()
    for a, b in _SUBS:
        n = src.count(a)
        if n != 1:
            raise SystemExit('parts_sw_c: parts_sewers.py changed: %d matches for %r' % (n, a[:60]))
        src = src.replace(a, b)
    m = types.ModuleType('parts_sewers_c')
    m.__file__ = _P0.__file__
    exec(compile(src, _P0.__file__, 'exec'), m.__dict__)
    for k, v in C_GEO.items():
        setattr(m, k, v)
    m.LOST = LOST_C
    return m


PS = _copy_parts()
SR = PS.SR
S_W, YWALL, YQ, YW, YSPRING = PS.S_W, PS.YWALL, PS.YQ, PS.YW, PS.YSPRING
BAY, PIL, PXM, D_EDGE, S_SHAFT = PS.BAY, PS.PIL, PS.PXM, PS.D_EDGE, PS.S_SHAFT
HW_WALL = YWALL - YSPRING                       # 54 px: the wall from the far walkway to the spring line

SR['earth'] = ramp(7, .13, .56, .016, .036, .030, 36, 72)      # wet soil and sand round the burst
SR['rat'] = ramp(7, .12, .60, .010, .026, .024, 34, 74)        # grey-brown fur
SR['clay'] = ramp(7, .20, .70, .050, .100, .090, 40, 66)       # a glazed stoneware drain pipe


def wall_u(p):
    return PS.wall_u(p)


def wall_p(u):
    return PS.wall_p(u)


# ---------------------------------------------------------------- the far wall of c
# The bays left to right (plane slots of 64 px at S_W; bay k is centred on world x ~ 54 + 95.2 k). One side tunnel (bay
# 4, world x ~339: the game's tunnel eye spot at 330); pipe mouths with eyes in 0 .. EYE_UPTO (the flashlight lesson);
# two manholes with their ladders (k 11 by the sewer worker at 1,000; k 18 by the checkpoint at 1,700).
BAYS_C = ['plain', 'pipes', 'pipes', 'outfall', 'tunnel', 'pipes', 'plain', 'pipes', 'plain', 'outfall', 'moss',
          'manhole', 'pipes', 'plain', 'outfall', 'moss', 'pipes', 'plain', 'manhole', 'pipes', 'plain', 'outfall', 'moss']
EYE_UPTO = 720            # world x: the pipe mouths up to here hold blinking eyes; further on they are dark
BLINK_N = 8               # frames of the blinking eyes and the drips (a step every 10 ticks: an 80-tick cycle)


def tunnel_mouth_c(F, xc, B, seed, info, hw=17):
    """c's side tunnel: 4 m wide, 5 m tall (34 x 44 px at S_W), a three-ring rowlock arch with a keystone (parts_sewers
       tunnel_mouth at c's size; the opening is cut after the walkway)."""
    spring = YWALL - 27
    crown = spring - hw
    xx, yy = grid(xc - hw - 5, crown - 5, 2 * hw + 10, YWALL - crown + 5)
    d = np.hypot(xx - xc, yy - spring)
    ring = (((d <= hw + 4) & (d > hw)) & (yy < spring)) | ((np.abs(xx - xc) <= hw + 4) & (np.abs(xx - xc) > hw) & (yy >= spring))
    ang = np.arctan2(yy - spring, xx - xc)
    tone = np.where(np.floor(ang * 22 + 0.5) % 2 == 0, 4, 3)
    tone = np.where((yy >= spring) & (np.floor(yy / 1.0) % 2 == 0), 4, np.where(yy >= spring, 3, tone))
    tone = np.where((np.abs(d - hw - 1.3) < 0.3) | (np.abs(d - hw - 2.7) < 0.3), 2, tone) if U >= 2 else tone
    tone = tone + (hash01(np.floor(ang * 12), 2, seed) > 0.75) - ((d < hw + 1) & (yy < spring))
    tone = np.where(yy > YWALL - 14, np.minimum(tone, 2), tone)
    F.put(xc - hw - 5, crown - 5, np.array(B, np.uint8)[np.clip(tone, 0, 6)], ring)
    F.rect(xc - 2, crown - 4.5, 4, 5, SR['granite'][4]); F.rect(xc - 2, crown - 4.5, 4, 1, SR['granite'][6])
    F.vl(xc + 1.5, crown - 4, 4.5, SR['granite'][2], t=TH)
    info['tunnels'].append((xc, hw, crown, spring))
    info['carriers'].append(('tunnel', xc, crown, hw))


def moss_patch(F, cx, cy, rx, ry, seed):
    """A cushion of moss and green algae on wet brick (seen from afar: a cluster of greens, its lit top edge)."""
    xx, yy = grid(cx - rx, cy - ry, 2 * rx, 2 * ry)
    d = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2
    v = F.view(cx - rx, cy - ry, 2 * rx, 2 * ry)
    if v.shape[:2] != xx.shape:
        return
    m = (d + (fbm(xx / 2.5, yy / 2.0, seed, 2) - 0.5) * 1.2 < 0.75) & (v[..., 3] > 0)
    M = np.array(SR['moss'], np.uint8)
    t = np.clip(2 + (fbm(xx / 1.6, yy / 1.6, seed + 1, 2) > 0.55) + (yy < cy - ry * 0.3) - (hs(xx, yy, seed + 2) < 0.2), 0, 6)
    F.put(cx - rx, cy - ry, M[t], m)


def far_wall_c(sec, H, seed=17):
    """c's far plane (speed S_W): the wall, its bays, the cornice, the far walkway; daylight colours. As parts_sewers
       far_wall, with c's heights and bays; the eyes of the pipe mouths go to info['blink'] (a frames layer: they
       blink), not to the static light pass."""
    WF = sec.lw(S_W)
    F = Layer(WF, VIEW_H)
    B, Bd = SR['sbrick'], SR['sbrick_b']
    info = dict(eyes=[], carriers=[], pours=[], mshafts=[], grates_far=[], tunnels=[], bays=[], signs=[], blink=[], drips=[])
    rng = random.Random(seed)
    brickfill(F, 0, YSPRING, WF, HW_WALL, B, seed, streaks=True)
    xx, yy = grid(0, YSPRING, WF, HW_WALL)
    tide = YWALL - 13 + (vnoise(xx / 7.0, yy * 0, seed + 1) - 0.5) * 4 + (fbm(xx / 2.0, yy * 0, seed + 2, 2) - 0.5) * 2
    low = yy > tide
    lowt = np.clip(2 + (fbm(xx / 8.0, yy / 3.0, seed + 3, 2) > 0.55) - (hs(xx, yy, seed + 4) < 0.18) - ((yy - tide) < 0.8), 0, 4)
    F.put(0, YSPRING, np.array(Bd, np.uint8)[lowt], low)
    nb = int(math.ceil(WF / BAY))
    ph = 1
    for k in range(nb):
        x0 = k * BAY
        kind = BAYS_C[k % len(BAYS_C)]
        xc, half = PS.recess(F, x0, 'mouth' if kind == 'tunnel' else ('plain' if kind == 'moss' else kind), seed + 10 * k, B, Bd)
        info['bays'].append((x0, BAY, kind))
        eyes = wall_u(xc) < EYE_UPTO
        mouths = []
        if kind == 'pipes':
            mouths = [(xc - 12, YSPRING + 0.60 * HW_WALL, 4.0), (xc + 10, YSPRING + 0.74 * HW_WALL, 3.0)]
        elif kind == 'manhole':
            PS.manhole(F, xc - 6, B, seed + k, info)
            PS.sign_exit(F, xc + 4, YSPRING + 22)
            info['signs'].append((xc + 4, YSPRING + 22, 15, 17))
        elif kind == 'outfall':
            PS.outfall(F, xc, YSPRING + 0.75 * HW_WALL, 3.4, seed + k, info)
            mouths = [(xc + 17, YSPRING + 0.46 * HW_WALL, 2.6)]
        elif kind in ('plain', 'moss'):
            ya = YSPRING + 29
            F.rect(xc - 9, ya, 18, YWALL - ya - 6, B[2])
            brickfill(F, xc - 9, ya, 18, YWALL - ya - 6, SR['sbrick'], seed + k * 3, mid=2, lo=1, hi=3, cw=3)
            F.hl(xc - 10, ya - 1, 20, B[4], t=1); F.hl(xc - 10, ya - 0.2, 20, B[1], t=TH)
            mouths = [(xc + 18, YSPRING + 22, 2.4)]
        elif kind == 'tunnel':
            tunnel_mouth_c(F, xc, B, seed + k, info)
        for j, (cx, cy, r) in enumerate(mouths):
            PS.pipe_mouth(F, cx, cy, r, B, seed + k + 2 * j, eyes=0, info=info)
            if eyes:
                info['blink'].append((cx, cy + 0.3, 1 + (ph * 3) % (BLINK_N - 1)))
                ph += 1
        if kind == 'moss':                                     # wet moss and algae where a seep runs down the bay
            moss_patch(F, xc - 4, YWALL - 9, 13, 5, seed + k)
            moss_patch(F, xc + 12, YSPRING + 18, 6, 4, seed + k + 1)
    # the cast-iron pipe under the cornice, brackets on the pilasters, rust below them
    I, Ru = SR['castiron'], SR['rust']
    yp = YSPRING + 4.5
    F.rect(0, yp, WF, 2.5, I[3])
    F.hl(0, yp, WF, I[5], t=TH)
    F.hl(0, yp + 2, WF, I[1], t=TH)
    for k in range(nb):
        bx = k * BAY + PIL / 2
        F.rect(bx - 1, yp - 1, 2.5, 4.5, Ru[3]); F.rect(bx - 1, yp + 3, 2.5, 0.5 if U > 1 else 1, Ru[1])
        F.vl(bx, yp + 3.5, rng.randint(5, 16), Ru[1], t=TH)
        F.rect(k * BAY + 30 + rng.uniform(-6, 6), yp, 1.5, 2.5, I[2])
    PS.cornice(F, 0, WF, seed + 40, SR['granite'])
    # the drips of the blinking frames fall from the cornice's calcite (one in about every 34 px)
    x = rng.uniform(4, 20)
    while x < WF - 4:
        info['drips'].append((x, rng.randrange(BLINK_N)))
        x += rng.uniform(22, 46)
    xx, yy = grid(0, YSPRING - 3, WF, 2)
    mm = fbm(xx / 5.0, yy, seed + 41, 2) > 0.58
    F.put(0, YSPRING - 3, np.array(SR['moss'], np.uint8)[np.clip(3 + (hs(xx, yy, 3) > 0.5), 0, 6)], mm)
    PS.far_walkway(F, 0, WF, seed + 50)
    # moss on the far walkway's nosing, thicker than in d (less flow in this old tunnel)
    xx, yy = grid(0, YQ - 2, WF, 2)
    mm = (fbm(xx / 4.0, yy, seed + 52, 2) > 0.52)
    F.put(0, YQ - 2, np.array(SR['moss'], np.uint8)[np.clip(2 + (hs(xx, yy, 5) > 0.6), 0, 6)], mm)
    for (pc, hw, crown, spring) in info['tunnels']:
        xx, yy = grid(pc - hw, crown, 2 * hw, YWALL - crown)
        op = ((yy >= spring) | (np.hypot(xx - pc, yy - spring) <= hw)) & (np.abs(xx - pc) <= hw)
        sub_ = F.view(pc - hw, crown, 2 * hw, YWALL - crown)
        if sub_.shape[:2] == op.shape:
            sub_[op] = 0
    return F, info


def wallfx_layer(sec, H, info, frames=BLINK_N):
    """The far wall's moving things (plane S_W): the eyes in the pipe mouths blink (each pair shut one frame, half shut
       the frame before, out of step), drips fall from the cornice to the far walkway and splash. Emitters (eyes) keep
       their colours; the drips are the key's lit water."""
    E = [tuple(int(v) for v in snap5(c)) for c in H['em']['eye']]
    G0 = PS.G_of(H, H['air'])
    C = PS.gramp('calc', G0)
    Wt = PS.gramp('swater', G0)
    WF = sec.lw(S_W)
    y0, h = YSPRING, YWALL - YSPRING + 3
    outs = []
    for f in range(frames):
        L = Layer(WF, h)
        for (ex, ey, ph) in info['blink']:
            st = 'shut' if f == ph else ('half' if f == (ph - 1) % frames else 'open')
            yl = ey - y0
            if st == 'open':
                for dx in (-1.0, 1.0):
                    glow(L, ex + dx, yl, 2.2, [E[2]])
                for dx in (-1.0, 1.0):
                    L.rect(ex + dx - 0.5, yl - 0.5, 1, 1, E[1])
                    if U >= 2:
                        L.rect(ex + dx - 0.5, yl - 0.5, 0.5, 0.5, E[0])
            elif st == 'half':
                for dx in (-1.0, 1.0):
                    L.rect(ex + dx - 0.5, yl, 1, 0.5 if U > 1 else 1, E[2])
        for (dx_, ph) in info['drips']:
            k = (f + ph) % frames
            fall = HW_WALL - 4
            yd = 3 + (k + 0.5) * fall / frames
            if k < frames - 1:
                L.rect(dx_ - 0.25, yd, 0.5 if U > 1 else 1, 1.5 if U > 1 else 1, C[6])
                L.px(dx_ - 0.25, yd - 1.0, C[4]) if U >= 2 else None
            else:                                                       # the splash on the far walkway
                for sx in (-1.5, 0.0, 1.5):
                    L.rect(dx_ + sx - 0.25, h - 3.5 + (0 if sx == 0 else 0.5), 0.5 if U > 1 else 1, 0.5 if U > 1 else 1, Wt[6] if sx else C[6])
        outs.append(L)
    sec.add('wallfx', None, S_W, y=y0, kind='frames', frames=outs)
    return outs


# ---------------------------------------------------------------- the burst shaft (the fall, spec §5.2)
# The old brick drain shaft (the 'put') from the burst gutter of b's square comes down to this tunnel and has broken
# through its vault right over the near walkway at x 64: a ragged hole in the crown (the vault rows cut away), the
# shaft and the collapsed earth behind it (a frames layer at speed SB: the well's brick lining, its step irons, the
# faint cold street light and the rain falling down it, two rats on its walls), the rain falling from the hole to the
# walkway (a light column at depth 8), a heap of rubble in the channel (depth 22), fragments and a puddle on the walkway.
BURST_U = 64              # world x of the burst (the heroes drop at 64; the fragments on the walkway centre here)
# The hole is a fixed set of the vault's brick cells, chosen where they show at camera 0: an oval hanging from the top
# of the frame (centre x HX, half width RX, its far edge at y HY0 + RY); at other cameras it shears with the barrel.
HX, HY0, RX, RY = 66.0, -4.0, 27.0, 38.0
SB = 0.86                 # the speed of the shaft and the collapse behind the hole
WELL_P = HX               # the well's centre on the SB plane: at camera 0 in the middle of the hole
SC = s_d(8)               # the rain column's plane (lands on the walkway at depth 8, y 168) ...
COL_U = 192 + (WELL_P - 192) / SC     # ... under the well: at camera 0 it falls at screen x 66, beside the drop at 64
BURST_YB = HY0 + RY       # the hole's lowest row (y 34)


def _vault_cells(u, s):
    """The vault's brick cells (vault_px's numbers): course and cell index of every pixel, the cells' centres (world
       x, screen y, speed)."""
    th = PS.theta_of_s(s)
    NC, cw = 22.0, 7.0
    Ay = th * NC
    course = np.floor(Ay + 1e-6)
    off = (course % 2) * cw / 2
    cell = np.floor((u + off) / cw)
    uc = (cell + 0.5) * cw - off
    thc = np.minimum((course + 0.5) / NC, np.pi / 2)
    yc = YSPRING * (1 - np.sin(thc))
    sc = S_W + (1 - S_W) * (1 - np.cos(thc))
    return th, course, cell, uc, yc, sc


def burst_hole_e(uc, yc, sc, course, cell, seed=5):
    """The hole's measure at a cell centre: < 1 inside, 1 .. 1.2 the broken rim (cell centres seen at camera 0)."""
    x0 = 192 + (uc - 192) * sc
    j = hash01(cell, course, seed) - 0.5
    ang = np.arctan2(yc - HY0, x0 - HX)
    lob = 0.07 * np.sin(ang * 3 + 1.1) + 0.05 * np.sin(ang * 7 + 0.4)
    return np.hypot((x0 - HX) / RX, (yc - HY0) / RY) * (1 - lob) + j * 0.16


def _hole_px(u, y, s):
    """Screen x at camera 0 of every pixel of a rows layer."""
    return 192 + (u - 192) * s


def _dilate(m, n):
    """Grow a mask by n real px (8 neighbours)."""
    out = m.copy()
    for _ in range(int(n)):
        p = np.pad(out, 1)
        out = p[1:-1, 1:-1] | p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:] | p[:-2, :-2] | p[2:, 2:] | p[:-2, 2:] | p[2:, :-2]
    return out


def burst_vault(sec, H, seed=5):
    """Cut the hole into the vault rows: the cells inside it become transparent. Round it, in one piece over the vault's
       bands (a rows image's column is its screen x at camera 0): the cut thickness of the vault's shell (two bricks,
       their ends catching the light from the well), a ragged band of broken bricks in shade, a few cracks running out
       through the vault, roots hanging from the lower edge."""
    S = np.array([snap5(c) for c in H['em']['shaft']], float)
    dark = np.array(H['KEY'][0], float)
    G0 = PS.G_of(H, H['air'] * 0.5)
    Wd = PS.gramp('wood', G0)
    Bk = PS.gramp('sbrick', G0)
    Ea = PS.gramp('earth', G0)
    bands = [ly for ly in sec.layers if ly['id'].startswith('vault') and ly['kind'] == 'rows' and ly['y'] < BURST_YB + 14]
    XW = P(HX + RX * 2.6)
    parts = []
    for ly in bands:
        im = ly['frames'][0]
        u, y, s, Wl = PS.rows_grid(sec, ly['y'], ly['y'] + im.h, ly['s0'], ly['s1'])
        parts.append((ly, u[:, :XW], y[:, :XW], s[:, :XW]))
    u = np.concatenate([q[1] for q in parts], 0)
    y = np.concatenate([q[2] for q in parts], 0)
    s = np.concatenate([q[3] for q in parts], 0)
    x0 = _hole_px(u, y, s)
    th, course, cell, uc, yc, sc = _vault_cells(u, s)
    e = burst_hole_e(uc, yc, sc, course, cell, seed)
    hole = e < 1.0
    cut = _dilate(hole, round(1.0 * U)) & ~hole                         # the shell's cut thickness
    brk = _dilate(hole, round(2.6 * U)) & ~hole & ~cut                  # broken bricks round it
    brk &= (hash01(cell, course, seed + 3) > 0.35) | _dilate(hole, round(1.8 * U))
    px = np.concatenate([q[0]['frames'][0].a[:, :XW, :3] for q in parts], 0).astype(float)
    h1 = hash01(cell, course, seed + 1)
    rimc = Bk[np.where(h1 > 0.6, 1, 0)].astype(float)
    rimc[hash01(cell, course, seed + 2) > 0.80] = Ea[1]
    px[brk] = rimc[brk]
    ct = np.where((np.floor(x0 / 1.6) + np.floor(y / 1.1)) % 2 == 0, 5, 4)
    cutc = Bk[ct].astype(float)
    cutc = cutc + (S[3] - cutc) * np.where(y < 20, 0.50, 0.30)[..., None]
    px[cut] = cutc[cut]
    under = cut & ~_dilate(hole, round(0.5 * U)) & (y > HY0 + RY * 0.55)  # the lower lip seen from below: in shade
    px[under] = Bk[2]
    # cracks running out from the hole
    rng = random.Random(seed + 6)
    cr = np.zeros(u.shape, bool)
    for k in range(6):
        ang = math.radians(rng.choice((12, 35, 60, 118, 145, 168)) + rng.uniform(-8, 8))
        ln = rng.uniform(6, 15)
        ex, ey = HX + RX * math.cos(ang), HY0 + RY * math.sin(ang)
        t = (x0 - ex) * math.cos(ang) + (y - ey) * math.sin(ang)
        d = np.abs(-(x0 - ex) * math.sin(ang) + (y - ey) * math.cos(ang) - 1.4 * np.sin(t * 0.7 + k))
        cr |= ~hole & ~cut & (t > -1) & (t < ln) & (d < (0.45 if U > 1 else 0.6))
    px[cr] = dark + (Bk[0] - dark) * 0.3
    # roots hanging from the hole's lower edge
    root = np.zeros(u.shape, bool)
    for k in range(16):
        ang = math.radians(rng.uniform(25, 155))
        ln, sway = rng.uniform(3, 12), rng.uniform(-2.0, 2.0)
        sx, sy = HX + RX * 0.97 * math.cos(ang), HY0 + RY * 0.97 * math.sin(ang)
        tt = np.clip((y - sy) / ln, 0, 1)
        root |= (np.abs(x0 - sx - sway * tt ** 2) < (0.5 if U > 1 else 0.55)) & (y > sy) & (y < sy + ln)
    px[root & ~hole] = Wd[1]
    px[root & ~hole & (hs(u, y, seed + 7) > 0.6)] = Wd[3]
    px = snap5(px)
    j = 0
    for (ly, *_r) in parts:
        a = ly['frames'][0].a
        n = a.shape[0]
        a[:, :XW, :3] = px[j:j + n]
        a[:, :XW, 3] = np.where(hole[j:j + n], 0, a[:, :XW, 3])
        j += n


def _burst_span(sec):
    """The plane span (speed SB) the shaft layer must cover so that every camera that sees the hole sees the shaft
       behind it (the hole's cells scroll at the vault rows' speeds, the shaft at SB)."""
    lo, hi = 1e9, -1e9
    for y in np.arange(0.0, BURST_YB + 2, 0.5):
        s = float(PS.s_of_y(y))
        q = 1 - ((y - HY0) / (RY * 1.12)) ** 2
        if q <= 0:
            continue
        for side in (-1, 1):
            xe = HX + side * RX * 1.15 * math.sqrt(q)
            for cx in range(0, 400, 2):
                x = xe - cx * s
                if x < -8 or x > VIEW_W + 8:
                    continue
                p = x + cx * SB
                lo, hi = min(lo, p), max(hi, p)
    return lo - 6, hi + 6


def rat_part(L, x, y, pose, fur, eye, facing=1, rim=None):
    """A rat on a wall (scenery, at the shaft's scale): pose 'up' climbs (head up), 'sit' crouches on a ledge (head to
       one side). Fur from the rat ramp; the eyes are emitters."""
    F = fur
    rim = rim or F[5]
    if pose == 'up':
        L.ellipse(x, y + 1.8, 2.2, 4.0, F[2])
        L.ellipse(x - 0.5, y + 1.2, 1.4, 3.2, F[3])
        L.ellipse(x, y - 2.6, 1.5, 2.0, F[2])                               # the head
        L.px(x - 1.3, y - 4.2, F[4]); L.px(x + 0.8, y - 4.2, F[4])          # ears
        L.line(x + 0.3, y + 5.6, x + 2.2 * facing, y + 11.0, F[1], t=TH)    # the tail hangs
        L.px(x - 2.2, y + 0.5, F[1]); L.px(x + 1.8, y + 0.5, F[1])          # claws in the joints
        L.px(x - 2.2, y + 4.2, F[1]); L.px(x + 1.8, y + 4.2, F[1])
        L.vl(x + 2.0 * facing, y - 2.5, 7.0, rim, t=TH)                     # the well's light on its flank
        L.px(x + 1.0 * facing, y - 4.4, rim)
        for dx in (-0.6, 0.6):
            L.rect(x + dx - 0.25, y - 2.6, 0.5 if U > 1 else 1, 0.5 if U > 1 else 1, eye[1])
        return [(x, y - 2.4)]
    L.ellipse(x - 0.8 * facing, y - 1.9, 3.8, 2.2, F[2])
    L.ellipse(x - 1.2 * facing, y - 2.6, 2.8, 1.2, F[3])
    L.ellipse(x + 3.0 * facing, y - 2.4, 1.9, 1.4, F[2])
    L.px(x + 2.4 * facing, y - 4.0, F[4])
    L.hl(x - 3.6, y - 4.1, 6.0, rim, t=TH)                                  # the light on its back
    L.px(x + 3.4 * facing, y - 3.7, rim)
    L.line(x - 3.6 * facing, y - 0.6, x - 7.0 * facing, y + 3.0, F[1], t=TH)
    for dx in (0.0,):
        L.rect(x + 3.7 * facing - 0.25, y - 2.8, 0.5 if U > 1 else 1, 0.5 if U > 1 else 1, eye[1])
    return [(x + 3.7 * facing, y - 2.6)]


def burst_layers(sec, H, lit, frames=4, seed=7):
    """The shaft behind the hole (frames at SB): wet earth and broken masonry round the old round brick well, its
       lining's cut ends, the concave back wall with step irons, the faint cold light from the street far above, the
       rain falling down it, two rats on its walls. Returns the eye positions [(plane x, y)] for the carrier check."""
    em = H['em']
    S = [tuple(int(v) for v in snap5(c)) for c in em['shaft']]
    E = [tuple(int(v) for v in snap5(c)) for c in em['eye']]
    KEEP = PS.keepcols(H)
    W = sec.lw(SB)
    BH = int(BURST_YB) + 8
    x0, x1 = _burst_span(sec)
    x0, x1 = max(0, math.floor(x0)), min(W, math.ceil(x1))
    pc = WELL_P
    rw = 9.5                                                            # the well: 1.7 m inside (at SB)
    base = Layer(W, BH)
    xx, yy = grid(x0, 0, x1 - x0, BH)
    dx = xx - pc
    # the collapse: wet earth in strata, stones, old roots
    st = (yy + 3.0 * np.sin(xx / 11.0) + 2.0 * fbm(xx / 8.0, yy / 4.0, seed, 2)) / 3.2
    et = np.clip((fbm(xx / 6.0, yy / 3.0, seed + 1, 3) > 0.58).astype(int) + (np.floor(st) % 3 == 0) - (yy > BH * 0.6), 0, 2).astype(int)
    rgb = np.array(SR['earth'], np.uint8)[et]
    deep = fbm(xx / 9.0, yy / 6.0, seed + 15, 2) < 0.5                  # the dark of the collapse between the clods
    rgb[deep] = np.array(SR['void'], np.uint8)[np.clip(et, 0, 1)][deep]
    stone = hs(np.floor(xx / 1.5), np.floor(yy / 1.2), seed + 2) > 0.94
    rgb[stone] = np.array(SR['granite'], np.uint8)[2]
    rgb[stone & (hs(xx, yy, seed + 3) > 0.5)] = np.array(SR['granite'], np.uint8)[4]
    # broken masonry round the break: chunks of the vault's brick hanging in the earth
    chunk = (hs(np.floor(xx / 2.5), np.floor(yy / 1.5), seed + 4) > 0.62) & (np.abs(dx) > rw + 3) & (yy > BH * 0.45)
    rgb[chunk] = np.array(SR['sbrick'], np.uint8)[np.clip(2 + (hs(xx, yy, seed + 5) > 0.6), 0, 6)][chunk]
    # the well's lining: the cut ends of its ring (lighter brick ends), down to its broken bottom
    wbot = BH * 0.58 + 3.0 * (vnoise(xx / 2.0, yy * 0, seed + 6) - 0.5) + 2.0 * np.sin(dx / 3.0)
    lin = (np.abs(dx) >= rw) & (np.abs(dx) < rw + 2.6) & (yy < wbot)
    lt = np.clip(4 - (np.floor(yy / 1.2) % 2) + (np.abs(dx) < rw + 0.8) - (hs(xx, yy, seed + 7) < 0.15), 0, 6).astype(int)
    rgb[lin] = np.array(SR['sbrick'], np.uint8)[lt][lin]
    # the inside: the concave back wall, its courses sagging toward the middle (seen from below), darker at the sides
    ins = (np.abs(dx) < rw) & (yy < wbot + 1)
    q = (dx / rw) ** 2
    cy_ = yy - 2.2 * (1 - q)
    row = np.floor(cy_ / 1.25)
    jn = (cy_ / 1.25 - row) > (0.72 if U >= 2 else 0.85)
    off = (row % 2) * 1.6
    cell = np.floor((dx + off) / 3.2)
    bt = np.clip(np.floor(3.2 - q * 2.2 - yy / BH * 1.0) + (hash01(cell, row, seed + 8) > 0.85) - (hash01(cell, row, seed + 9) < 0.12), 0, 5).astype(int)
    bt = np.where(jn & (U >= 2), np.maximum(bt - 1, 0), bt)
    Bk = np.array(SR['sbrick_b'], np.uint8)
    rgb[ins] = Bk[bt][ins]
    slime = ins & (vnoise(dx / 1.4, yy / 6.0, seed + 10) > 0.72)
    rgb[slime] = np.array(SR['slime'], np.uint8)[2]
    # the step irons: staggered left / right up the back wall, rusty
    Ru = np.array(SR['rust'], np.uint8)
    for k in range(int(BH / 3.4) + 1):
        ys = 1.4 + k * 3.4
        if ys > BH * 0.55:
            break
        sx = pc + (-2.2 if k % 2 else 2.2)
        sag = 2.2 * (1 - ((sx - pc) / rw) ** 2)
        base.rect(sx - 1.6, ys + sag, 3.2, 0.5 if U > 1 else 1, tuple(Ru[4]))
        base.rect(sx - 1.6, ys + sag + (0.5 if U > 1 else 1), 3.2, 0.5 if U > 1 else 1, tuple(Ru[1]))
    m = np.ones(xx.shape, bool)
    # paint the earth etc. under the rungs (the rungs were drawn first on an empty layer: keep them)
    keep = base.view(x0, 0, x1 - x0, BH)[..., 3] > 0
    base.put(x0, 0, rgb, m & ~keep)
    # under the broken bottom: the cavity torn out of the vault, dark, with hanging soil
    cav = (yy >= wbot + 1) & (np.abs(dx) < rw + 8 + (yy - wbot) * 0.6) & (hs(xx * 0.7, yy, seed + 11) > 0.12) & (yy < BH * 0.9)
    V = np.array(SR['void'], np.uint8)
    base.put(x0, 0, V[np.clip((1 + (hs(xx, yy, seed + 12) > 0.7)).astype(int), 0, 6)], cav)
    # a broken brick ledge in the cavity's left side (the sitting rat's perch)
    ledge = (np.abs(dx + rw + 2.5) < 4.5) & (yy > 25.5) & (yy < 27.5)
    rgb2 = np.array(SR['sbrick'], np.uint8)[np.clip(3 + (yy < 26.2) + (hs(xx, yy, seed + 14) > 0.7), 0, 6)]
    base.put(x0, 0, rgb2, ledge)
    base.recolor(PS.G_of(H, H['air'] * 0.4), keep=KEEP)
    # the street light falling down the well lights its back wall, the lining's cut ends and the earth round its foot
    # (stepped toward the shaft tones; the dithered light itself follows as an emitter)
    Sf = np.array(S, float)
    v = base.view(x0, 0, x1 - x0, BH)
    if v.shape[:2] == xx.shape:
        fade_ = np.clip(1.0 - yy / (BH * 1.05), 0, 1)
        amt = np.where(ins, 0.70 * fade_ * (1 - 0.50 * q) + 0.10, 0.0)
        amt = np.where(lin, 0.55 * fade_ + 0.10, amt)
        side = ~ins & ~lin & (np.abs(dx) < rw + 16)
        amt = np.where(side, 0.45 * np.clip(1 - (np.abs(dx) - rw) / 16, 0, 1) * np.clip(1.1 - yy / BH, 0.25, 1), amt)
        amt = np.where(ledge, 0.40, amt)
        amt = np.floor(amt * 6) / 6
        mm = (v[..., 3] > 0) & (amt > 0)
        tgt = np.where(ins[..., None], Sf[2], Sf[3])
        px = v[..., :3].astype(float)
        px[mm] = px[mm] + (tgt[mm] - px[mm]) * amt[mm][:, None]
        v[..., :3] = snap5(px)
    # the light (emitter): faint cold white from the street grate far up, densest at the top of the well
    Lt = Layer(W, BH)
    fade = np.clip(1.0 - yy / (BH * 0.95), 0, 1)
    core = (np.abs(dx) < rw * 0.55) & PS.bay(xx, yy, 0.42 * fade + 0.05)
    mid = (np.abs(dx) >= rw * 0.55) & (np.abs(dx) < rw * 0.95) & PS.bay(xx + 1, yy, 0.18 * fade)
    top = (yy < 2.5) & (np.abs(dx) < rw * 0.7) & ((yy < 1.0) | PS.bay(xx, yy, 0.7))
    lcol = np.zeros(xx.shape + (3,), np.uint8)
    lcol[mid] = S[2]; lcol[core] = S[1]; lcol[top] = S[0]
    Lt.put(x0, 0, lcol, core | mid | top)
    # the lit rims: the light catches the lower lips of the lining's cut ends and the cavity's top edge
    lip = lin & (np.abs(np.abs(dx) - rw) < 0.6) & (hs(xx, yy, seed + 13) > 0.55)
    lcol2 = np.zeros(xx.shape + (3,), np.uint8); lcol2[lip] = S[3]
    Lt.put(x0, 0, lcol2, lip)
    outs, eyes = [], []
    fur = PS.gramp('rat', PS.G_of(H, H['air'] * 0.2))
    fur = [tuple(int(v) for v in c) for c in fur]
    for f in range(frames):
        L = Layer(W, BH)
        L.blit(base, 0, 0)
        L.blit(Lt, 0, 0)
        # rain down the well: short lit streaks, falling a quarter of the way each frame
        rr = random.Random(seed + 20)
        for k in range(26):
            rx = pc + rr.uniform(-rw * 0.85, rw * 0.85)
            ry = (rr.uniform(0, BH) + f * BH / frames) % BH
            ln = rr.choice((1.5, 2.0, 3.0))
            L.rect(rx - 0.25, ry, 0.5 if U > 1 else 1, ln, S[0] if k % 3 else S[1])
        # the rats: one climbs the well's right wall (up one px per frame, back), one sits on a ledge of the break
        cyc = (0, -1, -2, -1)[f % 4]
        e1 = rat_part(L, pc + rw - 3.0, 9.5 + cyc, 'up', fur, E, facing=-1, rim=S[3])
        e2 = rat_part(L, pc - rw - 2.5, 25.5 + (0.5 if f % 2 else 0.0), 'sit', fur, E, facing=1, rim=S[3])
        if f == 0:
            eyes = e1 + e2
        outs.append(L)
    sec.add('burst', None, SB, kind='frames', frames=outs)
    return eyes


def rubble_heap(seed=3):
    """The rubble of the burst in the channel (daylight colours): broken bricks, stones and wet soil heaped out of the
       water, the bent gutter grate on its slope, a broken stoneware pipe, wipes; a foam line at its foot."""
    w, h = 90, 24
    L = Layer(w, h)
    xx, yy = grid(0, 0, w, h)
    top = h - (14 * np.exp(-((xx - 38) / 19.0) ** 2) + 7 * np.exp(-((xx - 66) / 8.0) ** 2) + 3 * np.exp(-((xx - 14) / 7.0) ** 2))
    top = top + (fbm(xx / 2.0, xx * 0, seed, 2) - 0.5) * 2.6
    top = top - 1.2 * (hash01(np.floor(xx / 2.6), 0, seed + 9) > 0.6)     # chunks stick up from the crest
    m = yy >= top
    cy_ = np.floor(yy / 1.6)
    cx_ = np.floor(xx / 2.6 + cy_ * 0.5 + 0.3 * np.sin(cy_ * 1.7))
    kind = hash01(cx_, cy_, seed + 1)
    t = np.clip(2 + (hash01(cx_, cy_, seed + 2) > 0.55) + (hash01(cx_, cy_, seed + 4) > 0.85) - (hash01(cx_, cy_, seed + 3) < 0.2), 0, 6)
    fy = yy / 1.6 - cy_
    fx = xx / 2.6 + cy_ * 0.5 + 0.3 * np.sin(cy_ * 1.7) - cx_
    t = np.where(fy < 0.3, t + 1, t)                                   # each chunk's lit top
    t = np.where((fy > 0.80) | (fx > 0.86), 0, t)                      # the dark gaps between the chunks
    t = np.where(yy - top < 1.0, t + 1, t)                             # the heap's lit crest
    t = np.where(yy > h - 3.5, t - 1, t)                               # wet and dark toward the water
    rgb = np.where((kind > 0.55)[..., None], np.array(SR['sbrick'], np.uint8)[np.clip(t, 0, 6)],
                   np.where((kind > 0.25)[..., None], np.array(SR['earth'], np.uint8)[np.clip(t, 0, 6)],
                            np.array(SR['granite'], np.uint8)[np.clip(t, 0, 6)]))
    L.put(0, 0, rgb, m)
    I = SR['castiron']
    # the bent gutter grate on the slope
    for k in range(6):
        gx = 46 + k * 2.2
        gy0 = h - 13 + k * 0.9
        L.line(gx, gy0, gx + 1.6, gy0 + 6.5, I[3] if k % 2 else I[2], t=1 if U == 1 else 0.75)
    L.line(45.5, h - 13.5, 58.5, h - 8.0, I[4], t=TH)
    L.line(47.0, h - 6.0, 60.0, h - 1.5, I[1], t=TH)
    # a broken stoneware pipe lying on the left flank
    Cl = SR['clay']
    L.poly([(8, h - 5), (22, h - 8), (23, h - 4), (9, h - 1)], Cl[3])
    L.line(8, h - 5, 22, h - 8, Cl[5], t=TH)
    L.ellipse(22.5, h - 6, 1.4, 2.2, Cl[1]); L.ellipse(22.6, h - 6, 0.8, 1.4, SR['void'][0])
    # wipes caught in the heap
    Wp = SR['wipe']
    for (wx, wy) in ((30, h - 9), (68, h - 6)):
        L.ellipse(wx, wy, 3.0, 1.2, Wp[4]); L.ellipse(wx - 0.6, wy - 0.4, 1.8, 0.6, Wp[5])
    # the slime and the foam line where the heap meets the water
    sl = m & (yy > h - 1.6)
    L.put(0, 0, np.broadcast_to(np.array(SR['slime'][2], np.uint8), xx.shape + (3,)), sl)
    fo = m & (yy > h - 0.8) & chk(xx, yy)
    L.put(0, 0, np.broadcast_to(np.array(SR['white'][4], np.uint8), xx.shape + (3,)), fo)
    E = Layer(w, h); E.a = L.a.copy()
    E.outline(SR['sbrick_b'][0], 'br')
    L.a[..., :3] = np.where((E.a[..., :3] == np.array(SR['sbrick_b'][0], np.uint8)).all(-1)[..., None] & (L.a[..., 3:] > 0), E.a[..., :3], L.a[..., :3])
    return L


def burst_floor(sec, H, floor, frames, seed=9):
    """On the near walkway under the hole (floor rows): brick fragments and grit thrown out by the burst, the puddle
       where the rain from the hole lands (faint cold light in it, rings from the drops in each frame)."""
    em = H['em']
    S = np.array([snap5(c) for c in em['shaft']], np.uint8)
    G0 = PS.G_of(H, 0.0)
    Bk = PS.gramp('sbrick', G0)
    Gr = PS.gramp('granite', G0)
    Wt = PS.gramp('swater', G0)
    I = PS.gramp('castiron', G0)
    y0 = floor['y']
    im0 = floor['frames'][0]
    u, y, s, Wl = PS.rows_grid(sec, y0, y0 + im0.h, floor['s0'], floor['s1'])
    vb = PS.vb_of(s)
    vbl = PS.vb_of(SC)                                                # where the rain column lands
    zone = np.abs(u - BURST_U) < 70
    PU = COL_U
    rng = random.Random(seed)
    frag = np.zeros(u.shape, bool)
    fcol = np.zeros(u.shape + (3,), np.uint8)
    for k in range(46):
        fu = BURST_U + rng.gauss(0, 22)
        fv = rng.uniform(-10, 31)
        lw_, lh_ = rng.uniform(1.4, 2.8), rng.uniform(0.9, 1.7)
        mm = zone & (np.abs(u - fu) < lw_) & (np.abs(vb - fv) < lh_)
        if not mm.any():
            continue
        # no small red specks on the floor (bloodless: they could read as blood): broken bricks are whole chunks in
        # their dark tones, the rest stone and mortar
        tone = rng.choice((1, 2, 2, 3))
        c = Bk if rng.random() < 0.45 else Gr
        fcol[mm] = c[tone]
        fcol[mm & (vb > fv + lh_ * 0.4)] = c[min(tone + 2, 6)]           # the far (lit) edge of each fragment
        fcol[mm & (vb < fv - lh_ * 0.5)] = c[max(tone - 1, 0)]
        frag |= mm
    grit = zone & (hs(u * 0.8, vb * 0.8, seed + 1) > 0.93) & (np.abs(u - BURST_U) < 30 + vb * 0.6)
    fcol[grit] = Gr[2]
    frag |= grit
    # the gutter grate's broken bar lying flat
    bar = (np.abs(u - BURST_U - 30) < 6.5) & (np.abs(vb - 6 - (u - BURST_U - 30) * 0.15) < 0.6)
    fcol[bar] = I[2]
    frag |= bar
    pd = ((u - PU) / 15.0) ** 2 + ((vb - vbl) / 6.0) ** 2
    pool = pd < 1.0
    for f, L in enumerate(floor['frames']):
        a = L.a
        a[..., :3][pool] = Wt[2]
        a[..., :3][pool & (pd > 0.78)] = Wt[4]                       # its rim
        gl = pool & PS.bay(u * s, vb, 0.20) & (pd < 0.7)
        a[..., :3][gl] = S[3]
        rr = random.Random(seed + 10 + f)
        for k in range(6):                                            # rings of the drops, one size per frame
            ru, rv = PU + rr.uniform(-10, 10), vbl + rr.uniform(-3.5, 3.5)
            r = 0.8 + ((f + k) % 3) * 1.1
            d = np.hypot(u - ru, (vb - rv) * 2.2)
            a[..., :3][pool & (np.abs(d - r) < 0.4)] = S[2]
        a[..., :3][frag & ~pool] = fcol[frag & ~pool]


# ---------------------------------------------------------------- things on the walk plane (play sits on them)
def pipe_stub(seed=1):
    """A leaper's pipe stub (spec §3): an old cast-iron riser out of the walkway, a 90° bend and its flanged open
       mouth facing the heroes (left), the mouth's centre 26 px over the walk line (LEAPER.pipeY 150). 0.6 m pipe, at
       the hero's scale. Returns (Layer, ax): ax = the mouth's centre column (the game's pipe x)."""
    w, h = 24, 36
    L = Layer(w, h)
    I, Ru, Sl = SR['castiron'], SR['rust'], SR['slime']
    mx, my = 6.0, h - 26.0                                              # the mouth's centre
    # the riser (a cylinder lit from the upper left)
    xx, yy = grid(10, my + 2, 9, h - my - 2)
    t = np.clip(np.floor(4.6 - (xx - 10) * 0.55 + (hs(xx, yy, seed) > 0.85)), 1, 5).astype(int)
    L.put(10, my + 2, np.array(I, np.uint8)[t], np.ones(xx.shape, bool))
    # the bend: a quarter torus from the riser's top to the mouth (lit on its crown)
    xx, yy = grid(5, my - 6, 14, 12)
    cxb, cyb = 10.0, my + 6.0                                          # the bend's centre
    d = np.hypot(xx - cxb, yy - cyb)
    bend = (d >= 3.0) & (d <= 12.0) & (xx >= cxb - 0.5) & (yy <= cyb)
    ring_t = np.clip(np.floor(5.2 - (yy - (my - 6)) * 0.42 - np.abs(d - 7.5) * 0.25), 1, 6).astype(int)
    L.put(5, my - 6, np.array(I, np.uint8)[ring_t], bend)
    straight = (xx >= 6.5) & (xx < cxb) & (np.abs(yy - my) < 4.5)
    st_t = np.clip(np.floor(4.4 - (yy - (my - 4.5)) * 0.42), 1, 6).astype(int)
    L.put(5, my - 6, np.array(I, np.uint8)[st_t], straight)
    # the collar at the bend and the flange at the floor, with bolts
    L.rect(9.2, my + 4.5, 10.6, 1.5, Ru[3]); L.hl(9.2, my + 4.5, 10.6, Ru[5], t=TH)
    L.rect(8.0, h - 3.0, 13.0, 3.0, I[2]); L.hl(8.0, h - 3.0, 13.0, I[4], t=TH)
    for bx in (9.0, 12.5, 16.0, 19.5):
        L.px(bx, h - 2.0, Ru[4])
    # the mouth: a flange ring seen three-quarters from the left, the dark inside, a slime lip
    L.ellipse(mx, my, 3.4, 7.4, Ru[2])
    L.ellipse(mx - 0.3, my - 0.2, 3.0, 7.0, I[4])
    L.ellipse(mx - 0.1, my, 2.3, 6.0, SR['void'][1])
    L.ellipse(mx + 0.3, my - 0.6, 1.6, 4.8, SR['void'][0])
    L.vl(mx - 3.0, my - 5.0, 9.0, I[6], t=TH)                          # the lit left rim
    for by in (-5.5, 0.0, 5.5):
        L.px(mx - 3.1, my + by, Ru[5])
    L.ellipse(mx - 0.4, my + 5.6, 1.8, 0.9, Sl[3])                     # the slime lip and its drool to the floor
    xx, yy = grid(mx - 3, my + 5, 7, h - my - 5)
    dr = (np.abs(xx - (mx - 1.2) - 0.6 * np.sin(yy * 0.9)) < (0.55 if U > 1 else 0.6)) & (yy < h - 1)
    L.put(mx - 3, my + 5, np.broadcast_to(np.array(Sl[2], np.uint8), xx.shape + (3,)), dr)
    L.ellipse(mx - 0.6, h - 0.8, 3.4, 0.8, Sl[2])
    # rust runs and pitting on the riser
    xx, yy = grid(10, my + 6, 9, h - my - 9)
    rr = (hs(np.floor(xx * 2), yy * 0.2, seed + 3) > 0.82) | (hs(xx, yy, seed + 4) > 0.94)
    L.put(10, my + 6, np.broadcast_to(np.array(Ru[2], np.uint8), xx.shape + (3,)), rr)
    E = Layer(w, h); E.a = L.a.copy(); E.outline(I[0], 'br')
    sh = (E.a[..., :3] == np.array(I[0], np.uint8)).all(-1) & (L.a[..., 3] > 0)
    L.a[..., :3][sh] = I[0]
    return L, mx


def plinth(seed=1, w=48):
    """A spitter's plinth (spec §3, top y 148, 48 px): an old brick sluice pier on the walkway, a granite cap whose
       front edge is the platform line, a low arched culvert at its foot, an iron mooring ring, the tide stain. Hero's
       scale. Returns the Layer (50 x 34; its bottom row on the walk line, the cap's nosing at row 6 = y 148)."""
    W, H = w + 2, 34
    L = Layer(W, H)
    B, Bd, Gr, Sl = SR['sbrick'], SR['sbrick_b'], SR['granite'], SR['slime']
    # the cap's top face (it recedes: 5 px), wet slabs with joints, moss along its back edge
    xx, yy = grid(1, 1, w, 5)
    t = np.clip(4 + (fbm(xx / 5.0, yy, seed, 2) > 0.6) - (yy < 2.0) - ((xx % 12.0) < 0.5) + (yy > 5.0), 1, 6).astype(int)
    L.put(1, 1, np.array(Gr, np.uint8)[t], np.ones(xx.shape, bool))
    mm = (yy < 2.2) & (fbm(xx / 3.0, yy, seed + 1, 2) > 0.55)
    L.put(1, 1, np.broadcast_to(np.array(SR['moss'][3], np.uint8), xx.shape + (3,)), mm)
    L.rect(0, 5.5, W, 1.2, Gr[6])                                      # the nosing: the platform's front edge (y 148)
    L.rect(0, 6.7, W, 2.6, Gr[3]); L.hl(0, 9.0, W, Gr[1], t=TH)        # the cap's front face
    # the brick face
    brickfill(L, 1, 9.3, w, H - 9.3, B, seed + 2, cw=6, chh=2, mid=3, lo=0, hi=6, streaks=True)
    xx, yy = grid(1, 9.3, w, H - 9.3)
    row = np.floor((yy - 9.3) / 1.0)
    fx = ((xx - 1 + (row % 2) * 1.5) / 3.0) % 1.0
    jn = (((yy - 9.3) % 1.0) > (0.70 if U >= 2 else 0.9)) | (fx > (0.86 if U >= 2 else 0.95))
    L.put(1, 9.3, np.broadcast_to(np.array(B[1], np.uint8), xx.shape + (3,)), jn & (hs(xx, yy, seed + 9) > 0.25))
    xx, yy = grid(1, 9.3, w, H - 9.3)
    tide = H - 8 + (vnoise(xx / 5.0, yy * 0, seed + 3) - 0.5) * 3
    low = yy > tide
    lt = np.clip(2 + (fbm(xx / 4.0, yy / 2.0, seed + 4, 2) > 0.55) - (hs(xx, yy, seed + 5) < 0.2), 0, 4)
    L.put(1, 9.3, np.array(Bd, np.uint8)[lt], low)
    sl = (yy > H - 2.5) | ((np.abs(yy - tide) < 0.7) & (hs(xx, yy, seed + 6) > 0.4))
    L.put(1, 9.3, np.array(Sl, np.uint8)[np.clip(2 + (hs(xx, yy, seed + 7) > 0.6), 0, 6)], sl & (yy > tide - 1))
    # the culvert at its foot: a low brick arch, dark inside, a trickle of green-lit water
    cx = W * 0.62
    xx, yy = grid(cx - 7, H - 9, 14, 9)
    d = np.hypot(xx - cx, (yy - (H - 1)) * 1.1)
    arch_r = (d > 5.0) & (d <= 6.6) & (yy < H - 0.5)
    L.put(cx - 7, H - 9, np.array(B, np.uint8)[np.clip(np.where(np.floor(np.arctan2(yy - H, xx - cx) * 6) % 2 == 0, 4, 3), 0, 6)], arch_r)
    ins = (d <= 5.0) & (yy < H - 0.5)
    L.put(cx - 7, H - 9, np.array(SR['void'], np.uint8)[np.clip((1 + (yy > H - 3)).astype(int), 0, 6)], ins)
    L.rect(cx - 1.0, H - 1.5, 2.0, 1.5, Sl[4])
    # the mooring ring and its rust run
    rx, ry = W * 0.22, 16.5
    L.ring(rx, ry + 2.2, 2.0, SR['rust'][3], r_in=1.3)
    L.rect(rx - 0.8, ry - 0.5, 1.6, 1.4, SR['castiron'][2])
    L.vl(rx, ry + 4.4, 7, SR['rust'][1], t=TH)
    # the edges: the dark tone of the brick on the shade side, the wet foot on the walkway
    L.vl(W - 1.2, 9.3, H - 9.3, Bd[0], t=1)
    L.rect(0, H - 0.8, W, 0.8, Bd[0])
    L.vl(1, 9.3, H - 9.3, B[4], t=TH)
    return L


# ---------------------------------------------------------------- the eye carriers in screen space (for the gate)
def carrier_fns(info, burst_eyes):
    """Masks of the eye carriers at a camera (checks_sewers.eyes_in_carriers reads sec.notes['carriers_px']): c's pipe
       mouths and side tunnel on its own far plane (S_W of c, not d's), and the rats' heads on the shaft's walls."""
    cars = list(info['carriers'])

    def fn(cx):
        yy, xx = np.mgrid[0:P(VIEW_H), 0:P(VIEW_W)]
        lx, ly = (xx + 0.5) / U, (yy + 0.5) / U
        car = np.zeros(lx.shape, bool)
        for (kind, pc, cy, r) in cars:
            x = pc - cx * S_W
            if kind == 'pipe':
                car |= np.hypot(lx - x, ly - cy) <= r + 0.6
            else:
                spring = cy + r
                car |= (np.abs(lx - x) <= r) & ((ly >= spring) | (np.hypot(lx - x, ly - spring) <= r)) & (ly < YWALL)
        for (px_, py_) in burst_eyes:
            x = px_ - cx * SB
            car |= (np.abs(lx - x) <= 2.6) & (np.abs(ly - py_) <= 2.0)
        return car
    return [fn]
