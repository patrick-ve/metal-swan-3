# Painters of the dawn screen of mission sewers (sewers-end DAGERAAD, 07:15): a quiet canal street far from the centre
# after the rain, cold pale pink and blue; the manhole the squad climbs out of (the game's entity: a canal sprite). The
# squad's white wagon that picks them up is the game's own art (the ring's wagon, wave P6c), not painted here. Wave P4b,
# painter E. Built on parts_wallen.py (read only) and level 1's house painter.
#
# No red anywhere at dawn (checks_sewers.end_rules): the bricks are brown, purple, black and ochre; no red doors, bikes,
# cars or boats.
import math
import random
import numpy as np
from level import *
from parts4 import tint
from parts_wallen import (house_a, car_far_a, tarp_boat, amst_post, quay_tree, limit_colours, floor_uvd, puddles, KEEP,
                          HALO_W, HALO_S, _c)                                             # noqa: F401

DAWN_BRICKS = ['brick_brown', 'brick_purple', 'brick_black', 'brick_ochre', 'brick_brown', 'brick_purple']
DAWN_DOORS = ['green', 'black', 'blue', 'black', 'green']
SAFE = ['black', 'blue', 'green', 'iron', 'white']                 # colours of bikes, cars and boats at dawn (no red)


DAWN_SKY = [(0, '#6c84b8'), (0.16, '#98a8d0'), (0.30, '#c4bcd8'), (0.44, '#e6c8d4'), (0.58, '#f6d6d4'), (1, '#f8dcd6')]
DAWN_CLOUD = ('#7c7ea8', '#9a96bc', '#b8a8c8', '#d6b8cc', '#ecc8d0', '#fadede')


def dawn_sky(sec, seed=12):
    """The dawn sky (speed 0), squeezed so its pink sits low over the roofs and a cold pale blue overhead (the far row
       hides the lowest band), and a thin deck of streak clouds breaking up, lit pink from below (a drifting tile)."""
    S, spal = sky(VIEW_W, 156, DAWN_SKY, n=16, seed=seed, streak=0.05)
    sec.add('sky', S, 0)
    sec.notes['spal'] = spal
    cp = [hx(c) for c in DAWN_CLOUD]
    CL = Layer(720, 124)
    for (x, y, w, h, sd) in ((0, 2, 260, 22, 31), (300, 10, 220, 20, 32), (560, 0, 180, 18, 33), (120, 30, 200, 16, 34),
                             (430, 36, 210, 16, 35), (-40, 50, 160, 12, 36), (250, 56, 180, 12, 37)):
        CL.blit(wisp(w, h, cp, sd, cover=0.48, sx=44, sy=5), x, y)
    sec.add('clouds', CL, 0.03, y=0, kind='tile', drift=0.7)
    return S, CL


def dawn_front(rng, w, s, seed):
    """One front of the outer canal ring, w px wide on the plane of speed s, daylight colours: the ground floor and two
       or three storeys under a cornice or a step, neck, bell or spout gable (the roofline against the sky), brown, purple, black or ochre
       brick, a door and ground-floor windows (a shop window now and then, its blind still down). Returns (Layer,
       info) with the house_a info and 'upper', 'gfwin', 'door'."""
    sc = 2.0 * s
    storey = 40.0 * s
    n = rng.choice((2, 2, 2, 3))
    sts = [q_(storey * (1.04 - 0.03 * j) * rng.uniform(0.96, 1.04)) for j in range(n)]
    kind = rng.choice(['cornice', 'cornice', 'cornice', 'step', 'neck', 'bell'])
    Lh, info = house_a(rng, w, 0, kind, rng.choice(DAWN_BRICKS), 'plaster' if rng.random() < 0.7 else 'stone',
                       rng.choice(DAWN_DOORS), sc=sc, shop=None, seed=seed, storeys=sts)
    gtop = Lh.h - info['gf']
    info['gf_top'] = gtop
    info['foot'] = Lh.h
    info['upper'] = [b for b in info['win'] if b[1] < gtop]
    info['gfwin'] = [b for b in info['win'] if b[1] >= gtop]
    return Lh, info


