# Bakes the sections of a mission for the GAME (first made for level 1; docs/api/canal.md): each layer of a
# section at the art tier U (env) is cut into tiles of at most COL logical px of layer x (one per column, cropped to its
# opaque box, aligned to whole logical px; empty tiles dropped); the tiles are grouped into camera-window packs, and
# the tiles of a window into colour groups of at most 256 colours each, shelf-packed into lossless PNG sheets (8-bit
# palette + tRNS; a tile with more than 256 colours goes to an 8-bit RGBA sheet). The section's canal sprites (kit
# paintings of things the game draws as entities: the module's `sprites()`, game_sprites.py) go into one sheet per
# tier. Each section has its OWN generated manifest file (<manifest-dir>/<id>.gen.ts) and fixtures index
# (<fixtures>/index-<id>.json); the joining index <manifest-dir>/manifest.gen.ts is regenerated from the section files
# present. Every write happens under one file lock (tools/levelkit/work/.bake.lock), so section agents can bake in
# parallel.
#
#   U=4 python3 tools/levelkit/lk.py <mission> bake l1a [l1b ...] [--out DIR] [--manifest-dir DIR]
#       [--fixtures DIR | --no-fixtures] [--stats]
#
# The defaults come from the mission (mission.py ART, MANIFEST_DIR, FIXTURES; without them public/art/<id>,
# src/game/content/missions/<id>/canal, tests/fixtures/canal/<id>); relative paths are from the repo root.
# A mission with BAKE = False (the look sample) refuses to bake into the defaults: pass every folder.
#
# L1_GAME=1 is set before the kit is imported: a section then leaves out what the game draws as an entity
# (level.GAME, game_sprites.entity).
#
# --fixtures also writes the fidelity reference frames: the kit's own compose_level(sec, cx) (no hero) at the section
# module's GAME_CAMS = [(camera x, the logical screen x the tier-2 / tier-4 crops centre on), ...] (default: five
# cameras from 0 to the end, centred), full frames at tier 1, full-height crops at tiers 2 and 4. Deterministic: two
# bakes of the same kit give the same bytes.
#
# Per tier and layer: rows (real rows of its image), y0 (its top, real px), pw (its width, real px), speed (s0, s1 for
# a rows layer: they come from the real rows' centres, so they differ a little by tier). The tile table of a layer at a
# tier is a flat int list, 8 per tile: frame, x, y, w, h (art px of this tier, relative to the layer image's
# top-left), file (index into the tier's files), sx, sy (art px in that file).
import argparse
import fcntl
import importlib
import inspect
import json
import math
import os
import re
import sys
import time
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, '..', '..', '..'))
os.environ['L1_GAME'] = '1'    # a game bake: entity paintings leave the scene (level.GAME), they become sprites
from level import *            # noqa: E402,F401  (U, VIEW_W, compose_level, P, LAY, ...)
import mission as _M           # noqa: E402  (the mission's tables: ID, ART, MANIFEST_DIR, FIXTURES, FIXTURE_CAMS)
from lkpath import load_module, repo_path, KIT   # noqa: E402

COL = 128                      # logical px of layer x per tile column (128: 20 % less resident than 256, measured)
SHEET = 4096                   # largest sheet side (real px)
WINDOW = 256                   # camera px per pack window
MARGIN = 2                     # logical px of slack in the windows' visibility maths
AHEAD, BEHIND = 256, 64        # the game's loading policy (src/game/mission/canal/store.ts): packs whose window starts
                               # at most AHEAD camera px right of the camera load; a tile is freed BEHIND px after its last
                               # camera
PALETTE = 256                  # colours of a palette sheet
CROP_W = {1: 384, 2: 192, 4: 96}
# The fidelity cameras of a section whose module has no GAME_CAMS (the mission's FIXTURE_CAMS, by section id)
FIXTURE_CAMS = getattr(_M, 'FIXTURE_CAMS', {})
BEGIN, END = '/*BEGIN-SECTION*/', '/*END-SECTION*/'
LOCK = os.path.join(KIT, 'work', '.bake.lock')


