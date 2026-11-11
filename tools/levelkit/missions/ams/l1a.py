# Section a of level 1: GRACHTENGORDEL, a bright spring morning, in the canal look.
#
# Scene card
#   Place:      the canal ring. The quay street along the main canal (0-720), bridge 1 (720-880), the side canal under
#               the raised lift bridge with two houseboats (1060-1340), the PLEINTJE (1432-1904), the narrow shopping
#               street with awnings and gable ledges (1904-2600), bridge 2 (2600-2760), the arrival at FABEL FRIET.
#   Street:     one straight street (street.py + street_a.py): kerbs at depth 5 and -16.3, thresholds where the lane
#               meets a deck, a square or the lift bridge, lamps and trees on the pavements.
#   Hour:       bright spring morning; key hue sky blue; key and air: HOURS['morning'] (= scene a of the study).
#   Set pieces: the arched brick bridges with their raised decks, the raised white lift bridge, the houseboats,
#               the shop fronts with awnings, FABEL FRIET. The Westertoren-like tower stands once in the skyline.
#   Water:      the main canal behind the quay coping (rows 0.5 -> 0.741); the side canals on the floor.
#   Planes:     sky 0, clouds 0.03, skyline 0.10 (air 0.72), far bank 0.5 (air 0.25), water rows, the floor (rows
#               0.741 -> 1.345), things on the floor at their depth (house fronts 14 -> 0.879, walk plane 1, front
#               rows over the heroes), top faces of awnings and boats as rows layers, the bridge decks in depth slices.
#   Local:      Amsterdammertjes on the kerbs, elms, crown lanterns, bikes and racks, tulips, the red-black flag,
#               houseboats with plants, the herring cart, the tulip stall, gabled canal houses, shops (KAAS, BROOD,
#               BLOEMEN, KOFFIE, BOEKEN, FIETSEN), FABEL FRIET.
#   Rules:      posts on kerbs only (the game's rows); every platform, hump and hazard where the game has it.
from parts_l1a import *
from level import GAME
from game_sprites import entity, sprites, Sprite, walk_grade      # `sprites` is the hook bake_game.py calls

# The fidelity cameras of the game bake (bake_game.py): (camera x, the logical screen x the tier-2 / tier-4 crops centre
# on). Together they show every set piece and layer kind: the first screen (sky, clouds, skyline, far bank, water,
# floor), bridge 1's deck slices, the lift bridge (towers, portal rows, barriers), the houseboats' deck and roof rows,
# the Pleintje, the awnings' top faces and the balcony, bridge 2 with its lantern, FABEL FRIET with its front counter.
GAME_CAMS = [(0, 192), (600, 200), (760, 160), (1000, 120), (1180, 220), (1560, 192), (2000, 140), (2240, 192),
             (2440, 192), (2700, 192), (2960, 192), (3200, 110)]

NOTE = ("Grachtengordel on a bright spring morning, on one straight street. The bridge decks rise over their humps "
        "in depth slices, the awnings and the houseboat decks have top faces that turn with the camera, and the lift "
        "bridge over the side canal is up for the boats: towers on both banks, the deck high between them, barriers "
        "down. FABEL FRIET waits at the end in cream-white wood.")

B1 = dict(x0=720, len=160, h=14, water=[736, 864], far=5, near=-16.3)
B2 = dict(x0=2600, len=160, h=14, water=[2632, 2728], far=5, near=-16.3)
BOATS = [dict(x0=1094, w=82, cx=1108, cw=54, col='green', roof='moss'),
         dict(x0=1212, w=104, cx=1226, cw=58, col='red', roof='roof_slate')]
