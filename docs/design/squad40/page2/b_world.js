/* 3x5 pixel font, drawn at native size only */
const GL={'0':'111101101101111','1':'010110010010111','2':'111001111100111','3':'111001111001111','4':'101101111001001','5':'111100111001111','6':'111100111101111','7':'111001010010010','8':'111101111101111','9':'111101111001111',
'A':'010101111101101','B':'110101110101110','C':'011100100100011','D':'110101101101110','E':'111100110100111','F':'111100110100100','G':'011100101101011','H':'101101111101101','I':'111010010010111','J':'001001001101010','K':'101101110101101','L':'100100100100111','M':'101111111101101','N':'110101101101101','O':'010101101101010','P':'110101110100100','R':'110101110101101','S':'011100010001110','T':'111010010010010','U':'101101101101111','V':'101101101101010','W':'101101111111101','X':'101101010101101','Y':'101101010010010','Z':'111001010100111',' ':'000000000000000','x':'000101010101000','.':'000000000000010',':':'000010000010000','-':'000000111000000','/':'001001010100100'};
function text(g,s,x,y,col){g.fillStyle=col;let cx=x;for(const ch of s){const m=GL[ch]||GL[' '];for(let i=0;i<15;i++)if(m[i]==='1')g.fillRect(cx+i%3,y+(i/3|0),1,1);cx+=4;}}
function textW(s){return s.length*4-1;}

/* world on the 384x216 grid */
let seed=7;function rnd(){seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff;}
const HOUSE_COLS=[['#8c3b2e','#6b2a22','#4a1c18','#a04a38'],['#5d3a2a','#47291d','#2f1b14','#71493a'],['#3f4a3a','#2f382c','#20261e','#4f5c48'],['#7a6a4a','#5e5038','#3f3526','#8e7d5a'],['#2f3446','#232736','#181b26','#3d4358'],['#9a5a34','#77432a','#4f2c1c','#b06a42']];
const houses=[];{let x=-8;while(x<LEVEL+80){const w=[28,32,36,40][rnd()*4|0],h=70+(rnd()*34|0),c=HOUSE_COLS[rnd()*HOUSE_COLS.length|0],t=rnd()*3|0;houses.push({x,w,h,c,t});x+=w;}}
function makeTile(){const t=document.createElement('canvas');t.width=16;t.height=16;const x=t.getContext('2d');
  const R=(c,a,b,w,h)=>{x.fillStyle=c;x.fillRect(a,b,w,h);};R('#4f463e',0,0,16,16);
  for(const [a,b,w,h] of [[0,0,7,7],[8,0,8,7],[0,8,3,7],[4,8,8,7],[13,8,3,7]]){R('#9a8c7a',a,b,w,h);R('#b3a693',a,b,w,1);}
  for(const [a,b] of [[5,3],[11,4],[8,11],[1,12],[14,2]])R('#6c6052',a,b,1,1);return t;}
