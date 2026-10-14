/**
 * ams-b — MUSEUMPLEIN (docs/design/amsterdam.md §6): 3072×216, scroll right, noon. The street to
 * the museum (0–380), THE PASSAGE through the Rijksmuseum (400–720, solid ceiling y 84–96), the
 * Museumplein lawn with the long pool and the HOT-DOG STAND (box 960–1024, hatch 980–1004,
 * counter y 147; the Swan parks at ~1080), and the canal-side road toward the Amstel (2200–3072).
 *
 * Script: the riders in the passage, the vendor and THE SWAN (greeting + glide lesson; records
 * 'ams/swan-met' and 'm1/swan-lesson'), the gull set piece, three tourists, the exit at the end.
 */
import { PAL } from '../../../../engine/palette';
import type { Entity } from '../../../../engine/entity';
import type { ScriptGen } from '../../../../engine/script';
import type { BackgroundDef, DecorDef, SectionContext, SectionDef } from '../../../mission/index';
import { hudOf } from '../../../context';
import type { Player } from '../../../player/player';
import { isSwan } from '../../vehicles/swan/swan';
import { HOUSE, houseRow, lawnSprite, poolSprite } from './art';
import { AmsHotdogVendor } from './entities';
import { at, carillon, crate, fromRight, hostage, normalUp, prewarm, twoPlayers } from './helpers';
import { B_HOTDOG_X, B_PASSAGE, B_W, G, terrainB } from './terrain';

export const BG_NOON: BackgroundDef = {
  sky: PAL.sky[1],
  layers: [
    { gen: 'sky-gradient', params: { colors: [PAL.sky[0], PAL.sky[1], PAL.sky[2], PAL.sky[3]] }, factorX: 0 },
    { gen: 'clouds', params: { y: 0.06, count: 5, ramp: [PAL.snow[1], PAL.snow[2], PAL.snow[3]] }, factorX: 0.05, driftX: 0.05 },
    { gen: 'ams-skyline', params: { y: 0.5, light: 'noon', tower: false }, width: 768, factorX: 0.08 },
    { gen: 'ams-canal-houses', params: { y: 0.6, s: 9, haze: 1, water: false, light: 'noon' }, width: 640, factorX: 0.18 },
    { gen: 'ams-plein', params: { y: 0.72, light: 'noon' }, width: 1024, factorX: 0.38 },
    { gen: 'ams-elms', params: { y: 0.24, spacing: 192, bikes: false, light: 'noon' }, width: 576, factorX: 0.66 },
  ],
};

const LAWN0 = B_PASSAGE[1];
const LAWN1 = 1800;

