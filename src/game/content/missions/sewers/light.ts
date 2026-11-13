/**
 * The light of mission `sewers` (docs/design/sewers.md §2 "Light", §5.1, §6): one light-pass entry
 * per section (`defineSectionLight`, the light pass in src/game/mission/light/). Cosmetic only: the
 * pass draws with `fxRng`, the sims never read it. Importing this module registers all of it (the
 * lazy sewers chunk does: ./index.ts).
 *
 * Owners: P0 made the start values; wave P1b A and B tune a and b (the neon, the rain, the streaks
 * on the wet cobbles and the canal), wave P1b C tunes c, d and e (the flashlight cones,
 * `LightMap.addCone`, the hero glow); wave P6 switches c–e to the entity-only mode over the baked
 * ambient and lit stacks (spec §5.1).
 *
 * - a, b (neon night, rain): darkness 0.35 / 0.42 in a navy tint on the figures only (P6a: the night,
 *   the neon, the pools, the mirrors and the rain are painted), lifted round the painted lamps.
 * - c, d, e (V2 dark): darkness 0.6 in a near-black tint, the hero glow r 28 so every hero stays
 *   readable, every hero's flashlight cone (off in c until FLASHLIGHTS ON), the rat eyes as emitters;
 *   the ENTITY-ONLY mode (`scope: 'entities'`, P6a): with the baked scene live, the darkness lands on
 *   the entities only and the cones show the lit stack (docs/api/canal.md "A lit section").
 * - end (dawn after the rain): a faint cold tint.
 */
