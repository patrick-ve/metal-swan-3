# Mission `sewers` (level 2, RATTENJONG MET DE RATTENITEMS) for the level kit: the tables the shared core reads
# (tools/levelkit/README.md "Add a mission"), the kit-side floor of every section, and the lit-stack convention of the
# sewer sections. Spec: docs/design/sewers.md (§2 the sections, §6 the look); look sheet docs/design/sewers/look-sheet.md.
#
# Folder map (wave P4a, 2026-11-12):
#   mission.py        this file: ID, SECTIONS, HOURS, KEY_SHARE, the kit floor (FLOOR), STREET, PAGE, bake folders,
#                     the lit stacks (LIT, two_stacks)
#   parts_sewers.py   the sewer painters (vault, far wall, channel, walkway, shafts, eyes, fatberg): the APPROVED look
#                     sample's parts, shared with missions/sewers-look/ (do not change their numbers)
#   parts_wallen.py   the street painters of a, b and end (wet De Wallen at night, rain, the dawn street)
#   checks_sewers.py  the rules of the place as gate functions; the painters call them in checks(sec)
#   parts_sheet.py    every street part alone, one sheet per family: tmp/sewers/p4/shared/<family>-u<U>.png
#   blk_a.py          the block-out of a's first two screens (wave P4a; the painter of a replaces it with sw_a.py)
#   dump_lazy.mts     the layout dump for this LAZY mission (tools/levelkit/dump.ts alone does not load it)
#   sw_a.py .. sw_end.py   the section modules (the five painters, wave P4b)
# The approved look sample (section d in V2 BLACK, its stub layout, look.py, cost.py) is the separate pseudo-mission
# missions/sewers-look/ (its own commands in its mission.py head).
#
# Commands (repo root; U = 1, 2 or 4; one tier-4 build at a time):
#   npx tsx tools/levelkit/missions/sewers/dump_lazy.mts sewers --prefix decor/sewers --prefix prop/sewers \
#       --prefix boss/sewers-gerrit/limo --prefix vehicle/          # 1. the dump: work/sewers/layout.json
#   U=1 python3 tools/levelkit/lk.py sewers preview blk_a           # previews: work/sewers/out/l1blk-a-*-u1.png
#   U=1 python3 tools/levelkit/lk.py sewers check blk_a             # the gates (no names: SECTIONS, all six needed)
#   U=1 python3 tools/levelkit/lk.py sewers run parts_sheet         # the parts sheets (tmp/sewers/p4/shared/)
#   U=1 python3 tools/levelkit/lk.py sewers check sw_c_lit          # a lit stack's gates (see LIT below)
#   for U in 1 2 4; do U=$U python3 tools/levelkit/lk.py sewers export; done; ... pack; ... page    # the page
#   for U in 1 2 4; do U=$U python3 tools/levelkit/lk.py sewers bake sw_c sw_c_lit; done            # P6 (both stacks)
#
# The layout: the dump has NO floor for any section (the game's sewers sections have no `floor:`; the perspective floor
# is art only). The kit paints the floor from the numbers of FLOOR below: on import this file writes
# work/sewers/layout-kit.json (the dump + FLOOR + DECOR_DEPTH + the lit aliases) and points LAYOUT at it. P6 mirrors
# these numbers in the game (a sewers floor.ts with the same kerbs, street kinds and decor depths) when it ports.
import json
import os

from street import INF, FAR, NEAR       # noqa: F401  (the straight street's constants, core/street.py)

ID = 'sewers'

# The section modules in page and check order (check / export with no names need all six files).
SECTIONS = ['sw_a', 'sw_b', 'sw_c', 'sw_d', 'sw_e', 'sw_end']

# ---------------------------------------------------------------- the lit stacks of the sewer (c, d, e)
# A sewer section is painted twice with the same layers and geometry (docs/design/sewers.md §5.1): the AMBIENT stack
# (the hour c / d / e) and the LIT stack (cl / dl / el: what the flashlight shows). The lit stack has its own section id
# '<section id>-lit' (an alias of the section in layout-kit.json, so the bake writes a separate canal scene). The
# section module paints once, in paint(sid, hour, lit), and gets its build from two_stacks:
#
#     from mission import two_stacks
#     def paint(sid, hour, lit): sec = Sec(sid, NAME, hour); ...; return sec
#     build = two_stacks('sewers-c', paint)        # build() = ambient; build('lit') or LK_LIGHT=lit = the lit stack
#
# and a two-line module sw_c_lit.py for the lit stack's gates and bake:
#
#     from sw_c import *                           # noqa: F401,F403
#     def build(): import sw_c; return sw_c.build('lit')
LIT = {'sewers-c': ('c', 'cl'), 'sewers-d': ('d', 'dl'), 'sewers-e': ('e', 'el')}
LIT_SUFFIX = '-lit'


