/**
 * tools/audio/mayor-placeholders.ts: the ffmpeg arguments of a placeholder clip (no ffmpeg run).
 */
import { describe, expect, it } from 'vitest';
import { PLACEHOLDER_TAG, placeholderArgs } from '../../tools/audio/mayor-placeholders';

describe('mayor placeholder clips', () => {
  it('write a tagged mono MP3 of the asked length to the asked file', () => {
    const args = placeholderArgs('/x/mayor/tot-ziens.mp3', 0.9, 440);
    expect(args.at(-1)).toBe('/x/mayor/tot-ziens.mp3');
    expect(args.join(' ')).toContain(':d=0.90');
    expect(args).toContain(`comment=${PLACEHOLDER_TAG}`);
    expect(args.slice(args.indexOf('-ac'), args.indexOf('-ac') + 2)).toEqual(['-ac', '1']);
    expect(args).toContain('libmp3lame');
  });

  it('fade out over the last 0.15 s', () => {
    expect(placeholderArgs('o.mp3', 1.4, 500).join(' ')).toContain('afade=t=out:st=1.25:d=0.15');
  });
});
