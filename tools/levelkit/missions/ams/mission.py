# Mission ams (level 1, Amsterdam) for the level kit: the tables of this mission that the shared core reads
# (tools/levelkit/README.md "Add a mission"). lk.py puts this folder on the import path before the core, so
# `import mission` finds this file; every section module of the mission (l1<id>.py), its parts (parts_*.py) and its
# street corrections (street_<id>.py) live next to it.
from street import INF, FAR, NEAR       # noqa: F401  (the straight street's rule constants, core/street.py)

ID = 'ams'                              # the game's mission id (getMission), the dump's mission and the scene prefix

# The section modules in page and check order (check_level.py, export_level.py with no names).
SECTIONS = ['l1a', 'l1b', 'l1c', 'l1c1', 'l1c2', 'l1d']

# The page (mkpage_level.py): (section id, label, hour label), the title and the lead paragraph.
PAGE = dict(
    title='Level 1 Repainted',
    sections=[('a', 'Grachtengordel', 'Morning'), ('b', 'Museumplein', 'Noon'), ('c', 'Amstel', 'Golden afternoon'),
              ('c1', 'Brug', 'Golden afternoon'), ('c2', 'Rondvaart', 'Golden afternoon'), ('d', 'Stopera', 'Sunset')],
)

# Where the bake writes (paths from the repo root). Level 1 keeps its fixtures in the root of tests/fixtures/canal (the
# fidelity test reads that folder as mission ams); a new mission leaves FIXTURES out and gets tests/fixtures/canal/<id>.
ART = 'public/art/ams'
MANIFEST_DIR = 'src/game/content/missions/ams/canal'
FIXTURES = 'tests/fixtures/canal'

# The fidelity cameras of a section whose module has no GAME_CAMS (section a's, chosen by the first engine builder;
# l1a.py has its own GAME_CAMS now, so this is the fallback only).
FIXTURE_CAMS = {
    'a': [(0, 192), (600, 200), (1000, 120), (1560, 192), (2000, 140), (2440, 192), (3200, 110)],
}

# The check (check_level.py): the least share of the key hue in a frame, per hour.
KEY_SHARE = {'morning': 0.45, 'noon': 0.45, 'golden': 0.55, 'sunset': 0.60}

# ---------------------------------------------------------------- the hours of the level (key and air, §3.2 of the guide)
# (moved here from level.py; Sec(id, name, hour) reads HOURS[hour])
HOURS = {
    # section a: a bright spring morning (scene a of the study, unchanged)
    'morning': dict(KEY=((70, 84, 128), (255, 248, 226), 0.10, 0.0), AIR=((122, 160, 205), (240, 244, 232)),
                    sky=[(0, '#2a66ae'), (0.40, '#4f92d2'), (0.74, '#96c8ea'), (1, '#dcefee')],
                    cloud=('#6a90ba', '#89abcf', '#aec6dc', '#d2dfe6', '#eef0e6', '#ffffff'),
                    water=((62, 100, 108), (30, 58, 68)), shadow=(40, 44, 66), cast=(0.30, 0.16), shade=(0.66, 0.70, 0.86),
                    fg=((18, 22, 44), (170, 160, 150), 0.42, 0.3), curve=(1.10, 1.06), sun=(0.14, 0.16)),
    # section b: noon, clear; the light is high and white, the shade short and blue
    'noon': dict(KEY=((62, 78, 122), (255, 252, 240), 0.08, 0.0), AIR=((132, 168, 210), (236, 244, 244)),
                 sky=[(0, '#1f5aa6'), (0.42, '#3f86cf'), (0.76, '#88c0ea'), (1, '#d6ecf2')],
                 cloud=('#7096be', '#8fb2d4', '#b3cce0', '#d6e3ea', '#f0f3ee', '#ffffff'),
                 water=((58, 104, 118), (26, 56, 70)), shadow=(38, 44, 70), cast=(0.10, 0.10), shade=(0.64, 0.68, 0.86),
                 fg=((16, 22, 44), (176, 170, 160), 0.40, 0.3), curve=(1.08, 1.06), sun=(0.50, 0.04)),
    # sections c, c1, c2: golden late afternoon; warm light, violet-brown shade, long shadows toward the viewer
    'golden': dict(KEY=((72, 50, 74), (255, 228, 164), 0.34, 0.04), AIR=((150, 124, 128), (252, 222, 168)),
                   sky=[(0, '#3e6aa8'), (0.36, '#7e9cc4'), (0.66, '#d6c0a0'), (0.86, '#f2cf92'), (1, '#fbe2a8')],
                   cloud=('#8a7a96', '#a68c9a', '#c69e94', '#e2b490', '#f4cc98', '#fde4b4'),
                   water=((92, 96, 104), (40, 50, 66)), shadow=(52, 40, 66), cast=(0.62, 0.20), shade=(0.62, 0.60, 0.80),
                   fg=((26, 18, 34), (170, 140, 120), 0.52, 0.3), curve=(1.08, 1.04), sun=(0.86, 0.40)),
    # section d: orange-pink sunset (near scene c of the study, with pinker air)
    'sunset': dict(KEY=((62, 28, 54), (255, 196, 124), 0.60, 0.10), AIR=((120, 60, 88), (255, 172, 120)),
                   sky=[(0, '#3a2c66'), (0.30, '#7a3f78'), (0.58, '#c8607a'), (0.80, '#f39466'), (1, '#ffc27a')],
                   cloud=('#4c2c5a', '#6c3a66', '#94506e', '#c06a70', '#e88c72', '#ffb886'),
                   water=((96, 60, 86), (40, 26, 52)), shadow=(46, 26, 50), cast=(0.80, 0.22), shade=(0.58, 0.52, 0.74),
                   fg=((22, 12, 28), (150, 100, 100), 0.62, 0.3), curve=(1.06, 1.04), sun=(0.80, 0.52)),
}

