/**
 * `rf-b` DE BLOKKADE (docs/design/ring.md §R.6, §R.7; ~1:30 + the boat; docs/api/ring.md "R.B2"):
 * past rf-a's police line the A10 is blocked by the climate activists of EXHAUSTING REBELLION
 * (a parody name): the police van and tape, glued and chained activists across the road, painted
 * barrels, banners, a lunch table, rows of activists sitting arm in arm on the far lanes, the big
 * spandoek, then the pink boat `DE LAATSTE DRUPPEL` (the mini-boss), the exit → MISSION COMPLETE
 * (the one tally of the whole level).
 *
 * Owner: BLOCKADE+BOAT (wave B). Keep the export `sectionRfB`, the id 'rf-b', `bossStart`
 * (`?section=rf-b&boss=1` starts at the boat) and the `missionComplete` end. Layout: layout-rf-b.ts;
 * the script: script-rf-b.ts; the set: scene-rf-b.ts; the art: art-blok.ts.
 */
import { terrain, type DecorDef, type SectionDef } from '../../../mission/index';
import { BLOK_SPR } from './art-blok';
import { RF_GROUND, RF_SECTION } from './ids';
import { FAR_LANE_Y } from './layout-rf-a';
import {
  RF_B_ARENA_L,
  RF_B_ARENA_R,
  RF_B_BOAT_X,
  RF_B_CHECKPOINTS,
  RF_B_CROWDS,
  RF_B_PLACARDS,
  RF_B_PLATFORMS,
  RF_B_POLICE_X,
  RF_B_QUEUE_END,
  RF_B_SPANDOEK_X,
  RF_B_SPANDOEK_Y,
  RF_B_W,
} from './layout-rf-b';
import { RF_BACKGROUND, farCars } from './section-rf-a';
import { RF_B_TAG, scriptRfB } from './script-rf-b';

export { RF_B_W, RF_B_ARENA_L, RF_B_ARENA_R, RF_B_BOAT_X, RF_B_POLICE_X, RF_B_TAG };

/** The first lock's left edge (PREP's skeleton export, kept). */
export const RF_B_LOCK_L = 560;

/**
 * The tier-4 art of rf-b: the blockade's decor (`ring/foot/blok/`), the shoulder, the police van
 * and tape, the activists and the police (`npc/ring/`, `fx/ring/`), the boat (`boss/ring-boot/`),
 * the crates; the throwables the activists may reuse.
 */
export const RF_B_ART: readonly string[] = [
  'ring/foot/blok/',
  'ring/foot/verge',
  'ring/foot/police-van',
  'ring/foot/police-line',
  'item/crate',
  'ring/scooter/bottle',
  'ring/parcel-van/parcel',
  'npc/ring/',
  'fx/ring/',
  'boss/ring-boot/',
];

/** The far lanes: the queue's standing cars up to the blockade line, the sitting crowds, the spandoek. */
function decorRfB(): DecorDef[] {
  // A car and its wheels go together (integrator: filtering each decor by its own x kept the front
  // wheels of a car whose body stood past the line: a lone wheel on the road).
  const out: DecorDef[] = [];
  let keep = false;
  for (const d of farCars(RF_B_QUEUE_END)) {
    if (!d.sprite.startsWith('ring/car/wheel-')) keep = d.x < RF_B_QUEUE_END;
    if (keep) out.push(d);
  }
  // The far lanes first (lane 0 is the farthest): crowds, then the placards held over them.
  for (let lane = 0; lane < 3; lane++) {
    for (const [x, l, v] of RF_B_CROWDS) if (l === lane) out.push({ sprite: BLOK_SPR.crowd, x, y: FAR_LANE_Y[l], frame: v });
    for (const [x, l, i] of RF_B_PLACARDS) if (l === lane) out.push({ sprite: BLOK_SPR.placard, x, y: FAR_LANE_Y[l] - 10, frame: i });
    if (lane === 1) out.push({ sprite: BLOK_SPR.spandoek, x: RF_B_SPANDOEK_X, y: RF_B_SPANDOEK_Y, animate: 20 });
  }
  return out;
}

function terrainRfB() {
  const t = terrain(RF_B_W, 216);
  t.ground().at(0, RF_GROUND).flat(RF_B_W);
  for (const [x, y, w] of RF_B_PLATFORMS) t.platform(x, y, w);
  return t.build();
}

export const sectionRfB: SectionDef = {
  id: RF_SECTION.b,
  name: 'DE BLOKKADE',
  width: RF_B_W,
  height: 216,
  scroll: 'right',
  background: RF_BACKGROUND,
  terrain: terrainRfB(),
  // Hidden under the shoulder strip (scene-rf-b.ts): only the collision counts.
  terrainStyle: { ground: 'concrete', platform: 'metal' },
  decor: decorRfB(),
  art: RF_B_ART,
  playerStart: { x: 48, y: RF_GROUND },
  bossStart: { x: RF_B_ARENA_L + 48, y: RF_GROUND },
  checkpoints: [...RF_B_CHECKPOINTS],
  timeLimit: 0,
  script: scriptRfB,
};
