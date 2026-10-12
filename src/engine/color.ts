/**
 * Packed colour: 0xRRGGBBAA as an unsigned 32-bit number. Alpha 0 = fully transparent.
 * Shared contract between the simulation side and the media side — extend, don't break.
 */
export type Color = number;

export const TRANSPARENT: Color = 0;
export const WHITE: Color = 0xffffffff;
export const BLACK: Color = 0x000000ff;
/** Placeholder colour for missing art. Deliberately NOT in the palette. */
export const MAGENTA: Color = 0xff00ffff;

export function rgba(r: number, g: number, b: number, a = 255): Color {
  return (((r & 255) << 24) | ((g & 255) << 16) | ((b & 255) << 8) | (a & 255)) >>> 0;
}

/** '#rgb', '#rrggbb' or '#rrggbbaa' (leading '#' optional) → Color. */
export function hex(s: string): Color {
  let h = s.startsWith('#') ? s.slice(1) : s;
  if (h.length === 3) h = h.split('').map((ch) => ch + ch).join('');
  if (h.length === 6) h += 'ff';
  if (!/^[0-9a-fA-F]{8}$/.test(h)) throw new Error(`bad colour: ${s}`);
  return parseInt(h, 16) >>> 0;
}

export const chR = (c: Color): number => (c >>> 24) & 255;
export const chG = (c: Color): number => (c >>> 16) & 255;
export const chB = (c: Color): number => (c >>> 8) & 255;
export const chA = (c: Color): number => c & 255;

export function withAlpha(c: Color, a: number): Color {
  return ((c & 0xffffff00) | (a & 255)) >>> 0;
}

export function toCss(c: Color): string {
  return `rgba(${chR(c)},${chG(c)},${chB(c)},${(chA(c) / 255).toFixed(3)})`;
}

/** '#rrggbb' for opaque colours, '#rrggbbaa' otherwise. */
export function toHex(c: Color): string {
  const s = (c >>> 0).toString(16).padStart(8, '0');
  return chA(c) === 255 ? `#${s.slice(0, 6)}` : `#${s}`;
}

/** Perceived brightness 0..255 (Rec. 601 weights), ignoring alpha. */
export function luma(c: Color): number {
  return (chR(c) * 299 + chG(c) * 587 + chB(c) * 114) / 1000;
}

/** Linear blend of all four channels; t = 0 → a, t = 1 → b. */
export function lerpColor(a: Color, b: Color, t: number): Color {
  const k = t <= 0 ? 0 : t >= 1 ? 1 : t;
  const mix = (x: number, y: number): number => Math.round(x + (y - x) * k);
  return rgba(mix(chR(a), chR(b)), mix(chG(a), chG(b)), mix(chB(a), chB(b)), mix(chA(a), chA(b)));
}

/** Rounded x / 255 for 0 <= x <= 65535 (exact, integer only). */
export function div255(x: number): number {
  return ((x + 128) * 257) >>> 16;
}

/**
 * Porter-Duff "source over": draw `src` (its own alpha × `alpha`) on top of `dst`.
 * Fast paths cover the common pixel-art cases (opaque or empty pixels). The maths matches what
 * Canvas 2D does on an opaque backbuffer to within ±1 per channel.
 */
export function blendOver(dst: Color, src: Color, alpha = 1): Color {
  let sa = src & 255;
  if (alpha < 1) sa = Math.round(sa * (alpha <= 0 ? 0 : alpha));
  if (sa === 0) return dst >>> 0;
  if (sa === 255) return (src | 255) >>> 0;
  const da = dst & 255;
  if (da === 0) return ((src & 0xffffff00) | sa) >>> 0;
  const inv = 255 - sa;
  if (da === 255) {
    const r = div255(((src >>> 24) & 255) * sa + ((dst >>> 24) & 255) * inv);
    const g = div255(((src >>> 16) & 255) * sa + ((dst >>> 16) & 255) * inv);
    const b = div255(((src >>> 8) & 255) * sa + ((dst >>> 8) & 255) * inv);
    return ((r << 24) | (g << 16) | (b << 8) | 255) >>> 0;
  }
  // General case: both colours partly transparent (rare: building translucent art).
  const dw = (da * inv) / 255;
  const oa = sa + dw;
  const ch = (s: number, d: number): number => Math.round((s * sa + d * dw) / oa);
  return rgba(
    ch((src >>> 24) & 255, (dst >>> 24) & 255),
    ch((src >>> 16) & 255, (dst >>> 16) & 255),
    ch((src >>> 8) & 255, (dst >>> 8) & 255),
    Math.round(oa),
  );
}

/**
 * Additive blend ("lighter" in Canvas 2D): premultiplied src (alpha × `alpha`) is added to dst,
 * channels clamp at 255. On an opaque dst this is simply dst + src × srcAlpha.
 */
export function blendAdd(dst: Color, src: Color, alpha = 1): Color {
  let sa = src & 255;
  if (alpha < 1) sa = Math.round(sa * (alpha <= 0 ? 0 : alpha));
  if (sa === 0) return dst >>> 0;
  const da = dst & 255;
  if (da === 255) {
    const r = Math.min(255, ((dst >>> 24) & 255) + div255(((src >>> 24) & 255) * sa));
    const g = Math.min(255, ((dst >>> 16) & 255) + div255(((src >>> 16) & 255) * sa));
    const b = Math.min(255, ((dst >>> 8) & 255) + div255(((src >>> 8) & 255) * sa));
    return ((r << 24) | (g << 16) | (b << 8) | 255) >>> 0;
  }
  // General case in premultiplied space.
  const oa = Math.min(255, sa + da);
  const ch = (s: number, d: number): number =>
    Math.min(255, Math.round((Math.min(255, (s * sa) / 255 + (d * da) / 255) * 255) / oa));
  return rgba(
    ch((src >>> 24) & 255, (dst >>> 24) & 255),
    ch((src >>> 16) & 255, (dst >>> 16) & 255),
    ch((src >>> 8) & 255, (dst >>> 8) & 255),
    oa,
  );
}
