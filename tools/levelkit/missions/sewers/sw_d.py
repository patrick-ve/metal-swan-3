# Section d of mission sewers: HET RIOOL, 02:30, 2,816 px (docs/design/sewers.md §2.4, §5.4, §6; wave P4b, painter D).
# The approved look sample (missions/sewers-look/sw_d.py, V2 BLACK, the grate light "faint, mostly white") laid over the
# game's real layout, two stacks: the ambient (hour d = the sample's v2) and the flashlight's lit stack (dl = v2l).
#
#   U=1 python3 tools/levelkit/lk.py sewers preview sw_d          # frames: tmp/sewers/p4/d/sw_d-<stack>-<cam>-u1.png
#   U=1 python3 tools/levelkit/lk.py sewers check sw_d sw_d_lit
#   python3 tmp/sewers/p4/u4.py sewers check sw_d sw_d_lit        # tier 4 (one tier-4 build at a time)
#   U=2 python3 tools/levelkit/lk.py sewers strip sw_d tmp/sewers/p4/d/strips
#
# Scene card
#   Place:      the brick storm-sewer vault under De Wallen (the sample's section): the channel of dark water between
#               two walkways, the far wall in 30 bays (pipe mouths, manholes with ladders, outfalls, sluice wheel,
#               root cracks, a date stone), three side tunnels, the barrel vault with nine street grates in its crown.
#   Hour:       d 02:30 (= v2) and dl (= v2l), mission.py.
#   Set piece:  THE FATBERG at the lock (2,432-2,816): the game's entity `prop/sewers-fatberg/big` at 2,700 (the
#               front lobe on the walkway: 4 crack stages, 6 slump frames, rat holes at the spawn points), its body
#               in the channel (scenery, depth 24) and its back on the far wall (scenery); the small secret one
#               (`prop/sewers-fatberg/small`, 1,200) welling up out of an overflow standpipe (its carrier).
#   Walk plane: the spitters' brick plinths (cap at y 148), the leapers' cast-iron risers (mouth at y 149), the
#               standpipe of the secret (rim at y 148).
#   Local:      lost things in the water over the whole section (phones, keys, dentures, a selfie stick, bottles, a
#               duck, a bike, an e-scooter), the wipe stream of the sewer worker at 1,700, UIT plates, roots, calcite.
#   Rules:      checks_sewers.sewer_rules (closed above the walkway, every shaft under a painted grate, every eye in a
#               carrier, bays tile, the walk band clear but play, the approved hour) and the sample's scale rules.
#   Scale:      13 px/m x the plane's speed (the sample's numbers); the hero 40 px, never scaled.
import os
import random
import numpy as np
from level import *
from game_sprites import entity, sprites          # noqa: F401  (sprites: the bake's hook)
import game_sprites
from parts_sewers import *
from parts_sw_d import *
from mission import two_stacks
import checks_sewers as cs

SID = 'sewers-d'
NAME = 'Het Riool'
NOTE = ("The sewer at 02:30 in the approved V2 BLACK: a brick vault over a channel of green-glowing water, 30 bays "
        "of pipe mouths with red eyes, ladders to the street grates, outfalls and three side tunnels. Spitters sit on "
        "brick plinths, leapers lurk in cast-iron risers, the secret fatberg wells up out of a standpipe; the big "
        "fatberg fills the tunnel at the lock.")
# (camera x, the logical screen x the tier-2 / tier-4 crops centre on): the screens that matter
GAME_CAMS = [(0, 176), (330, 192), (700, 192), (1008, 192), (1500, 200), (1810, 192), (2150, 192), (2432, 268)]

# the street grates in the crown (world x; their shafts land on the water), placed so that no crown shaft and no
# manhole shaft (bays 1, 5, 10, 16, 22) come closer than 38 px on screen at any camera (no double shafts)
GRATES = (200, 330, 720, 860, 1280, 1420, 1860, 2060, 2400)
# the far wall's 30 bays (kind, variant): side tunnels in bays 7, 12, 20 (world x 660, 1,176, 2,001: the bays
# nearest the layout's tunnel mouths at 640, 1,200, 1,980); outfalls pour in 0-896; the fatberg's back from bay 26
D_BAYS = [('pipes', 0), ('manhole', 0), ('outfall', 0), ('plain', 1), ('pipes', 1), ('manhole', 1), ('outfall', 1),
          ('tunnel', 0), ('plain', 3), ('pipes', 2), ('manhole', 2), ('plain', 0), ('tunnel', 0), ('outfall', 0),
          ('pipes', 0), ('plain', 2), ('manhole', 0), ('pipes', 1), ('outfall', 1), ('plain', 1), ('tunnel', 0),
          ('pipes', 2), ('manhole', 1), ('plain', 0), ('pipes', 1), ('outfall', 0), ('plain', 2), ('plain', 0),
          ('plain', 1), ('plain', 2)]
