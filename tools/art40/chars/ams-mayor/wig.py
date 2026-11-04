# MECHA HASLEMA: the wave locks (on the head: boss/ams-mayor/head-<stage>; in flight at the death:
# boss/ams-mayor/wig, 8 tumble frames). Long heavy wave locks from a side part. Each lock is drawn
# along a smooth centre line and shaded across it in clean bands (wave 6 fix of the pilot's 1x
# speckle): the dark core gap on the shadow side, one dark band, one mid band, the lit side, ONE
# continuous lit streak that wanders with the wave, ONE glint on the streak's first crest. A lock
# that lies over another one leaves a 1 px dark gap on it. No lone specks (clean pass after).
import math

from . import cv
from .cv import Layer, catmull, polymask, LX, LY

# The locks (centre line control points, radius at the root, radius at the tip, far side). Back to
# front: a later lock lies over an earlier one. The look of the wave 1 pilot (approved).
LOCKS = [
    ([(10, -160), (24, -156), (33, -144), (35, -131), (31, -120), (33, -112)], 7.0, 4.5, True),
    ([(-6, -161), (-22, -160), (-36, -150), (-42, -136), (-38, -122), (-44, -108), (-50, -97), (-48, -89)], 9.5, 2.5, False),
    ([(-5, -158), (-18, -154), (-28, -143), (-30, -129), (-25, -116), (-31, -104), (-38, -95), (-37, -87)], 8.5, 2.5, False),
    ([(-7, -153), (-14, -146), (-18, -134), (-14, -122), (-19, -110), (-25, -99), (-23, -90)], 7.0, 2.5, False),
    # the front sweep from the part over the forehead, down behind the far cheek
    ([(-2, -161), (8, -161), (18, -159), (25, -152), (28, -141), (26, -129), (30, -117), (33, -108), (34, -102)], 7.5, 3.5, False),
]
FRONT = len(LOCKS) - 1
WAVE = 13.0                     # px along a lock per wave of the lit streak
PHASE = [0.4, 1.7, 0.0, 2.6, 1.1]   # each lock's own wave phase (they do not wave in step)

# The wig's own anchor: the launch point of the flight (layout.ts WIG_ANCHOR), the turn's centre.
ANCHOR = (-6, -128)

# The hatch in the crown (layout.ts hatchSeam: x -14..0 round -161; the letters leave at (-7, -164)).
HATCH_C = (-7.0, -165.0)
HATCH_R = (8.0, 3.2)


def centre_line(ctrl):
    ln = catmull(ctrl)
    acc = [0.0]
    for i in range(1, len(ln)):
        acc.append(acc[-1] + math.hypot(ln[i][0] - ln[i - 1][0], ln[i][1] - ln[i - 1][1]))
    return ln, acc


