/**
 * The euro budget's pay path in a world (docs/design/oat.md §7.1–§7.5, §6.2): the legacy sources
 * converted at their events, the pop-ups (HUD records, never entities), the BOETE fine, the
 * toeristenbelasting, the courtage, the extends, the HUD line, and the runner's hooks (the
 * economy per mission, the continue's tax, the MATCHA-MOMENT's slow world).
 */
import { describe, expect, it } from 'vitest';
import { NullAudio } from '../../../src/engine/audio';
import type { Entity } from '../../../src/engine/entity';
import { VirtualPad } from '../../../src/engine/input';
import { terrain } from '../../../src/engine/terrain';
import { budgetLine, ROLL_TICKS } from '../../../src/game/budget/display';
import { chargeTouristTax, courtagePile, endCourtage, flushAwards, pay, startCourtage, wireBudget } from '../../../src/game/budget/pay';
import { slowWorld, slowWorldLeft } from '../../../src/game/budget/slow';
import { EXTEND_CENTS } from '../../../src/game/budget/types';
import { awardScore } from '../../../src/game/events';
import { MissionRunner, type MissionDef } from '../../../src/game/mission/index';
import { GameSession } from '../../../src/game/session';
import { FLOOR, Rig } from '../helpers';

/** A rig in a euro play (the runner normally sets the economy and wires the world). */
function euroRig(players: 1 | 2 = 1): Rig {
  const rig = new Rig({ players });
  rig.session.setEconomy('euro');
  wireBudget(rig.world);
  return rig;
}

function kill(rig: Rig, e: Entity, kind: 'bullet' | 'knife' = 'bullet', owner = 0): void {
  rig.world.damage(e, { amount: 999, kind, dirX: 1, owner });
  flushAwards(rig.world);
}

