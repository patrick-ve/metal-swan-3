/**
 * Player vehicle `swan`: sprite definitions only (GDD §8.2; docs/design/ams40.md "The Swan", wave 7).
 *
 * The Swan is a natural mute swan with a machine gun strapped on, ridden like a mount bird (plan
 * decision D3): white plumage, the orange bill with the black knob, long black running legs, a
 * leather saddle on a blue cloth with two grips, a steel drum on her near flank held by two belts,
 * the barrel on the drum's hub (it takes the 9 aim angles; the neck is free). Player 2 rides the
 * black swan (`vehicle/swan-mute`): the same pixels with black plumage, a red bill and a red cloth.
 *
 * Registers:
 * - the baked 40 px sets `SWAN_SETS` (one prefix `vehicle/swan`, the P2 variant
 *   `vehicle/swan-mute`; drawn offline by tools/art40/chars/swan/ and baked with
 *   `npm run art40 -- swan`): 1× art at every tier (plan rule 7), no dense art. Stage 1 (the set
 *   `swan`): the ground strips with their `-front` overlays (idle, run, move, squat, jump, fall,
 *   land, stomp, skid, crouch, waddle, slide, honk, wreck), the riderless strips with the neck and
 *   gun inside (hiss, bash, tumble, dazed, right, shake, empty, empty-look, empty-lay), the egg
 *   and the scuffs decal (P1 only: the Swan falls back to `vehicle/swan/<name>`).
 *   Stage 2, the set `swan-neck`: every neck strip (neck, -blink, -fire, -shell, -hurt, -relax,
 *   -honk; swim-neck*, crouch-neck*, duck-neck*): the free neck with its face and the barrel on
 *   the drum at the aim, frame = aim × phases + phase (swan.ts neckFrame), and `beak-flash`.
 *   Stage 2, the set `swan-water`: swim, water-duck, paddle-up, settle, honk-swim, flap, glide,
 *   glide-tired, fold, honk-air (with their `-front` overlays), rise, sit-down, dive, migrate and
 *   migrate-soot. No old drawer of `vehicle/swan/*` or `vehicle/swan-mute/*` is left (rule 8).
 * - the Swan in socks (`vehicle/swan-socks/*`, `vehicle/swan-mute-socks/*`, mission m3 only, out
 *   of the ams40 scope): every body strip from the old rig, 1×; her overlays and necks come from
 *   the colour prefixes.
 * - `fx/tin-feather` and `fx/muzzle-swan-beak-gun` (FX ids, out of the ams40 scope) with their
 *   2× / 4× art.
 *
 * The head drawing is shared with the HUD and menus: `drawSwanHead(buf, cx, cy, opts)` paints a
 * head into any buffer; `swanHeadIcon(opts)` returns a stand-alone outlined head (`ui/icon-life`,
 * `ui/cursor-swan`).
 */
import { bakedSetIds, defineBakedSet, type BakedSet } from '../../../../engine/baked';
import type { Frame } from '../../../../engine/render';
import { defineHdSprite, defineSprite, getFrames, type SpriteOpts } from '../../../../engine/sprites';
import { scorch } from '../../../art/human-fx';
import { SET as SWAN_CORE } from '../../art40/swan.gen';
import { SET as SWAN_NECK } from '../../art40/swan-neck.gen';
import { SET as SWAN_WATER } from '../../art40/swan-water.gen';
import type { SwanStyle } from './body.art';
import { renderBody } from './body.art';
import { beakFlashFrames, tinFeatherFrames } from './extras.art';
import { beakFlashFramesHd, tinFeatherFramesHd } from './hd-extras.art';
import type { StripDef } from './poses.art';
import { RIDDEN, RIDERLESS } from './poses.art';

export { drawSwanHead, swanHeadIcon, type SwanEye, type SwanHeadOpts } from './head.art';

/** The P1 prefix and the P2 palette variant of every baked Swan set. */
export const SWAN_PREFIX = 'vehicle/swan';
export const SWAN_P2_PREFIX = 'vehicle/swan-mute';

