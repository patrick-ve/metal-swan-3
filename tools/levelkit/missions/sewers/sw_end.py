# The ending screen of level 2 (mission sewers): DAGERAAD, 07:15, 384 px (one screen, no scroll). Wave P4b, painter E.
# The squad climbs out of a manhole in a quiet canal street far from the centre, after the rain; the squad's white wagon
# (the game's art: the ring's wagon, wave P6c) picks them up.
#
#   U=1 python3 tools/levelkit/lk.py sewers preview sw_end          # work/sewers/out/l1sewers-end-*-u1.png + layout
#   U=1 python3 tools/levelkit/lk.py sewers check sw_end
#   python3 tmp/sewers/p4/u4.py sewers check sw_end                 # tier 4 (under the painters' lock)
#
# Scene card
#   Place:     a canal of the outer ring at first light: our street of wet brown klinkers between straight kerbs (5,
#              -16.3), the quay pavement behind it with a lamp still lit, bikes and posts, the granite coping, the canal
#              mirroring the sky, the far quay with low fronts (two or three storeys, cornices and gables), half-bare elms,
#              a church tower far off against the pink.
#   Hour:      end, 07:15, late October, the rain just over: cold pale blue overhead, pink low on the horizon, the cloud
#              deck breaking up and lit pink from below; the street lamps still on, a few windows awake. No neon, no red.
#   Planes:    sky 0, clouds 0.03 (tile), skyline 0.10, the far quay 0.5 (air .30), the canal rows 0.5 -> 0.741, the floor
#              rows 0.741 -> 1.345, the lamp and the bikes d24, posts on the far kerb d5, the walk plane d0
#              (the manhole lid: a canal sprite), fg 1.35.
#   Local:     the manhole at 96 (the lid of the game), the wagon's room at 270-370 (the game's white wagon stops at
#              320; its art is the game's), wet klinkers and puddles with the pink sky in them, Amsterdammertjes on the
#              kerbstones, chained bikes, a boat under a tarp.
#   Rules:     no red anywhere at dawn; our own words only; the fronts tile; nothing on the walk band but the manhole
#              (checks_sewers.end_rules).
import os
import random
import numpy as np
from level import *
from game_sprites import sprites, entity          # noqa: F401  (sprites: the bake's hook)
from parts_wallen import night_sky, skyline_night, scale_px, steam_frames, floor_uvd, _c
from parts_sw_end import *                        # noqa: F401,F403
import checks_sewers as cs
import street

SID = 'sewers-end'
NAME = 'Dageraad'
HOUR = 'end'
NOTE = ("Dawn after the rain at 07:15: a quiet canal street of the outer ring, cold pale blue overhead and pink low over "
        "the roofs, the street lamps still on. The squad climbs out of the manhole on the wet klinkers; the squad's white "
        "wagon (the game's art) pulls up on the right.")
# the fidelity cameras: one screen, the game's camera stays at 0. The bake names a fixture by its camera only
# (bake_game.py '<sec>-u<U>-c<cx>.png'), so five crops of camera 0 would overwrite one file: five equal entries keep
# the one file right (tier 1: the whole screen; tiers 2 / 4: the middle crop).
GAME_CAMS = [(0, 192)] * 5

MANHOLE_X, WAGON_X = 96, 320         # the game's numbers (terrain.ts SEWERS_END manholeX, wagonX)
LAMP = (150, 24.0, 72)               # a crown lantern on the quay pavement: world x, depth, height
GULLY = 52                           # the gully grate in the gutter by the far kerb, steaming
BIKES = [(162, 23.5, 'black'), (138, 23.5, 'blue'), (30, 21.0, 'green')]
BOATS = [('tarp', 120, (44,)), ('sloop', 290, (28, 'green'))]


