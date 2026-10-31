/**
 * Art-direction trial `chibi` (chibi.ts): the paints. Every part has a soft three-band ramp and a
 * warm LINE tone (a dark tone of its own colour) used for its outline and for the separations of
 * the parts behind it. 1× paints use PAL colours only, 2× / 4× paints PAL_HD colours only
 * (docs/ART_GUIDE.md §1).
 */
import type { Color } from '../../../../engine/color';
import { PAL } from '../../../../engine/palette';
import { PAL_HD } from '../../../../engine/palette-hd';
import type { HdCanvas, HdMaterial } from '../../../art/hd';

/** A part's paint: the line tone, three diffuse bands (dark → light) and a sheen tone. */
export interface Paint {
  line: Color;
  bands: readonly [Color, Color, Color];
  sheen?: Color;
}

export type PaintName = 'skin' | 'stubble' | 'hair' | 'tweed' | 'tie' | 'shirt' | 'pants' | 'boots' | 'sole' | 'belt';

const HD: Readonly<Record<PaintName, Paint>> = {
  skin: { line: PAL_HD.skinA[2], bands: [PAL_HD.skinA[4], PAL_HD.skinA[5], PAL_HD.skinA[6]], sheen: PAL_HD.skinA[7] },
  // The stubble: a soft cool-brown shadow over the jaw (the same light as the skin).
  stubble: { line: PAL_HD.skinA[2], bands: [PAL_HD.skinA[3], PAL_HD.skinA[4], PAL_HD.skinA[5]] },
  hair: { line: PAL_HD.hairB[0], bands: [PAL_HD.hairB[1], PAL_HD.hairB[2], PAL_HD.hairB[3]], sheen: PAL_HD.hairB[4] },
  tweed: { line: PAL_HD.brown[1], bands: [PAL_HD.brown[3], PAL_HD.brown[5], PAL_HD.brown[6]] },
  tie: { line: PAL_HD.red[1], bands: [PAL_HD.red[3], PAL_HD.red[4], PAL_HD.red[5]] },
  shirt: { line: PAL_HD.snow[1], bands: [PAL_HD.snow[3], PAL_HD.snow[4], PAL_HD.snow[5]], sheen: PAL_HD.snow[6] },
  pants: { line: PAL_HD.olive[1], bands: [PAL_HD.olive[3], PAL_HD.olive[4], PAL_HD.olive[5]] },
  boots: { line: PAL_HD.ink[0], bands: [PAL_HD.ink[1], PAL_HD.steel[1], PAL_HD.black[3]], sheen: PAL_HD.black[5] },
  sole: { line: PAL_HD.ink[0], bands: [PAL_HD.brown[1], PAL_HD.brown[2], PAL_HD.brown[3]] },
  belt: { line: PAL_HD.ink[0], bands: [PAL_HD.ink[1], PAL_HD.steel[1], PAL_HD.black[3]] },
};

const LO: Readonly<Record<PaintName, Paint>> = {
  skin: { line: PAL.rust[1], bands: [PAL.skinA[1], PAL.skinA[2], PAL.skinA[3]] },
  stubble: { line: PAL.rust[1], bands: [PAL.skinA[0], PAL.skinA[1], PAL.skinA[1]] },
  hair: { line: PAL.brown[0], bands: [PAL.brown[1], PAL.brown[1], PAL.brown[2]] },
  tweed: { line: PAL.brown[0], bands: [PAL.brown[1], PAL.brown[2], PAL.brown[3]] },
  tie: { line: PAL.red[0], bands: [PAL.red[1], PAL.red[1], PAL.red[2]] },
  shirt: { line: PAL.steel[2], bands: [PAL.snow[0], PAL.snow[1], PAL.snow[2]] },
  pants: { line: PAL.olive[0], bands: [PAL.olive[1], PAL.olive[2], PAL.olive[3]] },
  boots: { line: PAL.ink[0], bands: [PAL.ink[1], PAL.steel[0], PAL.steel[1]] },
  sole: { line: PAL.ink[0], bands: [PAL.brown[0], PAL.brown[1], PAL.brown[1]] },
  belt: { line: PAL.ink[0], bands: [PAL.ink[1], PAL.ink[1], PAL.steel[0]] },
};

export function paint(name: PaintName, d: number): Paint {
  return d === 1 ? LO[name] : HD[name];
}

/** Face colours (fixed paint, no light). */
export interface FaceInk {
  /** Iris: deep (top), mid, low (the glow at the bottom of a chibi eye). */
  irisDeep: Color;
  iris: Color;
  irisLow: Color;
  lid: Color;
  white: Color;
  catch: Color;
  brow: Color;
  browHi: Color;
  lip: Color;
  mouth: Color;
  tongue: Color;
  teeth: Color;
  blush: Color;
  stubbleDot: Color;
  /** The hair's shine arc. */
  shine: Color;
}

export function faceInk(d: number): FaceInk {
  if (d === 1) {
    return {
      irisDeep: PAL.ink[1],
      iris: PAL.brown[1],
      irisLow: PAL.brown[2],
      lid: PAL.ink[1],
      white: PAL.snow[2],
      catch: PAL.snow[3],
      brow: PAL.brown[0],
      browHi: PAL.brown[1],
      lip: PAL.rust[1],
      mouth: PAL.red[0],
      tongue: PAL.red[2],
      teeth: PAL.snow[2],
      blush: PAL.skinA[1],
      stubbleDot: PAL.stone[1],
      shine: PAL.brown[3],
    };
  }
  return {
    irisDeep: PAL_HD.hairB[0],
    iris: PAL_HD.hairB[2],
    irisLow: PAL_HD.hairB[4],
    lid: PAL_HD.ink[1],
    white: PAL_HD.snow[5],
    catch: PAL_HD.snow[6],
    brow: PAL_HD.hairB[0],
    browHi: PAL_HD.hairB[2],
    lip: PAL_HD.skinA[1],
    mouth: PAL_HD.red[1],
    tongue: PAL_HD.red[5],
    teeth: PAL_HD.snow[5],
    blush: PAL_HD.skinA[4],
    stubbleDot: PAL_HD.stone[3],
    shine: PAL_HD.hairB[5],
  };
}

/**
 * A soft toon material: ramp = [line, band 0, band 1, band 2, sheen?]; the diffuse light picks one
 * of the three bands (gentle: a high ambient, a wide wrap, a low gain), the line tone is index 0
 * (separations), the sheen the top (specular).
 */
export function toon(c: HdCanvas, p: Paint, o: Partial<HdMaterial> = {}): number {
  const ramp: Color[] = [p.line, ...p.bands];
  if (p.sheen !== undefined) ramp.push(p.sheen);
  const m: HdMaterial = { ramp, lo: 1, hi: 3, amb: 0.22, gain: 0.9, wrap: 0.28, bounce: 0.15, rim: 0.05, spec: 0, ...o };
  return c.material(m);
}
