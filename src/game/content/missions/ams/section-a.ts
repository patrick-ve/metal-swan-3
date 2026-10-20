/**
 * ams-a — GRACHTENGORDEL (docs/design/amsterdam.md §6): 3584×216, scroll right, a bright spring
 * morning. The quay street along a canal, bridge 1 (720–880), the side canal under the raised
 * drawbridge crossed on two houseboats (water 1060–1340), the PLEINTJE (1520–1904), the narrow
 * shopping street with awnings and the gable ledges to the golden record (1904–2600), bridge 2
 * (2600–2760) and the arrival at FABEL FRIET (facade 3260–3356, door/counter ~3330).
 *
 * Script: the waves (GDD wave notation via `helpers.ts`), the PLEINTJE and FABEL FRIET camera
 * locks, four tourists, the golden record on the gable ledge, THE BRIEFING (§7) and `exitTo('b')`.
 */
import { buttonMask, VirtualPad } from '../../../../engine/input';
import type { Rect } from '../../../../engine/math';
import { PAL } from '../../../../engine/palette';
import type { Entity } from '../../../../engine/entity';
import type { ScriptGen } from '../../../../engine/script';
import type { BackgroundDef, DecorDef, SectionContext, SectionDef } from '../../../mission/index';
import type { Player } from '../../../player/player';
import { eraseEnemyShots } from '../../../projectile';
import { Vehicle } from '../../../vehicle';
import { AmsBaker } from './entities';
import { at, carillon, crate, fromLeft, fromRight, hardOnly, hostage, normalUp, prewarm, STAG_LOOKS, stagArt } from './helpers';
import { placeSecrets, secretArt } from './secrets';
import { awningSprite, balustradeSprite, boatDecor, bridgeDecor, HOUSE, houseRow, rowWidth, waterDecor } from './art';
import { A_ARENA, A_AWNINGS, A_BIKE_LOCK, A_BOATS, A_BRIDGES, A_CANAL, A_FABEL_X, A_LEDGES, A_W, DECK_Y, G, ROOF_Y, terrainA, WATER_Y } from './terrain';

export const BG_MORNING: BackgroundDef = {
  sky: PAL.sky[2],
  layers: [
    { gen: 'sky-gradient', params: { colors: [PAL.sky[1], PAL.sky[2], PAL.sky[3], PAL.snow[2]], sun: { x: 0.14, y: 0.16, r: 8 } }, factorX: 0 },
    { gen: 'clouds', params: { y: 0.08, count: 5, ramp: [PAL.snow[1], PAL.snow[2], PAL.snow[3]] }, factorX: 0.05, driftX: 0.04 },
    { gen: 'ams-skyline', params: { y: 0.52, light: 'morning' }, width: 768, factorX: 0.1 },
    { gen: 'ams-canal-houses', params: { y: 0.6, s: 9, haze: 1, water: false, light: 'morning' }, width: 640, factorX: 0.22 },
    { gen: 'ams-canal-houses', params: { y: 0.72, s: 13, light: 'morning' }, width: 768, factorX: 0.42 },
    { gen: 'ams-elms', params: { y: 0.28, spacing: 150, light: 'morning' }, width: 600, factorX: 0.68 },
  ],
};

/** The shopping street: shops and canal houses side by side (1904 → ~2628). */
const STREET = [HOUSE.kaas, HOUSE.step, HOUSE.bloemen, HOUSE.neck, HOUSE.koffie, HOUSE.flat, HOUSE.boeken, HOUSE.bell, HOUSE.fietsen, HOUSE.neckRed, HOUSE.spout, HOUSE.bellCream, HOUSE.stepBrown, HOUSE.kaas];
/** Before Fabel Friet (2760 → 3260) and after its neighbour (3422 → end). */
const ARRIVAL = [HOUSE.flat, HOUSE.bell, HOUSE.koffie, HOUSE.step, HOUSE.neckRed, HOUSE.spout, HOUSE.bloemen, HOUSE.neck, HOUSE.bellCream];
const AFTER = [HOUSE.stepBrown, HOUSE.boeken, HOUSE.bell];

