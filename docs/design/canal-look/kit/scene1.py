# Scene 1: a canal of the old ring on a clear morning. Key hue: sky blue. Set piece: a brick arch bridge
# on the far bank and the view down a side canal behind it.
from sets import *


def build():
    sc = Scene('a', 'Grachtengordel', 'Morning, clear')
    rng = random.Random(11)
    AIR = ((122, 160, 205), (240, 244, 232))
    KEY = ((70, 84, 128), (255, 248, 226), 0.10, 0.0)
    # ---- sky + clouds
    S, spal = sky(VIEW_W, 150, [(0, '#2a66ae'), (0.40, '#4f92d2'), (0.74, '#96c8ea'), (1, '#dcefee')], n=16, seed=3)
    sc.add('sky', S, 0)
    cp = [hx(c) for c in ('#6a90ba', '#89abcf', '#aec6dc', '#d2dfe6', '#eef0e6', '#ffffff')]
    CL = Layer(720, 124)
    for (x, y, w, h, sd) in [(10, 14, 170, 62, 11), (250, 34, 128, 46, 12), (470, 8, 190, 66, 16), (160, 84, 96, 26, 13),
                             (360, 92, 120, 24, 14), (600, 88, 104, 26, 15), (-40, 96, 100, 22, 17)]:
        CL.blit(cumulus(w, h, cp, sd), x, y)
    lowhaze = grader(air=(AIR[0], AIR[1], 0.45, 0.2))
    low = Layer(720, 124); low.a = CL.a.copy(); low.clear(0, 0, 720, 80); low.recolor(lowhaze)      # clouds at the horizon take more air
    CL.clear(0, 80, 720, 44); CL.blit(low, 0, 0)
    sc.add('clouds', CL, 0.03, y=4, kind='tile', drift=1.2)
    # ---- far skyline (speed 0.18)
    W1 = lw(0.18)
    SK = Layer(W1, VIEW_H)
    far_roofs(SK, 0, W1, 122, random.Random(5), 14, 30)
    SK.blit(tower(118), 258, 4)
    SK.blit(dome_church(), 96, 60)
    SK.recolor(grader(key=KEY, air=(AIR[0], AIR[1], 0.74, 0.5)))
    sc.add('skyline', SK, 0.18)
    # ---- far bank (speed 0.5)
    WF = lw(0.5)
    YH, YQ, YW = 120, 125, 135
    F = Layer(WF, VIEW_H)
    GX0, GX1 = 268, 380
    fb = far_bank(F, rng, YH, YQ, YW, gap=(GX0, GX1), bridge='arch', house=dict(hmin=62, hmax=86), trees=dict(leaf='leaf'), AIR=AIR, arches=1,
                  vista_kw=dict(base_m=0.05, step_m=0.105),
                  vista3=dict(key=KEY, speed=0.5, wcols=((30, 58, 68), (62, 100, 108), spal[12])),
                  boats=[('house', 40, (84, 'green')), ('sloop', 150, (26, 'blue')), ('sloop', 182, (22, 'white')),
                         ('barge', 424, (112,)), ('sloop', 556, (28, 'red')), ('house', 598, (70, 'white'))])
    F.recolor(grader(key=KEY, air=(AIR[0], AIR[1], 0.25, 0.30)))
    fb['vista_refl'].recolor(grader(key=KEY, air=(AIR[0], AIR[1], 0.25, 0.30)))
    sc.add('vista', None, 0.5, kind='vista', refl=fb['vista_refl'], v3=fb['vista3'])
    sc.add('far', F, 0.5)
    # ---- water (rows scroll 0.5 -> 0.9)
    src = flatten([(S, 'tilex'), (CL, 'tilex', 4), (SK, 'stretch'), (fb['vista_refl'], 'copy'), (F, 'copy')], WF, YW + 1)
    rows = 36
    wat = water(src, YW, rows, WF, lw(0.9), (62, 100, 108), (30, 58, 68), spal[12], seed=5, k=2.3, ncol=26)
    sc.add('water', None, 0.5, y=YW, kind='rows', frames=wat, s0=0.5, s1=0.9)
    # ---- near quay (speed 1)
    N = Layer(WORLD, VIEW_H)
    nb, _ = near_boat(rng, 210, 'green'); N.blit(nb, 520, 166 - nb.h + 2)
    for mx in (150, 420, 760):
        mp = mooring_post(24); N.blit(mp, mx, 166 - 14)
    g = ground(N, WORLD, 166, seed=3)
    sc.walk = g['walk']
    P = Props()
    for tx in (96, 472, 828):                                          # elms: pit, trunk, the crown above the screen
        tree_pit(N, tx - 15, g['strip'] - 2)
        tr = trunk(rng, 176, 12, seed=tx); P.add(tr, tx - tr.w // 2, g['strip'] + 1 - tr.h)
        cn = canopy(170, 60, R['leaf'], tx, nb=12, rag=9, holes=0.16, spread=0.40)
        P.add(cn, tx - 85, -26, base=g['strip'] + 1)
    lp = lamp(98); P.add(lp, 262, g['strip'] + 2 - lp.h); P.add(lamp(98), 664, g['strip'] + 2 - 98)
    for (bx, c, cr) in ((300, 'red', True), (334, 'black', False), (352, 'blue', None), (560, 'green', None), (700, 'black', True), (40, 'white', False)):
        b = bike(rng, c, cr); P.add(b, bx, g['strip'] + 3 - b.h)
    sg = sign('bike'); P.add(sg, 420, g['strip'] + 2 - sg.h)
    bn = bench(); P.add(bn, 180, g['strip'] + 3 - bn.h)
    x = 14
    while x < WORLD:                                                   # the posts stand on the kerbstones only
        if rng.random() < 0.9:
            p = post(); P.add(p, x, g['kerb'] + 1 - p.h)
        x += rng.choice([40, 44, 44, 48])
    P.shadows(N, 166)
    P.draw(N)
    N.recolor(grader(key=KEY)); N.recolor(curve(1.10, 1.06))
    sc.add('near', N, 1.0)
    # ---- foreground (speed 1.35): dark, at the lower edge
    FG = Layer(lw(1.35), VIEW_H)
    b = fg_basket(rng); FG.blit(b, 250, VIEW_H - 30)
    p = fg_planter(rng, 84); FG.blit(p, 640, VIEW_H - 34)
    c = fg_chairs(rng); FG.blit(c, 980, VIEW_H - 36)
    FG.recolor(grader(key=((18, 22, 44), (170, 160, 150), 0.42, 0.3)))
    sc.add('fg', FG, 1.35)
    return sc


if __name__ == '__main__':
    import sys
    sc = build()
    run, idle = hero_frames()
    for i, cx in enumerate((0, 290, 576)):
        im = compose(sc, cx, 0, run[i * 3], t=0)
        save(im, f'out/s1-{i}-u{U}.png', 1)
    print([l['id'] for l in sc.layers])
