# Hand-drawn rigid parts for VINCENT at 1x, facing right, light from the upper front.
# No exterior outline here: the composer draws one outline around each sprite.
# Anchors: 'neck' (head bottom / torso top), 'pelvis', 'shN'/'shF' (near/far shoulder),
# 'wrist' (where a forearm ends), 'ankle', 'muzzle' (first pixel past the barrel), 'c' (item centre).
import math

# ---------------------------------------------------------------- heads (14 x 13, neck at (5, 12))
_HEAD = [
  "....hhHHHh....",
  "..hhHAHHAAAH..",
  ".hhAHHHAAHAAH.",
  "hhHHAHHHAHASL.",
  "hHhHHHAHHsSLL.",
  "hhhHhHHHsSQQL.",
  "QhhHHHsSSSwQS.",
  "QhhHszsSSSSSSL",
  ".QhHszsSSSSsSs",
  ".QhbsSSbBBBBs.",
  "..QbbSbbBwwwB.",
  "...bbbbbbBBBb.",
  "....zBBBBBB...",
]

def _edit(rows, changes):
    out = [list(r) for r in rows]
    for y, x, s in changes:
        for i, ch in enumerate(s):
            out[y][x + i] = ch
    return [''.join(r) for r in out]

HEADS = {
 'fwd': (_HEAD, {'neck': (5, 12)}),
 'blink': (_edit(_HEAD, [(6, 10, 'zz')]), {'neck': (5, 12)}),
 'shout': (_edit(_HEAD, [(5, 9, 'QQQ'), (6, 9, 'SwQ'), (10, 8, 'BwwwB'), (11, 8, 'BQQQB'), (12, 5, 'BBBBBBB')]), {'neck': (5, 12)}),
 'hurt': (_edit(_HEAD, [(5, 9, 'sQQ'), (6, 9, 'zzzS'), (10, 8, 'BQQQB'), (11, 8, 'BwwwB')]), {'neck': (5, 12)}),
 'up': ([
  "....hhHHHh....",
  "..hhHHHHAAAH..",
  ".hhHAHHHAAAASL",
  "hhHHHAHHHsSLQQ",
  "hhHHHHHHsSSwQS",
  "hhhHHHsSSSSSSL",
  "QhhHszsSSSSSSL",
  "QhhHszsSSSBBBs",
  "QhhbbsSSbBwwwB",
  ".QbbbbbbBBBBB.",
  ".QQbbbbbBBBb..",
  "..zzsszzz.....",
  "...zsszz......",
 ], {'neck': (5, 12)}),
 'down': ([
  "....hhHHHh....",
  "..hhHHHHAAAH..",
  ".hhHAHHHHAAAH.",
  "hhHHHAHHHHAAAH",
  "hhHHHHHHHHSLLL",
  "hhhHHHHHsSLLLL",
  "QhhHHHsSSQQQSS",
  "QhhHszsSSSQwSS",
  "QhhHszsSSSSSSL",
  ".QhbsSSSSSSSs.",
  ".QQbbbbBBBBs..",
  "..QbbbbBwwB...",
  "...zzBBBBB....",
 ], {'neck': (5, 12)}),
}
HEADS['read'] = (_edit(HEADS['down'][0], [(7, 10, 'wQ'), (11, 7, 'BBwwB')]), {'neck': (5, 12)})
HEADS['read2'] = (_edit(HEADS['down'][0], [(7, 10, 'Qw'), (11, 7, 'BBwwB')]), {'neck': (5, 12)})
HEADS['smug'] = (_edit(_HEAD, [(5, 10, 'QQ'), (4, 11, 'QL'), (6, 10, 'Qz'), (10, 8, 'BBwwB')]), {'neck': (5, 12)})

# ---------------------------------------------------------------- torsos (14 x 12)
# posture fix (user, 2026-11-03): a 12 px deep jacket with one straight back line and square shoulders;
# the head sits centred above it with a little neck (see the posture proposal page)
_TORSO = [
  ".qjjJJTRTJ..",
  "qjjjJJJTRTJ.",
  "qjjjJJJJTRJJ",
  "qjjjjJJJTRJJ",
  "qjjqjJJJJrJJ",
  "qjjqjjJJJJTJ",
  "qjjjqjjJJJJj",
  "qjjjqjjjJQJj",
  "qqjjjqjjjJjq",
  "Qqjjjjqjjjjq",
  ".QqqqqqqqqQ.",
]
_TORSO_ROUND = [
  "....qjJJJTRT..",
  "..qjJJJJJqTRT.",
  ".qjjJJJJJJqTRJ",
  "qjjjjJJJJJqTRJ",
  "qjjjjjJJJJJqrJ",
  "qjjqjjjJJJJqTJ",
  "qjjqjjjjJJJJqj",
  "qqjjqjjjjJJQJj",
  "qqqqqqjqjjjJjj",
  "Qqjjjjjjqjjjjq",
  ".QqqqqqqqqqqqQ",
]
_TAN = {'neck': (6, -2), 'pelvis': (6, 9), 'shN': (6.5, 2.5), 'shF': (3.5, 3.0)}
_TAN_ROUND = {'neck': (9, 0), 'pelvis': (7, 9), 'shN': (8, 2.5), 'shF': (4, 2.5)}

