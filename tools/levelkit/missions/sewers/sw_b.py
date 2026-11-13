# Section b of mission sewers: DE STEEGJES, 01:00, rain (docs/design/sewers.md §2.2, §5.3; look sheet b). Wave P4b,
# painter B, on the game's real layout (2,560 px, flat ground at y 176).
#
#   U=1 python3 tools/levelkit/lk.py sewers preview sw_b        # tmp/sewers/p4/b/b-<camera x>-u1.png + a layout frame
#   U=1 python3 tools/levelkit/lk.py sewers check sw_b
#   python3 tmp/sewers/p4/u4.py sewers preview sw_b              # tier 4 (one tier-4 build at a time: the lock)
#   U=2 python3 tools/levelkit/lk.py sewers strip sw_b tmp/sewers/p4/b/strips
#
# Scene card
#   Place:     0-1,280 a narrow alley of De Wallen (the far wall 1-1.4 m behind the heroes, depth 6, y 170), cobbles
#              with a central gutter and its three drain grates (400, 760, 1,120); 1,280-1,536 the alley mouth
#              (klinkers, the krul, the last house's corner turning into depth); 1,536-2,560 the church square (wet
#              granite slabs, back edge depth 26, y 150) before the long side of the old church (backdrop only), the
#              three eruption grates (1,980, 2,100, 2,220) and the big burst grate (2,384-2,448).
#   Hour:      b, 01:00, late October, drizzle: colder and darker than a; one warm wall lamp per alley stretch, a few
#              red rooms and our own neon words on the ground floors; the church floodlit from its foot.
#   Planes:    sky 0, clouds 0.03 (the low deck lit by the city), skyline 0.10 (roofs far off in the notches), far 0.25
#              (the roofs of the next block, the church's nave with its ridge turret), rain-far 0, the floor rows
#              0.741 -> 1.345, the church's aisle wall 0.776 (depth 26), the corner strips (depths 8 .. 24), the alley
#              wall 0.948 (depth 6: fronts, shutters, lamps, bins, the krul, a round-arched passage at 690-728 with
#              its side walls in strips at depths 7 .. 27 and the lit courtyard at depth 28), steam (0.948), the walk
#              plane (the grates: the game's entities), fg 1.35 (the alleys only), rain (over).
#   Rules:     red light on the ground floor only; no window figures; no banned lettering; the fronts tile; nothing on
#              the walk band (the alleys: depth -40 .. 6; the square: depth -40 .. 26) but play; the church backdrop
#              only.
import os
import random
from level import *
from game_sprites import sprites          # noqa: F401  (the bake's hook)
from parts_wallen import *
from parts_sw_b import *
import checks_sewers as cs

SID = 'sewers-b'
NAME = 'De Steegjes'
HOUR = 'b'
NOTE = ("The alleys of De Wallen at one in the night, in the drizzle: wet setts with a gutter and its drain grates, "
        "shut roller shutters, a few red rooms, one warm wall lamp per stretch and a passage to a lit courtyard. The "
        "alley opens onto the church square: wet granite slabs before the floodlit chapels of the old church, the "
        "eruption grates and the big burst grate that leads down into the sewer.")
GAME_CAMS = [(0, 192), (300, 192), (700, 150), (1040, 192), (1300, 250), (1480, 120), (1800, 192), (2000, 192),
             (2176, 250)]
PREVIEW_CAMS = (0, 380, 500, 640, 1100, 1340, 1500, 1800, 2000, 2176)
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..', 'tmp', 'sewers', 'p4', 'b')

GUTTERS = (400, 760, 1120)                    # the game's SEWERS_B.gutters
ERUPTIONS = (1980, 2100, 2220)                # SEWERS_B.grates
BIG = 2416                                    # the big burst grate's centre (2,384-2,448)
LAMPS = (150, 480, 830, 1170, 1420)           # one warm wall lamp per alley stretch (and one at the mouth)
STRETCHES = ((0, 320), (320, 640), (640, 1000), (1000, 1280), (1280, 1536))
KRUL = 1360                                   # the krul at the alley mouth, against the wall
BINS = ((250, 0), (800, 1), (1030, 0), (1480, 1))
STEAM_SPANS = ((520, 640), (1180, 1270))      # wall grilles that breathe steam (the first spot that cuts no light)
PASS = (690, 728)                             # a passage through a house to a courtyard (3 m), in the stretch 640-1000
COURT_D = 28.0                                # the passage's far end
BIKE = 600                                    # a bike against the wall
SQ_LAMPS = (1720, 2160, 2500)                 # crown lanterns at the church's foot (the square's back edge)
CHURCH_M = 8.5                                # the aisle wall to the eaves (m)
NAVE_M = 16.0                                 # the nave's clerestory to the eaves (m)
FAR_S = 0.25