AWNINGS = [(1980, 132, 56, 'green'), (2110, 128, 60, 'red'), (2230, 126, 56, 'blue'), (2296, 96, 30, 'roof_tile')]
BALCONY = (2316, 66, 36)
# the shops of the house rows: x -> (word, paint, goods, a flat awning on the facade or None)
SHOPS = {1933: ('KAAS', 'yellow', 'cheese', 'yellow'), 1987: ('BROOD', 'red', 'bread', None, 23),
         2039: ('BLOEMEN', 'green', 'flowers', 'green'), 2139: ('KOFFIE', 'black', 'cups', None),
         2253: ('BOEKEN', 'blue', 'books', None), 2345: ('FIETSEN', 'green', 'bikes', None),
         2601: ('DROP', 'black', 'mixed', 'red'), 2935: ('THEE', 'green', 'cups', 'green'),
         3147: ('TULPEN', 'red', 'flowers', 'red'), 3499: ('BOEKEN', 'blue', 'books', 'blue')}
HOIST = (2500, 71)                   # the hoist secret's beam: its top at y 71, the hook at (2500, 76) (secrets.ts)
GULL_B2_TOP = 92 - 5 - 2              # bridge 2's lantern top: the gull's feet (y 92, 5 px up at depth 5) less 2 px
HOUSE_AIR = 0.24                     # the air amount at the house fronts (depth 14); it grows with depth, at most 0.3


def depth_air(d):
    return float(min(0.3, max(0.0, HOUSE_AIR * d / 14.0)))
BRICK = {3045: 'brick_black', 3097: 'paint_grey', 2453: 'brick_red', 2499: 'brick_ochre',     # fronts that differ from the look's default
         3239: 'brick_brown'}       # (3239 now stands right of TULPEN: grey on grey without it, since the row has no 3195)
FAR_SHOPS = [('KAAS', 'yellow'), ('BLOEM', 'green'), ('BOEK', 'blue'), ('FIETS', 'blue'), ('TABAK', 'green')]

# ---- the scale rule (SCALE-BRIEF.md): 13 px per metre x the plane's speed
FAR_S = 0.5                                       # the far bank of the main canal
FAR_AIR = 0.50                                    # the far bank is larger now: more of it in the morning air (key hue)
FAR_SC, FAR_ST = 2 * FAR_S, 40 * FAR_S            # the kit's house scale there, a storey (20 px)
FAR_NST = (2, 3, 3, 3, 4)                         # upper storeys of the far houses (most roofs stay in view)
ELM_M = 15.0                                      # the quay elms
# boats moored at the far quay (layer px at speed 0.5): houseboats 16-18 m, sloops 6 m, barges 21-23 m, a tour boat 21 m
FAR_BOATS = [('house', 20, (112, 'green')), ('sloop', 150, (38, 'blue')), ('sloop', 196, (34, 'white')),
             ('barge', 300, (140,)), ('sloop', 470, (38, 'red')), ('house', 540, (104, 'white')),
             ('tour', 690, (136,)), ('sloop', 860, (36, 'green')), ('house', 930, (116, 'blue')),
             ('barge', 1100, (146,)), ('sloop', 1280, (38, 'white')), ('house', 1340, (108, 'wood')),
             ('sloop', 1480, (36, 'red')), ('house', 1540, (118, 'green')), ('barge', 1700, (140,)), ('sloop', 1870, (36, 'blue'))]


def nup(h, frame):
    """Upper storeys of a street house from the game's box height: the low fronts two, the tall ones three."""
    if h < 119:
        return 2
    if h == 119:
        return 2 + frame % 2
    return 3


def attach_y(y_platform):
    """The screen row where an awning platform of the walk plane meets the house fronts (depth 14)."""
    return (176 - 14) - (176 - y_platform) * s_d(14)


# storey lines that meet the game's ledges (house x -> street_house kwargs). The awning shops' fascias end where the
# awning's top face meets the front; the tiled awning at y 96 shades a first-floor window of 2297; the balcony at
# y 66 stands at the sill of the French windows of 2345's second floor. 3097 gets two columns, the right one in line
# with its waver (the door below it).
LINES = {1987: dict(gf=q_(162 - attach_y(132) + 12)), 2139: dict(gf=q_(162 - attach_y(128) + 12)),
         2253: dict(gf=q_(162 - attach_y(126) + 12)),
         3097: dict(cols=[8, 33]),
         2297: dict(gf=42, storeys=[31, 35, 34]),
         2345: dict(gf=54, storeys=[38, 35], french=1)}

