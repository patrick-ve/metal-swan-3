# Scene 3: the wide river at sunset. Key hue: orange, with violet shade. A big sky, a low far bank,
# silhouettes against the sun, a path of glitter on the water. The light comes from behind the scene.
from sets import *

HALO = [(255, 246, 200), (255, 224, 140), (250, 176, 96), (226, 132, 84)]


def build():
    sc = Scene('c', 'Amstel', 'Sunset')
    rng = random.Random(37)
    AIR = ((122, 54, 70), (255, 176, 96))
    KEY = ((64, 26, 48), (255, 198, 112), 0.64, 0.10)
    sc.notes['shadow'] = (76, 34, 48)
    SUNX, SUNY = 250, 64
    # ---- sky
    S, spal = sky(VIEW_W, 150, [(0, '#4a2a4c'), (0.26, '#803a52'), (0.50, '#c8523a'), (0.72, '#f08e38'), (0.90, '#ffc458'), (1, '#ffe07c')],
                  n=18, seed=6, streak=0.045, glow=(SUNX, SUNY + 34, 150, 62, 0.22))
    glow(S, SUNX, SUNY, 26, [(255, 244, 180), (255, 230, 140), (255, 208, 104), (250, 180, 84)])
    S.ellipse(SUNX, SUNY, 10.5, 10.5, (255, 250, 214)); S.ellipse(SUNX, SUNY, 8, 8, (255, 255, 236))
    sc.add('sky', S, 0)
    cp = [hx(c) for c in ('#582c4c', '#84384e', '#b84a44', '#ea783c', '#ffb04c', '#ffd878')]
    CL = Layer(720, 112)
    for (x, y, w, h, sd) in [(0, 6, 360, 30, 41), (330, 22, 390, 30, 42), (90, 46, 330, 26, 43), (430, 60, 290, 22, 44), (0, 74, 260, 20, 45)]:
        CL.blit(wisp(w, h, cp, sd, cover=0.52, sx=46, sy=6.5, tilt=-0.01), x, y)
    sc.add('clouds', CL, 0.02, y=0, kind='tile', drift=0.8)
    # ---- far skyline: towers, a dome, a mill, all in the air of the sun
    W1 = lw(0.10)
    SK = Layer(W1, VIEW_H)
    YS = 118
    far_roofs(SK, 0, W1, YS, random.Random(9), 8, 20)
    SK.blit(tower(84), 96, YS - 84); SK.blit(dome_church(40, 50), 168, YS - 50)
    wm = windmill(46); SK.blit(wm, 318, YS - wm.h)
    SK.blit(tower(62), 28, YS - 62)
    SK.recolor(grader(key=KEY, air=(AIR[0], AIR[1], 0.70, 0.2)))
    SK.clear(0, YS, W1, VIEW_H)
    sc.add('skyline', SK, 0.10)
    # ---- far bank: small houses, a drawbridge at a canal mouth
    WF = lw(0.3)
    YH, YQ, YW = 117, 120, 126
    F = Layer(WF, VIEW_H)
    GX0, GX1 = 210, 262
    fb = far_bank(F, rng, YH, YQ, YW, gap=(GX0, GX1), bridge='draw',
                  house=dict(sc=0.62, hmin=34, hmax=50, wmin=19, wmax=29, shops=0),
                  trees=dict(cw=(22, 30), ch=(18, 24), th=(10, 13), step=(44, 80)), AIR=AIR, sun_shade=False, cars=0.3, lamp_step=70,
                  lit=True, bikes=0.2,
                  vista_kw=dict(base_m=0.25, step_m=0.09, ytop=(66, 80), water_c=((150, 80, 70), (255, 190, 110)), lit=(0.3, EM[1])),
                  vista3=dict(key=KEY, speed=0.3, far_m=0.34, far_sat=0.1, sc=0.62, qw=9, lit=0.2, wcols=((74, 34, 56), (226, 128, 74), (255, 226, 150)),
                              house=dict(hmin=34, hmax=50, wmin=19, wmax=29, shops=0), tree=dict(cw=(22, 30), ch=(18, 24), th=(10, 13))),
                  boats=[('sloop', 40, (22, 'black')), ('house', 80, (60, 'white')), ('sloop', 300, (24, 'red')), ('barge', 350, (96,)),
                         ('sloop', 470, (22, 'blue'))])
    F.recolor(grader(key=KEY, air=(AIR[0], AIR[1], 0.34, 0.1)), keep=EM)
    fb['vista_refl'].recolor(grader(key=KEY, air=(AIR[0], AIR[1], 0.34, 0.1)), keep=EM)
    lit = light_windows(F, fb['win'], 0.22, rng)
    wl = []
    for (x, y) in fb['lamps']:
        F.px(x, y, EM[0]); F.px(x, y + 1, EM[1])
    sc.add('vista', None, 0.3, kind='vista', refl=fb['vista_refl'], v3=fb['vista3'])
    sc.add('far', F, 0.3)
    # ---- water: 46 rows, orange far, violet near
    src = flatten([(S, 'tilex'), (CL, 'tilex'), (SK, 'stretch'), (fb['vista_refl'], 'copy'), (F, 'copy')], WF, YW + 1)
    rows = 46
    wat = water(src, YW, rows, WF, lw(0.9), (226, 128, 74), (74, 34, 56), (255, 226, 150), seed=25, k=2.4, ncol=30,
                mix0=0.30, mix1=0.66, wob=(0.5, 3.2))
    sc.add('water', None, 0.3, y=YW, kind='rows', frames=wat, s0=0.3, s1=0.9)
    # the glitter path under the sun: it stays under the sun, so it does not scroll
    gl = []
    for f in range(3):
        G = Layer(VIEW_W, rows)
        xx, yy = grid(0, 0, VIEW_W, rows)
        r = np.floor(yy * DET) / DET / (rows - 1)
        hw = 7 + r * 40
        d = np.abs(xx - SUNX) / hw
        p = hash01((xx + f * 3) / (2 + np.floor(r * 4)), yy * DET, 77 + f)
        on = (d < 1) & (p > 0.30 + d * 0.52 + 0.08 * (np.floor(yy * DET) % 2))
        col = np.where(((d < 0.45) & (p > 0.8))[..., None], np.array((255, 250, 206)), np.where((d < 0.75)[..., None], np.array((255, 226, 140)), np.array((250, 170, 82))))
        G.put(0, 0, col.astype(np.uint8), on)
        gl.append(G)
    sc.add('glitter', None, 0, y=YW, kind='frames', frames=gl)
    # ---- on the water: a sailing barge and mooring piles (speed 0.55)
    WM = lw(0.55)
    M = Layer(WM, VIEW_H)
    sb = sailbarge(rng); M.blit(sb, 470, 154 - 72)
    d1 = dolphin(rng); M.blit(d1, 120, 150 - 30); M.blit(dolphin(rng), 600, 158 - 30)
    M.recolor(grader(key=((48, 18, 40), (236, 150, 90), 0.80, 0.1)))
    sc.add('mid', M, 0.55)
    # ---- near quay: against the light
    N = Layer(WORLD, VIEW_H)
    nb, nwin = near_boat(rng, 190, 'white'); N.blit(nb, 700, 166 - nb.h + 2)
    for mx in (90, 380, 620):
        mp = mooring_post(24); N.blit(mp, mx, 166 - 14)
    g = ground(N, WORLD, 166, seed=33)
    sc.walk = g['walk']
    P = Props()
    lamps_at = []
    tx = 890
    tree_pit(N, tx - 15, g['strip'] - 2)
    tr = trunk(rng, 176, 12, seed=tx); P.add(tr, tx - tr.w // 2, g['strip'] + 1 - tr.h)
    cn = canopy(170, 60, R['leaf'], tx, nb=12, rag=9, holes=0.2, spread=0.40); P.add(cn, tx - 85, -26, base=g['strip'] + 1, cast=False)
    for lx in (150, 470, 760):
        lp = lamp(98, lit=True); P.add(lp, lx, g['strip'] + 2 - lp.h)
        lamps_at.append((lx + 8, g['strip'] + 2 - lp.h + 14))
    for (bx, c, crt) in ((40, 'black', True), (220, 'red', None), (252, 'black', False), (540, 'blue', True), (640, 'green', None)):
        b = bike(rng, c, crt); P.add(b, bx, g['strip'] + 3 - b.h)
    bn = bench(); P.add(bn, 320, g['strip'] + 3 - bn.h)
    x = 16
    while x < WORLD:
        if rng.random() < 0.9:
            p = post(); P.add(p, x, g['kerb'] + 1 - p.h)
        x += rng.choice([40, 44, 44, 48])
    P.shadows(N, 166, kx=-0.10, ky=0.50, mul=(0.64, 0.54, 0.62))              # long shadows toward the viewer
    P.draw(N)
    N.recolor(grader(key=((50, 20, 44), (255, 196, 120), 0.56, 0.1)), keep=EM)
    N.recolor(curve(1.12, 1.05, 0.94), keep=EM)
    for (x, y) in lamps_at:
        glow(N, x, y, 13, HALO)
        lp = lamp(98, lit=True); lp.recolor(grader(key=((50, 20, 44), (255, 196, 120), 0.56, 0.1)), keep=EM)
        N.blit(lp, x - 8, y - 14)
    sc.add('near', N, 1.0)
    FG = Layer(lw(1.35), VIEW_H)
    c = fg_chairs(rng); FG.blit(c, 210, VIEW_H - 36)
    p = fg_planter(rng, 84); FG.blit(p, 600, VIEW_H - 34)
    b = fg_basket(rng); FG.blit(b, 1000, VIEW_H - 30)
    FG.recolor(grader(key=((30, 10, 26), (150, 84, 70), 0.84, 0.1)))
    sc.add('fg', FG, 1.35)
    return sc


if __name__ == '__main__':
    sc = build()
    run, idle = hero_frames()
    for i, cx in enumerate((0, 290, 576)):
        save(compose(sc, cx, 0, run[i * 3], t=0), f'out/s3-{i}-u{U}.png', 1)
    print([l['id'] for l in sc.layers])
