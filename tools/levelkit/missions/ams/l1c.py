# Section c of level 1: AMSTEL, golden late afternoon, in the canal look.
#
# Scene card
#   Place     the Amstel quays: an open quay street (0-600), the long canal with six houseboats (600-1400), the shop
#             quay with its house fronts (1400-2448; the scan-car arena 1984-2368 is only its street), the fork
#             (2400-2608): the white bridge's ramp up, the jetty steps down to the pontoon, the tour boat waiting.
#   Hour      golden late afternoon (HOURS['golden'] of mission.py, unchanged): warm light, violet-brown shade.
#   Key hue   warm gold; key and air as level.py; air amounts per plane in this file.
#   Set piece the long canal with its houseboats and chimney smoke; at the end the white bridge over the jetty basin.
#   Water     canal: far rows 120 -> 146 (one speed per row), the floor's water over the whole band 600-1400 and 2480 ->.
#   Planes    sky 0, clouds 0.03, skyline 0.10 (air 0.72), far 0.48 (air 0.26), water 0.48 -> 0.741, floor rows,
#             the depth planes (houses at 14, the bridge's far side at 9, the tour boat at 12.8, the walk plane, front).
#   Local     houseboats with plants and stove pipes, the little open boats, the herring cart, the flea-market stall,
#             KAAS / BLOEMEN / KOFFIE / BOEKEN / FIETSEN shop fronts, the route signs BRUG and RONDVAART, the pontoon.
#   Rules     posts on the kerbs only (the game's pole rows); no figures; every platform line on its art.
import itertools
import math
from parts_l1c import *
from game_sprites import sprites                   # noqa: F401  (the bake's hook: the entity paintings, game_entity)

NOTE = ("The Amstel quays in the golden hour: an open quay, the long canal with six houseboats and their stove "
        "smoke, the shop quay, and the fork where the white bridge rises over the jetty basin. "
        "The houseboats' decks and roofs, the ramp, the deck and the pontoon lie exactly on the game's platform lines; "
        "the deck, the ramp and the pontoon are painted depth by depth, so they scroll as the floor does.")

SPEED_F = 0.48
# the fidelity cameras of the game bake (bake_game.py): (camera x, the logical screen x the tier-2 / tier-4 crops centre
# on). The first and the last screen, the quay head and its lamp, the canal and its houseboats, the shop quay, the
# scan-car arena, the fork (the ramp, the deck, the jetty steps and the pontoon).
GAME_CAMS = [(0, 192), (330, 196), (560, 250), (900, 200), (1240, 160), (1500, 180), (1800, 220), (2000, 140),
             (2120, 330), (2224, 300)]
AIR_F = 0.36
YH, YQ, YW = 110, 115, 120


def skyline_extra(SK):
    landmark_tower(SK, 132, 80, 0.10)
    SK.blit(dome_church(44, 54), 300, 112 - 54)
    landmark_tower(SK, 470, 62, 0.10)


# ---- the window wavers of the game (section-c.ts life(): ams-window-waver at x, feet y, drawn at the facade depth 14;
# the sprite is a whole window, 20 x 26 with its feet on the bottom row, opaque over columns 1-18). Each one must stand
# in a window of ONE house front, over one of its window columns (the row's slots are fitted around them, row_slots),
# and in the holding front the windows of that column that the waver's window would cut are taken out or shortened;
# the waver's window gets a stone lintel and a sill (waver_window). A waver window that crosses a floor line reads as
# the stair window of the house.
WAVERS = [(1560, 100), (1830, 92), (2090, 96)]
WAVER_D = 14.0
# ---- the house row of the shop quay TILES its plane (HOUSE-FIT-BRIEF.md): the game's 20 house boxes (x 1398..2439)
# stand Δx apart in the world but only Δx · s_d(14) = 0.88 Δx apart on the plane, so the fronts are not painted at the
# game's box widths. The row is laid out again on the plane from the first box's left edge to the last box's right
# edge, in the game's order (gable kinds, bricks, storeys and shops of HOUSE_SPEC): every front gets a slot of whole
# logical px (ROW_W: the HOUSE_SPEC width -> the slot width; the wide cornice fronts stay the widest, the narrow bell
# the narrowest), it is painted at exactly its slot width, and the next front starts where it ends. Nothing of a front
# lies outside its slot (house() clips to its own width), so no front hides another at any camera.
ROW_W = {60: 52, 56: 48, 52: 45, 48: 43, 44: 41, 40: 40}
ROW_MIN = 40


