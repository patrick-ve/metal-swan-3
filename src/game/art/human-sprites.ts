/**
 * Sprite-set builders on top of the humanoid rig (docs/ARCHITECTURE.md §6.1 sprite contract).
 *
 * - `definePlayerSprites(id, style, opts)` registers the whole `char/<id>/…` contract: split
 *   legs (with `hip`) and torsos per weapon pose (with `muzzle` / `hand`), full-body
 *   animations and a menu portrait.
 * - `defineSoldierSprites(id, style, opts)` registers the `enemy/<id>/…` contract for a rifle
 *   soldier (full-body frames, `muzzle` on shoot frames, `hand` on throw frames).
 * The player sets also register their 2× art (`defineSprite(id, gen, { hi })`, used only by a
 * mission with `artDensity: 2`): every strip rendered again by the rig at density 2, with the
 * same logical geometry (docs/ART_GUIDE.md "2x art (mission ams)").
 * A new character or enemy is one style object plus optional pose overrides (ART_GUIDE.md §5).
 */
import type { Color } from '../../engine/color';
import { PixelBuffer } from '../../engine/pixel';
import { INK, PAL } from '../../engine/palette';
import type { Frame } from '../../engine/render';
import { defineSprite } from '../../engine/sprites';
import type { SpriteOpts } from '../../engine/sprites';
import { liftHi } from './hi';
import { crumble, scorch, sootify, withFlames } from './human-fx';
import { renderHuman } from './humanoid';
import type { ArmPose, Density, HumanStyle, Pose, RenderPart, WeaponPose } from './humanoid';
import * as P from './poses';

export type FrameList = Frame[];

/** Render a list of poses for one part (`density` 2: the 2× frames). */
export function poseFrames(style: HumanStyle, poses: readonly Pose[], part: 'full' | 'upper' | 'lower' = 'full', density: Density = 1): FrameList {
  return poses.map((p) => renderHuman(style, p, part, density));
}

/** Arms swing against the legs (walk / run cycles without a weapon). */
export function withSwing(poses: readonly Pose[], k: number, elbow: number): Pose[] {
  return poses.map((p) => {
    const n = p.legN?.hip ?? 0;
    const f = p.legF?.hip ?? 0;
    const armN: ArmPose = { sh: -n * k + 4, el: elbow, hand: 'fist' };
    const armF: ArmPose = { sh: -f * k + 4, el: elbow, hand: 'fist' };
    return { ...p, armN, armF };
  });
}

/**
 * Burning death: two flaming frames, soot statue, two crumble frames, ash pile. `density` 2: the
 * figure at 2× under the same flames and crumbling (lifted from the 1× effect with `liftHi`).
 */
export function burnFrames(style: HumanStyle, base: Pose = {}, seed = 9, density: Density = 1): FrameList {
  const out: FrameList = [];
  const statuePose: Pose = { ...base, ...P.STAND, armN: { sh: 30, el: 60, hand: 'open' }, armF: { sh: -20, el: 50, hand: 'open' }, expr: 'soot' };
  if (density === 1) {
    P.BURN.forEach((p, i) => out.push(withFlames(scorch(renderHuman(style, { ...base, ...p }, 'full'), 1), i * 2 + 1, seed)));
    const statue = sootify(renderHuman(style, statuePose, 'full'), 1, true, seed);
    out.push(withFlames(statue, 5, seed + 3, 3));
    out.push(statue);
    out.push(crumble(statue, 0.35, seed));
    out.push(crumble(statue, 0.7, seed));
    out.push(crumble(statue, 1, seed));
    return out;
  }
  // withFlames pads the frame by 2 px on the left and height + 2 on top; crumble by 4 on the left.
  const flames = (f1: Frame, f2: Frame, phase: number, s: number, height = 7): Frame =>
    liftHi(withFlames(f1, phase, s, height), f1.buf, f2.buf, 2, height + 2);
  P.BURN.forEach((p, i) => {
    const pose = { ...base, ...p };
    out.push(flames(scorch(renderHuman(style, pose, 'full'), 1), scorch(renderHuman(style, pose, 'full', 2), 1), i * 2 + 1, seed));
  });
  const s1 = sootify(renderHuman(style, statuePose, 'full'), 1, true, seed);
  const s2 = sootify(renderHuman(style, statuePose, 'full', 2), 1, true, seed);
  out.push(flames(s1, s2, 5, seed + 3, 3));
  out.push(s2);
  for (const t of [0.35, 0.7, 1]) out.push(liftHi(crumble(s1, t, seed), s1.buf, s2.buf, 4, 0));
  return out;
}

