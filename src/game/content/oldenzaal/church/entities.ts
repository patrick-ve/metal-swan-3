/**
 * The church's set-piece entities (CHURCH, wave B; docs/design/oldenzaal.md §7; the opening
 * contract of docs/api/oldenzaal.md R2.5). All are static, neutral and never hit (team
 * 'neutral', no hurt boxes): the church's objects are never damaged by shots (respect, spec §7);
 * every effect here is cosmetic (`world.fxRng`, particles, sfx) and changes no game state except
 * the opening's own `closed` / `busy` flags.
 *
 * - `oz-slab` (OZ_CHURCH.slab): a grave slab in the nave floor; a `ZombieOpening` of kind 'slab'
 *   (tell: it cracks, chips lift; open: it breaks up, the fragments tilt out of the floor).
 * - `oz-tomb` (OZ_CHURCH.tomb): a tomb chest in the crypt; kind 'tomb' (tell: the lid grinds;
 *   open: the lid slides off and leans on the chest). While a zombie climbs out, the tomb draws in
 *   front of it (the zombie rises from inside the chest).
 * - `oz-chapel-gate`: the side chapel's iron grille; kind 'door' (tell: it rattles; open: the gate
 *   swings open and stays open, so a whole column can come out of it, one after another).
 * - `oz-crypt-stairwell`: the dark stair to the crypt in the choir; an invisible kind-'door'
 *   opening (the dead come up the stair; it never closes).
 * - `oz-nave-doors`: the red west doors; `slam()` (the set piece: the doors slam shut behind the
 *   squad). Open, they let in the cold moonlight (a light for the light pass).
 * - `oz-crypt-gate`: the iron gate across the crypt; `swingOpen()` after the locked fight (the
 *   script owns the body wall that holds the squad back).
 * - `oz-church-ambient`: an invisible helper: dust motes drifting in the view (crypt) and water
 *   dripping somewhere in the dark (a sfx every few seconds).
 */