def no_red(L, amt=0.45):
    """No red at dawn (checks_sewers.end_rules): a strong red that the grade left (a tiled roof in the low light) is
       mixed toward its own grey until it no longer reads as red light."""
    from checks_sewers import is_red
    for _ in range(4):
        m = is_red(L.a)
        if not m.any():
            return
        px_ = L.a[..., :3][m].astype(float)
        g = (0.30 * px_[:, 0] + 0.59 * px_[:, 1] + 0.11 * px_[:, 2])[:, None]
        L.a[..., :3][m] = snap5(px_ + (g - px_) * amt)


def dawn_row(L, x0, x1, yb, rng, s, seed=100, wmin=34, wmax=52):
    """A tiled row of dawn fronts on the plane of speed s from x0 to x1, feet on yb (widths in plane px at s 0.5,
       scaled by 2 s). Returns (infos with absolute boxes, slots [(x, w)])."""
    k = 2.0 * s
    lo, hi = int(round(wmin * k)), int(round(wmax * k))
    infos, slots = [], []
    x, i = x0, 0
    while x < x1:
        w = rng.randint(lo, hi)
        if x1 - (x + w) < lo * 0.6:
            w = x1 - x
        Lh, info = dawn_front(rng, w, s, seed + i * 7)
        y = yb - Lh.h
        L.blit(Lh, x, y)
        mv = lambda b: (x + b[0], y + b[1], b[2], b[3])
        info.update(x=x, y=y, w=w, gf_top=info['gf_top'] + y, foot=info['foot'] + y)
        for key in ('win', 'upper', 'gfwin'):
            info[key] = [mv(b) for b in info[key]]
        infos.append(info)
        slots.append((x, w))
        x += w
        i += 1
    return infos, slots