/** Explosion death: a scorched (two shades darker), tumbling launch (DIE_BLAST). */
export function blastFrames(style: HumanStyle, base: Pose = {}, density: Density = 1): FrameList {
  return P.DIE_BLAST.map((p) => scorch(renderHuman(style, { ...base, ...p }, 'full', density), 2));
}

function def(id: string, gen: () => FrameList, opts: SpriteOpts): void {
  defineSprite(id, gen, opts);
}

/** A strip recipe at either density. */
type DGen = (d: Density) => FrameList | Frame | PixelBuffer;

/** Register a player strip with its 2× art: the same recipe at density 1 and 2. */
function defHi(id: string, gen: DGen, opts: SpriteOpts): void {
  defineSprite(id, () => gen(1), { ...opts, hi: () => gen(2) });
}

// ------------------------------------------------------------------------------------ player

/** Strips a character may decorate with props (`withPieces`) after the rig rendered them. */
export type DecoratedAnim = 'bored' | 'victory' | 'die' | 'salute' | 'knife';

export interface PlayerArtOpts {
  /** Full-body idle fidget (≥ 4 frames). Default: stretch and yawn. */
  bored?: readonly Pose[];
  /** Victory frames (≥ 2). Default: fist pump. */
  victory?: readonly Pose[];
  /** Death by a hit (≥ 6 frames; the game shows about 60 ticks). Default: DIE. */
  die?: readonly Pose[];
  /** The continue-gag salute (2 frames, GDD §13.9). Default: SALUTE. */
  salute?: readonly Pose[];
  /** Torso idle frames (≥ 2) over the weapon pose. Default: BREATH. */
  idle?: readonly Pose[];
  /** Knife strip frames (≥ 4) with the gun carried low; a knife-look prop via `held`. Default: KNIFE. */
  knife?: readonly Pose[];
  /** Legs run cycle (8 frames). Default: RUN. */
  run?: readonly Pose[];
  /** Fields under every torso frame, e.g. `{ flutter: 1 }`: a scarf that always trails. */
  torso?: Pose;
  /** Per-frame durations of the custom strips (else the default timing). */
  durations?: Readonly<Partial<Record<DecoratedAnim, readonly number[]>>>;
  /** Add props to a strip after the rig rendered it (gets the frames and their poses). */
  decorate?: Readonly<Partial<Record<DecoratedAnim, (frames: FrameList, poses: readonly Pose[]) => FrameList>>>;
  /**
   * Status art variants (`StatusEffectDef.art`): infix → a pose transform. Each one registers
   * `<infix>-torso-<w>-<anim>`, `<infix>-bored` and `<infix>-victory` with the transformed poses
   * (Helium Head: `{ helium: (p) => ({ ...p, headScale: 2 }) }`); the player falls back to the
   * normal strip for anything else.
   */
  variants?: Readonly<Record<string, (p: Pose) => Pose>>;
}

/** Default fidget: a big stretch with a yawn, then a scratch of the head. */
export const BORED_STRETCH: readonly Pose[] = [
  { ...P.STAND, armN: { sh: 10, el: 30 }, armF: { sh: -6, el: 26 } },
  { ...P.STAND, armN: { to: [-2, -11], hand: 'fist' }, armF: { to: [4, -12], hand: 'fist' }, lean: -6, expr: 'yawn' },
  { ...P.STAND, armN: { to: [-3, -12], hand: 'fist' }, armF: { to: [3, -13], hand: 'fist' }, lean: -8, expr: 'yawn', bob: -1 },
  { ...P.STAND, armN: { to: [-2, -11], hand: 'fist' }, armF: { to: [4, -12], hand: 'fist' }, lean: -4, expr: 'blink' },
  { ...P.STAND, armN: { to: [0, -12], hand: 'open' }, armF: { sh: -6, el: 26 }, expr: 'blink' },
  { ...P.STAND, armN: { to: [-1, -12], hand: 'open' }, armF: { sh: -6, el: 26 }, expr: 'normal' },
];

/**
 * Register the full player sprite contract for `char/<id>/…`. Legs are anchored at the feet
 * with a `hip` point; torsos are anchored at the hip; full-body frames at the feet.
 */
