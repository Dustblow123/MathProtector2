import { chromium } from '@playwright/test';
const out = process.argv[2] ?? '/tmp/shots';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://localhost:4173/');
await page.waitForTimeout(400);
await page.click('.profile-card');
await page.fill('.modal input[type=text]', 'L');
await page.click('.modal .btn-primary');
await page.waitForTimeout(300);
await page.evaluate(() => { const a = window.mp2; a.p.stats.sessions = 1; a.p.ops = 'div'; a.settings.lang = 'fr'; a.persist(true); location.reload(); });
await page.waitForTimeout(600);
await page.click('.menu-card.big');
await page.click('.sector:nth-child(3)'); // table de 10
await page.waitForTimeout(3000);
// Fait apparaître plusieurs libellés longs bien visibles
await page.evaluate(() => {
  const g = window.mp2game; g.flow.intensity = 0; g.pause();
  const mk = (a, b, x) => { const s = g.spawnAsteroid({ fact: { id: `${a}d${b}`, op: 'div', a, b, product: a * b, answer: b, table: a }, fromX: x, fromY: 330 }); if (s) { s.vy = 0; s.vx = 0; } };
  mk(10, 10, 300); mk(10, 7, 520); mk(12, 12, 740); mk(9, 8, 960);
});
await page.evaluate(() => window.mp2game.resume());
await page.waitForTimeout(250);
await page.screenshot({ path: `${out}/93-long-labels.png`, clip: { x: 150, y: 230, width: 980, height: 200 } });
await browser.close();
