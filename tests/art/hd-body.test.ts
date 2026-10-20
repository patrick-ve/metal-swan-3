/**
 * The HD rig body (src/game/art/hd/body.ts; docs/ART_GUIDE.md "UHD art"): `renderHuman(…, d)` at
 * d 2 and 4 draws every pose natively with the 1× frame's logical geometry (geometry is law), the
 * HD palette, outline A (d px of ink), joints at 1 / d px, feet on the ground line; the hero
 * strips are registered at 2× and 4× (one generator), split into pool families, with no new
 * duplicate frames; the 1× art and the motion gate's solve are unchanged.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { familyOf } from '../../src/engine/art-pool';
import { PAL } from '../../src/engine/palette';
import { PAL_HD, hdRampOf, inHdPalette } from '../../src/engine/palette-hd';
import type { PixelBuffer } from '../../src/engine/pixel';
import { frameH, frameW, type Frame } from '../../src/engine/render';
import { getFrames, hasHiSprite, listSprites, spriteErrors } from '../../src/engine/sprites';
import { spanOf } from '../../src/game/art/hd/body';
import { BLACK_ONE_HUE } from '../../src/game/art/hd/light';
import { HD_FIT, HD_MEMO, HELIUM_RIM, TIGHT_1X, clearHumanHdMemo, poseJoints, renderHuman, renderHumanFullCanvas, type HumanStyle, type Pose, type RenderPart } from '../../src/game/art/humanoid';
import * as P from '../../src/game/art/poses';
import { HERO_STYLES, RECRUIT_STYLE } from '../../src/game/content/characters/art';
import { duplicateFrames } from './motion';

const INK_HD = PAL_HD.ink[0] >>> 0;

/** Every top type, build and accessory of the rig in a handful of styles. */
const STYLES: Readonly<Record<string, HumanStyle>> = {
  recruit: RECRUIT_STYLE,
  kit: {
    skin: 'skinB',
    hair: 'hairA',
    hairStyle: 'curly',
    headgear: 'helmet',
    top: 'olive',
    topType: 'vest',
    pants: 'stone',
    boots: 'brown',
    gloves: 'black',
    build: 'heavy',
    accessories: ['pouches', 'scarf', 'armband', 'backpack', 'radio', 'bowtie', 'epaulettes', 'ammo-belt', 'satchel', 'needles', 'hivis'],
  },
  coat: { skin: 'skinC', hair: 'hairC', hairStyle: 'bob', headgear: 'none', top: 'navy', topType: 'coat', pants: 'slate', boots: 'black', build: 'lanky', accessories: ['cape', 'tie', 'cross-belt', 'toolbelt'] },
  tunic: { skin: 'skinA', hair: 'hairB', hairStyle: 'short', headgear: 'none', top: 'red', topType: 'tunic', pants: 'navy', boots: 'black', build: 'slim', accessories: ['tweed'] },
  sweater: { skin: 'skinA', hair: 'rust', hairStyle: 'short', headgear: 'bobble', top: 'red', topType: 'sweater', pants: 'stone', boots: 'brown', gloves: 'red', build: 'stocky' },
  tank: { skin: 'skinB', hair: 'hairA', hairStyle: 'buzz', headgear: 'none', top: 'teal', topType: 'tank', pants: 'navy', boots: 'brown', build: 'normal' },
  shirt: { skin: 'skinA', hair: 'hairB', hairStyle: 'short', headgear: 'none', top: 'snow', topType: 'shirt', pants: 'olive', boots: 'black', build: 'normal' },
  ...HERO_STYLES,
};

