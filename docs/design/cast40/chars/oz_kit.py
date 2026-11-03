# The dead soldiers of the haunted Oldenzaal mission: one shared body kit for oz-grunt,
# oz-grunt-coat, oz-rifleman, oz-mg, oz-crawler and oz-tide. Rotting grey-green skin, sunken eyes
# with a dim glow, torn faded field-grey cloth, black jackboots, rust. Creepy, readable, no gore.
#
# The one mark: a plain red band on the near upper arm, exactly as the game draws it at 1x (no disc,
# no symbol at this size). Helmets and caps are plain.
#
# Letters (every one recoloured from VINCENT's set, plus a few free letters):
#   K outline | L S s z rotting skin | w eye glow | T t bone, teeth
#   J j q Q field grey (tunic, coat, breeches, limbs; Q also lines and sockets) | C steel helmet light
#   X x v black leather (jackboots, belt, Y-strap) | R r the red band | a k wood | Y rust
#   G g n N gun steel
import math
import castkit as K
from rig import ik

pose = K.pose
P = K.P
A = K.A

PAL = {
  'L': '#c4c898', 'S': '#949c74', 's': '#6c7454', 'z': '#454a36',   # rot: pale yellowed grey-green
  'w': '#e6ec8a',                                                     # the dim glow in the sockets
  'T': '#d6cfaa', 't': '#9c9474',                                     # bone, teeth
  'J': '#8c907e', 'j': '#6a6e5f', 'q': '#4b4f45', 'Q': '#2b2d29',     # faded field grey
  'C': '#a8ad9c',                                                     # helmet steel light
  'X': '#4c4850', 'x': '#2e2b31', 'v': '#1b181d',                     # black leather
  'R': '#a8302a', 'r': '#661c1a',                                     # the band
  'a': '#7c5638', 'k': '#4c3222',                                     # wood
  'Y': '#9a5226',                                                     # rust
  'G': '#a4a8ae', 'g': '#6c7076', 'n': '#43464c', 'N': '#25272b',     # gun steel
}
DARK = {'C': 'q', 'a': 'k', 'k': 'v', 'Y': 'k', 'T': 't', 't': 'z', 'w': 'z',
        'J': 'Q', 'j': 'Q', 'q': 'Q', 'L': 'z', 'S': 'z', 's': 'z', 'X': 'v', 'x': 'v'}


def install():
    K.palette(PAL, dark=DARK)
    pose.RAMP['arm'] = ['J', 'j', 'q', 'Q']
    pose.RAMP['armF'] = ['j', 'q', 'Q', 'Q']
    pose.RAMP['leg'] = ['J', 'j', 'q', 'Q']
    pose.RAMP['legF'] = ['j', 'q', 'Q', 'Q']
    pose.HOOKS['pat'] = cloth
    pose.HOOKS['post'] = post
    for lib in ('HEADS', 'TORSOS', 'SHOES', 'GUNS', 'FISTS', 'HANDS', 'ITEMS'):
        getattr(P, lib).clear()
    P.HEADS.update(HEADS)
    P.TORSOS.update(TORSOS)
    P.SHOES.update(SHOES)
    P.FISTS.update(FISTS)
    P.HANDS.update(HANDS)
    P.GUNS.update(GUNS)


def edit(rows, changes):
    out = [list(r) for r in rows]
    for y, x, s in changes:
        for i, ch in enumerate(s):
            if ch != ' ':
                out[y][x + i] = ch
    return [''.join(r) for r in out]


def g(text):
    return K.grid(text)


def shade(rows, k=1):
    """Darker variant of a part (for the far side or the back of the crowd)."""
    m1 = {'L': 'S', 'S': 's', 's': 'z', 'z': 'Q', 'T': 't', 't': 'z', 'C': 'J', 'J': 'j', 'j': 'q',
          'q': 'Q', 'X': 'x', 'x': 'v', 'R': 'r', 'r': 'Q', 'a': 'k', 'k': 'v', 'Y': 'k', 'G': 'g',
          'g': 'n', 'n': 'N'}
    for _ in range(k):
        rows = [''.join(m1.get(c, c) for c in r) for r in rows]
    return rows


# ---------------------------------------------------------------- noise (deterministic)
def _h(i, j, s):
    v = math.sin(i * 127.1 + j * 311.7 + s * 74.7) * 43758.5453
    return v - math.floor(v)


def noise(x, y, s):
    i, j = math.floor(x), math.floor(y)
    fx, fy = x - i, y - j
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a, b = _h(i, j, s), _h(i + 1, j, s)
    c, d = _h(i, j + 1, s), _h(i + 1, j + 1, s)
    return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy


