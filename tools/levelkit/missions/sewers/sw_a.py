# Section a of mission sewers: DE WALLEN, 23:00, late October drizzle, 3,072 px (docs/design/sewers.md §2.1, §4.1, §6).
# Wave P4b, painter A. Replaces the block-out blk_a.py (which stays as the record of wave P4a).
#
#   U=1 python3 tools/levelkit/lk.py sewers preview sw_a          # work/sewers/out/l1sw-a-*-u1.png (+ layout)
#   U=1 python3 tools/levelkit/lk.py sewers check sw_a
#   python3 tmp/sewers/p4/u4.py sewers check sw_a                  # tier 4 (the painters' lock)
#
# Scene card
#   Place:     the quay of the Oudezijds Achterburgwal: we walk the cobbled quay street (kerbs at 5 and -16.3); behind
#              the far kerb the quay pavement (krul urinals, the quay elm, canal lanterns, chained bikes), the granite
#              coping (27-30), the canal, the far quay with its row of narrow fronts: red rooms behind glass on the
#              ground floors only, closed curtains, our own neon words; the gables against the rain clouds, lit from
#              below by the city; the old church's tower floodlit above the roofs (backdrop only). Two hump bridges
#              cross the canal into depth (1,336-1,480; the limo's bridge 2,880-3,008), bikes chained to their rails.
#   Hour:      a, 23:00, drizzle; key night blue; the neon red and pink; air violet.
#   Planes:    sky 0, clouds 0.03, skyline 0.10, tower 0.14, far quay 0.5 (air 0.12), neon flicker 0.5, water rows
#              0.5 -> 0.741, rain-far 0, floor rows 0.741 -> 1.345, bridge slices (depth 56 .. 27), moored boats 33,
#              lanterns 24, the elm 22, bikes 21.5, the krul 14, the back posts 6.2, the walk plane 0 (empty: play),
#              the front posts -18.4 (over), fg 1.35 (over), the near rain (over).
#   Set piece: GOUDEN GERRIT's limo at the bridge head (2,860-2,980: a figure of the game, not painted); its bridge
#              into depth behind it, lanterns at the crown (Gerrit flees over it).
#   Local:     the krul at 300 and 2,450 (each by a lantern), the quay elm at 520 (lit from below), boats under tarps,
#              umbrellas on the far quay, bikes on the bridge rails, neon puddles, the flickering neon words.
#   Rules:     red light on the ground floor only; no window figures; no banned lettering; the fronts tile; nothing on
#              the walk band (checks_sewers.street_rules); every neon word whole; the roofline under the sky.
import random
import numpy as np
from level import *
from game_sprites import sprites          # noqa: F401  (the bake's hook)
from parts_wallen import *
from parts_sw_a import *
import checks_sewers as cs
import street

SID = 'sewers-a'
NAME = 'De Wallen'
HOUR = 'a'
NOTE = ("The quay of the Oudezijds Achterburgwal at 23:00 in the October drizzle: red rooms behind closed curtains on "
        "the far ground floors, our own neon words, the gables against the rain clouds and the old church's tower "
        "floodlit above them. Two hump bridges cross the canal into depth; GOUDEN GERRIT's limo waits at the second.")
GAME_CAMS = [(0, 192), (200, 210), (1180, 230), (1700, 192), (2240, 192), (2688, 260)]

LAMP_D, LAMP_H = 24.0, 46                  # canal lanterns on the quay pavement: 4.4 m at s 0.79
LAMPS = (120, 330, 560, 800, 1060, 1250, 1580, 1860, 2140, 2420, 2690)
BIKE_D = 21.5
BRIDGES = [(1336, 1480, 13), (2880, 3008, 29)]   # the deck between the parapets (world x); bridge 2: the limo's
BOATS = [(660, 33.0, 'tarp', 56), (1060, 34.0, 'tarp', 48), (2010, 33.0, 'tarp', 60), (2600, 34.5, 'tarp', 50)]
TOWER_X, TOWER_S = 330, 0.18               # the tower's plane x and speed: in view from the start to cam ~1,800
FAR_SEED = 54                              # the far quay's draw (picked: no two neighbouring signs alike)


