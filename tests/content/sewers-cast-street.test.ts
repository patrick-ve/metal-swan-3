/**
 * The street cast of mission sewers (docs/design/sewers.md §3; wave P1a STREET): the dealer, the pimp,
 * the bodyguard, the mints gag pickup, the flee from the rats (`streetFlee`, spec §2.2), and the two
 * hostage looks (the sewer worker kind, the banana tourist look). A flat test arena (floor y 176):
 * the tell ticks and sounds, the attacks and their dodges (a crouch under the pimp's chest shots, a
 * step back from the dealer's jab, a jump over the bodyguard's charge), the deaths, the euros, the
 * gloat, and a 1,200-tick god-mode bot run with every kind.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Entity } from '../../src/engine/entity';
import type { Button } from '../../src/engine/input';
import '../../src/game/content/characters/index';
import '../../src/game/content/weapons/index';
import '../../src/game/content/fx/index';
import '../../src/game/content/fx/art';
import '../../src/game/content/items/index';
import '../../src/game/content/items/art';
import { flushAwards, wireBudget } from '../../src/game/budget/pay';
import { EURO_BY_ID, killCents, pointsToCents } from '../../src/game/budget/euro-table';
import { isHostage } from '../../src/game/content/items/hostages';
import { SEWERS_HOSTAGE_WORKER, SEWERS_STREET, isSewersSpriteId } from '../../src/game/content/missions/sewers/ids';
import { SEWERS_VOICE } from '../../src/game/content/samples/sewers';
import {
  BODYGUARD,
  Bodyguard,
  DEALER,
  Dealer,
  NEP,
  PIMP,
  Pimp,
  STREET_TAG,
  StreetPerson,
  WORKER_KIND,
  streetFlee,
} from '../../src/game/content/sewers/street/index';
import { attackTokenLimit, reactInArea, startGloatHold } from '../../src/game/enemy';
import type { Hostage } from '../../src/game/hostage';
import { getEntityMeta } from '../../src/game/registry';
import { hasSprite, listSprites } from '../../src/engine/sprites';
import type { Difficulty } from '../../src/game/session';
import { FLOOR, TestWorld, watchFairness, type FairnessOpts, type TestWorldOptions } from './helpers';

const IDS = [SEWERS_STREET.dealer, SEWERS_STREET.pimp, SEWERS_STREET.bodyguard] as const;
const EURO: Record<string, number> = { 'sewers-dealer': 500, 'sewers-pimp': 1200, 'sewers-bodyguard': 800 };

/** Attack mode → the tell mode right before it. */
const ATTACKS: Record<string, string> = { jab: 'tell', shoot: 'tell', charge: 'tell', whistle: 'tell-whistle' };
const FAIR: FairnessOpts = { attacks: ATTACKS, tells: new Set(['tell', 'tell-whistle']), watched: (e: Entity) => e instanceof StreetPerson };

/** A world with the sfx and the bubbles recorded. */
function arena(o: { god?: boolean; difficulty?: Difficulty; playerX?: number; seed?: number; build?: TestWorldOptions['build'] } = {}) {
  const tw = new TestWorld({ god: o.god ?? true, playerX: o.playerX ?? 100, difficulty: o.difficulty, seed: o.seed ?? 7, build: o.build });
  const sounds: Array<{ id: string; tick: number }> = [];
  vi.spyOn(tw.world.audio, 'sfx').mockImplementation((id: string) => {
    sounds.push({ id, tick: tw.world.tick });
  });
  const said: Array<{ text: string; target: unknown; tick: number }> = [];
  const bubble = tw.hud.bubble.bind(tw.hud);
  vi.spyOn(tw.hud, 'bubble').mockImplementation((target, text, opts) => {
    said.push({ text, target, tick: tw.world.tick });
    return bubble(target, text, opts);
  });
  return { tw, sounds, said };
}

const live = (tw: TestWorld, id: string) => tw.ofType(id).filter((e) => e.alive);