const POSES: ReadonlyArray<[string, Pose, RenderPart]> = [
  ['stand', P.STAND, 'full'],
  ['legs', P.STAND, 'lower'],
  ['run', { ...P.RUN[3], weapon: 'heavy', flutter: 2 }, 'full'],
  ['run-legs', P.RUN[6], 'lower'],
  ['crouch', { ...P.CROUCH, weapon: 'pistol' }, 'full'],
  ['aim up', { weapon: 'pistol', aim: 'up' }, 'upper'],
  ['diag', { weapon: 'heavy', aim: 'diag-up', recoil: 1 }, 'upper'],
  ['akimbo', { weapon: 'pistol', offhand: 'pistol' }, 'upper'],
  ['rifle', { weapon: 'rifle', lowGun: true }, 'upper'],
  ['knife', { ...P.KNIFE[2], weapon: 'pistol', gunHand: 'far' }, 'upper'],
  ['throw', { ...P.THROW[1], weapon: 'heavy', gunHand: 'far', held: 'grenade' }, 'upper'],
  ['prop', { armN: { to: [9, 0] }, held: 'pan', heldAngle: 30 }, 'upper'],
  ['snack', { armN: { to: [6, -4], hand: 'grip' }, held: 'snack', expr: 'chew' }, 'upper'],
  ['dead', { ...P.DIE[5] }, 'full'],
  ['tumble', { ...P.STAND, rot: 135, grounded: false }, 'full'],
  ['helium', { weapon: 'pistol', headScale: 2, head: { tilt: 12 } }, 'upper'],
];

function geometry(f: Frame): string {
  return `${frameW(f)}x${frameH(f)}@${f.ox},${f.oy}|${JSON.stringify(f.pts ?? {})}`;
}

/** Share of the 1× opaque px with no opaque px in their d × d block at density d. */
function missing(lo: PixelBuffer, hi: PixelBuffer, d: number): number {
  let miss = 0;
  let n = 0;
  for (let y = 0; y < lo.h; y++) {
    for (let x = 0; x < lo.w; x++) {
      if ((lo.get(x, y) & 255) === 0) continue;
      n++;
      let any = false;
      for (let k = 0; k < d * d && !any; k++) if ((hi.get(x * d + (k % d), y * d + Math.floor(k / d)) & 255) !== 0) any = true;
      if (!any) miss++;
    }
  }
  return miss / Math.max(1, n);
}

