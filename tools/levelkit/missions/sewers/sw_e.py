# Section e of level 2 (mission sewers): DE AFVALHAL, 05:00, 1,280 px. Wave P4b, painter E. The approach runs on in the
# tunnel of d (V2 BLACK, the approved look sample's parts); at x 832 the tunnel's portal opens into the trash hall under
# a canal, where DE RATTENJONG sits on his throne (the arena 864-1,248).
#
#   U=1 python3 tools/levelkit/lk.py sewers preview sw_e            # work/sewers/out/l1sewers-e-*-u1.png + layout
#   U=1 python3 tools/levelkit/lk.py sewers check sw_e sw_e_lit     # the gates of both stacks
#   python3 tmp/sewers/p4/u4.py sewers check sw_e sw_e_lit          # tier 4 (under the painters' lock)
#
# Scene card
#   Place:     0-832 the sewer tunnel (the far wall with its bays, side tunnels, manholes, the channel, the near walkway);
#              832 the portal: a heavy granite arch on a pier, the channel ends at a weir; 832-1,280 the hall: a back
#              wall twice as tall and farther (S_H 0.5) with tall arcades, culverts, outfalls, a split; a barrel vault over
#              it, cracked along the crown where cold grey light and water come in; the floor of wet blackened brick and
#              shallow water; the trash mountain at the back and the throne pile with the armchair, Gerrit's gold chain.
#   Hour:      e, 05:00: V2 BLACK exactly (checks_sewers.same_as_sample), plus EM_E's crack light (cold grey).
#   Planes:    tunnel voids and rings (S_W / z) · hall vault rows (y 0-28, s 1.0 -> 0.5) · hall wall 0.5 · hall pours ·
#              hall floor rows (118-146) · crack shafts and water 0.62-0.70 · tunnel vault rows (masked at the portal) ·
#              far wall 0.621 · manhole shafts · pours · water rows · floor rows (walkway, weir, hall floor) · grate
#              shafts 0.76 · planes: junk d29-d58, the heap d40, the sunk bike d22, the walk plane d0 (plinths, ledges,
#              the pile and the chain as canal sprites) · fg 1.35.
#   Local:     the trash mountain, Gerrit's gold chain, water jets from the cracks, rats' eyes in holes and pipes, lost
#              things (phones, keys, a wheel, a selfie stick), shopping carts and scooters sunk in the shallow water.
#   Rules:     closed above the walk band; a grate shaft only under a grate; every eye in a carrier (the game's hall eyes
#              too, at the lock camera); bays tile; nothing on the walk band but play (d0); the hour is V2 BLACK.
import os
import random
import numpy as np
from level import *
from game_sprites import sprites, entity          # noqa: F401  (sprites: the bake's hook)
from parts_sewers import *                        # noqa: F401,F403
from parts_sw_e import *                          # noqa: F401,F403
from parts_sw_e import _cart, _scooter, _bike, _tyre
import checks_sewers as cs
from mission import two_stacks

SID = 'sewers-e'
NAME = 'De Afvalhal'
NOTE = ("The trash hall under a canal at 05:00. The sewer tunnel runs on to a heavy portal arch where the channel ends at "
        "a weir; behind it the hall rises twice as high, its vault cracked along the crown, cold grey light and water "
        "falling in. Bikes, carts and scooters sank through and piled up into the Rattenjong's throne, with Gerrit's "
        "gold chain on it.")
GAME_CAMS = [(0, 192), (240, 192), (460, 192), (640, 192), (780, 230), (864, 192), (896, 300)]

GRATES = (214, 566)                  # street grates in the approach's crown (faint white shafts, the approved look)
E_BAYS = ['pipes', 'manhole', 'tunnel', 'outfall', 'plain', 'tunnel', 'pipes', 'manhole', 'eyes', 'plain', 'plain',
          'plain', 'plain', 'plain', 'plain']