describe('sewers street cast: registration, art and euros', () => {
  it.each(IDS)('%s is a registered enemy with its euro row (spec §3)', (id) => {
    expect(getEntityMeta(id)?.category).toBe('enemy');
    expect(EURO_BY_ID[id]).toBe(EURO[id]);
    expect(killCents(id, 0, false)).toBe(EURO[id]);
  });

  it('the stand-in sprites exist under sewers- ids (the lazy chunk) for every look', () => {
    const ids = listSprites('enemy/sewers-').concat(listSprites('item/sewers-'), listSprites('item/hostage/sewers-'));
    expect(ids.length).toBeGreaterThan(60);
    for (const id of ids) expect(isSewersSpriteId(id), id).toBe(true);
    for (const look of ['a', 'b', 'c']) for (const s of ['idle', 'walk', 'run', 'tell', 'jab', 'lurk', 'die', 'crawl', 'gloat', 'cower']) expect(hasSprite(`enemy/sewers-dealer-${look}/${s}`), `${look} ${s}`).toBe(true);
    for (const look of ['a', 'b']) for (const s of ['tell', 'shoot', 'tell-whistle', 'whistle', 'gloat']) expect(hasSprite(`enemy/sewers-pimp-${look}/${s}`)).toBe(true);
    for (const look of ['a', 'b']) for (const s of ['tell', 'charge', 'stun', 'gloat']) expect(hasSprite(`enemy/sewers-bodyguard-${look}/${s}`)).toBe(true);
    expect(getEntityMeta('sewers-mints')?.category).toBe('item');
    expect(SEWERS_HOSTAGE_WORKER).toBe(WORKER_KIND);
  });

  it('every param value spawns and runs 300 ticks without errors', () => {
    const specs: Array<[string, Record<string, unknown>]> = [
      ['sewers-dealer', { lurk: true }],
      ['sewers-dealer', { enter: 'right', look: 'c' }],
      ['sewers-dealer', { entry: 'left', drop: 'none' }],
      ['sewers-pimp', { whistle: false, look: 'b' }],
      ['sewers-pimp', { hold: 60, facing: -1 }],
      ['sewers-bodyguard', { called: true, enter: 'right', look: 'b' }],
    ];
    for (const [id, p] of specs) {
      const { tw } = arena();
      const e = tw.spawn(id, 260, p);
      expect(e.hasTag('placeholder')).toBe(false);
      tw.run(300);
      expect(tw.world.errors.map((x) => `${id} ${JSON.stringify(p)}: ${x.message}`)).toEqual([]);
    }
  });
});

