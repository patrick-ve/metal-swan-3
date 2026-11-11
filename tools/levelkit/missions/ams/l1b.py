# Section b of level 1: MUSEUMPLEIN at noon, in the canal look.
#
# Scene card
#   Place     the street to the museum (0-380), THE PASSAGE through the Rijksmuseum (400-720), the Museumplein with the
#             long pool and the hot-dog trailer (720-2200), the canal road toward the Amstel (2200-3072).
#   Hour      noon, clear (HOURS['noon']): high white light, short blue shade. Spring leaves, tulips in bloom.
#   Key hue   sky blue (the sky, the far air, the mirror in the pool).
#   Set piece the Rijksmuseum front with its cycle passage (box 482 x 176 at the facade depth 14; the passage roof is
#             the terrain's solid 84-96, drawn as a slab that turns with the camera, its lower edge at y 96).
#   Water     still water with a mirror (the long pool: the floor's water is clear and a mirror layer at the far speed
#             shows through it, so the museum's back stays mirrored under itself); the canal in front of the canal road.
#   Planes    sky 0 · clouds 0.03 · skyline 0.10 · far 0.40 (the museum's back over the lawn, villas, plane trees, a
#             tram) · lawn rows 0.40 -> 0.741 · mirror 0.40 · floor rows 0.741 -> 1.345 · decor planes at their depths.
#   Local     the hot-dog trailer, the tulip stall, the herring cart, tulip planters and beds, the lawn chains, flags,
#             benches, crown lanterns and grey lamps, the electrical cabinet, bike racks, Amsterdammertjes.
#   Scale     the scenery scale (SCALE-BRIEF.md): 13 px per metre x the plane's speed, a storey 40 s. Houses and the
#             museum front at depth 14 (s 0.88): storey 35, ground floor 47-48; the far side (s 0.40): storey 16; the
#             skyline (s 0.10): storey 4. The Rijksmuseum 30 m to the ridge, towers 60 m: the front shows its passage,
#             mezzanine and main floor up to the frieze at the top edge; the back shows its storeys, the cornice, the
#             first row of dormers and the tower clocks. Elms 16.8 m, lamps and flags at the scale of their planes.
#   Rules     posts on kerbstones only; the vault bottom at y 96 in the walk plane; no game shape moves.
from parts_l1b import *
from level import GAME
from game_sprites import entity, sprites

# The fidelity cameras of the game bake (bake_game.py; docs/api/canal.md §2): (camera x, crop centre x) — the first
# screen, the passage (mouth, vault, roof), the square with the stand and the stall, the pool and the plein, the lawn
# chains, the paved corner and the canal road with the herring cart, the last screen.
GAME_CAMS = [(0, 192), (330, 250), (560, 130), (800, 160), (1200, 250), (1560, 192), (2050, 260), (2240, 150),
             (2500, 192), (2688, 300)]

NOTE = ("Noon on the Museumplein, with the houses and the museum at the scale of the hero (a storey is about as tall "
        "as he is). The Rijksmuseum front carries the passage: its roof is a slab that turns with the camera, over it "
        "the tall main floor with banners and a tile tableau. Over the lawn the museum's back fills the sky to its "
        "dormers and tower clocks, mirrored in the long pool.")

SP_FAR = 0.40
ELM_LEAF = 'leaf'                 # the kit's leaf ramp (a knob: a lime ramp raises the key hue share, see the report)
HOUSE_AIR = 0.20                  # the air of the facade plane (depth 14): raised from 0.07 (lead review, as in section a)
FAR_AIR = dict(air_g=0.30, air_v=0.56)
MUSEUM_FOOT, MUSEUM_AIR = 123, 0.50      # the museum plane (SM 0.18): its foot, its air (skyline 0.74, far 0.30-0.56)
OPEN_W = 440                              # the open end of the square on the far side (no villas)
# The game's window wavers (section-b.ts life(): x, feet y; drawn at the facade's depth 14, unscaled): their framed
# window must sit in the front, not on a wall or a house edge (house_front `wavers`, waver_opening).
WAVERS = [(2330, 104), (2700, 96)]
YH, YQ = 127, 131
# The street fronts TILE on their plane (tmp/l1/port/HOUSE-FIT-BRIEF.md): the game's house boxes stand at depth 14
# (s 0.879), so two boxes dx apart are only dx * 0.879 apart on the plane, and a front painted at its box's width ran
# 9-13 px under the next one. Each row is laid out again on the plane: it starts at its first box's left edge (the
# corner house and its flank keep their place), each front gets its own width below and the next front starts where
# it ends, so the row ends where it ended before. Two window columns from 42 px, three from 53 px (house(): ncol by
# width); the shops get the wide fronts (KAAS, KOFFIE: three columns), the low cornice fronts too. The two wavers sit
# centred on a window column of one front: BOEKEN (2325) ends at 2084, so its right column is under the waver of
# 2330; the red neck front (2679) ends at 2409, so its right column is under the cat of 2700.
FRONT_W = {31: 53, 87: 43, 133: 43, 183: 54, 235: 43,
           2227: 44, 2277: 43, 2325: 46, 2377: 46, 2427: 43, 2479: 54, 2535: 42, 2581: 43, 2629: 53, 2679: 44,
           2725: 42, 2779: 53, 2835: 42, 2887: 47, 2943: 43, 2993: 43}


