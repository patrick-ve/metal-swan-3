/**
 * Player vehicle `swan`: sprite definitions only (GDD §8.2, §15.6; the full contract is
 * docs/design/swan-mount/look.md §7–§12).
 *
 * SWAN-3 "Metal Swan": a riveted ivory robot swan (steel, navy trim, gold rivets, orange beak and
 * webbed paddles) ridden on her back. Her only "feathers" are stamped tin plates; her gun is her
 * beak. Everything is generated lazily by the rig in `kit.art.ts` (toolkit), `head.art.ts` (neck
 * and head), `body.art.ts` (hull, wings, legs, tail, seat pad, handles), `poses.art.ts` (the frame
 * tables) and `extras.art.ts` (scuffs, egg, tin feather, beak flash).
 *
 * Registers (all body strips use the feet anchor at body (0, 0), look.md §3.1):
 * - `vehicle/<v>/<anim>` for `<v>` = `swan`, `swan-mute`, `swan-socks`, `swan-mute-socks`:
 *   ridden strips `idle run move squat jump fall stomp land flap glide glide-tired fold skid
 *   crouch waddle slide settle swim water-duck paddle-up honk honk-air honk-swim rise wreck` and
 *   riderless strips `sit-down empty empty-look empty-lay hiss dive bash tumble dazed right shake
 *   migrate migrate-soot` (neck baked in). Points: `seat` (the rider's hip), `neck` (socket),
 *   `hull`, `smoke`, `perch`, `wake`, `footN`, `footF`, `muzzle` / `cannon` (0° fallback),
 *   `head` (baked necks), `bubble` (parked), `egg` (`empty-lay` f5–f7).
 * - `vehicle/<c>/<anim>-front` for `<c>` = `swan`, `swan-mute`: the front overlay of every ridden
 *   strip (near wing + the flank under the seat; it hides the rider's hips).
 * - `vehicle/<c>/<neck strip>`: `neck`, `swim-neck` (9 aim frames: +45° − 22.5°·i), `crouch-neck`,
 *   `duck-neck` (1 frame), each with `-fire`, `-shell`, `-blink`, `-hurt`; `neck-relax`,
 *   `swim-neck-relax` (2: normal, blink); `neck-honk` (3). Anchor = the socket; points `muzzle`,
 *   `cannon` (the beak tip, P3 + 12u) and `head`.
 * - `vehicle/swan/scuffs` (2, anchor = the `hull` point), `vehicle/swan/egg` (4, feet anchor).
 * - `fx/tin-feather` (4, centre) and `fx/muzzle-swan-beak-gun` (2, centre, round: fits every aim);
 *   `vehicle/swan/beak-flash` is the same flash under a Swan-owned id (the one the logic draws).
 *
 * The head drawing is shared with the HUD and menus: `drawSwanHead(buf, cx, cy, opts)` paints the
 * ivory dome, lens eye, navy face patch and orange beak (or the Mute's black head) into any
 * buffer; `swanHeadIcon(opts)` returns a stand-alone outlined head (`ui/icon-life`,
 * `ui/cursor-swan`).
 */
import type { Frame } from '../../../../engine/render';
import { defineSprite, getFrames, type SpriteOpts } from '../../../../engine/sprites';
import { scorch } from '../../../art/human-fx';
import type { BodyOut, SwanStyle } from './body.art';
import { renderBody } from './body.art';
import { beakFlashFrames, eggFrames, scuffFrames, tinFeatherFrames } from './extras.art';
import type { NeckSpec, SwanColour } from './head.art';
import { renderNeckFrame } from './head.art';
import type { NeckVariant, StripDef } from './poses.art';
import { NECK_CROUCH, NECK_DUCK, NECK_HONK, NECK_LAND, NECK_RELAX, NECK_WATER, RIDDEN, RIDERLESS, neckVariant } from './poses.art';

export { drawSwanHead, swanHeadIcon, type SwanEye, type SwanHeadOpts } from './head.art';

/** Body prefixes and their paint (look.md §9, §12). */
export const SWAN_BODY_PREFIXES: Readonly<Record<string, SwanStyle>> = {
  'vehicle/swan': { colour: 'ivory', socks: false },
  'vehicle/swan-mute': { colour: 'mute', socks: false },
  'vehicle/swan-socks': { colour: 'ivory', socks: true },
  'vehicle/swan-mute-socks': { colour: 'mute', socks: true },
};

/** Colour prefixes (front overlays and necks: socks never show in them). */
export const SWAN_COLOUR_PREFIXES: Readonly<Record<string, SwanColour>> = {
  'vehicle/swan': 'ivory',
  'vehicle/swan-mute': 'mute',
};

function optsOf(def: StripDef): SpriteOpts {
  const o: SpriteOpts = { loop: def.loop ?? true };
  if (def.durations) o.durations = [...def.durations];
  else o.ticksPerFrame = def.ticksPerFrame ?? 6;
  return o;
}

// ------------------------------------------------------------------------------------ body

/**
 * One render of a ridden strip gives both the body frames and the front overlays. The body
 * sprite and its `-front` sprite are generated separately (lazily), so the first of the two
 * keeps the other half here until it is asked for (then the entry is dropped).
 */
