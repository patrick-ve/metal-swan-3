# The rat rig of mission sewers (wave P5, the RATS group): one procedural quadruped shared by the
# four rat sets (runner, leaper, spitter, brute). Drawn at 1x, facing right, lit from the upper
# front like the squad rig: the body is two shaded ellipsoids (rump, chest) with a lighter belly,
# the head a skull ellipsoid with a tapered snout, the legs and the scaly tail shaded tubes
# (rig.Canvas.tube), the eye, nose, teeth, whiskers and claws hand-placed stamps. One selout and one
# warm near-black outline pass (rig.Canvas.finish).
#
# BODY SPACE: x forward (the snout), y down, the ground at y = 0 under the body's centre (the root,
# the engine's 'feet' anchor: the lowest pixel row of the paws' outline is the row above the root).
# A pose moves the parts in body space; the global transform (rot, flip, off, squash) then places
# the whole rat on the canvas (a flip onto its back, a jump arc, a flattening). The light stays
# fixed on screen, so a rat on its back is lit from above too.
import math

import rig

LX, LY, LZ = rig.LIGHT3
CUT = (0.88, 0.62, 0.30)


def shade(nx, ny, nz, cut=CUT):
    l = nx * LX + ny * LY + nz * LZ
    return 0 if l > cut[0] else 1 if l > cut[1] else 2 if l > cut[2] else 3


def rot2(x, y, deg):
    """Rotate (x, y) by deg; deg > 0 turns the snout UP (counter-clockwise on screen, y down)."""
    a = math.radians(-deg)
    c, s = math.cos(a), math.sin(a)
    return x * c - y * s, x * s + y * c


def add(a, b):
    return (a[0] + b[0], a[1] + b[1])