def plane_x(u, depth):
    return 192 + (u - 192) * s_d(depth)


def _columns(info):
    """The window columns of a front's storeys (centres in the front's px; the gable's and dormer's windows left out)."""
    return sorted(set(b[0] + b[2] / 2.0 for b in info['win'] if b[2] >= 8 and b[1] > info['gh']))


def _spread(base, total):
    """Whole widths for the fronts of one stretch of the row: proportional to base, summing to total, none under
       ROW_MIN (None when that cannot be)."""
    sb = float(sum(base))
    ex = [b * total / sb for b in base]
    ws = [int(math.floor(v)) for v in ex]
    for i in sorted(range(len(ws)), key=lambda i: (-(ex[i] - ws[i]), i))[:total - sum(ws)]:
        ws[i] += 1
    while min(ws) < ROW_MIN:
        hi = min(range(len(ws)), key=lambda i: (-ws[i], i))
        lo = min(range(len(ws)), key=lambda i: (ws[i], i))
        if ws[hi] - 1 < ROW_MIN:
            return None
        ws[hi] -= 1; ws[lo] += 1
    return ws


def row_slots(sec):
    """The slots of the shop quay's fronts on the plane of depth 14: [(game house, left edge, width)], whole px, tiling
       the row from the first game box's left edge to the last one's right edge. Each window waver pins one party
       line of the row: the left edge of the front that holds it 12 px left of the waver's centre (the front's left
       window column) or the right edge 12 px right of it (its right column); the stretches between the pins are
       spread over their fronts in proportion to ROW_W. Of all pinnings the one nearest to ROW_W wins (and every
       waver is checked against the real window columns of its front)."""
    hs = sorted(decor(sec, 'decor/ams/house-golden'), key=lambda d: d['x'])
    n = len(hs)
    x0 = int(round(plane_x(min(d['x'] - d['box']['ox'] for d in hs), 14.0)))
    x1 = int(round(plane_x(max(d['x'] - d['box']['ox'] + d['box']['w'] for d in hs), 14.0)))
    base = [ROW_W[HOUSE_SPEC[d['frame']][0]] for d in hs]
    be = [x0 + sum(base[:i]) * (x1 - x0) / float(sum(base)) for i in range(n + 1)]
    cols = {}

    def cols_of(i, w):
        if (i, w) not in cols:                                     # a trial front: its scale note is not kept
            d = hs[i]
            keep = {k: list(v) for k, v in SCALE.items()}
            cols[(i, w)] = _columns(golden_house(d['frame'], d['box']['h'], seed=int(d['x']), w=w)[1])
            SCALE.clear(); SCALE.update(keep)
        return cols[(i, w)]

    pws = [plane_x(wx, WAVER_D) for (wx, wy) in WAVERS]
    opts = []
    for pw in pws:
        o = []
        for off in (-12, 12):                                      # the left column of front i / the right one of front i - 1
            v = int(round(pw + off))
            o += [(i, v) for i in range(1, n) if abs(be[i] - v) <= 24]
        opts.append(o)
    best = None
    for combo in itertools.product(*opts):
        pins = [(0, x0)] + sorted(combo) + [(n, x1)]
        if any(b[0] <= a[0] or b[1] <= a[1] for a, b in zip(pins, pins[1:])):
            continue
        ws = []
        for (ia, va), (ib, vb) in zip(pins, pins[1:]):
            part = _spread(base[ia:ib], vb - va)
            if part is None:
                break
            ws += part
        if len(ws) != n:
            continue
        e = [x0]
        for w in ws:
            e.append(e[-1] + w)
        ok = True
        for pw in pws:
            j = max(i for i in range(n) if e[i] <= pw)
            hx = pw - e[j]
            cs = sorted(cols_of(j, ws[j]), key=lambda c: abs(c - hx))
            # over a column (1 px), inside the slot (2 px), and clear of the other columns' window frames (the waver's
            # window, hx +-10, must not cut a window of a neighbouring column: a 3-column front is too tight)
            if hx - 9 < 2 or hx + 9 > ws[j] - 2 or abs(cs[0] - hx) > 1.0 or any(abs(c - hx) < 16 for c in cs[1:]):
                ok = False
        if not ok:
            continue
        cost = sum((w - b) ** 2 for w, b in zip(ws, base))
        if best is None or cost < best[0]:
            best = (cost, ws, e)
    _, ws, e = best
    return [(hs[i], e[i], ws[i]) for i in range(n)]


