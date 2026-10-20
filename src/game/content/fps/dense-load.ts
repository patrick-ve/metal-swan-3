/**
 * The dense fps art (UHD wave; docs/design/fps.md §3.4): built by the art pool in the background
 * when the fps content has loaded and when a floor starts, never in a frame. The view draws at
 * density 2 at tiers 2 and 4 (scenes/fps.ts), so every ray carrier (walls, doors, billboards) is
 * built at 2; at tier 4 the walls and doors also at 4 (256², picked on near walls), and the HUD
 * pieces, the weapon views and the playing characters' faces at the tier. A missing level draws
 * the next lower one (ray `rayTextureLevel` / `billboardLevel`, fps/hud.ts `readyDensity`).
 */
import { browserArtPool, poolSize, type ArtPool } from '../../../engine/art-pool';
import { artTier, getFrames, hasFramesAt, hasSprite, hiArtOn, releaseDense, setDeferDense, type DenseDensity } from '../../../engine/sprites';
import type { ArtCache } from '../../art-cache';
import { installFpsRayHd, rayCarriersMissing } from './ray-art';

/** The HUD sprites and weapon views drawn at the tier (fps/hud.ts). */
export const FPS_HUD_DENSE: readonly string[] = ['fps/hud/bar', 'fps/hud/weapon', 'fps/hud/key', 'fps/view/knife', 'fps/view/pistol', 'fps/view/mg', 'fps/view/chaingun'];

/** The 4× pack of the fps art (the wall textures at 256², the HUD, the views, the faces). */
export const FPS_PACK_4 = 'hd4-fps' as const;

/** Workers of the fps art pool (at most). */
export const FPS_POOL_MAX = 4;

let poolFactory: (() => ArtPool | null) | null = null;
let densePool: ArtPool | null = null;
/** `${d}:${id}` handed to the pool and not back yet. */
const denseBusy = new Set<string>();
let denseRun: Promise<void> = Promise.resolve();

/**
 * Replace the fps art pool (tests, tools): `factory` returns the pool, or null to build in this
 * thread at once; null restores the default (browser workers; in this thread without Worker).
 */
export function setFpsArtPool(factory: (() => ArtPool | null) | null): void {
  densePool?.close();
  densePool = null;
  poolFactory = factory;
  denseBusy.clear();
  asked = 1;
}

const defaultPool = (): ArtPool | null => (typeof Worker === 'undefined' ? null : browserArtPool(Math.min(FPS_POOL_MAX, poolSize())));

/** What the dense fps art needs at density d for `chars` (only ids not built / installed yet). */
export function fpsDenseIds(d: DenseDensity, chars: readonly string[]): string[] {
  const ray = d === 2 ? rayCarriersMissing(2) : rayCarriersMissing(4, 'tex');
  const sprites = [...FPS_HUD_DENSE, ...chars.map((c) => `fps/face/${c}`)].filter((id) => hasSprite(id) && !hasFramesAt(id, d));
  return [...ray, ...sprites].filter((id) => !denseBusy.has(`${d}:${id}`));
}

/**
 * Build the fps dense art for art tier `tier` (idempotent; never rejects): at tier ≥ 2 every ray
 * carrier (walls, doors, billboards: the view draws at 2), the HUD, the weapon views and the faces
 * of `chars` at 2; at tier 4 also the walls and doors at 4 (256²: the view picks them on near
 * walls), the HUD, the views and the faces at 4 (the 4× ones restored from / saved to the
 * 'hd4-fps' pack). The ray levels are installed batch by batch as they arrive and the carriers'
 * dense frames are then released (the ray registry holds its own column copy).
 */
export function ensureFpsDenseArt(tier: number, chars: readonly string[], cache?: ArtCache | null): Promise<void> {
  if (!hiArtOn() || tier < 2) return denseRun;
  denseRun = denseRun.then(async () => {
    for (const d of tier >= 4 ? ([2, 4] as const) : ([2] as const)) {
      try {
        if (d === 4 && cache) {
          await cache.restore(FPS_PACK_4, (id) => id.startsWith('fps/'));
          installFpsRayHd(4);
        }
        const ids = fpsDenseIds(d, chars);
        if (ids.length > 0) await buildDense(ids, d);
        installFpsRayHd(d);
        if (d === 4 && cache) await cache.save(FPS_PACK_4, (id) => id.startsWith('fps/'));
        // The ray registry holds the levels now: drop the carriers' copies.
        releaseDense(ids.filter((id) => id.startsWith('fps/ray/')), d);
      } catch (err) {
        console.error(`[fps] dense art at ${d}x failed:`, err);
      }
    }
    // Idle: close the workers (a later tier change opens a new pool).
    densePool?.close();
    densePool = null;
  });
  return denseRun;
}

/** The highest tier asked for so far (requestFpsDenseArt). */
let asked = 1;

/**
 * Ask for the dense art the display can show now: the art tier at the backbuffer res `r.res`
 * (4 only when 4 divides it, as the HUD; 1 when dense art is off or the res is 1 — headless sims
 * and tests never build dense art). Cheap once asked: one compare per call (the scenes call it
 * every frame they draw).
 */
export function requestFpsDenseArt(r: { readonly res: number }, chars: () => readonly string[], cache?: ArtCache | null): void {
  if (!hiArtOn()) return;
  const t = artTier();
  const want = t >= 4 && r.res >= 4 && r.res % 4 === 0 ? 4 : t >= 2 && r.res >= 2 ? 2 : 1;
  if (want <= asked) return;
  asked = want;
  void ensureFpsDenseArt(want, chars(), cache);
}

function buildDense(ids: readonly string[], d: DenseDensity): Promise<void> {
  if (!densePool) densePool = (poolFactory ?? defaultPool)();
  const pool = densePool;
  if (!pool) {
    // No workers (node tools and tests): build in this thread now.
    const deferred = setDeferDense(false);
    try {
      for (const id of ids) getFrames(id, d);
    } finally {
      setDeferDense(deferred);
    }
    return Promise.resolve();
  }
  for (const id of ids) denseBusy.add(`${d}:${id}`);
  return pool
    .build(ids, d, () => {
      installFpsRayHd(d);
    })
    .then(() => {
      for (const id of ids) denseBusy.delete(`${d}:${id}`);
    });
}