def two_stacks(sid, paint):
    """build(light=None) for a sewer section: 'amb' (default, or LK_LIGHT) paints the ambient stack under `sid` and
       its ambient hour; 'lit' paints the lit stack under '<sid>-lit' and the lit hour (mission.LIT)."""
    amb_hour, lit_hour = LIT[sid]

    def build(light=None):
        light = light or os.environ.get('LK_LIGHT', 'amb')
        if light not in ('amb', 'lit'):
            raise SystemExit('LK_LIGHT must be amb or lit, not %r' % light)
        lit = light == 'lit'
        return paint(sid + LIT_SUFFIX if lit else sid, lit_hour if lit else amb_hour, lit)
    build.__doc__ = 'The %s section: build() the ambient stack, build("lit") the lit stack (%s).' % (sid, sid + LIT_SUFFIX)
    return build


# ---------------------------------------------------------------- the page
PAGE = dict(
    title='Rattenjong',
    sections=[('sewers-a', 'De Wallen', '23:00 rain'), ('sewers-b', 'De Steegjes', '01:00 rain'),
              ('sewers-c', 'De Put', '01:30'), ('sewers-c-lit', 'De Put', 'flashlight'),
              ('sewers-d', 'Het Riool', '02:30'), ('sewers-d-lit', 'Het Riool', 'flashlight'),
              ('sewers-e', 'De Afvalhal', '05:00'), ('sewers-e-lit', 'De Afvalhal', 'flashlight'),
              ('sewers-end', 'Dageraad', '07:15')],
    header='<h1>Rattenjong</h1><p>Level 2, RATTENJONG MET DE RATTENITEMS: De Wallen by night in the autumn rain, the '
           'alleys and the church square, the fall down the burst drain, the sewer in V2 BLACK, the trash hall, and the '
           'dawn after the rain. Every section scrolls on the game\'s own layout. Vincent is the game\'s sprite at its '
           'own size.</p>',
    route='a: the quay, 3,072 px · b: the alleys and the square, 2,560 · c: the shaft and the first tunnel, 1,920 · '
          'd: the sewer, 2,816 · e: the trash hall, 1,280 · end: the dawn, 384.')

# ---------------------------------------------------------------- the bake (Phase 6)
ART = 'public/art/sewers'
MANIFEST_DIR = 'src/game/content/missions/sewers/canal'
FIXTURES = 'tests/fixtures/canal/sewers'

# ---------------------------------------------------------------- the key hue share each hour needs (check_level.py)
# a / b: the night blue rules, the neon red takes its share (measured on blk_a: see the P4a report); c, d, e: V2 BLACK as
# approved; the lit stacks: the warm flashlight key (as the sample's v2l); end: the dawn's cold blue-pink.
KEY_SHARE = {'a': 0.45, 'b': 0.45, 'c': 0.45, 'd': 0.45, 'e': 0.45, 'cl': 0.30, 'dl': 0.30, 'el': 0.30, 'end': 0.45}

# ---------------------------------------------------------------- the hours
# The sewer: V2 BLACK, exactly the approved numbers of missions/sewers-look/mission.py (v2, v2l, EM_V2, LIGHTS_V2).
# checks_sewers.same_as_sample() compares them with the sample's file (a gate of every sewer section).
EM_V2 = dict(shaft=[(214, 222, 236), (164, 176, 198), (120, 132, 158), (82, 92, 118)],
             grate=[(250, 216, 230), (206, 168, 190)],
             glow=[(16, 70, 46), (34, 140, 80), (100, 230, 120)],
             eye=[(255, 246, 160), (255, 48, 32), (170, 10, 22)])