def lock_pixels(ctrl, r0, r1, far, phase=0.0):
    """{(x, y): (letter, t along the lock 0..1)} of one wave lock, shaded in bands across it."""
    ln, acc = centre_line(ctrl)
    total = acc[-1] or 1.0
    xs = [p[0] for p in ln]
    ys = [p[1] for p in ln]
    R = max(r0, r1) + 1
    out = {}
    glint = None
    # the glint: on the streak at the first crest of the wave past a fifth of the lock
    for i in range(len(ln)):
        a = acc[i]
        if a / total > 0.18 and math.sin(2 * math.pi * a / WAVE + phase) > 0.97:
            glint = i
            break
    for y in range(int(min(ys) - R), int(max(ys) + R) + 1):
        for x in range(int(min(xs) - R), int(max(xs) + R) + 1):
            px_, py_ = x + 0.5, y + 0.5
            best, bi = 1e9, 0
            for i, (lx, ly) in enumerate(ln):
                d = (px_ - lx) ** 2 + (py_ - ly) ** 2
                if d < best:
                    best, bi = d, i
            t = acc[bi] / total
            r = r0 + (r1 - r0) * (t ** 1.6)
            d = math.sqrt(best)
            if d > r:
                continue
            i0, i1 = max(0, bi - 2), min(len(ln) - 1, bi + 2)
            tx, ty = ln[i1][0] - ln[i0][0], ln[i1][1] - ln[i0][1]
            tl = math.hypot(tx, ty) or 1.0
            nx, ny = -ty / tl, tx / tl
            v = (px_ - ln[bi][0]) * nx + (py_ - ln[bi][1]) * ny          # px across, signed
            if bi in (0, len(ln) - 1):
                v = d * (1 if v >= 0 else -1)
            s = 1.0 if (nx * LX + ny * LY) > 0 else -1.0                   # the side toward the light
            w = v * s                                                      # + = toward the lit edge
            ph = math.sin(2 * math.pi * acc[bi] / WAVE + phase)
            p = (w / max(r, 0.8) + 1) / 2                                  # 0 shadow edge .. 1 lit edge
            # the streak: a 1-2 px line at a distance from the centre that wanders with the wave
            ws = r * (0.38 + 0.22 * ph)
            if r - w <= 1.15:
                ch = 'b'                                                   # the lit rim of the lock
            elif abs(w - ws) <= 0.72 and t < 0.93:
                ch = 'a'
            elif p >= 0.58:
                ch = 'b'
            elif p >= 0.36:
                ch = 'c'                                                   # the mid band
            elif r + w > 1.3:
                ch = 'd'
            else:
                ch = 'e'                                                   # the dark core gap
            if t > 0.9 and ch in 'ab':
                ch = 'c'                                                   # the thin tip: no streak
            if far:
                ch = {'a': 'b', 'b': 'c', 'c': 'd', 'd': 'e', 'e': 'f'}[ch]
            if glint is not None and bi == glint and abs(w - ws) <= 0.6:
                ch = 'g' if not far else 'a'
            out[(x, y)] = (ch, t)
    return out


def _speck_free(L, sub):
    """The clean pass: a wig pixel none of whose 4 neighbours share its tone takes the commonest
    neighbouring tone (the streak, the glint and the char stay)."""
    for _ in range(2):
        cv.clean(L, (sub,), keep='ag89')


def wig(L, singe=0, locks=None, z0=6.5, front_z=None, sub='wig'):
    """Paint the locks into L. locks: [(ctrl, r0, r1, far)] (default LOCKS, the worn look). singe:
    the damage stage (1: two lock tips scorched, 2: every tip charred). front_z(x, y) -> the depth of
    the front sweep (it lies over the steel brow on the head)."""
    locks = LOCKS if locks is None else locks
    letters, owner, along = {}, {}, {}
    for i, (ctrl, r0, r1, far) in enumerate(locks):
        for q, (ch, t) in sorted(lock_pixels(ctrl, r0, r1, far, PHASE[i % len(PHASE)]).items()):
            letters[q] = ch
            owner[q] = i
            along[q] = t
    final = dict(letters)
    for (x, y), i in sorted(owner.items()):
        for q in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if owner.get(q, -1) > i:
                final[(x, y)] = 'f'                      # a lock lies over this one: the dark gap
                break
    burnt = {1: (1, 2), 2: (0, 1, 2, 3, 4)}.get(min(singe, 2), ())
    for (x, y), ch in sorted(final.items()):
        z = z0
        if owner[(x, y)] == FRONT and front_z:
            z = front_z(x, y)
        t = along[(x, y)]
        if owner[(x, y)] in burnt:
            t0 = 0.88 if singe == 1 else 0.82
            lit = ch in 'abg'
            if t > t0 + 0.05:
                ch = '9' if lit else 'f'                 # the charred tip: ash on the lit side (FX)
            elif t > t0 + 0.025:
                ch = 'e' if lit else 'f'
            elif t > t0:
                ch = 'd' if lit else 'e' if ch in 'cd' else 'f'
        L.put(x, y, ch, z, sub)
    _speck_free(L, sub)
    return owner


def part_line(L, dx=0, dy=0):
    """The side part: a short dark parting where the back locks and the sweep leave the crown."""
    for (x, y) in ((-3, -167), (-3, -166), (-2, -165), (-2, -164), (-2, -163)):
        if L.get(x + dx, y + dy) is not None:
            L.put(x + dx, y + dy, 'f', 7.7, 'wig')


