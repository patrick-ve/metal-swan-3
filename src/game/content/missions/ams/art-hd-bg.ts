/**
 * The UHD background layers of mission `ams` (2× and 4×, ONE density-generic generator per layer,
 * registered with `defineHdBgGenerator`; docs/ART_GUIDE.md "UHD art"): `ams-skyline`
 * (art-hd-bg-skyline.ts), `ams-canal-houses` (art-hd-bg-houses.ts), `ams-elms`
 * (art-hd-bg-elms.ts), `ams-plein` (art-hd-bg-plein.ts). The shared `sky-gradient` and `clouds`
 * are in art-hd-sky.ts; the layer kit (palette-index canvas, light and haze, ordered dither) in
 * art-hd-bg-kit.ts; the trees (leaf clusters, trunks) in art-hd-bg-trees.ts.
 */
import './art-hd-bg-skyline';
import './art-hd-bg-houses';
import './art-hd-bg-elms';
import './art-hd-bg-plein';
