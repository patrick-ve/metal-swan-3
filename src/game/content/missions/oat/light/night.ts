/**
 * THE NIGHT LIGHT of mission `oat`: oat-d DE WALLEN BY NIGHT and oat-e DE TAXIRIT (docs/design/oat.md
 * §2.5, §2.6, §6.9, §8.8, §8.9; decisions 52 and 53; docs/api/oat.md "LIGHT-WATER"). Owner: LIGHT-WATER.
 *
 * Both sections opt into the light pass (`defineSectionLight`) with the oat flags: the SMOOTH glow at
 * 2× / 4× (round glows, no 4 × 4 blocks; 1× per pixel), the night STREAKS of the lanterns and the neon
 * on the water (d's canal in front of the quay, e's wet road), the LAMP GROUPS the scripts switch
 * (`lampGroup(world, 'neon-west', 'flicker')`: at 03:00 the neon and red tubes flicker out group by
 * group, the bars close at 02:00, the boss's house lights up), and in d the arena's two BAKES with
 * the 60-tick cross-fade (`crossFadeLight(world, 'dark')`; the strips' dark set, the floor reads
 * `lightSetMix`). Darkness: d 0.35 (lit streets; the arena after 03:00 0.6 by `setDarkness`), e 0.4.
 *
 * The lights are one list per section (`OatLamp`: world u, the floor depth of the lamp, its height
 * over the walk plane, its kind, radius, strength and group). The d proof strip's lights (0–1,280)
 * are STREET-A's baked floor lights (floor/painter.ts `D_LIGHTS`: the same u, depth, height and
 * kind), so the dynamic glow sits on the baked pool; NIGHT (wave C) replaces the rest with
 * `setNightLights('oat-d', list)` from the grammar's façade lights. Start values everywhere.
 */
import type { Color } from '../../../../../engine/color';
import { PAL_HD_OAT } from '../../../../../engine/palette-hd';
import { defineFloorLight } from '../../../../mission/light/floor';
import { defineSectionLight, type LampGroupDef, type SectionLight, type StaticLight } from '../../../../mission/light/api';
import type { ReflectConfig } from '../../../../mission/floor/reflect';
import { D_COPING_NEAR, OAT_CAMERA, WATER_LEVEL } from '../floor/layout';
import { OAT_SECTION } from '../ids';

/** The walk line (spec §2: G = 176). */
const G = 176;

/** A light of a night section (world u; depth in floor units; h px over the walk plane). */
export interface OatLamp {
  readonly u: number;
  readonly depth: number;
  readonly h: number;
  readonly kind: 'lamp' | 'pink' | 'cyan' | 'red' | 'flood' | 'window' | 'tunnel' | 'sodium' | 'signal';
  /** Glow radius, logical px. */
  readonly r: number;
  /** 0..1 strength. */
  readonly k: number;
  readonly group?: string;
  /** Mirrors as a streak on the water / wet floor (default: lanterns, neon and red tubes). */
  readonly streak?: boolean;
}

/** The colour and the glow share of a kind (PAL_HD_OAT; the neon colours more saturated in the glow). */
function look(kind: OatLamp['kind']): { color: Color; glow: number; flicker: number } {
  switch (kind) {
    case 'lamp':
      return { color: PAL_HD_OAT.lantern[2], glow: 0.42, flicker: 0 };
    case 'pink':
      return { color: PAL_HD_OAT.neonPink[0], glow: 0.55, flicker: 0.05 };
    case 'cyan':
      return { color: PAL_HD_OAT.neonCyan[0], glow: 0.55, flicker: 0.05 };
    case 'red':
      return { color: PAL_HD_OAT.redLight[1], glow: 0.5, flicker: 0.03 };
    case 'flood':
      return { color: PAL_HD_OAT.lantern[3], glow: 0.2, flicker: 0 };
    case 'window':
      return { color: PAL_HD_OAT.lantern[1], glow: 0.35, flicker: 0 };
    case 'tunnel':
      return { color: PAL_HD_OAT.lantern[2], glow: 0.3, flicker: 0 };
    case 'sodium':
      return { color: PAL_HD_OAT.lantern[1], glow: 0.45, flicker: 0 };
    case 'signal':
      return { color: PAL_HD_OAT.redLight[1], glow: 0.6, flicker: 0 };
  }
}

