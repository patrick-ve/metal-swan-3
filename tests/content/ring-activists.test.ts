/**
 * Revision R wave B, ACTIVISTS (docs/design/ring.md §R.6, §R.9; docs/api/ring.md "R.B1 The activists
 * and the police"): each kind attacks only after a tell ≥ 18 ticks with the activist on screen; the
 * glue sticks a hero (no move, no jump; can still shoot) and ends; the shout ring pushes without
 * damage; the squeal's stun ends; a loper sits, glues and becomes a lijmer; beaten ones leave
 * bloodless (they run off or a police pair carries them off: nobody vanishes on the hit); the police
 * are never a target; the art has 1× / 2× / 4× with the 1× geometry; everything is deterministic.
 */
import { afterEach, describe, expect, it } from 'vitest';
import type { Entity } from '../../src/engine/entity';
import { getFrames, hasHiSprite, listSprites } from '../../src/engine/sprites';
import type { World } from '../../src/engine/world';
import { loadContent } from '../../src/game/content/index';
import {
  ACT_FX,
  ACTIVIST,
  ACTIVIST_OUT_EVENT,
  ACTIVIST_TUNE,
  Activist,
  Agent,
  GLUE_PUDDLE_TAG,
  GluePuddle,
  HERO_STATUS,
  Ketting,
  Loper,
  POLICE,
  POLICE_TAG,
  ShoutRing,
  Splat,
  stunHero,
  type ActivistOutEvent,
} from '../../src/game/content/ring/activists/index';
import { isPlayer, type Player } from '../../src/game/player/player';
import { Projectile } from '../../src/game/projectile';
import { createHeadlessRing, type HeadlessRing } from '../../src/sim/headless-ring';

await loadContent();

let open: HeadlessRing | null = null;
afterEach(() => {
  open?.dispose();
  open = null;
});

/** A quiet rf-b start (no bot, god): the world and the hero standing at the start. */
async function arena(): Promise<{ h: HeadlessRing; w: World; p: Player }> {
  const h = await createHeadlessRing({ seed: 1, god: true, bot: false, section: 'rf-b', players: 1, loadContent: false } as never);
  open = h;
  h.step(2);
  const w = h.world!;
  const p = w.byTag('player').find((e: Entity) => isPlayer(e)) as Player;
  return { h, w, p };
}

/** Record each strike of `e`: the tell's length and whether it was on screen. */
function watchTells(w: World, e: Activist, out: Array<{ attack: string; tell: number; on: boolean }>): () => void {
  let mode = e.mode;
  let tellT = 0;
  return () => {
    if (e.mode === 'tell') tellT = e.modeT;
    if (mode === 'tell' && e.mode === 'attack') out.push({ attack: e.attack, tell: tellT, on: w.onScreen(e, 0) });
    mode = e.mode;
  };
}

describe('the activists attack after a tell (≥ 18 ticks, on screen)', () => {
  it('the lijmer: paint balloons, every third the glue pot', async () => {
    const { h, w, p } = await arena();
    const a = w.spawn(ACTIVIST.lijmer, p.x + 120, p.y, { facing: -1, wait: 10 }) as Activist;
    const tells: Array<{ attack: string; tell: number; on: boolean }> = [];
    const sprites = new Set<string>();
    const watch = watchTells(w, a, tells);
    for (let t = 0; t < 700; t++) {
      h.step(1);
      watch();
      for (const s of w.byTag('shot')) if (s instanceof Projectile && s.team === 'enemy' && s.sprite) sprites.add(s.sprite);
    }
    expect(tells.length).toBeGreaterThanOrEqual(3);
    for (const t of tells) {
      expect(t.tell, t.attack).toBeGreaterThanOrEqual(ACTIVIST_TUNE.minTell);
      expect(t.on).toBe(true);
    }
    expect(tells.map((t) => t.attack)).toContain('pot');
    expect([...sprites].some((s) => s.startsWith('fx/ring/act/balloon-'))).toBe(true);
    expect(sprites.has('fx/ring/act/pot')).toBe(true);
  });

  it('the ketting throws soup cans; the megafoon shouts (a ring) and squeals', async () => {
    const { h, w, p } = await arena();
    const k = w.spawn(ACTIVIST.ketting, p.x + 150, p.y, { facing: -1, wait: 10 }) as Activist;
    const m = w.spawn(ACTIVIST.megafoon, p.x + 60, p.y, { facing: -1, wait: 30 }) as Activist;
    const tells: Array<{ attack: string; tell: number; on: boolean }> = [];
    const wk = watchTells(w, k, tells);
    const wm = watchTells(w, m, tells);
    let cans = 0;
    let rings = 0;
    for (let t = 0; t < 1200; t++) {
      h.step(1);
      wk();
      wm();
      for (const s of w.byTag('shot')) if (s instanceof Projectile && s.sprite === 'fx/ring/act/can') cans++;
      for (const e of w.entities) if (e instanceof ShoutRing && e.t === 1) rings++;
    }
    const kinds = new Set(tells.map((t) => t.attack));
    expect(kinds).toEqual(new Set(['throw', 'shout', 'squeal']));
    for (const t of tells) expect(t.tell, t.attack).toBeGreaterThanOrEqual(ACTIVIST_TUNE.minTell);
    expect(cans).toBeGreaterThan(0);
    expect(rings).toBeGreaterThan(0);
  });
});