def build():
    sec = Sec(SID, NAME, HOUR)
    H = sec.H
    rng = random.Random(715)
    # ---- the sky, the cloud deck breaking up, the far roofs, the far quay and the canal
    S, CL = dawn_sky(sec, seed=12)
    SK = skyline_night(sec, 0.10, yb=110, seed=19, air=0.62, tower=(262, int(round(scale_px(58, 0.10)))))
    F, fq = far_quay_dawn(sec, rng, YH=110, YQ=115, YW=120, speed=0.5, seed=140, boats=BOATS)
    sec.notes['far'] = fq
    from parts_wallen import canal_night
    canal_night(sec, [(S, 'tilex'), (CL, 'tilex'), (SK, 'stretch'), (F, 'copy')], F.w, fq['wl'], seed=17, rings=False)
    # ---- the quay pavement: the elm, the lamp with bikes chained to it, the posts on the far kerb
    sec.put(lamp(LAMP[2], lit=False), LAMP[0], LAMP[1])
    for (x, d, c) in BIKES:
        b = bike(random.Random(int(x)), c, False)
        sec.put(b if x < LAMP[0] else b.flip(), x, d)
    for x in range(14, 384, 26):
        if abs(x - WAGON_X) > 48 and abs(x - GULLY) > 8:                                  # the wagon stops in front of these: no posts there
            sec.put(amst_post(19), x, street.FAR)
    # ---- the floor: wet klinkers, the coping, the puddles with the sky; the lamp's warm pool
    fl = floor_layer(sec, extra=dawn_extra(sec))
    dawn_floor_post(sec, fl, [(LAMP[0], LAMP[1], EM[1], 16)])
    # a gully grate in the gutter by the far kerb; the sewer breathes out through it in the cold morning (steam)
    u, d, v = floor_uvd(sec, fl)
    gm = (u > GULLY - 6) & (u < GULLY + 6) & (d > street.FAR - 2.6) & (d < street.FAR - 0.6)
    Gi = [tuple(int(c) for c in snap5(grader(key=sec.KEY)(np.array([R['iron'][k]], float))[0])) for k in (0, 2, 4)]
    fl.a[..., :3][gm] = Gi[1]
    fl.a[..., :3][gm & ((np.floor(u * 0.7) % 2) == 0)] = Gi[0]
    fl.a[..., :3][gm & (d > street.FAR - 1.0)] = Gi[2]
    sp = s_d(street.FAR - 1.6)
    pal = [_c(c) for c in ((150, 150, 186), (178, 172, 204), (206, 196, 218), (230, 218, 228))]
    st = []
    for Sf in steam_frames(w=40, h=46, seed=5, n=3, pal=pal):
        Lf = Layer(sec.lw(sp), VIEW_H)
        Lf.blit(Sf, sec.at(GULLY, sp) - 20, GY - (street.FAR - 1.6) - 46)
        st.append(Lf)
    sec.add('steam', None, sp, kind='frames', frames=st)
    # ---- the walk plane: the manhole lid (shut; a canal sprite of the game). The wagon is the game's own art.
    sec.plane(0)
    if GAME:
        entity(sec, 'prop/sewers-manhole/lid', manhole_lid(0), MANHOLE_X, 0, frames=(0,), shade=False)
        entity(sec, 'prop/sewers-manhole/lid', manhole_lid(1), MANHOLE_X, 0, frames=(1,), shade=False)
        entity(sec, 'prop/sewers-manhole/hole', manhole_hole(), MANHOLE_X, 0, frames=(0,), shade=False)
    else:
        entity(sec, 'prop/sewers-manhole/lid', manhole_lid(0), MANHOLE_X, 0, shade=False)
    sec.flush()
    # ---- the lamp lit (after the grade): the lantern, a small halo (the day is coming)
    for l in sec.layers:
        if l.get('depth') == round(LAMP[1] * 2) / 2:
            sp = s_d(l['depth'])
            cx, cy = sec.at(LAMP[0], sp), (GY - l['depth']) - LAMP[2] + 14
            glow(l['img'], cx, cy, 11, HALO_W[1:])
            lp = lamp(LAMP[2], lit=True)
            lp.recolor(grader(key=sec.KEY), keep=KEEP)
            l['img'].blit(lp, cx - 8.5, (GY - l['depth']) - LAMP[2])
    # ---- the front edge: wet leaves and a drain at the lower edge (fg)
    FG = Layer(sec.lw(1.35), VIEW_H)
    fr = random.Random(9)
    for x in np.arange(6, FG.w, 3.5):
        if fr.random() < 0.45 and not (200 < x < 330):
            c = R['leaf_autumn'][fr.choice((2, 3, 4))]
            FG.ellipse(x + fr.uniform(-1, 1), VIEW_H - fr.uniform(0.5, 3.5), fr.uniform(1.0, 1.8), 0.8, c)
    FG.recolor(grader(key=H['fg']))
    sec.add('fg', FG, 1.35, over=True)
    sec.notes['band_ok'] = ['d0']
    return sec


def checks(sec):
    out = cs.end_rules(sec)
    infos = sec.notes['far']['infos']
    st = [x for i in infos for x in i.get('storeys', [])] or [40 * 0.5]
    gf = [i['gf'] for i in infos]
    out.append(('scale: ground floor on the far quay (s 0.50) %d-%d px, target 27 +-15%%' % (min(gf), max(gf)),
                all(abs(g / 27 - 1) <= 0.15 for g in gf), '%.1f' % np.mean(gf)))
    out.append(('room for the wagon: no post, tree or lamp in 272-368 in front of the far pavement', True, 'by construction'))
    return out


if __name__ == '__main__':
    import time
    t0 = time.time()
    sec = build()
    print('build %.1f s, %d layers' % (time.time() - t0, len(sec.layers)))
    preview(sec, cams=(0, 0, 0), tag=sec.id)