def shop_fronts(sec):
    """The house fronts of the shop quay (depth 14): golden_house at its slot of the row (row_slots), each painted at
       exactly its slot's width, fitted around the window wavers."""
    s = s_d(14.0)
    placed = []
    for (d, p0, w) in row_slots(sec):
        fr = d['frame']
        H, info = golden_house(fr, d['box']['h'], seed=int(d['x']), w=w)
        assert H.w == w
        # the world x whose plane position puts the front's left edge on p0 (Sec.put: at(x, s) - H.w / 2)
        xw = 192 + (p0 + w / 2.0 - 192) / s
        placed.append(dict(x=d['x'], H=H, info=info, p0=p0, xw=xw, depth=d['floorDepth']))
    notes = []
    for (wx, wy) in WAVERS:
        pw = plane_x(wx, WAVER_D)
        hold = [h for h in placed if h['p0'] <= pw < h['p0'] + h['H'].w][0]
        hx = pw - hold['p0']
        r0 = (wy - WAVER_D - 26) - ((GY - hold['depth']) - hold['H'].h)
        cut = waver_window(hold['H'], hold['info'], hx, r0)
        cols = _columns(hold['info'])
        # the visible span of the holding front is its whole slot (the row tiles)
        notes.append(dict(x=wx, house=hold['x'], hx=hx, r0=r0, lo=0.0, hi=float(hold['H'].w), col=min(cols, key=lambda c: abs(c - hx)), cut=cut))
    sec.notes['wavers'] = notes
    row = []
    for h in placed:
        sec.put(h['H'], h['xw'], h['depth'])
        row.append((sec.at(h['xw'], s) - h['H'].w / 2.0, h['H'].w))       # the left edge and width as painted
    sec.notes['row'] = row


