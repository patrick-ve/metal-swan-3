/**
 * Content category "ui": HUD and menu art (GDD §13, §15.6; docs/ARCHITECTURE.md §7.1–§7.2).
 * Loaded through the 'ui/art' manifest entry.
 *
 * - hud.art.ts      icons: `ui/icon-life`, `ui/swan-marker`, `ui/cursor-swan`, `ui/icon-cell`,
 *                   `ui/onward`, `ui/star`, `ui/icon-balloon`, `ui/ride`, `ui/bubble`
 * - logo.art.ts     `ui/logo`
 * - military.art.ts the military menus (docs/design/squad.md §2.3): `ui/mil/frame`, `ui/mil/shutter`,
 *                   `ui/mil/hazard`, `ui/mil/badge-<off|p1|p2>`, `ui/mil/plate`, `ui/mil/preview`,
 *                   `ui/mil/emblem`, `ui/mil/stencil-<slug>`
 * - screens.art.ts  `ui/newspaper`, `ui/stamp`, `ui/portrait-gusto`, the title lake scene
 *                   (`ui/title-swan`, `ui/parade`), the pause and continue gags
 *                   (`ui/chair`, `ui/loudspeaker`, `ui/private`)
 * - ending.art.ts   the ending and parade cast: `ui/ending-organ`, `ui/ending-pipe`,
 *                   `ui/fanfaroni`, `ui/ending-mk1`, `ui/ending-flyer`, `ui/placard`, `ui/pigeon`,
 *                   `ui/horse`, `ui/leader-<blare|rimshot|puffington|pizzicata>`
 *
 * Weapon icons (`ui/icon-<weapon id>`), `ui/icon-bomb`, `ui/icon-shell` and `ui/icon-hostage`
 * come from content/weapons/art.ts. `defineUiArt()` registers everything again: the boot scene
 * calls it after all content has loaded, so the UI's own `ui/…` ids win over older copies.
 */
import { defineEndingArt } from './ending.art';
import { defineHudArt } from './hud.art';
import { defineLogoArt } from './logo.art';
import { defineMilitaryArt } from './military.art';
import { defineScreenArt } from './screens.art';

export function defineUiArt(): void {
  defineHudArt();
  defineLogoArt();
  defineMilitaryArt();
  defineScreenArt();
  defineEndingArt();
}

defineUiArt();
