import { chromium } from '@playwright/test';
const out = process.argv[2] ?? '/tmp/shots';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message + '\n' + e.stack));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto('http://localhost:4173/');
await page.waitForTimeout(400);
await page.click('.profile-card');
await page.fill('.modal input[type=text]', 'Boss');
await page.click('.modal .btn-primary');
await page.waitForTimeout(300);
await page.evaluate(() => { const a = window.mp2; a.p.bossesDefeated = ['titan', 'hydra', 'mirror', 'chrono', 'mothership']; a.p.unlockedSector = 9; a.p.stardust = 999; a.settings.lang = 'fr'; a.persist(true); location.reload(); });
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/20-menu-fr.png` });
await page.click('.menu-card.accent');
await page.waitForTimeout(300);
await page.click('.mode-card:nth-child(4) .btn');
await page.waitForTimeout(500);
const seen = new Set();
const t0 = Date.now();
let slow = 0;
while (Date.now() - t0 < 240000) {
  const st = await page.evaluate(() => { const g = window.mp2game; const f = g.focus; return { phase: g.phase, boss: g.boss ? g.boss.kind : null, enter: g.boss ? g.boss.enterT : 0, answer: f ? f.answer : null, proj: g.projectiles.length, hp: g.earth.hp }; });
  if (st.phase === 'ended') break;
  if (st.boss && !seen.has(st.boss) && st.enter >= 1) {
    seen.add(st.boss);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${out}/21-boss-${st.boss}.png` });
  }
  if (st.answer !== null && st.proj === 0 && st.enter >= 1) {
    slow++;
    await page.keyboard.type(String(st.answer), { delay: 30 });
    await page.keyboard.press('Enter');
  }
  await page.waitForTimeout(220);
}
const fin = await page.evaluate(() => ({ phase: window.mp2game.phase, defeated: window.mp2game.bossesDefeated, hp: window.mp2game.earth.hp }));
console.log('boss rush', JSON.stringify(fin), 'seen', [...seen]);
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/22-results-bossrush.png`, fullPage: true });
console.log(JSON.stringify(errors, null, 1));
await browser.close();
