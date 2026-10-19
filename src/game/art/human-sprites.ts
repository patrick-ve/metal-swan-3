/**
 * Sprite-set builders on top of the humanoid rig (docs/ARCHITECTURE.md §6.1 sprite contract).
 *
 * - `definePlayerSprites(id, style, opts)` registers the whole `char/<id>/…` contract: split
 *   legs (with `hip`) and torsos per weapon pose (with `muzzle` / `hand`), full-body
 *   animations and a menu portrait.
 * - `defineSoldierSprites(id, style, opts)` registers the `enemy/<id>/…` contract for a rifle
 *   soldier (full-body frames, `muzzle` on shoot frames, `hand` on throw frames).
 * The player sets also register their UHD art (`defineSprite(id, gen, { hd })`, used only by a
 * mission with `artDensity` 2 or 4): every strip rendered again by the rig at density 2 and 4 (the
 * HD body, src/game/art/hd/body.ts), with the same logical geometry (docs/ART_GUIDE.md "UHD art").
 * A new character or enemy is one style object plus optional pose overrides (ART_GUIDE.md §5).
 */
import type { Color } from '../../engine/color';
import { PixelBuffer } from '../../engine/pixel';
import { INK, PAL } from '../../engine/palette';
import type { Frame } from '../../engine/render';
import { defineSprite } from '../../engine/sprites';
import type { SpriteOpts } from '../../engine/sprites';
import { crumble, crumbleDense, scorch, sootify, withFlames, withFlamesDense } from './human-fx';
import { renderHuman } from './humanoid';
import { inbetween, tween } from './tween';
import type { ArmPose, Density, HumanStyle, Pose, RenderPart, WeaponPose } from './humanoid';
import * as P from './poses';

export type FrameList = Frame[];

/** Render a list of poses for one part (`density` 2 / 4: the UHD frames). */
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
 * Burning death: two flaming frames, soot statue, two crumble frames, ash pile. `density` 2 / 4:
 * the HD figure under the same flames and crumbling, drawn natively (`withFlamesDense`,
 * `crumbleDense`; the effect placed from the 1× frames, so the geometry is the 1× one).
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
  const d = density;
  P.BURN.forEach((p, i) => {
    const pose = { ...base, ...p };
    out.push(withFlamesDense(scorch(renderHuman(style, pose, 'full'), 1), scorch(renderHuman(style, pose, 'full', d), 1), i * 2 + 1, seed));
  });
  const s1 = sootify(renderHuman(style, statuePose, 'full'), 1, true, seed);
  const sd = sootify(renderHuman(style, statuePose, 'full', d), 1, true, seed);
  out.push(withFlamesDense(s1, sd, 5, seed + 3, 3));
  out.push(sd);
  for (const t of [0.35, 0.7, 1]) out.push(crumbleDense(s1, sd, t, seed));
  return out;
}

/** Explosion death: a scorched (two shades darker), tumbling launch (DIE_BLAST). */
export function blastFrames(style: HumanStyle, base: Pose = {}, density: Density = 1, poses: readonly Pose[] = P.DIE_BLAST): FrameList {
  return poses.map((p) => scorch(renderHuman(style, { ...base, ...p }, 'full', density), 2));
}

function def(id: string, gen: () => FrameList, opts: SpriteOpts): void {
  defineSprite(id, gen, opts);
}

/** A strip recipe at either density. */
type DGen = (d: Density) => FrameList | Frame | PixelBuffer;

/** Register a player strip with its UHD art: the same recipe at density 1, 2 and 4. */
function defHd(id: string, gen: DGen, opts: SpriteOpts): void {
  defineSprite(id, () => gen(1), { ...opts, hd: (d) => gen(d) });
}

// ------------------------------------------------------------------------------------ player

