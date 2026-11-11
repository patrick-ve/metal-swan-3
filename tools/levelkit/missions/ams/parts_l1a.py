# Parts of section a (GRACHTENGORDEL, bright spring morning) of level 1 in the canal look.
# Daylight first, ramps only; the planes are graded by Sec.flush (key + curve).
#
# Things that run in depth are painted in true perspective with the tools the page already has:
# - a raised bridge deck: thin depth slices, each in the plane of its own depth (its own speed);
# - the top face of an awning, a boat deck or a cabin roof: a 'rows' layer (one speed per screen row);
# - the lift bridge: columns, girders, sheaves and ropes in the planes of their depths; the column sides in thin
#   depth slices; the portal and the barrier arms (things that lie along the depth) as 'rows' layers.
import math
import random
import numpy as np
from parts_ams import *

A = lambda name: np.array(R[name], np.uint8)
R['paint_grey'] = ramp(7, .30, .80, .014, .020, .024, 258, 236)     # painted brick, blue-grey (calmer steps than stone)
R['paint_cream'] = ramp(7, .38, .90, .020, .034, .044, 70, 92)      # painted brick, cream
R['cream'] = ramp(7, .42, .97, .022, .040, .046, 72, 88)            # cream-white woodwork
R['brick_smoke'] = ramp(7, .22, .74, .012, .026, .022, 262, 236)   # smoked (gesmoorde) paving bricks, blue-grey
R['sett_warm'] = ramp(7, .30, .88, .024, .030, .036, 40, 82)        # granite setts with a brown cast
R['sett_cool'] = ramp(7, .29, .87, .016, .020, .026, 250, 230)      # granite setts with a blue cast
KLINKER_BAND = (3204.0, 9.0, 11.8)                                   # the FABEL FRIET square's klinker border: west edge to
                                                                     # u 3204, and the band d 9-11.8 along the fronts
TREE_PITS = [(60, 24, 12.0, 7.0), (620, 9, 11.0, 4.4), (1440, 24, 12.0, 7.0), (1712, 25, 12.0, 5.6)]   # the elms' pits (x, depth, half sizes)
GUTTERS = [(3190, 3584, 12.4)]                                       # granite gutters along the house fronts of a square
COVERS = [(1520, -6.0), (1790, 9.0), (3270, -9.0), (3470, 4.0)]      # iron covers (manholes) in the squares


# ---------------------------------------------------------------- helpers
def hump(u, b):
    """The bridge's rise over the street (world px) at u: a cosine hump, 0 at both ends, b['h'] in the middle."""
    u = np.asarray(u, float)
    c = b['x0'] + b['len'] / 2.0
    t = np.clip((u - c) / (b['len'] / 2.0), -1, 1)
    return np.where(np.abs(u - c) <= b['len'] / 2.0, b['h'] / 2.0 * (1 + np.cos(np.pi * t)), 0.0)


def plane_fill(sec, depth, u0, u1, y0, y1, fn, front=False):
    """Paint pixels of the plane at this depth for the world span u0..u1 and the screen rows y0..y1.
       fn(u, y, k, sp) -> (rgb uint8 (h, w, 3), mask (h, w)); u, y: world x and screen y of each real pixel."""
    Lp, k = sec.plane(depth, front)
    sp = s_d(k)
    p0 = sec.at(u0, sp) - 1
    p1 = sec.at(u1, sp) + 1
    xx, yy = grid(p0, y0, p1 - p0, y1 - y0)
    if xx.size == 0:
        return k
    u = 192 + (xx + 0.5 / U - 192) / sp
    y = yy + 0.5 / U
    rgb, m = fn(u, y, k, sp)
    Lp.put(p0, y0, rgb, m)
    return k


def put_top(sec, part, x, depth, ax, ytop, front=False):
    """Blit a part with its top row at screen y `ytop`, its anchor ax at world x, in the plane of this depth."""
    Lp, k = sec.plane(depth, front)
    Lp.blit(part, sec.at(x, s_d(k)) - ax, ytop)
    return k


def text2(L, x, y, t, c, s=2, shade=None):
    """Our 3 x 5 font at s times its size, with an optional drop shade (one pixel down and right)."""
    for pass_, col, off in ((0, shade, 1), (1, c, 0)):
        if col is None:
            continue
        xx = x
        for ch in t:
            g = FONT[ch]
            for j, row in enumerate(g):
                for i, v in enumerate(row):
                    if v == '1':
                        L.rect(xx + i * s + off, y + j * s + off, s, s, col)
            xx += (len(g[0]) + 1) * s


def text2_w(t, s=2):
    return text_w(t) * s


def rows_top(sec, hgt, d_back, items, sid):
    """The top face of things at height `hgt` over the street, from the walk line (depth 0) back to depth d_back,
       as a 'rows' layer: each real screen row scrolls at the speed of its own depth.
       items: [(u0, u1, fn(u, d) -> (rgb, mask))]. Returns the layer dict (not yet in the list)."""
    yb_ = 60 + (116 - hgt) * (116 - d_back) / 116.0
    yf = 176 - hgt
    y0 = math.floor(yb_ * U) / U
    y1 = math.ceil(yf * U) / U
    L = Layer(sec.lw(1.0) + 2, y1 - y0)
    n = L.ph
    ys = y0 + (np.arange(n) + 0.5) / U
    sv = (ys - 60) / (116 - hgt)
    dv = 116 - 116 * sv
    for (u0, u1, fn) in items:
        pa = [192 + (u0 - 192) * s for s in (sv[0], sv[-1])]
        pb = [192 + (u1 - 192) * s for s in (sv[0], sv[-1])]
        c0, c1 = max(0, P(min(pa)) - 2), min(L.pw, P(max(pb)) + 3)
        pc = (np.arange(c0, c1) + 0.5) / U
        u = 192 + (pc[None, :] - 192) / sv[:, None]
        d = np.broadcast_to(dv[:, None], u.shape)
        rgb, m = fn(u, d)
        m = m & (u >= u0) & (u < u1) & (d >= -0.05) & (d <= d_back + 0.05)
        sub_ = L.a[:, c0:c1]
        sub_[..., :3][m] = rgb[m]
        sub_[..., 3][m] = 255
    L.recolor(grader(key=sec.KEY)); L.recolor(curve(*sec.H['curve']))
    L.a[..., :3] = snap5(L.a[..., :3])
    return dict(id=sid, img=None, speed=float(sv[0]), y=y0, kind='rows', over=False, frames=[L], s0=float(sv[0]), s1=float(sv[-1]))


def insert_layer(sec, ly, depth):
    """Put a layer into the draw list just before the first plane that is nearer than `depth` (or the first over layer)."""
    for i, l in enumerate(sec.layers):
        if l.get('over') or (l.get('depth') is not None and l['depth'] < depth):
            sec.layers.insert(i, ly)
            return
    sec.layers.append(ly)


# ---------------------------------------------------------------- the skyline: the tower once
def westertoren(h=124):
    """A tall brick church tower with stone stages and a blue-and-gold crown (an own impression)."""
    B = R['brick_red']; T = R['stone']; G = R['glass']; Bl = R['blue']; Y = R['yellow']
    L = Layer(32, h)
    cx = 16
    sh = int(h * 0.46)
    y0 = h - sh
    brickfill(L, 6, y0, 20, sh, B, 61)
    L.vl(6, y0, sh, B[5]); L.vl(25, y0, sh, B[1]); L.vl(24, y0, sh, B[2])
    for y in range(y0 + 3, h, 9):                                     # stone bands
        L.hl(6, y, 20, T[5]); L.hl(6, y + 1, 20, T[3])
    for (yy, hh) in ((y0 + 14, 10), (y0 + 30, 10)):
        for x in (11, 18):
            L.rect(x, yy, 3, hh, G[0]); L.px(x, yy, T[5]); L.hl(x, yy - 1, 3, T[6])
    L.ellipse(cx, y0 + 7, 4.2, 4.2, T[6]); L.ring(cx, y0 + 7, 4.2, Y[4], 3.4)
    L.line(cx, y0 + 7, cx, y0 + 4.5, B[0]); L.line(cx, y0 + 7, cx + 2, y0 + 8, B[0])
    L.hl(4, y0, 24, T[6]); L.hl(4, y0 + 1, 24, T[3])
    y = y0
    # three stone stages, each narrower, open arches, a balustrade on each
    for (w_, hh) in ((18, int(h * 0.14)), (14, int(h * 0.12)), (10, int(h * 0.10))):
        x_ = cx - w_ // 2
        L.rect(x_, y - hh, w_, hh, T[4]); L.vl(x_, y - hh, hh, T[6]); L.vl(x_ + w_ - 1, y - hh, hh, T[2])
        for xx in range(x_ + 2, x_ + w_ - 2, 3):
            L.rect(xx, y - hh + 3, 2, hh - 5, G[0]); L.px(xx, y - hh + 3, T[3])
        L.hl(x_ - 1, y - hh, w_ + 2, T[6]); L.hl(x_ - 1, y - hh + 1, w_ + 2, T[3])
        for xx in range(x_ - 1, x_ + w_ + 1, 2):
            L.px(xx, y - hh - 1, T[5])
        y -= hh
    # the crown: a blue onion with gold ribs, an orb and a weather vane
    for j in sub(0, 10):
        t = j / 10.0
        hw = 4.5 * math.sin(math.pi * (0.25 + 0.75 * t)) + 0.5
        L.rect(cx - hw, y - 10 + j, 2 * hw, D1, Bl[3])
        L.rect(cx - hw, y - 10 + j, max(D1, hw * 0.7), D1, Bl[4])
        L.rect(cx - hw, y - 10 + j, D1, D1, Bl[5]); L.rect(cx + hw - D1, y - 10 + j, D1, D1, Bl[1])
    for xx in (cx - 2, cx + 1):
        L.vl(xx, y - 9, 8, Y[4], t=TH)
    L.hl(cx - 4, y - 1, 8, Y[4]); L.hl(cx - 5, y, 10, Y[3])
    L.ellipse(cx, y - 12, 1.6, 1.6, Y[5]); L.px(cx - 1, y - 13, Y[6])
    L.vl(cx, y - 20, 7, Y[4], t=TH); L.hl(cx - 2, y - 18, 5, Y[4], t=TH); L.px(cx + 1, y - 21, Y[6])
    return L


TOWER_M = 85.0                                               # the Westertoren: about 85 m to the vane


def tower_h():
    return int(round(scale_px(TOWER_M, 0.10)))


def skyline_extra(SK):
    h = tower_h()
    SK.blit(westertoren(h), 300, 114 - h)                      # its foot behind the far houses (skyline foot 112)


# ---------------------------------------------------------------- the floor additions of section a
def floor_extra(sec):
    fl = sec.fl
    IR, S, BR, W_, M = A('iron'), A('stone'), A('brick_brown'), A('white'), A('moss')

    def fn(u, d, v, rgb):
        # the squares: the Pleintje is a fan of small granite setts (warm grey, a few browner and bluer stones, fine dark
        # joints, worn on the walking line); the FABEL FRIET square keeps its brown-red klinkers with a few small clusters
        # of darker smoked bricks
        sqm = np.zeros(u.shape, bool)
        for (q0, q1) in fl.get('squares', []) or []:
            sqm |= (u >= q0) & (u < q1)
        if sqm.any():
            kind = street_kind(sec, u)
            m = sqm & (kind == 'fan')
            if m.any():
                cu = np.floor(u / 30.0) * 30 + 15
                rr = np.hypot(u - cu, v - 60)
                ri = np.floor(rr / 3.2)
                ang = np.arctan2(v - 60, u - cu) * rr / 5.0
                ai = np.floor(ang + 0.5 * (ri % 2))
                fr, fa = rr / 3.2 - ri, ang + 0.5 * (ri % 2) - ai
                hs_ = hash01(ri + cu * 7, ai, 221)
                t = 3 + (hash01(ri + cu * 7, ai, 222) > 0.66).astype(int) - (hash01(ri + cu * 7, ai, 223) > 0.72).astype(int)
                t = np.where(fr < 0.22, np.minimum(t + 1, 5), t)
                wr = (np.abs(d) < 5.0) & (fbm(u / 11.0, v / 3.0, 224, 2) > 0.56) & chk(u * 1.0, d * 2)
                t = np.where(wr, np.minimum(t + 1, 5), t)                     # polished by the walkers
                jn = (fa < 0.09) | (fr > 0.86)
                t = np.where(jn, 1, t)
                col = np.where((hs_ < 0.10)[..., None], A('sett_warm')[np.clip(t, 0, 6)],
                               np.where(((hs_ >= 0.10) & (hs_ < 0.16))[..., None], A('sett_cool')[np.clip(t, 0, 6)], S[np.clip(t, 0, 6)]))
                rgb[m] = col[m]
            m = sqm & (kind == 'klinkers')
            if m.any():
                # granite setts in straight courses, framed by a band of the brown-red klinkers: along the lane's
                # threshold and along the house fronts
                j = np.floor(v / 2.8); i = np.floor(u / 3.3 + 0.5 * (j % 2))
                fu, fv = u / 3.3 + 0.5 * (j % 2) - i, v / 2.8 - j
                hs_ = hash01(i, j, 231)
                t = 3 + (hash01(i, j, 232) > 0.66).astype(int) - (hash01(i, j, 233) > 0.72).astype(int)
                t = np.where(fv < 0.22, np.minimum(t + 1, 5), t)
                t = np.where((fu < 0.09) | (fv > 0.86), 1, t)
                col = np.where((hs_ < 0.10)[..., None], A('sett_warm')[np.clip(t, 0, 6)],
                               np.where(((hs_ >= 0.10) & (hs_ < 0.16))[..., None], A('sett_cool')[np.clip(t, 0, 6)], S[np.clip(t, 0, 6)]))
                band = (u < KLINKER_BAND[0]) | ((d > KLINKER_BAND[1]) & (d < KLINKER_BAND[2]))
                sett = m & ~band
                rgb[sett] = col[sett]
                rgb[m & band & (np.abs(u - KLINKER_BAND[0]) < 0.45) & (d <= KLINKER_BAND[1])] = S[2]
                rgb[m & (np.abs(d - KLINKER_BAND[1]) < 0.3) & (u >= KLINKER_BAND[0])] = S[2]
        vw = lambda dd: 210 * (1 - 116.0 / (116.0 - dd))                  # world depth of a floor depth
        # tree pits: the elms stand in square pits of dark soil under an iron grate, in a granite frame
        for (tx_, td_, hu_, hv_) in TREE_PITS:
            vc = vw(td_)
            du, dv = u - tx_, v - vc
            m = (np.abs(du) < hu_) & (np.abs(dv) < hv_)
            if not m.any():
                continue
            fr = m & ((np.abs(du) > hu_ - 0.9) | (np.abs(dv) > hv_ - 0.8))
            n1 = hash01(np.floor(u * 2), np.floor(v * 2), 211)
            soil = A('soil')[np.clip(2 + (n1 > 0.7).astype(int) - (n1 < 0.2).astype(int), 0, 6)]
            rgb[m] = soil[m]
            ka = (hu_ - 1.2) / (hv_ - 1.0)
            rr = np.hypot(du, dv * ka)
            ang = (np.arctan2(dv * ka, du) / (2 * np.pi) * 12) % 1.0
            gr = m & ~fr & (((np.abs(rr - (hu_ - 1.9)) < 0.5) | ((ang < 0.22) & (rr > 3.0))) & (rr < hu_ - 1.3))
            rgb[gr] = IR[2]
            rgb[gr & (dv < 0)] = IR[4]
            rgb[fr] = S[5]
            rgb[fr & ((np.abs(du) > hu_ - 0.4) | (dv > hv_ - 0.4))] = S[3]
        # the squares: a granite gutter along the house fronts, iron covers, the wear of the walking line
        for (q0, q1) in fl.get('squares', []) or []:
            sqm_ = (u >= q0) & (u < q1)
            if not sqm_.any():
                continue
            for (gu0, gu1, gd) in GUTTERS:
                gm = sqm_ & (u >= gu0) & (u < gu1) & (np.abs(d - gd) < 0.6)
                j = np.floor(u / 3.0)
                t = 4 + (hash01(j, np.floor(gd), 212) > 0.6).astype(int)
                t = np.where(((u / 3.0) - j) < 0.16, 2, t)
                rgb[gm] = S[np.clip(t, 0, 6)][gm]
                rgb[sqm_ & (u >= gu0) & (u < gu1) & (np.abs(d - gd + 0.75) < 0.18)] = S[2]
            wear = sqm_ & (np.abs(d - 0.0) < 5.0) & (fbm(u / 14.0, v / 3.0, 213, 2) > 0.62) & chk(u * 1.0, d * 2)
            rgb[wear] = (rgb[wear].astype(float) * 0.86).astype(np.uint8)
        for (cx_, cd_) in COVERS:
            vc = vw(cd_)
            rr = np.hypot(u - cx_, (v - vc) * 1.0)
            m = rr < 3.6
            if not m.any():
                continue
            hatch = ((np.floor((u - cx_) * 1.2 + (v - vc) * 1.2) % 2) == 0)
            rgb[m] = np.where(hatch[..., None], IR[3], IR[2])[m]
            rgb[m & (rr > 3.0)] = IR[1]
            rgb[m & (rr > 3.0) & (v < vc)] = IR[4]
        # the quay walls of the side canals under the bridges (water before and behind the deck)
        for b in fl.get('bridges', []):
            w0, w1 = b['water']
            wat = (u >= w0) & (u < w1) & ((d > b['far']) | (d < b['near']))
            for e in (w0, w1):
                band = (np.abs(u - e) < 2.4) & wat
                rgb[band] = BR[2]
                rgb[band & ((np.floor(v / 2) % 2) == 0)] = BR[3]
                rgb[(np.abs(u - e) < 0.7) & wat] = S[5]
            sh = wat & (((u >= w0 + 2.4) & (u < w0 + 5)) | ((u > w1 - 5) & (u <= w1 - 2.4)))
            rgb[sh] = (rgb[sh].astype(float) * 0.72).astype(np.uint8)
        dF = pl(fl['far'], u); dN = pl(fl['near'], u)
        mid = (dF + dN) / 2.0
        inn = (d < dF) & (d > dN)
        # straight thresholds across the street: granite setts where a lane meets a deck or a square, a steel plate with
        # a diamond tread at the lift bridge's quay edges (it spans the deck's width, its girders stand on the pavements)
        for (u0, u1, kind, dr) in fl.get('thresholds', []) or []:
            if dr is None or dr == 'square':
                m = (u >= u0) & (u < u1) & inn
            else:
                m = (u >= u0) & (u < u1) & (d >= dr[0]) & (d <= dr[1])
            if not m.any():
                continue
            if kind == 'granite':
                j = np.floor(v / 3.2)
                fv = v / 3.2 - j
                t = 4 + (hash01(j, np.floor(u0), 141) > 0.6).astype(int) - (hash01(j, np.floor(u0), 142) > 0.8).astype(int)
                t = np.where(fv < 0.2, 5, t)                                   # the lit edge of each sett
                t = np.where(fv > 0.86, 2, t)                                  # the joint
                t = np.where((u - u0 < 0.45) | (u1 - u < 0.45), 2, t)
                rgb[m] = S[np.clip(t, 0, 6)][m]
            else:
                dm = ((np.floor((u - u0) / 1.4) + np.floor(v / 1.1)) % 2) == 0
                t = np.where(dm, 5, 4) - (hash01(np.floor(u * 2), np.floor(v * 2), 143) > 0.86).astype(int)
                t = np.where((u - u0 < 0.6) | (u1 - u < 0.6), 1, t)            # the gaps to the road and the deck
                t = np.where((u - u0 >= 0.6) & (u - u0 < 1.1), 6, t)           # the lit lip of the plate
                t = np.where((np.abs(d - dr[0]) < 0.5) | (np.abs(d - dr[1]) < 0.5), 2, t)
                rgb[m] = A('pave_grey')[np.clip(t, 0, 6)][m]
        # stop lines on the half of the lane that comes toward the bridge
        for (x, half) in fl.get('stoplines', []) or []:
            hm = ((d > dN + 2.3) & (d < mid - 0.5)) if half == 'near' else ((d > mid + 0.5) & (d < dF - 2.3))
            rgb[(np.abs(u - x) < 0.8) & hm] = W_[5]
        # shark teeth: a row of white triangles, their points toward the riders who give way
        for (u0, u1, half, dr) in fl.get('teeth', []) or []:
            hm = ((d > dN + 2.3) & (d < mid - 0.5)) if half == 'near' else ((d > mid + 0.5) & (d < dF - 2.3))
            q = ((u1 - u) if dr < 0 else (u - u0)) / (u1 - u0)                 # 0 at the base, 1 at the point
            ph = (v % 4.4) / 4.4
            tooth = (q >= 0) & (q <= 1) & (np.abs(ph - 0.5) < 0.42 * (1 - q)) & hm
            rgb[tooth] = W_[5]
            rgb[tooth & (np.abs(ph - 0.5) > 0.42 * (1 - q) - 0.06) & (q > 0.1)] = W_[4]
        return rgb
    return fn


