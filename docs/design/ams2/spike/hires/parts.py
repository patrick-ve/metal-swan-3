"""Scenery parts, each drawn like a hero part. Light from the upper right: lit edges on the top and the right."""
import math
import numpy as np
from kit import *
import kit

r_ = R
# ------------------------------------------------------------------ walls
def brick_hints(s, k, mat, seed, top=0):
    """Brick by hint, as a hero's cloth is drawn: a few short course lines and lit bricks, in clusters, never a full pattern."""
    r = rngf(seed); hi, ba, sh, dk = R[mat]
    ys, xs = np.nonzero(k)
    if len(ys) == 0: return
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    W = x1-x0+1
    # clusters: patches of the wall carry bricks, the rest stays calm
    n_patch = max(3, int((y1-y0)*W/115))
    for _ in range(n_patch):
        cx = x0+r.integers(0, W); cy = y0+r.integers(0, y1-y0+1)
        for row in range(int(r.integers(2, 5))):
            y = cy+row*3
            off = (row % 2)*3
            for b in range(int(r.integers(1, 4))):
                x = cx+off+b*7-int(r.integers(0, 3))
                L = int(r.integers(4, 7))
                for i in range(L):
                    if 0 <= y < s.h and 0 <= x+i < s.w and k[y, x+i] and s.c[y, x+i] == ba: s.c[y, x+i] = sh
                if x+L < s.w and 0 <= y-1 < s.h and k[y-1, min(x+L, s.w-1)] and s.c[y-1, min(x+L, s.w-1)] == ba: s.c[y-1, min(x+L, s.w-1)] = sh
                # the top of the brick above catches the light on the right half of the wall
                if x > x0+W*.45 and r.random() < .55:
                    for i in range(int(r.integers(2, 5))):
                        if 0 <= y-2 < s.h and 0 <= x+i+1 < s.w and k[y-2, x+i+1] and s.c[y-2, x+i+1] == ba: s.c[y-2, x+i+1] = hi

def plaster_hints(s, k, mat, seed):
    r = rngf(seed); hi, ba, sh, dk = R[mat]
    ys, xs = np.nonzero(k)
    if len(ys) == 0: return
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    for _ in range(max(2, int((y1-y0)*(x1-x0)/420))):
        x = x0+r.integers(0, x1-x0+1); y = y0+r.integers(0, y1-y0+1)
        L = int(r.integers(3, 8))
        tone = sh if x < (x0+x1)/2 else hi
        for i in range(L):
            if 0 <= y < s.h and 0 <= x+i < s.w and k[y, x+i] and s.c[y, x+i] == ba: s.c[y, x+i] = tone
        if r.random() < .5:
            for i in range(max(1, L-2)):
                if 0 <= y+1 < s.h and 0 <= x+i+1 < s.w and k[y+1, x+i+1] and s.c[y+1, x+i+1] == ba: s.c[y+1, x+i+1] = tone

