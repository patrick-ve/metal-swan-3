# Parts of section c2 RONDVAART (the canal cruise on the Amstel) in the canal look. Daylight colours, ramps only;
# the section file grades them to the golden hour.
#
# Things that run away from the viewer (the bridge decks, their parapets and slab sides, the Magere Brug's top
# beams, the houseboat's ends and tops) are built as SLICES: a horizontal surface at a height h over the floor is
# seen by the floor camera on screen rows y whose scroll speed is linear in y, s(y) = (y - 60) / (116 - h). So one
# 'rows' layer per height draws a slab of that height in true perspective at every camera. A stack of slices,
# one logical px apart, draws a box: its top, the side that faces the screen's centre and its near end.
import math
import random
import numpy as np
from parts_ams import *

FONT.setdefault('V', ["101", "101", "101", "101", "010"])
FONT.setdefault('J', ["001", "001", "001", "101", "010"])
FONT.setdefault('Y', ["101", "101", "010", "010", "010"])

import parts_l1c                                                     # noqa: c and c1's golden ramps (R['leaf_gold'])
R['stone_warm'] = ramp(7, .30, .90, .020, .022, .040, 300, 78)     # quay stone in the golden light

EYE = 116.0                     # the camera's height over the floor (horizon y 60, walk line 176)


def arr(ramp_):
    return np.array(R[ramp_] if isinstance(ramp_, str) else ramp_, np.uint8)


def yrow(h, d):
    """The screen row of a point at height h over the floor, at floor depth d."""
    return GY - d - h * s_d(d)


# ================================================================ the slice engine
class Box:
    """An axis box in the world: x0..x1 (world x), d0..d1 (floor depth, d0 nearer), h0..h1 (height over the floor).
       side(x, d, h, b) -> tone rgb (n, 3) for the slices below the top; top(x, d, h, b) for the top slice."""

    def __init__(s, x0, x1, d0, d1, h0, h1, side, top=None, step=1.0, air=True):
        s.x0, s.x1, s.d0, s.d1, s.h0, s.h1 = x0, x1, d0, d1, h0, h1
        s.side, s.top = side, top or side
        s.step = step
        s.air = air
        s.xc = (x0 + x1) / 2.0


def slice_heights(boxes):
    hs = set()
    for b in boxes:
        h = b.h0
        while h < b.h1 - 1e-6:
            hs.add(round(h, 3))
            h += b.step
        hs.add(round(b.h1, 3))
    # far from the eye first: below the eye the higher slice hides the lower; above it the lower hides the higher
    return sorted(hs, key=lambda h: -abs(h - EYE))


def slice_layers(sec, boxes, tag, grade_fn=None, air_fn=None):
    """Build one rows layer per slice height (all boxes that reach that height) and return the layer dicts (not
       added yet: the section file puts them where they belong in the draw order)."""
    out = []
    for h in slice_heights(boxes):
        bx = [b for b in boxes if b.h0 - 1e-6 <= h <= b.h1 + 1e-6]
        if not bx:
            continue
        ys = []
        for b in bx:
            ys += [yrow(h, b.d0), yrow(h, b.d1)]
        y0 = int(math.floor(min(ys))); y1 = int(math.ceil(max(ys))) + 1
        n = (y1 - y0) * U
        yc = y0 + (np.arange(n) + 0.5) / U
        sp = (yc - YHF) / (EYE - h)
        dd = 116.0 * (1 - sp)
        W = sec.lw(float(np.max(sp)))
        Lr = Layer(W, y1 - y0)
        for b in bx:
            rows = np.nonzero((dd >= b.d0 - 1e-6) & (dd <= b.d1 + 1e-6))[0]
            if len(rows) == 0:
                continue
            ss = sp[rows]
            pa = 192 + (b.x0 - 192) * ss; pb = 192 + (b.x1 - 192) * ss
            c0 = max(0, P(float(np.min(pa)))); c1 = min(Lr.pw, P(float(np.max(pb))) + 1)
            if c1 <= c0:
                continue
            pc = (np.arange(c0, c1) + 0.5) / U
            xw = 192 + (pc[None, :] - 192) / ss[:, None]
            dw = np.broadcast_to(dd[rows][:, None], xw.shape)
            m = (xw >= b.x0) & (xw < b.x1)
            if not m.any():
                continue
            fn = b.top if abs(h - b.h1) < 1e-6 else b.side
            rgb = fn(xw, dw, h, b)
            if b.air and air_fn is not None:
                rgb = air_fn(rgb, dw)
            sub_ = Lr.a[rows[0]:rows[-1] + 1, c0:c1]
            mm = np.zeros(sub_.shape[:2], bool)
            mm[rows - rows[0]] = m
            rr = np.zeros(sub_.shape[:2] + (3,), np.uint8)
            rr[rows - rows[0]] = rgb
            sub_[..., :3][mm] = rr[mm]
            sub_[..., 3][mm] = 255
        if grade_fn is not None:
            grade_fn(Lr)
        s0, s1 = float(sp[0]), float(sp[-1])
        out.append(dict(id='%s%g' % (tag, h), img=None, speed=min(s0, s1), y=y0, kind='rows', frames=[Lr], s0=s0, s1=s1, over=False))
    return out


# ---------------------------------------------------------------- slice painters (daylight; sun from the left)
def _side_tone(x, b, lit=1, shade=-1):
    """The side that faces the screen centre shows: the left side (lit by the sun from the left) or the right one (shade)."""
    return np.where(x < b.xc, lit, shade)


def brick_side(ramp_='brick_brown', seed=3, string=None):
    B = arr(ramp_); S = arr('stone')

    def f(x, d, h, b):
        course = math.floor(h / 2.0)
        bi = np.floor((d + (course % 2) * 2.0) / 4.0)
        hh = hash01(bi, np.full(bi.shape, course), seed)
        t = 3 + (hh > 0.84).astype(int) - (hh < 0.16).astype(int) + _side_tone(x, b)
        out = B[np.clip(t, 1, 5)]
        if string is not None and string[0] <= h <= string[1]:
            out = S[np.clip(4 + _side_tone(x, b, 1, -2), 0, 6)]
        if h < b.h0 + 1.0:                                   # the underside's edge in shade
            out = B[np.clip(1 + 0 * t, 0, 6)]
        return out
    return f


def klinker_top(ramp_='pave_red', seed=5):
    """The walkway's klinkers seen from above: rows across the deck, a paler worn path down the middle, the gutters
       at the parapets in shade (the parapets are 6 px high)."""
    B = arr(ramp_)

    def f(x, d, h, b):
        row = np.floor(d / 1.5)
        off = (row % 2) * 1.5
        bi = np.floor((x - b.x0 + off) / 3.0)
        hh = hash01(bi, row, seed)
        rel = np.abs(x - b.xc) / ((b.x1 - b.x0) / 2)
        t = np.where(rel < 0.45, 4, 3) + (hh > 0.92).astype(int) - (hh < 0.08).astype(int)
        if U >= 4:
            t = np.where(((x - b.x0 + off) % 3.0) < 0.28, t - 1, t)
        t = np.where(rel > 0.88, 2, t)
        return B[np.clip(t, 1, 6)]
    return f


def coping_top(seed=7):
    S = arr('stone')

    def f(x, d, h, b):
        j = (d % 6.0) < 0.45
        t = np.where(j, 3, 5 + (hash01(np.floor(d / 6.0), np.floor(x), seed) > 0.6))
        return S[np.clip(t, 0, 6)]
    return f


def stone_side(seed=9):
    S = arr('stone')

    def f(x, d, h, b):
        blk = np.floor((d + (math.floor(h / 3) % 2) * 3) / 6.0)
        hh = hash01(blk, np.full(blk.shape, math.floor(h / 3)), seed)
        t = 4 + (hh > 0.8).astype(int) - (hh < 0.2).astype(int) + _side_tone(x, b, 1, -2)
        return S[np.clip(t, 0, 6)]
    return f


def white_side(band=None, seed=11):
    """Painted timber: white, with a brown band (the Magere Brug's beams)."""
    Wt = arr('white'); Wd = arr('wood')

    def f(x, d, h, b):
        t = 4 + _side_tone(x, b, 1, -2) + (hash01(np.floor(d / 9.0), np.floor(h), seed) > 0.85)
        out = Wt[np.clip(t, 0, 6)]
        if band is not None and band[0] <= h <= band[1]:
            out = Wd[np.clip(2 + _side_tone(x, b, 1, -1), 0, 6)]
        return out
    return f


def plank_top(seed=13):
    Wd = arr('wood')

    def f(x, d, h, b):
        j = (d % 2.2) < 0.45
        hh = hash01(np.floor(d / 2.2), np.floor(x / 23.0), seed)
        t = np.where(j, 1, 3 + (hh > 0.7) - (hh < 0.2))
        return Wd[np.clip(t, 0, 6)]
    return f


def rail_side(posts=5.0, seed=15):
    """A white railing seen in slices: posts every `posts` px of depth, a mid rail and a top rail."""
    Wt = arr('white')

    def f(x, d, h, b):
        t = np.full(x.shape, 4) + _side_tone(x, b, 1, -2)
        return Wt[np.clip(t, 0, 6)]
    return f


class RailBox(Box):
    """A railing: only the posts (every `every` px of depth) between the rails show."""

    def __init__(s, x0, x1, d0, d1, h0, h1, rails, every=5.0, ramp_='white'):
        Box.__init__(s, x0, x1, d0, d1, h0, h1, None, None, 1.0)
        C = arr(ramp_)

        def f(x, d, h, b):
            t = np.full(x.shape, 5) + _side_tone(x, b, 1, -2)
            return C[np.clip(t, 0, 6)]
        s.side = s.top = f
        s.rails = rails
        s.every = every


def slice_layers_rail(sec, rb, tag, grade_fn=None, air_fn=None):
    """Railings: post slices are cut to the posts (and the rails' heights keep their whole length)."""
    boxes = []
    for h in np.arange(rb.h0, rb.h1 + 1e-6, 1.0):
        if any(abs(h - r) < 0.5 for r in rb.rails):
            boxes.append(Box(rb.x0, rb.x1, rb.d0, rb.d1, h, h, rb.side, rb.side))
        else:
            k = rb.d0
            while k < rb.d1:
                boxes.append(Box(rb.x0, rb.x1, k, min(rb.d1, k + 0.9), h, h, rb.side, rb.side))
                k += rb.every
    return boxes


# ================================================================ the low brick bridges (x 700, 1660)
LB_TOP, LB_UNDER, LB_OUT, LB_IN, LB_PAR = 112, 127, 32.5, 30.5, 6
BACK_D = 58.0                   # the far bank's depth (its layer scrolls at 0.5)
PIER_D = (18.0, 22.0)           # the piers stand just behind the boat's fairway (depth 0 .. 16)


def low_bridge_boxes(xc):
    h_top = GY - LB_TOP; h_und = GY - LB_UNDER
    bs = [Box(xc - LB_OUT, xc + LB_OUT, 0, BACK_D, h_und, h_top, brick_side('brick_brown', 3, string=(h_top - 1.5, h_top)), klinker_top())]
    for (a, b_) in ((xc - LB_OUT, xc - LB_IN), (xc + LB_IN, xc + LB_OUT)):
        bs.append(Box(a, b_, 0, BACK_D, h_top + 1, h_top + LB_PAR, brick_side('brick_red', 7), coping_top()))
    return bs


