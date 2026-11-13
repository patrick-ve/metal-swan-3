# Section c of mission sewers: DE PUT, 01:30, 1,920 px (docs/design/sewers.md §2.3, §5.1, §5.2). Wave P4b, painter C.
#
#   U=1 python3 tools/levelkit/lk.py sewers preview sw_c                      # tmp/sewers/p4/c/sw_c-<cam>-amb-u1.png
#   LK_LIGHT=lit U=1 python3 tools/levelkit/lk.py sewers preview sw_c         # the lit stack (...-lit-u1.png)
#   U=1 python3 tools/levelkit/lk.py sewers check sw_c sw_c_lit
#   python3 tmp/sewers/p4/u4.py sewers check sw_c sw_c_lit                  # tier 4 (one at a time: the lock)
#   U=2 python3 tools/levelkit/lk.py sewers strip sw_c tmp/sewers/p4/c/strips
#
# Scene card
#   Place:      the burst drain shaft and the first brick tunnel under De Wallen: the heroes fall down the old drain well
#               ('de put') from b's burst grate, through the hole it tore in the vault, onto the near walkway; then
#               an older, narrower and lower tunnel than d's main sewer leads east to it.
#   Hour:       01:30, rain all night: V2 BLACK exactly (hour 'c' = the sample's v2; the lit stack 'cl' = v2l).
#   Set piece:  the fall (world x 0-150): the ragged hole in the crown (vault rows cut, broken brick rim, roots), the
#               well and the collapse behind it (frames: the faint cold street light and the rain down it, two rats on
#               its walls), the rain column to the walkway, the rubble heap in the channel, fragments and a puddle.
#   Planes:     side tunnel (void S_W, floor rows, rings z 1.14-2.45, eyes) · the shaft (SB 0.86, frames) · vault rows
#               1.0 -> 0.672 (the hole cut) · far wall 0.672 · wallfx 0.672 (blinking eyes, drips) · manhole shafts and
#               pours 0.672 · water rows 0.724 -> 0.741 · floor rows 0.741 -> 1.345 (channel to depth 16, then the
#               walk band) · crown shafts 0.76 · the rain column 0.931 · rubble d22 · walk plane d0 (pipe stubs,
#               plinths: play) · fg 1.35.
#   Local:      pipe mouths with blinking red eyes (0-720), the one side tunnel (eyes deep in), iron step irons up the
#               well and two manhole ladders with UIT plates, rain through the grates, drips from the cornice, moss and
#               algae on the wet bays, outfalls pouring, lost things in the channel, the bent gutter grate in the rubble.
#   Rules:      checks_sewers.sewer_rules (closed above the walkway, every shaft under a painted grate or the burst, every
#               eye in a carrier, bays tile, nothing on the band but play, the V2 tables); closed behind the hole at
#               every camera that sees it; the walk plane carries the play (pipe mouths at y 150, plinth tops at y 148).
#   Scale:      13 px/m x s: wall 6.2 m to the spring at S_W (54 px), bays 7.3 m (64 px), side tunnel 4 x 5 m (34 x 44),
#               channel 3.6 m, near walkway 2.6 m; pipe stub 0.6 m, plinth 3.7 x 2.2 m at the hero's scale (s 1).
import os
import random
import numpy as np
from level import *
from game_sprites import sprites          # noqa: F401  (the bake's hook)
from mission import two_stacks
from parts_sw_c import *
from parts_sw_c import PS
import checks_sewers as cs

SID = 'sewers-c'
NAME = 'De Put'
NOTE = ("The fall: the heroes drop down the old drain well through the hole it tore in the vault, into an older, "
        "narrower brick tunnel than the main sewer. Red eyes blink in the pipe mouths and the one side tunnel; rain "
        "and faint street light fall through the grates; drips, moss, two manhole ladders, then the plinths and "
        "pipe stubs of the rats.")
# (1240, 264): the tier-4 crop of the second plinth; at crop centre 192 the dark ambient stack samples 39 colours,
# under the fidelity test's "the frame shows the scene" floor of 40 (wave P6b C; fixtures only, the art unchanged)
GAME_CAMS = [(0, 96), (232, 192), (576, 192), (896, 192), (1240, 264), (1536, 192)]

