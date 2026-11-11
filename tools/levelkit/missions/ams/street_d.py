# The street of section d (STOPERA): the Waterlooplein flea market and the forecourt of the Stopera as one paved
# square (street.py: squares = the whole section), its ground in straight bands along the street and square borders
# across it. Called by street.apply after the lead's rules: fix(L, fl).
#
# The market (u < MARKET_U1), from the house fronts (depth 14) to the lower screen edge:
#   pave       d > 12.8           the house pavement (grey tiles) before the canal houses, into the alley mouths
#   kerb-far   10.1 .. 12.8       the granite kerb of the house pavement: lit top 11 .. 12.8, face 10.1 .. 11
#                                 (the back post row, the lamp at 310 and the city flag at 548 stand on its top)
#   fan        -12.4 .. 10.1      the market floor: setts laid in fans (stalls at 5, the hero, breakables at 0)
#   gutter     -14.0 .. -12.4     a granite gutter with drain grates (DRAINS)
#   cobbles    -21.5 .. -14.0     a strip of cobbles (kinderkopjes) along the market's front
#   kerb-near  -24.5 .. -21.5     the kerbstones of the market's edge (the front post row stands on them)
#   pave       d < -24.5          the front pavement (grey tiles; the decor bike rack stands on it)
# The granite band (MARKET_U1 .. FORE_U0): dark granite setts across the whole depth, the threshold of the forecourt.
# The forecourt (u >= FORE_U0): big pale slabs over the whole depth (no kerbs), dark granite bands every 176 px.
#
# far / near: the two kerb lines of the market (the gates of street.py measure the post rows against them); the
# square covers the section, so level.py paints no kerb of its own.
INF = 10 ** 9
MARKET_U1, FORE_U0 = 844, 860
FAR_K, NEAR_K = 11.0, -21.5            # the top edges of the far (house) kerb and of the market's front kerb
BACK_ROW, FRONT_ROW = 11.7, -23.0
RACK_D = -30.0                         # the decor bike rack at 330: on the front pavement, clear of the kerbstones
AREAS = [  # (u0, u1, far, near, kind)
    (-INF, MARKET_U1, 40.0, 12.8, 'pave'),
    (-INF, MARKET_U1, 12.8, 10.1, 'kerb-far'),
    (-INF, MARKET_U1, 10.1, -12.4, 'fan'),
    (-INF, MARKET_U1, -12.4, -14.0, 'gutter'),
    (-INF, MARKET_U1, -14.0, NEAR_K, 'cobbles'),
    (-INF, MARKET_U1, NEAR_K, -24.5, 'kerb-near'),
    (-INF, MARKET_U1, -24.5, -60.0, 'pave'),
    (MARKET_U1, FORE_U0, 40.0, -60.0, 'band'),
    (FORE_U0, INF, 40.0, -60.0, 'slabs'),
]
DRAINS = [(118, -13.2), (452, -13.2), (782, -13.2), (1004, -8.5), (1146, 4.0)]   # (u, depth): grates (gutter, forecourt)
FRONT_AT = [x for x in range(22, MARKET_U1 - 20, 72) if not 290 <= x <= 370 and abs(x - 820) > 12]  # even; none behind
#   the bike rack (330), none in line under the lamp at 820


def fix(L, fl):
    fl['far'], fl['near'] = FAR_K, NEAR_K
    fl['street'] = [dict(u0=-INF, kind='fan'), dict(u0=MARKET_U1, kind='granite'), dict(u0=FORE_U0, kind='stone')]
    fl['areas'] = [dict(u0=a, u1=b, far=f, near=n, kind=k) for (a, b, f, n, k) in AREAS]
    fl['drains'] = [list(p) for p in DRAINS]
    for d in L['decor']:
        if d['sprite'] == 'decor/ams/bike-rack' and d.get('front'):
            d['floorDepth'] = RACK_D
    for r in L['floor']['rows'] or []:
        if r.get('prop') != 'ams/pole':
            continue
        if r['name'].startswith('back'):
            r['depth'] = BACK_ROW                                   # (the game's list: every 34 px, gaps at the lamp and the flag)
        else:
            r['depth'] = FRONT_ROW
            r['at'] = list(FRONT_AT)
