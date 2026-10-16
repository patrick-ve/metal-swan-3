/**
 * Lazy manifest entry `fps` (docs/design/fps.md §3.6): the first-person mode's core content —
 * the placeholder textures and floor 0. Never imported by the boot (`isLazyContent`); the
 * FpsIntroScene loads it behind its progress bar (`loadFpsContent`).
 */
import './textures-basic';
import './floor-0';
