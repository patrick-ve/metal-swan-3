# Painters of section e (DE AFVALHAL, 05:00) of mission sewers: the trash hall under a canal, where the tunnel of d
# runs on and opens at x 832. Wave P4b, painter E. Built on parts_sewers.py (the approved V2 BLACK parts, read only).
#
# The hall (metres; 13 px per metre x the plane's speed):
#   back wall   at S_H = 0.5 (6.5 px/m), its foot on row 118: 13.8 m to the hall vault's spring line (y 28); bays of
#               9.8 m (64 px) between brick piers; tall blind arcades, culverts, outfalls, pipe mouths, a crack
#   vault       a barrel over the hall from the spring (y 28, s 0.5) to the top of the frame (s 1.0): rows in bands;
#               transverse ribs over the piers; cracks along the crown that let in cold grey light and water
#   floor       the walkway widens into the hall floor at 832: wet blackened brick, shallow water with the green glow,
#               flat trash; the channel ends at a weir (its water spills over a granite sill into the channel)
#   the throne  a trash mountain at the back (scenery, depth 40) and, in front of it, the game's pile entity
#               (decor/sewers-rattenjong-throne/pile: four levels, KING.tops) with Gerrit's gold chain (its own sprite)
import math
import random
import numpy as np
from PIL import Image
from level import *
from parts4 import tint
from parts_sewers import *                    # noqa: F401,F403  (S_W, YWALL, SR, LT, G_of, gramp, rows_grid, ...)
from parts_sewers import _blur
import parts_sewers as PS

HALL = 832                   # world x where the tunnel's portal opens into the hall
HALL0 = 700                  # the hall's own back layers start here (behind the tunnel's far wall at every camera)
S_H = 0.5                    # the hall's back wall plane
YF_H = 118                   # its foot (the hall floor's back edge)
YS_H = 28                    # the hall vault's spring line on the back wall
HB = 64                      # a hall bay, plane px (9.8 m)
HP0 = 446                    # plane x of the first hall pier (world x 700)
LOCK_CAM = 864               # the camera of the boss lock (arena 864-1,248)
WEIR = 10                    # the weir at the channel's end: world x HALL - WEIR .. HALL

# the game's rat eyes that light up on the king's squeak (bosses/sewers-rattenjong/props.ts HALL_EYES, world x, y; drawn
# at speed 1 while the camera is locked at 864): each needs a carrier painted under it at that camera
HALL_EYES = [(878, 120), (902, 96), (934, 132), (962, 84), (996, 112), (1024, 70), (1046, 128), (1078, 92),
             (1120, 76), (1152, 104), (1176, 130), (1198, 82), (1222, 116), (1240, 94), (1012, 142), (1188, 146)]
# the throne (bosses/sewers-rattenjong/numbers.ts KING): seat x, pile frame box 224 x 92 with the anchor (112, 90), the
# seat's y per level, the chain's place relative to the seat
KING_X, PILE_W, PILE_H, PILE_AY = 1100, 224, 92, 90
KING_TOPS = (128, 130, 132, 134)
LEDGES = ((920, 990), (1110, 1180))
LEDGE_Y = 150

SR['orange'] = ramp(7, .30, .80, .080, .160, .120, 36, 66)          # a traffic cone, a crate
SR['mattress'] = ramp(7, .40, .94, .010, .016, .022, 250, 96)       # an old mattress, grey-white


def keep_e(H):
    """The emitters of the hour plus the crack light (EM_E['crack']): they skip the grade."""
    out = keepcols(H)
    return out + [tuple(int(v) for v in snap5(c)) for c in H['em'].get('crack', [])]


def H_crack(H):
    """The hour with the crack light as its shaft colours (for shaft_layer)."""
    em = dict(H['em'])
    em['shaft'] = em['crack']
    return dict(H, em=em)


def s_hv(y):
    """The speed of the hall vault at screen row y (y 28: the spring, s S_H; y 0: s 1)."""
    t = np.clip((YS_H - np.asarray(y, float)) / YS_H, 0, 1)
    return S_H + (1 - S_H) * (1 - np.sqrt(1 - t * t))


def y_hv(s):
    q = np.clip((np.asarray(s, float) - S_H) / (1 - S_H), 0, 1)
    return YS_H * (1 - np.sqrt(1 - (1 - q) ** 2))


def hall_p(u):
    return 192 + (u - 192) * S_H


def plane_x(u, s):
    return 192 + (u - 192) * s


def graded(part, H, KEEP, depth=0.0, k2=1.0):
    """Grade a daylight part as the plane at this depth: the key of the hour (a little of the air for depth > 10)."""
    K0, K1, K2, K3 = H['KEY']
    G = grader(key=(K0, K1, K2 * k2, K3), air=(H['AIR'][0], H['AIR'][1], H['air'] * 0.35, 0.3) if depth > 10 else None)
    part.recolor(G, keep=KEEP)
    part.a[..., :3] = snap5(part.a[..., :3])
    return part


def limit(L, n, keep=()):
    """At most n colours besides the emitters (one median-cut palette on the 5-bit grid)."""
    a = L.a
    m = a[..., 3] > 0
    if not m.any():
        return
    px = a[..., :3][m]
    kk = np.array(sorted(set(keep)), np.int64).reshape(-1, 3)
    key = (px[:, 0].astype(np.int64) << 16) | (px[:, 1].astype(np.int64) << 8) | px[:, 2]
    kkey = (kk[:, 0] << 16) | (kk[:, 1] << 8) | kk[:, 2] if len(kk) else np.zeros(0, np.int64)
    free = ~np.isin(key, kkey)
    if len(np.unique(key[free])) <= n:
        return
    q = Image.fromarray(px[free][None, :, :].astype(np.uint8), 'RGB').quantize(n, method=Image.MEDIANCUT, dither=Image.NONE)
    out = snap5(np.asarray(q.convert('RGB'))[0].astype(float)).astype(np.uint8)
    sub_ = px.copy()
    sub_[free] = out
    a[..., :3][m] = sub_


# ---------------------------------------------------------------- the hall's back wall (plane S_H)
def hall_arch(F, x0, seed, B, Bd, crown=40, kind='blind'):
    """One hall bay [x0, x0 + HB): a pier at its left (stone quoins, an impost) and a tall round-headed recess beside
       it; kind 'culvert' opens the lower part into a dark culvert. Inside the slot only (bays tile)."""
    pw = 8
    xc = x0 + pw + (HB - pw) / 2.0
    half = (HB - pw) / 2.0 - 4
    spring = crown + half
    xx, yy = grid(x0 + pw, YS_H, HB - pw, YF_H - YS_H)
    inside = (np.abs(xx - xc) <= half) & ((yy >= spring) | (np.hypot(xx - xc, yy - spring) <= half)) & (yy < YF_H - 4)
    brickfill(F, x0 + pw, YS_H, HB - pw, YF_H - YS_H, B, seed + 3, mask=inside, mid=2, lo=0, hi=4, streaks=True)
    # the shade under the arch head and down its left jamb
    top = np.where(np.abs(xx - xc) <= half, spring - np.sqrt(np.clip(half ** 2 - (xx - xc) ** 2, 0, None)), 999)
    sh = inside & ((yy < top + 2.2) | (np.abs(xx - (xc - half)) < 1.6))
    F.put(x0 + pw, YS_H, np.broadcast_to(np.array(B[0], np.uint8), xx.shape + (3,)), sh & (~chk(xx, yy) | (yy < top + 1.0)))
    # the arch ring: two rowlock courses, joints toward the centre
    d = np.hypot(xx - xc, yy - spring)
    ring = (d > half) & (d <= half + 4.2) & (yy < spring)
    ang = np.arctan2(yy - spring, xx - xc)
    tone = np.where(np.floor(ang * 30) % 2 == 0, 4, 3)
    tone = np.where(np.abs(d - half - 2.1) < 0.35, 2, tone) if U >= 2 else tone
    tone = np.where(d > half + 3.4, 5, tone)
    F.put(x0 + pw, YS_H, np.array(B, np.uint8)[np.clip(tone, 0, 6)], ring)
    jamb = (np.abs(np.abs(xx - xc) - half - 2.1) <= 2.1) & (yy >= spring) & (yy < YF_H - 4)
    jt = np.where(np.floor(yy / 2.0) % 2 == 0, 4, 3) - (xx > xc)
    F.put(x0 + pw, YS_H, np.array(B, np.uint8)[np.clip(jt, 0, 6)], jamb)
    # the keystone
    F.rect(xc - 2.5, crown - 4.5, 5, 5, SR['granite'][4]); F.hl(xc - 2.5, crown - 4.5, 5, SR['granite'][6])
    F.vl(xc + 2, crown - 4, 4.5, SR['granite'][2], t=TH)
    # the pier: brick, granite quoins every other course, an impost at the arcade's spring, a plinth
    brickfill(F, x0, YS_H, pw, YF_H - YS_H, B, seed + 7, mid=4, lo=2, hi=6)
    Gr = SR['granite']
    for y in np.arange(YS_H + 2, YF_H - 4, 6.0):
        F.rect(x0, y, 3 if int(y) % 12 < 6 else 4.5, 3, Gr[4]); F.hl(x0, y, 3, Gr[6], t=TH)
    F.vl(x0, YS_H + 2, YF_H - YS_H - 2, B[5], t=TH)
    F.vl(x0 + pw - TH, YS_H + 2, YF_H - YS_H - 2, B[1], t=TH)
    F.rect(x0 - 1, spring - 2, pw + 2, 3, Gr[4]); F.hl(x0 - 1, spring - 2, pw + 2, Gr[6]); F.hl(x0 - 1, spring + 1, pw + 2, Gr[1])
    F.rect(x0 - 1, YF_H - 6, pw + 2, 6, Gr[3]); F.hl(x0 - 1, YF_H - 6, pw + 2, Gr[5])
    if kind == 'culvert':
        cw, ct = half - 8, YF_H - 34
        cxx, cyy = grid(xc - cw - 4, ct - 4, 2 * cw + 8, YF_H - ct + 4)
        cs = ct + cw
        dd = np.hypot(cxx - xc, cyy - cs)
        op = (np.abs(cxx - xc) <= cw) & ((cyy >= cs) | (dd <= cw))
        rg = (np.abs(cxx - xc) <= cw + 3) & ((cyy >= cs) | (dd <= cw + 3)) & ~op
        rt = np.where(np.floor(np.arctan2(cyy - cs, cxx - xc) * 18) % 2 == 0, 4, 3)
        F.put(xc - cw - 4, ct - 4, np.array(B, np.uint8)[rt], rg)
        V = SR['void']
        vt = np.clip(np.floor(3.2 - np.abs(cxx - xc) / cw * 0.6 - (YF_H - cyy) / 14.0 - 2.4 * (np.abs(cxx - xc) < cw * 0.55)), 0, 3).astype(int)
        F.put(xc - cw - 4, ct - 4, np.array(V, np.uint8)[vt], op)
        return xc, half, (xc, cw, ct, cs)
    return xc, half, None


