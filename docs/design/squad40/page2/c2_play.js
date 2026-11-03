
/* ---------------- the hero in the world */
const TARGETS=[230,470,650,870,1060].map(x=>({x,flash:0,wob:0}));
const CRATE={x:350,gone:0};          // heavy-weapon crate: walk into it (it comes back after a while)
let hits=0;
const H={x:70,y:GROUND,vx:0,vy:0,face:1,air:false,crouch:false,crouchT:0,cup:0,land:0,landT:0,kind:'jump',
  lo:{n:'stand',f:0,t:0},up:{n:'idle',f:0,t:0},act:null,idleT:0,blink:0,knifeAlt:0,aimT:0,aimN:null,un:null,wasRun:false,
  wpn:'p',ammo:0,he:0,pick:0,seq:null,flip:null,flipN:0,chute:null,fold:null,dk:'death',fid:0,dead:false};
const bullets=[],casings=[],grens=[],booms=[],dusts=[],sparks=[];
const SHOOT=['shoot','shootup','shootdown','crouchshoot','shootdiagup','shootdiagdown'],MELEE=['slash','stab','crouchslash'],THROW=['grenade','crouchgrenade'];
function adv(a,frames,loop){a.t++;if(a.t>=frames[a.f].t){a.t=0;a.f++;if(a.f>=frames.length){if(loop)a.f=0;else{a.f=frames.length-1;return true;}}}return false;}
/* the torso key for a base action: heavy sets are 'h_<base>', Helium Head sets 'he_<key>' */
function tk(b){const w=H.wpn==='h'?'h_':'';for(const k of (H.he?['he_'+w+b,w+b]:[w+b]))if(U[k])return k;return U[b]?b:null;}
function has(b){return !!tk(b);}
function setAct(b){const n=tk(b);if(!n)return;H.act={n,b,f:0,t:0};H.idleT=0;H.un=null;onActFrame();}
function pel(){const lf=curLower();return [H.x,H.y+(lf?lf.pel[1]:pel0(HR))];}
function curLower(){const L=Lo[H.lo.n]||Lo.stand;return L[Math.min(H.lo.f,L.length-1)];}
function ahead(){let best=null;for(const t of TARGETS){const d=(t.x-H.x)*H.face;if(d>4&&d<30&&(!best||d<best.d))best={t,d};}return best;}
function hitFrame(n){const F=U[n];const k=F.findIndex(f=>f.hit);return k>=0?k:Math.min(2,F.length-1);}
function fire(b,px,py,m){const mx=px+H.face*m[0],my=py+m[1];let d;
  if(m.length>2){const a=m[2]*Math.PI/180;d=[5*Math.cos(a)*H.face,5*Math.sin(a)];}
  else d=b==='shootup'?[0,-5]:b==='shootdown'?[0,5]:b==='shootdiagup'?[3.5*H.face,-3.5]:b==='shootdiagdown'?[3.5*H.face,3.5]:[5*H.face,0];
  bullets.push({x:mx,y:my,dx:d[0],dy:d[1],life:80,hv:H.wpn==='h'});
  casings.push({x:px+H.face*(m[0]-7),y:my-1,vx:-H.face*(0.5+Math.random()*0.5),vy:-2.1,life:70,b:0});
  if(H.wpn==='h'&&--H.ammo<=0){H.wpn='p';H.pick=10;}}
function onActFrame(){const a=H.act;if(!a)return;const fr=U[a.n][a.f];const [px,py]=pel();
  if(SHOOT.includes(a.b)){if(fr.shots)fr.shots.forEach(m=>fire(a.b,px,py,m));else if(a.f===0&&fr.mz)fire(a.b,px,py,fr.mz);}
  if(THROW.includes(a.b)&&a.f===3&&fr.rel){grens.push({x:px+H.face*fr.rel[0],y:py+fr.rel[1],vx:H.face*1.7+H.vx*0.5,vy:a.b==='crouchgrenade'?-2.0:-2.5,t:0});}
  if(MELEE.includes(a.b)&&a.f===hitFrame(a.n)){const t=ahead();if(t){t.t.flash=8;t.t.wob=10;hits++;sparks.push({x:t.t.x-H.face*3,y:GROUND-(a.b==='crouchslash'?9:15),t:10});}}}
