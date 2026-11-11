# The drawn parts of the mallards (approved looks: docs/design/cast40/chars/duck-drake.py and
# duck-hen.py): the drake with the bottle-green head and its sheen, the white collar, the chestnut
# breast, the pale grey flanks, the black rump with the curl and the yellow bill; the hen mottled
# brown with dark scallops, a buff face with the dark eye stripe, the orange bill with its dark
# saddle and the blue wing patch. One palette for both (the hen's letters are lower case where
# they would clash). Drawn by hand at 1x, facing right (the game flips the duck that swims left).
#
# A frame: the bird's letters are composed on a plain grid (head on the body, wings, the tilt of a
# dabble by RotSprite), outlined once, then CUT at the water line (THE ROOT ROW: the canal surface,
# plan rule 10) so the body sits IN the water, and the ripple ring is drawn on the water line in
# the shared FX ramp (no outline).
import castkit as K
import rig

# ------------------------------------------------------------------------------------- palette
PAL = {
    # drake
    'G': '#3c9c5c', 'H': '#8ee0a0', 'g': '#1d5a3a',        # head green, sheen, shade (+ the eye)
    'w': '#f8f6ec',                                        # collar, tail feathers
    'Y': '#f6cc3c', 'O': '#b88a22',                        # bill, its shade
    'R': '#a8583a', 'r': '#6c3424',                        # chestnut breast
    'S': '#e4e2da', 'T': '#b4b2ac', 'U': '#827f7c',        # grey flanks
    'E': '#9c8c74', 'e': '#6c5e4c',                        # brown-grey back, wing
    'Q': '#2a2a34',                                        # black rump, curl, the eye
    # hen
    'a': '#e2bf92', 'b': '#b48658', 'c': '#7c5434', 'd': '#3e2a20',   # buff to dark brown
    'y': '#f09a3c', 'q': '#5a4030',                        # bill, its saddle
    'V': '#4f62d8',                                        # the blue wing patch (both birds)
    'F': '#f08a2c',                                        # feet (seen in the dabble)
    # the water ring: shared FX ramp colours (outside the colour budget)
    'i': '#bfe4ff', 'W': '#ffffff',
}
DARK = {'G': 'g', 'H': 'g', 'g': 'g', 'w': 'T', 'Y': 'O', 'O': 'r', 'R': 'r', 'r': 'r',
        'S': 'U', 'T': 'U', 'U': 'Q', 'E': 'e', 'e': 'Q', 'Q': 'Q',
        'a': 'c', 'b': 'c', 'c': 'd', 'd': 'd', 'y': 'q', 'q': 'q', 'V': 'Q', 'F': 'r'}
FX = 'iW'
HL = 'H'

W, H = 44, 36
RX, RY = 20, 26                           # the root: under the body's middle ON the water line

# ------------------------------------------------------------------------------------- parts
# (rows, (dx, dy) of the top-left cell relative to the pivot). Body pivot: the root (the body's
# bottom row is the row above the water line). Head pivot: the neck top on the body (NECK).
BODY = {
    'drake': (K.grid("""
        ..Q..........
        .QQ.EEEEEwwg.
        wQQEEeEEeERR.
        wQSSSSSSSSRRR
        .QTTTTTTTTRrr
    """), (-7, -5)),
    'hen': (K.grid("""
        ..c..........
        .bc.abacabab.
        cbbacbwVVwaaa
        .cbabcbbabbcb
        .ccbcbbcbbbcc
    """), (-7, -5)),
}
HEAD = {
    'drake': (K.grid("""
        .GG...
        GHGG..
        GGQGYY
        gGGOY.
    """), (0, -4)),
    'hen': (K.grid("""
        .cc...
        cbba..
        dddayy
        baaqy.
    """), (0, -4)),
}
# The head turned down to the water (the dabble's dip): the bill points at the surface.
HEAD_DIP = {
    'drake': (K.grid("""
        .GG..
        GHGG.
        GGQG.
        gGGOY
        ...YY
    """), (0, -4)),
    'hen': (K.grid("""
        .cc..
        cbba.
        ddda.
        baaqy
        ...yy
    """), (0, -4)),
}
NECK = (2, -4)                            # the neck top relative to the body pivot (head pivot rest)
NECKC = {'drake': ('g', 'G'), 'hen': ('b', 'a')}   # the neck stretch colours (back, front)

# Wings raised in the hurry (pivot: the shoulder on the back, SHOULDER): up, level, down.
WING = {
    'drake': {
        'up': (K.grid("""
            eE...
            eEE..
            .eEEE
            ..VwE
        """), (-3, -4)),
        'mid': (K.grid("""
            eeEEE.
            .eVwEE
        """), (-4, -2)),
        'down': (K.grid("""
            ..EEE
            .eVwE
            eeE..
        """), (-3, -1)),
    },
    'hen': {
        'up': (K.grid("""
            cb...
            cbb..
            .cbab
            ..Vwb
        """), (-3, -4)),
        'mid': (K.grid("""
            ccbab.
            .cVwbb
        """), (-4, -2)),
        'down': (K.grid("""
            ..bab
            .cVwb
            ccb..
        """), (-3, -1)),
    },
}
SHOULDER = (-1, -4)


