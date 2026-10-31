/**
 * Art-direction trial style `chibi` (kit.ts): super-deformed and cute, still a soldier. VINCENT
 * at about two and a quarter heads tall: a big round head (≈ 1.6× the rig's), a small soft body,
 * short stubby limbs, little round hands and big round boots, while the gun stays real size (so it
 * looks big). Big glossy eyes with catchlights, the raised brow, a small lopsided smirk, the
 * stubble as a soft shadow, the hair as a few big rounded clumps; soft colours, three gentle bands
 * and a thin warm outline (a dark tone of each part's own colour).
 *
 * Own drawer: chibi-rig.ts (the skeleton with chibi proportions and gun grips), chibi-head.ts
 * (the head), chibi-body.ts (the figure, the frame geometry and the outline), chibi-paint.ts
 * (the paints). The run gets a bouncier head (chibi-body.ts `headCentre`).
 */
import type { ArtStyle } from './kit';
import { renderChibi } from './chibi-body';

export const STYLE: ArtStyle = {
  id: 'chibi',
  name: 'CHIBI',
  blurb: 'Super-deformed: a big head on a small body, big eyes, round shapes and soft colours.',
  renderPose: (_style, pose, part, d) => renderChibi(pose, part, d),
};
