# Pseudo-mission `sample` for the level kit: a look sample of a place the game does not have yet (README "A look
# sample without a mission"). No game mission, no dump: the kit reads the stub layout next to this file (one flat
# section `a`, 960 px, the ground line at y 176, straight kerbs at depths 5 and -16.3, cobbles, no decor, no
# platforms). Copy this folder (and tools/levelkit/template/section.py) to start a sample of your own place; change
# ID, the hour and, if the sample needs it, the stub (width, kerbs `far` / `near`, street kind, areas, canals).
import os

ID = 'sample'
LAYOUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'layout.json')
BAKE = False                  # never bakes into public/ or src/ (lk.py bake needs every folder given)
SECTIONS = []                 # check / export with no names: nothing (name the module or file)
PAGE = dict(title='Look Sample', sections=[('a', 'Sample', 'Day')], header='<h1>Look Sample</h1>', route='')
KEY_SHARE = {'day': 0.45}

# One hour: a clear spring morning (level 1's 'morning' of missions/ams/mission.py, as a starting point).
HOURS = {
    'day': dict(KEY=((70, 84, 128), (255, 248, 226), 0.10, 0.0), AIR=((122, 160, 205), (240, 244, 232)),
                sky=[(0, '#2a66ae'), (0.40, '#4f92d2'), (0.74, '#96c8ea'), (1, '#dcefee')],
                cloud=('#6a90ba', '#89abcf', '#aec6dc', '#d2dfe6', '#eef0e6', '#ffffff'),
                water=((62, 100, 108), (30, 58, 68)), shadow=(40, 44, 66), cast=(0.30, 0.16), shade=(0.66, 0.70, 0.86),
                fg=((18, 22, 44), (170, 160, 150), 0.42, 0.3), curve=(1.10, 1.06), sun=(0.14, 0.16)),
}