def lerp(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


class Xf:
    """Body space -> canvas. squash (sx, sy) about the ground point first, then the flip (a mirror
    of y about pivot y: on its back), then the rotation about the pivot, then the offset."""

    def __init__(self, root, rot=0.0, pivot=(0.0, -7.0), flip=False, off=(0.0, 0.0), sq=(1.0, 1.0), roll=0.0):
        self.root, self.rot, self.pivot, self.flip, self.off, self.sq = root, rot, pivot, flip, off, sq
        # roll: a turn about the long axis (degrees; 180 = on its back): y scaled by cos about the pivot
        r = math.cos(math.radians(roll))
        self.rl = r if abs(r) > 0.12 else (0.12 if r >= 0 else -0.12)

    def p(self, pt):
        x, y = pt[0] * self.sq[0], pt[1] * self.sq[1]
        px, py = self.pivot
        y = py + (y - py) * self.rl
        if self.flip:
            y = 2 * py - y
        x, y = rot2(x - px, y - py, self.rot)
        return (self.root[0] + px + x + self.off[0], self.root[1] + py + y + self.off[1])

    def inv(self, X, Y):
        px, py = self.pivot
        x, y = X - self.root[0] - self.off[0] - px, Y - self.root[1] - self.off[1] - py
        x, y = rot2(x, y, -self.rot)
        x, y = x + px, y + py
        if self.flip:
            y = 2 * py - y
        y = py + (y - py) / self.rl
        return (x / self.sq[0], y / self.sq[1])

    def d(self, dx, dy):
        """A direction (a normal) body -> screen (no squash)."""
        if self.rl < 0:
            dy = -dy
        if self.flip:
            dy = -dy
        return rot2(dx, dy, self.rot)

    def ang(self, deg):
        """A body-space angle (snout up > 0) -> screen."""
        return (-deg if self.flip else deg) + self.rot

    def scale(self):
        return math.sqrt(abs(self.sq[0] * self.sq[1] * self.rl)) if abs(self.rl) < 0.99 else math.sqrt(abs(self.sq[0] * self.sq[1]))


class Cv(rig.Canvas):
    """rig.Canvas with an ellipsoid, a filled polygon and stamps (letters at canvas cells)."""

    def blob(self, xf, c, rx, ry, ang, ramp, z, part, belly=None, belly_v=0.45, pat=None):
        cx, cy = xf.p(c)
        R = max(rx * abs(xf.sq[0]), ry * abs(xf.sq[1]), rx, ry) + 2
        a = math.radians(-ang)
        ca, sa = math.cos(a), math.sin(a)
        for Y in range(int(cy - R), int(cy + R) + 2):
            for X in range(int(cx - R), int(cx + R) + 2):
                bx, by = xf.inv(X, Y)
                dx, dy = bx - c[0], by - c[1]
                u = (dx * ca + dy * sa) / rx
                v = (-dx * sa + dy * ca) / ry
                q = u * u + v * v
                if q > 1.0:
                    continue
                nz = math.sqrt(1.0 - q)
                nbx, nby = u * ca - v * sa, u * sa + v * ca
                nx, ny = xf.d(nbx, nby)
                k = shade(nx, ny, nz)
                rp = belly if (belly and v > belly_v) else ramp
                ch = rp[k]
                if pat:
                    ch = pat(u, v, k, ch)
                self.px(X, Y, ch, z, part, proc=True)

    def body(self, xf, ells, ramp, z, part, belly=None, belly_v=0.45, pat=None, k=5.0):
        """A smooth union of ellipsoids [(c, rx, ry, ang)]: inside any, the normal a blend of the
        normals weighted by depth inside each (no shading seams where they overlap)."""
        pre = []
        R = 0
        cxs, cys = [], []
        for c, rx, ry, ang in ells:
            a = math.radians(-ang)
            pre.append((c, rx, ry, math.cos(a), math.sin(a)))
            cx, cy = xf.p(c)
            cxs.append(cx)
            cys.append(cy)
            R = max(R, rx, ry, rx * abs(xf.sq[0]), ry * abs(xf.sq[1]))
        R += 2
        for Y in range(int(min(cys) - R), int(max(cys) + R) + 2):
            for X in range(int(min(cxs) - R), int(max(cxs) + R) + 2):
                bx, by = xf.inv(X, Y)
                inside = False
                sx = sy = sz = sw = 0.0
                vv = 0.0
                for c, rx, ry, ca, sa in pre:
                    dx, dy = bx - c[0], by - c[1]
                    u = (dx * ca + dy * sa) / rx
                    v = (-dx * sa + dy * ca) / ry
                    q = u * u + v * v
                    if q <= 1.0:
                        inside = True
                    w = math.exp(-k * q)
                    nz = math.sqrt(max(0.0, 1.0 - q))
                    sx += w * (u * ca - v * sa)
                    sy += w * (u * sa + v * ca)
                    sz += w * nz
                    sw += w
                    vv += w * v
                if not inside:
                    continue
                nbx, nby, nz = sx / sw, sy / sw, sz / sw
                ln = math.sqrt(nbx * nbx + nby * nby + nz * nz) or 1.0
                nx, ny = xf.d(nbx / ln, nby / ln)
                kk = shade(nx, ny, nz / ln)
                v = vv / sw
                rp = belly if (belly and v > belly_v) else ramp
                ch = rp[kk]
                if pat:
                    ch = pat(0.0, v, kk, ch)
                self.px(X, Y, ch, z, part, proc=True)

    def tube2(self, xf, a, b, ra, rb, ramp, z, part, pat=None, u0=0.0):
        s = xf.scale()
        self.tube(xf.p(a), xf.p(b), max(0.45, ra * s), max(0.45, rb * s), ramp, z, part, pat=pat, u0=u0)

    def poly(self, pts, ch, z, part):
        """Fill a polygon (canvas coords) with one letter (pixel centres inside)."""
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        n = len(pts)
        for Y in range(int(math.floor(min(ys))), int(math.ceil(max(ys))) + 1):
            for X in range(int(math.floor(min(xs))), int(math.ceil(max(xs))) + 1):
                inside = False
                j = n - 1
                for i in range(n):
                    xi, yi = pts[i]
                    xj, yj = pts[j]
                    if (yi > Y) != (yj > Y) and X < (xj - xi) * (Y - yi) / (yj - yi + 1e-12) + xi:
                        inside = not inside
                    j = i
                if inside:
                    self.px(X, Y, ch, z, part)

    def stamp(self, x, y, cells, z, part):
        """cells: [(dx, dy, letter)] at the canvas cell (round(x), round(y))."""
        X0, Y0 = int(math.floor(x + 0.5)), int(math.floor(y + 0.5))
        for dx, dy, ch in cells:
            self.px(X0 + dx, Y0 + dy, ch, z, part)


# ------------------------------------------------------------------------------------- the looks
class Look:
    """A rat's build (body space, facing right) and its letters. Ramps: [highlight, light, base,
    shade]. Every length is in 1x pixels at the rat's own size."""

    def __init__(self, **kw):
        self.__dict__.update(kw)


def far(ramp):
    """The far legs: a step darker."""
    return [ramp[1], ramp[2], ramp[3], ramp[3]]


# ------------------------------------------------------------------------------------- the pose
DEFAULT = dict(
    crouch=0.0,      # the torso lower (px), the feet stay
    arch=0.0,        # the back arched up (gallop gather): rump up and in, chest in
    stretch=0.0,     # the chest and head forward, the rump back (gallop extension, a lunge)
    rear=0.0,        # degrees: the front half rotated up about the hind hips (rearing up, sitting up)
    lift=0.0,        # the whole torso up (px) with the feet where they are (a jump, a hop)
    puff=0.0,        # the body rounder (breathing, the spitter's gulp): px on the radii
    head=0.0,        # head angle (deg, snout up > 0)
    hx=0.0, hy=0.0,  # head offset (px)
    mouth=0.0,       # 0 shut, 1 open, 2 wide (degrees of the jaw: 0 / 22 / 40)
    eye='open',      # open, wide, shut, happy, x, squint
    ear=0.0,         # ear angle: 0 up, < 0 laid back (hiss, cower)
    cheek=0.0,       # the spitter's cheek pouches (px)
    tongue=False,    # the cartoon tongue (dead)
    tail=None,       # list of segment bend angles (deg) or None: the look's rest curve
    tailroot=0.0,    # the tail's base angle offset (deg, up > 0)
    hn=(0, 0), hf=(0, 0), fn=(0, 0), ff=(0, 0),   # foot targets: offsets from the rest feet
    hnup=0.0, hfup=0.0, fnup=0.0, ffup=0.0,       # the paw tilt (deg) of a lifted foot
    paws=None,       # fore paws to a point (body space, both): grooming, boxing
    belly_up=False,  # (internal) on its back
    rot=0.0, flip=False, off=(0.0, 0.0), sq=(1.0, 1.0), pivot=None, roll=0.0,
    headonly=False, skull_at=(0.0, 0.0),
    bellyv=None,     # the belly line override (on its back: more belly shows)
    hole=None,       # rising out of a hole: the cut row (canvas y) and the rim half width
    slime=0,         # a green slime puddle under a dead rat (width px)
    puffs=(),        # FX puff cells around: [(x, y, letter)] body space
    drool=0,         # slime drool from the mouth (spitter)
    blob=None,       # a slime ball at the mouth (spitter spit): radius
    scars=True,
    steam=(),        # unused (the steam is the game's particles)
)


def pose(**kw):
    p = dict(DEFAULT)
    for k, v in kw.items():
        if k not in DEFAULT:
            raise KeyError(k)
        p[k] = v
    return p


def draw(L, p, W=None, H=None, RX=None, RY=None):
    """Draw one frame. Returns (rows, root, pts, joints) in canvas (rows) coordinates."""
    W = W or L.W
    H = H or L.H
    RX = L.RX if RX is None else RX
    RY = L.RY if RY is None else RY
    cv = Cv(W, H)
    piv = p['pivot'] or L.pivot
    xf = Xf((RX, RY), rot=p['rot'], pivot=piv, flip=p['flip'], off=p['off'], sq=p['sq'], roll=p['roll'])

    cr, ar, st, lift = p['crouch'], p['arch'], p['stretch'], p['lift']
    pf = p['puff']
    # torso centres
    rump = (L.rump[0] - st * 0.35 + ar * 0.3, L.rump[1] + cr - ar - lift)
    chest = (L.chest[0] + st - ar * 0.6, L.chest[1] + cr + ar * 0.35 - lift)
    hip = (rump[0] + L.hip[0], rump[1] + L.hip[1])
    rear = p['rear']

    def front(pt):
        """The front half rotated up about the hip (rearing)."""
        if not rear:
            return pt
        x, y = rot2(pt[0] - hip[0], pt[1] - hip[1], rear)
        return (hip[0] + x, hip[1] + y)

    chest_r = front(chest)
    sh = front((chest[0] + L.shoulder[0], chest[1] + L.shoulder[1]))
    skull = front((chest[0] + L.neck[0] + p['hx'], chest[1] + L.neck[1] + p['hy']))
    hang = p['head'] + rear
    body_ang = rear * 0.55

    # the feet: rest + offsets (the hind feet on the ground; the fore paws follow the front half)
    def foot(rest, off, follow):
        f = (rest[0] + off[0], rest[1] + off[1])
        return front(f) if follow else f

    fore_follow = rear > 25
    hn = foot(L.hfoot, p['hn'], False)
    hf = foot((L.hfoot[0] + L.farx, L.hfoot[1]), p['hf'], False)
    fn = foot(L.ffoot, p['fn'], fore_follow)
    ff = foot((L.ffoot[0] + L.farx, L.ffoot[1]), p['ff'], fore_follow)
    if p['paws'] is not None:
        fn = p['paws']
        ff = (p['paws'][0] - 1.0, p['paws'][1] + 0.5)

    F = L.fur
    Fb = L.belly
    Fk = far(F)
    Pk = L.pink
    if p['headonly']:
        # the head alone (a leaper in a pipe mouth or a grate): the fore paws on the rim
        skull = p['skull_at']
        hang = p['head']
        for dx in (0.0, 2.6):
            a0 = (skull[0] + 0.5 + dx, skull[1] + L.skull_r[1] + 0.6)
            cv.tube2(xf, a0, (a0[0] + 1.6, a0[1] + 0.3), L.paw_r, L.paw_r * 0.8, Pk if dx else far(Pk), 7.5 if dx else 6.5, 'paw%d' % int(dx))
    else:
        # ---- the tail (behind everything near)
        tail_pts = []
        t0 = (rump[0] - L.rump_r[0] * 0.85, rump[1] - L.rump_r[1] * 0.05)
        bends = p['tail'] if p['tail'] is not None else L.tail_bend
        a = L.tail_ang + p['tailroot']
        seg = L.tail_len / len(bends)
        pt = t0
        tail_pts.append(pt)
        for b in bends:
            a += b
            dx, dy = rot2(-seg, 0.0, -a)
            pt = (pt[0] + dx, pt[1] + dy)
            if pt[1] > -1.4 * L.sc and not p['roll'] and not p['flip']:
                pt = (pt[0], -1.4 * L.sc)          # the tail drags on the floor, never through it
            tail_pts.append(pt)
        n = len(tail_pts) - 1
        for i in range(n):
            ra = L.tail_r[0] + (L.tail_r[1] - L.tail_r[0]) * i / n
            rb = L.tail_r[0] + (L.tail_r[1] - L.tail_r[0]) * (i + 1) / n

            def ring(u, v, k, ch, _i=i):
                return Pk[min(3, k + 1)] if int(u) % 3 == 2 and k < 3 else ch
            cv.tube2(xf, tail_pts[i], tail_pts[i + 1], ra, rb, Pk, 2.0 - i * 0.01, 'tail', pat=ring, u0=i * seg)

        # ---- legs: far side first (behind the body)
        def hind(foot_pt, ramp, z, part, up):
            hipp = (hip[0] + (L.farx if part.endswith('F') else 0), hip[1])
            toe = foot_pt
            heel = add(toe, rot2(-L.hfoot_len, 0.0, up))
            cv.tube2(xf, hipp, heel, L.thigh_r, L.shin_r, ramp, z, part)
            cv.tube2(xf, heel, toe, L.paw_r, L.paw_r * 0.8, Pk if 'N' in part else far(Pk), z + 0.05, part)
            return heel

        def fore(paw_pt, ramp, z, part, up):
            s0 = (sh[0] + (L.farx if part.endswith('F') else 0), sh[1])
            # an elbow: bend backward
            l1, l2 = L.arm
            el, end = rig.ik(s0, paw_pt, l1, l2, -1)
            cv.tube2(xf, s0, el, L.arm_r[0], L.arm_r[1], ramp, z, part)
            cv.tube2(xf, el, end, L.arm_r[1], L.arm_r[1] * 0.9, ramp, z, part)
            tip = add(end, rot2(L.fpaw_len, 0.0, up))
            cv.tube2(xf, end, tip, L.paw_r, L.paw_r * 0.75, Pk if 'N' in part else far(Pk), z + 0.05, part)
            return end

        hind(hf, Fk, 1.0, 'legF', p['hfup'])
        fore(ff, Fk, 1.1, 'armF', p['ffup'])

        # ---- the torso
        pat = L.fur_pat
        mid = lerp(rump, chest_r, 0.5)
        ells = [(rump, L.rump_r[0] + pf, L.rump_r[1] + pf, body_ang * 0.5),
                (chest_r, L.chest_r[0] + pf * 0.6, L.chest_r[1] + pf * 0.6, body_ang),
                ((mid[0], mid[1] + 0.3), abs(chest_r[0] - rump[0]) * 0.5 + 1.5, (L.rump_r[1] + L.chest_r[1]) * 0.5 - 0.3 + pf * 0.8, body_ang * 0.75)]
        cv.body(xf, ells, F, 5.0, 'body', belly=Fb, belly_v=L.belly_v if p['bellyv'] is None else p['bellyv'], pat=pat)
        if L.extra_body:
            L.extra_body(cv, xf, p, dict(rump=rump, chest=chest_r, hip=hip, sh=sh))

        # ---- near legs (over the body)
        hn_heel = hind(hn, F, 6.0, 'legN', p['hnup'])
        fn_end = fore(fn, F, 6.2, 'armN', p['fnup'])

    # ---- the head
    pts = {}
    head_pts = head(cv, xf, L, p, skull, hang)
    pts.update(head_pts)

    if L.extra_head:
        L.extra_head(cv, xf, p, skull, hang)

    rows = cv.finish(outline=True)
    rows = [list(r) for r in rows]
    # after the outline: the whiskers (2-px strokes, never single pixels)
    for (x0, y0), (x1, y1) in head_pts.get('_whisk', []):
        # walk out from inside the head: start at the first empty cell next to the outline
        n = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
        cells = []
        for k in range(n + 1):
            X = int(math.floor(x0 + (x1 - x0) * k / n + 0.5))
            Y = int(math.floor(y0 + (y1 - y0) * k / n + 0.5))
            if cells and (X, Y) not in cells and abs(X - cells[-1][0]) == 1 and abs(Y - cells[-1][1]) == 1:
                cells.append((X, cells[-1][1]))      # 4-connected: a whisker never touches only the outline
            if (X, Y) not in cells:
                cells.append((X, Y))
        out = [c for c in cells if 0 <= c[0] < W and 0 <= c[1] < H and rows[c[1]][c[0]] == '.']
        if out and len(out) >= 2:
            # keep only the run that touches the head (the first empty cells after the outline)
            first = cells.index(out[0])
            run = []
            for c in cells[first:]:
                if 0 <= c[0] < W and 0 <= c[1] < H and rows[c[1]][c[0]] == '.':
                    run.append(c)
                else:
                    break
            if len(run) >= 2:
                for X, Y in run:
                    rows[Y][X] = L.whisker
    pts.pop('_whisk', None)
    # the slime puddle under a dead rat, the puff cells
    if p['slime']:
        sw = p['slime']
        gx = RX + p['off'][0] - 2
        for i in range(-sw // 2, sw // 2 + 1):
            for dy, ch in ((-1, L.slime[1]), (0, L.slime[2])):
                X = int(gx + i)
                Y = RY - 1 + dy
                if abs(i) >= sw // 2 - (1 if dy == -1 else 0):
                    continue
                if 0 <= X < W and 0 <= Y < H and (rows[Y][X] == '.' or dy == 0):
                    rows[Y][X] = ch
        for i in (-sw // 4, sw // 5):
            X, Y = int(gx + i), RY - 2
            if 0 <= X < W and rows[Y][X] == '.':
                rows[Y][X] = L.slime[0]
                if rows[Y][X + 1] == '.':
                    rows[Y][X + 1] = L.slime[1]
    for (x, y, ch) in p['puffs']:
        X, Y = int(round(RX + x)), int(round(RY + y))
        if 0 <= X < W and 0 <= Y < H and rows[Y][X] == '.':
            rows[Y][X] = ch
    if p['hole'] is not None:
        cut, hw = p['hole']
        for Y in range(cut, H):
            rows[Y] = ['.'] * W
        for X in range(int(RX - hw), int(RX + hw) + 1):
            rows[cut][X] = 'K'
    tidy(rows, W, H, set(L.hl) | set(L.fx))
    rows = [''.join(r) for r in rows]

    if p['headonly']:
        return rows, (RX, RY), {'eye': pts['eye']}, {'eye': pts['eye'], 'nose': pts['nose']}
    joints = {
        'eye': pts['eye'], 'nose': pts['nose'],
        'tail': xf.p(tail_pts[-1]), 'tailmid': xf.p(tail_pts[len(tail_pts) // 2]),
        'hindN': xf.p(hn), 'foreN': xf.p(fn), 'rump': xf.p(rump), 'chest': xf.p(chest_r),
    }
    return rows, (RX, RY), {'eye': pts['eye']}, joints


def tidy(rows, W, H, free):
    """The craft rules after compositing: no pixel outside the outline (a non-outline pixel whose
    opaque 4-neighbours are all outline and that touches transparency is removed) and no orphan
    edge pixel (a lone colour on the edge becomes outline). `free`: hl / fx letters (single pixels)."""
    def at(x, y):
        return rows[y][x] if 0 <= x < W and 0 <= y < H else '.'
    for _ in range(3):
        changed = False
        for y in range(H):
            for x in range(W):
                ch = rows[y][x]
                if ch == '.' or ch == 'K' or ch in free:
                    continue
                n4 = [at(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
                if '.' not in n4:
                    continue
                op = [c for c in n4 if c != '.']
                if op and all(c == 'K' for c in op):
                    rows[y][x] = '.'
                    changed = True
                    continue
                if not any(at(x + dx, y + dy) == ch for dx in (-1, 0, 1) for dy in (-1, 0, 1) if dx or dy):
                    rows[y][x] = 'K'
                    changed = True
        # an outline pixel left with no opaque 4-neighbour but outline goes
        for y in range(H):
            for x in range(W):
                if rows[y][x] == 'K' and not any(at(x + dx, y + dy) == 'K' for dx in (-1, 0, 1) for dy in (-1, 0, 1) if dx or dy) \
                        and '.' in [at(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]:
                    rows[y][x] = '.'
                    changed = True
        if not changed:
            break


def head(cv, xf, L, p, skull, hang):
    """The skull, snout, jaw, ears, cheeks and the stamps. Returns the points (canvas)."""
    F, Pk = L.fur, L.pink
    hr = L.skull_r
    z = 7.0
    # the far ear (behind the skull)
    ear_a = hang + p['ear']
    ef = add(skull, rot2(L.ear_at[0] - 1.4, L.ear_at[1] + 0.4, ear_a))
    cv.blob(xf, ef, L.ear_r[0], L.ear_r[1], ear_a + 10, far(L.earramp), 6.6, 'earF')
    # skull
    cv.blob(xf, skull, hr[0], hr[1], hang, F, z, 'head', belly=L.belly, belly_v=0.55, pat=L.fur_pat)
    # snout: a tapered tube forward-down
    s0 = add(skull, rot2(L.snout_at[0], L.snout_at[1], hang))
    s1 = add(skull, rot2(L.snout_at[0] + L.snout_len, L.snout_at[1] + L.snout_drop, hang))
    cv.tube2(xf, s0, s1, L.snout_r[0], L.snout_r[1], F, z + 0.1, 'head')
    # the jaw (open mouth): a smaller tube rotated down about the jaw hinge
    jaw_deg = [0, 22, 40][int(p['mouth'])] if p['mouth'] in (0, 1, 2) else p['mouth']
    hinge = add(skull, rot2(L.snout_at[0] - 0.5, L.snout_at[1] + L.snout_r[0] * 0.75, hang))
    jlen = L.snout_len * 0.8
    jt = add(hinge, rot2(jlen, 0.6, hang - jaw_deg))
    pts = {}
    if jaw_deg > 0:
        # the inside of the mouth
        up_t = add(skull, rot2(L.snout_at[0] + L.snout_len * 0.95, L.snout_at[1] + L.snout_drop + L.snout_r[1] * 0.5, hang))
        cv.poly([xf.p(hinge), xf.p(up_t), xf.p(jt)], L.mouth, z + 0.05, 'mouth')
        cv.tube2(xf, hinge, jt, L.snout_r[1] * 1.15, L.snout_r[1] * 0.8, far(F), z + 0.02, 'jaw')
        # teeth: the incisors down from the snout tip and up from the jaw tip
        a = xf.p(add(skull, rot2(L.snout_at[0] + L.snout_len * 0.88, L.snout_at[1] + L.snout_drop + L.snout_r[1] + 0.3, hang)))
        cv.stamp(a[0], a[1], L.teeth_dn, z + 0.3, 'teeth')
        b = xf.p(add(jt, rot2(-0.4, -L.snout_r[1] * 0.6 - 0.4, hang - jaw_deg)))
        cv.stamp(b[0], b[1], L.teeth_up, z + 0.3, 'teeth')
        if p['tongue']:
            cv.stamp(*xf.p(add(jt, (0.6, 0.8))), [(0, 0, Pk[1]), (1, 0, Pk[1]), (0, 1, Pk[2])], z + 0.4, 'tongue')
    else:
        # a shut mouth: the incisors show under the snout tip (a buck-tooth line)
        a = xf.p(add(skull, rot2(L.snout_at[0] + L.snout_len * 0.8, L.snout_at[1] + L.snout_drop + L.snout_r[1] + 0.2, hang)))
        cv.stamp(a[0], a[1], L.teeth_shut, z + 0.3, 'teeth')
    # cheek pouches (the spitter)
    if p['cheek'] > 0:
        cc = add(skull, rot2(L.cheek_at[0], L.cheek_at[1], hang))
        cv.blob(xf, cc, 1.6 + p['cheek'] * 0.9, 1.3 + p['cheek'] * 0.8, hang, L.cheekramp, z + 0.2, 'cheek')
    # the near ear (over the skull)
    en = add(skull, rot2(L.ear_at[0], L.ear_at[1], ear_a))
    cv.blob(xf, en, L.ear_r[0], L.ear_r[1], ear_a + 10, L.earramp, z + 0.5, 'ear')
    # the inner ear: a deeper pink hollow (front-lower part of the ear)
    ei = add(en, rot2(0.35 * L.ear_r[0], 0.3 * L.ear_r[1], ear_a))
    cv.blob(xf, ei, L.ear_r[0] * 0.5, L.ear_r[1] * 0.58, ear_a + 10, [Pk[2], Pk[2], Pk[3], Pk[3]], z + 0.52, 'ear')
    # the nose
    tip = xf.p(s1)
    nose_dir = xf.d(*rot2(1.0, 0.0, hang))
    cv.stamp(tip[0] + nose_dir[0] * L.snout_r[1] * 0.7, tip[1] + nose_dir[1] * L.snout_r[1] * 0.7 - 0.3, L.nose, z + 0.6, 'nose')
    pts['nose'] = (tip[0] + nose_dir[0], tip[1] + nose_dir[1])
    # the eye
    e = xf.p(add(skull, rot2(L.eye_at[0], L.eye_at[1], hang)))
    eye = p['eye']
    cells = L.eyes[eye]
    if xf.flip and eye in ('x',):
        cells = L.eyes['x']
    cv.stamp(e[0], e[1], cells, z + 0.7, 'eye')
    pts['eye'] = (e[0] + L.eye_c[0], e[1] + L.eye_c[1])
    # whiskers: from the snout, fanned back-out (drawn after the outline)
    wb = add(skull, rot2(L.snout_at[0] + L.snout_len * 0.6, L.snout_at[1] + L.snout_drop * 0.6, hang))
    ws = []
    for ang, ln in L.whisk:
        q0 = xf.p(wb)
        q1 = xf.p(add(wb, rot2(L.snout_r[0] + 1.0 + ln, 0.0, hang + ang)))
        ws.append((q0, q1))
    pts['_whisk'] = ws
    if p['blob']:
        r = p['blob']
        m = xf.p(add(lerp(hinge, jt, 0.9), rot2(1.5 + r, -0.5, hang - jaw_deg * 0.5)))
        cv.blob(Xf((0, 0)), (m[0], m[1]), r, r * 0.9, 0, L.slime_ramp, z + 0.8, 'fxslime')
    if p['drool']:
        d0 = xf.p(lerp(hinge, jt, 0.7))
        for k in range(int(p['drool'])):
            cv.px(int(round(d0[0])), int(round(d0[1])) + 1 + k, L.slime_ramp[1 if k == 0 else 2], z + 0.8, 'drool')
    return pts