def far_quay_dawn(sec, rng, YH=110, YQ=115, YW=120, speed=0.5, seed=100, boats=()):
    """The far quay across the canal at dawn (speed 0.5, the scale rule): the tiled row of fronts, the quay street,
       bikes, two parked cars, autumn trees half bare, the lamps still lit, the quay wall, boats under tarps; graded
       with the key and the far air; then a few warm windows and the lamps' small halos. Returns (F, info)."""
    H = sec.H
    WF = sec.lw(speed)
    F = Layer(WF, VIEW_H)
    infos, slots = dawn_row(F, 0, WF, YH, rng, speed, seed=seed)
    far_street(F, 0, WF, YH, YQ, rng, 1)
    for i in infos:
        if rng.random() < 0.5:
            F.blit(bike_far(rng, rng.choice(SAFE)), i['x'] + rng.randint(2, max(3, i['w'] - 14)), YH - 5)
    tl = []
    x = 46
    while x < WF - 10:
        t = tree_far(rng, rng.randint(58, 70), rng.randint(52, 60), rng.randint(34, 40), leaf='leaf_autumn',
                     seed=rng.randint(1, 999), bare=0.62, tw=4)
        tl.append((x - t.w // 2, YQ - t.h, t))
        x += rng.randint(150, 200)
    x = 20
    while x < WF - 30:
        k = rng.random()
        if k < 0.22:
            c = car_far_a(rng, rng.choice(['blue', 'white', 'black', 'iron', 'green'])); F.blit(c, x, YQ - c.h + 1); x += c.w + rng.randint(10, 24)
        elif k < 0.5:
            for j in range(rng.randint(1, 3)):
                F.blit(bike_far(rng, rng.choice(SAFE)), x, YQ - 7); x += 9
            x += 6
        else:
            x += rng.randint(8, 20)
    lamps = []
    for lx in range(52, WF, 120):
        F.blit(lamp_far(30, lit=True), lx, YQ - 29)
        lamps.append((lx + 2, YQ - 26))
    for (tx, ty, t) in tl:
        F.blit(t, tx, ty)
    bollards_far(F, 0, WF, YQ + 1, rng)
    quay_wall(F, 0, YQ, WF, YW - YQ, rng, 7)
    for (kind, bx, arg) in boats:
        if kind == 'sloop':
            b = sloop(rng, arg[0], arg[1]); F.blit(b, bx, YW - 7)
        elif kind == 'tarp':
            b = tarp_boat(rng, arg[0]); F.blit(b, bx, YW - b.h + 3)
    F.clear(0, YW + 1, F.w, F.h)
    F.recolor(grader(key=sec.KEY, air=(sec.AIR[0], sec.AIR[1], H.get('far_air', 0.3), 0.30)), keep=KEEP)
    no_red(F)
    wl = []
    for i in infos:                                               # a few rooms already awake, warm
        for (x_, y_) in light_windows(F, i['upper'] + i['gfwin'], 0.07, rng):
            if rng.random() < 0.6:
                wl.append((x_, EM[2], 0.35))
    for (x_, y_) in lamps:
        glow(F, x_, y_, 5, HALO_S[1:])
        F.rect(x_ - 1, y_ - 1, 3, 2, EM[0]); F.px(x_, y_ + 1, EM[1])
        wl.append((x_, EM[1], 0.6))
    limit_colours(F, 200)
    sec.add('far', F, speed)
    sec.notes.setdefault('fronts', []).append(('far', slots))
    return F, dict(infos=infos, slots=slots, wl=wl, lamps=lamps, trees=tl)


def dawn_extra(sec, coping=27.0):
    """floor_layer's extra at dawn: the quay pavement in smoked klinkers, the granite coping with its rings, the street
       in wet brown klinkers (stretcher bond along the street), the near pavement; puddles in a pale tone (the grade and
       dawn_floor_post give them the sky)."""
    fl = sec.fl
    dF = fl['far'] if isinstance(fl['far'], (int, float)) else 5.0
    dN = fl['near'] if isinstance(fl['near'], (int, float)) else -16.3
    KS, ST, KB = np.array(R['brick_smoke'], np.uint8), np.array(R['stone'], np.uint8), np.array(R['brick_brown'], np.uint8)

    def kl(u, v, ramp_, sd, cu=6.0, cv=3.0):
        j = np.floor(v / cv); uu = u / cu + 0.5 * (j % 2); i = np.floor(uu)
        fu, fv = uu - i, v / cv - j
        t = 3 + (hash01(i, j, sd) > 0.70) - (hash01(i, j, sd + 1) > 0.80)
        t = np.where((fv < 0.20) & (fu > 0.06), t + 1, t)
        t = np.where((fu < 0.07) | (fv > 0.86), 1, t)
        return ramp_[np.clip(t, 0, 6)]

    def extra(u, d, v, rgb):
        pav = (d > dF + 1.6) & (d < coping)
        if pav.any():
            rgb[pav] = kl(u, v, KS, 91)[pav]
        npv = d < dN - 1.4
        if npv.any():
            rgb[npv] = kl(u, v, KS, 93)[npv]
        lane = (d <= dF) & (d >= dN)
        if lane.any():
            c = kl(u, v, KB, 31, cu=5.0, cv=2.6)
            gut = (np.abs(d - (dF - 1.2)) < 0.7)                       # a gutter of granite setts along the far kerb
            c[gut] = ST[2]
            rgb[lane] = c[lane]
        cop = d >= coping
        if cop.any():
            t = np.where(d >= coping + 0.8, 5, 3) + 0 * u
            t = np.where((u % 22) < 0.6, 2, t)
            t = np.where(d >= 29.4, 6, t)
            rgb[cop] = ST[np.clip(t, 0, 6).astype(int)][cop]
            ring = cop & (np.abs(((u + 40) % 96) - 48) < 1.4) & (d < coping + 1.8)
            rgb[ring] = np.array(R['iron'][1], np.uint8)
        pm = puddles(u, v) & (d < coping - 0.5) & ~((np.abs(d - dF) < 1.8) | (np.abs(d - dN) < 1.4))
        rgb[pm] = np.array((170, 176, 206), np.uint8)
        edge = puddles(u + 1.2, v) & ~pm & (d < coping - 0.5)
        rgb[edge] = (rgb[edge].astype(int) * 4 // 5).astype(np.uint8)
    return extra


def dawn_floor_post(sec, img, lights, coping=27.0, seed=5):
    """The light pass of the wet floor at dawn: the puddles mirror the sky (its pink low tones, a pale blue higher up,
       broken streaks), a warm pool under each lamp still lit."""
    u, d, v = floor_uvd(sec, img)
    pm = puddles(u, v) & (d < coping - 0.5)
    a = img.a
    spal = sec.notes.get('spal')
    sky_hi = np.array(spal[4] if spal else (164, 176, 212), float)
    sky_lo = np.array(spal[12] if spal else (240, 210, 214), float)
    if pm.any():
        band = hash01(np.floor(u / 7.0), np.floor(v / 26.0), seed)
        tgt = np.where((band > 0.55)[..., None], sky_lo, sky_hi)
        streak = pm & (hash01(np.floor(u / 1.5), np.floor(v / 4.0), seed + 1) > 0.70)
        for m, amt in ((pm, 0.30), (streak, 0.52)):
            px_ = a[..., :3][m].astype(float)
            a[..., :3][m] = snap5(px_ + (tgt[m] - px_) * amt)
    ck = chk(u, d)
    for (lx, ld, col, rad) in lights:
        col = np.array(col, float)
        e = ((u - lx) / (rad * 1.6)) ** 2 + ((d - ld + 2) / (rad * 0.35)) ** 2
        inner = (e < 0.30) | ((e < 0.45) & ck)
        outer = ((e < 0.80) | ((e < 1.0) & ck)) & ~inner
        for m, amt in ((inner, 0.20), (outer, 0.10)):
            px_ = a[..., :3][m].astype(float)
            a[..., :3][m] = snap5(px_ + (col - px_) * amt)


# ---------------------------------------------------------------- the manhole (prop/sewers-manhole: lid 2 frames, hole)
def manhole_lid(frame=0):
    """The cast-iron lid (26 x 6, anchor 13, 6): frame 0 shut in the street, flat in perspective (a ring, a raised grid
       pattern, wet), frame 1 lifted and tipping (its thick rim edge shows, the underside dark)."""
    I = R['iron']
    L = Layer(26, 6)
    if frame == 0:                                     # flat on the street, rows 2-6 (inside the lane: the kerb is at row 1)
        L.ellipse(13, 4.1, 12.6, 1.9, I[1])
        L.ellipse(13, 4.0, 11.6, 1.5, I[3])
        L.ellipse(13, 4.0, 9.4, 1.1, I[2])
        for k in np.arange(5.5, 21, 2.5):
            L.vl(k, 3.4, 1.4, I[4], t=TH)
        L.hl(4, 4.0, 18, I[4], t=TH)
        L.ellipse(13, 4.0, 2.2, 0.5, I[5])
        L.hl(6, 2.6, 14, I[5], t=TH)                                   # the wet rim catches the sky
    else:
        L.ellipse(13, 2.6, 12.4, 2.6, I[2])
        L.rect(1, 2.6, 24, 1.6, I[1])
        L.ellipse(13, 4.2, 12.4, 1.5, I[0])
        L.ellipse(13, 2.4, 11.4, 2.0, I[3]); L.hl(4, 1.0, 18, I[5], t=TH)
    return L


def manhole_hole():
    """The open shaft (26 x 6, anchor 13, 6): its granite collar, the dark throat, an iron rung, the sewer's faint green
       glow deep down."""
    I = R['iron']; S = R['stone']
    L = Layer(26, 6)
    L.ellipse(13, 4.0, 12.8, 2.0, S[3])
    L.ellipse(13, 4.0, 11.6, 1.6, R['black'][0])
    L.ellipse(13, 4.5, 7.0, 0.8, s5_((20, 60, 44)))
    L.hl(9, 3.4, 8, I[3], t=TH)
    L.hl(3, 2.2, 20, S[5], t=TH)
    return L


def s5_(c):
    return tuple(int(v) for v in snap5(np.array(c, float)))
