/**
 * The humanoid rig at density 2 (2× art, mission ams; docs/ART_GUIDE.md "2x art (mission ams)"):
 * the 2× frame has exactly the 1× frame's logical geometry, its silhouette follows the 1× one,
 * the 1× output does not depend on 2× renders, and every `char/*` sprite of the ten player
 * characters has 2× art that the registry accepts (no fallback to 1×).
 */
import { describe, expect, it } from 'vitest';
import { INK, PAL } from '../../src/engine/palette';
import { PixelBuffer } from '../../src/engine/pixel';
import { frameH, frameW } from '../../src/engine/render';
import { getFrames, hasHiSprite, listSprites, spriteErrors } from '../../src/engine/sprites';
import { despeckle, shadeLayer } from '../../src/game/art/paint';
import { drawHand, gunArt, gunArtHi, heldArtHi, knifeArt, knifeArtHi, propArt, propArtHi } from '../../src/game/art/humanoid-gear';
import { headLayerHi, renderHuman, stackFrames } from '../../src/game/art/humanoid';
import type { HumanStyle, Pose } from '../../src/game/art/humanoid';
import { giftArt, grenadeArt } from '../../src/game/art/humanoid-gear';
import { withPieces } from '../../src/game/art/human-fx';
import { bubble, dustPuff, gumSplat, scarfEnd, sparkle, yarnBall } from '../../src/game/content/characters/pieces';
import * as P from '../../src/game/art/poses';
import { loadContent } from '../../src/game/content/index';

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
  accessories: ['pouches', 'scarf', 'armband', 'backpack', 'bowtie', 'epaulettes', 'ammo-belt', 'satchel', 'needles', 'hivis'],
};

const POSES: ReadonlyArray<[string, Pose, 'full' | 'upper' | 'lower']> = [
  ['stand', P.STAND, 'full'],
  ['run', { ...P.RUN[3], weapon: 'heavy', flutter: 2 }, 'full'],
  ['crouch', { ...P.CROUCH, weapon: 'pistol' }, 'full'],
  ['aim up', { weapon: 'pistol', aim: 'up' }, 'upper'],
  ['diag', { weapon: 'heavy', aim: 'diag-up', recoil: 1 }, 'upper'],
  ['knife', { ...P.KNIFE[2], weapon: 'pistol', gunHand: 'far' }, 'upper'],
  ['throw', { ...P.THROW[1], weapon: 'heavy', gunHand: 'far' }, 'upper'],
  ['prop', { armN: { to: [9, 0] }, held: 'pan', heldAngle: 30 }, 'upper'],
  ['dead', { ...P.DIE[5] }, 'full'],
  ['helium', { weapon: 'pistol', headScale: 2, head: { tilt: 12 } }, 'upper'],
  ['legs', P.RUN[1], 'lower'],
];

