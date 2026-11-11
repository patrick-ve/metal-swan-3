# Scene 4: the red light quarter at night. Key hue: one night blue for the whole stage, in violet air.
# The lights are red: the rooms at street level, the lanterns, the neon, and their long streaks in the
# water. Red light is at street level only: the rooms above are dark or warm. Swans float on the canal.
from sets import *

RED = [s5(c) for c in ((255, 222, 230), (255, 110, 132), (236, 44, 84), (160, 22, 70))]     # core, tube, glow, ember
PINK = s5((255, 148, 206)); CYAN = s5((132, 232, 255)); AMBER = EM[1]
HALO = [s5(c) for c in ((255, 240, 180), (236, 200, 130), (156, 130, 150), (86, 76, 140), (52, 48, 112))]
HALO_S = [s5(c) for c in ((250, 220, 150), (150, 130, 150), (78, 70, 132))]
HALO_R = [RED[1], s5((222, 52, 96)), s5((156, 40, 100)), s5((96, 40, 106)), s5((58, 38, 100))]
HALO_RS = [RED[1], s5((190, 44, 96)), s5((104, 40, 104))]
NEON = {'BAR': AMBER, 'CAFE': AMBER, 'HOTEL': CYAN, 'XXX': RED[1], 'CLUB': PINK, 'LIVE': RED[1], 'CASINO': EM[0]}
SHOPS_W = [('BAR', 'red'), ('XXX', 'red'), ('CLUB', 'blue'), ('LIVE', 'red'), ('HOTEL', 'green'), ('CAFE', 'yellow'),
           ('XXX', 'red'), ('CASINO', 'red')]
BOARD = (24, 16, 41)
NO_SIGN = ('BAR', 'CAFE', 'LIVE')                # the user: no signs with these words in this scene
GF = 27                                          # the height of the ground floor: no red light above it


def red_glass(L, x, y, w, h):
    """A room with red light behind the glass: the tube around the frame, the glow, the dark curtains at the sides."""
    L.rect(x - 1, y - 1, w + 2, h + 2, RED[1]); L.hl(x - 1, y - 1, w + 2, RED[0])
    L.rect(x, y, w, h, RED[2]); L.rect(x, y, w, max(1, h * 0.34), RED[1]); L.rect(x, y + h * 0.78, w, h * 0.22 + 0.01, RED[3])
    if w >= 4:
        L.vl(x, y, h, RED[3]); L.vl(x + w - 1, y, h, RED[3])


def red_room(L, box, yfoot, wl=None, dx=0):
    """Light a room red: first the light on the wall and on the street, then the glass."""
    x, y, w, h = box
    cx = x + w / 2.0
    tint(L, cx, y + h / 2.0, w / 2.0 + 6, h / 2.0 + 6, RED[2], 0.58, 0.30, ymin=yfoot - GF, ymax=yfoot)
    tint(L, cx, yfoot + 2, w / 2.0 + 6, 5, RED[2], 0.50, 0.26, ymin=yfoot)
    red_glass(L, x, y, w, h)
    if wl is not None:
        wl.append((int(cx) + dx, RED[2], 0.8))


def strip_lights(H, info, rng):
    """The fronts along the side canal: red rooms at street level, a few warm rooms above."""
    foot = H.h
    for b in info['win']:
        if b[2] < 3:
            continue
        if b[1] >= foot - 24:
            if rng.random() < 0.72:
                red_room(H, b, foot)
        elif rng.random() < 0.12:
            light_windows(H, [b], 1.0, rng)
    if info.get('door') and rng.random() < 0.4:
        red_room(H, info['door'], foot)


