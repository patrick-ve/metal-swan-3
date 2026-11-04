# Frame makers of the hero sets: the game draws a hero as two pieces joined at the pelvis (a legs
# strip with the point 'hip', a torso strip anchored at the pelvis) or as one full-body strip. These
# helpers compose a kit pose (tools/art40/kit: pose.compose) into exactly those pieces, with the
# points the game reads and every rig joint (the smoothness gate).
#
#   legs(lower)            -> Frame, anchor 'feet' (the ground under the hero), pts: hip
#   torso(upper, hand=...)  -> Frame, anchor = the pelvis, pts: muzzle (a gun), hand, head
#   full(pose)             -> Frame, anchor 'feet', pts: hand, head, hip
#
# The layers stack the way X.humanoid stacks them, so a legs frame plus a torso frame drawn on its
# hip is pixel-identical to the spike's composed figure (the back layer, a cape, belongs to the
# torso piece: the game draws the torso after the legs).
import math
import re

import art40 as X
import pose
import castkit as K

# Muzzle flashes of the spike: the game draws its own flash at the muzzle (fx/muzzle*, src/game/fx.ts),
# so the baked shoot strips carry the recoil, the smoke and the shells, never a second flash.
FLASH = re.compile(r'^(f[fudeq]|h[fudeq]|fl)\d$')


def no_flash(p):
    fx = p.get('fx')
    if not fx:
        return p
    q = dict(p)
    keep = [f for f in fx if not FLASH.match(f[0])]
    if keep:
        q['fx'] = keep
    else:
        q.pop('fx', None)
    return q


def head_pt(j):
    nk = j.get('head.neck') or j.get('torso.neck') or j.get('pel')
    return (nk[0] + 1, nk[1] - 7)


# Points of held items (the knife tip, the gun muzzle): not body joints, so not in the joint track
# (the gate measures the body; the wrist that holds the item is measured). The muzzle the game reads
# is a point of the aim and shoot strips (torso(..., muzzle=True)).
ITEM_PTS = ('.tip', '.muzzle')


def _flat(meta, dx=0, dy=0, skip=('root',)):
    out = {}
    X._flat(meta, dx, dy, out, skip=skip)
    return {k: v for k, v in out.items() if not k.endswith(ITEM_PTS)}


def sink(rows, root):
    """Rows of pixels under the feet anchor line (0 = none)."""
    ys = [y for y, r in enumerate(rows) if r.strip('.')]
    return (max(ys) + 1 - root[1]) if ys else 0


def legs(lower, lift=True):
    """A legs frame. lift: a shoe that would reach under the floor line raises the frame (the anchor
    moves down by the overhang), never sinks it (rule 2)."""
    rows, meta = pose.compose(lower, 'lower')
    root = X.feet_root()
    j = _flat(meta, skip=('root',))
    below = sink(rows, root)
    if lift and below > 0:
        root = (root[0], root[1] + below)
    return X.Frame(rows, root, pts={'hip': j['pel']}, joints=j)


def torso(upper, hand='armN', extra=None, smear=False, muzzle=False):
    """A torso frame anchored at the pelvis: the back layer (a cape) and the upper body. hand: the
    arm whose wrist is the game's 'hand' (the throwing hand of a throw strip)."""
    up = dict(upper)
    up['pelvis'] = (0, -17)
    layers = []
    br = pose.compose(up, 'back')[0]
    if br:
        layers.append((br, 0, 0))
    urows, meta = pose.compose(up, 'upper')
    layers.append((urows, 0, 0))
    rows = K.stack(layers, pose.W, pose.H) if len(layers) > 1 else urows
    mz = meta.get('armN', {}).get('muzzle')
    j = _flat(meta)
    root = j['pel']
    pts = {'head': head_pt(j)}
    w = j.get(hand + '.wrist') or j.get('armN.wrist')
    if w:
        pts['hand'] = w
    if muzzle and mz:
        pts['muzzle'] = mz
    if extra:
        pts.update(extra)
    return X.Frame(rows, root, pts=pts, joints=j, smear=smear)


def _turn(pt, piv, deg):
    a = math.radians(deg)
    dx, dy = pt[0] - piv[0], pt[1] - piv[1]
    return (piv[0] + dx * math.cos(a) + dy * math.sin(a), piv[1] - dx * math.sin(a) + dy * math.cos(a))