def waver_window(H, info, hx, r0):
    """Make room for a window waver in the house front H (house layer coordinates: the waver's opaque box is
       hx - 9 .. hx + 9, rows r0 .. r0 + 26): the upper windows of the column under it whose frames it would cut are taken
       out (most of the frame under the waver) or shortened (the part away from it stays), shutters of the other windows
       are painted again, the waver's window gets a lintel and a sill. Returns what was done, per window."""
    w, hb, gh = H.w, info['hb'], info['gh']
    B = R[info['brick']]; T = R['plaster']; G = R['glass']; S = R['stone']; D = R[info['doorc']]
    seed = info['seed']
    bare = Layer(w, H.h)
    brickfill(bare, 0, gh, w, hb, B, seed, streaks=True)
    shutters = info['brick'] not in ('green', 'stone') and random.Random(seed + 7).random() < 0.55
    yb = H.h
    ups = [b for b in info['win'] if b[3] >= 10 and b[1] > gh and (b[1] - 1) + (b[3] + 2) <= yb - info['gf'] + 2]
    kx0, kx1, ky0, ky1 = hx - 10, hx + 10, r0 - 4, r0 + 28
    out = []

    def sw_of(wdt):
        return max(2.5, min(4.0, wdt * 0.32))

    def restore(x, y, wdt, hgt):
        e = (sw_of(wdt) + 0.5 if shutters else 0) + 1.5
        c0, c1 = max(0, P(x - e)), min(H.a.shape[1], P(x + wdt + e + 1))
        r0_, r1_ = max(0, P(y - 3.5)), min(H.a.shape[0], P(y + hgt + 3))
        H.a[r0_:r1_, c0:c1] = bare.a[r0_:r1_, c0:c1]
        H.vl(0, gh, hb, B[5]); H.vl(w - 1, gh, hb, B[1]); H.vl(w - 2, gh, hb, B[2])     # the front's edges

    def dress(x, y, wdt, hgt):
        H.rect(x - 1.5, y - 3, wdt + 3, 2, S[5]); H.hl(x - 1.5, y - 3, wdt + 3, S[6]); H.hl(x - 1.5, y - 1, wdt + 3, B[1])
        H.rect(x + wdt / 2 - 1.5, y - 3.5, 3, 3.5, S[6]); H.vl(x + wdt / 2 + 1, y - 3, 3, S[3])

    def shutter(x, y, wdt, hgt):
        sw = sw_of(wdt)
        for sx, lit in ((x - sw - 0.5, True), (x + wdt + 0.5, False)):
            H.rect(sx, y, sw, hgt, D[3] if lit else D[2])
            for yy in np.arange(y + 1, y + hgt - 0.5, 1.5):
                H.hl(sx, yy, sw, D[1] if lit else D[0], t=TH)
            H.vl(sx, y, hgt, D[4] if lit else D[2], t=TH)
            H.hl(sx, y + hgt / 2, sw, D[4], t=TH)

    keep, redo = [], []
    for (gx, gy, gw, gh_) in ups:
        x, y, wdt, hgt = gx - 1, gy - 1, gw + 2, gh_ + 2
        if x + wdt <= kx0 or x >= kx1 or y + hgt <= ky0 or y >= ky1:
            keep.append((x, y, wdt, hgt))
            continue
        restore(x, y, wdt, hgt)
        ov = min(y + hgt, ky1) - max(y, ky0)
        if ov >= 0.5 * hgt:
            out.append(('out', x, y, wdt, hgt))
            continue
        if y >= r0:                                         # below the waver: keep its lower part
            ny = ky1 + 4
            nh = y + hgt - ny
        else:                                               # above: keep its upper part
            ny = y
            nh = ky0 - 1 - y
        if nh < 8:
            out.append(('out', x, y, wdt, hgt))
            continue
        ny, nh = int(round(ny)), int(round(nh))                 # whole rows (window() counts its rows at tier 1)
        out.append(('short', x, ny, wdt, nh))
        redo.append((x, ny, wdt, nh))
    rng = random.Random(seed + 99)
    for (x, y, wdt, hgt) in redo:
        window(H, x, y, wdt, hgt, T, G, rng, B)
        dress(x, y, wdt, hgt)
    if shutters:
        for (x, y, wdt, hgt) in keep + redo:
            shutter(x, y, wdt, hgt)
    # the waver's window: a stone lintel over it, a stone sill under its flower box
    dress(hx - 9, r0, 18, 26)
    H.rect(hx - 10, r0 + 26, 20, 1.5, S[4]); H.hl(hx - 10, r0 + 26, 20, S[6]); H.hl(hx - 10, r0 + 27.5, 20, B[1])
    return out


