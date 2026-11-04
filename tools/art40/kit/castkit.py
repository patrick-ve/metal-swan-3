# PRODUCTION COPY of docs/design/cast40/castkit.py (the frozen spike): the shared helpers of the
# cast (palette, humanoid / full / finish composition, grids, mirror, bbox, previews) on top of the
# squad rig in this folder. The rig search of the spike is gone: tools/art40 puts this folder on
# sys.path (art40.py), so `import rig, pose, parts, anims` are the kit copies.
#
# A character module patches the shared rig tables IN PLACE for its own process (exactly like a hero
# module in the squad rig); bake.py runs every set in its own process. See tools/art40/README.md.
#
#   import castkit as K
#   K.palette({...}, dark={...})            # recolour / add letters (rig.apply_hero)
#   K.P.HEADS['fwd'] = (rows, {'neck': (x, y)})
#   rows, root = K.humanoid(upper_pose, lower_pose)   # or K.full(pose) / K.finish(canvas, root)
#
# rows = list of strings over palette letters ('.' = empty), root = the ground point (x, y) under
# the figure's centre in those rows.
import rig            # noqa: E402  palette PAL, DARK, HERO, Canvas, ik, rotsprite, scale2x
import pose           # noqa: E402  compose, place, leg, arm, tube, RAMP, CUT, THIGH ..., HOOKS
import parts as P     # noqa: E402  HEADS, TORSOS, SHOES, GUNS, FISTS, HANDS, ITEMS, FX, shear()
import anims as A     # noqa: E402  UPPER, LOWER, FULL, up(), gun(), hand(), legs(), ...
from rig import Canvas, PAL, W, H, RX, RY  # noqa: E402,F401

ROOT = (RX, RY)       # the ground point of the standard 80x76 figure canvas


def palette(pal=None, dark=None, letters=None):
    """Recolour existing letters and/or add new ones. Every new letter needs a dark (selout) tone."""
    pal = pal or {}
    rig.apply_hero(pal, letters if letters is not None else ''.join(pal), dark or {})


def humanoid(upper, lower):
    """One standing figure: an UPPER pose on a LOWER pose joined at the pelvis, exactly as the squad
    page draws a hero (upper composed at the standing pelvis, then moved onto the legs' pelvis; the
    back layer, e.g. a cape, behind both). Returns (rows, root) on the 80x76 canvas."""
    up = dict(upper)
    up['pelvis'] = (0, -17)
    lx, ly = lower.get('pelvis', (0, -17))
    dx, dy = round(lx), round(ly + 17)
    layers = []
    br = pose.compose(up, 'back')[0]
    if br:
        layers.append((br, dx, dy))
    layers.append((pose.compose(lower, 'lower')[0], 0, 0))
    layers.append((pose.compose(up, 'upper')[0], dx, dy))
    return stack(layers, pose.W, pose.H), (pose.RX, pose.RY)


def full(p):
    """One-piece figure (a death, a sit, a ride): pose.compose(p, 'full'). Returns (rows, root)."""
    return pose.compose(p, 'full')[0], (pose.RX, pose.RY)


def finish(cv, root, outline=True):
    """A hand-built canvas (creatures, machines, bosses): selout + outline. Returns (rows, root)."""
    return cv.finish(outline=outline), root


def stack(layers, w, h):
    """Blit (rows, dx, dy) layers back to front onto a w x h canvas of '.'."""
    out = [['.'] * w for _ in range(h)]
    for rows, dx, dy in layers:
        for j, r in enumerate(rows):
            y = j + dy
            if 0 <= y < h:
                for i, ch in enumerate(r):
                    x = i + dx
                    if ch != '.' and 0 <= x < w:
                        out[y][x] = ch
    return [''.join(r) for r in out]


def grid(text):
    """A hand-drawn part from a triple-quoted block: strips the common indent and blank edge lines.
    Pads rows to one width with '.'."""
    lines = [l.rstrip() for l in text.strip('\n').split('\n')]
    ind = min((len(l) - len(l.lstrip()) for l in lines if l.strip()), default=0)
    lines = [l[ind:] for l in lines]
    n = max(len(l) for l in lines)
    return [l.ljust(n, '.').replace(' ', '.') for l in lines]


def mirror(rows):
    return [r[::-1] for r in rows]


def bbox(rows):
    xs = [x for r in rows for x, ch in enumerate(r) if ch != '.']
    ys = [y for y, r in enumerate(rows) if r.strip('.')]
    if not xs:
        return 0, 0, 1, 1
    return min(xs), min(ys), max(xs) + 1, max(ys) + 1


# ---------- previews (shared by cast.py and lineup.py) ----------
def hex_rgb(v):
    return tuple(int(v[i:i + 2], 16) for i in (1, 3, 5))


def render(items, w, h, scale=4, bg=(153, 217, 234), ground=None, path=None):
    """items = [(rows, pal{letter: '#hex'}, x0, y0)] in 1x pixels on a w x h stage. ground = y of a
    ground line (drawn as a dark band below it). Writes a PNG scaled by 'scale' (nearest)."""
    from PIL import Image
    im = Image.new('RGB', (w, h), bg)
    px = im.load()
    if ground is not None:
        for y in range(ground, h):
            for x in range(w):
                px[x, y] = (96, 112, 92) if y == ground else (128, 140, 118)
    for rows, pal, x0, y0 in items:
        rgb = {k: hex_rgb(v) for k, v in pal.items()}
        alpha = {k: int(v[7:9], 16) / 255 for k, v in pal.items() if len(v) == 9}   # '#rrggbbaa'
        for j, r in enumerate(rows):
            for i, ch in enumerate(r):
                if ch != '.' and ch in rgb and 0 <= x0 + i < w and 0 <= y0 + j < h:
                    if ch in alpha:
                        a, b = alpha[ch], px[x0 + i, y0 + j]
                        px[x0 + i, y0 + j] = tuple(round(b[n] + (rgb[ch][n] - b[n]) * a) for n in range(3))
                    else:
                        px[x0 + i, y0 + j] = rgb[ch]
    if scale != 1:
        im = im.resize((w * scale, h * scale), Image.NEAREST)
    if path:
        im.save(path)
    return im
