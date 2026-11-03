
/* hero drawing: back layer (cape) first, then legs, then the upper body on the pelvis point; an upper
   with no legs (the Swan rider) sits at the hero's standing pelvis height */
function pel0(h){return h.Lo.stand[0].pel[1];}
function drawHeroAt(g,x,y,face,lf,uf,full,h,p){h=h||HR;if(full){part(g,full,x,y,face,h,p);return;}
  const py=y+(lf?lf.pel[1]:pel0(h));if(uf&&uf.bk)part(g,uf.bk,x,py,face,h,p);if(lf)part(g,lf,x,y,face,h,p);if(uf)part(g,uf,x,py,face,h,p);}
function stepSprites(h,s){const g=(T,k)=>k&&T[k[0]]?T[k[0]][Math.min(k[1],T[k[0]].length-1)]:null;return {lf:g(h.Lo,s.l),uf:g(h.U,s.u),ff:g(h.FU,s.f)};}
function stagePart(g,e,x,y,face){const F=ST2[e[0]],f=F&&F[e[1]];if(f)part(g,f,x+e[2]*face,y+e[3],face);}
/* one page step: stage sprites behind (z<0), the hero (offset, palette, hidden), stage sprites in front */
function drawStep(g,h,s,x,y,face,pal){face=face||1;const X=x+(s.ox||0)*face,Y=y+(s.oy||0),st=s.st||[];
  for(const e of st)if(e[4]<0)stagePart(g,e,X,Y,face);
  if(!s.hide){const {lf,uf,ff}=stepSprites(h,s);drawHeroAt(g,X,Y,face,lf,uf,ff,h,pal||s.pal);}
  for(const e of st)if(e[4]>0)stagePart(g,e,X,Y,face);}
function stepBox(h,s){let b=null;const add=(f,ax,ay)=>{const x0=ax-f.ax,y0=ay-f.ay,x1=x0+f.w,y1=y0+f.h;b=b?[Math.min(b[0],x0),Math.min(b[1],y0),Math.max(b[2],x1),Math.max(b[3],y1)]:[x0,y0,x1,y1];};
  const ox=s.ox||0,oy=s.oy||0,{lf,uf,ff}=stepSprites(h,s);
  if(ff)add(ff,ox,oy);else{const py=oy+(lf?lf.pel[1]:pel0(h));if(lf)add(lf,ox,oy);if(uf){add(uf,ox,py);if(uf.bk)add(uf.bk,ox,py);}}
  for(const e of s.st||[]){const f=ST2[e[0]]&&ST2[e[0]][e[1]];if(f)add(f,ox+e[2],oy+e[3]);}
  return b||[-10,-40,10,0];}
const ub=(a,b)=>a?[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[2],b[2]),Math.max(a[3],b[3])]:b;
function groupBox(h,k){if(h.gb[k])return h.gb[k];let b=null;for(const s of h.groups[k].steps)b=ub(b,stepBox(h,s));return h.gb[k]=b;}

/* group tabs: a category row, then the groups of that category */
const CATS=[];HEROES[0].groups.forEach(g=>{if(!CATS.includes(g.cat))CATS.push(g.cat);});
function makeTabs(root,getG,setG,label){root.innerHTML='';const cr=document.createElement('div'),gr=document.createElement('div');cr.className='tabs cats';gr.className='tabs';
  cr.setAttribute('role','group');cr.setAttribute('aria-label','Category');gr.setAttribute('role','group');gr.setAttribute('aria-label','Group');root.append(cr,gr);
  let cat=HEROES[0].groups[getG()].cat;
  const fill=()=>{gr.innerHTML='';HEROES[0].groups.forEach((g,k)=>{if(g.cat!==cat)return;const b=document.createElement('button');b.textContent=label(k);
    b.setAttribute('aria-pressed',k===getG()?'true':'false');b.addEventListener('click',()=>{setG(k);gr.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b?'true':'false'));});gr.appendChild(b);});};
  CATS.forEach(c=>{const b=document.createElement('button');const n=HEROES[0].groups.filter(g=>g.cat===c).length;b.textContent=c+' · '+n;b.setAttribute('aria-pressed',c===cat?'true':'false');
    b.addEventListener('click',()=>{cat=c;cr.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b?'true':'false'));setG(HEROES[0].groups.findIndex(g=>g.cat===c));fill();});cr.appendChild(b);});
  fill();}

