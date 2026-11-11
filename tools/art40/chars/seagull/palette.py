# The herring gull's palette (plan D1: at most 28 colours; the cast sample's colours) and its small
# hand-drawn parts: the beak and eye grids (turned with RotSprite by the drawer), the feet, the fries
# cone and the loose fries, the feather.
import castkit as K

PAL = {
    'K': '#140c0e',                                            # the one warm near-black outline
    '1': '#fdfcf6', '2': '#dfe3ea', '3': '#a9b2c4',            # white feathers (lit, base, shade)
    '4': '#cdd5e1', '5': '#a2adc0', '6': '#727d95',            # silver-grey mantle and wings
    '7': '#4b4d5c', '8': '#26252e',                            # black wing tips, the eye
    'Y': '#ffd43a', 'O': '#d99a1c', 'o': '#9c6214',            # beak (lit, shade, deep), the fries
    'R': '#d8322a', 'r': '#8e1e22',                            # gonys spot, the cone's red stripes
    'E': '#fff3a0',                                            # the pale yellow iris
    'P': '#f2a0a6', 'p': '#b8646e',                            # pink legs and feet
    'm': '#6e1e2c',                                            # the open mouth
    'B': '#e0a050', 'b': '#a2602a', 'n': '#5a2e1a',            # roasted (the burn death)
    # FX letters: the shared FX ramp (rules.json fxRamp), outside the budget
    'F': '#fffbd8', 'f': '#ffd040', 'c': '#ff8a24', 'e': '#e0401c', 'W': '#ffffff', 'y': '#ffe070',
    'D': '#7a6e70', 'd': '#4a4046', 'I': '#ffffff', 'i': '#bfe4ff',
}
FX_LETTERS = 'FfceWyDdIi'
HL = 'E81Y'                     # single pixels allowed: the eye, the mirror spots, a glint
DARK = {'1': '3', '2': '3', '3': '6', '4': '6', '5': '6', '6': '8', '7': '8', '8': '8',
        'Y': 'O', 'O': 'o', 'o': 'n', 'R': 'r', 'r': 'm', 'E': 'O', 'P': 'p', 'p': 'm', 'm': 'm',
        'B': 'b', 'b': 'n', 'n': 'n'}

WHITE = ['1', '1', '2', '3']
WING_TOP = ['4', '4', '5', '6']
WING_FAR = ['5', '5', '6', '6']
TIP_TOP = ['7', '8', '8', '8']
TIP_FAR = ['8', '8', '8', '8']
LEG = ['P', 'P', 'p', 'p']
LEG_FAR = ['p', 'p', 'p', 'p']
RAMPS = {
    'N': {'top': WING_TOP, 'under': ['2', '2', '3', '5'], 'tip': TIP_TOP},
    'F': {'top': WING_FAR, 'under': ['3', '3', '5', '6'], 'tip': ['7', '8', '8', '8']},
}
# soot (blast) and roast (burn): letter maps applied to a finished frame
SOOT = {'1': '6', '2': '6', '3': '7', '4': '7', '5': '7', '6': '8', '7': '8', 'Y': 'O', 'O': 'o',
        'R': 'r', 'P': 'p', 'E': '1'}
ROAST = {'1': 'B', '2': 'B', '3': 'b', '4': 'b', '5': 'b', '6': 'n', '7': 'n', '8': 'n', 'Y': 'O',
         'O': 'o', 'R': 'r', 'E': '1'}


def install():
    K.palette(PAL, dark=DARK)


# ------------------------------------------------------------------------------------ head grids
# Head-local grids: pivot (8, 8) = the head centre; facing right, level. The disc is drawn by the
# drawer (shaded tube); these grids add the beak and the eye on top of it.
PIV = (8, 8)
W, H = 21, 17

BEAKS = {
    # the closed beak: upper mandible, the gape line, the lower mandible with the red spot, the hook
    'shut': (["YYYYY..",
              "OYYYYYY",
              ".YYRYYo",
              "..oo..."], (11, 8)),
    # KAW: the upper mandible up, the mouth, the lower mandible down
    'open': (["YYYY...",
              "YYYYYYo",
              "mm.....",
              "YYR....",
              ".oo...."], (11, 7)),
    # the wide gape (the tell's KAW, the catch of the fry)
    'gape': (["YYY....",
              "YYYYYo.",
              "mm.....",
              "m......",
              "YYR....",
              ".YYo..."], (11, 6)),
    # the tucked beak (asleep): along the back, pointing backward, mostly under the scapulars
    'back': (["YYYY",
              ".oo."], (1, 8)),
    # seen from the front (the turn): the beak points at the viewer under the eyes
    'front': ([".YY.",
               "YYYY",
               ".oo."], (8, 9)),
}
BEAK_TIP = {'shut': (17.5, 9.5), 'open': (17.5, 8.5), 'gape': (16.5, 7.5), 'back': (1.0, 8.5), 'front': (9.5, 10.5)}

