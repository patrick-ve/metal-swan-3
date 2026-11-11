"""POSTCARD CLEAN rebuilt with the heroes' method. Same layout and same layer speeds as before, the floor still one painted image in three bands."""
import json, math, os
import numpy as np
from kit import *
from parts import *

VW, VH = 384, 216
PAN = 420
B0, B1, B2 = 146, 166, 190
S_SKY, S_FAR, S_MID, S_BACK, S_WALK, S_NEAR = .03, .18, .42, .88, 1., 1.16
def lw(speed): return int(VW+PAN*speed)+6

ramp('sky_m', '#2a66bc','#3a7ccb','#5094d6','#6eaee0','#92c6e8','#bcdcec')
ramp('sky_n', '#1c58b4','#2c70c4','#4088d2','#5ca2dc','#80bce6','#a8d4ee')
ramp('sky_g', '#3a6aa8','#6a8cb0','#a0a8ac','#d0bc98','#f0d08c','#fce2a8')
ramp('sky_s', '#1e1650','#3c1e6c','#6c2a7c','#a83c7a','#dc5c6c','#f48c58','#fcb85c')
ramp('cloud_g', '#fff4d0','#fcd89c','#d4a07c','#94707c')
ramp('cloud_s', '#ffe0a4','#f8a06c','#c44c74','#6c3070')
ramp('sun', '#fffde4','#ffe67c','#f6b048')
STOPS = [28, 52, 74, 94, 112]

LIGHTS = dict(
  morning=dict(hi=(255,246,222), lo=(34,40,92), amt=.05, sky='sky_m', cloud='cloud'),
  noon=dict(hi=(255,252,236), lo=(30,38,96), amt=.03, sky='sky_n', cloud='cloud'),
  golden=dict(hi=(255,214,150), lo=(56,36,88), amt=.2, sky='sky_g', cloud='cloud_g'),
  sunset=dict(hi=(255,182,128), lo=(48,22,88), amt=.3, sky='sky_s', cloud='cloud_s'),
)
NOGRADE = None
class PostOnWrongGround(Exception): pass

def grader(L):
    def g(c):
        v = (.3*c[0]+.59*c[1]+.11*c[2])/255
        t, a = (L['hi'], L['amt']*v*1.1) if v > .4 else (L['lo'], L['amt']*(1-v))
        return tuple(int(round(c[i]+(t[i]-c[i])*a)) for i in range(3))
    return g

class Scene:
    def __init__(s, part, light):
        s.part = part; s.L = LIGHTS[light]; s.tb = table(grader(s.L))
        for nm in (s.L['sky'], s.L['cloud'], 'sun'):
            for i in R[nm]: s.tb[i] = hexrgb(COL[i])
        s.items = []; s.posts = []; s.props = {}
    def rgba(s, o): return rgba(o, s.tb)
    def add(s, name, speed, o): s.items.append(dict(t='img', n=name, s=speed, a=s.rgba(o), x=0, y=0))
    def frames(s, name, speed, ls, x, y, fps=8):
        s.items.append(dict(t='frames', n=name, s=speed, fr=[s.rgba(o) for o in ls], x=x, y=y, fps=fps))
    def frames_raw(s, name, speed, ls, x, y, fps=8):
        s.items.append(dict(t='frames', n=name, s=speed, fr=ls, x=x, y=y, fps=fps))
    def bob(s, name, speed, o, x, y, amp=1, ph=0.):
        s.items.append(dict(t='bob', n=name, s=speed, a=s.rgba(o), x=x, y=y, amp=amp, ph=ph))
    def mover(s, name, speed, ls, x0, y, v, span, fps=8):
        s.items.append(dict(t='mover', n=name, s=speed, fr=[s.rgba(o) for o in ls], x=x0, y=y, v=v, span=span, fps=fps))
    def drift(s, name, o, v): s.items.append(dict(t='drift', n=name, s=S_SKY, a=s.rgba(o), x=0, y=0, v=v))
    def blink(s, name, speed, o, x, y, ph, period): s.items.append(dict(t='blink', n=name, s=speed, a=s.rgba(o), x=x, y=y, ph=ph, period=period))
    def actors(s): s.items.append(dict(t='actors'))
    def prop(s, name, o):
        if name not in s.props: s.props[name] = s.rgba(o)

def kerb_posts(sc, target, floor, xs, foot, far, name):
    """Amsterdammertjes stand on kerbstones and nowhere else: the build fails on any other ground."""
    ok = set(R['kerb'])
    sp = post(far)
    for x in xs:
        for fx in (x+1, x+sp.w-2):
            if 0 <= fx < floor.w and int(floor.c[foot, fx]) not in ok:
                raise PostOnWrongGround(f'{sc.part} {name} x={x} y={foot}: the ground is not a kerbstone')
        target.paste(sp, x, foot+2-sp.h)
        sc.posts.append((name, x, foot))
    sc.prop('post', sp)

def sky_clouds(sc, seed, n=7, flat_y=(24,58)):
    sk = S(lw(S_SKY), VH); sky_bands(sk, R[sc.L['sky']], STOPS if len(R[sc.L['sky']]) == 6 else [20,38,54,70,88,106], seed)
    return sk

def add_clouds(sc, seed):
    W = 860; c = S(W, 92); r = rngf(seed)
    for i in range(7):
        x = r.random()*(W-120); w = int(46+r.random()*64); h = int(12+r.random()*10); y = int(2+r.random()*22)
        c.paste(cloud_sprite(w, h, seed+i, mat=sc.L['cloud']), x, y)
    sc.drift('clouds', c, .03)

MATS = ['brickr','brickd','plastc','bricko','plastg','brickb','plastw','brickn','plastp']
KINDS = ['step','neck','bell','flat','spout','neck','step','bell']
def house_row(s, base, seed, sc=None, **kw):
    r = rngf(seed); x = -10; i = int(r.integers(0, 9)); sh = kw.get('sh', 19)
    while x < s.w:
        w = int(r.integers(int(kw.get('wmin', 42)), int(kw.get('wmax', 62))))
        st = 2 if r.random() < .45 else 3; mat = MATS[i % len(MATS)]; kind = KINDS[(i*3+1) % len(KINDS)]
        sd = int(i*7919+seed); side = 8 if i % 4 == 2 else 0
        o = house(w, st, mat, kind, sd, side=side, plastered=mat.startswith('plast'), doorm=['dgreen','dred','navy'][i % 3], **{k: v for k, v in kw.items() if k not in ('wmin','wmax')})
        s.paste(o, x, base-o.h+1)
        if sc is not None: sc.prop('house '+kind, o)
        x += w+side; i += 1

