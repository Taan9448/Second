import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
await mkdir('test-results/motion', { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox'],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  ...(process.env.MOTION_VIDEO
    ? { recordVideo: { dir: 'test-results/motion', size: { width: 1440, height: 900 } } }
    : {}),
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
try {
  await page.goto('http://127.0.0.1:5173');
  // Test-only fixture, built by the real engine and persisted by the normal save path.
  await page.evaluate(async () => {
    const { newGame } = await import('/src/application/game.ts');
    const { createCombat, combatCommand, heroUnit, enemyUnit } =
      await import('/src/domain/combat.ts');
    const { commitSave, writeSettings } = await import('/src/persistence/save.ts');
    const save = newGame(1);
    const defs = [
      'b_slash',
      'b_double',
      'b_dragon',
      'b_guard',
      'c_resolve',
      'c_strike',
      'c_strike',
    ];
    const deck = defs.map((definitionId, i) => ({ id: `motion-${i}`, definitionId }));
    let battle = createCombat(
      'motion-fixture',
      [heroUnit('brush')],
      [enemyUnit('soldier', 'soldier', 3), enemyUnit('wolf', 'wolf', 3)],
      deck,
      123,
    );
    battle = combatCommand(battle, { type: 'advance', revision: battle.revision }).state;
    battle.zones.hand = Object.keys(battle.cards).slice(0, 5);
    battle.zones.draw = Object.keys(battle.cards).slice(5);
    battle.energy = 10; // Fixture only; normal energy remains 3.
    save.screen = 'battle';
    save.battle = battle;
    await commitSave(save, null, false);
    await writeSettings({ motion: true, volume: 0.35 });
  });
  await page.reload();
  await page.getByRole('button', { name: '이어하기' }).click();
  const hero = page.locator('.animated-hero');
  const idlePosition = await hero.evaluate((e) => getComputedStyle(e).backgroundPosition);
  await page.waitForTimeout(1150);
  expect(await hero.evaluate((e) => getComputedStyle(e).backgroundPosition)).not.toBe(idlePosition);
  await page.screenshot({ path: 'test-results/motion/idle.png' });
  const observed = await page.evaluateHandle(() => {
    const beats = [];
    const state = { beats, hasPixels: false };
    let raf;
    const sample = () => {
      const canvas = document.querySelector('.battle-effects');
      if (!state.hasPixels && canvas.width && canvas.height) {
        state.hasPixels = canvas
          .getContext('2d')
          .getImageData(0, 0, canvas.width, canvas.height)
          .data.some((v, i) => i % 4 === 3 && v > 0);
      }
      raf = requestAnimationFrame(sample);
    };
    raf = requestAnimationFrame(sample);
    const field = document.querySelector('.battlefield');
    const observer = new MutationObserver(() => {
      const canvas = field.querySelector('canvas');
      if (canvas.dataset.beat)
        beats.push({
          beat: canvas.dataset.beat,
          technique: canvas.dataset.technique,
          hp: field.querySelector('.enemy .health>span').textContent,
        });
    });
    observer.observe(field, { attributes: true, subtree: true });
    return {
      ...state,
      get hasPixels() {
        return state.hasPixels;
      },
      observer,
      stop: () => cancelAnimationFrame(raf),
    };
  });
  const idle = () => expect(page.locator('.save-indicator')).toHaveText('◈ 자동 저장');
  async function cast(id, target = true) {
    await page.locator(`.hand .card[data-definition="${id}"]`).click();
    if (target) await page.locator('.enemy').first().click();
    else await page.locator('.confirm-card').click();
  }
  const before = await page.locator('.enemy .health>span').first().innerText();
  await cast('b_slash');
  await expect(page.locator('.battle-effects')).toHaveAttribute('data-beat', 'windup');
  expect(await page.locator('.enemy .health>span').first().innerText()).toBe(before);
  await expect(page.locator('.end-turn')).toBeDisabled();
  await expect(page.locator('.battle-effects')).toHaveAttribute('data-beat', 'release');
  await page.waitForTimeout(50);
  expect(await observed.evaluate((o) => o.hasPixels)).toBe(true);
  await page.screenshot({ path: 'test-results/motion/slash.png' });
  await idle();
  expect(await page.locator('.enemy .health>span').first().innerText()).not.toBe(before);
  await cast('b_double');
  await expect(page.locator('.battle-effects')).toHaveAttribute('data-technique', 'double');
  await idle();
  await cast('b_guard', false);
  await expect(page.locator('.battle-effects')).toHaveAttribute('data-technique', 'guard');
  await idle();
  await expect(page.locator('.ally .health .block')).toContainText('9');
  await cast('b_dragon', false);
  await expect(page.locator('.battle-effects')).toHaveAttribute('data-beat', 'release');
  await page.waitForTimeout(90);
  await page.screenshot({ path: 'test-results/motion/dragon.png' });
  await idle();
  const beats = await observed.evaluate((o) => {
    o.observer.disconnect();
    o.stop();
    return o.beats;
  });
  expect(new Set(beats.map((b) => b.beat))).toEqual(
    new Set(['windup', 'release', 'impact', 'recover']),
  );
  // A committed action survives reload during wind-up without charging twice.
  await cast('c_resolve', false);
  await expect(page.locator('.battle-effects')).toHaveAttribute('data-beat', 'windup');
  await page.reload();
  await page.getByRole('button', { name: '이어하기' }).click();
  await idle();
  await expect(page.locator('.hand [data-definition="c_resolve"]')).toHaveCount(0);
  const enemyMotion = await page.evaluateHandle(() => {
    const poses = [];
    const observer = new MutationObserver(() =>
      poses.push([...document.querySelectorAll('.enemy')].map((e) => e.dataset.pose).join(',')),
    );
    observer.observe(document.querySelector('.battlefield'), { attributes: true, subtree: true });
    return { poses, observer };
  });
  await page.locator('.end-turn').click();
  await expect(page.locator('.turn-label span')).toHaveText('라운드 2', { timeout: 15000 });
  const enemyPoses = await enemyMotion.evaluate((o) => {
    o.observer.disconnect();
    return o.poses;
  });
  expect(enemyPoses.some((p) => p.includes('windup'))).toBe(true);
  await expect(page.locator('.turn-label b')).toHaveText('당신의 턴', { timeout: 15000 });
  await idle();
  await page.getByRole('button', { name: '설정', exact: true }).click();
  await page.getByRole('checkbox').uncheck();
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(hero).toHaveCSS('animation-name', 'none');
  const attack = page.locator('.hand [data-target="enemy"]:not(.unavailable)').first();
  await attack.click();
  await page.locator('.enemy').first().click();
  await idle();
  expect(errors).toEqual([]);
  console.log(
    'PASS: animated idle frames, windup/release/impact/recovery, nonempty canvas VFX, deferred HP, double strike, guard, dragon, enemy attack, refresh safety, reduced motion.',
  );
} finally {
  await page.screenshot({ path: 'test-results/motion/end.png' });
  console.log('Final turn:', await page.locator('.turn-label').innerText());
  const video = page.video();
  await context.close();
  if (video) console.log('Video:', await video.path());
  await browser.close();
}
