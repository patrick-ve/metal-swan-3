/**
 * Mission `rally` content (docs/design/rally.md §12.1; docs/api/rally.md): LAZY like the fps mode —
 * the boot skips it (content/index.ts `isLazyContent`); the card's preload or the glitch into 3D
 * loads it (rally-route.ts `loadRallyContent`). It registers the track and the car models with the
 * rally registry at import time: TRACK's compressed A10 (`track/`), CARS' models (`models/`, `tex/`;
 * the kit core `tex/kit.ts`), and the race's few synth sounds (`sfx.ts`: the glitch into 3D, the
 * countdown; wave C adds the engines and the radio), and wave B's plug-ins (registry.ts "Wave B":
 * the scenery, the teams, the traffic, the rules and the HUD parts).
 */
import { defineRallyTrack } from '../../rally/registry';
// The car models register themselves when models/index.ts loads (one per `RALLY_MODEL` id).
import './models/index';
// The rally's own synth sounds (the glitch into 3D, the countdown): registered at import.
import './sfx';
import { buildTrack } from './track/index';
// Wave B (docs/api/rally.md "B.6"): the plug-ins register themselves at import (PREP's stubs; WORLD
// owns sections/ and props/, FIELD teams/ and traffic/, RULES rules/).
import './sections/index';
import './props/index';
import './teams/index';
import './traffic/index';
import './rules/index';

defineRallyTrack({ id: 'a10', build: buildTrack });