const decor: DecorDef[] = [
  // --- the street to the museum ---
  ...houseRow('noon', 0, [HOUSE.koffie, HOUSE.step, HOUSE.bell, HOUSE.flat, HOUSE.neck]),
  { sprite: 'decor/ams/lamp', x: 110, y: G },
  { sprite: 'decor/ams/flag-nl', x: 300, y: G, animate: true },
  // --- the Rijksmuseum and its passage ---
  { sprite: 'decor/ams/rijksmuseum', x: B_PASSAGE[0] + 160, y: G },
  // --- Museumplein ---
  ...Array.from({ length: Math.ceil((LAWN1 - LAWN0) / 128) }, (_, i): DecorDef => {
    const x = LAWN0 + i * 128;
    return { sprite: poolSprite(Math.min(128, LAWN1 - x)), x, y: 166, animate: true };
  }).filter((d) => d.x >= 1200 && d.x < 1700),
  { sprite: 'decor/ams/elm', x: 820, y: G },
  { sprite: 'decor/ams/tulips', x: 900, y: G, animate: true },
  { sprite: 'decor/ams/hotdog-stand', x: B_HOTDOG_X, y: G },
  { sprite: 'decor/ams/flag-red', x: B_HOTDOG_X + 57, y: G - 61, animate: true },
  { sprite: 'decor/ams/lamp-grey', x: B_HOTDOG_X + 74, y: G },
  { sprite: 'decor/ams/elm', x: 1180, y: G },
  { sprite: 'decor/ams/flag-ams', x: 1290, y: G, animate: true },
  { sprite: 'decor/ams/flag-nl', x: 1330, y: G, animate: 10 },
  { sprite: 'decor/ams/elm', x: 1500, y: G },
  { sprite: 'decor/ams/tulips', x: 1600, y: G, animate: 13 },
  { sprite: 'decor/ams/bench', x: 1660, y: G },
  { sprite: 'decor/ams/elm', x: 1820, y: G },
  { sprite: 'decor/ams/lamp', x: 1960, y: G },
  { sprite: 'decor/ams/tulips', x: 2050, y: G, animate: true },
  { sprite: 'decor/ams/elm', x: 2140, y: G },
  // --- the canal-side road toward the Amstel ---
  ...houseRow('noon', 2200, [HOUSE.stepBrown, HOUSE.spout, HOUSE.boeken, HOUSE.neckRed, HOUSE.bellCream, HOUSE.flat, HOUSE.step, HOUSE.bell, HOUSE.kaas, HOUSE.neck, HOUSE.spout, HOUSE.koffie, HOUSE.step, HOUSE.bloemen, HOUSE.flat, HOUSE.bell]),
  { sprite: 'decor/ams/lamp', x: 2300, y: G },
  { sprite: 'decor/ams/lamp', x: 2620, y: G },
  { sprite: 'decor/ams/flag-ams', x: 2760, y: G, animate: true },
  { sprite: 'decor/ams/lamp', x: 2940, y: G },
  // --- front ---
  ...Array.from({ length: Math.ceil((LAWN1 - LAWN0) / 128) }, (_, i): DecorDef => {
    const x = LAWN0 + i * 128;
    return { sprite: lawnSprite(Math.min(128, LAWN1 - x)), x, y: 173, front: true };
  }),
  { sprite: 'decor/ams/bollard', x: 60, y: G, front: true },
  { sprite: 'decor/ams/bollard', x: 76, y: G, front: true },
  { sprite: 'decor/ams/bike-rack', x: 250, y: G, front: true },
  { sprite: 'decor/ams/hotdog-front', x: B_HOTDOG_X, y: G, front: true },
  { sprite: 'decor/ams/cabinet', x: B_HOTDOG_X + 66, y: G, front: true },
  { sprite: 'decor/ams/bike-rack', x: 2400, y: G, front: true },
  { sprite: 'decor/ams/bollard', x: 2560, y: G, front: true },
  { sprite: 'decor/ams/bollard', x: 2576, y: G, front: true },
  { sprite: 'decor/ams/bike-rack', x: 2860, y: G, front: true },
];

/** Vendor spot: in the hot-dog stand's box, his head and chest in the hatch (`hotdog-front` hides the rest). */
export const B_VENDOR = { x: B_HOTDOG_X + 32, y: G - 8 } as const;

/**
 * The city life of section b (cosmetic, sleeps off-screen) and the hot-dog vendor in his hatch
 * (he salutes passing players on his own). Call it at the start of `script`.
 */
export function life(ctx: SectionContext): { vendor: Entity } {
  ctx.spawn('ams-pigeons', B_HOTDOG_X + 112, G, { count: 5 });
  ctx.spawn('ams-pigeons', 1640, G, { count: 4 });
  ctx.spawn('ams-pigeons', 2520, G, { count: 3 });
  ctx.spawn('ams-window-waver', 2330, 104, {});
  ctx.spawn('ams-window-waver', 2700, 96, { look: 'cat' });
  const vendor = ctx.spawn('ams-hotdog-vendor', B_VENDOR.x, B_VENDOR.y, { counter: false, facing: -1 });
  return { vendor };
}

/** Where THE SWAN is parked (next to the hot-dog stand); player 2's Mute behind her. */
export const SWAN_X = 1080;
export const MUTE_X = 1128;
/** The Swans park when the camera's left edge reaches `SWAN_X - SWAN_PARK_AHEAD` (still off screen). */
export const SWAN_PARK_AHEAD = 480;

/** A live player within 72 px of a live Swan (no allocation: this runs every tick). */
function playerAtSwan(ctx: SectionContext): Player | null {
  const vs = ctx.world.byTag('vehicle');
  for (let i = 0; i < vs.length; i++) {
    const s = vs[i];
    if (!isSwan(s) || !s.alive) continue;
    for (const p of ctx.players) {
      if (p.alive && p.state === 'play' && Math.abs(p.x - s.x) < 72) return p;
    }
  }
  return null;
}

/** Gramps on the radio: a navy bubble over a player, voiced by its sample when one is loaded. */
function radio(ctx: SectionContext, p: Entity, text: string, ticks = 150): void {
  hudOf(ctx.world).bubble(p, text, { kind: 'radio', ticks, speaker: 'gramps' });
}

/** Gramps talks one thread at a time: the lesson waits while the greeting is on the radio. */
interface RadioState {
  greeting: boolean;
}

