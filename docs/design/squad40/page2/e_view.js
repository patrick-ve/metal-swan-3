
/* ---------------- animation viewer (selected hero) */
const vbuf=document.createElement('canvas');let VW=128,VH=72,VGY=62,VX=58;
const vbox=document.getElementById('vbox'),vscreen=document.getElementById('vscreen'),vg=vscreen.getContext('2d');
let vscale=1,G=0,vs=0,vt=0,vplay=true,vspeed=1,vacc=0,vbg='sheet';
function vsize(){const b=groupBox(HR,G);VW=Math.max(128,b[2]-b[0]+28);VH=Math.max(72,Math.max(0,b[3])-b[1]+20);VGY=VH-8-Math.max(0,b[3]);VX=Math.round(VW/2-(b[0]+b[2])/2);
  vbuf.width=VW;vbuf.height=VH;vlayout();}
function vlayout(){const dpr=window.devicePixelRatio||1;const r=vbox.getBoundingClientRect();const bw=Math.max(1,Math.floor(r.width*dpr)),bh=Math.max(1,Math.floor(r.height*dpr));
  vscreen.width=bw;vscreen.height=bh;vscreen.style.width=(bw/dpr)+'px';vscreen.style.height=(bh/dpr)+'px';vscale=Math.max(1,Math.min(Math.floor(bw/VW),Math.floor(bh/VH)));}
new ResizeObserver(vlayout).observe(vbox);
function vrender(){const g=vbuf.getContext('2d');g.imageSmoothingEnabled=false;bg(g,VW,VH,VGY,vbg);
  const grp=HR.groups[G],s=grp.steps[vs%grp.steps.length],{lf,uf,ff}=stepSprites(HR,s);drawStep(g,HR,s,VX,VGY,1);
  text(g,(vs+1)+'/'+grp.steps.length,3,3,vbg==='dark'?'#efe8dc':'#13101a');
  vg.imageSmoothingEnabled=false;vg.fillStyle='#000';vg.fillRect(0,0,vscreen.width,vscreen.height);
  vg.drawImage(vbuf,0,0,VW,VH,(vscreen.width-VW*vscale)>>1,(vscreen.height-VH*vscale)>>1,VW*vscale,VH*vscale);
  const sz=f=>f?`${f.w}×${f.h}`:'–';const stl=(s.st||[]).map(e=>e[0]+' '+(e[1]+1)).join(', ');
  document.getElementById('vfacts').innerHTML=`<dt>hero</dt><dd>${HR.name}</dd><dt>group</dt><dd>${grp.cat} · ${grp.title}</dd><dt>frame</dt><dd>${vs+1} of ${grp.steps.length}</dd><dt>hold</dt><dd>${s.t} ticks (${Math.round(s.t*1000/60)} ms)</dd>`+
    (ff?`<dt>sprite</dt><dd>${s.f[0]} ${s.f[1]+1} · full body ${sz(ff)}</dd>`:`<dt>upper</dt><dd>${s.u?s.u[0]+' '+(s.u[1]+1)+' · '+sz(uf):'–'}</dd>`+(uf&&uf.bk?`<dt>cape</dt><dd>${sz(uf.bk)}</dd>`:'')+`<dt>legs</dt><dd>${s.l?s.l[0]+' '+(s.l[1]+1)+' · '+sz(lf):'–'}</dd>`)+
    (stl?`<dt>stage</dt><dd>${stl}</dd>`:'')+(s.pal?`<dt>palette</dt><dd>${s.pal}</dd>`:'')+(s.hide?`<dt>blink</dt><dd>hidden this frame</dd>`:'')+
    `<dt>grid</dt><dd>384×216 · ×${vscale}</dd>`;}
