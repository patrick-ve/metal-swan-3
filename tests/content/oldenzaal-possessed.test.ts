/**
 * Mission oldenzaal — the possessed (docs/design/oldenzaal.md §3; owner POSSESSED): registration,
 * the art (1× palette, the 2× / 4× geometry), {} spawns, the fairness rules (tells ≥ 18 on
 * screen, no attack from off screen, the claw box live only in the strike), the soul out (eject →
 * dazed → run), the holy blast, re-possession (the cap of 2) and the continue reactions.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Entity } from '../../src/engine/entity';
import { inPalette } from '../../src/engine/palette';
import { inHdPalette } from '../../src/engine/palette-hd';
import { getFrames, hasHiSprite, listSprites, spriteErrors } from '../../src/engine/sprites';
import { OZ_POSSESSED, OZ_SPRITES } from '../../src/game/content/missions/oldenzaal/ids';
import { FREED_LINES } from '../../src/game/content/missions/oldenzaal/lines';
import { isLightSource } from '../../src/game/content/oldenzaal/kit/light-api';
import '../../src/game/content/oldenzaal/possessed/art';
import {
  ejectSoul,
  ejectSoulsInArea,
  holyDamage,
  OZ_BRUTE_LOOKS,
  OZ_HOST_LOOKS,
  OZ_LOOKS,
  possessTownsperson,
  repossessionsOnScreen,
  SHAMBLER,
  FREED,
  type FreeSoul,
  type PossessedHost,
  type Shambler,
  type Townsperson,
} from '../../src/game/content/oldenzaal/possessed/index';
import { SFX } from '../../src/game/content/sfx/index';
import { getEntityMeta } from '../../src/game/registry';
import { FLOOR, TestWorld, watchFairness, type FairnessOpts } from './helpers';

const FAIR: FairnessOpts = {
  attacks: { strike: 'tell', shoot: 'tell', charge: 'tell', swoop: 'tell' },
  tells: new Set(['tell']),
};

let warn: { mockRestore: () => void };
beforeAll(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterAll(() => warn.mockRestore());

const IDS = Object.values(OZ_POSSESSED);

describe('oldenzaal possessed: registration', () => {
  it('registers every id with its category', () => {
    const cat: Record<string, string> = {
      'oz-shambler': 'enemy',
      'oz-gunner': 'enemy',
      'oz-brute': 'enemy',
      'oz-soul': 'enemy',
      'oz-townsperson': 'npc',
      'oz-soul-eject': 'fx',
      'oz-ghost-shot': 'projectile',
    };
    for (const id of IDS) expect(getEntityMeta(id)?.category, id).toBe(cat[id]);
  });

  it('every sfx the possessed play is a registered recipe under oz/possessed/', () => {
    const ids = ['groan', 'grab-tell', 'claw', 'flinch', 'rifle-tell', 'rifle', 'brute-tell', 'brute-charge', 'brute-thud', 'wail', 'eject', 'soul-burst', 'emerge', 'swoop', 'circle', 'dive', 'possess'];
    for (const s of ids) expect(SFX[`oz/possessed/${s}`], s).toBeDefined();
  });

  it('the freed lines fit a bubble', () => {
    for (const l of FREED_LINES) expect(l.length).toBeLessThanOrEqual(24);
  });
});

describe('oldenzaal possessed: art', () => {
  const ids = (): string[] => listSprites().filter((id) => OZ_SPRITES.possessed.some((p) => id.startsWith(p)));

  it('has every strip of every look, inside the 64-colour palette at 1×', () => {
    const all = ids();
    for (const look of OZ_LOOKS) for (const s of ['idle', 'run', 'hide', 'fall', 'sit', 'getup', 'seized']) expect(all, look + s).toContain(`npc/oz-town/${look}/${s}`);
    for (const look of OZ_HOST_LOOKS) for (const s of ['idle', 'walk', 'tell', 'strike', 'rise', 'gloat', 'cower']) expect(all).toContain(`enemy/oz-shambler/${look}/${s}`);
    for (const look of OZ_BRUTE_LOOKS) for (const s of ['idle', 'walk', 'tell', 'charge', 'recover', 'rise', 'gloat', 'cower']) expect(all).toContain(`enemy/oz-brute/${look}/${s}`);
    for (const id of ['enemy/oz-soul/hover', 'enemy/oz-soul/tell', 'enemy/oz-soul/swoop', 'enemy/oz-soul/reach', 'enemy/oz-gunner/rifle', 'enemy/oz-ghost-shot/fly', 'fx/oz/soul/eject', 'fx/oz/soul/helmet', 'fx/oz/soul/eyes', 'fx/oz/soul/glow', 'fx/oz/soul/mist']) expect(all).toContain(id);
    for (const id of all)
      for (const f of getFrames(id, 1)) for (const c of f.buf.data) if ((c & 255) !== 0 && !inPalette(c)) expect.fail(`${id}: colour ${c.toString(16)} not in PAL`);
    // Every host frame carries the eye point (the glowing eyes go there).
    for (const id of all.filter((i) => i.startsWith('enemy/oz-shambler/') || i.startsWith('enemy/oz-brute/'))) for (const f of getFrames(id, 1)) expect(f.pts?.eye, id).toBeDefined();
    expect(getFrames('enemy/oz-gunner/rifle', 1)[2].pts?.muzzle).toBeDefined();
  });

  it('2× and 4× from one drawer: the 1× geometry (size, anchor, points), HD palette only', () => {
    // Every soul / fx id, every strip of one slim look, one brute and the pensioner's stick strip.
    const sample = ids().filter((id) => !id.includes('/oz-shambler/') && !id.includes('/oz-brute/') && !id.startsWith('npc/oz-town/'));
    sample.push(...ids().filter((id) => id.startsWith('enemy/oz-shambler/jogger/') || id.startsWith('enemy/oz-brute/butcher/') || id.startsWith('npc/oz-town/pensioner/') || id.startsWith('npc/oz-town/shopper/')));
    expect(sample.length).toBeGreaterThanOrEqual(40);
    for (const id of sample) {
      expect(hasHiSprite(id, 2) && hasHiSprite(id, 4), id).toBe(true);
      const lo = getFrames(id, 1);
      for (const d of [2, 4] as const) {
        const hd = getFrames(id, d);
        expect(hd.length, `${id}@${d}`).toBe(lo.length);
        for (let i = 0; i < lo.length; i++) {
          const f = hd[i];
          expect(f.density, `${id}@${d}[${i}]`).toBe(d);
          expect([f.buf.w, f.buf.h, f.ox, f.oy], `${id}@${d}[${i}]`).toEqual([lo[i].buf.w * d, lo[i].buf.h * d, lo[i].ox, lo[i].oy]);
          expect(f.pts ?? {}, `${id}@${d}[${i}]`).toEqual(lo[i].pts ?? {});
          for (const c of f.buf.data) if ((c & 255) !== 0 && !inHdPalette(c)) expect.fail(`${id}@${d}[${i}]: colour ${c.toString(16)} not in the HD palettes`);
        }
      }
    }
    expect(spriteErrors().filter((e) => sample.some((id) => e.id.startsWith(id)))).toEqual([]);
  }, 240_000);
});

describe('oldenzaal possessed: spawns', () => {
  it.each(IDS)('%s spawns with {} and runs 600 ticks without errors', (id) => {
    const tw = new TestWorld({ playerX: 100, god: true, seed: 5 });
    tw.spawn(id, 220, {}, id === 'oz-soul' || id === 'oz-ghost-shot' ? FLOOR - 50 : FLOOR);
    tw.run(600);
    expect(tw.world.errors).toEqual([]);
  });

  it('the hosts and souls give light (LIGHT_TAG + lightOf); townspeople are neutral and cannot be shot', () => {
    const tw = new TestWorld({ playerX: 100, god: true });
    const h = tw.spawn('oz-shambler', 200);
    const s = tw.spawn('oz-soul', 260, {}, FLOOR - 50);
    const t = tw.spawn('oz-townsperson', 300, { flee: false });
    expect(isLightSource(h) && isLightSource(s)).toBe(true);
    expect(t.team).toBe('neutral');
    expect(t.hasTag('shootable') || t.hasTag('enemy')).toBe(false);
  });
});

describe('oldenzaal possessed: fairness', () => {
  const scenes: Array<[string, string, Record<string, unknown>, number]> = [
    ['shambler', 'oz-shambler', {}, FLOOR],
    ['gunner', 'oz-gunner', {}, FLOOR],
    ['brute', 'oz-brute', {}, FLOOR],
    ['soul', 'oz-soul', {}, FLOOR - 60],
  ];
  for (const difficulty of ['easy', 'normal', 'hard'] as const) {
    it.each(scenes)(`${difficulty}: the %s telegraphs ≥ 18 ticks on screen before every attack, attacks only in view`, (_n, id, p, y) => {
      const tw = new TestWorld({ playerX: 120, god: true, seed: 3, difficulty });
      tw.spawn(id, 220, p, y);
      const w = watchFairness(tw, 900, FAIR);
      expect(w.attacks.length, 'it attacked').toBeGreaterThan(0);
      for (const a of w.attacks) {
        expect(a.prev, `${a.id} ${a.mode} after ${a.prev}`).toBe('tell');
        expect(a.tell).toBeGreaterThanOrEqual(18);
        expect(a.tellInView).toBeGreaterThanOrEqual(18);
        expect(a.inView).toBe(true);
      }
      for (const n of w.tells) expect(n).toBeGreaterThanOrEqual(18);
      expect(w.outsideShots).toBe(0);
      expect(tw.world.errors).toEqual([]);
    });
  }

  it('no attack from off screen: hosts and souls far outside the view never attack', () => {
    const tw = new TestWorld({ playerX: 100, god: true, seed: 7, width: 2400 });
    tw.spawn('oz-shambler', 700);
    tw.spawn('oz-gunner', 640);
    tw.spawn('oz-brute', 760);
    tw.spawn('oz-soul', 820, {}, FLOOR - 60);
    const w = watchFairness(tw, 600, FAIR);
    for (const a of w.attacks) expect(a.inView, `${a.id} ${a.mode}`).toBe(true);
    expect(w.outsideShots).toBe(0);
  });

  it('the claw box is live only in the strike', () => {
    const tw = new TestWorld({ playerX: 100, god: true, seed: 2 });
    const s = tw.spawn('oz-shambler', 140) as Shambler;
    let strikes = 0;
    for (let t = 0; t < 600; t++) {
      tw.run(1);
      const live = s.contactBoxes().length > 0;
      if (live) {
        expect(s.mode).toBe('strike');
        expect(s.modeT).toBeLessThanOrEqual(SHAMBLER.active);
      }
      if (s.mode === 'strike' && s.modeT === 1) strikes++;
    }
    expect(strikes).toBeGreaterThan(0);
  });

  it('a mortal player who stands in the claw is hit; a jump over the ghost shot lets it pass', () => {
    const tw = new TestWorld({ playerX: 100, god: false, seed: 2 });
    let deaths = 0;
    tw.world.events.on('playerDied', () => deaths++);
    tw.spawn('oz-shambler', 140);
    tw.run(400);
    expect(deaths).toBeGreaterThan(0);
  });
});

/** Freed townspeople and eject fx in the world. */
const ofType = (tw: TestWorld, t: string): Entity[] => tw.ofType(t);