/** The static lights of a list (world y = the walk line − h; the depth goes to `defineFloorLight`). */
export function lampsOf(list: readonly OatLamp[]): StaticLight[] {
  return list.map((l) => {
    const k = look(l.kind);
    const streak = l.streak ?? (l.kind === 'lamp' || l.kind === 'pink' || l.kind === 'cyan' || l.kind === 'red' || l.kind === 'sodium');
    return {
      x: l.u,
      y: G - l.h,
      r: l.r,
      color: k.color,
      intensity: l.k,
      flicker: k.flicker,
      glow: k.glow,
      ...(l.group !== undefined ? { group: l.group } : {}),
      ...(streak ? { streak: true } : {}),
    };
  });
}

// ---------------------------------------------------------------------------------------------
// oat-d
// ---------------------------------------------------------------------------------------------

/** The lamp groups of oat-d (spec §2.5, §6.9): the scripts switch them by name. */
export const OAT_D_GROUPS = {
  /** The quay lanterns: on all night (they stay on at 03:00). */
  lanterns: 'lanterns',
  /** The neon of the proof strip, west and east half (out at 03:00, group by group). */
  neonWest: 'neon-west',
  neonEast: 'neon-east',
  /** The red tubes over the window frames (no figures, curtains closed; out at 03:00). */
  red: 'red-tubes',
  /** The bars of the Voorburgwal (DE BARS SLUITEN at 02:00: one group). */
  bars: 'bars',
  /** The square's signs (out at 03:00 last). */
  plein: 'neon-plein',
  /** The Oude Kerk tower's floodlight (off at 03:00). */
  tower: 'tower',
  /** De Huisjesmelker's house: off until the fight, then window by window on. */
  bossHouse: 'boss-house',
} as const;

const D = OAT_D_GROUPS;

/**
 * oat-d's lights (start values). 0–1,280: the proof strip (STREET-A's `D_LIGHTS`: wall lanterns and
 * masts on our pavement, neon blades over the bar doors, a red tube); 1,664–2,432 the alley's wall
 * lamps; 2,432–3,584 the Voorburgwal's lanterns and bars; the tower's floodlight high over the roofs;
 * the square's signs and the boss's house (off).
 */
