# The art40 character module API: what a set (tools/art40/chars/<slug>/) builds, and how the bake
# reads it. See tools/art40/README.md for the worked example.
#
#   import art40 as X          # this module (tools/art40 and tools/art40/kit are on sys.path)
#   import castkit as K        # the production kit (the squad rig + the cast helpers)
#
#   SET = X.Set(prefix='enemy/handhaver', budget=28, face=-1)
#
#   def build(s):              # s is SET; called once, in a process of its own
#       K.palette(PAL, dark=DARK)
#       rows, root = K.humanoid(upper, lower)
#       s.strip('idle', [X.Frame(rows, root, pts={'hand': (40, 30)})], [12], cls='idle', why='...')
#       s.event('THROW_RELEASE', 3)
#       s.variant('enemy/handhaver-b', {'J': '#5a6a9a'})
#
# Every frame is a list of strings over palette letters ('.' = empty) plus its root: the anchor point
# in those rows (for a standing figure the ground point under its centre: the 'feet' anchor, the
# soles' last pixel row is root_y - 1; X.humanoid and X.full return it for kit figures). Draw every
# frame facing right (the rig does); face=-1 mirrors a set whose game sprite faces left. The bake crops each frame to its pixels, mirrors it when the set (or
# the strip) faces left, maps the letters to palette indices and writes the baked set.
import importlib.util
import json
import math
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
KIT = os.path.join(HERE, 'kit')
CHARS = os.path.join(HERE, 'chars')
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
for _p in (KIT, HERE):
    if _p not in sys.path:
        sys.path.insert(0, _p)

# The rules shared with the TypeScript check (tools/art40/check/rules.ts and classes.ts are the
# source; rules.json is their copy, written by `npm run art40-check -- --write-rules`): the plan's
# action classes (docs/design/ams40.md "Motion, per action class": the frame count a strip of the
# class needs; fewer frames need a logged reason `why`), the colour budgets of plan D1 and the sets
# allowed the larger ones, and the one shared FX ramp.
with open(os.path.join(HERE, 'rules.json'), encoding='utf-8') as _f:
    RULES = json.load(_f)
BUDGETS = tuple(RULES['budgets'])
BUDGET_SLUGS = {int(k): tuple(v) for k, v in RULES['budgetSlugs'].items()}
FX_RAMP = tuple(c.lower() for c in RULES['fxRamp'])
CLASSES = {c['name']: c for c in RULES['classes']}
CLASS_ALIASES = dict(RULES['aliases'])
MAX_SMEARS = 2
# The pixel stream (format v2, src/engine/baked.ts PX_ALPHABET): 91 printable characters
# '#'..'~' without the backslash; pairs (run - 1, palette index).
FORMAT = 2
PX_ALPHABET = ''.join(chr(c) for c in range(0x23, 0x7f) if c != 0x5c)
PX_MAX_RUN = len(PX_ALPHABET)
PX_MAX_PALETTE = len(PX_ALPHABET)


def action_class(cls):
    """The class record for a strip's cls (a class name or an alias), or None."""
    if not isinstance(cls, str):
        return None
    n = re.sub(r'[^a-z0-9]+', '-', cls.lower()).strip('-')
    return CLASSES.get(CLASS_ALIASES.get(n, n))


def budget_allowed(slug, budget):
    """Plan D1: 28 for every figure; 40 and 64 only for the slugs of BUDGET_SLUGS ('_' fixture
    sets may use 40)."""
    if budget not in BUDGETS:
        return False
    if budget == 28 or (budget == 40 and slug.startswith('_')):
        return True
    return slug in BUDGET_SLUGS.get(budget, ())
NAME_RE = re.compile(r'^[a-z0-9_][a-z0-9_-]*(/[a-z0-9_][a-z0-9_-]*)*$')
EVENT_RE = re.compile(r'^[A-Z][A-Z0-9_]*$')
HEX_RE = re.compile(r'^#[0-9a-f]{6}$')


class SetError(Exception):
    """A set breaks a rule of the format (the bake stops with this message)."""


def half_up(v):
    return int(math.floor(v + 0.5))


