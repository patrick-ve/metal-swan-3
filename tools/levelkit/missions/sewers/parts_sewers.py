# Painters of the sewer (mission `sewers`, sections c, d, e): the brick vault seen across its channel, made for the
# level kit's floor camera (horizon y 60, walk line y 176). Reusable by every sewer section: the ramps, the far wall
# with its bays, the vault rows, the channel water, the near walkway, the side tunnels in perspective (depth slices),
# light shafts under grates, pipe mouths with eyes, outfalls, ladders and manholes, the fatberg, lost things, slime.
#
# The section (cross-section, metres; 13 px per metre x the plane's speed; game liberty: a big storm-sewer vault):
#   near walkway  the walk band, from the screen's lower edge (4 m in front of the walk line) to the coping 2.6 m
#                 behind it (depth 16, y 160, s 0.862)
#   channel       5.0 m of dark water, the coping at depth 16 to the far walkway's face (y 139, s 0.681)
#   far walkway   1.4 m of stone slabs, 0.4 m above the water (y 132-139)
#   far wall      the back wall at S_W = 72/116 = 0.621 (8.07 px/m): 7.4 m from the walkway to the spring line
#                 (60 px: y 132 -> 72), bays of 7.9 m (64 px) between brick pilasters that carry the vault ribs
#   vault         rows from the spring line (y 72, s 0.621) to the top of the frame (y 0, s 1.0): brick courses along
#                 the tunnel, a transverse rib over each pilaster, street grates in the crown (s 0.74-0.78)
#   side tunnels  5 m wide, 6 m tall mouths (40 x 48 px) in the far wall; the floor in true perspective (rows) and
#                 brick rings at depths z 1.15-2.3 behind the wall (planes at S_W / z)
import math
import random
import numpy as np
from PIL import Image
from level import *
from parts4 import tint

# ---------------------------------------------------------------- the lines and planes of the sewer
S_W = 72.0 / 116.0          # the far wall's speed (its foot on row 132)
YWALL, YQ, YW = 132, 136, 139   # wall foot / far coping nosing / water line
YSPRING = 72                # the spring line of the vault (7.4 m above the far walkway)
D_EDGE = 16.0               # the near coping (the walk band's far border), depth 16 = y 160
S_SHAFT = 0.76              # the plane of the crown grates and their light shafts (lands on the water at y 148)
BAY = 64                    # far-wall bay width, plane px (7.9 m)
PIL = 6                     # pilaster width, plane px
TUN_Z = (1.14, 1.30, 1.50, 1.76, 2.08, 2.45)   # the depth slices of a side tunnel (z = 1: the far wall)
PXM = 13.0                  # px per metre at speed 1


def vb_of(s):
    """World depth (px) behind the walk line of a floor point that scrolls at s (negative: in front)."""
    return FF * (1.0 / s - 1.0)


def s_vault(y):
    return 1.0 - (1.0 - S_W) * np.asarray(y, float) / YSPRING


def wall_u(p):
    """World x of a far-wall plane position."""
    return 192 + (p - 192) / S_W


def wall_p(u):
    return 192 + (u - 192) * S_W


# ---------------------------------------------------------------- ramps (daylight local colour, dark -> light)
SR = dict(
    sbrick=ramp(7, .20, .67, .040, .088, .066, 18, 58),        # sewer brick, red-brown stock
    sbrick_b=ramp(7, .13, .50, .018, .036, .040, 196, 128),    # brick blackened and slimed below the tide line
    granite=ramp(7, .24, .82, .010, .016, .022, 250, 92),      # coping and walkway slabs
    klinker=ramp(7, .20, .62, .026, .046, .040, 24, 70),       # walkway paving brick
    slime=ramp(7, .20, .80, .060, .135, .150, 152, 116),       # green slime
    grease=ramp(7, .28, .93, .040, .085, .095, 62, 98),        # fat: tan to cream
    wipe=ramp(7, .46, .98, .012, .014, .020, 250, 100),        # wet wipes
    rust=ramp(7, .18, .68, .040, .110, .118, 28, 64),          # iron rungs, brackets, pipes
    castiron=ramp(7, .12, .55, .014, .022, .020, 236, 196),
    swater=ramp(7, .09, .44, .022, .040, .036, 196, 150),      # channel water body
    void=ramp(7, .05, .30, .012, .020, .020, 230, 196),        # the dark inside pipes and tunnels
    enamel=ramp(7, .20, .70, .060, .140, .110, 262, 238),      # a blue enamel sign
    calc=ramp(7, .44, .96, .010, .018, .026, 250, 96),         # lime bloom, calcite drips
)
for _k in ('moss', 'white', 'wood', 'red', 'yellow', 'green', 'glass', 'black', 'blue'):
    SR[_k] = R[_k]

BAYER = (np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) + 0.5) / 16.0


def bay(xx, yy, level):
    """Ordered dither (air only): True on the share `level` of the detail cells."""
    ix = np.floor(np.asarray(xx, float) * DET + 1e-6).astype(np.int64) % 4
    iy = np.floor(np.asarray(yy, float) * DET + 1e-6).astype(np.int64) % 4
    return BAYER[iy, ix] < level


LIGHTS = dict(shaft=1.0, shaft_w=(14.0, 26.0), mshaft=0.60, mshaft_w=(9.0, 15.0), halo=(0.42, 0.20), halo_r=(22.0, 13.0),
              wall=(0.24, 0.12), walk=(0.34, 0.16), mwall=(0.20, 0.10), mwalk=(0.42, 0.22), rungs=True,
              pool=0.55, pool_r=(11.0, 6.0), streak=0.5, glints=0.35, spill=(0.40, 0.22))


def LT(H, k):
    """A light strength of the hour (H['lights']), else the default of LIGHTS."""
    return H.get('lights', {}).get(k, LIGHTS[k])


def grate_cols(H):
    """The light seen through the bars of a street grate (the neon itself): em['grate'], else the shaft's top tones."""
    em = H['em']
    return em.get('grate', em['shaft'][:2])


def G_of(H, air=0.0, sat=0.30):
    """The grade of a plane: the key of the hour, then `air` of the hour's air."""
    return grader(key=H['KEY'], air=(H['AIR'][0], H['AIR'][1], air, sat) if air else None)


def gramp(name, G):
    return np.array(G(np.array(SR[name], float)), np.uint8)


def emitters(H):
    em = H['em']
    out = [tuple(int(v) for v in snap5(c)) for c in em['shaft'] + em['glow'] + em['eye'] + em.get('grate', [])]
    return out + [tuple(int(v) for v in snap5(c)) for c in EM]


def keepcols(H):
    return [tuple(c) for c in emitters(H)]


# ---------------------------------------------------------------- rows layers (one speed per screen row)
def rows_grid(sec, y0, y1, s0, s1):
    """World x, world depth and speed of every real pixel of a rows layer from y0 to y1 (speed s0 at y0 .. s1)."""
    r0, r1 = P(y0), P(y1)
    n = r1 - r0
    j = np.arange(n)
    sj = s0 + (s1 - s0) * j / max(n - 1, 1)
    Wl = sec.lw(max(s0, s1))
    C = P(Wl)
    ps = (np.arange(C) + 0.5) / U
    u = 192 + (ps[None, :] - 192) / sj[:, None]
    s = np.broadcast_to(sj[:, None], u.shape)
    y = np.broadcast_to(((r0 + j + 0.5) / U)[:, None], u.shape)
    return u, y, s, Wl


def add_rows(sec, lid, y0, y1, s0, s1, frames, Wl, over=False):
    outs = []
    for (rgb, a) in frames:
        L = Layer(Wl, y1 - y0)
        L.a[..., :3] = rgb
        L.a[..., 3] = np.where(a, 255, 0)
        outs.append(L)
    return sec.add(lid, None, s0, y=y0, kind='rows', frames=outs, s0=s0, s1=s1, over=over)


def quantize(rgbs, masks, n):
    """One palette of n colours for the masked pixels of all frames (the water); returns the new rgb arrays."""
    px = np.concatenate([r[m] for r, m in zip(rgbs, masks)], 0)
    if len(px) == 0:
        return rgbs
    im = Image.fromarray(np.clip(px, 0, 255).astype(np.uint8)[None, :, :], 'RGB')
    q = np.asarray(im.quantize(n, method=Image.MEDIANCUT, dither=Image.NONE).convert('RGB'))[0]
    q = snap5(q.astype(float)).astype(np.uint8)
    out, k = [], 0
    for r, m in zip(rgbs, masks):
        r = r.copy(); c = int(m.sum())
        r[m] = q[k:k + c]; k += c
        out.append(r)
    return out


# ---------------------------------------------------------------- the far wall (plane S_W)
def recess(F, x0, kind, seed, B, Bd):
    """One bay: a pilaster at its left edge and a shallow segmental blind arch beside it, painted inside the slot
       [x0, x0 + BAY) only (rows tile: no bay paints into its neighbour). kind 'mouth' leaves the arch to the tunnel."""
    xc = x0 + PIL + (BAY - PIL) / 2.0
    half = (BAY - PIL) / 2.0 - 3
    # the recess: its back face one tone darker than the wall
    xx, yy = grid(x0 + PIL, YSPRING, BAY - PIL, YWALL - YSPRING)
    top = YSPRING + 9 + 6 * ((xx - xc) / half) ** 2
    inside = (np.abs(xx - xc) <= half) & (yy >= top)
    if kind != 'mouth':
        brickfill(F, x0 + PIL, YSPRING, BAY - PIL, YWALL - YSPRING, B, seed + 3, mask=inside, mid=2, lo=0, hi=4, streaks=True)
        # the shade at the top of the recess and down its left jamb (light from above, a little from the left)
        sh = inside & ((yy < top + 1.6) | (np.abs(xx - (xc - half)) < 1.4))
        F.put(x0 + PIL, YSPRING, np.broadcast_to(np.array(B[0], np.uint8), xx.shape + (3,)), sh & ~chk(xx, yy) | (sh & (yy < top + 0.8)))
        lit = inside & (np.abs(xx - (xc + half)) < 0.9) & (yy > top + 2)
        F.put(x0 + PIL, YSPRING, np.broadcast_to(np.array(B[4], np.uint8), xx.shape + (3,)), lit)
        # the arch ring: a band of radial bricks (rowlock), lighter, with its joints toward the centre
        ring = (np.abs(xx - xc) <= half + 2.5) & (yy >= top - 3.2) & (yy < top) & (yy >= YSPRING + 4)
        ang = np.arctan2(yy - (top + 40), xx - xc)
        jn = (np.floor(ang * 34 + 0.5) % 2 == 0) & ~chk(xx * 0.5, yy)
        rc = np.where(hash01(np.floor(ang * 17), 1, seed) > 0.7, 5, 4)
        rc = np.where(jn & (U >= 2), 2, rc)
        rc = np.where(yy < top - 2.4, 3, rc)
        F.put(x0 + PIL, YSPRING, np.array(B, np.uint8)[np.clip(rc, 0, 6)], ring)
    # the pilaster: headers and stretchers, a lit left face and a dark right edge; a stone impost under the rib
    brickfill(F, x0, YSPRING, PIL, YWALL - YSPRING, B, seed + 7, mid=4, lo=2, hi=6)
    F.vl(x0, YSPRING + 4, YWALL - YSPRING - 4, B[5], t=TH)
    F.vl(x0 + PIL - TH, YSPRING + 4, YWALL - YSPRING - 4, B[1], t=TH)
    return xc, half


