# Pseudo-mission `sewers-look` of the level kit: the APPROVED look sample of level 2, RATTENJONG MET DE RATTENITEMS
# (docs/design/sewers/brainstorm.md; the user picked V2 BLACK, 2026-11-11). Kept as it was approved: the real mission
# lives in missions/sewers/ (its own mission.py, the dumped layout, sw_a .. sw_end); this folder keeps the sample's
# stub layout, sw_d.py, its variant modules, look.py and cost.py (moved here 2026-11-12, wave P4a, unchanged). The
# painters (parts_sewers.py) stay in missions/sewers/ and are imported from there (the path line below), so the sample
# and sections c, d, e share one set of sewer parts. Its work folder is work/sewers-look/ (previews, page).
#
#   LK_VAR=v2 LK_LIGHT=amb U=1 python3 tools/levelkit/lk.py sewers-look preview sw_d     # work/sewers-look/out/sw-v2-*
#   U=4 python3 tools/levelkit/lk.py sewers-look run look v2                             # tmp/sewers/look/v2-cam*-*-u4.png
#   U=1 python3 tools/levelkit/lk.py sewers-look check sw_d_v2                           # the sample's gates
#   U=4 python3 tools/levelkit/lk.py sewers-look run cost v2
#   for U in 1 2 4; do U=$U python3 tools/levelkit/lk.py sewers-look export; done; lk.py sewers-look pack; lk.py
#   sewers-look page; python3 tmp/sewers/page_patch.py                                   # the look page
#
# No game mission: the kit reads the stub layout next to this file (flat
# sections of 1,280 px, the ground line at y 176, no kerbs, no decor, no platforms). The stub has one section per
# variant and light (`d` and v1 v2 v3 v1l v2l v3l, all the same geometry) so the page can show them side by side.
#
# Section d, the sewer tunnels, 02:30, in three light variants (the card left the exact light open):
#   v1 teal  (the card): dark teal-green ambient, pink and red grate shafts, a faint green water glow
#   v2 black: near-black blue ambient, a stronger green water glow; the eyes and the shafts pop
#   v3 brick: warmer olive and amber brick under the same grate light; dirtier, less cold
# and the lit key of the flashlight (v1l v2l v3l): the same scene as a warm white flashlight shows it.
# Only the hour tables and the emitters change between the variants (sw_d.py paints one scene).
import os
import sys

# the sewer painters live with the real mission (appended: this folder and the core come first on the import path)
_SEWERS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'sewers')
if _SEWERS not in sys.path:
    sys.path.append(_SEWERS)

ID = 'sewers-look'
LAYOUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'layout.json')
BAKE = False                  # never bakes into public/ or src/
SECTIONS = ['sw_d_v1', 'sw_d_v2', 'sw_d_v3']
PAGE = dict(title='Sewer Look Sample',
            sections=[('v1', 'teal', 'ambient'), ('v1l', 'teal', 'flashlight'),
                      ('v2', 'black', 'ambient'), ('v2l', 'black', 'flashlight'),
                      ('v3', 'brick', 'ambient'), ('v3l', 'brick', 'flashlight')],
            header='<h1>Sewer Look Sample</h1><p>Level 2, section d: the sewer tunnels at 02:30, in three light '
                   'variants. Each variant twice: the <b>ambient</b> light outside any flashlight, and the same scene '
                   '<b>lit</b> by the flashlight. Vincent is unchanged.</p>',
            route='d: the sewer tunnels, 1,280 px; the fatberg at the last screen.')

# The key hue share each hour needs (check_level.py)
KEY_SHARE = {'v1': 0.45, 'v2': 0.45, 'v3': 0.45, 'v1l': 0.30, 'v2l': 0.30, 'v3l': 0.30}

