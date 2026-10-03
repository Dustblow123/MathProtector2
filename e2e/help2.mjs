import { chromium } from '@playwright/test';
const out = process.argv[2] ?? '/tmp/shots';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://localhost:4173/');
await page.waitForTimeout(400);
await page.click('.profile-card');
await page.fill('.modal input[type=text]', 'Aide2');
await page.click('.modal .btn-primary');
await page.waitForTimeout(300);
await page.evaluate(() => { const a = window.mp2; a.p.stats.sessions = 1; a.settings.lang = 'fr'; a.persist(true); location.reload(); });
await page.waitForTimeout(600);
await page.click('.menu-card.accent');
await page.click('.chip:nth-child(7)'); // table 7 only
for (const n of [1, 2, 3]) await page.click(`.chip:nth-child(${n})`);
await page.click('.mode-card:nth-child(4) .btn'); // entraînement
await page.waitForTimeout(3500);
const seen = new Set();
for (let i = 0; i < 14 && seen.size < 3; i++) {
  const lab = await page.evaluate(() => { const g = window.mp2game; const f = g.focus; return f && g.projectiles.length === 0 ? f.label : null; });
  if (!lab) { await page.waitForTimeout(500); continue; }
  const b = Number(lab.split('×')[1]);
  if ([9, 7, 6, 4, 3, 8].includes(b) && !seen.has(b)) {
    seen.add(b);
    await page.keyboard.press('h');
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${out}/73-help-x${b}.png` });
    await page.keyboard.press('Escape');
  }
  const ans = await page.evaluate(() => window.mp2game.focus?.answer ?? null);
  if (ans !== null) { await page.keyboard.type(String(ans)); await page.keyboard.press('Enter'); }
  await page.waitForTimeout(900);
}
console.log('seen', [...seen]);
await browser.close();