const pending = new Map<string, { out: BodyOut[]; body: boolean; front: boolean }>();

function riddenRender(colour: SwanColour, anim: string, part: 'body' | 'front'): Frame[] {
  const key = `${colour}/${anim}`;
  let e = pending.get(key);
  if (!e) {
    const style: SwanStyle = { colour, socks: false };
    e = { out: RIDDEN[anim].frames.map((p) => renderBody(style, p)), body: false, front: false };
    pending.set(key, e);
  }
  e[part] = true;
  if (e.body && e.front) pending.delete(key);
  return e.out.map((o) => (part === 'body' ? o.body : (o.front ?? o.body)));
}

function bodyFrames(style: SwanStyle, def: StripDef): Frame[] {
  return def.frames.map((p) => renderBody(style, p).body);
}

for (const [pre, style] of Object.entries(SWAN_BODY_PREFIXES)) {
  for (const [anim, def] of Object.entries(RIDDEN)) {
    const opts = optsOf(def);
    if (anim === 'move') {
      // `move` is an alias of `run` (the base class plays it before the swan's own override).
      defineSprite(`${pre}/move`, () => [...getFrames(`${pre}/run`)], opts);
      continue;
    }
    const gen = style.socks ? () => bodyFrames(style, def) : () => riddenRender(style.colour, anim, 'body');
    defineSprite(`${pre}/${anim}`, gen, opts);
  }
  for (const [anim, def] of Object.entries(RIDERLESS)) {
    const gen =
      anim === 'migrate-soot'
        ? // The migration, sooty (the 0-cell exit): every colour two shades darker.
          () => bodyFrames(style, def).map((f) => scorch(f, 2))
        : () => bodyFrames(style, def);
    defineSprite(`${pre}/${anim}`, gen, optsOf(def));
  }
}

for (const [pre, colour] of Object.entries(SWAN_COLOUR_PREFIXES)) {
  for (const [anim, def] of Object.entries(RIDDEN)) {
    const opts = optsOf(def);
    if (anim === 'move') {
      defineSprite(`${pre}/move-front`, () => [...getFrames(`${pre}/run-front`)], opts);
      continue;
    }
    defineSprite(`${pre}/${anim}-front`, () => riddenRender(colour, anim, 'front'), opts);
  }
}

// ------------------------------------------------------------------------------------ necks

const NECK_FACES: readonly NeckVariant[] = ['', 'fire', 'shell', 'blink', 'hurt'];

/** Timing of the face variants (look.md §9): fire 2 per round, shell 6, blink 6, hurt 12. */
const FACE_TICKS: Readonly<Record<NeckVariant, number>> = { '': 30, fire: 2, shell: 6, blink: 6, hurt: 12 };

function neckStrip(colour: SwanColour, specs: readonly NeckSpec[], v: NeckVariant): () => Frame[] {
  return () => specs.map((s) => renderNeckFrame(neckVariant(s, v), colour));
}

for (const [pre, colour] of Object.entries(SWAN_COLOUR_PREFIXES)) {
  const postures: ReadonlyArray<readonly [string, readonly NeckSpec[]]> = [
    ['neck', NECK_LAND],
    ['swim-neck', NECK_WATER],
    ['crouch-neck', [NECK_CROUCH]],
    ['duck-neck', [NECK_DUCK]],
  ];
  for (const [name, specs] of postures) {
    for (const v of NECK_FACES) {
      // Aim frames are picked by code (no animation): loop off, the face's own hold time.
      defineSprite(`${pre}/${name}${v ? `-${v}` : ''}`, neckStrip(colour, specs, v), { ticksPerFrame: FACE_TICKS[v], loop: false });
    }
  }
  // The relaxed S: f0 open eye, f1 the blink.
  const relax = (): Frame[] => [renderNeckFrame(NECK_RELAX, colour), renderNeckFrame({ ...NECK_RELAX, eye: 'blink' }, colour)];
  defineSprite(`${pre}/neck-relax`, relax, { durations: [180, 6] });
  defineSprite(`${pre}/swim-neck-relax`, relax, { durations: [180, 6] });
  // HONK: inhale, HONK (beak wide), hold — follows the `honk` body strip (f0–2, f3, f4).
  defineSprite(`${pre}/neck-honk`, () => NECK_HONK.map((s) => renderNeckFrame(s, colour)), { durations: [10, 4, 6], loop: false });
}

// ------------------------------------------------------------------------------------ extras

// Picked by code (frame 0: ≤ 2 cells, frame 1: ≤ 1 cell), never animated.
defineSprite('vehicle/swan/scuffs', scuffFrames, { loop: false });
defineSprite('vehicle/swan/egg', eggFrames, { durations: [6, 10, 10, 20], loop: false });
defineSprite('fx/tin-feather', tinFeatherFrames, { ticksPerFrame: 4 });
defineSprite('fx/muzzle-swan-beak-gun', beakFlashFrames, { ticksPerFrame: 2, loop: false });
// The same round flash under a Swan-owned id: the logic draws this one, so another module that
// also registers `fx/muzzle-swan-beak-gun` (a forward-only weapon flash) cannot change her look.
defineSprite('vehicle/swan/beak-flash', beakFlashFrames, { ticksPerFrame: 2, loop: false });
