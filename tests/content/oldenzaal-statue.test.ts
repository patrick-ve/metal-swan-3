/**
 * St. Plechelmus, the statue mini-boss of mission oldenzaal (docs/design/oldenzaal.md §5, §6;
 * revision 2: R2-6, R2-8; bosses/oldenzaal/): registration, the art (1×, 2×, 4× with the 1×
 * geometry), the dormant decor (shots chip dust, nothing more), the wake scene that starts the
 * fight (Mevrouw Winkel flies into the stone), the two phases, every attack after a tell ≥ 18 on
 * screen, the crozier hook (caught, freed by a jump or by shooting the crozier head, else pulled
 * in and struck), the freed end (back on the plinth, whole, eyes dark; the doors open, the exit
 * on), the ghost without hurt boxes, the bot's time on normal, Meneer Wu's hair, the TO BE
 * CONTINUED card's face and trail.
 */
import { describe, expect, it } from 'vitest';
import { getFrames, hasHiSprite, hasSprite } from '../../src/engine/sprites';
import type { ScriptGen } from '../../src/engine/script';
import { loadContent } from '../../src/game/content/index';
import { STATUE_SPRITES } from '../../src/game/content/bosses/oldenzaal/art';
import { CZ, PLINTH, SIT, STAND, STAND_POSES, STATUE, crozierTip } from '../../src/game/content/bosses/oldenzaal/geometry';
import { OZ_STATUE_SFX } from '../../src/game/content/bosses/oldenzaal/sfx';
import { Plechelmus } from '../../src/game/content/bosses/oldenzaal/statue';
import { TBC_SPRITES } from '../../src/game/content/bosses/oldenzaal/tbc-art';
import { ARENA_L, DOOR_X, OZ_C_EXIT, OZ_SQUARE_SPRITES, STATUE_X, SquareDoors } from '../../src/game/content/missions/oldenzaal/art-square';
import { OLDENZAAL_ID, OZ_SPRITES, OZ_STATUE, OZ_WUGHOST } from '../../src/game/content/missions/oldenzaal/ids';
import { OZ_C_EXIT_ID } from '../../src/game/content/missions/oldenzaal/script-oz-c';
import { WU_STYLE } from '../../src/game/content/oldenzaal/npcs/art';
import { OzWinkel } from '../../src/game/content/oldenzaal/npcs/index';
import { SFX } from '../../src/game/content/sfx/index';
import { getEntityMeta, getMission, hasEntity } from '../../src/game/registry';
import { TBC_FACE, TBC_TRAIL } from '../../src/game/scenes/to-be-continued';
import { createHeadlessGame } from '../../src/sim/index';
import { FLOOR, TestWorld } from './helpers';

await loadContent();

type Diff = 'easy' | 'normal' | 'hard';

/** A statue in a fight on a flat floor with the hero `dist` px to its left (attacks run one by one). */
function bare(o: { difficulty?: Diff; god?: boolean; dist?: number; standing?: boolean } = {}): { tw: TestWorld; s: Plechelmus } {
  const tw = new TestWorld({ width: 900, god: o.god ?? true, difficulty: o.difficulty, playerX: 440 - (o.dist ?? 90) });
  const s = tw.spawn(OZ_STATUE.boss, 440) as Plechelmus;
  s.awaken();
  // Skip the intro: straight into the fight, no pattern.
  s.state = 'fight';
  s.barFill = 1;
  if (o.standing) {
    (s as unknown as { seated: boolean }).seated = false;
    s.pose = STAND.stand;
    s.enterTwo();
  }
  tw.run(2);
  return { tw, s };
}

function run(tw: TestWorld, s: Plechelmus, gen: ScriptGen): void {
  tw.world.scripts.run(gen, { owner: s });
}

