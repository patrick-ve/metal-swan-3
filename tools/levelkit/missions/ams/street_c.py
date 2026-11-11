# The street of section c (AMSTEL): the corrections of the section's painter after street.py's rules.
# street.py calls fix(L, fl) after its own rules. Art only: terrain, platforms, hitbox objects and spawns keep their
# numbers. The extra keys of the floor layout (thresholds, copings, steps) are read by c_floor_extra (parts_l1c.py);
# the game's layout files take the same numbers when the art is ported.
#
#   thresholds  [u, lane side]: a granite band across the whole band at u (on the side away from the lane), white
#               shark teeth on the lane side (they point at the riders who give way). lane side -1: the lane lies at
#               u < u_line; +1: at u > u_line; 0: no lane (a band only).
#   copings     [u0, u1, water side, ...]: the granite coping of a quay edge on the land side of the water, across the whole band.
#   steps       the jetty steps of the fork: two treads 6 and 12 px under the quay, from the stair's back wall at depth
#               `far` to the front of the screen (the lower tread meets the pontoon and the basin at u1).
THRESHOLDS = [
    (470, -1),        # the lane ends at the quay-head square (470-600)
    (2368, 0),        # the shop quay's cobbles end at the fork square (2368-2608)
]
COPINGS = [         # [u0, u1, water side (+1: the water lies at u >= u1, -1: at u < u0), (depth min, depth max)]
    (596, 600, 1),            # the quay-head square at the canal (water from 600)
    (1400, 1404, -1),         # the shop quay at the canal's end (water up to 1400)
    (2476, 2480, 1, 12.0, 27.0),   # the fork square at the jetty basin, behind the stair well
]
STEPS = dict(u0=2448, mid=2464, u1=2480, far=12.0, h=(6.0, 12.0))    # the game's ground: 2448 -> y 182, 2464 -> y 188
SIGNS = {2368: (2356, 10.0)}   # route sign BRUG: off the joint of the cobbles and the fork square, onto the far pavement
RACK_CLEAR = 38                # no Amsterdammertje of the near kerb behind a decor bike rack (half its width + 4)
FLAG_CLEAR = 6                 # no Amsterdammertje of the far kerb right in front of a flag pole


def fix(L, fl):
    fl['thresholds'] = [list(t) for t in THRESHOLDS]
    fl['copings'] = [list(c) for c in COPINGS]
    fl['steps'] = dict(STEPS)
    for d in L['decor']:
        if d['sprite'] == 'decor/ams/route-sign' and d['x'] in SIGNS:
            d['x'], d['floorDepth'] = SIGNS[d['x']]
    racks = [d['x'] for d in L['decor'] if d['sprite'] == 'decor/ams/bike-rack' and (d['floorDepth'] or 0) < 0]
    flags = [d['x'] for d in L['decor'] if d['sprite'].startswith('decor/ams/flag') and d['floorDepth'] is not None]
    for r in L['floor']['rows'] or []:
        if r.get('prop') == 'ams/pole' and r['depth'] < 0:
            r['at'] = [x for x in r['at'] if not any(abs(x - rx) <= RACK_CLEAR for rx in racks)]
        elif r.get('prop') == 'ams/pole':
            r['at'] = [x for x in r['at'] if not any(abs(x - fx) < FLAG_CLEAR for fx in flags)]