# ---- the house rows on the plane of depth 14 (tmp/l1/port/HOUSE-FIT-BRIEF.md): the fronts of a row TILE.
# A row starts at a plane x (its first left edge, on the 1/4 px grid, so every tier floors it alike) and lists its
# fronts left to right as (look, width): a look is the game house x whose frame, seed, shop and lines it takes, or
# 'fabel' / 'neighbour'. Front j owns the slot from its left edge to the next front's, and paints only inside it
# (street_house paints at the slot width; nothing of a front reaches past its layer). The game's house boxes are
# Δx apart but only Δx · s_d(14) on this plane, so the slots follow the things the game hangs on the fronts:
#   row 1 (the shopping street, side walls at 1903 / 2632): the awning platforms' backs on the fronts (BROOD 1763-1814,
#     KOFFIE 1878-1932, BOEKEN 1983-2034, the tiled awning of 2297 2041-2069), the wavers (2016 in BROOD's front:
#     1786-1806, its stair window in line with BROOD's middle column; 2380 in 2401's: 2106-2126, over its left
#     column), the hoist beam (2221, the ochre front 2499); BLOEMEN takes the boxes of 2039 and 2087 (no room for two
#     fronts between BROOD's awning and KOFFIE's), 2297 and FIETSEN are narrow fronts (one column of windows).
#   row 2 (side wall at 2803 .. the end of the section): the waver 3110 in 3097's front (2748-2768); TULPEN and 3239
#     share the room of 3147, 3195 and 3239 up to FABEL FRIET (kept where it stood, whole), then its neighbour (now
#     whole too: it hid FABEL's right 12 px), the row to the last screen and one front past it.
ROWS = [
    (1692.75, [(1933, 68), (1987, 70), (2039, 45), (2139, 59), (2199, 46), (2253, 55), (2297, 35), (2345, 34),
               (2401, 48), (2453, 45), (2499, 48), (2547, 48), (2601, 48)]),
    (2483.75, [(2835, 48), (2885, 46), (2935, 48), (2991, 47), (3045, 47), (3097, 50), (3147, 57), (3239, 57),
               ('fabel', 98), ('neighbour', 66), (3449, 46), (3499, 52), (3543, 44), (3590, 46)]),
]
ROW_LOOKS = {3590: (2, 2)}            # a front that is not one of the game's houses: (frame, upper storeys)
# the game's window wavers (npc ams-window-waver, drawn at depth 14; section-a.ts): (x, spawn y). The sprite (20 x 26,
# anchor 10 from the left) covers plane x at(x) - 10 .. + 20; its stair window (parts_l1a.waver_bay) sits under it at
# the plane row y - 40 (the sprite's top + 1.5, rounded up, measured from the game frames).
WAVERS = [(2016, 104), (2380, 92), (3110, 106)]
# the things on the fronts that one front's slot must hold whole: (what, plane x0, x1, the front's look or None)
def front_anchors():
    s = s_d(14)
    at = lambda x: 192 + (x - 192) * s
    out = [('waver %d' % x, at(x) - 10, at(x) + 10, None) for (x, _) in WAVERS]
    shop_of = {1980: 1987, 2110: 2139, 2230: 2253, 2296: 2297}
    out += [('awning %d' % x, at(x - 1), at(x + w + 1), shop_of[x]) for (x, _, w, _) in AWNINGS]
    out += [('hoist beam %d' % HOIST[0], at(HOIST[0]) - 1.5 * s, at(HOIST[0]) + 1.5 * s, 2499)]
    return out


def row_slots():
    """The fronts of every row on the plane of depth 14: [(row, look, left, width)], left on the 1/4 px grid."""
    out = []
    for r, (x0, fronts) in enumerate(ROWS):
        x = x0
        for (look, w) in fronts:
            out.append((r, look, x, w))
            x += w
    return out


def fit_numbers(slots):
    """(max overlap, max gap) of neighbouring fronts in a row, in logical px, at this tier's real pixels (the blit
       floors each left edge to the real grid; a front is w * U real px wide)."""
    ov, gap = 0.0, 0.0
    for a, b in zip(slots, slots[1:]):
        if a[0] != b[0]:
            continue
        d = (P(a[2]) + a[3] * U - P(b[2])) / U
        ov, gap = max(ov, d), max(gap, -d)
    return ov, gap


