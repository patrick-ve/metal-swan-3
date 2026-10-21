/**
 * The church interior's layout (CHURCH, wave B; docs/design/oldenzaal.md §7): the numbers of the
 * nave (oz-d) and the crypt (oz-e) in world px. The terrain, the decor lists, the light configs,
 * the entities and the scripts all read these, so the art sits on the collision and the set
 * pieces happen where the art shows them.
 *
 * The nave (west → east, left → right): the west end (the red doors, the holy water font, the
 * organ loft above) · six sandstone pillars with the Stations of the Cross, saints and the pulpit ·
 * pews (one-way platforms) · a confessional · the side chapel of the dead behind its iron grille
 * (the column comes out of it) · Mary with the votive candles · the choir up two steps (the
 * altar, the crucifix, the candlesticks, the red sanctuary lamp) · the stair down to the crypt in
 * the apse's right corner (the exit).
 *
 * The crypt (west → east): the stair down from the choir · squat columns under low groin vaults ·
 * tombs whose lids slide off (the zombies' 'rise' openings) · old coffins on trestles (low
 * platforms) · the iron gate (a locked fight) · the narrow stair up to the tower door (the exit).
 */
import { terrain, type TerrainDef } from '../../../mission/index';
import { G } from '../../missions/oldenzaal/terrain';

export { G };

/** A one-way platform as [x, y, w] (y = the line the feet stand on). */
export type Plat = readonly [number, number, number];

// =============================================================================================
// oz-d: the nave
// =============================================================================================

/** The nave's width (about 1:30 of play with three locks). */
export const NAVE_W = 1664;

/** The west end's decor (the wall with the doorway, the organ loft): its left x and width. */
export const NAVE_WEST_W = 208;
/** The centre of the west doorway (the red doors); the players start right of it. */
export const NAVE_DOOR_X = 52;
/** The holy water font by the door (its foot). */
export const NAVE_FONT_X = 168;

/** The sandstone pillars (centre x; the arcade toward the north aisle behind them). */
export const NAVE_PILLARS: readonly number[] = [240, 432, 624, 816, 1008, 1200];

/** The pew blocks: [x, w] (their backs' top rail is a one-way platform at `PEW_Y`). */
export const NAVE_PEWS: ReadonlyArray<readonly [number, number]> = [
  [276, 96],
  [852, 96],
  [1044, 112],
];
/** The pews' top rail (feet line). */
export const PEW_Y = G - 14;

/** The confessional (centre x of the booth). */
export const NAVE_CONFESSIONAL_X = 528;
/** The side chapel of the dead (between pillars 624 and 816): its grille's centre and width. */
export const NAVE_CHAPEL_X = 720;
export const NAVE_CHAPEL_W = 152;
/** The pulpit hangs on this pillar (index into NAVE_PILLARS). */
export const NAVE_PULPIT_PILLAR = 4;
/** Mary and the votive candle rack in front of her (centre x). */
export const NAVE_MARY_X = 1164;
export const NAVE_VOTIVE_X = 1146;
/** The saints on pillar consoles: [pillar index, frame of `decor/oz-nave/saint`]. */
export const NAVE_SAINTS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [3, 1],
];
/** The Stations of the Cross on pillars: [pillar index, station frame 0 … 6 = I … VII]. */
export const NAVE_STATIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [2, 2],
  [5, 5],
];

/**
 * The choir (from CHOIR_X): the altar stands on its stepped predella in the back plane (decor), so
 * the floor stays flat where the heroes walk (decor is drawn behind the terrain).
 */
export const CHOIR_X = 1344;
/** The altar (centre x), the crucifix above it, the sanctuary lamp. */
export const NAVE_ALTAR_X = 1504;
export const NAVE_LAMP_X = 1420;
/** The apse wall's decor (behind the choir): left x. */
export const NAVE_APSE_X = 1344;
/** The stair down to the crypt: the dark doorway in the apse's right corner (centre x). */
export const NAVE_CRYPT_DOOR_X = 1622;