# ------------------------------------------------------------------------------------- the hatch
def hatch_mask():
    cx, cy = HATCH_C
    rx, ry = HATCH_R
    return {(x, y) for (x, y) in cv.ellmask(cx, cy, rx, ry)}


def hatch(L, state):
    """The letter hatch in the crown. 'closed': a thin seam with a lit lip; 'ajar': the lid lifts at
    the front on its back hinge (a dark gap, a paper corner); 'open': the lid stands up and back,
    the slot shows its steel rim and the letters peek out."""
    H = hatch_mask()
    cx, cy = HATCH_C
    if state == 'closed':
        for (x, y) in sorted(H):
            if (x, y + 1) not in H and L.get(x, y) is not None and x > cx - 7:
                L.over(x, y, 'f')                         # the seam under the lid's front edge
                if L.get(x, y - 1) is not None and (x, y - 1) in H:
                    L.over(x, y - 1, 'b' if x > cx - 2 else 'c')   # the lid's lit lip
        return
    # the slot: a dark oval, its steel rim lit on the lower (far) lip
    for (x, y) in sorted(H):
        if L.get(x, y) is None:
            continue
        edge_lo = (x, y + 1) not in H
        edge_hi = (x, y - 1) not in H
        ch = '7'
        if edge_lo:
            ch = '2' if x > cx - 3 else '3'
        elif edge_hi:
            ch = '5'
        elif (x + y) % 5 == 0:
            ch = '6'
        L.put(x, y, ch, 7.9, 'slot')
    if state == 'ajar':
        # the lid: the hair patch tipped up 2-3 px at the front, a dark gap under its front edge
        lid = polymask([(cx - 8.5, cy - 0.5), (cx - 4, cy - 3.6), (cx + 3, cy - 5.6), (cx + 8.5, cy - 4.2),
                        (cx + 8, cy - 1.8), (cx + 2, cy - 1.0), (cx - 4, cy + 0.6)])
        for (x, y) in sorted(lid):
            top = (x, y - 1) not in lid
            bot = (x, y + 1) not in lid
            ch = 'a' if top and x > cx - 2 else 'b' if top else '3' if bot and x > cx else 'd' if bot else 'c'
            L.put(x, y, ch, 8.2, 'lid')
        # a paper corner in the gap
        for (x, y, ch) in ((int(cx + 3), int(cy - 1), 'B'), (int(cx + 4), int(cy - 1), 'A'), (int(cx + 4), int(cy - 2), 'C')):
            L.put(x, y, ch, 8.1, 'paper')
        return
    # open: the lid flung up and back on its hinge (its steel underside to the front), letters out
    # (flung far back, at about 35 degrees: its top stays at the smile frame's crown height, so the
    # open lid is inside the Stopera view, which is 176 px tall over her floor)
    hx = cx - 8
    lid = polymask([(hx + 1.0, cy + 0.5), (hx - 3.0, cy - 3.0), (hx - 8.0, cy - 6.0), (hx - 11.5, cy - 6.8),
                    (hx - 11.0, cy - 4.2), (hx - 6.0, cy - 1.6), (hx - 1.0, cy + 1.2)])
    for (x, y) in sorted(lid):
        front = (x, y + 1) not in lid or (x + 1, y) not in lid
        back = (x, y - 1) not in lid
        ch = 'c'
        if front:
            ch = '2' if x < hx - 4 else '3'               # the lid's steel underside, lit
        elif (x, y + 2) not in lid:
            ch = '4'
        elif back:
            ch = 'e'
        elif (x + y) % 4 == 0:
            ch = 'b'
        L.put(x, y, ch, 8.3, 'lid')
    L.put(int(hx), int(cy), '4', 8.31, 'hinge')
    L.put(int(hx) + 1, int(cy), '2', 8.31, 'hinge')
    # the letters peeking out of the slot: an envelope tilted forward, a folded note behind it
    note = polymask([(cx - 4, cy - 1), (cx - 3, cy - 6), (cx + 2, cy - 6.5), (cx + 1, cy - 1)])
    for (x, y) in sorted(note):
        ch = 'C' if (x - 1, y) not in note else 'B' if (x, y - 1) not in note else 'D'
        L.put(x, y, ch, 8.4, 'note')
    env = polymask([(cx - 1, cy), (cx + 1, cy - 7), (cx + 9, cy - 5.5), (cx + 7, cy + 1)])
    for (x, y) in sorted(env):
        top = (x, y - 1) not in env
        ch = 'A' if top else 'B'
        if (x + 1, y) not in env or (x, y + 1) not in env:
            ch = 'D'
        L.put(x, y, ch, 8.5, 'env')
    # the envelope's flap fold and the red complaint seal
    for (x, y) in cv.line(Layer('t'), [(int(cx + 1), int(cy - 6)), (int(cx + 4), int(cy - 3)), (int(cx + 8), int(cy - 4))], 'x', 0, ''):
        if L.sub(x, y) == 'env':
            L.over(x, y, 'C')
    for (x, y, ch) in ((int(cx + 4), int(cy - 3), 'S'), (int(cx + 5), int(cy - 3), 'T'), (int(cx + 4), int(cy - 2), 'T')):
        if L.sub(x, y) == 'env':
            L.over(x, y, ch)


