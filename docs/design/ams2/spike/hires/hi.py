"""From the approved 1x sprites to a finer pixel, keeping their look.
1. EPX: each pixel becomes 2x2 with rounded diagonals and no new colours, so outlines and hard clusters stay crisp.
2. Longer ramps: one extra tone between every two tones. A hard one-pixel band on the shaded side of a tone step.
3. Detail by material: bricks and mortar, slates, grain, flecks, leaves, panes. Always whole tones, never a gradient or dither."""
import math, os
import numpy as np
from kit import *
import kit

U = kit.U
MID = 2 if U >= 4 else 1         # new tones between two tones of a ramp
STEP = MID+1                     # the distance between two original tones on the long ramp
EXT = {}; RIDX = None; POS = None; EXTT = None; LEN = None; NAMES = []

def _mix(a, b, f=.5):
    x, y = hexrgb(a), hexrgb(b)
    # the new tones lean a little warmer on the light side, so the longer ramps stay hue-shifted
    m = [x[i]+(y[i]-x[i])*f for i in range(3)]
    w = 3*(1-f)
    return '#%02x%02x%02x' % (min(255, int(m[0]+w)), int(m[1]), max(0, int(m[2]-w*.7)))

def build():
    global RIDX, POS, EXTT, LEN, NAMES
    if RIDX is not None: return
    NAMES = list(R.keys())
    for n in NAMES:
        ids = R[n]; ext = []
        for i, c in enumerate(ids):
            ext.append(c)
            if i < len(ids)-1:
                for q in range(1, MID+1):
                    COL.append(_mix(COL[c], COL[ids[i+1]], q/(MID+1))); ext.append(len(COL)-1)
        EXT[n] = ext
    RIDX = np.full(len(COL), -1, np.int16); POS = np.zeros(len(COL), np.int16)
    mx = max(len(v) for v in EXT.values())
    EXTT = np.zeros((len(NAMES), mx), np.int16); LEN = np.zeros(len(NAMES), np.int16)
    for ri, n in enumerate(NAMES):
        LEN[ri] = len(EXT[n])
        for p, i in enumerate(EXT[n]):
            RIDX[i] = ri; POS[i] = p; EXTT[ri, p] = i

def epx(c):
    h, w = c.shape
    pad = np.pad(c, 1, mode='edge')
    A = pad[:-2, 1:-1]; D = pad[2:, 1:-1]; L_ = pad[1:-1, :-2]; B = pad[1:-1, 2:]
    o = np.zeros((h*2, w*2), c.dtype)
    o[0::2, 0::2] = np.where((L_ == A) & (L_ != D) & (A != B), L_, c)
    o[0::2, 1::2] = np.where((A == B) & (A != L_) & (B != D), A, c)
    o[1::2, 0::2] = np.where((D == L_) & (D != B) & (L_ != A), D, c)
    o[1::2, 1::2] = np.where((B == D) & (B != A) & (D != L_), B, c)
    return o

def group(c, names):
    ris = [NAMES.index(n) for n in names if n in NAMES]
    return np.isin(RIDX[c], ris)

def prefix(c, pre):
    ris = [i for i, n in enumerate(NAMES) if n.startswith(pre)]
    return np.isin(RIDX[c], ris)

TONE = MID       # one texture step is one to two long-ramp tones
def shift(c, m, d):
    """Move the pixels of mask m along their ramps by d tones (positive = darker)."""
    if not m.any(): return
    r = RIDX[c[m]]; p = POS[c[m]]
    dd = d[m] if isinstance(d, np.ndarray) else d
    q = np.clip(p+dd*TONE, 0, LEN[r]-1)
    c[m] = EXTT[r, q]

def noise(w, h, cx, cy, seed):
    """Stretched value noise: cx, cy = feature size along x and y."""
    r = rngf(seed)
    g = r.random((int(h/cy)+3, int(w/cx)+3))
    ys = np.arange(h)/cy; xs = np.arange(w)/cx
    x0 = xs.astype(int); y0 = ys.astype(int); fx = (xs-x0)[None,:]; fy = (ys-y0)[:,None]
    a = g[np.ix_(y0,x0)]; b = g[np.ix_(y0,x0+1)]; cc = g[np.ix_(y0+1,x0)]; d = g[np.ix_(y0+1,x0+1)]
    return (a*(1-fx)+b*fx)*(1-fy)+(cc*(1-fx)+d*fx)*fy

def interband(c, gap=None, to=None):
    """Hard bands of the new tones on the shaded side of a tone step inside one ramp. Linework stays as it is."""
    gap = gap or STEP
    to = gap-1 if to is None else to
    out = c.copy()
    for dy, dx in ((-1,0),(0,1)):    # the light comes from the top and the right
        nb = np.roll(np.roll(c, -dy, axis=0), -dx, axis=1)
        q = (RIDX[c] >= 0) & (RIDX[c] == RIDX[nb]) & (POS[c]-POS[nb] == gap)
        if dy == -1: q[-1,:] = False
        if dx == 1: q[:,-1] = False
        rr = RIDX[c[q]]; out[q] = EXTT[rr, POS[c[q]]-to]
    return out

