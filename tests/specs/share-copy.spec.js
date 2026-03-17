/**
 * share-copy.spec.js — 文件/文件夹分享复制功能测试
 *
 * 功能点锚定：
 *  F1. 文件行：分享按钮（onclick 含 shareFile）可见（桌面端）
 *  F2. 点击文件分享按钮 → VXUI.copyToClipboard 被调用，参数含 /f/（桌面端）
 *  F3. 点击文件分享按钮 → Toast 成功提示（.vx-toast-success）出现（桌面端）
 *  F4. 公开文件夹行：分享按钮可见时，点击 → VXUI.copyToClipboard 被调用（桌面端）
 *  F5. 点击文件夹分享按钮 → Toast 成功提示出现（桌面端）
 *  F6. 点击分享按钮 → 图标短暂切换为 circle-check，2 秒后恢复（桌面端）
 *  F7. 连续复制计数准确：1 次点击 = 1 条（非 2 的旧 bug 回归）
 *  F7b. 连续复制计数准确：3 次点击 = 3 条
 *
 * 注：移动端分享按钮由 CSS 隐藏（.vx-list-action-btn:not(.vx-more-btn) display:none），
 *     相关测试仅在桌面端执行。
 */
// @ts-check
const { test, expect } = require('@playwright/test');

const FILELIST_URL = '/?tmpui_page=/vx&module=filelist&view=list';

/** 是否为移动端视口 */
function isMobileViewport(page) {
  return (page.viewportSize()?.width ?? 1440) < 768;
}

