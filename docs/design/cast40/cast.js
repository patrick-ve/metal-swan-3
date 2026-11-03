// The cast page: line-ups per mission, a viewer next to VINCENT, one card per sample, numbers, notes.
const S = DATA.samples, OLD = DATA.old || {}, NOTES = DATA.notes || {};
const BY = Object.fromEntries(S.map(s => [s.id, s]));
const REF = BY.vincent;
const VIEW_W = 384;
const MNAME = { ams: 'Amsterdam', oldenzaal: 'Oldenzaal', oat: 'Oat', all: 'All missions' };
const RNAME = { hero: 'hero', enemy: 'enemy', boss: 'boss', npc: 'person', ally: 'ally', animal: 'animal' };
const $ = id => document.getElementById(id);
const el = (t, a = {}, ...kids) => { const e = document.createElement(t); for (const [k, v] of Object.entries(a)) { if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else e.setAttribute(k, v); } for (const k of kids) if (k != null) e.append(k); return e; };

// ---------- sprites ----------
const cache = {};
function rgba(h) {
  const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
  const a = h.length === 9 ? parseInt(h.slice(7, 9), 16) : 255;
  return [r, g, b, a];
}
function sprite(s) {
  if (cache[s.id]) return cache[s.id];
  const c = document.createElement('canvas'); c.width = s.w; c.height = s.h;
  const g = c.getContext('2d'), im = g.createImageData(s.w, s.h), pal = {};
  for (const [k, v] of Object.entries(s.pal)) pal[k] = rgba(v);
  s.rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const p = pal[r[x]]; if (!p) continue; const o = (y * s.w + x) * 4; im.data[o] = p[0]; im.data[o + 1] = p[1]; im.data[o + 2] = p[2]; im.data[o + 3] = p[3]; } });
  g.putImageData(im, 0, 0);
  return (cache[s.id] = c);
}
const oldImgs = {};
function oldImg(id, tag = '1x') {
  const o = OLD[id]; if (!o || !o['png' + tag]) return null;
  const k = id + '@' + tag;
  if (!oldImgs[k]) { const im = new Image(); im.onload = () => redrawAll(); im.src = o['png' + tag]; oldImgs[k] = im; }
  return oldImgs[k].complete && oldImgs[k].naturalWidth ? oldImgs[k] : null;
}
function blit(g, src, x, y, z) { g.imageSmoothingEnabled = false; g.drawImage(src, Math.round(x), Math.round(y), Math.round(src.width * z), Math.round(src.height * z)); }

// ---------- line-up ----------
let mission = 'ams';
function missions() {
  const ms = [...new Set(S.flatMap(s => s.mission).filter(m => m !== 'all'))];
  return [...ms.sort((a, b) => (a === 'ams' ? -1 : b === 'ams' ? 1 : a < b ? -1 : 1)), 'all'];
}
function pack(group) {
  const rows = []; let cur = [], x = 0;
  for (const s of [REF, ...group.filter(s => s.id !== 'vincent')]) {
    if (cur.length && x + s.w + 6 > VIEW_W) { rows.push(cur); cur = [[REF, 4]]; x = REF.w + 10; }
    cur.push([s, x + 4]); x += s.w + 6;
  }
  if (cur.length) rows.push(cur);
  return rows;
}
function drawStrips() {
  const box = $('strips'); box.textContent = '';
  const group = S.filter(s => mission === 'all' || s.mission.includes(mission));
  const avail = Math.max(VIEW_W, box.clientWidth - 14);
  const z = Math.max(1, Math.floor(avail / VIEW_W));
  for (const strip of pack(group)) {
    const top = Math.max(...strip.map(([s]) => s.h + (s.air || 0)));
    const h = top + 16, gy = h - 9;
    const c = el('canvas'); c.width = VIEW_W * z; c.height = h * z;
    c.setAttribute('role', 'img');
    c.setAttribute('aria-label', strip.map(([s]) => s.name).join(', '));
    const g = c.getContext('2d');
    const sky = g.createLinearGradient(0, 0, 0, gy * z); sky.addColorStop(0, '#7fc6e0'); sky.addColorStop(1, '#c9ecf4');
    g.fillStyle = sky; g.fillRect(0, 0, c.width, gy * z);
    g.fillStyle = '#5f6d58'; g.fillRect(0, gy * z, c.width, z);
    g.fillStyle = '#7d8a72'; g.fillRect(0, (gy + 1) * z, c.width, (h - gy - 1) * z);
    for (const [s, x] of strip) blit(g, sprite(s), x * z, (gy - s.ay - (s.air || 0)) * z, z);
    box.append(c);
  }
}
function buildMtabs() {
  const b = $('mtabs'); b.textContent = '';
  for (const m of missions()) {
    const n = S.filter(s => s.id !== 'vincent' && (m === 'all' || s.mission.includes(m))).length;
    const bt = el('button', { 'aria-pressed': String(m === mission), text: `${MNAME[m] || m} (${n})` });
    bt.onclick = () => { mission = m; buildMtabs(); drawStrips(); };
    b.append(bt);
  }
}