# ---------------------------------------------------------------------------------- the flight
def _rot(p, c, a):
    x, y = p[0] - c[0], p[1] - c[1]
    ca, sa = math.cos(a), math.sin(a)
    return (c[0] + x * ca - y * sa, c[1] + x * sa + y * ca)


def flight_locks(k, steps=8):
    """The locks of tumble frame k: the whole wig turned BACKWARD by k x 45 degrees about its anchor
    (the top goes to the back, -x: it flies off backward), each lock bent to trail the turn (the
    tips lag up to 22 degrees) and splayed out (the tips fly wide). Frame 0 is also the landed rest
    (mayor.ts ends the turn on it, the anchor 34 px over the floor): its tips splay out sideways so
    nothing reaches lower than 33 px under the anchor."""
    a = -2 * math.pi * k / steps
    out = []
    for i, (ctrl, r0, r1, far) in enumerate(LOCKS):
        ln, acc = centre_line(ctrl)
        total = acc[-1] or 1.0
        pts = []
        for j, p in enumerate(ctrl):
            # how far along the lock this control point is (0 root .. 1 tip)
            best = min(range(len(ln)), key=lambda q: (ln[q][0] - p[0]) ** 2 + (ln[q][1] - p[1]) ** 2)
            f = acc[best] / total
            # splay: the lower part of each lock swings out from the middle, the tip curls up
            sx = 1.0 + 0.12 * f
            px = ANCHOR[0] + (p[0] - ANCHOR[0]) * sx
            py = p[1]
            lim = ANCHOR[1] + (25 if k % steps == 0 else 20)
            if py > lim:
                py = lim + (py - lim) * 0.3                  # the tips flare out, not down
                px += (6 if p[0] > ANCHOR[0] + 6 else -6) * f
            q = _rot((px, py), ANCHOR, a + math.radians(14) * f ** 1.3 * (1 if k % steps else 0.0))
            pts.append(q)
        out.append((pts, r0, r1, far))
    return out


def cap(L, a=0.0):
    """The inside of the wig where the face was: the dark lining of the cap (a net of crossing
    threads), turned with the wig."""
    poly = [(-8, -153), (2, -158), (14, -157), (21, -151), (22, -144), (12, -144), (0, -145), (-8, -147)]
    poly = [_rot(p, ANCHOR, a) for p in poly]
    m = polymask(poly)
    for (x, y) in sorted(m):
        if L.get(x, y) is not None and L.sub(x, y) == 'wig' and L.c[(x, y)][1] > 6.0:
            continue
        ch = 'e' if (x + y) % 4 == 0 or (x - y) % 4 == 0 else 'f'
        L.put(x, y, ch, 6.0, 'cap')


def flight(k, steps=8):
    """Tumble frame k of the wig alone (no singe: the bonus head may be whole at the death)."""
    L = Layer('wig')
    a = -2 * math.pi * k / steps
    cap(L, a)
    wig(L, 0, flight_locks(k, steps), z0=6.5)
    return L
