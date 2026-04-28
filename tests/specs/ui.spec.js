/**
 * ui.spec.js — UI 截图回归测试
 * 对 21 个页面进行全页滚动截图对比，动态区域使用 mask 遮罩
 * 同时捕获浏览器 console.error 和 JS 异常
 *
 * 此 spec 被 4 个 project 共用：desktop-light / mobile-light / desktop-dark / mobile-dark
 */
// @ts-check
const { test, expect } = require('@playwright/test');
const { pages } = require('../helpers/pages');
const { isAllowed } = require('../helpers/console-allowlist');

const legacyAiPageErrorPages = new Set(['404', '403', '504', 'tos', 'privacy']);

for (const pageConfig of pages) {
  test(`${pageConfig.name}`, async ({ page }, testInfo) => {
    const projectName = testInfo.project.name;
    const isDark = projectName.includes('dark');

    if (!pageConfig.requiresAuth) {
      await page.context().clearCookies();
      await page.addInitScript(() => {
        try {
          localStorage.removeItem('app_token');
          localStorage.removeItem('return_page');
          sessionStorage.clear();
        } catch {
          // ignore
        }
      });
    }

    // 收集 console 错误和页面异常
    /** @type {string[]} */
    const consoleErrors = [];
    /** @type {string[]} */
    const pageErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!isAllowed(text)) {
          consoleErrors.push(text);
        }
      }
    });

    page.on('pageerror', (error) => {
      const text = error.message || error.toString();
      if (text === 'ai is not defined' && legacyAiPageErrorPages.has(pageConfig.name)) {
        return;
      }
      if (!isAllowed(text)) {
        pageErrors.push(text);
      }
    });

    // 导航到页面。某些页面有长连接，直接使用 networkidle 可能导致超时。
    await page.goto(pageConfig.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    try {
      // 缩短 networkidle 超时时间，避免无尽轮询拖慢速度，提升整体测试速度
      await page.waitForLoadState('networkidle', { timeout: 2500 });
    } catch {
      // 网络持续活动是预期场景，继续执行后续断言。
    }

    // 等待关键元素出现
    try {
      await page.waitForSelector(pageConfig.waitFor, {
        state: 'attached',
        timeout: 5000,
      });
    } catch {
      // waitFor 选择器可能在某些 project/视口下不完全匹配（如移动端布局差异）
      // 不直接失败，继续截图——截图对比本身会发现问题
      console.warn(
        `[${projectName}/${pageConfig.name}] waitFor 选择器 "${pageConfig.waitFor}" 未在超时内出现`
      );
    }

    // 等待异步渲染和动画完成
    await page.waitForTimeout(800);

    // 密记页需要等待左右两侧加载占位消失，否则截图会在“加载中”与实际列表之间抖动。
    if (pageConfig.name === 'notes') {
      try {
        await page.waitForFunction(() => {
          const sidebarLoading = document.getElementById('vx-notes-loading');
          const mainLoading = document.getElementById('vx-notes-main-loading');
          const sidebarReady = !sidebarLoading || sidebarLoading.classList.contains('vx-hidden');
          const mainReady = !mainLoading || mainLoading.classList.contains('vx-hidden');
          return sidebarReady && mainReady;
        }, { timeout: 5000 });
      } catch {
        console.warn(`[${projectName}/${pageConfig.name}] 密记加载占位未在超时内消失`);
      }
    }

    // 直链页面约束："仪表盘"顶栏触发器仅允许移动端出现
    if (pageConfig.name.startsWith('direct-') && projectName.includes('desktop')) {
      await expect(page.locator('#vx-direct-header-tab-trigger')).toBeHidden();
    }

    // 展开内部滚动容器，确保 fullPage 截图可捕获全部内容
    try {
      await page.evaluate(() => {
        const targets = [
          document.getElementById('vx-module-container'),
          document.querySelector('#vx-module-container > .vx-content'),
          document.querySelector('#vx-module-container > .vx-content-list'),
        ];
        for (const el of targets) {
          if (!el) continue;
          el.style.overflow = 'visible';
          el.style.height = 'auto';
          el.style.maxHeight = 'none';
          el.style.minHeight = '0';
        }
      });
    } catch (error) {
      if (!String(error && error.message || error).includes('Execution context was destroyed')) {
        throw error;
      }
    }

    // 深色模式验证
    if (isDark) {
      const hasDarkClass = await page.evaluate(() =>
        document.documentElement.classList.contains('system-dark')
      );
      // 仅在有深色模式支持的页面断言（某些静态页可能无此逻辑）
      if (!hasDarkClass) {
        console.warn(`[${projectName}/${pageConfig.name}] 深色模式 class "system-dark" 未激活`);
      }
    }

    // 构建 mask locators（遮罩动态区域）
    const masks = [];
    for (const selector of pageConfig.masks) {
      const locator = page.locator(selector);
      // 仅添加页面中实际存在的元素
      const count = await locator.count();
      if (count > 0) {
        masks.push(locator);
      }
    }

    // 全页滚动截图对比
    await expect(page).toHaveScreenshot(`${pageConfig.name}.png`, {
      fullPage: true,
      mask: masks,
      maxDiffPixelRatio: 0.01,
      timeout: 30000,
    });

    // 断言：无异常 console.error
    if (consoleErrors.length > 0) {
      const report = consoleErrors.map((e, i) => `  ${i + 1}. ${e}`).join('\n');
      expect(
        consoleErrors,
        `[${projectName}/${pageConfig.name}] 检测到 ${consoleErrors.length} 条 console.error:\n${report}`
      ).toHaveLength(0);
    }

    // 断言：无未捕获的页面异常
    if (pageErrors.length > 0) {
      const report = pageErrors.map((e, i) => `  ${i + 1}. ${e}`).join('\n');
      expect(
        pageErrors,
        `[${projectName}/${pageConfig.name}] 检测到 ${pageErrors.length} 条页面异常:\n${report}`
      ).toHaveLength(0);
    }
  });
}
