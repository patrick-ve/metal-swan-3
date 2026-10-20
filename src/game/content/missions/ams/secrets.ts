/**
 * Secrets of mission ams (docs/design/ams-extras.md §5): `ams-secret`, a small shootable spot on
 * a piece of decor. Registers at import time; art: `secrets.art.ts`.
 *
 * Not an enemy: team 'enemy' only so that player shots, the knife and blasts reach it (the
 * breakables' pattern), tags `shootable` / `soft` / `prop` / `secret`, never `enemy` (no wave,
 * no kill, `waitClear` ignores it). `hits` hits (1–3, default 2), any knife or any blast reveal
 * it: a sparkle and a chime, +100 points, the prop's reveal frames (it stays as decor) and what
 * it hides comes out:
 *
 * - pickups (any drop value: `medal`, `golden-note`, `cheese`, `1up`, `{ id, params }`; a list
 *   gives every item of it) pop out and stay (not timed out like dropped loot);
 * - `hostage` (or `{ id: 'hostage', params }`): a tourist tied to a chair drops out and is freed
 *   as usual; it counts in `MissionDef.hostages` (`HIDDEN_TOURISTS`).
 *
 * A subtle hint: a glint (`decor/ams/secret-glint`) every `SECRET.glintEvery` ticks at the look's
 * glint point (each secret at its own phase).
 *
 * | param | default | |
 * |---|---|---|
 * | `look` | `spot` | `hoist` (y = the hook of a gable hoist beam), `tree-bike`, `museum-crate`, `canal-bike`, `hatch` (y = the cabin roof), `chest` (feet anchors), `spot` (no art: a hit area centred on (x, y)) |
 * | `hides` | `gem` | a drop value, a list of them (all spawn) or `hostage` |
 * | `hits` | 2 | 1–3 |
 * | `w`, `h` | 14, 12 | the `spot` hit area |
 *
 * Scripts: `secret(ctx, x, y, opts)` places one; `placeSecrets(ctx, sectionId)` places the
 * section's row of `AMS_SECRETS` (the mission's secrets in one table: at least one per section,
 * exactly one hidden 1UP); `secretArt(sectionId)` lists the sprites a section's `art` needs.
 */
import { Entity, type Damage } from '../../../../engine/entity';
import type { Rect } from '../../../../engine/math';
import type { ParticlePreset } from '../../../../engine/particles';
import { PAL } from '../../../../engine/palette';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { hash2 } from '../../../art/paint';
import { awardScore } from '../../../events';
import { debris, type DebrisKind } from '../../../fx';
import type { SectionContext } from '../../../mission/index';
import { defineEntity, paramNum, paramStr, type SpawnParams, type SpawnSpec } from '../../../registry';
import { contentsSpecs } from '../../items/drops';
import { sfxNear } from '../../props/common';
import { SECRET_GLINT, SECRET_PROPS, secretSprite, type SecretProp } from './secrets.art';
import { A_BOATS, B_HOTDOG_X, C2_FAR_ROOF_Y, C2_HOUSEBOAT, G, ROOF_Y } from './terrain';

export { SECRET_ART, SECRET_GLINT, SECRET_PROPS, secretSprite, type SecretProp } from './secrets.art';

export type SecretLook = SecretProp | 'spot';
/** What a secret hides: a drop value, a list of them (every one spawns) or `hostage`. */
export type SecretHide = string | SpawnSpec | readonly (string | SpawnSpec)[];

export const SECRET = {
  /** Hits that reveal it (param `hits`, clamped to 1–3); a knife or a blast reveals at once. */
  hits: 2,
  score: 100,
  /** The hint glint: every `glintEvery` ticks (each secret at its own phase), `glintTicks` long. */
  glintEvery: 210,
  glintTicks: 16,
  /** Ticks of the reveal frame (1) before the revealed frame (2). */
  revealTicks: 10,
  /** Pop of what comes out: pickups fan out `fan` px/tick apart. */
  popVy: -2.2,
  fan: 0.6,
  /** Pop of a hidden tourist out of its hiding place. */
  hostagePopVy: -2.4,
  /** The `spot` hit area (params `w`, `h`). */
  spotW: 14,
  spotH: 12,
} as const;

