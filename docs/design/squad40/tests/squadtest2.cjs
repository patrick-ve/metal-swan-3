// Page smoke test: every group of every hero in the viewer and the line-up, then the play keys.
const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1000,height:800},deviceScaleFactor:1});
const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
const t0=Date.now();await p.goto('file://'+process.argv[2]);await p.waitForTimeout(800);console.log('load ms',Date.now()-t0);
const shots=process.argv[3]==='shots';
for(let h=0;h<5;h++){
  await p.locator('.heropick').nth(1).locator('button').nth(h).click();await p.waitForTimeout(100);
  const cats=p.locator('#tabs .tabs.cats button');const nc=await cats.count();let ng=0;
  for(let c=0;c<nc;c++){await cats.nth(c).click();const gs=p.locator('#tabs .tabs:not(.cats) button');const n=await gs.count();
    for(let g=0;g<n;g++){await gs.nth(g).click();await p.waitForTimeout(30);ng++;}}
  console.log('hero',h,'cats',nc,'groups',ng);
}
const lc=p.locator('#ltabs .tabs.cats button');for(let c=0;c<await lc.count();c++){await lc.nth(c).click();const gs=p.locator('#ltabs .tabs:not(.cats) button');for(let g=0;g<await gs.count();g++){await gs.nth(g).click();await p.waitForTimeout(40);}}
await p.locator('.heropick').first().locator('button').nth(0).click();await p.waitForTimeout(300);
if(shots)await p.locator('#stage').screenshot({path:'out/squad/t_chute.png'});
await p.waitForTimeout(3600);
const k=async(key,ms)=>{await p.keyboard.press(key);await p.waitForTimeout(ms||300);};
await k('q',200);await p.keyboard.down('x');await p.waitForTimeout(400);if(shots)await p.locator('#stage').screenshot({path:'out/squad/t_heavy.png'});
await p.keyboard.down('ArrowUp');await p.waitForTimeout(500);if(shots)await p.locator('#stage').screenshot({path:'out/squad/t_heavyup.png'});
await p.keyboard.up('ArrowUp');await p.keyboard.up('x');await p.waitForTimeout(300);
await k('q');await k('h');await p.keyboard.down('z');await p.waitForTimeout(900);await p.keyboard.up('z');await k('h',600);
await k('g',1500);await k('t',2500);await k('ArrowRight',100);
for(const d of ['death_burn','death_blast','death_drown','death_flat','death']){await p.locator(`[data-death="${d}"]`).click();await p.waitForTimeout(200);await k('p',900);console.log(d,await p.locator('#animread').textContent());await p.waitForTimeout(4200);}
console.log(await p.locator('#animread').textContent(), await p.evaluate(()=>hits));
console.log('errors',JSON.stringify(errs));await b.close();})();
