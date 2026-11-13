# The painters of section b of mission `sewers` (DE STEEGJES, 01:00, rain): the wet alley floor with its central
# gutter, the klinkers of the alley mouth and the paving of the church square; the cast-iron grates of the game's
# `sewers-grate` entity as canal sprites (top anchor); the corner of the last alley house as depth strips; the church's
# nave behind the square. Built on parts_wallen (read only) and the kit core. Wave P4b, painter B.
import math
import random
import numpy as np
from level import *
from parts_wallen import *
from game_sprites import Sprite, walk_grade

ALLEY_D = 6.0                 # the alley's far wall (the game's alleyBack: y 170)
SQUARE_D = 26.0               # the square's back edge: the church wall's foot (the game's squareBack: y 150)
MOUTH, SQUARE = 1280.0, 1536.0
GUTTER = (1.4, -7.4)          # the gutter's depth band: the game draws its grates from y 176 to 182 (depth 0 .. -6)
GUTTER_C = -3.0               # the runnel (the gutter's low line)

R['b_slab'] = ramp(7, .18, .70, .010, .018, .022, 255, 230)       # the square's granite slabs, wet: cool grey
R['b_gutter'] = ramp(7, .17, .66, .008, .014, .018, 250, 225)     # the flat gutter stones (hardstone)
EYES = [tuple(int(v) for v in snap5(np.array(c, float))) for c in ((255, 246, 160), (255, 48, 32), (170, 10, 22))]
GLEAM = [tuple(int(v) for v in snap5(np.array(c, float))) for c in ((16, 70, 46), (34, 140, 80), (100, 230, 120))]


