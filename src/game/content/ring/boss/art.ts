/**
 * Sprites of content area `ring/boss` (docs/design/ring.md §R.3, §11; docs/ART_GUIDE.md "UHD art"):
 * revision R — the ZWAAN train's CONTAINER TRAILER (the retired test lorry's container half) and its
 * adds, every strip at 1×, 2× and 4× from ONE density-generic drawer (art-lorry.ts, art-adds.ts),
 * each frame cropped to its 1× box (art-kit.ts `defStrip`). All ids live under
 * `boss/ring-zwaan/container/` (was `boss/ring-lorry/`; the tier-4 working set keeps them in the
 * train's pseudo-sections). This module (manifest entry `ring/boss/art`) also registers the ZWAAN
 * kit's sprites (zwaan/art-kit.ts), the cab's (zwaan/cab-art.ts) and TRAIN-2's car transporter,
 * tanker and livestock trailer (zwaan/{autos,tank,vee}-art.ts).
 *
 * | id | frames | what |
 * |---|---|---|
 * | `trailer` | 1 | the chassis: beams, the bogie valance, the underrun guard, landing legs, the striped rear bar, lamps |
 * | `container-<0\|1\|2>` | 1 | the rust-red container (corrugated, `ZWAAN` and its swan mark, a made-up box code), by damage state |
 * | `hold` | 3 | the container with the bay of its near side open (by damage state) |
 * | `panel` | 4 | the bay's side panel dropping: upright, tilted, nearly flat, the ramp on the road |
 * | `doors` | 4 | the near rear door: shut (hinges), ajar, open (behind the container), hanging off one hinge |
 * | `door-fall` | 4 (deferred) | a torn-off door tumbling (centre anchor) |
 * | `brake` | 1 | the rear lamp bar lit (the cargo tell) |
 * | `box-tip` | 3 (deferred) | the container falling onto its side (beaten) |
 * | `barrel` / `crate` | 8 / 4 | the cargo rolling / tumbling (centre anchor) |
 * | `loader/<stand\|lift\|throw\|tumble\|sit>` | 2 / 3 / 2 / 4 / 2 | the dock worker in the doorway |
 * | `forklift/<drive\|tell\|charge\|gloat\|cower\|down\|beacon>` | 4 / 3 / 2 / 4 / 2 / 3 / 2 | the forklift |
 * | `forklift/driver-<tumble\|sit>` | 4 / 2 | its driver knocked off (bloodless) |
 */
import '../zwaan/art-kit';
import '../zwaan/cab-art';
import '../zwaan/autos-art';
import '../zwaan/tank-art';
import '../zwaan/vee-art';
import { barrelFrames, beaconFrames, crateFrames, DRIVER, forkCharge, forkCower, forkDown, forkDrive, forkGloat, forkTell, LOADER, loaderLift, loaderStand, loaderThrow, sitFrames, tumbleFrames } from './art-adds';
import { defStrip } from './art-kit';
import { boxTipFrame, brakeFrame, containerFrame, doorFallFrame, doorsFrame, holdFrame, panelFrame, trailerFrame } from './art-lorry';
import { SPR } from './geometry';

for (const s of [0, 1, 2]) defStrip(SPR.container(s), (d) => [containerFrame(s, d)]);
defStrip(SPR.trailer, (d) => [trailerFrame(d)]);
defStrip(SPR.hold, (d) => [0, 1, 2].map((st) => holdFrame(st, d)));
defStrip(SPR.panel, (d) => [0, 1, 2, 3].map((f) => panelFrame(f, d)), { ticksPerFrame: 8, loop: false });
defStrip(SPR.doors, (d) => [0, 1, 2, 3].map((f) => doorsFrame(f, d)), { ticksPerFrame: 4, loop: false });
defStrip(SPR.doorFall, (d) => [0, 1, 2, 3].map((f) => doorFallFrame(f, d)), { ticksPerFrame: 4, defer: true });
defStrip(SPR.brake, (d) => [brakeFrame(d)]);
defStrip(SPR.boxTip, (d) => [0, 1, 2].map((f) => boxTipFrame(f, d)), { ticksPerFrame: 8, loop: false, defer: true });

defStrip(SPR.barrel, barrelFrames, { ticksPerFrame: 3 });
defStrip(SPR.crate, crateFrames, { ticksPerFrame: 4 });
defStrip(SPR.loader('stand'), loaderStand, { ticksPerFrame: 30 });
defStrip(SPR.loader('lift'), loaderLift, { ticksPerFrame: 8, loop: false });
defStrip(SPR.loader('throw'), loaderThrow, { ticksPerFrame: 5, loop: false });
defStrip(SPR.loader('tumble'), (d) => tumbleFrames(LOADER, d), { ticksPerFrame: 4 });
defStrip(SPR.loader('sit'), (d) => sitFrames(LOADER, d), { ticksPerFrame: 30 });
defStrip(SPR.forklift('drive'), forkDrive, { ticksPerFrame: 4 });
defStrip(SPR.forklift('tell'), forkTell, { ticksPerFrame: 8, loop: false });
defStrip(SPR.forklift('charge'), forkCharge, { ticksPerFrame: 3 });
defStrip(SPR.forklift('gloat'), forkGloat, { ticksPerFrame: 14, defer: true });
defStrip(SPR.forklift('cower'), forkCower, { ticksPerFrame: 4, defer: true });
defStrip(SPR.forklift('down'), forkDown, { ticksPerFrame: 6, loop: false });
defStrip(SPR.forklift('beacon'), beaconFrames, { ticksPerFrame: 6 });
defStrip(SPR.forklift('driver-tumble'), (d) => tumbleFrames(DRIVER, d), { ticksPerFrame: 4 });
defStrip(SPR.forklift('driver-sit'), (d) => sitFrames(DRIVER, d), { ticksPerFrame: 30 });
