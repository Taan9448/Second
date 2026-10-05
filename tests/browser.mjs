import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
await mkdir('test-results', { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox'],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript(() => {
  const native = crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues = (array) =>
    array instanceof Uint32Array && array.length === 1
      ? ((array[0] = 24681357), array)
      : native(array);
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`${m.text()} ${m.location().url}`);
});
const idle = () => expect(page.locator('.save-indicator')).toHaveText('◈ 자동 저장');
const playerReady = () => expect(page.locator('.turn-label b')).toHaveText(/당신의 턴|승리|패배/);
async function selectAndPlay(card, targetSelector) {
  await card.click();
  await expect(page.locator('.card.selected')).toHaveCount(1);
  const target = await card.getAttribute('data-target');
  if (target === 'self' || target === 'none') await page.locator('.confirm-card').click();
  else await page.locator(targetSelector).click();
  await expect(page.locator('.card.selected')).toHaveCount(0);
  await idle();
}
async function resolveChoice() {
  const dialog = page.getByRole('dialog');
  if (!(await dialog.count())) return;
  const name = await dialog.getAttribute('aria-label');
  if (name.startsWith('1장을')) await dialog.locator('.card').first().click();
  await dialog.getByRole('button', { name: /선택 확정/ }).click();
  await expect(dialog).toHaveCount(0);
  await idle();
}
async function autoBattle() {
  for (let turn = 0; turn < 45; turn++) {
    await playerReady();
    if (await page.locator('.battle-result').count()) return;
    if (turn % 3 === 0)
      console.log('battle turn', turn, await page.locator('.turn-label').innerText());
    for (let action = 0; action < 30; action++) {
      await resolveChoice();
      if (await page.locator('.battle-result').count()) return;
      const info = await page.locator('.hand .card:not(.unavailable)').evaluateAll((nodes) =>
        nodes.map((n) => ({
          id: n.dataset.definition,
          cost: Number(n.dataset.cost),
          instance: n.dataset.instance,
          target: n.dataset.target,
        })),
      );
      if (!info.length) break;
      const incoming = await page.locator('.enemy:not(.down) .intent').evaluateAll((nodes) =>
        nodes.reduce((sum, n) => {
          const t = n.textContent;
          const m = t.match(/⚔\s*(\d+)(?:\s*×\s*(\d+))?/);
          return sum + (m ? Number(m[1]) * Number(m[2] || 1) : 0);
        }, 0),
      );
      const blockText = (await page.locator('.ally .block').allTextContents())[0] || '0',
        block = Number(blockText.match(/\d+/)?.[0] || 0);
      const scored = info
        .map((c) => ({
          ...c,
          score:
            c.id === 'c_resolve'
              ? 100
              : c.id === 'b_dragon'
                ? 90
                : c.id === 'c_break' && incoming === 0
                  ? 80
                  : ['b_guard', 'c_guard'].includes(c.id)
                    ? block < incoming - 3
                      ? 75
                      : 5
                    : ['b_slash', 'b_double', 'b_mark', 'c_strike', 'c_break'].includes(c.id)
                      ? 60
                      : c.id === 'c_focus'
                        ? 40
                        : c.id === 'b_flow'
                          ? 30
                          : 0,
        }))
        .filter((c) => c.score > 0)
        .sort((a, b) => b.score - a.score);
      if (!scored.length) break;
      const chosen = scored[0];
      const enemies = await page
        .locator('.enemy:not(.down)')
        .evaluateAll((nodes) =>
          nodes.map((n) => ({
            id: n.dataset.unit,
            hp: Number(n.querySelector('.health>span').textContent.split('/')[0]),
          })),
        )
        .then((items) => items.sort((a, b) => a.hp - b.hp));
      if (!enemies.length) return;
      await selectAndPlay(
        page.locator(`.hand .card[data-instance="${chosen.instance}"]`),
        `[data-unit="${enemies[0].id}"]`,
      );
    }
    if (await page.locator('.battle-result').count()) return;
    await page.keyboard.press('e');
    await idle();
    await playerReady();
  }
  throw new Error('Combat did not settle within 45 rounds');
}
try {
  await page.goto('http://127.0.0.1:5173');
  await expect(page.getByRole('button', { name: '여정 시작' })).toBeEnabled();
  await page.screenshot({ path: 'test-results/title.png' });
  await page.getByRole('button', { name: '여정 시작' }).click();
  await page.getByRole('button', { name: /01 새로운 여정/ }).click();
  await expect(page.getByRole('button', { name: '원정 떠나기' })).toBeEnabled();
  await page.screenshot({ path: 'test-results/lobby.png' });
  await page.getByRole('button', { name: '설정', exact: true }).click();
  await page.getByRole('checkbox').uncheck();
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByRole('button', { name: /덱 편성/ }).click();
  await page.locator('.deck-entries button').first().click();
  await page.locator('.card-grid [data-definition="b_double"]').click();
  await idle();
  await expect(page.locator('.deck-entries button').first()).toHaveText(/쌍획/);
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: '이어하기' }).click();
  await page.getByRole('button', { name: /덱 편성/ }).click();
  await expect(page.locator('.deck-entries button').first()).toHaveText(/쌍획/);
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByRole('button', { name: '원정 떠나기' }).click();
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: i < 2 ? '다음 →' : '여정으로 →' }).click();
    await idle();
  }
  await expect(page.locator('.map-node:not(:disabled)')).toHaveCount(1);
  await page.screenshot({ path: 'test-results/map.png' });
  await page.getByRole('button', { name: /뒤뜰의 추격자/ }).click();
  await playerReady();
  await expect(page.locator('.energy-orb strong')).toHaveText('3');
  await page.keyboard.press('1');
  await expect(page.locator('.card.selected')).toHaveAttribute('data-definition', 'c_resolve');
  await page.locator('.confirm-card').click();
  await idle();
  await expect(page.locator('.energy-orb strong')).toHaveText('2');
  await page.reload();
  await page.getByRole('button', { name: '이어하기' }).click();
  await playerReady();
  await expect(page.locator('.energy-orb strong')).toHaveText('2');
  await page.keyboard.press('d');
  await expect(page.getByRole('dialog', { name: '뽑기 더미' })).toBeVisible();
  await page.keyboard.press('Escape');
  const attack = page.locator('.hand .card[data-target="enemy"]:not(.unavailable)').first();
  await attack.click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.energy-orb strong')).toHaveText('2');
  const hpBefore = Number(
    (await page.locator('.enemy .health>span').first().innerText()).split('/')[0],
  );
  const transfer = await page.evaluateHandle(() => new DataTransfer());
  await attack.dispatchEvent('dragstart', { dataTransfer: transfer });
  await page.locator('.enemy').first().dispatchEvent('drop', { dataTransfer: transfer });
  await idle();
  await expect
    .poll(async () =>
      Number((await page.locator('.enemy .health>span').first().innerText()).split('/')[0]),
    )
    .toBeLessThan(hpBefore);
  await autoBattle();
  await expect(page.locator('.battle-result .eyebrow')).toHaveText('VICTORY');
  await page.getByRole('button', { name: '다음으로 →' }).click();
  await idle();
  await expect(page.locator('.reward-cards .card')).toHaveCount(3);
  const optionsBefore = await page
    .locator('.reward-cards .card')
    .evaluateAll((nodes) => nodes.map((n) => n.dataset.definition));
  await page.reload();
  await page.getByRole('button', { name: '이어하기' }).click();
  await expect(page.locator('.reward-cards .card')).toHaveCount(3);
  expect(
    await page
      .locator('.reward-cards .card')
      .evaluateAll((nodes) => nodes.map((n) => n.dataset.definition)),
  ).toEqual(optionsBefore);
  await page.getByRole('button', { name: /보상을 받지 않고 계속/ }).click();
  await idle();
  let combatCount = 1;
  for (let room = 0; room < 12; room++) {
    if (await page.locator('.story-screen').count()) break;
    await expect(page.locator('.map-node:not(:disabled)')).not.toHaveCount(0);
    const event = page
      .locator('.map-node:not(:disabled)')
      .filter({ has: page.locator('.node-icon', { hasText: '書' }) });
    await (
      (await event.count()) ? event.first() : page.locator('.map-node:not(:disabled)').first()
    ).click();
    await idle();
    if (await page.locator('.battle-dock').count()) {
      await autoBattle();
      await expect(page.locator('.battle-result .eyebrow')).toHaveText('VICTORY');
      combatCount++;
      await page.getByRole('button', { name: '다음으로 →' }).click();
      await idle();
      if (await page.locator('.reward-screen').count()) {
        await page.getByRole('button', { name: /보상을 받지 않고 계속/ }).click();
        await idle();
      }
    } else if (await page.locator('.room-screen').count()) {
      await page.locator('.room-choices button').first().click();
      await idle();
    }
  }
  await expect(page.locator('.story-screen')).toBeVisible();
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: i < 2 ? '다음 →' : '여정으로 →' }).click();
    await idle();
  }
  await expect(page.getByRole('button', { name: '첫 번째 장 다시 도전' })).toBeVisible();
  await page.getByRole('button', { name: /세 캐릭터 전투 연습/ }).click();
  await playerReady();
  await page.screenshot({ path: 'test-results/battle.png' });
  await expect(page.locator('.ally')).toHaveCount(3);
  await expect(page.locator('.hand .card')).toHaveCount(5);
  const second = await context.newPage();
  await second.goto('http://127.0.0.1:5173');
  await second.getByRole('button', { name: '이어하기' }).click();
  await expect(second.getByRole('button', { name: '첫 번째 장 다시 도전' })).toBeVisible();
  await second.close();
  // Stress fixture: move existing cards only, add two legitimate independent enemy units.
  await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const r = indexedDB.open('cheonoe-geomgyeol');
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    const tx = db.transaction('saves', 'readwrite'),
      store = tx.objectStore('saves');
    const value = await new Promise((resolve) => {
      const r = store.get('debug:practice');
      r.onsuccess = () => resolve(r.result);
    });
    value.battle.zones.hand.push(...value.battle.zones.draw.splice(0, 5));
    const clone = value.battle.enemies[0];
    value.battle.enemies.push(
      { ...structuredClone(clone), id: 'extra-1' },
      { ...structuredClone(clone), id: 'extra-2' },
    );
    value.battle.intents.push(
      ...['extra-1', 'extra-2'].map((enemyId) => ({
        ...structuredClone(value.battle.intents[0]),
        enemyId,
      })),
    );
    value.revision++;
    store.put(value, 'debug:practice');
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
    db.close();
  });
  // Continue practice from its distinct namespace using a normal page reload and saved import.
  await page.reload();
  await page.evaluate(async () => {
    const db = await new Promise((resolve) => {
      const r = indexedDB.open('cheonoe-geomgyeol');
      r.onsuccess = () => resolve(r.result);
    });
    const tx = db.transaction('saves', 'readwrite'),
      store = tx.objectStore('saves');
    const value = await new Promise((resolve) => {
      const r = store.get('debug:practice');
      r.onsuccess = () => resolve(r.result);
    });
    value.slot = 3;
    store.put(value, 'campaign:3');
    await new Promise((resolve) => (tx.oncomplete = resolve));
    db.close();
  });
  await page.getByRole('button', { name: '여정 시작' }).click();
  await page.getByRole('button', { name: /03 청연문의 밤/ }).click();
  await playerReady();
  await expect(page.locator('.hand .card')).toHaveCount(10);
  await expect(page.locator('.enemy')).toHaveCount(5);
  for (const size of [
    { width: 1280, height: 720 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(size);
    await page.screenshot({ path: `test-results/battle-${size.width}.png` });
    const bounds = await page.locator('.battle-dock').boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(size.width);
    const cards = await page.locator('.hand .card').evaluateAll((nodes) =>
      nodes.map((n) => ({
        x: n.getBoundingClientRect().x,
        right: n.getBoundingClientRect().right,
      })),
    );
    expect(Math.min(...cards.map((c) => c.x))).toBeGreaterThan(0);
    expect(Math.max(...cards.map((c) => c.right))).toBeLessThan(size.width);
  }
  expect(errors).toEqual([]);
  console.log(
    `PASS: title/lobby/deck, keyboard/cancel/drag, refresh+reward, full chapter (${combatCount} combats), practice isolation, 10-card/5-enemy layouts, no console errors.`,
  );
} catch (error) {
  await page.screenshot({ path: 'test-results/failure.png' });
  console.error('PAGE:', (await page.locator('body').innerText()).slice(-4000));
  throw error;
} finally {
  await browser.close();
}
