const stage=document.getElementById('stage'),screen=document.getElementById('screen'),sg=screen.getContext('2d');
let forced=0,scale=1;
function layout(){const dpr=window.devicePixelRatio||1;const r=stage.getBoundingClientRect();const bw=Math.max(1,Math.floor(r.width*dpr)),bh=Math.max(1,Math.floor(r.height*dpr));
  screen.width=bw;screen.height=bh;screen.style.width=(bw/dpr)+'px';screen.style.height=(bh/dpr)+'px';
  const fit=Math.max(1,Math.min(Math.floor(bw/BW),Math.floor(bh/BH)));scale=forced?forced:fit;
  document.getElementById('readout').textContent=`buffer ${BW}×${BH} · ×${scale} = ${BW*scale}×${BH*scale} device px${BW*scale>bw?' · cropped':''}`;}
function blit(){sg.imageSmoothingEnabled=false;sg.fillStyle='#000';sg.fillRect(0,0,screen.width,screen.height);
  const ox=(screen.width-BW*scale)>>1,oy=(screen.height-BH*scale)>>1;sg.drawImage(buf,0,0,BW,BH,ox,oy,BW*scale,BH*scale);}
new ResizeObserver(layout).observe(stage);layout();
function setPressed(sel,b){document.querySelectorAll(sel).forEach(x=>x.setAttribute('aria-pressed',x===b?'true':'false'));}
document.querySelectorAll('[data-s]').forEach(b=>b.addEventListener('click',()=>{forced=+b.dataset.s;setPressed('#sc-auto,[data-s]',b);layout();}));
document.getElementById('sc-auto').addEventListener('click',e=>{forced=0;setPressed('#sc-auto,[data-s]',e.currentTarget);layout();});

