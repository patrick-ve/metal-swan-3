# DIRK's hand-drawn parts at 1x (facing right, light from the upper front). Same conventions as
# parts.py: no exterior outline, anchors neck / pelvis / shN / shF / wrist / muzzle / tip / ankle / c.
# Letters: hair A H h Q, skin L S s z, stubble b B, w teeth, hi-vis vest J j q, reflective stripes
# G g (shared with the pistol), polo R r U (+ Q), plunger cup C E, wood handle A H, belt h H.
import parts as P

_edit = P._edit
NECK = {'neck': (5, 13)}

# ---------------------------------------------------------------- heads (14 x 14, neck at (5, 13))
_HEAD = [
  "..........A...",
  ".....A..AAA...",
  "...hhAHhAHA.A.",
  "..hHHHAHHAHAAA",
  ".hHHAHHHAHAAA.",
  "hhHHHHHHHSLLL.",
  "hhHhHHHSLLLLL.",
  "QhhHHsSSSLLLLS",
  "QhhHszSSShhhS.",
  "QhhHszsSSzQQSL",
  ".QhHsssssSSSSL",
  ".QhbsSSShHHHHH",
  "..QbbSbhhhhhzh",
  "..QbbbbbbbBBb.",
  "...zbbbbBBB...",
]

def _h(changes, base=None):
    return (_edit(base or _HEAD, changes), NECK)

HEADS = {
 'fwd': (_HEAD, NECK),
 'blink': _h([(9, 9, 'Szz')]),
 'shout': _h([(8, 9, 'Qhh'), (9, 9, 'SwQ'), (12, 10, 'QwwQ'), (13, 9, 'bQQQb')]),
 'hurt': _h([(7, 9, 'hhL'), (8, 9, 'SSS'), (9, 9, 'zzz'), (12, 10, 'BQQQ'), (13, 9, 'bwwwB')]),
 'smug': _h([(9, 9, 'zzz'), (12, 12, 'hz')]),
}

# ---------------------------------------------------------------- torso (14 x 13)
# hi-vis vest (yellow, two grey reflective bands, brace stripes) over the dark polo (collar at the
# neck, a strip at the open front); tool belt with a buckle; a leather pouch with a wrench at the
# back hip (cols 0..2). Stockier than VINCENT: one column wider.
_TORSO = [
  "...qjJrRRrJ...",
  "..qjjJJrRRJJ..",
  ".qgjjJJJgJJJJ.",
  ".qgjjJJJgJJJJj",
  ".qgjjjJJgJJJJj",
  ".qgjjjJJgJJJJj",
  ".qGgGGGGGGGGGg",
  ".qjjjjjJJJJJJj",
  "nqgggGGGGGGGGg",
  "GhQhHhHHHnGHhH",
  "HhhQQQQQQQQQQ.",
  "hHh...........",
  ".h............",
]
_TAN = {'neck': (7, -2), 'pelvis': (7, 9), 'shN': (7.5, 2.5), 'shF': (4.5, 3.0)}
TORSOS = {'up': (_TORSO, _TAN)}
TORSOS['lean'] = P.shear(TORSOS['up'], 2)
TORSOS['lean2'] = P.shear(TORSOS['up'], 3)
TORSOS['back'] = P.shear(TORSOS['up'], -2)

# ---------------------------------------------------------------- heavy work boots (brown leather)
SHOES = {
 'flat': ([
  "xxxx.....",
  "xxxXx....",
  "xxxxXXx..",
  "xxxxxxXXx",
  "vvvvvvvvv",
 ], {'ankle': (2, 1)}),
 'toe': ([
  "xxx.....",
  "xxxX....",
  "xxxxXx..",
  "vxxxxXx.",
  ".vvxxxXx",
  "...vvvvv",
 ], {'ankle': (1, 1)}),
 'hang': ([
  "xxx...",
  "xxxX..",
  "xxxXx.",
  "xxxxXx",
  ".vxxxX",
  "..vvvx",
 ], {'ankle': (1, 1)}),
 'heel': ([
  ".......Xv",
  "xxxx..XXv",
  "xxxxxXXxv",
  "xxxxxxxv.",
  "vvvvvvv..",
 ], {'ankle': (2, 2)}),
 'back': ([
  ".xxx",
  "xxXx",
  "xxXx",
  "xxXx",
  "xxxv",
  "xxv.",
  "vv..",
 ], {'ankle': (2, 1)}),
 'lie': ([
  "x....",
  "xX...",
  "xXx..",
  "xxXx.",
  "xxxXv",
  "vxxxv",
  "vvvv.",
 ], {'ankle': (2, 5)}),
}


def _cuff(lib, keep=()):
    """VINCENT's white shirt cuff 'T' becomes DIRK's polo cuff 'R'."""
    return {k: ([r.replace('T', 'R') for r in rows], an) for k, (rows, an) in lib.items() if k not in keep}

GUNS = _cuff(P.GUNS)
FISTS = _cuff(P.FISTS)
HANDS = _cuff({k: P.HANDS[k] for k in ('open', 'grenade', 'inside')})


def _turn(rows, deg, pad=2):
    """Tilt a head around its neck with RotSprite on a padded grid, then crop back to the content."""
    from rig import rotsprite
    w = max(len(r) for r in rows) + 2 * pad
    g = ['.' * w] * pad + ['.' * pad + r.ljust(w - 2 * pad, '.') + '.' * pad for r in rows] + ['.' * w] * pad
    out = rotsprite(g, (pad + 5, pad + len(rows) - 1), deg)
    ys = [y for y, r in enumerate(out) if r.strip('.')]
    xs = [x for r in out for x, c in enumerate(r) if c != '.']
    x0, y0 = min(xs), min(ys)
    return [r[x0:max(xs) + 1] for r in out[y0:max(ys) + 1]], {'neck': (pad + 5 - x0, pad + len(rows) - 1 - y0)}