const decor: DecorDef[] = [
  // --- the quay street (canal and houses in the parallax) ---
  { sprite: 'decor/ams/elm', x: 60, y: G },
  { sprite: 'decor/ams/lamp', x: 150, y: G },
  { sprite: 'decor/ams/tulips', x: 205, y: G, animate: true },
  { sprite: 'decor/ams/bench', x: 250, y: G },
  { sprite: 'decor/ams/bike', frame: 1, x: 296, y: G },
  { sprite: 'decor/ams/flag-ams', x: 410, y: G, animate: true },
  { sprite: 'decor/ams/lamp', x: 470, y: G },
  { sprite: 'decor/ams/elm', x: 620, y: G },
  ...bridgeDecor(A_BRIDGES[0][0], A_BRIDGES[0][1], A_BRIDGES[0][2]),
  { sprite: 'decor/ams/lamp', x: 920, y: G },
  // --- the side canal: the raised drawbridge and two houseboats ---
  { sprite: 'decor/ams/drawbridge', x: 1026, y: G },
  ...waterDecor(A_CANAL[0], A_CANAL[1]),
  ...boatDecor(A_BOATS, ROOF_Y, DECK_Y - ROOF_Y),
  { sprite: 'decor/ams/lamp', x: 1360, y: G },
  { sprite: 'decor/ams/elm', x: 1440, y: G },
  // --- PLEINTJE ---
  { sprite: 'decor/ams/lamp', x: 1540, y: G },
  { sprite: 'decor/ams/tulips', x: 1598, y: G, animate: 12 },
  { sprite: 'decor/ams/bench', x: 1660, y: G },
  { sprite: 'decor/ams/elm', x: 1712, y: G },
  { sprite: 'decor/ams/bench', x: 1770, y: G },
  { sprite: 'decor/ams/flag-nl', x: 1820, y: G, animate: true },
  { sprite: 'decor/ams/lamp', x: 1890, y: G },
  // --- the shopping street ---
  ...houseRow('morning', 1904, STREET),
  ...A_AWNINGS.map(([x, y, w], i): DecorDef => ({ sprite: awningSprite(w), frame: i % 4, x, y })),
  { sprite: awningSprite(A_LEDGES[0][2]), frame: 3, x: A_LEDGES[0][0], y: A_LEDGES[0][1] },
  { sprite: balustradeSprite(A_LEDGES[1][2]), x: A_LEDGES[1][0] + (A_LEDGES[1][2] >> 1) + 1, y: A_LEDGES[1][1] + 3 },
  { sprite: 'decor/ams/tulips', x: 2060, y: G, animate: true },
  { sprite: 'decor/ams/tulips', x: 2400, y: G, animate: 13 },
  ...bridgeDecor(A_BRIDGES[1][0], A_BRIDGES[1][1], A_BRIDGES[1][2]),
  // --- arrival at FABEL FRIET ---
  ...houseRow('morning', A_FABEL_X - rowWidth(ARRIVAL), ARRIVAL),
  { sprite: 'decor/ams/fabel-friet-morning', x: A_FABEL_X + 49, y: G },
  { sprite: 'decor/ams/neighbour-morning', x: A_FABEL_X + 96 + 33, y: G },
  ...houseRow('morning', A_FABEL_X + 96 + 66, AFTER),
  { sprite: 'decor/ams/fabel-sign', x: A_FABEL_X + 86, y: 87, animate: true },
  { sprite: 'decor/ams/flag-ams', x: A_FABEL_X - 30, y: G, animate: 10 },
  { sprite: 'decor/ams/tulips', x: A_FABEL_X - 56, y: G, animate: true },
  { sprite: 'decor/ams/lamp', x: A_ARENA[0] + 10, y: G },
  // --- front decor that half covers the players ---
  { sprite: 'decor/ams/bollard', x: 96, y: G, front: true },
  { sprite: 'decor/ams/bollard', x: 112, y: G, front: true },
  { sprite: 'decor/ams/bollard', x: 128, y: G, front: true },
  { sprite: 'decor/ams/bike-rack', x: 548, y: G, front: true },
  { sprite: 'decor/ams/bollard', x: 690, y: G, front: true },
  { sprite: 'decor/ams/bollard', x: 1350, y: G, front: true },
  { sprite: 'decor/ams/bike-rack', x: 1620, y: G, front: true },
  { sprite: 'decor/ams/bollard', x: 1940, y: G, front: true },
  { sprite: 'decor/ams/bollard', x: 2580, y: G, front: true },
  { sprite: 'decor/ams/bike-rack', x: 2860, y: G, front: true },
  { sprite: 'decor/ams/bollard', x: 3020, y: G, front: true },
  { sprite: 'decor/ams/bollard', x: 3036, y: G, front: true },
  { sprite: 'decor/ams/fabel-counter', x: 3330, y: G, front: true },
  { sprite: 'decor/ams/bollard', x: 3440, y: G, front: true },
];