function vstep(n){if(!vplay)return;vacc+=n*vspeed;const grp=HR.groups[G];while(vacc>=1){vacc-=1;vt++;if(vt>=grp.steps[vs].t){vt=0;vs=(vs+1)%grp.steps.length;}}}
function setG(k){G=k;vs=0;vt=0;vsize();strip();vrender();}
function buildTabs(){makeTabs(document.getElementById('tabs'),()=>G,setG,k=>HR.groups[k]?HR.groups[k].title:HEROES[0].groups[k].title);}
document.getElementById('vplay').addEventListener('click',e=>{vplay=!vplay;e.currentTarget.setAttribute('aria-pressed',vplay);e.currentTarget.textContent=vplay?'Play':'Paused';});
document.getElementById('vprev').addEventListener('click',()=>{const n=HR.groups[G].steps.length;vs=(vs-1+n)%n;vt=0;vrender();});
document.getElementById('vnext').addEventListener('click',()=>{const n=HR.groups[G].steps.length;vs=(vs+1)%n;vt=0;vrender();});
document.querySelectorAll('[data-sp]').forEach(b=>b.addEventListener('click',()=>{vspeed=+b.dataset.sp;setPressed('[data-sp]',b);}));
document.querySelectorAll('[data-bg]').forEach(b=>b.addEventListener('click',()=>{vbg=b.dataset.bg;setPressed('[data-bg]',b);vrender();}));
function strip(){const cv=document.getElementById('strip'),grp=HR.groups[G],n=grp.steps.length,b=groupBox(HR,G),S=3,dpr=window.devicePixelRatio||1;
  const CW=Math.max(64,b[2]-b[0]+8),CH=Math.max(60,Math.max(0,b[3])-b[1]+12),gy=CH-4-Math.max(0,b[3]),cx=Math.round(CW/2-(b[0]+b[2])/2);
  const SS=S*Math.max(1,Math.round(dpr));cv.width=(n*CW+8)*SS;cv.height=(CH+10)*SS;cv.style.width=(cv.width/dpr)+'px';cv.style.height=(cv.height/dpr)+'px';
  const tmp=document.createElement('canvas');tmp.width=n*CW+8;tmp.height=CH+10;const g=tmp.getContext('2d');g.imageSmoothingEnabled=false;g.fillStyle='#231e2e';g.fillRect(0,0,tmp.width,tmp.height);
  grp.steps.forEach((s,k)=>{const ox=4+k*CW;g.fillStyle='#2b2537';g.fillRect(ox+1,2,CW-2,CH-2);drawStep(g,HR,s,ox+cx,gy,1);text(g,(k+1)+' '+s.t+'T',ox+2,CH+2,'#a99fb3');});
  const x=cv.getContext('2d');x.imageSmoothingEnabled=false;x.drawImage(tmp,0,0,tmp.width,tmp.height,0,0,cv.width,cv.height);}

/* ---------------- hero picker (play stage + viewer + card) */
function pickHero(k){HI=k;HR=HEROES[k];U=HR.U;Lo=HR.Lo;FU=HR.FU;
  H.act=null;H.seq=null;H.flip=null;H.dead=false;H.up={n:'idle',f:0,t:0};H.lo={n:'stand',f:0,t:0};H.wpn='p';H.he=0;H.un=null;startDrop();
  if(G>=HR.groups.length)G=0;vs=0;vt=0;buildTabs();vsize();strip();vrender();lrender();card();
  document.querySelectorAll('.heropick button').forEach(b=>b.setAttribute('aria-pressed',+b.dataset.h===k?'true':'false'));
  document.getElementById('knifeKey').textContent=HR.melee.toLowerCase();document.getElementById('padKnife').textContent=HR.melee.split(' ')[0].toUpperCase();
  document.querySelectorAll('.curname').forEach(e=>e.textContent=HR.name);}
document.querySelectorAll('.heropick').forEach(box=>HEROES.forEach((h,k)=>{const b=document.createElement('button');b.textContent=h.name;b.dataset.h=k;b.setAttribute('aria-pressed',k===0?'true':'false');b.addEventListener('click',()=>pickHero(k));box.appendChild(b);}));

/* ---------------- hero card: notes + palette */
function card(){const n=HR.notes;document.getElementById('cardName').textContent=HR.name;document.getElementById('cardRole').textContent=n.role;
  document.getElementById('cardList').innerHTML=n.items.map(([k,v])=>`<dt>${k}</dt><dd>${v}</dd>`).join('');
  const sw=document.getElementById('swatches');sw.innerHTML='';for(const [nm,ks] of n.ramps){const d=document.createElement('div');d.className='ramp';d.innerHTML=`<div class="chips">${[...ks].map(k=>`<span style="background:${HR.pal[k]}" title="${HR.pal[k]}"></span>`).join('')}</div><small>${nm}</small>`;sw.appendChild(d);}
  const cv=document.getElementById('cardSprite'),t=document.createElement('canvas');t.width=56;t.height=50;const g=t.getContext('2d');const lf=HR.Lo.stand[0],uf=HR.U.idle[0];drawHeroAt(g,26,47,1,lf,uf,null,HR);
  cv.width=t.width*5;cv.height=t.height*5;const x=cv.getContext('2d');x.imageSmoothingEnabled=false;x.clearRect(0,0,cv.width,cv.height);x.drawImage(t,0,0,t.width,t.height,0,0,cv.width,cv.height);}