class Frame:
    """One picture: rows over palette letters ('.' = empty), root = the anchor (x, y) in rows,
    pts = named points (x, y) in rows coordinates the GAME reads (the bake makes them relative to
    the anchor and rounds them to whole pixels), smear = a smear frame (at most 2 per strip),
    joints = every rig joint of the frame (rows coordinates; X.humanoid returns them all): not
    shipped, written to the joint sidecar for the smoothness gate (tools/art40/joints/<slug>.json).
    Without joints the gate measures pts."""

    def __init__(self, rows, root, pts=None, smear=False, joints=None):
        self.rows = [str(r) for r in rows]
        self.root = (float(root[0]), float(root[1]))
        self.pts = dict(pts or {})
        self.smear = bool(smear)
        self.joints = dict(joints or {})

    @classmethod
    def of(cls, item):
        if isinstance(item, Frame):
            return item
        if isinstance(item, (tuple, list)) and len(item) in (2, 3):
            return Frame(item[0], item[1], item[2] if len(item) == 3 else None)
        raise SetError(f'a frame must be art40.Frame or (rows, root[, pts]), got {type(item).__name__}')


class Strip:
    def __init__(self, name, frames, durations, loop, defer, cls, why, face):
        self.name, self.frames, self.durations = name, frames, durations
        self.loop, self.defer, self.cls, self.why, self.face = loop, defer, cls, why, face


class Set:
    """A baked set: one character (or one look of it) with one palette shared by all its strips.

    prefix   the id prefix: strip 'walk' becomes the sprite id '<prefix>/walk'
    budget   the colour budget of plan D1: 28 (figures), 40 (machines, multi-part), 64 (the mayor)
    face     +1: the frames are drawn facing the way the game's unflipped sprite faces;
             -1: the bake mirrors them (the rig draws facing right; most enemies face left)
    outline  the letter of the one warm near-black outline colour (default 'K')
    hl       letters allowed as single pixels (eyes, highlights, glints)
    fx       letters of the small shared FX ramp (flashes, flames): in the palette, outside the budget
    colours  letter -> '#rrggbb'; default: the kit palette (rig.PAL, live), read when the bake runs
    """

    def __init__(self, prefix, budget, face=1, outline='K', hl='', fx='', colours=None):
        self.prefix = prefix
        self.budget = budget
        self.face = face
        self.outline = outline
        self.hl = list(hl)
        self.fx = list(fx)
        self.colours = colours
        self.strips = {}
        self.variants = {}
        self.events = {}
        self.slug = None          # set by the loader

    # -- authoring --------------------------------------------------------------------------
    def strip(self, name, frames, durations, loop=True, cls=None, why=None, defer=False, face=None):
        """Add a strip. durations: one tick count per frame (60 Hz), or one int for all frames.
        cls: the plan's action class (CLASSES); why: the logged reason when the strip has fewer
        frames than its class needs. face: overrides the set's face for this strip."""
        if name in self.strips:
            raise SetError(f'strip {name!r} is defined twice')
        frames = [Frame.of(f) for f in frames]
        if isinstance(durations, int):
            durations = [durations] * len(frames)
        self.strips[name] = Strip(name, frames, [int(d) for d in durations], bool(loop), bool(defer),
                                  cls, why, self.face if face is None else face)
        return self.strips[name]

    def variant(self, prefix, colours):
        """Another id prefix with the same pixels in other colours: colours = {letter: '#rrggbb'}
        overrides (letters not named keep the base colour)."""
        if prefix in self.variants or prefix == self.prefix:
            raise SetError(f'variant prefix {prefix!r} is used twice')
        self.variants[prefix] = dict(colours)

    def event(self, name, value):
        """A named frame index or tick the game code reads (exported as `export const NAME = value`)."""
        if name in self.events:
            raise SetError(f'event {name!r} is defined twice')
        self.events[name] = value


# ---------------------------------------------------------------------------------------- loading
def slug_of(prefix):
    """The slug rule: the last segment of the prefix ('enemy/handhaver' -> 'handhaver'); a numeric
    last segment joins the one before it ('npc/ams/ams-staff/0' -> 'ams-staff-0')."""
    seg = prefix.split('/')
    if len(seg) > 1 and seg[-1].isdigit():
        return seg[-2] + '-' + seg[-1]
    return seg[-1]