def flush_night(sec, keep=KEEP):
    """Sec.flush, but the grade keeps the emitters out of the key."""
    for key in sorted(sec.planes, key=lambda kf: (-kf[0], kf[1])):
        k, front = key
        Lp = sec.planes[key]
        Lp.recolor(grader(key=sec.KEY), keep=keep); Lp.recolor(curve(*sec.H['curve']), keep=keep)
        sec.add('d%g%s' % (k, 'f' if front else ''), Lp, s_d(k), over=(k < 0 or front), depth=k, front=front)
    sec.planes = {}


def graded(part, sec, key=None, keep=KEEP):
    part.recolor(grader(key=key or sec.KEY), keep=keep); part.recolor(curve(*sec.H['curve']), keep=keep)
    return part


def far_layer(sec, rng):
    """The far plane (speed 0.25): the upper storeys and gables of the next block over the alley roofs, then the old
       church's nave (clerestory, lead roof, a ridge turret) over the square. Graded with the key and the far air."""
    H = sec.H
    s = FAR_S
    WF = sec.lw(s)
    F = Layer(WF, VIEW_H)
    yb = int(round(GY - (116 - 116 * s)))                                  # the foot of this plane (hidden behind the near walls)
    xc = int(round(sec.at(SQUARE - 40, s)))                      # the nave starts a little west of the square
    infos, slots = wallen_row(F, 0, xc, yb, rng, s, seed=900, night=True, rooms=0.0, nst=(3, 4, 4, 5))
    h = int(round(scale_px(NAVE_M, s)))
    C, cinfo = church_flank(WF - xc + 4, h, s, seed=11, roof=0.36, gables=False)
    F.blit(C, xc, yb - C.h)
    T = ridge_turret(int(round(scale_px(4, s))) + 6, s)
    F.blit(T, xc + 150, yb - C.h - T.h + 6)
    G = grader(key=sec.KEY, air=(sec.AIR[0], sec.AIR[1], 0.30, 0.30))
    F.recolor(G, keep=KEEP)
    lights = light_fronts(F, infos, H, rng, sec.notes, 'far', None, warm=0.12)
    church_light(F, cinfo, xc, yb, h, col=(200, 186, 170), a=(0.18, 0.08))
    limit_colours(F, 200)
    sec.add('far', F, s)
    sec.notes.setdefault('fronts', []).append(('far', slots))
    sec.notes['far_infos'] = infos
    return F


def _free_of_lights(L, x0, y0, w, h):
    """True if no neon, red room or curtain pixel lies in the box (a plume or a thing in front must not cut a word)."""
    cols = np.array(sorted(set(tuple(int(v) for v in c) for N in (RED, PINK, AMBER, CYAN, CURT) for c in N)), np.int64)
    v = L.view(x0, y0, w, h)
    k = (v[..., 0].astype(np.int64) << 16) | (v[..., 1].astype(np.int64) << 8) | v[..., 2]
    ck = (cols[:, 0] << 16) | (cols[:, 1] << 8) | cols[:, 2]
    return not (np.isin(k, ck) & (v[..., 3] > 0)).any()


