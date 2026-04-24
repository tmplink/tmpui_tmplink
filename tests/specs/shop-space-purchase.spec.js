// @ts-check
const { test, expect } = require('@playwright/test');

const SHOP_URL = '/?tmpui_page=/vx&module=shop';

async function mockShopApi(page, scenario) {
  await page.addInitScript(mockScenario => {
    window.__shopApiHits = [];

    const queues = {
      space_buy: Array.isArray(mockScenario.space_buy) ? [...mockScenario.space_buy] : [],
      space_renew: Array.isArray(mockScenario.space_renew) ? [...mockScenario.space_renew] : [],
    };

    const buildResponse = (payload) => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(payload),
      json: async () => payload,
    });

    const originalFetch = window.fetch ? window.fetch.bind(window) : null;
    window.fetch = async function(url, options = {}) {
      const body = typeof options.body === 'string' ? options.body : '';
      const action = new URLSearchParams(body).get('action') || '';

      if (!['space_buy', 'space_renew', 'space_list'].includes(action)) {
        if (originalFetch) return originalFetch(url, options);
        throw new Error('fetch_unavailable');
      }

      window.__shopApiHits.push({ action, body, url: String(url) });

      let payload;
      if (action === 'space_buy') {
        payload = queues.space_buy.length > 0 ? queues.space_buy.shift() : { status: 1, data: { id: 1, price: 600 }, debug: [] };
      } else if (action === 'space_renew') {
        payload = queues.space_renew.length > 0 ? queues.space_renew.shift() : { status: 1, data: { cost: 600 }, debug: [] };
      } else {
        payload = { status: 1, data: [], debug: [] };
      }

      return buildResponse(payload);
    };
  }, scenario);
}

async function prepareShopHarness(page) {
  await page.goto(SHOP_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.VX_SHOP !== 'undefined' && typeof window.VXUI !== 'undefined');
  await page.evaluate(() => {
    if (window.VXUI && typeof window.VXUI.navigate === 'function') {
      window.VXUI.navigate('shop');
    }
  });
  await page.waitForSelector('#vx-shop-products .vx-shop-card', { state: 'attached' });
  await page.evaluate(() => {
    if (window.VX_SHOP && typeof window.VX_SHOP.showTab === 'function') {
      window.VX_SHOP.showTab('products');
    }
  });

  await page.evaluate(() => {
    window.__toastLog = [];
    window.__loadSpacesCalls = 0;
    window.__loadUserStatusCalls = 0;
    window.__getDetailsCalls = 0;
    window.__openCalls = [];
    window.__buySpaceCalls = 0;
    window.__makeOrderCalls = 0;

    const originalOpen = window.open;
    window.open = function(...args) {
      window.__openCalls.push(args);
      if (typeof originalOpen === 'function') {
        return originalOpen.apply(window, args);
      }
      return null;
    };

    const wrapToast = type => {
      const method = `toast${type}`;
      const original = window.VXUI && window.VXUI[method];
      if (!window.VXUI) return;
      window.VXUI[method] = function(msg) {
        window.__toastLog.push({ type: type.toLowerCase(), msg: String(msg || '') });
        if (original) return original.call(window.VXUI, msg);
      };
    };

    wrapToast('Error');
    wrapToast('Success');
    wrapToast('Warning');
    wrapToast('Info');

    if (window.TL) {
      window.TL.api_token = window.TL.api_token || 'test-token';
      window.TL.get_details = function(cb) {
        window.__getDetailsCalls += 1;
        if (typeof cb === 'function') cb();
      };
    }

    if (window.VX_SHOP && typeof window.VX_SHOP._buySpaceWithPoints === 'function') {
      const originalBuySpaceWithPoints = window.VX_SHOP._buySpaceWithPoints.bind(window.VX_SHOP);
      window.VX_SHOP._buySpaceWithPoints = async function(...args) {
        window.__buySpaceCalls += 1;
        return originalBuySpaceWithPoints(...args);
      };
    }

    if (window.VX_SHOP && typeof window.VX_SHOP.makeOrder === 'function') {
      const originalMakeOrder = window.VX_SHOP.makeOrder.bind(window.VX_SHOP);
      window.VX_SHOP.makeOrder = async function(...args) {
        window.__makeOrderCalls += 1;
        return originalMakeOrder(...args);
      };
    }

    window.VX_SHOP.loadSpaces = function() {
      window.__loadSpacesCalls += 1;
    };
    window.VX_SHOP.loadUserStatus = function() {
      window.__loadUserStatusCalls += 1;
    };
  });
}