def plane_layer(sec, depth, front=False):
    k = round(depth * 2) / 2 + 0.0
    lid = 'd%g%s' % (k, 'f' if front else '')
    for l in sec.layers:
        if l['id'] == lid:
            return l, k
    return None, k


def flush_night(sec, keep=KEEP):
    """Sec.flush, but the grade keeps the emitters (lit lanterns, neon) out of the key."""
    for key in sorted(sec.planes, key=lambda kf: (-kf[0], kf[1])):
        k, front = key
        Lp = sec.planes[key]
        Lp.recolor(grader(key=sec.KEY), keep=keep); Lp.recolor(curve(*sec.H['curve']), keep=keep)
        sec.add('d%g%s' % (k, 'f' if front else ''), Lp, s_d(k), over=(k < 0 or front), depth=k, front=front)
    sec.planes = {}


def build():
    sec = Sec(SID, NAME, HOUR)
    rng = random.Random(FAR_SEED)
    # ---- the sky, the far roofs, the tower, the far quay, the canal
    S, CL = night_sky(sec)
    SK = skyline_night(sec, 0.10, yb=60)
    TW, tower_top, _, _ = tower_layer(sec, TOWER_X, s=TOWER_S, top=-8)
    sec.notes['tower_top'] = tower_top
    gaps = [(sec.at(b0, 0.5) - 8, sec.at(b1, 0.5) + 8) for (b0, b1, _) in BRIDGES]
    F, fq = far_quay_a(sec, rng, YH=110, YQ=115, YW=120, speed=0.5, seed=100, gaps=gaps, nst=(2, 2, 2, 2, 3),
                       boats=[('tarp', 60, (38,)), ('sloop', 230, (30, 'green')), ('tarp', 520, (40,)),
                              ('sloop', 900, (34, 'black')), ('tarp', 1150, (44,)), ('tarp', 1430, (36,))])
    sec.notes['far'] = fq
    neon_flicker(sec, F, fq['Fc'], sec.notes['far_words'])
    canal_night(sec, [(S, 'tilex'), (CL, 'tilex'), (SK, 'stretch'), (TW, 'stretch'), (F, 'copy')], F.w, fq['wl'])
    n_far = len(sec.layers)
    # ---- on the water at our quay: boats under tarps
    for (x, d, kind, w) in BOATS:
        sec.put(tarp_boat(random.Random(x), w), x, d, shade=False)
    # ---- the quay pavement (beside the band): lanterns (dark; lit after the grade), the elm, bikes, the krul
    for x in LAMPS:
        sec.put(quay_lamp_a(LAMP_H, lit=False), x, LAMP_D)
    for d in decor(sec, 'decor/sewers-a/tree'):
        th = int(round(scale_px(15, s_d(d['floorDepth']))))
        T, ch = quay_elm_a(th, seed=int(d['x']))
        sec.put(T, d['x'], d['floorDepth'])
        sec.notes['elm'] = (d['x'], d['floorDepth'], T.w, T.h, ch)
    br = random.Random(41)
    for (x, c, fl) in ((132, 'red', True), (548, 'black', False), (812, 'blue', False), (1072, 'black', True),
                       (1600, 'green', False), (1872, 'black', True), (2152, 'white', False), (2702, 'red', True)):
        sec.put(bike(br, c, False), x + (11 if not fl else -11), BIKE_D, flip=fl)
    for (x, c) in ((960, 'black'), (1700, 'red'), (2290, 'blue')):                 # a rack-less pair at the coping
        sec.put(bike(br, c, False), x, BIKE_D + 1.5)
        sec.put(bike(br, 'black', False).flip(), x + 16, BIKE_D + 1.0)
    for d in decor(sec, 'decor/sewers-a/krul'):
        blank = Layer(26, 42)
        sec.put(blank, d['x'], d['floorDepth'])                    # the plane and the contact shade; painted lit below
    for r in sec.L['floor']['rows'] or []:                         # the Amsterdammertjes on the kerbstones
        if r.get('prop') == 'sewers/pole':
            for x in r.get('at') or []:
                sec.put(amst_post(19), x, r['depth'])
    # ---- the floor: wet klinkers, the coping, wet setts, puddles; the neon in the puddles and the lanterns' pools
    fl = floor_layer(sec, extra=quay_extra(sec))
    lights = [(x, LAMP_D, EM[1], 14) for x in LAMPS]
    wet_floor_post(sec, fl, lights)
    sec.plane(0)                                                 # the walk plane: empty (play only)
    flush_night(sec)
    # ---- after the grade: the krul lit by its lantern, the elm lit from below, the lanterns lit
    lay, k = plane_layer(sec, 14.0)
    for d in decor(sec, 'decor/sewers-a/krul'):
        kp = light_krul(sec, krul_a())
        sp = s_d(k)
        lay['img'].blit(kp, sec.at(d['x'], sp) - 13, (GY - k) - 42)
    sec.notes['krul_part'] = light_krul(sec, krul_a())
    if 'elm' in sec.notes:
        ex, ed, ew, eh, ech = sec.notes['elm']
        lay, k = plane_layer(sec, ed)
        sp = s_d(k)
        x0, y0 = sec.at(ex, sp) - ew / 2.0, (GY - k) - eh
        light_tree_from_below(lay['img'], x0, y0, ew, ech,
                              [(ew * 0.20, PINK[3], 1.0), (ew * 0.55, RED[3], 0.8), (ew * 0.85, EM[2], 0.9)])
    lay, k = plane_layer(sec, LAMP_D)
    sp = s_d(k)
    for x in LAMPS:
        cx, cy = sec.at(x, sp), (GY - k) - LAMP_H + 6.5
        glow(lay['img'], cx, cy, 10, HALO_W)
        lp = quay_lamp_a(LAMP_H, lit=True)
        lp.recolor(grader(key=sec.KEY), keep=KEEP)
        lay['img'].blit(lp, cx - 4.5, (GY - k) - LAMP_H)
    sec.notes['lamp_top'] = (GY - LAMP_D) - LAMP_H + 6.5 - 10
    # ---- the bridges in depth: their slices go behind every plane nearer than 27 (draw order far -> near)
    ids = bridges_a(sec, BRIDGES, seed=5)
    brl = [l for l in sec.layers if l['id'] in ids]
    rest = [l for l in sec.layers if l['id'] not in ids]
    i0 = next(i for i, l in enumerate(rest) if l.get('depth') is not None and l['depth'] < 27)
    sec.layers = rest[:i0] + brl + rest[i0:]
    # boats nearer than the bridges' far slices: keep the true order (a boat never stands in a bridge's span)
    # ---- the rain: far (behind the floor), near (over the heroes); dark things at the lower edge
    rain_layers(sec, insert_far=n_far)
    FG = Layer(sec.lw(1.35), VIEW_H)
    fr = random.Random(9)
    for (kind, x) in (('bags', 210), ('bags', 1150), ('bags', 2330), ('bags', 3560)):
        part = fg_bags(fr)
        if fr.random() < 0.5:
            part = part.flip()
        if x < FG.w:
            FG.blit(part, x, VIEW_H - part.h + 2)
    FG.recolor(grader(key=sec.H['fg']))
    rain = [l for l in sec.layers if l['id'] == 'rain'][0]
    sec.layers.insert(sec.layers.index(rain), dict(id='fg', img=FG, speed=1.35, y=0, kind='img', over=True))
    FG.a[..., :3] = snap5(FG.a[..., :3])
    sec.notes['band'] = (street.NEAR, street.FAR)
    return sec