def images_of(ly):
    if ly['kind'] in ('rows', 'frames'):
        return list(ly['frames'])
    return [ly['img']]


def speeds(ly):
    if ly['kind'] == 'rows':
        return min(ly['s0'], ly['s1']), max(ly['s0'], ly['s1'])
    return ly['speed'], ly['speed']


def need_range(ly, x0, x1, cam):
    """The camera x range (logical) over which layer x [x0, x1) (logical) can be on screen."""
    if ly['kind'] == 'tile':
        return 0.0, math.inf
    smin, smax = speeds(ly)
    if smax <= 0:
        return (0.0, math.inf) if x0 < VIEW_W + MARGIN else (math.inf, math.inf)
    n0 = max(0.0, (x0 - VIEW_W - MARGIN) / smax)
    n1 = math.inf if smin <= 0 else (x1 + MARGIN) / smin
    return n0, n1


def opaque01(px):
    """Alpha 0 / 255 only (the compose treats any alpha > 0 as opaque); transparent pixels all 0."""
    px[..., 3] = np.where(px[..., 3] > 0, 255, 0).astype(np.uint8)
    px[px[..., 3] == 0] = 0
    return px


def colour_keys(px):
    f = px.reshape(-1, 4).astype(np.uint32)
    return (f[:, 0] << 24) | (f[:, 1] << 16) | (f[:, 2] << 8) | f[:, 3]