def slugs():
    """Every set folder (chars/<slug>/__init__.py with a build function), sorted. Folders without
    one are helper code that sets share."""
    out = []
    if not os.path.isdir(CHARS):
        return out
    for name in sorted(os.listdir(CHARS)):
        init = os.path.join(CHARS, name, '__init__.py')
        if os.path.isfile(init):
            with open(init, encoding='utf-8') as f:
                if re.search(r'^def build\(', f.read(), re.M):
                    out.append(name)
    return out


def _modname(slug):
    return 'art40_chars.' + re.sub(r'[^A-Za-z0-9_]', '_', slug)


def char(slug):
    """Import the module of chars/<slug>/ (a package: its files may use relative imports). A look
    imports the set it shares code with this way: base = art40.char('stag-partier')."""
    name = _modname(slug)
    if name in sys.modules:
        return sys.modules[name]
    if 'art40_chars' not in sys.modules:
        pkg = importlib.util.module_from_spec(importlib.util.spec_from_loader('art40_chars', loader=None, is_package=True))
        pkg.__path__ = []
        sys.modules['art40_chars'] = pkg
    d = os.path.join(CHARS, slug)
    init = os.path.join(d, '__init__.py')
    if not os.path.isfile(init):
        raise SetError(f'no set folder tools/art40/chars/{slug}/ (with __init__.py)')
    spec = importlib.util.spec_from_file_location(name, init, submodule_search_locations=[d])
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    try:
        spec.loader.exec_module(mod)
    except BaseException:
        del sys.modules[name]
        raise
    return mod


def build(slug):
    """Load chars/<slug>/ and run its build(SET). Returns the filled Set."""
    mod = char(slug)
    s = getattr(mod, 'SET', None)
    if not isinstance(s, Set):
        raise SetError(f'{slug}: the module defines no SET = art40.Set(...)')
    if not callable(getattr(mod, 'build', None)):
        raise SetError(f'{slug}: the module defines no build(s)')
    s.slug = slug
    mod.build(s)
    return s


# ------------------------------------------------------------------------------------- normalize
def _crop(rows, root):
    w = max((len(r) for r in rows), default=0)
    rows = [r.ljust(w, '.') for r in rows]
    xs = [x for r in rows for x, ch in enumerate(r) if ch != '.']
    ys = [y for y, r in enumerate(rows) if r.strip('.')]
    if not xs:                                   # an empty frame: one transparent pixel on the anchor
        return ['.'], 0, 0, 1, 1
    x0, x1, y0, y1 = min(xs), max(xs) + 1, min(ys), max(ys) + 1
    return [r[x0:x1] for r in rows[y0:y1]], x0, y0, x1 - x0, y1 - y0


