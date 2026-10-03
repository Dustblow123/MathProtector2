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
await page.fill('.modal input[type=text]', 'V3');
await page.click('.modal .btn-primary');
await page.waitForTimeout(300);
// Faits datés d'il y a 3 jours pour la table de 6 → dus
await page.evaluate(() => {
  const a = window.mp2; const p = a.p; const now = Date.now() - 3 * 86400000;
  for (let b = 1; b <= 10; b++) p.facts[`6x${b}`] = { id: `6x${b}`, pKnown: 0.85, stability: 0.8, lastReview: now, reps: 4, lapses: 0, rtEma: 2000, recent: [{ correct: true, rt: 2000 }], streak: 4 };
  p.sectors = { 6: { stars: 2, bestScore: 1, attempts: 1 } };
  a.settings.lang = 'fr'; a.settings.hintStyle = 'both'; a.persist(true); location.reload();
});
await page.waitForTimeout(700);
await page.screenshot({ path: `${out}/50-menu-review.png` });
const reviewText = await page.textContent('.menu-card.review-due .desc');
console.log('review card', reviewText);
await page.click('.menu-card.review-due');
await page.waitForTimeout(2500);
let shots = 0; let madeErrors = 0;
const t0 = Date.now();
while (Date.now() - t0 < 90000) {
  const st = await page.evaluate(() => { const g = window.mp2game; const f = g.focus; return { phase: g.phase, answer: f ? f.answer : null, proj: g.projectiles.length, hinted: f && f.hinted }; });
  if (st.phase === 'ended') break;
  if (st.answer !== null && st.proj === 0) {
    const wrong = madeErrors < 2 && shots > 1 && shots % 3 === 0;
    if (wrong) madeErrors++;
    await page.keyboard.type(String(wrong ? st.answer + 6 : st.answer)); await page.keyboard.press('Enter');
    shots++;
    if (shots === 2) { await page.waitForTimeout(6500); await page.screenshot({ path: `${out}/51-review-visual-hint.png` }); }
  }
  await page.waitForTimeout(300);
}
await page.waitForTimeout(2200);
await page.screenshot({ path: `${out}/52-review-results.png`, fullPage: true });
const hasDrill = await page.$('.btn-accent.btn-big');
console.log('drill button', !!hasDrill);
if (hasDrill) {
  await hasDrill.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/53-drill.png` });
  for (let i = 0; i < 6; i++) {
    const q = await page.textContent('.drill-question').catch(() => null);
    if (!q) break;
    const m = q.match(/(\d+) × (\d+)/);
    if (!m) break;
    const ans = i === 1 ? Number(m[1]) * Number(m[2]) + 1 : Number(m[1]) * Number(m[2]);
    await page.keyboard.type(String(ans)); await page.keyboard.press('Enter');
    if (i === 1) { await page.waitForTimeout(400); await page.screenshot({ path: `${out}/54-drill-error.png` }); }
    await page.waitForTimeout(i === 1 ? 2700 : 1100);
  }
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/55-results-after-drill.png`, fullPage: true });
  console.log('drill done text', await page.textContent('.reward b').catch(() => null));
}
await page.click('.btn-ghost.btn-big');
await page.waitForTimeout(300);
console.log('review card after', await page.textContent('.menu-card:nth-child(2) .desc'));
// Hebdo
await page.click('.menu-card.accent');
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/56-modes-weekly.png`, fullPage: true });
// Réglages accessibilité
await page.click('.topbar .btn');
await page.click('.menu-card:nth-child(7)');
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/57-settings.png`, fullPage: true });
await page.evaluate(() => { const a = window.mp2; a.settings.readableFont = true; a.settings.largeText = true; a.settings.colorblind = true; a.settings.highContrast = true; a.applySettings(); a.persist(true); });
await page.click('.topbar .btn');
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/58-menu-access.png` });
await page.click('.menu-card.big');
await page.click('.sector:nth-child(7)');
await page.waitForTimeout(7500);
await page.screenshot({ path: `${out}/59-game-access.png` });
console.log(JSON.stringify(errors, null, 1));
await browser.close();