def install():
    K.palette(PAL, dark=DARK)


# ------------------------------------------------------------------------------------- compose
def _blit(g, part, x, y, flip=False):
    rows, (ox, oy) = part
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch != '.':
                X, Y = x + ox + i, y + oy + j
                if 0 <= X < W and 0 <= Y < H:
                    g[Y][X] = ch


def compose(bird, by=0, hx=0, hy=0, dip=False, tail=0, wing=None, tilt=0.0, feet=None, head=True):
    """The bird's letters on a W x H grid (no outline yet). by: the body's drop (1 = lower in the
    water); (hx, hy): the head offset from the neck top; dip: the head turned to the water; tail:
    the curl / tail tip moved by 1 px (-1 up, 1 down); wing: a WING key; tilt: degrees (negative =
    nose down, around the breast at the water line); feet: [(dx, dy)] orange feet cells (dabble);
    head: False when the head is under the water.
    Returns (grid, joints)."""
    g = [['.'] * W for _ in range(H)]
    px, py = RX, RY + by
    body = BODY[bird]
    rows = [list(r) for r in body[0]]
    if tail:
        # the tail tip (column 0-2, top rows) waggles: shift the first three columns up / down
        cols = 3
        old = [r[:cols] for r in rows]
        for j in range(len(rows)):
            src = j + tail
            rows[j][:cols] = old[src] if 0 <= src < len(rows) else ['.'] * cols
    _blit(g, ([''.join(r) for r in rows], body[1]), px, py)
    nt = (px + NECK[0], py + NECK[1])
    hp = (nt[0] + hx, nt[1] + hy)
    if (hx, hy) != (0, 0):
        back, front = NECKC[bird]
        n = max(abs(hx), abs(hy))
        for k in range(n + 1):
            x = round(nt[0] + hx * k / max(n, 1))
            y = round(nt[1] + hy * k / max(n, 1))
            for c, ch in ((x, back), (x + 1, front), (x + 2, front)):
                if g[y][c] == '.' or k > 0:
                    g[y][c] = ch
    if head:                              # (False: the head is under the water)
        _blit(g, (HEAD_DIP if dip else HEAD)[bird], hp[0], hp[1])
    if wing:
        _blit(g, WING[bird][wing], px + SHOULDER[0], py + SHOULDER[1])
    for fx_, fy in feet or ():
        g[py + fy][px + fx_] = 'F'
    joints = {'head': (hp[0] + 3, hp[1] - 2), 'tail': (px - 6, py - 4 + tail)}
    if wing:
        joints['wing'] = (px + SHOULDER[0] - 3, py + SHOULDER[1] + {'up': -4, 'mid': -2, 'down': 0}[wing])
    if tilt:
        piv = (px + 5, RY)
        g = [list(r) for r in rig.rotsprite([''.join(r) for r in g], piv, tilt)]
        for k, (x, y) in list(joints.items()):
            import math
            a = math.radians(-tilt)
            dx, dy = x - piv[0], y - piv[1]
            joints[k] = (piv[0] + dx * math.cos(a) - dy * math.sin(a), piv[1] + dx * math.sin(a) + dy * math.cos(a))
    return g, joints


def finish(g, ripple, wake=(), splash=()):
    """Outline the bird, cut it at the water line and draw the water ring. ripple: the crest phase
    (0..11) of the ring under the body; wake: x offsets (from the root) of the trailing wake
    dashes; splash: (dx, dy, letter) FX cells (drops above the water). Returns rows."""
    cv = K.Canvas(W, H)
    for y in range(H):
        for x in range(W):
            if g[y][x] != '.':
                cv.px(x, y, g[y][x], 2.0, 'duck')
    rows = [list(r) for r in cv.finish(outline=True)]
    # what stays above the water line
    for y in range(RY, H):
        rows[y] = ['.'] * W
    xs = [x for x in range(W) if rows[RY - 1][x] not in '.']
    if xs:
        x0, x1 = min(xs) - 1, max(xs) + 1
        for x in range(x0, x1 + 1):
            rows[RY][x] = 'i'
        # the crest highlights run back along the ring (the duck pushes through the water)
        span = x1 - x0 + 1
        for k in (0, 5):
            x = x1 - ((ripple + k) % span)
            rows[RY][x] = 'W'
        rows[RY][x1] = 'W'                # the bow wave
    for dx in wake:
        for x in (RX + dx, RX + dx - 1):
            if 0 <= x < W:
                rows[RY][x] = 'i'
    for dx, dy, ch in splash:
        x, y = RX + dx, RY + dy
        if 0 <= x < W and 0 <= y < H and rows[y][x] == '.':
            rows[y][x] = ch
    return [''.join(r) for r in rows]