describe('St. Plechelmus: registration and art', () => {
  it('registers the boss, its shots, the doors, the sounds; 5,000 points; the mission def starts at oz-c with boss=1', () => {
    for (const id of Object.values(OZ_STATUE)) expect(hasEntity(id), id).toBe(true);
    expect(getEntityMeta(OZ_STATUE.boss)?.category).toBe('boss');
    expect(getEntityMeta(OZ_STATUE.boss)?.score).toBe(5000);
    expect(hasEntity('oz-square-doors')).toBe(true);
    const ids = Object.keys(OZ_STATUE_SFX);
    expect(ids.length).toBeGreaterThanOrEqual(15);
    for (const id of ids) {
      expect(id.startsWith('oz/statue/'), id).toBe(true);
      expect(SFX[id], id).toBeDefined();
    }
    const m = getMission(OLDENZAAL_ID)!;
    expect(m.bossSection).toBe('oz-c');
    const c = m.sections['oz-c'];
    expect(c.bossStart?.x).toBe(ARENA_L + 48);
    expect(c.exits?.some((e) => e.id === OZ_C_EXIT_ID && e.disabled === true && e.to === 'oz-d')).toBe(true);
  });

  it('every statue, square and card sprite has 1×, 2× and 4× art with the 1× geometry, under the owner prefixes', () => {
    const all = [...STATUE_SPRITES, ...OZ_SQUARE_SPRITES, ...TBC_SPRITES];
    expect(all.length).toBeGreaterThanOrEqual(20);
    for (const id of all) {
      expect(OZ_SPRITES.statue.some((p) => id.startsWith(p)), id).toBe(true);
      expect(hasSprite(id), id).toBe(true);
      expect(hasHiSprite(id, 2), `${id}@2`).toBe(true);
      expect(hasHiSprite(id, 4), `${id}@4`).toBe(true);
    }
    for (const id of ['boss/oz-plechelmus/sit', 'boss/oz-plechelmus/stand', 'boss/oz-plechelmus/plinth', 'boss/oz-plechelmus/crozier', 'decor/oz-square/doors', 'ui/oz-tbc/face']) {
      const one = getFrames(id, 1);
      for (const d of [2, 4] as const) {
        const hi = getFrames(id, d);
        expect(hi.length, id).toBe(one.length);
        hi.forEach((f, i) => {
          expect([f.buf.w, f.buf.h], `${id}@${d}#${i}`).toEqual([one[i].buf.w * d, one[i].buf.h * d]);
          expect([f.ox, f.oy], `${id}@${d}#${i} anchor`).toEqual([one[i].ox, one[i].oy]);
        });
      }
    }
    // A big boss at 1× (spec §5.1: about 64 × 120 with the plinth).
    const plinth = getFrames('boss/oz-plechelmus/plinth', 1)[0];
    const sit = getFrames('boss/oz-plechelmus/sit', 1)[0];
    expect(plinth.buf.w).toBeGreaterThanOrEqual(60);
    expect(PLINTH.h + sit.oy).toBeGreaterThanOrEqual(110);
  });
});

describe('St. Plechelmus: the dormant statue and the wake', () => {
  it('is plain decor until the lock (neutral, not shootable), then shots chip dust and take nothing', () => {
    const tw = new TestWorld({ width: 900, god: true, playerX: 300 });
    const s = tw.spawn(OZ_STATUE.boss, 440) as Plechelmus;
    expect(s.dormant).toBe(true);
    expect(s.team).toBe('neutral');
    expect(s.hasTag('shootable')).toBe(false);
    expect(s.hasTag('enemy')).toBe(false);
    tw.run(60);
    expect(s.state).toBe('waiting');
    s.armDecor();
    expect(s.team).toBe('enemy');
    expect(s.hasTag('shootable')).toBe(true);
    const hp = s.hp;
    for (let i = 0; i < 20; i++) {
      expect(s.onHit({ amount: 50, kind: 'bullet', dirX: 1, owner: 0 }, 0)).toBe(true);
      tw.run(1);
    }
    expect(s.hp).toBe(hp);
    expect(s.state).toBe('waiting');
  });

  it('awaken(): the stone cracks, the eyes glow, the bar fills during the invulnerable intro, then phase 1 (seated)', () => {
    const tw = new TestWorld({ width: 900, god: true, playerX: 300 });
    const s = tw.spawn(OZ_STATUE.boss, 440) as Plechelmus;
    s.awaken();
    tw.run(2);
    expect(s.state).toBe('intro');
    expect(s.healthFrac).toBeLessThan(0.2);
    tw.run(STATUE.wake.crack);
    expect(s.crack).toBe(1);
    expect(s.eyes).toBeGreaterThan(0.9);
    const hp = s.hp;
    s.onHit({ amount: 100, kind: 'bullet', dirX: 1, owner: 0 }, 0);
    expect(s.hp).toBe(hp);
    tw.until(() => s.state === 'fight', 200);
    expect(s.healthFrac).toBe(1);
    expect(s.phase).toBe(0);
    expect(s.seated).toBe(true);
    expect(tw.world.errors).toEqual([]);
  });

  it('in oz-c the wake scene starts the fight: Mevrouw Winkel fades in, speaks, flies into the stone, and has no hurt box', async () => {
    const g = await createHeadlessGame({ missionId: OLDENZAAL_ID, sectionId: 'oz-c', seed: 3, players: 1, god: true, bot: true, bossRush: true, captureConsole: true });
    let statue: Plechelmus | null = null;
    let winkelSeen = false;
    let noBoxes = true;
    let lines = 0;
    let lastBubble = '';
    g.runUntil((gg) => {
      const w = gg.runner?.world;
      if (!w) return false;
      for (const e of w.entities) {
        if (e instanceof Plechelmus) statue = e;
        if (e instanceof OzWinkel && e.fade > 0.5 && !(statue as Plechelmus | null)?.dead) {
          winkelSeen = true;
          if (e.hurtboxes().length > 0) noBoxes = false;
        }
      }
      const b = (gg.runner as unknown as { hud?: { bubbles?: Array<{ text: string }> } }).hud?.bubbles?.[0]?.text ?? '';
      if (b && b !== lastBubble) {
        lastBubble = b;
        lines++;
      }
      return statue !== null && (statue as Plechelmus).state === 'fight';
    }, 2400);
    const s = statue as Plechelmus | null;
    expect(s).not.toBeNull();
    expect(winkelSeen).toBe(true);
    expect(noBoxes).toBe(true);
    expect(s!.state).toBe('fight');
    expect(s!.x).toBe(STATUE_X);
    expect(g.runner!.world.entities.some((e) => e instanceof OzWinkel && !e.removed)).toBe(false);
    expect(g.report().errors).toEqual([]);
    g.dispose();
  }, 60000);
});