/**
 * The city life of section a (cosmetic `npc` entities that sleep off-screen, plus the baker in the
 * FABEL FRIET door behind the front-decor counter). Call it at the start of `script`; it returns
 * the baker so the briefing can make him talk (`say`, `talk`, `toss`).
 */
export function life(ctx: SectionContext): { baker: Entity } {
  ctx.spawn('ams-pigeons', 340, G, { count: 5 });
  ctx.spawn('ams-pigeons', 1690, G, { count: 4 });
  // Ducks on the side canal, in the open water between the quay and the first houseboat.
  ctx.spawn('ams-ducks', 1078, WATER_Y, { count: 2, range: 24 });
  ctx.spawn('ams-pigeons', 2470, G, { count: 3 });
  ctx.spawn('ams-window-waver', 2016, 104, {});
  ctx.spawn('ams-window-waver', 2380, 92, { look: 'cat' });
  ctx.spawn('ams-window-waver', 3110, 106, { period: 420 });
  const baker = ctx.spawn('ams-baker', 3330, G, { counter: false, facing: -1 });
  return { baker };
}

/** The briefing lines at FABEL FRIET (docs/design/amsterdam.md §7): hint bubbles, 2 lines each. */
export const BRIEFING: readonly string[] = [
  'HOI! WELKOM BIJ\nFABEL FRIET!',
  'SLECHT NIEUWS, WIJ\nMOETEN MOGELIJK SLUITEN.',
  'BURGEMEESTER HALSEMA\nWIL ONS VOOR ALTIJD...',
  '...WEG HEBBEN!',
  'MAAR DE BUREN ZIJN\nBLIJ MET ONS...',
  'ZE IS BIJ DE STOPERA\nTE VINDEN.',
  'ALSJEBLIEFT,\nSTOP HAAR!',
  'HIER, NEEM EEN\nLEKKER FRIETJE.',
];
/** Ticks a briefing line stays up (auto-advance). */
export const LINE_TICKS = 150;
/** A line cannot be skipped in its first ticks (a held fire button from the fight). */
export const SKIP_AFTER = 20;
/** What the baker tosses at the end: the fries of the road (a flamethrower, homing in on the catcher). */
export const BRIEFING_TOSS = { id: 'pickup-weapon', params: { weapon: 'flamethrower' } } as const;

const viewRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
const LOCKED = 0;
const LEFT = buttonMask('left');
const RIGHT = buttonMask('right');
/** The baker's spot behind the counter; a player closer than `CLEAR_DIST` steps aside first. */
export const COUNTER_X = 3326;
export const CLEAR_DIST = 34;

