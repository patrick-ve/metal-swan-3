/**
 * Art-direction trial (kit.ts): registers `vincent-<style>` for every style, a hidden copy of
 * VINCENT (not on the select screen) whose strips are all drawn by the style's renderer. Every
 * strip is deferred (made on first use), so the boot preload stays as it was.
 */
import { defineSprite, getFrames } from '../../../../engine/sprites';
import { definePlayerSprites } from '../../../art/human-sprites';
import type { Pose } from '../../../art/humanoid';
import { defineCharacter, getCharacter } from '../../../registry';
import { VINCENT_ART, VINCENT_STYLE } from '../vincent.art';
import type { ArtStyle } from './kit';
import { STYLE as ARCADE } from './arcade';
import { STYLE as CHIBI } from './chibi';
import { STYLE as COMIC } from './comic';
import { STYLE as GRITTY } from './gritty';
import { STYLE as PAINTED } from './painted';
import { STYLE as CLAY } from './clay';

export const ART_STYLES: readonly ArtStyle[] = [ARCADE, CHIBI, COMIC, GRITTY, PAINTED, CLAY];

/** The trial characters (characters/index.ts, after VINCENT). */
export function defineStyleCharacters(): void {
  for (const s of ART_STYLES) {
    const id = `vincent-${s.id}`;
    defineCharacter({ ...getCharacter('vincent'), id, art: `char/${id}` });
  }
}

/** The trial characters' strips (characters/art.ts, after VINCENT's), with the Helium Head variants. */
export function defineStyleSprites(variants: Readonly<Record<string, (p: Pose) => Pose>>): void {
  for (const s of ART_STYLES) {
    const id = `vincent-${s.id}`;
    definePlayerSprites(id, VINCENT_STYLE, { ...VINCENT_ART, variants, renderPose: s.renderPose, defer: true });
    // The crushed death and the portrait stay VINCENT's own.
    for (const name of ['die-flat', 'portrait']) {
      const src = `char/vincent/${name}`;
      defineSprite(`char/${id}/${name}`, () => [...getFrames(src, 1)], { defer: true, anchor: name === 'portrait' ? 'top-left' : undefined, hd: (d) => [...getFrames(src, d)] });
    }
  }
}