/** 等待 filelist 模块加载就绪，含行内容渲染 */
async function gotoFilelist(page) {
  await page.goto(FILELIST_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  try {
    await page.waitForLoadState('networkidle', { timeout: 3000 });
  } catch { /* 持续网络活动是正常现象 */ }
  // 等待列表容器挂载
  await page.waitForSelector('#vx-fl-list, #vx-fl-empty, #vx-fl-loading', {
    state: 'attached',
    timeout: 10000,
  });
  // 等待 loading 消失（内容渲染完毕）
  try {
    await page.waitForSelector('#vx-fl-loading', { state: 'hidden', timeout: 8000 });
  } catch { /* loading 可能一开始就不存在，忽略 */ }
  await page.waitForTimeout(500);
}

/**
 * 注入 VXUI.copyToClipboard spy，捕获被调用时的参数。
 */
async function injectCopySpy(page) {
  await page.evaluate(() => {
    window.__lastCopied = null;
    if (typeof VXUI !== 'undefined' && VXUI.copyToClipboard) {
      const _orig = VXUI.copyToClipboard.bind(VXUI);
      VXUI.copyToClipboard = (text) => {
        window.__lastCopied = text;
        return _orig(text);
      };
    }
  });
}

/** 读取 spy 捕获到的最后一次复制内容 */
async function getCopied(page) {
  return page.evaluate(() => window.__lastCopied);
}

test.describe('分享复制', () => {
  test.use({ storageState: 'tests/.auth/state.json' });

  // ── F1 + F2 + F3: 文件分享按钮（桌面端）─────────────────────
  test('F1 桌面端：文件列表中存在文件分享按钮', async ({ page }) => {
    test.skip(isMobileViewport(page), '移动端分享按钮由 CSS 隐藏，仅在桌面端验证');
    await gotoFilelist(page);

    const rowCount = await page.locator('.vx-list-row[data-ukey]').count();
    if (rowCount === 0) {
      test.skip(true, '当前账户无文件，跳过');
      return;
    }

    const shareBtn = page.locator('.vx-list-row[data-ukey]').first()
      .locator('button[onclick*="shareFile"]');
    await expect(shareBtn).toBeVisible();
  });

  test('F2 桌面端：点击文件分享 → copyToClipboard 被调用，参数含 /f/', async ({ page }) => {
    test.skip(isMobileViewport(page), '移动端分享按钮由 CSS 隐藏，仅在桌面端验证');
    await gotoFilelist(page);

    const rowCount = await page.locator('.vx-list-row[data-ukey]').count();
    if (rowCount === 0) {
      test.skip(true, '当前账户无文件，跳过');
      return;
    }

    await injectCopySpy(page);

    const shareBtn = page.locator('.vx-list-row[data-ukey]').first()
      .locator('button[onclick*="shareFile"]');
    await shareBtn.click();
    await page.waitForTimeout(400);

    const copied = await getCopied(page);
    expect(copied, 'copyToClipboard 应该被调用').not.toBeNull();
    expect(copied, '复制内容应包含 /f/').toMatch(/\/f\//);
  });

  test('F3 桌面端：点击文件分享 → Toast 成功提示出现', async ({ page }) => {
    test.skip(isMobileViewport(page), '移动端分享按钮由 CSS 隐藏，仅在桌面端验证');
    await gotoFilelist(page);

    const rowCount = await page.locator('.vx-list-row[data-ukey]').count();
    if (rowCount === 0) {
      test.skip(true, '当前账户无文件，跳过');
      return;
    }

    const shareBtn = page.locator('.vx-list-row[data-ukey]').first()
      .locator('button[onclick*="shareFile"]');
    await shareBtn.click();

    await expect(page.locator('#vx-toast-container .vx-toast-success')).toBeVisible({
      timeout: 3000,
    });
  });

  // ── F4 + F5: 文件夹分享按钮（桌面端，仅公开文件夹存在时验证）────
  test('F4 桌面端：公开文件夹行存在分享按钮', async ({ page }) => {
    test.skip(isMobileViewport(page), '移动端分享按钮由 CSS 隐藏，仅在桌面端验证');
    await gotoFilelist(page);

    const btnCount = await page.locator('.vx-list-row[data-mrid] button[onclick*="shareFolder"]').count();
    if (btnCount === 0) {
      test.skip(true, '当前账户无公开文件夹，跳过');
      return;
    }

    const shareBtn = page.locator('.vx-list-row[data-mrid] button[onclick*="shareFolder"]').first();
    await expect(shareBtn).toBeVisible();
  });

  test('F5 桌面端：点击文件夹分享 → copyToClipboard 被调用', async ({ page }) => {
    test.skip(isMobileViewport(page), '移动端分享按钮由 CSS 隐藏，仅在桌面端验证');
    await gotoFilelist(page);

    const btnCount = await page.locator('.vx-list-row[data-mrid] button[onclick*="shareFolder"]').count();
    if (btnCount === 0) {
      test.skip(true, '当前账户无公开文件夹，跳过');
      return;
    }

    await injectCopySpy(page);

    const shareBtn = page.locator('.vx-list-row[data-mrid] button[onclick*="shareFolder"]').first();
    await shareBtn.click();
    await page.waitForTimeout(400);

    const copied = await getCopied(page);
    expect(copied, 'copyToClipboard 应该被调用').not.toBeNull();
  });

  test('F5 桌面端：点击文件夹分享 → Toast 成功提示出现', async ({ page }) => {
    test.skip(isMobileViewport(page), '移动端分享按钮由 CSS 隐藏，仅在桌面端验证');
    await gotoFilelist(page);

    const btnCount = await page.locator('.vx-list-row[data-mrid] button[onclick*="shareFolder"]').count();
    if (btnCount === 0) {
      test.skip(true, '当前账户无公开文件夹，跳过');
      return;
    }

    const shareBtn = page.locator('.vx-list-row[data-mrid] button[onclick*="shareFolder"]').first();
    await shareBtn.click();

    await expect(page.locator('#vx-toast-container .vx-toast-success')).toBeVisible({
      timeout: 3000,
    });
  });

  // ── F6: 按钮 icon 点击反馈 ─────────────────────────────────────
  test('F6 桌面端：点击分享按钮 → 图标短暂切换为 circle-check，2 秒后恢复', async ({ page }) => {
    test.skip(isMobileViewport(page), '移动端分享按钮由 CSS 隐藏，仅在桌面端验证');
    await gotoFilelist(page);

    const rowCount = await page.locator('.vx-list-row[data-ukey]').count();
    if (rowCount === 0) {
      test.skip(true, '当前账户无文件，跳过');
      return;
    }

    const shareBtn = page.locator('.vx-list-row[data-ukey]').first()
      .locator('button[onclick*="shareFile"]');

    // 记录点击前的原始图标名
    const origIconName = await shareBtn.locator('iconpark-icon').getAttribute('name');

    await shareBtn.click();

    // 点击后按钮应立即获得 ok-flash 样式，图标切换为 circle-check
    await expect(shareBtn).toHaveClass(/vx-btn-ok-flash/, { timeout: 500 });
    const flashName = await shareBtn.locator('iconpark-icon').getAttribute('name');
    expect(flashName, '图标应切换为 circle-check').toBe('circle-check');

    // 2 秒后图标应恢复原始状态
    await page.waitForTimeout(2200);
    await expect(shareBtn).not.toHaveClass(/vx-btn-ok-flash/);
    const restoredName = await shareBtn.locator('iconpark-icon').getAttribute('name');
    expect(restoredName, '图标应恢复原始值').toBe(origIconName);
  });

  // ── F7: 连续复制计数准确性 ────────────────────────────────────
  test('F7 桌面端：连续复制 – 1 次点击计数为 1（非 2，带标题格式换行旧 bug 回归）', async ({ page }) => {
    test.skip(isMobileViewport(page), '移动端分享按钮由 CSS 隐藏，仅在桌面端验证');
    await page.addInitScript(() => {
      localStorage.setItem('pref_bulk_copy', 'true');
    });
    await gotoFilelist(page);

    const rowCount = await page.locator('.vx-list-row[data-ukey]').count();
    if (rowCount === 0) {
      test.skip(true, '当前账户无文件，跳过');
      return;
    }

    // 禁用按钮 flash，避免 disabled 状态干扰后续点击
    await page.evaluate(() => { VX_FILELIST.flashButtonOk = () => {}; });

    const shareBtn = page.locator('.vx-list-row[data-ukey]').first()
      .locator('button[onclick*="shareFile"]');
    await shareBtn.click();
    await page.waitForTimeout(400);

    const toastEl = page.locator('#vx-toast-container .vx-toast-success');
    await expect(toastEl).toBeVisible({ timeout: 3000 });
    const text = await toastEl.textContent();
    expect(text, '计数应为 1，不应为 2').toMatch(/\b1\b/);
    expect(text, '不应错误地显示 2').not.toMatch(/\b2\b/);
  });

  test('F7b 桌面端：连续复制 – 3 次点击计数为 3', async ({ page }) => {
    test.skip(isMobileViewport(page), '移动端分享按钮由 CSS 隐藏，仅在桌面端验证');
    await page.addInitScript(() => {
      localStorage.setItem('pref_bulk_copy', 'true');
    });
    await gotoFilelist(page);

    const rowCount = await page.locator('.vx-list-row[data-ukey]').count();
    if (rowCount === 0) {
      test.skip(true, '当前账户无文件，跳过');
      return;
    }

    // 禁用按钮 flash，允许对同一按钮快速连续点击
    await page.evaluate(() => { VX_FILELIST.flashButtonOk = () => {}; });

    const shareBtn = page.locator('.vx-list-row[data-ukey]').first()
      .locator('button[onclick*="shareFile"]');
    for (let i = 0; i < 3; i++) {
      await shareBtn.click();
      await page.waitForTimeout(200);
    }

    const toastEl = page.locator('#vx-toast-container .vx-toast-success');
    await expect(toastEl).toBeVisible({ timeout: 3000 });
    const text = await toastEl.textContent();
    expect(text, '3 次点击后计数应为 3').toMatch(/\b3\b/);
  });
});
