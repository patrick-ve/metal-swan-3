/**
 * The sprites of the ring's on-foot part (manifest entry `ring/foot/art`, so `npm run sprites --
 * ring/foot/` lists them): the jam's props (art-jam.ts) and the ring gangs on foot (gangs/art.ts).
 * The logic module (`ring/foot`, index.ts) imports both too.
 */
import './art-jam';
import './gangs/art';
// BLOCKADE+BOAT (wave B, additive): the blockade's decor (rf-b).
import './art-blok';
