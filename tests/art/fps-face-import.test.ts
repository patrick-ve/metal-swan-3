/**
 * The user-art import of the mech face (docs/design/fps.md §8.7): the generated module is up to
 * date with art-src/user/mecha-hofmans-head.png (re-running the import gives the same text), every
 * key is a palette colour, the sizes match the spec and both eyes sit in the upper face.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { inPalette } from '../../src/engine/palette';
import { face16, face27, face34, MECHA_FACE_KEY } from '../../src/game/content/fps/art/mecha-face.gen';
import { buildFaceModule, FACE_OUT } from '../../tools/art/import-face';

describe('mecha face import (§8.7)', () => {
  it('the generated module is up to date with the PNG', () => {
    expect(readFileSync(FACE_OUT, 'utf8')).toBe(buildFaceModule());
  });

  it('every key is a palette colour', () => {
    for (const c of Object.values(MECHA_FACE_KEY)) expect(inPalette(c)).toBe(true);
  });

  it.each([
    ['face34', face34, 34, 42],
    ['face27', face27, 27, 42],
    ['face16', face16, 16, 20],
  ] as const)('%s is %i × %i, uses only known keys, and is mostly opaque', (_n, img, w, h) => {
    expect([img.w, img.h, img.rows.length]).toEqual([w, h, h]);
    let opaque = 0;
    for (const row of img.rows) {
      expect(row.length).toBe(w);
      for (const ch of row) {
        if (ch === '.') continue;
        expect(MECHA_FACE_KEY[ch]).toBeDefined();
        opaque++;
      }
    }
    expect(opaque).toBeGreaterThan(w * h * 0.5);
    for (const [x, y] of img.eyes) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(w);
      expect(y).toBeGreaterThan(h * 0.2);
      expect(y).toBeLessThan(h * 0.75);
    }
    expect(img.eyes[0][0]).toBeLessThan(img.eyes[1][0]);
  });
});