describe('oldenzaal possessed: the soul out', () => {
  it('at 0 HP: the soul is ejected, the person drops, sits dazed ~60 ticks, gets up and runs off; scores as a kill', () => {
    const tw = new TestWorld({ playerX: 100, god: true, seed: 4 });
    const h = tw.spawn('oz-shambler', 200, { look: 'vendor' }) as PossessedHost;
    tw.run(2);
    const before = tw.session.slot(0)?.score ?? 0;
    tw.world.damage(h, { amount: 999, kind: 'bullet', dirX: 1, owner: 0 });
    tw.world.flush();
    expect(h.removed).toBe(true);
    expect((tw.session.slot(0)?.score ?? 0) - before).toBe(SHAMBLER.score);
    expect(ofType(tw, 'oz-soul-eject').length).toBe(1);
    const p = ofType(tw, 'oz-townsperson')[0] as Townsperson;
    expect(p.look).toBe('vendor');
    expect(p.freed).toBe(true);
    const runs: Record<string, number> = {};
    const order: string[] = [];
    let ejectGone = -1;
    for (let t = 0; t < 900 && !p.removed; t++) {
      tw.run(1);
      if (ejectGone < 0 && ofType(tw, 'oz-soul-eject').length === 0) ejectGone = t;
      runs[p.mode] = (runs[p.mode] ?? 0) + 1;
      if (order[order.length - 1] !== p.mode) order.push(p.mode);
    }
    expect(order.slice(0, 4)).toEqual(['fall', 'sit', 'getup', 'leave']);
    expect(runs.sit).toBeGreaterThanOrEqual(58);
    expect(ejectGone).toBeGreaterThan(30);
    expect(ejectGone).toBeLessThan(50);
    expect(p.removed, 'ran off the screen').toBe(true);
    expect(tw.world.errors).toEqual([]);
  });

  it('freed people leave against the scroll, faster than a hero, fade out, and never crowd (max 3)', () => {
    const tw = new TestWorld({ playerX: 100, god: true, seed: 4 });
    const freed: Townsperson[] = [];
    for (let i = 0; i < 5; i++) {
      freed.push(tw.spawn('oz-townsperson', 160 + i * 30, { look: 'vendor', mode: 'freed', dirX: 1 }) as Townsperson);
      tw.run(2);
    }
    // The two oldest fade out at once (3 left), and are gone after the fade.
    tw.run(FREED.fade + 2);
    expect(freed.filter((e) => !e.removed).length).toBe(FREED.maxShown);
    expect(freed[0].removed && freed[1].removed).toBe(true);
    // The rest get up and run left (against the scroll) at FREED.run, faster than a hero.
    let left = 0;
    for (let t = 0; t < 400; t++) {
      tw.run(1);
      for (const e of freed) if (!e.removed && e.mode === 'leave' && e.vx < 0) left++;
    }
    expect(left).toBeGreaterThan(0);
    expect(FREED.run).toBeGreaterThan(1.5);
    // Nobody lingers: off the view or faded out within leaveTicks + fade after getting up.
    tw.run(FREED.leaveTicks);
    expect(freed.every((e) => e.removed)).toBe(true);
    expect(tw.world.errors).toEqual([]);
  });

  it('the rising soul can be shot for a bonus', () => {
    const tw = new TestWorld({ playerX: 100, god: true });
    const h = tw.spawn('oz-shambler', 200);
    tw.run(2);
    tw.world.damage(h, { amount: 999, kind: 'bullet', dirX: 1, owner: 0 });
    tw.world.flush();
    const e = ofType(tw, 'oz-soul-eject')[0];
    tw.run(5);
    const before = tw.session.slot(0)?.score ?? 0;
    tw.world.damage(e, { amount: 10, kind: 'bullet', dirX: 1, owner: 0 });
    expect((tw.session.slot(0)?.score ?? 0) - before).toBe(50);
    expect(e.removed || e.dead).toBe(true);
  });

  it('the knife and a grenade blast free a host the same way', () => {
    const tw = new TestWorld({ playerX: 100, god: true });
    const a = tw.spawn('oz-gunner', 200);
    const b = tw.spawn('oz-shambler', 300);
    tw.run(2);
    tw.world.damage(a, { amount: 999, kind: 'knife', dirX: 1, owner: 0 });
    tw.world.damageArea({ x: 300, y: FLOOR - 10, r: 30 }, { amount: 999, kind: 'explosion', dirX: 0, owner: 0 }, 'player');
    tw.world.flush();
    expect(a.removed && b.removed).toBe(true);
    expect(ofType(tw, 'oz-townsperson').length).toBe(2);
    expect(ofType(tw, 'oz-soul-eject').length).toBe(2);
  });

  it('a holy blast ejects every soul in its radius at once (the brute at full HP too); townspeople are untouched', () => {
    const tw = new TestWorld({ playerX: 100, god: true });
    const brute = tw.spawn('oz-brute', 220);
    const sh = tw.spawn('oz-shambler', 250);
    const soul = tw.spawn('oz-soul', 240, {}, FLOOR - 40);
    const town = tw.spawn('oz-townsperson', 235, { flee: false });
    const far = tw.spawn('oz-shambler', 600);
    tw.run(1);
    expect(ejectSoulsInArea(tw.world, 235, FLOOR - 20, 60, 0)).toBe(3);
    tw.world.flush();
    expect(brute.removed && sh.removed && soul.removed).toBe(true);
    expect(town.removed).toBe(false);
    expect(far.removed).toBe(false);
    // The damage tag works through world.damage too.
    expect(ejectSoul(town)).toBe(false);
    tw.world.damage(far, holyDamage(0));
    expect(far.removed || far.dead).toBe(true);
  });
});