def hall_wall(sec, H, KEEP, lit=False, seed=301, mouths=()):
    """The hall's back wall at S_H from the hall vault's spring (y 28) to its foot (y 118), from world x HALL0 on: daylight
       colours, then the grade (key + more air than the tunnel's far wall), then its lights. Returns (layer, info)."""
    W = sec.lw(S_H)
    F = Layer(W, VIEW_H)
    B, Bd, Gr = SR['sbrick'], SR['sbrick_b'], SR['granite']
    x0 = HP0
    brickfill(F, x0, YS_H, W - x0, YF_H - YS_H, B, seed, streaks=True)
    xx, yy = grid(x0, YS_H, W - x0, YF_H - YS_H)
    tide = 102 + (vnoise(xx / 9.0, yy * 0, seed + 1) - 0.5) * 5
    low = yy > tide
    lowt = np.clip(2 + (fbm(xx / 8.0, yy / 3.0, seed + 3, 2) > 0.55) - (hs(xx, yy, seed + 4) < 0.2) - ((yy - tide) < 0.8), 0, 4)
    F.put(x0, YS_H, np.array(Bd, np.uint8)[lowt], low)
    info = dict(bays=[], pipes=[], pours=[], culverts=[], ladders=[], cracks=[])
    kinds = ['blind', 'culvert', 'crack', 'pipes', 'outfall', 'culvert', 'blind']
    k = 0
    xb = x0
    while xb < W:
        kind = kinds[k % len(kinds)]
        xc, half, cul = hall_arch(F, xb, seed + 11 * k, B, Bd, crown=40 + (k % 2) * 3, kind='culvert' if kind == 'culvert' else 'blind')
        info['bays'].append((xb, HB, kind))
        if cul is not None:
            info['culverts'].append(cul)
            ladder(F, xc - half + 2, 52, YF_H - 2, seed + k)
            info['ladders'].append(xc - half + 2)
        if kind == 'pipes':
            for (dx, y, r) in ((-12, 70, 3.4), (9, 84, 2.6), (-3, 98, 3.0)):
                pipe_mouth(F, xc + dx, y, r, B, seed + k + dx, eyes=0)
                info['pipes'].append((xc + dx, y, r))
        elif kind == 'outfall':
            I, Ru = SR['castiron'], SR['rust']
            cx, cy, r = xc - 6, 88, 4.6
            F.ellipse(cx, cy, r + 1.6, r + 1.8, Ru[2]); F.ellipse(cx - 0.3, cy - 0.3, r + 1.1, r + 1.3, Ru[4])
            F.ellipse(cx, cy, r, r, I[1]); F.ellipse(cx, cy + 0.6, r - 0.9, r - 1.1, SR['void'][1])
            sx, sy = grid(cx - r, cy + r, 2 * r, YF_H - cy - r)
            st = (np.abs(sx - cx) < r * (0.95 - (sy - cy) / 60)) & (hs(sx, sy, seed + k) > 0.35)
            F.put(cx - r, cy + r, np.broadcast_to(np.array(Ru[1], np.uint8), sx.shape + (3,)), st)
            info['pours'].append((cx, cy + r * 0.6, r * 1.2))
            pipe_mouth(F, xc + 14, 66, 2.8, B, seed + k + 5, eyes=0)
            info['pipes'].append((xc + 14, 66, 2.8))
            sign_exit(F, xc + 8, 92)
        elif kind == 'crack':
            # the wall split from the vault down: a jagged crack, wet dark brick around it, water running out of it
            r = random.Random(seed + k)
            x, y = xc + 4, YS_H + 1
            pts = [(x, y)]
            while y < YF_H - 8:
                y += r.uniform(3, 6)
                x += r.uniform(-3.2, 3.2)
                pts.append((x, y))
            for (a, b) in zip(pts, pts[1:]):
                F.line(a[0] + 1.2, a[1], b[0] + 1.2, b[1], Bd[1], t=2.4)
            for (a, b) in zip(pts, pts[1:]):
                F.line(a[0], a[1], b[0], b[1], SR['void'][0], t=1.2)
            info['cracks'].append(pts)
        k += 1
        xb += HB
    # the hall cornice at the vault's spring, moss on it, the iron main of the hall along under it
    F.rect(x0, YS_H - 1, W - x0, 1, Gr[6]); F.rect(x0, YS_H, W - x0, 3, Gr[4]); F.rect(x0, YS_H + 3, W - x0, 1, Gr[1])
    cx_, cy_ = grid(x0, YS_H - 2, W - x0, 2)
    mm = fbm(cx_ / 5.0, cy_, seed + 41, 2) > 0.62
    F.put(x0, YS_H - 2, np.array(SR['moss'], np.uint8)[np.clip(3 + (hs(cx_, cy_, 3) > 0.5), 0, 6)], mm)
    I = SR['castiron']
    F.rect(x0, YS_H + 6, W - x0, 3, I[3]); F.hl(x0, YS_H + 6, W - x0, I[5], t=TH); F.hl(x0, YS_H + 8.5, W - x0, I[1], t=TH)
    rr = random.Random(seed + 9)
    for xb in np.arange(x0, W, HB):
        F.rect(xb + 2, YS_H + 5, 3, 5, SR['rust'][3]); F.vl(xb + 3, YS_H + 10, rr.randint(6, 18), SR['rust'][1], t=TH)
    # calcite drips under the cornice
    x = x0 + 2.0
    while x < W - 1:
        n = rr.choice((2, 3, 4, 6))
        F.vl(x, YS_H + 4, n, SR['calc'][5], t=TH)
        x += rr.uniform(3, 9)
    # the wall's foot: a granite plinth course, slime and the high-water line
    F.rect(x0, YF_H - 3, W - x0, 3, Gr[2]); F.hl(x0, YF_H - 3, W - x0, Gr[4], t=TH)
    fx_, fy_ = grid(x0, YF_H - 9, W - x0, 9)
    sl = (fbm(fx_ / 4.0, fy_ / 2.0, seed + 50, 2) > 0.52) & (fy_ > YF_H - 9 + 3 * (vnoise(fx_ / 6.0, fy_ * 0, seed + 51)))
    F.put(x0, YF_H - 9, np.array(SR['slime'], np.uint8)[np.clip(2 + (hs(fx_, fy_, 52) > 0.6), 0, 6)], sl)
    for (p, y, r, sd) in mouths:                      # pipe mouths placed for the game's eyes (carriers)
        pipe_mouth(F, p, y + 0.5, r, B, sd, eyes=0)
        F.ellipse(p, y + 0.2, r * 0.78, r * 0.62, SR['void'][0]); F.ellipse(p, y + 0.9, r * 0.6, r * 0.3, SR['void'][1])
    # the grade: the hall's back wall is farther than the tunnel's far wall: more air
    F.recolor(G_of(H, min(0.9, H['air'] * 1.5)), keep=KEEP)
    # ---- the lights (after the grade): the green of the water on the wall's foot, the crack light running down the
    #      split, the grey light of the vault cracks on the cornice and the upper wall
    em = H['em']
    C = em['crack']
    v = F.view(x0, YF_H - 8, W - x0, 8)
    gx, gy = grid(x0, YF_H - 8, W - x0, 8)
    if v.shape[:2] == gx.shape:
        m = (v[..., 3] > 0) & chk(gx, gy) & (gy > YF_H - 8 + 2 * vnoise(gx / 11.0, gy * 0, 7))
        for (p, y, r, sd) in mouths:                  # the carriers stay dark
            m &= np.hypot(gx - p, gy - y) > r + 1.5
        px_ = v[..., :3][m].astype(float)
        v[..., :3][m] = snap5(px_ + (np.array(em['glow'][1], float) - px_) * 0.35 * H.get('glow', 0.58))
    for pts in info['cracks']:
        for (a, b) in zip(pts[1:], pts[2:]):
            if a[1] < 62 and hash01(np.array(int(a[1] * 3)), np.array(1), 5) > 0.3:
                F.line(a[0], a[1], b[0], b[1], C[3], t=TH)
    return F, info