export const OAT_D_LIGHTS: readonly OatLamp[] = [
  // The proof strip (= STREET-A's placement: art/place-d.ts, floor/d.ts).
  { u: 96, depth: 15.5, h: 72, kind: 'lamp', r: 46, k: 0.9, group: D.lanterns },
  { u: 196, depth: 15.5, h: 50, kind: 'pink', r: 30, k: 0.8, group: D.neonWest },
  { u: 330, depth: 12.8, h: 84, kind: 'lamp', r: 56, k: 1, group: D.lanterns },
  { u: 486, depth: 15.5, h: 52, kind: 'cyan', r: 28, k: 0.75, group: D.neonWest },
  { u: 600, depth: 15.5, h: 72, kind: 'lamp', r: 46, k: 0.9, group: D.lanterns },
  { u: 742, depth: 15.5, h: 50, kind: 'red', r: 26, k: 0.75, group: D.red },
  { u: 880, depth: 12.8, h: 84, kind: 'lamp', r: 56, k: 1, group: D.lanterns },
  { u: 1012, depth: 15.5, h: 52, kind: 'lamp', r: 30, k: 0.8, group: D.neonEast }, // the KOFFIE sign: warm
  { u: 1150, depth: 15.5, h: 72, kind: 'lamp', r: 46, k: 0.9, group: D.lanterns },
  { u: 1250, depth: 15.5, h: 50, kind: 'pink', r: 26, k: 0.7, group: D.neonEast }, // the second BAR
  // The bridge (gids op de brug): two lanterns on the parapets.
  { u: 1320, depth: 8, h: 80, kind: 'lamp', r: 52, k: 0.9, group: D.lanterns },
  { u: 1620, depth: 8, h: 80, kind: 'lamp', r: 52, k: 0.9, group: D.lanterns },
  // The Trompettersteeg: wall lamps, a red tube at the mouth.
  { u: 1760, depth: 6, h: 60, kind: 'red', r: 22, k: 0.65, group: D.red },
  { u: 1900, depth: 6, h: 66, kind: 'lamp', r: 34, k: 0.7, group: D.lanterns },
  { u: 2200, depth: 6, h: 66, kind: 'lamp', r: 34, k: 0.7, group: D.lanterns },
  // The Voorburgwal: lanterns, the bars (closing at 02:00).
  { u: 2520, depth: 12.8, h: 84, kind: 'lamp', r: 56, k: 1, group: D.lanterns },
  { u: 2640, depth: 15.5, h: 50, kind: 'pink', r: 30, k: 0.8, group: D.bars },
  { u: 2800, depth: 12.8, h: 84, kind: 'lamp', r: 56, k: 1, group: D.lanterns },
  { u: 2930, depth: 15.5, h: 52, kind: 'cyan', r: 28, k: 0.75, group: D.bars },
  { u: 3080, depth: 12.8, h: 84, kind: 'lamp', r: 56, k: 1, group: D.lanterns },
  { u: 3210, depth: 15.5, h: 50, kind: 'red', r: 26, k: 0.75, group: D.red },
  { u: 3360, depth: 12.8, h: 84, kind: 'lamp', r: 56, k: 1, group: D.lanterns },
  // The Oude Kerk tower's floodlight (far, high, faint; no streak).
  { u: 3300, depth: 40, h: 150, kind: 'flood', r: 70, k: 0.35, group: D.tower, streak: false },
  // The Oudekerksplein: its signs, a lantern, the boss's house windows (off).
  { u: 3700, depth: 12.8, h: 84, kind: 'lamp', r: 56, k: 1, group: D.lanterns },
  { u: 3820, depth: 15.5, h: 52, kind: 'pink', r: 30, k: 0.8, group: D.plein },
  { u: 4010, depth: 15.5, h: 56, kind: 'window', r: 22, k: 0.8, group: D.bossHouse, streak: false },
  { u: 4060, depth: 15.5, h: 84, kind: 'window', r: 22, k: 0.8, group: D.bossHouse, streak: false },
  { u: 4110, depth: 15.5, h: 112, kind: 'window', r: 22, k: 0.8, group: D.bossHouse, streak: false },
  { u: 4200, depth: 12.8, h: 84, kind: 'lamp', r: 56, k: 1, group: D.lanterns },
];

/**
 * The d water line (screen y; STREET-A's layout): the coping's outer edge (depth −16.5 → y 192.5) plus
 * the brick quay face down to the water (WATER_LEVEL at that depth's scale, 6.9 px) → 199.4, so the
 * first whole water row is 200. The streaks and the reflections start there, never on the wall.
 */
export const D_WATER_Y = Math.ceil(G - D_COPING_NEAR - WATER_LEVEL * (1 - D_COPING_NEAR / (G - OAT_CAMERA.yh)));

/** The canal in front of the d quays (from the water line to the screen bottom). */
export const OAT_D_WATER: ReflectConfig = {
  bands: [
    { u0: 0, u1: 1664, y0: D_WATER_Y, y1: 216 },
    { u0: 2432, u1: 3584, y0: D_WATER_Y, y1: 216 },
  ],
  alpha: [0.45, 0.3],
  ripple: 2,
};