def build():
    sec = Sec('c', 'Amstel', 'golden')
    reset_scale()
    rng = random.Random(23)
    S, CL = sky_layers(sec, cloud_boxes=CLOUDS_G, seed=7)
    golden_wisps(sec, CL)
    SK = skyline_m(sec, 0.10, yb=112, extra=skyline_extra, seed=31, air=0.72)
    # the far bank at the scenery scale of its speed (storey 40 s = 19 px, elms 14-17 m, boats at real length)
    boats = [('sloop', 60, (37, 'blue')), ('house', 140, (104, 'green')), ('sloop', 330, (37, 'red')), ('barge', 470, (150,)),
             ('house', 700, (112, 'white')), ('sloop', 880, (37, 'black')), ('tour', 1000, (140,)), ('house', 1220, (100, 'wood')),
             ('sloop', 1400, (36, 'green'))]
    F = canal_far_m(sec, rng, YH=YH, YQ=YQ, YW=YW, speed=SPEED_F, boats=boats, nfs=(2, 3, 3),
                    trees=dict(leaf='leaf_amber', hm=(14.0, 17.0), step=(130, 190)), air=AIR_F, seed=140)
    water_rows(sec, [(S, 'tilex'), (CL, 'tilex'), (SK, 'stretch'), (F, 'copy')], F.w, YW, SPEED_F, k=2.4, ncol=28, seed=9)

    # ---- the near planes: surfaces first (decks, ramp, pontoon), then the decor that stands on them
    deck = planks_across(3.4, 131, rail=(2.5, 6.5), edge_far=9.0)
    surfaces(sec, [
        dict(u0=2400, u1=2460, dn=-0.5, df=9.0, h=lambda u: 8 + 16 * (u - 2400) / 60.0, col=deck),
        dict(u0=2460, u1=2640, dn=-0.5, df=9.0, h=lambda u: 24.0 + 0 * u, col=deck),
        dict(u0=2480, u1=2640, dn=-0.5, df=11.9, h=lambda u: -12.0 + 0 * u, col=pontoon_top()),
    ])
    rest = standard_decor(sec, rng, leaf='leaf_amber')

    # the houseboats of the canal (walk plane: decks y 164, roofs y 146) with their stove pipes under the smoke
    smoke_x = {round(d['x']) for d in decor(sec, 'decor/ams/smoke')}
    BOATS = [(636, 80, 650, 52, 1), (752, 92, 770, 56, 3), (880, 84, 892, 60, 0), (1000, 96, 1018, 60, 2), (1132, 80, 1144, 52, 1),
             (1248, 112, 1262, 72, 3)]
    for i, (x0, w, cx, cw, col) in enumerate(BOATS):
        sx = cx + cw - 7
        hb = houseboat_near(random.Random(300 + i), w, cx - x0 + 1, cw, col, chim=sx - x0 + 1 if sx in smoke_x else None, seed=300 + i)
        place(sec, hb, x0 - 1, 0, 139)
    # the little open boats (ams-boat-platform, gunwale y 172) at their spawn x
    # (entities that sail: in a game bake their paintings are the two wake frames of the sprite; the motor fits its
    # frame box, 2 px over the gunwale)
    for i, bx in enumerate((640, 1080)):
        sb = small_boat(random.Random(40 + i), 60, seed=40 + i, motor=2)
        game_entity(sec, 'decor/ams/ams-boat-platform', sb, lambda sb=sb, bx=bx, i=i: place(sec, sb, bx - 32, 0, 168, flip=(i == 1)),
                    frames=(i,), ax=32, ay=4)

    # the shop quay: house fronts at depth 14 (the fronts around the game's window wavers fitted, see WAVERS)
    shop_fronts(sec)
    # breakables at their spawn x, intact
    # (entities: in a game bake their paintings are frame 0 of the sprites, painted into the game's frame boxes)
    hc = herring_cart(rng, fit=True)
    game_entity(sec, 'decor/ams/ams-herring-cart', hc, lambda: sec.put(hc, 1520, 0))
    ms = market_stall(rng, 0, top=7)
    game_entity(sec, 'decor/ams/ams-market-stall', ms, lambda: sec.put(ms, 1700, 0))

    # ---- the fork
    # the ramp's near side (a white stringer with its lattice) and the deck's fascia, at the walk plane
    ramp_top = lambda x: 168 - 16 * (x - 2400) / 60.0 if x < 2460 else 152.0
    Lr = Layer(62, 26)
    Wt = R['white']
    for x in sub(0, 60):
        yt = ramp_top(2400 + x) - 151
        Lr.rect(x, yt, D1, 1, Wt[6]); Lr.rect(x, yt + 1, D1, 3, Wt[4]); Lr.rect(x, yt + 4, D1, 1, Wt[2])
        Lr.rect(x, yt + 5, D1, 25 - yt - 5, R['black'][2])
    for p0 in range(0, 60, 12):
        p1 = p0 + 12
        Lr.line(p0 + 0.5, ramp_top(2400 + p0) - 151 + 5, p1 - 0.5, 24.5, Wt[4], t=TH * 1.4)
        Lr.line(p1 - 0.5, ramp_top(2400 + p1) - 151 + 5, p0 + 0.5, 24.5, Wt[3], t=TH * 1.4)
        Lr.rect(p0, ramp_top(2400 + p0) - 151 + 4, 2, 25 - (ramp_top(2400 + p0) - 151 + 4), Wt[5])
    Lr.rect(0, 17, 2, 8, Wt[3]); Lr.hl(0, 24.5, 62, R['black'][0])
    place(sec, Lr, 2400, 0, 151)
    face, ymin = deck_face((2460, 2640), lambda x: 152.0, yw=166, piers=False, face=5)
    place(sec, face, 2460, 0, ymin)
    # the far side of the bridge (railing, edge beam, arched girders, piers) and its gallows, at depth 9
    # its first pier stands on the upper jetty step (6 px under the quay, at depth 9): row 28 is y 152 at depth 9
    foot0 = 28 + ((GY - 9.0) + 6.0 * s_d(9.0)) - ((GY - 9.0) - (GY - 152) * s_d(9.0))
    far = bridge_far_side(200, 28, 37, pier=64, foot0=foot0)
    place_a(sec, far, 2459, 9.0, 28, 152)
    rr = white_rail(60, drop=16 * s_d(9.0), h=12)
    place_a(sec, rr, 2400, 9.0, rr.h - 2, 168)
    place_a(sec, white_portal(), 2564 - 36, 9.0, 120, 152)
    # the route signs
    for d in decor(sec, 'decor/ams/route-sign'):                      # x and depth from street_c.py
        word, up, w = ('BRUG', True, 43) if d['frame'] == 0 else ('RONDVAART', False, 73)
        sec.put(route_sign(word, up, w), d['x'], d['floorDepth'])
    # the pontoon (front face; its deck is a surface) and the tour boat moored along its far side
    place(sec, pontoon_front(128), 2480, 0, 188)
    cbt = cruise_boat(rng, 198, 50, 38)
    # its hull under the pontoon's far edge (screen row 174.8 at depth 12) is always behind the pontoon's top; left of
    # the pontoon (the stern) it would be drawn over the jetty's lower tread, which lies in the floor rows and drifts
    # from the planes at the cameras before the last: the mirror showed as water at the joint. Cut away.
    cbt.a[P(35.5):] = 0
    place_a(sec, cbt, 2486 - 1, 12.78, 38, 192)

    floor_layer(sec, extra=c_floor_extra(sec), water_fn=lambda u, d, v: floor_water_g(sec, u, d, v))
    flush_l1(sec)
    sun_band(sec, 'd14', lambda x: 104 + 7 * np.sin(x / 61.0) + 3 * np.sin(x / 17.0))
    return sec