/* full-body sequences come from the page groups, so stage sprites (water, snore letters) and offsets come along */
function fullSteps(key){for(const g of HR.groups){const st=g.steps.filter(s=>s.f&&s.f[0]===key);if(st.length)return st;}return (FU[key]||[]).map((f,i)=>({f:[key,i],t:f.t}));}
function playSeq(kind,key,opt){const steps=fullSteps(key);if(!steps.length)return false;H.seq={kind,steps,s:0,t:0,...(opt||{})};H.act=null;H.flip=null;return true;}
const CHUTE=(()=>{for(const g of HEROES[0].groups)for(const s of g.steps)for(const e of (s.st||[]))if(e[0]==='chute')return {dx:e[2],dy:e[3],z:e[4]};return null;})();
function startDrop(){H.x=Math.max(60,Math.min(LEVEL-60,H.x));H.y=GROUND-96;H.vy=0;H.vx=0;H.air=true;H.chute={t:0};H.seq=null;H.act=null;H.flip=null;H.dead=false;H.blink=0;}

const keys={},edge={};
const KMAP={arrowleft:'l',a:'l',arrowright:'r',d:'r',arrowup:'u',w:'u',arrowdown:'d',s:'d',z:'jump',' ':'jump',k:'jump',x:'fire',j:'fire',c:'bomb',l:'bomb',v:'knife',p:'die',
  q:'weapon',h:'helium',g:'cheer',t:'timeout'};
addEventListener('keydown',e=>{const k=KMAP[e.key.toLowerCase()];if(!k)return;if(e.target&&e.target.closest&&e.target.closest('button,select')&&(e.key===' '||e.key==='Enter'))return;
  if(!keys[k])edge[k]=true;keys[k]=true;if(demo)setDemo(false);e.preventDefault();});
addEventListener('keyup',e=>{const k=KMAP[e.key.toLowerCase()];if(k)keys[k]=false;});
document.querySelectorAll('[data-k]').forEach(b=>{const k=b.dataset.k;
  b.addEventListener('pointerdown',e=>{e.preventDefault();if(!keys[k])edge[k]=true;keys[k]=true;if(demo)setDemo(false);});
  for(const ev of ['pointerup','pointerleave','pointercancel'])b.addEventListener(ev,()=>{keys[k]=false;});});
document.querySelectorAll('[data-death]').forEach(b=>b.addEventListener('click',()=>{H.dk=b.dataset.death;setPressed('[data-death]',b);}));
const DEMO=[
 {t:30},{t:60,i:{r:1},fire:14},{t:22,i:{r:1},jump:1,fire:13},{t:30,i:{r:1}},{t:34,i:{u:1,r:1},fire:9},{t:40,i:{u:1},fire:11},
 {t:14,i:{d:1}},{t:30,i:{d:1},bomb:1},{t:26,i:{d:1},knife:1},{t:14},
 {until:'crate',i:{r:1}},{t:50,hold:1},{t:56,i:{u:1},hold:1},{t:24},{t:16,jump:1},{t:28,i:{d:1},hold:1},{t:20},
 {until:'near',i:{r:1}},{t:30,fire:1},{t:40,bomb:1},{t:20,weapon:1},
 {t:16,helium:1},{t:40,i:{r:1}},{t:70,jump:1,jhold:1},{t:30,fire:9},{t:16,helium:1},
 {t:120,cheer:1},{t:8,die:1,kind:'death_burn'},{t:330},{t:8,die:1,kind:'death_blast'},{t:330},
 {until:'home',i:{l:1},fire:18},{t:8,die:1,kind:'death'}];