def alley_wall(sec, rng):
    """The alley's far wall (depth 6): a tiled row of narrow fronts from the section's start to the corner at the
       square, shutters on some ground floors, a few red rooms, our neon words, a passage to a courtyard; graded; then
       the light pass, the bins, the krul, steam grilles, the wall lamps (one per stretch) and their light.
       Returns (layer, the corner front, floor lights, the passage's crown)."""
    H = sec.H
    s6 = s_d(ALLEY_D)
    W6 = sec.lw(s6)
    Lw = Layer(W6, VIEW_H)
    foot = int(GY - ALLEY_D)
    xc = int(round(sec.at(SQUARE, s6)))
    infos, slots = wallen_row(Lw, 0, xc, foot, rng, s6, seed=700, night=True, rooms=0.30, shutter=0.40, lamp=0.0,
                              nst=(1, 1, 2, 2, 2), wmin=26, wmax=40)
    # the passage: the front over PASS gets a brick ground floor with a round arch through it
    pa, pb = sec.at(PASS[0], s6), sec.at(PASS[1], s6)
    f = [i for i in infos if i['x'] <= pa and pb <= i['x'] + i['w']]
    assert f, 'no front holds the passage'
    crown = carve_passage(Lw, f[0], pa, pb, foot, s6, seed=17)
    graded(Lw, sec)
    lights = light_fronts(Lw, infos, H, rng, sec.notes, 'd6', None, warm=0.10)
    Fc = Layer(Lw.w, Lw.h); Fc.a = Lw.a.copy()
    sec.notes.setdefault('front_imgs', {})['d6'] = Fc
    sec.notes.setdefault('fronts', []).append(('d6', slots))
    sec.notes['alley_infos'] = infos
    # bins with cans, a bike against the wall (graded as the wall), the krul (a lighter key: the green must read)
    br = random.Random(41)
    for (x, fl) in BINS:
        b = bin_cans(br)
        b = b.flip() if fl else b
        graded(b, sec)
        Lw.blit(b, sec.at(x, s6) - b.w / 2.0, foot - b.h + 1)
    bk = bike(br, 'black', False)
    graded(bk, sec)
    Lw.blit(bk, sec.at(BIKE, s6) - bk.w / 2.0, foot - bk.h + 1)
    kr = krul()
    graded(kr, sec, key=(sec.KEY[0], sec.KEY[1], 0.55, 0.10))
    Lw.blit(kr, sec.at(KRUL, s6) - kr.w / 2.0, foot - kr.h + 1)
    # steam grilles low in the wall, where the plume cuts no word and no lit room
    steam = []
    for (a, b) in STEAM_SPANS:
        for x in range(a, b, 8):
            px_ = sec.at(x, s6)
            if _free_of_lights(Lw, px_ - 14, foot - 64, 28, 62):
                steam.append(x)
                break
    for x in steam:
        g = Layer(10, 6)
        g.rect(0, 0, 10, 6, R['iron'][1]); g.hl(0, 0, 10, R['stone'][4])
        for k in range(4):
            g.hl(1, 1.5 + k, 8, R['iron'][3], t=TH)
        graded(g, sec)
        Lw.blit(g, sec.at(x, s6) - 5, foot - 10)
    sec.notes['steam'] = steam
    # the wall lamps: on the party wall between two fronts, just over the ground floor
    joints = [x for (x, w) in slots[1:]]
    lamp_at = []
    for lx in LAMPS:
        p = sec.at(lx, s6)
        j = min(joints, key=lambda q: abs(q - p))
        inf = [i for i in infos if i['x'] == j][0]
        WL = graded(wall_lamp(s6), sec)
        y = inf['gf_top'] - WL.h + 3
        Lw.blit(WL, j - 1, y)
        lamp_at.append((j - 1 + WL.w - 3, y + 5, lx))
    for (x, y, lx) in lamp_at:
        tint(Lw, x, y + 22, 20, 28, EM[1], 0.14, 0.07, ymax=foot)        # the lamp lights the wall under it
        light_wall_lamp(Lw, x, y, rad=10)
    sec.notes['lamps'] = [(192 + (x - 192) / s6, y) for (x, y, lx) in lamp_at]
    limit_colours(Lw, 240)
    sec.add('d6', Lw, s6, depth=ALLEY_D)
    # the floor lights of this wall: rooms, neon, lanterns and the lamps (world x, depth, colour, radius)
    fl = []
    for (x, y, col, kind, ft, rx) in lights:
        if kind in ('room', 'neon', 'lantern') and rx > 0:
            fl.append((192 + (x - 192) / s6, ALLEY_D, col, rx + 2))
    for (x, y, lx) in lamp_at:
        fl.append((192 + (x - 192) / s6, ALLEY_D, EM[1], 16))
    return Lw, infos[-1], fl, crown


