/**
 * ams-c2 — RONDVAART (docs/design/ams-extras.md §4): 2632×216, scroll right, golden late
 * afternoon, vehicles: `swan`. The canal cruise on the Amstel: the players board the tour boat
 * (`ams-cruise-boat`, cruise.ts) at the boarding quay (0–60); the boat holds the camera and
 * sails at 5/8 px/tick, stopping for each wave until it is cleared (or a timeout). Two low brick
 * bridges (a roof rider must crouch or get down; the skipper calls `BUKKEN!` when one comes into
 * view, 4 s before it reaches the roof), the houseboat with a tied tourist at the far quay, the
 * stag party's boat (`partyBoat`, the integrator's hook), the Magere Brug (handhavers and gulls
 * on it; it opens for the boat) with Carré on the bank, and the Waterlooplein jetty where the
 * boat docks (2492–2632); exit → `d`.
 *
 * On foot the river is deep water (it drowns); the Swan swims alongside. A player who dies drops
 * back in on the boat's deck (`respawn`).
 */
import type { ScriptGen } from '../../../../engine/script';
import type { BackgroundDef, DecorDef, SectionContext, SectionDef } from '../../../mission/index';
import { PAL } from '../../../../engine/palette';
import { hasEntity } from '../../../registry';
import { boatDecor, waterDecor } from './art';
import { AmsCruiseBoat, AmsMagereBrug, AmsPartyBoat, CRUISE, cruiseBoatOf, LOW_BRIDGE, MAGERE_BRUG } from './cruise';
import { carillon, fromRight, hostage, normalUp, prewarm, STAG_LOOKS, stagArt } from './helpers';
import { placeSecrets, secretArt } from './secrets';
import { C2_FAR_ROOF_Y, C2_HOUSEBOAT, C2_RIVER, C2_W, DECK_Y, G, ROOF_Y, terrainC2, WATER_Y } from './terrain';

/** The far quay line of the ams-amstel layer (y) and its parallax (Carré stands on it). */
export const C2_BANK_Y = 144;
export const C2_BANK_FACTOR = 0.5;

/** The river seen from the water: the far bank of the Amstel (ams-amstel) under the golden sky. */
export const BG_AMSTEL: BackgroundDef = {
  sky: PAL.sky[2],
  layers: [
    { gen: 'sky-gradient', params: { colors: [PAL.sky[1], PAL.sky[2], PAL.sky[3], PAL.gold[3], PAL.gold[2]], sun: { x: 0.82, y: 0.3, r: 9 } }, factorX: 0 },
    { gen: 'clouds', params: { y: 0.08, count: 4, ramp: [PAL.sand[2], PAL.sand[3], PAL.gold[3]] }, factorX: 0.05, driftX: 0.04 },
    { gen: 'ams-skyline', params: { y: 0.5, light: 'golden' }, width: 768, factorX: 0.1 },
    { gen: 'ams-canal-houses', params: { y: 0.56, s: 9, haze: 1, water: false, light: 'golden' }, width: 640, factorX: 0.22 },
    { gen: 'ams-amstel', params: { y: C2_BANK_Y / 216, light: 'golden' }, width: 768, factorX: C2_BANK_FACTOR },
  ],
};

/** The boat: its stern at the start, the stops (stern x) and the dock. */
export const C2_STERN0 = C2_RIVER[0] - CRUISE.deck[0];
export const C2_STOPS = { gulls: 180, houseboat: 920, party: 1220, dock: C2_RIVER[1] - CRUISE.deck[1] } as const;
/** The two low bridges (centre x). */
export const C2_BRIDGES: readonly number[] = [700, 1660];
/** The Magere Brug (centre x) and the stop before it (the bow 10 px short of its left portal). */
export const C2_MAGERE_X = 2060;
export const C2_MAGERE_STOP = C2_MAGERE_X - MAGERE_BRUG.w / 2 - 10 - CRUISE.len;
/** The portals' top beam (a perched gull's feet). */
export const C2_PORTAL_TOP = 50;
/** Carré on the far bank: placed so it stands behind the boat's bow at the Magere Brug stop (view x 220). */
export const C2_CARRE_X = Math.round(220 + (C2_MAGERE_STOP - CRUISE.sternVx) * C2_BANK_FACTOR);
/** Waves wait this long at most (ticks) before the boat sails on. */
export const C2_WAVE_TIMEOUT = 900;

