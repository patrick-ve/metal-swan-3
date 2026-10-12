/**
 * Browser side of tools/lib/audio-report.ts: bundled by Vite and run in headless Chromium,
 * where songs render through the real Web Audio instrument graph (OfflineAudioContext).
 */
import { renderSongOffline } from '../../src/engine/audio.browser';
import { listSongs } from '../../src/engine/music';
import { loadContent } from '../../src/game/content/index';

function toBase64(f: Float32Array): string {
  const bytes = new Uint8Array(f.buffer, f.byteOffset, f.byteLength);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

const api = {
  async load(): Promise<string[]> {
    await loadContent();
    return listSongs();
  },
  async render(id: string, seconds: number): Promise<{ rate: number; channels: string[] } | null> {
    const buf = await renderSongOffline(id, seconds);
    if (!buf) return null;
    const channels: string[] = [];
    for (let c = 0; c < buf.numberOfChannels; c++) channels.push(toBase64(buf.getChannelData(c)));
    return { rate: buf.sampleRate, channels };
  },
};

(window as unknown as { AudioReport: typeof api }).AudioReport = api;
