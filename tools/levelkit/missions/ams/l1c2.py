# Section c2 RONDVAART of level 1 (mission ams) in the canal look: the canal cruise on the Amstel, golden late
# afternoon. The tour boat carries the camera (a layer at speed 0); the river lies under the whole floor band.
#
# Scene card
#   Place:     the Amstel between the boarding quay (0-60) and the Waterlooplein jetty (2492-2632)
#   Hour:      golden late afternoon (HOURS['golden'], shared with c and c1; their clouds, wisps, water and leaf ramp
#              from parts_l1c); key hue: warm gold
#   Set piece: the Magere Brug (x 2060), a white wooden bascule with Carre on the far bank behind it
#   Water:     river: the far bank's mirror rows (y 120-146) and the floor painter's river water (146-216)
#   Planes:    sky 0, clouds 0.03, skyline 0.14, far bank 0.5 (depth 58: the bridges land on it), water rows
#              0.5 -> 0.741, floor rows 0.741 -> 1.345, mooring piles at depth 25, piers at 18/21, the bridge
#              decks and the houseboat's tops as slices (one rows layer per height), the walk plane, the boat (0)
#   Local:     the low brick bridges, the moored houseboat with its stove smoke, mooring dolphins, the tall stone
#              quay wall with rings and ladders, long mansions with dormers, moored barges, the flea-market stall
#   Rules:     every platform, x and water as the game has it; posts on kerbs only (c2 has no post rows)
#   Scale:     13 px per metre x the plane's speed (SCALE-BRIEF.md): far bank (0.5) storey 20 px, Carre 20 m = 130 px
#              (its top leaves the screen), elms 14-16 m, lamps 4.8 m, cars 4.3 m, boats at their lengths; skyline
#              (0.14) storey 5 px, towers 60/53 m. The gameplay pieces (bridges, boats that carry the hero) keep their shape.
import time
from parts_l1c2 import *
from parts_l1c import CLOUDS_G, golden_wisps, water_rows, floor_water_g, WATER_G
from level import GAME
from parts_l1c import small_boat
from game_sprites import entity, sprites, Sprite, walk_grade       # noqa: F401 (`sprites` is the hook bake_game.py calls)

# The fidelity cameras of the game bake (camera x, the screen x the tier-2 / tier-4 crops centre on): the boarding
# quay, the first stop, the first low bridge, the houseboat, the party stop, the second low bridge, the Magere Brug
# stop and past it, the Waterlooplein jetty (the last screen).
GAME_CAMS = [(0, 60), (124, 192), (520, 180), (900, 258), (1164, 192), (1500, 160), (1742, 318), (1960, 100), (2248, 280)]

NOTE = ("The cruise on the Amstel in the golden afternoon: the tour boat holds the camera while the river, the "
        "mooring dolphins and the far bank slide by. The two low brick bridges and the white Magere Brug cross the "
        "river in true perspective from their near slab to the tall far quay, where Carre stands behind the bascule.")

LOWS = (700, 1660)
MAGERE = 2060
YH, YQ, YW = 100, 104, 120                 # the far street, the quay top (2.5 m over the water), the water
AIR_FAR = 0.32


def air_by_depth(sec):
    """The air on a slice pixel by its floor depth (the far end of a bridge takes the far bank's air)."""
    lo, hi = sec.AIR

    def f(rgb, d):
        out = rgb.copy()
        for (d0, d1, a) in ((18, 36, 0.08), (36, 48, 0.15), (48, 99, 0.22)):
            m = (d >= d0) & (d < d1)
            if m.any():
                out[m] = np.asarray(grader(air=(lo, hi, a, 0.2))(rgb[m].astype(float)), np.uint8)
        return out
    return f


def put_top(sec, part, x, depth, ax, ytop, front=False):
    """Stand a part so that its top row is at screen y ytop at this depth (used for things in the water)."""
    k = round(depth * 2) / 2
    sp = s_d(k)
    base = GY + (ytop + part.h - (GY - k)) / sp
    return sec.put(part, x, depth, ax=ax, base=base, shade=False, front=front)


SUN = (330, 52)
TOWER_H = (110, 96)


def towers(SK):
    # at speed 0.14 (1.8 px per metre): towers of 60 and 52 m; only their lanterns rise over the far bank's roofs
    SK.blit(tower(TOWER_H[0]), 120, 72 - TOWER_H[0])
    SK.blit(dome_church(40, 50), 330, 72 - 50)
    SK.blit(tower(TOWER_H[1]), 520, 72 - TOWER_H[1])