def normalize(s):
    """Validate a built Set and turn it into the baked set (a dict in the BakedSet field order) plus
    the decoded render (letters per frame) for dumps and sheets. Raises SetError on a broken rule."""
    err = []
    slug = s.slug
    if s.budget not in BUDGETS:
        err.append(f'budget {s.budget} is not one of {BUDGETS}')
    elif not budget_allowed(slug, s.budget):
        err.append(f'budget {s.budget} is only for {", ".join(BUDGET_SLUGS.get(s.budget, ()))} (plan D1; tools/art40/check/rules.ts)')
    if not NAME_RE.match(s.prefix or ''):
        err.append(f'prefix {s.prefix!r} is not an id prefix (lower case, slash paths)')
    elif slug_of(s.prefix) != slug and not getattr(s, 'shares_prefix', False):
        # (a set may opt in with SET.shares_prefix = True: several slugs, one prefix, disjoint strips;
        # boss/ams-scan: ams-scan, ams-tow-truck, ams-wheel-clamp)
        err.append(f'the folder is chars/{slug}/ but the prefix {s.prefix!r} needs chars/{slug_of(s.prefix)}/ (the slug rule)')
    if s.face not in (1, -1):
        err.append(f'face must be 1 or -1, not {s.face!r}')
    if not s.strips:
        err.append('the set has no strips')
    for p in s.variants:
        if not NAME_RE.match(p):
            err.append(f'variant prefix {p!r} is not an id prefix')
    for k, v in s.events.items():
        if not EVENT_RE.match(k) or k == 'SET':
            err.append(f'event name {k!r} must be UPPER_SNAKE (and not SET)')
        if not isinstance(v, int) or isinstance(v, bool):
            err.append(f'event {k} must be an int, not {v!r}')
    if s.colours is None:
        import rig
        colours = dict(rig.PAL)
    else:
        colours = dict(s.colours)

    frames_out = {}
    used = []                                    # letters in order of first use (deterministic)
    seen = set()
    for name, st in s.strips.items():
        where = f'strip {name!r}'
        if not NAME_RE.match(name):
            err.append(f'{where}: the name must be lower case (a-z 0-9 - _ /)')
        if not st.frames:
            err.append(f'{where}: no frames')
            continue
        if len(st.durations) != len(st.frames):
            err.append(f'{where}: {len(st.durations)} durations for {len(st.frames)} frames')
        if any(d < 1 for d in st.durations):
            err.append(f'{where}: durations must be whole ticks >= 1')
        ac = action_class(st.cls)
        if ac is None:
            err.append(f'{where}: cls {st.cls!r} is not an action class ({", ".join(CLASSES)}; tools/art40/rules.json)')
        elif ac.get('why') and not st.why:
            err.append(f'{where}: class {ac["name"]} always needs a logged reason: give why=...')
        elif len(st.frames) < ac['min'] and not st.why:
            err.append(f'{where}: {len(st.frames)} frames, class {ac["name"]} needs {ac["min"]}: give why=...')
        if st.face not in (1, -1):
            err.append(f'{where}: face must be 1 or -1')
        nsm = sum(1 for f in st.frames if f.smear)
        if nsm > MAX_SMEARS:
            err.append(f'{where}: {nsm} smear frames (at most {MAX_SMEARS})')
        out = []
        for i, f in enumerate(st.frames):
            rows, x0, y0, w, h = _crop(f.rows, f.root)
            if rows == ['.']:
                ox, oy = 0, 1                    # 'feet': the pixel stands on the anchor line
            else:
                rx, ry = f.root[0] - x0, f.root[1] - y0
                if rx != int(rx) or ry != int(ry):
                    err.append(f'{where} frame {i}: the root {f.root} is not a whole pixel')
                ox, oy = int(rx), int(ry)
            pts = {}
            for k in sorted(f.pts):
                px, py = f.pts[k]
                pts[k] = [half_up(px - f.root[0]), half_up(py - f.root[1])]
            joints = {}
            for k in sorted(f.joints):
                jx, jy = f.joints[k]
                joints[k] = [half_up(jx - f.root[0]), half_up(jy - f.root[1])]
            if st.face < 0:
                rows = [r[::-1] for r in rows]
                ox = w - 1 - ox
                pts = {k: [-v[0], v[1]] for k, v in pts.items()}
                joints = {k: [-v[0], v[1]] for k, v in joints.items()}
            for r in rows:
                for ch in r:
                    if ch != '.' and ch not in seen:
                        seen.add(ch)
                        used.append(ch)
            out.append({'w': w, 'h': h, 'ox': ox, 'oy': oy, 'rows': rows, 'pts': pts, 'joints': joints, 'smear': f.smear})
        frames_out[name] = out
    if err:
        raise SetError(f'{slug}: ' + '\n  '.join(err))

    # the palette: one index per distinct colour tuple (base + every variant), in order of first use
    def hexof(table, ch):
        v = table.get(ch)
        if v is None:
            return None
        v = v.lower()
        return v if HEX_RE.match(v) else 'BAD:' + v
    vnames = list(s.variants)
    letters_missing = [ch for ch in used if hexof(colours, ch) is None]
    if letters_missing:
        err.append(f'letters without a colour: {"".join(letters_missing)}')
    for ch in [s.outline] + s.hl + s.fx:
        if hexof(colours, ch) is None:
            err.append(f'the outline / hl / fx letter {ch!r} has no colour')
    for ch in s.fx:
        for v in [None] + vnames:
            c = hexof(colours if v is None else {**colours, **s.variants[v]}, ch)
            if c is not None and c not in FX_RAMP:
                err.append(f'fx letter {ch!r}{"" if v is None else " in " + v}: {c} is not a colour of the shared FX ramp ({", ".join(FX_RAMP)})')
    if s.outline in s.fx:
        err.append(f'the outline letter {s.outline!r} cannot be an fx letter')
    if err:
        raise SetError(f'{slug}: ' + '\n  '.join(err))
    keyed = {}
    order = []
    letter_index = {}
    for ch in [s.outline] + used:
        base = hexof(colours, ch)
        key = (base,) + tuple(hexof({**colours, **s.variants[v]}, ch) for v in vnames)
        for c in key:
            if c.startswith('BAD:'):
                err.append(f'letter {ch!r}: {c[4:]!r} is not #rrggbb')
        if key not in keyed:
            keyed[key] = len(order) + 1
            order.append(key)
        letter_index[ch] = keyed[key]
    for ch in s.hl + s.fx:
        if ch not in letter_index:
            key = (hexof(colours, ch),) + tuple(hexof({**colours, **s.variants[v]}, ch) for v in vnames)
            letter_index[ch] = keyed.get(key, 0)
    if len(order) + 1 > PX_MAX_PALETTE:
        err.append(f'{len(order)} palette entries (the pixel stream holds {PX_MAX_PALETTE - 1})')
    if err:
        raise SetError(f'{slug}: ' + '\n  '.join(err))
    # An index is FX (outside the budget) only when no other letter shares it: a body letter with
    # an FX colour is counted.
    fx_letters = set(s.fx)
    body_idx = {letter_index[ch] for ch in [s.outline] + used + s.hl if ch not in fx_letters and letter_index.get(ch)}
    fx_idx = sorted({letter_index[ch] for ch in s.fx if letter_index.get(ch)} - body_idx)
    budget_idx = [i for i in range(1, len(order) + 1) if i not in fx_idx]
    for n, label in [(0, 'the base palette')] + [(k + 1, f'variant {v}') for k, v in enumerate(vnames)]:
        cols = {order[i - 1][n] for i in budget_idx}
        if len(cols) > s.budget:
            err.append(f'{label}: {len(cols)} colours, the budget is {s.budget}')
    if err:
        raise SetError(f'{slug}: ' + '\n  '.join(err))

    pal = ['#000000'] + [k[0] for k in order]
    variants = {v: ['#000000'] + [k[n + 1] for k in order] for n, v in enumerate(vnames)}
    strips = {}
    for name, st in s.strips.items():
        fl = []
        for f in frames_out[name]:
            idx = [[0 if ch == '.' else letter_index[ch] for ch in r] for r in f['rows']]
            bf = {'w': f['w'], 'h': f['h'], 'ox': f['ox'], 'oy': f['oy'], 'px': encode(idx)}
            if f['pts']:
                bf['pts'] = f['pts']
            if f['smear']:
                bf['smear'] = True
            fl.append(bf)
        so = {'frames': fl, 'durations': list(st.durations), 'loop': st.loop}
        if st.defer:
            so['defer'] = True
        so['cls'] = st.cls
        if st.why:
            so['why'] = str(st.why)
        if st.face != s.face:
            so['face'] = st.face
        strips[name] = so
    # face: the rig draws every frame facing right; a face -1 set is mirrored, so its unflipped
    # frames face left. The foot gate walks the cycle that way.
    baked = {'v': FORMAT, 'slug': slug, 'prefix': s.prefix, 'budget': s.budget, 'face': s.face, 'pal': pal,
             'outline': letter_index[s.outline]}
    hl = sorted({letter_index[ch] for ch in s.hl if letter_index.get(ch)})
    if hl:
        baked['hl'] = hl
    if fx_idx:
        baked['fx'] = fx_idx
    if variants:
        baked['variants'] = variants
    baked['strips'] = strips
    if s.events:
        baked['events'] = dict(s.events)
    render = {'slug': slug, 'pal': {ch: colours[ch].lower() for ch in sorted(letter_index)},
              'variants': {v: {ch: hexof({**colours, **s.variants[v]}, ch) for ch in sorted(letter_index)} for v in vnames},
              'index': {ch: letter_index[ch] for ch in sorted(letter_index)},
              'strips': {name: [{'w': f['w'], 'h': f['h'], 'ox': f['ox'], 'oy': f['oy'], 'rows': f['rows'], 'pts': f['pts']}
                                for f in frames_out[name]] for name in s.strips},
              # the joint track (sidecar, not shipped): every joint + the game's points, per frame
              'joints': {name: [{**f['joints'], **f['pts']} for f in frames_out[name]]
                         for name in s.strips if any(f['joints'] for f in frames_out[name])}}
    return baked, render


