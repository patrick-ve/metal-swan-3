/**
 * The `hostage` entity and its kinds (GDD §2.3, §7.2). Sprites: hostage.art.ts
 * (`item/hostage/<kind>/<anim>`); binds: binds.ts.
 *
 * Params: `kind` (`critic` default · `roadie` · `tea-lady` · `tourist` · `composer` (the hidden
 * 1UP; old name `maestro`) · `dollop`), `bind` (`chair` default · `cage` · `sack` · `float` ·
 * `balloon`, see binds.ts for their own params), `drop` (aliases `gives`, `item`: any drop value,
 * default `auto` = the kind's table: critic A, roadie B, tea-lady C, tourist D; the composer
 * always gives `1up`, Mrs. Dollop her van), `facing`.
 * Mrs. Dollop only: `shedX` (where her van rolls out; default 40 px behind her), `vanTo` (the
 * van's `rollTo` param), `van` (vehicle id, default `sundae-driver`).
 *
 * Every hostage: freed → +500 and +1 tally → walks to its rescuer → its kind's gag → gives
 * (the gift pops from the hand) → a curtain-call bow → runs off left (GDD §7.2).
 */
import type { Entity } from '../../../engine/entity';
import type { Renderer } from '../../../engine/render';
import { hasSprite } from '../../../engine/sprites';
import type { World } from '../../../engine/world';
import { hudOf } from '../../context';
import { Enemy } from '../../enemy';
import { FxEntity } from '../../fx';
import { Hostage, type HostageKind } from '../../hostage';
import { defineEntity, hasEntity, paramNum, paramStr, type SpawnParams } from '../../registry';
import { makeBind } from './binds';
import { contentsSpecs, KIND_TABLES } from './drops';
import { HOSTAGE_KINDS, type HostageKindId } from './ids';

export { HOSTAGE_KINDS, type HostageKindId };

/** Old kind names that still work. */
const KIND_ALIASES: Readonly<Record<string, HostageKindId>> = { maestro: 'composer' };

/** SAY CHEESE (GDD §7.2 tourist): non-boss enemies on screen hold the photo pose this long. */
export const PHOTO_TICKS = 45;

const pt = { x: 0, y: 0 };
const starOpts = { flipX: false };

/** A cosmetic effect at a point (sparkles, notes, the camera flash). */
function fx(world: World, sprite: string, x: number, y: number, o: { vx?: number; vy?: number; life?: number; wobble?: number; z?: number } = {}): void {
  if (!hasSprite(sprite)) return;
  FxEntity.spawn(world, { sprite, x, y, vx: o.vx ?? 0, vy: o.vy ?? 0, life: o.life, wobble: o.wobble, loop: o.life !== undefined, z: o.z ?? 61 });
}

// ---------------------------------------------------------------------------------------------
// Kinds
// ---------------------------------------------------------------------------------------------

/** The critic: scribbles for 20 ticks, then holds up a card with 3–5 stars (fxRng). */
const CRITIC: HostageKind = {
  id: 'critic',
  gagTicks: 56,
  gag(h, t) {
    if (t === 0) h.gagValue = 3 + h.world.fxRng.int(0, 2);
  },
  gagFrame(_h, t) {
    return t < 20 ? (t >> 2) & 1 : 2 + ((t >> 3) & 1);
  },
  drawFront(h, r) {
    if (h.state !== 'gag' || h.stateT <= 20 || !h.pointOf('card', pt)) return;
    drawStars(r, pt.x, pt.y, h.gagValue);
  },
};

/** Up to 3 stars on the top row of the card, the rest below (3 × 3 px each, 4 px apart). */
function drawStars(r: Renderer, cx: number, cy: number, n: number): void {
  const top = Math.min(3, n);
  const bottom = n - top;
  for (let i = 0; i < top; i++) r.sprite('item/hostage/star', 0, cx - (top - 1) * 2 + i * 4, cy - 2, starOpts);
  for (let i = 0; i < bottom; i++) r.sprite('item/hostage/star', 0, cx - (bottom - 1) * 2 + i * 4, cy + 2, starOpts);
}

/** The roadie: carries the gift out like a heavy amp case, puffs, opens it and leaves the case. */
const ROADIE: HostageKind = {
  id: 'roadie',
  gagTicks: 32,
  anims: { walk: 'carry' },
  gag(h, t) {
    if (t === 12) hudOf(h.world).bubble(h, 'PHEW!', { ticks: 24, kind: 'gag' });
  },
  gagFrame(_h, t) {
    return t < 10 ? 0 : t < 20 ? 1 : 2 + ((t >> 2) & 1);
  },
  gave(h) {
    // The empty case stays behind for a moment.
    if (hasSprite('item/hostage/case-open')) {
      FxEntity.spawn(h.world, { sprite: 'item/hostage/case-open', x: h.x + h.facing * 9, y: h.y, flipX: h.facing < 0, loop: true, life: 120, z: h.z - 1 });
    }
  },
};

/** The tea lady: pours a cup of tea, drinks it herself, then gives the gift. */
const TEA_LADY: HostageKind = {
  id: 'tea-lady',
  gagTicks: 60,
  gag(h, t) {
    if (t % 10 === 4 && t < 48 && h.pointOf('cup', pt)) fx(h.world, 'item/hostage/steam', pt.x, pt.y - 2, { vy: -0.35, life: 24, wobble: 1 });
    if (t === 48) hudOf(h.world).bubble(h, 'AAH.', { ticks: 20, kind: 'gag' });
  },
  gagFrame(_h, t) {
    return t < 24 ? (t >> 3) & 1 : t < 48 ? 2 : 3;
  },
};

