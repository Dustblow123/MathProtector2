import { chromium } from '@playwright/test';
const out = process.argv[2] ?? '/tmp/shots';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message + '\n' + e.stack));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
const log = (...a) => console.log(...a);

await page.goto('http://localhost:4173/');
await page.waitForTimeout(400);
await page.click('.profile-card');
await page.fill('.modal input[type=text]', 'Div');
await page.click('.modal .btn-primary');
await page.waitForTimeout(300);
await page.evaluate(() => {
  const a = window.mp2; const p = a.p; const now = Date.now() - 2 * 86400000;
  p.stats.sessions = 1; a.settings.lang = 'fr';
  p.sectors = { 0: { stars: 3, bestScore: 1, attempts: 1 }, 1: { stars: 3, bestScore: 1, attempts: 1 }, 2: { stars: 3, bestScore: 1, attempts: 1 }, 3: { stars: 2, bestScore: 1, attempts: 1 }, 4: { stars: 2, bestScore: 1, attempts: 1 } };
  for (const t of [1, 2, 10, 5, 3]) for (let b = 1; b <= 10; b++) p.facts[`${t}x${b}`] = { id: `${t}x${b}`, pKnown: 0.9, stability: 4, lastReview: now, reps: 5, lapses: 0, rtEma: 1800, recent: Array.from({ length: 5 }, () => ({ correct: true, rt: 1800 })), streak: 5 };
  a.persist(true); location.reload();
});
await page.waitForTimeout(700);

// 1) Sélecteur sur la carte de campagne, mémorisé après rechargement
await page.click('.menu-card.big');
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/80-campaign-picker.png` });
log('picker buttons', await page.$$eval('.ops-picker button', (b) => b.map((x) => x.textContent)));
await page.click('.ops-picker button:nth-child(2)');
await page.waitForTimeout(400);
await page.reload();
await page.waitForTimeout(600);
log('saved ops', await page.evaluate(() => JSON.parse(localStorage.getItem('mp2:save')).profiles[0].ops));
await page.click('.menu-card.big');
await page.waitForTimeout(300);
log('picker after reload selected', await page.$eval('.ops-picker button.sel', (b) => b.textContent));

// 2) Secteur de la table de 7 en division
await page.click('.sector:nth-child(8)');
await page.waitForTimeout(4500);
const info = await page.evaluate(() => ({ ops: window.mp2game.mode.ops, tables: window.mp2game.mode.tables, title: document.title }));
log('game', JSON.stringify(info));
let correct = 0; let echo = false; let helped = false;
for (let i = 0; i < 40 && correct < 6; i++) {
  const st = await page.evaluate(() => { const g = window.mp2game; const f = g.focus; return f && g.projectiles.length === 0 && g.phase === 'playing' ? { label: f.label, answer: f.answer, a: f.fact.a } : null; });
  if (!st) { await page.waitForTimeout(400); continue; }
  if (correct === 2 && !echo && st.a !== st.answer) {
    echo = true;
    await page.keyboard.type(String(st.a)); await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${out}/81-div-echo-error.png` });
    continue;
  }
  if (correct === 3 && !helped) {
    helped = true;
    await page.keyboard.press('h');
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${out}/82-div-help-card.png` });
    log('help steps', await page.$$eval('.help-step', (e) => e.map((x) => x.textContent)), await page.textContent('.help-card h2'));
    await page.keyboard.press('Escape'); // ferme la carte seulement, sans pause
    await page.waitForTimeout(300);
    log('phase after Escape', await page.evaluate(() => window.mp2game.phase));
  }
  await page.keyboard.type(String(st.answer)); await page.keyboard.press('Enter');
  correct++;
  if (correct === 1) { await page.waitForTimeout(150); await page.screenshot({ path: `${out}/83-div-game.png` }); }
  await page.waitForTimeout(600);
}
const labels = await page.evaluate(() => window.mp2game.asteroids.map((a) => a.label));
log('labels on screen', labels, 'all division', labels.every((l) => l.includes('÷')));
await page.keyboard.press('Escape');
await page.click('.overlay .btn-ghost');
await page.click('.modal .btn-danger');
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/84-results-div.png`, fullPage: true });
log('results chips', await page.$$eval('.fact-chip', (e) => e.map((x) => x.textContent).slice(0, 6)));
await page.click('.btn-ghost.btn-big');
await page.waitForTimeout(300);