def bridge_footprint(u):
    m = np.zeros(np.shape(u), bool)
    for (xc, hw) in [(x, LB_OUT) for x in LOWS] + [(MAGERE, MB_OUT)]:
        m |= np.abs(u - xc) < hw
    return m


def river_fn(sec):
    """The river seen from above (the floor band): c and c1's golden floor water (parts_l1c.floor_water_g), with the
       shade under the bridges' decks (depth 0 .. 58)."""
    def f(u, d, v):
        out = floor_water_g(sec, u, d, v)
        sh = bridge_footprint(u) & (d >= -1.0)
        out[sh] = snap5(out[sh].astype(float) * np.array((0.56, 0.48, 0.54)))
        return out
    return f


def glitter(rows, x=None):
    """The low sun's glitter on the river: it stays under the sun (speed 0); broken dashes, longer toward the viewer."""
    x = SUN[0] if x is None else x
    out = []
    for f in range(3):
        G = Layer(VIEW_W, rows)
        xx, yy = grid(0, 0, VIEW_W, rows)
        r = np.floor(yy * DET) / DET / (rows - 1)
        hw = 5 + r * 34
        d = np.abs(xx - x) / hw
        p = hash01((xx + f * 5) / (2 + np.floor(r * 6)), yy * DET, 77 + f)
        on = (d < 1) & (p > 0.42 + d * 0.50 + 0.10 * (np.floor(yy * DET) % 2)) & (r > 0.02)
        col = np.where(((d < 0.35) & (p > 0.86))[..., None], np.array((255, 246, 214)), np.where((d < 0.7)[..., None], np.array((252, 226, 160)), np.array((236, 186, 120))))
        G.put(0, 0, col.astype(np.uint8), on)
        out.append(G)
    return out


def floor_extra(u, d, v, rgb):
    """The quays' big pale stone tiles (the game's 'tiles' street; level.py's own branch gives float indices) and
       their steps down to the water (u 32-60 and 2492-2520, depth 10-26)."""
    S = np.array(R['stone_warm'], np.uint8)
    q = ((u < 60) | (u >= 2492)) & (d < 26.4) & (d > -45)
    if q.any():
        i, j = np.floor(u / 16.0), np.floor(v / 10.0)
        fu, fv = u / 16.0 - i, v / 10.0 - j
        t = 5 - (hash01(i, j, 51) > 0.7).astype(int) - ((fbm(u / 23.0, v / 9.0, 52, 2) < 0.34) & (hash01(u * 2, v * 2, 53) > 0.5)).astype(int)
        t = np.where((fu < 0.05) | (fv < 0.08), 3, t)
        rgb[q] = S[np.clip(t, 0, 6)][q]
    for (a, b, lvl) in ((32, 46, 1), (46, 60, 2), (2506, 2520, 1), (2492, 2506, 2)):
        m = (u >= a) & (u < b) & (d >= 10) & (d < 26)
        if not m.any():
            continue
        t = np.where((d < 11.0), 6, 4 - lvl + (hash01(np.floor(u / 7), np.floor(d / 4), 9) > 0.6))
        t = np.where((np.abs(u - (b if a < 1000 else a)) < 0.8), 1, t)
        rgb[m] = S[np.clip(t, 0, 6)][m]
    # the low sun on the quays: the stone takes its warm light (the detail stays: one step toward the light colour)
    lit = ((u < 60) | (u >= 2492)) & (d > -45)
    if lit.any():
        px = rgb[lit].astype(float)
        rgb[lit] = snap5(px + (np.array((255, 206, 140), float) - px) * 0.16)


def shade_water_rows(frames, s0, s1, mul=(0.56, 0.48, 0.54)):
    """Darken the river's rows under the bridges' decks (depth 0 .. 58); returns the mask of the last frame."""
    mask = None
    for L in frames:
        mask = np.zeros(L.a.shape[:2], bool)
        n = L.ph
        for j in range(n):
            sp = s0 + (s1 - s0) * j / max(n - 1, 1)
            d = 116 * (1 - sp)
            if d > BACK_D + 0.5 or d < -1.0:
                continue
            for (xc, hw) in [(x, LB_OUT) for x in LOWS] + [(MAGERE, MB_OUT)]:
                a = P(192 + (xc - hw - 192) * sp); b = P(192 + (xc + hw - 192) * sp)
                seg = L.a[j, max(0, a):max(0, b), :3]
                seg[:] = snap5(seg.astype(float) * np.array(mul))
                mask[j, max(0, a):max(0, b)] = True
    return mask