describe('the hero opt-ins', () => {
  it('a glue puddle sticks a hero ~40 ticks (no move, no jump, can still shoot), then lets go with a grace', async () => {
    const { h, w, p } = await arena();
    const g = new GluePuddle(w, Math.round(p.x), p.y);
    w.add(g);
    h.step(8);
    expect(w.byTag(GLUE_PUDDLE_TAG)).toContain(g);
    expect(p.status.has(HERO_STATUS.glue)).toBe(true);
    expect(p.status.speed).toBe(0);
    expect(p.status.noJump).toBe(true);
    expect(p.status.noFire).toBe(false);
    p.vx = 2;
    h.step(1);
    expect(p.vx).toBe(0);
    h.step(ACTIVIST_TUNE.glueTicks);
    expect(p.status.has(HERO_STATUS.glue)).toBe(false);
    // Still in the puddle: the grace keeps it off long enough to walk out.
    h.step(20);
    expect(p.status.has(HERO_STATUS.glue)).toBe(false);
    // The puddle dries and goes.
    h.step(ACT_FX.glueLife + 40);
    expect(g.removed).toBe(true);
  });

  it('a shout ring pushes a hero back without damage; a jump clears it', async () => {
    const { h, w, p } = await arena();
    const hp = p.hp;
    const x0 = p.x;
    w.add(new ShoutRing(w, p.x + 30, p.y, -1));
    let pushed = false;
    for (let t = 0; t < 30; t++) {
      h.step(1);
      if (p.status.has(HERO_STATUS.push)) pushed = true;
    }
    expect(pushed).toBe(true);
    expect(p.x).toBeLessThan(x0 - 10);
    expect(p.hp).toBe(hp);
    expect(p.state).toBe('play');
  });

  it('the squeal stuns (no control) and ends', async () => {
    const { h, p } = await arena();
    stunHero(p);
    expect(p.status.noControl).toBe(true);
    h.step(ACTIVIST_TUNE.stunTicks + 1);
    expect(p.status.has(HERO_STATUS.stun)).toBe(false);
    expect(p.status.noControl).toBe(false);
  });
});

describe('the loper', () => {
  it('runs in, sits with the 40-tick tell and becomes a lijmer (it attacks)', async () => {
    const { h, w, p } = await arena();
    const l = w.spawn(ACTIVIST.loper, p.x + 220, p.y, { enter: 'right', sitAt: p.x + 110, wait: 10, sign: 'KLIMAATNOOD!' }) as Loper;
    const stages: string[] = [];
    let sitT = 0;
    let attacked = false;
    for (let t = 0; t < 600; t++) {
      h.step(1);
      if (stages[stages.length - 1] !== l.stage) stages.push(l.stage);
      if (l.stage === 'sit') sitT++;
      if (l.mode === 'attack') attacked = true;
    }
    expect(stages).toEqual(['walk', 'sit', 'glued']);
    expect(Math.abs(l.x - (p.x + 110))).toBeLessThanOrEqual(2);
    expect(sitT).toBeGreaterThanOrEqual(ACTIVIST_TUNE.sitTell - 1);
    expect(attacked).toBe(true);
  });

  it('hit before the glue sets: drops the banner and runs off (no blood, never removed on the hit)', async () => {
    const { h, w, p } = await arena();
    const l = w.spawn(ACTIVIST.loper, p.x + 160, p.y, { enter: 'right', sitAt: p.x + 60, sign: 'KLIMAATNOOD!' }) as Loper;
    const outs: ActivistOutEvent[] = [];
    w.events.on(ACTIVIST_OUT_EVENT, (e) => outs.push(e));
    h.step(10);
    w.damage(l, { amount: 100, kind: 'bullet', dirX: 1, owner: 0 });
    expect(l.dead).toBe(true);
    expect(l.removed).toBe(false);
    expect(outs).toEqual([{ kind: 'loper', how: 'runoff', entity: l }]);
    let seen = 0;
    for (let t = 0; t < 400 && !l.removed; t++) {
      h.step(1);
      seen++;
    }
    expect(seen).toBeGreaterThan(20);
    expect(l.removed).toBe(true);
  });
});