const FAR_DECK_Y = C2_FAR_ROOF_Y + DECK_Y - ROOF_Y;

const decor: DecorDef[] = [
  // --- the boarding quay ---
  { sprite: 'decor/ams/lamp', x: 10, y: G },
  { sprite: 'decor/ams/route-sign', frame: 1, x: 24, y: G },
  // --- the river ---
  ...waterDecor(C2_RIVER[0], C2_RIVER[1]),
  // Carré on the far bank (it glides with the bank layer).
  { sprite: 'decor/ams/carre', x: C2_CARRE_X, y: C2_BANK_Y, parallax: C2_BANK_FACTOR },
  // The houseboat at the far quay.
  ...boatDecor([C2_HOUSEBOAT], C2_FAR_ROOF_Y, DECK_Y - ROOF_Y),
  // The low bridges: the parapet, the far arch and the piers behind, the slab face in front.
  ...C2_BRIDGES.flatMap((x): DecorDef[] => [
    { sprite: 'decor/ams/low-bridge/back', x, y: LOW_BRIDGE.top },
    { sprite: 'decor/ams/low-bridge', x, y: LOW_BRIDGE.top, front: true },
  ]),
  // The Magere Brug's portals with their lights (the bascule is the entity).
  { sprite: 'decor/ams/magere-brug/back', x: C2_MAGERE_X, y: MAGERE_BRUG.top },
  // --- the Waterlooplein jetty ---
  { sprite: 'decor/ams/lamp', x: C2_RIVER[1] + 24, y: G },
  { sprite: 'decor/ams/route-sign', frame: 2, x: C2_RIVER[1] + 70, y: G },
  { sprite: 'decor/ams/market-stall', frame: 1, x: C2_W - 30, y: G },
  { sprite: 'decor/ams/bollard', x: C2_RIVER[1] + 6, y: G, front: true },
];

/** The life of c2: ducks on the river, pigeons on the Waterlooplein jetty. */
export function life(ctx: SectionContext): void {
  ctx.spawn('ams-ducks', 420, WATER_Y, { count: 3, range: 80 });
  ctx.spawn('ams-ducks', 1360, WATER_Y, { count: 2, range: 60 });
  ctx.spawn('ams-pigeons', C2_RIVER[1] + 60, G, { count: 4 });
}

/** Wait for every member of a wave (tag) or `timeout` script ticks (held ticks do not count). */
export function* waveOrTimeout(ctx: SectionContext, tag: string, timeout = C2_WAVE_TIMEOUT): ScriptGen {
  let n = 0;
  yield () => ++n >= timeout || ctx.world.countAlive(tag) === 0;
}

/** Sail on and stop with the stern at x. */
export function* sailTo(boat: AmsCruiseBoat, x: number): ScriptGen {
  boat.cruiseTo(x);
  yield () => boat.still;
}

/** All aboard: every player on foot stands on the boat (riders swim), at most 7 s. */
function* board(ctx: SectionContext, boat: AmsCruiseBoat): ScriptGen {
  let n = 0;
  yield () => {
    if (++n < 60) return false;
    if (n >= 420) return true;
    for (const p of ctx.players) if (p.state === 'play' && !boat.carries(p)) return false;
    return true;
  };
}

/**
 * INTEGRATOR HOOK — the stag party alongside (docs/design/ams-extras.md §2.4, §4): when
 * `stag-partier` is registered, a small open party boat (`ams-party-boat`) sails in ahead of the
 * cruise and its partiers (tag 'party') fire corks from it; the cruise waits for them (or the
 * timeout) and the party boat leaves. Without the stag party the cruise sails on.
 */
export function* partyBoat(ctx: SectionContext, boat: AmsCruiseBoat): ScriptGen {
  if (!hasEntity('stag-partier')) return;
  // The party boat sails in with its partiers on deck while the cruise slows down for its stop
  // (the view's left edge then: the stop − sternVx); it lies 330 px into that view.
  const left = C2_STOPS.party - CRUISE.sternVx;
  boat.cruiseTo(C2_STOPS.party);
  const pb = ctx.spawn('ams-party-boat', left + 384 + 40, 172, { to: left + 330 }) as AmsPartyBoat;
  const top = pb.box.y;
  for (let i = 0; i < (normalUp(ctx) ? 3 : 2); i++) ctx.spawn('stag-partier', pb.x - 16 + i * 14, top, { facing: -1, look: STAG_LOOKS[i % STAG_LOOKS.length], tag: 'party', groom: i === 1, gag: false });
  yield () => boat.still && pb.arrived;
  yield* waveOrTimeout(ctx, 'party');
  pb.leave();
}