# -------------------------------------------------------------------------------------- encoding
def rle(idx_rows):
    """Run-length values over the frame's indices, row-major (runs continue across rows):
    pairs (run - 1, index), run 1..PX_MAX_RUN."""
    flat = [v for r in idx_rows for v in r]
    out = []
    i = 0
    while i < len(flat):
        v = flat[i]
        if not 0 <= v < PX_MAX_PALETTE:
            raise SetError(f'palette index {v} outside 0..{PX_MAX_PALETTE - 1}')
        n = 1
        while i + n < len(flat) and flat[i + n] == v and n < PX_MAX_RUN:
            n += 1
        out += (n - 1, v)
        i += n
    return out


def encode(idx_rows):
    """The pixel stream of a frame (PX_ALPHABET characters, see src/engine/baked.ts)."""
    return ''.join(PX_ALPHABET[v] for v in rle(idx_rows))


def decode(px, n):
    """Indices of a pixel stream of n pixels (the inverse of encode)."""
    vals = [PX_ALPHABET.index(ch) for ch in px]
    out = []
    for i in range(0, len(vals), 2):
        out += [vals[i + 1]] * (vals[i] + 1)
    if len(out) != n:
        raise ValueError(f'pixel stream has {len(out)} pixels, the frame {n}')
    return out


