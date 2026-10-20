/**
 * UHD art (2× and 4×, docs/ART_GUIDE.md "UHD art") of the decor of mission ams sections c (AMSTEL)
 * and d (STOPERA), the Amsterdam breakables and the canal boats: ONE density-generic drawer per
 * id (d 2 and 4), PAL_HD, the 1× frame's logical size, anchor and points. Registered here with
 * `defineHdSprite`; `CD_HD` lists every id with its generator (tests, tools).
 *
 * Files:
 * - `art-hd-cd-kit.ts`: shared helpers (`hdStrip`, materials, raised `letters`, `wheelHd`, the
 *   direct per-px `Facade` painter with outline C for the big façades).
 * - `art-hd-cd-breakables.ts`: herring cart, tulip stall, market stall, bike rack — intact (0) and
 *   wrecked (1); outline A.
 * - `art-hd-cd-market.ts`: the Waterlooplein flea-market stalls (3 frames); outline C.
 * - `art-hd-cd-bridges.ts`: the white Amstel bridge and its portal, the Blauwbrug lamp (outline
 *   C) and the Blauwbrug arch face (painted, no outline).
 * - `art-hd-cd-stopera.ts`: the Stopera, the boss arena of section d (direct painter, outline C).
 * - `art-hd-cd-boats.ts`: the boat platform (outline A, wake after the outline) and the
 *   houseboats of sections a and c (outline C).
 *
 * The mission module reaches this file through `art-hi-cd.ts` and `art-hi-boat.ts` (entries
 * kept for the import list of index.ts); it is imported before the section files and art-hi-ab.ts,
 * which leaves the ids registered here alone.
 */
import type { Frame } from '../../../../engine/render';
import { defineHdSprite, type DenseDensity } from '../../../../engine/sprites';
import { BREAKABLES_HD } from './art-hd-cd-breakables';
import { BOATS_HD } from './art-hd-cd-boats';
import { BRIDGES_HD } from './art-hd-cd-bridges';
import { MARKET_HD } from './art-hd-cd-market';
import { STOPERA_HD } from './art-hd-cd-stopera';

/** Every c / d decor id with UHD art → its generator (d 2 or 4). */
export const CD_HD: ReadonlyMap<string, (d: DenseDensity) => Frame[]> = new Map([...BREAKABLES_HD, ...MARKET_HD, ...BRIDGES_HD, ...STOPERA_HD, ...BOATS_HD]);

for (const [id, gen] of CD_HD) defineHdSprite(id, gen);