# ---------------------------------------------------------------- the straight street (core/street.py; moved here from it)
# The game's sprite ids the street rules move and check.
STREET_IDS = dict(lamp='decor/ams/lamp', lamp_tall='decor/ams/lamp-grey', lamp_prefix='decor/ams/lamp', tree='decor/ams/elm',
                  rack='decor/ams/bike-rack', post_prop='ams/pole')
FURNITURE = ('decor/ams/elm', 'decor/ams/lamp', 'decor/ams/lamp-grey', 'decor/ams/tulips', 'decor/ams/bench', 'decor/ams/bike',
             'decor/ams/flag-ams', 'decor/ams/flag-nl', 'decor/ams/bike-rack')

STREET = {
    'a': dict(
        street=[(-INF, 'lane'), (720, 'deck'), (880, 'lane'), (1340, 'fan'), (1904, 'cobbles'), (2600, 'deck'), (2760, 'lane'),
                (3190, 'klinkers')],
        squares=[(1340, 1904), (3190, 3584)],          # the Pleintje; the little square of FABEL FRIET (the counter stands on it)
        bays=[(652, 718)],                             # the breakable bike rack at 690
        trees={620: 9.0},                              # the elm of the tree-bike secret: at the kerb, a bough carries the bike
    ),
    'b': dict(
        street=[(-INF, 'lane'), (800, 'tiles'), (1116, 'gravel'), (2196, 'lane')],
        squares=[(800, 1116)],
        bays=[(2306, 2374)],                           # the herring cart at 2340
        norows=[(400, 720), (720, 2200)],              # the passage; the Museumplein (its lawn chains stay)
    ),
    'c': dict(
        street=[(-INF, 'lane'), (470, 'fan'), (1400, 'cobbles'), (2368, 'fan')],
        squares=[(470, 600), (2368, 2608)],
    ),
    'c1': dict(
        street=[(-INF, 'klinkers'), (60, 'tiles'), (860, 'lane'), (1004, 'cobbles')],
        far=[[860, 17], [860.5, FAR]], near=[[860, -1.6], [860.5, NEAR]],     # the white bridge's deck lands at 860
        norows=[(-INF, 860), (1008, 1232)],            # the plank bridge; the Blauwbrug
    ),
    'c2': None,                                        # the river: no street
    'd': dict(
        street=[(-INF, 'fan'), (860, 'stone')],
        squares=[(-INF, INF)],                         # the flea market and the Stopera forecourt: one paved ground
        keep_rows=True,
    ),
}
