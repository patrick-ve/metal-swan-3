# The parts of section a (sewers-a, DE WALLEN, 23:00, rain) that the shared street parts (parts_wallen.py) do not
# have, or have in a form this section needs changed. Wave P4b, painter A. Read only for the other painters.
#
#   krul_a          the green cast-iron curl urinal, redrawn so it reads as one: an open lace crest, the curl's lip
#                   and its inner leaf, no dark "lid"; light_krul grades it softer (a lamp stands by it) after the plane
#   quay_elm_a      the quay elm in late October: a high crown (about 6 m of clear trunk) that keeps the far ground
#                   floors and their neon free, thinned (bare twigs in the holes), half turned; lit from below later
#   quay_lamp_a     the canal lantern at the scale rule (4.4 m on the plane of its depth), dark and lit versions
#   far_quay_a      parts_wallen.far_quay_night with two changes: the storey counts (nst: a roofline with the night
#                   sky above it) and no neon word where a street thing of the far quay (a tree, a lamp) would cut it
#   bridges_a       parts_wallen.bridge_depth with two changes: several bridges share one layer per depth slice (half
#                   the layers), and the bridge has an arch over the canal (the side wall opens over the water)
#   tower_layer     the old church's tower on its own plane (speed 0.14, the scale rule), floodlit, the clock lit
#   neon_flicker    a frames layer over the far row: a few neon words go dark for one step (the flicker)
import math
import random
import numpy as np
from level import *
from parts4 import tint, s5
from parts_wallen import (R, RED, PINK, AMBER, CYAN, NEON, KEEP, HALO_W, HALO_S, BOARD, EM, wallen_row, light_fronts,
                          street_glow, limit_colours, church_tower, floodlight, tarp_boat, umbrella_far, bike_far,
                          far_street, tree_far, car_far_a, lamp_far, bollards_far, quay_wall, sloop, scale_px, FAR_TREE_N)


# darker leaf ramps for the night trees of a (the canal-look ramps grade to a pale grey mass under the rain key)
R['leaf_a_green'] = ramp(7, .13, .52, .030, .080, .090, 186, 136)
R['leaf_a_turn'] = ramp(7, .16, .60, .040, .090, .095, 52, 96)