def cornice(F, x0, x1, seed, S):
    """The stone string course at the spring line, with calcite drips under it."""
    F.rect(x0, YSPRING - 2, x1 - x0, 1, S[6])
    F.rect(x0, YSPRING - 1, x1 - x0, 3, S[4])
    F.rect(x0, YSPRING + 2, x1 - x0, 1, S[1])
    rng = random.Random(seed)
    xx, yy = grid(x0, YSPRING - 1, x1 - x0, 3)
    st = (hs(xx, yy, seed) > 0.86)
    F.put(x0, YSPRING - 1, np.broadcast_to(np.array(S[3], np.uint8), xx.shape + (3,)), st)
    x = x0 + rng.uniform(1, 6)
    C = SR['calc']
    while x < x1 - 1:
        n = rng.choice((2, 3, 3, 4, 6))
        F.vl(x, YSPRING + 3, n, C[5], t=TH)
        F.px(x, YSPRING + 3, C[6])
        if rng.random() < 0.4:
            F.vl(x, YSPRING + 3 + n, rng.randint(4, 14), SR['sbrick'][1], t=TH)     # the wet streak under a drip
        x += rng.uniform(3, 11)


def pipe_mouth(F, cx, cy, r, B, seed, eyes=1, info=None):
    """A round side pipe in the wall: a rowlock ring, the dark inside, a tongue of slime below; red eyes are added in
       the light pass (info['eyes'])."""
    V, Sl, Bd = SR['void'], SR['slime'], SR['sbrick_b']
    # the stain below the mouth: a flat fan of wet, darkened brick spreading down to the walkway (the brick stays
    # visible under it), a darker wet edge, thin slime streaks with drip ends; nothing stands out of the wall
    hgt = YWALL - cy
    xx, yy = grid(cx - r - 9, cy, 2 * r + 18, hgt)
    dy = yy - cy
    half = r * 0.75 + dy * 0.22 + (vnoise(yy / 4.0, xx * 0, seed) - 0.5) * 2.0
    fan = (np.abs(xx - cx) < half) & (hs(xx * 0.3, yy * 0.15, seed + 1) > 0.05)
    v = F.view(cx - r - 9, cy, 2 * r + 18, hgt)
    if v.shape[:2] == xx.shape:
        has = v[..., 3] > 0
        stain = np.array(Bd[1], float)
        fm = fan & has
        px = v[..., :3][fm].astype(float)
        v[..., :3][fm] = snap5(px + (stain - px) * 0.50)
        edge = has & (np.abs(np.abs(xx - cx) - half) < 0.6) & (dy > r)
        v[..., :3][edge] = Bd[0]
        # slime streaks: one or two px wide, of different lengths, a lit drip at each end
        rng = random.Random(seed + 2)
        for k in range(int(3 + r)):
            sx = cx + rng.uniform(-1, 1) * (r * 0.7)
            ln = rng.uniform(0.25, 1.0) * hgt
            wob = (vnoise(yy / 3.0, np.full(xx.shape, k * 1.0), seed + 3 + k) - 0.5) * 1.6
            stk = has & (np.abs(xx - sx - wob - (sx - cx) * dy / 30.0) < (0.5 if k % 3 else 0.9)) & (dy < ln) & (dy > r * 0.7)
            v[..., :3][stk] = Sl[2 + (k % 2)]
            tip = has & (np.abs(xx - sx - (sx - cx) * ln / 30.0) < 0.7) & (np.abs(dy - ln) < 0.7)
            v[..., :3][tip] = Sl[5]
        lip = has & (dy < r * 0.9) & (np.abs(xx - cx) < r * 0.8)
        v[..., :3][lip] = Sl[3]
    # the ring
    xx, yy = grid(cx - r - 2.5, cy - r - 2.5, 2 * r + 5, 2 * r + 5)
    d = np.hypot(xx - cx, yy - cy)
    ring = (d <= r + 2.2) & (d > r)
    ang = np.arctan2(yy - cy, xx - cx)
    tone = np.where(np.floor(ang * (r + 2) / 1.6) % 2 == 0, 4, 3) + (yy < cy - r * 0.4) - (yy > cy + r * 0.4)
    tone = np.where((np.abs(d - r - 1.1) < 0.25) & (U >= 4), 2, tone)
    F.put(cx - r - 2.5, cy - r - 2.5, np.array(B, np.uint8)[np.clip(tone, 0, 6)], ring)
    # the inside: dark, a lip of light at the bottom, the deep part darkest above the middle
    ins = d <= r
    vt = np.clip(np.floor(2.6 - (cy - yy) / r * 1.2 - d / r * 1.6 + 0.3 * (hs(xx, yy, seed) > 0.7)), 0, 3).astype(int)
    vt = np.where((yy > cy + r * 0.62) & (d > r * 0.55), 3, vt)
    vt = np.where((yy < cy - r * 0.5) & (d > r * 0.7), 0, vt)
    F.put(cx - r - 2.5, cy - r - 2.5, np.array(V, np.uint8)[vt], ins)
    if info is not None:
        info['carriers'].append(('pipe', cx, cy, r))
        for k in range(eyes):
            ex = cx + (k - (eyes - 1) / 2.0) * r * 0.9
            info['eyes'].append(('far', ex, cy + 0.3, 1.0))


def outfall(F, cx, cy, r, seed, info):
    """An outfall: a cast-iron pipe end with a flange, pouring (the stream is a frames layer, info['pours'])."""
    I, Ru = SR['castiron'], SR['rust']
    F.ellipse(cx, cy, r + 1.4, r + 1.6, Ru[2])
    F.ellipse(cx - 0.3, cy - 0.3, r + 1.0, r + 1.2, Ru[4])
    F.ellipse(cx, cy, r, r, I[1])
    F.ellipse(cx, cy + 0.5, r - 0.8, r - 1.0, SR['void'][1])
    for a in range(0, 360, 60):                                          # the flange bolts
        F.px(cx + (r + 0.9) * math.cos(math.radians(a)) - 0.5, cy + (r + 1.0) * math.sin(math.radians(a)) - 0.5, Ru[5] if a > 180 else Ru[1])
    # rust stain under it on the wall
    xx, yy = grid(cx - r, cy + r, 2 * r, YWALL - cy - r)
    st = (np.abs(xx - cx) < r * (0.9 - (yy - cy) / 40)) & (hs(xx, yy, seed) > 0.35)
    F.put(cx - r, cy + r, np.broadcast_to(np.array(Ru[1], np.uint8), xx.shape + (3,)), st)
    info['pours'].append((cx, cy + r * 0.6, r * 1.3))


def ladder(F, x, y0, y1, seed):
    """Iron step irons in two rails, rusty; a rung every 2.4 px (0.3 m at S_W); its shade on the wall."""
    Ru = SR['rust']
    sh = SR['sbrick'][0]
    F.vl(x + 1.0, y0 + 1, y1 - y0, sh, t=TH)
    F.vl(x + 6.0, y0 + 1, y1 - y0, sh, t=TH)
    F.vl(x, y0, y1 - y0, Ru[3], t=1)
    F.vl(x + 5, y0, y1 - y0, Ru[3], t=1)
    F.vl(x, y0, y1 - y0, Ru[5], t=TH)
    y = y0 + 1.5
    rng = random.Random(seed)
    while y < y1 - 0.5:
        F.hl(x, y, 6, Ru[4] if rng.random() > 0.2 else Ru[2], t=TH if U > 1 else 1)
        F.hl(x + 1, y + (TH if U > 1 else 1), 5, sh, t=TH)
        y += 2.4
    for yb in np.arange(y0 + 4, y1, 12):                               # the wall brackets
        F.rect(x - 1, yb, 1, 1.5, Ru[1]); F.rect(x + 6, yb, 1, 1.5, Ru[1])
    # rust runs down the wall under the brackets
    xx, yy = grid(x - 1, y0, 8, y1 - y0)
    run = ((np.abs(xx - x + 0.5) < 0.5) | (np.abs(xx - x - 6.5) < 0.5)) & (hs(xx, yy * 0.3, seed) > 0.5)
    F.put(x - 1, y0, np.broadcast_to(np.array(Ru[1], np.uint8), xx.shape + (3,)), run)


def manhole(F, xc, B, seed, info):
    """A manhole chimney through the vault just above the spring line: the brick throat, the iron grate of the street at
       its top (light falls in: info['mshafts'], drawn by the light pass and a frames layer), the ladder below it."""
    x0, w, ytop = xc - 7, 14, YSPRING - 10
    # the brick throat (rises above the cornice: it covers the vault rows there)
    xx, yy = grid(x0 - 2, ytop - 2, w + 4, YSPRING + 4 - ytop + 2)
    throat = (np.abs(xx - xc) <= 9) & (yy >= ytop - 1.5 + 2 * ((xx - xc) / 9) ** 2)
    brickfill(F, x0 - 2, ytop - 2, w + 4, YSPRING + 4 - ytop + 2, B, seed, mask=throat, mid=3, lo=1, hi=5)
    hole = (np.abs(xx - xc) <= 7) & (yy >= ytop + 1.5)
    V = SR['void']
    vt = np.clip(np.floor(1 + (yy - ytop) / 5.0 + (np.abs(xx - xc) < 4)), 0, 3).astype(int)
    F.put(x0 - 2, ytop - 2, np.array(V, np.uint8)[vt], hole & (yy < YSPRING + 4))
    info['grates_far'].append((xc, ytop + 1.5, 14))
    info['mshafts'].append((xc, ytop + 4.5))
    ladder(F, xc - 3, ytop + 3, YWALL, seed + 5)


def sign_exit(F, x, y):
    """A blue enamel plate with a bold white arrow up and the word UIT ('out') under it, beside a ladder."""
    E, W = SR['enamel'], SR['white']
    w, h = 15, 17
    F.rect(x, y, w, h, E[1])
    F.rect(x + 0.5, y + 0.5, w - 1, h - 1, E[3])
    F.hl(x + 0.5, y + 0.5, w - 1, E[4], t=TH)
    cx = x + w / 2.0
    for j in range(5):                                                  # the arrow head: a solid triangle
        F.rect(cx - 0.5 - j, y + 2 + j, 1 + 2 * j, 1, W[5])
    F.rect(cx - 1.5, y + 7, 3, 3.5, W[5])                               # the shaft, three px wide
    text(F, x + 3, y + 11, 'UIT', W[5])
    F.rect(x + 11.5, y + 1.5, 2, 1.5, SR['rust'][2])                    # a chip of rust
    F.rect(x + w, y + 1, 0.5 if U > 1 else 1, h - 1, SR['sbrick'][0])
    F.vl(x + 2, y + h, 6, SR['rust'][1], t=TH)                          # rust run from the screw


def far_walkway(F, x0, x1, seed):
    """The far walkway: stone slabs on top (y 132-136), the coping nosing, the channel wall face to the water (139)."""
    Gr, Bd, Sl = SR['granite'], SR['sbrick_b'], SR['slime']
    xx, yy = grid(x0, YWALL, x1 - x0, YW - YWALL)
    t = 3 + (fbm(xx / 9.0, yy / 2.0, seed, 2) > 0.58) - (fbm(xx / 5.0, yy, seed + 1, 2) < 0.36)
    t = np.where(yy < YWALL + 0.8, 1, t)                                 # the wall's foot in shade
    t = np.where((xx % 11.0) < 0.5 * (1 if U == 1 else 0.6), 1, t)      # slab joints
    wet = (fbm(xx / 14.0, yy / 3.0, seed + 2, 2) > 0.62) & (yy > YWALL + 1)
    t = np.where(wet & chk(xx, yy), np.minimum(t + 2, 6), t)            # a wet sheen
    rgb = np.array(Gr, np.uint8)[np.clip(t, 0, 6)]
    nose = (yy >= YQ - 0.5) & (yy < YQ + 0.5)
    rgb[nose] = Gr[5]
    face = yy >= YQ + 0.5
    ft = np.clip(1 + (hs(xx, yy, seed + 4) > 0.75) + ((yy - YQ) < 1.2), 0, 3)
    rgb[face] = np.array(Bd, np.uint8)[ft][face]
    sl = face & (fbm(xx / 4.0, yy, seed + 5, 2) > 0.5) | ((yy > YW - 1) & (hs(xx, yy, seed + 6) > 0.4))
    rgb[sl] = np.array(Sl, np.uint8)[np.clip(2 + (hs(xx, yy, seed + 7) > 0.6), 0, 6)][sl]
    moss = (yy < YQ) & (yy > YQ - 1.4) & (fbm(xx / 6.0, yy, seed + 8, 2) > 0.6)
    rgb[moss] = np.array(SR['moss'], np.uint8)[3]
    F.put(x0, YWALL, rgb, np.ones(xx.shape, bool))


