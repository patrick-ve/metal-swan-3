"""Scenery built the way the heroes are built (docs/design/squad40/rig.py): one pixel size, ramps of about 4 tones spaced
about 0.2 in lightness, hard clusters, no gradients, no dither, no grain; each part keeps a z and a part id; one selout pass
(a far part's edge next to a nearer part takes its dark tone), one exterior outline in the heroes' near-black. Light comes
from the upper right, as on a hero who faces right."""
import math
import numpy as np
from PIL import Image, ImageDraw

KHEX = '#140c0e'          # the heroes' outline colour
COL = [None]; DARK = {}; R = {}
def _reg(h):
    COL.append(h); return len(COL)-1
def ramp(name, *hexes):
    ids = [_reg(h) for h in hexes]
    for i in ids: DARK[i] = ids[-1]
    R[name] = ids
    return ids
K = _reg(KHEX); DARK[K] = K
KM = _reg('#2c1a26'); DARK[KM] = KM        # the outline of the middle plane: dark, a little softer

def hexrgb(h):
    h = h.lstrip('#'); return tuple(int(h[i:i+2],16) for i in (0,2,4))
def rngf(s): return np.random.default_rng(s)

class S:
    """A sprite canvas of palette ids."""
    def __init__(s, w, h):
        s.w, s.h = int(w), int(h)
        s.c = np.zeros((s.h, s.w), np.int16); s.z = np.full((s.h, s.w), -9., np.float32); s.p = np.zeros((s.h, s.w), np.int16)
        s.zv, s.pv = 0., 1; s.thin = np.zeros((s.h, s.w), bool)
    def use(s, part, z):
        s.pv, s.zv = part, z; return s
    def box(s, x, y, w, h):
        x0, y0 = int(x), int(y); x1, y1 = x0+int(w), y0+int(h)
        x0, y0, x1, y1 = max(x0,0), max(y0,0), min(x1,s.w), min(y1,s.h)
        return None if x1 <= x0 or y1 <= y0 else (slice(y0,y1), slice(x0,x1))
    def _mask(s, b, col, k=None):
        ok = s.z[b] <= s.zv if k is None else (k & (s.z[b] <= s.zv))
        s.c[b][ok] = col; s.z[b][ok] = s.zv; s.p[b][ok] = s.pv
    def rect(s, col, x, y, w, h):
        b = s.box(x,y,w,h)
        if b is not None: s._mask(b, col)
    def px(s, col, x, y):
        s.rect(col, x, y, 1, 1)
    def hl(s, col, x, y, w): s.rect(col, x, y, w, 1)
    def vl(s, col, x, y, h): s.rect(col, x, y, 1, h)
    def poly(s, col, pts):
        im = Image.new('1', (s.w, s.h)); ImageDraw.Draw(im).polygon([(float(a),float(b)) for a,b in pts], fill=1, outline=1)
        k = np.array(im, bool); s._mask((slice(0,s.h),slice(0,s.w)), col, k); return k
    def ell(s, col, cx, cy, rx, ry):
        Y, X = np.ogrid[:s.h, :s.w]
        k = ((X-cx)/max(rx,.1))**2+((Y-cy)/max(ry,.1))**2 <= 1
        s._mask((slice(0,s.h),slice(0,s.w)), col, k); return k
    def line(s, col, x0, y0, x1, y1, w=1):
        im = Image.new('1', (s.w, s.h)); ImageDraw.Draw(im).line([(x0,y0),(x1,y1)], fill=1, width=w)
        k = np.array(im, bool); s._mask((slice(0,s.h),slice(0,s.w)), col, k); return k
    def grid(s, rows, x, y, leg):
        for j, r in enumerate(rows):
            for i, ch in enumerate(r):
                if ch not in '. ': s.px(leg[ch], x+i, y+j)
    def retone(s, k, m):
        """Move pixels in mask k along their ramps: m = {from id: to id}."""
        for a, b in m.items():
            q = k & (s.c == a); s.c[q] = b
    def paste(s, o, x, y, z=None, part=None):
        x, y = int(x), int(y)
        xa, ya = max(0,-x), max(0,-y); xb, yb = min(o.w, s.w-x), min(o.h, s.h-y)
        if xb <= xa or yb <= ya: return
        k = o.c[ya:yb,xa:xb] > 0
        for d, a in ((s.c,o.c),(s.z,o.z),(s.p,o.p)):
            d[y+ya:y+yb,x+xa:x+xb][k] = a[ya:yb,xa:xb][k]
        if z is not None: s.z[y+ya:y+yb,x+xa:x+xb][k] = z
        if part is not None: s.p[y+ya:y+yb,x+xa:x+xb][k] = part
    def finish(s, outline=K, selout=True, clean=True):
        """The heroes' pass: selout at part borders, then one exterior outline."""
        c = s.c.copy()
        if selout:
            dk = np.array([0]+[DARK.get(i,i) for i in range(1,len(COL))], np.int16)
            for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
                nz = np.roll(np.roll(s.z, dy, axis=0), dx, axis=1); np_ = np.roll(np.roll(s.p, dy, axis=0), dx, axis=1); nc = np.roll(np.roll(s.c, dy, axis=0), dx, axis=1)
                q = (s.c > 0) & (nc > 0) & (np_ != s.p) & (nz > s.z+.4)
                if dy == 1: q[0,:] = False
                if dy == -1: q[-1,:] = False
                if dx == 1: q[:,0] = False
                if dx == -1: q[:,-1] = False
                c[q] = dk[s.c[q]]
        if outline:
            f = (s.c > 0) & ~s.thin
            e = np.zeros_like(f)
            e[1:,:] |= f[:-1,:]; e[:-1,:] |= f[1:,:]; e[:,1:] |= f[:,:-1]; e[:,:-1] |= f[:,1:]
            e &= s.c == 0
            c[e] = outline; s.z[e] = s.z.min()-1; s.p[e] = 0
        s.c = c
        return s