/** Strips a character may decorate with props (`withPieces`) after the rig rendered them. */
export type DecoratedAnim = 'bored' | 'victory' | 'die' | 'salute' | 'knife' | 'fidget-a' | 'fidget-b' | 'knife-b';

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
  /** Full-body idle fidget A (8-14 frames), themed on the hero's prop. Default: the ART default. */
  fidgetA?: readonly Pose[];
  /** Full-body idle fidget B (8-14 frames), alternates with A. Default: the ART default. */
  fidgetB?: readonly Pose[];
  /** Second knife strip (6 frames; `held` from the knife table). Default: derived from KNIFE. */
  knifeB?: readonly Pose[];
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
  const torsoOf = (poses: readonly Pose[]) => (d: Density): FrameList => poseFrames(style, poses, 'upper', d);
  const full = (poses: readonly Pose[]) => (d: Density): FrameList => poseFrames(style, poses, 'full', d);
  /** Render poses, then let the character add its props to that strip (dense frames: logical px). */
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

  const run = runPoses(style, o.run ?? P.RUN);
  defHd(pre + 'legs-idle', lower(P.IDLE_SHIFT), { ticksPerFrame: 16 });
  defHd(pre + 'legs-run', lower(run), { ticksPerFrame: 3 });
  defHd(pre + 'legs-jump', lower(P.JUMP4), { ticksPerFrame: 3, loop: false });
  defHd(pre + 'legs-fall', lower(P.FALL2), { ticksPerFrame: 8 });
  defHd(pre + 'legs-land', lower(P.LAND3), { durations: LAND_TIMING, loop: false });
  defHd(pre + 'legs-crouch', lower([P.CROUCH]), { ticksPerFrame: 30 });
  defHd(pre + 'legs-crouch-in', lower(crouchInPoses(style)), { durations: [2, 2, 2], loop: false });
  defHd(pre + 'legs-crouch-out', lower(crouchOutPoses(style)), { durations: [2, 2], loop: false });
  defHd(pre + 'legs-crouch-walk', lower(P.CROUCH_WALK), { ticksPerFrame: 6 });
  const knife = knifePoses(o.knife ?? P.KNIFE);

  // The torso set and the idle / victory strips, plain and for every status art variant.
  const victory = victoryPoses(style);
  const sets: Array<[string, (p: Pose) => Pose]> = [['', (p) => p]];
  for (const [infix, fx] of Object.entries(o.variants ?? {})) sets.push([infix + '-', fx]);
  for (const [vx, fx] of sets) {
    const upper = (poses: readonly Pose[]) => (d: Density): FrameList => poseFrames(style, poses.map(fx), 'upper', d);
    for (const w of ['pistol', 'heavy'] as const satisfies readonly WeaponPose[]) {
      const t = `${pre}${vx}torso-${w}-`;
      const base: Pose = { ...o.torso, weapon: w };
      const kick = w === 'pistol' ? 2 : 1;
      defHd(t + 'idle', upper(P.seq(base, idlePoses(o.idle))), { ticksPerFrame: 12 });
      defHd(t + 'shoot', upper(P.seq(base, [{ recoil: kick }, { recoil: 0 }])), { ticksPerFrame: 3, loop: false });
      defHd(t + 'up', upper([{ ...base, aim: 'up' }]), { ticksPerFrame: 30 });
      defHd(t + 'shoot-up', upper(P.seq({ ...base, aim: 'up' }, [{ recoil: kick }, { recoil: 0 }])), { ticksPerFrame: 3, loop: false });
      defHd(t + 'down', upper([{ ...base, aim: 'down' }]), { ticksPerFrame: 30 });
      defHd(t + 'shoot-down', upper(P.seq({ ...base, aim: 'down' }, [{ recoil: kick }, { recoil: 0 }])), { ticksPerFrame: 3, loop: false });
      // Diagonals (GDD §4.3): up + forward aims at 45° with every gun; the machine-gun sweep
      // also passes 45° down, so only the heavy pose has the down diagonal.
      for (const d of w === 'heavy' ? (['diag-up', 'diag-down'] as const) : (['diag-up'] as const)) {
        defHd(t + d, upper([{ ...base, aim: d }]), { ticksPerFrame: 30 });
        defHd(t + 'shoot-' + d, upper(P.seq({ ...base, aim: d }, [{ recoil: kick }, { recoil: 0 }])), { ticksPerFrame: 3, loop: false });
      }
      const carry: Pose = { ...o.torso, weapon: w, gunHand: 'far' };
      defHd(t + 'throw', upper(P.seq(carry, P.THROW6)), { durations: P.THROW6_TIMING, loop: false });
      defHd(t + 'knife', deco('knife', P.seq(carry, knife).map(fx), 'upper'), timing('knife', { durations: knifeTiming(knife.length) }, false));
    }
    defHd(pre + vx + 'victory', deco('victory', (o.victory ?? victory).map(fx), 'full'), timing('victory', { ticksPerFrame: o.victory ? 8 : 4 }));
    defHd(pre + vx + 'bored', deco('bored', (o.bored ?? BORED_STRETCH).map(fx), 'full'), timing('bored', { durations: [12, 10, 24, 10, 10, 10] }));
  }

  // Anim wave p2 (plan Phase 2): torso actions outside the Helium loop (the player falls back to
  // the base action's Helium twin), crouch transitions, time-out and the longer default strips.
  for (const w of ['pistol', 'heavy'] as const satisfies readonly WeaponPose[]) {
    const t = `${pre}torso-${w}-`;
    const base: Pose = { ...o.torso, weapon: w };
    const carry: Pose = { ...o.torso, weapon: w, gunHand: 'far' };
    const kick = w === 'pistol' ? 2 : 1;
    const crouched = (p: Pose): Pose => ({ ...p, lean: (p.lean ?? 0) + 4, hunch: (p.hunch ?? 0) + 1 });
    defHd(t + 'run', torsoOf(P.seq(base, runTorsoPoses(run.length))), { ticksPerFrame: 3 });
    defHd(t + 'crouch', torsoOf(P.seq(base, P.CROUCH_TORSO)), { ticksPerFrame: 12 });
    // Frame 0 is the standing shoot frame (same muzzle); the settle leans into the crouch.
    defHd(t + 'crouch-shoot', torsoOf(P.seq(base, [{ recoil: kick, expr: 'shout' }, { recoil: 0, lean: 2 }])), { ticksPerFrame: 3, loop: false });
    defHd(t + 'crouch-throw', torsoOf(P.seq(carry, P.THROW6).map(crouched)), { durations: P.THROW6_TIMING, loop: false });
    defHd(t + 'crouch-knife', torsoOf(P.seq(carry, knife).map(crouched)), { durations: knifeTiming(knife.length), loop: false });
    defHd(t + 'knife-b', torsoOf(P.seq(carry, o.knifeB ?? knifeBPoses(o.knife ?? P.KNIFE))), { durations: o.durations?.['knife-b'] ?? P.KNIFE6_TIMING, loop: false });
  }
  defHd(pre + 'die', deco('die', o.die ?? diePoses(style), 'full'), timing('die', { durations: o.die ? [6, 6, 6, 6, 8, 40] : P.DIE12_TIMING }, false));
  defHd(pre + 'die-burn', (d) => burnFrames(style, {}, 9, d), { durations: [5, 5, 8, 12, 8, 8, 40], loop: false });
  defHd(pre + 'die-blast', (d) => blastFrames(style, {}, d, blastPoses(style)), { durations: P.DIE_BLAST10_TIMING, loop: false });
  defHd(pre + 'spawn', full(spawnPoses(style)), { durations: P.SPAWN6_TIMING, loop: false });
  // Idle fidgets (row 14): the hero's own tables, else the defaults; rare, so deferred.
  const fidgetA = o.fidgetA ?? tween(style, P.FIDGET_A_KEYS, { perKey: P.FIDGET_A_PER, ease: 'inOut' });
  const fidgetB = o.fidgetB ?? tween(style, P.FIDGET_B_KEYS, { perKey: P.FIDGET_B_PER, ease: 'inOut' });
  defHd(pre + 'fidget-a', deco('fidget-a', fidgetA, 'full'), { ...timing('fidget-a', { durations: P.FIDGET_A_TIMING }, false), defer: true });
  defHd(pre + 'fidget-b', deco('fidget-b', fidgetB, 'full'), { ...timing('fidget-b', { durations: P.FIDGET_B_TIMING }, false), defer: true });
  defHd(pre + 'timeout-yawn', full(P.TIMEOUT_YAWN), { durations: P.TIMEOUT_YAWN_TIMING, loop: false, defer: true });
  defHd(pre + 'timeout-sleep', full(P.TIMEOUT_SLEEP), { ticksPerFrame: 12, defer: true });
  defHd(pre + 'mount', full(P.MOUNT), { ticksPerFrame: 6, loop: false });
  // Anim wave p1 (plan Phase 1): flip and legs-dangle play in normal play; the rare strips are deferred.
  defHd(pre + 'flip', full(flipPoses(style)), { ticksPerFrame: 2, loop: false });
  defHd(pre + 'mount-hop', full(P.MOUNT_HOP), { durations: MOUNT_HOP_TIMING, loop: false, defer: true });
  defHd(pre + 'legs-dangle', lower(danglePoses(style)), { ticksPerFrame: 6 });
  defHd(pre + 'die-drown', (d) => drownFrames(style, d), { durations: P.DROWN_TIMING, loop: false, defer: true });
  defHd(pre + 'salute', deco('salute', o.salute ?? P.SALUTE, 'full'), timing('salute', { durations: [8, 60] }, false));
  defineSprite(pre + 'portrait', () => portrait(style), { anchor: 'top-left', hi: () => portrait(style, 2) });
  defineRiderSprites(id, style);
}