# The bays of the far wall, left to right (plane slots of BAY px): what each holds.
BAYS = ['pipes', 'manhole', 'tunnel', 'outfall', 'plain', 'tunnel', 'manhole', 'pipes', 'tunnel', 'plain', 'manhole',
        'outfall', 'plain', 'plain', 'plain']


def far_wall(sec, H, seed=11, bays=BAYS, fat=None):
    """The far plane (speed S_W): the wall, its bays, the cornice, the far walkway. Daylight colours; returns the
       layer (not yet graded) and the info of everything the light pass and the other layers need."""
    WF = sec.lw(S_W)
    F = Layer(WF, VIEW_H)
    B, Bd = SR['sbrick'], SR['sbrick_b']
    info = dict(eyes=[], carriers=[], pours=[], mshafts=[], grates_far=[], tunnels=[], bays=[], signs=[])
    rng = random.Random(seed)
    # the wall body, the tide line (blackened, slimed brick below ~1.7 m) and the wet streaks
    brickfill(F, 0, YSPRING, WF, YWALL - YSPRING, B, seed, streaks=True)
    xx, yy = grid(0, YSPRING, WF, YWALL - YSPRING)
    tide = 118 + (vnoise(xx / 7.0, yy * 0, seed + 1) - 0.5) * 4 + (fbm(xx / 2.0, yy * 0, seed + 2, 2) - 0.5) * 2
    low = yy > tide
    lowt = np.clip(2 + (fbm(xx / 8.0, yy / 3.0, seed + 3, 2) > 0.55) - (hs(xx, yy, seed + 4) < 0.18) - ((yy - tide) < 0.8), 0, 4)
    rgb = np.array(Bd, np.uint8)[lowt]
    F.put(0, YSPRING, rgb, low)
    nb = int(math.ceil(WF / BAY))
    for k in range(nb):
        x0 = k * BAY
        kind = bays[k % len(bays)]
        xc, half = recess(F, x0, 'mouth' if kind == 'tunnel' else kind, seed + 10 * k, B, Bd)
        info['bays'].append((x0, BAY, kind))
        if kind == 'pipes':
            pipe_mouth(F, xc - 12, 108, 4.2, B, seed + k, eyes=1, info=info)
            pipe_mouth(F, xc + 10, 115, 3.2, B, seed + k + 1, eyes=1, info=info)
        elif kind == 'manhole':
            manhole(F, xc - 6, B, seed + k, info)
            sign_exit(F, xc + 4, 96)
            info['signs'].append((xc + 4, 96, 15, 17))
        elif kind == 'outfall':
            outfall(F, xc, 117, 3.4, seed + k, info)
            pipe_mouth(F, xc + 17, 100, 2.6, B, seed + k + 2, eyes=1, info=info)
        elif kind == 'plain':
            # moss and a bricked-up old side arch (closed: no hole)
            yy2 = 104
            F.rect(xc - 9, yy2, 18, YWALL - yy2 - 6, B[2])
            brickfill(F, xc - 9, yy2, 18, YWALL - yy2 - 6, SR['sbrick'], seed + k * 3, mid=2, lo=1, hi=3, cw=3)
            F.hl(xc - 10, yy2 - 1, 20, B[4], t=1); F.hl(xc - 10, yy2 - 0.2, 20, B[1], t=TH)
            pipe_mouth(F, xc + 18, 96, 2.4, B, seed + k + 4, eyes=1, info=info)
        elif kind == 'tunnel':
            tunnel_mouth(F, xc, B, seed + k, info)
    # the cast-iron pipe under the cornice, with its brackets on the pilasters and rust below them
    I, Ru = SR['castiron'], SR['rust']
    yp = YSPRING + 4.5
    F.rect(0, yp, WF, 2.5, I[3])
    F.hl(0, yp, WF, I[5], t=TH)
    F.hl(0, yp + 2, WF, I[1], t=TH)
    for k in range(nb):
        bx = k * BAY + PIL / 2
        F.rect(bx - 1, yp - 1, 2.5, 4.5, Ru[3]); F.rect(bx - 1, yp + 3, 2.5, 0.5 if U > 1 else 1, Ru[1])
        F.vl(bx, yp + 3.5, rng.randint(5, 16), Ru[1], t=TH)
        F.rect(k * BAY + 30 + rng.uniform(-6, 6), yp, 1.5, 2.5, I[2])          # a joint collar
    cornice(F, 0, WF, seed + 40, SR['granite'])
    # moss on the cornice and the green tide
    xx, yy = grid(0, YSPRING - 3, WF, 2)
    mm = fbm(xx / 5.0, yy, seed + 41, 2) > 0.62
    F.put(0, YSPRING - 3, np.array(SR['moss'], np.uint8)[np.clip(3 + (hs(xx, yy, 3) > 0.5), 0, 6)], mm)
    far_walkway(F, 0, WF, seed + 50)
    # cut the side tunnels' openings last (the walkway stays in front of them)
    for (pc, hw, crown, spring) in info['tunnels']:
        xx, yy = grid(pc - hw, crown, 2 * hw, YWALL - crown)
        op = ((yy >= spring) | (np.hypot(xx - pc, yy - spring) <= hw)) & (np.abs(xx - pc) <= hw)
        sub_ = F.view(pc - hw, crown, 2 * hw, YWALL - crown)
        if sub_.shape[:2] == op.shape:
            sub_[op] = 0
    return F, info


def tunnel_mouth(F, xc, B, seed, info):
    """A side tunnel's mouth: 5 m wide and tall (40 px), a three-ring rowlock arch with a keystone; the opening is cut
       after the walkway is painted (far_wall), the inside is drawn by tunnel_layers."""
    hw, spring = 20, YWALL - 28
    crown = spring - hw
    xx, yy = grid(xc - hw - 5, crown - 5, 2 * hw + 10, YWALL - crown + 5)
    d = np.hypot(xx - xc, yy - spring)
    ring = (((d <= hw + 4) & (d > hw)) & (yy < spring)) | ((np.abs(xx - xc) <= hw + 4) & (np.abs(xx - xc) > hw) & (yy >= spring))
    ang = np.arctan2(yy - spring, xx - xc)
    tone = np.where(np.floor(ang * 24 + 0.5) % 2 == 0, 4, 3)
    tone = np.where((yy >= spring) & (np.floor(yy / 1.0) % 2 == 0), 4, np.where(yy >= spring, 3, tone))
    tone = np.where((np.abs(d - hw - 1.3) < 0.3) | (np.abs(d - hw - 2.7) < 0.3), 2, tone) if U >= 2 else tone
    tone = tone + (hash01(np.floor(ang * 12), 2, seed) > 0.75) - ((d < hw + 1) & (yy < spring))
    lowr = yy > 118
    tone = np.where(lowr, np.minimum(tone, 2), tone)
    F.put(xc - hw - 5, crown - 5, np.array(B, np.uint8)[np.clip(tone, 0, 6)], ring)
    # the keystone
    F.rect(xc - 2, crown - 4.5, 4, 5, SR['granite'][4]); F.rect(xc - 2, crown - 4.5, 4, 1, SR['granite'][6])
    F.vl(xc + 1.5, crown - 4, 4.5, SR['granite'][2], t=TH)
    info['tunnels'].append((xc, hw, crown, spring))
    info['carriers'].append(('tunnel', xc, crown, hw))


# ---------------------------------------------------------------- the light pass of the far plane (after its grade)
def far_lights(F, info, H, lit=False, grates=()):
    em = H['em']
    S, E = em['shaft'], em['eye']
    # the neon of each crown grate, scattered by the rain, on the wall and the walkway behind its shaft (fixed on the
    # wall: the light falls at the grate's world x) and the green of the water on the channel face
    for ug in grates:
        a1, a2 = LT(H, 'wall')
        tint(F, wall_p(ug), 112, 30, 34, S[3], a1=a1, a2=a2, ymin=YSPRING + 3, ymax=YWALL)
        a1, a2 = LT(H, 'walk')
        tint(F, wall_p(ug), YWALL + 3, 24, 5, S[2], a1=a1, a2=a2, ymin=YWALL)
    xx, yy = grid(0, YQ + 0.5, F.w, YW - YQ - 0.5)
    v = F.view(0, YQ + 0.5, F.w, YW - YQ - 0.5)
    if v.shape[:2] == xx.shape:
        m = (v[..., 3] > 0) & chk(xx, yy)
        px = v[..., :3][m].astype(float)
        v[..., :3][m] = snap5(px + (np.array(em['glow'][1], float) - px) * 0.45 * H.get('glow', 0.58))
    # the street grate at the top of each manhole: iron bars against the pink neon
    for (xc, y, w) in info['grates_far']:
        Gc = grate_cols(H)
        F.rect(xc - w / 2 + 1, y - 0.5, w - 2, 3, Gc[1])
        F.rect(xc - w / 2 + 2, y, w - 4, 1.5, Gc[0])
        F.rect(xc - 2, y, 4, 1, Gc[0])
        for bx in np.arange(xc - w / 2 + 2.2, xc + w / 2 - 1.5, 2.0):
            F.vl(bx, y - 0.5, 3, (20, 14, 22), t=TH)
    for (xc, y) in info['mshafts']:
        a1, a2 = LT(H, 'mwall')
        tint(F, xc, y + 30, 10, 36, S[3], a1=a1, a2=a2, ymin=y + 2, ymax=YQ + 1)          # the shaft's light on the wall
        for yr in np.arange(y + 4.5, YWALL - 1, 2.4):                                      # the rungs catch the light
            if LT(H, 'rungs') or int(yr * 10) % 3 == 0:
                F.hl(xc - 3, yr, 6, S[2] if (int(yr * 10) % 3) else S[1], t=TH)
        a1, a2 = LT(H, 'mwalk')
        tint(F, xc, YWALL + 2, 12, 3.2, S[1], a1=a1, a2=a2, ymin=YWALL)                   # and on the walkway
    for (pc, cy, r) in info['pours']:
        tint(F, pc, YWALL + 2, 9, 2.6, (150, 190, 190), a1=0.22, a2=0.12, ymin=YWALL)     # wet, shining slabs
    # the red eyes, each in its carrier: two dots and a dithered halo
    for (lid, ex, ey, sz) in info['eyes']:
        if lid != 'far':
            continue
        for dx in (-1.0, 1.0):
            glow(F, ex + dx, ey, 2.2, [E[2]])
        for dx in (-1.0, 1.0):
            F.rect(ex + dx - 0.5, ey - 0.5, 1, 1, E[1])
            if U >= 2:
                F.rect(ex + dx - 0.5, ey - 0.5, 0.5, 0.5, E[0])