FACES = {
    'mean': [(-1, -3, '7'), (0, -3, '8'), (1, -2, '8'), (0, -1, 'E'), (1, -1, '8')],
    'wide': [(-1, -4, '7'), (0, -4, '7'), (0, -2, 'E'), (1, -2, 'E'), (0, -1, 'E'), (1, -1, '8')],
    'half': [(0, -2, '7'), (1, -2, '8'), (0, -1, 'E'), (1, -1, '8')],
    'shut': [(-1, -2, '6'), (0, -1, '7'), (1, -1, '7')],
    'x': [(-1, -3, '8'), (1, -3, '8'), (0, -2, '8'), (-1, -1, '8'), (1, -1, '8')],
    'happy': [(-1, -1, '8'), (0, -2, '8'), (1, -1, '8')],
    'front': [(-3, -2, '7'), (-3, -1, '8'), (1, -2, '7'), (1, -1, '8')],
    'soot': [(0, -2, '1'), (1, -2, '1'), (0, -1, '1'), (1, -1, '8')],
    'sootx': [(-1, -3, '1'), (1, -3, '1'), (0, -2, '1'), (-1, -1, '1'), (1, -1, '1')],
}
# the fry in the beak: one stick hanging from the beak tip (the chip steal, the gloat)
FRY = [(15, 10, 'Y'), (15, 11, 'Y'), (16, 12, 'Y'), (16, 13, 'O')]


def head_grid(face, beak, fry=False):
    g = [['.'] * W for _ in range(H)]
    rows, (x0, y0) = BEAKS[beak]
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch != '.':
                g[y0 + j][x0 + i] = ch
    for dx, dy, ch in FACES[face]:
        g[PIV[1] + dy][PIV[0] + dx + 1] = ch
    if fry:
        for x, y, ch in FRY:
            g[y][x] = ch
    return [''.join(r) for r in g], PIV


# ------------------------------------------------------------------------------------ feet
FEET = {
    # anchor = the ankle (where the leg tube ends)
    'flat': (["PPPP.",
              ".PpPP"], (1, 0)),
    'toe': (["PP.",
             ".PP",
             "..P"], (0, 0)),
    'curl': (["PP",
              ".p"], (0, 0)),
    'up': (["P.P.",
            "PPPP"], (1, 1)),
}

# ------------------------------------------------------------------------------------ props
# the stolen fries cone (red and white stripes, the fries sticking out): anchor = its foot centre
CONE = ["..Y.Y.",
        ".YOYYO",
        "YOYOYY",
        "R1R1R1",
        ".R1R1.",
        ".r1r1.",
        "..r1..",
        "..rr.."]
CONE_TIPPED = ["...Y..Y",
               ".YOYYO.",
               "YOYOYYR",
               "R1R1R1.",
               ".R1R1r.",
               ".r1r1..",
               "..rr..."]
# the hero's lost fries on the cobbles (the gloat): three loose sticks
GROUND_FRIES = [["YYO....YY.", "......O.YO"], ["YYO.......", "......O.YO"]]

FEATHER = [
    # 0: lying flat, then turning: (rows, anchor at the centre)
    (["...1123", "11222.."], (3, 1)),
]


# Flames, smoke and stars: copies of the kit's shared FX shapes (tools/art40/kit/ext_moves.py FX; that
# module recolours the digit letters this set uses, so it is not imported). Anchor = (x, y) in rows.
FX = {
  'fl0': ([
    "..e..",
    ".ec..",
    ".cfc.",
    "cfFfc",
    ".cfc.",
  ], (2, 4)),
  'fl1': ([
    "..e.....",
    "..ce..e.",
    ".ecfc.c.",
    ".cfFfcc.",
    "ecfFFfce",
    "cfFWWFfc",
    ".cfFFfc.",
    "..cffc..",
  ], (4, 7)),
  'fl2': ([
    "....e.....",
    "...ec...e.",
    "..ecf..ec.",
    "..cfFc.cf.",
    ".ecfFfcfc.",
    ".cfFWFfFce",
    "ecfFWWFFfc",
    "cfFWWWWFfc",
    "cfFWWWWFfc",
    ".cfFWWFfc.",
    "..ccffcc..",
  ], (5, 10)),
  'smk0': ([".dd.", "dDDd", ".dd."], (1, 2)),
  'smk1': (["..ddd..", ".dDDDd.", "dDDdDDd", ".dDDDd.", "..dd..."], (3, 4)),
  'smk2': (["...dd", "..dD.", ".dd..", "dD...", ".d..."], (1, 4)),
  'star': ([".y.", "yWy", ".y."], (1, 1)),
  }