def low_bridge_front(rng):
    """The near end of a low bridge at the walk line (drawn over the world): the parapets' ends, the slab's face
       with its stone string course. 66 x 23; anchor: the slab top at row 6."""
    B = R['brick_brown']; Br = R['brick_red']; S = R['stone']
    L = Layer(66, 23)
    brickfill(L, 1, 7, 64, 15, B, 31, lo=1, hi=5)
    L.hl(0, 6, 66, S[6]); L.hl(0, 7, 66, S[4]); L.hl(1, 8, 64, S[2])           # the walkway's edge stones
    L.hl(1, 21, 64, B[0]); L.hl(1, 20, 64, B[1])
    L.vl(1, 7, 15, B[4]); L.vl(64, 7, 15, B[1])
    for x in range(6, 62, 9):                                                  # wet streaks under the edge
        L.vl(x, 9, 3 + (x * 7) % 5, B[1], t=TH)
    L.px(32, 12, R['iron'][2]); L.px(33, 12, R['iron'][3])                     # a ring for the boats
    for x0 in (0, 63):                                                         # the parapets' near ends
        brickfill(L, x0, 1, 3, 5, Br, 37 + x0)
        L.hl(x0, 0, 3, S[6]); L.hl(x0, 1, 3, S[3]); L.vl(x0 + 2, 1, 5, Br[1])
    return L


def pier_wall(w=66, h_top=49.0, d=18.0, ramp_='brick_brown', crown=40.0, spring=6.0, seed=41):
    """The piers of a low bridge seen from the front at depth d (drawn at that depth's scale), with the arch
       between them under the deck. Width w (world px); anchored at the waterline (bottom)."""
    sc = s_d(d)
    B = R[ramp_]; S = R['stone']; K = R['black']; M = R['moss']
    hh = (h_top + 4) * sc                                     # from the slab's underside to the water
    Wd = w * sc
    L = Layer(math.ceil(Wd) + 1, math.ceil(hh) + 1)
    brickfill(L, 0, 0, Wd, hh, B, seed, lo=1, hi=4, mid=2)
    pw = 5.5 * sc
    # the arch opening between the piers: a segmental arch, dark inside
    ax0, ax1 = pw, Wd - pw
    cr = (h_top - crown) * sc; sp_ = (h_top - spring) * sc
    xx, yy = grid(0, 0, L.w, L.h)
    t = (xx - (ax0 + ax1) / 2) / ((ax1 - ax0) / 2)
    ytop = cr + (sp_ - cr) * (1 - np.sqrt(np.clip(1 - t * t, 0, 1)))
    hole = (np.abs(t) < 1) & (yy >= ytop)
    L.a[..., 3][hole] = 0
    ring = (np.abs(t) < 1.04) & (yy >= ytop - 1.0) & (yy < ytop) & ~hole
    L.a[..., :3][ring] = S[5]
    L.a[..., 3][ring] = 255
    # the inside of the arch: the dark vault, the water under it in the deck's shade
    inner = hole & (yy < ytop + 2.5 * sc + (1 - np.abs(t)) * 1.5)
    L.a[..., :3][inner] = B[0]; L.a[..., 3][inner] = 255
    keyst = (np.abs(t) < 0.06) & (yy >= ytop - 2.2) & (yy < ytop)
    L.a[..., :3][keyst] = S[6]
    L.vl(0, 0, hh, B[4]); L.vl(Wd - 1, 0, hh, B[1])
    L.hl(0, 0, Wd, B[0])
    for x in sub(0, Wd):                                       # the wet band and the moss at the water
        if L.get(x, hh - 2) is not None:
            L.rect(x, hh - 3, D1, 3, M[1] if hash01(np.array(x * U), np.array(0), seed) > 0.4 else M[2])
    return L


# ================================================================ the Magere Brug (x 2060): white wooden bascule
MB_HALF, MB_OUT, MB_POST = 50, 64, 56          # the bascule's half width, the deck's outline, the portal posts' centre
MB_TOPH = GY - 40                              # the portal tops (y 40)


def magere_boxes(xc):
    h_top = GY - 112; h_und = GY - 127
    bs = [Box(xc - MB_OUT, xc + MB_OUT, 0, BACK_D, h_und, h_top, white_side(band=(h_und + 3, h_und + 6)), plank_top())]
    # the white railings along both edges (posts every 5 px of depth, a mid and a top rail)
    for (a, b_) in ((xc - MB_OUT, xc - MB_OUT + 1.2), (xc + MB_OUT - 1.2, xc + MB_OUT)):
        rb = RailBox(a, b_, 0, BACK_D, h_top + 1, h_top + 9, rails=(h_top + 5, h_top + 9), every=5.0)
        bs += slice_layers_rail(None, rb, '')
    # the portals' top beams along the depth (seen from below: above the eye), white with a dark lower edge
    for sg in (-1, 1):
        a, b_ = xc + sg * MB_POST - 2.5, xc + sg * MB_POST + 2.5
        bs.append(Box(a, b_, -0.5, BACK_D + 0.5, MB_TOPH - 6, MB_TOPH, white_side(band=(MB_TOPH - 6, MB_TOPH - 5)), white_side(), step=2.0))
    return bs


def magere_near(xc_unused=0, scale=1.0, lamps=True, rods=True):
    """One pair of portals of the Magere Brug at one depth (the walk line: scale 1; the far bank: 0.5). On each side a
       white timber trestle stands on the deck: the tall post, a raking leg to the land side, a cross brace; on top
       the balance beam along x (closed: level) with its long arm over the bascule and its short arm with the
       counterweight over the land; the rods down to the leaf, a row of small bulbs on the beam. 192 x 80 at scale 1;
       anchor (96, 72): the walkway's line at the centre."""
    k = scale
    T = R['white']; I = R['iron']; Y = R['yellow']
    W, H = 192 * k, 80 * k
    L = Layer(math.ceil(W), math.ceil(H))
    cx, base = 96 * k, 72 * k                       # the centre and the walkway (deck top)
    top = base - 72 * k                             # the beams' tops (y 40 at the walk line)
    th = max(D1, k)
    pw = max(1.5, 5 * k)
    for sg in (-1, 1):
        px_ = cx + sg * MB_POST * k
        # the raking leg and the cross brace (behind the post)
        fx = px_ + sg * 20 * k
        L.line(px_ + sg * 1.5 * k, top + 8 * k, fx, base - 1 * k, T[3], t=3 * k if k >= 1 else max(D1, 1.5 * k))
        L.line(px_ + sg * 1.5 * k, top + 8 * k, fx, base - 1 * k, T[5], t=th)
        L.line(px_, base - 22 * k, px_ + sg * 13 * k, top + 26 * k, T[2], t=max(D1, 1.6 * k))
        L.line(px_ + sg * 3 * k, top + 26 * k, px_ + sg * 15 * k, base - 8 * k, T[2], t=max(D1, 1.6 * k))
        L.rect(fx - 2 * k, base - 2 * k, 4 * k, 2 * k, T[3])
        # the post
        x0 = px_ - pw / 2
        L.rect(x0, top + 4 * k, pw, base - top - 4 * k, T[4])
        L.rect(x0, top + 4 * k, max(D1, pw * 0.3), base - top - 4 * k, T[6]); L.rect(x0 + pw - max(D1, pw * 0.3), top + 4 * k, max(D1, pw * 0.3), base - top - 4 * k, T[2])
        for yy in (top + 30 * k, top + 52 * k):
            L.rect(x0 - 0.5 * k, yy, pw + k, 1.2 * k, T[5]); L.px(px_, yy + 0.3 * k, I[2])
        # the balance beam: deeper at the pivot, thin at the tips
        tip, tail = cx + sg * 4 * k, px_ + sg * 32 * k
        for x in sub(min(tip, tail), max(tip, tail)):
            dd = abs(x - px_) / (abs(px_ - tip) if (x - px_) * sg < 0 else abs(tail - px_))
            hh = (5.5 - 2.5 * dd) * k
            L.rect(x, top, D1, hh, T[5]); L.rect(x, top, D1, max(D1, 0.8 * k), T[6]); L.rect(x, top + hh - max(D1, 0.8 * k), D1, max(D1, 0.8 * k), T[2])
        L.rect(px_ - pw / 2 - k, top + 3 * k, pw + 2 * k, 4 * k, T[4]); L.ellipse(px_, top + 3.5 * k, 1.1 * k, 1.1 * k, I[1])
        # the counterweight box under the short arm's end
        cwx = px_ + sg * 26 * k
        L.vl(cwx, top + 3 * k, 4 * k, I[2], t=th)
        L.rect(cwx - 5 * k, top + 7 * k, 10 * k, 8 * k, T[4]); L.hl(cwx - 5 * k, top + 7 * k, 10 * k, T[6]); L.vl(cwx + 5 * k - D1, top + 7 * k, 8 * k, T[2])
        L.hl(cwx - 5 * k, top + 15 * k - D1, 10 * k, T[1]); L.vl(cwx - 5 * k, top + 7 * k, 8 * k, T[5])
        # the rods from the long arm down to the leaf (rods=False: the game's bascule sprite draws them, magere_leaves)
        for rx in ((cx + sg * 9 * k, cx + sg * 30 * k) if rods else ()):
            L.vl(rx, top + 3 * k, base - top - 3 * k, T[3], t=max(D1, 0.6 * k))
            L.px(rx, base - D1 - k * 0.5, I[2])
        if lamps:
            for xb in np.arange(min(tip, tail) + 2 * k, max(tip, tail) - k, 3 * k):
                L.rect(xb, top - max(D1, 0.6 * k), max(D1, 0.6 * k), max(D1, 0.6 * k), Y[6])
    return L


def magere_front():
    """The near end of the Magere Brug's deck at the walk line: the white beam with its brown band, the railings'
       end posts. 130 x 24; anchor: the walkway at row 9."""
    T = R['white']; Wd = R['wood']; S = R['stone']
    L = Layer(130, 24)
    L.rect(1, 9, 128, 15, T[4]); L.hl(1, 9, 128, T[6]); L.hl(1, 10, 128, T[5])
    L.rect(1, 12, 128, 3, Wd[2]); L.hl(1, 12, 128, Wd[3])
    L.hl(1, 22, 128, T[1]); L.hl(1, 23, 128, T[0])
    for x in range(4, 128, 8):
        L.vl(x, 15, 7, T[3], t=TH)
    L.vl(65, 9, 15, T[2], t=TH)                                                # the joint between the two leaves
    for x0 in (0, 128):
        L.rect(x0, 0, 2, 9, T[5]); L.vl(x0, 0, 9, T[6]); L.hl(x0, 0, 2, T[6])
    return L


MB_LEAF_DEG = (0, 26, 54, 80)                  # the game's bascule frames (cruise.ts LEAF_DEG): closed -> open


