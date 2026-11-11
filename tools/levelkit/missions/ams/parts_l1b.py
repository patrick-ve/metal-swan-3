# Parts of section b of level 1 (MUSEUMPLEIN, noon) in the canal look: the Rijksmuseum front with its cycle passage
# (an own impression), the passage roof and its piers in true depth (slices), the hot-dog trailer, the tulip stall, the
# herring cart, a grey street lamp, the electrical cabinet, the low lawn chains, the canal-house fronts of the game's
# house boxes, a far tram, the far lawn rows, the pool skin and the section's floor additions.
# Daylight colours, ramps only; the section file grades them.
import math
import random
import numpy as np
from parts_ams import *
from parts4 import arch_win, bands, rows_fill, slate, tree_band, bench_far, flag_far, mirror, tint
from parts import BRICKS
import street_b as SB

q = q_
T1 = 1 if U == 1 else 0.5

PINK = ramp(7, .30, .84, .060, .130, .090, 340, 20)
ZINC = ramp(7, .30, .88, .010, .014, .018, 250, 210)
CHAIN = ((27, 69, 41), (10, 36, 39))           # the game's lawn-chain colours (link, shade)


def s5(c):
    return tuple(int(v) for v in snap5(np.array(c, float)))


def big_text(L, x, y, t, c, s=2, edge=None):
    """The kit's 3 x 5 font at s logical px per font px; edge: a one-px rim around every letter."""
    if edge is not None:
        for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, -1), (-1, 1), (1, 1)):
            big_text(L, x + dx, y + dy, t, edge, s)
    for ch in t:
        g = FONT[ch]
        for j, row in enumerate(g):
            for i, v in enumerate(row):
                if v == '1':
                    L.rect(x + i * s, y + j * s, s, s, c)
        x += (len(g[0]) + 1) * s


# ---------------------------------------------------------------- the scale of the scenery (SCALE-BRIEF.md, 2026-11-11)
# Buildings, trees, lamps, far cars, bikes and trams are 13 px per metre x the speed s of their plane (a storey is
# 40 s px). The painters below take their sizes from these numbers; PAINTED keeps what they used, for the checks.
PXM = 13.0
S14 = s_d(14)                                    # the facade plane of the game's house boxes and the museum front
PAINTED = {}


def m_px(m, s):
    """Metres to px on a plane of speed s."""
    return m * PXM * s


# ---------------------------------------------------------------- the Rijksmuseum front (decor box 482 wide, anchor 241)
P0, P1 = 81, 400            # the passage mouths in the art (px from the left): world 400 and 719 at the anchor 560
CEIL = 81                   # the passage ceiling over the ground (the art's row 95; the vault bottom at world y 96)
# The front at its own scale (s = 0.88: a storey 35 px). Heights in px above the ground. The passage (gameplay) fills
# the ground floor and the mezzanine; over it the tall main floor, the frieze, the upper floor, the cornice and the
# roof. The screen shows the lower 162 px (to the frieze); the rest stands above the top edge.
FR = dict(gf=48, mezz=CEIL, main=150, frieze=164, upper=200, cornice=210,
          ridge=int(round(m_px(30, S14))), tower=int(round(m_px(60, S14))))
TL, TR = (44, 118), (363, 437)          # the two towers, each over a passage mouth (6.5 m wide)
MAIN_W, MAIN_H, MAIN_Y = 13, 52, 94     # the main-floor windows: 14 s wide, 1.5 storeys tall


def rijks_front(seed=31):
    """The museum front at the facade's depth, at the scenery scale: red-brown brick with cream stone bands, the
       rusticated ground floor, the mezzanine, the tall arched windows of the main floor between banded pilasters, a
       tile tableau over the passage, two banners, the tile frieze at the top edge; the two towers over the passage
       mouths (quoins, balconies, paired windows); the passage's far wall (the vault in deep shade, niches with lamps,
       the tiled dado) between the mouths."""
    B = R['brick_red']; S = R['stone']; G = R['glass']; Y = R['yellow']; I = R['iron']
    Bl = R['blue']; O = R['brick_ochre']; Rd = R['red']; K = R['black']
    W, H = 482, 176
    L = Layer(W, H)
    hy = lambda h: H - h
    rng = random.Random(seed)

    # ---- the wall and its courses
    brickfill(L, 0, 0, W, H, B, seed, streaks=True, lo=2, hi=4)
    for yy in range(8, 46, 6):                                                # the banded (rusticated) ground floor
        L.hl(0, hy(yy), W, S[5], t=TH * 1.5 if U > 1 else 1)
    L.rect(0, hy(5), W, 5, S[3]); L.hl(0, hy(5), W, S[5]); L.hl(0, H - 1, W, S[1])     # plinth
    L.rect(0, hy(FR['gf'] + 2), W, 3, S[6]); L.hl(0, hy(FR['gf'] - 1), W, S[3])       # string course over the ground floor
    for yy in range(FR['gf'] + 8, CEIL - 2, 7):                               # the mezzanine: thin stone bands
        L.hl(0, hy(yy), W, S[5], t=TH)
    L.rect(0, hy(CEIL + 3), W, 3, S[6]); L.hl(0, hy(CEIL), W, S[3])           # the course at the passage ceiling
    L.rect(0, hy(MAIN_Y - 2), W, 3, S[5]); L.hl(0, hy(MAIN_Y - 2), W, S[6]); L.hl(0, hy(MAIN_Y - 5), W, B[1])  # sill course
    for yy in range(MAIN_Y + 5, FR['main'] - 2, 7):                           # the main floor: stone bands in the brick
        L.hl(0, hy(yy), W, S[5], t=TH)
    # the frieze of tile pictures between two stone courses (the top edge of the screen cuts it)
    fh = FR['frieze'] - FR['main']
    xx, yy = grid(0, hy(FR['frieze']), W, fh)
    hh = hs(np.floor(xx / 2.0), np.floor(yy / 2.0), seed + 5)
    rgb = np.array(O, np.uint8)[np.full(xx.shape, 5) - (hh > 0.70)]
    hb = hs(np.floor(xx / 4.0), np.floor(yy / 4.0), seed + 6)
    rgb[hb < 0.12] = Bl[4]; rgb[(hb > 0.12) & (hb < 0.18)] = Rd[4]; rgb[(hb > 0.18) & (hb < 0.22)] = R['green'][4]
    rgb[hh > 0.96] = R['plaster'][6]
    rgb[np.floor(xx) % 30 < 4] = B[3]                                         # brick piers between the pictures
    L.put(0, hy(FR['frieze']), rgb, np.ones(xx.shape, bool))
    L.rect(0, hy(FR['main'] + 2), W, 3, S[6]); L.hl(0, hy(FR['main'] - 1), W, S[3])
    L.hl(0, hy(FR['frieze'] + 1), W, S[5])

    # ---- the parts of the main floor
    def main_win(cx, w=MAIN_W, h=MAIN_H, glint=None):
        x = cx - w / 2.0
        L.rect(x - 2, hy(MAIN_Y + h + 2), w + 4, h + 2, S[5])                # the stone surround
        L.vl(x - 2, hy(MAIN_Y + h + 2), h + 2, S[6]); L.vl(x + w + 1, hy(MAIN_Y + h + 2), h + 2, S[3])
        arch_win(L, x, hy(MAIN_Y + h), w, h, S, G, glint=rng.random() < 0.35 if glint is None else glint)
        L.rect(cx - 1.5, hy(MAIN_Y + h + 3), 3, 4, S[6]); L.vl(cx + 0.5, hy(MAIN_Y + h + 3), 4, S[3], t=TH)   # keystone
        L.rect(x - 3, hy(MAIN_Y + 1), w + 6, 2, S[6]); L.hl(x - 3, hy(MAIN_Y - 1), w + 6, B[1])               # sill
        for sx in (x - 5, x + w + 3):                                          # small tile diamonds in the spandrels
            L.rect(sx, hy(MAIN_Y + h - 4), 2, 2, Bl[4]); L.px(sx + 0.5, hy(MAIN_Y + h - 4.5), O[5])

    def pilaster(cx, y0=MAIN_Y - 2, y1=FR['main'], w=5):
        L.rect(cx - w / 2.0, hy(y1), w, y1 - y0, B[4]); L.vl(cx - w / 2.0, hy(y1), y1 - y0, B[5])
        L.vl(cx + w / 2.0 - 1, hy(y1), y1 - y0, B[2])
        bands(L, cx - w / 2.0, hy(y1) + 2, w, y1 - y0 - 4, S, 4, 1)
        L.rect(cx - w / 2.0 - 1, hy(y1), w + 2, 3, S[6]); L.hl(cx - w / 2.0 - 1, hy(y1 - 3), w + 2, S[3])   # capital
        L.rect(cx - w / 2.0 - 1, hy(y0 + 4), w + 2, 4, S[5]); L.hl(cx - w / 2.0 - 1, hy(y0 + 4), w + 2, S[6])  # base

    def mezz_win(cx, w=12, h=16, y0=56):
        x = cx - w / 2.0
        L.rect(x - 1.5, hy(y0 + h + 1.5), w + 3, h + 3, S[5]); L.hl(x - 1.5, hy(y0 + h + 1.5), w + 3, S[6])
        L.rect(x, hy(y0 + h), w, h, G[1]); L.hl(x, hy(y0 + h), w, G[0])
        L.vl(cx - 0.5, hy(y0 + h), h, S[4], t=TH); L.hl(x, hy(y0 + h * 0.55), w, S[4], t=TH)
        if rng.random() < 0.5:
            L.line(x + w - 1.5, hy(y0 + h) + 1, x + 1, hy(y0) - 2, G[3], t=TH)
        L.rect(cx - 1.5, hy(y0 + h + 2.5), 3, 2.5, S[6])

    def ground_win(cx):
        arch_win(L, cx - 6, hy(42), 12, 32, S, G, glint=rng.random() < 0.5)
        L.rect(cx - 7, hy(10), 14, 2, S[6]); L.hl(cx - 7, hy(9), 14, S[3])

    # ---- the wings at both ends (beyond the towers)
    for cx in (22, 460):
        ground_win(cx); mezz_win(cx); main_win(cx)
    for cx in (3, 41, 440, 479):
        pilaster(cx)
    # ---- the centre block over the passage: six bays, the tile tableau in the middle, two banners
    for cx in (135, 168, 198.5, 283.5, 314, 346.5):
        main_win(cx)
    for cx in (152, 184.5, 213.5, 268.5, 298.5, 330):
        pilaster(cx)
    tx0, tw_, ty0, th_ = 218, 46, MAIN_Y + 2, 48                              # the tile tableau: a ship under sail
    xx, yy = grid(tx0, hy(ty0 + th_), tw_, th_)
    u_, v_ = xx - tx0, (H - yy) - ty0                                         # in the tableau: u right, v up
    hh = hs(np.floor(xx / 3.0), np.floor(yy / 3.0), seed + 19)
    rgb = np.array(R['white'], np.uint8)[np.where(hh > 0.5, 6, 5)]            # the white glaze of the sky
    cloud = (fbm(u_ / 9.0, v_ / 4.0, seed + 31, 2) > 0.62) & (v_ > 30)
    rgb[cloud] = Bl[5]
    sea = v_ < 16
    wave = (np.floor(v_) % 3 == 1) & (np.sin(u_ * 0.55 + np.floor(v_) * 2.1) > 0.2)
    rgb[sea] = np.array(Bl, np.uint8)[np.where(wave, 4, 3)][sea]
    rgb[(v_ >= 15) & (v_ < 16.5)] = Bl[2]                                     # the horizon
    rgb[(v_ >= 16) & (v_ < 19) & (u_ < 12)] = Bl[3]                           # a far shore at the left
    hull = (v_ >= 13) & (v_ < 19) & (np.abs(u_ - 23) < 16 - (19 - v_) * 0.9)
    rgb[hull] = Bl[1]; rgb[hull & (v_ >= 18)] = O[3]
    for (mx_, top_) in ((18, 44), (28, 46)):                                  # masts and sails
        rgb[(np.abs(u_ - mx_) < 0.6) & (v_ >= 19) & (v_ < top_)] = Bl[1]
        sail = (v_ >= 22) & (v_ < top_ - 3) & (u_ > mx_ - 6 + (v_ - 22) * 0.12) & (u_ < mx_ + 6 - (v_ - 22) * 0.12)
        rgb[sail] = np.array(R['white'], np.uint8)[np.where(u_ < mx_, 4, 6)][sail]
        rgb[(np.abs(v_ - (top_ - 1)) < 0.6) & (np.abs(u_ - mx_ - 2) < 2)] = Rd[4]   # a pennant
    rgb[(np.floor(xx) - tx0) % 6 == 0] = np.minimum(rgb[(np.floor(xx) - tx0) % 6 == 0].astype(int), np.array(Bl[5])).astype(np.uint8)
    rgb[(np.floor(H - yy) - ty0) % 6 == 0] = np.minimum(rgb[(np.floor(H - yy) - ty0) % 6 == 0].astype(int), np.array(Bl[5])).astype(np.uint8)
    L.put(tx0, hy(ty0 + th_), rgb, np.ones(xx.shape, bool))
    L.rect(tx0 - 3, hy(ty0 + th_ + 3), tw_ + 6, 3, S[6]); L.rect(tx0 - 3, hy(ty0), tw_ + 6, 3, S[4])
    L.vl(tx0 - 3, hy(ty0 + th_ + 3), th_ + 6, S[6], t=2); L.vl(tx0 + tw_ + 1, hy(ty0 + th_ + 3), th_ + 6, S[3], t=2)
    L.poly([(tx0 - 4, hy(ty0 + th_ + 3)), (tx0 + tw_ / 2.0, hy(ty0 + th_ + 9)), (tx0 + tw_ + 4, hy(ty0 + th_ + 3))], S[5])
    L.line(tx0 - 4, hy(ty0 + th_ + 3), tx0 + tw_ / 2.0, hy(ty0 + th_ + 9), S[6], t=TH)
    for (bx, c) in ((144, 'red'), (322, 'yellow')):                           # museum banners (no words), over pilasters
        C = R[c]
        top, bot = FR['main'] - 6, MAIN_Y + 4
        L.rect(bx - 2, hy(top + 1), 20, 1.5, I[2]); L.px(bx - 2, hy(top + 2), I[4]); L.px(bx + 17, hy(top + 2), I[4])
        L.rect(bx, hy(top), 16, top - bot, C[4]); L.vl(bx, hy(top), top - bot, C[5]); L.vl(bx + 15, hy(top), top - bot, C[2])
        L.vl(bx + 1, hy(top), top - bot, C[5], t=TH)
        L.poly([(bx, hy(bot)), (bx + 16, hy(bot)), (bx + 8, hy(bot - 6))], C[4])
        for yb_ in (top - 8, top - 12, top - 36, top - 40, top - 44):       # bands of colour (a calm design)
            L.hl(bx + 3, hy(yb_), 10, R['white'][6], t=TH)
        L.rect(bx + 4, hy(top - 18), 8, 10, R['white'][5]); L.rect(bx + 5, hy(top - 19), 6, 8, C[2])
        L.ellipse(bx + 8, hy(top - 23), 2, 2, Y[5])

    # ---- the towers over the mouths: projecting faces, quoins, the balcony, paired windows, a stage course
    for (tx0_, tx1_, mouth) in ((TL[0], TL[1], P0), (TR[0], TR[1], P1)):
        tw = tx1_ - tx0_
        cxt = (tx0_ + tx1_) / 2.0
        brickfill(L, tx0_, 0, tw, H - FR['gf'] - 3, B, seed + tx0_, streaks=True, lo=2, hi=5)
        for yy_ in range(MAIN_Y + 5, FR['main'] - 2, 7):
            L.hl(tx0_, hy(yy_), tw, S[5], t=TH)
        L.rect(tx0_ - 1, hy(CEIL + 3), tw + 2, 3, S[6]); L.hl(tx0_ - 1, hy(CEIL), tw + 2, S[3])
        L.rect(tx0_ - 1, hy(FR['main'] + 3), tw + 2, 4, S[6]); L.hl(tx0_ - 1, hy(FR['main'] - 1), tw + 2, S[3])
        L.rect(tx0_ - 1, hy(FR['gf'] + 2), tw + 2, 3, S[6])
        for wx in (cxt - 12, cxt + 12):                                        # the paired windows of the main floor
            main_win(wx, 11, 50, glint=wx < cxt)
        L.ellipse(cxt, hy(MAIN_Y + 40), 4.5, 4.5, S[5]); L.ellipse(cxt, hy(MAIN_Y + 40), 3.0, 3.0, G[1])  # an oculus
        L.ellipse(cxt - 0.8, hy(MAIN_Y + 41), 1.0, 1.0, G[3])
        # the balcony on its corbels, a balustrade of small posts
        bx0, bw = cxt - 24, 48
        L.rect(bx0, hy(MAIN_Y), bw, 2.5, S[6]); L.hl(bx0, hy(MAIN_Y - 2.5), bw, S[2])
        for kx in range(int(bx0) + 2, int(bx0 + bw) - 2, 8):
            L.rect(kx, hy(MAIN_Y - 2.5), 3, 4, S[4]); L.hl(kx, hy(MAIN_Y - 2.5), 3, S[5])
        for kx in np.arange(bx0 + 1, bx0 + bw - 1, 2.5):
            L.rect(kx, hy(MAIN_Y + 7), 1.5, 7, S[5]); L.vl(kx + 1, hy(MAIN_Y + 7), 7, S[3], t=TH)
        L.rect(bx0, hy(MAIN_Y + 9), bw, 2, S[6]); L.hl(bx0, hy(MAIN_Y + 7), bw, S[3])
        # the stage over the main floor: a blind arcade in the frieze zone with a stone shield
        for ax in (cxt - 18, cxt - 6, cxt + 6):
            L.rect(ax + 1, hy(FR['frieze'] + 4), 10, 9, B[1]); L.ellipse(ax + 6, hy(FR['frieze'] + 4), 5, 3, B[1])
        L.rect(cxt - 5, hy(FR['main'] + 13), 10, 10, S[5]); L.poly([(cxt - 5, hy(FR['main'] + 3)), (cxt + 5, hy(FR['main'] + 3)), (cxt, hy(FR['main'] - 1))], S[5])
        L.rect(cxt - 3.5, hy(FR['main'] + 12), 7, 9, Rd[4]); L.vl(cxt - 0.75, hy(FR['main'] + 12), 9, K[1], t=1.5)   # the city arms
        for yy_ in (FR['main'] + 10, FR['main'] + 7, FR['main'] + 4):
            L.px(cxt - 0.5, hy(yy_), R['white'][6])
        # the edges of the projecting faces: light on the left, shade on the right; quoins
        solid_l = tx0_ < P0                                                    # the left tower's left edge stands on the ground
        for (ex, side) in ((tx0_, -1), (tx1_ - 4, 1)):
            outside = (side < 0 and solid_l) or (side > 0 and not solid_l)
            y_low = 0 if outside else CEIL + 3
            L.vl(ex if side < 0 else ex + 3, hy(H), H - y_low, B[5] if side < 0 else B[1])
            k = 0
            for yy_ in range(int(hy(H - 1)), int(hy(y_low)) - 3, 4):
                long_ = k % 2 == 0
                qx = ex if side < 0 else ex + 4 - (6 if long_ else 4)
                L.rect(qx, yy_, 6 if long_ else 4, 3, S[5] if side < 0 else S[4]); L.hl(qx, yy_, 6 if long_ else 4, S[6] if side < 0 else S[5], t=TH)
                k += 1
        # the solid part of the tower beside its mouth: a mezzanine window and a ground-floor window
        sx0, sx1 = (tx0_, mouth - 3) if solid_l else (mouth + 3, tx1_)
        scx = (sx0 + sx1) / 2.0
        ground_win(scx); mezz_win(scx, w=11)

    # ---- the passage's far wall (in deep shade, lit only near the mouths and by its lamps)
    pw_ = P1 - P0
    brickfill(L, P0, hy(CEIL), pw_, CEIL, B, seed + 50, lo=1, hi=3, mid=2)
    for k in range(P0, P1, 40):                                               # recessed niches with wall lamps
        nx0, nx1 = k + 8, k + 32
        r = (nx1 - nx0) / 2.0
        top = 60
        L.ellipse(nx0 + r, hy(top - r), r + 1.5, r + 1.5, S[4]); L.rect(nx0 - 1.5, hy(top - r), nx1 - nx0 + 3, top - r - 24, S[4])
        L.vl(nx0 - 1.5, hy(top - r), top - r - 24, S[5], t=TH)
        L.ellipse(nx0 + r, hy(top - r), r, r, B[1]); L.rect(nx0, hy(top - r), nx1 - nx0, top - r - 24, B[1])
        rr = r - 0.01
        mk_x, mk_y = grid(nx0, hy(top), nx1 - nx0, top - 24)
        inside = ((mk_x - nx0 - r) ** 2 + (mk_y - hy(top - r)) ** 2 <= rr * rr) | (mk_y >= hy(top - r))
        brickfill(L, nx0, hy(top), nx1 - nx0, top - 24, B, seed + k, mask=inside, lo=1, hi=3, mid=2)
        L.ellipse(nx0 + r, hy(top - r) - r * 0.25, r - 0.6, r * 0.55, B[0])               # the shade of the arch
        L.rect(nx0, hy(top - r), 1.5, top - r - 24, B[0])                                   # the reveal on the left
        lx = nx0 + r
        L.rect(lx - 0.5, hy(47), 1, 4, I[2]); L.hl(lx - 2, hy(47), 4, I[2], t=TH)          # a wall lantern
        L.rect(lx - 1.5, hy(46), 3, 4, EM[1]); L.rect(lx - 0.5, hy(45), 1, 2, EM[0]); L.hl(lx - 2, hy(42), 4, I[1], t=TH)
    for k in range(P0 + 40, P1, 40):                                          # ribs of the vault
        L.rect(k - 1, hy(CEIL), 3, CEIL - 24, B[2]); L.vl(k - 1, hy(CEIL), CEIL - 24, B[3], t=TH)
    L.rect(P0, hy(CEIL), pw_, 7, B[1])                                        # the vault's shade
    # the tiled dado: cream tiles, a blue band, a dark skirting
    xx, yy = grid(P0, hy(24), pw_, 24)
    fu, fv = (xx / 3.0) % 1, ((H - yy) / 3.0) % 1
    t = 5 - (hs(np.floor(xx / 3), np.floor(yy / 3), seed + 61) > 0.72)
    t = np.where((fu < 0.16) | (fv < 0.16), 3, t)
    rgb = np.array(S, np.uint8)[t]
    band = ((H - yy) >= 17) & ((H - yy) < 20)
    rgb[band] = Bl[3]; rgb[band & ((H - yy) >= 19)] = Bl[5]
    rgb[(H - yy) < 3] = S[2]
    L.put(P0, hy(24), rgb, np.ones(xx.shape, bool))
    L.hl(P0, hy(24), pw_, S[6])
    # light: the far wall is darker toward the middle, bright at both mouths
    xx, yy = grid(P0, hy(CEIL), pw_, CEIL)
    v = L.view(P0, hy(CEIL), pw_, CEIL)
    dist = np.minimum(xx - P0, P1 - xx)
    f = 0.48 + 0.52 * np.exp(-dist / 34.0)
    f = f * (0.86 + 0.14 * np.clip((H - yy) / CEIL, 0, 1) ** 0.4)             # a little darker under the vault
    lamp_ = np.zeros(xx.shape, bool)
    for e in EM[:2]:
        lamp_ |= np.all(v[..., :3] == np.array(e, np.uint8), axis=-1)
    px = v[..., :3].astype(float) * np.array([1.0, 0.98, 1.04])[None, None] * f[..., None]
    v[..., :3] = np.where(lamp_[..., None], v[..., :3], snap5(px).astype(np.uint8))
    for k in range(P0, P1, 40):                                               # each lamp lights its niche a little
        tint(L, k + 20, hy(43), 9, 10, (236, 196, 120), a1=0.22, a2=0.10)
    # ---- the mouths: cream stone pilasters and arch spandrels framing each end
    for ax in (P0, P1):
        L.rect(ax - 3, hy(CEIL + 3), 6, CEIL + 3, S[5]); L.vl(ax - 3, hy(CEIL + 3), CEIL + 3, S[6]); L.vl(ax + 2, hy(CEIL + 3), CEIL + 3, S[3])
        for yy_ in range(int(hy(CEIL)), H - 4, 7):
            L.hl(ax - 3, yy_, 6, S[3], t=TH)
        L.rect(ax - 4, hy(4), 8, 4, S[3]); L.hl(ax - 4, hy(4), 8, S[5])
        sg = 1 if ax == P0 else -1                                            # the spandrel: a quarter arch inside the mouth
        for yy_ in sub(hy(CEIL), hy(CEIL - 10)):
            hgt = hy(CEIL - 10) - yy_
            w_ = 10 - math.sqrt(max(0, 100 - hgt * hgt))
            if w_ > 0:
                L.rect(ax + (3 if sg > 0 else -3 - w_), yy_, w_, D1, S[4])
    PAINTED['front'] = dict(s=S14, storeys=[FR['mezz'] - FR['gf'], (FR['main'] - FR['mezz'] - 3) / 2.0, FR['upper'] - FR['frieze']], gf=FR['gf'],
                            win_w=MAIN_W, ridge=FR['ridge'], tower=FR['tower'], width=W)
    return L