def quay_wall(s, y, h=6):
    a, b, c, d = R['stone']
    s.use(1, 1.)
    s.rect(c, 0, y, s.w, h); s.hl(a, 0, y, s.w); s.hl(b, 0, y+1, s.w); s.hl(d, 0, y+h-1, s.w); s.hl(K if False else d, 0, y+h-2, s.w)
    for x in range(0, s.w, 11): s.vl(d, x, y+1, h-2)

def tree_at(sc, trunk_layer, speed, cx, base, height, cw, seed, tw, name, mat='leaf', frames=4):
    trunk(trunk_layer, cx, base, int(height*.68), tw=tw, seed=seed)
    ch = int(height*.8)
    fr = [crown(cw, ch, seed, frame=f, n_frames=frames, mat=mat) for f in range(frames)]
    x, y = cx-cw//2-2, base-height-2
    sc.frames(name, speed, fr, x, y, fps=3)
    sc.prop('crown', fr[0])
    return fr[0], x, y

def floor_bands(sc, seed, walk='cobble', near='lane', far='pave'):
    F = S(lw(S_BACK), VH); M = S(lw(S_WALK), VH); N = S(lw(S_NEAR), VH)
    if far == 'pave': pavers(F, B0, B1-4, seed)
    if far != 'none': kerb(F, B1-4, 4, seed)
    if walk == 'cobble': cobbles(M, B1, B2, seed)
    elif walk == 'slab': pavers(M, B1, B2, seed, a=5, b=7, wfac=2.4, bond=.33)
    elif walk == 'gravel': gravel(M, B1, B2, seed)
    if near == 'water': return F, M, N
    kerb(N, B2, 5, seed+1)
    if near == 'lane':
        lane(N, B2+5, VH-7, seed+2); pavers(N, VH-7, VH, seed+3, a=5, b=7)
    else:
        pavers(N, B2+5, VH, seed+3, a=6, b=8, wfac=2.4, bond=.33)
    return F, M, N

FAR_FOOT, NEAR_FOOT = B1-3, B2+1

def real_frames(name, strip, step=1):
    """The game's own ambient sprites, frames padded to one box. Returns (list of RGBA, ox, oy)."""
    d = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'sprites', name+'.b.json')))
    pal = [hexrgb(c) for c in d['pal']]
    fs = d['strips'][strip]['frames'][::step]
    L_ = max(f['ox'] for f in fs); T = max(f['oy'] for f in fs)
    Rr = max(f['w']-f['ox'] for f in fs); B = max(f['h']-f['oy'] for f in fs)
    out = []
    for f in fs:
        a = np.zeros((T+B, L_+Rr, 4), np.uint8)
        idx = np.array(f['idx']).reshape(f['h'], f['w'])
        for j in np.unique(idx):
            if j:
                k = idx == j; yy, xx = np.nonzero(k)
                a[yy+T-f['oy'], xx+L_-f['ox'], :3] = pal[j]; a[yy+T-f['oy'], xx+L_-f['ox'], 3] = 255
        out.append(a)
    return out, L_, T

