/**
 * The review page's style and script (tools/art40/review/build.ts inlines both; the page reads
 * its data from `const DATA`, the PageData of build.ts). No external requests.
 */

export const PAGE_CSS = `
:root {
  --bg: #f4f2ee; --fg: #1d1b19; --muted: #6a645c; --line: #d8d3cb; --panel: #ffffff;
  --stage: #e9e5de; --stage-line: #b9b2a6; --accent: #b0451d; --ok: #2f7a3a; --warn: #9a6a00; --fail: #b3261e;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #15131a; --fg: #ece8e1; --muted: #a29b90; --line: #333040; --panel: #1d1b24;
    --stage: #24212c; --stage-line: #4a4558; --accent: #f08a5d; --ok: #6cc47a; --warn: #e2b44a; --fail: #f07068;
    color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --bg: #15131a; --fg: #ece8e1; --muted: #a29b90; --line: #333040; --panel: #1d1b24;
  --stage: #24212c; --stage-line: #4a4558; --accent: #f08a5d; --ok: #6cc47a; --warn: #e2b44a; --fail: #f07068;
  color-scheme: dark;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; }
.top { position: sticky; top: 0; z-index: 5; display: flex; flex-wrap: wrap; gap: 8px 24px; align-items: center; justify-content: space-between;
  padding: 10px 16px; background: var(--panel); border-bottom: 1px solid var(--line); }
h1 { font-size: 18px; margin: 0; }
h2 { font-size: 16px; margin: 28px 0 8px; }
h3 { font-size: 15px; margin: 0; display: inline; }
.sub, .hint { color: var(--muted); margin: 2px 0 0; }
.controls { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; }
button, select { font: inherit; color: var(--fg); background: var(--bg); border: 1px solid var(--line); border-radius: 6px; padding: 3px 10px; }
main { padding: 0 16px 48px; max-width: 1600px; }
.toc { padding: 8px 16px; display: flex; flex-wrap: wrap; gap: 4px 12px; border-bottom: 1px solid var(--line); }
.toc a { color: var(--accent); text-decoration: none; }
.scroll { overflow-x: auto; max-width: 100%; }
canvas { image-rendering: pixelated; display: block; }
section, details.char { scroll-margin-top: 96px; }
details.char { border: 1px solid var(--line); border-radius: 8px; background: var(--panel); margin: 8px 0; }
details.char > summary { cursor: pointer; padding: 8px 12px; display: flex; flex-wrap: wrap; gap: 4px 14px; align-items: baseline; }
details.char > .body { padding: 0 12px 12px; }
.tag { font-size: 12px; padding: 1px 8px; border-radius: 10px; border: 1px solid var(--line); color: var(--muted); }
.tag.ok { color: var(--ok); border-color: var(--ok); } .tag.fail { color: var(--fail); border-color: var(--fail); }
.rows { display: grid; grid-template-columns: minmax(120px, 220px) auto auto 1fr; gap: 6px 14px; align-items: end; }
.rows .h { color: var(--muted); font-size: 12px; align-self: end; border-bottom: 1px solid var(--line); }
.rows .name { font-family: ui-monospace, Menlo, monospace; font-size: 12px; word-break: break-all; align-self: center; }
.rows .info { font-size: 12px; color: var(--muted); align-self: center; }
.rows .stage { background: var(--stage); border-radius: 4px; }
.rows .none { background: repeating-linear-gradient(45deg, var(--stage), var(--stage) 4px, transparent 4px, transparent 8px); width: 24px; height: 24px; border-radius: 4px; }
table.check { border-collapse: collapse; font-size: 12px; font-family: ui-monospace, Menlo, monospace; }
table.check th, table.check td { border-bottom: 1px solid var(--line); padding: 3px 8px; text-align: right; white-space: nowrap; }
table.check th:first-child, table.check td:first-child { text-align: left; }
td.pass { color: var(--ok); } td.warn { color: var(--warn); } td.fail { color: var(--fail); font-weight: 700; } td.skip { color: var(--muted); }
pre.findings, pre.notes { white-space: pre-wrap; font-size: 12px; background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 8px 10px; }
.looks { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-start; }
.looks figure { margin: 0; } .looks figcaption { font-size: 12px; color: var(--muted); }
.looks img { image-rendering: pixelated; background: var(--stage); max-width: 100%; }
.lineup-names { font-size: 12px; color: var(--muted); margin: 4px 0 14px; }
.sel { margin: 6px 0 10px; display: flex; flex-wrap: wrap; gap: 6px 16px; }
`;