export function definePlayerSprites(id: string, style: HumanStyle, o: PlayerArtOpts = {}): void {
  const pre = `char/${id}/`;
  const lower = (poses: readonly Pose[]) => (d: Density): FrameList => poseFrames(style, poses, 'lower', d);
  const full = (poses: readonly Pose[]) => (d: Density): FrameList => poseFrames(style, poses, 'full', d);
  /** Render poses, then let the character add its props to that strip (2× frames: logical px). */
  const deco = (name: DecoratedAnim, poses: readonly Pose[], part: RenderPart) => (d: Density): FrameList => {
    const frames = poseFrames(style, poses, part, d);
    const add = o.decorate?.[name];
    return add ? add(frames, poses) : frames;
  };
  const timing = (name: DecoratedAnim, fallback: SpriteOpts, loop?: boolean): SpriteOpts => {
    const d = o.durations?.[name];
    const t: SpriteOpts = d ? { durations: d } : { ...fallback };
    if (loop !== undefined) t.loop = loop;
    return t;
  };

  defHi(pre + 'legs-idle', lower([P.STAND]), { ticksPerFrame: 30 });
  defHi(pre + 'legs-run', lower(o.run ?? P.RUN), { ticksPerFrame: 4 });
  defHi(pre + 'legs-jump', lower(P.JUMP), { ticksPerFrame: 6, loop: false });
  defHi(pre + 'legs-fall', lower([P.FALL]), { ticksPerFrame: 30 });
  defHi(pre + 'legs-land', lower([P.LAND]), { ticksPerFrame: 6, loop: false });
  defHi(pre + 'legs-crouch', lower([P.CROUCH]), { ticksPerFrame: 30 });
  defHi(pre + 'legs-crouch-walk', lower(P.CROUCH_WALK), { ticksPerFrame: 6 });

  // The torso set and the idle / victory strips, plain and for every status art variant.
  const sets: Array<[string, (p: Pose) => Pose]> = [['', (p) => p]];
  for (const [infix, fx] of Object.entries(o.variants ?? {})) sets.push([infix + '-', fx]);
  for (const [vx, fx] of sets) {
    const upper = (poses: readonly Pose[]) => (d: Density): FrameList => poseFrames(style, poses.map(fx), 'upper', d);
    for (const w of ['pistol', 'heavy'] as const satisfies readonly WeaponPose[]) {
      const t = `${pre}${vx}torso-${w}-`;
      const base: Pose = { ...o.torso, weapon: w };
      const kick = w === 'pistol' ? 2 : 1;
      defHi(t + 'idle', upper(P.seq(base, o.idle ?? P.BREATH)), { ticksPerFrame: 20 });
      defHi(t + 'shoot', upper(P.seq(base, [{ recoil: kick }, { recoil: 0 }])), { ticksPerFrame: 3, loop: false });
      defHi(t + 'up', upper([{ ...base, aim: 'up' }]), { ticksPerFrame: 30 });
      defHi(t + 'shoot-up', upper(P.seq({ ...base, aim: 'up' }, [{ recoil: kick }, { recoil: 0 }])), { ticksPerFrame: 3, loop: false });
      defHi(t + 'down', upper([{ ...base, aim: 'down' }]), { ticksPerFrame: 30 });
      defHi(t + 'shoot-down', upper(P.seq({ ...base, aim: 'down' }, [{ recoil: kick }, { recoil: 0 }])), { ticksPerFrame: 3, loop: false });
      // Diagonals (GDD §4.3): up + forward aims at 45° with every gun; the machine-gun sweep
      // also passes 45° down, so only the heavy pose has the down diagonal.
      for (const d of w === 'heavy' ? (['diag-up', 'diag-down'] as const) : (['diag-up'] as const)) {
        defHi(t + d, upper([{ ...base, aim: d }]), { ticksPerFrame: 30 });
        defHi(t + 'shoot-' + d, upper(P.seq({ ...base, aim: d }, [{ recoil: kick }, { recoil: 0 }])), { ticksPerFrame: 3, loop: false });
      }
      const carry: Pose = { ...o.torso, weapon: w, gunHand: 'far' };
      defHi(t + 'throw', upper(P.seq(carry, P.THROW)), { durations: [5, 4, 3, 5, 6], loop: false });
      defHi(t + 'knife', deco('knife', P.seq(carry, o.knife ?? P.KNIFE).map(fx), 'upper'), timing('knife', { durations: [3, 3, 3, 4, 5] }, false));
    }
    defHi(pre + vx + 'victory', deco('victory', (o.victory ?? P.VICTORY).map(fx), 'full'), timing('victory', { ticksPerFrame: 8 }));
    defHi(pre + vx + 'bored', deco('bored', (o.bored ?? BORED_STRETCH).map(fx), 'full'), timing('bored', { durations: [12, 10, 24, 10, 10, 10] }));
  }

  defHi(pre + 'die', deco('die', o.die ?? P.DIE, 'full'), timing('die', { durations: [6, 6, 6, 6, 8, 40] }, false));
  defHi(pre + 'die-burn', (d) => burnFrames(style, {}, 9, d), { durations: [5, 5, 8, 12, 8, 8, 40], loop: false });
  defHi(pre + 'die-blast', (d) => blastFrames(style, {}, d), { durations: [5, 5, 5, 5, 30], loop: false });
  defHi(pre + 'spawn', full(P.SPAWN), { durations: [4, 4, 6, 10], loop: false });
  defHi(pre + 'mount', full(P.MOUNT), { ticksPerFrame: 6, loop: false });
  defHi(pre + 'salute', deco('salute', o.salute ?? P.SALUTE, 'full'), timing('salute', { durations: [8, 60] }, false));
  defineSprite(pre + 'portrait', () => portrait(style), { anchor: 'top-left', hi: () => portrait(style, 2) });
  defineRiderSprites(id, style);
}