def church(sec):
    """The old church's long side at the square's back edge (depth 26): the aisle wall with buttresses, chapel gables,
       pointed windows, a portal; graded, then lit from the foot of every buttress. Backdrop only: nothing on it. The
       square's crown lanterns stand at its foot (on the back edge, off the band), bikes chained to them."""
    s = s_d(SQUARE_D)
    W = sec.lw(s)
    L = Layer(W, VIEW_H)
    foot = int(GY - SQUARE_D)
    x0 = int(round(sec.at(SQUARE, s)))
    h = int(round(scale_px(CHURCH_M, s)))
    C, info = church_flank(W - x0 + 2, h, s, seed=7, roof=0.22, gables=True)
    L.blit(C, x0, foot - C.h)
    for b in info['buttress']:                                   # the floodlight fixtures on the ground
        L.rect(x0 + b - 2, foot - 2, 4, 2, R['iron'][1]); L.hl(x0 + b - 2, foot - 2, 4, R['iron'][3])
    graded(L, sec)
    church_light(L, info, x0, foot, h)
    lh = int(round(scale_px(5.2, s)))
    br = random.Random(77)
    lamps = []
    for x in SQ_LAMPS:
        p = sec.at(x, s)
        lp = graded(lamp(lh, lit=True), sec)
        L.blit(lp, p - 8.5, foot - lh)
        bk = graded(bike(br, None, False), sec)
        L.blit(bk if x % 2 else bk.flip(), p + 2, foot - bk.h + 1)
        lamps.append((p, foot - lh + 14, x))
    for (p, y, x) in lamps:
        glow(L, p, y, 14, HALO_W)
        L.rect(p - 2, y - 4, 5, 7, EM[1]); L.rect(p - 1, y - 3, 2, 4, EM[0])
    limit_colours(L, 200)
    sec.add('church', L, s, depth=SQUARE_D)      # own id: the bikes' plane at the same depth is 'd26' (page tiles collide)
    sec.notes['church'] = dict(x0=x0, foot=foot, top=foot - C.h, s=s, buttress=[192 + (x0 + b - 192) / s for b in info['buttress']])
    out = [(u, SQUARE_D, (240, 214, 166), 16) for u in sec.notes['church']['buttress'] if SQUARE <= u <= sec.W + 40]
    return out + [(x, SQUARE_D, EM[1], 22) for x in SQ_LAMPS]


def steam_layer(sec):
    s6 = s_d(ALLEY_D)
    W6 = sec.lw(s6)
    pal = [(64, 68, 104), (84, 88, 126), (108, 110, 150), (132, 132, 172)]
    fr = steam_frames(26, 56, seed=5, n=3, pal=pal)
    out = []
    for f in range(3):
        L = Layer(W6, 56)
        for i, x in enumerate(sec.notes['steam']):
            L.blit(fr[(f + i) % 3], sec.at(x, s6) - 13, 0)
        out.append(L)
    sec.add('steam', None, s6, y=GY - ALLEY_D - 8 - 56, kind='frames', frames=out, depth=ALLEY_D)


def build():
    sec = Sec(SID, NAME, HOUR)
    rng = random.Random(1)
    # ---- the sky, the skyline far off, the far plane (next block's roofs, the nave)
    night_sky(sec)
    skyline_night(sec, 0.10, yb=52, seed=15)
    far_layer(sec, random.Random(90))
    n_far = len(sec.layers)
    # ---- the floor, the church, the corner strips, the alley wall
    fl_lights = []
    ch_lights = None
    fl = floor_layer(sec, extra=b_floor_extra(sec, PASS))
    ch_lights = church(sec)
    s6 = s_d(ALLEY_D)
    # the corner house: its east wall in strips from the alley wall back to the church
    Lw, last, wl, crown = alley_wall(sec, random.Random(70))
    wall = sec.layers.pop()                                   # re-added after the strips (draw order: far -> near)
    depths = [8 + 2 * i for i in range(10)]
    corner_side(sec, SQUARE, last['hb'], last['gh'] * 0.55, last['brick'], depths=depths[:-1] + [25.0, 25.5])
    passage_sides(sec, PASS[0], PASS[1], crown, [7 + i for i in range(21)])
    lx, ly = courtyard_end(sec, PASS[0], PASS[1], COURT_D, crown)
    wl.append(((PASS[0] + PASS[1]) / 2.0, COURT_D - 1.0, EM[1], 7))
    flush_night(sec)
    court = [l for l in sec.layers if l.get('depth') == COURT_D][0]['img']
    tint(court, lx, ly + 8, 16, 14, EM[1], 0.42, 0.22)               # the courtyard lantern lights its wall
    glow(court, lx, ly, 5, HALO_W)
    court.rect(lx - 1, ly - 1.5, 3, 4, EM[1]); court.px(lx, ly, EM[0])
    court.a[..., :3] = snap5(court.a[..., :3])
    sec.layers.append(wall)
    steam_layer(sec)
    fl_lights += wl + ch_lights
    b_wet_post(sec, fl, fl_lights)
    # ---- the walk plane: the game's grates (entities); empty in a game bake
    sec.plane(0)
    sec.notes['grates'] = grates(sec, GUTTERS, ERUPTIONS, BIG)
    flush_night(sec, keep=KEEP + EYES + GLEAM)
    # ---- the rain; front things at the lower edge
    rain_layers(sec, insert_far=n_far)
    FG = Layer(sec.lw(1.35), VIEW_H)
    fr = random.Random(9)
    for part, x in ((fg_bags(fr), 330), (fg_bags(fr).flip(), 1180), (fg_bags(fr), 1880)):     # the alleys only
        if x < FG.w:
            FG.blit(part, x, VIEW_H - part.h + 2)
    FG.recolor(grader(key=sec.H['fg']))
    FG.a[..., :3] = snap5(FG.a[..., :3])
    rain = [l for l in sec.layers if l['id'] == 'rain'][0]
    sec.layers.insert(sec.layers.index(rain), dict(id='fg', img=FG, speed=1.35, y=0, kind='img', over=True, depth=-60.0))
    sec.notes['band'] = (-40.0, ALLEY_D)
    sec.notes['band_ok'] = ['d0']
    return sec