# ---------------------------------------------------------------- the arched brick bridges (raised deck in depth slices)
SLICES = [17.5, 15, 12.5, 10, 7.5, 5, 2.5, 0, -2.5, -5, -7.5, -10, -12.5, -15]


def bridge_deck(sec, b):
    """The deck surface over the hump, painted slice by slice in the planes of its depths. Returns the depths used."""
    used = []
    BRr, S = A('brick_red'), A('stone')
    for c in SLICES:
        da, db = max(b['near'], c - 1.25), min(b['far'], c + 1.25)
        if db - da < 0.05:
            continue
        ytop = (176 - db) - b['h'] * s_d(db) - 1
        ybot = (176 - da) + 1

        def fn(u, y, k, sp, da=da, db=db):
            hh = hump(u, b)
            d = (176 - hh - y) / (1 - hh / 116.0)
            m = (u >= b['x0']) & (u < b['x0'] + b['len']) & (d >= da) & (d < db)
            s = (116 - d) / 116.0
            v = 210 * (1 - 1 / np.maximum(s, 0.3))
            j = np.floor(v / 2.4)
            uu = u / 5.5 + 0.5 * (j % 2)
            i = np.floor(uu)
            fu, fv = uu - i, v / 2.4 - j
            base = 3 + (hash01(i, j, 91) > 0.70).astype(int) - (hash01(i, j, 92) > 0.82).astype(int)
            t = np.where((fv < 0.22) & (fu > 0.06), base + 1, base)
            t = np.where((fu < 0.07) | (fv > 0.86), 1, t)
            # the slope: the rising half faces the morning light, the falling half turns from it
            c_ = b['x0'] + b['len'] / 2.0
            slope = -np.sin(np.pi * np.clip((u - c_) / (b['len'] / 2.0), -1, 1))
            ck = chk(u * 1.0, y)
            t = t + ((slope > 0.55) | ((slope > 0.25) & ck)).astype(int) - ((slope < -0.55) | ((slope < -0.25) & ck)).astype(int)
            # wheel-worn middle of the deck
            mid = (b['far'] + b['near']) / 2.0
            t = t + ((np.abs(d - mid) < 4) & (hash01(u * 2, v * 2, 93) > 0.6)).astype(int)
            rgb = BRr[np.clip(t, 0, 6)]
            # kerbstones along both edges of the deck
            ef = (d > b['far'] - 1.7); en = (d < b['near'] + 1.4)
            rgb[ef] = S[5]; rgb[ef & (d > b['far'] - 0.6)] = S[6]
            rgb[en] = S[5]; rgb[en & (d < b['near'] + 0.5)] = S[3]
            jn = (u % 9) < 0.5
            rgb[(ef | en) & jn] = S[3]
            return rgb, m
        used.append(plane_fill(sec, c, b['x0'], b['x0'] + b['len'], ytop, ybot, fn))
    return used


def bridge_face(sec, b):
    """The near face of the bridge (over the heroes, as the game's deck face): parapet coping, brick spandrel and the
       flat arch over the side canal with its dark vault and the light of the far opening."""
    near = b['near']
    BRb, S, M, G, I = A('brick_brown'), A('stone'), A('moss'), A('glass'), A('iron')
    w0, w1 = b['water']
    wc, half = (w0 + w1) / 2.0, (w1 - w0) / 2.0
    yb = 176 - near
    sn = s_d(near)
    yc = yb - b['h'] * sn + 5.5                                    # the crown of the arch under the coping
    rise = yb - yc

    def fn(u, y, k, sp):
        hh = hump(u, b)
        yt = yb - hh * sn
        m = (y >= yt) & (y < yb + 1.0) & (u >= b['x0']) & (u < b['x0'] + b['len'])
        # brick
        row = np.floor(y * DET / 2.0 * 2) / DET
        r_ = np.floor(y / (2.0 / DET))
        cu = (u * sn + (r_ % 2) * (2.0 / DET)) / (4.0 / DET)
        cell = hash01(np.floor(cu), r_, 71)
        n1 = fbm(u / 9.0, y / 6.0, 72, 2)
        t = 3 + (n1 > 0.6).astype(int) - (n1 < 0.4).astype(int) + (cell > 0.88).astype(int) - (cell < 0.15).astype(int)
        if U >= 4:
            jt = ((y / (2.0 / DET)) - r_ < 0.26) | ((cu - np.floor(cu)) < 0.13)
            t = t - (jt & (hash01(u * 4, y * 4, 73) > 0.3)).astype(int)
        rgb = BRb[np.clip(t, 1, 5)]
        # stains under the coping
        st = (y < yt + 6) & (vnoise(u / 2.0, y / 20.0, 74) > 0.78)
        rgb[st] = BRb[1]
        # the arch
        tt = (u - wc) / half
        inarch = np.abs(tt) < 1
        ya = yb - rise * np.sqrt(np.clip(1 - tt * tt, 0, 1))
        opening = inarch & (y >= ya)
        ring = inarch & (y >= ya - 2.2) & (y < ya)
        ang = np.floor(np.arctan2(yb - y, (u - wc) / half * rise) * 9)
        rgb[ring] = np.where(((ang % 2) == 0)[..., None], S[5], S[4])[ring]
        rgb[ring & (y < ya - 1.5)] = S[6]
        ks = (np.abs(u - wc) < 2.2) & (y >= ya - 3.2) & (y < ya) & inarch
        rgb[ks] = S[6]
        # inside: the dark vault, then the far opening's light low on the water
        depthy = (y - ya) / np.maximum(yb - ya, 0.5)
        ins = np.where(depthy < 0.35, 0, np.where(depthy < 0.7, 1, 2))
        dk = np.stack([np.array(I[0], np.uint8), np.array(G[0], np.uint8), np.array(G[1], np.uint8)])[ins]
        lightband = (y > yb - 2.2) & (np.abs(tt) < 0.8) & (chk(u * sn, y) | (y > yb - 1.2))
        dk[lightband] = G[3]
        gl = (y > yb - 3.5) & (hash01(np.floor(u * sn / 3), np.floor(y * DET), 75) > 0.82) & (np.abs(tt) < 0.85)
        dk[gl] = G[4]
        rgb[opening] = dk[opening]
        # coping of the parapet
        cp0 = (y >= yt) & (y < yt + 1.0)
        cp1 = (y >= yt + 1.0) & (y < yt + 2.0)
        cp2 = (y >= yt + 2.0) & (y < yt + 2.6)
        rgb[cp0] = S[6]; rgb[cp1] = S[4]; rgb[cp2 & ~opening] = BRb[0]
        rgb[(cp0 | cp1) & ((u % 11) < 0.5)] = S[3]
        # moss at the water on the abutments
        wl = (y >= yb - 1.6) & ~opening
        rgb[wl] = M[2]; rgb[wl & (y >= yb - 0.6)] = M[1]
        return rgb, m
    plane_fill(sec, near, b['x0'], b['x0'] + b['len'], yb - b['h'] * sn - 1, yb + 1, fn, front=True)


BRIDGE_LAMP_M = 6.0                                          # the lanterns on the bridge pillars (4-6 m)


def bridge_lamp_h(sp):
    return int(round(scale_px(BRIDGE_LAMP_M, sp)))


def bridge_rail(sec, b, depth, front, bikes=(), lamps=False, seed=1, lanterns=()):
    """An iron railing on the deck edge following the hump, with stone end pillars (and lanterns, chained bikes).
       lanterns: [(x, y_top)]: a stone pier in the railing at x with a crown lantern whose top is at screen row y_top
       (a gull of the game perches there)."""
    I, S = A('iron'), A('stone')
    Lp, k = sec.plane(depth, front)
    sp = s_d(k)
    yb = 176 - depth
    rh = 16.0 * sp                                                   # the railing's height on the screen
    x0, x1 = b['x0'], b['x0'] + b['len']

    def fn(u, y, k_, sp_):
        hh = hump(u, b)
        yt = yb - hh * sp - 0.4
        top = yt - rh
        m = np.zeros(u.shape, bool)
        rgb = np.zeros(u.shape + (3,), np.uint8)
        inner = (u >= x0 + 6) & (u < x1 - 6)
        # rails: the top rail (lit edge), a lower rail
        tr = inner & (y >= top) & (y < top + 1.2)
        rgb[tr] = I[2]; rgb[tr & (y < top + 0.5)] = I[5]; m |= tr
        lr = inner & (np.abs(y - (yt - 3.0)) < 0.5 * TH + 0.01 + (0.5 if U == 1 else 0))
        rgb[lr] = I[2]; m |= lr
        # bars every 4 world px; a heavier post every 20
        bw = TH / sp
        bar = inner & (y >= top) & (y < yt) & (((u - x0) % 4.0) < bw)
        rgb[bar] = I[1]; m |= bar
        pst = inner & (y >= top - 0.6) & (y < yt) & (((u - x0) % 20.0) < 1.2 / sp)
        rgb[pst] = I[3]; rgb[pst & (((u - x0) % 20.0) < 0.5 / sp)] = I[4]; m |= pst
        # the scroll of each bay: a small ring halfway down
        cx_ = x0 + np.floor((u - x0) / 20.0) * 20 + 10
        rr = np.hypot((u - cx_) * sp, y - (top + rh * 0.45))
        sc = inner & (np.abs(rr - 2.2) < 0.45 + 0.3 * (U == 1))
        rgb[sc] = I[2]; m |= sc
        # stone end pillars (and the piers of the lanterns)
        for (pa, pb) in [(x0 + 0.5, x0 + 6.5), (x1 - 6.5, x1 - 0.5)] + [(lx - 3, lx + 3) for (lx, _) in lanterns]:
            pm = (u >= pa) & (u < pb) & (y >= top - 3) & (y < yt + 0.6)
            f = (u - pa) / (pb - pa)
            col = np.where((f < 0.25)[..., None], S[6], np.where((f > 0.8)[..., None], S[2], S[4]))
            col = np.where(((y >= top - 3) & (y < top - 1.8))[..., None], S[6], col)
            col = np.where(((y >= top - 1.8) & (y < top - 1.0))[..., None], S[2], col)
            rgb[pm] = col[pm]; m |= pm
        return rgb, m
    top_all = yb - b['h'] * sp - rh - 4
    plane_fill(sec, depth, x0, x1, top_all, yb + 1, fn, front=front)
    rng = random.Random(seed)
    for (bu, c, flip) in bikes:
        bk = bike(rng, c, False)
        if flip:
            bk = bk.flip()
        hb = float(hump(np.array([bu + 21 / sp]), b)[0])
        Lp.blit(bk, sec.at(bu, sp), yb - hb * sp - bk.h + 1)
    if lamps:
        for lu in (x0 + 3.5, x1 - 3.5):
            lp = lamp(bridge_lamp_h(sp))
            Lp.blit(lp, sec.at(lu, sp) - 8, yb - rh - 3 - lp.h + 0.5)
    for (lx, ytop) in lanterns:
        hb = float(hump(np.array([lx]), b)[0])
        ypier = yb - hb * sp - 0.4 - rh - 3                               # the pier's cap
        lp = lamp(int(round(ypier - ytop)))
        Lp.blit(lp, sec.at(lx, sp) - 8, ytop)
    return k


# ---------------------------------------------------------------- the lift bridge (hefbrug) over the side canal
# The deck is up for the boats. One steel lattice tower on each bank: two columns (one on each pavement, in line with
# the deck's main girders), a box portal over the street on their tops, a sheave on each column, the wire ropes down
# to the deck's ends and down to the counterweights (they hang low beside the columns: the deck is up). Before each
# bank the half barriers are down and the signals show red; under the deck the boats' passage sign and two green
# lights. The layout numbers are in street_a.LIFT (the floor layout's `lift`).
#
# How it is painted (perspective is one): every vertical face that stands at one depth (a column face, a girder, a
# sheave, a rope, a counterweight) is painted in the plane of its depth with its height in world px times the plane's
# speed. The column sides are thin depth slices (0.5 apart). Things that lie along the depth at one height (the
# portal, the barrier arms, the tops of the footings) are 'rows' layers, one per height step: each screen row scrolls
# at the speed of its own depth, so they meet the planes without gaps at every camera.
R['hef'] = ramp(7, .30, .96, .016, .014, .020, 262, 96)           # white-painted steel: blue-grey shade, warm light


def _hh(k, sp, y):
    """World height over the street of screen row y in the plane of depth k."""
    return (176.0 - k - y) / sp


def rows_at(sec, hgt, d0, d1, items, sid, over=False):
    """A horizontal surface at height hgt (not the camera's height, 116) from depth d0 to d1 as a 'rows' layer: every
       real screen row scrolls at the speed of its own depth. items: [(u0, u1, fn(u, d) -> (rgb, mask))]."""
    ya = 60 + (116 - hgt) * (116 - d0) / 116.0
    yb = 60 + (116 - hgt) * (116 - d1) / 116.0
    y0 = max(0.0, math.floor(min(ya, yb) * U) / U)
    y1 = math.ceil(max(ya, yb) * U) / U
    if y1 - y0 < 1.0 / U:
        return None
    smax = (116 - min(d0, d1)) / 116.0
    L = Layer(sec.lw(smax) + 2, y1 - y0)
    n = L.ph
    ys = y0 + (np.arange(n) + 0.5) / U
    sv = (ys - 60) / (116 - hgt)
    dv = 116 - 116 * sv
    for (u0, u1, fn) in items:
        pa = [192 + (u0 - 192) * s for s in (sv[0], sv[-1])]
        pb = [192 + (u1 - 192) * s for s in (sv[0], sv[-1])]
        c0, c1 = max(0, P(min(pa)) - 2), min(L.pw, P(max(pb)) + 3)
        if c1 <= c0:
            continue
        pc = (np.arange(c0, c1) + 0.5) / U
        u = 192 + (pc[None, :] - 192) / sv[:, None]
        d = np.broadcast_to(dv[:, None], u.shape)
        rgb, m = fn(u, d)
        m = m & (u >= u0) & (u < u1) & (d >= min(d0, d1) - 0.01) & (d <= max(d0, d1) + 0.01)
        sub_ = L.a[:, c0:c1]
        sub_[..., :3][m] = rgb[m]
        sub_[..., 3][m] = 255
    if not L.mask().any():
        return None
    L.recolor(grader(key=sec.KEY)); L.recolor(curve(*sec.H['curve']))
    L.a[..., :3] = snap5(L.a[..., :3])
    return dict(id=sid, img=None, speed=float(sv[0]), y=y0, kind='rows', over=over, frames=[L], s0=float(sv[0]),
                s1=float(sv[-1]), rdepth=(min(d0, d1), max(d0, d1)))


def place_rows(sec, ly, depth, over=False):
    """Put a rows layer into the draw list: a layer behind the hero before the first plane nearer than `depth`; an
       over layer before the first over layer nearer than `depth`."""
    if ly is None:
        return
    for i, l in enumerate(sec.layers):
        dep = l.get('depth')
        if not over and (l.get('over') or (dep is not None and dep < depth)):
            sec.layers.insert(i, ly)
            return
        if over and l.get('over') and dep is not None and dep < depth:
            sec.layers.insert(i, ly)
            return
    sec.layers.append(ly)


def _lift_geo(sec):
    lf = sec.fl['lift']
    g = dict(lf)
    g['hw'] = lf['col_w'] / 2.0
    g['hd'] = lf['col_d'] / 2.0
    g['dirs'] = ((lf['towers'][0], 1), (lf['towers'][1], -1))     # column centre, the way to the canal
    return g


def _bays(h, base, top, bat):
    hb = base + np.floor((h - base) / bat) * bat
    return hb, h - hb


OPEN_H = 62.0                          # the near columns are open from the footing to this height: figures pass behind