# --------------------------------------------------------------------------------------- writing
def canonical_out(slug):
    """Where a set's generated file lives: fixture sets ('_' slugs) in tests/fixtures/art40/,
    the game's sets in src/game/content/art40/."""
    if slug.startswith('_'):
        return os.path.join(ROOT, 'tests', 'fixtures', 'art40')
    if slug.startswith('sewers-'):           # mission sewers: its own lazy folder and budget (tests/art/sewers-art40.test.ts)
        return os.path.join(ROOT, 'src', 'game', 'content', 'sewers', 'art40')
    return os.path.join(ROOT, 'src', 'game', 'content', 'art40')


def joints_out(slug, out=None):
    """Where a set's joint sidecar lives (not shipped): next to the generated file for fixture
    sets and --out folders ('<slug>.joints.json'), tools/art40/joints/<slug>.json for the game's."""
    if out or slug.startswith('_'):
        return os.path.join(out or canonical_out(slug), slug + '.joints.json')
    return os.path.join(HERE, 'joints', slug + '.json')


def to_joints_json(baked, render):
    """The joint sidecar text, or None when no frame carries joints."""
    if not render.get('joints'):
        return None
    j = {'about': f'GENERATED by npm run art40 -- {baked["slug"]}: the joint track per strip and frame '
                  '(relative to the anchor of the unflipped frame) for the smoothness gate; not shipped.',
         'slug': baked['slug'], 'strips': render['joints']}
    return json.dumps(j, sort_keys=True, separators=(',', ':')) + '\n'


def _js(v):
    return json.dumps(v, ensure_ascii=True, separators=(', ', ': '))


