#!/usr/bin/env python3
# The level kit's one entry point (tools/levelkit/README.md). Every command names its mission:
#
#   [U=1|2|4] python3 tools/levelkit/lk.py <mission> <command> [args]
#
#   <mission>   a folder name under tools/levelkit/missions/ (ams, sample) or a path to a folder with a mission.py
#   preview <module|file.py> ...   run section modules as scripts: previews in work/<mission>/out/
#   run <script|file.py> [args]    run any mission script (fit_l1b, fronts_l1a, ...) the same way
#   check [module ...]             the gates (no names: the mission's SECTIONS)
#   strip <module> [outdir]        audit strips (default work/<mission>/strips/)
#   export [module ...]            the page's layer tiles: work/<mission>/site/l1/
#   pack                           pack those tiles into sheets
#   page                           write work/<mission>/site/index.html and page.html
#   bake <module ...> [--out DIR] [--manifest-dir DIR] [--fixtures DIR | --no-fixtures] [--stats]
#                                  the game bake at tier U (defaults from the mission: public/art/<id>, ...)
#
# lk.py puts the mission folder first and the core second on the import path, so a section module imports core
# modules (level, parts, game_sprites, ...) and its mission's modules (mission, parts_*, street_*) by name.
import os
import runpy
import sys

KIT = os.path.dirname(os.path.abspath(__file__))
CORE = os.path.join(KIT, 'core')
SCRIPTS = dict(check='check_level.py', strip='audit_strip.py', export='export_level.py', pack='pack_level.py',
               page='mkpage_level.py', bake='bake_game.py')


def usage(msg=None):
    head = [l[2:] for l in open(__file__).read().splitlines()[1:17]]
    if msg:
        print('lk.py: %s\n' % msg, file=sys.stderr)
    print('\n'.join(head), file=sys.stderr)
    sys.exit(2)


def main():
    if len(sys.argv) < 3:
        usage()
    mission, cmd, args = sys.argv[1], sys.argv[2], sys.argv[3:]
    named = os.path.join(KIT, 'missions', mission)
    mdir = os.path.abspath(named if os.sep not in mission and os.path.isdir(named) else mission)
    if not os.path.exists(os.path.join(mdir, 'mission.py')):
        usage('no mission.py in %s' % mdir)
    os.environ['LK_MISSION_DIR'] = mdir
    sys.path[:0] = [mdir, CORE]
    import lkpath
    if cmd in ('preview', 'run'):
        if not args:
            usage('%s needs a module' % cmd)
        names = args if cmd == 'preview' else args[:1]
        files = [lkpath.module_file(n) for n in names]
        os.chdir(lkpath.work_dir())                      # previews write out/<...>.png here
        for f in files:
            d = os.path.dirname(f)
            if d not in sys.path:
                sys.path.append(d)
            sys.argv = [f] + (args[1:] if cmd == 'run' else [])
            runpy.run_path(f, run_name='__main__')
        return
    if cmd not in SCRIPTS:
        usage('unknown command %s' % cmd)
    f = os.path.join(CORE, SCRIPTS[cmd])
    sys.argv = [f] + args
    runpy.run_path(f, run_name='__main__')


if __name__ == '__main__':
    main()
