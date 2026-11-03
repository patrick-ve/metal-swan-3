const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1100,height:900},deviceScaleFactor:1});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(500);
const pick=async(cat,grp,ms,name)=>{await p.locator('#ltabs .tabs.cats button',{hasText:cat}).click();await p.locator('#ltabs .tabs:not(.cats) button',{hasText:grp}).first().click();
  await p.waitForTimeout(ms);await p.locator('#lbox').screenshot({path:`out/squad/l_${name}.png`});};
await pick('Full body','Victory',500,'victory');await pick('Swan ride','sit and run',700,'ride');await pick('Status','Helium',1500,'helium');
await pick('Heavy weapon','Heavy sweep up',900,'sweep');await pick('Deaths','Burn',1100,'burn');await pick('Moves','Parachute',600,'chute');
console.log('errors',JSON.stringify(errs));await b.close();})();