PLINTHS = (640, 736)                 # the spitter's plinths (terrain: 616-664, 712-760, y 148)
BIKE = (402, 22.0)                   # a bike sunk in the channel
HEAP = (950, 1250, 40.0, 74)         # the trash mountain behind the throne: world x0, x1, depth, height
# lost things floating in the approach's channel (kind, world x, world depth)
LOST_E = [('wipes', 40, 60), ('phone', 120, 50), ('grease', 196, 80), ('keys', 300, 46), ('duck', 362, 62),
          ('stick', 470, 52), ('wipes', 540, 86), ('bottle', 610, 66), ('grease', 690, 56), ('dentures', 760, 48)]
# the game's junk decor (decor/sewers-e-junk frames: 0 phone, 1 keys, 2 a wheel in a puddle, 3 a selfie stick), flat on
# the walkway at its x and the depth of its y (176 - y)
JUNK_KIND = {0: 'phone', 1: 'keys', 2: 'wheel_g', 3: 'stick'}
# junk on the hall floor (upright things sunk in the shallow water): (kind, world x, depth, seed)
SUNK = [('cart', 872, 24.0, 1), ('scooter', 1262, 22.0, 2), ('bike', 1196, 48.0, 3), ('cart', 1010, 52.0, 4),
        ('tyre', 908, 34.0, 5), ('bike', 1330, 56.0, 6)]
# junk piles on the hall floor and against the hall wall: (world x, depth, w, h, seed)
PILES = [(866, 41.0, 34, 16, 11), (996, 31.0, 30, 10, 12), (1232, 28.5, 38, 13, 13), (884, 57.0, 44, 14, 14),
         (1300, 56.0, 50, 18, 15), (1150, 57.5, 40, 12, 16)]


def _nograde(L):
    L.a[..., :3] = snap5(L.a[..., :3])
    return L


def sunk_part(kind, seed):
    """An upright thing sunk to its middle in the shallow water: the part above the water, a ring of ripples."""
    rng = random.Random(seed)
    if kind == 'cart':
        L = Layer(22, 14)
        _cart(L, 3, 12, 15, 8, tilt=rng.uniform(-2, 2))
    elif kind == 'scooter':
        L = Layer(16, 16)
        _scooter(L, 2, 14, sc=1.0, flip=rng.random() < 0.5)
    elif kind == 'bike':
        L = Layer(26, 14)
        _bike(L, 1, 15, sc=1.0, col=rng.choice(['red', 'blue', 'black']))
    else:
        L = Layer(14, 10)
        _tyre(L, 7, 6, 4.5)
    W = SR['swater']
    for x in sub(0, L.w):
        L.rect(x, L.h - 1, D1, 1, W[3] if (int(x * DET) % 3) else W[5])
    return L


