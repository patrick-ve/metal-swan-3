/**
 * Local listening page for the generated audio (plain node http, no Vite):
 *
 *   npm run audio:review [-- --port 4300]      then open http://localhost:4300
 *
 * Lists every spec item with its candidates (processed takes, or raw takes not yet processed,
 * and the Voice Design previews), the prompt or text, duration and loudness, the current synth
 * version for comparison (sfx render on demand; songs when tmp/audio/music/<id>.wav exists from
 * `npm run audio -- --songs --wav`), and a loop test that plays across the seam. Picks autosave
 * to tmp/audio/picks.json; notes and 'regenerate' flags to tmp/audio/review-notes.json.
 * Binds to 127.0.0.1 only.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { join, normalize, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeWAV } from '../lib/wav';
import type { CandMeta } from './process';
import { candDir, isMayor, items, paths, pickKey, rawDir, readJson, slug, takesIn, type Item, type Paths, type Picks, type ReviewNotes, type Spec, type VoicesFile } from './lib';
import type { LineSpec, MusicSpec, SfxSpec, VoiceSpec } from './spec-types';

export interface Candidate {
  take: number;
  url: string;
  processed: boolean;
  duration: number | null;
  lufs: number | null;
  target: number | null;
  peak: number | null;
  loopStart: number | null;
  loopEnd: number | null;
  warnings: string[];
}

export interface ReviewItem {
  kind: Item['kind'];
  id: string;
  key: string;
  group: string | null;
  prompt: string;
  text: string | null;
  details: string[];
  keep: number;
  candidates: Candidate[];
  synth: string | null;
  savedVoice: string | null;
}

/** The URL of a file under tmp/audio (served by /a/...). */
function fileUrl(p: Paths, file: string): string {
  return `/a/${relative(join(p.root, 'tmp/audio'), file).split(sep).map(encodeURIComponent).join('/')}`;
}

export interface SynthInfo {
  hasSfx(id: string): boolean;
}

export function reviewItems(list: readonly Item[], p: Paths, synth: SynthInfo | null): ReviewItem[] {
  const voices = readJson<VoicesFile>(p.voices, {});
  return list.map((it) => {
    const details: string[] = [];
    let prompt = '';
    let text: string | null = null;
    let synthUrl: string | null = null;
    if (it.kind === 'sfx') {
      const s = it.spec as SfxSpec;
      prompt = s.prompt;
      details.push(`${s.seconds} s requested`);
      if (s.trimTo !== undefined) details.push(`trim to ${s.trimTo} s`);
      if (s.loop) details.push('loop');
      if (s.timing) details.push(`timing: ${s.timing}`);
      if (s.influence !== undefined) details.push(`influence ${s.influence}`);
      if (s.isNew) details.push('NEW sound');
      if (synth?.hasSfx(s.id)) synthUrl = `/synth/${encodeURIComponent(slug(s.id))}.wav`;
    } else if (it.kind === 'music') {
      const m = it.spec as MusicSpec;
      prompt = m.prompt;
      details.push(`${m.seconds} s`, `${m.bpm} BPM`, `${m.beatsPerBar}/4`, m.loop ? `loop, intro ${m.introBars ?? 0} bars` : 'one-shot');
      const wav = join(p.root, 'tmp/audio/music', `${m.id.replace(/\//g, '_')}.wav`);
      if (existsSync(wav)) synthUrl = fileUrl(p, wav);
    } else if (it.kind === 'voice') {
      const v = it.spec as VoiceSpec;
      prompt = v.description;
      text = v.previewText;
      details.push(`voice name "${v.name}"`);
      if (v.radio) details.push('radio');
      if (v.robot) details.push('robot filter');
    } else {
      const l = it.spec as LineSpec;
      prompt = l.say;
      text = l.text;
      details.push(`speaker ${l.speaker}`, l.lang === 'nl' ? 'Dutch' : l.lang === 'de' ? 'German' : 'English');
      if (l.maxSeconds !== undefined) details.push(`max ${l.maxSeconds} s`);
    }

    const candidates: Candidate[] = [];
    const rdir = rawDir(p, it.kind, it.id);
    if (it.kind === 'voice') {
      for (const n of takesIn(rdir, 'preview')) {
        const meta = readJson<{ duration?: number | null }>(join(rdir, `preview-${n}.json`), {});
        candidates.push({ take: n, url: fileUrl(p, join(rdir, `preview-${n}.mp3`)), processed: true, duration: meta.duration ?? null, lufs: null, target: null, peak: null, loopStart: null, loopEnd: null, warnings: [] });
      }
    } else {
      const cdir = candDir(p, it.kind, it.id);
      const nums = [...new Set([...takesIn(rdir), ...takesIn(cdir)])].sort((a, b) => a - b);
      for (const n of nums) {
        const cand = join(cdir, `take-${n}.mp3`);
        const meta = readJson<CandMeta | null>(join(cdir, `take-${n}.json`), null);
        if (existsSync(cand) && meta) {
          candidates.push({ take: n, url: fileUrl(p, cand), processed: true, duration: meta.duration, lufs: meta.lufs, target: meta.target, peak: meta.peak, loopStart: meta.loopStart, loopEnd: meta.loopEnd, warnings: meta.warnings });
        } else {
          candidates.push({ take: n, url: fileUrl(p, join(rdir, `take-${n}.mp3`)), processed: false, duration: null, lufs: null, target: null, peak: null, loopStart: null, loopEnd: null, warnings: ['raw take, not processed yet'] });
        }
      }
    }
    return {
      kind: it.kind,
      id: it.id,
      key: pickKey(it.kind, it.id),
      group: it.group,
      prompt,
      text,
      details,
      keep: it.keep,
      candidates,
      synth: synthUrl,
      savedVoice: it.kind === 'voice' ? (voices[it.id]?.voice_id ?? null) : null,
    };
  });
}