def house_rows(sec):
    """The street rows of the game's house boxes on their plane: [[(x, depth, p0, w), …], …] in game x order. A row
       starts at its first box's left edge on the plane (rounded to a whole px) and its fronts follow one another at
       their FRONT_W widths, so they tile: front j owns p0_j .. p0_j + w_j = p0_{j+1}. A box more than 16 px past the
       row's end on the plane starts a new row (the passage, the square)."""
    hs = sorted((d for d in sec.L['decor'] if d['sprite'] == 'decor/ams/house-noon' and d['floorDepth'] is not None),
                key=lambda d: d['x'])
    rows, end = [], None
    for d in hs:
        s = s_d(d['floorDepth'])
        b0 = sec.at(d['x'], s) - d['box']['ox']
        if end is None or b0 > end + 16:
            rows.append([]); end = int(round(b0))
        w = FRONT_W[int(d['x'])]
        rows[-1].append((d['x'], d['floorDepth'], end, w))
        end += w
    return rows


def build():
    sec = Sec('b', 'Museumplein', 'noon')
    PAINTED.clear()
    # level.py's floor painter indexes a ramp with floats in its 'tiles' branch (it raises); this section paints the
    # square's tiles itself (floor_extra), so its floor gets a copy of the layout with that stretch renamed.
    sec.fl = dict(sec.fl)
    sec.fl['street'] = [dict(e, kind='tiles_b') if e['kind'] == 'tiles' else e for e in sec.fl['street']]
    rng = random.Random(23)
    KEY, AIR = sec.KEY, sec.AIR
    # ---- sky, clouds (fair-weather cumulus), the skyline of the town
    S, CL = sky_layers(sec, cloud_boxes=[(20, 22, 120, 40, 11), (300, 44, 90, 30, 12), (470, 14, 140, 46, 16), (170, 92, 80, 18, 13),
                                         (580, 90, 90, 20, 15)])

    def extra_sky(SK):                                            # towers 80 m, a dome 38 m, trees 15 m (s 0.10)
        for (tx, kind) in ((70, 'tower'), (300, 'dome'), (520, 'tower')):
            t = tower(int(round(m_px(80, 0.10)))) if kind == 'tower' else dome_church(44, int(round(m_px(38, 0.10))))
            SK.blit(t, tx, 116 - t.h)
        tree_band(SK, 0, SK.w, 119, int(round(m_px(15, 0.10))), 'leaf', 5)
    SK = skyline_b(sec, speed=0.10, yb=116, extra=extra_sky, seed=5, air=0.74)
    # ---- the far side over the lawn
    WF = sec.lw(SP_FAR)
    M = museum_back(SM, seed=9)                                  # the museum's back on its own plane, over the pool
    MP = museum_plane(sec, M, MUSEUM_FOOT, MUSEUM_AIR)
    MX = int(round(sec.at(1490, SP_FAR) - OPEN_W / 2))           # the open end of the square on the far side
    F = far_plein(sec, rng, WF, YH, YQ, MX, OPEN_W, KEY, AIR, **FAR_AIR)
    sec.add('far', F, SP_FAR)
    s146 = float(s_y(BACKY))
    lawn = lawn_rows(sec, YQ, BACKY, SP_FAR, s146, KEY, AIR, sec.H['curve'])
    sec.add('lawn', None, SP_FAR, y=YQ, kind='rows', frames=[lawn], s0=SP_FAR, s1=s146)
    # ---- the mirror in the pool (it scrolls with the far side; the floor's pool water is clear over it)
    src = flatten([(S, 'tilex'), (CL, 'tilex'), (SK, 'stretch'), (MP, 'stretch'), (F, 'copy')], WF, YQ)
    mir = mirror(src, YQ - 1, 14, (110, 160, 178), (60, 112, 132), seed=15, k=6.0, ncol=40, mix0=0.10, mix1=0.40,
                 wob=(0.15, 0.7), wfreq=1.5)
    sec.add('mirror', None, SP_FAR, y=150, kind='frames', frames=mir)
    # ---- the decor of the game on the floor
    rest = standard_decor(sec, rng, skip=('decor/ams/lamp-grey', 'decor/ams/elm', 'decor/ams/lamp', 'decor/ams/flag-ams',
                                          'decor/ams/flag-nl'))
    hn = 0
    FIT = {int(x): (p0, w) for row in house_rows(sec) for (x, dep, p0, w) in row}
    PAINTED['fronts'] = []
    for d in rest:
        sid, x, dep = d['sprite'], d['x'], d['floorDepth']
        if dep is None:
            continue
        s = s_d(dep)
        if sid == 'decor/ams/house-noon':
            p0, w = FIT[int(x)]                                  # the front's slot on its plane (house_rows)
            box = dict(d['box'], w=w)
            wv = [(sec.at(xw, s) - WAVER_W / 2.0 - p0, 202 - yw) for (xw, yw) in WAVERS
                  if p0 + 2 <= sec.at(xw, s) - WAVER_W / 2.0 and sec.at(xw, s) + WAVER_W / 2.0 <= p0 + w - 2]
            H = house_front(random.Random(1000 + int(x)), box, d.get('frame', 0), seed=400 + hn * 13, s=s, wavers=wv); hn += 1
            k = sec.put(aired(H, AIR, dep, per=HOUSE_AIR / 14.0), x, dep, ax=sec.at(x, s) - p0, shade=False)
            sec.shades.append((192 + (p0 + H.w / 2.0 - 192) / s, k, H.w / 2.0, H.h))
            PAINTED['fronts'].append((int(x), p0, H.w, [xw for (xw, yw) in WAVERS
                                                        if (sec.at(xw, s) - WAVER_W / 2.0 - p0, 202 - yw) in wv]))
            if SB.PATH1 < x < SB.PATH1 + 80:                     # the corner house at the paved corner: its side wall
                house_flank(sec, AIR, 192 + (p0 - 192) / s, H, d['box'], d.get('frame', 0), s=s, d0=int(dep),
                            per=HOUSE_AIR / 14.0)
        elif sid == 'decor/ams/elm':
            sec.put(aired(elm_b(int(x) + 3, s, leaf=ELM_LEAF), AIR, dep), x, dep)
        elif sid == 'decor/ams/rijksmuseum':
            sec.put(aired(rijks_front(), AIR, dep, per=HOUSE_AIR / 14.0), x, dep, ax=d['box']['ox'])
        elif sid == 'decor/ams/hotdog-stand':
            sec.put(hotdog_stand(), x, dep, ax=d['box']['ox'])
            if GAME:                 # the game's vendor draws the box under the hatch over himself (AmsHotdogVendor.draw):
                F = hotdog_stand()   # the kit's stand from its counter ledge down, on the stand's own box (84 x 62)
                F.a[:P(33)] = 0
                entity(sec, 'decor/ams/hotdog-front', F, x, dep, ax=d['box']['ox'], shade=False)
        elif sid == 'decor/ams/lamp-grey':                       # the lamps at the scale of their plane
            h = int(round(LAMP_GREY_H * s)); PAINTED.setdefault('lamps', []).append(('grey', round(s, 3), h, LAMP_GREY_H * s))
            sec.put(grey_lamp(h), x, dep, ax=7.5)
        elif sid == 'decor/ams/lamp':                            # kerbside: the game's own 72 px (a gull perches at 70)
            h = LAMP_H; PAINTED.setdefault('lamps', []).append(('crown', round(s, 3), h, LAMP_H))
            sec.put(lamp(h), x, dep)
        elif sid in ('decor/ams/flag-ams', 'decor/ams/flag-nl'):
            h = int(round(FLAG_H * s)); PAINTED.setdefault('flags', []).append((round(s, 3), h))
            sec.put(flag_pole('ams' if sid.endswith('ams') else 'nl', h, phase=x * 0.01), x - 2 + 1, dep, ax=1)
        elif sid == 'decor/ams/cabinet':
            sec.put(cabinet(), x, dep, front=True)
    # the breakables of the script, intact at their spawn x
    # (game: the entities ams-tulip-stall / ams-herring-cart; their intact frame 0 shows these paintings)
    entity(sec, 'decor/ams/ams-tulip-stall', tulip_stall(random.Random(7)), 900, 0)
    entity(sec, 'decor/ams/ams-herring-cart', herring_cart(random.Random(8)), 2340, 0)
    # the passage roof and its piers; the lawn chains
    passage_roof(sec, pier_front=7)                                # the piers stand on the pavement behind the kerb top
    museum_flanks(sec, AIR)
    for r in rows_of(sec, 'lawn chains'):
        lawn_chains(sec, r)
    # ---- the floor (pool clear over the mirror), then the planes
    fl = floor_layer(sec, extra=floor_extra(sec))
    pool_clear(sec, fl)
    floor_air(sec, fl, 0.16, 168)
    sec.flush()
    return sec