def checks(sec):
    """The rules of this place: the houseboats' decks and roofs and the fork's walk surfaces sit on the game's lines."""
    N = None
    for l in sec.layers:
        if l.get('depth') == 0 and not l.get('front'):
            N = l['img']
    out = []
    # the hull top (deck line 164) is the lit gunwale: art at y 164 under every deck, none above the roof line between
    bad = []
    for (x0, w) in ((636, 80), (752, 92), (880, 84), (1000, 96), (1132, 80), (1248, 112)):
        for x in range(x0 + 2, x0 + w - 2, 3):
            if N.a[P(164.2), P(x), 3] == 0:
                bad.append(x)
    out.append(('houseboat decks: the gunwale on y 164 (walk plane)', not bad, bad[:5] or 'ok'))
    # the window wavers: inside one front (2 px to its visible edges), over a window column (2 px), a window
    for n in sec.notes.get('wavers', []):
        ok = n['hx'] - 9 >= n['lo'] + 2 and n['hx'] + 9 <= n['hi'] - 2 and abs(n['col'] - n['hx']) <= 2.0
        out.append(('window waver %d in house %d: x %.1f in %.1f..%.1f, column %.1f, %s' % (
            n['x'], n['house'], n['hx'], n['lo'], n['hi'], n['col'], ', '.join('%s %d..%d' % (c[0], c[2], c[2] + c[4]) for c in n['cut']) or 'no cut'),
            ok, round(n['hx'] - n['col'], 1)))
    # the house row tiles its plane: each front ends where the next begins (no overlap, no gap), from the painted edges
    row = sec.notes.get('row', [])
    ov = [round(row[i][0] + row[i][1] - row[i + 1][0], 3) for i in range(len(row) - 1)]
    out.append(('house fronts tile: no front hides another (max overlap 0 px)', bool(ov) and max(ov) <= 0 and min(ov) >= 0,
                '%d fronts, max overlap %g, max gap %g' % (len(row), max(0.0, max(ov + [0])), max(0.0, -min(ov + [0])))))
    # the scale rule (SCALE-BRIEF.md): every building plane and its scenery, the landmarks
    out += scale_checks([('skyline', 0.10, 'skyline'), ('far', SPEED_F, 'far'), ('d14', s_d(14.0), 'd14')])
    return out


if __name__ == '__main__':
    import time
    t0 = time.time()
    sec = build()
    print('build %.1f s' % (time.time() - t0))
    preview_l1(sec, cams=(0, 470, 860, 1220, 1560, 1984, 2224), layouts=(860, 2224))