describe('HD body: every pose at 2× and 4×', () => {
  for (const [sn, style] of Object.entries(STYLES)) {
    it(`${sn}: the 1× geometry, HD palette, the 1× silhouette, outline A`, () => {
      for (const [pn, pose, part] of POSES) {
        const lo = renderHuman(style, pose, part);
        for (const d of [2, 4] as const) {
          const f = renderHuman(style, pose, part, d);
          const tag = `${sn} ${pn} @${d}x`;
          expect(f.density, tag).toBe(d);
          expect([f.buf.w, f.buf.h], tag).toEqual([lo.buf.w * d, lo.buf.h * d]);
          expect(geometry(f), tag).toBe(geometry(lo));
          let off = 0;
          for (const c of f.buf.data) if ((c & 255) !== 0 && ((c & 255) !== 255 || !inHdPalette(c))) off++;
          expect(off, `${tag}: px outside PAL_HD`).toBe(0);
          expect(missing(lo.buf, f.buf, d), `${tag}: 1× px not covered`).toBeLessThan(0.03);
        }
      }
    });
  }

  it('outline A: d px of ink on top of the head at 2× and 4×', () => {
    for (const d of [2, 4] as const) {
      const f = renderHuman(RECRUIT_STYLE, P.STAND, 'full', d);
      const x = (f.ox + (f.pts.head?.[0] ?? 0)) * d + (d >> 1);
      let y = 0;
      while (y < f.buf.h && (f.buf.get(x, y) & 255) === 0) y++;
      for (let k = 0; k < d; k++) expect(f.buf.get(x, y + k) >>> 0, `@${d}x row ${k}`).toBe(INK_HD);
      expect(f.buf.get(x, y + d) >>> 0, `@${d}x under the outline`).not.toBe(INK_HD);
    }
  });

  it('grounded figures stand on the ground line: the outline under the soles is the last row', () => {
    for (const [pose, part] of [[P.STAND, 'full'], [P.STAND, 'lower'], [P.RUN[2], 'lower'], [P.CROUCH, 'lower'], [P.CROUCH_WALK[3], 'lower']] as const) {
      const lo = renderHuman(RECRUIT_STYLE, pose, part);
      for (const d of [2, 4] as const) {
        const f = renderHuman(RECRUIT_STYLE, pose, part, d);
        // The 1× frame ends on the ground line (feet anchor) and so does the HD one.
        expect(lo.oy, 'feet anchor').toBe(lo.buf.h);
        const last = f.buf.h - 1;
        let ink = 0;
        let other = 0;
        for (let x = 0; x < f.buf.w; x++) {
          const c = f.buf.get(x, last);
          if ((c & 255) === 0) continue;
          if (c >>> 0 === INK_HD) ink++;
          else other++;
        }
        expect(ink, `@${d}x soles on the ground`).toBeGreaterThan(0);
        expect(other, `@${d}x nothing below the outline`).toBe(0);
      }
    }
  });

  it('joints at 1 / d px: a quarter-px move shifts the 4× figure by about one art px', () => {
    /** Centre of mass x of the opaque px, logical px from the anchor. */
    const com = (f: Frame): number => {
      const d = f.density ?? 1;
      let sx = 0;
      let n = 0;
      for (let y = 0; y < f.buf.h; y++) {
        for (let x = 0; x < f.buf.w; x++) {
          if ((f.buf.get(x, y) & 255) === 0) continue;
          sx += x + 0.5;
          n++;
        }
      }
      return sx / n / d - f.ox;
    };
    for (const pose of [P.STAND, P.RUN[1]]) {
      const a = renderHuman(RECRUIT_STYLE, pose, 'lower', 4);
      const b = renderHuman(RECRUIT_STYLE, { ...pose, dx: 0.25 }, 'lower', 4);
      const shift = com(b) - com(a);
      expect(shift).toBeGreaterThan(0.12);
      expect(shift).toBeLessThan(0.4);
    }
  });

  it('the 4× frame is drawn natively, not the 2× frame doubled', () => {
    const f2 = renderHuman(RECRUIT_STYLE, P.STAND, 'full', 2);
    const f4 = renderHuman(RECRUIT_STYLE, P.STAND, 'full', 4);
    const up = f2.buf.scaled(2);
    let diff = 0;
    for (let i = 0; i < up.data.length; i++) if (up.data[i] !== f4.buf.data[i]) diff++;
    expect(diff / up.data.length).toBeGreaterThan(0.2);
  });

  it('lit materials: 5+ tones of the trousers and the vest at 4×, the deepest and lightest ends used', () => {
    const f = renderHuman(RECRUIT_STYLE, P.STAND, 'full', 4);
    for (const ramp of [PAL_HD.stone, PAL_HD.olive]) {
      const used = new Set<number>();
      for (const c of f.buf.data) {
        const i = ramp.indexOf(c >>> 0);
        if (i >= 0) used.add(i);
      }
      expect(used.size).toBeGreaterThanOrEqual(5);
    }
  });

  it('the Helium Head: the head at 2× size with a pink rim at 2× and 4×', () => {
    for (const d of [2, 4] as const) {
      const big = renderHuman(RECRUIT_STYLE, { weapon: 'pistol', headScale: 2 }, 'upper', d);
      const plain = renderHuman(RECRUIT_STYLE, { weapon: 'pistol' }, 'upper', d);
      let pink = 0;
      for (const c of big.buf.data) if (c >>> 0 === HELIUM_RIM >>> 0) pink++;
      expect(pink, `@${d}x`).toBeGreaterThan(40 * d);
      expect(big.buf.countOpaque(), `@${d}x a bigger head`).toBeGreaterThan(plain.buf.countOpaque() * 1.4);
    }
  });

  it('is deterministic and leaves the 1× render unchanged; a fresh module draws the same bytes', async () => {
    const pose: Pose = { ...P.RUN[2], weapon: 'heavy' };
    const before = Array.from(renderHuman(RECRUIT_STYLE, pose).buf.data);
    const a = renderHuman(RECRUIT_STYLE, pose, 'full', 4);
    const b = renderHuman(RECRUIT_STYLE, pose, 'full', 4);
    expect(Array.from(b.buf.data)).toEqual(Array.from(a.buf.data));
    expect(Array.from(renderHuman(RECRUIT_STYLE, pose).buf.data)).toEqual(before);
    vi.resetModules();
    const fresh = await import('../../src/game/art/humanoid');
    const art = await import('../../src/game/content/characters/art');
    const c = fresh.renderHuman(art.RECRUIT_STYLE, pose, 'full', 4);
    expect(Array.from(c.buf.data)).toEqual(Array.from(a.buf.data));
  });

  it('the HD render memo (a repeated pose) gives a private copy of the same pixels as a fresh render', () => {
    const pose: Pose = { ...P.KNIFE[1], weapon: 'pistol', gunHand: 'far' };
    for (const d of [2, 4] as const) {
      clearHumanHdMemo();
      const a = renderHuman(RECRUIT_STYLE, pose, 'upper', d);
      const hits = HD_MEMO.hits;
      const b = renderHuman(RECRUIT_STYLE, { ...pose }, 'upper', d);
      expect(HD_MEMO.hits, `@${d}x memo hit`).toBe(hits + 1);
      expect(b.buf).not.toBe(a.buf);
      expect(Array.from(b.buf.data)).toEqual(Array.from(a.buf.data));
      expect([b.ox, b.oy, b.density, b.pts]).toEqual([a.ox, a.oy, a.density, a.pts]);
      // A caller that paints on its frame does not change the next copy.
      b.buf.data.fill(0);
      const c = renderHuman(RECRUIT_STYLE, pose, 'upper', d);
      expect(Array.from(c.buf.data)).toEqual(Array.from(a.buf.data));
      // Another style, part or density is never served from the memo.
      expect(Array.from(renderHuman(HERO_STYLES.patrick, pose, 'upper', d).buf.data)).not.toEqual(Array.from(a.buf.data));
      clearHumanHdMemo();
      expect(Array.from(renderHuman(RECRUIT_STYLE, pose, 'upper', d).buf.data)).toEqual(Array.from(a.buf.data));
    }
  });

  it('style ramps keep their value span (black stays black, a dark custom ramp stays dark)', () => {
    const black = spanOf(PAL.black);
    // Black leather runs on the one-hue black ramp (no purple / blue patches; polish wave).
    expect(black.ramp).toBe(BLACK_ONE_HUE);
    expect(black.hi).toBeLessThanOrEqual(4);
    const dark = spanOf([PAL.olive[0], PAL.olive[1], PAL.olive[2]]);
    expect(dark.ramp).toBe(hdRampOf(PAL.olive));
    expect(dark.hi).toBeLessThanOrEqual(4);
    const sand = spanOf(PAL.sand);
    expect(sand.hi - sand.lo).toBeGreaterThanOrEqual(3);
  });

  it('the motion gate solve is unchanged (poseJoints is the 1× solve)', () => {
    const j = poseJoints(RECRUIT_STYLE, P.STAND);
    expect(j.pelvis).toEqual([0, -16]);
    expect(j.neck).toEqual([0, -25]);
    expect(j.kneeN[0]).toBeCloseTo(2.052, 3);
    expect(j.ankleF[1]).toBeCloseTo(-4.84, 3);
    expect(j.wrN[0]).toBeCloseTo(3.529, 3);
    const r = poseJoints(RECRUIT_STYLE, { ...P.RUN[3], weapon: 'pistol' });
    expect(r.ankleN[0]).toBeCloseTo(-7.596, 3);
    expect(r.wrN).toEqual([8, -20]);
  });
});

