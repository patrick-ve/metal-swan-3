/**
 * sewers-a DE WALLEN and GOUDEN GERRIT (docs/design/sewers.md §2.1, §4.1; wave P1b A): the section
 * (its layout numbers, the stand-in decor, the first weapon), the god bot plays it to the exit in 1P
 * and 2P (both tourists freed, the limo beaten, the lock opened), the boss rush runs the arena only,
 * and the limo in a flat test arena: the solid with its roof at y 148, the tells and their sounds,
 * the 3-pellet spread, Gerrit ducking (invulnerable while down), the back door (at most 2 bodyguards,
 * none while every hero is out), phase 2 (the horn roll 64 px and back, the gold chain lob,
 * shootable), the stagger, the end (the wreck, the flee, the one-way wreck).
 */
import { describe, expect, it, vi } from 'vitest';
import type { Entity } from '../../src/engine/entity';
import { hasSprite } from '../../src/engine/sprites';
import { Terrain } from '../../src/engine/terrain';
import { isSewersContent, loadContent } from '../../src/game/content/index';
import { GERRIT, GUARD_TAG, GerritLimo } from '../../src/game/content/bosses/sewers-gerrit/index';
import { A_BRIDGE, A_KRUL, A_TREE } from '../../src/game/content/missions/sewers/a-kit';
import { SEWERS_SONG } from '../../src/game/content/missions/sewers/ids';
import { SEWERS_A } from '../../src/game/content/missions/sewers/terrain';
import { SEWERS_VOICE } from '../../src/game/content/samples/sewers';
import { Projectile } from '../../src/game/projectile';
import { getMission } from '../../src/game/registry';
import type { Difficulty } from '../../src/game/session';
import { createHeadlessGame } from '../../src/sim/index';
import { FLOOR, TestWorld } from './helpers';

await loadContent();
await loadContent(isSewersContent);
const A = getMission('sewers')!.sections['sewers-a'];

/** Run sewers-a in the headless game until it leaves the section (or `max` ticks). */
async function playA(o: { players?: 1 | 2; bossRush?: boolean; seed?: number; max?: number }) {
  const g = await createHeadlessGame({ missionId: 'sewers', sectionId: 'sewers-a', seed: o.seed ?? 7, players: o.players ?? 1, god: true, bot: true, bossRush: o.bossRush, captureConsole: true, loadContent: false });
  let limo: GerritLimo | null = null;
  let firstWeapon = -1;
  let maxGuards = 0;
  let t = 0;
  try {
    for (; t < (o.max ?? 14000) && !g.done; t++) {
      g.step(1);
      const r = g.runner!;
      if (r.section.id !== 'sewers-a') break;
      if (!limo) for (const e of r.world.entities) if (e instanceof GerritLimo) limo = e;
      if (firstWeapon < 0 && r.world.players.some((p) => (p as { weapon?: { id: string } }).weapon?.id !== 'pistol')) firstWeapon = t;
      maxGuards = Math.max(maxGuards, r.world.countAlive(GUARD_TAG));
    }
    return { t, next: g.runner!.section.id, report: g.report(), limo, firstWeapon, maxGuards, locked: g.runner!.world.camera.locked };
  } finally {
    g.dispose();
  }
}

