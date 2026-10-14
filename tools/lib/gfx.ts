/**
 * The sprite filter of the --res / --gfx options of the shot and arena tools, as the browser
 * would use it (docs/ARCHITECTURE.md §3): --gfx defaults to pixel (the GRAPHICS default); a filter whose
 * factor is above the res steps down (`modeAtRes`). Instead of falling back silently, the
 * result carries a sheet-title note naming the filter actually drawn and, when --gfx cannot
 * apply, a warning for stderr.
 */
import { modeAtRes } from '../../src/engine/render-common';
import type { UpscaleMode } from '../../src/engine/upscale';

export interface GfxChoice {
  /** The renderer mode to pass to the headless game. */
  mode: UpscaleMode;
  /** For the sheet title ('' at res 1). */
  note: string;
  /** A message for stderr when --gfx does not apply as asked, else null. */
  warning: string | null;
}

export function resolveGfx(res: number, gfx: UpscaleMode | null): GfxChoice {
  if (res <= 1) {
    const warning = gfx !== null && gfx !== 'pixel' ? `--gfx ${gfx} has no effect at --res 1 (no high-resolution backbuffer); add --res 2 or more` : null;
    return { mode: 'pixel', note: '', warning };
  }
  const mode = gfx ?? 'pixel';
  const used = modeAtRes(mode, res);
  if (used === mode) return { mode, note: `  res ${res} ${mode}`, warning: null };
  return {
    mode,
    note: `  res ${res} ${mode} (drawn as ${used})`,
    warning: `--gfx ${mode} needs --res ${mode === 'xbr' ? 4 : 2} or more; res ${res} draws sprites with ${used}`,
  };
}