let demo=true,dSeg=0,dT=0;
function demoInput(){let s=DEMO[dSeg];const o={l:0,r:0,u:0,d:0,f:0,jump:0,...(s.i||{})};const e={};
  if(dT===0){for(const k of ['jump','bomb','die','knife','weapon','helium','cheer'])if(s[k])e[k]=1;if(s.kind)H.dk=s.kind;}
  if(s.fire&&dT%s.fire===0&&dT<(s.t||999)-2)e.fire=1;if(s.hold)o.f=1;if(s.jhold)o.jump=1;dT++;
  let done=s.t?dT>=s.t:false;if(s.until==='near')done=!!ahead()&&(ahead().d<20)||H.x>LEVEL-60;if(s.until==='home')done=H.x<80;
  if(s.until==='crate')done=H.wpn==='h'||H.x>CRATE.x+20;
  if(done){dSeg=(dSeg+1)%DEMO.length;dT=0;if(dSeg===0)H.dk='death';}return [o,e];}
const demoBtn=document.getElementById('demo');
function setDemo(v){demo=v;demoBtn.setAttribute('aria-pressed',v?'true':'false');if(v){dSeg=0;dT=0;}}
demoBtn.addEventListener('click',()=>setDemo(!demo));

function stepSeq(i,e){const q=H.seq;q.t++;
  if(q.t>=q.steps[q.s].t){q.t=0;q.s++;if(q.s>=q.steps.length){
    if(q.kind==='sleep'){q.s=0;}
    else if(q.kind==='death'){q.s=q.steps.length-1;q.wait=(q.wait||0)+1;if(q.wait<40){q.t=q.steps[q.s].t-1;return;}H.dead=false;H.x=Math.max(40,H.x-30);if(!playSeq('spawn','spawn')){H.seq=null;}H.blink=120;H.wpn='p';H.he=0;return;}
    else if(q.kind==='yawn'){playSeq('sleep','sleep');return;}
    else{H.seq=null;H.lo={n:'stand',f:0,t:0};H.up={n:'idle',f:0,t:0};if(q.kind==='spawn')H.blink=120;return;}}}
  if(q.kind==='sleep'&&(i.l||i.r||Object.keys(e).length)){H.seq=null;H.lo={n:'stand',f:0,t:0};H.up={n:'idle',f:0,t:0};}}