/** Per look: hit box and the glint / out points (offsets from the anchor), the reveal's debris and sounds, z. */
export interface SecretLookDef {
  box: Rect;
  glint: readonly [number, number];
  out: readonly [number, number];
  debris: DebrisKind | null;
  /** A hit that does not reveal yet. */
  knock: string;
  /** The reveal. */
  crack: string;
  z: number;
}

export const SECRET_LOOKS: Readonly<Record<SecretLook, SecretLookDef>> = {
  hoist: { box: { x: -6, y: 13, w: 12, h: 11 }, glint: [-3, 15], out: [0, 19], debris: 'wood', knock: 'hit/drum', crack: 'item/crate-break', z: 6 },
  'tree-bike': { box: { x: -11, y: -18, w: 22, h: 15 }, glint: [-1, -18], out: [0, -10], debris: 'plant', knock: 'hit/metal', crack: 'hit/metal', z: 6 },
  'museum-crate': { box: { x: -15, y: -22, w: 30, h: 22 }, glint: [-11, -19], out: [0, -4], debris: 'wood', knock: 'hit/drum', crack: 'item/crate-break', z: 20 },
  'canal-bike': { box: { x: -12, y: -17, w: 24, h: 17 }, glint: [6, -15], out: [6, -14], debris: 'plant', knock: 'hit/metal', crack: 'hit/metal', z: 20 },
  hatch: { box: { x: -7, y: -8, w: 14, h: 8 }, glint: [3, -8], out: [1, -6], debris: 'wood', knock: 'hit/drum', crack: 'item/crate-break', z: 20 },
  chest: { box: { x: -9, y: -14, w: 18, h: 14 }, glint: [-5, -12], out: [0, -10], debris: 'wood', knock: 'hit/drum', crack: 'item/crate-break', z: 20 },
  spot: { box: { x: -7, y: -6, w: 14, h: 12 }, glint: [0, 0], out: [0, 0], debris: null, knock: 'hit/drum', crack: 'item/crate-break', z: 6 },
};

const LOOKS = new Set<string>([...SECRET_PROPS, 'spot']);

/** The reveal's sparkle: gold and white specks flying up and out. */
const SPARKLE: ParticlePreset = {
  kind: 'pixel',
  life: [18, 34],
  gravity: 0.05,
  drag: 0.93,
  colors: [PAL.snow[3], PAL.gold[3], PAL.gold[2]],
  fadeFrom: 0.6,
};

const drawOpts: DrawOpts = {};

