/**
 * sewers-end — DAGERAAD, 07:15 (docs/design/sewers.md §2.6, §0 row 56): script only, one screen
 * (384 px), no enemies, no timer. A quiet street far from the centre at dawn after the rain; the
 * manhole lid lifts, the slimed heroes climb out one by one; the squad's white ROZZERS wagon (the
 * ring's estate, its art reused) drives in from the right, makes a handbrake turn and stops at the
 * kerb; at the wheel a squad hero who does not play: `STAP IN, ZWAAN!` (a text bubble), then the
 * living P1 hero (Vincent first): `IK RUIK NAAR RIOOL.`; the heroes hop in (at most 7 s, as ams's c2
 * boarding); the wagon drives off to the right and `missionComplete()` follows when it has gone (→
 * the tally → the MISSION 3 card). About 460 ticks. 2P: one wagon takes both heroes.
 *
 * The song: the section keeps `sewers-boss` (its outro is an audio-wave item: the synth song has no
 * outro part); it fades out as the wagon leaves.
 */
import type { ScriptGen } from '../../../../engine/script';
import { hasCharacter } from '../../../registry';
import type { SectionContext, SectionDef } from '../../../mission/index';
import type { Player } from '../../../player/player';
import { ROSTER } from '../../../scenes/flow-data';
import { ID } from '../../ring/wagon/geometry';
import { SEWERS_VOICE, sewersSayTicks } from '../../samples/sewers';
import { sewersCanal } from './canal/index';
import { SEWERS_SLIMED, SewersManhole, SewersWagon } from './e-kit';
import { placeBanner, VIEW_W } from './helpers';
import { SEWERS_E_IDS, SEWERS_SECTION, SEWERS_SONG } from './ids';
import { GREY_DAWN, GREY_STREET } from './placeholder';
import { flatTerrain, G, SEWERS_END } from './terrain';

/** The beats of the dawn (ticks; *start*). */
export const END_BEATS = {
  /** After the banner: the lid lifts. */
  lid: 40,
  /** Between two heroes climbing out. */
  climb: 36,
  /** The shake-off before the wagon comes. */
  shake: 30,
  /** Boarding: at most 7 s (as ams c2); the wagon waits at least `minWait` for the lines. */
  board: 420,
  minWait: 230,
  /** The driver's bubble (text only), and the hero's line after it (the two never overlap). */
  getIn: 100,
  smell: 104,
} as const;

/** The voice of the hero's line (text only: the heroes are never voiced). */
const HERO = 'hero';

/** Vincent if he is in the game and not out, else the first hero who is. */
function speakingHero(ctx: SectionContext): Player | null {
  let first: Player | null = null;
  for (const p of ctx.players) {
    if (p.state === 'out' || p.state === 'dead') continue;
    if (p.character.id === 'vincent') return p;
    first ??= p;
  }
  return first;
}

/**
 * The hero at the wheel (spec §0 row 56, as the ring's row 9): a squad hero nobody plays (in 2P
 * neither player), picked from the free ones by a fork of the gameplay rng (the rng does not advance).
 * Null when all five play (never with two players).
 */
export function wagonDriver(ctx: Pick<SectionContext, 'session' | 'rng'>): string | null {
  const playing = ctx.session.slots.filter((s) => s.joined).map((s) => s.character);
  const free = ROSTER.filter((id) => !playing.includes(id) && hasCharacter(id));
  return free.length > 0 ? ctx.rng.fork('sewers-wagon-driver').pick(free) : null;
}

export function* scriptEnd(ctx: SectionContext): ScriptGen {
  placeBanner(ctx, SEWERS_SECTION.end);
  const hole = ctx.spawn(SEWERS_E_IDS.manhole, SEWERS_END.manholeX, G, {}) as SewersManhole;
  // Every hero waits under the lid (hidden), then climbs out, slimed.
  for (const p of ctx.players) if (p.state === 'play') hole.mount(p);
  yield END_BEATS.lid;
  hole.open();
  yield 20;
  while (hole.inside.length > 0) {
    const p = hole.inside[0];
    hole.release(p);
    p.status.add(SEWERS_SLIMED);
    yield END_BEATS.climb;
  }
  yield END_BEATS.shake;
  // The white wagon comes, a hero who does not play at the wheel.
  const wagon = ctx.spawn(SEWERS_E_IDS.wagon, ctx.camera.left + VIEW_W + 70, G, { stopX: SEWERS_END.wagonX, driver: wagonDriver(ctx) }) as SewersWagon;
  ctx.world.audio.sfx('sewers/taxi');
  yield () => wagon.arrived;
  wagon.open = true;
  const lines = wagonLines(ctx, wagon);
  // All aboard: every hero in play gets in at the door; at most 7 s, then the rest are put in.
  let n = 0;
  yield () => {
    lines.next();
    for (const p of ctx.players) if (wagon.touches(p)) wagon.board(p);
    n++;
    if (n >= END_BEATS.board) return true;
    if (n < END_BEATS.minWait) return false;
    for (const p of ctx.players) if (p.state === 'play') return false;
    return true;
  };
  for (const p of ctx.players) if (p.state === 'play') wagon.board(p);
  // The last hop lands, then it drives off.
  yield () => wagon.seated;
  wagon.leave();
  ctx.music(null, 90);
  yield () => wagon.gone;
  yield ctx.missionComplete();
}

/** The lines at the wagon, one step per tick: the driver (text only), then the hero (text only). */
function* wagonLines(ctx: SectionContext, wagon: SewersWagon): Generator<void, void, void> {
  const get = SEWERS_VOICE.hero.getIn;
  const ticks = END_BEATS.getIn;
  if (wagon.driver) {
    ctx.hud.bubble(wagon, get, { ticks, kind: 'gag', speaker: wagon.driver, voice: false, tip: wagon.bubbleTip() });
    wagon.talk(ticks);
  }
  for (let t = 0; t < END_BEATS.smell; t++) yield;
  const hero = speakingHero(ctx);
  const smell = SEWERS_VOICE.hero.smell;
  if (hero) ctx.hud.bubble(hero, smell, { ticks: sewersSayTicks(smell), kind: 'gag', speaker: HERO, voice: false });
}

/** The wagon's art for the tier-4 working set (the ring's white wagon, the drivers' strips). */
const WAGON_ART: readonly string[] = [
  ID.white.body[0],
  ID.white.left,
  ID.white.spin[0],
  ID.cabin,
  ID.white.wheel,
  ...ROSTER.flatMap((id) => [`char/${id}/ride-sit`, `char/${id}/ride-hold`]),
];

export const sectionEnd: SectionDef = {
  id: SEWERS_SECTION.end,
  name: 'Dageraad',
  width: SEWERS_END.w,
  height: 216,
  scroll: 'right',
  background: GREY_DAWN,
  terrain: flatTerrain(SEWERS_SECTION.end),
  terrainStyle: GREY_STREET,
  // Phase 6 (wave P6b E): the kit's dawn street; the manhole (hole, lid) is a canal sprite. The
  // grey dawn and street stay for `?canal=0`. The wagon is the ring's art (wave P6c, spec §0 row
  // 56): its white strips, the cabin, the wheel covers and the drivers' ride strips (any hero
  // nobody plays may drive).
  canal: sewersCanal(SEWERS_SECTION.end),
  art: ['prop/sewers-manhole/', ...WAGON_ART],
  playerStart: { x: SEWERS_END.manholeX, y: G },
  timeLimit: 0,
  music: SEWERS_SONG.boss,
  script: scriptEnd,
};