def shear(part, top):
    """Lean a part: row y moves right by round(top * (1 - y / (h - 1))) (negative leans back)."""
    rows, an = part
    h = len(rows)
    ks = [int(round(top * (1 - y / (h - 1)))) for y in range(h)]
    base = min(ks)
    w = max(len(r) for r in rows) + max(ks) - base
    out = [('.' * (k - base) + r).ljust(w, '.') for k, r in zip(ks, rows)]
    an2 = {name: (x + top * (1 - y / (h - 1)) - base, y) for name, (x, y) in an.items()}
    return out, an2

TORSOS = {'up': (_TORSO, _TAN)}
TORSOS['lean'] = shear(TORSOS['up'], 2)
TORSOS['lean2'] = shear(TORSOS['up'], 3)
TORSOS['back'] = shear(TORSOS['up'], -2)

# ---------------------------------------------------------------- shoes (black)
SHOES = {
 'flat': ([
  "xxxx....",
  "xxxXXx..",
  "xxxxxXXx",
  "vvvvvvvv",
 ], {'ankle': (2, 0)}),
 'toe': ([
  "xxx....",
  "xxxX...",
  "xxxxXx.",
  ".vxxxXx",
  "..vvvvv",
 ], {'ankle': (1, 0)}),
 'hang': ([
  "xxx..",
  "xxxX.",
  "xxxXx",
  ".xxxX",
  "..vvx",
 ], {'ankle': (1, 0)}),
 'heel': ([
  "......Xv",
  "xxxx.XXv",
  "xxxxXXxv",
  "vvvvvv..",
 ], {'ankle': (2, 1)}),
 'back': ([
  ".xxx",
  "xxXx",
  "xxXx",
  "xxxv",
  "xxv.",
  "vv..",
 ], {'ankle': (2, 0)}),
 'lie': ([       # sole facing the viewer's left, toes up (lying on the back)
  "x...",
  "xX..",
  "xXx.",
  "xxXv",
  "vxxv",
  "vvv.",
 ], {'ankle': (2, 4)}),
}

# ---------------------------------------------------------------- hand + pistol per aim
GUNS = {
 'fwd': ([
  "..ngGGGGGGg.",
  "TSSngnnnnnnN",
  "TSSSNNnN....",
  ".sssNN......",
 ], {'wrist': (0, 1.5), 'muzzle': (12, 1)}),
 'low': ([
  "..gGg.......",
  "TSSnGGg.....",
  "TSSSNnGGg...",
  ".sssNNnnGGg.",
  ".......nnnN.",
 ], {'wrist': (0, 1.5), 'muzzle': (11, 4)}),
 'up': ([
  ".gg.",
  ".Gn.",
  ".Gn.",
  ".Gn.",
  "SGnN",
  "SSSN",
  "SSsN",
  ".ss.",
  ".TT.",
 ], {'wrist': (1.5, 8.5), 'muzzle': (1.5, -1)}),
 'down': ([
  ".TT.",
  ".SS.",
  "SSSN",
  "SSsN",
  "sGnN",
  ".Gn.",
  ".Gn.",
  ".Gn.",
  ".nN.",
 ], {'wrist': (1.5, -0.5), 'muzzle': (1.5, 9)}),
 'dup': ([
  "......gn",
  ".....gGN",
  "....gGn.",
  "...gGn..",
  ".SSGn...",
  "SSSSN...",
  "TSsN....",
  "T.s.....",
 ], {'wrist': (0, 6.5), 'muzzle': (8, -1)}),
 'ddown': ([
  "T.......",
  "TSS.....",
  "SSSSN...",
  ".sSGn...",
  "...gGn..",
  "....gGn.",
  ".....gGN",
  "......nN",
 ], {'wrist': (0, 1), 'muzzle': (8, 8)}),
}

FISTS = {
 'fist': ([
  "TSS",
  "TSs",
  ".ss",
 ], {'wrist': (0, 1)}),
 'fistup': ([
  "SS.",
  "SSs",
  "Ss.",
  "TT.",
 ], {'wrist': (0.5, 3.5)}),
}

