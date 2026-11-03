// node tests/casttest.cjs <page.html> [shot.png] — loads the cast page, clicks every tab, filter,
// zoom and toggle, opens every card in the viewer, and reports page errors. NODE_PATH must reach playwright.
const { chromium } = require('playwright');
(async () => {
  const [page_, shot] = process.argv.slice(2);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  p.on('pageerror', e => errors.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto('file://' + page_);
  await p.waitForTimeout(500);
  const n = await p.evaluate(() => DATA.samples.length);
  for (const sel of ['#mtabs button', '#rtabs button', '#zooms button', '#oldV button']) {
    const k = await p.locator(sel).count();
    for (let i = 0; i < k; i++) await p.locator(sel).nth(i).click();
  }
  await p.locator('#rtabs button').first().click();
  for (const t of ['#vsBtn', '#oldBtn', '#oldBtn']) await p.locator(t).click();
  const cards = await p.locator('#cards .box').count();
  for (let i = 0; i < cards; i++) await p.locator('#cards .box').nth(i).click();
  await p.locator('#mtabs button').first().click();
  const strips = await p.locator('#strips canvas').count();
  if (shot) await p.screenshot({ path: shot, fullPage: true });
  await p.setViewportSize({ width: 390, height: 800 });
  await p.waitForTimeout(300);
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  console.log(JSON.stringify({ samples: n, cards, strips, overflowAt390: overflow, errors }));
  await b.close();
  process.exit(errors.length || overflow ? 1 : 0);
})();
