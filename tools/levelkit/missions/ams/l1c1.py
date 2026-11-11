# Section c1 of level 1: BRUG, golden late afternoon, in the canal look.
#
# Scene card
#   Place     the Amstel: the long white wooden bridge over the river (deck y 152 over 60-760, the ramp down to the quay
#             at 860), the quay, the Blauwbrug (1020-1220, a hump of 16) with its crowned lamp posts, the start of the
#             Waterlooplein market.
#   Hour      golden late afternoon (HOURS['golden'] of mission.py, unchanged).
#   Key hue   warm gold; key and air as level.py; air amounts per plane in this file.
#   Set piece the white bridge with its two gallows over the wide river; then the Blauwbrug.
#   Water     river: far rows 122 -> 146, the floor's water over 60-860 and under the Blauwbrug.
#   Planes    sky 0, clouds 0.03, skyline 0.10 (air 0.72), far 0.30 (air 0.30: the far bank of a wide river, mansions
#             at river scale), water 0.30 -> 0.741, floor rows, the depth planes (back railing 20.6, the deck and the hump
#             as depth slices, the walk plane, the tour boats at -6, the front railing and the Blauwbrug's front).
#   Local     the white lattice railings and gallows, the tour boats with glass roofs, the crowned Blauwbrug lamps,
#             the granite balustrade, the striped market awnings, the elm, the benches, the tulips, the city flags.
#   Rules     posts on the kerbs only (the game's pole rows); no figures; every platform and raised ground on its art.
from parts_l1c import *
from game_sprites import sprites                     # noqa: F401  (the bake's hook: the entity paintings, game_entity)

NOTE = ("The white wooden bridge over the wide Amstel in the golden hour, its two gallows, tour boats gliding under "
        "it, the mansions of the far bank; then the quay, the granite Blauwbrug with its crowned lamps and the first "
        "striped stalls of the Waterlooplein market. The deck, the ramps and the Blauwbrug's hump are painted depth by "
        "depth on the game's lines.")

SPEED_F = 0.30
YH, YQ, YW = 114, 117, 122
DECK_FAR = 21.0
# the fidelity cameras of the game bake (bake_game.py): (camera x, the logical screen x the tier-2 / tier-4 crops centre
# on). The first screen (the slope up), the gallows at 300 and 520, the ramp down, the bridgehead and the quay, the
# Blauwbrug and the market (the last screen).
GAME_CAMS = [(0, 120), (160, 150), (330, 200), (560, 240), (700, 200), (800, 260), (900, 130), (1004, 300)]


def skyline_extra(SK):
    landmark_tower(SK, 90, 82, 0.10)
    SK.blit(dome_church(44, 54), 250, 112 - 54)
    landmark_tower(SK, 420, 66, 0.10)


def deck_h(u):
    """The white bridge's height over the street: the slope up 0-60, the deck 60-760, the ramp down to 860, the foot
       of the ramp 860-900 (4 px over the lane)."""
    u = np.asarray(u, float)
    return np.select([u < 60, u < 760, u < 860, u < 900], [24.0 * u / 60.0, 24.0 + 0 * u, 24.0 - 20.0 * (u - 760) / 100.0, 4.0 * (900 - u) / 40.0], 0.0)