def magere_leaves(deg):
    """The Magere Brug's bascule for the game's sprite `decor/ams/magere-brug` (128 x 104; the walkway's centre at
       (64, 82)): the two leaves' near ends (magere_front's middle 100 px: the white beam with its brown band, 15 px
       thick) turned up by deg about their hinges at the portals (x 64 -+ 50, the slab's middle line y 89.5, as the
       game's leaves turn), and magere_near's iron rods from the balance beams down to the leaves. deg 0 equals the
       page's painting px for px. The receding walkway is the entity's floor faces (it lifts in perspective)."""
    mf = magere_front()                         # mf x 0 = box x -1, mf y 0 = box y 73 (world 103; the box top is y 30)
    T = R['white']; I = R['iron']
    L = Layer(128, 104)
    a = math.radians(deg)
    ca, sa = math.cos(a), math.sin(a)
    yy, xx = np.mgrid[0:L.ph, 0:L.pw]
    bx = (xx + 0.5) / U; by = (yy + 0.5) / U
    hy = 82 + 7.5
    for s in (-1, 1):
        hx = 64 + s * 50
        ox_, oy_ = bx - hx, by - hy
        qx = hx + ca * ox_ + s * sa * oy_       # the closed leaf's point that lands here (the inverse turn)
        qy = hy - s * sa * ox_ + ca * oy_
        lo, hi = (14, 64) if s < 0 else (64, 114)
        m = (qx >= lo) & (qx < hi) & (qy >= 82) & (qy < 97)
        mx = np.clip(np.floor((qx + 1) * U).astype(int), 0, mf.pw - 1)
        my = np.clip(np.floor((qy - 73) * U).astype(int), 0, mf.ph - 1)
        src = mf.a[my, mx]
        m &= src[..., 3] > 0
        L.a[m] = src[m]
        # the rods (magere_near: x 64 -+ 9 and -+ 30, from the beam at y 13 to the leaf's top at y 82)
        for d_ in (9, 30):
            rx = 64 + s * d_
            if deg == 0:
                L.vl(rx, 13, 69, T[3], t=max(D1, 0.6))
                L.px(rx, 82 - D1 - 0.5, I[2])
            else:
                dx, dy = rx - hx, 81.5 - hy
                tx = hx + ca * dx - s * sa * dy
                ty = hy + s * sa * dx + ca * dy
                L.line(rx, 13, tx, ty, T[3], t=max(D1, 0.6))
                L.px(tx, ty - 0.5, I[2])
    return L


def stone_pier(w, h_top=49.0, d=18.0, seed=51):
    """A dressed stone pier seen from the front at depth d: courses of blocks, a cutwater shade, moss at the water."""
    sc = s_d(d)
    S = R['stone']; M = R['moss']
    hh = (h_top + 4) * sc; Wd = w * sc
    L = Layer(math.ceil(Wd) + 1, math.ceil(hh) + 1)
    xx, yy = grid(0, 0, Wd, hh)
    row = np.floor(yy / 2.5)
    blk = np.floor((xx + (row % 2) * 2.5) / 5.0)
    hv = hash01(blk, row, seed)
    t = 4 + (hv > 0.8).astype(int) - (hv < 0.2).astype(int) - (xx > Wd * 0.6).astype(int)
    t = np.where((yy % 2.5) < (0.5 if U > 1 else 0), 2, t)
    t = np.where(yy > hh - 3, 1, t)
    rgb = np.array(S, np.uint8)[np.clip(t, 0, 6)]
    L.put(0, 0, rgb, np.ones(xx.shape, bool))
    L.vl(0, 0, hh, S[6]); L.vl(Wd - D1, 0, hh, S[1]); L.hl(0, 0, Wd, S[1])
    for x in sub(0, Wd):
        L.rect(x, hh - 3, D1, 2, M[2] if hash01(np.array(x * U), np.array(1), seed) > 0.5 else M[1])
    return L


# ================================================================ the houseboat at the far quay (x 1110, w 96; cabin 1128 w 60)
HB = dict(x0=1110, w=96, cx=1128, cw=60, deck=134, roof=116, foot=159, hull_d=11.0, cabin_d=9.0)


def houseboat_boxes():
    h_deck = GY - HB['deck']; h_roof = GY - HB['roof']; h_foot = GY - HB['foot']
    hull = Box(HB['x0'], HB['x0'] + HB['w'], 0, HB['hull_d'], h_foot, h_deck, hull_side(), deck_top(), step=2.0, air=False)
    cab = Box(HB['cx'], HB['cx'] + HB['cw'], 0, HB['cabin_d'], h_deck + 2, h_roof, cabin_side(), roof_top(), step=2.0, air=False)
    return [hull, cab]


def hull_side():
    K = arr('black'); Rd = arr('red'); T = arr('white')

    def f(x, d, h, b):
        rel = (h - b.h0) / (b.h1 - b.h0)
        sh = _side_tone(x, b, 1, -1)
        if rel > 0.86:
            return T[np.clip(4 + sh, 0, 6)]
        if rel > 0.55:
            return Rd[np.clip(3 + sh, 0, 6)]
        return K[np.clip(2 + sh, 0, 6)]
    return f


def deck_top():
    Wd = arr('wood')

    def f(x, d, h, b):
        j = (x % 4.0) < 0.5
        t = np.where(j, 2, 4 - (hash01(np.floor(x / 4), np.floor(d / 6), 3) > 0.7))
        edge = (x < b.x0 + 1.2) | (x > b.x1 - 1.2) | (d > b.d1 - 0.9)
        t = np.where(edge, 5, t)
        return Wd[np.clip(t, 0, 6)]
    return f


def cabin_side():
    C = arr('canvas'); T = arr('white')

    def f(x, d, h, b):
        t = 4 + _side_tone(x, b, 1, -2)
        out = C[np.clip(t, 0, 6)]
        return np.where((np.abs(d - b.d1 * 0.5) < 1.2)[..., None] & (h < b.h1 - 3), arr('glass')[1], out)
    return f


def roof_top():
    M = arr('moss'); S = arr('stone'); LF = arr('leaf')

    def f(x, d, h, b):
        n = fbm(x / 5.0, d / 3.0, 17, 2)
        t = 3 + (n > 0.6) - (n < 0.38)
        out = M[np.clip(t, 0, 6)]
        edge = (x < b.x0 + 1.0) | (x > b.x1 - 1.0) | (d > b.d1 - 0.8)
        out = np.where(edge[..., None], S[5], out)
        pot = (hash01(np.floor(x / 7), np.floor(d / 4), 19) > 0.78) & ~edge
        return np.where(pot[..., None], LF[4], out)
    return f


def houseboat_front(rng):
    """The houseboat's front at the walk line: the hull (deck line y 134 down to its foot 159), the cabin (116..134),
       its windows, door, plants, the stove pipe, and its broken mirror below. Layer 100 x 62, origin (1109, 110)."""
    K = R['black']; Rd = R['red']; T = R['white']; C = R['canvas']; G = R['glass']; Wd = R['wood']; I = R['iron']; LF = R['leaf']
    L = Layer(100, 62)
    ox, oy = 1109, 110
    x0, x1 = HB['x0'] - ox, HB['x0'] + HB['w'] - ox
    yd, yf = HB['deck'] - oy, HB['foot'] - oy
    # hull: a white gunwale, the red band, the tarred hull, a rubbing strake
    L.rect(x0, yd, x1 - x0, yf - yd, K[2])
    L.rect(x0, yd, x1 - x0, 2, T[5]); L.hl(x0, yd, x1 - x0, T[6])
    L.rect(x0, yd + 2, x1 - x0, 9, Rd[3]); L.hl(x0, yd + 2, x1 - x0, Rd[5]); L.hl(x0, yd + 10, x1 - x0, Rd[1])
    L.hl(x0, yd + 11, x1 - x0, K[4]); L.hl(x0, yd + 12, x1 - x0, K[1])
    for xx in range(x0 + 4, x1 - 2, 6):                                         # rivet lines on the steel
        L.px(xx, yd + 15, K[3]); L.px(xx + 3, yd + 19, K[1])
    for xx in range(x0 + 8, x1 - 6, 7):                                         # rust runs from the band
        if rng.random() < 0.5:
            L.vl(xx, yd + 12, rng.randint(3, 8), Rd[1], t=TH)
    L.vl(x0, yd, yf - yd, K[3]); L.vl(x1 - 1, yd, yf - yd, K[0])
    L.hl(x0, yf - 1, x1 - x0, K[0])
    for fx in (x0 + 10, x1 - 22):                                               # fenders (old tyres)
        L.ellipse(fx + 2.5, yd + 7, 2.6, 3.2, K[0]); L.ellipse(fx + 2.5, yd + 7, 1.2, 1.6, K[2])
    L.px(x0 + 30, yd + 1, I[1]); L.px(x0 + 31, yd + 1, I[1])
    # the cabin: painted planks, windows with curtains and a door
    cx0, cx1 = HB['cx'] - ox, HB['cx'] + HB['cw'] - ox
    yr = HB['roof'] - oy
    L.rect(cx0, yr, cx1 - cx0, yd - yr, C[4])
    for yy in range(yr + 3, yd, 2):
        L.hl(cx0, yy, cx1 - cx0, C[3], t=TH)
    L.rect(cx0 - 1, yr, cx1 - cx0 + 2, 2, T[5]); L.hl(cx0 - 1, yr, cx1 - cx0 + 2, T[6]); L.hl(cx0, yr + 2, cx1 - cx0, C[1])
    L.vl(cx0, yr + 2, yd - yr - 2, C[5]); L.vl(cx1 - 1, yr + 2, yd - yr - 2, C[2])
    xw = cx0 + 4
    for (ww, kind) in ((9, 'curtain'), (9, 'glint'), (5, 'door'), (9, 'sky'), (9, 'curtain')):
        if kind == 'door':
            L.rect(xw, yr + 4, ww, yd - yr - 4, R['green'][2]); L.vl(xw, yr + 4, yd - yr - 4, R['green'][4]); L.rect(xw + 1, yr + 5, ww - 2, 4, G[1])
            L.px(xw + ww - 2, yr + 11, R['yellow'][5])
        else:
            window(L, xw, yr + 5, ww, 7, R['white'], G, rng, None, kind=kind)
            if rng.random() < 0.7:                                                 # a flower box
                for fx in range(xw, xw + ww, 2):
                    L.px(fx, yr + 12, R['red'][5] if rng.random() < 0.6 else R['yellow'][5]); L.px(fx + 1, yr + 12, LF[3])
        xw += ww + 2
    # the roof edge things: pots, a stove pipe (its smoke is the game's decor at x 1181, y 110)
    for px_ in (cx0 + 3, cx0 + 17, cx0 + 36):
        L.rect(px_, yr - 3, 4, 3, R['roof_tile'][3]); L.hl(px_, yr - 3, 4, R['roof_tile'][5])
        cn = canopy(9, 7, R['leaf'], px_ * 3 + 1, nb=4, rag=2, holes=0.05)
        L.blit(cn, px_ - 2, yr - 9)
    pipe = 1181 - ox
    L.rect(pipe - 1, yr - 6, 2, 6, I[2]); L.vl(pipe - 1, yr - 6, 6, I[4]); L.hl(pipe - 2, yr - 6, 4, I[1])
    # the deck in front of the cabin: a bike and a bench at the bow, a ladder at the stern
    L.rect(x1 - 9, yd - 6, 7, 6, Wd[3]); L.hl(x1 - 9, yd - 6, 7, Wd[5]); L.vl(x1 - 3, yd - 6, 6, Wd[1])
    for k in range(3):
        L.hl(x0 + 2, yd - 2 - k * 2, 4, I[3], t=TH)
    L.vl(x0 + 2, yd - 7, 7, I[2], t=TH); L.vl(x0 + 5, yd - 7, 7, I[2], t=TH)
    # the broken mirror on the water under the hull
    xx, yy = grid(x0, yf, x1 - x0, 62 - yf)
    xs = xx - np.round(1.6 * np.sin(np.floor(yy * DET) / DET * 1.7))
    m = chk(xs, yy) & (hash01(xs / 3, yy * DET, 5) > 0.22 + (yy - yf) * 0.09) & (xs >= x0 + 1) & (xs < x1 - 1)
    col = np.where(((yy - yf) < 2.5)[..., None], np.array(K[0], np.uint8), np.where(((yy - yf) < 5)[..., None], np.array(Rd[1], np.uint8), np.array(K[1], np.uint8)))
    L.put(x0, yf, col, m)
    return L, (ox, oy)