# the game's numbers (src/game/content/missions/sewers/terrain.ts SEWERS_D, set-pieces/fatberg.art.ts)
FAT_X = 2700                            # THE FATBERG's feet (y 176), the entity box 84 x 106, anchor (42, 106)
FAT_HOLES = (-8, -44, -78)              # FATBERG_HOLES: the rim's y above the feet; cx = 7 px right of the left face
SECRET = (1200, 148)                    # the small fatberg's feet (secretX, secretY), box 42 x 38, anchor (21, 38)
FAT_MID = (2800, 24.0)                  # the fatberg's body in the channel (scenery)
FAT_BACK_U = 2622                       # the fatberg's back on the far wall (world x of its left edge)
FAT_SKIN = (2560, 2950)                 # the grease skin on the water round its body
BIKE = (590, 22.0)
SCOOTER = (2232, 26.0)
STREAM = (1600, 1800)                   # the wipe stream on the walkway round the sewer worker (1,700)
FG_THINGS = (('bucket', 290), ('hose', 655), ('pallet', 905), ('cone', 1330), ('bucket', 1720), ('sandbags', 2120),
             ('hose', 2540), ('cone', 2930), ('pallet', 3330), ('sandbags', 3560))


def _lost(W):
    """The lost things in the channel, every 60-100 px from 40 to the fatberg's skin, at depths 44-92."""
    rng = random.Random(77)
    kinds = ['wipes', 'grease', 'phone', 'wipes', 'keys', 'grease', 'bottle', 'wipes', 'dentures', 'grease', 'stick',
             'wipes', 'phone', 'bottle', 'grease', 'keys', 'wipes', 'duck', 'grease', 'bottle']
    out, x, i = [], 40.0, 0
    while x < FAT_SKIN[0] - 40:
        out.append((kinds[i % len(kinds)], int(x), int(rng.uniform(44, 92))))
        x += rng.uniform(60, 100)
        i += 1
    return out


def _wipes(W):
    rng = random.Random(41)
    return [(int(x), int(rng.uniform(-26, 18))) for x in np.arange(140, W - 60, rng.uniform(210, 260))]


def _grade(H, KEEP, k):
    """The grade of a plane at depth k (the sample's: the set piece keeps a little more of its own colour)."""
    K0, K1, K2, K3 = H['KEY']
    Gk = grader(key=(K0, K1, K2 * (0.80 if k in (FAT_MID[1], -8.0) else 1.0), K3),
                air=(H['AIR'][0], H['AIR'][1], H['air'] * 0.35, 0.3) if k > 10 else None)

    def fn(L):
        L.recolor(Gk, keep=KEEP)
        L.a[..., :3] = snap5(L.a[..., :3])
        return L
    return fn


def _fat_frames(H, E):
    """The game's frames of both fatbergs, ungraded: big 0-3 (stages), big-slump 0-5, small 0-1 (glint), small-slump
       0-5. Returns {sprite id: [(frame, Layer)]} and the big one's rat holes (part px)."""
    hl = [(7.0, 106 + dy - 4.0, 4.4, 3.2) for dy in FAT_HOLES]
    out = {}
    big = []
    for st in range(4):
        L, holes = fat_body(84, 106, seed=5, shape='lobe', holes=hl, eye=E, stage=st)
        big.append((st, L))
    out['prop/sewers-fatberg/big'] = big
    P0, _ = fat_body(84, 106, seed=5, shape='lobe', holes=hl, eye=None, stage=3)
    out['prop/sewers-fatberg/big-slump'] = [(k, slump(P0, k, 140, 106, 120)) for k in range(6)]
    small = []
    for g in (0, 1):
        L, _ = fat_body(42, 38, seed=12, shape='cap', things=['bud', 'sock'], record=(27.0, 18.0, g == 1))
        small.append((g, L))
    out['prop/sewers-fatberg/small'] = small
    S0, _ = fat_body(42, 38, seed=12, shape='cap', things=['bud', 'sock'], record=None)
    out['prop/sewers-fatberg/small-slump'] = [(k, slump(S0, k, 72, 38, 30)) for k in range(6)]
    return out, hl