describe('sewers-a: the section (spec §2.1)', () => {
  it('the layout numbers, the checkpoints, the exit behind the limo, the stand-in decor, the art prefixes', () => {
    expect(A.width).toBe(3072);
    expect(A.checkpoints).toEqual([1200, 2300, 2700]);
    expect(A.bossStart).toEqual({ x: 2700, y: 176 });
    expect(A.exits).toEqual([expect.objectContaining({ to: 'sewers-b', disabled: true, rect: expect.objectContaining({ x: 3040 }) })]);
    const t = new Terrain(A.terrain);
    for (let x = 4; x < A.width; x += 32) expect(t.surfaceY(x, 140, 182), `ground at ${x}`).toBe(176);
    expect(SEWERS_A.crates).toEqual({ H: 420, S: 1800, R: 2720 });
    expect(SEWERS_A.limo).toEqual([SEWERS_A.limoX - GERRIT.limo.halfW, SEWERS_A.limoX + GERRIT.limo.halfW]);
    expect(SEWERS_A.roofY).toBe(176 - GERRIT.limo.roof);
    for (const id of [A_KRUL, A_TREE, A_BRIDGE]) expect(hasSprite(id), id).toBe(true);
    expect((A.decor ?? []).map((d) => d.sprite)).toEqual([A_KRUL, A_KRUL, A_TREE, A_BRIDGE]);
    for (const p of ['boss/sewers-gerrit', 'enemy/sewers-dealer', 'enemy/sewers-pimp', 'enemy/sewers-bodyguard']) expect(A.art).toContain(p);
    for (const id of ['limo', 'door', 'gerrit', 'run', 'pellet', 'chain', 'flame', 'glint', 'door-bit']) expect(hasSprite(`boss/sewers-gerrit/${id}`), id).toBe(true);
  });

  it('the god bot plays it to sewers-b: the first weapon within 20 s, both tourists, the limo beaten, the lock open (1P)', async () => {
    const r = await playA({});
    expect(r.report.errors).toEqual([]);
    expect(r.report.warnings).toEqual([]);
    expect(r.next).toBe('sewers-b');
    expect(r.t).toBeLessThan(9000);
    expect(r.firstWeapon).toBeGreaterThanOrEqual(0);
    expect(r.firstWeapon).toBeLessThanOrEqual(1200);
    expect(r.report.hostages).toBe(2);
    expect(r.limo?.defeated).toBe(true);
    expect(r.maxGuards).toBeLessThanOrEqual(GERRIT.door.maxAlive);
    for (const id of ['sewers-dealer', 'sewers-pimp', 'sewers-bodyguard']) expect(r.report.killsByType[id] ?? 0, id).toBeGreaterThan(0);
    expect(r.report.maxEntities).toBeLessThanOrEqual(300);
  }, 120_000);

  it('2P: both heroes reach sewers-b, no softlock', async () => {
    const r = await playA({ players: 2 });
    expect(r.report.errors).toEqual([]);
    expect(r.next).toBe('sewers-b');
    expect(r.t).toBeLessThan(9000);
    expect(r.limo?.defeated).toBe(true);
  }, 120_000);

  it('the boss rush (`section=sewers-a&boss=1`) runs the Gerrit arena only, then the exit', async () => {
    const r = await playA({ bossRush: true });
    expect(r.report.errors).toEqual([]);
    expect(r.next).toBe('sewers-b');
    expect(r.limo?.defeated).toBe(true);
    expect(r.report.killsByType['sewers-dealer'] ?? 0).toBe(0);
    expect(r.report.hostages).toBe(0);
  }, 120_000);
});

// ------------------------------------------------------------------------------------------- the limo

const LIMO_X = 400;

function arena(o: { difficulty?: Difficulty; playerX?: number; god?: boolean } = {}) {
  const tw = new TestWorld({ god: o.god ?? true, playerX: o.playerX ?? 200, difficulty: o.difficulty, seed: 7 });
  const sounds: Array<{ id: string; tick: number }> = [];
  vi.spyOn(tw.world.audio, 'sfx').mockImplementation((id: string) => {
    sounds.push({ id, tick: tw.world.tick });
  });
  const said: string[] = [];
  const bubble = tw.hud.bubble.bind(tw.hud);
  vi.spyOn(tw.hud, 'bubble').mockImplementation((target, text, opts) => {
    said.push(text);
    return bubble(target, text, opts);
  });
  const limo = tw.spawn('sewers-gerrit', LIMO_X, { facing: -1 }) as GerritLimo;
  return { tw, limo, sounds, said };
}

function fight(tw: TestWorld, limo: GerritLimo): void {
  limo.start();
  tw.until(() => limo.state === 'fight', 400);
}

function hitPart(limo: GerritLimo, part: number, amount: number): void {
  limo.onHit({ amount, kind: 'explosion', dirX: 1, owner: 0 }, part);
}