# ---------------------------------------------------------------- an elm whose crown is not clipped by its box
def clump(w, h, seed, leaf='leaf', rag=6.0, holes=0.10, nb=7, spread=0.26, reach=3.5):
    """A leaf clump (the kit's canopy) whose loose leaves stay within `reach` px of its spheres."""
    c = canopy(w, h, R[leaf], seed, nb=nb, rag=rag, holes=holes, spread=spread)
    core = canopy(w, h, R[leaf], seed, nb=nb, rag=0.0, holes=0.0, spread=spread).mask()
    c.a[..., 3][~dilate(core, P(reach))] = 0
    return c


def dilate(m, k):
    """A square dilation of a mask by k real px (log steps of rolls; the masks have empty margins)."""
    out = m.copy()
    for ax in (0, 1):
        r = 0
        while r < k:
            st = min(r + 1, k - r)
            out = out | np.roll(out, st, ax) | np.roll(out, -st, ax)
            r += st
    return out


ELM_CLUMPS = [(-30, 6, 60, 48), (28, 2, 62, 50), (-2, -8, 58, 44), (-46, 34, 48, 38), (46, 32, 50, 40), (-16, 36, 56, 42),
              (18, 40, 54, 40)]
ELM_M = 16.8                     # the elm's height in metres (the shared ELM_H 218 px at speed 1)


