# The drawn parts of the city pigeon (approved look: docs/design/cast40/chars/pigeon.py): blue-grey
# plumage in a hard 4-tone ramp lit from the upper front, the green-purple neck sheen, two dark wing
# bars, a dark tail band, an orange eye, the white cere and a dark beak, coral feet. Drawn by hand
# at 1x, facing right (the game flips the bird when it walks left).
#
# A frame is put together from parts placed relative to the ROOT (the floor point under the body;
# the feet's outline is the last row above it): the body (with the folded wing and the neck base),
# the tail, the head on a neck that stretches, the legs, and in flight the near and the far wing.
# The parts of one bird share the part name 'bird' (no selout between them); the far wing and the
# far leg are 'far' (their edges take the dark tone where the body is in front of them).
import castkit as K

# ------------------------------------------------------------------------------------- palette
PAL = {
    'A': '#c9d0de',                       # lit plumage (back, crown, coverts, breast top)
    'B': '#959fb6',                       # plumage
    'C': '#68718c',                       # shade
    'N': '#3c4158',                       # wing bars, tail band, primaries, beak
    'Z': '#eef1f6',                       # specular top of the head and back (single pixels)
    'G': '#52b48a', 'g': '#2f7468',       # neck sheen green (lit, shade)
    'V': '#a064bc', 'v': '#5e3a78',       # neck sheen purple (lit, shade)
    'O': '#ff9a3a',                       # eye
    'w': '#f0ece2',                       # cere (the white bump at the beak base)
    'P': '#e8737a', 'p': '#a8464f',       # feet (near; far and shade)
}
DARK = {'A': 'C', 'B': 'C', 'C': 'N', 'N': 'N', 'Z': 'B', 'G': 'g', 'g': 'g', 'V': 'v', 'v': 'v',
        'O': 'N', 'w': 'B', 'P': 'p', 'p': 'p'}
HL = 'ZOw'                                # single-pixel letters: specular, eye, cere

W, H = 40, 40                             # canvas
RX, RY = 18, 30                           # the root on the canvas (the floor line under the body)


def install():
    K.palette(PAL, dark=DARK)


# ------------------------------------------------------------------------------------- parts
# Every part: (rows, (dx, dy) of its top-left cell relative to its pivot).

# The standing body: the back lit from above, the two wing bars on the folded wing, the primaries
# crossing the tail root, the round breast with the neck base (purple behind, green in front).
# Pivot: the root.
BODY = (K.grid("""
    ........vVG
    ..ZAAAAAAVGA
    ANANBBBBBBGA
    NBNBBBBBBBB
    CCCBBBBBBBC
    .N.CCCCCCC.
"""), (-6, -9))

# Crouched (the startle before the take-off): 1 px lower, the breast pushed forward.
BODY_LOW = (K.grid("""
    ........VGGA
    .ZAAAAAAVGAA
    NANBBBBBBBBB
    CNCBBBBBBBBC
    .N.CCCCCCCC.
"""), (-6, -8))

# In flight: stretched level, the neck forward, the wing bars hidden under the spread wing.
BODY_FLY = (K.grid("""
    ..ZAAAAAAVG..
    .AABBBBBBVGGA
    NBBBBBBBBBBBA
    .CCBBBBBBBBC.
    ...CCCCCCC...
"""), (-7, -9))

# Tails (pivot: the tail root at the back of the body). Level, raised (the peck's counterweight),
# lowered (a tick with the step), fanned (flight).
TAILS = {
    'level': (K.grid("""
        .CC.
        NNCC
        NN..
    """), (-3, -1)),
    'up': (K.grid("""
        NN...
        NNCC.
        ..CCC
    """), (-4, -3)),
    'down': (K.grid("""
        ..CC
        .NCC
        NN..
        N...
    """), (-3, 0)),
    'fan': (K.grid("""
        ..CCC
        NNCCC
        NNNC.
        .NN..
    """), (-4, -1)),
}
TAIL_ROOT = (-6, -7)                      # relative to the body pivot

# Heads (pivot: the head's lower back pixel, which sits on the neck top). The neck between the
# body's neck base and the head is filled with the sheen when the head moves away from it.
HEAD = (K.grid("""
    .AZ..
    BOAwN
    BBBB.
"""), (0, -2))
HEAD_BLINK = (K.grid("""
    .AZ..
    BCAwN
    BBBB.
"""), (0, -2))
HEAD_TURN = (K.grid("""
    .ZA.
    BAOw
    BBBN
"""), (0, -2))                            # turned a little to the viewer: the beak lower, shorter
# Head down (the peck): the beak at the floor, the eye still on top.
HEAD_DOWN = (K.grid("""
    .AZ.
    BOAA
    .BBw
    ...N
"""), (0, -2))
# Head forward (flight, the thrust): long and level, the beak pointing ahead.
HEAD_FWD = (K.grid("""
    .AZA..
    BBOAwN
    .BBB..
"""), (0, -2))
HEADS = {'head': HEAD, 'blink': HEAD_BLINK, 'turn': HEAD_TURN, 'down': HEAD_DOWN, 'fwd': HEAD_FWD}
NECK_TOP = (2, -9)                        # relative to the body pivot: where the head pivot rests

# Legs (the ankle's foot pixel is the bottom-left cell; (dx, dy) of it relative to the root, dy 0 =
# on the floor). Near legs coral, far legs darker.
LEGS = {
    'near': K.grid("""
        P.
        PP
    """),
    'far': K.grid("""
        p.
        pp
    """),
    'up': K.grid("""
        P.
        .P
    """),                                 # the swinging foot, toes curled
    'upf': K.grid("""
        p.
        .p
    """),
    'ext': K.grid("""
        P.
        P.
        .P
    """),                                 # pushing off / dangling: the leg straight, toes down
    'extf': K.grid("""
        p.
        p.
        .p
    """),
    'tuck': K.grid("""
        pP
    """),                                 # in flight: the feet tucked under the tail
}