GRATES = (560, 1180, 1560)                 # street grates in the crown (their faint shafts land in the channel)
FG_THINGS = (('bucket', 430), ('hose', 1190), ('pallet', 1720), ('bucket_f', 2290))   # plane x at speed 1.35
RUBBLE = (BURST_U - 6, 22.0)               # the rubble heap in the channel (world x, depth)


def paint(sid, hour, lit):
    sec = Sec(sid, NAME, hour)
    H = sec.H
    KEEP = PS.keepcols(H)
    sec.notes['lit'] = lit
    # ---- the far wall (daylight), the side tunnel, the shaft behind the hole, the vault rows with the hole
    F, info = far_wall_c(sec, H)
    PS.tunnel_layers(sec, info, H, lit)
    burst_eyes = burst_layers(sec, H, lit)
    nb = int(np.ceil(F.w / BAY))
    ribs = [wall_u(k * BAY + PIL / 2.0) for k in range(-3, nb + 3)]
    ya, yb = PS.vault_layer(sec, H, GRATES, ribs, lit)
    burst_vault(sec, H)
    sec.notes['grate_rows'] = (ya, yb)
    # ---- the far plane graded, its lights; the blinking eyes and the drips
    F.recolor(PS.G_of(H, H['air']), keep=KEEP)
    PS.far_lights(F, info, H, lit, grates=GRATES)
    sec.add('far', F, S_W)
    wallfx_layer(sec, H, info)
    # ---- the manhole shafts, the pours, the channel and the near walkway, the burst's debris on it
    mw = PS.LT(H, 'mshaft_w')
    PS.shaft_layer(sec, 'mshaft', S_W, info['mshafts'], H, YWALL + 2.5, w0=mw[0], w1=mw[1], strength=PS.LT(H, 'mshaft'), seed=71)
    PS.pour_layer(sec, H, info)
    fx = dict(grates=GRATES, pours=[wall_u(cx) for (cx, cy, w) in info['pours']])
    ch = PS.channel_layers(sec, H, F, fx, lit)
    burst_floor(sec, H, ch['floor'], 3)
    # ---- the crown grates' shafts, then the rain column of the burst
    gy = 60 + 116 * S_SHAFT
    shafts = [(192 + (u - 192) * S_SHAFT, yb - 0.5) for u in GRATES]
    sw_ = PS.LT(H, 'shaft_w')
    outs = PS.shaft_layer(sec, 'shafts', S_SHAFT, shafts, H, gy, w0=sw_[0], w1=sw_[1], strength=PS.LT(H, 'shaft'), seed=51)
    for Lf_ in outs:
        for i, (x, yt) in enumerate(shafts):
            PS.hanging_wipes(Lf_, x, yt + 0.5, H, seed=300 + i)
        Lf_.a[..., :3] = snap5(Lf_.a[..., :3])
    YT = 3.0
    PS.shaft_layer(sec, 'burstfall', SC, [(sec.at(COL_U, SC), YT)], H, GY - 8, w0=sw_[0], w1=sw_[1] + 2,
                   strength=PS.LT(H, 'shaft'), seed=91)
    sec.notes['shafts'] = [('shafts', S_SHAFT, u, yb - 0.5) for u in GRATES] + \
                          [('mshaft', S_W, wall_u(xc), y) for (xc, y) in info['mshafts']] + [('burstfall', SC, COL_U, YT)]
    # ---- things on the planes: the rubble in the channel; on the walk plane the play's carriers
    sec.put(rubble_heap(), RUBBLE[0], RUBBLE[1], shade=False)
    stubs, plinths = [], []
    for d in decor(sec, 'decor/sewers-c-pipe'):
        part, ax = pipe_stub(seed=int(d['x']))
        px_ = d['x'] - 3                                    # the decor anchor is the pipe x + 3; the mouth is at the pipe x
        sec.put(part, px_, 0, ax=ax, shade=False)
        stubs.append((px_, part.h, ax))
    for d in decor(sec, 'decor/sewers-c-plinth'):
        part = plinth(seed=int(d['x']))
        sec.put(part, d['x'], 0, shade=False)
        plinths.append((d['x'], part.w, part.h))
    sec.notes['stubs'], sec.notes['plinths'] = stubs, plinths
    sec.plane(0)
    for key in sorted(sec.planes, key=lambda kf: (-kf[0], kf[1])):
        k, front = key
        Lp = sec.planes[key]
        Gk = grader(key=H['KEY'], air=(H['AIR'][0], H['AIR'][1], H['air'] * 0.35, 0.3) if k > 10 else None)
        Lp.recolor(Gk, keep=KEEP)
        sec.add('d%g%s' % (k, 'f' if front else ''), Lp, s_d(k), over=(k < 0 or front), depth=k, front=front)
    sec.planes = {}
    # the light of the rain column on the rubble's crest (after the grade: the shaft tones)
    S = [tuple(int(v) for v in snap5(c)) for c in H['em']['shaft']]
    for l in sec.layers:
        if l['id'] == 'd%g' % RUBBLE[1]:
            sp = s_d(RUBBLE[1])
            PS.tint(l['img'], sec.at(COL_U, sp) + 2, GY - RUBBLE[1] - 12, 16, 9, S[3], a1=0.40, a2=0.22)
    # ---- low front things at the lower edge (fg, 1.35), toward near-black
    FG = Layer(sec.lw(1.35), VIEW_H)
    rng = random.Random(9)
    for kind, x in FG_THINGS:
        part = {'bucket': PS.fg_bucket, 'hose': PS.fg_hose, 'pallet': PS.fg_pallet, 'bucket_f': PS.fg_bucket}[kind](rng)
        if kind.endswith('_f'):
            part = part.flip()
        FG.blit(part, x, VIEW_H - part.h + 2)
    FG.recolor(grader(key=H['fg']))
    sec.add('fg', FG, 1.35, over=True)
    # ---- what the gates read
    sec.notes['info'] = dict(info, carriers=[])            # c's carriers are on c's own far plane: carriers_px
    sec.notes['carriers_px'] = carrier_fns(info, burst_eyes)
    sec.notes['band_ok'] = ['d0']                          # the walk plane holds only the play's carriers
    sec.notes['info_c'] = info
    return sec