def checks(sec):
    out = []
    N = None
    for l in sec.layers:
        if l.get('depth') == 0 and not l.get('front'):
            N = l['img']
    # the vault bottom at y 96 in the walk plane: art on rows 84-96 over the passage, nothing just under it
    xs = np.arange(404, 716, 3)
    on = [bool(N.a[P(95.5), P(x), 3]) for x in xs]
    off = [not N.a[P(96) + 1:P(99), P(x), 3].any() for x in xs]
    out.append(('passage roof: art down to y 96, clear under it (walk plane)', all(on) and all(off), '%d/%d, %d/%d' % (sum(on), len(xs), sum(off), len(xs))))
    # Amsterdammertjes on kerbstones: back rows on the far kerb, front rows on the granite strip at the near kerb
    fl = sec.fl
    bad = []
    for r in sec.L['floor']['rows'] or []:
        if r.get('prop') != 'ams/pole':
            continue
        for x in row_at(sec, r):
            dF = float(pl(fl['far'], [x])[0]); dN = float(pl(fl['near'], [x])[0])
            dd = r['depth']
            ok = (abs(dd - dF) <= 1.7) if dd > 0 else (-24.8 <= dd <= dN and (x < SB.SQ0 or x >= SB.LANE1))
            if not ok:
                bad.append(int(x))
    out.append(('Amsterdammertjes on kerbstones only', not bad, ', '.join(map(str, bad)) or 'ok'))
    out += front_checks(sec)
    out += scale_checks()
    return out