describe('humanoid rig at density 2', () => {
  for (const [name, pose, part] of POSES) {
    it(`${name}: same logical geometry, a 2× buffer, a matching silhouette`, () => {
      const lo = renderHuman(STYLE, pose, part);
      const hi = renderHuman(STYLE, pose, part, 2);
      expect(hi.density).toBe(2);
      expect([hi.buf.w, hi.buf.h]).toEqual([lo.buf.w * 2, lo.buf.h * 2]);
      expect([frameW(hi), frameH(hi), hi.ox, hi.oy]).toEqual([lo.buf.w, lo.buf.h, lo.ox, lo.oy]);
      expect(hi.pts).toEqual(lo.pts);
      // Palette only: every pixel opaque or transparent, never blended.
      for (const c of hi.buf.data) expect(c & 255, name).toSatisfy((a: number) => a === 0 || a === 255);
      // The 2× silhouette covers the 1× one: (almost) every opaque 1× pixel has 2× pixels.
      let missing = 0;
      let opaque = 0;
      for (let y = 0; y < lo.buf.h; y++) {
        for (let x = 0; x < lo.buf.w; x++) {
          if ((lo.buf.get(x, y) & 255) === 0) continue;
          opaque++;
          let n = 0;
          for (let k = 0; k < 4; k++) if ((hi.buf.get(x * 2 + (k & 1), y * 2 + (k >> 1)) & 255) !== 0) n++;
          if (n === 0) missing++;
        }
      }
      expect(missing / opaque, name).toBeLessThan(0.01);
    });
  }

  it('is deterministic and leaves the 1× render unchanged', () => {
    const pose: Pose = { ...P.RUN[2], weapon: 'heavy' };
    const before = Array.from(renderHuman(STYLE, pose).buf.data);
    const a = renderHuman(STYLE, pose, 'full', 2);
    const b = renderHuman(STYLE, pose, 'full', 2);
    expect(Array.from(a.buf.data)).toEqual(Array.from(b.buf.data));
    expect(Array.from(renderHuman(STYLE, pose).buf.data)).toEqual(before);
  });

  it('the outline keeps the 1× weight: 2 px of ink round the silhouette', () => {
    const f = renderHuman(STYLE, P.STAND, 'full', 2);
    // The top of the head: the first two opaque rows of the middle column are ink.
    const b = f.buf;
    const x = (f.ox + 1) * 2;
    let y = 0;
    while (y < b.h && (b.get(x, y) & 255) === 0) y++;
    expect(b.get(x, y)).toBe(INK >>> 0);
    expect(b.get(x, y + 1)).toBe(INK >>> 0);
    expect(b.get(x, y + 2)).not.toBe(INK >>> 0);
  });

  it('stacks 2× legs and torso like the 1× frames', () => {
    const legs = renderHuman(STYLE, P.STAND, 'lower', 2);
    const torso = renderHuman(STYLE, { weapon: 'pistol' }, 'upper', 2);
    const lo = stackFrames(renderHuman(STYLE, P.STAND, 'lower'), renderHuman(STYLE, { weapon: 'pistol' }, 'upper'));
    const hi = stackFrames(legs, torso);
    expect(hi.density).toBe(2);
    expect([frameW(hi), frameH(hi), hi.ox, hi.oy]).toEqual([lo.buf.w, lo.buf.h, lo.ox, lo.oy]);
    expect(hi.pts).toEqual(lo.pts);
  });

  it('the head hook falls back to the 1× head until humanoid-head.ts exports renderHeadHi', () => {
    const hs = { skin: PAL.skinA, hair: PAL.hairB, hairStyle: 'short' as const, headgear: 'none' as const, gear: PAL.olive, accent: PAL.red, extras: [] };
    const hi = headLayerHi(hs, 'normal');
    // Either the head module's own 2× head (exactly twice the 1× head) or null (fallback).
    if (hi) expect([hi.w, hi.h]).toEqual([36, 38]);
    else expect(hi).toBeNull();
  });
});