# ---------------------------------------------------------------- the krul
def krul_a():
    """The green krul urinal of the canal quays (our own drawing of the type), 26 x 42 (the game's box, anchor bottom
       centre). A spiral screen of cast-iron plates on short legs: seen a little from above, the far half of the
       screen shows its lit inner face over the front rim (a ring, not a lid), an open lace crest runs round the top,
       the curl opens at the right: the outer plate ends in a rolled lip, the inner plate stands back in its shade.
       The centre post rises out of it with a ball finial. Daylight colours; light_krul gives it the night."""
    G = R['krul']; K = R['black']; I = R['iron']
    L = Layer(26, 42)
    cx, rx, ry = 12.5, 11.5, 3.0
    ytop, ybot = 12.0, 35.0
    # the centre post and its finial (it stands inside the screen: behind the front rim)
    L.rect(cx - 0.75, 2.5, 1.5, ytop, G[3]); L.vl(cx - 0.75, 2.5, ytop, G[5], t=TH)
    L.ellipse(cx, 2.0, 1.5, 1.5, G[4]); L.px(cx - 0.6, 1.0, G[6]); L.hl(cx - 1.6, 4.2, 3.2, G[2])
    L.hl(cx - 1.2, 6.0, 2.4, G[5], t=TH)
    # the far half of the screen: its crest standing over the far rim (lit inner face, lace openings); inside the
    # ring the floor in shade; the inner plate of the spiral curls in from the opening (its lit top edge inside the
    # ring): the curl, read from above
    for x in sub(cx - rx + 0.5, cx + rx - 0.5):
        nx = (x + 0.5 * D1 - cx) / rx
        yb = ytop - ry * math.sqrt(max(0.0, 1 - nx * nx))           # the far rim
        yf = ytop + ry * math.sqrt(max(0.0, 1 - nx * nx))           # the near rim
        L.rect(x, yb, D1, yf - yb, G[0])                            # the inside, in shade
        L.rect(x, yb - 2.2, D1, 2.6, G[2] if nx < 0.1 else G[3])    # the far crest's inner face
        L.rect(x, yb - 2.2, D1, D1, G[5])                           # its lit top edge
        if (int((x - 0.5) * DET) % 3) == 0:
            L.rect(x, yb - 1.4, D1, 1.0, K[1])                      # the far crest's lace openings
    for a in np.arange(0.95, -2.75, -0.5 / (rx * U)):               # the inner plate: a spiral arc from the opening
        rr = rx * (0.80 - 0.10 * (0.95 - a) / 3.7)
        x = cx + rr * math.cos(a)
        y = ytop + ry * (rr / rx) * math.sin(a)
        L.rect(x, y - 1.6, D1, 1.6, G[2])
        L.rect(x, y - 1.6, D1, D1, G[5] if math.cos(a) < 0.3 else G[4])
    L.rect(cx - 0.75, ytop - ry * 0.4, 1.5, ry * 0.4 + 0.6, G[3])     # the post's foot inside
    # the near half: a cylinder of plates lit from the upper left; the curl's opening at the right
    gap0, gap1 = 17.5, 20.5

    def rim(x):
        nx = max(-1.0, min(1.0, (x + 0.5 * D1 - cx) / rx))
        return ytop + ry * math.sqrt(1 - nx * nx), nx
    for x in sub(1, 25):
        yr, nx = rim(x)
        lit = math.cos(math.asin(nx) + 0.70)
        tone = int(np.clip(round(1.4 + 4.2 * max(0.0, lit)), 1, 5))
        if gap0 <= x < gap1:
            # the opening: the dark inside, the inner plate's edge in the shade, the floor's drain at the foot
            L.rect(x, yr - 2.2, D1, ybot - yr + 2.2, K[0])
            if x >= gap1 - 0.5:
                L.rect(x, yr + 1, D1, ybot - yr - 1, G[1])
            continue
        inner = x >= gap1
        t2 = max(1, tone - 1) if inner else tone
        y0 = yr - 2.2 + (1.2 if inner else 0.0)                     # the crest stands on the rim; the inner plate lower
        L.rect(x, y0, D1, ybot - y0, G[t2])
        # the crest: an open lace band (arches on a 3 px rhythm) with a beaded top edge
        bx = (x - 0.5) % 3.0
        if bx < 1.0 or (U > 1 and bx < 1.25):
            L.rect(x, y0 + 0.6, D1, 1.2, K[0])
        L.rect(x, y0, D1, D1, G[min(6, t2 + 2)])
        L.rect(x, y0 + 2.0, D1, D1, G[min(6, t2 + 1)])               # the rim under the crest
        L.rect(x, y0 + 2.0 + D1, D1, D1, G[max(0, t2 - 2)])
        # the pierced band under the rim: a row of small openings
        if (x - 1.5) % 3.0 < (1.0 if U == 1 else 0.75):
            L.rect(x, y0 + 4.0, D1, 1.0, K[1])
        L.rect(x, y0 + 5.6, D1, D1, G[max(0, t2 - 2)])
        L.rect(x, y0 + 5.6 + D1, D1, D1, G[min(6, t2 + 1)])
        # the skirt: a moulded band at the foot of the screen
        L.rect(x, ybot - 3, D1, 3, G[max(1, t2 - 1)]); L.rect(x, ybot - 3, D1, D1, G[min(6, t2 + 1)])
    # the outer plate's rolled lip at the opening (lit), standing a little proud of the screen
    yl = rim(gap0)[0] - 2.2
    L.rect(gap0 - 1.0, yl, 1.0, ybot - yl + 0.5, G[5]); L.vl(gap0 - 1.0, yl, ybot - yl + 0.5, G[6], t=TH)
    L.px(gap0 - 1.0, yl - 0.5, G[6])
    # the plates: vertical joints with bolt heads, a wet sheen on the lit side, rain running down
    for x in (4.5, 9.0, 14.0, 22.5):
        yr, _ = rim(x)
        L.vl(x, yr + 6.5, ybot - yr - 9.5, G[1], t=TH)
        for y in np.arange(yr + 8, ybot - 3, 4.0):
            L.px(x + (0.5 if U > 1 else 1), y, G[5] if x < 12 else G[3])
    r = random.Random(7)
    for i in range(7):
        x = r.uniform(2.0, 11.0)
        y0 = rim(x)[0] + r.uniform(6, 11)
        L.vl(x, y0, r.uniform(4, 10), G[6], t=TH)
    L.vl(3.5, rim(3.5)[0] + 6.5, 14, G[6], t=TH)
    # the legs, the gap under the screen (the drain grate in it), the shade
    L.rect(1.5, ybot, 23, 6, K[0])
    L.rect(7, 38.5, 11, 1.5, I[1])
    for x in np.arange(7.5, 18, 1.5):
        L.vl(x, 38.5, 1.5, K[0], t=TH)
    for x in (2.0, 7.5, 16.0, 22.5):
        L.rect(x, ybot, 1.5, 6, G[2]); L.vl(x, ybot, 6, G[4], t=TH); L.hl(x - 0.5, 40.5, 2.5, G[1], t=TH)
    L.hl(0, 41, 26, K[0])
    return L