def front_rows():
    """Every house row of the section as painted: (plane, [(left edge, painted width), …]) from the numbers the
       painters used (PAINTED): the street rows of the game's house boxes (depth 14), the villas of the far side
       (house_row), the roofs beside the museum and the skyline (far_roofs_b)."""
    pt = PAINTED
    out = []
    st, row, last = [], None, None
    for (x, p0, w, wv) in pt['fronts']:                                  # paint order = game x order
        if last is None or p0 > last + 16:
            row = []; st.append(row)
        row.append((p0, w)); last = p0 + w
    out += [('street d14 (s 0.879)', r) for r in st]
    out += [('far villas (s 0.40)', r) for r in pt['villas']['rows']]
    out += [('museum roofs (s 0.18)', r) for r in pt['museum_roofs']['rows']]
    out += [('skyline (s 0.10)', r) for r in pt['skyline']['rows']]
    return out


def front_checks(sec):
    """The rule of the house fit (tmp/l1/port/HOUSE-FIT-BRIEF.md): on one plane the fronts of a row tile, no front
       hides a part of another; each window waver lies whole inside one front (2 px clear of its party lines)."""
    ov = []
    for (name, r) in front_rows():
        for (a, b) in zip(r, r[1:]):
            ov.append(a[0] + a[1] - b[0])
    mx = max(ov)
    out = [('house fronts tile: no front hides another (max overlap 0 px)', mx <= 0,
            'max overlap %g px, max gap %g px over %d party lines' % (max(0, mx), max(0, -min(ov)), len(ov)))]
    hits = {xw: [x for (x, p0, w, wv) in PAINTED['fronts'] if xw in wv] for (xw, yw) in WAVERS}
    ok = all(len(v) == 1 for v in hits.values())
    out.append(('window wavers: each whole in one front (2 px clear of its edges)', ok,
                ', '.join('%d on %s' % (xw, '/'.join(map(str, v)) or '-') for xw, v in hits.items())))
    return out


