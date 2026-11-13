// The layout dump for mission `sewers`, which is LAZY in the game (content/index.ts `isSewersContent`): the kit's
// tools/levelkit/dump.ts loads only the content that is not lazy, so it finds no mission `sewers`. This file loads the
// sewers chunk first and then runs dump.ts unchanged, with the same arguments:
//
//   npx tsx tools/levelkit/missions/sewers/dump_lazy.mts sewers --prefix decor/sewers --prefix prop/sewers \
//       --prefix boss/sewers-gerrit/limo --prefix vehicle/
//
// (writes tools/levelkit/work/sewers/layout.json; missions/sewers/mission.py turns it into layout-kit.json)
import { isSewersContent, loadContent } from '../../../../src/game/content/index';

const report = await loadContent(isSewersContent);
if (report.failed.length) console.error('dump_lazy: failed to load', report.failed.map((f) => f.id).join(', '));
await import('../../dump.ts');
