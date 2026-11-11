"""Palette-id fixtures of the kit's reference drawings (docs/design/ams2/spike/hires), for tests/art/herokit.test.ts.
Run: python3 tools/herokit/fixture.py (it runs itself once per tier, the tier is an import-time setting of the reference)."""
import hashlib, json, os, subprocess, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
OUT = os.path.join(ROOT, 'tests', 'fixtures', 'herokit.json')


def one(u):
    sys.path.insert(0, os.path.join(ROOT, 'docs', 'design', 'ams2', 'spike', 'hires'))
    os.environ['BG_U'] = str(u)
    import numpy as np
    import kit
    from kit import R, S
    import parts as P
    import scenes as SC
    import hi

    hi.build()
    L = SC.LIGHTS['morning']
    tb = kit.table(SC.grader(L))
    for nm in (L['sky'], L['cloud'], 'sun'):
        for i in R[nm]:
            tb[i] = kit.hexrgb(kit.COL[i])

    def floor(fn, *a, w=200, **k):
        s = S(w, 216)
        fn(s, *a, **k)
        return s

    def sky():
        s = S(120, 216)
        P.sky_bands(s, R['sky_m'], SC.STOPS, 21)
        return s

    def far():
        s = S(160, 216)
        P.skyline(s, 106, 31)
        P.far_tower(s, 40, 106, 70)
        return s

    def tree():
        s = S(40, 110)
        P.trunk(s, 20, 108, 96, tw=8, seed=670)
        return s

    def masonry():
        s = S(150, 90)
        SC.wall_block(s, 6, 24, 130, 66, 'brickr', 101, 1., 77)
        SC.slate_roof(s, [(4, 24), (20, 4), (120, 4), (138, 24)], 78, 102, .5)
        SC.cornice(s, 6, 24, 130, 103, 2.)
        SC.quoins(s, 6, 30, 50, 5, 104, 2.5)
        SC.quoins(s, 131, 30, 50, 5, 105, 2.5, right=True)
        s.finish()
        return s

    def planter_box():
        return P.planter()[0]

    def planter_tulips():
        return P.planter()[1][1]

    def stall_box():
        return P.stall(60, 400)[0]

    def stall_cloth():
        return P.stall(60, 400)[1][1]

    def boat():
        return P.houseboat(150, 300)[0]

    drawings = {
        'post': lambda: P.post(False),
        'post-far': lambda: P.post(True),
        'lamp': lambda: P.lamp(72),
        'bench': P.bench,
        'bike': lambda: P.bike('navy'),
        'crate': lambda: P.crate(20, 14),
        'stand': lambda: P.stand('HARING', 'navy'),
        'planter': planter_box,
        'tulips': planter_tulips,
        'flag-nl': lambda: P.flag_frames('nl')[2],
        'flag-city': lambda: P.flag_frames('city')[3],
        'flag-pole': lambda: P.flag_pole(76),
        'stall': stall_box,
        'stall-cloth': stall_cloth,
        'houseboat': boat,
        'smoke': lambda: P.smoke_frames()[3],
        'far-cyclist': lambda: P.far_cyclist('dred')[1],
        'tour-boat': P.tourboat,
        'waste-bin': P.waste_bin,
        'bike-rack': P.bike_rack,
        'hedge': lambda: P.hedge(70, 8, 3),
        'crown': lambda: P.crown(66, 58, 570, frame=1),
        'cloud': lambda: P.cloud_sprite(60, 16, 22),
        'house-step': lambda: P.house(50, 3, 'brickr', 'step', 41 * 7919 + 2, sh=18, gr=22, gh=22, doorm='dred'),
        'house-neck': lambda: P.house(46, 2, 'plastc', 'neck', 7922, sh=18, gr=22, gh=22, plastered=True),
        'house-bell': lambda: P.house(58, 3, 'brickn', 'bell', 2375 + 2, sh=18, gr=22, gh=22, side=8),
        'house-flat': lambda: P.house(42, 3, 'bricko', 'flat', 5, sh=18, gr=22, gh=22, doorm='navy'),
        'water': lambda: P.water_band(200, 119, 152, None, 51, frame=1),
        'cobbles': lambda: floor(P.cobbles, 166, 190, 61),
        'pavers': lambda: floor(P.pavers, 146, 162, 61),
        'kerb': lambda: floor(P.kerb, 190, 5, 62),
        'lane': lambda: floor(P.lane, 195, 209, 63),
        'gravel': lambda: floor(P.gravel, 166, 190, 64),
        'grass': lambda: floor(P.grass, 124, 150, 65),
        'sky': sky,
        'far': far,
        'trunk': tree,
        'masonry': masonry,
    }
    out = {}
    for name, fn in drawings.items():
        o = fn()
        c = np.asarray(o.c, np.int16)
        if u == 1:
            rec = {'w': int(o.w), 'h': int(o.h), 'sha': hashlib.sha1(c.astype('<i2').tobytes()).hexdigest()}
            if o.w * o.h <= 900:
                rec['ids'] = [int(v) for v in c.ravel()]
        else:
            a = hi.render(o, tb, seed=1000 + o.w * 7 + o.h)
            rec = {'w': int(a.shape[1]), 'h': int(a.shape[0]), 'sha': hashlib.sha1(a.tobytes()).hexdigest()}
        out[name] = rec
    return out


if __name__ == '__main__':
    if len(sys.argv) > 1:
        print(json.dumps(one(int(sys.argv[1]))))
    else:
        res = {}
        for u in (1, 2, 4):
            res[f'u{u}'] = json.loads(subprocess.check_output([sys.executable, os.path.abspath(__file__), str(u)]))
        with open(OUT, 'w') as f:
            json.dump(res, f, separators=(',', ':'))
        print('wrote', OUT, os.path.getsize(OUT))
