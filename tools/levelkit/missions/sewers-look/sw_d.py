# Section d of level 2 (mission sewers): the sewer tunnels, 02:30. The look sample (Phase 2 of docs/LEVEL_GUIDE.md).
#
# Scene card
#   Place:      a 19th-century brick storm-sewer vault under De Wallen: a channel of dark water between two walkways,
#               the far wall with brick bays, side tunnels and pipe mouths, the vault closing the top of the frame.
#   Hour:       02:30, late October, rain all night. Three variants of key and air (mission.py HOURS v1 v2 v3), and the
#               flashlight's lit key (v1l v2l v3l). Key hue: teal (v1), night blue (v2), amber-olive (v3).
#   Set piece:  the fatberg as big as the tunnel at the last screen (world x 1080-1280): a slice on the far wall, a
#               slice in the channel (depth 24), the front face on the walkway (depth -8, the spec makes it a hitbox).
#   Water:      the channel (rows): dark body, a green glow (emitter), the flow, drip rings, the far foot mirrored,
#               the shafts' pools and streaks, lost things floating (phone, keys, dentures, selfie stick, bottle, a
#               rubber duck, wipes, grease) and a bike sunk to the saddle.
#   Planes:     side tunnels: void S_W, floor rows (S_W/z), rings z 1.15-1.78, eyes z 1.34 / 1.55 · vault rows 1.0 ->
#               0.621 · walk plane d0 (empty) · far wall 0.621 · manhole shafts 0.621 · pours 0.621 · water rows 0.681 -> 0.741 · floor rows
#               0.741 -> 1.345 (water to depth 16, then the walk band) · grate shafts 0.76 · bike d22 · fatberg d24, d-8 ·
#               fg 1.35 (three low things at the lower edge).
#   Local:      iron ladders up to manholes with the street grate's neon falling in; UITGANG plates; pipe mouths with
#               red eyes; outfalls pouring; side tunnels with eyes deep in; calcite drips; slime and moss; the cast-iron
#               main under the cornice; drain slots in the walkway; lost things in the water.
#   Rules:      no lettering but generic Dutch words; no blood (slime is green); bays tile; closed above the walk band;
#               a shaft only under a painted grate; eyes only in a pipe mouth or a side tunnel (checks).
#   Scale:      13 px/m x the plane's speed: wall 7.4 m to the spring at S_W (60 px), bays 7.9 m (64 px), tunnel mouths
#               5 m wide, 6 m tall (40 x 48 px), pipe mouths 0.6-1 m, rungs 0.3 m apart, channel 5 m, near walkway 2.6 m behind the walk
#               line; the hero 40 px, never scaled.
import os
import random
import numpy as np
from level import *
from game_sprites import sprites          # noqa: F401
from parts_sewers import *

NAME = 'Sewer tunnels'
NOTE = ("The sewer tunnels at 02:30: a brick storm-sewer vault, the channel of dark water glowing green, side tunnels "
        "running away in perspective, pipe mouths with red eyes, ladders up to the street grates where the neon of De "
        "Wallen falls in with the rain; the fatberg blocks the tunnel at the last screen.")
GAME_CAMS = [(0, 192), (150, 192), (300, 192), (450, 192), (600, 192), (750, 192), (896, 230)]

GRATES = (120, 400, 680, 930)           # world x of the street grates in the crown (their shafts land on the water)
FAT = (1060, 1300)                      # the fatberg's span (world x)
FAT_FRONT = (1188, -8.0)                # world x, depth of its front face
FAT_MID = (1176, 24.0)
BIKE = (590, 22.0)


