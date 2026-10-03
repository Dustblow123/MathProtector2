import { chromium } from '@playwright/test';
const out = process.argv[2] ?? '/tmp/shots';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const errors = [];
for (const [name, vp] of [['portrait', { width: 390, height: 844 }], ['landscape', { width: 844, height: 390 }]]) {
  const mob = await browser.newPage({ viewport: vp, hasTouch: true, isMobile: true });
  mob.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  await mob.goto('http://localhost:4173/');
  await mob.waitForTimeout(400);
  await mob.tap('.profile-card');
  await mob.fill('.modal input[type=text]', 'Mob');
  await mob.tap('.modal .btn-primary');
  await mob.waitForTimeout(300);
  await mob.tap('.menu-card.accent');
  await mob.waitForTimeout(300);
  await mob.tap('.mode-card:nth-child(4) .btn');
  await mob.waitForTimeout(3500);
  const st = await mob.evaluate(() => { const g = window.mp2game; const a = g.asteroids[0]; const hud = document.querySelector('.hud-top').getBoundingClientRect(); return { viewTop: Math.round(g.view.top), hudBottom: Math.round(hud.bottom), spawnY: a ? Math.round(a.y) : null }; });
  console.log(name, JSON.stringify(st));
  await mob.screenshot({ path: `${out}/60-mobile-${name}.png` });
  await mob.close();
}
console.log(JSON.stringify(errors));
await browser.close();
