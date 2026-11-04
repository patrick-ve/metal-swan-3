# _probe: the fixture set of the bake and the loader tests (tests/engine/baked.test.ts,
# tests/tools/art40-bake.test.ts). Baked to tests/fixtures/art40/_probe.gen.ts, never into src/.
# 2 strips, 5 frames, one variant, one event, one point, one smear frame, a joint track on the
# swing (the sidecar tests/fixtures/art40/_probe.joints.json); one frame is drawn with the kit (a
# shaded tube, selout and the outline pass), the others are hand-drawn grids.
import art40 as X
import castkit as K

SET = X.Set(prefix='test/_probe', budget=28, face=1, outline='K', hl='w', fx='F')

PAL = {
    'K': '#140c0e',                                        # the warm near-black outline
    'Y': '#ffe040', 'V': '#e0b018', 'U': '#9a700e',        # a yellow body ramp
    'B': '#4c64a4', 'b': '#33467c', 'n': '#222f56',        # a navy ramp (the variant's swap)
    'w': '#fffaf0',                                        # the eye glint (a single pixel)
    'F': '#fffbd8',                                        # the shared FX ramp (a flash)
}

BLOB = K.grid("""
    ..KKKK..
    .KYYYVK.
    KYYwYYVK
    KYYYYVUK
    KVYYVVUK
    .KBBbbK.
    .KBbbnK.
    ..KKKK..
""")


def blob(dy, look=0):
    rows = BLOB if not look else [r.replace('w', 'Y') for r in BLOB]
    return ['........'] * (2 - dy) + rows + ['........'] * dy


def tube_frame(angle):
    """A navy club drawn with the kit: a shaded tube, the clean-up, selout and outline passes."""
    K.palette(PAL, dark={'Y': 'U', 'V': 'U', 'U': 'U', 'B': 'n', 'b': 'n', 'n': 'n'})
    cv = K.Canvas(24, 24)
    a = (8.0, 16.0)
    import math
    b = (a[0] + 10 * math.cos(math.radians(angle)), a[1] - 10 * math.sin(math.radians(angle)))
    cv.tube(a, b, 2.4, 1.6, ['B', 'b', 'n', 'n'], 1, 'club')
    cv.grid(5, 16, ['YYV', 'VUU'], 2, 'grip')
    rows, root = K.finish(cv, (8, 20))
    return rows, root, (round(b[0]), round(b[1]))


def build(s):
    K.palette(PAL)
    s.strip('idle', [X.Frame(blob(0), (4, 10)), X.Frame(blob(1, 1), (4, 10))], [20, 12],
            cls='idle', why='probe set: two frames are enough to test the loader')
    frames = []
    for i, ang in enumerate((120, 60, 10)):
        rows, root, tip = tube_frame(ang)
        if i == 1:     # the smear frame: the club stretched by a flash streak (FX letter)
            rows = [r[:12] + ('FFF' if j == 9 else r[12:15]) + r[15:] for j, r in enumerate(rows)]
        frames.append(X.Frame(rows, root, pts={'hand': tip}, smear=(i == 1), joints={'grip': (9, 17), 'tip': tip}))
    s.strip('swing', frames, [3, 2, 6], loop=False, defer=True, cls='melee', face=-1,
            why='probe set: three frames test the smear flag, the face flip and the points')
    s.variant('test/_probe-b', {'B': '#a4384c', 'b': '#7c2638', 'n': '#4a1626'})
    s.event('SWING_HIT', 1)