# ---------------------------------------------------------------- the cloth on the limb tubes
BOOT = ['X', 'x', 'v', 'v']
BAND = ['R', 'R', 'R', 'r']
SEED = {'armN': 1, 'armF': 2, 'legN': 3, 'legF': 4}
OPT = {'boot_u': None, 'band': None, 'tears': True, 'seed': 0, 'cuff_skin': None}


def cloth(part, u, v, k, ch):
    far = part.endswith('F')
    kk = min(3, k + (1 if far else 0))
    if part.startswith('leg'):
        bu = OPT['boot_u'] if OPT['boot_u'] is not None else pose.THIGH + 0.6
        if u > bu:                                    # the jackboot shaft over the shin
            if abs(u - bu) < 0.6 and k <= 1:
                return 'X'                            # the shaft's top rim catches the light
            return BOOT[kk]
    if part == 'armN' and OPT['band'] and OPT['band'][0] <= u <= OPT['band'][1]:
        return BAND[kk]                               # the plain red band (as the game at 1x)
    if part.startswith('arm') and OPT['cuff_skin'] and u > OPT['cuff_skin']:
        return ['S', 's', 'z', 'z'][kk]               # a torn sleeve: the rotting forearm shows
    if OPT['tears']:
        s = SEED.get(part, 5) + OPT['seed']
        n = noise(u * 0.55, v * 0.7 + 2.1, s)
        if n > 0.80 and k < 3:
            return 's' if k < 2 else 'z'              # a torn hole: the rot shows through
        if n < 0.16:
            return ['j', 'q', 'Q', 'Q'][kk]           # grime
    return ch


# ---------------------------------------------------------------- heads (facing right)
# bare rotting head, 14 x 13, neck at (5, 12): sunken socket with a dim glow, the nose rotted to a
# hole, a torn cheek over the teeth, the jaw bone, an ear, a few wisps of hair.
_BARE = g("""
  ....QzzsQ.....
  ..QzsSSSSSs...
  .QzsSSSSSLLS..
  .zsSSsSSSSLLS.
  zQsSSSSSSSSLS.
  zsSsSSSzQQQQS.
  zszQzsSzQwQSL.
  zszQzsSSzQzSSS
  .zszsSsSSSSsQs
  .zzssszSsQQQQ.
  ..zzszsSTtTtz.
  ...zzzsQQQQz..
  ....zzszTTt...
""")
NECK = {'neck': (5, 12)}

# the plain steel helmet: dome, short visor, the flared skirt over the ears and the nape
_HELM = g("""
  ......qjjjjq.....
  ....qjjJJJJCCj...
  ...qjjJJJJJJJCj..
  ..qjjjJJJJJJJJJj.
  ..qjjjjJJJJJJJJJj
  .qqjjjjjjjjjjjjjj
  Qqqqqjjqqqqqqqqqq
  QQQQqQzsSSSzQQSS.
  ..QzzzssSSsQwzSL.
  ...zszsSSSSzzSSSS
  ...zzssSSSSSSsQs.
  ....zzssSsQQQQQ..
  ....zzzsSTtTtTz..
  .....zzszQQQQ....
  ......zzsTTt.....
""")
HNECK = {'neck': (7, 14)}

# the plain field cap: soft crown, short peak
_CAP = g("""
  ...qjjjjjq......
  .qjjJJJJJCj.....
  qjjjJJJJJJJj....
  qqjjjjjjjjjJjq..
  .QqqqqqqqqqqqqQQ
  .zsQsSSSSQQQSS..
  .zszQzsSsQwSL...
  .zszzzsSSSzzSSS.
  ..zszssSSSSSsQs.
  ..zzsssSSsQQQQ..
  ...zzsssSTtTtz..
  ....zzzsQQQQz...
  .....zzszTTt....
""")
CNECK = {'neck': (6, 12)}

HEADS = {
  'bare': (_BARE, NECK),
  'helm': (_HELM, HNECK),
  'cap': (_CAP, CNECK),
}

# ---------------------------------------------------------------- torsos (facing right)
# tunic: four-pocket field tunic, buttons down the front, black belt, a black Y-strap from the near
# shoulder to the belt's front, a torn hole or two.
_TUNIC = g("""
  .qjjQqQJJJ..
  qjjjJQJJqJJ.
  qjjjjJxJJJJJ
  qjqjjJJxqqJJ
  qjqjjJJJxJJJ
  qjjjjqjJJxjJ
  qjsjjqjjqqxj
  qjzjjjjJJJxj
  qqjjjqjjjJjx
  vxxxxxxxXxXv
  .qqqjqqqjjq.
""")
TAN = {'neck': (6, -2), 'pelvis': (6, 9), 'shN': (6.5, 2.5), 'shF': (3.5, 3.0)}