/** The parked Swan's note and Gramps on the radio when a player walks up to her. */
function* swanGreeting(ctx: SectionContext, vendor: Entity, radioState: RadioState): ScriptGen {
  let near: Player | null = null;
  yield () => (near = playerAtSwan(ctx)) !== null;
  const p = near as Player | null;
  if (!p) return;
  ctx.records.set('ams/swan-met', true);
  radioState.greeting = true;
  try {
    // The note on her (above the RIDE? bubble) is a sign, not a voice: it shows at once.
    hudOf(ctx.world).bubble({ x: SWAN_X, y: G - 62 }, 'SWAN-3. SHORE LEAVE TOO.', { kind: 'hint', ticks: 110, voice: false });
    // Let the vendor's salute finish first (he stands 90 px before her): one voice at a time.
    let wait = 0;
    yield () => ++wait > 90 || !(vendor instanceof AmsHotdogVendor) || vendor.mode !== 'salute';
    // The radio waits until the sign note (110 ticks) is gone: they share the space over her.
    yield Math.max(30, 112 - wait);
    radio(ctx, p, 'GRAMPS: I BROUGHT HER ALONG.', 120);
    yield 130;
    radio(ctx, p, "DON'T TELL ACCOUNTING.", 110);
    yield 120;
  } finally {
    radioState.greeting = false;
  }
}

/** The first mount of a Swan: the glide lesson on the radio (m1-c skips its own after this). */
function* swanLesson(ctx: SectionContext, radioState: RadioState): ScriptGen {
  let rider: Entity | null = null;
  const off = ctx.world.events.on('vehicleMounted', (e) => {
    if (!rider && isSwan(e.vehicle)) rider = e.player;
  });
  try {
    yield () => rider !== null;
  } finally {
    off();
  }
  ctx.records.set('ams/swan-met', true);
  if (ctx.records.get('m1/swan-lesson', false)) return;
  ctx.records.set('m1/swan-lesson', true);
  const p = rider as Entity | null;
  if (!p) return;
  yield 30;
  yield () => !radioState.greeting;
  radio(ctx, p, 'GRAMPS: SHE GLIDES, YOU KNOW.', 110);
  yield 120;
  radio(ctx, p, 'HOLD JUMP IN THE AIR.', 110);
  yield 150;
  radio(ctx, p, 'AND MIND THE TULIPS!', 110);
}

/** Lamp top (a perched gull's feet) of a `decor/ams/lamp` on the ground line. */
const LAMP_TOP = G - 70;

/**
 * ams-b: riders through the Rijksmuseum passage, the hot-dog vendor and THE SWAN, the gull set
 * piece over the square, youths on the grass, the canal-side road; the exit opens at the end.
 */