// ---------- viewer ----------
let sel = S.find(s => s.id !== 'vincent') || REF, zoom = 6, withRef = true, oldV = 'off';
function drawViewer() {
  const items = [];
  if (withRef && sel.id !== 'vincent') items.push({ src: sprite(REF), ay: REF.ay, air: 0, w: REF.w, h: REF.h });
  items.push({ src: sprite(sel), ay: sel.ay, air: sel.air || 0, w: sel.w, h: sel.h });
  // the current game frame: 1x, or its UHD frame (drawn at zoom / density, so both share one logical scale)
  const oi = oldV !== 'off' ? oldImg(sel.id, oldV === 'hd' ? 'hd' : '1x') : null;
  const od = oldV === 'hd' && OLD[sel.id] ? OLD[sel.id].hd : 1;
  if (oi) items.push({ src: oi, ay: oi.height / od, air: sel.air || 0, w: oi.width / od, h: oi.height / od, old: true, d: od });
  const gap = 8, W = items.reduce((a, it) => a + it.w + gap, gap);
  const top = Math.max(...items.map(it => it.ay + it.air)), H = top + 12, gy = H - 6;
  const c = $('vcan'); c.width = W * zoom; c.height = H * zoom;
  c.setAttribute('aria-label', `${sel.name} at ${zoom}x` + (withRef ? ', next to VINCENT' : ''));
  const g = c.getContext('2d');
  g.fillStyle = '#99d9ea'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#5f6d58'; g.fillRect(0, gy * zoom, c.width, zoom);
  g.fillStyle = '#7d8a72'; g.fillRect(0, (gy + 1) * zoom, c.width, c.height);
  let x = gap;
  for (const it of items) {
    blit(g, it.src, x * zoom, (gy - it.ay - it.air) * zoom, zoom / (it.d || 1));
    if (it.old) { g.fillStyle = '#13101a'; g.font = `${Math.max(10, zoom * 3)}px monospace`; g.fillText('now', x * zoom, (gy + 5) * zoom); }
    x += it.w + gap;
  }
  const f = $('vfacts'); f.textContent = '';
  f.append(el('h3', { text: sel.name }));
  const dl = el('dl');
  const row = (k, v) => { dl.append(el('dt', { text: k })); dl.append(el('dd', {}, v)); };
  row('role', el('span', { class: 'chip r-' + sel.role, text: RNAME[sel.role] || sel.role }));
  row('mission', sel.mission.map(m => MNAME[m] || m).join(', '));
  row('frame', sel.pose);
  if (sel.note) row('design', sel.note);
  row('size', `${sel.w} × ${sel.h} px, ${sel.colours} colours`);
  const o = OLD[sel.id];
  if (o) row('now', `${o.id} #${o.frame}, ${o.w} × ${o.h} px (1x)`);
  f.append(dl);
  if (!o) f.append(el('p', { class: 'readout', text: 'No current game frame for this sample.' }));
}
function buildOldV() {
  const b = $('oldV'); b.textContent = '';
  for (const [k, label] of [['off', 'New only'], ['1x', 'Now 1x'], ['hd', 'Now UHD']]) {
    const bt = el('button', { 'aria-pressed': String(k === oldV), text: label });
    bt.onclick = () => { oldV = k; buildOldV(); drawViewer(); };
    b.append(bt);
  }
}
function buildZooms() {
  const b = $('zooms'); b.textContent = '';
  for (const z of [2, 3, 4, 6, 8]) {
    const bt = el('button', { 'aria-pressed': String(z === zoom), text: z + 'x' });
    bt.onclick = () => { zoom = z; buildZooms(); buildOldV(); drawViewer(); };
    b.append(bt);
  }
}
function pick(id) { sel = BY[id]; drawViewer(); $('h-view').scrollIntoView({ behavior: 'smooth', block: 'start' }); }