def light_krul(sec, part, lamp_dx=-1.0):
    """The krul at night by its lamp: a softer key than the plane's (the green stays green), the lamp's warm light
       on its lit side, the neon's pink on its rim. Returns a graded copy (emitter-safe colours)."""
    L = Layer(part.w, part.h)
    L.a = part.a.copy()
    dark, light, amt, desat = sec.KEY
    L.recolor(grader(key=(dark, light, 0.46, 0.05)))
    L.recolor(curve(*sec.H['curve']))
    tint(L, part.w * (0.30 if lamp_dx < 0 else 0.70), 14, part.w * 0.50, 14, EM[2], 0.16, 0.08)
    L.a[..., :3] = snap5(L.a[..., :3])
    return L


# ---------------------------------------------------------------- the quay elm
def quay_elm_a(h, seed=520):
    """A quay elm in late October at the scale rule (h px for 15 m), anchor bottom centre. The crown is high: the
       lowest limbs start about 0.45 h up (a canal elm is pruned clear of the quay and the boats), so the far ground
       floors stay free under it. Thinned by the autumn: big holes with bare twigs in them, two leaf masses (the dark
       green and the turned yellow-brown), the trunk and its first limbs. Returns (Layer, crown bottom row)."""
    rng = random.Random(seed)
    w = int(round(h * 0.80))
    L = Layer(w, h)
    ch = int(round(h * 0.56))
    BK = R['bark']
    # the trunk: from the foot to the crown's middle
    tw = max(6, int(round(h * 0.055)))
    th = h - int(ch * 0.42)
    tr = trunk(rng, th, tw, seed=seed)
    L.blit(tr, w / 2.0 - tr.w / 2.0, h - th)
    # the limbs and twigs in the crown (seen in its holes)
    cxw = w / 2.0
    for (ang, ln, wd) in ((2.35, ch * 0.62, 2), (0.80, ch * 0.66, 2), (1.75, ch * 0.70, 1.5), (1.25, ch * 0.58, 1.5),
                          (2.75, ch * 0.44, 1), (0.40, ch * 0.42, 1)):
        x0, y0 = cxw + math.cos(ang) * 3, ch * 0.80
        x1, y1 = x0 + math.cos(ang) * ln, y0 - math.sin(ang) * ln
        L.line(x0, y0, x1, y1, BK[2], t=wd); L.line(x0 - 0.5, y0, x1 - 0.5, y1, BK[4], t=TH)
        for k in range(5):
            t = rng.uniform(0.35, 0.95)
            bx, by = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            a2 = ang + rng.choice((-1, 1)) * rng.uniform(0.4, 0.9)
            l2 = rng.uniform(6, 14)
            L.line(bx, by, bx + math.cos(a2) * l2, by - math.sin(a2) * l2, BK[2], t=TH)
    # two leaf masses: the green, then the turned leaves over it (sparser), many holes
    g = canopy(w, ch, R['leaf_a_green'], seed + 1, nb=14, rag=10, holes=0.30, spread=0.40)
    a = canopy(w, int(ch * 0.92), R['leaf_a_turn'], seed + 2, nb=10, rag=11, holes=0.46, spread=0.42)
    L.blit(g, 0, 0)
    L.blit(a, 0, ch * 0.06)
    return L, ch