HANDS = {
 'open': ([
  "TSSSS",
  "TSSSs",
  ".sss.",
 ], {'wrist': (0, 1)}),
 'grenade': ([
  ".uMM.",
  "uMMMG",
  "TSSS.",
  "TSSs.",
  ".ss..",
 ], {'wrist': (0, 3)}),
 'knife': ([
  "TSS.......",
  "TSSNGGGGGG",
  ".ssNgggggi",
 ], {'wrist': (0, 1), 'tip': (10, 1)}),
 'knifeup': ([
  ".G.",
  "Gg.",
  "Gg.",
  "Gg.",
  "Gg.",
  "NNN",
  "SSS",
  "SSs",
  ".T.",
 ], {'wrist': (1, 8.5), 'tip': (0.5, -1)}),
 'knifedown': ([
  ".T.",
  "SSS",
  "SSs",
  "NNN",
  "gG.",
  "gG.",
  "gG.",
  "gG.",
  ".i.",
 ], {'wrist': (1, -0.5), 'tip': (1, 9)}),
 'paper': ([
  ".TT..",
  "STTt.",
  "SSTt.",
  ".ss..",
 ], {'wrist': (0, 2)}),
 'plan': ([
  "TTTTTTT",
  "TRtRtTt",
  "TtTtRtt",
  "TTtTTtT",
  "STTTTTt",
  "SS.....",
  ".s.....",
 ], {'wrist': (0, 5.5)}),
 'inside': ([      # hand slipped inside the jacket: only the cuff shows
  "T",
  "T",
 ], {'wrist': (0, 0.5)}),
}

ITEMS = {
 'pistol': ([".gGGGGg", "nnnnnnN", "NN....."], {'c': (3, 1)}),
 'gren0': ([".MG.", "MMMu", "MMuu", ".uu."], {'c': (1.5, 1.5)}),
 'gren1': (["..M.", ".MMG", "MMuu", ".uu."], {'c': (1.5, 1.5)}),
 'gren2': ([".uu.", "uuMM", "uMMM", ".GM."], {'c': (1.5, 1.5)}),
 'gren3': ([".u..", "uuM.", "GMMM", ".MM."], {'c': (1.5, 1.5)}),
}

# ---------------------------------------------------------------- glowing effects (no outline)
def _transpose(rows, flip_v=False):
    h, w = len(rows), max(len(r) for r in rows)
    rr = [r.ljust(w, '.') for r in rows]
    out = [''.join(rr[y][x] for y in range(h)) for x in range(w)]
    return out[::-1] if flip_v else out

_F0 = ["..f....", "fFWFf..", "FWWWFFc", "fFWFf..", "..f...."]
_F1 = ["...c.....", ".fFfc.c..", "fFWWFfFc.", "FWWWWWFFc", "fFWWFfFc.", ".fFfc.c..", "...c....."]
_F2 = ["..c.", ".fFc", "cFWf", ".fFc", "..c."]
_SM = [".dD..", "dDDd.", ".dDd."]
FX = {
 'ff0': (_F1, (0, 3)), 'ff1': (_F0, (0, 2)), 'ff2': (_F2, (0, 2)), 'fsm': (_SM, (0, 1)),
 # up: transpose turns "to the right" into "downward"; flip makes it "upward" with the base at the bottom
 'fu0': (_transpose(_F1, True), (3, 8)), 'fu1': (_transpose(_F0, True), (2, 6)), 'fu2': (_transpose(_F2, True), (2, 3)),
 'fd0': (_transpose(_F1), (3, 0)), 'fd1': (_transpose(_F0), (2, 0)), 'fd2': (_transpose(_F2), (2, 0)),
 'fusm': (_transpose(_SM, True), (1, 4)),
 'stab': (["..I..", ".iIi.", "IIWII", ".iIi.", "..I.."], (2, 2)),
}

def arc(cx, cy, r0, r1, a0, a1, width=2.2):
    """A slash crescent: bright at the leading edge (a1), fading towards a0. Angles in degrees,
    0 = right, 90 = down. Returns (rows, anchor) with the anchor at the circle centre."""
    pts = {}
    steps = 90
    for k in range(steps + 1):
        t = k / steps
        a = math.radians(a0 + (a1 - a0) * t)
        r = r0 + (r1 - r0) * t
        wdt = width * (0.35 + 0.65 * t)
        for dd in [i * 0.25 for i in range(int(wdt * 4) + 1)]:
            x, y = round(cx + (r - dd) * math.cos(a)), round(cy + (r - dd) * math.sin(a))
            ch = 'm' if t < 0.35 else 'i' if t < 0.75 or dd > wdt * 0.5 else 'I'
            old = pts.get((x, y))
            if old is None or 'mIi'.index(ch) > 'mIi'.index(old) or ch == 'I':
                pts[(x, y)] = ch
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    x0, y0 = min(xs), min(ys)
    w, h = max(xs) - x0 + 1, max(ys) - y0 + 1
    g = [['.'] * w for _ in range(h)]
    for (x, y), ch in pts.items():
        g[y - y0][x - x0] = ch
    return [''.join(r) for r in g], (cx - x0, cy - y0)

FX['slash0'] = arc(0, 0, 14, 15, -100, -40, 1.8)
FX['slash1'] = arc(0, 0, 15, 17, -100, 30, 3.4)
FX['slash2'] = arc(0, 0, 16, 17, -40, 60, 3.0)
FX['slash3'] = arc(0, 0, 16, 16, 15, 65, 1.6)