/** Ticks per `mount-hop` frame: crouch, spring, tuck rise, over the seat, settle. */
export const MOUNT_HOP_TIMING: readonly number[] = [3, 3, 3, 3, 4];

/** The 14 `flip` poses: the keyed somersault (P.FLIP_KEYS) with eased in-betweens. */
export function flipPoses(style: HumanStyle): Pose[] {
  return tween(style, P.FLIP_KEYS, { perKey: [2, 3, 3, 1], ease: 'linear' });
}

/** The 6 `legs-dangle` poses: three keys, eased in-betweens, looped. */
export function danglePoses(style: HumanStyle): Pose[] {
  return tween(style, P.DANGLE_KEYS, { counts: 1, loop: true });
}

// ------------------------------------------------------------------------------------ anim wave p2

/** Ticks per `legs-land` frame (9 in all: the player's land timer). */
export const LAND_TIMING: readonly number[] = [2, 3, 4];

/**
 * The 12-frame run: an 8-frame cycle (P.RUN or a hero's own, e.g. Grace's long stride) with one
 * linear in-between after every even key (contact → down, passing → push-off), looped. Any other
 * length is kept as it is.
 */
export function runPoses(style: HumanStyle, run: readonly Pose[]): Pose[] {
  if (run.length !== 8) return [...run];
  return tween(style, run, { perKey: [1, 0, 1, 0, 1, 0, 1, 0], ease: 'linear', loop: true });
}