# ---------------------------------------------------------------- side tunnels in perspective
def tunnel_layers(sec, info, H, lit=False):
    """Each side tunnel: the dark void behind the opening (S_W), its floor in true perspective (a rows layer: a floor
       row at y lies at depth z = 72 / (y - 60) and scrolls at S_W / z), and brick rings at the depths TUN_Z
       (planes at S_W / z, scaled 1 / z about the vanishing point (192, 60)). Red eyes sit on the ledges."""
    G0 = G_of(H, H['air'])
    dark = np.array(H['KEY'][0], float)
    em = H['em']
    tun = info['tunnels']
    # the void: the tunnel's walls seen past the rings, darker toward its deep middle
    WF = sec.lw(S_W)
    V = Layer(WF, VIEW_H)
    Vr = gramp('void', G0)
    Bg = gramp('sbrick_b', G0)
    for (pc, hw, crown, spring) in tun:
        xx, yy = grid(pc - hw, crown, 2 * hw, YWALL - crown)
        op = ((yy >= spring) | (np.hypot(xx - pc, yy - spring) <= hw)) & (np.abs(xx - pc) <= hw)
        side = np.abs(xx - pc) / hw
        t = np.clip(np.floor(side * 3.2 - (YWALL - yy) / 30.0 + 0.6 + 0.4 * (hs(xx * 0.5, yy, 9) > 0.7)), 0, 4).astype(int)
        rgb = Vr[t]
        brick = (side > 0.62) & (hs(xx, np.floor(yy / 1.5), 7) > 0.5) & (yy > crown + 8)
        rgb[brick] = Bg[1]
        V.put(pc - hw, crown, rgb, op)
    sec.add('tunvoid', V, S_W)
    # the floor rows: ledges of stone on both sides, a runnel of glowing water in the middle
    y0, y1 = 84, YWALL
    s0, s1 = S_W * (y0 - 60) / 72.0, S_W
    u, y, s, Wl = rows_grid(sec, y0, y1, s0, s1)
    z = S_W / s
    rgb = np.zeros(u.shape + (3,), np.uint8)
    a = np.zeros(u.shape, bool)
    Gr, Wt = SR['granite'], SR['swater']
    for (pc, hw, crown, spring) in tun:
        uc = wall_u(pc)
        lat = (u - uc) * S_W                              # lateral, in mouth px (z = 1)
        m = np.abs(lat) < hw
        if not m.any():
            continue
        zz = z
        led = np.abs(lat) > 6.5
        lt = 3 + (fbm(lat / 3.0, zz * 8, 3, 2) > 0.6) - (np.abs(np.abs(lat) - 6.5) < 1.2)
        lt = np.where(np.abs(lat) > hw - 1.5, 1, lt)
        wt = 2 + (fbm(lat / 2.0, zz * 14, 5, 2) > 0.58) + (np.abs(lat) < 2.2)
        col = np.where(led[..., None], np.array(Gr, float)[np.clip(lt, 0, 6)], np.array(Wt, float)[np.clip(wt, 0, 6)])
        col = G0(col)
        glow_m = (~led) & (np.abs(lat) < 5)
        col = np.where(glow_m[..., None], col + (np.array(em['glow'][1], float) - col) * (0.18 if lit else 0.30), col)
        # the depth falls into darkness (no light reaches it)
        f = np.clip((zz - 1.0) * 0.85, 0, 0.92)
        f = np.floor(f * 6) / 6
        col = col + (dark - col) * f[..., None]
        rgb[m] = snap5(col[m])
        a |= m
    # eyes on the ledges, deep in (z 1.3-1.6), drawn as emitters on the floor rows
    add_rows(sec, 'tunfloor', y0, y1, s0, s1, [(rgb, a)], Wl)
    # the rings: brick arches at the depths TUN_Z, scaled about (192, 60); eyes on the ledge at the deepest pair
    E = em['eye']
    Bk = SR['sbrick']
    for zi, zr in reversed(list(enumerate(TUN_Z))):
        sp = S_W / zr
        Lr = Layer(sec.lw(sp), VIEW_H)
        f = min(0.92, (zr - 1.0) * 0.85)
        Gz = grader(key=H['KEY'], air=(H['AIR'][0], H['AIR'][1], min(0.9, H['air'] + 0.12 * zr), 0.3))
        Bz = np.array(Gz(np.array(Bk, float)), float)
        Bz = np.array(snap5(Bz + (dark - Bz) * f), np.uint8)
        for (pc, hw, crown, spring) in tun:
            qc = 192 + (pc - 192) / zr
            ys = 60 + (spring - 60) / zr
            yf = 60 + (YWALL - 60) / zr
            r_in, th = hw / zr, max(2.4 / zr, 1.0)
            xx, yy = grid(qc - r_in - th - 1, 60 + (crown - 6 - 60) / zr, 2 * (r_in + th) + 2, yf - (60 + (crown - 6 - 60) / zr))
            d = np.hypot(xx - qc, yy - ys)
            ring = (((d <= r_in + th) & (d > r_in)) & (yy < ys)) | ((np.abs(xx - qc) <= r_in + th) & (np.abs(xx - qc) > r_in) & (yy >= ys) & (yy < yf))
            ang = np.arctan2(yy - ys, xx - qc)
            tone = np.where(np.floor(ang * 20 / zr) % 2 == 0, 4, 3) - (yy > ys + 6 / zr)
            tone = np.where((np.abs(xx - qc) > r_in + th * 0.6) | (d > r_in + th * 0.6), tone - 1, tone)
            Lr.put(qc - r_in - th - 1, 60 + (crown - 6 - 60) / zr, Bz[np.clip(tone, 0, 6)], ring)
        sec.add('tun%d' % (zi + 1), Lr, sp, depth_z=zr)
    # eyes: on a slice of their own depth (z 1.34 and 1.55): a pair low on the ledge, in the tunnel only
    for (ez, sd) in ((1.40, -1), (1.90, 1)):
        sp = S_W / ez
        Le = Layer(sec.lw(sp), VIEW_H)
        for (pc, hw, crown, spring) in tun:
            qc = 192 + (pc - 192 + sd * 12) / ez
            ey = 60 + (YWALL - 3.5 - 60) / ez
            for dx in (-0.9, 0.9):
                glow(Le, qc + dx, ey, 1.8, [E[2]])
            for dx in (-0.9, 0.9):
                Le.rect(qc + dx - 0.5, ey - 0.5, 1, 1, E[1])
        sec.add('eyes%g' % ez, Le, sp, depth_z=ez)
    info['tun_eye_z'] = (1.40, 1.90)


# ---------------------------------------------------------------- the vault (rows from the top of the frame to the spring)
GRATE_V = (0.74, 0.78)       # the speeds of the grate rows in the crown
VAULT_BANDS = 9              # the vault is drawn as this many rows layers: one speed per row, piecewise linear in y


def theta_of_s(s):
    """The angle up the barrel (0 at the spring line, pi/2 at the crown over the viewer) of a vault row of speed s.
       A barrel of radius R seen from the side: the row at angle theta is R sin(theta) above the spring and
       R (1 - cos theta) nearer the viewer, so its speed is S_W + (1 - S_W)(1 - cos theta)."""
    q = np.clip((np.asarray(s, float) - S_W) / (1 - S_W), 0, 1)
    return np.arccos(1 - q)


def s_of_y(y):
    """The speed of the vault at screen row y (y 72: the spring, s = S_W; y 0: s = 1)."""
    t = np.clip((YSPRING - np.asarray(y, float)) / YSPRING, 0, 1)        # sin(theta)
    return S_W + (1 - S_W) * (1 - np.sqrt(1 - t * t))


def y_of_s(s):
    q = np.clip((np.asarray(s, float) - S_W) / (1 - S_W), 0, 1)
    return YSPRING * (1 - np.sqrt(1 - (1 - q) ** 2))


def vault_px(u, y, s, H, grates, ribs, seed=21):
    """One band of the barrel vault seen from below, daylight colours graded per row by its depth. Courses run along
       the tunnel at equal steps of the angle (so they bunch toward the crown); the transverse ribs over the pilasters
       become round arches because every row scrolls at the speed of its place on the barrel."""
    em = H['em']
    th = theta_of_s(s)
    NC = 22.0                                                     # courses per radian
    Ay = th * NC
    course = np.floor(Ay + 1e-6)
    cw = 7.0
    off = (course % 2) * cw / 2
    cell = np.floor((u + off) / cw)
    n1 = fbm(u / 40.0, Ay / 4.0, seed, 3)
    t = 3 + (n1 > 0.66) - (n1 < 0.32) + (hash01(cell, course, seed + 1) > 0.90) - (hash01(cell, course, seed + 2) < 0.08)
    fy = Ay - course
    dyc = 1.0 / np.maximum(np.abs(np.gradient(Ay, axis=0)) * U, 1e-3) if Ay.shape[0] > 1 else np.full(Ay.shape, 2.0 * U)
    fx_ = ((u + off) / cw - cell) * cw * s * U
    if U >= 2:
        jn = (fy * dyc > dyc - 1) | (fx_ > cw * s * U - 1)
        t = t - (jn & (hs(u, y, seed + 3) > 0.25))
    else:
        t = t - ((fy > 0.6) & (dyc > 2.4) & (hs(u, y, seed + 3) > 0.4))
    # shading: the barrel turns away from the light toward the spring line (darker), its middle catches the most
    t = t - (th < 0.30) - (th < 0.14) - (th > 1.35)
    rib = np.zeros(u.shape, bool)
    for ur in ribs:
        dd = u - ur
        inr = np.abs(dd) < 6.5
        rib |= inr
        rt = 4 + ((np.floor(Ay * 1.5) % 2 == 0) & (U >= 2)) - (th < 0.30) - (th < 0.14) + (dd < -4.6) - 2 * (dd > 5.0)
        t = np.where(inr, rt, t)
        t = np.where((dd >= 6.5) & (dd < 9.5), t - 1, t)                  # the rib's shade on the vault
    # water stains: dark wet streaks running down the barrel from each grate and from cracks, slime at their foot
    stain = np.zeros(u.shape, bool)
    srcs = [(g, 1.0) for g in grates] + [(r_ + 37, 1.15) for r_ in ribs[::3]]
    for (us, ths) in srcs:
        w_ = 3.0 + (ths - th) * 9 + (vnoise(th * 9, us, seed + 4) - 0.5) * 4
        stain |= (th < ths) & (np.abs(u - us - (vnoise(th * 5, us * 0.1, seed + 5) - 0.5) * 8) < np.maximum(w_, 0))
    t = np.where(stain & ~rib, t - 1, t)
    wet = (vnoise(u / 2.2, th * 3, seed + 6) > 0.80) & (hs(u, y, seed + 7) > 0.3)
    t = np.where(wet & ~rib, t - 1, t)
    # cracks with roots: a dark crack, root strands hanging toward the spring line (the 'down' of the barrel)
    rng = random.Random(seed + 8)
    root = np.zeros(u.shape, bool)
    crack = np.zeros(u.shape, bool)
    for k in range(9):
        ux, tx = rng.uniform(-150, 1450), rng.uniform(0.75, 1.3)
        crack |= (np.abs(u - ux - (th - tx) * 30 * math.sin(k)) < 0.45 / np.maximum(s, 0.1)) & (np.abs(th - tx) < 0.12)
        for j in range(6):
            ln, ph, dr = rng.uniform(0.15, 0.42), rng.uniform(0, 6), rng.uniform(-14, 14)
            cu = ux + dr * (tx - th) + 2.0 * np.sin(th * 26 + ph)
            root |= (th < tx) & (th > tx - ln) & (np.abs(u - cu) * s * U < (0.75 if U > 1 else 0.6))
    # calcite drips on the joints and under the ribs' lower edge
    calc = (fy < 0.5) & (hash01(np.floor(u / 1.5), course, seed + 9) > 0.993) & ~rib & (th > 0.2)
    calc |= rib & (np.abs(u - np.round(u / 2.3) * 2.3) * s * U < 0.6) & (th < 0.9) & (th > 0.5) & \
        (hash01(np.round(u / 2.3), np.floor(th * 9), seed + 10) > 0.80)                  # stalactites under a rib
    # a cast-iron main and a cable run along the barrel (horizontal), brackets on the ribs
    pipe = np.abs(th - 0.42) < 0.035
    pipe_hi = np.abs(th - 0.448) < 0.008
    pipe_lo = np.abs(th - 0.388) < 0.008
    near_rib = np.zeros(u.shape, bool)
    for ur in ribs:
        near_rib |= np.abs(u - ur) < 2.0
    phase = np.mod(u - ribs[0], ribs[1] - ribs[0]) / (ribs[1] - ribs[0])
    cable = np.abs(th - (0.62 - 0.05 * np.sin(np.pi * phase))) < 0.010 + 0.004 * (U == 1)
    cable2 = np.abs(th - (0.66 - 0.035 * np.sin(np.pi * phase))) < 0.008 + 0.004 * (U == 1)
    rust = (th < 0.385) & (th > 0.30) & near_rib & (hs(u, th * 20, seed + 11) > 0.3)
    return dict(t=t, th=th, rib=rib, stain=stain, root=root, crack=crack, calc=calc, pipe=pipe, pipe_hi=pipe_hi,
                pipe_lo=pipe_lo, cable=cable | cable2, bracket=pipe & near_rib, rust=rust)