export class AmsSecret extends Entity {
  readonly look: SecretLook;
  readonly def: SecretLookDef;
  readonly hides: unknown;
  /** Hits still needed. */
  hitsLeft: number;
  revealed = false;
  /** Ticks since the reveal (−1 before it). */
  revealT = -1;
  /** What came out at the reveal (pickups, the hostage). */
  readonly spawned: Entity[] = [];
  private wobble = 0;
  private readonly sprite: string | null;
  private readonly glintPhase: number;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y);
    const look = paramStr(p, 'look', 'spot');
    this.look = LOOKS.has(look) ? (look as SecretLook) : 'spot';
    this.def = SECRET_LOOKS[this.look];
    this.team = 'enemy';
    this.z = this.def.z;
    this.hides = p.hides ?? 'gem';
    this.hitsLeft = Math.max(1, Math.min(3, Math.round(paramNum(p, 'hits', SECRET.hits))));
    if (this.look === 'spot') {
      const w = paramNum(p, 'w', SECRET.spotW);
      const h = paramNum(p, 'h', SECRET.spotH);
      this.hitbox = { x: -w / 2, y: -h / 2, w, h };
    } else this.hitbox = { ...this.def.box };
    this.sprite = this.look === 'spot' ? null : secretSprite(this.look);
    this.glintPhase = Math.floor(hash2(Math.round(x), Math.round(y), 17) * SECRET.glintEvery);
    this.despawnMargin = 200;
    this.addTag('shootable', 'soft', 'prop', 'secret');
  }

  override onHit(d: Damage): boolean {
    if (this.revealed || d.amount <= 0) return false;
    if (d.kind === 'knife' || d.kind === 'explosion') this.hitsLeft = 0;
    else this.hitsLeft--;
    this.flashTicks = 3;
    this.wobble = 8;
    if (this.hitsLeft <= 0) this.reveal(d.owner ?? -1);
    else sfxNear(this.world, this.x, this.y, this.def.knock, 0.45, 1.4);
    return true;
  }

  override die(d?: Damage): void {
    this.reveal(d?.owner ?? -1);
  }

  /** Reveal it now (`owner` = the slot that gets the points): the sparkle, +100, what it hides. */
  reveal(owner = -1): void {
    if (this.revealed) return;
    this.revealed = true;
    this.revealT = 0;
    this.removeTag('shootable');
    this.removeTag('soft');
    const w = this.world;
    const x = this.x + this.def.out[0];
    const y = this.y + this.def.out[1];
    awardScore(w, owner, SECRET.score, this.x, this.y + this.hitbox.y - 4);
    if (this.def.debris) debris(w, x, y, this.def.debris, 6);
    sfxNear(w, this.x, this.y, this.def.crack, 0.7);
    sfxNear(w, this.x, this.y, 'ui/star', 0.8);
    w.particles.burst(SPARKLE, x, y, 12, 0.6, 2, -Math.PI / 2, 2.4);
    this.spawnHidden(x, y);
  }

  private spawnHidden(x: number, y: number): void {
    const w = this.world;
    const list = Array.isArray(this.hides) ? (this.hides as unknown[]) : [this.hides];
    const specs: SpawnSpec[] = [];
    for (const item of list) {
      if (item === 'hostage' || (item && typeof item === 'object' && (item as SpawnSpec).id === 'hostage')) {
        const params = item && typeof item === 'object' ? (item as SpawnSpec).params : undefined;
        const h = w.spawn('hostage', x, y, { kind: 'tourist', bind: 'chair', drop: 'auto', ...params });
        h.vy = SECRET.hostagePopVy;
        this.spawned.push(h);
      } else specs.push(...contentsSpecs(item, w, 'crate'));
    }
    specs.forEach((s, i) => {
      const off = specs.length > 1 ? i - (specs.length - 1) / 2 : 0;
      const e = w.spawn(s.id, x + off * 6, y, { ...s.params });
      e.vx = off * SECRET.fan;
      e.vy = SECRET.popVy;
      this.spawned.push(e);
    });
  }

  override update(): void {
    if (this.wobble > 0) this.wobble--;
    if (this.revealT >= 0 && this.revealT < SECRET.revealTicks) this.revealT++;
  }

  override draw(r: Renderer): void {
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    if (this.sprite) {
      const dx = this.wobble > 0 ? ((this.wobble >> 1) & 1 ? 1 : -1) : 0;
      drawOpts.flash = !this.revealed && this.flashTicks > 0;
      r.sprite(this.sprite, this.revealT < 0 ? 0 : this.revealT < SECRET.revealTicks ? 1 : 2, x + dx, y, drawOpts);
      drawOpts.flash = false;
    }
    if (this.revealed) return;
    const t = (this.world.tick + this.glintPhase) % SECRET.glintEvery;
    if (t < SECRET.glintTicks) r.sprite(SECRET_GLINT, Math.min(3, ((t * 4) / SECRET.glintTicks) | 0), x + this.def.glint[0], y + this.def.glint[1], drawOpts);
  }
}

defineEntity('ams-secret', (w, x, y, p) => new AmsSecret(w, x, y, p), {
  category: 'prop',
  score: SECRET.score,
  description: 'ams secret: a shootable spot on decor (params look, hides, hits, w, h) that reveals pickups, the hidden 1UP or a tied tourist.',
});

// ============================================================================== script helpers

export interface SecretOpts {
  look?: SecretLook;
  hides?: SecretHide;
  hits?: number;
  w?: number;
  h?: number;
}

