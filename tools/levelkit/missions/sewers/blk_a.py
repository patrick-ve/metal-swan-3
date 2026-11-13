# Block-out of section a (DE WALLEN, 23:00, rain) of mission sewers: the first two screens (x 0-768) on the game's
# real layout with the shared parts only (parts_wallen.py), the hour `a`, at the kit's gates. Wave P4a: it proves that
# the parts, the hour, the kit floor and the rain work together. The painter of a replaces it with sw_a.py.
#
#   U=1 python3 tools/levelkit/lk.py sewers preview blk_a         # work/sewers/out/l1blk-a-{0,1,2}-u1.png + layout
#   U=4 python3 tools/levelkit/lk.py sewers check blk_a
#
# Scene card
#   Place:     the quay of the Oudezijds Achterburgwal: we walk the cobbled quay street; behind its far kerb (depth 5)
#              the quay pavement (krul, tree, lamps), the coping (27-30), the canal, the far quay with its row of
#              narrow fronts (red rooms behind glass on the ground floors only, closed curtains, our own neon words).
#   Hour:      a, 23:00, late October, drizzle; key night blue, the neon red and pink; air violet.
#   Planes:    sky 0, clouds 0.03, skyline 0.10 (the old church's tower once, floodlit), far quay 0.5 (air 0.12),
#              water rows 0.5 -> 0.741 (mirror, streaks, rain rings), rain-far (speed 0), the floor rows 0.741 -> 1.345
#              (wet klinkers, coping, wet setts, puddles with the neon), planes at depth: the moored boat 33, lamps
#              24, the tree 22, the krul 14, the back posts 6, the walk plane 0 (empty), the front posts -18.5 (over);
#              fg 1.35 (bags, a planter) and the near rain (over).
#   Local:     the krul at 300, the quay tree at 520, crown lanterns on the quay, Amsterdammertjes on both kerbs, a
#              boat under a tarp, umbrellas on the far quay, bikes, puddles that mirror the neon.
#   Rules:     red light on the ground floor only; no window figures; no banned lettering; the fronts tile; nothing on
#              the walk band (checks_sewers.street_rules).
import os
import random
from level import *
from game_sprites import sprites          # noqa: F401  (the bake's hook)
from parts_wallen import *
import checks_sewers as cs
import street

SID = 'sewers-a'
NAME = 'De Wallen (block-out)'
HOUR = 'a'
SPAN = (0, 768)
GAME_CAMS = [(0, 192), (192, 192), (384, 192)]
LAMPS = (120, 504)                         # crown lanterns on the quay pavement (depth LAMP_D)
LAMP_D, LAMP_H = 24.0, 72
BOAT = (640, 33.0)                         # a boat under its tarp, moored at our quay (water at depth 33)
FAR_GAPS = ()                              # plane spans of the far quay where a bridge lands (none in 0-768)


def plane_layer(sec, depth, front=False):
    k = round(depth * 2) / 2 + 0.0
    lid = 'd%g%s' % (k, 'f' if front else '')
    for l in sec.layers:
        if l['id'] == lid:
            return l, k
    return None, k


def flush_night(sec, keep=KEEP):
    """Sec.flush, but the grade keeps the emitters (lit lanterns, neon) out of the key."""
    for key in sorted(sec.planes, key=lambda kf: (-kf[0], kf[1])):
        k, front = key
        Lp = sec.planes[key]
        Lp.recolor(grader(key=sec.KEY), keep=keep); Lp.recolor(curve(*sec.H['curve']), keep=keep)
        sec.add('d%g%s' % (k, 'f' if front else ''), Lp, s_d(k), over=(k < 0 or front), depth=k, front=front)
    sec.planes = {}