import type { Color } from '../../../../engine/color';
import { Entity } from '../../../../engine/entity';
import { PAL_HD_OZ } from '../../../../engine/palette-hd';
import type { Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { debris, dust } from '../../../fx';
import { defineEntity, paramNum, type SpawnParams } from '../../../registry';
import { OZ_CHURCH } from '../../missions/oldenzaal/ids';
import { LIGHT_TAG, type LightSource, type LightSpot } from '../kit/light-api';
import { OZ_OPENING_TAG, type OpeningKind, type ZombieOpening } from '../zombies/api';

/** Entity ids of the church (besides `OZ_CHURCH.slab` / `.tomb`). */
export const OZ_CHURCH_ENTITY = {
  slab: OZ_CHURCH.slab,
  tomb: OZ_CHURCH.tomb,
  chapelGate: 'oz-chapel-gate',
  stairwell: 'oz-crypt-stairwell',
  doors: 'oz-nave-doors',
  cryptGate: 'oz-crypt-gate',
  ambient: 'oz-church-ambient',
} as const;

/** The church's sfx (synth recipes in content/sfx/oldenzaal-church.ts). */
export const OZ_CHURCH_SFX = {
  slabCrack: 'oz/church/slab-crack',
  slabBreak: 'oz/church/slab-break',
  lidGrind: 'oz/church/lid-grind',
  lidFall: 'oz/church/lid-fall',
  grilleRattle: 'oz/church/grille-rattle',
  gateCreak: 'oz/church/gate-creak',
  doorsSlam: 'oz/church/doors-slam',
  organ: 'oz/church/organ-moan',
  candles: 'oz/church/candles',
  drip: 'oz/church/drip',
} as const;

/** A static, neutral church object (no hitbox: never hit, never in the way). */
abstract class ChurchProp extends Entity {
  frameNo = 0;
  constructor(world: World, x: number, y: number, z: number) {
    super(world, x, y);
    this.team = 'neutral';
    this.hitbox = { x: 0, y: 0, w: 0, h: 0 };
    this.despawnMargin = Infinity;
    this.z = z;
  }

  override hurtboxes(): readonly never[] {
    return [];
  }

  override contactBoxes(): readonly never[] {
    return [];
  }

  /** Never damaged (the church's objects; respect, spec §7). */
  override onHit(): boolean {
    return false;
  }
}

/** The common part of an opening (the contract's flags and the tell timer). */
abstract class Opening extends ChurchProp implements ZombieOpening {
  abstract readonly openingKind: OpeningKind;
  readonly outDir: -1 | 0 | 1;
  closed = true;
  busy = false;
  protected tellLeft = 0;
  protected tellLen = 1;
  protected openT = -1;

  constructor(world: World, x: number, y: number, z: number, outDir: -1 | 0 | 1) {
    super(world, x, y, z);
    this.outDir = outDir;
    this.addTag(OZ_OPENING_TAG);
  }

  get spotX(): number {
    return this.x;
  }

  get floorY(): number {
    return this.y;
  }

  tell(ticks: number): void {
    this.tellLen = Math.max(1, ticks);
    this.tellLeft = this.tellLen;
    this.onTell();
  }

  open(dirX: -1 | 0 | 1): void {
    this.tellLeft = 0;
    if (!this.closed) return;
    this.closed = false;
    this.openT = 0;
    this.onOpen(dirX);
  }

  protected onTell(): void {}
  protected abstract onOpen(dirX: -1 | 0 | 1): void;

  override update(): void {
    if (this.tellLeft > 0) this.tellLeft--;
    if (this.openT >= 0) this.openT++;
  }
}

// =============================================================================================
// The grave slab
// =============================================================================================

export class OzSlab extends Opening {
  readonly openingKind = 'slab' as const;

  constructor(world: World, x: number, y: number) {
    super(world, x, y, 4, 0);
  }

  protected override onTell(): void {
    this.world.audio.sfx(OZ_CHURCH_SFX.slabCrack, { vol: 0.6 });
  }

  protected onOpen(): void {
    const w = this.world;
    debris(w, this.x, this.y - 2, 'rock', 7);
    dust(w, this.x - 8, this.y, 3);
    dust(w, this.x + 8, this.y, 3);
    w.audio.sfx(OZ_CHURCH_SFX.slabBreak, { vol: 0.8 });
    w.camera.shake(1, 8);
  }

  override update(): void {
    super.update();
    if (this.closed) {
      this.frameNo = this.tellLeft > 0 ? (this.tellLeft > this.tellLen / 2 ? 1 : 2) : this.frameNo;
      if (this.tellLeft > 0 && this.tellLeft % 9 === 4) dust(this.world, this.x + this.world.fxRng.range(-12, 12), this.y, 1);
    } else this.frameNo = 3;
  }

  override draw(r: Renderer): void {
    r.sprite('prop/oz-slab/slab', this.frameNo, this.x, this.y);
  }
}

// =============================================================================================
// The tomb
// =============================================================================================

/** Ticks the tomb keeps drawing in front after its zombie is out (it steps off the chest). */
const TOMB_FRONT_AFTER = 8;

export class OzTomb extends Opening {
  readonly openingKind = 'tomb' as const;
  private frontLeft = 0;

  constructor(world: World, x: number, y: number) {
    super(world, x, y, 5, 0);
  }

  protected override onTell(): void {
    this.world.audio.sfx(OZ_CHURCH_SFX.lidGrind, { vol: 0.7 });
  }

  protected onOpen(dirX: -1 | 0 | 1): void {
    const w = this.world;
    dust(w, this.x + 22, this.y, 4);
    dust(w, this.x + (dirX || 1) * 6, this.y - 24, 3);
    w.audio.sfx(OZ_CHURCH_SFX.lidFall, { vol: 0.8 });
    w.camera.shake(1, 10);
  }

  override update(): void {
    super.update();
    if (this.closed) {
      if (this.tellLeft > 0) {
        this.frameNo = this.tellLeft > this.tellLen / 2 ? 1 : 2;
        if (this.tellLeft % 7 === 3) dust(this.world, this.x + this.world.fxRng.range(-20, 20), this.y - 22, 1);
      }
    } else this.frameNo = 3;
    // While its zombie climbs out, the chest is drawn in front of it.
    if (this.busy) this.frontLeft = TOMB_FRONT_AFTER;
    else if (this.frontLeft > 0) this.frontLeft--;
    this.z = this.busy || this.frontLeft > 0 ? 31 : 5;
  }

  override draw(r: Renderer): void {
    r.sprite('prop/oz-tomb/tomb', this.frameNo, this.x, this.y);
  }
}

// =============================================================================================
// The chapel's grille (a reusable door: a column comes out of it)
// =============================================================================================

export class OzChapelGate extends Opening {
  readonly openingKind = 'door' as const;
  private shakeT = 0;

  constructor(world: World, x: number, y: number) {
    super(world, x, y, 3, -1);
  }

  protected override onTell(): void {
    this.shakeT = Math.min(this.tellLen, 40);
    if (this.closed) this.world.audio.sfx(OZ_CHURCH_SFX.grilleRattle, { vol: 0.7 });
  }

  /** It opens once and stays open (the next zombies of the column come through it as well). */
  override open(dirX: -1 | 0 | 1): void {
    super.open(dirX);
    this.closed = false;
  }

  protected onOpen(): void {
    this.world.audio.sfx(OZ_CHURCH_SFX.gateCreak, { vol: 0.8 });
    dust(this.world, this.x, this.y, 4);
  }

  override update(): void {
    super.update();
    if (this.shakeT > 0) this.shakeT--;
    this.frameNo = this.closed ? 0 : this.openT >= 0 && this.openT < 10 ? 1 : 2;
  }

  override draw(r: Renderer): void {
    const jig = this.shakeT > 0 && this.closed ? ((this.shakeT >> 1) & 1 ? 1 : -1) * 0.5 : 0;
    r.sprite('decor/oz-nave/grille', this.frameNo, this.x + jig, this.y);
  }
}

// =============================================================================================
// The crypt's stairwell in the choir (an invisible, reusable door)
// =============================================================================================

export class OzStairwell extends Opening {
  readonly openingKind = 'door' as const;

  constructor(world: World, x: number, y: number) {
    super(world, x, y, 3, -1);
  }

  protected override onTell(): void {
    dust(this.world, this.x, this.y - 2, 2);
  }

  override open(dirX: -1 | 0 | 1): void {
    super.open(dirX);
    this.closed = false;
  }

  protected onOpen(): void {}
}

// =============================================================================================
// The red west doors (they slam shut behind the squad)
// =============================================================================================

export class OzNaveDoors extends ChurchProp implements LightSource {
  private slamT = -1;
  private readonly moon: Color = PAL_HD_OZ.night[6];

  constructor(world: World, x: number, y: number) {
    super(world, x, y, 2);
    this.addTag(LIGHT_TAG);
  }

  get shut(): boolean {
    return this.slamT >= 6;
  }

  /** The set piece: the doors slam shut (6 ticks), the hall booms, dust falls. */
  slam(): void {
    if (this.slamT >= 0) return;
    this.slamT = 0;
    const w = this.world;
    w.audio.sfx(OZ_CHURCH_SFX.doorsSlam, { vol: 1 });
    w.camera.shake(3, 18);
  }

  override update(): void {
    if (this.slamT >= 0) {
      this.slamT++;
      if (this.slamT === 6) {
        const w = this.world;
        dust(w, this.x - 14, this.y, 4);
        dust(w, this.x + 14, this.y, 4);
        for (let i = 0; i < 5; i++) w.particles.debris(this.x + w.fxRng.range(-30, 30), this.y - 70 - w.fxRng.range(0, 30), 1);
      }
    }
    this.frameNo = this.slamT < 0 ? 0 : Math.min(3, 1 + (this.slamT >> 1));
  }

  lightOf(out: LightSpot): boolean {
    if (this.frameNo >= 3) return false;
    out.x = this.x + 18;
    out.y = this.y - 30;
    out.r = this.frameNo === 0 ? 72 : 40;
    out.color = this.moon;
    out.intensity = 0.8;
    out.flicker = 0;
    return true;
  }

  override draw(r: Renderer): void {
    r.sprite('decor/oz-nave/doors', this.frameNo, this.x, this.y);
  }
}

// =============================================================================================
// The crypt's iron gate
// =============================================================================================

export class OzCryptGate extends ChurchProp {
  private openT = -1;

  constructor(world: World, x: number, y: number) {
    super(world, x, y, 3);
  }

  get isOpen(): boolean {
    return this.openT >= 0;
  }

  /** It creaks open (after the locked fight). */
  swingOpen(): void {
    if (this.openT >= 0) return;
    this.openT = 0;
    this.world.audio.sfx(OZ_CHURCH_SFX.gateCreak, { vol: 0.9 });
    dust(this.world, this.x, this.y, 3);
  }

  override update(): void {
    if (this.openT >= 0) this.openT++;
    this.frameNo = this.openT < 0 ? 0 : this.openT < 14 ? 1 : 2;
  }

  override draw(r: Renderer): void {
    r.sprite('decor/oz-crypt/gate', this.frameNo, this.x, this.y);
  }
}

// =============================================================================================
// The ambient helper: dust motes and dripping water
// =============================================================================================

const MOTES = 28;

export class OzChurchAmbient extends ChurchProp {
  /** Draw dust motes in the view. */
  readonly motes: boolean;
  /** Ticks between drips (0 = none). */
  readonly dripEvery: number;
  private readonly moteColor: Color = PAL_HD_OZ.sandstone[6];

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, 40);
    this.motes = paramNum(p, 'motes', 0) > 0;
    this.dripEvery = paramNum(p, 'drip', 0);
  }

  private nextDrip = 90;
  private t = 0;

  override update(): void {
    this.t++;
    const e = this.dripEvery;
    // A drip somewhere in the dark at hashed intervals (deterministic; sound only).
    if (e > 0 && this.t >= this.nextDrip) {
      const k = (this.t * 2654435761) >>> 0;
      const pan = ((k % 15) / 7 - 1) * 0.7;
      this.world.audio.sfx(OZ_CHURCH_SFX.drip, { vol: 0.35, pan, pitch: 0.9 + ((k >> 4) % 5) * 0.05 });
      this.nextDrip = this.t + Math.round(e * (0.6 + ((k >> 8) % 9) / 10));
    }
  }

  override draw(r: Renderer): void {
    if (!this.motes) return;
    const cam = this.world.camera;
    const t = this.world.tick;
    for (let i = 0; i < MOTES; i++) {
      // A slow drift: each mote's own path (a hash of i), wrapping inside the view.
      const sx = ((i * 97.13 + t * (0.05 + (i % 5) * 0.02)) % 400) - 8;
      const sy = ((i * 53.7 + Math.sin(t * 0.01 + i) * 6 + t * 0.03 * ((i % 3) - 1)) % 160 + 160) % 160 + 20;
      const a = 0.25 + 0.2 * Math.sin(t * 0.03 + i * 1.7);
      r.rect(cam.left + sx, cam.top + sy, 1, 1, this.moteColor, { alpha: a });
    }
  }
}