describe('the bloodless ends and the police', () => {
  it('a beaten ketting: the chain snaps, a police pair walks in, lifts it (carried) and carries it off; the officers are never targets', async () => {
    const { h, w, p } = await arena();
    const k = w.spawn(ACTIVIST.ketting, p.x + 120, p.y, { facing: -1, wait: 400 }) as Ketting;
    const outs: ActivistOutEvent[] = [];
    w.events.on(ACTIVIST_OUT_EVENT, (e) => outs.push(e));
    h.step(4);
    w.damage(k, { amount: 100, kind: 'bullet', dirX: 1, owner: 0 });
    expect(k.removed).toBe(false);
    let agents: Agent[] = [];
    let carried = false;
    for (let t = 0; t < 1500 && !k.removed; t++) {
      h.step(1);
      const a = w.byTag(POLICE_TAG).filter((e): e is Agent => e instanceof Agent && e.job !== null);
      if (a.length) agents = a;
      if (k.carried) carried = true;
    }
    expect(agents.length).toBe(2);
    for (const a of agents) {
      expect(a.team).toBe('neutral');
      expect(a.hasTag('shootable')).toBe(false);
      expect(a.hasTag('enemy')).toBe(false);
    }
    expect(carried).toBe(true);
    expect(outs).toEqual([{ kind: 'ketting', how: 'carried', entity: k }]);
    expect(k.removed).toBe(true);
    h.step(2);
    for (const a of agents) expect(a.removed).toBe(true);
  });

  it('a beaten lijmer rips free (LOS!) and runs off; the megafoon hops off its crate and runs', async () => {
    const { h, w, p } = await arena();
    const l = w.spawn(ACTIVIST.lijmer, p.x + 100, p.y, { facing: -1, wait: 400, sign: 'STOP UITLAATGAS' }) as Activist;
    const m = w.spawn(ACTIVIST.megafoon, p.x + 140, p.y, { facing: -1, wait: 400 }) as Activist;
    const outs: ActivistOutEvent[] = [];
    w.events.on(ACTIVIST_OUT_EVENT, (e) => outs.push(e));
    h.step(4);
    w.damage(l, { amount: 100, kind: 'bullet', dirX: 1, owner: 0 });
    w.damage(m, { amount: 100, kind: 'explosion', dirX: 1, owner: 0 });
    expect(outs.map((o) => `${o.kind}:${o.how}`)).toEqual(['lijmer:runoff', 'megafoon:runoff']);
    expect(l.removed || m.removed).toBe(false);
    for (let t = 0; t < 600 && !(l.removed && m.removed); t++) h.step(1);
    expect(l.removed && m.removed).toBe(true);
    // The planted sign stays on the road (decor).
    expect(w.entities.some((e) => (e as { sprite?: string }).sprite === 'npc/ring/prop/sign-0')).toBe(true);
  });

  it('police at the line stand and are never targets; shots pass through them', async () => {
    const { w } = await arena();
    const line = w.byTag(POLICE_TAG);
    expect(line.length).toBeGreaterThanOrEqual(2);
    for (const a of line) {
      expect(a.team).toBe('neutral');
      expect(a.hasTag('shootable')).toBe(false);
    }
    expect(w.byTag('shootable').some((e) => e.hasTag(POLICE_TAG))).toBe(false);
    expect(POLICE).toBe('ring-agent');
  });

  it('splats and puddles are bright, never red (no blood look)', () => {
    for (const id of ['fx/ring/act/splat', 'fx/ring/act/soup', 'fx/ring/act/glue']) {
      for (const f of getFrames(id, 1)) {
        let red = 0;
        let all = 0;
        for (let i = 0; i < f.buf.data.length; i++) {
          const c = f.buf.data[i];
          if ((c & 0xff) === 0) continue;
          all++;
          const r = (c >>> 24) & 0xff;
          const g = (c >>> 16) & 0xff;
          const b = (c >>> 8) & 0xff;
          if (r > 140 && g < 70 && b < 70) red++;
        }
        expect(red / Math.max(1, all), id).toBeLessThan(0.02);
      }
    }
    expect(Splat).toBeDefined();
  });
});