_LIT = dict(KEY=((26, 18, 14), (255, 240, 214), 0.24, 0.0), AIR=((34, 30, 30), (150, 136, 120)), air=0.10)
LIGHTS_V2 = dict(shaft=0.42, shaft_w=(8.0, 14.0), mshaft=0.30, mshaft_w=(6.0, 10.0), halo=(0.10, 0.0), halo_r=(12.0, 8.0),
                 wall=(0.06, 0.0), walk=(0.12, 0.06), mwall=(0.06, 0.0), mwalk=(0.16, 0.08), rungs=False,
                 pool=0.24, pool_r=(6.0, 3.5), streak=0.20, glints=0.80, spill=(0.12, 0.06))
# e: the trash hall at 05:00 under the cracking canal roof: V2 BLACK's tables plus the cold grey light from the cracks
# (an emitter family of its own: light core -> deep; the painter of e uses it for the crack light, its pools and the
# falling water); the flashlight's lit key as c and d.
EM_E = dict(EM_V2, crack=[(214, 220, 230), (168, 176, 192), (122, 130, 150), (84, 90, 110)])


def _hour(KEY, AIR, em, air, glow=0.58, **kw):
    d = dict(KEY=KEY, AIR=AIR, em=em, air=air, glow=glow, curve=(1.0, 1.0), shadow=(6, 8, 10), shade=(0.66, 0.70, 0.80),
             cast=(0.0, 0.0), sky=[(0, '#000000'), (1, '#101010')], cloud=('#000000',) * 6, water=((10, 20, 20), (4, 8, 8)),
             fg=((2, 4, 6), (60, 60, 56), 0.90, 0.3), sun=(0, 0))
    d.update(kw)
    return d


_V2 = lambda em: _hour(((2, 3, 12), (42, 56, 98), 0.93, 0.30), ((8, 12, 26), (40, 50, 80)), em, 0.30, glow=0.90,
                       lights=LIGHTS_V2, fg=((0, 0, 4), (40, 44, 60), 0.94, 0.4))
_V2L = lambda em: _hour(_LIT['KEY'], _LIT['AIR'], em, _LIT['air'], lights=LIGHTS_V2, fg=((10, 8, 6), (150, 130, 110), 0.70, 0.1))