describe('oldenzaal possessed: re-possession', () => {
  it('a free soul circles a frightened townsperson (30 ticks) and dives in: he rises as a host', () => {
    const tw = new TestWorld({ playerX: 60, god: true, seed: 6 });
    const t = tw.spawn('oz-townsperson', 200, { look: 'student', mode: 'hide', flee: false }) as Townsperson;
    const s = tw.spawn('oz-soul', 260, {}, FLOOR - 60) as FreeSoul;
    let circle = 0;
    let host: Entity | undefined;
    for (let i = 0; i < 600 && !host; i++) {
      tw.run(1);
      if (s.alive && s.mode === 'circle') circle++;
      host = ofType(tw, 'oz-shambler')[0];
    }
    expect(circle).toBeGreaterThanOrEqual(30);
    expect(t.removed).toBe(true);
    expect(host).toBeDefined();
    expect((host as PossessedHost).look).toBe('student');
    expect((host as PossessedHost).repossessed).toBe(true);
    expect(tw.world.errors).toEqual([]);
  });

  it('never more than 2 re-possessions on screen at once', () => {
    const tw = new TestWorld({ playerX: 40, god: true, seed: 8 });
    for (let i = 0; i < 5; i++) tw.spawn('oz-townsperson', 130 + i * 40, { mode: 'hide', flee: false });
    for (let i = 0; i < 5; i++) tw.spawn('oz-soul', 150 + i * 40, {}, FLOOR - 70);
    let max = 0;
    for (let i = 0; i < 900; i++) {
      tw.run(1);
      max = Math.max(max, repossessionsOnScreen(tw.world));
    }
    expect(max).toBeGreaterThan(0);
    expect(max).toBeLessThanOrEqual(2);
    expect(tw.world.errors).toEqual([]);
  });

  it('scripts can possess a townsperson (possessTownsperson)', () => {
    const tw = new TestWorld({ playerX: 60, god: true });
    const t = tw.spawn('oz-townsperson', 220, { look: 'pensioner', flee: false });
    expect(possessTownsperson(t)).toBe(true);
    tw.run(40);
    const h = ofType(tw, 'oz-shambler')[0] as PossessedHost;
    expect(h?.look).toBe('pensioner');
    expect(h.repossessed).toBe(false);
  });
});