describe('HD hero strips (registry, pool families, duplicates)', () => {
  beforeAll(async () => {
    await import('../../src/game/content/characters/art');
  });

  it('every strip of every hero has 2× and 4× art (the squad\'s menu portraits and select images too)', () => {
    const ids = listSprites('char/');
    expect(ids.length).toBeGreaterThan(1000);
    for (const id of ids) {
      expect(hasHiSprite(id, 2), id).toBe(true);
      // The squad's select busts and menu portraits have 4× art (polish wave); the retired
      // heroes' menu art stays 2×.
      const menu = /\/(portrait|select(-grey)?)$/.test(id);
      const squad = /^char\/(vincent|thom|dirk|bob|patrick)\//.test(id);
      expect(hasHiSprite(id, 4), id).toBe(!menu || squad);
    }
  });

  it('patrick at 4×: every strip, the 1× frame counts and geometry, no fallback, slivers trimmed only', () => {
    HD_FIT.maxTrimPx = 0;
    for (const id of listSprites('char/patrick/')) {
      if (!hasHiSprite(id, 4)) continue;
      const lo = getFrames(id, 1);
      const hi = getFrames(id, 4);
      expect(hi.length, id).toBe(lo.length);
      for (let i = 0; i < lo.length; i++) {
        expect(hi[i].density, `${id}[${i}]`).toBe(4);
        expect(geometry(hi[i]), `${id}[${i}]`).toBe(geometry(lo[i]));
      }
    }
    expect(spriteErrors().filter((e) => e.id.startsWith('char/patrick/'))).toEqual([]);
    // What the fit trims (art spilling past the 1× rectangle) stays a sliver.
    expect(HD_FIT.maxTrimPx).toBeLessThan(400);
  }, 120_000);

  it('no identical consecutive frames at 2× or 4× that the 1× strip does not have', () => {
    for (const id of listSprites('char/recruit/').filter((x) => hasHiSprite(x, 4))) {
      const one = new Set(duplicateFrames(id, 1));
      for (const d of [2, 4]) for (const i of duplicateFrames(id, d)) expect(one.has(i), `${id} @${d}x frames ${i}, ${i + 1}`).toBe(true);
    }
  }, 120_000);

  it('a hero spreads over at least 6 pool families (legs, torsos, Helium twins, rides, the rest)', () => {
    const fams = new Set(listSprites('char/recruit/').map(familyOf));
    expect(fams.size).toBeGreaterThanOrEqual(6);
    expect(familyOf('char/recruit/legs-run')).toBe('char/recruit/legs');
    expect(familyOf('char/recruit/torso-pistol-idle')).toBe('char/recruit/torso-pistol');
    expect(familyOf('char/recruit/helium-wob-torso-heavy-up')).toBe('char/recruit/helium-wob');
    expect(familyOf('char/recruit/die')).toBe('char/recruit');
    // A pair set builds with its solo set (shared rider and bike parts; the cast request).
    expect(familyOf('enemy/fatbike-youth-pair-0a/ride')).toBe('enemy/fatbike-youth');
  });
});