describe('St. Plechelmus: the fight', () => {
  it('phase 2 starts below 55 %: he steps down off the plinth (invulnerable), the head becomes the weak point, the crozier a part', () => {
    const tw = new TestWorld({ width: 900, god: true, playerX: 300 });
    const s = tw.spawn(OZ_STATUE.boss, 440, { hpScale: 0.2 }) as Plechelmus;
    s.awaken();
    tw.until(() => s.state === 'fight', 300);
    const body = s.part('body')!;
    while (s.healthFrac > STATUE.phase2At + 0.01) {
      s.onHit({ amount: 20, kind: 'bullet', dirX: 1, owner: 0 }, body.index);
      tw.run(1);
    }
    tw.run(2);
    expect(s.phase).toBe(1);
    expect(s.stepping).toBe(true);
    tw.until(() => !s.stepping, 300);
    expect(s.seated).toBe(false);
    expect(s.y).toBe(FLOOR);
    expect(s.part('head')!.multiplier).toBe(STATUE.headMul[1]);
    expect(s.part('crozier')!.enabled).toBe(true);
    expect(s.contactDamage).not.toBeNull();
    expect(tw.world.errors).toEqual([]);
  });

  describe.each(['easy', 'normal', 'hard'] as const)('on %s every attack fires after its tell (≥ 18 ticks), on screen', (difficulty) => {
    const cases: Array<[string, boolean, (s: Plechelmus) => ScriptGen, number]> = [
      ['sweep', false, (s) => s.sweep(), STATUE.sweep.tele],
      ['throw', false, (s) => s.throwStone(), STATUE.throw.tele],
      ['slam', true, (s) => s.groundSlam(), STATUE.slam.tele],
      ['hook', true, (s) => s.hook(), STATUE.hook.tele],
    ];
    it.each(cases)('%s', (kind, standing, attack, tele) => {
      const { tw, s } = bare({ difficulty, standing });
      run(tw, s, attack(s));
      const t = tw.until(() => s.attacks.length > 0, 300);
      const rec = s.attacks[0];
      expect(rec.kind).toBe(kind);
      expect(rec.onScreen).toBe(true);
      expect(rec.tell).toBeGreaterThanOrEqual(18);
      expect(rec.tell).toBeGreaterThanOrEqual(s.telegraphFor(tele));
      expect(t).toBeGreaterThanOrEqual(rec.tell);
      tw.run(200);
      expect(tw.world.errors).toEqual([]);
    });
  });

  it('the sweep sends a low wave to the left, the throw a stone that shatters into bouncing bits, the slam waves both ways', () => {
    const { tw, s } = bare();
    run(tw, s, s.sweep());
    tw.until(() => tw.ofType(OZ_STATUE.shockwave).some((w) => w.vx < 0), 120);
    tw.run(160);
    run(tw, s, s.throwStone());
    tw.until(() => tw.ofType(OZ_STATUE.stone).length > 0, 120);
    expect(s.missing).toBe(1);
    tw.until(() => tw.ofType(OZ_STATUE.stoneBit).length >= STATUE.throw.bits, 200);
    const b = bare({ standing: true });
    run(b.tw, b.s, b.s.groundSlam());
    b.tw.until(() => b.tw.ofType(OZ_STATUE.shockwave).filter((w) => w.vx !== 0).length >= 2, 120);
    const vx = b.tw.ofType(OZ_STATUE.shockwave).filter((w) => w.vx !== 0).map((w) => Math.sign(w.vx));
    expect(vx).toContain(-1);
    expect(vx).toContain(1);
  });

  it('the hook catches a standing hero at chest height and misses a crouching one', () => {
    const a = bare({ standing: true, dist: 80 });
    run(a.tw, a.s, a.s.hook());
    a.tw.until(() => a.s.hooked !== null || a.s.crozierOut >= STATUE.hook.reach, 200);
    expect(a.s.hooked).toBe(a.tw.player);
    const b = bare({ standing: true, dist: 80 });
    b.tw.hold('down');
    b.tw.run(4);
    run(b.tw, b.s, b.s.hook());
    let caught = false;
    for (let i = 0; i < 160; i++) {
      b.tw.run(1);
      if (b.s.hooked) caught = true;
    }
    expect(caught).toBe(false);
  });

  it('a hooked hero breaks free by jumping', () => {
    const { tw, s } = bare({ standing: true, dist: 80 });
    run(tw, s, s.hook());
    tw.until(() => s.hooked !== null, 200);
    const x0 = tw.player!.x;
    tw.run(12);
    expect(tw.player!.x).toBeGreaterThan(x0);
    tw.hold('jump');
    tw.run(3);
    tw.hold();
    tw.until(() => s.hooked === null, 30);
    expect(tw.world.errors).toEqual([]);
  });

  it('a hooked hero breaks free when the crozier head is shot (36 damage)', () => {
    const { tw, s } = bare({ standing: true, dist: 80 });
    run(tw, s, s.hook());
    tw.until(() => s.hooked !== null, 200);
    const cz = s.part('crozier')!;
    s.onHit({ amount: 20, kind: 'bullet', dirX: 1, owner: 0 }, cz.index);
    expect(s.hooked).not.toBeNull();
    s.onHit({ amount: 20, kind: 'bullet', dirX: 1, owner: 0 }, cz.index);
    expect(s.hooked).toBeNull();
  });

  it('a hooked hero who does nothing is pulled in and struck (one hit kills)', () => {
    const { tw, s } = bare({ standing: true, dist: 80, god: false });
    run(tw, s, s.hook());
    tw.until(() => s.hooked !== null, 200);
    tw.until(() => tw.player!.state !== 'play', 200);
    expect(tw.player!.state).not.toBe('play');
  });

  it('a broken crozier means no more hooks (and frees a hooked hero)', () => {
    const { tw, s } = bare({ standing: true, dist: 80 });
    const cz = s.part('crozier')!;
    s.onHit({ amount: 1e6, kind: 'explosion', dirX: 1, owner: 0 }, cz.index);
    expect(cz.destroyed).toBe(true);
    run(tw, s, s.hook());
    tw.run(120);
    expect(s.attacks.filter((a) => a.kind === 'hook')).toEqual([]);
    expect(s.hooked).toBeNull();
  });

  it('a stagger ends the hook cleanly: the hero is let go, the crozier comes back', () => {
    const { tw, s } = bare({ standing: true, dist: 80 });
    s.phase = 1;
    run(tw, s, s.hook());
    tw.until(() => s.hooked !== null, 200);
    // The boss's own stagger path needs its phase pattern handle: emulate the cut directly.
    (s as unknown as { cutAttack(): boolean }).cutAttack();
    expect(s.hooked).toBeNull();
    expect(s.crozierOut).toBe(0);
  });

  it('the crozier head box follows the stretched hook (tip geometry)', () => {
    const { s } = bare({ standing: true });
    s.pose = STAND.hookOut;
    s.crozierOut = 40;
    const [x, y] = s.crozierHead([0, 0]);
    const p = STAND_POSES[STAND.hookOut];
    const t = crozierTip(CZ.left);
    expect(x).toBeCloseTo(s.x + p.hand[0] + t[0] - 40);
    expect(y).toBeCloseTo(s.y + p.hand[1] + t[1]);
    // Chest height of a standing hero (the crouch passes under it).
    expect(FLOOR - y).toBeGreaterThan(22);
    expect(FLOOR - y).toBeLessThan(34);
  });
});