def to_ts(baked, out=None):
    """The generated TypeScript text of a baked set (byte-stable). out: the folder the file goes to
    (`--out`), so the engine import is relative to it."""
    slug = baked['slug']
    # An --out folder inside the repo (a mission's own art40 folder) imports the engine relative to itself; a scratch
    # folder outside the repo (the bake test's temp dir) keeps the canonical text, so its bytes equal the fixture.
    inside = out is not None and os.path.abspath(out).startswith(os.path.abspath(ROOT) + os.sep)
    rel = os.path.relpath(os.path.join(ROOT, 'src', 'engine', 'baked'), out if inside else canonical_out(slug)).replace(os.sep, '/')
    if not rel.startswith('.'):
        rel = './' + rel
    L = [f'// GENERATED - do not edit. Made by `npm run art40 -- {slug}` from tools/art40/chars/{slug}/',
         '// (docs/api/media.md "Baked sets"). Edit the set module and bake again.',
         f"import type {{ BakedSet }} from '{rel}';",
         '']
    # Pixel streams used by more than one frame are written once (P[i]): gzip only sees repeats
    # inside its 32 KB window, a set repeats frames across strips.
    count = {}
    for st in baked['strips'].values():
        for f in st['frames']:
            count[f['px']] = count.get(f['px'], 0) + 1
    shared = {}
    for st in baked['strips'].values():
        for f in st['frames']:
            if count[f['px']] > 1 and len(f['px']) > 8 and f['px'] not in shared:
                shared[f['px']] = len(shared)
    if shared:
        L.append('/** Pixel streams of more than one frame. */')
        L.append('const P: readonly string[] = [')
        for px in shared:
            L.append(f'  {_js(px)},')
        L.append('];')
        L.append('')
    L += ['export const SET: BakedSet = {']
    for k in ('v', 'slug', 'prefix', 'budget', 'face'):
        L.append(f'  {k}: {_js(baked[k])},')
    L.append(f'  pal: {_js(baked["pal"])},')
    L.append(f'  outline: {baked["outline"]},')
    for k in ('hl', 'fx'):
        if k in baked:
            L.append(f'  {k}: {_js(baked[k])},')
    if 'variants' in baked:
        L.append('  variants: {')
        for p, pal in baked['variants'].items():
            L.append(f'    {_js(p)}: {_js(pal)},')
        L.append('  },')
    L.append('  strips: {')
    for name, st in baked['strips'].items():
        L.append(f'    {_js(name)}: {{')
        L.append('      frames: [')
        for f in st['frames']:
            px = f'P[{shared[f["px"]]}]' if f['px'] in shared else _js(f['px'])
            parts = [f'w: {f["w"]}', f'h: {f["h"]}', f'ox: {f["ox"]}', f'oy: {f["oy"]}', f'px: {px}']
            if 'pts' in f:
                parts.append('pts: { ' + ', '.join(f'{_js(k)}: [{v[0]}, {v[1]}]' for k, v in f['pts'].items()) + ' }')
            if f.get('smear'):
                parts.append('smear: true')
            L.append('        { ' + ', '.join(parts) + ' },')
        L.append('      ],')
        L.append(f'      durations: {_js(st["durations"])},')
        L.append(f'      loop: {"true" if st["loop"] else "false"},')
        if st.get('defer'):
            L.append('      defer: true,')
        L.append(f'      cls: {_js(st["cls"])},')
        if 'why' in st:
            L.append(f'      why: {_js(st["why"])},')
        if 'face' in st:
            L.append(f'      face: {st["face"]},')
        L.append('    },')
    L.append('  },')
    if 'events' in baked:
        L.append('  events: { ' + ', '.join(f'{k}: {v}' for k, v in baked['events'].items()) + ' },')
    L.append('};')
    if 'events' in baked:
        L.append('')
        for k, v in baked['events'].items():
            L.append(f'export const {k} = {v};')
    return '\n'.join(L) + '\n'


def to_render_json(render):
    return json.dumps(render, sort_keys=True, separators=(',', ':')) + '\n'


# ------------------------------------------------------------------------------ authoring helpers
def _flat(meta, dx, dy, out, skip=('root',)):
    for k, v in meta.items():
        if k in skip:
            continue
        if isinstance(v, dict):
            for kk, p in v.items():
                out[f'{k}.{kk}'] = (p[0] + dx, p[1] + dy)
        elif isinstance(v, tuple) and len(v) == 2:
            out[k] = (v[0] + dx, v[1] + dy)