def anchor_fit(slots):
    """Each anchor whole inside one front's slot (the named one where given): [(what, look, margin left, right)]."""
    out = []
    for (what, a0, a1, want) in front_anchors():
        hit = [(look, a0 - l, l + w - a1) for (_, look, l, w) in slots if l <= a0 and a1 <= l + w]
        if not hit or (want is not None and hit[0][0] != want):
            out.append((what, None, None, None))
        else:
            out.append((what,) + hit[0])
    return out


def build():
    sec = Sec('a', 'Grachtengordel', 'morning')
    rng = random.Random(11)
    # ---- sky, skyline with the tower, the far bank of the main canal, its water
    S, CL = sky_layers(sec)
    SK = skyline_layer_a(sec, speed=0.10, yb=112, extra=skyline_extra, air=0.72)
    F, fb = canal_far_a(sec, rng, YH=110, YQ=115, YW=120, speed=0.5, boats=FAR_BOATS, air=FAR_AIR,
                        house=dict(sc=FAR_SC, wmin=30, wmax=46, nst=FAR_NST, storey=FAR_ST, shop_list=FAR_SHOPS))
    sec.notes['scale'] = sc_ = dict(far=fb, street=[], elms=[])
    canal_water(sec, [(S, 'tilex'), (CL, 'tilex'), (SK, 'stretch'), (F, 'copy')], F.w, YW=120, speed=0.5)
    # ---- bridges: the raised deck in depth slices, the back railings with bikes and lanterns, the near face and rail
    deck_neg = set()
    # bridge 2's far parapet carries two lanterns; a gull of the game perches on the right one (x 2730, its feet at
    # y 92 in the walk plane, drawn 5 px higher at the parapet's depth: the lantern's top at y 85)
    for b, bikes_, lamps_, lant in ((B1, [(744, 'red', False), (770, 'black', True), (842, 'blue', False)], True, ()),
                                    (B2, [(2635, 'green', False), (2684, 'black', True)], False, ((2630, GULL_B2_TOP), (2730, GULL_B2_TOP)))):
        for k in bridge_deck(sec, b):
            if k < 0:
                deck_neg.add(k)
        bridge_rail(sec, b, b['far'], False, bikes=bikes_, lamps=lamps_, seed=b['x0'], lanterns=lant)
        bridge_face(sec, b)
        bridge_rail(sec, b, b['near'], True, seed=b['x0'] + 1)
    # ---- the lift bridge over the side canal (up for the boats), its barriers and signals
    late_rows = lift_bridge(sec)
    late_rows += barriers(sec)
    # ---- the side walls at the ends of the house rows, then the house fronts (depth 14), FABEL FRIET, its sign
    # every front at its slot (ROWS): its left edge at the slot's, its width the slot's; the wavers' stair windows in
    # the front that holds them
    bodies = {}
    s14 = s_d(14)
    games = {int(d['x']): d for d in decor(sec, 'decor/ams/house-morning')}
    slots = row_slots()
    sec.notes['fronts'] = slots
    for (_, look, left, w) in slots:
        bays = [(int(round(192 + (wx - 192) * s14 - 10 - left)), wy - 40) for (wx, wy) in WAVERS
                if left <= 192 + (wx - 192) * s14 - 10 and 192 + (wx - 192) * s14 + 10 <= left + w]
        if look == 'fabel':
            hp, info = fabel_friet(random.Random(3309)), dict(storeys=[37, 37])
        elif look == 'neighbour':
            hp, info = neighbour(random.Random(3389))
        else:
            kw = dict(LINES.get(look, {}))
            if look in games:
                frame = games[look]['frame']
                kw.setdefault('n', nup(games[look]['box']['h'], frame))
            else:
                frame, kw['n'] = ROW_LOOKS[look]
            hp, info = street_house(random.Random(look), w, frame, SHOPS.get(look), seed=look, brick=BRICK.get(look),
                                    **kw)
            top = (GY - 14) - hp.h                                       # the plane row of the front's top
            for (bx_, by_) in bays:
                waver_bay(hp, info, (bx_, by_ - top), BRICK.get(look) or HOUSE_KIND[frame][1], look)
            bodies[look] = (info['hb'], info['gh'])
        assert hp.w == w, (look, hp.w, w)
        assert look not in ('fabel', 'neighbour') or not bays
        Lp, k = sec.plane(14)
        Lp.blit(hp, left, (GY - k) - hp.h)
        sec.shades.append((192 + (left + w / 2.0 - 192) / s14, k, w / 2.0, hp.h))
        sc_['street'] += info['storeys']
    # the side walls at the ends of the rows: as tall as the end houses
    for (ue, side, x, brick) in ((1903, -1, 1933, 'brick_black'), (2632, 1, 2601, 'brick_black'), (2803, -1, 2835, 'paint_cream')):
        hb, gh = bodies[x]
        side_wall(sec, ue, side, hb, int(gh * 0.6), brick)
    put_top(sec, fabel_sign(), 3346, 14, 20, 162 - (176 - 87) * s_d(14) - 1)
    # ---- the common decor of the game and its post rows
    for d in decor(sec, 'decor/ams/elm'):
        eh = int(round(scale_px(ELM_M, s_d(d['floorDepth']))))
        sec.put(elm2(rng, int(eh * 0.74), eh, seed=int(d['x']) + 3), d['x'], d['floorDepth'])
        sc_['elms'].append((d['x'], d['floorDepth'], eh))
        if d['x'] == 620:                       # the elm of the tree-bike secret: a bough carries the game's bike
            elm_bough(sec, d['x'], d['floorDepth'])
    standard_decor(sec, rng, skip=('decor/ams/elm',))
    # ---- the walk plane: houseboats, the moving boat at its spawn, breakables at their spawn, awnings, the balcony
    for i, b in enumerate(BOATS):
        put_top(sec, houseboat_front(b, b['col'], 20 + i), b['x0'], 0, 0, 132)
    # Entities of the game (docs/api/canal.md §7): painted here on the page; in a game bake they become the frames of
    # the game's sprites (the wrecks keep the game's art) and the scene leaves them out.
    # The moving boat (a platform; its top row at y 172 is the game frame's anchor row): both wake frames.
    if GAME:
        for ph in (0, 1):
            sec.notes.setdefault('game_sprites', []).append(
                (Sprite('decor/ams/ams-boat-platform', (ph,), tour_boat_platform(ph), ax=29, ay=0), walk_grade(sec, 0)))
    else:
        put_top(sec, tour_boat_platform(), 1090, 0, 29, 172)
    # The breakable racks (one picture per sprite id: the rack at 1460 shows the one at 690 in the game)
    entity(sec, 'decor/ams/ams-bike-rack', bike_rack(random.Random(690), w=50, nbikes=2), 690, 0)
    entity(sec, 'decor/ams/ams-bike-rack', bike_rack(random.Random(1460), w=50, nbikes=2), 1460, 0)
    entity(sec, 'decor/ams/ams-tulip-stall', tulip_stall(random.Random(2160)), 2160, 0)
    entity(sec, 'decor/ams/ams-herring-cart', herring_cart(random.Random(2470)), 2470, 0)
    for (x, y, w, col) in AWNINGS:
        put_top(sec, valance(w + 2, col), x - 1, 0, 0, y)
    bx, by, bw = BALCONY
    put_top(sec, balcony(bw + 2), bx - 1, 0, 0, by - 15)
    # the hoist secret of the game (a crate on a hook at (2500, 76), secrets.ts): a beam out of the ochre front at 2499
    hoist_rows = hoist_beam(sec, HOIST[0], HOIST[1])
    # ---- FABEL FRIET's counter (front decor, over the heroes)
    sec.put(fabel_counter(), 3330, 0, ax=15, front=True, shade=False)
    # ---- the floor and the planes
    floor_layer(sec, extra=floor_extra(sec))
    # the house fronts stand some metres back: a little air (before the key of the flush)
    # depth air on the floor: the planes behind the walk line and the floor's back rows take a little of the air
    for (k, front), Lp in sec.planes.items():
        if k > 0 and not front:
            Lp.recolor(grader(air=(sec.AIR[0], sec.AIR[1], depth_air(k), 0.30)))
    fl_ = next(l for l in sec.layers if l['id'] == 'floor')['frames'][0]
    for r0 in range(0, P(GY - BACKY)):
        d = GY - (BACKY + (r0 + 0.5) / U)
        if d > 0:
            band = Layer(fl_.w, 1.0 / U); band.a = fl_.a[r0:r0 + 1].copy()
            band.recolor(grader(air=(sec.AIR[0], sec.AIR[1], depth_air(d), 0.30)))
            fl_.a[r0:r0 + 1] = band.a
    sec.flush()
    # the deck slices in front of the walk line are under the heroes (they walk on the deck)
    neg = [l for l in sec.layers if l.get('depth') in deck_neg and not l.get('front')]
    for l in neg:
        sec.layers.remove(l)
        l['over'] = False
    first_over = next(i for i, l in enumerate(sec.layers) if l.get('over'))
    sec.layers[first_over:first_over] = neg
    # top faces: awnings (from the facades at 14 to the platform line) and the houseboats' decks and roofs
    for (x, y, w, col) in AWNINGS:
        ly = rows_top(sec, 176 - y, 14, [(x - 1, x + w + 1, awning_top(col))], 'awning%d' % x)
        insert_layer(sec, ly, 13.9)
    for ly in hoist_rows:
        insert_layer(sec, ly, 13.9)
    decks, roofs = [], []
    for b in BOATS:
        dk, rf = deck_top(b, b['roof'])
        decks.append((b['x0'], b['x0'] + b['w'], dk))
        roofs.append((b['cx'] - 1, b['cx'] + b['cw'] + 1, rf))
    insert_layer(sec, rows_top(sec, 12, 11, decks, 'boatdeck'), 0.01)
    insert_layer(sec, rows_top(sec, 30, 9, roofs, 'boatroof'), 0.01)
    # the lift bridge's portal, its footings' tops and the barrier arms: rows layers that lie along the depth
    for (ly, dep, over) in late_rows:
        place_rows(sec, ly, dep, over)
    return sec