/**
 * Input lock for a cut-scene: every player gets a private empty `VirtualPad` (re-applied every
 * tick, so a player who joins or continues is locked too); `restore()` gives the real pads back.
 * `fire()` = fire went down on a real pad this tick.
 */
export class InputLock {
  private readonly real = new Map<Player, VirtualPad>();
  private readonly fake = new Map<Player, VirtualPad>();
  private readonly ctx: SectionContext;
  constructor(ctx: SectionContext) {
    this.ctx = ctx;
  }

  /** Call once per tick; `steer` (optional) gives a player's scripted buttons (default none). */
  apply(steer?: (p: Player) => number): void {
    for (const p of this.ctx.players as readonly Player[]) {
      let v = this.fake.get(p);
      if (!v) {
        v = new VirtualPad();
        this.fake.set(p, v);
      }
      if (p.pad !== v) {
        this.real.set(p, p.pad);
        p.pad = v;
      }
      v.update(steer ? steer(p) : LOCKED);
    }
  }

  fire(): boolean {
    for (const pad of this.real.values()) if (pad.pressed('fire')) return true;
    return false;
  }

  restore(): void {
    for (const [p, pad] of this.real) if (p.pad === this.fake.get(p)) p.pad = pad;
    this.real.clear();
    this.fake.clear();
  }
}

/**
 * THE BRIEFING (§7): the timer pauses, the input is locked, the baker talks (8 hint bubbles,
 * auto-advance, fire skips a line) and tosses the fries; then the pads and the timer come back.
 */
/**
 * Before the briefing: a player who rides the beer bike gets off (the baker: `GEEN
 * BIERFIETSEN!`, docs/design/ams-extras.md §2.4); the bike stays parked in section a.
 */
export function* noBeerBikes(ctx: SectionContext, baker: Entity): ScriptGen {
  const riders = ctx.players.filter((p) => p.vehicle instanceof Vehicle && p.vehicle.type === 'beer-bike');
  if (riders.length === 0) return;
  if (baker instanceof AmsBaker) baker.say('GEEN BIERFIETSEN!', 80, 'hint');
  else ctx.hud.bubble(baker, 'GEEN BIERFIETSEN!', { kind: 'hint', ticks: 80, speaker: 'baker' });
  yield 24;
  for (const p of riders) if (p.vehicle instanceof Vehicle) p.vehicle.eject('exit');
  yield 50;
}

export function* briefing(ctx: SectionContext, baker: Entity): ScriptGen {
  eraseEnemyShots(ctx.world, ctx.camera.view(32, viewRect));
  ctx.timer.pause();
  const lock = new InputLock(ctx);
  const person = baker instanceof AmsBaker ? baker : null;
  try {
    lock.apply();
    // Players standing in the counter step aside, then turn to the baker. With two players,
    // player 1 waits left of the counter and player 2 right of it (each catches their own fries).
    let steps = 0;
    const pair = ctx.players.filter((p) => p.alive).length > 1;
    const side = (p: Player): number => (pair ? (p.index === 0 ? -1 : 1) : p.x < COUNTER_X ? -1 : 1);
    const away = (p: Player): number => (side(p) < 0 ? LEFT : RIGHT);
    const toward = (p: Player): number => (side(p) < 0 ? RIGHT : LEFT);
    yield () => {
      steps++;
      let busy = false;
      lock.apply((p) => {
        if (!p.alive || steps > 120) return LOCKED;
        if ((p.x - COUNTER_X) * side(p) < CLEAR_DIST) {
          busy = true;
          return away(p);
        }
        return LOCKED;
      });
      return !busy;
    };
    lock.apply((p) => (p.alive ? toward(p) : LOCKED));
    yield 1;
    lock.apply();
    if (person) {
      person.walkTo(COUNTER_X);
      yield () => {
        lock.apply();
        return person.arrived;
      };
      const p = ctx.world.nearestPlayer(person.x, person.y);
      if (p) person.face(p.x);
    }
    for (let i = 0; i < BRIEFING.length; i++) {
      const text = BRIEFING[i];
      // Voiced by the baker's samples: each line replaces the last one's clip (a skip cuts it short).
      const bubble = person ? person.say(text, LINE_TICKS, 'hint') : ctx.hud.bubble(baker, text, { kind: 'hint', ticks: LINE_TICKS, speaker: 'baker' });
      person?.talk(LINE_TICKS - 10);
      let t = 0;
      yield () => {
        lock.apply();
        t++;
        return t >= LINE_TICKS || (t > SKIP_AFTER && lock.fire());
      };
      bubble.ticks = 0;
    }
    if (person) {
      // One portion per living player, each aimed at its own catcher.
      const living = ctx.players.filter((p) => p.alive);
      const n = Math.max(1, living.length);
      for (let k = 0; k < n; k++) {
        const before = person.tossed;
        const catcher = living[k] ?? null;
        if (catcher) person.face(catcher.x);
        person.toss(BRIEFING_TOSS, catcher);
        let t = 0;
        yield () => {
          lock.apply();
          return person.tossed > before || ++t > 90;
        };
        yield () => {
          lock.apply();
          return person.mode !== 'toss' || ++t > 120;
        };
      }
      person.wave(120);
    }
    // Let the fries land in the catcher's hands.
    let t = 0;
    yield () => {
      lock.apply();
      return ++t >= 90;
    };
  } finally {
    lock.restore();
    ctx.timer.resume();
  }
}