def seen_joints(p, j):
    """The joints where the player SEES them: the 'rot' turn of the upper body (about the pelvis),
    the whole-body 'spin' and the 'squash' of the post hook (the pilot's rule)."""
    j = dict(j)
    rot = p.get('rot', 0)
    if rot:
        piv = j['pel']
        j = {k: (v if k.startswith('leg') or k == 'pel' else _turn(v, piv, rot)) for k, v in j.items()}
    if p.get('spin'):
        deg, (ox, oy) = p['spin']
        piv = (pose.RX + ox, pose.RY + oy)
        j = {k: _turn(v, piv, deg) for k, v in j.items()}
    if p.get('squash'):
        sy, sx = p['squash']
        rx, bot = pose.RX, pose.RY
        j = {k: (rx + (v[0] - rx) * sx, bot - (bot - v[1]) * sy) for k, v in j.items()}
    return j


def full(p, ground=True, hand='armN', smear=False):
    """A one-piece frame (deaths, victory, fidgets, mount): pose.compose 'full' with the post hook.
    ground: a figure that would sink under the feet anchor (a lying body, a kneeling knee) has its
    pelvis raised until its lowest row stands on the floor line; a foot that still reaches under
    lifts the whole frame (rule 2)."""
    rows, root, j = X.full(p)
    below = sink(rows, root)
    if ground and below > 0:
        px, py = p.get('pelvis', (0, -17))
        q = dict(p, pelvis=(px, py - below))
        r2, root2, j2 = X.full(q)
        if sink(r2, root2) < below:
            p, rows, root, j = q, r2, root2, j2
            below = sink(rows, root)
        if below > 0:
            root = (root[0], root[1] + below)
    # the floor points under the ankles are the walk cycles' plant helpers, not joints of a body
    # that falls, flips or lies down
    j = {k: v for k, v in seen_joints(p, j).items() if not k.endswith(('.ground',) + ITEM_PTS)}
    pts = {'head': head_pt(j), 'hip': j['pel']}
    w = j.get(hand + '.wrist') or j.get('armN.wrist')
    if w:
        pts['hand'] = w
    return X.Frame(rows, root, pts=pts, joints=j, smear=smear)


def rider(upper):
    """A Swan rider pose: the upper body (and whatever the pose draws of the legs) anchored at the
    hip, the way the Swan draws it on her seat point. 'hand' is the near hand on its grip, or the
    hand raised above the shoulders (the cheer, the hands at the ears)."""
    f = torso(upper)
    wr = [f.joints[k] for k in ('armN.wrist', 'armF.wrist') if k in f.joints]
    sh = f.joints.get('torso.shN')
    if wr and sh:
        hi = min(wr, key=lambda w: w[1])
        if hi[1] < sh[1]:
            f.pts['hand'] = hi
    return f


# ------------------------------------------------------------------------------------- in-betweens
def _mix(a, b, t):
    if isinstance(a, (int, float)) and isinstance(b, (int, float)) and not isinstance(a, bool):
        return a + (b - a) * t
    if isinstance(a, tuple) and isinstance(b, tuple) and len(a) == len(b) and all(isinstance(v, (int, float)) for v in a + b):
        return tuple(x + (y - x) * t for x, y in zip(a, b))
    if isinstance(a, dict) and isinstance(b, dict):
        out = {}
        for k in list(a) + [k for k in b if k not in a]:
            if k in a and k in b:
                out[k] = _mix(a[k], b[k], t)
            else:
                out[k] = a[k] if k in a else b[k]
                if (k in a and t >= 0.5) or (k in b and t < 0.5):
                    out.pop(k)
        return out
    return a if t < 0.5 else b


def mix(a, b, t, keep=None):
    """An in-between of two poses: numbers and points move, parts (torso, head, hand, gun) switch at
    the half (keep='a' / 'b' picks one side's parts for the whole in-between)."""
    out = _mix(a, b, t)
    if keep:
        src = a if keep == 'a' else b
        for k in ('torso', 'head', 'fx', 'items'):
            if k in src:
                out[k] = src[k]
            else:
                out.pop(k, None)
        for arm in ('armN', 'armF'):
            if arm in out and arm in src and 'end' in src[arm]:
                out[arm] = dict(out[arm], end=src[arm]['end'])
    return out


