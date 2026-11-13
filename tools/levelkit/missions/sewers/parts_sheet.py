# Every street part of mission sewers alone, one sheet per family, at the tier U (the look check of Phase 5 step 2):
#   U=1 python3 tools/levelkit/lk.py sewers run parts_sheet [family ...]      (default: all families)
#   U=4 python3 tools/levelkit/lk.py sewers run parts_sheet fronts
# -> tmp/sewers/p4/shared/<family>-u<U>.png. Families:
#   fronts     a row of De Wallen fronts at s 0.5 (the far quay of a) and at s 0.948 (b's alley wall), each in daylight,
#              at night (graded, then the light pass: red rooms on the ground floor, neon words, warm rooms upstairs,
#              wall lamps) and at dawn (end)
#   furniture  the krul, the quay tree, bins with cans, a roller shutter, the wall lamp, the tarp boat, umbrellas, posts,
#              a bike, the steam frames and its vent, front bags: daylight on a plain ground, then at night (key of a)
#   church     the old church's wall and tower: daylight, then night with the floodlight
#   street     a strip of section a at one camera with only the shared parts: the night sky, skyline, the far quay, the
#              canal (mirror, streaks, rain rings), the wet quay floor, the krul, posts, rain; and the hump bridge in depth
# The sewer's parts have their own sheet in the look sample (missions/sewers-look/parts_sheet.py).
import os
import random
import sys
import numpy as np
from level import *
from lkpath import repo_path
from parts_wallen import *
import mission as M

OUT = repo_path('tmp/sewers/p4/shared')
GROUND = (92, 96, 104)


def night(L, hour='a', air=0.0):
    H = M.HOURS[hour]
    L.recolor(grader(key=H['KEY'], air=(H['AIR'][0], H['AIR'][1], air, 0.3) if air else None), keep=KEEP)
    return H


def label(L, x, y, t, c=(236, 236, 236)):
    t = ''.join(ch for ch in t.upper() if ch in FONT)
    text(L, x, y, t, c)


def sheet_fronts():
    W, Hh = 768, 432
    S = Layer(W, Hh)
    S.rect(0, 0, W, Hh, (40, 42, 52))
    notes = {}
    row_y = [(150, 0.5, 'a'), (150, 0.5, 'end'), (430, 0.948, 'b')]
    # 1: the far quay row at s 0.5: daylight (left), night (right)
    for k, (yb, s, hour) in enumerate([(150, 0.5, 'a')]):
        for j, mode in enumerate(('day', 'night')):
            Lr = Layer(372, 160)
            infos, slots = wallen_row(Lr, 0, 372, 150, random.Random(7), s, seed=300, night=True)
            if mode == 'night':
                H = night(Lr, hour, 0.12)
                light_fronts(Lr, infos, H, random.Random(8), notes, 'sheet')
            S.blit(Lr, 4 + j * 380, 0)
            label(S, 8 + j * 380, 152, 'far quay s 0.5 %s' % mode)
    # 2: the dawn row (end) at s 0.5
    Lr = Layer(372, 160)
    infos, slots = wallen_row(Lr, 0, 372, 150, random.Random(9), 0.5, seed=500, night=False)
    H = night(Lr, 'end', 0.10)
    light_fronts(Lr, infos, H, random.Random(8), notes, 'sheet')
    S.blit(Lr, 4, 162)
    label(S, 8, 314, 'dawn s 0.5 (end)')
    # 3: the alley wall at s 0.948 (b): fronts leave the top, shutters, wall lamps; night
    Lr = Layer(372, 270)
    infos, slots = wallen_row(Lr, 0, 372, 268, random.Random(11), 0.948, seed=700, night=True, shutter=0.3, lamp=0.7,
                              wmin=26, wmax=40)
    H = night(Lr, 'b', 0.0)
    light_fronts(Lr, infos, H, random.Random(12), notes, 'sheet')
    S.blit(Lr, 384, 162)
    label(S, 388, 424, 'alley wall s 0.948 night (b)')
    words = sorted(set(w for (w, _) in notes.get('words', [])))
    label(S, 8, 330, 'words ' + ' '.join(words))
    return S


def sheet_furniture():
    W, Hh = 384, 216
    S = Layer(W, Hh)
    for j in range(2):
        D = Layer(W, 106)
        D.rect(0, 0, W, 106, GROUND)
        rng = random.Random(4)
        x = 4
        lamp_xy = None
        items = [krul(), quay_tree(rng, 96), bin_cans(rng), roller_shutter(22, 34, 3), wall_lamp(1.0), tarp_boat(rng, 56),
                 umbrella_far(rng, 0.5), umbrella_far(rng, 0.5), amst_post(19), bike(rng, 'black', False), drain_vent(14),
                 fg_bags(rng)]
        for p in items:
            if x + p.w > W - 2:
                break
            D.blit(p, x, 100 - p.h)
            if p.w == wall_lamp(1.0).w and p.h == wall_lamp(1.0).h and lamp_xy is None:
                lamp_xy = (x + p.w - 3, 100 - p.h + 5)
            x += p.w + 4
        st = steam_frames(22, 56, 3)
        for f, L in enumerate(st):
            D.blit(L, 300 + f * 26, 40)
        if j == 1:
            H = night(D, 'a')
            light_wall_lamp(D, *lamp_xy)
        S.blit(D, 0, j * 108)
    return S


def sheet_church():
    W, Hh = 384, 216
    S = Layer(W, Hh)
    for j in range(2):
        D = Layer(192, 216)
        D.rect(0, 0, 192, 216, (60, 64, 92) if j else (150, 170, 200))
        wall, info = church_wall(150, 100, 0.65, seed=7)
        tw = church_tower(210, 0.30, seed=5)
        D.blit(tw, 150, 214 - tw.h)
        D.blit(wall, 0, 214 - wall.h)
        if j:
            night(D, 'b', 0.1)
            church_floodlight(D, info, 0, 214, 100)
            floodlight(D, 150, 150 + tw.w, 214 - tw.h * 0.6, 214, col=(236, 206, 160), a=0.36)
        S.blit(D, j * 192, 0)
    return S


def sheet_street():
    """A strip of a at the camera of bridge 1 with the shared parts only (the block-out has the first two screens)."""
    import blk_a
    sec = blk_a.build(span=(1000, 1760), bridge=True)
    run, idle = hero_frames()
    frames = []
    for cx in (1100, 1220):
        frames.append(compose_level(sec, cx, 0, run[2]))
    S = Layer(VIEW_W, VIEW_H * 2)
    for i, fr in enumerate(frames):
        S.blit(fr, 0, i * VIEW_H)
    return S


FAMILIES = dict(fronts=sheet_fronts, furniture=sheet_furniture, church=sheet_church, street=sheet_street)

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    names = sys.argv[1:] or list(FAMILIES)
    for n in names:
        L = FAMILIES[n]()
        L.a[..., :3] = snap5(L.a[..., :3])
        p = os.path.join(OUT, '%s-u%d.png' % (n, U))
        save(L, p)
        print(p, L.ncolors(), 'colours')