# The street (a, b, end). Fields beyond the core's: `night` (the neon and the red rooms are on), `rain` (the colours
# of the streaks: far, near, and a glint), `wet` (how much the ground mirrors: 0 dry .. 1 a film of water), `neon`
# (the strength of the neon light on surfaces), `cloudy` (the low cloud deck's tones, lit from below by the city).
HOURS = {
    # a 23:00, the quay of the Oudezijds Achterburgwal, late October, steady drizzle. From the canal study's De Wallen
    # night (canal-look.md §3.2, d: key (8,8,34)-(128,142,214) .88 .15, air (20,16,56)-(112,76,150)) with the rain:
    # a low cloud deck lit violet-pink by the city instead of stars and a moon, the air greyer and wetter (more desat),
    # the far side a little more in the air.
    'a': dict(KEY=((8, 8, 32), (124, 138, 206), 0.88, 0.20), AIR=((24, 20, 58), (110, 82, 146)),
              sky=[(0, '#04061a'), (0.40, '#0c1032'), (0.70, '#1a1844'), (0.88, '#30204e'), (1, '#4a2858')],
              cloud=('#0a0c28', '#121434', '#1c1a42', '#2a2250', '#3c2a5c', '#56346a'),
              water=((26, 22, 66), (8, 8, 32)), shadow=(12, 10, 36), cast=(0.0, 0.0), shade=(0.62, 0.62, 0.80),
              fg=((6, 4, 24), (88, 66, 128), 0.94, 0.2), curve=(1.04, 1.0), sun=(0, 0),
              night=True, rain=((92, 96, 150), (150, 156, 206), (206, 212, 240)), wet=0.85, neon=1.0, far_air=0.12),
    # b 01:00, the alleys and the church square: the same neon, colder and darker (the key darker and bluer, more desat);
    # the alleys get one warm wall lamp per stretch (an emitter, EM).
    'b': dict(KEY=((4, 6, 26), (100, 118, 186), 0.90, 0.26), AIR=((16, 18, 48), (84, 80, 132)),
              sky=[(0, '#020414'), (0.40, '#080c2a'), (0.70, '#12143a'), (0.88, '#221c46'), (1, '#36224e')],
              cloud=('#06081e', '#0c0e2a', '#141636', '#1e1c42', '#2c224e', '#3e2a5a'),
              water=((20, 20, 56), (6, 6, 26)), shadow=(8, 8, 30), cast=(0.0, 0.0), shade=(0.60, 0.60, 0.78),
              fg=((4, 4, 20), (70, 60, 112), 0.95, 0.2), curve=(1.04, 1.0), sun=(0, 0),
              night=True, rain=((76, 82, 136), (134, 142, 194), (196, 204, 236)), wet=0.80, neon=0.90, far_air=0.16),
    # c, d: V2 BLACK exactly; their lit hours = v2l
    'c': _V2(EM_V2), 'cl': _V2L(EM_V2),
    'd': _V2(EM_V2), 'dl': _V2L(EM_V2),
    # e: V2 BLACK's tables and the crack light; el: the flashlight's lit key
    'e': _V2(EM_E), 'el': _V2L(EM_E),
    # end 07:15, dawn after the rain, a quiet street far from the centre: the canal study's daylight method (paint in
    # daylight, one key, the air), the key a cold pale blue-pink, low and soft (no hard cast shade: wet, overcast
    # breaking up), the sky pale pink at the horizon over cold blue. No neon, no red rooms (night=False).
    'end': dict(KEY=((50, 54, 96), (244, 228, 236), 0.40, 0.14), AIR=((118, 126, 172), (238, 214, 226)),
                sky=[(0, '#34467e'), (0.36, '#5e78b0'), (0.64, '#a4b0d4'), (0.84, '#e2c4d2'), (1, '#f6d6d4')],
                cloud=('#6a6e9c', '#8a88b0', '#ac9ebe', '#ccb2c8', '#e6c6d0', '#f8dede'),
                water=((104, 110, 150), (46, 52, 84)), shadow=(56, 58, 94), cast=(0.10, 0.06), shade=(0.70, 0.70, 0.86),
                fg=((22, 22, 46), (160, 150, 170), 0.52, 0.3), curve=(1.06, 1.02), sun=(0.16, 0.10),
                night=False, rain=None, wet=0.55, neon=0.0, far_air=0.30),
}

# ---------------------------------------------------------------- the kit floor of every section (kit-side numbers)
# depth = px behind the walk line (y = 176 - depth); the floor runs from depth 30 (y 146) to the lower edge.
#   a    the quay street: the cobbled lane between straight kerbs at 5 and -16.3 (core/street.py), the quay pavement
#        behind the far kerb (5 .. 27, wet klinkers: the krul, the tree, lamps, bikes stand here), the coping 27 .. 30,
#        the canal behind it (water rows from the far quay's foot, y 120, to y 146); the near pavement in front.
#   b    0 .. 1,280 the alleys: cobbles over the whole band to the far wall (depth 6, y 170: the game's alleyBack),
#        a central gutter at depth -6 (painted by the painter of b; the gutter grates sit in it); 1,280 .. 1,536 the
#        alley mouth; 1,536 .. 2,560 the church square (paved, back edge depth 26, y 150: the game's squareBack).
#        No kerbs (no STREET rules: the alleys have no kerb).
#   c d e   the sewer: the near walkway and the channel are painted by parts_sewers (walkway_px, channel_layers); the
#        core floor is not used (a stub: no kerbs, one kind).
#   end  a quiet street far from the centre: brick klinkers, straight kerbs at 5 and -16.3, the pavement behind.
FLOOR = {
    'sewers-a': dict(far=FAR, near=NEAR, street=[(-INF, 'cobbles')], quays=[(-INF, INF)], light='night'),
    'sewers-b': dict(far=None, near=None, street=[(-INF, 'cobbles'), (1280, 'klinkers'), (1536, 'tiles')],
                     squares=[(1280, INF)], light='night', back=[(0, 1280, 6.0), (1280, 1536, 6.0), (1536, 2560, 26.0)],
                     gutter=(0, 1536, -6.0)),
    'sewers-c': dict(far=None, near=None, street=[(-INF, 'tiles')], light='sewer'),
    'sewers-d': dict(far=None, near=None, street=[(-INF, 'tiles')], light='sewer'),
    'sewers-e': dict(far=None, near=None, street=[(-INF, 'tiles')], light='sewer'),
    'sewers-end': dict(far=FAR, near=NEAR, street=[(-INF, 'klinkers')], light='dawn'),
}
# The floor depth of the game's decor items on the kit floor (the dump stands them at 0: the game has no floor). P6
# gives the game the same depths (decorDepth of a sewers floor.ts). The krul urinals and the quay tree stand on the
# quay pavement, off the walk band (spec §2.1: "krul and furniture off the walk band").
DECOR_DEPTH = {
    ('sewers-a', 'decor/sewers-a/krul'): 14.0,
    ('sewers-a', 'decor/sewers-a/tree'): 22.0,
}