describe('sewers street cast: tells, sounds and fairness (GDD §4.11)', () => {
  const scenes: Array<{ id: string; x: number; p: Record<string, unknown>; tell: number; sounds: string[] }> = [
    { id: 'sewers-dealer', x: 170, p: { facing: -1 }, tell: DEALER.tele, sounds: ['sewers/knife-jab'] },
    { id: 'sewers-pimp', x: 260, p: { facing: -1 }, tell: PIMP.tele, sounds: ['sewers/whistle', 'enemy/aim', 'sewers/gold-pistol'] },
    { id: 'sewers-bodyguard', x: 200, p: { facing: -1 }, tell: BODYGUARD.tele, sounds: ['sewers/knuckles'] },
  ];
  for (const difficulty of ['normal', 'hard'] as const) {
    it.each(scenes.map((s) => [s.id, s] as const))(`${difficulty}: %s tells ≥ 18 ticks (the spec's on NORMAL) with its sound before every attack, inside the view`, (_n, sc) => {
      const { tw, sounds } = arena({ difficulty });
      tw.spawn(sc.id, sc.x, sc.p);
      const w = watchFairness(tw, 900, FAIR);
      expect(w.attacks.length, 'it attacked').toBeGreaterThan(1);
      for (const a of w.attacks) {
        expect(a.prev, `${a.id} ${a.mode}`).toBe(ATTACKS[a.mode]);
        expect(a.tell, `${a.id} ${a.mode}`).toBeGreaterThanOrEqual(difficulty === 'normal' ? (a.mode === 'whistle' ? PIMP.whistleTele : sc.tell) : 18);
        expect(a.inView).toBe(true);
      }
      expect(w.outsideShots).toBe(0);
      expect(w.maxTokens).toBeLessThanOrEqual(attackTokenLimit(tw.world));
      for (const s of sc.sounds) expect(sounds.some((x) => x.id === s), s).toBe(true);
      expect(tw.world.errors).toEqual([]);
    });
  }

  it('the pimp whistles once (JONGENS!): one bodyguard walks in from the nearer screen edge', () => {
    const { tw, said } = arena();
    const pimp = tw.spawn('sewers-pimp', 300, { facing: -1 }) as Pimp;
    tw.until(() => pimp.mode === 'whistle', 300);
    tw.run(1);
    expect(said.some((s) => s.text === SEWERS_VOICE.pimp.boys && s.target === pimp)).toBe(true);
    const bgs = tw.ofType('sewers-bodyguard');
    expect(bgs.length).toBe(1);
    // The pimp stands nearer the right edge of the view: the bodyguard comes from there, outside the view.
    expect(bgs[0].x).toBeGreaterThan(tw.world.camera.right);
    expect(bgs[0].facing).toBe(-1);
    tw.run(800);
    expect(tw.ofType('sewers-bodyguard').length, 'once per pimp').toBe(1);
    expect(said.some((s) => s.text === SEWERS_VOICE.pimp.street)).toBe(true);
  });

  it('the dealer whispers PSST. VRIEND. and WIL JE IETS? at the tell', () => {
    const { tw, said } = arena();
    const d = tw.spawn('sewers-dealer', 200, { facing: -1 }) as Dealer;
    tw.until(() => d.mode === 'tell', 300);
    expect(said.map((s) => s.text)).toEqual(expect.arrayContaining([SEWERS_VOICE.dealer.psst, SEWERS_VOICE.dealer.offer]));
  });

  it('a lurking dealer waits, steps out when a hero comes near, and is CAUGHT NAPPING when shot first', () => {
    const { tw } = arena({ playerX: 40 });
    const d = tw.spawn('sewers-dealer', 300, { lurk: true }) as Dealer;
    tw.run(60);
    expect(d.mode).toBe('lurk');
    expect(d.vx).toBe(0);
    tw.hold('right').until(() => d.mode !== 'lurk', 300);
    expect(d.mode).toBe('step');
    expect(Math.abs(tw.player!.x - d.x)).toBeLessThanOrEqual(DEALER.notice);
    const { tw: tw2 } = arena();
    const d2 = tw2.spawn('sewers-dealer', 200, { lurk: true }) as Dealer;
    const before = tw2.session.slots[0].score;
    tw2.world.damage(d2, { amount: 99, kind: 'bullet', dirX: 1, owner: 0 });
    expect(tw2.session.slots[0].score - before).toBe(DEALER.score + 100);
  });
});

