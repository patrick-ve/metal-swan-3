# Section a (GRACHTENGORDEL): the corrections of the straight street (street.py calls fix(L, fl) after its own rules).
#
# The side canal (water 1060-1340) gets a lift bridge (hefbrug) in place of the drawbridge: one steel lattice tower on
# each bank, the deck hanging high between them. The towers' columns stand on the pavements in line with the deck's
# main girders (LIFT['girders']); the street runs to a steel threshold at each quay edge; before each bank a stop line,
# shark teeth and half barriers from both kerbs (the middle of the street stays open for the hero).
# East of the canal the bridge approach is a short kerbed lane (1348-1432); the PLEINTJE square starts at 1432.
# Everything here is art: terrain, platforms, hitbox objects, spawns and scripts keep their numbers.

STREET = [(-10 ** 9, 'lane'), (720, 'deck'), (880, 'lane'), (1340, 'lane'), (1432, 'fan'), (1904, 'cobbles'),
          (2600, 'deck'), (2760, 'lane'), (3190, 'klinkers')]
SQUARES = [(1432, 1904), (3190, 3584)]          # the Pleintje; the little square of FABEL FRIET
BAYS = [(658, 716)]                              # the breakable bike rack at 690 (its art spans 665-715)
BIKES = {'every': 276, 'phase': 88}              # the lane's bike symbols: clear of thresholds, stop zones and the bay

# The lift bridge. Towers: column centres x (the canal side of the west column is 1028, of the east one 1372);
# each column is 16 wide and 3 deep; its centre plane carries the deck girder, the sheave, the cables and the
# counterweight (on the land side of the column). Heights in world px over the street (scaled by the plane's speed).
LIFT = dict(
    water=(1060, 1340),
    towers=(1019, 1381),                         # column centres (west, east): columns 1011-1027 and 1373-1389
    col_w=16, col_d=3.0,
    girders=(8.5, -20.0),                        # the far and the near column/girder planes (on the pavements)
    deck=(1027, 1373), deck_h=(116, 136),        # the deck's main girders: x span, underside (y 60 at depth 0), top chord
    col_top=140,                                 # the columns' cap
    portal=(140, 148),                           # the box portal over the street on the column tops
    sheave=(162, 12),                            # sheave centre height and radius (on a pedestal on the portal)
    weight=(10, 28, 8),                          # counterweight: bottom, top, width (down, squat: the deck is up)
)
THRESHOLDS = [                                   # straight thresholds across the street: (u0, u1, kind, depth range)
    (716, 720, 'granite', None), (880, 884, 'granite', None),          # bridge 1's deck
    (1052, 1060, 'steel', (-21.5, 10.0)), (1340, 1348, 'steel', (-21.5, 10.0)),   # the lift bridge's quay edges
    (1428, 1432, 'granite', None),                                       # lane -> Pleintje
    (1904, 1908, 'granite', 'square'),                                   # Pleintje -> shopping street (cobbles)
    (2596, 2600, 'granite', None), (2760, 2764, 'granite', None),      # bridge 2's deck
    (3186, 3190, 'granite', None),                                       # lane -> the FABEL FRIET square
]
STOPLINES = [(954.5, 'near'), (1420.0, 'far')]   # stop lines before the lift bridge (the half of the approaching lane)
TEETH = [(948.0, 954.0, 'near', -1),             # shark teeth: u0, u1, half, the way they point (-1 west, +1 east)
         (1421.5, 1427.5, 'far', 1),
         (1422.0, 1428.0, 'near', -1),           # riders leaving the lane give way to the square
         (3180.0, 3186.0, 'near', -1)]
BARRIERS = [(970, -1), (1412, 1)]                # half barriers (x, side: -1 west bank, +1 east bank)
NOPOSTS = [(944, 1066), (1334, 1440)]            # no Amsterdammertjes where the bridge's towers, barriers and stop zones are


def fix(L, fl):
    fl['street'] = [dict(u0=u, kind=k) for (u, k) in STREET]
    fl['squares'] = [list(s) for s in SQUARES]
    fl['bays'] = [list(b) for b in BAYS]
    fl['bikes'] = dict(BIKES)
    # the drawbridge's floor marks go (a hinge pit, a slanted stop line, a landing strip); the lift bridge's come in
    for k in ('hingePits', 'stops', 'landings'):
        fl.pop(k, None)
    fl['thresholds'] = [list(t) for t in THRESHOLDS]
    fl['stoplines'] = [list(s) for s in STOPLINES]
    fl['teeth'] = [list(t) for t in TEETH]
    fl['lift'] = dict(LIFT)
    fl['barriers'] = [list(b) for b in BARRIERS]
    # the lamp of the gull at 1360 is no longer on a square: kerbside, like the others
    for d in L['decor']:
        if d['sprite'] == 'decor/ams/lamp' and d['x'] == 1360:
            d['floorDepth'] = 7.5
        # the elm at 1712 stood on the quay coping's edge (depth 27): on the square, in its pit
        if d['sprite'] == 'decor/ams/elm' and d['x'] == 1712:
            d['floorDepth'] = 25.0
        # the tulip planter at 3204 stood behind the lamp at 3210 as if the lamp grew from it: against the house front
        if d['sprite'] == 'decor/ams/tulips' and d['x'] == 3204:
            d['floorDepth'] = 12.5
    # the drawbridge's gallows and the old barrier posts (one of them stood in the lane) go: the lift bridge replaces them
    rows = [r for r in (L['floor']['rows'] or []) if r.get('sprite') != 'decor/ams/drawbridge' and r.get('prop') != 'ams/barrier-post']
    for r in rows:
        if r.get('prop') == 'ams/pole':
            r['at'] = [x for x in r['at'] if not any(a <= x <= b for (a, b) in NOPOSTS)]
    L['floor']['rows'] = rows
