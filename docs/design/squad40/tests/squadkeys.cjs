const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:900,height:700},deviceScaleFactor:1});
const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(600);
for(let h=0;h<5;h++){
  await p.locator('.heropick').first().locator('button').nth(h).click();await p.waitForTimeout(3700);
  const shot=async n=>{await p.locator('#stage').screenshot({path:`out/squad/k${h}_${n}.png`});};
  await p.keyboard.down('ArrowRight');await p.waitForTimeout(450);await shot('run');
  await p.keyboard.press('x');await p.waitForTimeout(90);await shot('runshoot');await p.keyboard.up('ArrowRight');
  await p.waitForTimeout(300);await p.keyboard.press('v');await p.waitForTimeout(80);await shot('melee');
  await p.waitForTimeout(500);await p.keyboard.press('c');await p.waitForTimeout(220);await shot('grenade');
  await p.waitForTimeout(800);await p.keyboard.press('p');await p.waitForTimeout(600);await shot('death');
  await p.waitForTimeout(2500);
  console.log(h, await p.locator('#animread').textContent(), await p.evaluate(()=>hits));
}
console.log('errors',JSON.stringify(errs));await b.close();})();