describe('sewers street cast: the attacks and their dodges (mortal hero)', () => {
  it("the pimp's three shots fly at chest height, 10 ticks apart: they kill a standing hero, a crouch dodges them", () => {
    for (const crouch of [false, true]) {
      const { tw, sounds } = arena({ god: false });
      const pimp = tw.spawn('sewers-pimp', 230, { facing: -1, whistle: false }) as Pimp;
      if (crouch) tw.hold('down');
      const heights = new Set<number>();
      for (let t = 0; t < 500 && tw.player!.alive; t++) {
        tw.run(1);
        // Projectiles are pooled: read the height of every live pimp shot each tick.
        for (const e of tw.world.entities) if (e.type === 'sewers-pimp-shot' && e.alive) heights.add(FLOOR - e.y);
      }
      const shots = sounds.filter((x) => x.id === 'sewers/gold-pistol').map((x) => x.tick);
      expect(shots.length).toBeGreaterThanOrEqual(crouch ? 6 : 1);
      expect([...heights]).toEqual([PIMP.chestY]);
      if (crouch) {
        expect(tw.player!.alive, 'the crouch dodges every shot').toBe(true);
        expect(shots[1] - shots[0]).toBe(PIMP.gap);
        expect(shots[2] - shots[1]).toBe(PIMP.gap);
      } else expect(tw.player!.alive, 'a standing hero is hit').toBe(false);
      expect(pimp.alive).toBe(true);
    }
  });

  it("the dealer's jab kills a hero who stays; a step back during the tell dodges it, then he backs off 48 px", () => {
    const stay = arena({ god: false });
    const d1 = stay.tw.spawn('sewers-dealer', 170, { facing: -1 }) as Dealer;
    stay.tw.until(() => d1.mode === 'jab', 300);
    stay.tw.run(DEALER.jab + 1);
    expect(stay.tw.player!.alive).toBe(false);

    const back = arena({ god: false });
    const d2 = back.tw.spawn('sewers-dealer', 170, { facing: -1 }) as Dealer;
    back.tw.until(() => d2.mode === 'tell', 300);
    back.tw.hold('left').run(DEALER.tele);
    back.tw.hold();
    back.tw.until(() => d2.mode === 'back', 120);
    const x0 = d2.x;
    expect(back.tw.player!.alive).toBe(true);
    back.tw.until(() => d2.mode === 'sidle', 120);
    expect(Math.abs(d2.x - x0)).toBeGreaterThanOrEqual(DEALER.back - 2);
  });

  it("the bodyguard's charge kills a hero who stays; a jump over it dodges it; a whiff into a wall stuns him 40 ticks", () => {
    const stay = arena({ god: false });
    const b1 = stay.tw.spawn('sewers-bodyguard', 200, { facing: -1 }) as Bodyguard;
    stay.tw.until(() => b1.mode === 'charge', 400);
    stay.tw.run(40);
    expect(stay.tw.player!.alive).toBe(false);

    const jump = arena({ god: false });
    const b2 = jump.tw.spawn('sewers-bodyguard', 200, { facing: -1 }) as Bodyguard;
    const p = jump.tw.player!;
    jump.tw.until(() => b2.mode === 'charge' && p.x - b2.x <= 54, 400);
    jump.tw.hold('jump').run(2);
    jump.tw.hold().run(60);
    expect(p.alive, 'jumped over the charge').toBe(true);
    expect(b2.x).toBeLessThan(p.x + 40);

    const wall = arena({ build: (t: Parameters<NonNullable<TestWorldOptions['build']>>[0]) => t.solid(40, 120, 16, 56) });
    const b3 = wall.tw.spawn('sewers-bodyguard', 150, { facing: -1 }) as Bodyguard;
    wall.tw.until(() => b3.mode === 'stun', 400);
    const t0 = wall.tw.world.tick;
    wall.tw.until(() => b3.mode !== 'stun', 120);
    expect(wall.tw.world.tick - t0).toBe(BODYGUARD.stun);
  });
});