def detail(c, seed, marks):
    h, w = c.shape
    r = rngf(seed)
    Y, X = np.mgrid[0:h, 0:w]
    # ---- bricks: courses and single bricks, in patches so the wall stays calm between them
    m = prefix(c, 'brick')
    if m.any():
        ch = max(3, int(round(1.5*U))); bl = max(6, int(round(4*U)))
        row = Y//ch; off = (row % 2)*(bl//2); col = (X+off)//bl
        J = r.random((256,256))[row % 256, col % 256]
        patch = noise(w, h, 9*U, 7*U, seed+1) > .4
        d = np.zeros((h, w), np.int16)
        d = np.where(J < .13, 1, np.where(J > .9, -1, 0))
        joint = ((Y % ch == ch-1) | ((X+off) % bl == 0))
        d = np.where(joint & patch, 2, d*(1 if U >= 2 else 0))
        d = np.where(joint & ~patch & (J > .7), 1, d)
        shift(c, m, d.astype(np.int16))
    # ---- plaster: a few trowel marks
    m = prefix(c, 'plast')
    if m.any():
        n = noise(w, h, 5*U, 2*U, seed+2); f = noise(w, h, U, U, seed+3)
        shift(c, m & (n > .74), 1); shift(c, m & (n < .22), -1); shift(c, m & (f > .86) & (n > .5), 1)
    # ---- stone, kerbs, paving: flecks and small chips
    for names, cell, hi_, lo_ in ((['stone','kerb'], .7, .78, .22), (['pave'], .8, .8, .2), (['cobble'], .7, .76, .24), (['gravel'], .6, .7, .3), (['white','marble'], 1.6, .9, .1), (['hull'], .9, .8, .2)):
        m = group(c, names)
        if m.any():
            f = noise(w, h, max(1.5, cell*U), max(1.5, cell*U), seed+5+len(names[0]))
            shift(c, m & (f > hi_), 1); shift(c, m & (f < lo_), -1)
    # ---- slates: rows of single slates
    m = group(c, ['roof'])
    if m.any():
        ch = max(3, int(round(1.6*U))); bl = max(5, int(round(3*U)))
        row = Y//ch; off = (row % 2)*(bl//2); col = (X+off)//bl
        J = r.random((256,256))[row % 256, col % 256]
        d = np.where(J < .2, 1, np.where(J > .84, -1, 0))
        d = np.where(Y % ch == ch-1, 2, d); d = np.where((X+off) % bl == 0, np.maximum(d, 1), d)
        shift(c, m, d.astype(np.int16))
    # ---- wood and bark: long grain
    m = group(c, ['wood'])
    if m.any():
        n = noise(w, h, 9*U, max(1.2, .55*U), seed+8)
        shift(c, m & (n > .68), 1); shift(c, m & (n < .28), -1)
    m = group(c, ['bark'])
    if m.any():
        n = noise(w, h, max(1.2, .55*U), 6*U, seed+9)
        shift(c, m & (n > .62), 1); shift(c, m & (n < .32), -1)
    # ---- leaves: single leaf shapes, a lit top and a shaded foot, in three directions
    m = group(c, ['leaf','leaf2','moss'])
    if m.any():
        ys, xs = np.nonzero(m)
        ll = max(2, int(round(.62*U))); lh = max(1, int(round(.36*U)))
        stamps = []
        for ang in (0, 1, 2):
            pts = []
            for dy in range(-lh, lh+1):
                for dx in range(-ll, ll+1):
                    u, v = dx/ll, dy/lh
                    if ang == 1: u, v = (dx+dy)/ll, (dy-dx*.4)/lh
                    if ang == 2: u, v = (dx-dy)/ll, (dy+dx*.4)/lh
                    if u*u+v*v <= 1: pts.append((dy, dx, (1 if v > .15 else 0)-(1 if v < -.35 else 0)))
            stamps.append(pts)
        n = int(len(ys)/(ll*lh*2.4))
        pick = r.integers(0, len(ys), n)
        ly, lx = ys[pick], xs[pick]
        P = POS[c].copy(); ri = RIDX[c]
        lp = P[ly, lx]+r.integers(-1, 2, n)*TONE
        gr = r.integers(0, 3, n)
        for g_, pts in enumerate(stamps):
            sel = gr == g_
            yy, xx, pp, rr_ = ly[sel], lx[sel], lp[sel], ri[ly[sel], lx[sel]]
            for dy, dx, dt in pts:
                Y2 = np.clip(yy+dy, 0, h-1); X2 = np.clip(xx+dx, 0, w-1)
                ok = m[Y2, X2]
                c[Y2[ok], X2[ok]] = EXTT[rr_[ok], np.clip(pp[ok]+dt*TONE, 0, LEN[rr_[ok]]-1)]
    # ---- grass, lane, water, clouds, cloth
    m = group(c, ['grass'])
    if m.any():
        n = noise(w, h, max(1.2, .5*U), 1.6*U, seed+12)
        shift(c, m & (n > .64), 1); shift(c, m & (n < .34), -1)
    m = group(c, ['lane'])
    if m.any():
        n = noise(w, h, max(1.3, .6*U), max(1.3, .5*U), seed+13)
        shift(c, m & (n > .76), 1); shift(c, m & (n < .24), -1)
    m = group(c, ['water','waterw'])
    if m.any():
        n = noise(w, h, 7*U, max(1.2, .4*U), seed+14)
        shift(c, m & (n > .66), 1); shift(c, m & (n < .3), -1)
    m = prefix(c, 'cloud')
    if m.any():
        n = noise(w, h, 2.2*U, 1.4*U, seed+15)
        shift(c, m & (n > .72), 1)
    m = group(c, ['cloth'])
    if m.any():
        n = noise(w, h, max(1.2, .55*U), 5*U, seed+16)
        shift(c, m & (n > .66), 1)
    m = group(c, ['far'])
    if m.any():
        n = noise(w, h, 2*U, U, seed+17)
        shift(c, m & (n > .72), 1)
    # ---- windows: small panes, a profile in the frame
    wh = EXT['white']; gl = EXT['glass']
    ri_g = NAMES.index('glass')
    for kind, x, y, ww, hh in marks:
        if kind != 'win': continue
        x0, y0, x1, y1 = int(x*U), int(y*U), int((x+ww)*U), int((y+hh)*U)
        x0c, y0c, x1c, y1c = max(x0,0), max(y0,0), min(x1,w), min(y1,h)
        if x1c <= x0c or y1c <= y0c: continue
        sub = c[y0c:y1c, x0c:x1c]
        g = RIDX[sub] == ri_g
        if not g.any(): continue
        # glazing bars at the finer pixel
        cols = 4 if ww >= 12 else 3
        rows_ = 6 if hh >= 18 else 4
        for i in range(1, cols):
            q = x0+(x1-x0)*i//cols-x0c
            if 0 <= q < sub.shape[1]: sub[:, q][g[:, q]] = wh[STEP]
        for j in range(1, rows_):
            q = y0+(y1-y0)*j//rows_-y0c
            if 0 <= q < sub.shape[0]: sub[q, :][g[q, :]] = wh[STEP]
        # the sky gets lighter towards the top of the glass in two hard steps
        g2 = RIDX[sub] == ri_g
        top = (np.arange(sub.shape[0])[:,None] < sub.shape[0]*.35)
        q = g2 & top & (POS[sub] == 2*STEP)
        sub[q] = gl[2*STEP-MID]
        # the inner line of the frame
        if U >= 2 and x1-x0 >= 8 and y1-y0 >= 8:
            fr = max(1, U)
            ins = np.zeros(sub.shape, bool)
            ins[fr:fr+1, fr:-fr] = True; ins[fr:-fr, fr:fr+1] = True
            q = ins & (RIDX[sub] == NAMES.index('white'))
            sub[q] = wh[2*STEP]
    return c

