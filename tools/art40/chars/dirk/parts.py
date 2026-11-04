# DIRK's own production parts at 40 px (wave 2, stage 2), on top of the approved squad spike's parts
# (tools/art40/kit/heroes/dirk_parts.py, read only): more plunger drawings for the polished melee
# (the cocked plunger behind the back, the overhead swing, the stretched cup of the stuck thrust),
# the swing and pop effects, and the tool pouch that swings at the back hip (secondary motion).
#
# Conventions as in the kit (parts.py): facing right, light from the upper front, no exterior
# outline (the rig draws it), anchors 'wrist' / 'tip'. Letters: plunger cup C E, wood handle A H,
# skin S s, polo cuff R; FX letters (outside the budget) i m I W for the swing trails and the pop.
import math

import parts as P
from heroes import dirk_parts as DP

# ------------------------------------------------------------------------------------ plungers
# The stuck cup pulled back: the rubber neck stretches, the rim stays on the target.
PL_PULL = ([
    "............E",
    "RSS........CE",
    "RSSAAAAAHCCCE",
    ".ss........EE",
    "............E",
], {'wrist': (0, 2), 'tip': (12, 2)})

# The smear of the overhead smack: the handle drawn long (motion stretch) and the cup a short
# streak; turned by _rot like the kit's diagonal plungers.
PL_SMEAR = ([
    "..............CE",
    "RSS.........CCCE",
    "RSSAAAAAAAHHCCCE",
    ".ss.........CEEE",
    "..............EE",
], {'wrist': (0, 2), 'tip': (16, 2)})


def _rot(rows_an, deg, pad=4):
    """A plunger part turned around its wrist (RotSprite, positive = counter-clockwise): the kit's
    dirk_parts._rot for parts that are not in its PLUNGER table."""
    from rig import rotsprite
    rows, an = rows_an
    w = max(len(r) for r in rows)
    n = 2 * (w + len(rows)) + 2 * pad
    ox, oy = n // 2 - int(an['wrist'][0]), n // 2 - int(an['wrist'][1])
    g = [['.'] * n for _ in range(n)]
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


HANDS = {
    'pl_pull': PL_PULL,
    # cocked: the cup low behind the back (the spring of the smack), the handle over the shoulder
    'pl_cock': _rot(DP.PLUNGER['pl_up'], 80),
    # the top of the swing: the cup straight up over the head, leaning forward
    'pl_top': _rot(DP.PLUNGER['pl_fwd'], 80),
    # the two smear drawings of the smack (stretched handle)
    'pl_sm1': _rot(PL_SMEAR, 78),
    'pl_sm2': _rot(PL_SMEAR, -12),
    # the rebound after the smack: the cup a little up again
    'pl_reb': _rot(DP.PLUNGER['pl_fwd'], -20),
    # the thrust's lunge smear: the long handle level
    'pl_lunge': PL_SMEAR,
}

# ------------------------------------------------------------------------------------ effects
FX = {
    # the overhead smack's trail: a wide arc from behind the head over the top to the front
    # (pswing* of the kit draw the same arc in three parts; 'pswingA' is the full sweep of the smear)
    'pswingA': P.arc(0, 0, 18, 20, -150, 25, 3.0),
    # the pop of the cup coming off (a ring that opens)
    'pop0': ([
        ".iii.",
        "i...i",
        "i.W.i",
        "i...i",
        ".iii.",
    ], (2, 2)),
    'pop1': ([
        "..m.m..",
        ".m...m.",
        "m.....m",
        ".......",
        "m.....m",
        ".m...m.",
        "..m.m..",
    ], (3, 3)),
    # the speed lines of the lunge (behind the cup)
    'lunge': ([
        "iiiiii..",
        "........",
        "........",
        "........",
        "........",
        "........",
        "..mmmmmm",
    ], (10, 3)),
}


# ------------------------------------------------------------------------------------ the pouch
# The leather pouch with the wrench at the back hip is drawn in the torso part (rows 9-12, columns
# 0-2 of the kit's 'up' torso). These variants move its hanging part (rows 11-12) so it swings
# behind the body: 'b' = swung back (1 px behind), 'u' = bounced up (1 px), 'f' = swung forward
# against the hip. Torso names: '<torso>~<pose>'.
POUCH_ROWS = (11, 12)


def _pouch(rows, mode, pel_x):
    g = [list(r.ljust(max(len(q) for q in rows), '.')) for r in rows]
    h = len(g)
    hang = {}
    for y in range(h):
        for x in range(max(0, int(pel_x) - 3)):
            if y >= POUCH_ROWS[0] and g[y][x] != '.':
                hang[(x, y)] = g[y][x]
                g[y][x] = '.'
    dx, dy = {'b': (-1, 0), 'u': (0, -1), 'f': (1, 0)}[mode]
    pad = 1 if dx < 0 else 0
    if pad:
        g = [['.'] + r for r in g]
    for (x, y), ch in sorted(hang.items()):
        nx, ny = x + dx + pad, y + dy
        if 0 <= ny < h and (g[ny][nx] == '.' or dy < 0):
            g[ny][nx] = ch if g[ny][nx] == '.' else g[ny][nx]
    return [''.join(r) for r in g], pad


def pouch_torsos():
    """'<torso>~b' / '~u' / '~f' for the four kit torsos (the anchors move with the left pad)."""
    out = {}
    for name in ('up', 'lean', 'lean2', 'back'):
        rows, an = P.TORSOS[name]
        for mode in ('b', 'u', 'f'):
            r2, pad = _pouch(rows, mode, an['pelvis'][0])
            out[name + '~' + mode] = (r2, {k: (v[0] + pad, v[1]) for k, v in an.items()})
    return out


def install():
    P.HANDS.update(HANDS)
    P.FX.update(FX)
    P.TORSOS.update(pouch_torsos())