/** Merges a posted state into the files (each map replaces the stored one when present). */
export function saveState(p: Paths, body: { picks?: Picks; notes?: Record<string, string>; regen?: Record<string, boolean> }, keepOf: ReadonlyMap<string, number>): void {
  const write = (file: string, data: unknown): void => {
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(`${file}.tmp`, `${JSON.stringify(data, null, 2)}\n`);
    renameSync(`${file}.tmp`, file);
  };
  if (body.picks) {
    const clean: Picks = {};
    for (const [k, v] of Object.entries(body.picks).sort(([a], [b]) => (a < b ? -1 : 1))) {
      const keep = keepOf.get(k);
      if (keep === undefined || !Array.isArray(v)) continue;
      const takes = [...new Set(v.filter((n) => Number.isInteger(n) && n > 0))].sort((a, b) => a - b).slice(0, keep);
      if (takes.length) clean[k] = takes;
    }
    write(p.picks, clean);
  }
  if (body.notes || body.regen) {
    const cur = readJson<ReviewNotes>(p.notes, { notes: {}, regen: {} });
    if (body.notes) cur.notes = Object.fromEntries(Object.entries(body.notes).filter(([, v]) => typeof v === 'string' && v.trim()));
    if (body.regen) cur.regen = Object.fromEntries(Object.entries(body.regen).filter(([, v]) => v === true));
    write(p.notes, cur);
  }
}

/**
 * A state POST comes from the review page itself: the Host is the local server (no DNS
 * rebinding) and the browser's Origin, when sent, is that same host (no other web page).
 */
export function sameOrigin(host: string | undefined, origin: string | undefined): boolean {
  if (!host || !/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) return false;
  return origin === undefined || origin === `http://${host}`;
}

const TYPES: Record<string, string> = { '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.json': 'application/json' };

export interface ReviewServerOptions {
  spec: Spec;
  p: Paths;
  /** Renders the synth version of an sfx id (null: no synth comparison). */
  synth?: (SynthInfo & { render(id: string): { samples: Float32Array; rate: number } | null }) | null;
}