# ---------------------------------------------------------------- the section's own gates
def checks(sec):
    out = cs.street_rules(sec)
    s6 = s_d(ALLEY_D)
    st = [x for i in sec.notes['alley_infos'] for x in i['storeys']]
    v = float(np.mean(st))
    want = 40 * s6
    out.append(('scale: storey on the alley wall (s %.3f) %.1f px, target %.1f +-15%%' % (s6, v, want), abs(v / want - 1) <= 0.15, '%.1f' % v))
    gf = [i['gf'] for i in sec.notes['alley_infos']]
    want = 54 * s6
    out.append(('scale: ground floor on the alley wall %d-%d px, target %.1f +-15%%' % (min(gf), max(gf), want),
                all(abs(g / want - 1) <= 0.15 for g in gf), '%.1f' % np.mean(gf)))
    st = [x for i in sec.notes['far_infos'] for x in i['storeys']]
    v = float(np.mean(st))
    out.append(('scale: storey on the far plane (s %.2f) %.1f px, target %.1f +-15%%' % (FAR_S, v, 40 * FAR_S), abs(v / (40 * FAR_S) - 1) <= 0.15, '%.1f' % v))
    # one warm wall lamp per alley stretch
    lamps = [x for (x, y) in sec.notes['lamps']]
    per = [sum(1 for x in lamps if a <= x < b) for (a, b) in STRETCHES]
    out.append(('one warm wall lamp per alley stretch (%d stretches)' % len(STRETCHES), all(p == 1 for p in per), str(per)))
    # nothing stands on the square's band (depth -40 .. 26, world x 1,540 .. 2,560) but play
    bad = []
    for l in sec.layers:
        dp = l.get('depth')
        if dp is None or not (-40 < dp < SQUARE_D) or l['id'] in sec.notes['band_ok'] or l['kind'] != 'img':
            continue
        sp = l['speed']
        p0 = P(sec.at(SQUARE + 4, sp))
        if (l['img'].a[:, p0:, 3] > 0).any():
            bad.append(l['id'])
    out.append(('nothing stands on the square (depth -40 .. 26, x 1,540+) but play', not bad, ', '.join(bad) or 'ok'))
    # the church is backdrop only: no word, no lamp, no sign on its layer
    words = [w for (w, where) in sec.notes.get('words', []) if where == 'd26']
    out.append(('the church is backdrop only (words or signs on it: 0)', not words, len(words)))
    # the grates: each in its spot on the walk line (page) and in the gutter (the gutter band covers y 176 .. 182)
    if not GAME:
        N = [l for l in sec.layers if l['id'] == 'd0'][0]['img']
        miss = [x for (k, x) in sec.notes['grates'] if not (N.a[P(GY):P(GY + 6), P(x), 3] > 0).all()]
        out.append(('every grate of the game painted at its x on the walk line (%d)' % len(sec.notes['grates']), not miss, str(miss) or 'ok'))
    gl, gn = GUTTER
    ok = gl >= 0.5 and gn <= -6.5
    out.append(('the gutter holds the grates (gutter depth %.1f .. %.1f, grates 0 .. -6)' % (gn, gl), ok, 'ok' if ok else 'no'))
    return out


if __name__ == '__main__':
    import time
    t0 = time.time()
    sec = build()
    print('build %.1f s, %d layers' % (time.time() - t0, len(sec.layers)))
    run, idle = hero_frames()
    for i, cx in enumerate(PREVIEW_CAMS):
        save(compose_level(sec, cx, 0, run[(i * 3) % len(run)]), os.path.join(OUT, 'b-%d-u%d.png' % (cx, U)), 1)
    save(compose_level(sec, 1300, 0, run[0], overlay=True), os.path.join(OUT, 'b-layout-u%d.png' % U), 1)
    print('previews %.1f s' % (time.time() - t0))
