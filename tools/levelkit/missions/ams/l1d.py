# Section d of level 1 (mission ams): STOPERA, orange-pink sunset; the boss arena.
#
# Scene card
#   Place:      the Waterlooplein flea market (0-896) on fan-laid setts before a row of canal houses; the forecourt
#               of the Stopera (896-1280, the camera lock): the curved white marble-and-glass music theatre on the
#               Amstel and the red-brick city-hall wing with white bands and its big glass doors (the mayor's x 1190).
#   Hour:       sunset; key and air of HOURS['sunset'] (mission.py), near scene c of the study; key hue orange-pink.
#   Set piece:  the Stopera, drawn where the game draws it: depth 12, anchor x 863.19 (ox 1), doors at u 1190.
#   Water:      the Amstel behind the market, seen over the roofs' gaps and beside the theatre (river, 20 rows).
#   Planes:     sky 0 (sun low at screen x 262) · clouds 0.02 · skyline 0.10 · far bank 0.30 · water 0.30 -> 0.741 ·
#               floor (rows) · houses 14 · Stopera 12 · lamp/flag 12.5 · flags 8 · tulips 6 · stalls 5 · walk plane 0 ·
#               front row -23 · fg 1.35 (two low things at the market's lower edge, none in the arena).
#   Local:      striped stalls with clothes, records, lamps; the breakable stall and bike rack in the walk plane;
#               Amsterdammertjes on kerbstones; the flags of the city and the country; tulips; lit shops KOFFIE,
#               BOEKEN, BLOEMEN, KAAS; the STADHUIS plaque; the lit foyer of the theatre; the lobby behind the doors.
#   Rules:      posts on kerbstones only (checks); no figures; the doors at the mayor's x (checks).
#   Scale:      13 px/m x the plane's speed (SCALE-BRIEF.md): houses d14 storey 35, Stopera d12 storey 36 (wing 25 m),
#               far bank 0.30 storey 12, skyline 0.10 storey 4; stalls, racks, posts keep the hero's scale (checks).
import time
from parts_l1d import *
from game_sprites import entity, sprites     # the breakables the game draws as entities (docs/api/canal.md §7)

# The fidelity cameras of the game bake (bake_game.py): (camera x, the screen x the tier-2 / tier-4 crops centre on).
# First screen; the lamp at 310 and the alley to the Amstel; the market's middle; the front records (fg) and the lamp
# at 820; the second alley and the city flag; the granite band and the theatre's end; the forecourt and the tulips; the
# arena lock (the last screen) on the doors at the mayor's x 1190.
GAME_CAMS = [(0, 192), (160, 150), (360, 192), (540, 100), (600, 250), (760, 192), (840, 150), (896, 294)]

NOTE = ("The Waterlooplein flea market at sunset: striped stalls on fan-laid setts before the canal houses, shops and "
        "rooms lit, the Amstel and its far bank in the gaps. The arena: the Stopera's curved marble-and-glass theatre with "
        "its foyer lit and the red-brick city hall, whose lit glass doors stand at the mayor's x.")

SUN = (262, 56)
YH, YQ, YW, FS = 117, 120, 126, 0.30
ALLEYS = ((276, 298), (588, 612))   # side streets between the market houses, open to the Amstel (world x)


