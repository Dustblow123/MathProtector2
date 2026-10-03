import { chromium } from '@playwright/test';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://localhost:4173/MathProtector2/');
await page.waitForTimeout(800);
console.log(await page.evaluate(() => {
  const c = document.querySelector('.menu-backdrop');
  const cs = getComputedStyle(c);
  return { w: c.clientWidth, h: c.clientHeight, pos: cs.position, inset: cs.inset, z: cs.zIndex, parent: c.parentElement.id, appPos: getComputedStyle(c.parentElement).position, width: cs.width, display: cs.display };
}));
await browser.close();