describe('St. Plechelmus: the freed end', () => {
  it('the ghost is torn out and flees; the cracks close; he walks back, sits down on his plinth, whole, eyes dark', () => {
    const { tw, s } = bare({ standing: true, dist: 120 });
    s.x = 380;
    s.missing = 3;
    s.crack = 1;
    s.eyes = 1;
    s.kill(0);
    let ghost = false;
    for (let i = 0; i < 900 && !s.defeated; i++) {
      tw.run(1);
      if (tw.world.entities.some((e) => e.type === OZ_WUGHOST.winkel && !e.removed)) ghost = true;
    }
    expect(s.defeated).toBe(true);
    expect(ghost).toBe(true);
    expect(s.state).toBe('done');
    expect(s.removed).toBe(false);
    expect(s.seated).toBe(true);
    expect(s.pose).toBe(SIT.rest);
    expect(s.x).toBe(s.homeX);
    expect(s.missing).toBe(0);
    expect(s.crack).toBe(0);
    expect(s.eyes).toBe(0);
    expect(s.hasTag('shootable')).toBe(false);
    tw.run(400);
    expect(tw.world.entities.some((e) => e.type === OZ_WUGHOST.winkel && !e.removed)).toBe(false);
    expect(tw.world.errors).toEqual([]);
  });

  it('the doors creak open (an overlay) and light the doorway', () => {
    const tw = new TestWorld({ width: 900, god: true, playerX: 300 });
    const d = tw.spawn('oz-square-doors', 500) as SquareDoors;
    expect(d.isOpen).toBe(false);
    expect(d.hurtboxes()).toEqual([]);
    d.open();
    tw.run(80);
    expect(d.isOpen).toBe(true);
    expect(OZ_C_EXIT.x).toBeLessThan(DOOR_X);
    expect(OZ_C_EXIT.x + OZ_C_EXIT.w).toBeGreaterThan(DOOR_X);
  });

  it('the bot beats it on normal in 30–90 s; the doors open, the exit takes the squad into the nave (oz-d)', async () => {
    const g = await createHeadlessGame({ missionId: OLDENZAAL_ID, sectionId: 'oz-c', seed: 1, players: 1, god: true, bot: true, bossRush: true, captureConsole: true });
    let s: Plechelmus | null = null;
    let doors: SquareDoors | null = null;
    let fight = -1;
    let dead = -1;
    let exitOpen = false;
    g.runUntil((gg) => {
      const r = gg.runner;
      if (!r) return false;
      if (r.section.id !== 'oz-c') return true;
      for (const e of r.world.entities) {
        if (e instanceof Plechelmus) s = e;
        if (e instanceof SquareDoors) doors = e;
      }
      const b = s as Plechelmus | null;
      if (b && fight < 0 && b.state === 'fight') fight = r.ticks;
      if (b && dead < 0 && b.dead) dead = r.ticks;
      if (r.isExitOpen(OZ_C_EXIT_ID)) exitOpen = true;
      return false;
    }, 9000);
    expect(g.runner!.section.id).toBe('oz-d');
    expect(fight).toBeGreaterThan(0);
    const sec = (dead - fight) / 60;
    expect(sec).toBeGreaterThanOrEqual(30);
    expect(sec).toBeLessThanOrEqual(90);
    expect((doors as SquareDoors | null)?.isOpen).toBe(true);
    expect(exitOpen).toBe(true);
    expect(g.report().errors).toEqual([]);
    g.dispose();
  }, 120000);
});

describe('Meneer Wu and the TO BE CONTINUED card (STATUE, wave B)', () => {
  it('Meneer Wu: straight black hair (grey temples in the art), nothing else changed', () => {
    expect(WU_STYLE.hairStyle).toBe('short');
    expect(WU_STYLE.top).toBe('teal');
    expect(hasSprite('npc/oz-wu/idle')).toBe(true);
  });

  it('the card: the jet trail crosses the sky before the face fades in, and she laughs once', () => {
    expect(TBC_TRAIL.from).toBeLessThan(TBC_FACE.from);
    expect(TBC_FACE.laughAt).toBeGreaterThan(TBC_FACE.from);
    for (const id of ['ui/oz-tbc/face', 'ui/oz-tbc/jet', 'ui/oz-tbc/glow']) expect(hasSprite(id), id).toBe(true);
    expect(getFrames('ui/oz-tbc/face', 1).length).toBe(2);
  });
});