export function* script(ctx: SectionContext): ScriptGen {
  prewarm('npc/ams/', 'decor/ams/');
  const { vendor } = life(ctx);
  carillon(ctx);
  ctx.spawn('ams-pigeons', 300, G, { count: 3 });
  ctx.spawn('ams-pigeons', 2900, G, { count: 4 });

  // THE SWAN parked next to the stand (the Mute for player 2).
  // She is parked just before she scrolls into view (her nervous egg comes 600 ticks after she
  // parks: spawned at the section start, she laid it right as the player walked up).
  ctx.world.scripts.run(
    (function* parkSwans(): ScriptGen {
      yield ctx.waitCamera(SWAN_X - SWAN_PARK_AHEAD);
      ctx.spawn('swan', SWAN_X, 'ground', { facing: 1 });
      if (twoPlayers(ctx)) ctx.spawn('swan', MUTE_X, 'ground', { variant: 'mute', facing: 1 });
    })(),
  );
  const radioState: RadioState = { greeting: false };
  ctx.world.scripts.run(swanGreeting(ctx, vendor, radioState));
  ctx.world.scripts.run(swanLesson(ctx, radioState));

  // @0: the street to the museum.
  crate(ctx, 300, 'M');
  at(ctx, 'seagull', 110, { perch: true }, LAMP_TOP);
  yield ctx.waitCamera(60);
  fromRight(ctx, 'delivery-rider');
  yield 80;
  fromRight(ctx, 'fatbike-youth');

  // @240: THE PASSAGE: riders rush through both ways, bells echo under the vault.
  yield ctx.waitCamera(240);
  fromRight(ctx, 'delivery-rider');
  yield 50;
  ctx.spawn('delivery-rider', 0, 'ground', { from: 'behind' });
  yield 70;
  fromRight(ctx, 'delivery-rider', {}, 16, undefined, 30);
  yield ctx.waitCamera(420);
  ctx.enter('fatbike-youth', 'right', { params: { pair: true } });
  yield 60;
  if (normalUp(ctx)) ctx.spawn('delivery-rider', 0, 'ground', { from: 'behind' });

  // @640: Museumplein: the hot-dog stand and the Swan; youths on the lawn.
  yield ctx.waitCamera(640);
  at(ctx, 'fatbike-youth', 1240, { gag: 'circles', facing: -1 });
  ctx.spawn('ams-tulip-stall', 900, 'ground', { contains: 'bombs' });
  // Pacing (GDD 1.5): a gull over the lawn on the walk to the stand.
  yield ctx.waitCamera(720);
  ctx.enter('seagull', 'top', { x: 960 });
  yield ctx.waitCamera(800);
  // The phone rider waits until Gramps has finished at the Swan (or the player walked on).
  yield () => (ctx.records.get('ams/swan-met', false) && !radioState.greeting) || ctx.world.camera.left >= 1000;
  fromRight(ctx, 'delivery-rider', { gag: 'phone' });

  // @1100: the gull set piece over the square: gulls steal fries, then dive.
  yield ctx.waitCamera(1100);
  hostage(ctx, 'tourist', 'chair', 1420, 'auto');
  at(ctx, 'seagull', 1380, { gag: 'fries', facing: -1 });
  at(ctx, 'seagull', 1460, { gag: 'fries', facing: 1 });
  at(ctx, 'fatbike-youth', 1560, { gag: 'circles', facing: -1 });
  yield ctx.waitCamera(1240);
  ctx.spawn('seagull', 1500, 100, { flock: normalUp(ctx) ? 3 : 2 });
  yield ctx.waitCamera(1400);
  ctx.enter('fatbike-youth', 'right', { params: { pair: true } });
  hostage(ctx, 'tourist', 'sack', 1760, 'auto');
  yield 80;
  ctx.spawn('delivery-rider', 0, 'ground', { from: 'behind' });
  yield ctx.waitCamera(1600);
  ctx.spawn('seagull', 1900, 96, { flock: normalUp(ctx) ? 4 : 3 });
  at(ctx, 'fatbike-youth', 2000, { gag: 'circles', facing: -1 });
  yield ctx.waitCamera(1800);
  fromRight(ctx, 'fatbike-youth');
  yield 50;
  fromRight(ctx, 'delivery-rider');

  // @2200 (checkpoint 2300): the canal-side road toward the Amstel.
  yield ctx.waitCamera(2000);
  ctx.spawn('ams-herring-cart', 2340, 'ground', {});
  crate(ctx, 2260, 'bombs');
  at(ctx, 'seagull', 2300, { perch: true }, LAMP_TOP);
  at(ctx, 'seagull', 2620, { perch: true }, LAMP_TOP);
  yield ctx.waitCamera(2200);
  fromRight(ctx, 'delivery-rider');
  yield 60;
  fromRight(ctx, 'fatbike-youth', { pair: true });
  yield ctx.waitCamera(2380);
  hostage(ctx, 'tourist', 'chair', 2760, 'auto');
  ctx.spawn('delivery-rider', 0, 'ground', { from: 'behind' });
  yield 60;
  fromRight(ctx, 'fatbike-youth');
  // The last squad, then the way on opens.
  yield ctx.waitCamera(2560);
  fromRight(ctx, 'fatbike-youth', {}, 16, 'bend');
  ctx.spawn('seagull', 2860, 104, { flock: 2, tag: 'bend' });
  yield 60;
  fromRight(ctx, 'delivery-rider', {}, 16, 'bend');
  if (normalUp(ctx)) fromRight(ctx, 'fatbike-youth', { pair: true }, 16, 'bend', 40);
  yield ctx.waitClear('bend');
  ctx.enableExit('end');
  ctx.showGo();
}

export const sectionB: SectionDef = {
  id: 'b',
  name: 'Museumplein',
  width: B_W,
  height: 216,
  scroll: 'right',
  background: BG_NOON,
  terrain: terrainB(),
  terrainStyle: { ground: 'klinker', edge: 'bikepath', platform: 'wood', solid: 'brick' },
  decor,
  playerStart: { x: 48, y: G },
  checkpoints: [1200, 2300],
  timeLimit: 60,
  music: 'ams',
  ambience: 'env/ams-street',
  exits: [{ id: 'end', rect: { x: 3000, y: 96, w: 24, h: 80 }, to: 'c', disabled: true }],
  script,
};