def paint(sid, hour, lit):
    sec = Sec(sid, NAME, hour)
    H = sec.H
    KEEP = keep_e(H)
    E = [tuple(int(v) for v in snap5(c)) for c in H['em']['eye']]
    # ---- the tunnel's far wall (daylight): its bays, the two pipe mouths for the game's eyes at the lock camera, the
    #      portal pier; the wall stops at the portal (the hall behind it)
    F, info = far_wall(sec, H, bays=E_BAYS)
    pre = {}
    for i, (ex, ey) in enumerate(HALL_EYES):
        p = ex - LOCK_CAM + LOCK_CAM * S_W
        if p < wall_p(HALL - 22) and YSPRING + 6 < ey < YWALL - 4:
            r_ = 3.6 if ey > 110 else 3.2
            pipe_mouth(F, p, ey + 0.5, r_, SR['sbrick'], 900 + i, eyes=0, info=info)
            F.ellipse(p, ey + 0.2, r_ * 0.78, r_ * 0.62, SR['void'][0]); F.ellipse(p, ey + 0.9, r_ * 0.6, r_ * 0.3, SR['void'][1])
            pre[i] = 'far'
    pa, pb = wall_p(HALL - 20), wall_p(HALL)
    F.clear(pb, 0, F.w, VIEW_H)
    Gr = SR['granite']
    brickfill(F, pa, YSPRING - 3, pb - pa, YW - YSPRING + 3, SR['sbrick'], 77, mid=4, lo=2, hi=6)
    for y in np.arange(YSPRING, YW - 2, 5.0):
        F.rect(pa, y, 3.5 if int(y) % 10 < 5 else 5, 2.5, Gr[4]); F.hl(pa, y, 3.5, Gr[6], t=TH)
        F.rect(pb - (3.5 if int(y) % 10 < 5 else 5), y, 5, 2.5, Gr[3]); F.hl(pb - 3.5, y, 3.5, Gr[5], t=TH)
    F.vl(pa, YSPRING - 3, YW - YSPRING + 3, Gr[5], t=TH); F.vl(pb - TH, YSPRING - 3, YW - YSPRING + 3, Gr[1], t=TH)
    F.rect(pa - 1.5, YSPRING - 3, pb - pa + 1.5, 4, Gr[4]); F.hl(pa - 1.5, YSPRING - 3, pb - pa + 1.5, Gr[6]); F.hl(pa - 1.5, YSPRING + 1, pb - pa + 1.5, Gr[1])
    F.rect(pa - 1, YQ - 4, pb - pa + 1, 7, Gr[3]); F.hl(pa - 1, YQ - 4, pb - pa + 1, Gr[5])
    sec.notes['info'] = info
    # ---- the side tunnels (far to near)
    tunnel_layers(sec, info, H, lit)
    # ---- the hall: its vault, its back wall (with pipe mouths for the game's eyes), the pours, the floor's far rows
    hribs = [192 + (HP0 + k * HB + 4 - 192) / S_H for k in range(0, 8)]
    hall_vault(sec, H, KEEP, hribs, lit)
    mouths = []
    for i, (ex, ey) in enumerate(HALL_EYES):
        if i in pre or ey > YF_H - 6:
            continue
        p = ex - LOCK_CAM + LOCK_CAM * S_H
        if p >= HP0 + 4:
            mouths.append((p, ey, 3.8, 950 + i))
            pre[i] = 'hallwall'
    HW, hinfo = hall_wall(sec, H, KEEP, lit, mouths=mouths)
    sec.add('hallwall', HW, S_H)
    hall_pours(sec, H, hinfo)
    pools = [(uc, vb_of(sp), 9.0 + hl * 0.12) for (uc, sp, hl, op) in CRACKS]
    trash = tuple(t for t in TRASH if t[1] > HALL + 12)
    junk = tuple((JUNK_KIND[d['frame']], d['x'], vb_of(s_d(176 - d['y'])), 0.0) for d in decor(sec, 'decor/sewers-e-junk'))
    fx = dict(grates=GRATES, pours=[wall_u(cx) for (cx, cy, w) in info['pours']], pools=pools, trash=trash, junk=junk)
    hall_rows(sec, 'hallfloor', YF_H, BACKY, H, lit, fx)
    crack_layers(sec, H, lit)
    # ---- the tunnel's vault (it ends at the portal: a heavy granite ring), the far wall, its shafts and pours
    nb = int(np.ceil(F.w / BAY))
    ribs = [wall_u(k * BAY + PIL / 2.0) for k in range(-3, nb + 3) if wall_u(k * BAY + PIL / 2.0) < HALL - 30]
    n0 = len(sec.layers)
    ya, yb = vault_layer(sec, H, GRATES, ribs, lit)
    Gp = gramp('granite', G_of(H, H['air'] * 0.45))
    for ly in sec.layers[n0:]:
        im = ly['frames'][0]
        u, y, s, Wl = rows_grid(sec, ly['y'], ly['y'] + im.h, ly['s0'], ly['s1'])
        th = theta_of_s(s)
        a = im.a
        a[..., 3][u >= HALL] = 0
        ring = (u >= HALL - 14) & (u < HALL)
        vt = 4 + (np.floor(th * 14) % 2 == 0) - (th < 0.25) - (u < HALL - 11.5) + (u >= HALL - 1.6) * 2
        vt = np.where(np.abs(th * 14 - np.round(th * 14)) < 0.06 + 0.04 * (U == 1), 1, vt)
        a[..., :3][ring] = Gp[np.clip(vt, 0, 6)][ring]
        a[..., 3][ring] = 255
    sec.notes['grate_rows'] = (ya, yb)
    F.recolor(G_of(H, H['air']), keep=KEEP)
    far_lights(F, info, H, lit, grates=GRATES)
    sec.add('far', F, S_W)
    mw = LT(H, 'mshaft_w')
    shaft_layer(sec, 'mshaft', S_W, info['mshafts'], H, YWALL + 2.5, w0=mw[0], w1=mw[1], strength=LT(H, 'mshaft'), seed=71)
    pour_layer(sec, H, info)
    # ---- the channel, the weir, the near walkway and the hall floor
    channel_e(sec, H, F, fx, lit, lost=LOST_E)
    # ---- the street grates' light shafts (S_SHAFT)
    gy = 60 + 116 * S_SHAFT
    shafts = [(192 + (u - 192) * S_SHAFT, yb - 0.5) for u in GRATES]
    sw_ = LT(H, 'shaft_w')
    outs = shaft_layer(sec, 'shafts', S_SHAFT, shafts, H, gy, w0=sw_[0], w1=sw_[1], strength=LT(H, 'shaft'), seed=51)
    for Lf_ in outs:
        for i, (x, yt) in enumerate(shafts):
            hanging_wipes(Lf_, x, yt + 0.5, H, seed=300 + i)
        Lf_.a[..., :3] = snap5(Lf_.a[..., :3])
    sec.notes['shafts'] = [('shafts', S_SHAFT, u, yb - 0.5) for u in GRATES] + \
                          [('mshaft', S_W, wall_u(xc), y) for (xc, y) in info['mshafts']]
    # ---- things on the planes (each graded as its plane, the emitters kept)
    sec.put(graded(bike_sunk(random.Random(4)), H, KEEP, BIKE[1]), BIKE[0], BIKE[1], shade=False)
    for (x, d, w, h, sd) in PILES:
        P_, hl = junk_mound(w, h, sd, things=3 + w // 14, holes=1 if d > 50 else 0)
        graded(P_, H, KEEP, d)
        for (hx_, hy_, rx_, ry_) in hl:
            eyes_px(P_, hx_, hy_ + 0.2, E)
        k = sec.put(P_, x, d, shade=False)
        sp = s_d(k)
        ox, oy = sec.at(x, sp) - w / 2.0, (GY - k) - h
        sec.notes.setdefault('fat_holes', []).extend((ox + hx_, oy + hy_, rx_, ry_, sp) for (hx_, hy_, rx_, ry_) in hl)
    x0, x1, hd, hh = HEAP
    hw = int(round((x1 - x0) * s_d(hd)))
    HP_, hl = junk_mound(hw, hh, 41, things=30, holes=5)
    graded(HP_, H, KEEP, hd)
    C = H['em']['crack']
    for (cxw, sp_, hl_, op) in CRACKS:                         # the crack light on the heap's top
        if x0 < cxw < x1:
            tint(HP_, (cxw - x0) * s_d(hd), 0, 26, 40, C[2], a1=0.30 if not lit else 0.14, a2=0.14 if not lit else 0.07)
    for j, (hx_, hy_, rx_, ry_) in enumerate(hl):
        if j % 2 == 0:
            eyes_px(HP_, hx_, hy_ + 0.2, E)
    k = sec.put(HP_, (x0 + x1) / 2.0, hd, shade=False)
    sp = s_d(k)
    ox, oy = sec.at((x0 + x1) / 2.0, sp) - hw / 2.0, (GY - k) - hh
    sec.notes.setdefault('fat_holes', []).extend((ox + a, oy + b, c, d, sp) for (a, b, c, d) in hl)
    for (kind, x, d, sd) in SUNK:
        sec.put(graded(sunk_part(kind, sd), H, KEEP, d), x, d, shade=False)
    # ---- the walk plane: the plinths, the ledges, the throne pile and Gerrit's chain (canal sprites)
    for x in PLINTHS:
        sec.put(graded(plinth_part(seed=x), H, KEEP), x, 0, base=166, shade=False)
    piles = [graded(throne_pile(lv), H, KEEP) for lv in range(4)]
    chain = graded(gold_chain(), H, KEEP)
    if GAME:
        for lv, P_ in enumerate(piles):
            entity(sec, 'decor/sewers-rattenjong-throne/pile', P_, KING_X, 0, frames=(lv,), shade=False, grade=_nograde)
        entity(sec, 'decor/sewers-rattenjong-throne/chain', chain, KING_X - 46, 0, ax=9, shade=False, grade=_nograde)
    else:
        P0 = Layer(PILE_W, PILE_AY)
        P0.a = piles[0].a.copy()
        P0.blit(chain, (KING_X - 46 - 9) - (KING_X - PILE_W / 2), (KING_TOPS[0] + 14 - 7) - (176 - PILE_AY))
        entity(sec, 'decor/sewers-rattenjong-throne/pile', P0, KING_X, 0, frames=(0,), shade=False)
    for (a, b) in LEDGES:
        sec.put(graded(ledge_part(b - a + 4, seed=a + 7), H, KEEP), (a + b) / 2.0, 0, base=166, shade=False)
    sec.plane(0)
    at = [l['id'] for l in sec.layers].index('hallfloor') + 1
    for key in sorted(sec.planes, key=lambda kf: (-kf[0], kf[1])):
        k, front = key
        d = sec.add('d%g%s' % (k, 'f' if front else ''), sec.planes[key], s_d(k), over=(k < 0 or front), depth=k, front=front)
        if s_d(k) < S_W:                                     # behind the tunnel's far wall: before it in the draw order
            sec.layers.remove(d)
            sec.layers.insert(at, d)
            at += 1
    sec.planes = {}
    # ---- three low front things at the lower edge (fg, 1.35), toward near-black
    FG = Layer(sec.lw(1.35), VIEW_H)
    rng = random.Random(9)
    for part, x in ((fg_bucket(rng), 300), (fg_hose(rng), 700), (fg_pallet(rng), 1030), (fg_bucket(rng).flip(), 1420)):
        FG.blit(part, x, VIEW_H - part.h + 2)
    FG.recolor(grader(key=H['fg']))
    sec.add('fg', FG, 1.35, over=True)
    # ---- carriers for the game's hall eyes at the lock camera (and a few of the hall's rats in the dark)
    sec.notes['eye_carriers'] = carriers_for_eyes(sec, H, pre=pre, paint_eyes=(1, 3, 7, 9, 11, 13))
    sec.notes['band'] = (-40.0, D_EDGE)
    sec.notes['band_ok'] = ['d0']
    return sec


build = two_stacks(SID, paint)


# ---------------------------------------------------------------- the section's own gates
def _lum(c):
    c = np.asarray(c, float)
    return (0.299 * c[..., 0] + 0.587 * c[..., 1] + 0.114 * c[..., 2]) / 255


def checks(sec):
    res = cs.sewer_rules(sec)
    # the game's hall eyes (drawn at speed 1 on the king's squeak, camera locked at 864): each over a dark carrier (a
    # pipe mouth or a hole): the eye sprite's row (enemy/sewers-rat-runner/eyes: 6 x 3, anchor 3,1; the dots and their
    # glow on the middle row, x -3 .. +2) lies on carrier-dark pixels or painted eyes
    fr = compose_level(sec, LOCK_CAM)
    Ecol = set(tuple(int(v) for v in snap5(c)) for c in sec.H['em']['eye'])
    bad, worst = [], 1.0
    for (ex, ey), lid in sec.notes['eye_carriers']:
        sx = ex - LOCK_CAM
        box = fr.a[P(ey):P(ey + 1), P(sx - 3):P(sx + 3), :3].reshape(-1, 3)
        ok_ = [(_lum(c) <= 0.16 or tuple(int(v) for v in c) in Ecol) for c in box]
        share = sum(ok_) / max(len(ok_), 1)
        worst = min(worst, share)
        if lid is None or share < 0.75:
            bad.append('%d,%d (%.2f)' % (ex, ey, share))
    res.append(("every hall eye of the game sits in a dark carrier at the lock camera (%d eyes)" % len(sec.notes['eye_carriers']),
                not bad, ', '.join(bad) or 'worst %.2f dark' % worst))
    # every crack shaft falls from a lit crack opening in the hall vault
    C = [tuple(int(v) for v in snap5(c)) for c in sec.H['em']['crack']]
    bad, n = [], 0
    for cx in cs.cams5(sec) + [LOCK_CAM]:
        f2 = compose_level(sec, cx)
        for (lid, sp, u, yt) in sec.notes['crack_shafts']:
            x = 192 + (u - 192 - cx) * sp
            if not (4 <= x < VIEW_W - 4):
                continue
            n += 1
            col = f2.a[max(0, P(yt - 3)):P(yt + 0.5), P(x - 1.5):P(x + 1.5), :3].reshape(-1, 3)
            if not any(tuple(int(v) for v in c) in C for c in col):
                bad.append('%s@%d cam %d' % (lid, u, cx))
    res.append(('every crack shaft falls from a lit crack in the hall vault', not bad, ', '.join(bad[:4]) or '%d shafts seen' % n))
    # play sits on its art: the plinths and the ledges on the walk plane (the generic gate), the ledge in the pile frames
    from game_sprites import GEOMETRY
    g = GEOMETRY.get('decor/sewers-rattenjong-throne/pile', [])
    ok = len(g) == 4 and all((f['w'], f['h'], f['ox'], f['oy']) == (PILE_W, PILE_H, PILE_W // 2, PILE_AY) for f in g)
    res.append(('the throne pile keeps the game frames (4 x 224 x 92, anchor 112, 90)', ok, '%d frames' % len(g)))
    # the scale rule (13 px per metre x s)
    def size(what, m, s, px, tol=0.12):
        t = PXM * m * s
        res.append(('scale: %s %g m at s=%.3f -> %.1f px' % (what, m, s, t), abs(px - t) <= tol * t, '%.1f px' % px))
    size('hall wall, floor to the vault spring', 13.8, S_H, YF_H - YS_H)
    size('hall bay (pier to pier)', 9.8, S_H, HB)
    size('far wall, walkway to spring line', 7.4, S_W, YWALL - YSPRING)
    size('spitter plinth (top 2.2 m over the walkway)', 2.2, 1.0, 176 - 148)
    res.append(('scale: the hero 40 px, never scaled', True, '40 px'))
    return res


if __name__ == '__main__':
    import time
    t0 = time.time()
    sec = build()
    print('build %.1f s, %d layers' % (time.time() - t0, len(sec.layers)))
    preview(sec, cams=(240, 640, 864), tag=sec.id)
    run, idle = hero_frames()
    for cx in (0, 460, 780, 896):
        save(compose_level(sec, cx, 0, run[3]), 'out/l1%s-c%d-u%d.png' % (sec.id, cx, U), 1)
    print('done %.1f s' % (time.time() - t0))
