/**
 * The squad at 40 px (docs/design/ams40.md wave 2): the baked sets of VINCENT, THOM, DIRK, BOB and
 * PATRICK (src/game/content/art40/<hero>.gen.ts, drawn by tools/art40/chars/_hero/) keep the strip
 * contract of docs/design/ams40/contract.md: every id, the points the code reads, the logic time of
 * every strip the code times, the run that does not slide, the frame constants the player reads.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type { BakedSet } from '../../src/engine/baked';
import { frameCount, getFrames, hasFramesAt, hasSprite, listSprites, spriteAnim, type Frame } from '../../src/engine/sprites';
import { SET as BOB } from '../../src/game/content/art40/bob.gen';
import { SET as DIRK } from '../../src/game/content/art40/dirk.gen';
import { SET as PATRICK } from '../../src/game/content/art40/patrick.gen';
import { SET as THOM } from '../../src/game/content/art40/thom.gen';
import { SET as VINCENT } from '../../src/game/content/art40/vincent.gen';
import { MOUNT_HIP_DROP, SHOOT_WINDOW, THROW_RELEASE } from '../../src/game/player/hero-art';
import { TUNING } from '../../src/game/tuning';

const SETS: ReadonlyArray<[string, BakedSet]> = [
  ['vincent', VINCENT],
  ['thom', THOM],
  ['dirk', DIRK],
  ['bob', BOB],
  ['patrick', PATRICK],
];
// The menu portrait and the three select40 portrait strips (docs/design/select40.md).
const UI = ['portrait', 'select', 'select-grey', 'select-pick'];

beforeAll(async () => {
  await import('../../src/game/content/characters/art');
  await import('../../src/game/content/characters/select.art');
});

const ticks = (id: string): number[] => {
  const a = spriteAnim(id);
  return a.durations ? [...a.durations] : Array<number>(frameCount(id)).fill(a.ticksPerFrame);
};
const sum = (a: readonly number[]): number => a.reduce((x, y) => x + y, 0);
const pt = (f: Frame, n: string): readonly [number, number] => {
  const p = f.pts?.[n];
  expect(p, n).toBeDefined();
  return p as readonly [number, number];
};
/** The lowest opaque row relative to the anchor (0 = standing on the line). */
const bottom = (f: Frame): number => {
  const b = f.buf.trimBounds();
  return b ? b.y + b.h - f.oy : 0;
};

const SHOOT = ['shoot', 'shoot-up', 'shoot-down', 'shoot-diag-up', 'crouch-shoot'];
const TORSO_ACTIONS = ['idle', 'shoot', 'up', 'shoot-up', 'down', 'shoot-down', 'diag-up', 'shoot-diag-up', 'diag-down', 'throw', 'knife', 'run', 'crouch', 'crouch-shoot', 'crouch-throw', 'crouch-knife', 'knife-b'];

