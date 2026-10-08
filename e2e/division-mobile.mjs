import { chromium } from '@playwright/test';
const out = process.argv[2] ?? '/tmp/shots';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const errors = [];
const mob = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
mob.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
await mob.goto('http://localhost:4173/');
await mob.waitForTimeout(400);
await mob.tap('.profile-card');
await mob.fill('.modal input[type=text]', 'Mob');
await mob.tap('.modal .btn-primary');
await mob.waitForTimeout(300);
await mob.evaluate(() => { const a = window.mp2; a.p.stats.sessions = 1; a.settings.lang = 'fr'; a.persist(true); location.reload(); });
await mob.waitForTimeout(600);
await mob.tap('.menu-card.big');
await mob.waitForTimeout(400);
await mob.screenshot({ path: `${out}/91-mobile-campaign-picker.png` });
await mob.tap('.ops-picker button:nth-child(2)');
await mob.waitForTimeout(400);
await mob.tap('.sector:nth-child(3)'); // table de 10 : « 100 ÷ 10 »
await mob.waitForTimeout(3000);
const longest = new Set();
for (let i = 0; i < 14; i++) {
  const st = await mob.evaluate(() => { const g = window.mp2game; const f = g.focus; return { labels: g.asteroids.map((a) => a.label), f: f && g.projectiles.length === 0 ? f.answer : null }; });
  st.labels.forEach((l) => longest.add(l));
  if (i === 6) await mob.screenshot({ path: `${out}/92-mobile-div-game.png` });
  if (st.f !== null) { for (const ch of String(st.f)) await mob.tap(`.numpad button:text-is("${ch}")`); }
  await mob.waitForTimeout(500);
}
console.log('labels', [...longest]);
console.log(JSON.stringify(errors));
await browser.close();
