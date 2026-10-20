/**
 * ams-c1 — BRUG (docs/design/ams-extras.md §4): 1388×216, scroll right, golden late afternoon,
 * vehicles: `swan`. The route over the water: the white wooden Amstel bridge (deck y 152 over the
 * Amstel 60–860, its ramp down 760–860 to the quay at y 172) and the Blauwbrug (1020–1220) to
 * Waterlooplein; exit → `d`. It is the old section c from x 1940, re-based (old x − 1940): the
 * same waves, its sack hostage on the bridge and the last squad.
 */
import type { ScriptGen } from '../../../../engine/script';
import type { DecorDef, SectionContext, SectionDef } from '../../../mission/index';
import { at, carillon, crate, fromRight, hostage, normalUp, prewarm } from './helpers';
import { placeSecrets, secretArt } from './secrets';
import { bridgeFaceSprite, waterDecor } from './art';
import { BG_GOLDEN } from './section-c';
import { C_AMSTEL, C_BLAUWBRUG, C_BRIDGE_END, C_BRIDGE_Y, C1_W, G, terrainC1, WATER_Y } from './terrain';

const SPAN = 128;
const [BB_X, BB_LEN, BB_H] = C_BLAUWBRUG;

const decor: DecorDef[] = [
  // --- the white Amstel bridge ---
  ...waterDecor(C_AMSTEL[0], C_AMSTEL[1]),
  ...Array.from({ length: Math.ceil((C_BRIDGE_END - C_AMSTEL[0]) / SPAN) }, (_, i): DecorDef => ({ sprite: 'decor/ams/white-bridge', x: C_AMSTEL[0] + i * SPAN, y: C_BRIDGE_Y })),
  { sprite: 'decor/ams/white-portal', x: 300, y: C_BRIDGE_Y },
  { sprite: 'decor/ams/white-portal', x: 520, y: C_BRIDGE_Y },
  // --- the Blauwbrug to Waterlooplein ---
  { sprite: 'decor/ams/lamp', x: 920, y: G },
  { sprite: 'decor/ams/blauwbrug-lamp', x: BB_X + 12, y: G },
  { sprite: 'decor/ams/blauwbrug-lamp', x: BB_X + BB_LEN - 12, y: G },
  { sprite: 'decor/ams/flag-ams', x: BB_X + 100, y: G - BB_H, animate: true },
  { sprite: 'decor/ams/market-stall', frame: 0, x: 1290, y: G },
  { sprite: 'decor/ams/flag-nl', x: 1350, y: G, animate: 11 },
  // --- front ---
  { sprite: 'decor/ams/bollard', x: 880, y: 175, front: true },
  { sprite: bridgeFaceSprite(BB_LEN, BB_H), x: BB_X, y: G, front: true },
  { sprite: 'decor/ams/bollard', x: 1260, y: G, front: true },
];

/** The city life of c1: tour boats and ducks on the Amstel, pigeons on the Waterlooplein quay. */
export function life(ctx: SectionContext): void {
  ctx.spawn('ams-tour-boat', C_AMSTEL[0] + 40, 182, { range: 560, speed: 0.35 });
  ctx.spawn('ams-tour-boat', C_AMSTEL[0] + 360, 182, { range: 360, speed: 0.3, dir: -1 });
  ctx.spawn('ams-ducks', 220, WATER_Y, { count: 3, range: 90 });
  ctx.spawn('ams-ducks', 580, WATER_Y, { count: 2, range: 60 });
  ctx.spawn('ams-pigeons', 960, G, { count: 4 });
}

/** Lamp top (a perched gull's feet) of a `decor/ams/lamp` on the ground line. */
const LAMP_TOP = G - 70;

/** ams-c1: gulls over the river, officers on the deck, the sack tourist, the last squad. */
export function* script(ctx: SectionContext): ScriptGen {
  prewarm('npc/ams/', 'decor/ams/');
  life(ctx);
  carillon(ctx);
  // Secrets (docs/design/ams-extras.md §5): the crate on the first portal's balance beam.
  placeSecrets(ctx, 'c1');

  // @0: the white Amstel bridge: gulls over the river, an officer on the deck.
  ctx.spawn('seagull', 260, 96, { flock: normalUp(ctx) ? 3 : 2 });
  at(ctx, 'handhaver', 390, { facing: -1 }, C_BRIDGE_Y);
  yield ctx.waitCamera(40);
  hostage(ctx, 'tourist', 'sack', 480, 'auto', C_BRIDGE_Y, { band: 40 });
  at(ctx, 'handhaver', 620, { facing: -1 }, C_BRIDGE_Y);
  yield ctx.waitCamera(160);
  ctx.spawn('seagull', 660, 92, { flock: 2 });
  fromRight(ctx, 'delivery-rider');

  // @460 (checkpoint): the Blauwbrug to Waterlooplein: the last squad.
  yield ctx.waitCamera(460);
  crate(ctx, 940, 'bombs');
  at(ctx, 'seagull', 920, { perch: true }, LAMP_TOP);
  fromRight(ctx, 'fatbike-youth');
  yield 70;
  fromRight(ctx, 'handhaver');
  yield ctx.waitCamera(760);
  fromRight(ctx, 'fatbike-youth', { pair: true }, 16, 'blauw');
  yield 50;
  fromRight(ctx, 'handhaver', {}, 16, 'blauw');
  ctx.spawn('delivery-rider', 0, 'ground', { from: 'behind', tag: 'blauw' });
  yield 60;
  ctx.spawn('seagull', 1210, 100, { flock: 2, tag: 'blauw' });
  if (normalUp(ctx)) fromRight(ctx, 'handhaver', {}, 16, 'blauw', 40);
  yield ctx.waitClear('blauw');
  ctx.enableExit('end');
  ctx.showGo();
}

export const sectionC1: SectionDef = {
  id: 'c1',
  name: 'Brug',
  width: C1_W,
  height: 216,
  scroll: 'right',
  background: BG_GOLDEN,
  terrain: terrainC1(),
  terrainStyle: { ground: 'klinker', edge: 'bikepath', platform: 'whitewood', solid: 'brick' },
  decor,
  // Tier 4: the decor this section draws and the fatbike pairs of its last squad.
  art: ['enemy/fatbike-youth-pair', ...new Set(decor.map((d) => d.sprite)), ...secretArt('c1')],
  playerStart: { x: 100, y: C_BRIDGE_Y },
  checkpoints: [460, 1160],
  timeLimit: 60,
  music: 'ams',
  ambience: 'env/ams-canal',
  vehicles: ['swan'],
  exits: [{ id: 'end', rect: { x: C1_W - 28, y: 96, w: 24, h: 80 }, to: 'd', disabled: true }],
  script,
};