describe('1× render on a tight working region', () => {
  // The 1× painter costs its canvas area, so renderHuman paints a 1× figure on a tight region
  // around it (origin a multiple of 8) and falls back to the full 112 × 112 canvas when the figure
  // nears the region's border. The pixels, anchor and points must be exactly the full canvas's.
  const same = (style: HumanStyle, pose: Pose, part: RenderPart, label: string): void => {
    const a = renderHuman(style, pose, part, 1);
    const b = renderHumanFullCanvas(style, pose, part);
    expect([a.buf.w, a.buf.h, a.ox, a.oy], label).toEqual([b.buf.w, b.buf.h, b.ox, b.oy]);
    expect(a.pts ?? {}, label).toEqual(b.pts ?? {});
    expect(a.buf.data.every((c, i) => c === b.buf.data[i]), `${label} pixels`).toBe(true);
  };

  it('gives the full canvas pixels for every hero: strips, weapons, aims, held items, the Helium Head, turns', () => {
    const lists = Object.entries(P).filter((e): e is [string, readonly Pose[]] => Array.isArray(e[1]) && e[1].every((x) => typeof x === 'object' && x !== null));
    expect(lists.length).toBeGreaterThan(20);
    const before = { ...TIGHT_1X };
    for (const [hero, style] of Object.entries(HERO_STYLES)) {
      for (const [name, poses] of lists) poses.forEach((pose, i) => same(style, pose, 'full', `${hero} ${name}[${i}]`));
      for (const weapon of ['pistol', 'heavy', 'rifle'] as const) {
        for (const aim of ['fwd', 'up', 'down', 'diag-up', 'diag-down'] as const) {
          same(style, { ...P.STAND, weapon, aim }, 'upper', `${hero} ${weapon} ${aim}`);
          same(style, { ...P.STAND, weapon, aim, headScale: 2 }, 'upper', `${hero} ${weapon} ${aim} helium`);
        }
      }
      same(style, { ...P.STAND, weapon: 'pistol', offhand: 'pistol' }, 'upper', `${hero} offhand`);
      for (const held of ['grenade', 'knife', 'snack', 'gift', 'umbrella', 'needles', 'pan', 'wrench', 'plan', 'pistol-butt', 'plunger', 'airliner', 'frikandel'] as const) {
        same(style, { ...P.STAND, weapon: 'none', held }, 'full', `${hero} held ${held}`);
      }
      for (const rot of [-90, -35, 20, 90, 180]) same(style, { ...P.STAND, rot }, 'full', `${hero} rot ${rot}`);
      for (const pose of P.RUN) same(style, pose, 'lower', `${hero} legs`);
    }
    // Most renders take the tight region; some fall back to the full canvas.
    expect(TIGHT_1X.tight - before.tight).toBeGreaterThan(TIGHT_1X.full - before.full);
  }, 120_000);
});