/**
 * The nine Swan rider strips `char/<id>/ride-<pose>` (14 frames; docs/design/swan-mount/look.md
 * §6.4): upper body only, hip anchor, no gun drawn (the rider's own weapon is stored), points
 * `head` and `hand`. `definePlayerSprites` calls this; it is exported for custom rider styles.
 */
export function defineRiderSprites(id: string, style: HumanStyle, base: Pose = {}): void {
  const pre = `char/${id}/`;
  for (const name of P.RIDE_POSES) {
    const r = P.RIDE[name];
    defHi(pre + 'ride-' + name, (d) => poseFrames(style, P.seq({ ...base, weapon: 'none' }, r.frames), 'upper', d), { ticksPerFrame: r.ticks });
  }
}

// ------------------------------------------------------------------------------------ portrait

/**
 * Menu portrait (32×32): the head and shoulders rendered by the rig, enlarged with Scale2x
 * (rounded edges, no new colours) on a framed dark panel. `density` 2: the 64×64 2× twin (the 2×
 * bust under the same crop; frame and panel at the 1× weight).
 */
export function portrait(style: HumanStyle, density: Density = 1): PixelBuffer {
  const bust = renderHuman(style, { armN: { sh: 4, el: 10 }, armF: { sh: -4, el: 10 }, expr: 'normal' }, 'upper', density);
  const head = bust.pts.head ?? [0, -14];
  // Region around the head: 16×15 source px → 32×30 after Scale2x.
  const sx = bust.ox + head[0] - 8;
  const sy = bust.oy + head[1] - 8;
  return portraitPanel(bust.buf, sx, sy, [PAL.navy[0], PAL.navy[1], PAL.purple[0]], density);
}

/**
 * The 32×32 portrait panel (64×64 at density 2): the 16×16 logical crop at (sx, sy) of `bust`
 * (a buffer of that density) enlarged with Scale2x over a dithered gradient, framed in ink.
 */
export function portraitPanel(bust: PixelBuffer, sx: number, sy: number, bg: readonly Color[], density: Density = 1): PixelBuffer {
  const d = density;
  const crop = bust.crop(sx * d, sy * d, 16 * d, 16 * d).scale2x();
  const out = new PixelBuffer(32 * d, 32 * d);
  out.gradient(0, 0, 32 * d, 32 * d, bg, { dither: 0.5 });
  out.blit(crop, 0, d);
  out.strokeRect(0, 0, 32 * d, 32 * d, INK);
  if (d === 2) out.strokeRect(1, 1, 62, 62, INK);
  return out;
}

// ------------------------------------------------------------------------------------ soldier

