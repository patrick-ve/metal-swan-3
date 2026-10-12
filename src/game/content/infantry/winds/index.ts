/**
 * Infantry sub-area "winds" (GDD §9.1): gameplay definitions. Registers at import time:
 *
 * - `oompah-trooper` (oompah.ts) — Oompah Trooper, 60 HP, 500 points: sonic rings (`sonic-ring`,
 *   shootable) and every third blast a rolling LOW NOTE (`low-ring`).
 * - `piccolo` (piccolo.ts) — Piccolo Sniper, 20 HP, 400 points: prone on ledges, a dotted aim line
 *   that locks 12 ticks before a fast `piccolo-bullet`.
 * - `bassoonist` (bassoonist.ts) — Bassoon Bazooka, 40 HP, 600 points: anti-vehicle, an
 *   accelerating `bassoon-rocket` (shootable).
 *
 * All three are `Soldier`s (../index.ts) through the thin `WindSoldier` layer (soldier.ts: looks
 * by outfit × skin, one attack at a time, frozen-shatter, death extras). Spawn params: the shared
 * soldier params (`outfit`, `entry`, `gag`, `column`, `march`, `patrol`, `facing`, `hp`, `drop`,
 * `tag`) plus `skin` (`a` | `b` | `c`; default: random per spawn) and `range` (preferred distance,
 * oompah-trooper and bassoonist). Art: ./art.ts.
 */
import './oompah';
import './piccolo';
import './bassoonist';

export { OOMPAH, OompahTrooper, SonicRing, LowRing } from './oompah';
export { PICCOLO, Piccolo, PiccoloBullet } from './piccolo';
export { BASSOON, Bassoonist, BassoonRocket } from './bassoonist';
export { WindSoldier } from './soldier';