# ------------------------------------------------------------------ windows
def window(s, x, y, w, h, r, part, z=3., kind=None, arch=False, lit=False, trim='white', tone_shift=0):
    """A window as a small sprite: a white frame with a lit top and right edge, deep glass, one bright reflection, one thing inside."""
    t0, t1, t2, t3 = R[trim]
    g0, g1, g2, g3 = R['glass']
    s.marks.append(('win', int(x), int(y), int(w), int(h)))
    s.use(part, z)
    s.rect(t1, x, y, w, h)
    s.hl(t0, x, y, w); s.vl(t0, x+w-1, y, h); s.vl(t2, x, y+1, h-1); s.hl(t2, x, y+h-1, w-1)
    gx, gy, gw, gh = x+1, y+1, w-2, h-2
    if lit:
        l0, l1, l2 = R['lit']
        s.rect(l1, gx, gy, gw, gh); s.hl(l2, gx, gy, gw)
        s.rect(l0, gx+gw//2, gy+gh//3, max(1,gw//3), max(1,gh//3))
    else:
        s.rect(g2, gx, gy, gw, gh)
        s.hl(g3, gx, gy, gw); s.vl(g3, gx, gy, gh)
        # one reflection: a slanted bright cluster, upper right
        n = max(2, gh//2)
        for j in range(n):
            for q in range(max(1, gw//3)):
                xx = gx+gw-1-j//2-q-int(r.integers(0, 1))
                if gx < xx < gx+gw: s.px(g1 if q else g0, xx, gy+1+j)
        k = kind if kind is not None else int(r.integers(0, 6))
        if gh >= 8 and gw >= 3:
            c0, c1, c2 = R['cloth']
            if k == 0:     # curtains
                cw = max(1, gw//3)
                s.rect(c1, gx, gy, cw, gh//2+1); s.rect(c0, gx+gw-cw, gy, cw, gh//2+1)
                s.px(c2, gx, gy+gh//2+1); s.px(c1, gx+gw-1, gy+gh//2+1)
            elif k == 1:   # a plant on the sill
                px_ = gx+gw//2-1
                s.rect(R['dred'][1], px_, gy+gh-2, 2, 2); s.rect(R['leaf'][1], px_-1, gy+gh-4, 3, 2); s.px(R['leaf'][0], px_+1, gy+gh-4); s.px(R['leaf'][2], px_-1, gy+gh-3)
            elif k == 2:   # a blind half down
                d = gh//3+1
                s.rect(c1, gx, gy, gw, d); s.hl(c2, gx, gy+d-1, gw); s.hl(c0, gx, gy, gw)
            elif k == 3 and gh >= 10:   # a lamp in the room
                s.px(R['glow'][1], gx+gw//2, gy+gh//3); s.px(R['glow'][0], gx+gw//2, gy+gh//3+1)
    # bars
    if w >= 8:
        s.vl(t1, x+w//2, y+1, h-2)
    if h >= 10:
        s.hl(t1, x+1, y+h//2, w-2); s.hl(t0, x+1, y+h//2-1 if False else y+h//2, w-2)
    if arch:
        ah = max(2, w//3)
        for i in range(w):
            u = (i+.5)/w*2-1
            q = int(round((1-math.sqrt(max(1-u*u,0)))*ah))
            s.rect(t0 if i > w/2 else t1, x+i, y-ah+q, 1, ah-q)
        s.rect(g1, x+w//2-1, y-ah+2, 2, max(1,ah-2))
    # sill and the shadow it throws to the lower left
    s.use(part+1, z+.5)
    s.hl(t0, x-1, y+h, w+2)
    s.use(1, 1.)

def door(s, x, y, w, h, mat, r, part, z=3., steps=2):
    a, b, c, d = R[mat]; t0, t1, t2, t3 = R['white']
    s.use(part, z)
    s.rect(t1, x-1, y-1, w+2, h+1); s.hl(t0, x-1, y-1, w+2); s.vl(t0, x+w, y-1, h+1); s.vl(t2, x-1, y, h)
    s.rect(b, x, y, w, h); s.vl(a, x+w-1, y, h); s.vl(c, x, y, h)
    tw = max(2, h//6)
    if w >= 7:
        g = R['glass']
        s.rect(g[2], x+1, y+1, w-2, tw); s.px(g[0], x+w-2, y+1); s.px(g[1], x+w-3, y+1)
        s.hl(t1, x, y+tw+1, w)
        py = y+tw+3; ph = (h-tw-5)//2
        for q in (0, 1):
            yy = py+q*(ph+1)
            s.rect(c, x+2, yy, w-4, ph); s.hl(d, x+2, yy, w-4); s.vl(a, x+w-3, yy, ph)
        s.px(R['brass'][0], x+1, y+h//2+1); s.px(R['brass'][1], x+1, y+h//2+2)
    if steps:
        p0, p1, p2, p3 = R['stone']
        s.use(part+1, z+.5)
        for i in range(steps):
            s.hl(p0, x-2-i, y+h+i, w+4+2*i); s.px(p2, x-2-i, y+h+i)
    s.use(1, 1.)

def gable_pts(kind, w, gh):
    hw = w/2
    if kind == 'step':
        n = 4 if w >= 34 else 3
        P = []
        for i in range(n):
            a = hw*(1-i/n*.8); y0 = gh*(1-i/n); y1 = gh*(1-(i+1)/n)
            P += [(a,y0),(a,y1)]
        P += [(hw*.2,0)]
        return [(hw-a,y) for a,y in P]+[(hw+a-1,y) for a,y in reversed(P)]
    if kind == 'neck':
        P = []
        for i in range(10):
            t = i/9; P.append((hw+(hw*.46-hw)*(t*t*(3-2*t)), gh-gh*.45*t+math.sin(t*math.pi)*gh*.05))
        P += [(hw*.46,gh*.2),(hw*.2,0)]
        return [(hw-a,y) for a,y in P]+[(hw+a-1,y) for a,y in reversed(P)]
    if kind == 'bell':
        P = []
        for i in range(16):
            t = i/15; P.append((max(hw*(1-t)**.55*(.62+.38*math.cos(t*math.pi*2)),0), gh*(1-t)))
        return [(hw-a,y) for a,y in P]+[(hw+a-1,y) for a,y in reversed(P)]
    if kind == 'spout':
        return [(0,gh),(hw-hw*.22,gh*.16),(hw-hw*.22,gh*.06),(hw,0),(hw+hw*.22-1,gh*.06),(hw+hw*.22-1,gh*.16),(w-1,gh)]
    return [(0,gh),(w-1,gh)]

def house(w, st, wall, gable, seed, sh=19, ww=9, wh=12, gr=24, gh=24, side=0, doorm='dgreen', plastered=False, outline=KM, ground='door'):
    """One canal house, as one sprite: wall, coping, cornice, windows, door, plinth. Outlined once."""
    r = rngf(seed); hi, ba, sd, dk = R[wall]; st0, st1, st2, st3 = R['stone']; t0, t1, t2, t3 = R['white']
    if gable == 'flat': gh = 10
    H = gh+st*sh+gr; W = w+side
    s = S(W, H); s.use(1, 1.)
    top = gh; bot = H
    if side:
        s.use(9, .4)
        drop = max(2, side//3)
        k2 = s.poly(sd, [(w,top),(w+side-1,top+drop),(w+side-1,bot),(w,bot)])
        s.retone(k2, {sd: sd})
        for i in range(top+4, bot-3, 3):
            if i % 6 == 1: s.hl(dk, w+1, i, side-2)
        s.vl(dk, w, top, bot-top)
        # the roof slope behind the front
        s.use(8, .3)
        s.poly(R['roof'][1], [(w//2,top-gh*.55),(w+side*.25,top-gh*.05),(w+side-1,top+drop-1),(w,top)])
        s.use(10, .45)
        for j in range(side//2+1):
            for i in range(top-int(gh*.1), top+drop-1, 3): s.px(R['roof'][2], w+j*2, i)
    s.use(1, 1.)
    # the wall
    fm = np.zeros((H, W), bool); fm[top:bot, 0:w] = True
    if gable != 'flat': fm |= s.poly(ba, [(a,b) for a,b in gable_pts(gable, w, gh)])
    s.rect(ba, 0, top, w, bot-top)
    (plaster_hints if plastered else brick_hints)(s, fm, wall, seed)
    # light: lit right edge, a shaded left side
    s.retone(fm & (np.arange(W)[None,:] <= 1), {ba: sd, hi: ba})
    s.retone(fm & (np.arange(W)[None,:] >= w-1), {ba: hi, sd: ba})
    # under the cornice the wall falls into shadow, the coping is drawn on the top edge of the gable
    cy = top
    if gable != 'flat':
        e = fm.copy(); e[1:] &= fm[:-1]            # pixel whose upper neighbour is wall
        cap = fm & ~e
        lft = fm.copy(); lft[:,1:] &= fm[:,:-1]; lft = fm & ~lft
        rgt = fm.copy(); rgt[:,:-1] &= fm[:,1:]; rgt = fm & ~rgt
        cap = (cap | lft | rgt); cap[top:] = False
        s.c[cap & rgt] = st0; s.c[cap & ~rgt] = st1
        s.p[cap] = 4; s.z[cap] = 1.2
        # the second row under the coping is in shade
        under = np.roll(cap, 1, axis=0) & fm & ~cap
        s.retone(under, {ba: sd, hi: ba})
        # a stone ball on the top; a hoisting beam and an attic window
        s.use(5, 2.)
        s.grid(['.ab.','abbc','.bc.'], w//2-2, 0, {'a': t0, 'b': t1, 'c': t2})
        s.use(1, 1.)
        if gh >= 18:
            aw = max(5, ww-2); ah = max(6, wh//2+1)
            window(s, (w-aw)//2, gh//2-1, aw, ah, r, 30, z=3., kind=int(r.integers(0, 4)))
            s.use(6, 2.)
            bx = w//2-1
            s.rect(R['bark'][1], bx, gh//2-5, 3, 3); s.hl(R['bark'][0], bx, gh//2-5, 3); s.hl(R['bark'][3], bx, gh//2-3, 3)
            s.px(K, bx+1, gh//2-2)
    else:
        rm = R['roof']
        s.use(7, .5)
        s.poly(rm[1], [(0,top),(w*.1,0),(w*.9,0),(w-1,top)])
        for j in range(1, top, 3):
            for i in range(1+(j % 2)*3, w-1, 7):
                s.hl(rm[3], i, j, 3); s.hl(rm[0] if i > w/2 else rm[2], i+3, j-1, 2)
        s.hl(rm[0], int(w*.1), 0, int(w*.8))
        s.use(1, 1.)
    # the cornice, with brackets
    s.use(11, 2.)
    s.hl(t0, -1 if False else 0, top, w); s.hl(t1, 0, top+1, w); s.hl(t3, 0, top+2, w)
    for i in range(2, w-1, 5): s.px(t2, i, top+2)
    s.use(1, 1.)
    s.retone(fm & (np.arange(H)[:,None] >= top+3) & (np.arange(H)[:,None] <= top+4), {ba: sd, hi: ba, sd: dk})
    # storeys
    n = max(1, (w-4)//(ww+4))
    gap = (w-n*ww)/(n+1)
    for j in range(st):
        wy = top+5+j*sh
        for i in range(n):
            wx = int(round(gap+i*(ww+gap)))
            # the frame's shadow on the wall, to the lower left
            s.retone(np.ix_(range(wy+1, min(wy+wh+2, H)), range(max(wx-1,0), wx+ww)) and _m(H, W, wx-1, wy+1, ww+1, wh+1), {ba: sd, hi: ba})
            window(s, wx, wy, ww, wh, r, 20+i*2+j*12, z=3., arch=seed % 4 == 1)
            if seed % 4 != 1:
                s.use(60+i+j*5, 2.5)
                s.hl(st0, wx-1, wy-2, ww+2); s.hl(st2, wx-1, wy-1, ww+2)
                s.use(1, 1.)
            if r.random() < .3 and j < st-1:       # a flower box
                s.use(70+i+j*5, 4.)
                s.rect(R['dgreen'][1], wx, wy+wh+1, ww, 2); s.hl(R['dgreen'][0], wx, wy+wh+1, ww)
                for q in range(wx, wx+ww, 2):
                    c = R[str(r.choice(['tulip','yellow','dred']))]
                    s.px(c[1], q, wy+wh); s.px(R['leaf'][1], q+1, wy+wh)
                s.use(1, 1.)
        if j > 0 and seed % 3 == 0:
            s.use(12+j, 2.); s.hl(st1, 0, top+j*sh+2, w); s.hl(st3, 0, top+j*sh+3, w); s.use(1, 1.)
    # a downpipe
    if w >= 34:
        s.use(80, 2.)
        s.vl(R['pole'][2], w-3, top+3, bot-top-4); s.vl(R['pole'][0], w-2, top+3, bot-top-4)
        for q in range(top+7, bot-3, 9): s.hl(R['pole'][3], w-3, q, 2)
        s.use(1, 1.)
    # ground floor
    gy = bot-gr
    s.use(13, 2.); s.hl(st0, 0, gy, w); s.hl(st2, 0, gy+1, w)
    s.use(14, 2.)
    s.rect(st1, 0, bot-4, w, 4); s.hl(st0, 0, bot-4, w); s.hl(st3, 0, bot-1, w)
    for q in range(5, w, 9): s.vl(st3, q, bot-3, 2)
    s.use(1, 1.)
    if ground == 'door':
        dw = 9; dh = gr-6
        dx = int((w-dw)*(.2+r.random()*.12)) if n > 1 else (w-dw)//2
        door(s, dx, bot-dh-2, dw, dh, doorm, r, 90)
        if n > 1:
            ww2 = ww+1; wh2 = wh
            window(s, dx+dw+max(2, (w-dx-dw-ww2)//2), gy+4, ww2, wh2, r, 92, z=3.)
            # a gable stone
    if seed % 2 == 0 and gable != 'flat' and gh >= 20:
        s.use(95, 3.)
        gw_, gh_ = 7, 5
        gx_, gy_ = (w-gw_)//2, gh-gh_+1
        s.rect(t0, gx_, gy_, gw_, gh_); s.rect(R['blue'][2], gx_+1, gy_+1, gw_-2, gh_-2); s.px(R['yellow'][1], gx_+4, gy_+1); s.hl(R['leaf'][1], gx_+1, gy_+3, gw_-2)
        s.use(1, 1.)
    if kit.U >= 2: facade_things(s, w, top, bot, gr, gh, st, sh, ww, wh, n, gap, seed, r, plastered)
    s = add_margin(s)
    s.finish(outline=outline)
    return s

def facade_things(s, w, top, bot, gr, gh, st, sh, ww, wh, n, gap, seed, r, plastered):
    """Small things on a house, each a hard little cluster: shutters, wall anchors, a door lamp, a number, a sign, pots."""
    # shutters on the upper windows of some houses
    if seed % 3 == 2 and gap >= 5:
        col = R[['dgreen','navy','dred'][seed % 3 if False else (seed//3) % 3]]
        for j in range(st):
            wy = top+5+j*sh
            for i in range(n):
                wx = int(round(gap+i*(ww+gap)))
                s.use(200+i+j*7, 2.6)
                for sx in (wx-3, wx+ww+1):
                    if sx < 1 or sx+2 >= w: continue
                    s.rect(col[1], sx, wy, 2, wh); s.vl(col[2], sx, wy, wh); s.hl(col[0], sx, wy, 2)
                    for q in range(wy+2, wy+wh-1, 2): s.hl(col[3], sx, q, 2)
    # wall anchors: little iron crosses on the storey lines
    if not plastered:
        s.use(240, 2.7)
        for j in range(st):
            ay = top+6+j*sh+wh//2
            for sx in (2, w-5):
                s.vl(K, sx, ay-1, 3); s.hl(K, sx-1, ay, 3)
    # a door lamp, a number tile, a letter plate, a pot on the steps
    s.use(250, 4.)
    fy = bot-gr
    lx = 3 if (seed % 2) else max(3, w-14)
    s.rect(R['hull'][3], lx, fy+7, 3, 1); s.rect(R['glow'][1], lx, fy+8, 3, 3); s.vl(R['glow'][0], lx+2, fy+8, 3); s.hl(R['hull'][3], lx, fy+11, 3)
    s.use(251, 4.)
    s.rect(R['navy'][2], lx, fy+13, 3, 2); s.px(R['xw'][0], lx+1, fy+13)
    if r.random() < .55:
        s.use(252, 4.); px_ = lx+4
        s.rect(R['bricko'][2], px_, bot-7, 3, 3); s.hl(R['bricko'][0], px_, bot-7, 3)
        for i in range(6):
            s.px(R['leaf'][int(r.integers(0, 3))], px_+int(r.integers(-1, 4)), bot-8-int(r.integers(0, 3)))
    # a hanging sign on some ground floors
    if seed % 5 == 1 and w >= 40:
        s.use(253, 4.); sx = w-12; sy = fy+3
        s.hl(K, sx, sy, 10); s.vl(K, sx+2, sy, 2); s.vl(K, sx+7, sy, 2)
        cc = R[['dred','navy','dgreen','bricko','blue'][(seed//5) % 5]]
        s.rect(cc[1], sx, sy+2, 10, 6); s.hl(cc[0], sx, sy+2, 10); s.hl(cc[3], sx, sy+7, 10); s.vl(cc[0], sx+9, sy+2, 6)
        s.hl(R['xw'][0], sx+2, sy+4, 6)
    # a street name plate on the corner
    if seed % 7 == 2:
        s.use(254, 4.); sx = 3; sy = fy+3
        s.rect(R['blue'][2], sx, sy, 11, 4); s.hl(R['blue'][0], sx, sy, 11); s.hl(R['xw'][0], sx+2, sy+2, 7)

def _m(H, W, x, y, w, h):
    k = np.zeros((H, W), bool); k[max(y,0):max(y+h,0), max(x,0):max(x+w,0)] = True; return k

# ------------------------------------------------------------------ foliage: clumps of leaf clusters, like a hero's hair
STAMPS = [[(0,0),(1,0),(0,1)], [(0,0),(1,0),(2,0),(1,1)], [(0,0),(1,0),(1,-1)], [(0,0),(1,0),(2,0),(2,-1)], [(0,0),(0,1),(1,1)]]
def clumps(cw, ch, seed, n=None):
    r = rngf(seed); n = n or int(8+cw*.12); out = []
    for i in range(n):
        a = r.random()*math.tau; d = r.random()**.6
        out.append((cw/2+math.cos(a)*d*cw*.36, ch*.48+math.sin(a)*d*ch*.34, (8+r.random()*9)*(cw/100)**.45+2, r.random()*math.tau))
    out.sort(key=lambda p: p[1]-p[0]*.25)   # upper left first: the nearer clumps sit lower and more to the sun
    return out

def crown(cw, ch, seed, frame=0, n_frames=4, mat='leaf', sprite=True, amp=1):
    """A crown as one sprite. Frames move each clump by one pixel on its own phase: sprite animation, no smoothing."""
    hi, ba, sd, dk = R[mat]
    s = S(cw, ch)
    r0 = rngf(seed+1)
    for i, (cx, cy, rr, ph) in enumerate(clumps(cw, ch, seed)):
        ox = int(round(math.sin(ph+frame/n_frames*math.tau)*amp*.75)); oy = int(round(math.sin(ph*1.7+frame/n_frames*math.tau)*amp*.45))
        s.use(10+i, 1+i*.5)
        cx2, cy2 = cx+ox, cy+oy
        r1 = rngf(int(seed*7+i*13))
        # a rough clump: the disc plus a leafy edge, shaded in hard bands
        pts = int(rr*rr*1.05)
        s.ell(sd, cx2, cy2, rr, rr*.92)
        for q in range(pts):
            a = r1.random()*math.tau; d = math.sqrt(r1.random())
            ex = cx2+math.cos(a)*d*(rr+1.6); ey = cy2+math.sin(a)*d*(rr*.92+1.4)
            lx = (ex-cx2)/rr; ly = (ey-cy2)/rr
            l = lx*.55-ly*.83+(r1.random()-.5)*.34
            tone = hi if l > .62 else ba if l > .08 else sd if l > -.52 else dk
            st = STAMPS[int(r1.integers(0, len(STAMPS)))]
            for dx, dy in st: s.px(tone, int(ex)+dx, int(ey)+dy)
    s = add_margin(s, 2)
    s.finish(outline=K)
    return s

def trunk(s, cx, base, height, tw=6, seed=1, cw=100):
    """A trunk like a hero's limb: four hard bands, lit on the right, with a few bark lines."""
    r = rngf(seed); hi, ba, sd, dk = R['bark']
    th = int(height)
    s.use(50, 2.)
    for i in range(th):
        y = base-i; u = i/th
        w = max(3, int(round(tw*(1-u*.42)+(1-min(u*7,1))*tw*.5)))
        x0 = int(cx-w/2+math.sin(u*1.7+seed)*2)
        s.hl(sd, x0, y, w)
        s.px(dk, x0, y); 
        if w >= 3: s.px(hi if w < 5 else ba, x0+w-1, y)
        if w >= 5: s.px(ba, x0+w-2, y); s.px(ba, x0+w-3, y)
        if w >= 7: s.px(hi, x0+w-2, y)
    for _ in range(int(th/5)):
        y = base-int(r.integers(1, th)); u = (base-y)/th
        x0 = int(cx+math.sin(u*1.7+seed)*2)+int(r.integers(-2, 2))
        L = int(r.integers(2, 5))
        s.vl(dk, x0, y, L)

# ------------------------------------------------------------------ the sky
def sky_bands(s, tones, stops, seed=1):
    """Sky in hard bands with stepped edges, no dither."""
    r = rngf(seed)
    edges = []
    for i, y in enumerate(stops):
        e = np.zeros(s.w, int); x = 0
        while x < s.w:
            L = int(r.integers(6, 24)); e[x:x+L] = int(r.integers(0, 3)); x += L
        edges.append(y+e)
    s.c[:] = tones[0]; s.z[:] = -5
    for i, ee in enumerate(edges):
        for x in range(s.w): s.c[ee[x]:, x] = tones[i+1]

def cloud_sprite(w, h, seed, flat=True, mat='cloud'):
    """A cumulus in hard bands: lit on the upper right, grey-blue under, separated clumps. No outline: it stays far away."""
    r = rngf(seed); a, b, c, d = R[mat]
    s = S(w+4, h+4)
    n = int(w/5)+3
    pf = []
    for i in range(n):
        px_ = 2+r.random()*w
        env = (1-abs((px_-2)/w*2-1))**.7
        pf.append((px_, h+1-r.random()*(h-3)*env, 2.5+h*.2*(.5+.6*r.random())*max(env,.45)))
    pf.sort(key=lambda p: p[1])
    for i, (cx, cy, rr) in enumerate(pf):
        s.use(10+i, 1+i*.4)
        s.ell(c, cx, cy, rr, rr*.85)
        Y, X = np.ogrid[:s.h, :s.w]
        L = ((X-cx)*.55-(Y-cy)*.83)/rr
        k0 = ((X-cx)**2+((Y-cy)/.85)**2 <= rr*rr)
        s._mask((slice(0,s.h),slice(0,s.w)), b, k0 & (L > -.45))
        s._mask((slice(0,s.h),slice(0,s.w)), a, k0 & (L > .2))
    if flat:
        s.c[h+2:, :] = 0
        s.c[h+1, :] = np.where(s.c[h+1, :] > 0, d, 0); s.c[h, :] = np.where(s.c[h, :] > 0, c, 0)
    s.finish(outline=0)
    return s

def skyline(s, base, seed):
    r = rngf(seed); x = -6; a, b, c = R['far']; ra, rb = R['farr']
    while x < s.w:
        w = int(r.integers(14, 28)); h = int(r.integers(22, 50))
        kind = str(r.choice(['step','neck','spout','bell']))
        o = S(w, h+14); o.use(1, 1.)
        tone = [a, b, c][int(r.integers(0, 3))]
        o.poly(tone, gable_pts(kind, w, 14)); o.rect(tone, 0, 14, w, h)
        o.vl(c if tone != c else rb, 0, 14, h)
        for wy in range(18, h+10, 8):
            for i in range((w-3)//6): o.rect(rb, 3+i*6, wy, 2, 3)
        s.paste(o, x, base-h-14)
        x += w+int(r.integers(-1, 3))

def far_tower(s, x, base, h):
    a, b, c = R['far']; ra, rb = R['farr']
    w = max(8, h//6)
    s.rect(b, x, base-h, w, h); s.vl(a, x+w-1, base-h, h); s.vl(c, x, base-h, h)
    for j in range(base-h+4, base-h//3, 11):
        s.hl(a, x, j, w); s.rect(rb, x+w//2-1, j+3, 2, 4)
    s.rect(a, x+1, base-h-8, w-2, 8); s.rect(rb, x+w//2-1, base-h-6, 2, 4)
    s.poly(ra, [(x,base-h-8),(x+w/2,base-h-28),(x+w,base-h-8)]); s.poly(rb, [(x,base-h-8),(x+w/2,base-h-28),(x+w/2,base-h-8)])

# ------------------------------------------------------------------ water: flat hard shapes
def water_band(W, y0, y1, src, seed, frame=0, n_frames=3, base=2):
    """A sprite of the water from y0 to y1. src (RGBA) is what stands on the bank; it reflects in blocks of 2 or 3 tones."""
    w0, w1, w2, w3, w4 = R['water']; a0, a1, a2, a3 = R['waterw']
    s = S(W, y1)
    H = y1-y0
    s.rect(w2, 0, y0, W, H)
    r = rngf(seed)
    jit = r.integers(-2, 3, 32)
    ph = r.random(W)
    for j in range(H):
        y = y0+j; d = j/max(H,1)
        sy = int(y0-1-j*1.25)
        row = None
        if src is not None and sy >= 0 and d < .92:
            amp = 1+int(d*5)
            sh = int(jit[(j//2+frame*2) % 32])*amp
            row = np.roll(src[sy], sh, axis=0)
        x = 0
        rx = rngf(seed+j*97)
        while x < W:
            L = int(rx.integers(4, 11+int(d*20)))
            c = w2 if d > .12 else w3
            if row is not None:
                q = row[min(x+L//2, W-1)]
                lum = (.3*int(q[0])+.59*int(q[1])+.11*int(q[2]))/255
                warm = int(q[0])-int(q[2]) > 28
                if q[3] == 0: c = w2
                elif warm:
                    c = (a2 if lum > .5 else a3) if d < .5 else (a3 if lum > .5 else w3)
                else:
                    c = w1 if lum > .72 else (w2 if lum > .42 else w3)
            s.c[y, max(x,0):min(x+L,W)] = c; s.z[y, max(x,0):min(x+L,W)] = 0; s.p[y, max(x,0):min(x+L,W)] = 1
            x += L
    # crests and troughs: dashes that change per frame
    r2 = rngf(seed+1000+frame)
    cnt = int(W*H/130)
    for _ in range(cnt):
        y = int(y0+(r2.random()**.8)*H); d = (y-y0)/max(H,1)
        x = int(r2.integers(0, W)); L = int(r2.integers(2, 6+int(d*12)))
        t = r2.random()
        c = w0 if t < .16 else (w1 if t < .55 else w3)
        s.c[y, max(x,0):min(x+L,W)] = c
        if c == w0 and L >= 3 and y+1 < y1:
            s.c[y+1, max(x+1,0):min(x+L-1,W)] = w1
    # the shadow of the bank
    s.c[y0:y0+1, :] = w4; s.c[y0+1:y0+2, :][s.c[y0+1:y0+2, :] == w2] = w3
    return s

# ------------------------------------------------------------------ floors: hard clusters, dark joints
def rows(y0, y1, a, b, world=(146,216)):
    y = y0
    out = []
    while y < y1:
        t = (y-world[0])/(world[1]-world[0])
        h = int(round(a+(b-a)*t))
        h = min(h, y1-y)
        out.append((y, h)); y += h
    return out

def cobbles(s, y0, y1, seed):
    """Loaf-shaped setts, each one a little sprite: a dark joint, a lit top right, a shaded foot."""
    r = rngf(seed); a, b, c, d = R['cobble']
    s.use(1, 0.)
    s.rect(d, 0, y0, s.w, y1-y0)
    for y, h in rows(y0, y1, 4, 7):
        sw = int(h*1.9)
        x = -int(r.integers(0, sw))
        while x < s.w:
            w = sw+int(r.integers(-1, 3))
            t = r.random()
            ba = b if t < .72 else (c if t < .9 else a)
            lo = c if ba != c else d
            hi = a if ba != a else R['pave'][0]
            s.rect(ba, x+1, y, w-2, h-1)
            s.hl(lo, x+1, y+h-2, w-2)                       # the foot
            s.hl(hi, x+1+int(w*.45), y, max(1, w-2-int(w*.45)))     # the top catches the sun on the right
            s.px(d, x+1, y); s.px(d, x+1, y+h-2); s.px(d, x+w-2, y+h-2)
            x += w

def pavers(s, y0, y1, seed, a=3, b=5, wfac=3.0, mat='pave', bond=.5):
    r = rngf(seed); c0, c1, c2, c3 = R[mat]
    s.use(1, 0.)
    s.rect(c2, 0, y0, s.w, y1-y0)
    for n, (y, h) in enumerate(rows(y0, y1, a, b)):
        sw = int(h*wfac)
        x = -int((n % 2)*sw*bond)-int(r.integers(0, 2))
        while x < s.w:
            t = r.random()
            ba = c1 if t < .84 else (c0 if t < .91 else c2)
            s.rect(ba, x, y, sw-1, h-1)
            if ba == c1 and r.random() < .4: s.hl(c0, x+int(sw*.45), y, sw-1-int(sw*.45))
            s.vl(c3, x+sw-1, y, h); s.hl(c3 if r.random() < .5 else c2, x, y+h-1, sw)
            x += sw

def kerb(s, y, h, seed=1):
    """Kerbstones: a bright top, a dark face, dark joints. The only ground a post may stand on."""
    a, b, c, d = R['kerb']; r = rngf(seed)
    top = max(1, h//2)
    s.use(1, 0.)
    s.rect(a, 0, y, s.w, top); s.rect(c, 0, y+top, s.w, h-top); s.hl(d, 0, y+h-1, s.w)
    x = 0
    while x < s.w:
        w = int(r.integers(22, 36))
        s.vl(d, x, y, h)
        s.hl(b, x+1, y+top-1, int(w*.4))
        x += w

def lane(s, y0, y1, seed):
    a, b, c, d = R['lane']; r = rngf(seed)
    s.use(1, 0.)
    s.rect(b, 0, y0, s.w, y1-y0)
    s.hl(d, 0, y0, s.w); s.hl(c, 0, y0+1, s.w)
    for _ in range(int(s.w*(y1-y0)/60)):
        x = int(r.integers(0, s.w)); y = int(r.integers(y0+2, y1)); L = int(r.integers(2, 7))
        t = r.random()
        s.hl(a if t < .38 else c, x, y, L)
        if t >= .38 and y+1 < y1: s.hl(c, x+1, y+1, max(1, L-2))
    my = (y0+y1)//2-1
    p0, p1, p2 = R['paint']
    for x in range(0, s.w, 32):
        s.rect(p0, x, my, 16, 2); s.hl(p2, x, my+2, 16); s.vl(p1, x, my, 2)

def gravel(s, y0, y1, seed):
    a, b, c, d = R['gravel']; r = rngf(seed)
    s.use(1, 0.); s.rect(b, 0, y0, s.w, y1-y0)
    for _ in range(int(s.w*(y1-y0)/9)):
        x = int(r.integers(0, s.w)); y = int(r.integers(y0, y1)); L = int(r.integers(2, 5))
        t = r.random()
        s.hl(a if t < .36 else c, x, y, L)
        if t > .86 and y+1 < y1: s.hl(d, x, y+1, max(1, L-1))

def grass(s, y0, y1, seed):
    a, b, c, d = R['grass']; r = rngf(seed)
    s.use(1, 0.); s.rect(b, 0, y0, s.w, y1-y0)
    for _ in range(int(s.w*(y1-y0)/10)):
        x = int(r.integers(0, s.w)); y = int(r.integers(y0, y1-1)); t = r.random()
        q = a if t < .3 else (c if t < .85 else d)
        s.vl(q, x, y, int(r.integers(2, 4))); s.px(q, x+1, y+1)

# ------------------------------------------------------------------ street furniture: hand-drawn grids, then selout + outline
POST = ['..bba..', '.cbbaa.', 'cbbbbaa', 'cbbbbba', 'ddcccdd', 'cbbbbba', 'cwdddwa', 'cdwdwda', 'cddwdda', 'cdwdwda', 'cwdddwa', 'cbbbbba', 'cwdddwa', 'cdwdwda', 'cddwdda', 'cdwdwda', 'cwdddwa', 'cbbbbba', 'cwdddwa', 'cdwdwda', 'cddwdda', 'cdwdwda', 'cwdddwa', 'cbbbbba', 'ccbbbaa', 'dddcccc']
POST_FAR = ['..bba..', '.cbbaa.', 'cbbbbba', 'ddcccdd', 'cwdddwa', 'cdwdwda', 'cddwdda', 'cdwdwda', 'cwdddwa', 'cbbbbba', 'cwdddwa', 'cdwdwda', 'cddwdda', 'cdwdwda', 'cwdddwa', 'cbbbbba', 'cwdddwa', 'cdwdwda', 'cddwdda', 'cdwdwda', 'cwdddwa', 'ccbbbaa', 'dddcccc']
def post(far=False):
    """An Amsterdammertje: a round cast post, a round head, a collar, three white crosses. Returns (sprite, foot x, foot y)."""
    rows_ = POST_FAR if far else POST
    a, b, c, d = R['bollard']; w = R['xw'][0]
    s = S(len(rows_[0]), len(rows_)); s.use(1, 1.)
    s.grid(rows_, 0, 0, {'a': a, 'b': b, 'c': c, 'd': d, 'w': w})
    s = add_margin(s); s.finish()
    return s

def tube(s, col, x, y, w, h):
    """A pole: hard bands, lit right."""
    a, b, c, d = R[col]
    s.rect(b, x, y, w, h)
    s.vl(c, x, y, h)
    if w >= 3: s.vl(a, x+w-2 if w >= 4 else x+w-1, y, h)
    if w >= 5: s.vl(d, x, y, h); s.vl(c, x+1, y, h)

def lamp(h=70):
    """A green iron street lantern, drawn at the heroes' scale."""
    a, b, c, d = R['iron']; g0, g1, g2, g3 = R['glow']
    W = 15; s = S(W, h)
    mid_ = 7
    s.use(1, 1.)
    tube(s, 'iron', mid_-1, 18, 4, h-26)
    s.use(2, 2.)
    s.grid(["....abba.....",]*0, 0, 0, {})
    # the foot
    for i, (w, t) in enumerate(((5,b),(7,b),(9,b))):
        pass
    tube(s, 'iron', mid_-2, h-14, 6, 5); tube(s, 'iron', mid_-3, h-9, 8, 5); tube(s, 'iron', mid_-4, h-4, 10, 4)
    s.hl(a, mid_-3, h-9, 8); s.hl(a, mid_-4, h-4, 10); s.hl(a, mid_-2, h-14, 6)
    # the rings on the post
    s.use(3, 2.5); tube(s, 'iron', mid_-2, 30, 6, 2); s.hl(a, mid_-2, 30, 6); tube(s, 'iron', mid_-2, 44, 6, 2)
    # the scrolls
    s.use(4, 2.5)
    s.grid(["cb.......bc","c.b.....b.c",".b.b...b.b.","...b...b..."], mid_-5, 19, {'b': b, 'c': a})
    # lantern
    s.use(5, 3.)
    s.grid(["..a..",".bab.","bbbba"], mid_-2+.0 if False else mid_-2, 0, {'a': a, 'b': b})
    s.rect(d, mid_-5, 3, 12, 1); s.hl(a, mid_+1, 3, 6)
    for j in range(10):
        w = 10-(j//4)
        x0 = mid_+1-w//2-0
        s.hl(g1, x0, 4+j, w)
        s.px(g2, x0, 4+j); s.px(g0, x0+w-2, 4+j); s.px(g0, x0+w-3, 4+j)
    s.vl(d, mid_+1, 4, 10); s.vl(c, mid_-2, 4, 10); s.vl(c, mid_+4, 4, 10)
    s.use(6, 3.5); tube(s, 'iron', mid_-3, 14, 8, 2); s.hl(a, mid_-3, 14, 8); tube(s, 'iron', mid_-1, 16, 4, 2)
    s = add_margin(s); s.finish()
    return s

def bench():
    a, b, c, d = R['wood']; i0, i1, i2, i3 = R['iron']
    s = S(34, 16)
    s.use(1, 1.)
    for y in (0, 4, 8):
        s.rect(b, 2, y, 30, 3); s.hl(a, 2, y, 30); s.hl(d, 2, y+2, 30); s.vl(c, 2, y, 2)
        for x in range(6, 30, 7): s.hl(c, x, y+1, 3)
    s.use(2, 2.)
    for x in (4, 27):
        s.rect(i1, x, 0, 3, 16); s.vl(i0, x+2, 0, 16); s.vl(i2, x, 0, 16)
        s.rect(i2, x-1, 15, 5, 1)
        for y in (2, 6, 10): s.px(R['pole'][0], x+1, y)
    s.use(3, 1.5); s.rect(i2, 2, 12, 30, 1)
    s = add_margin(s); s.finish()
    return s

def bike(col='navy'):
    """A Dutch city bike at the same size and with the same tyre and rim as the rider's bike."""
    a, b, c, d = R[col]; t0, t1, t2, t3 = R['pole']
    W, H = 40, 27
    s = S(W, H)
    wr = 7
    cy = H-wr-1
    for cx in (8, 31):
        s.use(10+cx, 2.)
        for ang in np.arange(0, 360, 2):
            ca, sa = math.cos(math.radians(ang)), math.sin(math.radians(ang))
            s.px(R['hull'][3], round(cx+ca*wr), round(cy+sa*wr))
            s.px(R['hull'][2], round(cx+ca*(wr-1)), round(cy+sa*(wr-1)))
            s.px(t2 if not (ang < 330 and ang > 200) else t0, round(cx+ca*(wr-2)), round(cy+sa*(wr-2)))
        s.px(t0, cx, cy); s.px(t1, cx+1, cy)
    th = np.zeros((H, W), bool)
    s.use(30, 3.)
    fr = [((8,cy),(15,cy-9)),((15,cy-9),(26,cy-9)),((15,cy-9),(19,cy)),((26,cy-9),(19,cy)),((26,cy-9),(31,cy)),((8,cy),(19,cy))]
    for p, q in fr: s.line(b, p[0], p[1], q[0], q[1])
    for p, q in fr[:2]: s.line(a, p[0], p[1]-1, q[0], q[1]-1)
    s.use(31, 3.5)
    s.grid(["hhhh.","..hh."], 12, cy-14, {'h': R['hull'][3]})
    s.vl(b, 14, cy-12, 3)
    s.vl(c, 27, cy-14, 5); s.hl(R['hull'][3], 26, cy-15, 5)
    s.use(32, 3.5)
    s.rect(R['wood'][1], 28, cy-18, 7, 3); s.hl(R['wood'][0], 28, cy-18, 7); s.vl(R['wood'][2], 28, cy-17, 2); s.px(R['glow'][1], 34, cy-14)
    s.use(33, 3.5)
    s.rect(R['dred'][1], 4, cy-9, 8, 4); s.hl(R['dred'][0], 4, cy-9, 8); s.vl(R['dred'][2], 4, cy-9, 4)
    s.ell(t1, 19, cy, 2, 2); s.px(t0, 20, cy-1)
    s = add_margin(s); s.finish()
    return s

def hedge(w, h, seed):
    """A low clipped hedge: leaf clusters in hard bands."""
    a, b, c, d = R['leaf']; r = rngf(seed)
    s = S(w, h); s.use(1, 1.)
    s.rect(c, 0, 2, w, h-2); s.hl(d, 0, h-1, w)
    for _ in range(int(w*h/4)):
        x = int(r.integers(0, w)); y = int(r.integers(0, h)); v = 1-y/h+(x/w)*.25+(r.random()-.5)*.4
        t = a if v > .95 else b if v > .55 else c if v > .2 else d
        for dx, dy in STAMPS[int(r.integers(0, 5))]: s.px(t, x+dx, y+dy)
    s = add_margin(s); s.finish()
    return s

def planter():
    """A wooden planter: returns (box, list of tulip frames). The tulips are hard little clusters that nod one pixel."""
    a, b, c, d = R['wood']
    W = 30
    s = S(W, 10); s.use(1, 1.)
    s.rect(b, 0, 2, W, 8); s.hl(a, 0, 2, W); s.hl(c, 0, 3, W); s.hl(d, 0, 9, W)
    for x in range(4, W, 6): s.vl(c, x, 4, 5)
    s.vl(a, W-1, 2, 8); s.vl(d, 0, 2, 8)
    s.rect(R['iron'][1], 0, 2, 2, 8) ; s.rect(R['iron'][1], W-2, 2, 2, 8)
    s = add_margin(s); s.finish()
    fr = []
    for f in range(2):
        o = S(W, 12); r = rngf(7)
        o.use(1, 1.)
        for x in range(1, W-2, 2):
            h = int(r.integers(4, 9))
            lean = (x+f*2) % 4 == 0 and f
            o.vl(R['leaf'][1], x, 12-h, h)
            if r.random() < .5: o.px(R['leaf'][0], x+1, 12-h+2)
            q = R[str(r.choice(['tulip','yellow','dred','cloth']))]
            tx = x+(1 if lean else 0)
            o.grid(["ab","ba"][:], tx, 12-h-2, {'a': q[0], 'b': q[1]})
        o = add_margin(o); o.finish()
        fr.append(o)
    return s, fr

def flag_frames(kind='nl', n=6, fw=28, fh=18):
    out = []
    bands = ('dred','white','navy') if kind == 'nl' else ('dred','hull','dred')
    for f in range(n):
        s = S(fw, fh+6); s.use(1, 1.)
        ph = f/n*math.tau
        for i in range(fw):
            q = i/fw
            w = math.sin(i*.28-ph)
            yo = 3+int(round(w*2*(.2+q)))
            tone = 0 if math.cos(i*.28-ph) > .78 else 1 if math.cos(i*.28-ph) > -.4 else 2
            for bi, m in enumerate(bands):
                s.vl(R[m][tone], i, yo+bi*fh//3, fh//3+(1 if bi == 2 else 0))
            if kind == 'city':
                for xi in (5, 13, 21):
                    d = abs(i-xi)
                    if d <= 2:
                        s.px(R['xw'][0], i, yo+fh//2-d); s.px(R['xw'][0], i, yo+fh//2+d-1)
        s = add_margin(s); s.finish()
        out.append(s)
    return out

def flag_pole(h):
    s = S(4, h); s.use(1, 1.)
    tube(s, 'pole', 1, 3, 2, h-3)
    s.rect(R['brass'][1], 0, 0, 4, 3); s.hl(R['brass'][0], 1, 0, 3); s.px(R['brass'][2], 0, 2)
    s = add_margin(s); s.finish()
    return s

def crate(w=22, h=16):
    a, b, c, d = R['wood']; tp = 4
    s = S(w+tp, h+tp); s.use(1, 1.)
    s.poly(a, [(0,tp),(tp,0),(w+tp-1,0),(w-1,tp)])
    s.use(2, .8); s.poly(c, [(w,tp),(w+tp-1,0),(w+tp-1,h-1),(w,h+tp-1)])
    s.use(3, 2.)
    s.rect(b, 0, tp, w, h)
    s.hl(a, 0, tp, w); s.hl(d, 0, tp+h-1, w); s.vl(c, 0, tp, h); s.vl(a, w-1, tp, h)
    for y in range(tp+4, tp+h-1, 4): s.hl(c, 1, y, w-2)
    s.line(c, 2, tp+h-3, w-3, tp+2); s.line(d, 2, tp+h-2, w-3, tp+3)
    for x, y in ((1,tp+1),(w-2,tp+1),(1,tp+h-2),(w-2,tp+h-2)): s.px(R['pole'][1], x, y)
    s = add_margin(s); s.finish()
    return s

def stand(label='HOTDOGS', stripe='dred'):
    """A white wagon at the heroes' scale. Same outline, same tones as a hero's jacket."""
    w0, w1, w2, w3 = R['white']; WW, HH = 84, 54
    s = S(WW, HH)
    y = 12; w, h = 72, 34; x = 4
    # the side face to the right is lit: the sun is on that side
    s.use(1, 1.)
    s.poly(w1, [(x+w,y),(x+w+8,y-3),(x+w+8,y+h-4),(x+w,y+h)])
    s.vl(w2, x+w, y, h)
    s.use(2, 2.)
    s.rect(w0, x, y, w, h); s.vl(w1, x, y, h); s.vl(w1, x+1, y, h); s.hl(w1, x, y+h-5, w); s.hl(w2, x, y+h-4, w); s.hl(w2, x, y+h-1, w)
    for q in range(x+4, x+14, 4): s.vl(w1, q, y+2, h-8)
    # the hatch, the counter, what is on it
    s.use(3, 3.)
    s.rect(R['hull'][3], x+16, y+6, 38, 16); s.hl(R['glow'][1], x+18, y+8, 34); s.hl(R['glow'][2], x+18, y+9, 34)
    for q, m in ((x+20,'dred'),(x+24,'yellow'),(x+28,'dgreen')):
        s.rect(R[m][1], q, y+15, 3, 6); s.vl(R[m][0], q+2, y+15, 6); s.hl(R['cloth'][0], q, y+14, 3)
    for q in (x+33, x+38, x+43):
        s.rect(R['bricko'][1], q, y+18, 4, 3); s.hl(R['bricko'][0], q+1, y+17, 3); s.hl(R['dred'][1], q, y+19, 4); s.hl(R['bricko'][2], q, y+20, 4)
    for q in range(x+19, x+52, 4):
        s.rect(R['brickb'][1], q, y+10, 2, 3); s.px(R['brickb'][0], q+1, y+10)
    s.use(4, 3.5); s.rect(R['wood'][1], x+14, y+22, 42, 2); s.hl(R['wood'][0], x+14, y+22, 42); s.hl(R['wood'][3], x+14, y+24, 42)
    # the menu
    s.use(5, 3.)
    s.rect(R['cloth'][0], x+58, y+6, 11, 15); s.hl(R['dred'][1], x+58, y+6, 11)
    for j in range(3): s.hl(R['hull'][3], x+59, y+9+j*3, 6); s.rect(R['dred'][1], x+66, y+9+j*3, 2, 1)
    # the small window on the other side
    s.use(6, 3.)
    s.rect(R['glass'][2], x+5, y+6, 8, 10); s.hl(R['glass'][3], x+5, y+6, 8); s.line(R['glass'][0], x+11, y+7, x+8, y+12); s.line(R['glass'][1], x+12, y+8, x+9, y+14)
    # the name
    text(s, label, x+(w-text_w(label))//2-0, y+26, R['navy'][2])
    s.use(7, 2.5); s.hl(R[stripe][1], x, y+h-3, w)
    # the awning: stripes, a lit top, a scalloped hem
    s.use(8, 4.)
    s.poly(R['white'][0], [(x-3,y),(x+5,y-8),(x+w+11,y-8),(x+w+4,y)])
    sa, sb, sc, sd = R[stripe]
    for i in range(0, w+8, 8):
        s.poly(sb, [(x-3+i,y),(x+5+i,y-8),(x+9+i,y-8),(x+1+i,y)])
    s.hl(R['white'][1], x-3, y, w+8)
    for i in range(0, w+6, 8):
        s.rect(sb, x-3+i, y+1, 4, 3); s.hl(sd, x-3+i, y+4, 4); s.hl(sc, x-3+i, y+3, 4)
        s.rect(R['white'][0], x+1+i, y+1, 4, 3); s.hl(R['white'][2], x+1+i, y+4, 4); s.hl(R['white'][1], x+1+i, y+3, 4)
    # wheels
    for wx in (x+14, x+56):
        s.use(9, 5.)
        s.ell(R['hull'][3], wx, y+h+1, 7, 7); s.ell(R['hull'][2], wx, y+h+1, 6, 6); s.ell(R['pole'][1], wx, y+h+1, 3, 3); s.px(R['pole'][0], wx+1, y+h); s.px(R['pole'][3], wx, y+h+1); s.px(R['pole'][2], wx-1, y+h+2)
    s.use(10, 1.5); s.rect(R['pole'][1], 0, y+h-1, 5, 2) ; s.hl(R['pole'][0], 0, y+h-1, 5); s.rect(R['pole'][2], 0, y+h+1, 2, 7)
    s = add_margin(s); s.finish()
    return s

def stall(w, seed, cloth=('dred','white')):
    """A flea market stall: striped awning, goods on a table. Returns (sprite, hanging cloth frames)."""
    r = rngf(seed); H = 50; s = S(w+6, H); y0 = 10; b = H-1
    x = 3
    for a_ in (x+1, x+w-3):
        s.use(1, 1.); tube(s, 'pole', a_, y0, 2, H-y0)
    s.use(2, 1.2); s.rect(R['hull'][3], x+1, y0, w-2, 3)
    # the goods
    s.use(3, 2.)
    gx = x+3
    tb = H-15
    while gx < x+w-8:
        k = int(r.integers(0, 5))
        if k == 0:
            for j in range(int(r.integers(2, 5))):
                c = R[str(r.choice(['navy','dred','dgreen','bricko']))]
                s.hl(c[1], gx, tb-2-j*2, 9); s.hl(c[2], gx, tb-1-j*2, 9); s.px(R['cloth'][0], gx+8, tb-2-j*2)
            gx += 11
        elif k == 1:
            br = R['brass']
            s.rect(br[1], gx+2, tb-9, 2, 9); s.vl(br[0], gx+3, tb-9, 9); s.vl(br[2], gx+2, tb-9, 9)
            s.ell(br[1], gx+2.5, tb-11, 3.5, 2.5); s.px(br[0], gx+4, tb-12); s.hl(br[2], gx-1, tb-1, 7)
            gx += 10
        elif k == 2:
            w_ = R['wood']; s.rect(w_[1], gx, tb-6, 9, 6); s.hl(w_[0], gx, tb-6, 9); s.hl(w_[2], gx, tb-3, 9); s.vl(w_[3], gx, tb-6, 6); gx += 11
        elif k == 3:
            g = R['glass']; w_ = R['wood']
            s.rect(g[2], gx, tb-10, 8, 9); s.rect(w_[1], gx-1, tb-11, 10, 1); s.rect(w_[2], gx-1, tb-1, 10, 1); s.vl(w_[1], gx-1, tb-11, 11); s.vl(w_[0], gx+8, tb-11, 11)
            s.line(g[0], gx+6, tb-9, gx+3, tb-4); gx += 11
        else:
            bl = R['blue']; s.ell(bl[1], gx+3, tb-4, 3, 4); s.vl(bl[0], gx+5, tb-7, 5); s.vl(bl[2], gx+1, tb-6, 4); s.hl(bl[0], gx+1, tb-9, 5); gx += 8
    # the table
    s.use(4, 3.)
    w_ = R['wood']
    s.rect(w_[1], x, tb, w, 2); s.hl(w_[0], x, tb, w); s.hl(w_[3], x, tb+2, w)
    c0, c1, c2 = R['cloth']
    s.rect(c1, x+1, tb+3, w-2, 5)
    for q in range(x+1, x+w-1, 4): s.vl(c2, q, tb+3, 5)
    s.hl(c2, x+1, tb+7, w-2)
    for a_ in (x+3, x+w-5): s.rect(w_[2], a_, tb+8, 2, 7)
    # the awning
    s.use(5, 4.)
    for i in range(-3, w+3):
        c = R[cloth[((i+3)//7) % 2]]
        s.vl(c[0] if (i+3) % 7 >= 2 else c[1], x+i, y0-9, 8)
        s.vl(c[1], x+i-1 if False else x+i, y0-1, 1)
        s.vl(c[2], x+i, y0, 2)
        if (i+3) % 7 in (2,3,4): s.px(c[1], x+i, y0+2)
    s = add_margin(s); s.finish()
    fr = []
    for f in range(2):
        o = S(w, 14); r2 = rngf(seed+3); o.use(1, 1.)
        for q in range(5, w-5, 11):
            c = R[str(r2.choice(['dred','navy','plastg','bricko']))]
            lean = 1 if (f and q % 2) else 0
            o.rect(c[1], q, 2, 5, 4); o.rect(c[1], q+lean, 6, 5, 6); o.vl(c[0], q+4, 2, 4); o.vl(c[0], q+4+lean, 6, 6); o.vl(c[2], q, 2, 4); o.vl(c[2], q+lean, 6, 6); o.hl(c[3], q+lean, 11, 5)
            o.vl(R['hull'][3], q+2, 0, 2)
        o = add_margin(o); o.finish()
        fr.append(o)
    return s, fr

def houseboat(w, seed, wall='plastg', roof='roof', k=K):
    """A houseboat at the heroes' scale: hull, deck, plank cabin with a side face, roof garden."""
    r = rngf(seed); hull_h, dp, sd, ch = 15, 8, 9, 36; H = dp+ch+26+hull_h
    a, b, c, d = R[wall]
    s = S(w+sd+4, H)
    dy = H-hull_h
    s.use(1, 1.)
    h0, h1, h2, h3 = R['hull']
    s.rect(h2, 0, dy, w, hull_h); s.hl(h0, 0, dy, w); s.hl(h1, 0, dy+1, w); s.hl(h3, 0, dy+2, w); s.rect(h3, 0, dy+hull_h-3, w, 3)
    for x in range(8, w, 26):
        s.ell(h3, x, dy+8, 2, 2); s.px(h0, x+1, dy+7)
    for _ in range(int(w/7)):
        x = int(r.integers(0, w)); y = int(r.integers(dy+4, dy+hull_h-4)); s.hl(h1 if r.random() < .5 else h3, x, y, int(r.integers(2, 6)))
    s.use(2, 1.5)
    W_ = R['wood']
    s.poly(W_[1], [(dp,dy-dp),(w-dp,dy-dp),(w-1,dy-1),(0,dy-1)])
    for j in range(dy-dp, dy, 2): s.hl(W_[2], 2, j, w-4)
    cx, cw = dp+3, w-2*dp-10
    top = dy-dp-ch
    s.use(3, 1.8)
    s.poly(a, [(cx+cw,top),(cx+cw+sd-1,top-4),(cx+cw+sd-1,dy-dp-4),(cx+cw,dy-dp)])
    for j in range(top, dy-dp, 4): s.line(b, cx+cw, j, cx+cw+sd-1, j-4)
    s.use(4, 2.)
    s.rect(b, cx, top, cw, ch)
    for j in range(top+3, dy-dp, 4):
        s.hl(c, cx, j, cw); s.hl(a, cx+int(cw*.55), j+1, int(cw*.45))
    s.vl(d, cx, top, ch); s.vl(c, cx+1, top, ch)
    nw = max(2, (cw-8)//20); gap = (cw-nw*14)/(nw+1)
    for i in range(nw):
        wx = int(cx+gap+i*(14+gap))
        window(s, wx, top+8, 14, 15, r, 30+i*2, z=3., kind=i % 3)
        s.use(50+i, 3.8)
        s.rect(W_[1], wx-1, top+24, 16, 3); s.hl(W_[0], wx-1, top+24, 16); s.hl(W_[3], wx-1, top+27, 16)
        for q in range(wx, wx+14, 2):
            cc = R[str(r.choice(['tulip','yellow','dred','cloth']))]
            s.rect(cc[1], q, top+22, 2, 2); s.px(cc[0], q+1, top+22); s.px(R['leaf'][1], q, top+23)
    rm = R[roof]
    s.use(5, 4.)
    s.poly(rm[1], [(cx-3,top),(cx+6,top-7),(cx+cw+sd+3,top-7),(cx+cw+3,top)])
    s.hl(rm[0], cx+6, top-7, cw+sd-3)
    s.hl(rm[2], cx-3, top, cw+6); s.hl(rm[3], cx-3, top+1, cw+6)
    s.use(6, 4.5); chx = cx+cw-14
    tube(s, 'iron', chx, top-18, 5, 12); s.rect(R['iron'][2], chx-1, top-19, 7, 2); s.hl(R['iron'][0], chx, top-19, 6)
    for q in range(cx+6, cx+int(cw*.45), 9):
        s.use(60+q, 4.5)
        for n in range(16):
            xx = q+r.integers(-5, 5); yy = top-4-r.integers(0, 7)
            l = (xx-q)*.1+(top-4-yy)*.14
            tone = R['leaf'][0] if l > .8 else R['leaf'][1] if l > .3 else R['leaf'][2]
            for dx, dy_ in STAMPS[int(r.integers(0, 5))]: s.px(tone, xx+dx, yy+dy_)
    # a lifebuoy
    s.use(70, 3.5); lx, ly = cx+6, top+5
    s.ell(R['dred'][1], lx, ly, 3, 3); s.ell(R['white'][0], lx, ly, 2, 2); s.px(R['dred'][1], lx-2, ly); s.px(R['dred'][1], lx+2, ly)
    s.rect(c, lx-1, ly-1, 2, 2)
    s = add_margin(s); s.finish(outline=k)
    return s, (cx+cw-12, top-19)

def smoke_frames(n=8):
    out = []
    a, b, c = R['cloth']
    for f in range(n):
        s = S(13, 26); s.use(1, 1.)
        for p in range(3):
            q = ((f/n)+p/3) % 1
            y = 23-q*21; x = 6+math.sin(q*5+p)*(q*3)
            rr = .8+q*2.2
            s.ell(c if q < .6 else b, x, y, rr, rr*.9)
            s.px(a, x+rr*.4, y-rr*.4)
        s.finish(outline=0)
        out.append(s)
    return out

def far_cyclist(col='navy', n=4):
    """A small far cyclist. Same technique, but the thin parts cast no outline, so the wheels stay open."""
    out = []
    for f in range(n):
        s = S(18, 16); s.use(1, 1.)
        for cx in (3, 14):
            for ang in range(0, 360, 10):
                s.px(R['hull'][3], round(cx+math.cos(math.radians(ang))*3), round(12+math.sin(math.radians(ang))*3))
            s.px(R['pole'][1], cx, 12)
        s.use(2, 2.)
        s.line(R['pole'][2], 3, 12, 8, 9); s.line(R['pole'][2], 8, 9, 13, 9); s.line(R['pole'][2], 13, 9, 14, 12); s.line(R['pole'][2], 8, 9, 9, 12)
        s.thin[:] = s.c > 0
        s.use(3, 3.)
        s.rect(R[col][1], 7, 3, 3, 6); s.vl(R[col][0], 9, 3, 5); s.line(R[col][2], 9, 4, 13, 7)
        s.rect(R['skin'][1], 8, 0, 3, 3); s.px(R['skin'][0], 10, 0); s.hl(R['hull'][2], 8, 0, 2)
        a = f/n*math.tau
        s.line(R['hull'][2], 8, 9, int(round(9+math.cos(a)*1.8)), int(round(12+math.sin(a)*1.8)))
        s.thin = s.thin & ~((s.p == 3))
        s = add_margin(s); s.finish(outline=KM)
        out.append(s)
    return out

def bird_frames():
    F_ = [["K.....K",".K...K.","..K.K..","...K..."],["K.....K","KK...KK","..KKK.."],["..KKK..",".K...K.","K.....K"],["KK...KK","..KKK.."]]
    out = []
    for g in F_:
        s = S(7, 5); s.use(1, 1.); s.grid(g, 0, 0, {'K': K}); s.finish(outline=0); out.append(s)
    return out

def tourboat():
    """A flat glass canal boat, faces right."""
    s = S(78, 15); s.use(1, 1.)
    n0, n1, n2, n3 = R['navy']; w0, w1, w2, w3 = R['white']; g = R['glass']
    s.poly(n1, [(0,8),(74,8),(70,13),(3,13)]); s.hl(n0, 0, 8, 74); s.hl(w0, 0, 10, 73); s.hl(n3, 3, 13, 67); s.hl(n2, 2, 12, 69)
    s.use(2, 2.)
    s.rect(g[2], 4, 3, 62, 5)
    for x in range(4, 66, 7): s.vl(w1, x, 3, 5)
    for x in (8, 22, 43, 57): s.line(g[0], x+2, 3, x, 7)
    s.hl(g[1], 4, 3, 62)
    s.use(3, 3.); s.rect(w0, 2, 1, 66, 2); s.hl(w1, 2, 2, 66)
    s = add_margin(s); s.finish(outline=KM)
    return s

def manhole(s, x, y, w=20):
    """An iron cover in the road with three crosses, seen from a low angle."""
    a, b, c, d = R['iron']; s.use(30, .5)
    hh = 3
    s.ell(R['kerb'][1], x, y, w/2+1, hh+1); s.ell(c, x, y, w/2, hh)
    s.hl(d, x-w//2+3, y+hh-1, w-6)
    s.hl(b, x-w//2+4, y-hh+1, w-8)
    for q in (-5, 0, 5):
        s.px(a, x+q-1, y-1); s.px(a, x+q+1, y-1); s.px(a, x+q, y); s.px(a, x+q-1, y+1); s.px(a, x+q+1, y+1)

def drain(s, x, y):
    s.use(31, .5); s.rect(R['hull'][3], x, y, 9, 2)
    for q in range(x+1, x+9, 2): s.vl(R['pole'][2], q, y, 2)

def leaves(s, y0, y1, seed, n):
    """Fallen leaves and petals, little hard clusters that stay inside one floor band."""
    r = rngf(seed); s.use(32, .4)
    for _ in range(n):
        x = int(r.integers(0, s.w)); y = int(r.integers(y0, y1-1))
        c = R[str(r.choice(['bricko','leaf','yellow','bricko']))]
        s.hl(c[1], x, y, 2); s.px(c[0], x+1, y); s.px(c[2] if len(c) > 2 else c[1], x, y+1)

def waste_bin():
    """A city waste container: grey-green with a slot and a shield with three crosses."""
    a, b, c, d = R['iron']
    s = S(18, 30); s.use(1, 1.)
    s.rect(b, 1, 3, 16, 27); s.vl(a, 15, 3, 27); s.vl(a, 14, 3, 27); s.vl(c, 1, 3, 27); s.hl(d, 1, 29, 16)
    s.poly(b, [(1,3),(4,0),(13,0),(16,3)]); s.hl(a, 4, 0, 10); s.hl(d, 1, 3, 16)
    s.use(2, 2.); s.rect(R['hull'][3], 5, 7, 8, 3); s.hl(R['pole'][1], 5, 6, 8)
    s.rect(R['dred'][1], 6, 14, 6, 8); s.hl(R['dred'][0], 6, 14, 6); s.vl(R['dred'][2], 6, 14, 8)
    for q in (15, 18): s.px(R['xw'][0], 8, q); s.px(R['xw'][0], 10, q); s.px(R['xw'][0], 9, q+1)
    s = add_margin(s); s.finish()
    return s

def bike_rack(n=3):
    """A row of iron hoops."""
    s = S(n*9+2, 12); s.use(1, 1.); a, b, c, d = R['pole']
    for i in range(n):
        x = 1+i*9
        s.vl(b, x, 2, 10); s.vl(a, x+6, 2, 10); s.hl(a, x+1, 0, 5); s.px(b, x+1, 1); s.px(a, x+5, 1)
    s.hl(c, 0, 11, n*9+2)
    s = add_margin(s); s.finish()
    return s