/**
 * ams-c2: board, gulls, the first low bridge, the houseboat tourist, the party boat, the second
 * low bridge, the Magere Brug, the Waterlooplein jetty.
 */
export function* script(ctx: SectionContext): ScriptGen {
  prewarm('npc/ams/', 'decor/ams/');
  life(ctx);
  carillon(ctx);
  // Secrets (docs/design/ams-extras.md §5): the roof hatch of the moored houseboat.
  placeSecrets(ctx, 'c2');
  const boat = ctx.spawn('ams-cruise-boat', C2_STERN0, G, {}) as AmsCruiseBoat;
  for (const x of C2_BRIDGES) ctx.spawn('ams-low-bridge', x, LOW_BRIDGE.top, {});
  const brug = ctx.spawn('ams-magere-brug', C2_MAGERE_X, MAGERE_BRUG.top, {}) as AmsMagereBrug;

  // @0: all aboard.
  ctx.callout('ALLE AAN BOORD!', { ticks: 120 });
  yield* board(ctx, boat);
  boat.depart();

  // The first stop: gulls dive at the boat (the first ones as it leaves the quay).
  yield 60;
  ctx.spawn('seagull', ctx.camera.right + 24, 92, { flock: normalUp(ctx) ? 3 : 2, tag: 'gulls' });
  yield* sailTo(boat, C2_STOPS.gulls);
  ctx.spawn('seagull', ctx.camera.right + 24, 76, { flock: 2, tag: 'gulls' });
  yield* waveOrTimeout(ctx, 'gulls');

  // The first low bridge: an officer on it (a gull dives on the way: pacing).
  boat.cruiseTo(C2_STOPS.houseboat);
  yield 110;
  ctx.enter('seagull', 'top', { x: ctx.camera.left + 280 });
  yield ctx.waitCamera(C2_BRIDGES[0] - 420);
  ctx.spawn('handhaver', C2_BRIDGES[0] + 8, LOW_BRIDGE.top, { facing: -1, hold: 9999 });
  // The houseboat at the far quay: a tied tourist on its roof, gulls round it.
  yield ctx.waitCamera(C2_HOUSEBOAT.x0 - 480);
  hostage(ctx, 'tourist', 'chair', C2_HOUSEBOAT.cx + 30, 'auto', C2_FAR_ROOF_Y);
  ctx.spawn('seagull', C2_HOUSEBOAT.cx + 8, C2_FAR_ROOF_Y, { perch: true, tag: 'houseboat' });
  yield () => boat.still;
  ctx.spawn('seagull', ctx.camera.right + 24, 84, { flock: normalUp(ctx) ? 3 : 2, tag: 'houseboat' });
  ctx.spawn('seagull', C2_HOUSEBOAT.x0 + 6, FAR_DECK_Y, { perch: true, tag: 'houseboat' });
  yield* waveOrTimeout(ctx, 'houseboat');

  // Pacing (GDD 1.5: no dead stretch over 4 s): gulls dive at the boat on the way to the party.
  boat.cruiseTo(C2_STOPS.party);
  yield 120;
  ctx.spawn('seagull', ctx.camera.right + 24, 80, { flock: normalUp(ctx) ? 3 : 2 });
  yield 150;
  ctx.enter('seagull', 'top', { x: ctx.camera.left + 300 });
  // The stag party alongside (the integrator's hook).
  yield* partyBoat(ctx, boat);

  // The second low bridge: an officer and a gull on it; one more gull dives on the way to the
  // Magere Brug (pacing).
  boat.cruiseTo(C2_MAGERE_STOP);
  ctx.world.scripts.run(
    (function* lateGull(): ScriptGen {
      yield ctx.waitCamera(C2_BRIDGES[1] - 200);
      ctx.enter('seagull', 'top', { x: ctx.camera.left + 300 });
    })(),
  );
  yield ctx.waitCamera(C2_BRIDGES[1] - 420);
  ctx.spawn('handhaver', C2_BRIDGES[1] - 8, LOW_BRIDGE.top, { facing: -1, hold: 9999 });
  ctx.spawn('seagull', C2_BRIDGES[1] + 16, LOW_BRIDGE.top, { perch: true });

  // The Magere Brug: handhavers on the bascule, gulls on the portals; it opens for the boat.
  yield ctx.waitCamera(C2_MAGERE_STOP - CRUISE.sternVx - 120);
  const bx = C2_MAGERE_X;
  ctx.spawn('handhaver', bx - 24, MAGERE_BRUG.top, { facing: -1, hold: 9999, tag: 'magere' });
  ctx.spawn('handhaver', bx + 22, MAGERE_BRUG.top, { facing: -1, hold: 9999, tag: 'magere', skin: 'b' });
  if (normalUp(ctx)) ctx.spawn('handhaver', bx + 2, MAGERE_BRUG.top, { facing: -1, hold: 9999, tag: 'magere', skin: 'c' });
  ctx.spawn('seagull', bx - MAGERE_BRUG.w / 2 + 6, C2_PORTAL_TOP, { perch: true, tag: 'magere' });
  ctx.spawn('seagull', bx + MAGERE_BRUG.w / 2 - 6, C2_PORTAL_TOP, { perch: true, tag: 'magere' });
  yield () => boat.still;
  yield* waveOrTimeout(ctx, 'magere');
  yield 30;
  brug.open();
  // The bell scares a pair of gulls off the far quay (pacing: the bridge takes 1.6 s to open).
  ctx.spawn('seagull', ctx.camera.right + 24, 84, { flock: 2 });
  yield () => brug.state === 'open';
  ctx.callout('DE MAGERE BRUG!', { ticks: 90 });

  // The Waterlooplein jetty: officers and riders wait on it; the boat docks.
  boat.cruiseTo(C2_STOPS.dock);
  yield ctx.waitCamera(C2_RIVER[1] - 520);
  ctx.spawn('seagull', ctx.camera.right + 24, 88, { flock: 2, tag: 'jetty' });
  yield ctx.waitCamera(C2_STOPS.dock - CRUISE.sternVx - 90);
  fromRight(ctx, 'handhaver', {}, 16, 'jetty');
  yield 40;
  fromRight(ctx, 'fatbike-youth', {}, 16, 'jetty');
  if (normalUp(ctx)) fromRight(ctx, 'handhaver', {}, 16, 'jetty', 30);
  yield () => boat.still;
  boat.dock();
  yield 30;
  fromRight(ctx, 'delivery-rider', {}, 16, 'jetty');
  yield* waveOrTimeout(ctx, 'jetty', 1800);
  boat.release();
  ctx.unlockCamera(false);
  ctx.enableExit('end');
  ctx.showGo();
}