describe('budget: the pay path', () => {
  it('does nothing in a point play: the points count, the budget stays € 100,00', () => {
    const rig = new Rig();
    wireBudget(rig.world);
    kill(rig, rig.dummy(300));
    pay(rig.world, 0, 500, 0, 0, 'deposit');
    const s = rig.session.slots[0];
    expect(s.score).toBe(100);
    expect(s.cents).toBe(10000);
    expect(rig.hud.popups.map((p) => p.text)).toEqual([]);
  });

  it('a kill pays its euros (legacy ÷ 50) and the points still count', () => {
    const rig = euroRig();
    kill(rig, rig.dummy(300));
    const s = rig.session.slots[0];
    expect(s.score).toBe(100);
    expect(s.cents).toBe(10200);
    expect(s.ledger.tally('enemy')).toEqual({ count: 1, cents: 200 });
    // The pop-up is a HUD record with the euros (never an entity, never the points).
    expect(rig.hud.popups.map((p) => p.text)).toEqual(['+€2']);
  });

  it('a knife kill of a soft enemy pays ×2 (CONTANT), not the old ×5', () => {
    const rig = euroRig();
    kill(rig, rig.dummy(300), 'knife');
    const s = rig.session.slots[0];
    expect(s.score).toBe(500);
    expect(s.ledger.tally('cash')).toEqual({ count: 1, cents: 400 });
  });

  it('an award nobody claims pays by the legacy rule at the end of the tick (OVERIG)', () => {
    const rig = euroRig();
    awardScore(rig.world, 0, 1000, 100, 100);
    expect(rig.session.slots[0].cents).toBe(10000);
    flushAwards(rig.world);
    expect(rig.session.slots[0].cents).toBe(12000);
    expect(rig.session.slots[0].ledger.tally('other').cents).toBe(2000);
  });

  it('merges the pop-ups of one player within 30 ticks (+€0,45) and splits signs and players', () => {
    const rig = euroRig(2);
    for (let i = 0; i < 3; i++) pay(rig.world, 0, 15, 200 + i * 4, 150, 'deposit');
    expect(rig.hud.popups.map((p) => p.text)).toEqual(['+€0,45']);
    pay(rig.world, 1, 15, 200, 150, 'deposit');
    pay(rig.world, 0, -9500, 200, 150, 'boete');
    expect(rig.hud.popups.map((p) => p.text)).toEqual(['+€0,45', '+€0,15', '-€95']);
    rig.run(31);
    pay(rig.world, 0, 15, 200, 150, 'deposit');
    expect(rig.hud.popups.at(-1)?.text).toBe('+€0,15');
    // No entity was made for any of them.
    expect(rig.world.entities.filter((e) => !e.hasTag('player')).length).toBe(0);
  });

  it('a death by a BOETE ticket costs € 95,00 (BOETE) and in oat-d € 100,00 (BLOWVERBOD)', () => {
    for (const [section, cents, cat] of [
      ['a', 9500, 'boete'],
      ['oat-d', 10000, 'blowverbod'],
    ] as const) {
      const rig = euroRig();
      rig.session.sectionId = section;
      const ticket = { type: 'boete-ticket' } as Entity;
      rig.p.invulnTicks = 0;
      rig.world.damage(rig.p, { amount: 1, kind: 'bullet', dirX: -1, source: ticket });
      expect(rig.p.state).toBe('dead');
      expect(rig.session.slots[0].cents).toBe(10000 - cents);
      expect(rig.session.slots[0].ledger.tally(cat)).toEqual({ count: 1, cents: -cents });
    }
  });

  it('another death costs nothing', () => {
    const rig = euroRig();
    rig.p.invulnTicks = 0;
    rig.world.damage(rig.p, { amount: 1, kind: 'bullet', dirX: -1 });
    expect(rig.p.state).toBe('dead');
    expect(rig.session.slots[0].cents).toBe(10000);
  });

  it('charges the toeristenbelasting per continue (12,5 % of € 100,00; then 15 %)', () => {
    const rig = euroRig();
    const s = rig.session.slots[0];
    s.continues = 1;
    expect(chargeTouristTax(rig.session, s, rig.world)).toBe(1250);
    expect(s.cents).toBe(8750);
    s.continues = 2;
    expect(chargeTouristTax(rig.session, s)).toBe(1312);
    expect(s.ledger.tally('tax')).toEqual({ count: 2, cents: -2562 });
    // A point play pays no tax.
    const pts = new Rig();
    expect(chargeTouristTax(pts.session, pts.session.slots[0], pts.world)).toBe(0);
  });

  it('gives an extend (a life, ONE MORE TRY!) at € 5.000 gross; costs never count', () => {
    const rig = euroRig();
    const s = rig.session.slots[0];
    const lives = s.lives;
    pay(rig.world, 0, -100000, undefined, undefined, 'assessment');
    pay(rig.world, 0, EXTEND_CENTS[0] - 1, undefined, undefined, 'boss');
    expect(s.lives).toBe(lives);
    pay(rig.world, 0, 1, undefined, undefined, 'enemy');
    expect(s.lives).toBe(lives + 1);
    expect(rig.hud.callouts.some((c) => c.text === 'ONE MORE TRY!')).toBe(true);
    // The old score extends are off in a euro play.
    s.addScore(600000);
    expect(s.lives).toBe(lives + 1);
  });

  it('skims 1,5 % courtage of every pickup while De Makelaar lives and gives it back at his fall', () => {
    const rig = euroRig();
    const s = rig.session.slots[0];
    startCourtage(rig.world);
    pay(rig.world, 0, 10000, undefined, undefined, 'item');
    pay(rig.world, 0, 10000, undefined, undefined, 'enemy');
    expect(courtagePile(rig.world, 0)).toBe(150);
    expect(s.cents).toBe(10000 + 20000 - 150);
    endCourtage(rig.world, true);
    expect(s.cents).toBe(30000);
    expect(s.ledger.tally('courtageBack').cents).toBe(150);
  });

  it('the HUD line rolls to a new balance over 20 ticks with a merged pop', () => {
    const rig = euroRig();
    const s = rig.session.slots[0];
    expect(budgetLine(s, 100).shown).toBe(10000);
    pay(rig.world, 0, 15, undefined, undefined, 'deposit');
    pay(rig.world, 0, 15, undefined, undefined, 'deposit');
    let l = budgetLine(s, 101);
    expect(l.pop).toBe(30);
    l = budgetLine(s, 101 + ROLL_TICKS / 2);
    expect(l.shown).toBe(10015);
    l = budgetLine(s, 101 + ROLL_TICKS);
    expect(l.shown).toBe(10030);
  });
});

