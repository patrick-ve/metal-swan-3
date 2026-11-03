# Builds squad-40px.html: the five heroes at 1x (384x216) on one page.
#   python3 squad.py            (uses out/sprites.json for VINCENT and out/<hero>/sprites.json)
#   python3 squad.py --fake     (layout test: VINCENT copied under the other names)
import json, os, sys

ORDER = ['vincent', 'thom', 'dirk', 'bob', 'patrick']
PAGE_JS = ['a_data.js', 'b_world.js', 'c_hero.js', 'c2_play.js', 'd_layout.js', 'e_view.js']
NOTES = json.load(open('squad_notes.json')) if os.path.exists('squad_notes.json') else {}
LEDE = ("VINCENT's approved build, applied to the whole squad and now complete: five 40&nbsp;px heroes on the 384×216 grid, "
        "each with 47 animation groups in eight categories (the twelve core groups, the pistol extras, the heavy weapon with its "
        "45° sweep, the moves, the extra deaths, the full-body set, the Swan ride, and the status looks), on the same rig "
        "and in his own face, clothes, weapon, melee move and fidgets.")
STEPS = [
    "<b>One rig, five heroes.</b> The shared build (IK limbs shaded as cloth tubes, creases, selout, one outline) stays the same; each hero is one module that swaps the palette, the hand-drawn parts and the poses.",
    "<b>Families on top of the core.</b> Each new family (heavy weapon, moves and deaths, Swan ride and Helium Head, status looks) is one module that builds its poses from the hero's own parts, so a hero gets every animation at once; the hero module then redraws what must be personal (faces, fidgets, the second pistol, the cape).",
    "<b>Faces by hand</b> after the photos: about 14 × 13 px per head, with grin, blink, shout, hurt, look up, look down, the fidget faces and the new happy, panic, yawn, sleep, bored and soot faces.",
    "<b>Helium Head is derived.</b> The balloon heads are made from each hero's own faces (a smooth 2× upscale, inflated round, shaded inside each colour ramp, a glint), then touched by hand.",
    "<b>Stage sprites</b> are shared art drawn on the same grid: the wing parachute, the Swan in two layers (behind and in front of the rider), the water band, the snore letters.",
    "<b>Cloth that sticks to the limbs.</b> THOM's camouflage is painted along each arm and leg tube, so the blotches move with the limb and do not swim. BOB's cape is its own back sprite per frame.",
    "<b>The status looks need no new art.</b> The pick-up flash is the hero in white, then a fading white tint; the invulnerable blink hides him every other 2 ticks, as the game draws it.",
    "<b>Same pixels every build.</b> Every tie-break in the pipeline is sorted, so a rebuild never moves a pixel.",
]


def load(h, fake=False):
    p = 'out/sprites.json' if (h == 'vincent' or fake) else f'out/{h}/sprites.json'
    s = 'out/stats.json' if (h == 'vincent' or fake) else f'out/{h}/stats.json'
    if not os.path.exists(p):
        return None
    d = json.load(open(p))
    st = json.load(open(s))['s1']
    s1 = {k: d['s1'][k] for k in ('upper', 'lower', 'full')}
    melee = d['groups'][10]['title']
    n = NOTES.get(h, {'role': '', 'items': [], 'ramps': []})
    return {'id': h, 'name': h.upper(), 'pal': d['pal'], 's1': s1, 'groups': d['groups'], 'stats': st, 'melee': melee, 'notes': n}


if __name__ == '__main__':
    fake = '--fake' in sys.argv
    heroes = [x for x in (load(h, fake) for h in ORDER) if x]
    v = json.load(open('out/sprites.json'))
    data = {'heroes': heroes, 'stage': v['s1']['stage'], 'stage2': v['s1'].get('stage2', {}), 'stagePal': v['pal']}
    # the page script is assembled from page2/ (data, world, hero drawing, play stage, layout, viewer)
    js = ''.join(open('page2/' + n).read() for n in PAGE_JS).replace('__DATA__', json.dumps(data, separators=(',', ':')))
    html = open('squad.tpl.html').read().replace('__LEDE__', LEDE).replace('__STEPS__', '\n'.join(f'    <li>{s}</li>' for s in STEPS)).replace('__SCRIPT__', js)
    open('squad-40px.html', 'w').write(html)
    print([h['id'] for h in heroes], len(html) // 1024, 'KB')