/** Place a secret (`y` 'ground' = the ground line under x): `secret(ctx, 1146, ROOF_Y, { look: 'hatch', hides: 'hostage' })`. */
export function secret(ctx: SectionContext, x: number, y: number | 'ground', opts: SecretOpts = {}): Entity {
  return ctx.spawn('ams-secret', x, y, { ...opts } as SpawnParams);
}

export interface SecretPlacement extends SecretOpts {
  x: number;
  y: number | 'ground';
  /** What a player sees (docs, the report). */
  note: string;
}

/**
 * Every secret of mission ams by section id. a, b and d place theirs from their scripts
 * (`placeSecrets`); the rows of c (the shared quay street before the route split), c1 (the white
 * bridge) and c2 (the canal cruise) are for those scripts (`placeSecrets(ctx, 'c1')` at the
 * script start, `...secretArt('c1')` in the section's `art`). Exactly one hides the 1UP; the
 * hidden tourists count in `MissionDef.hostages` (none on the c routes, so both routes keep the
 * same total).
 */
export const AMS_SECRETS: Readonly<Record<string, readonly SecretPlacement[]>> = {
  a: [
    { x: 646, y: 128, look: 'tree-bike', hides: 'medal', note: 'a red bike caught on a branch under the elm at x 620' },
    { x: A_BOATS[0].cx + A_BOATS[0].cw - 16, y: ROOF_Y, look: 'hatch', hides: 'hostage', note: 'the roof hatch of the first houseboat in the side canal: a hidden tourist' },
    { x: 2500, y: 76, look: 'hoist', hides: ['golden-note', 'golden-note', 'golden-note'], note: 'a crate on the hoist-beam hook of a shopping-street gable (beam 2499, 71)' },
  ],
  b: [
    { x: 470, y: 'ground', look: 'museum-crate', hides: 'hostage', note: 'a museum crate NIET OPENEN in the Rijksmuseum passage: a hidden tourist' },
    { x: B_HOTDOG_X + 65, y: G - 57, look: 'spot', hides: '1up', w: 14, h: 10, note: "the hot-dog stand's red roof flag: the hidden 1UP" },
  ],
  c: [{ x: 534, y: 'ground', look: 'canal-bike', hides: 'medal', note: 'a rusty bike fished out of the canal, leaning on the lamp post (520) of the quay before the canal' }],
  c1: [{ x: 300, y: 82, look: 'hoist', hides: ['cheese', 'golden-note', 'golden-note'], note: "a crate hanging from the first white-bridge portal's balance beam, over the deck" }],
  c2: [
    { x: C2_HOUSEBOAT.cx + 50, y: C2_FAR_ROOF_Y, look: 'hatch', hides: 'medal', note: "the roof hatch of the moored houseboat (the c2 tourist's boat), right of the tourist" },
  ],
  d: [{ x: 446, y: 'ground', look: 'chest', hides: ['gem', 'golden-note', 'golden-note'], note: 'an old chest at the Waterlooplein flea market' }],
};

/** Hidden tourists per section id (they count in `MissionDef.hostages`). */
export const HIDDEN_TOURISTS: Readonly<Record<string, number>> = Object.fromEntries(
  Object.entries(AMS_SECRETS).map(([id, list]) => [id, list.filter((s) => s.hides === 'hostage').length]),
);

/** Place a section's secrets (`AMS_SECRETS[sectionId]`); returns them. */
export function placeSecrets(ctx: SectionContext, sectionId: string): Entity[] {
  return (AMS_SECRETS[sectionId] ?? []).map(({ x, y, note: _note, ...opts }) => secret(ctx, x, y, opts));
}

/** The sprite ids a section's secrets draw (its `SectionDef.art`): the glint and the props of its looks. */
export function secretArt(sectionId: string): string[] {
  const out = new Set<string>();
  for (const s of AMS_SECRETS[sectionId] ?? []) {
    out.add(SECRET_GLINT);
    if (s.look && s.look !== 'spot') out.add(secretSprite(s.look));
  }
  return [...out];
}