# ---------------------------------------------------------------- the floor
def b_floor_extra(sec, passage=None):
    """floor_layer's extra for b: wet setts in the alleys with a central gutter of flat stones (the runnel at depth -3,
       its grates in the game's own spots), smoked klinkers in the alley mouth, a granite threshold where the gutter
       ends at the square, the square in big wet granite slabs with a band of setts along the church's foot, puddles."""
    WC, KS, GS, SL = (np.array(R[n], np.uint8) for n in ('wet_cobble', 'brick_smoke', 'b_gutter', 'b_slab'))
    ST = np.array(R['stone'], np.uint8)
    g0, g1 = GUTTER

    def extra(u, d, v, rgb):
        h1 = hash01
        # the alleys: setts in rows along the street, wet and cold
        al = u < MOUTH
        if al.any():
            j = np.floor(v / 4.0); uu = u / 5.0 + 0.5 * (j % 2); i = np.floor(uu)
            fu, fv = uu - i, v / 4.0 - j
            base = 3 + (h1(i, j, 31) > 0.66) - (h1(i, j, 32) > 0.80)
            dome = (fu - 0.40) ** 2 + (fv - 0.42) ** 2
            t = np.where(dome < 0.045, base + 2, base)
            t = np.where((fu > 0.62) & (fv > 0.55), base - 1, t)
            t = np.where((fu < 0.10) | (fv < 0.12), 0, t)
            rgb[al] = WC[np.clip(t, 0, 6)][al]
        # the alley mouth: smoked klinkers in a herringbone of 6 x 3
        mo = (u >= MOUTH) & (u < SQUARE)
        if mo.any():
            j = np.floor(v / 3.0); k = np.floor((u + v * 2.0) / 6.0)
            par = (j + k) % 2 == 0
            uu = np.where(par, u / 6.0 + 0.5 * (j % 2), (u + 3.0) / 3.0)
            i = np.floor(uu); fu = uu - i; fv = v / 3.0 - j
            t = 3 + (h1(i, j, 33) > 0.70) - (h1(i, j, 34) > 0.82)
            t = np.where((fv < 0.20) & (fu > 0.08), t + 1, t)
            t = np.where((fu < 0.08) | (fv > 0.86), 1, t)
            rgb[mo] = KS[np.clip(t, 0, 6)][mo]
        # the square: granite slabs 16 x 10, the joints dark and wet; a band of setts along the church foot
        sq = u >= SQUARE
        if sq.any():
            i, j = np.floor(u / 16.0 + 0.5 * (np.floor(v / 10.0) % 2)), np.floor(v / 10.0)
            fu, fv = u / 16.0 + 0.5 * (j % 2) - i, v / 10.0 - j
            t = 4 - (h1(i, j, 51) > 0.66) + (h1(i, j, 52) > 0.86)
            t = np.where((fv < 0.14) & (fu > 0.04), t + 1, t)
            t = np.where((fu < 0.04) | (fv < 0.07), 1, t)
            stain = fbm(u / 26.0, v / 9.0, 53, 3) < 0.34
            t = np.where(stain & (h1(u * 2, v * 2, 54) > 0.35), t - 1, t)
            rgb[sq] = SL[np.clip(t, 0, 6)][sq]
            ap = sq & (d >= SQUARE_D - 4.5)
            j = np.floor(v / 4.0); uu = u / 5.0 + 0.5 * (j % 2); i = np.floor(uu)
            fu, fv = uu - i, v / 4.0 - j
            t = 3 + (h1(i, j, 55) > 0.66) - (h1(i, j, 56) > 0.80)
            t = np.where((fu < 0.10) | (fv < 0.12), 0, t)
            rgb[ap] = WC[np.clip(t, 0, 6)][ap]
            edge = sq & (np.abs(d - (SQUARE_D - 4.5)) < 0.5)
            rgb[edge] = ST[2]
        # the gutter: two rows of flat stones that slope to the runnel, joints every 12 px, the runnel wet
        gm = (u < SQUARE - 3.0) & (d < g0) & (d > g1)
        if gm.any():
            k = np.floor(u / 12.0 + 0.5 * (d < GUTTER_C))
            fu = u / 12.0 + 0.5 * (d < GUTTER_C) - k
            far = d >= GUTTER_C
            slope = np.where(far, (d - GUTTER_C) / (g0 - GUTTER_C), (GUTTER_C - d) / (GUTTER_C - g1))
            t = np.where(far, 2 + (slope > 0.45), 4 + (slope > 0.55)) + (h1(k, np.floor(d), 61) > 0.78)
            t = np.where(fu < 0.05, 1, t)
            t = np.where(np.abs(d - GUTTER_C) < 0.55, 1, t)                     # the runnel: water in the low line
            t = np.where((np.abs(d - g0) < 0.45) | (np.abs(d - g1) < 0.45), 0, t)   # the joint to the setts
            rgb[gm] = GS[np.clip(t, 0, 6)][gm]
            run = gm & (np.abs(d - GUTTER_C) < 0.55) & (h1(np.floor(u / 2.0), 0 * u, 62) > 0.55)
            rgb[run] = np.array((150, 162, 196), np.uint8)
        # the threshold of the square: a granite strip across the band where the gutter ends
        th = (u >= SQUARE - 3.0) & (u < SQUARE)
        rgb[th] = ST[4]
        rgb[th & (u < SQUARE - 2.4)] = ST[6]
        rgb[th & ((np.floor(v / 9.0) % 2) == 0) & (u >= SQUARE - 0.6)] = ST[2]
        # puddles: in the setts and the square, never in the gutter (it runs)
        pm = puddles(u, v) & ~gm & (d < SQUARE_D - 5) & ~th
        pm &= (u >= SQUARE) | (d < ALLEY_D - 0.5)
        rgb[pm] = np.array((150, 162, 196), np.uint8)
        e = puddles(u + 1.2, v) & ~pm & ~gm & (d < SQUARE_D - 5)
        rgb[e] = (rgb[e].astype(int) * 3 // 4).astype(np.uint8)
        if passage is not None:                                      # the passage's floor: in the dark of the house
            pm_ = (u >= passage[0] - 8) & (u < passage[1] + 8) & (d > ALLEY_D)
            rgb[pm_] = (rgb[pm_].astype(int) * 3 // 5).astype(np.uint8)
    return extra


# ---------------------------------------------------------------- the grates (canal sprites of `decor/sewers-grate/*`)
GRATE_W = dict(gutter=16, eruption=24, big=64)


def grate_px(w, frame):
    """A cast-iron grate seen at the game's slant, in its granite frame: (w + 2) x 6, the game's frame box (anchor: the
       top centre, the paving line). frame 0 shut, 1 shut with red eyes in the slots, 2 the open hole (black, a green
       gleam deep down, the broken rim). Daylight colours (the eyes and the gleam are emitters)."""
    I = R['iron']; S = R['stone']; K = R['black']
    W = w + 2
    L = Layer(W, 6)
    L.rect(0, 0, W, 6, S[2]); L.hl(0, 0, W, S[5]); L.hl(0, 5, W, S[1])
    L.vl(0, 0, 6, S[3]); L.vl(W - D1, 0, 6, S[1], t=TH)
    L.rect(1, 1, w, 4, I[2]); L.hl(1, 1, w, I[4]); L.hl(1, 4.5 if U > 1 else 4, w, I[1])
    if frame == 2:
        L.rect(1.5, 1.5, w - 1, 3.5, K[0])
        r = random.Random(w)
        for _ in range(max(2, w // 6)):                                 # the broken rim
            L.px(r.uniform(1.5, w), 1.5, I[3])
        L.rect(w * 0.3, 3.5, max(2, w * 0.4), D1, GLEAM[0])
        L.px(w * 0.5, 3.0 + D1, GLEAM[1])
        if w >= 40:
            L.px(w * 0.35, 4.0, GLEAM[0]); L.px(w * 0.68, 3.5, GLEAM[1])
        return L
    L.rect(1.5, 1.5, w - 1, 3, K[0])                                    # the slots: dark water below
    step = 2.0 if U == 1 else 1.5
    x = 2.0
    k = 0
    while x < w + 0.5:
        L.vl(x, 1.5, 3, I[3], t=TH if U > 1 else 1)
        L.px(x, 1.5, I[5])
        x += step
        k += 1
    if w >= 40:                                                         # the big grate: a frame of four panels
        for xx in (w * 0.25 + 1, w * 0.5 + 1, w * 0.75 + 1):
            L.vl(xx, 1, 4, I[4] if U > 1 else I[3], t=1)
            L.px(xx, 1, I[6])
    L.hl(1.5, 3.5, w - 1, I[2], t=TH)                                   # the cross bar
    r = random.Random(w * 7 + 1)
    for _ in range(max(2, w // 5)):                                      # wet glints on the bars
        L.px(r.uniform(2, w), r.choice((1.5, 2.0, 3.5)), I[6])
    if frame == 1:
        for ex in np.arange(3.5, w - 1, 9.0):                           # red eyes between the bars
            L.px(ex, 2.5, EYES[1]); L.px(ex + 1.5 if U > 1 else ex + 2, 2.5, EYES[1])
            if U > 1:
                L.px(ex, 2.5, EYES[0])
    return L


def lid_px(w, frame):
    """The lid alone: flat (frame 0, w x 3, anchor: the feet) or edge-on (frame 1, 4 x h)."""
    I = R['iron']; K = R['black']
    if frame == 1:
        h = {16: 6, 24: 8, 64: 21}[w]
        L = Layer(4, h)
        L.rect(1, 0, 2, h, I[3]); L.vl(1, 0, h, I[5], t=TH); L.vl(3 - D1, 0, h, I[1], t=TH)
        for y in np.arange(1.5, h - 1, 2.0):
            L.px(2, y, K[1])
        return L
    L = Layer(w, 3)
    L.rect(0, 0, w, 3, I[2]); L.hl(0, 0, w, I[4]); L.hl(0, 2, w, I[1])
    for x in np.arange(1, w - 0.5, 2.0 if U == 1 else 1.5):
        L.vl(x, 1, 1.5, K[0], t=TH if U > 1 else 1)
    return L


def grate_grade(sec):
    keep = EYES + GLEAM

    def fn(L):
        L.recolor(grader(key=sec.KEY), keep=keep)
        L.recolor(curve(*sec.H['curve']), keep=keep)
        L.a[..., :3] = snap5(L.a[..., :3])
        return L
    return fn


def grates(sec, gutters, eruptions, big):
    """The game's grates. Page / previews: frame 0 painted on the walk plane with its top on the walk line (the game's
       anchor row). Game bake: every frame of every kind and the lids become canal sprites (one picture per id)."""
    out = []
    if GAME:
        recs = sec.notes.setdefault('game_sprites', [])
        g = grate_grade(sec)
        for kind, w in GRATE_W.items():
            for f in (0, 1, 2):
                P_ = grate_px(w, f)
                recs.append((Sprite('decor/sewers-grate/%s' % kind, (f,), P_, ax=P_.w / 2.0, ay=0), g))
            for f in (0, 1):
                P_ = lid_px(w, f)
                recs.append((Sprite('decor/sewers-grate/%s-lid' % kind, (f,), P_), g))
        return out
    Lp, k = sec.plane(0)
    for kind, xs in (('gutter', gutters), ('eruption', eruptions), ('big', [big])):
        for x in xs:
            P_ = grate_px(GRATE_W[kind], 0)
            Lp.blit(P_, x - P_.w / 2.0, GY)
            out.append((kind, x))
    return out


# ---------------------------------------------------------------- the corner of the last alley house (depth strips)
def corner_side(sec, ue, body, roof, brick, depths, ws=7.0, ref=ALLEY_D):
    """The east wall of the alley's last house at world x ue, from the alley wall (ref) back to the church: thin strips
       in the planes of `depths`, so it opens with the camera (grammar rule 6). body, roof: plane px at the depth ref.
       The east face is in the shade (the light from the upper left); a drainpipe, a stone plinth, the roof slope."""
    B, RT, S, I = (np.array(R[n], np.uint8) for n in (brick, 'roof_slate', 'stone', 'iron'))
    sref = s_d(ref)
    for dpt in depths:
        Lp, k = sec.plane(dpt)
        sp = s_d(k)
        scl = sp / sref
        yb = GY - k
        yw = yb - body * scl
        yr = yw - roof * scl
        p0, p1 = sec.at(ue - ws, sp) - 1, sec.at(ue, sp)
        xx, yy = grid(p0, yr - 1, p1 - p0, yb - yr + 1)
        if xx.size == 0:
            continue
        u = 192 + (xx + 0.5 / U - 192) / sp
        y = yy + 0.5 / U
        m = (u >= ue - ws) & (u < ue) & (y >= yr) & (y < yb)
        r_ = np.floor(y * DET / 2.0)
        cell = hash01(np.floor((u * sp + (r_ % 2) * 2) / 4.0 * DET), r_, int(dpt * 7))
        t = 2 + (cell > 0.85).astype(int) - (cell < 0.15).astype(int) - (((y * DET / 2.0) - r_) < 0.25).astype(int) * (U >= 4)
        rgb = B[np.clip(t, 0, 6)]
        rf = y < yw
        rgb[rf] = RT[np.clip(2 + ((np.floor(y * DET) % 2) == 0).astype(int), 0, 6)][rf]
        rgb[(y >= yw) & (y < yw + 1)] = S[3]
        rgb[y >= yb - 3 * scl] = S[2]
        if abs(k - (ref + 2.0)) < 0.6:                                    # the drainpipe near the front
            rgb[(y >= yw) & (y < yb)] = I[2]
        if abs(k - 15.0) < 0.6:                                           # a side window, dark, halfway back
            win = (y > yw + body * scl * 0.30) & (y < yw + body * scl * 0.30 + 12 * scl)
            rgb[win] = np.array(R['glass'][1], np.uint8)
        Lp.put(p0, yr - 1, rgb, m)


# ---------------------------------------------------------------- the church (backdrop only)
def ridge_turret(h, s):
    """A small lead ridge turret (a lantern and a slender spire) for the nave's ridge, h px tall at speed s."""
    LD = R['lead']; Y = R['yellow']
    w = max(5, int(round(13 * 2.6 * s)))
    L = Layer(w + 2, h)
    cx = (w + 2) / 2.0
    base = h * 0.40
    L.rect(1, h - base, w, base, LD[3]); L.vl(1, h - base, base, LD[5]); L.vl(w, h - base, base, LD[1])
    for xx in np.arange(2, w, 2):
        L.vl(xx, h - base + 2, base - 4, R['black'][1], t=TH)
    L.hl(0, h - base, w + 2, LD[5])
    sp = h - base
    for j in sub(0, sp):
        hw = max(D1, (w * 0.42) * (j / max(sp, 1)) ** 1.2)
        L.rect(cx - hw, j, 2 * hw, D1, LD[4]); L.rect(cx, j, hw, D1, LD[2])
    L.px(cx, 0, Y[5]); L.px(cx, 1, Y[4])
    return L


def church_flank(w, h, s, seed=7, roof=0.22, gables=True):
    """The long side of the old church at the plane of speed s (a copy of parts_wallen.church_wall, changed): the lead
       roof is a low band (roof x h) and, with gables=True, every bay between two buttresses carries its chapel's own
       pointed gable (brick, a stone coping, a small dark oculus) against the night: the row of chapel gables of an old
       Dutch church. w x h px of the wall to the eaves. Returns (Layer, info: buttress x, windows, bay, eaves row)."""
    B = R['brick_brown']; S = R['church']; G = R['glass']; LD = R['lead']; I_ = R['iron']
    bay = max(12, int(round(13 * 9.0 * s)))
    bw = max(4, int(round(13 * 1.3 * s)))
    gh = int(round(bay * 0.46)) if gables else 0
    rh = int(round(h * roof))
    top = max(rh, gh) + 4
    L = Layer(w, h + top)
    y_e = top                                                        # the eaves row
    # the lead roof band behind the gables: strips with rolls, darker toward the ridge
    for x in sub(0, w):
        t = (int(x * DET) // 3) % 2
        L.rect(x, y_e - rh, D1, rh, LD[3] if t else LD[2])
        L.rect(x, y_e - rh, D1, rh * 0.35, LD[2] if t else LD[1])
    for x in np.arange(0, w, 4.5):
        L.vl(x, y_e - rh, rh, LD[4], t=TH)
    L.hl(0, y_e - rh, w, LD[5], t=TH); L.hl(0, y_e - 2, w, LD[1]); L.hl(0, y_e - 1, w, S[2])
    brickfill(L, 0, y_e, w, h, B, seed, lo=2, hi=4, mid=3, streaks=True)
    info = dict(buttress=[], windows=[], bay=bay, eaves=y_e, gables=[])
    x = bay // 2
    while x < w + bay:
        ww = int(round((bay - bw) * 0.46))
        wx = x + bw // 2 + int(round((bay - bw - ww) / 2.0))
        cx = x + bay / 2.0
        kind = ['point', 'point', 'step', 'point', 'portal', 'step', 'point', 'point'][len(info['buttress']) % 8]
        if gables:                                                   # the chapel gable over this bay: brick, coping
            gw = bay - bw
            gx = x + bw / 2.0
            T = Layer(gw, gh)
            brickfill(T, 0, 0, gw, gh, B, seed + len(info['buttress']) * 5, lo=1, hi=4, mid=2 if kind == 'step' else 3)
            xx, yy = grid(0, 0, gw, gh)
            tt = np.abs((xx + 0.5 * D1 - gw / 2.0) / (gw / 2.0))
            if kind == 'step':                                       # a stepped gable: five steps a side
                lvl = np.floor((1 - tt) * 5.0) / 5.0
                prof = gh * np.minimum(1.0, lvl + 0.2)
            else:
                prof = gh * (1 - tt)
            out_ = yy < gh - prof
            T.a[out_] = 0
            side_ = np.zeros_like(out_)
            side_[:, 1:] |= out_[:, :-1]; side_[:, :-1] |= out_[:, 1:]
            edge = ~out_ & ((yy < gh - prof + 1.0) | side_)
            T.a[..., :3][edge & (xx < gw / 2.0)] = S[5]
            T.a[..., :3][edge & (xx >= gw / 2.0)] = S[3]
            L.blit(T, gx, y_e - gh)
            L.ellipse(cx, y_e - gh * 0.40, gh * 0.12 + 0.6, gh * 0.12 + 0.6, S[4])
            L.ellipse(cx, y_e - gh * 0.40, gh * 0.07 + 0.3, gh * 0.07 + 0.3, G[0])
            L.vl(cx, y_e - gh - 2, 2, S[5]); L.px(cx, y_e - gh - 2.5, S[6])
            info['gables'].append(cx)
        if kind == 'portal' and ww >= 5:                             # a side portal: closed oak doors in a pointed arch
            pw_ = int(round(ww * 1.1))
            px_ = cx - pw_ / 2.0
            py0, py1 = y_e + h * 0.42, y_e + h - max(3, h * 0.07)
            hd = pw_ * 0.55
            WD = R['wood']
            for i in sub(-2, pw_ + 2):
                q = abs((i + 0.5 * D1 - pw_ / 2.0) / (pw_ / 2.0 + 2))
                yy = py0 + hd * (1 - (1 - q) ** 0.62) - 2
                L.rect(px_ + i, yy, D1, py1 - yy, S[4] if i < pw_ / 2 else S[3])
            for i in sub(0, pw_):
                q = abs((i + 0.5 * D1 - pw_ / 2.0) / (pw_ / 2.0))
                yy = py0 + hd * (1 - (1 - q) ** 0.62)
                L.rect(px_ + i, yy, D1, py1 - yy, WD[1] if (int(i * DET) // 2) % 3 else WD[0])
            L.vl(cx, py0 + 2, py1 - py0 - 2, WD[0])
            for yy in np.arange(py0 + hd * 0.6, py1 - 2, 4):
                L.hl(px_ + 1, yy, pw_ - 2, I_[1], t=TH)
            L.px(cx - 1.5, (py0 + py1) / 2 + 2, I_[4]); L.px(cx + 1, (py0 + py1) / 2 + 2, I_[4])
            info['portal'] = (px_, py0, pw_, py1 - py0)
        if ww >= 5 and kind != 'portal':
            wy0, wy1 = y_e + h * 0.20, y_e + h * 0.80
            head = ww * 0.62
            arc = lambda i, wd: head * (1 - (1 - abs((i + 0.5 * D1 - wd / 2.0) / (wd / 2.0))) ** 0.62)
            for i in sub(0, ww + 2):
                yy = wy0 + arc(i, ww + 2) - 1
                L.rect(wx - 1 + i, yy, D1, wy1 - yy + 1, S[4] if i < (ww + 2) * 0.5 else S[3])
            for i in sub(0, ww):
                yy = wy0 + 1 + arc(i, ww)
                L.rect(wx + i, yy, D1, wy1 - yy - 1, G[0] if (int(i * DET) // 2) % 2 else G[1])
                L.rect(wx + i, yy, D1, 1, S[1])
            for yy in np.arange(wy0 + head + 2, wy1 - 2, max(3, (wy1 - wy0) / 8)):
                L.hl(wx, yy, ww, LD[2], t=TH)
            for k in (1, 2):
                L.vl(wx + ww * k / 3.0, wy0 + head * 0.6, wy1 - wy0 - head * 0.6 - 1, S[4], t=TH * 1.5)
            L.ellipse(wx + ww / 2.0, wy0 + head * 0.55, ww * 0.18 + 0.4, ww * 0.18 + 0.4, S[4])
            L.ellipse(wx + ww / 2.0, wy0 + head * 0.55, ww * 0.10 + 0.2, ww * 0.10 + 0.2, G[1])
            L.hl(wx - 1, wy1 - 1, ww + 2, S[5]); L.hl(wx - 1, wy1, ww + 2, S[1])
            info['windows'].append((wx, wy0, ww, wy1 - wy0))
        bx = x - bw // 2
        L.rect(bx, y_e + 2, bw, h - 2, S[3]); L.vl(bx, y_e + 2, h - 2, S[5]); L.vl(bx + 1, y_e + 2, h - 2, S[4])
        L.vl(bx + bw - 1, y_e + 2, h - 2, S[1]); L.vl(bx + bw - 2, y_e + 2, h - 2, S[2], t=TH)
        L.rect(bx + bw, y_e + 2, max(1, bw * 0.3), h - 2, B[1])
        for yy in (y_e + h * 0.34, y_e + h * 0.60):
            L.rect(bx - 1, yy, bw + 2, 2.5, S[4]); L.hl(bx - 1, yy, bw + 2, S[6]); L.hl(bx - 1, yy + 2.5, bw + 2, S[0])
        L.rect(bx + 1, y_e - 3, bw - 2, 5, S[4]); L.vl(bx + 1, y_e - 3, 5, S[6]); L.vl(bx + bw - 2, y_e - 3, 5, S[2])
        ph = max(4, gh * 0.55)                                       # the pinnacle between two gables
        L.rect(bx + bw / 2.0 - 1, y_e - 3 - ph, 2, ph, S[4]); L.vl(bx + bw / 2.0 - 1, y_e - 3 - ph, ph, S[6], t=TH)
        L.vl(bx + bw / 2.0 + 1 - D1, y_e - 3 - ph, ph, S[2], t=TH); L.px(bx + bw / 2.0 - 0.5, y_e - 4 - ph, S[6])
        L.rect(bx + bw / 2.0 - 0.5, y_e - 3, 1, 3, LD[1])                # a lead gutter spout between the chapels
        for yy in np.arange(y_e + 6, y_e + h - 4, 5):
            L.hl(bx + 1, yy, bw - 2, S[2], t=TH)
        info['buttress'].append(x)
        x += bay
    py = y_e + h - max(3, h * 0.07)
    L.rect(0, py, w, y_e + h - py, S[3]); L.hl(0, py, w, S[5]); L.hl(0, py + 1, w, S[4], t=TH)
    L.hl(0, y_e + h - 1, w, S[1])
    return L, info


def church_light(L, info, x0, foot, h, col=(240, 214, 166), a=(0.30, 0.14)):
    """The church at night, lit from ground fixtures before the buttresses: a narrow fan up each buttress (two
       steps, the detail stays); the bays between stay in the night."""
    for bx in info['buttress']:
        tint(L, x0 + bx, foot, info['bay'] * 0.26, h * 0.66, col, a[0], a[1], ymax=foot)


# ---------------------------------------------------------------- a passage through a house (a 'poort') to a courtyard
def carve_passage(L, f, pa, pb, foot, sc, seed=5):
    """Turn the ground floor of the front f (absolute info of wallen_row) into a brick wall with a round-arched passage
       from plane x pa to pb (the hole is left transparent: the planes behind show through). Returns the arch's crown
       height over the foot (plane px). The front's ground-floor openings are dropped from its info (no rooms there)."""
    B = R[f['brick']]; S = R['stone']
    gt = f['gf_top']
    x0, x1 = f['x'], f['x'] + f['w']
    brickfill(L, x0 + 1, gt + 1, f['w'] - 2, foot - gt - 1, B, seed, lo=1, hi=5, streaks=True)
    L.hl(x0, gt, f['w'], S[4]); L.hl(x0, gt + 1, f['w'], S[2], t=TH)               # the band over the ground floor
    L.rect(x0, foot - 3, f['w'], 3, S[2]); L.hl(x0, foot - 3, f['w'], S[4])         # the plinth
    ow = pb - pa
    r = ow / 2.0
    spring = max(14.0, 2.3 * 13 * sc)
    crown = spring + r
    cx = (pa + pb) / 2.0
    # the stone surround: jambs and a ring of voussoirs, a keystone
    xx, yy = grid(pa - 3, foot - crown - 3, ow + 6, crown + 3)
    dy = (foot - spring) - yy
    rr = np.hypot(xx + 0.5 * D1 - cx, np.maximum(dy, 0))
    ring = (rr < r + 2.6) & ((dy > 0) | (np.abs(xx + 0.5 * D1 - cx) < r + 2.6))
    vou = np.floor(np.arctan2(np.maximum(dy, 0), xx + 0.5 * D1 - cx) / (math.pi / 9))
    tone = np.where(xx < cx, 4, 3) + ((vou % 2) == 0)
    jst = np.floor((yy - (foot - spring)) / 3.0)
    tone = np.where(dy <= 0, np.where(xx < cx, 4, 3) + ((jst % 2) == 0), tone)
    L.put(pa - 3, foot - crown - 3, np.array(S, np.uint8)[np.clip(tone, 0, 6)], ring)
    L.rect(cx - 1.5, foot - crown - 3.5, 3, 4, S[5]); L.hl(cx - 1.5, foot - crown - 3.5, 3, S[6])
    # the hole
    hole = (rr < r) & ((dy > 0) | (np.abs(xx + 0.5 * D1 - cx) < r))
    hole &= (yy < foot)
    v = L.view(pa - 3, foot - crown - 3, ow + 6, crown + 3)
    if v.shape[:2] == hole.shape:
        v[..., 3][hole] = 0
    f.update(gfwin=[], rooms=[], door=None, shutters=[], mode='house', sign=(x0 + 2, gt + 1, f['w'] - 4, 0))
    f['win'] = list(f['upper'])
    return crown


def passage_sides(sec, u0, u1, crown, depths, ws=6.0, ref=ALLEY_D):
    """The two side walls of the passage from u0 to u1 (world x), from the street front (ref) back: strips in the planes
       of `depths` (the corner's planes), as tall as the arch (crown: plane px at ref), dark wet brick that takes the
       courtyard's warm light toward the far end."""
    B = np.array(R['brick_brown'], np.uint8)
    sref = s_d(ref)
    dmax = max(depths)
    for dpt in depths:
        Lp, k = sec.plane(dpt)
        sp = s_d(k)
        scl = sp / sref
        yb = GY - k
        yt = yb - (crown + 3) * scl
        for (a, b, side) in ((u0 - ws, u0, -1), (u1, u1 + ws, 1)):
            p0, p1 = sec.at(a, sp) - 1, sec.at(b, sp) + 1
            xx, yy = grid(p0, yt, p1 - p0, yb - yt)
            if xx.size == 0:
                continue
            u = 192 + (xx + 0.5 / U - 192) / sp
            y = yy + 0.5 / U
            m = (u >= a) & (u < b) & (y >= yt) & (y < yb)
            r_ = np.floor(y * DET / 2.0)
            cell = hash01(np.floor((u * sp + (r_ % 2) * 2) / 4.0 * DET), r_, int(dpt * 3) + side)
            lit = (k - ref) / max(dmax - ref, 1)
            t = 0 + (lit > 0.6) + (lit > 0.9) + (cell > 0.86).astype(int)
            t = t - ((((y * DET / 2.0) - r_) < 0.25) & (U >= 4)).astype(int)
            rgb = B[np.clip(t, 0, 6)]
            rgb[y >= yb - 2.5 * scl] = np.array(R['stone'][1], np.uint8)
            Lp.put(p0, yt, rgb, m)


def courtyard_end(sec, u0, u1, depth, crown, ref=ALLEY_D, seed=3):
    """The far end of the passage at `depth`: the passage's dark back with its own arch, and through it the lit
       courtyard (a whitewashed wall, a green door, a lantern, pots, a bike), in the plane of that depth. Daylight
       colours; the lantern is an emitter. Returns the lantern's (plane x, y) for its light."""
    Lp, k = sec.plane(depth)
    sp = s_d(k)
    scl = sp / s_d(ref)
    yb = GY - k
    cx = sec.at((u0 + u1) / 2.0, sp)
    hw = (u1 - u0) * sp / 2.0 + 60
    B = R['brick_brown']; P_ = R['plaster']; G = R['green']; S = R['stone']
    top = yb - (crown + 30) * scl
    brickfill(Lp, cx - hw, top, 2 * hw, yb - top, B, seed, lo=0, hi=2, mid=1)      # the dark back of the passage
    r = (u1 - u0) * sp / 2.0 * 0.86
    spring = (crown - (u1 - u0) * s_d(ref) / 2.0) * scl
    xx, yy = grid(cx - r, yb - spring - r, 2 * r, spring + r)
    dy = (yb - spring) - yy
    hole = (np.hypot(xx + 0.5 * D1 - cx, np.maximum(dy, 0)) < r)
    # the courtyard seen through it: whitewash, a door, a lantern, pots
    C = Layer(int(2 * r) + 2, int(spring + r) + 2)
    C.rect(0, 0, C.w, C.h, P_[4])
    for yy_ in np.arange(1, C.h, 2.5):
        C.hl(0, yy_, C.w, P_[3], t=TH)
    C.rect(0, C.h - 4, C.w, 4, S[2]); C.hl(0, C.h - 4, C.w, S[4])
    C.rect(C.w * 0.58, C.h - 4 - spring * 0.72, max(4, C.w * 0.22), spring * 0.72, G[2]); C.vl(C.w * 0.58, C.h - 4 - spring * 0.72, spring * 0.72, G[4])
    C.ellipse(C.w * 0.22, C.h - 5, 2.2, 1.6, R['wood'][2]); C.ellipse(C.w * 0.22, C.h - 7, 2.6, 2.4, R['leaf'][2])
    C.ellipse(C.w * 0.34, C.h - 5, 1.6, 1.2, R['wood'][3]); C.ellipse(C.w * 0.34, C.h - 6.5, 1.8, 1.8, R['leaf'][3])
    lx, ly = C.w * 0.45, C.h - 4 - spring * 0.80
    C.rect(lx - 1, ly - 1, 3, 4, EM[1]); C.hl(lx - 1.5, ly - 1.5, 4, R['iron'][2])
    xs, ys = grid(cx - r, yb - spring - r, C.w, C.h)
    v = Lp.view(cx - r, yb - spring - r, 2 * r, spring + r)
    sub_ = C.a[:v.shape[0], :v.shape[1]]
    if v.shape[:2] == hole.shape:
        v[hole] = sub_[hole]
    return (cx - r + lx, yb - spring - r + ly)


def b_wet_post(sec, img, lights, seed=5):
    """parts_wallen.wet_floor_post, changed for b: the puddles of the alleys take the neon of the street (as there),
       the puddles of the square only the violet of the sky and the warm of the floodlights and lanterns (no neon
       stands on the square). The light pools are the same."""
    u, d, v = floor_uvd(sec, img)
    pm = puddles(u, v) & (d < SQUARE_D - 0.5)
    wet = sec.H.get('wet', 0.8)
    a = img.a
    ck = chk(u, d)
    if pm.any():
        band = np.floor(u / 9.0)
        k = hash01(band, np.floor(v / 30.0), seed)
        neon = np.array([s5((84, 70, 150)), s5((84, 70, 150)), s5((120, 80, 170)), RED[2], PINK[2], AMBER[2]], float)
        calm = np.array([s5((84, 70, 150)), s5((84, 70, 150)), s5((100, 84, 160)), s5((120, 80, 170)), s5((84, 70, 150)), AMBER[2]], float)
        ci = np.clip((k * 6).astype(int), 0, 5)
        tgt = np.where((u < SQUARE)[..., None], neon[ci], calm[ci])
        streak = pm & (hash01(np.floor(u / 1.5), np.floor(v / 4.0), seed + 1) > 0.72)
        for m, amt in ((pm, 0.14 * wet), (streak, 0.34 * wet)):
            px = a[..., :3][m].astype(float)
            a[..., :3][m] = snap5(px + (tgt[m] - px) * amt)
    for (lx, ld, col, rad) in lights:
        col = np.array(col, float)
        e = ((u - lx) / (rad * 1.6)) ** 2 + ((d - ld + 2) / (rad * 0.35)) ** 2
        inner = (e < 0.30) | ((e < 0.45) & ck)
        outer = ((e < 0.80) | ((e < 1.0) & ck)) & ~inner
        for m, amt in ((inner, 0.36), (outer, 0.18)):
            px = a[..., :3][m].astype(float)
            a[..., :3][m] = snap5(px + (col - px) * amt)
        m = pm & (e < 1.0)
        px = a[..., :3][m].astype(float)
        a[..., :3][m] = snap5(px + (col - px) * 0.30 * wet)