# Flight wings (pivot: the shoulder on the back, relative to the body pivot SHOULDER). Hand-drawn
# keys of the wingbeat seen from the side: the near wing lit (A leading edge and coverts, the bar N,
# the primaries C / N), the far wing a darker copy behind the near one.
SHOULDER = (-1, -9)
WINGS = {
    # raised high: the primaries fan up and back
    'up': (K.grid("""
        NN......
        NCN.....
        .NCBA...
        ..CBBA..
        ...CBBA.
        ....BBA.
    """), (-6, -5)),
    # half way down: leaning back at 45 degrees, the primaries spread
    'upmid': (K.grid("""
        NN.......
        NNCC.....
        .NCCBBA..
        ...CBBBA.
    """), (-7, -3)),
    # level: the spread wing along the back, long behind the shoulder
    'mid': (K.grid("""
        ..ABAAAA.
        NNCCBBBBA
        .NNNCC...
    """), (-8, -1)),
    # down: below the body line, the tips swept down and back
    'down': (K.grid("""
        ..BAAA.
        .CBBBA.
        .NCBB..
        NNCC...
        NNC....
        N......
    """), (-5, 2)),
    # the recovery: folded back along the body, the wrist up
    'back': (K.grid("""
        ....BAA.
        NNCCBBBA
        .NNCC...
    """), (-7, 0)),
    # the upstroke: the wrist high, the primaries trailing down behind
    'fold': (K.grid("""
        ....AA.
        ...BBA.
        ..CBBA.
        NCCBB..
        NNN....
    """), (-5, -3)),
}
# The wrist of each key (the leading edge's bend, in the key's grid cells): the joint the
# smoothness gate follows through the wingbeat.
WRIST = {'up': (4, 2), 'upmid': (6, 2), 'mid': (5, 0), 'down': (4, 0), 'back': (5, 0), 'fold': (4, 0)}
# The far wing: the same key in the shade tones, 2 px further back and 1 px higher.
_DIM = str.maketrans('ABC', 'CCN')
FAR = {k: ([r.translate(_DIM) for r in g], (o[0] - 2, o[1] - 1)) for k, (g, o) in WINGS.items()}


# ------------------------------------------------------------------------------------- compose
def put(cv, part, x, y, z, name):
    rows, (ox, oy) = part
    cv.grid(x + ox, y + oy, rows, z, name)


def neck(cv, a, b, z):
    """The neck from the neck top a to the head pivot b (canvas coordinates), 2 px thick: purple
    behind, green in front (the sheen)."""
    ax, ay = a
    bx, by = b
    n = max(abs(bx - ax), abs(by - ay))
    for k in range(n + 1):
        x = round(ax + (bx - ax) * k / max(n, 1))
        y = round(ay + (by - ay) * k / max(n, 1))
        cv.px(x, y, 'V', z, 'bird:neck')
        cv.px(x + 1, y, 'G', z, 'bird:neck')


def frame_rows(body='stand', bx=0, by=0, tail='level', tdy=0, head='head', hx=0, hy=0, legs=(),
               wing=None, far=None, wdy=0):
    """Compose one pigeon. body: 'stand' | 'low' | 'fly' with (bx, by) its offset from the root;
    tail: a TAILS key (tdy: an extra lift); head: a HEADS key with (hx, hy) its offset from the neck
    top; legs: [(kind, dx, dy)] (LEGS keys, the foot cell relative to the root); wing / far: WINGS
    keys (flight), wdy the shoulder's extra lift. Returns (rows, root, joints)."""
    cv = K.Canvas(W, H)
    px, py = RX + bx, RY + by
    b = {'stand': BODY, 'low': BODY_LOW, 'fly': BODY_FLY}[body]
    put(cv, b, px, py, 2.0, 'bird:body')
    tx, ty = px + TAIL_ROOT[0], py + TAIL_ROOT[1] + tdy
    put(cv, TAILS[tail], tx, ty, 1.0, 'bird:tail')
    nt = (px + NECK_TOP[0], py + NECK_TOP[1] + (1 if body == 'low' else 0))
    hp = (nt[0] + hx, nt[1] + hy)
    if (hx, hy) != (0, 0):
        neck(cv, (nt[0], nt[1] + 1), (hp[0], hp[1]), 2.5)
    put(cv, HEADS[head], hp[0], hp[1], 3.0, 'bird:head')
    feet = {}
    for kind, dx, dy in legs:
        g = [r for r in LEGS[kind] if r.strip('.')]      # (the grid's blank last line is no row)
        farleg = kind in ('far', 'upf', 'extf')
        cv.grid(RX + dx, RY - 1 + dy - len(g), g, 0.5 if farleg else 1.5, 'far' if farleg else 'bird:leg')
        feet['footF' if farleg else 'footN'] = (RX + dx + (1 if kind in ('up', 'upf', 'ext', 'extf') else 0), RY - 2 + dy)
    sh = (px + SHOULDER[0], py + SHOULDER[1] + wdy)
    if far:
        put(cv, FAR[far], sh[0], sh[1], 0.2, 'far')
    if wing:
        put(cv, WINGS[wing], sh[0], sh[1], 4.0, 'bird:wing')
    rows = cv.finish(outline=True)
    joints = {'head': (hp[0] + 2, hp[1] - 1), 'tail': (tx - 3, ty), 'body': (px, py - 6), **feet}
    if wing:
        _, (ox, oy) = WINGS[wing]
        wx, wy = WRIST[wing]
        joints['wing'] = (sh[0] + ox + wx, sh[1] + oy + wy)
    return rows, (RX, RY), joints