def paint(sid, hour, lit):
    sec = Sec(sid, NAME, hour)
    H = sec.H
    W = sec.W
    E = [tuple(int(v) for v in snap5(c)) for c in H['em']['eye']]
    KEEP = keepcols(H) + [(255, 255, 255)]
    sec.notes['lit'] = lit
    # ---- the far wall (daylight), the fatberg's back on it
    F, info = far_wall_d(sec, H, D_BAYS)
    FB, _ = fatberg(200, 64, seed=9, kind='back')
    F.blit(FB, wall_p(FAT_BACK_U), YWALL + 2 - FB.h)
    sec.notes['info'] = info
    # ---- side tunnels (void, floor, rings, eyes), then the vault rows
    tunnel_layers(sec, info, H, lit)
    nb = int(np.ceil(F.w / BAY))
    ribs = [wall_u(k * BAY + PIL / 2.0) for k in range(-3, nb + 3)]
    ya, yb = vault_layer_d(sec, H, GRATES, ribs, lit)
    sec.notes['grate_rows'] = (ya, yb)
    # ---- the far plane graded, then its lights
    F.recolor(G_of(H, H['air']), keep=KEEP)
    far_lights(F, info, H, lit, grates=GRATES)
    sec.add('far', F, S_W)
    mw = LT(H, 'mshaft_w')
    shaft_layer(sec, 'mshaft', S_W, info['mshafts'], H, YWALL + 2.5, w0=mw[0], w1=mw[1], strength=LT(H, 'mshaft'), seed=71)
    pour_layer(sec, H, info)
    # ---- the channel and the near walkway
    sm = s_d(FAT_MID[1])
    fx = dict(grates=GRATES, pours=[wall_u(cx) for (cx, cy, w) in info['pours']], fat=FAT_SKIN,
              fat_water=(FAT_MID[0] + (0.30 * 330 - 165) / sm, vb_of(sm) - 10, vb_of(sm) + 14),
              lost=_lost(W), wipes=_wipes(W), stream=STREAM)
    channel_layers_d(sec, H, F, fx, lit)
    # ---- the street grates' light shafts (plane S_SHAFT), from the grate's lower row to the water
    gy = 60 + 116 * S_SHAFT
    shafts = [(192 + (u - 192) * S_SHAFT, yb - 0.5) for u in GRATES]
    sw_ = LT(H, 'shaft_w')
    outs = shaft_layer(sec, 'shafts', S_SHAFT, shafts, H, gy, w0=sw_[0], w1=sw_[1], strength=LT(H, 'shaft'), seed=51)
    for Lf_ in outs:
        for i, (x, yt) in enumerate(shafts):
            hanging_wipes(Lf_, x, yt + 0.5, H, seed=300 + i)
        Lf_.a[..., :3] = snap5(Lf_.a[..., :3])
    sec.notes['shafts'] = [('shafts', S_SHAFT, u, yb - 0.5) for u in GRATES] + \
                          [('mshaft', S_W, wall_u(xc), y) for (xc, y) in info['mshafts']]
    # ---- things in the channel: the sunk bike and scooter, the fatberg's body
    sec.put(bike_sunk(random.Random(4)), BIKE[0], BIKE[1], shade=False)
    sec.put(scooter_sunk(random.Random(6)), SCOOTER[0], SCOOTER[1], shade=False)
    holes = []
    part, hl = fatberg(330, 152, seed=5, kind='mid', eye=E)
    sec.put(part, FAT_MID[0], FAT_MID[1], shade=False)
    sp = s_d(FAT_MID[1])
    ox, oy = sec.at(FAT_MID[0], sp) - 330 / 2.0, (GY - FAT_MID[1]) - 152
    holes += [(ox + cx, oy + cy, rx, ry, sp) for (cx, cy, rx, ry) in hl]
    # ---- the walk plane: the spitters' plinths, the leapers' risers, the secret's standpipe
    for i, d in enumerate(decor(sec, 'decor/sewers-d/plinth')):
        sec.put(plinth(100 + i), d['x'], 0, ax=24, shade=False)
    for i, d in enumerate(decor(sec, 'decor/sewers-d/pipe-stub')):
        sec.put(riser(200 + i), d['x'] - 8, 0, ax=4, shade=False)          # the leaper (and the mouth) at x - 8
    sec.put(standpipe(300), SECRET[0], 0, ax=15, shade=False)
    sec.plane(0)
    for key in sorted(sec.planes, key=lambda kf: (-kf[0], kf[1])):
        k, front = key
        Lp = sec.planes[key]
        _grade(H, KEEP, k)(Lp)
        sec.add('d%g%s' % (k, 'f' if front else ''), Lp, s_d(k), over=(k < 0 or front), depth=k, front=front)
    sec.planes = {}
    # ---- the game's fatberg entities: painted into the walk plane on the page and in previews (frame 0), offered
    #      as canal sprites in a game bake (every frame, graded as the walk plane)
    frames, bhl = _fat_frames(H, E)
    walk = [l for l in sec.layers if l['id'] == 'd0'][0]['img']
    for sprite_id, x, y, ax in (('prop/sewers-fatberg/big', FAT_X, GY, 42), ('prop/sewers-fatberg/small', SECRET[0], SECRET[1], 21)):
        for kind_ in (sprite_id, sprite_id + '-slump'):
            for (fi, Lf) in frames[kind_]:
                G = _grade(H, KEEP, 0.0)(Lf)
                if game_sprites.GAME:
                    entity(sec, kind_, G, x, 0, frames=(fi,), ax=ax if kind_ == sprite_id else G.w / 2.0,
                           grade=lambda L: L)
                elif kind_ == sprite_id and fi == 0:
                    walk.blit(G, sec.at(x, 1.0) - ax, y - G.h)
    if not game_sprites.GAME:
        ox, oy = sec.at(FAT_X, 1.0) - 42, GY - 106
        holes += [(ox + cx, oy + cy, rx, ry, 1.0) for (cx, cy, rx, ry) in bhl]
    sec.notes['fat_holes'] = holes
    # ---- the low front things at the lower edge (fg, 1.35), toward near-black
    FG = Layer(sec.lw(1.35), VIEW_H)
    rng = random.Random(9)
    make = dict(bucket=fg_bucket, hose=fg_hose, pallet=fg_pallet, cone=fg_cone, sandbags=fg_sandbags)
    for j, (what, x) in enumerate(FG_THINGS):
        part = make[what](rng)
        if j % 2:
            part = part.flip()
        FG.blit(part, x, VIEW_H - part.h + 2)
    FG.recolor(grader(key=H['fg']))
    sec.add('fg', FG, 1.35, over=True)
    sec.notes['band'] = (-40.0, D_EDGE)
    sec.notes['band_ok'] = ['d0']
    return sec


