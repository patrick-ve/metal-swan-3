# Where things are for the level kit (lk.py sets LK_MISSION_DIR before it runs a core script).
import importlib
import os
import sys

CORE = os.path.dirname(os.path.abspath(__file__))
KIT = os.path.dirname(CORE)                               # tools/levelkit
REPO = os.path.normpath(os.path.join(KIT, '..', '..'))   # the repo root


def mission_dir():
    d = os.environ.get('LK_MISSION_DIR')
    if not d:
        raise SystemExit('no mission: run the kit through tools/levelkit/lk.py <mission> <command> ...')
    return d


def mission():
    import mission as M          # missions/<id>/mission.py (its folder is first on the import path)
    return M


def work_dir():
    """tools/levelkit/work/<mission id>: the dump, previews, strips, the page export (git-ignored)."""
    d = os.path.join(KIT, 'work', mission().ID)
    os.makedirs(d, exist_ok=True)
    return d


def repo_path(p):
    """A path from the repo root (absolute paths stay as they are)."""
    return p if os.path.isabs(p) else os.path.join(REPO, p)


def module_file(name):
    """The file of a section module or script: a path to a .py file, or a module name in the mission folder (or
       the core)."""
    if name.endswith('.py') or os.sep in name:
        p = os.path.abspath(name)
        if not os.path.exists(p):
            raise SystemExit('no file %s' % p)
        return p
    for d in (mission_dir(), CORE):
        p = os.path.join(d, name + '.py')
        if os.path.exists(p):
            return p
    raise SystemExit('no module %s in %s or the core' % (name, mission_dir()))


def load_module(name):
    """Import a section module by name (mission folder) or by file path (its folder joins the import path)."""
    if name.endswith('.py') or os.sep in name:
        p = module_file(name)
        d = os.path.dirname(p)
        if d not in sys.path:
            sys.path.append(d)
        return importlib.import_module(os.path.basename(p)[:-3])
    return importlib.import_module(name)