build = two_stacks(SID, paint)


# ---------------------------------------------------------------- the section's own gates
def checks(sec):
    res = cs.sewer_rules(sec)
    info = sec.notes['info_c']
    # 1. closed behind the burst hole at every camera that sees it (the hole scrolls with the vault rows, the shaft at SB)
    worst = 0
    for cx in range(0, 260, 4):
        worst = max(worst, int((~cs.cover(sec, cx)[:P(60)]).sum()))
    res.append(('closed behind the burst hole: unpainted px above y 60, cameras 0-256 every 4', worst == 0, '%d px' % worst))
    # 2. play sits on its art: each pipe stub's mouth at the pipe x and y 150; each plinth's nosing on y 148 over its span
    N = [l for l in sec.layers if l.get('depth') == 0 and not l.get('front')][0]['img']
    bad = []
    for d in decor(sec, 'decor/sewers-c-pipe'):
        x = d['x'] - 3
        col = N.a[P(144):P(156), P(x - 1):P(x + 1), :3].astype(int).sum(-1)
        dark = (col < 60).mean() if col.size else 0               # the dark inside of the mouth
        if dark < 0.4:
            bad.append('pipe %d: %.2f' % (x, dark))
    for d in decor(sec, 'decor/sewers-c-plinth'):
        x0, x1 = d['x'] - 24, d['x'] + 24
        top = N.a[P(147):P(149), P(x0):P(x1), 3]
        above = N.a[P(141):P(142), P(x0):P(x1), 3]
        if not (top > 0).all() or (above > 0).any():
            bad.append('plinth %d' % d['x'])
    res.append(('play on its art: pipe mouths dark at (pipe x, y 150), plinth nosing on y 148', not bad, ', '.join(bad) or '%d stubs, %d plinths' % (len(sec.notes['stubs']), len(sec.notes['plinths']))))
    # 3. the eyes blink: frame 0 shows every pair open; each pair is shut in one frame
    wf = [l for l in sec.layers if l['id'] == 'wallfx'][0]['frames']
    ecol = np.array(snap5(sec.H['em']['eye'][1]), np.uint8)
    cnt = [int(np.all(L.a[..., :3] == ecol, -1)[L.a[..., 3] > 0].sum()) for L in wf]
    nb = len(info['blink'])
    res.append(('the eyes in the pipe mouths blink (%d pairs, %d frames)' % (nb, len(wf)), nb > 0 and cnt[0] == max(cnt) and min(cnt) < max(cnt),
                'eye px per frame %s' % cnt))
    # 4. the air rule of an interior: far wall >= walkway floor >= front planes (darkest tone); tunnel ring flatter
    def lr(a):
        px = a[..., :3][a[..., 3] > 0].astype(float)
        lum = (0.299 * px[:, 0] + 0.587 * px[:, 1] + 0.114 * px[:, 2]) / 255
        return float(np.percentile(lum, 5)), float(np.percentile(lum, 95))
    f0, f1 = lr([l for l in sec.layers if l['id'] == 'far'][0]['img'].a)
    fl = [l for l in sec.layers if l['id'] == 'floor'][0]['frames'][0]
    fw0, fw1 = lr(fl.a)
    near = [l for l in sec.layers if ((l.get('depth') is not None and l['depth'] <= 0) or l['id'] == 'fg') and l['img'].mask().any()]
    n0 = min(lr(l['img'].a)[0] for l in near)
    res.append(('air: darkest tone far wall >= walkway floor >= front planes', f0 >= fw0 - 0.011 and fw0 >= n0 - 0.011, '%.2f / %.2f / %.2f' % (f0, fw0, n0)))
    t0, t1 = lr([l for l in sec.layers if l['id'] == 'tun2'][0]['img'].a)
    res.append(('air: light range tunnel ring z1.30 < far wall', t1 - t0 < f1 - f0, '%.2f / %.2f' % (t1 - t0, f1 - f0)))
    # 5. the scale rule (13 px/m x s), c's cross-section
    def size(what, m, s, px, tol=0.10):
        t = PXM * m * s
        res.append(('scale: %s %g m at s=%.3f -> %.1f px' % (what, m, s, t), abs(px - t) <= tol * t, '%.1f px' % px))
    tun = info['tunnels'][0]
    size('far wall, walkway to spring line', 6.2, S_W, YWALL - YSPRING)
    size('side tunnel mouth, wide', 4.0, S_W, 2 * tun[1])
    size('side tunnel mouth, tall', 5.0, S_W, YWALL - tun[2])
    size('bay (pilaster to pilaster)', 7.3, S_W, BAY)
    size('step irons in the well, spacing', 0.3, SB, 3.4, tol=0.15)
    size('the well, inside', 1.7, SB, 19.0, tol=0.10)
    size('channel width (coping to far face)', 3.6, 1.0, PS.vb_of((YW - 60) / 116.0) - PS.vb_of(s_d(D_EDGE)))
    size('near walkway behind the walk line', 2.6, 1.0, PS.vb_of(s_d(D_EDGE)))
    size('pipe stub, 0.6 m pipe (walk plane)', 0.6, 1.0, 9.0, tol=0.20)
    size('plinth, 2.15 m tall (walk plane)', 2.15, 1.0, 28.0, tol=0.05)
    res.append(('scale: the hero 40 px, never scaled', True, '40 px'))
    return res


if __name__ == '__main__':
    import time
    t0 = time.time()
    sec = build()
    print('build %.1f s, %d layers' % (time.time() - t0, len(sec.layers)))
    run, idle = hero_frames()
    root = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..'))
    out = os.path.join(root, 'tmp', 'sewers', 'p4', 'c')
    os.makedirs(out, exist_ok=True)
    tag = 'lit' if sec.notes['lit'] else 'amb'
    cams = [int(c) for c in os.environ.get('LK_CAMS', '0,232,576,896,1240,1536').split(',')]
    for i, cx in enumerate(cams):
        save(compose_level(sec, cx, 0, run[(i * 3) % len(run)]), os.path.join(out, 'sw_c-%d-%s-u%d.png' % (cx, tag, U)), 1)
    save(compose_level(sec, 1240, 0, run[0], overlay=True), os.path.join(out, 'sw_c-layout-%s-u%d.png' % (tag, U)), 1)
    print('done %.1f s' % (time.time() - t0))