function makeKerb(){const t=document.createElement('canvas');t.width=16;t.height=4;const x=t.getContext('2d');x.fillStyle='#c9bfae';x.fillRect(0,0,16,1);x.fillStyle='#a49884';x.fillRect(0,1,16,2);x.fillStyle='#5a5048';x.fillRect(0,3,16,1);x.fillRect(15,1,1,2);return t;}
const TILE=makeTile(),KERB=makeKerb();
function drawHouse(g,hs,ox){const base=GROUND-28,top=base-hs.h,x=hs.x-ox,w=hs.w,[c0,c1,c2,c3]=hs.c;const R=(c,a,b,ww,hh)=>{g.fillStyle=c;g.fillRect(a,b,ww,hh);};
  R(c0,x,top,w,hs.h);R(c1,x+w-3,top,3,hs.h);const cx=x+(w>>1);g.fillStyle=c0;
  if(hs.t===0){for(let i=0;i<10;i++)g.fillRect(cx-(w>>1)+i,top-i,w-2*i,1);}
  else if(hs.t===1){for(let s=0;s<4;s++){const ww=w-6*s-2;g.fillRect(cx-(ww>>1),top-3*s-3,ww,3);}}
  else{g.fillRect(cx-6,top-12,12,12);g.fillRect(cx-4,top-16,8,4);g.fillRect(cx-2,top-18,4,2);}
  R('#1b1521',x,top,1,hs.h);const cols=Math.max(2,(hs.w-6)/10|0);const sp=(hs.w-cols*6)/(cols+1)|0;
  for(let f=0;f<4;f++){const wy=top+6+f*18;if(wy+12>base-16)break;for(let i=0;i<cols;i++){const wx=x+sp+i*(6+sp);
    R('#e9e2d0',wx,wy,6,11);R('#22283a',wx+1,wy+1,4,4);R('#22283a',wx+1,wy+6,4,4);R('#3a4a6a',wx+1,wy+1,1,1);R('#3a4a6a',wx+1,wy+6,1,1);}}
  R('#e9e2d0',x+3,base-16,7,16);R(c2,x+4,base-15,5,15);R('#8a8478',x+1,base-2,11,2);}
function drawWorld(g,cam,t){const W=BW,H=BH;const R=(c,a,b,w,h)=>{g.fillStyle=c;g.fillRect(a,b,w,h);};
  const bands=['#7fb2d8','#93c0dd','#a9cde0','#c3dbe2'];for(let i=0;i<4;i++)R(bands[i],0,i*22,W,22);
  for(let i=1;i<4;i++){const y=i*22;g.fillStyle=bands[i];for(let x=(i&1);x<W;x+=2)g.fillRect(x,y-1,1,1);g.fillStyle=bands[i-1];for(let x=((i+1)&1);x<W;x+=2)g.fillRect(x,y,1,1);}
  R('#c3dbe2',0,88,W,H-88);const cc=Math.round(cam*0.15);
  for(const [cx,cy,cw] of [[40,24,30],[170,14,44],[300,30,26],[460,20,38],[610,12,30]]){const x=((cx-cc)%720+720)%720-60;
    R('#f4f1ea',x,cy,cw,4);R('#f4f1ea',x+4,cy-3,cw-14,3);R('#f4f1ea',x+8,cy-5,cw-24,2);R('#d8e3e8',x+2,cy+4,cw-4,1);}
  const hc=Math.round(cam*0.5);for(const hs of houses){if((hs.x-hc)>BW+40||(hs.x-hc+hs.w)<-40)continue;drawHouse(g,hs,hc);}
  const wy=GROUND-28;R('#3d4a3a',0,wy,W,14);R('#2c3830',0,wy+10,W,4);const wc=Math.round(cam*0.7);
  for(let i=0;i<40;i++){const x=((i*37-wc+(t>>3))%W+W)%W,y=wy+2+(i*5)%9;R(i%5?'#5f7262':'#7a8d78',x,y,4+(i%3)*2,1);}
  R('#6e5546',0,wy+14,W,10);const cq=Math.round(cam);g.fillStyle='#57423a';for(let x=-(cq%8);x<W;x+=8)g.fillRect(x,wy+14,1,10);g.fillRect(0,wy+19,W,1);
  for(let x=-(cq%16);x<W;x+=16){g.drawImage(KERB,x,GROUND-4);for(let y=GROUND;y<H;y+=16)g.drawImage(TILE,x,y);}
  for(let bx=48;bx<LEVEL;bx+=96){const x=bx-cq;if(x<-8||x>W)continue;R('#1b1521',x-1,GROUND-17,6,14);R('#7a3a22',x,GROUND-16,4,13);R('#9a5232',x,GROUND-16,1,13);R('#e9e2d0',x+1,GROUND-12,2,1);R('#e9e2d0',x+1,GROUND-8,2,1);}}

