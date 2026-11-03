# Pose -> 1x sprite. A pose names hand-drawn parts and places joints; limbs are solved with two-bone IK.
# Layers as in the reference build: 'lower' (legs + shoes) and 'upper' (torso, head, arms, hand items)
# are separate sprites joined at the pelvis at run time; 'full' draws both as one sprite (deaths).
import math
from rig import Canvas, ik, rotsprite, RX, RY, W, H, PAL
import parts as P

RAMP = {
  'leg': ['P', 'p', 'o', 'O'], 'legF': ['p', 'o', 'O', 'O'],
  'arm': ['J', 'j', 'q', 'Q'], 'armF': ['j', 'q', 'Q', 'Q'],
}
CUT = {'leg': (0.74, 0.42, 0.10), 'legF': (0.80, 0.48, 0.14), 'arm': (0.66, 0.36, 0.06), 'armF': (0.78, 0.46, 0.12)}
THIGH, SHIN = 7.0, 6.5
UPPER, FORE = 5.5, 5.0
PEL_DY = 0          # per hero: moves the pelvis (and so the whole body) down by this many logical px

# Per-hero hooks (a hero module sets them; None = VINCENT's plain build):
#  'pat'(part, u, v, k, ch) -> ch   cloth pattern on limb tubes (logical units, see rig.Canvas.tube)
#  'back'(cv, X, p, meta, z)        draws the back layer (a cape) behind the body; meta has 'torso',
#                                   'head', 'pel' anchors (logical) of this pose
#  'post'(cv, X, p, layer, meta)    any extra drawing before the outline pass
# RAMP may also get 'arm2' / 'armF2' / 'leg2' / 'legF2': the forearm / shin ramp (sleeves, shorts).
HOOKS = {'pat': None, 'back': None, 'post': None}

class Ctx:
    """Resolution context: all pose maths stays in 1x (logical) units; drawing maps to the canvas at
    scale S (pixel centres: c = S * p + (S - 1) / 2) with parts drawn natively at that scale."""
    def __init__(s, S):
        s.S = S
        if S == 1:
            s.P = P
        else:
            import parts2            # VINCENT's 2x set; only loaded for S = 2
            s.P = parts2
        s.o = (S - 1) / 2

    def m(s, p):
        return (s.S * p[0] + s.o, s.S * p[1] + s.o)

    def inv(s, q):
        return ((q[0] - s.o) / s.S, (q[1] - s.o) / s.S)


def place(cv, X, ra, anchor, at, z, part, flip=False):
    """Place a part so its anchor lands on the logical point 'at'. Returns the logical positions of
    every anchor of the part."""
    rows, an = ra
    ax, ay = an[anchor]
    if flip:
        ax = max(len(r) for r in rows) - 1 - ax
    c = X.m(at)
    x0, y0 = int(round(c[0] - ax)), int(round(c[1] - ay))
    cv.grid(x0, y0, rows, z, part, flip=flip)
    return {k: X.inv((x0 + v[0], y0 + v[1])) for k, v in an.items()}


def crease(cv, X, a, j, b, r, ramp, z, part):
    """Cloth fold at a bent joint: a dark crease on the inner side, a lit cap on the outer side."""
    mx, my = (a[0] + b[0]) / 2 - j[0], (a[1] + b[1]) / 2 - j[1]
    d = math.hypot(mx, my)
    if d < 1.2:
        return
    ix, iy = mx / d, my / d
    tx, ty = -iy, ix                              # along the joint, for a wider fold at 2x
    if X.S == 1:
        marks = [(0.9, 0, 3), (1.6, 0, 2)]
        caps = [(0.8, 0)]
    else:
        marks = [(0.75, 0, 3), (1.05, 0, 3), (1.35, 0, 2), (0.9, 0.5, 3), (0.9, -0.5, 2), (1.6, 0.5, 2)]
        caps = [(0.6, 0), (0.85, 0.5), (0.85, -0.5)]
    for k, t, tone in marks:
        c = X.m((j[0] + ix * (r - k) + tx * t, j[1] + iy * (r - k) + ty * t))
        x, y = int(round(c[0])), int(round(c[1]))
        if 0 <= x < cv.W and 0 <= y < cv.H and cv.p[y][x] == part:
            cv.c[y][x] = ramp[tone]
            cv.proc[y][x] = False
    for k, t in caps:
        c = X.m((j[0] - ix * (r - k) + tx * t, j[1] - iy * (r - k) + ty * t))
        x, y = int(round(c[0])), int(round(c[1]))
        if 0 <= x < cv.W and 0 <= y < cv.H and cv.p[y][x] == part:
            cv.c[y][x] = ramp[0]
            cv.proc[y][x] = False