describe.each(SETS)('%s at 40 px', (hero, set) => {
  const P = `char/${hero}/`;

  it('every contract id: 118 baked strips + the 4 UI pictures; 1× pixels only (rule 7)', () => {
    expect(Object.keys(set.strips).length).toBe(118);
    const ids = listSprites(P);
    expect(ids.length).toBe(118 + UI.length);
    for (const n of UI) expect(hasSprite(P + n), n).toBe(true);
    for (const n of Object.keys(set.strips)) {
      expect(hasSprite(P + n), n).toBe(true);
      expect(hasFramesAt(P + n, 2), `${n} has no 2× art`).toBe(false);
    }
    expect(set.budget).toBe(28);
  });

  it('the frame constants the player reads are the same for every hero', () => {
    expect(set.events).toEqual({ THROW_RELEASE, SHOOT_WINDOW, MOUNT_HIP_DROP });
  });

  it('legs: every frame has its hip; the standing legs stand on the line', () => {
    for (const n of ['idle', 'run', 'jump', 'fall', 'land', 'crouch', 'crouch-walk', 'dangle', 'crouch-in', 'crouch-out']) {
      for (const f of getFrames(`${P}legs-${n}`)) pt(f, 'hip');
    }
    for (const n of ['idle', 'crouch', 'crouch-walk', 'land', 'crouch-in', 'crouch-out']) {
      for (const f of getFrames(`${P}legs-${n}`)) expect(bottom(f), n).toBe(0);
    }
  });

  it('run: 12 frames, 36 ticks (54 px at 1.5 px/tick), the planted foot drifts at most 1 px', () => {
    const id = `${P}legs-run`;
    expect(frameCount(id)).toBe(12);
    const d = ticks(id);
    expect(sum(d)).toBe(36);
    for (const w of ['pistol', 'heavy']) expect(frameCount(`${P}torso-${w}-run`)).toBe(12);
    const speed = TUNING.player.runSpeed;
    const fs = getFrames(id);
    // World x of the plant point: the frame's own x plus the distance run so far.
    let t = 0;
    const runs: number[][] = [];
    let cur: number[] | null = null;
    fs.forEach((f, i) => {
      const p = f.pts?.plant;
      if (p) {
        cur ??= [];
        cur.push(p[0] + speed * t);
      } else if (cur) {
        runs.push(cur);
        cur = null;
      }
      t += d[i];
      // a strip-wide sanity check: a frame on the floor carries a plant point
      if (bottom(f) === 0) expect(p, `run frame ${i} on the floor has a plant`).toBeDefined();
    });
    if (cur) runs.push(cur);
    expect(runs.length).toBeGreaterThanOrEqual(2);
    for (const r of runs) expect(Math.max(...r) - Math.min(...r)).toBeLessThanOrEqual(1);
  });

  it('crouch walk: the planted foot keeps up with 0.75 px/tick', () => {
    const id = `${P}legs-crouch-walk`;
    const d = ticks(id);
    let t = 0;
    const xs: number[] = [];
    getFrames(id).forEach((f, i) => {
      const p = f.pts?.plant;
      if (p && i < 4) xs.push(p[0] + TUNING.player.crawlSpeed * t);
      t += d[i];
    });
    expect(xs.length).toBeGreaterThanOrEqual(3);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThanOrEqual(1);
  });

  it('torsos: the muzzle on every aim and shoot frame 0; the shot window, then the settle tail', () => {
    for (const w of ['pistol', 'heavy']) {
      for (const a of TORSO_ACTIONS) {
        const id = `${P}torso-${w}-${a}`;
        expect(hasSprite(id), id).toBe(true);
        for (const f of getFrames(id)) pt(f, 'hand');
      }
      for (const a of ['idle', 'up', 'down', 'diag-up', 'diag-down', ...SHOOT]) pt(getFrames(`${P}torso-${w}-${a}`)[0], 'muzzle');
      for (const a of [...SHOOT, ...(w === 'heavy' ? ['shoot-diag-down'] : [])]) {
        const id = `${P}torso-${w}-${a}`;
        const d = ticks(id);
        expect(sum(d.slice(0, SHOOT_WINDOW)), `${id} window`).toBe(TUNING.fire.shootAnimTicks * 2);
        expect(d.length, id).toBeGreaterThan(SHOOT_WINDOW);
        expect(spriteAnim(id).loop).toBe(false);
      }
      // The diagonal muzzle sits between the forward and the up muzzle.
      const m = (a: string): readonly [number, number] => pt(getFrames(`${P}torso-${w}-${a}`)[0], 'muzzle');
      const [fwd, up, diag] = [m('shoot'), m('shoot-up'), m('shoot-diag-up')];
      expect(diag[0]).toBeGreaterThan(up[0]);
      expect(diag[1]).toBeLessThan(fwd[1]);
      expect(diag[1]).toBeGreaterThan(up[1]);
    }
    expect(hasSprite(`${P}torso-pistol-shoot-diag-down`)).toBe(false);
  });

  it('knife 14 ticks; throw: the release frame by data is THROW_RELEASE, 12-14 ticks from it', () => {
    for (const w of ['pistol', 'heavy']) {
      for (const a of ['knife', 'knife-b', 'crouch-knife']) expect(sum(ticks(`${P}torso-${w}-${a}`)), `${w} ${a}`).toBe(TUNING.fire.knifeTicks);
      for (const a of ['throw', 'crouch-throw']) {
        const id = `${P}torso-${w}-${a}`;
        const fs = getFrames(id);
        let best = 0;
        fs.forEach((f, i) => {
          const h = pt(f, 'hand');
          const b = pt(fs[best], 'hand');
          if (h[0] - h[1] > b[0] - b[1]) best = i;
        });
        expect(best, id).toBe(THROW_RELEASE);
        const after = sum(ticks(id).slice(best));
        expect(after, id).toBeGreaterThanOrEqual(12);
        expect(after, id).toBeLessThanOrEqual(14);
      }
    }
  });

  it('full-body strips keep their logic time', () => {
    const T: Record<string, number> = {
      die: 74, 'die-blast': 50, 'die-burn': 86, 'die-drown': 60, 'die-flat': 47, spawn: 24, flip: 28,
      'mount-hop': 16, salute: 68, 'timeout-yawn': 64, 'timeout-sleep': 48,
    };
    for (const [n, t] of Object.entries(T)) expect(sum(ticks(P + n)), n).toBe(t);
    for (const n of ['die', 'die-blast', 'die-burn', 'spawn', 'flip', 'mount-hop', 'salute', 'timeout-yawn']) expect(spriteAnim(P + n).loop, n).toBe(false);
    pt(getFrames(P + 'timeout-sleep')[0], 'head');
    // The last death frame lies on the floor (never under it).
    const die = getFrames(P + 'die');
    expect(bottom(die[die.length - 1])).toBe(0);
  });

  it('mount: two seated frames, frame 1 hip at (0, -MOUNT_HIP_DROP), frame 0 hand up; the hop lands its hip', () => {
    const m = getFrames(P + 'mount');
    expect(m.length).toBe(2);
    expect(pt(m[1], 'hip')).toEqual([0, -MOUNT_HIP_DROP]);
    expect(pt(m[0], 'hand')[1]).toBeLessThan(pt(m[1], 'hand')[1]);
    const hop = getFrames(P + 'mount-hop');
    pt(hop[hop.length - 1], 'hip');
  });

  it('the nine Swan rider poses: head and hand, the 2-frame poses the Swan picks as 0 / 1', () => {
    const N: Record<string, number> = { sit: 2, lean: 2, up: 1, hunch: 1, hold: 2, brace: 1, duck: 1, ears: 2, cheer: 2 };
    for (const [n, k] of Object.entries(N)) {
      const fs = getFrames(`${P}ride-${n}`);
      expect(fs.length, n).toBe(k);
      for (const f of fs) {
        pt(f, 'head');
        pt(f, 'hand');
      }
    }
  });

  it('Helium Head twins: the same roles as the base strips; the wobble is the same drawing 1 px down and forward', () => {
    const tw = Object.keys(set.strips).filter((n) => n.startsWith('helium-') && !n.startsWith('helium-wob-'));
    expect(tw.length).toBe(24);
    for (const n of tw) {
      const base = n.slice('helium-'.length);
      const shoot = /-shoot/.test(base);
      expect(frameCount(P + n), n).toBe(shoot ? SHOOT_WINDOW : frameCount(P + base));
      if (shoot) expect(sum(ticks(P + n)), n).toBe(TUNING.fire.shootAnimTicks * 2);
      else expect(sum(ticks(P + n)), n).toBe(sum(ticks(P + base)));
      const wob = `${P}helium-wob-${base}`;
      expect(frameCount(wob), wob).toBe(frameCount(P + n));
      if (base.startsWith('torso-')) {
        const a = getFrames(P + n)[0];
        const b = getFrames(wob)[0];
        expect([b.ox, b.oy]).toEqual([a.ox - 1, a.oy - 1]);
      }
    }
    // The balloon head stands well above the normal one.
    const top = (id: string): number => getFrames(id)[0].buf.trimBounds()!.y - getFrames(id)[0].oy;
    expect(top(`${P}torso-pistol-idle`) - top(`${P}helium-torso-pistol-idle`)).toBeGreaterThanOrEqual(8);
  });
});

describe('the squad side by side', () => {
  const height = (h: string): number => {
    const legs = getFrames(`char/${h}/legs-idle`)[0];
    const torso = getFrames(`char/${h}/torso-pistol-idle`)[0];
    return -(pt(legs, 'hip')[1] + torso.buf.trimBounds()!.y - torso.oy);
  };

  it('stand about 42 px tall (plan: 40-43 px); Thom is the shortest', () => {
    for (const [h] of SETS) {
      expect(height(h), h).toBeGreaterThanOrEqual(40);
      expect(height(h), h).toBeLessThanOrEqual(44);
    }
    for (const [h] of SETS.filter(([x]) => x !== 'thom')) expect(height('thom'), h).toBeLessThan(height(h));
  });

  it('look different: their own palettes', () => {
    const pals = SETS.map(([, s]) => s.pal.join(','));
    expect(new Set(pals).size).toBe(SETS.length);
  });
});