/* ---------------- numbers */
{const th=document.getElementById('numhead');th.innerHTML='<th>Measure</th><th>Reference</th>'+HEROES.map(h=>`<th>${h.name}</th>`).join('');
 const S=h=>h.stats,F=h=>h.stats.frames,f=(h,k)=>F(h)[k]||0;
 const fam=(h,pre)=>{const ks=Object.keys(F(h)).filter(k=>k.startsWith(pre));return ks.length?`${ks.length} sets · ${ks.reduce((s,k)=>s+F(h)[k],0)} fr`:'–';};
 const list=(h,ks)=>ks.map(k=>f(h,k)||'–').join(' / ');
 const rows=[
  ['Standing height (head to sole, with outline)','40–43 px',h=>S(h).height+' px'],
  ['Upper-body sprite (idle)','≈ 29 × 29 px',h=>S(h).idle_upper.join(' × ')],
  ['Legs sprite (standing)','≈ 21 × 16 px',h=>S(h).stand_lower.join(' × ')],
  ['Colours, upper / legs / all sprites','13 / 5 / –',h=>S(h).upper_colours+' / '+S(h).lower_colours+' / '+(S(h).all_colours||'–')],
  ['Idle','4',h=>F(h).idle],['Idle fidget','8–18',h=>F(h).fidget],['Run (upper + legs)','12 + 12',h=>F(h).run+' + '+F(h).run],
  ['Jump (standing / running)','6–7',h=>F(h).jump+' / '+F(h).jumprun],['Crouch (down / idle / walk)','– / 4 / 7',h=>F(h).crouchdown+' / '+F(h).crouchidle+' / '+F(h).crawl],
  ['Shoot forward','10',h=>F(h).shoot],['Shoot up (turn + fire)','≈ 10',h=>F(h).aimup+' + '+F(h).shootup],['Shoot down in a jump','–',h=>F(h).aimdown+' + '+F(h).shootdown],
  ['Crouch shoot','10',h=>F(h).crouchshoot],['Grenade throw','6',h=>F(h).grenade],['Melee (two moves)','6 / 6',h=>`${F(h).slash} / ${F(h).stab}<br><small>${h.melee}</small>`],['Death','–',h=>F(h).death],
  ['Shoot diagonal, up / down','–',h=>(f(h,'diagup')+f(h,'shootdiagup'))+' / '+(f(h,'diagdown')+f(h,'shootdiagdown'))],
  ['Crouch throw / crouch melee','–',h=>list(h,['crouchgrenade','crouchslash'])],
  ['Heavy weapon (upper sets)','–',h=>fam(h,'h_')],
  ['Legs: fall / land / stand up / dangle','–',h=>list(h,['fall','land','crouchup','dangle'])],
  ['Deaths: burn / blast / drown / flat','–',h=>list(h,['death_burn','death_blast','death_drown','death_flat'])],
  ['Victory / respawn / bored / 2nd fidget','–',h=>list(h,['victory','spawn','bored','fidgetb'])],
  ['Time out: yawn / sleep','–',h=>list(h,['yawn','sleep'])],
  ['Mount / Swan hop / somersault','–',h=>list(h,['mount','mounthop','flip'])],
  ['Swan ride (rider poses)','9',h=>fam(h,'ride_')],
  ['Helium Head (sets)','–',h=>fam(h,'he_')]];
 document.getElementById('numbers').innerHTML=rows.map(r=>`<tr><td>${r[0]}</td><td class="num">${r[1]}</td>${HEROES.map(h=>`<td class="num">${r[2](h)}</td>`).join('')}</tr>`).join('');}

/* ---------------- loop */
pickHero(0);
let last=performance.now(),acc=0;const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
if(reduce){vplay=false;const b=document.getElementById('vplay');b.setAttribute('aria-pressed','false');b.textContent='Paused';setDemo(false);}
let lplay=!reduce;document.getElementById('lplay').setAttribute('aria-pressed',lplay);document.getElementById('lplay').textContent=lplay?'Play':'Paused';
document.getElementById('lplay').addEventListener('click',e=>{lplay=!lplay;e.currentTarget.setAttribute('aria-pressed',lplay);e.currentTarget.textContent=lplay?'Play':'Paused';});
function loop(now){const dt=Math.min(100,now-last);last=now;acc+=dt;let n=0;while(acc>=1000/60){step();tick++;acc-=1000/60;n++;}
  vstep(n);if(lplay)lstep(n);render();blit();if(n){vrender();lrender();}requestAnimationFrame(loop);}
render();blit();vrender();lrender();requestAnimationFrame(loop);
</script>