defineEntity(OZ_CHURCH_ENTITY.slab, (w, x, y) => new OzSlab(w, x, y), {
  category: 'prop',
  description: 'oldenzaal: a grave slab in the nave floor (a ZombieOpening: it cracks, then breaks open). Never damaged.',
});
defineEntity(OZ_CHURCH_ENTITY.tomb, (w, x, y) => new OzTomb(w, x, y), {
  category: 'prop',
  description: 'oldenzaal: a tomb chest in the crypt (a ZombieOpening: the lid grinds, then slides off). Never damaged.',
});
defineEntity(OZ_CHURCH_ENTITY.chapelGate, (w, x, y) => new OzChapelGate(w, x, y), {
  category: 'prop',
  description: 'oldenzaal: the side chapel iron grille (a reusable ZombieOpening door: it rattles, opens, stays open).',
});
defineEntity(OZ_CHURCH_ENTITY.stairwell, (w, x, y) => new OzStairwell(w, x, y), {
  category: 'prop',
  description: 'oldenzaal: the stair down to the crypt (an invisible, reusable ZombieOpening door: the dead come up).',
});
defineEntity(OZ_CHURCH_ENTITY.doors, (w, x, y) => new OzNaveDoors(w, x, y), {
  category: 'prop',
  description: 'oldenzaal: the red west doors of the nave; slam() shuts them (a light while open).',
});
defineEntity(OZ_CHURCH_ENTITY.cryptGate, (w, x, y) => new OzCryptGate(w, x, y), {
  category: 'prop',
  description: 'oldenzaal: the iron gate across the crypt; swingOpen() after the locked fight.',
});
defineEntity(OZ_CHURCH_ENTITY.ambient, (w, x, y, p) => new OzChurchAmbient(w, x, y, p), {
  category: 'fx',
  description: 'oldenzaal: dust motes (motes 1) and dripping water every `drip` ticks in the church.',
});