/** Seagull perch on the top of a `decor/ams/lamp` standing on the ground line. */
const LAMP_TOP = G - 70;

/**
 * ams-a: the quay street, bridge 1, the side canal, the PLEINTJE lock, the shopping street with the
 * golden record, bridge 2, the FABEL FRIET lock, the briefing and `exitTo('b')`.
 */
export function* script(ctx: SectionContext): ScriptGen {
  prewarm('npc/ams/', 'decor/ams/', 'enemy/fatbike-youth/', 'enemy/delivery-rider/', 'enemy/seagull/');
  const { baker } = life(ctx);
  carillon(ctx);
  // More life on the quay and in the side canal.
  ctx.spawn('ams-boat-platform', 1090, 172, { range: 222, speed: 0.45, pause: 60 });
  // Secrets (docs/design/ams-extras.md §5): the bike in the elm, the houseboat hatch (a hidden
  // tourist), the crate on a gable's hoist beam.
  placeSecrets(ctx, 'a');
  ctx.spawn('ams-pigeons', 2940, G, { count: 4 });

  // @0: the first weapon, a tourist at the bike rack, a gull asleep on a lamp.
  crate(ctx, 420, 'M');
  hostage(ctx, 'tourist', 'chair', 572, 'auto');
  at(ctx, 'seagull', 470, { perch: true }, LAMP_TOP);
  at(ctx, 'seagull', 600, { gag: 'fries', facing: -1 });

  yield ctx.waitCamera(40);
  fromRight(ctx, 'delivery-rider');
  yield ctx.waitCamera(200);
  fromRight(ctx, 'fatbike-youth');
  yield 70;
  if (normalUp(ctx)) fromRight(ctx, 'delivery-rider');

  // @380: bridge 1: a youth doing laps on the bridge, a rider from behind.
  yield ctx.waitCamera(380);
  at(ctx, 'fatbike-youth', 860, { gag: 'circles', facing: -1 });
  ctx.spawn('ams-bike-rack', 690, 'ground', { contains: 'bombs' });
  yield ctx.waitCamera(520);
  ctx.spawn('delivery-rider', 0, 'ground', { from: 'behind' });
  yield 60;
  ctx.enter('fatbike-youth', 'right', { params: { pair: true } });

  // @760: the side canal: houseboats, the little boat, gulls over the water, a tourist on a deck.
  yield ctx.waitCamera(760);
  at(ctx, 'seagull', 920, { perch: true }, LAMP_TOP);
  hostage(ctx, 'tourist', 'sack', 1256, 'auto', DECK_Y, { band: 30 });
  yield ctx.waitCamera(880);
  ctx.spawn('seagull', 1250, 120, { flock: 2 });
  yield ctx.waitCamera(1000);
  at(ctx, 'seagull', 1360, { perch: true }, LAMP_TOP);
  fromRight(ctx, 'delivery-rider');
  yield 90;
  fromRight(ctx, 'fatbike-youth');

  // @1300 (checkpoint): approach to the PLEINTJE.
  yield ctx.waitCamera(1300);
  ctx.spawn('ams-bike-rack', 1460, 'ground', {});
  crate(ctx, 1500, 'bombs');
  fromRight(ctx, 'delivery-rider');

  // @1520: LOCK — the PLEINTJE: the fatbike gang from both sides, a gull.
  yield ctx.waitCamera(1520);
  ctx.lockCamera(1520, 1904);
  fromRight(ctx, 'fatbike-youth', {}, 16, 'plein');
  yield 50;
  fromLeft(ctx, 'fatbike-youth', {}, 16, 'plein');
  yield 70;
  ctx.enter('seagull', 'top', { x: 1720, tag: 'plein' });
  ctx.enter('fatbike-youth', 'right', { params: { pair: true }, tag: 'plein' });
  yield 90;
  if (normalUp(ctx)) fromLeft(ctx, 'fatbike-youth', { pair: true }, 16, 'plein');
  ctx.spawn('delivery-rider', 0, 'ground', { from: 'behind', tag: 'plein' });
  if (hardOnly(ctx)) fromRight(ctx, 'delivery-rider', {}, 16, 'plein');
  yield ctx.waitClear('plein');
  yield 30;
  ctx.unlockCamera();
  hostage(ctx, 'tourist', 'chair', 1968, 'auto');

  // @1904: the shopping street: riders both ways, a gull flock, stalls to break, awnings up to
  // the golden record on the gable ledge.
  ctx.spawn('ams-tulip-stall', 2160, 'ground', {});
  ctx.spawn('ams-herring-cart', 2470, 'ground', {});
  ctx.spawn('pickup-gem', 2334, 66, { kind: 'golden-record' });
  // Pacing (GDD 1.5): the next rider comes right after the unlock, not 180 px later.
  yield 40;
  fromRight(ctx, 'delivery-rider');
  yield 60;
  ctx.spawn('delivery-rider', 0, 'ground', { from: 'behind' });
  yield ctx.waitCamera(1760);
  fromRight(ctx, 'fatbike-youth');
  yield ctx.waitCamera(1880);
  at(ctx, 'seagull', 2250, { gag: 'fries', facing: -1 });
  ctx.spawn('seagull', 2200, 110, { flock: normalUp(ctx) ? 3 : 2 });
  // @1960: a stag party on foot (docs/design/ams-extras.md §2.4): two clink bottles and one
  // takes a selfie in the street (CAUGHT NAPPING), the groom walks in from the right.
  yield ctx.waitCamera(1960);
  at(ctx, 'stag-partier', 2262, { gag: 'toast', facing: -1, look: 0 }, 'ground', 'stag');
  at(ctx, 'stag-partier', 2246, { gag: 'toast', facing: 1, look: 2 }, 'ground', 'stag');
  at(ctx, 'stag-partier', 2318, { gag: 'selfie', facing: -1, look: 0 }, 'ground', 'stag');
  yield 60;
  ctx.enter('stag-partier', 'right', { margin: 40, params: { groom: true }, tag: 'stag' });
  yield ctx.waitCamera(2080);
  fromRight(ctx, 'delivery-rider');

  // @2120: LOCK — the beer bike rolls in from the right (the first hijack): shoot the riders off
  // and ride it, or blow it up for points.
  yield ctx.waitCamera(A_BIKE_LOCK[0]);
  ctx.lockCamera(A_BIKE_LOCK[0], A_BIKE_LOCK[1]);
  ctx.callout('BIERFIETS!', { ticks: 90 });
  ctx.enter('stag-beer-bike', 'right', { margin: 64, params: { riders: normalUp(ctx) ? 3 : 2, looks: [2, 0, 2] }, tag: 'bike' });
  yield 150;
  ctx.spawn('delivery-rider', 0, 'ground', { from: 'behind', tag: 'bike' });
  yield ctx.waitClear('bike');
  yield 30;
  ctx.unlockCamera();

  // @2500 (checkpoint): bridge 2 and the arrival street.
  yield ctx.waitCamera(2500);
  crate(ctx, 2580, 'S');
  at(ctx, 'fatbike-youth', 2940, { gag: 'circles', facing: -1 });
  at(ctx, 'seagull', 2730, { perch: true }, G - 14 - 70);
  yield ctx.waitCamera(2640);
  fromRight(ctx, 'delivery-rider');
  hostage(ctx, 'tourist', 'sack', 3080, 'auto');
  yield ctx.waitCamera(2780);
  ctx.spawn('seagull', 3000, 112, { flock: 2 });
  yield 80;
  fromRight(ctx, 'fatbike-youth');
  // Pacing: one more rider on the last stretch before the Fabel Friet lock.
  yield ctx.waitCamera(2960);
  fromRight(ctx, 'delivery-rider');
  yield ctx.waitCamera(3060);
  fromRight(ctx, 'fatbike-youth');

  // @3200: LOCK — FABEL FRIET: the last wave, then the briefing.
  yield ctx.waitCamera(A_ARENA[0]);
  ctx.lockCamera(A_ARENA[0], A_ARENA[1]);
  fromRight(ctx, 'fatbike-youth', { pair: true }, 16, 'fabel');
  yield 40;
  fromLeft(ctx, 'fatbike-youth', {}, 16, 'fabel');
  yield 60;
  ctx.spawn('seagull', 3400, 104, { flock: normalUp(ctx) ? 3 : 2, tag: 'fabel' });
  yield 80;
  fromRight(ctx, 'delivery-rider', {}, 16, 'fabel');
  ctx.spawn('delivery-rider', 0, 'ground', { from: 'behind', tag: 'fabel' });
  yield 90;
  fromRight(ctx, 'fatbike-youth', {}, 16, 'fabel');
  if (normalUp(ctx)) fromLeft(ctx, 'fatbike-youth', { pair: true }, 16, 'fabel');
  yield ctx.waitClear('fabel');
  yield ctx.waitClear();
  yield 40;
  yield* noBeerBikes(ctx, baker);
  yield* briefing(ctx, baker);
  yield ctx.exitTo('b');
}

export const sectionA: SectionDef = {
  id: 'a',
  name: 'Grachtengordel',
  width: A_W,
  height: 216,
  scroll: 'right',
  background: BG_MORNING,
  terrain: terrainA(),
  terrainStyle: { ground: 'klinker', edge: 'bikepath', platform: 'wood', solid: 'brick' },
  decor,
  // Tier 4 (UHD verifier): the decor this section draws — its decor list and the breakables / boats
  // its script spawns — joins the 4× working set only here and in the section before it.
  // The stag party and the beer bike (enemy and rideable; docs/api/stag.md §5).
  art: [...new Set(decor.map((d) => d.sprite)), 'decor/ams/ams-bike-rack', 'decor/ams/ams-boat-platform', 'decor/ams/ams-herring-cart', 'decor/ams/ams-tulip-stall', ...secretArt('a'), ...stagArt(STAG_LOOKS, { groom: true, bike: true })],
  playerStart: { x: 48, y: G },
  checkpoints: [1300, 2500],
  timeLimit: 60,
  music: 'ams',
  ambience: 'env/ams-canal',
  exits: [{ id: 'end', rect: { x: A_W - 24, y: 96, w: 24, h: 80 }, to: 'b', disabled: true }],
  script,
};