function step(){
  let i,e;if(demo){[i,e]=demoInput();}else{i={l:keys.l,r:keys.r,u:keys.u,d:keys.d,f:keys.fire,jump:keys.jump};e={...edge};}
  for(const k in edge)delete edge[k];
  for(const t of TARGETS){if(t.flash)t.flash--;if(t.wob)t.wob--;}
  if(H.blink)H.blink--;if(H.pick)H.pick--;if(H.he&&--H.he===0)H.pick=10;if(CRATE.gone)CRATE.gone--;
  if(H.fold){H.fold.t++;const F=ST2.chute_fold;if(!F||H.fold.t>=F.length*5)H.fold=null;}
  if(e.die&&H.seq&&!['death','spawn'].includes(H.seq.kind))H.seq=null;   // a death cuts any fidget, bored, victory or sleep
  if(H.seq){const sl=H.seq.kind==='sleep';stepSeq(i,e);if(!(sl&&!H.seq)){stepFx();return;}}
  if(e.die&&!H.chute){H.dead=true;H.vx=0;H.vy=0;H.y=GROUND;H.air=false;H.act=null;H.flip=null;if(!playSeq('death',H.dk)&&!playSeq('death','death'))H.dead=false;stepFx();return;}
  if(e.cheer&&!H.air&&!H.chute){playSeq('victory','victory');stepFx();return;}
  if(e.timeout&&!H.air&&!H.chute){playSeq('yawn','yawn');stepFx();return;}
  if(e.weapon){H.wpn=H.wpn==='h'?'p':'h';H.ammo=200;H.pick=10;H.act=null;}
  if(e.helium){H.he=H.he?0:600;H.pick=10;H.act=null;}
  if(H.wpn==='p'&&!CRATE.gone&&!H.chute&&Math.abs(H.x-CRATE.x)<8&&H.y>GROUND-12){H.wpn='h';H.ammo=200;H.pick=10;CRATE.gone=600;H.act=null;}
  const busy=H.act&&(THROW.includes(H.act.b)||MELEE.includes(H.act.b))&&!H.air;
  const wasCrouch=H.crouch;H.crouch=!!i.d&&!H.air&&!H.he&&!H.chute;
  if(wasCrouch&&!H.crouch&&H.crouchT>=5&&Lo.crouchup&&!H.air)H.cup=Lo.crouchup.reduce((s,f)=>s+f.t,0);
  const sp=H.crouch?0.55:1.15;H.vx=(busy||H.chute||H.cup)?0:(i.l?-sp:i.r?sp:0);
  if(!busy&&!H.chute){if(i.l)H.face=-1;else if(i.r)H.face=1;}
  if(H.chute){H.chute.t++;H.y+=0.5;if(H.y>=GROUND){H.y=GROUND;H.air=false;H.chute=null;H.fold={x:H.x,face:H.face,t:0};H.land=Lo.land?Lo.land.reduce((s,f)=>s+f.t,0):6;H.landT=0;dusts.push({x:H.x,t:0});}}
  else{
    if(e.jump&&!H.air){H.vy=H.he?-4.4:-3.6;H.air=true;H.kind=Math.abs(H.vx)>0?'jumprun':'jump';H.crouch=false;H.cup=0;
      if(H.kind==='jumprun'&&FU.flip&&!H.he&&(H.flipN++%2===0)&&(!H.act))H.flip={f:0,t:0};}
    if(H.air){const float=H.he&&i.jump&&H.vy>0;H.vy+=float?0.03:0.16;if(float)H.vy=Math.min(H.vy,0.6);H.y+=H.vy;
      if(H.y>=GROUND){H.y=GROUND;H.vy=0;H.air=false;H.flip=null;H.land=Lo.land?Lo.land.reduce((s,f)=>s+f.t,0):6;H.landT=0;dusts.push({x:H.x,t:0});}}}
  if(H.flip&&adv(H.flip,FU.flip,false))H.flip=null;
  H.x=Math.max(16,Math.min(LEVEL-16,H.x+H.vx));
  if(H.chute){if(H.lo.n!=='dangle'||!Lo.dangle)H.lo={n:Lo.dangle?'dangle':'jump',f:Lo.dangle?0:3,t:0};else adv(H.lo,Lo.dangle,true);}
  else if(H.air){if(H.he&&H.vy>0&&Lo.fall){if(H.lo.n!=='fall')H.lo={n:'fall',f:0,t:0};else adv(H.lo,Lo.fall,true);}
    else{const lf=H.vy<-2?1:H.vy<-0.6?2:H.vy<0.7?3:4;H.lo={n:H.kind,f:lf,t:0};}}
  else if(H.land>0){H.land--;H.landT++;if(Lo.land){let t=H.landT,k=0;while(k<Lo.land.length-1&&t>Lo.land[k].t){t-=Lo.land[k].t;k++;}H.lo={n:'land',f:k,t:0};}else H.lo={n:H.kind,f:5,t:0};}
  else if(H.crouch){H.crouchT++;if(H.crouchT<5)H.lo={n:'crouchdown',f:H.crouchT<3?0:1,t:0};else if(H.vx!==0){if(H.lo.n!=='crawl')H.lo={n:'crawl',f:0,t:0};else adv(H.lo,Lo.crawl,true);}else H.lo={n:'crouch',f:0,t:0};}
  else if(H.cup>0){H.cup--;const tot=Lo.crouchup.reduce((s,f)=>s+f.t,0);let t=tot-H.cup,k=0;while(k<Lo.crouchup.length-1&&t>Lo.crouchup[k].t){t-=Lo.crouchup[k].t;k++;}H.lo={n:'crouchup',f:k,t:0};}
  else if(H.vx!==0){if(H.lo.n!=='run'){H.lo={n:'run',f:1,t:0};if(!H.wasRun)dusts.push({x:H.x-6*H.face,t:0});}else adv(H.lo,Lo.run,true);}
  else H.lo={n:'stand',f:0,t:0};
  if(!H.crouch)H.crouchT=0;H.wasRun=H.vx!==0&&!H.air;
  const hv=H.wpn==='h';
  const canFire=!H.act||(SHOOT.includes(H.act.b)&&H.act.f>=(hv?99:3))||['fidget','aimup','aimdown','diagup','diagdown'].includes(H.act.b);
  const dg=i.l||i.r;
  const shootB=()=>{let b=H.air&&i.d?(dg?'shootdiagdown':'shootdown'):i.u?(dg?'shootdiagup':'shootup'):H.crouch?'crouchshoot':'shoot';if(!has(b))b=b.replace('diag','');return b;};
  if((e.knife||(e.fire&&ahead()&&!H.air&&!i.u))&&(!H.act||H.act.b==='fidget'||canFire)&&!H.chute){setAct(H.crouch&&has('crouchslash')?'crouchslash':(H.knifeAlt++%2?'stab':'slash'));}
  else if((e.fire||(hv&&i.f))&&canFire){setAct(shootB());}
  else if(e.bomb&&(!H.act||H.act.b==='fidget'||canFire)&&!H.chute){setAct(H.crouch&&has('crouchgrenade')?'crouchgrenade':'grenade');}
  if(H.act){const a=H.act,F=U[a.n];const f0=a.f;if(adv(a,F,false))H.act=null;else if(a.f!==f0)onActFrame();
    if(H.act&&(i.l||i.r||e.jump||H.air)&&a.b==='fidget')H.act=null;}
  if(!H.act){let n='idle',f=0;
    const aim=H.air&&i.d?(dg?'ddown':'down'):(i.u?(dg?'dup':'up'):null);
    if(aim){if(H.aimN!==aim){H.aimN=aim;H.aimT=0;H.un=null;}H.aimT++;
      const first=a=>{for(const b of a){const k=tk(b);if(k)return k;}return null;};
      const tr=first({up:['aimup'],dup:['diagup','aimup'],down:['aimdown'],ddown:['diagdown','aimdown']}[aim]);
      const ho=first({up:['shootup'],dup:['shootdiagup','shootup'],down:['shootdown'],ddown:['shootdiagdown','shootdown']}[aim]);
      const k=(H.aimT/3)|0;if(tr&&k<U[tr].length){n=tr;f=k;}else{n=ho;f=U[ho].length-1;}}
    else{if(H.aimN==='up'||H.aimN==='dup'){const tr=tk('aimup');if(tr&&U[tr].length>2)H.un={n:tr,f:U[tr].length-1,t:0};}H.aimN=null;
      if(H.un){n=H.un.n;f=H.un.f;if(++H.un.t>=2){H.un.t=0;if(--H.un.f<0)H.un=null;}}
      else if(H.air&&!H.chute){const j=tk('jump');n=j;f=Math.min(H.lo.n===H.kind?H.lo.f:3,U[j].length-1);}else if(H.land>0&&!Lo.land){n=tk('jump');f=U[n].length-1;}
      else if(H.crouch){n=tk('crouchidle');if(H.up.n!==n)H.up={n,f:0,t:0};else adv(H.up,U[n],true);f=H.up.f;}
      else if(H.vx!==0){n=tk('run');f=H.lo.n==='run'?H.lo.f%U[n].length:0;}
      else{n=tk('idle');if(H.up.n!==n)H.up={n,f:0,t:0};else adv(H.up,U[n],true);f=H.up.f;
        if(!H.chute&&!H.he){H.idleT++;
          if(H.idleT===150){if(H.fid++%2===0||!FU.fidgetb){if(!hv&&has('fidget'))setAct('fidget');}else playSeq('fidget','fidgetb');}
          if(H.idleT>=620&&FU.bored){H.idleT=0;playSeq('bored','bored');}}}}
    if(!H.act)H.up={n,f,t:H.up.n===n?H.up.t:0};}
  if(H.vx!==0||H.air||H.crouch||i.u)H.idleT=0;
  stepFx();}