def vault_layer(sec, H, grates, ribs, lit=False, seed=21):
    """The barrel vault from the spring line (y 72) to the top of the frame, as VAULT_BANDS rows layers (each one
       speed per row, the speeds following the barrel). Returns the screen rows of the grates (ya, yb)."""
    em = H['em']
    S = em['shaft']
    ys = [round(YSPRING * k / VAULT_BANDS) for k in range(VAULT_BANDS + 1)]
    for b in range(VAULT_BANDS):
        y0, y1 = ys[b], ys[b + 1]
        s0, s1 = float(s_of_y(y0)), float(s_of_y(y1))
        u, y, s, Wl = rows_grid(sec, y0, y1, s0, s1)
        d = vault_px(u, y, s, H, grates, ribs, seed)
        t, th = d['t'], d['th']
        rgb = np.zeros(u.shape + (3,), np.uint8)
        nb = 4
        sb = np.clip(np.floor((s - S_W) / (1 - S_W) * nb), 0, nb - 1)
        for k in range(nb):
            Gb = G_of(H, H['air'] * (1 - (k + 0.5) / nb) * 0.9)
            m = sb == k
            if not m.any():
                continue
            Bb, Sb, Cb = gramp('sbrick', Gb), gramp('slime', Gb), gramp('calc', Gb)
            Ib, Rb, Wd = gramp('castiron', Gb), gramp('rust', Gb), gramp('wood', Gb)
            rgb[m] = Bb[np.clip(t, 0, 6)][m]
            sl = m & d['stain'] & (th < 0.10) & (hs(u, y, seed + 12) > 0.75)
            rgb[sl] = Sb[2]
            rgb[m & d['crack']] = Bb[0]
            rgb[m & d['root']] = Wd[1]
            rgb[m & d['root'] & (hs(u, y, seed + 13) > 0.7)] = Wd[3]
            rgb[m & d['calc']] = Cb[5]
            rgb[m & d['rust']] = Rb[1]
            rgb[m & d['pipe']] = Ib[3]
            rgb[m & d['pipe_hi']] = Ib[5]
            rgb[m & d['pipe_lo']] = Ib[1]
            rgb[m & d['bracket']] = Rb[3]
            rgb[m & d['cable']] = Ib[0]
        # the grates in the crown: an iron frame, bars along the depth, the neon between them, a halo on the bricks
        for ug in grates:
            du = u - ug
            gm = (np.abs(du) < 8.0) & (s >= GRATE_V[0]) & (s < GRATE_V[1])
            if not gm.any():
                gm2 = None
            ed = (s < GRATE_V[0] + 0.004) | (s > GRATE_V[1] - 0.004)
            frame = gm & ((np.abs(du) > 6.8) | ed)
            light = gm & ~frame
            bars = light & (np.abs(((du + 8) % 2.6) - 1.3) > (0.85 if U >= 2 else 0.9))
            rgb[light] = np.array(grate_cols(H), np.uint8)[np.where(np.abs(du) < 3.5, 0, 1)][light]
            rgb[bars] = (26, 18, 30)
            rgb[frame] = gramp('castiron', G_of(H, 0.1))[2]
            sm = (GRATE_V[0] + GRATE_V[1]) / 2
            hr = LT(H, 'halo_r')
            dd = (du / hr[0]) ** 2 + ((s - sm) / (0.055 * hr[1] / 13.0)) ** 2
            inner = (dd < 0.32) | ((dd < 0.5) & chk(u * s, y))
            outer = ((dd < 0.85) | ((dd < 1.0) & chk(u * s, y))) & ~inner
            for mm, aa in ((inner & ~gm, LT(H, 'halo')[0]), (outer & ~gm, LT(H, 'halo')[1])):
                if mm.any() and aa > 0:
                    px = rgb[mm].astype(float)
                    rgb[mm] = snap5(px + (np.array(S[2], float) - px) * aa)
        add_rows(sec, 'vault%d' % b, y0, y1, s0, s1, [(rgb, np.ones(u.shape, bool))], Wl)
    return float(y_of_s(GRATE_V[1])), float(y_of_s(GRATE_V[0]))


def hanging_wipes(L, x, yt, H, seed):
    """Wet wipes and grease strings hanging from a crown grate into the air (drawn on the shaft's plane)."""
    G0 = G_of(H, 0.0)
    Wp, Gs = gramp('wipe', G0), gramp('grease', G0)
    rng = random.Random(seed)
    for k in range(4):
        x0 = x + rng.uniform(-5.5, 5.5)
        ln = rng.uniform(3, 9)
        w0 = rng.uniform(1.0, 2.4)
        xx, yy = grid(x0 - 3, yt, 6, ln + 2)
        t_ = (yy - yt) / ln
        cx = x0 + np.sin(t_ * 3 + k) * 0.6
        wd = w0 * (1 - t_ * 0.6) * (0.75 + 0.5 * hs(xx, yy, seed + k))
        m = (np.abs(xx - cx) < wd) & (t_ <= 1) & (hs(xx * 0.5, yy, seed + 7 + k) > 0.12)
        tone = np.where(xx < cx, 4, 3) - (t_ > 0.7)
        rgb = Wp[np.clip(tone, 0, 6)] if k % 3 else Gs[np.clip(tone, 0, 6)]
        L.put(x0 - 3, yt, rgb, m)


# ---------------------------------------------------------------- the channel water (rows) and the near walkway (floor)
LOST = [  # lost things in the water: (kind, world x, world depth px behind the walk line)
    ('wipes', 70, 52), ('phone', 150, 74), ('keys', 262, 44), ('grease', 330, 82), ('dentures', 405, 58),
    ('wipes', 470, 90), ('stick', 560, 48), ('bottle', 655, 70), ('grease', 735, 60), ('phone', 820, 46),
    ('wipes', 905, 64), ('keys', 975, 86), ('duck', 1010, 50), ('grease', 1080, 70), ('wipes', 1120, 48),
]


def water_px(u, vb, f, H, fx, lit=False, src=None, seed=31):
    """The channel seen from above: dark body, the green glow, the flow, rings from drips, the mirror of the far wall
       near its foot, the neon of each shaft where it lands and its broken streak toward the viewer. Float rgb."""
    em = H['em']
    G0 = G_of(H, 0.0)
    W = np.array(G0(np.array(SR['swater'], float)), float)
    glow = np.array(em['glow'], float)
    flow = u - f * 4.0
    n = fbm(flow / 34.0, vb / 3.2, seed, 3)
    st = fbm(flow / 9.0, vb / 0.9, seed + 1, 2)
    v = 0.17 + (n - 0.5) * 0.8 + (st - 0.5) * 0.30
    idx = np.clip(np.floor(v * 5), 0, 4).astype(int)
    col = W[idx]
    # the glow: low-frequency blobs of green light in the body
    gb = fbm(flow / 60.0, vb / 10.0, seed + 2, 2)
    ga = np.clip((gb - 0.46) * 2.6, 0, 1) * H.get('glow', 0.58) * (0.52 if lit else 1.0)
    ga = np.floor(ga * 4) / 4
    gi = np.clip(np.floor(gb * 3), 0, 2).astype(int)
    col = col + (glow[gi] - col) * ga[..., None]
    # ripples: lens shapes with a light upper rim
    p = fbm(flow / 7.0, vb / 1.4, seed + 3, 2)
    lightm = (p > 0.64) & (vnoise(flow / 3.0, vb / 1.1, seed + 4) > 0.5)
    col = np.where(lightm[..., None], col + (W[5] - col) * 0.30, col)
    # the mirror of the far wall's foot (the walkway's face and its slime), broken
    if src is not None:
        ref = src(u, vb, f)
        if ref is not None:
            rc, rm = ref
            col = np.where(rm[..., None], col + (rc - col) * 0.42, col)
    # drip rings
    rng = random.Random(seed + 9)
    for i in range(70):
        ux, vx = rng.uniform(-200, 1500), rng.uniform(36, 96)
        r = 1.2 + ((f + i) % 3) * 1.4
        d = np.hypot(u - ux, (vb - vx) * 2.4)
        rm = (np.abs(d - r) < 0.45) & (d < 6)
        col = np.where(rm[..., None], col + (W[6] - col) * 0.45, col)
    # each shaft: a pool where it lands, the streak toward the viewer
    S = np.array(em['shaft'], float)
    vg = vb_of(S_SHAFT)
    for ug in fx['grates']:
        pr = LT(H, 'pool_r')
        dd = ((u - ug) / pr[0]) ** 2 + ((vb - vg) / pr[1]) ** 2
        pool = (dd < 0.45) | ((dd < 0.8) & chk(u * 0.7, vb * 0.5))
        col = np.where(pool[..., None], col + (S[1] - col) * LT(H, 'pool'), col)
        wob = 1.6 * np.sin(vb * 0.9 + f * 2.1) + (vnoise(vb / 2.0, f, seed + 11) - 0.5) * 3
        stk = (vb < vg) & (np.abs(u - ug + wob) < 3.2 + (vg - vb) * 0.04) & (hash01(np.floor(vb * 1.6), f + 7, seed + 12) > 0.3)
        col = np.where(stk[..., None], col + (S[2] - col) * LT(H, 'streak'), col)
        core = stk & (np.abs(u - ug + wob) < 1.2)
        col = np.where(core[..., None], col + (S[1] - col) * LT(H, 'streak'), col)
    # the outfalls' foam where they hit the channel
    for ux in fx['pours']:
        dd = ((u - ux) / 9.0) ** 2 + ((vb - 97.0) / 4.0) ** 2
        foam = (dd < 1.0) & (hs(u + f * 3, vb, seed + 13) > 0.45)
        col = np.where(foam[..., None], col + (W[6] * 1.4 - col) * 0.4, col)
    # the fatberg's shade on the water around its foot
    if fx.get('fat_water'):
        u0, v0, v1 = fx['fat_water']
        sh = (u > u0) & (vb > v0) & (vb < v1) & ((u > u0 + 5) | chk(u * 0.7, vb * 0.5))
        col = np.where(sh[..., None], col * 0.55, col)
    # the grease skin around the fatberg
    if fx.get('fat'):
        f0, f1 = fx['fat']
        sk = (u > f0) & (u < f1) & (fbm(u / 6.0, vb / 2.0, seed + 15, 2) > 0.45 - (u - f0) / (f1 - f0) * 0.3)
        Gs = np.array(G0(np.array(SR['grease'], float)), float)
        col = np.where(sk[..., None], Gs[np.clip((fbm(u / 3.0, vb, seed + 16, 2) * 4).astype(int), 0, 3)] * 0.85, col)
    return col