export function createReviewServer(opts: ReviewServerOptions): ReturnType<typeof createServer> {
  const { spec, p } = opts;
  const list = items(spec);
  const keepOf = new Map(list.map((it) => [pickKey(it.kind, it.id), it.keep]));
  const audioRoot = join(p.root, 'tmp/audio');

  const send = (res: ServerResponse, status: number, type: string, body: string | Buffer | Uint8Array): void => {
    res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
    res.end(body);
  };

  const readBody = (req: IncomingMessage): Promise<string> =>
    new Promise((ok, fail) => {
      let s = '';
      req.on('data', (c: Buffer) => {
        s += c.toString('utf8');
        if (s.length > 4_000_000) req.destroy();
      });
      req.on('end', () => ok(s));
      req.on('error', fail);
    });

  return createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      try {
        if (req.method === 'GET' && url.pathname === '/') return send(res, 200, 'text/html; charset=utf-8', PAGE);
        if (req.method === 'GET' && url.pathname === '/api/items') {
          const body = {
            items: reviewItems(list, p, opts.synth ?? null),
            picks: readJson<Picks>(p.picks, {}),
            ...readJson<ReviewNotes>(p.notes, { notes: {}, regen: {} }),
          };
          return send(res, 200, 'application/json', JSON.stringify(body));
        }
        if (req.method === 'POST' && url.pathname === '/api/state') {
          // Only the page itself may save: no other web page (Origin) and no rebound host name.
          if (!sameOrigin(req.headers.host, req.headers.origin)) return send(res, 403, 'text/plain', 'forbidden');
          saveState(p, JSON.parse(await readBody(req)) as Parameters<typeof saveState>[1], keepOf);
          return send(res, 200, 'application/json', '{"ok":true}');
        }
        if (req.method === 'GET' && url.pathname.startsWith('/a/')) {
          const rel = decodeURIComponent(url.pathname.slice(3));
          const file = normalize(join(audioRoot, rel));
          const ext = file.slice(file.lastIndexOf('.'));
          if (!file.startsWith(audioRoot + sep) || !TYPES[ext] || !existsSync(file)) return send(res, 404, 'text/plain', 'not found');
          return send(res, 200, TYPES[ext], readFileSync(file));
        }
        if (req.method === 'GET' && url.pathname.startsWith('/synth/') && opts.synth) {
          const name = decodeURIComponent(url.pathname.slice(7)).replace(/\.wav$/, '');
          const it = list.find((x) => x.kind === 'sfx' && slug(x.id) === name);
          if (!it) return send(res, 404, 'text/plain', 'not found');
          const cache = join(p.cand, 'synth', `${name}.wav`);
          if (!existsSync(cache)) {
            const r = opts.synth.render(it.id);
            if (!r) return send(res, 404, 'text/plain', 'no synth version');
            mkdirSync(join(p.cand, 'synth'), { recursive: true });
            writeFileSync(cache, encodeWAV([r.samples], r.rate));
          }
          return send(res, 200, 'audio/wav', readFileSync(cache));
        }
        send(res, 404, 'text/plain', 'not found');
      } catch (err) {
        send(res, 500, 'text/plain', err instanceof Error ? err.message : String(err));
      }
    })();
  });
}

// ------------------------------------------------------------------------------------------ page

const PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Audio Review</title>
<style>
:root{--bg:#f6f5f2;--card:#fff;--fg:#1d1d1f;--mute:#6b6b70;--line:#e2e0da;--acc:#1f6feb;--warn:#b35900;--ok:#16794a;--pick:#e8f1ff}
@media (prefers-color-scheme:dark){:root{--bg:#151517;--card:#1f1f22;--fg:#ececef;--mute:#9a9aa2;--line:#33333a;--acc:#5b9cff;--warn:#f0a050;--ok:#4cc38a;--pick:#1b2a44}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.45 system-ui,-apple-system,sans-serif}
header{position:sticky;top:0;z-index:2;background:var(--bg);border-bottom:1px solid var(--line);padding:10px 16px;display:flex;flex-wrap:wrap;gap:8px;align-items:center}
header h1{font-size:16px;margin:0 12px 0 0}
button,select,input[type=search]{font:inherit;color:inherit;background:var(--card);border:1px solid var(--line);border-radius:6px;padding:4px 10px;cursor:pointer}
button.on{background:var(--acc);color:#fff;border-color:var(--acc)}
#status{margin-left:auto;color:var(--mute);font-size:12px}
main{max-width:1100px;margin:0 auto;padding:12px 16px 80px}
.item{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin:10px 0}
.item.done{border-left:4px solid var(--ok)}
.head{display:flex;flex-wrap:wrap;gap:8px;align-items:baseline}
.kind{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--mute)}
.id{font-weight:600;font-family:ui-monospace,Menlo,monospace}
.badge{font-size:11px;border:1px solid var(--line);border-radius:10px;padding:0 7px;color:var(--mute)}
.prompt{color:var(--mute);margin:4px 0;white-space:pre-wrap}
.text{font-weight:600;white-space:pre-wrap;margin:4px 0}
table{border-collapse:collapse;width:100%;margin-top:6px}td{padding:3px 8px 3px 0;vertical-align:middle;font-variant-numeric:tabular-nums}
tr.picked td{background:var(--pick)}
.warn{color:var(--warn);font-size:12px}
.none{color:var(--mute);font-style:italic}
.foot{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:8px}
textarea{flex:1;min-width:200px;font:inherit;color:inherit;background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:4px 8px;min-height:30px}
@media (max-width:600px){td:nth-child(5),td:nth-child(6){display:none}}
</style></head><body>
<header><h1>Audio Review</h1>
<span id="tabs"></span>
<select id="group"><option value="">all groups</option><option>boot</option><option>mission:ams</option><option>mode:fps</option></select>
<label><input type="checkbox" id="gen" checked> generated only</label>
<label><input type="checkbox" id="open"> unpicked only</label>
<input type="search" id="q" placeholder="filter">
<button id="stop">stop</button>
<span id="status"></span></header>
<main id="list"></main>
<script>
const S={items:[],picks:{},notes:{},regen:{},kind:'',saving:0};
let ctx=null,cur=null;const bufs=new Map();
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
async function buf(url){if(!ctx)ctx=new AudioContext();if(!bufs.has(url)){const r=await fetch(url);bufs.set(url,await ctx.decodeAudioData(await r.arrayBuffer()));}return bufs.get(url);}
function stop(){if(cur){try{cur.stop()}catch(e){}cur=null;}}
async function play(url,loop){stop();const b=await buf(url);const s=ctx.createBufferSource();s.buffer=b;s.connect(ctx.destination);
 if(loop){s.loop=true;s.loopStart=loop[0];s.loopEnd=loop[1];s.start(0,Math.max(loop[0],loop[1]-3));setStatus('loop test: 3 s before the seam, then looping');}
 else s.start();cur=s;s.onended=()=>{if(cur===s)cur=null};}
function setStatus(t){$('#status').textContent=t}
let timer=0;function save(){clearTimeout(timer);setStatus('saving...');timer=setTimeout(async()=>{
 const r=await fetch('/api/state',{method:'POST',body:JSON.stringify({picks:S.picks,notes:S.notes,regen:S.regen})});
 setStatus(r.ok?'saved to tmp/audio/picks.json':'save FAILED');},400);}
function fmt(v,d){return v==null?'-':Number(v).toFixed(d)}
function render(){
 const kinds=[['','all'],['sfx','sfx'],['music','music'],['voice','voices'],['line','lines']];
 $('#tabs').innerHTML=kinds.map(([k,l])=>'<button data-tab="'+k+'" class="'+(S.kind===k?'on':'')+'">'+l+' '+S.items.filter(i=>!k||i.kind===k).length+'</button>').join(' ');
 const g=$('#group').value,q=$('#q').value.toLowerCase(),open=$('#open').checked,gen=$('#gen').checked;
 const list=S.items.filter(i=>(!S.kind||i.kind===S.kind)&&(!g||i.group===g)&&(!open||!(S.picks[i.key]||[]).length)&&(!gen||i.candidates.length>0)
  &&(!q||(i.id+' '+i.prompt+' '+(i.text||'')).toLowerCase().includes(q)));
 const done=S.items.filter(i=>(S.picks[i.key]||[]).length).length;
 setStatus(done+' / '+S.items.length+' items picked');
 $('#list').innerHTML=list.map(i=>{const picked=S.picks[i.key]||[];const full=picked.length>=i.keep;
  const rows=i.candidates.map(c=>{const on=picked.includes(c.take);
   const loop=c.loopEnd!=null?'<button data-loop="'+esc(c.url)+'" data-ls="'+c.loopStart+'" data-le="'+c.loopEnd+'">loop test</button>':'';
   return '<tr class="'+(on?'picked':'')+'"><td><label><input type="checkbox" data-key="'+esc(i.key)+'" data-take="'+c.take+'" '+(on?'checked':'')+' '+(!on&&full?'disabled':'')+'> '+(i.kind==='voice'?'preview ':'take ')+c.take+'</label></td>'
   +'<td><button data-play="'+esc(c.url)+'">play</button> '+loop+'</td><td>'+fmt(c.duration,2)+' s</td>'
   +'<td>'+(c.lufs==null?'':fmt(c.lufs,1)+' LUFS')+'</td><td>'+(c.target==null?'':'target '+c.target)+'</td><td>'+(c.peak==null?'':'peak '+fmt(c.peak,2))+'</td>'
   +'<td class="warn">'+esc(c.warnings.join('; '))+'</td></tr>'}).join('');
  return '<div class="item '+(picked.length?'done':'')+'"><div class="head"><span class="kind">'+i.kind+'</span><span class="id">'+esc(i.id)+'</span>'
  +(i.group?'<span class="badge">'+esc(i.group)+'</span>':'')+'<span class="badge">keep '+i.keep+'</span>'+i.details.map(d=>'<span class="badge">'+esc(d)+'</span>').join('')
  +(i.synth?'<button data-play="'+esc(i.synth)+'">synth version</button>':'')
  +(i.kind==='voice'?'<span class="badge">'+(i.savedVoice?'saved as '+esc(i.savedVoice):'not saved yet (design-save)')+'</span>':'')+'</div>'
  +(i.text?'<div class="text">'+esc(i.text)+'</div>':'')+'<div class="prompt">'+esc(i.prompt)+'</div>'
  +(i.candidates.length?'<table>'+rows+'</table>':'<div class="none">not generated</div>')
  +'<div class="foot"><textarea data-note="'+esc(i.key)+'" placeholder="notes">'+esc(S.notes[i.key]||'')+'</textarea>'
  +'<label><input type="checkbox" data-regen="'+esc(i.key)+'" '+(S.regen[i.key]?'checked':'')+'> regenerate</label></div></div>'}).join('')||'<p class="none">nothing matches</p>';
}
document.addEventListener('click',e=>{const t=e.target;
 if(t.dataset.tab!==undefined){S.kind=t.dataset.tab;render();}
 else if(t.dataset.play){play(t.dataset.play).catch(err=>setStatus('play failed: '+err));}
 else if(t.dataset.loop){play(t.dataset.loop,[Number(t.dataset.ls)||0,Number(t.dataset.le)]).catch(err=>setStatus('play failed: '+err));}
 else if(t.id==='stop')stop();});
document.addEventListener('change',e=>{const t=e.target;
 if(t.dataset.take){const k=t.dataset.key,n=Number(t.dataset.take);const cur=new Set(S.picks[k]||[]);t.checked?cur.add(n):cur.delete(n);
  S.picks[k]=[...cur].sort((a,b)=>a-b);if(!S.picks[k].length)delete S.picks[k];save();render();}
 else if(t.dataset.regen){t.checked?S.regen[t.dataset.regen]=true:delete S.regen[t.dataset.regen];save();}
 else if(t.id==='group'||t.id==='open'||t.id==='gen')render();});
document.addEventListener('input',e=>{const t=e.target;if(t.dataset.note!==undefined){S.notes[t.dataset.note]=t.value;save();}else if(t.id==='q')render();});
fetch('/api/items').then(r=>r.json()).then(d=>{Object.assign(S,{items:d.items,picks:d.picks||{},notes:d.notes||{},regen:d.regen||{}});render();});
</script></body></html>`;

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const i = argv.indexOf('--port');
  const port = i >= 0 ? Number(argv[i + 1]) : 4300;
  const m = (await import('./spec')) as unknown as Spec;
  const spec: Spec = { SFX: m.SFX ?? [], MUSIC: m.MUSIC ?? [], VOICES: m.VOICES ?? [], LINES: (m.LINES ?? []).filter((l) => !isMayor(l.speaker)) };
  const { loadContent } = await import('../../src/game/content/index');
  const synth = await import('../../src/engine/synth');
  // Everything, the lazy first-person content too (its synth versions play on the fps cards).
  await loadContent(() => true);
  const server = createReviewServer({
    spec,
    p: paths(),
    synth: {
      hasSfx: (id) => synth.hasSfx(id),
      render: (id) => {
        const s = synth.renderSfx(id);
        return s ? { samples: s, rate: synth.SAMPLE_RATE } : null;
      },
    },
  });
  server.listen(port, '127.0.0.1', () => console.log(`audio review: http://localhost:${port}  (Ctrl+C to stop)`));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