# ================================================================ the cruise boat (speed 0: it carries the camera)
CB = dict(stern=56, len=192, deck=176, roof=152, beam=16.0, cab=(40, 168), cab_d=14.0, wl=182)


def _sx(X, d):
    """A boat point at walk-line screen x X, moved back to floor depth d (the boat stands still on the screen)."""
    return 192 + (X - 192) * s_d(d)


def cruise_boat(frame=0, rng=None, calm=False):
    """The tour boat on the screen (its stern at x 56): returns (body, over). body: the deck top, the glass cabin, the
       roof, its mirror and wake in the water (frame 0..2); over: the hull's near side (in front of the hero's feet).
       calm=True: no bow wave and no stern wash (the game's frame of the boat at rest: moored, stopped, docked)."""
    rng = rng or random.Random(5)
    T = R['white']; Bl = R['blue']; Rd = R['red']; K = R['black']; G = R['glass']; I = R['iron']; St = R['stone']
    body = Layer(VIEW_W, VIEW_H); over = Layer(VIEW_W, VIEW_H)
    X0 = CB['stern']; X1 = X0 + CB['len']
    beam = CB['beam']
    # ---- the deck top (h 0): rows 176 - beam .. 176; the bow is rounded in plan
    for yy in sub(GY - beam, GY):
        d = GY - (yy + 0.5 / U)
        bow = 15.0 * (d / beam) ** 0.8                    # the raked, rounded bow: its far corner pulled back
        xa = _sx(X0 + 1, d); xb = _sx(X1 - 1 - bow, d)
        body.rect(xa, yy, xb - xa, D1, St[3])
        body.rect(xa, yy, xb - xa, D1, St[3] if int((d) * 2) % 3 else St[2])
        body.rect(xa, yy, 1.2, D1, T[5]); body.rect(xb - 1.2, yy, 1.2, D1, T[3])
        if d > beam - 1.3:
            body.rect(xa, yy, xb - xa, D1, T[5])           # the far gunwale
    # ---- the cabin: the far wall's top, the roof (h 24) from depth 0 to cab_d
    ca, cb_ = X0 + CB['cab'][0], X0 + CB['cab'][1]
    hr = GY - CB['roof']
    for yy in sub(yrow(hr, CB['cab_d']), CB['roof']):
        d = (GY - hr - (yy + 0.5 / U)) / (1 - hr / EYE)
        xa = _sx(ca, d); xb = _sx(cb_, d)
        body.rect(xa, yy, xb - xa, D1, G[3])
        # the glass roof seen from above: pale panes with the sky, white ribs every 16 px, a sheen
        for rx in range(int(ca), int(cb_) + 1, 16):
            body.rect(_sx(rx, d) - 0.5, yy, 1.0, D1, T[5])
        sheen = (yy - yrow(hr, CB['cab_d'])) * 3.0
        body.rect(xa + 20 + sheen, yy, 9, D1, G[5]); body.rect(xa + 70 + sheen, yy, 5, D1, G[4])
        body.rect(xa, yy, 1.0, D1, T[6]); body.rect(xb - 1, yy, 1.0, D1, T[3])
        if d > CB['cab_d'] - 1.0:
            body.rect(xa, yy, xb - xa, D1, T[5])
    body.hl(ca - 1, CB['roof'] - 1, cb_ - ca + 2, T[6]); body.hl(ca - 1, CB['roof'], cb_ - ca + 2, T[4])
    # ---- the cabin's near wall (depth 0): windows over a white panel with the boat's name
    yw0, yw1 = CB['roof'] + 1, GY - 7
    body.rect(ca, yw0, cb_ - ca, GY - yw0, T[4])
    xs = list(range(int(ca) + 2, int(cb_) - 14, 15))
    for x in xs:
        body.rect(x, yw0 + 1, 13, yw1 - yw0 - 1, G[1])
        body.hl(x, yw0 + 1, 13, G[0])
        # inside: the far windows (the river beyond, pale), the seat backs, a table edge
        body.rect(x + 1, yw0 + 3, 11, 6, G[3]); body.rect(x + 1, yw0 + 3, 4, 3, G[4])
        body.rect(x + 1, yw1 - 6, 11, 4, Bl[1]); body.hl(x + 1, yw1 - 6, 11, Bl[3])
        body.vl(x + 6, yw1 - 6, 4, Bl[0], t=TH)
        body.hl(x + 1, yw1 - 2, 11, K[1])
        # a glint across the pane
        body.line(x + 9, yw0 + 2, x + 4, yw1 - 2, G[4], t=TH)
        body.vl(x + 13, yw0, yw1 - yw0 + 1, T[5]); body.vl(x + 14, yw0, yw1 - yw0 + 1, T[2], t=TH)
    # the wheelhouse at the bow end: a raked front window
    wx = cb_ - 14
    body.rect(wx, yw0 + 1, 12, yw1 - yw0 - 1, G[1]); body.rect(wx + 1, yw0 + 2, 10, 5, G[4]); body.line(wx + 10, yw0 + 2, wx + 3, yw1 - 1, G[5], t=TH)
    body.rect(wx + 2, yw1 - 5, 6, 3, K[2]); body.ellipse(wx + 8, yw1 - 5, 2.0, 2.0, I[1])        # the wheel
    body.vl(ca, yw0, GY - yw0, T[6]); body.vl(cb_ - 1, yw0, GY - yw0, T[2])
    body.rect(ca, yw1, cb_ - ca, 7, T[5]); body.hl(ca, yw1, cb_ - ca, T[3]); body.hl(ca, yw1 + 3, cb_ - ca, Bl[3]); body.hl(ca, yw1 + 4, cb_ - ca, Bl[2])
    text(body, ca + 6, yw1 + 1, 'AMSTEL', Bl[1])
    body.ellipse(ca + 40, yw1 + 3, 2.6, 2.6, Rd[4]); body.ellipse(ca + 40, yw1 + 3, 1.3, 1.3, T[4])
    body.rect(ca + 39.5, yw1 + 0.5, 1, 1, T[6]); body.rect(ca + 39.5, yw1 + 4.5, 1, 1, T[6])
    # ---- the stern: the flag staff with the red-white-blue flag; the bow: a navigation light post
    fx = X0 + 8
    body.vl(fx, GY - 30, 30, T[5]); body.vl(fx + 1, GY - 30, 30, T[2], t=TH)
    for j, C in enumerate((Rd, T, Bl)):
        for x in sub(0, 12):
            wv = math.sin(x / 12 * 4.5 + frame * 2.1) * 1.0 * x / 12
            body.rect(fx + 1.5 + x, GY - 30 + j * 2.6 + wv, D1, 2.6, C[4 + (1 if math.cos(x / 12 * 4.5 + frame * 2.1) > 0.3 else 0)])
    body.vl(X1 - 12, GY - 12, 12, I[2]); body.rect(X1 - 13, GY - 14, 3, 3, T[5]); body.px(X1 - 12, GY - 13, R['green'][4])
    # a rail around the open stern deck
    body.hl(X0 + 2, GY - 6, ca - X0 - 3, T[5], t=TH)
    for x in range(int(X0) + 3, int(ca), 6):
        body.vl(x, GY - 6, 6, T[4], t=TH)
    # ---- the hull's near side (over the hero's feet): white, navy band, red boot top, a rubbing strake
    for x in sub(X0, X1):
        e = x - X0
        bowc = max(0.0, (x - (X1 - 16)) / 16.0)
        top = GY - 0.2
        bot = CB['wl'] - (3.5 * bowc ** 1.6)
        sterncut = 0.0 if e > 3 else (3 - e) * 0.6
        over.rect(x, top, D1, bot - top - sterncut, T[4])
        over.rect(x, top, D1, 1, T[6])
        over.rect(x, top + 2, D1, 1.2, K[1])                           # the rubbing strake
        over.rect(x, top + 3.2, D1, 1.6, Bl[2])
        if bot - top > 5.2:
            over.rect(x, bot - 1.2, D1, 1.2, Rd[3])
    for x in (X0 + 30, X0 + 92, X0 + 150):                              # fenders
        over.rect(x, GY + 1, 2, 4, K[1]); over.px(x, GY + 1, K[3])
    # ---- the mirror of the hull and the wake (frame 0..2), in the water under the boat
    wl = CB['wl']
    xx, yy = grid(X0 - 30, wl, CB['len'] + 60, 18)
    r = (yy - wl) / 18.0
    wob = np.round(1.5 * np.sin(np.floor(yy * DET) / DET * 1.9 + frame * 2.1))
    xs = xx - wob
    inhull = (xs >= X0 + 2) & (xs < X1 - 6 - 6 * r)
    m = inhull & chk(xs, yy) & (hash01(xs / 3, yy * DET + frame * 7, 7) > 0.18 + r * 0.9)
    col = np.where((r < 0.18)[..., None], np.array(Bl[1], np.uint8), np.where((r < 0.5)[..., None], np.array(T[2], np.uint8), np.array(Bl[2], np.uint8)))
    body.put(X0 - 30, wl, col, m)
    # contact shade along the waterline
    body.rect(X0 + 2, wl, CB['len'] - 8, 1, K[1])
    # foam: the bow wave and the stern's wash
    fw = np.zeros(xx.shape, bool)
    bowx = X1 - 4 + r * 26
    fw |= (np.abs(xx - bowx) < 2.2 + r * 3) & (r < 0.55) & (hash01(xx * 2, yy * DET + frame * 5, 11) > 0.35)
    st = (xx < X0 + 8) & (xx > X0 - 30 + r * 10) & (np.abs((yy - wl) - 2 - 2 * np.sin(xx / 5.0 + frame * 2.1)) < 1.2 + r)
    fw |= st & (hash01(xx * 2 + frame * 3, yy * DET, 13) > 0.45)
    if calm:
        fw[:] = False
    body.put(X0 - 30, wl, np.where((hash01(xx, yy * 2, 17 + frame) > 0.5)[..., None], np.array(T[6], np.uint8), np.array(T[4], np.uint8)), fw & chk(xx + frame, yy))
    return body, over


# ================================================================ the far bank of the Amstel (speed 0.5)
# The scenery scale (SCALE-BRIEF.md): 13 px per metre x the plane's speed. The far bank scrolls at 0.5: 6.5 px per
# metre, a storey 20 px (kit sc 1.0), a ground floor 27, a window 7 wide, a door about 21 tall.
FAR_S = 0.5
PXM_FAR = 13.0 * FAR_S                  # px per metre on the far bank
MANSION_UPS = (22, 19, 19)              # a mansion's upper floors, bottom up (the bel-etage is the tallest)
GF_FAR, ST_FAR = 27, 6                  # the raised ground floor and its souterrain band
CARRE_W, CARRE_H = 260, 130             # Carre's river front: about 40 x 20 m at 6.5 px per metre
SCALE_LOG = dict(storeys=[], trees=[], lamps=[], cars=[], boats=[])