import { PAL } from '../../../../engine/palette';
import type { Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { defineSectionLight, type SectionLight, type StaticLight } from '../../../mission/light/api';
import { drawRatEyes } from '../../sewers/eyes-emit';
import { C_LAMPS, drawCEmitters } from './c-kit';
import { SEWERS_E_IDS, SEWERS_SECTION } from './ids';

/**
 * The street (a, b) over its baked canal scene (wave P6a, 2026-11-13): the night, the neon, the
 * lanterns' pools, the wet mirrors and the rain are PAINTED (sw_a.py, sw_b.py), so the pass runs in
 * the entity-only mode (`scope: 'entities'`, docs/api/canal.md "A lit section"): its darkness lands
 * on the figures only, lifted round the PAINTED lamps (world x of the kit's lamps; no colour of its
 * own: `glow` 0, no streaks, no rain — the painted pools, mirrors and rain stay exact). Without a
 * live scene (`?canal=0`, the sims) the darkness covers everything, still without the pass's rain.
 */
function streetNight(darkness: number, lamps: readonly StaticLight[]): SectionLight {
  return { darkness, tint: PAL.navy[0], lamps, scope: 'entities', emitSprites: STREET_EMITTERS, emitTags: ['item'] };
}

/**
 * A painted lamp's light on the figures: its world x on its plane (the kit's `sec.put` x), the plane's
 * speed (the pass follows the plane's parallax, `StaticLight.speed`), its head's y; warm, a little
 * flicker, no colour added.
 */
function warmLamp(x: number, speed: number, y: number, r: number, intensity: number): StaticLight {
  return { x, y, r, color: PAL.orange[2], intensity, flicker: 0.04, glow: 0, speed };
}

/** The speed of the kit's plane at floor depth d (core/level.py `s_d`). */
const sD = (d: number): number => (116 - d) / 116;

/** The muzzle flashes skip the street's darkness (as in the sewer); the pickups by tag. */
const STREET_EMITTERS: readonly string[] = ['fx/muzzle'];

/**
 * sewers-a: the quay lanterns of sw_a.py `LAMPS` (the quay pavement, depth 24, s 0.7931; the head at
 * y 112.5, `LAMP_D`, `LAMP_H`): the only lamps the kit paints near the walk band (the neon words are on
 * the far quay, across the canal).
 */
const A_LAMPS: readonly number[] = [120, 330, 560, 800, 1060, 1250, 1580, 1860, 2140, 2420, 2690];

function streetA(): SectionLight {
  return streetNight(
    0.35,
    A_LAMPS.map((x) => warmLamp(x, sD(24), 112.5, 44, 0.8)),
  );
}

/**
 * The sewer (c, d, e; wave P1b C): spec §5.1 Phase 4 (grey): darkness 0.6 over everything, the hero
 * glow r 28, every living hero's flashlight cone (mission/light/cone.ts; `LightMap.addCone`) and the
 * rat eyes as emitters that skip the darkness (content/sewers/eyes-emit.ts). c starts with the
 * cones off: its script switches them on at FLASHLIGHTS ON, after the fall.
 */
function sewerDark(conesOff = false): SectionLight {
  return {
    darkness: 0.6,
    tint: PAL.ink[0],
    heroLight: 28,
    cones: conesOff ? { off: true } : true,
    emissive: drawRatEyes,
    // Phase 6 (wave P6a, spec §5.1 "Art (L5)"): the entity-only mode over the baked ambient and lit
    // stacks (docs/api/canal.md "A lit section"); without a live canal scene (?canal=0, the sims) the
    // darkness covers everything as in Phase 4.
    scope: 'entities',
    emitSprites: SEWER_EMITTERS,
    emitTags: ['item'],
  };
}

/**
 * The emitters the entity-only darkness skips besides the rat eyes (spec §5.1): the muzzle flashes
 * and the spitters' slime (its shot, splat and puddle); the pickups by tag (their glints).
 */
const SEWER_EMITTERS: readonly string[] = ['fx/muzzle', 'fx/sewers-rat-slime'];

/**
 * sewers-b (wave P1b B; P6a after porter B's look check, 2026-11-13): the warm wall lamps the kit
 * paints (sw_b.py `LAMPS`, at their world x on the alley wall: 127, 468, 868, 1,141, and the alley
 * mouth's at 1,454: the alley wall's plane, depth 6) and the square's crown lanterns at the church's
 * foot (`SQ_LAMPS` 1,720, 2,160, 2,500: the square's back edge, depth 26). The open grates add their
 * own faint green glow (`sewers-grate`, LIGHT_TAG).
 */
function streetB(): SectionLight {
  const lamps: StaticLight[] = [];
  for (const x of [127, 468, 868, 1141]) lamps.push(warmLamp(x, sD(6), 120, 46, 0.85));
  lamps.push(warmLamp(1454, sD(6), 110, 52, 0.8));
  for (const x of [1720, 2160, 2500]) lamps.push(warmLamp(x, sD(26), 110, 52, 0.8));
  return streetNight(0.42, lamps);
}

/** A boss that draws emitters of its own after the darkness (the Rattenjong's eyes). */
interface EyeDrawer {
  drawEyes(r: Renderer): void;
}

/** The king's throws (the bike, its parts, the cart, the scooter): ids of SEWERS_E_IDS. */
const THROWS: ReadonlySet<string> = new Set([SEWERS_E_IDS.bike, SEWERS_E_IDS.bikePart, SEWERS_E_IDS.cart, SEWERS_E_IDS.scooter]);

/**
 * sewers-e: the rat eyes, the Rattenjong's eyes (P2; spec §4.2 "red eyes", §5.1 emitters) and his
 * throws: every throw draws again after the darkness, so an attack that comes out of the dark behind
 * a hero (outside his cone and glow) still reads wherever it flies. Draw only.
 */
function drawEEmitters(world: World, r: Renderer): void {
  drawRatEyes(world, r);
  const shots = world.byTag('shot');
  for (let i = 0; i < shots.length; i++) {
    const e = shots[i];
    if (!e.removed && THROWS.has(e.type)) e.draw(r);
  }
  const list = world.byTag('boss');
  for (let i = 0; i < list.length; i++) {
    const e = list[i] as Partial<EyeDrawer>;
    if (typeof e.drawEyes === 'function') e.drawEyes(r);
  }
}

/**
 * sewers-e (spec §2.5, §6 "grey crack light from above"; P2; P6a 2026-11-13): cold, faint light on
 * the figures under the PAINTED cracks of the hall vault (parts_sw_e.py `CRACKS`: world x on the vault
 * plane, its speed), so the king reads as more than a dark shape. No colour of its own (the crack
 * light is painted); the cones and the hero glow stay as in c and d.
 */
export const E_CRACK_LAMPS: readonly StaticLight[] = [
  { x: 892, speed: 0.7, y: 24, r: 80, color: PAL.snow[1], intensity: 0.45, glow: 0 },
  { x: 1040, speed: 0.62, y: 16, r: 104, color: PAL.snow[2], intensity: 0.6, glow: 0 },
  { x: 1112, speed: 0.62, y: 16, r: 96, color: PAL.snow[2], intensity: 0.55, glow: 0 },
  { x: 1292, speed: 0.66, y: 22, r: 80, color: PAL.snow[1], intensity: 0.45, glow: 0 },
];

/** Every section's light (start values). */
export const SEWERS_LIGHT: Readonly<Record<string, SectionLight>> = {
  [SEWERS_SECTION.a]: streetA(),
  [SEWERS_SECTION.b]: streetB(),
  [SEWERS_SECTION.c]: { ...sewerDark(true), lamps: C_LAMPS, emissive: drawCEmitters },
  [SEWERS_SECTION.d]: sewerDark(),
  [SEWERS_SECTION.e]: { ...sewerDark(), lamps: E_CRACK_LAMPS, emissive: drawEEmitters },
  [SEWERS_SECTION.end]: { darkness: 0.12, tint: PAL.sky[1] },
};

for (const [id, cfg] of Object.entries(SEWERS_LIGHT)) defineSectionLight(id, cfg);