def humanoid(upper, lower):
    """castkit.humanoid with the points: returns (rows, root, pts), the rows pixel-identical to
    castkit.humanoid. pts holds every rig joint in rows coordinates:
    - the upper body (moved onto the legs' pelvis like the pixels): 'pel', 'torso.neck',
      'head.neck', 'armN.wrist', 'armN.elbow', 'armN.muzzle' (a gun), 'armF.wrist', ...;
    - the legs: 'legN.hip', 'legN.knee', 'legN.ankle', 'legN.ground' (the floor point under the
      ankle: the planted foot's contact) and the same for 'legF'.
    Pass all of them as the frame's joints (the smoothness gate measures every joint) and pick and
    rename the ones the game reads as pts:
        rows, root, j = X.humanoid(up, lo)
        X.Frame(rows, root, pts={'muzzle': j['armN.muzzle'], 'plant': j['legN.ground']}, joints=j)
    (X.plant(frames) sets 'plant' on a walk cycle for you.)"""
    import castkit as K
    import pose
    up = dict(upper)
    up['pelvis'] = (0, -17)
    lx, ly = lower.get('pelvis', (0, -17))
    dx, dy = round(lx), round(ly + 17)
    layers = []
    br = pose.compose(up, 'back')[0]
    if br:
        layers.append((br, dx, dy))
    lrows, lmeta = pose.compose(lower, 'lower')
    layers.append((lrows, 0, 0))
    urows, umeta = pose.compose(up, 'upper')
    layers.append((urows, dx, dy))
    rows, root = K.stack(layers, pose.W, pose.H), feet_root()
    pts = {}
    _flat(lmeta, 0, 0, pts, skip=('root', 'pel'))
    _flat(umeta, dx, dy, pts)
    return rows, root, pts


def feet_root():
    """The feet anchor of a kit figure in rows coordinates. The kit's root (rig.RX, rig.RY) is the
    row the soles' bottom outline is drawn ON; the engine's 'feet' anchor is the line just under the
    last pixel row (oy == h). So a kit figure's anchor is (RX, RY + 1): with (RX, RY) every standing
    frame would sink 1 px into the floor (wave 0 verify)."""
    import pose
    return (pose.RX, pose.RY + 1)


def full(p):
    """castkit.full (a one-piece pose: a death, a sit, a ride) with the feet anchor and the joints:
    returns (rows, root, pts) like humanoid."""
    import pose
    rows, meta = pose.compose(p, 'full')
    pts = {}
    _flat(meta, 0, 0, pts)
    return rows, feet_root(), pts


def plant(frames, ground_y=None, tol=1):
    """Set the foot-gate point 'plant' on a walk / run cycle of Frames that carry the leg joints
    (X.humanoid's 'legN.ground' / 'legF.ground', with 'legN.ankle' / 'legF.ankle'): on each frame
    the foot whose ankle is lowest (within tol px of the lowest ankle of the strip) is the planted
    one; a frame with both feet up gets no plant. Returns the frames (changed in place)."""
    def ank(f, k):
        return f.joints.get(k + '.ankle') or f.pts.get(k + '.ankle')
    lows = [max(a[1] for a in (ank(f, 'legN'), ank(f, 'legF')) if a) for f in frames if ank(f, 'legN') or ank(f, 'legF')]
    if not lows:
        raise SetError('X.plant: the frames carry no leg joints (use X.humanoid and joints=)')
    floor = max(lows) if ground_y is None else ground_y

    def down(f):
        return [k for k in ('legN', 'legF') if ank(f, k) and floor - ank(f, k)[1] <= tol]

    # With both feet down, the foot that was planted on the frame before stays planted (a cycle:
    # the last frame is the one before the first).
    prev = None
    for _ in range(2):
        for f in frames:
            d = down(f)
            prev = prev if prev in d else (d[0] if len(d) == 1 else (max(d, key=lambda k: ank(f, k)[1]) if d else None))
            if prev:
                a = ank(f, prev)
                g = f.joints.get(prev + '.ground') or f.pts.get(prev + '.ground')
                f.pts['plant'] = (a[0], g[1] if g else a[1])
            else:
                f.pts.pop('plant', None)
    return frames