def build():
    sc = Scene('d', 'De Wallen', 'Red light district, night')
    rng = random.Random(44)
    AIR = ((20, 16, 56), (112, 76, 150))
    KEY = ((8, 8, 34), (128, 142, 214), 0.88, 0.15)
    sc.notes['shadow'] = (12, 10, 36)
    sc.notes['house_foot'] = 128
    # ---- sky: deep blue that turns to violet over the roofs, stars, a moon behind thin cloud
    S, spal = sky(VIEW_W, 160, [(0, '#040618'), (0.42, '#0c1238'), (0.72, '#1e1a52'), (0.9, '#3a2262'), (1, '#582a66')], n=13, seed=8, streak=0.05)
    r2 = random.Random(3)
    for i in range(70):
        x, y = r2.randint(0, VIEW_W - 1), int(r2.random() ** 1.6 * 110)
        S.rect(x, y, TH, TH, (200, 214, 240) if r2.random() < 0.3 else (110, 136, 190))
    mx, my = 322, 34
    glow(S, mx, my, 26, [(150, 176, 214), (92, 124, 176), (58, 90, 146), (36, 64, 116), (24, 46, 92)])
    S.ellipse(mx, my, 9, 9, (226, 234, 240)); S.ellipse(mx - 3, my - 2, 2.2, 2.0, (186, 202, 226)); S.ellipse(mx + 3, my + 3, 1.6, 1.5, (186, 202, 226))
    S.px(mx + 1, my - 5, (186, 202, 226)); S.px(mx - 5, my + 3, (186, 202, 226))
    sc.add('sky', S, 0)
    cp = [hx(c) for c in ('#10143a', '#1e1c50', '#342a68', '#54408a', '#8266a8')]
    CL = Layer(640, 100)
    for (x, y, w, h, sd) in [(0, 10, 300, 30, 21), (260, 40, 320, 34, 22), (90, 62, 260, 26, 23), (420, 4, 220, 24, 24)]:
        CL.blit(wisp(w, h, cp, sd, cover=0.5, sx=44, sy=6), x, y)
    sc.add('clouds', CL, 0.03, y=6, kind='tile', drift=0.9)
    # ---- far skyline
    W1 = lw(0.18)
    SK = Layer(W1, VIEW_H)
    far_roofs(SK, 0, W1, 130, random.Random(5), 18, 40)
    tw = tower(124, lit=True); SK.blit(tw, 236, 6)
    SK.recolor(grader(key=KEY, air=(AIR[0], AIR[1], 0.5, 0.3)))
    for (x, y) in ((236 + 15, 6 + 62 + 12),):
        SK.ellipse(x, y, 5, 5, (240, 220, 150)); SK.line(x, y, x, y - 3, (60, 50, 60)); SK.line(x, y, x + 2, y + 1, (60, 50, 60))
        glow(SK, x, y, 11, [s5((240, 220, 150)), s5((150, 130, 150)), s5((70, 62, 128))])
        SK.ellipse(x, y, 4.5, 4.5, (246, 230, 170)); SK.line(x, y, x, y - 3, (60, 50, 60)); SK.line(x, y, x + 2, y + 1, (60, 50, 60))
    sc.add('skyline', SK, 0.18)
    # ---- far bank: tall houses close to the water, with the red rooms at street level
    WF = lw(0.5)
    YH, YQ, YW = 128, 134, 146
    F = Layer(WF, VIEW_H)
    GX0, GX1 = 286, 394
    hk = dict(hmin=78, hmax=104, shops=0.30, shop_list=SHOPS_W)
    fb = far_bank(F, rng, YH, YQ, YW, gap=(GX0, GX1), bridge='arch', house=hk,
                  trees=dict(step=(110, 150), bare=0.15), AIR=AIR, sun_shade=False, lit=True, lamp_step=118, cars=0.25,
                  vista_kw=dict(base_m=0.0, step_m=0.09, lit=(0.3, EM[2]), ytop=(34, 58)), arches=1,
                  vista3=dict(key=KEY, speed=0.5, far_m=0.10, far_sat=0.2, light_fn=strip_lights,
                              wcols=((96, 20, 58), (22, 20, 62), (118, 100, 176)), house=dict(hmin=78, hmax=104, shops=0)),
                  boats=[('house', 30, (88, 'wood')), ('sloop', 140, (26, 'white')), ('sloop', 196, (24, 'green')),
                         ('barge', 432, (118,)), ('house', 572, (78, 'blue'))])
    F.recolor(grader(key=KEY, air=(AIR[0], AIR[1], 0.10, 0.2)), keep=EM)
    VR = fb['vista_refl']; VR.recolor(grader(key=KEY, air=(AIR[0], AIR[1], 0.10, 0.2)), keep=EM)
    wl = []
    gwin = [b for b in fb['win'] if b[1] >= YH - 24]
    upper = [b for b in fb['win'] if b[1] < YH - 24]
    lit = light_windows(F, upper, 0.12, rng)                              # a few warm rooms upstairs
    lit += light_windows(F, fb['boatwin'], 0.7, rng)
    for b in gwin:                                                        # the rooms behind the glass
        if b[2] >= 3 and rng.random() < 0.80:
            red_room(F, b, YH, wl)
    for i in fb['infos']:
        if i.get('door') and rng.random() < 0.45:                          # a glass door
            red_room(F, i['door'], YH, wl)
        if i.get('shop'):
            m, sy, sw, shh = i['shop']
            x, y = i['x'] + m, i['y'] + sy
            word = i.get('word', 'XXX')
            col = NEON.get(word, RED[1])
            warm = col in (AMBER, EM[0], CYAN)
            gcol = EM[1] if warm else RED[2]
            tint(F, x + sw / 2.0, y + shh / 2.0, sw / 2.0 + 6, shh / 2.0 + 6, gcol, 0.5, 0.26, ymin=YH - GF, ymax=YH)
            tint(F, x + sw / 2.0, YH + 2, sw / 2.0 + 5, 5, gcol, 0.5, 0.26, ymin=YH)
            if warm:                                                      # a bar: one wide warm window
                F.rect(x + 1, y + 1, sw - 2, shh - 3, EM[1]); F.rect(x + 1, y + 1, sw - 2, 2, EM[2])
                F.vl(x + sw // 2, y + 1, shh - 3, (92, 52, 30))
                for xx in range(x + 2, x + sw - 2, 3):
                    F.px(xx, y + shh - 4, (120, 60, 40)); F.px(xx + 1, y + shh - 5, (160, 90, 50))
            else:                                                         # a row of rooms behind glass
                F.rect(x, y, sw, shh - 1, BOARD)
                n = max(2, sw // 9)
                pw = (sw - 1) / n
                for k in range(n):
                    red_glass(F, int(round(x + 2 + k * pw)), y + 2, int(pw) - 3, shh - 5)
            wl.append((x + sw // 2, gcol, 0.9))
            tw_ = text_w(word)                                            # its name in neon, over the awning
            if tw_ + 6 <= i['w'] and word not in NO_SIGN:
                sx = int(i['x'] + (i['w'] - tw_) // 2); sy2 = y - 7        # inside the ground floor
                tint(F, sx + tw_ / 2.0, sy2 + 2.5, tw_ / 2.0 + 6, 8, col, 0.5, 0.25, ymin=YH - GF, ymax=YH)
                F.rect(sx - 2, sy2 - 1, tw_ + 4, 7, BOARD); text(F, sx, sy2, word, col)
        elif i['w'] >= 30 and rng.random() < 0.62:                         # a neon blade sign on the front
            col = rng.choice([RED[1], RED[1], PINK, CYAN, AMBER])
            redc = col in (RED[1], PINK)
            bx = i['x'] + (0 if rng.random() < 0.5 else i['w'] - 2)
            bh = 13 if redc else 14
            by = YH - GF + 2 if redc else YH - 46                         # red neon hangs at street level only
            tint(F, bx + 1, by + 7, 6, 11, col, 0.5, 0.25, ymin=YH - GF if redc else None, ymax=YH)
            F.rect(bx, by, 2, bh, col); F.hl(bx, by, 2, RED[0] if redc else EM[0])
            for k in range(3, bh - 1, 3):
                F.hl(bx, by + k, 2, BOARD, t=TH)
            wl.append((bx + 1, col, 0.5))
    for (x, y) in fb['doors']:                                            # a red lantern at some doors
        if rng.random() < 0.6:
            glow(F, x, y, 4, HALO_RS); F.px(x, y, RED[0]); F.px(x, y + 1, RED[2])
    for (x, y) in fb['vista']:
        if rng.random() < 0.8:
            VR.px(x, y, EM[2])
    for (x, y) in fb['lamps']:                                            # the street lamps stay warm
        glow(F, x, y, 7, HALO_S)
        F.rect(x - 1, y - 1, 3, 3, EM[0]); F.px(x, y + 1, EM[1])
        wl.append((x, EM[1], 0.8))
    ax, ay, aw, ah = fb['arch']
    for (x, y) in fb['blamps']:                                           # red lanterns on the bridge
        glow(F, x, y, 8, HALO_R); F.rect(x - 1, y - 1, 3, 3, RED[0]); F.px(x, y + 1, RED[1])
        wl.append((x, RED[2], 0.9))
    for x in range(ax + 5, ax + aw - 4, 3):                              # a string of lamps under the deck edge
        hump = 3.0 * (1 - ((x - ax - aw / 2) / (aw / 2)) ** 2)
        y = int(round(ay + 12 + 3 - hump + 3))
        F.ellipse(x + 0.5, y + 0.5, 0.56, 0.56, EM[0])
        if x % 6 == 0:
            F.ellipse(x + 0.5, y + 1.5, 0.56, 0.56, EM[2])
        wl.append((x, EM[1], 0.35))
    for (x, y) in lit[::3]:
        wl.append((x, EM[2], 0.3))
    sc.add('vista', None, 0.5, kind='vista', refl=VR, v3=fb['vista3'])
    sc.add('far', F, 0.5)
    # ---- water: black-violet, with the red and warm streaks
    src = flatten([(S, 'tilex'), (CL, 'tilex', 6), (SK, 'stretch'), (VR, 'copy'), (F, 'copy')], WF, YW + 1)
    rows = 26
    wat = water(src, YW, rows, WF, lw(0.9), (24, 22, 66), (8, 8, 32), (126, 104, 180), seed=9, k=3.2, ncol=34,
                mix0=0.34, mix1=0.70, lights=wl, streak=0.7)
    sc.add('water', None, 0.5, y=YW, kind='rows', frames=wat, s0=0.5, s1=0.9)
    # ---- swans on the canal (they sit on the row that has their speed)
    WS = 0.68
    SW = Layer(lw(WS), VIEW_H)
    ysw = YW + int(round((WS - 0.5) / 0.4 * (rows - 1)))
    for (sx, fl) in ((150, False), (176, True), (470, False), (690, True)):
        s_ = swan(seed=sx)
        SW.blit(s_.flip() if fl else s_, sx, ysw - 17)
    SW.recolor(grader(key=((30, 26, 70), (214, 206, 240), 0.62, 0.1)))
    sc.add('mid', SW, WS)
    # ---- near quay
    N = Layer(WORLD, VIEW_H)
    nb, nwin = near_boat(rng, 200, 'blue'); N.blit(nb, 96, 166 - nb.h + 2)
    nwin = [(96 + a, 166 - nb.h + 2 + b, c, d) for (a, b, c, d) in nwin]
    for mx_ in (60, 330, 640, 900):
        mp = mooring_post(24); N.blit(mp, mx_, 166 - 14)
    g = ground(N, WORLD, 166, seed=13, wet=0.5, sky=[spal[3], spal[7], spal[10]])
    sc.walk = g['walk']
    P = Props()
    lamps_at = []
    boards = []
    for tx in (410, 866):
        tree_pit(N, tx - 15, g['strip'] - 2)
        tr = trunk(rng, 176, 12, seed=tx); P.add(tr, tx - tr.w // 2, g['strip'] + 1 - tr.h)
        cn = canopy(170, 60, R['leaf'], tx, nb=12, rag=9, holes=0.2, spread=0.40)
        P.add(cn, tx - 85, -26, base=g['strip'] + 1, cast=False)
    for lx in (236, 760):
        lp = lamp(98, lit=True); P.add(lp, lx, g['strip'] + 2 - lp.h)
        lamps_at.append((lx + 8, g['strip'] + 2 - lp.h + 14))
    for (bx, word, col) in ((146, 'XXX', RED[1]),):
        nbd, tx_, ty_ = neon_board(word)
        P.add(nbd, bx, g['strip'] + 4 - nbd.h)
        boards.append((bx, g['strip'] + 4 - nbd.h, nbd.w, tx_, ty_, word, col))
    for (bx, c, cr) in ((30, 'black', True), (270, 'red', None), (300, 'blue', False), (600, 'green', None), (900, 'black', None)):
        b = bike(rng, c, cr); P.add(b, bx, g['strip'] + 3 - b.h)
    bn = bench(); P.add(bn, 480, g['strip'] + 3 - bn.h)
    x = 20
    while x < WORLD:
        if rng.random() < 0.9:
            p = post(); P.add(p, x, g['kerb'] + 1 - p.h)
        x += rng.choice([40, 44, 44, 48])
    P.draw(N)
    N.recolor(grader(key=KEY), keep=EM)
    N.recolor(curve(1.05, 1.0, 0.92), keep=EM)
    light_windows(N, nwin, 0.8, rng)
    for (bx, by, bw, tx_, ty_, word, col) in boards:                     # the light of the neon boards on the ground
        gc = RED[2] if col in (RED[1], PINK) else col
        lightpool(N, bx + bw / 2.0, g['walk'] - 9, 46, 14, 166, warm=gc, a1=0.46, a2=0.24)
    for (x, y) in lamps_at:                                             # pools of light, then the halo on top
        lightpool(N, x, g['walk'] - 8, 64, 17, 166)
    for (bx, by, bw, tx_, ty_, word, col) in boards:
        tint(N, bx + bw / 2.0, by + 14, bw / 2.0 + 7, 20, RED[2] if col in (RED[1], PINK) else col, 0.42, 0.22)
        N.rect(bx + 2, by + 2, bw - 4, 24, BOARD)
        neon_text(N, bx + tx_, by + ty_, word, col, RED[0] if col in (RED[1], PINK) else EM[0])
    for (x, y) in lamps_at:
        glow(N, x, y, 20, HALO)
        lp = lamp(98, lit=True); lp.recolor(grader(key=KEY), keep=EM)
        N.blit(lp, x - 8, y - 14)
    sc.add('near', N, 1.0)
    # ---- foreground: almost a silhouette
    FG = Layer(lw(1.35), VIEW_H)
    b = fg_basket(rng); FG.blit(b, 300, VIEW_H - 30)
    c = fg_chairs(rng); FG.blit(c, 700, VIEW_H - 36)
    p = fg_planter(rng, 84); FG.blit(p, 1010, VIEW_H - 34)
    FG.recolor(grader(key=((6, 4, 24), (88, 66, 128), 0.94, 0.2)))
    sc.add('fg', FG, 1.35)
    return sc


def checks(sc):
    """The rule of this scene, as a gate for check.py: red light stays inside the ground floor."""
    def red(a):
        a = a.astype(int)
        return int(((a[..., 3] > 0) & (a[..., 0] > 150) & (a[..., 1] < 130) & (a[..., 0] - a[..., 2] > 40)).sum())
    L = {l['id']: l for l in sc.layers}
    n = red(L['far']['img'].a[:P(sc.notes['house_foot'] - GF)])
    for k in ('wallL', 'wallR'):
        W = L['vista']['v3']['imgs'][k]
        n += red(W.a[:P(W.h - GF)])
    return [('red light stays inside the ground floor', n == 0, n)]


if __name__ == '__main__':
    sc = build()
    run, idle = hero_frames()
    for i, cx in enumerate((0, 290, 576)):
        save(compose(sc, cx, 0, run[i * 3], t=0), f'out/s4-{i}-u{U}.png', 1)
    print([l['id'] for l in sc.layers])