def part_a():
    """Canal quay, morning."""
    sc = Scene('a', 'morning'); r = rngf(11)
    sc.add('sky', S_SKY, sky_clouds(sc, 21)); add_clouds(sc, 21)
    sc.mover('birds', .1, bird_frames(), 0, 30, -.12, 700, fps=6)
    fa = S(lw(S_FAR), VH); skyline(fa, 106, 31); far_tower(fa, 92, 106, 70); far_tower(fa, 372, 106, 52); sc.add('far', S_FAR, fa)
    W = lw(S_MID); md = S(W, VH)
    house_row(md, 113, 41, sc, sh=18, gr=22, gh=22)
    quay_wall(md, 113)
    crowns = []
    tmp = Scene('a', 'morning')
    # the hump bridge
    bx = 180
    br = S(120, 40); br.use(1, 1.); hi, ba, sd, dk = R['brickr']
    br.rect(ba, 3, 10, 112, 30)
    km = np.zeros((40, 120), bool); km[10:40, 3:115] = True
    brick_hints(br, km, 'brickr', 77)
    br.use(2, 2.)
    s0, s1, s2, s3 = R['stone']
    Y, X = np.ogrid[:40, :120]
    ring = ((X-59)/38.)**2+((Y-40)/25.)**2 < 1
    br.c[ring] = s1; br.z[ring] = 2; br.p[ring] = 2
    an = np.arctan2(Y-40, X-59+.001)
    br.c[ring & (((an*14).astype(int) % 2) == 0)] = s2
    br.c[ring & (X > 59) & (((an*14).astype(int) % 2) == 1)] = s0
    hole = ((X-59)/34.)**2+((Y-40)/22.)**2 < 1
    br.c[hole] = R['hull'][3]; br.p[hole] = 3; br.z[hole] = 0.5
    br.use(4, 3.)
    br.rect(s1, 0, 7, 118, 3); br.hl(s0, 0, 7, 118); br.hl(s3, 0, 10, 118)
    for q in range(4, 116, 11): br.vl(s3, q, 7, 3)
    br.use(5, 2.5); br.rect(s1, 55, 12, 9, 5); br.hl(s0, 55, 12, 9); br.hl(s3, 55, 16, 9); br.vl(s0, 63, 12, 5)
    for q in (10, 104): br.use(6, 2.5); br.rect(R['iron'][1], q, 20, 4, 3); br.hl(R['iron'][0], q, 20, 4)
    br.use(7, 3.)
    for q in range(4, 116, 6): br.rect(R['iron'][1], q, 0, 2, 7); br.vl(R['iron'][0], q+1, 0, 7)
    br.rect(R['iron'][1], 0, 0, 118, 2); br.hl(R['iron'][0], 0, 0, 118)
    br = add_margin(br); br.finish(outline=KM)
    md.paste(br, bx, 87); sc.prop('bridge', br)
    lp = lamp(38); md.paste(lp, bx+6, 95-lp.h+1); md.paste(lp, bx+94, 95-lp.h+1)
    # far trees
    for i, tx in enumerate((70, 300, 510)):
        ax = tx+int(r.integers(-16, 17))
        trunk(md, ax, 113, 50, tw=4, seed=500+tx)
    bank_rgba = sc.rgba(md).copy()
    far_fr = []
    for i, tx in enumerate((70, 300, 510)):
        far_fr.append((crown(66, 58, 500+tx, frame=0), tx))
    for o, tx in far_fr:
        over(bank_rgba, sc.rgba(o), tx-33, 113-74)
    sc.add('bank', S_MID, md)
    wf = [water_band(W, 119, B0+6, bank_rgba, 51, frame=f) for f in range(3)]
    sc.frames('water', S_MID, wf, 0, 0, fps=3)
    # moored boats
    bt = S(62, 20); bt.use(1, 1.); bl = R['blue']
    bt.poly(bl[1], [(0,8),(59,8),(53,18),(6,18)]); bt.hl(bl[0], 0, 8, 60); bt.hl(R['white'][0], 2, 10, 56); bt.hl(bl[3], 6, 18, 48); bt.hl(bl[2], 5, 16, 50)
    bt.use(2, 2.); W_ = R['wood']; bt.rect(W_[1], 12, 1, 32, 7); bt.hl(W_[0], 12, 1, 32); bt.vl(W_[0], 43, 1, 7); bt.vl(W_[2], 12, 1, 7); bt.hl(W_[3], 12, 7, 32)
    for q in range(16, 42, 7): bt.rect(R['glass'][2], q, 3, 4, 3); bt.px(R['glass'][0], q+3, 3)
    bt = add_margin(bt); bt.finish(outline=KM)
    for i, b_ in enumerate((60, 430)):
        sc.bob(f'boat {i}', S_MID, bt, b_, 124, amp=1, ph=i*1.7)
    sc.prop('boat', bt)
    sc.mover('tour boat', S_MID, [tourboat()], 0, 124, .1, W+90, fps=1)
    sc.mover('far cyclist', S_MID, far_cyclist('dred'), 40, 99, .34, W+30, fps=8)
    sc.mover('far cyclist 2', S_MID, far_cyclist('navy'), 320, 99, .27, W+30, fps=8)
    for i, tx in enumerate((70, 300, 510)):
        fr = [crown(66, 58, 500+tx, frame=f) for f in range(4)]
        sc.frames(f'far crown {i}', S_MID, fr, tx-33, 113-74, fps=3)
    F, M, N = floor_bands(sc, 61)
    s0, s1, s2, s3 = R['stone']
    F.use(1, 0.); F.rect(s1, 0, B0-3, F.w, 4); F.hl(s0, 0, B0-3, F.w); F.hl(s3, 0, B0, F.w)
    for q in range(0, F.w, 19): F.vl(s3, q, B0-3, 3)
    Bk = S(F.w, VH)
    kerb_posts(sc, Bk, F, range(10, F.w-8, 44), FAR_FOOT, True, 'far row')
    trunks = []
    lp = lamp(72); sc.prop('lamp', lp)
    for x in (190, 590): Bk.paste(lp, x-8, 160-lp.h+1)
    bc = bench(); sc.prop('bench', bc)
    for x in (214, 610): Bk.paste(bc, x, 160-bc.h+1)
    bk1, bk2 = bike('navy'), bike('dred'); sc.prop('bike', bk1)
    Bk.paste(bk1, 252, 160-bk1.h+1); Bk.paste(bk2, 290, 160-bk2.h+1); Bk.paste(bk1, 546, 160-bk1.h+1)
    pl, tu = planter(); sc.prop('planter', pl)
    for x in (334, 664): Bk.paste(pl, x, 160-pl.h+1)
    fp = flag_pole(76); Bk.paste(fp, 380, 160-fp.h+1)
    st = stand('HARING', 'navy'); Bk.paste(st, 450, 162-st.h+1); sc.prop('stand', st)
    tb = []
    for tx in (70, 430, 730): trunk(Bk, tx, 158, 96, tw=8, seed=600+tx)
    sc.add('floor-far', S_BACK, F); sc.add('back', S_BACK, Bk)
    for i, x in enumerate((334, 664)):
        sc.frames(f'tulips {i}', S_BACK, tu, x-0, 160-pl.h-tu[0].h+4, fps=2)
    sc.frames('flag', S_BACK, flag_frames('nl'), 383, 160-76, fps=8)
    for i, tx in enumerate((70, 430, 730)):
        fr = [crown(118, 118, 600+tx, frame=f) for f in range(4)]
        sc.frames(f'crown {i}', S_BACK, fr, tx-60, 158-150, fps=3); sc.prop('crown', fr[0])
    sc.add('floor-walk', S_WALK, M)
    Fr = S(N.w, VH)
    kerb_posts(sc, Fr, N, range(60, N.w-8, 92), NEAR_FOOT, False, 'near row')
    sc.add('floor-near', S_NEAR, N); sc.actors(); sc.add('front', S_NEAR, Fr)
    sc.floor = (F, M, N)
    return sc

# ---------------------------------------------------------------- b: the museum and the square
def wall_block(s, x, y, w, h, mat, part, z, seed):
    hi, ba, sd, dk = R[mat]
    s.use(part, z); s.rect(ba, x, y, w, h)
    k = np.zeros((s.h, s.w), bool); k[max(y,0):y+h, max(x,0):x+w] = True
    k &= s.p == part
    brick_hints(s, k, mat, seed)
    s.retone(k & (np.arange(s.w)[None,:] < x+2), {ba: sd, hi: ba})
    s.retone(k & (np.arange(s.w)[None,:] >= x+w-1), {ba: hi, sd: ba})
    return k