def tube(cv, X, a, b, ra, rb, ramp, z, part, cut, u0=0.0):
    pf, S = HOOKS['pat'], X.S
    pat = (lambda u, v, k, ch: pf(part, u / S, v / S, k, ch)) if pf else None
    cv.tube(X.m(a), X.m(b), ra * S, rb * S, ramp, z, part, cut=cut, pat=pat, u0=u0 * S)


def leg(cv, X, hip, ank, bend, ramp, z, part, shoe='flat'):
    knee, end = ik(hip, ank, THIGH, SHIN, bend)
    place(cv, X, X.P.SHOES[shoe], 'ankle', end, z - 0.2, part + ':shoe')
    c = CUT[ramp]
    tube(cv, X, hip, knee, 3.0, 2.6, RAMP[ramp], z, part, c)
    tube(cv, X, knee, end, 2.6, 2.1, RAMP.get(ramp + '2', RAMP[ramp]), z, part, c, u0=THIGH)
    crease(cv, X, hip, knee, end, 2.6, RAMP[ramp], z, part)
    return knee, end


def arm(cv, X, sh, hand, bend, ramp, z, part, end=None):
    elbow, wr = ik(sh, hand, UPPER, FORE, bend)
    c = CUT[ramp]
    tube(cv, X, sh, elbow, 2.6, 2.2, RAMP[ramp], z, part, c)
    tube(cv, X, elbow, wr, 2.2, 1.8, RAMP.get(ramp + '2', RAMP[ramp]), z, part, c, u0=UPPER)
    crease(cv, X, sh, elbow, wr, 2.2, RAMP[ramp], z, part)
    info = {'elbow': elbow, 'wrist': wr}
    if end:
        kind, name = end
        lib = {'gun': X.P.GUNS, 'fist': X.P.FISTS, 'hand': X.P.HANDS}[kind]
        info.update(place(cv, X, lib[name], 'wrist', wr, z + 0.5, part + ':' + kind))
        info['wrist'] = wr
    return info


def draw_lower(cv, X, p, pel, R):
    for key, z, ramp in (('legF', 2, 'legF'), ('legN', 3, 'leg')):
        L = p[key]
        hp = L.get('hip', (-2, 0) if key == 'legF' else (2, 0))
        hip = (pel[0] + hp[0], pel[1] + hp[1])
        ank = (R[0] + L['ank'][0], R[1] + L['ank'][1])
        leg(cv, X, hip, ank, L.get('bend', 1), ramp, z, key, L.get('shoe', 'flat'))


def head_part(X, name):
    """The head part for an expression; a missing one falls back along ext.HEAD_FALLBACK (a balloon
    head 'he_x' falls back to 'he_<fallback>', then to the plain head)."""
    H = X.P.HEADS
    if name in H:
        return H[name]
    import ext
    pre = 'he_' if name.startswith('he_') else ''
    base = name[len(pre):]
    for cand in (pre + ext.HEAD_FALLBACK.get(base, 'fwd'), pre + 'fwd', ext.HEAD_FALLBACK.get(base, 'fwd'), 'fwd'):
        if cand in H:
            return H[cand]
    return H['fwd']


def draw_upper(cv, X, p, pel, zu, meta):
    to = p.get('tor', (0, 0))
    an = place(cv, X, X.P.TORSOS[p.get('torso', 'up')], 'pelvis', (pel[0] + to[0], pel[1] + to[1]), zu + 4, 'torso')
    neck, shN, shF = an['neck'], an['shN'], an['shF']
    meta['torso'] = an
    hd = p.get('hd', (0, 0))
    meta['head'] = place(cv, X, head_part(X, p.get('head', 'fwd')), 'neck', (neck[0] + hd[0], neck[1] + hd[1]), zu + 5, 'head')
    for key, z, ramp, sh in (('armF', 1, 'armF', shF), ('armN', 6, 'arm', shN)):
        A = p.get(key)
        if not A:
            continue
        so = A.get('sh', (0, 0))
        s = (sh[0] + so[0], sh[1] + so[1])
        hand = (s[0] + A['hand'][0], s[1] + A['hand'][1])
        meta[key] = arm(cv, X, s, hand, A.get('bend', -1), ramp, zu + A.get('z', z), key, A.get('end'))