build = two_stacks(SID, paint)


# ---------------------------------------------------------------- the section's own gates (with the rules of the place)
def checks(sec):
    info = sec.notes['info']
    # every word painted: the UIT plates, the stretch number, the date stone (generic, no names)
    sec.notes['words'] = [('UIT', s_) for s_ in info['signs']] + \
        [('%d' % (14 + k), 'plate') for k, (kd, v) in enumerate(D_BAYS) if (kd, v) == ('manhole', 2)] + \
        [('1883', 'date stone') for (kd, v) in D_BAYS if (kd, v) == ('plain', 3)]
    res = cs.sewer_rules(sec) + cs.lettering(sec)
    # the side tunnels at the layout's mouths (nearest bay of the 64 px grid: within 32 px)
    want = [d['x'] for d in decor(sec, 'decor/sewers-d/tunnel')]
    got = [wall_u(t[0]) for t in info['tunnels']]
    off = [min(abs(g - w) for g in got) for w in want] if got else [999]
    res.append(('side tunnels at the layout mouths %s (within 32 px)' % want, len(got) == len(want) and max(off) <= 32,
                ' '.join('%d' % g for g in got)))
    # play sits on its art: each riser mouth at its leaper (x - 8, y 149 +- 2) on the walk plane; the standpipe's rim
    # under the secret's feet (y 148)
    walk = [l for l in sec.layers if l['id'] == 'd0'][0]['img']
    bad = []
    for d in decor(sec, 'decor/sewers-d/pipe-stub'):
        x = d['x'] - 8
        col = walk.a[P(147):P(151), P(x - 3):P(x + 1), 3]
        if not (col > 0).all():
            bad.append('riser %d' % x)
    rim = walk.a[P(148):P(150), P(SECRET[0] - 10):P(SECRET[0] + 10), 3]
    if not (rim > 0).all():
        bad.append('standpipe %d' % SECRET[0])
    res.append(('carriers: riser mouths at the leapers (y 149), the standpipe rim under the secret (y 148)', not bad, ', '.join(bad) or 'ok'))
    # the air of an interior (the sample's check 6): the far wall's darkest tone >= the walkway floor's >= the front's
    def lr(a):
        px = a[..., :3][a[..., 3] > 0].astype(float)
        lum = (0.299 * px[:, 0] + 0.587 * px[:, 1] + 0.114 * px[:, 2]) / 255
        return float(np.percentile(lum, 5)), float(np.percentile(lum, 95))
    fl = [l for l in sec.layers if l['id'] == 'floor'][0]['frames'][0]
    f0, f1 = lr([l for l in sec.layers if l['id'] == 'far'][0]['img'].a)
    near = [l for l in sec.layers if ((l.get('depth') is not None and l['depth'] <= 0) or l['id'] == 'fg') and l['img'].mask().any()]
    n0 = min(lr(l['img'].a)[0] for l in near)
    fw0, fw1 = lr(fl.a)
    t0, t1 = lr([l for l in sec.layers if l['id'] == 'tun2'][0]['img'].a)
    res.append(('air: darkest tone far wall >= walkway floor >= front planes', f0 >= fw0 - 0.011 and fw0 >= n0 - 0.011, '%.2f / %.2f / %.2f' % (f0, fw0, n0)))
    res.append(('air: light range tunnel ring z1.30 < far wall', t1 - t0 < f1 - f0, '%.2f / %.2f' % (t1 - t0, f1 - f0)))
    # the scale rule (13 px/m x s)
    def size(what, m, s, px, tol=0.10):
        t = PXM * m * s
        res.append(('scale: %s %g m at s=%.3f -> %.1f px' % (what, m, s, t), abs(px - t) <= tol * t, '%.1f px' % px))
    size('far wall, walkway to spring line', 7.4, S_W, YWALL - YSPRING)
    size('side tunnel mouth, wide', 5.0, S_W, 2 * info['tunnels'][0][1])
    size('bay (pilaster to pilaster)', 8.0, S_W, BAY)
    size('channel width (coping to far face)', 5.0, 1.0, (vb_of((YW - 60) / 116.0) - vb_of(s_d(D_EDGE))))
    size('plinth 2.1 m tall (walk plane)', 2.1, 1.0, 28)
    size('leaper riser 1 m round (walk plane)', 1.0, 1.0, 12.4, tol=0.15)
    res.append(('scale: the hero 40 px, never scaled', True, '40 px'))
    return res