def checks(sec):
    out = cs.street_rules(sec)
    infos = sec.notes['far']['infos']
    st = [x for i in infos for x in i['storeys']]
    v = float(np.mean(st))
    out.append(('scale: storey on the far quay (s 0.50) %.1f px, target 20 +-15%%' % v, abs(v / 20 - 1) <= 0.15, '%.1f' % v))
    gf = [i['gf'] for i in infos]
    out.append(('scale: ground floor on the far quay %d-%d px, target 27 +-15%%' % (min(gf), max(gf)),
                all(abs(g / 27 - 1) <= 0.15 for g in gf), '%.1f' % np.mean(gf)))
    th = scale_px(15, s_d(22))
    out.append(('scale: quay elm 15 m at s %.3f -> %.0f px' % (s_d(22), th), True, '%d' % round(th)))
    # the roofline: the night sky shows over the far row (lead note, P4a review)
    Fa = [l for l in sec.layers if l['id'] == 'far'][0]['img'].a[..., 3] > 0
    tops = np.argmax(Fa, axis=0) / U
    share = float((tops >= 6).mean())
    out.append(('roofline: sky over the far row in >= 60% of its columns (top >= y 6)', share >= 0.60, '%.2f' % share))
    # the tower above the roofs: its px that the far row does not hide, at the cameras where it is on screen
    T = [l for l in sec.layers if l['id'] == 'tower'][0]
    Fl = [l for l in sec.layers if l['id'] == 'far'][0]
    seen = []
    for cx in range(0, sec.cam + 1, 336):
        ta = T['img'].a[:, int(cx * T['speed'] * U):int(cx * T['speed'] * U) + P(VIEW_W), 3] > 0
        fa = Fl['img'].a[:, int(cx * 0.5 * U):int(cx * 0.5 * U) + P(VIEW_W), 3] > 0
        if ta.any():
            seen.append(int((ta & ~fa[:, :ta.shape[1]]).sum()) / (U * U))
    good = sum(1 for v in seen if v >= 40)
    out.append(('the tower shows above the roofs: >= 40 px^2 at >= 80%% of the %d cameras it is on' % len(seen),
                len(seen) >= 4 and good >= 0.8 * len(seen), ' '.join('%d' % v for v in seen)))
    ws = [w for (w, where) in sec.notes.get('words', []) if where == 'far']
    rep = [a for a, b in zip(ws, ws[1:]) if a == b]
    out.append(('no two neighbouring neon signs say the same word', not rep, ' '.join(ws)))
    # every neon word whole (lead note): no thing of the far quay over a lit sign; the lanterns' heads under the signs
    nw = len(sec.notes['far_words'])
    out.append(('every neon word whole: street px over %d lit signs (far layer)' % nw, sec.notes['word_cover'] == 0 and nw > 0,
                sec.notes['word_cover']))
    low = max(b[1] + b[3] for b in sec.notes['far_words'])
    out.append(('quay lanterns and their halo under the sign band (top %.1f > %.1f)' % (sec.notes['lamp_top'], low),
                sec.notes['lamp_top'] > low, '%.1f' % sec.notes['lamp_top']))
    # the krul reads green (lead note: it read as a grey bin)
    K = sec.notes['krul_part'].a
    m = K[..., 3] > 0
    px = K[..., :3][m].astype(int)
    green = float(((px[:, 1] > px[:, 0] + 6) & (px[:, 1] >= px[:, 2])).sum() / max(1, m.sum()))
    out.append(('the krul reads green: share of its px with green > red and >= blue', green >= 0.45, '%.2f' % green))
    return out


if __name__ == '__main__':
    import time
    t0 = time.time()
    sec = build()
    print('build %.1f s, %d layers' % (time.time() - t0, len(sec.layers)))
    preview(sec, cams=[c for (c, _) in GAME_CAMS], tag='sw-a')
