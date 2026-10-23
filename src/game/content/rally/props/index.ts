/**
 * The road's props (WORLD, wave B; docs/api/rally.md "B.2", "B.6", "B.W"). PREP's stub drew the
 * matrix-sign states as loose faces in front of TRACK's placeholder signs; WORLD's furniture
 * (`../signs`: the dressed gantries with one dynamic matrix mesh each, the flitspalen, the S-exit
 * signs, the hectometre boards, the average-speed boards) replaces it — this file loads it.
 * (Fixer, wave B: the stub's `buildSignFaces()` is gone; the contract test reads WORLD's sign page.)
 */
// WORLD's furniture registers itself at import (the scenery `world/signs`).
import '../signs/index';