# ---------------------------------------------------------------- the hall vault (rows from the top of the frame to y 28)
HV_BANDS = 7
# The cracks in the hall vault: (world x, vault speed, half length along the hall, opening). The long one over the
# throne (1,000-1,140) is where the canal comes down at the end (props.ts SewersFlood crackX0..X1); shafts fall from
# the openings (their plane: the vault speed at the opening; they land on the floor row of that speed).
CRACKS = [(892, 0.70, 22, 1), (1040, 0.62, 44, 1), (1112, 0.62, 30, 1), (1292, 0.66, 24, 1)]


def hall_vault(sec, H, KEEP, ribs, lit=False, seed=331):
    em = H['em']
    C = em['crack']
    ys = [round(YS_H * k / HV_BANDS) for k in range(HV_BANDS + 1)]
    for b in range(HV_BANDS):
        y0, y1 = ys[b], ys[b + 1]
        s0, s1 = float(s_hv(y0)), float(s_hv(y1))
        u, y, s, Wl = rows_grid(sec, y0, y1, s0, s1)
        q = np.clip((s - S_H) / (1 - S_H), 0, 1)
        th = np.arccos(1 - q)
        NC = 30.0
        Ay = th * NC
        course = np.floor(Ay + 1e-6)
        cw = 7.0
        off = (course % 2) * cw / 2
        cell = np.floor((u + off) / cw)
        n1 = fbm(u / 50.0, Ay / 5.0, seed, 3)
        t = 3 + (n1 > 0.66) - (n1 < 0.32) + (hash01(cell, course, seed + 1) > 0.90) - (hash01(cell, course, seed + 2) < 0.08)
        fy = Ay - course
        if U >= 2:
            dyc = 1.0 / np.maximum(np.abs(np.gradient(Ay, axis=0)) * U, 1e-3) if Ay.shape[0] > 1 else np.full(Ay.shape, 2.0 * U)
            fx_ = ((u + off) / cw - cell) * cw * s * U
            jn = (fy * dyc > dyc - 1) | (fx_ > cw * s * U - 1)
            t = t - (jn & (hs(u, y, seed + 3) > 0.25))
        t = t - (th < 0.30) - (th < 0.14) - (th > 1.35)
        rib = np.zeros(u.shape, bool)
        for ur in ribs:
            dd = u - ur
            inr = np.abs(dd) < 9.0
            rib |= inr
            rt = 4 + ((np.floor(Ay * 1.5) % 2 == 0) & (U >= 2)) - (th < 0.30) + (dd < -6.5) - 2 * (dd > 7.0)
            t = np.where(inr, rt, t)
            t = np.where((dd >= 9.0) & (dd < 13.0), t - 1, t)
        # the cracks: a jagged dark split along the hall near the crown, wet stains spreading from it, roots
        crack = np.zeros(u.shape, bool)
        open_ = np.zeros(u.shape, bool)
        halo = np.zeros(u.shape, float)
        stain = np.zeros(u.shape, bool)
        for i, (uc, sc, hl, op) in enumerate(CRACKS):
            thc = float(np.arccos(1 - (sc - S_H) / (1 - S_H)))
            along = (u - uc) / hl
            wob = (vnoise(u / 6.0, np.full(u.shape, i * 3.0), seed + 20 + i) - 0.5) * 0.10 + 0.03 * np.sin(u / 3.0 + i)
            line = np.abs(th - thc - wob) < 0.010 + 0.012 * (U == 1)
            crack |= line & (np.abs(along) < 1)
            # side branches
            for j in range(3):
                bu = uc + (j - 1) * hl * 0.6
                br = (np.abs(u - bu - (th - thc) * 40 * (1 if j % 2 else -1)) < 0.5 / np.maximum(s, 0.1)) & (np.abs(th - thc) < 0.10)
                crack |= br
            # the openings: where the split gapes, the light comes through
            op_m = ((np.abs(th - thc - wob) < 0.022) & (np.abs(u - uc) < 3.0 + hl * 0.08)) | \
                   ((np.abs(th - thc) < 0.035) & (np.abs(u - uc) < 2.5))
            open_ |= op_m
            e = ((u - uc) / (hl * 1.1 + 6)) ** 2 + ((th - thc - wob) / 0.045) ** 2
            halo = np.maximum(halo, np.clip(1 - e, 0, 1) * (0.6 + 0.4 * (vnoise(u / 2.0, th * 30, seed + 40 + i) > 0.5)))
            stain |= (th > thc) & (th < thc + 0.5) & (np.abs(u - uc - (vnoise(th * 5, u * 0.05, seed + 5) - 0.5) * 10) < hl * 0.6 * np.clip(1 - (th - thc) * 1.6, 0, 1))
        t = np.where(stain & ~rib, t - 1, t)
        wet = (vnoise(u / 2.4, th * 3, seed + 6) > 0.80) & (hs(u, y, seed + 7) > 0.3)
        t = np.where(wet & ~rib, t - 1, t)
        calc = (fy < 0.5) & (hash01(np.floor(u / 1.5), course, seed + 9) > 0.993) & ~rib & (th > 0.2)
        rgb = np.zeros(u.shape + (3,), np.uint8)
        nb = 3
        sb = np.clip(np.floor((s - S_H) / (1 - S_H) * nb), 0, nb - 1)
        for kk in range(nb):
            Gb = G_of(H, H['air'] * (1.4 - (kk + 0.5) / nb) * 0.9)
            m = sb == kk
            if not m.any():
                continue
            Bb, Sb, Cb = gramp('sbrick', Gb), gramp('slime', Gb), gramp('calc', Gb)
            rgb[m] = Bb[np.clip(t, 0, 6)][m]
            rgb[m & stain & (hs(u, y, seed + 12) > 0.8)] = Sb[2]
            rgb[m & calc] = Cb[5]
            rgb[m & crack] = Bb[0]
        # the crack light (emitters): the openings bright, a grey halo stepped on the checker
        a1, a2 = (0.30, 0.14) if not lit else (0.14, 0.07)
        inner = (halo > 0.62) | ((halo > 0.50) & chk(u * s, y))
        outer = ((halo > 0.30) | ((halo > 0.18) & chk(u * s, y))) & ~inner
        for mm, aa, cc in ((inner & ~crack, a1, C[2]), (outer & ~crack, a2, C[3])):
            if mm.any():
                px_ = rgb[mm].astype(float)
                rgb[mm] = snap5(px_ + (np.array(cc, float) - px_) * aa)
        rgb[crack & (halo > 0.35)] = C[3]
        rgb[open_] = C[1]
        rgb[open_ & (hs(u, y, seed + 30) > 0.55)] = C[0]
        add_rows(sec, 'hvault%d' % b, y0, y1, s0, s1, [(rgb, np.ones(u.shape, bool))], Wl)


# ---------------------------------------------------------------- the hall floor (flat things in world x and depth)
def _trash_list(seed=77):
    r = random.Random(seed)
    out = []
    kinds = ['bag', 'bag', 'bag', 'wipes', 'wipes', 'can', 'can', 'wheel', 'board', 'grease', 'bottle', 'paper', 'cone', 'crate']
    u = HALL + 4
    while u < 1560:
        for _ in range(r.choice((1, 2, 2, 3))):
            out.append((r.choice(kinds), u + r.uniform(-8, 8), r.uniform(-30, 200), r.random()))
        u += r.uniform(8, 22)
    return out


TRASH = _trash_list()


