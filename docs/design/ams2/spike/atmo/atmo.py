"""Atmospheric perspective for the ams2 scenes: a proposal pass on top of the approved hero-method spike.
Nothing here changes the spike: it builds a scene with scenes.part_x(), then
  1. paints a new sky (a long dithered ramp) and new clouds (big lit masses near, flat pale streaks at the horizon),
  2. adds far planes (two skylines with landmarks) and mist bands,
  3. grades every plane by its depth: darks lift toward the cool haze, lights lean to the warm haze, colour fades."""
import math, re
import numpy as np
from PIL import Image
from kit import *
import kit
import scenes as SC
from parts import gable_pts
U = kit.U
VW, VH = SC.VW, SC.VH

def rgbf(h): return np.array(hexrgb(h), float)/255
BAYER = np.array([[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]], float)/16+1/32
def bayer(h, w, cell=None):
    cell = cell or max(1, U//2)
    Y, X = np.mgrid[:h, :w]
    return BAYER[(Y//cell) % 4, (X//cell) % 4]
def vnoise(h, w, cx, cy, seed):
    """Smooth value noise in 0..1, cell size cx by cy pixels."""
    r = np.random.default_rng(seed)
    g = (r.random((max(2, int(h/cy)+2), max(2, int(w/cx)+2)))*255).astype(np.uint8)
    return np.asarray(Image.fromarray(g).resize((w, h), Image.BICUBIC), float)/255

# ------------------------------------------------------------------ the light of each stage
ATMO = dict(
  morning=dict(dark='#9cbcda', light='#fbf2dc',
    sky=[(0,'#2b63b8'),(34,'#3f80cc'),(66,'#6ea8de'),(92,'#a9cfe8'),(112,'#dde9e2'),(128,'#f6ecd2')],
    cloud=['#ffffff','#f1f5f6','#d3e0ec','#aec6e0','#8eaed6'], glow=None),
  noon=dict(dark='#a2c6ea', light='#f7f8ee',
    sky=[(0,'#1f58b6'),(36,'#3078cc'),(68,'#5ea2e0'),(94,'#9ccaec'),(112,'#cfe6f2'),(128,'#eaf2ea')],
    cloud=['#ffffff','#f0f6fa','#d0e0f0','#a8c4e6','#84a8da'], glow=None),
  golden=dict(dark='#b79a94', light='#ffe4a8',
    sky=[(0,'#3f6aa6'),(26,'#6486ae'),(50,'#94a2ae'),(72,'#c8b89c'),(92,'#eccd8e'),(110,'#fbe0a0'),(128,'#fff0c0')],
    cloud=['#fff8dc','#fde2a6','#ecb884','#c08e80','#94788c'], glow=(-40, 104, 300, 70, 2.6)),
  sunset=dict(dark='#6c3c80', light='#ffb070',
    sky=[(0,'#1a1448'),(24,'#34195e'),(46,'#5c2472'),(66,'#92307a'),(84,'#cc5070'),(100,'#ee7c5c'),(116,'#fbb060'),(130,'#ffd27c')],
    cloud=['#ffe6a6','#fbaa68','#de626c','#983a78','#58286a'], glow=(278, 92, 150, 70, 3.2)),
)

def grade(a, L, depth, ymap=None, mist=None, sat=.4):
    """Aerial perspective on an RGBA layer. depth 0..1. ymap: a function of the logical y that returns extra depth (a ground plane
    that runs away from the viewer). The amount is quantised and ordered-dithered, so the picture stays hard pixel clusters."""
    a = a.copy(); k = a[..., 3] > 0
    if not k.any(): return a
    h, w = a.shape[:2]
    m = np.full((h, w), float(depth))
    if ymap is not None:
        yy = (np.arange(h)/U)[:, None]
        m = m+ymap(yy)*np.ones((1, w))
    if (ymap is not None):
        q = 16.
        m = np.floor(m*q+bayer(h, w))/q
    m = np.clip(m, 0, 1)[..., None]
    rgb = a[..., :3].astype(float)/255
    lum = (rgb*[.3, .59, .11]).sum(-1, keepdims=True)
    tgt = rgbf(L['dark'])+(rgbf(L['light'])-rgbf(L['dark']))*lum**.8
    out = rgb+(tgt-rgb)*m
    l2 = (out*[.3, .59, .11]).sum(-1, keepdims=True)
    out = l2+(out-l2)*(1-sat*m)
    a[..., :3][k] = np.clip(out*255+.5, 0, 255).astype(np.uint8)[k]
    return a

def punch(a, g=1.14, s=1.08):
    """The nearest plane: deeper darks and a little more colour."""
    a = a.copy(); k = a[..., 3] > 0
    rgb = (a[..., :3].astype(float)/255)**g
    l = (rgb*[.3, .59, .11]).sum(-1, keepdims=True)
    rgb = l+(rgb-l)*s
    a[..., :3][k] = np.clip(rgb*255+.5, 0, 255).astype(np.uint8)[k]
    return a

def dusk(a):
    """The key light of the sunset on the near planes: the shade goes violet, the lights go amber."""
    a = a.copy(); k = a[..., 3] > 0
    rgb = a[..., :3].astype(float)/255
    l = (rgb*[.3, .59, .11]).sum(-1, keepdims=True)
    tint = np.array([.50, .30, .56])+(np.array([1.06, .90, .74])-np.array([.50, .30, .56]))*l
    out = rgb*(1-.34)+rgb*tint*.34*1.25
    a[..., :3][k] = np.clip(out*255+.5, 0, 255).astype(np.uint8)[k]
    return a

# ------------------------------------------------------------------ sky: one long ramp, banded, dithered at the band borders
def sky(W, L, seed=1, sun=None):
    H, Wp = VH*U, W*U
    ys = np.array([s[0] for s in L['sky']], float); cs = np.array([rgbf(s[1]) for s in L['sky']])
    N = 22; top, bot = 0., 132.
    Y, X = np.mgrid[:H, :Wp]; y = Y/U; x = X/U
    t = (y-top)/(bot-top)*N
    t = t+.5*(vnoise(H, Wp, 90*U, 400*U, seed)-.5)
    if L['glow']:
        gx, gy, rx, ry, amp = L['glow']
        t = t+amp*np.exp(-(((x-gx)/rx)**2+((y-gy)/ry)**2))
    fr = t-np.floor(t)
    idx = np.floor(t)+(np.clip((fr-.2)/.6, 0, 1) > bayer(H, Wp))
    idx = np.clip(idx, 0, N).astype(int)
    yc = top+(np.arange(N+1)+.5)/N*(bot-top)
    tone = np.stack([np.interp(yc, ys, cs[:, i]) for i in range(3)], 1)
    a = np.zeros((H, Wp, 4), np.uint8); a[..., 3] = 255
    a[..., :3] = np.clip(tone[idx]*255+.5, 0, 255).astype(np.uint8)
    if sun:
        sx, sy, r = sun
        d = np.hypot(x-sx, y-sy)
        for rr, col in ((r+7, None), (r+3, '#ffd884'), (r, '#fff0b0'), (r-4, '#fffbe6')):
            if col is None:
                k = (d < rr) & (bayer(H, Wp) < .5); a[..., :3][k] = hexrgb('#ffc874')
            else: a[..., :3][d < rr] = hexrgb(col)
    return a

# ------------------------------------------------------------------ clouds: a lit mass, 5 tones, a dissolving base
def cumulus(w, h, seed, tones, flat=1.):
    r = np.random.default_rng(seed)
    Wp, Hp = int(w*U), int(h*U)
    Y, X = np.mgrid[:Hp, :Wp]; x = X/U; y = Y/U
    base = h*.80
    F = np.zeros((Hp, Wp))
    n = int(w/7)+5
    peaks = [(r.uniform(.2, .8), r.uniform(.6, 1.)) for _ in range(1+int(w > 70)+int(w > 120))]
    for i in range(n):
        cx = r.uniform(.06, .94)
        env = max(max(0., ph*(1-abs(cx-pc)/.34)) for pc, ph in peaks)
        env = max(env, .16*(1-abs(cx*2-1)))
        rr = h*r.uniform(.13, .24)*(.55+.6*env)
        cy = base-rr*.5-r.uniform(.15, 1.)*env*(h*.62)*flat
        cy = max(cy, rr+1.5)
        d2 = ((x-cx*w)/(rr*1.25))**2+((y-cy)/rr)**2
        F += np.clip(1-d2, 0, 1)**1.5
    F += .22*(vnoise(Hp, Wp, 5*U, 4*U, seed+7)-.5)*(F > .05)
    F += .10*(vnoise(Hp, Wp, 2*U, 2*U, seed+8)-.5)*(F > .05)
    edge = base+1.5*(vnoise(Hp, Wp, 14*U, 99*U, seed+9)-.5)
    mask = (F > .22) & (y < edge)
    gy, gx = np.gradient(np.clip(F, 0, 1.6))
    gain = 2.4*U
    nx, ny = -gx*gain, -gy*gain
    nl = np.sqrt(nx*nx+ny*ny+1)
    Lt = (nx*.52+ny*-.72+.46)/nl                        # the light comes from the upper right
    top = np.where(mask.any(0), mask.argmax(0), Hp)/U
    rel = np.clip((y-top[None, :])/np.maximum(base-top[None, :], 1), 0, 1)
    v = .62*np.clip(.5+.75*Lt, 0, 1)+.38*(1-rel)**1.2
    v += .07*(vnoise(Hp, Wp, 3*U, 2*U, seed+11)-.5)
    idx = np.digitize(-v, [-.74, -.60, -.46, -.33])
    # the flat base takes the deep tone, and dissolves into the sky
    under = y > edge-2.2
    idx = np.where(under, np.maximum(idx, 3), idx)
    fade = np.clip((y-(edge-3.2))/3.2, 0, 1)
    mask &= ~((fade > 0) & (fade*.9 > bayer(Hp, Wp)))
    # a thin lit rim at the top right
    up = np.zeros_like(mask); up[U:, :] = mask[:-U, :]; rt = np.zeros_like(mask); rt[:, :-U] = mask[:, U:]
    rim = mask & (~up | ~rt) & (v > .5)
    idx = np.where(rim, 0, idx)
    a = np.zeros((Hp, Wp, 4), np.uint8)
    pal = np.array([hexrgb(c) for c in tones], np.uint8)
    a[..., :3][mask] = pal[idx[mask]]; a[..., 3][mask] = 255
    return a

def cloud_layers(L, seed):
    """Two drifting sheets: big masses high, flat hazed streaks low at the horizon."""
    W = 860; r = np.random.default_rng(seed)
    near = np.zeros((VH*U, W*U, 4), np.uint8); far = near.copy()
    x = -20
    while x < W-60:                                       # horizon streaks: small, flat, pale
        w = int(r.integers(44, 100)); h = int(r.integers(9, 15))
        over(far, cumulus(w, h, seed+int(x)+900, L['cloud'], flat=.6), int(x*U), int((r.integers(80, 97)-h)*U))
        x += w*r.uniform(.5, 1.3)
    far = grade(far, L, .48, sat=.2)
    x = int(r.integers(-30, 40))
    while x < W-90:                                       # the big masses
        w = int(r.integers(86, 168)); h = int(w*r.uniform(.34, .46))
        over(near, cumulus(w, h, seed+int(x)+17, L['cloud']), int(x*U), int(r.integers(2, 26)*U))
        x += w+int(r.integers(30, 150))
    near[:, -4*U:] = 0; far[:, -4*U:] = 0
    return far, near

# ------------------------------------------------------------------ far planes: roof lines with landmarks, flat tones
def roofline(s, base, seed, hmin, hmax, wmin, wmax, gh=8, windows=True):
    r = rngf(seed); x = -6; a, b, c = R['far']; ra, rb = R['farr']
    while x < s.w:
        w = int(r.integers(wmin, wmax)); h = int(r.integers(hmin, hmax))
        kind = str(r.choice(['step','neck','spout','bell','flat']))
        o = S(w, h+gh); o.use(1, 1.)
        tone = [a, b, b, c][int(r.integers(0, 4))]
        if kind == 'flat': o.rect(tone, 0, gh-2, w, h+2); o.hl(a, 0, gh-2, w)
        else: o.poly(tone, gable_pts(kind, w, gh)); o.rect(tone, 0, gh, w, h)
        o.vl(c if tone != c else rb, 0, gh, h)
        if windows:
            for wy in range(gh+3, h+gh-4, 7):
                for i in range((w-3)//5): o.rect(rb, 3+i*5, wy, 2, 3)
        if r.random() < .3: o.rect(c, int(r.integers(1, max(2, w-3))), gh-4, 2, 4)      # a chimney
        s.paste(o, x, base-h-gh)
        x += w+int(r.integers(-1, 2))

def tower_crown(s, x, base, h):
    """A church tower with stacked lanterns and a crown: reads as the old-city landmark, in three flat tones."""
    a, b, c = R['far']; ra, rb = R['farr']
    w = max(9, h//7)
    s.rect(b, x, base-h, w, h); s.vl(a, x+w-1, base-h, h); s.vl(a, x+w-2, base-h, h); s.vl(c, x, base-h, h)
    for j in range(base-h+5, base-8, 12): s.hl(c, x, j, w); s.rect(rb, x+w//2-1, j+3, 2, 5)
    y = base-h; ww = w
    for st in range(3):
        ww = max(3, ww-2); hh = max(6, h//7)-st
        x0 = x+(w-ww)//2
        s.rect(a, x0-1, y-1, ww+2, 1); s.rect(b, x0, y-hh, ww, hh-1); s.vl(c, x0, y-hh, hh-1); s.vl(a, x0+ww-1, y-hh, hh-1)
        if ww > 4: s.rect(rb, x0+ww//2-1, y-hh+2, 2, hh-4)
        y -= hh
    cx = x+w//2
    s.rect(ra, cx-2, y-3, 4, 3); s.rect(ra, cx-1, y-6, 2, 3); s.vl(rb, cx, y-10, 4)

def church(s, x, base, w, h):
    a, b, c = R['far']; ra, rb = R['farr']
    s.rect(b, x, base-h, w, h); s.poly(ra, [(x-1, base-h), (x+w*.5, base-h-h*.55), (x+w, base-h)]); s.poly(rb, [(x-1, base-h), (x+w*.5, base-h-h*.55), (x+w*.5, base-h)])
    for i in range(x+3, x+w-3, 6): s.rect(rb, i, base-h+4, 2, h-8)
    tw = max(6, w//5); tx = x-tw+1
    s.rect(b, tx, base-h*1.5, tw, h*1.5); s.vl(a, tx+tw-1, base-h*1.5, h*1.5); s.vl(c, tx, base-h*1.5, h*1.5)
    s.poly(ra, [(tx-1, base-h*1.5), (tx+tw/2, base-h*1.5-h*.9), (tx+tw, base-h*1.5)]); s.poly(rb, [(tx-1, base-h*1.5), (tx+tw/2, base-h*1.5-h*.9), (tx+tw/2, base-h*1.5)])

def dome(s, x, base, w, h):
    a, b, c = R['far']; ra, rb = R['farr']
    s.rect(b, x, base-h, w, h); s.vl(c, x, base-h, h); s.hl(a, x, base-h, w)
    for i in range(x+3, x+w-3, 5): s.rect(rb, i, base-h+4, 2, 5)
    cx = x+w/2
    s.rect(a, cx-w*.22, base-h-5, w*.44, 5)
    Y, X = np.ogrid[:s.h, :s.w]
    k = (((X-cx)/(w*.24))**2+((Y-(base-h-5))/(w*.3))**2 <= 1) & (Y <= base-h-5)
    s._mask((slice(0, s.h), slice(0, s.w)), ra, k); s._mask((slice(0, s.h), slice(0, s.w)), rb, k & (X < cx-1))
    s.vl(rb, int(cx), int(base-h-5-w*.3-5), 5)
    for q in (x+1, x+w-5):
        s.rect(b, q, base-h-9, 4, 9); s.poly(ra, [(q-1, base-h-9), (q+2, base-h-16), (q+4, base-h-9)])

def mill(s, x, base, h):
    a, b, c = R['far']; ra, rb = R['farr']
    s.poly(b, [(x-h*.2, base), (x-h*.11, base-h*.7), (x+h*.11, base-h*.7), (x+h*.2, base)]); s.poly(c, [(x-h*.2, base), (x-h*.11, base-h*.7), (x-h*.02, base-h*.7), (x-h*.06, base)])
    s.poly(ra, [(x-h*.13, base-h*.7), (x, base-h*.84), (x+h*.13, base-h*.7)])
    cx, cy = x, base-h*.76
    for an in (.5, 2.07, 3.64, 5.21):
        ex, ey = cx+math.cos(an)*h*.5, cy+math.sin(an)*h*.5
        s.line(rb, cx, cy, ex, ey, 1)
        px_, py_ = -math.sin(an)*h*.07, math.cos(an)*h*.07
        s.poly(ra, [(cx+math.cos(an)*h*.14, cy+math.sin(an)*h*.14), (ex, ey), (ex+px_, ey+py_), (cx+math.cos(an)*h*.14+px_, cy+math.sin(an)*h*.14+py_)])

def mist(W, L, y0, hgt, peak=.75, down=3, seed=5):
    """A band of haze: dense at y0, thinning upward over hgt, as an ordered dither of the haze tone."""
    Hp, Wp = VH*U, W*U
    Y, X = np.mgrid[:Hp, :Wp]; y = Y/U
    wob = 3*(vnoise(Hp, Wp, 60*U, 300*U, seed)-.5)
    d = np.where(y <= y0, 1-(y0-y+wob)/hgt, 1-(y-y0)/max(down, .01))
    d = np.clip(d, 0, 1)**1.3*peak
    k = d > bayer(Hp, Wp)
    a = np.zeros((Hp, Wp, 4), np.uint8)
    col = rgbf(L['dark'])*.45+rgbf(L['light'])*.55
    a[..., :3][k] = np.clip(col*255, 0, 255).astype(np.uint8); a[..., 3][k] = 255
    return a

# ------------------------------------------------------------------ the plan per stage
def ramp_y(y0, y1, far, near):
    """Extra depth over a ground plane: far at y0 (the top), near at y1."""
    return lambda y: near+(far-near)*np.clip((y1-y)/(y1-y0), 0, 1)

PLAN = dict(
  a=dict(light='morning', base=106, seeds=(31, 21),
     planes=[(r'^far$', .60, None), (r'^(bank|far crown|boat|tour boat|far cyclist)', .30, None), (r'^water$', .03, ramp_y(119, 152, .40, 0.)),
             (r'^(floor-far|back|tulips|flag|crown)', .0, None)],
     far1=dict(base=104, lm=[('tower', 150, 64), ('church', 330, 26, 22), ('mill', 470, 30), ('dome', 40, 26, 18)]),
     mists=[('far', 108, 26, .8)]),
  b=dict(light='noon', base=100, seeds=(131, 121),
     planes=[(r'^far$', .62, None), (r'^museum$', .34, None), (r'^(lawn$|pool)', .03, ramp_y(124, 152, .30, 0.)), (r'^lawn crown', .16, None)],
     far1=dict(base=99, lm=[('dome', 210, 30, 20), ('tower', 395, 58), ('church', 120, 24, 20)]),
     mists=[('far', 104, 24, .8), ('museum', 124, 5, .3)]),
  c=dict(light='golden', base=96, seeds=(231, 221),
     planes=[(r'^far$', .66, None), (r'^(bank|far crown|tour boat|far cyclist)', .44, None), (r'^water$', .14, ramp_y(110, 154, .46, 0.)),
             (r'^river far', .02, ramp_y(144, 172, .14, 0.)), (r'^(houseboat|smoke)', .05, None)],
     far1=dict(base=95, lm=[('tower', 215, 60), ('mill', 400, 34), ('church', 20, 28, 22), ('dome', 320, 24, 16)]),
     mists=[('far', 100, 26, .85), ('bank', 107, 9, .42)]),
  d=dict(light='sunset', base=118, seeds=(331, 321),
     planes=[(r'^far$', .52, None), (r'^(stopera|lit window)', .17, None)],
     far1=dict(base=117, lm=[('tower', 250, 62), ('church', 60, 26, 22), ('mill', 400, 32)]),
     mists=[('far', 120, 30, .8)]),
)
LM = dict(tower=tower_crown, church=church, dome=dome, mill=mill)

def _map(it, fn):
    if 'a' in it: it['a'] = fn(it['a'])
    if 'fr' in it: it['fr'] = [fn(x) for x in it['fr']]

def build(p):
    """The proposed scene for part p: the approved scene, re-staged in depth."""
    SC.NEW = True
    try: sc = getattr(SC, 'part_'+p)()
    finally: SC.NEW = False
    P = PLAN[p]; L = ATMO[P['light']]
    out = []
    for it in sc.items:
        n = it.get('n', '')
        if n == 'sky':
            a = sky(SC.lw(SC.S_SKY), L, P['seeds'][1], sun=(278, 44, 15) if p == 'd' else None)
            out.append(dict(t='img', n='sky', s=SC.S_SKY, a=a, x=0, y=0)); continue
        if n == 'clouds':
            cf, cn = cloud_layers(L, P['seeds'][1])
            out.append(dict(t='drift', n='clouds far', s=SC.S_SKY, a=cf, x=0, y=0, v=.012))
            out.append(dict(t='drift', n='clouds', s=SC.S_SKY, a=cn, x=0, y=0, v=.03)); continue
        if n == 'far':
            # a new farthest plane behind the old far plane
            s1 = .09; W1 = SC.lw(s1); f1 = S(W1, VH)
            roofline(f1, P['far1']['base'], P['seeds'][0]+5, 8, 20, 9, 18, gh=6, windows=False)
            for lm in P['far1']['lm']: LM[lm[0]](f1, lm[1], P['far1']['base'], *lm[2:])
            out.append(dict(t='img', n='far 1', s=s1, a=grade(sc.rgba(f1), L, .80, sat=.5), x=0, y=0))
            out.append(dict(t='img', n='mist far 1', s=s1, a=mist(W1, L, P['far1']['base']+2, 20, .7, seed=3), x=0, y=0))
        for pat, depth, ym in P['planes']:
            if re.search(pat, n):
                _map(it, lambda a, d=depth, y=ym: grade(a, L, d, y)); break
        if p == 'd' and it['t'] != 'actors' and not re.search(r'^(sky|clouds|birds|far|stopera|lit window)', n):
            _map(it, dusk)
        if n in ('floor-near', 'front') or n.startswith('river near') or n == 'ducks':
            _map(it, punch)
        out.append(it)
        for after, y0, hgt, peak in P['mists']:
            if n == after:
                out.append(dict(t='img', n='mist '+after, s=it['s'], a=mist(SC.lw(it['s']), L, y0, hgt, peak, seed=len(out)), x=0, y=0))
    sc.items = out
    return sc

if __name__ == '__main__':
    import sys, os
    from preview import compose
    HERE = os.path.dirname(os.path.abspath(__file__)); o = HERE+'/out'; os.makedirs(o, exist_ok=True)
    for p in sys.argv[1].split(','):
        sc = build(p); f = compose(sc, int(sys.argv[2]) if len(sys.argv) > 2 else 60, actors=len(sys.argv) > 3)
        Image.fromarray(f[..., :3]).save(f'{o}/{p}-new-u{U}.png')
        print(p, 'U', U, 'colours', len(np.unique(f[..., :3].reshape(-1, 3), axis=0)), flush=True)