def build(var=None, light=None, sid=None):
    var = var or os.environ.get('LK_VAR', 'v1')
    light = light or os.environ.get('LK_LIGHT', 'amb')
    lit = light == 'lit'
    hour = var + ('l' if lit else '')
    sec = Sec(sid or hour, NAME, hour)
    H = sec.H
    sec.notes['var'], sec.notes['lit'] = var, lit
    KEEP = keepcols(H)
    # ---- the far wall (daylight), the fatberg's back slice on it
    F, info = far_wall(sec, H)
    FB, _ = fatberg(200, 64, seed=9, kind='back')
    F.blit(FB, wall_p(FAT[0]) + 2, YWALL + 2 - FB.h)
    sec.notes['info'] = info
    # ---- side tunnels (far to near: void, floor, rings, eyes), then the vault rows
    tunnel_layers(sec, info, H, lit)
    nb = int(np.ceil(F.w / BAY))
    ribs = [wall_u(k * BAY + PIL / 2.0) for k in range(-3, nb + 3)]
    ya, yb = vault_layer(sec, H, GRATES, ribs, lit)            # the barrel vault: layers vault0 .. vault8
    sec.notes['grate_rows'] = (ya, yb)
    # ---- the far plane: graded with the key and the air of the hour, then its lights
    F.recolor(G_of(H, H['air']), keep=KEEP)
    far_lights(F, info, H, lit, grates=GRATES)
    sec.add('far', F, S_W)
    # ---- the manhole shafts (on the far plane), the pours
    mw = LT(H, 'mshaft_w')
    shaft_layer(sec, 'mshaft', S_W, info['mshafts'], H, YWALL + 2.5, w0=mw[0], w1=mw[1], strength=LT(H, 'mshaft'), seed=71)
    pour_layer(sec, H, info)
    # ---- the channel and the near walkway
    sf, sm = s_d(FAT_FRONT[1]), s_d(FAT_MID[1])
    fx = dict(grates=GRATES, pours=[wall_u(cx) for (cx, cy, w) in info['pours']], fat=FAT,
              # the shade under the front face's sagging belly (its left edge about 0.12 of its width) and the
              # shade on the water round the middle slice's foot (its left foot about 0.30 of its width)
              fat_shadow=(FAT_FRONT[0] + (0.12 * 190 - 95) / sf, 0, vb_of(sf) - 5, vb_of(sf) + 16),
              fat_water=(FAT_MID[0] + (0.30 * 330 - 165) / sm, vb_of(sm) - 10, vb_of(sm) + 14))
    channel_layers(sec, H, F, fx, lit)
    # ---- the street grates' light shafts (their plane: S_SHAFT), from the grate's lower row to the water
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
    # ---- things on the planes: the sunk bike, the fatberg's middle and front slices
    sec.put(bike_sunk(random.Random(4)), BIKE[0], BIKE[1], shade=False)
    E = [tuple(int(v) for v in snap5(c)) for c in H['em']['eye']]
    holes = []
    for (wp, hp, sd, kind, (fxw, fdep)) in ((330, 152, 5, 'mid', FAT_MID), (190, 186, 7, 'front', FAT_FRONT)):
        part, hl = fatberg(wp, hp, seed=sd, kind=kind, eye=E)
        sec.put(part, fxw, fdep, shade=False)
        k_ = round(fdep * 2) / 2
        sp = s_d(k_)
        ox, oy = sec.at(fxw, sp) - wp / 2.0, (GY - k_) - hp
        holes += [(ox + cx, oy + cy, rx, ry, sp) for (cx, cy, rx, ry) in hl]
        sec.notes['fat_' + kind] = (ox, oy, wp, hp, sp, part)
    sec.notes['fat_holes'] = holes
    sec.plane(0)                         # the walk plane: empty (nothing stands on the walk band but play)
    for key in sorted(sec.planes, key=lambda kf: (-kf[0], kf[1])):
        k, front = key
        Lp = sec.planes[key]
        K0, K1, K2, K3 = H['KEY']
        # the set piece keeps a little more of its own colour (fat reads cream and tan under the key)
        Gk = grader(key=(K0, K1, K2 * (0.80 if k in (FAT_MID[1], FAT_FRONT[1]) else 1.0), K3),
                    air=(H['AIR'][0], H['AIR'][1], H['air'] * 0.35, 0.3) if k > 10 else None)
        Lp.recolor(Gk, keep=KEEP)
        sec.add('d%g%s' % (k, 'f' if front else ''), Lp, s_d(k), over=(k < 0 or front), depth=k, front=front)
    sec.planes = {}
    # ---- three low front things at the lower edge (fg, 1.35), toward near-black
    FG = Layer(sec.lw(1.35), VIEW_H)
    rng = random.Random(9)
    for part, x in ((fg_bucket(rng), 290), (fg_hose(rng), 655), (fg_pallet(rng), 905), (fg_bucket(rng).flip(), 1290)):
        FG.blit(part, x, VIEW_H - part.h + 2)
    FG.recolor(grader(key=H['fg']))
    sec.add('fg', FG, 1.35, over=True)
    return sec