def flat_things(rgb, u, vb, H, items, G0=None):
    """Flat things lying on a floor (world x u, world depth vb): bags, wipes, cans, a bike wheel, a board, grease,
       a bottle, paper, a fallen cone, a crate; the game's junk decor (phone, keys, wheel, stick)."""
    G0 = G0 or G_of(H, 0.0)
    def C(name, i):
        return np.array(G0(np.array([SR[name][i]], float))[0], np.uint8)
    for (kind, ux, vx, ph) in items:
        du, dv = u - ux, (vb - vx) * 0.55
        near = (np.abs(du) < 14) & (np.abs(dv) < 8)
        if not near.any():
            continue
        if kind == 'bag':
            b = (np.hypot(du / 4.6, dv / 2.6) < 1) & near
            rgb[b] = C('black', 1)
            rgb[b & (dv < -0.4) & (du < 1)] = C('black', 3)
            rgb[b & (np.abs(du + 1.6) < 0.6) & (np.abs(dv + 1.2) < 0.5)] = C('black', 5)
            rgb[(np.abs(du - 4.0) < 0.8) & (np.abs(dv + 1.0) < 0.9)] = C('black', 2)
        elif kind == 'wipes':
            sh = (fbm(du / 2.5 + ux, dv / 1.5, 3, 2) > 0.45) & (np.hypot(du / 5.0, dv / 2.4) < 1)
            rgb[sh] = C('wipe', 4); rgb[sh & (dv < -0.8)] = C('wipe', 5)
        elif kind == 'can':
            b = (np.abs(du) < 1.6) & (np.abs(dv) < 0.8)
            col = 'red' if ph < 0.4 else ('blue' if ph < 0.7 else 'green')
            rgb[b] = C(col, 3); rgb[b & (dv < -0.2)] = C(col, 5); rgb[(np.abs(du + 1.6) < 0.4) & (np.abs(dv) < 0.8)] = C('white', 5)
        elif kind == 'wheel':
            ring = np.abs(np.hypot(du / 5.5, dv / 2.2) - 1) < 0.16
            rgb[ring] = C('black', 1)
            rim = np.abs(np.hypot(du / 4.8, dv / 1.9) - 1) < 0.10
            rgb[rim] = C('castiron', 4)
            rgb[(np.hypot(du, dv * 2) < 0.8)] = C('castiron', 3)
        elif kind == 'board':
            b = (np.abs(du + dv * 0.8) < 8) & (np.abs(dv - du * 0.05) < 1.4)
            rgb[b] = C('wood', 2); rgb[b & (dv < -0.6)] = C('wood', 4)
        elif kind == 'grease':
            sh = (fbm(du / 2.0 + ux, dv, 4, 2) > 0.42) & (np.hypot(du / 6.0, dv / 2.4) < 1)
            rgb[sh] = C('grease', 3); rgb[sh & (hs(du, dv, 6) > 0.8)] = C('grease', 5)
        elif kind == 'bottle':
            b = (np.abs(du) < 2.6) & (np.abs(dv) < 0.7)
            rgb[b] = C('green', 3); rgb[b & (dv < -0.2)] = C('green', 5)
        elif kind == 'paper':
            b = (np.abs(du) < 2.4) & (np.abs(dv - du * 0.2) < 1.4)
            rgb[b] = C('white', 4); rgb[b & (du > 1)] = C('white', 3)
        elif kind == 'cone':
            b = (du > -4) & (du < 3) & (np.abs(dv) < 1.2 * (1 - (du + 4) / 9.0) + 0.3)
            rgb[b] = C('orange', 4); rgb[b & (np.abs(du + 1) < 0.6)] = C('white', 5)
        elif kind == 'crate':
            b = (np.abs(du) < 4) & (np.abs(dv) < 2.0)
            rgb[b] = C('blue', 3); rgb[b & ((np.floor(du + 4) % 2) == 0) & (np.abs(dv) < 1.2)] = C('blue', 1)
            rgb[b & (dv < -1.4)] = C('blue', 5)
        elif kind == 'phone':
            body = (np.abs(du) < 3.0) & (np.abs(dv) < 1.5)
            rgb[body] = C('castiron', 1)
            rgb[(np.abs(du) < 2.2) & (np.abs(dv) < 0.9)] = snap5(np.array((120, 170, 220)))
            rgb[(np.abs(du + 1.5) < 0.6) & (np.abs(dv + 0.2) < 0.4)] = snap5(np.array((200, 230, 250)))
        elif kind == 'keys':
            ring = np.abs(np.hypot(du, dv * 2) - 1.5) < 0.45
            rgb[ring] = C('white', 4)
            rgb[(du > 1) & (du < 5) & (np.abs(dv - 0.3) < 0.45)] = C('yellow', 4)
            rgb[(du > 0.5) & (du < 4) & (np.abs(dv + du * 0.3 + 0.2) < 0.4)] = C('white', 5)
        elif kind == 'stick':
            rod = (du > -6) & (du < 5) & (np.abs(dv - du * 0.18) < 0.4)
            rgb[rod] = C('castiron', 3)
            ph_ = (np.abs(du - 5.5) < 1.8) & (np.abs(dv - 1.0) < 1.1)
            rgb[ph_] = C('castiron', 1)
            rgb[(np.abs(du - 5.5) < 1.1) & (np.abs(dv - 1.0) < 0.6)] = snap5(np.array((120, 170, 220)))
        elif kind == 'wheel_g':           # the game's junk frame 2: a bike wheel lying in a puddle
            pd = np.hypot(du / 8.0, dv / 3.2) < 1
            rgb[pd] = C('swater', 2)
            ring = np.abs(np.hypot(du / 5.5, dv / 2.2) - 1) < 0.16
            rgb[ring] = C('black', 1)
            rim = np.abs(np.hypot(du / 4.8, dv / 1.9) - 1) < 0.10
            rgb[rim] = C('castiron', 4)
            sp_ = (np.hypot(du / 4.8, dv / 1.9) < 1) & (np.abs(np.sin(np.arctan2(dv * 2.4, du) * 4)) < 0.12)
            rgb[sp_] = C('castiron', 3)


def hall_px(u, vb, f, H, lit, fx, seed=351):
    """The hall floor seen from above (float rgb, graded colours): wet blackened brick in courses, shallow water in the
       low parts (more toward the back) with the green glow and ripples, rings from drips, the pools of the crack light
       where the shafts land, and the flat trash."""
    G0 = G_of(H, 0.0)
    K = np.array(G0(np.array(SR['klinker'], float)), float)
    Bd = np.array(G0(np.array(SR['sbrick_b'], float)), float)
    W = np.array(G0(np.array(SR['swater'], float)), float)
    Sl = np.array(G0(np.array(SR['slime'], float)), float)
    glow = np.array(H['em']['glow'], float)
    C = np.array(H['em']['crack'], float)
    j = np.floor(vb / 6.0)
    uu = u / 12.0 + 0.5 * (j % 2)
    i = np.floor(uu)
    fu, fv = uu - i, vb / 6.0 - j
    t = 2 + (hash01(i, j, seed) > 0.66) - (hash01(i, j, seed + 1) > 0.84)
    t = np.where((fv > 0.86) | (fu < 0.05), 0, t)
    t = np.where((fv < 0.16) & (fu > 0.07), np.minimum(t + 1, 4), t)
    grime = fbm(u / 40.0, vb / 12.0, seed + 2, 3)
    t = t - (grime < 0.34) + (grime > 0.74)
    t = t - (vb < -16) - (vb < -34)
    black = hash01(i, j, seed + 3) > 0.55
    col = np.where(black[..., None], Bd[np.clip(t + 1, 0, 6)], K[np.clip(t, 0, 6)])
    # the slime along the foot of the back wall
    col = np.where(((vb > 196) & (fbm(u / 5.0, vb / 4.0, seed + 4, 2) > 0.45))[..., None], Sl[2], col)
    # shallow water: the low parts, more toward the back; none on the walk line itself
    wl = fbm(u / 46.0, vb / 18.0, seed + 5, 3) + 0.22 * np.clip((vb - 40) / 140.0, 0, 1) - 0.30 * np.clip((30 - vb) / 40.0, 0, 1)
    water = wl > 0.54
    rim = (wl > 0.51) & ~water
    flow = u - f * 3.0
    n = fbm(flow / 30.0, vb / 3.0, seed + 6, 3)
    st = fbm(flow / 8.0, vb / 1.0, seed + 7, 2)
    v = 0.20 + (n - 0.5) * 0.8 + (st - 0.5) * 0.3
    wc = W[np.clip(np.floor(v * 5), 0, 4).astype(int)]
    gb = fbm(flow / 60.0, vb / 12.0, seed + 8, 2)
    ga = np.floor(np.clip((gb - 0.50) * 2.4, 0, 1) * H.get('glow', 0.58) * (0.30 if lit else 0.55) * 4) / 4
    gi = np.clip(np.floor(gb * 3), 0, 2).astype(int)
    wc = wc + (glow[gi] - wc) * ga[..., None]
    rip = (fbm(flow / 7.0, vb / 1.4, seed + 9, 2) > 0.66) & (vnoise(flow / 3.0, vb / 1.1, seed + 10) > 0.5)
    wc = np.where(rip[..., None], wc + (W[5] - wc) * 0.30, wc)
    col = np.where(water[..., None], wc, col)
    col = np.where(rim[..., None], col * 0.78, col)
    # drip rings on the water (the vault leaks everywhere)
    rng = random.Random(seed + 11)
    for k in range(60):
        ux, vx = rng.uniform(HALL, 1500), rng.uniform(-10, 200)
        rr = 1.2 + ((f + k) % 3) * 1.4
        d = np.hypot(u - ux, (vb - vx) * 0.6)
        rm = water & (np.abs(d - rr) < 0.45) & (d < 6)
        col = np.where(rm[..., None], col + (W[6] - col) * 0.45, col)
    # the crack light where each shaft lands: a pool (stronger on water), the splash rings
    for (ux, vland, rx) in fx.get('pools', ()):
        e = ((u - ux) / rx) ** 2 + ((vb - vland) / (rx * 0.9)) ** 2
        inner = (e < 0.35) | ((e < 0.55) & chk(u * 0.7, vb * 0.5))
        outer = ((e < 0.9) | ((e < 1.1) & chk(u * 0.7, vb * 0.5))) & ~inner
        aw = np.where(water, 1.0, 0.6)
        for m, aa in ((inner, 0.40), (outer, 0.18)):
            col = np.where(m[..., None], col + (C[1] - col) * (aa * aw * (0.6 if lit else 1.0))[..., None], col)
        sp = (np.abs(np.hypot(u - ux, (vb - vland) * 0.7) - (1.5 + f * 1.6)) < 0.5) & (e < 1.0)
        col = np.where(sp[..., None], col + (C[0] - col) * 0.5, col)
    return col


def hall_rows(sec, lid, y0, y1, H, lit, fx, u_min=HALL0, frames=3, ncol=40):
    """A rows layer of the hall floor from y0 to y1 (one speed per row), painted where world x >= u_min."""
    s0, s1 = (y0 - 60) / 116.0, (y1 - 60) / 116.0
    u, y, s, Wl = rows_grid(sec, y0, y1, s0, s1)
    vb = vb_of(s)
    m = u >= u_min
    rgbs = []
    for f in range(frames):
        rgb = np.zeros(u.shape + (3,), float)
        rgb[m] = hall_px(u[m], vb[m], f, H, lit, fx)
        rgbs.append(rgb)
    rgbs = quantize(rgbs, [m] * frames, ncol)
    res = []
    for r in rgbs:
        r = r.astype(np.uint8)
        flat_things(r, u, vb, H, fx.get('trash', ()))
        res.append((r, m))
    return add_rows(sec, lid, y0, y1, s0, s1, res, Wl)