/** The d light config without its lamps (`setNightLights` fills them). */
function dConfig(lamps: StaticLight[]): SectionLight {
  return {
    darkness: 0.35,
    tint: PAL_HD_OAT.nightSky[0],
    lamps,
    glow: 'smooth',
    streaks: { y0: D_WATER_Y, y1: 216, length: 26, strength: 0.9, ripple: 0.5, level: 6 },
    groups: Object.values(D).map((name): LampGroupDef => (name === D.bossHouse ? { name, state: 'off' } : { name, flicker: [20, 40] })),
    // The strips' dark range (facade/rows.ts `OAT_D_DARK`: a lot border left of the arena-lock view).
    bakes: { x0: 3877, x1: 4480, fadeTicks: 60 },
    water: OAT_D_WATER,
  };
}

// ---------------------------------------------------------------------------------------------
// oat-e
// ---------------------------------------------------------------------------------------------

/** The lamp groups of oat-e. */
export const OAT_E_GROUPS = { quay: 'quay', signal: 'signal', tunnel: 'tunnel', ring: 'ring' } as const;

function eLights(): OatLamp[] {
  const out: OatLamp[] = [];
  // Prins Hendrikkade: lanterns along the quay (the station far behind the water: its own layer).
  for (let u = 300; u < 2048; u += 224) out.push({ u, depth: 10, h: 84, kind: 'lamp', r: 54, k: 0.9, group: OAT_E_GROUPS.quay });
  // The red light the taxi runs.
  out.push({ u: 2240, depth: 6, h: 70, kind: 'signal', r: 30, k: 0.9, group: OAT_E_GROUPS.signal });
  // The IJtunnel: ceiling lamps in bands, 128 px apart (≤ 2 bands per second at 3 px/tick: no strobe).
  for (let u = 2600; u < 4608; u += 128) out.push({ u, depth: 4, h: 104, kind: 'tunnel', r: 44, k: 0.85, group: OAT_E_GROUPS.tunnel, streak: true });
  // The A10 ramp: tall sodium masts.
  for (let u = 4700; u < 6144; u += 192) out.push({ u, depth: 8, h: 132, kind: 'sodium', r: 70, k: 0.9, group: OAT_E_GROUPS.ring });
  return out;
}

/** oat-e's lights (start values; TAXIRIT, wave C, tunes them with the ride). */
export const OAT_E_LIGHTS: readonly OatLamp[] = eLights();

function eConfig(lamps: StaticLight[]): SectionLight {
  return {
    darkness: 0.4,
    tint: PAL_HD_OAT.nightSky[0],
    lamps,
    glow: 'smooth',
    streaks: { y0: 166, y1: 216, length: 34, ripple: 0.3, level: 4 },
    groups: Object.values(OAT_E_GROUPS).map((name): LampGroupDef => ({ name })),
  };
}

// ---------------------------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------------------------

const lists = new Map<string, readonly OatLamp[]>();

/**
 * (Re)register a night section's lights: the section light (with its flags) and the floor light
 * (each lamp at its depth, a pool on the floor). NIGHT / TAXIRIT call it with their final lists.
 */
export function setNightLights(sectionId: string, list: readonly OatLamp[]): SectionLight {
  const lamps = lampsOf(list);
  lists.set(sectionId, list);
  const cfg = sectionId === OAT_SECTION.e ? eConfig(lamps) : dConfig(lamps);
  defineSectionLight(sectionId, cfg);
  defineFloorLight(sectionId, {
    lampDepth: (_l, i) => list[i]?.depth ?? 0,
    // The pool cuts the darkness over the baked pool (the floor painter bakes its colour).
    pool: { radius: 0.85, intensity: 0.7, glow: 0.08 },
  });
  return cfg;
}

/** The light list a night section registered (tests, the façade strips' baked light). */
export function nightLights(sectionId: string): readonly OatLamp[] {
  return lists.get(sectionId) ?? [];
}

export const OAT_D_LIGHT = setNightLights(OAT_SECTION.d, OAT_D_LIGHTS);
export const OAT_E_LIGHT = setNightLights(OAT_SECTION.e, OAT_E_LIGHTS);