// 3) Défi du jour en division (se termine tout seul) : erreurs voulues → résultats → mini-drill
await page.click('.menu-card.accent, .menu-card:has-text("Modes de jeu")');
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/85-modes-picker.png`, fullPage: true });
await page.click('.mode-card:nth-child(6) .btn');
await page.waitForTimeout(3500);
let errorsMade = 0; const t0 = Date.now();
while (Date.now() - t0 < 110000) {
  const st = await page.evaluate(() => { const g = window.mp2game; const f = g.focus; return { phase: g.phase, f: f && g.projectiles.length === 0 ? { answer: f.answer, a: f.fact.a, op: f.fact.op } : null }; });
  if (st.phase === 'ended') break;
  if (st.f) {
    const wrong = errorsMade < 3 && st.f.a !== st.f.answer && Math.random() < 0.3;
    if (wrong) errorsMade++;
    await page.keyboard.type(String(wrong ? st.f.a : st.f.answer)); await page.keyboard.press('Enter');
  }
  await page.waitForTimeout(450);
}
log('daily errors made', errorsMade, 'phase', await page.evaluate(() => window.mp2game?.phase));
await page.waitForTimeout(2600);
const drillBtn = await page.$('.btn-accent.btn-big');
log('drill button', !!drillBtn);
if (drillBtn) {
  await drillBtn.click();
  await page.waitForTimeout(500);
  const q0 = await page.textContent('.drill-question');
  log('drill question', q0);
  await page.screenshot({ path: `${out}/86-drill-div.png` });
  for (let i = 0; i < 6; i++) {
    const q = await page.textContent('.drill-question').catch(() => null);
    if (!q) break;
    const m = q.match(/(\d+) (÷|×) (\d+)/);
    if (!m) break;
    const ans = m[2] === '÷' ? Number(m[1]) / Number(m[3]) : Number(m[1]) * Number(m[3]);
    const wrong = i === 1;
    await page.keyboard.type(String(wrong ? Number(m[3]) : ans)); await page.keyboard.press('Enter');
    if (wrong) { await page.waitForTimeout(500); log('drill feedback', await page.textContent('.drill-feedback'), '| steps', await page.$$eval('.drill-steps div', (e) => e.map((x) => x.textContent))); await page.screenshot({ path: `${out}/87-drill-div-error.png` }); }
    await page.waitForTimeout(wrong ? 4400 : 1100);
  }
  await page.waitForTimeout(800);
}

// 4) Espace parent : deux grilles
await page.click('.btn-ghost.btn-big');
await page.waitForTimeout(300);
await page.click('.menu-card:has-text("Espace parent")');
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/88-dashboard-div.png`, fullPage: true });
const gridInfo = await page.evaluate(() => ({ corner: document.querySelector('.heatmap .hd')?.textContent, cells: document.querySelectorAll('.heatmap .cell').length, seen: [...document.querySelectorAll('.heatmap .cell')].filter((c) => !c.classList.contains('m0')).length, hint: [...document.querySelectorAll('.small.muted')].map((e) => e.textContent).filter((t) => /diviseur|divisor/.test(t))[0] }));
log('dashboard ÷ grid', JSON.stringify(gridInfo));
await page.click('.heatmap-seg, .seg button:nth-child(1)');
await page.waitForTimeout(300);
const gridMul = await page.evaluate(() => ({ corner: document.querySelector('.heatmap .hd')?.textContent, seen: [...document.querySelectorAll('.heatmap .cell')].filter((c) => !c.classList.contains('m0')).length }));
log('dashboard × grid', JSON.stringify(gridMul));
await page.screenshot({ path: `${out}/89-dashboard-mul.png`, fullPage: true });

// 5) Mode mixte en Survie
await page.click('.topbar .btn');
await page.waitForTimeout(300);
await page.click('.menu-card:has-text("Modes de jeu")');
await page.waitForTimeout(300);
await page.click('.ops-picker button:nth-child(3)');
await page.click('.mode-card:nth-child(2) .btn');
await page.waitForTimeout(3500);
const seenOps = new Set(); const seenLabels = new Set();
for (let i = 0; i < 70; i++) {
  const st = await page.evaluate(() => { const g = window.mp2game; const f = g.focus; return { ops: g.asteroids.map((a) => a.fact.op), labels: g.asteroids.map((a) => a.label), answers: g.asteroids.map((a) => a.answer), f: f && g.projectiles.length === 0 ? f.answer : null }; });
  st.ops.forEach((o) => seenOps.add(o)); st.labels.forEach((l) => seenLabels.add(l));
  if (new Set(st.answers).size !== st.answers.length) log('DUPLICATE ANSWERS', st.labels);
  if (st.f !== null) { await page.keyboard.type(String(st.f)); await page.keyboard.press('Enter'); }
  if (i === 25) await page.screenshot({ path: `${out}/90-mixed-game.png` });
  await page.waitForTimeout(450);
}
log('mixed ops seen', [...seenOps], 'sample labels', [...seenLabels].slice(0, 8));
log(JSON.stringify(errors, null, 1));
await browser.close();