describe('sewers street cast: deaths, drops and euros', () => {
  it('each defeat pays its row in a euro play; the person swoons, crawls off and is gone; no blood', () => {
    for (const id of IDS) {
      const { tw, sounds } = arena();
      tw.session.setEconomy('euro');
      wireBudget(tw.world);
      const e = tw.spawn(id, 260, { facing: -1, whistle: false });
      tw.run(5);
      const c0 = tw.session.slots[0].cents;
      tw.world.damage(e, { amount: 999, kind: 'bullet', dirX: 1, owner: 0 });
      flushAwards(tw.world);
      expect(tw.session.slots[0].cents - c0, id).toBe(EURO[id]);
      expect((e as StreetPerson).playing('die')).toBe(true);
      expect(sounds.some((s) => s.id === 'enemy/die')).toBe(true);
      tw.until(() => (e as StreetPerson).playing('crawl'), 120);
      const x0 = e.x;
      tw.until(() => e.removed, 200);
      expect(e.x).not.toBe(x0);
      expect(tw.world.errors).toEqual([]);
    }
  });

  it('the pimp loses his hat and the bodyguard his sunglasses in the swoon', () => {
    for (const [id, prop] of [['sewers-pimp', 'enemy/sewers-pimp/hat'], ['sewers-bodyguard', 'enemy/sewers-bodyguard/shades']] as const) {
      const { tw } = arena();
      const e = tw.spawn(id, 260, { facing: -1, look: 'a', whistle: false });
      tw.world.damage(e, { amount: 999, kind: 'bullet', dirX: 1, owner: 0 });
      tw.run(1);
      expect(tw.world.entities.some((x) => (x as Entity & { sprite?: string }).sprite === prop || (x as Entity & { anim?: { id?: string } }).anim?.id === prop), id).toBe(true);
    }
  });

  it('the dealer drops a bag of mints: NEP! and € 0,50 for the hero who takes it', () => {
    const { tw, said } = arena();
    tw.session.setEconomy('euro');
    wireBudget(tw.world);
    const d = tw.spawn('sewers-dealer', 160, { facing: -1 });
    tw.world.damage(d, { amount: 999, kind: 'bullet', dirX: 1, owner: 0 });
    flushAwards(tw.world);
    tw.run(1);
    const mints = tw.ofType('sewers-mints');
    expect(mints.length).toBe(1);
    const c0 = tw.session.slots[0].cents;
    tw.hold('right').until(() => mints[0].removed, 200);
    tw.hold().run(1);
    flushAwards(tw.world);
    expect(tw.session.slots[0].cents - c0).toBe(50);
    expect(pointsToCents(25)).toBe(50);
    expect(said.some((s) => s.text === NEP && s.target === tw.player)).toBe(true);
  });
});

describe('sewers street cast: the flee from the rats (spec §2.2)', () => {
  it('streetFlee: every living street person screams, runs off the nearer edge, untargetable, harmless, no score, gone', () => {
    const { tw, said } = arena({ playerX: 200 });
    tw.session.setEconomy('euro');
    wireBudget(tw.world);
    const people = [
      tw.spawn('sewers-dealer', 60, { facing: 1 }),
      tw.spawn('sewers-pimp', 330, { facing: -1, whistle: false }),
      tw.spawn('sewers-bodyguard', 300, { facing: -1 }),
      tw.spawn('sewers-dealer', 250, { facing: -1, drop: 'none' }),
    ] as StreetPerson[];
    tw.run(40);
    const dead = people[3];
    tw.world.damage(dead, { amount: 999, kind: 'bullet', dirX: 1, owner: 0 });
    flushAwards(tw.world);
    const score0 = tw.session.slots[0].score;
    const cents0 = tw.session.slots[0].cents;
    let killed = 0;
    tw.world.events.on('enemyKilled', () => killed++);
    expect(streetFlee(tw.world)).toBe(3);
    expect(streetFlee(tw.world), 'once').toBe(0);
    const cam = tw.world.camera;
    for (const e of people.slice(0, 3)) {
      expect(e.fleeing).toBe(true);
      expect(e.hasTag('shootable') || e.hasTag('enemy') || e.hasTag('soft')).toBe(false);
      expect(e.team).toBe('neutral');
      expect(e.contactDamage).toBeNull();
      expect(e.facing).toBe(e.x - cam.left <= cam.right - e.x ? -1 : 1);
      expect(said.some((s) => s.target === e && s.tick === tw.world.tick)).toBe(true);
    }
    expect(tw.world.byTag(STREET_TAG).filter((e) => e.alive && !(e as StreetPerson).fleeing)).toEqual([]);
    // The hero fires at them all the way: nothing hits, no shot of theirs, no score, no euro.
    let shots = 0;
    for (let t = 0; t < 240; t++) {
      tw.hold(...((t % 2 === 0 ? ['fire'] : []) as Button[]), t < 120 ? 'left' : 'right');
      tw.run(1);
      for (const e of tw.world.entities) if (e.team === 'enemy' && e.hasTag('shot')) shots++;
    }
    flushAwards(tw.world);
    expect(shots).toBe(0);
    expect(killed).toBe(0);
    expect(tw.session.slots[0].score).toBe(score0);
    expect(tw.session.slots[0].cents).toBe(cents0);
    for (const e of people.slice(0, 3)) expect(e.removed).toBe(true);
    expect(tw.world.errors).toEqual([]);
  });
});