/** The grave slabs in the nave floor (centre x; `oz-slab` openings). */
export const NAVE_SLABS: readonly number[] = [132, 336, 572, 920, 1112, 1290];
/** The slab before the altar (in the choir). */
export const NAVE_CHOIR_SLAB = 1430;

/** The iron chandeliers hanging from the vault (centre x) and which of them still burn. */
export const NAVE_CHANDELIERS: ReadonlyArray<readonly [number, boolean]> = [
  [336, false],
  [720, true],
  [1104, false],
];

/** Cold moonlight falling through the aisle windows onto the floor (centre x on the floor). */
export const NAVE_MOON_SHAFTS: readonly number[] = [470, 960];

/** The three locks: the doors slam (with the MG zombie), the chapel's column, the choir. */
export const NAVE_ARENAS = {
  doors: [0, 384],
  chapel: [528, 912],
  choir: [1280, 1664],
} as const;

/** Checkpoints (≤ 1,400 px apart; the mission tests). */
export const NAVE_CHECKPOINTS: readonly number[] = [560, 1120];

/** The exit: the crypt stair's doorway (feet in the rect) → oz-e. */
export const NAVE_EXIT = { x: NAVE_W - 36, y: 0, w: 36, h: 216 } as const;

/** The nave's terrain style (church/art-terrain.ts; 1× rows in src/game/art/terrain-art.ts). */
export const NAVE_STYLE = { ground: 'oz-nave-floor', platform: 'oz-pew', solid: 'oz-nave-step', seed: 4 } as const;

export function terrainNave(): TerrainDef {
  const t = terrain(NAVE_W, 216);
  t.ground().at(0, G).flat(NAVE_W);
  for (const [x, w] of NAVE_PEWS) t.platform(x, PEW_Y, w);
  return t.build();
}

// =============================================================================================
// oz-e: the crypt
// =============================================================================================

/** The crypt's width (about 1:00 of play, one locked fight and the tombs after the gate). */
export const CRYPT_W = 1536;

/** The squat columns of the crypt (centre x) under the groin vaults. */
export const CRYPT_COLUMNS: readonly number[] = [176, 336, 496, 656, 816, 976, 1136, 1296, 1456];

/** The tombs (`oz-tomb` openings; centre x on the floor). */
export const CRYPT_TOMBS: readonly number[] = [256, 416, 576, 736, 896, 1056, 1216, 1376];

/** Old coffins on trestles: [x, w] (low one-way platforms at `COFFIN_Y`). */
export const CRYPT_COFFINS: ReadonlyArray<readonly [number, number]> = [
  [508, 36],
  [828, 36],
  [1148, 36],
];
export const COFFIN_Y = G - 14;

/** The iron gate across the crypt (its bars' x) and the locked fight before it. */
export const CRYPT_GATE_X = 1016;
export const CRYPT_ARENA: readonly [number, number] = [640, 1024];

/** The narrow stair up to the tower door (back plane decor; its foot's left x and width). */
export const CRYPT_STAIR_X = 1424;
export const CRYPT_STAIR_W = 112;

/** Votive candles (centre x) and the hanging lanterns (centre x). */
export const CRYPT_CANDLES: readonly number[] = [116, 336, 656, 976, 1296];
export const CRYPT_LANTERNS: readonly number[] = [416, 736, 1056, 1376];

export const CRYPT_CHECKPOINTS: readonly number[] = [640, 1120];

/** The exit: the foot of the tower stair (feet in the rect) → oz-f. */
export const CRYPT_EXIT = { x: CRYPT_W - 40, y: 0, w: 40, h: 216 } as const;

/** The crypt's terrain style: rough worn flags, the coffins' lids (`oz-pew`: old dark wood), stone. */
export const CRYPT_STYLE = { ground: 'oz-crypt-floor', platform: 'oz-pew', solid: 'oz-nave-step', seed: 5 } as const;

export function terrainCrypt(): TerrainDef {
  const t = terrain(CRYPT_W, 216);
  t.ground().at(0, G).flat(CRYPT_W);
  for (const [x, w] of CRYPT_COFFINS) t.platform(x, COFFIN_Y, w);
  return t.build();
}