async function triggerSpacePurchase(page, { spec = '256g', quantity = 1, months = 1 } = {}) {
  await page.evaluate(({ spec, quantity, months }) => {
    window.VX_SHOP.openStorage(spec);
    window.VX_SHOP.selectedCode = spec;
    window.VX_SHOP.purchaseType = 'space';
    window.VX_SHOP.selectedProduct = 'space';
    window.VX_SHOP.selectedPayment = 'point';
    window.VX_SHOP.spaceQuantity = quantity;
    window.VX_SHOP.spaceMonths = months;
    window.VX_SHOP.updateSpacePurchasePreview();
    window.VX_SHOP.updateModalPrice();
  }, { spec, quantity, months });

  await page.evaluate(() => window.VX_SHOP._buySpaceWithPoints());
}

async function getLastToast(page, type) {
  return page.evaluate(expectedType => {
    const list = Array.isArray(window.__toastLog) ? window.__toastLog : [];
    for (let i = list.length - 1; i >= 0; i--) {
      if (!expectedType || list[i].type === expectedType) return list[i];
    }
    return null;
  }, type);
}

async function waitForToastLog(page, type) {
  await page.waitForFunction(expectedType => {
    const list = Array.isArray(window.__toastLog) ? window.__toastLog : [];
    if (!expectedType) return list.length > 0;
    return list.some(item => item && item.type === expectedType);
  }, type || null, {
    timeout: 3000,
  });
}

async function resolveExpectedText(page, key, fallback) {
  return page.evaluate(({ key, fallback }) => {
    return window.VX_SHOP && typeof window.VX_SHOP.t === 'function'
      ? window.VX_SHOP.t(key, fallback)
      : fallback;
  }, { key, fallback });
}