# ---------------------------------------------------------------- the channel and the near walkway of e, the weir
def channel_e(sec, H, F, fx, lit=False, lost=()):
    """parts_sewers.channel_layers for e: the water ends at the weir (HALL - WEIR .. HALL), the hall floor takes over
       from HALL (the floor rows; the water rows leave it to the hall's far rows); the game's junk decor and the
       hall's trash lie flat on the floor. Three frames."""
    frames = 3
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
    G0 = G_of(H, 0.0)
    Gr = gramp('granite', G0)
    Bd = gramp('sbrick_b', G0)
    Wt = gramp('swater', G0)
    Wh = gramp('white', G0)
    out = {}
    old = PS.LOST
    PS.LOST = list(lost)
    try:
        for lid, y0, y1 in (('water', YW, BACKY), ('floor', BACKY, VIEW_H)):
            s0, s1 = (y0 - 60) / 116.0, (y1 - 60) / 116.0
            u, y, s, Wl = rows_grid(sec, y0, y1, s0, s1)
            vb = vb_of(s)
            vbe = vb_of(s_d(D_EDGE))
            hall = u >= HALL
            weir = (u >= HALL - WEIR) & ~hall & (vb > vbe - 0.6)
            wm = (vb > vbe) & ~hall & ~weir
            rgbs, masks = [], []
            for f in range(frames):
                rgb = np.zeros(u.shape + (3,), float)
                if wm.any():
                    rgb[wm] = water_px(u[wm], vb[wm], f, H, fx, lit, src=lambda a, b, ff=f: src(a, b, ff))
                rgbs.append(rgb); masks.append(wm.copy())
            rgbs = quantize(rgbs, masks, 34)
            hrg = []
            if hall.any():
                for f in range(frames):
                    rh = np.zeros(u.shape + (3,), float)
                    rh[hall] = hall_px(u[hall], vb[hall], f, H, lit, fx)
                    hrg.append(rh)
                hrg = quantize(hrg, [hall] * frames, 40)
            walk = None if lid == 'water' else walkway_px(u, vb, H, fx)
            res = []
            for f in range(frames):
                r = rgbs[f].astype(np.uint8)
                if walk is not None:
                    r[~wm] = walk[~wm]
                if hall.any():
                    r[hall] = hrg[f].astype(np.uint8)[hall]
                # the weir: a granite sill across the channel's end, its wet face, the water spilling over it
                if weir.any():
                    du = u - (HALL - WEIR)
                    sill = weir & (du >= WEIR - 3.5)
                    face = weir & ~sill
                    r[sill] = Gr[np.clip(4 + (np.floor(vb / 9.0) % 2) - (du > WEIR - 0.8), 0, 6).astype(int)][sill]
                    r[face] = Bd[np.clip(1 + (hs(u, vb, 5) > 0.6), 0, 6).astype(int)][face]
                    sh = face & (hash01(np.floor(u * DET * 1.2), np.floor((vb - f * 3.0) * 0.8), 71) > 0.35)
                    r[sh] = Wt[5]
                    r[sh & (hash01(np.floor(u * DET), np.floor(vb + f), 72) > 0.6)] = Wh[5]
                    # the foam where the sheet hits the channel
                    fo = wm & (u > HALL - WEIR - 12) & (hs(u + f * 2.0, vb, 73) > 0.40 + (HALL - WEIR - u) / 24.0)
                    r[fo] = Wh[np.clip(4 + (hs(u, vb + f, 74) > 0.6), 0, 6)][fo]
                lost_things(r, u, vb, f, H, lit)
                if lid == 'floor':
                    flat_things(r, u, vb, H, tuple(fx.get('junk', ())) + tuple(fx.get('trash', ())))
                res.append((r, np.ones(u.shape, bool) if lid == 'floor' else ~hall))
            out[lid] = add_rows(sec, lid, y0, y1, s0, s1, res, Wl)
    finally:
        PS.LOST = old
    return out


# ---------------------------------------------------------------- the crack shafts and the falling water (frames)
def crack_layers(sec, H, lit, seed=401):
    """For each vault speed of CRACKS: a frames layer on that plane with the grey light falling from the openings to
       the floor (dithered air, rain lit inside) and the water pouring out of them, with a can or a wipe falling in it.
       Returns the pools [(world x, world depth of the landing, radius)] for the floor."""
    HC = H_crack(H)
    C = H['em']['crack']
    G0 = G_of(H, H['air'] * 0.4)
    Wt = gramp('swater', G0)
    Wh = gramp('white', G0)
    pools = []
    speeds = sorted(set(c[1] for c in CRACKS))
    sec.notes['crack_shafts'] = []
    for k, sp in enumerate(speeds):
        cr = [c for c in CRACKS if c[1] == sp]
        yt = float(y_hv(sp)) + 0.5
        yl = 60 + 116 * sp
        shafts = [(plane_x(uc, sp), yt) for (uc, s_, hl, op) in cr]
        outs = shaft_layer(sec, 'cshaft%d' % k, sp, shafts, HC, yl, w0=7.0, w1=13.0,
                           strength=0.55 if not lit else 0.30, seed=seed + k)
        for f, Lf in enumerate(outs):
            for i, (x, y0) in enumerate(shafts):
                # the water: a thin twisting stream, broken into drops near the floor, a splash crown where it lands
                rr = random.Random(seed + 31 * i + k)
                h = yl - y0
                xx, yy = grid(x - 4, y0, 8, h)
                tt = (yy - y0) / h
                cx = x + np.sin(tt * 7 + i) * 0.6 * tt
                wd = 0.7 + tt * 1.1
                br = hash01(np.floor((xx - x) * DET * 2), np.floor((yy - f * h / 3.0) / 3.0), seed + 7 + i)
                m = (np.abs(xx - cx) < wd) & ((tt < 0.55) | (br > 0.45 + tt * 0.3))
                rgb = np.where((hash01(np.floor(xx * DET), np.floor((yy - f * 4.0) / 2.0), seed + 9) > 0.55)[..., None], Wh[5], Wt[5])
                rgb[np.abs(xx - cx) < 0.35] = C[0]
                Lf.put(x - 4, y0, rgb.astype(np.uint8), m)
                for kk in range(6):
                    Lf.px(x + rr.uniform(-4, 4), yl - rr.uniform(0.5, 3.0) - (f % 2), Wh[6])
                # falling trash: a can or a wipe in the stream, a third lower every frame
                if i % 2 == 0:
                    fy = y0 + h * (0.18 + 0.27 * ((f + i) % 3))
                    if (i + k) % 2:
                        Lf.rect(x - 1, fy, 2, 1.5, SR['red'][3]); Lf.px(x - 1, fy, SR['white'][5])
                    else:
                        Lf.rect(x - 1.5, fy, 3, 1, SR['wipe'][5]); Lf.px(x + 1, fy + 1, SR['wipe'][4])
                Lf.a[..., :3] = snap5(Lf.a[..., :3])
        for (uc, s_, hl, op) in cr:
            pools.append((uc, vb_of(sp), 9.0 + hl * 0.12))
            sec.notes['crack_shafts'].append(('cshaft%d' % k, sp, uc, yt))
    return pools


# ---------------------------------------------------------------- the pours of the hall wall's outfalls (frames on S_H)
def hall_pours(sec, H, info, frames=3, seed=421):
    G0 = G_of(H, H['air'] * 0.8)
    Wt = gramp('swater', G0)
    Wh = gramp('white', G0)
    W = sec.lw(S_H)
    outs = []
    for f in range(frames):
        L = Layer(W, VIEW_H)
        for (cx, cy, w) in info['pours']:
            xx, yy = grid(cx - w - 4, cy, 2 * w + 8, YF_H + 3 - cy)
            fall = (yy < YF_H) & (np.abs(xx - cx) < w * (0.55 + (yy - cy) * 0.012))
            pool = (yy >= YF_H - 1) & (np.abs(xx - cx) < w * 1.6 + (yy - YF_H) * 0.8)
            stv = hash01(np.floor((xx - cx) * DET * 1.5), np.floor((yy - f * 2.0) * 0.7), seed)
            rgb = np.where((stv > 0.62)[..., None], Wh[5], np.where((stv > 0.3)[..., None], Wt[6], Wt[4]))
            rgb = np.where(((np.abs(xx - cx) > w * 0.4) & fall)[..., None], Wt[5], rgb)
            L.put(cx - w - 4, cy, rgb.astype(np.uint8), fall | (pool & (hs(xx + f, yy, seed + 2) > 0.4)))
        # water seeping out of the split in the wall: a wet glint running down, broken
        for pts in info['cracks']:
            for (a, b) in zip(pts, pts[1:]):
                if hash01(np.array(int(a[1])), np.array(f), seed + 5) > 0.35:
                    L.line(a[0] + 0.5, a[1], b[0] + 0.5, b[1], Wt[6], t=TH)
        outs.append(L)
    sec.add('hpour', None, S_H, kind='frames', frames=outs)


