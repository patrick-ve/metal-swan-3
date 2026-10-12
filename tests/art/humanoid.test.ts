/** The humanoid rig: anchors, points, determinism and basic geometry. */
import { describe, expect, it } from 'vitest';
import { INK } from '../../src/engine/palette';
import { renderHuman, stackFrames } from '../../src/game/art/humanoid';
import type { HumanStyle, Pose } from '../../src/game/art/humanoid';
import { renderHead } from '../../src/game/art/humanoid-head';
import { PAL } from '../../src/engine/palette';
import * as P from '../../src/game/art/poses';

const STYLE: HumanStyle = {
  skin: 'skinA',
  hair: 'hairB',
  hairStyle: 'short',
  headgear: 'helmet',
  top: 'olive',
  topType: 'vest',
  pants: 'stone',
  boots: 'brown',
  gloves: 'black',
};

function topOf(f: { buf: { trimBounds(): { y: number } | null }; oy: number }): number {
  return (f.buf.trimBounds()?.y ?? 0) - f.oy;
}

describe('humanoid rig', () => {
  it('is deterministic', () => {
    const a = renderHuman(STYLE, { weapon: 'heavy', ...P.RUN[3] });
    const b = renderHuman(STYLE, { weapon: 'heavy', ...P.RUN[3] });
    expect(Array.from(a.buf.data)).toEqual(Array.from(b.buf.data));
    expect(a.pts).toEqual(b.pts);
  });

  it('stands on the ground line with a 1-px INK outline', () => {
    const f = renderHuman(STYLE, P.STAND, 'full');
    const tb = f.buf.trimBounds();
    expect(tb).not.toBeNull();
    // The lowest row (y = −1 relative to the feet anchor) is outline.
    let ink = 0;
    const row = f.oy - 1;
    for (let x = 0; x < f.buf.w; x++) if (f.buf.get(x, row) === INK) ink++;
    expect(ink).toBeGreaterThan(0);
    expect((tb?.y ?? 0) + (tb?.h ?? 0)).toBe(f.oy);
  });

  it('upper frames are anchored at the hip, lower frames carry the hip point', () => {
    const lower = renderHuman(STYLE, P.STAND, 'lower');
    const upper = renderHuman(STYLE, { weapon: 'pistol' }, 'upper');
    expect(lower.pts.hip).toBeDefined();
    expect(upper.pts.muzzle).toBeDefined();
    expect(upper.pts.hand).toBeDefined();
    expect(upper.pts.head).toBeDefined();
    const both = stackFrames(lower, upper);
    const full = renderHuman(STYLE, { ...P.STAND, weapon: 'pistol' }, 'full');
    // Stacking the halves gives the same height as the full figure.
    expect(topOf(both)).toBe(topOf(full));
  });

  it('crouching lowers the hip by about 9 px', () => {
    const stand = renderHuman(STYLE, P.STAND, 'lower').pts.hip?.[1] ?? 0;
    const crouch = renderHuman(STYLE, P.CROUCH, 'lower').pts.hip?.[1] ?? 0;
    expect(crouch - stand).toBeGreaterThanOrEqual(7);
    expect(crouch - stand).toBeLessThanOrEqual(11);
  });

  it('aims the gun forward, up and down', () => {
    const fwd = renderHuman(STYLE, { weapon: 'heavy' }, 'upper').pts.muzzle ?? [0, 0];
    const up = renderHuman(STYLE, { weapon: 'heavy', aim: 'up' }, 'upper').pts.muzzle ?? [0, 0];
    const down = renderHuman(STYLE, { weapon: 'heavy', aim: 'down' }, 'upper').pts.muzzle ?? [0, 0];
    expect(fwd[0]).toBeGreaterThan(15);
    expect(up[1]).toBeLessThan(fwd[1] - 15);
    expect(down[1]).toBeGreaterThan(fwd[1] + 10);
  });

  it('every hair style, headgear and expression renders inside the head grid', () => {
    const hairs = ['short', 'buzz', 'spiky', 'mohawk', 'bald', 'long', 'ponytail', 'bob', 'parted', 'curly', 'puffs', 'tufts'] as const;
    const gears = ['none', 'helmet', 'cap', 'beret', 'beret-slouch', 'bandana', 'goggles', 'hood', 'shako', 'bobble', 'rainhat', 'headset', 'fur-hat'] as const;
    const exprs = ['normal', 'shout', 'panic', 'hurt', 'happy', 'blink', 'yawn', 'chew', 'dazed', 'soot'] as const;
    const base = { skin: PAL.skinA, hair: PAL.hairB, hairStyle: 'short' as const, headgear: 'none' as const, gear: PAL.olive, accent: PAL.red, extras: [] };
    for (const h of hairs) expect(renderHead({ ...base, hairStyle: h }, 'normal').countOpaque()).toBeGreaterThan(60);
    for (const g of gears) {
      const b = renderHead({ ...base, headgear: g }, 'normal');
      // Nothing is clipped at the buffer edges (room for the outline).
      for (let x = 0; x < b.w; x++) expect((b.get(x, 0) & 255) === 0, `${g} top edge`).toBe(true);
    }
    for (const e of exprs) expect(renderHead(base, e).countOpaque()).toBeGreaterThan(60);
  });

  it('lying death frames rest on the ground (no floating corpses)', () => {
    // Gap between the lowest opaque row and the feet anchor: 0 = touching the ground line.
    const gap = (pose: Pose): number => {
      const f = renderHuman(STYLE, pose);
      const b = f.buf.trimBounds();
      return b ? f.oy - (b.y + b.h) : NaN;
    };
    for (const strip of [P.DIE, P.DIE_BLAST, P.DIE_KNIFE]) expect(gap(strip[strip.length - 1])).toBe(0);
    // Every grounded, turned frame touches the ground (dy aside); airborne frames are free.
    for (const strip of [P.DIE, P.DIE_BLAST, P.DIE_KNIFE]) {
      for (const pose of strip) if (pose.grounded !== false && (pose.rot ?? 0) !== 0) expect(gap(pose) + (pose.dy ?? 0)).toBe(0);
    }
  });

  it('builds change the silhouette width', () => {
    const w = (build: 'slim' | 'normal' | 'heavy'): number => renderHuman({ ...STYLE, build }, P.STAND).buf.countOpaque();
    expect(w('slim')).toBeLessThan(w('normal'));
    expect(w('normal')).toBeLessThan(w('heavy'));
  });
});
