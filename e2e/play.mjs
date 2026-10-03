import { chromium } from '@playwright/test';
const out = process.argv[2] ?? '/tmp/shots';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message + '\n' + e.stack));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto('http://localhost:4173/');
await page.waitForTimeout(500);
await page.click('.profile-card');
await page.fill('.modal input[type=text]', 'Tom');
await page.click('.modal .btn-primary');
await page.waitForTimeout(300);
await page.click('.menu-card.big');
await page.waitForTimeout(300);
await page.click('.sector.current');
await page.waitForTimeout(300);
await page.click('.tutorial .btn');
// Jouer ~25 s en répondant juste (sauf 1 erreur volontaire)
let shots = 0;
const t0 = Date.now();
let madeError = false;
while (Date.now() - t0 < 40000) {
  const state = await page.evaluate(() => {
    const g = window.mp2game;
    const f = g.focus;
    return { phase: g.phase, answer: f ? f.answer : null, label: f ? f.label : null, projectiles: g.projectiles.length, destroyed: g.score, wave: g.wave, bossHp: g.boss ? g.boss.hp : null };
  });
  if (state.phase === 'ended') break;
  if (state.answer !== null && state.projectiles === 0) {
    let ans = state.answer;
    if (!madeError && state.wave >= 1 && shots > 3) { ans = state.answer + 1; madeError = true; }
    await page.keyboard.type(String(ans), { delay: 40 });
    await page.keyboard.press('Enter');
    shots++;
    if (shots === 6) await page.screenshot({ path: `${out}/07-game-action.png` });
    if (madeError && shots === 5) { await page.waitForTimeout(400); await page.screenshot({ path: `${out}/08-game-error.png` }); }
  }
  await page.waitForTimeout(250);
}
const st = await page.evaluate(() => ({ phase: window.mp2game.phase, wave: window.mp2game.wave, score: window.mp2game.score, hp: window.mp2game.earth.hp, inv: window.mp2game.inventory, boss: !!window.mp2game.boss }));
console.log('state after play', JSON.stringify(st), 'shots', shots);
await page.screenshot({ path: `${out}/09-game-late.png` });
// Pause et abandon
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/10-pause.png` });
await page.click('.overlay .btn-ghost');
await page.waitForTimeout(200);
await page.click('.modal .btn-danger');
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/11-results.png`, fullPage: true });
await page.click('.btn-ghost.btn-big');
await page.waitForTimeout(300);
await page.click('.menu-card:nth-child(5)');
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/12-dashboard.png`, fullPage: true });
await page.click('.topbar .btn');
await page.click('.menu-card:nth-child(3)');
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/13-hangar.png`, fullPage: true });
await page.click('.topbar .btn');
await page.click('.menu-card.accent');
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/14-modes.png`, fullPage: true });
await page.click('.topbar .btn');
await page.click('.menu-card:nth-child(4)');
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/15-achievements.png`, fullPage: true });
await page.click('.topbar .btn');
await page.click('.menu-card:nth-child(6)');
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/16-settings.png`, fullPage: true });
// Persistance
await page.reload();
await page.waitForTimeout(600);
const persisted = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('mp2:save')); return { profiles: s.profiles.length, name: s.profiles[0].name, facts: Object.keys(s.profiles[0].facts).length, xp: s.profiles[0].xp, sessions: s.profiles[0].stats.sessions }; });
console.log('persisted', JSON.stringify(persisted));
// Portrait mobile
const mob = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
await mob.goto('http://localhost:4173/');
await mob.waitForTimeout(500);
await mob.tap('.profile-card');
await mob.fill('.modal input[type=text]', 'Zoé');
await mob.tap('.modal .btn-primary');
await mob.waitForTimeout(400);
await mob.screenshot({ path: `${out}/17-mobile-menu.png` });
await mob.tap('.menu-card.accent');
await mob.waitForTimeout(300);
await mob.tap('.mode-card:nth-child(3) .btn');
await mob.waitForTimeout(4000);
await mob.screenshot({ path: `${out}/18-mobile-game.png` });
console.log(JSON.stringify(errors, null, 1));
await browser.close();