describe('sewers street cast: the gloat', () => {
  it('every player out: each goes about his business (its gloat strip), no attacks, no shots', () => {
    const { tw } = arena();
    const people = [tw.spawn('sewers-dealer', 170, { facing: -1 }), tw.spawn('sewers-pimp', 260, { facing: -1 }), tw.spawn('sewers-bodyguard', 220, { facing: -1 })] as StreetPerson[];
    tw.run(10);
    startGloatHold(tw.world);
    expect(reactInArea(tw.world, tw.world.camera.view(), 'gloat', 400, { source: tw.player })).toBe(3);
    for (let t = 0; t < 300; t++) {
      tw.run(1);
      for (const e of people) {
        expect(e.contactDamage).toBeNull();
        expect(e.playing('gloat'), `${e.type} ${t}`).toBe(true);
      }
      expect(tw.world.entities.some((e) => e.team === 'enemy' && e.hasTag('shot'))).toBe(false);
    }
  });
});

describe('sewers street cast: a 1,200-tick god-mode bot run', () => {
  it('every kind tells, attacks and dies; the whistle brings a bodyguard; the euros add up; no errors', () => {
    const { tw, sounds } = arena({ playerX: 120, seed: 3 });
    tw.session.setEconomy('euro');
    wireBudget(tw.world);
    tw.spawn('sewers-dealer', 300, { lurk: true });
    tw.spawn('sewers-pimp', 360, { facing: -1 });
    tw.spawn('sewers-dealer', 16, { enter: 'left' });
    const kills: string[] = [];
    tw.world.events.on('enemyKilled', (e) => kills.push(e.enemy.type));
    const c0 = tw.session.slots[0].cents;
    const p = tw.player!;
    const modes = new Set<string>();
    const told = new Set<Entity>();
    for (let t = 0; t < 1200; t++) {
      // The bot: it lets every attack come once (it shoots a person only after his first attack),
      // faces the nearest such person, fires every other tick, crouches under a pimp shot.
      for (const e of tw.world.byTag(STREET_TAG)) if (e.alive && ['recover', 'back', 'stun'].includes((e as StreetPerson).mode)) told.add(e);
      let best: Entity | null = null;
      for (const e of told) if (e.alive && (!best || Math.abs(e.x - p.x) < Math.abs(best.x - p.x))) best = e;
      const buttons: Button[] = [];
      if (best && Math.sign(best.x - p.x) !== p.facing && Math.abs(best.x - p.x) > 4) buttons.push(best.x < p.x ? 'left' : 'right');
      else if (!best && t < 200) buttons.push('right');
      if (best && t % 2 === 0) buttons.push('fire');
      if (tw.world.entities.some((e) => e.type === 'sewers-pimp-shot' && e.alive && Math.abs(e.x - p.x) < 50)) buttons.push('down');
      tw.hold(...buttons).run(1);
      for (const e of tw.world.byTag(STREET_TAG)) modes.add(`${e.type}:${(e as StreetPerson).mode}`);
    }
    flushAwards(tw.world);
    for (const m of ['sewers-dealer:tell', 'sewers-dealer:jab', 'sewers-pimp:tell-whistle', 'sewers-pimp:shoot', 'sewers-bodyguard:tell', 'sewers-bodyguard:charge']) expect(modes.has(m), `${m} in ${[...modes].join(' ')}`).toBe(true);
    expect(kills.sort()).toEqual(['sewers-bodyguard', 'sewers-dealer', 'sewers-dealer', 'sewers-pimp']);
    expect(live(tw, 'sewers-dealer').length + live(tw, 'sewers-pimp').length + live(tw, 'sewers-bodyguard').length).toBe(0);
    for (const s of ['sewers/whistle', 'sewers/knife-jab']) expect(sounds.some((x) => x.id === s), s).toBe(true);
    // Kills pay their rows (the mints are left lying: the bot never walks to them all).
    expect(tw.session.slots[0].cents - c0).toBeGreaterThanOrEqual(2 * 500 + 1200 + 800);
    expect(tw.world.errors).toEqual([]);
  });
});