/* ---------------- line-up: all five play the same group, each at its own hold times */
const lbuf=document.createElement('canvas');let LW=384,LH=78,LSP=76,LBX=0,LGY=62;
const lbox=document.getElementById('lbox'),lscreen=document.getElementById('lscreen'),lg=lscreen.getContext('2d');
let LG=0,lscale=1,lbg='street';const lst=HEROES.map(()=>({s:0,t:0}));
function lsize(){let b=null;HEROES.forEach(h=>{if(LG<h.groups.length)b=ub(b,groupBox(h,LG));});b=b||[-14,-44,14,0];
  LSP=Math.max(76,b[2]-b[0]+8);LW=Math.max(384,5*LSP);LH=Math.max(78,Math.max(0,b[3])-b[1]+26);LGY=LH-16-Math.max(0,b[3]);LBX=-(b[0]+b[2])/2;
  lbuf.width=LW;lbuf.height=LH;lbox.style.aspectRatio=LW+'/'+LH;llayout();}
function llayout(){const dpr=window.devicePixelRatio||1;const r=lbox.getBoundingClientRect();const bw=Math.max(1,Math.floor(r.width*dpr)),bh=Math.max(1,Math.floor(r.height*dpr));
  lscreen.width=bw;lscreen.height=bh;lscreen.style.width=(bw/dpr)+'px';lscreen.style.height=(bh/dpr)+'px';lscale=Math.max(1,Math.min(Math.floor(bw/LW),Math.floor(bh/LH)));}
new ResizeObserver(llayout).observe(lbox);
function bg(g,W,Hh,gy,mode){if(mode==='sheet'){g.fillStyle='#99d9ea';g.fillRect(0,0,W,Hh);}
  else if(mode==='dark'){g.fillStyle='#24202f';g.fillRect(0,0,W,Hh);g.fillStyle='#2e2839';g.fillRect(0,gy,W,1);}
  else{g.fillStyle='#c3dbe2';g.fillRect(0,0,W,Hh);g.fillStyle='#3d4a3a';g.fillRect(0,gy-18,W,14);for(let x=0;x<W;x+=16){g.drawImage(KERB,x,gy-4);g.drawImage(TILE,x,gy);}}}
function lrender(){const g=lbuf.getContext('2d');g.imageSmoothingEnabled=false;const gy=LGY;bg(g,LW,LH,gy,lbg);
  HEROES.forEach((h,k)=>{if(LG>=h.groups.length)return;const grp=h.groups[LG],s=grp.steps[lst[k].s%grp.steps.length];const cx=Math.round((LW-5*LSP)/2+LSP/2+k*LSP+LBX);
    drawStep(g,h,s,cx,gy,1);const nm=h.name;const tw=textW(nm);const lx=Math.round((LW-5*LSP)/2+LSP/2+k*LSP);g.fillStyle='#13101a';g.fillRect(lx-(tw>>1)-2,gy+6,tw+4,9);text(g,nm,lx-(tw>>1),gy+8,k===HI?'#f0c95c':'#efe8dc');});
  lg.imageSmoothingEnabled=false;lg.fillStyle='#000';lg.fillRect(0,0,lscreen.width,lscreen.height);
  lg.drawImage(lbuf,0,0,LW,LH,(lscreen.width-LW*lscale)>>1,(lscreen.height-LH*lscale)>>1,LW*lscale,LH*lscale);}
function lstep(n){for(let i=0;i<n;i++)HEROES.forEach((h,k)=>{if(LG>=h.groups.length)return;const grp=h.groups[LG],st=lst[k];st.t++;if(st.t>=grp.steps[st.s%grp.steps.length].t){st.t=0;st.s=(st.s+1)%grp.steps.length;}});}
makeTabs(document.getElementById('ltabs'),()=>LG,k=>{LG=k;lst.forEach(s=>{s.s=0;s.t=0;});lsize();lrender();},k=>HEROES[0].groups[k].cat==='Core'&&k===10?'Melee':HEROES[0].groups[k].title);
document.querySelectorAll('[data-lbg]').forEach(b=>b.addEventListener('click',()=>{lbg=b.dataset.lbg;setPressed('[data-lbg]',b);lrender();}));
lsize();
