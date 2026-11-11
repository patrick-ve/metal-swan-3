# Canal sprites: kit paintings of things the GAME draws as entities (docs/api/canal.md §7).
#
# A breakable rack, a stall, a cart, a boat that moves or carries the player keeps its entity in the game (hitbox,
# script, frames), but it should show the kit's painting. The page and the previews paint such a thing into the
# scene at its spawn x; a game bake (L1_GAME=1, set by bake_game.py) leaves it out of the scene and offers the painting
# as a SPRITE instead: the bake writes it per tier next to the section's packs, and the game draws it in place of the
# given frames of the sprite id while the section's canal scene is on.
#
# In a section's build(), for a thing the game draws as an entity:
#
#     from game_sprites import entity, sprites            # `sprites` is the hook bake_game.py calls
#     entity(sec, 'decor/ams/ams-bike-rack', bike_rack(random.Random(690), w=50, nbikes=2), 690, 0)
#
# entity() puts the painting like sec.put() (same x, depth, ax, front) on the page; in a game bake it records it
# (once per sprite id: the game has ONE picture per id and frame, see the note below) and paints nothing, not even
# the contact shade on the floor (the entity casts its own). At bake time sprites(sec) grades the recorded paintings
# as the section grades its walk plane (Sec.flush: key + curve, 5-bit colours) and returns the records.
#
# The record's geometry is the game's: the bake reads the game's 1x frame (w, h, ox, oy) of every replaced frame from
# the layout `sprites` (tools/levelkit/dump.ts) and places the painting so that the painting point (ax, ay) lands on the
# frame's anchor pixel (ox, oy). With the kit's put() convention (the painting stands ON the row 176 - depth, its
# anchor ax from the left, default the middle) that is ax = put's ax, ay = the painting's height. A painting with an
# opaque pixel outside the game's frame box is refused (clip=True crops it and reports the pixels lost).
#
# One picture per id: two racks of one section share the sprite 'decor/ams/ams-bike-rack', so the first painting
# offered wins (a later different one is reported). A section that needs two looks needs two game ids (a frame
# chosen by a spawn parameter): that is a game change, not an art one.
import os
import numpy as np
from level import GAME, LAY, Sec, grader, curve, snap5, Layer, U

_SEC_PUT = Sec.put              # the plain put (a proof module may patch Sec.put to divert tagged parts here)
GEOMETRY = LAY.get('sprites', {})


class Sprite:
    """One canal sprite record: the game's sprite id, the frame indices it replaces, the painting (a kit Layer,
       graded) and the painting point that lands on the frame's anchor pixel."""

    def __init__(s, id_, frames, layer, ax=None, ay=None, clip=False):
        s.id = id_
        s.frames = list(frames)
        s.layer = layer
        s.ax = layer.w / 2 if ax is None else ax
        s.ay = layer.h if ay is None else ay
        s.clip = clip

    def __repr__(s):
        return 'Sprite(%s %s, %gx%g, anchor %g,%g)' % (s.id, s.frames, s.layer.w, s.layer.h, s.ax, s.ay)


def walk_grade(sec, depth=0, front=False):
    """The grade Sec.flush gives the plane at this depth: the light of the hour (key) and the curve, 5-bit colours.
       (A section that grades a plane further, e.g. the depth air of l1a for depths > 0, passes its own grade.)"""
    def fn(L):
        L.recolor(grader(key=sec.KEY))
        L.recolor(curve(*sec.H['curve']))
        L.a[..., :3] = snap5(L.a[..., :3])
        return L
    return fn


def entity(sec, sprite_id, part, x, depth=0, frames=(0,), ax=None, shade=True, front=False, flip=False, grade=None, clip=False):
    """Stand a part the game draws as an entity. Page / previews: sec.put (painted at its spawn x). Game bake: recorded
       as sprite `sprite_id` (frames), painted nowhere. Returns the plane depth (page) or None (game)."""
    if not GAME:
        return _SEC_PUT(sec, part, x, depth, ax=ax, shade=shade, flip=flip, front=front)
    if flip:
        part = part.flip()
    recs = sec.notes.setdefault('game_sprites', [])
    for r, _ in recs:
        if r.id == sprite_id and set(r.frames) & set(frames):
            if r.layer.a.shape != part.a.shape or not np.array_equal(r.layer.a, part.a):
                print('  [sprites] %s: a second painting at x %g is not used (one picture per id and frame; the first '
                      'one wins)' % (sprite_id, x), flush=True)
            return None
    recs.append((Sprite(sprite_id, frames, part, ax=ax, clip=clip), grade or walk_grade(sec, depth, front)))
    return None


def sprites(sec):
    """The section's canal sprites (the hook bake_game.py calls after build()): the recorded paintings, graded."""
    out = []
    for r, grade in sec.notes.get('game_sprites', []):
        L = Layer(r.layer.w, r.layer.h)
        L.a = r.layer.a.copy()
        grade(L)
        out.append(Sprite(r.id, r.frames, L, ax=r.ax, ay=r.ay, clip=r.clip))
    return out


def tag(part, sprite_id, **kw):
    """Mark a painting as the entity `sprite_id` (for a module that diverts Sec.put: see proof_l1a.py)."""
    part.game_sprite = (sprite_id, kw)
    return part


def divert_tagged_puts():
    """Patch Sec.put so a tagged part (tag()) goes through entity(): lets a wrapper module turn a section's existing
       sec.put(...) calls into entities without editing the section file."""
    def put(s, part, x, depth, ax=None, base=None, shade=True, flip=False, front=False):
        t = getattr(part, 'game_sprite', None)
        if t is not None and base is None:
            sid, kw = t
            return entity(s, sid, part, x, depth, ax=ax, shade=shade, front=front, flip=flip, **kw)
        return _SEC_PUT(s, part, x, depth, ax=ax, base=base, shade=shade, flip=flip, front=front)
    Sec.put = put