def add_margin(s, m=1):
    o = S(s.w+2*m, s.h+2*m); o.paste(s, m, m); o.thin[m:m+s.h, m:m+s.w] = s.thin; return o

def table(grade):
    t = np.zeros((len(COL), 3), np.uint8)
    for i in range(1, len(COL)):
        c = hexrgb(COL[i])
        t[i] = grade(c) if (i not in (K,KM) and grade) else c
    return t

def rgba(s, tb):
    a = np.zeros((s.h, s.w, 4), np.uint8)
    k = s.c > 0
    a[k, :3] = tb[s.c[k]]; a[k, 3] = 255
    return a

def over(dst, src, x=0, y=0):
    h, w = src.shape[:2]
    X0, Y0 = max(x,0), max(y,0); X1, Y1 = min(x+w,dst.shape[1]), min(y+h,dst.shape[0])
    if X1 <= X0 or Y1 <= Y0: return
    a = src[Y0-y:Y1-y, X0-x:X1-x]; k = a[...,3] > 0
    dst[Y0:Y1, X0:X1, :3][k] = a[...,:3][k]; 
    if dst.shape[2] == 4: dst[Y0:Y1, X0:X1, 3][k] = 255

F = {'A':'010101111101101','B':'110101110101110','C':'011100100100011','D':'110101101101110','E':'111100110100111','F':'111100110100100','G':'011100101101011','H':'101101111101101','I':'111010010010111','J':'001001001101010','K':'101101110101101','L':'100100100100111','M':'101111111101101','N':'110101101101101','O':'010101101101010','P':'110101110100100','R':'110101110101101','S':'011100010001110','T':'111010010010010','U':'101101101101111','V':'101101101101010','W':'101101111111101','X':'101101010101101','Y':'101101010010010','Z':'111001010100111',' ':'000000000000000'}
def text(s, msg, x, y, col, gap=1):
    cx = x
    for ch in msg.upper():
        g = F.get(ch, F[' '])
        for j in range(5):
            for i in range(3):
                if g[j*3+i] == '1': s.px(col, cx+i, y+j)
        cx += 3+gap
def text_w(msg, gap=1): return len(msg)*(3+gap)-gap