describe('GOUDEN GERRIT: the limo (spec §4.1)', () => {
  it('is a 120 × 28 solid with its roof a platform at y 148; a hero stands on it; it waits until start()', () => {
    const { tw, limo } = arena({ playerX: LIMO_X - 40 });
    expect(limo).toBeInstanceOf(GerritLimo);
    expect(limo.box).toMatchObject({ x: LIMO_X - 60, y: FLOOR - 28, w: 120, h: 28, oneWay: false });
    expect(limo.box.y).toBe(148);
    // A hero dropped over the roof lands on it.
    const p = tw.player!;
    p.placeAt(LIMO_X - 40, 120, 0);
    tw.run(60);
    expect(p.y).toBe(148);
    expect(p.body.onGround).toBe(true);
    tw.run(120);
    expect(limo.state).toBe('waiting');
    expect(limo.parts.map((q) => [q.name, q.maxHp, q.required])).toEqual([
      ['limo', 900, true],
      ['gerrit', 500, true],
    ]);
  });

  it('the shotgun: rise, tell 24 (the pump and its sound), 3 pellets at the chest line ±10°, 60 up, then he ducks (invulnerable)', () => {
    const { tw, limo, sounds } = arena({ playerX: 220 });
    fight(tw, limo);
    tw.until(() => limo.trace.some((a) => a.attack === 'volley' && a.fire >= 0), 400);
    const v = limo.trace.find((a) => a.attack === 'volley')!;
    expect(v.fire - v.tell).toBeGreaterThanOrEqual(24);
    expect(sounds.some((s) => s.id === 'sewers/shotgun-pump' && s.tick === v.tell)).toBe(true);
    expect(sounds.some((s) => s.id === 'sewers/shotgun' && s.tick === v.fire)).toBe(true);
    const pellets = tw.world.entities.filter((e) => e.type === 'sewers-gerrit-shot' && !e.removed) as Projectile[];
    expect(pellets.length).toBe(3);
    const ang = pellets.map((q) => Math.atan2(q.vy, -q.vx)).sort((a, b) => a - b);
    expect(ang[1] - ang[0]).toBeCloseTo((10 * Math.PI) / 180, 2);
    expect(ang[2] - ang[1]).toBeCloseTo((10 * Math.PI) / 180, 2);
    for (const q of pellets) expect(q.vx).toBeLessThan(0);
    // The middle pellet reaches the hero's x at chest height (24 px over his feet): a crouch (20 px) dodges it.
    const mid = pellets.find((q) => Math.abs(Math.atan2(q.vy, -q.vx) - ang[1]) < 1e-6)!;
    const yAt = mid.y + (mid.vy / mid.vx) * (220 - mid.x);
    expect(Math.abs(yAt - (FLOOR - 24))).toBeLessThan(2);
    // Up and hittable for the window, then down and off.
    expect(limo.parts[1].enabled).toBe(true);
    tw.run(GERRIT.volley.up + 8 + GERRIT.sun.duck + 2);
    expect(limo.gSink).toBe(GERRIT.sun.sink);
    expect(limo.parts[1].enabled).toBe(false);
  });

  it('far from the limo a crouch dodges the whole spread (the low pellet hits the cobbles short); a standing hero is hit', () => {
    for (const crouch of [true, false]) {
      const { tw, limo } = arena({ playerX: 140, god: false });
      const p = tw.player!;
      if (crouch) tw.hold('down');
      fight(tw, limo);
      tw.until(() => limo.trace.some((a) => a.attack === 'volley' && a.fire >= 0), 400);
      tw.run(140);
      expect(p.state === 'play', `crouch ${crouch}`).toBe(crouch);
    }
  });

  it('the back door: a bodyguard steps out at the nose, at most 2 alive, none while every hero is out', () => {
    const { tw, limo } = arena({ playerX: 60 });
    fight(tw, limo);
    let most = 0;
    for (let i = 0; i < 1800; i++) {
      tw.run(1);
      most = Math.max(most, tw.world.countAlive(GUARD_TAG));
    }
    expect(limo.trace.filter((a) => a.attack === 'door').length).toBeGreaterThanOrEqual(2);
    expect(most).toBeLessThanOrEqual(2);
    for (const e of tw.world.byTag(GUARD_TAG)) (e as Entity).remove();
    tw.world.flush();
    limo.addsHeld = true;
    const doors = limo.trace.filter((a) => a.attack === 'door').length;
    tw.run(1200);
    expect(limo.trace.filter((a) => a.attack === 'door').length).toBe(doors);
  });

  it('phase 2 (the limo at half): the horn tell 30, the roll 64 px toward the heroes and back (only the nose hurts, only on the way out), then the gold chain (shootable, 10 HP)', () => {
    const { tw, limo, sounds } = arena({ playerX: 120 });
    fight(tw, limo);
    hitPart(limo, 0, Math.ceil(limo.parts[0].maxHp * 0.5));
    tw.until(() => limo.phase === 1, 600);
    tw.until(() => limo.rolling, 600);
    const roll = limo.trace.find((a) => a.attack === 'roll')!;
    expect(roll.fire - roll.tell).toBeGreaterThanOrEqual(30);
    expect(sounds.some((s) => s.id === 'sewers/limo-horn' && s.tick === roll.tell)).toBe(true);
    expect(limo.contactBoxes().length).toBe(1);
    let minX = limo.x;
    tw.until(() => {
      minX = Math.min(minX, limo.x);
      return !limo.rolling;
    }, 200);
    minX = Math.min(minX, limo.x);
    expect(LIMO_X - minX).toBeCloseTo(GERRIT.roll.dist, 5);
    expect(limo.contactBoxes().length).toBe(0);
    tw.until(() => !limo.returning && limo.x === LIMO_X, 300);
    expect(limo.box.x).toBe(LIMO_X - 60);
    tw.until(() => limo.trace.some((a) => a.attack === 'chain' && a.fire >= 0), 900);
    const c = limo.trace.find((a) => a.attack === 'chain')!;
    expect(c.fire - c.tell).toBeGreaterThanOrEqual(24);
    const chain = tw.world.entities.find((e) => e.type === 'sewers-gerrit-chain' && !e.removed)!;
    expect(chain.hasTag('shootable')).toBe(true);
    expect(chain.hp).toBe(GERRIT.chain.hp);
  });

  it('every tell is ≥ 18 ticks on every difficulty', () => {
    for (const d of ['easy', 'normal', 'hard'] as const) {
      const { tw, limo } = arena({ difficulty: d, playerX: 120 });
      fight(tw, limo);
      tw.run(600);
      hitPart(limo, 0, Math.ceil(limo.parts[0].maxHp * 0.5));
      tw.run(1400);
      const attacks = limo.trace.filter((a) => a.attack !== 'door' && a.fire >= 0);
      expect(new Set(attacks.map((a) => a.attack)), d).toEqual(new Set(['volley', 'roll', 'chain']));
      for (const a of attacks) expect(a.fire - a.tell, `${d} ${a.attack}`).toBeGreaterThanOrEqual(18);
    }
  });

  it('the stagger (a continued hero lands) holds the pattern and shows the shock, never in the middle of a roll', () => {
    const { tw, limo } = arena({ playerX: 120 });
    fight(tw, limo);
    tw.run(30);
    const n = limo.trace.length;
    limo.stagger(60);
    tw.run(59);
    expect(limo.trace.length).toBe(n);
    hitPart(limo, 0, Math.ceil(limo.parts[0].maxHp * 0.5));
    tw.until(() => limo.rolling, 900);
    const x = limo.x;
    limo.stagger(60);
    tw.run(5);
    expect(limo.x).not.toBe(x);
  });

  it('the end: the limo breaks (MIJN LIMO!!), Gerrit flees (DIT IS NIET VOORBIJ!), the boss is defeated, the wreck is one-way', () => {
    const { tw, limo, said, sounds } = arena({ playerX: 120 });
    fight(tw, limo);
    hitPart(limo, 1, 10_000);
    expect(limo.gerritOut).toBe(true);
    expect(limo.state).toBe('fight');
    tw.run(10);
    hitPart(limo, 0, 10_000);
    expect(limo.state).toBe('dying');
    expect(limo.wrecked).toBe(true);
    expect(sounds.some((s) => s.id === 'sewers/limo-wreck')).toBe(true);
    tw.until(() => limo.defeated, 600);
    expect(said).toContain(SEWERS_VOICE.gerrit.limo);
    expect(said).toContain(SEWERS_VOICE.gerrit.notOver);
    expect(limo.removed).toBe(false);
    expect(limo.box.oneWay).toBe(true);
    // The wreck no longer blocks: a hero walks through it.
    const p = tw.player!;
    p.placeAt(LIMO_X - 80, FLOOR, 1);
    tw.hold('right').run(120);
    expect(p.x).toBeGreaterThan(LIMO_X + 60);
  });

  it('the song id of the fight is sewers-gerrit', () => {
    expect(SEWERS_SONG.gerrit).toBe('sewers-gerrit');
  });
});