def text2(L, x, y, t, c, k=2):
    """The kit's FONT at k x k logical px per dot (large lettering on a building)."""
    for ch in t:
        g = FONT[ch]
        for j, row in enumerate(g):
            for i, v in enumerate(row):
                if v == '1':
                    L.rect(x + i * k, y + j * k, k, k, c)
        x += (len(g[0]) + 1) * k


def text2_w(t, k=2):
    return text_w(t) * k


def mansion(rng, w, nup=2, kind='plaster', seed=0, roof='mansard', doorc=None):
    """A long Amstel mansion at the far bank's scale: a raised ground floor over a souterrain, `nup` upper floors of
       tall sash windows in bays of 14 px (the bel-etage with caps and pediments), a stone cornice with dentils, a slate
       mansard with dormers and chimneys (or a balustrade), sometimes a central risalit with a pediment and a balcony.
       Detail per storey: surrounds, sills, rain streaks, rustication, anchors, a downpipe. (Layer, info)."""
    S = R['stone']; G = R['glass']; I = R['iron']; SL = R['roof_slate']; Wt = R['white']
    bk = {'plaster': 'plaster', 'ochre': 'brick_ochre', 'brick': rng.choice(['brick_brown', 'brick_red', 'brick_purple']),
          'grey': 'stone'}[kind]
    body = R[bk]
    smooth = kind in ('plaster', 'grey')
    Tr = Wt if kind != 'grey' else R['plaster']
    D = R[doorc or rng.choice(['green', 'black', 'blue', 'red', 'green'])]
    nb = max(4, int(round((w - 4) / 14.0)))
    pitch = (w - 4) / nb
    ped = rng.random() < 0.45 and nb >= 6
    ups = list(MANSION_UPS[:nup])
    rh = 12 if roof == 'mansard' else 4
    pad = 5 if roof == 'mansard' else 3
    cor = 6
    H = pad + rh + cor + sum(ups) + GF_FAR
    L = Layer(w, H)
    info = dict(win=[], ups=ups, gf=GF_FAR)
    yc = pad + rh                                   # the cornice's top
    yg = H - GF_FAR                                 # the top of the ground floor
    yb = H
    xs = [int(round(2 + pitch * i + (pitch - 7) / 2)) for i in range(nb)]
    mid = nb // 2
    risal = set(range(mid - 1, mid + 2)) if (ped and nb % 2) else (set(range(mid - 2, mid + 2)) if ped else set())
    if risal:
        rx0 = xs[min(risal)] - 4; rx1 = xs[max(risal)] + 7 + 4
    # ---- the roof
    if roof == 'mansard':
        for i in sub(0, rh):
            ins = 1 + (rq((3 - i) * 1.2) if i < 3 else 0)       # the curb at the top, then the steep slate face
            odd = int(i * DET) % 2
            L.rect(ins, pad + i, w - 2 * ins, D1, SL[3] if odd else SL[2])
            L.rect(ins, pad + i, 1, D1, SL[4]); L.rect(w - ins - 1, pad + i, 1, D1, SL[1])
        L.hl(4, pad, w - 8, SL[5]); L.hl(2, pad + 3, w - 4, S[5])                   # the lead roll at the curb
        for i in range(nb):
            if (i % 2) or (risal and i in risal):
                continue
            dx = xs[i]
            L.rect(dx, pad + 3, 7, rh - 3, Tr[5]); L.vl(dx, pad + 3, rh - 3, Tr[6]); L.vl(dx + 6, pad + 3, rh - 3, Tr[3])
            for j in sub(0, 3):                                                      # the dormer's little pediment
                hw = 4.5 * (j + D1) / 3
                L.rect(dx + 3.5 - hw, pad + j, 2 * hw, D1, Tr[5])
            L.rect(dx + 1, pad + 5, 5, rh - 6, G[0]); L.px(dx + 1, pad + 5, G[3]); L.vl(dx + 3, pad + 5, rh - 6, Tr[5], t=TH)
            L.hl(dx - 1, yc - 1, 9, SL[1])
        for chx in (4, w - 9):
            L.rect(chx, 0, 5, pad + 3, R['brick_brown'][2]); L.vl(chx, 1, pad + 2, R['brick_brown'][4])
            L.hl(chx - 1, 0, 7, S[5]); L.hl(chx - 1, 1, 7, S[2])
            L.px(chx + 1, -0, R['roof_tile'][3]); L.px(chx + 3, 0, R['roof_tile'][2])
    else:                                                                            # a balustrade with vases
        L.hl(0, yc - 4, w, S[6]); L.hl(0, yc - 3, w, S[4])
        for x in range(1, w - 1, 2):
            L.vl(x, yc - 2, 2, S[5] if (x // 2) % 2 else S[3])
        L.hl(0, yc - 1, w, S[2])
        for x in range(6, w - 4, 28):
            L.rect(x, yc - 7, 3, 3, S[5]); L.px(x + 1, yc - 8, S[6])
    # ---- the body
    yw = yc + cor
    if smooth:
        L.rect(0, yw, w, yb - yw, body[5])
        xx, yy = grid(0, yw, w, yb - yw)
        n = fbm((xx + seed * 7) / 11.0, yy / 7.0, seed, 3)
        L.put(0, yw, np.broadcast_to(np.array(body[4], np.uint8), xx.shape + (3,)), (n < 0.36) & chk(xx, yy))
        L.put(0, yw, np.broadcast_to(np.array(body[6], np.uint8), xx.shape + (3,)), (n > 0.70) & chk(xx + 1, yy))
        L.vl(0, yw, yb - yw, body[6]); L.vl(w - 1, yw, yb - yw, body[3])
        for y in range(yg + 3, yb - ST_FAR, 3):                                       # the rusticated ground floor
            L.hl(0, y, w, body[4])
    else:
        brickfill(L, 0, yw, w, yb - yw, body, seed, streaks=True)
        L.vl(0, yw, yb - yw, body[5]); L.vl(w - 1, yw, yb - yw, body[1])
        for y in range(yw, yb - ST_FAR - 1, 4):                                       # quoins at the corners
            L.rect(0, y, 3 if (y // 4) % 2 else 2, 2, S[5]); L.rect(w - 3, y, 3 if (y // 4) % 2 else 2, 2, S[4])
    if risal:                                                                         # the risalit: pilasters at its edges
        for xe in (rx0, rx1 - 2):
            L.rect(xe, yw, 2, yg - yw, (Tr if smooth else S)[6 if xe == rx0 else 4]); L.vl(xe + 1, yw, yg - yw, (Tr if smooth else S)[4 if xe == rx0 else 3])
    # ---- the cornice: overhang, dentils, frieze, the grime under it
    L.hl(0, yc, w, S[6]); L.hl(0, yc + 1, w, S[4])
    for x in range(0, w, 2):
        L.px(x, yc + 2, S[5]); L.px(x + 1, yc + 2, S[2])
    L.hl(0, yc + 3, w, S[3]); L.hl(0, yc + 4, w, body[4] if smooth else S[5]); L.hl(0, yc + 5, w, body[3] if smooth else body[2])
    if risal:
        pw_ = rx1 - rx0 + 4
        for j in sub(0, 10):                                                          # the pediment over the risalit
            hw = pw_ / 2 * (j + D1) / 10
            cx_ = (rx0 + rx1) / 2
            L.rect(cx_ - hw, yc - 10 + j, 2 * hw, D1, S[4]); L.rect(cx_ - hw, yc - 10 + j, 1.5, D1, S[6]); L.rect(cx_ + hw - 1.5, yc - 10 + j, 1.5, D1, S[2])
        L.ellipse((rx0 + rx1) / 2, yc - 3.5, 3, 2.2, S[2]); L.ellipse((rx0 + rx1) / 2 - 0.5, yc - 4, 1.6, 1.2, G[1])
    # ---- the upper floors (bottom up)
    ybot = yg
    for k, fh in enumerate(ups):
        y0 = ybot - fh
        wh = fh - 6
        wy = y0 + 3
        if smooth and k > 0:
            L.hl(0, ybot, w, body[6])                                                  # a floor band
        if not smooth:
            for ax in (6, w - 7):
                L.vl(ax, ybot - 2, 2, I[1])                                            # wall anchors
        for i, x in enumerate(xs):
            french = (k == 0 and risal and i in risal)
            hh_ = wh + (2 if french else 0)
            if smooth:
                L.rect(x - 1, wy - 1, 9, hh_ + 2, body[6]); L.vl(x + 7, wy, hh_ + 1, body[3])
            b = window(L, x, wy, 7, hh_, Tr, G, rng, None if smooth else body)
            info['win'].append(b)
            if k == 0:                                                                 # the bel-etage's caps
                if i % 2 == 0 or french:
                    for j in sub(0, 3):
                        hw = 5.5 * (j + D1) / 3
                        L.rect(x + 3.5 - hw, wy - 5 + j, 2 * hw, D1, S[5] if j < 2 else S[3])
                else:
                    L.hl(x - 2, wy - 3, 11, S[6]); L.hl(x - 1, wy - 2, 9, S[3])
            else:
                L.hl(x - 1, wy - 1, 9, S[5]); L.rect(x + 3, wy - 2, 1, 2, S[6])        # the lintel and its keystone
            if smooth and rng.random() < 0.4:                                          # rain streaks under the sill
                L.vl(x + rng.randint(1, 5), wy + hh_ + 2, rng.randint(2, 5), body[4], t=TH)
            if rng.random() < 0.12 and not french:                                     # a window box
                fc = R[rng.choice(['red', 'red', 'yellow', 'white'])]
                L.hl(x, wy + hh_ - 1, 7, R['leaf'][2])
                for fx in range(x, x + 7, 2):
                    L.px(fx, wy + hh_ - 2, fc[4]); L.px(fx + 1, wy + hh_ - 1, R['leaf'][4])
        if k == 0 and risal:                                                           # the balcony
            bx0, bx1 = xs[min(risal)] - 2, xs[max(risal)] + 9
            L.rect(bx0, ybot - 1, bx1 - bx0, 2, S[5]); L.hl(bx0, ybot - 1, bx1 - bx0, S[6])
            L.hl(bx0, ybot - 5, bx1 - bx0, I[2])
            for x in np.arange(bx0, bx1, 1.5):
                L.vl(x, ybot - 5, 4, I[1], t=TH)
        ybot = y0
    # the string course over the ground floor
    L.hl(0, yg - 1, w, S[6]); L.hl(0, yg, w, S[4]); L.hl(0, yg + 1, w, body[3] if smooth else body[1])
    # ---- the ground floor: windows, the door with its stoop, the souterrain
    yf = yb - ST_FAR
    L.rect(0, yf, w, ST_FAR, S[3]); L.hl(0, yf, w, S[5]); L.hl(0, yb - 1, w, S[1])
    for i, x in enumerate(xs):
        if i == mid:
            dx, dw, dh = x - 1, 9, yf - yg - 2                                         # 19 px + the frame: ~1 storey
            dy = yf - dh
            L.rect(dx - 1, dy - 1, dw + 2, dh + 1, S[5]); L.vl(dx - 1, dy - 1, dh + 1, S[6]); L.vl(dx + dw, dy, dh, S[2])
            L.rect(dx, dy, dw, dh, D[2])
            L.rect(dx, dy, dw, 4, G[1]); L.hl(dx, dy + 4, dw, S[5])                   # the fanlight
            for fx in (dx + 2, dx + 4, dx + 6):
                L.line(dx + 4, dy + 3.5, fx, dy, S[5], t=TH)
            L.vl(dx + 4, dy + 5, dh - 5, D[1]); L.vl(dx, dy + 5, dh - 5, D[4])
            L.rect(dx + 1, dy + 7, 2, 4, D[1]); L.rect(dx + 6, dy + 7, 2, 4, D[1])
            L.rect(dx + 1, dy + 13, 2, 4, D[1]); L.rect(dx + 6, dy + 13, 2, 4, D[1])
            L.px(dx + 5, dy + 11, R['yellow'][5])
            # the stoop: a landing and steps down to both sides, iron rails
            L.rect(dx - 2, yf, dw + 4, 2, S[5]); L.hl(dx - 2, yf, dw + 4, S[6])
            for j in range(2):
                L.rect(dx - 4 - j * 2, yf + 2 + j * 2, 2, ST_FAR - 2 - j * 2, S[4]); L.hl(dx - 4 - j * 2, yf + 2 + j * 2, 2, S[6])
                L.rect(dx + dw + 2 + j * 2, yf + 2 + j * 2, 2, ST_FAR - 2 - j * 2, S[4]); L.hl(dx + dw + 2 + j * 2, yf + 2 + j * 2, 2, S[6])
            L.line(dx - 2, yf - 4, dx - 8, yb - 4, I[1], t=TH); L.line(dx + dw + 1, yf - 4, dx + dw + 7, yb - 4, I[1], t=TH)
            L.rect(dx + dw + 2, dy + 2, 2, 3, I[1]); L.px(dx + dw + 2.5, dy + 3, R['yellow'][5])   # a lamp by the door
            info['lamp'] = (dx + dw + 3, dy + 3)
            info['door'] = (dx, dy, dw, dh)
        else:
            gh_ = 13
            gy = yg + 3
            if smooth:
                L.rect(x - 1, gy - 1, 9, gh_ + 2, body[6])
            b = window(L, x, gy, 7, gh_, Tr, G, rng, None if smooth else body)
            info['win'].append(b)
            L.rect(x + 3, gy - 2, 1, 2, S[6])
            L.rect(x + 1, yf + 2, 5, ST_FAR - 3, G[0]); L.hl(x + 1, yf + 1, 5, S[6]); L.px(x + 1, yf + 2, G[2])   # basement
    # a downpipe
    px_ = w - 3 if rng.random() < 0.5 else 2
    L.vl(px_, yc + 5, yf - yc - 5, I[2]); L.px(px_, yc + 5, I[4])
    for yy_ in range(yc + 12, yf, 12):
        L.hl(px_ - 0.5, yy_, 2, I[4])
    info['storey'] = sum(ups) / len(ups)
    return L, info


def arch_window(L, x, y, w, h, T, G, sill=True):
    L.rect(x - 1, y, w + 2, h + 1, T[6])
    L.rect(x, y + 2, w, h - 2, G[1])
    r = w / 2
    for i in sub(0, r):
        hw = r * math.sqrt(max(0.0, 1 - ((r - i - D1 / 2) / r) ** 2))
        L.rect(x + w / 2 - hw, y + i, 2 * hw, D1, G[1])
    L.rect(x, y + r, max(1, w // 2), h // 2, G[3]); L.px(x, y + r, G[5])
    L.vl(x + w / 2 - 0.25, y + 1, h - 1, T[5], t=TH)
    for f in (0.42, 0.66, 0.86):
        L.hl(x, y + h * f, w, T[5], t=TH)
    if sill:
        L.hl(x - 1, y + h, w + 2, T[3])


def carre(rng):
    """Carre (an own impression) at 20 m: a long pale theatre front, 40 x 20 m (260 x 130 at the far bank). From the
       bottom: a plinth; a rusticated arcade of entrances with lanterns; a stone fascia with the name in large
       letters; the tall piano nobile of arched windows between paired pilasters over little balustrades; the
       entablature; the attic balustrade with urns, the central pediment; the end pavilions stand forward with
       Palladian windows and domed lanterns. Only the lower 100 px show under the top of the screen."""
    T = R['plaster']; S = R['stone']; G = R['glass']; Y = R['yellow']; Wt = R['white']; K = R['black']; RD = R['red']
    SL = R['roof_slate']; I = R['iron']
    W, H = CARRE_W, CARRE_H
    pv = 40                                                    # the end pavilions
    L = Layer(W, H)
    ypl = H - 3; ya = ypl - 36; yfa = ya - 12; yn = yfa - 46; ye = yn - 12
    # ---- the walls
    L.rect(0, ye, W, H - ye, T[5])
    xx, yy = grid(0, ye, W, H - ye)
    n = fbm(xx / 13.0, yy / 8.0, 61, 3)
    L.put(0, ye, np.broadcast_to(np.array(T[4], np.uint8), xx.shape + (3,)), (n < 0.36) & chk(xx, yy))
    L.put(0, ye, np.broadcast_to(np.array(T[6], np.uint8), xx.shape + (3,)), (n > 0.68) & chk(xx + 1, yy))
    for y in range(ya + 2, ypl, 4):                            # rustication of the arcade storey
        L.hl(0, y, W, T[4])
    for (px0, side) in ((0, -1), (W - pv, 1)):                 # the pavilions: lit and shaded edges, quoins
        L.vl(px0, ye, H - ye, T[6]); L.vl(px0 + pv - 1, ye, H - ye, T[3])
        for y in range(ye + 2, ypl, 4):
            for qx in (px0, px0 + pv - 3):
                L.rect(qx, y, 3 if (y // 4) % 2 else 2, 2, S[5] if qx == px0 else S[4])
    # ---- the plinth
    L.rect(0, ypl, W, 3, S[3]); L.hl(0, ypl, W, S[5]); L.hl(0, H - 1, W, S[1])
    # ---- the arcade: ten arches in the middle, lanterns on the piers
    for k in range(10):
        x = pv + 18 * k + 4
        top = ya + 6
        L.rect(x - 1, top + 4, 12, ypl - top - 4, S[5])
        for i in sub(0, 6):
            hw = 6 * math.sqrt(max(0.0, 1 - ((5.5 - i) / 6.0) ** 2))
            L.rect(x + 5 - hw, top - 1 + i, 2 * hw, D1, S[5])
        L.rect(x + 4, top - 2, 2, 3, S[6])                                         # the keystone
        L.rect(x, top + 5, 10, ypl - top - 5, K[2])
        for i in sub(0, 5):
            hw = 5 * math.sqrt(max(0.0, 1 - ((4.5 - i) / 5.0) ** 2))
            L.rect(x + 5 - hw, top + i, 2 * hw, D1, K[2])
        L.rect(x + 1, top + 4, 8, 6, G[1]); L.px(x + 2, top + 5, Y[5]); L.px(x + 6, top + 6, Y[4])   # the fanlights, lit
        L.vl(x + 5, top + 4, 6, S[4], t=TH)
        L.rect(x + 1, top + 11, 4, ypl - top - 12, G[0]); L.rect(x + 5.5, top + 11, 3.5, ypl - top - 12, G[0])  # the doors
        L.hl(x + 1, top + 11, 8, S[4]); L.px(x + 4, top + 18, Y[5]); L.px(x + 5.5, top + 18, Y[5])
        L.hl(x, ypl - 1, 10, S[2])
        if k % 2 == 1:                                                              # a lantern on the pier
            lx = x - 4
            L.hl(lx - 1, top + 6, 3, I[1]); L.rect(lx - 1, top + 7, 3, 4, I[1]); L.rect(lx - 0.5, top + 7.5, 2, 3, Y[5])
            L.px(lx, top + 5, I[2])
    for (px0, c) in ((0, 'red'), (W - pv, 'yellow')):                              # the pavilions: posters and a door
        for j, pc in enumerate((c, 'blue')):
            bx = px0 + 5 + j * 18
            L.rect(bx - 1, ya + 6, 13, 24, S[5]); L.rect(bx, ya + 7, 11, 22, R[pc][4]); L.hl(bx, ya + 7, 11, R[pc][6])
            L.rect(bx + 2, ya + 10, 7, 6, K[3]); L.hl(bx + 1, ya + 19, 9, Wt[5]); L.hl(bx + 1, ya + 22, 7, Wt[4])
            L.hl(bx + 1, ya + 25, 9, R[pc][2])
    # ---- the fascia with the name
    L.rect(0, yfa, W, 12, S[5]); L.hl(0, yfa, W, S[6]); L.hl(0, yfa + 1, W, S[3]); L.hl(0, yfa + 11, W, S[2]); L.hl(0, yfa + 10, W, S[4])
    word = 'THEATER CARRE'
    text2(L, W / 2 - text2_w(word) / 2, yfa + 2, word, RD[2])
    for px0 in (10, W - 30):
        for rx in (px0, px0 + 10, px0 + 20):
            L.ellipse(rx, yfa + 6, 2.2, 2.2, S[3]); L.ellipse(rx - 0.3, yfa + 5.7, 1.1, 1.1, S[6])
    # ---- the piano nobile: arched windows between paired pilasters, little balustrades
    for k in range(10):
        x = pv + 18 * k + 4
        arch_window(L, x, yn + 7, 10, 30, Wt, G)
        L.rect(x - 1, yfa - 6, 12, 1, S[6]); L.rect(x - 1, yfa - 2, 12, 1, S[3])
        for bx in np.arange(x, x + 10, 2):
            L.vl(bx, yfa - 5, 3, S[5]); L.px(bx + 1, yfa - 4, S[2])
        L.rect(x + 3, yn + 4, 4, 3, S[5]); L.px(x + 4.5, yn + 4, S[6])                 # a carved head over the arch
    for k in range(11):
        x = pv + 18 * k - 3                                                         # the paired pilasters
        for dx in (0, 3):
            L.rect(x + dx, yn + 3, 2, yfa - yn - 3, T[6]); L.vl(x + dx + 1, yn + 3, yfa - yn - 3, T[4])
        L.rect(x - 1, yn + 1, 7, 2, S[6]); L.hl(x - 1, yn + 3, 7, S[3])
    for px0 in (0, W - pv):                                                         # the pavilions' Palladian windows
        cx = px0 + pv / 2
        arch_window(L, cx - 6, yn + 6, 12, 32, Wt, G)
        for sx in (cx - 15, cx + 9):
            L.rect(sx - 1, yn + 14, 8, 25, Wt[6]); L.rect(sx, yn + 15, 6, 23, G[1]); L.rect(sx, yn + 15, 3, 10, G[3])
            L.hl(sx, yn + 26, 6, Wt[5], t=TH); L.vl(sx + 3, yn + 15, 23, Wt[5], t=TH)
        L.hl(cx - 17, yn + 13, 34, S[6]); L.hl(cx - 17, yn + 39, 34, S[3])
        for j in sub(0, 4):                                                        # a pediment cap
            hw = 9 * (j + D1) / 4
            L.rect(cx - hw, yn + 1 + j, 2 * hw, D1, S[5])
    # ---- the entablature
    L.hl(0, ye + 10, W, S[3]); L.hl(0, ye + 11, W, T[3])
    L.rect(0, ye + 4, W, 6, T[5]); L.hl(0, ye + 4, W, S[3])
    for x in range(3, W, 9):
        L.ellipse(x, ye + 7, 1.6, 1.4, S[4])                                       # the frieze's wreaths
    L.rect(-1, ye, W + 2, 4, S[5]); L.hl(-1, ye, W + 2, S[6])
    for x in range(0, W, 2):
        L.px(x, ye + 3, S[2])
    # ---- the attic: the balustrade with urns, the central pediment, the pavilions' domes
    L.hl(0, ye - 1, W, S[3])
    for x in range(1, W, 2):
        L.vl(x, ye - 5, 4, S[5] if (x // 2) % 2 else S[3])
    L.hl(0, ye - 6, W, S[6])
    for x in range(pv + 8, W - pv - 4, 18):
        L.rect(x, ye - 10, 3, 4, S[4]); L.ellipse(x + 1.5, ye - 10, 2, 1.5, S[5])
    cx = W / 2
    for i in sub(0, 17):
        hw = 44 * (i + D1) / 17
        L.rect(cx - hw, ye - 17 + i, 2 * hw, D1, S[5]); L.rect(cx - hw, ye - 17 + i, 1.5, D1, S[6]); L.rect(cx + hw - 1.5, ye - 17 + i, 1.5, D1, S[3])
    L.ellipse(cx, ye - 6, 7, 4, S[3]); L.ellipse(cx, ye - 6.5, 4, 2.4, Y[4])
    for px0 in (0, W - pv):
        dc = px0 + pv / 2
        for i in sub(0, 14):
            hw = 17 * math.sqrt(max(0.0, 1 - ((13.5 - i) / 14.0) ** 2))
            L.rect(dc - hw, ye - 14 + i, 2 * hw, D1, SL[3] if int(i * DET) % 2 else SL[2]); L.rect(dc - hw, ye - 14 + i, 2, D1, SL[5])
        L.rect(dc - 2, ye - 20, 4, 6, S[5]); L.ellipse(dc, ye - 21, 2, 2, Y[5])
    return L


def car_far2(rng, c=None):
    """A parked car at the far bank's scale: 4.3 x 1.5 m (28 x 10 px); sometimes a van (5 m)."""
    C = R[c or rng.choice(['red', 'blue', 'white', 'black', 'iron', 'green', 'yellow', 'white'])]
    G = R['glass']; K = R['black']
    van = rng.random() < 0.18
    w = 32 if van else rng.randint(27, 29)
    L = Layer(w, 11)
    if van:
        L.rect(0, 1, w - 7, 8, C[4]); L.rect(w - 7, 4, 7, 5, C[4]); L.rect(w - 8, 2, 5, 3, G[2]); L.hl(0, 1, w - 7, C[6])
        L.hl(0, 8, w, C[2]); L.vl(0, 1, 8, C[5]); L.px(w - 1, 6, R['yellow'][6])
        L.rect(3, 3, 6, 3, G[1]); L.vl(12, 2, 6, C[2])
    else:
        L.rect(0, 5, w, 4, C[4])
        L.rect(5, 2, w - 12, 3, C[4]); L.px(4, 4, C[4]); L.px(w - 7, 4, C[4]); L.px(w - 7, 3, C[3])
        L.hl(6, 2, w - 14, C[6]); L.hl(0, 5, w, C[5]); L.hl(0, 8, w, C[2])
        L.rect(6, 3, (w - 14) // 2, 2, G[2]); L.rect(7 + (w - 14) // 2, 3, (w - 14) // 2 - 1, 2, G[1]); L.px(6, 3, G[4])
        L.vl(w // 2, 5, 3, C[2], t=TH)                                              # the door line
        L.px(0, 6, R['red'][5]); L.px(w - 1, 6, R['yellow'][6])
    for wx in (3, w - 8):
        if U == 1:
            L.rect(wx, 7, 5, 3, K[1]); L.px(wx, 7, C[2]); L.px(wx + 4, 7, C[2]); L.px(wx + 2, 8, K[4])
        else:
            L.ellipse(wx + 2.5, 8.3, 2.6, 2.0, C[1]); L.ellipse(wx + 2.5, 8.5, 2.2, 1.7, K[1]); L.ellipse(wx + 2.5, 8.5, 0.9, 0.7, K[4])
    L.hl(1, 10, w - 2, K[0])
    return L


def bank_row(F, x0, x1, yb, rng, seed=300):
    """The far bank's fronts at the scale rule: long mansions (ground floor + 2 or 3 upper floors) between canal
       houses of the kit at sc 1.0 (ground floor + 2 storeys + the gable)."""
    infos = []
    x = x0
    i = 0
    while x < x1:
        if rng.random() < 0.5 and x1 - x > 90:
            w = rng.randint(80, 118)
            if x1 - (x + w) < 34:
                w = x1 - x
            nup = 3 if rng.random() < 0.2 else 2
            L, info = mansion(rng, w, nup, rng.choice(['plaster', 'plaster', 'ochre', 'brick', 'grey']), seed=seed + i,
                              roof='flat' if nup == 3 else 'mansard')
            SCALE_LOG['storeys'].append(info['storey'])
        else:
            w = rng.randint(32, 46)
            if x1 - (x + w) < 28:
                w = x1 - x
            kind = rng.choice(['neck', 'bell', 'step', 'cornice', 'spout', 'neck'])
            hb = rng.randint(66, 70)
            if kind == 'cornice':
                hb += 4
            L, info = house(rng, w, hb, kind, rng.choice(BRICKS), sc=1.0, doorc=rng.choice(['green', 'black', 'red', 'blue']),
                            seed=seed + i * 7)
            avail = hb - GF_FAR - (3 if kind in ('neck', 'bell') else 2)                # kit house(): its storey
            SCALE_LOG['storeys'].append(avail / max(1, int(math.floor(avail / 20.0 + 0.5))))
        F.blit(L, x, yb - L.h)
        info['x'] = x; info['y'] = yb - L.h; info['w'] = w
        info['win'] = [(x + a, yb - L.h + b, c, d) for (a, b, c, d) in info['win']]
        infos.append(info)
        x += w
        i += 1
    return infos


def stone_quay(L, x, y, w, h, rng, seed=7):
    """The Amstel's tall stone quay wall: courses of dressed blocks, a heavy coping, mooring rings, drain mouths,
       iron ladders, rust runs and the dark wet band with moss at the water."""
    S = R['stone']; I = R['iron']; M = R['moss']; K = R['black']
    xx, yy = grid(x, y + 2, w, h - 2)
    row = np.floor((yy - y - 2) / 3.0)
    blk = np.floor((xx + (row % 2) * 4) / 8.0)
    hv = hash01(blk, row, seed)
    n = fbm(xx / 14.0, yy / 6.0, seed + 1, 2)
    t = 3 + (hv > 0.82).astype(int) - (hv < 0.18).astype(int) + (n > 0.62).astype(int) - (n < 0.36).astype(int)
    t = np.where(((yy - y - 2) % 3.0) < (1.0 / DET) * 0.6, 2, t)
    wet = (yy > y + h - 5) | ((yy > y + h - 8) & (hash01(xx * DET, np.floor(yy), seed + 2) > 0.6))
    t = np.where(wet, 1, t)
    L.put(x, y + 2, np.array(S, np.uint8)[np.clip(t, 0, 6)], np.ones(xx.shape, bool))
    m_ = (yy > y + h - 4) & (hash01(xx * DET, yy * DET, seed + 3) > 0.35)
    L.put(x, y + 2, np.where((hash01(xx, yy, seed + 4) > 0.5)[..., None], np.array(M[2], np.uint8), np.array(M[1], np.uint8)), m_)
    L.rect(x, y, w, 2, S[5]); L.hl(x, y, w, S[6]); L.hl(x, y + 2, w, S[1])
    xr = x + rng.randint(4, 14)
    while xr < x + w - 4:
        k = rng.random()
        if k < 0.45:                                                          # a mooring ring
            L.ring(xr, y + 6, 1.6, I[1], 0.8 if U > 1 else 0.5); L.px(xr, y + 4, I[3])
            for j in range(rng.randint(2, 6)):
                L.px(xr + (j // 3) % 2 * 0.5, y + 8 + j, S[2])
        elif k < 0.6:                                                         # a drain mouth
            L.rect(xr - 1, y + h - 9, 3, 2, K[1]); L.vl(xr, y + h - 7, 3, S[2])
        elif k < 0.7:                                                         # an iron ladder
            L.vl(xr - 1, y + 2, h - 4, I[2], t=TH); L.vl(xr + 1.5, y + 2, h - 4, I[2], t=TH)
            for yy_ in range(y + 4, y + h - 2, 2):
                L.hl(xr - 1, yy_, 3, I[1], t=TH)
        xr += rng.randint(12, 30)
    for xb in range(x + 3, x + w - 2, 9):                                    # bollards on the coping
        if rng.random() < 0.55:
            L.rect(xb, y - 3, 2, 3, I[2]); L.hl(xb, y - 3, 2, I[4])




def ramp_wall(F, bp, half, run, y_top, YQ, rng, white=False):
    """The far quay's street rises to a bridge: a brick (or white-railed) ramp on each side of the landing at layer
       x bp, from the quay top YQ up to the deck y_top over `run` px; its river face is the quay wall built up."""
    B = R['brick_brown']; S = R['stone']; I = R['iron']; T = R['white']
    for sg in (-1, 1):
        for x in sub(0, run):
            t = x / run
            yy = y_top + (YQ - y_top) * t ** 1.3
            px_ = bp + sg * (half + x) - (D1 if sg < 0 else 0)
            F.rect(px_, yy, D1, YQ - yy + 0.01, B[2] if hash01(np.array(px_ * U), np.array(yy), 3) > 0.25 else B[3])
            F.rect(px_, yy - 0.01, D1, 1, S[6])
            F.rect(px_, yy + 1, D1, 0.5, S[3])
            # the railing on the ramp
            if white:
                F.rect(px_, yy - 4, D1, TH, T[5]); F.rect(px_, yy - 2, D1, TH, T[4])
                if int(x * U) % int(3 * U) == 0:
                    F.rect(px_, yy - 4, TH, 4, T[5])
            else:
                F.rect(px_, yy - 4, D1, TH, I[2])
                if int(x * U) % int(3 * U) == 0:
                    F.rect(px_, yy - 4, TH, 4, I[1])


def amstel_bank(sec, rng, YH=100, YQ=104, YW=120, speed=0.5, carre_x=1091, landings=()):
    """The Amstel's far bank in one layer (speed 0.5 = depth 58), at the scale rule (6.5 px per metre): mansions and
       canal houses on their street, Carre (20 m), elms of 14-16 m on the quay, parked cars (4.3 m) and bikes, lamps
       (4.8 m), the stone quay wall (2.5 m), moored boats (houseboats 15-19 m, barges, a tour boat 22 m, sloops 6 m),
       and the bridges' landings (ramps, the dark under the deck ends). Returns (F, info)."""
    WF = sec.lw(speed)
    F = Layer(WF, VIEW_H)
    info = dict(win=[], lamps=[])
    for k in SCALE_LOG:
        SCALE_LOG[k] = []
    c0, c1 = int(carre_x - CARRE_W / 2), int(carre_x + CARRE_W / 2)
    infos = bank_row(F, 0, c0, YH, random.Random(41)) + bank_row(F, c1, WF, YH, random.Random(43), seed=500)
    for i in infos:
        info['win'] += i['win']
    CA = carre(rng)
    F.blit(CA, c0, YH - CA.h)
    info['carre'] = (c0, YH - CA.h, CA.w, CA.h)
    # trees: elms along the quay, 14-16 m, spaced so that most fronts show (none in front of Carre, none on landings)
    tl = []
    x = 40
    while x < WF - 10:
        bad = (c0 - 20 < x < c1 + 20) or any(abs(x - bp) < 70 for (bp, _) in landings)
        if not bad:
            th, ch = rng.randint(30, 35), rng.randint(60, 68)
            t = tree_far(rng, rng.randint(64, 76), ch, th, leaf='leaf_gold', seed=rng.randint(1, 999), tw=4)
            tl.append((x - t.w // 2, YQ - t.h, t))
            SCALE_LOG['trees'].append(t.h)
            x += rng.randint(170, 250)
        else:
            x += 24
    far_street(F, 0, WF, YH, YQ, rng, 1)
    for i in infos:
        if rng.random() < 0.6:
            F.blit(bike_far(rng), i['x'] + rng.randint(2, max(3, i['w'] - 14)), YH - 6)
    x = 6
    while x < WF - 34:
        if any(abs(x + 14 - bp) < 72 for (bp, _) in landings):
            x += 10
            continue
        k = rng.random()
        if k < 0.42:
            c = car_far2(rng); F.blit(c, x, YQ - c.h + 1); x += c.w + rng.randint(5, 16)
            SCALE_LOG['cars'].append(c.w)
        elif k < 0.66:
            for j in range(rng.randint(1, 3)):
                F.blit(bike_far(rng), x, YQ - 7); x += 9
            x += 8
        else:
            x += rng.randint(10, 24)
    for lx in range(34, WF, 92):
        if not any(abs(lx - bp) < 72 for (bp, _) in landings):
            lp = lamp_far(31)
            F.blit(lp, lx, YQ - lp.h + 1)
            info['lamps'].append((lx + 2, YQ - lp.h + 4))
            SCALE_LOG['lamps'].append(lp.h)
    for (tx, ty, t) in tl:
        F.blit(t, tx, ty)
    stone_quay(F, 0, YQ, WF, YW - YQ, rng, 7)
    # moored boats along the wall (none at the landings)
    bx = 10
    kinds = ['house', 'sloop', 'barge', 'sloop', 'house', 'tour', 'sloop', 'house', 'barge', 'sloop']
    k = 0
    while bx < WF - 60:
        kind = kinds[k % len(kinds)]
        if kind == 'house':
            b, wins = houseboat(rng, rng.randint(100, 124), rng.choice(['white', 'green', 'blue', 'wood'])); by = YW - b.h + 2
        elif kind == 'barge':
            b, wins = barge(rng, rng.randint(132, 150)); by = YW - b.h + 3
        elif kind == 'tour':
            b, wins = tourboat(rng, 144), []; by = YW - b.h + 2
        else:
            b, wins = sloop(rng, rng.randint(36, 41)), []; by = YW - 7
        if any((bx - 34 < bp < bx + b.w + 34) for (bp, _) in landings):
            bx += 20
            continue
        F.blit(b, bx, by)
        SCALE_LOG['boats'].append((kind, b.w))
        bx += b.w + rng.randint(14, 56)
        k += 1
    # the bridges' landings: ramps up to the deck (y 86 at this depth), the dark under the deck's far end
    for (bp, kind) in landings:
        half = 16.5 if kind == 'low' else 32.5
        ytop = yrow(GY - 112, BACK_D)
        yund = yrow(GY - 127, BACK_D)
        ramp_wall(F, bp, half, 46, ytop, YQ, rng, white=(kind != 'low'))
        F.rect(bp - half, ytop, 2 * half, YQ - ytop, R['brick_brown'][2] if kind == 'low' else R['white'][3])
        # under the deck's far end: the abutment and the quay wall in the deck's shade, an arch through to the water
        brickfill(F, bp - half, yund, 2 * half, YQ - yund, R['brick_brown'], int(bp), lo=1, hi=3, mid=2)
        v = F.view(bp - half, yund, 2 * half, YW - yund)
        if v.size:
            v[..., :3] = snap5(v[..., :3].astype(float) * np.array((0.52, 0.46, 0.52)))
        xx, yy = grid(bp - half, yund, 2 * half, YW - yund)
        tt = (xx - bp) / (half - 3)
        arch = (np.abs(tt) < 1) & (yy > yund + 6 + 8 * (1 - np.sqrt(np.clip(1 - tt * tt, 0, 1))))
        F.put(bp - half, yund, np.broadcast_to(np.array(R['black'][0], np.uint8), xx.shape + (3,)), arch)
        F.put(bp - half, yund, np.broadcast_to(np.array(R['brick_brown'][0], np.uint8), xx.shape + (3,)), arch & (yy > YW - 5) & chk(xx, yy))
        F.hl(bp - half, yund, 2 * half, R['black'][1])
    F.clear(0, YW + 1, F.w, F.h)
    info['trees'] = tl
    info['scale'] = {k: list(v) for k, v in SCALE_LOG.items()}
    return F, info


# ================================================================ furniture of the two quays
def pile(rng=None, seed=1):
    """A mooring dolphin: three tarred timbers bound with steel bands, pale weathered tops (6 x 26, feet at the water)."""
    W = R['wood']; S = R['stone']; I = R['iron']; M = R['moss']
    L = Layer(8, 28)
    for (x, top) in ((0.6, 5), (4.4, 4), (2.5, 1)):
        L.rect(x, top, 2.4, 28 - top, W[1]); L.rect(x, top, 0.8, 28 - top, W[3]); L.rect(x + 1.8, top, 0.6, 28 - top, W[0])
        L.ellipse(x + 1.2, top, 1.2, 0.6, S[4]); L.rect(x + 0.4, top - 0.3, 0.8, 0.5, S[6])
    for y in (8, 18):
        L.rect(0.3, y, 7.0, 1.0, I[3]); L.hl(0.3, y, 7.0, I[5], t=TH)
    L.rect(0.4, 24, 7, 4, M[1]); L.hl(0.4, 24, 7, M[2])
    return L


def pile_mirror(seed=1):
    W = R['wood']
    L = Layer(10, 8)
    xx, yy = grid(0, 0, 10, 8)
    xs = xx - np.round(1.2 * np.sin(np.floor(yy * DET) / DET * 2.1))
    m = chk(xs, yy) & (hash01(xs / 2, yy * DET, seed) > 0.25 + yy * 0.09) & (xs >= 1) & (xs < 8)
    L.put(0, 0, np.broadcast_to(np.array(W[0], np.uint8), xx.shape + (3,)), m)
    return L


def route_sign(word, w):
    """A cruise sign on two posts: a dark blue board with a white rim, the word, an arrow (w x 36, feet at the bottom)."""
    Bl = R['blue']; Wt = R['white']; I = R['iron']; Y = R['yellow']
    L = Layer(w, 36)
    bw = w - 2
    L.rect(1, 6, bw, 13, Bl[2]); L.hl(1, 6, bw, Bl[4]); L.hl(1, 18, bw, Bl[0])
    L.rect(2, 7, bw - 2, 11, Bl[2])
    L.hl(2, 7, bw - 2, Wt[5], t=TH); L.hl(2, 17, bw - 2, Wt[4], t=TH); L.vl(2, 7, 11, Wt[5], t=TH); L.vl(bw, 7, 11, Wt[4], t=TH)
    tw = text_w(word)
    text(L, 1 + (bw - tw - 7) / 2, 10, word, Wt[6])
    ax = 1 + (bw + tw - 7) / 2 + 2
    L.hl(ax, 12, 5, Y[5]); L.px(ax + 3, 11, Y[5]); L.px(ax + 3, 13, Y[5]); L.px(ax + 4, 12, Y[6])
    for x in (6, w - 8):
        L.rect(x, 19, 2, 17, I[2]); L.vl(x, 19, 17, I[4]); L.hl(x - 1, 35, 4, I[1])
    L.rect(4, 2, w - 8, 4, Wt[5]); L.hl(4, 2, w - 8, Wt[6]); text(L, 6, 1.5, '', Wt[0])
    L.rect(5, 3, w - 10, 2, R['red'][4])
    return L


def market_stall(rng):
    """A Waterlooplein flea-market stall: a striped awning on poles, a table of second-hand goods (58 x 46)."""
    W = R['wood']; I = R['iron']; Wt = R['white']; C = R['canvas']; Rd = R['red']; G = R['green']
    L = Layer(58, 46)
    for x in (2, 54):
        L.rect(x, 8, 2, 38, I[2]); L.vl(x, 8, 38, I[4])
    for j in range(9):
        for x in range(0, 58):
            c = (G if ((x + j // 3) // 4) % 2 == 0 else Wt)[5 if j < 2 else (4 if j < 7 else 3)]
            L.px(x, 2 + j, c)
    for x in range(0, 58, 4):                                                 # the scalloped valance
        L.rect(x, 11, 3, 2, (G if (x // 4) % 2 == 0 else Wt)[3]); L.px(x + 1, 13, (G if (x // 4) % 2 == 0 else Wt)[2])
    L.hl(0, 2, 58, Wt[6])
    L.rect(4, 28, 50, 3, W[4]); L.hl(4, 28, 50, W[6]); L.hl(4, 30, 50, W[1])
    L.rect(5, 31, 48, 13, C[2]); L.hl(5, 31, 48, C[1])
    for x in range(6, 52, 6):
        L.vl(x, 32, 12, C[1], t=TH)
    # goods: records in crates, books, a lamp, folded clothes, a hanging coat
    for k, x in enumerate(range(6, 50, 7)):
        kind = ['rec', 'book', 'cloth', 'rec', 'book', 'lamp', 'cloth'][k % 7]
        if kind == 'rec':
            L.rect(x, 22, 6, 6, W[2]); L.hl(x, 22, 6, W[4])
            for i in range(3):
                L.vl(x + 1 + i * 2, 20, 3, R['black'][1 + i % 2]); L.px(x + 1 + i * 2, 20, R[rng.choice(['red', 'yellow', 'blue'])][4])
        elif kind == 'book':
            for i in range(5):
                L.rect(x + i, 22 + (i % 2), 1, 6 - (i % 2), R[rng.choice(['red', 'blue', 'green', 'canvas', 'yellow'])][3 + i % 2])
        elif kind == 'cloth':
            for i in range(3):
                L.rect(x, 26 - i * 2, 6, 2, R[rng.choice(['red', 'blue', 'canvas', 'white'])][4 - i % 2])
        else:
            L.vl(x + 3, 19, 9, I[2]); L.rect(x + 1, 17, 5, 3, R['yellow'][5]); L.hl(x + 1, 17, 5, R['yellow'][6])
    L.vl(30, 13, 4, I[1]); L.rect(27, 16, 7, 10, R['brick_brown'][3]); L.vl(27, 16, 10, R['brick_brown'][4])
    return L
