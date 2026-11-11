# The street of section b (MUSEUMPLEIN): the lane through the passage, the tiled square, the gravel path of the
# Museumplein between two straight lawns, a paved corner, the canal road with the river in front of it.
# Called by street.apply after the lead's rules: fix(L, fl). parts_l1b.floor_extra paints from the same numbers.
#
# Along u (the street kinds; the kerbs stay at FAR 5 / NEAR -16.3 wherever there is a kerb):
#   lane     u < SQ0                the red lane from the section's start through the passage (400-720); it ends at a
#                                   granite threshold (THR px) with shark teeth on the lane side (TEETH px)
#   tiles    SQ0 .. PATH0           the tiled square: big pale slabs over the whole depth, no kerbs (the elm's lawn,
#                                   the tulip stall, the hot-dog trailer, the grey lamps, the cabinet stand on it)
#   gravel   PATH0 .. PATH1         the gravel path between the kerbs; behind the far kerb top the back lawn, in front
#                                   of the near kerb top the front lawn (both straight; no bulb at the hostages
#                                   1420 / 1760: they stand on the gravel); the lawn chains on the front lawn
#   pave     PATH1 .. LANE1         the paved corner of the canal road: grey tiles over the whole depth, no kerbs
#   lane     u >= LANE1             the canal road: a granite threshold and shark teeth at its start, the herring cart's
#                                   bay; in front the near pavement, the granite setts strip, the quay coping, the
#                                   quay wall and the river (from CANAL0)
# The lawn areas (u, depth):
#   the elm's lawn   794 .. 848, 7.4 .. 13      (stone edging, on the square)
#   back lawn        PATH0 .. PATH1, from the far kerb's top (LAWN_BACK) to the floor's back edge
#   front lawn       PATH0 .. PATH1, from the near kerb's top (LAWN_FRONT) to the lower screen edge
#   cross paths      (1206, 1226), (1880, 1900): gravel from the back edge down to the far kerb (they come from the
#                    far zone's paths, parts_l1b.lawn_rows, which paints them on with the same u)
INF = 10 ** 9
FAR, NEAR = 5.0, -16.3
SQ0, PATH0, PATH1, LANE1 = 784, 1116, 2164, 2196
THR, TEETH = 3.0, 7.0                  # the granite threshold's width and the teeth zone's length (world px)
LAWN_BACK, LAWN_FRONT = 6.6, -17.6     # the lawn edges: on the far and near kerb tops (level.py: top 5 .. 6.6, -16.3 .. -17.6)
CROSS = [(1206, 1226), (1880, 1900)]
CANAL0 = LANE1                         # the river in front of the canal road starts here (the quay end)
CHAIN_D, CHAIN_U0, CHAIN_U1, CHAIN_SP = -19.5, 1128, 2152, 34      # the lawn chains: on the front lawn, unbroken
RACKS = [(250, 34), (2400, 34), (2860, 34)]                          # decor bike racks (x, half width) on the near pavement
BIKES = dict(every=220, phase=80)     # the lane's bike symbols: none in the herring cart's bay, the teeth or the passage mouth


def fix(L, fl):
    fl['street'] = [dict(u0=-INF, kind='lane'), dict(u0=SQ0, kind='tiles'), dict(u0=PATH0, kind='gravel'),
                    dict(u0=PATH1, kind='pave'), dict(u0=LANE1, kind='lane')]
    fl['squares'] = [[SQ0, PATH0], [PATH1, LANE1]]
    fl['bikes'] = dict(BIKES)
    fl['thresholds'] = [[SQ0, 1], [LANE1, -1]]             # (u, side of the lane: +1 the lane ends at u, -1 it starts)
    fl['canal_front'] = CANAL0
    keep = [a for a in fl['areas'] if a['kind'] == 'granite' and a['u0'] >= 2000]   # the quay coping (info)
    fl['areas'] = [
        dict(u0=794, u1=848, far=13, near=7.4, kind='grass', edge=1),
        dict(u0=PATH0, u1=PATH1, far=31, near=LAWN_BACK, kind='grass', edge=1.3),
        dict(u0=PATH0, u1=PATH1, far=LAWN_FRONT, near=-41, kind='grass', edge=1.3),
    ] + [dict(u0=a, u1=b, far=31, near=LAWN_BACK, kind='gravel') for (a, b) in CROSS] + [
        dict(u0=1240, u1=1740, far=26, near=13, kind='granite'),
    ] + [dict(a, u0=CANAL0) for a in keep]
    for r in L['floor']['rows'] or []:
        if r.get('name') == 'lawn chains':
            r.update(depth=CHAIN_D, u0=CHAIN_U0, u1=CHAIN_U1 + 1, spacing=CHAIN_SP, offset=0, gaps=[])
        elif r.get('prop') == 'ams/pole' and r['name'].startswith('front'):
            r['at'] = [x for x in r['at'] if not any(abs(x - rx) <= hw + 4 for (rx, hw) in RACKS) and not SQ0 - 12 <= x <= LANE1 + 12]
        elif r.get('prop') == 'ams/pole' and r['name'].startswith('back'):
            r['at'] = [x for x in r['at'] if not SQ0 - 12 <= x <= LANE1 + 12]