/**
 * The baked Swan sets: one prefix, disjoint strips (plan wave 7): `swan` (the ground strips),
 * `swan-neck` (the neck and the gun) and `swan-water` (swim, flight, rise, sit-down, dive,
 * migrate).
 */
export const SWAN_SETS: readonly BakedSet[] = [SWAN_CORE, SWAN_NECK, SWAN_WATER];

/** Strips only P1 has (the Swan's bodyId / colorId fall back to `vehicle/swan/<name>`). */
export const SWAN_P1_ONLY: ReadonlySet<string> = new Set(['egg', 'scuffs', 'beak-flash']);

/** The ids the baked sets register (P1 and P2), in registration order. */
export const SWAN_BAKED_IDS: readonly string[] = SWAN_SETS.flatMap((set) => {
  const ids = bakedSetIds(set).filter((id) => !(id.startsWith(`${SWAN_P2_PREFIX}/`) && SWAN_P1_ONLY.has(id.slice(SWAN_P2_PREFIX.length + 1))));
  return defineBakedSet(set, { only: ids });
});
/**
 * The Swan in socks (mission m3 only, out of the ams40 scope): her body prefixes and paint from
 * the old rig (look.md §9, §12). Her `-front` overlays and necks come from the baked colour
 * prefixes (`vehicle/swan`, `vehicle/swan-mute`).
 */
export const SWAN_SOCKS_PREFIXES: Readonly<Record<string, SwanStyle>> = {
  'vehicle/swan-socks': { colour: 'ivory', socks: true },
  'vehicle/swan-mute-socks': { colour: 'mute', socks: true },
};

function optsOf(def: StripDef): SpriteOpts {
  const o: SpriteOpts = { loop: def.loop ?? true };
  if (def.durations) o.durations = [...def.durations];
  else o.ticksPerFrame = def.ticksPerFrame ?? 6;
  return o;
}

function bodyFrames(style: SwanStyle, def: StripDef): Frame[] {
  return def.frames.map((p) => renderBody(style, p).body);
}

// ------------------------------------------------------------------------------------ socks

// The old robot drawers of `vehicle/swan/*` and `vehicle/swan-mute/*` are gone (plan rule 8):
// every one of their ids comes from SWAN_SETS. Only the m3 socks prefixes keep the old rig.
for (const [pre, style] of Object.entries(SWAN_SOCKS_PREFIXES)) {
  for (const [anim, def] of Object.entries(RIDDEN)) {
    const opts = optsOf(def);
    if (anim === 'move') {
      // `move` is the `run` strip (the base class plays it before the swan's own override).
      defineSprite(`${pre}/move`, () => [...getFrames(`${pre}/run`)], opts);
      continue;
    }
    defineSprite(`${pre}/${anim}`, () => bodyFrames(style, def), opts);
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

// ------------------------------------------------------------------------------------ necks

// The neck strips (neck*, swim-neck*, crouch-neck*, duck-neck*, neck-relax, neck-honk) and
// `vehicle/swan/beak-flash` come from the baked set `swan-neck` (SWAN_SETS); their old 1×
// drawers are gone (plan rule 8).

// ------------------------------------------------------------------------------------ extras

// The FX ids the Swan shares (out of the ams40 scope; her own round flash is the baked
// `vehicle/swan/beak-flash`).
defineSprite('fx/tin-feather', tinFeatherFrames, { ticksPerFrame: 4 });
defineSprite('fx/muzzle-swan-beak-gun', beakFlashFrames, { ticksPerFrame: 2, loop: false });
defineHdSprite('fx/tin-feather', (d) => tinFeatherFramesHd(d, getFrames('fx/tin-feather', 1)));
defineHdSprite('fx/muzzle-swan-beak-gun', (d) => beakFlashFramesHd(d, getFrames('fx/muzzle-swan-beak-gun', 1)));