def lift_column_face(sec, c, k, g, back=False, open_=False):
    """One lattice face of a tower column in the plane of depth k: corner angles, battens, crossed diagonals, gusset
       rivets, the cap plate and the concrete footing below. The back face is the column's inside, in shade.
       open_: (the near columns, in front of the figures) below OPEN_H only a slender riveted leg pair with one wide
       open bay and thin diagonals, so a figure behind stays readable."""
    SW, ST = A('hef'), A('stone')
    hw, top, base, bat = g['hw'], g['col_top'], 6.0, 13.0
    x0, x1 = c - hw, c + hw
    sh = 2 if back else 0
    fw = (hw + 4.0)                                                   # the footing is wider than the column
    cw = c - g['sheave'][1] * (1 if c < 1200 else -1)
    f0, f1 = min(c - fw, cw - 6), max(c + fw, cw + 6)

    def fn(u, y, k_, sp):
        h = _hh(k_, sp, y)
        px = 1.0 / sp                                                 # one screen px in world px
        lu = u - x0
        W = x1 - x0
        rgb = np.zeros(u.shape + (3,), np.uint8)
        t = np.full(u.shape, -9, int)
        col = (lu >= 0) & (lu < W) & (h >= base) & (h < top)
        hb, fh = _bays(h, OPEN_H if open_ else base, top, bat)
        # crossed diagonals in each bay between the angles
        inner = col & (lu >= 2.6) & (lu < W - 2.6)
        tt = (lu - 2.6) / (W - 5.2)
        thin = (0.55 if U == 1 else 0.36) * px * 1.5
        d1 = np.abs(fh - bat * tt) < thin
        d2 = np.abs(fh - bat * (1 - tt)) < thin
        t = np.where(inner & d2, 3, t)
        t = np.where(inner & d1, 4, t)
        # battens (with a lit top) and the cap plate
        bt = col & ((fh < 1.6) | (h >= top - 4))
        t = np.where(bt, 4, t)
        t = np.where(bt & (((fh >= 1.6 - px) & (fh < 1.6)) | (h >= top - px)), 6, t)
        t = np.where(bt & (((fh < px) & (h < top - 4)) | ((h >= top - 4) & (h < top - 4 + px))), 2, t)
        # the corner angles: the lit one on the left, the shaded one on the right
        la = col & (lu < 2.6)
        ra = col & (lu >= W - 2.6)
        t = np.where(la, 4, t)
        t = np.where(la & (lu < px), 6, t)
        t = np.where(la & (lu >= 2.6 - px), 3, t)
        t = np.where(ra, 3, t)
        t = np.where(ra & (lu >= W - px), 1, t)
        t = np.where(ra & (lu < W - 2.6 + px), 4, t)
        if open_:                                                     # the open bay where the figures pass
            ob = col & (h < OPEN_H)
            t = np.where(ob, -9, t)
            lg = ob & ((lu < 1.8) | (lu >= W - 1.8))
            t = np.where(lg & (lu < 1.8), 4, t)
            t = np.where(lg & (lu < px), 6, t)
            t = np.where(lg & (lu >= W - 1.8), 3, t)
            t = np.where(lg & (lu >= W - px), 1, t)
            eb = ob & ((h < base + 1.6) | (h >= OPEN_H - 1.6))          # a batten at the foot and at the top of the bay
            t = np.where(eb, 4, t)
            t = np.where(eb & ((h >= OPEN_H - px) | ((h >= base + 1.6 - px) & (h < base + 1.6))), 6, t)
            tt2 = (lu - 1.8) / (W - 3.6)
            hh2 = (h - base - 1.6) / (OPEN_H - base - 3.2)
            thn = (0.5 if U == 1 else 0.3) * px * 1.2
            dg = ob & ~lg & ~eb & (not back) & ((np.abs(hh2 - tt2) * (OPEN_H - base) * 0.3 < thn) | (np.abs(hh2 - (1 - tt2)) * (OPEN_H - base) * 0.3 < thn))
            t = np.where(dg, 3, t)
            if U >= 2:
                rv = lg & (np.abs(((h - base) % 6.0) - 3.0) < 0.45 * px) & (np.abs(lu - np.where(lu < W / 2, 0.9, W - 0.9)) < 0.5 * px)
                t = np.where(rv, 2, t)
        if U >= 2 and not back:                                       # rivets at the batten ends
            rv = (la | ra) & (np.abs(fh - 0.8) < 0.45 * px) & ((np.abs(lu - 1.3) < 0.5 * px) | (np.abs(lu - (W - 1.3)) < 0.5 * px))
            t = np.where(rv, 2, t)
            st = (la | ra) & (fh > 1.6) & (fh < 6) & (hash01(np.floor(u * 3), np.floor(h / 6), 151) > 0.82)
            t = np.where(st & (t > 1), t - 1, t)                     # a streak of grime under the rivets
        m = t > -9
        rgb[m] = SW[np.clip(t - sh, 0, 6)][m]
        # the footing: concrete with a lit arris, joints, a dark foot
        ft = (u >= f0) & (u < f1) & (h >= 0) & (h < base)
        if ft.any():
            n1 = fbm(u / 7.0, h / 3.0, 152, 2)
            tf = 4 - sh + (n1 > 0.62).astype(int) - (n1 < 0.36).astype(int)
            tf = np.where(h >= base - px, 6 - sh, tf)
            tf = np.where(h < px, 1, tf)
            tf = np.where(((u - f0) % 12.0) < 0.4 * px * 2, 2, tf)
            rgb[ft] = ST[np.clip(tf, 0, 6)][ft]
            m = m | ft
        return rgb, m
    y_top = (176 - k) - (top + 1) * s_d(k) - 1
    plane_fill(sec, k, min(x0, f0) - 1, max(x1, f1) + 1, y_top, 176 - k + 1, fn)


def lift_column_side(sec, c, k, g, t01, open_=False):
    """The side faces of a column in a depth slice (t01: 0 at the near face, 1 at the far face): battens, the
       diagonals at the height they have at this depth, the cap; the footing's sides. open_: only the battens at the
       foot and the top of the open bay below OPEN_H."""
    SW, ST = A('hef'), A('stone')
    hw, top, base, bat = g['hw'], g['col_top'], 6.0, 13.0
    x0, x1 = c - hw, c + hw
    fw = hw + 4.0
    cw = c - g['sheave'][1] * (1 if c < 1200 else -1)
    f0, f1 = min(c - fw, cw - 6), max(c + fw, cw + 6)

    def fn(u, y, k_, sp):
        h = _hh(k_, sp, y)
        px = 1.0 / sp
        w = 0.9                                                       # half width of a side strip (world px)
        sl = np.abs(u - x0) < w
        sr = np.abs(u - x1) < w
        side = (sl | sr) & (h >= base) & (h < top)
        hb, fh = _bays(h, OPEN_H if open_ else base, top, bat)
        mem = (fh < 1.6) | (h >= top - 4) | (np.abs(fh - bat * t01) < 0.8 * px) | (np.abs(fh - bat * (1 - t01)) < 0.8 * px)
        if open_:
            mem = np.where(h < OPEN_H, (h < base + 1.6) | (h >= OPEN_H - 1.6), mem)
        m = side & mem
        rgb = np.zeros(u.shape + (3,), np.uint8)
        rgb[m & sl] = SW[5]
        rgb[m & sr] = SW[2]
        rgb[m & (fh >= 1.6 - px) & (fh < 1.6)] = SW[6]
        # the footing's sides
        fs = ((np.abs(u - f0) < w) | (np.abs(u - f1) < w)) & (h >= 0) & (h < base)
        rgb[fs & (u < c)] = ST[5]
        rgb[fs & (u >= c)] = ST[2]
        rgb[fs & (h < px)] = ST[1]
        return rgb, m | fs
    y_top = (176 - k) - (top + 1) * s_d(k) - 1
    plane_fill(sec, k, min(x0, f0) - 2, max(x1, f1) + 2, y_top, 176 - k + 1, fn)


def lift_core(sec, c, dr, k, g, near):
    """The middle plane of a column: the deck's main girder (the near one carries the boats' passage sign and two
       green lights), the sheave on its pedestal, the wire ropes, the counterweight (down: the deck is up) on its
       buffers."""
    SW, I, ST, RD, Wt, Y, LF, K = A('hef'), A('iron'), A('stone'), A('red'), A('white'), A('yellow'), A('leaf'), A('black')
    u0, u1 = g['deck']
    hb0, ht = g['deck_h']
    hc, rs = g['sheave']
    top = g['col_top']
    pt = g['portal'][1]
    cw = c - rs * dr                                                  # the counterweight's rope
    ci = c + rs * dr                                                  # the deck's rope
    wb, wt, ww = g['weight']
    npan = 16
    e = 6.0                                                           # end posts
    pw = (u1 - u0 - 2 * e) / npan
    sh = 0 if near else 1

    def girder(u, y, k_, sp):
        h = _hh(k_, sp, y)
        px = 1.0 / sp
        t = np.full(u.shape, -9, int)
        inn = (u >= u0) & (u < u1) & (h >= hb0) & (h < ht)
        ch = 3.5
        bc = inn & (h < hb0 + ch)
        tc = inn & (h >= ht - ch)
        ep = inn & ((u < u0 + e) | (u >= u1 - e))
        q = (u - u0 - e) / pw
        qi = np.floor(q)
        qf = q - qi
        web = inn & ~bc & ~tc & ~ep
        hw_ = (h - hb0 - ch) / (ht - hb0 - 2 * ch)
        thin = (0.55 if U == 1 else 0.40) * px * 1.6
        dg1 = web & (np.abs(hw_ - qf) * (ht - hb0 - 2 * ch) < thin)
        dg2 = web & (np.abs(hw_ - (1 - qf)) * (ht - hb0 - 2 * ch) < thin)
        vt = web & ((qf < 0.9 * px / pw) | (qf > 1 - 0.9 * px / pw))
        gus = web & ((qf < 2.4 / pw) | (qf > 1 - 2.4 / pw)) & ((h < hb0 + ch + 2.2) | (h >= ht - ch - 2.2))
        t = np.where(dg2, 3, t)
        t = np.where(dg1, 4, t)
        t = np.where(gus, 5, t)
        t = np.where(vt, 4, t)
        t = np.where(vt & (qf > 0.5), 5, t)
        for cm in (bc, tc):
            t = np.where(cm, 4, t)
        t = np.where((bc | tc) & ((h >= ht - px) | ((h >= hb0 + ch - px) & (h < hb0 + ch))), 6, t)
        t = np.where((bc | tc) & ((h < hb0 + px) | ((h >= ht - ch) & (h < ht - ch + px))), 2, t)
        t = np.where(ep, 4, t)
        t = np.where(ep & ((u < u0 + px) | ((u >= u1 - e) & (u < u1 - e + px))), 6, t)
        t = np.where(ep & ((u >= u1 - px) | ((u >= u0 + e - px) & (u < u0 + e))), 2, t)
        if U >= 2:
            rv = (bc | tc) & (np.abs(((u - u0) % 2.6) - 1.3) < 0.4 * px) & (np.abs(h - np.where(bc, hb0 + ch / 2, ht - ch / 2)) < 0.4 * px)
            rv |= gus & (np.abs(((u - u0) % 1.6) - 0.8) < 0.4 * px) & (((h - hb0) % 1.6) < 0.8 * px)
            rv |= ep & (np.abs(((u - u0) % 3.0) - 1.5) < 0.45 * px) & (np.abs(((h - hb0) % 3.0) - 1.5) < 0.45 * px)
            t = np.where(rv, np.minimum(t, 3) - 1, t)
            gr = (bc | tc | vt) & (fbm(u / 9.0, h / 4.0, 161 + int(near), 2) > 0.66) & chk(u * sp, y)
            t = np.where(gr & (t > 2), t - 1, t)
        rgb = SW[np.clip(t - sh, 0, 6)]
        # warning stripes on the lower part of the end posts
        hz = ep & (h < hb0 + 7) & (h >= hb0 + px)
        rs_ = (np.floor((u * sp + h * sp) / 2.0) % 2) == 0
        rgb[hz & rs_] = RD[4 - sh]
        rgb[hz & ~rs_] = Wt[5 - sh]
        m = t > -9
        # under the middle of the near girder: the passage sign (a yellow diamond) and two green lights for the boats
        if near:
            uc = 0.5 * (u0 + u1)
            dm = (np.abs(u - uc) + np.abs(h - (hb0 - 6.0))) * sp
            sg = dm < 5.4
            rgb[sg] = K[1]
            rgb[dm < 4.4] = Y[5]
            rgb[(dm < 4.4) & (h > hb0 - 6.0) & (u < uc)] = Y[6]
            rod = (np.abs(u - uc) < 0.6 * px) & (h >= hb0 - 1.5) & (h < hb0)
            rgb[rod] = I[2]
            m = m | sg | rod
            for gx in (uc - 16, uc + 16):
                hs = (np.abs(u - gx) < 2.0) & (h >= hb0 - 5.5) & (h < hb0)
                rgb[hs] = K[1]
                ln = (np.abs(u - gx) < 1.3) & (h >= hb0 - 4.6) & (h < hb0 - 1.6)
                rgb[ln] = LF[6]
                rgb[ln & (u < gx) & (h > hb0 - 3.2)] = (236, 255, 220)
                m = m | hs
        return rgb, m

    def tower(u, y, k_, sp):
        h = _hh(k_, sp, y)
        px = 1.0 / sp
        rgb = np.zeros(u.shape + (3,), np.uint8)
        m = np.zeros(u.shape, bool)
        # the sheave: a spoked wheel with a grooved rim, its pedestal on the portal
        dx, dy = (u - c) * sp, (h - hc) * sp
        rr = np.hypot(dx, dy)
        R_ = rs * sp
        ped = (h >= pt) & (h < hc) & (np.abs(u - c) < 4.2 - 2.6 * (h - pt) / (hc - pt))
        rgb[ped] = I[3]; rgb[ped & (u < c - 2.0 + 1.3 * (h - pt) / (hc - pt))] = I[4]
        m |= ped
        rim = (rr <= R_) & (rr > R_ - 1.7)
        th = np.arctan2(dy, dx)
        rgb[rim] = SW[4 - sh]
        rgb[rim & (rr > R_ - 0.6) & ((dx + dy) < 0)] = SW[6 - sh]
        rgb[rim & (rr > R_ - 0.6) & ((dx + dy) >= 0)] = SW[2]
        rgb[rim & (np.abs(rr - (R_ - 1.1)) < 0.3)] = I[2]
        sp6 = (th * 6 / (2 * np.pi)) % 1.0
        spoke = (rr < R_ - 1.6) & (rr * np.abs(np.sin((sp6 - np.round(sp6)) * 2 * np.pi / 6)) < (0.6 if U == 1 else 0.45))
        rgb[spoke] = SW[4 - sh]
        hub = rr < 2.7
        rgb[hub] = SW[3 - sh]; rgb[rr < 1.1] = I[1]
        m |= rim | spoke | hub
        # the wire ropes: down to the deck's end post and down to the counterweight
        rope_w = 0.6 if U == 1 else 0.42
        for (ux, h0, h1) in ((ci, ht, hc), (cw, wt + 3.5, hc)):
            rp = (np.abs((u - ux) * sp) < rope_w) & (h >= h0) & (h < h1)
            rgb[rp] = I[1]
            if U >= 2:
                rgb[rp & ((u - ux) * sp < -0.1) & chk(u * sp, y * 2)] = I[4]
            m |= rp
        # the rope's socket on the deck's end post
        sk = (np.abs(u - ci) < 1.6) & (h >= ht) & (h < ht + 3)
        rgb[sk] = I[2]; rgb[sk & (u < ci - 0.6)] = I[4]
        m |= sk
        # the counterweight: concrete in a riveted steel frame, a red-white foot band, a yoke on top
        cwm = (np.abs(u - cw) < ww / 2.0) & (h >= wb) & (h < wt)
        n1 = fbm(u / 4.0, h / 7.0, 171 + int(near), 2)
        tc = 3 + (n1 > 0.6).astype(int) - (n1 < 0.38).astype(int)
        tc = np.where((u - (cw - ww / 2.0)) < px, 5, tc)
        tc = np.where(((cw + ww / 2.0) - u) < px, 1, tc)
        rgb[cwm] = ST[np.clip(tc - sh, 0, 6)][cwm]
        fr = cwm & ((h >= wt - 2.5) | (h < wb + 4))
        rgb[fr] = I[3]; rgb[fr & (h >= wt - px)] = I[5]
        band = cwm & (h < wb + 4) & (h >= wb + px)
        rs2 = (np.floor((u * sp - h * sp) / 1.6) % 2) == 0
        rgb[band & rs2] = RD[4]; rgb[band & ~rs2] = Wt[5]
        st = cwm & (h < wt - 2.5) & (h > wb + 4) & (hash01(np.floor(u * 2), np.floor(h / 9), 172) > 0.84)
        rgb[st] = ST[2]
        yk = (np.abs(u - cw) < 2.0 - (h - wt) * 0.3) & (h >= wt) & (h < wt + 3.6)
        rgb[yk] = I[2]
        m |= cwm | yk
        # the buffers under it (it rests on them while the deck is up)
        for bx in (cw - 2.2, cw + 2.2):
            bf = (np.abs(u - bx) < 1.1) & (h >= 6) & (h < wb)
            zz = ((np.floor(h * 1.6 * sp) % 2) == 0)
            rgb[bf] = I[2]; rgb[bf & zz] = I[4]
            m |= bf
        return rgb, m
    yg = (176 - k) - (ht + 1) * s_d(k) - 1
    plane_fill(sec, k, u0 - 2, u1 + 2, yg, (176 - k) - (hb0 - 14) * s_d(k) + 1, girder)
    ytw = max(0.0, (176 - k) - (hc + rs + 1) * s_d(k) - 1)
    plane_fill(sec, k, min(c, cw) - rs - 4, max(c, cw) + rs + 4, ytw, 176 - k + 1, tower)


def lift_portal_rows(sec, g):
    """The box portal on the column tops over the street: one rows layer per half px of height, the highest first
       (from below the underside covers the rest); the side faces and the near end come from the layers' edges."""
    SW = A('hef')
    p0, p1 = g['portal']
    dn, df = g['girders'][1] - g['hd'], g['girders'][0] + g['hd']
    hs = list(np.arange(p1, p0 - 0.01, -0.5))
    hw = g['hw']
    out = []
    for j, hj in enumerate(hs):
        bottom = j == len(hs) - 1
        topl = j == 0

        items = []
        for (c, dr) in g['dirs']:
            def fn(u, d, c=c, hj=hj, bottom=bottom, topl=topl):
                lu = u - (c - hw)
                W = 2 * hw
                if bottom:                                            # the underside: flanges, cross plates, rivets
                    t = np.full(u.shape, 2)
                    t = np.where((lu < 1.6) | (lu > W - 1.6), 3, t)
                    t = np.where((d - dn) % 5.0 < 0.5, 2, t)
                    t = np.where((np.abs(lu - 0.8) < 0.35) & (((d - dn) % 1.2) < 0.4), 2, t)
                    t = np.where(d < dn + 0.5, 3, t)
                else:
                    t = np.where(lu < W / 2, 5, 3)                    # left side lit, right side in shade
                    t = np.where(d < dn + 0.6, 4, t)                  # the near end
                    t = np.where(((d - dn) % 5.0 < 0.45) & (d > dn + 0.6), t - 1, t)
                    if abs(hj - (p0 + p1) / 2.0) < 0.26:
                        t = np.where((((d - dn) % 1.0) < 0.45) & (d > dn + 0.6), t - 1, t)   # a rivet line
                    if topl:
                        t = np.where(lu < W / 2, 6, 5)
                rgb = SW[np.clip(t, 0, 6)]
                return rgb, np.ones(u.shape, bool)
            items.append((c - hw, c + hw, fn))
        ly = rows_at(sec, hj, dn, df, items, 'portal%g' % hj)
        out.append(ly)
    return out


def lift_footing_rows(sec, g, near):
    """The top of the columns' footings (concrete, a lit edge) as one rows layer at 6 px over the pavement."""
    ST = A('stone')
    gd = g['girders'][1] if near else g['girders'][0]
    items = []
    for (c, dr) in g['dirs']:
        cw = c - g['sheave'][1] * dr
        fw = g['hw'] + 4.0
        f0, f1 = min(c - fw, cw - 6), max(c + fw, cw + 6)

        def fn(u, d, f0=f0, f1=f1, gd=gd):
            n1 = fbm(u / 6.0, d / 2.0, 181, 2)
            t = 4 + (n1 > 0.6).astype(int) - (n1 < 0.35).astype(int)
            t = np.where(d < gd - g['hd'] + 0.35, 6, t)
            t = np.where((u - f0 < 0.5) | (f1 - u < 0.5), 5, t)
            return ST[np.clip(t, 0, 6)], np.ones(u.shape, bool)
        items.append((f0, f1, fn))
    return rows_at(sec, 6.0, gd - g['hd'], gd + g['hd'], items, 'footing%s' % ('n' if near else 'f'), over=near)