# ---------------------------------------------------------------- trash: things and heaps (daylight colours)
def _wheel(L, cx, cy, rx, ry, tyre=None, rim=None, spokes=True):
    tyre = tyre or SR['black']; rim = rim or SR['castiron']
    xx, yy = grid(cx - rx - 1, cy - ry - 1, 2 * rx + 2, 2 * ry + 2)
    d = np.hypot((xx - cx) / rx, (yy - cy) / max(ry, 0.5))
    t = (d <= 1) & (d > 0.80)
    L.put(cx - rx - 1, cy - ry - 1, np.array(tyre, np.uint8)[np.where(yy < cy, 3, 1)], t)
    r = (d <= 0.80) & (d > 0.70)
    L.put(cx - rx - 1, cy - ry - 1, np.array(rim, np.uint8)[np.where(yy < cy, 5, 3)], r)
    if spokes and U >= 2:
        ang = np.arctan2((yy - cy) / max(ry, 0.5), (xx - cx) / rx)
        sp = (d < 0.70) & (np.abs(np.sin(ang * 6)) < 0.10)
        L.put(cx - rx - 1, cy - ry - 1, np.broadcast_to(np.array(rim[4], np.uint8), xx.shape + (3,)), sp)
    L.px(cx - 0.5, cy - 0.5, rim[5])


def _bike(L, x, y, sc=1.0, col='red', flip=False):
    """A bike frame in a heap, about 1.7 m x sc*13 px long; (x, y) its bottom left."""
    C = SR[col] if col in SR else R[col]
    w = 22 * sc
    r = 4.0 * sc
    a, b = (x + r, x + w - r) if not flip else (x + w - r, x + r)
    _wheel(L, a, y - r, r, r)
    _wheel(L, b, y - r, r, r)
    m = (a + b) / 2
    L.line(a, y - r, m, y - r * 2.2, C[4], t=1); L.line(m, y - r * 2.2, b, y - r, C[3], t=1)
    L.line(m, y - r * 2.2, m - (b - a) * 0.1, y - r, C[4], t=1); L.line(a, y - r, m - (b - a) * 0.1, y - r, C[2], t=1)
    L.line(b, y - r, b - (b - a) * 0.12, y - r * 2.6, SR['castiron'][3], t=1)
    L.hl(b - (b - a) * 0.12 - 2, y - r * 2.7, 4, SR['black'][2])
    L.rect(m - 2, y - r * 2.5, 4, 1, SR['black'][1])


def _cart(L, x, y, w, h, tilt=0.0):
    """A shopping cart (wire basket on four castors), (x, y) the bottom left of the basket."""
    I = SR['castiron']
    top = [(x + tilt, y - h), (x + w + tilt, y - h)]
    L.line(x, y, x + w * 0.85, y, I[4], t=TH)
    L.line(top[0][0], top[0][1], top[1][0], top[1][1], I[6], t=1)
    L.line(x, y, top[0][0], top[0][1], I[5], t=TH)
    L.line(x + w * 0.85, y, top[1][0], top[1][1], I[4], t=TH)
    for k in np.arange(1.6, w * 0.85, 1.6):
        L.line(x + k, y, x + k + (top[0][0] - x) * 0.0 + (w * 0.15) * (k / w), y - h, I[4], t=TH)
    for k in np.arange(1.5, h, 1.7):
        L.line(x + (top[0][0] - x) * k / h, y - k, x + w * 0.85 + (top[1][0] - x - w * 0.85) * k / h, y - k, I[3], t=TH)
    L.line(top[1][0], top[1][1], top[1][0] + 2.5, top[1][1] - 1.5, I[5], t=1)
    L.hl(top[1][0] + 1.5, top[1][1] - 2, 3, SR['red'][3])
    for wx in (x + 1, x + w * 0.8):
        L.ellipse(wx, y + 1.2, 0.9, 0.9, SR['black'][1])


def _scooter(L, x, y, sc=1.0, flip=False):
    d = -1 if flip else 1
    I = SR['castiron']; K = SR['black']
    L.rect(x, y - 1.5, 10 * sc, 1.2, K[2]); L.hl(x, y - 1.5, 10 * sc, K[4], t=TH)
    hx = x + (10 * sc if d > 0 else 0)
    L.line(hx, y - 1, hx + 1.5 * d, y - 12 * sc, I[4], t=1)
    L.hl(hx + 1.5 * d - 2.5, y - 12 * sc, 5, K[2])
    L.ellipse(x + 1, y, 1.3, 1.3, K[1]); L.ellipse(x + 10 * sc - 1, y, 1.3, 1.3, K[1])
    L.px(x + 1, y - 0.5, I[4])


def _crate(L, x, y, w, h, col='blue'):
    C = SR[col]
    L.rect(x, y - h, w, h, C[3]); L.hl(x, y - h, w, C[5]); L.vl(x + w - 1, y - h, h, C[1])
    for k in np.arange(x + 1.5, x + w - 1, 2.5):
        L.rect(k, y - h + 1.5, 1.2, h - 3, C[1])


def _cone(L, x, y, h):
    O = SR['orange']; Wh = SR['white']
    for j in sub(0, h):
        hw = 0.6 + (j / h) * h * 0.32
        L.rect(x - hw, y - h + j, 2 * hw, D1, O[4] if j / h < 0.5 or j / h > 0.75 else Wh[5])
        L.rect(x - hw, y - h + j, max(D1, hw * 0.5), D1, O[5] if j / h < 0.5 or j / h > 0.75 else Wh[6])
    L.rect(x - h * 0.42, y - 1, h * 0.84, 1, O[2])