export const PAGE_JS = `
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const S = { zoom: 3, playing: true, marks: false, tick: 0, lu: 'new' };
  const images = new Map();
  let dirtyAll = true;
  function image(src) {
    let i = images.get(src);
    if (!i) { i = new Image(); i.onload = () => { dirtyAll = true; }; i.src = src; images.set(src, i); }
    return i;
  }
  function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  function prep(st) {
    if (st._durs) return st;
    const d = st.durations && st.durations.length ? st.durations : [6];
    st._durs = Array.from({ length: st.n }, (_, i) => Math.max(1, d[i % d.length] | 0));
    st._total = st._durs.reduce((a, b) => a + b, 0);
    return st;
  }
  function frameAt(st, tick) {
    prep(st);
    const cycle = st.loop ? st._total : st._total + 30;
    let t = tick % cycle;
    for (let i = 0; i < st.n; i++) { if (t < st._durs[i]) return i; t -= st._durs[i]; }
    return st.n - 1;
  }
  // Variant palettes: a recoloured copy of the strip image (exact colour swap).
  const recolored = new Map();
  function variantSource(st, pal, vpal, key) {
    if (!vpal) return image(st.src);
    let c = recolored.get(key);
    if (c) return c;
    const img = image(st.src);
    if (!img.complete || !img.naturalWidth) return null;
    c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height);
    const map = new Map();
    pal.forEach((p, i) => { if (i > 0) map.set(p.toLowerCase(), vpal[i]); });
    const hex = (r, g, b) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
    for (let p = 0; p < d.data.length; p += 4) {
      if (!d.data[p + 3]) continue;
      const to = map.get(hex(d.data[p], d.data[p + 1], d.data[p + 2]));
      if (!to) continue;
      const n = parseInt(to.slice(1), 16);
      d.data[p] = (n >> 16) & 255; d.data[p + 1] = (n >> 8) & 255; d.data[p + 2] = n & 255;
    }
    x.putImageData(d, 0, 0);
    recolored.set(key, c);
    return c;
  }

  // ---------------------------------------------------------------- players
  const players = new Set();
  function makePlayer(sides) {
    const box = { L: 0, R: 1, T: 0, B: 1 };
    for (const s of sides) { if (!s) continue; const c = s.st.cell; box.L = Math.max(box.L, c.ax); box.R = Math.max(box.R, c.w - c.ax); box.T = Math.max(box.T, c.ay); box.B = Math.max(box.B, c.h - c.ay); }
    const els = sides.map((s) => {
      if (!s) { const d = document.createElement('div'); d.className = 'none'; return d; }
      const cv = document.createElement('canvas'); cv.className = 'stage'; return cv;
    });
    const p = { sides, els, box, last: [], visible: false };
    els.forEach((el) => { if (el.tagName === 'CANVAS') io.observe(el); el._player = p; });
    players.add(p);
    return p;
  }
  const io = new IntersectionObserver((es) => {
    for (const e of es) {
      const p = e.target._player;
      if (!p) continue;
      e.target._in = e.isIntersecting;
      p.visible = p.els.some((x) => x._in);
      p.last = [];
    }
  });
  function drawPlayer(p, force) {
    const z = S.zoom;
    const W = (p.box.L + p.box.R) * z, H = (p.box.T + p.box.B) * z;
    p.sides.forEach((s, k) => {
      if (!s) return;
      const cv = p.els[k];
      const f = frameAt(s.st, S.tick);
      if (!force && p.last[k] === f && cv.width === W) return;
      const src = s.source();
      if (!src) return;
      p.last[k] = f;
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      const x = cv.getContext('2d');
      x.imageSmoothingEnabled = false;
      x.clearRect(0, 0, W, H);
      const c = s.st.cell;
      const ox = p.box.L - c.ax, oy = p.box.T - c.ay;
      x.drawImage(src, f * c.w, 0, c.w, c.h, ox * z, oy * z, c.w * z, c.h * z);
      if (S.marks) {
        x.fillStyle = '#00e5ff';
        x.fillRect(p.box.L * z - 1, p.box.T * z - 1, 3, 3);
        x.strokeStyle = '#ff2bd6';
        const pts = s.st.pts[f] || {};
        for (const k2 in pts) { const q = pts[k2]; x.strokeRect((p.box.L + q[0]) * z + 0.5, (p.box.T + q[1]) * z + 0.5, Math.max(1, z - 1), Math.max(1, z - 1)); }
      }
    });
  }

  // ---------------------------------------------------------------- characters
  function groupOf(id) { const i = id.lastIndexOf('/'); return i < 0 ? id : id.slice(0, i); }
  function rowsOf(ch) {
    const rows = new Map();
    for (const id in ch.old) rows.set(id, { id, old: ch.old[id] });
    for (const set of ch.sets) {
      const prefixes = [[set.prefix, null], ...Object.entries(set.variants)];
      for (const [pre, vpal] of prefixes) for (const name in set.strips) {
        const id = pre + '/' + name;
        const r = rows.get(id) || { id };
        r.neu = { set, name, vpal, st: set.strips[name] };
        rows.set(id, r);
      }
    }
    return rows;
  }
  function info(r) {
    const parts = [];
    if (r.old) { prep(r.old); parts.push('old ' + r.old.n + ' f / ' + r.old._total + ' t' + (r.old.loop ? ' loop' : '')); }
    if (r.neu) {
      const st = prep(r.neu.st);
      parts.push('new ' + st.n + ' f / ' + st._total + ' t' + (st.loop ? ' loop' : '') + (st.cls ? ' · ' + st.cls : '') + (st.smear ? ' · smear ' + st.smear.join(',') : ''));
      if (st.why) parts.push('why: ' + st.why);
    }
    return parts.join(' — ');
  }
  function buildChar(ch, body) {
    const rows = rowsOf(ch);
    const groups = [...new Set([...rows.keys()].map(groupOf))].sort();
    const withNew = groups.find((g) => [...rows.values()].some((r) => r.neu && groupOf(r.id) === g));
    const sel = document.createElement('div'); sel.className = 'sel';
    const gs = document.createElement('select');
    for (const g of groups) { const o = document.createElement('option'); o.value = g; o.textContent = g + ' (' + [...rows.keys()].filter((id) => groupOf(id) === g).length + ')'; gs.appendChild(o); }
    gs.value = withNew || groups[0];
    const lab = document.createElement('label'); lab.textContent = 'Id group '; lab.appendChild(gs); sel.appendChild(lab);
    for (const set of ch.sets) {
      const ev = Object.entries(set.events).map(([k, v]) => k + ' = ' + v).join(', ');
      const t = document.createElement('span'); t.className = 'hint';
      t.textContent = set.slug + ': ' + (set.pal.length - 1) + ' colours' + (ev ? ' · events ' + ev : '') + (Object.keys(set.variants).length ? ' · variants ' + Object.keys(set.variants).join(', ') : '');
      sel.appendChild(t);
    }
    body.appendChild(sel);
    const grid = document.createElement('div'); grid.className = 'rows';
    body.appendChild(grid);
    function fill() {
      for (const p of [...players]) if (p.char === ch) { p.els.forEach((e) => io.unobserve(e)); players.delete(p); }
      grid.innerHTML = '';
      for (const h of ['strip', 'old', 'new', 'frames / ticks']) { const d = document.createElement('div'); d.className = 'h'; d.textContent = h; grid.appendChild(d); }
      for (const r of rows.values()) {
        if (groupOf(r.id) !== gs.value) continue;
        const oldSide = r.old ? { st: r.old, source: () => image(r.old.src) } : null;
        const n = r.neu;
        const newSide = n ? { st: n.st, source: () => variantSource(n.st, n.set.pal, n.vpal, r.id) } : null;
        const p = makePlayer([oldSide, newSide]);
        p.char = ch;
        const name = document.createElement('div'); name.className = 'name'; name.textContent = r.id.slice(gs.value.length + 1) || r.id;
        name.title = r.id;
        const a = document.createElement('div'); a.className = 'scroll'; a.appendChild(p.els[0]);
        const b = document.createElement('div'); b.className = 'scroll'; b.appendChild(p.els[1]);
        const i = document.createElement('div'); i.className = 'info'; i.textContent = info(r);
        grid.append(name, a, b, i);
        drawPlayer(p, true);
      }
    }
    gs.addEventListener('change', fill);
    fill();
  }
  function renderChars() {
    const root = $('chars');
    for (const ch of DATA.characters) {
      const d = document.createElement('details'); d.className = 'char'; d.id = 'char-' + ch.name;
      const s = document.createElement('summary');
      const h = document.createElement('h3'); h.textContent = ch.name; s.appendChild(h);
      const tags = [['wave ' + ch.wave, ''], [Object.keys(ch.old).length + ' old ids', '']];
      if (ch.sets.length) for (const set of ch.sets) tags.push([set.slug + ' baked: ' + Object.keys(set.strips).length + ' strips', set.passed ? 'ok' : 'fail']);
      else tags.push(['not baked yet', '']);
      for (const [t, c] of tags) { const e = document.createElement('span'); e.className = 'tag ' + c; e.textContent = t; s.appendChild(e); }
      d.appendChild(s);
      const body = document.createElement('div'); body.className = 'body'; d.appendChild(body);
      let built = false;
      d.addEventListener('toggle', () => {
        if (d.open && !built) { built = true; buildChar(ch, body); }
        for (const p of players) if (p.char === ch) p.active = d.open;
      });
      root.appendChild(d);
      const a = document.createElement('a'); a.href = '#char-' + ch.name; a.textContent = ch.name;
      a.addEventListener('click', () => { d.open = true; });
      $('toc').appendChild(a);
    }
  }

  // ---------------------------------------------------------------- line-up
  // The representative strip: the shortest id ending in 'idle', else a boss 'body' / 'body-0', else the first id of the largest id group.
  function pick(strips, ids) {
    const segs = (id) => id.split('/').length;
    const idle = ids.filter((id) => /(^|\\/)idle$/.test(id)).sort((a, b) => segs(a) - segs(b) || a.length - b.length || (a < b ? -1 : 1));
    let want = idle[0] || ids.filter((id) => /(^|\\/)body(-0)?$/.test(id)).sort((a, b) => a.length - b.length)[0];
    if (!want) {
      const count = new Map();
      for (const id of ids) count.set(groupOf(id), (count.get(groupOf(id)) || 0) + 1);
      const g = [...count.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0];
      want = g ? ids.filter((id) => groupOf(id) === g[0]).sort()[0] : undefined;
    }
    return want && strips[want] ? { st: strips[want], id: want } : null;
  }
  function repOf(ch, mode) {
    if (mode === 'new' && ch.sets.length) {
      const set = ch.sets[0];
      const r = pick(set.strips, Object.keys(set.strips));
      if (r) return { st: r.st, label: ch.name + ' (new)' };
    }
    const r = pick(ch.old, Object.keys(ch.old).sort());
    return r ? { st: r.st, label: ch.name + (mode === 'new' && !ch.sets.length ? ' (old)' : '') } : null;
  }
  function renderLineup() {
    const root = $('lineup');
    root.innerHTML = '';
    const vin = DATA.characters.find((c) => c.name === 'vincent');
    const others = DATA.characters.filter((c) => c !== vin).map((c) => repOf(c, S.lu)).filter(Boolean);
    const hero = vin ? repOf(vin, S.lu) : null;
    const GW = 384, GH = 216, GROUND = 196;
    const panels = [];
    let cur = null;
    for (const r of others) {
      const c = r.st.cell;
      if (!cur || cur.x + c.w > GW - 2) {
        cur = { x: 4, items: [] };
        if (hero) { cur.items.push({ r: hero, x: cur.x }); cur.x += hero.st.cell.w + 6; }
        panels.push(cur);
      }
      cur.items.push({ r, x: cur.x });
      cur.x += c.w + 6;
    }
    const z = Math.min(S.zoom, 4);
    for (const pn of panels) {
      const off = document.createElement('canvas'); off.width = GW; off.height = GH;
      const x = off.getContext('2d');
      x.fillStyle = cssVar('--stage'); x.fillRect(0, 0, GW, GH);
      x.fillStyle = cssVar('--stage-line'); x.fillRect(0, GROUND, GW, 1);
      for (const it of pn.items) {
        const c = it.r.st.cell;
        const img = image(it.r.st.src);
        if (img.complete) x.drawImage(img, 0, 0, c.w, c.h, it.x, GROUND - c.ay, c.w, c.h);
      }
      const cv = document.createElement('canvas'); cv.width = GW * z; cv.height = GH * z;
      const y = cv.getContext('2d'); y.imageSmoothingEnabled = false; y.drawImage(off, 0, 0, GW * z, GH * z);
      y.fillStyle = cssVar('--muted'); y.font = (9 + z) + 'px system-ui, sans-serif';
      pn.items.forEach((it, i) => y.fillText(String(i + 1), it.x * z, (GROUND + 9 + (i % 2) * 8) * z));
      const wrap = document.createElement('div'); wrap.className = 'scroll'; wrap.appendChild(cv); root.appendChild(wrap);
      const names = document.createElement('div'); names.className = 'lineup-names';
      names.textContent = pn.items.map((it, i) => (i + 1) + ' ' + it.r.label).join(' · ');
      root.appendChild(names);
    }
    if (!panels.length) root.textContent = 'No frames to line up.';
  }

  // ---------------------------------------------------------------- checks and looks
  function renderChecks() {
    const root = $('checks');
    if (!DATA.checks.length) { root.innerHTML = '<p class="hint">No baked sets yet (src/game/content/art40/ is empty).</p>'; return; }
    const gates = ['format', 'colour', 'outline', 'orphan', 'aa', 'class', 'contract', 'foot', 'smooth'];
    const t = document.createElement('table'); t.className = 'check';
    const head = ['set', 'budget', 'colours', 'max/frame', 'strips', 'frames', 'outline', 'orphans', 'halos', 'travel px/t', 'drift px', ...gates];
    t.innerHTML = '<thead><tr>' + head.map((h) => '<th>' + h + '</th>').join('') + '</tr></thead>';
    const tb = document.createElement('tbody');
    for (const r of DATA.checks) {
      const tr = document.createElement('tr');
      const cells = [r.slug, r.budget, r.colours, r.maxFrameColours, r.strips, r.frames, (r.outlineShare * 100).toFixed(0) + ' %', r.orphans, r.halos,
        r.worstTravel ? r.worstTravel.perTick.toFixed(2) : '-', r.worstDrift ? r.worstDrift.drift.toFixed(2) : '-'];
      for (const c of cells) { const td = document.createElement('td'); td.textContent = String(c); tr.appendChild(td); }
      for (const g of gates) { const td = document.createElement('td'); td.className = r.gates[g]; td.textContent = r.gates[g]; tr.appendChild(td); }
      tb.appendChild(tr);
    }
    t.appendChild(tb);
    const sc = document.createElement('div'); sc.className = 'scroll'; sc.appendChild(t); root.appendChild(sc);
    for (const r of DATA.checks) {
      const list = r.findings.filter((f) => f.level !== 'info').concat(r.findings.filter((f) => f.level === 'info'));
      if (!list.length) continue;
      const d = document.createElement('details');
      const s = document.createElement('summary'); s.textContent = r.slug + ': ' + list.filter((f) => f.level === 'fail').length + ' failures, ' + list.filter((f) => f.level === 'warn').length + ' warnings';
      const pre = document.createElement('pre'); pre.className = 'findings';
      pre.textContent = list.slice(0, 300).map((f) => f.level.toUpperCase() + ' ' + f.gate + (f.strip ? ' ' + f.strip : '') + (f.frame !== undefined ? '#' + f.frame : '') + ': ' + f.msg).join('\\n') + (list.length > 300 ? '\\n… ' + (list.length - 300) + ' more' : '');
      d.append(s, pre); root.appendChild(d);
    }
  }
  function renderLooks() {
    const root = $('looks');
    if (!DATA.looks.length) { root.innerHTML = '<p class="hint">No look samples yet (tmp/ams40-looks/&lt;name&gt;/*.png with notes.md).</p>'; return; }
    for (const l of DATA.looks) {
      const h = document.createElement('h3'); h.textContent = l.name; root.appendChild(h);
      if (l.notes) { const pre = document.createElement('pre'); pre.className = 'notes'; pre.textContent = l.notes; root.appendChild(pre); }
      const box = document.createElement('div'); box.className = 'looks';
      for (const im of l.images) {
        const f = document.createElement('figure');
        const i = document.createElement('img'); i.src = im.src; i.alt = l.name + ' ' + im.file; i.title = 'Click: 2× / 1×';
        i.addEventListener('load', () => { i.width = i.naturalWidth; });
        i.addEventListener('click', () => { i.width = i.width > i.naturalWidth ? i.naturalWidth : i.naturalWidth * 2; });
        const c = document.createElement('figcaption'); c.textContent = im.file;
        f.append(i, c); box.appendChild(f);
      }
      const sc = document.createElement('div'); sc.className = 'scroll'; sc.appendChild(box); root.appendChild(sc);
    }
  }

  // ---------------------------------------------------------------- controls and clock
  function effectiveDark() {
    const t = document.documentElement.dataset.theme;
    if (t) return t === 'dark';
    return matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function syncThemeButton() { $('theme').textContent = effectiveDark() ? 'Light background' : 'Dark background'; }
  $('theme').addEventListener('click', () => {
    document.documentElement.dataset.theme = effectiveDark() ? 'light' : 'dark';
    try { localStorage.setItem('ams40-review-theme', document.documentElement.dataset.theme); } catch (e) {}
    syncThemeButton(); renderLineup();
  });
  try { const t = localStorage.getItem('ams40-review-theme'); if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; } catch (e) {}
  syncThemeButton();
  $('zoom').addEventListener('change', (e) => { S.zoom = Number(e.target.value); dirtyAll = true; renderLineup(); });
  $('play').addEventListener('click', () => { S.playing = !S.playing; $('play').textContent = S.playing ? 'Pause' : 'Play'; });
  $('marks').addEventListener('change', (e) => { S.marks = e.target.checked; dirtyAll = true; });
  for (const r of document.querySelectorAll('input[name=lu]')) r.addEventListener('change', (e) => { S.lu = e.target.value; renderLineup(); });

  let acc = 0, prev = performance.now();
  function frame(now) {
    const dt = Math.min(100, now - prev); prev = now;
    if (S.playing) { acc += dt * 0.06; while (acc >= 1) { acc -= 1; S.tick++; } }
    const force = dirtyAll; dirtyAll = false;
    for (const p of players) if (p.active !== false && (p.visible || force)) drawPlayer(p, force);
    requestAnimationFrame(frame);
  }
  renderChars(); renderChecks(); renderLooks();
  // The line-up draws once its images are decoded (the first call creates them).
  renderLineup();
  Promise.all([...images.values()].map((i) => (i.complete ? null : new Promise((ok) => i.addEventListener('load', ok, { once: true }))))).then(renderLineup);
  requestAnimationFrame(frame);
})();
`;