def checks(sec):
    """The scale rule: one entry per building plane (measured from the storey heights painted) and the landmarks."""
    sc_ = sec.notes['scale']
    out = []

    def near(v, t, tol=0.15):
        return abs(v / t - 1) <= tol
    st = [x for i in sc_['far']['infos'] for x in i['storeys']]
    v = float(np.mean(st))
    out.append(('storey on far (s=0.50): %.1f px (%d-%d), target 20 ±15%%' % (v, min(st), max(st)), near(v, 20), '%.1f' % v))
    st = sc_['street']
    v = float(np.mean(st)); t = 40 * s_d(14)
    out.append(('storey on d14 (s=%.3f): %.1f px (%d-%d), target %.1f ±15%%' % (s_d(14), v, min(st), max(st), t), near(v, t), '%.1f' % v))
    v = 40 * 0.10
    out.append(('storey on skyline (s=0.10): %.1f px, target 4 ±15%%' % v, near(v, 4), '%.1f' % v))
    h = tower_h(); t = scale_px(TOWER_M, 0.10)
    out.append(('Westertoren %d m at s=0.10: %d px' % (TOWER_M, h), near(h, t, 0.05), h))
    out.append(('FABEL FRIET storeys at s=%.3f: 37 px (front 141 px, 12.4 m)' % s_d(14), near(37, 40 * s_d(14)), 37))
    hs = [t.h for (_, _, t) in sc_['far']['trees']]
    lo, hi = scale_px(14, 0.5), scale_px(18, 0.5)
    out.append(('far trees 14-18 m at s=0.50: %d-%d px' % (min(hs), max(hs)), lo <= min(hs) and max(hs) <= hi, '%d-%d' % (min(hs), max(hs))))
    ok = all(scale_px(14, s_d(dp)) <= eh <= scale_px(18, s_d(dp)) for (_, dp, eh) in sc_['elms'])
    out.append(('quay elms %g m: %s px' % (ELM_M, ', '.join('%d (d%g)' % (eh, dp) for (_, dp, eh) in sc_['elms'])), ok, len(sc_['elms'])))
    sp = s_d(B1['far']); h = bridge_lamp_h(sp)
    out.append(('bridge %d lanterns %g m at s=%.3f: %d px' % (B1['x0'], BRIDGE_LAMP_M, sp, h), near(h, scale_px(BRIDGE_LAMP_M, sp), 0.05), h))
    sp = s_d(B2['far'])
    hb = float(hump(np.array([2730.0]), B2)[0])
    h = int(round((176 - B2['far']) - hb * sp - 0.4 - 16.0 * sp - 3 - GULL_B2_TOP))
    m_ = h / (13.0 * sp)
    out.append(('bridge %d parapet lanterns at s=%.3f: %d px (%.1f m, 4-6 m), top y %d (the gull)' % (B2['x0'], sp, h, m_, GULL_B2_TOP),
                4.0 <= m_ <= 6.0, h))
    # the lift bridge: the deck clears a jumping hero; the towers and the span at the scale rule
    lf = sec.fl['lift']
    yu = 176 - lf['deck_h'][0]
    out.append(('lift bridge deck underside at depth 0: y %d (<= 62)' % yu, yu <= 62, yu))
    span_m = (lf['deck'][1] - lf['deck'][0]) / 13.0
    tow_m = (lf['sheave'][0] + lf['sheave'][1]) / 13.0
    out.append(('lift bridge span %.0f m, towers %.1f m to the sheaves, lift %.1f m' % (span_m, tow_m, lf['deck_h'][0] / 13.0),
                20 <= span_m <= 32 and 11 <= tow_m <= 18, '%.0f / %.1f' % (span_m, tow_m)))
    # the house rows tile (HOUSE-FIT-BRIEF.md): from the slots the fronts were painted at (sec.notes['fronts']), on
    # this tier's real pixels; the far bank's row (house_row_a: x += w) tiles by construction and is measured too
    slots = sec.notes['fronts']
    ov, gap = fit_numbers(slots)
    far = [(9, i['x'], i['x'], i['w']) for i in sc_['far']['infos']]
    ov_f, gap_f = fit_numbers(far)
    v = max(ov, ov_f)
    out.append(('house fronts tile: no front hides another (max overlap 0 px)', v == 0 and gap == 0 and gap_f == 0,
                '%g (gap %g; far bank %g / %g)' % (ov, gap, ov_f, gap_f)))
    af = anchor_fit(slots)
    bad = [a[0] for a in af if a[1] is None or min(a[2], a[3]) < 1.0]
    out.append(('wavers, awning backs, hoist beam whole in one front: %s' % ', '.join(
        '%s in %s (%.1f/%.1f)' % a if a[1] is not None else '%s: NONE' % a[0] for a in af), not bad, len(af) - len(bad)))
    return out


CAMS = (0, 610, 940, 1960, 1560, 2440, 3200)


if __name__ == '__main__':
    import time
    t0 = time.time()
    sec = build()
    t1 = time.time()
    # level.preview takes a hero frame per camera from 12 run frames (4 cameras); the same, for 7 cameras
    run, idle = hero_frames()
    os.makedirs('out', exist_ok=True)
    for i, cx in enumerate(CAMS):
        save(compose_level(sec, cx, 0, run[(i * 3) % len(run)]), f'out/l1a-{i}-u{U}.png', 1)
    save(compose_level(sec, CAMS[3], 0, run[0], overlay=True), f'out/l1a-layout-u{U}.png', 1)
    for i, cx in enumerate((610, 940, 2440, 3200)):
        save(compose_level(sec, cx, 0, run[0], overlay=True), f'out/l1a-layout{i + 1}-u{U}.png', 1)
    print('build %.1f s, previews %.1f s' % (t1 - t0, time.time() - t1))