describe('the in-world continue (never a laugh or a point)', () => {
  it('gloat: the lijmer hums, the ketting and a glued loper hold up the sign, the megafoon eats; cower: hands over the head; no attacks meanwhile', async () => {
    const { h, w, p } = await arena();
    const list = [
      w.spawn(ACTIVIST.lijmer, p.x + 90, p.y, { facing: -1, wait: 5 }),
      w.spawn(ACTIVIST.ketting, p.x + 130, p.y, { facing: -1, wait: 5 }),
      w.spawn(ACTIVIST.megafoon, p.x + 170, p.y, { facing: -1, wait: 5 }),
    ] as Activist[];
    h.step(2);
    for (const a of list) a.react('gloat', 120, p);
    let attacks = 0;
    for (let t = 0; t < 100; t++) {
      h.step(1);
      for (const a of list) if (a.mode === 'tell' || a.mode === 'attack') attacks++;
    }
    expect(attacks).toBe(0);
    for (const a of list) expect(a.anim.id, a.kind).toBe(`${a.art}/gloat`);
    for (const a of list) a.react('cower', 60, p);
    h.step(3);
    for (const a of list) expect(a.anim.id, a.kind).toBe(`${a.art}/cower`);
  });
});

describe('determinism', () => {
  it('two runs of the same blockade give the same trace', async () => {
    const trace = async (): Promise<string> => {
      const { h, w, p } = await arena();
      w.spawn(ACTIVIST.lijmer, p.x + 110, p.y, { facing: -1 });
      w.spawn(ACTIVIST.ketting, p.x + 170, p.y, { facing: -1, anchor: 'partner' });
      w.spawn(ACTIVIST.megafoon, p.x + 80, p.y, { facing: -1 });
      w.spawn(ACTIVIST.loper, p.x + 240, p.y, { enter: 'right' });
      const out: string[] = [];
      for (let t = 0; t < 600; t++) {
        h.step(1);
        if (t % 10 === 0) out.push(w.entities.filter((e) => e instanceof Activist).map((e) => `${(e as Activist).kind}${Math.round(e.x)}:${(e as Activist).mode}`).join(','));
        if (t === 300) for (const e of [...w.entities]) if (e instanceof Activist && !e.dead) w.damage(e, { amount: 100, kind: 'bullet', dirX: 1, owner: 0 });
      }
      h.dispose();
      open = null;
      return out.join('|');
    };
    const a = await trace();
    const b = await trace();
    expect(a.length).toBeGreaterThan(100);
    expect(a).toBe(b);
  });
});

describe('the art (1×, 2×, 4×; geometry is law)', () => {
  const ids = [...listSprites('npc/ring/'), ...listSprites('fx/ring/act/')];

  it('every id has 2× and 4× art and keeps its 1× frame’s logical size, anchor and points', () => {
    expect(ids.length).toBeGreaterThan(100);
    for (const id of ids) {
      expect(hasHiSprite(id, 2) && hasHiSprite(id, 4), id).toBe(true);
      const one = getFrames(id, 1);
      for (const d of [2, 4]) {
        const hd = getFrames(id, d);
        expect(hd.length, `${id} @${d}`).toBe(one.length);
        hd.forEach((f, i) => {
          const b = one[i];
          const k = f.density ?? 1;
          expect(f.buf.w / k, `${id}#${i} @${d} w`).toBe(b.buf.w);
          expect(f.buf.h / k, `${id}#${i} @${d} h`).toBe(b.buf.h);
          expect([f.ox, f.oy], `${id}#${i} @${d} anchor`).toEqual([b.ox, b.oy]);
          expect(f.pts ?? {}, `${id}#${i} @${d} points`).toEqual(b.pts ?? {});
        });
      }
    }
  }, 240_000);

  it('every strip an activist or an officer plays exists', () => {
    const need: Record<string, readonly string[]> = {
      'act-lijmer': ['sit', 'hit', 'tell-lob', 'lob', 'tell-pot', 'pot', 'rip', 'huff', 'flee', 'gloat', 'cower'],
      'act-loper': ['sit', 'tell-lob', 'lob', 'tell-pot', 'pot', 'rip', 'huff', 'gloat', 'cower', 'run', 'stand', 'cower-stand', 'sitdown', 'drop', 'flee'],
      'act-ketting': ['sit', 'hit', 'tell-throw', 'throw', 'snap', 'plank', 'gloat', 'cower'],
      'act-megafoon': ['idle', 'hit', 'tell-shout', 'shout', 'tell-squeal', 'squeal', 'hop', 'flee', 'gloat', 'cower'],
    };
    for (const [k, strips] of Object.entries(need)) for (const look of ['a', 'b']) for (const s of strips) expect(getFrames(`npc/ring/${k}/${look}/${s}`, 1).length, `${k}/${look}/${s}`).toBeGreaterThan(0);
    for (const look of ['a', 'b']) for (const s of ['stand', 'walk', 'lift']) expect(getFrames(`npc/ring/agent/${look}/${s}`, 1).length).toBeGreaterThan(0);
    expect(getFrames('npc/ring/agent/a/carry-front', 1).length).toBe(8);
    expect(getFrames('npc/ring/agent/b/carry-back', 1).length).toBe(8);
  });
});