function stepFx(){
  for(const b of bullets){b.x+=b.dx;b.y+=b.dy;b.life--;
    for(const t of TARGETS){if(Math.abs(b.x-t.x)<6&&b.y>GROUND-22&&b.y<GROUND-9){b.life=0;t.flash=6;t.wob=8;hits++;sparks.push({x:b.x,y:b.y,t:8});}}
    if(b.y>GROUND+2){b.life=0;sparks.push({x:b.x,y:GROUND-1,t:8});}}
  for(let k=bullets.length-1;k>=0;k--)if(bullets[k].life<=0)bullets.splice(k,1);
  for(const c of casings){c.vy+=0.2;c.x+=c.vx;c.y+=c.vy;if(c.y>=GROUND-1&&c.vy>0){c.y=GROUND-1;c.vy*=-0.4;c.vx*=0.6;c.b++;}c.life--;}
  for(let k=casings.length-1;k>=0;k--)if(casings[k].life<=0)casings.splice(k,1);
  for(const g of grens){g.vy+=0.12;g.x+=g.vx;g.y+=g.vy;g.t++;if(g.y>=GROUND-3){g.dead=1;booms.push({x:g.x,t:0});for(const t of TARGETS)if(Math.abs(t.x-g.x)<26){t.flash=10;t.wob=12;hits++;}}}
  for(let k=grens.length-1;k>=0;k--)if(grens[k].dead)grens.splice(k,1);
  for(const b of booms)b.t++;for(let k=booms.length-1;k>=0;k--)if(booms[k].t>=8*3)booms.splice(k,1);
  for(const d of dusts)d.t++;for(let k=dusts.length-1;k>=0;k--)if(dusts[k].t>=12)dusts.splice(k,1);
  for(const s of sparks)s.t--;for(let k=sparks.length-1;k>=0;k--)if(sparks[k].t<=0)sparks.splice(k,1);}