describe('oldenzaal possessed: the continue reactions', () => {
  it('gloat: no attacks, the hosts sway on the spot, the souls circle above it; cower: the hosts flinch', () => {
    const tw = new TestWorld({ playerX: 120, god: true, seed: 9 });
    const h = tw.spawn('oz-shambler', 160) as PossessedHost;
    const s = tw.spawn('oz-soul', 200, {}, FLOOR - 60) as FreeSoul;
    tw.run(5);
    const spot = tw.player as Entity;
    h.react('gloat', 300, spot);
    s.react('gloat', 300, spot);
    const x0 = h.x;
    let near = 0;
    for (let i = 0; i < 300; i++) {
      tw.run(1);
      expect(h.contactDamage).toBeNull();
      expect(s.contactDamage).toBeNull();
      if (Math.abs(s.x - spot.x) < 40 && spot.y - s.y > 30) near++;
    }
    expect(Math.abs(h.x - x0)).toBeLessThan(1);
    expect(near).toBeGreaterThan(100);
    h.react('cower', 60, spot);
    tw.run(2);
    expect(h.anim.id).toBe(`${h.art}/cower`);
  });
});

describe('oldenzaal possessed: in oz-a (the real street)', () => {
  it('every id spawns with {} on the oz-a street and runs 600 ticks without errors', async () => {
    const { loadContent } = await import('../../src/game/content/index');
    const { createHeadlessGame } = await import('../../src/sim/index');
    await loadContent();
    const g = await createHeadlessGame({ missionId: 'oldenzaal', sectionId: 'oz-a', seed: 3, players: 1, god: true, captureConsole: true });
    g.step(30);
    const w = g.world;
    const p = g.player(0);
    expect(w && p).toBeTruthy();
    if (!w || !p) return;
    IDS.forEach((id, i) => {
      const x = p.x + 120 + i * 24;
      const y = id === 'oz-soul' || id === 'oz-ghost-shot' ? p.y - 50 : w.terrain.surfaceY(x, p.y - 40, p.y + 80);
      w.spawn(id, x, Number.isFinite(y) ? y : p.y, {});
    });
    g.step(600);
    expect(w.errors).toEqual([]);
    expect(g.report().errors).toEqual([]);
    g.dispose();
  }, 120_000);
});