# up / down: started from _turn(_HEAD, +18 / -16), then cleaned by hand
HEADS['up'] = ([
  ".......A.......",
  "......AAA......",
  "....h.AHA.AA...",
  "...hHhAHHAAA...",
  "..hHAAHHHAAL...",
  ".hHHHHHASLLL...",
  ".hHAHHHHLLLLS..",
  "hhHHHHSSLLhhS..",
  "hhHhHsSSSSQzSL.",
  "hhHHszSSSSSSSL.",
  "QhhHszsssSSSHHH",
  "QhhhbsssShHHwwQ",
  ".QhbbsSShhhQQQ.",
  "..QbbbSbbbbBB..",
  "...QbbbbbBB....",
  "....zbbbb......",
], {'neck': (5, 15)})
HEADS['down'] = ([
  "....hhA...AAA.",
  "..hhHHAAhAAA..",
  ".hhHHAHAHHHA.A",
  "hhHHHHHHHHHHAA",
  "QhHhHHHHHHAAAA",
  "QhhHHHSSLLLLL.",
  "QhhHszSSLLLLL.",
  "QhHszsSSShhhL.",
  "QhHszssSSzQQS.",
  ".QbssSsssSSSSL",
  ".QbbSShhHHHHH.",
  "..bbbbhhhhzh..",
  "..QbbbbbBBB...",
  "....zbBBBb....",
], {'neck': (5, 13)})

# ---------------------------------------------------------------- the plunger (its own hand parts)
# wooden handle (A H) and a dark red rubber cup (C E); the bell opens away from the hand.
# 'tip' = the centre of the cup's rim. Swap these entries to give DIRK another melee tool.
PLUNGER = {
 'pl_up': ([
  "ECCCE",
  "CCCCE",
  ".CCE.",
  "..A..",
  "..A..",
  "..H..",
  "..A..",
  ".SAS.",
  ".SSs.",
  "..R..",
 ], {'wrist': (2, 9), 'tip': (2, -1)}),
 'pl_fwd': ([
  ".........CE",
  "RSS.....CCE",
  "RSSAAAAHCCE",
  ".ss.....CEE",
  ".........EE",
 ], {'wrist': (0, 2), 'tip': (11, 2)}),
 'pl_down': ([
  "..R..",
  ".SSS.",
  ".SSs.",
  "..A..",
  "..A..",
  "..H..",
  "..A..",
  ".CCE.",
  "CCCCE",
  "EEEEE",
 ], {'wrist': (2, -0.5), 'tip': (2, 10)}),
 # stuck on: the cup squashed flat against the target
 'pl_sq': ([
  "........CE",
  ".......CCE",
  "RSS....CCE",
  "RSSAAAAHCE",
  ".ss....CEE",
  ".......CEE",
  "........EE",
 ], {'wrist': (0, 3), 'tip': (10, 3)}),
}


def _rot(name, deg, pad=4):
    """A diagonal plunger from a straight one (RotSprite around the wrist)."""
    from rig import rotsprite
    rows, an = PLUNGER[name]
    w = max(len(r) for r in rows)
    n = w + len(rows) + 2 * pad
    g = ['.' * n for _ in range(n)]
    ox, oy = n // 2 - int(an['wrist'][0]), n // 2 - int(an['wrist'][1])
    g = [list(r) for r in g]
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            g[oy + y][ox + x] = ch
    g = [''.join(r) for r in g]
    piv = (ox + an['wrist'][0], oy + an['wrist'][1])
    out = rotsprite(g, piv, deg)
    ys = [y for y, r in enumerate(out) if r.strip('.')]
    xs = [x for r in out for x, c in enumerate(r) if c != '.']
    x0, y0 = min(xs), min(ys)
    a = math.radians(deg)
    def mv(p):
        dx, dy = p[0] - an['wrist'][0], p[1] - an['wrist'][1]
        return (piv[0] + dx * math.cos(a) + dy * math.sin(a) - x0, piv[1] - dx * math.sin(a) + dy * math.cos(a) - y0)
    return [r[x0:max(xs) + 1] for r in out[y0:max(ys) + 1]], {k: mv(v) for k, v in an.items()}

import math
PLUNGER['pl_back'] = _rot('pl_up', 40)       # wind-up: the cup up and behind the head
PLUNGER['pl_dup'] = _rot('pl_fwd', 45)       # swinging over: cup up and forward
PLUNGER['pl_ddn'] = _rot('pl_fwd', -45)      # the smack: cup down and forward
HANDS.update(PLUNGER)

# fidget hands: two fingers along the mustache; a grip on the belt
HANDS['stroke'] = ([
  ".SSS",
  "SSs.",
  "Rs..",
 ], {'wrist': (0, 2)})
HANDS['belt'] = ([
  "RSS",
  "RSs",
  ".hh",
 ], {'wrist': (0, 1)})

# ---------------------------------------------------------------- effects
FX = {
 'plop0': ([
  "i..I..i",
  ".i.I.i.",
  "..iWi..",
  "IIWWWII",
  "..iWi..",
  ".i.I.i.",
  "i..I..i",
 ], (3, 3)),
 'plop1': ([
  ".m...m.",
  "m.....m",
  "...i...",
  "..iWi..",
  "...i...",
  "m.....m",
  ".m...m.",
 ], (3, 3)),
 'plop2': ([
  "m.....m",
  ".......",
  ".......",
  "...m...",
  ".......",
  ".......",
  "m.....m",
 ], (3, 3)),
}