describe('budget: the runner hooks', () => {
  function mission(id: string, economy?: 'euro'): MissionDef {
    const t = terrain(800, 216);
    t.ground().at(0, FLOOR).flat(800);
    return {
      id,
      name: 'BUDGET TEST',
      music: 'm1',
      start: 'a',
      ...(economy ? { economy } : {}),
      sections: {
        a: {
          id: 'a',
          width: 800,
          height: 216,
          scroll: 'right',
          background: { sky: 0x203040ff, layers: [] },
          terrain: t.build(),
          terrainStyle: { ground: 'dirt' },
          playerStart: { x: 40, y: FLOOR },
          script: function* idle() {
            yield 100000;
          },
        },
      },
    };
  }

  function runner(m: MissionDef, session = new GameSession()): MissionRunner {
    const r = new MissionRunner({ session, mission: m, pads: [new VirtualPad(), new VirtualPad()], audio: new NullAudio(), seed: 3 });
    r.start();
    return r;
  }

  it('sets the economy from MissionDef.economy (euro missions mark the game a euro run)', () => {
    const pts = runner(mission('budget-pts'));
    expect(pts.session.economy).toBe('points');
    expect(pts.session.euroRun).toBe(false);
    const eur = runner(mission('budget-eur', 'euro'));
    expect(eur.session.economy).toBe('euro');
    expect(eur.session.euroRun).toBe(true);
    expect(eur.session.slots[0].euro).toBe(true);
  });

  it('pays the score events in euros: no point pop-ups, a euro pop-up', () => {
    const r = runner(mission('budget-pop', 'euro'));
    awardScore(r.world, 0, 500, 300, 150);
    r.update();
    expect(r.hud.popups.map((p) => p.text)).toEqual(['+€10']);
    expect(r.session.slots[0].cents).toBe(11000);
  });

  it('a callout that names its points names the euros (CAUGHT NAPPING +€1)', () => {
    const r = runner(mission('budget-nap', 'euro'));
    awardScore(r.world, 0, 100, 300, 150);
    r.hud.callout('CAUGHT NAPPING +100');
    expect(r.hud.callouts.at(-1)?.text).toBe('CAUGHT NAPPING +€1');
    expect(r.session.slots[0].ledger.tally('prop').cents).toBe(100);
  });

  it('the MATCHA-MOMENT holds every non-player entity on odd ticks', () => {
    const r = runner(mission('budget-slow', 'euro'));
    for (let i = 0; i < 40; i++) r.update();
    let steps = 0;
    const e = r.world.spawn('test-dummy', 400, FLOOR);
    r.world.flush();
    // Count the dummy's own update calls through its prototype (the hold replaces it on odd ticks).
    const proto = Object.getPrototypeOf(e) as { update: () => void };
    const base = proto.update;
    proto.update = function (this: Entity) {
      if (this === e) steps++;
      base.call(this);
    };
    try {
      slowWorld(r.world, 20);
      expect(slowWorldLeft(r.world)).toBe(20);
      for (let i = 0; i < 20; i++) r.update();
      expect(steps).toBe(10);
      expect(slowWorldLeft(r.world)).toBe(0);
      steps = 0;
      for (let i = 0; i < 10; i++) r.update();
      expect(steps).toBe(10);
      expect(Object.hasOwn(e, 'update')).toBe(false);
      // The players never slow down.
      expect(r.players[0].age).toBeGreaterThan(0);
    } finally {
      proto.update = base;
    }
  });
});