def ease(t):
    return t * t * (3 - 2 * t)


# ------------------------------------------------------------------------------------- timing
MAX_TRAVEL = 3.0          # px per displayed tick (the smoothness gate, plan "Rules: animation design")
MAX_SMEARS = 2


def _rel(f):
    """Joints and points relative to the anchor, rounded the way the bake rounds them."""
    rx, ry = f.root
    r = lambda v: (X.half_up(v[0] - rx), X.half_up(v[1] - ry))
    out = {k: r(v) for k, v in f.joints.items()}
    for k, v in f.pts.items():
        if k not in ('plant', 'plantL', 'plantR'):
            out[k] = r(v)
    return out


def travel(a, b):
    """The largest joint move (px) from frame a to frame b, measured like the gate (anchor-relative)."""
    pa, pb = _rel(a), _rel(b)
    m = 0.0
    for k, p in pa.items():
        q = pb.get(k)
        if q:
            m = max(m, math.hypot(q[0] - p[0], q[1] - p[1]))
    return m


class FitError(Exception):
    pass


def fit(frames, prefs, loop=False, segments=None, lock=(), name='?'):
    """Hold times that keep every joint under MAX_TRAVEL px per displayed tick and each segment's
    logic time. prefs: the wanted ticks per frame; segments: [(start, end, total or None)] over the
    frame indices (end exclusive; a frame's step goes to the next frame, so it belongs to its own
    segment); lock: frame indices whose ticks never change. A frame whose outgoing move cannot fit
    becomes a smear frame (at most MAX_SMEARS per strip, the biggest moves first). Returns the
    durations (the frames' smear flags are set in place)."""
    n = len(frames)
    segments = segments or [(0, n, None)]
    steps = n if loop else n - 1
    tr = [travel(frames[i], frames[(i + 1) % n]) if i < steps else 0.0 for i in range(n)]

    def need(i):
        if i in lock:
            return prefs[i]
        if frames[i].smear or tr[i] == 0:
            return 1
        return max(1, math.ceil(tr[i] / MAX_TRAVEL - 1e-9))

    durs = list(prefs)
    for a, b, total in segments:
        total = sum(prefs[a:b]) if total is None else total
        while True:
            req = {i: need(i) for i in range(a, b)}
            if sum(req.values()) <= total:
                break
            smears = sum(1 for f in frames if f.smear)
            cand = [i for i in range(a, b) if i not in lock and not frames[i].smear and req[i] > 1]
            if smears >= MAX_SMEARS or not cand:
                raise FitError(f'{name}: frames {a}-{b - 1} need {sum(req.values())} ticks, the logic time is {total} '
                               f'(moves {[round(tr[i], 1) for i in range(a, b)]})')
            frames[max(cand, key=lambda i: (req[i], tr[i], -i))].smear = True
        # spread the spare ticks toward the wanted holds (biggest shortfall first, deterministic)
        d = {i: req[i] for i in range(a, b)}
        spare = total - sum(d.values())
        while spare > 0:
            free = [i for i in range(a, b) if i not in lock]
            if not free:
                break
            i = max(free, key=lambda i: (prefs[i] - d[i], prefs[i], -i))
            d[i] += 1
            spare -= 1
        for i in range(a, b):
            durs[i] = d[i]
    return durs


def clean(rows, keep):
    """The orphan rule (art40-check): an edge pixel with no 8-neighbour of its own colour takes the
    colour of its most common opaque neighbour (a flying key cap becomes one colour), or goes when it
    has none. keep: letters allowed alone (highlights, FX)."""
    g = [list(r) for r in rows]
    h, w = len(g), (len(g[0]) if g else 0)

    def at(x, y):
        return g[y][x] if 0 <= x < w and 0 <= y < h else '.'
    for _ in range(3):
        changed = False
        for y in range(h):
            for x in range(w):
                c = g[y][x]
                if c == '.' or c in keep:
                    continue
                n8 = [at(x + dx, y + dy) for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dx or dy]
                if c in n8:
                    continue
                if '.' not in (at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)):
                    continue
                opq = [q for q in n8 if q != '.' and q not in keep]
                if opq:
                    g[y][x] = max(sorted(set(opq)), key=opq.count)
                else:
                    g[y][x] = '.'
                changed = True
        if not changed:
            break
    return [''.join(r) for r in g]