def elm_b(seed, s=1.0, leaf='leaf'):
    """The game's elm at the scenery scale of its plane (16.8 m: ELM_H x s): a forked trunk carrying leaf clumps at
       its branch ends, sky between them. Drawn on the design of the game's box (104 x 136), scaled to its height;
       the leaves keep their pixel size, so a larger crown has more leaf clusters. The layer is wider than the crown
       so no clump is clipped."""
    rng = random.Random(seed)
    h = int(round(ELM_H * s))
    f = h / 136.0
    W2 = int(round((104 + 44) * f))
    L = Layer(W2, h)
    ch = int(h * 0.62)
    tr = trunk(rng, h - ch // 2 + int(8 * f), max(8, int(round(8 * f))), seed=seed)
    L.blit(tr, W2 / 2 - tr.w / 2, h - tr.h)
    cx, cy = W2 / 2.0, 22 * f
    for i, (dx, dy, cw, chh) in enumerate(ELM_CLUMPS):
        cw_, ch_ = int(round(cw * f)), int(round(chh * f))
        c = clump(cw_, ch_, seed * 7 + i, leaf=leaf, nb=6 + i % 3 + int(f > 1.25))
        L.blit(c, cx + dx * f - cw_ / 2.0 + rng.uniform(-3, 3), cy + dy * f - ch_ / 2.0 + 10 * f + rng.uniform(-2, 2))
    PAINTED.setdefault('elms', []).append((round(s, 3), h, W2))
    return L


# ---------------------------------------------------------------- the passage roof and its piers (slices in depth)
def art_x(sec, ax_world, px_in_art, ox=241, depth=14):
    """The world x on the plane of `depth` where a pixel column of a decor part (drawn at its own size) lies."""
    sp = s_d(depth)
    p = sec.at(ax_world, sp) - ox + px_in_art
    return 192 + (p - 192) / sp


def passage_roof(sec, x0=400, x1=720, top=84, bot=96, d_far=14, pier_front=6, mus_x=560):
    """The roof the heroes walk on (the terrain's solid 84-96), from the facade (depth 14) to the walk line, drawn as
       one slice per depth px so it turns with the camera: the slab's top face (a strip at each depth), its two
       ends (brick), and under the ends from the far walkway back, the tiled piers. The ends run from the art's
       mouths at the facade to the solid's ends at the walk line (the art is not scaled with depth). The slab's
       front (the solid's face) is a band in the walk plane whose lower edge is the vault bottom, y 96."""
    S = R['stone']; B = R['brick_red']; Bl = R['blue']
    ROOF_H, CEIL_H = GY - top, GY - bot
    xb0, xb1 = art_x(sec, mus_x, P0 + 2), art_x(sec, mus_x, P1 - 2)
    for k in range(int(d_far), 0, -1):
        Lp, kk = sec.plane(k)
        sp = s_d(kk)
        yf = GY - kk
        yt, yb = yf - ROOF_H * sp, yf - CEIL_H * sp
        f = kk / float(d_far)
        xa, xc = x0 + (xb0 - x0) * f, x1 + (xb1 - x1) * f
        p0, p1 = sec.at(xa, sp), sec.at(xc, sp)
        tone = 5 if k % 3 else 4                                       # the top: dressed sandstone slabs, joints along the depth
        Lp.rect(p0, yt, p1 - p0, 1.4, S[tone])
        for jx in range(x0 + 24, x1, 24):
            Lp.rect(sec.at(jx, sp), yt, TH, 1.4, S[3])
        for (xe, sg) in ((xa, -1), (xc, 1)):
            pe = sec.at(xe, sp) - 1.5
            Lp.rect(pe, yt, 3, yb - yt, B[3])                                  # the slab's end
            for hh in range(3, int(ROOF_H - CEIL_H), 3):
                Lp.rect(pe, yt + hh * sp, 3, TH, B[2])
            Lp.rect(pe, yt, 3, 1.2, S[6]); Lp.rect(pe, yb - 1.4, 3, 1.4, S[3])
            if k >= pier_front:
                hgt = yf - yb
                Lp.rect(pe, yb, 3, hgt, B[3])                                      # the pier: brick, the tiled dado below
                for hh in range(27, int(CEIL_H), 3):
                    Lp.rect(pe, yf - hh * sp, 3, TH, B[2])
                dado = 24 * sp
                Lp.rect(pe, yf - dado, 3, dado, S[5])
                for hh in range(3, 24, 3):
                    Lp.rect(pe, yf - hh * sp, 3, TH, S[3])
                Lp.rect(pe, yf - dado, 3, TH, S[6])
                Lp.rect(pe, yf - 19.5 * sp, 3, 2.4 * sp, Bl[4]); Lp.rect(pe, yf - 2.5 * sp, 3, 2.5 * sp, S[2])
                Lp.rect(pe, yb, 3, 1.5, S[5])
                if k == pier_front:                                          # the stone cap at the front of each pier
                    Lp.rect(pe - 0.5, yb, 4, hgt, S[5]); Lp.vl(pe - 0.5, yb, hgt, S[6]); Lp.vl(pe + 3, yb, hgt, S[3])
                    Lp.rect(pe - 1, yf - 3, 5, 3, S[3])
    # the front band in the walk plane
    N, _ = sec.plane(0)
    w = x1 - x0
    N.rect(x0, top, w, 1.5, S[6]); N.rect(x0, top + 1.5, w, 1, S[4])
    brickfill(N, x0, top + 2.5, w, 6.5, B, 77, lo=2, hi=5, mid=3)
    for jx in range(x0 + 8, x1, 16):                                       # small stone modillions in the band
        N.rect(jx, top + 3.5, 2, 4, S[5]); N.px(jx + 1, top + 6.5, S[3])
    N.rect(x0, top + 9, w, 2, S[5]); N.hl(x0, top + 9, w, S[6], t=TH)
    N.rect(x0, top + 11, w, 1, S[2])
    for xe in (x0, x1 - 3):
        N.rect(xe, top, 3, bot - top, S[5]); N.vl(xe, top, bot - top, S[6], t=TH)


def museum_flanks(sec, AIR, x_l=None, x_r=None, d0=14, d1=30, step=2, corn=None, ridge=None, mus_x=560):
    """The museum's two side walls from its front (depth 14) back to the floor's back edge, one slice per `step` depth
       px, so they turn with the camera like the game's face boxes: brick with the stone courses of the front's
       program (ground floor, mezzanine, main floor, frieze), its windows now and then, the cornice and the slate
       roof up to the ridge (30 m: above the top edge)."""
    B = R['brick_red']; S = R['stone']; RT = R['roof_slate']; G = R['glass']; O = R['brick_ochre']
    corn = FR['cornice'] if corn is None else corn
    ridge = FR['ridge'] if ridge is None else ridge
    x_l = art_x(sec, mus_x, 2) if x_l is None else x_l
    x_r = art_x(sec, mus_x, 480) if x_r is None else x_r
    for k in range(d0 + step, d1 + 1, step):
        Lp, kk = sec.plane(k)
        sp = s_d(kk)
        yf = GY - kk
        a = 0.0050 * kk
        cB = pal_of(B, grader(air=(AIR[0], AIR[1], a, 0.3))); cS = pal_of(S, grader(air=(AIR[0], AIR[1], a, 0.3)))
        cR = pal_of(RT, grader(air=(AIR[0], AIR[1], a, 0.3))); cG = pal_of(G, grader(air=(AIR[0], AIR[1], a, 0.3)))
        cO = pal_of(O, grader(air=(AIR[0], AIR[1], a, 0.3)))
        roof = min(ridge, corn + 3 + (kk - d0) * 9.0)
        for (xe, tone) in ((x_l, 3), (x_r, 2)):
            pe = sec.at(xe, sp) - 2.5
            Lp.rect(pe, yf - corn * sp, 5, corn * sp, cB[tone])
            courses = list(range(8, 46, 6)) + list(range(FR['gf'] + 8, CEIL - 2, 7)) + list(range(MAIN_Y + 5, FR['main'] - 2, 7))
            for hh in courses:
                Lp.rect(pe, yf - hh * sp, 5, TH, cS[5])
            for (h0, h1) in ((FR['gf'] - 1, FR['gf'] + 2), (CEIL, CEIL + 3), (MAIN_Y - 2, MAIN_Y + 1), (FR['main'] - 1, FR['main'] + 2),
                             (FR['frieze'], FR['frieze'] + 1)):
                Lp.rect(pe, yf - h1 * sp, 5, max(TH, (h1 - h0) * sp), cS[6])
            Lp.rect(pe, yf - (FR['frieze'] - 1) * sp, 5, (FR['frieze'] - FR['main'] - 3) * sp, cO[4])     # the tile frieze
            Lp.rect(pe, yf - 5 * sp, 5, 5 * sp, cS[3])
            if (k // step) % 3 == 1:                                         # a window in the side wall now and then
                for (w0, w1) in ((MAIN_Y, MAIN_Y + MAIN_H), (56, 72), (10, 42), (FR['frieze'] + 8, FR['upper'] - 6)):
                    Lp.rect(pe + 1, yf - w1 * sp, 3, (w1 - w0) * sp, cG[1]); Lp.rect(pe + 1, yf - w1 * sp, 3, TH, cS[6])
            Lp.rect(pe, yf - (corn + 3) * sp, 5, 3 * sp, cS[5]); Lp.rect(pe, yf - (corn + 3) * sp, 5, TH, cS[6])
            Lp.rect(pe, yf - roof * sp, 5, (roof - corn - 3) * sp, cR[3 if tone == 3 else 2])
            Lp.rect(pe, yf - roof * sp, 5, TH, cR[5])


# ---------------------------------------------------------------- the hot-dog trailer (box 84 x 62, anchor 14)
def hotdog_stand():
    """A white box trailer with an American-flag print (blue field with white stars, red and white stripes), big blue
       HOTDOGS with a white edge, a painted hot dog with a mustard zigzag, the serving hatch (empty) with its flap
       propped open, drawbar, jockey wheel, two small wheels, the red flag on the roof pole. A top face (seen from
       the floor's eye). Anchor (14, 62)."""
    Wt = R['white']; Rd = R['red']; Bl = R['blue']; I = R['iron']; K = R['black']; Y = R['yellow']; S = R['stone']
    Wd = R['wood']; G = R['glass']; SA = R['brick_ochre']
    L = Layer(84, 62)
    bx, by, bw, bh = 14, 12, 64, 38
    # drawbar and jockey wheel
    L.line(1, by + bh - 3, bx, by + bh - 7, I[3], t=1.4); L.line(1, by + bh - 2, bx, by + bh - 6, I[1], t=TH)
    L.rect(0, by + bh - 4, 3, 2, I[2])
    L.rect(5, by + bh - 6, 2, 13, I[3]); L.vl(5, by + bh - 6, 13, I[5], t=TH)
    L.rect(4, by + bh - 7, 4, 2, I[2])
    L.ellipse(6, 59, 2.4, 2.4, K[1]); L.ellipse(6, 59, 1.0, 1.0, I[4])
    # top face (the roof seen from above) and the box
    L.poly([(bx + 3, by - 4), (bx + bw - 1, by - 4), (bx + bw, by), (bx + 1, by)], Wt[5])
    L.rect(bx + 3, by - 4, bw - 4, 1, Wt[6])
    L.rect(bx + 40, by - 6, 9, 3, I[4]); L.hl(bx + 40, by - 6, 9, I[6]); L.hl(bx + 40, by - 4, 9, I[2])      # a vent
    L.rect(bx, by + 2, bw, bh - 2, Wt[5]); L.rect(bx + 2, by, bw - 4, 2, Wt[5])
    L.px(bx + 1, by + 1, Wt[5]); L.px(bx + bw - 2, by + 1, Wt[4])
    L.hl(bx + 2, by, bw - 4, Wt[6]); L.vl(bx, by + 2, bh - 2, Wt[6])
    L.vl(bx + bw - 1, by + 2, bh - 2, Wt[3]); L.hl(bx + 1, by + bh - 1, bw - 2, Wt[2])
    # the flag print: stripes sweeping over the right part, the blue field with stars at the top left
    xx, yy = grid(bx + 1, by + 1, bw - 2, bh - 3)
    stripe = np.floor(((xx - bx) + (yy - by) * 1.2) / 4.0) % 2 == 0
    region = ((xx - bx) + (by + bh - yy) * 0.8 >= 46) & ~((yy >= by + bh - 14) & (xx < bx + bw - 6))
    rgb = np.broadcast_to(np.array(Rd[4], np.uint8), xx.shape + (3,)).copy()
    sh = hs(xx, yy, 5) > 0.5
    rgb[(np.floor(((xx - bx) + (yy - by) * 1.2) * DET) % (4 * DET) == 0)] = Rd[5]
    L.put(bx + 1, by + 1, rgb, stripe & region)
    L.rect(bx + 2, by + 2, 17, 13, Bl[2]); L.hl(bx + 2, by + 2, 17, Bl[4]); L.hl(bx + 2, by + 14, 17, Bl[1])
    for j, y in enumerate(range(by + 4, by + 14, 3)):
        for x in range(bx + 4 + (j % 2) * 1, bx + 18, 3):
            L.px(x, y, Wt[6])
    # the serving hatch, the flap propped open above, the counter ledge
    hx0, hx1, hy0, hy1 = bx + 20, bx + 44, by + 6, by + 21
    L.rect(hx0 - 1, hy0 - 1, hx1 - hx0 + 2, hy1 - hy0 + 2, S[4])
    L.rect(hx0, hy0, hx1 - hx0, hy1 - hy0, K[1]); L.rect(hx0, hy0, hx1 - hx0, 2, K[0])
    L.rect(hx0 + 2, hy0 + 4, 5, 4, I[3]); L.hl(hx0 + 2, hy0 + 4, 5, I[5])                         # a steamer
    L.rect(hx1 - 8, hy0 + 2, 6, 3, Y[5]); L.hl(hx1 - 8, hy0 + 4, 6, Y[3])                          # the menu card
    L.rect(hx0 + 9, hy0 + 3, 5, 2, I[2]); L.rect(hx0 + 1, hy1 - 3, hx1 - hx0 - 2, 2, I[2])        # shelf, back counter
    L.poly([(hx0 - 2, hy0 - 2), (hx1 + 2, hy0 - 2), (hx1 + 5, hy0 - 9), (hx0 + 1, hy0 - 9)], Wt[4])
    L.line(hx0 + 1, hy0 - 9, hx1 + 5, hy0 - 9, Wt[6], t=TH); L.line(hx0 - 2, hy0 - 2, hx1 + 2, hy0 - 2, Wt[2], t=TH)
    L.line(hx1 + 2, hy0 - 2, hx1 + 4, hy0 - 8, I[3], t=TH)
    L.rect(hx0 - 2, hy1, hx1 - hx0 + 4, 2, S[5]); L.hl(hx0 - 2, hy1, hx1 - hx0 + 4, S[6]); L.hl(hx0 - 2, hy1 + 2, hx1 - hx0 + 4, Wt[2])
    # HOTDOGS: big blue letters with a white edge, on the clean band at the bottom
    tw = text_w('HOTDOGS') * 2
    big_text(L, bx + (bw - tw) / 2.0, by + bh - 12, 'HOTDOGS', Bl[2], 2, edge=Wt[6])
    # the painted hot dog with a mustard zigzag
    hx, hy_ = bx + 47, by + 15
    L.ellipse(hx + 7.5, hy_ + 3, 8, 3.2, SA[4]); L.ellipse(hx + 7.5, hy_ + 2.2, 7.5, 1.4, SA[5])
    L.ellipse(hx + 7.5, hy_ + 2.6, 7.2, 1.6, Rd[2]); L.hl(hx + 2, hy_ + 2, 11, Rd[4], t=TH)
    for x in range(2, 14, 2):
        L.px(hx + x, hy_ + 1.5 + (x // 2) % 2, Y[6])
    L.hl(hx + 1, hy_ + 5.5, 13, SA[2], t=TH)
    # chassis, mudguards, wheels
    L.rect(bx + 4, by + bh, bw - 8, 2, K[1])
    L.rect(bx + 10, by + bh, 30, 3, K[2])
    for wx in (bx + 18, bx + 31):
        L.ellipse(wx, 56, 5.4, 5.4, K[1]); L.ellipse(wx, 56, 2.4, 2.4, I[4]); L.ellipse(wx - 0.6, 55.4, 0.8, 0.8, I[6])
    L.hl(bx + 8, 61, 34, K[0])
    # the roof pole and the red flag (the game's flag-red at (1017, 115): x 70, y 1 of this box)
    L.rect(bx + bw - 9, 0, 1.5, by, I[3]); L.px(bx + bw - 9, 0, Y[5])
    for x in sub(0, 14):
        dy = math.sin((x / 14.0) * 5.0) * 0.8 * (x / 14.0)
        L.rect(bx + bw - 7.5 + x, 1.5 + dy, D1, 5.5 - x * 0.12, Rd[4 if x < 9 else 3])
    L.rect(bx + bw - 7.5, 1.5, 1, 5.5, Rd[5])
    return L


def grey_lamp(h=LAMP_GREY_H):
    """A modern grey street lamp (8.6 m at the walk plane: the shared LAMP_GREY_H): a tapered steel post with a
       ring joint, a base with its door, an arm bent over to the right, a flat head with its glass. The head grows
       with the post. Anchor bottom middle (x 7.5)."""
    S = R['pave_grey']; I = R['iron']
    f = h / 84.0
    hw = int(math.ceil(16 * f)) + 9
    L = Layer(hw, h)
    cx = 7
    top = 10 * f
    L.rect(cx - 1, top, 3, h - top, S[4]); L.vl(cx - 1, top, h - top, S[6]); L.vl(cx + 1, top, h - top, S[2])
    bh = 14 * f
    L.rect(cx - 2, h - bh, 5, bh, S[3]); L.vl(cx - 2, h - bh, bh, S[5]); L.vl(cx + 2, h - bh, bh, S[1])
    L.rect(cx - 2, h - bh, 5, 1, S[5])
    L.rect(cx - 1, h - bh + 4, 3, 6, S[2]); L.hl(cx - 1, h - bh + 4, 3, S[4], t=TH)                   # the base's door
    L.rect(cx - 2, h - 9, 5, 2, I[2]); L.hl(cx - 3, h - 1, 7, I[1])
    L.rect(cx - 1.5, h * 0.45, 4, 1.5, S[5]); L.hl(cx - 1.5, h * 0.45 + 1.5, 4, S[2], t=TH)          # a ring joint
    ax_, ay_ = cx + 4 * f, 5 * f                                               # the arm bends over to the right
    L.line(cx, top + 1, cx + 1.5 * f, 6.5 * f, S[4], t=1.6); L.line(cx + 1.5 * f, 6.5 * f, ax_, ay_ - 0.5, S[4], t=1.6)
    L.line(ax_, ay_ - 0.5, ax_ + 6 * f, ay_ - 1.5, S[4], t=1.4); L.line(cx + 1, top + 1, cx + 2.5 * f, 7 * f, S[2], t=TH)
    hx, hy_, hw_ = ax_ + 3 * f, ay_ - 2.5, 9 * f                                # the flat head with its glass underside
    L.rect(hx, hy_, hw_, 3, S[5]); L.hl(hx, hy_, hw_, S[6]); L.vl(hx + hw_ - 1, hy_, 3, S[3])
    L.rect(hx + 1, hy_ + 3, hw_ - 2, 1.2, R['glass'][5]); L.hl(hx + 1, hy_ + 4.2, hw_ - 2, S[2], t=TH)
    L.rect(cx + 1.5 * f - 0.8, 6.5 * f - 0.8, 1.6, 1.6, S[2])
    return L


def cabinet():
    """The grey electrical cabinet (22 x 30) with tags and stickers. Anchor bottom middle."""
    S = R['pave_grey']; K = R['black']; Y = R['yellow']; Wt = R['white']; Gn = R['green']
    L = Layer(22, 30)
    L.rect(1, 3, 20, 26, S[4]); L.vl(1, 3, 26, S[5]); L.vl(20, 3, 26, S[2])
    L.rect(0, 1, 22, 3, S[5]); L.hl(0, 1, 22, S[6]); L.hl(0, 3, 22, S[2])
    L.vl(11, 4, 24, S[2], t=TH); L.vl(11.5, 4, 24, S[5], t=TH)
    for y in (6, 8, 10):
        L.hl(14, y, 5, S[2], t=TH)
    L.rect(9.5, 15, 1, 2, K[2]); L.rect(12.5, 15, 1, 2, K[2])
    for (a, b) in (((3, 10), (6, 6)), ((6, 6), (8, 11)), ((8, 11), (12, 7)), ((12, 7), (17, 12))):
        L.line(a[0], a[1], b[0], b[1], PINK[4], t=1.2)
    for (a, b) in (((4, 20), (8, 16)), ((8, 16), (9, 21)), ((9, 21), (14, 17))):
        L.line(a[0], a[1], b[0], b[1], K[1], t=1.0)
    L.ring(16, 21.5, 2.2, Gn[4], 1.4)
    L.rect(3, 23, 4, 3, Y[5]); L.hl(3, 23, 4, Y[6]); L.rect(14, 13, 3, 4, Wt[6]); L.rect(16, 25, 3, 2, R['red'][4])
    L.rect(1, 27, 20, 2, S[2]); L.hl(0, 29, 22, K[0])
    return L


def tulip_stall(rng):
    """The flower stall (breakable, 46 x 34): a wooden stand under a green and white awning, zinc buckets of tulips
       on two tiers, a board with TULPEN. Anchor bottom middle."""
    Wd = R['wood']; Gn = R['green']; Wt = R['white']; LF = R['leaf']; K = R['black']
    L = Layer(46, 34)
    for px_ in (2, 42):
        L.rect(px_, 6, 2, 28, Wd[3]); L.vl(px_, 6, 28, Wd[5], t=TH)
    for x in range(0, 46):                                               # the awning
        stripe = (x // 4) % 2 == 0
        C = Gn if stripe else Wt
        L.rect(x, 1, 1, 6, C[4] if stripe else C[5]); L.px(x, 1, C[5] if stripe else C[6])
        if x % 4 == 1:
            L.ellipse(x + 1, 7, 1.8, 1.4, C[3] if stripe else C[4])
    L.hl(0, 0, 46, Gn[2])
    for tier, (ty, x0, x1) in enumerate(((19, 5, 41), (26, 3, 43))):     # the tiers with buckets of tulips
        L.rect(x0 - 1, ty + 4, x1 - x0 + 2, 2, Wd[4]); L.hl(x0 - 1, ty + 4, x1 - x0 + 2, Wd[6])
        for bx in range(x0, x1 - 4, 6):
            L.rect(bx, ty, 5, 4, ZINC[4]); L.vl(bx, ty, 4, ZINC[6], t=TH); L.vl(bx + 4, ty, 4, ZINC[2]); L.hl(bx, ty, 5, ZINC[5])
            C = R[rng.choice(['red', 'red', 'yellow', 'white', 'red'])] if rng.random() < 0.85 else PINK
            for k in range(4):
                fx = bx + 0.5 + k * 1.2 + rng.uniform(-0.3, 0.3); fy = ty - 4 - rng.uniform(0, 2.5) - (1.5 if tier == 0 else 0)
                L.line(fx + 0.5, fy + 2, fx + 0.5, ty, LF[3], t=TH)
                L.rect(fx, fy, 1.6, 2.4, C[4]); L.px(fx, fy, C[6] if C is not R['white'] else C[5]); L.px(fx + 0.8, fy + 1.6, C[2])
            L.line(bx + 1, ty, bx - 1, ty - 3, LF[4], t=TH)
    L.rect(4, 28, 38, 6, Wd[3]); L.hl(4, 28, 38, Wd[5]); L.vl(4, 28, 6, Wd[5]); L.vl(41, 28, 6, Wd[1])
    L.rect(13, 29, 20, 4, Wt[5])
    text(L, 13 + (20 - text_w('TULPEN')) / 2.0, 28.5, 'TULPEN', Gn[2])
    L.hl(2, 33, 42, K[0])
    return L


def herring_cart(rng):
    """The herring cart (breakable, 46 x 36): a white enamel kiosk on wheels, a domed blue roof, a striped valance,
       the hatch with herrings on ice, the blue band with HARING, a small Dutch flag, the push handle."""
    Wt = R['white']; Bl = R['blue']; I = R['iron']; K = R['black']; Rd = R['red']; S = R['stone']
    L = Layer(46, 36)
    L.ellipse(23, 5, 21, 4.4, Bl[3]); L.rect(2, 5, 42, 2, Bl[3]); L.ellipse(19, 3.4, 15, 2.2, Bl[4]); L.hl(4, 6, 38, Bl[1])
    for x in range(2, 44):                                                # the striped valance
        C = Bl if (x // 3) % 2 == 0 else Wt
        L.rect(x, 7, 1, 3, C[4] if C is Bl else C[5])
        if x % 3 == 1:
            L.ellipse(x + 0.5, 10, 1.4, 1.0, C[3] if C is Bl else C[4])
    L.rect(4, 11, 38, 20, Wt[5]); L.vl(4, 11, 20, Wt[6]); L.vl(41, 11, 20, Wt[3]); L.hl(4, 30, 38, Wt[2])
    L.rect(9, 13, 28, 8, K[1]); L.rect(9, 13, 28, 1, K[0])                # the hatch
    for k in range(5):                                                    # ice and herrings
        L.rect(10 + k * 5.4, 18.5, 4.6, 2, S[6])
        L.ellipse(12 + k * 5.4, 18.4, 2.2, 0.9, I[2]); L.hl(10.4 + k * 5.4, 18.8, 3, I[5], t=TH)
        L.px(14 + k * 5.4, 18, I[1])
    L.vl(12, 15, 3, I[4], t=TH); L.rect(12.5, 15, 2, 1.4, Rd[4])
    L.rect(8, 21, 30, 1.5, S[5]); L.hl(8, 21, 30, S[6])
    L.rect(4, 23, 38, 6, Bl[3]); L.hl(4, 23, 38, Bl[5]); L.hl(4, 28, 38, Bl[1])
    text(L, 23 - text_w('HARING') / 2.0, 23.5, 'HARING', Wt[6])
    L.rect(6, 31, 34, 1.5, I[2])
    for wx in (11, 35):
        L.ellipse(wx, 32.6, 3.2, 3.2, K[1]); L.ellipse(wx, 32.6, 1.3, 1.3, I[4])
    L.line(41, 24, 45, 18, I[3], t=1.2); L.rect(44, 17, 2, 2, K[2])           # push handle
    L.vl(36, 0, 6, I[3], t=TH)                                             # a small Dutch flag
    L.rect(36.5, 0, 6, 1.4, Rd[4]); L.rect(36.5, 1.4, 6, 1.3, Wt[6]); L.rect(36.5, 2.7, 6, 1.3, Bl[4])
    L.hl(4, 35.5, 38, K[0], t=TH)
    return L


def lawn_post(h=7):
    """A low iron post of the lawn chains, with a ball on top. Anchor bottom middle."""
    C0, C1 = CHAIN
    Gn = R['green']
    L = Layer(4, h + 1)
    L.rect(1, 1.5, 2, h - 1, Gn[2]); L.vl(1, 1.5, h - 1, Gn[4], t=TH)
    L.ellipse(2, 1.4, 1.3, 1.3, Gn[3]); L.px(1.5, 0.6, Gn[5])
    L.hl(0.5, h, 3, R['black'][1], t=TH)
    return L


def lawn_chains(sec, r):
    """The front row of low posts with sagging chains (the game's 'lawn chains' row)."""
    xs = row_at(sec, r)
    k = r['depth']
    Lp, kk = sec.plane(k, front=False)
    sp = s_d(kk)
    lk = r.get('link') or {}
    mx = lk.get('max', 37.8); sag = lk.get('sag', 1.6)
    C0, C1 = [s5(c) for c in CHAIN]
    yb = GY - kk
    post_h = 7
    ytop = yb - post_h + 1.5
    for a, b in zip(xs, xs[1:]):
        if b - a > mx:
            continue
        pa, pb = sec.at(a, sp), sec.at(b, sp)
        for xx in sub(pa + 1, pb - 1):
            t = (xx - pa) / (pb - pa)
            y = ytop + 4 * sag * t * (1 - t)
            Lp.rect(xx, y, D1, TH, C0)
            if int(xx * DET) % 3 == 0:
                Lp.rect(xx, y + TH, D1, TH, C1)
    for x in xs:
        sec.put(lawn_post(post_h), x, k, shade=False)


# ---------------------------------------------------------------- the canal-house fronts of the game's house boxes
HOUSE_KINDS = {
    0: ('step', 'brick_brown', None), 1: ('neck', 'brick_red', None), 2: ('cornice', 'brick_purple', None),
    3: ('bell', 'brick_rose', None), 4: ('spout', 'brick_black', None), 5: ('neck', 'brick_red', None),
    6: ('bell', 'brick_ochre', None), 7: ('step', 'brick_brown', None), 8: ('step', 'brick_red', ('KAAS', 'yellow')),
    9: ('bell', 'brick_brown', ('BLOEMEN', 'green')), 10: ('neck', 'brick_purple', ('KOFFIE', 'red')),
    11: ('cornice', 'brick_brown', ('BOEKEN', 'blue')), 12: ('cornice', 'brick_black', None),
}


WAVER_W, WAVER_H = 18, 26       # the game's window waver (npc/ams/ams-window-waver): its framed window, 18 x 26 over its feet


def waver_opening(H, info, w, hb, B, T, seed, rects, shw=None):
    """The window of a game WAVER (an entity that draws its own framed window, curtains and flower box) set into this
       front: every window of the front whose unit (frame, sill, lintel, shutters) the waver's window would cut is
       bricked over with the wall's own bricks (brickfill with the body's seed, so the patch is the wall), and the
       opening gets the kit's stone lintel with its keystone over it and a shade line under its flower box: a landing
       window between the floors. rects: (x0, y0) of the waver's window frame in the front's px. shw: the width of
       the front's shutters (0: none; None: the old 0.42 of the glass). Returns the glass boxes left out (no lintels
       or shutters for them)."""
    gh = info['gh']
    out = []
    for (x, y, ww, wh) in info['win']:
        if ww < 7 or y < gh:
            continue
        sw = ww * 0.42 if shw is None else shw
        ux0, ux1, uy0, uy1 = x - 2 - sw - 1, x + ww + 2 + sw + 1, y - 5, y + wh + 3
        for (rx, ry) in rects:
            if ux0 < rx + WAVER_W + 3 and rx - 3 < ux1 and uy0 < ry + WAVER_H + 2 and ry - 5 < uy1:
                out.append((x, y, ww, wh))
                break
    xx, yy = grid(0, gh, w, hb)
    M = np.zeros(xx.shape, bool)
    for (x, y, ww, wh) in out:
        M |= (xx >= max(1, x - 3)) & (xx < min(w - 2, x + ww + 3)) & (yy >= y - 5) & (yy < y + wh + 3)
    if M.any():
        brickfill(H, 0, gh, w, hb, B, seed, mask=M, streaks=True)
    for (rx, ry) in rects:
        H.rect(rx - 2, ry - 4, WAVER_W + 4, 2.5, T[5]); H.hl(rx - 2, ry - 4, WAVER_W + 4, T[6]); H.hl(rx - 2, ry - 1.5, WAVER_W + 4, B[1], t=TH)
        H.rect(rx + WAVER_W / 2.0 - 1.5, ry - 5, 3, 4, T[6]); H.vl(rx + WAVER_W / 2.0 + 0.5, ry - 5, 4, T[3], t=TH)
        H.hl(rx, ry + WAVER_H, WAVER_W, B[1]); H.hl(rx + 1, ry + WAVER_H + 1, WAVER_W - 1, B[1], t=TH)
        H.vl(rx + WAVER_W, ry + 1, WAVER_H - 1, B[1])                           # the reveal in shade (light from the left)
    return set(out)


def house_front(rng, box, frame, seed, s=S14, wavers=()):
    """A canal house on the game's box x and width, at the scenery scale of its plane (sc = 2 s: a storey 40 s, the
       ground floor 27 sc, windows 7 sc wide). The box's height picks the number of upper storeys (the low cornice
       box 2, the middle boxes 3, the tall ones 4), so the row keeps the game's rhythm of low and tall fronts; the
       tall ones leave the screen at the top. Large fronts get more detail per storey: stone lintels with keystones,
       shutters on some, string courses at the floors. wavers: the window frames of the game's wavers on this front
       ((x0, rows above the front's foot), waver_opening)."""
    kind, brick, shop = HOUSE_KINDS.get(frame, ('neck', 'brick_red', None))
    sc = 2.0 * s
    w, h = box['w'], box['h']
    n = 2 if h <= 100 else (3 if h <= 120 else 4)
    gf, st = q(27 * sc), 20.0 * sc
    hb = gf + q(n * st) + (3 if kind in ('neck', 'bell') else 2)
    T = R['plaster' if frame not in (4, 12) else 'stone']
    H, info = house(rng, w, hb, kind, brick, trim='plaster' if frame not in (4, 12) else 'stone',
                    doorc=rng.choice(['green', 'green', 'black', 'red', 'blue']), sc=sc, shop=shop, seed=seed)
    B = R[brick]; S = R['stone']
    gh = info['gh']
    shut = R[rng.choice(['green', 'green', 'black', 'red'])] if rng.random() < 0.4 else None
    # the shutters' width: 0.42 of the glass, but never over the frame of the next window (house(): the columns of a
    # front, `gap` between their frames), so a narrow front keeps its shutters, a little slimmer
    wf, mf = max(4, q(7 * sc)), max(2, q(3.4 * sc))
    ncol = 2 if w < 30 * sc else (3 if w < 46 * sc else 4)
    gap = (w - 2 * mf - ncol * wf) / max(ncol - 1, 1)
    shw = min((wf - 2) * 0.42, gap)
    gone = waver_opening(H, info, w, hb, B, T, seed, [(x0, H.h - up) for (x0, up) in wavers],
                         shw=shw if shut is not None else 0) if wavers else set()
    for (x, y, ww, wh) in info['win']:
        if ww < 7 or y < gh or (x, y, ww, wh) in gone:                         # gable lights keep their own frames
            continue
        L_ = H
        L_.rect(x - 2, y - 4, ww + 4, 2.5, T[5]); L_.hl(x - 2, y - 4, ww + 4, T[6]); L_.hl(x - 2, y - 1.5, ww + 4, B[1], t=TH)
        L_.rect(x + ww / 2.0 - 1.5, y - 5, 3, 4, T[6]); L_.vl(x + ww / 2.0 + 0.5, y - 5, 4, T[3], t=TH)
        if shut is not None and y + wh < gh + hb - gf:                         # shutters on the upper floors
            sw = min(ww * 0.42, shw)
            for sx in (x - 1 - sw, x + ww + 1):
                L_.rect(sx, y, sw, wh, shut[3]); L_.vl(sx, y, wh, shut[5], t=TH)
                for yy in np.arange(y + 1.5, y + wh - 1, 2.0):
                    L_.hl(sx + 0.5, yy, sw - 1, shut[2], t=TH)
    if kind != 'step':                                                         # string courses at the floors (the kit's split)
        yb = gh + hb
        avail = yb - gf - (gh + (3 if kind in ('neck', 'bell') else 2))
        nf = max(1, q(avail / (20.0 * sc)))
        wts = [1.18 - 0.11 * i for i in range(nf)]
        y = yb - gf
        for i in range(nf):
            yy = q(y)
            H.hl(1, yy - 1, w - 2, T[5], t=TH); H.hl(1, yy - 1 + TH, w - 2, B[1], t=TH)
            y -= avail * wts[i] / sum(wts)
    PAINTED.setdefault('houses', []).append((round(s, 3), st, gf, n, w))
    return H


def house_flank(sec, AIR, x_left, H, box, frame, s=S14, d0=14, d1=30, per=0.0143):
    """The side wall of a corner house (its front at depth d0, its left edge at world x_left) back to the floor's
       back edge, one slice per depth px so it turns with the camera: brick in shade, a stone plinth, the string
       courses of its floors, a side window now and then, the slate roof from the eaves up to the ridge."""
    kind, brick, shop = HOUSE_KINDS.get(frame, ('neck', 'brick_red', None))
    sc = 2.0 * s
    n = 2 if box['h'] <= 100 else (3 if box['h'] <= 120 else 4)
    gf, st = q(27 * sc), 20.0 * sc
    hb = gf + q(n * st) + (3 if kind in ('neck', 'bell') else 2)
    ridge = H.h - 2
    for k in range(d0 + 1, d1 + 1):
        Lp, kk = sec.plane(k)
        sp = s_d(kk)
        f = sp / s
        yf = GY - kk
        a = per * (d0 + (kk - d0) * 0.25)                                     # the front's air, a little more toward the back
        g = grader(air=(AIR[0], AIR[1], a, 0.3))
        cB = pal_of(R[brick], g); cS = pal_of(R['stone'], g); cR = pal_of(R['roof_slate'], g); cG = pal_of(R['glass'], g)
        pe = sec.at(x_left, sp)
        w = 4
        Lp.rect(pe, yf - hb * f, w, hb * f, cB[2])
        for hh in np.arange(5, hb, 4.0):                                       # brick courses
            Lp.rect(pe, yf - hh * f, w, TH, cB[1])
        Lp.rect(pe, yf - 6 * f, w, 6 * f, cS[3]); Lp.rect(pe, yf - 6 * f, w, TH, cS[5])          # the plinth
        for i in range(n + 1):                                                 # the floors' string courses
            yy = gf + i * st
            Lp.rect(pe, yf - yy * f, w, max(TH, 1.2 * f), cS[4])
        if k % 7 in (3, 4) and k < d1 - 2:                                     # a side window per floor
            for i in range(n):
                y0, y1 = gf + i * st + 8, gf + (i + 1) * st - 7
                Lp.rect(pe, yf - y1 * f, w, (y1 - y0) * f, cG[1]); Lp.rect(pe, yf - y0 * f, w, max(TH, 1.5 * f), cS[5])
        Lp.rect(pe, yf - ridge * f, w, (ridge - hb) * f, cR[2])                # the roof's side slope up to the ridge
        for hh in np.arange(hb + 3, ridge, 3.0):
            Lp.rect(pe, yf - hh * f, w, TH, cR[1])
        Lp.rect(pe, yf - (hb + 1.5) * f, w, 1.5 * f, cS[4])                   # the eaves board


# ---------------------------------------------------------------- far things (the far side over the lawn, s = 0.40)
SF = 0.40


def tram_far(s=SF):
    """A white and blue city tram, 30 m long and 2.9 m high at the scenery scale of its plane: five sections with a
       band of windows, doors, the blue skirt band, bogies, a pantograph on the second section. Standing still."""
    Wt = R['white']; Bl = R['blue']; G = R['glass']; K = R['black']; I = R['iron']; Y = R['yellow']
    w = int(round(m_px(30, s))); bh = int(round(m_px(2.9, s)))
    ph = 5
    L = Layer(w, bh + ph + 2)
    y0 = ph + 1
    nseg = 5
    sw = w / float(nseg)
    for i in range(nseg):
        x0, x1 = i * sw, (i + 1) * sw - 1
        L.rect(x0 + 1, y0, x1 - x0 - 1, bh - 1, Wt[5]); L.hl(x0 + 1, y0, x1 - x0 - 1, Wt[6])
        L.rect(x0 + 2, y0 - 1, x1 - x0 - 3, 1, Wt[4])
        L.rect(x0 + 2, y0 + 3, x1 - x0 - 3, 5, G[1]); L.hl(x0 + 2, y0 + 3, x1 - x0 - 3, G[0])
        for wx in np.arange(x0 + 6, x1 - 2, 5.5):
            L.vl(wx, y0 + 3, 5, Wt[4], t=TH)
        L.px(x0 + 3, y0 + 4, G[4])
        if i in (1, 3):                                                      # a double door
            dx = x0 + sw / 2.0 - 2
            L.rect(dx, y0 + 2, 4, bh - 4, Wt[3]); L.rect(dx + 0.5, y0 + 3, 3, bh - 6, G[0]); L.vl(dx + 2, y0 + 3, bh - 6, Wt[4], t=TH)
        L.rect(x0 + 1, y0 + 9, x1 - x0 - 1, 2, Bl[3]); L.hl(x0 + 1, y0 + 9, x1 - x0 - 1, Bl[5])
        L.hl(x0 + 1, y0 + bh - 3, x1 - x0 - 1, Wt[3])
        L.rect(x0 + 3, y0 + bh - 2, x1 - x0 - 5, 2, K[1])
        for bx in (x0 + 5, x1 - 5):
            L.ellipse(bx, y0 + bh - 0.6, 1.4, 1.4, K[2])
        L.vl(x1, y0 + 1, bh - 3, K[2])                                       # the joint between sections
    L.rect(w - 3, y0 + 2, 2.5, 6, G[2]); L.px(w - 2, y0 + 2, G[4]); L.px(w - 1.5, y0 + bh - 4, Y[6])     # the nose
    L.px(0.5, y0 + bh - 4, R['red'][5]); L.rect(w - 9, y0 + 0.5, 5, 2, K[1]); L.px(w - 8, y0 + 1, Y[5])  # line board
    px0 = sw + sw / 2.0                                                      # the pantograph
    L.line(px0 - 5, y0 - 1, px0, 1, I[2], t=TH); L.line(px0, 1, px0 + 4, y0 - 1, I[2], t=TH); L.hl(px0 - 4, 0.5, 8, I[3], t=TH)
    PAINTED['tram'] = (round(s, 2), w, bh)
    return L


def flag_far_b(c='red', s=SF):
    """A flag on a pole 8 m high at the far scale."""
    I = R['iron']; C = R[c]
    h = int(round(m_px(8, s)))
    L = Layer(10, h)
    L.vl(1, 0, h, I[3]); L.px(1, 0, R['yellow'][5])
    fw, fh = 8, 15
    L.rect(2, 2, fw, fh, C[4]); L.vl(2, 2, fh, C[5]); L.vl(fw + 1, 2, fh, C[2]); L.hl(2, fh + 1, fw, C[2])
    for yy in (5, 9, 13):
        L.hl(4, yy, 4, R['white'][5], t=TH)
    return L


YH_FAR = 127                    # the foot of the far side (l1b.YH)
SM = 0.18                       # the museum's own plane: 150-250 m across the square, between the skyline and the far side


class Scaled:
    """A drawing proxy: coordinates in design units (px at speed 0.40), drawn on L at f px per unit. Line widths stay in
       px; a box keeps at least one real pixel."""

    def __init__(s, L, f):
        s.L, s.f = L, f

    def rect(s, x, y, w, h, c):
        f = s.f; s.L.rect(x * f, y * f, max(w * f, D1), max(h * f, D1), c)

    def hl(s, x, y, n, c, t=1):
        s.L.hl(x * s.f, y * s.f, max(n * s.f, D1), c, t)

    def vl(s, x, y, n, c, t=1):
        s.L.vl(x * s.f, y * s.f, max(n * s.f, D1), c, t)

    def px(s, x, y, c):
        s.L.px(x * s.f, y * s.f, c)

    def line(s, x0, y0, x1, y1, c, t=1):
        f = s.f; s.L.line(x0 * f, y0 * f, x1 * f, y1 * f, c, t)

    def poly(s, pts, c):
        s.L.poly([(a * s.f, b * s.f) for (a, b) in pts], c)

    def ellipse(s, cx, cy, rx, ry, c):
        f = s.f; s.L.ellipse(cx * f, cy * f, max(rx * f, 0.6 * D1), max(ry * f, 0.6 * D1), c)

    def ring(s, cx, cy, r, c, r_in=None):
        f = s.f; s.L.ring(cx * f, cy * f, r * f, c, None if r_in is None else r_in * f)


def museum_back(s=SM, seed=9):
    """The museum's back across the square, at the scenery scale of its own plane (13 s px per metre: at s 0.18 a
       storey 7 px): an own impression in the Dutch neo-renaissance manner. Corner pavilions, long wings, two towers
       and the gabled centre with the passage arches. Ground floor, the tall main floor with paired arched windows
       between pilasters, the tile frieze, the upper floor, the cornice, the slate roof with dormers (ridge 30 m),
       the towers (60 m) with clocks, belfries and slate spires with gold vanes. Designed in units of the 0.40 plane
       (5.2 px per metre) and drawn at f = s / 0.40; details under a pixel are left out. The ground line is the lower
       edge."""
    B = R['brick_red']; S = R['stone']; T = R['plaster']; G = R['glass']; RT = R['roof_slate']; Y = R['yellow']
    I = R['iron']; O = R['brick_ochre']; K = R['black']; Bl = R['blue']; Rd = R['red']
    f = s / 0.40
    PV, WG, TW, CT = 64, 170, 48, 96
    WU = 2 * (PV + WG + TW) + CT
    HU = 330
    L = Layer(int(math.ceil(WU * f)) + 1, int(math.ceil(HU * f)) + 1)
    Z = Scaled(L, f)
    z = lambda v: v * f
    hy = lambda h: HU - h                                                       # units above the ground -> unit y
    rng = random.Random(seed)
    GF, MAIN, FRZ, UP, ATT, CORN = 22, 58, 66, 84, 88, 94
    RIDGE, TOWER = 156, 312                                                     # 30 m and 60 m at 5.2 px per metre
    step = lambda px_: px_ / f                                                  # a spacing in real px -> units

    def wall(x, w, top, sd):
        brickfill(L, z(x), z(hy(top)), z(w), z(top), B, sd, streaks=True)
        for yy in np.arange(step(2.0), GF, step(2.0)):
            Z.hl(x, hy(yy), w, S[5], t=TH)
        Z.rect(x, hy(3), w, 3, S[3]); Z.hl(x, hy(GF + 2), w, S[6])
        for yy in np.arange(GF + step(3.0), MAIN - 2, step(3.0)):
            Z.hl(x, hy(yy), w, S[5], t=TH)

    def frieze(x, w):
        y0, h = hy(FRZ - 1), FRZ - MAIN - 2
        xx, yy = grid(z(x), z(y0), z(w), max(z(h), 1))
        hh = hs(xx * 2, yy, seed + 5)
        rgb = np.array(O, np.uint8)[np.full(xx.shape, 5) - (hh > 0.70)]
        rgb[hh < 0.12] = Bl[4]; rgb[(hh > 0.12) & (hh < 0.20)] = Rd[4]
        L.put(z(x), z(y0), rgb, np.ones(xx.shape, bool))
        Z.hl(x, hy(MAIN + 1), w, S[6]); Z.hl(x, hy(FRZ), w, S[6])

    def upper_and_cornice(x, w, top=CORN):
        Z.rect(x, hy(ATT), w, ATT - UP, B[2])
        Z.rect(x - 1, hy(top), w + 2, top - ATT, S[5]); Z.hl(x - 1, hy(top), w + 2, S[6]); Z.hl(x - 1, hy(ATT + 1), w + 2, S[2], t=TH)

    def arch(x, y0, w, h, glass=G, glint=False):                               # an arched window in units, drawn by the kit
        arch_win(L, z(x), z(hy(y0 + h)), max(z(w), 2 * D1), z(h), S, glass, mull=z(w) >= 3, glint=glint)

    def paired(cx, y0, h, w=5, gap=3, glint=False):
        for wx in (cx - gap / 2.0 - w, cx + gap / 2.0):
            arch(wx, y0, w, h, glint=glint and wx < cx)
        Z.hl(cx - gap / 2.0 - w - 1, hy(y0 + 0.5), 2 * w + gap + 2, S[6], t=TH)

    def sash(cx, y0, h, w=4):
        Z.rect(cx - w / 2.0 - 0.5, hy(y0 + h + 0.5), w + 1, h + 1, S[5])
        Z.rect(cx - w / 2.0, hy(y0 + h), w, h, G[1]); Z.hl(cx - w / 2.0, hy(y0 + h), w, G[0], t=TH)

    def pilaster(px_, y0=GF + 2, y1=MAIN, w=3):
        Z.rect(px_, hy(y1), w, y1 - y0, B[4]); Z.vl(px_, hy(y1), y1 - y0, B[5], t=TH)
        Z.rect(px_ - 0.5, hy(y1), w + 1, 1.5, S[6])

    def roof_plane(x, w, h0, h1, sd):
        xx, yy = grid(z(x), z(hy(h1)), z(w), z(h1 - h0))
        rowi = np.floor(yy * DET + 1e-6).astype(int)
        n = hs(xx / 2.0, yy, sd)
        idx = np.where(rowi % 2 == 0, 2, 3) + (n > 0.88).astype(int) - (n < 0.10).astype(int)
        idx = idx + (fbm(xx / 14.0, yy / 4.0, sd + 1, 2) > 0.62).astype(int)
        L.put(z(x), z(hy(h1)), np.array(RT, np.uint8)[np.clip(idx, 1, 5)], np.ones(xx.shape, bool))
        Z.hl(x, hy(h0 + 1), w, RT[1], t=TH)

    def dormer(cx, base, w=9, hh=11):
        x = cx - w / 2.0
        Z.rect(x, hy(base + hh), w, hh, S[5]); Z.vl(x + w - 1, hy(base + hh), hh, S[3], t=TH)
        Z.poly([(x - 1, hy(base + hh)), (cx, hy(base + hh + 5)), (x + w + 1, hy(base + hh))], S[5])
        Z.rect(cx - 2.5, hy(base + hh - 2), 5, hh - 4, G[0])

    def chimney(x, base, hh=16):
        Z.rect(x, hy(base + hh), 6, hh, B[3]); Z.vl(x, hy(base + hh), hh, B[5], t=TH)
        Z.hl(x - 1, hy(base + hh), 8, S[6])

    def spire(cx, base, hgt, hw, tip_ball=True):
        t_ = lambda y: min(1.0, max(0.0, (y - z(hy(base + hgt))) / z(hgt))) ** 1.3
        rows_fill(L, z(hy(base + hgt)), z(hy(base)), lambda y: z(cx) - z(hw) * t_(y) - D1, lambda y: z(cx) + z(hw) * t_(y) + D1,
                  slate(L, RT))
        if tip_ball:
            Z.vl(cx - 0.5, hy(base + hgt + 8), 8, Y[4], t=TH); Z.ellipse(cx, hy(base + hgt + 2), 1.8, 1.8, Y[5])

    def turret(cx, base, hh=14, w=6, cone=14):
        x = cx - w / 2.0
        Z.rect(x, hy(base + hh), w, hh, B[4]); Z.vl(x, hy(base + hh), hh, B[5], t=TH)
        Z.hl(x - 0.5, hy(base + hh), w + 1, S[6], t=TH)
        spire(cx, base + hh, cone, w / 2.0 + 0.5, tip_ball=False)
        Z.vl(cx - 0.5, hy(base + hh + cone + 3), 3, Y[4], t=TH)

    def wing(x, w, sd):
        wall(x, w, CORN, sd)
        frieze(x, w)
        n = int(round(w / 28.0))
        bw = w / float(n)
        for i in range(n + 1):
            pilaster(q(x + i * bw) - 1 if i < n else q(x + w) - 3)
        for i in range(n):
            cx = x + (i + 0.5) * bw
            paired(cx, GF + 6, 27, glint=rng.random() < 0.4)
            for wx in (cx - 5, cx + 5):
                Z.rect(wx - 2.5, hy(16), 5, 11, S[5]); Z.rect(wx - 2, hy(15.5), 4, 10, G[1])
                sash(wx, FRZ + 4, 12)
        upper_and_cornice(x, w)
        roof_plane(x, w, CORN, RIDGE, sd + 3)
        Z.hl(x, hy(RIDGE), w, RT[5], t=TH)
        for cx in np.arange(x + 2, x + w - 1, step(1.5)):                       # iron cresting on the ridge
            Z.vl(cx, hy(RIDGE + 4), 4, I[2], t=TH)
        for i in range(n):
            dormer(x + (i + 0.5) * bw, CORN + 4)
            if i % 2 == 1:
                dormer(x + (i + 0.5) * bw, CORN + 30, 6, 8)
        for cxx in (x + w * 0.28, x + w * 0.72):
            chimney(cxx, CORN + 34)

    def pavilion(x, w, sd):
        top = CORN + 8
        wall(x, w, top, sd)
        frieze(x, w)
        for yy in np.arange(hy(top - 2), hy(4), step(2.0) * 2):                  # corner stones
            Z.rect(x, yy, 3, step(1.0), S[5]); Z.rect(x + w - 3, yy, 3, step(1.0), S[4])
        for cx in (x + w * 0.27, x + w * 0.73):
            paired(cx, GF + 6, 27)
            for wx in (cx - 5, cx + 5):
                Z.rect(wx - 2.5, hy(16), 5, 11, S[5]); Z.rect(wx - 2, hy(15.5), 4, 10, G[1])
                sash(wx, FRZ + 4, 12)
        upper_and_cornice(x, w, top)
        top2 = top + 72
        rows_fill(L, z(hy(top2)), z(hy(top)), lambda y: z(x - 1) + (z(hy(top)) - y) / z(top2 - top) * z(18),
                  lambda y: z(x + w + 1) - (z(hy(top)) - y) / z(top2 - top) * z(18), slate(L, RT))
        for cx in np.arange(x + 19, x + w - 18, step(1.5)):
            Z.vl(cx, hy(top2 + 4), 4, I[2], t=TH)
        dormer(x + w / 2.0, top + 4, 12, 15)
        turret(x + 2, top - 6); turret(x + w - 2, top - 6)

    def tower(x, w, sd):
        top = 176                                                                # the shaft (34 m), then the spire to 60 m
        wall(x, w, top, sd)
        for yy in np.arange(hy(top - 2), hy(4), step(2.0) * 2):                  # quoins
            Z.rect(x, yy, 4, step(1.0), S[5]); Z.rect(x + w - 4, yy, 4, step(1.0), S[4])
        Z.vl(x, hy(top), top, B[5], t=TH); Z.vl(x + w - 1, hy(top), top, B[1], t=TH)
        cx = x + w / 2.0
        arch(cx - 5, 2, 10, 18, glass=K)                                          # the doorway, in shade
        for wx in (cx - 7, cx + 3):
            arch(wx, GF + 6, 4, 27, glint=wx < cx)
            arch(wx, FRZ + 3, 4, 13)
        frieze(x, w)
        upper_and_cornice(x, w)
        cy = CORN + 14                                                           # the clock
        Z.ellipse(cx, hy(cy), 9, 9, Y[3]); Z.ellipse(cx, hy(cy), 7.5, 7.5, R['white'][6])
        Z.line(cx, hy(cy), cx, hy(cy + 5), K[1], t=TH); Z.line(cx, hy(cy), cx + 3.5, hy(cy - 1), K[1], t=TH)
        Z.hl(x - 1, hy(CORN + 26), w + 2, S[6])
        for wx in (cx - 9, cx + 2):                                              # the belfry
            arch(wx, CORN + 30, 7, 28, glass=K)
            for yy in np.arange(hy(CORN + 50), hy(CORN + 31), step(1.0) * 2):
                Z.hl(wx + 1, yy, 5, S[2], t=TH)
        Z.rect(x - 2, hy(top + 4), w + 4, 4, S[6])                               # the balustrade
        for bx in np.arange(x - 1, x + w + 1, step(1.0) * 2):
            Z.vl(bx, hy(top + 10), 6, S[5], t=TH)
        Z.hl(x - 2, hy(top + 10), w + 4, S[6])
        for px_ in (x + 2, x + w - 2):                                           # corner pinnacles
            Z.rect(px_ - 2.5, hy(top + 22), 5, 12, S[5])
            spire(px_, top + 22, 14, 3.0, tip_ball=False)
        spire(cx, top + 4, TOWER - top - 14, w / 2.0 - 4)                        # the slate spire, gold ball and vane
        Z.rect(cx - 3, hy(top + 40), 6, 12, S[5]); Z.rect(cx - 2, hy(top + 38), 4, 8, G[0])                 # a lucarne
        Z.poly([(cx, hy(TOWER)), (cx + 7, hy(TOWER - 2)), (cx, hy(TOWER - 4))], Y[4])

    def opening(x, w, h):
        r = w / 2.0
        Z.ellipse(x + r, hy(h - r), r + 2, r + 2, S[5]); Z.rect(x - 2, hy(h - r), w + 4, h - r, S[5])
        Z.ellipse(x + r, hy(h - r), r, r, K[1]); Z.rect(x, hy(h - r), w, h - r, K[1])
        w2 = w * 0.50; h2 = h * 0.52; r2 = w2 / 2.0                              # the far end of the passage, in daylight
        Z.ellipse(x + r, hy(h2 - r2), r2, r2, T[3]); Z.rect(x + r - r2, hy(h2 - r2), w2, h2 - r2, T[3])

    def centre(x, w, sd):
        top = 104
        wall(x, w, top, sd)
        cx = x + w / 2.0
        opening(cx - 12, 24, 38); opening(x + 6, 16, 30); opening(x + w - 22, 16, 30)
        Z.rect(x, hy(42), w, 2, S[6])
        for xx_ in np.arange(x + 1, x + w - 1, step(1.0) * 2):                  # a balustrade
            Z.vl(xx_, hy(48), 5, S[5], t=TH)
        Z.hl(x, hy(48), w, S[6])
        for i in range(4):
            arch(x + 10 + i * 22, 52, 8, 30, glint=i in (1, 3))
        Z.rect(x, hy(86), w, 2, S[6])
        px0, pw = x + 12, w - 24                                                # the large tile tableau
        xx, yy = grid(z(px0), z(hy(102)), z(pw), z(14))
        hh = hs(xx, yy, sd + 9)
        rgb = np.array(O, np.uint8)[np.where(hh > 0.6, 4, 5)]
        rgb[hh < 0.12] = Bl[3]; rgb[(hh > 0.12) & (hh < 0.20)] = Rd[4]
        L.put(z(px0), z(hy(102)), rgb, np.ones(xx.shape, bool))
        Z.rect(x - 1, hy(top), w + 2, 3, S[6])
        n = 7                                                                   # the stepped gable
        sh = 14.0
        for kk in range(n):
            hw = w / 2.0 - (w / 2.0 - 8) * kk / (n - 1)
            y0, y1 = hy(top + (kk + 1) * sh), hy(top + kk * sh)
            brickfill(L, z(cx - hw), z(y0), z(2 * hw), z(y1 - y0), B, sd + 4 + kk)
            Z.vl(cx - hw, y0, y1 - y0, B[5], t=TH); Z.vl(cx + hw - 0.5, y0, y1 - y0, B[1], t=TH)
            Z.rect(cx - hw - 1, y0, 2 * hw + 2, 2, S[6])
            Z.ellipse(cx - hw, y0 - 1.5, 1.8, 1.8, S[5]); Z.ellipse(cx + hw, y0 - 1.5, 1.8, 1.8, S[5])
        Z.ring(cx, hy(top + 16), 9, S[6], 6.5); Z.ellipse(cx, hy(top + 16), 6.5, 6.5, G[1])     # the rose window
        Z.rect(cx - 4, hy(top + 44), 8, 14, S[3]); Z.rect(cx - 3, hy(top + 43), 6, 12, S[5])   # a figure in its niche
        Z.vl(cx - 0.5, hy(top + n * sh + 10), 10, Y[4], t=TH); Z.ellipse(cx, hy(top + n * sh + 4), 2, 2, Y[5])
        turret(x + 3, top - 8); turret(x + w - 3, top - 8)

    x = 0
    pavilion(x, PV, seed); x += PV
    wing(x, WG, seed + 10); x += WG
    xt1 = x; x += TW
    centre(x, CT, seed + 20); x += CT
    xt2 = x; x += TW
    wing(x, WG, seed + 30); x += WG
    pavilion(x, PV, seed + 40)
    tower(xt1, TW, seed + 50); tower(xt2, TW, seed + 60)
    L.h_ground = HU * f
    PAINTED['back'] = dict(s=s, gf=GF * f, storeys=[(MAIN - GF - 2) / 2.0 * f, (UP - FRZ) * f], win_w=5 * f, eaves=CORN * f,
                           ridge=RIDGE * f, tower=TOWER * f, width=WU * f)
    return L


def museum_plane(sec, M, foot, air, seed=33):
    """The museum's own layer at SM: the building over the pool, a strip of its garden at its foot across the whole
       width, rows of trees (16 m) on both sides and low far roofs (storey 7) behind them, so no gap opens between the
       skyline and the far side at any camera."""
    W = sec.lw(SM)
    Lm = Layer(W, VIEW_H)
    rng = random.Random(seed)
    far_roofs_b(Lm, 0, W, foot - 1, rng, s=SM, nmin=3, nmax=4, tag='museum_roofs')
    mx = sec.at(1490, SM) - M.w / 2.0
    th = int(round(m_px(16, SM)))
    tree_band(Lm, 0, W, foot + 1, th, 'leaf', seed + 1)
    Lm.clear(mx - 4, 0, M.w + 8, foot - 2)                                     # the museum stands free of the trees
    Lm.blit(M, mx, foot - M.h + 1)
    GR = R['grass']
    xx, yy = grid(0, foot, W, YH_FAR + 1 - foot)
    rgb = np.array(GR, np.uint8)[np.clip(3 + (hs(xx, yy, seed + 3) > 0.7).astype(int) - (fbm(xx / 9.0, yy, seed + 4, 2) < 0.4).astype(int), 1, 5)]
    Lm.put(0, foot, rgb, np.ones(xx.shape, bool))
    Lm.hl(mx - 2, foot, M.w + 4, R['gravel'][4], t=TH)
    Lm.recolor(grader(key=sec.KEY, air=(sec.AIR[0], sec.AIR[1], air, 0.4)))
    sec.add('museum', Lm, SM)
    PAINTED['museum_plane'] = dict(s=SM, foot=foot, air=air, trees=th, x=mx)
    return Lm


def far_plein(sec, rng, WF, YH, YQ, MX, MW, KEY, AIR, air_g=0.30, air_v=0.56, **_):
    """The far side over the lawn, in one layer at the far speed (s 0.40, the scenery scale: a storey 16 px, a tree
       16 m = 80 px, a lamp 5 m, a car 4.3 m, a tram 30 m): the open end of the square (MX..MX + MW: a low hedge,
       lamps, benches, flags; the museum stands behind it on its own plane), villas and town houses on both sides,
       plane trees, a tram on its street. Returns the layer."""
    s = SF
    F = Layer(WF, VIEW_H)
    V = Layer(WF, VIEW_H)
    sc = 2 * s
    gf, st = q_(27 * sc), 20.0 * sc
    vk = dict(sc=sc, hmin=gf + q_(3 * st) + 3, hmax=gf + q_(4 * st) + 3, wmin=q_(60 * s), wmax=q_(92 * s),
              kinds=['cornice', 'cornice', 'bell', 'neck', 'step'], shops=0)
    PAINTED['villas'] = dict(s=s, sc=sc, storey=st, gf=gf, hmin=vk['hmin'], hmax=vk['hmax'], wmin=vk['wmin'], wmax=vk['wmax'])
    rows = [house_row(V, 0, MX - 6, YH - 1, rng, seed=100, **vk), house_row(V, MX + MW + 6, WF, YH - 1, rng, seed=300, **vk)]
    PAINTED['villas']['rows'] = [[(i['x'], i['w']) for i in r] for r in rows]          # (left edge, width) on the plane
    V.recolor(grader(key=KEY, air=(AIR[0], AIR[1], air_v, 0.4)))
    F.blit(V, 0, 0)
    Gd = Layer(WF, VIEW_H)
    GR = R['grass']; GV = R['gravel']; St = R['stone']; Gn = R['green']; I = R['iron']; PG = R['pave_grey']
    cxm = MX + MW // 2
    xx, yy = grid(0, YH, WF, YQ - YH)
    n = fbm(xx / 11.0, yy / 2.0, 61, 2); bl = hs(xx, yy, 62)
    idx = 3 + (n > 0.60).astype(int) - (n < 0.40).astype(int) + (bl > 0.92).astype(int)
    rgb = np.array(GR, np.uint8)[np.clip(idx, 1, 5)]
    path = (yy >= YH + 2) & (yy < YH + 3.5)
    path |= (np.abs(xx - cxm) < 15) & (yy < YH + 2)
    rgb[path] = np.array(GV, np.uint8)[np.where(hs(xx, yy, 63) > 0.7, 5, 4)][path]
    street = (xx < MX - 6) | (xx > MX + MW + 6)                               # the streets beside the museum garden
    srgb = np.array(PG, np.uint8)[np.where(hs(xx, yy, 64) > 0.8, 2, 3)]
    srgb[(yy >= YH + 1.5) & (yy < YH + 1.5 + TH)] = PG[5]
    srgb[(yy >= YH + 3) & (yy < YH + 3 + TH)] = PG[5]
    rgb[street] = srgb[street]
    Gd.put(0, YH, rgb, np.ones(xx.shape, bool))
    Gd.hl(0, YH, WF, GR[1])
    x = MX - 2                                                                  # a low hedge (1 m) at the foot of the museum
    while x < MX + MW + 2:
        if abs(x - cxm) > 17:
            Gd.rect(x, YH - 5, 2, 5, Gn[3]); Gd.px(x, YH - 5, Gn[5]); Gd.px(x + 1, YH - 4, Gn[1]); Gd.px(x + 1, YH - 2, Gn[2])
            if (x - MX) % 8 == 0:
                Gd.vl(x, YH - 7, 7, I[2], t=TH)
        x += 2
    lh = int(round(m_px(5, s)))
    for lx in range(30, WF, 70):
        if abs(lx - cxm) > 20:
            Gd.blit(lamp_far(lh), lx, YH + 4 - lh)
    for bx in (MX + 70, MX + 170, MX + 262, MX + 392, MX + 486, MX + 584):
        Gd.blit(bench_far(), bx, YH - 1)
    for bx in (MX - 30, MX + 120, MX + 520, 60, 260, WF - 200):
        Gd.blit(bike_far(rng), bx, YH - 3)
    for (fx, c) in ((cxm - 28, 'red'), (cxm + 20, 'blue')):
        fl = flag_far_b(c)
        Gd.blit(fl, fx, YH + 2 - fl.h)
    cx_ = 20
    cars = []
    while cx_ < WF - 30:
        if (cx_ < MX - 40 or cx_ > MX + MW + 10) and rng.random() < 0.45:
            c = car_far(rng); Gd.blit(c, cx_, YH + 3 - c.h + 1); cars.append(c.w); cx_ += c.w + rng.randint(6, 30)
        else:
            cx_ += rng.randint(16, 40)
    tr = tram_far(s); TX = MX + MW + 40
    Gd.rect(TX - 40, YH + 2, tr.w + 80, TH, I[1])                               # the rails
    Gd.blit(tr, TX, YH + 3 - tr.h)
    wy = YH + 3 - tr.h + 0.5                                                    # the overhead wire and its poles
    Gd.hl(TX - 60, wy, tr.w + 120, I[1], t=TH)
    for px_ in (TX - 50, TX + tr.w + 50):
        Gd.vl(px_, wy - 2, YH + 3 - wy + 2, I[2], t=TH); Gd.hl(px_ - 2, wy - 2, 4, I[2], t=TH)
    tl = []
    th_m = []
    for (tx, cw, ch, th) in ((MX - 56, 60, 56, 30), (MX + 6, 54, 52, 30), (MX + MW - 8, 56, 54, 30), (MX + MW + 52, 62, 58, 32),
                             (150, 58, 54, 30), (320, 60, 56, 30), (WF - 270, 58, 54, 30), (WF - 110, 62, 58, 32)):
        t = tree_far(rng, cw, ch, th, seed=rng.randint(1, 999), leaf='leaf', tw=4)
        tl.append((t, tx - t.w // 2, YH + 3 - t.h)); th_m.append(t.h)
    for (t, x, y) in tl:
        Gd.blit(t, x, y)
    Gd.recolor(grader(key=KEY, air=(AIR[0], AIR[1], air_g, 0.3)))
    F.blit(Gd, 0, 0)
    F.clear(0, YQ, F.w, F.h)
    PAINTED['far_things'] = dict(s=s, trees=(min(th_m), max(th_m)), lamp=lh, cars=(min(cars), max(cars)) if cars else None)
    return F


# ---------------------------------------------------------------- the skyline at the scenery scale (s 0.10)
def far_roofs_b(L, x0, x1, yb, rng, s=0.10, nmin=3, nmax=5, tag='skyline'):
    """A band of small far house fronts (the kit's far_roofs) at the scenery scale of the skyline: a storey 40 s,
       fronts 60 s to 92 s wide; flat tones, a row of window dots per storey."""
    st = 40.0 * s; gf = q_(1.35 * st)
    x = x0
    fronts = []
    while x < x1:
        w = rng.randint(q_(60 * s), q_(92 * s)); h = gf + q_(rng.randint(nmin, nmax) * st)
        fronts.append((x, w))
        B = R[rng.choice(BRICKS)]
        L.rect(x, yb - h, w, h, B[3]); L.vl(x, yb - h, h, B[4]); L.vl(x + w - 1, yb - h, h, B[2])
        k = rng.choice(['tri', 'step', 'flat'])
        if k == 'tri':
            for i in sub(0, w // 2):
                L.rect(x + w // 2 - i, yb - h - (w // 2 - i), 2 * i + (w % 2), D1, B[3]); L.rect(x + w // 2 - i, yb - h - (w // 2 - i), 1, D1, R['plaster'][5])
        elif k == 'step':
            L.rect(x + 1, yb - h - 2, w - 2, 2, B[3]); L.rect(x + 3, yb - h - 4, max(1, w - 6), 2, B[3]); L.hl(x + 1, yb - h - 2, w - 2, R['plaster'][5])
        else:
            L.hl(x, yb - h, w, R['plaster'][5]); L.rect(x + 1, yb - h - 2, w - 2, 2, R['roof_slate'][3])
        for wy in np.arange(yb - h + 2, yb - gf, st):
            for wx in range(x + 2, x + w - 1, 3):
                L.vl(wx, wy, 2, R['glass'][1])
        x += w
    PAINTED[tag] = dict(s=s, storey=st, gf=gf, rows=[fronts])


def skyline_b(sec, speed=0.10, yb=116, extra=None, seed=5, air=0.74):
    """level.skyline_layer with the skyline's house fronts at the scenery scale (far_roofs_b)."""
    W1 = sec.lw(speed)
    SK = Layer(W1, VIEW_H)
    far_roofs_b(SK, 0, W1, yb, random.Random(seed), speed)
    if extra:
        extra(SK)
    SK.recolor(grader(key=sec.KEY, air=(sec.AIR[0], sec.AIR[1], air, 0.5)))
    sec.add('skyline', SK, speed)
    return SK


def lawn_rows(sec, y0, y1, s0, s1, KEY, AIR, curv, plein=(SB.SQ0, SB.PATH1), paths=((1206, 1226), (1880, 1900)),
              beds=((880, 1110), (1930, 2150))):
    """The lawn between the far side and the floor's back edge: rows from the far speed to the floor's, each painted
       in world space (mowing stripes, gravel paths that run on into the floor, tulip beds); in the streets beside
       the plein a grey pavement. The air grows toward the far side."""
    GR = np.array(R['grass'], np.uint8); GV = np.array(R['gravel'], np.uint8); PG = np.array(R['pave_grey'], np.uint8)
    nr = P(y1 - y0)
    Wl = sec.lw(s1)
    out = Layer(Wl, y1 - y0)
    sp = s0 + (s1 - s0) * np.arange(nr) / max(nr - 1, 1)
    ps = (np.arange(out.pw) + 0.5) / U
    u = 192 + (ps[None, :] - 192) / sp[:, None]
    t = np.broadcast_to((np.arange(nr) / max(nr - 1, 1))[:, None], u.shape)
    vv = np.broadcast_to((np.arange(nr) / U)[:, None], u.shape)
    stripe = (np.floor(u / 36.0) % 2 == 0)
    n = fbm(u / 14.0, vv / 2.0, 91, 2)
    g = hash01(u * 2, vv * 3, 92)
    idx = 3 + stripe.astype(int) + (n > 0.64) - (n < 0.34) + (g > 0.93) - (g < 0.05) + (t > 0.6)
    rgb = GR[np.clip(idx, 1, 6)]
    pm = np.zeros(u.shape, bool)
    for (a, b) in paths:
        pm |= (u >= a) & (u < b)
    pm |= t < 0.12                                                             # the promenade along the far garden
    rgb[pm] = GV[np.clip(4 + (g[pm] > 0.8) - (g[pm] < 0.15), 0, 6)]
    for (a, b) in beds:                                                        # tulip beds in rows
        bm = (u >= a) & (u < b) & (t > 0.42) & (t < 0.62)
        cols = np.array([R['red'][4], R['yellow'][5], R['red'][5], PINK[4], R['white'][6]], np.uint8)
        k = (np.floor((u - a) / 26.0) % 5).astype(int)
        dots = bm & (hash01(np.floor(u * 1.5), np.floor(vv * 2), 93) > 0.35)
        rgb[bm] = GR[2]
        rgb[dots] = cols[k[dots]]
    st = (u < plein[0]) | (u >= plein[1])
    rgb[st] = PG[np.clip(3 + (hash01(np.floor(u / 8), np.floor(vv * 1.5), 94) > 0.7) - (hash01(u, vv, 95) > 0.9), 0, 6)][st]
    out.a[..., :3] = rgb; out.a[..., 3] = 255
    # the grade per row: the key, the air toward the far side, the curve of the floor
    for j in range(nr):
        tj = j / max(nr - 1, 1)
        a = 0.16 + 0.22 * (1 - tj) ** 1.3
        row = out.a[j:j + 1]
        cols = row[..., :3].reshape(-1, 3)
        uq, inv = np.unique(cols, axis=0, return_inverse=True)
        o = grader(key=KEY, air=(AIR[0], AIR[1], a, 0.3))(uq.astype(float))
        o = curve(*curv)(np.asarray(o, float))
        row[..., :3] = np.asarray(o, np.uint8)[inv.reshape(-1)].reshape(row.shape[:2] + (3,))
    return out


# ---------------------------------------------------------------- the floor additions of the section
POOL = (1243, 1737, 14.0, 25.0)        # the pool's water: u range, near and far depth (inside the granite rim)
RIM = (1240, 1740, 13.0, 26.0)


def pool_skin(u, d, v):
    """The opaque skin of the still pool (the rest of the water is clear: the mirror shows through): light and dark
       ripple lenses, the shade of the far rim. Returns (mask, rgb-tone kind) as two masks."""
    p = fbm(u / 16.0, v / 1.6, 111, 2)
    p2 = vnoise(u / 6.0, v / 1.1, 117)
    light = (p > 0.66) & (p2 > 0.56)
    dark = (p < 0.30) & (p2 < 0.44)
    shade = d > POOL[3] - 1.2
    return light, dark, shade


def floor_extra(sec):
    fl = sec.fl
    S = np.array(R['stone'], np.uint8); B = np.array(R['brick_brown'], np.uint8); W_ = np.array(R['white'], np.uint8)
    C = np.array(R['stone'], np.uint8)
    spal = sec.notes['spal']

    sq0, path0, path1, lane1 = SB.SQ0, SB.PATH0, SB.PATH1, SB.LANE1
    vF, vN = float(v_y(GY - SB.FAR)), float(v_y(GY - SB.NEAR))           # world depth of the two kerb lines

    def fn(u, d, v, rgb):
        dF = pl(fl['far'], u); dN = pl(fl['near'], u)
        # ---- the square's big pale stone tiles over its whole depth (level.py's 'tiles' branch indexes with floats,
        #      see l1b.py); the elm's lawn is painted on them below
        tm = (u >= sq0) & (u < path0)
        if tm.any():
            i, j = np.floor(u / 16.0), np.floor(v / 10.0)
            fu, fv = u / 16.0 - i, v / 10.0 - j
            t = 5 - (hash01(i, j, 51) > 0.7).astype(int) - (fbm(u / 40.0, v / 12.0, 52, 2) < 0.36).astype(int)
            t = t - ((fbm(u / 9.0, v / 4.0, 53, 2) < 0.30) & (hash01(u * 2, v * 2, 54) > 0.5)).astype(int)   # wear and stains
            t = np.where((fu < 0.05) | (fv < 0.08), 3, t)
            t = np.where((fv >= 0.08) & (fv < 0.16) & (fu >= 0.05), np.minimum(t + 1, 6), t)
            rgb[tm] = S[np.clip(t, 0, 6)][tm]
        # ---- the near kerb strip of granite setts along the near kerb, where the front post rows stand (the street
        #      through the passage and the canal road)
        strip = ((u < sq0) | (u >= lane1)) & (d < dN - 1.3) & (d > -24.8)
        if strip.any():
            j = np.floor(v / 3.0); uu = u / 4.0 + 0.5 * (j % 2); i = np.floor(uu)
            fu, fv = uu - i, v / 3.0 - j
            base = 4 + (hash01(i, j, 121) > 0.7) - (hash01(i, j, 122) > 0.8)
            t = np.where((fu < 0.12) | (fv < 0.14), 2, base)
            t = np.where((fu > 0.7) & (fv > 0.6), base - 1, t)
            rgb[strip] = C[np.clip(t, 0, 6)][strip]
            edge = strip & (d <= -24.0)
            rgb[edge] = S[3]
        # ---- thresholds: where the lane meets a square, a granite band straight across the street and white shark
        #      teeth on the lane side, their points toward the riders who give way
        street = (d < dF) & (d > dN)
        PR = np.array(R['pave_red'], np.uint8)
        for (uc, sg) in fl.get('thresholds') or []:
            if sg > 0:
                b0, b1, z0, z1 = uc - SB.THR, uc, uc - SB.THR - SB.TEETH, uc - SB.THR
            else:
                b0, b1, z0, z1 = uc, uc + SB.THR, uc + SB.THR, uc + SB.THR + SB.TEETH
            tz = street & (u >= z0) & (u < z1)
            if tz.any():
                g = hash01(u * 3, v * 3, 21); n = fbm(u / 30.0, v / 6.0, 22, 2)          # the lane, without its lines
                rgb[tz] = PR[np.clip(3 + (g > 0.86) - (g < 0.12) + (n > 0.64), 0, 6)][tz]
                tt = ((z1 - u) if sg > 0 else (u - z0)) / SB.TEETH                       # 0 at the base, 1 at the point
                k = (v - vF) / ((vN - vF) / 7.0)                                         # seven whole teeth across
                fr = np.abs(k % 1 - 0.5) * 2
                inner = (d < dF - 1.0) & (d > dN + 0.5)
                tooth = tz & inner & (fr < 0.80 * (1 - tt)) & (tt < 0.94)
                rgb[tooth] = W_[5]
                rgb[tooth & (fr > 0.80 * (1 - tt) - 0.16)] = W_[4]
            bm = street & (u >= b0) & (u < b1)
            if bm.any():
                jj = np.floor((v - vF) / 2.5); ii = np.floor((u - b0) / (SB.THR / 2.0))
                t = 5 + (hash01(ii, jj, 151) > 0.75) - (hash01(ii, jj, 152) > 0.8)
                fu_ = (u - b0) / (SB.THR / 2.0) - ii; fv_ = (v - vF) / 2.5 - jj
                t = np.where((fu_ < 0.14) | (fv_ < 0.14), 3, t)
                rgb[bm] = S[np.clip(t, 0, 6)][bm]
        # ---- the lawns in spring: mowing stripes, clover, daisies and dandelions (over the painter's plain grass)
        GRr = np.array(R['grass'], np.uint8); Yw = R['yellow']
        for a_ in fl.get('areas', []) or []:
            if a_['kind'] != 'grass':
                continue
            am = (u >= a_['u0']) & (u < a_['u1']) & (d <= pl(a_['far'], u)) & (d >= pl(a_['near'], u))
            if not am.any():
                continue
            g = hash01(u * 2, v * 2, 71); n = fbm(u / 9.0, v / 3.0, 72, 2)
            stripe = (np.floor((u + v * 0.15) / 30.0) % 2 == 0)
            t = 3 + stripe + (n > 0.6) - (n < 0.4) + (g > 0.92) - (g < 0.07)
            cl = fbm(u / 5.0, v / 2.0, 141, 2) > 0.68                               # clover patches
            t = np.where(cl & (hash01(u * 3, v * 3, 142) > 0.4), t - 1, t)
            col = GRr[np.clip(t, 1, 6)]
            fh = hash01(np.floor(u * DET), np.floor(v * DET * 0.7), 143)
            near_ = d < 0                                                           # flowers show where the lawn is near
            daisy = am & near_ & (fh > 0.9965)
            dand = am & near_ & (fh > 0.9945) & (fh <= 0.9965)
            col[daisy] = R['white'][6]; col[dand] = Yw[5]
            rgb[am] = col[am]
            if a_['u0'] >= path0:                                                    # a granite edging at the lawn's ends
                ee = am & ((u < a_['u0'] + 1.2) | (u >= a_['u1'] - 1.2))
                rgb[ee] = S[5]; rgb[ee & ((u < a_['u0'] + 0.4) | (u >= a_['u1'] - 0.4))] = S[6]
        # ---- the gravel paths across the back lawn (they come from the far zone's paths) down to the main path
        GV = np.array(R['gravel'], np.uint8)
        for a_ in fl.get('areas', []) or []:
            if a_['kind'] != 'gravel':
                continue
            gm = (u >= a_['u0']) & (u < a_['u1']) & (d <= pl(a_['far'], u)) & (d >= pl(a_['near'], u))
            if gm.any():
                g = hash01(u * 2, v * 2, 61); n = fbm(u / 20.0, v / 5.0, 62, 2)
                t = 4 + (g > 0.8) - (g < 0.18) - (n < 0.38)
                t = np.where((u < a_['u0'] + 0.8) | (u >= a_['u1'] - 0.8), np.minimum(t, 2), t)   # the grass edge's shade
                rgb[gm] = GV[np.clip(t, 0, 6)][gm]
        # ---- the small lawn by the elm: a stone edging round it
        a = (u >= 794) & (u < 848)
        e = a & (((d >= 7.4) & (d < 8.4)) | ((d > 12.0) & (d <= 13.0)) | ((d >= 7.4) & (d <= 13) & ((u < 795.2) | (u >= 846.8))))
        rgb[e] = S[5]
        # ---- the long pool: a granite rim, the water clear (the mirror layer shows through), its skin
        rim = (u >= RIM[0]) & (u < RIM[1]) & (d >= RIM[2]) & (d <= RIM[3])
        if rim.any():
            rgb[rim] = S[5]
            rgb[rim & (d >= RIM[3] - 0.6)] = S[6]
            rgb[rim & (d < RIM[2] + 0.5)] = S[3]
            rgb[rim & ((u % 18) < 0.5)] = S[3]
            pool = (u >= POOL[0]) & (u < POOL[1]) & (d > POOL[2]) & (d < POOL[3])
            light, dark, shade = pool_skin(u, d, v)
            far_c, near_c = (96, 150, 168), (52, 104, 124)
            tdep = np.clip((d - POOL[2]) / (POOL[3] - POOL[2]), 0, 1)[..., None]
            body = np.array(near_c, float) + (np.array(far_c, float) - np.array(near_c, float)) * tdep
            lc = snap5(body + (np.array(spal[13], float) - body) * 0.6)
            dc = snap5(body * 0.78)
            rgb[pool] = snap5(body)[pool]
            rgb[pool & light] = lc[pool & light]
            rgb[pool & dark] = dc[pool & dark]
            rgb[pool & shade] = S[2]
            rgb[pool & (d > POOL[3] - 0.5)] = S[1]
        # ---- the canal along the canal road, in front of it: the granite coping, the quay wall, the water
        c0 = fl.get('canal_front', 2192)
        cop = (u >= c0) & (d <= -25.4) & (d >= -27.0)
        rgb[cop] = S[5]; rgb[cop & (d > -25.9)] = S[6]; rgb[cop & ((u % 22) < 0.6)] = S[3]
        wall = (u >= c0) & (d < -27.0) & (d >= -29.6)
        if wall.any():
            jj = np.floor((d + 27) / -1.3); ii = np.floor(u / 5.0 + 0.5 * (jj % 2))
            rgb[wall] = B[np.clip(2 + (hash01(ii, jj, 131) > 0.7) - (hash01(ii, jj, 132) > 0.8), 0, 6)][wall]
            rgb[wall & (d > -27.5)] = B[1]
        wm = (u >= c0) & (d < -29.6)
        if wm.any():
            wc = floor_water(sec, u, d + 20, v)
            rgb[wm] = wc[wm]
            rgb[wm & (d > -30.6)] = snap5(wc[wm & (d > -30.6)].astype(float) * 0.7)
        endw = (u >= c0) & (u < c0 + 2.5) & (d < -25.4)
        rgb[endw] = B[2]; rgb[endw & (u < c0 + 0.8)] = S[5]
        # ---- the passage: the vault's shade on the floor under the roof (soft at both mouths and at the front edge)
        sh = sec.fl.get('shades') or []
        for s_ in sh:
            au = np.clip(np.minimum(u - s_['u0'], s_['u1'] - u) / s_['soft'] + 0.5, 0, 1)
            ad = np.clip((d - s_['near']) / s_['softNear'] + 0.5, 0, 1)
            a_ = np.minimum(au, ad)
            m = (a_ > 0.66) | ((a_ > 0.33) & chk(u, d))
            if m.any():
                f = 0.86 ** s_['tone'] * 0.9
                rgb[m] = snap5(rgb[m].astype(float) * np.array([f, f * 1.02, f * 1.16]))
    return fn


def pool_clear(sec, floor):
    """Make the pool's water clear in the floor layer (alpha 0) except its skin, so the mirror shows through."""
    r0, r1 = P(BACKY), P(VIEW_H)
    ys = (np.arange(r0, r1) + 0.5) / U
    sv = s_y(ys)
    dcol = GY - ys
    vcol = v_y(ys)
    rows = np.nonzero((dcol > POOL[2]) & (dcol < POOL[3]))[0]
    for j in rows:
        ps = (np.arange(floor.pw) + 0.5) / U
        u = 192 + (ps - 192) / sv[j]
        cols = np.nonzero((u >= POOL[0]) & (u < POOL[1]))[0]
        if len(cols) == 0:
            continue
        uu = u[cols]; d = np.full(uu.shape, dcol[j]); v = np.full(uu.shape, vcol[j])
        light, dark, shade = pool_skin(uu, d, v)
        clear = ~(light | dark | shade | (d > POOL[3] - 0.5))
        floor.a[j, cols[clear], 3] = 0


def preview_b(sec, cams, tag=None):
    """level.preview with more than four cameras (its hero frame index run[i * 3] runs out after four)."""
    run, idle = hero_frames()
    os.makedirs('out', exist_ok=True)
    tag = tag or sec.id
    for i, cx in enumerate(cams):
        save(compose_level(sec, cx, 0, run[(i * 3) % len(run)]), f'out/l1{tag}-{i}-u{U}.png', 1)
    save(compose_level(sec, cams[len(cams) // 2], 0, run[0], overlay=True), f'out/l1{tag}-layout-u{U}.png', 1)


def aired(part, AIR, depth, per=0.0050):
    """A copy of a part with the air of its depth on the floor (the decor planes behind the walk line)."""
    if depth <= 0:
        return part
    o = Layer(part.w, part.h); o.a = part.a.copy()
    o.recolor(grader(air=(AIR[0], AIR[1], per * depth, 0.3)))
    return o


def floor_air(sec, fl, a0, y1):
    """The air on the floor's back rows: a0 at the back edge (146), none from y1 on (it meets the lawn rows)."""
    r0 = P(BACKY)
    for j in range(P(y1) - r0):
        y = BACKY + (j + 0.5) / U
        a = a0 * max(0.0, (y1 - y) / (y1 - BACKY)) ** 1.2
        if a <= 0.004:
            continue
        row = fl.a[j:j + 1]
        cols = row[..., :3].reshape(-1, 3)
        uq, inv = np.unique(cols, axis=0, return_inverse=True)
        o = grader(air=(sec.AIR[0], sec.AIR[1], a, 0.3))(uq.astype(float))
        row[..., :3] = np.asarray(o, np.uint8)[inv.reshape(-1)].reshape(row.shape[:2] + (3,))
