/**
 * The squad's portraits (docs/design/squad.md §2.2): `char/<id>/select` (64 × 120, 2×: 128 × 240),
 * `char/<id>/select-grey` (steel / stone grey only) and `char/<id>/portrait` (32 × 32, 2×: 64 × 64)
 * for the five friends: sizes, top-left anchors, palette-only pixels, five distinct faces, the
 * portrait hook winning over the rig's default portrait, and clean high-score head icons.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type { Color } from '../../src/engine/color';
import { INK, inPalette, PAL } from '../../src/engine/palette';
import type { PixelBuffer } from '../../src/engine/pixel';
import { getFrames, spriteErrors } from '../../src/engine/sprites';
import { GREY } from '../../src/game/art/portrait-kit';
import { SQUAD, selectPortrait, smallPortrait } from '../../src/game/content/characters/select.art';
import { defineCharacter, hasCharacter } from '../../src/game/registry';
import { headIcon } from '../../src/game/scenes/heads';

beforeAll(async () => {
  await import('../../src/game/content/characters/index');
  // The heroes' art registers the rig's default portrait first, then the PORTRAITS hook.
  await import('../../src/game/content/characters/art');
  // The head icons need the characters; stand-ins only while the roster lacks one.
  for (const id of SQUAD) if (!hasCharacter(id)) defineCharacter({ id, name: id.toUpperCase(), art: `char/${id}` });
});

const SIZES: ReadonlyArray<readonly [string, number, number]> = [
  ['select', 64, 120],
  ['select-grey', 64, 120],
  ['portrait', 32, 32],
];

/** Every pixel of a buffer (as unsigned colours). */
function colours(b: PixelBuffer): Set<Color> {
  return new Set(Array.from(b.data, (c) => c >>> 0));
}

describe('squad portraits', () => {
  it('every id exists with the exact size at 1× and 2×, anchored top-left', () => {
    for (const id of SQUAD) {
      for (const [part, w, h] of SIZES) {
        const sid = `char/${id}/${part}`;
        const f1 = getFrames(sid, 1);
        const f2 = getFrames(sid, 2);
        expect(spriteErrors().filter((e) => e.id.startsWith(sid)), sid).toEqual([]);
        expect(f1.length, sid).toBe(1);
        expect(f2.length, `${sid}@2x`).toBe(1);
        expect([f1[0].buf.w, f1[0].buf.h, f1[0].ox, f1[0].oy], sid).toEqual([w, h, 0, 0]);
        expect([f2[0].buf.w, f2[0].buf.h, f2[0].density], `${sid}@2x`).toEqual([w * 2, h * 2, 2]);
      }
    }
  });

  it('is palette-only and fully opaque', () => {
    for (const id of SQUAD) {
      for (const [part] of SIZES) {
        for (const d of [1, 2]) {
          const b = getFrames(`char/${id}/${part}`, d)[0].buf;
          for (const c of colours(b)) {
            expect(c & 255, `char/${id}/${part}@${d} opaque`).toBe(255);
            expect(inPalette(c), `char/${id}/${part}@${d} colour ${c.toString(16)}`).toBe(true);
          }
        }
      }
    }
  });

  it('the grey portrait uses only the ink / steel / stone grey ramp and keeps the drawing', () => {
    const grey = new Set<Color>(GREY);
    for (const g of grey) expect([...PAL.ink, ...PAL.steel, ...PAL.stone]).toContain(g);
    for (const id of SQUAD) {
      for (const d of [1, 2]) {
        const g = getFrames(`char/${id}/select-grey`, d)[0].buf;
        for (const c of colours(g)) expect(grey.has(c), `char/${id}/select-grey@${d} ${c.toString(16)}`).toBe(true);
        // Light where the colour bust is light: the same picture, recoloured.
        expect(colours(g).size, `${id} grey tones`).toBeGreaterThanOrEqual(6);
      }
    }
  });

  it('the colour portrait shows skin and its outfit colours', () => {
    const skin = new Set<Color>([...PAL.skinA, ...PAL.skinB]);
    for (const id of SQUAD) {
      const cs = colours(selectPortrait(id, 2));
      expect([...cs].some((c) => skin.has(c)), id).toBe(true);
      expect(cs.size, `${id} colours`).toBeGreaterThanOrEqual(20);
    }
  });

  it('the five faces differ', () => {
    for (const d of [1, 2] as const) {
      const bufs = SQUAD.map((id) => selectPortrait(id, d));
      for (let i = 0; i < bufs.length; i++) {
        for (let j = i + 1; j < bufs.length; j++) {
          let diff = 0;
          const a = bufs[i].data;
          const b = bufs[j].data;
          for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) diff++;
          expect(diff / a.length, `${SQUAD[i]} vs ${SQUAD[j]} @${d}`).toBeGreaterThan(0.3);
        }
      }
    }
  });

  it('the menu portrait is drawn from the select face (the PORTRAITS hook wins over the rig)', () => {
    for (const id of SQUAD) {
      for (const d of [1, 2] as const) {
        const f = getFrames(`char/${id}/portrait`, d)[0].buf;
        expect(Array.from(f.data), `${id}@${d}`).toEqual(Array.from(smallPortrait(id, d).data));
      }
      // INK frame round the 1× portrait.
      const p = smallPortrait(id, 1);
      expect([p.get(0, 0), p.get(31, 31), p.get(0, 16), p.get(16, 31)]).toEqual([INK, INK, INK, INK]);
    }
  });

  it('the high-score head icons keep the face and drop every panel colour', () => {
    const panel = new Set<Color>([PAL.navy[0], PAL.navy[1], PAL.purple[0]]);
    for (const id of SQUAD) {
      const icon = headIcon(id);
      expect(icon, id).not.toBeNull();
      if (!icon) continue;
      expect(icon.w).toBeLessThanOrEqual(14);
      expect(icon.h).toBeLessThanOrEqual(14);
      let opaque = 0;
      for (let y = 1; y < icon.h - 1; y++) {
        for (let x = 1; x < icon.w - 1; x++) {
          const c = icon.get(x, y) >>> 0;
          expect(panel.has(c), `${id} icon panel colour at ${x},${y}`).toBe(false);
          if ((c & 255) !== 0) opaque++;
        }
      }
      // The face fills the icon (no holes where a face colour matched the panel).
      expect(opaque / ((icon.w - 2) * (icon.h - 2)), id).toBeGreaterThan(0.8);
    }
  });
});