# ------------------------------------------------------------------ ramps: hi, base, shade, dark. Lightness about .2 apart, as on a hero.
ramp('brickr', '#e08a5c','#bd4f34','#83292a','#4b1522')
ramp('brickd', '#a57a68','#6f4a46','#472c33','#271822')
ramp('bricko', '#f0c978','#c9913f','#8d5a28','#4f2e1c')
ramp('brickb', '#b58654','#8a5634','#5c3526','#331c1c')
ramp('brickn', '#90a2ad','#5f7284','#3d4a5e','#212a3c')
ramp('plastc', '#fbedc4','#dfc88c','#ac8e5e','#6c5240')
ramp('plastw', '#fffdf2','#d9dcd8','#a2a9b6','#616780')
ramp('plastg', '#a9d6a5','#58a06e','#2f6e4e','#173f36')
ramp('plastp', '#fbd2c0','#dc8f84','#a4525c','#5e2c3e')
ramp('white',  '#fffdf4','#d4d6d4','#8f94a8','#4c5068')
ramp('stone',  '#ece4cc','#b9ae97','#7f776f','#47424a')
ramp('kerb',   '#f2efe2','#b8b5ae','#77757c','#3f3e48')
ramp('roof',   '#8c8a94','#5a5966','#383845','#1e1e2a')
ramp('glass',  '#d6f2ee','#6aa2b8','#27436a','#121c38')
ramp('dgreen', '#82bc84','#3a8058','#1c5240','#0e2e28')
ramp('dred',   '#ec8c64','#b83c34','#721c28','#3e0e1c')
ramp('navy',   '#a0bedc','#4c6ca8','#28386c','#141c40')
ramp('iron',   '#94c09c','#4a8064','#245040','#102c26')
ramp('wood',   '#ecc98e','#b98a50','#7c5532','#43291e')
ramp('bark',   '#b89a7a','#7c5e48','#4c3630','#2a1c1e')
ramp('leaf',   '#c6de66','#6fae3c','#2f7a34','#154a2e')
ramp('leaf2',  '#e2ec8a','#98c64c','#4a9438','#1e5c30')
ramp('moss',   '#a0b45c','#607c3a','#34502c','#1a3022')
ramp('bollard','#e0906a','#ac4a34','#6e2626','#3e1420')
ramp('xw',     '#fffaf0','#c3c7d2')
ramp('pave',   '#dfd5ba','#bdb198','#918672','#5c5350')
ramp('cobble', '#b4a68c','#8a7c68','#5e534c','#30282c')
ramp('lane',   '#d07a58','#a84836','#782c28','#46181e')
ramp('paint',  '#fffff4','#c8c8c4','#8c8c90')
ramp('gravel', '#efe0bc','#c8b48c','#907c60','#5a4a3e')
ramp('grass',  '#b8d860','#6ca83c','#357a34','#1a4e2c')
ramp('water',  '#d8f2e0','#5cc0b0','#1e8488','#0e5060','#082c40')
ramp('waterw', '#f0c888','#b47a4c','#74443a','#3c2430')
ramp('hull',   '#8a7e7a','#54494c','#2e2830','#17141c')
ramp('cloth',  '#fffdf4','#d6d3cc','#9a97a0')
ramp('tulip',  '#ffa8c4','#e03c7c','#8c1c50')
ramp('yellow', '#fff08c','#f6c43c','#b07c18')
ramp('glow',   '#fffde4','#ffe67c','#f0b030','#a86a18')
ramp('lit',    '#fff0a0','#f6c048','#b87020')
ramp('pole',   '#f0f2ee','#a8acb4','#62687a','#2e3140')
ramp('brass',  '#f8e488','#d0a030','#8a5e18','#4c2e0c')
ramp('blue',   '#94c8ec','#3e88c4','#1e5088','#0e2c54')
ramp('marble', '#fffdf2','#e0ded4','#aaaab0','#6a6c80')
ramp('cloud',  '#ffffff','#e8eef2','#b4c6dc','#84a0c4')
ramp('far',    '#d4c0ac','#b09c98','#8e8290')
ramp('farr',   '#9a9cb0','#7c8098')
ramp('skin',   '#ffe4cc','#f4b896','#d4886c','#94503e')