test.describe('Shop Private Space Purchase Status Handling', () => {
  test.describe.configure({ mode: 'serial' });
  test.use({ storageState: 'tests/.auth/state.json' });

  const buyFailureCases = [
    {
      name: 'space_buy 2003 string data maps to insufficient points toast',
      scenario: {
        space_buy: [{ status: 2003, data: '点数不足', debug: [] }],
      },
      expectedKey: 'vx_point_insufficient',
      fallbackText: '点数不足',
      expectedLoadSpacesCalls: 0,
    },
    {
      name: 'space_buy 2004 falls back to generic purchase failure',
      scenario: {
        space_buy: [{ status: 2004, data: { message: '购买失败（系统错误）' }, debug: [] }],
      },
      expectedKey: 'vx_purchase_failed',
      fallbackText: '购买失败',
      expectedLoadSpacesCalls: 0,
    },
    {
      name: 'space_buy 2101 maps to invalid spec toast',
      scenario: {
        space_buy: [{ status: 2101, data: { message: '无效的规格，可选值：256g / 1t' }, debug: '' }],
      },
      expectedKey: 'vx_space_invalid_spec',
      fallbackText: '无效的私有空间规格',
      expectedLoadSpacesCalls: 0,
    },
    {
      name: 'space_buy 2102 maps to cap reached toast and refreshes spaces',
      scenario: {
        space_buy: [{ status: 2102, data: { message: '可叠加私有空间总量不能超过 10TB' }, debug: '' }],
      },
      expectedKey: 'vx_space_cap_reached',
      fallbackText: '私有空间已达上限（10TB），无法继续购买',
      expectedLoadSpacesCalls: 1,
    },
    {
      name: 'space_buy 2104 maps to spec data error toast',
      scenario: {
        space_buy: [{ status: 2104, data: { message: '私有空间规格数据异常' }, debug: '' }],
      },
      expectedKey: 'vx_space_spec_error',
      fallbackText: '私有空间规格数据异常，请稍后重试',
      expectedLoadSpacesCalls: 0,
    },
    {
      name: 'space_buy generic status preserves backend message',
      scenario: {
        space_buy: [{ status: 0, data: { message: '登录已失效' }, debug: [] }],
      },
      literalMessage: '登录已失效',
      expectedLoadSpacesCalls: 0,
    },
  ];

  for (const item of buyFailureCases) {
    test(item.name, async ({ page }) => {
      await mockShopApi(page, item.scenario);
      await prepareShopHarness(page);

      await triggerSpacePurchase(page);

      expect(await page.evaluate(() => window.__buySpaceCalls || 0)).toBe(1);
      await waitForToastLog(page, 'error');
      const expectedMessage = item.literalMessage || await resolveExpectedText(page, item.expectedKey, item.fallbackText);
      const lastErrorToast = await getLastToast(page, 'error');
      expect(lastErrorToast).toBeTruthy();
      expect(lastErrorToast.msg).toContain(expectedMessage);

      const loadSpacesCalls = await page.evaluate(() => window.__loadSpacesCalls || 0);
      expect(loadSpacesCalls).toBe(item.expectedLoadSpacesCalls);
    });
  }

  test('space_renew 2103 during multi-month purchase shows renew error and refreshes state', async ({ page }) => {
    await mockShopApi(page, {
      space_buy: [
        { status: 1, data: { id: 101, price: 600 }, debug: [] },
      ],
      space_renew: [
        { status: 2103, data: { message: '部分或全部 ID 无效' }, debug: '' },
      ],
    });
    await prepareShopHarness(page);

    await triggerSpacePurchase(page, { months: 2 });

  expect(await page.evaluate(() => window.__buySpaceCalls || 0)).toBe(1);
  await waitForToastLog(page, 'error');
  const renewErrorToast = await getLastToast(page, 'error');
  expect(renewErrorToast).toBeTruthy();
  expect(renewErrorToast.msg).toContain(await resolveExpectedText(page, 'vx_space_invalid_ids', '私有空间记录无效，请刷新后重试'));

    const counters = await page.evaluate(() => ({
      loadSpaces: window.__loadSpacesCalls || 0,
      loadUserStatus: window.__loadUserStatusCalls || 0,
      getDetails: window.__getDetailsCalls || 0,
    }));
    expect(counters.loadSpaces).toBe(1);
    expect(counters.getDetails).toBe(1);
    expect(counters.loadUserStatus).toBe(1);
  });

  test('successful multi-month purchase accumulates total cost and refreshes user state', async ({ page }) => {
    await mockShopApi(page, {
      space_buy: [
        { status: 1, data: { id: 201, price: 600 }, debug: [] },
        { status: 1, data: { id: 202, price: 600 }, debug: [] },
      ],
      space_renew: [
        { status: 1, data: { cost: 1200 }, debug: [] },
        { status: 1, data: { cost: 1200 }, debug: [] },
      ],
    });
    await prepareShopHarness(page);

    await triggerSpacePurchase(page, { quantity: 2, months: 2 });

  expect(await page.evaluate(() => window.__buySpaceCalls || 0)).toBe(1);
  await waitForToastLog(page, 'success');
  const successToast = await getLastToast(page, 'success');
  expect(successToast).toBeTruthy();
  expect(successToast.msg).toContain('2400');

    const counters = await page.evaluate(() => ({
      loadSpaces: window.__loadSpacesCalls || 0,
      loadUserStatus: window.__loadUserStatusCalls || 0,
      getDetails: window.__getDetailsCalls || 0,
    }));
    expect(counters.loadSpaces).toBe(1);
    expect(counters.getDetails).toBe(1);
    expect(counters.loadUserStatus).toBe(1);
  });
});