def slate_roof(s, pts, seed, part, z, ridge=True):
    a, b, c, d = R['roof']; r = rngf(seed)
    s.use(part, z)
    k = s.poly(b, pts)
    ys, xs = np.nonzero(k & (s.p == part))
    if len(ys) == 0: return
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    for y in range(y0+2, y1, 3):
        x = x0+(y % 2)*3
        while x < x1:
            L = int(r.integers(3, 7))
            for i in range(L):
                if x+i < s.w and k[y, x+i]: s.c[y, x+i] = d
            if x > (x0+x1)/2 and y-1 >= 0:
                for i in range(2):
                    if x+L+i+1 < s.w and k[y-1, x+L+i+1]: s.c[y-1, x+L+i+1] = a
            x += L+int(r.integers(2, 5))
    if ridge:
        for x in range(x0, x1+1):
            col = np.nonzero(k[:, x])[0]
            if len(col): s.c[col[0], x] = a if x > (x0+x1)/2 else c
    # the lit side of the roof is to the right, the left end falls in shade
    s.retone(k & (np.arange(s.w)[None,:] < x0+(x1-x0)//5), {b: c, a: b})

def cornice(s, x, y, w, part, z):
    t0, t1, t2, t3 = R['white']
    s.use(part, z); s.hl(t0, x, y, w); s.hl(t1, x, y+1, w); s.hl(t3, x, y+2, w)
    for i in range(x+2, x+w-1, 5): s.px(t2, i, y+2)

def quoins(s, x, y, h, w, part, z, right=False):
    t0, t1, t2, t3 = R['stone']
    s.use(part, z)
    for j, q in enumerate(range(y, y+h, 4)):
        L = w if j % 2 else w-2
        xx = x+w-L if right else x
        s.rect(t1, xx, q, L, 3); s.hl(t0, xx, q, L); s.hl(t3, xx, q+3, L)
        if right: s.vl(t0, xx+L-1, q, 3)

def museum(W, seed):
    """A long red-brick museum: wings, a central block with a four-arch passage, two towers with dark spires."""
    H = 150; s = S(W, H); r = rngf(seed); bot = H; cx = W//2; pid = [100]
    def nid():
        pid[0] += 3; return pid[0]
    def wing(x, w, top):
        wall_block(s, x, top, w, bot-top, 'brickr', nid(), 1., seed+x)
        slate_roof(s, [(x-2,top),(x+6,top-18),(x+w-6,top-18),(x+w+2,top)], seed+x+1, nid(), .5)
        for rx in range(x+10, x+w-10, 24):
            pp = nid(); s.use(pp, 1.)
            s.poly(R['roof'][2], [(rx-2,top-13),(rx+4,top-19),(rx+10,top-13)])
            window(s, rx, top-13, 9, 11, r, nid(), z=1.5, kind=int(r.integers(0, 3)))
        cornice(s, x, top, w, nid(), 2.)
        for wx in range(x+6, x+w-10, 18):
            window(s, wx, top+13, 10, 22, r, nid(), z=3., arch=True)
            window(s, wx+1, bot-31, 8, 14, r, nid(), z=3.)
        s.use(nid(), 2.); s.hl(R['white'][0], x, bot-41, w); s.hl(R['white'][2], x, bot-40, w)
        # a tile frieze
        for q in range(x+3, x+w-6, 9):
            s.use(nid(), 2.5); s.rect(R['white'][0], q, top+5, 7, 5); s.rect(R['blue'][2], q+1, top+6, 5, 3); s.px(R['yellow'][1], q+2, top+7); s.px(R['white'][0], q+4, top+7)
        s.use(nid(), 2.); s.rect(R['stone'][1], x, bot-7, w, 7); s.hl(R['stone'][0], x, bot-7, w); s.hl(R['stone'][3], x, bot-1, w)
        for q in range(x+4, x+w, 11): s.vl(R['stone'][3], q, bot-6, 5)
    wing(0, cx-82, 72); wing(cx+82, W-cx-82, 72)
    for px_ in (100, W-160):
        wall_block(s, px_, 56, 60, bot-56, 'brickr', nid(), 3.2, seed+px_)
        slate_roof(s, [(px_-2,56),(px_+10,28),(px_+50,28),(px_+62,56)], seed+px_+1, nid(), 3.1)
        cornice(s, px_, 56, 60, nid(), 3.4)
        quoins(s, px_, 60, bot-68, 5, nid(), 3.4); quoins(s, px_+55, 60, bot-68, 5, nid(), 3.4, right=True)
        window(s, px_+16, 68, 28, 22, r, nid(), z=3.6, arch=True, kind=2)
        for wx in (px_+9, px_+24, px_+39): window(s, wx, bot-33, 12, 18, r, nid(), z=3.6)
    bw = 164; bx = cx-bw//2
    wall_block(s, bx, 50, bw, bot-50, 'brickr', nid(), 4.0, seed+3)
    slate_roof(s, [(bx,50),(bx+14,28),(bx+bw-14,28),(bx+bw,50)], seed+9, nid(), 3.9)
    cornice(s, bx, 50, bw, nid(), 4.2); cornice(s, bx, 80, bw, nid(), 4.2)
    for wx in range(bx+8, bx+bw-10, 16): window(s, wx, 58, 10, 17, r, nid(), z=4.4, arch=True)
    aw, ag, n = 30, 6, 4; ax0 = cx-(n*aw+(n-1)*ag)//2
    Y, X = np.mgrid[0:H, 0:W]
    h3, h2 = R['hull'][3], R['hull'][2]; t0, t1, t2, t3 = R['stone']
    for i in range(n):
        ax = ax0+i*(aw+ag); pa = nid()
        ring = ((X-(ax+aw/2))/(aw/2+3))**2+((Y-96)/(aw/2+3))**2 < 1
        ring &= Y < 97
        s.use(pa, 4.4); s._mask((slice(0,H),slice(0,W)), t1, ring)
        an = np.arctan2(Y-96, X-(ax+aw/2)+.01)
        q = ring & (((an*7).astype(int) % 2) == 0); s.c[q] = t2
        q = ring & (((an*7).astype(int) % 2) == 1) & (X > ax+aw/2); s.c[q] = t0
        hole = ((X >= ax) & (X < ax+aw) & (Y >= 96) & (Y < bot)) | (((X-(ax+aw/2))/(aw/2))**2+((Y-96)/(aw/2))**2 < 1)
        pb = nid(); s.use(pb, 4.6); s._mask((slice(0,H),slice(0,W)), h3, hole)
        s.use(nid(), 4.7)
        s.rect(h2, ax+6, 104, aw-12, bot-104)
        s.use(nid(), 4.8)
        sk = R['sky_n']
        s.rect(sk[4], ax+9, 112, aw-18, bot-124); s.rect(R['far'][1], ax+9, 118, aw-18, 6); s.rect(R['grass'][1], ax+9, bot-12, aw-18, 7); s.hl(R['grass'][0], ax+9, bot-12, aw-18)
        s.use(nid(), 4.9); s.vl(h3, ax+6, 104, bot-104); s.hl(h3, ax+6, 104, aw-12)
        s.use(nid(), 4.9); lx = ax+aw//2-1
        s.vl(R['hull'][3], lx+1, 80, 8); s.rect(R['glow'][1], lx, 88, 3, 4); s.vl(R['glow'][0], lx+2, 88, 3); s.hl(R['hull'][3], lx-1, 92, 5); s.hl(R['hull'][3], lx-1, 87, 5)
        if i < n:
            s.use(nid(), 5.)
            pl = ax+aw
            if i < n-1:
                s.rect(t1, pl, 97, ag, bot-97); s.vl(t0, pl+ag-1, 97, bot-97); s.vl(t2, pl, 97, bot-97); s.hl(t0, pl, 97, ag); s.hl(t3, pl, 99, ag)
    for tx in (cx-74, cx+46):
        tw = 28
        wall_block(s, tx, 42, tw, bot-42, 'brickr', nid(), 5.4, seed+tx)
        quoins(s, tx, 46, bot-52, 4, nid(), 5.6); quoins(s, tx+tw-4, 46, bot-52, 4, nid(), 5.6, right=True)
        cornice(s, tx, 42, tw, nid(), 5.7); cornice(s, tx, 60, tw, nid(), 5.7)
        window(s, tx+9, 66, 10, 15, r, nid(), z=5.8, arch=True)
        # a steep spire, lit on the right
        p1 = nid(); s.use(p1, 5.1); s.poly(R['roof'][2], [(tx-1,42),(tx+tw/2,12),(tx+tw/2,42)])
        p2 = nid(); s.use(p2, 5.15); s.poly(R['roof'][1], [(tx+tw/2,42),(tx+tw/2,12),(tx+tw+1,42)])
        for yy in range(16, 42, 4):
            hw = (yy-12)*(tw/2+1)/30
            s.use(nid(), 5.16)
            s.hl(R['roof'][3], tx+tw/2-hw*.8, yy, max(1, int(hw*.7))); s.hl(R['roof'][0], tx+tw/2+hw*.15, yy, max(1, int(hw*.55)))
        s.use(nid(), 5.2); s.vl(R['brass'][1], tx+tw//2, 7, 6); s.px(R['brass'][0], tx+tw//2, 6)
        s.use(nid(), 5.3); s.rect(R['glow'][1], tx+tw//2-2, 34, 5, 6); s.vl(R['glow'][0], tx+tw//2+2, 34, 6); s.hl(R['hull'][3], tx+tw//2-3, 33, 7); s.vl(R['hull'][3], tx+tw//2, 34, 6)
        # a clock
        s.use(nid(), 5.9); s.ell(R['hull'][3], tx+14, 52, 5, 5); s.ell(R['white'][0], tx+14, 52, 4, 4); s.ell(R['white'][1], tx+13, 53, 2, 2) if False else None; s.vl(K, tx+14, 49, 3); s.hl(K, tx+14, 52, 3); s.px(R['white'][2], tx+11, 54); s.px(R['white'][2], tx+12, 55)
    # banners on the wings
    for bxx, col in ((cx-96, 'dred'), (cx+88, 'navy')):
        s.use(nid(), 6.)
        c = R[col]
        s.rect(c[1], bxx, 86, 9, 32); s.vl(c[0], bxx+8, 86, 32); s.vl(c[2], bxx, 86, 32); s.hl(R['pole'][1], bxx-1, 85, 11); s.hl(c[3], bxx, 117, 9)
        for j in range(3):
            for q, w_ in ((0,'w.w'),(1,'.w.'),(2,'w.w')):
                for ii, ch in enumerate(w_):
                    if ch == 'w': s.px(R['xw'][0], bxx+3+ii, 90+j*9+q)
    s = add_margin(s); s.finish(outline=KM)
    return s

def part_b():
    """Rijksmuseum and the square, noon."""
    sc = Scene('b', 'noon')
    sc.add('sky', S_SKY, sky_clouds(sc, 121)); add_clouds(sc, 121)
    sc.mover('birds', .1, bird_frames(), 200, 22, .1, 700, fps=6)
    fa = S(lw(S_FAR), VH); skyline(fa, 100, 131); far_tower(fa, 60, 100, 56); far_tower(fa, 430, 100, 46); sc.add('far', S_FAR, fa)
    W = lw(S_MID); md = S(W, VH)
    mu = museum(W, 141); md.paste(mu, -1, 126-mu.h+1); sc.prop('museum', mu)
    he = hedge(70, 8, 3)
    for x in (10, 120, 330, 450): md.paste(he, x, 118)
    sc.add('museum', S_MID, md)
    museum_rgba = sc.rgba(md)
    S_LAWN = .66; la = S(lw(S_LAWN), VH)
    grass(la, 124, B0+6, 151)
    pools = ((90,250),(430,260))
    rm = R['stone']
    for px_, pw in pools:
        la.use(2, 1.); la.rect(rm[1], px_-3, 127, pw+6, 18); la.hl(rm[0], px_-3, 127, pw+6); la.hl(rm[3], px_-3, 144, pw+6); la.hl(rm[2], px_-3, 143, pw+6)
    src = museum_rgba
    if la.w > src.shape[1]: src = np.concatenate([src, src[:, :la.w-src.shape[1]]], axis=1)
    src = src[:, :la.w]
    for i, x in enumerate((30, 370, 712)): trunk(la, x, 138, 28, tw=4, seed=700+i)
    sc.add('lawn', S_LAWN, la)
    fr = []
    for f in range(3):
        wb = water_band(la.w, 129, 143, src, 153, frame=f)
        k = np.ones((wb.h, wb.w), bool)
        for px_, pw in pools: k[129:143, px_:px_+pw] = False
        wb.c[k] = 0
        fr.append(wb)
    sc.frames('pool', S_LAWN, fr, 0, 0, fps=3)
    for i, x in enumerate((30, 370, 712)):
        sc.frames(f'lawn crown {i}', S_LAWN, [crown(44, 36, 700+i, frame=f) for f in range(4)], x-22, 138-46, fps=3)
    F, M, N = floor_bands(sc, 161, walk='gravel', near='pave')
    Bk = S(F.w, VH)
    kerb_posts(sc, Bk, F, range(60, F.w-8, 66), FAR_FOOT, True, 'far row')
    for x in (24, 620): trunk(Bk, x, 158, 96, tw=8, seed=800+x)
    lp = lamp(72)
    for x in (160, 520): Bk.paste(lp, x-8, 160-lp.h+1)
    st = stand('HOTDOGS', 'dred'); Bk.paste(st, 226, 162-st.h+1); sc.prop('stand', st)
    pl, tu = planter()
    for x in (346, 476): Bk.paste(pl, x, 160-pl.h+1)
    bc = bench(); Bk.paste(bc, 382, 160-bc.h+1)
    bk = bike('dred'); Bk.paste(bk, 420, 160-bk.h+1)
    fp = flag_pole(76); Bk.paste(fp, 180, 160-fp.h+1)
    sc.add('floor-far', S_BACK, F); sc.add('back', S_BACK, Bk)
    for i, x in enumerate((346, 476)): sc.frames(f'tulips {i}', S_BACK, tu, x, 160-pl.h-tu[0].h+4, fps=2)
    sc.frames('flag', S_BACK, flag_frames('city'), 183, 160-76, fps=8)
    for i, x in enumerate((24, 620)):
        sc.frames(f'crown {i}', S_BACK, [crown(120, 118, 800+x, frame=f) for f in range(4)], x-60, 158-150, fps=3)
    sc.add('floor-walk', S_WALK, M)
    pg, ox, oy = real_frames('ams-pigeons', 'peck')
    sc.frames_raw('pigeons', S_WALK, pg, 300-ox, 184-oy, fps=6)
    sc.frames_raw('pigeons 2', S_WALK, pg, 640-ox, 182-oy, fps=5)
    Fr = S(N.w, VH)
    kerb_posts(sc, Fr, N, range(120, N.w-8, 170), NEAR_FOOT, False, 'near row')
    sc.add('floor-near', S_NEAR, N); sc.actors(); sc.add('front', S_NEAR, Fr)
    sc.floor = (F, M, N)
    return sc

# ---------------------------------------------------------------- c: houseboats on the Amstel
def part_c():
    """Amstel houseboats, golden light."""
    sc = Scene('c', 'golden')
    sc.add('sky', S_SKY, sky_clouds(sc, 221)); add_clouds(sc, 221)
    sc.mover('birds', .1, bird_frames(), 100, 26, .14, 700, fps=6)
    fa = S(lw(S_FAR), VH); skyline(fa, 96, 231); far_tower(fa, 60, 96, 76); far_tower(fa, 300, 96, 50); sc.add('far', S_FAR, fa)
    W = lw(S_MID); md = S(W, VH)
    house_row(md, 104, 241, sc, sh=16, ww=8, wh=10, gr=18, gh=18, wmin=34, wmax=50)
    quay_wall(md, 104)
    for x in (40, 220, 430): trunk(md, x, 104, 42, tw=4, seed=900+x)
    bank_rgba = sc.rgba(md).copy()
    for x in (40, 220, 430): over(bank_rgba, sc.rgba(crown(56, 50, 900+x)), x-28, 104-66)
    sc.add('bank', S_MID, md)
    sc.frames('water', S_MID, [water_band(W, 110, B0+8, bank_rgba, 251, frame=f) for f in range(3)], 0, 0, fps=3)
    sc.mover('tour boat', S_MID, [tourboat()], 120, 116, -.13, W+90, fps=1)
    sc.mover('far cyclist', S_MID, far_cyclist('dgreen'), 60, 88, .3, W+30, fps=8)
    for i, x in enumerate((40, 220, 430)):
        sc.frames(f'far crown {i}', S_MID, [crown(56, 50, 900+x, frame=f) for f in range(4)], x-28, 104-66, fps=3)
    Fw_w = lw(S_BACK)
    sc.frames('river far', S_BACK, [water_band(Fw_w, B0-2, B1+6, None, 261, frame=f) for f in range(3)], 0, 0, fps=3)
    sm = smoke_frames()
    for i, (x, w) in enumerate([(24,150),(240,180),(480,150),(680,170)]):
        o, ch = houseboat(w, 300+i, wall=['plastg','plastc','navy','dred'][i % 4])
        by = 162-o.h+15+1
        sc.bob(f'houseboat {i}', S_BACK, o, x, by, amp=1, ph=i*1.6)
        sc.frames(f'smoke {i}', S_BACK, sm, x+ch[0]-5, by+ch[1]-24, fps=7)
        sc.prop('houseboat', o)
    M = S(lw(S_WALK), VH); r = rngf(271); a, b, c, d = R['wood']
    M.use(1, 0.)
    for y, h in ((B1,5),(B1+5,5),(B1+10,6),(B1+16,6)):
        M.rect(b, 0, y, M.w, h); M.hl(a, 0, y, M.w); M.hl(c, 0, y+h-2, M.w); M.hl(K, 0, y+h-1, M.w)
        x = int(r.integers(10, 90))
        while x < M.w:
            M.vl(K, x, y, h); M.px(R['pole'][0], x+2, y+1); M.px(R['pole'][0], x+2, y+h-3); M.px(R['pole'][0], x-2, y+1); M.px(R['pole'][0], x-2, y+h-3)
            x += int(r.integers(70, 150))
        for _ in range(int(M.w/16)):
            x = int(r.integers(0, M.w)); L = int(r.integers(4, 14)); yy = y+int(r.integers(1, max(2, h-2)))
            M.hl(a if r.random() < .3 else c, x, yy, L)
    M.rect(d, 0, B2-2+1, M.w, 2)
    M.rect(K, 0, B2+1, M.w, 1)
    pile = S(10, 60); pile.use(1, 1.); tube(pile, 'bark', 1, 2, 7, 58); pile.rect(R['bark'][0], 1, 0, 7, 2); pile.hl(R['bark'][2], 2, 0, 5)
    pile.use(2, 2.); pile.rect(R['iron'][1], 0, 20, 9, 2); pile.hl(R['iron'][0], 0, 20, 9); pile.hl(R['iron'][3], 0, 22, 9)
    pile = add_margin(pile); pile.finish()
    for x in range(30, M.w, 110): M.paste(pile, x, B1-22)
    sc.prop('pile', pile)
    sc.add('jetty', S_WALK, M)
    Nw_w = lw(S_NEAR)
    sc.frames('river near', S_NEAR, [water_band(Nw_w, B2+2, VH, None, 281, frame=f) for f in range(3)], 0, 0, fps=3)
    dk, ox, oy = real_frames('ams-ducks', 'paddle', step=2)
    for x, y in ((170,206),(600,205)):
        sc.frames_raw('ducks', S_NEAR, dk, x-ox, y-oy, fps=6)
    sc.actors()
    sc.floor = (M,)
    return sc

# ---------------------------------------------------------------- d: the Stopera at sunset
def theatre(W, H, seed):
    """The curved white theatre: three rings of marble and glass round a drum, lit from the right, every band a hard tone."""
    s = S(W, H); r = rngf(seed); cx = W*.5; Rd = W*.44; st_ = 3; sh = 29; mb = 8; h0 = H-14
    m0, m1, m2, m3 = R['marble']; g0, g1, g2, g3 = R['glass']
    ring = lambda n, u: h0-n*sh+u*u*(n*9.5+3)+(1-math.sqrt(max(1-u*u,0)))*(n*5)
    # the fly tower behind
    tx0, tx1 = int(W*.3), int(W*.7); top = h0-st_*sh-22; ft = max(top-14, 0)
    ra, rb, rc, rd = R['roof']
    s.use(5, .5); s.rect(rb, tx0, ft, tx1-tx0, 46)
    for x in range(tx0, tx1, 9):
        s.vl(rd, x, ft+2, 44); s.vl(ra if x > (tx0+tx1)/2 else rc, x+1, ft+2, 44)
    s.rect(rc, tx0, ft+2, 8, 44)
    s.use(6, .6); s.hl(m0, tx0-1, ft, tx1-tx0+2); s.hl(m2, tx0-1, ft+1, tx1-tx0+2); s.hl(m3, tx0-1, ft+2, tx1-tx0+2)
    pid = 10
    for x in range(W):
        u = (x-cx)/Rd
        if abs(u) >= 1: continue
        a = math.asin(u)
        lit = 0 if u > .32 else 1 if u > -.38 else 2
        for n in range(st_, 0, -1):
            y0 = int(round(ring(n, u))); y1 = int(round(ring(n-1, u)))
            for y in range(y0, min(y1, H)):
                if y < 0: continue
                j = y-y0
                if j < mb:
                    tone = (m0 if lit == 0 else m1) if j == 0 else (m1 if lit == 0 else m2 if lit == 1 else m2) if j < mb-3 else (m2 if lit < 2 else m3) if j < mb-1 else m3
                    if ((a*30) % 1) < .06 and 0 < j < mb-1: tone = m3 if lit == 2 else m2
                    s.c[y,x] = tone; s.p[y,x] = 20+n; s.z[y,x] = 2.
                else:
                    gy = j-mb
                    tone = g3 if gy < 2 else g2
                    if ((x*.6+y*1.2+n*23) % 47) < 6: tone = g1
                    if ((x*.6+y*1.2+n*23) % 47) < 2: tone = g0
                    if gy == 5 and .3 < ((a*18) % 1) < .75: tone = R['glow'][1]
                    if ((a*18) % 1) < max(.1, .1/max(math.cos(a),.3)): tone = m1 if lit == 0 else m2 if lit == 1 else m3
                    s.c[y,x] = tone; s.p[y,x] = 30+n; s.z[y,x] = 1.
        # the top cornice
        yt = int(round(ring(st_, u)))
        for y in range(yt-2, yt):
            if y >= 0: s.c[y,x] = m0 if lit < 2 else m1; s.p[y,x] = 25; s.z[y,x] = 2.5
        for y in range(h0, H):
            s.c[y,x] = R['hull'][3]; s.p[y,x] = 40; s.z[y,x] = .8
    # people behind the glass
    for n in range(1, st_+1):
        for _ in range(9):
            a = float(r.uniform(-1.1, 1.1)); x = int(cx+math.sin(a)*Rd); u = (x-cx)/Rd
            yb = int(round(ring(n-1, u)))
            for q in range(x, x+2):
                for y in range(yb-6, yb):
                    if 0 <= q < W and s.p[y, q] == 30+n: s.c[y,q] = R['hull'][3]
            if s.p[yb-7, x] == 30+n: s.c[yb-7,x] = R['hull'][3]; s.c[yb-7,x+1] = R['hull'][3]
    for a in np.linspace(-1.2, 1.2, 13):
        x = int(cx+math.sin(a)*Rd); w = max(3, int(7*math.cos(a)))
        s.use(50+int(a*10), 3.); tube(s, 'marble', x, h0, w, H-h0)
    s.use(70, 3.5)
    for x in range(W):
        u = (x-cx)/Rd
        if abs(u) < 1: s.px(R['stone'][1], x, H-2); s.px(R['stone'][3], x, H-1)
    s = add_margin(s); s.finish(outline=KM)
    return s

def cityhall(W, H, seed):
    """The red-brick city hall at the heroes' scale."""
    s = S(W, H); r = rngf(seed); top = H-126
    wall_block(s, 0, top, W, H-top, 'brickr', 1, 1., seed)
    cornice(s, 0, top, W, 2, 2.)
    lit = []; pid = 10
    for y in range(top+9, H-58, 28):
        for x in range(10, W-14, 28):
            s.retone(_mk(s, x-1, y+1, 17, 21), {R['brickr'][1]: R['brickr'][2], R['brickr'][0]: R['brickr'][1]})
            window(s, x, y, 16, 20, r, pid, z=3.); pid += 2
            s.use(pid, 2.5); s.hl(R['stone'][0], x-1, y-2, 18); s.hl(R['stone'][2], x-1, y-1, 18); pid += 1
            lit.append((x, y))
    msg = 'STADHUIS'
    s.use(5, 3.); s.rect(R['marble'][1], W//2-26, H-75, 52, 12); s.hl(R['marble'][0], W//2-26, H-75, 52); s.hl(R['marble'][3], W//2-26, H-64, 52); s.vl(R['marble'][0], W//2+25, H-75, 12)
    text(s, msg, W//2-text_w(msg)//2, H-72, K)
    dx, dw, dh = W//2-44, 88, 54
    s.use(6, 3.); g = R['glass']
    s.rect(g[3], dx, H-dh, dw, dh)
    for i in range(0, dw, 26):
        s.line(g[1], dx+i+18, H-dh+2, dx+i+2, H-8); s.line(g[0], dx+i+20, H-dh+2, dx+i+6, H-14)
    for x_ in range(dx+6, dx+dw-4, 11):        # people in the hall
        s.rect(R['hull'][2], x_, H-22, 3, 14); s.rect(R['hull'][2], x_, H-25, 2, 2)
    s.use(7, 3.5)
    for x_ in range(dx, dx+dw+1, 22): tube(s, 'pole', x_, H-dh, 3, dh)
    s.rect(R['pole'][1], dx, H-dh+16, dw, 2); s.hl(R['pole'][0], dx, H-dh+16, dw); s.hl(R['pole'][3], dx, H-dh+18, dw)
    s.use(8, 3.8); s.rect(R['marble'][1], dx-4, H-dh-4, dw+8, 4); s.hl(R['marble'][0], dx-4, H-dh-4, dw+8); s.hl(R['marble'][3], dx-4, H-dh-1, dw+8)
    for x_, col in ((dx-34, 'dred'), (dx-20, 'navy'), (dx+dw+8, 'yellow'), (dx+dw+22, 'dred')):
        s.use(9, 3.); s.rect(R['pole'][2], x_, H-36, 11, 17); s.rect(R['cloth'][0], x_+1, H-35, 9, 15); s.rect(R[col][1], x_+2, H-34, 7, 3)
        for j in range(3): s.hl(K, x_+2, H-29+j*3, 4+j)
    s.use(11, 3.); s.rect(R['stone'][1], 0, H-6, W, 6); s.hl(R['stone'][0], 0, H-6, W); s.hl(R['stone'][3], 0, H-1, W)
    for x_ in range(0, W, 11): s.vl(R['stone'][3], x_, H-5, 4)
    s = add_margin(s); s.finish(outline=KM)
    return s, lit

def _mk(s, x, y, w, h):
    k = np.zeros((s.h, s.w), bool); k[max(y,0):y+h, max(x,0):x+w] = True; return k

def lit_window():
    s = S(16, 20); s.use(1, 1.)
    window(s, 0, 0, 16, 20, rngf(3), 2, z=1., lit=True)
    return s

def part_d():
    """Stopera, sunset."""
    sc = Scene('d', 'sunset')
    sk = sky_clouds(sc, 321)
    a, b, c = R['sun']
    sk.use(5, 1.); sk.ell(c, 278, 40, 16, 16); sk.ell(b, 278, 40, 14, 14); sk.ell(a, 278, 40, 10, 10)
    sc.add('sky', S_SKY, sk); add_clouds(sc, 321)
    sc.mover('birds', .1, bird_frames(), 300, 28, -.13, 700, fps=6)
    fa = S(lw(S_FAR), VH); skyline(fa, 118, 331); far_tower(fa, 120, 118, 68); sc.add('far', S_FAR, fa)
    S_BLD = .62; W = lw(S_BLD); md = S(W, VH)
    th = theatre(400, 150, 341); md.paste(th, -40, 2); sc.prop('theatre', th)
    ch, lit = cityhall(300, 176, 342); md.paste(ch, 340, 150-176); sc.prop('city hall', ch)
    sc.add('stopera', S_BLD, md)
    r = rngf(9)
    for i, q in enumerate(r.choice(len(lit), 3, replace=False)):
        lx, ly = lit[int(q)]
        sc.blink(f'lit window {i}', S_BLD, lit_window(), 340+1+lx, 150-176+1+ly, i*2.3, 7+i*3)
    F, M, N = floor_bands(sc, 351, walk='slab', near='pave')
    Bk = S(F.w, VH)
    kerb_posts(sc, Bk, F, range(30, F.w-8, 88), FAR_FOOT, True, 'far row')
    goods = []
    for i, x in enumerate((6,76,150,410,480,620)):
        o, fr = stall(60, 400+i, (('dred','white'),('navy','white'),('yellow','dred'),('dgreen','white'))[i % 4])
        Bk.paste(o, x, 160-o.h+1); goods.append((fr, x+4, 160-o.h+1+13)); sc.prop('stall', o)
    lp = lamp(76)
    for x in (250, 560): Bk.paste(lp, x-8, 160-lp.h+1)
    cr = crate(20, 14); sc.prop('crate', cr)
    for x in (276, 344): Bk.paste(cr, x, 160-cr.h+1)
    pl, tu = planter(); Bk.paste(pl, 306, 160-pl.h+1)
    fp = flag_pole(78); Bk.paste(fp, 720, 160-fp.h+1)
    trunk(Bk, 750, 158, 96, tw=8, seed=950)
    sc.add('floor-far', S_BACK, F); sc.add('back', S_BACK, Bk)
    for i, (fr, x, y) in enumerate(goods): sc.frames(f'goods {i}', S_BACK, fr, x, y, fps=2)
    sc.frames('tulips', S_BACK, tu, 306, 160-pl.h-tu[0].h+4, fps=2)
    sc.frames('flag', S_BACK, flag_frames('city'), 723, 160-78, fps=8)
    sc.frames('crown', S_BACK, [crown(110, 118, 950, frame=f) for f in range(4)], 695, 158-150, fps=3)
    sc.add('floor-walk', S_WALK, M)
    pg, ox, oy = real_frames('ams-pigeons', 'peck')
    sc.frames_raw('pigeons', S_WALK, pg, 200-ox, 184-oy, fps=6)
    Fr = S(N.w, VH)
    kerb_posts(sc, Fr, N, range(70, N.w-8, 130), NEAR_FOOT, False, 'near row')
    sc.add('floor-near', S_NEAR, N); sc.actors(); sc.add('front', S_NEAR, Fr)
    sc.floor = (F, M, N)
    return sc