def _mattress(L, x, y, w, h, sag=2.0):
    M = SR['mattress']
    for xx in sub(0, w):
        t = xx / max(w - 1, 1)
        yo = sag * math.sin(t * math.pi)
        L.rect(x + xx, y - h + yo, D1, h, M[3] if (int((x + xx) * DET) // 3) % 2 else M[4])
        L.rect(x + xx, y - h + yo, D1, D1, M[5])
        L.rect(x + xx, y - 1 + yo, D1, 1, M[1])
    for xx in np.arange(x + 3, x + w - 2, 5):
        L.px(xx, y - h / 2 + sag * 0.6, SR['grease'][2])


def _tyre(L, cx, cy, r):
    K = SR['black']
    L.ellipse(cx, cy, r, r * 0.9, K[2]); L.ellipse(cx - 0.3, cy - 0.3, r * 0.82, r * 0.72, K[3])
    L.ellipse(cx, cy, r * 0.45, r * 0.40, K[0])


def worley(xx, yy, sx, sy, seed):
    """Cell noise of jittered points (cells sx x sy): the distance to the nearest and second point, and the nearest
       point's id (0..1): irregular lumps."""
    gx, gy = xx / sx, yy / sy
    ci, cj = np.floor(gx), np.floor(gy)
    best = np.full(xx.shape, 9.0)
    second = np.full(xx.shape, 9.0)
    bid = np.zeros(xx.shape)
    for di in (-1, 0, 1):
        for dj in (-1, 0, 1):
            ii, jj = ci + di, cj + dj
            px_ = ii + 0.1 + 0.8 * hash01(ii, jj, seed)
            py_ = jj + 0.1 + 0.8 * hash01(ii, jj, seed + 1)
            d = np.hypot(gx - px_, gy - py_)
            idv = hash01(ii, jj, seed + 2)
            closer = d < best
            second = np.where(closer, best, np.minimum(second, d))
            bid = np.where(closer, idv, bid)
            best = np.where(closer, d, best)
    return best, second, bid


def junk_mound(w, h, seed, peak=None, flat=None, things=20, holes=0, light=(-0.30, -0.86, 0.42), wet=0.5):
    """A heap of trash (daylight colours): a mound of bin bags, mud, wipes, cardboard and grease lumps (volume from a soft
       height field, lit from the cracks above, crevices between the lumps, the sheen of wet plastic), things stuck in
       it and on it (bike frames, wheels, carts, scooters, crates, cones, a mattress, tyres) and dark holes.
       peak: the top profile function x -> top row (default a lumpy dome); flat: (x0, x1, row) a flat seat.
       Returns (Layer, holes [(x, y, rx, ry)] in part px)."""
    rng = random.Random(seed)
    L = Layer(w, h)
    xx, yy = grid(0, 0, w, h)
    if peak is None:
        d = np.abs(xx - w / 2.0) / (w / 2.0)
        top = h * 0.08 + h * 0.92 * d ** 1.7
    else:
        top = peak(xx)
    top = top + (fbm(xx / 9.0, xx * 0 + seed, seed, 2) - 0.5) * 7 + (fbm(xx / 2.5, xx * 0, seed + 1, 2) - 0.5) * 2.2
    if flat is not None:
        f0, f1, fr = flat
        top = np.where((xx > f0) & (xx < f1), fr, top)
    inside = yy >= top
    D = _blur(inside.astype(float), 5 * U)
    f1, f2, bid = worley(xx + (fbm(xx / 9.0, yy / 9.0, seed + 2, 2) - 0.5) * 4, yy, 6.5, 4.2, seed + 3)
    g1, g2, gid = worley(xx, yy, 15.0, 9.0, seed + 13)
    big = gid > 0.80                                                    # a few big lumps (a sofa cushion, a sack)
    f1 = np.where(big, g1, f1); f2 = np.where(big, g2, f2); bid = np.where(big, gid * 0.5 + 0.48, bid)
    mat = np.digitize(bid, [0.48, 0.58, 0.70, 0.78, 0.85, 0.90, 0.95])
    bump = np.clip(1 - f1 * 1.25, 0, 1) ** 0.7
    Hh = 12 * D ** 0.7 + 4.0 * bump + 1.0 * fbm(xx / 2.0, yy / 2.0, seed + 5, 2)
    gy, gx = grad(Hh)
    nx, ny, nz = -gx, -gy, np.full_like(Hh, 1.3)
    ln = np.sqrt(nx * nx + ny * ny + nz * nz)
    lx, ly, lz = light
    shade = (nx * lx + ny * ly + nz * lz) / ln
    under = np.clip(ny / ln, 0, 1)
    v = 0.30 + 0.48 * shade - 0.30 * under - np.clip(0.35 - D, 0, 1) * 0.6 - np.clip((yy - top - 24) / 70.0, 0, 0.25)
    tone = np.clip(np.floor(v * 6 + 0.5), 0, 6).astype(int)
    crev = (f2 - f1) < 0.10
    tone = np.where(crev, np.maximum(tone - 2, 0), tone)
    ramps = [SR['black'], SR['green'], SR['sbrick_b'], SR['wood'], SR['wipe'], SR['grease'], SR['blue'], SR['mattress']]
    rgb = np.zeros(xx.shape + (3,), np.uint8)
    for k, Rk in enumerate(ramps):
        mk = mat == k
        tk = tone if k in (0, 1, 2) else np.clip(tone - 1, 0, 6)
        rgb[mk] = np.array(Rk, np.uint8)[tk][mk]
    sheen = inside & (mat <= 1) & (shade > 0.40) & (bump > 0.55) & (hs(xx, yy, seed + 6) > 1 - wet * 0.6) & ~crev
    rgb[sheen] = np.where((mat[sheen] == 0)[:, None], SR['black'][6], SR['green'][5])
    tie = inside & (mat <= 1) & (bump > 0.85) & (hs(np.floor(xx), np.floor(yy), seed + 7) > 0.97)
    rgb[tie] = SR['black'][4]
    L.a[..., :3] = rgb
    L.a[..., 3] = np.where(inside, 255, 0)
    # things stuck in it (painted on a layer of their own, kept where the mound is or just above it: things stick out)
    T = Layer(w, h)
    def spot(margin=6, top_band=0.6):
        for _ in range(200):
            x0 = rng.uniform(margin, w - margin)
            col = top[0, min(P(x0), top.shape[1] - 1)] if top.ndim == 2 else top
            y0 = rng.uniform(col + 3, col + 3 + (h - col) * top_band)
            if y0 < h - 3:
                return x0, y0
        return w / 2, h / 2
    kinds = ['bike', 'wheel', 'cart', 'scooter', 'crate', 'plank', 'tyre', 'bike', 'wheel', 'cart', 'cone', 'chair', 'pipe',
             'mattress', 'barrier']
    for i in range(things):
        k = kinds[(i * 7 + seed) % len(kinds)]
        x0, y0 = spot()
        if k == 'bike':
            _bike(T, x0 - 10, y0 + 2, sc=rng.uniform(0.85, 1.25), col=rng.choice(['red', 'blue', 'black', 'green', 'white', 'yellow']), flip=rng.random() < 0.5)
        elif k == 'wheel':
            r_ = rng.uniform(3, 5.5)
            _wheel(T, x0, y0, r_, r_ * rng.uniform(0.35, 1.0))
        elif k == 'cart':
            _cart(T, x0 - 6, y0 + 3, rng.uniform(9, 13), rng.uniform(5, 7), tilt=rng.uniform(-2, 2))
        elif k == 'scooter':
            _scooter(T, x0 - 5, y0 + 2, sc=rng.uniform(0.7, 0.95), flip=rng.random() < 0.5)
        elif k == 'crate':
            _crate(T, x0 - 3, y0 + 2, rng.uniform(5, 8), rng.uniform(3.5, 5), col=rng.choice(['blue', 'orange', 'green', 'red']))
        elif k == 'cone':
            _cone(T, x0, y0 + 2, rng.uniform(5, 7))
        elif k == 'tyre':
            _tyre(T, x0, y0, rng.uniform(2.5, 4))
        elif k == 'mattress':
            _mattress(T, x0 - 10, y0 + 2, rng.uniform(16, 24), 3, sag=rng.uniform(1, 3))
        elif k == 'plank':
            a_ = rng.uniform(-0.5, 0.5); ln_ = rng.uniform(10, 20)
            T.line(x0 - ln_ / 2, y0 - a_ * ln_ / 2, x0 + ln_ / 2, y0 + a_ * ln_ / 2, SR['wood'][3], t=1.5)
            T.line(x0 - ln_ / 2, y0 - a_ * ln_ / 2 - 0.5, x0 + ln_ / 2, y0 + a_ * ln_ / 2 - 0.5, SR['wood'][5], t=TH)
        elif k == 'pipe':
            ln_ = rng.uniform(10, 18)
            T.line(x0 - ln_ / 2, y0, x0 + ln_ / 2, y0 - rng.uniform(-3, 3), SR['castiron'][3], t=2)
            T.line(x0 - ln_ / 2, y0 - 0.6, x0 + ln_ / 2, y0 - 0.6, SR['castiron'][5], t=TH)
        elif k == 'chair':
            C_ = SR[rng.choice(['white', 'green', 'red'])]
            T.rect(x0 - 3, y0 - 2, 7, 1.5, C_[4]); T.rect(x0 + 3, y0 - 8, 1.5, 7, C_[3])
            T.vl(x0 - 2.5, y0 - 1, 4, C_[2]); T.vl(x0 + 3, y0 - 1, 4, C_[2])
        elif k == 'barrier':
            for j in range(4):
                T.rect(x0 - 8 + j * 4, y0 - 3, 4, 2, SR['red'][4] if j % 2 else SR['white'][5])
            T.vl(x0 - 8, y0 - 3, 6, SR['castiron'][2]); T.vl(x0 + 7, y0 - 3, 6, SR['castiron'][2])
    tm = T.mask()
    keep = tm & (inside | (np.roll(inside, -P(4), axis=0)))
    bury = inside & (fbm(xx / 1.6, yy / 1.6, seed + 8, 2) > 0.74)
    keep &= ~bury
    L.a[..., :3][keep] = T.a[..., :3][keep]
    L.a[..., 3][keep] = 255
    # holes: dark caves between the lumps, a crusted rim over them and a lit lower lip
    out = []
    for i in range(holes):
        for _ in range(200):
            cx = rng.uniform(10, w - 10)
            cy = rng.uniform(h * 0.3, h - 6)
            if D[min(P(cy), D.shape[0] - 1), min(P(cx), D.shape[1] - 1)] > 0.85:
                break
        rx, ry = rng.uniform(3.6, 4.8), rng.uniform(2.2, 2.8)
        hole_px(L, cx, cy, rx, ry, seed + 60 + i)
        out.append((cx, cy, rx, ry))
    return L, out


def hole_px(L, cx, cy, rx, ry, seed=1, V=None, rim=None, lip=None):
    """A dark hole (a carrier for eyes): the void inside, darkest at the top, a rim over it and a lit lower lip."""
    V = V if V is not None else SR['void']
    xx, yy = grid(cx - rx - 2, cy - ry - 2, 2 * rx + 4, 2 * ry + 4)
    d = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2
    v = L.view(cx - rx - 2, cy - ry - 2, 2 * rx + 4, 2 * ry + 4)
    if v.shape[:2] != xx.shape:
        return
    hole = d < 1
    ht = np.clip(np.floor(0.6 + (yy - cy) / ry * 0.9 + 0.3 * (hs(xx, yy, seed) > 0.7)), 0, 2).astype(int)
    v[..., :3][hole] = np.array(V, np.uint8)[ht][hole]
    v[..., 3][hole] = 255
    has = v[..., 3] > 0
    r_ = has & (d >= 1) & (d < 1.9) & (yy < cy)
    v[..., :3][r_] = rim if rim is not None else SR['black'][0]
    l_ = has & (d >= 1) & (d < 1.6) & (yy > cy + ry * 0.4)
    v[..., :3][l_] = lip if lip is not None else SR['grease'][4]


def eyes_px(L, cx, cy, E):
    """A pair of red eyes (emitters) in a hole: two dots and a dithered halo."""
    for dx in (-1.0, 1.0):
        glow(L, cx + dx, cy, 1.8, [E[2]])
    for dx in (-1.0, 1.0):
        L.rect(cx + dx - 0.5, cy - 0.5, 1, 1, E[1])
        if U >= 2:
            L.rect(cx + dx - 0.5, cy - 0.5, 0.5, 0.5, E[0])


# ---------------------------------------------------------------- the throne pile (the game's entity frames), the chain
def pile_top(level):
    """The seat row of the pile frame at this level (the frame's row 0 is world y 176 - 90 = 86)."""
    return KING_TOPS[level] - (176 - PILE_AY)


def throne_pile(level, seed=501):
    """The pile frame `level` (224 x 90; the anchor (112, 90) is the floor under the seat): a trash mountain with an old
       armchair on its top as the seat (his feet on its cushion at KING.tops[level]), bike wheels fanned behind it, a
       traffic cone on each side, the trash ledge (a fridge on its side and a board) at x 1,110-1,180 in its front at
       y 150. Lower levels: the same pile settled (2 px a level, the slopes flatter). Daylight colours."""
    seat = pile_top(level)
    w, h = PILE_W, PILE_AY
    cx = w / 2.0

    def peak(xx):
        d = np.abs(xx - cx) / (w / 2.0)
        return seat + 6 + (h - seat - 6) * np.clip(d, 0, 1) ** (1.5 + 0.05 * level)
    P_, holes = junk_mound(w, h, seed, peak=peak, flat=(cx - 18, cx + 18, seat + 4), things=26, holes=0)
    # the armchair: a sunk, torn club chair (rounded back, rolled arms), its seat cushion the king's seat
    A = SR['wood']; Up = SR['red']
    P_.rect(cx - 17, seat + 1, 34, 8, Up[2])
    P_.rect(cx - 15, seat, 30, 2, Up[4]); P_.hl(cx - 15, seat, 30, Up[5], t=TH)
    P_.rect(cx - 18, seat - 11, 36, 11, Up[2])
    P_.ellipse(cx, seat - 11, 18, 4.2, Up[2])
    P_.ellipse(cx, seat - 12, 16.5, 3.0, Up[3]); P_.hl(cx - 12, seat - 14.6, 24, Up[4], t=TH)
    for xb in np.arange(cx - 15, cx + 16, 5.0):                          # buttoned tufts and their creases
        P_.vl(xb, seat - 12, 11, Up[1], t=TH)
        P_.px(xb + 2.5, seat - 8, Up[0]); P_.px(xb + 2.5, seat - 4, Up[0])
    for side in (-1, 1):
        ax = cx + side * 18
        P_.rect(ax - 3.5, seat - 5, 7, 13, Up[3]); P_.ellipse(ax, seat - 5, 4.2, 2.6, Up[4]); P_.ellipse(ax - side * 0.6, seat - 5.4, 2.4, 1.2, Up[5])
        P_.vl(ax + side * 3, seat - 4, 12, Up[1])
    rr = random.Random(seed + 3)
    for (tx, ty) in ((cx - 7, seat - 7), (cx + 11, seat + 4), (cx - 19, seat - 2)):   # the stuffing out of the tears
        for _ in range(5):
            P_.ellipse(tx + rr.uniform(-1.6, 1.6), ty + rr.uniform(-1, 1), rr.uniform(0.6, 1.2), rr.uniform(0.5, 0.9), SR['mattress'][rr.choice((3, 4, 5))])
    # bike wheels fanned behind the chair: the throne's back
    for i, (dx, dy, r_) in enumerate(((-26, -20, 7.0), (-12, -27, 7.5), (2, -30, 8.0), (16, -27, 7.5), (29, -20, 7.0))):
        _wheel(P_, cx + dx, seat + dy, r_, r_ * 0.95)
    for (dx, dy, r_) in ((-20, -24, 6.0), (22, -24, 6.0)):
        P_.ellipse(cx + dx, seat + dy + r_ - 1, 1, 1, SR['castiron'][2])
    for side in (-1, 1):
        _cone(P_, cx + side * 30, seat + 9, 9)
    # the ledge in front: a fridge on its side with a board on top, top face at y 150 (frame row 64)
    x0, x1 = LEDGES[1][0] - (KING_X - PILE_W / 2), LEDGES[1][1] - (KING_X - PILE_W / 2)
    P_.blit(ledge_part(x1 - x0 + 4, seed + 7), x0 - 2, LEDGE_Y - 2 - (176 - PILE_AY))
    return P_


def ledge_part(w, seed=1):
    """A trash ledge (w px, 18 tall): a board (an old door) across a fridge on its side and crates; its top face on
       rows 0-2 (the platform line at row 2: y 150), bags at its foot."""
    rng = random.Random(seed)
    L = Layer(w, 18)
    Wd, Wh, K = SR['wood'], SR['mattress'], SR['black']
    fw = min(26, w * 0.4)
    L.rect(1, 4, fw, 13, Wh[4]); L.hl(1, 4, fw, Wh[6]); L.vl(1, 4, 13, Wh[5]); L.vl(fw, 4, 13, Wh[2])
    L.hl(2, 9, fw - 2, Wh[2], t=TH); L.rect(fw - 5, 6, 1.5, 6, SR['castiron'][2])
    L.rect(4, 14, 6, 2, SR['rust'][2]); L.px(14, 7, SR['rust'][3])
    _crate(L, fw + 3, 17, 10, 8, col='orange')
    _crate(L, fw + 14, 17, 9, 7, col='blue')
    L.rect(w - 12, 6, 11, 11, K[2]); L.ellipse(w - 6.5, 9, 5.5, 4.5, K[3]); L.px(w - 8, 7, K[6])
    L.rect(0, 1, w, 3, Wd[3]); L.hl(0, 1, w, Wd[5]); L.hl(0, 0.5, w, Wd[6], t=TH); L.hl(0, 3.5, w, Wd[1], t=TH)
    for xk in np.arange(3, w - 2, 9):
        L.vl(xk, 1, 3, Wd[2], t=TH)
    L.rect(w * 0.55, 1, 3, 1, SR['castiron'][4])
    for xk in np.arange(2, w, 7.0):
        L.ellipse(xk + rng.uniform(-1, 1), 16.5, 3.2, 1.8, K[rng.choice((1, 2))])
    return L


def gold_chain():
    """Gerrit's gold chain (18 x 7; the game's anchor (9, 7) on its lower edge): heavy curb links lying in a loop on
       the slope, a medallion."""
    Y = SR['yellow'] if 'yellow' in SR else R['yellow']
    L = Layer(18, 7)
    for i in range(9):
        x = 1 + i * 1.8
        y = 2.5 + math.sin(i * 0.8) * 1.6
        L.ellipse(x, y, 1.0, 0.8, Y[3] if i % 2 else Y[4])
        L.px(x - 0.5, y - 0.5, Y[6])
    L.rect(13, 2.5, 4, 4, Y[4]); L.hl(13, 2.5, 4, Y[6]); L.vl(16.5, 2.5, 4, Y[2], t=TH); L.px(14.5, 4, Y[2])
    return L


def plinth_part(w=52, h=20, seed=1):
    """A brick plinth for a spitter (one-way top at y 148): a granite cap (its top face 2 px), brick, slime at the foot."""
    B, Gr, Sl = SR['sbrick'], SR['granite'], SR['slime']
    L = Layer(w, h)
    brickfill(L, 2, 4, w - 4, h - 4, B, seed, mid=3, lo=1, hi=5)
    L.vl(2, 4, h - 4, B[5]); L.vl(w - 3, 4, h - 4, B[1])
    L.rect(0, 0, w, 4, Gr[4]); L.hl(0, 0, w, Gr[6]); L.hl(0, 2, w, Gr[5], t=TH); L.hl(0, 3.5, w, Gr[1], t=TH)
    for xk in np.arange(8, w - 4, 13):
        L.vl(xk, 0, 4, Gr[2], t=TH)
    xx, yy = grid(2, 4, w - 4, h - 4)
    sl = (yy > h - 6 + 3 * vnoise(xx / 5.0, yy * 0, seed)) | ((fbm(xx / 3.0, yy / 6.0, seed + 1, 2) > 0.66) & (yy > 8))
    L.put(2, 4, np.array(Sl, np.uint8)[np.clip(2 + (hs(xx, yy, seed) > 0.6), 0, 6)], sl)
    return L


# ---------------------------------------------------------------- carriers for the game's hall eyes (after the flush)
def carriers_for_eyes(sec, H, eyes=HALL_EYES, cam=LOCK_CAM, paint_eyes=(), skip=('d0',), pre=None):
    """For each eye of the game (world x, y at speed 1, camera locked at `cam`): find the topmost scenery layer under it
       at that camera (img / frames layers that are not over the hero, the walk plane left out) and paint a dark hole
       there, in every frame, at the plane position of that camera. paint_eyes: indices that also get painted eyes (the
       hall's rats in the dark). pre: {index: layer id} of eyes whose carrier (a pipe mouth) was painted before; no
       hole over it when that layer is the topmost. Records the holes in sec.notes['fat_holes'] (plane x, y, rx, ry, speed) for the gate
       and returns [(eye, layer id)]."""
    E = [tuple(int(v) for v in snap5(c)) for c in H['em']['eye']]
    V = gramp('void', G_of(H, H['air']))
    rim = gramp('black', G_of(H, H['air']))[0]
    lip = gramp('sbrick_b', G_of(H, H['air']))[3]
    out = []
    for i, (ex, ey) in enumerate(eyes):
        sx = ex - cam
        hit = None
        for ly in reversed(sec.layers):
            if ly.get('over') or ly['id'] in skip or ly['kind'] not in ('img', 'frames'):
                continue
            im = ly['img'] if ly['kind'] == 'img' else ly['frames'][0]
            px_ = P(sx + cam * ly['speed'])
            py_ = P(ey) - P(ly['y'])
            if 0 <= py_ < im.ph and 0 <= px_ < im.pw and im.a[py_, px_, 3] > 0:
                hit = ly
                break
        if hit is None:
            out.append(((ex, ey), None))
            continue
        x = sx + cam * hit['speed']
        y = ey - hit['y']
        ims = [hit['img']] if hit['kind'] == 'img' else list(hit['frames'])
        mouth = (pre or {}).get(i) == hit['id']
        for im in ims:
            if not mouth:
                hole_px(im, x, y, 4.4, 2.4, seed=i, V=V, rim=rim, lip=lip)
            if i in paint_eyes:
                eyes_px(im, x, y + 0.2, E)
        r_ = (3.0, 2.6) if mouth else (4.4, 2.4)
        sec.notes.setdefault('fat_holes', []).append((x, ey, r_[0], r_[1], hit['speed']))
        out.append(((ex, ey), hit['id']))
    return out