let cam=0,tick=0;
const buf=document.createElement('canvas');buf.width=BW;buf.height=BH;
function heroPal(){if(H.pick>0){const age=10-H.pick;if(age<2||(age>=4&&age<6))return 'flash';if(age>=6)return 'tint'+Math.round(60*(10-age)/6);}return null;}
function drawCrate(g,x){const R=(c,a,b,w,h)=>{g.fillStyle=c;g.fillRect(a,b,w,h);};const y=GROUND-11;R('#140c0e',x-7,y-1,15,12);R('#7a5a32',x-6,y,13,10);R('#9c7642',x-6,y,13,2);R('#4f3a20',x-6,y+8,13,2);R('#4f3a20',x-1,y,1,10);
  text(g,'H',x+2,y+3,'#f0c95c');}
function render(){const tgt=Math.max(0,Math.min(LEVEL-BW,H.x-150));cam+=(tgt-cam)*0.15;const c=Math.round(cam);const P=v=>Math.round(v);
  const g=buf.getContext('2d');g.imageSmoothingEnabled=false;drawWorld(g,cam,tick);
  for(const t of TARGETS){const s=ST.target[t.flash&&(t.flash>>1)%2?1:0];const wob=t.wob?((t.wob>>1)%2?1:-1):0;g.drawImage(s.c,P(t.x)-c-(s.w>>1)+wob,GROUND-s.h);}
  if(!CRATE.gone||CRATE.gone<20&&(CRATE.gone>>1)%2)drawCrate(g,P(CRATE.x)-c);
  for(const gr of grens){const s=ST.gren[(gr.t>>2)%4];g.drawImage(H.face>0?s.c:s.cl,P(gr.x)-c-(s.w>>1),P(gr.y)-(s.h>>1));}
  if(H.fold&&ST2.chute_fold&&CHUTE){const F=ST2.chute_fold,fi=Math.min(F.length-1,(H.fold.t/5)|0);part(g,F[fi],P(H.fold.x)-c+CHUTE.dx*H.fold.face,GROUND+CHUTE.dy,H.fold.face);}
  const hx=P(H.x)-c,hy=P(H.y),pal=heroPal();
  if(H.chute&&ST2.chute&&CHUTE&&CHUTE.z<0){const F=ST2.chute;part(g,F[((tick/8)|0)%F.length],hx+CHUTE.dx*H.face,hy+CHUTE.dy,H.face);}
  if(!(H.blink&&(tick>>1)%2)){
    if(H.seq){drawStep(g,HR,H.seq.steps[H.seq.s],hx,hy,H.face,pal);}
    else if(H.flip){drawHeroAt(g,hx,hy,H.face,null,null,FU.flip[H.flip.f],HR,pal);}
    else{const lf=curLower();const ufN=H.act?H.act.n:H.up.n,ufF=H.act?H.act.f:H.up.f;const uf=U[ufN][Math.min(ufF,U[ufN].length-1)];drawHeroAt(g,hx,hy,H.face,lf,uf,null,HR,pal);}}
  if(H.chute&&ST2.chute&&CHUTE&&CHUTE.z>0){const F=ST2.chute;part(g,F[((tick/8)|0)%F.length],hx+CHUTE.dx*H.face,hy+CHUTE.dy,H.face);}
  for(const b of bullets){const x=P(b.x)-c,y=P(b.y),L=b.hv?4:3;
    const ux=Math.sign(b.dx),uy=Math.sign(b.dy);
    for(let k=0;k<L+2;k++){g.fillStyle=k<L?'#fffbd8':'#ffd040';g.fillRect(x-ux*k,y-uy*k,b.hv&&!uy?1:1,b.hv&&!uy?2:1);}}
  for(const k of casings){g.fillStyle=k.b?'#b08a3a':'#ffe070';g.fillRect(P(k.x)-c,P(k.y),k.b?2:1,1);}
  for(const b of booms){const s=ST.boom[Math.min(7,(b.t/3)|0)];g.drawImage(s.c,P(b.x)-c-(s.w>>1),GROUND-s.h+2);}
  for(const d of dusts){const s=ST.dust[Math.min(2,(d.t/4)|0)];g.drawImage(s.c,P(d.x)-c-(s.w>>1),GROUND-s.h);}
  for(const s of sparks){g.fillStyle='#fffbd8';const x=P(s.x)-c,y=P(s.y);g.fillRect(x,y,1,1);if(s.t>4){g.fillRect(x-2,y-1,1,1);g.fillRect(x+2,y-1,1,1);g.fillRect(x,y-2,1,1);}}
  const nm=HR.name,wl=H.wpn==='h'?'HEAVY '+String(H.ammo).padStart(3,'0'):'PISTOL',hl=H.he?' HELIUM':'';
  const hud=nm+'  HITS '+String(hits).padStart(3,'0')+'  '+wl+hl;g.fillStyle='#13101a';g.fillRect(4,4,textW(hud)+4,9);text(g,nm,6,6,'#f0c95c');text(g,hud.slice(nm.length),6+textW(nm)+1,6,'#efe8dc');
  const lab='384x216 x'+scale;g.fillStyle='#13101a';g.fillRect(BW-8-4*lab.length,4,4*lab.length+4,9);text(g,lab,BW-6-4*lab.length,6,'#efe8dc');
  let rd;if(H.seq){const s=H.seq.steps[H.seq.s];rd=`full: ${s.f?s.f[0]:'–'} ${H.seq.s+1}/${H.seq.steps.length}`;}
  else if(H.flip)rd=`full: flip ${H.flip.f+1}/${FU.flip.length}`;
  else{const un=H.act?H.act.n:H.up.n,uf=H.act?H.act.f:H.up.f;rd=`upper: ${un} ${uf+1}/${U[un].length} · legs: ${H.lo.n} ${H.lo.f+1}/${(Lo[H.lo.n]||[0]).length}`+(H.chute?' · parachute':'');}
  document.getElementById('animread').textContent=rd+(pal?' · '+pal:'')+(H.blink?' · invulnerable':'');}
