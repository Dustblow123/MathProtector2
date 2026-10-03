import { chromium } from '@playwright/test';
const out = process.argv[2] ?? '/tmp/shots';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const mob = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const errors = [];
mob.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
await mob.goto('http://localhost:4173/MathProtector2/');
await mob.waitForTimeout(500);
await mob.tap('.profile-card');
await mob.fill('.modal input[type=text]', 'Zoé');
await mob.tap('.modal .btn-primary');
await mob.waitForTimeout(400);
await mob.screenshot({ path: `${out}/17-mobile-menu.png` });
await mob.tap('.menu-card.accent');
await mob.waitForTimeout(300);
await mob.screenshot({ path: `${out}/17b-mobile-modes.png` });
await mob.tap('.mode-card:nth-child(3) .btn');
await mob.waitForTimeout(5000);
await mob.screenshot({ path: `${out}/18-mobile-game.png` });
// Taper via le pavé
const ans = await mob.evaluate(() => { const f = window.mp2game.focus; return f ? String(f.answer) : null; });
if (ans) { for (const ch of ans) await mob.tap(`.numpad button:text-is("${ch}")`); await mob.waitForTimeout(600); }
await mob.screenshot({ path: `${out}/19-mobile-shot.png` });
console.log('mobile answer', ans, JSON.stringify(errors));
await browser.close();