def lost_things(rgb, u, vb, f, H, lit=False):
    """The lost things floating in the channel, drawn after the water's palette (ramp colours, graded)."""
    G0 = G_of(H, 0.0)
    em = H['em']
    def C(name, i):
        return np.array(G0(np.array([SR[name][i]], float))[0], np.uint8)
    for (kind, ux, vx) in LOST:
        bobu = ux + ((f % 3) - 1) * 0.6
        du, dv = u - bobu, vb - vx
        near = (np.abs(du) < 14) & (np.abs(dv) < 8)
        if not near.any():
            continue
        if kind == 'phone':
            body = (np.abs(du) < 3.0) & (np.abs(dv) < 1.6)
            rgb[body] = C('castiron', 1)
            scr = (np.abs(du) < 2.2) & (np.abs(dv) < 1.0)
            rgb[scr] = snap5(np.array((150, 200, 240)) if not lit else np.array((170, 210, 240)))   # the screen still glows
            rgb[(np.abs(du + 2.0) < 0.6) & (np.abs(dv) < 0.4)] = (255, 255, 255)
        elif kind == 'keys':
            ring = np.abs(np.hypot(du, dv * 2) - 1.5) < 0.45
            rgb[ring] = C('white', 4)
            k1 = (du > 1) & (du < 5) & (np.abs(dv - 0.3) < 0.45)
            rgb[k1] = C('yellow', 4)
            k2 = (du > 0.5) & (du < 4) & (np.abs(dv + du * 0.3 + 0.2) < 0.4)
            rgb[k2] = C('white', 5)
        elif kind == 'dentures':
            arc = (np.abs(np.hypot(du, dv * 1.8) - 2.6) < 0.9) & (dv > -0.5)
            rgb[arc] = C('red', 4)
            teeth = (np.abs(np.hypot(du, dv * 1.8) - 2.0) < 0.5) & (dv > -0.3)
            rgb[teeth] = C('white', 6)
        elif kind == 'stick':
            rod = (du > -12) & (du < 6) & (np.abs(dv - du * 0.18) < 0.4)
            rgb[rod] = C('castiron', 2)
            ph = (np.abs(du - 7.5) < 2.2) & (np.abs(dv - 1.4) < 1.3)
            rgb[ph] = C('castiron', 1)
            rgb[(np.abs(du - 7.5) < 1.5) & (np.abs(dv - 1.4) < 0.7)] = snap5(np.array((140, 190, 230)))
        elif kind == 'bottle':
            b = (np.abs(du) < 3.5) & (np.abs(dv) < 1.0)
            rgb[b] = C('green', 3)
            rgb[b & (dv < -0.3)] = C('green', 5)
            rgb[(du > 3.5) & (du < 5) & (np.abs(dv) < 0.5)] = C('green', 2)
        elif kind == 'duck':
            b = np.hypot(du, dv * 1.6) < 2.6
            rgb[b] = C('yellow', 4)
            rgb[b & (dv < -0.6)] = C('yellow', 6)
            rgb[(np.hypot(du - 2.2, dv + 1.4) < 1.0)] = C('yellow', 5)
            rgb[(np.abs(du - 3.4) < 0.7) & (np.abs(dv + 1.2) < 0.4)] = C('red', 4)
        elif kind == 'wipes':
            sh = (fbm(du / 3.0 + ux, dv / 1.5, 3, 2) > 0.45) & (np.hypot(du / 6.0, dv / 3.0) < 1)
            rgb[sh] = C('wipe', 4)
            rgb[sh & (hs(du, dv, 5) > 0.7)] = C('wipe', 3)
            rgb[sh & (dv < -1.2)] = C('wipe', 5)
        elif kind == 'grease':
            sh = (fbm(du / 2.0 + ux, dv, 4, 2) > 0.42) & (np.hypot(du / 5.0, dv / 2.4) < 1)
            rgb[sh] = C('grease', 3)
            rgb[sh & (hs(du, dv, 6) > 0.75)] = C('grease', 5)


def walkway_px(u, vb, H, fx, seed=41):
    """The near walkway (the walk band) seen from above: a granite coping on the channel, brick paving in courses
       along the tunnel, wet patches that take the neon, slime, grime toward the viewer; flat things only."""
    G0 = G_of(H, 0.0)
    K = np.array(G0(np.array(SR['klinker'], float)), np.uint8)
    Gr = np.array(G0(np.array(SR['granite'], float)), np.uint8)
    Sl = np.array(G0(np.array(SR['slime'], float)), np.uint8)
    Wp = np.array(G0(np.array(SR['wipe'], float)), np.uint8)
    vb_edge = vb_of(s_d(D_EDGE))
    j = np.floor(vb / 7.0)
    uu = u / 14.0 + 0.5 * (j % 2)
    i = np.floor(uu)
    fu, fv = uu - i, vb / 7.0 - j
    t = 2 + (hash01(i, j, seed) > 0.66) - (hash01(i, j, seed + 1) > 0.84)
    t = np.where((fv > 0.88) | (fu < 0.04), 0, t)                      # joints
    t = np.where((fv < 0.14) & (fu > 0.06), np.minimum(t + 1, 4), t)   # the lit far edge of each slab
    crack = (np.abs(vnoise(u / 3.0, vb / 9.0, seed + 11) - 0.5) < 0.02) & (hash01(i, j, seed + 12) > 0.6)
    t = np.where(crack, 1, t)
    grime = fbm(u / 40.0, vb / 9.0, seed + 2, 3)
    t = t - (grime < 0.33) + (grime > 0.72)
    t = t - (vb < -16) - (vb < -34)                                       # the nearest rows darkest
    rgb = Gr[np.clip(t, 0, 6)]
    # the coping: granite blocks, a lit top and a rounded nosing at the channel
    cp = vb > vb_edge - 7.5
    ct = 4 + (fbm(u / 6.0, vb, seed + 3, 2) > 0.6) - ((u % 26.0) < 0.6)
    ct = np.where(vb > vb_edge - 1.2, 6, ct)
    ct = np.where((vb > vb_edge - 7.5) & (vb < vb_edge - 6.6), 1, ct)
    rgb[cp] = Gr[np.clip(ct, 0, 6)][cp]
    # slime on the coping and in the joints along the edge, green
    sl = cp & (fbm(u / 7.0, vb / 2.0, seed + 4, 2) > 0.6) & (vb < vb_edge - 1.4)
    rgb[sl] = Sl[np.clip(2 + (hs(u, vb, seed + 5) > 0.6), 0, 6)][sl]
    # puddles: dark water with a thin lit rim; the neon in those under a shaft's spill
    pd = (fbm(u / 22.0, vb / 4.0, seed + 6, 3) > 0.64) & ~cp
    S = H['em']['shaft']
    W = np.array(G0(np.array(SR['swater'], float)), np.uint8)
    rgb[pd] = W[2]
    rgb[pd & (hs(u * 0.5, vb, seed + 7) > 0.82)] = W[5]
    for ug in fx['grates']:
        near = pd & (np.abs(u - ug) < 22)
        gl = near & (np.abs(((vb + u * 0.05) % 2.2) - 1.1) < 0.22) & (hs(u * 0.25, vb, seed + 13) > LT(H, 'glints'))
        rgb[gl] = S[1] if True else S[2]
        rgb[gl & (np.abs(u - ug) > 16)] = S[2]
        # the neon spill on the coping under each shaft
        spill = cp & (((u - ug) / 26.0) ** 2 + ((vb - vb_edge) / 9.0) ** 2 < 1)
        sa, sb = LT(H, 'spill')
        if spill.any():
            px = rgb[spill].astype(float)
            rgb[spill] = snap5(px + (np.array(S[2], float) - px) * np.where(chk(u, vb)[spill], sa, sb)[:, None])
    # slime trails and a wipe or two lying flat on the bricks
    tr = ~cp & (np.abs(vnoise(u / 30.0, vb * 0, seed + 8) * 30 - 15 - (vb - 8)) < 0.9) & (hs(u, vb, seed + 9) > 0.3)
    rgb[tr] = Sl[3]
    for (ux, vx) in ((140, 6), (520, -10), (760, 18), (980, -24)):
        w = (np.hypot((u - ux) / 4.0, (vb - vx) / 2.2) < 1) & (fbm(u / 2.0, vb, int(ux), 2) > 0.4)
        rgb[w] = Wp[4]
        rgb[w & (vb < vx - 0.8)] = Wp[5]
    # the fatberg's shade on the walkway: under its sagging belly and around its foot (light from the grates above)
    if fx.get('fat_shadow'):
        u0, u1, v0, v1 = fx['fat_shadow']
        sh = (u > u0) & (vb > v0) & (vb < v1)
        sh &= (u > u0 + 4) | chk(u, vb)
        if sh.any():
            px = rgb[sh].astype(float)
            rgb[sh] = snap5(px * 0.55 + np.array(H['KEY'][0], float) * 0.45)
    # a drain slot in the walkway every 320 px: an iron grating flush with the bricks
    for ux in range(250, 1300, 320):
        dr = (np.abs(u - ux) < 6) & (np.abs(vb - 14) < 3.2)
        rgb[dr] = gramp('castiron', G0)[1]
        rgb[dr & (np.floor(u * 0.8) % 2 == 0)] = gramp('castiron', G0)[3]
    return rgb


def channel_layers(sec, H, F, fx, lit=False):
    """The water rows from the far walkway's face (y 139) to the floor's back edge (146), and the floor rows (146-216):
       water up to the near coping (depth 16), then the near walkway. Three frames (the flow)."""
    frames = 3
    G0 = G_of(H, 0.0)
    # the mirror source: the far plane's foot (walkway face, slime, the eyes), flipped about the water line
    Fa = F.a

    def src(u, vb, f):
        s = FF / (vb + FF)
        y = 60 + 116 * s
        ys = YW - (y - YW) * 2.4 - 0.5
        ok = (ys >= YSPRING) & (ys < YW)
        px = np.clip(((192 + (u + 1.2 * np.sin(vb * 1.7 + f * 2.1) - 192) * S_W) * U).astype(int), 0, Fa.shape[1] - 1)
        py = np.clip((ys * U).astype(int), 0, Fa.shape[0] - 1)
        c = Fa[py, px]
        m = ok & (c[..., 3] > 0) & (hash01(np.floor(vb * 2), np.floor(u / 3), 61 + f) > 0.25)
        return c[..., :3].astype(float), m
    out = {}
    for lid, y0, y1 in (('water', YW, BACKY), ('floor', BACKY, VIEW_H)):
        s0, s1 = (y0 - 60) / 116.0, (y1 - 60) / 116.0
        u, y, s, Wl = rows_grid(sec, y0, y1, s0, s1)
        vb = vb_of(s)
        vbe = vb_of(s_d(D_EDGE))
        wm = vb > vbe
        rgbs, masks = [], []
        for f in range(frames):
            rgb = np.zeros(u.shape + (3,), float)
            if wm.any():
                rgb[wm] = water_px(u[wm], vb[wm], f, H, fx, lit, src=lambda a, b, ff=f: src(a, b, ff))
            rgbs.append(rgb); masks.append(wm.copy())
        rgbs = quantize(rgbs, masks, 34)
        res = []
        walk = None if lid == 'water' else walkway_px(u, vb, H, fx)
        for f in range(frames):
            r = rgbs[f].astype(np.uint8)
            if walk is not None:
                r[~wm] = walk[~wm]
            # the shade of the coping's lip on the first water row and the lost things
            lost_things(r, u, vb, f, H, lit)
            res.append((r, np.ones(u.shape, bool)))
        out[lid] = add_rows(sec, lid, y0, y1, s0, s1, res, Wl)
    return out