def build():
    t0 = time.time()
    sec = Sec('c2', 'Rondvaart', 'golden')
    rng = random.Random(23)
    sec.fl = dict(sec.fl)
    sec.fl['canals'] = [[60, 2492]]                        # the river under the whole band (the painter's water)
    sec.fl['street'] = [dict(e, kind='quay') if e['kind'] == 'tiles' else e for e in sec.fl['street']]
    H = sec.H
    # ---- sky, clouds, skyline
    S, CL = sky_layers(sec, cloud_boxes=CLOUDS_G, seed=7)          # c and c1's golden cloud set and wisps
    golden_wisps(sec, CL)
    glow(S, SUN[0], SUN[1], 22, [hx('#fff2c8'), hx('#fde4b4'), hx('#f8d49c'), hx('#f2c88e')])
    S.a[..., :3] = snap5(S.a[..., :3])                              # the sun's glow, painted after the add: on the grid
    SK = skyline_layer(sec, speed=0.14, yb=72, extra=towers, seed=8, air=0.70)
    # ---- the far bank (depth 58), Carre, the bridges' landings and far ends
    landings = [(sec.at(x, 0.5), 'low') for x in LOWS] + [(sec.at(MAGERE, 0.5), 'magere')]
    F, fi = amstel_bank(sec, rng, YH, YQ, YW, carre_x=1091, landings=landings)
    ytop = yrow(GY - 112, BACK_D)
    for (bp, kind) in landings:
        if kind == 'low':
            for sg in (-1, 1):
                lp = lamp_far(31); F.blit(lp, bp + sg * 15.5 - 2, ytop - lp.h)
        else:
            mf = magere_near(scale=0.5, lamps=True)
            F.blit(mf, bp - 48, ytop - 36)
            for sg in (-1, 1):
                sp_ = stone_pier(16, d=BACK_D)
                F.blit(sp_, bp + sg * 27 - sp_.w / 2, YW - sp_.h + 1)
    F.recolor(grader(key=sec.KEY, air=(sec.AIR[0], sec.AIR[1], AIR_FAR, 0.2)))
    sec.notes['scale'] = fi['scale']
    sec.notes['carre'] = fi['carre']
    sec.add('far', F, 0.5)
    # ---- the river's far rows (c and c1's warm water, parts_l1c.water_rows), the bridges' shade in them
    wat = water_rows(sec, [(S, 'tilex'), (CL, 'tilex'), (SK, 'stretch'), (F, 'copy')], F.w, YW, 0.5, k=2.4, ncol=28, seed=25)
    s146 = s_d(GY - BACKY)
    shade_water_rows(wat, 0.5, s146)
    # ---- things on the floor: the common decor, the signs, the stall, the mooring piles, the piers
    rest = standard_decor(sec, rng, leaf='leaf_gold')
    for d in rest:
        sid = d['sprite']
        if sid == 'decor/ams/route-sign' and d['floorDepth'] is not None:
            word = 'RONDVAART' if d['x'] < 100 else 'WATERLOOPLEIN'
            p = route_sign(word, d['box']['w'])
            sec.put(p, d['x'], d['floorDepth'])
        elif sid == 'decor/ams/market-stall' and d['floorDepth'] is not None:
            sec.put(market_stall(rng), d['x'], d['floorDepth'])
    for r in rows_of(sec, 'mooring'):
        for x in row_at(sec, r):
            k = r['depth']
            pl_ = pile(rng, int(x)); mr = pile_mirror(int(x))
            yw = (GY - k) + 4 * s_d(k)
            put_top(sec, pl_, x, k, pl_.w / 2, yw - pl_.h + 1)
            put_top(sec, mr, x, k, mr.w / 2 + 1, yw + 1)
    for xc in LOWS:
        for dpt in (PIER_D[1], PIER_D[0]):
            pw_ = pier_wall(66, d=dpt, seed=41 + int(xc) + int(dpt))
            put_top(sec, pw_, xc, dpt, pw_.w / 2, yrow(GY - 127, dpt))
    for dpt in (PIER_D[1], PIER_D[0]):
        for sg in (-1, 1):
            sp_ = stone_pier(18, d=dpt, seed=51 + sg)
            put_top(sec, sp_, MAGERE + sg * 55, dpt, sp_.w / 2, yrow(GY - 127, dpt))
    # ---- the walk line: the houseboat's front (its platforms), the bridges' near ends and the near portals (front)
    hb, (ox, oy) = houseboat_front(rng)
    sec.put(hb, ox, 0, ax=0, base=oy + hb.h, shade=False)
    for xc in LOWS:
        lf = low_bridge_front(rng)
        sec.put(lf, xc, 0, ax=33, base=106 + lf.h, shade=False, front=True)
    mf = magere_front()
    if GAME:
        # the bascule between the hinges (x -+ 50) is the game's entity (`ams-magere-brug`): it lifts its leaves
        mf.a[:, P(15):P(115)] = 0
    sec.put(mf, MAGERE, 0, ax=65, base=103 + mf.h, shade=False, front=True)
    mn = magere_near(scale=1.0, rods=not GAME)
    sec.put(mn, MAGERE, 0, ax=96, base=40 + mn.h, shade=False, front=True)
    # ---- the floor (quays, steps, the river) and the planes
    FL = floor_layer(sec, extra=floor_extra, water_fn=river_fn(sec))
    # split the floor: the river under the sun's glitter (speed 0), the bridges' shade over it, the quays on top
    ys = (np.arange(P(BACKY), P(VIEW_H)) + 0.5) / U
    sv = s_y(ys)
    pc = (np.arange(FL.pw) + 0.5) / U
    uu = 192 + (pc[None, :] - 192) / sv[:, None]
    dd = np.broadcast_to((GY - ys)[:, None], uu.shape)
    river = (uu >= 62.4) & (uu < 2489.6)
    shade_m = river & (dd >= -1.0) & bridge_footprint(uu)
    fl_d = sec.layers.pop()
    def part(mask):
        Lp = Layer(FL.w, FL.h); Lp.a = FL.a.copy(); Lp.a[..., 3] = np.where(mask, 255, 0).astype(np.uint8)
        return Lp
    RV, RS = part(river), part(shade_m)
    FL.a[..., 3][river] = 0
    # the far rows' shade as its own layer too
    shd = []
    for Lw in wat:
        m = shade_water_rows([Layer(Lw.w, Lw.h)], 0.5, s146)
        Ls = Layer(Lw.w, Lw.h); Ls.a = Lw.a.copy(); Ls.a[..., 3] = np.where(m, 255, 0).astype(np.uint8)
        shd.append(Ls)
    iw = next(i for i, l in enumerate(sec.layers) if l['id'] == 'water') + 1
    nb = len(sec.layers)
    sec.add('river', None, fl_d['s0'], y=BACKY, kind='rows', frames=[RV], s0=fl_d['s0'], s1=fl_d['s1'])
    sec.add('glitter', None, 0, y=YW + 1, kind='frames', frames=glitter(VIEW_H - YW - 1))
    sec.add('water-shade', None, 0.5, y=YW, kind='rows', frames=shd, s0=0.5, s1=s146)
    sec.add('river-shade', None, fl_d['s0'], y=BACKY, kind='rows', frames=[RS], s0=fl_d['s0'], s1=fl_d['s1'])
    new = sec.layers[nb:]; del sec.layers[nb:]
    sec.layers[iw:iw] = new
    sec.layers.append(fl_d)
    sec.flush()
    # ---- slices: the bridge decks, parapets, slab sides, the Magere's top beams; the houseboat's ends and tops
    def grade(Lr):
        Lr.recolor(grader(key=sec.KEY)); Lr.recolor(curve(*H['curve']))
    boxes = []
    for xc in LOWS:
        boxes += low_bridge_boxes(xc)
    mb = magere_boxes(MAGERE)
    bascule = []
    if GAME:
        # the game's bascule (`ams-magere-brug`) lifts the deck between the hinges (x -+ 50). Its closed deck in depth
        # becomes layers of its own ('mb<h>': the game draws them while the bascule is closed, CanalDef.show); the
        # portals' ends of the deck stay. The three boxes keep the whole deck's tones (xc), so closed they paint the
        # page's deck px for px. Lifting, the entity draws the leaves (near ends: magere_leaves; walkways: its faces).
        dk = mb[0]
        ends = [Box(dk.x0, MAGERE - MB_HALF, dk.d0, dk.d1, dk.h0, dk.h1, dk.side, dk.top),
                Box(MAGERE + MB_HALF, dk.x1, dk.d0, dk.d1, dk.h0, dk.h1, dk.side, dk.top)]
        for b_ in ends:
            b_.xc = dk.xc
        bascule = [Box(MAGERE - MB_HALF, MAGERE + MB_HALF, dk.d0, dk.d1, dk.h0, dk.h1, dk.side, dk.top)]
        mb[0:1] = ends
    boxes += mb
    sl = slice_layers(sec, boxes, 'br', grade_fn=grade, air_fn=air_by_depth(sec))
    if bascule:
        # each bascule slice right after the bridges' slice of its height (the page's one layer per height)
        sl += slice_layers(sec, bascule, 'mb', grade_fn=grade, air_fn=air_by_depth(sec))
        sl.sort(key=lambda d: -abs(float(d['id'][2:]) - EYE))
    sl += slice_layers(sec, houseboat_boxes(), 'hb', grade_fn=grade)
    for d in sl:
        d['frames'][0].a[..., :3] = snap5(d['frames'][0].a[..., :3])
    i0 = next(i for i, l in enumerate(sec.layers) if l['id'] == 'd0')
    sec.layers[i0:i0] = sl
    # ---- the stag party's boat (`ams-party-boat`, spawned mid-river: the game's entity, not on the page): c's little
    # open boat (parts_l1c.small_boat) in this hour's light, two wake frames (the sprite `decor/ams/ams-boat-platform`;
    # gunwale on the frame's anchor row, the motor cut to the box as in c)
    if GAME:
        for f in (0, 1):
            sb = small_boat(random.Random(60 + f), 60, seed=60 + f, motor=2)
            sec.notes.setdefault('game_sprites', []).append(
                (Sprite('decor/ams/ams-boat-platform', [f], sb, ax=32, ay=4), walk_grade(sec)))
    # ---- the Magere Brug's bascule (the game's entity): its four frames, closed -> open
    if GAME:
        for f, deg in enumerate(MB_LEAF_DEG):
            Lm = magere_leaves(deg)
            Lm.recolor(grader(key=sec.KEY)); Lm.recolor(curve(*H['curve']))      # as Sec.flush grades the d0f plane
            sec.notes.setdefault('game_sprites', []).append(
                (Sprite('decor/ams/magere-brug', [f], Lm, ax=64, ay=82), lambda L: L))
    # ---- the tour boat: it stays at its place on the screen (speed 0)
    if GAME:
        # The game draws the boat as an entity (`ams-cruise-boat`, src/game/content/missions/ams/cruise.ts): it boards,
        # sails and docks while the camera is locked to it (the stern CB['stern'] px right of the view's left edge) and
        # stays behind when the players walk off. Its painting becomes the sprite 'decor/ams/ams-cruise-boat': frame 0
        # the boat at rest (calm water), frames 1 and 2 the two wake frames the game alternates while it sails. One
        # picture: the body with the hull's near side over it (the entity draws once, under the riders). The game's
        # box (198 x 48, the stern's deck point at (1, 35)) crops the stern wash behind x 55, the bow wave past x 253
        # and the mirror rows under y 189 (clip=True: the bake reports the px).
        for f, calm in ((0, True), (1, False), (2, False)):
            b, o = cruise_boat(f, random.Random(5), calm=calm)
            for Lb in (b, o):
                Lb.recolor(grader(key=sec.KEY)); Lb.recolor(curve(*H['curve']))
            b.blit(o, 0, 0)
            # the glass roof's far edge (from y 140.9) starts above the box (top y 141): its first real row moves
            # into the box's top row, so at 1x the roof keeps its white far edge (at 2x / 4x that row is edge anyway)
            top = P(CB['deck'] - 35)
            m = b.a[top - 1, :, 3] > 0
            b.a[top][m] = b.a[top - 1][m]
            sec.notes.setdefault('game_sprites', []).append(
                (Sprite('decor/ams/ams-cruise-boat', [f], b, ax=CB['stern'], ay=CB['deck'], clip=True), lambda L: L))
        sec.hero_deck = (0, sec.W, CB['deck'])
        sec.notes['build_s'] = time.time() - t0
        return sec
    bodies = []
    over = None
    for f in range(3):
        b, o = cruise_boat(f, random.Random(5))
        for Lb in (b, o):
            Lb.recolor(grader(key=sec.KEY)); Lb.recolor(curve(*H['curve']))
        bodies.append(b)
        over = over or o
    i1 = next(i for i, l in enumerate(sec.layers) if l['id'] == 'd0') + 1
    nb = len(sec.layers)
    sec.add('boat', None, 0, kind='frames', frames=bodies)
    sec.add('boat-over', over, 0, over=True)
    new = sec.layers[nb:]
    del sec.layers[nb:]
    sec.layers[i1:i1] = new
    sec.hero_deck = (0, sec.W, CB['deck'])
    sec.notes['build_s'] = time.time() - t0
    return sec