/** The run torso (hip anchor) over one stride of 6 legs frames: hunch, lean and a head bob, hand-keyed. */
export const RUN_TORSO_HALF: readonly Pose[] = [
  { lean: 8, hunch: 1 },
  { lean: 10, hunch: 2, head: { dy: 1 } },
  { lean: 10, hunch: 1, head: { dy: 1 } },
  { lean: 8, hunch: 0 },
  { lean: 6, hunch: 0, head: { dy: -1 } },
  { lean: 6, hunch: 1, head: { dy: -1 } },
];

/** `n` run torso frames, one per legs-run frame (two strides of RUN_TORSO_HALF for 12). */
export function runTorsoPoses(n: number): Pose[] {
  return Array.from({ length: n }, (_, i) => RUN_TORSO_HALF[i % RUN_TORSO_HALF.length]);
}

/**
 * Four idle torso frames (12 ticks each): BREATH4, or a hero's own 2-frame table [a, b] wrapped
 * to a, b, b + nod, a + nod (a 1 px head nod), so no two neighbours match. Other lengths stay.
 */
export function idlePoses(idle?: readonly Pose[]): Pose[] {
  if (!idle) return [...P.BREATH4];
  if (idle.length !== 2) return [...idle];
  const nod = (p: Pose): Pose => ({ ...p, head: { ...p.head, dy: (p.head?.dy ?? 0) + 1 } });
  return [idle[0], idle[1], nod(idle[1]), nod(idle[0])];
}

/**
 * The knife strip with an anticipation frame derived from frame 0: the body coils back (lean −6,
 * shoulders down 1 px) and the striking arm draws further back. Works for every hero's table.
 */
export function knifePoses(knife: readonly Pose[]): Pose[] {
  const k = knife[0];
  const a = k.armN;
  const armN: ArmPose | undefined = a?.to ? { ...a, to: [a.to[0] - 2, a.to[1] + 1] } : a ? { ...a, sh: (a.sh ?? 0) - 20 } : a;
  const antic: Pose = { ...k, lean: (k.lean ?? 0) - 6, hunch: (k.hunch ?? 0) + 1 };
  if (armN) antic.armN = armN;
  if (k.heldAngle !== undefined) antic.heldAngle = k.heldAngle - 15;
  return [antic, ...knife];
}

/** Knife durations for `n` frames: P.KNIFE6_TIMING (14 ticks) for 6, else 3 per frame. */
export function knifeTiming(n: number): readonly number[] {
  return n === 6 ? P.KNIFE6_TIMING : Array.from({ length: n }, () => 3);
}

/** Knife variant B: P.KNIFE_B with the prop (`held`) of the hero's knife table. */
export function knifeBPoses(knife: readonly Pose[]): Pose[] {
  const held = knife.find((p) => p.held)?.held ?? 'knife';
  return P.KNIFE_B.map((p) => ({ ...p, held }));
}

/** Crouch-in legs (3 frames): eased from the stance into the crouch (the crouch itself not repeated). */
export function crouchInPoses(style: HumanStyle): Pose[] {
  return [0.3, 0.6, 0.85].map((t) => inbetween(style, P.STAND, P.CROUCH, t));
}