def lift_bridge(sec):
    """Paint the lift bridge's planes (columns, girders, sheaves, ropes, counterweights). Returns the rows layers to
       place after the flush: [(layer, depth, over)]."""
    g = _lift_geo(sec)
    for near, gd in ((False, g['girders'][0]), (True, g['girders'][1])):
        dn, df = gd - g['hd'], gd + g['hd']
        for (c, dr) in g['dirs']:
            lift_column_face(sec, c, df, g, back=True, open_=near)
            for t01 in (1.0, 0.8333, 0.6667, 0.5, 0.3333, 0.1667, 0.0):
                lift_column_side(sec, c, dn + t01 * (df - dn), g, t01, open_=near)
            lift_core(sec, c, dr, gd, g, near)
            lift_column_face(sec, c, dn, g, open_=near)
            # the contact shade of the column and of the counterweight's footing on the pavement
            sec.shades.append((c, gd, g['hw'] + 4, 40))
            sec.shades.append((c - g['sheave'][1] * dr, gd, 6, 40))
    rows = [(ly, g['girders'][0] - g['hd'] + 0.01, False) for ly in lift_portal_rows(sec, g)]
    rows.append((lift_footing_rows(sec, g, False), g['girders'][0] + g['hd'] + 0.01, False))
    rows.append((lift_footing_rows(sec, g, True), g['girders'][1] + g['hd'] + 0.01, True))
    return rows


# ---------------------------------------------------------------- the half barriers and the signals before the bridge
def barrier_cabinet(signal=False, pivot=21):
    """The drive cabinet of a half barrier (8 wide, the arm's pivot `pivot` px over its foot), the far one with a mast
       that carries the red road signal (a white board with a red rim, one lamp lit: they flash in turn).
       Anchor: bottom centre."""
    Wt = R['white']; I = R['iron']; Rd = R['red']; K = R['black']; S = R['stone']
    cb = int(round(pivot)) + 3                                                                   # the cabinet's height
    H = 70 if signal else cb
    L = Layer(17, H)
    cx = 8
    if signal:
        L.rect(cx - 1, 12, 2, H - 32, I[2]); L.vl(cx - 1, 12, H - 32, I[4])                      # the mast
        L.rect(cx - 8.5, 1, 17, 12, Rd[3]); L.rect(cx - 7.5, 2, 15, 10, Wt[6])                   # the board
        L.hl(cx - 7.5, 11, 15, Wt[4]); L.hl(cx - 8.5, 1, 17, Rd[5])
        for (lx, lit) in ((cx - 3.5, True), (cx + 3.5, False)):
            L.ellipse(lx, 7, 3.2, 3.2, K[1])
            if lit:
                for (rx, c_) in ((4.6, None), (2.6, (232, 40, 32)), (1.5, (255, 96, 72)), (0.7, (255, 228, 210))):
                    if c_ is None:
                        xx, yy = grid(lx - 5, 2, 10, 10)
                        m = (np.hypot(xx + D1 / 2 - lx, yy + D1 / 2 - 7) < rx) & (np.hypot(xx + D1 / 2 - lx, yy + D1 / 2 - 7) > 3.2) & chk(xx, yy)
                        L.put(lx - 5, 2, np.broadcast_to(np.array((248, 88, 64), np.uint8), xx.shape + (3,)), m)
                    else:
                        L.ellipse(lx, 7 - (0.4 if rx < 1 else 0), rx, rx, c_)
            else:
                L.ellipse(lx, 7, 2.6, 2.6, Rd[1]); L.px(lx - 1, 6, Rd[2])
            L.hl(lx - 3, 3.4, 6, K[0], t=TH)                                                       # visors
        L.hl(cx - 8.5, 13, 17, I[1])
    y0 = H - cb
    L.rect(cx - 4, y0 + 2, 8, cb - 2, Wt[5]); L.vl(cx - 4, y0 + 2, cb - 2, Wt[6]); L.vl(cx + 3, y0 + 2, cb - 2, Wt[2])
    L.rect(cx - 4, y0, 8, 2, Wt[4]); L.hl(cx - 4, y0, 8, Wt[6])                                  # the lid
    L.rect(cx - 4, y0 + 6, 8, 3, Rd[4]); L.hl(cx - 4, y0 + 6, 8, Rd[5])                         # a red band
    L.ellipse(cx, y0 + 3.2, 2.2, 2.2, I[1]); L.ellipse(cx - 0.4, y0 + 2.8, 1.0, 1.0, I[4])      # the pivot
    L.vl(cx - 2, y0 + 11, cb - 15, Wt[3], t=TH); L.px(cx + 1, y0 + 15, I[2])                    # the door and its lock
    L.rect(cx - 5, H - 2, 10, 2, S[2]); L.hl(cx - 5, H - 2, 10, S[4])                            # the foot
    return L


ARM_H = 20.0                           # the arms' height over the street (world px): both arms lie on one line
BARRIER_D = (7.5, -18.5)               # the cabinets' depths (far, near)


def barrier_rows(sec, near):
    """The half-barrier arms (red-white, two red lamps lit) of both banks on one side of the street, as rows layers:
       one per quarter px of the arm's height, the lowest first (the top face is drawn last)."""
    Rd, Wt, K = A('red'), A('white'), A('black')
    fl = sec.fl
    root = BARRIER_D[1] if near else BARRIER_D[0]
    tip = -7.5 if near else 1.5
    hA = ARM_H
    th = 1.7
    hs = list(np.arange(hA - th, hA + th + 0.01, 0.25))
    out = []
    d0, d1 = min(root, tip), max(root, tip)
    for j, hj in enumerate(hs):
        topl = j >= len(hs) - 2
        items = []
        for (x, side) in fl.get('barriers', []):
            def fn(u, d, topl=topl, x=x):
                q = np.abs(d - tip)                                   # from the tip
                band = (np.floor(q / 1.6) % 2) == 0
                rgb = np.where(band[..., None], Rd[5 if topl else 3], Wt[6 if topl else 4])
                lamp_ = (q < 0.8) | (np.abs(q - 3.6) < 0.5) | (np.abs(q - 7.6) < 0.5)
                if topl:
                    rgb[lamp_] = (255, 96, 72)
                    rgb[lamp_ & (np.abs(u - x) < 0.35)] = (255, 220, 200)
                else:
                    rgb[lamp_] = Rd[2]
                rgb[np.abs(d - tip) < 0.25] = K[1]
                return rgb, np.ones(u.shape, bool)
            items.append((x - 1.4, x + 1.4, fn))
        ly = rows_at(sec, hj, d0, d1, items, 'arm%s%g' % ('n' if near else 'f', hj), over=near)
        out.append(ly)
    return out


def barriers(sec):
    """The cabinets (with the far signals) and the arms before both banks. Returns rows layers to place after the flush."""
    rows = []
    for (x, side) in sec.fl.get('barriers', []):
        sec.put(barrier_cabinet(True, ARM_H * s_d(BARRIER_D[0])), x, BARRIER_D[0])
        sec.put(barrier_cabinet(False, ARM_H * s_d(BARRIER_D[1])), x, BARRIER_D[1])
    rows += [(ly, 1.5, False) for ly in barrier_rows(sec, False)]
    rows += [(ly, -7.5, True) for ly in barrier_rows(sec, True)]
    return rows


# ---------------------------------------------------------------- the elm's bough that carries the tree-bike secret
def elm_bough(sec, x_tree, d_tree, tip=(646, 128), seed=3):
    """A low bough from the elm's trunk (depth d_tree) forward over the lane to the walk plane, where it carries the
       bike of the game's secret (world x 646, its wheels at y 128; the bike itself is the game's). It leaves the trunk
       low, rises gently and ends in twigs with leaves beyond the bike. The part that runs toward the viewer is
       painted in depth slices; the end lies in the walk plane."""
    BK = A('bark')
    tx, ty = tip
    th = 176.0 - ty                                                   # the bough's top under the wheels (world px)
    main = [(x_tree + 2, d_tree, th - 9, 3.6), (x_tree + 9, d_tree * 0.62, th - 5.5, 3.1), (x_tree + 17, d_tree * 0.25, th - 3.4, 2.6),
            (tx - 4, 0.3, th - 2.3, 2.2), (tx + 6, 0.0, th - 1.9, 1.8), (tx + 16, 0.0, th - 0.4, 1.3), (tx + 25, 0.0, th + 3.2, 0.7)]
    twigs = [[(tx + 15, 0.0, th - 0.6, 0.9), (tx + 19, 0.0, th + 5.0, 0.6), (tx + 18, 0.0, th + 9.0, 0.45)],
             [(tx + 22, 0.0, th + 2.0, 0.7), (tx + 30, 0.0, th + 1.5, 0.5)]]

    def sample(pts, n=24):
        out = []
        for (a_, b_) in zip(pts, pts[1:]):
            for t in np.linspace(0, 1, n, endpoint=False):
                out.append(tuple(a_[i] + (b_[i] - a_[i]) * t for i in range(4)))
        out.append(pts[-1])
        return out
    S = sample(main, 40)
    for tw in twigs:
        S += sample(tw, 16)
    S = np.array(S)
    slices = [d_tree, 7.5, 6.0, 5.0, 3.5, 2.5, 1.5, 0.0]
    bounds = [(slices[i] + slices[i + 1]) / 2 for i in range(len(slices) - 1)]
    for i, k in enumerate(slices):
        hi = d_tree + 0.01 if i == 0 else bounds[i - 1]
        lo = -0.01 if i == len(slices) - 1 else bounds[i]
        sel = S[(S[:, 1] <= hi) & (S[:, 1] >= lo)]
        if len(sel) == 0:
            continue

        def fn(u, y, k_, sp, sel=sel):
            rgb = np.zeros(u.shape + (3,), np.uint8)
            m = np.zeros(u.shape, bool)
            for (bu, bd, bh, br) in sel:
                yb_ = 60 + (116 - bh) * (116 - bd) / 116.0
                r_ = max(br * sp, 0.55)
                dd = np.hypot((u - bu) * sp, (y - yb_)) / r_
                hit = dd < 1
                # lit from above: a light top edge, the bark's furrows, a dark underside
                rel = (y - yb_) / r_
                n1 = hash01(np.floor(u * 2), np.floor(y * 3), 197)
                tt = np.where(rel < -0.5, 5, np.where(rel > 0.45, 1, 3 - (n1 > 0.7).astype(int) + (n1 < 0.12).astype(int)))
                rgb[hit] = BK[np.clip(tt, 0, 6)][hit]
                m |= hit
            return rgb, m
        us = sel[:, 0]
        ysb = 60 + (116 - sel[:, 2]) * (116 - sel[:, 1]) / 116.0
        plane_fill(sec, k, us.min() - 6, us.max() + 6, ysb.min() - 5, ysb.max() + 5, fn)
    # leaves on the twigs: clusters like the crown's, beyond the bike and over the bough's middle
    rng = random.Random(seed)
    for (lx, ld, lh, w_, h_) in ((tx + 21, 0.0, th + 8.0, 22, 15), (tx + 31, 0.0, th + 3.0, 15, 11)):
        cn = canopy(w_, h_, R['leaf'], rng.randint(1, 999), nb=9, rag=3.4, holes=0.09, spread=0.3)
        Lp, kk = sec.plane(ld)
        yc = 60 + (116 - lh) * (116 - ld) / 116.0
        Lp.blit(cn, sec.at(lx, s_d(kk)) - w_ / 2, yc - h_ * 0.62)


# ---------------------------------------------------------------- houses of the shopping street and the arrival
HOUSE_KIND = {0: ('step', 'brick_red', 'green'), 1: ('neck', 'brick_black', 'green'), 2: ('cornice', 'paint_cream', 'black'),
              3: ('bell', 'brick_purple', 'green'), 4: ('spout', 'brick_brown', 'red'), 5: ('neck', 'brick_red', 'black'),
              6: ('bell', 'paint_grey', 'blue'), 7: ('step', 'brick_purple', 'green'), 8: ('spout', 'brick_black', 'green'),
              9: ('neck', 'paint_grey', 'red'), 10: ('cornice', 'brick_purple', 'black'), 11: ('bell', 'paint_cream', 'blue'),
              12: ('cornice', 'brick_black', 'green')}


def goods_row(L, x0, x1, gy, goods, rng):
    """One shelf of goods in a shop window, from x0 to x1, standing on the row gy."""
    T = R['white']
    xg = x0 + 1
    while xg < x1 - 3:
        if goods == 'cheese':
            Yc = R['yellow']
            L.ellipse(xg + 2, gy - 1.5, 2.4, 1.6, Yc[4]); L.hl(xg + 0.5, gy - 3, 3, Yc[6]); L.hl(xg + 0.5, gy - 0.4, 3, Yc[2])
            if rng.random() < 0.5:
                L.ellipse(xg + 2, gy - 4.5, 2.0, 1.4, Yc[5])
            xg += 5
        elif goods == 'flowers':
            Fc = R[rng.choice(['red', 'yellow', 'white', 'rose' if 'rose' in R else 'red'])]
            L.rect(xg, gy - 3, 3, 3, R['iron'][3]); L.px(xg, gy - 3, R['iron'][5])
            L.rect(xg - 0.5, gy - 6, 4, 3, R['leaf'][3]); L.px(xg, gy - 6, Fc[5]); L.px(xg + 2, gy - 7, Fc[4]); L.px(xg + 1, gy - 5, Fc[5])
            xg += 5
        elif goods == 'books':
            for i in range(3):
                Bc = R[rng.choice(['red', 'blue', 'green', 'yellow', 'white'])]
                hh_ = rng.randint(3, 5)
                L.rect(xg + i, gy - hh_, 1, hh_, Bc[3 + (i % 2)])
            L.hl(xg - 0.5, gy, 4, R['wood'][2])
            xg += 4
        elif goods == 'bread':
            Wd = R['wood']
            L.ellipse(xg + 2, gy - 1.6, 2.4, 1.6, Wd[4]); L.hl(xg + 1, gy - 2.6, 2, Wd[6]); L.px(xg + 3, gy - 0.6, Wd[2])
            xg += 5
        elif goods == 'cups':
            L.rect(xg, gy - 3, 2, 3, T[5]); L.px(xg + 2, gy - 2, T[4]); L.px(xg, gy - 3, T[6])
            xg += 4
        elif goods == 'bikes':
            I = R['iron']
            L.ring(xg + 1.5, gy - 1.5, 1.6, I[1], 0.9); L.ring(xg + 5.5, gy - 1.5, 1.6, I[1], 0.9)
            L.line(xg + 1.5, gy - 1.5, xg + 3.5, gy - 3.5, R[rng.choice(['red', 'blue', 'black'])][4], t=TH)
            L.line(xg + 3.5, gy - 3.5, xg + 5.5, gy - 1.5, R['iron'][3], t=TH)
            xg += 8
        else:
            Cc = R[rng.choice(['red', 'yellow', 'white', 'blue', 'wood'])]
            L.rect(xg, gy - 2, 2, 2, Cc[4]); L.px(xg, gy - 2, Cc[6])
            xg += 3
    L.hl(x0, gy + 0.5, x1 - x0, R['wood'][2], t=0.5 if U > 1 else 1)