def build():
    sec = Sec('c1', 'Brug', 'golden')
    reset_scale()
    rng = random.Random(41)
    # level.floor_paint breaks on the street kind 'tiles' (a float index); the tiles lie under the river here, so
    # the floor reads them as clinkers (the river is painted over them by c1_floor_extra).
    sec.fl = dict(sec.fl, street=[dict(e, kind='klinkers' if e['kind'] == 'tiles' else e['kind']) for e in sec.fl['street']])
    S, CL = sky_layers(sec, cloud_boxes=CLOUDS_G, seed=7)
    golden_wisps(sec, CL)
    SK = skyline_m(sec, 0.10, yb=112, extra=skyline_extra, seed=37, air=0.72)
    # the far bank at the scenery scale of its speed (storey 40 s = 12 px; boats, elms, lamps, cars at 3.9 px per metre)
    F = amstel_far(sec, rng, YH, YQ, YW, SPEED_F, air=0.30, seed=3,
                   boats=[('house', 40, (68, 'green')), ('sloop', 150, (23, 'blue')), ('barge', 240, (96,)), ('tour', 420, (90,)),
                          ('house', 560, (64, 'white'))])
    water_rows(sec, [(S, 'tilex'), (CL, 'tilex'), (SK, 'stretch'), (F, 'copy')], F.w, YW, SPEED_F, k=2.6, ncol=28, seed=13)

    # ---- the near planes: surfaces first (the white bridge's deck and ramps, the Blauwbrug's hump)
    deck = planks_across(3.4, 133, rail=(4.5, 16.5), edge_far=DECK_FAR)
    surfaces(sec, [
        dict(u0=0, u1=860, dn=-0.5, df=DECK_FAR, h=deck_h, col=deck),
        dict(u0=860, u1=900, dn=-0.5, df=DECK_FAR, h=deck_h, col=deck),             # the deck's foot on the bridgehead
        dict(u0=1020, u1=1220, dn=-16.0, df=19.5, h=hump, col=bridge_street(141)),  # roadway and far pavement
    ])
    rest = standard_decor(sec, rng, leaf='leaf_gold')

    # the back railing (depth 20.6) on the deck and down the ramp
    rb = white_rail(700, 0, 12)
    place_a(sec, rb, 60, 20.6, rb.h - 2, 152)
    dr = 20 * s_d(20.6)
    rr = white_rail(100, drop=dr, h=12, down=True)
    place_a(sec, rr, 760, 20.6, rr.h - 2 - dr, 152)
    # the railings up the slope from the street (0-60), as down the ramp at the other end (the street pass)
    du = 24 * s_d(20.6)
    ru = white_rail(60, drop=du, h=12)
    place_a(sec, ru, 0, 20.6, ru.h - 2, 176)
    # the gallows: the far frames (20.6) and the near frames (walk plane, the heroes walk under them)
    for gx in (300, 520):
        place_a(sec, white_portal(), gx - 36, 20.6, 120, 152)
        place_a(sec, white_portal(near=True), gx - 36, 0, 120, 152)
    # the game's hoist secret hangs on the first near portal (secrets.ts c1: x 300, its rope's top = a hook at y 82):
    # a pulley block under the top beam and the hoist rope down to the hook
    hr = Layer(8, 36)
    I_ = R['iron']; Rp = R['wood']
    hr.rect(2, 0, 4, 4, I_[2]); hr.hl(2, 0, 4, I_[4]); hr.vl(5, 0, 4, I_[1]); hr.px(3.5, 1.5, I_[5])   # the block
    for yy in np.arange(4, 34.5, 1.0):                                                                   # the rope
        hr.rect(3.5, yy, 1, 1, Rp[4] if int(yy) % 2 == 0 else Rp[3])
    hr.rect(3, 33, 2, 1.5, I_[3]); hr.px(3, 34.5, I_[2])                                                 # the hook
    place(sec, hr, 300 - 4, 0, 48)
    # the deck's near face (fascia, the shaded underside, the piers to the water) and the slope's abutment
    # (the river reaches under the slope up to the west quay wall at W0: the slope stands on its abutment up to there,
    # then on the timber deck's fascia over the water, as the deck does)
    W0 = sec.fl.get('river_west', 60)
    face, ymin = deck_face((W0, 860), lambda x: 176 - float(deck_h(x)), yw=182, pier=64, face=6, x_off=-28)
    place(sec, face, W0, 0, ymin)
    place(sec, bridge_mirror(60, 760, 158.0, 182.0, 64, x_off=-28), 60, 0, 182.0)
    ab = Layer(62, 28)
    BRk = R['brick_brown']; St = R['stone']
    for x in sub(0, W0 + 1):
        yt = 24 - 24 * x / 60.0 + 1
        brickfill(ab, x, yt + 2, D1, 27 - yt - 2, BRk, 221, lo=1, hi=4, mid=2)
        ab.rect(x, yt, D1, 2, St[5]); ab.rect(x, yt, D1, 0.5, St[6])
    if W0 < 60:                                     # the abutment's end: a stone quoin down to the water
        yq = 24 - 24 * W0 / 60.0 + 1
        ab.rect(W0 - 1.5, yq, 2.5, 27 - yq, St[4]); ab.vl(W0 - 1.5, yq, 27 - yq, St[6]); ab.vl(W0 + 0.5, yq, 27 - yq, St[2])
        for yy in np.arange(yq + 3, 27, 4):
            ab.hl(W0 - 1.5, yy, 2.5, St[2], t=TH)
    ab.hl(0, 27, W0 + 1 if W0 < 60 else 62, R['black'][0])
    place(sec, ab, 0, 0, 152 - 1)
    # the near face of the deck's foot (860-900, 4 px over the bridgehead at 860, flush at 900): the white fascia
    ft = Layer(42, 6)
    Wt = R['white']
    for x in sub(0, 40):
        hh = float(deck_h(860 + x))
        if hh <= 0.2:
            continue
        ft.rect(x, 5 - hh, D1, hh, Wt[4] if hh > 1.2 else Wt[5]); ft.rect(x, 5 - hh, D1, min(0.6, hh), Wt[6])
        ft.rect(x, 4.6, D1, 0.4, Wt[2])
    place(sec, ft, 860, 0, 176.5 - 5)
    # the front railing (over the heroes, as the game's front decor) on the deck and down the ramp
    rf = white_rail(700, 0, 12)
    place_a(sec, rf, 60, 0, rf.h - 2, 152 + 0.0, front=True)
    rf2 = white_rail(100, drop=20, h=12, down=True)
    place_a(sec, rf2, 760, 0, rf2.h - 2 - 20, 152, front=True)
    rf0 = white_rail(60, drop=24, h=12)
    place_a(sec, rf0, 0, 0, rf0.h - 2, 176, front=True)
    # the tour boats on the river at their spawn x (entities at the water line y 182, in front of the deck); the
    # first is moved 20 px right so that its stern clears the west quay (spawn x 100 would put it over the pavement)
    # (entities that sail: in a game bake their paintings are the two wake frames of npc/ams/ams-tour-boat, its water
    # line on the frame's anchor row; the wake fits the frame box)
    def blit_boat(tb, bx, flip):
        Lp, k = sec.plane(-6.0)
        Lp.blit(tb.flip() if flip else tb, sec.at(bx - 58, s_d(k)), 182 - 28)
    for i, bx in enumerate((120, 420)):
        tb = tour_boat_near(random.Random(60 + i), 116, seed=60 + i, wake=3)
        game_entity(sec, 'npc/ams/ams-tour-boat', tb, lambda tb=tb, bx=bx, i=i: blit_boat(tb, bx, i == 1), frames=(i,), ax=58, ay=28)

    # ---- the Blauwbrug
    # back balustrade (19.5) on the hump, lamps (21.1) at its ends, the flag on the crown
    band_along(sec, 1016, 1224, 19.5, hump, 10.0, stone_parapet(181, 10.0, piers=(1020, 1070, 1120, 1170, 1220)))
    # the lamps 6 m tall at the scale of their depth (back 21.1, front -16)
    hb_ = ri(6.0 * ppm(s_d(21.0))); hf_ = ri(6.0 * ppm(s_d(-16.0)))
    note_landmark('Blauwbrug lamp (back, depth 21)', 6, s_d(21.0), hb_)
    note_landmark('Blauwbrug lamp (front, depth -16)', 6, s_d(-16.0), hf_)
    for lx in (1026, 1214):
        sec.put(blauwbrug_lamp(hb_), lx, 21.1)
    fl = flag_pole('ams', FLAG_H, phase=1.3)
    place_a(sec, fl, 1120 - 1, 19.5, fl.h, 160)
    # front: the face from the road edge to the water, the balustrade, the lamps (all over the heroes)
    band_along(sec, 1020, 1220, -16.0, hump, 0.0, blauwbrug_face(191, 206.0), front=True, below=50.0)
    band_along(sec, 1016, 1224, -16.0, hump, 11.0, stone_parapet(183, 11.0, piers=(1020, 1070, 1120, 1170, 1220)), front=True)
    kf = hf_ / 86.0
    for lx in (1032, 1208):
        place_a(sec, blauwbrug_lamp(hf_), lx - 11.5 * kf, -16.0, hf_ - 9 * kf, 176 - float(hump(lx)), front=True)

    # ---- Waterlooplein: the market stalls with striped awnings
    for d in decor(sec, 'decor/ams/market-stall'):                    # x and depth from street_c1.py
        fr = d['frame']
        sec.put(market_stall(random.Random((1290, 1232, 1352)[fr]), fr), d['x'], d['floorDepth'])

    floor_layer(sec, extra=c1_floor_extra(sec), water_fn=lambda u, d, v: floor_water_g(sec, u, d, v))
    flush_l1(sec)
    return sec


def checks(sec):
    """The rules of this place: the gallows' posts stand on the deck; the deck's near edge is on y 152."""
    N = None
    for l in sec.layers:
        if l.get('depth') == 0 and not l.get('front'):
            N = l['img']
    bad = [x for x in range(64, 756, 4) if N.a[P(152.2), P(x), 3] == 0]
    out = [('white bridge: the deck edge on y 152 over 60-760 (walk plane)', not bad, bad[:5] or 'ok')]
    # the scale rule (SCALE-BRIEF.md): every building plane and its scenery, the landmarks
    out += scale_checks([('skyline', 0.10, 'skyline'), ('far', SPEED_F, 'far')])
    return out


if __name__ == '__main__':
    import time
    t0 = time.time()
    sec = build()
    print('build %.1f s' % (time.time() - t0))
    preview_l1(sec, cams=(0, 200, 420, 640, 860, 1004), layouts=(200, 860))