def light_tree_from_below(L, x0, y0, w, ch, cols):
    """The street's light on the crown's underside (after the grade): in the lower part of the crown the leaf clusters'
       lower edges (a leaf pixel with air under it) catch the colour of the light under them strongly, the leaves
       just above them a little (on the checker); the crown's top stays in the night. cols: [(x in the part, colour,
       strength)], each light reaching w * 0.32 to either side."""
    xx, yy = grid(x0, y0, w, ch * 1.05)
    v = L.view(x0, y0, w, ch * 1.05)
    if v.shape[:2] != xx.shape:
        return
    on = v[..., 3] > 0
    k = max(1, U // 2)
    under = np.zeros_like(on)
    under[:-k] = on[:-k] & ~on[k:]
    near = np.zeros_like(on)
    near[:-3 * k] = on[:-3 * k] & ~on[3 * k:] & ~under[:-3 * k]
    t = np.clip((yy - y0 - ch * 0.28) / (ch * 0.52), 0, 1)              # 0 at 28 % of the crown, 1 at 80 %
    ck = chk(xx, yy)
    for (lx, col, s) in cols:
        fall = np.clip(1.2 - np.abs(xx - (x0 + lx)) / (w * 0.36), 0, 1) * t * s
        for m, a in ((under, 0.80), (near & ck, 0.42)):
            mm = m & (fall > 0.15)
            if mm.any():
                px = v[..., :3][mm].astype(float)
                v[..., :3][mm] = snap5(px + (np.array(col, float) - px) * (a * fall[mm])[:, None])


# ---------------------------------------------------------------- the canal lantern
def quay_lamp_a(h=46, lit=False):
    """The canal lantern of the quays at the scale rule (h px; 4.4 m at s 0.79 is 46): a fluted cast-iron post on a
       stepped base, a collar, a four-sided lantern with a small crown. 9 px wide; anchor bottom centre (x 4.5)."""
    I = R['iron']; G = R['glass']
    L = Layer(9, h)
    cx = 4.0
    L.rect(cx - 2, h - 7, 5, 7, I[2]); L.vl(cx - 2, h - 7, 7, I[4]); L.vl(cx + 2, h - 7, 7, I[1])      # the base
    L.hl(cx - 3, h - 1.5, 7, I[1]); L.hl(cx - 2, h - 7, 5, I[5]); L.hl(cx - 1.5, h - 9, 4, I[3])
    L.rect(cx - 0.5, 10, 2, h - 18, I[2]); L.vl(cx - 0.5, 10, h - 18, I[4], t=TH)                       # the post
    L.vl(cx + 1.5 - D1, 10, h - 18, I[1], t=TH)
    for y in (h * 0.45, h * 0.62):
        L.hl(cx - 1, y, 3, I[4], t=TH); L.hl(cx - 1, y + 0.5, 3, I[1], t=TH)                           # rings
    L.hl(cx - 1.5, 10, 4, I[3]); L.hl(cx - 1, 11, 3, I[1])                                             # the collar
    # the lantern: a narrowing glass body under a cap and a crown
    for j in sub(0, 6):
        hw = 2.5 - j * 0.12
        y = 3.5 + j
        L.rect(cx + 0.5 - hw, y, 2 * hw, D1, EM[1] if lit else G[3])
        L.rect(cx + 0.5 - hw, y, D1, D1, I[2]); L.rect(cx + 0.5 + hw - D1, y, D1, D1, I[1])
        if lit:
            L.rect(cx - 0.5, y, 1.5, D1, EM[0])
        else:
            L.rect(cx - 1, y, 1, D1, G[5])
    L.hl(cx - 2.5, 3, 6, I[3]); L.hl(cx - 2, 2.2, 5, I[2]); L.hl(cx - 1, 1.4, 3, I[3]); L.vl(cx + 0.5, 0, 1.6, I[2], t=TH)
    L.hl(cx - 1.5, 9.5, 4, I[2])
    return L


# ---------------------------------------------------------------- the far quay (parts_wallen.far_quay_night + nst, whole words)
def far_quay_a(sec, rng, YH=110, YQ=115, YW=120, speed=0.5, seed=100, boats=(), umbrellas=0.5, trees=True, gaps=(),
               nst=(2, 2, 2, 3), lamp_step=104):
    """parts_wallen.far_quay_night, changed: the fronts' storey counts (nst) and no neon word on a front where a thing
       of the far quay's street (a tree's crown, a lamp) covers its sign slot. Records sec.notes['word_cover'] (opaque
       street px in the slots that kept a word: 0) and sec.notes['far_words'] [(x, y, w, h)] of every lit sign."""
    H = sec.H
    WF = sec.lw(speed)
    Fh = Layer(WF, VIEW_H)
    infos, slots = wallen_row(Fh, 0, WF, YH, rng, speed, seed=seed, night=H.get('night', True), nst=nst)
    F = Layer(WF, VIEW_H)
    far_street(F, 0, WF, YH, YQ, rng, 1)
    for i in infos:
        if rng.random() < 0.55:
            F.blit(bike_far(rng), i['x'] + rng.randint(2, max(3, i['w'] - 14)), YH - 5)
    ingap = lambda x, m=0: any(a - m <= x <= b + m for (a, b) in gaps)
    tl = []
    if trees:
        x = 40
        while x < WF - 20:
            if not ingap(x, 30):
                t = tree_far(rng, rng.randint(*FAR_TREE_N['cw']), rng.randint(*FAR_TREE_N['ch']), rng.randint(*FAR_TREE_N['th']),
                             leaf='leaf_a_turn', seed=rng.randint(1, 999), bare=0.62, tw=FAR_TREE_N['tw'])
                tl.append((x - t.w // 2, YQ - t.h, t))
            x += rng.randint(*FAR_TREE_N['step'])
    x = 8
    while x < WF - 20:
        k = rng.random()
        if ingap(x, 30):
            x += 10
        elif k < 0.12:
            c = car_far_a(rng); F.blit(c, x, YQ - c.h + 1); x += c.w + rng.randint(6, 16)
        elif k < 0.40:
            for j in range(rng.randint(1, 4)):
                F.blit(bike_far(rng), x, YQ - 7); x += 9
            x += 4
        else:
            x += rng.randint(6, 18)
    lamps = []
    for lx in range(30, WF, lamp_step):
        if not ingap(lx, 8):
            F.blit(lamp_far(30, lit=True), lx, YQ - 29)
            lamps.append((lx + 2, YQ - 26))
    walkers = []
    x = rng.randint(10, 40)
    while x < WF - 10:
        if rng.random() < umbrellas and not ingap(x, 6):
            u = umbrella_far(rng, speed)
            F.blit(u if rng.random() < 0.5 else u.flip(), x, YQ - u.h - rng.randint(0, 2))
            walkers.append(x)
        x += rng.randint(40, 110)
    for (tx, ty, t) in tl:
        F.blit(t, tx, ty)
    bollards_far(F, 0, WF, YQ + 1, rng)
    quay_wall(F, 0, YQ, WF, YW - YQ, rng, 7)
    for (kind, bx, arg) in boats:
        if kind == 'sloop':
            b = sloop(rng, arg[0], arg[1]); F.blit(b, bx, YW - 7)
        elif kind == 'tarp':
            b = tarp_boat(rng, arg[0]); F.blit(b, bx, YW - b.h + 3)
    F.clear(0, YW + 1, F.w, F.h)
    # whole words: a sign slot that a street thing covers (with 3 px around the word's glow) gets no word
    for i in infos:
        sx, sy, sw, sh = i['sign']
        if sh <= 0:
            continue
        v = F.a[P(sy - 1):P(sy + sh + 1), P(sx - 3):P(sx + sw + 3), 3]
        if (v > 0).any():
            i['sign'] = (sx, sy, sw, 0)
    G = grader(key=sec.KEY, air=(sec.AIR[0], sec.AIR[1], H.get('far_air', 0.12), 0.30))
    F.recolor(G, keep=KEEP)
    Fh.recolor(G, keep=KEEP)
    wl = []
    lights = light_fronts(Fh, infos, H, rng, sec.notes, 'far', wl)
    Fc = Layer(Fh.w, Fh.h); Fc.a = Fh.a.copy()
    sec.notes.setdefault('front_imgs', {})['far'] = Fc
    # the lit signs (a board was painted in the slot) and how much of them the street covers
    words, cover = [], 0
    bd = np.array(BOARD, np.uint8)
    for i in infos:
        sx, sy, sw, sh = i['sign']
        if sh <= 0:
            continue
        v = Fh.a[P(sy):P(sy + sh), P(sx):P(sx + sw)]
        m = np.all(v[..., :3] == bd, axis=-1) & (v[..., 3] > 0)
        if m.any():
            ys, xs = np.nonzero(m)
            box = (sx + xs.min() / U, sy + ys.min() / U, (xs.max() - xs.min() + 1) / U, (ys.max() - ys.min() + 1) / U)
            words.append(box)
            bx, by, bw, bh = box
            cover += int((F.a[P(by):P(by + bh), P(bx):P(bx + bw), 3] > 0).sum())
    Fh.blit(F, 0, 0)
    F = Fh
    street_glow(F, lights)
    if H.get('night'):
        for (x, y) in lamps:
            glow(F, x, y, 7, HALO_S)
            F.rect(x - 1, y - 1, 3, 3, EM[0]); F.px(x, y + 1, EM[1])
            wl.append((x, EM[1], 0.8))
    limit_colours(F, 256)
    sec.add('far', F, speed)
    sec.notes.setdefault('fronts', []).append(('far', slots))
    sec.notes['far_words'] = words
    sec.notes['word_cover'] = cover
    return F, dict(infos=infos, slots=slots, wl=wl, lights=lights, lamps=lamps, trees=tl, walkers=walkers, Fc=Fc)


def neon_flicker(sec, F, Fc, words, speed=0.5, every=3, seed=4):
    """The neon flicker: a frames layer (3 steps) over the far row's sign band. In step 1 every `every`-th lit word
       goes dark (its tube pixels take the ember tone of their colour), in step 2 another set loses its pale core;
       step 0 is empty (all on). Only the tube pixels that nothing covers (the final far layer equals the fronts there)."""
    if not words:
        return None
    y0 = int(min(b[1] for b in words)) - 1
    y1 = int(math.ceil(max(b[1] + b[3] for b in words))) + 1
    tubes = {}
    for N in (RED, PINK, AMBER, CYAN):
        tubes[tuple(int(v) for v in N[1])] = N[3]
        tubes[tuple(int(v) for v in N[0])] = N[2]
    frames = [Layer(F.w, y1 - y0) for _ in range(3)]
    r = random.Random(seed)
    order = list(range(len(words)))
    r.shuffle(order)
    for n, wi in enumerate(order):
        f = 1 if n % every == 0 else (2 if n % every == 1 else 0)
        if f == 0:
            continue
        bx, by, bw, bh = words[wi]
        sl = (slice(P(by), P(by + bh)), slice(P(bx), P(bx + bw)))
        a, c = F.a[sl], Fc.a[sl]
        same = np.all(a == c, axis=-1) & (a[..., 3] > 0)
        out = frames[f].a[P(by) - P(y0):P(by) - P(y0) + a.shape[0], P(bx):P(bx) + a.shape[1]]
        for col, off in tubes.items():
            if f == 2 and col not in [tuple(int(v) for v in N[0]) for N in (RED, PINK, AMBER, CYAN)]:
                continue
            m = same & np.all(a[..., :3] == np.array(col, np.uint8), axis=-1)
            out[..., :3][m] = off
            out[..., 3][m] = 255
    sec.add('neon', None, speed, y=y0, kind='frames', frames=frames)
    return frames


# ---------------------------------------------------------------- bridges across the canal, in depth (shared slices, an arch)
PXM_ = 13.0
RAIL_LIT = [s5(c) for c in ((150, 128, 132), (104, 92, 120), (92, 84, 118), (64, 60, 96))]   # rail top lit / shade, posts


def bridges_a(sec, spans, d0=27.0, d1=56.0, lift=5.0, rise=2.4, step=0.5, bikes=3, seed=5, lit=True, arch=(31.0, 54.0),
              arch_h=1.9):
    """parts_wallen.bridge_depth for several hump bridges at once, changed in two ways: (1) one layer per depth slice
       ('br_<k>') holds every bridge of the section; (2) the arch: between the depths arch[0] and arch[1] (the water
       under the bridge) each slice is filled only from the deck down to the arch's soffit (arch_h m over the water at
       the crown of the arch, an ellipse), so the side walls open over the canal and the water shows under the bridge
       from the side. The voussoirs ring the opening in stone, the soffit is in shade. spans: [(x0, x1, seed)]: the
       deck between the parapets. Returns the layer ids."""
    B = R['brick_brown']; S = R['stone']; I = R['iron']; WC = R['wet_cobble']
    ids = []
    ks = np.arange(d1, d0 - 1e-6, -step)
    mid = (d0 + d1) / 2.0
    half = (d1 - d0) / 2.0
    am, ah = (arch[0] + arch[1]) / 2.0, (arch[1] - arch[0]) / 2.0
    crown = round(mid * 2) / 2.0
    per = []
    for (x0, x1, sd) in spans:
        rng = random.Random(sd)
        per.append((x0, x1, rng, sorted(rng.uniform(d0 + 3, mid - 2) for _ in range(bikes))))
    for k in ks:
        sp = s_d(k)
        t = (k - mid) / half
        hump = rise * PXM_ * sp * (1 - t * t)
        yfoot = GY - k
        ydeck = yfoot - hump - lift * (k - d0) / (d1 - d0)
        par = 1.0 * PXM_ * sp
        top = ydeck - par - (14 if (lit and abs(k - crown) < 1e-6) else 2)
        hgt = yfoot + 3 - top
        Lw = Layer(sec.lw(sp), hgt)
        yd = ydeck - top
        ta = (k - am) / ah
        in_arch = abs(ta) < 1.0
        ysoff = (yfoot - arch_h * PXM_ * sp * math.sqrt(max(0.0, 1 - ta * ta))) if in_arch else yfoot
        ysoff = max(ysoff, ydeck + 3 + 0.6 * PXM_ * sp)                    # the deck keeps 0.6 m of masonry
        for (x0, x1, rng, bike_at) in per:
            xa, xb = sec.at(x0, sp), sec.at(x1, sp)
            for xx in sub(0, xb - xa):
                u = x0 + xx / sp
                tone = 2 + int(hash01(np.array(math.floor(u / 5.0)), np.array(math.floor(k)), seed) > 0.6)
                if (u % 5.0) < 0.8:
                    tone = 1
                if abs(u - (x0 + x1) / 2.0) < (x1 - x0) * 0.18:
                    tone += 1
                Lw.rect(xa + xx, yd, D1, 3, WC[min(6, tone)])
            # the body under the deck: brick, down to the water (abutments) or to the arch's soffit
            body = ysoff - ydeck - 3
            if body > 0:
                Lw.rect(xa, yd + 3, xb - xa, body, B[2])
                Lw.hl(xa, yd + 3, xb - xa, B[1], t=TH)
                if in_arch:
                    Lw.hl(xa, yd + 3 + body - D1, xb - xa, B[0], t=D1)              # the soffit in shade
                    Lw.hl(xa - D1, yd + 3 + body - 1.2, D1 * 2, S[4], t=1.2)        # the voussoirs at both faces
                    Lw.hl(xb - D1, yd + 3 + body - 1.2, D1 * 2, S[3], t=1.2)
            Lw.vl(xa - D1, yd, ysoff - ydeck + 3 - (0 if in_arch else 0), B[3]); Lw.vl(xb, yd, ysoff - ydeck + 3, B[0])
            if not in_arch and abs(k - d1) > 0.6 and abs(k - d0) > 0.6:
                Lw.vl(xa - D1, yfoot - 1.5, 1.5 + 3 - (yfoot - ysoff), R['moss'][2])   # the green band at the water
            kb = max(1.5, par * 0.28)
            for (px_, side) in ((xa, 1), (xb - 2, -1)):
                Lw.rect(px_, yd - kb, 2, kb + 2, B[3]); Lw.hl(px_, yd - kb, 2, S[5])
                Lw.vl(px_ + (0 if side > 0 else 1), yd - kb - (par - kb), par - kb, I[2] if side > 0 else I[1], t=TH)
                Lw.hl(px_, yd - par, 2, I[4] if side > 0 else I[3], t=TH)
                if abs((k * 2) % 4) < 1e-6:
                    Lw.rect(px_ + 0.5, yd - par, 1, par - kb, I[3] if side > 0 else I[1])
            for bd in bike_at:
                if abs(k - bd) < step / 2:
                    bk = bike(rng, None, False)
                    left = rng.random() < 0.5
                    Lw.blit(bk if left else bk.flip(), (xa + 2) if left else (xb - 2 - bk.w), yd - bk.h + 2)
            if lit and abs(k - crown) < 1e-6:
                for px_ in (xa, xb - 2):
                    Lw.rect(px_ + 0.5, yd - par - 9, 1, 9, I[2]); Lw.rect(px_ - 0.5, yd - par - 13, 3, 4, EM[1])
                    Lw.hl(px_ - 1, yd - par - 13.5, 4, I[3])
        Lw.recolor(grader(key=sec.KEY, air=(sec.AIR[0], sec.AIR[1], min(0.3, 0.004 * k), 0.3)), keep=KEEP)
        for (x0, x1, rng, _) in per:                                       # the top rails catch the bulbs' light
            xa, xb = sec.at(x0, sp), sec.at(x1, sp)
            for (px_, side) in ((xa, 1), (xb - 2, -1)):
                Lw.hl(px_, yd - par, 2, RAIL_LIT[0] if side > 0 else RAIL_LIT[1], t=TH)
                if abs((k * 2) % 4) < 1e-6:
                    Lw.rect(px_ + 0.5, yd - par + TH, 1, par - max(1.5, par * 0.28) - TH, RAIL_LIT[2] if side > 0 else RAIL_LIT[3])
        for (x0, x1, rng, _) in per:                                       # the bulbs along both top rails
            if abs((k * 2) % 4 - 2) < 1e-6 and k > d0 + 0.6:
                xa, xb = sec.at(x0, sp), sec.at(x1, sp)
                for px_ in (xa + 0.5, xb - 1.5):
                    Lw.rect(px_, yd - par - 0.5, 1, 1, EM[1])
                    if U > 1:
                        Lw.rect(px_ + 0.25, yd - par - 0.25, 0.5, 0.5, EM[0])
        if lit and abs(k - crown) < 1e-6:
            for (x0, x1, rng, _) in per:
                xa, xb = sec.at(x0, sp), sec.at(x1, sp)
                for px_ in (xa, xb - 2):
                    glow(Lw, px_ + 1, yd - par - 11, 7, HALO_W)
                    Lw.rect(px_ - 0.5, yd - par - 13, 3, 4, EM[1]); Lw.px(px_ + 0.5, yd - par - 12, EM[0])
        lid = 'br_%g' % k
        sec.add(lid, Lw, sp, y=top, depth=k)
        ids.append(lid)
    return ids


# ---------------------------------------------------------------- the old church's tower (backdrop only)
def tower_layer(sec, x, s=0.14, yb=112, h_m=67.0, seed=6, top=None):
    """The old church's tower on its own plane (speed s, the scale rule: h_m metres), plane x = x; graded with the
       key and much air, floodlit from its foot (two steps), the clock face lit warm. Nothing on it: backdrop only.
       top: the spire's tip row instead of the foot yb (the foot stands hidden behind the far row either way).
       Adds layer 'tower'; returns (layer, tower top y, tower left, width)."""
    th = int(round(scale_px(h_m, s)))
    if top is not None:
        yb = top + th
    T = Layer(sec.lw(s), VIEW_H)
    tw = church_tower(th, s, seed=seed)
    tx = x - tw.w / 2.0
    T.blit(tw, tx, yb - th)
    T.recolor(grader(key=sec.KEY, air=(sec.AIR[0], sec.AIR[1], 0.42, 0.5)))
    floodlight(T, tx, tx + tw.w, yb - th * 0.80, yb, col=(236, 206, 160), a=0.36)
    # the upper tower: floodlights on the church's roof reach the lanterns and the spire (lit side left, two steps)
    ya = max(0.0, yb - th)
    xx, yy = grid(tx, ya, tw.w, yb - th * 0.38 - ya)
    v = T.view(tx, ya, tw.w, yb - th * 0.38 - ya)
    if v.shape[:2] == xx.shape:
        on = v[..., 3] > 0
        lum = v[..., :3].astype(int).sum(-1)
        cxm = tx + tw.w / 2.0
        lit = on & ((xx < cxm) | ((xx < cxm + 1) & chk(xx, yy)))
        for m, a in ((lit, 0.58), (on & ~lit, 0.32)):
            if m.any():
                px = v[..., :3][m].astype(float)
                v[..., :3][m] = snap5(px + (np.array((236, 206, 160), float) - px) * a)
    # the clock: the pale disc of church_tower (centre at the base's top + 10 %) lit warm from inside
    base = int(th * 0.42)
    cy = yb - base + base * 0.10
    w = max(16, int(round(13 * 11.0 * s)))
    cxx = tx + (w + 4) / 2.0
    rr = w * 0.17
    xx, yy = grid(cxx - rr, cy - rr, 2 * rr + 1, 2 * rr + 1)
    v = T.view(cxx - rr, cy - rr, 2 * rr + 1, 2 * rr + 1)
    if v.shape[:2] == xx.shape:
        d = np.hypot(xx + 0.5 * D1 - cxx, yy + 0.5 * D1 - cy) / rr
        lum = v[..., :3].astype(int).sum(-1)
        face = (d < 0.80) & (v[..., 3] > 0) & (lum > 240)
        v[..., :3][face] = snap5(np.array((236, 222, 168), float))
        rim_ = (d >= 0.80) & (d < 1.0) & (v[..., 3] > 0)
        v[..., :3][rim_] = snap5(np.array((150, 120, 80), float))
    sec.add('tower', T, s)
    return T, yb - th, tx, tw.w