def build():
    sec = Sec('d', 'Stopera', 'sunset')
    rng = random.Random(41)
    pools = []
    # ---- far planes
    S, CL = sky_d(sec, SUN)
    SK = skyline_d(sec, 0.10, 118)
    F, fb = far_d(sec, rng, YH, YQ, YW, FS)
    water_d(sec, [(S, 'tilex'), (CL, 'tilex'), (SK, 'stretch'), (F, 'copy')], F.w, YW, FS,
            lights=[(x, EM[1], 0.7) for (x, y) in fb['lamps']])
    glitter_d(sec, SUN[0], YW)
    # ---- the house fronts of the market (depth 14): one row at the scale rule over the span of the game's houses,
    #      a side street open to the Amstel (ALLEY), the river beyond the last house
    hs_ = [d for d in sec.L['decor'] if d['sprite'] == 'decor/ams/house-sunset']
    hdep = hs_[0]['floorDepth']
    u1 = max(d['x'] - d['box']['ox'] + d['box']['w'] for d in hs_)
    infos, hk = market_row(sec, rng, hdep, -60, u1, gaps=ALLEYS)
    sph = s_d(hk)
    sec.notes['storey_houses'] = [i['storey'] for i in infos]
    for info in infos:
        ox, oy = info['x'], info['y']
        if info.get('lamp') and not info.get('sign'):              # (a shop's sign hangs where the lamp would glow)
            lx, ly = info['lamp']
            def door_lamp(Lp, p=(ox + lx, oy + ly)):
                glow(Lp, p[0], p[1], 7, HALO_S)
                Lp.rect(p[0] - 0.5, p[1] - 1.5, 2, 3, EM[0])
            hook(sec, hdep, door_lamp)
        if info.get('shop'):
            pools.append((192 + (ox + info['w'] / 2 - 192) / sph, 13.2, info['w'] * 0.5, 3.2, 0.42))
    # ---- the Stopera (depth 12, anchored at its left like the game's floor copy)
    st = [d for d in sec.L['decor'] if d['sprite'] == 'decor/ams/stopera' and d['floorDepth'] is not None][0]
    SP, sinfo = stopera()
    sec.put(SP, st['x'], st['floorDepth'], ax=st['box']['ox'])
    TE = theatre_end()
    sec.put(TE, st['x'], st['floorDepth'], ax=TE.w + st['box']['ox'], shade=False)
    ox, oy = origin(sec, SP, st['x'], st['floorDepth'], ax=st['box']['ox'])
    sp12 = s_d(st['floorDepth'])

    def stopera_light(Lp):
        for (lx, ly) in sinfo['lamps']:
            glow(Lp, ox + lx, oy + ly, 9, HALO)
            Lp.rect(ox + lx - 1, oy + ly - 2, 2, 4, EM[0])
        dx0, dy0, dw, dh = sinfo['doors']
        tint(Lp, ox + dx0 + dw / 2, oy + BASE - 3, 62, 9, (255, 214, 150), a1=0.40, a2=0.20, ymin=oy + BASE - 8)
    hook(sec, st['floorDepth'], stopera_light)
    u_door = st['x'] + (DOOR - st['box']['ox']) / sp12
    pools.append((u_door, 8.0, 60, 10, 0.50))
    for (lx, ly) in sinfo['lamps']:
        pools.append((st['x'] + (lx - st['box']['ox']) / sp12, 11.0, 14, 3.5, 0.40))
    for (fx, _) in sinfo['foyer']:
        pools.append((st['x'] + (fx - 1) / sp12, 10.5, 18, 4, 0.34))
    # ---- market stalls at the back of the square (depth 5) and the breakables in the walk plane
    for i, d in enumerate([d for d in sec.L['decor'] if d['sprite'] == 'decor/ams/market-stall']):
        P_, bulbs = stall(rng, d.get('frame', 0), bulb=(i % 2 == 0), seed=i * 5 + 1)
        sec.put(P_, d['x'], d['floorDepth'], ax=d['box']['ox'])
        ox_, oy_ = origin(sec, P_, d['x'], d['floorDepth'], ax=d['box']['ox'])
        for (bx, by) in bulbs:
            def bulb_glow(Lp, p=(ox_ + bx, oy_ + by)):
                glow(Lp, p[0], p[1], 7, HALO_S)
                Lp.rect(p[0] - 0.75, p[1] - 0.75, 1.5, 1.5, EM[0])
            hook(sec, d['floorDepth'], bulb_glow)
    # The breakables the script spawns: on the page painted at their spawn x; in a game bake they leave the scene and
    # their paintings become frame 0 (intact) of the entities' sprites (the wrecks, frame 1, keep the game's art).
    # One picture per id: the stall at 560 shows the painting of the one at 200 in the game.
    for x in (200, 560):                                         # ams-market-stall (spawned by the script), intact
        entity(sec, 'decor/ams/ams-market-stall', stall_small(rng, seed=x), x, 0)
    entity(sec, 'decor/ams/ams-bike-rack', rack_small(rng), 336, 0)   # ams-bike-rack (spawned), intact
    # ---- the common decor; the lamps lit at sunset
    standard_decor(sec, rng, skip=('decor/ams/lamp',))
    for d in [d for d in sec.L['decor'] if d['sprite'] == 'decor/ams/lamp']:
        dep = d['floorDepth']
        lp = lamp(q_(LAMP_H * s_d(dep)), lit=True)                 # LAMP_H on the walk plane, in proportion behind it
        sec.put(lp, d['x'], dep)
        ox_, oy_ = origin(sec, lp, d['x'], dep)

        def lamp_glow(Lp, p=(ox_, oy_), lp=lp):
            glow(Lp, p[0] + 8.5, p[1] + 14, 13, HALO)
            Lp.blit(graded(sec, lp_copy(lp)), p[0], p[1])
        hook(sec, dep, lamp_glow)
        pools.append((d['x'], dep, 22, 5 + 3 * (dep <= 0), 0.36))
    # ---- the floor
    floor_layer(sec, extra=floor_d(sec, pools, quays=((-1e9, 6), (760, 1000)) + ALLEYS))
    flush_d(sec, air={14.0: 0.12, 12.5: 0.08, 12.0: 0.08})
    # ---- two low front things at the lower edge of the market (none in the arena)
    FG = Layer(sec.lw(1.35), VIEW_H)
    FG.blit(fg_records(rng), 250, VIEW_H - 22)
    FG.blit(fg_records(random.Random(7)).flip(), 820, VIEW_H - 22)
    FG.recolor(grader(key=((30, 12, 30), (160, 96, 84), 0.80, 0.1)))
    sec.add('fg', FG, 1.35, over=True)
    return sec


