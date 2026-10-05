import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium, expect } from '@playwright/test';

// A strict static host: no Vite transforms or SPA fallback can hide broken Pages paths.
const root = resolve('dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = resolve(root, pathname.slice('/Second/'.length) || 'index.html');
  if (!pathname.startsWith('/Second/') || !file.startsWith(root + '/')) {
    res.writeHead(404).end();
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  const loaded = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', req => errors.push(req.url()));
  page.on('response', response => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
    loaded.push(new URL(response.url()).pathname);
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/Second/`);
  await page.getByRole('button', { name: '여정 시작' }).click();
  await page.getByRole('button', { name: /01 새로운 여정/ }).click();
  await expect(page.getByRole('button', { name: '원정 떠나기' })).toBeEnabled();
  await page.getByRole('button', { name: /세 캐릭터 전투 연습/ }).click();
  await expect(page.locator('.energy-orb strong')).toHaveText('3');
  await expect(page.locator('.ally')).toHaveCount(3);
  await expect(page.locator('.hand .card')).toHaveCount(5);
  await expect(page.locator('.save-indicator')).toHaveText('◈ 자동 저장');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState('networkidle');
  for (const asset of ['courtyard.png', 'characters.png', 'cards.png']) {
    expect(loaded).toContain(`/Second/art/${asset}`);
  }
  expect(loaded.some(path => path.startsWith('/Second/fonts/'))).toBe(true);
  expect(loaded.every(path => path.startsWith('/Second/'))).toBe(true);
  expect(errors).toEqual([]);
  console.log('Pages production check passed: /Second/ title, lobby, 3-party battle, save, artwork and fonts.');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
