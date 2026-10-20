/**
 * The UHD art kit (docs/ART_GUIDE.md "UHD art"): one density-generic drawer per id makes its 2×
 * and its 4× art. HdCanvas (logical units, lit primitives, light, quantise, clean-up, outline
 * variants A / B / C), material textures, the light model and the rig contracts (head, gear).
 */
export { HdCanvas, inPoly, polyDist, type DrawOpts, type HdMaterial, type Outline, type RenderOpts, type TexSample, type Texture } from './canvas';
export { BLACK_ONE_HUE, BOUNCE, HALF, KEY, LIGHT_DEFAULTS, diffuse, oneHue, specular, type LightParams } from './light';
export { brick, cobbles, folds, grime, leaves, plaster, ripples, strands, texAll, wood } from './texture';
export { renderHeadHd, type HdDensity } from './head';
export { drawHandHd, gunArtHd, gunHd, handArtHd, heldArtHd, knifeArtHd, propArtHd, propHd } from './gear';
export { along, lerpPt, limb, type Pt } from './shape';