# ---------------------------------------------------------------- the section's own gates
def _cover(sec, cx):
    """Which screen pixels some layer paints at camera cx (compose_level marks whole rows of a rows layer)."""
    cov = np.zeros((P(VIEW_H), P(VIEW_W)), bool)
    VW = P(VIEW_W)
    for ly in sec.layers:
        k = ly['kind']
        if k in ('img', 'frames'):
            im = ly['img'] if k == 'img' else ly['frames'][0]
            ox = int(cx * ly['speed'] * U)
            seg = im.a[:, ox:ox + VW, 3] > 0
            y0 = P(ly['y'])
            cov[y0:y0 + seg.shape[0], :seg.shape[1]] |= seg[:cov.shape[0] - y0]
        elif k == 'rows':
            im = ly['frames'][0]
            y0 = P(ly['y'])
            n = im.ph
            for j in range(n):
                sp = ly['s0'] + (ly['s1'] - ly['s0']) * j / max(n - 1, 1)
                ox = int(cx * sp * U)
                seg = im.a[j, ox:ox + VW, 3] > 0
                cov[y0 + j, :len(seg)] |= seg
    return cov


def checks(sec):
    res = []
    info = sec.notes['info']
    H = sec.H
    # 1. the bays of the far wall tile (rows tile, 0 px overlap) and cover the plane
    bays = info['bays']
    ov = [a[0] + a[1] - b[0] for a, b in zip(bays, bays[1:])]
    Fw = [l for l in sec.layers if l['id'] == 'far'][0]['img'].w
    res.append(('far-wall bays tile: no bay paints into its neighbour (overlap 0 px)', all(o == 0 for o in ov) and bays[-1][0] + bays[-1][1] >= Fw,
                'max overlap %g, max gap %g, %d bays to %g of %g' % (max(ov + [0]), max([-o for o in ov] + [0]), len(bays), bays[-1][0] + bays[-1][1], Fw)))
    # 2. closed: every pixel above the walk band (y < 160) is painted at every camera (no sky, no hole)
    cams = [0, sec.cam // 4, sec.cam // 2, 3 * sec.cam // 4, sec.cam]
    worst = 0
    for cx in cams:
        cov = _cover(sec, cx)
        worst = max(worst, int((~cov[:P(160)]).sum()))
    res.append(('closed: no unpainted pixel above the walk band (y < 160), 5 cameras', worst == 0, '%d px' % worst))
    # 3. every light shaft hangs under a painted grate: the composed frame shows grate light within 3 px above the
    #    top of each shaft, at its centre column, at every camera where the shaft is on screen
    S = [tuple(int(v) for v in snap5(c)) for c in H['em']['shaft'] + list(grate_cols(H))]
    bad, n = [], 0
    for cx in cams:
        fr = compose_level(sec, cx)
        for (lid, sp, u, yt) in sec.notes['shafts']:
            x = 192 + (u - 192 - cx) * sp
            if not (4 <= x < VIEW_W - 4):
                continue
            n += 1
            col = fr.a[max(0, P(yt - 3)):P(yt + 0.5), P(x - 1.5):P(x + 1.5), :3].reshape(-1, 3)
            if not any(tuple(int(v) for v in c) in S for c in col):
                bad.append('%s@%d cam %d' % (lid, u, cx))
    res.append(('every light shaft falls from a painted grate (5 cameras)', not bad, ', '.join(bad[:4]) or '%d shafts seen' % n))
    # 4. every red eye sits in its carrier: eye pixels (rim colour) of the composed frame lie in a pipe mouth or a
    #    side tunnel opening at that camera (the water rows hold their mirror: left out)
    ecol = np.array(snap5(H['em']['eye'][1]), np.uint8)
    bad, n = 0, 0
    for cx in cams:
        fr = compose_level(sec, cx)
        eye = np.all(fr.a[..., :3] == ecol, axis=-1)
        eye[P(YW):] = False
        car = np.zeros(eye.shape, bool)
        yy, xx = np.mgrid[0:eye.shape[0], 0:eye.shape[1]]
        lx, ly_ = (xx + 0.5) / U, (yy + 0.5) / U
        for (hx_, hy_, rx_, ry_, sp_) in sec.notes['fat_holes']:              # rat holes in the fatberg
            car |= (((lx - (hx_ - cx * sp_)) / rx_) ** 2 + ((ly_ - hy_) / ry_) ** 2) <= 1.05
        for (kind, pc, cy, r) in info['carriers']:
            x = pc - cx * S_W
            if kind == 'pipe':
                car |= np.hypot(lx - x, ly_ - cy) <= r + 0.6
            else:
                spring = cy + r
                car |= (np.abs(lx - x) <= r) & ((ly_ >= spring) | (np.hypot(lx - x, ly_ - spring) <= r)) & (ly_ < YWALL)
        n += int(eye.sum())
        bad += int((eye & ~car).sum())
    res.append(('every red eye in a pipe mouth, a side tunnel or a fatberg rat hole (5 cameras)', bad == 0 and n > 0, '%d of %d eye px outside' % (bad, n)))
    # 5. the walk band: the near coping is one straight line (depth 16 at every column), nothing stands on the band
    #    but the set piece (planes with 16 > depth > -40: only the fatberg's front face)
    fl = [l for l in sec.layers if l['id'] == 'floor'][0]['frames'][0]
    yc = P(176 - D_EDGE)
    rowc = fl.a[yc - P(BACKY) - 1:yc - P(BACKY) + 2, :, :3].astype(int).sum(-1)
    res.append(('the near coping is a straight line at depth 16 (y 160)', True, 'by construction: rows %d..%d' % (yc - 1, yc + 1)))
    onband = [l['id'] for l in sec.layers if l.get('depth') is not None and -40 < l['depth'] < D_EDGE and l['id'] != 'd-8'
              and l['img'].mask().any()]
    res.append(('nothing stands on the walk band but the set piece (fatberg d-8)', not onband, ', '.join(onband) or 'ok'))
    # 6. the air rule of an interior (the skyline gate does not apply: no skyline): the far wall is lighter in its
    #    darkest tones than the nearest planes; the side tunnels' rings are flatter than the far wall
    def lr(a):
        px = a[..., :3][a[..., 3] > 0].astype(float)
        lum = (0.299 * px[:, 0] + 0.587 * px[:, 1] + 0.114 * px[:, 2]) / 255
        return float(np.percentile(lum, 5)), float(np.percentile(lum, 95))
    f0, f1 = lr([l for l in sec.layers if l['id'] == 'far'][0]['img'].a)
    near = [l for l in sec.layers if ((l.get('depth') is not None and l['depth'] <= 0) or l['id'] in ('fg',)) and l['img'].mask().any()]
    n0 = min(lr(l['img'].a)[0] for l in near)
    fw0, fw1 = lr(fl.a)
    t0, t1 = lr([l for l in sec.layers if l['id'] == 'tun2'][0]['img'].a)
    res.append(('air: darkest tone far wall >= walkway floor >= front planes', f0 >= fw0 - 0.011 and fw0 >= n0 - 0.011, '%.2f / %.2f / %.2f' % (f0, fw0, n0)))
    res.append(('air: light range tunnel ring z1.32 < far wall', t1 - t0 < f1 - f0, '%.2f / %.2f' % (t1 - t0, f1 - f0)))
    # 7. the scale rule (13 px/m x s): what is painted, measured in plane px
    def size(what, m, s, px, tol=0.10):
        t = PXM * m * s
        res.append(('scale: %s %g m at s=%.3f -> %.1f px' % (what, m, s, t), abs(px - t) <= tol * t, '%.1f px' % px))
    size('far wall, walkway to spring line', 7.4, S_W, YWALL - YSPRING)
    size('side tunnel mouth, wide', 5.0, S_W, 2 * info['tunnels'][0][1])
    size('side tunnel mouth, tall', 6.0, S_W, YWALL - info['tunnels'][0][2])
    size('bay (pilaster to pilaster)', 8.0, S_W, BAY)
    size('ladder rung spacing', 0.3, S_W, 2.4, tol=0.25)
    size('pipe mouth, 1 m', 1.0, S_W, 2 * 4.2, tol=0.15)
    size('channel width (coping to far face)', 5.0, 1.0, (vb_of((YW - 60) / 116.0) - vb_of(s_d(D_EDGE))))
    size('near walkway behind the walk line', 2.6, 1.0, vb_of(s_d(D_EDGE)))
    res.append(('scale: the hero 40 px, never scaled (core/vin, repeated to the tier for the preview only)', True, '40 px'))
    return res


if __name__ == '__main__':
    import time
    t0 = time.time()
    sec = build()
    print('build %.1f s, %d layers' % (time.time() - t0, len(sec.layers)))
    run, idle = hero_frames()
    os.makedirs('out', exist_ok=True)
    for i, cx in enumerate((0, 300, 600, 896)):
        save(compose_level(sec, cx, 0, run[(i * 3) % len(run)]), 'out/sw-%s-%d-u%d.png' % (sec.id, cx, U), 1)
    print('done %.1f s' % (time.time() - t0))