describe('2× gear', () => {
  it('every 2× template is exactly twice its 1× twin', () => {
    for (const k of ['pistol', 'heavy', 'rifle'] as const) expect([gunArtHi(k).w, gunArtHi(k).h]).toEqual([gunArt(k).buf.w * 2, gunArt(k).buf.h * 2]);
    for (const k of ['umbrella', 'needles', 'pan', 'wrench'] as const) expect([propArtHi(k).w, propArtHi(k).h]).toEqual([propArt(k).buf.w * 2, propArt(k).buf.h * 2]);
    expect([knifeArtHi().w, knifeArtHi().h]).toEqual([knifeArt().w * 2, knifeArt().h * 2]);
    expect([heldArtHi('grenade').w, heldArtHi('grenade').h]).toEqual([grenadeArt().w * 2, grenadeArt().h * 2]);
    expect([heldArtHi('gift').w, heldArtHi('gift').h]).toEqual([giftArt().w * 2, giftArt().h * 2]);
  });

  it('2× hands sit on the 1× wrist block in every quarter turn', () => {
    const ramp = PAL.skinA;
    for (const shape of ['fist', 'open', 'point', 'thumb', 'grip'] as const) {
      for (let q = 0; q < 4; q++) {
        const lo = new PixelBuffer(40, 40);
        const hi = new PixelBuffer(80, 80);
        drawHand(lo, shape, 20, 20, ramp, q);
        drawHand(hi, shape, 20, 20, ramp, q, false, 2);
        const a = lo.trimBounds();
        const b = hi.trimBounds();
        // The gun-grip fist is 1 logical px smaller at 2× (1 hi px in from each side), so the
        // gun's grip shows round it; every other hand fills the doubled 1× box.
        const k = shape === 'grip' ? 1 : 0;
        expect([b?.x, b?.y, b?.w, b?.h], `${shape} ${q}`).toEqual([(a?.x ?? 0) * 2 + k, (a?.y ?? 0) * 2 + k, (a?.w ?? 0) * 2 - 2 * k, (a?.h ?? 0) * 2 - 2 * k]);
      }
    }
  });

  it('shading bands and despeckle scale with the density', () => {
    const lo = new PixelBuffer(10, 10).rect(1, 1, 8, 8, PAL.red[2]);
    const hi = new PixelBuffer(20, 20).rect(2, 2, 16, 16, PAL.red[2]);
    shadeLayer(lo, PAL.red);
    shadeLayer(hi, PAL.red, { density: 2 });
    expect(Array.from(hi.downsampled(2).data)).toEqual(Array.from(lo.data));
    // A 2 × 2 speck (one logical pixel) inside a flat area is cleaned at density 2.
    const s = new PixelBuffer(12, 12).rect(0, 0, 12, 12, PAL.red[2]).rect(5, 5, 2, 2, PAL.red[3]);
    despeckle(s, undefined, 2);
    expect(s.get(5, 5)).toBe(PAL.red[2] >>> 0);
  });
});

describe('player characters: 2× art for every char/* sprite', () => {
  it('every char/<hero>/* id has a 2× generator that the registry accepts (no fallback)', async () => {
    await loadContent();
    const ids = listSprites('char/');
    // 95 ids per character: recruit, the squad of five and the four GDD heroes (+ select art).
    expect(ids.length).toBeGreaterThanOrEqual(950);
    for (const hero of ['recruit', 'vincent', 'thom', 'dirk', 'bob', 'patrick', 'grace', 'gramps', 'mittens', 'pip']) expect(ids.some((id) => id.startsWith(`char/${hero}/`)), hero).toBe(true);
    for (const id of ids) {
      expect(hasHiSprite(id), id).toBe(true);
      const lo = getFrames(id, 1);
      const hi = getFrames(id, 2);
      expect(hi.length, id).toBe(lo.length);
      for (let i = 0; i < lo.length; i++) {
        expect(hi[i].density, `${id}[${i}]`).toBe(2);
        expect(hi[i].buf, `${id}[${i}] is not the 1× buffer`).not.toBe(lo[i].buf);
      }
    }
    expect(spriteErrors().filter((e) => e.id.startsWith('char/') && e.id.endsWith('@2x'))).toEqual([]);
  }, 120_000);
});

describe('2× pieces', () => {
  it('withPieces draws the registered 2× twin of a 1× piece on a 2× frame', () => {
    for (const b of [yarnBall(), bubble(0), bubble(1), bubble(2), gumSplat(), scarfEnd(), sparkle(false), sparkle(true), dustPuff(0), dustPuff(1)]) {
      const f = withPieces({ buf: new PixelBuffer(2, 2), ox: 0, oy: 0, density: 2 }, [{ buf: b, x: 0, y: 0 }]);
      expect([f.buf.w, f.buf.h]).toEqual([b.w * 2, b.h * 2]);
      const doubled = b.scaled(2);
      expect(Array.from(f.buf.data).some((c, i) => c !== doubled.data[i])).toBe(true);
      // 1× frames keep the 1× piece exactly.
      const lo = withPieces({ buf: new PixelBuffer(1, 1), ox: 0, oy: 0 }, [{ buf: b, x: 0, y: 0 }]);
      expect(Array.from(lo.buf.data)).toEqual(Array.from(b.data));
    }
  });
});
