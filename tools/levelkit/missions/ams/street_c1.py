# The street of section c1 (BRUG): the corrections of the section's painter after street.py's rules.
# street.py calls fix(L, fl) after its own rules. Art only: terrain, platforms, hitbox objects and spawns keep their
# numbers. The extra keys of the floor layout (thresholds, copings, bridgehead) are read by c1_floor_extra
# (parts_l1c.py); the game's layout files take the same numbers when the art is ported.
#
# The white bridge's deck (depth 21.5 .. -2.1) is not the street's width (5 .. -16.3): it lands on a small granite
# bridgehead square (860-900, the deck's foot ramp lies on it), and the lane starts at the square's edge at 900 with
# a threshold. The lane ends at 1004 with a threshold before the Blauwbrug's cobbled bridgehead (1004-1020).
# The Blauwbrug's deck (19.5 .. -16) stays wider than the street: its far pavement runs over the bridge (granite
# slabs behind the far kerb at depth 5), its parapets start at the bridge's square corners (1016 and 1224).
INF = 10 ** 9
STREET = [(-INF, 'klinkers'), (60, 'tiles'), (860, 'cobbles')]      # lead: no lane on the 100 px between the two bridges (a stub); one cobbled quay
SQUARES = [(860, 900)]                                 # the white bridge's granite bridgehead
THRESHOLDS = []                                        # no lane, so no lane thresholds
COPINGS = [(860, 864, -1)]                             # the quay edge at the river (water up to 860)
BRIDGEHEAD = (860, 900)                                # painted in granite setts (the Blauwbrug's stone)
RIVER_WEST = 36                # the west quay wall: the river reaches under the slope up to the bridge (60 -> 36), so the
                               # script's first tour boat (range from x 100, its stern at x 42) floats on water there
MOVE = {                                               # decor: (sprite, x) -> (x, depth)
    ('decor/ams/lamp', 18): (18, 24.0),                # behind the white bridge's slope (it stood inside the ramp)
    ('decor/ams/elm', 880): (880, 25.0),               # off the quay coping (27) onto the bridgehead
    ('decor/ams/flag-nl', 1350): (1350, 25.0),         # off the quay coping (27)
    ('decor/ams/market-stall', 1232): (1252, 22.0),    # off the Blauwbrug's end pier and abutment, onto the pavement
    ('decor/ams/bike-rack', 912): (940, -22.0),        # off the joint of the bridgehead and the near pavement
}
RACK_CLEAR = 38                                        # no Amsterdammertje of the near kerb behind a decor bike rack
FLAG_CLEAR = 6                 # no Amsterdammertje of the far kerb right in front of a flag pole


def fix(L, fl):
    fl['street'] = [dict(u0=u, kind=k) for (u, k) in STREET]
    fl['squares'] = [list(s) for s in SQUARES]
    fl['thresholds'] = [list(t) for t in THRESHOLDS]
    fl['copings'] = [list(c) for c in COPINGS]
    fl['bridgehead'] = list(BRIDGEHEAD)
    fl['river_west'] = RIVER_WEST
    for d in L['decor']:
        k = (d['sprite'], d['x'])
        if k in MOVE:
            d['x'], d['floorDepth'] = MOVE[k]
    racks = [d['x'] for d in L['decor'] if d['sprite'] == 'decor/ams/bike-rack' and (d['floorDepth'] or 0) < 0]
    flags = [d['x'] for d in L['decor'] if d['sprite'].startswith('decor/ams/flag') and d['floorDepth'] is not None]
    for r in L['floor']['rows'] or []:
        if r.get('prop') != 'ams/pole':
            continue
        r['at'] = [x for x in r['at'] if not any(a - 6 <= x <= b + 6 for (a, b) in SQUARES) and not RIVER_WEST - 6 <= x <= 60]
        if r['depth'] < 0:
            r['at'] = [x for x in r['at'] if not any(abs(x - rx) <= RACK_CLEAR for rx in racks)]
        else:
            r['at'] = [x for x in r['at'] if not any(abs(x - fx) < FLAG_CLEAR for fx in flags)]