# The emitters of each variant (they skip the key and the air): the grate light (pink and red neon from the street,
# light to deep), the water glow (green), the eyes (core, rim, halo).
EM_V1 = dict(shaft=[(255, 206, 222), (255, 140, 182), (226, 76, 132), (156, 40, 92)],
             glow=[(24, 74, 58), (40, 116, 82), (82, 176, 112)],
             eye=[(255, 236, 140), (255, 64, 40), (150, 18, 28)])
# V2 (picked by the user, 2026-11-11, with one change: "the red light coming from the sewer drain is too much"; fix
# "Faint, mostly white"): the grate shafts are dim, thin, cold white street light with rain; a faint pink only in the
# grate itself; no strong halo on the vault; small, faint pools. The flashlight and the green water glow lead.
EM_V2 = dict(shaft=[(214, 222, 236), (164, 176, 198), (120, 132, 158), (82, 92, 118)],
             grate=[(250, 216, 230), (206, 168, 190)],
             glow=[(16, 70, 46), (34, 140, 80), (100, 230, 120)],
             eye=[(255, 246, 160), (255, 48, 32), (170, 10, 22)])
EM_V3 = dict(shaft=[(255, 210, 206), (255, 136, 150), (220, 70, 98), (148, 38, 66)],
             glow=[(46, 66, 30), (78, 110, 40), (132, 168, 62)],
             eye=[(255, 236, 140), (255, 70, 36), (150, 22, 20)])

_LIT = dict(KEY=((26, 18, 14), (255, 240, 214), 0.24, 0.0), AIR=((34, 30, 30), (150, 136, 120)), air=0.10)


LIGHTS_V2 = dict(shaft=0.42, shaft_w=(8.0, 14.0), mshaft=0.30, mshaft_w=(6.0, 10.0), halo=(0.10, 0.0), halo_r=(12.0, 8.0),
                 wall=(0.06, 0.0), walk=(0.12, 0.06), mwall=(0.06, 0.0), mwalk=(0.16, 0.08), rungs=False,
                 pool=0.24, pool_r=(6.0, 3.5), streak=0.20, glints=0.80, spill=(0.12, 0.06))


def _hour(KEY, AIR, em, air, glow=0.58, **kw):
    d = dict(KEY=KEY, AIR=AIR, em=em, air=air, glow=glow, curve=(1.0, 1.0), shadow=(6, 8, 10), shade=(0.66, 0.70, 0.80),
             cast=(0.0, 0.0), sky=[(0, '#000000'), (1, '#101010')], cloud=('#000000',) * 6, water=((10, 20, 20), (4, 8, 8)),
             fg=((2, 4, 6), (60, 60, 56), 0.90, 0.3), sun=(0, 0))
    d.update(kw)
    return d


HOURS = {
    'v1': _hour(((4, 14, 18), (70, 128, 122), 0.90, 0.25), ((12, 30, 34), (58, 102, 98)), EM_V1, 0.26),
    'v2': _hour(((2, 3, 12), (42, 56, 98), 0.93, 0.30), ((8, 12, 26), (40, 50, 80)), EM_V2, 0.30, glow=0.90, lights=LIGHTS_V2,
                fg=((0, 0, 4), (40, 44, 60), 0.94, 0.4)),
    'v3': _hour(((16, 10, 4), (150, 106, 60), 0.84, 0.15), ((34, 24, 14), (112, 86, 54)), EM_V3, 0.24, glow=0.45,
                fg=((6, 4, 2), (80, 64, 44), 0.90, 0.3)),
    'v1l': _hour(_LIT['KEY'], _LIT['AIR'], EM_V1, _LIT['air'], fg=((10, 8, 6), (150, 130, 110), 0.70, 0.1)),
    'v2l': _hour(_LIT['KEY'], _LIT['AIR'], EM_V2, _LIT['air'], lights=LIGHTS_V2, fg=((10, 8, 6), (150, 130, 110), 0.70, 0.1)),
    'v3l': _hour(_LIT['KEY'], _LIT['AIR'], EM_V3, _LIT['air'], fg=((10, 8, 6), (150, 130, 110), 0.70, 0.1)),
}