def shopfront(L, x, y, w, h, word, paint='green', goods='mixed', door_left=False, rng=None, fascia=True, clip_r=0):
    """A shop's ground floor at the house-front scale (a storey ~35 px): a painted wooden frame with pilasters, a deep
       fascia with our lettering, a band of small transom panes, a big display window with goods on shelves, a glazed
       door with its own transom, a panelled stall riser and a stone plinth."""
    rng = rng or random.Random(7)
    C = R[paint]; G = R['glass']; S = R['stone']; Y = R['yellow']
    L.rect(x, y, w, h, C[3])
    L.rect(x, y, 3, h, C[4]); L.vl(x, y, h, C[5]); L.vl(x + 2, y, h, C[2])                          # pilasters
    L.rect(x + w - 3, y, 3, h, C[2]); L.vl(x + w - 3, y, h, C[4]); L.vl(x + w - 1, y, h, C[1])
    L.rect(x, y + h - 3, w, 3, S[3]); L.hl(x, y + h - 3, w, S[5]); L.hl(x, y + h - 1, w, S[1])     # plinth
    fh = 12 if fascia else 3
    if fascia:
        L.hl(x - 1, y - 1, w + 2, S[6]); L.hl(x - 1, y, w + 2, S[4]); L.hl(x, y + 1, w, C[0])
        L.rect(x + 3, y + 2, w - 6, fh - 3, C[1]); L.hl(x + 3, y + 2, w - 6, C[0]); L.hl(x + 3, y + fh - 2, w - 6, C[4])
        L.hl(x, y + fh - 1, w, C[5])
        for cx_ in (x + 1, x + w - 3):                                                             # console heads
            L.rect(cx_, y + 1, 2, fh - 2, C[4]); L.px(cx_, y + 1, C[6])
        if word:
            tc = Y[6] if paint not in ('yellow',) else R['black'][1]
            sh = C[0] if paint not in ('yellow',) else None
            wv = w - clip_r                                                    # the part the next house leaves in view
            if text2_w(word) + 14 <= wv:
                text2(L, x + (wv - text2_w(word)) // 2, y + 2, word, tc, 2, shade=sh)
            else:
                text(L, x + (wv - text_w(word)) // 2, y + 4, word, tc)
    # the door with a transom over it (a narrow shop, under 40 px: a narrower door, so the display window keeps 12 px)
    narrow = w < 40
    dw = 10 if narrow else 13
    dx = x + 4 if door_left else x + w - dw - 4
    dy = y + fh + 1
    dh = h - fh - 4
    L.rect(dx - 1, dy - 1, dw + 2, dh + 2, C[5]); L.vl(dx + dw, dy, dh, C[1])
    L.rect(dx, dy, dw, dh, C[2]); L.vl(dx, dy, dh, C[4])
    L.rect(dx + 1, dy + 1, dw - 2, 4, G[2]); L.px(dx + 1, dy + 1, G[4]); L.vl(dx + dw // 2, dy + 1, 4, C[4], t=TH)
    L.hl(dx, dy + 5, dw, C[5])
    L.rect(dx + 2, dy + 7, dw - 4, int(dh * 0.48), G[1]); L.hl(dx + 2, dy + 7, dw - 4, G[0])
    L.line(dx + 3, dy + 8, dx + 5, dy + 12, G[3], t=TH)
    py = dy + 8 + int(dh * 0.48)
    if dh - (py - dy) > 5:
        L.rect(dx + 2, py, dw - 4, dh - (py - dy) - 3, C[1]); L.hl(dx + 2, py, dw - 4, C[0])
    L.rect(dx + dw - 3, dy + dh // 2 + 1, 1, 2, Y[5])
    L.hl(dx - 2, y + h - 3, dw + 4, S[6])
    # the display window
    wx0 = dx + dw + (3 if narrow else 4) if door_left else x + (4 if narrow else 5)
    wx1 = x + w - (4 if narrow else 5) if door_left else dx - (3 if narrow else 4)
    wy0, wy1 = y + fh + 1, y + h - 9
    if wx1 - wx0 < 8:
        return
    L.rect(wx0 - 1, wy0 - 1, wx1 - wx0 + 2, wy1 - wy0 + 2, C[5])
    tr = 5                                                                                         # transom panes
    L.rect(wx0, wy0, wx1 - wx0, tr, G[2]); L.hl(wx0, wy0, wx1 - wx0, G[0])
    xx = wx0 + 4
    while xx < wx1 - 1:
        L.vl(xx, wy0, tr, C[4], t=TH); xx += 4
    L.hl(wx0, wy0 + tr, wx1 - wx0, C[4])
    gy0 = wy0 + tr + 1
    L.rect(wx0, gy0, wx1 - wx0, wy1 - gy0, G[1]); L.hl(wx0, gy0, wx1 - wx0, G[0]); L.vl(wx1 - 1, gy0, wy1 - gy0, G[0])
    L.poly([(wx0 + 3, gy0 + 1), (wx0 + 8, gy0 + 1), (wx0 + 1, gy0 + 11), (wx0, gy0 + 11), (wx0, gy0 + 6)], G[3])
    L.poly([(wx0 + 10, gy0 + 1), (wx0 + 12, gy0 + 1), (wx0 + 5, gy0 + 11), (wx0 + 3, gy0 + 11)], G[2])
    # goods on shelves: the lowest at the sill, more above while they fit
    gy = wy1 - 1
    nsh = 0
    while gy - 8 > gy0 + 1 and nsh < 3:
        goods_row(L, wx0, wx1, gy, goods, rng)
        gy -= 9; nsh += 1
    if wx1 - wx0 > 18:
        L.vl((wx0 + wx1) // 2, gy0, wy1 - gy0, C[4], t=TH)
    L.hl(wx0 - 1, wy1 + 1, wx1 - wx0 + 2, S[5])
    L.rect(wx0, wy1 + 2, wx1 - wx0, y + h - 3 - (wy1 + 2), C[2])                                     # the stall riser
    L.rect(wx0 + 2, wy1 + 3, wx1 - wx0 - 4, max(1, y + h - 3 - (wy1 + 3) - 1), C[1]); L.hl(wx0 + 2, wy1 + 3, wx1 - wx0 - 4, C[0])


def facade_awning(L, x, y, w, col, h=8):
    """A striped awning flat on the facade over the shop window (shops without an awning platform)."""
    AW = R[col]; Wt = R['white']; G = R['glass']
    for j in range(h):
        for xx in range(int(x) - 1, int(x + w) + 1):
            on = ((xx - j // 3) // 4) % 2 == 0
            c = (AW[4] if j < h - 2 else AW[3]) if on else (Wt[5] if j < h - 2 else Wt[4])
            L.px(xx, y + j, c)
    L.hl(x - 1, y, w + 2, AW[5])
    for xx in range(int(x) - 1, int(x + w) + 1, 4):                       # scallops
        L.px(xx + 1, y + h, AW[3] if ((xx // 4) % 2 == 0) else Wt[4]); L.px(xx + 2, y + h, AW[3] if ((xx // 4) % 2 == 0) else Wt[4])
    L.hl(x - 1, y + h + 1, w + 2, G[0])


ST14 = 40 * s_d(14)                                           # a storey on the house fronts (depth 14): 35 px
SC14 = 2 * s_d(14)                                            # the kit's house scale there


def street_house(rng, w, frame, shop=None, seed=0, brick=None, n=3, gf=None, storeys=None, french=None, clip_r=0, cols=None,
                 bays=()):
    """A canal house front at depth 14 at the scale rule for one of the game's 13 house looks (w = the game's box);
       n upper storeys of ~35 px over a ground floor of ~47 px (or the given lines). Shops get a shopfront.
       Returns (Layer, info)."""
    kind, brick0, door = HOUSE_KIND[frame]
    brick = brick or brick0
    if cols is None and w < 40:              # a narrow front (one of 2-3 m): one column of windows in the middle
        cols = [(w - max(4, q_(7 * SC14))) // 2]
    r2 = random.Random(seed * 5 + 3)
    if storeys is None:
        storeys = [q_(ST14 * (1.04 - 0.03 * j) * r2.uniform(0.97, 1.03)) for j in range(n)]
    if gf is None:
        gf = q_(27 * SC14)
    H, info = house_a(rng, w, 0, kind, brick, trim='plaster', doorc=door, sc=SC14, seed=seed, gf_px=gf, storeys=storeys,
                      french=french, cols=cols)
    for bay in bays:
        waver_bay(H, info, bay, brick, seed)
    h = H.h
    if shop:
        word, paint, goods, aw = shop[:4]
        shopfront(H, 1, h - gf, w - 2, gf, word, paint, goods, door_left=(seed % 2 == 0), rng=random.Random(seed),
                  clip_r=max(0, clip_r - 1))
        if aw:
            facade_awning(H, 4, h - gf + 13, w - 8, aw)
    return H, info


def waver_bay(H, info, bay, brick, seed):
    """The window of a game window waver (npc ams-window-waver: an opaque 20 x 26 sprite, always drawn) on a house front.
       bay = (x, y): x = the house-local left of the sprite's box, rounded; y = its top + 1.5, rounded up (the sprite is
       drawn at depth 14 with the floor's lift there, at quarter px: the stair window keeps >= 1/4 px inside the opaque
       part of the sprite). The grid windows the box would cut are bricked up again (the same bricks: the body's own
       brickfill under a mask), and a stair window that the sprite covers whole takes the place: nothing of the facade's
       windows peeks out round the waver. The windows' extent: lintel and keystone 4 rows up, sill and shade 2 down."""
    bx, by = bay
    B = R[brick]; T = R['plaster']; G = R['glass']
    gh, hb, w = info['gh'], info['hb'], H.w
    xx, yy = grid(0, gh, w, hb)
    m = np.zeros(xx.shape, bool)
    for (gx, gy, gw, gh_) in info['win']:
        x, y, ww, wh = gx - 1, gy - 1, gw + 2, gh_ + 2
        ex0, ey0, ex1, ey1 = x - 1, y - 4, x + ww + 2, y + wh + 2
        if ex0 < bx + 21 and bx - 1 < ex1 and ey0 < by + 25 and by - 2 < ey1:      # the sprite's box, with slack
            m |= (xx >= ex0) & (xx < ex1) & (yy >= ey0) & (yy < ey1)
    if m.any():
        brickfill(H, 0, gh, w, hb, B, seed, mask=m, streaks=True)
    window(H, bx + 2, by + 1, 15, 19, T, G, random.Random(seed * 7 + 5), B, kind='dark')


FABEL_H = 141                                                # cornice 15 + two storeys of 37 + the shopfront 52


def fabel_friet(rng):
    """FABEL FRIET (98 x 141): a cream-white wooden shopfront with a deep cornice, the big window with our lettering
       FABEL over FRIET and potatoes at its foot, an open white door; red brick floors above with a deep cornice."""
    B = R['brick_red']; T = R['white']; G = R['glass']; S = R['stone']; Y = R['yellow']; Wd = R['wood']; I = R['iron']
    CR = R['cream']
    w, h = 98, FABEL_H
    L = Layer(w, h)
    sf = h - 52                                                           # the shopfront's top
    brickfill(L, 0, 12, w, sf - 12, B, 301, streaks=True)
    L.vl(0, 12, sf - 12, B[5]); L.vl(w - 1, 12, sf - 12, B[1]); L.vl(w - 2, 12, sf - 12, B[2])
    # the deep cornice on top: moulding, a frieze with consoles, a balustered parapet with a blind attic
    L.rect(4, 0, w - 8, 6, T[4]); L.hl(4, 0, w - 8, T[6]); L.vl(4, 0, 6, T[6]); L.vl(w - 5, 0, 6, T[2])
    for x in range(8, w - 8, 4):
        L.vl(x, 1, 4, T[3], t=TH)
    L.hl(0, 6, w, T[6]); L.hl(0, 7, w, T[5]); L.hl(-0, 8, w, T[3]); L.hl(1, 9, w - 2, T[4])
    for x in range(3, w - 3, 8):                                       # consoles
        L.rect(x, 10, 3, 3, T[5]); L.px(x, 10, T[6]); L.px(x + 2, 12, T[2])
    for x in range(2, w - 2, 2):                                       # dentils
        L.px(x, 13, T[4])
    L.hl(0, 14, w, B[1])
    # two floors of tall windows
    for (wy, wh) in ((20, 25), (57, 25)):
        for wx in (9, 31, 55, 77):
            window(L, wx, wy, 12, wh, T, G, rng, B)
            L.rect(wx - 1, wy - 3, 14, 2, T[5]); L.hl(wx - 1, wy - 3, 14, T[6])          # stone lintels
    for ax in (3, w - 4):
        for ay in (49, 86):
            L.vl(ax, ay, 2, I[1])
    # the shopfront: cream-white wood
    L.rect(0, sf, w, h - sf, CR[5])
    L.hl(0, sf, w, T[6]); L.hl(0, sf + 1, w, CR[4])
    L.rect(0, sf + 2, w, 8, CR[5]); L.hl(0, sf + 9, w, CR[3]); L.hl(0, sf + 10, w, CR[6])        # the deep fascia
    for x in range(2, w - 2, 6):
        L.px(x, sf + 5, CR[3]); L.px(x + 1, sf + 5, CR[6])
    L.rect(0, sf + 2, 3, h - sf - 2, CR[6]); L.vl(2, sf + 2, h - sf - 2, CR[3])               # pilasters
    L.rect(w - 3, sf + 2, 3, h - sf - 2, CR[4]); L.vl(w - 3, sf + 2, h - sf - 2, CR[6])
    # the big window
    wx0, wx1, wy0, wy1 = 5, 58, sf + 13, h - 5
    L.rect(wx0 - 1, wy0 - 1, wx1 - wx0 + 2, wy1 - wy0 + 2, CR[3])
    L.rect(wx0, wy0, wx1 - wx0, wy1 - wy0, G[0]); L.rect(wx0, wy0 + 2, wx1 - wx0, wy1 - wy0 - 2, G[1])
    L.poly([(wx0 + 34, wy0 + 1), (wx0 + 40, wy0 + 1), (wx0 + 26, wy1 - 1), (wx0 + 20, wy1 - 1)], G[2])
    L.poly([(wx0 + 42, wy0 + 1), (wx0 + 44, wy0 + 1), (wx0 + 30, wy1 - 1), (wx0 + 28, wy1 - 1)], G[3])
    tw = text2_w('FABEL'); text2(L, wx0 + (wx1 - wx0 - tw) // 2, wy0 + 2, 'FABEL', Y[5], 2, shade=Wd[1])
    tw = text2_w('FRIET'); text2(L, wx0 + (wx1 - wx0 - tw) // 2, wy0 + 14, 'FRIET', Y[6], 2, shade=Wd[1])
    for x in range(wx0 + 4, wx1 - 4, 3):                               # gold lines around the lettering
        L.px(x, wy0 + 13, Y[3])
    # potatoes at the foot of the window
    pr = random.Random(5)
    for i in range(22):
        px_ = wx0 + 2 + pr.random() * (wx1 - wx0 - 5); py_ = wy1 - 1.4 - pr.random() * (1.8 if abs(px_ - (wx0 + wx1) / 2) < 16 else 0.8)
        L.ellipse(px_, py_, 1.7, 1.1, Wd[4]); L.px(px_ - 1, py_ - 1, Wd[5]); L.px(px_ + 1, py_ + 0.4, Wd[2])
    L.hl(wx0, wy1 - 0.5, wx1 - wx0, Wd[2], t=0.5)
    L.hl(wx0 - 1, wy1 + 1, wx1 - wx0 + 2, S[5])
    if h - 2 - wy1 - 2 > 0:
        L.rect(wx0, wy1 + 2, wx1 - wx0, h - 2 - wy1 - 2, CR[4]); L.hl(wx0, wy1 + 2, wx1 - wx0, CR[6])
    # the open white door (the baker stands in it): a deep interior, the leaf folded in on the left
    dx0, dx1, dy0 = 61, 81, sf + 12
    L.rect(dx0 - 1, dy0 - 1, dx1 - dx0 + 2, h - dy0 + 1, T[6])
    L.rect(dx0, dy0, dx1 - dx0, h - 2 - dy0, Wd[1])
    L.rect(dx0, dy0, dx1 - dx0, 6, T[3])                                 # the transom
    L.rect(dx0 + 1, dy0 + 1, dx1 - dx0 - 2, 4, G[2]); L.px(dx0 + 2, dy0 + 1, G[4])
    L.rect(dx0, dy0 + 6, dx1 - dx0, h - 2 - dy0 - 6, Wd[1])
    for yy in range(dy0 + 8, h - 2, 3):                                  # white tiles on the back wall
        for xx in range(dx0 + 4, dx1 - 1, 3):
            L.px(xx, yy, T[3])
    L.rect(dx0 + 4, dy0 + 7, dx1 - dx0 - 6, 3, Wd[2]); L.hl(dx0 + 4, dy0 + 7, dx1 - dx0 - 6, Y[4])        # a lamp shelf
    L.rect(dx0, dy0 + 6, 4, h - 2 - dy0 - 6, T[5]); L.vl(dx0, dy0 + 6, h - 2 - dy0 - 6, T[6]); L.vl(dx0 + 3, dy0 + 6, h - 2 - dy0 - 6, T[3])
    L.rect(dx0 + 1, dy0 + 9, 2, 8, G[2])
    L.rect(dx0 - 2, h - 2, dx1 - dx0 + 4, 2, S[5]); L.hl(dx0 - 2, h - 2, dx1 - dx0 + 4, S[6])
    # a small window right of the door
    L.rect(84, sf + 13, 10, h - sf - 21, CR[3]); L.rect(85, sf + 14, 8, h - sf - 23, G[1]); L.px(85, sf + 14, G[4]); L.vl(89, sf + 14, h - sf - 23, CR[5], t=TH)
    L.hl(0, h - 1, w, S[1])
    return L


def fabel_sign():
    """The hanging oval sign of FABEL FRIET on its iron bracket (42 x 36, anchor 20, 1)."""
    I = R['iron']; Y = R['yellow']; Rd = R['red']; T = R['white']; Wd = R['wood']
    L = Layer(42, 36)
    L.rect(4, 0, 34, 2, I[2]); L.hl(4, 0, 34, I[4]); L.rect(2, 0, 3, 4, I[1])       # the bracket
    L.line(5, 2, 14, 0.5, I[2], t=TH)
    for x in (12, 30):
        L.vl(x, 2, 4, I[1], t=TH)
    L.ellipse(21, 20, 17, 13.5, Y[3]); L.ellipse(20.5, 19.5, 16, 12.5, Y[5]); L.ellipse(21, 20, 14.5, 11, Rd[2])
    L.ellipse(20.5, 19.5, 13.5, 10, Rd[3])
    text(L, 21 - text_w('FABEL') // 2, 13, 'FABEL', Y[6])
    text(L, 21 - text_w('FRIET') // 2, 20, 'FRIET', T[6])
    L.hl(10, 26, 22, Y[4], t=TH)
    L.px(10, 14, Y[6]); L.px(9, 15, Y[6])
    return L


def fabel_counter():
    """The counter in front of the door (30 x 18 and its top, 4 more rows): cream wood, a white top, cones of fries."""
    CR = R['cream']; T = R['white']; Wd = R['wood']; Y = R['yellow']; S = R['stone']; Rd = R['red']
    L = Layer(30, 22)
    L.poly([(1, 4), (29, 4), (27, 0.5), (3, 0.5)], T[5])                # the top face toward the door
    L.hl(3, 0.5, 24, T[3])
    L.rect(0, 4, 30, 2, T[6]); L.hl(0, 5, 30, T[4])
    L.rect(1, 6, 28, 15, CR[5]); L.vl(1, 6, 15, CR[6]); L.vl(28, 6, 15, CR[2])
    for x in (8, 15, 22):
        L.vl(x, 7, 13, CR[3], t=TH)
    L.rect(4, 9, 22, 7, CR[4]); L.hl(4, 9, 22, CR[3]); L.hl(4, 15, 22, CR[6])
    text(L, 15 - text_w('FRIET') // 2, 10, 'FRIET', Rd[3])
    L.hl(0, 21, 30, S[1])
    for cx in (6, 11):                                                    # paper cones with fries
        L.poly([(cx - 2, 0.5), (cx + 2, 0.5), (cx, 4)], T[6])
        for i in range(3):
            L.vl(cx - 1.5 + i * 1.2, -2 + 2.5, 1.5, Y[5], t=TH)
    return L


def neighbour(rng):
    """The neighbour shop (66 wide): an orange-brown wooden front of 48 px with leaded glass, two storeys of brick
       above at the house-front scale, a step gable. Returns (Layer, info)."""
    GF = 48
    H, info = house_a(rng, 66, 0, 'step', 'brick_purple', trim='plaster', doorc='green', sc=SC14, seed=411, gf_px=GF,
                      storeys=[36, 35])
    L = H
    h = L.h
    Wd = R['wood']; G = R['glass']; S = R['stone']; Y = R['yellow']; I = R['iron']
    OR = R['brick_ochre']
    y0 = h - GF
    L.rect(0, y0, 66, GF, Wd[3])
    L.rect(0, y0, 3, GF, Wd[4]); L.vl(0, y0, GF, Wd[5]); L.vl(2, y0, GF, Wd[2])
    L.rect(63, y0, 3, GF, Wd[2]); L.vl(63, y0, GF, Wd[4]); L.vl(65, y0, GF, Wd[1])
    L.hl(-1, y0 - 1, 68, S[6]); L.hl(0, y0, 66, Wd[5]); L.rect(3, y0 + 1, 60, 11, Wd[1]); L.hl(3, y0 + 1, 60, Wd[0])
    L.hl(3, y0 + 11, 60, Wd[4]); L.hl(0, y0 + 12, 66, Wd[5])
    text2(L, 33 - text2_w('SNOEP') // 2, y0 + 2, 'SNOEP', Y[5], 2, shade=Wd[0])
    # leaded glass: a band of small diamond panes over the window and the door
    gx0, gx1 = 4, 62
    gy0 = y0 + 14
    for yy in sub(gy0, gy0 + 8):
        for xx in sub(gx0, gx1):
            dd = (abs(((xx - gx0) % 4) - 2) + abs(((yy - gy0) % 4) - 2))
            c = I[1] if dd >= 1.8 and dd < 2.4 else (G[3] if ((int((xx - gx0) // 4) + int((yy - gy0) // 4)) % 2) else OR[5])
            L.rect(xx, yy, D1, D1, c)
    L.hl(gx0, gy0 + 8, gx1 - gx0, Wd[1])
    # the window: jars of sweets on two shelves
    wy0, wy1 = gy0 + 9, h - 9
    L.rect(4, wy0, 42, wy1 - wy0, G[1]); L.hl(4, wy0, 42, G[0]); L.vl(25, wy0, wy1 - wy0, Wd[4], t=TH)
    L.poly([(9, wy0 + 1), (14, wy0 + 1), (6, wy0 + 13), (4, wy0 + 13), (4, wy0 + 8)], G[2])
    for sy in (wy1 - 1, wy1 - 9):
        for x in range(6, 44, 5):
            Cc = R[rng.choice(['red', 'yellow', 'white', 'green', 'rose' if 'rose' in R else 'red'])]
            L.rect(x, sy - 5, 3, 5, G[3]); L.rect(x, sy - 3, 3, 3, Cc[4]); L.px(x, sy - 3, Cc[6]); L.hl(x, sy - 6, 3, Wd[4])
        L.hl(4, sy + 0.5, 42, Wd[2], t=0.5 if U > 1 else 1)
    L.hl(3, wy1, 44, S[5]); L.rect(4, wy1 + 1, 42, h - 3 - (wy1 + 1), Wd[2]); L.rect(6, wy1 + 2, 38, h - 3 - (wy1 + 2) - 1, Wd[1])
    # the door: a glazed upper half, panels below
    dx, dw = 49, 12
    L.vl(dx - 1, wy0 - 1, h - 2 - (wy0 - 1), Wd[5])
    L.rect(dx, wy0 - 1, dw, h - 2 - (wy0 - 1), Wd[1]); L.rect(dx + 2, wy0 + 1, dw - 4, 14, G[1]); L.px(dx + 2, wy0 + 1, G[4])
    L.line(dx + 3, wy0 + 2, dx + 5, wy0 + 6, G[3], t=TH)
    L.rect(dx + 2, wy0 + 17, dw - 4, h - 6 - (wy0 + 17), Wd[2]); L.hl(dx + 2, wy0 + 17, dw - 4, Wd[0])
    L.px(dx + dw - 2, wy0 + 15, Y[5])
    L.rect(0, h - 3, 66, 3, S[3]); L.hl(0, h - 3, 66, S[5]); L.hl(0, h - 1, 66, S[1])
    return L, info


# ---------------------------------------------------------------- awnings and ledges in the walk plane
AWNING_COL = ['green', 'red', 'blue', 'roof_tile']


def valance(w, col, h=7):
    """The front edge of an awning platform (walk plane): a striped valance with scallops; the top row = the platform."""
    AW = R[col]; Wt = R['white']; I = R['iron']
    L = Layer(w, h)
    for x in sub(0, w):
        on = (int(math.floor(x / 4.0 + 1e-6)) % 2) == 0
        C = AW if on else Wt
        L.rect(x, 0, D1, 1, C[6] if not on else C[5])
        L.rect(x, 1, D1, h - 3, C[4])
        L.rect(x, h - 3, D1, 1, C[3])
        f = (x % 4.0) / 4.0
        if abs(f - 0.5) < 0.38:
            L.rect(x, h - 2, D1, 1, C[3])
        if abs(f - 0.5) < 0.2:
            L.rect(x, h - 1, D1, 1, C[2])
    L.hl(0, 1, w, AW[2] if False else R['black'][1], t=TH) if False else None
    L.vl(0, 0, h - 1, I[2]); L.vl(w - 1, 0, h - 1, I[1])
    return L


def awning_top(col):
    AW, Wt = A(col), A('white')

    def fn(u, d):
        on = (np.floor((u - 0) / 4.0) % 2) == 0
        t = np.where(d < 2.5, 5, np.where(d < 10, 4, 3))
        t = t - ((np.floor(d * 2.2) % 5) == 0).astype(int) * (d > 3)
        rgb = np.where(on[..., None], AW[np.clip(t, 0, 6)], Wt[np.clip(t, 0, 6)])
        return rgb, np.ones(u.shape, bool)
    return fn


def hoist_beam(sec, x, y, d_back=14, w=3, th=3, slices=(1.5, 2.5, 3.5, 5, 6, 7, 8, 9, 10, 11.5, 12.5)):
    """A hoist beam that reaches out of a house front (depth d_back) to the walk line, where a game entity hangs from
       its hook (the hoist secret: the hook at (x, y + 5) in the walk plane, the beam's top at y). The beam lies along
       the depth, so it is painted as its cross-section in the planes of the depths it passes (thin depth slices, as
       the lift bridge's column sides; mostly planes the section has anyway, at most 1.5 apart so the slices join at
       every camera): the top light, the side in shade. Its root sits on the front, the end grain with an iron band
       and the hook in the walk plane. (A rows layer cannot draw it: seen almost edge-on its rows fall apart.)"""
    Wd = R['wood']; I = R['iron']
    for k in (d_back,) + tuple(slices):
        Lp, kq = sec.plane(k)
        sp = s_d(kq)
        top = (GY - kq) - (176 - y) * sp
        ww, hh = max(D1, w * sp), max(D1, th * sp)
        x0 = sec.at(x, sp) - ww / 2.0
        Lp.rect(x0, top, ww, hh, Wd[2] if kq < d_back else Wd[1])
        Lp.rect(x0, top, ww, min(hh, max(D1, 0.8 * sp)), Wd[5] if kq < d_back else Wd[2])
    E = Layer(w + 2, th + 6)                                          # the end grain, an iron band, the hook
    E.rect(1, 0, w, th, Wd[3]); E.hl(1, 0, w, Wd[5]); E.vl(w, 0, th, Wd[1])
    E.hl(1, th - 1, w, I[2])
    hx = 1 + w // 2
    E.vl(hx, th, 2, I[1], t=TH); E.px(hx, th + 2, I[3]); E.px(hx - 1, th + 2, I[1])
    put_top(sec, E, x, 0, 1 + w / 2.0, y)
    return []


def balcony(w=38):
    """The stone balcony on the gable (the golden record's ledge): balusters behind, a slab with consoles below.
       38 x 22; the slab's top row (y 15) is the platform line."""
    S = R['stone']; T = R['white']
    L = Layer(w, 24)
    L.rect(0, 0, w, 2, S[5]); L.hl(0, 0, w, S[6]); L.hl(0, 2, w, S[2])           # hand rail
    for x in range(2, w - 2, 3):                                                   # balusters
        for j in sub(3, 15):
            hw = 0.8 + 0.45 * math.sin(math.pi * (j - 3) / 12.0) ** 2
            L.rect(x + 1 - hw, j, 2 * hw, D1, S[4]); L.rect(x + 1 - hw, j, D1 if U > 1 else 1, D1, S[6])
    L.rect(0, 0, 2, 15, S[5]); L.rect(w - 2, 0, 2, 15, S[3])
    L.rect(-0, 15, w, 3, S[5]); L.hl(0, 15, w, S[6]); L.hl(0, 17, w, S[2])          # the slab
    for x in (3, w // 2 - 1, w - 6):                                              # consoles
        L.rect(x, 18, 3, 4, S[4]); L.px(x, 18, S[6]); L.rect(x + 1, 22, 1, 1, S[2])
    return L


# ---------------------------------------------------------------- boats in the walk plane
def houseboat_front(b, col, seed):
    """A houseboat's front faces: hull x0..x0+w (deck y 164), the cabin cx..cx+cw (roof y 146). Top at y 132."""
    rng = random.Random(seed)
    x0, w, cx, cw = b['x0'], b['w'], b['cx'], b['cw']
    C = R[col]; K = R['black']; T = R['white']; G = R['glass']; Wd = R['wood']; LF = R['leaf']; I = R['iron']; M = R['moss']
    TOP = 132
    L = Layer(w + 2, 192 - TOP)
    oy = lambda y: y - TOP
    # hull
    hy0, hy1 = oy(164), oy(182)
    for x in sub(0, w):
        e = min(x, w - D1 - x)
        cut = 2.4 * max(0.0, 1 - (e + D1) / 5.0) ** 1.4
        L.rect(x, hy0, D1, hy1 - hy0 - cut, K[2])
        L.rect(x, hy0, D1, 1, Wd[5]); L.rect(x, hy0 + 1, D1, 1, Wd[3])
        L.rect(x, hy0 + 2, D1, 1, T[5])
        L.rect(x, hy0 + 6, D1, 1, K[3])
        L.rect(x, hy1 - cut - 1.5, D1, 1.5, M[1])
    for xx in range(2, w - 2, 5):
        L.px(xx, hy0 + 4, K[3]); L.px(xx, hy0 + 9, K[1])
    for xx in (3, w - 6):                                                  # fenders (old tyres)
        L.ellipse(xx + 1.5, hy0 + 6, 1.8, 2.4, K[0]); L.ellipse(xx + 1.5, hy0 + 6, 0.8, 1.2, K[2])
    # the broken mirror of the hull in the water below
    xx, yy = grid(0, hy1, w, 9)
    xs = xx - np.round(1.6 * np.sin(np.floor(yy * DET) / DET * 1.9))
    m = chk(xs, yy) & (hash01(xs / 3, yy * DET, seed) > 0.25 + (yy - hy1) * 0.07) & (xs >= 1) & (xs < w - 1)
    L.put(0, hy1, np.broadcast_to(np.array(K[1], np.uint8), xx.shape + (3,)), m)
    # cabin
    cx0 = cx - x0
    cy0, cy1 = oy(146), oy(164)
    L.rect(cx0, cy0, cw, cy1 - cy0, C[4])
    for xx_ in range(cx0 + 2, cx0 + cw - 1, 3):
        L.vl(xx_, cy0 + 2, cy1 - cy0 - 2, C[3], t=TH)
    L.vl(cx0, cy0, cy1 - cy0, C[5]); L.vl(cx0 + cw - 1, cy0, cy1 - cy0, C[1])
    L.rect(cx0 - 1, cy0, cw + 2, 2, T[6]); L.hl(cx0 - 1, cy0 + 1, cw + 2, T[4]); L.hl(cx0, cy0 + 2, cw, C[1])
    L.hl(cx0, cy1 - 1, cw, C[2])
    xw = cx0 + 3
    i = 0
    while xw < cx0 + cw - 8:
        if i == 1:                                                      # the door
            L.rect(xw, cy0 + 4, 7, cy1 - cy0 - 4, T[5]); L.rect(xw + 1, cy0 + 5, 5, cy1 - cy0 - 5, R['blue' if col != 'blue' else 'red'][3])
            L.rect(xw + 2, cy0 + 6, 3, 4, G[2]); L.px(xw + 5, cy0 + 12, R['yellow'][5])
            xw += 10
        else:
            ww = 9 if i % 2 == 0 else 7
            L.rect(xw, cy0 + 4, ww, 9, T[5]); L.rect(xw + 1, cy0 + 5, ww - 2, 7, G[1]); L.hl(xw + 1, cy0 + 5, ww - 2, G[0])
            L.vl(xw + ww // 2, cy0 + 5, 7, T[5], t=TH); L.px(xw + 1, cy0 + 6, G[4]); L.px(xw + 2, cy0 + 6, G[3])
            if rng.random() < 0.5:
                L.rect(xw + 1, cy0 + 9, ww - 2, 3, T[4])
            if rng.random() < 0.6:                                      # a window box with flowers
                L.rect(xw, cy0 + 13, ww, 2, Wd[3]); L.hl(xw, cy0 + 13, ww, Wd[5])
                for fx in range(xw, xw + ww, 2):
                    L.px(fx, cy0 + 12, R[rng.choice(['red', 'yellow', 'red', 'white'])][5]); L.px(fx + 1, cy0 + 12, LF[4])
            xw += ww + 3
        i += 1
    # roof furniture: pots with plants, a chimney (the smoke starts at its top)
    chim = 1155 if x0 < 1200 else 1277
    chx = chim - x0 - 1.5
    L.rect(chx, oy(139), 3, oy(146) - oy(139), I[2]); L.vl(chx, oy(139), 7, I[4]); L.hl(chx - 1, oy(139), 5, I[1]); L.hl(chx - 1, oy(138), 5, I[3])
    px_ = cx0 + 3
    while px_ < cx0 + cw - 8:
        if abs(px_ - chx) > 6:
            pw = rng.randint(4, 6)
            L.rect(px_, cy0 - 3, pw, 3, R['roof_tile'][3]); L.hl(px_ - 0.5, cy0 - 3, pw + 1, R['roof_tile'][5])
            cn = canopy(pw + 6, 8, R['leaf'], rng.randint(1, 999), nb=4, rag=3, holes=0.05)
            L.blit(cn, px_ - 3, cy0 - 10)
            if rng.random() < 0.6:
                fc = R[rng.choice(['red', 'yellow', 'white'])]
                for k in range(3):
                    L.px(px_ - 1 + rng.randint(0, pw + 1), cy0 - 9 + rng.randint(0, 4), fc[5])
        px_ += rng.randint(11, 17)
    # on the deck beside the cabin: a bike, a bench, mooring bollards
    L.rect(1, hy0 - 3, 2, 3, I[2]); L.px(1, hy0 - 3, I[4])
    L.rect(w - 3, hy0 - 3, 2, 3, I[2]); L.px(w - 3, hy0 - 3, I[4])
    if w - (cx0 + cw) > 14:
        bx = cx0 + cw + 3
        L.rect(bx, hy0 - 6, 9, 2, Wd[4]); L.hl(bx, hy0 - 6, 9, Wd[6]); L.vl(bx + 1, hy0 - 4, 4, Wd[2]); L.vl(bx + 7, hy0 - 4, 4, Wd[2])
    if cx0 > 10:
        Fc = R['red']
        L.rect(3, hy0 - 4, 5, 4, R['roof_tile'][3]); L.hl(3, hy0 - 4, 5, R['roof_tile'][5])
        cn = canopy(10, 8, R['leaf'], seed + 3, nb=4, rag=3, holes=0.05); L.blit(cn, 0.5, hy0 - 11)
        L.px(3, hy0 - 9, Fc[5]); L.px(6, hy0 - 8, Fc[5])
    return L


def deck_top(b, col_roof):
    """The rows-layer painters for a houseboat: its deck top (around the cabin) and its cabin roof top."""
    Wd, S, M, K, RS = A('wood'), A('stone'), A('moss'), A('black'), A(col_roof)

    def deck(u, d):
        v = 210 * (1 - 116 / np.maximum(116 - d, 1))
        j = np.floor(-v / 2.0)
        t = 3 + (hash01(np.floor(u / 23.0 + j * 0.37), j, 51) > 0.7).astype(int)
        t = np.where(((-v / 2.0) - j) < 0.25, 2, t)
        rgb = Wd[np.clip(t, 0, 6)]
        rgb[d > 10.0] = K[2]
        rgb[(d < 0.7)] = Wd[5]
        return rgb, np.ones(u.shape, bool)

    def roof(u, d):
        n = hash01(u * 2, d * 3, 52)
        if col_roof == 'moss':                                           # a green sedum roof
            t = 3 + (n > 0.7).astype(int) - (n < 0.2).astype(int) + (fbm(u / 5.0, d / 2.0, 53, 2) > 0.55).astype(int)
        else:
            t = 3 + (n > 0.8).astype(int) - (n < 0.15).astype(int)
        rgb = RS[np.clip(t, 1, 5)]
        rgb[d < 0.8] = A('white')[6]
        rgb[d > 8.2] = A('white')[3]
        return rgb, np.ones(u.shape, bool)
    return deck, roof


def tour_boat_platform(phase=0):
    """The moving canal boat (a platform) at its spawn: a low open launch, a plank deck with a rail, an outboard.
       56 x 16; its top row (y 0 -> y 172) is the platform. phase 1: the game's second wake frame (the foam moves)."""
    T = R['white']; Bl = R['blue']; Wd = R['wood']; K = R['black']; I = R['iron']
    L = Layer(58, 16)
    for x in sub(0, 56):
        t = x / 56.0
        bot = 9 - (2.6 * max(0.0, (x - 44) / 12.0) ** 1.4)
        top = 0 - 1.6 * max(0.0, (x - 46) / 10.0)
        L.rect(x + 1, top, D1, 1.4, Wd[5]); L.rect(x + 1, top + 1.4, D1, 0.8, Wd[3])
        L.rect(x + 1, top + 2.2, D1, bot - top - 2.2, T[4])
        L.rect(x + 1, top + 4, D1, 1.2, Bl[3])
        L.rect(x + 1, bot - 1, D1, 1, K[2])
    for xx in range(4, 50, 7):
        L.px(xx, 0.6, Wd[2])
    L.rect(0, -0 + 1, 3, 9, K[2]); L.vl(0, 1, 9, K[4]); L.rect(-0, 9, 2, 3, K[1])                # the outboard
    L.vl(52, -4, 4, I[2], t=TH); L.rect(52, -4, 2, 1.5, R['red'][4])                            # a little flag
    xx, yy = grid(1, 9, 54, 6)
    xs = xx - np.round(1.4 * np.sin(np.floor(yy * DET) / DET * 2.1)) - 2 * phase
    m = chk(xs, yy) & (hash01(xs / 3, yy * DET, 9) > 0.3 + (yy - 9) * 0.1)
    L.put(1, 9, np.broadcast_to(np.array(T[2], np.uint8), xx.shape + (3,)), m)
    return L


# ---------------------------------------------------------------- breakables at their spawn (intact)
def tulip_stall(rng):
    """The tulip stall (46 x 34): a wooden stall with a striped roof, three tiers of buckets with tulips, a sign."""
    Wd = R['wood']; T = R['white']; G = R['green']; I = R['iron']; LF = R['leaf']
    L = Layer(46, 34)
    for x in (2, 42):
        L.rect(x, 4, 2, 30, Wd[2]); L.vl(x, 4, 30, Wd[4])
    for j in range(5):                                                      # the roof
        for x in range(0, 46):
            on = ((x - j // 2) // 4) % 2 == 0
            L.px(x, j, (G[4] if j < 4 else G[3]) if on else (T[5] if j < 4 else T[4]))
    L.hl(0, 0, 46, G[5])
    L.rect(6, 6, 34, 6, T[5]); L.hl(6, 6, 34, T[6])
    text(L, 23 - text_w('TULPEN') // 2, 6, 'TULPEN', G[2])
    for (ty, x0_, x1_) in ((15, 5, 41), (21, 3, 43), (27, 1, 45)):         # tiers
        L.rect(x0_, ty + 4, x1_ - x0_, 2, Wd[4]); L.hl(x0_, ty + 4, x1_ - x0_, Wd[6]); L.hl(x0_, ty + 5, x1_ - x0_, Wd[1])
        x = x0_ + 1
        while x < x1_ - 4:
            L.rect(x, ty + 1, 4, 3, I[3]); L.hl(x, ty + 1, 4, I[5]); L.vl(x + 3, ty + 1, 3, I[1])
            Fc = R[rng.choice(['red', 'yellow', 'red', 'white', 'rose' if 'rose' in R else 'red'])]
            for i in range(3):
                fx = x + 0.3 + i * 1.3
                L.vl(fx + 0.4, ty - 1, 2, LF[3], t=TH)
                L.rect(fx, ty - 2.5, 1.3, 1.6, Fc[4]); L.px(fx, ty - 2.5, Fc[6])
            x += 5
    L.rect(4, 33, 38, 1, R['black'][1])
    return L


def herring_cart(rng):
    """The herring cart (46 x 36): a white-and-blue cart with a little roof, a glass display, HARING, two wheels."""
    T = R['white']; Bl = R['blue']; G = R['glass']; K = R['black']; I = R['iron']; Rd = R['red']; Wd = R['wood']
    L = Layer(46, 36)
    L.rect(2, 2, 42, 3, Bl[3]); L.hl(1, 1, 44, Bl[5]); L.hl(2, 4, 42, Bl[1])                     # the roof
    for x in (4, 41):
        L.rect(x, 5, 1.5, 10, I[3])
    for x in range(3, 44, 4):                                                                     # the flags on the roof
        L.rect(x, 0, 2, 1, (Rd if (x // 4) % 3 == 0 else (T if (x // 4) % 3 == 1 else Bl))[5])
    L.rect(3, 13, 40, 7, G[2]); L.hl(3, 13, 40, G[4]); L.rect(4, 15, 38, 4, G[1])               # the display
    for x in range(6, 40, 4):
        L.ellipse(x + 1.2, 17, 1.6, 0.9, R['stone'][5]); L.px(x, 16.6, R['stone'][6])
    L.rect(1, 20, 44, 11, T[5]); L.hl(1, 20, 44, T[6]); L.vl(1, 20, 11, T[6]); L.vl(44, 20, 11, T[2])
    L.rect(2, 27, 42, 2, Bl[3]); L.hl(2, 27, 42, Bl[4])
    text(L, 23 - text_w('HARING') // 2, 21, 'HARING', Bl[2])
    L.hl(1, 30, 44, T[3])
    for wx in (9, 36):
        L.ring(wx, 31.5, 4.2, K[1], 3.0); L.ring(wx, 31.5, 3.0, Wd[3], 2.3); L.px(wx, 31.5, I[4])
    L.line(44, 24, 46, 26, I[2], t=TH)
    return L


# ---------------------------------------------------------------- elms with clustered crowns (no clipped edge)
def elm2(rng, w=104, h=136, seed=1, leaf='leaf'):
    """A quay elm in the game's box: a trunk with its forks and a crown of leaf clusters, each with its dark edge.
       The clusters keep inside the box, so no crown edge is cut straight."""
    L = Layer(w, h)
    k = w / 104.0
    ch = int(h * (0.70 if k < 1.2 else 0.64))
    tr = trunk(rng, h - ch // 2 + 4, max(8, int(round(8 * k ** 0.8))), seed=seed)
    L.blit(tr, w / 2 - tr.w / 2, h - tr.h)
    r = random.Random(seed)
    blobs = []
    i = 0
    rows = ((0.20, 2), (0.38, 3), (0.56, 4), (0.74, 4), (0.88, 2))
    if k >= 1.2:
        rows = ((0.12, 2), (0.26, 3), (0.40, 4), (0.54, 5), (0.68, 5), (0.80, 4), (0.92, 2))
    for (fy, n) in rows:
        for j in range(n):
            bw = int(r.randint(38, 50) * k ** 0.55); bh = int(bw * r.uniform(0.74, 0.84))
            span = (w - bw) * math.sqrt(max(0.15, 1 - ((fy - 0.55) / 0.62) ** 2))
            cx = w / 2 + ((j + 0.5) / n - 0.5) * span + r.uniform(-3, 3)
            cy = bh / 2 + fy * (ch - bh) + r.uniform(-2, 2)
            cx = min(max(cx, bw / 2), w - bw / 2)
            blobs.append((cy, cx, bw, bh, i)); i += 1
    blobs.sort()
    for (cy, cx, bw, bh, i) in blobs:
        C = canopy(bw, bh, R[leaf], seed * 7 + i, nb=8, rag=3.4, holes=0.09, spread=0.22)
        L.blit(C, cx - bw / 2, cy - bh / 2)
    return L


def side_wall(sec, ue, side, body, roof_h, brick, depths=(15, 18, 21, 24, 27, 30), ws=7.0):
    """The side wall of a house at the end of a row: thin strips of the wall in the planes from the front (14) to
       the back (30), so it opens with the camera. side -1: the left wall (lit by the morning sun), +1: the right."""
    B, RT, S, M = A(brick), A('roof_tile'), A('stone'), A('moss')
    s14 = s_d(14)
    for dpt in depths:
        k = round(dpt * 2) / 2
        sp = s_d(k)
        scl = sp / s14
        yb = 176 - k
        yw = yb - body * scl
        yr = yw - roof_h * scl
        u0, u1 = (ue, ue + ws) if side < 0 else (ue - ws, ue)

        def fn(u, y, k_, sp_, yb=yb, yw=yw, yr=yr, dpt=dpt):
            m = (y >= yr) & (y < yb)
            r_ = np.floor(y * DET / 2.0)
            cell = hash01(np.floor((u * sp + (r_ % 2) * 2) / 4.0 * DET), r_, int(dpt * 7))
            base = 4 if side < 0 else 2
            t = base + (cell > 0.85).astype(int) - (cell < 0.15).astype(int) - (((y * DET / 2.0) - r_) < 0.25).astype(int) * (U >= 4)
            rgb = B[np.clip(t, 0, 6)]
            rf = y < yw
            rt = (3 if side < 0 else 2) + ((np.floor(y * DET) % 2) == 0).astype(int)
            rgb[rf] = RT[np.clip(rt, 0, 6)][rf]
            rgb[(y >= yw) & (y < yw + 1)] = S[5 if side < 0 else 3]
            rgb[y >= yb - 2] = M[2]
            return rgb, m
        plane_fill(sec, k, u0, u1, yr - 1, yb + 1, fn)


# ---------------------------------------------------------------- the canal house at the scale rule (a copy of the kit's house())
# Changed from parts.house(): gf_px (the ground floor's height) and storeys (the upper storeys' heights, bottom up)
# set the storey lines exactly (a ledge or an awning of the game meets them); french: the index of the storey whose
# windows reach down to the floor (behind a balcony); at sc >= 1.4 the windows get stone lintels with a keystone,
# some get shutters or a flower box, and info['storeys'] holds the storey heights painted.
def house_a(rng, w, hb, kind='neck', brick='brick_red', trim='plaster', doorc='green', sc=1.0, shop=None,
            warehouse=False, seed=0, gf_px=None, storeys=None, french=None, cols=None):
    """One canal house, seen from the front. Returns (Layer, info). info['win']: glass boxes (for lights at night).
       cols: the window columns' left x (in place of the even spacing)."""
    B = R[brick]; T = R[trim]; G = R['glass']; S = R['stone']; I = R['iron']; D = R[doorc]
    gh = int(round(GABLE_H[kind] * (0.75 + 0.25 * sc))) + (rng.randint(-1, 2) if kind != 'cornice' else 0)
    gf_set = q_(27 * sc) if gf_px is None else int(gf_px)
    if storeys is not None:                                      # the body from the storey lines
        storeys = [int(v) for v in storeys]
        hb = gf_set + sum(storeys) + (3 if kind in ('neck', 'bell') else 2)
    H = hb + gh
    L = Layer(w, H)
    info = dict(win=[], kind=kind, w=w, h=H, gh=gh, lamp=None, hb=hb)
    cx = w / 2.0
    q = lambda v: int(math.floor(v + 0.5))
    # ---- roof behind the gable
    RT = R[rng.choice(['roof_tile', 'roof_tile', 'roof_slate'])]
    if kind in ('neck', 'bell', 'spout', 'step'):
        rh = int(gh * (0.62 if kind == 'neck' else 0.45))
        for i in sub(0, rh):
            t = (i + D1) / rh
            hw = (w / 2 - 1) * t
            y = gh - rh + i
            xl, xr = rq(cx - hw), rq(cx + hw)
            odd = int(i * DET) % 2
            L.rect(xl, y, xr - xl, D1, RT[3] if odd else RT[2])
            L.rect(xl, y, max(1, (xr - xl) // 2 if U == 1 else (xr - xl) / 2), D1, RT[4] if odd else RT[3])
            L.rect(xl, y, 1, D1, RT[5]); L.rect(xr - 1, y, 1, D1, RT[1])
        if rng.random() < 0.7:                                   # chimney
            chx = q(cx + rng.choice([-1, 1]) * w * 0.30) - 2
            chy = gh - rh // 2 - 7
            L.rect(chx, chy, 4, 8, B[2]); L.vl(chx, chy, 8, B[4]); L.hl(chx - 1, chy, 6, S[5]); L.hl(chx - 1, chy + 1, 6, S[2])
            L.vl(chx + 1, chy - 2, 2, RT[4]); L.vl(chx + 3, chy - 2, 2, RT[2])
    # ---- gable
    if kind == 'neck':
        nw = max(10, q(w * 0.46))
        if (w - nw) % 2:
            nw += 1
        nx = (w - nw) // 2
        ped = max(4, q(5 * sc))
        brickfill(L, nx, ped, nw, gh - ped, B, seed + 3)
        L.vl(nx, ped, gh - ped, B[5]); L.vl(nx + nw - 1, ped, gh - ped, B[1])
        for i in sub(0, ped):                                    # pediment
            hw = (nw / 2 + 1) * (i + D1) / ped
            xl, xr = rq(cx - hw), rq(cx + hw)
            L.rect(xl, i, xr - xl, D1, T[5]); L.rect(xl, i, min(1, xr - xl), D1, T[6]); L.rect(xr - 1, i, 1, D1, T[3])
        L.hl(nx - 1, ped, nw + 2, T[6]); L.hl(nx - 1, ped + 1, nw + 2, T[3]); L.hl(nx, ped + 2, nw, B[1])
        chh = max(4, int((gh - ped - 4) * 0.62))
        ys = gh - chh
        for dy in sub(0, chh):                                   # the sandstone claw pieces: a concave scroll
            t = min(1.0, dy / max(chh - 1, 1))
            ext = rq((nx - 1) * t ** 1.7)
            if ext <= 0:
                continue
            y = ys + dy
            e1 = min(1, ext)
            L.rect(nx - ext, y, ext, D1, T[5]); L.rect(nx - ext, y, e1, D1, T[6])
            L.rect(nx + nw, y, ext, D1, T[4]); L.rect(nx + nw + ext - e1, y, e1, D1, T[2]); L.rect(nx + nw, y, e1, D1, T[5])
        L.px(nx - 2, gh - 2, T[3]); L.px(nx + nw + 1, gh - 2, T[2])
        ly = ped + 7
        lh = max(5, q(7 * sc))
        L.rect(q(cx) - 2, ly, 4, lh, T[5]); L.rect(q(cx) - 1, ly + 1, 2, lh - 1, D[2]); L.vl(q(cx) - 1, ly + 1, lh - 1, D[3])
        info['win'].append((q(cx) - 1, ly + 1, 2, lh - 1))
        hb_y = ped + 3
    elif kind == 'bell':
        thw = 4
        for y in sub(3, gh):
            t = min(1.0, (y - 3) / max(gh - 4, 1))
            f = 0.5 - 0.5 * math.cos(math.pi * t ** 1.25)
            hw = thw + (w / 2 - thw) * f
            xl, xr = rq(cx - hw), rq(cx + hw)
            brickfill(L, xl, y, xr - xl, D1, B, seed + 3)
            L.rect(xl, y, 1, D1, T[6]); L.rect(xl + 1, y, 1, D1, T[5]); L.rect(xr - 1, y, 1, D1, T[3]); L.rect(xr - 2, y, 1, D1, T[5])
        L.hl(q(cx) - thw - 1, 2, 2 * thw + 2, T[5]); L.hl(q(cx) - 3, 1, 6, T[6]); L.hl(q(cx) - 1, 0, 2, T[6])
        L.px(q(cx) + thw, 2, T[3])
        ly = 8
        lh = max(5, q(7 * sc))
        L.rect(q(cx) - 2, ly, 4, lh, T[5]); L.rect(q(cx) - 1, ly + 1, 2, lh - 1, G[0])
        info['win'].append((q(cx) - 1, ly + 1, 2, lh - 1))
        hb_y = 5
    elif kind == 'step':
        n = max(3, gh // 5)
        sh = (gh - 3) / n
        pl, pr = None, None
        for k in range(n):
            hw = 3 + (w / 2 - 3) * (k + 1) / n
            y0, y1 = 3 + q(k * sh), 3 + q((k + 1) * sh)
            xl, xr = q(cx - hw), q(cx + hw)
            brickfill(L, xl, y0, xr - xl, y1 - y0, B, seed + 3)
            L.vl(xl, y0, y1 - y0, B[5]); L.vl(xr - 1, y0, y1 - y0, B[1])
            if pl is None:
                L.hl(xl, y0, xr - xl, T[6])
            else:
                L.hl(xl, y0, pl - xl, T[6]); L.hl(pr, y0, xr - pr, T[5])
                L.hl(xl, y0 + 1, pl - xl, B[2]); L.hl(pr, y0 + 1, xr - pr, B[1])
            pl, pr = xl, xr
        L.rect(q(cx) - 1, 0, 2, 3, T[5]); L.px(q(cx) - 1, 0, T[6])
        ly = 3 + q(sh) + 2
        lh = max(5, q(6 * sc))
        L.rect(q(cx) - 2, ly, 4, lh, T[5]); L.rect(q(cx) - 1, ly + 1, 2, lh - 1, G[0])
        info['win'].append((q(cx) - 1, ly + 1, 2, lh - 1))
        hb_y = ly - 3
    elif kind == 'spout':
        sp, sw = 5, 6
        for y in sub(sp, gh):
            t = min(1.0, (y - sp) / max(gh - 1 - sp, 1))
            hw = sw / 2 + (w / 2 - sw / 2) * t
            xl, xr = rq(cx - hw), rq(cx + hw)
            brickfill(L, xl, y, xr - xl, D1, B, seed + 3)
            L.rect(xl, y, 1, D1, T[6]); L.rect(xr - 1, y, 1, D1, T[3])
        brickfill(L, q(cx) - 3, 1, 6, sp, B, seed + 4)
        L.hl(q(cx) - 4, 0, 8, T[6]); L.hl(q(cx) - 4, 1, 8, T[3])
        hb_y = sp + 2
    else:                                                        # cornice front with a hipped roof and a dormer
        rh = gh - 5
        for i in sub(0, rh):
            ins = rq(max(0.0, rh - 1 - i) * 1.3) + 2
            odd = int(i * DET) % 2
            L.rect(ins, i, w - 2 * ins, D1, RT[3] if odd else RT[2])
            L.rect(ins, i, (w - 2 * ins) // 2 if U == 1 else (w - 2 * ins) / 2, D1, RT[4] if odd else RT[3]); L.rect(ins, i, 1, D1, RT[5])
        dw = max(7, q(8 * sc))
        dx = q(cx) - dw // 2
        L.rect(dx, -0 + 0, dw, rh, T[5]); L.hl(dx - 1, 0, dw + 2, T[6]); L.vl(dx + dw - 1, 1, rh - 1, T[3])
        L.rect(dx + 2, 2, dw - 4, rh - 3, G[0]); info['win'].append((dx + 2, 2, dw - 4, rh - 3))
        L.hl(-1, rh, w + 2, T[6]); L.hl(0, rh + 1, w, T[5]); L.hl(0, rh + 2, w, T[4])
        for i in range(1, w - 1, 2):
            L.px(i, rh + 3, T[5]); L.px(i + 1, rh + 3, T[2])
        L.hl(0, rh + 4, w, T[3])
        hb_y = None
    # ---- body
    brickfill(L, 0, gh, w, hb, B, seed, streaks=True)
    L.vl(0, gh, hb, B[5]); L.vl(w - 1, gh, hb, B[1]); L.vl(w - 2, gh, hb, B[2])
    if kind in ('neck', 'bell'):
        L.hl(0, gh, w, T[6]); L.hl(0, gh + 1, w, T[4]); L.hl(0, gh + 2, w, B[1])
    elif kind == 'cornice':
        L.hl(0, gh, w, B[1]); L.hl(0, gh + 1, w, B[2])
    # hoist beam with its hook
    if hb_y is not None:
        bx = q(cx) - 1
        L.rect(bx, hb_y, 3, 2, I[1]); L.hl(bx, hb_y, 3, I[3]); L.vl(bx + 1, hb_y + 2, 2, I[0]); L.px(bx + 2, hb_y + 4, I[0])
    # ---- floors
    ww = max(4, q(7 * sc)); m = max(2, q(3.4 * sc))
    ncol = 2 if w < 30 * sc else (3 if w < 46 * sc else 4)
    gap = (w - 2 * m - ncol * ww) / max(ncol - 1, 1)
    xs = [m + q(i * (ww + gap)) for i in range(ncol)]
    if cols is not None:
        xs = [int(c) for c in cols]; ncol = len(xs)
    gf = gf_set
    st = q(6 * sc)                                               # the raised ground floor
    yb = gh + hb
    top = gh + (3 if kind in ('neck', 'bell') else 2)
    avail = yb - gf - top
    floors = []
    y = yb - gf
    if storeys is not None:
        for fh in storeys:
            floors.append((y - fh, y))
            y -= fh
    else:
        nf = max(1, q(avail / (20.0 * sc)))
        wts = [1.18 - 0.11 * i for i in range(nf)]               # lower floors are taller
        tot = sum(wts)
        for i in range(nf):
            fh = avail * wts[i] / tot
            floors.append((q(y - fh), q(y)))
            y -= fh
    info['storeys'] = [y1 - y0 for (y0, y1) in floors]
    info['gf'] = gf
    big = sc >= 1.4
    lstyle = random.Random(seed * 3 + 1).choice(['key', 'key', 'arch', 'plain'])
    for fi, (y0, y1) in enumerate(floors):
        fh = y1 - y0
        wh = max(4, fh - max(4, q(6.5 * sc)))
        wy = y0 + (fh - wh) // 2
        if french is not None and fi == french:                  # the windows reach the floor (a balcony before them)
            wy = y0 + max(3, q(3 * sc)); wh = y1 - 1 - wy
        if kind == 'step':
            L.hl(1, y0, w - 2, T[5]); L.hl(1, y0 + 1, w - 2, B[2])     # white stone bands
        if big and kind != 'step' and fi == 0:                   # a string course over the ground floor
            L.hl(0, y1 - 1, w, T[5]); L.hl(0, y1, w, T[3]); L.hl(0, y1 + 1, w, B[1])
        for i, x in enumerate(xs):
            if warehouse:
                if i == ncol // 2 or ncol == 2 and i == 0:
                    b = shutter_window(L, x, wy, ww, wh + 1, B, D, G, rng, open_=rng.random() < 0.8)
                else:
                    b = window(L, x, wy + 1, ww, max(4, wh - 2), T, G, rng, B, kind='dark' if rng.random() < .5 else None)
            else:
                b = window(L, x, wy, ww, wh, T, G, rng, B)
                if big:
                    big_window_extras(L, x, wy, ww, wh, B, T, lstyle, seed + fi * 13 + i, fi)
                elif rng.random() < 0.10 and sc >= 0.9:               # a window box with flowers
                    fc = R[rng.choice(['red', 'red', 'yellow', 'white'])]
                    L.hl(x, wy + wh - 1, ww, R['leaf'][2])
                    for xx in range(x, x + ww, 2):
                        L.px(xx + rng.randint(0, 1), wy + wh - 2, fc[4]); L.px(xx, wy + wh - 1, R['leaf'][4])
            info['win'].append(b)
        # wall anchors
        if fi > 0 and sc >= 0.9:
            for ax in (2, w - 3):
                L.vl(ax, y1 - 1, 2, I[1])
    # ---- ground floor
    y0 = yb - gf
    yf = yb - st
    L.rect(0, yf, w, st, S[2] if not warehouse else B[2]); L.hl(0, yf, w, S[5] if not warehouse else B[4])
    L.hl(0, yb - 1, w, S[1] if not warehouse else B[1])
    L.vl(0, yf, st, S[4] if not warehouse else B[4])
    di = rng.choice([0, ncol - 1]) if not shop else ncol - 1
    dw = ww + 1
    dh = gf - st - max(3, q(4 * sc))
    for i, x in enumerate(xs):
        if shop and i < ncol - 1:
            continue
        if i == di:
            dx = min(max(x, 1), w - dw - 1)
            dy = yf - dh
            L.rect(dx - 1, dy - 1, dw + 2, dh + 1, T[5]); L.vl(dx - 1, dy - 1, dh + 1, T[6]); L.vl(dx + dw, dy, dh, T[3])
            L.rect(dx, dy, dw, dh, D[2])
            fl = max(2, q(3 * sc))                                 # fanlight
            L.rect(dx, dy, dw, fl, G[1]); L.hl(dx, dy + fl, dw, T[5]); L.px(dx + dw // 2, dy + fl - 1, T[5]); L.px(dx + 1, dy, G[3])
            L.vl(dx, dy + fl + 1, dh - fl - 1, D[4]); L.vl(dx + dw - 1, dy + fl + 1, dh - fl - 1, D[1])
            if dw >= 6:
                L.rect(dx + 2, dy + fl + 2, dw - 4, max(1, (dh - fl) // 2 - 2), D[1])
                L.hl(dx + 2, dy + fl + 2, dw - 4, D[0])
                L.rect(dx + 2, dy + fl + (dh - fl) // 2 + 2, dw - 4, max(1, (dh - fl) // 2 - 3), D[1])
            L.px(dx + dw - 2, dy + fl + (dh - fl) // 2, R['yellow'][5])
            info['door'] = (dx, dy, dw, dh)
            # stoop: slab, steps to the side, iron rail
            side = 1 if dx < w / 2 else -1
            L.hl(dx - 1, yf, dw + 2, S[6]); L.hl(dx - 1, yf + 1, dw + 2, S[3])
            ns = max(2, st // 2)
            for k in range(ns):
                sx = dx + (dw + 1 + k * 2 if side > 0 else -3 - k * 2)
                sy = yf + q((k + 1) * st / (ns + 1))
                L.rect(sx, sy, 2, yb - sy, S[4]); L.hl(sx, sy, 2, S[6]); L.vl(sx + (1 if side > 0 else 0), sy + 1, yb - sy - 1, S[2])
            ex = dx + (dw + ns * 2 + 1 if side > 0 else -2 - ns * 2)
            L.line(dx + (dw if side > 0 else -1), yf - q(4 * sc), ex, yb - q(4 * sc) - 1, I[1], t=TH)
            L.vl(ex, yb - q(4 * sc) - 1, q(4 * sc), I[1]); L.vl(dx + (dw if side > 0 else -1), yf - q(4 * sc), q(4 * sc), I[2])
            if sc >= 0.9:
                info['lamp'] = (dx + (dw + 2 if side > 0 else -3), dy + 2)
        else:
            wh = gf - st - max(6, q(8 * sc))
            wy = yf - wh - max(2, q(2 * sc))
            b = window(L, x, wy, ww, wh, T, G, rng, B)
            info['win'].append(b)
            bw = max(3, ww - 2)                                    # basement window
            L.rect(x + 1, yf + 2, bw, max(2, st - 3), G[0]); L.hl(x + 1, yf + 1, bw, S[5]); L.px(x + 1, yf + 2, G[2])
    if shop:
        sw = xs[ncol - 1] - 2 - m
        sy = yb - gf + q(8 * sc)
        shh = yf - sy + (st - 2)
        L.rect(m, sy, sw, shh, T[5]); L.rect(m + 1, sy + 1, sw - 2, shh - 3, G[1])
        L.rect(m + 1, sy + 1, sw - 2, 2, G[0])
        for xx in range(m + 2, m + sw - 2, 3):                     # goods in the window
            L.px(xx, sy + shh - 4, R[rng.choice(['yellow', 'red', 'white', 'wood'])][4])
            L.px(xx + 1, sy + shh - 4, R[rng.choice(['yellow', 'red', 'wood'])][3])
        L.vl(m + sw // 2, sy + 1, shh - 3, T[5])
        L.hl(m, sy + shh - 2, sw, S[4]); L.hl(m, sy + shh - 1, sw, S[2])
        AW = R[shop[1]]
        ah = max(4, q(5 * sc))
        for j in range(ah):                                        # striped awning
            for xx in range(m - 1, m + sw + 1):
                c = AW[4 if j < ah - 1 else 3] if ((xx - j // 2) // 2) % 2 == 0 else R['white'][5 if j < ah - 1 else 4]
                L.px(xx, sy - 2 + j, c)
        L.hl(m - 1, sy - 2 + ah, sw + 2, G[0])
        tw = text_w(shop[0])
        ty = sy - 2 - 8
        if tw + 4 <= w - 2 and ty > y0 - 2:
            L.rect(q(cx) - tw // 2 - 2, ty, tw + 4, 7, D[1]); L.hl(q(cx) - tw // 2 - 2, ty, tw + 4, D[3])
            text(L, q(cx) - tw // 2, ty + 1, shop[0], R['yellow'][5])
            info['sign'] = (q(cx) - tw // 2, ty + 1, shop[0])
        info['shop'] = (m, sy, sw, shh)
        info['word'] = shop[0]
    # grime under the cornice and at the plinth, drainpipe
    if rng.random() < 0.55:
        px = w - 3 if rng.random() < 0.5 else 1
        L.vl(px, gh + 2, yb - gh - 3, I[2]); L.px(px, gh + 2, I[4])
        for yy in range(gh + 8, yb - 4, 14):
            L.px(px, yy, I[4])
    # ivy on some fronts
    if rng.random() < 0.16 and not warehouse and sc >= 0.9:
        LF = R['leaf']
        x0 = 0 if rng.random() < 0.5 else w - 9
        xx, yy = grid(x0, yb - gf - 16, 9, gf + 12)
        n = fbm(xx / 3.0, yy / 4.0, seed + 9, 2) + (yy - (yb - gf - 16)) / (gf + 12) * 0.35
        msk = n > 0.72
        tn = np.clip((fbm(xx / 1.7, yy / 1.7, seed + 11, 1) * 4).astype(int) + 1, 1, 4)
        cur = L.view(x0, yb - gf - 16, 9, gf + 12)[..., 3] > 0
        if cur.shape == msk.shape:
            L.put(x0, yb - gf - 16, np.array(LF, np.uint8)[tn], msk & cur)
    return L, info



def big_window_extras(L, x, y, w, h, B, T, style, seed, fi):
    """More detail per storey on a large front: a lintel (stone with a keystone, or a brick relieving arch), now and
       then a flower box or a small iron rail at the sill."""
    r = random.Random(seed)
    S = R['stone']; I = R['iron']
    if style == 'key':
        L.rect(x - 1, y - 3, w + 2, 2, S[4]); L.hl(x - 1, y - 3, w + 2, S[5]); L.hl(x - 1, y - 1, w + 2, B[1])
        kx = x + w // 2 - 1
        L.rect(kx, y - 4, 3, 3, S[4]); L.px(kx, y - 4, S[5]); L.px(kx + 2, y - 2, S[3])
    elif style == 'arch':
        for i in sub(0, w + 2):
            t = (i - (w + 2) / 2.0) / ((w + 2) / 2.0)
            yy = y - 2 - 1.6 * (1 - t * t)
            L.rect(x - 1 + i, yy, D1, 2, B[5] if int(i * DET) % 2 else B[4])
        L.hl(x - 1, y - 1, w + 2, B[1])
    k = r.random()
    if k < 0.22:                                                   # a flower box
        fc = R[r.choice(['red', 'red', 'yellow', 'white', 'rose' if 'rose' in R else 'red'])]
        L.rect(x, y + h - 3, w, 3, R['wood'][3]); L.hl(x, y + h - 3, w, R['wood'][5])
        for xx in range(x, x + w, 2):
            L.px(xx, y + h - 4, R['leaf'][3]); L.px(xx + r.randint(0, 1), y + h - 5, fc[4] if r.random() < 0.7 else R['leaf'][4])
            if r.random() < 0.4:
                L.px(xx + 1, y + h - 6, fc[5])
    elif k < 0.30 and fi == 0:                                    # a small iron rail at the sill
        L.hl(x, y + h - 5, w, I[2]); L.hl(x, y + h - 1, w, I[1])
        for xx in range(x, x + w, 2):
            L.vl(xx, y + h - 5, 4, I[1], t=TH)


# ---------------------------------------------------------------- the far bank at the scale rule (copies of the kit's
# house_row, far_bank (no side canal), canal_far, far_roofs and skyline_layer, with the sizes of SCALE-BRIEF.md)
def scale_px(m, s):
    """Metres -> screen px on a plane of speed s (13 px per metre at speed 1)."""
    return 13.0 * m * s


def house_row_a(L, x0, x1, yb, rng, sc=1.0, wmin=30, wmax=46, nst=(2, 3, 3, 3, 4), storey=20.0, kinds=None,
                shops=0.16, seed=100, shop_list=None):
    """A row of canal houses from x0 to x1 with their feet on yb; each has n upper storeys of about `storey` px."""
    kinds = kinds or ['neck', 'neck', 'bell', 'bell', 'step', 'spout', 'cornice', 'cornice']
    infos = []
    x = x0
    last = None
    i = 0
    while x < x1:
        w = rng.randint(wmin, wmax)
        if x1 - (x + w) < wmin * 0.6:
            w = x1 - x
        kind = rng.choice(kinds)
        brick = rng.choice([b for b in BRICKS if b != last])
        last = brick
        n = rng.choice(nst)
        sts = [q_(storey * (1.06 - 0.04 * j) * rng.uniform(0.95, 1.05)) for j in range(n)]
        shop = rng.choice(shop_list or SHOPS) if (rng.random() < shops and w >= 36 * sc) else None
        H, info = house_a(rng, w, 0, kind, brick, trim='plaster' if rng.random() < 0.8 else 'stone',
                          doorc=rng.choice(['green', 'green', 'black', 'red', 'blue']), sc=sc, shop=shop,
                          seed=seed + i * 7, storeys=sts)
        L.blit(H, x, yb - H.h)
        info['x'] = x; info['y'] = yb - H.h
        info['win'] = [(x + a, yb - H.h + b, c, d) for (a, b, c, d) in info['win']]
        if info.get('lamp'):
            info['lamp'] = (x + info['lamp'][0], yb - H.h + info['lamp'][1])
        infos.append(info)
        x += w
        i += 1
    return infos


def car_far_a(rng, c=None):
    """A parked car at the far bank: 4.3 x 1.5 m at speed 0.5 (28 x 10 px); vans a little longer."""
    C = R[c or rng.choice(['red', 'blue', 'white', 'black', 'iron', 'green', 'yellow', 'white'])]
    G = R['glass']; K = R['black']
    van = rng.random() < 0.2
    w = 31 if van else rng.randint(26, 29)
    L = Layer(w, 12)
    if van:
        L.rect(0, 1, w - 7, 9, C[4]); L.rect(w - 7, 4, 7, 6, C[4]); L.rect(w - 8, 2, 5, 3, G[2]); L.hl(0, 1, w - 7, C[6])
        L.hl(0, 9, w, C[2]); L.vl(0, 1, 9, C[5]); L.px(w - 1, 7, R['yellow'][6])
        L.vl(w - 12, 3, 6, C[2], t=TH); L.vl(10, 3, 6, C[3], t=TH)
    else:
        L.rect(0, 5, w, 5, C[4])
        L.rect(5, 2, w - 12, 3, C[4]); L.rect(4, 3, 1, 2, C[4]); L.rect(w - 7, 3, 1, 2, C[3])
        L.hl(6, 1.5, w - 14, C[6], t=0.5 if U > 1 else 1); L.hl(5, 2, w - 12, C[5]); L.hl(0, 5, w, C[5]); L.hl(0, 9, w, C[2])
        L.rect(6, 3, (w - 14) // 2, 2, G[2]); L.rect(7 + (w - 14) // 2, 3, (w - 14) // 2, 2, G[1]); L.px(6, 3, G[4])
        L.vl(w // 2, 5, 4, C[3], t=TH)
        L.px(0, 6, R['red'][5]); L.px(w - 1, 6, R['yellow'][6])
    for wx in (4, w - 8):
        if U == 1:
            L.rect(wx, 8, 4, 3, K[1]); L.px(wx, 8, C[2]); L.px(wx + 3, 8, C[2]); L.px(wx + 1, 9, K[4]); L.px(wx + 2, 9, K[3])
        else:
            L.ellipse(wx + 2, 9.3, 2.4, 2.1, C[1]); L.ellipse(wx + 2, 9.5, 2.0, 1.8, K[1]); L.ellipse(wx + 2, 9.5, 0.8, 0.7, K[4])
    L.hl(1, 11, w - 2, K[0])
    return L


FAR_TREE = dict(cw=(62, 74), ch=(56, 64), th=(36, 42), step=(190, 260), tw=4)       # 14-16 m at speed 0.5


def far_bank_a(F, rng, YH, YQ, YW, house, trees, AIR, boats=(), cars=0.5, lamp_step=96, seed=100, bikes=0.55):
    """The far bank in one layer at the scale rule (no side canal): house row, street, trees, parked cars, lamps,
       quay wall, boats. A copy of sets.far_bank with the sizes of SCALE-BRIEF.md."""
    WF = F.w
    out = dict(win=[], lamps=[], boatwin=[])
    infos = house_row_a(F, 0, WF, YH, rng, seed=seed, **house)
    for i in infos:
        out['win'] += i['win']
    tl = []
    x = trees.get('x0', 30)
    while x < WF - 20:
        t = tree_far(rng, rng.randint(*trees['cw']), rng.randint(*trees['ch']), rng.randint(*trees['th']),
                     leaf=trees.get('leaf', 'leaf'), seed=rng.randint(1, 999), tw=trees['tw'])
        tl.append((x - t.w // 2, YQ - t.h, t))
        x += rng.randint(*trees['step'])
    for (tx, ty, t) in tl:                                         # the trees' shade on the fronts
        m = np.zeros((F.ph, F.pw), bool)
        cm = t.mask()
        yy0, xx0 = PX(ty + 14), PX(tx + 12)
        h_, w_ = cm.shape
        x1_ = min(F.pw, xx0 + w_); y1_ = min(PX(YH), yy0 + h_)
        if x1_ > max(0, xx0) and y1_ > yy0:
            m[yy0:y1_, max(0, xx0):x1_] = cm[:y1_ - yy0, max(0, -xx0):x1_ - xx0]
        shade(F, m)
    far_street(F, 0, WF, YH, YQ, rng, 1)
    for i in infos:
        if rng.random() < bikes:
            F.blit(bike_far(rng), i['x'] + rng.randint(2, max(3, i['w'] - 14)), YH - 5)
    x = 8
    while x < WF - 20:
        k = rng.random()
        if k < cars:
            c = car_far_a(rng); F.blit(c, x, YQ - c.h + 1); x += c.w + rng.randint(4, 14)
        elif k < cars + 0.25:
            for j in range(rng.randint(1, 4)):
                F.blit(bike_far(rng), x, YQ - 7); x += 9
            x += 4
        else:
            x += rng.randint(6, 16)
    for lx in range(22, WF, lamp_step):
        F.blit(lamp_far(30), lx, YQ - 29)
        out['lamps'].append((lx + 2, YQ - 26))
    for (tx, ty, t) in tl:
        F.blit(t, tx, ty)
    bollards_far(F, 0, WF, YQ + 1, rng)
    quay_wall(F, 0, YQ, WF, YW - YQ, rng, 7)
    for (kind, bx, arg) in boats:
        if kind == 'house':
            b, wins = houseboat(rng, arg[0], arg[1]); by = YW - b.h + 2
        elif kind == 'barge':
            b, wins = barge(rng, arg[0], arg[1] if len(arg) > 1 else None); by = YW - b.h + 3
        elif kind == 'tour':
            b, wins = tourboat(rng, arg[0]), []; by = YW - b.h + 2
        else:
            b, wins = sloop(rng, arg[0], arg[1]), []; by = YW - 7
        F.blit(b, bx, by)
        out['boatwin'] += [(bx + a, by + c, d, e) for (a, c, d, e) in wins]
    F.clear(0, YW + 1, F.w, F.h)
    out['trees'] = tl
    out['infos'] = infos
    return out


def canal_far_a(sec, rng, YH=110, YQ=115, YW=120, speed=0.5, house=None, boats=(), trees=None, air=0.25, seed=100):
    """level.canal_far with far_bank_a (the scale rule)."""
    WF = sec.lw(speed)
    F = Layer(WF, VIEW_H)
    fb = far_bank_a(F, rng, YH, YQ, YW, house=dict(house or {}), trees=dict(trees or FAR_TREE), AIR=sec.AIR,
                    boats=list(boats), seed=seed)
    F.recolor(grader(key=sec.KEY, air=(sec.AIR[0], sec.AIR[1], air, 0.30)))
    F.clear(0, YW + 1, F.w, F.h)
    sec.add('far', F, speed)
    return F, fb


def far_roofs_a(L, x0, x1, yb, rng, s=0.10, seed=9):
    """The skyline band at the scale rule: fronts 6-9 px wide, a ground floor of 5 and 3-4 storeys of 4 px."""
    x = x0
    st = 40 * s
    while x < x1:
        w = rng.randint(6, 9); h = q_(1.35 * st + rng.choice((3, 4, 4)) * st)
        B = R[rng.choice(BRICKS)]
        L.rect(x, yb - h, w, h, B[3]); L.vl(x, yb - h, h, B[4]); L.vl(x + w - 1, yb - h, h, B[2])
        k = rng.choice(['tri', 'step', 'flat'])
        if k == 'tri':
            for i in sub(0, w // 2):
                L.rect(x + w // 2 - i, yb - h - (w // 2 - i), 2 * i + (w % 2), D1, B[3]); L.rect(x + w // 2 - i, yb - h - (w // 2 - i), 1, D1, R['plaster'][5])
        elif k == 'step':
            L.rect(x + 1, yb - h - 2, w - 2, 2, B[3]); L.rect(x + 2, yb - h - 4, max(1, w - 4), 2, B[3]); L.hl(x + 1, yb - h - 2, w - 2, R['plaster'][5])
        else:
            L.hl(x, yb - h, w, R['plaster'][5]); L.rect(x + 1, yb - h - 2, w - 2, 2, R['roof_slate'][3])
        for wy in range(int(yb - h + 3), int(yb - 3), 4):
            for wx in range(x + 2, x + w - 1, 3):
                L.vl(wx, wy, 1, R['glass'][1])
        x += w


def skyline_layer_a(sec, speed=0.10, yb=112, extra=None, seed=5, air=0.72):
    """level.skyline_layer with far_roofs_a."""
    W1 = sec.lw(speed)
    SK = Layer(W1, VIEW_H)
    far_roofs_a(SK, 0, W1, yb, random.Random(seed), s=speed)
    if extra:
        extra(SK)
    SK.recolor(grader(key=sec.KEY, air=(sec.AIR[0], sec.AIR[1], air, 0.5)))
    sec.add('skyline', SK, speed)
    return SK