def scale_checks():
    """The scale rule (SCALE-BRIEF.md): one entry per building plane, measured from the parameters the painters
       used (PAINTED), and one per landmark; trees, lamps and the tram too."""
    pt = PAINTED
    out = []
    near = lambda v, t, tol=0.15: abs(v - t) <= tol * t
    sk = pt['skyline']; t = 40 * sk['s']
    out.append(('storey on skyline (s=%.2f): %.1f px, target %.1f +-15%%' % (sk['s'], sk['storey'], t), near(sk['storey'], t), sk['storey']))
    v = pt['villas']; t = 40 * v['s']
    out.append(('storey on far, villas (s=%.2f): %.1f px, target %.1f +-15%%' % (v['s'], v['storey'], t), near(v['storey'], t),
                'gf %d, fronts %d-%d px high, %d-%d wide' % (v['gf'], v['hmin'], v['hmax'], v['wmin'], v['wmax'])))
    b = pt['back']; t = 40 * b['s']
    out.append(('storey on museum, its back (s=%.2f): %s px, target %.1f +-15%%' % (b['s'], '/'.join('%.1f' % x for x in b['storeys']), t),
                all(near(x, t) for x in b['storeys']), 'gf %.1f, windows %.1f wide' % (b['gf'], b['win_w'])))
    mr = pt['museum_roofs']; t = 40 * mr['s']
    out.append(('storey on museum, roofs beside it (s=%.2f): %.1f px, target %.1f +-15%%' % (mr['s'], mr['storey'], t), near(mr['storey'], t),
                'trees %d px (16 m)' % pt['museum_plane']['trees']))
    hs_ = pt['houses']; s14 = hs_[0][0]; t = 40 * s14
    sts = sorted(set(round(h[1], 1) for h in hs_))
    out.append(('storey on d14, canal houses (s=%.2f): %s px, target %.1f +-15%%' % (s14, '/'.join(map(str, sts)), t),
                all(near(x, t) for x in sts), '%d fronts, %s upper storeys' % (len(hs_), '/'.join(sorted(set(str(h[3]) for h in hs_))))))
    f = pt['front']; t = 40 * f['s']
    out.append(('storey on d14, museum front (s=%.2f): %s px, target %.1f +-15%%' % (f['s'], '/'.join(map(str, f['storeys'])), t),
                all(near(x, t) for x in f['storeys']), 'gf %d, windows %d wide' % (f['gf'], f['win_w'])))
    out.append(('Rijksmuseum front 30 m at s=%.2f: %d px to the ridge, towers 60 m: %d px' % (f['s'], f['ridge'], f['tower']),
                abs(f['ridge'] - m_px(30, f['s'])) < 1 and abs(f['tower'] - m_px(60, f['s'])) < 1, 'the screen shows its lower 162 px'))
    out.append(('Rijksmuseum back 30 m at s=%.2f: %.0f px to the ridge, towers 60 m: %.0f px' % (b['s'], b['ridge'], b['tower']),
                abs(b['ridge'] - m_px(30, b['s'])) < 1 and abs(b['tower'] - m_px(60, b['s'])) < 1,
                'eaves %.0f px (18 m), %.0f px wide, foot y %d, air %.2f' % (b['eaves'], b['width'], pt['museum_plane']['foot'], pt['museum_plane']['air'])))
    el = pt['elms']
    out.append(('elms 16.8 m at their planes: %s' % ', '.join('%d px at s=%.2f' % (h, s) for (s, h, w) in sorted(set(el))),
                all(abs(h - ELM_H * s) < 1 for (s, h, w) in el), len(el)))
    ft = pt['far_things']
    out.append(('far trees 14-18 m at s=0.40: %d-%d px' % ft['trees'], m_px(14, 0.4) - 1 <= ft['trees'][0] and ft['trees'][1] <= m_px(18, 0.4) + 1,
                'lamps %d px (5 m), cars %s px long' % (ft['lamp'], '%d-%d' % ft['cars'] if ft['cars'] else '-')))
    tr = pt['tram']
    out.append(('far tram 30 m at s=%.2f: %d px long, %d px high' % tr, abs(tr[1] - m_px(30, tr[0])) < 1, 'five sections'))
    lp = pt['lamps']
    out.append(('lamps (crown: the game 72 px; grey 84 x s): %s' % ', '.join(sorted(set('%s %d px at s=%.2f' % (k, h, s) for (k, s, h, t) in lp))),
                all(abs(h - t) < 1 for (k, s, h, t) in lp), len(lp)))
    return out


if __name__ == '__main__':
    import time
    t0 = time.time()
    sec = build()
    print('build %.1f s' % (time.time() - t0))
    preview_b(sec, cams=(0, 700, 840, 1300, 380, 1660, 2150, 2688))