describe('sewers hostages: the sewer worker and the banana tourist (spec §3)', () => {
  function rescue(params: Record<string, unknown>, free: (tw: TestWorld, h: Hostage) => void) {
    const { tw, said, sounds } = arena();
    const gifts: string[] = [];
    tw.world.events.on('hostageGift', (e) => gifts.push(e.item?.type ?? 'none'));
    const h = tw.spawn('hostage', 150, params) as Hostage;
    tw.run(2);
    free(tw, h);
    tw.hold().until(() => h.state === 'bow', 600);
    return { tw, said, h, gifts, sounds };
  }

  it('the worker (bind sack, c): freed by a touch, his two lines, the drop, the bow', () => {
    const { tw, said, h, gifts } = rescue({ kind: WORKER_KIND, bind: 'sack', drop: 'pickup-food' }, (tw, hh) => tw.hold('right').until(() => hh.state !== 'tied', 200));
    expect(h.art).toBe('item/hostage/sewers-worker');
    expect(isHostage(h, WORKER_KIND)).toBe(true);
    expect(isHostage(h, 'critic')).toBe(false);
    const lines = said.filter((s) => s.target === h).map((s) => s.text);
    expect(lines).toEqual(expect.arrayContaining([SEWERS_VOICE.worker.light, SEWERS_VOICE.worker.battery]));
    expect(lines.indexOf(SEWERS_VOICE.worker.light)).toBeLessThan(lines.indexOf(SEWERS_VOICE.worker.battery));
    expect(gifts).toEqual(['pickup-food']);
    expect(h.rescued).toBe(true);
    expect(tw.world.errors).toEqual([]);
  });

  it('the worker (bind float, d): his lines from the `lines` param', () => {
    const { said, h } = rescue({ kind: WORKER_KIND, bind: 'float', lines: [SEWERS_VOICE.worker.plugs, SEWERS_VOICE.worker.fire], drop: 'pickup-food' }, (_tw, hh) => hh.free(0));
    const lines = said.filter((s) => s.target === h).map((s) => s.text);
    expect(lines).toEqual(expect.arrayContaining([SEWERS_VOICE.worker.plugs, SEWERS_VOICE.worker.fire]));
    expect(lines).not.toContain(SEWERS_VOICE.worker.light);
  });

  it('the banana tourist (look banana, chair): his art, DANK JE, MAN!, the photo flash and the drop; the plain tourist is unchanged', () => {
    const banana = rescue({ kind: 'tourist', look: 'banana', bind: 'chair', drop: 'pickup-food' }, (_tw, hh) => hh.free(0));
    expect(banana.h.art).toBe('item/hostage/sewers-banana');
    expect(banana.h.kind?.id).toBe('tourist');
    expect(banana.said.some((s) => s.target === banana.h && s.text === SEWERS_VOICE.tourist.thanks)).toBe(true);
    expect(banana.said.some((s) => s.text === 'SAY CHEESE!')).toBe(false);
    expect(banana.gifts).toEqual(['pickup-food']);
    expect(banana.sounds.some((x) => x.id === 'hostage/camera'), 'the photo flash').toBe(true);

    const plain = rescue({ kind: 'tourist', bind: 'chair', drop: 'pickup-food' }, (_tw, hh) => hh.free(0));
    expect(plain.h.art).toBe('item/hostage/tourist');
    expect(plain.said.some((s) => s.target === plain.h && s.text === 'SAY CHEESE!')).toBe(true);
    expect(plain.h.params.gagLine).toBeUndefined();
  });
});