# greatcoat: a long double-breasted coat, the skirt over the thighs to the knees, a back vent
_COAT = g("""
  ..qjjQqQJJJ..
  .qjjjJQJJqJJ.
  .qjjjjJJJJJJJ
  qjjqjjJJJJGJJ
  qjjqjjjJqqJJJ
  qjjqjjjJJJGJJ
  qjjjqjjjJJJJj
  qjjjqjjjqqGJj
  qqjjjqjjjjJjj
  vxxxxxxxxXxXv
  qjjjjqjjjJqJj
  qjjjjqjjjJqJJj
  qjjqjjqjjjJqJJ
  qjjqjjjqjjjqJJj
  qjqjjjjqjjjjqJJj
  Qqjqjjjjqjjjjqjjj
  .QQqqqqqqqqqqQqqq
""")
CAN = {'neck': (7, -2), 'pelvis': (7, 9), 'shN': (7.5, 2.5), 'shF': (4.5, 3.0)}

TORSOS = {'tunic': (_TUNIC, TAN), 'coat': (_COAT, CAN)}
for k in ('tunic', 'coat'):
    TORSOS[k + '_lean'] = P.shear(TORSOS[k], 2)
    TORSOS[k + '_back'] = P.shear(TORSOS[k], -2)

# ---------------------------------------------------------------- jackboot feet
SHOES = {
  'flat': (g("""
    xxxx....
    xxxXx...
    xxxxXXx.
    vvvvvvvv
  """), {'ankle': (2, 0)}),
  'toe': (g("""
    xxx....
    xxxX...
    xxxxXx.
    .vxxxXx
    ..vvvvv
  """), {'ankle': (1, 0)}),
}

# ---------------------------------------------------------------- bony hands (no cuff: the sleeve ends)
FISTS = {
  'fist': (g("""
    SSs
    Sss
    sz.
  """), {'wrist': (0, 1)}),
}
HANDS = {
  # a reaching claw: long bony fingers, the tips hooked
  'claw': (g("""
    .SSLL.
    SSSSSs
    sSs.s.
    .s.s..
  """), {'wrist': (0, 1)}),
  'clawF': (g("""
    .ssSS.
    sssssz
    zsz.z.
    .z.z..
  """), {'wrist': (0, 1)}),
}
GUNS = {}


# ---------------------------------------------------------------- props drawn level, then turned
def rot_part(rows, an, deg, key='wrist'):
    """Turn a hand-drawn part around its anchor 'key' (RotSprite; positive deg = counter-clockwise
    on screen). Returns (rows, anchors) cropped to the result."""
    w = max(len(r) for r in rows)
    rows = [r.ljust(w, '.') for r in rows]
    h = len(rows)
    R = int(math.ceil(math.hypot(w, h))) + 2
    px, py = an[key]
    ox, oy = R - int(px), R - int(py)
    big = [['.'] * (2 * R + 2) for _ in range(2 * R + 2)]
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            big[oy + j][ox + i] = ch
    pv = (ox + px, oy + py)
    out = K.rig.rotsprite([''.join(r) for r in big], pv, deg)
    a = math.radians(deg)
    ca, sa = math.cos(a), math.sin(a)
    an2 = {}
    for k, (x, y) in an.items():
        dx, dy = ox + x - pv[0], oy + y - pv[1]
        an2[k] = (pv[0] + dx * ca + dy * sa, pv[1] - dx * sa + dy * ca)
    x0, y0, x1, y1 = K.bbox(out)
    out = [r[x0:x1] for r in out[y0:y1]]
    return out, {k: (x - x0, y - y0) for k, (x, y) in an2.items()}


# ---------------------------------------------------------------- the rusty bolt rifle (level, muzzle right)
RIFLE = g("""
  ka..........N..........
  kaaak......nYnN........
  kaaaaakknnngnnaaaaaaanGn
  kkkkkk..kkYNkkkkkkkkgnnN
""")
# aimed: the near hand on the stock's wrist, a finger at the trigger
GUNS['rifle'] = (edit(RIFLE + ['........................'], [
    (2, 6, 'SS'), (3, 6, 'SSs'), (4, 6, 'ss'), (4, 9, 's')]), {'wrist': (6, 3), 'muzzle': (24, 2.5)})