def preview_d(sec, cams):
    """level.preview for more than four cameras (its hero frame index runs out at the fifth)."""
    run, idle = hero_frames()
    os.makedirs('out', exist_ok=True)
    for i, cx in enumerate(cams):
        save(compose_level(sec, cx, 0, run[(i * 3) % len(run)]), f'out/l1{sec.id}-{i}-u{U}.png', 1)
    save(compose_level(sec, cams[len(cams) // 2], 0, run[0], overlay=True), f'out/l1{sec.id}-layout-u{U}.png', 1)


def lp_copy(lp):
    o = Layer(lp.w, lp.h); o.a = lp.a.copy(); return o


def checks(sec):
    bad = post_on_kerb(sec)
    res = [('Amsterdammertjes on kerbstones only', not bad, ', '.join(bad) or 'ok')]
    fr = compose_level(sec, sec.cam)                              # the locked arena camera
    hx_ = 1190 - sec.cam                                          # the mayor's screen x at the lock
    col = fr.a[P(150), P(hx_ - 12):P(hx_ + 12), :3].astype(float)
    lumv = (0.30 * col[:, 0] + 0.59 * col[:, 1] + 0.11 * col[:, 2]) / 255
    warm = (col[:, 0] > col[:, 2] + 40)
    res.append(('the lit glass doors at the mayor\'s x 1190 (arena camera)', float((lumv > 0.62).mean()) > 0.6 and warm.mean() > 0.6,
                '%.2f lit' % float((lumv > 0.62).mean())))
    # the scale rule (SCALE-BRIEF.md): a storey is 40 px x the plane's speed, +-15 %; measured from what is painted
    def storey(name, s, vals):
        t = 40 * s
        ok = all(abs(v - t) <= 0.15 * t for v in vals)
        res.append(('storey on %s (s=%.2f): %.1f px, target %.0f +-15%%' % (name, s, sum(vals) / len(vals), t), ok,
                    '%.1f..%.1f' % (min(vals), max(vals))))
    storey('the market houses d14', s_d(14), sec.notes['storey_houses'])
    storey('the Stopera d12', S12, [FLR])
    storey('the far bank of the Amstel', FS, list(sec.notes['storey_far']))
    storey('the skyline', 0.10, [SKY_STOREY])
    # the landmark and the scenery that stands with the buildings (13 px/m x s)
    def size(what, m, s, px, tol=0.15):
        t = 13 * m * s
        res.append(('%s %g m at s=%.2f: %.0f px' % (what, m, s, t), abs(px - t) <= tol * t, '%.0f px' % px))
    size('Stopera city-hall wing', 25, S12, WING_H)
    size('Stopera theatre drum (four floors on a glass ground floor)', 17, S12, DRUM)
    # the lamps: the game's lamp, 72 px (5.5 m) on the walk plane (a gull perches at 70 px on the lamp at 820), in
    # proportion behind it (street pass 2026-11-11; it was 104 px / 8 m)
    res.append(('lamp on the walk plane: the game\'s 72 px (gull perch at 70)', LAMP_H == 72, '%d px' % LAMP_H))
    size('lamp before the houses d12.5 (5.5 m)', 5.5, s_d(12.5), q_(LAMP_H * s_d(12.5)), tol=0.05)
    trees = sec.notes['far_tree']
    res.append(('far trees 14-18 m at s=0.30: 55-70 px', all(52 <= h <= 72 for h in trees), '%d..%d px' % (min(trees), max(trees))))
    size('far lamp', 4.6, FS, FAR_LAMP)
    size('far car', 4.3, FS, 17)
    size('far bike', 1.8, FS, 7)
    return res


if __name__ == '__main__':
    t0 = time.time()
    sec = build()
    print('build %.1f s' % (time.time() - t0))
    preview_d(sec, cams=(0, 180, 360, 540, 700, sec.cam))
    print('done %.1f s' % (time.time() - t0))