// ---------- cards ----------
const FILTERS = [['all', 'All'], ['enemy', 'Enemies'], ['boss', 'Bosses'], ['npc', 'People'], ['animal', 'Animals and the Swan']];
let filt = 'all', withOld = false;
function inFilter(s) {
  if (filt === 'all') return true;
  if (filt === 'animal') return s.role === 'animal' || s.role === 'ally';
  return s.role === filt;
}
function fitZoom(w, h, bw, bh) { return Math.max(1, Math.min(8, Math.floor(Math.min(bw / w, bh / h)))); }
function card(s) {
  const box = el('button', { class: 'box', 'aria-label': `Open ${s.name} in the viewer` });
  box.onclick = () => pick(s.id);
  const oi = withOld ? oldImg(s.id) : null;
  const n = oi ? 2 : 1, bw = (236 - (n - 1) * 14) / n, bh = 186;
  let z = fitZoom(s.w, s.h, bw, bh);
  if (oi) z = Math.min(z, fitZoom(oi.width, oi.height, bw, bh));
  const mk = (src, label) => {
    const c = el('canvas'); c.width = src.width * z; c.height = src.height * z;
    blit(c.getContext('2d'), src, 0, 0, z);
    return label ? el('div', { class: 'pair' }, c, el('small', { text: label })) : c;
  };
  if (oi) { box.append(mk(oi, 'now')); box.append(mk(sprite(s), 'new')); } else box.append(mk(sprite(s)));
  box.append(el('span', { class: 'tag', text: z + 'x' }));
  const one = el('div', { class: 'one' });
  const c1 = el('canvas'); c1.width = s.w; c1.height = s.h; c1.getContext('2d').drawImage(sprite(s), 0, 0);
  c1.setAttribute('aria-label', '1x'); one.append(c1, el('span', { class: 'stats', text: `1x · ${s.w} × ${s.h} px · ${s.colours} colours` }));
  const body = el('div', { class: 'body' },
    el('div', { class: 'top' }, el('h3', { text: s.name }), el('span', { class: 'chip r-' + s.role, text: RNAME[s.role] || s.role }),
      el('span', { class: 'readout', text: s.mission.map(m => MNAME[m] || m).join(', ') })),
    el('div', { class: 'pose', text: s.pose }),
    s.note ? el('div', { class: 'note', text: s.note }) : null, one);
  return el('article', { class: 'card' }, box, body);
}
function drawCards() {
  const g = $('cards'); g.textContent = '';
  for (const s of S) if (inFilter(s)) g.append(card(s));
}
function buildRtabs() {
  const b = $('rtabs'); b.textContent = '';
  for (const [k, label] of FILTERS) {
    const n = S.filter(s => s.id !== 'vincent' && (k === 'all' || (k === 'animal' ? (s.role === 'animal' || s.role === 'ally') : s.role === k))).length;
    const bt = el('button', { 'aria-pressed': String(k === filt), text: `${label} (${n})` });
    bt.onclick = () => { filt = k; buildRtabs(); drawCards(); };
    b.append(bt);
  }
}

// ---------- numbers and notes ----------
function drawNums() {
  const t = $('nums'); t.textContent = '';
  t.append(el('thead', {}, el('tr', {}, ...['Sample', 'Role', 'Mission', 'New size', 'Colours', 'Now (1x)'].map(h => el('th', { text: h })))));
  const tb = el('tbody');
  for (const s of S) {
    const o = OLD[s.id];
    tb.append(el('tr', {}, el('td', { text: s.name }), el('td', { text: RNAME[s.role] || s.role }), el('td', { text: s.mission.map(m => MNAME[m] || m).join(', ') }),
      el('td', { class: 'num', text: `${s.w} × ${s.h}` }), el('td', { class: 'num', text: String(s.colours) }), el('td', { class: 'num', text: o ? `${o.w} × ${o.h}` : '–' })));
  }
  t.append(tb);
}
function drawNotes() {
  const n = $('notes'); n.textContent = '';
  for (const blk of NOTES.blocks || []) {
    n.append(el('h3', { text: blk.title }));
    if (blk.text) n.append(el('p', { text: blk.text }));
    if (blk.items) n.append(el('ul', { class: 'list' }, ...blk.items.map(i => el('li', { text: i }))));
  }
}
function redrawAll() { drawViewer(); drawCards(); }

$('lede').textContent = NOTES.lede || 'Every enemy and character of the live missions, one frame each, drawn at the approved squad fidelity on the 384 × 216 grid.';
$('vsBtn').onclick = () => { withRef = !withRef; $('vsBtn').setAttribute('aria-pressed', String(withRef)); drawViewer(); };
$('oldBtn').onclick = () => { withOld = !withOld; $('oldBtn').setAttribute('aria-pressed', String(withOld)); drawCards(); };
buildMtabs(); drawStrips(); buildZooms(); buildOldV(); drawViewer(); buildRtabs(); drawCards(); drawNums(); drawNotes();
let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(drawStrips, 120); });