# ---------------------------------------------------------------- previews: tmp/sewers/p4/d/
CAMS = (0, 330, 700, 1008, 1500, 1810, 2150, 2432)

if __name__ == '__main__':
    import time
    from lkpath import load_module          # noqa: F401
    root = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..'))
    outd = os.path.join(root, 'tmp', 'sewers', 'p4', 'd')
    os.makedirs(outd, exist_ok=True)
    run, idle = hero_frames()
    stacks = os.environ.get('LK_STACKS', 'amb,lit').split(',')
    if os.environ.get('LK_SHEET'):          # the game's fatberg frames alone, both stacks, on a mid grey
        rows = []
        for st, hr in (('amb', 'd'), ('lit', 'dl')):
            H = HOURS[hr]
            E = [tuple(int(v) for v in snap5(c)) for c in H['em']['eye']]
            fr, _ = _fat_frames(H, E)
            KEEP = keepcols(H) + [(255, 255, 255)]
            for sid_ in ('prop/sewers-fatberg/big', 'prop/sewers-fatberg/big-slump', 'prop/sewers-fatberg/small',
                         'prop/sewers-fatberg/small-slump'):
                rows.append([_grade(H, KEEP, 0.0)(L) for (_, L) in fr[sid_]])
        Wt = max(sum(L.w + 4 for L in r) for r in rows) + 4
        Ht = sum(max(L.h for L in r) + 4 for r in rows) + 4
        S = Layer(Wt, Ht)
        S.rect(0, 0, Wt, Ht, (96, 96, 104))
        y = 4
        for r in rows:
            x = 4
            for L in r:
                S.blit(L, x, y + max(l.h for l in r) - L.h)
                x += L.w + 4
            y += max(l.h for l in r) + 4
        save(S, os.path.join(outd, 'sw_d-fatberg-frames-u%d.png' % U), 1)
        raise SystemExit(0)
    for st in stacks:
        t0 = time.time()
        sec = build(st)
        print('%s build %.1f s, %d layers' % (st, time.time() - t0, len(sec.layers)), flush=True)
        cams = [int(c) for c in os.environ['LK_CAMS'].split(',')] if os.environ.get('LK_CAMS') else CAMS
        for i, cx in enumerate(cams):
            save(compose_level(sec, cx, 0, run[(i * 3) % len(run)]), os.path.join(outd, 'sw_d-%s-%d-u%d.png' % (st, cx, U)), 1)
        if st == 'amb':
            for cx in (330, 1810, 2432):
                if cx in cams:
                    save(compose_level(sec, cx, 0, run[0], overlay=True), os.path.join(outd, 'sw_d-layout-%d-u%d.png' % (cx, U)), 1)
        print('done %.1f s' % (time.time() - t0), flush=True)