# ---------------------------------------------------------------- light shafts (air: dithered), pours (frames)
def shaft_layer(sec, lid, speed, shafts, H, y_land, w0=14.0, w1=26.0, strength=1.0, frames=3, seed=51):
    """Light shafts: vertical columns of the street's neon falling from a grate (x, y_top on the plane of `speed`) to
       y_land; a dithered core, a sparser rim, rain drops lit inside. Emitter colours, frames for the rain."""
    S = H['em']['shaft']
    Wl = sec.lw(speed)
    outs = []
    for f in range(frames):
        L = Layer(Wl, VIEW_H)
        for (x, yt) in shafts:
            h = y_land - yt
            xx, yy = grid(x - w1, yt, 2 * w1, h)
            t = (yy - yt) / h
            hw = (w0 + (w1 - w0) * t) / 2
            dx = np.abs(xx - x) / hw
            fade = np.clip(1.15 - t * 0.55, 0, 1) * strength
            core = (dx < 0.30) & bay(xx, yy, 0.34 * fade + 0.06)
            mid = (dx >= 0.30) & (dx < 0.66) & bay(xx + 1, yy, 0.17 * fade)
            rim = (dx >= 0.66) & (dx < 1.0) & bay(xx + 2, yy + 1, 0.07 * fade)
            rgb = np.zeros(xx.shape + (3,), np.uint8)
            rgb[core] = S[1]; rgb[mid] = S[2]; rgb[rim] = S[3]
            m = core | mid | rim
            # the rain: short lit streaks, falling one step each frame
            rr = random.Random(seed + int(x))
            for k in range(int(h * 0.40)):
                rx = x + rr.uniform(-hw.max() * 0.9, hw.max() * 0.9) * 0.9
                ry = yt + ((rr.uniform(0, h) + f * h / 3.0 * 0.37 + k * 0.0) % h)
                ln = rr.choice((2.0, 3.0, 4.0))
                drop = (np.abs(xx - rx) < (0.5 if U == 1 else 0.3)) & (yy >= ry) & (yy < min(ry + ln, y_land))
                rgb[drop] = S[0]
                m |= drop
            L.put(x - w1, yt, rgb, m)
            # the splash where it lands
            sp = random.Random(seed + f * 7 + int(x))
            for k in range(5):
                L.px(x + sp.uniform(-hw.max(), hw.max()) * 0.8, y_land - sp.uniform(0.5, 2.5), S[0])
        outs.append(L)
    sec.add(lid, None, speed, kind='frames', frames=outs)
    return outs


def pour_layer(sec, H, info, frames=3, seed=61):
    """The outfalls pour: a stream from the pipe to the walkway, a sheet over the coping into the channel; and each
       side tunnel's runnel spilling over the walkway notch. Water lit by the key; foam lighter."""
    G0 = G_of(H, H['air'] * 0.5)
    Wt = gramp('swater', G0)
    Wh = gramp('white', G0)
    glow = H['em']['glow']
    WF = sec.lw(S_W)
    outs = []
    for f in range(frames):
        L = Layer(WF, VIEW_H)
        for (cx, cy, w) in info['pours']:
            xx, yy = grid(cx - w - 3, cy, 2 * w + 6, YW + 1 - cy)
            fall = (yy < YWALL) & (np.abs(xx - cx) < w * (0.55 + (yy - cy) * 0.012))
            sheet = (yy >= YWALL) & (np.abs(xx - cx) < w * 1.3 + (yy - YWALL) * 0.5)
            st = hash01(np.floor((xx - cx) * DET * 1.5), np.floor((yy - f * 2.0) * 0.7), seed)
            tone = np.where(st > 0.6, 6, np.where(st > 0.3, 5, 4))
            rgb = np.where((tone == 6)[..., None], Wh[5], np.where((tone == 5)[..., None], Wt[6], Wt[4]))
            rgb = np.where(((np.abs(xx - cx) > w * 0.4) & fall)[..., None], Wt[5], rgb)
            sp = (yy > YWALL - 2) & (yy < YWALL + 1.5) & (np.abs(xx - cx) < w * 1.6) & (hs(xx + f, yy, seed + 2) > 0.5)
            L.put(cx - w - 3, cy, rgb.astype(np.uint8), fall | sheet | sp)
        for (pc, hw, crown, spring) in info['tunnels']:
            xx, yy = grid(pc - 7, YWALL, 14, YW - YWALL + 0.5)
            sh = np.abs(xx - pc) < 3.0 + np.clip(yy - YQ, 0, 3) * 0.5
            st = hash01(np.floor(xx * DET * 1.5), np.floor((yy - f * 1.5) * 1.6), seed + 3)
            rgb = np.where((st > 0.62)[..., None], Wt[6], np.where((st > 0.3)[..., None], Wt[4], Wt[3]))
            rgb[(np.abs(xx - pc) < 1.0) & (yy > YQ)] = np.array(glow[1], np.uint8)
            L.put(pc - 7, YWALL, rgb.astype(np.uint8), sh)
        outs.append(L)
    sec.add('pour', None, S_W, kind='frames', frames=outs)


# ---------------------------------------------------------------- the fatberg (three slices: far wall, water, walkway)
def _blur(a, r):
    """Box blur of radius r real px, three passes (about a Gaussian): a soft height from a mask."""
    r = max(1, int(r))
    for _ in range(3):
        for ax in (0, 1):
            p = np.pad(a, [(r + 1, r), (0, 0)] if ax == 0 else [(0, 0), (r + 1, r)], mode='edge')
            c = np.cumsum(p, axis=ax)
            if ax == 0:
                a = (c[2 * r + 1:] - c[:-2 * r - 1]) / (2 * r + 1)
            else:
                a = (c[:, 2 * r + 1:] - c[:, :-2 * r - 1]) / (2 * r + 1)
    return a


SR['fatgrey'] = ramp(7, .20, .78, .014, .030, .034, 70, 100)     # old fat: grey-tan, crusted


