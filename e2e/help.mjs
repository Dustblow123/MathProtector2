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
await page.fill('.modal input[type=text]', 'Aide');
await page.click('.modal .btn-primary');
await page.waitForTimeout(300);
await page.evaluate(() => { const a = window.mp2; a.p.stats.sessions = 1; a.settings.lang = 'fr'; a.persist(true); location.reload(); });
await page.waitForTimeout(600);
await page.click('.menu-card.big');
await page.click('.sector:nth-child(8)'); // table de 7
await page.waitForTimeout(4500);
// Deux réponses justes pour avoir un combo, puis H
for (let i = 0; i < 2; i++) {
  const ans = await page.evaluate(() => { const g = window.mp2game; const f = g.focus; return f && g.projectiles.length === 0 ? f.answer : null; });
  if (ans !== null) { await page.keyboard.type(String(ans)); await page.keyboard.press('Enter'); }
  await page.waitForTimeout(1500);
}
await page.waitForFunction(() => window.mp2game.focus !== null);
const before = await page.evaluate(() => ({ combo: window.mp2game.combo, time: window.mp2game.time, label: window.mp2game.focus.label }));
await page.keyboard.press('h');
await page.waitForTimeout(700);
await page.screenshot({ path: `${out}/70-help-card.png` });
const during = await page.evaluate(() => ({ phase: window.mp2game.phase, combo: window.mp2game.combo, time: window.mp2game.time, steps: [...document.querySelectorAll('.help-step')].map((e) => e.textContent), title: document.querySelector('.help-card h2')?.textContent }));
await page.waitForTimeout(2000);
const still = await page.evaluate(() => window.mp2game.time);
console.log('before', JSON.stringify(before), 'during', JSON.stringify(during), 'frozen', still === during.time);
// Répondre pendant la carte : ferme et applique
const ans = await page.evaluate(() => window.mp2game.help.target.answer);
await page.keyboard.type(String(ans)); await page.keyboard.press('Enter');
await page.waitForTimeout(800);
const after = await page.evaluate(() => ({ phase: window.mp2game.phase, overlay: !!document.querySelector('.help-overlay'), helps: window.mp2game.buildResult(false).helps }));
console.log('after', JSON.stringify(after));
await page.screenshot({ path: `${out}/71-after-help.png` });
// Auto-fermeture après 10 s
await page.waitForFunction(() => window.mp2game.focus !== null && window.mp2game.projectiles.length === 0);
await page.keyboard.press('h');
await page.waitForTimeout(10800);
const auto = await page.evaluate(() => ({ phase: window.mp2game.phase, overlay: !!document.querySelector('.help-overlay') }));
console.log('auto-close', JSON.stringify(auto));
// Abandon → résultats avec Aides
await page.keyboard.press('Escape');
await page.click('.overlay .btn-ghost');
await page.click('.modal .btn-danger');
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/72-results-helps.png` });
console.log('helps stat', await page.evaluate(() => [...document.querySelectorAll('.stat')].map((s) => s.textContent).filter((t) => /Aides/.test(t))));
console.log(JSON.stringify(errors));
await browser.close();