def render(o, tb, seed=1):
    """A finished 1x sprite to RGBA at the finer pixel."""
    c = o.c
    if U == 1: return rgba(o, tb)
    n = int(round(math.log2(U)))
    for _ in range(n): c = epx(c)
    c = c.copy()
    c = interband(c)                       # the step of 2 or 3 long-ramp tones gets a band
    if MID == 2: c = interband(c, gap=2, to=1)
    c = detail(c, seed, getattr(o, 'marks', []))
    if MID == 2:
        # more tones inside big shapes: small clusters one long-ramp tone away
        h_, w_ = c.shape
        n = noise(w_, h_, 2.2*U, 1.2*U, seed+40)
        big = prefix(c, 'brick') | prefix(c, 'plast') | group(c, ['stone','pave','cobble','gravel','grass','bark','wood','roof','lane','kerb','hull'])
        q = big & (n > .62)
        r_ = RIDX[c[q]]; c[q] = EXTT[r_, np.clip(POS[c[q]]+1, 0, LEN[r_]-1)]
        q = big & (n < .36)
        r_ = RIDX[c[q]]; c[q] = EXTT[r_, np.clip(POS[c[q]]-1, 0, LEN[r_]-1)]
    a = np.zeros(c.shape+(4,), np.uint8)
    k = c > 0
    a[k, :3] = tb[c[k]]; a[k, 3] = 255
    return a

def rep(a):
    """A real game sprite stays as it is: whole-number scale, nearest neighbour."""
    return np.repeat(np.repeat(a, U, axis=0), U, axis=1) if U > 1 else a
