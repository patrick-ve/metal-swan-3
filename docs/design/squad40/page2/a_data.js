<script>
const DATA=__DATA__;
const BW=384,BH=216,GROUND=176,LEVEL=1152,D=1;
const hexrgb=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
function mk(rows,flip,rgb){const w=Math.max(...rows.map(r=>r.length)),h=rows.length,c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d'),d=x.createImageData(w,h);
  for(let y=0;y<h;y++)for(let i=0;i<rows[y].length;i++){const v=rgb[rows[y][i]];if(!v)continue;const o=(y*w+(flip?w-1-i:i))*4;d.data[o]=v[0];d.data[o+1]=v[1];d.data[o+2]=v[2];d.data[o+3]=255;}
  x.putImageData(d,0,0);return c;}
/* frames get their canvases on first use (several thousand frames in all) */
function prep(f,rgb){f.rgb=rgb;f.w=Math.max(...f.r.map(x=>x.length));f.h=f.r.length;if(f.bk)prep(f.bk,rgb);return f;}
function img(f,flip){if(!f.c){f.c=mk(f.r,false,f.rgb);f.cl=mk(f.r,true,f.rgb);}return flip?f.cl:f.c;}
const HEROES=DATA.heroes.map(h=>{const rgb={};for(const k in h.pal)rgb[k]=hexrgb(h.pal[k]);
  for(const L of ['upper','lower','full'])for(const k in h.s1[L])h.s1[L][k].forEach(f=>prep(f,rgb));
  return {...h,rgb,U:h.s1.upper,Lo:h.s1.lower,FU:h.s1.full,pv:{},gb:{}};});
const STAGE_RGB={};for(const k in DATA.stagePal)STAGE_RGB[k]=hexrgb(DATA.stagePal[k]);
const ST={};for(const k in DATA.stage)ST[k]=DATA.stage[k].map(r=>({c:mk(r,false,STAGE_RGB),cl:mk(r,true,STAGE_RGB),w:Math.max(...r.map(x=>x.length)),h:r.length}));
const ST2={};for(const k in (DATA.stage2||{}))ST2[k]=DATA.stage2[k].map(f=>prep(f,STAGE_RGB));
let HI=0,HR=HEROES[0],U=HR.U,Lo=HR.Lo,FU=HR.FU;
/* palette variants: 'flash' = white silhouette, 'tintNN' = NN % toward white (the pick-up flash) */
function palRgb(h,p){if(h.pv[p])return h.pv[p];const o={},a=p.startsWith('tint')?(+p.slice(4))/100:0;
  for(const k in h.rgb){const c=h.rgb[k];o[k]=p==='flash'?[255,255,255]:c.map(v=>Math.round(v+(255-v)*a));}return h.pv[p]=o;}
function vimg(f,h,p,flip){f.v=f.v||{};const key=p+(flip?'l':'r');return f.v[key]||(f.v[key]=mk(f.r,flip,palRgb(h,p)));}
function part(g,f,ax,ay,face,h,p){const im=(p&&h)?vimg(f,h,p,face<0):img(f,face<0);
  if(face>0)g.drawImage(im,Math.round(ax-f.ax),Math.round(ay-f.ay));else g.drawImage(im,Math.round(ax-(f.w-1-f.ax)),Math.round(ay-f.ay));}

