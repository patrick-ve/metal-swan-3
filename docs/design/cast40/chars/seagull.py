# The herring gull enemy: a dive-peck, beak first, wings half folded up and back.
# Drawn facing right (cast.py mirrors it: in the game it dives at the hero from the right).
import math
import castkit as K
import importlib
import ext_ride_swan as SW

SWAN = importlib.import_module('chars.swan')     # shared helper: despeckle()

INFO = dict(
    name='SEAGULL', mission=['ams'], role='enemy', kind='CREATURE', face=-1,
    pose='the dive-peck: beak first, wings half folded up and back, feet tucked',
    note='white head and body, silver-grey wings with black tips and white spots, yellow beak with '
         'a red spot, a frowning yellow eye, pink feet tucked; bigger than life so it reads and can be hit',
    old='enemy/seagull/attack#0', air=24)

PAL = {
    '1': '#fdfcf6', '2': '#dfe3ea', '3': '#a9b2c4',            # white feathers
    '4': '#cdd5e1', '5': '#a2adc0', '6': '#727d95',            # silver-grey mantle and wings
    '7': '#4b4d5c', '8': '#26252e',                            # black wing tips
    'Y': '#ffd43a', 'O': '#d99a1c', 'R': '#d8322a',            # beak, gonys spot
    'E': '#fff3a0',                                            # pale yellow iris
    'P': '#f2a0a6', 'p': '#b8646e',                            # pink feet
}
DARK = {'1': '3', '2': '3', '3': '6', '4': '6', '5': '6', '6': '8', '7': '8', '8': '8',
        'Y': 'O', 'O': 'R', 'R': 'R', 'E': 'O', 'P': 'p', 'p': 'p'}

CUT = (0.55, 0.12, -0.25)


def poly(cv, pts, ramp, z, part, R=3.0, cut=CUT, lift=0.0):
    """Directional-lit polygon (light from the upper front), like the Swan rig's plates."""
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    lx, ly, lz = K.rig.LIGHT3
    for y in range(int(math.floor(min(ys))), int(math.ceil(max(ys))) + 1):
        for x in range(int(math.floor(min(xs))), int(math.ceil(max(xs))) + 1):
            if not SW.inside(pts, x + 0.5, y + 0.5):
                continue
            d, (nx, ny) = SW.edge_info(pts, x + 0.5, y + 0.5)
            k = max(0.0, 1 - d / R)
            nx, ny = nx * k, ny * k
            nz = math.sqrt(max(0.0, 1 - nx * nx - ny * ny))
            l = nx * lx + ny * ly + nz * lz + lift
            t = 0 if l > cut[0] else 1 if l > cut[1] else 2 if l > cut[2] else 3
            cv.px(x, y, ramp[t], z, part, proc=True)


def put(cv, x0, y0, text, z, part):
    cv.grid(x0, y0, K.grid(text), z, part)


def dots(cv, pts, ch, z, part):
    for x, y in pts:
        cv.px(x, y, ch, z, part)


def wing(cv, dx, dy, ramp, tipramp, z, part):
    T = lambda pts: [(x + dx, y + dy) for x, y in pts]
    poly(cv, T([(17, 13), (14.5, 7), (12.5, 3.5), (8, 1.5), (1.5, 0.2), (0.5, 1.8), (5, 4.5), (8, 8.5), (10.5, 12), (13, 14.5)]),
         ramp, z, part, R=2.5)
    poly(cv, T([(9, 1.6), (1.5, 0.2), (0.5, 1.8), (5, 4.5), (8.5, 5.5)]), tipramp, z + 0.1, part, R=1.5)


def frame():
    K.palette(PAL, dark=DARK)
    cv = K.Canvas(52, 36)
    o = (4, 4)
    wing(cv, o[0] + 3, o[1] - 2, ['5', '5', '6', '6'], ['7', '8', '8', '8'], 1.0, 'wingF')
    # tail: a short white fan, higher than the head (the dive)
    poly(cv, [(o[0] + 2, o[1] + 8), (o[0] + 8, o[1] + 9), (o[0] + 9, o[1] + 13), (o[0] + 3, o[1] + 12)], ['1', '2', '2', '3'], 1.5, 'tail', R=2)
    cv.tube((o[0] + 8, o[1] + 11.5), (o[0] + 19, o[1] + 16.5), 3.4, 4.6, ['1', '1', '2', '3'], 2.0, 'body', cut=CUT)
    put(cv, o[0] + 19, o[1] + 11, """
        ...1111..
        .1111111.
        111111111
        111881111
        1111E8111
        211111112
        .2211112.
        ..2222...
    """, 2.2, 'head')
    wing(cv, o[0], o[1], ['4', '4', '5', '6'], ['7', '7', '8', '8'], 3.0, 'wingN')
    # the coverts' edge (a feather line along the wing) and the white trailing edge
    dots(cv, [(o[0] + x, o[1] + y) for x, y in ((13, 12), (12, 11), (12, 10), (11, 9), (11, 8), (10, 7), (9, 6))], '5', 3.4, 'wingN')
    dots(cv, [(o[0] + x, o[1] + y) for x, y in ((8, 7), (9, 8), (9, 9), (10, 10), (11, 11))], '2', 3.4, 'wingN')
    dots(cv, [(o[0] + 3, o[1] + 1), (o[0] + 5, o[1] + 2)], '1', 3.5, 'wingN')
    dots(cv, [(o[0] + 6, o[1] - 1), (o[0] + 8, o[1] - 0)], '2', 1.5, 'wingF')
    put(cv, o[0] + 26, o[1] + 16, """
        YYYY...
        YYYYYY.
        OOYRYYO
        ..OOO.O
    """, 3.2, 'beak')
    put(cv, o[0] + 11, o[1] + 20, """
        PPp
        .pp
    """, 1.8, 'feet')
    rows, root = K.finish(cv, (o[0] + 17, o[1] + 25))
    return SWAN.despeckle(rows, '123456'), root
