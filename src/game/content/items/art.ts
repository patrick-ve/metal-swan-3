/**
 * Content category "items": sprite definitions only (docs/ARCHITECTURE.md §6.1, §7): crates,
 * pickups, hostages and their binds.
 */
import { defineBindSprites } from './binds.art';
import { defineCrateSprites } from './crate.art';
import { defineHostageSprites } from './hostage.art';
import { defineItemSprites } from './pickups.art';

defineBindSprites();
defineCrateSprites();
defineHostageSprites();
defineItemSprites();
