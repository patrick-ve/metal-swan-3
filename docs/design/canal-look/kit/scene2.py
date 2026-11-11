# Scene 2: the museum square on a grey autumn day. Key hue: one olive-sepia for the whole stage, as the
# reference does under a cloud deck. Set piece: the museum at the head of the square, and its mirror image
# in the pond. No cast shadows: the light is flat.
from sets import *


def build():
    sc = Scene('b', 'Museumplein', 'Autumn, overcast')
    rng = random.Random(23)
    AIR = ((124, 126, 104), (228, 222, 188))
    KEY = ((44, 44, 48), (240, 230, 194), 0.42, 0.30)
    sc.notes['shadow'] = (58, 56, 52)
    # ---- sky: a cloud deck
    S, spal = overcast(VIEW_W, 150, [(0, '#585e54'), (0.32, '#7d806a'), (0.62, '#aeaa86'), (0.86, '#d6cea4'), (1, '#ece2b8')], n=12, seed=4)
    sc.add('sky', S, 0)
    cp = [hx(c) for c in ('#4c5248', '#62665a', '#7c7e6a', '#98987e')]
    CL = Layer(640, 90)
    for (x, y, w, h, sd) in [(0, 0, 330, 34, 31), (300, 18, 340, 30, 32), (120, 48, 300, 26, 33)]:
        CL.blit(wisp(w, h, cp, sd, cover=0.46, sx=50, sy=7), x, y)
    sc.add('clouds', CL, 0.03, y=0, kind='tile', drift=1.6)
    # ---- far skyline: roofs and a line of park trees, deep in the air
    W1 = lw(0.18)
    SK = Layer(W1, VIEW_H)
    far_roofs(SK, 0, W1, 124, random.Random(7), 12, 28)
    tree_band(SK, 0, W1, 127, 15, 'leaf_autumn', 5)
    SK.recolor(grader(key=KEY, air=(AIR[0], AIR[1], 0.72, 0.5)))
    sc.add('skyline', SK, 0.18)
    # ---- the far side of the pond: the museum, its garden, the lawn (one plane, so the mirror fits it)
    SP = 0.4
    WF = lw(SP)
    YH, YQ, YW = 126, 132, 135
    F = Layer(WF, VIEW_H)
    M = museum()
    MX = (WF - M.w) // 2
    V = Layer(WF, VIEW_H)                                               # villas at both sides, behind the trees
    vk = dict(sc=0.62, hmin=30, hmax=42, wmin=22, wmax=30, kinds=['cornice', 'cornice', 'bell', 'neck', 'step'], shops=0)
    house_row(V, 0, MX - 4, YH - 1, rng, seed=100, **vk)
    house_row(V, MX + M.w + 4, WF, YH - 1, rng, seed=300, **vk)
    V.recolor(grader(key=KEY, air=(AIR[0], AIR[1], 0.52, 0.4)))
    F.blit(V, 0, 0)
    M.recolor(grader(key=KEY, air=(AIR[0], AIR[1], 0.34, 0.3)))
    F.blit(M, MX, YH - M.h)
    # the garden and the lawn, one step nearer than the museum
    Gd = Layer(WF, VIEW_H)
    GR = R['grass']; GV = R['gravel']; St = R['stone']; Gn = R['green']; I = R['iron']; LV = R['leaf_autumn']
    cxm = MX + M.w // 2
    xx, yy = grid(0, YH, WF, YQ - YH)
    n = fbm(xx / 11.0, yy / 2.0, 61, 2); bl = hs(xx, yy, 62)
    idx = 3 + (n > 0.60).astype(int) - (n < 0.40).astype(int) + (bl > 0.92).astype(int)
    rgb = np.array(GR, np.uint8)[np.clip(idx, 1, 5)]
    path = (yy >= YH + 2) & (yy < YH + 4)
    path |= (np.abs(xx - cxm) < 11) & (yy < YH + 2)
    rgb[path] = np.array(GV, np.uint8)[np.where(hs(xx, yy, 63) > 0.7, 5, 4)][path]
    lf = hs(xx, yy, 64)
    rgb[lf > 0.975] = LV[5]; rgb[(lf > 0.955) & (lf <= 0.975)] = LV[3]
    Gd.put(0, YH, rgb, np.ones(xx.shape, bool))
    Gd.hl(0, YH, WF, GR[1])
    x = MX - 2                                                          # a hedge and an iron fence at the foot of the museum
    while x < MX + M.w + 2:
        if abs(x - cxm) > 13:
            Gd.rect(x, YH - 4, 2, 4, Gn[2]); Gd.px(x, YH - 4, Gn[4]); Gd.px(x + 1, YH - 3, Gn[1])
            if (x - MX) % 8 == 0:
                Gd.vl(x, YH - 6, 6, I[2], t=TH)
        x += 2
    Gd.rect(0, YQ, WF, YW - YQ + 1, St[4]); Gd.hl(0, YQ, WF, St[6]); Gd.hl(0, YW, WF, St[1])       # the stone edge of the pond
    for x in range(7, WF, 23):
        Gd.vl(x, YQ + 1, 2, St[2], t=TH)
    for lx in range(34, WF, 74):                                        # lamps and benches on the path
        if abs(lx - cxm) > 16:
            Gd.blit(lamp_far(27), lx, YH + 4 - 27)
    for bx in (MX + 64, MX + 134, MX + 196, MX + 262, 44, WF - 70):
        Gd.blit(bench_far(), bx, YH - 1)
    for bx in (96, 112, MX + 38, MX + 300, WF - 40):
        Gd.blit(bike_far(rng), bx, YH - 3)
    for (fx, c) in ((cxm - 22, 'red'), (cxm + 15, 'yellow')):
        Gd.blit(flag_far(c), fx, YH + 2 - 30)
    ks = kiosk_far(rng); Gd.blit(ks, 64, YH + 3 - ks.h)
    sm = smoke(34, 40, 3); Gd.blit(sm, 64 + ks.w - 12, YH + 3 - ks.h - 38)
    tk = dict(leaf='leaf_autumn')
    for (tx, cw, ch, th, bare) in ((22, 50, 44, 26, 0.36), (116, 54, 46, 27, 0.44), (MX + 88, 36, 32, 20, 0.58), (MX + 262, 34, 30, 19, 0.52),
                                   (MX + M.w + 24, 52, 46, 26, 0.40), (WF - 46, 48, 42, 25, 0.46), (WF - 4, 46, 40, 24, 0.4)):
        t = tree_far(rng, cw, ch, th, seed=rng.randint(1, 999), bare=bare, **tk)
        Gd.blit(t, tx - t.w // 2, YH + 3 - t.h)
        leaf_pile(Gd, tx, YH + 3, 16, 3, 'leaf_autumn', tx, 0.5)
    Gd.recolor(grader(key=KEY, air=(AIR[0], AIR[1], 0.22, 0.3)))
    F.blit(Gd, 0, 0)
    F.clear(0, YW + 1, F.w, F.h)
    sc.add('far', F, SP)
    # ---- the pond: a still mirror that stays under the museum, and the ripples that scroll over it row by row
    BF, BN = (112, 116, 96), (50, 56, 52)
    rows = 36
    src = flatten([(S, 'tilex'), (CL, 'tilex'), (SK, 'stretch'), (F, 'copy')], WF, YW + 1)
    mir = mirror(src, YW, rows, BF, BN, seed=15, k=3.0, ncol=36, mix0=0.12, mix1=0.50, wob=(0.15, 0.8), wfreq=1.5)
    sc.add('mirror', None, SP, y=YW, kind='frames', frames=mir)
    rip = ripples(rows, WF, lw(0.9), BF, BN, spal[10], seed=15, light=0.71, dark=0.28, leaves='leaf_autumn')
    sc.add('water', None, SP, y=YW, kind='rows', frames=rip, s0=SP, s1=0.9)
    # ---- ducks on the pond (they sit on the row that has their speed)
    DS = 0.72
    DK = Layer(lw(DS), VIEW_H)
    yd = YW + int(round((DS - SP) / (0.9 - SP) * (rows - 1)))
    for (dx_, drake, fl) in ((210, True, False), (228, False, False), (540, True, True), (700, False, False)):
        d = duck(rng, drake)
        DK.blit(d.flip() if fl else d, dx_, yd - 8)
    DK.recolor(grader(key=KEY))
    sc.add('mid', DK, DS)
    # ---- the near side: the stone edge, a lawn with the trees, a gravel path, wet slabs with puddles and leaves
    N = Layer(WORLD, VIEW_H)
    g = ground(N, WORLD, 166, seed=23, wet=0.62, leaves='leaf_autumn', sky=[spal[3], spal[6], spal[10]], style='park')
    sc.walk = g['walk']
    P = Props()
    for tx in (120, 610, 900):
        leaf_pile(N, tx, g['strip'] + 3, 52, 9, 'leaf_autumn', tx, 0.42)
        tr = trunk(rng, 176, 12, seed=tx); P.add(tr, tx - tr.w // 2, g['strip'] + 1 - tr.h)
        cn = canopy(170, 60, R['leaf_autumn'], tx, nb=12, rag=11, holes=0.34, spread=0.40)
        P.add(cn, tx - 85, -26, base=g['strip'] + 1, cast=False)
    lp = lamp(98); P.add(lp, 300, g['strip'] + 2 - lp.h); P.add(lamp(98), 720, g['strip'] + 2 - 98)
    for (px_, word, c) in ((404, 'KUNST', 'red'), (822, 'EXPO', 'yellow')):
        bp = banner_pole(word, c); P.add(bp, px_, g['strip'] + 2 - bp.h)
    for (bx, c, crt) in ((30, 'black', None), (218, 'green', True), (560, 'blue', None), (770, 'black', True)):
        b = bike(rng, c, crt); P.add(b, bx, g['strip'] + 3 - b.h)
    for bx in (160, 470, 650):
        bn = bench(); P.add(bn, bx, g['strip'] + 3 - bn.h)
    for bx in (262, 700):
        bi = bin_(); P.add(bi, bx, g['strip'] + 3 - bi.h)
    P.shadows(N, 166, kx=0.04, ky=0.07, mul=(0.80, 0.80, 0.82))               # only a soft contact shade
    P.draw(N)
    N.recolor(grader(key=KEY)); N.recolor(curve(1.08, 1.0))
    sc.add('near', N, 1.0)
    FG = Layer(lw(1.35), VIEW_H)
    p = fg_planter(rng, 84, leaf='leaf_autumn'); FG.blit(p, 180, VIEW_H - 34)
    b = fg_basket(rng); FG.blit(b, 560, VIEW_H - 30)
    c = fg_chairs(rng); FG.blit(c, 930, VIEW_H - 36)
    FG.recolor(grader(key=((20, 20, 24), (150, 142, 120), 0.6, 0.3)))
    sc.add('fg', FG, 1.35)
    return sc


if __name__ == '__main__':
    sc = build()
    run, idle = hero_frames()
    for i, cx in enumerate((0, 290, 576)):
        save(compose(sc, cx, 0, run[i * 3], t=0), f'out/s2-{i}-u{U}.png', 1)
    print([l['id'] for l in sc.layers])