/** Respawn on the boat's deck while it sails (the drop-in lands mid-deck; it drifts back a little). */
export function respawn(_p: unknown, ctx: SectionContext): { x: number; y: number } | null {
  const boat = cruiseBoatOf(ctx.world);
  if (!boat || !boat.leads) return null;
  return { x: boat.fx + (boat.still ? 96 : 120), y: boat.deckY };
}

export const sectionC2: SectionDef = {
  id: 'c2',
  name: 'Rondvaart',
  width: C2_W,
  height: 216,
  scroll: 'right',
  background: BG_AMSTEL,
  terrain: terrainC2(),
  terrainStyle: { ground: 'klinker', edge: 'kerb', platform: 'whitewood', solid: 'brick' },
  decor,
  // Tier 4: the decor this section draws and what its script spawns (the boats, the bridges).
  // The stag party on its boat (docs/api/stag.md §5; no beer bike on the water) and the secret.
  art: [...new Set(decor.map((d) => d.sprite)), 'decor/ams/ams-cruise-boat', 'decor/ams/magere-brug', 'decor/ams/ams-boat-platform', ...stagArt(STAG_LOOKS, { groom: true }), ...secretArt('c2')],
  // Tier 4: the bridges, Carré and the party boat's stag party come well into the cruise: not
  // built ahead in c (the 1P budget).
  artLate: ['decor/ams/low-bridge', 'decor/ams/magere-brug', 'decor/ams/carre', 'enemy/stag-', 'enemy/cork/'],
  playerStart: { x: 40, y: G },
  checkpoints: [640, 1320, 2040],
  timeLimit: 60,
  music: 'ams',
  ambience: 'env/ams-canal',
  vehicles: ['swan'],
  respawn: (p, ctx) => respawn(p, ctx),
  exits: [{ id: 'end', rect: { x: C2_W - 28, y: 96, w: 24, h: 80 }, to: 'd', disabled: true }],
  script,
};