# ---------------------------------------------------------------- the straight street (core/street.py): a only
# (b's alleys have a central gutter and no kerb; end's street is one screen with no posts in play: the painter of end
# may add it). The post rows (Amsterdammertjes, prop 'sewers/pole') stand on the kerbstones; they keep clear of the two
# bridge heads (the bridges cross the canal into depth from the coping) and the limo's span.
STREET_IDS = dict(lamp='decor/sewers-a/lamp', lamp_tall='decor/sewers-a/lamp-tall', lamp_prefix='decor/sewers-a/lamp',
                  tree='decor/sewers-a/tree', rack='decor/sewers-a/bike-rack', post_prop='sewers/pole')
FURNITURE = ('decor/sewers-a/krul', 'decor/sewers-a/tree')
STREET = {
    'sewers-a': dict(street=[(-INF, 'cobbles')], norows=[(1336, 1480), (2860, 3030)], trees={520: 22.0}),
}


# ---------------------------------------------------------------- the layout the kit reads
KIT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
DUMP = os.path.join(KIT, 'work', ID, 'layout.json')
LAYOUT = os.path.join(KIT, 'work', ID, 'layout-kit.json')


def _floor(spec):
    fl = dict(light=spec.get('light', 'night'), far=spec['far'], near=spec['near'], bulbs=[], crossings=[],
              street=[dict(u0=u, kind=k) for (u, k) in spec['street']], squares=[list(s) for s in spec.get('squares', [])],
              bays=[], quays=[list(q) for q in spec.get('quays', [])], bridges=[], canals=[],
              bikes=dict(every=220, phase=60), areas=[])
    for k in ('back', 'gutter'):
        if k in spec:
            fl[k] = spec[k]
    return dict(camera=dict(yh=60, f=210, back=146), painter=dict(id='kit-sewers', seed=1, params=dict(layout=fl)),
                features=[], rows=[], overhangs=[], tops=[], openings=[], faces=[], hideDecor=None, defaultDepth=0,
                keepClear=[])


def kit_layout(dump):
    """The dump with the kit floor of FLOOR, the decor depths of DECOR_DEPTH and the lit aliases of LIT."""
    out = dict(dump)
    for sid, spec in FLOOR.items():
        if sid not in out:
            continue
        L = dict(out[sid])
        if L.get('floor') is None:
            L['floor'] = _floor(spec)
        L['decor'] = [dict(d, floorDepth=DECOR_DEPTH.get((sid, d['sprite']), d['floorDepth'])) for d in L['decor']]
        out[sid] = L
    for sid in LIT:
        if sid in out:
            out[sid + LIT_SUFFIX] = json.loads(json.dumps(out[sid]))
    return out


def _write_layout():
    if os.environ.get('LK_LAYOUT'):
        return
    if not os.path.exists(DUMP):
        raise SystemExit('mission sewers: no dump at %s. Run: npx tsx tools/levelkit/missions/sewers/dump_lazy.mts sewers '
                         '--prefix decor/sewers --prefix prop/sewers --prefix boss/sewers-gerrit/limo --prefix vehicle/' % DUMP)
    txt = json.dumps(kit_layout(json.load(open(DUMP))), indent=1, sort_keys=True)
    if os.path.exists(LAYOUT) and open(LAYOUT).read() == txt:
        return
    tmp = '%s.%d.tmp' % (LAYOUT, os.getpid())          # parallel painters: write whole, then rename
    with open(tmp, 'w') as f:
        f.write(txt)
    os.replace(tmp, LAYOUT)


_write_layout()