export interface SoldierArtOpts {
  /** Idle comedy loop (≥ 4 frames). Default: a sneaky sandwich snack. */
  gag?: readonly Pose[];
  /** Panic loop (≥ 4 frames). Default: hands on the head, knees knocking. */
  panic?: readonly Pose[];
  /** Weapon pose (default 'rifle'). */
  weapon?: WeaponPose;
}

/** Default soldier gag: rifle in the far hand, a sandwich, a big bite, happy chewing. */
export const GAG_SNACK: readonly Pose[] = [
  { ...P.STAND, weapon: 'rifle', gunHand: 'far', gunAngle: 60, armN: { sh: 20, el: 90, hand: 'grip' }, held: 'snack' },
  { ...P.STAND, weapon: 'rifle', gunHand: 'far', gunAngle: 60, armN: { to: [6, -4], hand: 'grip' }, held: 'snack', expr: 'shout' },
  { ...P.STAND, weapon: 'rifle', gunHand: 'far', gunAngle: 60, armN: { to: [5, -2], hand: 'grip' }, held: 'snack', expr: 'chew' },
  { ...P.STAND, weapon: 'rifle', gunHand: 'far', gunAngle: 60, armN: { to: [5, -2], hand: 'grip' }, held: 'snack', expr: 'chew', bob: 1 },
  { ...P.STAND, weapon: 'rifle', gunHand: 'far', gunAngle: 60, armN: { sh: 20, el: 90, hand: 'grip' }, held: 'snack', expr: 'happy' },
  { ...P.STAND, weapon: 'rifle', gunHand: 'far', gunAngle: 60, armN: { sh: 20, el: 90, hand: 'grip' }, held: 'snack', expr: 'blink' },
];

/** Register the `enemy/<id>/…` contract for a rifle soldier. */
export function defineSoldierSprites(id: string, style: HumanStyle, o: SoldierArtOpts = {}): void {
  const pre = `enemy/${id}/`;
  const w = o.weapon ?? 'rifle';
  const full = (poses: readonly Pose[]) => (): FrameList => poseFrames(style, poses, 'full');
  const low: Pose = { weapon: w, lowGun: true };
  const aim: Pose = { weapon: w };

  def(pre + 'idle', full(P.seq({ ...P.STAND, ...low }, P.BREATH)), { ticksPerFrame: 24 });
  def(pre + 'gag', full(o.gag ?? GAG_SNACK), { durations: [24, 8, 10, 10, 16, 30] });
  def(
    pre + 'alert',
    full([
      { ...P.STAND, legN: { hip: 30, knee: 40 }, legF: { hip: -10, knee: 40 }, armN: { sh: 120, el: 40, hand: 'open' }, armF: { sh: 150, el: 30, hand: 'open' }, grounded: false, dy: -3, expr: 'panic' },
      { ...P.STAND, ...aim, expr: 'shout' },
    ]),
    { durations: [10, 12], loop: false },
  );
  def(pre + 'walk', full(P.seq(low, P.WALK)), { ticksPerFrame: 6 });
  def(pre + 'run', full(P.seq({ ...low, lean: 8 }, P.RUN)), { ticksPerFrame: 4 });
  def(pre + 'crouch', full([{ ...P.CROUCH, ...aim }]), { ticksPerFrame: 30 });
  def(pre + 'shoot', full(P.seq({ ...P.STAND, ...aim }, [{ recoil: 2, expr: 'shout' }, { recoil: 0 }])), { durations: [4, 8], loop: false });
  def(pre + 'crouch-shoot', full(P.seq({ ...P.CROUCH, ...aim }, [{ recoil: 2, expr: 'shout' }, { recoil: 0 }])), { durations: [4, 8], loop: false });
  def(pre + 'throw', full(P.seq({ ...P.STAND, weapon: w, gunHand: 'far' }, P.THROW)), { durations: [8, 6, 4, 6, 8], loop: false });
  def(pre + 'panic', full(o.panic ?? P.PANIC_COWER), { ticksPerFrame: 5 });
  def(pre + 'die', full(P.DIE), { durations: [5, 5, 6, 6, 8, 30], loop: false });
  def(pre + 'die-blast', () => blastFrames(style), { durations: [5, 5, 5, 5, 30], loop: false });
  def(pre + 'die-burn', () => burnFrames(style), { durations: [5, 5, 8, 12, 8, 8, 40], loop: false });
  def(pre + 'die-knife', full(P.DIE_KNIFE), { durations: [8, 6, 6, 6, 30], loop: false });
}