def fatberg(w, h, seed=3, kind='front', eye=None):
    """A fatberg slice: a sagging, irregular mass of congealed grease that fills the tunnel section (it meets the vault
       at its top edge). Volume from a soft height field lit from the grates above (dark underside), strata of old grey
       and fresh yellow-white grease with crusted lips, wet shine, grease runs and strands hanging from every
       overhang, wet wipes matted into it as fibres, embedded things (cotton buds, a toothbrush, a rubber duck, a
       phone, a sock), rat holes with red eyes. kind: 'front' (a face on the walkway), 'mid' (in the channel),
       'back' (against the far wall). Returns (Layer, holes [(cx, cy, rx, ry)] in part px)."""
    rng = random.Random(seed)
    L = Layer(w, h)
    xx, yy = grid(0, 0, w, h)
    tn = yy / h
    # ---- the silhouette: a left face that sags into a belly and tucks in above its foot; the top meets the vault
    if kind == 'front':
        xl = w * (0.46 - 0.36 * np.sin(np.pi * 0.82 * np.clip(tn, 0, 1) ** 1.25)) + w * 0.05 * np.clip((tn - 0.86) / 0.14, 0, 1)
        bot = h - 0.5
    elif kind == 'mid':
        xl = w * (0.34 - 0.26 * np.sin(np.pi * np.clip(tn, 0, 1) ** 1.1))
        bot = h - 0.5 - 7 * np.clip(fbm(xx / 14.0, xx * 0, seed + 40, 2) - 0.48, 0, 1) * 4 * (xx < w * 0.55)
    else:
        xl = w * 0.10 * (1 - tn) + 2
        bot = h - 0.5
    xl = xl + (fbm(yy / 26.0, xx * 0 + seed, seed + 1, 3) - 0.5) * w * 0.16 + (fbm(yy / 6.0, xx * 0, seed + 2, 2) - 0.5) * 4.0
    inside = (xx > xl) & (yy < bot)
    # ---- volume: a soft height from the mask, sagging bulges, lumps and fine pits
    D = _blur(inside.astype(float), 9 * U)
    big = fbm(xx / 22.0, yy / 30.0 - xx / 120.0, seed + 3, 3)
    Hh = 16 * D ** 0.7 + 16 * big + 3.0 * fbm(xx / 7.0, yy / 6.0, seed + 4, 3) + 0.9 * fbm(xx / 1.7, yy / 1.7, seed + 5, 2)
    gy, gx = grad(Hh)
    nx, ny, nz = -gx, -gy, np.full_like(Hh, 1.3)
    ln = np.sqrt(nx * nx + ny * ny + nz * nz)
    lx, ly_, lz = -0.30, -0.86, 0.42                                     # the light: the grates above, a little left
    shade = (nx * lx + ny * ly_ + nz * lz) / ln
    under = np.clip(ny / ln, 0, 1)                                       # faces turned down: in shade
    ao = np.clip((tn - 0.80) / 0.2, 0, 1) * 0.30 + np.clip(0.35 - D, 0, 1) * 0.5
    v = 0.48 + 0.48 * shade - 0.35 * under - ao
    # ---- strata: bands that sag with the mass; old grey crust and fresh yellow-white grease
    sag = 22 * fbm(xx / 60.0, yy / 50.0, seed + 6, 3) + 8 * np.sin(np.pi * np.clip(xx / w, 0, 1)) + 6 * big
    bnd = (yy + sag) / 11.0
    bnd = bnd + 0.9 * fbm(xx / 18.0, yy / 9.0, seed + 11, 2)
    k = np.floor(bnd)
    fr = bnd - k
    fresh = (hash01(k, k * 0 + 3, seed + 7) > 0.55) ^ (fbm(xx / 26.0, yy / 20.0, seed + 12, 2) > 0.66)
    tone = np.clip(np.floor(v * 6 + 0.5), 0, 6).astype(int)
    tone = np.where(fresh, np.minimum(tone + 1, 6), tone)
    tone = np.where(fr < 0.06, tone - 2, np.where((fr < 0.11) & (shade > 0.1), tone + 1, tone))     # crust and lip
    tone = np.clip(tone, 0, 6)
    Gs, Gg = np.array(SR['grease'], np.uint8), np.array(SR['fatgrey'], np.uint8)
    rgb = np.where(fresh[..., None], Gs[tone], Gg[tone])
    # ---- crevices between the bulges and pits
    crev = (fbm(xx / 7.0, yy / 6.0, seed + 4, 3) < 0.25) & (D > 0.3)
    rgb[crev] = Gg[1]
    pit = (fbm(xx / 1.7, yy / 1.7, seed + 5, 2) < 0.24) & (hs(xx, yy, seed + 8) > 0.55)
    rgb[pit] = np.where(fresh[..., None], Gs[np.clip(tone - 2, 0, 6)], Gg[np.clip(tone - 2, 0, 6)])[pit]
    # ---- wet wipes matted in: fibre patches whose fibres follow a slow direction field, half under the grease
    Wp = np.array(SR['wipe'], np.uint8)
    pm = fbm(xx / 12.0, yy / 9.0, seed + 30, 3) > 0.64
    a = fbm(xx / 40.0, yy / 40.0, seed + 31, 2) * np.pi * 3
    ca, sa = np.cos(a), np.sin(a)
    f = fbm((xx * ca + yy * sa) / 0.7, (-xx * sa + yy * ca) / 5.0, seed + 32, 2)
    wt = 2 + (f > 0.55) + (f > 0.70) - (f < 0.32) + np.round(shade * 1.2).astype(int) - (under > 0.4)
    over = fbm(xx / 2.5, yy / 2.5, seed + 33, 2) > 0.66
    wm = pm & inside & ~over & (D > 0.25)
    rgb[wm] = Wp[np.clip(wt, 1, 4)][wm]
    fib = wm & (np.abs(f - 0.5) < 0.025)                                 # dark fibre lines in the mat
    rgb[fib] = Gg[2]
    # ---- wet shine: hard little highlights on the lit tops of lumps and along the lips
    spec = inside & (shade > 0.55) & (fbm(xx / 1.7, yy / 1.7, seed + 5, 2) > 0.62) & (hs(xx, yy, seed + 9) > 0.45)
    spec |= inside & (fr >= 0.09) & (fr < 0.12) & (shade > 0.35) & (hs(xx * 0.5, yy, seed + 10) > 0.55)
    rgb[spec] = SR['white'][6]
    # ---- grease runs down the face from the lips: fresh yellow, a glossy head
    for i in range(int(w * h / 520)):
        x0, y0 = rng.uniform(2, w - 2), rng.uniform(2, h * 0.9)
        j0, i0 = min(P(y0), inside.shape[0] - 1), min(P(x0), inside.shape[1] - 1)
        if not inside[j0, i0]:
            continue
        ln_ = rng.uniform(2, 8)
        run = (np.abs(xx - x0 - (yy - y0) * 0.04) < (0.5 if U > 1 else 0.6)) & (yy >= y0) & (yy < y0 + ln_) & inside
        rgb[run] = Gs[5]
        rgb[run & (np.abs(yy - y0 - ln_ + 0.6) < 0.6)] = Gs[6]
    alpha = inside.copy()
    # ---- strands and drips hanging into the air from every overhang (bottom edges inside the box)
    for i in range(int(w / 4.0)):
        x0 = rng.uniform(1, w - 1)
        col = inside[:, min(P(x0), inside.shape[1] - 1)]
        edges = np.where(col[:-1] & ~col[1:])[0]
        edges = edges[edges / U < h - 3]
        if not len(edges):
            continue
        yb = edges[0] / U
        ln_ = min(rng.uniform(3, 18), h - 1 - yb)
        sx = x0 + rng.uniform(-1, 1)
        m = (np.abs(xx - (x0 + (sx - x0) * (yy - yb) / max(ln_, 1))) < (0.45 if U > 1 else 0.5)) & (yy > yb) & (yy < yb + ln_)
        blob = ((xx - sx) ** 2 + (yy - yb - ln_) ** 2) < (0.8 + rng.uniform(0, 0.6)) ** 2
        tt = np.clip(2 + np.round((yy - yb) / max(ln_, 1) * 2).astype(int), 0, 6)
        rgb[m] = Gs[tt][m]
        rgb[blob] = Gs[5]
        rgb[blob & (yy < yb + ln_ - 0.3) & (xx < sx)] = SR['white'][6]
        alpha |= m | blob
    # ---- the edge: the dark tone of its own ramp on the shade side
    L.a[..., :3] = rgb
    L.a[..., 3] = np.where(alpha, 255, 0)
    E = Layer(w, h); E.a[..., 3] = np.where(inside, 255, 0)
    E.outline(Gg[0], 'br')
    em = (E.a[..., 3] > 0) & np.all(E.a[..., :3] == Gg[0], axis=-1) & inside & (under > 0.05)
    L.a[..., :3][em] = Gg[0]
    # ---- embedded things, partly under the grease
    def bury(O):
        m = (O.a[..., 3] > 0) & inside & ~(fbm(xx / 1.4, yy / 1.4, seed + 50, 2) > 0.70)
        L.a[..., :3][m] = O.a[..., :3][m]
    def spot(margin=10):
        for _ in range(200):
            x0, y0 = rng.uniform(margin, w - margin), rng.uniform(margin, h - margin)
            if D[min(P(y0), D.shape[0] - 1), min(P(x0), D.shape[1] - 1)] > 0.8:
                return x0, y0
        return w * 0.7, h * 0.5
    things = ['bud', 'bud', 'brush', 'duck', 'phone', 'sock'] if kind == 'front' else (['bud', 'duck', 'sock'] if kind == 'mid' else ['bud'])
    for th_ in things:
        O = Layer(w, h)
        x0, y0 = spot()
        a_ = rng.uniform(-0.7, 0.7)
        ca_, sa_ = math.cos(a_), math.sin(a_)
        if th_ == 'bud':
            for kk in np.arange(-3.5, 3.51, 0.5 / U):
                O.px(x0 + kk * ca_, y0 + kk * sa_, SR['white'][6])
            for e in (-3.8, 3.8):
                O.ellipse(x0 + e * ca_, y0 + e * sa_, 1.0, 1.0, SR['white'][5])
        elif th_ == 'brush':
            O.line(x0 - 6 * ca_, y0 - 6 * sa_, x0 + 4 * ca_, y0 + 4 * sa_, SR['green'][4], t=1.4)
            O.line(x0 - 6 * ca_, y0 - 6 * sa_ - 0.5, x0 + 4 * ca_, y0 + 4 * sa_ - 0.5, SR['green'][5], t=0.5)
            for kk in np.arange(4.5, 8.0, 0.5 / U):
                O.line(x0 + kk * ca_, y0 + kk * sa_, x0 + kk * ca_ + 1.6 * sa_, y0 + kk * sa_ - 1.6 * ca_, SR['white'][6], t=0.5)
        elif th_ == 'duck':
            O.ellipse(x0, y0, 4.2, 3.0, SR['yellow'][4])
            O.ellipse(x0 - 0.8, y0 - 0.8, 3.0, 1.6, SR['yellow'][5])
            O.ellipse(x0 + 2.6, y0 - 3.2, 2.0, 2.0, SR['yellow'][4])
            O.ellipse(x0 + 2.2, y0 - 3.7, 1.0, 0.8, SR['yellow'][6])
            O.rect(x0 + 4.4, y0 - 3.4, 1.8, 1.0, SR['yellow'][2])
            O.px(x0 + 2.8, y0 - 3.6, SR['black'][0])
        elif th_ == 'phone':
            O.poly([(x0 - 2.5, y0 - 4), (x0 + 2.5, y0 - 4.6), (x0 + 3.1, y0 + 4), (x0 - 1.9, y0 + 4.6)], SR['castiron'][1])
            O.poly([(x0 - 1.8, y0 - 3.2), (x0 + 1.9, y0 - 3.7), (x0 + 2.3, y0 + 3.2), (x0 - 1.3, y0 + 3.7)], SR['glass'][2])
            O.line(x0 - 1.2, y0 - 2.5, x0 + 1.6, y0 + 2.6, SR['glass'][6], t=0.5)
            O.line(x0 + 1.4, y0 - 2.8, x0 - 0.6, y0 + 0.5, SR['glass'][5], t=0.5)
        elif th_ == 'sock':
            for kk in range(6):
                O.rect(x0 - 2 + 0.2 * kk, y0 - 5 + kk * 1.3, 3.4, 1.3, SR['white'][4] if kk % 2 else SR['blue'][3])
            O.ellipse(x0 + 2.4, y0 + 3.4, 2.6, 1.6, SR['blue'][3])
            O.ellipse(x0 + 3.4, y0 + 3.4, 1.4, 1.2, SR['white'][4])
        bury(O)
    # ---- rat holes: dark cavities with a crusted rim over them and a lit lower lip; red eyes inside
    holes = []
    for i in range({'front': 3, 'mid': 2, 'back': 0}[kind]):
        cx, cy = spot(14)
        rx, ry = rng.uniform(4.0, 5.5), rng.uniform(2.8, 3.6)
        d = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2
        hole = d < 1
        Vd = SR['void']
        ht = np.clip(np.floor(1 + (yy - cy) / ry * 1.2 + 0.3 * (hs(xx, yy, seed + 60) > 0.6)), 0, 3).astype(int)
        L.a[..., :3][hole] = np.array(Vd, np.uint8)[ht][hole]
        rim = (d >= 1) & (d < 1.9) & (yy < cy) & inside
        L.a[..., :3][rim] = Gg[1]
        lip = (d >= 1) & (d < 1.7) & (yy > cy + ry * 0.4) & inside
        L.a[..., :3][lip] = Gs[5]
        if eye is not None:
            for dx in (-1.1, 1.1):
                L.rect(cx + dx - 0.5, cy + 0.2 - 0.5, 1, 1, eye[1])
                if U >= 2:
                    L.rect(cx + dx - 0.5, cy + 0.2 - 0.5, 0.5, 0.5, eye[0])
        holes.append((cx, cy, rx, ry))
    return L, holes


def bike_sunk(rng):
    """A bike in the channel, half under: a wheel arc and the handlebar stick out of the water."""
    L = Layer(30, 18)
    I, Ru = SR['castiron'], SR['rust']
    for a in np.arange(math.pi, 2 * math.pi + 0.01, 0.02):
        L.px(9 + 7.5 * math.cos(a), 17 + 7.5 * math.sin(a), I[2])
        L.px(9 + 6.8 * math.cos(a), 17 + 6.8 * math.sin(a), I[4] if a < 1.4 * math.pi else I[1])
    for a in np.arange(math.pi, 2 * math.pi + 0.01, math.pi / 6):
        L.line(9, 17, 9 + 6.8 * math.cos(a), 17 + 6.8 * math.sin(a), I[5], t=TH)
    L.line(10, 16, 21, 9, Ru[3], t=1)
    L.line(21, 9, 24, 3, Ru[3], t=1)
    L.line(22, 3, 27, 2, I[1], t=1)
    L.rect(21, 1.5, 2, 1, I[3])
    L.line(16, 12, 15, 9, Ru[2], t=1)
    L.rect(13, 8, 4, 1.2, SR['wood'][1])                                   # the saddle
    L.rect(0, 16, 30, 2, SR['slime'][2]); L.hl(0, 16, 30, SR['slime'][4], t=TH)
    return L


# ---------------------------------------------------------------- front things (fg, speed 1.35, below y 176)
def fg_bucket(rng):
    L = Layer(44, 26)
    I, Wp, Ru = SR['castiron'], SR['wipe'], SR['rust']
    L.poly([(4, 8), (18, 8), (16, 26), (6, 26)], SR['enamel'][2])
    L.rect(4, 7, 14, 2, SR['enamel'][4])
    L.vl(6, 9, 16, SR['enamel'][3], t=1)
    for x in range(18, 44):
        hgt = 9 + 6 * math.sin((x - 18) / 26 * math.pi) + rng.uniform(-1, 1)
        L.vl(x, 26 - hgt, hgt, Wp[3 if x % 3 else 2])
        L.px(x, 26 - hgt, Wp[5])
    L.line(20, 20, 40, 14, SR['slime'][3], t=1)
    return L


def fg_pallet(rng):
    L = Layer(56, 30)
    Wd = SR['wood']
    for i in range(5):
        x = 2 + i * 11
        L.poly([(x, 30), (x + 8, 30), (x + 18, 2), (x + 10, 2)], Wd[2 + (i % 2)])
        L.line(x + 8, 30, x + 18, 2, Wd[1], t=1)
    L.rect(0, 22, 56, 4, Wd[1]); L.hl(0, 22, 56, Wd[3], t=1)
    for x in range(4, 54, 9):
        L.px(x, 23, SR['rust'][3])
    return L


def fg_hose(rng):
    L = Layer(40, 16)
    I = SR['castiron']
    for k in range(3):
        L.ellipse(20, 11 - k * 2.2, 18 - k * 2, 4.6 - k * 0.6, I[1 + k])
        L.ellipse(20, 11 - k * 2.2, 15 - k * 2, 3.0 - k * 0.6, I[0])
    L.line(36, 10, 40, 16, I[2], t=2)
    return L
