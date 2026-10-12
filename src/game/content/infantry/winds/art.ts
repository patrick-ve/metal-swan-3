/**
 * Infantry sub-area "winds": sprite definitions only (`enemy/<id>/…`, docs/ARCHITECTURE.md §6.1,
 * GDD §9.0–§9.1, §15.6).
 *
 * - `enemy/oompah-trooper/…`, `enemy/piccolo/…`, `enemy/bassoonist/…` — the default look (parade
 *   outfit, skin A), registered here so the tools and the boot preload see it.
 * - Outfit / skin looks (`enemy/<id>-<outfit>[-skin<b|c>]/…`) are registered on first use
 *   (looks.ts `ensureLook`, called when a soldier spawns), so they cost nothing at boot (the boot
 *   preload renders every registered strip), and each strip renders the first time it plays.
 * - Projectiles and props: `enemy/sonic-ring`, `enemy/low-ring`, `enemy/piccolo-bullet`,
 *   `enemy/bassoon-rocket`, `enemy/piccolo-rifle`, `enemy/winds/last-rocket` (shots.art.ts).
 */
import './oompah.art';
import './piccolo.art';
import './bassoonist.art';
import './shots.art';
import { ensureLook, WIND_TYPES } from './looks';

for (const type of WIND_TYPES) ensureLook(type);