# ---------------------------------------------------------------- the band (a clean ring, as the game at 1x)
BAND_AT = [0.55]          # where along the near upper arm (0 shoulder .. 1 elbow)
POST_EXTRA = []           # more post drawers: f(cv, X, p, layer, meta)


def post(cv, X, p, layer, meta):
    if layer in ('upper', 'full') and 'armN' in meta and BAND_AT[0] is not None:
        band(cv, p, meta)
    for f in POST_EXTRA:
        f(cv, X, p, layer, meta)


def band(cv, p, meta):
    so = p['armN'].get('sh', (0, 0))
    sx, sy = meta['torso']['shN']
    sx, sy = sx + so[0], sy + so[1]
    ex, ey = meta['armN']['elbow']
    t = BAND_AT[0]
    cx, cy = sx + (ex - sx) * t, sy + (ey - sy) * t
    vert = abs(ey - sy) >= abs(ex - sx)          # the arm hangs: the band is two rows across it
    tone = {'J': 'R', 'j': 'R', 's': 'R', 'S': 'R', 'q': 'r', 'Q': 'r', 'z': 'r'}
    ix, iy = int(math.floor(cx)), int(math.floor(cy))
    cells = ([(x, y) for y in (iy, iy + 1) for x in range(ix - 4, ix + 5)] if vert else
             [(x, y) for x in (ix, ix + 1) for y in range(iy - 4, iy + 5)])
    L = math.hypot(ex - sx, ey - sy) or 1
    ang = math.degrees(math.atan2(abs(ey - sy), abs(ex - sx)))
    axis_ok = ang < 25 or ang > 65                # near level or upright: the two-row/column band
    if not axis_ok:                                # diagonal: a true perpendicular band
        cells = [(x, y) for y in range(iy - 5, iy + 6) for x in range(ix - 5, ix + 6)]
    rad = 2.6 * LIMB_R['arm'] + 0.2
    for x, y in cells:
        if abs((x - sx) * (ey - sy) - (y - sy) * (ex - sx)) / L > rad:
            continue
        if not (axis_ok or abs(((x + 0.0 - cx) * (ex - sx) + (y + 0.0 - cy) * (ey - sy)) / L) <= 1.0):
            continue
        if 0 <= x < cv.W and 0 <= y < cv.H and cv.p[y][x] == 'armN' and cv.c[y][x] in tone:
            cv.c[y][x] = tone[cv.c[y][x]]
            cv.proc[y][x] = False


# ---------------------------------------------------------------- a big build (the MG brute)
LIMB_R = {'leg': 1.0, 'arm': 1.0}


def _leg(cv, X, hip, ank, bend, ramp, z, part, shoe='flat'):
    knee, end = ik(hip, ank, pose.THIGH, pose.SHIN, bend)
    pose.place(cv, X, X.P.SHOES[shoe], 'ankle', end, z - 0.2, part + ':shoe')
    c, k = pose.CUT[ramp], LIMB_R['leg']
    pose.tube(cv, X, hip, knee, 3.0 * k, 2.6 * k, pose.RAMP[ramp], z, part, c)
    pose.tube(cv, X, knee, end, 2.6 * k, 2.1 * k, pose.RAMP[ramp], z, part, c, u0=pose.THIGH)
    pose.crease(cv, X, hip, knee, end, 2.6 * k, pose.RAMP[ramp], z, part)
    return knee, end


def _arm(cv, X, sh, hand, bend, ramp, z, part, end=None):
    elbow, wr = ik(sh, hand, pose.UPPER, pose.FORE, bend)
    c, k = pose.CUT[ramp], LIMB_R['arm']
    pose.tube(cv, X, sh, elbow, 2.6 * k, 2.2 * k, pose.RAMP[ramp], z, part, c)
    pose.tube(cv, X, elbow, wr, 2.2 * k, 1.8 * k, pose.RAMP[ramp], z, part, c, u0=pose.UPPER)
    pose.crease(cv, X, sh, elbow, wr, 2.2 * k, pose.RAMP[ramp], z, part)
    info = {'elbow': elbow, 'wrist': wr}
    if end:
        kind, name = end
        lib = {'gun': X.P.GUNS, 'fist': X.P.FISTS, 'hand': X.P.HANDS}[kind]
        info.update(pose.place(cv, X, lib[name], 'wrist', wr, z + 0.5, part + ':' + kind))
        info['wrist'] = wr
    return info


def big(leg=1.3, arm=1.3):
    LIMB_R['leg'], LIMB_R['arm'] = leg, arm
    pose.leg, pose.arm = _leg, _arm