def compose(p, layer='full', S=1):
    """Returns (rows, meta) at scale S. meta points are logical (1x) canvas coordinates: 'pel' the
    pelvis, 'root' the ground point, plus named points (muzzle, wrist, tip). p['rot'] (full layer)
    turns the upper body around the pelvis (degrees, positive = falls backwards)."""
    X = Ctx(S)
    cv = Canvas(W * S, H * S)
    R = (RX, RY)
    po = p.get('pelvis', (0, -17))
    pel = (R[0] + po[0], R[1] + po[1] + PEL_DY)
    meta = {'pel': pel, 'root': R}
    back = HOOKS['back']
    if layer == 'back':                              # the cape layer: drawn behind lower + upper
        if not back:
            return None, meta
        draw_upper(Canvas(W * S, H * S), X, p, pel, 0, meta)
        back(cv, X, p, meta, -2)
        rows = cv.finish()
        return (rows if any(r.strip('.') for r in rows) else None), meta
    if layer in ('lower', 'full'):
        draw_lower(cv, X, p, pel, R)
    if layer in ('upper', 'full'):
        zu = 10 if layer == 'full' else 0
        rot = p.get('rot', 0)
        if rot and layer == 'full':
            uc = Canvas(W * S, H * S)
            draw_upper(uc, X, p, pel, zu, meta)
            rows = rotsprite(uc.finish(outline=False), X.m(pel), rot)
            if back:
                bc = Canvas(W * S, H * S)
                back(bc, X, p, meta, -2)
                cv.grid(0, 0, rotsprite(bc.finish(outline=False), X.m(pel), rot), -2, 'back')
            cv.grid(0, 0, rows, zu + 4, 'upper')
        else:
            draw_upper(cv, X, p, pel, zu, meta)
            if back and layer == 'full':
                back(cv, X, p, meta, -2)
    if HOOKS['post']:
        HOOKS['post'](cv, X, p, layer, meta)
    for name, at, z in p.get('items', []):          # loose outlined items (grenade, dropped pistol)
        place(cv, X, X.P.ITEMS[name], 'c', (R[0] + at[0], R[1] + at[1]), z, 'item:' + name)
    rows = [list(r) for r in cv.finish()]
    for name, at in p.get('fx', []):                 # glowing effects on top, no outline
        fr, an = X.P.FX[name]
        if isinstance(at[0], str):                   # ('armN', 'muzzle', dx, dy)
            bx, by = meta[at[0]][at[1]]
            ax, ay = X.m((bx + at[2], by + at[3]))
        else:
            ax, ay = X.m((R[0] + at[0], R[1] + at[1]))
        x0, y0 = int(round(ax - an[0])), int(round(ay - an[1]))
        for j, r in enumerate(fr):
            for i, ch in enumerate(r):
                if ch not in '. ' and 0 <= x0 + i < cv.W and 0 <= y0 + j < cv.H:
                    rows[y0 + j][x0 + i] = ch
    return [''.join(r).translate(MERGE) for r in rows], meta


# shared ramps, as a palette-limited hero does it: hair = jacket ramp, gun dark = outline, teeth = shirt,
# shirt shade = gun light, tie shade = darkest brown, skin lines = beard dark
MERGE = str.maketrans({})   # 23 colours accepted for this spike (user, 2026-11-03); the merge map was
# {'A': 'j', 'H': 'q', 'h': 'Q', 'N': 'K', 'w': 'T', 't': 'g', 'r': 'Q', 'z': 'B'} (15 colours)


# ---------- previews ----------
def to_png(frames, path, scale=8, bg=(153, 217, 234), cols=None, gap=2):
    from PIL import Image
    cols = cols or len(frames)
    nrows = (len(frames) + cols - 1) // cols
    fw = max(len(f[0]) for f in frames)
    fh = max(len(f) for f in frames)
    im = Image.new('RGB', ((fw + gap) * cols * scale, (fh + gap) * nrows * scale), bg)
    px = im.load()
    rgb = {k: tuple(int(v[i:i + 2], 16) for i in (1, 3, 5)) for k, v in PAL.items()}
    for k, rows in enumerate(frames):
        ox = (k % cols) * (fw + gap) * scale
        oy = (k // cols) * (fh + gap) * scale
        for y, r in enumerate(rows):
            for x, ch in enumerate(r):
                if ch in rgb:
                    col = rgb[ch]
                    for yy in range(scale):
                        for xx in range(scale):
                            px[ox + x * scale + xx, oy + y * scale + yy] = col
    im.save(path)


def crop(frames, box):
    x0, y0, x1, y1 = box
    return [[r[x0:x1] for r in f[y0:y1]] for f in frames]


def overlay(lower, upper):
    """Join a lower and an upper sprite drawn on the same canvas (same pelvis): upper wins."""
    return [''.join(u if u != '.' else l for l, u in zip(lr, ur)) for lr, ur in zip(lower, upper)]