/** Crouch-out legs (2 frames): up from the crouch toward the stance. */
export function crouchOutPoses(style: HumanStyle): Pose[] {
  return [0.35, 0.7].map((t) => inbetween(style, P.CROUCH, P.STAND, t));
}

/** The default 12-frame death: DIE with eased in-betweens and the hand-keyed settle. */
export function diePoses(style: HumanStyle): Pose[] {
  const keys = [P.DIE[0], P.DIE[1], P.DIE[2], P.DIE[3], P.DIE12_BOUNCE, P.DIE[5]];
  return [...tween(style, keys, { perKey: [1, 1, 1, 1, 1], ease: 'inOut' }), P.DIE12_SETTLE];
}

/** The default 10-frame blast death (tumble in-betweens, two on the slam). */
export function blastPoses(style: HumanStyle): Pose[] {
  return tween(style, P.DIE_BLAST_KEYS, { perKey: [1, 1, 1, 2], ease: 'linear' });
}

/** The default 8-frame victory loop. */
export function victoryPoses(style: HumanStyle): Pose[] {
  return tween(style, P.VICTORY_KEYS, { perKey: [2, 2, 1], loop: true });
}

/** The default 6-frame spawn: in-betweens on the landing and the stand-up. */
export function spawnPoses(style: HumanStyle): Pose[] {
  return tween(style, P.SPAWN, { perKey: [0, 1, 1] });
}

/** Surface ripple half-widths per drown frame (logical px). */
const RIPPLE = [8, 7, 6, 6, 6, 6, 6, 5, 5, 4, 5, 3] as const;
/** Bubbles per drown frame: [x, y above the surface] (logical px). */
const BUBBLES: Readonly<Record<number, ReadonlyArray<readonly [number, number]>>> = {
  9: [[3, -1]],
  10: [[-2, -1], [1, -2], [4, -1]],
  11: [[0, -3], [-3, -1]],
};

/**
 * `die-drown` at density d: P.DROWN rendered full body, every frame cropped at the anchor line
 * (the water surface: nothing below it), a ripple on the surface, splash drops in frames 0–1,
 * bubbles at the end (frames 10–11 show no figure).
 */
export function drownFrames(style: HumanStyle, d: Density = 1): FrameList {
  return P.DROWN.map((pose, i) => {
    const fig = i < 10 ? renderHuman(style, pose, 'full', d) : null;
    const fw = fig ? fig.buf.w / d : 0;
    const left = Math.min(fig ? -fig.ox : 0, -10);
    const right = Math.max(fig ? fw - fig.ox : 0, 10);
    const top = Math.min(fig ? -fig.oy : 0, -6);
    const out = new PixelBuffer((right - left) * d, -top * d);
    if (fig) out.blit(fig.buf, (-fig.ox - left) * d, (-fig.oy - top) * d);
    const px = (x: number, y: number, c: Color): void => {
      out.rect((x - left) * d, (y - top) * d, d, d, c);
    };
    const r = RIPPLE[i];
    for (let x = -r; x <= r; x++) if ((x + i) % 3 !== 0 || Math.abs(x) < 2) px(x, -1, Math.abs(x) === r ? PAL.sky[2] : PAL.snow[1]);
    if (i < 2) {
      const h = i === 0 ? 4 : 2;
      px(-r - 1, -h, PAL.snow[2]);
      px(r + 1, -h - 1, PAL.snow[2]);
      px(-r + 1, -h - 2, PAL.sky[3]);
    }
    for (const [bx, by] of BUBBLES[i] ?? []) {
      px(bx, by, PAL.snow[3]);
      px(bx + 1, by, PAL.sky[2]);
      px(bx, by - 1, PAL.sky[3]);
    }
    const pts = fig?.pts ? { ...fig.pts } : undefined;
    const f: Frame = { buf: out.touch(), ox: -left, oy: -top, ...(pts ? { pts } : {}), ...(d > 1 ? { density: d } : {}) };
    return f;
  });
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
    defHd(pre + 'ride-' + name, (d) => poseFrames(style, P.seq({ ...base, weapon: 'none' }, r.frames), 'upper', d), { ticksPerFrame: r.ticks });
  }
}

// ------------------------------------------------------------------------------------ portrait

/**
 * Menu portrait (32×32): the head and shoulders rendered by the rig, enlarged with Scale2x
 * (rounded edges, no new colours) on a framed dark panel. `density` 2: the 64×64 2× twin (the HD
 * bust under the same crop; frame and panel at the 1× weight). Registered at 2× only (menus).
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
  for (let k = 1; k < d; k++) out.strokeRect(k, k, 32 * d - 2 * k, 32 * d - 2 * k, INK);
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
