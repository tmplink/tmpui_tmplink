/**
 * global-search.spec.js — 全局搜索功能测试
 *
 * 功能点锚定：
 *  F1. 搜索入口可见（桌面 #vx-fl-search-btn / 移动 #vx-fl-mob-search-btn）
 *  F2. 打开浮层：overlay 挂载到 document.body、全屏覆盖、body 滚动锁定
 *  F3. 关闭：取消按钮、ESC 键均可关闭，body 滚动恢复
 *  F4. 短关键词保护（< 2 字符时显示提示，不发请求）
 *  F5. 有效关键词后展示结果列表或空状态
 *  F6. 结果项包含可点击的文件夹面包屑路径（.vx-gs-bc-seg 按钮）
 *  F7. 点击面包屑关闭浮层并导航到对应文件夹
 */
// @ts-check
const { test, expect } = require('@playwright/test');

const FILELIST_URL = '/?tmpui_page=/vx&module=filelist&view=list';

/** 等待 filelist 模块加载就绪 */
async function gotoFilelist(page) {
  await page.goto(FILELIST_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  try {
    await page.waitForLoadState('networkidle', { timeout: 3000 });
  } catch { /* 持续网络活动是正常现象，忽略 */ }
  await page.waitForSelector('#vx-fl-list, #vx-fl-empty, #vx-fl-loading', {
    state: 'attached',
    timeout: 10000,
  });
}

/** 打开搜索浮层并等待可见 */
async function openSearch(page) {
  const isMobile = (page.viewportSize()?.width ?? 1440) < 768;
  const btn = page.locator(isMobile ? '#vx-fl-mob-search-btn, #vx-fl-mob-search-row .vx-fl-mob-search-submit' : '#vx-fl-search-btn');
  await btn.click();
  await expect(page.locator('#vx-gs-overlay')).toBeVisible({ timeout: 2000 });
}

test.describe('全局搜索', () => {
  test.use({ storageState: 'tests/.auth/state.json' });

  // ── F1: 搜索入口 ──────────────────────────────────────────────
  test('F1 桌面端：搜索按钮可见', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 1440) < 768, '仅桌面端');
    await gotoFilelist(page);
    await expect(page.locator('#vx-fl-search-btn')).toBeVisible();
  });

  test('F1 移动端：搜索按钮可见', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 1440) >= 768, '仅移动端');
    await gotoFilelist(page);
    await expect(page.locator('#vx-fl-mob-search-btn, #vx-fl-mob-search-row .vx-fl-mob-search-submit')).toBeVisible();
  });

  // ── F2: 打开浮层 ──────────────────────────────────────────────
  test('F2 打开浮层：全屏覆盖、挂载到 body、输入框聚焦、滚动锁定', async ({ page }) => {
    await gotoFilelist(page);
    await openSearch(page);

    const overlay = page.locator('#vx-gs-overlay');
    await expect(overlay).toBeVisible();

    // 输入框获得焦点
    await expect(page.locator('#vx-gs-input')).toBeFocused();

    // overlay 必须是 body 的直接子元素（已通过 JS appendChild 移动）
    const isBodyChild = await page.evaluate(() => {
      const el = document.getElementById('vx-gs-overlay');
      return el && el.parentElement === document.body;
    });
    expect(isBodyChild).toBe(true);

    // body 添加了滚动锁定类
    await expect(page.locator('body')).toHaveClass(/vx-gs-no-scroll/);

    // overlay 占满视口（position: fixed inset: 0）
    const { width: vw, height: vh } = page.viewportSize() ?? { width: 0, height: 0 };
    const box = await overlay.boundingBox();
    expect(box).not.toBeNull();
    expect(Math.abs(box.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(box.y)).toBeLessThanOrEqual(8);
    expect(box.width).toBeCloseTo(vw, 0);
    expect(box.height).toBeCloseTo(vh, 0);
  });

  // ── F3: 关闭浮层 ──────────────────────────────────────────────
  test('F3 取消按钮关闭浮层并恢复滚动', async ({ page }) => {
    await gotoFilelist(page);
    await openSearch(page);

    await page.locator('.vx-gs-cancel-btn').click();
    await expect(page.locator('#vx-gs-overlay')).toBeHidden({ timeout: 1000 });
    // 滚动锁定解除
    const hasLock = await page.evaluate(() => document.body.classList.contains('vx-gs-no-scroll'));
    expect(hasLock).toBe(false);
  });

  test('F3 ESC 键关闭搜索浮层', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 1440) < 768, '移动端无物理键盘，跳过');
    await gotoFilelist(page);
    await openSearch(page);

    await page.keyboard.press('Escape');
    await expect(page.locator('#vx-gs-overlay')).toBeHidden({ timeout: 1500 });
  });

  // ── F4: 短关键词保护 ──────────────────────────────────────────
  test('F4 输入 1 个字符显示"至少 2 个字符"提示', async ({ page }) => {
    await gotoFilelist(page);
    await openSearch(page);

    await page.locator('#vx-gs-input').fill('a');
    await expect(page.locator('.vx-gs-hint')).toBeVisible({ timeout: 1000 });
  });

  // ── F5: 有效关键词展示结果或空态 ──────────────────────────────
  test('F5 有效关键词后展示结果区域或空状态，结果含 ukey 链接', async ({ page }) => {
    await gotoFilelist(page);
    await openSearch(page);

    await page.locator('#vx-gs-input').fill('test');

    // debounce 300ms + 请求，最长等 6s
    await expect(page.locator('#vx-gs-body .vx-gs-results, #vx-gs-body .vx-gs-empty')).toBeVisible({ timeout: 6000 });

    const items = page.locator('.vx-gs-result-item');
    const count = await items.count();
    if (count > 0) {
      for (let i = 0; i < Math.min(count, 5); i++) {
        const href = await items.nth(i).locator('.vx-gs-result-link').getAttribute('href');
        expect(href).toMatch(/ukey=/);
      }
    }
  });

  // ── F6: 面包屑路径 ────────────────────────────────────────────
  test('F6 有结果时至少一条结果包含可点击的文件夹面包屑', async ({ page }) => {
    await gotoFilelist(page);
    await openSearch(page);

    await page.locator('#vx-gs-input').fill('test');
    await expect(page.locator('#vx-gs-body .vx-gs-results, #vx-gs-body .vx-gs-empty')).toBeVisible({ timeout: 6000 });

    const items = page.locator('.vx-gs-result-item');
    const count = await items.count();
    if (count === 0) {
      test.skip(); // 无结果时跳过，不算失败
      return;
    }

    // 至少一条结果的路径区域里出现面包屑按钮
    const bcSegs = page.locator('.vx-gs-result-path .vx-gs-bc-seg');
    await expect(bcSegs.first()).toBeVisible({ timeout: 3000 });

    // 每个面包屑段是 button，文本非空
    const segCount = await bcSegs.count();
    for (let i = 0; i < Math.min(segCount, 6); i++) {
      const text = await bcSegs.nth(i).textContent();
      expect((text ?? '').trim().length).toBeGreaterThan(0);
    }
  });

  // ── F7: 点击面包屑导航 ────────────────────────────────────────
  test('F7 点击面包屑关闭浮层并跳转到对应文件夹', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 1440) < 768, '移动端跳过导航测试');
    await gotoFilelist(page);
    await openSearch(page);

    await page.locator('#vx-gs-input').fill('test');
    await expect(page.locator('#vx-gs-body .vx-gs-results, #vx-gs-body .vx-gs-empty')).toBeVisible({ timeout: 6000 });

    const bcSegs = page.locator('.vx-gs-result-path .vx-gs-bc-seg');
    const segCount = await bcSegs.count();
    if (segCount === 0) {
      test.skip();
      return;
    }

    // 点击第一个非"桌面"的面包屑段（有实际 mrid 的文件夹）
    // 若只有"桌面"段，点击它也应关闭浮层
    await bcSegs.first().click();

    // 浮层关闭
    await expect(page.locator('#vx-gs-overlay')).toBeHidden({ timeout: 2000 });
    // body 滚动锁定解除
    const hasLock = await page.evaluate(() => document.body.classList.contains('vx-gs-no-scroll'));
    expect(hasLock).toBe(false);
    // 文件列表已刷新（列表容器或空态可见）
    await page.waitForFunction(() => {
      const list = document.getElementById('vx-fl-list');
      const empty = document.getElementById('vx-fl-empty');
      const isVisible = (el) => !!el && !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
      return isVisible(list) || isVisible(empty);
    }, null, { timeout: 6000 });
  });
});

