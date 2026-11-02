/**
 * The decor art of mission `oat` (docs/design/oat.md §8.7, §8.11; docs/api/oat.md "Art"). Owner:
 * STREET-A (oat-a and the oat-d proof strip in wave A); the section owners of waves B and C add
 * their own files here. One-line contract: one density-generic drawer per sprite id (the `Pen`
 * pattern, kit.ts) under `decor/oat/<section>/…` (street furniture, signs and street-name plates,
 * bridges, canal vistas, shops, neon, people), the background generators `oat-…` (layers.ts); no ink
 * outline on static props, outline A on what can be shot (spec §8.11); every pixel in PAL_HD ∪
 * PAL_HD_OAT at 2× / 4× (`inOatPalette`), PAL at 1×.
 */
import './street';
import './bridges';
import './vistas';
import './shops';
import './people';
import './night';
import './layers';