def tiles_of(ly, a, fi):
    """Tiles of one frame image (real px array h x w x 4): one per column, cropped to whole logical px."""
    out = []
    h, w = a.shape[:2]
    op = a[..., 3] > 0
    colw = COL * U
    for c in range((w + colw - 1) // colw):
        xa, xb = c * colw, min(w, (c + 1) * colw)
        m = op[:, xa:xb]
        if not m.any():
            continue
        rows = np.where(m.any(axis=1))[0]
        cols = np.where(m.any(axis=0))[0]
        y0 = (rows[0] // U) * U
        y1 = min(h, -(-(rows[-1] + 1) // U) * U)
        x0 = xa + (cols[0] // U) * U
        x1 = min(xb, xa + -(-(cols[-1] + 1) // U) * U)
        px = opaque01(a[y0:y1, x0:x1].copy())
        out.append(dict(frame=fi, col=c, x=int(x0), y=int(y0), w=int(x1 - x0), h=int(y1 - y0), px=px))
    return out


def shelf_pack(tiles):
    """Shelf-pack tiles (sorted tallest first, ties in list order) into sheets of at most SHEET x SHEET."""
    order = sorted(range(len(tiles)), key=lambda i: (-tiles[i]['h'], i))
    sheets, x, y, sh = [], 0, 0, 0
    for i in order:
        t = tiles[i]
        if t['w'] > SHEET or t['h'] > SHEET:
            raise SystemExit('tile larger than a sheet: %s' % ((t['w'], t['h']),))
        if not sheets or x + t['w'] > SHEET:
            x, y, sh = 0, y + sh, 0
        if not sheets or y + t['h'] > SHEET:
            sheets.append([]); x, y, sh = 0, 0, 0
        t['sheet'], t['sx'], t['sy'] = len(sheets) - 1, x, y
        sheets[-1].append(t)
        x += t['w']; sh = max(sh, t['h'])
    return sheets


def colour_groups(tiles):
    """Split tiles into groups of at most PALETTE colours each (greedy, most colourful first, ties in list order): every
       group becomes palette sheets. Tiles with more colours than that form one more group (RGBA sheets)."""
    keys = [set(np.unique(colour_keys(t['px'])).tolist()) for t in tiles]
    groups, rgba = [], []
    for i in sorted(range(len(tiles)), key=lambda i: (-len(keys[i]), i)):
        if len(keys[i]) > PALETTE:
            rgba.append(i)
            continue
        for g in groups:
            u = g['c'] | keys[i]
            if len(u) <= PALETTE:
                g['c'] = u; g['t'].append(i)
                break
        else:
            groups.append(dict(c=set(keys[i]), t=[i]))
    out = [sorted(g['t']) for g in groups]
    if rgba:
        out.append(sorted(rgba))
    return out


def save_png(arr, path):
    """Lossless PNG: 8-bit palette + tRNS when <= 256 colours, else 8-bit RGBA; zlib level 9. Deterministic."""
    h, w = arr.shape[:2]
    key = colour_keys(arr)
    uniq, inv = np.unique(key, return_inverse=True)
    if len(uniq) <= PALETTE:
        pal = np.zeros((len(uniq), 4), np.uint8)
        pal[:, 0] = (uniq >> 24) & 255
        pal[:, 1] = (uniq >> 16) & 255
        pal[:, 2] = (uniq >> 8) & 255
        pal[:, 3] = uniq & 255
        im = Image.fromarray(inv.reshape(h, w).astype(np.uint8), 'P')
        im.putpalette(pal[:, :3].reshape(-1).tolist())
        # tRNS: the alphas up to the last non-opaque entry
        alpha = pal[:, 3]
        last = int(np.max(np.where(alpha < 255)[0])) + 1 if (alpha < 255).any() else 0
        kw = dict(bits=8, compress_level=9)
        if last:
            kw['transparency'] = bytes(alpha[:last].tolist())
        im.save(path, 'PNG', **kw)
        return 'p'
    Image.fromarray(np.ascontiguousarray(arr), 'RGBA').save(path, 'PNG', compress_level=9)
    return 'rgba'


def sheet_of(tiles):
    W = max(t['sx'] + t['w'] for t in tiles)
    H = max(t['sy'] + t['h'] for t in tiles)
    arr = np.zeros((H, W, 4), np.uint8)
    for t in tiles:
        arr[t['sy']:t['sy'] + t['h'], t['sx']:t['sx'] + t['w']] = t['px']
    return arr


def layer_meta(ly):
    # tier-independent facts only (the speeds of a rows layer and its y come from its real rows: per tier)
    d = dict(id=ly['id'], kind=ly['kind'], over=bool(ly.get('over')))
    if ly['kind'] == 'tile':
        d['drift'] = float(ly.get('drift', 0) or 0)
    d['n'] = len(images_of(ly))
    if ly.get('depth') is not None:
        d['depth'] = float(ly['depth'])
    if ly.get('front'):
        d['front'] = True
    return d


# ---------------------------------------------------------------- canal sprites (docs/api/canal.md §7)
def sprite_records(mod, sec):
    """The module's sprites(sec) (or sprites()), as (id, frames, layer, ax, ay, clip) tuples."""
    fn = getattr(mod, 'sprites', None)
    if fn is None:
        return []
    recs = fn(sec) if len(inspect.signature(fn).parameters) >= 1 else fn()
    out = []
    for r in recs or []:
        g = (lambda k, d=None: r.get(k, d)) if isinstance(r, dict) else (lambda k, d=None: getattr(r, k, d))
        L = g('layer')
        frames = g('frames')
        if frames is None:
            frames = [g('frame', 0)]
        ax = g('ax'); ay = g('ay')
        out.append((g('id'), [int(f) for f in frames], L, L.w / 2 if ax is None else ax, L.h if ay is None else ay, bool(g('clip', False))))
    return out


def bake_sprites(mod, sec):
    """Each replaced frame on the game's 1x frame box (LAY['sprites']): the painting point (ax, ay) on the anchor pixel
       (ox, oy). Refuses an unknown id or frame, a frame offered twice, and (without clip) an opaque pixel outside."""
    geo = LAY.get('sprites')
    out, seen = [], set()
    for (sid, frames, L, ax, ay, clip) in sprite_records(mod, sec):
        if geo is None:
            raise SystemExit('the layout has no sprites table: re-run the dump (npx tsx tools/levelkit/dump.ts %s)' % _M.ID)
        if sid not in geo:
            raise SystemExit('sprite %s: not a game sprite id the dump knows (tools/levelkit/dump.ts --prefix)' % sid)
        for fi in frames:
            if not 0 <= fi < len(geo[sid]):
                raise SystemExit('sprite %s: frame %d, the game has %d frames' % (sid, fi, len(geo[sid])))
            if (sid, fi) in seen:
                raise SystemExit('sprite %s frame %d is offered twice' % (sid, fi))
            seen.add((sid, fi))
            g = geo[sid][fi]
            W, H = int(g['w']), int(g['h'])
            arr = np.zeros((H * U, W * U, 4), np.uint8)
            src = L.a
            x0, y0 = P(g['ox'] - ax), P(g['oy'] - ay)
            h, w = src.shape[:2]
            op = src[..., 3] > 0
            xa, ya, xb, yb = max(0, x0), max(0, y0), min(W * U, x0 + w), min(H * U, y0 + h)
            inside = np.zeros_like(op)
            if xb > xa and yb > ya:
                inside[ya - y0:yb - y0, xa - x0:xb - x0] = True
            lost = int((op & ~inside).sum())
            if lost and not clip:
                raise SystemExit('sprite %s frame %d: %d opaque px of the %gx%g painting fall outside the game frame box '
                                 '%dx%d (anchor %d,%d; painting anchor %g,%g). Fit the painting, or pass clip=True.' % (
                                     sid, fi, lost, L.w, L.h, W, H, g['ox'], g['oy'], ax, ay))
            if xb > xa and yb > ya:
                arr[ya:yb, xa:xb] = src[ya - y0:yb - y0, xa - x0:xb - x0]
            opaque01(arr)
            out.append(dict(id=sid, frame=fi, w=W, h=H, ox=int(g['ox']), oy=int(g['oy']), px=arr, lost=lost))
    out.sort(key=lambda s: (s['id'], s['frame']))
    return out


def bake(mod, out_dir, stats=False):
    t0 = time.time()
    sec = mod.build()
    t1 = time.time()
    sid = sec.id
    layers, tiles = [], []
    for li, ly in enumerate(sec.layers):
        ims = images_of(ly)
        im0 = ims[0]
        tl = dict(rows=int(im0.ph), y0=int(P(ly['y'])), pw=int(im0.pw), speed=float(ly['speed']), tiles=[])
        if ly['kind'] == 'rows':
            tl['s0'], tl['s1'] = float(ly['s0']), float(ly['s1'])
        layers.append(tl)
        for fi, im in enumerate(ims):
            for t in tiles_of(ly, im.a, fi):
                t['layer'] = li
                n0, n1 = need_range(ly, t['x'] / U, (t['x'] + t['w']) / U, sec.cam)
                t['n0'], t['n1'] = n0, n1
                t['win'] = int(min(n0, sec.cam) // WINDOW) if n0 != math.inf else -1
                tiles.append(t)
    tiles = [t for t in tiles if t['win'] >= 0]
    sprites = bake_sprites(mod, sec)
    # packs: one per camera window and colour group, each one or more sheets
    files, file_win = [], []
    for f in os.listdir(out_dir):
        if re.fullmatch(r'%s-u%d-(w\d+-\d+|s)\.png' % (re.escape(sid), U), f):
            os.remove(os.path.join(out_dir, f))
    kinds = {'p': 0, 'rgba': 0}
    for win in sorted(set(t['win'] for t in tiles)):
        group = [t for t in tiles if t['win'] == win]
        si = 0
        for cg in colour_groups(group):
            for sh in shelf_pack([group[i] for i in cg]):
                name = '%s-u%d-w%d-%d.png' % (sid, U, win, si)
                si += 1
                kinds[save_png(sheet_of(sh), os.path.join(out_dir, name))] += 1
                fi = len(files)
                files.append(name); file_win.append(win * WINDOW)
                for t in sh:
                    t['file'] = fi
    for t in tiles:
        layers[t['layer']]['tiles'] += [t['frame'], t['x'], t['y'], t['w'], t['h'], t['file'], t['sx'], t['sy']]
    tier = dict(files=files, fileCam=file_win, layers=layers)
    sprite_bytes = 0
    if sprites:
        items = [dict(w=s['w'] * U, h=s['h'] * U, px=s['px']) for s in sprites]
        sheets = shelf_pack(items)
        if len(sheets) > 1:
            raise SystemExit('the sprites of %s need more than one %d px sheet' % (sid, SHEET))
        for s, it in zip(sprites, items):
            s['sx'], s['sy'] = it['sx'], it['sy']
        name = '%s-u%d-s.png' % (sid, U)
        save_png(sheet_of(sheets[0]), os.path.join(out_dir, name))
        sprite_bytes = os.path.getsize(os.path.join(out_dir, name))
        tier['sprites'] = dict(file=name, xy=[v for s in sprites for v in (s['sx'], s['sy'])])
        for s in sprites:
            print('  sprite %s frame %d: %dx%d at anchor %d,%d%s' % (s['id'], s['frame'], s['w'], s['h'], s['ox'], s['oy'],
                                                                      (', %d px clipped' % s['lost']) if s['lost'] else ''))
    meta = dict(id=sid, name=sec.name, width=int(sec.W), cam=int(sec.cam), layers=[layer_meta(ly) for ly in sec.layers])
    if sprites:
        meta['sprites'] = [dict(id=s['id'], frame=s['frame'], w=s['w'], h=s['h'], ox=s['ox'], oy=s['oy']) for s in sprites]
    nbytes = sum(os.path.getsize(os.path.join(out_dir, f)) for f in files) + sprite_bytes
    area = sum(t['w'] * t['h'] for t in tiles)
    print('%s u%d: %d layers, %d tiles, %d files (%d palette), %d sprite frames, %.2f MB png, %.1f M px decoded, build %.0f s, bake %.0f s' % (
        sid, U, len(sec.layers), len(tiles), len(files), kinds['p'], len(sprites), nbytes / 1e6, area / 1e6, t1 - t0, time.time() - t1), flush=True)
    if stats:
        # resident px with the camera-window loading at cameras along the section
        peak = 0
        for cx in range(0, sec.cam + 1, 16):
            loaded = sum(t['w'] * t['h'] for t in tiles if t['win'] * WINDOW <= cx + AHEAD and t['n1'] >= cx - BEHIND)
            vis = sum(t['w'] * t['h'] for t in tiles if t['n0'] <= cx and t['n1'] >= cx)
            peak = max(peak, loaded)
            if cx % 512 == 0:
                print('  cam %4d: visible %.2f M px, window-resident %.2f M px' % (cx, vis / 1e6, loaded / 1e6))
        print('  whole section %.2f M px (%.1f MB as RGBA), window peak %.2f M px (%.1f MB)' % (area / 1e6, area * 4 / 1e6, peak / 1e6, peak * 4 / 1e6))
        for li, ly in enumerate(sec.layers):
            a = sum(t['w'] * t['h'] for t in tiles if t['layer'] == li)
            print('    %-14s %-6s %6.2f M px  %3d tiles' % (ly['id'], ly['kind'], a / 1e6, sum(1 for t in tiles if t['layer'] == li)))
    return sec, meta, tier


# ---------------------------------------------------------------- the generated TypeScript (one file per section)
def ts_import_base(mdir):
    """The import path of src/game/mission/canal/types from the manifest dir (the repo's canal dir by default)."""
    types = os.path.join(REPO, 'src', 'game', 'mission', 'canal', 'types')
    rel = os.path.relpath(types, os.path.abspath(mdir))
    return rel if rel.startswith('.') else './' + rel


def section_path(mdir, sid):
    return os.path.join(mdir, '%s.gen.ts' % sid)


def read_section(mdir, sid):
    p = section_path(mdir, sid)
    if not os.path.exists(p):
        return None
    s = open(p).read()
    a, b = s.find(BEGIN), s.find(END)
    if a < 0 or b < 0:
        return None
    return json.loads(s[a + len(BEGIN):b])


def write_atomic(path, text):
    tmp = path + '.tmp%d' % os.getpid()
    with open(tmp, 'w') as f:
        f.write(text)
    os.replace(tmp, path)


def write_section(mdir, meta, module):
    body = json.dumps(meta, sort_keys=True, separators=(',', ':'))
    ts = ('// GENERATED by tools/levelkit/core/bake_game.py (canal scene %s of mission %s, docs/api/canal.md). Do not edit:\n'
          '// re-bake with  for U in 1 2 4; do U=$U python3 tools/levelkit/lk.py %s bake %s; done\n'
          "import type { CanalSectionManifest } from '%s';\n\n"
          'export const SECTION: CanalSectionManifest = %s%s%s;\n') % (meta['id'], _M.ID, _M.ID, module, ts_import_base(mdir), BEGIN, body, END)
    write_atomic(section_path(mdir, meta['id']), ts)


def write_index(mdir, base):
    """manifest.gen.ts: the bake's loading policy and every section file present (regenerated from the folder)."""
    ids = sorted(m.group(1) for m in (re.fullmatch(r'([a-z0-9]+)\.gen\.ts', f) for f in os.listdir(mdir)) if m and m.group(1) != 'manifest')
    lines = ['// GENERATED by tools/levelkit/core/bake_game.py from the section files in this folder (docs/api/canal.md). Do not edit:',
             '// every bake regenerates it.',
             "import type { CanalManifest } from '%s';" % ts_import_base(mdir)]
    lines += ["import { SECTION as s_%s } from './%s.gen';" % (i, i) for i in ids]
    lines += ['', 'export const CANAL_MANIFEST: CanalManifest = {',
              "  base: '%s'," % base, '  col: %d,' % COL, '  window: %d,' % WINDOW, '  ahead: %d,' % AHEAD, '  behind: %d,' % BEHIND,
              '  sections: { %s },' % ', '.join('%s: s_%s' % (i, i) for i in ids), '};', '']
    write_atomic(os.path.join(mdir, 'manifest.gen.ts'), '\n'.join(lines))


def game_cams(mod, sec):
    cams = getattr(mod, 'GAME_CAMS', None) or FIXTURE_CAMS.get(sec.id)
    if not cams:
        cams = [(int(round(sec.cam * k / 4)), 192) for k in range(5)]
    return [(int(cx), int(xc)) for (cx, xc) in cams]


def fixture_frames(mod, sec):
    """The fidelity reference frames (computed before the lock): (index entry, RGB array) per camera."""
    cw = CROP_W[U]
    out = []
    for (cx, xc) in game_cams(mod, sec):
        fr = compose_level(sec, cx)
        x0 = int(max(0, min(VIEW_W - cw, xc - cw // 2)))
        rgb = np.ascontiguousarray(fr.a[:, x0 * U:(x0 + cw) * U, :3])
        out.append((dict(section=sec.id, tier=U, cx=cx, x0=x0, w=cw, file='%s-u%d-c%d.png' % (sec.id, U, cx)), rgb))
    return out


def write_fixtures(sec, frames, fdir):
    os.makedirs(fdir, exist_ok=True)
    ip = os.path.join(fdir, 'index-%s.json' % sec.id)
    idx = json.load(open(ip)) if os.path.exists(ip) else []
    idx = [e for e in idx if e['tier'] != U]
    for f in os.listdir(fdir):
        if re.fullmatch(r'%s-u%d-c\d+\.png' % (re.escape(sec.id), U), f):
            os.remove(os.path.join(fdir, f))
    for (e, rgb) in frames:
        Image.fromarray(rgb, 'RGB').save(os.path.join(fdir, e['file']), 'PNG', compress_level=9)
        idx.append(e)
    idx.sort(key=lambda e: (e['tier'], e['cx']))
    write_atomic(ip, json.dumps(idx, indent=1, sort_keys=True) + '\n')


def main():
    ap = argparse.ArgumentParser(prog='lk.py %s bake' % _M.ID)
    ap.add_argument('mods', nargs='+', help='section modules (mission folder) or .py files')
    ap.add_argument('--out', help='the PNG folder (default: mission ART or public/art/<id>)')
    ap.add_argument('--manifest-dir', dest='mdir', help='default: mission MANIFEST_DIR or src/game/content/missions/<id>/canal')
    ap.add_argument('--manifest', help='(old) a file in the manifest folder: its folder is used')
    ap.add_argument('--fixtures', help='default: mission FIXTURES or tests/fixtures/canal/<id>')
    ap.add_argument('--no-fixtures', action='store_true', help='bake the art only (never for the repo: art and fixtures go together)')
    ap.add_argument('--stats', action='store_true')
    a = ap.parse_args()
    given = a.out and (a.mdir or a.manifest) and (a.fixtures or a.no_fixtures)
    if getattr(_M, 'BAKE', True) is False and not given:
        raise SystemExit('mission %s does not bake into the game: pass --out, --manifest-dir and --fixtures (or '
                         '--no-fixtures) to bake into a scratch folder' % _M.ID)
    a.out = repo_path(a.out or getattr(_M, 'ART', 'public/art/%s' % _M.ID))
    mdir = a.mdir or (os.path.dirname(a.manifest) if a.manifest else None) or getattr(_M, 'MANIFEST_DIR', 'src/game/content/missions/%s/canal' % _M.ID)
    mdir = repo_path(mdir)
    a.fixtures = None if a.no_fixtures else repo_path(a.fixtures or getattr(_M, 'FIXTURES', 'tests/fixtures/canal/%s' % _M.ID))
    os.makedirs(os.path.dirname(LOCK), exist_ok=True)
    rel = lambda p: os.path.relpath(p, REPO) if os.path.abspath(p).startswith(REPO + os.sep) else os.path.abspath(p)
    print('bake %s u%d -> %s, %s, %s' % (_M.ID, U, rel(a.out), rel(mdir), rel(a.fixtures) if a.fixtures else '(no fixtures)'), flush=True)
    os.makedirs(a.out, exist_ok=True)
    os.makedirs(mdir, exist_ok=True)
    base = 'art/' + os.path.basename(os.path.normpath(a.out)) + '/'
    for name in a.mods:
        mod = load_module(name)
        sec, meta, tier = bake(mod, a.out, a.stats)
        frames = fixture_frames(mod, sec) if a.fixtures else None
        with open(LOCK, 'w') as lk:
            fcntl.flock(lk, fcntl.LOCK_EX)
            cur = read_section(mdir, sec.id)
            tiers = (cur or {}).get('tiers', {})
            same = cur and all(json.dumps(cur.get(k), sort_keys=True) == json.dumps(meta.get(k), sort_keys=True) for k in ('layers', 'sprites'))
            if cur and not same:
                # the layer or sprite list changed: the other tiers' tables no longer fit it
                stale = [k for k in tiers if k != str(U)]
                if stale:
                    print('  layer / sprite list of %s changed: dropping tiers %s from its manifest (re-bake them)' % (sec.id, ','.join(stale)))
                tiers = {}
            tiers[str(U)] = tier
            meta['tiers'] = tiers
            mf = os.path.abspath(mod.__file__)
            here = os.path.dirname(mf) == os.environ.get('LK_MISSION_DIR')
            write_section(mdir, meta, mod.__name__ if here else os.path.relpath(mf, REPO))
            write_index(mdir, base)
            if frames is not None:
                write_fixtures(sec, frames, a.fixtures)
            fcntl.flock(lk, fcntl.LOCK_UN)


if __name__ == '__main__':
    main()
