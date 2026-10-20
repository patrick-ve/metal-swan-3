/**
 * The fps ray art as sprites (UHD wave): every wall / door texture and every billboard of the
 * first-person mode is also a CARRIER sprite `fps/ray/<id without fps/>` — its 1× frames are the
 * texture (frame 0, frame 1 its y-side variant) or the billboard's rendered frames (frame-major,
 * the rendered yaws of each frame), and its dense frames (2× / 4×) are the UHD art of the same
 * drawer. So the art pool builds the dense ray art in workers like any sprite, the sprite cache
 * packs it, `npm run sprites -- fps/ray --density 2` shows it, and the 1× ray registry reads the
 * carrier's 1× frames (the 1× pixels and the ray registry's own y-side shading are unchanged).
 *
 * `installFpsRayHd(d)` hands the carriers' READY dense frames to the ray registry
 * (`installRayTextureHd`, `installRayBillboardHd`); it never generates.
 */
import { stepShade } from '../../../engine/palette';
import { PixelBuffer } from '../../../engine/pixel';
import {
  defineRayBillboard,
  defineRayTexture,
  installRayBillboardHd,
  installRayTextureHd,
  rayBillboardDensities,
  rayTextureDensities,
  type RayBillboardDef,
} from '../../../engine/ray';
import { defineSprite, getFrames, hasFramesAt, type DenseDensity } from '../../../engine/sprites';

export const RAY_CARRIER_PREFIX = 'fps/ray/';

/** The carrier sprite of ray asset `id` (`fps/wall/brick` → `fps/ray/wall/brick`). */
export function carrierOf(id: string): string {
  return RAY_CARRIER_PREFIX + (id.startsWith('fps/') ? id.slice(4) : id);
}

interface Carried {
  id: string;
  kind: 'tex' | 'bb';
}
const carried: Carried[] = [];
const carriedIds = new Set<string>();

function remember(id: string, kind: Carried['kind']): void {
  if (carriedIds.has(id)) return;
  carriedIds.add(id);
  carried.push({ id, kind });
}

/** The y-side variant of a 1× texture (the ray registry's own shading: one 64-palette step down). */
function dark1x(b: PixelBuffer): PixelBuffer {
  const out = new PixelBuffer(b.w, b.h);
  for (let i = 0; i < b.data.length; i++) out.data[i] = stepShade(b.data[i] >>> 0, -1) >>> 0;
  return out.touch();
}

/** A texture's dense art: the lit face and its y-side variant, both (64·d)². */
export interface TexHd {
  lit: PixelBuffer;
  dark: PixelBuffer;
}

/**
 * Register a wall / door texture with its 1× painter and its UHD painter (density 2 and 4): the
 * ray texture `id` and its carrier sprite.
 */
export function defineRayTextureArt(id: string, paint1x: () => PixelBuffer, paintHd?: (d: DenseDensity) => TexHd): void {
  const carrier = carrierOf(id);
  defineSprite(
    carrier,
    () => {
      const b = paint1x();
      return [b, dark1x(b)];
    },
    {
      anchor: 'top-left',
      hd: paintHd
        ? (d) => {
            const t = paintHd(d);
            return [t.lit, t.dark];
          }
        : undefined,
    },
  );
  defineRayTexture(id, () => getFrames(carrier, 1)[0].buf);
  remember(id, 'tex');
}

/**
 * Register a billboard with its 1× generator and its UHD generator `genHd(d, frame, yaw)` ((size·d)²,
 * yaws 0..4 for an 8-yaw billboard): the ray billboard `id` and its carrier sprite.
 */
export function defineRayBillboardArt(id: string, def: RayBillboardDef, genHd?: (d: DenseDensity, frame: number, yaw: number) => PixelBuffer): void {
  const carrier = carrierOf(id);
  const frames = Math.max(1, def.frames | 0);
  const rendered = def.yaws === 8 ? 5 : 1;
  const all = <T,>(gen: (frame: number, yaw: number) => T): T[] => {
    const out: T[] = [];
    for (let f = 0; f < frames; f++) for (let k = 0; k < rendered; k++) out.push(gen(f, k));
    return out;
  };
  defineSprite(carrier, () => all(def.gen), { anchor: 'top-left', hd: genHd ? (d) => all((f, k) => genHd(d, f, k)) : undefined });
  defineRayBillboard(id, { ...def, gen: (frame, yaw) => getFrames(carrier, 1)[frame * rendered + yaw].buf });
  remember(id, 'bb');
}

/** Ray asset ids that have a carrier (definition order). */
export function listRayArt(): string[] {
  return carried.map((c) => c.id);
}

/** Carrier sprite ids of every ray asset (for the art pool and the packs); `kind` 'tex' or 'bb' alone. */
export function rayCarrierIds(kind?: 'tex' | 'bb'): string[] {
  return carried.filter((c) => !kind || c.kind === kind).map((c) => carrierOf(c.id));
}

/** Carrier ids (of `kind`, or all) whose ray level at density d is not installed yet. */
export function rayCarriersMissing(d: DenseDensity, kind?: 'tex' | 'bb'): string[] {
  const out: string[] = [];
  for (const c of carried) {
    if (kind && c.kind !== kind) continue;
    const have = c.kind === 'tex' ? rayTextureDensities(c.id) : rayBillboardDensities(c.id);
    if (!have.includes(d)) out.push(carrierOf(c.id));
  }
  return out;
}

/**
 * Install the ray registry's dense level `d` of every asset whose carrier frames are built at d
 * (and not installed yet). Never generates. Returns the number installed.
 */
export function installFpsRayHd(d: DenseDensity): number {
  let n = 0;
  for (const c of carried) {
    const carrier = carrierOf(c.id);
    if (!hasFramesAt(carrier, d)) continue;
    if (c.kind === 'tex') {
      if (rayTextureDensities(c.id).includes(d)) continue;
      const f = getFrames(carrier, d);
      if (installRayTextureHd(c.id, d, f[0].buf, f[1]?.buf)) n++;
    } else {
      if (rayBillboardDensities(c.id).includes(d)) continue;
      if (installRayBillboardHd(c.id, d, getFrames(carrier, d).map((f) => f.buf))) n++;
    }
  }
  return n;
}