def build(span=SPAN, bridge=False):
    sec = Sec(SID, NAME, HOUR)
    sec.W = span[1]                                              # the block-out paints 0 .. span[1] only
    sec.cam = sec.W - VIEW_W
    rng = random.Random(23)
    # ---- the sky, the skyline with the old church's tower (scale rule: 67 m at s 0.10), the far quay, the canal
    S, CL = night_sky(sec)
    SK = skyline_night(sec, 0.10, yb=112, tower=(300, int(round(scale_px(67, 0.10)))))
    gaps = list(FAR_GAPS) + ([(sec.at(1336, 0.5) - 6, sec.at(1480, 0.5) + 6)] if bridge else [])
    F, fq = far_quay_night(sec, rng, YH=110, YQ=115, YW=120, speed=0.5, seed=100, gaps=gaps,
                           boats=[('tarp', 60, (38,)), ('sloop', 230, (30, 'green')), ('tarp', 520, (40,))])
    sec.notes['far'] = fq
    canal_night(sec, [(S, 'tilex'), (CL, 'tilex'), (SK, 'stretch'), (F, 'copy')], F.w, fq['wl'])
    n_far = len(sec.layers)
    # ---- things on the quay (beside the band) and the boat on the water at our quay
    sec.put(tarp_boat(random.Random(5), 56), BOAT[0], BOAT[1], shade=False)
    for x in LAMPS:
        if x < sec.W:
            sec.put(lamp(LAMP_H, lit=False), x, LAMP_D)
    for d in decor(sec, 'decor/sewers-a/krul'):
        if d['x'] < sec.W:
            sec.put(krul(), d['x'], d['floorDepth'])
    for d in decor(sec, 'decor/sewers-a/tree'):
        if d['x'] < sec.W:
            th = int(round(scale_px(15, s_d(d['floorDepth']))))
            sec.put(quay_tree(random.Random(int(d['x'])), th, seed=int(d['x'])), d['x'], d['floorDepth'])
            sec.put(bike(rng, 'black', False), d['x'] + 14, d['floorDepth'] - 0.5)       # chained to the tree
    sec.put(bike(rng, 'red', False).flip(), LAMPS[0] + 12, LAMP_D - 0.5)                # chained to a lamp post
    for r in sec.L['floor']['rows'] or []:                       # the Amsterdammertjes on the kerbstones
        if r.get('prop') == 'sewers/pole':
            for x in r.get('at') or []:
                if x < sec.W:
                    sec.put(amst_post(19), x, r['depth'])
    # ---- the floor: wet klinkers, coping, wet setts, puddles; then the neon in the puddles and the lamps' pools
    fl = floor_layer(sec, extra=quay_extra(sec))
    lights = [(x, LAMP_D, EM[1], 18) for x in LAMPS if x < sec.W]
    wet_floor_post(sec, fl, lights)
    sec.plane(0)                                                 # the walk plane: empty (play only)
    flush_night(sec)
    # ---- the lamps lit (after the grade): the lantern, its halo against the air
    lay, k = plane_layer(sec, LAMP_D)
    for x in LAMPS:
        if x < sec.W and lay is not None:
            sp = s_d(k)
            cx, cy = sec.at(x, sp), (GY - k) - LAMP_H + 14
            glow(lay['img'], cx, cy, 16, HALO_W)
            lp = lamp(LAMP_H, lit=True)
            lp.recolor(grader(key=sec.KEY), keep=KEEP)
            lay['img'].blit(lp, cx - 8.5, (GY - k) - LAMP_H)
    if bridge:
        for (b0, b1) in ((1336, 1480),):
            bridge_depth(sec, b0, b1, seed=b0)
    # ---- the rain: far (behind the floor), near (over the heroes); three dark things at the lower edge
    rain_layers(sec, insert_far=n_far)
    FG = Layer(sec.lw(1.35), VIEW_H)
    fr = random.Random(9)
    for part, x in ((fg_bags(fr), 210), (fg_planter(fr, 70, 'leaf_autumn'), 620), (fg_bags(fr).flip(), 930)):
        if x < FG.w:
            FG.blit(part, x, VIEW_H - part.h + 2)
    FG.recolor(grader(key=sec.H['fg']))
    rain = [l for l in sec.layers if l['id'] == 'rain'][0]
    sec.layers.insert(sec.layers.index(rain), dict(id='fg', img=FG, speed=1.35, y=0, kind='img', over=True))
    FG.a[..., :3] = snap5(FG.a[..., :3])
    sec.notes['band'] = (street.NEAR, street.FAR)
    return sec


def checks(sec):
    out = cs.street_rules(sec)
    infos = sec.notes['far']['infos']
    st = [x for i in infos for x in i['storeys']]
    v = float(np.mean(st))
    out.append(('scale: storey on the far quay (s 0.50) %.1f px, target 20 +-15%%' % v, abs(v / 20 - 1) <= 0.15, '%.1f' % v))
    gf = [i['gf'] for i in infos]
    out.append(('scale: ground floor on the far quay %d-%d px, target 27 +-15%%' % (min(gf), max(gf)),
                all(abs(g / 27 - 1) <= 0.15 for g in gf), '%.1f' % np.mean(gf)))
    th = scale_px(15, s_d(22))
    out.append(('scale: quay tree 15 m at s %.3f -> %.0f px' % (s_d(22), th), True, '%d' % round(th)))
    return out


if __name__ == '__main__':
    import time
    t0 = time.time()
    sec = build()
    print('build %.1f s, %d layers' % (time.time() - t0, len(sec.layers)))
    preview(sec, cams=(0, 192, 384), tag='blk-a')