/**
 * The tourist: SAY CHEESE! — the camera flashes and every non-boss enemy on screen freezes in
 * the photo pose for 45 ticks (GDD §7.2).
 */
const TOURIST: HostageKind = {
  id: 'tourist',
  gagTicks: 40,
  gag(h, t) {
    if (t === 0) hudOf(h.world).bubble(h, 'SAY CHEESE!', { ticks: 36, kind: 'gag', speaker: 'tourist' });
    if (t === 24) sayCheese(h);
  },
  gagFrame(_h, t) {
    return t < 12 ? 0 : t < 24 ? 1 : t < 30 ? 2 : 3;
  },
};

/** The camera flash: sound, a white flash, and the photo pose for every non-boss enemy on screen. */
export function sayCheese(h: Hostage): number {
  const world = h.world;
  world.audio.sfx('hostage/camera');
  if (h.pointOf('flash', pt)) fx(world, 'item/hostage/flash', pt.x, pt.y, { z: 62 });
  hudOf(world).screenFlash(0xffffffff, 0.35, 6);
  let n = 0;
  const list = world.snapshotTag('enemy');
  try {
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!(e instanceof Enemy) || !e.alive || e.hasTag('boss') || !e.onScreen(0)) continue;
      if (e.react('photo', PHOTO_TICKS, h)) n++;
    }
  } finally {
    world.releaseSnapshot();
  }
  return n;
}

/** The composer (the hidden 1UP): conducts a 4-note phrase with his eyes closed. */
const COMPOSER: HostageKind = {
  id: 'composer',
  gagTicks: 64,
  gag(h, t) {
    if (t === 0) h.world.audio.sfx('hostage/composer');
    if (t % 16 === 2 && h.pointOf('baton', pt)) fx(h.world, 'item/hostage/note', pt.x, pt.y, { vx: h.facing * 0.2, vy: -0.5, life: 36, wobble: 2 });
  },
  gagFrame(_h, t) {
    return (t >> 4) & 3;
  },
};

/**
 * Mrs. Dollop (m2-a story hostage): complains, points at her shed — and her van rolls out of it
 * (the gift appears at `shedX`, GDD §11.2 m2-a).
 */
const DOLLOP: HostageKind = {
  id: 'dollop',
  gagTicks: 120,
  gag(h, t) {
    const shed = shedX(h);
    if (t === 0) hudOf(h.world).bubble(h, 'THEY ATE ALL\nMY SPRINKLES!', { ticks: 58, kind: 'hint' });
    if (t === 60) {
      h.facing = shed < h.x ? -1 : 1;
      hudOf(h.world).bubble(h, 'TAKE MY VAN.\nNOT A SCRATCH, MIND!', { ticks: 90, kind: 'hint' });
    }
  },
  gagFrame(_h, t) {
    return t < 60 ? (t >> 3) & 1 : 2 + ((t >> 4) & 1);
  },
  giftAt(h) {
    const x = shedX(h);
    const y = h.world.terrain.surfaceY(x, h.y - 40, h.y + 40);
    return { x, y: Number.isFinite(y) ? y : h.y };
  },
};

function shedX(h: Hostage): number {
  return paramNum(h.params, 'shedX', h.homeX + 40);
}

export const KINDS: Readonly<Record<HostageKindId, HostageKind>> = {
  critic: CRITIC,
  roadie: ROADIE,
  'tea-lady': TEA_LADY,
  tourist: TOURIST,
  composer: COMPOSER,
  dollop: DOLLOP,
};

/** A kind id from a param ('maestro' → 'composer'; unknown → 'critic'). */
export function kindId(v: string): HostageKindId {
  const k = KIND_ALIASES[v] ?? v;
  return (HOSTAGE_KINDS as readonly string[]).includes(k) ? (k as HostageKindId) : 'critic';
}

/** What a kind gives when the script says nothing (or `auto`). */
function defaultDrop(kind: HostageKindId, p: SpawnParams): unknown {
  if (kind === 'composer') return '1up';
  if (kind === 'dollop') {
    const van = paramStr(p, 'van', 'sundae-driver');
    if (!hasEntity(van)) return 'repair';
    const vanTo = p.vanTo;
    return typeof vanTo === 'number' ? { id: van, params: { rollTo: vanTo } } : { id: van };
  }
  return 'auto';
}

// ---------------------------------------------------------------------------------------------
// The entity
// ---------------------------------------------------------------------------------------------

/** Build a hostage from spawn params (also used by tests and tools). */
export function makeHostage(world: World, x: number, y: number, p: SpawnParams): Hostage {
  const id = kindId(paramStr(p, 'kind', 'critic'));
  const art = paramStr(p, 'art', hasSprite(`item/hostage/${id}/tied`) ? `item/hostage/${id}` : 'item/hostage');
  let value = p.drop ?? p.gives ?? p.item;
  if (value === undefined || ((id === 'composer' || id === 'dollop') && value === 'auto')) value = defaultDrop(id, p);
  const item = contentsSpecs(value, world, KIND_TABLES[id] ?? 'table-a')[0] ?? null;
  const bind = makeBind(paramStr(p, 'bind', 'chair'), p, y);
  return new Hostage(world, x, y, { ...p, art, item }, { kind: KINDS[id], bind });
}

defineEntity('hostage', makeHostage, {
  category: 'hostage',
  description: 'Tied-up captive (params kind, bind, drop). Freed: +500, walks over, gag, gift, bow, runs off.',
});

/** Is this entity a hostage of the given kind? (Mission scripts: wait for Mrs. Dollop.) */
export function isHostage(e: Entity, kind?: string): e is Hostage {
  return e instanceof Hostage && (kind === undefined || e.kind?.id === kindId(kind));
}
