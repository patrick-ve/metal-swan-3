// Stage screenshots of the new features for VINCENT (chute, heavy fire, sweep, helium, ride viewer).
const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1000,height:900},deviceScaleFactor:1});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(500);await p.locator('#demo').click();
const hero=+(process.argv[3]||0);await p.locator('.heropick').first().locator('button').nth(hero).click();
const st=n=>p.locator('#stage').screenshot({path:`out/squad/s_${n}.png`});
await p.waitForTimeout(1200);await st('chute');await p.waitForTimeout(2600);await st('fold');
await p.keyboard.press('q');await p.keyboard.down('x');await p.waitForTimeout(500);await st('heavy');
await p.keyboard.down('ArrowUp');await p.waitForTimeout(160);await st('sweep');await p.waitForTimeout(500);await st('heavyup');
await p.keyboard.down('ArrowRight');await p.waitForTimeout(300);await st('diag');await p.keyboard.up('ArrowRight');await p.keyboard.up('ArrowUp');await p.keyboard.up('x');
await p.keyboard.press('q');await p.waitForTimeout(100);await p.keyboard.press('h');await p.waitForTimeout(300);await p.keyboard.down('z');await p.waitForTimeout(1300);await st('helium');await p.keyboard.up('z');
await p.waitForTimeout(1500);await p.keyboard.press('h');await p.waitForTimeout(300);
console.log('errors',JSON.stringify(errs));await b.close();})();
