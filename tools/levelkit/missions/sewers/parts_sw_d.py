# Painters of section d of mission `sewers` (HET RIOOL, 02:30, 2,816 px; wave P4b, painter D). The section is the
# approved look sample (missions/sewers-look/sw_d.py, V2 BLACK) laid over the game's real layout. The shared sewer
# painters (parts_sewers.py) are used as they are; what had to change is COPIED here and changed (the brief: never
# edit a shared file). The copies and their one change each:
#
#   far_wall_d      far_wall with (kind, variant) bays: more variants of a bay (pipes x3, manhole x3, outfall x2,
#                   plain x4: the bricked-up arch, a sluice wheel, a root crack with lime bloom, a date stone), so 30
#                   bays over 2,816 px show no repeat you can see
#   vault_px_d      vault_px: the cracks with roots spread over the whole section (W), not over the first 1,450 px
#   vault_layer_d   vault_layer, calling vault_px_d with the section width
#   water_px_d      water_px: the drip rings spread over the whole section (W), not over -200 .. 1,500
#   lost_things_d   lost_things with the list of lost things as a parameter (not the sample's LOST of 1,280 px)
#   walkway_px_d    walkway_px: the drain slots and the flat wipes over the whole section; the wipe stream of the
#                   sewer worker (fx['stream']); the fatberg's walkway shade only when fx asks (the game's entity)
#   channel_layers_d channel_layers, calling the three above with the section width and fx['lost']
#   fat_body        fatberg with a free silhouette (a lobe, a cap), rat holes at fixed places (the game's spawn
#                   points), crack stages and a hidden gold record (the game's frames)
#
# New parts: plinth (the spitters' brick piers, cap at y 148), riser (the leapers' pipe stubs, mouth at y 149),
# standpipe (the secret's carrier, rim at y 148), scooter_sunk, fg_cone, fg_sandbags, the slump frames.
import math
import random
import numpy as np
from level import *
from parts4 import tint
from parts_sewers import *
from parts_sewers import _blur

# the digits the kit's font lacks (3 x 5), for a date stone and the section plates
DIGITS = {'0': ["111", "101", "101", "101", "111"], '1': ["010", "110", "010", "010", "111"],
          '2': ["111", "001", "111", "100", "111"], '3': ["111", "001", "011", "001", "111"],
          '4': ["101", "101", "111", "001", "001"], '7': ["111", "001", "010", "010", "010"],
          '8': ["111", "101", "111", "101", "111"], '9': ["111", "101", "111", "001", "111"]}


def digits(L, x, y, t, c):
    for ch in t:
        for j, row in enumerate(DIGITS[ch]):
            for i, v in enumerate(row):
                if v == '1':
                    L.px(x + i, y + j, c)
        x += 4


# ---------------------------------------------------------------- new bay contents of the far wall (plane S_W)
def sluice(F, xc, seed):
    """A sluice gate in the bay: an iron gate plate low in the wall between two guide rails, the spindle up to a
       handwheel, rust runs under it."""
    I, Ru = SR['castiron'], SR['rust']
    F.vl(xc - 9, 94, 36, Ru[2], t=1); F.vl(xc + 8, 94, 36, Ru[2], t=1)
    F.vl(xc - 9, 94, 36, Ru[4], t=TH); F.vl(xc + 8, 94, 36, Ru[3], t=TH)
    F.rect(xc - 8, 114, 16, 17, I[2])
    F.hl(xc - 8, 114, 16, I[4], t=TH)
    F.hl(xc - 8, 130.5, 16, I[0], t=TH)
    for yy_ in (116.5, 128.5):
        for xx_ in np.arange(xc - 6.5, xc + 7, 3.0):
            F.px(xx_, yy_, I[4])
    F.hl(xc - 7, 122, 14, I[1], t=TH)
    F.rect(xc - 10, 94, 20, 2, Ru[2]); F.hl(xc - 10, 94, 20, Ru[4], t=TH)        # the yoke
    F.vl(xc - 0.5, 88, 26, Ru[3], t=1); F.vl(xc - 0.5, 88, 26, Ru[5], t=TH)     # the spindle
    F.ring(xc, 88, 6.0, I[3], r_in=4.8)                                           # the handwheel
    F.ring(xc, 88, 5.5, I[5], r_in=5.0) if U >= 2 else None
    for a in range(0, 360, 60):
        F.line(xc, 88, xc + 5 * math.cos(math.radians(a)), 88 + 5 * math.sin(math.radians(a)), I[2], t=TH)
    F.ellipse(xc, 88, 1.2, 1.2, Ru[4])
    xx, yy = grid(xc - 10, 96, 20, 36)
    run = (hs(xx * 0.4, yy * 0.2, seed) > 0.72) & ((np.abs(xx - xc + 9) < 0.8) | (np.abs(xx - xc - 8) < 0.8) | (yy > 130))
    F.put(xc - 10, 96, np.broadcast_to(np.array(Ru[1], np.uint8), xx.shape + (3,)), run)