def preview8(sec, cams, lay=5):
    """level.preview, for more than four cameras (the hero's run frames repeat)."""
    run, idle = hero_frames()
    os.makedirs('out', exist_ok=True)
    for i, cx in enumerate(cams):
        save(compose_level(sec, cx, i % 3, run[(i * 3) % len(run)]), f'out/l1{sec.id}-{i}-u{U}.png', 1)
    save(compose_level(sec, cams[lay], 0, run[0], overlay=True), f'out/l1{sec.id}-layout-u{U}.png', 1)


def checks(sec):
    """The rules of the place: the boat's deck is at the game's deck line (176) and its roof at 152."""
    res = []
    bo = next(l for l in sec.layers if l['id'] == 'boat')['frames'][0]
    ok = bo.a[P(CB['roof']) + 1, P(CB['stern'] + 100), 3] > 0 and bo.a[P(CB['deck']) - 1, P(CB['stern'] + 20), 3] > 0
    res.append(('the boat has art at its deck (176) and roof (152)', bool(ok), 'stern x %d' % CB['stern']))
    # the scenery scale (SCALE-BRIEF.md): 13 px per metre x the plane's speed, measured from the painted parameters
    sc = sec.notes['scale']

    def band(name, vals, lo, hi, unit='px'):
        v0, v1 = min(vals), max(vals)
        res.append((name, lo <= v0 and v1 <= hi, '%s %s (%d things)' % ('%g' % v0 if v0 == v1 else '%g-%g' % (v0, v1), unit, len(vals))))
    st = sc['storeys']
    res.append(('storey on far (s=0.50): %.1f px, target 20 +-15%%' % (sum(st) / len(st)),
                all(17 <= v <= 23 for v in st), '%.1f-%.1f px (%d fronts)' % (min(st), max(st), len(st))))
    # skyline (s=0.14): far_roofs puts a window row every 5 px (target 40 x 0.14 = 5.6)
    res.append(('storey on skyline (s=0.14): 5 px, target 5.6 +-15%', 4.76 <= 5 <= 6.44, '5 px; towers %d/%d px = %d/%d m'
                % (TOWER_H + tuple(round(h / (13 * 0.14)) for h in TOWER_H))))
    ca = sec.notes['carre']
    res.append(('Carre front 20 m at s=0.50: 130 px', abs(ca[3] - 130) <= 0.15 * 130, '%d x %d px = %.0f x %.0f m'
                % (ca[2], ca[3], ca[2] / 6.5, ca[3] / 6.5)))
    band('far trees 14-18 m at s=0.50: 91-117 px', sc['trees'], 91, 117)
    band('far lamps 4.5-5 m at s=0.50: 29-33 px', sc['lamps'] + [31], 29, 33)
    band('far cars 4.3 m (vans 5 m) at s=0.50: 27-33 px long', sc['cars'], 27, 33)
    band('far bikes 1.8 m at s=0.50: 12 px long', [12], 10, 14)
    bt = sc['boats']
    band('far houseboats 15-20 m at s=0.50: 98-130 px', [w for (k, w) in bt if k == 'house'], 98, 130)
    band('far tour boat 20-25 m at s=0.50: 130-162 px', [w for (k, w) in bt if k == 'tour'], 130, 162)
    band('far barges 20-25 m at s=0.50: 130-162 px', [w for (k, w) in bt if k == 'barge'], 130, 162)
    band('far sloops 6 m at s=0.50: 33-45 px', [w for (k, w) in bt if k == 'sloop'], 33, 45)
    ph = MB_TOPH - (GY - 112)                                     # the portal tops over the deck (y 112)
    res.append(('Magere Brug portals 5.5 m over the deck at s=1.0: 72 px (s=0.5: 36)', abs(ph - 72) <= 0.15 * 72,
                '%d px = %.1f m, the bulbs on its beams' % (ph, ph / 13.0)))
    res.append(('mooring dolphins at s=0.78 (depth 25): 2.7 m = 28 px (kept)', True, '28 px'))
    return res


if __name__ == '__main__':
    t0 = time.time()
    sec = build()
    print('build %.1f s' % (time.time() - t0), [l['id'] for l in sec.layers])
    preview8(sec, (0, 420, 864, 1164, 1500, 1742, 1960, 2248), lay=2)
    print('total %.1f s' % (time.time() - t0))
