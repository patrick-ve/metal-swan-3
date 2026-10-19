/**
 * The UHD light model (docs/ART_GUIDE.md "UHD art"): ONE key light from the upper left and in
 * front, a cool bounce from the lower right on the shadow side, a rim on the shadow-side
 * silhouette, ambient occlusion where parts meet (computed by HdCanvas from depth) and a
 * Blinn-Phong specular for metal, glass, wet surfaces and skin.
 *
 * Every function works on unit normals (x right, y DOWN, z towards the viewer) and returns a
 * TONE: 0 = the deepest diffuse band, 1 = the lightest diffuse band of a material. The canvas
 * quantises tones to the material's HD ramp. The bounce is "cool" because the low end of every HD
 * ramp leans blue / purple: lifting a shadow by a bounce keeps it in the cool tones.
 */

/** Unit vector towards the key light: upper left, in front. */
export const KEY: readonly [number, number, number] = norm3(-0.55, -0.6, 0.6);
/** Unit vector towards the bounce light: lower right, slightly behind. */
export const BOUNCE: readonly [number, number, number] = norm3(0.75, 0.55, 0.2);
/** Half vector of the key light and the view direction (0, 0, 1), for the specular. */
export const HALF: readonly [number, number, number] = norm3(KEY[0], KEY[1], KEY[2] + 1);

function norm3(x: number, y: number, z: number): readonly [number, number, number] {
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
}

/** Light parameters of a material (all optional; defaults in LIGHT_DEFAULTS). */
export interface LightParams {
  /** Tone floor of the side away from the key light (0..1). */
  amb?: number;
  /** Contrast of the key light (1 = full). */
  gain?: number;
  /** Strength of the cool bounce on the shadow side. */
  bounce?: number;
  /** Strength of the rim on the shadow-side silhouette. */
  rim?: number;
  /** Specular strength (0 = matte cloth, 0.3 skin, 0.6 wet, 1 polished metal / glass). */
  spec?: number;
  /** Specular exponent (higher = smaller, sharper highlight). */
  shine?: number;
  /** Wrap of the key light (0 = hard terminator, 0.5 = soft cloth). */
  wrap?: number;
}

export const LIGHT_DEFAULTS: Required<LightParams> = { amb: 0.05, gain: 1, bounce: 0.22, rim: 0.3, spec: 0, shine: 24, wrap: 0.08 };

/** Diffuse tone (0..1-ish) of a unit normal: key (wrapped) + bounce + rim. */
export function diffuse(nx: number, ny: number, nz: number, amb: number, gain: number, wrap: number, bounce: number, rim: number): number {
  const k = nx * KEY[0] + ny * KEY[1] + nz * KEY[2];
  // Contrast: a face turned to the viewer is a mid tone (k ≈ 0.6), only the planes facing the
  // light reach the top bands, the terminator sits where the form turns away (pixel-art form
  // shading, not a soft photographic falloff).
  const key = (k - 0.08 + wrap) / (0.86 + wrap);
  const k1 = key > 1 ? 1 : key > 0 ? key : 0;
  // A face turned to the viewer lands in the middle of the ramp; only planes facing the light climb to the top.
  const kk = k1 * Math.sqrt(k1) ;
  const b = nx * BOUNCE[0] + ny * BOUNCE[1] + nz * BOUNCE[2];
  // The bounce only lifts what the key does not reach.
  const bb = b > 0 ? b * (1 - kk) : 0;
  // Rim: grazing normals on the shadow side (right / bottom), a thin lit edge.
  const g = 1 - nz;
  const side = nx * 0.8 + ny * 0.35;
  const rr = side > 0 ? g * g * g * side : 0;
  return amb + (1 - amb) * kk * gain + bounce * bb * 0.5 + rim * rr;
}

/** Specular term 0..1 of a unit normal. */
export function specular(nx: number, ny: number, nz: number, shine: number): number {
  const h = nx * HALF[0] + ny * HALF[1] + nz * HALF[2];
  return h > 0 ? Math.pow(h, shine) : 0;
}