def root_crack(F, xc, seed, B):
    """A crack down the bay from the cornice, roots hanging out of it, lime bloom (calcite) spreading under it."""
    rng = random.Random(seed)
    C, Wd, Bd = SR['calc'], SR['wood'], SR['sbrick_b']
    x, y = xc - 12 + rng.uniform(-3, 3), YSPRING + 3
    pts = [(x, y)]
    while y < 124:
        y += rng.uniform(3, 6)
        x += rng.uniform(-2.5, 3.5)
        pts.append((x, y))
    # the lime bloom: thin pale streaks of calcite running down from the crack (the brick shows between them)
    mx, my = pts[len(pts) // 2]
    xx, yy = grid(mx - 9, my, 18, YWALL - my - 2)
    wob = (vnoise(yy / 5.0, xx * 0, seed + 1) - 0.5) * 2
    lane = np.floor((xx - mx + 9 + wob) / 1.6)
    ln = (0.35 + 0.65 * hash01(lane, lane * 0, seed + 2)) * (YWALL - my - 4) * (1 - np.abs(xx - mx) / 10.0)
    bloom = (yy - my < ln) & (hash01(lane, lane * 0 + 1, seed + 3) > 0.55) & (np.abs(xx - mx) < 6)
    bloom &= (yy - my < ln - 2) | chk(xx, yy)
    v = F.view(mx - 9, my, 18, YWALL - my - 2)
    if v.shape[:2] == xx.shape:
        m = bloom & (v[..., 3] > 0)
        px = v[..., :3][m].astype(float)
        v[..., :3][m] = snap5(px + (np.array(C[3], float) - px) * 0.26)
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        F.line(x0 + 1.0, y0, x1 + 1.0, y1, B[5], t=TH)                       # the lit lip of the crack
        F.line(x0, y0, x1, y1, Bd[0], t=1.5)
        F.line(x0 + 0.25, y0, x1 + 0.25, y1, SR['void'][0], t=TH)
    for (x0, y0) in pts[:4]:                                                   # roots out of the upper crack
        for k in range(2):
            ln = rng.uniform(7, 18)
            dx = rng.uniform(-3, 3)
            F.line(x0, y0, x0 + dx * 0.5, y0 + ln * 0.5, Wd[2 + k], t=TH if U > 1 else 1)
            F.line(x0 + dx * 0.5, y0 + ln * 0.5, x0 + dx, y0 + ln, Wd[3 + k], t=TH)
            F.px(x0 + dx, y0 + ln, Wd[4])
    for (x0, y0) in pts[1::2]:
        F.vl(x0, y0, rng.randint(2, 5), C[6], t=TH)                            # calcite drips


def date_stone(F, xc, year, seed):
    """A granite date stone set in the brick (the year the vault was built), moss on its top."""
    S = SR['granite']
    F.rect(xc - 11, 86, 22, 10, S[3])
    F.hl(xc - 11, 86, 22, S[5], t=1)
    F.hl(xc - 11, 95, 22, S[1], t=TH)
    F.vl(xc + 10.5, 86, 10, S[1], t=TH)
    digits(F, xc - 8, 88.5, year, S[1])
    xx, yy = grid(xc - 12, 84, 24, 3)
    mm = fbm(xx / 3.0, yy, seed, 2) > 0.5
    F.put(xc - 12, 84, np.array(SR['moss'], np.uint8)[np.clip(3 + (hs(xx, yy, seed) > 0.6), 0, 6)], mm)


def plate_num(F, x, y, t):
    """A small blue enamel plate with the number of the sewer stretch."""
    E, Wt = SR['enamel'], SR['white']
    F.rect(x, y, 11, 8, E[1]); F.rect(x + 0.5, y + 0.5, 10, 7, E[3])
    F.hl(x + 0.5, y + 0.5, 10, E[4], t=TH)
    digits(F, x + 2, y + 1.5, t, Wt[5])
    F.vl(x + 1, y + 8, 4, SR['rust'][1], t=TH)


# ---------------------------------------------------------------- the walk plane: plinths, risers, the standpipe
def plinth(seed):
    """A spitter's plinth (48 x 28, the cap's top at the part's row 0 = y 148): a brick pier with a granite cap, the
       brick blackened and slimed toward its foot, iron anchor bolts in the cap, moss on the cap's edge."""
    w, h = 48, 28
    L = Layer(w, h)
    B, Bd, Gr, Sl = SR['sbrick'], SR['sbrick_b'], SR['granite'], SR['slime']
    brickfill(L, 1, 4, w - 2, h - 4, B, seed, mid=3, lo=1, hi=5, streaks=True)
    xx, yy = grid(1, 4, w - 2, h - 4)
    low = yy > h - 9 + (vnoise(xx / 4.0, yy * 0, seed + 1) - 0.5) * 3
    L.put(1, 4, np.array(Bd, np.uint8)[np.clip(2 + (hs(xx, yy, seed + 2) > 0.6) - (yy > h - 2), 0, 6)], low)
    sl = low & (fbm(xx / 3.0, yy / 2.0, seed + 3, 2) > 0.58)
    L.put(1, 4, np.array(Sl, np.uint8)[np.clip(2 + (hs(xx, yy, seed + 4) > 0.7), 0, 6)], sl)
    L.vl(1, 4, h - 4, B[5], t=TH)                                              # lit left arris
    L.vl(w - 1 - TH, 4, h - 4, B[1], t=TH)                                     # the right side in shade
    L.hl(1, 4, w - 2, B[0], t=TH)                                              # the cap's shade on the brick
    # the cap: a granite slab, its top a lit line (the platform's line), its front face, a drip groove under it
    L.rect(0, 0, w, 4, Gr[4])
    L.hl(0, 0, w, Gr[6], t=1)
    L.hl(0, 3, w, Gr[2], t=1)
    L.hl(0, 3.5, w, Gr[1], t=TH)
    xx, yy = grid(0, 1, w, 2)
    st = (fbm(xx / 5.0, yy, seed + 5, 2) > 0.6)
    L.put(0, 1, np.broadcast_to(np.array(Gr[3], np.uint8), xx.shape + (3,)), st)
    for bx in (7, w - 8):                                                      # anchor bolts of old gear
        L.rect(bx, 0.5, 2, 1.5, SR['rust'][3]); L.px(bx, 0.5, SR['rust'][5])
        L.vl(bx + 0.5, 2, 6, SR['rust'][1], t=TH)
    xx, yy = grid(0, 2, w, 2)
    mm = (fbm(xx / 4.0, yy, seed + 6, 2) > 0.62) & (yy > 2.5)
    L.put(0, 2, np.array(SR['moss'], np.uint8)[np.clip(3 + (hs(xx, yy, seed + 7) > 0.6), 0, 6)], mm)
    return L


def _tube(L, path, r, light=(-0.45, -0.85), ramp_=None, seed=0):
    """A round pipe along a polyline `path` (part px), radius r, shaded as a cylinder lit from `light`: each pixel's
       normal is its offset from the nearest point of the centre line."""
    I = np.array(ramp_ or SR['castiron'], np.uint8)
    xs = [p[0] for p in path]; ys = [p[1] for p in path]
    x0, y0 = min(xs) - r - 1, min(ys) - r - 1
    xx, yy = grid(x0, y0, max(xs) - x0 + r + 2, max(ys) - y0 + r + 2)
    best = np.full(xx.shape, 1e9); nx = np.zeros(xx.shape); ny = np.zeros(xx.shape)
    for (ax, ay), (bx, by) in zip(path, path[1:]):
        dx, dy = bx - ax, by - ay
        ll = max(dx * dx + dy * dy, 1e-9)
        t = np.clip(((xx - ax) * dx + (yy - ay) * dy) / ll, 0, 1)
        px_, py_ = ax + t * dx, ay + t * dy
        d = np.hypot(xx - px_, yy - py_)
        m = d < best
        best = np.where(m, d, best)
        nx = np.where(m, (xx - px_) / r, nx); ny = np.where(m, (yy - py_) / r, ny)
    inside = best <= r
    lx, ly = light                                                             # the direction toward the light
    dot = nx * lx + ny * ly
    t = np.clip(np.round(3 + 2.4 * dot + 0.4 * (hs(xx, yy, seed) > 0.8)), 0, 6).astype(int)
    t = np.where(best > r - 0.7, np.minimum(t, 1), t)                         # the dark contour
    L.put(x0, y0, I[t], inside)
    return inside, (x0, y0, xx, yy, nx, ny, best)


def riser(seed):
    """A leaper's pipe stub: a cast-iron storm riser up from the walkway with a flanged elbow turned toward the
       heroes (left); its open mouth (part px (4, 17)) is the leaper's lurk. Part 32 x 44, standing on its foot plate."""
    w, h = 32, 44
    L = Layer(w, h)
    I, Ru, Sl, V = SR['castiron'], SR['rust'], SR['slime'], SR['void']
    rng = random.Random(seed)
    path = [(21, h - 2), (21, 25), (20.2, 21.5), (17.5, 18.6), (14, 17), (5, 17)]
    _tube(L, path, 6.2, seed=seed)
    # flanges: a collar on the riser and one at the elbow, a lip ring at the mouth
    for (cx_, cy_, rx_, ry_) in ((21, 31, 7.4, 1.3), (21, 24, 7.2, 1.1)):
        L.rect(cx_ - rx_, cy_ - ry_, 2 * rx_, 2 * ry_, I[2]); L.hl(cx_ - rx_, cy_ - ry_, 2 * rx_, I[4], t=TH)
        for bx in np.arange(cx_ - rx_ + 1, cx_ + rx_, 3.0):
            L.px(bx, cy_ - 0.5, Ru[4])
    L.rect(9.5, 10, 1.8, 14, I[2]); L.vl(9.5, 10, 14, I[4], t=TH)              # the elbow's flange (side on)
    # rust: runs down the riser from the collars, a rust bloom on the elbow
    xx, yy = grid(14, 25, 14, h - 27)
    run = (hs(xx * 0.5, yy * 0.15, seed + 1) > 0.70) & (np.abs(xx - 21) < 6)
    L.put(14, 25, np.broadcast_to(np.array(Ru[2], np.uint8), xx.shape + (3,)), run & (L.view(14, 25, 14, h - 27)[..., 3] > 0))
    xx, yy = grid(8, 10, 16, 16)
    bl = (fbm(xx / 3.0, yy / 3.0, seed + 2, 2) > 0.62)
    v = L.view(8, 10, 16, 16)
    if v.shape[:2] == xx.shape:
        m = bl & (v[..., 3] > 0)
        v[..., :3][m] = np.array(Ru, np.uint8)[np.clip(2 + (hs(xx, yy, seed + 3) > 0.6), 0, 6)][m]
    # the mouth: the lip (a flange ring seen three-quarter on), the dark inside, a lit lower lip, slime drooling
    L.ellipse(4.5, 17, 3.6, 7.2, I[3])
    L.ellipse(4.0, 17, 3.0, 6.6, I[5])
    L.ellipse(4.2, 17.2, 2.5, 5.8, V[0])
    L.ellipse(4.8, 18.6, 1.6, 3.6, V[1])
    L.hl(2.5, 22.6, 3, V[3], t=TH)
    for k in range(3):
        sx = 2.4 + k * 1.3
        ln = rng.uniform(4, 14)
        L.vl(sx, 23, ln, Sl[3 - (k % 2)], t=TH if U > 1 else 1)
        L.px(sx, 23 + ln, Sl[5])
    L.rect(1.5, 22.5, 5, 1.2, Sl[3])
    # the foot plate on the walkway with bolts
    L.rect(13, h - 3, 16, 3, I[2]); L.hl(13, h - 3, 16, I[4], t=TH); L.hl(13, h - 0.5, 16, I[0], t=TH)
    for bx in (14.5, 26.5):
        L.px(bx, h - 2, Ru[4])
    return L


def standpipe(seed):
    """The secret's carrier: a wide cast-iron overflow standpipe, 1.8 m round, its open rim at the part's row 2
       (y 148 on the walk plane) where the small fatberg wells up; grease runs down its sides, slime at its foot.
       Part 30 x 30."""
    w, h = 30, 30
    L = Layer(w, h)
    I, Ru, Sl, Gs = SR['castiron'], SR['rust'], SR['slime'], SR['grease']
    _tube(L, [(15, 4), (15, h - 1)], 11.5, seed=seed)
    L.rect(2.5, 2, 25, 3.2, I[3]); L.hl(2.5, 2, 25, I[5], t=TH); L.hl(2.5, 4.8, 25, I[1], t=TH)    # the rim collar
    L.rect(2.5, 15, 25, 2, I[2]); L.hl(2.5, 15, 25, I[4], t=TH)                                    # a joint collar
    for bx in np.arange(4.5, 26, 4.0):
        L.px(bx, 3.2, Ru[4]); L.px(bx, 15.6, Ru[3])
    rng = random.Random(seed)
    for k in range(7):                                                                              # grease runs
        sx = rng.uniform(5, 25)
        ln = rng.uniform(3, 16)
        L.vl(sx, 5, ln, Gs[3 + (k % 2)], t=TH if U > 1 else 1)
        L.px(sx, 5 + ln, Gs[5])
    xx, yy = grid(3, h - 7, 24, 7)
    sl = fbm(xx / 3.0, yy / 2.0, seed + 1, 2) > 0.5
    L.put(3, h - 7, np.array(Sl, np.uint8)[np.clip(2 + (hs(xx, yy, seed + 2) > 0.6), 0, 6)], sl & (L.view(3, h - 7, 24, 7)[..., 3] > 0))
    L.rect(1.5, h - 2, 27, 2, I[1]); L.hl(1.5, h - 2, 27, I[3], t=TH)                             # the foot ring
    return L


def scooter_sunk(rng):
    """An e-scooter in the channel: the stem and the handlebar out of the water, the deck's tail edge awash."""
    L = Layer(26, 16)
    I, Ru = SR['castiron'], SR['rust']
    L.line(8, 15, 13, 2, I[3], t=1.2)
    L.line(8.6, 15, 13.6, 2, I[5], t=TH)
    L.hl(9, 2, 10, I[1], t=1)
    L.rect(8, 1.5, 2.5, 1.5, SR['black'][1]); L.rect(17.5, 1.5, 2.5, 1.5, SR['black'][1])
    L.rect(12, 4.5, 2, 1.4, SR['white'][3])                                    # the dead lamp
    L.rect(14, 14.5, 12, 1.5, I[2])                                            # the deck awash
    L.rect(0, 15, 26, 1, SR['slime'][2]); L.hl(2, 15, 22, SR['slime'][4], t=TH)
    L.px(10, 9, Ru[3])
    return L


def fg_cone(rng):
    """A works cone on its side (sewer workers' gear), low at the lower edge."""
    L = Layer(34, 14)
    R_ = SR['red']
    L.poly([(2, 7), (28, 1), (30, 13), (2, 9)], R_[3])
    L.poly([(12, 5.5), (18, 4.2), (19.5, 10.6), (12, 9.2)], SR['white'][5])
    L.rect(28, 0, 5, 14, SR['black'][1])
    L.line(2, 7, 28, 1, R_[5], t=1)
    return L


def fg_sandbags(rng):
    """Three wet sandbags, one on two."""
    L = Layer(52, 20)
    S = SR['wood']
    for (cx, cy, rx, ry) in ((13, 15, 12, 5), (37, 15, 12, 5), (25, 8, 12, 5)):
        L.ellipse(cx, cy, rx, ry, S[2])
        L.ellipse(cx - 1, cy - 1.5, rx - 2, ry - 2.5, S[3])
        L.hl(cx - rx + 3, cy + ry - 1.5, 2 * rx - 6, S[1], t=1)
    return L


# ---------------------------------------------------------------- the fatberg as the game's entity frames
SR['gold'] = ramp(7, .26, .94, .050, .140, .120, 60, 92)


def fat_body(w, h, seed=3, shape='lobe', holes=(), eye=None, stage=0, things=None, record=None):
    """A fatberg painting of the game's size (parts_sewers.fatberg with a free silhouette): 'lobe' (the big one's front
       on the walkway: a rounded mound, its lumpy left face holding the rat holes), 'cap' (the secret: grease welling
       up out of a standpipe and mushrooming over its rim). holes = [(cx, cy, rx, ry)] in part px (the game's spawn
       points); stage 0..3 the crack stages; record = (cx, cy, glint) a gold record half under the grease.
       Returns (Layer, holes)."""
    rng = random.Random(seed)
    L = Layer(w, h)
    xx, yy = grid(0, 0, w, h)
    tn = yy / h
    if shape == 'lobe':
        # a dome peaking left of the middle; the left face in three bulges, one round each rat hole; the right
        # side a sloping shoulder into the mass behind and a belly tucked in above the foot
        top = 6 + h * 0.16 * ((xx - w * 0.45) / (w * 0.55)) ** 2 + (fbm(xx / 9.0, xx * 0, seed + 41, 2) - 0.5) * 6
        near = np.full(yy.shape, 99.0)
        for (hx_, hy_, rx_, ry_) in holes:
            near = np.minimum(near, np.abs(yy - hy_))
        xl = 1.0 + 5.5 * (1 - np.exp(-(near / 10.0) ** 2)) + (fbm(yy / 5.0, yy * 0, seed + 42, 2) - 0.5) * 2.0 \
            + 6 * np.clip((top + 10 - yy) / 10, 0, 1)
        xr = w - 1.5 - 34 * np.clip((h * 0.72 - yy) / (h * 0.72), 0, 1) ** 1.3 \
            - (fbm(yy / 8.0, yy * 0 + 3, seed + 43, 2) - 0.5) * 4.0 - 6 * np.clip((yy - h * 0.80) / (h * 0.20), 0, 1) ** 1.5
        inside = (yy > top) & (xx > xl) & (xx < xr) & (yy < h - 0.5)
    else:   # 'cap'
        neck = 11.5
        rise = np.clip((h - yy) / h, 0, 1)
        half = neck + 8.5 * np.sin(np.pi * np.clip(rise * 1.05, 0, 1)) ** 0.8 + (fbm(yy / 4.0, yy * 0, seed + 44, 2) - 0.5) * 3
        top = 3 + 6 * ((xx - w / 2.0) / (w / 2.0)) ** 2 + (fbm(xx / 5.0, xx * 0, seed + 45, 2) - 0.5) * 3
        inside = (np.abs(xx - w / 2.0) < half) & (yy > top) & (yy < h - 2.5)
    # ---- volume (as parts_sewers.fatberg)
    D = _blur(inside.astype(float), (9 if shape == 'lobe' else 4) * U)
    big = fbm(xx / 22.0, yy / 30.0 - xx / 120.0, seed + 3, 3)
    Hh = 16 * D ** 0.7 + 16 * big + 3.0 * fbm(xx / 7.0, yy / 6.0, seed + 4, 3) + 0.9 * fbm(xx / 1.7, yy / 1.7, seed + 5, 2)
    gy, gx = grad(Hh)
    nx, ny, nz = -gx, -gy, np.full_like(Hh, 1.3)
    ln = np.sqrt(nx * nx + ny * ny + nz * nz)
    lx, ly_, lz = -0.30, -0.86, 0.42
    shade = (nx * lx + ny * ly_ + nz * lz) / ln
    under = np.clip(ny / ln, 0, 1)
    ao = np.clip((tn - 0.84) / 0.16, 0, 1) * 0.30 + np.clip(0.35 - D, 0, 1) * 0.5
    v = 0.48 + 0.48 * shade - 0.35 * under - ao
    sag = 22 * fbm(xx / 60.0, yy / 50.0, seed + 6, 3) + 8 * np.sin(np.pi * np.clip(xx / w, 0, 1)) + 6 * big
    bnd = (yy + sag) / (11.0 if shape == 'lobe' else 6.0)
    bnd = bnd + 0.9 * fbm(xx / 18.0, yy / 9.0, seed + 11, 2)
    k = np.floor(bnd)
    fr = bnd - k
    fresh = (hash01(k, k * 0 + 3, seed + 7) > 0.55) ^ (fbm(xx / 26.0, yy / 20.0, seed + 12, 2) > 0.66)
    tone = np.clip(np.floor(v * 6 + 0.5), 0, 6).astype(int)
    tone = np.where(fresh, np.minimum(tone + 1, 6), tone)
    tone = np.where(fr < 0.06, tone - 2, np.where((fr < 0.11) & (shade > 0.1), tone + 1, tone))
    tone = np.clip(tone, 0, 6)
    Gs, Gg = np.array(SR['grease'], np.uint8), np.array(SR['fatgrey'], np.uint8)
    rgb = np.where(fresh[..., None], Gs[tone], Gg[tone])
    crev = (fbm(xx / 7.0, yy / 6.0, seed + 4, 3) < 0.25) & (D > 0.3)
    rgb[crev] = Gg[1]
    pit = (fbm(xx / 1.7, yy / 1.7, seed + 5, 2) < 0.24) & (hs(xx, yy, seed + 8) > 0.55)
    rgb[pit] = np.where(fresh[..., None], Gs[np.clip(tone - 2, 0, 6)], Gg[np.clip(tone - 2, 0, 6)])[pit]
    Wp = np.array(SR['wipe'], np.uint8)
    pm = fbm(xx / 12.0, yy / 9.0, seed + 30, 3) > 0.64
    a = fbm(xx / 40.0, yy / 40.0, seed + 31, 2) * np.pi * 3
    ca, sa = np.cos(a), np.sin(a)
    f = fbm((xx * ca + yy * sa) / 0.7, (-xx * sa + yy * ca) / 5.0, seed + 32, 2)
    wt = 2 + (f > 0.55) + (f > 0.70) - (f < 0.32) + np.round(shade * 1.2).astype(int) - (under > 0.4)
    over = fbm(xx / 2.5, yy / 2.5, seed + 33, 2) > 0.66
    wm = pm & inside & ~over & (D > 0.25)
    rgb[wm] = Wp[np.clip(wt, 1, 4)][wm]
    fib = wm & (np.abs(f - 0.5) < 0.025)
    rgb[fib] = Gg[2]
    spec = inside & (shade > 0.55) & (fbm(xx / 1.7, yy / 1.7, seed + 5, 2) > 0.62) & (hs(xx, yy, seed + 9) > 0.45)
    spec |= inside & (fr >= 0.09) & (fr < 0.12) & (shade > 0.35) & (hs(xx * 0.5, yy, seed + 10) > 0.55)
    rgb[spec] = SR['white'][6]
    for i in range(int(w * h / 520)):
        x0, y0 = rng.uniform(2, w - 2), rng.uniform(2, h * 0.9)
        j0, i0 = min(P(y0), inside.shape[0] - 1), min(P(x0), inside.shape[1] - 1)
        if not inside[j0, i0]:
            continue
        ln_ = rng.uniform(2, 8)
        run = (np.abs(xx - x0 - (yy - y0) * 0.04) < (0.5 if U > 1 else 0.6)) & (yy >= y0) & (yy < y0 + ln_) & inside
        rgb[run] = Gs[5]
        rgb[run & (np.abs(yy - y0 - ln_ + 0.6) < 0.6)] = Gs[6]
    alpha = inside.copy()
    for i in range(int(w / 4.0)):
        x0 = rng.uniform(1, w - 1)
        col = inside[:, min(P(x0), inside.shape[1] - 1)]
        edges = np.where(col[:-1] & ~col[1:])[0]
        edges = edges[edges / U < h - 3]
        if not len(edges):
            continue
        yb = edges[0] / U
        ln_ = min(rng.uniform(3, 12), h - 1 - yb)
        sx = x0 + rng.uniform(-1, 1)
        m = (np.abs(xx - (x0 + (sx - x0) * (yy - yb) / max(ln_, 1))) < (0.45 if U > 1 else 0.5)) & (yy > yb) & (yy < yb + ln_)
        blob = ((xx - sx) ** 2 + (yy - yb - ln_) ** 2) < (0.8 + rng.uniform(0, 0.6)) ** 2
        tt = np.clip(2 + np.round((yy - yb) / max(ln_, 1) * 2).astype(int), 0, 6)
        rgb[m] = Gs[tt][m]
        rgb[blob] = Gs[5]
        rgb[blob & (yy < yb + ln_ - 0.3) & (xx < sx)] = SR['white'][6]
        alpha |= m | blob
    L.a[..., :3] = rgb
    L.a[..., 3] = np.where(alpha, 255, 0)
    E = Layer(w, h); E.a[..., 3] = np.where(inside, 255, 0)
    E.outline(Gg[0], 'br')
    em = (E.a[..., 3] > 0) & np.all(E.a[..., :3] == Gg[0], axis=-1) & inside & (under > 0.05)
    L.a[..., :3][em] = Gg[0]

    def bury(O):
        m = (O.a[..., 3] > 0) & inside & ~(fbm(xx / 1.4, yy / 1.4, seed + 50, 2) > 0.70)
        L.a[..., :3][m] = O.a[..., :3][m]

    def spot(margin=8):
        for _ in range(200):
            x0, y0 = rng.uniform(margin, w - margin), rng.uniform(margin, h - margin)
            if D[min(P(y0), D.shape[0] - 1), min(P(x0), D.shape[1] - 1)] > 0.8:
                return x0, y0
        return w * 0.6, h * 0.5
    for th_ in (things if things is not None else ['bud', 'bud', 'brush', 'duck', 'phone', 'sock']):
        O = Layer(w, h)
        x0, y0 = spot()
        a_ = rng.uniform(-0.7, 0.7)
        ca_, sa_ = math.cos(a_), math.sin(a_)
        if th_ == 'bud':
            for kk in np.arange(-3.5, 3.51, 0.5 / U):
                O.px(x0 + kk * ca_, y0 + kk * sa_, SR['white'][6])
            for e in (-3.8, 3.8):
                O.ellipse(x0 + e * ca_, y0 + e * sa_, 1.0, 1.0, SR['white'][5])
        elif th_ == 'brush':
            O.line(x0 - 6 * ca_, y0 - 6 * sa_, x0 + 4 * ca_, y0 + 4 * sa_, SR['green'][4], t=1.4)
            O.line(x0 - 6 * ca_, y0 - 6 * sa_ - 0.5, x0 + 4 * ca_, y0 + 4 * sa_ - 0.5, SR['green'][5], t=0.5)
            for kk in np.arange(4.5, 8.0, 0.5 / U):
                O.line(x0 + kk * ca_, y0 + kk * sa_, x0 + kk * ca_ + 1.6 * sa_, y0 + kk * sa_ - 1.6 * ca_, SR['white'][6], t=0.5)
        elif th_ == 'duck':
            O.ellipse(x0, y0, 4.2, 3.0, SR['yellow'][4])
            O.ellipse(x0 - 0.8, y0 - 0.8, 3.0, 1.6, SR['yellow'][5])
            O.ellipse(x0 + 2.6, y0 - 3.2, 2.0, 2.0, SR['yellow'][4])
            O.ellipse(x0 + 2.2, y0 - 3.7, 1.0, 0.8, SR['yellow'][6])
            O.rect(x0 + 4.4, y0 - 3.4, 1.8, 1.0, SR['yellow'][2])
            O.px(x0 + 2.8, y0 - 3.6, SR['black'][0])
        elif th_ == 'phone':
            O.poly([(x0 - 2.5, y0 - 4), (x0 + 2.5, y0 - 4.6), (x0 + 3.1, y0 + 4), (x0 - 1.9, y0 + 4.6)], SR['castiron'][1])
            O.poly([(x0 - 1.8, y0 - 3.2), (x0 + 1.9, y0 - 3.7), (x0 + 2.3, y0 + 3.2), (x0 - 1.3, y0 + 3.7)], SR['glass'][2])
            O.line(x0 - 1.2, y0 - 2.5, x0 + 1.6, y0 + 2.6, SR['glass'][6], t=0.5)
        elif th_ == 'sock':
            for kk in range(6):
                O.rect(x0 - 2 + 0.2 * kk, y0 - 5 + kk * 1.3, 3.4, 1.3, SR['white'][4] if kk % 2 else SR['blue'][3])
            O.ellipse(x0 + 2.4, y0 + 3.4, 2.6, 1.6, SR['blue'][3])
        bury(O)
    # ---- the hidden gold record (the secret): a disc edge under the grease, its grooves; the glint frame
    if record is not None:
        rx_, ry_, glint = record
        Gd = SR['gold']
        d = np.hypot(xx - rx_, (yy - ry_) * 1.25)
        disc = (d < 6.0) & inside & ~(fbm(xx / 1.6, yy / 1.6, seed + 60, 2) > 0.62) & (xx > rx_ - 1)
        gt = np.clip(3 + np.round(np.cos((d * 2.2)) * 1.0) + ((yy - ry_) < -2) - ((yy - ry_) > 2), 1, 6).astype(int)
        L.a[..., :3][disc] = np.array(Gd, np.uint8)[gt][disc]
        L.a[..., :3][inside & (d < 1.1)] = Gd[1]
        if glint:
            L.rect(rx_ + 2.5, ry_ - 6.5, 1, 7, (255, 255, 255)); L.rect(rx_ - 0.5, ry_ - 3.5, 7, 1, (255, 255, 255))
    # ---- crack stages: rifts from the top down, dark inside, a lit lip on one side
    crk = random.Random(seed + 70)
    starts = [(w * (0.30 + 0.50 * crk.random()), 6 + crk.uniform(0, h * 0.35), 1.0) for kk in range(stage + (stage >= 3))]
    while starts:
        x, y, wd = starts.pop(0)
        n = int((5 + 3 * stage) * wd)
        for i in range(n):
            x1, y1 = x + crk.uniform(-2.5, 2.5), y + crk.uniform(2.5, 4.5)
            if not inside[min(P(y1), inside.shape[0] - 1), min(P(max(x1, 0)), inside.shape[1] - 1)]:
                break
            t_ = (1.0 if (stage >= 2 and wd >= 1) else 0.5) if U > 1 else 1
            L.line(x + t_, y + 0.5, x1 + t_, y1 + 0.5, Gs[5], t=0.5 if U > 1 else 1)          # the lit lower lip
            L.line(x, y, x1, y1, Gg[0], t=t_)
            if stage >= 3 and wd >= 1 and U > 1:
                L.line(x + 0.25, y, x1 + 0.25, y1, SR['void'][0], t=0.5)
            x, y = x1, y1
            if wd >= 1 and i > 1 and crk.random() < 0.10 * stage:                                # a branch
                starts.append((x, y, 0.5))
    # ---- rat holes at the game's spawn points: a dark cavity, a crusted rim above, a lit lip below, red eyes
    out = []
    for (cx, cy, rx, ry) in holes:
        d = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2
        hole = d < 1
        Vd = SR['void']
        ht = np.clip(np.floor(1 + (yy - cy) / ry * 1.2 + 0.3 * (hs(xx, yy, seed + 60) > 0.6)), 0, 3).astype(int)
        L.a[..., :3][hole] = np.array(Vd, np.uint8)[ht][hole]
        L.a[..., 3][hole] = 255
        rim = (d >= 1) & (d < 1.9) & (yy < cy) & inside
        L.a[..., :3][rim] = Gg[1]
        lip = (d >= 1) & (d < 1.7) & (yy > cy + ry * 0.4) & inside
        L.a[..., :3][lip] = Gs[5]
        if eye is not None:
            for dx in (-1.1, 1.1):
                L.rect(cx + dx - 0.5, cy + 0.2 - 0.5, 1, 1, eye[1])
                if U >= 2:
                    L.rect(cx + dx - 0.5, cy + 0.2 - 0.5, 0.5, 0.5, eye[0])
        out.append((cx, cy, rx, ry))
    return L, out


def slump(P0, k, bw, bh, slick_w):
    """Slump frame k (0..5) of a fatberg painting P0 in a box bw x bh (feet at the bottom middle): the mass sags lower
       and wider (nearest-neighbour resample of the intact painting); frame 5 is the slick that stays (slick_w wide)."""
    out = Layer(bw, bh)
    if k >= 5:
        nh, nw = max(3.0, P0.h * 0.08), float(slick_w)
    else:
        sg = 0.16 * (k + 1)
        nh, nw = P0.h * (1 - sg), min(bw - 1.0, P0.w * (1 + sg * 0.55))
    ph, pw = max(1, P(nh)), max(1, P(nw))
    yi = np.clip((np.arange(ph) + 0.5) * P0.ph / ph, 0, P0.ph - 1).astype(int)
    xi = np.clip((np.arange(pw) + 0.5) * P0.pw / pw, 0, P0.pw - 1).astype(int)
    a = P0.a[yi][:, xi]
    x0, y0 = P(bw / 2.0 - nw / 2.0), out.ph - ph
    out.a[y0:y0 + ph, x0:x0 + pw] = a
    # the sagging top catches a glossy line (paint P0 without eyes: the rats have left)
    m = out.a[..., 3] > 0
    top = m & ~np.vstack([np.zeros((1, m.shape[1]), bool), m[:-1]])
    out.a[..., :3][top] = SR['grease'][5]
    return out


# ---------------------------------------------------------------- the copies of the shared painters (see the head)
def far_wall_d(sec, H, bays, seed=11):
    """The far plane (speed S_W): the wall, its bays, the cornice, the far walkway. Daylight colours; returns the
       layer (not yet graded) and the info of everything the light pass and the other layers need."""
    WF = sec.lw(S_W)
    F = Layer(WF, VIEW_H)
    B, Bd = SR['sbrick'], SR['sbrick_b']
    info = dict(eyes=[], carriers=[], pours=[], mshafts=[], grates_far=[], tunnels=[], bays=[], signs=[])
    rng = random.Random(seed)
    # the wall body, the tide line (blackened, slimed brick below ~1.7 m) and the wet streaks
    brickfill(F, 0, YSPRING, WF, YWALL - YSPRING, B, seed, streaks=True)
    xx, yy = grid(0, YSPRING, WF, YWALL - YSPRING)
    tide = 118 + (vnoise(xx / 7.0, yy * 0, seed + 1) - 0.5) * 4 + (fbm(xx / 2.0, yy * 0, seed + 2, 2) - 0.5) * 2
    low = yy > tide
    lowt = np.clip(2 + (fbm(xx / 8.0, yy / 3.0, seed + 3, 2) > 0.55) - (hs(xx, yy, seed + 4) < 0.18) - ((yy - tide) < 0.8), 0, 4)
    rgb = np.array(Bd, np.uint8)[lowt]
    F.put(0, YSPRING, rgb, low)
    nb = int(math.ceil(WF / BAY))
    for k in range(nb):
        x0 = k * BAY
        kind, var = bays[k] if k < len(bays) else ('plain', k % 4)
        xc, half = recess(F, x0, 'mouth' if kind == 'tunnel' else kind, seed + 10 * k, B, Bd)
        info['bays'].append((x0, BAY, kind))
        if kind == 'pipes':
            if var == 0:
                pipe_mouth(F, xc - 12, 108, 4.2, B, seed + k, eyes=1, info=info)
                pipe_mouth(F, xc + 10, 115, 3.2, B, seed + k + 1, eyes=1, info=info)
            elif var == 1:
                pipe_mouth(F, xc - 5, 103, 5.2, B, seed + k, eyes=1, info=info)
                pipe_mouth(F, xc + 15, 117, 2.4, B, seed + k + 1, eyes=0, info=info)
            else:
                for j, (dx, dy, r, e) in enumerate(((-16, 112, 2.6, 1), (0, 106, 3.0, 0), (16, 113, 2.6, 1))):
                    pipe_mouth(F, xc + dx, dy, r, B, seed + k + j, eyes=e, info=info)
        elif kind == 'manhole':
            if var == 1:                                    # the ladder right, the plate left of it
                manhole(F, xc + 8, B, seed + k, info)
                sign_exit(F, xc - 18, 96)
                info['signs'].append((xc - 18, 96, 15, 17))
            else:
                manhole(F, xc - 6, B, seed + k, info)
                if var == 0:
                    sign_exit(F, xc + 4, 96)
                    info['signs'].append((xc + 4, 96, 15, 17))
                else:                                       # no exit plate: the stretch's number
                    plate_num(F, xc + 6, 100, '%d' % (14 + k))
        elif kind == 'outfall':
            if var == 0:
                outfall(F, xc, 117, 3.4, seed + k, info)
                pipe_mouth(F, xc + 17, 100, 2.6, B, seed + k + 2, eyes=1, info=info)
            else:
                outfall(F, xc - 9, 111, 4.0, seed + k, info)
                pipe_mouth(F, xc + 14, 104, 3.0, B, seed + k + 2, eyes=1, info=info)
        elif kind == 'plain':
            if var == 0:
                # moss and a bricked-up old side arch (closed: no hole)
                yy2 = 104
                F.rect(xc - 9, yy2, 18, YWALL - yy2 - 6, B[2])
                brickfill(F, xc - 9, yy2, 18, YWALL - yy2 - 6, SR['sbrick'], seed + k * 3, mid=2, lo=1, hi=3, cw=3)
                F.hl(xc - 10, yy2 - 1, 20, B[4], t=1); F.hl(xc - 10, yy2 - 0.2, 20, B[1], t=TH)
                pipe_mouth(F, xc + 18, 96, 2.4, B, seed + k + 4, eyes=1, info=info)
            elif var == 1:
                sluice(F, xc - 2, seed + k)
            elif var == 2:
                root_crack(F, xc, seed + k, B)
                pipe_mouth(F, xc + 17, 112, 2.2, B, seed + k + 4, eyes=1, info=info)
            else:
                date_stone(F, xc, '1883', seed + k)
                pipe_mouth(F, xc + 15, 117, 2.4, B, seed + k + 4, eyes=1, info=info)
        elif kind == 'tunnel':
            tunnel_mouth(F, xc, B, seed + k, info)
    # the cast-iron pipe under the cornice, with its brackets on the pilasters and rust below them
    I, Ru = SR['castiron'], SR['rust']
    yp = YSPRING + 4.5
    F.rect(0, yp, WF, 2.5, I[3])
    F.hl(0, yp, WF, I[5], t=TH)
    F.hl(0, yp + 2, WF, I[1], t=TH)
    for k in range(nb):
        bx = k * BAY + PIL / 2
        F.rect(bx - 1, yp - 1, 2.5, 4.5, Ru[3]); F.rect(bx - 1, yp + 3, 2.5, 0.5 if U > 1 else 1, Ru[1])
        F.vl(bx, yp + 3.5, rng.randint(5, 16), Ru[1], t=TH)
        F.rect(k * BAY + 30 + rng.uniform(-6, 6), yp, 1.5, 2.5, I[2])          # a joint collar
    cornice(F, 0, WF, seed + 40, SR['granite'])
    # moss on the cornice and the green tide
    xx, yy = grid(0, YSPRING - 3, WF, 2)
    mm = fbm(xx / 5.0, yy, seed + 41, 2) > 0.62
    F.put(0, YSPRING - 3, np.array(SR['moss'], np.uint8)[np.clip(3 + (hs(xx, yy, 3) > 0.5), 0, 6)], mm)
    far_walkway(F, 0, WF, seed + 50)
    # cut the side tunnels' openings last (the walkway stays in front of them)
    for (pc, hw, crown, spring) in info['tunnels']:
        xx, yy = grid(pc - hw, crown, 2 * hw, YWALL - crown)
        op = ((yy >= spring) | (np.hypot(xx - pc, yy - spring) <= hw)) & (np.abs(xx - pc) <= hw)
        sub_ = F.view(pc - hw, crown, 2 * hw, YWALL - crown)
        if sub_.shape[:2] == op.shape:
            sub_[op] = 0
    return F, info



def vault_px_d(u, y, s, H, grates, ribs, seed=21, secw=1280):
    """One band of the barrel vault seen from below, daylight colours graded per row by its depth. Courses run along
       the tunnel at equal steps of the angle (so they bunch toward the crown); the transverse ribs over the pilasters
       become round arches because every row scrolls at the speed of its place on the barrel."""
    em = H['em']
    th = theta_of_s(s)
    NC = 22.0                                                     # courses per radian
    Ay = th * NC
    course = np.floor(Ay + 1e-6)
    cw = 7.0
    off = (course % 2) * cw / 2
    cell = np.floor((u + off) / cw)
    n1 = fbm(u / 40.0, Ay / 4.0, seed, 3)
    t = 3 + (n1 > 0.66) - (n1 < 0.32) + (hash01(cell, course, seed + 1) > 0.90) - (hash01(cell, course, seed + 2) < 0.08)
    fy = Ay - course
    dyc = 1.0 / np.maximum(np.abs(np.gradient(Ay, axis=0)) * U, 1e-3) if Ay.shape[0] > 1 else np.full(Ay.shape, 2.0 * U)
    fx_ = ((u + off) / cw - cell) * cw * s * U
    if U >= 2:
        jn = (fy * dyc > dyc - 1) | (fx_ > cw * s * U - 1)
        t = t - (jn & (hs(u, y, seed + 3) > 0.25))
    else:
        t = t - ((fy > 0.6) & (dyc > 2.4) & (hs(u, y, seed + 3) > 0.4))
    # shading: the barrel turns away from the light toward the spring line (darker), its middle catches the most
    t = t - (th < 0.30) - (th < 0.14) - (th > 1.35)
    rib = np.zeros(u.shape, bool)
    for ur in ribs:
        dd = u - ur
        inr = np.abs(dd) < 6.5
        rib |= inr
        rt = 4 + ((np.floor(Ay * 1.5) % 2 == 0) & (U >= 2)) - (th < 0.30) - (th < 0.14) + (dd < -4.6) - 2 * (dd > 5.0)
        t = np.where(inr, rt, t)
        t = np.where((dd >= 6.5) & (dd < 9.5), t - 1, t)                  # the rib's shade on the vault
    # water stains: dark wet streaks running down the barrel from each grate and from cracks, slime at their foot
    stain = np.zeros(u.shape, bool)
    srcs = [(g, 1.0) for g in grates] + [(r_ + 37, 1.15) for r_ in ribs[::3]]
    for (us, ths) in srcs:
        w_ = 3.0 + (ths - th) * 9 + (vnoise(th * 9, us, seed + 4) - 0.5) * 4
        stain |= (th < ths) & (np.abs(u - us - (vnoise(th * 5, us * 0.1, seed + 5) - 0.5) * 8) < np.maximum(w_, 0))
    t = np.where(stain & ~rib, t - 1, t)
    wet = (vnoise(u / 2.2, th * 3, seed + 6) > 0.80) & (hs(u, y, seed + 7) > 0.3)
    t = np.where(wet & ~rib, t - 1, t)
    # cracks with roots: a dark crack, root strands hanging toward the spring line (the 'down' of the barrel)
    rng = random.Random(seed + 8)
    root = np.zeros(u.shape, bool)
    crack = np.zeros(u.shape, bool)
    for k in range(int(round(9 * secw / 1280.0))):
        ux, tx = rng.uniform(-150, secw + 170), rng.uniform(0.75, 1.3)
        crack |= (np.abs(u - ux - (th - tx) * 30 * math.sin(k)) < 0.45 / np.maximum(s, 0.1)) & (np.abs(th - tx) < 0.12)
        for j in range(6):
            ln, ph, dr = rng.uniform(0.15, 0.42), rng.uniform(0, 6), rng.uniform(-14, 14)
            cu = ux + dr * (tx - th) + 2.0 * np.sin(th * 26 + ph)
            root |= (th < tx) & (th > tx - ln) & (np.abs(u - cu) * s * U < (0.75 if U > 1 else 0.6))
    # calcite drips on the joints and under the ribs' lower edge
    calc = (fy < 0.5) & (hash01(np.floor(u / 1.5), course, seed + 9) > 0.993) & ~rib & (th > 0.2)
    calc |= rib & (np.abs(u - np.round(u / 2.3) * 2.3) * s * U < 0.6) & (th < 0.9) & (th > 0.5) & \
        (hash01(np.round(u / 2.3), np.floor(th * 9), seed + 10) > 0.80)                  # stalactites under a rib
    # a cast-iron main and a cable run along the barrel (horizontal), brackets on the ribs
    pipe = np.abs(th - 0.42) < 0.035
    pipe_hi = np.abs(th - 0.448) < 0.008
    pipe_lo = np.abs(th - 0.388) < 0.008
    near_rib = np.zeros(u.shape, bool)
    for ur in ribs:
        near_rib |= np.abs(u - ur) < 2.0
    phase = np.mod(u - ribs[0], ribs[1] - ribs[0]) / (ribs[1] - ribs[0])
    cable = np.abs(th - (0.62 - 0.05 * np.sin(np.pi * phase))) < 0.010 + 0.004 * (U == 1)
    cable2 = np.abs(th - (0.66 - 0.035 * np.sin(np.pi * phase))) < 0.008 + 0.004 * (U == 1)
    rust = (th < 0.385) & (th > 0.30) & near_rib & (hs(u, th * 20, seed + 11) > 0.3)
    return dict(t=t, th=th, rib=rib, stain=stain, root=root, crack=crack, calc=calc, pipe=pipe, pipe_hi=pipe_hi,
                pipe_lo=pipe_lo, cable=cable | cable2, bracket=pipe & near_rib, rust=rust)



def vault_layer_d(sec, H, grates, ribs, lit=False, seed=21):
    """The barrel vault from the spring line (y 72) to the top of the frame, as VAULT_BANDS rows layers (each one
       speed per row, the speeds following the barrel). Returns the screen rows of the grates (ya, yb)."""
    em = H['em']
    S = em['shaft']
    ys = [round(YSPRING * k / VAULT_BANDS) for k in range(VAULT_BANDS + 1)]
    for b in range(VAULT_BANDS):
        y0, y1 = ys[b], ys[b + 1]
        s0, s1 = float(s_of_y(y0)), float(s_of_y(y1))
        u, y, s, Wl = rows_grid(sec, y0, y1, s0, s1)
        d = vault_px_d(u, y, s, H, grates, ribs, seed, secw=sec.W)
        t, th = d['t'], d['th']
        rgb = np.zeros(u.shape + (3,), np.uint8)
        nb = 4
        sb = np.clip(np.floor((s - S_W) / (1 - S_W) * nb), 0, nb - 1)
        for k in range(nb):
            Gb = G_of(H, H['air'] * (1 - (k + 0.5) / nb) * 0.9)
            m = sb == k
            if not m.any():
                continue
            Bb, Sb, Cb = gramp('sbrick', Gb), gramp('slime', Gb), gramp('calc', Gb)
            Ib, Rb, Wd = gramp('castiron', Gb), gramp('rust', Gb), gramp('wood', Gb)
            rgb[m] = Bb[np.clip(t, 0, 6)][m]
            sl = m & d['stain'] & (th < 0.10) & (hs(u, y, seed + 12) > 0.75)
            rgb[sl] = Sb[2]
            rgb[m & d['crack']] = Bb[0]
            rgb[m & d['root']] = Wd[1]
            rgb[m & d['root'] & (hs(u, y, seed + 13) > 0.7)] = Wd[3]
            rgb[m & d['calc']] = Cb[5]
            rgb[m & d['rust']] = Rb[1]
            rgb[m & d['pipe']] = Ib[3]
            rgb[m & d['pipe_hi']] = Ib[5]
            rgb[m & d['pipe_lo']] = Ib[1]
            rgb[m & d['bracket']] = Rb[3]
            rgb[m & d['cable']] = Ib[0]
        # the grates in the crown: an iron frame, bars along the depth, the neon between them, a halo on the bricks
        for ug in grates:
            du = u - ug
            gm = (np.abs(du) < 8.0) & (s >= GRATE_V[0]) & (s < GRATE_V[1])
            if not gm.any():
                gm2 = None
            ed = (s < GRATE_V[0] + 0.004) | (s > GRATE_V[1] - 0.004)
            frame = gm & ((np.abs(du) > 6.8) | ed)
            light = gm & ~frame
            bars = light & (np.abs(((du + 8) % 2.6) - 1.3) > (0.85 if U >= 2 else 0.9))
            rgb[light] = np.array(grate_cols(H), np.uint8)[np.where(np.abs(du) < 3.5, 0, 1)][light]
            rgb[bars] = (26, 18, 30)
            rgb[frame] = gramp('castiron', G_of(H, 0.1))[2]
            sm = (GRATE_V[0] + GRATE_V[1]) / 2
            hr = LT(H, 'halo_r')
            dd = (du / hr[0]) ** 2 + ((s - sm) / (0.055 * hr[1] / 13.0)) ** 2
            inner = (dd < 0.32) | ((dd < 0.5) & chk(u * s, y))
            outer = ((dd < 0.85) | ((dd < 1.0) & chk(u * s, y))) & ~inner
            for mm, aa in ((inner & ~gm, LT(H, 'halo')[0]), (outer & ~gm, LT(H, 'halo')[1])):
                if mm.any() and aa > 0:
                    px = rgb[mm].astype(float)
                    rgb[mm] = snap5(px + (np.array(S[2], float) - px) * aa)
        add_rows(sec, 'vault%d' % b, y0, y1, s0, s1, [(rgb, np.ones(u.shape, bool))], Wl)
    return float(y_of_s(GRATE_V[1])), float(y_of_s(GRATE_V[0]))


def water_px_d(u, vb, f, H, fx, lit=False, src=None, seed=31, secw=1280):
    """The channel seen from above: dark body, the green glow, the flow, rings from drips, the mirror of the far wall
       near its foot, the neon of each shaft where it lands and its broken streak toward the viewer. Float rgb."""
    em = H['em']
    G0 = G_of(H, 0.0)
    W = np.array(G0(np.array(SR['swater'], float)), float)
    glow = np.array(em['glow'], float)
    flow = u - f * 4.0
    n = fbm(flow / 34.0, vb / 3.2, seed, 3)
    st = fbm(flow / 9.0, vb / 0.9, seed + 1, 2)
    v = 0.17 + (n - 0.5) * 0.8 + (st - 0.5) * 0.30
    idx = np.clip(np.floor(v * 5), 0, 4).astype(int)
    col = W[idx]
    # the glow: low-frequency blobs of green light in the body
    gb = fbm(flow / 60.0, vb / 10.0, seed + 2, 2)
    ga = np.clip((gb - 0.46) * 2.6, 0, 1) * H.get('glow', 0.58) * (0.52 if lit else 1.0)
    ga = np.floor(ga * 4) / 4
    gi = np.clip(np.floor(gb * 3), 0, 2).astype(int)
    col = col + (glow[gi] - col) * ga[..., None]
    # ripples: lens shapes with a light upper rim
    p = fbm(flow / 7.0, vb / 1.4, seed + 3, 2)
    lightm = (p > 0.64) & (vnoise(flow / 3.0, vb / 1.1, seed + 4) > 0.5)
    col = np.where(lightm[..., None], col + (W[5] - col) * 0.30, col)
    # the mirror of the far wall's foot (the walkway's face and its slime), broken
    if src is not None:
        ref = src(u, vb, f)
        if ref is not None:
            rc, rm = ref
            col = np.where(rm[..., None], col + (rc - col) * 0.42, col)
    # drip rings
    rng = random.Random(seed + 9)
    for i in range(int(70 * secw / 1280)):
        ux, vx = rng.uniform(-200, secw + 220), rng.uniform(36, 96)
        r = 1.2 + ((f + i) % 3) * 1.4
        d = np.hypot(u - ux, (vb - vx) * 2.4)
        rm = (np.abs(d - r) < 0.45) & (d < 6)
        col = np.where(rm[..., None], col + (W[6] - col) * 0.45, col)
    # each shaft: a pool where it lands, the streak toward the viewer
    S = np.array(em['shaft'], float)
    vg = vb_of(S_SHAFT)
    for ug in fx['grates']:
        pr = LT(H, 'pool_r')
        dd = ((u - ug) / pr[0]) ** 2 + ((vb - vg) / pr[1]) ** 2
        pool = (dd < 0.45) | ((dd < 0.8) & chk(u * 0.7, vb * 0.5))
        col = np.where(pool[..., None], col + (S[1] - col) * LT(H, 'pool'), col)
        wob = 1.6 * np.sin(vb * 0.9 + f * 2.1) + (vnoise(vb / 2.0, f, seed + 11) - 0.5) * 3
        stk = (vb < vg) & (np.abs(u - ug + wob) < 3.2 + (vg - vb) * 0.04) & (hash01(np.floor(vb * 1.6), f + 7, seed + 12) > 0.3)
        col = np.where(stk[..., None], col + (S[2] - col) * LT(H, 'streak'), col)
        core = stk & (np.abs(u - ug + wob) < 1.2)
        col = np.where(core[..., None], col + (S[1] - col) * LT(H, 'streak'), col)
    # the outfalls' foam where they hit the channel
    for ux in fx['pours']:
        dd = ((u - ux) / 9.0) ** 2 + ((vb - 97.0) / 4.0) ** 2
        foam = (dd < 1.0) & (hs(u + f * 3, vb, seed + 13) > 0.45)
        col = np.where(foam[..., None], col + (W[6] * 1.4 - col) * 0.4, col)
    # the fatberg's shade on the water around its foot
    if fx.get('fat_water'):
        u0, v0, v1 = fx['fat_water']
        sh = (u > u0) & (vb > v0) & (vb < v1) & ((u > u0 + 5) | chk(u * 0.7, vb * 0.5))
        col = np.where(sh[..., None], col * 0.55, col)
    # the grease skin around the fatberg
    if fx.get('fat'):
        f0, f1 = fx['fat']
        sk = (u > f0) & (u < f1) & (fbm(u / 6.0, vb / 2.0, seed + 15, 2) > 0.45 - (u - f0) / (f1 - f0) * 0.3)
        Gs = np.array(G0(np.array(SR['grease'], float)), float)
        col = np.where(sk[..., None], Gs[np.clip((fbm(u / 3.0, vb, seed + 16, 2) * 4).astype(int), 0, 3)] * 0.85, col)
    return col



def lost_things_d(rgb, u, vb, f, H, lit=False, lost=()):
    """The lost things floating in the channel, drawn after the water's palette (ramp colours, graded)."""
    G0 = G_of(H, 0.0)
    em = H['em']
    def C(name, i):
        return np.array(G0(np.array([SR[name][i]], float))[0], np.uint8)
    for (kind, ux, vx) in lost:
        bobu = ux + ((f % 3) - 1) * 0.6
        du, dv = u - bobu, vb - vx
        near = (np.abs(du) < 14) & (np.abs(dv) < 8)
        if not near.any():
            continue
        if kind == 'phone':
            body = (np.abs(du) < 3.0) & (np.abs(dv) < 1.6)
            rgb[body] = C('castiron', 1)
            scr = (np.abs(du) < 2.2) & (np.abs(dv) < 1.0)
            rgb[scr] = snap5(np.array((150, 200, 240)) if not lit else np.array((170, 210, 240)))   # the screen still glows
            rgb[(np.abs(du + 2.0) < 0.6) & (np.abs(dv) < 0.4)] = (255, 255, 255)
        elif kind == 'keys':
            ring = np.abs(np.hypot(du, dv * 2) - 1.5) < 0.45
            rgb[ring] = C('white', 4)
            k1 = (du > 1) & (du < 5) & (np.abs(dv - 0.3) < 0.45)
            rgb[k1] = C('yellow', 4)
            k2 = (du > 0.5) & (du < 4) & (np.abs(dv + du * 0.3 + 0.2) < 0.4)
            rgb[k2] = C('white', 5)
        elif kind == 'dentures':
            arc = (np.abs(np.hypot(du, dv * 1.8) - 2.6) < 0.9) & (dv > -0.5)
            rgb[arc] = C('red', 4)
            teeth = (np.abs(np.hypot(du, dv * 1.8) - 2.0) < 0.5) & (dv > -0.3)
            rgb[teeth] = C('white', 6)
        elif kind == 'stick':
            rod = (du > -12) & (du < 6) & (np.abs(dv - du * 0.18) < 0.4)
            rgb[rod] = C('castiron', 2)
            ph = (np.abs(du - 7.5) < 2.2) & (np.abs(dv - 1.4) < 1.3)
            rgb[ph] = C('castiron', 1)
            rgb[(np.abs(du - 7.5) < 1.5) & (np.abs(dv - 1.4) < 0.7)] = snap5(np.array((140, 190, 230)))
        elif kind == 'bottle':
            b = (np.abs(du) < 3.5) & (np.abs(dv) < 1.0)
            rgb[b] = C('green', 3)
            rgb[b & (dv < -0.3)] = C('green', 5)
            rgb[(du > 3.5) & (du < 5) & (np.abs(dv) < 0.5)] = C('green', 2)
        elif kind == 'duck':
            b = np.hypot(du, dv * 1.6) < 2.6
            rgb[b] = C('yellow', 4)
            rgb[b & (dv < -0.6)] = C('yellow', 6)
            rgb[(np.hypot(du - 2.2, dv + 1.4) < 1.0)] = C('yellow', 5)
            rgb[(np.abs(du - 3.4) < 0.7) & (np.abs(dv + 1.2) < 0.4)] = C('red', 4)
        elif kind == 'wipes':
            sh = (fbm(du / 3.0 + ux, dv / 1.5, 3, 2) > 0.45) & (np.hypot(du / 6.0, dv / 3.0) < 1)
            rgb[sh] = C('wipe', 4)
            rgb[sh & (hs(du, dv, 5) > 0.7)] = C('wipe', 3)
            rgb[sh & (dv < -1.2)] = C('wipe', 5)
        elif kind == 'grease':
            sh = (fbm(du / 2.0 + ux, dv, 4, 2) > 0.42) & (np.hypot(du / 5.0, dv / 2.4) < 1)
            rgb[sh] = C('grease', 3)
            rgb[sh & (hs(du, dv, 6) > 0.75)] = C('grease', 5)



def walkway_px_d(u, vb, H, fx, seed=41, secw=1280):
    """The near walkway (the walk band) seen from above: a granite coping on the channel, brick paving in courses
       along the tunnel, wet patches that take the neon, slime, grime toward the viewer; flat things only."""
    G0 = G_of(H, 0.0)
    K = np.array(G0(np.array(SR['klinker'], float)), np.uint8)
    Gr = np.array(G0(np.array(SR['granite'], float)), np.uint8)
    Sl = np.array(G0(np.array(SR['slime'], float)), np.uint8)
    Wp = np.array(G0(np.array(SR['wipe'], float)), np.uint8)
    vb_edge = vb_of(s_d(D_EDGE))
    j = np.floor(vb / 7.0)
    uu = u / 14.0 + 0.5 * (j % 2)
    i = np.floor(uu)
    fu, fv = uu - i, vb / 7.0 - j
    t = 2 + (hash01(i, j, seed) > 0.66) - (hash01(i, j, seed + 1) > 0.84)
    t = np.where((fv > 0.88) | (fu < 0.04), 0, t)                      # joints
    t = np.where((fv < 0.14) & (fu > 0.06), np.minimum(t + 1, 4), t)   # the lit far edge of each slab
    crack = (np.abs(vnoise(u / 3.0, vb / 9.0, seed + 11) - 0.5) < 0.02) & (hash01(i, j, seed + 12) > 0.6)
    t = np.where(crack, 1, t)
    grime = fbm(u / 40.0, vb / 9.0, seed + 2, 3)
    t = t - (grime < 0.33) + (grime > 0.72)
    t = t - (vb < -16) - (vb < -34)                                       # the nearest rows darkest
    rgb = Gr[np.clip(t, 0, 6)]
    # the coping: granite blocks, a lit top and a rounded nosing at the channel
    cp = vb > vb_edge - 7.5
    ct = 4 + (fbm(u / 6.0, vb, seed + 3, 2) > 0.6) - ((u % 26.0) < 0.6)
    ct = np.where(vb > vb_edge - 1.2, 6, ct)
    ct = np.where((vb > vb_edge - 7.5) & (vb < vb_edge - 6.6), 1, ct)
    rgb[cp] = Gr[np.clip(ct, 0, 6)][cp]
    # slime on the coping and in the joints along the edge, green
    sl = cp & (fbm(u / 7.0, vb / 2.0, seed + 4, 2) > 0.6) & (vb < vb_edge - 1.4)
    rgb[sl] = Sl[np.clip(2 + (hs(u, vb, seed + 5) > 0.6), 0, 6)][sl]
    # puddles: dark water with a thin lit rim; the neon in those under a shaft's spill
    pd = (fbm(u / 22.0, vb / 4.0, seed + 6, 3) > 0.64) & ~cp
    S = H['em']['shaft']
    W = np.array(G0(np.array(SR['swater'], float)), np.uint8)
    rgb[pd] = W[2]
    rgb[pd & (hs(u * 0.5, vb, seed + 7) > 0.82)] = W[5]
    for ug in fx['grates']:
        near = pd & (np.abs(u - ug) < 22)
        gl = near & (np.abs(((vb + u * 0.05) % 2.2) - 1.1) < 0.22) & (hs(u * 0.25, vb, seed + 13) > LT(H, 'glints'))
        rgb[gl] = S[1] if True else S[2]
        rgb[gl & (np.abs(u - ug) > 16)] = S[2]
        # the neon spill on the coping under each shaft
        spill = cp & (((u - ug) / 26.0) ** 2 + ((vb - vb_edge) / 9.0) ** 2 < 1)
        sa, sb = LT(H, 'spill')
        if spill.any():
            px = rgb[spill].astype(float)
            rgb[spill] = snap5(px + (np.array(S[2], float) - px) * np.where(chk(u, vb)[spill], sa, sb)[:, None])
    # slime trails and a wipe or two lying flat on the bricks
    tr = ~cp & (np.abs(vnoise(u / 30.0, vb * 0, seed + 8) * 30 - 15 - (vb - 8)) < 0.9) & (hs(u, vb, seed + 9) > 0.3)
    rgb[tr] = Sl[3]
    for (ux, vx) in fx.get('wipes', ()):
        w = (np.hypot((u - ux) / 4.0, (vb - vx) / 2.2) < 1) & (fbm(u / 2.0, vb, int(ux), 2) > 0.4)
        rgb[w] = Wp[4]
        rgb[w & (vb < vx - 0.8)] = Wp[5]
    # a stream of wet wipes washed up over the walkway (fx['stream'] = (u0, u1)): matted sheets, grease, slime
    if fx.get('stream'):
        s0_, s1_ = fx['stream']
        mid_ = (s0_ + s1_) / 2.0
        env = np.clip(1 - np.abs(u - mid_) / ((s1_ - s0_) / 2.0), 0, 1)
        # washed up along the coping (the far part of the walkway), thinning toward the viewer
        band_ = np.clip(1 - (vb_edge - 7.5 - vb) / 40.0, 0, 1)
        sh = ~cp & (fbm(u / 5.0, vb / 2.6, seed + 20, 3) > 0.70 - 0.22 * env * band_) & (env > 0) & (band_ > 0)
        a_ = fbm(u / 9.0, vb / 4.0, seed + 21, 2) * np.pi * 2
        fib = fbm((u * np.cos(a_) + vb * np.sin(a_)) / 0.8, (vb * np.cos(a_) - u * np.sin(a_)) / 4.0, seed + 22, 2)
        wt = np.clip(2 + (fib > 0.58) - (fib < 0.36) + (band_ > 0.8), 1, 4)
        rgb[sh] = Wp[wt][sh]
        gr = sh & (fbm(u / 3.0, vb / 1.5, seed + 23, 2) > 0.66)
        rgb[gr] = gramp('grease', G0)[3]
        rgb[sh & (hs(u, vb, seed + 24) > 0.93)] = Sl[3]
    # the fatberg's shade on the walkway: under its sagging belly and around its foot (light from the grates above)
    if fx.get('fat_shadow'):
        u0, u1, v0, v1 = fx['fat_shadow']
        sh = (u > u0) & (vb > v0) & (vb < v1)
        sh &= (u > u0 + 4) | chk(u, vb)
        if sh.any():
            px = rgb[sh].astype(float)
            rgb[sh] = snap5(px * 0.55 + np.array(H['KEY'][0], float) * 0.45)
    # a drain slot in the walkway every 320 px: an iron grating flush with the bricks
    for ux in range(250, secw, 320):
        dr = (np.abs(u - ux) < 6) & (np.abs(vb - 14) < 3.2)
        rgb[dr] = gramp('castiron', G0)[1]
        rgb[dr & (np.floor(u * 0.8) % 2 == 0)] = gramp('castiron', G0)[3]
    return rgb



def channel_layers_d(sec, H, F, fx, lit=False):
    """The water rows from the far walkway's face (y 139) to the floor's back edge (146), and the floor rows (146-216):
       water up to the near coping (depth 16), then the near walkway. Three frames (the flow)."""
    frames = 3
    G0 = G_of(H, 0.0)
    # the mirror source: the far plane's foot (walkway face, slime, the eyes), flipped about the water line
    Fa = F.a

    def src(u, vb, f):
        s = FF / (vb + FF)
        y = 60 + 116 * s
        ys = YW - (y - YW) * 2.4 - 0.5
        ok = (ys >= YSPRING) & (ys < YW)
        px = np.clip(((192 + (u + 1.2 * np.sin(vb * 1.7 + f * 2.1) - 192) * S_W) * U).astype(int), 0, Fa.shape[1] - 1)
        py = np.clip((ys * U).astype(int), 0, Fa.shape[0] - 1)
        c = Fa[py, px]
        m = ok & (c[..., 3] > 0) & (hash01(np.floor(vb * 2), np.floor(u / 3), 61 + f) > 0.25)
        return c[..., :3].astype(float), m
    out = {}
    for lid, y0, y1 in (('water', YW, BACKY), ('floor', BACKY, VIEW_H)):
        s0, s1 = (y0 - 60) / 116.0, (y1 - 60) / 116.0
        u, y, s, Wl = rows_grid(sec, y0, y1, s0, s1)
        vb = vb_of(s)
        vbe = vb_of(s_d(D_EDGE))
        wm = vb > vbe
        rgbs, masks = [], []
        for f in range(frames):
            rgb = np.zeros(u.shape + (3,), float)
            if wm.any():
                rgb[wm] = water_px_d(u[wm], vb[wm], f, H, fx, lit, src=lambda a, b, ff=f: src(a, b, ff), secw=sec.W)
            rgbs.append(rgb); masks.append(wm.copy())
        rgbs = quantize(rgbs, masks, 34)
        res = []
        walk = None if lid == 'water' else walkway_px_d(u, vb, H, fx, secw=sec.W)
        for f in range(frames):
            r = rgbs[f].astype(np.uint8)
            if walk is not None:
                r[~wm] = walk[~wm]
            # the shade of the coping's lip on the first water row and the lost things
            lost_things_d(r, u, vb, f, H, lit, lost=fx.get('lost', ()))
            res.append((r, np.ones(u.shape, bool)))
        out[lid] = add_rows(sec, lid, y0, y1, s0, s1, res, Wl)
    return out

